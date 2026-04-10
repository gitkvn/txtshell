const DB_NAME = "txtshell";
const DB_VERSION = 1;
const ENTRY_STORE = "entries";
const META_STORE = "meta";
const DRAFT_KEY = "draft";
const ONBOARDING_KEY = "txtshell-onboarding-complete-v1";
const THEME_KEY = "txtshell-theme-v1";
const WORD_COUNT_KEY = "txtshell-word-count-v1";

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
};

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
const savedCount = document.querySelector("#savedCount");
const wordCountDisplay = document.querySelector("#wordCountDisplay");
const shortcutsLink = document.querySelector("#shortcutsLink");
const searchUndoDeleteButton = document.querySelector("#searchUndoDeleteButton");
const closeSearchButton = document.querySelector("#closeSearchButton");
const onboardingCard = document.querySelector("#onboardingCard");
const statusToast = document.querySelector("#statusToast");
const onboardingStep = document.querySelector("#onboardingStep");
const onboardingText = document.querySelector("#onboardingText");
const nextOnboardingButton = document.querySelector("#nextOnboardingButton");
const skipOnboardingButton = document.querySelector("#skipOnboardingButton");
const wordCountToggleButton = document.querySelector("#wordCountToggleButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const composerHint = document.querySelector("#composerHint");
const currentDateTime = document.querySelector("#currentDateTime");
const entryTemplate = document.querySelector("#entryTemplate");
let draftSaveTimer = null;
let deleteUndoTimer = null;
let onboardingIndex = 0;
let statusToastTimer = null;

const ONBOARDING_STEPS = [
  "Type to begin.",
  "Press Cmd/Ctrl + Enter to save a block.",
  "Press Cmd/Ctrl + K to search your saved blocks.",
  "Try /q for commands and shortcuts, or /re to reopen your latest block.",
];

window.addEventListener("load", () => {
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    entryInput.focus();
  }
});

window.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.closest("#searchMode, .copy-button, #searchInput, #editorSuggestions")) {
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

searchUndoDeleteButton.addEventListener("click", () => {
  undoDelete();
});

nextOnboardingButton.addEventListener("click", () => {
  advanceOnboarding();
});

skipOnboardingButton.addEventListener("click", () => {
  finishOnboarding();
});

wordCountToggleButton.addEventListener("click", () => {
  const enabled = document.body.dataset.wordCount === "on";
  applyWordCountMode(!enabled);
});

themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
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

  if (state.searchMode) {
    event.preventDefault();
    closeSearchMode();
    return;
  }

  if (getInlineQuery()) {
    event.preventDefault();
    clearInlineQuery();
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
applyWordCountMode(window.localStorage.getItem(WORD_COUNT_KEY) === "true");
initialize();

function submitComposer() {
  const text = entryInput.value.trim();
  if (!text) {
    composerHint.textContent = "Empty";
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
    entryInput.value = "";
    clearDraft();
    composerHint.textContent = "Yesterday";
    render();
    return;
  }

  if (text === "/w") {
    state.search = "";
    state.preset = "week";
    openSearchMode();
    entryInput.value = "";
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
    entryInput.value = "";
    clearDraft();
    composerHint.textContent = "Quick reference";
    render();
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
      entryInput.value = "";
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
  };
  state.entries.unshift(entry);
  saveEntry(entry);
  entryInput.value = "";
  clearDraft();
  composerHint.textContent = "Saved";
  render();
}

function handleGlobalShortcut(event) {
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
  searchUndoDeleteButton.hidden = !state.pendingDeletedEntry;
  quickReference.hidden = state.preset !== "quickref";
  entryList.hidden = state.preset === "quickref";
  searchModeLabel.textContent = getSearchModeLabel();
  entryList.innerHTML = "";
  renderSuggestions();
  renderInlineResults();

  const filteredEntries = getFilteredEntries();

  syncSelection(filteredEntries);

  if (!filteredEntries.length) {
    entryList.innerHTML = '<p class="empty-state">No entries yet.</p>';
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
  entryInput.value = entry.text;
  saveMeta(DRAFT_KEY, entry.text);
  closeSearchMode();
  composerHint.textContent = "Editing block -> save updates";
  entryInput.focus();
  entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
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
    state.entries = await getAllEntries();
    state.entries = state.entries.map((entry) => ({
      ...entry,
      tags: Array.isArray(entry.tags) ? entry.tags : extractTags(entry.text),
      mentions: Array.isArray(entry.mentions) ? entry.mentions : extractMentions(entry.text),
    }));
    const draft = await getMeta(DRAFT_KEY);
    if (draft) {
      entryInput.value = draft;
      composerHint.textContent = "Draft restored";
      entryInput.setSelectionRange(entryInput.value.length, entryInput.value.length);
    }
  } catch {
    composerHint.textContent = "Storage unavailable";
  }
  maybeShowOnboarding();
  render();
}

function queueDraftSave() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    saveMeta(DRAFT_KEY, entryInput.value);
  }, 180);
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

function saveEntry(entry) {
  if (!state.db) {
    return;
  }
  const transaction = state.db.transaction(ENTRY_STORE, "readwrite");
  transaction.objectStore(ENTRY_STORE).put(entry);
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
    entryInput.value = "";
    clearDraft();
  }
  removeEntry(entryId);
  composerHint.textContent = "Block deleted";
  syncSelection(getFilteredEntries());
  render();
  deleteUndoTimer = window.setTimeout(() => {
    clearPendingDelete();
    render();
  }, 3000);
}

function getFilteredEntries() {
  return getEntriesForQuery({ preset: state.preset, search: state.search });
}

function getEntriesForQuery({ preset = null, search = "" } = {}) {
  return state.entries.filter((entry) => {
    if (preset === "quickref") {
      return false;
    }
    if (preset === "yesterday") {
      return isYesterday(entry.createdAt);
    }
    if (preset === "week") {
      return isLastWeek(entry.createdAt);
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
    state.selectedEntryId = entries[Math.min(currentIndex + 1, entries.length - 1)].id;
    render();
    scrollSelectedIntoView();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.selectedEntryId = entries[Math.max(currentIndex - 1, 0)].id;
    render();
    scrollSelectedIntoView();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    toggleSelectedExpanded();
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
  }, 900);
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

function maybeShowOnboarding() {
  const completed = window.localStorage.getItem(ONBOARDING_KEY) === "true";
  if (completed) {
    onboardingCard.hidden = true;
    return;
  }

  onboardingCard.hidden = false;
  onboardingIndex = 0;
  renderOnboarding();
}

function advanceOnboarding() {
  if (onboardingIndex >= ONBOARDING_STEPS.length - 1) {
    finishOnboarding();
    return;
  }

  onboardingIndex += 1;
  renderOnboarding();
}

function renderOnboarding() {
  onboardingStep.textContent = `${onboardingIndex + 1} / ${ONBOARDING_STEPS.length}`;
  onboardingText.textContent = ONBOARDING_STEPS[onboardingIndex];
  nextOnboardingButton.textContent = onboardingIndex === ONBOARDING_STEPS.length - 1 ? "Done" : "Next";
}

function finishOnboarding() {
  window.localStorage.setItem(ONBOARDING_KEY, "true");
  onboardingCard.hidden = true;
}

function getSearchModeLabel() {
  if (state.preset === "quickref") {
    return "Quick reference";
  }
  if (state.preset === "yesterday") {
    return "Yesterday";
  }
  if (state.preset === "week") {
    return "Last week";
  }
  return "Search saved blocks";
}

function applyWordCountMode(enabled) {
  document.body.dataset.wordCount = enabled ? "on" : "off";
  window.localStorage.setItem(WORD_COUNT_KEY, String(enabled));
  wordCountDisplay.hidden = !enabled;
  wordCountToggleButton.classList.toggle("is-active", enabled);
  wordCountToggleButton.setAttribute(
    "aria-label",
    enabled ? "Hide word count" : "Show word count",
  );
  updateWordCount();
}

function updateWordCount() {
  if (wordCountDisplay.hidden) {
    return;
  }

  const text = entryInput.value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  wordCountDisplay.textContent = `${count} ${count === 1 ? "word" : "words"}`;
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

function renderEntries(container, entries, options = {}) {
  const { selectResults = false, highlightTerm = "", mode = "search" } = options;

  entries.forEach((entry) => {
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

    const tags = Array.isArray(entry.tags) ? entry.tags : extractTags(entry.text);
    const mentions = Array.isArray(entry.mentions) ? entry.mentions : extractMentions(entry.text);
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
        card.addEventListener("click", () => {
          state.selectedEntryId = entry.id;
          render();
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
        card.addEventListener("click", () => {
          state.selectedEntryId = entry.id;
          toggleExpanded();
          render();
        });
      }
    }

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
    fragment.querySelector(".delete-button").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteEntry(entry.id);
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
  entryInput.value = withoutQueryMarker;
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
  entryInput.value = `${value.slice(0, lineStart)}${updatedText}${value.slice(lineEnd)}`;

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
    const values = prefix === "#"
      ? (Array.isArray(entry.tags) ? entry.tags : extractTags(entry.text))
      : (Array.isArray(entry.mentions) ? entry.mentions : extractMentions(entry.text));

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
  const match = beforeCaret.match(/(^|\s)([#@][a-z0-9_-]*)$/i);
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

  entryInput.value = `${currentValue.slice(0, context.start)}${completedSuggestion}${currentValue.slice(context.end)}`;
  const nextCaret = context.start + completedSuggestion.length;
  entryInput.focus();
  entryInput.setSelectionRange(nextCaret, nextCaret);
  state.editorSelectedSuggestionIndex = 0;
  queueDraftSave();
  updateWordCount();
  renderEditorSuggestions();
}

function extractTags(text) {
  const matches = text.toLowerCase().match(/(^|\s)#([a-z0-9_-]+)/g) || [];
  const tags = matches
    .map((match) => match.trim().slice(1))
    .filter(Boolean);
  return [...new Set(tags)];
}

function extractMentions(text) {
  const matches = text.toLowerCase().match(/(^|\s)@([a-z0-9_-]+)/g) || [];
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
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function showStatusToast(message) {
  if (!message || message === "Ready" || message === "Editing block -> save updates") {
    return;
  }

  statusToast.textContent = message;
  statusToast.hidden = false;
  window.clearTimeout(statusToastTimer);
  statusToastTimer = window.setTimeout(() => {
    statusToast.hidden = true;
  }, 1800);
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
    return;
  }
  const transaction = state.db.transaction(META_STORE, "readwrite");
  transaction.objectStore(META_STORE).put({ key, value });
}
