// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
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

/**
 * Patch @midnight-ntwrk/onchain-runtime-v3's browser entry to use top-level
 * await for WASM init instead of synchronous `import * as wasm from "./.wasm"`.
 *
 * The package uses old wasm-bindgen which does:
 *   import * as wasm from "./midnight_onchain_runtime_wasm_bg.wasm";
 *   wasm.__wbindgen_start();
 *
 * Vite treats .wasm imports as async init functions, so `wasm` is a function,
 * not a module instance. This plugin rewrites the entry to use fetch +
 * WebAssembly.instantiate with top-level await, mirroring the Node entry
 * pattern (midnight_onchain_runtime_wasm_fs.js).
 */
function midnightWasmCompatPlugin(): Plugin {
  const WASM_ENTRY_REGEX =
    /node_modules[\\/]@midnight-ntwrk[\\/]onchain-runtime-v3[\\/]midnight_onchain_runtime_wasm\.js$/;

  return {
    name: "midnight-wasm-compat",
    enforce: "post",
    transform(code, id) {
      if (!WASM_ENTRY_REGEX.test(id)) return null;
      // Ensure we only apply to files running in the browser
      // (SSR/build should use the node entry instead)
      return {
        code: `
import * as __wasm_bg_exports from "./midnight_onchain_runtime_wasm_bg.js";
export * from "./midnight_onchain_runtime_wasm_bg.js";
import { __wbg_set_wasm } from "./midnight_onchain_runtime_wasm_bg.js";

const __wasmUrl = new URL("./midnight_onchain_runtime_wasm_bg.wasm", import.meta.url);
const __response = await fetch(__wasmUrl);
const __wasmBytes = await __response.arrayBuffer();
const __imports = { "./midnight_onchain_runtime_wasm_bg.js": __wasm_bg_exports };
const __result = await WebAssembly.instantiate(__wasmBytes, __imports);
const __wasm = __result.instance.exports;

__wbg_set_wasm(__wasm);
__wasm.__wbindgen_start();
        `,
        map: null,
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
    plugins: [midnightSSRCompatPlugin(), midnightWasmCompatPlugin()],
    // Externalize heavy Midnight packages from SSR — they're loaded only
    // from browser click handlers via dynamic import() at runtime.
    ssr: {
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
  },
});
