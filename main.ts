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

const XIAOHONGSHU_READY = "__WINDPOST_XHS_READY__";
const XIAOHONGSHU_LOGIN = "__WINDPOST_XHS_LOGIN__";

export default class WindPostPlugin extends Plugin {
  settings!: WindPostSettings;
  private xiaohongshuProcesses = new Set<ChildProcessWithoutNullStreams>();

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
  }

  async onunload() {
    for (const child of this.xiaohongshuProcesses) child.kill();
    this.xiaohongshuProcesses.clear();
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
}

function tail(value: string, max = 1200): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : normalized.slice(-max);
}
