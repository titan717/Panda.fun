// Build-time integrity gate (docs/SECURITY.md §Web):
// 1. adds Subresource Integrity (sha384) to every entry <script>, <link rel="modulepreload"> and stylesheet in index.html;
// 2. hashes every inline <style>/<script> in index.html and fails the build when vercel.json's CSP does not allow that exact hash,
//    so the strict CSP (no 'unsafe-inline') can never silently break the boot splash.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const digest = (alg, data) => createHash(alg).update(data).digest("base64");

export default function integrity({ csp = true } = {}) {
  return {
    name: "panda-integrity",
    apply: "build",
    enforce: "post",
    // writeBundle runs after every plugin has finished rewriting chunks, so the hashes match the bytes actually served.
    writeBundle(opts) {
      const dir = opts.dir;
      const file = join(dir, "index.html");
      if (!existsSync(file)) return;
      let src = readFileSync(file, "utf8");
      const lookup = (url) => {
        if (/^[a-z]+:/i.test(url)) return null;
        const path = join(dir, url.replace(/^\.?\//, ""));
        return existsSync(path) ? readFileSync(path) : null;
      };
      src = src.replace(/<(script|link)\b([^>]*?)\s(src|href)="([^"]+)"([^>]*)>/g, (tag, el, pre, attr, url, post) => {
        if (/integrity=/.test(tag)) return tag;
        if (el === "link" && !/rel="(modulepreload|stylesheet)"/.test(tag)) return tag;
        const body = lookup(url);
        if (body == null) return tag;
        return `<${el}${pre} ${attr}="${url}" integrity="sha384-${digest("sha384", body)}"${post}>`;
      });
      if (csp) {
        const policy = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"))
          .headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
        for (const [, kind, body] of src.matchAll(/<(style|script)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
          if (kind === "script" && !body.trim()) continue;
          const token = `'sha256-${digest("sha256", body)}'`;
          const directive = policy.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${kind}-src `)) ?? "";
          if (!directive.includes(token)) this.error(`vercel.json CSP ${kind}-src is missing ${token} for an inline <${kind}> in index.html`);
        }
      }
      writeFileSync(file, src);
    }
  };
}
