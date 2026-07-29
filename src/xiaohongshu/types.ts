export interface XiaohongshuCardBlock {
  kind: "paragraph" | "emphasis";
  text: string;
  lines?: string[];
}

export interface XiaohongshuCard {
  kind: "cover" | "content";
  text: string;
  blocks?: XiaohongshuCardBlock[];
  lines?: string[];
  fontSize?: number;
}

export interface XiaohongshuDraft {
  title: string;
  coverText: string;
  content: string;
  tags: string[];
  cards: XiaohongshuCard[];
  warnings: string[];
}

export interface XiaohongshuPost extends XiaohongshuDraft {
  imagePaths: string[];
  outputDir: string;
}

export interface XiaohongshuExportOptions {
  maxImages: number;
}

export interface XiaohongshuPublishPayload extends XiaohongshuPost {
  autoSubmit: boolean;
  userDataDir: string;
  publishUrl: string;
}

export interface XiaohongshuLaunchResult {
  outputDir: string;
}
