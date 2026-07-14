// esbuild 在 esbuild.config.mjs 里把 .css 配置为 text loader，
// 所以 `import 'xxx.css'` 拿到的就是 CSS 文本字符串。
import anthropicCss from './anthropic.css'
import resetCss from './reset.css'

const cache = new Map<string, string>()

const themeCss: Record<string, string> = {
  anthropic: anthropicCss,
}

export async function loadMarkdownStyleCss(id: string): Promise<string | undefined> {
  if (cache.has(id)) {
    return cache.get(id)
  }

  const themeBody = themeCss[id]
  if (!themeBody) {
    return undefined
  }

  const css = resetCss + themeBody
  cache.set(id, css)
  return css
}
