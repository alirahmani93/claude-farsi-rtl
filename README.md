# Claude.ai Farsi RTL

A tiny Chrome (MV3) extension for [claude.ai](https://claude.ai) that adds:

1. **Per-block Farsi RTL + Vazirmatn font.** English/LTR blocks and code stay untouched.
2. **Font picker** for Farsi and English text (popup).
3. **Local prompt library** — save reusable prompts and one-click insert them
   into Claude's composer. Stored locally, no network calls.

No build step, no dependencies, no remote requests. The font is bundled.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and pick this directory (`claude_extention/`).
4. Open or refresh any `https://claude.ai/*` tab.

To update after editing files: hit the reload icon for the extension on
`chrome://extensions`, then refresh the Claude tab.

## Features

### 1. Per-block Farsi RTL

A content script scoped to `https://claude.ai/*` watches the page with a
`MutationObserver` and, for each prose block (`<p>`, `<li>`, `<h1>`–`<h6>`,
`<blockquote>`, table cells, etc.), samples the first ~50 characters of text. If
Persian characters (U+0600–U+06FF / U+FB50–U+FDFF / U+FE70–U+FEFF) make up more
than ~40% of the letter characters, that *single block* gets `dir="rtl"
lang="fa"` and the chosen Farsi font stack via a `data-farsi-rtl` attribute hook.
Anything inside `<pre>` or `<code>` is skipped, generic `<div>`s are ignored
(so the Claude chrome stays LTR), per-block re-evaluation is debounced ~150 ms
to avoid mid-stream flicker, and the composer's contenteditable is reprocessed
on each `input` event.

### 2. Font picker

Click the extension icon. Two dropdowns:

- **Farsi font** — applied to detected Farsi blocks. Options include the
  bundled Vazirmatn (default), Tahoma, IRANSans, Segoe UI, etc.
- **English font** — applied to English-dominant blocks that sit *inside* a
  Farsi container (so mixed-language messages render cleanly). Options include
  the system default, Inter, Georgia, Arial, monospace, etc.

Selections persist in `chrome.storage.local` and apply live — no reload.
A small live preview sits under each dropdown.

### 3. Local prompt library

Click the extension icon → **Prompts** tab.

- **+ Add** opens a small form (title + body).
- Each saved prompt shows three insert actions:
  - **↥ Top** — insert at the very beginning of the composer.
  - **⌖ Here** — insert at the caret position you last had inside the composer.
  - **↧ End** — insert at the very end of the composer.
- The **×** button deletes a prompt.

A claude.ai tab must be open for insertion to work. The popup closes itself
right after inserting so focus returns to the composer. If direct insertion
fails (e.g. the composer can't be found), the prompt is copied to your
clipboard as a fallback.

Prompts are stored under `chrome.storage.local` (local-only, no network) and
survive Chrome restarts. They are *per-profile*, not per-conversation.

## Files

- `manifest.json` — MV3, host permission limited to `claude.ai`, `storage` permission for settings/prompts.
- `content.js` — Farsi/English block detection, MutationObserver, font CSS-variable wiring, caret tracking + insert message handler.
- `styles.css` — `@font-face` for bundled Vazirmatn + RTL styling.
- `popup.html` / `popup.css` / `popup.js` — tabbed popup (Prompts + Fonts). Prompts tab handles CRUD and sends insert commands to the claude.ai tab.
- `fonts/Vazirmatn-{Regular,Bold}.woff2` — bundled webfonts (Vazirmatn v33.003 by
  rastikerdar, [SIL Open Font License](https://github.com/rastikerdar/vazirmatn/blob/master/OFL.txt)).
- `icons/` — extension icons.

## Tuning

Constants at the top of `content.js`:

- `THRESHOLD` (0.4) — Persian-letter ratio required to flip a block.
- `SAMPLE_LEN` (50) — how many leading characters to sample.
- `DEBOUNCE_MS` (150) — per-block re-evaluation delay during streaming.

## A note on "localStorage"

Settings and prompts use the extension's `chrome.storage.local` API rather than
the page's `window.localStorage`. Both are local-only with no network, but
`chrome.storage.local` is the right tool for an extension: it's shared between
the popup and the content script, survives a page reload cleanly, and isn't
visible to claude.ai's own scripts.
