# Claude.ai Farsi RTL

A tiny Chrome (MV3) extension that adds **per-block** Farsi RTL + Vazirmatn font to
[claude.ai](https://claude.ai). English/LTR blocks and code stay untouched. No
build step, no dependencies, no network calls — the font is bundled.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and pick this directory (`claude_extention/`).
4. Open or refresh any `https://claude.ai/*` tab.

To update after editing files: hit the reload icon for the extension on
`chrome://extensions`, then refresh the Claude tab.

## How it works

A content script scoped to `https://claude.ai/*` watches the page with a
`MutationObserver` and, for each prose block (`<p>`, `<li>`, `<h1>`–`<h6>`,
`<blockquote>`, table cells, etc.), samples the first ~50 characters of text. If
Persian characters (U+0600–U+06FF / U+FB50–U+FDFF / U+FE70–U+FEFF) make up more
than ~40% of the letter characters, that *single block* gets `dir="rtl"
lang="fa"` and the Vazirmatn font stack via a `data-farsi-rtl` attribute hook.
Anything inside `<pre>` or `<code>` is skipped, generic `<div>`s are ignored
(so the Claude chrome stays LTR), per-block re-evaluation is debounced ~150 ms
to avoid mid-stream flicker, and the composer's contenteditable is reprocessed
on each `input` event.

## Files

- `manifest.json` — MV3, host permission limited to `claude.ai`.
- `content.js` — detection + observer + composer hook.
- `styles.css` — `@font-face` for bundled Vazirmatn + RTL styling scoped to tagged blocks.
- `fonts/Vazirmatn-{Regular,Bold}.woff2` — bundled webfonts (Vazirmatn v33.003 by
  rastikerdar, [SIL Open Font License](https://github.com/rastikerdar/vazirmatn/blob/master/OFL.txt)).

## Tuning

Constants at the top of `content.js`:

- `THRESHOLD` (0.4) — Persian-letter ratio required to flip a block.
- `SAMPLE_LEN` (50) — how many leading characters to sample.
- `DEBOUNCE_MS` (150) — per-block re-evaluation delay during streaming.
