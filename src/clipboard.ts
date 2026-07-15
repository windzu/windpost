/**
 * 复制 HTML 到剪贴板（同时写入 text/html 和 text/plain）。
 * Obsidian 跑在 Electron 里，原生 navigator.clipboard 完全够用，不需要 polyfill。
 */
export async function copyHtml(html: string): Promise<boolean> {
  try {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([html], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.error("[WindPost] copyHtml failed", err);
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("[WindPost] copyText failed", err);
    return false;
  }
}
