<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Antigravity Quirks
- **File Writing:** When using the `write_to_file` tool to create or modify workspace source code, NEVER include `ArtifactMetadata`. Including it restricts the file write to the internal artifact directory and causes a permission error for workspace paths.

## Next.js 16.3.4 & Tailwind v4 Quirks
- **Middleware Deprecation:** Next.js 16.3.4 deprecates `middleware.ts`. Always use `proxy.ts` (and export `function proxy()`) for edge middleware routing.
- **Tailwind v4 with Turbopack:** When defining theme variables in `globals.css`, always use the `@theme inline { ... }` directive rather than just `@theme { ... }`. Using the standard `@theme` without `inline` causes a `CssSyntaxError: Unclosed block` during the Turbopack build.
- **Folder Structure:** When scaffolding a new project and moving `app/` into `src/app/`, always ensure `tsconfig.json` is updated to map `"@/*": ["./src/*"]` to prevent `TS2307` import errors.
