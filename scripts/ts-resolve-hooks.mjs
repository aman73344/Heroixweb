// Lets a plain `node` run verify-fixes.mjs against the app's real TypeScript
// modules.
//
// WHY THIS FILE EXISTS
// The app is bundled by Next, which resolves a bundler-style specifier like
// "./variants" in lib/sorting.ts. Node's ESM loader does not: it requires a full
// file path, so importing lib/sorting.ts from a script died with
//     ERR_MODULE_NOT_FOUND: Cannot find module 'lib/variants'
//     imported from .../lib/sorting.ts
//
// The alternative fixes were to add "allowImportingTsExtensions" to tsconfig.json
// and rewrite the app's imports to "./variants.ts", or to run every script through
// a separate loader binary. Both change shared configuration to serve one script,
// and the first one puts the app at the mercy of a TypeScript flag. This hook is
// scoped to this script only: the app keeps importing the way it always has, and
// the script still exercises the REAL lib/sorting.ts rather than a copy.
//
// Registered from verify-fixes.mjs via module.register(), so it only applies to
// imports made after that point (lib/sorting.ts is imported dynamically).

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Checked in order, matching how Next resolves an extensionless import.
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isMissingRelative =
      error?.code === 'ERR_MODULE_NOT_FOUND' &&
      (specifier.startsWith('./') || specifier.startsWith('../'));
    if (!isMissingRelative || !context.parentURL) throw error;

    for (const extension of EXTENSIONS) {
      const candidate = new URL(specifier + extension, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + extension, context);
      }
    }

    // Nothing to add: report the original failure, not this one.
    throw error;
  }
}