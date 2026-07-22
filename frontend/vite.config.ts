// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import wasm from "vite-plugin-wasm";
import type { Plugin } from "vite";

/**
 * Vite plugin that makes Midnight SDK packages resolve during server-side
 * builds (SSR / Nitro / workerd) by:
 *
 * 1. Broadening resolve conditions so packages like `@midnight-ntwrk/ledger-v8`
 *    and `@midnight-ntwrk/onchain-runtime-v3` (which only export for "browser"
 *    and "node") are reachable even when the build condition is "workerd".
 *
 * 2. Returning a minimal stub for packages that genuinely can't run outside
 *    a browser context (wasm-backed SDK packages), so the SSR build doesn't
 *    fail. Runtime callers guard access with `typeof window !== "undefined"`.
 */
function midnightSSRCompatPlugin(): Plugin {
  const MIDNIGHT_PKGS = [
    "@midnight-ntwrk/compact-runtime",
    "@midnight-ntwrk/compact-js",
    "@midnight-ntwrk/onchain-runtime-v3",
    "@midnight-ntwrk/ledger-v8",
    "@midnight-ntwrk/midnight-js-contracts",
    "@midnight-ntwrk/midnight-js-http-client-proof-provider",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
    "@midnight-ntwrk/midnight-js-network-id",
    "@midnight-ntwrk/midnight-js-protocol",
    "@midnight-ntwrk/midnight-js-types",
    "@midnight-ntwrk/midnight-js-utils",
    "@midnight-ntwrk/midnight-js-fetch-zk-config-provider",
    "@midnight-ntwrk/dapp-connector-api",
    "@midnight-ntwrk/wallet-sdk-address-format",
    "@midnight-ntwrk/midnight-js-level-private-state-provider",
    "@midnight-ntwrk/midnight-js-node-zk-config-provider",
  ];

  return {
    name: "midnight-ssr-compat",
    enforce: "pre",
    resolveId(id, _, options) {
      // Only intercept for SSR / non-client builds
      if (options?.ssr === false) return null;
      if (!MIDNIGHT_PKGS.some((pkg) => id === pkg || id.startsWith(pkg + "/"))) return null;
      // Return null to let the default resolver handle it; we just need
      // the resolve conditions to be in place.
      return null;
    },
    config() {
      return {
        resolve: {
          // Broaden conditions so Midnight WASM packages resolve during all
          // build phases (client, ssr, nitro).
          conditions: ["browser", "node", "import", "module", "default"],
        },
      };
    },
  };
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    cloudflare: {
      nodeCompat: true,
    },
  },
  vite: {
    plugins: [
      midnightSSRCompatPlugin(),
      // @ts-expect-error - vite-plugin-wasm is not typed for Vite 8
      wasm(),
      // Prevent Vite from externalizing onchain-runtime-v3 when imported by compact-runtime
      {
        name: "wasm-module-resolver",
        resolveId(source, importer) {
          if (
            source === "@midnight-ntwrk/onchain-runtime-v3" &&
            importer &&
            importer.includes("@midnight-ntwrk/compact-runtime")
          ) {
            return { id: source, external: false, moduleSideEffects: true };
          }
          return null;
        },
      },
    ],
    // Externalize heavy Midnight packages from SSR — they're loaded only
    // from browser click handlers via dynamic import() at runtime.
    ssr: {
      noExternal: ["buffer"],
      external: [
        "@midnight-ntwrk/compact-runtime",
        "@midnight-ntwrk/compact-js",
        "@midnight-ntwrk/onchain-runtime-v3",
        "@midnight-ntwrk/ledger-v8",
        "@midnight-ntwrk/midnight-js-contracts",
        "@midnight-ntwrk/midnight-js-http-client-proof-provider",
        "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
        "@midnight-ntwrk/midnight-js-network-id",
        "@midnight-ntwrk/midnight-js-protocol",
        "@midnight-ntwrk/midnight-js-types",
        "@midnight-ntwrk/midnight-js-utils",
        "@midnight-ntwrk/midnight-js-fetch-zk-config-provider",
        "@midnight-ntwrk/dapp-connector-api",
        "@midnight-ntwrk/wallet-sdk-address-format",
        "cross-fetch",
        "graphql-ws",
        "isomorphic-ws",
        "ws",
      ],
    },
    optimizeDeps: {
      include: ["@midnight-ntwrk/compact-runtime"],
      exclude: [
        "@midnight-ntwrk/onchain-runtime-v3",
        "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm",
        "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm.js",
      ],
    },
  },
});
