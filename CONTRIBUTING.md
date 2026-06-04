# Contributing

Thanks for the interest. This is a tiny Chrome MV3 extension — no build
step, no dependencies, no network calls — so contributing is mostly:

1. Clone the repo.
2. Load it as an unpacked extension.
3. Edit a file.
4. Reload and test in the browser.
5. Open a PR.

The sections below walk through the conventions that keep the project
small and predictable. Please read them before sending non-trivial
changes — most of them encode decisions made deliberately, not by
accident.

## Project shape

| | |
|---|---|
| Manifest | MV3, `manifest.json` |
| Build step | none |
| Dependencies | none |
| Network calls | **zero** — this is a core promise of the extension |
| Permissions | `storage` + three host matches (`claude.ai`, `chatgpt.com`, `chat.openai.com`) |
| Tests | manual; see [Testing](#testing) |

The whole extension is ~6 files of vanilla JS, HTML, and CSS plus a
bundled webfont. Resist the urge to add a build pipeline or a framework.

## Setup

```bash
git clone <your-fork-url>
cd claude_extention
```

Load it into Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and pick the repo directory.
4. Open a [claude.ai](https://claude.ai) or [chatgpt.com](https://chatgpt.com) tab.

After any code change: hit the **↻ Reload** button on the extension card
in `chrome://extensions`, then refresh the host tab. There is no HMR.

## Files

```
manifest.json   — MV3 manifest, three host patterns
content.js      — RTL detector, font CSS-var wiring, prompt insertion
popup.html      — tabbed popup (Prompts + Fonts + Settings)
popup.css
popup.js        — popup logic; reads/writes chrome.storage
styles.css      — @font-face for Vazirmatn + RTL rules
fonts/          — bundled Vazirmatn (OFL — see LICENSE)
icons/          — extension icons
CLAUDE.md       — deeper notes on conventions and gotchas
CHANGELOG.md    — Keep a Changelog
```

[`CLAUDE.md`](./CLAUDE.md) is the authoritative reference for *why*
things are shaped the way they are. Read it before you change anything
non-cosmetic.

## Conventions (read before editing)

These are deliberate — please don't "fix" them without a discussion in
an issue first.

### 1. Site-agnostic content script

`content.js` keys off generic tags (`<p>`, `<li>`, headings,
`contenteditable`, `role="textbox"`) — never per-site DOM selectors.
This is what lets it work on both Claude and ChatGPT, and survive
their DOM changes. If you find yourself reaching for a site-specific
class or data-attribute, prefer extending the existing heuristics
(e.g. `findComposer()`).

### 2. Three URL lists stay in sync

When adding or changing a supported host, update **all** of these in
the same change:

- `manifest.json` → `host_permissions`
- `manifest.json` → `content_scripts[0].matches`
- `manifest.json` → `web_accessible_resources[0].matches`
- `popup.js` → `SUPPORTED_URLS`

Forgetting any one of them is a silent bug.

### 3. No new permissions

Beyond `storage` and the three host matches. The extension's pitch is
"no network calls, minimal trust" — don't add `identity`, `tabs`
(beyond what's already allowed by host matches), `scripting`, etc.
without a strong justification in the PR description.

### 4. No network calls

Ever. No `fetch`, no CDN fonts, no telemetry, no analytics, no error
reporting service. The font is bundled (`fonts/Vazirmatn-*.woff2`)
and so is everything else.

If you genuinely need cross-device state, use `chrome.storage.sync`
(Chrome handles the sync layer — your code makes no network calls).

### 5. Storage keys

Current keys, and where they live:

- `chrome.storage.sync`: `prompts` *when `syncPromptsEnabled` is on*.
- `chrome.storage.local`: `farsiFont`, `englishFont`, `enabled`,
  `rtlEnabled`, `fontsEnabled`, `promptsEnabled`, `syncPromptsEnabled`,
  `promptPreviewChars`, `_promptsMigrated`, and `prompts` when sync is
  off (or as a snapshot from a previous off-period).

If you introduce a new key, prefix or namespace it sensibly, document
it in `CLAUDE.md`'s "Storage keys in use" section, and decide
deliberately whether it belongs in `local` (device-level prefs) or
`sync` (content the user wants on every device).

### 6. Composer message protocol

The popup talks to the content script with:

```js
{ type: 'cfr-insert', body: string, position: 'top' | 'cursor' | 'end' }
```

Content script replies with `{ ok, error? }`. Don't change this
protocol without a coordinated update on both ends.

### 7. Settings tab is the home for knobs

All user-facing toggles and configurable values live in the **Settings**
tab, not scattered into Prompts or Fonts. New knobs go there too.

### 8. The English font picker is intentionally narrow

It only affects English blocks nested inside a Farsi-marked container
(`[data-farsi-rtl="0"]`). In an English-only chat, the dropdown is
inert — this is **by design**. Do not widen the rule to `:root` or
`body`; that would override the host site's typography.

## Testing

No automated tests. Run through this flow manually before opening a PR:

1. Reload the extension at `chrome://extensions`.
2. Open / refresh a `claude.ai` *and* a `chatgpt.com` tab.
3. Paste mixed Farsi/English text — verify per-block RTL flips.
4. Open popup → **Fonts** → change font → see live preview and live
   update in the chat tab.
5. Open popup → **Prompts** → save one → click **Top** / **Here** /
   **End** → verify each inserts in the right place.
6. Open popup → **Prompts** → ✎ on a card → edit body → **Save** →
   verify the update.
7. Open popup → **Settings** → toggle master off → verify RTL reverts,
   font vars cleared, prompt insert returns the disabled error.
   Toggle each per-feature switch independently and confirm only
   that feature stops.
8. Open popup → **Settings** → change "Prompt preview length" →
   switch to **Prompts** → verify card truncation respects the new
   value.
9. Open popup → **Settings** → flip "Sync prompts across devices" →
   verify the visible list is preserved (it should be copied into the
   new storage area). Flip back → verify the list returns.

If your change touches anything not listed, add a step that covers it
to your PR description.

## Pull requests

- One logical change per PR. Bundle UI + wiring + docs that go
  together; don't bundle unrelated work.
- Update `CHANGELOG.md` under **Unreleased** for any user-visible
  change. Follow [Keep a Changelog](https://keepachangelog.com)
  conventions.
- Update `CLAUDE.md` if you change a convention or storage key.
- Bump `manifest.json` `version` when cutting a release; move the
  Unreleased entry under the new version + date.
- Match the existing comment style: explain *why*, not *what*. The
  code already says what.

## Reporting issues

When opening an issue:

- Browser + version (`chrome://version`).
- Which host (`claude.ai` / `chatgpt.com` / `chat.openai.com`).
- Steps to reproduce — ideally the exact text you pasted into the chat.
- A screenshot is worth more than a paragraph for RTL / font issues.

## Licensing of contributions

By submitting a PR, you agree your contribution is licensed under the
MIT license used by the rest of the project (see [LICENSE](./LICENSE)).

The bundled Vazirmatn font in `fonts/` is OFL-1.1 and is **not**
covered by the project's MIT license. If your contribution swaps,
adds, or removes a bundled font, please include or update the
corresponding upstream license text alongside the font files.
