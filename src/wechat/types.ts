export type WechatAssetSource =
  | { kind: "vault"; path: string }
  | { kind: "url"; url: string }
  | { kind: "data"; dataUrl: string };

export interface WechatPost {
  title: string;
  author: string;
  digest: string;
  contentHtml: string;
  contentSourceUrl: string;
  coverSource: WechatAssetSource | null;
  needOpenComment: 0 | 1;
  onlyFansCanComment: 0 | 1;
}

export interface WechatDraftResult {
  mediaId: string;
  uploadedImages: number;
}

export interface WechatConnectionResult {
  draftCount: number;
}
