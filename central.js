/* Txtshell account (central sync) — the client half of the central protocol.
 *
 * Everything cryptographic for a Txtshell account happens in this file and in app.js; the
 * server only ever receives ciphertext, public keys, signatures and token hashes. It never
 * receives the PRF output, a KEK, the vault key, the recovery phrase or its entropy.
 *
 * FROZEN constants (docs in txtshell-central: phase-a-results.md, phase-c-results.md):
 *   PRF eval salt      SHA-256("txtshell-prf-v1")                        (public, app-scoped)
 *   KEK_prf            HKDF-SHA-256(PRF output, 16-byte per-credential salt, "txtshell-central-wrap-v1")
 *   KEK_recovery       HKDF-SHA-256(16-byte phrase entropy, per-user salt, "txtshell-central-recovery-v1")
 *   wrap container     IV(12) ‖ AES-GCM-wrapped raw VK (32) ‖ tag(16) = 60 bytes, standard base64
 *                      (byte-compatible with app.js's wrapMasterKey / unwrapMasterKey)
 *   phrase             BIP-39 English, 12 words = 128-bit entropy + 4-bit checksum; mnemonic↔entropy only
 *
 * This file is flow + crypto with no DOM: the cards live in app.js (renderVault) and are handed
 * in as callbacks. Classic script, global like app.js. Exposed as window.txCentral.
 */
(() => {
  "use strict";

  const enc = new TextEncoder();
  const HKDF_INFO_PRF = "txtshell-central-wrap-v1";
  const HKDF_INFO_RECOVERY = "txtshell-central-recovery-v1";
  const PRF_EVAL_CONTEXT = "txtshell-prf-v1";
  const WRAP_BYTES = 60;

  // ---------- small utils ----------
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64url = (buf) => b64(new Uint8Array(buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromB64url = (s) => fromB64(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const strip = (o) => JSON.parse(JSON.stringify(o)); // drops undefined keys
  const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

  class ApiError extends Error {
    constructor(method, path, status, code) {
      super(`${method} ${path} → ${status}${code ? ` ${code}` : ""}`);
      this.status = status;
      this.code = code || "";
    }
  }

  // Same-origin API: the account's API lives under the app's own origin (/v1/*). A 401 means
  // the session is gone (expired, signed out elsewhere, revoked) and is announced so the app
  // can drop it and show "sign in to resume".
  async function api(path, method, body, session) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (session) headers.Authorization = `Bearer ${session}`;
    const res = await fetch(`${window.location.origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (res.status === 401 && session) document.dispatchEvent(new CustomEvent("txcentral:session-lost", { detail: { reason: "401" } }));
    if (!res.ok) throw new ApiError(method, path, res.status, data.error);
    return data;
  }

  // ---------- keys: VK + wraps ----------
  async function kek(ikmBytes, saltBytes, info) {
    const ikm = await crypto.subtle.importKey("raw", ikmBytes, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: saltBytes, info: enc.encode(info) },
      ikm, { name: "AES-GCM", length: 256 }, false, ["wrapKey", "unwrapKey"]);
  }
  const kekFromPrf = (prfBytes, saltB64) => kek(prfBytes, fromB64(saltB64), HKDF_INFO_PRF);
  const kekFromEntropy = (entropy, saltB64) => kek(entropy, fromB64(saltB64), HKDF_INFO_RECOVERY);
  // A fresh VK, extractable so it can be wrapped; callers discard it after wrapping.
  const generateVK = () => crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

  async function wrapVK(vk, kekKey) {
    const iv = rand(12);
    const wrapped = new Uint8Array(await crypto.subtle.wrapKey("raw", vk, kekKey, { name: "AES-GCM", iv }));
    if (wrapped.length !== 48) throw new Error(`unexpected wrap length ${wrapped.length}`);
    const out = new Uint8Array(WRAP_BYTES); out.set(iv); out.set(wrapped, 12);
    return b64(out);
  }
  async function unwrapVK(blobB64, kekKey, extractable) {
    const bytes = fromB64(blobB64);
    if (bytes.length !== WRAP_BYTES) throw new Error(`wrap must be ${WRAP_BYTES} bytes, got ${bytes.length}`);
    return crypto.subtle.unwrapKey("raw", bytes.slice(12), kekKey, { name: "AES-GCM", iv: bytes.slice(0, 12) },
      { name: "AES-GCM", length: 256 }, extractable === true, ["encrypt", "decrypt"]);
  }
  // Display/test witness for "same VK" without exporting it. Never stored, never sent.
  async function witness(vk) {
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(12) }, vk, enc.encode("txtshell-vk-witness")));
    return Array.from(ct.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const keys = { kekFromPrf, kekFromEntropy, generateVK, wrapVK, unwrapVK, witness, newSalt: () => b64(rand(16)) };

  // ---------- phrase: BIP-39 mnemonic ↔ entropy ----------
  const WORDS = window.BIP39_ENGLISH;
  if (!Array.isArray(WORDS) || WORDS.length !== 2048) throw new Error("BIP-39 wordlist missing");
  const INDEX = new Map(WORDS.map((w, i) => [w, i]));
  const normalizeWord = (w) => w.normalize("NFKD").toLowerCase().trim();
  const splitWords = (text) => text.normalize("NFKD").toLowerCase().trim().split(/\s+/).filter(Boolean);
  async function checksumBits(entropy) {
    return (await sha256(entropy))[0] >> 4; // first 4 bits for 128-bit entropy
  }
  async function fromEntropy(entropy) {
    if (!(entropy instanceof Uint8Array) || entropy.length !== 16) throw new Error("entropy must be 16 bytes");
    const cs = await checksumBits(entropy);
    let bits = "";
    for (const b of entropy) bits += b.toString(2).padStart(8, "0");
    bits += cs.toString(2).padStart(4, "0");
    const words = [];
    for (let i = 0; i < 12; i++) words.push(WORDS[parseInt(bits.slice(i * 11, i * 11 + 11), 2)]);
    return words;
  }
  const generatePhrase = () => fromEntropy(rand(16));
  // Text → { entropy, words } or throws { code, word?, position? }. The checksum catches 15/16
  // typos before any network.
  async function toEntropy(text) {
    const words = splitWords(text);
    if (words.length !== 12) throw Object.assign(new Error(`That's ${words.length} words — it needs all 12.`), { code: "word-count" });
    let bits = "";
    words.forEach((w, i) => {
      const idx = INDEX.get(w);
      if (idx === undefined) throw Object.assign(new Error(`Word ${i + 1} ("${w}") doesn't look right. Check the spelling.`), { code: "unknown-word", word: w, position: i + 1 });
      bits += idx.toString(2).padStart(11, "0");
    });
    const entropy = new Uint8Array(16);
    for (let i = 0; i < 16; i++) entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    const cs = parseInt(bits.slice(128, 132), 2);
    if (cs !== await checksumBits(entropy)) throw Object.assign(new Error("One of those words is off. Check them against your saved copy."), { code: "checksum" });
    return { entropy, words };
  }
  const phrase = { generate: generatePhrase, fromEntropy, toEntropy, normalizeWord, splitWords, WORDS };

  // ---------- WebAuthn: register / login with PRF, and the offline assertion ----------
  const prfEvalSalt = () => sha256(enc.encode(PRF_EVAL_CONTEXT));

  // Browsers refuse a ceremony while the document is not focused (Chrome, Edge: "the page does
  // not have focus"; Safari: "The document is not focused"), and focus comes back a beat after a
  // passkey sheet closes. Wait for it, briefly, before every create()/get(). (Safari also needs a
  // user gesture per ceremony — that is why app.js puts each ceremony behind its own click.)
  function waitForFocus(ms = 3000) {
    if (document.hasFocus()) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; window.removeEventListener("focus", finish); document.removeEventListener("visibilitychange", finish); resolve(); };
      window.addEventListener("focus", finish);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && document.hasFocus()) finish(); });
      setTimeout(finish, ms);
    });
  }

  const signup = (email) => api("/v1/auth/signup", "POST", { email });
  const verifyEmail = (email, code) => api("/v1/auth/verify-email", "POST", { email, code });

  async function register(signupToken) {
    const o = await api("/v1/webauthn/register/options", "POST", { signupToken });
    const publicKey = {
      ...o,
      challenge: fromB64url(o.challenge),
      user: { ...o.user, id: fromB64url(o.user.id) },
      excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: fromB64url(c.id) })),
      extensions: { prf: {} },
    };
    await waitForFocus();
    const cred = await navigator.credentials.create({ publicKey });
    const ext = cred.getClientExtensionResults();
    const r = cred.response;
    const response = strip({
      id: cred.id, rawId: b64url(cred.rawId), type: cred.type, authenticatorAttachment: cred.authenticatorAttachment || undefined,
      clientExtensionResults: { prf: ext.prf ? { enabled: ext.prf.enabled === true } : undefined },
      response: {
        clientDataJSON: b64url(r.clientDataJSON), attestationObject: b64url(r.attestationObject),
        transports: r.getTransports ? r.getTransports() : undefined,
        publicKeyAlgorithm: r.getPublicKeyAlgorithm ? r.getPublicKeyAlgorithm() : undefined,
        publicKey: r.getPublicKey && r.getPublicKey() ? b64url(r.getPublicKey()) : undefined,
        authenticatorData: r.getAuthenticatorData ? b64url(r.getAuthenticatorData()) : undefined,
      },
    });
    const hkdfSalt = b64(rand(16));
    const v = await api("/v1/webauthn/register/verify", "POST", { signupToken, hkdfSalt, response });
    return { credentialId: v.credentialId, prfEnabled: ext.prf?.enabled === true, backedUp: v.backedUp === true, rpId: o.rp?.id || "" };
  }

  // Online sign-in: the server's challenge, a discoverable credential, PRF eval with the
  // frozen salt. The PRF output stays in this function's return value and is NEVER sent.
  // `allowCredentialIds` (base64url) narrows the ceremony to given credentials: a re-add signs in
  // with the passkey it just registered, never the removed one the authenticator may still hold.
  async function login({ allowCredentialIds } = {}) {
    const o = await api("/v1/webauthn/login/options", "POST", {});
    const publicKey = {
      challenge: fromB64url(o.challenge), rpId: o.rpId, timeout: o.timeout, userVerification: o.userVerification,
      allowCredentials: Array.isArray(allowCredentialIds) && allowCredentialIds.length
        ? allowCredentialIds.map((id) => ({ type: "public-key", id: fromB64url(id) }))
        : (o.allowCredentials || []).map((c) => ({ ...c, id: fromB64url(c.id) })),
      extensions: { prf: { eval: { first: fromB64url(o.extensions.prf.eval.first) } } },
    };
    await waitForFocus();
    const a = await navigator.credentials.get({ publicKey });
    const ext = a.getClientExtensionResults();
    const prf = ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : null;
    const r = a.response;
    // ZERO-KNOWLEDGE: prf.results is deliberately NOT copied into what goes to the server.
    const response = strip({
      id: a.id, rawId: b64url(a.rawId), type: a.type, authenticatorAttachment: a.authenticatorAttachment || undefined,
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(r.clientDataJSON), authenticatorData: b64url(r.authenticatorData), signature: b64url(r.signature),
        userHandle: r.userHandle ? b64url(r.userHandle) : undefined,
      },
    });
    let v;
    try {
      v = await api("/v1/webauthn/login/verify", "POST", { response });
    } catch (e) {
      // Which credential the server refused: app.js compares it to the one it cached to tell
      // "this device was removed" from "a different passkey was picked".
      if (e instanceof ApiError) e.credentialId = a.id;
      throw e;
    }
    if (!prf || prf.length !== 32) throw Object.assign(new Error("no PRF output from this passkey"), { code: "no-prf" });
    return { prf, session: v.sessionToken, credentialId: v.credentialId, hkdfSalt: v.hkdfSalt, userId: v.userId, email: typeof v.email === "string" ? v.email : "", hasPrfWrap: v.hasPrfWrap === true, hasRecovery: v.hasRecovery === true, rpId: o.rpId };
  }

  // Offline unlock: no server. A client-generated challenge, this device's credential only, the
  // same frozen PRF salt (public, so the client can supply it). PRF output is deterministic per
  // credential and salt, so the KEK it yields is the one that made the cached wrap. No session.
  async function assertOffline({ credentialId, rpId }) {
    const publicKey = {
      challenge: rand(32), rpId, userVerification: "required",
      allowCredentials: [{ type: "public-key", id: fromB64url(credentialId) }],
      extensions: { prf: { eval: { first: await prfEvalSalt() } } },
    };
    await waitForFocus();
    const a = await navigator.credentials.get({ publicKey });
    const ext = a.getClientExtensionResults();
    const prf = ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : null;
    if (!prf || prf.length !== 32) throw Object.assign(new Error("no PRF output from this passkey"), { code: "no-prf" });
    return { prf };
  }
  // Tell the browser's passkey store that a credential is unknown to this site (revoked), so it
  // stops offering it. Best effort: not every browser has it, and nothing depends on it.
  async function signalUnknownCredential(rpId, credentialId) {
    try {
      if (window.PublicKeyCredential && typeof PublicKeyCredential.signalUnknownCredential === "function") {
        await PublicKeyCredential.signalUnknownCredential({ rpId, credentialId });
      }
    } catch { /* advisory only */ }
  }
  const webauthn = { signup, verifyEmail, register, login, assertOffline, waitForFocus, signalUnknownCredential };

  // ---------- ladder: bootstrap | rung 1 | rung 2 | abandon ----------
  // ctx: { session, kekWrap, hasPrfWrap, hasRecovery, vk? }
  //   vk: an EXTRACTABLE existing key to adopt as VK at bootstrap (an install's passphrase master
  //       key — plan §6.1); absent → a fresh VK is generated.
  // ui:  { forcedSave(words, { kind: "signup" | "abandon" | "rotate" }) → Promise<void>,
  //        askPhrase(errorText) → Promise<{ kind: "phrase", entropy } | { kind: "abandoned" }>,
  //        note?(text) }
  // Resolves to { vk (non-extractable), prfWrap (this credential's 60-byte wrap), via }.
  // via: "bootstrap" | "rung1" | "rung2" | "abandon"; `abandoned: true` when the vault was reset.
  async function bootstrap(ctx, ui, { afterAbandon } = {}) {
    const vkX = ctx.vk || await generateVK();                         // extractable only for this step
    const words = await generatePhrase();
    const { entropy } = await toEntropy(words.join(" "));
    const salt = keys.newSalt();
    const kekRec = await kekFromEntropy(entropy, salt);
    const prfWrap = await wrapVK(vkX, ctx.kekWrap);
    const recWrap = await wrapVK(vkX, kekRec);
    try {
      await api("/v1/keys/bootstrap", "POST", { prf: { blob: prfWrap }, recovery: { blob: recWrap, hkdfSalt: salt } }, ctx.session);
    } catch (e) {
      if (e.code === "keys-exist") return null;                     // another device won; the caller falls through to rung 1/2
      throw e;
    }
    await ui.forcedSave(words, { kind: afterAbandon ? "abandon" : "signup" });   // the copy lives in app.js
    return { vk: await unwrapVK(prfWrap, ctx.kekWrap, false), prfWrap, via: afterAbandon ? "abandon" : "bootstrap", abandoned: afterAbandon === true };
  }

  async function rung2(ctx, ui) {
    let lastError = "";
    for (;;) {
      const answer = await ui.askPhrase(lastError);
      lastError = "";
      if (answer.kind === "abandoned") {
        const out = await bootstrap({ ...ctx, vk: null }, ui, { afterAbandon: true });
        if (out) return out;
        continue;                                                     // raced; ask again
      }
      let rec;
      try { rec = await api("/v1/keys/recovery", "GET", undefined, ctx.session); }
      catch (e) { if (e.status === 404) { const out = await bootstrap(ctx, ui); if (out) return out; continue; } throw e; }
      const kekRec = await kekFromEntropy(answer.entropy, rec.hkdfSalt);
      let vkX;
      try { vkX = await unwrapVK(rec.blob, kekRec, true); }
      catch { lastError = "These aren't the 12 words for this account. If you got new words, use the newest ones."; continue; }   // GCM tag = the check; nothing written
      const prfWrap = await wrapVK(vkX, ctx.kekWrap);
      await api("/v1/keys/prf", "PUT", { blob: prfWrap }, ctx.session);
      return { vk: await unwrapVK(prfWrap, ctx.kekWrap, false), prfWrap, via: "rung2" };
    }
  }

  async function run(ctx, ui) {
    if (!ctx.hasRecovery) {
      const out = await bootstrap(ctx, ui);
      if (out) return out;
    }
    try {
      const { blob } = await api("/v1/keys/prf", "GET", undefined, ctx.session);
      return { vk: await unwrapVK(blob, ctx.kekWrap, false), prfWrap: blob, via: "rung1" };     // rung 1
    } catch (e) {
      if (e.status !== 404 && e.name !== "OperationError") throw e;  // anything else is a real error
    }
    return rung2(ctx, ui);                                            // rung 2
  }

  // Abandon from the rung-2 fork: the server forgets the vault; the caller bootstraps anew.
  const abandon = (session, confirmEmail) => api("/v1/vault/abandon", "POST", { confirm: confirmEmail }, session);

  // Rotate the recovery phrase: VK (extractable for the moment) under a new phrase; the old
  // phrase is dead the instant the PUT lands.
  async function rotate({ session, vkExtractable }, ui) {
    const words = await generatePhrase();
    const { entropy } = await toEntropy(words.join(" "));
    const salt = keys.newSalt();
    const recWrap = await wrapVK(vkExtractable, await kekFromEntropy(entropy, salt));
    await api("/v1/keys/recovery", "PUT", { blob: recWrap, hkdfSalt: salt }, session);
    await ui.forcedSave(words, { kind: "rotate" });
  }

  const ladder = { run, bootstrap, rung2, abandon, rotate };

  // ---------- devices / sessions ----------
  const devices = {
    list: (session) => api("/v1/devices", "GET", undefined, session).then((d) => d.devices || []),
    revoke: (session, credentialId) => api(`/v1/devices/${credentialId}`, "DELETE", undefined, session),
    signOut: (session) => api("/v1/sessions/current", "DELETE", undefined, session),
    prfWrap: (session) => api("/v1/keys/prf", "GET", undefined, session).then((d) => d.blob),
  };

  window.txCentral = { api, ApiError, keys, phrase, webauthn, ladder, devices, PRF_EVAL_CONTEXT, b64, fromB64 };
})();
