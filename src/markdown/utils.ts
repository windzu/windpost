// esbuild 的 text loader 让我们能把 katex.css 当字符串引入，
// 用于在 render 阶段 inline 进 HTML。
import katexCss from 'katex/dist/katex.css'

let katexCssCache: string | null = null

export async function loadKatexCss(): Promise<string> {
  if (katexCssCache) {
    return katexCssCache
  }
  katexCssCache = katexCss
  return katexCss
}
