import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules/**",
    "main.js",
    "skills/**",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.mjs",
            "esbuild.config.mjs",
            "manifest.json",
            "wechat-template-validator.cjs",
            "tests/wechat-template-validator.test.cjs",
            "scripts/check-release.cjs",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    rules: {
      // WindPost 的界面以中文为主，产品名和 API 字段需要保留既定大小写。
      "obsidianmd/ui/sentence-case": "off",
      // WindPost 兼容 Obsidian 1.12，1.13 的 declarative settings API 不能作为最低要求。
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
  {
    files: ["tests/**/*.{ts,cjs}"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["scripts/**"],
    rules: {
      "obsidianmd/rule-custom-message": "off",
    },
  },
);
