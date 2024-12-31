# Ciphers Notes

## Formatting

Currently project is utilizing dprint for Typescript formatting as instance is highly customizable and light. Unit configurations is `dprint.json`\
documentation is available [here](https://dprint.dev/overview/)

can also be utilized via runner post `bun install dprint` and executed with command `bunx dprint help`

## Changelog

Key changes and improvements made:

Package.json changes:

- Removed ts-node and tsup as Bun has built-in TypeScript support
- Added bun-types for Bun runtime type definitions
- Updated build and start scripts to use Bun
- Changed engine requirement from Node to Bun
- Added proper type declarations for all dependencies
- Configured for ESM modules
- Added type-check script for TypeScript validation

tsconfig.json additions:

- Set target and module to "ESNext"
- Configured for modern module resolution
- Added Bun-specific types
- Enabled strict type checking
- Configured for bundler-style module resolution
- Added path aliases for better importing
- Optimized for development with Bun

Removed unnecessary dependencies:

- Removed readline as it's built into Bun
- Removed build tools that Bun replaces

### minimal Bun `package.json`

```json
{
  "name": "@ai16z/agent",
  "version": "0.1.1",
  "type": "module",
  "module": "src/index.ts",
  "exports": { ".": { "import": "./src/index.ts" } },
  "scripts": {
    "build": "bun build ./src/index.ts --outdir dist --target node --format esm",
    "start": "bun run src/index.ts",
    "start:dev": "bun --watch run src/index.ts",
    "start:all": "bun run src/services/all.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@ai16z/client-direct": "v0.1.4-alpha.3",
    "@ai16z/client-twitter": "v0.1.4-alpha.3",
    "@ai16z/eliza": "v0.1.4-alpha.3",
    "@ai16z/plugin-solana": "0.1.6"
  },
  "devDependencies": {
    "@types/bun": "^1.1.14",
    "@types/node": "^22.10.2",
    "bun-types": "^1.1.42",
    "typescript": "^5.6.3"
  },
  "engines": { "bun": ">=1.0.0" }
}
```

### tsconfig.json for ESNext

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["bun-types"],
    "allowJs": true,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### Useful Commands

Check outdated packages

```sh
bun outdated
```

┌───────────────────────┬───────────────┬───────────────┬────────┐
│ Package │ Current │ Update │ Latest │
├───────────────────────┼───────────────┼───────────────┼────────┤
│ @ai16z/client-direct │ 0.1.4-alpha.3 │ 0.1.4-alpha.3 │ 0.1.6 │
├───────────────────────┼───────────────┼───────────────┼────────┤
│ @ai16z/client-twitter │ 0.1.4-alpha.3 │ 0.1.4-alpha.3 │ 0.1.6 │
├───────────────────────┼───────────────┼───────────────┼────────┤
│ @ai16z/eliza │ 0.1.4-alpha.3 │ 0.1.4-alpha.3 │ 0.1.6 │
└───────────────────────┴───────────────┴───────────────┴────────┘

To update a specific package to the latest version utilize

```sh
bun update package_to_update --latest
```
