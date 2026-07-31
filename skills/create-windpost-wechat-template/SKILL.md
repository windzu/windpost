---
name: create-windpost-wechat-template
description: Create and validate custom CSS template packages for WindPost WeChat articles. Use when a user asks an Agent to design, derive, reproduce, or install a custom WindPost 公众号/WeChat typography template from visual requirements, an HTML reference, a screenshot, or an existing style.
---

# Create a WindPost WeChat Template

Create the template as Agent-authored files. Do not add a visual editor or require article Properties.

## Workflow

1. Locate the target Obsidian Vault and use:
   `WindPost/Templates/WeChat/<template-id>/`
2. Read [references/template-spec.md](references/template-spec.md) completely.
3. If a reference HTML or screenshot is provided, inventory typography, color, spacing,
   content blocks, masthead, image treatment, and closing components before implementing.
   Do not copy article text, scripts, or tracking code. Account branding belongs in
   WindPost settings and `layout: editorial`, not hard-coded CSS.
4. Copy [assets/custom-template](assets/custom-template) as the starting package, then rename the directory and update the manifest.
5. Choose `layout: default` or `layout: editorial`, then implement the visual language in
   `style.css` against the stable `#bm-md` and WindPost semantic-block contract.
6. Run:
   `node scripts/validate_template.cjs <absolute-template-directory>`
7. Report the created template path and tell the user to click「刷新」in the WindPost template selector.
8. List all meaningful deviations from the reference. If a component cannot be represented
   faithfully, explain the limitation instead of silently omitting it.

## Quality bar

- Make normal Markdown readable without custom HTML.
- Cover headings, paragraphs, emphasis, links, quotes, lists, images, captions, code, tables, alerts, dividers, and footnotes.
- Keep every selector scoped to `#bm-md`.
- Treat preview and published WeChat HTML as the same output surface.
- Prefer system font stacks; do not depend on remote fonts or assets.
- Use WindPost semantic block directives for layout-specific components. Fall back to the
  closest ordinary Markdown element only after explicitly reporting the loss of fidelity.
