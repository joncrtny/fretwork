import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

/* Flat ESLint config. The high-value rules for this codebase are the React
   hooks rules (real bugs) and no-undef; stylistic noise is left to Prettier
   (eslint-config-prettier turns off conflicting rules). Rules likely to be
   noisy on the legacy App.jsx are warnings, not errors, so CI stays meaningful
   and green while the refactor proceeds. */
export default [
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "playwright-report/**", ".vercel/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // catch(e) blocks are a deliberate "analytics/audio never breaks the app" pattern
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // a code smell to clean up in the naming/cleanup phase, not a build-breaker
      "no-useless-assignment": "warn",
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["tests/**/*.{js,mjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
];
