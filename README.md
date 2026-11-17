# REDUCTIONS

A single-file, dependency-free browser application that plays one audio source continuously and applies a fixed sequence of 300 live effect patterns (100 composers × 3 slots × 10 s) on top of the stream.

## What the code does

- **Source handling.** Local file (picker or drag & drop), HTTP URL, or a built-in 90-second stereo demo synthesized in-page (22050 Hz WAV). The source is connected via `<audio>` + `URL.createObjectURL()` → `createMediaElementSource()`. The browser streams the file from disk; it is never decoded into memory as a whole.
- **Pattern clock.** `pattern = floor(t / 10)`, `composer = floor(pattern / 3) % 100`, `slot = pattern % 3`. One full pass over the 100-composer list takes 50:00. Sources longer than that loop the list; shorter sources stop at end of file.
- **Seamless switching.** Each pattern's node chain is built on the idle bus (A/B). The previous bus fades out and the new one fades in over 0.9 s, after which the old nodes are stopped and disconnected.
- **Ring buffer.** A `ScriptProcessorNode` keeps the last ~4 s of the live signal in two `Float32Array`s. Granular and tape operations read their material from it.
- **Live operations** (Web Audio nodes): `dry, filt, ring, trem, pan, echo, comb, res, shaper, gate, dyn, notch, formant, space, chain, grain, freeze, cloud, harm, canon, phase, warp, tape, osc, clicks, silence, xf, alt`.
- **Tape operations**, rendered offline from a 1–4 s ring-buffer snapshot: `reverse, shuffle, loop, palin, speed, additive, stutter, crush, transient`.
- **Master chain.** Bus sum → lowpass (tone) → waveshaper (drive) → mid/side width → master gain → switchable compressor limiter → analyser (FFT 256) → output. Reverb is a send into four feedback delays with stereo panning.
- **Determinism.** A seed derived from the source file name drives all randomized parameters (shuffle order, click timing, grain jitter), so the same file always produces the same processing sequence.

## Data

`C` is an array of 100 composer entries: name, years, family (8 color-coded groups), and 3 patterns per composer. Each pattern holds a title, a fidelity mark (`d` documented technique, `r` reconstruction, `i` interpretation), a description, a historical reference, and an `fx` list of operations with parameters.

- The transformation vocabulary follows Trevor Wishart, *Audible Design* (1994).
- The composer selection is based on tENTATIVELY, a cONVENIENCE, "Top 200 Favourite Composers": http://idioideo.pleintekst.nl/Top100Composers.html
- Entries 015 (Brody) and 054 (Kamin) share a bell/echo motif: both died in the same car accident on 2010-04-11.

## Interface

- **Transport.** Play/pause, ±30 s, restart, loop of the current 30 s block, scrubbable timeline with per-block color segments and ghost preview. Keyboard: `Space`, `←/→`, `Home`, `M` (mute), `R` (record).
- **Mixer** (persisted in `localStorage`). Volume, source↔effect balance, lowpass cutoff 200–18000 Hz, drive 1–20, reverb send, stereo width 0–2, playback rate 0.5–1.5× (changes tempo and pitch), density/quality mode (auto / 1 / 0.6 / 0.35; auto selects 0.55 on mobile or ≤4 CPU cores and scales grain, cloud and click counts), limiter on/off, reset, randomize.
- **Tabs.** Journal (pattern transition log), manifest (searchable list of 100 composers; clicking a row seeks to that 30 s block), diagnostics (graph state, ring buffer fill, live node counts per bus, error log, self-test).
- **Spectrum canvas.** Analyser FFT bars colored by the current composer family.
- **Recording.** `MediaRecorder` on a tap of the master output (webm/opus, mp4 fallback) with a download link.
- **Export.** Full manifest as JSON; generated README.md.
- **Share.** Copies a URL with a `?t=` timestamp; opening such a URL seeks to that position.
- **Wake Lock.** Requested during playback where supported, to keep the screen on.

## Running

- Open the HTML file directly (`file://` works for local files via object URLs), or serve the folder: `python -m http.server 8000`.
- No dependencies, no build step. Network requests occur only for optional URL streaming.
- URL streaming is subject to the browser's media CORS rules.

## Diagnostics and self-test

- Runtime errors and unhandled promise rejections are captured into an in-page error log with a badge counter.
- The self-test validates the dataset: 100 composers, 300 patterns, non-empty texts, known families and fidelity marks, and that every `fx` name maps to an implemented operation, including nested `chain`, `xf` and `alt` lists.
- A per-pattern build failure is logged with composer/slot and operation name instead of interrupting playback.

## Requirements

A modern browser with Web Audio API. `MediaRecorder` (recording) and Screen Wake Lock are optional and degrade gracefully.
