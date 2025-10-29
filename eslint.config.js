import eslintReact from "@eslint-react/eslint-plugin";
import eslintJs from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactRefresh from "eslint-plugin-react-refresh";

export default defineConfig([
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      // Exclude generated client files
      "src/client/**/*",
      // Other common ignores
      "dist/**/*",
      "node_modules/**/*",
      ".next/**/*",
      "build/**/*",
    ],

    // Extend recommended rule sets from:
    // 1. ESLint JS's recommended rules
    // 2. TypeScript ESLint recommended rules
    // 3. ESLint React's recommended-typescript rules
    extends: [
      eslintJs.configs.recommended,
      tseslint.configs.recommended,
      eslintReact.configs["recommended-typescript"],
    ],

    // Add plugins
    plugins: {
      "react-refresh": reactRefresh,
    },

    // Configure language/parsing options
    languageOptions: {
      // Use TypeScript ESLint parser for TypeScript files
      parser: tseslint.parser,
      parserOptions: {
        // Enable project service for better TypeScript integration
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    // Custom rule overrides (modify rule levels or disable rules)
    rules: {
      "@eslint-react/no-missing-key": "warn",
      // Disable some React 19 migration warnings that are not urgent
      "@eslint-react/no-forward-ref": "off",
      "@eslint-react/no-use-context": "off",
      "@eslint-react/no-context-provider": "off",
      "@eslint-react/hooks-extra/no-direct-set-state-in-use-effect": "warn",
      "@eslint-react/no-array-index-key": "warn",
      "@eslint-react/naming-convention/use-state": "warn",
      "@eslint-react/no-unnecessary-use-prefix": "warn",
      // Configure react-refresh rules
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
]);
