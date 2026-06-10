// MV3 service worker.
//
// Responsibilities (kept minimal — the heavy lifting still happens in
// content.js and popup.js):
//
//   1. Seed `siteList` on first install with the historical default hosts
//      (claude.ai, chatgpt.com, chat.openai.com) so existing users see no
//      change after the upgrade.
//   2. Handle the keyboard shortcut declared in manifest.json:
//      `add-current-site` adds the active tab's hostname to `siteList`.
//
// Schema for `siteList` (chrome.storage.local):
//   Array<{ host: string, enabled: boolean }>
//   - host: lowercased hostname, exact match against location.hostname.
//   - enabled: per-row switch; lets users keep an entry but pause it.

'use strict';

const DEFAULT_SITES = [
  { host: 'claude.ai',        enabled: true },
  { host: 'chatgpt.com',      enabled: true },
  { host: 'chat.openai.com',  enabled: true },
];

function normaliseHost(input) {
  if (!input) return '';
  let s = String(input).trim().toLowerCase();
  // Tolerate users pasting a full URL.
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = new URL(s).hostname;
  } catch (_) { /* fall through */ }
  // Strip leading scheme remnants and trailing slashes/paths if any survived.
  s = s.replace(/^\/+/, '').replace(/\/.*$/, '');
  return s;
}

async function seedSiteListIfMissing() {
  const { siteList, _siteListSeeded } = await chrome.storage.local.get(
    ['siteList', '_siteListSeeded']);
  if (Array.isArray(siteList)) return;            // already initialised
  if (_siteListSeeded) return;                    // user emptied it on purpose
  await chrome.storage.local.set({
    siteList: DEFAULT_SITES,
    _siteListSeeded: true,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  seedSiteListIfMissing();
});
chrome.runtime.onStartup.addListener(() => {
  seedSiteListIfMissing();
});

// ── Keyboard shortcut ───────────────────────────────────────────────────
//
// Adds the active tab's hostname to siteList (enabled). If it's already in
// the list, flips it to enabled rather than duplicating. Internal pages
// (chrome://, edge://, chrome-extension://) are skipped — the content
// script can't run there anyway.

async function addCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return { ok: false, error: 'No active tab.' };
  let host;
  try { host = new URL(tab.url).hostname.toLowerCase(); }
  catch (_) { return { ok: false, error: 'Unsupported page.' }; }
  if (!host) return { ok: false, error: 'Unsupported page.' };

  const { siteList } = await chrome.storage.local.get(['siteList']);
  const list = Array.isArray(siteList) ? siteList.slice() : [];
  const idx = list.findIndex(e => e.host === host);
  if (idx === -1) {
    list.unshift({ host, enabled: true });
  } else {
    list[idx] = { ...list[idx], enabled: true };
  }
  await chrome.storage.local.set({ siteList: list });
  return { ok: true, host, added: idx === -1 };
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'add-current-site') addCurrentSite();
});

// The popup also drives this via runtime.sendMessage so the "+ Add current"
// button can reuse the same code path (and surface the resulting hostname
// in the popup status line).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'cfr-add-current-site') return;
  addCurrentSite().then(sendResponse);
  return true; // async response
});

// Exported for unit-testing-by-eye in the service worker console; harmless.
self._cfrNormaliseHost = normaliseHost;
