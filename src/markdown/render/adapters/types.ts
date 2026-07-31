import type { Pluggable } from 'unified'
import type { WindpostWechatLayoutOptions } from '../plugins'

export const platforms = ['html', 'wechat'] as const

export type Platform = typeof platforms[number]

export interface AdapterOptions {
  referenceTitle?: string
  wechatLayout?: WindpostWechatLayoutOptions
}

export interface PlatformAdapter {
  id: Platform
  name: string
  getPlugins: (options?: AdapterOptions) => Pluggable[]
}
