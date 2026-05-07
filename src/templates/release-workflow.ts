/**
 * Canonical OIDC release workflow template.
 *
 * This is the GitHub Actions workflow that npm-trust expects when
 * configuring OIDC trusted publishing. The `--emit-workflow` flag (added
 * in v0.10.0) writes this template to stdout so consumers (notably
 * solo-npm's `/init` Phase 1c) don't need to inline the YAML themselves.
 *
 * The template targets pnpm + Node.js >= 24 (matching solo-npm's
 * conventions). Token-auth / private-registry variants are NOT bundled —
 * those are out-of-scope for npm-trust (which is fundamentally about
 * OIDC). Consumers wanting private-registry scaffolding should ship that
 * separately.
 */
export const RELEASE_WORKFLOW_PUBLIC = `name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write   # OIDC for npm trusted publishing

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm test
      - run: pnpm run build
      - name: Detect dist-tag
        id: dist
        run: |
          VERSION=$(node -p "require('./package.json').version")
          EXPLICIT_TAG=$(node -p "require('./package.json').publishConfig?.tag || ''")
          if [ -n "$EXPLICIT_TAG" ]; then
            echo "tag=$EXPLICIT_TAG" >> "$GITHUB_OUTPUT"
          elif [[ "$VERSION" =~ -[a-z]+\\.[0-9]+$ ]]; then
            echo "tag=next" >> "$GITHUB_OUTPUT"
          else
            echo "tag=latest" >> "$GITHUB_OUTPUT"
          fi
      - run: pnpm publish --no-git-checks --tag \${{ steps.dist.outputs.tag }}
`;

/**
 * Variant that wires in the prepare-dist GitHub Action before publishing.
 * Used by consumers that publish from a `dist/` directory (the most common
 * pattern for TypeScript libraries). prepare-dist transforms the
 * package.json (strips ./dist/ prefixes, removes scripts/devDependencies),
 * copies metadata, and verifies the tag matches package.json#version.
 *
 * Emitted via \`npm-trust --emit-workflow --with-prepare-dist\`.
 */
export const RELEASE_WORKFLOW_WITH_PREPARE_DIST = `name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write   # OIDC for npm trusted publishing

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm test
      - run: pnpm run build
      - uses: gagle/prepare-dist@v1
        with:
          tag: \${{ github.ref_name }}
      - name: Detect dist-tag
        id: dist
        run: |
          VERSION=$(node -p "require('./dist/package.json').version")
          EXPLICIT_TAG=$(node -p "require('./dist/package.json').publishConfig?.tag || ''")
          if [ -n "$EXPLICIT_TAG" ]; then
            echo "tag=$EXPLICIT_TAG" >> "$GITHUB_OUTPUT"
          elif [[ "$VERSION" =~ -[a-z]+\\.[0-9]+$ ]]; then
            echo "tag=next" >> "$GITHUB_OUTPUT"
          else
            echo "tag=latest" >> "$GITHUB_OUTPUT"
          fi
      - run: pnpm publish --no-git-checks --tag \${{ steps.dist.outputs.tag }}
        working-directory: dist
`;
