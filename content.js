(() => {
  'use strict';

  const PERSIAN_RE = /[؀-ۿﭐ-﷿ﹰ-﻿]/g;
  const LETTER_RE = /\p{L}/gu;
  const THRESHOLD = 0.4;
  const SAMPLE_LEN = 50;
  const DEBOUNCE_MS = 150;
  const MARK = 'data-farsi-rtl';

  // Block-level tags we evaluate. DIV is intentionally excluded — too generic,
  // would catch UI chrome. Markdown rendering and ProseMirror both emit <p> for
  // paragraphs, so this set covers prose without overreach.
  const BLOCK_TAGS = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                      'BLOCKQUOTE', 'TD', 'TH', 'DT', 'DD', 'FIGCAPTION', 'SUMMARY'];
  const BLOCK_SELECTOR = BLOCK_TAGS.join(',');
  const BLOCK_SET = new Set(BLOCK_TAGS);

  // Anything inside these is left alone (code stays LTR regardless of language).
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

  function start() {
    scanSubtree(document.body);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // Composer (contenteditable). Re-evaluate per paragraph on input.
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof Element) || !t.isContentEditable) return;
    if (BLOCK_SET.has(t.tagName)) schedule(t);
    const blocks = t.querySelectorAll(BLOCK_SELECTOR);
    for (let i = 0; i < blocks.length; i++) schedule(blocks[i]);
  }, true);

  // ───── Font preferences ───────────────────────────────────────────────
  //
  // Popup writes farsiFont / englishFont. Mirror to documentElement as CSS
  // custom properties so styles.css picks them up without a sheet rewrite.

  const DEFAULT_FARSI_FONT =
    "'Vazirmatn', 'Tahoma', 'Iranian Sans', 'Segoe UI', system-ui, sans-serif";
  const DEFAULT_ENGLISH_FONT = "inherit";

  function applyFonts({ farsiFont, englishFont }) {
    document.documentElement.style.setProperty(
      '--farsi-font', farsiFont || DEFAULT_FARSI_FONT);
    document.documentElement.style.setProperty(
      '--english-font', englishFont || DEFAULT_ENGLISH_FONT);
  }

  chrome.storage.local.get(['farsiFont', 'englishFont']).then(applyFonts);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.farsiFont || changes.englishFont) {
      chrome.storage.local.get(['farsiFont', 'englishFont']).then(applyFonts);
    }
  });

  // ───── Prompt insertion (driven by the popup) ─────────────────────────
  //
  // The popup sends {type: 'cfr-insert', body, position} via chrome.tabs.
  // Position is one of:
  //   - 'top'    → insert at the very beginning of the composer
  //   - 'end'    → insert at the very end of the composer
  //   - 'cursor' → insert at the most recent caret position inside the
  //                composer (we keep tracking it since opening the popup
  //                steals focus and clears the live selection).

  let lastEditor = null;
  let lastRange = null;

  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    if (node.nodeType !== 1) node = node.parentNode;
    if (!node) return;
    for (let p = node; p; p = p.parentElement) {
      if (p.isContentEditable) {
        lastEditor = p;
        lastRange = range.cloneRange();
        return;
      }
    }
  });

  function findComposer() {
    if (lastEditor && lastEditor.isConnected) return lastEditor;
    const candidates = document.querySelectorAll(
      '[contenteditable="true"], div[role="textbox"]');
    let best = null, bestY = -Infinity;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.bottom > bestY && r.width > 100) { best = el; bestY = r.bottom; }
    }
    return best;
  }

  function placeCaret(editor, position) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    if (position === 'cursor' && lastRange && editor.contains(lastRange.startContainer)) {
      sel.addRange(lastRange);
      return;
    }
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(position === 'top'); // top → start; end (default) → end
    sel.addRange(r);
  }

  function tryInsert(editor, text) {
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch (_) { /* ignored */ }
    if (ok) return true;
    try {
      const ev = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(ev);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) { return false; }
  }

  async function insertPrompt(text, position) {
    const editor = findComposer();
    if (!editor) {
      const copied = await copyToClipboard(text);
      return { ok: false, error: copied
        ? 'Composer not found — copied to clipboard.'
        : 'Composer not found.' };
    }
    editor.focus();
    placeCaret(editor, position);
    const inserted = tryInsert(editor, text);
    if (!inserted) {
      const copied = await copyToClipboard(text);
      return { ok: false, error: copied
        ? 'Could not insert — copied to clipboard.'
        : 'Insert failed.' };
    }
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'cfr-insert') return;
    insertPrompt(String(msg.body || ''), msg.position || 'end').then(sendResponse);
    return true; // keep the message channel open for the async response
  });
})();
