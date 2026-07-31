import { access, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { PreviewView, VIEW_TYPE_WINDPOST } from "./src/view";
import {
  DEFAULT_SETTINGS,
  WindPostSettings,
  WindPostSettingTab,
} from "./src/settings";
import type { BlogPost } from "./src/blog/prepare";
import {
  publishFilesToGitHub,
  verifyGitHubRepository,
  type GitHubConnectionResult,
  type GitHubPublishResult,
} from "./src/blog/github";
import type {
  XiaohongshuLaunchResult,
  XiaohongshuPost,
  XiaohongshuPublishPayload,
} from "./src/xiaohongshu/types";
import {
  getWindPostWorkspaceStatus,
  initializeWindPostWorkspace,
  type WindPostWorkspaceStatus,
} from "./src/workspace/initialize";
import { exportWechatBrowserPayload } from "./src/wechat/publish";
import { createHerTemplateSample } from "./src/wechat/sample";
import type {
  WechatBrowserPayload,
  WechatDraftResult,
  WechatPost,
} from "./src/wechat/types";

const XIAOHONGSHU_READY = "__WINDPOST_XHS_READY__";
const XIAOHONGSHU_LOGIN = "__WINDPOST_XHS_LOGIN__";
const WECHAT_READY = "__WINDPOST_WECHAT_READY__";
const WECHAT_LOGIN = "__WINDPOST_WECHAT_LOGIN__";
const WECHAT_CONNECTED = "__WINDPOST_WECHAT_CONNECTED__";

export default class WindPostPlugin extends Plugin {
  settings!: WindPostSettings;
  private xiaohongshuProcesses = new Set<ChildProcessWithoutNullStreams>();
  private wechatProcesses = new Set<ChildProcessWithoutNullStreams>();
  private wechatPreviewListeners = new Set<(templateId: string) => void>();
  private pendingWechatPreviewTemplateId = "";

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_WINDPOST, (leaf) => new PreviewView(leaf, this));

    this.addSettingTab(new WindPostSettingTab(this.app, this));

    this.addRibbonIcon("send", "WindPost: 打开发布中心", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-windpost-preview",
      name: "打开 WindPost 发布中心",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "create-her-template-sample",
      name: "创建并预览 Her 模板示例",
      callback: () => void this.openHerTemplateSample(),
    });

    this.addCommand({
      id: "initialize-windpost-workspace",
      name: "初始化 WindPost 工作区",
      callback: () => void this.initializeWorkspace(),
    });
  }

  async onunload() {
    for (const child of this.xiaohongshuProcesses) child.kill();
    this.xiaohongshuProcesses.clear();
    for (const child of this.wechatProcesses) child.kill();
    this.wechatProcesses.clear();
    this.wechatPreviewListeners.clear();
    this.pendingWechatPreviewTemplateId = "";
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null =
      workspace.getLeavesOfType(VIEW_TYPE_WINDPOST)[0] ?? null;

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_WINDPOST, active: true });
      }
    }

    if (leaf) workspace.revealLeaf(leaf);
  }

  onWechatPreviewRequest(listener: (templateId: string) => void): () => void {
    this.wechatPreviewListeners.add(listener);
    if (this.pendingWechatPreviewTemplateId) {
      const templateId = this.pendingWechatPreviewTemplateId;
      this.pendingWechatPreviewTemplateId = "";
      listener(templateId);
    }
    return () => this.wechatPreviewListeners.delete(listener);
  }

  getWorkspaceStatus(): Promise<WindPostWorkspaceStatus> {
    return getWindPostWorkspaceStatus(this.app);
  }

  async initializeWorkspace(): Promise<boolean> {
    try {
      const result = await initializeWindPostWorkspace(this.app);
      await this.app.workspace.getLeaf("tab").openFile(result.baseFile);
      const detail = result.createdFiles > 0
        ? `创建 ${result.createdFiles} 个文件`
        : "现有文件均已保留";
      const assets = result.restoredAssets > 0
        ? `，补齐 ${result.restoredAssets} 张示例配图`
        : "";
      new Notice(`WindPost: 工作区已就绪，${detail}${assets}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`WindPost: 初始化失败：${message}`, 8000);
      return false;
    }
  }

  async openHerTemplateSample(): Promise<void> {
    try {
      const result = await createHerTemplateSample(this.app);
      this.settings.wechatTemplateId = "builtin:her";
      await this.saveSettings();
      await this.app.workspace.getLeaf("tab").openFile(result.file);
      await this.activateView();
      this.requestWechatPreview("builtin:her");

      const action = result.created ? "已创建" : "已存在，已打开";
      const restored = result.restoredAssets > 0
        ? `，补齐 ${result.restoredAssets} 张配图`
        : "";
      new Notice(`WindPost: Her 模板示例${action}${restored}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`WindPost: 创建 Her 模板示例失败：${message}`, 8000);
    }
  }

  async publishBlog(post: BlogPost): Promise<GitHubPublishResult> {
    const token = this.app.secretStorage.getSecret(this.settings.githubTokenSecret);
    if (!token) throw new Error("请先在 WindPost 设置中配置 GitHub Token。");
    return publishFilesToGitHub({
      owner: this.settings.githubOwner,
      repo: this.settings.githubRepo,
      branch: this.settings.githubBranch,
      token,
      files: post.files,
      message: `publish: ${post.title}`,
    });
  }

  async testBlogConnection(): Promise<GitHubConnectionResult> {
    const token = this.app.secretStorage.getSecret(this.settings.githubTokenSecret);
    if (!token) throw new Error("未找到 GitHub Token，请检查 SecretStorage 配置。");
    return verifyGitHubRepository({
      owner: this.settings.githubOwner,
      repo: this.settings.githubRepo,
      token,
    });
  }

  async publishWechatDraft(post: WechatPost): Promise<WechatDraftResult> {
    if (this.wechatProcesses.size > 0) {
      throw new Error("已有公众号草稿任务正在运行，请先关闭上一次打开的专用 Chrome。");
    }

    const pluginDir = this.getPluginDirectory();
    const publisherPath = path.join(pluginDir, "wechat-publisher.cjs");
    await access(publisherPath);
    const exported = await exportWechatBrowserPayload({
      app: this.app,
      post,
      sourcePath: this.app.workspace.getActiveFile()?.path || "untitled.md",
    });
    const payload: WechatBrowserPayload = {
      ...exported,
      userDataDir: path.join(pluginDir, ".windpost-browser", "wechat"),
    };
    const payloadPath = path.join(payload.outputDir, "payload.json");
    await writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf8");

    return new Promise((resolve, reject) => {
      const child = spawn(
        "/bin/zsh",
        ["-lc", 'exec node "$1" "$2"', "windpost-wechat", publisherPath, payloadPath],
        {
          cwd: pluginDir,
          env: process.env,
        },
      );
      this.wechatProcesses.add(child);

      let stdout = "";
      let stderr = "";
      let settled = false;
      let loginNotified = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (!loginNotified && stdout.includes(WECHAT_LOGIN)) {
          loginNotified = true;
          new Notice("WindPost: 请在浏览器中扫码登录微信公众号后台。", 12000);
        }
        const readyLine = stdout.split(/\r?\n/).find((line) => line.startsWith(WECHAT_READY));
        if (!settled && readyLine) {
          const match = readyLine.match(/^__WINDPOST_WECHAT_READY__\s+(\S+)\s+(\d+)/);
          if (!match) {
            fail(new Error("公众号发布进程返回了无效结果。"));
            return;
          }
          settled = true;
          resolve({ mediaId: match[1], uploadedImages: Number(match[2]) });
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.once("error", (error) => fail(error));
      child.once("exit", (code, signal) => {
        this.wechatProcesses.delete(child);
        if (settled) return;
        const detail = tail(stderr || stdout);
        const exitReason = code !== null ? `退出码 ${code}` : `信号 ${signal || "unknown"}`;
        fail(new Error(detail || `公众号发布进程已退出（${exitReason}）。`));
      });
    });
  }

  async connectWechat(): Promise<void> {
    if (this.wechatProcesses.size > 0) {
      throw new Error("已有公众号任务正在运行，请先关闭上一次打开的专用 Chrome。");
    }
    const pluginDir = this.getPluginDirectory();
    const publisherPath = path.join(pluginDir, "wechat-publisher.cjs");
    await access(publisherPath);
    const userDataDir = path.join(pluginDir, ".windpost-browser", "wechat");

    return new Promise((resolve, reject) => {
      const child = spawn(
        "/bin/zsh",
        ["-lc", 'exec node "$1" --login "$2"', "windpost-wechat-login", publisherPath, userDataDir],
        { cwd: pluginDir, env: process.env },
      );
      this.wechatProcesses.add(child);
      let stdout = "";
      let stderr = "";
      let loginNotified = false;

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (!loginNotified && stdout.includes(WECHAT_LOGIN)) {
          loginNotified = true;
          new Notice("WindPost: 请在浏览器中扫码登录微信公众号后台。", 12000);
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        this.wechatProcesses.delete(child);
        if (code === 0 && stdout.includes(WECHAT_CONNECTED)) {
          resolve();
          return;
        }
        const detail = tail(stderr || stdout);
        const exitReason = code !== null ? `退出码 ${code}` : `信号 ${signal || "unknown"}`;
        reject(new Error(detail || `公众号登录检查已退出（${exitReason}）。`));
      });
    });
  }

  async fillXiaohongshuDraft(post: XiaohongshuPost): Promise<XiaohongshuLaunchResult> {
    if (this.xiaohongshuProcesses.size > 0) {
      throw new Error("已有小红书填写任务正在运行，请先关闭上一次打开的专用 Chrome。");
    }

    const pluginDir = this.getPluginDirectory();
    const uploaderPath = path.join(pluginDir, "xhs-uploader.cjs");
    const payloadPath = path.join(post.outputDir, "payload.json");
    await access(uploaderPath);

    const payload: XiaohongshuPublishPayload = {
      ...post,
      autoSubmit: false,
      userDataDir: path.join(pluginDir, ".windpost-browser", "xiaohongshu"),
      publishUrl: this.settings.xiaohongshuPublishUrl,
    };
    await writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf8");

    return new Promise((resolve, reject) => {
      const child = spawn(
        "/bin/zsh",
        ["-lc", 'exec node "$1" "$2"', "windpost-xhs", uploaderPath, payloadPath],
        {
          cwd: pluginDir,
          env: process.env,
        },
      );
      this.xiaohongshuProcesses.add(child);

      let stdout = "";
      let stderr = "";
      let settled = false;
      let loginNotified = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (!loginNotified && stdout.includes(XIAOHONGSHU_LOGIN)) {
          loginNotified = true;
          new Notice("WindPost: 请在浏览器中完成小红书登录。", 10000);
        }
        if (!settled && stdout.includes(XIAOHONGSHU_READY)) {
          settled = true;
          resolve({ outputDir: post.outputDir });
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.once("error", (error) => fail(error));
      child.once("exit", (code, signal) => {
        this.xiaohongshuProcesses.delete(child);
        if (settled) return;
        const detail = tail(stderr || stdout);
        const exitReason = code !== null ? `退出码 ${code}` : `信号 ${signal || "unknown"}`;
        fail(new Error(detail || `小红书填写进程已退出（${exitReason}）。`));
      });
    });
  }

  private getPluginDirectory(): string {
    const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & {
      getBasePath?: () => string;
    };
    const basePath = adapter.getBasePath?.();
    if (!basePath || !this.manifest.dir) {
      throw new Error("小红书自动填写仅支持本地桌面 vault。");
    }
    return path.join(basePath, this.manifest.dir);
  }

  private requestWechatPreview(templateId: string): void {
    if (this.wechatPreviewListeners.size === 0) {
      this.pendingWechatPreviewTemplateId = templateId;
      return;
    }
    for (const listener of this.wechatPreviewListeners) listener(templateId);
  }
}

function tail(value: string, max = 1200): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : normalized.slice(-max);
}
