// @ts-check
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config([
  {
    ignores: [
      "**/node_modules/",
      "**/dist",
      "**/*.json",
      "**/*.yaml",
      "**/*.yml"
    ]
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      prettier
    ],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
]);
