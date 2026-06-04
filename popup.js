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
    select.innerHTML = '';
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

  // ── Prompts ───────────────────────────────────────────────────────────

  function cryptoId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  async function getPrompts() {
    const { prompts } = await chrome.storage.local.get(['prompts']);
    return Array.isArray(prompts) ? prompts : [];
  }

  async function findClaudeTab() {
    const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });
    if (!tabs.length) return null;
    // Prefer the active one in the current window, otherwise any claude tab.
    const current = tabs.find(t => t.active) || tabs[0];
    return current;
  }

  async function insertPrompt(body, position) {
    const tab = await findClaudeTab();
    if (!tab) {
      flashStatus('Open a claude.ai tab first.', true);
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
      flashStatus('Reload the claude.ai tab and try again.', true);
    }
  }

  async function renderPrompts() {
    const list = $('prompts-list');
    const empty = $('prompts-empty');
    const prompts = await getPrompts();
    list.innerHTML = '';
    if (!prompts.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    for (const p of prompts) {
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
      body.textContent = p.body;
      text.appendChild(title);
      text.appendChild(body);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'p-del';
      del.title = 'Delete prompt';
      del.textContent = '×';
      del.addEventListener('click', async () => {
        const next = (await getPrompts()).filter(x => x.id !== p.id);
        await chrome.storage.local.set({ prompts: next });
      });

      row.appendChild(text);
      row.appendChild(del);

      const actions = document.createElement('div');
      actions.className = 'p-actions';
      for (const a of ACTIONS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = a.title;
        b.innerHTML = '<span class="icn">' + a.icon + '</span><span>' + a.label + '</span>';
        b.addEventListener('click', () => insertPrompt(p.body, a.position));
        actions.appendChild(b);
      }

      li.appendChild(row);
      li.appendChild(actions);
      list.appendChild(li);
    }
  }

  function resetAddForm() {
    $('p-title').value = '';
    $('p-body').value = '';
    $('add-form').hidden = true;
  }

  function bindPromptUI() {
    // Form is closed by default and stays closed every popup open — the user
    // is here for the list 95% of the time.
    $('add-toggle').addEventListener('click', () => {
      const form = $('add-form');
      if (form.hidden) {
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
      await chrome.storage.local.set({ prompts });
      resetAddForm();
      flashStatus('Prompt saved.');
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    loadFonts();
    renderPrompts();
    bindPromptUI();

    $('farsi-font').addEventListener('change', saveFonts);
    $('english-font').addEventListener('change', saveFonts);
    $('reset').addEventListener('click', () => {
      chrome.storage.local.set(DEFAULTS).then(() => {
        loadFonts();
        flashStatus('Reset to defaults.');
      });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.prompts) renderPrompts();
    });
  });
})();
