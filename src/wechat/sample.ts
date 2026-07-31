import { normalizePath, TFile, type App } from "obsidian";
import beachImage from "./sample-assets/her-beach.jpg";
import crossroadsImage from "./sample-assets/her-crossroads.jpg";
import newYearImage from "./sample-assets/her-new-year.jpg";
import articleMarkdown from "./sample-assets/her-sample.md";
import violinistImage from "./sample-assets/her-violinist.jpg";

export interface HerTemplateSampleResult {
  file: TFile;
  created: boolean;
  restoredAssets: number;
}

export const HER_SAMPLE_NOTE_PATH =
  "Content/Her 模板示例 - 我花了两年，才走出那段狼狈的日子.md";
export const HER_SAMPLE_ASSET_DIRECTORY = "WindPost/Examples/Her/assets";

const SAMPLE_IMAGES = [
  { path: `${HER_SAMPLE_ASSET_DIRECTORY}/her-crossroads.jpg`, dataUrl: crossroadsImage },
  { path: `${HER_SAMPLE_ASSET_DIRECTORY}/her-violinist.jpg`, dataUrl: violinistImage },
  { path: `${HER_SAMPLE_ASSET_DIRECTORY}/her-new-year.jpg`, dataUrl: newYearImage },
  { path: `${HER_SAMPLE_ASSET_DIRECTORY}/her-beach.jpg`, dataUrl: beachImage },
] as const;

export async function createHerTemplateSample(
  app: App,
): Promise<HerTemplateSampleResult> {
  await ensureFolder(app, "Content");
  await ensureFolder(app, "WindPost");
  await ensureFolder(app, "WindPost/Examples");
  await ensureFolder(app, "WindPost/Examples/Her");
  await ensureFolder(app, HER_SAMPLE_ASSET_DIRECTORY);

  let restoredAssets = 0;
  for (const image of SAMPLE_IMAGES) {
    const path = normalizePath(image.path);
    if (await app.vault.adapter.exists(path)) continue;
    await app.vault.createBinary(path, decodeDataUrl(image.dataUrl));
    restoredAssets += 1;
  }

  const notePath = normalizePath(HER_SAMPLE_NOTE_PATH);
  const existing = app.vault.getAbstractFileByPath(notePath);
  if (existing) {
    if (!(existing instanceof TFile)) {
      throw new Error(`示例路径已被文件夹占用：${notePath}`);
    }
    return { file: existing, created: false, restoredAssets };
  }

  const file = await app.vault.create(
    notePath,
    articleMarkdown,
  );
  return { file, created: true, restoredAssets };
}

function decodeDataUrl(value: string): ArrayBuffer {
  const match = value.match(/^data:[^;,]+;base64,([\s\S]+)$/);
  if (!match) throw new Error("Her 示例图片数据无效。");
  const binary = atob(match[1]);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!(await app.vault.adapter.exists(normalized))) {
    await app.vault.createFolder(normalized);
  }
}
