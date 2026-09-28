import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Flat ESLint config (ESLint 10 + Next.js 16). `npm run lint` runs this.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The app intentionally logs a few server-side diagnostics.
      'no-console': 'off',
      // Unused args are common in route handlers / React props signatures.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` is used widely in this codebase (Supabase rows, product shapes).
      // Not actioned in this pass - Supabase returns untyped JSON, so the
      // product/order objects are genuinely dynamic.
      '@typescript-eslint/no-explicit-any': 'off',
      // Admin previews and Supabase URLs are plain <img> tags on purpose
      // (next/image would need every remote host allow-listed).
      '@next/next/no-img-element': 'off',
      // React Compiler strictness (new in the Next 16 lint set). These fire on
      // standard patterns we rely on - load-on-mount effects (admin data
      // fetching), the shadcn use-mobile/carousel/sidebar primitives and
      // event-handler helpers declared in the component body. Advisory only.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  {
    // scripts/ are plain CommonJS Node.js tools (not part of the Next build).
    files: ['scripts/**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '*.tsbuildinfo',
    'tmp-variants-out/**',
  ]),
]);
