import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import * as React from "react";
import { App } from "./app";
import type WindPostPlugin from "../main";

export const VIEW_TYPE_WINDPOST = "windpost-preview";

export class PreviewView extends ItemView {
  private root: Root | null = null;
  private plugin: WindPostPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: WindPostPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_WINDPOST;
  }

  getDisplayText(): string {
    return "WindPost 发布中心";
  }

  getIcon(): string {
    return "send";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("windpost-view");

    this.root = createRoot(container);
    // 只挂载一次。App 内部自己订阅 workspace 事件，不需要外面驱动重渲。
    this.root.render(<App plugin={this.plugin} />);
  }

  async onClose() {
    this.root?.unmount();
    this.root = null;
  }
}
