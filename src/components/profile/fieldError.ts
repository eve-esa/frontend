/**
 * Field error text in the profile dialogs. Dark keeps the colour it always
 * had (Tailwind red-500, unchanged until the dark audit); light uses the
 * danger token, Excite Red +1 #CF1D39 (5.4:1 on white, docs/BRAND.md Danger
 * row), instead of red-500, which reads 3.8:1 on white.
 */
export const FIELD_ERROR_CLASS =
  "text-sm text-red-500 in-data-[theme=light]:text-danger-400";
