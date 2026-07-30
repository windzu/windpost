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
3. If a reference HTML or screenshot is provided, extract reusable typography, color, spacing, and content-block rules. Do not copy article text, branding, scripts, or tracking code.
4. Copy [assets/custom-template](assets/custom-template) as the starting package, then rename the directory and update the manifest.
5. Implement the visual language in `style.css` against the stable `#bm-md` contract.
6. Run:
   `node scripts/validate_template.cjs <absolute-template-directory>`
7. Report the created template path and tell the user to click「刷新」in the WindPost template selector.

## Quality bar

- Make normal Markdown readable without custom HTML.
- Cover headings, paragraphs, emphasis, links, quotes, lists, images, captions, code, tables, alerts, dividers, and footnotes.
- Keep every selector scoped to `#bm-md`.
- Treat preview and published WeChat HTML as the same output surface.
- Prefer system font stacks; do not depend on remote fonts or assets.
- If the reference contains layout-specific components that Markdown cannot express, abstract their visual language into the closest semantic elements instead of inventing unsupported markup.
