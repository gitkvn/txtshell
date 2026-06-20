const DB_NAME = "txtshell";
const DB_VERSION = 1;
const ENTRY_STORE = "entries";
const META_STORE = "meta";
const DRAFT_KEY = "draft";
const THEME_KEY = "txtshell-theme-v1";
const WORD_COUNT_KEY = "txtshell-word-count-v1";

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
const ENC_VERIFY_PLAINTEXT = "txtshell-verify-v1";
const SYNC_WORKER_URL_KEY = "sync-worker-url";
const SYNC_AUTH_TOKEN_KEY = "sync-auth-token";
const CLOUD_SYNC_DEBOUNCE_MS = 1000; // coalesce rapid sequential saves into one upload
const CLOUD_SYNC_TIMEOUT_MS = 15000; // abort a stuck upload; local save is already canonical
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
const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;

const HINTS_KEY = "txtshell-hints-v1";
const HINT_DELAY = 800;

const INTEREST_KEY = "txtshell-interest-v1";
// Formspree endpoint — accepts a JSON POST of { email, clickedAt, userAgent, referrer }.
// Any response is ignored. Set to null to record interest only in the visitor's own
// localStorage (per-device, no aggregation).
const INTEREST_ENDPOINT = "https://formspree.io/f/meepyaww";
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DRAFT_SAVE_DELAY = 180;
const DELETE_UNDO_TIMEOUT = 10000;
const COPY_FLASH_DURATION = 900;
const DELETE_CONFIRM_TIMEOUT = 2000;
const TOAST_DURATION = 3000;
const HINT_TOAST_DURATION = 6000;

const COMPOSER_PLACEHOLDER_EMPTY = "Type /about and press enter to get started";
const COMPOSER_PLACEHOLDER_HAS_BLOCKS = "Type a block, or / for commands";

const SLASH_COMMANDS = [
  { name: "/about", description: "First-time user guide" },
  { name: "/encrypt", description: "Set up vault encryption with a passphrase" },
  { name: "/encrypt change", description: "Change your encryption passphrase" },
  { name: "/encrypt off", description: "Remove encryption and restore plaintext" },
  { name: "/wipe", description: "Delete all blocks and vault metadata" },
  { name: "/export", description: "Download an encrypted backup of your blocks" },
  { name: "/import", description: "Restore blocks from a JSON export" },
  { name: "/lock", description: "Lock the vault" },
  { name: "/pin", description: "Show only pinned blocks" },
  { name: "/q", description: "Open the full shortcut reference" },
  { name: "/re", description: "Reopen your most recent block" },
  { name: "/w", description: "Show blocks saved during the last week" },
  { name: "/wa", description: "Show blocks created or edited in the last 7 days" },
  { name: "/y", description: "Show blocks saved yesterday" },
  { name: "/ya", description: "Show blocks created or edited yesterday" },
  { name: "/mirror", description: "Show a pairing QR to link an iOS device" },
  { name: "/sync setup", description: "Set the sync Worker URL and auth token" },
  { name: "/port", description: "Set up this browser using pairing data from another browser" },
  { name: "/pull", description: "Fetch the latest blocks from cloud" },
  { name: "/inbox", description: "Triage captures synced from your phone" },
];

const state = {
  db: null,
  entries: [],
  searchMode: false,
  search: "",
  preset: null,
  editingEntryId: null,
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
  },
  vaultView: null,
  vaultPending: null,
  targetCount: null,
  selectedEntries: new Set(),
};

const composerForm = document.querySelector("#composerForm");
const entryInput = document.querySelector("#entryInput");
const editorSuggestions = document.querySelector("#editorSuggestions");
const commandPalette = document.querySelector("#commandPalette");
const inlineResults = document.querySelector("#inlineResults");
const entryList = document.querySelector("#entryList");
const searchInput = document.querySelector("#searchInput");
const searchInputLabel = document.querySelector("#searchInputLabel");
const searchSuggestions = document.querySelector("#searchSuggestions");
const searchMode = document.querySelector("#searchMode");
const searchModeLabel = document.querySelector("#searchModeLabel");
const quickReference = document.querySelector("#quickReference");
const aboutGuide = document.querySelector("#aboutGuide");
const savedCount = document.querySelector("#savedCount");
const wordCountDisplay = document.querySelector("#wordCountDisplay");
const exportButton = document.querySelector("#exportButton");
const shortcutsLink = document.querySelector("#shortcutsLink");
const searchUndoDeleteButton = document.querySelector("#searchUndoDeleteButton");
const closeSearchButton = document.querySelector("#closeSearchButton");
const statusToast = document.querySelector("#statusToast");
const wordCountToggleButton = document.querySelector("#wordCountToggleButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const composerHint = document.querySelector("#composerHint");
const currentDateTime = document.querySelector("#currentDateTime");
const entryTemplate = document.querySelector("#entryTemplate");
const vaultOverlay = document.querySelector("#vaultOverlay");
const inboxView = document.querySelector("#inboxView");
const inboxList = document.querySelector("#inboxList");
const inboxViewSubtitle = document.querySelector("#inboxViewSubtitle");
const inboxCloseButton = document.querySelector("#inboxCloseButton");
const lockButton = document.querySelector("#lockButton");
const upgradeLink = document.querySelector("#upgradeLink");
const interestOverlay = document.querySelector("#interestOverlay");
const interestBackdrop = document.querySelector("#interestBackdrop");
const interestForm = document.querySelector("#interestForm");
const interestThanks = document.querySelector("#interestThanks");
const interestEmailInput = document.querySelector("#interestEmail");
const interestErrorEl = document.querySelector("#interestError");
const interestSkipButton = document.querySelector("#interestSkipButton");
const interestDoneButton = document.querySelector("#interestDoneButton");
const findReplaceBar = document.querySelector("#findReplaceBar");
const findInput = document.querySelector("#findInput");
const replaceInput = document.querySelector("#replaceInput");
const findReplaceCount = document.querySelector("#findReplaceCount");
const findReplaceReplaceButton = document.querySelector("#findReplaceReplaceButton");
const findReplaceReplaceAllButton = document.querySelector("#findReplaceReplaceAllButton");
const findReplaceCloseButton = document.querySelector("#findReplaceCloseButton");
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
}

let draftSaveTimer = null;
let deleteUndoTimer = null;
let statusToastTimer = null;
let inlineResultsTimer = null;

const INLINE_RESULTS_DELAY = 150;

window.addEventListener("load", () => {
  if (state.vaultView) {
    return;
  }
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
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

  if (target.closest("#searchMode, .copy-button, #searchInput, #editorSuggestions, #commandPalette, #vaultOverlay, #lockButton, #interestOverlay, #findReplaceBar, #mergeModal, #deleteModal")) {
    return;
  }

  if (!interestOverlay.hidden) {
    return;
  }

  window.requestAnimationFrame(() => entryInput.focus());
});

composerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitComposer();
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }
  const data = event.data;
  if (!data || data.type !== "txtshell_capture") {
    return;
  }
  const note = typeof data.note === "string" ? data.note.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!note && !title && !url) {
    return;
  }
  if (isVaultLocked()) {
    console.warn("[txtshell] capture dropped: vault is locked");
    return;
  }
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
  const text = parts.join("\n");
  const entry = createEntryFromText(text);
  console.log("[txtshell] captured block from postMessage", entry.id);
  render();
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

upgradeLink.addEventListener("click", () => {
  openInterestCard();
});

interestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = interestEmailInput.value.trim();
  if (email && !RE_EMAIL.test(email)) {
    interestErrorEl.textContent = "That doesn't look like a valid email.";
    interestErrorEl.hidden = false;
    interestEmailInput.focus();
    return;
  }
  interestErrorEl.hidden = true;
  interestErrorEl.textContent = "";

  const submitButton = interestForm.querySelector(".interest-submit");
  submitButton.disabled = true;

  const record = {
    email: email || null,
    clickedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    referrer: document.referrer || null,
  };

  try {
    window.localStorage.setItem(INTEREST_KEY, JSON.stringify(record));
  } catch {
    // localStorage may be unavailable (private mode); submission still proceeds
  }

  if (INTEREST_ENDPOINT) {
    try {
      await fetch(INTEREST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(record),
        keepalive: true,
      });
    } catch {
      // silent — local record still counts as a signal
    }
  }

  submitButton.disabled = false;
  showInterestThanks();
});

interestSkipButton.addEventListener("click", () => {
  closeInterestCard();
});

interestDoneButton.addEventListener("click", () => {
  closeInterestCard();
});

interestBackdrop.addEventListener("click", () => {
  closeInterestCard();
});

exportButton.addEventListener("click", () => {
  exportEntries();
});

searchUndoDeleteButton.addEventListener("click", () => {
  undoDelete();
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
  applyCountMode(COUNT_MODES[nextIndex]);
});

themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
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
  // Multi-select confirmation modals live inside search-mode. Esc closes the modal
  // and returns to the search view with the selection intact (Cancel/backdrop clear
  // it; Esc preserves it), so the user lands back on their multi-select — not the
  // composer.
  if (!mergeModal.hidden || !deleteModal.hidden) {
    dismissMultiSelectModalToSearch();
    return;
  }
  if (!interestOverlay.hidden) {
    closeInterestCard();
    return;
  }
  if (!findReplaceBar.hidden) {
    closeFindReplace();
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
    closeSearchMode();
    return;
  }

  // Plain composer: sweep all transient UI in one pass.
  if (getInlineQuery()) {
    clearInlineQuery();
  }
  if (state.targetCount !== null) {
    state.targetCount = null;
    updateWordCount();
  }
  if (state.editingEntryId) {
    state.editingEntryId = null;
    setEditorValue("");
    clearDraft();
  } else if (entryInput.value.trim().startsWith("/")) {
    setEditorValue("");
    clearDraft();
  }
  state.commandPaletteDismissed = false;
  composerHint.textContent = "Ready";
  render();

  // Ensure transient chrome is hidden after the re-render, then land in the composer.
  commandPalette.hidden = true;
  editorSuggestions.hidden = true;
  statusToast.classList.remove("is-visible", "is-hint");
  focusComposer();
}

entryInput.addEventListener("keydown", (event) => {
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

  if (event.key === "Enter" && entryInput.value.trim() === "/y") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/ya") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/w") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/wa") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/re") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/q") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/about") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/pin") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/encrypt") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/encrypt change") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/encrypt off") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/wipe") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/lock") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/import") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/export") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/mirror") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/sync setup") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/port") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/pull") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/inbox") {
    event.preventDefault();
    submitComposer();
    return;
  }

  const targetMatch = event.key === "Enter" ? entryInput.value.trim().match(/^\/(\d+)$/) : null;
  if (targetMatch) {
    event.preventDefault();
    const value = parseInt(targetMatch[1], 10);
    state.targetCount = value > 0 ? value : null;
    setEditorValue("");
    clearDraft();
    updateWordCount();
    composerHint.textContent = state.targetCount ? `Target set to ${state.targetCount}` : "Target cleared";
    return;
  }

  if (event.key === "Enter" && /^\/-[a-zA-Z0-9_-]+$/.test(entryInput.value.trim())) {
    event.preventDefault();
    submitComposer();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    submitComposer();
  }
});

entryInput.addEventListener("input", () => {
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

updateClock();
window.setInterval(updateClock, 1000);
applyTheme(window.localStorage.getItem(THEME_KEY) || "light");
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

  if (getInlineQuery()) {
    composerHint.textContent = "Inline retrieval is active";
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

  if (text === "/sync setup") {
    setEditorValue("");
    clearDraft();
    state.vaultPending = null;
    state.vaultView = "sync-setup";
    renderVault();
    composerHint.textContent = "Configure sync";
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

  const targetMatch = text.match(/^\/(\d+)$/);
  if (targetMatch) {
    const value = parseInt(targetMatch[1], 10);
    state.targetCount = value > 0 ? value : null;
    setEditorValue("");
    clearDraft();
    updateWordCount();
    composerHint.textContent = state.targetCount ? `Target set to ${state.targetCount}` : "Target cleared";
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
      composerHint.textContent = "Updated";
      state.editingEntryId = null;
      render();
      return;
    }
  }

  createEntryFromText(text);
  setEditorValue("");
  clearDraft();
  composerHint.textContent = "Saved";
  render();

  if (state.entries.length === 1) {
    showHint("first-save", "Press Cmd/Ctrl + K to search your saved blocks");
  } else if (state.entries.length === 3) {
    showHint("inline-retrieval", "Type a word then // to search inline without leaving the editor");
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
  savedCount.textContent = `Saved (${state.entries.length})`;
  entryInput.placeholder = state.entries.length
    ? COMPOSER_PLACEHOLDER_HAS_BLOCKS
    : COMPOSER_PLACEHOLDER_EMPTY;
  scheduleInlineResults();
  renderCommandPalette();

  if (!state.searchMode) {
    return;
  }

  searchUndoDeleteButton.hidden = !state.pendingDeletedEntries?.length;
  pruneStaleSelections();
  const selectionCount = state.selectedEntries.size;
  if (selectionCount >= 2) {
    mergeSelectedButton.hidden = false;
    mergeSelectedButton.textContent = `Merge selected (${selectionCount})`;
    deleteSelectedButton.hidden = false;
    deleteSelectedButton.textContent = `Delete selected (${selectionCount})`;
  } else {
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
    } else {
      entryList.innerHTML = '<p class="empty-state">No blocks in this view.</p>';
    }
    return;
  }

  renderEntries(entryList, filteredEntries, {
    selectResults: true,
    highlightTerm: getActiveHighlightTerm(),
    mode: "search",
  });
}

function openSearchMode() {
  state.searchMode = true;
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

  state.editingEntryId = entry.id;
  setEditorValue(entry.text);
  saveMeta(DRAFT_KEY, entry.text);
  window.clearTimeout(inlineResultsTimer);
  inlineResults.innerHTML = "";
  inlineResults.hidden = true;
  closeSearchMode();
  composerHint.textContent = "Editing block -> save updates";
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
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
    const saltPassBase64 = await getMeta(ENC_SALT_PASS_KEY);
    state.encryption.enabled = Boolean(saltPassBase64);

    if (state.encryption.enabled) {
      state.vaultView = "unlock";
      renderVault();
      updateLockButton();
      render();
      return;
    }

    state.entries = await getAllEntries();
    state.entries = state.entries.map((entry) => ({
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

function getEntriesForQuery({ preset = null, search = "" } = {}) {
  const filtered = state.entries.filter((entry) => {
    if (preset === "quickref" || preset === "about") {
      return false;
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
    if (!search) {
      return true;
    }
    const normalizedSearch = search.toLowerCase();
    if (normalizedSearch.startsWith("#")) {
      return (entry.tags || []).includes(normalizedSearch.slice(1));
    }
    if (normalizedSearch.startsWith("@")) {
      return (entry.mentions || []).includes(normalizedSearch.slice(1));
    }
    return entry.text.toLowerCase().includes(normalizedSearch);
  });

  if (preset === "yesterday-all" || preset === "week-all") {
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

  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(entries[Math.min(currentIndex + 1, entries.length - 1)].id);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(entries[Math.max(currentIndex - 1, 0)].id);
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

function applyCountMode(mode) {
  document.body.dataset.countMode = mode;
  window.localStorage.setItem(WORD_COUNT_KEY, mode);
  wordCountDisplay.hidden = mode === "off";
  wordCountToggleButton.classList.toggle("is-active", mode !== "off");
  wordCountToggleButton.setAttribute("aria-label", `Counter: ${mode}`);
  updateWordCount();
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

function scheduleInlineResults() {
  window.clearTimeout(inlineResultsTimer);
  if (!getInlineQuery()) {
    inlineResults.innerHTML = "";
    inlineResults.hidden = true;
    return;
  }
  inlineResultsTimer = window.setTimeout(renderInlineResults, INLINE_RESULTS_DELAY);
}

function renderInlineResults() {
  const inlineQuery = getInlineQuery();
  inlineResults.innerHTML = "";
  inlineResults.hidden = !inlineQuery;

  if (!inlineQuery) {
    return;
  }

  const entries = getEntriesForQuery({ search: inlineQuery.query });
  if (!entries.length) {
    inlineResults.innerHTML = '<p class="empty-state">No matching blocks.</p>';
    return;
  }

  renderEntries(inlineResults, entries, { highlightTerm: inlineQuery.query, mode: "inline" });
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

function renderEntries(container, entries, options = {}) {
  const { selectResults = false, highlightTerm = "", mode = "search" } = options;
  let lastGroup = null;

  entries.forEach((entry) => {
    const group = getDateGroup(entry.createdAt);
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
    body.innerHTML = highlightMatches(entry.text, highlightTerm);
    card.dataset.entryId = entry.id;

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
      saveEntry(entry);
      applyPinState();
      composerHint.textContent = entry.pinned ? "Pinned" : "Unpinned";
      if (state.preset === "pinned") {
        render();
      }
    });

    fragment.querySelector(".copy-button").addEventListener("click", async (event) => {
      event.stopPropagation();
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(entry.text);
        composerHint.textContent = "Block copied";
        flashCopied(button);
      } catch {
        composerHint.textContent = "Copy failed";
      }
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

function clearInlineQuery() {
  const trimmed = entryInput.value.trimEnd();
  if (!trimmed.endsWith("//")) {
    return;
  }

  const withoutQueryMarker = trimmed.slice(0, -2).trimEnd();
  setEditorValue(withoutQueryMarker);
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
  queueDraftSave();
  updateWordCount();
  renderEditorSuggestions();
  render();
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
  return SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(lowered));
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

function getSearchSuggestions() {
  if (!state.search) {
    return [];
  }

  return getStructuredSuggestions(state.search);
}

function applySuggestion(suggestion) {
  state.search = suggestion;
  state.selectedSuggestionIndex = 0;
  searchInput.value = suggestion;
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

function highlightMatches(text, term) {
  if (!term) {
    return escapeHtml(text);
  }

  const normalizedTerm = term.startsWith("#") ? term : term;
  const escapedTerm = escapeRegExp(normalizedTerm);
  if (!escapedTerm) {
    return escapeHtml(text);
  }

  return escapeHtml(text).replace(
    new RegExp(`(${escapedTerm})`, "gi"),
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
  themeToggleButton.textContent = theme === "dark" ? "☾" : "☀";
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

function openInterestCard() {
  let alreadyRegistered = false;
  try {
    alreadyRegistered = Boolean(window.localStorage.getItem(INTEREST_KEY));
  } catch {
    alreadyRegistered = false;
  }

  if (alreadyRegistered) {
    showInterestThanks();
  } else {
    showInterestForm();
  }

  interestOverlay.hidden = false;

  window.requestAnimationFrame(() => {
    if (alreadyRegistered) {
      interestDoneButton.focus();
    } else {
      interestEmailInput.focus();
    }
  });
}

function closeInterestCard() {
  interestOverlay.hidden = true;
  interestErrorEl.hidden = true;
  interestErrorEl.textContent = "";
  interestEmailInput.value = "";
  if (!state.vaultView) {
    entryInput.focus();
  }
}

function showInterestForm() {
  interestForm.hidden = false;
  interestThanks.hidden = true;
}

function showInterestThanks() {
  interestForm.hidden = true;
  interestThanks.hidden = false;
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

async function exportEntries() {
  if (state.encryption.enabled && !state.encryption.unlocked) {
    composerHint.textContent = "Unlock your vault to export.";
    return;
  }

  if (!state.entries.length) {
    composerHint.textContent = "Nothing to export";
    return;
  }

  if (state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey) {
    const saltPass = await getMeta(ENC_SALT_PASS_KEY);
    const saltRecovery = await getMeta(ENC_SALT_RECOVERY_KEY);
    const wrappedPass = await getMeta(ENC_WRAPPED_PASS_KEY);
    const wrappedRecovery = await getMeta(ENC_WRAPPED_RECOVERY_KEY);
    const verify = await getMeta(ENC_VERIFY_KEY);
    if (!saltPass || !saltRecovery || !wrappedPass || !wrappedRecovery || !verify) {
      composerHint.textContent = "Vault metadata missing — cannot export.";
      return;
    }
    const iterationsPass = await readIterations(ENC_ITERATIONS_PASS_KEY);
    const iterationsRecovery = await readIterations(ENC_ITERATIONS_RECOVERY_KEY);

    const combined = await encryptPlaintext(
      JSON.stringify(state.entries),
      state.encryption.masterKey,
    );
    const combinedBytes = base64ToBytes(combined);
    const iv = bytesToBase64(combinedBytes.slice(0, 12));
    const ciphertext = bytesToBase64(combinedBytes.slice(12));

    const fileObj = {
      format: "txtshell-encrypted-v1",
      createdAt: new Date().toISOString(),
      saltPass,
      saltRecovery,
      iterationsPass,
      iterationsRecovery,
      wrappedPass,
      wrappedRecovery,
      verify,
      iv,
      ciphertext,
    };

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
    composerHint.textContent = `Exported ${state.entries.length} blocks (encrypted)`;
    return;
  }

  const content = JSON.stringify(state.entries, null, 2);
  const timestamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `txtshell-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  composerHint.textContent = `Exported ${state.entries.length} blocks (plaintext)`;
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
  for (const item of items) {
    if (typeof item.id !== "string" || typeof item.text !== "string" || typeof item.createdAt !== "string") {
      skipped++;
      continue;
    }
    if (item.text.length > MAX_IMPORT_ENTRY_TEXT) {
      skipped++;
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
    };
    const existing = state.entries.find((e) => e.id === entry.id);
    if (existing) {
      if (new Date(entry.createdAt) > new Date(existing.createdAt)) {
        Object.assign(existing, entry);
        await saveEntry(existing);
        updated++;
      }
    } else {
      state.entries.push(entry);
      await saveEntry(entry);
      added++;
    }
  }
  state.entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  render();
  if (added === 0 && updated === 0) {
    composerHint.textContent = skipped > 0
      ? `No new entries to import (${skipped} skipped — oversized or malformed)`
      : "No new entries to import";
  } else {
    const parts = [];
    if (added > 0) parts.push(`${added} new`);
    if (updated > 0) parts.push(`${updated} updated`);
    if (skipped > 0) parts.push(`${skipped} skipped (oversized or malformed)`);
    composerHint.textContent = `Imported ${parts.join(", ")}`;
  }
}

function beginEncryptedImport(fileData) {
  state.vaultPending = { importFileData: fileData };
  state.vaultView = "import-unlock";
  renderVault();
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

let readySignalSent = false;
function signalReady() {
  if (readySignalSent) return;
  if (isVaultLocked()) return;
  readySignalSent = true;
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

async function decryptAllEntriesIntoState() {
  const raw = await getAllEntries();
  const decrypted = [];
  for (const record of raw) {
    try {
      const text = await decryptCiphertext(record.text, state.encryption.masterKey);
      decrypted.push({
        id: record.id,
        text,
        tags: extractTags(text),
        mentions: extractMentions(text),
        createdAt: record.createdAt,
        editedAt: record.editedAt || record.createdAt,
        pinned: record.pinned === true,
      });
    } catch (error) {
      console.error("Failed to decrypt entry", record.id, error);
    }
  }
  decrypted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  state.entries = decrypted;
}

async function cleanupOrphanedEntries() {
  if (isVaultLocked()) {
    console.warn("Cannot run cleanup while vault is locked — would delete all encrypted entries. Unlock first.");
    return;
  }
  if (state.entries.length === 0) {
    console.warn("Cannot run cleanup with empty state.entries — refusing to proceed.");
    return;
  }
  const raw = await getAllEntries();
  const known = new Set(state.entries.map((e) => e.id));
  let removed = 0;
  for (const record of raw) {
    if (!known.has(record.id)) {
      await removeEntry(record.id);
      removed++;
    }
  }
  console.log(`[txtshell] cleanupOrphanedEntries: removed ${removed} orphaned ${removed === 1 ? "entry" : "entries"}`);
}

function updateLockButton() {
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
  lockButton.setAttribute("aria-label", locked ? "Vault locked" : "Lock vault");
  lockButton.setAttribute("title", locked ? "Vault locked" : "Lock vault");
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
  state.entries = [];
  state.search = "";
  state.preset = null;
  state.selectedEntryId = null;
  state.editingEntryId = null;
  state.pendingDeletedEntries = null;
  setEditorValue("");
  clearDraft();
  if (state.searchMode) {
    closeSearchMode();
  }
  state.vaultView = "unlock";
  state.vaultPending = null;
  renderVault();
  updateLockButton();
  composerHint.textContent = "Vault locked";
  render();
}

function renderVault() {
  clearUnlockCountdown();
  clearMirrorDismiss();
  const view = state.vaultView;
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
    renderUnlockCard(false);
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
      subtitle: "Enter your passphrase. Your blocks will be restored to plaintext in local storage.",
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
  }
}

const LOCK_ICON_SVG = `<svg class="vault-icon" width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
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
      <p class="vault-title">Vault locked</p>
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
      <p class="vault-title">Vault locked</p>
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

function renderWipeCard(isRecovery) {
  const hasVault = state.encryption.enabled;
  const placeholder = isRecovery ? "Recovery key" : "Passphrase";
  const linkText = isRecovery ? "Use passphrase instead" : "Use recovery key instead";

  const authFieldHtml = hasVault
    ? `<input class="vault-input" data-field="pass" type="${isRecovery ? "text" : "password"}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />`
    : "";
  const toggleHtml = hasVault
    ? `<button class="vault-link" type="button" data-action="toggle">${escapeHtml(linkText)}</button>`
    : "";

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Wipe all data</p>
      <p class="wipe-warning">This will permanently delete all your blocks and vault metadata from this browser. This cannot be undone.</p>
      <p class="vault-error" hidden></p>
      ${authFieldHtml}
      <input class="vault-input" data-field="confirm" type="text" placeholder="Type DELETE EVERYTHING" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <button class="vault-button danger" type="button" data-action="submit" disabled>Wipe everything</button>
      ${toggleHtml}
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const confirmInput = vaultOverlay.querySelector('[data-field="confirm"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const toggleButton = vaultOverlay.querySelector('[data-action="toggle"]');
  const cancelButton = vaultOverlay.querySelector('[data-action="cancel"]');

  const showError = (message) => {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  };

  const updateEnabled = () => {
    const phraseOk = confirmInput.value === WIPE_CONFIRM_PHRASE;
    const authOk = !hasVault || (passInput && passInput.value.trim().length > 0);
    submitButton.disabled = !(phraseOk && authOk);
  };

  const submit = async () => {
    if (submitButton.disabled) {
      return;
    }
    showError("");
    submitButton.disabled = true;
    submitButton.textContent = "Wiping…";
    try {
      await handleWipeSubmit(passInput ? passInput.value.trim() : "", isRecovery, confirmInput.value);
    } catch (error) {
      const message = error?.message === "locked-out"
        ? "Too many attempts. Use the recovery key, or wait."
        : (error?.message === "wrong-key" || error?.message === "missing-meta"
          ? "Couldn't verify — passphrase or recovery key may be wrong"
          : "Something went wrong. Try again.");
      showError(message);
      submitButton.textContent = "Wipe everything";
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
  submitButton.addEventListener("click", submit);
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

async function handleWipeSubmit(value, isRecovery, confirmPhrase) {
  if (confirmPhrase !== WIPE_CONFIRM_PHRASE) {
    throw new Error("phrase-mismatch");
  }

  if (state.encryption.enabled) {
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
      if (!isRecovery) {
        await recordUnlockFailure();
      }
      throw error;
    }
  }

  await performWipe();
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => {
      console.warn("[txtshell] deleteDatabase blocked — another tab may still have it open");
    });
  });
}

async function performWipe() {
  if (state.db) {
    state.db.close();
    state.db = null;
  }
  await deleteDatabase(DB_NAME);

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

  state.entries = [];
  state.encryption = { enabled: false, unlocked: false, masterKey: null };
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

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Import encrypted blocks</p>
      <p class="vault-subtitle">${escapeHtml(subtitle)}</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="pass" type="${isRecovery ? "text" : "password"}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />
      <button class="vault-button" type="button" data-action="submit">Import</button>
      <button class="vault-link" type="button" data-action="toggle">${escapeHtml(linkText)}</button>
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
  toggleButton.addEventListener("click", () => {
    state.vaultView = isRecovery ? "import-unlock" : "import-unlock-recovery";
    renderVault();
  });
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

  const ivBytes = base64ToBytes(file.iv);
  const ctBytes = base64ToBytes(file.ciphertext);
  const combined = new Uint8Array(ivBytes.length + ctBytes.length);
  combined.set(ivBytes, 0);
  combined.set(ctBytes, ivBytes.length);
  const blocksJson = await decryptCiphertext(bytesToBase64(combined), masterKey);
  let entries;
  try {
    entries = JSON.parse(blocksJson);
    if (!Array.isArray(entries)) throw new Error("not-array");
  } catch {
    throw new Error("malformed-payload");
  }

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

function renderImportAdoptCard() {
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG_DOT}
      <p class="vault-title">Set up vault on this browser?</p>
      <p class="vault-subtitle">This file is from an encrypted Txtshell vault. Use it to set up encryption on this browser too?</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="setup">Set up vault</button>
      <button class="vault-button secondary" type="button" data-action="plain">Just import blocks (no encryption)</button>
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
  await saveMetaBatch([
    [ENC_SALT_PASS_KEY, file.saltPass],
    [ENC_SALT_RECOVERY_KEY, file.saltRecovery],
    [ENC_WRAPPED_PASS_KEY, file.wrappedPass],
    [ENC_WRAPPED_RECOVERY_KEY, file.wrappedRecovery],
    [ENC_VERIFY_KEY, file.verify],
    [ENC_ITERATIONS_PASS_KEY, String(Math.max(file.iterationsPass || file.iterations || PBKDF2_ITERATIONS, MIN_IMPORT_ITERATIONS))],
    [ENC_ITERATIONS_RECOVERY_KEY, String(Math.max(file.iterationsRecovery || file.iterations || PBKDF2_ITERATIONS, MIN_IMPORT_ITERATIONS))],
  ]);
  state.encryption.enabled = true;
  state.encryption.unlocked = true;
  state.encryption.masterKey = pending.importMasterKey;
  updateLockButton();
  await mergeImportedEntries(pending.importEntries);
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  composerHint.textContent = "Vault set up — blocks imported";
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
    await saveMeta(ENC_SALT_PASS_KEY, bytesToBase64(pending.saltPass));
    await saveMeta(ENC_SALT_RECOVERY_KEY, bytesToBase64(pending.saltRecovery));
    await saveMeta(ENC_WRAPPED_PASS_KEY, pending.wrappedPass);
    await saveMeta(ENC_WRAPPED_RECOVERY_KEY, pending.wrappedRecovery);
    await saveMeta(ENC_VERIFY_KEY, pending.verify);
    await saveMeta(ENC_ITERATIONS_PASS_KEY, String(PBKDF2_ITERATIONS));
    await saveMeta(ENC_ITERATIONS_RECOVERY_KEY, String(PBKDF2_ITERATIONS));

    state.encryption.enabled = true;
    state.encryption.unlocked = true;
    state.encryption.masterKey = pending.masterKey;

    for (const entry of state.entries) {
      await saveEntry(entry);
    }

    await deleteMeta(DRAFT_KEY);

    state.vaultView = null;
    state.vaultPending = null;
    renderVault();
    updateLockButton();
    composerHint.textContent = "Encryption on";
    render();
    entryInput.focus();
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
    if (!isRecovery) {
      await recordUnlockFailure();
    }
    throw error;
  }
  if (!isRecovery) {
    await resetUnlockState();
  }

  state.encryption.masterKey = masterKey;
  state.encryption.unlocked = true;
  await decryptAllEntriesIntoState();

  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  updateLockButton();
  composerHint.textContent = "Vault unlocked";
  render();
  entryInput.focus();
  signalReady();

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
      await decryptAllEntriesIntoState();
    }
    const plaintextEntries = state.entries.map((entry) => ({
      ...entry,
      tags: extractTags(entry.text),
      mentions: extractMentions(entry.text),
    }));

    state.encryption.enabled = false;
    state.encryption.unlocked = false;
    state.encryption.masterKey = null;
    state.entries = plaintextEntries;

    for (const entry of plaintextEntries) {
      await saveEntry(entry);
    }

    await deleteMeta(ENC_SALT_PASS_KEY);
    await deleteMeta(ENC_SALT_RECOVERY_KEY);
    await deleteMeta(ENC_WRAPPED_PASS_KEY);
    await deleteMeta(ENC_WRAPPED_RECOVERY_KEY);
    await deleteMeta(ENC_VERIFY_KEY);
    await deleteMeta(ENC_ITERATIONS_PASS_KEY);
    await deleteMeta(ENC_ITERATIONS_RECOVERY_KEY);

    state.vaultView = null;
    state.vaultPending = null;
    renderVault();
    updateLockButton();
    composerHint.textContent = "Encryption off";
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
  if (parsed.protocol !== "https:") return null; // Worker is HTTPS-only
  return trimmed.replace(/\/+$/, "");
}

function setSyncStatus(status) {
  // Local save is canonical; only surface failures (non-blocking). Success is silent
  // to avoid a toast on every debounced save.
  if (status === "error") {
    showStatusToast("Sync failed — saved locally", { isHint: true });
  } else if (status === "auth") {
    showStatusToast("Sync auth failed — check /sync setup", { isHint: true });
  }
}

let cloudSyncTimer = null;
let cloudSyncInFlight = false;

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
async function flushCloudSync() {
  if (cloudSyncInFlight) {
    // A save landed during an in-flight upload; re-arm so the latest state ships next.
    scheduleCloudSync();
    return { status: "skipped", reason: "in-flight" };
  }
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) {
    return { status: "skipped", reason: "locked" };
  }
  const { workerUrl, authToken } = await getSyncConfig();
  if (!workerUrl || !authToken) {
    return { status: "skipped", reason: "not-configured" }; // nothing to do, no error
  }

  let body;
  try {
    // Reuse the exact AES-GCM path used by encrypted export: base64(IV(12) || ct+tag).
    // Upload the raw bytes of that blob; iOS splits the 12-byte IV prefix and decrypts.
    const base64Blob = await encryptPlaintext(
      JSON.stringify(state.entries),
      state.encryption.masterKey,
    );
    body = base64ToBytes(base64Blob);
  } catch (error) {
    console.error("[txtshell] cloud sync encrypt failed", error);
    setSyncStatus("error");
    return { status: "error", reason: "encrypt-failed" };
  }

  cloudSyncInFlight = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLOUD_SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(`${workerUrl}/v1/blocks`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/octet-stream",
      },
      body,
      signal: controller.signal,
    });
    if (response.status === 401) {
      setSyncStatus("auth");
      return { status: "auth" };
    } else if (!response.ok) {
      setSyncStatus("error");
      return { status: "error", reason: "http-" + response.status };
    } else {
      setSyncStatus("ok");
      return { status: "ok" };
    }
  } catch (error) {
    // Network down, aborted, or CSP block — the local save already succeeded.
    console.warn("[txtshell] cloud sync upload failed", error);
    setSyncStatus("error");
    return { status: "error", reason: error && error.name === "AbortError" ? "timeout" : "network" };
  } finally {
    window.clearTimeout(timeout);
    cloudSyncInFlight = false;
  }
}

// Human-readable tail for "Sync failed — …" hints, mapped from flushCloudSync reasons.
function describeSyncError(reason) {
  switch (reason) {
    case "encrypt-failed":
      return "couldn't encrypt blocks";
    case "timeout":
      return "request timed out";
    case "network":
      return "network error";
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
  if (result.status === "skipped") {
    // Vault locked or an upload already in flight — config saved, nothing pushed.
    composerHint.textContent = "Sync configured — unlock to upload existing blocks";
    return;
  }

  // PUT succeeded. Read back for a concrete count, but R2 is read-after-write
  // lossy right after a PUT — a 404 / stale bytes / decrypt hiccup here is NOT a
  // failure, so fall back to a soft confirm rather than reporting it as broken.
  try {
    const readback = await fetchAndDecryptBlocks();
    if (readback.empty) {
      composerHint.textContent = "Uploaded — will confirm on next sync";
    } else {
      const n = readback.entries.length;
      composerHint.textContent = `Synced — ${n} block${n === 1 ? "" : "s"} in the cloud`;
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
  try {
    const response = await fetch(`${url}/v1/blocks`, {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    });
    if (response.status === 404) {
      return { empty: true };
    }
    if (response.status === 401) {
      throw new Error("auth");
    }
    if (!response.ok) {
      throw new Error("http-" + response.status);
    }
    buffer = await response.arrayBuffer();
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
  return { empty: false, entries };
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
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(normalized);
}

function entriesDiffer(cloud, local) {
  return canonicalizeEntries(cloud) !== canonicalizeEntries(local);
}

function clearAllEntryRecords() {
  if (!state.db) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(ENTRY_STORE, "readwrite");
    transaction.objectStore(ENTRY_STORE).clear();
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

// Manual fetch. Requires an unlocked vault. Compares the cloud blob to local and
// either no-ops ("up to date") or raises the conflict card.
async function beginPull() {
  if (!(state.encryption.enabled && state.encryption.unlocked && state.encryption.masterKey)) {
    composerHint.textContent = "Unlock your vault to pull.";
    return;
  }
  composerHint.textContent = "Pulling…";
  try {
    const result = await fetchAndDecryptBlocks();
    if (result.empty) {
      composerHint.textContent = "Cloud is empty — nothing to pull.";
      return;
    }
    if (entriesDiffer(result.entries, state.entries)) {
      showPullConflict(result.entries);
    } else {
      composerHint.textContent = "Already up to date.";
    }
  } catch (error) {
    composerHint.textContent = pullErrorMessage(error);
  }
}

// Non-blocking background fetch fired after a successful unlock. Failures surface as a
// hint toast and are otherwise ignored; an empty cloud is a silent no-op. Only prompts
// when the normal view is showing, so it never clobbers an open vault card.
async function autoPullOnUnlock() {
  try {
    const result = await fetchAndDecryptBlocks();
    if (result.empty) return;
    if (!state.encryption.unlocked || state.vaultView) return; // user moved on; catch it next time
    if (entriesDiffer(result.entries, state.entries)) {
      showPullConflict(result.entries);
    }
  } catch (error) {
    if (error?.message === "not-configured") return; // sync not set up — nothing to fetch
    showStatusToast("Couldn't fetch updates from cloud", { isHint: true });
  }
}

function pullErrorMessage(error) {
  switch (error?.message) {
    case "not-configured":
      return "Sync not configured — run /sync setup.";
    case "auth":
      return "Sync auth failed — check /sync setup.";
    case "decrypt":
      return "Couldn't decrypt cloud blocks.";
    case "locked":
      return "Unlock your vault to pull.";
    default:
      return "Couldn't reach cloud. Try again.";
  }
}

function showPullConflict(cloudEntries) {
  state.vaultPending = { pullEntries: cloudEntries };
  state.vaultView = "pull-conflict";
  renderVault();
}

function renderPullConflictCard() {
  const cloudEntries = state.vaultPending?.pullEntries;
  if (!Array.isArray(cloudEntries)) {
    exitVaultToNormal();
    return;
  }
  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Cloud has changes</p>
      <p class="vault-subtitle">Another device saved changes to the cloud. Replace this browser's blocks with the cloud copy?</p>
      <p class="vault-error" hidden></p>
      <button class="vault-button" type="button" data-action="replace">Replace with cloud</button>
      <button class="vault-button secondary" type="button" data-action="keep">Keep local</button>
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
  keepButton.addEventListener("click", () => {
    // Last-writer-wins: the next local save overwrites the cloud blob.
    state.vaultPending = null;
    exitVaultToNormal();
    composerHint.textContent = "Kept local — your next save overwrites cloud.";
  });
}

async function applyCloudReplaceLocal(cloudEntries) {
  await clearAllEntryRecords();
  state.entries = [];
  const before = state.entries.length;
  await mergeImportedEntries(cloudEntries); // validates shape, re-encrypts via saveEntry
  const count = state.entries.length - before;
  state.vaultView = null;
  state.vaultPending = null;
  renderVault();
  composerHint.textContent = `Replaced local with cloud (${count} block${count === 1 ? "" : "s"}).`;
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
    if (result.empty) {
      composerHint.textContent = "Paired — cloud is empty, nothing to load yet.";
    } else {
      await mergeImportedEntries(result.entries);
      composerHint.textContent = `Paired — ${state.entries.length} block${state.entries.length === 1 ? "" : "s"} loaded.`;
    }
  } catch (error) {
    console.warn("[txtshell] initial port pull failed", error);
    composerHint.textContent = "Couldn't fetch blocks yet — will retry on unlock.";
  }
  signalReady();
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
      throw new Error("auth");
    }
    if (!response.ok) {
      throw new Error("http-" + response.status);
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
  const visible = raw.filter((e) => e && e.id && !inboxPendingDeleteIds.has(e.id));
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
    entries.push({ id: e.id, createdAt: e.createdAt || "", text, decryptOk });
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
