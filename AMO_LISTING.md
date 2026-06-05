# AMO listing copy — Claude.ai Farsi RTL

Use this when submitting to https://addons.mozilla.org/developers/.
Not part of the extension itself — `.gitignore` candidate.

## Step 0 — Build the upload artifact

```bash
# From the repo root:
npx --yes web-ext@latest lint   # confirm 0 errors, 0 warnings (current state)
npx --yes web-ext@latest build  # produces web-ext-artifacts/<name>-<version>.zip
```

Then either:

- **Web UI:** upload the zip at https://addons.mozilla.org/developers/addon/submit/
- **CLI:** `npx --yes web-ext@latest sign --channel=listed --api-key=... --api-secret=...`
  (get keys from https://addons.mozilla.org/developers/addon/api/key/)

## Listing copy

### Name

```
Claude.ai Farsi RTL
```

### Summary (250 char limit)

```
Per-block Farsi RTL for claude.ai and chatgpt.com. Detects Persian
paragraphs and flips them to right-to-left without touching English or
code blocks. Bundled Vazirmatn font, font picker, synced prompt library.
No network calls.
```

### Description (markdown — keep short)

```
A tiny extension for claude.ai and chatgpt.com that makes Persian
conversations readable.

WHAT IT DOES
- Per-block Farsi RTL: only paragraphs that are actually Persian flip to
  right-to-left. English replies, code, and the site UI are left alone.
- Bundled Vazirmatn font (SIL Open Font License).
- Font picker for Farsi and English text inside the popup.
- Synced prompt library: save reusable prompts and one-click insert them
  into the chat composer. Prompts follow you across browsers signed into
  the same account (via the browser's native sync).
- Manual Export / Import as a JSON file — backup or move your prompts
  between Chrome and Firefox.
- Per-feature toggles in Settings (RTL, fonts, prompts, sync).

WHAT IT DOES NOT DO
- No network calls. Ever. The font is bundled into the extension.
- No analytics, no telemetry, no remote configuration.
- No data leaves your browser.

PERMISSIONS
- "storage": for your prompts and settings.
- Host access for claude.ai, chatgpt.com, and the legacy chat.openai.com
  domain — required to read the page content and flip Persian paragraphs.

The extension keeps its original "Claude.ai Farsi RTL" name even though
it also runs on chatgpt.com. Source code, issue tracker, and roadmap:
https://github.com/alirahmani93/claude-farsi-rtl
```

### Categories

- Primary: **Appearance**
- Secondary: **Search Tools** *(optional — only if AMO requires a second)*

### Tags

`farsi`, `persian`, `rtl`, `claude`, `chatgpt`, `prompts`, `vazirmatn`

### License

MIT (already in the repo as `LICENSE`).

### Privacy Policy

This extension does not collect, transmit, or store any personal data
outside your own browser. Your prompts and settings live in
`chrome.storage.local` (device-only) and `chrome.storage.sync` (synced
by your browser's account, not by us). There are no network calls. The
Vazirmatn font is bundled into the extension and loaded locally.

### Data collection (Firefox's required disclosure)

- **Does the extension collect, transmit, or share user data?** No.
- The manifest's `data_collection_permissions.required` is `["none"]`,
  which AMO surfaces in the listing automatically.

### Source code review (Firefox sometimes asks)

The extension has no build step. The `.xpi` upload contains exactly the
JavaScript and CSS in this repo, plus the Vazirmatn `.woff2` font files
which are checked in unchanged from
https://github.com/rastikerdar/vazirmatn/releases (v33.003).

No bundler, no minifier, no transpiler.

### Screenshots to capture (1280×800 recommended)

1. **Hero:** a claude.ai or chatgpt.com conversation in mixed
   Persian/English showing the RTL flipping in action.
2. **Fonts tab:** popup with the Farsi font dropdown open and the live
   preview visible.
3. **Prompts tab:** the prompt library with 2–3 saved prompts, showing
   the **+ Add / Export / Import** row and the Top / Here / End buttons.
4. **Settings tab:** all toggles visible, master + per-feature + sync.
5. **(Optional)** Export → JSON file open in a text editor showing the
   format, illustrating "your data, in your hands."

### After approval

- Replace the placeholder in `README.md` ("*Listing pending — link will
  go here once the AMO review clears.*") with the AMO install link.
- Reply on issue #1 with both the AMO link and the userscript link, then
  close the issue.
