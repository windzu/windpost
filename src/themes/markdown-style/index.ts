export interface MarkdownStyle {
  id: string
  name: string
}

// 当前只接入 Anthropic 主题。其他 wenotion 主题如需启用，按 loader.ts 的格式追加。
export const markdownStyles: MarkdownStyle[] = [
  { id: 'anthropic', name: 'Anthropic' },
]

export const markdownStyleIds = markdownStyles.map(s => s.id) as [string, ...string[]]

export type MarkdownStyleId = (typeof markdownStyles)[number]['id']

export { loadMarkdownStyleCss } from './loader'
