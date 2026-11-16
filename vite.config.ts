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
    plugins: [pwaHtml(web)],
  };
});

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
