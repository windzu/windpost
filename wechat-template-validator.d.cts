export interface WechatTemplateManifestData {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  layout?: "default" | "editorial";
}

export interface WechatTemplateValidation {
  manifest: WechatTemplateManifestData | null;
  errors: string[];
}

export const MAX_CSS_BYTES: number;

export function validateTemplateDirectory(directory: string): WechatTemplateValidation;

export function validateTemplateFiles(
  manifestText: string,
  css: string,
): WechatTemplateValidation;
