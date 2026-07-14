import type { Element, Root, Text } from 'hast'
import type { Plugin } from 'unified'
import type { PlatformAdapter } from './types'

import { SKIP, visit } from 'unist-util-visit'

// LaTeX 公式图片渲染服务 URL
const LATEX_IMAGE_BASE = 'https://latex.codecogs.com/svg.image?'

interface FootnoteLink {
  id: number
  href: string
  text: string
}

function isWechatArticleUrl(href: string): boolean {
  try {
    const url = new URL(href, 'https://example.com')
    return url.hostname === 'mp.weixin.qq.com'
  }
  catch {
    return false
  }
}

function shouldSkipFootnote(href: string): boolean {
  return href.startsWith('#')
    || href.startsWith('/')
    || href.startsWith('./')
    || href.startsWith('../')
}

function isElement(node: unknown): node is Element {
  return !!node && typeof node === 'object' && (node as Element).type === 'element'
}

function hasChildren(node: unknown): node is Root | Element {
  return !!node && typeof node === 'object' && Array.isArray((node as Root).children)
}

function extractLinkText(node: Element): string {
  const texts: string[] = []
  const walk = (n: Element | Text) => {
    if (n.type === 'text') {
      texts.push(n.value)
    }
    else if (n.type === 'element' && n.children) {
      for (const child of n.children) {
        if (child.type === 'text' || child.type === 'element') {
          walk(child)
        }
      }
    }
  }
  walk(node)
  return texts.join('').trim() || (typeof node.properties?.href === 'string' ? node.properties.href : '')
}

/**
 * 保护代码块空白字符，防止微信编辑器清洗
 */
function protectCodeWhitespace(code: Element) {
  let atLineStart = true

  const processTextNode = (text: Text): (Text | Element)[] => {
    const result: (Text | Element)[] = []
    let buffer = ''
    const value = text.value

    for (let i = 0; i < value.length; i++) {
      const char = value[i]

      if (char === '\r') {
        continue
      }

      if (char === '\n') {
        if (buffer) {
          result.push({ type: 'text', value: buffer })
          buffer = ''
        }
        result.push({ type: 'element', tagName: 'br', properties: {}, children: [] })
        atLineStart = true
        continue
      }

      if (char === '\t') {
        buffer += '  '
        continue
      }

      if (atLineStart && char === ' ') {
        let j = i
        while (j < value.length && value[j] === ' ') j++
        buffer += ' '.repeat(j - i)
        i = j - 1
        continue
      }

      atLineStart = false
      buffer += char
    }

    if (buffer) {
      result.push({ type: 'text', value: buffer })
    }
    return result
  }

  const processChildren = (parent: Element) => {
    const newChildren: typeof parent.children = []
    for (const child of parent.children) {
      if (child.type === 'text') {
        newChildren.push(...processTextNode(child))
      }
      else if (child.type === 'element') {
        processChildren(child)
        newChildren.push(child)
      }
      else {
        newChildren.push(child)
      }
    }
    parent.children = newChildren
  }

  processChildren(code)

  const preserveSpanBoundarySpaces = (parent: Element) => {
    for (let i = 1; i < parent.children.length - 1; i++) {
      const prev = parent.children[i - 1]
      const curr = parent.children[i]
      const next = parent.children[i + 1]

      if (
        prev.type === 'element'
        && prev.tagName === 'span'
        && curr.type === 'text'
        && next.type === 'element'
        && next.tagName === 'span'
        && /^ +$/.test(curr.value)
      ) {
        curr.value = ' '.repeat(curr.value.length)
      }
    }
    for (const child of parent.children) {
      if (child.type === 'element') {
        preserveSpanBoundarySpaces(child)
      }
    }
  }

  preserveSpanBoundarySpaces(code)
}

const blockTags = new Set([
  'div', 'p', 'blockquote', 'pre', 'ul', 'ol', 'table',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'figure',
])

const rehypeWechatListNormalize: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node: Element, index, parent) => {
    if (
      node.tagName === 'input'
      && node.properties?.type === 'checkbox'
      && typeof index === 'number'
      && hasChildren(parent)
    ) {
      const checked = node.properties.checked === true
        || node.properties.checked === ''
        || node.properties.checked === 'checked'
      parent.children.splice(index, 1, { type: 'text', value: `${checked ? '☑' : '☐'} ` })
    }
  })

  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'li') {
      return
    }
    const first = node.children[0]
    if (first?.type !== 'element' || first.tagName !== 'p') {
      return
    }
    const hasBlock = first.children.some(c => c.type === 'element' && blockTags.has(c.tagName))
    if (!hasBlock) {
      node.children.splice(0, 1, ...first.children)
    }
  })
}

const rehypeWechatCodeWhitespace: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node: Element, _index, parent) => {
    if (node.tagName === 'code' && isElement(parent) && parent.tagName === 'pre') {
      protectCodeWhitespace(node)
    }
  })
}

interface WechatFootnoteLinkOptions {
  referenceTitle?: string
}

const rehypeWechatFootnoteLinks: Plugin<[WechatFootnoteLinkOptions?], Root> = (options = {}) => {
  const { referenceTitle = 'References' } = options

  return (tree) => {
    const links: FootnoteLink[] = []
    const hrefToId = new Map<string, number>()
    let counter = 1

    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'a' || typeof index !== 'number' || !hasChildren(parent)) {
        return
      }

      const rawHref = node.properties?.href
      if (typeof rawHref !== 'string') {
        return
      }

      const href = rawHref.trim()

      if (
        node.properties?.dataFootnoteBackref !== undefined
        || href.startsWith('#user-content-fnref-')
      ) {
        parent.children.splice(index, 1)
        return index
      }

      if (!href) {
        node.tagName = 'span'
        delete node.properties?.href
        delete node.properties?.target
        delete node.properties?.rel
        return
      }

      if (isWechatArticleUrl(href)) {
        return
      }

      node.tagName = 'span'
      delete node.properties?.href
      delete node.properties?.target
      delete node.properties?.rel

      if (shouldSkipFootnote(href)) {
        return
      }

      let id = hrefToId.get(href)
      if (!id) {
        id = counter++
        hrefToId.set(href, id)
        links.push({ id, href, text: extractLinkText(node) })
      }

      parent.children.splice(index + 1, 0, {
        type: 'element',
        tagName: 'sup',
        properties: { className: ['footnote-ref'] },
        children: [{ type: 'text', value: `[${id}]` }],
      })
    })

    if (links.length === 0) {
      return
    }

    tree.children.push({
      type: 'element',
      tagName: 'section',
      properties: { className: ['footnotes'], dataFootnotes: '' },
      children: [
        {
          type: 'element',
          tagName: 'h4',
          properties: {},
          children: [{ type: 'text', value: referenceTitle }],
        },
        {
          type: 'element',
          tagName: 'ol',
          properties: {},
          children: links.map(link => ({
            type: 'element',
            tagName: 'li',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: {},
                children: [{ type: 'text', value: `${link.text || link.href}: ` }],
              },
              {
                type: 'element',
                tagName: 'span',
                properties: { style: 'word-break: break-all;' },
                children: [{ type: 'text', value: link.href }],
              },
            ],
          } as Element)),
        },
      ],
    })
  }
}

/**
 * 从 KaTeX 元素中提取 LaTeX 源码
 */
function extractLatexFromKatex(node: Element): string | null {
  // 从 annotation 元素中提取
  const findAnnotation = (el: Element): string | null => {
    for (const child of el.children) {
      if (child.type === 'element') {
        if (
          child.tagName === 'annotation'
          && child.properties?.encoding === 'application/x-tex'
        ) {
          const textChild = child.children.find(c => c.type === 'text')
          return textChild?.type === 'text' ? textChild.value : null
        }
        const found = findAnnotation(child)
        if (found) return found
      }
    }
    return null
  }
  return findAnnotation(node)
}

/**
 * 创建公式图片元素
 */
function createFormulaImage(latex: string, isDisplay: boolean): Element {
  // 对 LaTeX 进行 URL 编码
  const encodedLatex = encodeURIComponent(latex)
  const src = `${LATEX_IMAGE_BASE}${encodedLatex}`

  return {
    type: 'element',
    tagName: 'img',
    properties: {
      src,
      alt: latex,
      style: isDisplay
        ? 'display: block; margin: 1em auto; max-width: 100%;'
        : 'display: inline; vertical-align: middle; max-height: 1.2em;',
    },
    children: [],
  }
}

/**
 * 将 KaTeX 公式转换为图片（微信编辑器不支持 KaTeX 复杂 HTML 结构）
 */
const rehypeWechatKatexToImage: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node: Element, index, parent) => {
    if (typeof index !== 'number' || !hasChildren(parent)) return

    const className = node.properties?.className
    const classList = Array.isArray(className)
      ? className
      : typeof className === 'string'
        ? className.split(' ')
        : []

    const isKatexDisplay = classList.includes('katex-display')
    const isKatex = classList.includes('katex')

    if (!isKatexDisplay && !isKatex) return

    if (isKatex && !isKatexDisplay) {
      const parentClass = (parent as Element).properties?.className
      const parentClassList = Array.isArray(parentClass)
        ? parentClass
        : typeof parentClass === 'string'
          ? parentClass.split(' ')
          : []
      if (parentClassList.includes('katex-display')) return
    }

    const latex = extractLatexFromKatex(node)
    if (!latex) return

    const imgElement = createFormulaImage(latex, isKatexDisplay)

    if (isKatexDisplay) {
      parent.children.splice(index, 1, {
        type: 'element',
        tagName: 'p',
        properties: { style: 'text-align: center;' },
        children: [imgElement],
      })
    } else {
      parent.children.splice(index, 1, imgElement)
    }

    return SKIP
  })
}

export const wechatAdapter: PlatformAdapter = {
  id: 'wechat',
  name: '微信公众号',
  getPlugins: options => [
    rehypeWechatListNormalize,
    rehypeWechatCodeWhitespace,
    rehypeWechatKatexToImage,
    [rehypeWechatFootnoteLinks, { referenceTitle: options?.referenceTitle }],
  ],
}
