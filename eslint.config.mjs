import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

/**
 * Architectural boundaries (see docs/architecture.md):
 *   app  ->  modules  ->  shared layers (components, hooks, lib, config, server)
 * Shared layers must never depend on features, and client-safe layers must never
 * depend on server code.
 */
const noFeatureImports = {
  group: ["@/app/*", "@/modules/*"],
  message: "Shared layers must not depend on routes or feature modules.",
};
const noServerImports = {
  group: ["@/server/*", "server-only"],
  message: "Client-safe layers must not import server code.",
};
const noRouteImports = {
  group: ["@/app/*"],
  message: "Feature modules must not depend on routes.",
};
// Relative parent imports would bypass every alias-based rule above.
const noParentImports = {
  regex: "^\\.\\./",
  message: 'Use the "@/..." alias instead of relative parent imports.',
};

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "drizzle/**",
    "next-env.d.ts",
  ]),

  js.configs.recommended,
  ...nextVitals,
  ...nextTypescript,

  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",

      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "object-shorthand": "error",
    },
  },

  // --- Architectural boundaries -------------------------------------------
  // Each block lists every pattern that applies: a later block replaces the rule options.
  {
    files: ["src/**", "scripts/**", "tests/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noParentImports] }],
    },
  },
  {
    files: ["src/lib/**", "src/hooks/**", "src/components/**", "src/config/**"],
    ignores: ["src/config/env.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [noParentImports, noFeatureImports, noServerImports] },
      ],
    },
  },
  {
    files: ["src/server/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noParentImports, noFeatureImports] }],
    },
  },
  {
    files: ["src/modules/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noParentImports, noRouteImports] }],
    },
  },

  {
    // The logger is the one place allowed to write to the console in app code.
    files: ["scripts/**", "*.config.*", "src/server/logger.ts"],
    rules: { "no-console": "off" },
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
]);
