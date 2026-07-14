export interface XiaohongshuCard {
  kind: "cover" | "content";
  text: string;
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
