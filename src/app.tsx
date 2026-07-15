import * as React from "react";
import { useEffect, useState } from "react";
import { Notice, TFile } from "obsidian";
import { render } from "./markdown/render/html";
import { preprocessObsidianWikilinks } from "./markdown/preprocess/wikilinks";
import { Preview } from "./components/Preview";
import { ChannelBar, type Channel } from "./components/ChannelBar";
import { confirmPublish } from "./components/ConfirmPublishModal";
import { XiaohongshuPreview } from "./components/XiaohongshuPreview";
import { prepareBlogPost, type BlogPost } from "./blog/prepare";
import {
  exportXiaohongshuPost,
  prepareXiaohongshuDraft,
} from "./xiaohongshu/export";
import type { XiaohongshuDraft } from "./xiaohongshu/types";
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
  const [xiaohongshuDraft, setXiaohongshuDraft] = useState<XiaohongshuDraft | null>(null);
  const [status, setStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

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
    setXiaohongshuDraft(null);

    if (!doc.content) {
      setHtml("");
      setStatus("idle");
      return;
    }
    if (channel === "xiaohongshu") {
      setHtml("");
      try {
        const draft = prepareXiaohongshuDraft({
          markdown: doc.content,
          path: doc.path,
          maxImages: settings.xiaohongshuMaxImages,
        });
        setXiaohongshuDraft(draft);
        setStatus("ready");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus("error");
      }
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
          const nextHtml = await render({
            markdown: preprocessObsidianWikilinks(doc.content, app, doc.path),
            markdownStyle: settings.defaultMarkdownStyle,
            platform: "wechat",
            enableFootnoteLinks: settings.enableFootnoteLinks,
            openLinksInNewWindow: true,
          });
          if (cancelled) return;
          setHtml(nextHtml);
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
    settings.xiaohongshuMaxImages,
  ]);

  const publishBlog = async () => {
    if (!blogPost || publishing) return;
    const confirmed = await confirmPublish(
      app,
      "发布至 Blog",
      `将「${blogPost.title}」及 ${blogPost.files.length - 1} 个附件提交到 ${settings.githubOwner}/${settings.githubRepo} 的 ${settings.githubBranch} 分支。`,
    );
    if (!confirmed) return;

    setPublishing(true);
    setMessage("正在提交到 GitHub…");
    try {
      const result = await plugin.publishBlog(blogPost);
      setMessage(`已提交 ${result.commitSha.slice(0, 7)}，等待 Vercel 部署。`);
      new Notice("WindPost: Blog 已提交到 GitHub");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`发布失败：${detail}`);
      new Notice(`WindPost Blog 发布失败：${detail}`, 8000);
    } finally {
      setPublishing(false);
    }
  };

  const fillXiaohongshuDraft = async () => {
    if (!xiaohongshuDraft || publishing || !doc.path) return;
    const warningText = xiaohongshuDraft.warnings.length > 0
      ? `当前有 ${xiaohongshuDraft.warnings.length} 项发布前提示。`
      : "";
    const confirmed = await confirmPublish(
      app,
      "生成并填写小红书",
      `将生成 ${xiaohongshuDraft.cards.length} 张图文卡片，打开小红书创作服务平台并自动填写标题、正文和标签。${warningText}最终发布仍由你在浏览器中确认。`,
      "生成并打开",
    );
    if (!confirmed) return;

    setPublishing(true);
    setMessage("正在生成小红书图文卡片…");
    try {
      const post = await exportXiaohongshuPost({
        app,
        draft: xiaohongshuDraft,
        path: doc.path,
      });
      setMessage("正在打开小红书并填写内容…");
      await plugin.fillXiaohongshuDraft(post);
      setMessage("已填入小红书，请在浏览器中检查并发布。");
      new Notice("WindPost: 小红书内容已填写");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`小红书填写失败：${detail}`);
      new Notice(`WindPost 小红书填写失败：${detail}`, 8000);
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

      <ChannelBar value={channel} onChange={setChannel} />

      {channel === "blog" && blogPost && (
        <div className="windpost-channel-meta">
          <strong>{blogPost.title}</strong>
          <span>/posts/{blogPost.slug}/</span>
          <span>{blogPost.date}</span>
        </div>
      )}
      {channel === "xiaohongshu" && xiaohongshuDraft && (
        <div className="windpost-channel-meta">
          <strong>{xiaohongshuDraft.title}</strong>
          <span>{xiaohongshuDraft.cards.length} 张卡片</span>
          <span>{xiaohongshuDraft.tags.length} 个标签</span>
        </div>
      )}

      <main className="windpost-main">
        {channel === "xiaohongshu" ? (
          status === "error" ? (
            <div className="windpost-preview-error">{errorMessage || "小红书预览失败"}</div>
          ) : xiaohongshuDraft ? (
            <XiaohongshuPreview draft={xiaohongshuDraft} />
          ) : (
            <div className="windpost-preview-empty">打开一篇 Markdown 笔记开始预览</div>
          )
        ) : (
          <Preview
            html={html}
            status={status}
            device={channel === "wechat" ? "phone" : "page"}
            emptyHint="打开一篇 Markdown 笔记开始预览"
            errorMessage={errorMessage}
          />
        )}
      </main>

      <footer className="windpost-actions">
        {channel === "blog" && (
          <button type="button" className="mod-cta" disabled={!blogPost || publishing} onClick={publishBlog}>
            {publishing ? "正在发布…" : "发布至 Blog"}
          </button>
        )}
        {channel === "wechat" && (
          <button type="button" disabled title="公众号草稿 API 尚未接入">发布至公众号草稿</button>
        )}
        {channel === "xiaohongshu" && (
          <button
            type="button"
            className="mod-cta"
            disabled={!xiaohongshuDraft?.content || publishing}
            onClick={fillXiaohongshuDraft}
          >
            {publishing ? "正在生成并打开…" : "生成并填写小红书"}
          </button>
        )}
      </footer>
    </div>
  );
}
