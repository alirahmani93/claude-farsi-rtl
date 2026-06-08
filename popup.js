(() => {
  'use strict';

  // Keep these in sync with the defaults in content.js.
  const FARSI_FONTS = [
    { label: 'Vazirmatn (bundled, default)', value: "'Vazirmatn', 'Tahoma', 'Iranian Sans', 'Segoe UI', system-ui, sans-serif" },
    { label: 'Tahoma',                       value: "'Tahoma', 'Iranian Sans', 'Segoe UI', system-ui, sans-serif" },
    { label: 'IRANSans',                     value: "'IRANSans', 'IRANSansX', 'Tahoma', system-ui, sans-serif" },
    { label: 'Segoe UI',                     value: "'Segoe UI', 'Tahoma', system-ui, sans-serif" },
    { label: 'Times New Roman (serif)',      value: "'Times New Roman', 'Iranian Serif', serif" },
    { label: 'System default',               value: "system-ui, sans-serif" },
  ];

  const ENGLISH_FONTS = [
    { label: 'System default',                value: "inherit" },
    { label: 'System UI',                     value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
    { label: 'Inter (if installed)',          value: "'Inter', system-ui, sans-serif" },
    { label: 'Georgia (serif)',               value: "Georgia, 'Times New Roman', serif" },
    { label: 'Arial',                         value: "Arial, Helvetica, sans-serif" },
    { label: 'Verdana',                       value: "Verdana, Geneva, sans-serif" },
    { label: 'Monospace',                     value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  ];

  const DEFAULTS = {
    farsiFont: FARSI_FONTS[0].value,
    englishFont: ENGLISH_FONTS[0].value,
  };

  // Feature toggles. All default to true — the extension is on out of the box.
  // `enabled` is the master; the per-feature flags only matter when it's true.
  // `syncPromptsEnabled` is independent of the master — it controls only the
  // storage area for prompts, not whether the prompt feature works.
  const TOGGLE_KEYS = [
    'enabled', 'rtlEnabled', 'fontsEnabled', 'promptsEnabled', 'syncPromptsEnabled',
  ];
  const TOGGLE_DEFAULTS = {
    enabled: true,
    rtlEnabled: true,
    fontsEnabled: true,
    promptsEnabled: true,
    syncPromptsEnabled: true,
  };
  // Toggles that the master `enabled` switch grays out. `syncPromptsEnabled`
  // is intentionally NOT in here: storage choice is orthogonal to "is the
  // extension on right now". Touching it while the extension is off is fine.
  const MASTER_GATED_TOGGLES = ['rtlEnabled', 'fontsEnabled', 'promptsEnabled'];

  // The three insertion modes wired to the per-prompt action buttons.
  // Labels here are user-facing; positions are what content.js expects.
  const ACTIONS = [
    { position: 'top',    icon: '↥', label: 'Top',    title: 'Insert at the beginning of the composer' },
    { position: 'cursor', icon: '⌖', label: 'Here',   title: 'Insert at the current cursor position'   },
    { position: 'end',    icon: '↧', label: 'End',    title: 'Insert at the end of the composer'       },
  ];

  const $ = (id) => document.getElementById(id);

  // ── Tabs ──────────────────────────────────────────────────────────────

  function bindTabs() {
    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        for (const t of document.querySelectorAll('.tab')) {
          const active = t.dataset.tab === name;
          t.classList.toggle('active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        for (const p of document.querySelectorAll('.panel')) {
          const active = p.id === 'panel-' + name;
          p.classList.toggle('active', active);
          p.hidden = !active;
        }
      });
    }
  }

  // ── Status line ───────────────────────────────────────────────────────

  function flashStatus(text, isError = false) {
    const s = $('status');
    s.textContent = text;
    s.classList.toggle('error', !!isError);
    clearTimeout(flashStatus._t);
    flashStatus._t = setTimeout(() => {
      s.textContent = '';
      s.classList.remove('error');
    }, 1800);
  }

  // ── Fonts ─────────────────────────────────────────────────────────────

  function fill(select, options, current) {
    while (select.firstChild) select.removeChild(select.firstChild);
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === current) o.selected = true;
      select.appendChild(o);
    }
    if (![...select.options].some(o => o.value === current)) {
      const o = document.createElement('option');
      o.value = current;
      o.textContent = 'Custom (' + current.slice(0, 30) + '…)';
      o.selected = true;
      select.appendChild(o);
    }
  }

  function applyPreview() {
    $('farsi-preview').style.fontFamily = $('farsi-font').value;
    const eng = $('english-font').value;
    $('english-preview').style.fontFamily = eng === 'inherit' ? '' : eng;
  }

  async function loadFonts() {
    const stored = await chrome.storage.local.get(['farsiFont', 'englishFont']);
    fill($('farsi-font'), FARSI_FONTS, stored.farsiFont || DEFAULTS.farsiFont);
    fill($('english-font'), ENGLISH_FONTS, stored.englishFont || DEFAULTS.englishFont);
    applyPreview();
  }

  function saveFonts() {
    const farsiFont = $('farsi-font').value;
    const englishFont = $('english-font').value;
    chrome.storage.local.set({ farsiFont, englishFont }).then(() => {
      applyPreview();
      flashStatus('Saved.');
    });
  }

  // ── Settings (toggles) ────────────────────────────────────────────────

  const TOGGLE_IDS = {
    enabled: 't-enabled',
    rtlEnabled: 't-rtl',
    fontsEnabled: 't-fonts',
    promptsEnabled: 't-prompts',
    syncPromptsEnabled: 't-sync-prompts',
  };

  async function loadToggles() {
    const stored = await chrome.storage.local.get([...TOGGLE_KEYS, 'promptPreviewChars']);
    for (const k of TOGGLE_KEYS) {
      const v = typeof stored[k] === 'boolean' ? stored[k] : TOGGLE_DEFAULTS[k];
      $(TOGGLE_IDS[k]).checked = v;
    }
    // Seed the cached value so the first getPrompts() lands in the right area.
    syncPromptsEnabled = typeof stored.syncPromptsEnabled === 'boolean'
      ? stored.syncPromptsEnabled : TOGGLE_DEFAULTS.syncPromptsEnabled;
    previewChars = clampPreviewChars(stored.promptPreviewChars ?? PREVIEW_DEFAULT);
    $('t-preview-chars').value = String(previewChars);
    reflectMaster();
  }

  // When the master is off, the master-gated switches are visually disabled
  // (they still keep their stored value — re-enabling the master restores
  // each one to whatever the user had picked). `syncPromptsEnabled` is NOT
  // master-gated — see comment on MASTER_GATED_TOGGLES.
  function reflectMaster() {
    const master = $(TOGGLE_IDS.enabled).checked;
    for (const k of MASTER_GATED_TOGGLES) {
      const row = $(TOGGLE_IDS[k]).closest('.toggle-row');
      row.classList.toggle('disabled', !master);
      $(TOGGLE_IDS[k]).disabled = !master;
    }
  }

  function bindToggles() {
    for (const k of TOGGLE_KEYS) {
      $(TOGGLE_IDS[k]).addEventListener('change', async () => {
        const next = $(TOGGLE_IDS[k]).checked;
        // The sync toggle has a side effect: when flipped, copy the current
        // prompts into the new storage area so the user's visible list
        // doesn't change underneath them. We don't delete from the source —
        // flipping back restores that snapshot.
        if (k === 'syncPromptsEnabled') {
          await migratePromptsOnToggle(next);
        }
        await chrome.storage.local.set({ [k]: next });
        if (k === 'enabled') reflectMaster();
        if (k === 'syncPromptsEnabled') renderPrompts();
        flashStatus('Saved.');
      });
    }

    // Preview length — clamp on commit (change), normalize the field so the
    // user sees what we actually stored, then re-render so existing cards
    // pick up the new truncation immediately.
    $('t-preview-chars').addEventListener('change', async () => {
      const n = clampPreviewChars($('t-preview-chars').value);
      previewChars = n;
      $('t-preview-chars').value = String(n);
      await chrome.storage.local.set({ promptPreviewChars: n });
      renderPrompts();
      flashStatus('Saved.');
    });
  }

  // ── Prompts ───────────────────────────────────────────────────────────

  function cryptoId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  // Where prompts live depends on the `syncPromptsEnabled` toggle:
  //   - on  → `chrome.storage.sync` (Chrome syncs across devices)
  //   - off → `chrome.storage.local` (this device only)
  // Fonts and toggles always stay in `local` — they're device-level
  // preferences (font availability differs per OS). We mirror the toggle
  // into a module-level cache so the storage helpers can stay synchronous-
  // at-the-callsite (loaded once on init, updated by `storage.onChanged`).
  let syncPromptsEnabled = TOGGLE_DEFAULTS.syncPromptsEnabled;
  function promptArea() {
    return syncPromptsEnabled ? chrome.storage.sync : chrome.storage.local;
  }
  function inactivePromptArea() {
    return syncPromptsEnabled ? chrome.storage.local : chrome.storage.sync;
  }

  async function getPrompts() {
    const { prompts } = await promptArea().get(['prompts']);
    return Array.isArray(prompts) ? prompts : [];
  }

  async function setPrompts(prompts) {
    return promptArea().set({ prompts });
  }

  // First-run migration (only meaningful when the sync toggle is ON):
  // copy any pre-sync `prompts` from local into sync. Idempotent via a
  // marker so it never reruns — important because a user who later empties
  // their synced list on a fresh device should not have it repopulated
  // from a stale local copy.
  async function migratePromptsToSync() {
    const { _promptsMigrated } = await chrome.storage.local.get(['_promptsMigrated']);
    if (_promptsMigrated) return;
    if (!syncPromptsEnabled) return; // user already opted out; leave local alone
    const { prompts: localPrompts } = await chrome.storage.local.get(['prompts']);
    if (Array.isArray(localPrompts) && localPrompts.length) {
      const { prompts: syncPrompts } = await chrome.storage.sync.get(['prompts']);
      if (!Array.isArray(syncPrompts) || syncPrompts.length === 0) {
        await chrome.storage.sync.set({ prompts: localPrompts });
      }
    }
    await chrome.storage.local.set({ _promptsMigrated: true });
    await chrome.storage.local.remove(['prompts']);
  }

  // Toggle flip: copy the currently-visible list (read from the OLD area,
  // since the toggle update hasn't been applied yet) into the NEW area so
  // the user's list survives the switch. We leave the source untouched —
  // flipping back restores that snapshot.
  async function migratePromptsOnToggle(nextSyncOn) {
    const fromArea = nextSyncOn ? chrome.storage.local : chrome.storage.sync;
    const toArea   = nextSyncOn ? chrome.storage.sync  : chrome.storage.local;
    const { prompts } = await fromArea.get(['prompts']);
    await toArea.set({ prompts: Array.isArray(prompts) ? prompts : [] });
  }

  const SUPPORTED_URLS = [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
  ];

  async function findChatTab() {
    const tabs = await chrome.tabs.query({ url: SUPPORTED_URLS });
    if (!tabs.length) return null;
    // Prefer the active one in the current window, otherwise any supported tab.
    const current = tabs.find(t => t.active) || tabs[0];
    return current;
  }

  async function insertPrompt(body, position) {
    const tab = await findChatTab();
    if (!tab) {
      flashStatus('Open a claude.ai or chatgpt.com tab first.', true);
      return;
    }
    try {
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: 'cfr-insert', body, position,
      });
      if (res && res.ok) {
        flashStatus('Inserted at ' + position + '.');
        // Close the popup so focus returns to the composer.
        setTimeout(() => window.close(), 250);
      } else {
        flashStatus((res && res.error) || 'Insert failed.', true);
      }
    } catch (e) {
      flashStatus('Reload the chat tab and try again.', true);
    }
  }

  // Body previews are truncated to this many characters; the full body is
  // still what gets inserted into the composer and is preserved in storage.
  // The cap is user-configurable from the Settings tab (storage key
  // `promptPreviewChars`); we cache the current value here so render is sync.
  const PREVIEW_DEFAULT = 100;
  const PREVIEW_MIN = 20;
  const PREVIEW_MAX = 2000;
  let previewChars = PREVIEW_DEFAULT;
  function clampPreviewChars(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return PREVIEW_DEFAULT;
    return Math.max(PREVIEW_MIN, Math.min(PREVIEW_MAX, Math.round(v)));
  }
  function truncateBody(text) {
    if (text.length <= previewChars) return text;
    return text.slice(0, previewChars).trimEnd() + '…';
  }

  // Which prompt is currently being inline-edited. We track it in module
  // state so the storage.onChanged re-render doesn't clobber the form mid-typing.
  let editingId = null;

  function buildPromptRow(p) {
    const li = document.createElement('li');
    li.dataset.id = p.id;

    const row = document.createElement('div');
    row.className = 'p-row';

    const text = document.createElement('div');
    text.className = 'p-text';
    const title = document.createElement('p');
    title.className = 'p-title';
    title.textContent = p.title;
    const body = document.createElement('p');
    body.className = 'p-body';
    body.textContent = truncateBody(p.body);
    text.appendChild(title);
    text.appendChild(body);

    const controls = document.createElement('div');
    controls.className = 'p-controls';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'p-edit';
    edit.title = 'Edit prompt';
    edit.textContent = '✎';
    edit.addEventListener('click', () => {
      editingId = p.id;
      renderPrompts();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'p-del';
    del.title = 'Delete prompt';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      const next = (await getPrompts()).filter(x => x.id !== p.id);
      await setPrompts(next);
    });

    controls.appendChild(edit);
    controls.appendChild(del);

    row.appendChild(text);
    row.appendChild(controls);

    const actions = document.createElement('div');
    actions.className = 'p-actions';
    for (const a of ACTIONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = a.title;
      const icn = document.createElement('span');
      icn.className = 'icn';
      icn.textContent = a.icon;
      const lbl = document.createElement('span');
      lbl.textContent = a.label;
      b.appendChild(icn);
      b.appendChild(lbl);
      b.addEventListener('click', () => insertPrompt(p.body, a.position));
      actions.appendChild(b);
    }

    li.appendChild(row);
    li.appendChild(actions);
    return li;
  }

  function buildPromptEditForm(p) {
    const li = document.createElement('li');
    li.dataset.id = p.id;

    const form = document.createElement('div');
    form.className = 'p-edit-form';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.maxLength = 100;
    titleInput.value = p.title;

    const bodyInput = document.createElement('textarea');
    bodyInput.value = p.body;

    const formRow = document.createElement('div');
    formRow.className = 'form-row';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ghost';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      editingId = null;
      renderPrompts();
    });

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'primary';
    save.textContent = 'Save';
    save.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const body = bodyInput.value.trim();
      if (!title || !body) {
        flashStatus('Title and body required.', true);
        return;
      }
      const prompts = await getPrompts();
      const key = title.toLowerCase();
      // Title uniqueness — same check as the add form, but skip self so the
      // user can keep the existing title (only the body changes is common).
      if (prompts.some(x => x.id !== p.id && x.title.trim().toLowerCase() === key)) {
        flashStatus('A prompt with this title already exists.', true);
        titleInput.focus();
        titleInput.select();
        return;
      }
      const next = prompts.map(x => x.id === p.id ? { ...x, title, body } : x);
      editingId = null;
      await setPrompts(next);
      flashStatus('Prompt updated.');
    });

    formRow.appendChild(cancel);
    formRow.appendChild(save);
    form.appendChild(titleInput);
    form.appendChild(bodyInput);
    form.appendChild(formRow);
    li.appendChild(form);

    // Defer focus so the element is in the DOM first.
    setTimeout(() => titleInput.focus(), 0);
    return li;
  }

  async function renderPrompts() {
    const list = $('prompts-list');
    const empty = $('prompts-empty');
    const prompts = await getPrompts();
    list.innerHTML = '';
    if (!prompts.length) {
      empty.hidden = false;
      // If the prompt being edited got deleted from another popup instance.
      editingId = null;
      return;
    }
    empty.hidden = true;

    // If editingId points to a prompt that no longer exists, fall back to
    // the read-only row rather than a phantom form.
    if (editingId && !prompts.some(p => p.id === editingId)) editingId = null;

    for (const p of prompts) {
      const li = p.id === editingId ? buildPromptEditForm(p) : buildPromptRow(p);
      list.appendChild(li);
    }
  }

  function resetAddForm() {
    $('p-title').value = '';
    $('p-body').value = '';
    $('add-form').hidden = true;
  }

  // ── Export / Import ────────────────────────────────────────────────────
  // Manual JSON backup + restore. Works as the cross-browser bridge too
  // (Chrome ↔ Firefox don't share storage.sync). No network, no backend.
  const EXPORT_FORMAT = 'claude-farsi-rtl/prompts';
  const EXPORT_VERSION = 1;

  async function exportPrompts() {
    const prompts = await getPrompts();
    if (!prompts.length) {
      flashStatus('Nothing to export.', true);
      return;
    }
    const payload = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      prompts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `claude-farsi-rtl-prompts-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flashStatus(`Exported ${prompts.length} prompt${prompts.length === 1 ? '' : 's'}.`);
  }

  // Forgiving parser: accepts either the wrapped envelope or a bare array.
  // Validates each entry shape so a malformed file can't poison storage.
  function parseImport(text) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data
      : (data && Array.isArray(data.prompts)) ? data.prompts
      : null;
    if (!list) throw new Error('File does not contain a prompts list.');
    const out = [];
    for (const p of list) {
      if (!p || typeof p !== 'object') continue;
      const title = typeof p.title === 'string' ? p.title.trim() : '';
      const body = typeof p.body === 'string' ? p.body.trim() : '';
      if (!title || !body) continue;
      out.push({ id: typeof p.id === 'string' && p.id ? p.id : cryptoId(), title, body });
    }
    return out;
  }

  // Import accepts pasted text rather than a file. A native file picker
  // would steal focus from the popup and Chrome MV3 dismisses popups on
  // focus loss — by the time the user picks a file the popup is gone.
  async function importPromptsFromText(text) {
    let incoming;
    try {
      incoming = parseImport(text);
    } catch (e) {
      flashStatus('Invalid JSON.', true);
      return false;
    }
    if (!incoming.length) {
      flashStatus('No valid prompts found in the pasted JSON.', true);
      return false;
    }
    const existing = await getPrompts();
    const seen = new Set(existing.map(p => p.title.trim().toLowerCase()));
    const merged = existing.slice();
    let added = 0, skipped = 0;
    // New entries go to the top (matches the add-prompt order); within the
    // incoming list we preserve file order.
    const toAdd = [];
    for (const p of incoming) {
      const key = p.title.toLowerCase();
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      toAdd.push(p);
      added++;
    }
    if (!added) {
      flashStatus(`All ${skipped} prompt${skipped === 1 ? '' : 's'} already exist.`);
      return true; // Treat as a successful no-op so the form closes.
    }
    const next = toAdd.concat(merged);
    try {
      await setPrompts(next);
    } catch (e) {
      // chrome.storage.sync has hard caps (~8KB per item, ~100KB total).
      // Surface the failure rather than swallowing it — the user needs to
      // know their list wasn't saved.
      flashStatus('Storage limit hit — turn off "Sync prompts" in Settings and retry.', true);
      return false;
    }
    const skipMsg = skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : '';
    flashStatus(`Imported ${added} prompt${added === 1 ? '' : 's'}${skipMsg}.`);
    return true;
  }

  function resetImportForm() {
    $('p-import-text').value = '';
    $('import-form').hidden = true;
  }

  function bindPromptUI() {
    // Form is closed by default and stays closed every popup open — the user
    // is here for the list 95% of the time.
    $('add-toggle').addEventListener('click', () => {
      const form = $('add-form');
      if (form.hidden) {
        resetImportForm();
        form.hidden = false;
        $('p-title').focus();
      } else {
        // Toggling off also discards in-progress typing — explicit Cancel
        // and the toggle now behave the same way.
        resetAddForm();
      }
    });
    $('p-cancel').addEventListener('click', resetAddForm);

    $('p-save').addEventListener('click', async () => {
      const title = $('p-title').value.trim();
      const body = $('p-body').value.trim();
      if (!title || !body) {
        flashStatus('Title and body required.', true);
        return;
      }
      const prompts = await getPrompts();
      // Titles are unique (case-insensitive). Reject duplicates so the list
      // stays a meaningful index rather than a pile of "Untitled / Untitled".
      const key = title.toLowerCase();
      if (prompts.some(p => p.title.trim().toLowerCase() === key)) {
        flashStatus('A prompt with this title already exists.', true);
        $('p-title').focus();
        $('p-title').select();
        return;
      }
      prompts.unshift({ id: cryptoId(), title, body });
      await setPrompts(prompts);
      resetAddForm();
      flashStatus('Prompt saved.');
    });

    $('p-export').addEventListener('click', exportPrompts);

    // Import is paste-based — see importPromptsFromText() for why.
    // Toggling the import button opens/closes the form (matches +Add).
    // Opening it also collapses the +Add form so the panel stays calm.
    $('p-import').addEventListener('click', () => {
      const form = $('import-form');
      if (form.hidden) {
        resetAddForm();
        form.hidden = false;
        $('p-import-text').focus();
      } else {
        resetImportForm();
      }
    });
    $('p-import-cancel').addEventListener('click', resetImportForm);
    $('p-import-save').addEventListener('click', async () => {
      const text = $('p-import-text').value.trim();
      if (!text) {
        flashStatus('Paste the exported JSON first.', true);
        $('p-import-text').focus();
        return;
      }
      const ok = await importPromptsFromText(text);
      if (ok) resetImportForm();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', async () => {
    bindTabs();
    loadFonts();
    // Await toggles so `syncPromptsEnabled` is seeded before the migration
    // and first render decide which storage area to read from.
    await loadToggles();
    bindToggles();
    bindPromptUI();

    // Migrate before the first render so we show the synced list, not the
    // about-to-be-deleted local copy.
    await migratePromptsToSync();
    renderPrompts();

    $('farsi-font').addEventListener('change', saveFonts);
    $('english-font').addEventListener('change', saveFonts);
    $('reset').addEventListener('click', () => {
      chrome.storage.local.set(DEFAULTS).then(() => {
        loadFonts();
        flashStatus('Reset to defaults.');
      });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      // Sync toggle flipped from elsewhere (another popup instance): refresh
      // the cached flag and re-render so we read from the right area.
      if (area === 'local' && changes.syncPromptsEnabled) {
        syncPromptsEnabled = !!changes.syncPromptsEnabled.newValue;
        $(TOGGLE_IDS.syncPromptsEnabled).checked = syncPromptsEnabled;
        renderPrompts();
        return;
      }
      // Prompt changes — only react to writes in the area we're currently
      // reading from. Otherwise the snapshot in the inactive area would
      // trigger spurious re-renders.
      const promptArea = syncPromptsEnabled ? 'sync' : 'local';
      if (area === promptArea && changes.prompts) renderPrompts();
    });
  });
})();
