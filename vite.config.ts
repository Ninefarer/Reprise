import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

const webBase = "/Reprise/";

export default defineConfig(({ mode }) => {
  const web = mode === "web";
  return {
    base: web ? webBase : "/",
    publicDir: web ? "pwa/public" : false,
    build: {
      outDir: web ? "dist-web" : "dist",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "reprise:platform": fileURLToPath(
          new URL(
            web ? "./src/platform/web.ts" : "./src/platform/tauri.ts",
            import.meta.url,
          ),
        ),
      },
    },
    plugins: [pwaHtml(web), ...(web ? [shellCacheVersion()] : [])],
  };
});

function shellCacheVersion(): Plugin {
  return {
    name: "reprise-shell-cache-version",
    apply: "build",
    closeBundle() {
      const dir = fileURLToPath(new URL("./dist-web/", import.meta.url));
      const swPath = `${dir}sw.js`;
      const index = readFileSync(`${dir}index.html`, "utf8");
      const hash = createHash("sha256").update(index).digest("hex").slice(0, 12);
      const sw = readFileSync(swPath, "utf8");
      const marker = 'const CACHE_VERSION = "reprise-nightly-shell-v1"';
      if (!sw.includes(marker)) {
        throw new Error("service worker is missing the shell cache version");
      }
      writeFileSync(
        swPath,
        sw.replace(marker, `const CACHE_VERSION = "reprise-nightly-shell-${hash}"`),
      );
    },
  };
}

function pwaHtml(web: boolean): Plugin {
  return {
    name: "reprise-pwa-html",
    transformIndexHtml(html) {
      if (!web) return html;
      const tags = [
        `<link rel="manifest" href="${webBase}manifest.webmanifest" />`,
        `<link rel="apple-touch-icon" href="${webBase}icons/apple-touch-icon.png" />`,
        `<meta name="theme-color" content="#202521" />`,
        `<meta name="apple-mobile-web-app-capable" content="yes" />`,
        `<meta name="mobile-web-app-capable" content="yes" />`,
        `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
        `<meta name="apple-mobile-web-app-title" content="Reprise" />`,
      ].join("");
      return html
        .replace(
          'name="viewport" content="width=device-width, initial-scale=1.0"',
          'name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
        )
        .replace("</head>", `${tags}</head>`);
    },
  };
}
