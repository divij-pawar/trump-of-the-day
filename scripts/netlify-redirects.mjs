// Writes dist/_redirects for Netlify after `vite build`:
//   /api/*  ->  $API_ORIGIN/api/:splat   (proxied, status 200: the browser only sees the site's origin)
//   /*      ->  /index.html              (SPA fallback)
//
// API_ORIGIN is the Cloud Run URL (`terraform output api_url` in infra/gcp), set in
// the Netlify site's environment. The build fails without it: publishing the site
// with no API behind /api would replace a working deploy with a broken one.
import { writeFileSync } from "node:fs";

const origin = (process.env.API_ORIGIN ?? "").trim().replace(/\/+$/, "");
if (!/^https:\/\/[^/\s]+$/.test(origin)) {
  console.error(
    `API_ORIGIN must be the API's https origin (e.g. https://trump-of-the-day-api-xyz-uc.a.run.app), got "${origin}".`,
  );
  process.exit(1);
}
if (!process.env.VITE_WS_URL && process.env.VITE_LIVE_UPDATES !== "false") {
  console.warn("VITE_WS_URL is not set: live updates will try wss://<site>/ws, which Netlify can't proxy.");
}

const rules = [`/api/*  ${origin}/api/:splat  200`, "/*  /index.html  200"];
writeFileSync("dist/_redirects", rules.join("\n") + "\n");
console.log(`dist/_redirects: /api/* -> ${origin}`);
