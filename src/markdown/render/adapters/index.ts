import type { Pluggable } from 'unified'
import type { AdapterOptions, Platform, PlatformAdapter } from './types'
import rehypeWindpostStructure from '../plugins/rehype-windpost-structure'
import { wechatAdapter } from './wechat'

const htmlAdapter: PlatformAdapter = {
  id: 'html',
  name: 'HTML',
  getPlugins: () => [
    [rehypeWindpostStructure, { variant: 'default' }],
  ],
}

const adapters: Record<Platform, PlatformAdapter> = {
  html: htmlAdapter,
  wechat: wechatAdapter,
}

export function getAdapterPlugins(platform: Platform, options?: AdapterOptions): Pluggable[] {
  return adapters[platform].getPlugins(options)
}

export { type AdapterOptions, type Platform, type PlatformAdapter, platforms } from './types'
