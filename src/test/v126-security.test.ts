import { afterEach, describe, expect, it, vi } from "vitest";
import kt from "../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw";
import vercel from "../../vercel.json?raw";
import ci from "../../.github/workflows/ci.yml?raw";
import codeql from "../../.github/workflows/codeql.yml?raw";
import apk from "../../.github/workflows/build-apk.yml?raw";
import emu from "../../.github/workflows/emulator-check.yml?raw";
import adscore from "../../.github/workflows/source-adscore.yml?raw";

/** v1.2.6 security gate: bridge key, headers, pinned CI. */
const OPEN = new Set(["getAppVersion", "getVersionCode", "isTV", "hasVoiceSearch", "canPictureInPicture", "notificationPermission"]);

describe("Android bridge key", () => {
  const bridge = kt.slice(kt.indexOf("inner class KinomaTVBridge"));
  const funs = [...bridge.matchAll(/@JavascriptInterface\s+fun (\w+)\(([^)]*)\)/g)].map((m) => ({ name: m[1]!, args: m[2]! }));

  it("every bridge method that acts or reveals state takes the key first and checks it", () => {
    expect(funs.length).toBeGreaterThan(20);
    for (const f of funs) {
      if (OPEN.has(f.name)) { expect(f.args, f.name).not.toContain("key"); continue; }
      expect(f.args.startsWith("key: String"), f.name).toBe(true);
      const body = bridge.slice(bridge.indexOf(`fun ${f.name}(`));
      expect(body.split("\n").slice(0, 3).join("\n"), f.name).toContain("if (!trusted(key)) return");
    }
  });
  it("the key is random per launch, compared in constant time and given to the top document only", () => {
    expect(kt).toContain("java.security.SecureRandom().nextBytes(it)");
    expect(kt).toContain("java.security.MessageDigest.isEqual(");
    expect(kt).toContain("resolveBundledAsset(path, request.isForMainFrame)");
    expect(kt).toMatch(/if \(!mainFrame\) return stream/);
    expect(kt).not.toContain("\"Access-Control-Allow-Origin\" to");
  });

  afterEach(() => { delete (window as { KinomaNative?: unknown }).KinomaNative; document.head.innerHTML = ""; vi.resetModules(); });
  it("the web side reads the key once, removes it from the page and passes it on gated calls", async () => {
    const meta = document.createElement("meta");
    meta.name = "panda-bridge"; meta.content = "k123";
    document.head.append(meta);
    const calls: unknown[][] = [];
    window.KinomaNative = {
      getAppVersion: () => "1.2.6", isTV: () => true, checkForUpdatesManual: () => {}, downloadUpdate: () => {},
      remoteInfo: (...a: unknown[]) => { calls.push(["remoteInfo", ...a]); return "{}"; },
      shareText: (...a: unknown[]) => { calls.push(["shareText", ...a]); return true; },
    } as unknown as NonNullable<Window["KinomaNative"]>;
    const { native } = await import("../lib/native");
    expect(document.querySelector('meta[name="panda-bridge"]')).toBeNull();
    expect(native?.getAppVersion()).toBe("1.2.6");
    native?.remoteInfo?.();
    native?.shareText?.("Fight Club", "https://example.test");
    expect(calls).toEqual([["remoteInfo", "k123"], ["shareText", "k123", "Fight Club", "https://example.test"]]);
  });
});

describe("web headers", () => {
  const headers = (JSON.parse(vercel) as { headers: { source: string; headers: { key: string; value: string }[] }[] }).headers.flatMap((h) => h.headers);
  const get = (k: string) => headers.find((h) => h.key === k)?.value ?? "";
  it("strict CSP: no unsafe-inline or unsafe-eval anywhere, the boot splash is allowed by hash", () => {
    const csp = get("Content-Security-Policy");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toMatch(/style-src 'self' 'sha256-[A-Za-z0-9+/=]{44}'/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
  });
  it("HSTS with preload, nosniff, referrer policy", () => {
    expect(get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});

describe("CI supply chain", () => {
  const all = [ci, codeql, apk, emu, adscore];
  it("every action is pinned to a full commit SHA", () => {
    for (const w of all) for (const m of w.matchAll(/uses:\s*([^\s#]+)/g)) expect(m[1], m[1]).toMatch(/@[0-9a-f]{40}$/);
  });
  it("every workflow declares least-privilege permissions", () => {
    for (const w of all) expect(w).toMatch(/^permissions:/m);
  });
  it("audit, secret scan, CodeQL and an SBOM run", () => {
    expect(ci).toContain("npm audit --audit-level=high");
    expect(ci).toContain("gitleaks/gitleaks-action@");
    expect(codeql).toContain("security-events: write");
    expect(apk).toContain("npm sbom --sbom-format cyclonedx --omit dev");
  });
});
