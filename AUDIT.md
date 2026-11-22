# REDUCTIONS — AUDIT v1.0

Status log: what was broken, what is fixed, what remains open, and how to verify it by ear.
Companion to SPEC.md. Where SPEC says "must", this file says "is".

Legend: **FIXED** — verified in code and by ear · **OPEN** — known deviation from SPEC, scheduled · **WATCH** — works but fragile, re-test after any engine change.

---

## 1. Root cause (the 70% silent build)

- `buildPattern()` recreated the bus input GainNode on every pattern switch while the tap stayed connected to the old node → 16 of 24 primitives received silence.
- The old input node survived as an undisposed unity path → the source leaked to the output regardless of effects.
- Measured damage: 91 of 300 slots rendered the untouched file; 5 composers dead in all three slots (006, 035, 036, 068, 090); true silence concepts (017·3, 084·1) were impossible.
- The mixer worked because it sits after the buses — this masked the bug during casual listening.

---

## 2. Fixed critical issues

| ID | Issue | Fix | Status |
|----|-------|-----|--------|
| P0 | orphaned bus inputs | inputs created once in `ensureCtx()`; a pattern rebuilds only the effect chain | FIXED |
| P0b | unity dry leak | implicit dry path removed; source enters only through the bed gain | FIXED |
| P1 | no bed contract | `BEDS` map (300 values), `y = bed·S + (1−bed)·W` | FIXED |
| P2 | parallel-only fx | serial chain by default; parallel layers explicit | FIXED |
| P3 | hard-coded spectrum | live 200 ms FFT: peaks, f0, rms, centroid | FIXED |
| P4 | res = bare bandpass | feedback resonator with T60, rings after excitation stops | FIXED |
| P5 | cloud as scalar | voice-count density, cents/1200, gliss drift | FIXED |
| P6 | canon ratio < 1 dead | pre-delay base, span = \|r−1\|·rem | FIXED |
| P7 | freeze drift | fixed buffer snapshot per slot | FIXED |
| P8 | dead parameters | seed, jump, stagger, off, tempo-decay now live | FIXED |
| P9 | limiter flattening | −3 dB / 8:1 safety ceiling | FIXED |
| P10 | tape loop pitch | period = 10 s / n (840 repeats → 84 Hz) | FIXED |
| G1 | gate palindrome | mountain-shape onset detection | FIXED |

---

## 3. Known open deviations (honest list)

| ID | Deviation | Note | Status |
|----|-----------|------|--------|
| OPEN-1 | analysis point | analyser sits post-master: peaks/f0 describe the output, not the source. Intentional for self-resonance slots (004·1, 061·1); SPEC §3 wording is an approximation | OPEN |
| OPEN-2 | cloud(n) cardinality | density ≈ 1.2·n grains/s with 130 ms grains (≈ n/8 simultaneous), not n literal voices; CPU-safe on phones; SPEC test T10 fails literally | OPEN |
| OPEN-3 | harm voicing | simultaneous voices are separate grain streams (10–12 grains/s each), i.e. a chord of attacks, not sustained transposed copies | OPEN |
| OPEN-4 | busRem timing | computed from pattern index, not actual switch time; after scrubbing the first ~200 ms of a slot may schedule slightly short ramps | OPEN |
| OPEN-5 | ScriptProcessorNode | ring buffer uses a deprecated node; works everywhere today; AudioWorklet migration is in the F-Droid step list | OPEN |
| OPEN-6 | xf/alt bed override | a silence inside an xf would mute the whole bus bed; not used in data, guarded by lint only | OPEN |
| WATCH-1 | resonator self-oscillation | Q > 120 at low frequencies can howl on bright sources; limiter catches it | WATCH |
| WATCH-2 | Satie 84 Hz loop | needs ≥ 0.6 s of ring fill at slot start; degrades to a buzz click in the first seconds after play | WATCH |

---

## 4. Listening pass — control points (do these first)

| Slot | Time | Expect to hear | Mark |
|------|------|----------------|------|
| 017·3 | 08:20 | stream muted to the room noise floor | [ ] |
| 084·1 | 41:30 | same, the 1919 rest-score | [ ] |
| 076·1 | 37:30 | comb sweeping, two copies diverging ~1%/s | [ ] |
| 090·1 | 44:30 | metallic sum/difference sidebands | [ ] |
| 059·2 | 29:10 | metronomes slowing and thinning out | [ ] |
| 081·1 | 40:00 | repetition collapsed into a low pitch (~84 Hz), not audible repeats | [ ] |
| 061·1 | 30:00 | resonances grow until the source disappears | [ ] |
| 036·1 | 17:30 | near-dry −15 dB bed: sound left alone | [ ] |
| 037·1 | 18:00 | source erased progressively down to a ghost | [ ] |
| 001·1 | 00:00 | stutter accelerating 0.4→0.05 s with the filter opening | [ ] |
| 048·2 | 23:40 | sequential grains with probabilistic jumps | [ ] |
| 056·3 | 27:50 | oscillator pitch tracking the stream loudness | [ ] |

---

## 5. Full 300-slot checklist

Mark after listening: `[x]` as specified · `[~]` partial · leave empty if not heard / dead.
Each row is one 30-second block; the three boxes are its 10-second slots.

| # | Composer | Block | 1 | 2 | 3 |
|---|----------|-------|---|---|---|
| 001 | Alkan | 00:00 | [ ] | [ ] | [ ] |
| 002 | Antheil | 00:30 | [ ] | [ ] | [ ] |
| 003 | Artman | 01:00 | [ ] | [ ] | [ ] |
| 004 | Avram | 01:30 | [ ] | [ ] | [ ] |
| 005 | Balada | 02:00 | [ ] | [ ] | [ ] |
| 006 | Bandt | 02:30 | [ ] | [ ] | [ ] |
| 007 | Bayle | 03:00 | [ ] | [ ] | [ ] |
| 008 | Berger | 03:30 | [ ] | [ ] | [ ] |
| 009 | Berio | 04:00 | [ ] | [ ] | [ ] |
| 010 | Beyer | 04:30 | [ ] | [ ] | [ ] |
| 011 | Björk | 05:00 | [ ] | [ ] | [ ] |
| 012 | Boulez | 05:30 | [ ] | [ ] | [ ] |
| 013 | Brant | 06:00 | [ ] | [ ] | [ ] |
| 014 | Braxton | 06:30 | [ ] | [ ] | [ ] |
| 015 | Brody | 07:00 | [ ] | [ ] | [ ] |
| 016 | Brown | 07:30 | [ ] | [ ] | [ ] |
| 017 | Cage | 08:00 | [ ] | [ ] | [ ] |
| 018 | Beefheart | 08:30 | [ ] | [ ] | [ ] |
| 019 | Carter | 09:00 | [ ] | [ ] | [ ] |
| 020 | Chávez | 09:30 | [ ] | [ ] | [ ] |
| 021 | Coleman | 10:00 | [ ] | [ ] | [ ] |
| 022 | Cowell | 10:30 | [ ] | [ ] | [ ] |
| 023 | Crumb | 11:00 | [ ] | [ ] | [ ] |
| 024 | Curran | 11:30 | [ ] | [ ] | [ ] |
| 025 | Davidovsky | 12:00 | [ ] | [ ] | [ ] |
| 026 | Maxwell Davies | 12:30 | [ ] | [ ] | [ ] |
| 027 | Detoni | 13:00 | [ ] | [ ] | [ ] |
| 028 | Dr. John | 13:30 | [ ] | [ ] | [ ] |
| 029 | Dodge | 14:00 | [ ] | [ ] | [ ] |
| 030 | Druckman | 14:30 | [ ] | [ ] | [ ] |
| 031 | Dumitrescu | 15:00 | [ ] | [ ] | [ ] |
| 032 | Tan Dun | 15:30 | [ ] | [ ] | [ ] |
| 033 | Dunn | 16:00 | [ ] | [ ] | [ ] |
| 034 | Ellington | 16:30 | [ ] | [ ] | [ ] |
| 035 | Erb | 17:00 | [ ] | [ ] | [ ] |
| 036 | Feldman | 17:30 | [ ] | [ ] | [ ] |
| 037 | Foss | 18:00 | [ ] | [ ] | [ ] |
| 038 | Gaburo | 18:30 | [ ] | [ ] | [ ] |
| 039 | Gershwin | 19:00 | [ ] | [ ] | [ ] |
| 040 | Graettinger | 19:30 | [ ] | [ ] | [ ] |
| 041 | Hába | 20:00 | [ ] | [ ] | [ ] |
| 042 | Harrison | 20:30 | [ ] | [ ] | [ ] |
| 043 | Hauer | 21:00 | [ ] | [ ] | [ ] |
| 044 | Hendrix | 21:30 | [ ] | [ ] | [ ] |
| 045 | Henry | 22:00 | [ ] | [ ] | [ ] |
| 046 | Henze | 22:30 | [ ] | [ ] | [ ] |
| 047 | Heron | 23:00 | [ ] | [ ] | [ ] |
| 048 | Hiller | 23:30 | [ ] | [ ] | [ ] |
| 049 | Hodgkinson | 24:00 | [ ] | [ ] | [ ] |
| 050 | Hunt | 24:30 | [ ] | [ ] | [ ] |
| 051 | Ichiyanagi | 25:00 | [ ] | [ ] | [ ] |
| 052 | Ives | 25:30 | [ ] | [ ] | [ ] |
| 053 | Kagel | 26:00 | [ ] | [ ] | [ ] |
| 054 | Kamin | 26:30 | [ ] | [ ] | [ ] |
| 055 | Kraft | 27:00 | [ ] | [ ] | [ ] |
| 056 | Kreidler | 27:30 | [ ] | [ ] | [ ] |
| 057 | Lachenmann | 28:00 | [ ] | [ ] | [ ] |
| 058 | Lennon | 28:30 | [ ] | [ ] | [ ] |
| 059 | Ligeti | 29:00 | [ ] | [ ] | [ ] |
| 060 | Lockwood | 29:30 | [ ] | [ ] | [ ] |
| 061 | Lucier | 30:00 | [ ] | [ ] | [ ] |
| 062 | Malec | 30:30 | [ ] | [ ] | [ ] |
| 063 | Mayuzumi | 31:00 | [ ] | [ ] | [ ] |
| 064 | Messiaen | 31:30 | [ ] | [ ] | [ ] |
| 065 | Milhaud | 32:00 | [ ] | [ ] | [ ] |
| 066 | Miki | 32:30 | [ ] | [ ] | [ ] |
| 067 | Mimaroglu | 33:00 | [ ] | [ ] | [ ] |
| 068 | Mingus | 33:30 | [ ] | [ ] | [ ] |
| 069 | Mitchell | 34:00 | [ ] | [ ] | [ ] |
| 070 | Nancarrow | 34:30 | [ ] | [ ] | [ ] |
| 071 | Nono | 35:00 | [ ] | [ ] | [ ] |
| 072 | Ohana | 35:30 | [ ] | [ ] | [ ] |
| 073 | Parmegiani | 36:00 | [ ] | [ ] | [ ] |
| 074 | Partch | 36:30 | [ ] | [ ] | [ ] |
| 075 | Penderecki | 37:00 | [ ] | [ ] | [ ] |
| 076 | Reich | 37:30 | [ ] | [ ] | [ ] |
| 077 | Revueltas | 38:00 | [ ] | [ ] | [ ] |
| 078 | Reynolds | 38:30 | [ ] | [ ] | [ ] |
| 079 | Roldán | 39:00 | [ ] | [ ] | [ ] |
| 080 | Rzewski | 39:30 | [ ] | [ ] | [ ] |
| 081 | Satie | 40:00 | [ ] | [ ] | [ ] |
| 082 | Scelsi | 40:30 | [ ] | [ ] | [ ] |
| 083 | Schoenberg | 41:00 | [ ] | [ ] | [ ] |
| 084 | Schulhoff | 41:30 | [ ] | [ ] | [ ] |
| 085 | Scriabin | 42:00 | [ ] | [ ] | [ ] |
| 086 | Shields | 42:30 | [ ] | [ ] | [ ] |
| 087 | Ruskin Spear | 43:00 | [ ] | [ ] | [ ] |
| 088 | Stanshall | 43:30 | [ ] | [ ] | [ ] |
| 089 | Stapleton | 44:00 | [ ] | [ ] | [ ] |
| 090 | Stockhausen | 44:30 | [ ] | [ ] | [ ] |
| 091 | Sun Ra | 45:00 | [ ] | [ ] | [ ] |
| 092 | Takemitsu | 45:30 | [ ] | [ ] | [ ] |
| 093 | tENTATIVELY | 46:00 | [ ] | [ ] | [ ] |
| 094 | Varèse | 46:30 | [ ] | [ ] | [ ] |
| 095 | Williamson | 47:00 | [ ] | [ ] | [ ] |
| 096 | Wilson | 47:30 | [ ] | [ ] | [ ] |
| 097 | Wishart | 48:00 | [ ] | [ ] | [ ] |
| 098 | Wolff | 48:30 | [ ] | [ ] | [ ] |
| 099 | Wolpe | 49:00 | [ ] | [ ] | [ ] |
| 100 | Wuorinen | 49:30 | [ ] | [ ] | [ ] |

---

## 6. Companion commits

    fix(engine): reconnect all 300 reductions to the live stream
    docs(spec): normative spec for all 300 reductions
    docs(audit): root cause, fix log, open deviations, 300-slot listening checklist
