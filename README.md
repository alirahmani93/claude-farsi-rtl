# Claude.ai Farsi RTL

A tiny Chrome / Firefox (MV3) extension for [claude.ai](https://claude.ai) and
[chatgpt.com](https://chatgpt.com) (also `chat.openai.com`) that adds:

1. **Per-block Farsi RTL + Vazirmatn font.** English/LTR blocks and code stay untouched.
2. **Font picker** for Farsi and English text (popup).
3. **Synced prompt library** — save, edit, and one-click insert reusable
   prompts into the chat composer. Follows you across devices via
   `chrome.storage.sync` (no network code on our side); falls back to
   local-only when you turn sync off. Manual Export / Import as the
   cross-browser bridge.
4. **Settings tab** — master on/off switch plus per-feature toggles
   (RTL, fonts, prompt insertion, sync) and a configurable prompt-card
   preview length.

No build step, no dependencies, no remote requests. The font is bundled.
The extension still carries its original "Claude.ai Farsi RTL" name even
though it now runs on both sites — rebranding will come later.

## Install

Three paths, in order of friction:

### Firefox — addons.mozilla.org

*(Listing pending — link will go here once the AMO review clears.)*
Once published, you'll install from AMO like any normal Firefox add-on
and get automatic updates with no developer mode.

### Tampermonkey / Violentmonkey userscript (Chrome, Firefox, Edge, Safari)

A lite port — RTL detection only, no popup, no prompt library, no
bundled Vazirmatn font (uses system Persian fonts instead). Best for
users who can't or don't want to install the full extension.

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or
   [Violentmonkey](https://violentmonkey.github.io/)) in your browser.
2. Open [`userscript/claude-farsi-rtl.user.js`](userscript/claude-farsi-rtl.user.js)
   — the manager will prompt to install.
3. Settings live in the Tampermonkey toolbar menu (enable/disable RTL,
   pick a Farsi font). Per-browser local storage; no cross-device sync.

For the full feature set (prompt library, bundled Vazirmatn, font
picker UI, settings UI) install the extension instead.

### Chrome — unpacked (developer mode)

The Chrome Web Store listing is deferred until the $5 one-time developer
fee is paid. For now, sideload:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and pick this directory (`claude_extention/`).
4. Open or refresh any `https://claude.ai/*` or `https://chatgpt.com/*` tab.

To update after editing files: hit the reload icon for the extension on
`chrome://extensions`, then refresh the chat tab.

## Features

### 1. Per-block Farsi RTL

A content script scoped to `https://claude.ai/*`, `https://chatgpt.com/*`,
and `https://chat.openai.com/*` watches the page with a
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

Click the extension icon → **Fonts** tab. Two dropdowns:

- **Farsi font** — applied to detected Farsi blocks. Options include the
  bundled Vazirmatn (default), Tahoma, IRANSans, Segoe UI, etc.
- **English font** — applied to English-dominant blocks that sit *inside* a
  Farsi container (so mixed-language messages render cleanly). Options include
  the system default, Inter, Georgia, Arial, monospace, etc.

The setting is global across both claude.ai and chatgpt.com — choose once,
applies everywhere. Selections persist in `chrome.storage.local` and apply
live (the content script mirrors them onto `documentElement` as
`--farsi-font` / `--english-font` CSS variables, which `styles.css` reads).
A small live preview sits under each dropdown. **Reset** restores the
bundled Vazirmatn / system defaults.

> Heads-up: the English font only takes effect on English blocks that sit
> inside a Farsi-marked container. In an English-only conversation, no
> blocks get tagged, so the English font dropdown will look like it isn't
> doing anything — that's expected. The site's own font wins.

### 3. Local prompt library

Click the extension icon → **Prompts** tab.

- **+ Add** opens a small form (title + body). Titles are unique
  (case-insensitive) — duplicates are rejected so the list stays a clean
  index. New prompts are pushed to the top of the list.
- Each saved prompt shows three insert actions:
  - **↥ Top** — insert at the very beginning of the composer.
  - **⌖ Here** — insert at the caret position you last had inside the composer.
  - **↧ End** — insert at the very end of the composer.
- Each card also has **✎** (inline edit — swaps the card into a title +
  body form; Save validates uniqueness against other prompts, Cancel
  reverts) and **×** (delete, no confirm — list re-renders immediately
  via the `chrome.storage.onChanged` listener) on one row.
- The body preview on each card is truncated to **N** characters (default
  100, configurable in Settings as "Prompt preview length", clamped to
  20–2000). The full body is always inserted into the composer.

A claude.ai or chatgpt.com tab must be open for insertion to work — the popup
finds the active supported tab (or any supported tab if none are active) and
sends a `cfr-insert` message to the content script. The popup closes itself
right after inserting so focus returns to the composer. If direct insertion
fails (e.g. the composer can't be found, or the page rejects `insertText`),
the prompt is copied to your clipboard as a fallback.

Insertion uses `document.execCommand('insertText')` with a `beforeinput`
event as fallback — both work against ProseMirror-style `contenteditable`
composers on Claude and ChatGPT. The composer is located heuristically as
the bottom-most large `contenteditable` / `role="textbox"` on the page.

Prompts are stored under `chrome.storage.sync` by default — they follow you
across browsers and devices signed into the same Google (Chrome) or Mozilla
(Firefox) account. Turn off **Sync prompts across devices** in Settings to
keep the list local to this browser. Either way: no network calls from this
extension, your browser handles the sync transparently.

**Cross-browser sync** (Chrome ↔ Firefox) is **not** automatic — the two
browsers use different sync accounts and don't share storage. Use
**Export / Import** in the Prompts tab to move your library between them.

#### Export / Import

Top of the Prompts tab, next to **+ Add**:

- **Export** downloads the current list as `claude-farsi-rtl-prompts-YYYY-MM-DD.json`.
- **Import** opens an inline paste form. Open your exported JSON file in
  any text editor, copy its contents, paste them into the form, and hit
  Import. (Paste rather than a file picker because Chrome MV3 closes the
  popup the moment a native file dialog steals focus.) Duplicates
  (case-insensitive title match against your existing prompts) are
  skipped and counted in the status line. Imported entries are added to
  the top of the list.

Use this as a backup, a cross-browser bridge, or a way to seed a new
device. The format is documented and accepts either the wrapped envelope
or a bare `[{title, body}]` array.

**Storage limits to know:** `chrome.storage.sync` caps at ~100KB total
and ~8KB per item. A too-large import will surface a clear error rather
than silently failing.

### 4. Settings tab

Click the extension icon → **Settings** tab.

- **Extension enabled** — master switch. Off makes the extension fully
  inert: the MutationObserver disconnects, any `data-farsi-rtl` marks are
  stripped, font CSS variables are removed, and prompt-insert messages get
  a "disabled" response.
- **Farsi RTL** — toggle just the RTL detector. When off, blocks revert to
  the host site's typography.
- **Font overrides** — toggle just the font CSS variables. When off, both
  the Farsi and English font picks stop applying (selections in the Fonts
  tab are preserved for when you re-enable).
- **Prompt insertion** — toggle just the popup → composer insert path.
  When off, prompt cards are still visible/editable but the Top/Here/End
  buttons return a "disabled" status. The library itself stays intact.
- **Sync prompts across devices** — when on, prompts live in
  `chrome.storage.sync` and follow your browser account; when off, they
  stay in `chrome.storage.local` on this device only. Flipping the toggle
  copies your current list to the new area (the source isn't deleted, so
  flipping back restores that snapshot). Not gated by the master switch
  — storage choice is orthogonal to whether the extension is currently
  active.
- **Prompt preview length** — number of characters to show per prompt
  card. Range 20–2000, default 100. The full body is still inserted.

When master is off, the four sub-controls go visually disabled but keep
their stored values so flipping master back restores your prior layout.

## Files

- `manifest.json` — MV3, host permissions for `claude.ai`, `chatgpt.com`, and `chat.openai.com`; `storage` permission for settings/prompts. Includes a `browser_specific_settings.gecko` block so the same manifest works on Firefox 142+.
- `content.js` — Farsi/English block detection, MutationObserver, font CSS-variable wiring, caret tracking + insert message handler. Site-agnostic — relies on generic block tags and `contenteditable`.
- `styles.css` — `@font-face` for bundled Vazirmatn + RTL styling.
- `popup.html` / `popup.css` / `popup.js` — tabbed popup (Prompts + Fonts + Settings). Prompts tab handles add/edit/delete/export/import and sends insert commands; Settings tab holds feature toggles and the preview-length input.
- `fonts/Vazirmatn-{Regular,Bold}.woff2` — bundled webfonts (Vazirmatn v33.003 by
  rastikerdar, [SIL Open Font License](https://github.com/rastikerdar/vazirmatn/blob/master/OFL.txt)).
- `icons/` — extension icons.
- `userscript/claude-farsi-rtl.user.js` — Tampermonkey / Violentmonkey lite port (RTL only).

## Firefox sync notes

The extension uses `chrome.storage.sync` (Firefox aliases the API), so on
Firefox prompts ride on your Firefox Account:

- You need **Firefox Sync** enabled with **Add-ons** checked under
  `about:preferences` for cross-device sync to actually flow.
- Sync interval is ~10 minutes (Chrome syncs closer to real-time).
- **Firefox for Android** does not sync extension data
  ([Mozilla bug 1625257](https://bugzil.la/1625257)) — on Android the
  prompts behave as local-only. Use Export / Import to move them.
- Quotas are identical to Chrome — 100KB total, 8KB per item, 512 items max.

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
visible to the host page's own scripts.
