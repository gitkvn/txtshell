// Gates for "unreadable records": the vault keeps, counts and carries records the
// current key cannot open; plaintext leftovers of an interrupted /encrypt are
// recovered; /encrypt and /encrypt off are atomic; sync carries flagged ciphertext
// and a readable copy of an id always beats an unreadable one.
//
//   node test/unreadable.mjs            (CHROME=/path/to/chrome to override)
//
// Self-contained: an https server (self-signed cert, Chrome ignores the error)
// serves the repo root and a stub sync Worker at /v1/blocks on the same origin,
// so app.js's https-only Worker URL check passes with no CORS in play. The app
// is driven through CDP by calling its own top-level functions; IndexedDB is
// read through the app's getAllEntries()/getMeta(). One browser context per
// simulated device.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8443;
const CDP_PORT = 9349;
const BASE = `https://localhost:${PORT}`;
const PASS = "correct horse battery";

function defaultChrome() {
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const found = ["/usr/bin/chromium", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser"].find((p) => existsSync(p));
  if (found) return found;
  throw new Error("No Chrome binary found; set CHROME=/path/to/chrome");
}
const CHROME = process.env.CHROME || defaultChrome();

let failures = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) failures++; return !!c; };
// Harness rule: a skipped part is printed every run with its reason and counted in the last line.
const skips = [];
const skipped = (part, reason) => { skips.push(part); console.log(`SKIP  ${part} — ${reason}`); };
const summary = () => `${failures === 0 ? "ALL PASSED" : failures + " FAILURE(S)"}${skips.length ? ` · ${skips.length} part(s) SKIPPED: ${skips.join("; ")}` : " · nothing skipped"}`;
void skipped;
const procs = [];
process.on("exit", () => procs.forEach((p) => { try { p.kill(); } catch {} }));

// ---------- https server: static files + stub Worker ----------
const scratch = mkdtempSync(path.join(tmpdir(), "txtshell-unreadable-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
  "-keyout", path.join(scratch, "key.pem"), "-out", path.join(scratch, "cert.pem")], { stdio: "ignore" });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };
const stub = { blob: null, lastPut: null, puts: 0, fail413: false };
const server = createServer({ key: readFileSync(path.join(scratch, "key.pem")), cert: readFileSync(path.join(scratch, "cert.pem")) }, (req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname === "/v1/blocks") {
    if (req.method === "PUT") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        if (stub.fail413) { res.writeHead(413, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "payload-too-large" })); return; }
        stub.blob = body; stub.lastPut = body; stub.puts++;
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if (req.method === "GET") {
      if (!stub.blob) { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "no-blob" })); return; }
      res.writeHead(200, { "Content-Type": "application/octet-stream" }); res.end(stub.blob); return;
    }
    res.writeHead(405); res.end(); return;
  }
  let file = path.join(ROOT, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(readFileSync(file));
});
// A previous run may still be releasing its ports (Chrome exits after the harness does): wait
// for both to be free rather than starting against a dying browser and failing at the first tab.
async function waitForPortFree(port, probe, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!(await probe(port))) return true;
    await sleep(250);
  }
  return false;
}
const httpProbe = (port) => fetch(`http://127.0.0.1:${port}/json/version`).then(() => true, () => false);
const listenProbe = (port) => new Promise((resolve) => { const t = createServer(); t.once("error", () => resolve(true)); t.listen(port, () => t.close(() => resolve(false))); });
if (!(await waitForPortFree(CDP_PORT, httpProbe))) { console.error(`CDP port ${CDP_PORT} still held by a previous Chrome after 30s`); process.exit(2); }
if (!(await waitForPortFree(PORT, listenProbe))) { console.error(`port ${PORT} still in use after 30s`); process.exit(2); }
await new Promise((r) => server.listen(PORT, r));

// ---------- CDP ----------
const profile = path.join(scratch, "profile");
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--ignore-certificate-errors", "--disable-gpu", "about:blank"], { stdio: "ignore" });
procs.push(chrome);
let wsUrl; for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {} if (!wsUrl) await sleep(250); }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let nextId = 1; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
async function waitFor(fn, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch {} await sleep(100); } return false; }

// A "device": its own browser context (own IndexedDB). open() (re)creates the tab.
async function device(name) {
  const { browserContextId } = await send("Target.createBrowserContext", {});
  const d = { name, browserContextId, sessionId: null, targetId: null };
  d.eval = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, d.sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  d.open = async () => {
    const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    d.sessionId = sessionId; d.targetId = targetId;
    await send("Runtime.enable", {}, sessionId); await send("Page.enable", {}, sessionId);
    await send("Page.navigate", { url: `${BASE}/` }, sessionId);
    await waitFor(() => d.eval(`document.readyState === "complete" && typeof state === "object" && state.db !== null`));
    await sleep(200);
  };
  d.close = () => send("Target.closeTarget", { targetId: d.targetId }).catch(() => {});
  // Page.crash may never answer (the target is gone); bound the wait.
  d.crash = () => Promise.race([send("Page.crash", {}, d.sessionId).catch(() => {}), sleep(1500)]);
  // ---- app driving, via app.js's own globals ----
  d.cmd = (text) => d.eval(`(setEditorValue(${JSON.stringify(text)}), submitComposer(), true)`);
  d.fill = (field, value) => d.eval(`(() => { const i = vaultOverlay.querySelector('[data-field="${field}"]'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event("input")); return true; })()`);
  d.click = (action) => d.eval(`(vaultOverlay.querySelector('[data-action="${action}"]').click(), true)`);
  d.view = () => d.eval(`state.vaultView`);
  d.unlocked = () => d.eval(`state.encryption.enabled && state.encryption.unlocked`);
  d.encryptSetup = async (pass = PASS) => {
    await d.cmd("/encrypt");
    await waitFor(() => d.view().then((v) => v === "setup"));
    await d.fill("pass", pass); await d.fill("confirm", pass); await d.click("submit");
    await waitFor(() => d.view().then((v) => v === "recovery-display"));
    await d.click("confirm");
    return waitFor(() => d.unlocked());
  };
  d.lock = () => d.eval(`(lockVault(), true)`);
  // Unlock fires autoPullOnUnlock, which holds pushes while its GET is in flight
  // and replays a deferred push afterwards; settle both before the gate goes on.
  d.settle = () => waitFor(() => d.eval(`pullHoldDepth === 0 && cloudSyncTimer === null && !cloudSyncInFlight`), 15000);
  d.unlock = async (pass = PASS) => {
    await waitFor(() => d.view().then((v) => v === "unlock"));
    await d.fill("pass", pass); await d.click("submit");
    const ok = await waitFor(() => d.unlocked());
    // `unlocked` flips before the entries are decrypted; the card closes in the
    // same synchronous run that starts the auto-pull, so wait for that first.
    await waitFor(() => d.view().then((v) => v === null));
    await d.settle();
    return ok;
  };
  d.hint = () => d.eval(`composerHint.textContent`);
  d.footer = () => d.eval(`savedCount.textContent`);
  d.entries = () => d.eval(`state.entries.map((e) => ({ id: e.id, text: e.text }))`);
  d.unreadable = () => d.eval(`state.unreadable.map((u) => ({ id: u.id, text: u.text }))`);
  d.tags = () => d.eval(`[...new Set(state.entries.flatMap((e) => e.tags))]`);
  d.raw = () => d.eval(`getAllEntries().then((r) => r.map((x) => ({ id: x.id, text: x.text, tags: x.tags, unreadable: x.unreadable === true })))`);
  d.meta = (key) => d.eval(`getMeta(${JSON.stringify(key)})`);
  d.add = (text) => d.eval(`createEntryFromText(${JSON.stringify(text)}).id`);
  d.push = () => d.eval(`flushCloudSync()`);
  d.pull = () => d.eval(`beginPull().then(() => true)`);
  d.syncSetup = async () => {
    await d.cmd("/sync setup");
    await waitFor(() => d.view().then((v) => v === "sync-setup"));
    await d.fill("url", BASE); await d.fill("token", "stub-token"); await d.click("submit");
    await waitFor(() => d.view().then((v) => v === null));
    await sleep(300);
  };
  // Plant a record encrypted under a key this vault does not hold.
  d.plantForeign = (id, text, createdAt = new Date().toISOString()) => d.eval(`(async () => {
    if (!window.__foreignKey) window.__foreignKey = await generateMasterKey();
    const ct = await encryptPlaintext(${JSON.stringify(text)}, window.__foreignKey);
    await putEntryRecord({ id: ${JSON.stringify(id)}, text: ct, tags: [], mentions: [], createdAt: ${JSON.stringify(createdAt)}, editedAt: ${JSON.stringify(createdAt)}, pinned: false });
    return ct;
  })()`);
  d.plantPlain = (id, text, createdAt = new Date().toISOString()) => d.eval(`putEntryRecord({ id: ${JSON.stringify(id)}, text: ${JSON.stringify(text)}, tags: [], mentions: [], createdAt: ${JSON.stringify(createdAt)}, editedAt: ${JSON.stringify(createdAt)}, pinned: false }).then(() => true)`);
  // The raw master key, as /mirror would export it, for pairing another device.
  d.rawKey = () => d.eval(`(async () => {
    const wk = await deriveWrappingKey(${JSON.stringify(PASS)}, base64ToBytes(await getMeta(ENC_SALT_PASS_KEY)), await readIterations(ENC_ITERATIONS_PASS_KEY));
    const m = await unwrapMasterKey(await getMeta(ENC_WRAPPED_PASS_KEY), wk, true);
    return bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", m)));
  })()`);
  d.port = async (rawKey, pass = PASS) => {
    await d.cmd("/port");
    await waitFor(() => d.view().then((v) => v === "port-paste"));
    await d.fill("pairing", JSON.stringify({ workerUrl: BASE, authToken: "stub-token", masterKey: rawKey }));
    await d.click("submit");
    await waitFor(() => d.view().then((v) => v === "port-passphrase"));
    await d.fill("pass", pass); await d.fill("confirm", pass); await d.click("submit");
    await waitFor(() => d.unlocked());
    await waitFor(() => d.hint().then((h) => /^Paired/.test(h)), 10000);
  };
  await d.open();
  return d;
}

// Decrypt a stub blob in Node with a raw key (IV(12) || ct || tag).
async function decryptBlob(buf, rawKeyB64) {
  const key = await webcrypto.subtle.importKey("raw", Buffer.from(rawKeyB64, "base64"), { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(0, 12) }, key, buf.subarray(12));
  return JSON.parse(Buffer.from(pt).toString("utf8"));
}
const sortIds = (arr) => arr.map((e) => e.id).sort();

// =============================================================================
console.log("--- U1 recover plaintext leftovers of an interrupted /encrypt");
const A = await device("A");
{
  for (const t of ["first block #alpha", "second block @bob", "third block"]) await A.add(t);
  check(await A.encryptSetup(), "A: /encrypt set up");
  await A.plantPlain("left-1", "leftover one, never encrypted #ghost");
  await A.plantPlain("left-2", "leftover two");
  await A.lock(); await A.unlock();
  const hint = await A.hint();
  check(/recovered 2 blocks left unencrypted/.test(hint), `unlock hint: "${hint}"`);
  check((await A.entries()).length === 5, "all 5 blocks render");
  await waitFor(() => A.raw().then((r) => r.filter((x) => x.id.startsWith("left-")).every((x) => /^[A-Za-z0-9+/]+={0,2}$/.test(x.text) && x.text.length > 40)), 5000);
  const raw = await A.raw();
  check(raw.filter((x) => x.id.startsWith("left-")).every((x) => x.text.length % 4 === 0 && !/leftover/.test(x.text)), "both leftovers re-encrypted in IndexedDB");
  check((await A.unreadable()).length === 0 && !/unreadable/.test(await A.footer()), "no unreadable; footer has no suffix");
  await A.lock(); await A.unlock();
  check((await A.entries()).length === 5 && /^Unlocked$/.test(await A.hint()), "next unlock: 5 blocks, plain 'Unlocked'");
}

// =============================================================================
console.log("\n--- U2 keep records under a foreign key");
let foreign = {};
{
  foreign.r1 = await A.plantForeign("foreign-1", "secret one #tagone", "2026-01-01T00:00:00.000Z");
  foreign.r2 = await A.plantForeign("foreign-2", "secret two #tagtwo", "2026-01-02T00:00:00.000Z");
  await A.lock(); await A.unlock();
  const hint = await A.hint();
  check(/2 blocks can't be read with this key \(kept, not deleted\)/.test(hint), `unlock hint: "${hint}"`);
  check((await A.footer()) === "Saved (5) · 2 unreadable", `footer: "${await A.footer()}"`);
  const same = async () => { const r = await A.raw(); return r.find((x) => x.id === "foreign-1")?.text === foreign.r1 && r.find((x) => x.id === "foreign-2")?.text === foreign.r2; };
  check(await same(), "both records byte-identical in IndexedDB after unlock");
  await A.lock(); await A.unlock();
  check(await same(), "…and after lock + unlock again");
  await A.close(); await A.open(); await A.unlock();
  check(await same() && (await A.footer()) === "Saved (5) · 2 unreadable", "…and after a reload");
  const tags = await A.tags();
  check(!tags.includes("tagone") && !tags.includes("tagtwo"), `no tags extracted from ciphertext (tags: ${tags.join(",")})`);
}

// =============================================================================
console.log("\n--- U5 no false plaintext: strict-base64 texts decrypt; foreign ones are kept, never 'recovered'");
{
  const b64texts = Array.from({ length: 50 }, (_, i) => Buffer.from(`b64-worst-case-${i}-${"x".repeat(30)}`).toString("base64"));
  for (const t of b64texts) await A.add(t);
  await A.lock(); await A.unlock();
  const entries = await A.entries();
  check(b64texts.every((t) => entries.some((e) => e.text === t)) && !/recovered/.test(await A.hint()), "50 strict-base64 texts decrypt and render; none reported");
  for (let i = 0; i < 50; i++) await A.plantForeign(`foreign-b64-${i}`, b64texts[i]);
  await A.lock(); await A.unlock();
  check((await A.unreadable()).length === 52 && !/recovered/.test(await A.hint()), `52 unreadable, none mistaken for plaintext (hint: "${await A.hint()}")`);
  // clean up the 50 for the sync gates: /wipe is the only remover, so delete via the store directly
  await A.eval(`deleteEntryRecords(${JSON.stringify(Array.from({ length: 50 }, (_, i) => `foreign-b64-${i}`))}).then(() => true)`);
  for (const t of b64texts) { const id = entries.find((e) => e.text === t).id; await A.eval(`(removeEntry(${JSON.stringify(id)}), state.entries = state.entries.filter((e) => e.id !== ${JSON.stringify(id)}), true)`); }
  await A.lock(); await A.unlock();
  check((await A.entries()).length === 5 && (await A.unreadable()).length === 2, "back to 5 readable + 2 unreadable");
}

// =============================================================================
console.log("\n--- U4 /encrypt off keeps unreadable records flagged (not garbled)");
{
  await A.cmd("/encrypt off");
  await waitFor(() => A.view().then((v) => v === "disable-confirm"));
  const subtitle = await A.eval(`vaultOverlay.querySelector(".vault-subtitle").textContent`);
  check(/2 blocks this key can't read will stay unreadable/.test(subtitle), `confirm card says so: "${subtitle}"`);
  await A.fill("pass", PASS); await A.click("submit");
  await waitFor(() => A.eval(`!state.encryption.enabled && state.vaultView === null`));
  check(/Encryption off — 2 unreadable blocks kept as-is/.test(await A.hint()), `hint: "${await A.hint()}"`);
  const raw = await A.raw();
  check(raw.filter((x) => x.unreadable).length === 2 && raw.find((x) => x.id === "foreign-1").text === foreign.r1, "flagged records untouched in the plaintext store");
  check(raw.filter((x) => !x.unreadable).every((x) => !/^[A-Za-z0-9+/]+={0,2}$/.test(x.text) || x.text.length % 4 !== 0), "the 5 blocks are plaintext");
  await A.close(); await A.open();
  check((await A.entries()).length === 5 && (await A.footer()) === "Saved (5) · 2 unreadable", `plaintext reload: ${await A.footer()}`);
  check((await A.tags()).every((t) => ["alpha", "ghost"].includes(t)), "no ciphertext indexed in the plaintext store");
  check(await A.encryptSetup(), "/encrypt again");
  check((await A.raw()).filter((x) => x.unreadable).length === 2 && (await A.footer()) === "Saved (5) · 2 unreadable", "flagged records survive /encrypt too");
}

// =============================================================================
console.log("\n--- U6 exports carry unreadable records flagged");
{
  const plain = await A.eval(`(async () => { const o = URL.createObjectURL; let out = null; URL.createObjectURL = (b) => { out = b; return "blob:x"; }; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = () => {}; await exportEntries({ plain: true }); URL.createObjectURL = o; HTMLAnchorElement.prototype.click = c; return JSON.parse(await out.text()); })()`);
  check(plain.length === 7 && plain.filter((e) => e.unreadable === true).length === 2 && plain.find((e) => e.id === "foreign-1").text === foreign.r1, "plain export: 7 entries, 2 flagged with verbatim ciphertext");
  check(/Exported 5 blocks, 2 blocks carried as unreadable/.test(await A.hint()), `hint: "${await A.hint()}"`);
  const enc = await A.eval(`(async () => { const o = URL.createObjectURL; let out = null; URL.createObjectURL = (b) => { out = b; return "blob:x"; }; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = () => {}; await exportEntries(); URL.createObjectURL = o; HTMLAnchorElement.prototype.click = c; return JSON.parse(await out.text()); })()`);
  check(enc.format === "txtshell-encrypted-v1" && enc.wrappedPass && enc.ciphertext, "encrypted export written");
  // Import it into a fresh install: 5 readable + 2 unreadable, never 7 garbage blocks.
  const F = await device("F");
  await F.eval(`(beginEncryptedImport(${JSON.stringify(enc)}), true)`);
  await waitFor(() => F.view().then((v) => v === "import-unlock"));
  await F.fill("pass", PASS); await F.click("submit");
  await waitFor(() => F.view().then((v) => v === "import-adopt"));
  await F.click("setup");
  await waitFor(() => F.eval(`state.encryption.enabled && state.vaultView === null`));
  check((await F.entries()).length === 5 && (await F.unreadable()).length === 2 && (await F.footer()) === "Saved (5) · 2 unreadable", `import into a fresh install: ${await F.footer()}`);
  check((await F.raw()).find((x) => x.id === "foreign-2").text === foreign.r2, "imported flagged record is verbatim ciphertext");
  await F.close();
}

// =============================================================================
console.log("\n--- U8 push carries flagged records");
const rawKeyA = await A.rawKey();
{
  await A.syncSetup();
  await waitFor(() => stub.puts > 0, 10000);
  const blob = await decryptBlob(stub.lastPut, rawKeyA);
  check(blob.length === 7 && blob.filter((e) => e.unreadable === true).length === 2, "blob: 7 entries, 2 flagged");
  check(blob.find((e) => e.id === "foreign-1").text === foreign.r1 && blob.find((e) => e.id === "foreign-2").text === foreign.r2, "flagged ciphertext byte-identical to A's IndexedDB");
  check(blob.filter((e) => e.unreadable).every((e) => !("tags" in e)), "flagged blob records carry no derived fields");
}

// =============================================================================
console.log("\n--- U9 the device that can read them: readable beats unreadable, heals straight away");
const B = await device("B");
{
  // B pairs with A's key and pulls A's blob (10… here 5 readable + 2 flagged) → B stores the flagged copies (U11 shape).
  await B.port(rawKeyA);
  check((await B.entries()).length === 5 && (await B.unreadable()).length === 2, `B paired: ${await B.footer()}`);
  // Nothing may be pending on either device before the scenario is staged: a debounced push
  // landing later would either move the cloud under B's pull or be counted as B's PUT.
  await A.settle(); await B.settle();
  // Now give B readable copies of foreign-1/foreign-2 (as if B had them before A's copies went bad).
  await B.eval(`(async () => { for (const [id, text] of [["foreign-1", "secret one #tagone"], ["foreign-2", "secret two #tagtwo"]]) { state.unreadable = state.unreadable.filter((u) => u.id !== id); const e = { id, text, tags: extractTags(text), mentions: extractMentions(text), createdAt: "2026-01-01T00:00:00.000Z", editedAt: "2026-01-01T00:00:00.000Z", pinned: false }; state.entries.push(e); await putEntryRecord({ id, text: await encryptPlaintext(text, state.encryption.masterKey), tags: [], mentions: [], createdAt: e.createdAt, editedAt: e.editedAt, pinned: false }); } render(); return true; })()`);
  check((await B.entries()).length === 7 && (await B.unreadable()).length === 0, "B holds foreign-1/2 readable");
  const putsBefore = stub.puts;
  await B.pull();
  const hint = await B.hint();
  check(/Already up to date — the cloud has 2 blocks flagged unreadable that this browser can read; sending them now\./.test(hint), `B pull: "${hint}"`);
  check(await waitFor(() => stub.puts > putsBefore, 10000), "B pushed immediately (no edit needed)");
  const blob = await decryptBlob(stub.lastPut, rawKeyA);
  check(blob.length === 7 && blob.filter((e) => e.unreadable).length === 0 && blob.find((e) => e.id === "foreign-1").text === "secret one #tagone", "cloud now holds foreign-1/2 readable");
  // Replace must not touch B's readable copies when the cloud flags them: put A's old blob back and force a card.
  const healed = stub.blob;
  await B.settle(); // B's heal push has landed; nothing of B's may fire after A's forcing push below
  await A.add("extra from A"); await A.push();
  await A.settle(); // A's add also armed its debounced push; let it fire so the next PUT counted is B's
  const putsA = stub.puts;
  await B.pull();
  check(await waitFor(() => B.view().then((v) => v === "pull-conflict")), `B pull → card (${await B.view()})`);
  const title = await B.eval(`vaultOverlay.querySelector(".vault-title").textContent`);
  check(/The cloud has changes this browser doesn't/.test(title), `card is cloud-ahead ("${title}"), foreign-1/2 not listed as cloud changes`);
  console.log(`      pulled: ${JSON.stringify(await B.eval(`state.vaultPending.pullEntries.map((e) => e.id.slice(0, 9) + (e.unreadable ? "!" : ""))`))} | B: ${JSON.stringify(await B.eval(`state.entries.map((e) => e.id.slice(0, 9))`))}`);
  await B.click("replace");
  await waitFor(() => B.view().then((v) => v === null));
  check((await B.entries()).some((e) => e.id === "foreign-1" && e.text === "secret one #tagone") && (await B.unreadable()).length === 0, "after Replace: B still reads foreign-1/2");
  check(/kept 2 blocks the cloud can't read, sending them now/.test(await B.hint()), `replace hint: "${await B.hint()}"`);
  check(await waitFor(() => stub.puts > putsA, 10000) && (await decryptBlob(stub.lastPut, rawKeyA)).filter((e) => e.unreadable).length === 0, "B pushed readable copies after Replace");
  void healed;
}

// =============================================================================
console.log("\n--- U10 heal: cloud readable beats local unreadable (adopted on pull, no card)");
{
  await A.pull();
  check((await A.view()) === null, `A pull → no card (${await A.view()})`);
  check(/Already up to date — recovered 2 blocks from the cloud\./.test(await A.hint()), `A pull hint: "${await A.hint()}"`);
  check((await A.entries()).some((e) => e.id === "foreign-1" && e.text === "secret one #tagone") && (await A.unreadable()).length === 0 && !/unreadable/.test(await A.footer()), `A reads foreign-1/2; footer "${await A.footer()}"`);
  const raw = await A.raw();
  check(raw.filter((x) => x.unreadable).length === 0, "no flagged records left in A's store");
  await A.lock(); await A.unlock();
  check((await A.unreadable()).length === 0 && (await A.entries()).some((e) => e.id === "foreign-2"), "…and after lock/unlock");
}

// =============================================================================
console.log("\n--- U11 a device without the key stores flagged copies verbatim and carries them on");
const C = await device("C");
{
  const r3 = await A.plantForeign("foreign-3", "secret three #tagthree");
  await A.lock(); await A.unlock();
  await A.push();
  await C.port(rawKeyA);
  check((await C.unreadable()).length === 1 && (await C.raw()).find((x) => x.id === "foreign-3")?.text === r3 && (await C.raw()).find((x) => x.id === "foreign-3").unreadable === true, "C stored foreign-3 flagged, verbatim");
  check(!(await C.tags()).includes("tagthree"), "C indexed no ciphertext");
  await C.add("from C");
  await C.push();
  const blob = await decryptBlob(stub.lastPut, rawKeyA);
  check(blob.find((e) => e.id === "foreign-3")?.unreadable === true && blob.find((e) => e.id === "foreign-3").text === r3, "C's push carries foreign-3 flagged, unchanged");
  check((await C.footer()).endsWith("· 1 unreadable"), `C footer: ${await C.footer()}`);
}

// =============================================================================
console.log("\n--- U12 no ping-pong loss over five rounds");
{
  // B can read foreign-3? No — nobody can (it is under the foreign key). Give B a readable copy, then alternate.
  await B.eval(`(async () => { const id = "foreign-3", text = "secret three #tagthree"; state.unreadable = state.unreadable.filter((u) => u.id !== id); const e = { id, text, tags: extractTags(text), mentions: extractMentions(text), createdAt: "2026-01-03T00:00:00.000Z", editedAt: "2026-01-03T00:00:00.000Z", pinned: false }; state.entries.push(e); await putEntryRecord({ id, text: await encryptPlaintext(text, state.encryption.masterKey), tags: [], mentions: [], createdAt: e.createdAt, editedAt: e.editedAt, pinned: false }); render(); return true; })()`);
  let ok = true;
  for (let round = 1; round <= 5; round++) {
    await B.pull(); if ((await B.view()) === "pull-conflict") { await B.click("replace"); await waitFor(() => B.view().then((v) => v === null)); }
    await waitFor(() => B.eval(`cloudSyncTimer === null && !cloudSyncInFlight`), 10000);
    await B.push();
    const readableOnB = (await B.entries()).some((e) => e.id === "foreign-3" && e.text === "secret three #tagthree");
    await A.pull(); if ((await A.view()) === "pull-conflict") { await A.click("replace"); await waitFor(() => A.view().then((v) => v === null)); }
    await waitFor(() => A.eval(`cloudSyncTimer === null && !cloudSyncInFlight`), 10000);
    await A.push();
    const cloud = await decryptBlob(stub.lastPut, rawKeyA);
    const cloudReadable = cloud.find((e) => e.id === "foreign-3")?.unreadable !== true;
    if (!readableOnB || !cloudReadable) { ok = false; console.log(`      round ${round}: readableOnB=${readableOnB} cloudReadable=${cloudReadable}`); }
  }
  check(ok, "foreign-3 readable on B after every round; the cloud ends readable");
  check((await A.entries()).some((e) => e.id === "foreign-3" && e.text === "secret three #tagthree"), "A healed foreign-3 from B");
}

// =============================================================================
console.log("\n--- U3 413: the quota message names the unreadable count");
{
  await A.plantForeign("foreign-4", "secret four");
  await A.lock(); await A.unlock();
  stub.fail413 = true;
  const r = await A.push();
  check(r.status === "error" && r.reason === "http-413", `push → ${JSON.stringify(r)}`);
  const toast = await A.eval(`statusToast.textContent`);
  check(/your notes exceed the Worker's size limit \(1 unreadable block included\)/.test(toast), `toast: "${toast}"`);
  const tooltip = await A.eval(`syncIndicator.getAttribute("data-tooltip")`);
  check(/1 unreadable block included/.test(tooltip) && (await A.eval(`syncIndicator.querySelector(".sync-label").textContent`)) === "Sync: too large", `indicator: "${tooltip}"`);
  stub.fail413 = false;
}

// =============================================================================
console.log("\n--- U7 atomic /encrypt and /encrypt off under a crash (10 rounds)");
{
  let mixed = 0, offOrOn = { on: 0, off: 0 };
  for (let round = 0; round < 10; round++) {
    const D = await device(`D${round}`);
    await D.eval(`(async () => { for (let i = 0; i < 300; i++) await putEntryRecord({ id: "p-" + i, text: "plain block " + i + " with spaces", tags: [], mentions: [], createdAt: new Date().toISOString(), editedAt: new Date().toISOString(), pinned: false }); return true; })()`);
    await D.close(); await D.open();
    await D.cmd("/encrypt");
    await waitFor(() => D.view().then((v) => v === "setup"));
    await D.fill("pass", PASS); await D.fill("confirm", PASS); await D.click("submit");
    await waitFor(() => D.view().then((v) => v === "recovery-display"));
    await D.click("confirm"); // handleRecoveryConfirm starts: phase 1 (300 encrypts), then the transaction
    await waitFor(() => D.view().then((v) => v === "encrypting"), 3000).catch(() => {});
    await sleep(round * 6); // spread the crash across the window
    await D.crash();
    await D.open();
    const enabled = Boolean(await D.meta("enc-salt-pass"));
    const raw = await D.raw();
    const cipher = raw.filter((x) => /^[A-Za-z0-9+/]+={0,2}$/.test(x.text) && x.text.length % 4 === 0).length;
    const state = enabled ? (cipher === 300 ? "on" : "MIXED") : (cipher === 0 ? "off" : "MIXED");
    if (state === "MIXED") mixed++; else offOrOn[state]++;
    await D.close();
  }
  check(mixed === 0, `/encrypt crash rounds: on=${offOrOn.on} off=${offOrOn.off} mixed=${mixed}`);
  // /encrypt off in reverse
  mixed = 0; offOrOn = { on: 0, off: 0 };
  for (let round = 0; round < 10; round++) {
    const D = await device(`E${round}`);
    await D.eval(`(async () => { for (let i = 0; i < 300; i++) await putEntryRecord({ id: "p-" + i, text: "plain block " + i + " with spaces", tags: [], mentions: [], createdAt: new Date().toISOString(), editedAt: new Date().toISOString(), pinned: false }); return true; })()`);
    await D.close(); await D.open();
    await D.encryptSetup();
    await D.cmd("/encrypt off");
    await waitFor(() => D.view().then((v) => v === "disable-confirm"));
    await D.fill("pass", PASS); await D.click("submit");
    await waitFor(() => D.view().then((v) => v === "decrypting"), 5000).catch(() => {});
    await sleep(round * 5);
    await D.crash();
    await D.open();
    const enabled = Boolean(await D.meta("enc-salt-pass"));
    const raw = await D.raw();
    const cipher = raw.filter((x) => /^[A-Za-z0-9+/]+={0,2}$/.test(x.text) && x.text.length % 4 === 0).length;
    const state = enabled ? (cipher === 300 ? "on" : "MIXED") : (cipher === 0 ? "off" : "MIXED");
    if (state === "MIXED") mixed++; else offOrOn[state]++;
    await D.close();
  }
  check(mixed === 0, `/encrypt off crash rounds: on=${offOrOn.on} off=${offOrOn.off} mixed=${mixed}`);
}

console.log(`
${summary()}`);
ws.close(); server.close();
process.exit(failures ? 1 : 0);
