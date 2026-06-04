# CLAUDE.md — claude_extention

Tiny Chrome MV3 extension. No build step, no dependencies, no network calls.
The font is bundled. After any change, the user reloads via
`chrome://extensions` and refreshes the host tab.

## Scope

Runs on three hosts (declared in `manifest.json`):

- `https://claude.ai/*`
- `https://chatgpt.com/*`
- `https://chat.openai.com/*` (legacy domain — redirects to chatgpt.com, kept for safety)

The extension is still named **"Claude.ai Farsi RTL"** even though it covers
ChatGPT too. Do not rename the extension or files unless the user asks —
they explicitly deferred rebranding.

## Three features (all in one content script)

1. **Per-block Farsi RTL** — `MutationObserver` over the page; for each prose
   block (`<p>`, `<li>`, headings, etc., *not* `<div>`), sample ~50 chars and
   flip to `dir="rtl" lang="fa"` if Persian letters exceed `THRESHOLD` (0.4).
   Nested English blocks inside a Farsi container get flipped back to LTR.
   `<pre>` / `<code>` are skipped.

2. **Font picker** — popup writes `farsiFont` / `englishFont` to
   `chrome.storage.local`; content script mirrors them onto
   `documentElement` as `--farsi-font` / `--english-font` CSS variables that
   `styles.css` reads.
   - Font lists live in `FARSI_FONTS` / `ENGLISH_FONTS` arrays at the top of
     `popup.js` — keep the defaults aligned with `DEFAULT_FARSI_FONT` /
     `DEFAULT_ENGLISH_FONT` in `content.js`.
   - Custom values from older installs are preserved by `fill()` — it
     appends a "Custom (…)" option when the stored value isn't in the list.
   - The English font is only visible when an English block sits inside a
     Farsi-marked container (`[data-farsi-rtl="0"]`). In English-only
     conversations nothing gets tagged and the dropdown appears inert —
     this is by design. Don't "fix" it by applying the font globally; that
     would override the host site's typography.
   - `applyPreview()` updates the in-popup preview elements; live propagation
     to the chat tab is via the content script's `chrome.storage.onChanged`
     listener — no tab message needed.

3. **Local prompt library** — popup stores prompts in
   `chrome.storage.local` and sends `{type: 'cfr-insert', body, position}`
   via `chrome.tabs.sendMessage` to the active supported tab.
   - Schema: `{id: string, title: string, body: string}` array under key
     `prompts`. New entries are unshifted (newest first). `id` from
     `crypto.randomUUID()` with a `p_<ts>_<rand>` fallback.
   - Title uniqueness is enforced case-insensitively in `popup.js` — don't
     remove that check; the list reads as an index, not a log.
   - `position` is `'top' | 'cursor' | 'end'`. `'cursor'` requires that the
     user clicked into the composer before opening the popup — the popup
     steals focus, so `content.js` tracks `lastEditor` / `lastRange` via a
     `selectionchange` listener. Don't try to read the live selection from
     the popup-spawned context — it'll be empty.
   - `findComposer()` picks the bottom-most `contenteditable="true"` /
     `div[role="textbox"]` wider than 100px. This works on both Claude and
     ChatGPT (both ProseMirror). If a site lands with a different composer
     shape, prefer extending this heuristic over hardcoding a selector.
   - Insertion path: `execCommand('insertText')` first, then a
     `beforeinput` `InputEvent`, then clipboard fallback. All three return
     a structured `{ok, error}` to the popup so `flashStatus()` can show
     the right message.
   - The popup auto-closes ~250ms after a successful insert so focus
     returns to the composer.

## Conventions

- **Site-agnostic content script.** Don't add per-site DOM selectors —
  the script keys off generic tags (`<p>`, `contenteditable`, `role="textbox"`)
  so it works on both Claude and ChatGPT (and survives their DOM changes).
- **Three URL lists must stay in sync** in `manifest.json`:
  `host_permissions`, `content_scripts[0].matches`,
  `web_accessible_resources[0].matches`. And `SUPPORTED_URLS` in `popup.js`.
- **No new permissions** beyond `storage` + the three host matches. The
  extension's pitch is "no network calls" — keep it that way.
- **Storage keys in use:** `farsiFont`, `englishFont`, `prompts`.
- **Composer message protocol:** `{type: 'cfr-insert', body: string, position: 'top' | 'cursor' | 'end'}`.

## Testing

No automated tests. Manual flow:

1. Reload extension at `chrome://extensions`.
2. Open / refresh a claude.ai *and* a chatgpt.com tab.
3. Paste mixed Farsi/English text — verify per-block RTL.
4. Open popup → Fonts → change font → see live preview + chat updates.
5. Open popup → Prompts → save one → click Top / Here / End → verify insert.

## Files

- `manifest.json` — MV3 manifest, three host patterns.
- `content.js` — RTL detector, font CSS-var wiring, prompt insertion handler.
- `styles.css` — `@font-face` for bundled Vazirmatn + RTL rules keyed off `[data-farsi-rtl="1"]`.
- `popup.html` / `popup.css` / `popup.js` — tabbed popup (Prompts + Fonts).
- `fonts/Vazirmatn-{Regular,Bold}.woff2` — bundled webfont (OFL).
- `icons/` — extension icons.
