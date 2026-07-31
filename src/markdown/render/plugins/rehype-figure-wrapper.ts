import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

function getImgAlt(node: Element): string {
  if (node.tagName === 'img') {
    return String(node.properties?.alt || '').trim()
  }
  for (const child of node.children) {
    if (child.type === 'element' && child.tagName === 'img') {
      return String(child.properties?.alt || '').trim()
    }
  }
  return ''
}

function isImageLink(node: Element): boolean {
  if (node.tagName !== 'a')
    return false
  const children = node.children.filter(c => c.type === 'element' || (c.type === 'text' && c.value.trim()))
  return children.length === 1 && children[0].type === 'element' && children[0].tagName === 'img'
}

function createFigure(className: string, children: Element['children']): Element {
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className: [className] },
    children,
  }
}

function createFigcaption(text: string): Element {
  return {
    type: 'element',
    tagName: 'figcaption',
    properties: {},
    children: [{ type: 'text', value: text }],
  }
}

function onlyElement(node: Element, tagName: string): Element | null {
  const children = node.children.filter(child => (
    child.type !== 'text' || child.value.trim().length > 0
  ))
  if (children.length !== 1) return null
  const child = children[0]
  return child.type === 'element' && child.tagName === tagName ? child : null
}

function normalizeFigures(parent: Root | Element) {
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index]
    if (child.type !== 'element') continue

    if (child.tagName === 'p') {
      const figure = onlyElement(child, 'figure')
      if (figure) {
        let nextIndex = index + 1
        while (nextIndex < parent.children.length) {
          const separator = parent.children[nextIndex]
          if (separator.type !== 'text' || separator.value.trim().length > 0) break
          nextIndex += 1
        }
        const next = parent.children[nextIndex]
        const captionEm = next?.type === 'element' && next.tagName === 'p'
          ? onlyElement(next, 'em')
          : null
        if (captionEm) {
          const caption = figure.children.find((item): item is Element => (
            item.type === 'element' && item.tagName === 'figcaption'
          ))
          if (caption) caption.children = captionEm.children
          else {
            figure.children.push({
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: captionEm.children,
            })
          }
          parent.children.splice(nextIndex, 1)
        }
        parent.children[index] = figure
        normalizeFigures(figure)
        continue
      }
    }

    normalizeFigures(child)
  }
}

const rehypeFigureWrapper: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || typeof index !== 'number')
        return
      const parentEl = parent as Element

      if (isImageLink(node)) {
        if (parentEl.tagName === 'figure')
          return

        const alt = getImgAlt(node)
        const figureChildren: Element['children'] = alt ? [node, createFigcaption(alt)] : [node]
        parent.children.splice(index, 1, createFigure('figure-image', figureChildren))
        return SKIP
      }

      if (node.tagName === 'img') {
        if (parentEl.tagName === 'figure')
          return
        if (parentEl.tagName === 'picture')
          return
        if (parentEl.tagName === 'a')
          return

        const alt = String(node.properties?.alt || '').trim()
        const figureChildren: Element['children'] = alt ? [node, createFigcaption(alt)] : [node]
        parent.children.splice(index, 1, createFigure('figure-image', figureChildren))
        return SKIP
      }

      if (node.tagName === 'table') {
        if (parentEl.tagName === 'figure')
          return
        const classNames = node.properties?.className
        const classList = Array.isArray(classNames) ? classNames : typeof classNames === 'string' ? classNames.split(/\s+/) : []
        if (classList.includes('frontmatter-table'))
          return

        parent.children.splice(index, 1, createFigure('figure-table', [node]))
        return SKIP
      }
    })
    normalizeFigures(tree)
  }
}

export default rehypeFigureWrapper
