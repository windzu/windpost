import type { WechatPost } from "./types";

export function buildWechatArticle(
  post: WechatPost,
  content: string,
  thumbMediaId: string,
): Record<string, unknown> {
  const article: Record<string, unknown> = {
    article_type: "news",
    title: post.title,
    content,
    thumb_media_id: thumbMediaId,
    need_open_comment: post.needOpenComment,
    only_fans_can_comment: post.onlyFansCanComment,
  };
  if (post.author) article.author = post.author;
  if (post.digest) article.digest = post.digest;
  if (post.contentSourceUrl) article.content_source_url = post.contentSourceUrl;
  return article;
}
