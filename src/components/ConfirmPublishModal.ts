import { App, Modal, Setting } from "obsidian";

export function confirmPublish(
  app: App,
  title: string,
  description: string,
  confirmText = "确认发布",
): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmPublishModal(app, title, description, confirmText, resolve);
    modal.open();
  });
}

class ConfirmPublishModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private titleText: string,
    private description: string,
    private confirmText: string,
    private resolve: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.titleText);
    this.contentEl.createEl("p", { text: this.description });
    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText("取消")
        .onClick(() => this.finish(false)))
      .addButton((button) => button
        .setButtonText(this.confirmText)
        .setCta()
        .onClick(() => this.finish(true)));
  }

  onClose(): void {
    if (!this.settled) {
      this.settled = true;
      this.resolve(false);
    }
    this.contentEl.empty();
  }

  private finish(value: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}
