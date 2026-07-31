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
  "description": "A concise description shown in WindPost.",
  "layout": "default"
}
```

Rules:

- `schemaVersion` must be `1`.
- `id` uses lowercase letters, digits, and hyphens; maximum 64 characters.
- `name` contains 1–50 characters.
- `description` contains 1–160 characters.
- `layout` is optional: use `default` for body-only typography or `editorial` for the
  account masthead, title, digest, author, and date composition.

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
- WindPost semantics: `.windpost-hero`, `.windpost-preface`, `.windpost-note`,
  `.windpost-reading`, `.windpost-podcast`, `.windpost-end`,
  `.windpost-chapter`, and `.windpost-pull-quote`

CSS is inlined before the article is sent to WeChat. Design against this semantic contract, not the WindPost application UI.

## Optional semantic blocks

Agents can preserve layout-specific meaning with Obsidian-compatible blockquote directives.
They do not add article Properties and degrade to readable blockquotes when unsupported:

```markdown
> [!windpost-preface] 写在前面
>
> 前言正文。

> [!windpost-note]
>
> 说明内容。

> [!windpost-reading]
>
> - 阅读要点一
> - 阅读要点二

> [!windpost-podcast] PODCAST · EP01
>
> ### 《节目标题》
>
> 节目说明。

> [!windpost-end] READ · THINK · CREATE
>
> 品牌名称
>
> 结尾文案。
```

Normal blockquotes receive `.windpost-pull-quote`. Top-level `h2` headings receive
`.windpost-chapter` and a `data-windpost-part` sequence. With `layout: editorial`, the
leading article title and digest are composed into `.windpost-hero`; the account name and
default author come from WindPost settings rather than article Properties.

For an intentionally cropped image, use an optional Markdown title:

```markdown
![图片说明](image.jpg "windpost:crop=3/2;position=50% 38%")
```

Do not add these markers mechanically. Use them only when the reference or requested
design distinguishes those blocks.

## Compatibility rules

- Prefer padding, margin, border, color, background color, font, line height, letter spacing, and text alignment.
- Use pseudo-elements sparingly; they are inlined when possible but must not carry essential content.
- Use system font stacks because WeChat clients may not load custom fonts.
- Keep body text at least 15 px and line height at least 1.7 for Chinese long-form reading.
- Avoid fixed viewport dimensions, sticky positioning, forms, animation, and interactive states.
- `default` templates control article-body appearance only. `editorial` templates can
  compose title, digest, account name, default author, and date into a masthead.
- Cover selection and reusable QR assets remain separate publishing concerns.
- When deriving a template from a reference, report every meaningful component that was
  omitted, approximated, or made optional. Never silently reduce structural components to
  generic typography.

## Validation

From an installed skill:

`node scripts/validate_template.cjs <absolute-template-directory>`

From the WindPost repository:

`node wechat-template-validator.cjs <absolute-template-directory>`

WindPost excludes invalid custom templates and falls back to the built-in Anthropic template when the configured template is unavailable.
