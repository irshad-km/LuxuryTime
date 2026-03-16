import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([

  {
    ignores: [
      "node_modules/**",
      "public/**",
      "uploads/**",
      "dist/**"
    ]
  },


  js.configs.recommended,

  {
    files: ["**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-undef": "error",

      "semi": ["error", "always"],
      "quotes": ["error", "double"],
      "indent": ["error", 4],
      "eqeqeq": "error",
      "curly": "error",

      "no-var": "error",
      "prefer-const": "error",
    },
  },
]);
