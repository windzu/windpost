import { normalizePath, type App } from "obsidian";
import { validateTemplateFiles } from "../../wechat-template-validator.cjs";
import anthropicCss from "../themes/markdown-style/anthropic.css";
import resetCss from "../themes/markdown-style/reset.css";
import herCss from "../themes/wechat/her.css";

export const DEFAULT_WECHAT_TEMPLATE_ID = "builtin:anthropic";
export const WECHAT_TEMPLATE_DIRECTORY = "WindPost/Templates/WeChat";

export interface WechatTemplate {
  id: string;
  name: string;
  description: string;
  source: "builtin" | "custom";
  css: string;
}

export interface WechatTemplateDiscovery {
  templates: WechatTemplate[];
  errors: string[];
}

const BUILTIN_TEMPLATES: WechatTemplate[] = [
  {
    id: DEFAULT_WECHAT_TEMPLATE_ID,
    name: "Anthropic",
    description: "暖白、墨色与赭色构成的克制技术写作风格。",
    source: "builtin",
    css: resetCss + anthropicCss,
  },
  {
    id: "builtin:her",
    name: "Her",
    description: "暖白纸张、蓝灰正文与深靛蓝标题构成的编辑感排版。",
    source: "builtin",
    css: resetCss + herCss,
  },
];

export function getBuiltinWechatTemplates(): WechatTemplate[] {
  return BUILTIN_TEMPLATES.map((template) => ({ ...template }));
}

export async function discoverWechatTemplates(app: App): Promise<WechatTemplateDiscovery> {
  const templates = getBuiltinWechatTemplates();
  const errors: string[] = [];
  const adapter = app.vault.adapter;
  const root = normalizePath(WECHAT_TEMPLATE_DIRECTORY);

  if (!(await adapter.exists(root))) return { templates, errors };

  let listing;
  try {
    listing = await adapter.list(root);
  } catch (error) {
    errors.push(`无法读取自定义模板目录：${message(error)}`);
    return { templates, errors };
  }

  const seenIds = new Set(templates.map((template) => template.id));
  for (const folder of [...listing.folders].sort()) {
    const folderName = folder.split("/").pop() || folder;
    const manifestPath = normalizePath(`${folder}/template.json`);
    const cssPath = normalizePath(`${folder}/style.css`);

    try {
      if (!(await adapter.exists(manifestPath)) || !(await adapter.exists(cssPath))) {
        errors.push(`${folderName}：缺少 template.json 或 style.css。`);
        continue;
      }
      const [manifestText, css] = await Promise.all([
        adapter.read(manifestPath),
        adapter.read(cssPath),
      ]);
      const validation = validateTemplateFiles(manifestText, css);
      if (!validation.manifest || validation.errors.length > 0) {
        errors.push(`${folderName}：${validation.errors.join("；")}`);
        continue;
      }
      if (validation.manifest.id !== folderName) {
        errors.push(`${folderName}：目录名必须与模板 id 一致。`);
        continue;
      }
      const id = `custom:${validation.manifest.id}`;
      if (seenIds.has(id)) {
        errors.push(`${folderName}：模板 id 重复。`);
        continue;
      }
      seenIds.add(id);
      templates.push({
        id,
        name: validation.manifest.name.trim(),
        description: validation.manifest.description.trim(),
        source: "custom",
        css: resetCss + css,
      });
    } catch (error) {
      errors.push(`${folderName}：${message(error)}`);
    }
  }

  return { templates, errors };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
