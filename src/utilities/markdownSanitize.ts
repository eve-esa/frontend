import { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";

// One sanitize schema for both answer renderers (SmartText and StreamdownText).
// GitHub's default sanitize schema (GFM tables, lists, code blocks, images,
// ...) with three changes:
// - no inline `style` anywhere: CSS such as `background-image:url(...)` would
//   load a foreign host with no click. KaTeX needs `style`, so rehype-katex
//   runs after this sanitizer in both renderers and its own output is never
//   filtered.
// - no `picture` or `source`: `srcSet` has no protocol check.
// - link protocols locked down to kill `javascript:`/`data:` hrefs (SEC-5).
export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (tag) => tag !== "picture" && tag !== "source",
  ),
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
  },
};
