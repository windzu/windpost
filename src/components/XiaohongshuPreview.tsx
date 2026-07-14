import * as React from "react";
import type { XiaohongshuDraft } from "../xiaohongshu/types";

export function XiaohongshuPreview({ draft }: { draft: XiaohongshuDraft }) {
  return (
    <div className="windpost-xhs-preview">
      {draft.warnings.length > 0 && (
        <div className="windpost-xhs-warnings">
          <strong>发布前检查</strong>
          <ul>
            {draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      <section className="windpost-xhs-section">
        <div className="windpost-xhs-section-header">
          <strong>图文卡片</strong>
          <span>{draft.cards.length} 张 · 3:4</span>
        </div>
        <div className="windpost-xhs-cards">
          {draft.cards.map((card, index) => (
            <article
              className={`windpost-xhs-card is-${card.kind}`}
              key={`${card.kind}-${index}`}
            >
              <div className="windpost-xhs-card-accent" />
              <div className="windpost-xhs-card-text">{card.text}</div>
              <span className="windpost-xhs-card-page">{index + 1}/{draft.cards.length}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="windpost-xhs-copy">
        <div className="windpost-xhs-copy-block">
          <div className="windpost-xhs-section-header">
            <strong>标题</strong>
            <span>{countText(draft.title)} 字符</span>
          </div>
          <p className="windpost-xhs-title">{draft.title}</p>
        </div>

        <div className="windpost-xhs-copy-block">
          <div className="windpost-xhs-section-header">
            <strong>正文</strong>
            <span>{countText(draft.content)} 字符</span>
          </div>
          <div className="windpost-xhs-content">{draft.content || "（空）"}</div>
        </div>

        <div className="windpost-xhs-copy-block">
          <div className="windpost-xhs-section-header">
            <strong>标签</strong>
            <span>{draft.tags.length} 个</span>
          </div>
          <div className="windpost-xhs-tags">
            {draft.tags.length > 0
              ? draft.tags.map((tag) => <span key={tag}>#{tag}</span>)
              : <span className="is-empty">未填写标签</span>}
          </div>
        </div>
      </section>
    </div>
  );
}

function countText(value: string): number {
  return Array.from(value).length;
}
