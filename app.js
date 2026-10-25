const DB_NAME = "txtshell";
const DB_VERSION = 1;
const ENTRY_STORE = "entries";
const META_STORE = "meta";
const DRAFT_KEY = "draft";
// Unsaved new-block text displaced by a reopen (see stashComposerDraft).
const DRAFT_STASH_KEY = "draft-stash";
const THEME_KEY = "txtshell-theme-v1";
const WORD_COUNT_KEY = "txtshell-word-count-v1";
const EDITOR_FONT_SIZE_KEY = "txtshell-editor-font-size";
const SYM_RECENT_KEY = "txtshell-sym-recent-v1";
const SYM_RECENT_MAX = 10;
const EDITOR_FONT_SIZE_MIN = 11;
const EDITOR_FONT_SIZE_MAX = 24;

const ENC_SALT_PASS_KEY = "enc-salt-pass";
const ENC_SALT_RECOVERY_KEY = "enc-salt-recovery";
const ENC_WRAPPED_PASS_KEY = "enc-wrapped-pass";
const ENC_WRAPPED_RECOVERY_KEY = "enc-wrapped-recovery";
const ENC_VERIFY_KEY = "enc-verify";
const ENC_ITERATIONS_PASS_KEY = "enc-iterations-pass";
const ENC_ITERATIONS_RECOVERY_KEY = "enc-iterations-recovery";
const ENC_UNLOCK_FAIL_COUNT = "enc-unlock-fail-count";
const ENC_UNLOCK_LOCKED_UNTIL = "enc-unlock-locked-until";
const ENC_UNLOCK_ESCALATION = "enc-unlock-escalation";
// Txtshell account (central) vault mode. `enc-mode` absent = passphrase vault.
const ENC_MODE_KEY = "enc-mode";
const CENTRAL_URL_KEY = "central-url";
const CENTRAL_CREDENTIAL_ID_KEY = "central-credential-id";
const CENTRAL_HKDF_SALT_KEY = "central-hkdf-salt";
const CENTRAL_PRF_WRAP_KEY = "central-prf-wrap"; // this device's 60-byte wrap of VK, sealed under its passkey's KEK
const CENTRAL_RP_ID_KEY = "central-rp-id"; // the rpId the server named at sign-in, cached for the offline ceremony
// Set the moment this device is told its passkey was removed from the account (`unknown-credential`
// for the cached credential). While set, the lock screen is the removed card and the cached wrap is
// not used, online or offline (plan §8). A product fact, not a security boundary.
const CENTRAL_REMOVED_KEY = "central-removed";
// The credential registered by a re-add that has not finished yet (crash or failure between the
// registration and the settled key): the next sign-in uses exactly it, never the removed one.
const CENTRAL_READD_CREDENTIAL_KEY = "central-readd-credential-id";
const CENTRAL_PASSPHRASE_ROWS = [
  ENC_SALT_PASS_KEY, ENC_SALT_RECOVERY_KEY, ENC_WRAPPED_PASS_KEY, ENC_WRAPPED_RECOVERY_KEY,
  ENC_ITERATIONS_PASS_KEY, ENC_ITERATIONS_RECOVERY_KEY, ENC_UNLOCK_FAIL_COUNT, ENC_UNLOCK_LOCKED_UNTIL, ENC_UNLOCK_ESCALATION,
];
const CENTRAL_ROWS = [ENC_MODE_KEY, CENTRAL_URL_KEY, CENTRAL_CREDENTIAL_ID_KEY, CENTRAL_HKDF_SALT_KEY, CENTRAL_PRF_WRAP_KEY, CENTRAL_RP_ID_KEY, CENTRAL_REMOVED_KEY, CENTRAL_READD_CREDENTIAL_KEY];
const ENC_VERIFY_PLAINTEXT = "txtshell-verify-v1";
const SYNC_WORKER_URL_KEY = "sync-worker-url";
const SYNC_AUTH_TOKEN_KEY = "sync-auth-token";
const CLOUD_SYNC_DEBOUNCE_MS = 1000; // coalesce rapid sequential saves into one upload
const CLOUD_SYNC_TIMEOUT_MS = 15000; // abort a stuck upload; local save is already canonical
const CLOUD_MAX_RESPONSE_BYTES = 64 * 1024 * 1024; // refuse absurd payloads from a misbehaving server
const PULL_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000; // wall-clock gaps below this can't distinguish stale-cloud from device clock skew
const PBKDF2_ITERATIONS = 600000;
const LEGACY_PBKDF2_ITERATIONS = 100000;
const MIN_IMPORT_ITERATIONS = LEGACY_PBKDF2_ITERATIONS; // 100000 — reject weaker imported KDF params
const MAX_IMPORT_ENTRIES = 100000; // covers any realistic use case
const MAX_IMPORT_ENTRY_TEXT = 200000; // 200K chars per entry, far above any real block
const LOCKOUT_THRESHOLD = 5; // consecutive passphrase failures before the first lockout
const LOCKOUT_DURATIONS_MS = [
  5 * 60 * 1000,       // escalation 0 -> 5 min
  15 * 60 * 1000,      // escalation 1 -> 15 min
  60 * 60 * 1000,      // escalation 2 -> 1 hour
  4 * 60 * 60 * 1000,  // escalation 3+ -> 4 hours
];

const RE_TAGS = /(^|\s)#([a-z0-9_-]+)/g;
const RE_MENTIONS = /(^|\s)@([a-z0-9_-]+)/g;
const RE_EDITOR_TOKEN = /(^|\s)([#@][a-z0-9_-]*)$/i;
const RE_WHITESPACE = /\s+/;
const RE_URL = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;

const HINTS_KEY = "txtshell-hints-v1";
const HINT_DELAY = 800;

const INTRO_KEY = "txtshell-intro-seen-v1"; // must match intro-boot.js
const INTRO_FADE_MS = 220; // must match the .intro-overlay opacity transition
const QUICK_START_KEY = "txtshell-quickstart-seen-v1"; // first-run hint bar shown once

// Quick start cards. Static, trusted markup -- rendered one step at a time into
// #quickStartCard. Every gesture here is a real binding; keep in sync with the
// composer keydown handler, the search-mode card actions, and /q.
const QUICK_START_STEPS = [
  {
    title: "Write a block",
    body: `<p>Just start typing. A block is one note — no title, no formatting, no folders. A line or a page, it's one block until you save it.</p>`,
  },
  {
    title: "Save it",
    body: `<p>Press <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>⏎</kbd>, or tap <strong>Save block</strong> below the editor.</p>
<p>Stored instantly — on your device, never on a server. <code>/encrypt</code> locks it with a passphrase.</p>`,
  },
  {
    title: "Find anything",
    body: `<p>Type <code>/</code> for commands — <code>/w</code> shows this week's blocks.</p>
<p>Or type a word followed by <code>//</code> and press <kbd>⏎</kbd> to search for it. Instant, and it never leaves your device.</p>`,
  },
  {
    title: "Edit & re-save",
    body: `<p>In search, hit <strong>Edit</strong> on any block — or select it and press <kbd>Shift</kbd> + <kbd>⏎</kbd> — to open it in the editor. Change it, then <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>⏎</kbd> saves the update.</p>
<p>Power move: after a <code>term//</code> search, <kbd>Shift</kbd> + <kbd>⏎</kbd> reopens the top match straight away.</p>
<p class="quick-start-note"><code>/about</code> or <code>/q</code> reopens this quick start.</p>`,
  },
];

const DRAFT_SAVE_DELAY = 180;
const DELETE_UNDO_TIMEOUT = 10000;
const COPY_FLASH_DURATION = 900;
const DELETE_CONFIRM_TIMEOUT = 2000;
const TOAST_DURATION = 3000;
const HINT_TOAST_DURATION = 6000;

const COMPOSER_PLACEHOLDER_EMPTY = "Type /about and press enter to get started. Cmd/Ctrl+Enter saves a block. Use the Esc key anytime to come back here.";
const COMPOSER_PLACEHOLDER_HAS_BLOCKS = "Type a block, or / for commands. Cmd/Ctrl+Enter saves a block. Use the Esc key anytime to come back here.";
// Touch devices: Return is a new line, saving is the Save block button, and there is no Esc key.
const COMPOSER_PLACEHOLDER_EMPTY_TOUCH = "Type /about and tap return to get started. Tap Save block to keep what you write.";
const COMPOSER_PLACEHOLDER_HAS_BLOCKS_TOUCH = "Type a block, or / for commands. Tap Save block to keep it.";

const SLASH_COMMANDS = [
  { name: "/about", description: "First-time user guide" },
  { name: "/encrypt", description: "Encrypt your notes with a passphrase" },
  { name: "/encrypt change", description: "Change your encryption passphrase" },
  { name: "/encrypt off", description: "Remove encryption and restore plaintext" },
  { name: "/wipe", description: "Delete every block on this device" },
  { name: "/export", description: "Download an encrypted backup of your blocks" },
  { name: "/export plain", description: "Download an unencrypted plaintext backup" },
  { name: "/import", description: "Restore blocks from a JSON export" },
  { name: "/lock", description: "Lock your notes" },
  { name: "/pin", description: "Show only pinned blocks" },
  { name: "/q", description: "Open the full shortcut reference" },
  { name: "/re", description: "Reopen your most recent block" },
  { name: "/t", description: "Show blocks saved today" },
  { name: "/ta", description: "Show blocks created or edited today" },
  { name: "/otd", description: "On this day: blocks from today's date in earlier months and years" },
  { name: "/w", description: "Show blocks saved during the last week" },
  { name: "/wa", description: "Show blocks created or edited in the last 7 days" },
  { name: "/y", description: "Show blocks saved yesterday" },
  { name: "/ya", description: "Show blocks created or edited yesterday" },
  { name: "/mirror", description: "Show a pairing QR to link an iOS device" },
  { name: "/sync setup", description: "Set the sync Worker URL and auth token" },
  { name: "/port", description: "Set up this browser using pairing data from another browser" },
  { name: "/pull", description: "Get the latest notes from the cloud" },
  { name: "/account", description: "Txtshell sync: sign in, or set it up on this device" },
  { name: "/account devices", description: "Devices on your account; remove one" },
  { name: "/account phrase", description: "Get new 12 words (the current ones stop working)" },
  { name: "/account signout", description: "Sign out and lock this device; your notes stay here" },
  { name: "/account leave", description: "Stop syncing this device; keep its notes here with a passphrase" },
  { name: "/inbox", description: "Triage captures synced from your phone" },
  { name: "/font", description: "Set note font size in px (11–24, default 14); /font reset restores default" },
  { name: "/sym", description: "Chemistry & math symbol palette (₂ → Δ ²⁺); ;; toggles it anywhere" },
];
const SLASH_COMMAND_NAMES = new Set(SLASH_COMMANDS.map((cmd) => cmd.name));
// Commands that accept an argument after a space ("/font 12"). Their Enter
// handling matches on the first token instead of the whole value.
const ARG_COMMANDS = new Set(["/font"]);

const state = {
  db: null,
  entries: [],
  searchMode: false,
  search: "",
  preset: null,
  editingEntryId: null,
  stashedDraft: null,
  selectedEntryId: null,
  pendingDeletedEntries: null,
  selectedSuggestionIndex: 0,
  editorSelectedSuggestionIndex: 0,
  commandPaletteIndex: 0,
  commandPaletteDismissed: false,
  encryption: {
    enabled: false,
    unlocked: false,
    masterKey: null,
    // "passphrase" (the vault as it has always been) or "central" (a Txtshell
    // account: the key is the account's vault key, unlocked with a passkey).
    // Decided once in initialize() from the `enc-mode` meta row; absent means
    // passphrase, so every existing install reads exactly as before.
    mode: "passphrase",
  },
  // Txtshell account session. Memory only — a reload locks the vault and the
  // online unlock is itself a sign-in. Nothing here is ever written to storage.
  central: {
    session: null,
    userId: null,
    credentialId: null,
    // Set after a join that re-keyed local blocks: the next pull that finds the
    // cloud different shows the first-join card (merge) instead of the
    // stale-copy card, because the two histories are unrelated.
    firstJoin: false,
    // Mirrors the `central-removed` row (read in initialize(), set when told, cleared by a re-add).
    removed: false,
    // Mirrors `central-readd-credential-id` (a re-add that registered but did not settle).
    readdCredentialId: null,
    // Failed unlock ceremonies since the vault locked; two promote "use your 12 words" to a button.
    unlockFailures: 0,
    // This lock came from signing out (in memory: a reload, or the next unlock, clears it).
    signedOut: false,
    // The account's address, from the last sign-in (plan §17.3). Memory only, like the session.
    email: null,
  },
  // Records in IndexedDB that the current key cannot open (see
  // decryptAllEntriesIntoState). Kept out of `entries` so they are never
  // rendered, indexed or edited; kept in memory so they travel with the vault
  // (sync blob, exports) instead of being silently dropped. Memory-only.
  unreadable: [],
  vaultView: null,
  vaultPending: null,
  targetCount: null,
  counterAutoShown: false,
  selectedEntries: new Set(),
};

const composerForm = document.querySelector("#composerForm");
const entryInput = document.querySelector("#entryInput");
const editorSuggestions = document.querySelector("#editorSuggestions");
const commandPalette = document.querySelector("#commandPalette");
const symPalette = document.querySelector("#symPalette");
const entryList = document.querySelector("#entryList");
const searchInput = document.querySelector("#searchInput");
const searchInputLabel = document.querySelector("#searchInputLabel");
const searchSuggestions = document.querySelector("#searchSuggestions");
const searchMode = document.querySelector("#searchMode");
const searchModeLabel = document.querySelector("#searchModeLabel");
const quickReference = document.querySelector("#quickReference");
const aboutGuide = document.querySelector("#aboutGuide");
const introOverlay = document.querySelector("#introOverlay");
const introStartButton = document.querySelector("#introStartButton");
const introReplayButton = document.querySelector("#introReplayButton");
const quickStartOverlay = document.querySelector("#quickStartOverlay");
const quickStartBackdrop = document.querySelector("#quickStartBackdrop");
const quickStartCard = document.querySelector("#quickStartCard");
const quickStartHint = document.querySelector("#quickStartHint");
const quickStartHintLink = document.querySelector("#quickStartHintLink");
const quickStartHintClose = document.querySelector("#quickStartHintClose");
const quickStartLinkAbout = document.querySelector("#quickStartLinkAbout");
const quickStartLinkHelp = document.querySelector("#quickStartLinkHelp");
const savedCount = document.querySelector("#savedCount");
const syncIndicator = document.querySelector("#syncIndicator");
const wordCountDisplay = document.querySelector("#wordCountDisplay");
const exportButton = document.querySelector("#exportButton");
const shortcutsLink = document.querySelector("#shortcutsLink");
const searchUndoDeleteButton = document.querySelector("#searchUndoDeleteButton");
const closeSearchButton = document.querySelector("#closeSearchButton");
const statusToast = document.querySelector("#statusToast");
const wordCountToggleButton = document.querySelector("#wordCountToggleButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const pinnedButton = document.querySelector("#pinnedButton");
const pinnedPanel = document.querySelector("#pinnedPanel");
const composerHint = document.querySelector("#composerHint");
const currentDateTime = document.querySelector("#currentDateTime");
const entryTemplate = document.querySelector("#entryTemplate");
const vaultOverlay = document.querySelector("#vaultOverlay");
const inboxView = document.querySelector("#inboxView");
const inboxList = document.querySelector("#inboxList");
const inboxViewSubtitle = document.querySelector("#inboxViewSubtitle");
const inboxCloseButton = document.querySelector("#inboxCloseButton");
const lockButton = document.querySelector("#lockButton");
const syncButton = document.querySelector("#syncButton");
const saveDock = document.querySelector("#saveDock");
const saveBlockBtn = document.querySelector("#saveBlockBtn");
const findReplaceBar = document.querySelector("#findReplaceBar");
const findInput = document.querySelector("#findInput");
const replaceInput = document.querySelector("#replaceInput");
const findReplaceCount = document.querySelector("#findReplaceCount");
const findReplaceReplaceButton = document.querySelector("#findReplaceReplaceButton");
const findReplaceReplaceAllButton = document.querySelector("#findReplaceReplaceAllButton");
const findReplaceCloseButton = document.querySelector("#findReplaceCloseButton");
const copySelectedButton = document.querySelector("#copySelectedButton");
const mergeSelectedButton = document.querySelector("#mergeSelectedButton");
const mergeModal = document.querySelector("#mergeModal");
const mergeModalBackdrop = document.querySelector("#mergeModalBackdrop");
const mergeModalForm = document.querySelector("#mergeModalForm");
const mergeModalTitle = document.querySelector("#mergeModalTitle");
const mergeOpeningInput = document.querySelector("#mergeOpeningInput");
const mergeCancelButton = document.querySelector("#mergeCancelButton");
const deleteSelectedButton = document.querySelector("#deleteSelectedButton");
const deleteModal = document.querySelector("#deleteModal");
const deleteModalBackdrop = document.querySelector("#deleteModalBackdrop");
const deleteModalForm = document.querySelector("#deleteModalForm");
const deleteModalTitle = document.querySelector("#deleteModalTitle");
const deleteCancelButton = document.querySelector("#deleteCancelButton");
function setEditorValue(value) {
  entryInput.value = value;
  updateWordCount();
  updateEditorOverscroll();
}

let draftSaveTimer = null;
let deleteUndoTimer = null;
let statusToastTimer = null;

window.addEventListener("load", () => {
  if (state.vaultView) {
    return;
  }
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
  revealComposerCaret();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    return;
  }
  if (state.vaultView === "unlock") {
    renderVault();
    return;
  }
  if (state.vaultView) {
    return;
  }
  entryInput.focus();
});

window.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (state.vaultView) {
    return;
  }

  if (target.closest("#searchMode, .copy-button, #searchInput, #editorSuggestions, #commandPalette, #vaultOverlay, #lockButton, #syncButton, #findReplaceBar, #mergeModal, #deleteModal, #pinnedPanel, #pinnedButton")) {
    return;
  }

  window.requestAnimationFrame(() => entryInput.focus());
});

composerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitComposer();
});

// Extension capture channel. Every capture gets an explicit result message so
// the extension can queue anything that didn't land (vault locked, page not yet
// initialised) instead of assuming postMessage == saved — a capture posted into
// a locked tab used to be dropped silently. Captures that arrive while locked
// are held in memory and saved on unlock (covers old extension builds that
// don't queue on a "locked" result); a reload loses the hold, which is why the
// extension also queues on its side. Nonces dedupe the two paths.
const MAX_HELD_CAPTURES = 500;
const MAX_REMEMBERED_CAPTURE_NONCES = 2000;
let heldCaptures = [];
const deliveredCaptureNonces = new Set();

function replyCaptureResult(nonce, ok, reason, id) {
  const result = { type: "txtshell_capture_result", ok, reason };
  if (typeof nonce === "string") result.nonce = nonce;
  if (id) result.id = id;
  window.postMessage(result, window.location.origin);
}

function rememberCaptureNonce(nonce) {
  if (typeof nonce !== "string") return;
  deliveredCaptureNonces.add(nonce);
  if (deliveredCaptureNonces.size > MAX_REMEMBERED_CAPTURE_NONCES) {
    deliveredCaptureNonces.delete(deliveredCaptureNonces.values().next().value);
  }
}

function captureTextFromPayload(data) {
  const note = typeof data.note === "string" ? data.note.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const parts = [];
  if (note) {
    parts.push(note);
  }
  if (title) {
    parts.push(note ? `\n${title}` : title);
  }
  if (url) {
    parts.push(url);
  }
  return parts.join("\n");
}

// Saves one capture payload into the unlocked vault. Returns the result that
// goes back to the extension.
function saveCapturePayload(data) {
  const nonce = typeof data.nonce === "string" ? data.nonce : undefined;
  if (nonce && deliveredCaptureNonces.has(nonce)) {
    return { ok: true, reason: "duplicate" }; // already saved via the other path
  }
  const text = captureTextFromPayload(data);
  if (text.length > MAX_IMPORT_ENTRY_TEXT) {
    console.warn("[txtshell] capture rejected: too large");
    return { ok: false, reason: "too-large" };
  }
  const entry = createEntryFromText(text);
  rememberCaptureNonce(nonce);
  console.log("[txtshell] captured block from postMessage", entry.id);
  return { ok: true, reason: "saved", id: entry.id };
}

// Called on unlock, before txtshell_ready is re-sent, so held captures land
// first and any queued duplicates the extension then drains are deduped.
function flushHeldCaptures() {
  if (heldCaptures.length === 0) return;
  const pending = heldCaptures;
  heldCaptures = [];
  let saved = 0;
  for (const data of pending) {
    if (saveCapturePayload(data).ok) saved++;
  }
  if (saved > 0) {
    render();
    composerHint.textContent = `Saved ${saved} capture${saved === 1 ? "" : "s"} held while locked`;
  }
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }
  const data = event.data;
  if (!data || data.type !== "txtshell_capture") {
    return;
  }
  const nonce = typeof data.nonce === "string" ? data.nonce : undefined;
  if (!captureTextFromPayload(data)) {
    replyCaptureResult(nonce, false, "empty");
    return;
  }
  if (isVaultLocked() || !state.db) {
    // Hold it for unlock, but tell the extension it did NOT land so it queues
    // too (the hold doesn't survive a reload).
    if (heldCaptures.length >= MAX_HELD_CAPTURES) heldCaptures.shift();
    heldCaptures.push(data);
    console.warn("[txtshell] capture held: vault is locked");
    replyCaptureResult(nonce, false, "locked");
    return;
  }
  const result = saveCapturePayload(data);
  if (result.ok && result.reason === "saved") render();
  replyCaptureResult(nonce, result.ok, result.reason, result.id);
});

new MutationObserver(() => {
  showStatusToast(composerHint.textContent.trim());
}).observe(composerHint, { childList: true, characterData: true, subtree: true });

closeSearchButton.addEventListener("click", () => {
  closeSearchMode();
});

shortcutsLink.addEventListener("click", () => {
  state.search = "";
  state.preset = "quickref";
  openSearchMode();
  composerHint.textContent = "Quick reference";
  render();
});

// Tapping "Saved (N)" opens the search overlay — the only way to reach it on
// mobile, where the ⌘K/Ctrl+K shortcut isn't available. Mirrors the ⌘K branch
// in the keydown handler; reuses the existing openSearchMode().
function openSavedSearchFromFooter() {
  if (state.searchMode || state.entries.length === 0) {
    return;
  }
  state.preset = null;
  openSearchMode();
  searchInput.value = state.search;
  composerHint.textContent = "Search saved";
  window.requestAnimationFrame(() => searchInput.focus());
  render();
}

savedCount.addEventListener("click", openSavedSearchFromFooter);
savedCount.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openSavedSearchFromFooter();
  }
});

// The persistent "Save block" control. It's a native <button>, so Enter/Space
// activation is handled by the browser for free — no extra keydown wiring needed.
// submitComposer() itself enforces the empty-block and vault-locked guards.
saveBlockBtn.addEventListener("click", () => {
  submitComposer();
  entryInput.focus();
});

// ---------------------------------------------------------------------------
// Shared on-screen-keyboard observer (window.visualViewport).
//
// It floats the Save button above the keyboard (the way to save on a phone:
// plain Return is a new line there, as on desktop). We treat the keyboard as "open" when
// the visual viewport is meaningfully shorter than the layout viewport — i.e.
// something (the soft keyboard) is occupying screen space. A hardware/Bluetooth
// keyboard does NOT shrink the visual viewport, so for those users the button
// stays in the footer. On desktop the viewport never
// shrinks, so keyboardOpen stays false and nothing changes.
//
// Feature-detect visualViewport: if absent (old browsers), fall back cleanly to
// current behaviour — button lives in the footer, no float.
const KEYBOARD_OPEN_THRESHOLD = 150; // px of viewport shrinkage before we call it "open"
const visualViewportApi =
  typeof window !== "undefined" && window.visualViewport ? window.visualViewport : null;

let keyboardOpen = false;

function isKeyboardOpen() {
  return keyboardOpen;
}

// Belt-and-suspenders gate: only a touch device gets the mobile behaviours. This
// makes desktop bulletproof — desktop reports a fine pointer, so even pinch-zoom
// (which ALSO shrinks the visual viewport) can never float the button. A
// tablet + Bluetooth keyboard is coarse but still excluded by
// the viewport check below (a hardware keyboard doesn't shrink the viewport).
// Evaluated live so a plugged/unplugged pointer is reflected.
function hasCoarsePointer() {
  return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}

// How many px the keyboard (and any browser offset) covers at the bottom of the
// layout viewport. Positive only when a soft keyboard is up.
function keyboardOverlapPx() {
  if (!visualViewportApi) {
    return 0;
  }
  const overlap =
    window.innerHeight - (visualViewportApi.height + visualViewportApi.offsetTop);
  return overlap > 0 ? overlap : 0;
}

function applySaveDockState() {
  const overlap = keyboardOverlapPx();
  keyboardOpen = hasCoarsePointer() && overlap > KEYBOARD_OPEN_THRESHOLD;

  if (keyboardOpen) {
    // Float the Save bar so its bottom edge rides the top of the keyboard. The
    // dock is `position: fixed; bottom: 0` (bottom of the layout viewport, which
    // sits behind the keyboard), and we translate it up by the overlap so it
    // lands exactly at the visible viewport's bottom edge — the standard
    // visualViewport technique that works on both iOS Safari and mobile Chrome.
    saveDock.classList.add("is-floating");
    saveDock.style.transform = `translateY(-${Math.round(overlap)}px)`;
    document.body.classList.add("keyboard-open");
  } else {
    saveDock.classList.remove("is-floating");
    saveDock.style.transform = "";
    document.body.classList.remove("keyboard-open");
  }
}

// Coalesce the (potentially rapid) resize/scroll bursts during a keyboard
// show/hide animation or orientation change into one paint-aligned update, so
// the dock repositions smoothly without flicker or getting stuck mid-screen.
let saveDockRafPending = false;
function scheduleSaveDockUpdate() {
  if (saveDockRafPending) {
    return;
  }
  saveDockRafPending = true;
  window.requestAnimationFrame(() => {
    saveDockRafPending = false;
    applySaveDockState();
  });
}

if (visualViewportApi) {
  visualViewportApi.addEventListener("resize", scheduleSaveDockUpdate);
  visualViewportApi.addEventListener("scroll", scheduleSaveDockUpdate);
  window.addEventListener("orientationchange", scheduleSaveDockUpdate);
  // Also settle after the input gains/loses focus, in case the keyboard's open
  // state lands before a resize fires.
  entryInput.addEventListener("focus", scheduleSaveDockUpdate);
  entryInput.addEventListener("blur", scheduleSaveDockUpdate);
  applySaveDockState();
}

// Scroll past the end. Two halves, same textarea for new and existing blocks:
//  - room under the last line (--editor-overscroll, about half the editor),
//    only once the text itself overflows, so a short note never gets empty
//    scroll;
//  - while typing, the caret line stays at least a third of the visible editor
//    above its bottom edge (the floating Save bar's top edge with a phone
//    keyboard up). It only ever scrolls down, and only after keys and edits —
//    never after a wheel/trackpad scroll — so reading back up is never pulled.
// The inbox view compacts the composer; it gets neither.
const EDITOR_OVERSCROLL_FRACTION = 0.5;
const CARET_CLEARANCE_FRACTION = 1 / 3;
let editorOverscrollPx = 0;

function isComposerCompact() {
  return composerForm.classList.contains("is-inbox");
}

function updateEditorOverscroll() {
  const height = entryInput.clientHeight;
  let next = 0;
  if (height > 0 && !isComposerCompact()) {
    // Text height without any added room: scrollHeight carries the current
    // bottom padding, so take it off and put the 20px base back.
    const paddingBottom = parseFloat(getComputedStyle(entryInput).paddingBottom) || 0;
    const textHeight = entryInput.scrollHeight - paddingBottom + 20;
    if (textHeight > height) {
      next = Math.round(height * EDITOR_OVERSCROLL_FRACTION);
    }
  }
  if (next !== editorOverscrollPx) {
    editorOverscrollPx = next;
    entryInput.style.setProperty("--editor-overscroll", `${next}px`);
  }
}

// A textarea can't report where its caret is, so lay the text up to the caret
// out in an off-screen copy with the same box and font, and read the marker.
let caretMirror = null;
const CARET_MIRROR_PROPS = [
  "paddingTop", "paddingLeft", "paddingRight", "fontFamily", "fontSize", "fontWeight",
  "fontStyle", "fontVariant", "fontStretch", "lineHeight", "letterSpacing", "wordSpacing",
  "tabSize", "textIndent", "textTransform", "whiteSpace", "wordBreak", "overflowWrap",
];

function caretLineBottom() {
  if (!caretMirror) {
    caretMirror = document.createElement("div");
    caretMirror.setAttribute("aria-hidden", "true");
    caretMirror.style.cssText = "position:absolute;top:0;left:-9999px;visibility:hidden;overflow:hidden;height:auto;box-sizing:border-box;border:0;";
    document.body.appendChild(caretMirror);
  }
  const computed = getComputedStyle(entryInput);
  for (const prop of CARET_MIRROR_PROPS) {
    caretMirror.style[prop] = computed[prop];
  }
  // clientWidth is the text box plus padding, without the scrollbar.
  caretMirror.style.width = `${entryInput.clientWidth}px`;
  caretMirror.textContent = entryInput.value.slice(0, entryInput.selectionEnd ?? entryInput.value.length);
  // inline-block: the marker's box is the full line height, not the glyph's.
  const marker = document.createElement("span");
  marker.style.display = "inline-block";
  marker.textContent = "\u200b";
  caretMirror.appendChild(marker);
  return marker.offsetTop + marker.offsetHeight;
}

// The part of the editor a person can actually see, in viewport px: the
// textarea's own box, cut at the floating Save bar when a keyboard is up.
function visibleEditorBox() {
  const top = entryInput.getBoundingClientRect().top + entryInput.clientTop;
  let bottom = top + entryInput.clientHeight;
  let visibleTop = top;
  if (isKeyboardOpen() && visualViewportApi) {
    const dockTop = saveDock.getBoundingClientRect().top;
    bottom = Math.min(bottom, visualViewportApi.offsetTop + visualViewportApi.height, dockTop);
    visibleTop = Math.max(top, visualViewportApi.offsetTop);
  }
  return { top, bottom, height: Math.max(0, bottom - visibleTop) };
}

// opening: put the caret line on the clearance mark whichever way it is (a
// block opens at its end). Otherwise only scroll down, and only if the caret
// line is inside the bottom third.
function keepCaretClear({ opening = false } = {}) {
  if (entryInput.disabled || isComposerCompact() || entryInput.clientHeight === 0) {
    return;
  }
  const box = visibleEditorBox();
  if (box.height <= 0) {
    return;
  }
  const mark = box.bottom - box.height * CARET_CLEARANCE_FRACTION;
  const caretY = box.top + caretLineBottom() - entryInput.scrollTop;
  const next = Math.max(0, entryInput.scrollTop + caretY - mark);
  if (opening || next > entryInput.scrollTop) {
    entryInput.scrollTop = next;
  }
}

let caretClearRafPending = false;
function scheduleKeepCaretClear() {
  if (caretClearRafPending) {
    return;
  }
  caretClearRafPending = true;
  window.requestAnimationFrame(() => {
    caretClearRafPending = false;
    updateEditorOverscroll();
    keepCaretClear();
  });
}

// A reopened block: its end in view, caret line about two thirds down.
function revealComposerCaret() {
  updateEditorOverscroll();
  keepCaretClear({ opening: true });
}

const CARET_CLEAR_KEYS = new Set(["ArrowDown", "ArrowRight", "ArrowLeft", "PageDown", "End", "Enter"]);
entryInput.addEventListener("keydown", (event) => {
  if (CARET_CLEAR_KEYS.has(event.key)) {
    scheduleKeepCaretClear();
  }
});
entryInput.addEventListener("input", scheduleKeepCaretClear);
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => updateEditorOverscroll()).observe(entryInput);
}
if (visualViewportApi) {
  // The keyboard coming up changes how much of the editor is visible.
  visualViewportApi.addEventListener("resize", () => {
    if (document.activeElement === entryInput) {
      scheduleKeepCaretClear();
    }
  });
}

exportButton.addEventListener("click", () => {
  exportEntries();
});

searchUndoDeleteButton.addEventListener("click", () => {
  undoDelete();
});

copySelectedButton.addEventListener("click", () => {
  copySelectedEntries();
});

mergeSelectedButton.addEventListener("click", () => {
  openMergeModal();
});

mergeCancelButton.addEventListener("click", () => {
  closeMergeModal();
});

mergeModalBackdrop.addEventListener("click", () => {
  closeMergeModal();
});

mergeModalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performMerge();
});

deleteSelectedButton.addEventListener("click", () => {
  openDeleteModal();
});

deleteCancelButton.addEventListener("click", () => {
  closeDeleteModal();
});

deleteModalBackdrop.addEventListener("click", () => {
  closeDeleteModal();
});

deleteModalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performBulkDelete();
});

const COUNT_MODES = ["off", "words", "chars", "lines"];

wordCountToggleButton.addEventListener("click", () => {
  const current = document.body.dataset.countMode || "off";
  const nextIndex = (COUNT_MODES.indexOf(current) + 1) % COUNT_MODES.length;
  // A deliberate click takes ownership of the counter: clearing a target
  // afterwards must not hide it again.
  state.counterAutoShown = false;
  applyCountMode(COUNT_MODES[nextIndex]);
});

pinnedButton.addEventListener("click", () => {
  togglePinnedPanel();
});

themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});

syncButton?.addEventListener("click", () => {
  beginAccount();
});

lockButton.addEventListener("click", () => {
  if (!state.encryption.enabled) {
    return;
  }
  if (!state.encryption.unlocked) {
    return;
  }
  lockVault();
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
  state.selectedSuggestionIndex = 0;
  render();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    escapeToComposer();
    return;
  }

  handleSearchKeyboard(event);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    if (isQuickStartOpen()) {
      // The walkthrough owns the keyboard: ←/→ step, buttons handle Enter.
      return;
    }
    if (state.searchMode && event.target !== searchInput) {
      handleSearchKeyboard(event);
      if (event.defaultPrevented) {
        return;
      }
    }
    handleGlobalShortcut(event);
    return;
  }

  event.preventDefault();
  escapeToComposer();
});

function focusComposer() {
  if (entryInput.disabled) {
    return;
  }
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
}

// Single, predictable Esc contract: dismiss whatever is open and land the user in a
// clean, ready-to-type composer. Only one exclusive overlay/view is ever open at a
// time; otherwise sweep the composer's transient UI in one pass. No lingering
// pickers, suggestions, overlays, or stale view states after one press.
function escapeToComposer() {
  // The intro overlay sits above every other surface, so Esc dismisses it first.
  if (isIntroOpen()) {
    dismissIntroOverlay();
    return;
  }
  if (isQuickStartOpen()) {
    closeQuickStart();
    return;
  }

  // Multi-select confirmation modals live inside search-mode. Esc closes the modal
  // and returns to the search view with the selection intact (Cancel/backdrop clear
  // it; Esc preserves it), so the user lands back on their multi-select — not the
  // composer.
  if (!mergeModal.hidden || !deleteModal.hidden) {
    dismissMultiSelectModalToSearch();
    return;
  }
  if (!findReplaceBar.hidden) {
    closeFindReplace();
    return;
  }
  if (!pinnedPanel.hidden) {
    closePinnedPanel();
    return;
  }
  if (!symPalette.hidden) {
    closeSymPalette();
    return;
  }

  // Vault cards: dismiss the sync/pairing cards introduced for this flow. The unlock
  // gate and other explicit flows keep their own controls. While any vault card is
  // up, Esc does nothing else.
  if (state.vaultView) {
    if (state.vaultView === "mirror-display") {
      closeMirror();
    } else if (state.vaultView === "mirror-confirm" || state.vaultView === "sync-setup") {
      exitVaultToNormal();
    }
    return;
  }

  // Full-area views (their close functions already focus the composer).
  if (isInboxOpen()) {
    endInbox();
    return;
  }
  if (state.searchMode) {
    // A live multi-selection is cleared first; the next Esc closes search.
    if (state.selectedEntries.size) {
      state.selectedEntries.clear();
      composerHint.textContent = "Selection cleared";
      render();
      return;
    }
    closeSearchMode();
    return;
  }

  // Plain composer: sweep all transient UI in one pass.
  if (state.targetCount !== null) {
    setTargetCount(null);
  }
  let restoredDraft = false;
  if (state.editingEntryId) {
    state.editingEntryId = null;
    setEditorValue("");
    clearDraft();
    restoredDraft = restoreStashedDraft();
  } else if (entryInput.value.trim().startsWith("/")) {
    setEditorValue("");
    clearDraft();
  }
  state.commandPaletteDismissed = false;
  composerHint.textContent = restoredDraft ? "Draft restored" : "Ready";
  render();

  // Ensure transient chrome is hidden after the re-render, then land in the composer.
  commandPalette.hidden = true;
  editorSuggestions.hidden = true;
  hidePinnedPanel();
  statusToast.classList.remove("is-visible", "is-hint");
  focusComposer();
}

entryInput.addEventListener("keydown", (event) => {
  // Formula shorthand is opt-in: only while /sym is open does a space convert
  // the token before the caret (H_2O -> H₂O). Never preventDefault — the
  // space still lands after the converted token.
  if (event.key === " " && !symPalette.hidden && !(event.isComposing || event.keyCode === 229)) {
    convertMarkerTokenBeforeCaret();
  }

  if (handleEditorSuggestionKeyboard(event)) {
    return;
  }

  if (handleCommandPaletteKeyboard(event)) {
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    indentSelection(event.shiftKey ? "outdent" : "indent");
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    reopenEntryInEditor(getMostRecentlyEditedEntryId());
    return;
  }

  if (event.shiftKey && event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const inlineQuery = getInlineQuery();
    if (inlineQuery) {
      const matches = getEntriesForQuery({ search: inlineQuery.query });
      if (matches.length) {
        event.preventDefault();
        reopenEntryInEditor(matches[0].id);
        return;
      }
    }
  }

  // Plain Enter inserts a newline, so every /command needs an explicit
  // keydown intercept to reach submitComposer. Exact-name commands are taken
  // straight from SLASH_COMMANDS; ARG_COMMANDS ("/font 12") match on their
  // first token and, because they carry free text, get modifier/IME guards so
  // a composition commit can't fire them.
  if (event.key === "Enter") {
    const trimmed = entryInput.value.trim();
    if (SLASH_COMMAND_NAMES.has(trimmed)) {
      event.preventDefault();
      submitComposer();
      return;
    }
    const firstToken = trimmed.split(/\s+/, 1)[0].toLowerCase();
    if (
      ARG_COMMANDS.has(firstToken) &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !(event.isComposing || event.keyCode === 229)
    ) {
      event.preventDefault();
      submitComposer();
      return;
    }
  }

  const targetMatch = event.key === "Enter" ? entryInput.value.trim().match(/^\/(\d+)$/) : null;
  if (targetMatch) {
    event.preventDefault();
    const value = parseInt(targetMatch[1], 10);
    setEditorValue("");
    clearDraft();
    composerHint.textContent = setTargetCount(value > 0 ? value : null);
    return;
  }

  if (event.key === "Enter" && /^\/-[a-zA-Z0-9_-]+$/.test(entryInput.value.trim())) {
    event.preventDefault();
    submitComposer();
    return;
  }

  // Plain Enter on "term//" jumps to full search mode. Plain Enter never
  // reaches submitComposer (it inserts a newline), so like the /command
  // branches above this needs its own keydown intercept. Shift+Enter stays
  // with the edit-top-match branch above; Cmd/Ctrl+Enter falls through to
  // save, where submitComposer runs the same redirect.
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    getInlineQuery()
  ) {
    // IME/autocorrect guard: an Enter that commits a composition must not
    // trigger the redirect.
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    event.preventDefault();
    openSearchFromQueryMarker();
    return;
  }

  // Cmd/Ctrl+Enter is the only key that saves. Plain Enter is a new line on
  // every device; on a phone the floating Save block button saves.
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    submitComposer();
  }
});

entryInput.addEventListener("input", (event) => {
  if (consumeSymPaletteSigil(event)) {
    return;
  }
  composerHint.textContent = state.editingEntryId ? "Editing block -> save updates" : "Ready";
  queueDraftSave();
  updateWordCount();
  state.editorSelectedSuggestionIndex = 0;
  state.commandPaletteIndex = 0;
  if (!entryInput.value.startsWith("/")) {
    state.commandPaletteDismissed = false;
  }
  renderEditorSuggestions();
  render();
});

// First-visit intro overlay. intro-boot.js (loaded in <head>) decides
// visibility before first paint by adding .show-intro to <html> when
// INTRO_KEY is unset — that, not this file, is what prevents a flash of the
// editor on first visit. This side owns dismissal and the /about replay path.
function isIntroOpen() {
  return (
    (document.documentElement.classList.contains("show-intro") ||
      introOverlay.classList.contains("is-open")) &&
    !introOverlay.classList.contains("is-closing")
  );
}

function showIntroOverlay() {
  introOverlay.classList.remove("is-closing");
  introOverlay.classList.add("is-open");
  introOverlay.scrollTop = 0;
  window.requestAnimationFrame(() => introStartButton.focus());
}

function dismissIntroOverlay() {
  window.localStorage.setItem(INTRO_KEY, "1");
  introOverlay.classList.add("is-closing");
  window.setTimeout(() => {
    document.documentElement.classList.remove("show-intro");
    introOverlay.classList.remove("is-open", "is-closing");
  }, INTRO_FADE_MS);
  if (state.searchMode) {
    // Replayed from the /about guide -> land in the composer, per the Esc contract.
    closeSearchMode();
  } else {
    focusComposer();
  }
}

introStartButton.addEventListener("click", dismissIntroOverlay);
introReplayButton.addEventListener("click", showIntroOverlay);

// Quick start walkthrough. Never auto-shown (the intro owns the first-visit
// slot); launched from the first-run hint bar, /about, or /q. Mirrors the intro's
// open/close shape: .is-open/.is-closing fade, Esc dismisses (checked right after
// the intro in escapeToComposer), closing lands in the composer per the Esc
// contract -- or closes search mode when launched from the /about or /q sheets.
let quickStartStep = 0;

function isQuickStartOpen() {
  return !quickStartOverlay.hidden && !quickStartOverlay.classList.contains("is-closing");
}

function markQuickStartSeen() {
  window.localStorage.setItem(QUICK_START_KEY, "1");
  quickStartHint.hidden = true;
}

function renderQuickStartStep() {
  const step = QUICK_START_STEPS[quickStartStep];
  const isLast = quickStartStep === QUICK_START_STEPS.length - 1;
  const dots = QUICK_START_STEPS.map((_, index) =>
    `<span class="quick-start-dot${index === quickStartStep ? " is-active" : ""}"></span>`
  ).join("");
  quickStartCard.innerHTML = `
    <p class="quick-start-eyebrow">quick start · ${quickStartStep + 1} / ${QUICK_START_STEPS.length}</p>
    <h2 id="quickStartTitle" class="quick-start-title">${step.title}</h2>
    <div class="quick-start-body" aria-live="polite">${step.body}</div>
    <div class="quick-start-footer">
      <div class="quick-start-dots" aria-hidden="true">${dots}</div>
      <div class="quick-start-actions">
        ${isLast ? "" : `<button class="modal-button modal-button-secondary" type="button" data-action="skip">Skip</button>`}
        <button class="modal-button modal-button-primary" type="button" data-action="next">${isLast ? "Start writing →" : "Next →"}</button>
      </div>
    </div>`;
  window.requestAnimationFrame(() => {
    quickStartCard.querySelector('[data-action="next"]')?.focus();
  });
}

function openQuickStart() {
  if (isIntroOpen()) {
    return;
  }
  markQuickStartSeen();
  quickStartStep = 0;
  quickStartOverlay.classList.remove("is-closing");
  quickStartOverlay.hidden = false;
  renderQuickStartStep();
  // Next frame so the opacity transition runs from the hidden state.
  window.requestAnimationFrame(() => quickStartOverlay.classList.add("is-open"));
}

function closeQuickStart() {
  if (quickStartOverlay.hidden) {
    return;
  }
  quickStartOverlay.classList.add("is-closing");
  quickStartOverlay.classList.remove("is-open");
  window.setTimeout(() => {
    quickStartOverlay.hidden = true;
    quickStartOverlay.classList.remove("is-closing");
    quickStartCard.innerHTML = "";
  }, INTRO_FADE_MS);
  if (state.searchMode) {
    closeSearchMode();
  } else {
    focusComposer();
  }
}

quickStartCard.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "skip") {
    closeQuickStart();
  } else if (action === "next") {
    if (quickStartStep >= QUICK_START_STEPS.length - 1) {
      closeQuickStart();
    } else {
      quickStartStep += 1;
      renderQuickStartStep();
    }
  }
});

quickStartOverlay.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" && quickStartStep < QUICK_START_STEPS.length - 1) {
    event.preventDefault();
    quickStartStep += 1;
    renderQuickStartStep();
  } else if (event.key === "ArrowLeft" && quickStartStep > 0) {
    event.preventDefault();
    quickStartStep -= 1;
    renderQuickStartStep();
  }
});

quickStartBackdrop.addEventListener("click", closeQuickStart);
quickStartHintLink.addEventListener("click", openQuickStart);
quickStartHintClose.addEventListener("click", () => {
  markQuickStartSeen();
  focusComposer();
});
quickStartLinkAbout.addEventListener("click", openQuickStart);
quickStartLinkHelp.addEventListener("click", openQuickStart);

// First-run hint bar: shown once until dismissed or the cards are opened.
quickStartHint.hidden = Boolean(window.localStorage.getItem(QUICK_START_KEY));

if (isIntroOpen()) {
  // Beat the textarea's autofocus so keyboard users start on the CTA.
  window.requestAnimationFrame(() => introStartButton.focus());
}

updateClock();
window.setInterval(updateClock, 1000);
applyTheme(window.localStorage.getItem(THEME_KEY) || "light");
{
  const savedFontSize = parseEditorFontSize(window.localStorage.getItem(EDITOR_FONT_SIZE_KEY));
  if (savedFontSize !== null) {
    applyEditorFontSize(clampEditorFontSize(savedFontSize));
  }
}
const savedCountMode = window.localStorage.getItem(WORD_COUNT_KEY);
applyCountMode(
  savedCountMode === "true" ? "words"
  : COUNT_MODES.includes(savedCountMode) ? savedCountMode
  : "off"
);
initialize();

function createEntryFromText(text) {
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    text,
    tags: extractTags(text),
    mentions: extractMentions(text),
    createdAt: now,
    editedAt: now,
    pinned: false,
  };
  state.entries.unshift(entry);
  saveEntry(entry);
  return entry;
}

function submitComposer() {
  if (isVaultLocked()) {
    return;
  }

  const text = entryInput.value.trim();
  if (!text) {
    composerHint.textContent = "Block cannot be saved empty";
    return;
  }

  // Any real submission (command or save) leaves the inbox view, flushing the
  // pending DELETE batch. The /inbox branch below then re-opens it (a refresh).
  if (isInboxOpen()) {
    endInbox();
  }

  if (openSearchFromQueryMarker()) {
    return;
  }

  if (text === "/t") {
    state.search = "";
    state.preset = "today";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Today";
    render();
    return;
  }

  if (text === "/ta") {
    state.search = "";
    state.preset = "today-all";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Today (all activity)";
    render();
    return;
  }

  if (text === "/otd") {
    state.search = "";
    state.preset = "otd";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "On this day";
    render();
    return;
  }

  if (text === "/y") {
    state.search = "";
    state.preset = "yesterday";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Yesterday";
    render();
    return;
  }

  if (text === "/w") {
    state.search = "";
    state.preset = "week";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Last week";
    render();
    return;
  }

  if (text === "/ya") {
    state.search = "";
    state.preset = "yesterday-all";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Yesterday (all activity)";
    render();
    return;
  }

  if (text === "/wa") {
    state.search = "";
    state.preset = "week-all";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Last week (all activity)";
    render();
    return;
  }

  if (text === "/re") {
    reopenEntryInEditor(getMostRecentlyEditedEntryId());
    return;
  }

  if (text === "/sym") {
    setEditorValue("");
    clearDraft();
    render();
    openSymPalette();
    return;
  }

  if (text === "/q") {
    state.search = "";
    state.preset = "quickref";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Quick reference";
    render();
    return;
  }

  if (text === "/about") {
    state.search = "";
    state.preset = "about";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "About txtshell";
    render();
    return;
  }

  if (text === "/pin") {
    state.search = "";
    state.preset = "pinned";
    openSearchMode();
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Pinned";
    render();
    return;
  }

  if (text === "/account") {
    beginAccount();
    return;
  }
  if (text === "/account devices") {
    void beginAccountDevices();
    return;
  }
  if (text === "/account phrase") {
    void beginAccountPhrase();
    return;
  }
  if (text === "/account signout") {
    void accountSignOut();
    return;
  }
  if (text === "/account leave") {
    void beginAccountLeave();
    return;
  }

  // With a Txtshell account the passkey is the only way in (plan §7): the
  // passphrase commands and the pairing commands are refused, one line each.
  if (isCentral() && ["/encrypt", "/encrypt change", "/encrypt off", "/mirror", "/port", "/sync setup"].includes(text)) {
    composerHint.textContent = CENTRAL_REFUSAL;
    return;
  }

  if (text === "/encrypt") {
    if (state.encryption.enabled) {
      composerHint.textContent = "Encryption already on";
      return;
    }
    setEditorValue("");
    clearDraft();
    state.vaultPending = null;
    state.vaultView = "setup";
    renderVault();
    composerHint.textContent = "Set up encryption";
    return;
  }

  if (text === "/encrypt change") {
    if (!state.encryption.enabled) {
      composerHint.textContent = "Encryption not enabled";
      return;
    }
    setEditorValue("");
    clearDraft();
    state.vaultPending = null;
    state.vaultView = "change-current";
    renderVault();
    composerHint.textContent = "Change passphrase";
    return;
  }

  if (text === "/encrypt off") {
    if (!state.encryption.enabled) {
      composerHint.textContent = "Encryption not enabled";
      return;
    }
    setEditorValue("");
    clearDraft();
    state.vaultPending = null;
    state.vaultView = "disable-confirm";
    renderVault();
    composerHint.textContent = "Disable encryption";
    return;
  }

  if (text === "/wipe") {
    setEditorValue("");
    clearDraft();
    state.vaultPending = null;
    state.vaultView = "wipe-confirm";
    renderVault();
    composerHint.textContent = "Wipe all data";
    return;
  }

  if (text === "/lock") {
    if (!state.encryption.enabled) {
      composerHint.textContent = "Encryption not enabled";
      return;
    }
    lockVault();
    return;
  }

  if (text === "/import") {
    setEditorValue("");
    clearDraft();
    importEntries();
    return;
  }

  if (text === "/export") {
    setEditorValue("");
    clearDraft();
    exportEntries();
    return;
  }

  if (text === "/export plain") {
    setEditorValue("");
    clearDraft();
    exportEntries({ plain: true });
    return;
  }

  if (text === "/sync setup") {
    if (!state.encryption.enabled) {
      composerHint.textContent = "Encryption not enabled — run /encrypt first";
      return;
    }
    setEditorValue("");
    clearDraft();
    state.vaultPending = null;
    state.vaultView = "sync-setup";
    renderVault();
    composerHint.textContent = "Configure sync — need to deploy a Worker? See the linked guide";
    return;
  }

  if (text === "/mirror") {
    if (!state.encryption.enabled) {
      composerHint.textContent = "Encryption not enabled — run /encrypt first";
      return;
    }
    setEditorValue("");
    clearDraft();
    beginMirror();
    return;
  }

  if (text === "/port") {
    // Fail closed: never silently overwrite an existing vault or local blocks.
    if (state.encryption.enabled || state.entries.length > 0) {
      composerHint.textContent = "This browser already has data. Use /pull to fetch the latest from cloud.";
      return;
    }
    setEditorValue("");
    clearDraft();
    state.vaultPending = null;
    state.vaultView = "port-paste";
    renderVault();
    composerHint.textContent = "Pair this browser";
    return;
  }

  if (text === "/pull") {
    setEditorValue("");
    clearDraft();
    beginPull();
    return;
  }

  if (text === "/inbox") {
    if (!state.encryption.enabled) {
      composerHint.textContent = "Encryption not enabled — run /encrypt first";
      return;
    }
    setEditorValue("");
    clearDraft();
    beginInbox();
    return;
  }

  const fontMatch = text.match(/^\/font(?:\s+(\S+))?$/i);
  if (fontMatch) {
    const arg = (fontMatch[1] || "").toLowerCase();
    if (!arg || arg === "reset") {
      applyEditorFontSize(null);
      setEditorValue("");
      clearDraft();
      composerHint.textContent = "Font size reset to default";
      return;
    }
    const requested = parseEditorFontSize(arg);
    if (requested === null) {
      composerHint.textContent = `Usage: /font <${EDITOR_FONT_SIZE_MIN}-${EDITOR_FONT_SIZE_MAX}>`;
      return;
    }
    const size = clampEditorFontSize(requested);
    applyEditorFontSize(size);
    setEditorValue("");
    clearDraft();
    composerHint.textContent =
      requested < size ? `Font size set to ${size}px (min)`
      : requested > size ? `Font size set to ${size}px (max)`
      : `Font size set to ${size}px`;
    return;
  }

  const targetMatch = text.match(/^\/(\d+)$/);
  if (targetMatch) {
    const value = parseInt(targetMatch[1], 10);
    setEditorValue("");
    clearDraft();
    composerHint.textContent = setTargetCount(value > 0 ? value : null);
    return;
  }

  const tagMatch = text.match(/^\/-([a-zA-Z0-9_-]+)$/);
  if (tagMatch) {
    openMostRecentlyEditedTaggedBlock(tagMatch[1].toLowerCase());
    return;
  }

  if (state.editingEntryId) {
    const existingEntry = state.entries.find((entry) => entry.id === state.editingEntryId);
    if (!existingEntry) {
      state.editingEntryId = null;
    } else {
      existingEntry.text = text;
      existingEntry.tags = extractTags(text);
      existingEntry.mentions = extractMentions(text);
      existingEntry.editedAt = new Date().toISOString();
      saveEntry(existingEntry);
      setEditorValue("");
      clearDraft();
      composerHint.textContent = restoreStashedDraft() ? "Updated · draft restored" : "Updated";
      state.editingEntryId = null;
      render();
      return;
    }
  }

  createEntryFromText(text);
  setEditorValue("");
  clearDraft();
  composerHint.textContent = restoreStashedDraft() ? "Saved · draft restored" : "Saved";
  render();

  if (state.entries.length === 1) {
    showHint("first-save", "Press Cmd/Ctrl + K to search your saved blocks");
  } else if (state.entries.length === 3) {
    showHint("inline-retrieval", "Type a word then // and press Enter to search it");
  } else if (state.entries.length === 5) {
    showHint("five-blocks", "Try /y for yesterday's blocks or /w for last week");
  }
}

function handleGlobalShortcut(event) {
  if (isVaultLocked()) {
    return;
  }

  const isModifier = event.metaKey || event.ctrlKey;
  if (!isModifier) {
    return;
  }

  const key = event.key.toLowerCase();

  if (event.shiftKey && key === "h") {
    event.preventDefault();
    state.search = "";
    state.preset = "quickref";
    openSearchMode();
    composerHint.textContent = "Quick reference";
    render();
    return;
  }

  if (event.shiftKey && key === "f") {
    event.preventDefault();
    if (state.searchMode) {
      return;
    }
    openFindReplace();
    return;
  }

  if (key === "k") {
    event.preventDefault();
    state.preset = null;
    openSearchMode();
    searchInput.value = state.search;
    composerHint.textContent = "Search saved";
    window.requestAnimationFrame(() => searchInput.focus());
    render();
    return;
  }
}

function render() {
  // A locked vault has no readable blocks to count — the footer says so, rather than "Saved (0)",
  // which read as data loss on the manual run (plan §3). Covers both modes.
  savedCount.textContent = isVaultLocked()
    ? "Locked"
    : (state.unreadable.length > 0
      ? `Saved (${state.entries.length}) · ${state.unreadable.length} unreadable`
      : `Saved (${state.entries.length})`);
  const touch = hasCoarsePointer();
  entryInput.placeholder = state.entries.length
    ? (touch ? COMPOSER_PLACEHOLDER_HAS_BLOCKS_TOUCH : COMPOSER_PLACEHOLDER_HAS_BLOCKS)
    : (touch ? COMPOSER_PLACEHOLDER_EMPTY_TOUCH : COMPOSER_PLACEHOLDER_EMPTY);
  renderCommandPalette();

  if (!state.searchMode) {
    return;
  }

  searchUndoDeleteButton.hidden = !state.pendingDeletedEntries?.length;
  pruneStaleSelections();
  const selectionCount = state.selectedEntries.size;
  if (selectionCount >= 2) {
    copySelectedButton.hidden = false;
    copySelectedButton.textContent = `Copy selected (${selectionCount})`;
    mergeSelectedButton.hidden = false;
    mergeSelectedButton.textContent = `Merge selected (${selectionCount})`;
    deleteSelectedButton.hidden = false;
    deleteSelectedButton.textContent = `Delete selected (${selectionCount})`;
  } else {
    copySelectedButton.hidden = true;
    mergeSelectedButton.hidden = true;
    deleteSelectedButton.hidden = true;
  }
  quickReference.hidden = state.preset !== "quickref";
  aboutGuide.hidden = state.preset !== "about";
  entryList.hidden = state.preset === "quickref" || state.preset === "about";
  const filteredEntries = getFilteredEntries();
  searchModeLabel.textContent = getSearchModeLabel(filteredEntries.length);
  entryList.innerHTML = "";
  renderSuggestions();

  syncSelection(filteredEntries);

  if (!filteredEntries.length) {
    if (state.search) {
      entryList.innerHTML = '<p class="empty-state">No matching blocks.</p>';
    } else if (!state.entries.length) {
      entryList.innerHTML = '<p class="empty-state">Nothing saved yet. Write something and press <kbd>\u2318</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save your first block.</p>';
    } else if (state.preset === "pinned") {
      entryList.innerHTML = '<p class="empty-state">Nothing pinned yet. Use ☆ on a block to pin it.</p>';
    } else if (state.preset === "otd") {
      entryList.innerHTML = '<p class="empty-state">Nothing saved on this day of an earlier month or year yet. Check back as your notebook grows.</p>';
    } else {
      entryList.innerHTML = '<p class="empty-state">No blocks in this view.</p>';
    }
    return;
  }

  renderEntries(entryList, filteredEntries, {
    selectResults: true,
    highlightTerm: getActiveHighlightTerm(),
    mode: "search",
    // "On this day" spans months, so group by month instead of recency.
    groupLabel: state.preset === "otd" ? getMonthYearLabel : getDateGroup,
  });
}

function openSearchMode() {
  state.searchMode = true;
  hidePinnedPanel();
  searchMode.hidden = false;
  composerForm.hidden = true;
  syncSelection(getFilteredEntries());
  const isPresetMode = Boolean(state.preset);
  searchInput.hidden = isPresetMode;
  searchInputLabel.hidden = isPresetMode;
  if (!isPresetMode) {
    showHint("first-search", "Try #tag or @name to filter by tags and mentions");
  }
}

function closeSearchMode() {
  state.searchMode = false;
  searchMode.hidden = true;
  composerForm.hidden = false;
  state.preset = null;
  state.selectedEntryId = null;
  state.selectedEntries.clear();
  closeMergeModal();
  closeDeleteModal();
  searchInput.hidden = false;
  searchInputLabel.hidden = false;
  searchSuggestions.hidden = true;
  composerHint.textContent = state.editingEntryId ? "Editing block -> save updates" : "Ready";
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
}

function getMostRecentlyEditedEntryId() {
  let bestId = null;
  let bestEditedAt = "";
  for (const entry of state.entries) {
    const editedAt = entry.editedAt || entry.createdAt;
    if (editedAt > bestEditedAt) {
      bestEditedAt = editedAt;
      bestId = entry.id;
    }
  }
  return bestId;
}

function reopenEntryInEditor(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) {
    composerHint.textContent = "No saved block yet";
    return;
  }

  stashComposerDraft();
  state.editingEntryId = entry.id;
  setEditorValue(entry.text);
  // Same rule as queueDraftSave: never persist plaintext drafts while encrypted.
  if (!state.encryption.enabled) {
    saveMeta(DRAFT_KEY, entry.text);
  }
  // Reopen paths (/re, /-tag, Shift+Enter, Edit) replace the editor value
  // without going through render(), so the command palette and #/@ popover
  // would otherwise keep showing whatever was matched before the reopen.
  commandPalette.hidden = true;
  editorSuggestions.hidden = true;
  hidePinnedPanel();
  closeSearchMode();
  composerHint.textContent = "Editing block -> save updates";
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
  revealComposerCaret();
  showHint("edit-mode", "Press Esc to cancel editing");
}

function openMostRecentlyEditedTaggedBlock(tag) {
  let bestId = null;
  let bestEditedAt = "";
  for (const entry of state.entries) {
    if (!(entry.tags || []).includes(tag)) {
      continue;
    }
    const editedAt = entry.editedAt || entry.createdAt;
    if (editedAt > bestEditedAt) {
      bestEditedAt = editedAt;
      bestId = entry.id;
    }
  }
  if (bestId) {
    reopenEntryInEditor(bestId);
  } else {
    composerHint.textContent = `No block tagged #${tag}`;
  }
}

function updateClock() {
  currentDateTime.textContent = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function initialize() {
  try {
    state.db = await openDatabase();
    void refreshSyncDoor({ probe: true });
    const saltPassBase64 = await getMeta(ENC_SALT_PASS_KEY);
    const encMode = await getMeta(ENC_MODE_KEY);
    state.encryption.mode = encMode === "central" ? "central" : "passphrase";
    state.encryption.enabled = Boolean(saltPassBase64) || state.encryption.mode === "central";
    if (state.encryption.mode === "central") {
      const [removed, readdCredentialId] = await Promise.all([getMeta(CENTRAL_REMOVED_KEY), getMeta(CENTRAL_READD_CREDENTIAL_KEY)]);
      state.central.removed = Boolean(removed);
      state.central.readdCredentialId = readdCredentialId || null;
    }

    if (state.encryption.enabled) {
      state.vaultView = "unlock";
      renderVault();
      updateLockButton();
      render();
      return;
    }

    const rawEntries = await getAllEntries();
    // A plaintext store can still hold records flagged unreadable (they arrive
    // via a pull or an import from an encrypted vault). They are not blocks:
    // never render or index their ciphertext, keep them for the vault to carry.
    state.unreadable = rawEntries.filter(isUnreadableRecord).map(unreadableRecordOf);
    state.entries = rawEntries.filter((entry) => !isUnreadableRecord(entry)).map((entry) => ({
      ...entry,
      tags: Array.isArray(entry.tags) ? entry.tags : extractTags(entry.text),
      mentions: Array.isArray(entry.mentions) ? entry.mentions : extractMentions(entry.text),
      pinned: entry.pinned === true,
      editedAt: entry.editedAt || entry.createdAt,
    }));
    const draft = await getMeta(DRAFT_KEY);
    if (draft) {
      setEditorValue(draft);
      composerHint.textContent = "Draft restored";
      entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
    }
    // A stash outliving a reload means the page closed mid-edit. The draft
    // (if any) keeps the composer; the stash comes back once it's saved or
    // dismissed. With no draft waiting, restore the stash right away.
    const stash = await getMeta(DRAFT_STASH_KEY);
    if (stash) {
      state.stashedDraft = stash;
      if (!draft && restoreStashedDraft()) {
        composerHint.textContent = "Draft restored";
      }
    }
    signalReady();
  } catch {
    composerHint.textContent = "Storage unavailable";
  }
  updateLockButton();
  render();
}

function queueDraftSave() {
  window.clearTimeout(draftSaveTimer);
  if (state.encryption.enabled) {
    return;
  }
  draftSaveTimer = window.setTimeout(() => {
    saveMeta(DRAFT_KEY, entryInput.value);
  }, DRAFT_SAVE_DELAY);
}

function clearDraft() {
  window.clearTimeout(draftSaveTimer);
  saveMeta(DRAFT_KEY, "");
}

// Reopen paths (/re, Edit, the pinned panel, /-tag, Shift+Enter) replace the
// composer with a saved block. Unsaved new-block text that was there is kept
// aside and put back when that edit ends (saved, Esc, or the block is
// deleted) instead of being silently dropped. A "term //" marker is stripped
// the way openSearchFromQueryMarker does; slash commands and an in-progress
// edit of another block are not stashed (the latter's original is already
// saved). Persisted next to the draft so a reload mid-edit keeps it; never
// persisted while encrypted, same rule as queueDraftSave.
function stashComposerDraft() {
  if (state.editingEntryId) {
    return;
  }
  let text = entryInput.value;
  if (getInlineQuery()) {
    text = text.trimEnd().slice(0, -2).trimEnd();
  }
  if (!text.trim() || text.trim().startsWith("/")) {
    return;
  }
  state.stashedDraft = text;
  if (!state.encryption.enabled) {
    saveMeta(DRAFT_STASH_KEY, text);
  }
}

function restoreStashedDraft() {
  const text = state.stashedDraft;
  if (!text) {
    return false;
  }
  state.stashedDraft = null;
  setEditorValue(text);
  entryInput.setSelectionRange(text.length, text.length);
  if (!state.encryption.enabled) {
    saveMeta(DRAFT_STASH_KEY, "");
    saveMeta(DRAFT_KEY, text);
  }
  return true;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        const store = db.createObjectStore(ENTRY_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function getAllEntries() {
  if (!state.db) {
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(ENTRY_STORE, "readonly");
    const store = transaction.objectStore(ENTRY_STORE);
    const request = store.getAll();

    request.addEventListener("success", () => {
      const entries = request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(entries);
    });
    request.addEventListener("error", () => reject(request.error));
  });
}

async function saveEntry(entry) {
  if (!state.db) {
    return;
  }
  let record = entry;
  if (state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey) {
    record = {
      id: entry.id,
      text: await encryptPlaintext(entry.text, state.encryption.masterKey),
      tags: [],
      mentions: [],
      createdAt: entry.createdAt,
      editedAt: entry.editedAt || entry.createdAt,
      pinned: entry.pinned === true,
      ...(typeof entry.olderVersionOf === "string" ? { olderVersionOf: entry.olderVersionOf } : {}),
    };
  }
  await putEntryRecord(record);
  scheduleCloudSync();
}

function putEntryRecord(record) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(ENTRY_STORE, "readwrite");
    transaction.objectStore(ENTRY_STORE).put(record);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function deleteEntry(entryId) {
  clearPendingDelete();
  const deletedIndex = state.entries.findIndex((entry) => entry.id === entryId);
  if (deletedIndex === -1) {
    return;
  }

  const deletedEntry = state.entries[deletedIndex];
  state.pendingDeletedEntries = [{ entry: deletedEntry, index: deletedIndex }];
  state.entries = state.entries.filter((entry) => entry.id !== entryId);
  if (state.editingEntryId === entryId) {
    state.editingEntryId = null;
    setEditorValue("");
    clearDraft();
    restoreStashedDraft();
  }
  removeEntry(entryId);
  composerHint.textContent = "Block deleted";
  syncSelection(getFilteredEntries());
  render();
  deleteUndoTimer = window.setTimeout(() => {
    clearPendingDelete();
    render();
  }, DELETE_UNDO_TIMEOUT);
}

function getFilteredEntries() {
  return getEntriesForQuery({ preset: state.preset, search: state.search });
}

// Split a query into whitespace-separated terms; a block must match every
// term (AND). "#tag" / "@name" terms match tags/mentions exactly, anything
// else is a case-insensitive substring of the block text.
function parseSearchTerms(search) {
  return (search || "").toLowerCase().trim().split(RE_WHITESPACE).filter(Boolean);
}

function getEntriesForQuery({ preset = null, search = "" } = {}) {
  const filtered = state.entries.filter((entry) => {
    if (preset === "quickref" || preset === "about") {
      return false;
    }
    if (preset === "today") {
      return isToday(entry.createdAt);
    }
    if (preset === "otd") {
      return isOnThisDay(entry.createdAt);
    }
    if (preset === "today-all") {
      return isToday(entry.createdAt) || (entry.editedAt && isToday(entry.editedAt));
    }
    if (preset === "yesterday") {
      return isYesterday(entry.createdAt);
    }
    if (preset === "yesterday-all") {
      return isYesterday(entry.createdAt) || (entry.editedAt && isYesterday(entry.editedAt));
    }
    if (preset === "week") {
      return isLastWeek(entry.createdAt);
    }
    if (preset === "week-all") {
      return isLastWeek(entry.createdAt) || (entry.editedAt && isLastWeek(entry.editedAt));
    }
    if (preset === "pinned") {
      return entry.pinned === true;
    }
    if (preset === "recent") {
      return entry.id === state.entries[0]?.id;
    }
    const terms = parseSearchTerms(search);
    if (!terms.length) {
      return true;
    }
    const loweredText = entry.text.toLowerCase();
    return terms.every((term) => {
      if (term.startsWith("#")) {
        return (entry.tags || []).includes(term.slice(1));
      }
      if (term.startsWith("@")) {
        return (entry.mentions || []).includes(term.slice(1));
      }
      return loweredText.includes(term);
    });
  });

  if (preset === "today-all" || preset === "yesterday-all" || preset === "week-all") {
    filtered.sort((a, b) => {
      const aMax = a.editedAt || a.createdAt;
      const bMax = b.editedAt || b.createdAt;
      return bMax.localeCompare(aMax);
    });
  }

  return filtered;
}

function syncSelection(entries) {
  if (!entries.length) {
    state.selectedEntryId = null;
    return;
  }

  const stillExists = entries.some((entry) => entry.id === state.selectedEntryId);
  if (!stillExists) {
    state.selectedEntryId = entries[0].id;
  }
}

function handleSearchKeyboard(event) {
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && (event.key === "c" || event.key === "C")) {
    if (copySelectionViaKeyboard(event)) {
      return;
    }
  }

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === "e" || event.key === "E") && state.selectedEntryId) {
    event.preventDefault();
    reopenEntryInEditor(state.selectedEntryId);
    return;
  }

  if (event.shiftKey && event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && state.selectedEntryId) {
    event.preventDefault();
    reopenEntryInEditor(state.selectedEntryId);
    return;
  }

  const suggestions = getSearchSuggestions();
  if (suggestions.length) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.selectedSuggestionIndex = Math.min(
        state.selectedSuggestionIndex + 1,
        suggestions.length - 1,
      );
      renderSuggestions();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.selectedSuggestionIndex = Math.max(state.selectedSuggestionIndex - 1, 0);
      renderSuggestions();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      applySuggestion(suggestions[state.selectedSuggestionIndex]);
      return;
    }
  }

  const entries = getFilteredEntries();
  if (!entries.length) {
    return;
  }

  const currentIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.id === state.selectedEntryId),
  );

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = Math.min(Math.max(currentIndex + step, 0), entries.length - 1);
    if (event.shiftKey) {
      extendMultiSelect(entries[currentIndex].id, entries[nextIndex].id);
      return;
    }
    moveSelection(entries[nextIndex].id);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    toggleSelectedExpanded();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && (event.key === "Backspace" || event.key === "Delete") && state.selectedEntryId) {
    event.preventDefault();
    deleteEntry(state.selectedEntryId);
    return;
  }
}

function toggleSelectedExpanded() {
  const selectedCard = entryList.querySelector(".entry-card.is-selected");
  if (!selectedCard) {
    return;
  }

  const expandButton = selectedCard.querySelector(".expand-button");
  if (expandButton?.hidden) {
    return;
  }

  const isCollapsed = selectedCard.classList.toggle("collapsed");
  expandButton.textContent = isCollapsed ? "Expand" : "Collapse";
  expandButton.setAttribute("aria-expanded", String(!isCollapsed));
}

function moveSelection(newId) {
  const oldCard = entryList.querySelector(".entry-card.is-selected");
  if (oldCard) oldCard.classList.remove("is-selected");
  state.selectedEntryId = newId;
  const newCard = entryList.querySelector(`.entry-card[data-entry-id="${newId}"]`);
  if (newCard) newCard.classList.add("is-selected");
  newCard?.scrollIntoView({ block: "nearest" });
}

function scrollSelectedIntoView() {
  const selectedCard = entryList.querySelector(".entry-card.is-selected");
  selectedCard?.scrollIntoView({ block: "nearest" });
}

// Shift+↑/↓ grows the multi-selection from the keyboard: the focused block and
// the one moved to both join the set, mirroring Shift+click.
function extendMultiSelect(fromId, toId) {
  state.selectedEntries.add(fromId);
  state.selectedEntries.add(toId);
  state.selectedEntryId = toId;
  render();
  scrollSelectedIntoView();
}

// Cmd/Ctrl+C in search copies the multi-selection, or else the focused block,
// but only when there's no text selection — drag-selected text keeps native copy.
function copySelectionViaKeyboard(event) {
  if (event.target === searchInput && searchInput.selectionStart !== searchInput.selectionEnd) {
    return false;
  }
  if (window.getSelection().toString()) {
    return false;
  }
  if (state.selectedEntries.size >= 2) {
    event.preventDefault();
    copySelectedEntries();
    return true;
  }
  const entry = state.entries.find((item) => item.id === state.selectedEntryId);
  if (!entry) {
    return false;
  }
  event.preventDefault();
  copyBlockText(entry.text, "Block copied", entryList.querySelector(".entry-card.is-selected .copy-button"));
  return true;
}

async function copyBlockText(text, hint, button) {
  try {
    await navigator.clipboard.writeText(text);
    composerHint.textContent = hint;
    flashCopied(button);
  } catch {
    composerHint.textContent = "Copy failed";
  }
}

// Joins the multi-selected blocks (in list order) with a blank line between.
function copySelectedEntries() {
  pruneStaleSelections();
  const selected = state.entries.filter((entry) => state.selectedEntries.has(entry.id));
  if (!selected.length) {
    return;
  }
  const text = selected.map((entry) => entry.text).join("\n\n");
  copyBlockText(text, `Copied ${selected.length} blocks`, copySelectedButton);
}

function flashCopied(button) {
  if (!(button instanceof HTMLElement)) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = originalText;
  }, COPY_FLASH_DURATION);
}

function undoDelete() {
  if (!state.pendingDeletedEntries?.length) {
    return;
  }

  const records = [...state.pendingDeletedEntries].sort((a, b) => a.index - b.index);
  for (const { entry, index } of records) {
    state.entries.splice(index, 0, entry);
    saveEntry(entry);
  }
  state.selectedEntryId = records[0].entry.id;
  composerHint.textContent = records.length > 1 ? `Restored ${records.length} blocks` : "Delete undone";
  clearPendingDelete();
  render();
  window.requestAnimationFrame(() => {
    scrollSelectedIntoView();
  });
}

function clearPendingDelete() {
  window.clearTimeout(deleteUndoTimer);
  deleteUndoTimer = null;
  state.pendingDeletedEntries = null;
}

function pruneStaleSelections() {
  if (!state.selectedEntries.size) {
    return;
  }
  const live = new Set(state.entries.map((entry) => entry.id));
  for (const id of state.selectedEntries) {
    if (!live.has(id)) {
      state.selectedEntries.delete(id);
    }
  }
}

function openMergeModal() {
  if (state.selectedEntries.size < 2) {
    return;
  }
  mergeModalTitle.textContent = `Merge ${state.selectedEntries.size} blocks into one`;
  mergeOpeningInput.value = "";
  mergeModal.hidden = false;
  window.requestAnimationFrame(() => mergeOpeningInput.focus());
}

// Esc dismissal for the merge/delete confirmation modals: close the modal but keep
// the multi-select and stay in the search view (unlike Cancel/backdrop, which clear).
function dismissMultiSelectModalToSearch() {
  mergeModal.hidden = true;
  deleteModal.hidden = true;
  mergeOpeningInput.value = "";
  if (state.searchMode) {
    render(); // selection preserved -> multi-select toolbar stays visible
    if (!searchInput.hidden) {
      window.requestAnimationFrame(() => searchInput.focus());
    }
  }
}

function closeMergeModal() {
  mergeModal.hidden = true;
  mergeOpeningInput.value = "";
  if (state.selectedEntries.size) {
    state.selectedEntries.clear();
    if (state.searchMode) {
      render();
    }
  }
}

async function performMerge() {
  const ids = Array.from(state.selectedEntries);
  const originals = state.entries
    .filter((entry) => ids.includes(entry.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (originals.length < 2) {
    return;
  }

  const opening = mergeOpeningInput.value.trim();
  const bodies = originals.map((entry) => entry.text).join("\n\n---\n\n");
  const text = opening ? `${opening}\n\n${bodies}` : bodies;
  const now = new Date().toISOString();
  const merged = {
    id: crypto.randomUUID(),
    text,
    tags: extractTags(text),
    mentions: extractMentions(text),
    createdAt: now,
    editedAt: now,
    pinned: originals.some((entry) => entry.pinned === true),
  };

  const originalIds = new Set(originals.map((entry) => entry.id));
  for (const id of originalIds) {
    removeEntry(id);
  }
  state.entries = state.entries.filter((entry) => !originalIds.has(entry.id));

  state.entries.unshift(merged);
  await saveEntry(merged);

  state.selectedEntries.clear();
  closeMergeModal();
  state.selectedEntryId = merged.id;
  composerHint.textContent = `Merged ${originals.length} blocks`;
  render();
  window.requestAnimationFrame(() => scrollSelectedIntoView());
}

function openDeleteModal() {
  if (state.selectedEntries.size < 2) {
    return;
  }
  deleteModalTitle.textContent = `Delete ${state.selectedEntries.size} blocks`;
  deleteModal.hidden = false;
  window.requestAnimationFrame(() => deleteCancelButton.focus());
}

function closeDeleteModal() {
  deleteModal.hidden = true;
  if (state.selectedEntries.size) {
    state.selectedEntries.clear();
    if (state.searchMode) {
      render();
    }
  }
}

function performBulkDelete() {
  const ids = Array.from(state.selectedEntries);
  const records = [];
  for (const id of ids) {
    const index = state.entries.findIndex((entry) => entry.id === id);
    if (index !== -1) {
      records.push({ entry: state.entries[index], index });
    }
  }
  if (!records.length) {
    closeDeleteModal();
    return;
  }

  clearPendingDelete();

  const idSet = new Set(records.map((r) => r.entry.id));
  state.entries = state.entries.filter((entry) => !idSet.has(entry.id));
  for (const id of idSet) {
    removeEntry(id);
    if (state.editingEntryId === id) {
      state.editingEntryId = null;
      setEditorValue("");
      clearDraft();
      restoreStashedDraft();
    }
  }

  state.pendingDeletedEntries = records;
  state.selectedEntries.clear();
  deleteModal.hidden = true;
  composerHint.textContent = `Deleted ${records.length} blocks`;
  syncSelection(getFilteredEntries());
  render();
  deleteUndoTimer = window.setTimeout(() => {
    clearPendingDelete();
    render();
  }, DELETE_UNDO_TIMEOUT);
}

function getSearchModeLabel(count) {
  const suffix = count !== undefined && state.preset !== "quickref" && state.preset !== "about"
    ? ` (${count})`
    : "";
  if (state.preset === "about") {
    return "About txtshell";
  }
  if (state.preset === "quickref") {
    return "Quick reference";
  }
  if (state.preset === "today") {
    return `Today${suffix}`;
  }
  if (state.preset === "otd") {
    return `On this day${suffix}`;
  }
  if (state.preset === "today-all") {
    return `Today (all activity)${suffix}`;
  }
  if (state.preset === "yesterday") {
    return `Yesterday${suffix}`;
  }
  if (state.preset === "yesterday-all") {
    return `Yesterday (all activity)${suffix}`;
  }
  if (state.preset === "week") {
    return `Last week${suffix}`;
  }
  if (state.preset === "week-all") {
    return `Last week (all activity)${suffix}`;
  }
  if (state.preset === "pinned") {
    return `Pinned${suffix}`;
  }
  if (state.search) {
    return `Results${suffix}`;
  }
  return `Search saved blocks${suffix}`;
}

// Note font size (/font <n>): composer + saved block bodies. Stored as an
// integer px value; null means "use the stylesheet default" (--note-font-size
// on :root).
function parseEditorFontSize(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  const match = String(raw).trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/);
  return match ? Math.round(Number(match[1])) : null;
}

function clampEditorFontSize(value) {
  return Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, value));
}

function applyEditorFontSize(size) {
  if (size === null) {
    document.documentElement.style.removeProperty("--note-font-size");
    window.localStorage.removeItem(EDITOR_FONT_SIZE_KEY);
    updateEditorOverscroll();
    return;
  }
  document.documentElement.style.setProperty("--note-font-size", `${size}px`);
  window.localStorage.setItem(EDITOR_FONT_SIZE_KEY, String(size));
  updateEditorOverscroll();
}

function applyCountMode(mode, { persist = true } = {}) {
  document.body.dataset.countMode = mode;
  if (persist) {
    window.localStorage.setItem(WORD_COUNT_KEY, mode);
  }
  wordCountDisplay.hidden = mode === "off";
  wordCountToggleButton.classList.toggle("is-active", mode !== "off");
  wordCountToggleButton.setAttribute("aria-label", `Counter: ${mode}`);
  updateWordCount();
}

// Sets (or clears, with null) the count target and returns the hint text.
// The target is unitless -- it reads in whatever mode the counter is in. If the
// counter is off when a target arrives, reveal it in words mode without
// persisting, and remember that we did so; clearing the target then hides it
// again unless the user has since clicked the toggle themselves.
function setTargetCount(value) {
  state.targetCount = value;
  const mode = document.body.dataset.countMode || "off";
  if (value !== null) {
    if (mode === "off") {
      state.counterAutoShown = true;
      applyCountMode("words", { persist: false });
      return `Target set to ${value} ${value === 1 ? "word" : "words"}`;
    }
    updateWordCount();
    return `Target set to ${value}`;
  }
  if (state.counterAutoShown) {
    state.counterAutoShown = false;
    applyCountMode("off", { persist: false });
  } else {
    updateWordCount();
  }
  return "Target cleared";
}

function updateWordCount() {
  const mode = document.body.dataset.countMode || "off";
  if (mode === "off") {
    return;
  }

  const text = entryInput.value.trim();
  let count = 0;
  let unit = "";
  if (mode === "words") {
    count = text ? text.split(RE_WHITESPACE).length : 0;
    unit = count === 1 ? "word" : "words";
  } else if (mode === "chars") {
    count = text.length;
    unit = count === 1 ? "char" : "chars";
  } else if (mode === "lines") {
    count = text ? text.split("\n").length : 0;
    unit = count === 1 ? "line" : "lines";
  }

  const target = state.targetCount;
  if (target) {
    const pluralUnit = target === 1 ? unit.replace(/s$/, "") : (unit.endsWith("s") ? unit : `${unit}s`);
    wordCountDisplay.textContent = `${count} / ${target} ${pluralUnit}`;
    wordCountDisplay.classList.toggle("is-over-target", count > target);
    wordCountDisplay.classList.toggle("is-near-target", count >= target * 0.9 && count <= target);
  } else {
    wordCountDisplay.textContent = `${count} ${unit}`;
    wordCountDisplay.classList.remove("is-near-target");
    wordCountDisplay.classList.remove("is-over-target");
  }
}

function getMonthYearLabel(dateString) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(dateString));
}

function getDateGroup(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekAgo) return "This week";
  return "Older";
}

// The older version of a note changed on two devices (Part B): a label in the list, above the note's
// own (untouched) text. Its actions: keep it as an ordinary note (the label goes), or delete it.
function olderVersionMarker(entry) {
  const marker = document.createElement("div");
  marker.className = "older-version";
  marker.innerHTML = `
    <button class="older-version-label" type="button" aria-expanded="false">Older version · kept because this note was changed on two devices</button>
    <span class="older-version-actions" hidden>
      <button class="older-version-keep" type="button">Keep as its own note</button>
      <button class="older-version-delete" type="button">Delete this version</button>
    </span>`;
  marker.addEventListener("click", (event) => event.stopPropagation()); // not a click on the note
  const label = marker.querySelector(".older-version-label");
  const actions = marker.querySelector(".older-version-actions");
  label.addEventListener("click", () => {
    actions.hidden = !actions.hidden;
    label.setAttribute("aria-expanded", String(!actions.hidden));
  });
  marker.querySelector(".older-version-keep").addEventListener("click", () => {
    const kept = state.entries.find((e) => e.id === entry.id);
    if (!kept) return;
    delete kept.olderVersionOf;
    kept.editedAt = new Date().toISOString(); // a change like any other: it syncs
    void saveEntry(kept);
    render();
  });
  marker.querySelector(".older-version-delete").addEventListener("click", () => deleteEntry(entry.id));
  return marker;
}

function renderEntries(container, entries, options = {}) {
  const { selectResults = false, highlightTerm = "", mode = "search", groupLabel = getDateGroup } = options;
  let lastGroup = null;

  entries.forEach((entry) => {
    const group = groupLabel(entry.createdAt);
    if (group !== lastGroup) {
      const divider = document.createElement("p");
      divider.className = "date-group-label";
      divider.textContent = group;
      container.appendChild(divider);
      lastGroup = group;
    }

    const fragment = entryTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".entry-card");
    const body = fragment.querySelector(".entry-body");
    const tagsContainer = fragment.querySelector(".entry-tags");
    const expandButton = fragment.querySelector(".expand-button");
    fragment.querySelector(".entry-timestamp").textContent = formatTimestamp(entry.createdAt);
    body.innerHTML = renderBlockHtml(entry.text, highlightTerm);
    card.dataset.entryId = entry.id;
    if (typeof entry.olderVersionOf === "string") body.before(olderVersionMarker(entry));

    if (selectResults && entry.id === state.selectedEntryId) {
      card.classList.add("is-selected");
    }

    if (mode === "search" && state.selectedEntries.has(entry.id)) {
      card.classList.add("is-multi-selected");
    }

    if (mode === "search") {
      card.addEventListener("click", (event) => {
        if (!event.shiftKey) {
          return;
        }
        // Links are deliberately not excluded: Shift+click on one selects the
        // block (preventDefault below also stops Safari's "Add to Reading List").
        if (event.target.closest(".pin-button, .edit-button, .copy-button, .delete-button, .expand-button, .tag-chip")) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (state.selectedEntries.has(entry.id)) {
          state.selectedEntries.delete(entry.id);
        } else {
          state.selectedEntries.add(entry.id);
        }
        render();
      }, true);
    }

    const tags = entry.tags;
    const mentions = entry.mentions;
    if (!tags.length && !mentions.length) {
      tagsContainer.hidden = true;
    } else {
      tagsContainer.hidden = false;
      tags.forEach((tag) => {
        const tagChip = document.createElement("button");
        tagChip.className = "tag-chip";
        tagChip.type = "button";
        tagChip.textContent = `#${tag}`;
        tagChip.addEventListener("click", (event) => {
          event.stopPropagation();
          openFocusedSearch(`#${tag}`, `Tag: #${tag}`);
        });
        tagsContainer.appendChild(tagChip);
      });

      mentions.forEach((mention) => {
        const mentionChip = document.createElement("button");
        mentionChip.className = "tag-chip mention-chip";
        mentionChip.type = "button";
        mentionChip.textContent = `@${mention}`;
        mentionChip.addEventListener("click", (event) => {
          event.stopPropagation();
          openFocusedSearch(`@${mention}`, `Mention: @${mention}`);
        });
        tagsContainer.appendChild(mentionChip);
      });
    }

    const isLongEntry = entry.text.length > 280 || entry.text.split("\n").length > 6;
    if (isLongEntry) {
      // Shown only while expanded (CSS hides it on .collapsed cards).
      const words = entry.text.trim() ? entry.text.trim().split(RE_WHITESPACE).length : 0;
      const stats = fragment.querySelector(".entry-stats");
      stats.textContent = `${words} ${words === 1 ? "word" : "words"}`;
      stats.hidden = false;
    }
    if (!isLongEntry) {
      card.classList.remove("collapsed");
      expandButton.hidden = true;
      if (selectResults) {
        card.addEventListener("click", (event) => {
          if (event.target.closest(".entry-body")) {
            return;
          }
          if (window.getSelection().toString()) {
            return;
          }
          state.selectedEntryId = entry.id;
          container.querySelectorAll(".entry-card.is-selected").forEach((el) => {
            if (el !== card) el.classList.remove("is-selected");
          });
          card.classList.add("is-selected");
        });
      }
    } else {
      const toggleExpanded = () => {
        const isCollapsed = card.classList.toggle("collapsed");
        expandButton.textContent = isCollapsed ? "Expand" : "Collapse";
        expandButton.setAttribute("aria-expanded", String(!isCollapsed));
      };

      expandButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleExpanded();
      });

      if (selectResults) {
        card.addEventListener("click", (event) => {
          if (event.target.closest("a")) {
            return;
          }
          if (window.getSelection().toString()) {
            return;
          }
          const isCollapsed = card.classList.contains("collapsed");
          if (!isCollapsed && event.target.closest(".entry-body")) {
            return;
          }
          state.selectedEntryId = entry.id;
          container.querySelectorAll(".entry-card.is-selected").forEach((el) => {
            if (el !== card) el.classList.remove("is-selected");
          });
          card.classList.add("is-selected");
          toggleExpanded();
        });
      }
    }

    const pinButton = fragment.querySelector(".pin-button");
    const applyPinState = () => {
      const isPinned = entry.pinned === true;
      pinButton.textContent = isPinned ? "★" : "☆";
      pinButton.setAttribute("aria-pressed", String(isPinned));
      pinButton.setAttribute("aria-label", isPinned ? "Unpin block" : "Pin block");
      pinButton.setAttribute("title", isPinned ? "Unpin block" : "Pin block");
    };
    applyPinState();
    pinButton.addEventListener("click", (event) => {
      event.stopPropagation();
      entry.pinned = !entry.pinned;
      entry.editedAt = new Date().toISOString();
      saveEntry(entry);
      applyPinState();
      composerHint.textContent = entry.pinned ? "Pinned" : "Unpinned";
      if (state.preset === "pinned") {
        render();
      }
    });

    fragment.querySelector(".copy-button").addEventListener("click", (event) => {
      event.stopPropagation();
      copyBlockText(entry.text, "Block copied", event.currentTarget);
    });
    fragment.querySelector(".edit-button").addEventListener("click", (event) => {
      event.stopPropagation();
      reopenEntryInEditor(entry.id);
    });
    const deleteButton = fragment.querySelector(".delete-button");
    let deleteConfirmTimer = null;
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (deleteButton.dataset.confirm === "true") {
        window.clearTimeout(deleteConfirmTimer);
        deleteEntry(entry.id);
        return;
      }
      deleteButton.dataset.confirm = "true";
      deleteButton.textContent = "Sure?";
      deleteButton.classList.add("is-confirming");
      deleteConfirmTimer = window.setTimeout(() => {
        deleteButton.dataset.confirm = "";
        deleteButton.textContent = "Delete";
        deleteButton.classList.remove("is-confirming");
      }, DELETE_CONFIRM_TIMEOUT);
    });
    if (selectResults) {
      card.addEventListener("mousedown", () => {
        state.selectedEntryId = entry.id;
      });
    }
    container.appendChild(fragment);
  });
}

function getInlineQuery() {
  const trimmed = entryInput.value.trimEnd();
  if (!trimmed.endsWith("//")) {
    return null;
  }

  const query = trimmed.slice(0, -2).trim();
  if (!query) {
    return null;
  }

  return { query };
}

// "term//" + Enter jumps into full search mode with the query pre-filled.
// Mirrors openSavedSearchFromFooter; the trailing "//" is stripped so the
// composer keeps just the draft text when search closes. Returns true when
// a query marker was present and the redirect ran.
function openSearchFromQueryMarker() {
  const inlineQuery = getInlineQuery();
  if (!inlineQuery) {
    return false;
  }
  setEditorValue(entryInput.value.trimEnd().slice(0, -2).trimEnd());
  queueDraftSave();
  updateWordCount();
  state.search = inlineQuery.query;
  state.preset = null;
  openSearchMode();
  searchInput.value = state.search;
  composerHint.textContent = "Search saved";
  window.requestAnimationFrame(() => searchInput.focus());
  render();
  return true;
}

function indentSelection(mode) {
  const value = entryInput.value;
  const selectionStart = entryInput.selectionStart;
  const selectionEnd = entryInput.selectionEnd;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextLineBreak = value.indexOf("\n", selectionEnd);
  const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const selectedText = value.slice(lineStart, lineEnd);
  const lines = selectedText.split("\n");

  const updatedLines = lines.map((line) => {
    if (mode === "outdent") {
      if (line.startsWith("  ")) {
        return line.slice(2);
      }
      if (line.startsWith("\t")) {
        return line.slice(1);
      }
      return line;
    }
    return `  ${line}`;
  });

  const updatedText = updatedLines.join("\n");
  setEditorValue(`${value.slice(0, lineStart)}${updatedText}${value.slice(lineEnd)}`);

  const lengthDelta = updatedText.length - selectedText.length;
  const hasSelection = selectionStart !== selectionEnd;
  const startOffset = mode === "indent" ? 2 : getOutdentOffset(lines[0]);
  const nextStart = hasSelection ? lineStart + Math.max(0, selectionStart - lineStart + startOffset) : selectionStart + startOffset;
  const nextEnd = selectionEnd + lengthDelta;

  entryInput.focus();
  entryInput.setSelectionRange(
    Math.max(lineStart, nextStart),
    Math.max(lineStart, hasSelection ? nextEnd : nextStart),
  );
  queueDraftSave();
  updateWordCount();
  renderEditorSuggestions();
}

function openFindReplace() {
  findReplaceBar.hidden = false;
  updateFindReplaceCount();
  window.requestAnimationFrame(() => {
    findInput.focus();
    findInput.select();
  });
}

function closeFindReplace() {
  findReplaceBar.hidden = true;
  entryInput.focus();
}

function getFindMatches() {
  const term = findInput.value;
  if (!term) {
    return [];
  }
  const text = entryInput.value;
  const matches = [];
  let cursor = 0;
  while (cursor <= text.length) {
    const found = text.indexOf(term, cursor);
    if (found === -1) {
      break;
    }
    matches.push(found);
    cursor = found + term.length;
  }
  return matches;
}

function updateFindReplaceCount() {
  const matches = getFindMatches();
  if (!findInput.value) {
    findReplaceCount.textContent = "0 matches";
    return;
  }
  findReplaceCount.textContent = matches.length === 1 ? "1 match" : `${matches.length} matches`;
}

function replaceNextMatch() {
  const term = findInput.value;
  if (!term) {
    return;
  }
  const matches = getFindMatches();
  if (!matches.length) {
    composerHint.textContent = "No matches";
    return;
  }
  const replacement = replaceInput.value;
  const targetIdx = matches[0];
  const text = entryInput.value;
  const nextText = text.slice(0, targetIdx) + replacement + text.slice(targetIdx + term.length);
  setEditorValue(nextText);
  const caret = targetIdx + replacement.length;
  entryInput.setSelectionRange(caret, caret);
  queueDraftSave();
  renderEditorSuggestions();
  updateFindReplaceCount();
  composerHint.textContent = "Replaced";
}

function replaceAllMatches() {
  const term = findInput.value;
  if (!term) {
    return;
  }
  const matches = getFindMatches();
  if (!matches.length) {
    composerHint.textContent = "No matches";
    return;
  }
  const replacement = replaceInput.value;
  const count = matches.length;
  const nextText = entryInput.value.split(term).join(replacement);
  setEditorValue(nextText);
  queueDraftSave();
  renderEditorSuggestions();
  updateFindReplaceCount();
  composerHint.textContent = count === 1 ? "Replaced 1 match" : `Replaced ${count} matches`;
}

findInput.addEventListener("input", () => {
  updateFindReplaceCount();
});

findInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    replaceNextMatch();
  }
});

replaceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    replaceNextMatch();
  }
});

findReplaceReplaceButton.addEventListener("click", () => {
  replaceNextMatch();
});

findReplaceReplaceAllButton.addEventListener("click", () => {
  replaceAllMatches();
});

findReplaceCloseButton.addEventListener("click", () => {
  closeFindReplace();
});

function openFocusedSearch(term, statusMessage) {
  state.preset = null;
  state.search = term;
  openSearchMode();
  searchInput.value = state.search;
  composerHint.textContent = statusMessage;
  render();
  window.requestAnimationFrame(() => searchInput.focus());
}

function getOutdentOffset(line) {
  if (line.startsWith("  ")) {
    return -2;
  }
  if (line.startsWith("\t")) {
    return -1;
  }
  return 0;
}

function renderSuggestions() {
  const suggestions = getSearchSuggestions();
  searchSuggestions.innerHTML = "";
  searchSuggestions.hidden = !suggestions.length || searchInput.hidden;

  if (!suggestions.length || searchInput.hidden) {
    return;
  }

  state.selectedSuggestionIndex = Math.min(
    state.selectedSuggestionIndex,
    suggestions.length - 1,
  );

  suggestions.forEach((suggestion, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggestion";
    button.textContent = suggestion;
    if (index === state.selectedSuggestionIndex) {
      button.classList.add("is-selected");
    }
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applySuggestion(suggestion);
    });
    searchSuggestions.appendChild(button);
  });
}

function renderEditorSuggestions() {
  const context = getEditorSuggestionContext();
  const suggestions = context ? getStructuredSuggestions(context.token) : [];
  editorSuggestions.innerHTML = "";
  editorSuggestions.hidden = !suggestions.length;

  if (!suggestions.length) {
    return;
  }

  state.editorSelectedSuggestionIndex = Math.min(
    state.editorSelectedSuggestionIndex,
    suggestions.length - 1,
  );

  suggestions.forEach((suggestion, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggestion";
    button.textContent = suggestion;
    if (index === state.editorSelectedSuggestionIndex) {
      button.classList.add("is-selected");
    }
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applyEditorSuggestion(suggestion);
    });
    editorSuggestions.appendChild(button);
  });
}

function getPaletteItems() {
  if (state.commandPaletteDismissed) {
    return [];
  }
  const value = entryInput.value;
  if (!value.startsWith("/") || value.includes("\n")) {
    return [];
  }
  if (value.startsWith("/-")) {
    return getTagPaletteItems(value);
  }
  const lowered = value.toLowerCase();
  // Bare "/" keeps declaration order (/about first for newcomers).
  if (lowered === "/") {
    return SLASH_COMMANDS.slice();
  }
  // With a prefix, rank by closeness to it, not declaration order: exact
  // match first, then shorter names, then alphabetical. Otherwise "/w"
  // would pre-select /wipe (declared before /w) and Enter would fill the
  // composer with the destructive command instead of the one typed.
  return SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(lowered)).sort((a, b) => {
    const aExact = a.name === lowered;
    const bExact = b.name === lowered;
    if (aExact !== bExact) {
      return aExact ? -1 : 1;
    }
    if (a.name.length !== b.name.length) {
      return a.name.length - b.name.length;
    }
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

function getTagPaletteItems(value) {
  const prefix = value.slice(2).toLowerCase();
  const counts = new Map();
  for (const entry of state.entries) {
    for (const tag of entry.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const items = [];
  for (const [tag, count] of counts) {
    if (count > 0 && tag.startsWith(prefix)) {
      items.push({
        name: `/-${tag}`,
        description: count === 1 ? "1 block" : `${count} blocks`,
      });
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function renderCommandPalette() {
  const matches = getPaletteItems();
  commandPalette.innerHTML = "";

  if (!matches.length) {
    commandPalette.hidden = true;
    return;
  }

  state.commandPaletteIndex = Math.min(
    Math.max(state.commandPaletteIndex, 0),
    matches.length - 1,
  );

  matches.forEach((cmd, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-palette-item";
    button.setAttribute("role", "option");
    if (index === state.commandPaletteIndex) {
      button.classList.add("is-selected");
      button.setAttribute("aria-selected", "true");
    }
    const nameEl = document.createElement("span");
    nameEl.className = "command-palette-name";
    nameEl.textContent = cmd.name;
    const descEl = document.createElement("span");
    descEl.className = "command-palette-desc";
    descEl.textContent = cmd.description;
    button.append(nameEl, descEl);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applyCommand(cmd.name);
    });
    commandPalette.appendChild(button);
  });

  commandPalette.hidden = false;
}

function handleCommandPaletteKeyboard(event) {
  const matches = getPaletteItems();
  if (!matches.length) {
    return false;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.commandPaletteIndex = (state.commandPaletteIndex + 1) % matches.length;
    renderCommandPalette();
    commandPalette.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.commandPaletteIndex =
      (state.commandPaletteIndex - 1 + matches.length) % matches.length;
    renderCommandPalette();
    commandPalette.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
    return true;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    applyCommand(matches[state.commandPaletteIndex].name);
    return true;
  }

  if (event.key === "Enter") {
    const highlighted = matches[state.commandPaletteIndex];
    if (!highlighted) {
      return false;
    }
    if (entryInput.value.startsWith("/-")) {
      if (highlighted.name.startsWith("/-")) {
        event.preventDefault();
        commandPalette.hidden = true;
        openMostRecentlyEditedTaggedBlock(highlighted.name.slice(2).toLowerCase());
        return true;
      }
      return false;
    }
    if (highlighted.name !== entryInput.value) {
      event.preventDefault();
      applyCommand(highlighted.name);
      return true;
    }
  }

  return false;
}

function applyCommand(name) {
  setEditorValue(name);
  entryInput.focus();
  entryInput.setSelectionRange(name.length, name.length);
  state.commandPaletteIndex = 0;
  queueDraftSave();
  renderCommandPalette();
}

// Suggestions complete the term being typed (the last one), so a multi-term
// query like "#work @ja" still offers mentions starting with "ja".
function getSearchSuggestions() {
  if (!state.search) {
    return [];
  }

  const terms = state.search.split(RE_WHITESPACE);
  return getStructuredSuggestions(terms[terms.length - 1]);
}

function applySuggestion(suggestion) {
  const terms = state.search.split(RE_WHITESPACE);
  terms[terms.length - 1] = suggestion;
  const nextSearch = terms.join(" ");
  state.search = nextSearch;
  state.selectedSuggestionIndex = 0;
  searchInput.value = nextSearch;
  render();
}

function getStructuredSuggestions(token) {
  const normalizedToken = token.toLowerCase();
  if (!normalizedToken.startsWith("#") && !normalizedToken.startsWith("@")) {
    return [];
  }

  const prefix = normalizedToken[0];
  const query = normalizedToken.slice(1);
  const counts = new Map();

  state.entries.forEach((entry) => {
    const values = prefix === "#" ? entry.tags : entry.mentions;

    values.forEach((value) => {
      if (!query || value.startsWith(query)) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    });
  });

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 8)
    .map(([value]) => `${prefix}${value}`);
}

function getEditorSuggestionContext() {
  if (entryInput.selectionStart !== entryInput.selectionEnd) {
    return null;
  }

  const caret = entryInput.selectionStart;
  const beforeCaret = entryInput.value.slice(0, caret);
  const match = beforeCaret.match(RE_EDITOR_TOKEN);
  if (!match) {
    return null;
  }

  return {
    token: match[2],
    start: caret - match[2].length,
    end: caret,
  };
}

function handleEditorSuggestionKeyboard(event) {
  const context = getEditorSuggestionContext();
  const suggestions = context ? getStructuredSuggestions(context.token) : [];
  if (!suggestions.length) {
    editorSuggestions.hidden = true;
    return false;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.editorSelectedSuggestionIndex = Math.min(
      state.editorSelectedSuggestionIndex + 1,
      suggestions.length - 1,
    );
    renderEditorSuggestions();
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.editorSelectedSuggestionIndex = Math.max(state.editorSelectedSuggestionIndex - 1, 0);
    renderEditorSuggestions();
    return true;
  }

  if (event.key === "Tab" || event.key === "Enter") {
    event.preventDefault();
    applyEditorSuggestion(suggestions[state.editorSelectedSuggestionIndex]);
    return true;
  }

  return false;
}

function applyEditorSuggestion(suggestion) {
  const context = getEditorSuggestionContext();
  if (!context) {
    return;
  }

  const currentValue = entryInput.value;
  const nextChar = currentValue.slice(context.end, context.end + 1);
  const needsTrailingSpace = nextChar !== "" && /\s/.test(nextChar) ? false : nextChar === "";
  const completedSuggestion = needsTrailingSpace ? `${suggestion} ` : suggestion;

  setEditorValue(`${currentValue.slice(0, context.start)}${completedSuggestion}${currentValue.slice(context.end)}`);
  const nextCaret = context.start + completedSuggestion.length;
  entryInput.focus();
  entryInput.setSelectionRange(nextCaret, nextCaret);
  state.editorSelectedSuggestionIndex = 0;
  queueDraftSave();
  updateWordCount();
  renderEditorSuggestions();
}

function extractTags(text) {
  const matches = text.toLowerCase().match(RE_TAGS) || [];
  const tags = matches
    .map((match) => match.trim().slice(1))
    .filter(Boolean);
  return [...new Set(tags)];
}

function extractMentions(text) {
  const matches = text.toLowerCase().match(RE_MENTIONS) || [];
  const mentions = matches
    .map((match) => match.trim().slice(1))
    .filter(Boolean);
  return [...new Set(mentions)];
}

function getActiveHighlightTerm() {
  if (!state.search) {
    return "";
  }
  return state.search.trim();
}

// Escapes block text, highlights search terms, and turns http(s):// and
// www. URLs into links. URLs are split out before escaping/highlighting so
// <mark> tags and entities inside them can't corrupt the href.
function renderBlockHtml(text, highlightTerm) {
  let html = "";
  let last = 0;
  for (const match of text.matchAll(RE_URL)) {
    let url = match[0];
    // Trailing punctuation belongs to the sentence, not the URL; a closing
    // paren is kept only when the URL itself opened one (Wikipedia-style).
    while (url.length) {
      const lastChar = url[url.length - 1];
      if (".,;:!?'\"".includes(lastChar)) {
        url = url.slice(0, -1);
        continue;
      }
      if (lastChar === ")" && url.split("(").length < url.split(")").length) {
        url = url.slice(0, -1);
        continue;
      }
      break;
    }
    const start = match.index;
    html += highlightMatches(text.slice(last, start), highlightTerm);
    const href = url.toLowerCase().startsWith("www.") ? `https://${url}` : url;
    html += `<a class="entry-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${highlightMatches(url, highlightTerm)}</a>`;
    last = start + url.length;
  }
  html += highlightMatches(text.slice(last), highlightTerm);
  return html;
}

function highlightMatches(text, term) {
  // Longest terms first so "notebook" wins over "note" in the alternation.
  const terms = parseSearchTerms(term).sort((a, b) => b.length - a.length);
  if (!terms.length) {
    return escapeHtml(text);
  }

  const pattern = terms.map(escapeRegExp).join("|");
  return escapeHtml(text).replace(
    new RegExp(`(${pattern})`, "gi"),
    "<mark>$1</mark>",
  );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
  return value.replace(RE_ESCAPE, "\\$&");
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  window.localStorage.setItem(THEME_KEY, theme);
  themeToggleButton.innerHTML =
    theme === "dark"
      ? '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M15 11.5A6.5 6.5 0 0 1 6.5 3a6.5 6.5 0 1 0 8.5 8.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="3.25" stroke="currentColor" stroke-width="1.5"/><path d="M9 1.5v2M9 14.5v2M16.5 9h-2M3.5 9h-2M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4M14.3 14.3l-1.4-1.4M5.1 5.1L3.7 3.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  themeToggleButton.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
  );
}

function showStatusToast(message, options = {}) {
  if (!message || message === "Ready" || message === "Editing block -> save updates" || message === "Search saved") {
    return;
  }

  const { duration = TOAST_DURATION, isHint = false } = options;
  statusToast.textContent = message;
  statusToast.classList.toggle("is-hint", isHint);
  statusToast.classList.add("is-visible");
  window.clearTimeout(statusToastTimer);
  statusToastTimer = window.setTimeout(() => {
    statusToast.classList.remove("is-visible", "is-hint");
  }, duration);
}

function getShownHints() {
  try {
    return JSON.parse(window.localStorage.getItem(HINTS_KEY)) || [];
  } catch {
    return [];
  }
}

function markHintShown(id) {
  const shown = getShownHints();
  if (!shown.includes(id)) {
    shown.push(id);
    window.localStorage.setItem(HINTS_KEY, JSON.stringify(shown));
  }
}

function showHint(id, message) {
  if (getShownHints().includes(id)) {
    return;
  }
  markHintShown(id);
  window.setTimeout(() => {
    showStatusToast(message, { duration: HINT_TOAST_DURATION, isHint: true });
  }, HINT_DELAY);
}

async function exportEntries({ plain = false } = {}) {
  if (state.encryption.enabled && !state.encryption.unlocked) {
    composerHint.textContent = "Unlock your notes to export.";
    return;
  }

  if (!state.entries.length && !state.unreadable.length) {
    composerHint.textContent = "Nothing to export";
    return;
  }

  // Both exports carry unreadable records flagged, ciphertext untouched, so a
  // backup is complete and says so; an importer keeps them flagged too.
  const exportEntriesList = [...state.entries, ...state.unreadable.map(blobRecordOf)];
  const exportedLabel = (suffix) => {
    const carried = state.unreadable.length > 0
      ? `, ${pluralCount(state.unreadable.length, "block")} carried as unreadable`
      : "";
    return `Exported ${pluralCount(state.entries.length, "block")}${carried} (${suffix})`;
  };

  if (!plain && isCentral() && state.encryption.unlocked && state.encryption.masterKey) {
    // Plan §9 (revised 2026-10-09): the file carries the account's recovery wrap — it opens with the
    // 12 words. No export passphrase; nothing new is asked for.
    setEditorValue("");
    clearDraft();
    beginCentralExport(exportEntriesList, exportedLabel);
    return;
  }

  if (!plain && state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey) {
    const saltPass = await getMeta(ENC_SALT_PASS_KEY);
    const wrappedPass = await getMeta(ENC_WRAPPED_PASS_KEY);
    const verify = await getMeta(ENC_VERIFY_KEY);
    if (!saltPass || !wrappedPass || !verify) {
      // The in-memory session key is non-extractable, so an encrypted export is
      // impossible without the stored wrapped-key blobs — but the blocks are
      // readable, so a deliberate plaintext export must always remain available.
      composerHint.textContent = "This device's encryption settings are missing — run /export plain to save an unencrypted copy.";
      return;
    }
    // Recovery metadata is optional: a /port-paired browser wraps the master key
    // under the passphrase only. The export stays importable via passphrase alone.
    const saltRecovery = await getMeta(ENC_SALT_RECOVERY_KEY);
    const wrappedRecovery = await getMeta(ENC_WRAPPED_RECOVERY_KEY);
    const iterationsPass = await readIterations(ENC_ITERATIONS_PASS_KEY);

    const combined = await encryptPlaintext(
      JSON.stringify(exportEntriesList),
      state.encryption.masterKey,
    );
    const combinedBytes = base64ToBytes(combined);
    const iv = bytesToBase64(combinedBytes.slice(0, 12));
    const ciphertext = bytesToBase64(combinedBytes.slice(12));

    const fileObj = {
      format: "txtshell-encrypted-v1",
      createdAt: new Date().toISOString(),
      saltPass,
      iterationsPass,
      wrappedPass,
      verify,
      iv,
      ciphertext,
    };
    if (saltRecovery && wrappedRecovery) {
      fileObj.saltRecovery = saltRecovery;
      fileObj.wrappedRecovery = wrappedRecovery;
      fileObj.iterationsRecovery = await readIterations(ENC_ITERATIONS_RECOVERY_KEY);
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(fileObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `txtshell-encrypted-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    composerHint.textContent = exportedLabel("encrypted");
    return;
  }

  const content = JSON.stringify(exportEntriesList, null, 2);
  const timestamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `txtshell-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  composerHint.textContent = state.encryption.enabled
    ? exportedLabel("plaintext — this file is NOT encrypted")
    : exportedLabel("plaintext");
}

function importEntries() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      composerHint.textContent = "Invalid import file";
      return;
    }
    if (data && data.format === "txtshell-encrypted-v1") {
      beginEncryptedImport(data);
      return;
    }
    if (Array.isArray(data)) {
      await mergeImportedEntries(data);
      return;
    }
    composerHint.textContent = "Invalid import file";
  });
  fileInput.click();
}

// Freshness of an entry for same-id merge decisions: editedAt when present and
// parseable, else createdAt, else oldest-possible. A missing or malformed stamp
// must never throw and must never beat a valid one.
function entryFreshness(entry) {
  for (const value of [entry?.editedAt, entry?.createdAt]) {
    // Shape check before parsing: Date.parse is lenient ("9999junk" parses as
    // year 9999), and a garbage stamp must never outrank a real one.
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const time = Date.parse(value);
      if (!Number.isNaN(time)) {
        return time;
      }
    }
  }
  return -Infinity;
}

async function mergeImportedEntries(items) {
  if (!Array.isArray(items)) {
    composerHint.textContent = "Invalid import file";
    return;
  }
  if (items.length > MAX_IMPORT_ENTRIES) {
    composerHint.textContent = `Import too large: ${items.length} entries (max ${MAX_IMPORT_ENTRIES})`;
    return;
  }
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let kept = 0;      // flagged items stored as unreadable (no readable copy here)
  let recovered = 0; // readable items that superseded a local unreadable copy
  for (const item of items) {
    if (typeof item.id !== "string" || typeof item.text !== "string" || typeof item.createdAt !== "string") {
      skipped++;
      continue;
    }
    if (item.text.length > MAX_IMPORT_ENTRY_TEXT) {
      skipped++;
      continue;
    }
    if (isUnreadableRecord(item)) {
      // A flagged copy: ciphertext under a key the sender lacked. Never index
      // it (no tags/mentions over ciphertext), never show it. The rule: a
      // readable copy of the id here beats it outright.
      if (!isCiphertextShaped(item.text)) {
        skipped++;
        continue;
      }
      if (state.entries.some((e) => e.id === item.id)) {
        continue; // readable here — the flagged copy carries nothing we lack
      }
      const existingUnreadable = state.unreadable.find((u) => u.id === item.id);
      if (existingUnreadable) {
        if (existingUnreadable.text === item.text || entryFreshness(item) <= entryFreshness(existingUnreadable)) {
          continue; // same ciphertext, or ours is as fresh — keep ours
        }
        const replacement = unreadableRecordOf(item);
        await putEntryRecord(replacement);
        Object.assign(existingUnreadable, replacement);
      } else {
        const record = unreadableRecordOf(item);
        await putEntryRecord(record); // verbatim: saveEntry would encrypt ciphertext again
        state.unreadable.push(record);
      }
      kept++;
      continue;
    }
    const entry = {
      id: item.id,
      text: item.text,
      tags: extractTags(item.text),
      mentions: extractMentions(item.text),
      createdAt: item.createdAt,
      editedAt: typeof item.editedAt === "string" ? item.editedAt : item.createdAt,
      pinned: item.pinned === true,
      ...(typeof item.olderVersionOf === "string" ? { olderVersionOf: item.olderVersionOf } : {}),
    };
    const existing = state.entries.find((e) => e.id === entry.id);
    if (existing) {
      // Same id on both sides: the newer edit wins (createdAt never changes, so
      // comparing it would always tie and silently drop imported edits). Ties
      // keep the local copy — an identical re-import stays a no-op.
      if (entryFreshness(entry) > entryFreshness(existing)) {
        Object.assign(existing, entry);
        await saveEntry(existing);
        updated++;
      }
    } else {
      // A readable copy of an id we hold only as unreadable supersedes it
      // (saveEntry overwrites the flagged record by id).
      const unreadableIndex = state.unreadable.findIndex((u) => u.id === entry.id);
      if (unreadableIndex !== -1) {
        state.unreadable.splice(unreadableIndex, 1);
        recovered++;
      }
      state.entries.push(entry);
      await saveEntry(entry);
      added++;
    }
  }
  state.entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  render();
  const extras = [];
  if (recovered > 0) extras.push(`recovered ${recovered} from the cloud`);
  if (kept > 0) extras.push(`${kept} unreadable kept`);
  if (skipped > 0) extras.push(`${skipped} skipped (oversized or malformed)`);
  if (added === 0 && updated === 0) {
    composerHint.textContent = extras.length > 0
      ? `No new entries to import (${extras.join(", ")})`
      : "No new entries to import";
  } else {
    const parts = [];
    if (added > 0) parts.push(`${added} new`);
    if (updated > 0) parts.push(`${updated} updated`);
    composerHint.textContent = `Imported ${parts.concat(extras).join(", ")}`;
  }
  return { added, updated, recovered, kept, skipped };
}

function beginEncryptedImport(fileData) {
  if (isPhraseWrappedExport(fileData)) {
    void beginAccountBackupImport(fileData);
    return;
  }
  state.vaultPending = { importFileData: fileData };
  state.vaultView = "import-unlock";
  renderVault();
}

// An account backup (plan §17.1). Its notes are under the account's own key, which only changes when
// the account is started over — so signing in opens it with nothing to type. On the account already:
// try the key in memory first and merge at once. Otherwise lead with "Sign in to your account"; the 12
// words are the fallback (offline, no account) and the answer when the key no longer opens it.
async function beginAccountBackupImport(file) {
  if (isCentral() && state.encryption.unlocked && state.encryption.masterKey) {
    const entries = await openImportWithKey(file, state.encryption.masterKey);
    if (entries) {
      const counts = await mergeImportedEntries(entries);
      composerHint.textContent = backupAddedHint(counts);
      return;
    }
    state.vaultPending = { importFileData: file, importDifferentWords: true };
    state.vaultView = "import-phrase";
    renderVault();
    return;
  }
  state.vaultPending = { importFileData: file };
  state.vaultView = "import-account";
  renderVault();
}

// The backup's entries if `key` is the key it was made under (its verify token opens), else null.
async function openImportWithKey(file, key) {
  if (!key || !file?.verify || !file.iv || !file.ciphertext) return null;
  try {
    if ((await decryptCiphertext(file.verify, key)) !== ENC_VERIFY_PLAINTEXT) return null;
  } catch {
    return null;
  }
  return decryptImportPayload(file, key);
}

function backupAddedHint({ added = 0, updated = 0 } = {}, { signedIn = false } = {}) {
  const n = added + updated;
  const body = n > 0 ? `${pluralCount(n, "note")} from the backup added.` : "everything in the backup was already here.";
  return signedIn ? `Signed in — ${body}` : body.charAt(0).toUpperCase() + body.slice(1);
}

function renderImportAccountCard() {
  const file = state.vaultPending?.importFileData;
  if (!file) {
    exitVaultToNormal();
    return;
  }
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Import a backup</p>
      <p class="vault-subtitle">This backup is from your Txtshell account.</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="signin">Sign in to your account</button>
      <p class="vault-subtitle" data-field="signin-note">Your notes open and keep syncing. Nothing new to remember.</p>
      <button class="vault-link" type="button" data-action="words">Open it on this device only, with your 12 words</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  vaultOverlay.querySelector('[data-action="signin"]').addEventListener("click", () => {
    if (navigator.onLine === false) {
      errorLine.textContent = "Signing in needs a connection. You can still open it on this device with your 12 words.";
      errorLine.hidden = false;
      return;
    }
    // The backup waits in memory behind the sign-in; finishCentralJoin opens and merges it.
    centralPendingImport = file;
    state.vaultPending = null;
    state.vaultView = "central-start";
    renderVault();
  });
  vaultOverlay.querySelector('[data-action="words"]').addEventListener("click", () => {
    state.vaultPending = { importFileData: file };
    state.vaultView = "import-phrase";
    renderVault();
  });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", () => {
    centralPendingImport = null;
    exitVaultToNormal();
  });
}

// After a join with a backup waiting: open it with the account's key and merge it BEFORE the first
// pull, so the pull meets it as local notes (the first-join card offers to keep both). If the key
// doesn't open it — started over since, or another account — ask for the backup's own words; the
// pull waits until that card is answered or cancelled.
async function finishPendingImport() {
  const file = centralPendingImport;
  centralPendingImport = null;
  if (!file) return;
  const entries = await openImportWithKey(file, state.encryption.masterKey);
  if (entries) {
    const counts = await mergeImportedEntries(entries);
    state.central.firstJoin = true;
    composerHint.textContent = backupAddedHint(counts, { signedIn: true });
    return;
  }
  await new Promise((resolve) => {
    state.vaultPending = { importFileData: file, importDifferentWords: true, importDone: resolve };
    state.vaultView = "import-phrase";
    renderVault();
  });
}

function isPhraseWrappedExport(file) {
  return Boolean(file && !file.wrappedPass && file.wrappedPhrase
    && typeof file.wrappedPhrase.blob === "string" && typeof file.wrappedPhrase.hkdfSalt === "string");
}

// Same day of the month as today, in any earlier month or year.
function isOnThisDay(value) {
  const date = new Date(value);
  const now = new Date();
  if (date.getDate() !== now.getDate()) {
    return false;
  }
  return date.getFullYear() < now.getFullYear() || date.getMonth() < now.getMonth();
}

function isToday(value) {
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isYesterday(value) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

function isLastWeek(value) {
  const date = new Date(value);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  return date >= weekAgo && date <= now;
}

function removeEntry(entryId) {
  if (!state.db) {
    return Promise.resolve();
  }
  scheduleCloudSync();
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(ENTRY_STORE, "readwrite");
    transaction.objectStore(ENTRY_STORE).delete(entryId);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function getMeta(key) {
  if (!state.db) {
    return Promise.resolve("");
  }
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(META_STORE, "readonly");
    const request = transaction.objectStore(META_STORE).get(key);
    request.addEventListener("success", () => resolve(request.result?.value || ""));
    request.addEventListener("error", () => reject(request.error));
  });
}

function saveMeta(key, value) {
  if (!state.db) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).put({ key, value });
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function deleteMeta(key) {
  if (!state.db) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).delete(key);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function isVaultLocked() {
  return state.encryption.enabled && !state.encryption.unlocked;
}

// Sent once per unlock (reset by lockVault) — the extension drains its capture
// queue on it, so a lock/unlock in the same tab must re-trigger the drain.
let readySignalSent = false;
function signalReady() {
  if (readySignalSent) return;
  if (isVaultLocked()) return;
  readySignalSent = true;
  flushHeldCaptures();
  window.postMessage({ type: "txtshell_ready" }, "*");
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBytes(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function combineIvAndData(iv, data) {
  const combined = new Uint8Array(iv.length + data.length);
  combined.set(iv, 0);
  combined.set(data, iv.length);
  return combined;
}

async function deriveWrappingKey(passphrase, saltBytes, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

async function readIterations(key) {
  const stored = await getMeta(key);
  const n = parseInt(stored, 10);
  return Number.isFinite(n) && n > 0 ? n : LEGACY_PBKDF2_ITERATIONS;
}

function saveMetaBatch(entries) {
  if (!state.db) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(META_STORE, "readwrite");
    const store = transaction.objectStore(META_STORE);
    for (const [key, value] of entries) {
      store.put({ key, value });
    }
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function readLockoutState() {
  const [failRaw, lockedUntil, escRaw] = await Promise.all([
    getMeta(ENC_UNLOCK_FAIL_COUNT),
    getMeta(ENC_UNLOCK_LOCKED_UNTIL),
    getMeta(ENC_UNLOCK_ESCALATION),
  ]);
  const failCount = parseInt(failRaw, 10);
  const escalation = parseInt(escRaw, 10);
  return {
    failCount: Number.isFinite(failCount) && failCount > 0 ? failCount : 0,
    lockedUntil: lockedUntil || "",
    escalation: Number.isFinite(escalation) && escalation > 0 ? escalation : 0,
  };
}

function getLockoutRemainingMs(lockoutState) {
  if (!lockoutState.lockedUntil) return 0;
  const until = Date.parse(lockoutState.lockedUntil);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

function isCurrentlyLockedOut(lockoutState) {
  return getLockoutRemainingMs(lockoutState) > 0;
}

async function recordUnlockFailure() {
  const { failCount, escalation } = await readLockoutState();
  const newCount = failCount + 1;
  const updates = [[ENC_UNLOCK_FAIL_COUNT, String(newCount)]];
  if (newCount >= LOCKOUT_THRESHOLD) {
    const idx = Math.min(escalation, LOCKOUT_DURATIONS_MS.length - 1);
    const until = new Date(Date.now() + LOCKOUT_DURATIONS_MS[idx]).toISOString();
    updates.push([ENC_UNLOCK_LOCKED_UNTIL, until]);
    updates.push([ENC_UNLOCK_ESCALATION, String(escalation + 1)]);
  }
  await saveMetaBatch(updates);
}

async function resetUnlockState() {
  await Promise.all([
    deleteMeta(ENC_UNLOCK_FAIL_COUNT),
    deleteMeta(ENC_UNLOCK_LOCKED_UNTIL),
    deleteMeta(ENC_UNLOCK_ESCALATION),
  ]);
}

function formatLockoutRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

let unlockCountdownInterval = null;
function clearUnlockCountdown() {
  if (unlockCountdownInterval !== null) {
    window.clearInterval(unlockCountdownInterval);
    unlockCountdownInterval = null;
  }
}

async function migratePassphraseWrap(passphrase, masterKey) {
  const newSalt = randomBytes(16);
  const newWrappingKey = await deriveWrappingKey(passphrase, newSalt, PBKDF2_ITERATIONS);
  const newWrapped = await wrapMasterKey(masterKey, newWrappingKey);
  await saveMetaBatch([
    [ENC_SALT_PASS_KEY, bytesToBase64(newSalt)],
    [ENC_WRAPPED_PASS_KEY, newWrapped],
    [ENC_ITERATIONS_PASS_KEY, String(PBKDF2_ITERATIONS)],
  ]);
}

async function migrateRecoveryWrap(recoveryKey, masterKey) {
  const newSalt = randomBytes(16);
  const newWrappingKey = await deriveWrappingKey(recoveryKey, newSalt, PBKDF2_ITERATIONS);
  const newWrapped = await wrapMasterKey(masterKey, newWrappingKey);
  await saveMetaBatch([
    [ENC_SALT_RECOVERY_KEY, bytesToBase64(newSalt)],
    [ENC_WRAPPED_RECOVERY_KEY, newWrapped],
    [ENC_ITERATIONS_RECOVERY_KEY, String(PBKDF2_ITERATIONS)],
  ]);
}

async function generateMasterKey() {
  // Must stay extractable: wrapKey() can only wrap an extractable key.
  // The long-lived session key is obtained via unwrapMasterKey (non-extractable);
  // this freshly generated handle is wrapped, then discarded.
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function wrapMasterKey(masterKey, wrappingKey) {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey(
    "raw",
    masterKey,
    wrappingKey,
    { name: "AES-GCM", iv },
  );
  return bytesToBase64(combineIvAndData(iv, new Uint8Array(wrapped)));
}

async function unwrapMasterKey(base64, wrappingKey, extractable = false) {
  const combined = base64ToBytes(base64);
  const iv = combined.slice(0, 12);
  const wrapped = combined.slice(12);
  return crypto.subtle.unwrapKey(
    "raw",
    wrapped,
    wrappingKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  );
}

async function encryptPlaintext(plaintext, masterKey) {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    new TextEncoder().encode(plaintext),
  );
  return bytesToBase64(combineIvAndData(iv, new Uint8Array(ciphertext)));
}

async function decryptCiphertext(base64, masterKey) {
  const combined = base64ToBytes(base64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plainBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    masterKey,
    ciphertext,
  );
  return new TextDecoder().decode(plainBytes);
}

function generateRecoveryKey() {
  const bytes = randomBytes(16);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `rk-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function verifyMasterKey(masterKey) {
  const verifyBase64 = await getMeta(ENC_VERIFY_KEY);
  if (!verifyBase64) {
    return false;
  }
  try {
    const plaintext = await decryptCiphertext(verifyBase64, masterKey);
    return plaintext === ENC_VERIFY_PLAINTEXT;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Unreadable records. A record the current key cannot open is never dropped,
// never deleted (only /wipe removes it) and never shown as a block. It is kept
// in memory as the raw record so it can travel with the vault: the sync blob
// and both exports carry it flagged `unreadable: true` with its ciphertext
// untouched, and any device that holds (or later obtains) the right key reads
// it as an ordinary block. One rule resolves a collision everywhere, in both
// directions: a READABLE copy of an id beats an UNREADABLE copy of the same id.
// ---------------------------------------------------------------------------

// Every record saveEntry has ever written is base64(IV(12) || ct || tag(16)):
// strict base64, length % 4 == 0, at least 28 bytes decoded. A record that
// fails this cannot be our ciphertext — it is plaintext left behind by an
// interrupted /encrypt, and is recoverable as-is. A record that passes it but
// fails GCM is under a key this device does not hold.
function isCiphertextShaped(text) {
  if (typeof text !== "string" || text.length === 0 || text.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return false;
  try {
    return base64ToBytes(text).length >= 28;
  } catch {
    return false;
  }
}

function isUnreadableRecord(record) {
  return Boolean(record) && record.unreadable === true;
}

// The in-memory / IndexedDB shape of an unreadable record: the ciphertext
// verbatim, no derived fields (never index ciphertext), flagged.
function unreadableRecordOf(record) {
  return {
    id: record.id,
    text: record.text,
    tags: [],
    mentions: [],
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    editedAt: typeof record.editedAt === "string" ? record.editedAt : (record.createdAt || ""),
    pinned: record.pinned === true,
    unreadable: true,
  };
}

// The shape an unreadable record takes inside the sync blob and the exports.
function blobRecordOf(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    editedAt: record.editedAt,
    pinned: record.pinned === true,
    unreadable: true,
    text: record.text,
  };
}

function entryFromPlaintext(record, text) {
  return {
    id: record.id,
    text,
    tags: extractTags(text),
    mentions: extractMentions(text),
    createdAt: record.createdAt,
    editedAt: record.editedAt || record.createdAt,
    pinned: record.pinned === true,
    ...(typeof record.olderVersionOf === "string" ? { olderVersionOf: record.olderVersionOf } : {}),
  };
}

// A short, user-facing summary of the unlock outcome for the composer hint.
function describeUnlockOutcome(outcome, unit = "block") {
  const parts = [];
  if (outcome.recovered.length > 0) {
    parts.push(`recovered ${pluralCount(outcome.recovered.length, unit)} left unencrypted by an interrupted /encrypt`);
  }
  if (outcome.unreadable > 0) {
    parts.push(`${pluralCount(outcome.unreadable, unit)} can't be read with this key (kept, not deleted)`);
  }
  return parts.join(" · ");
}

// Decrypts every record into state. A record that fails is classified, not
// dropped: a plaintext leftover is recovered into `entries` (and returned so
// the caller re-encrypts it), anything else is kept in `state.unreadable`.
// Returns { recovered: entry[], unreadable: count }.
async function decryptAllEntriesIntoState() {
  const raw = await getAllEntries();
  const decrypted = [];
  const unreadable = [];
  const recovered = [];
  for (const record of raw) {
    try {
      const text = await decryptCiphertext(record.text, state.encryption.masterKey);
      decrypted.push(entryFromPlaintext(record, text));
      continue;
    } catch (error) {
      console.error("Failed to decrypt entry", record.id, error);
    }
    // A record that arrived flagged was already judged by the device that
    // flagged it; never run the plaintext heuristic on it.
    if (!isUnreadableRecord(record) && !isCiphertextShaped(record.text)) {
      const entry = entryFromPlaintext(record, record.text);
      decrypted.push(entry);
      recovered.push(entry);
    } else {
      unreadable.push(unreadableRecordOf(record));
    }
  }
  decrypted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  state.entries = decrypted;
  state.unreadable = unreadable;
  return { recovered, unreadable: unreadable.length };
}

// Re-encrypts plaintext leftovers in place. One record per write: a crash
// mid-way leaves plaintext records, which the next unlock recovers again.
async function reencryptRecovered(outcome) {
  for (const entry of outcome.recovered) {
    await saveEntry(entry);
  }
}

// Replaces every block record and the listed meta rows under a new key in ONE
// IndexedDB transaction, so the store is entirely on the old key or entirely
// on the new one — never mixed. Two phases, because an IDB transaction goes
// inactive the moment control returns to the event loop with no request
// pending, and `await crypto.subtle.*` does exactly that:
//   1. all crypto, in memory, no transaction open (every await is here);
//   2. one write-only transaction: every put/delete issued synchronously.
// `key` null writes plaintext records (/encrypt off). Unreadable records are
// never re-encrypted: they are written back verbatim WITH the flag, so a store
// that ends up in plaintext (/encrypt off) cannot mistake their ciphertext for
// a block on the next load.
// `entries` null = META ONLY: the key does not change, so no record (flagged or
// not) is touched; the meta rows still land in the same single transaction.
// This is the one path by which vault meta is ever written for a key change or
// a mode change (Txtshell account join / leave / cached-wrap refresh).
async function rekeyVault({ entries, key, flagged = state.unreadable, metaPuts = [], metaDeletes = [] }) {
  const records = entries === null ? [] : flagged.map(unreadableRecordOf);
  for (const entry of entries || []) {
    records.push(key
      ? {
        id: entry.id,
        text: await encryptPlaintext(entry.text, key),
        tags: [],
        mentions: [],
        createdAt: entry.createdAt,
        editedAt: entry.editedAt || entry.createdAt,
        pinned: entry.pinned === true,
      }
      : {
        id: entry.id,
        text: entry.text,
        tags: extractTags(entry.text),
        mentions: extractMentions(entry.text),
        createdAt: entry.createdAt,
        editedAt: entry.editedAt || entry.createdAt,
        pinned: entry.pinned === true,
      });
  }
  if (!state.db) {
    throw new Error("storage-unavailable");
  }
  await new Promise((resolve, reject) => {
    const transaction = state.db.transaction([ENTRY_STORE, META_STORE], "readwrite", { durability: "strict" });
    const entryStore = transaction.objectStore(ENTRY_STORE);
    const metaStore = transaction.objectStore(META_STORE);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("rekey-aborted")));
    transaction.addEventListener("error", () => reject(transaction.error || new Error("rekey-failed")));
    try {
      for (const record of records) {
        entryStore.put(record);
      }
      for (const [metaKey, value] of metaPuts) {
        metaStore.put({ key: metaKey, value });
      }
      for (const metaKey of metaDeletes) {
        metaStore.delete(metaKey);
      }
    } catch (error) {
      // A request that throws while being issued (an invalid key, a closed store) must take the
      // requests already queued down with it, or the store commits half re-keyed.
      try { transaction.abort(); } catch { /* already aborting */ }
      reject(error);
    }
  });
}

// Deletes exactly the listed ids. Replaces the old "clear the whole store"
// so records that are not in `entries` (unreadable ones) survive a replace.
function deleteEntryRecords(ids) {
  if (!state.db || ids.length === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(ENTRY_STORE, "readwrite");
    const store = transaction.objectStore(ENTRY_STORE);
    for (const id of ids) {
      store.delete(id);
    }
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function updateLockButton() {
  renderSyncIndicator();
  if (!lockButton) {
    return;
  }
  if (!state.encryption.enabled) {
    lockButton.hidden = true;
    lockButton.removeAttribute("data-state");
    return;
  }
  lockButton.hidden = false;
  const locked = !state.encryption.unlocked;
  lockButton.dataset.state = locked ? "locked" : "unlocked";
  lockButton.setAttribute("aria-label", locked ? "Your notes are locked" : "Lock your notes");
  lockButton.setAttribute("title", locked ? "Your notes are locked" : "Lock your notes");
  const shackle = lockButton.querySelector(".lock-shackle");
  if (shackle) {
    shackle.setAttribute(
      "d",
      locked ? "M6 8V5.5a3 3 0 0 1 6 0V8" : "M12 8V5.5a3 3 0 0 0-6 0",
    );
  }
}

function lockVault() {
  state.encryption.unlocked = false;
  state.encryption.masterKey = null;
  state.central.session = null; // an account session never outlives an unlocked tab
  state.entries = [];
  state.unreadable = [];
  state.search = "";
  state.preset = null;
  state.selectedEntryId = null;
  state.editingEntryId = null;
  state.pendingDeletedEntries = null;
  state.stashedDraft = null;
  setEditorValue("");
  clearDraft();
  hidePinnedPanel();
  if (state.searchMode) {
    closeSearchMode();
  }
  // Locked means no decrypted content reachable: drop rendered blocks from the
  // hidden search view, close inbox triage, and release any pairing payload.
  entryList.innerHTML = "";
  if (inboxState) {
    endInbox();
  }
  clearMirrorDismiss();
  mirrorPayload = null;
  state.vaultView = "unlock";
  state.vaultPending = null;
  state.central.unlockFailures = 0;
  centralRescuedKey = null;
  readySignalSent = false; // next unlock re-announces readiness so the extension drains its queue
  renderVault();
  updateLockButton();
  composerHint.textContent = "Your notes are locked";
  render();
}

let lastRenderedVaultView = null;
function renderVault() {
  clearUnlockCountdown();
  clearMirrorDismiss();
  const view = state.vaultView;
  // Leaving the pull-conflict card by ANY route (keep, replace, lock, wipe, port…)
  // lifts the push hold. Locked/disabled vaults make the replay a harmless skip.
  const leftPullConflict = PUSH_HOLD_VIEWS.includes(lastRenderedVaultView) && !PUSH_HOLD_VIEWS.includes(view);
  lastRenderedVaultView = view;
  if (leftPullConflict) {
    releaseDeferredPush();
  }
  if (!view) {
    vaultOverlay.hidden = true;
    vaultOverlay.innerHTML = "";
    entryInput.disabled = false;
    return;
  }

  vaultOverlay.hidden = false;
  entryInput.disabled = true;

  if (view === "setup") {
    renderSetupCard();
  } else if (view === "recovery-display") {
    renderRecoveryDisplayCard();
  } else if (view === "encrypting") {
    renderEncryptingCard("Encrypting your blocks");
  } else if (view === "decrypting") {
    renderEncryptingCard("Decrypting your blocks");
  } else if (view === "unlock") {
    if (isCentral()) renderCentralUnlockCard(); else renderUnlockCard(false);
  } else if (view === "unlock-recovery") {
    renderUnlockCard(true);
  } else if (view === "change-current") {
    renderPassphraseConfirmCard({
      title: "Change passphrase",
      subtitle: "Enter your current passphrase to continue.",
      buttonText: "Continue",
      onSubmit: handleChangeCurrentSubmit,
      onCancel: exitVaultToNormal,
    });
  } else if (view === "change-new") {
    renderSetupCard({
      title: "New passphrase",
      subtitle: "Choose a new passphrase. You will still be able to unlock with your existing recovery key.",
      buttonText: "Save new passphrase",
      skipRecovery: true,
      onSubmit: handleChangeNewSubmit,
      onCancel: exitVaultToNormal,
    });
  } else if (view === "disable-confirm") {
    renderPassphraseConfirmCard({
      title: "Turn off encryption",
      subtitle: state.unreadable.length > 0
        ? `Enter your passphrase. Your blocks will be restored to plaintext in local storage. ${pluralCount(state.unreadable.length, "block")} this key can't read will stay unreadable.`
        : "Enter your passphrase. Your blocks will be restored to plaintext in local storage.",
      buttonText: "Turn off encryption",
      onSubmit: handleDisableSubmit,
      onCancel: exitVaultToNormal,
    });
  } else if (view === "import-unlock") {
    renderImportUnlockCard(false);
  } else if (view === "import-unlock-recovery") {
    renderImportUnlockCard(true);
  } else if (view === "import-adopt") {
    renderImportAdoptCard();
  } else if (view === "import-phrase") {
    renderImportPhraseCard();
  } else if (view === "import-account") {
    renderImportAccountCard();
  } else if (view === "import-phrase-passphrase") {
    renderSetupCard({
      title: "Choose a passphrase for this browser",
      subtitle: "Protect these notes with a passphrase. If you sign in to your account here later, they join it as they are.",
      buttonText: "Protect my notes",
      skipRecovery: true,
      onSubmit: handleImportPhraseAdoptSubmit,
      onCancel: exitVaultToNormal,
    });
  } else if (view === "wipe-confirm") {
    renderWipeCard(false);
  } else if (view === "wipe-confirm-recovery") {
    renderWipeCard(true);
  } else if (view === "sync-setup") {
    renderSyncSetupCard();
  } else if (view === "mirror-confirm") {
    renderPassphraseConfirmCard({
      title: "Pair a device",
      subtitle: "Enter your passphrase to reveal the pairing QR.",
      buttonText: "Reveal QR",
      onSubmit: handleMirrorSubmit,
      onCancel: exitVaultToNormal,
    });
  } else if (view === "mirror-display") {
    renderMirrorDisplayCard();
  } else if (view === "port-paste") {
    renderPortPasteCard();
  } else if (view === "port-passphrase") {
    renderSetupCard({
      title: "Set a passphrase for this browser",
      subtitle: "Use the same passphrase as your other browsers so you only need to remember one.",
      buttonText: "Continue",
      skipRecovery: true,
      onSubmit: handlePortPassphraseSubmit,
      onCancel: exitVaultToNormal,
    });
  } else if (view === "pull-conflict") {
    renderPullConflictCard();
  } else if (view === "key-mismatch") {
    renderKeyMismatchCard();
  } else if (view === "central-start") {
    renderCentralStartCard();
  } else if (view === "central-email-signin" || view === "central-email-new") {
    renderCentralEmailCard(view === "central-email-signin" ? "signin" : "new");
  } else if (view === "central-waitlist") {
    renderCentralWaitlistCard();
  } else if (view === "central-waitlist-joined") {
    renderCentralWaitlistJoinedCard();
  } else if (view === "central-readd-rescue") {
    renderCentralReaddRescueCard();
  } else if (view === "central-code") {
    renderCentralCodeCard();
  } else if (view === "central-registered") {
    renderCentralRegisteredCard();
  } else if (view === "central-has-passkey") {
    renderCentralHasPasskeyCard();
  } else if (view === "central-busy") {
    renderCentralBusyCard(state.vaultPending?.busy || "Working");
  } else if (view === "central-forced-save") {
    renderCentralForcedSaveCard();
  } else if (view === "central-rung2") {
    renderCentralRung2Card();
  } else if (view === "central-abandon") {
    renderCentralAbandonCard();
  } else if (view === "central-passphrase") {
    renderCentralPassphraseCard();
  } else if (view === "central-account") {
    renderCentralAccountCard();
  } else if (view === "central-signout") {
    renderCentralSignOutCard();
  } else if (view === "central-new-words") {
    renderCentralNewWordsCard();
  } else if (view === "central-devices") {
    void renderCentralDevicesCard();
  } else if (view === "central-leave") {
    renderSetupCard({
      title: "Choose a passphrase for this browser",
      subtitle: "Your notes stay on this browser, locked with this passphrase instead. Your account and your other devices aren't affected.",
      buttonText: "Leave the account",
      skipRecovery: true,
      onSubmit: handleAccountLeaveSubmit,
      onCancel: exitVaultToNormal,
    });
  } else if (view === "central-export") {
    renderCentralExportCard();
  } else if (view === "first-join") {
    renderFirstJoinCard();
  } else if (view === "sync-removed") {
    renderSyncRemovedCard();
  }
}

const LOCK_ICON_SVG = `<svg class="vault-icon" width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
// The account card's mark: a cloud, not the padlock — "Sync is on" isn't "locked" (manual-run finding 4).
const SYNC_ICON_SVG = `<svg class="vault-icon" width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M5.25 14.25h7.5a3 3 0 0 0 .35-5.98 4.4 4.4 0 0 0-8.5.15A2.95 2.95 0 0 0 5.25 14.25z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const LOCK_ICON_SVG_DOT = `<svg class="vault-icon" width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="12.5" r="1.2" fill="currentColor"/></svg>`;

function calculatePassphraseStrength(passphrase) {
  if (!passphrase) return "empty";

  let score = 0;
  const length = passphrase.length;

  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (length >= 16) score += 1;
  if (/[a-z]/.test(passphrase)) score += 1;
  if (/[A-Z]/.test(passphrase)) score += 1;
  if (/\d/.test(passphrase)) score += 1;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1;

  if (length > 1 && passphrase.split("").every((c) => c === passphrase[0])) {
    score -= 1;
  }

  const sequences = [
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    "qwertyuiopasdfghjklzxcvbnm",
  ];
  const lower = passphrase.toLowerCase();
  if (lower.length >= 3 && sequences.some((seq) => seq.includes(lower))) {
    score -= 1;
  }

  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

function renderSetupCard(options = {}) {
  const {
    title = "Encrypt your blocks",
    subtitle = "Choose a passphrase. Your blocks will be encrypted locally — only you can read them.",
    buttonText = "Set up encryption",
    skipRecovery = false,
    onSubmit = handleSetupSubmit,
    onCancel = exitVaultToNormal,
  } = options;

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">${escapeHtml(title)}</p>
      <p class="vault-subtitle">${escapeHtml(subtitle)}</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="pass" type="password" placeholder="Create passphrase" autocomplete="new-password" />
      <p class="vault-strength" data-field="strength"></p>
      <input class="vault-input" data-field="confirm" type="password" placeholder="Confirm passphrase" autocomplete="new-password" />
      <button class="vault-button" type="button" data-action="submit">${escapeHtml(buttonText)}</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const confirmInput = vaultOverlay.querySelector('[data-field="confirm"]');
  const strengthEl = vaultOverlay.querySelector('[data-field="strength"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const cancelButton = vaultOverlay.querySelector('[data-action="cancel"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  const submit = async () => {
    const pass = passInput.value;
    const confirm = confirmInput.value;
    if (!pass || pass.length < 8) {
      showError("Use at least 8 characters.");
      return;
    }
    if (pass !== confirm) {
      showError("Passphrases do not match.");
      return;
    }
    showError("");
    submitButton.disabled = true;
    try {
      await onSubmit(pass, { skipRecovery });
    } catch (error) {
      console.error(error);
      showError("Something went wrong. Try again.");
      submitButton.disabled = false;
    }
  };

  passInput.addEventListener("input", () => {
    const strength = calculatePassphraseStrength(passInput.value);
    if (strength === "empty") {
      strengthEl.textContent = "";
      strengthEl.removeAttribute("data-state");
    } else if (strength === "weak") {
      strengthEl.textContent = "Weak passphrase";
      strengthEl.setAttribute("data-state", "weak");
    } else if (strength === "medium") {
      strengthEl.textContent = "Medium passphrase";
      strengthEl.setAttribute("data-state", "medium");
    } else if (strength === "strong") {
      strengthEl.textContent = "Strong passphrase";
      strengthEl.setAttribute("data-state", "strong");
    }
  });

  submitButton.addEventListener("click", submit);
  [passInput, confirmInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
  });
  cancelButton.addEventListener("click", onCancel);
  window.requestAnimationFrame(() => passInput.focus());
}

function renderRecoveryDisplayCard() {
  const recoveryKey = state.vaultPending?.recoveryKey || "";
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Save your recovery key</p>
      <p class="vault-subtitle">If you forget your passphrase, this is the only way to recover your blocks.</p>
      <div class="recovery-key"><code data-field="recovery"></code></div>
      <p class="recovery-warning">This will not be shown again. Save it somewhere safe.</p>
      <button class="vault-button" type="button" data-action="copy">Copy recovery key</button>
      <button class="vault-button secondary" type="button" data-action="confirm">I've saved it — continue</button>
    </div>
  `;

  vaultOverlay.querySelector('[data-field="recovery"]').textContent = recoveryKey;

  const copyButton = vaultOverlay.querySelector('[data-action="copy"]');
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy recovery key";
      }, COPY_FLASH_DURATION);
    } catch {
      composerHint.textContent = "Copy failed";
    }
  });

  vaultOverlay
    .querySelector('[data-action="confirm"]')
    .addEventListener("click", handleRecoveryConfirm);
}

function renderEncryptingCard(label) {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      <p class="encrypting-status">${escapeHtml(label)}<span class="dot"> ...</span></p>
    </div>
  `;
}

async function renderUnlockCard(isRecovery) {
  let lockout = null;
  if (!isRecovery) {
    lockout = await readLockoutState();
    if (isCurrentlyLockedOut(lockout)) {
      renderUnlockCardLocked(lockout);
      return;
    }
  }

  const subtitle = isRecovery
    ? "Paste your recovery key to unlock."
    : "Enter your passphrase to unlock";
  const placeholder = isRecovery ? "Recovery key" : "Passphrase";
  const linkText = isRecovery ? "Use passphrase instead" : "Use recovery key instead";
  const failCount = lockout ? lockout.failCount : 0;
  const failHint = failCount > 0
    ? `${failCount} failed attempt${failCount === 1 ? "" : "s"}`
    : "";
  // Browsers set up via /port have no recovery wrap, so the recovery key path is a
  // dead end there — hide the toggle when no recovery wrap exists in IndexedDB.
  const hasRecoveryWrap = Boolean(await getMeta(ENC_WRAPPED_RECOVERY_KEY));

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Your notes are locked</p>
      <p class="vault-subtitle">${escapeHtml(subtitle)}</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="pass" type="${isRecovery ? "text" : "password"}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />
      <p class="vault-subtitle" data-field="failcount" ${failHint ? "" : "hidden"}>${escapeHtml(failHint)}</p>
      <button class="vault-button" type="button" data-action="submit">Unlock</button>
      ${hasRecoveryWrap ? `<button class="vault-link" type="button" data-action="toggle">${escapeHtml(linkText)}</button>` : ""}
      <button class="vault-link" type="button" data-action="wipe">Wipe all data</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const toggleButton = vaultOverlay.querySelector('[data-action="toggle"]');
  const failHintEl = vaultOverlay.querySelector('[data-field="failcount"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  const submit = async () => {
    const value = passInput.value.trim();
    if (!value) {
      showError(isRecovery ? "Enter your recovery key." : "Enter your passphrase.");
      return;
    }
    showError("");
    submitButton.disabled = true;
    submitButton.textContent = "Unlocking…";
    try {
      await handleUnlockSubmit(value, isRecovery);
    } catch (error) {
      if (!isRecovery) {
        const updated = await readLockoutState();
        if (isCurrentlyLockedOut(updated)) {
          renderVault(); // a failure just triggered lockout -> show locked card
          return;
        }
        if (failHintEl) {
          if (updated.failCount > 0) {
            failHintEl.textContent = `${updated.failCount} failed attempt${updated.failCount === 1 ? "" : "s"}`;
            failHintEl.hidden = false;
          } else {
            failHintEl.hidden = true;
          }
        }
      }
      const message = error?.message === "wrong-key"
        ? (isRecovery ? "Recovery key did not work. Try again." : "Wrong passphrase. Try again.")
        : (error?.message === "locked-out" ? "Locked. Too many attempts." : "Something went wrong. Try again.");
      showError(message);
      submitButton.disabled = false;
      submitButton.textContent = "Unlock";
      passInput.select();
    }
  };

  submitButton.addEventListener("click", submit);
  passInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      state.vaultView = isRecovery ? "unlock" : "unlock-recovery";
      renderVault();
    });
  }
  vaultOverlay.querySelector('[data-action="wipe"]').addEventListener("click", () => {
    state.vaultView = "wipe-confirm";
    renderVault();
  });
  window.requestAnimationFrame(() => passInput.focus());
}

function renderUnlockCardLocked(lockout) {
  const label = () => `Locked. Try again in ${formatLockoutRemaining(getLockoutRemainingMs(lockout))}`;
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Your notes are locked</p>
      <p class="vault-subtitle">Too many failed attempts.</p>
      <input class="vault-input" type="password" placeholder="Passphrase" autocomplete="off" disabled />
      <p class="vault-subtitle" data-field="countdown">${escapeHtml(label())}</p>
      <button class="vault-link" type="button" data-action="toggle">Use recovery key instead</button>
      <button class="vault-link" type="button" data-action="wipe">Wipe all data</button>
    </div>
  `;
  vaultOverlay.querySelector('[data-action="toggle"]').addEventListener("click", () => {
    state.vaultView = "unlock-recovery";
    renderVault();
  });
  vaultOverlay.querySelector('[data-action="wipe"]').addEventListener("click", () => {
    state.vaultView = "wipe-confirm";
    renderVault();
  });
  const countdownEl = vaultOverlay.querySelector('[data-field="countdown"]');
  clearUnlockCountdown();
  unlockCountdownInterval = window.setInterval(() => {
    if (getLockoutRemainingMs(lockout) <= 0) {
      clearUnlockCountdown();
      renderVault(); // expired -> transition back to the normal unlock card
      return;
    }
    countdownEl.textContent = label();
  }, 1000);
}

const WIPE_CONFIRM_PHRASE = "DELETE EVERYTHING";
// Txtshell account: the cloud keeps everything that synced, so the wipe needs no passkey — the
// typed sentence is the confirmation (a revoked or passkey-less device must still be able to
// wipe). The passkey stays as the fast path when one is available (decision 2026-10-11).
const WIPE_CONFIRM_PHRASE_CENTRAL = "delete my notes on this device";
const normalizeWipeSentence = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase();

function renderWipeCard(isRecovery) {
  const central = isCentral();
  const hasVault = state.encryption.enabled && !central; // central: the typed sentence (or the passkey) confirms, not a passphrase
  const placeholder = isRecovery ? "Recovery key" : "Passphrase";
  const linkText = isRecovery ? "Use passphrase instead" : "Use recovery key instead";

  const authFieldHtml = hasVault
    ? `<input class="vault-input" data-field="pass" type="${isRecovery ? "text" : "password"}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />`
    : "";
  const toggleHtml = hasVault
    ? `<button class="vault-link" type="button" data-action="toggle">${escapeHtml(linkText)}</button>`
    : "";
  const warning = central
    ? "This deletes every note on this browser and signs it out of your account. Your account and your other devices keep everything that has synced; anything not yet synced is lost. This can't be undone."
    : "This will permanently delete all your blocks and encryption settings from this browser. This cannot be undone.";

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">${central ? "Wipe this device" : "Wipe all data"}</p>
      <p class="wipe-warning">${escapeHtml(warning)}</p>
      <p class="vault-error" hidden></p>
      ${authFieldHtml}
      <input class="vault-input" data-field="confirm" type="text" placeholder="${central ? `Type: ${WIPE_CONFIRM_PHRASE_CENTRAL}` : "Type DELETE EVERYTHING"}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <button class="vault-button danger" type="button" data-action="submit" disabled>Wipe everything</button>
      ${central ? `<button class="vault-button secondary" type="button" data-action="passkey">${escapeHtml(platformOr((n) => `Confirm with ${n} instead`, "Confirm by signing in instead"))}</button>` : ""}
      ${toggleHtml}
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const confirmInput = vaultOverlay.querySelector('[data-field="confirm"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const passkeyButton = vaultOverlay.querySelector('[data-action="passkey"]');
  const toggleButton = vaultOverlay.querySelector('[data-action="toggle"]');
  const cancelButton = vaultOverlay.querySelector('[data-action="cancel"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  const updateEnabled = () => {
    const phraseOk = central ? normalizeWipeSentence(confirmInput.value) === WIPE_CONFIRM_PHRASE_CENTRAL : confirmInput.value === WIPE_CONFIRM_PHRASE;
    const authOk = !hasVault || (passInput && passInput.value.trim().length > 0);
    submitButton.disabled = !(phraseOk && authOk);
  };

  const submit = async ({ viaPasskey = false } = {}) => {
    if (!viaPasskey && submitButton.disabled) {
      return;
    }
    showError("");
    submitButton.disabled = true;
    if (passkeyButton) passkeyButton.disabled = true;
    if (viaPasskey) passkeyButton.textContent = "Confirming…"; else submitButton.textContent = "Wiping…";
    try {
      await handleWipeSubmit(passInput ? passInput.value.trim() : "", isRecovery, confirmInput.value, { viaPasskey });
    } catch (error) {
      const message = error?.message === "locked-out"
        ? "Too many attempts. Use the recovery key, or wait."
        : (error?.message === "wrong-key" || error?.message === "missing-meta"
          ? (viaPasskey ? "Couldn't confirm — type the sentence instead." : "Couldn't verify — passphrase or recovery key may be wrong")
          : (viaPasskey ? "Couldn't confirm — type the sentence instead." : "Something went wrong. Try again."));
      showError(message);
      submitButton.textContent = "Wipe everything";
      if (passkeyButton) { passkeyButton.textContent = platformOr((n) => `Confirm with ${n} instead`, "Confirm by signing in instead"); passkeyButton.disabled = false; }
      updateEnabled();
      if (passInput) {
        passInput.select();
      }
    }
  };

  if (passInput) {
    passInput.addEventListener("input", updateEnabled);
  }
  confirmInput.addEventListener("input", updateEnabled);
  submitButton.addEventListener("click", () => submit());
  if (passkeyButton) passkeyButton.addEventListener("click", () => submit({ viaPasskey: true }));
  [passInput, confirmInput].filter(Boolean).forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
  });
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      state.vaultView = isRecovery ? "wipe-confirm" : "wipe-confirm-recovery";
      renderVault();
    });
  }
  cancelButton.addEventListener("click", exitVaultToNormal);
  window.requestAnimationFrame(() => (passInput || confirmInput).focus());
}

async function handleWipeSubmit(value, isRecovery, confirmPhrase, { viaPasskey = false } = {}) {
  if (isCentral()) {
    // Either confirmation stands on its own: the typed sentence (no passkey needed — the account
    // keeps what synced, and a revoked or passkey-less device must still be able to wipe) or the
    // passkey as the fast path.
    if (viaPasskey) await centralExtractableKey();
    else if (normalizeWipeSentence(confirmPhrase) !== WIPE_CONFIRM_PHRASE_CENTRAL) throw new Error("phrase-mismatch");
  } else if (confirmPhrase !== WIPE_CONFIRM_PHRASE) {
    throw new Error("phrase-mismatch");
  } else if (state.encryption.enabled) {
    if (!isRecovery) {
      const lockout = await readLockoutState();
      if (isCurrentlyLockedOut(lockout)) {
        const error = new Error("locked-out");
        error.lockedUntil = lockout.lockedUntil;
        throw error;
      }
    }
    const saltKey = isRecovery ? ENC_SALT_RECOVERY_KEY : ENC_SALT_PASS_KEY;
    const wrappedKey = isRecovery ? ENC_WRAPPED_RECOVERY_KEY : ENC_WRAPPED_PASS_KEY;
    const iterKey = isRecovery ? ENC_ITERATIONS_RECOVERY_KEY : ENC_ITERATIONS_PASS_KEY;
    const saltBase64 = await getMeta(saltKey);
    const wrappedBase64 = await getMeta(wrappedKey);
    const iterations = await readIterations(iterKey);
    try {
      if (!saltBase64 || !wrappedBase64) {
        throw new Error("missing-meta");
      }
      const wrappingKey = await deriveWrappingKey(value, base64ToBytes(saltBase64), iterations);
      let masterKey;
      try {
        masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey);
      } catch {
        throw new Error("wrong-key");
      }
      if (!(await verifyMasterKey(masterKey))) {
        throw new Error("wrong-key");
      }
    } catch (error) {
      // Only wrong guesses escalate lockout — infrastructure errors
      // (missing metadata, IndexedDB failures) are not attempts.
      if (!isRecovery && error?.message === "wrong-key") {
        await recordUnlockFailure();
      }
      throw error;
    }
  }

  await performWipe();
}

function deleteDatabase(name, onBlocked) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => {
      console.warn("[txtshell] deleteDatabase blocked — another tab may still have it open");
      if (onBlocked) {
        onBlocked();
      }
    });
  });
}

async function performWipe() {
  if (state.db) {
    state.db.close();
    state.db = null;
  }
  clearMirrorDismiss();
  mirrorPayload = null;

  // localStorage first — it can't block, so it's cleaned even if the DB delete
  // stalls below on another open tab.
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("txtshell")) {
        keys.push(key);
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // localStorage may be unavailable (private mode); DB deletion is the essential step
  }

  // The delete blocks while another txtshell tab holds the DB open, and resumes
  // when that tab closes — tell the user what it's waiting on.
  await deleteDatabase(DB_NAME, () => {
    const errorLine = vaultOverlay.querySelector(".vault-error");
    if (errorLine) {
      errorLine.textContent = "Waiting — close other txtshell tabs to finish wiping.";
      errorLine.hidden = false;
    }
  });

  state.entries = [];
  state.unreadable = [];
  state.encryption = { enabled: false, unlocked: false, masterKey: null, mode: "passphrase" };
  state.central = { session: null, userId: null, credentialId: null, firstJoin: false, removed: false, readdCredentialId: null, unlockFailures: 0, email: null };
  state.vaultView = null;
  state.vaultPending = null;
  state.editingEntryId = null;
  state.selectedEntryId = null;
  state.search = "";
  state.preset = null;
  state.selectedEntries.clear();
  state.pendingDeletedEntries = null;
  state.commandPaletteDismissed = false;

  renderWipedCard();
}

function renderWipedCard() {
  vaultOverlay.hidden = false;
  entryInput.disabled = true;
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      <p class="vault-title">Wiped</p>
      <p class="vault-subtitle">This browser has no Txtshell data.</p>
      <button class="vault-button" type="button" data-action="reload">Reload</button>
    </div>
  `;
  vaultOverlay
    .querySelector('[data-action="reload"]')
    .addEventListener("click", () => window.location.reload());
}

function renderPassphraseConfirmCard(options) {
  const { title, subtitle, buttonText, onSubmit, onCancel } = options;
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">${escapeHtml(title)}</p>
      <p class="vault-subtitle">${escapeHtml(subtitle)}</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="pass" type="password" placeholder="Current passphrase" autocomplete="current-password" />
      <button class="vault-button" type="button" data-action="submit">${escapeHtml(buttonText)}</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const cancelButton = vaultOverlay.querySelector('[data-action="cancel"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  const submit = async () => {
    const value = passInput.value;
    if (!value) {
      showError("Enter your current passphrase.");
      return;
    }
    showError("");
    submitButton.disabled = true;
    try {
      await onSubmit(value);
    } catch (error) {
      const message = error?.message === "wrong-key"
        ? "Wrong passphrase. Try again."
        : "Something went wrong. Try again.";
      showError(message);
      submitButton.disabled = false;
      passInput.select();
    }
  };

  submitButton.addEventListener("click", submit);
  passInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
  cancelButton.addEventListener("click", onCancel);
  window.requestAnimationFrame(() => passInput.focus());
}

function renderImportUnlockCard(isRecovery) {
  const subtitle = isRecovery
    ? "Paste the recovery key for this export."
    : "Enter the passphrase for this export.";
  const placeholder = isRecovery ? "Recovery key" : "Passphrase";
  const linkText = isRecovery ? "Use passphrase instead" : "Use recovery key instead";
  // A file without a recovery wrap (a /port-paired browser's export, or a Txtshell account's
  // export from before 2026-10-11, made under an export passphrase) opens only with its passphrase:
  // no dead toggle. Current account exports never reach this card (they take the 12 words).
  const file = state.vaultPending?.importFileData;
  const hasRecoveryWrap = Boolean(file?.saltRecovery && file?.wrappedRecovery);

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Import encrypted blocks</p>
      <p class="vault-subtitle">${escapeHtml(subtitle)}</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="pass" type="${isRecovery ? "text" : "password"}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />
      <button class="vault-button" type="button" data-action="submit">Import</button>
      ${hasRecoveryWrap ? `<button class="vault-link" type="button" data-action="toggle">${escapeHtml(linkText)}</button>` : ""}
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const toggleButton = vaultOverlay.querySelector('[data-action="toggle"]');
  const cancelButton = vaultOverlay.querySelector('[data-action="cancel"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  const submit = async () => {
    const value = passInput.value.trim();
    if (!value) {
      showError(isRecovery ? "Enter the recovery key." : "Enter the passphrase.");
      return;
    }
    showError("");
    submitButton.disabled = true;
    submitButton.textContent = "Importing…";
    try {
      await handleImportUnlockSubmit(value, isRecovery);
    } catch (error) {
      console.error(error);
      showError("Couldn't decrypt — passphrase or recovery key may be wrong.");
      submitButton.disabled = false;
      submitButton.textContent = "Import";
      passInput.select();
    }
  };

  submitButton.addEventListener("click", submit);
  passInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      state.vaultView = isRecovery ? "import-unlock" : "import-unlock-recovery";
      renderVault();
    });
  }
  cancelButton.addEventListener("click", exitVaultToNormal);
  window.requestAnimationFrame(() => passInput.focus());
}

async function handleImportUnlockSubmit(value, isRecovery) {
  const file = state.vaultPending?.importFileData;
  if (!file) {
    throw new Error("missing-import-data");
  }
  const saltBase64 = isRecovery ? file.saltRecovery : file.saltPass;
  const wrappedBase64 = isRecovery ? file.wrappedRecovery : file.wrappedPass;
  const iterations = Math.max(
    isRecovery
      ? (file.iterationsRecovery || file.iterations || LEGACY_PBKDF2_ITERATIONS)
      : (file.iterationsPass || file.iterations || LEGACY_PBKDF2_ITERATIONS),
    MIN_IMPORT_ITERATIONS,
  );
  if (!saltBase64 || !wrappedBase64 || !file.verify || !file.iv || !file.ciphertext) {
    throw new Error("malformed-file");
  }
  const wrappingKey = await deriveWrappingKey(value, base64ToBytes(saltBase64), iterations);
  let masterKey;
  try {
    masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey);
  } catch {
    throw new Error("wrong-key");
  }
  let verifyPlain;
  try {
    verifyPlain = await decryptCiphertext(file.verify, masterKey);
  } catch {
    throw new Error("wrong-key");
  }
  if (verifyPlain !== ENC_VERIFY_PLAINTEXT) {
    throw new Error("wrong-key");
  }

  const entries = await decryptImportPayload(file, masterKey);

  if (state.encryption.enabled) {
    await mergeImportedEntries(entries);
    exitVaultToNormal();
    return;
  }

  state.vaultPending = {
    importFileData: file,
    importMasterKey: masterKey,
    importEntries: entries,
  };
  state.vaultView = "import-adopt";
  renderVault();
}

// The block list inside an encrypted export, decrypted with the file's master key.
async function decryptImportPayload(file, masterKey) {
  const ivBytes = base64ToBytes(file.iv);
  const ctBytes = base64ToBytes(file.ciphertext);
  const combined = new Uint8Array(ivBytes.length + ctBytes.length);
  combined.set(ivBytes, 0);
  combined.set(ctBytes, ivBytes.length);
  const blocksJson = await decryptCiphertext(bytesToBase64(combined), masterKey);
  try {
    const entries = JSON.parse(blocksJson);
    if (!Array.isArray(entries)) throw new Error("not-array");
    return entries;
  } catch {
    throw new Error("malformed-payload");
  }
}

// ---------- /import of a Txtshell-account export: the 12 words (plan §9) ----------

function renderImportPhraseCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Open a backup</p>
      <p class="vault-subtitle" data-field="import-lead">${state.vaultPending?.importDifferentWords
        ? "This backup was made with different words. Enter the 12 words you had when you made it."
        : "This backup is from a Txtshell account. Enter the 12 words you had when you made it."}</p>
      <p class="vault-error" hidden></p>
      ${phraseEntryHtml()}
      <button class="vault-button" type="button" data-action="submit">Import</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const showError = (message) => { errorLine.textContent = message; errorLine.hidden = !message; };
  let entry = null;
  const submit = async () => {
    let parsed;
    try {
      parsed = await window.txCentral.phrase.toEntropy(entry.getText()); // checksum first: most typos stop here
    } catch (error) {
      if (error?.position) entry.markInvalid(error.position);
      showError(error.message);
      return;
    }
    showError("");
    submitButton.disabled = true;
    submitButton.textContent = "Importing…";
    try {
      await handleImportPhraseSubmit(parsed.entropy);
    } catch (error) {
      console.error(error);
      showError(error?.message === "wrong-key"
        ? "Those words don't open this file. If you got new words after it was made, it still needs the old ones."
        : "Couldn't read this file. Try again.");
      submitButton.disabled = false;
      submitButton.textContent = "Import";
    }
  };
  entry = bindPhraseEntry({ onChange: () => showError(""), onSubmit: submit });
  submitButton.addEventListener("click", submit);
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", () => {
    const done = state.vaultPending?.importDone;
    exitVaultToNormal();
    done?.();
  });
  window.requestAnimationFrame(() => entry.focus());
}

// 12 words → KEK_rec (with the wrap's own salt) → the account's VK → the file. Nothing reaches a
// server. Into an existing vault the blocks merge under that vault's key; into a fresh install the
// adopt card offers a passphrase vault whose key IS the account's VK (no re-key when it joins).
async function handleImportPhraseSubmit(entropy) {
  const file = state.vaultPending?.importFileData;
  if (!isPhraseWrappedExport(file) || !file.verify || !file.iv || !file.ciphertext) throw new Error("malformed-file");
  const kek = await window.txCentral.keys.kekFromEntropy(entropy, file.wrappedPhrase.hkdfSalt);
  entropy.fill(0);
  let masterKey;
  try {
    masterKey = await window.txCentral.keys.unwrapVK(file.wrappedPhrase.blob, kek, false);
  } catch {
    throw new Error("wrong-key"); // the GCM tag is the check
  }
  let verifyPlain;
  try {
    verifyPlain = await decryptCiphertext(file.verify, masterKey);
  } catch {
    throw new Error("wrong-key");
  }
  if (verifyPlain !== ENC_VERIFY_PLAINTEXT) throw new Error("wrong-key");
  const entries = await decryptImportPayload(file, masterKey);
  if (state.encryption.enabled) {
    const done = state.vaultPending?.importDone;
    const counts = await mergeImportedEntries(entries);
    if (done) state.central.firstJoin = true; // a join is waiting: its first pull offers to keep both
    exitVaultToNormal();
    composerHint.textContent = backupAddedHint(counts, { signedIn: Boolean(done) });
    done?.();
    return;
  }
  state.vaultPending = { importFileData: file, importMasterKey: masterKey, importEntries: entries, importPhraseKek: kek };
  state.vaultView = "import-adopt";
  renderVault();
}

// Adopting a phrase-wrapped export on a fresh install: the file has no passphrase, so this browser's
// vault gets one now. VK is unwrapped extractable only for this one wrap; the vault keeps the
// non-extractable handle. The meta is then written by the ordinary adopt (one transaction).
async function handleImportPhraseAdoptSubmit(passphrase) {
  const pending = state.vaultPending;
  if (!pending?.importPhraseKek || !isPhraseWrappedExport(pending.importFileData)) throw new Error("missing-import-data");
  const file = pending.importFileData;
  const vkExtractable = await window.txCentral.keys.unwrapVK(file.wrappedPhrase.blob, pending.importPhraseKek, true);
  const saltPass = randomBytes(16);
  const wrappingKey = await deriveWrappingKey(passphrase, saltPass, PBKDF2_ITERATIONS);
  const wrappedPass = await wrapMasterKey(vkExtractable, wrappingKey);
  pending.importFileData = { format: file.format, saltPass: bytesToBase64(saltPass), wrappedPass, iterationsPass: PBKDF2_ITERATIONS, verify: file.verify };
  pending.importPhraseKek = null;
  await handleImportAdoptVault();
}

function renderImportAdoptCard() {
  const fromAccount = Boolean(state.vaultPending?.importPhraseKek);
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">${fromAccount ? "Protect these notes on this browser?" : "Keep these notes encrypted on this browser?"}</p>
      <p class="vault-subtitle">${fromAccount
        ? "You'll choose a passphrase for this browser next."
        : "This file is from an encrypted Txtshell backup. Use it to set up encryption on this browser too?"}</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="setup">${fromAccount ? "Protect them with a passphrase" : "Set up encryption"}</button>
      <button class="vault-button secondary" type="button" data-action="plain">${fromAccount ? "Leave them unprotected" : "Just import blocks (no encryption)"}</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };
  const setupButton = vaultOverlay.querySelector('[data-action="setup"]');
  const plainButton = vaultOverlay.querySelector('[data-action="plain"]');
  setupButton.addEventListener("click", async () => {
    if (fromAccount) {
      state.vaultView = "import-phrase-passphrase";
      renderVault();
      return;
    }
    setupButton.disabled = true;
    plainButton.disabled = true;
    try {
      await handleImportAdoptVault();
    } catch (error) {
      console.error(error);
      showError("Setup failed. Try again.");
      setupButton.disabled = false;
      plainButton.disabled = false;
    }
  });
  plainButton.addEventListener("click", async () => {
    setupButton.disabled = true;
    plainButton.disabled = true;
    try {
      await handleImportPlainMerge();
    } catch (error) {
      console.error(error);
      showError("Import failed. Try again.");
      setupButton.disabled = false;
      plainButton.disabled = false;
    }
  });
}

async function handleImportAdoptVault() {
  const pending = state.vaultPending;
  if (!pending?.importFileData || !pending?.importMasterKey || !pending?.importEntries) {
    throw new Error("missing-import-data");
  }
  const file = pending.importFileData;
  const metaRows = [
    [ENC_SALT_PASS_KEY, file.saltPass],
    [ENC_WRAPPED_PASS_KEY, file.wrappedPass],
    [ENC_VERIFY_KEY, file.verify],
    [ENC_ITERATIONS_PASS_KEY, String(Math.max(file.iterationsPass || file.iterations || PBKDF2_ITERATIONS, MIN_IMPORT_ITERATIONS))],
  ];
  // Exports from a /port-paired browser carry no recovery wrap — adopt what exists.
  if (file.saltRecovery && file.wrappedRecovery) {
    metaRows.push(
      [ENC_SALT_RECOVERY_KEY, file.saltRecovery],
      [ENC_WRAPPED_RECOVERY_KEY, file.wrappedRecovery],
      [ENC_ITERATIONS_RECOVERY_KEY, String(Math.max(file.iterationsRecovery || file.iterations || PBKDF2_ITERATIONS, MIN_IMPORT_ITERATIONS))],
    );
  }
  // Blocks that existed before adoption are encrypted at rest in the same
  // transaction that writes the vault meta — without this they'd stay
  // plaintext records and fail decryption after relock; and a crash between
  // the meta and the records would strand them.
  await rekeyVault({ entries: state.entries, key: pending.importMasterKey, metaPuts: metaRows });
  state.encryption.enabled = true;
  state.encryption.unlocked = true;
  state.encryption.masterKey = pending.importMasterKey;
  updateLockButton();
  await mergeImportedEntries(pending.importEntries);
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  composerHint.textContent = "Encryption set up — blocks imported";
}

async function handleImportPlainMerge() {
  const pending = state.vaultPending;
  if (!pending?.importEntries) {
    throw new Error("missing-import-data");
  }
  await mergeImportedEntries(pending.importEntries);
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
}

function exitVaultToNormal() {
  centralRescuedKey = null;
  if (centralPendingImport && !isCentral()) {
    state.vaultPending = { importFileData: centralPendingImport };
    centralPendingImport = null;
    state.vaultView = "import-account";
    renderVault();
    return;
  }
  if (state.encryption.enabled && !state.encryption.unlocked) {
    state.vaultView = "unlock";
    renderVault();
    return;
  }
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  composerHint.textContent = state.editingEntryId ? "Editing block -> save updates" : "Ready";
  entryInput.focus();
}

async function handleSetupSubmit(passphrase) {
  const saltPass = randomBytes(16);
  const saltRecovery = randomBytes(16);
  const wrappingPass = await deriveWrappingKey(passphrase, saltPass, PBKDF2_ITERATIONS);
  const recoveryKey = generateRecoveryKey();
  const wrappingRecovery = await deriveWrappingKey(recoveryKey, saltRecovery, PBKDF2_ITERATIONS);
  const masterKey = await generateMasterKey();
  const wrappedPass = await wrapMasterKey(masterKey, wrappingPass);
  const wrappedRecovery = await wrapMasterKey(masterKey, wrappingRecovery);
  const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, masterKey);
  // Re-derive a non-extractable session key; discard the extractable one used for wrapping.
  const sessionKey = await unwrapMasterKey(wrappedPass, wrappingPass);

  state.vaultPending = {
    saltPass,
    saltRecovery,
    wrappedPass,
    wrappedRecovery,
    verify,
    masterKey: sessionKey,
    recoveryKey,
  };
  state.vaultView = "recovery-display";
  renderVault();
}

async function handleRecoveryConfirm() {
  const pending = state.vaultPending;
  if (!pending) {
    return;
  }

  state.vaultView = "encrypting";
  renderVault();

  try {
    // One IndexedDB transaction for the vault meta AND every re-encrypted
    // record: a partial write (salt without wrapped key, or meta that says
    // encrypted over records still in plaintext) would present an unlock gate
    // that no credential can ever open, or a vault that cannot read its own
    // blocks. rekeyVault does the crypto first, then commits all or nothing.
    await rekeyVault({
      entries: state.entries,
      key: pending.masterKey,
      metaPuts: [
        [ENC_SALT_PASS_KEY, bytesToBase64(pending.saltPass)],
        [ENC_SALT_RECOVERY_KEY, bytesToBase64(pending.saltRecovery)],
        [ENC_WRAPPED_PASS_KEY, pending.wrappedPass],
        [ENC_WRAPPED_RECOVERY_KEY, pending.wrappedRecovery],
        [ENC_VERIFY_KEY, pending.verify],
        [ENC_ITERATIONS_PASS_KEY, String(PBKDF2_ITERATIONS)],
        [ENC_ITERATIONS_RECOVERY_KEY, String(PBKDF2_ITERATIONS)],
      ],
      metaDeletes: [DRAFT_KEY, DRAFT_STASH_KEY],
    });

    state.encryption.enabled = true;
    state.encryption.unlocked = true;
    state.encryption.masterKey = pending.masterKey;

    state.vaultView = null;
    state.vaultPending = null;
    renderVault();
    updateLockButton();
    composerHint.textContent = "Encryption on";
    render();
    entryInput.focus();
    scheduleCloudSync();
  } catch (error) {
    console.error(error);
    state.vaultView = "recovery-display";
    renderVault();
    composerHint.textContent = "Encryption setup failed";
  }
}

async function handleUnlockSubmit(value, isRecovery) {
  if (!isRecovery) {
    const lockout = await readLockoutState();
    if (isCurrentlyLockedOut(lockout)) {
      const error = new Error("locked-out");
      error.lockedUntil = lockout.lockedUntil;
      throw error;
    }
  }

  const saltKey = isRecovery ? ENC_SALT_RECOVERY_KEY : ENC_SALT_PASS_KEY;
  const wrappedKey = isRecovery ? ENC_WRAPPED_RECOVERY_KEY : ENC_WRAPPED_PASS_KEY;
  const iterKey = isRecovery ? ENC_ITERATIONS_RECOVERY_KEY : ENC_ITERATIONS_PASS_KEY;
  const saltBase64 = await getMeta(saltKey);
  const wrappedBase64 = await getMeta(wrappedKey);
  const iterations = await readIterations(iterKey);
  let masterKey;
  let wrappingKey;
  try {
    if (!saltBase64 || !wrappedBase64) {
      throw new Error("missing-meta");
    }
    wrappingKey = await deriveWrappingKey(value, base64ToBytes(saltBase64), iterations);
    try {
      masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey);
    } catch {
      throw new Error("wrong-key");
    }
    if (!(await verifyMasterKey(masterKey))) {
      throw new Error("wrong-key");
    }
  } catch (error) {
    // Only wrong guesses escalate lockout — infrastructure errors
    // (missing metadata, IndexedDB failures) are not attempts.
    if (!isRecovery && error?.message === "wrong-key") {
      await recordUnlockFailure();
    }
    throw error;
  }
  if (!isRecovery) {
    await resetUnlockState();
  }

  state.encryption.masterKey = masterKey;
  state.encryption.unlocked = true;
  const outcome = await decryptAllEntriesIntoState();

  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  updateLockButton();
  const outcomeText = describeUnlockOutcome(outcome);
  composerHint.textContent = outcomeText ? `Unlocked — ${outcomeText}` : "Unlocked";
  render();
  entryInput.focus();
  signalReady();
  // Plaintext leftovers go back under the key now that the vault is open.
  void reencryptRecovered(outcome);

  // Non-blocking: refresh from cloud after unlock; prompts only if cloud differs.
  void autoPullOnUnlock();

  if (iterations < PBKDF2_ITERATIONS) {
    const migrate = unwrapMasterKey(wrappedBase64, wrappingKey, true).then(
      (rewrapKey) =>
        isRecovery
          ? migrateRecoveryWrap(value, rewrapKey)
          : migratePassphraseWrap(value, rewrapKey),
    );
    migrate.catch((error) => {
      console.warn("PBKDF2 iteration migration failed; will retry next unlock", error);
    });
  }
}

async function handleChangeCurrentSubmit(passphrase) {
  const saltBase64 = await getMeta(ENC_SALT_PASS_KEY);
  const wrappedBase64 = await getMeta(ENC_WRAPPED_PASS_KEY);
  if (!saltBase64 || !wrappedBase64) {
    throw new Error("missing-meta");
  }
  const iterations = await readIterations(ENC_ITERATIONS_PASS_KEY);
  const wrappingKey = await deriveWrappingKey(passphrase, base64ToBytes(saltBase64), iterations);
  let masterKey;
  try {
    masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey, true);
  } catch {
    throw new Error("wrong-key");
  }

  state.vaultPending = { masterKey };
  state.vaultView = "change-new";
  renderVault();
}

async function handleChangeNewSubmit(newPassphrase) {
  const pending = state.vaultPending;
  if (!pending?.masterKey) {
    throw new Error("missing-key");
  }
  const saltPass = randomBytes(16);
  const wrappingKey = await deriveWrappingKey(newPassphrase, saltPass, PBKDF2_ITERATIONS);
  const wrappedPass = await wrapMasterKey(pending.masterKey, wrappingKey);
  await saveMetaBatch([
    [ENC_SALT_PASS_KEY, bytesToBase64(saltPass)],
    [ENC_WRAPPED_PASS_KEY, wrappedPass],
    [ENC_ITERATIONS_PASS_KEY, String(PBKDF2_ITERATIONS)],
  ]);

  state.vaultPending = null;
  state.vaultView = null;
  renderVault();
  updateLockButton();
  composerHint.textContent = "Passphrase updated";
  render();
  entryInput.focus();
}

async function handleDisableSubmit(passphrase) {
  const saltBase64 = await getMeta(ENC_SALT_PASS_KEY);
  const wrappedBase64 = await getMeta(ENC_WRAPPED_PASS_KEY);
  if (!saltBase64 || !wrappedBase64) {
    throw new Error("missing-meta");
  }
  const iterations = await readIterations(ENC_ITERATIONS_PASS_KEY);
  const wrappingKey = await deriveWrappingKey(passphrase, base64ToBytes(saltBase64), iterations);
  let masterKey;
  try {
    masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey);
  } catch {
    throw new Error("wrong-key");
  }

  state.encryption.masterKey = masterKey;
  state.encryption.unlocked = true;
  state.vaultView = "decrypting";
  renderVault();

  try {
    if (!state.entries.length) {
      await decryptAllEntriesIntoState(); // plaintext leftovers land in entries; unreadable ones stay flagged
    }
    const plaintextEntries = state.entries.map((entry) => ({
      ...entry,
      tags: extractTags(entry.text),
      mentions: extractMentions(entry.text),
    }));

    // Every record back to plaintext and the vault meta removed in ONE
    // transaction: a crash can leave the vault fully on or fully off, never a
    // plaintext store whose meta still demands a passphrase. Unreadable
    // records are untouched — they stay flagged, and the footer keeps counting
    // them; the key being removed could not open them anyway.
    await rekeyVault({
      entries: plaintextEntries,
      key: null,
      metaDeletes: [
        ENC_SALT_PASS_KEY,
        ENC_SALT_RECOVERY_KEY,
        ENC_WRAPPED_PASS_KEY,
        ENC_WRAPPED_RECOVERY_KEY,
        ENC_VERIFY_KEY,
        ENC_ITERATIONS_PASS_KEY,
        ENC_ITERATIONS_RECOVERY_KEY,
      ],
    });

    state.encryption.enabled = false;
    state.encryption.unlocked = false;
    state.encryption.masterKey = null;
    state.entries = plaintextEntries;

    state.vaultView = null;
    state.vaultPending = null;
    renderVault();
    updateLockButton();
    composerHint.textContent = state.unreadable.length > 0
      ? `Encryption off — ${pluralCount(state.unreadable.length, "unreadable block")} kept as-is`
      : "Encryption off";
    render();
    entryInput.focus();
  } catch (error) {
    console.error(error);
    state.vaultView = "disable-confirm";
    renderVault();
    composerHint.textContent = "Disable failed";
  }
}

// ---------------------------------------------------------------------------
// Cloud sync (encrypted blocks blob -> Worker) and /mirror device pairing
// ---------------------------------------------------------------------------

async function getSyncConfig() {
  // One shape for both modes. A Txtshell account is the app's own origin and
  // the live session (or "" when there is none — "not configured" to callers,
  // never an error); self-hosted is whatever /sync setup stored.
  if (isCentral()) {
    return { workerUrl: window.location.origin, authToken: state.central.session || "" };
  }
  const [workerUrl, authToken] = await Promise.all([
    getMeta(SYNC_WORKER_URL_KEY),
    getMeta(SYNC_AUTH_TOKEN_KEY),
  ]);
  return { workerUrl, authToken };
}

function normalizeWorkerUrl(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  // Worker is HTTPS-only. http://localhost is a secure context too (WebAuthn
  // allows it), so the local harness for the account flow can run — plan §4.2.
  const localhost = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !localhost) return null;
  return trimmed.replace(/\/+$/, "");
}

// Reason codes -> ambient indicator copy. `short` shows inline as the standing
// signal; `full` is the hover tooltip and the one-shot transition toast.
const SYNC_STATUS_LABELS = {
  "push-auth": { short: "Sync: check token", full: "Sync failed — auth rejected, check your token" },
  "push-blocked": { short: "Waiting for connection", full: "Saved on this device — will sync when you're back online." },
  "push-encrypt": { short: "Sync: encrypt error", full: "Sync failed — couldn't prepare your notes for upload" },
  "push-server": { short: "Sync: server error", full: "Sync failed — Worker rejected the upload" },
  "push-too-large": { short: "Sync: too large", full: "Sync failed — your notes exceed the Worker's size limit" },
  "pull-auth": { short: "Pull: check token", full: "Pull failed — auth rejected, check your token" },
  "pull-blocked": { short: "Pull: can't reach cloud", full: "Pull failed — can't reach cloud (offline or blocked)" },
  "pull-decrypt": { short: "Pull: decrypt error", full: "Pull failed — couldn't open the notes in the cloud" },
  "pull-key-mismatch": { short: "Pull: key mismatch", full: "Pull failed — cloud copy doesn't match this device's key" },
  // Txtshell account only. A 401 is "session gone" (expired, signed out elsewhere,
  // revoked), never "check your token"; saves continue, pushes wait for a sign-in.
  "central-signin": { short: "Sign in to sync", full: "Sync is paused — sign in to continue." },
  "central-setup": { short: "Finish setting up sync", full: "Save your 12 words to finish setting up." },
  "central-removed": { short: "Device removed", full: "This device was removed from your account." },
  "central-offline": { short: "Waiting for connection", full: "You're offline. Your notes are saved here and will sync when you're back." },
};

// Drives the persistent ambient sync indicator in the footer.
//   "syncing"            -> in-flight (passive pulsing dot)
//   "ok"                 -> last sync succeeded (passive; clears any failure)
//   one of SYNC_STATUS_LABELS keys -> standing failure, persists until next "ok"
// Steady-state success stays SILENT (ambient only) — the existing concern about a
// toast on every debounced save. A transient toast fires ONLY when sync first
// transitions into failure (or the failure reason changes) so the user notices.
//
// `lastFailureReason` persists ACROSS intermediate "syncing" states and is only
// cleared by an "ok". That's what stops a persistently-broken sync from re-toasting
// on every debounced save (failed -> syncing -> failed with the same reason): the
// in-flight "syncing" flips the visual but does not forget the active failure.
let syncIndicatorState = "idle"; // "idle" | "syncing" | "ok" | "failed"
let lastFailureReason = null;
// The failure reasons a person acts on by signing in — the indicator becomes a button that runs
// the same path as typing /account, and the toast/tooltip say so (plan §8, decision 2026-10-09).
const CENTRAL_ACTION_REASONS = ["central-signin", "central-offline", "central-setup", "central-removed"];
const CENTRAL_ACTION_HINT = "click here, or type /account";
// Failures that mean "no connection": the footer and the account card both read offline, and the
// connection coming back pushes at once (manual-run findings, 2026-10-12).
const SYNC_OFFLINE_REASONS = ["push-blocked", "central-offline"];
// Whether the connection is down, as account sync knows it (dev walk, Mac Safari, 2026-10-12): set by
// the browser's offline event, cleared by its online event or by a real answer from the sync server.
// Safari can skip the online event, or leave navigator.onLine stale, after Wi-Fi comes back, so after
// load this never reads navigator.onLine. Self-hosted sync keeps reading navigator.onLine.
let connectionDown = navigator.onLine === false;
function syncConnectionDown() {
  return isCentral() ? connectionDown : navigator.onLine === false;
}
// A response counts as "back online" only if it is the sync server's own: readable (not opaque), not
// redirected, from the server's origin. A captive portal's page or redirect doesn't flip the state.
function syncServerAnswered(response, url) {
  try {
    if (!response || response.redirected || response.type === "opaque" || response.type === "opaqueredirect") return false;
    return new URL(response.url).origin === new URL(url).origin;
  } catch {
    return false;
  }
}
function noteSyncServerAnswered(response, url) {
  if (connectionDown && syncServerAnswered(response, url)) connectionDown = false;
}
let syncIndicatorActionBound = false;
// The last push or pull that reached the server and succeeded, this session (plan §17.3).
let lastSyncedAt = 0;
function markSynced() {
  lastSyncedAt = Date.now();
}
function lastSyncedText(now = Date.now()) {
  if (!lastSyncedAt) return "Not synced yet on this device";
  const seconds = Math.max(0, Math.round((now - lastSyncedAt) / 1000));
  if (seconds < 60) return "Last synced just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Last synced ${pluralCount(minutes, "minute")} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last synced ${pluralCount(hours, "hour")} ago`;
  if (hours < 48) return "Last synced yesterday";
  return `Last synced ${new Date(lastSyncedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
// The footer's text once a sync has landed: "Synced · 2 min ago" (dev walk, 2026-10-12).
function syncedShortText(now = Date.now()) {
  if (!lastSyncedAt) return "Sync is on";
  const seconds = Math.max(0, Math.round((now - lastSyncedAt) / 1000));
  if (seconds < 60) return "Synced · just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Synced · ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced · ${hours} hr ago`;
  if (hours < 48) return "Synced · yesterday";
  return `Synced · ${new Date(lastSyncedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
// Keeps "2 min ago" (footer and an open account card) current.
window.setInterval(() => { if (lastSyncedAt) renderSyncIndicator(); }, 30000);

// The door for a browser with no account (plan §17.3): shown wherever the account service answers on
// this origin, in either signups mode (2026-10-25-sync-door.md §1 — while it is allowlist-only, Get
// cloud sync leads to the waitlist), and never on an install that syncs through its own
// (self-hosted) Worker.
let accountServiceAvailable = false;
let selfHostedSyncConfigured = false;
async function refreshSyncDoor({ probe = false } = {}) {
  if (probe) {
    try {
      const response = await fetch(`${window.location.origin}/v1/health`, { cache: "no-store" });
      const body = response.ok ? await response.json().catch(() => null) : null;
      accountServiceAvailable = centralAvailable() && Boolean(body && body.ok === true);
    } catch {
      accountServiceAvailable = false;
    }
  }
  try {
    selfHostedSyncConfigured = !isCentral() && Boolean(await getMeta(SYNC_WORKER_URL_KEY));
  } catch {
    selfHostedSyncConfigured = false;
  }
  renderSyncIndicator();
}

// The one account state, read by the footer and by the account card so the two never disagree
// (manual-run finding 1, 2026-10-12): "on" | "syncing" | "offline" | "paused" | "setup" | "removed",
// or "trouble" for a failure that isn't the account's (a server error, too large…). The browser's
// own offline flag counts at once, before any push has failed.
function centralSyncState() {
  if (state.central.removed) return "removed";
  const failed = syncIndicatorState === "failed";
  if (syncConnectionDown() || (failed && SYNC_OFFLINE_REASONS.includes(lastFailureReason))) return "offline";
  if (failed && lastFailureReason === "central-setup") return "setup";
  if (!state.central.session || (failed && lastFailureReason === "central-signin")) return "paused";
  if (failed) return lastFailureReason === "central-removed" ? "removed" : "trouble";
  return syncIndicatorState === "syncing" ? "syncing" : "on";
}

// What the footer shows. In account mode it follows centralSyncState(); otherwise the last status.
function footerSyncStatus() {
  const own = { st: syncIndicatorState, reason: lastFailureReason };
  if (!isCentral() || isVaultLocked()) return own;
  const failedWith = (reason) => (own.st === "failed" && own.reason === reason ? own : { st: "failed", reason });
  switch (centralSyncState()) {
    case "offline": return own.st === "failed" && SYNC_OFFLINE_REASONS.includes(own.reason) ? own : { st: "failed", reason: "central-offline" };
    case "setup": return failedWith("central-setup");
    case "paused": return failedWith("central-signin");
    case "removed": return failedWith("central-removed");
    default: return own;
  }
}

function setSyncStatus(status) {
  if (status === "syncing") {
    syncIndicatorState = "syncing";
    renderSyncIndicator(); // intentionally leaves lastFailureReason intact
    return;
  }
  if (status === "ok") {
    syncIndicatorState = "ok";
    lastFailureReason = null;
    renderSyncIndicator();
    return;
  }

  // Anything else is a failure reason code.
  const reason = SYNC_STATUS_LABELS[status] ? status : "push-server";
  const isNewFailure = lastFailureReason !== reason;
  syncIndicatorState = "failed";
  lastFailureReason = reason;
  renderSyncIndicator();

  // One-shot toast only when newly broken or the reason changed — never on a repeat
  // of the same standing failure. The indicator itself carries the persistent signal.
  if (isNewFailure) {
    const base = syncStatusFull(reason);
    showStatusToast(CENTRAL_ACTION_REASONS.includes(reason) ? `${base} — ${CENTRAL_ACTION_HINT}` : base, { isHint: true });
  }
}

// The full message for a failure reason. The size limit is the one place the
// unreadable count belongs: flagged records ride in the blob as ciphertext and
// count against the Worker's cap like any block, so the user must see them in
// the same breath as the limit.
function syncStatusFull(reason) {
  const base = (SYNC_STATUS_LABELS[reason] || SYNC_STATUS_LABELS["push-server"]).full;
  if (reason === "push-too-large") {
    const including = state.unreadable.length > 0 ? ` (including ${pluralCount(state.unreadable.length, "note")} that can't be opened here)` : "";
    return isCentral() ? `Your notes are over your account's size limit${including}.` : `${base}${including}`;
  }
  return base;
}

function renderSyncIndicator() {
  if (!syncIndicator) return;
  const labelEl = syncIndicator.querySelector(".sync-label");
  const { st, reason } = footerSyncStatus();
  const locked = isVaultLocked();
  const central = isCentral();
  // A browser with no account and no self-hosted sync, where the service answers: the top-bar cloud
  // invites; the footer has nothing to report.
  const door = !central && !locked && accountServiceAvailable && !selfHostedSyncConfigured;
  const accountReason = st === "failed" && CENTRAL_ACTION_REASONS.includes(reason);

  syncIndicator.classList.toggle("is-syncing", st === "syncing");
  syncIndicator.classList.toggle("is-ok", st !== "failed" && st !== "syncing");
  syncIndicator.classList.toggle("is-failed", st === "failed");
  // In account mode the status is always there while unlocked: it opens the account card.
  syncIndicator.hidden = locked || (!central && st === "idle");

  const actionable = !locked && central;
  syncIndicator.classList.toggle("is-actionable", actionable);
  if (actionable) {
    syncIndicator.setAttribute("role", "button");
    syncIndicator.setAttribute("tabindex", "0");
    if (!syncIndicatorActionBound) {
      syncIndicatorActionBound = true;
      const act = () => { if (syncIndicator.classList.contains("is-actionable")) beginAccount(); };
      syncIndicator.addEventListener("click", act);
      syncIndicator.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); act(); } });
    }
  } else {
    syncIndicator.setAttribute("role", "status");
    syncIndicator.removeAttribute("tabindex");
  }

  let text;
  if (st === "failed") {
    const label = SYNC_STATUS_LABELS[reason] || SYNC_STATUS_LABELS["push-server"];
    // The "click here" hint where clicking is the fix (the account reasons).
    const full = accountReason ? `${syncStatusFull(reason)} — ${CENTRAL_ACTION_HINT}` : syncStatusFull(reason);
    text = label.short;
    syncIndicator.setAttribute("data-tooltip", full);
    syncIndicator.setAttribute("aria-label", full);
  } else if (st === "syncing") {
    text = "Syncing…";
    syncIndicator.removeAttribute("data-tooltip");
    syncIndicator.setAttribute("aria-label", "Syncing");
  } else {
    text = syncedShortText();
    if (central) {
      syncIndicator.setAttribute("data-tooltip", `${text} — click for your account`);
      syncIndicator.setAttribute("aria-label", `${text} — open your account`);
    } else {
      syncIndicator.removeAttribute("data-tooltip");
      syncIndicator.setAttribute("aria-label", text);
    }
  }
  labelEl.textContent = text;
  renderSyncButton(door ? "door" : central && !locked ? syncButtonState(centralSyncState()) : null, text);
  refreshAccountCard();
  updateSyncRetryTimer();
}

// The top-bar cloud (dev walk, 2026-10-12): where sync is found. It opens the account card, and its
// mark follows the same state as the footer and the card.
//   synced    a filled cloud            (on, syncing)
//   offline   a cloud with a slash
//   attention a cloud with a small dot  (paused, setup unfinished, removed, a sync problem)
//   door      an outline cloud          (no account here, only where the account service answers)
const SYNC_CLOUD_PATH = "M5.25 14.25h7.5a3 3 0 0 0 .35-5.98 4.4 4.4 0 0 0-8.5.15A2.95 2.95 0 0 0 5.25 14.25z";
const SYNC_BUTTON_SVG = {
  synced: `<path d="${SYNC_CLOUD_PATH}" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
  offline: `<path d="${SYNC_CLOUD_PATH}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 3l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  attention: `<path d="${SYNC_CLOUD_PATH}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle class="sync-attention-dot" cx="14.5" cy="4" r="2.25" fill="currentColor"/>`,
  door: `<path d="${SYNC_CLOUD_PATH}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
};

function syncButtonState(syncState) {
  if (syncState === "on" || syncState === "syncing") return "synced";
  return syncState === "offline" ? "offline" : "attention";
}

function renderSyncButton(buttonState, statusText) {
  if (!syncButton) return;
  syncButton.hidden = !buttonState;
  if (!buttonState) {
    syncButton.removeAttribute("data-state");
    return;
  }
  if (syncButton.dataset.state !== buttonState) {
    syncButton.dataset.state = buttonState;
    syncButton.querySelector("svg").innerHTML = SYNC_BUTTON_SVG[buttonState];
  }
  const title = buttonState === "door" ? "Sync your notes across devices" : `${statusText} — open your account`;
  syncButton.setAttribute("title", title);
  syncButton.setAttribute("aria-label", title);
}

// The browser's connection (manual-run findings 2, 3, 2026-10-12). Going offline flips the footer and
// the account card at once, without waiting for a push to fail; coming back — or the page regaining
// focus while a push waits — pushes straight away instead of at the next edit.
async function syncConnectionChanged() {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) return;
  const { workerUrl } = await getSyncConfig();
  if (!normalizeWorkerUrl(workerUrl)) return; // this install doesn't sync
  const waiting = syncIndicatorState === "failed" && SYNC_OFFLINE_REASONS.includes(lastFailureReason);
  if (syncConnectionDown()) {
    if (waiting) renderSyncIndicator();
    else setSyncStatus(isCentral() ? "central-offline" : "push-blocked");
    return;
  }
  if (!waiting) {
    renderSyncIndicator();
    return;
  }
  if (isCentral() && !state.central.session) {
    setSyncStatus("central-signin"); // an offline unlock: online now, but a sign-in is what's missing
    return;
  }
  // Nothing changed while offline: the cloud already holds these blocks.
  if (await cloudMatchesSyncedBase(syncPayloadEntries())) {
    setSyncStatus("ok");
    return;
  }
  await flushCloudSync();
}
// Focus or a visible page: in account mode while offline, a retry now (it doesn't wait for the online
// event, which Safari may never send); otherwise the same as a connection change, and a look at the
// cloud (Part B): a 304 when nothing changed, the merge when another device did.
function syncRetryNow() {
  if (isCentral() && !isVaultLocked() && centralSyncState() === "offline") {
    syncRetryAttempt = 0;
    if (syncRetryTimer !== null) window.clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
    void syncRetryTick();
    return;
  }
  void syncConnectionChanged();
  pullOnFocus();
}

// Every focus looks at the cloud (two-device walk, 2026-10-13: a 30 s limit hid the other device's
// note). Focus events within 2 s count as one; a focus while a pull or push is under way pulls once
// more after it; a look that finds nothing new looks again 3 s later while the window still has
// focus (the other device's upload may still be on its way). Never over a card, locked or offline.
const FOCUS_PULL_MERGE_MS = 2000;
const FOCUS_PULL_RECHECK_MS = 3000;
let lastPullStartedAt = 0;
let focusPullPending = false;
let focusRecheckTimer = null;
function focusPullAllowed() {
  return state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey && !state.vaultView && !syncConnectionDown();
}
function pullOnFocus() {
  if (!focusPullAllowed()) return;
  if (pullHoldDepth > 0 || cloudSyncInFlight) {
    focusPullPending = true;
    return;
  }
  if (Date.now() - lastPullStartedAt < FOCUS_PULL_MERGE_MS) return;
  void focusPull();
}
async function focusPull({ recheck = true } = {}) {
  if (focusRecheckTimer !== null) window.clearTimeout(focusRecheckTimer);
  focusRecheckTimer = null;
  const outcome = await autoPullOnUnlock();
  if (outcome !== "unchanged" || !recheck) return;
  focusRecheckTimer = window.setTimeout(() => {
    focusRecheckTimer = null;
    if (document.hasFocus() && focusPullAllowed() && pullHoldDepth === 0 && !cloudSyncInFlight) void focusPull({ recheck: false });
  }, FOCUS_PULL_RECHECK_MS);
}
// Called when a pull or push ends: the focus that arrived during it gets its own look.
function runPendingFocusPull() {
  if (!focusPullPending || pullHoldDepth > 0 || cloudSyncInFlight) return;
  focusPullPending = false;
  if (focusPullAllowed()) window.setTimeout(() => void focusPull(), 0);
}
// Leaving the window: a change waiting out the 1 s delay goes now, so the device you switch to
// can already see it.
function pushNowOnLeave() {
  if (cloudSyncTimer === null) return;
  window.clearTimeout(cloudSyncTimer);
  cloudSyncTimer = null;
  void flushCloudSync();
}
window.addEventListener("blur", pushNowOnLeave);
window.addEventListener("pagehide", pushNowOnLeave);
window.addEventListener("offline", () => { connectionDown = true; void syncConnectionChanged(); });
window.addEventListener("online", () => { connectionDown = false; syncRetryAttempt = 0; void syncConnectionChanged(); });
window.addEventListener("focus", syncRetryNow);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pushNowOnLeave();
    updateSyncRetryTimer(); // paused while hidden; a visible page retries at once
  } else syncRetryNow();
});

// The retry timer (dev walk, 2026-10-12), account mode only: runs while unlocked, visible and offline;
// 10 s, 20 s, 40 s, then every 60 s. A tick pushes if this browser holds changes the cloud doesn't,
// otherwise asks /v1/health; a real answer from the server ends the offline state. Stops once the
// state leaves offline (synced, or "Sign in to sync" after an offline unlock).
const SYNC_RETRY_DELAYS_MS = [10000, 20000, 40000, 60000];
let syncRetryTimer = null;
let syncRetryAttempt = 0;
let syncRetryRunning = false;
function syncRetryDelay(attempt) {
  return SYNC_RETRY_DELAYS_MS[Math.min(attempt, SYNC_RETRY_DELAYS_MS.length - 1)];
}

function updateSyncRetryTimer() {
  const offline = isCentral() && !isVaultLocked() && state.encryption.masterKey && centralSyncState() === "offline";
  if (!offline) syncRetryAttempt = 0;
  if (!offline || document.hidden) {
    if (syncRetryTimer !== null) window.clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
    return;
  }
  if (syncRetryTimer === null && !syncRetryRunning) {
    syncRetryTimer = window.setTimeout(() => {
      syncRetryTimer = null;
      void syncRetryTick();
    }, syncRetryDelay(syncRetryAttempt));
  }
}

async function syncRetryTick() {
  if (syncRetryRunning) return;
  if (!(isCentral() && !isVaultLocked() && state.encryption.masterKey && centralSyncState() === "offline")) return;
  syncRetryRunning = true;
  syncRetryAttempt += 1;
  const attempt = syncRetryAttempt;
  try {
    const pending = Boolean(state.central.session) && !(await cloudMatchesSyncedBase(syncPayloadEntries()));
    if (pending) {
      await flushCloudSync({ evenIfDown: true }); // its own answer clears connectionDown and sets the state
    } else {
      const origin = window.location.origin;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CLOUD_SYNC_TIMEOUT_MS);
      try {
        const response = await fetch(`${origin}/v1/health`, { cache: "no-store", signal: controller.signal });
        const body = response.ok ? await response.json().catch(() => null) : null;
        if (body?.ok === true && syncServerAnswered(response, origin)) {
          connectionDown = false;
          setSyncStatus(state.central.session ? "ok" : "central-signin");
        }
      } catch {
        // still no connection: the next tick tries again
      } finally {
        window.clearTimeout(timeout);
      }
    }
  } finally {
    syncRetryRunning = false;
  }
  if (centralSyncState() !== "offline") {
    console.info(`[txtshell] connection back — found by the sync retry (attempt ${attempt})`);
    syncRetryAttempt = 0;
  }
  updateSyncRetryTimer();
}

// Maps a fetchAndDecryptBlocks() error to the ambient indicator, labelled as a PULL
// problem (distinct from push). No-ops for non-failures (not configured / locked),
// which are user state, not a sync fault.
function setPullStatusFromError(error) {
  const message = error?.message;
  if (message === "not-configured" || message === "locked") return;
  if (message === "auth") {
    setSyncStatus(isCentral() ? "central-signin" : "pull-auth");
  } else if (message === "setup") {
    setSyncStatus("central-setup");
  } else if (message === "decrypt") {
    // AES-GCM OperationError: the cloud blob was encrypted under a DIFFERENT master
    // key than this device holds — a key mismatch, not transient corruption.
    setSyncStatus("pull-key-mismatch");
  } else if (message === "malformed") {
    setSyncStatus("pull-decrypt");
  } else {
    setSyncStatus("pull-blocked");
  }
}

let cloudSyncTimer = null;
let cloudSyncInFlight = false;
let cloudSyncRetryAfterUsed = false;

// A Txtshell account session has ended (401: expired, signed out elsewhere,
// revoked). The vault key stays — editing continues, pushes wait for a
// sign-in. Nothing local is touched.
function dropCentralSession(reason) {
  state.central.session = null;
  setSyncStatus("central-signin");
  console.warn("[txtshell] account session ended", reason);
}

// A 401 from /v1/blocks: `device-removed` means this device was removed from the account (its
// session was one the removal ended); anything else is an ordinary ended session.
async function centralSessionRefused(response) {
  const body = await response.json().catch(() => ({}));
  if (body?.error === "device-removed") await centralToldRemovedBySession();
  else dropCentralSession("401");
}

// After a 412: pull under the same hold, without the "Pulling…" copy. Shows the
// existing card if cloud and local differ; a push follows from Keep/Replace.
// Two devices merging at once: the server lets one push win; the other gets a 412, pulls, merges again
// and retries — at most three times in a row, then it waits for the next change.
let rejectedPushRetries = 0;
async function pullAfterRejectedPush() {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) return;
  if (++rejectedPushRetries > 3) {
    rejectedPushRetries = 0;
    setSyncStatus("push-server");
    return;
  }
  await beginPull({ quiet: true });
}

// Push hold. A pull compares the cloud blob to local and may raise the conflict
// card; until the user resolves it, NO push may fire — otherwise a save that
// lands mid-pull (a queued extension capture delivered on unlock is the classic
// case) would overwrite the cloud ~1s later, before the user has even read the
// card, making "Keep local" a no-op and "Replace with cloud" restore a snapshot
// the cloud no longer holds (the capture is then lost everywhere). Held while a
// pull GET is in flight and while the pull-conflict card is showing; a push
// requested during the hold is remembered and replayed on release.
let pullHoldDepth = 0;
let cloudSyncDeferred = false;

// The cards that decide what the cloud should hold: no push may fire while one is showing.
const PUSH_HOLD_VIEWS = ["pull-conflict", "first-join", "sync-removed"];
function pushIsHeld() {
  return pullHoldDepth > 0 || PUSH_HOLD_VIEWS.includes(state.vaultView);
}

function releaseDeferredPush() {
  if (cloudSyncDeferred && !pushIsHeld()) {
    cloudSyncDeferred = false;
    scheduleCloudSync();
  }
}

function scheduleCloudSync() {
  // Only encrypted, unlocked vaults sync; iOS decrypts the blob with the master key.
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) {
    return;
  }
  if (cloudSyncTimer !== null) {
    window.clearTimeout(cloudSyncTimer);
  }
  cloudSyncTimer = window.setTimeout(() => {
    cloudSyncTimer = null;
    flushCloudSync();
  }, CLOUD_SYNC_DEBOUNCE_MS);
}

// Returns an outcome object { status, reason? } so callers that care about the
// round-trip (e.g. sync setup) can report a concrete result. The debounced
// scheduleCloudSync caller ignores the return — same single upload path.
//   status: "ok" | "auth" | "error" | "skipped"
async function flushCloudSync({ evenIfDown = false } = {}) {
  if (cloudSyncInFlight) {
    // A save landed during an in-flight upload; re-arm so the latest state ships next.
    scheduleCloudSync();
    return { status: "skipped", reason: "in-flight" };
  }
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) {
    return { status: "skipped", reason: "locked" };
  }
  const { workerUrl, authToken } = await getSyncConfig();
  const url = normalizeWorkerUrl(workerUrl);
  if (!url || !authToken) {
    return { status: "skipped", reason: "not-configured" }; // nothing to do, no error
  }
  if (!evenIfDown && syncConnectionDown()) {
    // The browser knows there is no connection: no request that can only fail. The "online"
    // listener (or, in account mode, the retry timer) pushes as soon as it returns.
    if (syncIndicatorState === "failed" && SYNC_OFFLINE_REASONS.includes(lastFailureReason)) renderSyncIndicator();
    else setSyncStatus(isCentral() ? "central-offline" : "push-blocked");
    return { status: "error", reason: "network" };
  }
  if (pushIsHeld()) {
    // Gated here (not in scheduleCloudSync) so a debounce timer armed BEFORE the
    // hold began is caught too. Replayed by releaseDeferredPush().
    cloudSyncDeferred = true;
    return { status: "skipped", reason: "pull-pending" };
  }

  // Real work is about to begin — light the ambient "syncing" state. Resolved to
  // ok/failed at every exit below.
  setSyncStatus("syncing");

  let body;
  // The blob carries every readable block AND every unreadable record (flagged,
  // ciphertext verbatim): the cloud must never claim those ids do not exist, or
  // another device's Replace would delete its readable copies of them.
  const payload = syncPayloadEntries();
  // Canonical form of the exact snapshot being uploaded, taken before any await so
  // a save landing mid-upload can't be recorded as "what the cloud holds".
  const uploadedSnapshot = payload.map((e) => ({ ...e }));
  try {
    // Reuse the exact AES-GCM path used by encrypted export: base64(IV(12) || ct+tag).
    // Upload the raw bytes of that blob; iOS splits the 12-byte IV prefix and decrypts.
    const base64Blob = await encryptPlaintext(
      JSON.stringify(payload),
      state.encryption.masterKey,
    );
    body = base64ToBytes(base64Blob);
  } catch (error) {
    console.error("[txtshell] cloud sync encrypt failed", error);
    setSyncStatus("push-encrypt");
    return { status: "error", reason: "encrypt-failed" };
  }

  cloudSyncInFlight = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLOUD_SYNC_TIMEOUT_MS);
  try {
    // Conditional on the generation this browser last synced (0 = "the cloud is
    // empty as far as I know"). Only when the Worker speaks generations: a
    // Txtshell account always does; a self-hosted Worker once it has sent an ETag.
    const headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/octet-stream",
    };
    const generation = await readSyncedGeneration();
    if (isCentral() || generation !== null) {
      headers["If-Match"] = `"g${generation || 0}"`;
    }
    const response = await fetch(`${url}/v1/blocks`, {
      method: "PUT",
      headers,
      body,
      signal: controller.signal,
    });
    // In account mode, an answer that isn't the sync server's (a captive portal) is no connection.
    if (isCentral() && !syncServerAnswered(response, url)) throw new TypeError("not the sync server");
    noteSyncServerAnswered(response, url);
    if (response.status === 401) {
      if (isCentral()) {
        await centralSessionRefused(response);
        return { status: "auth" };
      }
      setSyncStatus("push-auth");
      return { status: "auth" };
    } else if (response.status === 403 && isCentral()) {
      setSyncStatus("central-setup");
      return { status: "error", reason: "http-403" };
    } else if (response.status === 412) {
      // The cloud moved on since this browser last synced. Never retry blindly:
      // pull, compare, and let the existing card decide. The push is not lost —
      // Keep/Replace re-push, and a save after the card schedules one.
      cloudSyncRetryAfterUsed = false;
      void pullAfterRejectedPush();
      return { status: "conflict" };
    } else if (response.status === 413) {
      setSyncStatus("push-too-large");
      return { status: "error", reason: "http-413" };
    } else if (response.status === 429) {
      // Honour Retry-After once; a second 429 in a row is a standing failure.
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      if (!cloudSyncRetryAfterUsed && retryAfter > 0 && retryAfter <= 300) {
        cloudSyncRetryAfterUsed = true;
        window.setTimeout(() => scheduleCloudSync(), retryAfter * 1000);
        return { status: "error", reason: "http-429" };
      }
      setSyncStatus("push-server");
      return { status: "error", reason: "http-429" };
    } else if (!response.ok) {
      setSyncStatus("push-server");
      return { status: "error", reason: "http-" + response.status };
    } else {
      markSynced();
      setSyncStatus("ok");
      cloudSyncRetryAfterUsed = false;
      const newGeneration = generationFromResponse(response);
      if (newGeneration !== null) {
        void recordSyncedGeneration(newGeneration); // the Worker speaks generations: next push is conditional on this one
      } else if (!isCentral()) {
        // A self-hosted Worker from before conditional PUT: pushes stay unconditional (as they
        // always were) and this browser says so once. Redeploying the Worker is the fix.
        showHint("sync-legacy-worker", "Update your sync Worker for conflict protection — redeploy it from github.com/gitkvn/txtshell-sync");
      }
      rejectedPushRetries = 0;
      void recordSyncedBase(uploadedSnapshot); // the cloud now holds this snapshot
      return { status: "ok" };
    }
  } catch (error) {
    // Network down, aborted, or CSP block — the local save already succeeded. Already waiting for the
    // connection: stay on that reason (no second toast).
    console.warn("[txtshell] cloud sync upload failed", error);
    if (syncIndicatorState === "failed" && SYNC_OFFLINE_REASONS.includes(lastFailureReason)) renderSyncIndicator();
    else setSyncStatus("push-blocked");
    return { status: "error", reason: error && error.name === "AbortError" ? "timeout" : "network" };
  } finally {
    window.clearTimeout(timeout);
    cloudSyncInFlight = false;
    runPendingFocusPull();
  }
}

// Human-readable tail for "Sync failed — …" hints, mapped from flushCloudSync reasons.
function describeSyncError(reason) {
  switch (reason) {
    case "encrypt-failed":
      return "couldn't prepare your notes for upload";
    case "timeout":
      return "request timed out";
    case "network":
      return "network error";
    case "http-413":
      return state.unreadable.length > 0
        ? `your notes exceed the Worker's size limit (including ${pluralCount(state.unreadable.length, "note")} that can't be opened here)`
        : "your notes exceed the Worker's size limit";
    default:
      if (typeof reason === "string" && reason.startsWith("http-")) {
        return `server error (${reason.slice(5)})`;
      }
      return "unknown error";
  }
}

function renderSyncSetupCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Sync setup</p>
      <p class="vault-subtitle">Paste your Worker URL and auth token. These are stored on this device only.</p>
      <p class="vault-subtitle">New to sync? You'll need to deploy your own Cloudflare Worker first — see the guide: <a href="https://github.com/gitkvn/txtshell-sync" target="_blank" rel="noopener noreferrer">github.com/gitkvn/txtshell-sync</a></p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="url" type="url" placeholder="https://sync.example.com" autocomplete="off" spellcheck="false" />
      <input class="vault-input" data-field="token" type="text" placeholder="Auth token" autocomplete="off" spellcheck="false" />
      <button class="vault-button" type="button" data-action="submit">Save</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;

  const urlInput = vaultOverlay.querySelector('[data-field="url"]');
  const tokenInput = vaultOverlay.querySelector('[data-field="token"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const cancelButton = vaultOverlay.querySelector('[data-action="cancel"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  // Prefill existing values so editing is easy.
  getSyncConfig().then(({ workerUrl, authToken }) => {
    if (workerUrl) urlInput.value = workerUrl;
    if (authToken) tokenInput.value = authToken;
  });

  const submit = async () => {
    const url = normalizeWorkerUrl(urlInput.value);
    const token = tokenInput.value.trim();
    if (!url) {
      showError("Enter a valid https:// Worker URL.");
      return;
    }
    if (!token) {
      showError("Enter the auth token.");
      return;
    }
    showError("");
    submitButton.disabled = true;
    try {
      await handleSyncSetupSubmit(url, token);
    } catch (error) {
      console.error(error);
      showError("Couldn't save. Try again.");
      submitButton.disabled = false;
    }
  };

  submitButton.addEventListener("click", submit);
  tokenInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
  cancelButton.addEventListener("click", exitVaultToNormal);
  window.requestAnimationFrame(() => urlInput.focus());
}

async function handleSyncSetupSubmit(workerUrl, authToken) {
  await saveMetaBatch([
    [SYNC_WORKER_URL_KEY, workerUrl],
    [SYNC_AUTH_TOKEN_KEY, authToken],
  ]);
  void refreshSyncDoor();
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  entryInput.focus();
  composerHint.textContent = "Syncing…";

  // Push existing blocks now and confirm the round-trip. A 200 PUT is
  // authoritative for "configured + uploaded"; the read-back is best-effort.
  const result = await flushCloudSync();

  if (result.status === "auth") {
    composerHint.textContent = "Sync auth failed — check your token";
    return;
  }
  if (result.status === "error") {
    composerHint.textContent = `Sync failed — ${describeSyncError(result.reason)}`;
    return;
  }
  if (result.status === "conflict") {
    composerHint.textContent = "Cloud has other changes — choose on the card";
    return;
  }
  if (result.status === "skipped") {
    // Config saved, nothing pushed yet: vault locked, an upload already in flight,
    // or a pull is holding pushes (the deferred push replays when it lifts).
    composerHint.textContent = result.reason === "pull-pending"
      ? "Sync configured — will upload once the current pull settles"
      : "Sync is set up — unlock to upload your notes.";
    return;
  }

  // PUT succeeded. Read back for a concrete count, but R2 is read-after-write
  // lossy right after a PUT — a 404 / stale bytes / decrypt hiccup here is NOT a
  // failure, so fall back to a soft confirm rather than reporting it as broken.
  try {
    const readback = await fetchAndDecryptBlocks();
    if (readback.upToDate) {
      // 304 against the generation just pushed: the cloud holds exactly this set.
      const n = state.entries.length;
      composerHint.textContent = `Synced — ${pluralCount(n, "note")} in the cloud`;
    } else if (readback.empty) {
      composerHint.textContent = "Uploaded — will confirm on next sync";
    } else {
      const n = readback.entries.length;
      composerHint.textContent = `Synced — ${pluralCount(n, "note")} in the cloud`;
    }
  } catch {
    composerHint.textContent = "Uploaded — will confirm on next sync";
  }
}

function beginMirror() {
  getSyncConfig().then(({ workerUrl, authToken }) => {
    if (!normalizeWorkerUrl(workerUrl) || !authToken) {
      state.vaultView = "sync-setup";
      renderVault();
      composerHint.textContent = "Configure sync before pairing";
      return;
    }
    state.vaultPending = null;
    state.vaultView = "mirror-confirm";
    renderVault();
    composerHint.textContent = "Pair a device";
  });
}

// Transient pairing payload. Holds the base64 master key only while the QR is on
// screen; cleared on dismiss. Never written to state/IndexedDB.
let mirrorPayload = null;
let mirrorDismissTimer = null;

function clearMirrorDismiss() {
  if (mirrorDismissTimer !== null) {
    window.clearTimeout(mirrorDismissTimer);
    mirrorDismissTimer = null;
  }
}

async function handleMirrorSubmit(passphrase) {
  const saltBase64 = await getMeta(ENC_SALT_PASS_KEY);
  const wrappedBase64 = await getMeta(ENC_WRAPPED_PASS_KEY);
  if (!saltBase64 || !wrappedBase64) {
    throw new Error("missing-meta");
  }
  const iterations = await readIterations(ENC_ITERATIONS_PASS_KEY);
  const wrappingKey = await deriveWrappingKey(passphrase, base64ToBytes(saltBase64), iterations);

  // Re-derive an EXTRACTABLE handle from the passphrase (the steady-state session key
  // is non-extractable; exportKey would throw). Same pattern as handleChangeCurrentSubmit.
  let extractableMaster;
  try {
    extractableMaster = await unwrapMasterKey(wrappedBase64, wrappingKey, true);
  } catch {
    throw new Error("wrong-key");
  }

  // Export raw key bytes, base64-encode for the QR, then discard the raw bytes and handle.
  const rawBuffer = await crypto.subtle.exportKey("raw", extractableMaster);
  const rawBytes = new Uint8Array(rawBuffer);
  const masterKeyB64 = bytesToBase64(rawBytes);
  rawBytes.fill(0); // zero the plaintext key bytes; extractableMaster handle now goes unused

  const { workerUrl, authToken } = await getSyncConfig();
  const normalizedUrl = normalizeWorkerUrl(workerUrl);
  if (!normalizedUrl || !authToken) {
    throw new Error("missing-meta");
  }

  // Field names/order match the iOS spec exactly.
  const payloadJson = JSON.stringify({
    workerUrl: normalizedUrl,
    authToken,
    masterKey: masterKeyB64,
  });

  const qr = qrcode(0, "M"); // type 0 = auto-fit smallest version, error correction M
  qr.addData(payloadJson);
  qr.make();
  const qrDataUrl = qr.createDataURL(6); // cellSize 6, includes the standard quiet-zone margin

  mirrorPayload = {
    workerUrl: normalizedUrl,
    authToken,
    masterKey: masterKeyB64,
    qrDataUrl,
  };
  state.vaultView = "mirror-display";
  renderVault();
}

function closeMirror() {
  clearMirrorDismiss();
  mirrorPayload = null; // drop the master key from memory
  exitVaultToNormal();
}

function renderMirrorDisplayCard() {
  if (!mirrorPayload) {
    exitVaultToNormal();
    return;
  }
  const { workerUrl, authToken, masterKey, qrDataUrl } = mirrorPayload;
  vaultOverlay.innerHTML = `
    <div class="vault-card mirror-card">
      <p class="vault-title">Scan to pair</p>
      <p class="vault-warning">This QR contains your master key. Pair in a private location.</p>
      <img class="mirror-qr" alt="Pairing QR code" src="${escapeHtml(qrDataUrl)}" />
      <p class="vault-subtitle">Or enter manually:</p>
      <dl class="mirror-fields">
        <dt>Worker URL</dt><dd>${escapeHtml(workerUrl)}</dd>
        <dt>Auth token</dt><dd>${escapeHtml(authToken)}</dd>
        <dt>Master key</dt><dd>${escapeHtml(masterKey)}</dd>
      </dl>
      <button class="vault-button" type="button" data-action="copy">Copy pairing data</button>
      <button class="vault-button secondary" type="button" data-action="close">Done</button>
    </div>
  `;

  const copyButton = vaultOverlay.querySelector('[data-action="copy"]');
  copyButton.addEventListener("click", async () => {
    // Paste target is /port on another browser — same { workerUrl, authToken, masterKey } shape.
    const pairingJson = JSON.stringify({ workerUrl, authToken, masterKey });
    try {
      await navigator.clipboard.writeText(pairingJson);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy pairing data";
      }, COPY_FLASH_DURATION);
    } catch {
      composerHint.textContent = "Copy failed";
    }
  });

  vaultOverlay
    .querySelector('[data-action="close"]')
    .addEventListener("click", closeMirror);

  // Auto-dismiss after 60s of inactivity so the master key isn't left on screen.
  clearMirrorDismiss();
  mirrorDismissTimer = window.setTimeout(closeMirror, 60000);
}

// ---------------------------------------------------------------------------
// /port (pair a fresh browser) and /pull (fetch the blocks blob) + auto-pull
// ---------------------------------------------------------------------------

// Fetch and decrypt the cloud blocks blob with the local master key. The vault must
// be unlocked. Returns { empty: true } on a 404 (no blob yet) or { empty: false,
// entries } on success. Throws typed errors so callers can map to clear messages:
// "not-configured" | "locked" | "auth" | "http-<status>" | "decrypt" | "malformed".
async function fetchAndDecryptBlocks() {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) {
    throw new Error("locked");
  }
  const { workerUrl, authToken } = await getSyncConfig();
  const url = normalizeWorkerUrl(workerUrl);
  if (!url || !authToken) {
    throw new Error("not-configured");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLOUD_SYNC_TIMEOUT_MS);
  let buffer;
  let generation = null;
  try {
    // "Unchanged since I last synced" is a header round-trip once a generation
    // is known; never sent to a Worker that has not shown it speaks generations.
    const headers = { Authorization: `Bearer ${authToken}` };
    const known = await readSyncedGeneration();
    if (known !== null) {
      headers["If-None-Match"] = `"g${known}"`;
    }
    const response = await fetch(`${url}/v1/blocks`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (isCentral() && !syncServerAnswered(response, url)) throw new TypeError("not the sync server");
    noteSyncServerAnswered(response, url);
    if (response.status === 304) {
      return { empty: false, upToDate: true, generation: known };
    }
    if (response.status === 404) {
      if (isCentral() || known !== null) {
        void recordSyncedGeneration(0); // an empty cloud: the next push is a first upload
      }
      return { empty: true, generation: 0 };
    }
    if (response.status === 401) {
      if (isCentral()) await centralSessionRefused(response);
      throw new Error("auth");
    }
    if (response.status === 403 && isCentral()) {
      throw new Error("setup");
    }
    if (!response.ok) {
      throw new Error("http-" + response.status);
    }
    generation = generationFromResponse(response);
    if (Number(response.headers.get("content-length") || 0) > CLOUD_MAX_RESPONSE_BYTES) {
      throw new Error("too-large");
    }
    buffer = await response.arrayBuffer();
    if (buffer.byteLength > CLOUD_MAX_RESPONSE_BYTES) {
      throw new Error("too-large"); // header was absent or lied
    }
  } finally {
    window.clearTimeout(timeout);
  }

  // The Worker stores the raw bytes of base64(IV(12) || ct+tag); re-encode to base64
  // so decryptCiphertext can split the IV prefix — the exact inverse of flushCloudSync.
  let blocksJson;
  try {
    const base64Blob = bytesToBase64(new Uint8Array(buffer));
    blocksJson = await decryptCiphertext(base64Blob, state.encryption.masterKey);
  } catch (error) {
    console.warn("[txtshell] cloud blocks decrypt failed", error);
    throw new Error("decrypt");
  }

  let entries;
  try {
    entries = JSON.parse(blocksJson);
    if (!Array.isArray(entries)) throw new Error("not-array");
  } catch {
    throw new Error("malformed");
  }
  return { empty: false, entries, generation };
}

// What a push uploads: every readable block plus every unreadable record,
// flagged, ciphertext verbatim. Same set the exports carry.
function syncPayloadEntries() {
  return [...state.entries, ...state.unreadable.map(blobRecordOf)];
}

// Adopts readable cloud copies of ids this browser holds only as unreadable.
// No card: nothing readable is at stake (we replace ciphertext we cannot open
// with a block we can), and leaving the unreadable copy in place would let
// "Keep local" push it over the cloud's readable one. saveEntry overwrites the
// flagged record by id and schedules the push that carries it readable.
async function adoptReadableCopies(cloudEntries) {
  let recovered = 0;
  for (const item of cloudEntries) {
    if (!item || typeof item.id !== "string" || typeof item.text !== "string" || typeof item.createdAt !== "string") continue;
    if (isUnreadableRecord(item) || item.text.length > MAX_IMPORT_ENTRY_TEXT) continue;
    const index = state.unreadable.findIndex((u) => u.id === item.id);
    if (index === -1) continue;
    state.unreadable.splice(index, 1);
    const entry = entryFromPlaintext(item, item.text);
    state.entries.push(entry);
    await saveEntry(entry);
    recovered++;
  }
  if (recovered > 0) {
    state.entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    render();
  }
  return recovered;
}

// Stores a flagged cloud copy this browser has no readable record for.
async function storeUnreadableCopy(item) {
  if (!isCiphertextShaped(item.text) || item.text.length > MAX_IMPORT_ENTRY_TEXT) return false;
  const record = unreadableRecordOf(item);
  await putEntryRecord(record); // verbatim: saveEntry would encrypt ciphertext again
  const index = state.unreadable.findIndex((u) => u.id === record.id);
  if (index === -1) state.unreadable.push(record); else state.unreadable[index] = record;
  return true;
}

// Reconciles a pulled set BEFORE the classifier sees it. Unreadable records
// never reach the classifier: they are not blocks that can be "ahead" or
// "behind", and a card cannot discard them (nothing but /wipe removes them),
// so putting them in front of it would raise a card the user cannot clear.
// They are settled here by the one rule — a readable copy of an id beats an
// unreadable copy — and otherwise carried:
//   1. cloud flagged, local readable  → local wins: the local entry stands in
//      for the cloud copy so the sets compare equal on that id, and the next
//      push carries it readable (`healable`, pushed right away);
//   2. cloud readable, local unreadable → adopted now (`recovered`); nothing
//      readable is at stake and leaving it would let "Keep local" push
//      ciphertext over the cloud's readable copy;
//   3. cloud flagged, local lacks it   → stored flagged, verbatim (`kept`);
//   4. local unreadable, cloud lacks it → carried by the next push (`carried`,
//      pushed right away);
//   5. flagged on both sides: same ciphertext → nothing; else the fresher
//      editedAt wins (adopted as 3, or carried as 4).
// The classifier (unchanged) then compares readable sets only.
// Returns { cloud, local, healable, recovered, kept, carried }.
async function reconcileCloudEntries(cloudEntries) {
  const valid = (e) => e && typeof e.id === "string";
  const recovered = await adoptReadableCopies(cloudEntries); // rule 2
  const localById = new Map(state.entries.map((e) => [e.id, e]));
  const cloudIds = new Set(cloudEntries.filter(valid).map((e) => e.id));
  let healable = 0;
  let kept = 0;
  const cloud = [];
  for (const item of cloudEntries) {
    if (!valid(item) || !isUnreadableRecord(item)) {
      cloud.push(item); // readable (or invalid, left to the validators as before)
      continue;
    }
    if (localById.has(item.id)) {
      cloud.push(localById.get(item.id)); // rule 1: compare as equal on this id; the push carries it readable
      healable++;
      continue;
    }
    const mine = state.unreadable.find((u) => u.id === item.id);
    if (!mine) {
      if (await storeUnreadableCopy(item)) kept++; // rule 3
    } else if (mine.text !== item.text && entryFreshness(item) > entryFreshness(mine)) {
      if (await storeUnreadableCopy(item)) kept++; // rule 5
    }
  }
  const carried = state.unreadable.filter((u) => !cloudIds.has(u.id)).length; // rule 4
  if (kept > 0) render();
  return { cloud, local: state.entries, healable, recovered, kept, carried };
}

// True when a pull found something to send back (rules 1 and 4): heal straight
// away rather than on the next unrelated save, or a device the user only reads
// on would leave the cloud's flags in place forever.
function reconcileWantsPush(reconciled) {
  return reconciled.healable > 0 || reconciled.carried > 0;
}

function describePullReconcile(reconciled) {
  const parts = [];
  if (reconciled.recovered > 0) {
    parts.push(`recovered ${pluralCount(reconciled.recovered, "note")} from the cloud`);
  }
  if (reconciled.kept > 0) {
    parts.push(`${pluralCount(reconciled.kept, "note")} in the cloud can't be opened here (kept)`);
  }
  if (reconciled.healable > 0) {
    parts.push(`this browser can open ${pluralCount(reconciled.healable, "note")} the cloud couldn't; sending ${reconciled.healable === 1 ? "it" : "them"} now`);
  }
  if (reconciled.carried > 0) {
    parts.push(`${pluralCount(reconciled.carried, "note")} that can't be opened here ${reconciled.carried === 1 ? "is" : "are"} kept in the cloud too`);
  }
  return parts.join("; ");
}

// Stable serialization of the fields that define a block's content, sorted by id.
// tags/mentions are derived from text, so they're excluded from the comparison.
function canonicalizeEntries(entries) {
  const normalized = entries
    .filter((e) => e && typeof e.id === "string")
    .map((e) => ({
      id: e.id,
      text: typeof e.text === "string" ? e.text : "",
      createdAt: typeof e.createdAt === "string" ? e.createdAt : "",
      editedAt: typeof e.editedAt === "string" ? e.editedAt : (e.createdAt || ""),
      pinned: e.pinned === true,
      ...(typeof e.olderVersionOf === "string" ? { olderVersionOf: e.olderVersionOf } : {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(normalized);
}

function entriesDiffer(cloud, local) {
  return canonicalizeEntries(cloud) !== canonicalizeEntries(local);
}

// Merge base. Records the SHA-256 of the canonical set this browser last KNEW the
// cloud held (PUT 200 of that exact snapshot, a pull that came back identical, or
// a replace-with-cloud). At the conflict card, "cloud hash === base" proves the
// cloud has not changed since we last synced, so any divergence originated here.
// Stored encrypted under the master key (no plaintext-derived hash at rest); a
// key change makes it undecryptable, which simply means "no base". Never
// written on Keep — the resulting push records it.
const SYNC_BASE_HASH_KEY = "sync-last-synced-hash";
// The cloud generation this browser last synced to (plaintext integer; leaks
// nothing). Known only once the Worker has answered with an ETag "g<N>" — an
// older self-hosted Worker never sends one, so no generation is ever stored
// for it and no conditional header is ever sent to it (its CORS allow-list
// would refuse one). A Txtshell account always speaks conditionally.
const SYNC_GENERATION_KEY = "sync-last-synced-generation";
// What this browser and the cloud last agreed on, note by note: id → fingerprint (SHA-256 of the note's
// canonical form). The everyday merge's base (Part B, 2026-10-13): with it, "deleted on another device"
// and "new here" are different observations, so no deletion record is needed in the cloud copy.
// Encrypted under the master key, like the set hash above; readable notes only.
const SYNC_BASE_MAP_KEY = "sync-last-synced-notes";

function isCentral() {
  return state.encryption.mode === "central";
}

async function readSyncedGeneration() {
  const stored = await getMeta(SYNC_GENERATION_KEY);
  if (stored === "" || stored === null || stored === undefined) return null;
  const n = Number(stored);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

async function recordSyncedGeneration(generation) {
  if (!Number.isInteger(generation) || generation < 0) return;
  try {
    await saveMeta(SYNC_GENERATION_KEY, String(generation));
  } catch (error) {
    console.warn("[txtshell] couldn't record sync generation", error);
  }
}

// ETag "g<N>" (or X-Blob-Generation) → N; null when the Worker sent neither
// (a legacy self-hosted Worker, or a cross-origin one that does not expose it).
function generationFromResponse(response) {
  const etag = response.headers.get("etag") || "";
  const match = etag.match(/^(?:W\/)?"g(\d+)"$/);
  if (match) return Number(match[1]);
  const header = response.headers.get("x-blob-generation");
  if (header !== null && /^\d+$/.test(header)) return Number(header);
  return null;
}

// Whether this push/pull should carry If-Match / If-None-Match.
async function syncIsConditional() {
  if (isCentral()) return true;
  return (await readSyncedGeneration()) !== null;
}

// Forgets what this browser believes the cloud holds: the merge base and the
// generation. Local blocks are KEPT. Called when the account's key changes
// under this device (join, re-key, rung 2, abandon) so a pre-change generation
// is never reused, and when the cloud turns out to be empty.
async function clearSyncState() {
  try {
    await Promise.all([deleteMeta(SYNC_BASE_HASH_KEY), deleteMeta(SYNC_BASE_MAP_KEY), deleteMeta(SYNC_GENERATION_KEY)]);
  } catch (error) {
    console.warn("[txtshell] couldn't clear sync state", error);
  }
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function recordSyncedBaseCanonical(canonical) {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) return;
  try {
    const hash = await sha256Hex(canonical);
    await saveMeta(SYNC_BASE_HASH_KEY, await encryptPlaintext(hash, state.encryption.masterKey));
  } catch (error) {
    console.warn("[txtshell] couldn't record sync base", error); // no base is always safe
  }
}

async function recordSyncedBase(entries) {
  await recordSyncedBaseCanonical(canonicalizeEntries(entries));
  await recordSyncBaseMap(entries);
}

async function noteFingerprint(entry) {
  return sha256Hex(canonicalizeEntries([entry]));
}

// id → fingerprint for the readable notes of a set (unreadable records keep their own rules).
async function noteFingerprints(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e && typeof e.id === "string" && typeof e.text === "string" && !isUnreadableRecord(e)) map.set(e.id, await noteFingerprint(e));
  }
  return map;
}

async function recordSyncBaseMap(entries) {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) return;
  try {
    const map = await noteFingerprints(entries);
    await saveMeta(SYNC_BASE_MAP_KEY, await encryptPlaintext(JSON.stringify(Object.fromEntries(map)), state.encryption.masterKey));
  } catch (error) {
    console.warn("[txtshell] couldn't record the sync base list", error); // no base is always safe
  }
}

// The base list, or null when there is none (never synced here, cleared, or another key).
async function readSyncBaseMap() {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) return null;
  try {
    const stored = await getMeta(SYNC_BASE_MAP_KEY);
    if (!stored) return null;
    const obj = JSON.parse(await decryptCiphertext(stored, state.encryption.masterKey));
    return obj && typeof obj === "object" ? new Map(Object.entries(obj)) : null;
  } catch {
    return null;
  }
}

// The base for a merge. A browser that synced before per-note bases has only the set's hash: if this
// browser, or the cloud, still equals that set, its notes are the base (a one-time upgrade).
async function syncBaseFor(cloudEntries) {
  const map = await readSyncBaseMap();
  if (map) return map;
  if (await cloudMatchesSyncedBase(syncPayloadEntries())) return noteFingerprints(state.entries);
  if (await cloudMatchesSyncedBase(cloudEntries)) return noteFingerprints(cloudEntries);
  return null; // no base: a plain union (nothing is inferred deleted)
}

async function clearSyncedBase() {
  try {
    await deleteMeta(SYNC_BASE_MAP_KEY);
    await deleteMeta(SYNC_BASE_HASH_KEY);
  } catch (error) {
    console.warn("[txtshell] couldn't clear sync base", error);
  }
}

// True only when a base exists, decrypts under the current key, and equals the
// hash of the cloud set in hand. Any failure → false → today's classification.
async function cloudMatchesSyncedBase(cloudEntries) {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) return false;
  try {
    const stored = await getMeta(SYNC_BASE_HASH_KEY);
    if (!stored) return false;
    const base = await decryptCiphertext(stored, state.encryption.masterKey);
    if (!/^[0-9a-f]{64}$/.test(base)) return false;
    return (await sha256Hex(canonicalizeEntries(cloudEntries))) === base;
  } catch {
    return false; // undecryptable (key changed) or unreadable → no base
  }
}

// Newest content timestamp across entries (ISO strings compare lexicographically).
// These live inside the GCM-authenticated payload, so a hostile server can't forge
// them — they're the trustworthy freshness signal for the pull-conflict card.
function newestEntryStamp(entries) {
  let newest = "";
  for (const e of entries) {
    const stamp = (typeof e?.editedAt === "string" && e.editedAt) ||
      (typeof e?.createdAt === "string" && e.createdAt) || "";
    if (stamp > newest) {
      newest = stamp;
    }
  }
  return newest;
}

// Manual fetch. Requires an unlocked vault. Compares the cloud blob to local and
// either no-ops ("up to date") or raises the conflict card.
async function beginPull({ quiet = false } = {}) {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) {
    if (!quiet) composerHint.textContent = "Unlock your notes to pull.";
    return;
  }
  if (!quiet) composerHint.textContent = "Pulling…";
  lastPullStartedAt = Date.now();
  pullHoldDepth++;
  try {
    const result = await fetchAndDecryptBlocks();
    markSynced();
    setSyncStatus("ok"); // reachable + decrypted: the sync channel is healthy
    if (result.upToDate) {
      state.central.firstJoin = false;
      composerHint.textContent = "Already up to date.";
      await pushIfAhead();
      return;
    }
    // A first join that needs no card says what happened (dev walk, 2026-10-13).
    const joining = isCentral() && state.central.firstJoin;
    if (result.empty) {
      state.central.firstJoin = false;
      void clearSyncedBase();
      if (joining && state.entries.length > 0) scheduleCloudSync(); // the cloud's first copy is this browser's
      composerHint.textContent = joining && state.entries.length > 0
        ? `Sync is on — your ${pluralCount(state.entries.length, "note")} ${state.entries.length === 1 ? "is" : "are"} now in the cloud.`
        : "Cloud is empty — nothing to pull.";
      return;
    }
    const reconciled = await reconcileCloudEntries(result.entries);
    if (entriesDiffer(reconciled.cloud, reconciled.local) && joining) {
      await showPullConflict(result.entries, reconciled, result.generation); // awaited: the card must be up before the hold lifts
    } else if (entriesDiffer(reconciled.cloud, reconciled.local)) {
      const hint = await mergeEverydayPull(result.entries, reconciled, result.generation);
      if (hint) composerHint.textContent = hint;
      else if (!quiet && !state.vaultView) composerHint.textContent = "Already up to date.";
    } else {
      void recordSyncedBase(result.entries); // local == cloud, established
      if (result.generation !== null) void recordSyncedGeneration(result.generation);
      state.central.firstJoin = false;
      const note = describePullReconcile(reconciled);
      composerHint.textContent = joining
        ? "Sync is on — everything was already in the cloud."
        : note ? `Already up to date — ${note}.` : "Already up to date.";
    }
    // Replayed after the card if one is showing (the hold defers it).
    if (reconcileWantsPush(reconciled)) {
      scheduleCloudSync();
    }
  } catch (error) {
    setPullStatusFromError(error);
    // A key mismatch can't be resolved by "Replace with cloud" (we can't decrypt the
    // cloud copy at all), so it gets its own dedicated card rather than the hint or
    // the pull-conflict card. Only on an EXPLICIT pull — never mid-session.
    if (error?.message === "decrypt") {
      showKeyMismatch();
      return;
    }
    composerHint.textContent = pullErrorMessage(error);
  } finally {
    pullHoldDepth--;
    releaseDeferredPush(); // no-op if the conflict card is now holding
    runPendingFocusPull();
  }
}

// Non-blocking background fetch fired after a successful unlock. Failures surface as a
// hint toast and are otherwise ignored; an empty cloud is a silent no-op. Only prompts
// when the normal view is showing, so it never clobbers an open vault card.
// Returns "unchanged" when the cloud held nothing new for this browser, else "changed" (null on error).
async function autoPullOnUnlock() {
  lastPullStartedAt = Date.now();
  let outcome = "changed";
  pullHoldDepth++;
  try {
    const result = await fetchAndDecryptBlocks();
    markSynced();
    setSyncStatus("ok"); // reachable + decrypted: the sync channel is healthy
    if (result.upToDate) {
      state.central.firstJoin = false;
      await pushIfAhead();
      return "unchanged";
    }
    if (result.empty) {
      state.central.firstJoin = false;
      void clearSyncedBase();
      return "unchanged";
    }
    if (!state.encryption.unlocked || state.vaultView) return null; // user moved on; catch it next time
    const reconciled = await reconcileCloudEntries(result.entries);
    const joining = isCentral() && state.central.firstJoin;
    if (entriesDiffer(reconciled.cloud, reconciled.local) && joining) {
      await showPullConflict(result.entries, reconciled, result.generation); // awaited: the card must be up before the hold lifts
    } else if (entriesDiffer(reconciled.cloud, reconciled.local)) {
      const hint = await mergeEverydayPull(result.entries, reconciled, result.generation);
      if (hint) composerHint.textContent = hint;
    } else {
      void recordSyncedBase(result.entries); // local == cloud, established
      if (result.generation !== null) void recordSyncedGeneration(result.generation);
      outcome = "unchanged";
    }
    if (reconciled.recovered > 0 || reconciled.kept > 0) {
      const note = describePullReconcile({ ...reconciled, healable: 0, carried: 0 });
      composerHint.textContent = note.charAt(0).toUpperCase() + note.slice(1) + ".";
    }
    if (reconcileWantsPush(reconciled)) {
      scheduleCloudSync(); // see beginPull
    }
    return outcome;
  } catch (error) {
    if (error?.message === "not-configured") return null; // sync not set up — nothing to fetch
    // Surfaces in the ambient indicator (labelled as a pull problem) and toasts on
    // the transition into failure — replaces the old standalone toast. Note: a key
    // mismatch ("decrypt") only flags the persistent failed status here ("cloud copy
    // doesn't match this device's key") — we deliberately do NOT pop the resolution
    // card with its destructive overwrite button mid-session. That card surfaces only
    // on an explicit /pull (beginPull), so an overwrite can never happen by accident.
    setPullStatusFromError(error);
    return null;
  } finally {
    pullHoldDepth--;
    releaseDeferredPush(); // no-op if the conflict card is now holding
    runPendingFocusPull();
  }
}

function pullErrorMessage(error) {
  switch (error?.message) {
    case "not-configured":
      return "Sync not configured — run /sync setup.";
    case "auth":
      return "Sync auth failed — check /sync setup.";
    case "decrypt":
      return "Couldn't open the notes in the cloud.";
    case "locked":
      return "Unlock your notes to pull.";
    case "malformed":
      return "Cloud data decrypted but looks corrupt — the server may be misbehaving.";
    case "too-large":
      return "Cloud response is unreasonably large — refusing to load it.";
    default:
      return "Couldn't reach cloud. Try again.";
  }
}

// `cloudEntries` is the raw pulled set (what Replace adopts and what the base
// hash was computed over); `reconciled` holds the two sets the classifier
// compares after the readable-beats-unreadable rule.
async function showPullConflict(cloudEntries, reconciled = null, cloudGeneration = null) {
  if (!reconciled) {
    reconciled = await reconcileCloudEntries(cloudEntries);
  }
  const baseMatches = await cloudMatchesSyncedBase(cloudEntries);
  if (state.vaultView) return; // a card opened meanwhile — never clobber it
  const joining = isCentral() && state.central.firstJoin;
  if (joining) {
    // When one side already contains the other, keeping all loses nothing: join without a card.
    const diff = classifyPullDivergence(reconciled.cloud, reconciled.local, false);
    const changed = diff.cloudNewer.length + diff.localNewer.length + diff.ambiguous.length;
    if (changed === 0 && (diff.cloudOnly.length === 0 || diff.localOnly.length === 0)) {
      await joinWithoutCard(cloudEntries, cloudGeneration, { A: reconciled.cloud.length, B: reconciled.local.length, X: diff.cloudOnly.length, Y: diff.localOnly.length });
      return;
    }
  }
  state.vaultPending = { pullEntries: cloudEntries, pullCloud: reconciled.cloud, pullLocal: reconciled.local, baseMatches, pullGeneration: cloudGeneration };
  // After a join, cloud and local are two unrelated histories: the first-join card instead of
  // the stale-copy card.
  state.vaultView = joining ? "first-join" : "pull-conflict";
  renderVault();
}

// A first join where one side contains the other (dev walk, 2026-10-13): keep all, say so.
async function joinWithoutCard(cloudEntries, cloudGeneration, { A, B, X, Y }) {
  await mergeImportedEntries(cloudEntries); // the union; nothing here is replaced
  if (Number.isInteger(cloudGeneration)) await recordSyncedGeneration(cloudGeneration);
  state.central.firstJoin = false;
  if (Y > 0) {
    scheduleCloudSync(); // this browser has notes the cloud lacks
  } else {
    // Local == cloud now. The merge's saves armed a push of exactly what the cloud holds: drop it,
    // as Replace does (it would only move the generation and send other devices to a 412).
    await recordSyncedBase(cloudEntries);
    if (cloudSyncTimer !== null) {
      window.clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
    }
    cloudSyncDeferred = false;
  }
  composerHint.textContent = B === 0
    ? `Sync is on — ${pluralCount(A, "note")} from the cloud ${A === 1 ? "is" : "are"} here.`
    : X > 0
      ? `Sync is on — ${pluralCount(X, "note")} from the cloud added.`
      : `Sync is on — ${Y} of your notes added to the cloud.`;
}

// A pull is a full sync (Part B): the cloud is unchanged (304) but this browser has a change it never
// got up — a push that failed, say — so send it now rather than at the next edit.
async function pushIfAhead() {
  if (!(await cloudMatchesSyncedBase(syncPayloadEntries()))) scheduleCloudSync();
}

// ---------- the everyday merge (Part B, 2026-10-13) ----------
// Three-way, per note, against what this browser and the cloud last agreed on (the base list). It never
// loses a note:
//   only on one side, not in the base          → new there: kept on both
//   in the base, unchanged here, gone from cloud → deleted on another device: deleted here
//   in the base, unchanged in cloud, gone here   → deleted here: stays deleted
//   changed on one side, gone from the other     → the edit beats the delete: kept
//   changed on one side only                     → that change wins
//   changed on both (or no base)                 → newer wins; the older one is kept as its own note,
//                                                  marked olderVersionOf (same text, same stamps)
// Readable notes only: unreadable records keep the reconcile rules (never deleted by inference).
// With no base at all (a first join) it is a plain union with the same both-changed rule.
async function mergeNotes(base, localEntries, cloudEntries) {
  const usable = (e) => e && typeof e.id === "string" && typeof e.text === "string" && !isUnreadableRecord(e);
  const L = new Map(localEntries.filter(usable).map((e) => [e.id, e]));
  const C = new Map(cloudEntries.filter(usable).map((e) => [e.id, e]));
  const merged = new Map();
  const toLocal = [];     // notes to write here (new from elsewhere, updated, kept copies)
  const deleteLocal = []; // notes here that another device deleted
  const counts = { added: 0, updated: 0, deleted: 0, bothKept: 0 };
  for (const id of new Set([...L.keys(), ...C.keys()])) {
    const l = L.get(id);
    const c = C.get(id);
    const b = base ? base.get(id) : undefined;
    if (l && c) {
      const fl = await noteFingerprint(l);
      const fc = await noteFingerprint(c);
      if (fl === fc) { merged.set(id, l); continue; }
      const localChanged = b === undefined || fl !== b;
      const cloudChanged = b === undefined || fc !== b;
      if (localChanged && !cloudChanged) { merged.set(id, l); continue; }
      if (!localChanged && cloudChanged) { merged.set(id, c); toLocal.push(c); counts.updated++; continue; }
      // Changed on both. The newer edit wins; an exact tie is broken by fingerprint so every device agrees.
      const delta = entryFreshness(l) - entryFreshness(c);
      const localNewer = Number.isFinite(delta) && delta !== 0 ? delta > 0 : fl > fc;
      const newer = localNewer ? l : c;
      const older = localNewer ? c : l;
      merged.set(id, newer);
      if (!localNewer) toLocal.push(c);
      if (l.text === c.text) continue; // only the pin differs: nothing worth keeping twice
      const copy = await olderCopyOf(older);
      if (!L.has(copy.id) && !C.has(copy.id) && !merged.has(copy.id)) {
        merged.set(copy.id, copy);
        toLocal.push(copy);
        counts.bothKept++;
      }
      continue;
    }
    if (l) {
      if (b === undefined) { merged.set(id, l); continue; }                                  // new here
      if ((await noteFingerprint(l)) === b) { deleteLocal.push(l); counts.deleted++; continue; } // deleted elsewhere
      merged.set(id, l); continue;                                                            // edited here: kept
    }
    if (b !== undefined && (await noteFingerprint(c)) === b) continue;                         // deleted here
    merged.set(id, c); toLocal.push(c); counts.added++;                                        // new (or edited) elsewhere
  }
  return { merged: [...merged.values()], toLocal, deleteLocal, counts };
}

// The older version of a note changed on two devices, kept as its own note. Its id comes from the
// original's id and the older version's content, so two devices resolving the same conflict make the
// same note (and the duplicates collapse). Its text and stamps are untouched; only the marker is added.
async function olderCopyOf(older) {
  const original = typeof older.olderVersionOf === "string" ? older.olderVersionOf : older.id;
  const h = await sha256Hex(`${older.id}|${await noteFingerprint(older)}`);
  return {
    id: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`,
    text: older.text,
    tags: extractTags(older.text),
    mentions: extractMentions(older.text),
    createdAt: older.createdAt,
    editedAt: older.editedAt || older.createdAt,
    pinned: false,
    olderVersionOf: original,
  };
}

// Writes a merge's result into this browser (saves arm a push; the caller decides whether it stays armed).
async function applyMergeToLocal(merge) {
  for (const item of merge.toLocal) {
    const entry = entryFromPlaintext(item, item.text);
    const index = state.entries.findIndex((e) => e.id === entry.id);
    if (index === -1) state.entries.push(entry);
    else state.entries[index] = entry;
    await saveEntry(entry);
  }
  if (merge.deleteLocal.length > 0) {
    const ids = new Set(merge.deleteLocal.map((e) => e.id));
    state.entries = state.entries.filter((e) => !ids.has(e.id));
    await deleteEntryRecords([...ids]);
  }
  state.entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  render();
}

// "Synced · 2 notes added from another device", and the mixed form (approved 2026-10-13).
function syncMergeHint({ added, updated, deleted, bothKept }) {
  const kinds = [["added", added], ["updated", updated], ["deleted", deleted]].filter(([, n]) => n > 0);
  const both = bothKept > 0 ? `${pluralCount(bothKept, "note")} changed on two devices — both versions kept` : "";
  if (kinds.length === 0) return both ? `Synced · ${both}` : "";
  if (kinds.length === 1 && !both) {
    const [kind, n] = kinds[0];
    return kind === "deleted" ? `Synced · ${pluralCount(n, "note")} deleted on another device` : `Synced · ${pluralCount(n, "note")} ${kind} from another device`;
  }
  return `Synced · from another device: ${kinds.map(([kind, n]) => `${n} ${kind}`).join(", ")}${both ? ` · ${both}` : ""}`;
}

// The safety valve: one merge that would remove more than half of this browser's notes, and more
// than ten, asks first (a buggy device must not empty another one).
const SYNC_REMOVE_ASK_MIN = 10;

// A pull that found differences, outside a first join: merge, apply, push what the cloud lacks.
// Returns the hint ("" when nothing changed here).
async function mergeEverydayPull(cloudEntries, reconciled, cloudGeneration) {
  const base = await syncBaseFor(cloudEntries);
  const merge = await mergeNotes(base, reconciled.local, reconciled.cloud);
  if (merge.deleteLocal.length > SYNC_REMOVE_ASK_MIN && merge.deleteLocal.length > reconciled.local.length / 2) {
    if (state.vaultView) return ""; // a card is open: the next pull asks
    state.vaultPending = { syncRemoved: { merge, cloudEntries, cloudReadable: reconciled.cloud, cloudGeneration } };
    state.vaultView = "sync-removed";
    renderVault();
    return "";
  }
  return applyEverydayMerge(merge, cloudEntries, reconciled.cloud, cloudGeneration);
}

async function applyEverydayMerge(merge, cloudEntries, cloudReadable, cloudGeneration, { keepRemoved = false } = {}) {
  if (keepRemoved) {
    merge = { ...merge, merged: [...merge.merged, ...merge.deleteLocal], deleteLocal: [], counts: { ...merge.counts, deleted: 0 } };
  }
  if (Number.isInteger(cloudGeneration)) await recordSyncedGeneration(cloudGeneration); // the push is conditional on the cloud we merged
  await applyMergeToLocal(merge);
  if (canonicalizeEntries(merge.merged) === canonicalizeEntries(cloudReadable)) {
    // This browser now matches the cloud: record it, and drop the push the saves armed (it would only
    // move the generation and send other devices to a 412 over nothing).
    await recordSyncedBase(cloudEntries);
    if (cloudSyncTimer !== null) {
      window.clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
    }
    cloudSyncDeferred = false;
  } else {
    scheduleCloudSync(); // the cloud lacks something: push (held until the pull's hold lifts)
  }
  return syncMergeHint(merge.counts);
}

function renderSyncRemovedCard() {
  const pending = state.vaultPending?.syncRemoved;
  if (!pending) {
    exitVaultToNormal();
    return;
  }
  const removed = pending.merge.deleteLocal;
  const n = removed.length;
  vaultOverlay.innerHTML = `
    <div class="vault-card" data-sync-removed="${n}">
      ${SYNC_ICON_SVG}
      <p class="vault-title">Another device removed ${n} of your notes</p>
      <p class="vault-subtitle">If you didn't delete them, keep them — they'll go back to the cloud.</p>
      <button class="vault-link" type="button" data-action="show-removed" aria-expanded="false">Show which</button>
      <div data-field="removed-list" hidden>${notePreviewList(removed)}</div>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="keep">Keep them</button>
      <button class="vault-link" type="button" data-action="remove">Remove them here too</button>
    </div>
  `;
  const toggle = vaultOverlay.querySelector('[data-action="show-removed"]');
  toggle.addEventListener("click", () => {
    const panel = vaultOverlay.querySelector('[data-field="removed-list"]');
    panel.hidden = !panel.hidden;
    toggle.textContent = panel.hidden ? "Show which" : "Hide";
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
  });
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const buttons = [...vaultOverlay.querySelectorAll("button")];
  const settle = (keepRemoved) => async () => {
    buttons.forEach((button) => { button.disabled = true; });
    try {
      // Applied while the card still holds pushes; closing it releases the push.
      await applyEverydayMerge(pending.merge, pending.cloudEntries, pending.cloudReadable, pending.cloudGeneration, { keepRemoved });
      state.vaultPending = null;
      exitVaultToNormal();
      composerHint.textContent = keepRemoved ? `Kept ${n} notes — they're back in the cloud.` : `Removed ${n} notes, as on your other device.`;
    } catch (error) {
      console.error(error);
      errorLine.textContent = "That didn't work. Try again.";
      errorLine.hidden = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  };
  vaultOverlay.querySelector('[data-action="keep"]').addEventListener("click", settle(true));
  vaultOverlay.querySelector('[data-action="remove"]').addEventListener("click", settle(false));
  vaultOverlay.querySelector('[data-action="keep"]').focus(); // the safe choice is the default
}

// Up to five notes by their first line, then "and N more" (the cards' Show which and confirmations).
function notePreviewList(entries) {
  return `<ul class="pull-diff-list">${entries.slice(0, 5).map((e) => `<li>${escapeHtml(previewBlockText(e))}</li>`).join("")}${entries.length > 5 ? `<li class="pull-diff-more">and ${entries.length - 5} more</li>` : ""}</ul>`;
}

// Per-id three-way-ish diff of the cloud snapshot against local. No tombstones
// exist, so a "localOnly" block is EITHER a local addition OR a block deleted on
// another device — indistinguishable; keeping local may resurrect it (not content
// loss). The destructive direction is the reverse: "cloudOnly" may be a remote
// addition that "Keep local" would discard, so anything in cloudOnly/cloudNewer
// routes to the careful card. Shared ids with different content are ranked by
// editedAt under the same clock-skew tolerance the old card used; inside the
// tolerance they're "ambiguous" and force the careful card.
function classifyPullDivergence(cloudEntries, localEntries, baseMatches = false) {
  const valid = (e) => e && typeof e.id === "string";
  const cloudById = new Map(cloudEntries.filter(valid).map((e) => [e.id, e]));
  const localById = new Map(localEntries.filter(valid).map((e) => [e.id, e]));
  const localOnly = [];
  const cloudOnly = [];
  const localNewer = [];
  const cloudNewer = [];
  const ambiguous = [];
  for (const [id, local] of localById) {
    const cloud = cloudById.get(id);
    if (!cloud) {
      localOnly.push(local);
      continue;
    }
    if (canonicalizeEntries([local]) === canonicalizeEntries([cloud])) {
      continue;
    }
    const delta = entryFreshness(local) - entryFreshness(cloud);
    if (Number.isFinite(delta) && delta > PULL_CLOCK_SKEW_TOLERANCE_MS) {
      localNewer.push(local);
    } else if (Number.isFinite(delta) && delta < -PULL_CLOCK_SKEW_TOLERANCE_MS) {
      cloudNewer.push(cloud);
    } else {
      ambiguous.push(local); // includes unparseable stamps (delta NaN/±Infinity)
    }
  }
  for (const [id, cloud] of cloudById) {
    if (!localById.has(id)) {
      cloudOnly.push(cloud);
    }
  }
  // Merge base: the cloud is byte-identical to what we last synced, so every
  // divergence originated here and in-window "ambiguous" edits are local edits.
  // Applied ONLY when the cloud shows no evidence of change — cloudOnly/cloudNewer
  // under a base match is a contradiction (another tab of this profile pushed, or a
  // clock ran backwards) and the base is ignored. It upgrades ambiguity; it never
  // overrides evidence.
  const baseApplied = baseMatches && cloudOnly.length === 0 && cloudNewer.length === 0;
  if (baseApplied && ambiguous.length > 0) {
    localNewer.push(...ambiguous.splice(0));
  }
  const localAhead = localOnly.length + localNewer.length;
  const cloudAhead = cloudOnly.length + cloudNewer.length;
  let kind;
  if (ambiguous.length === 0 && cloudAhead === 0 && localAhead > 0) {
    kind = "local-ahead";
  } else if (ambiguous.length === 0 && localAhead === 0 && cloudAhead > 0) {
    kind = "cloud-ahead";
  } else {
    kind = "diverged"; // includes "differ but nothing classifiable" — never a blank card
  }
  return { kind, localOnly, cloudOnly, localNewer, cloudNewer, ambiguous, baseApplied };
}

// Short, single-line preview of a block for the conflict card lists.
function previewBlockText(entry, max = 60) {
  if (isUnreadableRecord(entry)) {
    return "(can't be opened here)"; // never preview ciphertext
  }
  const line = (typeof entry?.text === "string" ? entry.text : "")
    .split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "(empty note)";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function renderPreviewList(label, entries, limit = 3) {
  if (entries.length === 0) return "";
  const items = entries.slice(0, limit)
    .map((e) => `<li>${escapeHtml(previewBlockText(e))}</li>`).join("");
  const more = entries.length > limit
    ? `<li class="pull-diff-more">+${entries.length - limit} more</li>` : "";
  return `<p class="vault-subtitle pull-diff-label">${escapeHtml(label)}</p><ul class="pull-diff-list">${items}${more}</ul>`;
}

const pluralCount = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function renderPullConflictCard() {
  const cloudEntries = state.vaultPending?.pullEntries;
  if (!Array.isArray(cloudEntries)) {
    exitVaultToNormal();
    return;
  }
  // Compare the reconciled sets (readable beats unreadable, applied before the
  // classifier); fall back to the raw sets for a pending card from an older build.
  const cloudSet = Array.isArray(state.vaultPending.pullCloud) ? state.vaultPending.pullCloud : cloudEntries;
  const localSet = Array.isArray(state.vaultPending.pullLocal) ? state.vaultPending.pullLocal : state.entries;
  const diff = classifyPullDivergence(cloudSet, localSet, state.vaultPending.baseMatches === true);
  const cloudNewest = newestEntryStamp(cloudSet);
  const localNewest = newestEntryStamp(localSet);
  const fmtStamp = (stamp) => {
    const t = new Date(stamp);
    return stamp && !Number.isNaN(t.getTime()) ? t.toLocaleString() : "unknown";
  };
  const detail = `Cloud: ${pluralCount(cloudSet.length, "note")}, last changed ${fmtStamp(cloudNewest)} · This browser: ${pluralCount(localSet.length, "note")}, last changed ${fmtStamp(localNewest)}`;

  let title;
  let subtitle;
  let lists = "";
  let warning = "";
  let replaceLabel;
  let keepLabel;
  let primary; // "keep" | "replace" | null — null means neither is emphasised
  if (diff.kind === "local-ahead") {
    // SAFE: the cloud has nothing this browser lacks and no newer edits, so keeping
    // local loses no content. (It may resurrect a block deleted elsewhere — see
    // classifyPullDivergence.) Only this branch gets the friendly framing.
    const adds = diff.localOnly.length;
    const edits = diff.localNewer.length;
    const parts = [];
    if (adds) parts.push(`saved ${pluralCount(adds, "note")} here that ${adds === 1 ? "isn't" : "aren't"} in the cloud yet`);
    if (edits) parts.push(`changed ${pluralCount(edits, "note")} here more recently than the cloud`);
    const it = adds + edits === 1 ? "it" : "them";
    title = "This browser has changes the cloud doesn't";
    subtitle = `You've ${parts.join(" and ")}. Nothing in the cloud is missing from this browser, so keeping ${it} loses nothing.`;
    if (diff.baseApplied) {
      subtitle += " The cloud hasn't changed since this browser last synced.";
    }
    lists = renderPreviewList(adds ? "Not in the cloud yet:" : "Edited here:", adds ? diff.localOnly : diff.localNewer);
    keepLabel = `Keep ${it}`;
    replaceLabel = `Discard ${it}, use cloud copy`;
    primary = "keep";
  } else if (diff.kind === "cloud-ahead") {
    // Replacing loses nothing here. "Keep local" is the destructive direction
    // (it discards cloud-only blocks — which could be remote additions, or blocks
    // you deleted here that never pushed; the wording stays true either way).
    const adds = diff.cloudOnly.length;
    const edits = diff.cloudNewer.length;
    const parts = [];
    if (adds) parts.push(`${pluralCount(adds, "note")} this browser doesn't`);
    if (edits) parts.push(`${pluralCount(edits, "note")} changed more recently than this browser's copy`);
    title = "The cloud has changes this browser doesn't";
    subtitle = `The cloud has ${parts.join(" and ")}. Nothing here is missing from the cloud, so replacing loses nothing.`;
    lists = renderPreviewList(adds ? "Only in the cloud:" : "Newer in the cloud:", adds ? diff.cloudOnly : diff.cloudNewer);
    replaceLabel = "Replace with cloud";
    keepLabel = `Keep local — discards the cloud's ${adds + edits === 1 ? "change" : "changes"}`;
    primary = "replace";
  } else {
    // TRUE CONFLICT: both sides hold something the other lacks (or the timestamps
    // can't order them). Either choice loses the other side's changes — and
    // "Keep local" pushes IMMEDIATELY, so that loss is not deferred.
    const cloudCount = diff.cloudOnly.length + diff.cloudNewer.length;
    const localCount = diff.localOnly.length + diff.localNewer.length;
    const amb = diff.ambiguous.length;
    title = "Cloud and this browser have diverged";
    const sides = [];
    if (cloudCount) sides.push(`the cloud has ${pluralCount(cloudCount, "change")} this browser doesn't`);
    if (localCount) sides.push(`this browser has ${pluralCount(localCount, "change")} the cloud doesn't`);
    let body = sides.length ? sides.join(", and ") : "the two copies differ";
    body = body.charAt(0).toUpperCase() + body.slice(1) + ".";
    if (amb) {
      body += ` ${pluralCount(amb, "note")} ${amb === 1 ? "was" : "were"} changed in both places at almost the same time, so it can't tell which is newer.`;
    }
    subtitle = `${body} Whichever you choose, the other side's changes are lost.`;
    lists = renderPreviewList("Only in the cloud:", diff.cloudOnly) +
      renderPreviewList("Newer in the cloud:", diff.cloudNewer) +
      renderPreviewList("Only in this browser:", diff.localOnly) +
      renderPreviewList("Newer in this browser:", diff.localNewer) +
      renderPreviewList("Differ, can't tell which is newer:", diff.ambiguous);
    warning = `Keep local overwrites the cloud copy right away — the cloud's ${cloudCount || amb ? pluralCount(cloudCount + amb, "change") : "changes"} will be gone from every device. Replace with cloud deletes this browser's ${localCount || amb ? pluralCount(localCount + amb, "change") : "changes"}.`;
    replaceLabel = "Replace with cloud";
    keepLabel = "Keep local, overwrite cloud";
    primary = null;
  }

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">${escapeHtml(title)}</p>
      <p class="vault-subtitle">${escapeHtml(subtitle)}</p>
      ${lists}
      ${warning ? `<p class="wipe-warning">${escapeHtml(warning)}</p>` : ""}
      <p class="vault-subtitle pull-diff-detail">${escapeHtml(detail)}</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button${primary === "replace" ? "" : " secondary"}" type="button" data-action="replace">${escapeHtml(replaceLabel)}</button>
      <button class="vault-button${primary === "keep" ? "" : " secondary"}" type="button" data-action="keep">${escapeHtml(keepLabel)}</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const replaceButton = vaultOverlay.querySelector('[data-action="replace"]');
  const keepButton = vaultOverlay.querySelector('[data-action="keep"]');
  replaceButton.addEventListener("click", async () => {
    replaceButton.disabled = true;
    keepButton.disabled = true;
    try {
      await applyCloudReplaceLocal(cloudEntries);
    } catch (error) {
      console.error(error);
      errorLine.textContent = "Replace failed. Try again.";
      errorLine.hidden = false;
      replaceButton.disabled = false;
      keepButton.disabled = false;
    }
  });
  keepButton.addEventListener("click", async () => {
    // Push now rather than "on the next save": the cloud actually catches up in
    // the safe case, and in a true conflict the (warned) overwrite happens at a
    // predictable moment instead of whenever the user next happens to save.
    // The overwrite is conditional on the generation just pulled: if the cloud
    // moves again in between, the push is refused and the card returns.
    const cloudGeneration = state.vaultPending?.pullGeneration;
    if (Number.isInteger(cloudGeneration)) await recordSyncedGeneration(cloudGeneration);
    state.vaultPending = null;
    exitVaultToNormal(); // renderVault lifts the hold and replays any deferred push
    scheduleCloudSync();
    composerHint.textContent = diff.kind === "local-ahead"
      ? "Kept — syncing to cloud."
      : "Kept local — overwriting the cloud copy.";
  });
}

async function applyCloudReplaceLocal(cloudEntries) {
  // Validate BEFORE wiping local: a payload the merge would reject (oversized,
  // malformed items) must abort here, not after the store is already cleared.
  if (!Array.isArray(cloudEntries) || cloudEntries.length > MAX_IMPORT_ENTRIES) {
    throw new Error("invalid-cloud-payload");
  }
  const valid = cloudEntries.filter((item) =>
    item && typeof item.id === "string" && typeof item.text === "string" &&
    typeof item.createdAt === "string" && item.text.length <= MAX_IMPORT_ENTRY_TEXT);
  if (valid.length === 0 && cloudEntries.length > 0) {
    throw new Error("invalid-cloud-payload");
  }
  // Readable beats unreadable: a block this browser can read and the cloud only
  // holds flagged survives the replace, and the flagged copy is not adopted.
  // Delete only the readable ids being replaced — never the whole store, so
  // local unreadable records (which the cloud may lack) survive too.
  const flaggedIds = new Set(valid.filter(isUnreadableRecord).map((item) => item.id));
  const survivors = state.entries.filter((entry) => flaggedIds.has(entry.id));
  const replacedIds = state.entries.filter((entry) => !flaggedIds.has(entry.id)).map((entry) => entry.id);
  const survivorIds = new Set(survivors.map((entry) => entry.id));
  const incoming = valid.filter((item) => !(isUnreadableRecord(item) && survivorIds.has(item.id)));
  const cloudGeneration = state.vaultPending?.pullGeneration;
  await deleteEntryRecords(replacedIds);
  state.entries = survivors.slice(); // a copy: the merge below pushes into state.entries
  await mergeImportedEntries(incoming); // re-encrypts via saveEntry; flagged items stay flagged
  await recordSyncedBase(cloudEntries); // the cloud holds exactly this set
  if (Number.isInteger(cloudGeneration)) await recordSyncedGeneration(cloudGeneration);
  if (survivors.length > 0) {
    scheduleCloudSync(); // send the readable copies the cloud only has flagged
  } else if (await syncIsConditional()) {
    // The saves above armed a push of exactly the set the cloud already holds. Against a Worker
    // that speaks generations that push would only move the generation, and every other device
    // in sync would then meet a 412 and a card over nothing. Drop it (an older Worker, where a
    // push is unconditional and the generation does not exist, keeps the re-push it always had).
    if (cloudSyncTimer !== null) {
      window.clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
    }
    cloudSyncDeferred = false;
  }
  const count = state.entries.length;
  state.vaultView = null;
  state.vaultPending = null;
  renderVault(); // lifts the push hold; the saves above then push the adopted set
  const replaced = isCentral() ? `This browser now has the cloud's ${pluralCount(count, "note")}.` : `This browser now matches the cloud (${pluralCount(count, "note")}).`;
  composerHint.textContent = survivors.length > 0
    ? `${replaced} ${pluralCount(survivors.length, "note")} that couldn't be opened here ${survivors.length === 1 ? "is" : "are"} kept and sent back now.`
    : replaced;
}

function showKeyMismatch() {
  state.vaultView = "key-mismatch";
  renderVault();
}

// Dedicated resolution card for the key-mismatch dead-end: the cloud blob was encrypted
// under a different master key than this device holds, so it can't be decrypted at all.
// Distinct from renderPullConflictCard (cloud decrypts but differs) — "Replace with
// cloud" is impossible here. The safe "keep this device" option is the default and the
// only visually primary button; the destructive cloud-overwrite is explicitly warned.
function renderKeyMismatchCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Key mismatch</p>
      <p class="vault-subtitle">This device's key can't decrypt the cloud copy — they were encrypted with different keys.</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="keep">Keep this device, leave cloud alone</button>
      <p class="wipe-warning">Replacing permanently overwrites the cloud copy under this device's key. Any other device encrypted with a different key won't be able to recover its data from the cloud — it keeps only its own local copy.</p>
      <button class="vault-button secondary" type="button" data-action="replace">Replace cloud with this device's data</button>
      <p class="vault-subtitle">If instead this device has the wrong key, re-pair it from the device that has your data (/mirror there, /port here).</p>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const keepButton = vaultOverlay.querySelector('[data-action="keep"]');
  const replaceButton = vaultOverlay.querySelector('[data-action="replace"]');

  keepButton.addEventListener("click", () => {
    // Safe default: change nothing on either side. The persistent failed sync status
    // ("cloud copy doesn't match this device's key") stays flagged — we don't clear it.
    exitVaultToNormal();
    composerHint.textContent = "Kept this device — cloud left untouched.";
  });

  replaceButton.addEventListener("click", async () => {
    keepButton.disabled = true;
    replaceButton.disabled = true;
    errorLine.hidden = true;
    // Overwrite the cloud blob with this device's data, re-encrypted under this
    // device's key. flushCloudSync drives the ambient indicator on every exit path.
    const result = await flushCloudSync();
    if (result.status === "ok") {
      exitVaultToNormal();
      composerHint.textContent = "Replaced cloud with this device's data.";
      return;
    }
    errorLine.textContent =
      result.status === "auth"
        ? "Couldn't replace cloud — auth rejected. Check /sync setup."
        : "Couldn't replace cloud. Try again.";
    errorLine.hidden = false;
    keepButton.disabled = false;
    replaceButton.disabled = false;
  });

  window.requestAnimationFrame(() => keepButton.focus());
}

function renderPortPasteCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Pair this browser</p>
      <p class="vault-subtitle">Paste the pairing data from /mirror on your other browser.</p>
      <p class="vault-error" hidden></p>
      <textarea class="vault-input vault-textarea" data-field="pairing" rows="4" placeholder='{"workerUrl":"…","authToken":"…","masterKey":"…"}' autocomplete="off" spellcheck="false"></textarea>
      <button class="vault-button" type="button" data-action="submit">Continue</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const pairingInput = vaultOverlay.querySelector('[data-field="pairing"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const cancelButton = vaultOverlay.querySelector('[data-action="cancel"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  const submit = () => {
    const raw = pairingInput.value.trim();
    if (!raw) {
      showError("Paste the pairing data first.");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      showError("That's not valid pairing data.");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      showError("That's not valid pairing data.");
      return;
    }
    const workerUrl = normalizeWorkerUrl(parsed.workerUrl);
    if (!workerUrl) {
      showError("Pairing data has an invalid Worker URL.");
      return;
    }
    if (typeof parsed.authToken !== "string" || !parsed.authToken.trim()) {
      showError("Pairing data is missing the auth token.");
      return;
    }
    if (typeof parsed.masterKey !== "string" || !parsed.masterKey) {
      showError("Pairing data is missing the master key.");
      return;
    }
    let keyBytes;
    try {
      keyBytes = base64ToBytes(parsed.masterKey);
    } catch {
      showError("Pairing data has a malformed master key.");
      return;
    }
    if (keyBytes.length !== 32) {
      showError("Pairing data has an invalid master key.");
      return;
    }
    showError("");
    state.vaultPending = {
      portPairing: { workerUrl, authToken: parsed.authToken.trim(), masterKey: parsed.masterKey },
    };
    state.vaultView = "port-passphrase";
    renderVault();
  };

  submitButton.addEventListener("click", submit);
  cancelButton.addEventListener("click", exitVaultToNormal);
  window.requestAnimationFrame(() => pairingInput.focus());
}

async function handlePortPassphraseSubmit(passphrase) {
  const pairing = state.vaultPending?.portPairing;
  if (!pairing) {
    throw new Error("missing-pairing");
  }

  const saltPass = randomBytes(16);
  const wrappingPass = await deriveWrappingKey(passphrase, saltPass, PBKDF2_ITERATIONS);

  // Import the raw master key bytes (extractable so wrapKey can wrap them), wrap under
  // the passphrase, then re-derive a non-extractable session key — same shape as
  // handleSetupSubmit. The verify blob lets the standard unlock path validate later.
  const rawBytes = base64ToBytes(pairing.masterKey);
  const importedMaster = await crypto.subtle.importKey(
    "raw",
    rawBytes,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
  const wrappedPass = await wrapMasterKey(importedMaster, wrappingPass);
  const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, importedMaster);
  const sessionKey = await unwrapMasterKey(wrappedPass, wrappingPass);
  rawBytes.fill(0); // zero the plaintext key bytes; importedMaster handle now goes unused

  await saveMetaBatch([
    [ENC_SALT_PASS_KEY, bytesToBase64(saltPass)],
    [ENC_WRAPPED_PASS_KEY, wrappedPass],
    [ENC_VERIFY_KEY, verify],
    [ENC_ITERATIONS_PASS_KEY, String(PBKDF2_ITERATIONS)],
    [SYNC_WORKER_URL_KEY, pairing.workerUrl],
    [SYNC_AUTH_TOKEN_KEY, pairing.authToken],
  ]);

  state.encryption.enabled = true;
  state.encryption.unlocked = true;
  state.encryption.masterKey = sessionKey;
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  updateLockButton();
  entryInput.focus();

  // Initial pull. If it fails the browser is still correctly paired — the next unlock
  // auto-pulls (decision #7). Never throw here: that would re-enable the setup card.
  composerHint.textContent = "Pairing…";
  try {
    const result = await fetchAndDecryptBlocks();
    setSyncStatus("ok"); // reachable + decrypted: the sync channel is healthy
    if (result.empty) {
      composerHint.textContent = "Paired — cloud is empty, nothing to load yet.";
    } else {
      await mergeImportedEntries(result.entries);
      if (result.generation !== null) void recordSyncedGeneration(result.generation); // the first push after pairing is conditional on what was just loaded
      composerHint.textContent = `Paired — ${state.entries.length} block${state.entries.length === 1 ? "" : "s"} loaded.`;
    }
  } catch (error) {
    console.warn("[txtshell] initial port pull failed", error);
    composerHint.textContent = "Couldn't get your notes from the cloud yet — will try again when you unlock.";
    setPullStatusFromError(error);
  }
  signalReady();
}

// ---------------------------------------------------------------------------
// Txtshell account (central sync). Vault mode "central": the vault key is the
// account's vault key (VK), unlocked with a passkey; the API is the app's own
// origin. The key enters the SAME slot as a passphrase vault's master key
// (state.encryption.masterKey) — nothing downstream knows the difference.
// Every write of vault meta goes through rekeyVault's one transaction (records
// when the key changes, meta only when it does not). The server never sees the
// PRF output, a KEK, VK, the recovery phrase or its entropy. Plan: txtshell-
// central/docs/phase-d-plan.md §3–§9.
// ---------------------------------------------------------------------------

const CENTRAL_REFUSAL = "Not used with a Txtshell account — see /account";
const CENTRAL_UNAVAILABLE = "Account features aren't loaded on this page";

function centralAvailable() {
  return typeof window.txCentral === "object" && window.txCentral !== null;
}

// The meta rows that describe a central vault (all public or sealed under a
// key only this device's authenticator can derive).
function centralMetaRows({ credentialId, hkdfSalt, prfWrap, rpId }) {
  return [
    [ENC_MODE_KEY, "central"],
    [CENTRAL_URL_KEY, window.location.origin],
    [CENTRAL_CREDENTIAL_ID_KEY, credentialId],
    [CENTRAL_HKDF_SALT_KEY, hkdfSalt],
    [CENTRAL_PRF_WRAP_KEY, prfWrap],
    [CENTRAL_RP_ID_KEY, rpId],
  ];
}

async function readCentralMeta() {
  const [credentialId, hkdfSalt, prfWrap, rpId, removed, readdCredentialId] = await Promise.all([
    getMeta(CENTRAL_CREDENTIAL_ID_KEY),
    getMeta(CENTRAL_HKDF_SALT_KEY),
    getMeta(CENTRAL_PRF_WRAP_KEY),
    getMeta(CENTRAL_RP_ID_KEY),
    getMeta(CENTRAL_REMOVED_KEY),
    getMeta(CENTRAL_READD_CREDENTIAL_KEY),
  ]);
  return { credentialId, hkdfSalt, prfWrap, rpId, removed: Boolean(removed), readdCredentialId: readdCredentialId || null };
}

// The vault is a Txtshell account's and is locked: the account cards (email → code → register →
// sign in → phrase) run as a re-add from the lock screen, and Cancel returns to it.
function centralLocked() {
  return isCentral() && state.encryption.enabled && !state.encryption.unlocked;
}

// The two flag rows (removed / re-add credential) are vault meta, so they go through the vault's
// one meta transaction like every other central row — never a bare saveMeta.
async function writeCentralFlags(metaPuts) {
  await rekeyVault({ entries: null, key: null, metaPuts });
}

// Told by the server that the cached credential is unknown (revoked): record it, so the lock
// screen refuses the cached wrap and offers the way back instead (plan §8). Only the cached
// credential counts — a different passkey the user picked from the sheet says nothing about
// this device.
async function centralToldRemoved(error, stored) {
  if (error?.code !== "unknown-credential") return false;
  if (!error.credentialId || !stored?.credentialId || error.credentialId !== stored.credentialId) return false;
  if (!state.central.removed) {
    await writeCentralFlags([[CENTRAL_REMOVED_KEY, new Date().toISOString()]]);
    state.central.removed = true;
  }
  if (state.encryption.unlocked) setSyncStatus("central-removed"); // the indicator opens the removed card
  return true;
}

// Statements about how signing in BEHAVES hold on every platform, so they never name one: only some
// sign-in methods need a connection (a Microsoft-synced Windows Hello passkey did, 2026-10-09; iCloud
// Keychain and device-bound passkeys open offline). Instructions ("Unlock with Touch ID") may name it.
const CENTRAL_OFFLINE_REFUSED = "Some sign-in methods need this device to be online. Your notes are safe here — connect and try again.";
const CENTRAL_OFFLINE_ADVISORY = "You're offline. Your notes are safe on this device. Some sign-in methods need a connection — if yours does, connect and try again.";

const CENTRAL_REMOVED_SENTENCE = "This device was removed from your account. To add it back, use your email and then your 12 words.";

function setCentralSession(login) {
  state.central.session = login.session;
  state.central.userId = login.userId;
  state.central.credentialId = login.credentialId;
  if (login.email) state.central.email = login.email;
}

function clearCentralSession() {
  state.central.session = null;
  state.central.userId = null;
  state.central.credentialId = null;
  state.central.email = null;
}

// Told by the server, on this device's own session, that the device was removed (401
// `device-removed` — only the session's holder gets that answer; login/verify still says
// unknown-credential). The session was this device's sign-in, so it speaks for the cached
// credential when the two match; if they don't (mid re-add), it is only an ended session. Same
// effect as being told at a sign-in: the row, VK kept until lock, nothing local touched (plan §8).
async function centralToldRemovedBySession() {
  const stored = await readCentralMeta().catch(() => null);
  const ownSession = !!stored?.credentialId && stored.credentialId === state.central.credentialId;
  state.central.session = null;
  if (!ownSession) { dropCentralSession("401"); return; }
  console.warn("[txtshell] account session ended", "device-removed");
  if (!state.central.removed) {
    await writeCentralFlags([[CENTRAL_REMOVED_KEY, new Date().toISOString()]]);
    state.central.removed = true;
  }
  setSyncStatus("central-removed"); // the indicator opens the removed card
  composerHint.textContent = CENTRAL_REMOVED_SENTENCE;
}

// A 401 from any account request: the session is gone (or, `device-removed`, this device was
// removed). Local state untouched.
document.addEventListener("txcentral:session-lost", (event) => {
  if (!isCentral() || !state.central.session) return;
  if (event.detail?.code === "device-removed") void centralToldRemovedBySession();
  else dropCentralSession("session-lost");
});

// ---------- the cards the ladder drives (flow in central.js, DOM here) ----------

// Shared pending-promise plumbing: a card resolves or rejects the ladder's
// question; Cancel rejects with "cancelled", which unwinds the whole flow.
let centralCardSettle = null;
// The old VK, captured by the re-add's "keep this device's notes" step BEFORE a new passkey is
// registered. Registering a passkey for the same account evicts the old credential from this
// authenticator (one resident credential per user handle), so the old key — which lives only in
// the cached wrap under the old credential's KEK — must be read before that, or it is gone for
// good (found 2026-10-11; plan §8). Memory only; dropped on unlock, cancel or lock.
let centralRescuedKey = null;
// An account backup waiting for a sign-in to finish (plan §17.1); the merge that follows the join.
let centralPendingImport = null;
let centralImportMerge = null;
function settleCentralCard(value, error) {
  const settle = centralCardSettle;
  centralCardSettle = null;
  if (!settle) return;
  if (error) settle.reject(error); else settle.resolve(value);
}
function cancelCentralCard() {
  settleCentralCard(undefined, new Error("cancelled"));
}

const centralUi = {
  // Forced-save (decision 2026-10-10): the 12 words at signup, after the passkey step. Download
  // (primary) or Copy (secondary); Continue stays disabled until one of them has actually run. No
  // spot check. `kind`: "signup" | "rotate" | "abandon" picks the heading; the body is the same.
  forcedSave(words, { kind = "signup" } = {}) {
    return new Promise((resolve, reject) => {
      centralCardSettle = { resolve, reject };
      state.vaultPending = { ...(state.vaultPending || {}), forcedSave: { words, kind } };
      state.vaultView = "central-forced-save";
      renderVault();
    });
  },
  askPhrase(errorText) {
    return new Promise((resolve, reject) => {
      centralCardSettle = { resolve, reject };
      state.vaultPending = { ...(state.vaultPending || {}), rung2Error: errorText || "" };
      state.vaultView = "central-rung2";
      renderVault();
    });
  },
};

function renderCentralBusyCard(label) {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      <p class="encrypting-status">${escapeHtml(label)}<span class="dot"> ...</span></p>
    </div>
  `;
}

const FORCED_SAVE_COPY = {
  body: "If you ever lose all your devices, these 12 words are the only way to get your notes back. We can't reset them — nobody can read your notes, including us.",
  keep: "Keep them somewhere safe — a password manager, or printed and put away. Don't keep them only on this device, and never share them.",
  uses: "You won't need these often. They're for setting up a new device, or getting your notes back if you lose every device.",
};

function forcedSaveHeading(kind) {
  if (kind === "rotate") return { title: "Your new 12 words", lead: "Your old 12 words no longer add a device." };
  if (kind === "abandon") return { title: "Your new 12 words", lead: "Your account was started over. The old words no longer open it." };
  return { title: "Your 12 words", lead: "" };
}

function renderCentralForcedSaveCard() {
  const pending = state.vaultPending?.forcedSave;
  if (!pending) {
    exitVaultToNormal();
    return;
  }
  const { words, kind } = pending;
  const { title, lead } = forcedSaveHeading(kind);
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">${escapeHtml(title)}</p>
      ${lead ? `<p class="vault-subtitle" data-field="lead">${escapeHtml(lead)}</p>` : ""}
      <p class="vault-subtitle" data-field="body">${escapeHtml(FORCED_SAVE_COPY.body)}</p>
      <ol class="phrase-words" data-field="words"></ol>
      <p class="vault-subtitle" data-field="keep">${escapeHtml(FORCED_SAVE_COPY.keep)}</p>
      <p class="vault-subtitle" data-field="uses">${escapeHtml(FORCED_SAVE_COPY.uses)}</p>
      <button class="vault-button" type="button" data-action="download">Download the words</button>
      <button class="vault-button secondary" type="button" data-action="copy">Copy</button>
      <p class="vault-subtitle" data-field="note"></p>
      <button class="vault-button" type="button" data-action="continue" disabled>Continue</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const list = vaultOverlay.querySelector('[data-field="words"]');
  words.forEach((word, index) => {
    const li = document.createElement("li");
    li.dataset.word = word;
    li.textContent = `${index + 1}. ${word}`;
    list.appendChild(li);
  });
  const note = vaultOverlay.querySelector('[data-field="note"]');
  const continueButton = vaultOverlay.querySelector('[data-action="continue"]');
  // Continue opens only once the words have actually left the screen by one of the two routes: the
  // download was issued, or the clipboard write resolved. A failed copy does not count.
  const markSaved = (message) => {
    note.textContent = message;
    continueButton.disabled = false;
  };
  vaultOverlay.querySelector('[data-action="download"]').addEventListener("click", () => {
    try {
      const blob = new Blob([`Txtshell 12 words — you need these to set up a new device or get your notes back. Keep them somewhere safe, not only on this device:\n\n${words.join(" ")}\n`], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "txtshell-recovery-words.txt";
      link.click();
      URL.revokeObjectURL(link.href);
      markSaved("Downloaded. Move it somewhere safe — your Downloads folder may sync to iCloud Drive or OneDrive.");
    } catch {
      note.textContent = "Couldn't download here — use Copy instead.";
    }
  });
  vaultOverlay.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(words.join(" "));
      markSaved("Copied. Paste them into a new secure note in your password manager.");
    } catch {
      note.textContent = "Couldn't copy here — use Download instead.";
    }
  });
  continueButton.addEventListener("click", () => {
    if (continueButton.disabled) return;
    state.vaultView = "central-busy";
    state.vaultPending = { ...(state.vaultPending || {}), forcedSave: null, busy: "Setting up" };
    renderVault();
    settleCentralCard(undefined);
  });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", cancelCentralCard);
}

// ---------- phrase entry (batch item 3): twelve inputs on a cold device ----------
// Twelve boxes, one word each. Pasting several words into ANY box spreads them: a full phrase fills
// all twelve from box 1, a fragment fills onward from that box. A BIP-39 word is fixed by its first
// letters, so a prefix that matches exactly one word completes on space, Tab, Enter or leaving the
// box (a full word that is also a prefix of others — "act" — is left as typed). Narrow screens get
// the single textarea instead. Both shapes feed the same checksum (toEntropy) before any network.
const PHRASE_NARROW_QUERY = "(max-width: 480px)";

function phraseEntryHtml() {
  if (window.matchMedia && window.matchMedia(PHRASE_NARROW_QUERY).matches) {
    return `<textarea class="vault-input phrase-input" data-field="phrase" rows="3" placeholder="twelve words separated by spaces" autocomplete="off" autocapitalize="none" spellcheck="false"></textarea>`;
  }
  const cells = Array.from({ length: 12 }, (_, i) => `<label class="phrase-cell"><span aria-hidden="true">${i + 1}</span><input type="text" data-position="${i + 1}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Word ${i + 1}" /></label>`).join("");
  return `<div class="phrase-cells" data-field="phrase-cells">${cells}</div><p class="phrase-hint" data-field="phrase-hint" aria-live="polite"></p>`;
}

// Wires whichever shape phraseEntryHtml() rendered. onChange: any edit; onSubmit: Enter when the
// phrase is complete. Returns { getText, markInvalid, focus }.
function bindPhraseEntry({ onChange = () => {}, onSubmit = () => {} } = {}) {
  const textarea = vaultOverlay.querySelector('[data-field="phrase"]');
  if (textarea) {
    textarea.addEventListener("input", onChange);
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); }
    });
    return { getText: () => textarea.value, markInvalid: () => {}, focus: () => textarea.focus() };
  }
  const WORDS = window.BIP39_ENGLISH || [];
  const WORDSET = new Set(WORDS);
  const cells = [...vaultOverlay.querySelectorAll('[data-field="phrase-cells"] input')];
  const hint = vaultOverlay.querySelector('[data-field="phrase-hint"]');
  const norm = (v) => window.txCentral.phrase.normalizeWord(v || "");
  const matchesOf = (prefix) => (prefix ? WORDS.filter((w) => w.startsWith(prefix)) : []);
  const uniqueCompletion = (value) => {
    const v = norm(value);
    if (!v || WORDSET.has(v)) return null;
    const m = matchesOf(v);
    return m.length === 1 ? m[0] : null;
  };
  const setInvalid = (cell, invalid) => cell.closest(".phrase-cell").classList.toggle("is-invalid", invalid);
  const refresh = (cell) => {
    const v = norm(cell.value);
    const m = matchesOf(v);
    setInvalid(cell, Boolean(v) && m.length === 0);
    if (!hint) return;
    if (!v || WORDSET.has(v)) hint.textContent = "";
    else if (m.length === 0) hint.textContent = `“${v}” isn't a recovery word`;
    else if (m.length === 1) hint.textContent = `${v} → ${m[0]} (space or Tab)`;
    else hint.textContent = m.length <= 4 ? m.join(" · ") : "";
  };
  const complete = (cell) => {
    const full = uniqueCompletion(cell.value);
    if (full) cell.value = full;
    refresh(cell);
    return Boolean(full);
  };
  const next = (index) => cells[Math.min(index + 1, cells.length - 1)];
  const spread = (startIndex, words) => {
    const start = words.length >= cells.length ? 0 : startIndex;
    words.slice(0, cells.length - start).forEach((w, i) => { cells[start + i].value = norm(w); refresh(cells[start + i]); });
    const firstEmpty = cells.find((c) => !c.value);
    (firstEmpty || cells[Math.min(start + words.length, cells.length) - 1]).focus();
    onChange();
  };
  cells.forEach((cell, index) => {
    cell.addEventListener("input", () => {
      // Typing (or an IME, or autofill) put spaces into one box: spread the words onward.
      const words = window.txCentral.phrase.splitWords(cell.value);
      if (/\s/.test(cell.value) && words.length > 1) { spread(index, words); return; }
      if (/\s$/.test(cell.value)) { cell.value = norm(cell.value); complete(cell); next(index).focus(); onChange(); return; }
      refresh(cell);
      onChange();
    });
    cell.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";
      const words = window.txCentral.phrase.splitWords(text);
      if (words.length <= 1) return; // one word: the browser pastes it as usual
      event.preventDefault();
      spread(index, words);
    });
    cell.addEventListener("keydown", (event) => {
      if (event.key === " ") {
        event.preventDefault();
        complete(cell);
        if (cell.value) next(index).focus();
        onChange();
      } else if (event.key === "Tab" && !event.shiftKey) {
        complete(cell); // the browser moves focus
        onChange();
      } else if (event.key === "Enter") {
        event.preventDefault();
        complete(cell);
        onChange();
        const firstEmpty = cells.find((c) => !c.value);
        if (firstEmpty) firstEmpty.focus(); else onSubmit();
      } else if (event.key === "Backspace" && !cell.value && index > 0) {
        event.preventDefault();
        cells[index - 1].focus();
      }
    });
    cell.addEventListener("blur", () => { if (complete(cell)) onChange(); });
  });
  return {
    getText: () => cells.map((c) => norm(c.value)).join(" "),
    markInvalid: (position) => { const cell = cells[position - 1]; if (cell) { setInvalid(cell, true); cell.focus(); } },
    focus: () => (cells.find((c) => !c.value) || cells[0]).focus(),
  };
}

function renderCentralRung2Card() {
  const errorText = state.vaultPending?.rung2Error || "";
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Enter your 12 words</p>
      <p class="vault-subtitle">${escapeHtml(platformOr((n) => `This device is new to your account. Your 12 words set it up once; after that, ${n} is enough.`, "This device is new to your account. Your 12 words set it up once; after that, signing in is enough."))}</p>
      <p class="vault-error" ${errorText ? "" : "hidden"}>${escapeHtml(errorText)}</p>
      ${phraseEntryHtml()}
      <button class="vault-button" type="button" data-action="submit">Continue</button>
      <button class="vault-link" type="button" data-action="fork">Don't have your 12 words?</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  let entry = null;
  const submit = async () => {
    try {
      const parsed = await window.txCentral.phrase.toEntropy(entry.getText()); // checksum: most typos die here, no network
      state.vaultView = "central-busy";
      state.vaultPending = { ...(state.vaultPending || {}), busy: "Checking your 12 words" };
      renderVault();
      settleCentralCard({ kind: "phrase", entropy: parsed.entropy });
    } catch (error) {
      if (error?.position) entry.markInvalid(error.position);
      errorLine.textContent = error.message;
      errorLine.hidden = false;
    }
  };
  entry = bindPhraseEntry({ onChange: () => { errorLine.hidden = true; }, onSubmit: submit });
  vaultOverlay.querySelector('[data-action="submit"]').addEventListener("click", submit);
  vaultOverlay.querySelector('[data-action="fork"]').addEventListener("click", () => {
    state.vaultView = "central-abandon";
    renderVault();
  });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", cancelCentralCard);
  window.requestAnimationFrame(() => entry.focus());
}

// The fork on the rung-2 screen: start the account's vault over. Typed email
// confirms it; other devices' copies become unreadable until they re-join.
function renderCentralAbandonCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Start your account over?</p>
      <p class="wipe-warning">Without your 12 words, nobody can open the notes saved in your account — not even us. Starting over clears your account and gives you new 12 words. Notes already on your devices stay there, and each device joins again with the new words. Type your account's email to confirm.</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="email" type="email" placeholder="you@example.com" autocomplete="off" spellcheck="false" />
      <button class="vault-button danger" type="button" data-action="submit">Start over</button>
      <button class="vault-link" type="button" data-action="back">Back</button>
    </div>
  `;
  const input = vaultOverlay.querySelector('[data-field="email"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  submitButton.addEventListener("click", async () => {
    submitButton.disabled = true;
    try {
      await window.txCentral.ladder.abandon(state.central.session, input.value.trim());
      await clearSyncState();
      state.vaultView = "central-busy";
      state.vaultPending = { ...(state.vaultPending || {}), busy: "Starting over" };
      renderVault();
      settleCentralCard({ kind: "abandoned" });
    } catch (error) {
      errorLine.textContent = error.code === "confirm-mismatch" ? "That doesn't match this account's email." : "Couldn't start over. Try again.";
      errorLine.hidden = false;
      submitButton.disabled = false;
    }
  });
  vaultOverlay.querySelector('[data-action="back"]').addEventListener("click", () => {
    state.vaultView = "central-rung2";
    renderVault();
  });
  window.requestAnimationFrame(() => input.focus());
}

// ---------- sign in / sign up ----------

function renderCentralStartCard() {
  // Locked account vault: the same cards run as a re-add (plan §8). Email first — the passkey
  // this device has is revoked, missing or failing, which is why the user is here.
  if (centralLocked()) {
    renderCentralReaddStartCard();
    return;
  }
  // No account here: two paths (2026-10-25-sync-door.md §2). Sign in — this device's sign-in, or
  // the email for a device without it; Get cloud sync — a new account (or the waitlist).
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Txtshell sync</p>
      <p class="vault-error" hidden></p>
      <p class="vault-subtitle" data-field="returning">Already have an account?</p>
      <button class="vault-button secondary" type="button" data-action="signin">${escapeHtml(passkeyPlatformName() ? `Sign in with ${passkeyPlatformName()}` : "Sign in")}</button>
      <button class="vault-link" type="button" data-action="email-signin">Use your email instead</button>
      <hr class="vault-divider" />
      <p class="vault-subtitle" data-field="new">New to Txtshell sync?</p>
      <button class="vault-button" type="button" data-action="new">Get cloud sync</button>
      <p class="vault-fine" data-field="fine">Your notes stay encrypted. We can't read them.</p>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const signinButton = vaultOverlay.querySelector('[data-action="signin"]');
  signinButton.addEventListener("click", async () => {
    vaultOverlay.querySelectorAll('[data-action="signin"], [data-action="email-signin"], [data-action="new"]').forEach((button) => { button.disabled = true; });
    try {
      await centralJoin({ via: "signin" });
    } catch (error) {
      if (error?.name === "NotAllowedError" && !/focus/i.test(error?.message || "")) {
        // Nothing on this device to sign in with (the sheet offered a phone or a key and nothing
        // came, or it was closed): point to the email path, which serves a new device too.
        console.warn("[txtshell] sign-in refused", error?.name || "", error);
        state.vaultView = "central-start";
        renderVault();
        const line = vaultOverlay.querySelector(".vault-error");
        line.textContent = "No sign-in found on this device. Use your email instead.";
        line.hidden = false;
        vaultOverlay.querySelector('[data-action="email-signin"]').focus();
        return;
      }
      centralFlowFailed(error, "central-start");
    }
  });
  vaultOverlay.querySelector('[data-action="email-signin"]').addEventListener("click", () => {
    state.vaultPending = null;
    state.vaultView = "central-email-signin";
    renderVault();
  });
  vaultOverlay.querySelector('[data-action="new"]').addEventListener("click", () => beginGetCloudSync());
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", exitVaultToNormal);
}

// The re-add's email card (a locked account vault), unchanged by the two-path card.
function renderCentralReaddStartCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">${state.central.removed ? "Add this device again" : "Use your 12 words"}</p>
      <p class="vault-subtitle">${escapeHtml(platformOr((n) => `Enter your email for a code. Then set up ${n} again, and your 12 words add this device — once. Your notes stay on this device.`, "Enter your email for a code. Then set up this device again, and your 12 words add it — once. Your notes stay on this device."))}</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="email" type="email" placeholder="you@example.com" autocomplete="email" spellcheck="false" />
      <button class="vault-button" type="button" data-action="email">Send a code</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  bindCentralEmailCard({ onClosed: (showError) => showError("No account uses that email.") });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", exitVaultToNormal);
}

// Get cloud sync, the one place a new account starts: the button opens the email card, and
// startGetCloudSync maps the server's answer to the next card — the code, or the waitlist. After
// payments, checkout is one more branch there (and one in the server's newAccountPath).
function beginGetCloudSync(email = "") {
  state.vaultPending = email ? { email } : null;
  state.vaultView = "central-email-new";
  renderVault();
}

async function startGetCloudSync(email) {
  try {
    return { next: "code", result: await window.txCentral.webauthn.signup(email) };
  } catch (error) {
    if (error.code === "signups-closed") return { next: "waitlist" };
    throw error;
  }
}

// The two email cards: "Sign in with your email" (a device without its sign-in) and "Get cloud
// sync". Both ask the same route for a code; they differ only in what a refused address gets.
function renderCentralEmailCard(kind) {
  const signin = kind === "signin";
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">${signin ? "Sign in with your email" : "Get cloud sync"}</p>
      <p class="vault-subtitle">${signin ? "We'll send you a code to add this browser to your account." : "Enter your email. We'll send a code to set it up on this browser."}</p>
      <p class="vault-error" hidden></p>
      ${signin ? `<button class="vault-link lead" type="button" data-action="to-new" hidden>Get cloud sync</button>` : ""}
      <input class="vault-input" data-field="email" type="email" placeholder="you@example.com" autocomplete="email" spellcheck="false" />
      <button class="vault-button" type="button" data-action="email">${signin ? "Send a code" : "Continue"}</button>
      <button class="vault-link" type="button" data-action="back">Back</button>
    </div>
  `;
  const emailInput = vaultOverlay.querySelector('[data-field="email"]');
  emailInput.value = state.vaultPending?.email || "";
  const toNew = vaultOverlay.querySelector('[data-action="to-new"]');
  if (toNew) toNew.addEventListener("click", () => beginGetCloudSync(emailInput.value.trim()));
  bindCentralEmailCard({
    getCloudSync: !signin,
    onClosed: (showError, email) => {
      if (signin) {
        showError("No account uses that email.");
        toNew.hidden = false;
        return;
      }
      state.vaultPending = { email };
      state.vaultView = "central-waitlist";
      renderVault();
    },
  });
  vaultOverlay.querySelector('[data-action="back"]').addEventListener("click", () => {
    state.vaultPending = null;
    state.vaultView = "central-start";
    renderVault();
  });
  window.requestAnimationFrame(() => emailInput.focus());
}

// The email field, its button and its errors, shared by the email cards and the re-add card.
// `onClosed(showError, email)`: what an address that may not sign up gets (403 signups-closed).
function bindCentralEmailCard({ getCloudSync = false, onClosed }) {
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const showError = (message) => { errorLine.textContent = message; errorLine.hidden = !message; };
  const emailButton = vaultOverlay.querySelector('[data-action="email"]');
  const emailInput = vaultOverlay.querySelector('[data-field="email"]');
  const toCode = (email, result) => {
    state.vaultPending = { email, echoCode: typeof result.code === "string" ? result.code : "" };
    state.vaultView = "central-code";
    renderVault();
  };
  const sendCode = async () => {
    const email = emailInput.value.trim();
    if (!email) { showError("Enter your email."); return; }
    showError("");
    emailButton.disabled = true;
    try {
      if (getCloudSync) {
        const { next, result } = await startGetCloudSync(email);
        if (next === "code") toCode(email, result);
        else { emailButton.disabled = false; onClosed(showError, email); }
        return;
      }
      toCode(email, await window.txCentral.webauthn.signup(email));
    } catch (error) {
      if (error.code === "signups-closed") { emailButton.disabled = false; onClosed(showError, email); return; }
      console.error(error);
      showError(error.code === "invalid-email" ? "That doesn't look like an email address."
        : error.code === "code-send-failed" ? "We couldn't send the code. Try again in a minute."
        : error?.status === 429 ? centralFailureMessage(error)
        : (error?.name === "TypeError" || error?.status === 0 ? "Can't reach Txtshell right now. Check your connection and try again." : "Couldn't send a code. Try again."));
      emailButton.disabled = false;
    }
  };
  emailButton.addEventListener("click", sendCode);
  emailInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); sendCode(); } });
}

// While signups are allowlist-only, an address that may not sign up can wait (schema-h.sql). The
// address is stored only on this tap; nothing is emailed.
function renderCentralWaitlistCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Cloud sync is in private beta.</p>
      <p class="vault-subtitle">Leave your email and we'll invite you.</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="email" type="email" placeholder="you@example.com" autocomplete="email" spellcheck="false" />
      <button class="vault-button" type="button" data-action="join">Join the waitlist</button>
      <p class="vault-fine">We'll only use it to invite you.</p>
      <button class="vault-link" type="button" data-action="back">Back</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const showError = (message) => { errorLine.textContent = message; errorLine.hidden = !message; };
  const input = vaultOverlay.querySelector('[data-field="email"]');
  input.value = state.vaultPending?.email || "";
  const button = vaultOverlay.querySelector('[data-action="join"]');
  const join = async () => {
    const email = input.value.trim();
    if (!email) { showError("Enter your email."); return; }
    showError("");
    button.disabled = true;
    try {
      await window.txCentral.waitlist.join(email);
      state.vaultPending = { email };
      state.vaultView = "central-waitlist-joined";
      renderVault();
    } catch (error) {
      if (error.code === "signups-open") {
        // Sign-ups opened since this card did: the address gets its code instead.
        beginGetCloudSync(email);
        vaultOverlay.querySelector('[data-action="email"]').click();
        return;
      }
      console.error(error);
      showError(error.code === "invalid-email" ? "That doesn't look like an email address."
        : error.code === "waitlist-full" ? "The waitlist is full for now. Try again later."
        : error?.status === 429 ? centralFailureMessage(error)
        : (error?.name === "TypeError" || error?.status === 0 ? "Can't reach Txtshell right now. Check your connection and try again." : "Couldn't add you. Try again."));
      button.disabled = false;
    }
  };
  button.addEventListener("click", join);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); join(); } });
  vaultOverlay.querySelector('[data-action="back"]').addEventListener("click", () => beginGetCloudSync(input.value.trim()));
  window.requestAnimationFrame(() => button.focus());
}

function renderCentralWaitlistJoinedCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">You're on the list.</p>
      <p class="vault-subtitle">We'll email ${escapeHtml(state.vaultPending?.email || "you")} when there's room. Your notes stay on this device and work as they do now.</p>
      <button class="vault-button" type="button" data-action="done">Done</button>
    </div>
  `;
  const button = vaultOverlay.querySelector('[data-action="done"]');
  button.addEventListener("click", exitVaultToNormal);
  window.requestAnimationFrame(() => button.focus());
}

// The name a person knows this device's passkey by, for the setup copy. Best effort from the user
// agent: iPhone → Face ID, a Mac → Touch ID, Windows → Windows Hello; anything else (Android, Linux,
// an iPad, which may have either) gets the plain word. Some Macs have no Touch ID and a person may
// still pick a phone or a security key in the sheet — the copy names what is likely, the ceremony
// shows what is real. `env` is injectable for the gate.
function passkeyPlatformName(env = { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints || 0 }) {
  const ua = env.userAgent || "";
  if (/iPhone|iPod/.test(ua)) return "Face ID";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && (env.maxTouchPoints || 0) > 1)) return null; // iPadOS reports a Mac user agent
  if (/Macintosh|Mac OS X/.test(ua)) return "Touch ID";
  if (/Windows/.test(ua)) return "Windows Hello";
  return null;
}

function renderCentralCodeCard() {
  const pending = state.vaultPending || {};
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Check your email</p>
      <p class="vault-subtitle">Enter the 6-digit code sent to ${escapeHtml(pending.email || "")}. Then you'll set up ${escapeHtml(passkeyPlatformName() || "sign-in")} for this browser.</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="code" type="text" inputmode="numeric" placeholder="6-digit code" autocomplete="one-time-code" spellcheck="false" />
      <button class="vault-button" type="button" data-action="submit">${escapeHtml(passkeyPlatformName() ? `Set up ${passkeyPlatformName()}` : "Set up sign-in")}</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const input = vaultOverlay.querySelector('[data-field="code"]');
  if (pending.echoCode) input.value = pending.echoCode; // dev deployments echo the code; production never does
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const submit = async () => {
    const code = input.value.trim();
    if (!/^\d{6}$/.test(code)) { errorLine.textContent = "Enter the 6-digit code."; errorLine.hidden = false; return; }
    submitButton.disabled = true;
    try {
      const { signupToken } = await window.txCentral.webauthn.verifyEmail(pending.email, code);
      state.vaultView = "central-busy";
      state.vaultPending = { ...pending, busy: `Setting up ${passkeyPlatformName() || "sign-in"}` };
      renderVault();
      const registered = await window.txCentral.webauthn.register(signupToken);
      if (centralLocked()) {
        // A re-add from the lock screen: the server now holds a credential this device must sign in
        // with, whatever happens between here and the settled key (a crash included).
        await writeCentralFlags([[CENTRAL_READD_CREDENTIAL_KEY, registered.credentialId]]);
        state.central.readdCredentialId = registered.credentialId;
      }
      // The sign-in is its own ceremony behind its own tap: Safari spends the user activation on
      // the registration, and every browser refuses a ceremony while the sheet's focus settles.
      state.vaultPending = { ...pending, registered };
      state.vaultView = "central-registered";
      renderVault();
    } catch (error) {
      if (error?.name === "InvalidStateError") {
        // The authenticator already holds a passkey for this account (the server's
        // excludeCredentials did its job): sign in with it instead of failing.
        state.vaultPending = { ...pending };
        state.vaultView = "central-has-passkey";
        renderVault();
        return;
      }
      if (error.code === "code-invalid" || error.code === "code-locked" || error.status === 400) {
        state.vaultView = "central-code";
        renderVault();
        const line = vaultOverlay.querySelector(".vault-error");
        line.textContent = error.code === "code-locked" ? "Too many attempts — request a new code." : "That code didn't work.";
        line.hidden = false;
        return;
      }
      centralFlowFailed(error, "central-code");
    }
  };
  submitButton.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", exitVaultToNormal);
  window.requestAnimationFrame(() => input.focus());
}

function renderCentralRegisteredCard() {
  const registered = state.vaultPending?.registered;
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">${escapeHtml(passkeyPlatformName() ? `${passkeyPlatformName()} is set up.` : "Sign-in is set up.")}</p>
      <p class="vault-subtitle">Tap to continue.</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="signin">Continue</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const button = vaultOverlay.querySelector('[data-action="signin"]');
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (centralLocked()) await centralReadd({ via: "register", registered });
      else await centralJoin({ via: "register", registered });
    } catch (error) {
      centralFlowFailed(error, "central-registered");
    }
  });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", exitVaultToNormal);
}

function renderCentralHasPasskeyCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">This device is already set up for your account</p>
      <p class="vault-subtitle">Sign in with it — nothing else to set up.</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="signin">${escapeHtml(platformOr((n) => `Sign in with ${n}`, "Sign in"))}</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const button = vaultOverlay.querySelector('[data-action="signin"]');
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (centralLocked()) await centralReadd({ via: "signin" });
      else await centralJoin({ via: "signin" });
    } catch (error) {
      centralFlowFailed(error, "central-has-passkey");
    }
  });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", exitVaultToNormal);
}

// One sentence for a person, per failure; the technical name goes to the console.
function centralFailureMessage(error) {
  if (error?.code === "unknown-credential") return CENTRAL_REMOVED_SENTENCE;
  if (error?.code === "no-prf") return "That sign-in can't lock your notes in this browser. Try an up-to-date Safari, Chrome or Edge, or another way to sign in.";
  if (error?.status === 429 || error?.code === "rate-limited") return "Too many tries — wait a minute and try again.";
  switch (error?.name) {
    case "InvalidStateError": return "This device is already set up for your account. Sign in instead.";
    case "NotAllowedError": return "Signing in didn't finish — the prompt was closed, or the page lost focus. Click the page, then try again.";
    case "AbortError": return "Signing in was interrupted. Try again.";
    case "SecurityError": return "Something's off with this page's address — try opening txtshell.com directly.";
    case "NotSupportedError": return "This browser can't sign in here. Try an up-to-date Safari, Chrome or Edge.";
    case "TypeError": return "Can't reach Txtshell right now. Check your connection and try again.";
    default: break;
  }
  if (error?.status === 0) return "Can't reach Txtshell right now. Check your connection and try again.";
  return "Something went wrong. Try again.";
}

// Any failure inside a flow lands back on a card with a message, or (on
// cancel) back in the normal view. Nothing local has changed unless the one
// rekeyVault transaction completed, and then the state was updated with it.
function centralFlowFailed(error, view) {
  if (error?.message === "cancelled") {
    exitVaultToNormal();
    return;
  }
  console.error("[txtshell] account flow failed", error?.name || "", error?.code || "", error);
  const message = centralFailureMessage(error);
  if (view) {
    state.vaultView = view;
    renderVault();
    const line = vaultOverlay.querySelector(".vault-error");
    if (line) { line.textContent = message; line.hidden = false; }
    vaultOverlay.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  } else {
    exitVaultToNormal();
  }
  composerHint.textContent = message;
}

// ---------- joining: the four starting states (plan §6) ----------

// Sign in (passkey ceremony → session → KEK_prf), then bring this browser's
// vault into the account:
//   account has no vault + passphrase vault here  → ADOPT: VK := this vault's key, no re-key (§6.1)
//   account has no vault + plaintext/fresh here   → new VK, every record under it in one transaction
//   account has a vault  + same key here          → meta swap only (an import of a central export)
//   account has a vault  + different key here     → re-key card → one transaction → first-join card on the next pull (§6.2)
async function centralJoin({ via, registered } = {}) {
  state.vaultView = "central-busy";
  state.vaultPending = { ...(state.vaultPending || {}), busy: "Signing in" };
  renderVault();
  const login = await window.txCentral.webauthn.login();
  setCentralSession(login);
  const kekWrap = await window.txCentral.keys.kekFromPrf(login.prf, login.hkdfSalt);
  login.prf.fill(0);
  const rpId = login.rpId || registered?.rpId || "";
  const identity = { credentialId: login.credentialId, hkdfSalt: login.hkdfSalt, rpId };
  const hadVault = state.encryption.enabled; // a passphrase vault, unlocked (commands run unlocked)

  if (!login.hasRecovery && hadVault) {
    // ADOPT. The passphrase gives an extractable handle of the master key so it can be wrapped.
    const extractable = await centralAskPassphrase({
      title: "Move this browser's notes to your account",
      subtitle: platformOr((n) => `Enter this browser's passphrase to move its notes into your account. After this, ${n} opens them instead.`, "Enter this browser's passphrase to move its notes into your account. After this, signing in opens them instead."),
      buttonText: "Continue",
    }, { extractable: true });
    state.vaultView = "central-busy";
    state.vaultPending = { ...(state.vaultPending || {}), busy: "Setting up your account" };
    renderVault();
    const out = await window.txCentral.ladder.bootstrap({ session: login.session, kekWrap, vk: extractable }, centralUi);
    if (out) {
      await rekeyVault({
        entries: null, // same key: no record is rewritten (enc-verify already valid)
        key: null,
        metaPuts: centralMetaRows({ ...identity, prfWrap: out.prfWrap }),
        metaDeletes: [...CENTRAL_PASSPHRASE_ROWS, SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY],
      });
      state.encryption.mode = "central";
      state.encryption.masterKey = out.vk;
      state.central.firstJoin = false;
      finishCentralJoin(platformOr((n) => `Your notes are now in your account — ${n} unlocks them from now on.`, "Your notes are now in your account — signing in unlocks them from now on."));
      return;
    }
    // Raced: another device bootstrapped first. Fall through with the account's vault.
    login.hasRecovery = true;
  }

  if (!login.hasRecovery) {
    // Plaintext or fresh install: a new VK, every record under it, one transaction.
    const out = await window.txCentral.ladder.bootstrap({ session: login.session, kekWrap }, centralUi);
    if (out) {
      const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, out.vk);
      await rekeyVault({
        entries: state.entries,
        key: out.vk,
        metaPuts: [...centralMetaRows({ ...identity, prfWrap: out.prfWrap }), [ENC_VERIFY_KEY, verify]],
        metaDeletes: [DRAFT_KEY, DRAFT_STASH_KEY, SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY],
      });
      state.encryption.enabled = true;
      state.encryption.unlocked = true;
      state.encryption.mode = "central";
      state.encryption.masterKey = out.vk;
      state.central.firstJoin = false;
      finishCentralJoin(state.entries.length > 0 ? "Account set up — your notes will sync from now on." : "Account set up.");
      return;
    }
    login.hasRecovery = true;
  }

  // The account has a vault: rung 1 (this passkey has a wrap) or rung 2 (phrase).
  const out = await window.txCentral.ladder.run({ session: login.session, kekWrap, hasPrfWrap: login.hasPrfWrap, hasRecovery: true }, centralUi);
  if (out.abandoned) await clearSyncState();
  if (hadVault && await verifyMasterKey(out.vk)) {
    // Same key already (e.g. this install was set up from a central export): swap the mode rows only.
    await rekeyVault({
      entries: null,
      key: null,
      metaPuts: centralMetaRows({ ...identity, prfWrap: out.prfWrap }),
      metaDeletes: [...CENTRAL_PASSPHRASE_ROWS, SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY],
    });
    state.encryption.mode = "central";
    state.encryption.masterKey = out.vk;
    state.central.firstJoin = false;
    finishCentralJoin("Signed in. This browser now syncs with your account.");
    return;
  }
  if (hadVault) {
    // Different key: confirm with the passphrase before this browser's blocks move under VK.
    await centralAskPassphrase({
      title: "Bring this browser's notes into your account",
      subtitle: `This browser has ${pluralCount(state.entries.length, "note")} locked with its own passphrase. Enter it to bring them into your account. Nothing is uploaded until you choose on the next screen.`,
      buttonText: "Bring my notes",
    });
    state.vaultView = "central-busy";
    state.vaultPending = { ...(state.vaultPending || {}), busy: "Bringing your notes in" };
    renderVault();
  }
  const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, out.vk);
  await rekeyVault({
    entries: state.entries,
    key: out.vk,
    metaPuts: [...centralMetaRows({ ...identity, prfWrap: out.prfWrap }), [ENC_VERIFY_KEY, verify]],
    metaDeletes: [...CENTRAL_PASSPHRASE_ROWS, DRAFT_KEY, DRAFT_STASH_KEY, SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY],
  });
  state.encryption.enabled = true;
  state.encryption.unlocked = true;
  state.encryption.mode = "central";
  state.encryption.masterKey = out.vk;
  state.central.firstJoin = true; // the next pull meets the cloud on the first-join card
  finishCentralJoin(state.entries.length > 0 ? "Signed in — getting notes from your other devices…" : "Signed in. This browser now syncs with your account.");
  void (centralImportMerge || Promise.resolve()).then(() => beginPull({ quiet: true }));
}

function finishCentralJoin(hint) {
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  updateLockButton();
  composerHint.textContent = hint;
  render();
  entryInput.focus();
  signalReady();
  // Nothing to upload from an empty install: pushing an empty blob would only move the account's
  // generation (and race the first real push from another device).
  if (state.entries.length > 0 || state.unreadable.length > 0) scheduleCloudSync();
  centralImportMerge = centralPendingImport ? finishPendingImport() : null;
  void refreshSyncDoor();
}

// Asks for this browser's passphrase on a confirm card and verifies it against
// the stored wrap. Resolves with the master key handle (extractable on request).
function centralAskPassphrase({ title, subtitle, buttonText }, { extractable = false } = {}) {
  return new Promise((resolve, reject) => {
    state.vaultView = "central-passphrase";
    state.vaultPending = {
      ...(state.vaultPending || {}),
      passphraseCard: {
        title, subtitle, buttonText,
        onSubmit: async (passphrase) => {
          const saltBase64 = await getMeta(ENC_SALT_PASS_KEY);
          const wrappedBase64 = await getMeta(ENC_WRAPPED_PASS_KEY);
          if (!saltBase64 || !wrappedBase64) throw new Error("missing-meta");
          const iterations = await readIterations(ENC_ITERATIONS_PASS_KEY);
          const wrappingKey = await deriveWrappingKey(passphrase, base64ToBytes(saltBase64), iterations);
          let masterKey;
          try {
            masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey, extractable);
          } catch {
            throw new Error("wrong-key");
          }
          resolve(masterKey);
        },
        onCancel: () => reject(new Error("cancelled")),
      },
    };
    renderVault();
  });
}

function renderCentralPassphraseCard() {
  const card = state.vaultPending?.passphraseCard;
  if (!card) {
    exitVaultToNormal();
    return;
  }
  renderPassphraseConfirmCard({
    title: card.title,
    subtitle: card.subtitle,
    buttonText: card.buttonText,
    onSubmit: card.onSubmit,
    onCancel: card.onCancel,
  });
}

// ---------- unlock (central mode, vault locked) ----------

// Three shapes of one card (plan §8, decision 2026-10-09; scope 2026-10-11):
//   · locked         — Unlock with passkey; "Can't use your passkey? Use your 12 words instead" as
//                      a link; Wipe quiet at the bottom
//   · failed twice   — the 12-words path is promoted to a button under the unlock button
//   · removed (told) — no unlock button: the sentence, "Add this device again", Wipe quiet. The
//                      cached wrap is not used while the row is set, online or offline.
// "Use your 12 words" runs the same flow in every case: email → code → register → "ready" →
// sign in → 12 words → re-wrap → unlock (centralReadd).
function renderCentralUnlockCard() {
  if (state.central.removed) {
    renderCentralRemovedCard();
    return;
  }
  const promote = (state.central.unlockFailures || 0) >= 2;
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Your notes are locked</p>
      <p class="vault-subtitle" data-field="lock-lead">${escapeHtml(state.central.signedOut ? "You're signed out. Unlock to get back to your notes." : platformOr((n) => `Unlock with ${n}.`, "Sign in to unlock."))}</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="unlock">${escapeHtml(platformOr((n) => `Unlock with ${n}`, "Unlock"))}</button>
      ${navigator.onLine === false ? `<p class="vault-advisory" data-field="offline-advisory">${escapeHtml(CENTRAL_OFFLINE_ADVISORY)}</p>` : ""}
      ${promote
        ? `<button class="vault-button secondary" type="button" data-action="words">Use your 12 words instead</button>`
        : `<button class="vault-link" type="button" data-action="words">${escapeHtml(platformOr((n) => `Can't use ${n}? Use your 12 words instead`, "Can't sign in? Use your 12 words instead"))}</button>`}
      <button class="vault-link quiet" type="button" data-action="wipe">Wipe this device</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const unlockButton = vaultOverlay.querySelector('[data-action="unlock"]');
  unlockButton.addEventListener("click", async () => {
    unlockButton.disabled = true;
    unlockButton.textContent = "Unlocking…";
    errorLine.hidden = true;
    try {
      await handleCentralUnlock();
    } catch (error) {
      centralUnlockFailed(error);
    }
  });
  vaultOverlay.querySelector('[data-action="words"]').addEventListener("click", beginCentralReadd);
  vaultOverlay.querySelector('[data-action="wipe"]').addEventListener("click", () => {
    state.vaultView = "wipe-confirm";
    renderVault();
  });
}

function renderCentralRemovedCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">This device was removed from your account</p>
      <p class="vault-subtitle">To add it back, use your email and then your 12 words. Your notes are still on this device.</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="readd">Add this device again</button>
      <button class="vault-link quiet" type="button" data-action="wipe">Wipe this device</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  vaultOverlay.querySelector('[data-action="readd"]').addEventListener("click", () => {
    if (navigator.onLine === false) {
      // Adding back needs the account; the row is only cleared by a settled re-add.
      errorLine.textContent = "Can't reach Txtshell right now. Check your connection and try again.";
      errorLine.hidden = false;
      return;
    }
    beginCentralReadd();
  });
  vaultOverlay.querySelector('[data-action="wipe"]').addEventListener("click", () => {
    state.vaultView = "wipe-confirm";
    renderVault();
  });
}

async function beginCentralReadd() {
  centralRescuedKey = null;
  let stored = null;
  try { stored = await readCentralMeta(); } catch { stored = null; }
  if (stored && stored.prfWrap && stored.credentialId && stored.hkdfSalt && stored.rpId) {
    // This device has a vault key in its cached wrap. Offer to carry its notes across before the
    // new passkey is registered (which would evict the old credential this wrap is sealed under).
    state.vaultPending = { readdRescue: stored };
    state.vaultView = "central-readd-rescue";
    renderVault();
    return;
  }
  state.vaultPending = null;
  state.vaultView = "central-start"; // renders the re-add variant while the vault is locked
  renderVault();
}

// The re-add's first step when this device still holds a cached wrap: one tap on the existing
// passkey (which works locally even when the account has revoked it — the assertion never leaves
// the device) unwraps the old VK and keeps it in memory, so a re-key after an abandon has a key
// to move the blocks from. Its own tap, before registration — a ceremony chained onto another is
// refused by the browser (manual-run finding 1). "Continue without it" proceeds without rescue.
function renderCentralReaddRescueCard() {
  const stored = state.vaultPending?.readdRescue;
  if (!stored) {
    state.vaultView = "central-start";
    renderVault();
    return;
  }
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Keep this device's notes</p>
      <p class="vault-subtitle">${escapeHtml(platformOr((n) => `Confirm with ${n} once more, so the notes here come across when you add this device back. You'll set it up again next.`, "Confirm on this device once more, so the notes here come across when you add it back. You'll set it up again next."))}</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="confirm">${escapeHtml(platformOr((n) => `Confirm with ${n}`, "Confirm"))}</button>
      <button class="vault-link" type="button" data-action="skip">Continue without it</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const button = vaultOverlay.querySelector('[data-action="confirm"]');
  const toStart = () => { state.vaultPending = null; state.vaultView = "central-start"; renderVault(); };
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Confirming…";
    errorLine.hidden = true;
    try {
      const { prf } = await window.txCentral.webauthn.assertOffline({ credentialId: stored.credentialId, rpId: stored.rpId });
      const kekWrap = await window.txCentral.keys.kekFromPrf(prf, stored.hkdfSalt);
      prf.fill(0);
      let vk = null;
      try { vk = await window.txCentral.keys.unwrapVK(stored.prfWrap, kekWrap, false); } catch { vk = null; }
      if (!vk || !(await verifyMasterKey(vk))) throw new Error("wrong-key");
      centralRescuedKey = vk;
      toStart();
    } catch (error) {
      console.warn("[txtshell] rescue of this device's key failed", error?.name || "", error);
      errorLine.textContent = error?.message === "wrong-key"
        ? "That didn't open this device's notes. Continue without it, or try again."
        : centralUnlockFailureMessage(error);
      errorLine.hidden = false;
      button.disabled = false;
      button.textContent = platformOr((n) => `Confirm with ${n}`, "Confirm");
    }
  });
  vaultOverlay.querySelector('[data-action="skip"]').addEventListener("click", () => { centralRescuedKey = null; toStart(); });
}

// A failed unlock ceremony: count it, land back on the lock card (the removed card if the server
// just said so), say what happened in one sentence. Nothing local changed — handleCentralUnlock
// writes only in settleCentralKey's one transaction, which either completed or did not.
function centralUnlockFailed(error) {
  const cancelled = error?.message === "cancelled";
  if (!cancelled) state.central.unlockFailures = (state.central.unlockFailures || 0) + 1;
  console.error("[txtshell] unlock failed", error?.name || "", error?.code || "", error);
  clearCentralSession(); // a sign-in that did not end in an unlock leaves no session behind
  state.vaultView = "unlock";
  state.vaultPending = null;
  renderVault();
  if (cancelled || state.central.removed) return;
  const line = vaultOverlay.querySelector(".vault-error");
  if (line) {
    line.textContent = centralUnlockFailureMessage(error);
    line.hidden = false;
  }
}

// The lock card's own copy. A NotAllowedError here is "no passkey the browser could use" (the
// sheet offered a phone or a security key and was dismissed, or the prompt was closed): the
// ceremony runs from a tap on a focused page, so the focus-lost sentence belongs only to the
// browser saying so. Browsers do not distinguish "none available" from "dismissed", so a dismissed
// prompt reads the same line — its action (try again, or the 12 words) is right either way.
function centralUnlockFailureMessage(error) {
  if (error?.message === "wrong-key") return "That sign-in doesn't open the notes on this browser.";
  if (error?.message === "offline-no-cache") return "You're offline and this browser has nothing saved to unlock with yet — connect and try again.";
  if (error?.message === "offline-ceremony-refused") return CENTRAL_OFFLINE_REFUSED;
  if (error?.code === "unknown-credential") return "That sign-in isn't on your account. Pick another one, or use your 12 words instead.";
  if (error?.name === "NotAllowedError" && navigator.onLine !== false && !/focus/i.test(error.message || "")) {
    return "No sign-in found on this device. Use your 12 words instead.";
  }
  return centralFailureMessage(error);
}

// Online: the ceremony is a sign-in (session + fresh wrap). Offline (the
// options request fails): the passkey alone opens the cached wrap — no session,
// pushes wait. Either way VK lands in state.encryption.masterKey.
async function handleCentralUnlock() {
  const stored = await readCentralMeta();
  if (stored.removed) throw new Error("removed"); // the removed card has no unlock button; belt and braces
  let login = null;
  try {
    login = await window.txCentral.webauthn.login();
  } catch (error) {
    // The server does not know the cached credential: this device was removed. Record it (the
    // lock screen becomes the removed card) and refuse the cached wrap from now on.
    await centralToldRemoved(error, stored);
    // Only a transport failure means "offline"; a refused ceremony or a server
    // answer is a real outcome.
    if (!(error?.name === "TypeError" || error?.status === 0)) throw error;
  }
  if (!login) {
    if (!stored.credentialId || !stored.prfWrap || !stored.hkdfSalt || !stored.rpId) throw new Error("offline-no-cache");
    let prf;
    try {
      ({ prf } = await window.txCentral.webauthn.assertOffline({ credentialId: stored.credentialId, rpId: stored.rpId }));
    } catch (error) {
      // Offline AND the authenticator would not release the passkey without a network — a
      // Microsoft-synced Hello passkey phones home to Microsoft and refuses. Not a wrong key and
      // not a dead passkey: nothing local changes, the user connects and tries again (plan §3).
      if (error?.name === "NotAllowedError" || error?.name === "AbortError") throw new Error("offline-ceremony-refused");
      throw error;
    }
    const kekWrap = await window.txCentral.keys.kekFromPrf(prf, stored.hkdfSalt);
    prf.fill(0);
    let vk;
    try {
      vk = await window.txCentral.keys.unwrapVK(stored.prfWrap, kekWrap, false);
    } catch {
      throw new Error("wrong-key");
    }
    if (!(await verifyMasterKey(vk))) throw new Error("wrong-key");
    await finishCentralUnlock(vk, { offline: true });
    return;
  }

  setCentralSession(login);
  const kekWrap = await window.txCentral.keys.kekFromPrf(login.prf, login.hkdfSalt);
  login.prf.fill(0);
  const identity = { credentialId: login.credentialId, hkdfSalt: login.hkdfSalt, rpId: login.rpId || stored.rpId };
  state.vaultView = "central-busy";
  state.vaultPending = { busy: "Unlocking" };
  renderVault();
  const out = await window.txCentral.ladder.run({ session: login.session, kekWrap, hasPrfWrap: login.hasPrfWrap, hasRecovery: login.hasRecovery }, centralUi);
  if (out.abandoned) await clearSyncState();
  await settleCentralKey({ stored, login, kekWrap, out, identity, readd: false });
}

// Adding this device back from the lock screen (plan §8): the passkey it has is revoked, gone
// or failing, so the account cards have just registered a new one (or found the one it has).
// Sign in with exactly that credential — never the removed one, which the authenticator may
// still offer — then settle the key the same way an unlock does. The old credential is
// signalled to the browser as unknown only AFTER the key is settled: until then it is the one
// thing that can still open the cached wrap if the account's key moved meanwhile.
async function centralReadd({ via, registered } = {}) {
  void via;
  state.vaultView = "central-busy";
  state.vaultPending = { busy: "Signing in" };
  renderVault();
  const stored = await readCentralMeta();
  const preferred = registered?.credentialId || state.central.readdCredentialId || stored.readdCredentialId || null;
  try {
    const login = await window.txCentral.webauthn.login(preferred ? { allowCredentialIds: [preferred] } : {});
    setCentralSession(login);
    const kekWrap = await window.txCentral.keys.kekFromPrf(login.prf, login.hkdfSalt);
    login.prf.fill(0);
    const identity = { credentialId: login.credentialId, hkdfSalt: login.hkdfSalt, rpId: login.rpId || registered?.rpId || stored.rpId };
    state.vaultView = "central-busy";
    state.vaultPending = { busy: "Unlocking" };
    renderVault();
    const out = await window.txCentral.ladder.run({ session: login.session, kekWrap, hasPrfWrap: login.hasPrfWrap, hasRecovery: login.hasRecovery }, centralUi);
    if (out.abandoned) await clearSyncState();
    state.vaultView = "central-busy";
    state.vaultPending = { busy: "Unlocking" };
    renderVault();
    await settleCentralKey({ stored, login, kekWrap, out, identity, readd: true });
    if (stored.credentialId && stored.credentialId !== identity.credentialId) {
      void window.txCentral.webauthn.signalUnknownCredential(identity.rpId, stored.credentialId);
    }
  } catch (error) {
    clearCentralSession();
    throw error;
  }
}

// The tail shared by the unlock and the re-add: the account handed VK (`out`); bind this store
// to it. Same key → refresh the cached wrap and identity if anything changed. Different key (the
// vault was started over elsewhere) → the old key is in the cached wrap: opened by the ceremony
// that just ran when it is this credential's wrap, else — on a re-add, where the credential is
// new — by one extra offline-style assertion with the OLD credential, still on the authenticator
// → every record moves under the new key in rekeyVault's one transaction. Old key unobtainable →
// the one dead end (plan §6.3): records kept, flagged unreadable, never wiped. A transaction that
// throws leaves the store exactly as it was (all under the old key) and the error reaches the
// card, so the user can try again.
async function settleCentralKey({ stored, login, kekWrap, out, identity, readd = false }) {
  const flagDeletes = readd ? [CENTRAL_REMOVED_KEY, CENTRAL_READD_CREDENTIAL_KEY] : [];
  if (await verifyMasterKey(out.vk)) {
    // The key that made this store. Refresh the cached wrap (and identity) if anything changed.
    if (readd || out.prfWrap !== stored.prfWrap || identity.credentialId !== stored.credentialId || identity.hkdfSalt !== stored.hkdfSalt || identity.rpId !== stored.rpId) {
      await rekeyVault({ entries: null, key: null, metaPuts: centralMetaRows({ ...identity, prfWrap: out.prfWrap }), metaDeletes: flagDeletes });
    }
    await finishCentralUnlock(out.vk, { offline: false, readd });
    return;
  }

  // The account handed a different key: the vault was started over (abandon) or this passkey was
  // re-set-up. Moving this device's blocks to the new key needs the OLD VK.
  let oldKey = null;
  try {
    if (stored.prfWrap && stored.credentialId && stored.credentialId === login.credentialId) {
      // Same credential, re-set-up (an ordinary unlock — no registration happened): the ceremony
      // that just ran is this credential's, so its KEK opens the cached wrap. No second prompt.
      oldKey = await window.txCentral.keys.unwrapVK(stored.prfWrap, kekWrap, false);
      if (!(await verifyMasterKey(oldKey))) oldKey = null;
    } else if (readd && centralRescuedKey) {
      // Re-add after an abandon: registering the new passkey EVICTED the old credential from this
      // authenticator, so the old key can no longer be asserted. It was captured up front, by the
      // "keep this device's notes" step before registration (plan §8).
      oldKey = (await verifyMasterKey(centralRescuedKey)) ? centralRescuedKey : null;
    }
  } catch (error) {
    console.warn("[txtshell] the old key could not be opened", error?.name || "", error);
    oldKey = null;
  }
  await applyReKeyOrDeadEnd({ oldKey, out, identity, flagDeletes, readd });
}

// The tail of a different-key settle, shared by the ordinary unlock and the re-add. `oldKey` set
// → re-key every record under the new key in one transaction (decrypt in memory first); null →
// the one dead end (plan §6.3): nothing is re-keyed, the records are kept and will read as
// unreadable under the new key until another device that can read them syncs them back. Never a
// wipe. A transaction that throws writes nothing (all-or-nothing): the store stays entirely under
// the old key, the in-memory copy is dropped, and the error reaches the caller.
async function applyReKeyOrDeadEnd({ oldKey, out, identity, flagDeletes = [], readd = false }) {
  if (oldKey) {
    state.vaultPending = { busy: "Getting your notes ready" }; // the busy card adds its own animated dots
    renderVault();
    state.encryption.masterKey = oldKey;
    state.encryption.unlocked = true;
    try {
      await decryptAllEntriesIntoState();
      const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, out.vk);
      await rekeyVault({
        entries: state.entries,
        key: out.vk,
        metaPuts: [...centralMetaRows({ ...identity, prfWrap: out.prfWrap }), [ENC_VERIFY_KEY, verify]],
        metaDeletes: [SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY, ...flagDeletes],
      });
    } catch (error) {
      state.encryption.masterKey = null;
      state.encryption.unlocked = false;
      state.entries = [];
      state.unreadable = [];
      throw error;
    }
    state.encryption.masterKey = out.vk;
    state.central.firstJoin = true;
    await finishCentralUnlock(out.vk, { offline: false, rekeyed: true, readd });
    scheduleCloudSync();
    return;
  }
  const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, out.vk);
  await rekeyVault({
    entries: null,
    key: null,
    metaPuts: [...centralMetaRows({ ...identity, prfWrap: out.prfWrap }), [ENC_VERIFY_KEY, verify]],
    metaDeletes: [SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY, ...flagDeletes],
  });
  await finishCentralUnlock(out.vk, { offline: false, deadEnd: true, readd });
}

async function finishCentralUnlock(vk, { offline = false, rekeyed = false, deadEnd = false, readd = false } = {}) {
  state.encryption.masterKey = vk;
  state.encryption.unlocked = true;
  const wasRemoved = state.central.removed === true;
  if (readd) {
    state.central.removed = false;
    state.central.readdCredentialId = null;
  }
  state.central.unlockFailures = 0;
  state.central.signedOut = false;
  centralRescuedKey = null;
  const outcome = await decryptAllEntriesIntoState();
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  updateLockButton();
  const outcomeText = describeUnlockOutcome(outcome);
  let hint = outcomeText ? `Unlocked — ${outcomeText}` : "Unlocked";
  // The start-over paths (copy batch, 2026-10-13): notes, not blocks or keys.
  const noteOutcome = describeUnlockOutcome(outcome, "note");
  const startedOver = "your account was started over, and your notes here are now part of it";
  const notOpened = `${pluralCount(outcome.unreadable, "note")} here couldn't be opened after the start-over. They're kept, and will come back if another device can open them.`;
  if (rekeyed) hint = `Unlocked — ${startedOver}${noteOutcome ? ` · ${noteOutcome}` : ""}.`;
  if (deadEnd && outcome.unreadable > 0) hint = `Unlocked — ${notOpened}`;
  if (readd) hint = wasRemoved
    ? "Device added back — your notes are part of your account again."
    : `Unlocked — ${rekeyed ? startedOver : "this device is set up again"}${deadEnd && outcome.unreadable > 0 ? ` · ${notOpened}` : "."}`;
  composerHint.textContent = hint;
  render();
  entryInput.focus();
  signalReady();
  void reencryptRecovered(outcome);
  if (offline) {
    setSyncStatus("central-offline");
    return;
  }
  void autoPullOnUnlock();
}

// ---------- /account family ----------

function beginAccount() {
  if (!centralAvailable()) {
    composerHint.textContent = CENTRAL_UNAVAILABLE;
    return;
  }
  setEditorValue("");
  clearDraft();
  if (!isCentral()) {
    state.vaultPending = null;
    state.vaultView = "central-start";
    renderVault();
    composerHint.textContent = "Txtshell sync";
    return;
  }
  if (isVaultLocked()) return; // the lock screen is its own card
  openAccountCard();
}

// Which account card fits this device now (plan §17.3): the footer's state, always (centralSyncState).
function accountCardKind(syncState = centralSyncState()) {
  return ["on", "syncing", "trouble"].includes(syncState) ? "signed-in" : syncState;
}

// The signed-in card's title and first line for each state it covers.
function accountCardLines(syncState) {
  if (syncState === "trouble") return { title: "Sync has a problem.", line: syncStatusFull(lastFailureReason) };
  return { title: "Sync is on.", line: syncState === "syncing" ? "Syncing…" : lastSyncedText() };
}

// Keeps an open account card on the footer's state: a different card when the state needs one,
// otherwise the signed-in card's lines in place (no re-render, so focus stays put).
function refreshAccountCard() {
  if (state.vaultView !== "central-account") return;
  const card = vaultOverlay.querySelector("[data-account]");
  const syncState = centralSyncState();
  if (!card || card.dataset.account !== accountCardKind(syncState)) {
    renderVault();
    return;
  }
  card.dataset.state = syncState;
  if (card.dataset.account !== "signed-in") return;
  const { title, line } = accountCardLines(syncState);
  card.querySelector(".vault-title").textContent = title;
  card.querySelector('[data-field="last-synced"]').textContent = line;
}

function openAccountCard() {
  state.vaultPending = null;
  state.vaultView = "central-account";
  renderVault();
  composerHint.textContent = "Txtshell sync";
}

// "Touch ID" where it can be named; plain words otherwise (plan §17.4).
function platformOr(withName, without) {
  const name = passkeyPlatformName();
  return name ? withName(name) : without;
}

function renderCentralAccountCard() {
  const syncState = centralSyncState();
  const kind = accountCardKind(syncState);
  const signInLabel = platformOr((n) => `Sign in with ${n}`, "Sign in");
  const close = `<button class="vault-link" type="button" data-action="close">Close</button>`;
  const quietSignOut = `<button class="vault-link" type="button" data-action="signout">Sign out</button>`;
  const leave = `<button class="vault-link quiet" type="button" data-action="leave">Stop syncing this device</button>`;
  let body;
  if (kind === "signed-in") {
    const { title, line } = accountCardLines(syncState);
    body = `
      <p class="vault-title">${escapeHtml(title)}</p>
      <p class="vault-subtitle" data-field="last-synced">${escapeHtml(line)}</p>
      ${state.central.email ? `<p class="vault-subtitle" data-field="email">Signed in as ${escapeHtml(state.central.email)}</p>` : ""}
      <button class="vault-button secondary" type="button" data-action="signout">Sign out</button>
      <button class="vault-link" type="button" data-action="new-words">Get new 12 words</button>
      <button class="vault-link" type="button" data-action="devices">Your devices</button>
      ${leave}
      <p class="vault-fine">Stopping keeps your notes here, locked with a passphrase you choose.</p>
      ${close}`;
  } else if (kind === "paused") {
    body = `
      <p class="vault-title">Sync is paused.</p>
      <p class="vault-subtitle">Sign in to continue.</p>
      <button class="vault-button" type="button" data-action="signin">${escapeHtml(signInLabel)}</button>
      ${quietSignOut}
      ${close}`;
  } else if (kind === "offline") {
    body = `
      <p class="vault-title">You're offline.</p>
      <p class="vault-subtitle">Your notes are saved here and will sync when you're back.</p>
      <button class="vault-button" type="button" data-action="close">Close</button>
      ${quietSignOut}`;
  } else if (kind === "setup") {
    body = `
      <p class="vault-title">Finish setting up sync.</p>
      <p class="vault-subtitle">Save your 12 words to finish setting up.</p>
      <button class="vault-button" type="button" data-action="save-words">Save your 12 words</button>
      ${close}`;
  } else {
    body = `
      <p class="vault-title">This device was removed from your account.</p>
      <p class="vault-subtitle">To add it back, use your email and then your 12 words.</p>
      <button class="vault-button" type="button" data-action="readd">Add this device again</button>
      ${leave}
      ${close}`;
  }
  vaultOverlay.innerHTML = `
    <div class="vault-card" data-account="${kind}" data-state="${syncState}">
      ${SYNC_ICON_SVG}
      ${body}
      <p class="vault-error" hidden></p>
    </div>
  `;
  const on = (action, fn) => vaultOverlay.querySelectorAll(`[data-action="${action}"]`).forEach((b) => b.addEventListener("click", fn));
  on("close", exitVaultToNormal);
  on("signout", () => { state.vaultView = "central-signout"; renderVault(); });
  on("signin", () => { void centralResume(); });
  on("devices", () => { void beginAccountDevices(); });
  on("leave", () => { void beginAccountLeave(); });
  on("new-words", () => { state.vaultView = "central-new-words"; renderVault(); });
  on("save-words", () => { void centralFinishSetup(); });
  on("readd", () => { lockVault(); void beginCentralReadd(); });
}

// Sign out from the card asks first; the consequence lives here, not as small print on the card
// (manual-run finding 5). /account signout still signs out at once.
function renderCentralSignOutCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card" data-account-confirm="signout">
      ${SYNC_ICON_SVG}
      <p class="vault-title">Sign out?</p>
      <p class="vault-subtitle">${escapeHtml(platformOr((n) => `Signing out locks your notes on this device. ${n} opens them again.`, "Signing out locks your notes on this device. Signing in opens them again."))}</p>
      <button class="vault-button" type="button" data-action="confirm">Sign out</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  vaultOverlay.querySelector('[data-action="confirm"]').addEventListener("click", () => { void accountSignOut(); });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", openAccountCard);
}

function renderCentralNewWordsCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Get new 12 words?</p>
      <p class="vault-subtitle">Your old 12 words will stop working for adding a device. Backups you've already downloaded still need the old words — keep them if you keep those backups.</p>
      <button class="vault-button" type="button" data-action="confirm">Get new 12 words</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  vaultOverlay.querySelector('[data-action="confirm"]').addEventListener("click", () => { void beginAccountPhrase(); });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", openAccountCard);
}

// "Save your 12 words" (plan §17.3, decision 1): the account has no keys (an unfinished setup, e.g.
// a start-over that never got its words). Sign in with this device's own passkey, open the local key
// from the cached wrap, and make it the account's key — the notes keep their key — then the words
// screen. If the account has keys after all (409 keys-exist), it is an ordinary sign-in.
async function centralFinishSetup() {
  state.vaultView = "central-busy";
  state.vaultPending = { busy: platformOr((n) => `Confirm with ${n}`, "Confirm") };
  renderVault();
  try {
    const stored = await readCentralMeta();
    if (!stored.credentialId || !stored.prfWrap || !stored.hkdfSalt) throw new Error("missing-meta");
    const login = await window.txCentral.webauthn.login({ allowCredentialIds: [stored.credentialId] });
    setCentralSession(login);
    const kekWrap = await window.txCentral.keys.kekFromPrf(login.prf, login.hkdfSalt);
    login.prf.fill(0);
    let vkExtractable;
    try {
      vkExtractable = await window.txCentral.keys.unwrapVK(stored.prfWrap, kekWrap, true);
    } catch {
      throw new Error("wrong-key");
    }
    if (!(await verifyMasterKey(vkExtractable))) throw new Error("wrong-key");
    if (!login.hasRecovery) {
      const out = await window.txCentral.ladder.bootstrap({ session: login.session, kekWrap, vk: vkExtractable }, centralUi);
      if (out) {
        // The account's data plane starts over with these keys (the server allows a bootstrap only
        // when it holds no data): forget the old generation, so the first push is If-Match "g0".
        await clearSyncState();
        state.vaultView = null;
        state.vaultPending = null;
        renderVault();
        setSyncStatus("ok");
        composerHint.textContent = "Your 12 words are saved — sync is set up.";
        scheduleCloudSync();
        return;
      }
    }
    await centralResume();
  } catch (error) {
    centralFlowFailed(error, null);
  }
}

// Central mode, unlocked, session gone (expired, revoked, signed out, or an
// offline unlock): a passkey ceremony restores it. If the account's key moved
// meanwhile (abandon elsewhere), the ladder runs and local blocks are re-keyed
// from the key already in memory.
async function centralResume() {
  state.vaultView = "central-busy";
  state.vaultPending = { busy: "Signing in" };
  renderVault();
  let stored = null;
  try {
    stored = await readCentralMeta();
    const login = await window.txCentral.webauthn.login();
    setCentralSession(login);
    const kekWrap = await window.txCentral.keys.kekFromPrf(login.prf, login.hkdfSalt);
    login.prf.fill(0);
    const identity = { credentialId: login.credentialId, hkdfSalt: login.hkdfSalt, rpId: login.rpId || stored.rpId };
    const out = await window.txCentral.ladder.run({ session: login.session, kekWrap, hasPrfWrap: login.hasPrfWrap, hasRecovery: login.hasRecovery }, centralUi);
    if (out.abandoned) await clearSyncState();
    if (await verifyMasterKey(out.vk)) {
      if (out.prfWrap !== stored.prfWrap || identity.credentialId !== stored.credentialId) {
        await rekeyVault({ entries: null, key: null, metaPuts: centralMetaRows({ ...identity, prfWrap: out.prfWrap }) });
      }
      state.encryption.masterKey = out.vk;
    } else {
      // The account's key changed under us; the current key (in memory) opens everything.
      const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, out.vk);
      await rekeyVault({
        entries: state.entries,
        key: out.vk,
        metaPuts: [...centralMetaRows({ ...identity, prfWrap: out.prfWrap }), [ENC_VERIFY_KEY, verify]],
        metaDeletes: [SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY],
      });
      state.encryption.masterKey = out.vk;
      state.central.firstJoin = true;
    }
    state.vaultView = null;
    state.vaultPending = null;
    renderVault();
    setSyncStatus("ok");
    composerHint.textContent = "Signed in — sync resumed.";
    scheduleCloudSync();
    void beginPull({ quiet: true });
  } catch (error) {
    // Told while unlocked: the row is set now, VK stays until the vault locks (plan §8 — nothing
    // local is deleted or rewritten); the next lock screen is the removed card.
    const told = await centralToldRemoved(error, stored).catch(() => false);
    centralFlowFailed(error, null);
    if (told) composerHint.textContent = CENTRAL_REMOVED_SENTENCE; // the sync indicator now opens the removed card
  }
}

async function beginAccountDevices() {
  if (!isCentral()) {
    composerHint.textContent = "No Txtshell account on this browser — run /account to sign in.";
    return;
  }
  if (!state.central.session) {
    composerHint.textContent = "Sign in first — run /account.";
    return;
  }
  setEditorValue("");
  clearDraft();
  state.vaultPending = null;
  state.vaultView = "central-devices";
  renderVault();
  composerHint.textContent = "Your account";
}

// "today 14:02", "yesterday 09:15", "Oct 21" (this year) or "Oct 21, 2025" — local time.
function relativeWhen(iso, now = new Date()) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86400000);
  if (days === 0) return `today ${time}`;
  if (days === 1) return `yesterday ${time}`;
  return at.toLocaleDateString([], at.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

async function renderCentralDevicesCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Your devices</p>
      <p class="vault-subtitle">Devices that can open your notes. Removing one keeps whatever that device already has; it just can't sign in or get new changes.</p>
      <p class="vault-error" hidden></p>
      <ul class="devices-list" data-field="devices"><li class="vault-subtitle">Loading…</li></ul>
      <button class="vault-button secondary" type="button" data-action="phrase">Get new 12 words</button>
      <button class="vault-button secondary" type="button" data-action="signout">Sign out on this device</button>
      <button class="vault-link" type="button" data-action="leave">Stop syncing this device</button>
      <button class="vault-link" type="button" data-action="close">Close</button>
    </div>
  `;
  const list = vaultOverlay.querySelector('[data-field="devices"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const showError = (message) => { errorLine.textContent = message; errorLine.hidden = !message; };
  const load = async () => {
    try {
      const devices = await window.txCentral.devices.list(state.central.session);
      list.innerHTML = "";
      for (const device of devices) {
        const li = document.createElement("li");
        li.dataset.credentialId = device.id;
        li.title = device.id; // for support; the name is what a person recognises
        const label = document.createElement("span");
        label.className = "device-label";
        const name = document.createElement("span");
        name.className = "device-name";
        name.textContent = device.label || "Unknown device";
        const when = document.createElement("span");
        when.className = "device-when";
        when.textContent = ` — last used ${device.lastUsedAt ? relativeWhen(device.lastUsedAt) : "never"}${device.isCurrent ? " · this device" : ""}`;
        const detail = document.createElement("span");
        detail.className = "device-detail";
        detail.textContent = ` ${device.backedUp ? "synced" : "this device only"} · ${device.hasPrfWrap ? "set up" : "needs the 12 words"}`;
        label.append(name, when, detail);
        li.appendChild(label);
        if (!device.isCurrent) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "vault-link inline";
          button.textContent = "Remove";
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              await window.txCentral.devices.revoke(state.central.session, device.id);
              showError("");
              await load();
            } catch (error) {
              showError(error.code === "last-device" ? "That's your last device — it can't be removed." : "Couldn't remove it. Try again.");
              button.disabled = false;
            }
          });
          li.appendChild(button);
        }
        list.appendChild(li);
      }
      if (devices.length === 0) list.innerHTML = `<li class="vault-subtitle">No devices listed.</li>`;
    } catch (error) {
      list.innerHTML = "";
      showError(error.code === "device-removed" ? CENTRAL_REMOVED_SENTENCE : error.status === 401 ? "Session ended — run /account to sign in again." : "Couldn't load your devices.");
    }
  };
  void load();
  vaultOverlay.querySelector('[data-action="phrase"]').addEventListener("click", () => { void beginAccountPhrase(); });
  vaultOverlay.querySelector('[data-action="signout"]').addEventListener("click", () => { void accountSignOut(); });
  vaultOverlay.querySelector('[data-action="leave"]').addEventListener("click", () => { void beginAccountLeave(); });
  vaultOverlay.querySelector('[data-action="close"]').addEventListener("click", exitVaultToNormal);
}

// A passkey ceremony on this device that yields VK EXTRACTABLE (for wrapping:
// export, leave, rotate). Deliberately a fresh ceremony — an unlocked tab is
// not enough to hand the raw key anywhere.
async function centralExtractableKey() {
  const stored = await readCentralMeta();
  if (!stored.credentialId || !stored.prfWrap || !stored.hkdfSalt || !stored.rpId) throw new Error("missing-meta");
  const { prf } = await window.txCentral.webauthn.assertOffline({ credentialId: stored.credentialId, rpId: stored.rpId });
  const kekWrap = await window.txCentral.keys.kekFromPrf(prf, stored.hkdfSalt);
  prf.fill(0);
  let vk;
  try {
    vk = await window.txCentral.keys.unwrapVK(stored.prfWrap, kekWrap, true);
  } catch {
    throw new Error("wrong-key");
  }
  if (!(await verifyMasterKey(vk))) throw new Error("wrong-key");
  return vk;
}

async function beginAccountPhrase() {
  if (!isCentral()) { composerHint.textContent = "No Txtshell account on this browser — run /account to sign in."; return; }
  if (!state.central.session) { composerHint.textContent = "Sign in first — run /account."; return; }
  setEditorValue("");
  clearDraft();
  state.vaultView = "central-busy";
  state.vaultPending = { busy: platformOr((n) => `Confirm with ${n}`, "Confirm") };
  renderVault();
  try {
    const vk = await centralExtractableKey();
    await window.txCentral.ladder.rotate({ session: state.central.session, vkExtractable: vk }, centralUi);
    state.vaultView = null;
    state.vaultPending = null;
    renderVault();
    composerHint.textContent = "New 12 words saved. Your old ones no longer add a device.";
    entryInput.focus();
  } catch (error) {
    centralFlowFailed(error, null);
  }
}

async function accountSignOut() {
  if (!isCentral()) { composerHint.textContent = "No Txtshell account on this browser."; return; }
  setEditorValue("");
  clearDraft();
  if (state.central.session) {
    await window.txCentral.devices.signOut(state.central.session).catch(() => {});
  }
  clearCentralSession();
  // A sign-out on a shared machine must not leave the blocks on screen: drop VK and show the
  // unlock card. The cached wrap stays, so the next unlock is a sign-in (plan §8, manual-run
  // finding 4). The lock card says it was a sign-out (copy batch, 2026-10-13).
  state.central.signedOut = true;
  lockVault();
  composerHint.textContent = "Signed out.";
}

// Convert back to an ordinary passphrase vault with the SAME key: no record is
// rewritten; the account and its other devices are unaffected.
async function beginAccountLeave() {
  if (!isCentral()) { composerHint.textContent = "No Txtshell account on this browser."; return; }
  setEditorValue("");
  clearDraft();
  state.vaultView = "central-busy";
  state.vaultPending = { busy: platformOr((n) => `Confirm with ${n}`, "Confirm") };
  renderVault();
  try {
    const vk = await centralExtractableKey();
    state.vaultView = "central-leave";
    state.vaultPending = { leaveKey: vk };
    renderVault();
  } catch (error) {
    centralFlowFailed(error, null);
  }
}

async function handleAccountLeaveSubmit(passphrase) {
  const vk = state.vaultPending?.leaveKey;
  if (!vk) throw new Error("missing-key");
  const saltPass = randomBytes(16);
  const wrappingKey = await deriveWrappingKey(passphrase, saltPass, PBKDF2_ITERATIONS);
  const wrappedPass = await wrapMasterKey(vk, wrappingKey);
  const sessionKey = await unwrapMasterKey(wrappedPass, wrappingKey);
  await rekeyVault({
    entries: null, // same key: no record is rewritten; enc-verify stays valid
    key: null,
    metaPuts: [
      [ENC_SALT_PASS_KEY, bytesToBase64(saltPass)],
      [ENC_WRAPPED_PASS_KEY, wrappedPass],
      [ENC_ITERATIONS_PASS_KEY, String(PBKDF2_ITERATIONS)],
    ],
    metaDeletes: [...CENTRAL_ROWS, SYNC_BASE_HASH_KEY, SYNC_BASE_MAP_KEY, SYNC_GENERATION_KEY],
  });
  if (state.central.session) {
    await window.txCentral.devices.signOut(state.central.session).catch(() => {});
  }
  clearCentralSession();
  state.central.firstJoin = false;
  state.encryption.mode = "passphrase";
  state.encryption.masterKey = sessionKey;
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  updateLockButton();
  setSyncStatus("ok");
  composerHint.textContent = "Stopped syncing. Your notes stay here, locked with your passphrase. You can turn sync back on with /sync setup.";
  render();
  entryInput.focus();
}

// ---------- /export in central mode (plan §9, revised 2026-10-09) ----------
// A txtshell-encrypted-v1 file that carries the account's recovery wrap VERBATIM (VK under the
// 12 words' KEK, the container rung 2 opens): it opens with the words the account has today. The
// passkey ceremony — on this device's own credential, so the wrap is this vault's account's — is
// the consent and yields the live session the wrap is read over. Nothing new is asked for, and
// nothing new reaches the server (GET /v1/keys/recovery is the rung-2 read).
async function exportCentralEncrypted(exportEntriesList, exportedLabel) {
  const stored = await readCentralMeta();
  if (!stored.credentialId) throw new Error("missing-meta");
  const login = await window.txCentral.webauthn.login({ allowCredentialIds: [stored.credentialId] });
  login.prf.fill(0); // not needed: the file does not re-wrap anything
  setCentralSession(login);
  const recovery = await window.txCentral.api("/v1/keys/recovery", "GET", undefined, login.session);
  if (!recovery || typeof recovery.blob !== "string" || typeof recovery.hkdfSalt !== "string") throw new Error("no-recovery-wrap");
  const verify = await getMeta(ENC_VERIFY_KEY);
  const combined = await encryptPlaintext(JSON.stringify(exportEntriesList), state.encryption.masterKey);
  const combinedBytes = base64ToBytes(combined);
  const fileObj = {
    format: "txtshell-encrypted-v1",
    createdAt: new Date().toISOString(),
    wrappedPhrase: { blob: recovery.blob, hkdfSalt: recovery.hkdfSalt },
    verify,
    iv: bytesToBase64(combinedBytes.slice(0, 12)),
    ciphertext: bytesToBase64(combinedBytes.slice(12)),
  };
  const timestamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(fileObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `txtshell-encrypted-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  composerHint.textContent = exportedLabel("encrypted");
}

function beginCentralExport(exportEntriesList, exportedLabel) {
  state.vaultPending = { exportEntriesList, exportedLabel };
  state.vaultView = "central-export";
  renderVault();
  composerHint.textContent = "Export an encrypted backup";
}

const CENTRAL_EXPORT_NOTE = "This file opens with your current 12 words. If you get new words later, you'll still need these ones to open it.";

function renderCentralExportCard() {
  const { exportEntriesList, exportedLabel } = state.vaultPending || {};
  if (!exportEntriesList) {
    exitVaultToNormal();
    return;
  }
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Export an encrypted backup</p>
      <p class="vault-subtitle" data-field="export-note">${escapeHtml(CENTRAL_EXPORT_NOTE)}</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="submit">${escapeHtml(platformOr((n) => `Confirm with ${n} and export`, "Confirm and export"))}</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const button = vaultOverlay.querySelector('[data-action="submit"]');
  button.addEventListener("click", async () => {
    button.disabled = true;
    errorLine.hidden = true;
    try {
      await exportCentralEncrypted(exportEntriesList, exportedLabel);
      state.vaultView = null;
      state.vaultPending = null;
      renderVault();
      entryInput.focus();
    } catch (error) {
      console.error("[txtshell] export failed", error?.name || "", error?.code || "", error);
      errorLine.textContent = error?.message === "no-recovery-wrap" || error?.status === 404
        ? "Your account has no recovery words yet, so there is nothing for the file to open with."
        : centralFailureMessage(error);
      errorLine.hidden = false;
      button.disabled = false;
    }
  });
  vaultOverlay.querySelector('[data-action="cancel"]').addEventListener("click", exitVaultToNormal);
}

// ---------- the first-join card (plan §6.2 step 6) ----------
// Cloud and local are two unrelated histories here, not a stale copy of each
// other; the primary action keeps both. The classifier's output is only used
// for the counts; the two existing actions remain with their existing warnings.
function renderFirstJoinCard() {
  const cloudEntries = state.vaultPending?.pullEntries;
  if (!Array.isArray(cloudEntries)) {
    exitVaultToNormal();
    return;
  }
  const cloudSet = Array.isArray(state.vaultPending.pullCloud) ? state.vaultPending.pullCloud : cloudEntries;
  const localSet = Array.isArray(state.vaultPending.pullLocal) ? state.vaultPending.pullLocal : state.entries;
  const diff = classifyPullDivergence(cloudSet, localSet, false);
  // A, B: each side's notes. X: only in the cloud. Y: only on this browser. Z: in both, changed differently.
  const A = cloudSet.length;
  const B = localSet.length;
  const X = diff.cloudOnly.length;
  const Y = diff.localOnly.length;
  const changedIds = new Set([...diff.cloudNewer, ...diff.localNewer, ...diff.ambiguous].map((e) => e.id));
  const Z = changedIds.size;
  // Keep all = every note on either side; a note changed differently on both keeps both versions (the
  // everyday merge with no base), so N counts the kept older version too.
  const differentText = [...changedIds].filter((id) => {
    const l = localSet.find((e) => e.id === id);
    const c = cloudSet.find((e) => e.id === id);
    return l && c && l.text !== c.text;
  }).length;
  const N = new Set([...cloudSet, ...localSet].filter((e) => e && typeof e.id === "string").map((e) => e.id)).size + differentText;
  const notes = (n) => pluralCount(n, "note");
  const list = notePreviewList;

  const merge = async () => {
    const cloudGeneration = state.vaultPending?.pullGeneration;
    const result = await mergeNotes(null, localSet, cloudSet); // no base: the union, older versions kept
    if (Number.isInteger(cloudGeneration)) await recordSyncedGeneration(cloudGeneration);
    await applyMergeToLocal(result);
    state.central.firstJoin = false;
    state.vaultView = null;
    state.vaultPending = null;
    renderVault(); // lifts the hold; the merge's saves scheduled the push
    scheduleCloudSync();
    composerHint.textContent = `Kept all ${notes(state.entries.length)} — syncing now.`;
  };
  const useCloud = async () => {
    state.central.firstJoin = false;
    await applyCloudReplaceLocal(cloudEntries);
  };
  const useBrowser = async () => {
    const cloudGeneration = state.vaultPending?.pullGeneration;
    if (Number.isInteger(cloudGeneration)) await recordSyncedGeneration(cloudGeneration);
    state.central.firstJoin = false;
    state.vaultPending = null;
    exitVaultToNormal(); // lifts the hold
    scheduleCloudSync();
    composerHint.textContent = `Kept this browser's ${notes(B)}. The cloud is being updated to match.`;
  };

  // A one-sided choice that would delete notes, or overwrite changes, asks first and lists exactly
  // what goes. It stays inside this view, so the push hold stays on until a choice is made.
  const confirming = state.vaultPending.firstJoinConfirm;
  if (confirming === "cloud" || confirming === "browser") {
    const cloud = confirming === "cloud";
    const deletes = cloud ? Y : X;
    const removed = deletes > 0
      ? (cloud ? diff.localOnly : diff.cloudOnly)
      : (cloud ? localSet : cloudSet).filter((e) => changedIds.has(e.id));
    const title = deletes > 0
      ? (cloud ? `Delete ${notes(Y)} from this browser?` : `Delete ${notes(X)} from the cloud, on every device?`)
      : (cloud ? `Lose this browser's changes to ${notes(Z)}?` : `Lose the cloud's changes to ${notes(Z)}, on every device?`);
    const confirmLabel = deletes > 0
      ? (cloud ? "Delete them and use the cloud's notes" : "Delete them and use this browser's notes")
      : (cloud ? "Use the cloud's versions" : "Use this browser's versions");
    vaultOverlay.innerHTML = `
      <div class="vault-card" data-first-join="confirm-${confirming}">
        ${SYNC_ICON_SVG}
        <p class="vault-title">${escapeHtml(title)}</p>
        <div data-field="removed">${list(removed)}</div>
        ${deletes > 0 && Z > 0 ? `<p class="wipe-warning" data-field="changes-lost">${escapeHtml(cloud ? `This browser's changes to ${notes(Z)} are lost too.` : `The cloud's changes to ${notes(Z)} are lost too.`)}</p>` : ""}
        <p class="vault-error" hidden></p>
        <button class="vault-button danger" type="button" data-action="confirm">${escapeHtml(confirmLabel)}</button>
        <button class="vault-link" type="button" data-action="back">Back</button>
      </div>
    `;
    const errorLine = vaultOverlay.querySelector(".vault-error");
    const buttons = [...vaultOverlay.querySelectorAll("button")];
    vaultOverlay.querySelector('[data-action="confirm"]').addEventListener("click", async () => {
      buttons.forEach((button) => { button.disabled = true; });
      try {
        await (cloud ? useCloud() : useBrowser());
      } catch (error) {
        console.error(error);
        errorLine.textContent = "That didn't work. Try again.";
        errorLine.hidden = false;
        buttons.forEach((button) => { button.disabled = false; });
      }
    });
    vaultOverlay.querySelector('[data-action="back"]').addEventListener("click", () => {
      state.vaultPending = { ...state.vaultPending, firstJoinConfirm: null };
      renderVault();
    });
    return;
  }

  // "Show which" (closed by default, no hover): the notes only on that side.
  const side = (key, label, only) => `
      <p class="vault-subtitle" data-field="${key}-count">${escapeHtml(label)}</p>
      ${only.length ? `<button class="vault-link" type="button" data-action="show-${key}" aria-expanded="false">Show which</button>
      <div data-field="${key}-list" hidden>${list(only)}</div>` : ""}`;
  vaultOverlay.innerHTML = `
    <div class="vault-card" data-first-join="choose">
      ${SYNC_ICON_SVG}
      <p class="vault-title">Your notes</p>
      ${side("cloud", `In the cloud: ${notes(A)}`, diff.cloudOnly)}
      ${side("browser", `On this browser: ${notes(B)}`, diff.localOnly)}
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="merge">Keep all ${N} and sync</button>
      <button class="vault-link" type="button" data-action="replace">Use only the cloud's ${A}</button>
      <p class="vault-subtitle first-join-consequence">(removes this browser's notes)</p>
      <button class="vault-link" type="button" data-action="keep">Use only this browser's ${B}</button>
      <p class="vault-subtitle first-join-consequence">(replaces the cloud, on every device)</p>
    </div>
  `;
  for (const key of ["cloud", "browser"]) {
    const toggle = vaultOverlay.querySelector(`[data-action="show-${key}"]`);
    if (!toggle) continue;
    toggle.addEventListener("click", () => {
      const panel = vaultOverlay.querySelector(`[data-field="${key}-list"]`);
      panel.hidden = !panel.hidden;
      toggle.textContent = panel.hidden ? "Show which" : "Hide";
      toggle.setAttribute("aria-expanded", String(!panel.hidden));
    });
  }
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const buttons = [...vaultOverlay.querySelectorAll("button")];
  const run = (fn, failure) => async () => {
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await fn();
    } catch (error) {
      console.error(error);
      errorLine.textContent = failure;
      errorLine.hidden = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  };
  const confirmFirst = (which) => () => {
    state.vaultPending = { ...state.vaultPending, firstJoinConfirm: which };
    renderVault();
  };
  vaultOverlay.querySelector('[data-action="merge"]').addEventListener("click", run(merge, "Merge failed. Try again."));
  // Anything lost — notes deleted, or changes overwritten — asks first; nothing lost acts at once.
  vaultOverlay.querySelector('[data-action="replace"]').addEventListener("click", Y > 0 || Z > 0 ? confirmFirst("cloud") : run(useCloud, "Replace failed. Try again."));
  vaultOverlay.querySelector('[data-action="keep"]').addEventListener("click", X > 0 || Z > 0 ? confirmFirst("browser") : run(useBrowser, "That didn't work. Try again."));
}

// ---------------------------------------------------------------------------
// /inbox — full-view triage of encrypted captures synced from the phone
// ---------------------------------------------------------------------------

// Transient triage state; never persisted. inboxState holds the current session's
// fetched+decrypted entries and the ids the user has acted on. inboxPendingDeleteIds
// survives a failed DELETE so it can be retried (and excluded) on the next /inbox.
let inboxState = null;
let inboxPendingDeleteIds = new Set();

function isInboxOpen() {
  return inboxState !== null;
}

inboxCloseButton.addEventListener("click", endInbox);

function beginInbox() {
  getSyncConfig().then(({ workerUrl, authToken }) => {
    if (!normalizeWorkerUrl(workerUrl) || !authToken) {
      state.vaultView = "sync-setup";
      renderVault();
      composerHint.textContent = "Configure sync before triaging";
      return;
    }
    inboxState = { loading: true, error: null, entries: [], processed: new Set() };
    openInboxView();
    renderInboxView();
    composerHint.textContent = "Inbox";
    fetchAndDecryptInbox();
  });
}

function openInboxView() {
  if (state.searchMode) {
    closeSearchMode();
  }
  composerForm.classList.add("is-inbox");
  inboxView.hidden = false;
}

function inboxDecrypt(entry) {
  // Inbox entries carry iv and ciphertext as SEPARATE base64 fields; recombine into
  // the IV(12)||ct layout decryptCiphertext expects (same as encrypted-export import).
  const ivBytes = base64ToBytes(entry.iv);
  const ctBytes = base64ToBytes(entry.ciphertext);
  const combined = new Uint8Array(ivBytes.length + ctBytes.length);
  combined.set(ivBytes, 0);
  combined.set(ctBytes, ivBytes.length);
  return decryptCiphertext(bytesToBase64(combined), state.encryption.masterKey);
}

async function fetchAndDecryptInbox() {
  const { workerUrl, authToken } = await getSyncConfig();
  const url = normalizeWorkerUrl(workerUrl);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLOUD_SYNC_TIMEOUT_MS);
  let raw;
  try {
    const response = await fetch(`${url}/v1/inbox`, {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    });
    if (response.status === 401) {
      if (isCentral() && (await response.json().catch(() => ({})))?.error === "device-removed") await centralToldRemovedBySession();
      throw new Error("auth");
    }
    if (!response.ok) {
      throw new Error("http-" + response.status);
    }
    if (Number(response.headers.get("content-length") || 0) > CLOUD_MAX_RESPONSE_BYTES) {
      throw new Error("malformed");
    }
    raw = await response.json();
    if (!Array.isArray(raw)) {
      throw new Error("malformed");
    }
  } catch (error) {
    window.clearTimeout(timeout);
    if (!inboxState) return; // user already closed the inbox view
    console.warn("[txtshell] inbox fetch failed", error);
    inboxState.loading = false;
    inboxState.error = error?.message === "auth"
      ? "Sync auth failed — check /sync setup."
      : "Couldn't reach the inbox. Try again.";
    renderInboxView();
    return;
  }
  window.clearTimeout(timeout);
  if (!inboxState) return;

  // Drop entries already triaged in a prior session whose DELETE hasn't landed yet,
  // and retry that DELETE so the Worker self-heals.
  // The listing JSON is server-controlled (only the payloads are E2E) — require
  // sane string ids so a hostile response can't crash the render.
  const visible = raw.filter((e) =>
    e && typeof e.id === "string" && e.id.length <= 256 && !inboxPendingDeleteIds.has(e.id));
  if (inboxPendingDeleteIds.size > 0) {
    flushInboxDelete();
  }

  const entries = [];
  for (const e of visible) {
    let text = null;
    let decryptOk = false;
    try {
      text = await inboxDecrypt(e);
      decryptOk = true;
    } catch (error) {
      console.warn("[txtshell] inbox entry decrypt failed", e.id, error);
    }
    entries.push({ id: e.id, createdAt: typeof e.createdAt === "string" ? e.createdAt : "", text, decryptOk });
  }
  inboxState.loading = false;
  inboxState.entries = entries;
  renderInboxView();
}

function markInboxProcessed(id) {
  if (inboxState) {
    inboxState.processed.add(id);
  }
}

function inboxSave(id) {
  const entry = inboxState?.entries.find((e) => e.id === id);
  if (!entry || !entry.decryptOk) return;
  if (typeof entry.text !== "string" || entry.text.length > MAX_IMPORT_ENTRY_TEXT) {
    composerHint.textContent = "Capture too large to save.";
    return; // left untriaged — not deleted from the Worker
  }
  createEntryFromText(entry.text); // existing path -> saveEntry -> auto-export
  markInboxProcessed(id);
  render();
  renderInboxView();
}

function inboxDelete(id) {
  // "Delete" here = remove from the inbox without saving a block. Marks the entry
  // processed; the actual Worker DELETE is batched on exit (flushInboxDelete).
  markInboxProcessed(id);
  renderInboxView();
}

function endInbox() {
  if (inboxState) {
    for (const id of inboxState.processed) {
      inboxPendingDeleteIds.add(id);
    }
  }
  inboxState = null;
  composerForm.classList.remove("is-inbox");
  inboxView.hidden = true;
  inboxList.innerHTML = "";
  composerHint.textContent = state.editingEntryId ? "Editing block -> save updates" : "Ready";
  entryInput.focus();
  flushInboxDelete();
}

async function flushInboxDelete() {
  if (inboxPendingDeleteIds.size === 0) return;
  const ids = Array.from(inboxPendingDeleteIds);
  const { workerUrl, authToken } = await getSyncConfig();
  const url = normalizeWorkerUrl(workerUrl);
  if (!url || !authToken) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLOUD_SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/v1/inbox`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("http-" + response.status);
    }
    // Only clear the ids we actually sent; any added since stay pending.
    for (const id of ids) {
      inboxPendingDeleteIds.delete(id);
    }
  } catch (error) {
    console.warn("[txtshell] inbox delete failed", error);
    showStatusToast("Inbox cleanup failed — may see duplicates until next /inbox", { isHint: true });
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatInboxTimestamp(value) {
  if (!value) return "";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  return formatTimestamp(value);
}

function renderInboxView() {
  if (!inboxState) return;

  if (inboxState.loading) {
    inboxViewSubtitle.textContent = "Loading captures…";
    inboxList.innerHTML = "";
    return;
  }

  if (inboxState.error) {
    inboxViewSubtitle.textContent = inboxState.error;
    inboxList.innerHTML = "";
    return;
  }

  const pending = inboxState.entries.filter((e) => !inboxState.processed.has(e.id));

  if (inboxState.entries.length === 0) {
    inboxViewSubtitle.textContent = "Inbox is empty.";
    inboxList.innerHTML = "";
    return;
  }

  inboxViewSubtitle.textContent = pending.length === 0
    ? "All captures triaged — Esc or Close to exit."
    : `${pending.length} ${pending.length === 1 ? "capture" : "captures"} to triage.`;

  if (pending.length === 0) {
    inboxList.innerHTML = '<li class="inbox-empty">Nothing left to triage.</li>';
    return;
  }

  inboxList.innerHTML = pending.map((entry) => {
    const when = formatInboxTimestamp(entry.createdAt);
    const meta = when ? `<p class="inbox-entry-meta">${escapeHtml(when)}</p>` : "";
    if (!entry.decryptOk) {
      return `
        <li class="inbox-entry is-undecryptable" data-id="${escapeHtml(entry.id)}">
          ${meta}
          <p class="inbox-entry-text inbox-entry-error">Couldn't decrypt — delete or report.</p>
          <div class="inbox-entry-actions">
            <button type="button" data-action="delete" data-id="${escapeHtml(entry.id)}">Delete</button>
          </div>
        </li>
      `;
    }
    return `
      <li class="inbox-entry" data-id="${escapeHtml(entry.id)}">
        ${meta}
        <p class="inbox-entry-text">${escapeHtml(entry.text)}</p>
        <div class="inbox-entry-actions">
          <button type="button" class="inbox-action-primary" data-action="save" data-id="${escapeHtml(entry.id)}">Save</button>
          <button type="button" data-action="delete" data-id="${escapeHtml(entry.id)}">Delete</button>
        </div>
      </li>
    `;
  }).join("");

  inboxList.querySelectorAll(".inbox-entry-actions button").forEach((button) => {
    const id = button.getAttribute("data-id");
    const action = button.getAttribute("data-action");
    button.addEventListener("click", () => {
      if (action === "save") inboxSave(id);
      else if (action === "delete") inboxDelete(id);
    });
  });
}

// ---------------------------------------------------------------------------
// /sym — chemistry & math symbol palette. Everything it inserts is a literal
// Unicode character, so blocks stay plain text: they save, encrypt, search,
// and export exactly like typed text. No markup, no renderer.
// ---------------------------------------------------------------------------

const SYMBOL_GROUPS = [
  { label: "Subscripts", symbols: ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉", "ₙ", "ₓ"] },
  { label: "Superscripts", symbols: ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹", "⁺", "⁻", "ⁿ"] },
  { label: "Arrows", symbols: ["→", "⇌", "↑", "↓", "⇋", "⟶"] },
  { label: "Greek", symbols: ["α", "β", "γ", "Δ", "δ", "ε", "θ", "λ", "μ", "π", "ρ", "σ", "Ω", "φ"] },
  { label: "Math / misc", symbols: ["°", "·", "×", "÷", "±", "≈", "≤", "≥", "≠", "√", "∞", "∴"] },
  // Multi-character keys ("lim", "dy/dx") are plain text too — there's no
  // single glyph for them, so they insert as the literal string.
  { label: "Calculus", symbols: ["∫", "∬", "∭", "∮", "∂", "∇", "∑", "∏", "′", "″", "∝", "lim", "→∞", "dy/dx"] },
];

// Every sub/superscript glyph Unicode actually has. Subscript letters are
// sparse (no b c d f g q w y z), and neither row has ∞, π, or →, which is why
// conversion is all-or-nothing per group below: a limit we can't fully render
// stays exactly as typed rather than half-rendered.
const SUBSCRIPT_CHARS = {
  0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ",
  r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};
const SUPERSCRIPT_CHARS = {
  0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ",
  m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};
const BIG_OPERATORS = "∫∬∭∮∑∏";

// Map every character of `group`, or return null if any has no glyph.
function mapScript(group, marker) {
  const table = marker === "_" ? SUBSCRIPT_CHARS : SUPERSCRIPT_CHARS;
  let out = "";
  for (const ch of group) {
    if (!(ch in table)) {
      return null;
    }
    out += table[ch];
  }
  return out;
}

// Explicit markers only, LaTeX-shaped, three tiers from most to least permissive:
//   1. After a big operator (∫ ∑ …): _ or ^ takes a brace group, a digit/sign
//      run, or a single letter  →  ∫_0^1 ⇒ ∫₀¹, ∫_a^b ⇒ ∫ₐᵇ, ∑_{n=1}^{2n}.
//   2. Anywhere: a brace group  →  e^{-x} ⇒ e⁻ˣ, x_{ij} ⇒ xᵢⱼ.
//   3. Anywhere: _ + digits, ^ + digits/signs  →  H_2O ⇒ H₂O, Ca^2+ ⇒ Ca²⁺.
// Letters outside braces or operators never convert, so some_variable, a^b and
// e^x stay as typed. Each group converts all-or-nothing (∫_0^∞ ⇒ ∫₀^∞).
function convertSymbolMarkers(text) {
  const convertGroup = (whole, marker, group) => {
    const inner = group.startsWith("{") ? group.slice(1, -1) : group;
    const mapped = mapScript(inner, marker);
    return mapped === null ? whole : mapped;
  };
  return text
    .replace(new RegExp(`([${BIG_OPERATORS}])((?:[_^](?:\\{[^{}]+\\}|[0-9+\\-=]+|[A-Za-z]))+)`, "g"),
      (_, op, markers) => op + markers.replace(/([_^])(\{[^{}]+\}|[0-9+\-=]+|[A-Za-z])/g, convertGroup))
    .replace(/([_^])(\{[^{}]+\})/g, convertGroup)
    .replace(/(_)(\d+)/g, convertGroup)
    .replace(/(\^)([0-9+\-]+)/g, convertGroup);
}

function loadRecentSymbols() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SYM_RECENT_KEY));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item === "string" && item.length > 0).slice(0, SYM_RECENT_MAX);
  } catch {
    return [];
  }
}

function rememberRecentSymbol(symbol) {
  const recent = [symbol, ...loadRecentSymbols().filter((item) => item !== symbol)].slice(0, SYM_RECENT_MAX);
  try {
    window.localStorage.setItem(SYM_RECENT_KEY, JSON.stringify(recent));
  } catch {
    // localStorage may be unavailable (private mode); the palette still works
  }
  return recent;
}

function symbolKeyHtml(symbol) {
  const safe = escapeHtml(symbol);
  return `<button class="sym-key" type="button" data-sym="${safe}" aria-label="Insert ${safe}">${safe}</button>`;
}

function renderSymRecent(recent = loadRecentSymbols()) {
  const container = symPalette.querySelector('[data-sym-recent]');
  if (!container) {
    return;
  }
  container.innerHTML = recent.length
    ? recent.map(symbolKeyHtml).join("")
    : '<span class="sym-recent-empty">symbols you use will appear here</span>';
}

function renderSymPalette() {
  const sections = SYMBOL_GROUPS.map((group) => `
    <div class="sym-section">
      <p class="sym-section-label">${escapeHtml(group.label)}</p>
      <div class="sym-grid">${group.symbols.map(symbolKeyHtml).join("")}</div>
    </div>`).join("");

  symPalette.innerHTML = `
    <div class="sym-palette-header">
      <span class="sym-palette-title">Symbols</span>
      <span class="sym-palette-hint">click to insert at the cursor · Esc closes · type ;; to toggle anytime</span>
      <button class="sym-palette-close" type="button" data-action="close" aria-label="Close symbol palette">Close</button>
    </div>
    <div class="sym-section sym-section-recent">
      <p class="sym-section-label">Recently used</p>
      <div class="sym-grid" data-sym-recent></div>
    </div>
    ${sections}
    <div class="sym-palette-footer">
      <button class="sym-convert" type="button" data-action="convert">Convert _ / ^ markers in this block</button>
      <span class="sym-palette-status" data-sym-status aria-live="polite"></span>
      <span class="sym-palette-hint">H_2O → H₂O · Ca^2+ → Ca²⁺ · ∫_0^1 → ∫₀¹ · ∫_a^b → ∫ₐᵇ · ∑_{n=1}^{2n} · e^{-x} → e⁻ˣ · ∞ and π have no small glyph, so ∫_0^∞ → ∫₀^∞ · while open, a space after the token converts it</span>
    </div>
  `;
  renderSymRecent();
}

function openSymPalette() {
  renderSymPalette();
  hidePinnedPanel();
  symPalette.hidden = false;
  // Feedback stays inside the palette (see setSymStatus): the bottom status
  // toast is fixed-position and would sit over the lowest row of keys.
  composerHint.textContent = "Ready";
  focusComposer();
}

let symStatusTimer = null;
function setSymStatus(message) {
  const status = symPalette.querySelector("[data-sym-status]");
  if (!status) {
    return;
  }
  status.textContent = message;
  window.clearTimeout(symStatusTimer);
  symStatusTimer = window.setTimeout(() => {
    status.textContent = "";
  }, 4000);
}

function closeSymPalette() {
  symPalette.hidden = true;
  composerHint.textContent = "Ready";
  focusComposer();
}

// Toggle from anywhere the composer is usable (the ";;" sigil and /sym).
// Search mode, the inbox, and the vault gate own the screen then; do nothing.
function toggleSymPalette() {
  if (isVaultLocked() || state.searchMode || isInboxOpen() || state.vaultView || !findReplaceBar.hidden) {
    return;
  }
  if (symPalette.hidden) {
    openSymPalette();
  } else {
    closeSymPalette();
  }
}

// ";;" typed at the start of a line or after whitespace toggles the palette
// mid-note, without clearing the composer the way /sym does. The sigil is
// consumed so it never lands in the block; "x;;y" (no boundary) and pasted
// text are left alone. Returns true when it fired so the caller can bail —
// the removal dispatches its own input event for the normal bookkeeping.
const SYM_SIGIL = ";;";
function consumeSymPaletteSigil(event) {
  const type = event?.inputType;
  if (type && type !== "insertText" && type !== "insertCompositionText") {
    return false;
  }
  const caret = entryInput.selectionStart;
  if (caret === null || caret !== entryInput.selectionEnd || caret < SYM_SIGIL.length) {
    return false;
  }
  const value = entryInput.value;
  if (value.slice(caret - SYM_SIGIL.length, caret) !== SYM_SIGIL) {
    return false;
  }
  const before = value[caret - SYM_SIGIL.length - 1];
  if (before !== undefined && !/\s/.test(before)) {
    return false;
  }
  replaceComposerRange(caret - SYM_SIGIL.length, caret, "");
  toggleSymPalette();
  return true;
}

// Replace [start, end) in the composer with `text`, leaving the caret after it.
// execCommand keeps the edit on the native undo stack and fires the composer's
// own input event; the setRangeText fallback dispatches one so draft save,
// word count, and palette state update exactly as if the text were typed.
function replaceComposerRange(start, end, text) {
  const expected = entryInput.value.slice(0, start) + text + entryInput.value.slice(end);
  entryInput.focus();
  entryInput.setSelectionRange(start, end);
  let done = false;
  try {
    done = text ? document.execCommand("insertText", false, text) : document.execCommand("delete");
  } catch {
    done = false;
  }
  if (!done || entryInput.value !== expected) {
    entryInput.value = expected;
    entryInput.setSelectionRange(start + text.length, start + text.length);
    entryInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const caret = start + text.length;
  entryInput.setSelectionRange(caret, caret);
}

function insertSymbol(symbol) {
  if (entryInput.disabled) {
    return;
  }
  const start = entryInput.selectionStart ?? entryInput.value.length;
  const end = entryInput.selectionEnd ?? start;
  replaceComposerRange(start, end, symbol);
  renderSymRecent(rememberRecentSymbol(symbol));
}

function convertMarkersInComposer() {
  const text = entryInput.value;
  const converted = convertSymbolMarkers(text);
  if (converted === text) {
    entryInput.focus();
    setSymStatus("No _ or ^ markers to convert");
    return;
  }
  const caret = entryInput.selectionStart ?? text.length;
  replaceComposerRange(0, text.length, converted);
  const newCaret = convertSymbolMarkers(text.slice(0, caret)).length;
  entryInput.setSelectionRange(newCaret, newCaret);
  setSymStatus("Converted _ / ^ markers");
}

function convertMarkerTokenBeforeCaret() {
  const start = entryInput.selectionStart;
  if (start === null || start !== entryInput.selectionEnd) {
    return;
  }
  const before = entryInput.value.slice(0, start);
  const tokenStart = before.search(/\S+$/);
  if (tokenStart === -1) {
    return;
  }
  const token = before.slice(tokenStart);
  if (!/[_^]/.test(token)) {
    return;
  }
  const converted = convertSymbolMarkers(token);
  if (converted !== token) {
    replaceComposerRange(tokenStart, start, converted);
  }
}

// Keep focus (and the caret) in the composer when a palette key is pressed:
// cancelling pointerdown/mousedown stops the button from taking focus, while
// the click still fires. This is what makes building "2H₂ + O₂ → 2H₂O" fluid.
["pointerdown", "mousedown"].forEach((type) => {
  symPalette.addEventListener(type, (event) => {
    if (event.target.closest("button")) {
      event.preventDefault();
    }
  });
});

symPalette.addEventListener("click", (event) => {
  const key = event.target.closest(".sym-key");
  if (key) {
    insertSymbol(key.dataset.sym);
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "close") {
    closeSymPalette();
  } else if (action === "convert") {
    convertMarkersInComposer();
  }
});

// Pinned-blocks panel: the ★ in the top bar lists pinned blocks, most
// recently edited first, and a tap hands the block to reopenEntryInEditor —
// the same path /re and Edit use. Lives at the top of the editor area
// (under the star) and follows the /sym palette's open/close/Esc contract.
function getFirstLine(text) {
  const line = text.split("\n").map((part) => part.trim()).find(Boolean);
  return line || "(empty block)";
}

function renderPinnedPanel() {
  pinnedPanel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "pinned-panel-header";
  const title = document.createElement("span");
  title.className = "pinned-panel-title";
  title.textContent = "Pinned";
  const hint = document.createElement("span");
  hint.className = "pinned-panel-hint";
  hint.textContent = "tap to open in the editor · Esc closes";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "pinned-panel-close";
  close.textContent = "Close";
  close.setAttribute("aria-label", "Close pinned blocks");
  close.addEventListener("click", closePinnedPanel);
  header.append(title, hint, close);
  pinnedPanel.appendChild(header);

  const pinned = state.entries
    .filter((entry) => entry.pinned === true)
    .sort((a, b) => (b.editedAt || b.createdAt).localeCompare(a.editedAt || a.createdAt));

  if (!pinned.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nothing pinned yet. Use ☆ on a saved block to pin it.";
    pinnedPanel.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "pinned-list";
  pinned.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "pinned-item";
    const line = document.createElement("span");
    line.className = "pinned-item-line";
    line.textContent = getFirstLine(entry.text);
    const when = document.createElement("span");
    when.className = "pinned-item-when";
    when.textContent = formatTimestamp(entry.createdAt);
    item.append(line, when);
    item.addEventListener("click", () => {
      hidePinnedPanel();
      reopenEntryInEditor(entry.id);
    });
    list.appendChild(item);
  });
  pinnedPanel.appendChild(list);

  const footer = document.createElement("div");
  footer.className = "pinned-panel-footer";
  const all = document.createElement("button");
  all.type = "button";
  all.className = "pinned-panel-all";
  all.textContent = "All pinned →";
  all.addEventListener("click", () => {
    // Same view as the /pin command, without touching the composer text.
    state.search = "";
    state.preset = "pinned";
    openSearchMode();
    composerHint.textContent = "Pinned";
    render();
  });
  footer.appendChild(all);
  pinnedPanel.appendChild(footer);
}

// Hide without moving focus — for callers that are about to place it
// themselves (reopen, search mode, the Esc sweep).
function hidePinnedPanel() {
  pinnedPanel.hidden = true;
  pinnedButton.classList.remove("is-active");
  pinnedButton.setAttribute("aria-expanded", "false");
}

function openPinnedPanel() {
  renderPinnedPanel();
  symPalette.hidden = true;
  pinnedPanel.hidden = false;
  pinnedButton.classList.add("is-active");
  pinnedButton.setAttribute("aria-expanded", "true");
  focusComposer();
}

function closePinnedPanel() {
  hidePinnedPanel();
  focusComposer();
}

// Same reach as toggleSymPalette, except search mode is closed first so the
// star works from anywhere the composer can be reached.
function togglePinnedPanel() {
  if (isVaultLocked() || isInboxOpen() || state.vaultView || !findReplaceBar.hidden) {
    return;
  }
  if (!pinnedPanel.hidden) {
    closePinnedPanel();
    return;
  }
  if (state.searchMode) {
    closeSearchMode();
  }
  openPinnedPanel();
}

// Keep focus (and the soft keyboard) in the composer while tapping rows.
["pointerdown", "mousedown"].forEach((type) => {
  pinnedPanel.addEventListener(type, (event) => {
    if (event.target.closest("button")) {
      event.preventDefault();
    }
  });
  pinnedButton.addEventListener(type, (event) => event.preventDefault());
});
