import type { Element, ElementContent, Root, RootContent } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

export type WindpostWechatLayoutVariant = 'default' | 'editorial'

export interface WindpostWechatLayoutOptions {
  variant?: WindpostWechatLayoutVariant
  title?: string
  digest?: string
  accountName?: string
  author?: string
  date?: string
}

type WindpostBlockType = 'preface' | 'note' | 'reading' | 'podcast' | 'end'

const DIRECTIVE = /^\[!windpost-(preface|note|reading|podcast|end)\](?:\s+(.+))?$/i

function classList(node: Element): string[] {
  const value = node.properties?.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
  return []
}

function addClass(node: Element, ...names: string[]) {
  node.properties ||= {}
  node.properties.className = [...new Set([...classList(node), ...names])]
}

function textContent(node: Element | Root): string {
  const parts: string[] = []
  const walk = (children: readonly ElementContent[] | readonly RootContent[]) => {
    for (const child of children) {
      if (child.type === 'text') parts.push(child.value)
      else if (child.type === 'element') walk(child.children)
    }
  }
  walk(node.children)
  return parts.join('').trim()
}

function textElement(tagName: string, className: string, value: string): Element {
  return {
    type: 'element',
    tagName,
    properties: { className: [className] },
    children: [{ type: 'text', value }],
  }
}

function directiveHeader(type: WindpostBlockType, title: string): Element[] {
  if (type === 'preface') {
    return [
      textElement('p', 'windpost-block-label', 'PREFACE'),
      textElement('h2', 'windpost-block-title', title || '写在前面'),
    ]
  }
  if (type === 'podcast') {
    return [
      ...(title ? [textElement('p', 'windpost-block-label', title)] : []),
      textElement('p', 'windpost-podcast-icon', '🎧'),
    ]
  }
  if (type === 'end') {
    return title ? [textElement('p', 'windpost-block-label', title)] : []
  }
  return title ? [textElement('p', 'windpost-block-label', title)] : []
}

function decoratePullQuote(node: Element) {
  const paragraph = node.children.find((child): child is Element => (
    child.type === 'element' && child.tagName === 'p'
  ))
  if (!paragraph) return

  const texts: Array<{ value: string }> = []
  const collect = (element: Element) => {
    for (const child of element.children) {
      if (child.type === 'text') texts.push(child)
      else if (child.type === 'element') collect(child)
    }
  }
  collect(paragraph)
  const first = texts.find(item => item.value.length > 0)
  const last = [...texts].reverse().find(item => item.value.length > 0)
  if (!first || !last || !first.value.startsWith('「') || !last.value.endsWith('」')) return

  first.value = first.value.slice(1)
  last.value = last.value.slice(0, -1)
  paragraph.children.unshift(textElement('span', 'windpost-quote-mark', '「'))
  paragraph.children.push(textElement('span', 'windpost-quote-mark', '」'))
}

function transformDirectives(tree: Root) {
  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'blockquote') return
    const first = node.children.find((child): child is Element => (
      child.type === 'element' && child.tagName === 'p'
    ))
    if (!first) {
      addClass(node, 'windpost-pull-quote')
      decoratePullQuote(node)
      return
    }

    const match = textContent(first).match(DIRECTIVE)
    if (!match) {
      addClass(node, 'windpost-pull-quote')
      decoratePullQuote(node)
      return
    }

    const type = match[1].toLowerCase() as WindpostBlockType
    const title = (match[2] || '').trim()
    node.tagName = 'section'
    node.properties = {
      className: ['windpost-block', `windpost-${type}`],
      dataWindpostBlock: type,
    }
    node.children = [
      ...directiveHeader(type, title),
      ...node.children.filter(child => child !== first),
    ]
  })
}

function markChapters(tree: Root) {
  let part = 0
  for (const child of tree.children) {
    if (child.type !== 'element' || child.tagName !== 'h2') continue
    part += 1
    addClass(child, 'windpost-chapter')
    child.properties ||= {}
    child.properties.dataWindpostPart = String(part).padStart(2, '0')
  }
}

function issueLabel(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})/)
  return match ? `VOL. ${match[2]} / ${match[1]}` : ''
}

function createHero(
  tree: Root,
  options: WindpostWechatLayoutOptions,
) {
  if (options.variant !== 'editorial') return

  const elements = tree.children.filter((child): child is Element => child.type === 'element')
  const existingHeading = elements.find(node => node.tagName === 'h1')
  const heading = existingHeading || textElement('h1', 'windpost-hero-title', options.title || '')
  addClass(heading, 'windpost-hero-title')

  const headingIndex = elements.indexOf(heading)
  const possibleSubtitle = headingIndex >= 0 ? elements[headingIndex + 1] : undefined
  const subtitleParagraph = possibleSubtitle?.tagName === 'blockquote'
    ? possibleSubtitle.children.find((child): child is Element => (
        child.type === 'element' && child.tagName === 'p'
      ))
    : undefined
  const subtitleChildren = subtitleParagraph
    ? subtitleParagraph.children
    : options.digest
      ? [{ type: 'text' as const, value: options.digest }]
      : []

  const accountName = options.accountName?.trim() || ''
  const authorSuffix = options.author?.trim() ? ` · 文/${options.author.trim()}` : ''
  const issue = issueLabel(options.date || '')

  const heroChildren: Element[] = [
    textElement(
      'p',
      'windpost-hero-kicker',
      `${accountName ? `${accountName} · ` : ''}NOTES ON BECOMING${authorSuffix}`,
    ),
    {
      type: 'element',
      tagName: 'p',
      properties: { className: ['windpost-hero-brand'] },
      children: accountName
        ? [
            { type: 'text', value: accountName },
            { type: 'element', tagName: 'br', properties: {}, children: [] },
            { type: 'text', value: 'WORLD NOTES' },
          ]
        : [{ type: 'text', value: 'WORLD NOTES' }],
    },
  ]
  if (issue) heroChildren.push(textElement('p', 'windpost-hero-issue', issue))
  heroChildren.push(heading)
  if (subtitleChildren.length > 0) {
    heroChildren.push({
      type: 'element',
      tagName: 'p',
      properties: { className: ['windpost-hero-subtitle'] },
      children: subtitleChildren,
    })
  }

  const hero: Element = {
    type: 'element',
    tagName: 'section',
    properties: {
      className: ['windpost-hero'],
      dataWindpostBlock: 'hero',
    },
    children: heroChildren,
  }

  const remove = new Set<RootContent>([heading])
  if (possibleSubtitle?.tagName === 'blockquote') remove.add(possibleSubtitle)
  const originalIndex = existingHeading ? tree.children.indexOf(existingHeading) : 0
  tree.children = tree.children.filter(child => !remove.has(child))
  tree.children.splice(Math.max(0, originalIndex), 0, hero)
}

const rehypeWindpostStructure: Plugin<[WindpostWechatLayoutOptions?], Root> = (
  options = {},
) => {
  return (tree) => {
    transformDirectives(tree)
    markChapters(tree)
    createHero(tree, options)
  }
}

export default rehypeWindpostStructure
