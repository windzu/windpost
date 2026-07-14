import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * 将 div 标签转换为 section 标签
 */
const rehypeDivToSection: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'div') {
        node.tagName = 'section'
      }
    })
  }
}

export default rehypeDivToSection
