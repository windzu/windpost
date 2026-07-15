// Code theme 占位实现：当前 WindPost 不附带高亮主题，
// rehype-highlight 仍然会标注 hljs class，颜色由 Anthropic 主题里的 pre/code 规则提供。
// 之后想接入 catppuccin / tokyo-night 等主题，复刻 wenotion 的 themeModules 即可。
export async function loadCodeThemeCss(_id: string): Promise<string | undefined> {
  return undefined
}
