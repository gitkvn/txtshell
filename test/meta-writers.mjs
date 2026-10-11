// Gate: vault meta has exactly the writers it had before the Txtshell account landed, plus
// rekeyVault. Central mode entering state.encryption.masterKey must not add a path that writes
// vault meta outside rekeyVault's transaction.
//
//   node test/meta-writers.mjs
//
// Static: every call that writes IndexedDB meta (saveMeta, saveMetaBatch, deleteMeta, and the
// raw metaStore.put/delete inside rekeyVault) is located, its enclosing top-level function
// found, and — when the call's argument text names a vault meta key constant — checked against
// the allowlist below. Draft/theme/sync-url rows are not vault meta and are not checked.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const lines = src.split("\n");

// Vault meta: everything that describes how the vault is locked and under which key/mode.
const VAULT_META = [
  "ENC_SALT_PASS_KEY", "ENC_SALT_RECOVERY_KEY", "ENC_WRAPPED_PASS_KEY", "ENC_WRAPPED_RECOVERY_KEY",
  "ENC_VERIFY_KEY", "ENC_ITERATIONS_PASS_KEY", "ENC_ITERATIONS_RECOVERY_KEY",
  "ENC_UNLOCK_FAIL_COUNT", "ENC_UNLOCK_LOCKED_UNTIL", "ENC_UNLOCK_ESCALATION",
  "ENC_MODE_KEY", "CENTRAL_URL_KEY", "CENTRAL_CREDENTIAL_ID_KEY", "CENTRAL_HKDF_SALT_KEY", "CENTRAL_PRF_WRAP_KEY", "CENTRAL_RP_ID_KEY",
  "CENTRAL_PASSPHRASE_ROWS", "CENTRAL_ROWS",
  '"enc-', '"central-',
];

// The writers that existed before Phase D, each a same-key wrap rewrite or the lockout counters,
// plus rekeyVault (the only writer for a key or mode change). Nothing else may write vault meta.
const ALLOWED = {
  rekeyVault: "the one transaction for key/mode changes (records + meta, or meta only)",
  handleChangeNewSubmit: "pre-existing: /encrypt change re-wraps the same key under a new passphrase",
  migratePassphraseWrap: "pre-existing: PBKDF2 iteration migration on unlock (same key)",
  migrateRecoveryWrap: "pre-existing: PBKDF2 iteration migration on unlock (same key)",
  handlePortPassphraseSubmit: "pre-existing: /port writes the pairing's wrap (fresh install only)",
  recordUnlockFailure: "pre-existing: lockout counters on the unlock path",
  resetUnlockState: "pre-existing: lockout counters on the unlock path",
};

function enclosingFunction(lineIndex) {
  for (let i = lineIndex; i >= 0; i--) {
    const m = lines[i].match(/^(?:async )?function ([A-Za-z0-9_]+)\(/);
    if (m) return m[1];
    if (/^(const|let|document\.addEventListener)\b/.test(lines[i]) && i !== lineIndex) return `(top-level near line ${i + 1})`;
  }
  return "(unknown)";
}

// A call's argument text: from the opening paren to its matching close, across lines.
function callText(lineIndex, col) {
  let depth = 0; let out = "";
  for (let i = lineIndex; i < lines.length; i++) {
    const text = i === lineIndex ? lines[i].slice(col) : lines[i];
    for (const ch of text) {
      out += ch;
      if (ch === "(") depth++;
      if (ch === ")") { depth--; if (depth === 0) return out; }
    }
    out += "\n";
  }
  return out;
}

let failures = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) failures++; };

const writers = new Map(); // function → [line numbers]
const pattern = /\b(saveMeta|saveMetaBatch|deleteMeta|metaStore\.put|metaStore\.delete)\s*\(/g;
for (let i = 0; i < lines.length; i++) {
  let m;
  while ((m = pattern.exec(lines[i]))) {
    if (/^\s*(\/\/|\*)/.test(lines[i])) continue; // comment
    const fn = enclosingFunction(i);
    const text = callText(i, m.index + m[0].length - 1);
    const namesVaultMeta = VAULT_META.some((k) => text.includes(k));
    // Inside rekeyVault the keys are data (metaPuts/metaDeletes), so every raw put/delete there is a vault-meta writer.
    if (!namesVaultMeta && fn !== "rekeyVault") continue;
    if (!writers.has(fn)) writers.set(fn, []);
    writers.get(fn).push(i + 1);
  }
}

console.log("--- vault meta writers found");
for (const [fn, where] of writers) console.log(`      ${fn.padEnd(30)} lines ${where.join(", ")}${ALLOWED[fn] ? "" : "   <-- NOT ALLOWED"}`);
for (const [fn] of writers) check(Boolean(ALLOWED[fn]), `${fn} may write vault meta (${ALLOWED[fn] || "no — a new writer outside rekeyVault"})`);
check(writers.has("rekeyVault"), "rekeyVault is a writer (metaStore.put/delete inside its one transaction)");

// Every central flow writes meta ONLY through rekeyVault: no saveMeta/saveMetaBatch/deleteMeta
// call anywhere mentions a central-* or enc-mode key.
const centralDirect = [];
for (let i = 0; i < lines.length; i++) {
  if (/\b(saveMeta|saveMetaBatch|deleteMeta)\s*\(/.test(lines[i]) && /(CENTRAL_|ENC_MODE_KEY|"central-|"enc-mode")/.test(callText(i, lines[i].search(/\b(saveMeta|saveMetaBatch|deleteMeta)\s*\(/) + lines[i].match(/\b(saveMeta|saveMetaBatch|deleteMeta)\s*\(/)[0].length - 1))) centralDirect.push(i + 1);
}
check(centralDirect.length === 0, `no direct saveMeta/saveMetaBatch/deleteMeta of a central row${centralDirect.length ? ` (lines ${centralDirect.join(", ")})` : ""}`);

// And the callers of rekeyVault are exactly: the three pre-existing loops + the Phase D flows.
const callers = new Map();
for (let i = 0; i < lines.length; i++) {
  if (/\brekeyVault\(/.test(lines[i]) && !/^(async )?function rekeyVault/.test(lines[i]) && !/^\s*\/\//.test(lines[i])) {
    const fn = enclosingFunction(i);
    callers.set(fn, (callers.get(fn) || 0) + 1);
  }
}
console.log("--- rekeyVault callers");
for (const [fn, n] of callers) console.log(`      ${fn} ×${n}`);
// settleCentralKey is the tail shared by the unlock and the lock-screen re-add (it took over
// handleCentralUnlock's writes); writeCentralFlags writes the two flag rows (`central-removed`,
// `central-readd-credential-id`) through the same transaction instead of a bare saveMeta.
// applyReKeyOrDeadEnd is the different-key tail (re-key or the dead end), shared by the unlock and
// the re-add; settleCentralKey keeps the same-VK meta swap.
const EXPECTED_CALLERS = ["handleRecoveryConfirm", "handleDisableSubmit", "handleImportAdoptVault", "centralJoin", "settleCentralKey", "applyReKeyOrDeadEnd", "writeCentralFlags", "centralResume", "handleAccountLeaveSubmit"];
check(EXPECTED_CALLERS.every((fn) => callers.has(fn)) && [...callers.keys()].every((fn) => EXPECTED_CALLERS.includes(fn)), `rekeyVault callers are exactly ${EXPECTED_CALLERS.join(", ")}`);

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILURE(S)"} · nothing skipped`);
process.exit(failures ? 1 : 0);
