import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "array-callback-return": "error",
      "no-cond-assign": "warn",
      "no-duplicate-imports": "warn",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-empty-function": "error",
      "no-empty-pattern": "warn",
      "no-extra-boolean-cast": "error",
      "no-fallthrough": "warn",
      "no-mixed-spaces-and-tabs": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
      "require-await": "error",
    },
  }
);
