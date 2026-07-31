import { normalizePath, TFile, type App } from "obsidian";
import { createHerTemplateSample } from "../wechat/sample";
import baseTemplate from "./assets/WindPost.base";
import longformSample from "./assets/longform-sample.md";
import shortformSample from "./assets/shortform-sample.md";

export const WINDPOST_BASE_PATH = "WindPost.base";
export const WINDPOST_CONTENT_DIRECTORY = "Content";
export const WINDPOST_SAMPLE_PATHS = [
  "Content/WindPost 示例 - 长内容.md",
  "Content/Her 模板示例 - 我花了两年，才走出那段狼狈的日子.md",
  "Content/WindPost 示例 - 小红书.md",
] as const;

export interface WindPostWorkspaceStatus {
  initialized: boolean;
  baseExists: boolean;
  sampleCount: number;
}

export interface WindPostWorkspaceResult {
  baseFile: TFile;
  createdFiles: number;
  existingFiles: number;
  restoredAssets: number;
}

export async function getWindPostWorkspaceStatus(
  app: App,
): Promise<WindPostWorkspaceStatus> {
  const [baseExists, sampleStates] = await Promise.all([
    app.vault.adapter.exists(normalizePath(WINDPOST_BASE_PATH)),
    Promise.all(WINDPOST_SAMPLE_PATHS.map((path) => (
      app.vault.adapter.exists(normalizePath(path))
    ))),
  ]);
  return {
    initialized: baseExists,
    baseExists,
    sampleCount: sampleStates.filter(Boolean).length,
  };
}

export async function initializeWindPostWorkspace(
  app: App,
): Promise<WindPostWorkspaceResult> {
  await ensureFolder(app, WINDPOST_CONTENT_DIRECTORY);

  let createdFiles = 0;
  let existingFiles = 0;
  const base = await ensureTextFile(app, WINDPOST_BASE_PATH, baseTemplate);
  if (base.created) createdFiles += 1;
  else existingFiles += 1;

  const longform = await ensureTextFile(
    app,
    WINDPOST_SAMPLE_PATHS[0],
    longformSample,
  );
  if (longform.created) createdFiles += 1;
  else existingFiles += 1;

  const shortform = await ensureTextFile(
    app,
    WINDPOST_SAMPLE_PATHS[2],
    shortformSample,
  );
  if (shortform.created) createdFiles += 1;
  else existingFiles += 1;

  const her = await createHerTemplateSample(app);
  if (her.created) createdFiles += 1;
  else existingFiles += 1;

  return {
    baseFile: base.file,
    createdFiles,
    existingFiles,
    restoredAssets: her.restoredAssets,
  };
}

async function ensureTextFile(
  app: App,
  path: string,
  content: string,
): Promise<{ file: TFile; created: boolean }> {
  const normalized = normalizePath(path);
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (existing) {
    if (!(existing instanceof TFile)) {
      throw new Error(`初始化路径已被文件夹占用：${normalized}`);
    }
    return { file: existing, created: false };
  }
  return { file: await app.vault.create(normalized, content), created: true };
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!(await app.vault.adapter.exists(normalized))) {
    await app.vault.createFolder(normalized);
  }
}
