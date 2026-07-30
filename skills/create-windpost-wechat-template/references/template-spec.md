# WindPost WeChat Template Specification

## Package location

Create one directory per template:

`<Vault>/WindPost/Templates/WeChat/<template-id>/`

The directory name must equal the manifest `id`.

## Required files

`template.json`:

```json
{
  "schemaVersion": 1,
  "id": "custom-template",
  "name": "Custom Template",
  "description": "A concise description shown in WindPost."
}
```

Rules:

- `schemaVersion` must be `1`.
- `id` uses lowercase letters, digits, and hyphens; maximum 64 characters.
- `name` contains 1–50 characters.
- `description` contains 1–160 characters.

`style.css`:

- Maximum size: 128 KB.
- Scope every selector to `#bm-md`.
- Do not use `@import`, JavaScript expressions, or external `url(...)` resources.
- Do not depend on custom HTML, scripts, remote fonts, or platform tracking code.

## Stable HTML contract

WindPost guarantees a root `<section id="bm-md">` and semantic elements generated from Markdown:

- headings: `h1`–`h6`
- text: `p`, `strong`, `em`, `del`, `mark`, `a`
- blocks: `blockquote`, `ul`, `ol`, `li`, `hr`
- media: `img`, `figure`, `figcaption`
- code: `pre`, `code`
- tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- extensions: `.markdown-alert`, `.markdown-alert-title`, KaTeX classes, and `section[data-footnotes]`

CSS is inlined before the article is sent to WeChat. Design against this semantic contract, not the WindPost application UI.

## Compatibility rules

- Prefer padding, margin, border, color, background color, font, line height, letter spacing, and text alignment.
- Use pseudo-elements sparingly; they are inlined when possible but must not carry essential content.
- Use system font stacks because WeChat clients may not load custom fonts.
- Keep body text at least 15 px and line height at least 1.7 for Chinese long-form reading.
- Avoid fixed viewport dimensions, sticky positioning, forms, animation, and interactive states.
- Template CSS controls article-body appearance only. Title, author, cover, digest, and reusable QR/footer content are separate publishing concerns.

## Validation

From an installed skill:

`node scripts/validate_template.cjs <absolute-template-directory>`

From the WindPost repository:

`node wechat-template-validator.cjs <absolute-template-directory>`

WindPost excludes invalid custom templates and falls back to the built-in Anthropic template when the configured template is unavailable.
