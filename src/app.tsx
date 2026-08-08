import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Notice, TFile } from "obsidian";
import { render } from "./markdown/render/html";
import { preprocessObsidianWikilinks } from "./markdown/preprocess/wikilinks";
import { Preview } from "./components/Preview";
import { ChannelBar, type Channel } from "./components/ChannelBar";
import { confirmPublish } from "./components/ConfirmPublishModal";
import { prepareBlogPost, type BlogPost } from "./blog/prepare";
import { prepareWechatContent } from "./wechat/prepare";
import { extractImageSources, replaceImageSources, sourceToAsset } from "./wechat/html";
import {
  DEFAULT_WECHAT_TEMPLATE_ID,
  discoverWechatTemplates,
  getBuiltinWechatTemplates,
  type WechatTemplate,
} from "./wechat/templates";
import type { WechatPost, WechatPublishProgress } from "./wechat/types";
import type WindPostPlugin from "../main";

interface Props {
  plugin: WindPostPlugin;
}

interface Doc {
  path: string;
  content: string;
}

const EMPTY_DOC: Doc = { path: "", content: "" };

export function App({ plugin }: Props) {
  const app = plugin.app;
  const settings = plugin.settings;
  const [doc, setDoc] = useState<Doc>(EMPTY_DOC);
  const [fileName, setFileName] = useState("(无活动笔记)");
  const [channel, setChannel] = useState<Channel>("blog");
  const [html, setHtml] = useState("");
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [wechatPost, setWechatPost] = useState<WechatPost | null>(null);
  const [wechatTemplates, setWechatTemplates] = useState<WechatTemplate[]>(
    getBuiltinWechatTemplates,
  );
  const [wechatTemplateId, setWechatTemplateId] = useState(
    settings.wechatTemplateId || DEFAULT_WECHAT_TEMPLATE_ID,
  );
  const [status, setStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<WechatPublishProgress | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState<boolean | null>(null);
  const [initializingWorkspace, setInitializingWorkspace] = useState(false);

  const refreshWechatTemplates = useCallback(async (showNotice = false) => {
    const discovery = await discoverWechatTemplates(app);
    setWechatTemplates(discovery.templates);
    setWechatTemplateId((current) => (
      discovery.templates.some((template) => template.id === current)
        ? current
        : DEFAULT_WECHAT_TEMPLATE_ID
    ));
    if (discovery.errors.length > 0) {
      console.warn("WindPost: 自定义公众号模板加载失败", discovery.errors);
      if (showNotice) {
        new Notice(`WindPost: ${discovery.errors.length} 个公众号模板未通过校验`, 8000);
      }
    } else if (showNotice) {
      const customCount = discovery.templates.filter((template) => template.source === "custom").length;
      new Notice(`WindPost: 已加载 ${customCount} 个自定义公众号模板`);
    }
  }, [app]);

  useEffect(() => {
    void refreshWechatTemplates();
  }, [refreshWechatTemplates]);

  useEffect(() => {
    let cancelled = false;
    void plugin.getWorkspaceStatus()
      .then((result) => {
        if (!cancelled) setWorkspaceReady(result.initialized);
      })
      .catch((error) => {
        console.warn("WindPost: 无法检查工作区状态", error);
        if (!cancelled) setWorkspaceReady(false);
      });
    return () => { cancelled = true; };
  }, [plugin]);

  useEffect(() => plugin.onWechatPreviewRequest((templateId) => {
    setChannel("wechat");
    setWechatTemplateId(templateId);
  }), [plugin]);

  useEffect(() => {
    const refresh = () => {
      const file = app.workspace.getActiveFile();
      if (!(file instanceof TFile)) {
        setFileName("(无活动笔记)");
        setDoc(EMPTY_DOC);
        return;
      }
      setFileName(file.path);
      void app.vault.cachedRead(file).then((content) => setDoc({ path: file.path, content }));
    };

    refresh();
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, settings.editDebounceMs);
    };
    const refs = [
      app.workspace.on("active-leaf-change", refresh),
      app.workspace.on("file-open", refresh),
      app.workspace.on("editor-change", schedule),
    ];
    return () => {
      refs.forEach((ref) => app.workspace.offref(ref));
      window.clearTimeout(timer);
    };
  }, [app, settings.editDebounceMs]);

  useEffect(() => {
    let cancelled = false;
    setMessage("");
    setErrorMessage(null);
    setBlogPost(null);
    setWechatPost(null);

    if (!doc.content) {
      setHtml("");
      setStatus("idle");
      return;
    }
    setStatus("rendering");
    void (async () => {
      try {
        if (channel === "blog") {
          const post = await prepareBlogPost({ app, sourcePath: doc.path, markdown: doc.content });
          const nextHtml = await render({
            markdown: preprocessObsidianWikilinks(post.previewMarkdown, app, doc.path),
            markdownStyle: settings.defaultMarkdownStyle,
            platform: "html",
            enableFootnoteLinks: settings.enableFootnoteLinks,
            openLinksInNewWindow: true,
          });
          if (cancelled) return;
          setBlogPost(post);
          setHtml(nextHtml);
        } else {
          const prepared = prepareWechatContent({
            app,
            sourcePath: doc.path,
            markdown: doc.content,
            defaultAuthor: settings.wechatDefaultAuthor,
          });
          const template = wechatTemplates.find((item) => item.id === wechatTemplateId)
            || wechatTemplates[0];
          const nextHtml = await render({
            markdown: prepared.markdown,
            customCss: template?.css || "",
            platform: "wechat",
            enableFootnoteLinks: settings.enableFootnoteLinks,
            openLinksInNewWindow: true,
            wechatLayout: {
              variant: template?.layout || "default",
              title: prepared.title,
              digest: prepared.digest,
              accountName: settings.wechatAccountName,
              author: prepared.author,
              date: prepared.layoutDate,
            },
          });
          if (cancelled) return;
          const { markdown: _markdown, layoutDate: _layoutDate, ...metadata } = prepared;
          setWechatPost({ ...metadata, contentHtml: nextHtml });
          setHtml(createWechatPreviewHtml(nextHtml, app));
        }
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [
    app,
    channel,
    doc,
    settings.defaultMarkdownStyle,
    settings.enableFootnoteLinks,
    settings.wechatAccountName,
    settings.wechatDefaultAuthor,
    wechatTemplateId,
    wechatTemplates,
  ]);

  const selectWechatTemplate = (id: string) => {
    setWechatPost(null);
    setStatus("rendering");
    setWechatTemplateId(id);
    plugin.settings.wechatTemplateId = id;
    void plugin.saveSettings();
  };

  const initializeWorkspace = async () => {
    if (initializingWorkspace) return;
    setInitializingWorkspace(true);
    const success = await plugin.initializeWorkspace();
    if (success) setWorkspaceReady(true);
    setInitializingWorkspace(false);
  };

  const publishBlog = async () => {
    if (!blogPost || publishing) return;
    const confirmed = await confirmPublish(
      app,
      "发布至 Blog",
      `将「${blogPost.title}」及 ${blogPost.files.length - 1} 个附件提交到 ${settings.githubOwner}/${settings.githubRepo} 的 ${settings.githubBranch} 分支。`,
    );
    if (!confirmed) return;

    setPublishing(true);
    setPublishProgress({ percent: 10, label: "正在准备 Blog 内容" });
    setMessage("正在提交到 GitHub…");
    try {
      const result = await plugin.publishBlog(blogPost);
      setPublishProgress({ percent: 100, label: "Blog 已提交" });
      setMessage(`已提交 ${result.commitSha.slice(0, 7)}，等待 Vercel 部署。`);
      new Notice("WindPost: Blog 已提交到 GitHub");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`发布失败：${detail}`);
      new Notice(`WindPost Blog 发布失败：${detail}`, 8000);
      setPublishProgress(null);
    } finally {
      setPublishing(false);
    }
  };

  const publishWechat = async () => {
    if (!wechatPost || publishing) return;
    const imageCount = (wechatPost.contentHtml.match(/<img\b/gi) || []).length;
    const confirmed = await confirmPublish(
      app,
      "发布至公众号草稿",
      `将「${wechatPost.title}」及正文中的 ${imageCount} 张图片上传到微信公众号草稿箱。最终群发仍需在公众号后台人工确认。`,
      "创建草稿",
    );
    if (!confirmed) return;

    setPublishing(true);
    setPublishProgress({ percent: 0, label: "准备创建公众号草稿" });
    setMessage("正在上传公众号图片并创建草稿…");
    try {
      const result = await plugin.publishWechatDraft(wechatPost, setPublishProgress);
      setMessage(`公众号草稿已创建，上传 ${result.uploadedImages} 张正文图片。`);
      new Notice("WindPost: 公众号草稿已创建");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`公众号草稿创建失败：${detail}`);
      new Notice(`WindPost 公众号草稿创建失败：${detail}`, 10000);
      setPublishProgress(null);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="windpost-root">
      <header className="windpost-header">
        <span className="windpost-header-label">当前笔记</span>
        <span className="windpost-header-path">{fileName}</span>
        <span className="windpost-header-status">{message}</span>
      </header>

      {workspaceReady === false && (
        <section className="windpost-onboarding">
          <div>
            <strong>首次使用 WindPost</strong>
            <span>创建 WindPost 内容库、标准 Base 和两篇渠道示例；已有内容不会被覆盖。</span>
          </div>
          <button
            type="button"
            className="mod-cta"
            disabled={initializingWorkspace}
            onClick={() => void initializeWorkspace()}
          >
            {initializingWorkspace ? "正在初始化…" : "一键初始化"}
          </button>
        </section>
      )}

      <ChannelBar value={channel} onChange={setChannel} />

      {channel === "blog" && blogPost && (
        <div className="windpost-channel-meta">
          <strong>{blogPost.title}</strong>
          <span>/posts/{blogPost.slug}/</span>
          <span>{blogPost.date}</span>
        </div>
      )}
      {channel === "wechat" && (
        <div className="windpost-channel-meta">
          {wechatPost ? (
            <>
              <strong>{wechatPost.title}</strong>
              <span>{wechatPost.coverSource ? "封面已就绪" : "需要封面"}</span>
              <span>{(wechatPost.contentHtml.match(/<img\b/gi) || []).length} 张正文图片</span>
            </>
          ) : (
            <strong>公众号排版</strong>
          )}
          <label className="windpost-template-select">
            <span>模板</span>
            <select
              value={wechatTemplateId}
              onChange={(event) => selectWechatTemplate(event.target.value)}
              aria-label="公众号排版模板"
            >
              {wechatTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}{template.source === "builtin" ? "（内置）" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="windpost-template-refresh"
            title="重新扫描自定义公众号模板"
            onClick={() => void refreshWechatTemplates(true)}
          >
            刷新
          </button>
        </div>
      )}
      <main className="windpost-main">
        <Preview
          html={html}
          status={status}
          device={channel === "wechat" ? "phone" : "page"}
          emptyHint="打开一篇 Markdown 笔记开始预览"
          errorMessage={errorMessage}
        />
      </main>

      <footer className="windpost-actions">
        {publishProgress && (
          <div className="windpost-publish-progress">
            <div className="windpost-publish-progress-label">
              <span>{publishProgress.label}</span>
              <span>{publishProgress.percent}%</span>
            </div>
            <div
              className="windpost-publish-progress-track"
              role="progressbar"
              aria-label={publishProgress.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={publishProgress.percent}
            >
              <div style={{ width: `${publishProgress.percent}%` }} />
            </div>
          </div>
        )}
        {channel === "blog" && (
          <button type="button" className="mod-cta" disabled={!blogPost || publishing} onClick={() => void publishBlog()}>
            {publishing ? "正在发布…" : "发布至 Blog"}
          </button>
        )}
        {channel === "wechat" && (
          <button
            type="button"
            className="mod-cta"
            disabled={!wechatPost || publishing}
            onClick={() => void publishWechat()}
          >
            {publishing ? "正在创建草稿…" : "发布至公众号草稿"}
          </button>
        )}
      </footer>
    </div>
  );
}

function createWechatPreviewHtml(html: string, app: WindPostPlugin["app"]): string {
  const replacements = new Map<string, string>();
  for (const source of extractImageSources(html)) {
    const asset = sourceToAsset(source);
    if (asset?.kind !== "vault") continue;
    const file = app.vault.getAbstractFileByPath(asset.path);
    if (file instanceof TFile) replacements.set(source, app.vault.getResourcePath(file));
  }
  return replaceImageSources(html, replacements);
}
