// Evaluate one JavaScript expression in the app's WebView over Chrome DevTools (debug APKs only; release builds keep
// WebView debugging off). Used by scripts/emulator-check.sh after `adb forward tcp:<port> localabstract:webview_devtools_remote_<pid>`.
// Usage: node scripts/cdp.mjs <port> "<expression>"  -> prints the JSON value, exit 1 on any error.
import { createRequire } from "node:module";

const [port, expression] = process.argv.slice(2);
if (!port || !expression) { console.error("usage: cdp.mjs <port> <expression>"); process.exit(2); }

let WS = globalThis.WebSocket;
if (!WS) { try { WS = createRequire(import.meta.url)("ws"); } catch { console.error("no WebSocket client (Node 22+ or the ws package)"); process.exit(1); } }

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && /appassets\.androidplatform\.net/.test(t.url)) ?? targets.find((t) => t.type === "page");
if (!page) { console.error("no page target", JSON.stringify(targets)); process.exit(1); }

const ws = new WS(page.webSocketDebuggerUrl);
const timer = setTimeout(() => { console.error("timeout"); process.exit(1); }, 15000);
const on = (ev, fn) => (ws.addEventListener ? ws.addEventListener(ev, fn) : ws.on(ev, fn));
on("open", () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })));
on("message", (m) => {
  const msg = JSON.parse(typeof m === "string" ? m : m.data ?? m.toString());
  if (msg.id !== 1) return;
  clearTimeout(timer);
  const r = msg.result;
  if (!r || r.exceptionDetails) { console.error(JSON.stringify(r?.exceptionDetails ?? msg)); process.exit(1); }
  console.log(JSON.stringify(r.result.value ?? null));
  ws.close();
  process.exit(0);
});
on("error", (e) => { console.error(String(e?.message ?? e)); process.exit(1); });
