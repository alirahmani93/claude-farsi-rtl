# Changelog

All notable changes to **Claude.ai Farsi RTL** are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the extension follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **“Sync prompts across devices” toggle** in the Settings tab
  (`syncPromptsEnabled`, default on). When on, prompts live in
  `chrome.storage.sync` and follow the user across browsers / laptops.
  When off, prompts live in `chrome.storage.local` on this device only.
  Flipping the toggle copies the currently-visible list from the old
  area into the new one (via `migratePromptsOnToggle()`), so the user’s
  list never silently changes underneath them. The source area is
  intentionally left untouched — flipping back restores that snapshot.
- The new toggle is **not** master-gated: storage choice is orthogonal
  to whether the extension is active, and the user can change it even
  when the master switch is off.

### Changed
- **Prompt library now syncs across devices by default.** Prompts moved
  from `chrome.storage.local` to `chrome.storage.sync`. No new
  permissions, no network code on our side — Chrome handles the sync
  layer.
- A one-time `migratePromptsToSync()` runs on the first popup open
  after the update: it copies any pre-existing `local.prompts` into
  `sync.prompts` (only when sync is empty), removes the local copy, and
  writes `local._promptsMigrated: true` so the migration never repeats.
  When the user has the new sync toggle already off, the migration is
  skipped — their opt-out is respected.

### Notes
- Font choices, feature toggles, and the prompt-preview length stay in
  `chrome.storage.local` by design — they're device-level preferences
  (font availability differs per OS).
- `chrome.storage.sync` caps: ~100 KB total, ~8 KB per item, ~120 writes/min.
  Plenty for a prompt library, but a single >8 KB prompt body will not save.

## [1.2.0] — 2026-06-04

### Added
- **ChatGPT support.** Extension now runs on `chatgpt.com` (and the legacy
  `chat.openai.com` redirect) alongside `claude.ai`. The content script is
  site-agnostic — it keys off generic tags (`<p>`, `contenteditable`,
  `role="textbox"`), so it covers both hosts without per-site selectors.
- `manifest.json` host matches, content-script matches, and
  `web_accessible_resources` matches all updated to cover the three hosts;
  `SUPPORTED_URLS` in `popup.js` mirrors them.

## [1.1.0] — 2026-06-04

### Added
- **Font picker (Farsi + English).** Popup writes `farsiFont` / `englishFont`
  to `chrome.storage.local`; content script mirrors them onto
  `documentElement` as `--farsi-font` / `--english-font` CSS custom
  properties that `styles.css` reads. Live preview in the popup, live
  propagation to the chat tab via `chrome.storage.onChanged`.
  - The English font is intentionally scoped: it only affects English
    blocks nested inside a Farsi-marked container — never the whole page.
- **Local prompt library.** Save reusable prompts and insert them into the
  composer with one click. Three insertion modes: `top`, `cursor`, `end`.
  - `cursor` mode uses a `selectionchange` listener in `content.js` to
    cache `lastEditor` / `lastRange` (the popup-spawned context can't read
    the live selection — opening the popup steals focus).
  - `findComposer()` picks the bottom-most `contenteditable="true"` or
    `div[role="textbox"]` wider than 100 px — works on both Claude and
    ChatGPT (both ProseMirror).
  - Insertion path: `execCommand('insertText')` → `beforeinput` InputEvent
    → clipboard fallback. Popup auto-closes ~250 ms after a successful
    insert so focus returns to the composer.
  - Inline edit (✎) and delete (×) per card; titles are unique
    (case-insensitive) so the list reads as an index, not a log.
- **Settings tab.** Master `enabled` toggle plus per-feature `rtlEnabled`,
  `fontsEnabled`, `promptsEnabled` switches. Master off → per-feature
  switches go visually disabled but keep their stored value. Prompt-preview
  length input (`promptPreviewChars`, clamped to `[20, 2000]`, default 100).
- Bundled **Vazirmatn** webfont (Regular + Bold, OFL license) so Farsi
  rendering doesn't depend on the host OS.

## [1.0.0] — 2026-06-04

### Added
- Initial release: per-block Farsi RTL detection for `claude.ai`.
- `MutationObserver` over the page; for each prose block (`<p>`, `<li>`,
  headings, etc. — `<div>` deliberately excluded), sample ~50 chars and
  flip to `dir="rtl" lang="fa"` when Persian letters exceed the 0.4
  threshold. `<pre>` / `<code>` always skipped.

### Fixed
- Nested English blocks inside a Farsi container are flipped back to LTR
  (no RTL bleed into code samples, English quotes, etc.).
- Mixed-line bidi rendering cleaned up so paragraphs that mix scripts
  read correctly.

[Unreleased]: https://github.com/pinali/claude_extention/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/pinali/claude_extention/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/pinali/claude_extention/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/pinali/claude_extention/releases/tag/v1.0.0
