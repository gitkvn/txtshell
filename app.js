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
const ENC_VERIFY_PLAINTEXT = "txtshell-verify-v1";
const PBKDF2_ITERATIONS = 100000;

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
const DELETE_UNDO_TIMEOUT = 5000;
const COPY_FLASH_DURATION = 900;
const DELETE_CONFIRM_TIMEOUT = 2000;
const TOAST_DURATION = 3000;
const HINT_TOAST_DURATION = 6000;

const state = {
  db: null,
  entries: [],
  searchMode: false,
  search: "",
  preset: null,
  editingEntryId: null,
  selectedEntryId: null,
  pendingDeletedEntry: null,
  selectedSuggestionIndex: 0,
  editorSelectedSuggestionIndex: 0,
  encryption: {
    enabled: false,
    unlocked: false,
    masterKey: null,
  },
  vaultView: null,
  vaultPending: null,
  targetCount: null,
};

const RE_TARGET_COMMAND = /^\/target(?:\s+(\d+))?$/;

const composerForm = document.querySelector("#composerForm");
const entryInput = document.querySelector("#entryInput");
const editorSuggestions = document.querySelector("#editorSuggestions");
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

  if (target.closest("#searchMode, .copy-button, #searchInput, #editorSuggestions, #vaultOverlay, #lockButton, #interestOverlay, #findReplaceBar")) {
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

exportButton.addEventListener("click", (event) => {
  if (!state.entries.length) {
    composerHint.textContent = "Nothing to export";
    return;
  }
  if (event.shiftKey) {
    exportEntries("txt");
  } else {
    exportEntries("json");
  }
});

searchUndoDeleteButton.addEventListener("click", () => {
  undoDelete();
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
    closeSearchMode();
    return;
  }

  handleSearchKeyboard(event);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    handleGlobalShortcut(event);
    return;
  }

  if (!interestOverlay.hidden) {
    event.preventDefault();
    closeInterestCard();
    return;
  }

  if (!findReplaceBar.hidden) {
    event.preventDefault();
    closeFindReplace();
    return;
  }

  if (state.searchMode) {
    event.preventDefault();
    closeSearchMode();
    return;
  }

  if (getInlineQuery()) {
    event.preventDefault();
    clearInlineQuery();
    return;
  }

  if (state.editingEntryId) {
    event.preventDefault();
    state.editingEntryId = null;
    setEditorValue("");
    clearDraft();
    composerHint.textContent = "Edit discarded";
    render();
  }
});

entryInput.addEventListener("keydown", (event) => {
  if (handleEditorSuggestionKeyboard(event)) {
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    indentSelection(event.shiftKey ? "outdent" : "indent");
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    reopenEntryInEditor(state.entries[0]?.id);
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/y") {
    event.preventDefault();
    submitComposer();
    return;
  }

  if (event.key === "Enter" && entryInput.value.trim() === "/w") {
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

  if (event.key === "Enter" && RE_TARGET_COMMAND.test(entryInput.value.trim())) {
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

function submitComposer() {
  if (isVaultLocked()) {
    return;
  }

  const text = entryInput.value.trim();
  if (!text) {
    composerHint.textContent = "Block cannot be saved empty";
    return;
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

  if (text === "/re") {
    reopenEntryInEditor(state.entries[0]?.id);
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

  const targetMatch = text.match(RE_TARGET_COMMAND);
  if (targetMatch) {
    const raw = targetMatch[1];
    const parsed = raw ? parseInt(raw, 10) : 0;
    if (!parsed) {
      state.targetCount = null;
      composerHint.textContent = "Target cleared";
    } else {
      state.targetCount = parsed;
      composerHint.textContent = `Target set to ${parsed}`;
    }
    setEditorValue("");
    clearDraft();
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
      saveEntry(existingEntry);
      setEditorValue("");
      clearDraft();
      composerHint.textContent = "Updated";
      state.editingEntryId = null;
      render();
      return;
    }
  }

  const entry = {
    id: crypto.randomUUID(),
    text,
    tags: extractTags(text),
    mentions: extractMentions(text),
    createdAt: new Date().toISOString(),
    pinned: false,
  };
  state.entries.unshift(entry);
  saveEntry(entry);
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

  if (key === "h") {
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
  scheduleInlineResults();

  if (!state.searchMode) {
    return;
  }

  searchUndoDeleteButton.hidden = !state.pendingDeletedEntry;
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
  searchInput.hidden = false;
  searchInputLabel.hidden = false;
  searchSuggestions.hidden = true;
  composerHint.textContent = state.editingEntryId ? "Editing block -> save updates" : "Ready";
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
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
  closeSearchMode();
  composerHint.textContent = "Editing block -> save updates";
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
  showHint("edit-mode", "Press Esc to cancel editing");
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
    }));
    const draft = await getMeta(DRAFT_KEY);
    if (draft) {
      setEditorValue(draft);
      composerHint.textContent = "Draft restored";
      entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
    }
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
      pinned: entry.pinned === true,
    };
  }
  await putEntryRecord(record);
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
  state.pendingDeletedEntry = { entry: deletedEntry, index: deletedIndex };
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
  return state.entries.filter((entry) => {
    if (preset === "quickref" || preset === "about") {
      return false;
    }
    if (preset === "yesterday") {
      return isYesterday(entry.createdAt);
    }
    if (preset === "week") {
      return isLastWeek(entry.createdAt);
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
  if (!state.pendingDeletedEntry) {
    return;
  }

  const { entry, index } = state.pendingDeletedEntry;
  state.entries.splice(index, 0, entry);
  saveEntry(entry);
  state.selectedEntryId = entry.id;
  composerHint.textContent = "Delete undone";
  clearPendingDelete();
  render();
  window.requestAnimationFrame(() => {
    scrollSelectedIntoView();
  });
}

function clearPendingDelete() {
  window.clearTimeout(deleteUndoTimer);
  deleteUndoTimer = null;
  state.pendingDeletedEntry = null;
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
  if (state.preset === "week") {
    return `Last week${suffix}`;
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
    wordCountDisplay.textContent = `${count} / ${target} ${unit}`;
    const isOver = count > target;
    const isNear = !isOver && count >= target * 0.9;
    wordCountDisplay.classList.toggle("is-near-target", isNear);
    wordCountDisplay.classList.toggle("is-over-target", isOver);
  } else {
    wordCountDisplay.textContent = `${count} ${unit}`;
    wordCountDisplay.classList.remove("is-near-target", "is-over-target");
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

  if (event.key === "Escape") {
    event.preventDefault();
    editorSuggestions.hidden = true;
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
    .replaceAll(">", "&gt;");
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
  if (!message || message === "Ready" || message === "Editing block -> save updates") {
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

function exportEntries(format) {
  const timestamp = new Date().toISOString().slice(0, 10);
  let content, filename, type;

  if (format === "json") {
    content = JSON.stringify(state.entries, null, 2);
    filename = `txtshell-${timestamp}.json`;
    type = "application/json";
  } else {
    content = state.entries
      .map((entry) => `[${entry.createdAt}]\n${entry.text}`)
      .join("\n\n---\n\n");
    filename = `txtshell-${timestamp}.txt`;
    type = "text/plain";
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  composerHint.textContent = `Exported ${state.entries.length} blocks as ${format.toUpperCase()}`;
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
    if (!Array.isArray(data)) {
      composerHint.textContent = "Invalid import file";
      return;
    }
    let added = 0;
    let updated = 0;
    for (const item of data) {
      if (typeof item.id !== "string" || typeof item.text !== "string" || typeof item.createdAt !== "string") {
        continue;
      }
      const entry = {
        id: item.id,
        text: item.text,
        tags: extractTags(item.text),
        mentions: extractMentions(item.text),
        createdAt: item.createdAt,
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
      composerHint.textContent = "No new entries to import";
    } else {
      const parts = [];
      if (added > 0) parts.push(`${added} new`);
      if (updated > 0) parts.push(`${updated} updated`);
      composerHint.textContent = `Imported ${parts.join(", ")}`;
    }
  });
  fileInput.click();
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
    return;
  }
  const transaction = state.db.transaction(ENTRY_STORE, "readwrite");
  transaction.objectStore(ENTRY_STORE).delete(entryId);
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

async function deriveWrappingKey(passphrase, saltBytes) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function generateMasterKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function wrapMasterKey(masterKey, wrappingKey) {
  const rawMaster = await crypto.subtle.exportKey("raw", masterKey);
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    rawMaster,
  );
  return bytesToBase64(combineIvAndData(iv, new Uint8Array(ciphertext)));
}

async function unwrapMasterKey(base64, wrappingKey) {
  const combined = base64ToBytes(base64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const rawMaster = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    ciphertext,
  );
  return crypto.subtle.importKey(
    "raw",
    rawMaster,
    { name: "AES-GCM", length: 256 },
    true,
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
    return true;
  }
  const plaintext = await decryptCiphertext(verifyBase64, masterKey);
  return plaintext === ENC_VERIFY_PLAINTEXT;
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
        pinned: record.pinned === true,
      });
    } catch (error) {
      console.error("Failed to decrypt entry", record.id, error);
    }
  }
  decrypted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  state.entries = decrypted;
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
  state.pendingDeletedEntry = null;
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
  }
}

const LOCK_ICON_SVG = `<svg class="vault-icon" width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const LOCK_ICON_SVG_DOT = `<svg class="vault-icon" width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="12.5" r="1.2" fill="currentColor"/></svg>`;

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
      <input class="vault-input" data-field="confirm" type="password" placeholder="Confirm passphrase" autocomplete="new-password" />
      <button class="vault-button" type="button" data-action="submit">${escapeHtml(buttonText)}</button>
      <button class="vault-link" type="button" data-action="cancel">Cancel</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const confirmInput = vaultOverlay.querySelector('[data-field="confirm"]');
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
    if (!pass || pass.length < 4) {
      showError("Use at least 4 characters.");
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

function renderUnlockCard(isRecovery) {
  const subtitle = isRecovery
    ? "Paste your recovery key to unlock."
    : "Enter your passphrase to unlock";
  const placeholder = isRecovery ? "Recovery key" : "Passphrase";
  const linkText = isRecovery ? "Use passphrase instead" : "Use recovery key instead";

  vaultOverlay.innerHTML = `
    <div class="vault-card">
      ${LOCK_ICON_SVG}
      <p class="vault-title">Vault locked</p>
      <p class="vault-subtitle">${escapeHtml(subtitle)}</p>
      <p class="vault-error" hidden></p>
      <input class="vault-input" data-field="pass" type="${isRecovery ? "text" : "password"}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />
      <button class="vault-button" type="button" data-action="submit">Unlock</button>
      <button class="vault-link" type="button" data-action="toggle">${escapeHtml(linkText)}</button>
    </div>
  `;

  const passInput = vaultOverlay.querySelector('[data-field="pass"]');
  const errorLine = vaultOverlay.querySelector(".vault-error");
  const submitButton = vaultOverlay.querySelector('[data-action="submit"]');
  const toggleButton = vaultOverlay.querySelector('[data-action="toggle"]');

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
    try {
      await handleUnlockSubmit(value, isRecovery);
    } catch (error) {
      const message = error?.message === "wrong-key"
        ? (isRecovery ? "Recovery key did not work. Try again." : "Wrong passphrase. Try again.")
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
  toggleButton.addEventListener("click", () => {
    state.vaultView = isRecovery ? "unlock" : "unlock-recovery";
    renderVault();
  });
  window.requestAnimationFrame(() => passInput.focus());
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
  const wrappingPass = await deriveWrappingKey(passphrase, saltPass);
  const recoveryKey = generateRecoveryKey();
  const wrappingRecovery = await deriveWrappingKey(recoveryKey, saltRecovery);
  const masterKey = await generateMasterKey();
  const wrappedPass = await wrapMasterKey(masterKey, wrappingPass);
  const wrappedRecovery = await wrapMasterKey(masterKey, wrappingRecovery);
  const verify = await encryptPlaintext(ENC_VERIFY_PLAINTEXT, masterKey);

  state.vaultPending = {
    saltPass,
    saltRecovery,
    wrappedPass,
    wrappedRecovery,
    verify,
    masterKey,
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
  const saltKey = isRecovery ? ENC_SALT_RECOVERY_KEY : ENC_SALT_PASS_KEY;
  const wrappedKey = isRecovery ? ENC_WRAPPED_RECOVERY_KEY : ENC_WRAPPED_PASS_KEY;
  const saltBase64 = await getMeta(saltKey);
  const wrappedBase64 = await getMeta(wrappedKey);
  if (!saltBase64 || !wrappedBase64) {
    throw new Error("missing-meta");
  }
  const wrappingKey = await deriveWrappingKey(value, base64ToBytes(saltBase64));
  let masterKey;
  try {
    masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey);
  } catch {
    throw new Error("wrong-key");
  }
  const verified = await verifyMasterKey(masterKey);
  if (!verified) {
    throw new Error("wrong-key");
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
}

async function handleChangeCurrentSubmit(passphrase) {
  const saltBase64 = await getMeta(ENC_SALT_PASS_KEY);
  const wrappedBase64 = await getMeta(ENC_WRAPPED_PASS_KEY);
  if (!saltBase64 || !wrappedBase64) {
    throw new Error("missing-meta");
  }
  const wrappingKey = await deriveWrappingKey(passphrase, base64ToBytes(saltBase64));
  let masterKey;
  try {
    masterKey = await unwrapMasterKey(wrappedBase64, wrappingKey);
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
  const wrappingKey = await deriveWrappingKey(newPassphrase, saltPass);
  const wrappedPass = await wrapMasterKey(pending.masterKey, wrappingKey);
  await saveMeta(ENC_SALT_PASS_KEY, bytesToBase64(saltPass));
  await saveMeta(ENC_WRAPPED_PASS_KEY, wrappedPass);

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
  const wrappingKey = await deriveWrappingKey(passphrase, base64ToBytes(saltBase64));
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
