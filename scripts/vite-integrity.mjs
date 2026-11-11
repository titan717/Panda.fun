// Build-time integrity gate (docs/SECURITY.md §Web):
// 1. adds Subresource Integrity (sha384) to every entry <script>, <link rel="modulepreload"> and stylesheet in index.html;
// 2. hashes every inline <style>/<script> in index.html and fails the build when vercel.json's CSP does not allow that exact hash,
//    so the strict CSP (no 'unsafe-inline') can never silently break the boot splash.
import { createHash } from "node:crypto";
import { readFileSync, openSync, closeSync, ftruncateSync, writeSync } from "node:fs";
import { join, dirname } from "node:path";

const digest = (alg, data) => createHash(alg).update(data).digest("base64");

export default function integrity({ csp = true } = {}) {
  return {
    name: "panda-integrity",
    apply: "build",
    enforce: "post",
    // writeBundle runs after every plugin has finished rewriting chunks, so the hashes match the bytes actually served.
    writeBundle(opts) {
      // v1.2.9: the /welcome landing page is a second HTML entry and gets the same SRI + CSP gate
      for (const page of ["index.html", "welcome/index.html"]) gate.call(this, opts.dir, page);
    }
  };
  function gate(dir, page) {
      const file = join(dir, page);
      // one descriptor for read and rewrite: no check-then-use window on index.html
      let fd;
      try { fd = openSync(file, "r+"); } catch { return; }
      let src = readFileSync(fd, "utf8");
      const lookup = (url) => {
        if (/^[a-z]+:/i.test(url)) return null;
        // root-absolute URLs resolve from dist/, relative ones from the page's own folder
        const path = url.startsWith("/") ? join(dir, url.slice(1)) : join(dir, dirname(page), url.replace(/^\.\//, ""));
        try { return readFileSync(path); } catch { return null; }
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
          if (!directive.includes(token)) { closeSync(fd); this.error(`vercel.json CSP ${kind}-src is missing ${token} for an inline <${kind}> in ${page}`); }
        }
      }
      try { ftruncateSync(fd, 0); writeSync(fd, src, 0, "utf8"); } finally { closeSync(fd); }
    }
}
