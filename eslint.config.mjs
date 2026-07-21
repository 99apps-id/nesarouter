import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-incomplete-*/**",
      ".tmp/**",
      "artifacts/**",
      "data/**",
      "next-env.d.ts",
      "node_modules/**",
      "test-results/**"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    // Legacy provider adapters accept several upstream wire formats. Keep these
    // rules as migration targets while enforcing the rest of Core Web Vitals.
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-anonymous-default-export": "off",
      "jsx-a11y/alt-text": "off",
      "prefer-const": "off"
    }
  }
];

export default eslintConfig;
