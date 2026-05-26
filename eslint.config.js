import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "references/repos/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off"
    }
  },
  {
    files: [
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
      "tests/**/*.ts",
      "scripts/**/*.ts",
      "scripts/**/*.mjs",
      "*.config.ts"
    ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@main/*", "@db/*", "@ai/*", "@agents/*", "../main/*", "../db/*", "../ai/*"]
        }
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Renderer must not call provider or network APIs directly; use typed IPC."
        }
      ]
    }
  }
];
