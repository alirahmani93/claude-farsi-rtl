// ==UserScript==
// @name         Claude.ai Farsi RTL (lite)
// @namespace    https://github.com/alirahmani93/claude-farsi-rtl
// @version      1.2.0
// @description  Per-block Farsi RTL on claude.ai and chatgpt.com — no Chrome dev mode, works on Firefox. Lite port of the Claude.ai Farsi RTL extension; for the full feature set (prompt library, bundled Vazirmatn, font picker, settings UI) install the extension.
// @author       alirahmani93
// @license      MIT
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @homepageURL  https://github.com/alirahmani93/claude-farsi-rtl
// @supportURL   https://github.com/alirahmani93/claude-farsi-rtl/issues
// ==/UserScript==

/* eslint-disable no-undef */
(() => {
  'use strict';

  // ───── Settings (persisted via GM_setValue) ─────────────────────────
  //
  // Lite scope: only the RTL detector and a Farsi font choice. Prompts,
  // the English-in-Farsi font override, and master/per-feature toggle
  // matrix all stay in the full extension. If you want zero friction,
  // the userscript runs without any of that.
  //
  // GM storage is per-browser-profile local — no cross-device sync. To
  // move settings between browsers, install the full extension or just
  // re-pick from the userscript menu.

  const FARSI_FONT_PRESETS = [
    { key: 'tahoma',     label: 'Tahoma (system, default)',     stack: "'Tahoma', 'Iranian Sans', 'Segoe UI', system-ui, sans-serif" },
    { key: 'vazirmatn',  label: 'Vazirmatn (if installed)',     stack: "'Vazirmatn', 'Tahoma', 'Iranian Sans', system-ui, sans-serif" },
    { key: 'iransans',   label: 'IRANSans (if installed)',      stack: "'IRANSans', 'IRANSansX', 'Tahoma', system-ui, sans-serif" },
    { key: 'segoe',      label: 'Segoe UI',                     stack: "'Segoe UI', 'Tahoma', system-ui, sans-serif" },
    { key: 'serif',      label: 'Times New Roman (serif)',      stack: "'Times New Roman', 'Iranian Serif', serif" },
    { key: 'system',     label: 'System default',               stack: 'system-ui, sans-serif' },
  ];
  const DEFAULT_FARSI_FONT_KEY = 'tahoma';

  function loadSettings() {
    return {
      rtlEnabled:    GM_getValue('rtlEnabled', true),
      farsiFontKey:  GM_getValue('farsiFontKey', DEFAULT_FARSI_FONT_KEY),
    };
  }
  let settings = loadSettings();

  function farsiFontStack() {
    const found = FARSI_FONT_PRESETS.find(f => f.key === settings.farsiFontKey);
    return (found || FARSI_FONT_PRESETS[0]).stack;
  }

  // ───── Styles ────────────────────────────────────────────────────────
  // Mirror of styles.css from the full extension, minus @font-face (the
  // userscript intentionally does not bundle Vazirmatn — use the full
  // extension if you want the bundled font).

  GM_addStyle(`
    :root { --cfr-farsi-font: ${farsiFontStack()}; }

    [data-farsi-rtl="1"] {
      direction: rtl;
      text-align: right;
      font-family: var(--cfr-farsi-font);
      line-height: 1.85;
      unicode-bidi: isolate;
    }
    [data-farsi-rtl="1"] code,
    [data-farsi-rtl="1"] kbd,
    [data-farsi-rtl="1"] samp {
      direction: ltr;
      unicode-bidi: embed;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    [data-farsi-rtl="0"] {
      direction: ltr;
      text-align: left;
      unicode-bidi: isolate;
    }
  `);

  function updateFarsiFontVar() {
    document.documentElement.style.setProperty('--cfr-farsi-font', farsiFontStack());
  }

  // ───── RTL detector (ported from content.js) ────────────────────────

  const PERSIAN_RE = /[؀-ۿﭐ-﷿ﹰ-﻿]/g;
  const LETTER_RE = /\p{L}/gu;
  const THRESHOLD = 0.4;
  const SAMPLE_LEN = 50;
  const DEBOUNCE_MS = 150;
  const MARK = 'data-farsi-rtl';

  const BLOCK_TAGS = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                      'BLOCKQUOTE', 'TD', 'TH', 'DT', 'DD', 'FIGCAPTION', 'SUMMARY'];
  const BLOCK_SELECTOR = BLOCK_TAGS.join(',');
  const BLOCK_SET = new Set(BLOCK_TAGS);

  const SKIP_ANCESTOR = new Set(['PRE', 'CODE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'SVG']);

  function isUnderSkipped(el) {
    for (let cur = el; cur && cur !== document.body; cur = cur.parentElement) {
      if (SKIP_ANCESTOR.has(cur.tagName)) return true;
    }
    return false;
  }

  function sampleText(el) {
    let out = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        for (let p = node.parentElement; p && p !== el.parentElement; p = p.parentElement) {
          if (SKIP_ANCESTOR.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) {
      out += n.nodeValue;
      if (out.length >= SAMPLE_LEN) break;
    }
    return out.slice(0, SAMPLE_LEN);
  }

  function isFarsi(text) {
    if (!text) return false;
    const letters = text.match(LETTER_RE);
    if (!letters || letters.length < 3) return false;
    const persian = text.match(PERSIAN_RE);
    if (!persian) return false;
    return persian.length / letters.length > THRESHOLD;
  }

  function isEnglish(text) {
    if (!text) return false;
    const letters = text.match(LETTER_RE);
    if (!letters || letters.length < 3) return false;
    const persian = text.match(PERSIAN_RE);
    return !persian || persian.length / letters.length < 0.05;
  }

  function hasFarsiAncestor(el) {
    let p = el.parentElement;
    while (p) {
      if (p.getAttribute && p.getAttribute(MARK) === '1') return true;
      p = p.parentElement;
    }
    return false;
  }

  function evaluate(el) {
    if (!el.isConnected || el.nodeType !== 1) return;
    if (!BLOCK_SET.has(el.tagName)) return;
    if (isUnderSkipped(el)) return;

    const text = sampleText(el);
    const farsi = isFarsi(text);
    const current = el.getAttribute(MARK);

    if (farsi) {
      if (current !== '1') {
        el.setAttribute(MARK, '1');
        el.setAttribute('dir', 'rtl');
        el.setAttribute('lang', 'fa');
      }
      return;
    }

    if (isEnglish(text) && hasFarsiAncestor(el)) {
      if (current !== '0') {
        el.setAttribute(MARK, '0');
        el.setAttribute('dir', 'ltr');
        el.setAttribute('lang', 'en');
      }
      return;
    }

    if (current !== null) {
      el.removeAttribute(MARK);
      el.removeAttribute('dir');
      el.removeAttribute('lang');
    }
  }

  const pending = new WeakMap();
  function schedule(el) {
    const prev = pending.get(el);
    if (prev) clearTimeout(prev);
    pending.set(el, setTimeout(() => {
      pending.delete(el);
      evaluate(el);
    }, DEBOUNCE_MS));
  }

  function scanSubtree(root) {
    if (!root || root.nodeType !== 1) return;
    if (BLOCK_SET.has(root.tagName)) schedule(root);
    const blocks = root.querySelectorAll(BLOCK_SELECTOR);
    for (let i = 0; i < blocks.length; i++) schedule(blocks[i]);
  }

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) scanSubtree(node);
        }
      } else if (m.type === 'characterData') {
        let p = m.target.parentElement;
        while (p && !BLOCK_SET.has(p.tagName)) p = p.parentElement;
        if (p) schedule(p);
      }
    }
  });

  let rtlRunning = false;
  function startRtl() {
    if (rtlRunning) return;
    rtlRunning = true;
    scanSubtree(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function stopRtl() {
    if (!rtlRunning) return;
    rtlRunning = false;
    observer.disconnect();
    const tagged = document.querySelectorAll('[' + MARK + ']');
    for (const el of tagged) {
      el.removeAttribute(MARK);
      el.removeAttribute('dir');
      el.removeAttribute('lang');
    }
  }

  function applyRtl() {
    if (settings.rtlEnabled) startRtl(); else stopRtl();
  }

  // Re-evaluate the composer (contenteditable) on every input so newly
  // typed Persian paragraphs flip in real time.
  document.addEventListener('input', (e) => {
    if (!settings.rtlEnabled) return;
    const t = e.target;
    if (!(t instanceof Element) || !t.isContentEditable) return;
    if (BLOCK_SET.has(t.tagName)) schedule(t);
    const blocks = t.querySelectorAll(BLOCK_SELECTOR);
    for (let i = 0; i < blocks.length; i++) schedule(blocks[i]);
  }, true);

  // ───── Menu commands ─────────────────────────────────────────────────
  // Tampermonkey / Violentmonkey expose these in the manager's toolbar
  // menu. No popup UI to build — that's the whole point of "lite".

  function registerMenu() {
    GM_registerMenuCommand(
      (settings.rtlEnabled ? '✓' : '✗') + ' Farsi RTL — click to ' + (settings.rtlEnabled ? 'disable' : 'enable'),
      () => {
        settings.rtlEnabled = !settings.rtlEnabled;
        GM_setValue('rtlEnabled', settings.rtlEnabled);
        applyRtl();
        // Re-register so the next menu open shows the updated label.
        // Tampermonkey collapses duplicate commands by id; without an
        // explicit refresh the user sees the stale "click to disable"
        // line until they reload the page.
        registerMenu();
      }
    );

    for (const preset of FARSI_FONT_PRESETS) {
      const mark = preset.key === settings.farsiFontKey ? '●' : '○';
      GM_registerMenuCommand(
        `${mark} Font: ${preset.label}`,
        () => {
          settings.farsiFontKey = preset.key;
          GM_setValue('farsiFontKey', preset.key);
          updateFarsiFontVar();
          registerMenu();
        }
      );
    }
  }

  // ───── Boot ──────────────────────────────────────────────────────────

  registerMenu();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyRtl, { once: true });
  } else {
    applyRtl();
  }
})();
