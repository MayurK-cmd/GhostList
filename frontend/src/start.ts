// Buffer polyfill — MUST be set before any Midnight SDK imports because
// several Midnight packages (ledger-v8, compact-runtime) reference it at
// module-load time, even when running in the browser.
// NOTE: bare specifier "buffer" ensures Vite resolves correctly across
// both SSR (Node built-in) and client (npm package) builds.
import { Buffer } from "buffer";
if (typeof globalThis !== "undefined") {
  globalThis.Buffer = Buffer;
}

import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
