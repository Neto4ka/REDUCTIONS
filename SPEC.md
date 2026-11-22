# REDUCTIONS — Specification v1.0

**Normative specification of all 300 reductions.**
100 composers × 3 patterns × 10 s, played over one continuous 50-minute source.

This document defines *intended* behaviour. It is the reference against which the implementation is tested. Where code and spec disagree, the spec wins.

---

## 1. Definitions

**Reduction** — a deterministic transformation applied to the live stream for exactly 10 seconds, identified by `NNN·s` (composer number 1–100, slot 1–3).

**Source `S`** — the untouched signal from `sound.wav` at the current playback position.

**Bed `b ∈ [0,1]`** — the declared fraction of untouched source allowed to remain in the output.

**Wet path `W`** — the result of the serial chain applied to `S`.

**Output contract:**

    y = b · S + (1 − b) · Chain(S)

**Invasion depth `I`** — how far the reduction actually penetrates the material:

    I = 20 · log10( RMS((1−b)·W) / RMS(b·S) )   [dB]

| bed | I (approx) | meaning |
|-----|-----------|---------|
| 0.00 | +∞ | source fully replaced |
| 0.10 | +19 dB | reduction dominates |
| 0.25 | +9.5 dB | reduction leads, source is a ghost |
| 0.50 | 0 dB | equal dialogue |
| 0.70 | −7.4 dB | source leads, reduction is a shadow |
| 0.85 | −15 dB | near non-intervention |

Every slot declares its `bed` via the `BEDS` table (300 two-digit values). A slot that does not reach its declared invasion depth is a bug, not an aesthetic.

---

## 2. Signal contract (R1–R12)

**R1 — Serial by default.** `fx` is a chain: `S → op₁ → op₂ → … → W`. Parallel structure is explicit (`par[…]`, `∥`). A filter listed after a tape edit filters *that edit*, not a separate copy.

**R2 — Bed is explicit and enforced.** No implicit dry path may exist anywhere in the graph. The bus input must never be connected directly to the bus output.

**R3 — Bus inputs are persistent.** The tap→bus connection is created once and never orphaned. Rebuilding a pattern must not disconnect the source from the effects.

**R4 — Real analysis.** `peaks`, `f0`, `harm5`, `rms`, `flux` resolve from the live FFT/autocorrelation of the signal, refreshed every 200 ms. Hard-coded spectra are forbidden. (Note: the analyser sits post-master by design — resonators excite the *output*, not the source. This is intentional for Lucier-style self-resonance.)

**R5 — Resonators are excited.** `res` is a feedback resonator with a declared T60, not a bare bandpass. It must continue ringing after excitation stops.

**R6 — No dead parameters.** Every key present in the data must be read by its operator. Enforced by static lint.

**R7 — Source-time scheduling.** Slot boundaries and ramps are computed in source time and converted to context time via `playbackRate`.

**R8 — Clouds are voices.** `cloud(n)` instantiates *n* independent grains-in-flight, not a density scalar. Detune is `cents/1200` octaves. `gliss` is a real drift over the slot.

**R9 — Canons handle ratios < 1.** All delay-based tempo ops use a 2 s pre-delay base so slowing voices are as valid as accelerating ones.

**R10 — Freeze is a copy.** `freeze` snapshots a buffer once; it must not drift when the ring buffer wraps.

**R11 — Loudness, not limiting.** Each bus is loudness-normalised to the source. The master limiter is a safety ceiling (−3 dB, 8:1) only and must not be the reason a reduction sounds flat.

**R12 — Equal-power crossfade.** 0.9 s between slots; the bed component is continuous across the boundary.

---

## 3. Analysis bus

| field | method | refresh |
|-------|--------|---------|
| `f0` | highest of `peaks` (proxy) on 2048-sample window | 200 ms |
| `peaks` | FFT 2048, parabolic-interpolated local maxima, top 6, min 40 dB above floor | 200 ms |
| `harm5` | `f0 × 1…5` | derived |
| `rms` | mean of FFT bins, smoothed | 50 ms |
| `centroid` | spectral centroid Σ(f·v) / Σv | 200 ms |

Source of truth: `analyser.fftSize = 2048`, `smoothingTimeConstant = 0.82`.

---

## 4. Primitive dictionary

| op | mathematics | requirement |
|----|-------------|-------------|
| `LP/HP/BP(f0→f1,Q)` | biquad, exponential frequency ramp across the slot | in-series |
| `shelf(f,±dB)` | high/low shelf | in-series |
| `ring(f,d)` | `y = (1−d)·x + d·x·sin(2πft)` | four-quadrant multiply |
| `trem(f,d)` | `y = x·(1−d/2 + (d/2)·sin 2πft)` | modulates wet, never bed |
| `pan(f,d)` | `pan(t) = d·sin 2πft` | — |
| `echo(dt,fb,mix)` | `y = (1−m)x + m·LP(D_fb(x))` | fb ≤ .85 |
| `comb(f[],fb)` | `y = Σ D_{1/fᵢ}(x)`, feedback | peak gain `1/(1−fb)` |
| `res(f[],Q,T60)` | resonator bank, feedback tuned to `fᵢ`, decay T60 | must ring unforced |
| `sat(kind,k)` | `tanh(kx)/tanh k` · fuzz asymmetric · fold `sin(kx)` | 2× oversampled |
| `gate(pat,floor)` | amplitude mask, `pat` = onset durations | acts on wet only |
| `dyn(curve)` | swell `.08→1→.25`, fade `1→to` | acts on wet only |
| `notch(peaks,Q0→Q1)` | serial notch cascade on real peaks | bed ramps down with it |
| `form(set→vowel)` | 3 bandpass formants Q8, morph across slot | — |
| `space(n,rot)` | n taps 20–100 ms, panned, LFO rotation | — |
| `grain(mode,d,s,jit)` | d grains/s, length s, from 4 s ring; rand/scan/seq | `jump` = Markov probability |
| `cloud(n,cents,gliss)` | n voices, detune ±cents/1200 oct, gliss drift | n is a voice count |
| `harm(r[],stagger)` | simultaneous transposed voices, staggered entry | chord, not arpeggio |
| `freeze(s,jit)` | fixed buffer copy, looped with jitter | no drift |
| `canon(r[],off[])` | pre-delay 2 s; `delay = base + (r−1)·t` | ratios < 1 valid |
| `phase(drift)` | `delay = base + drift·t` | pre-delay base |
| `tape(op,…)` | destructive edit of a 3 s snapshot | replaces the wet path |
| `osc(f,env,glide)` | drone / bell / siren; `f:rms` = loudness→pitch | real sonification |
| `clicks(n,t0→t1,decay)` | n metronomes | `decay` slows **tempo** and level |
| `silence(dBFS)` | bed forced to 0, noise floor at declared level | true near-silence |
| `xf(a,b,per)` / `alt(a,b,per)` | equal-power crossfade / alternation | must govern grains too |

**Notation in the tables:** `→` serial · `∥` parallel layer · `par[…]` explicit branches · `xf/alt` morphs · bed = declared source fraction.

---

## 5. The 300 reductions

### 001–010 · Alkan · Antheil · Artman · Avram · Balada · Bandt · Bayle · Berger · Berio · Beyer

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 001·1 | Train gains momentum | `tape.stutter(400→50 ms) → LP(500→3200)` | .20 | loop rate 2.5→20 Hz, opening up |
| 001·2 | Aesop's feast | `tape.palin(8) → harm([1,2], stagger)` | .25 | forward/backward motif, octave double |
| 001·3 | Symphony for solo piano | `harm([.5,1,2]) → sat(soft,k3)` | .20 | one line becomes an orchestra |
| 002·1 | Mechanical ballet | `clicks(16,.40→.42) ∥ osc(saw 55 drone)` | .15 | locked metronomes over propeller |
| 002·2 | Airplane propellers | `trem(22 Hz,.9) → LP(900→400)` | .10 | rumble; source unrecognisable |
| 002·3 | Electric bells | `res([220,607,1188,1958],Q35,T60 1.2) → gate([.2,.6,.2,1.2],.05)` | .15 | inharmonic metal, sparse mask |
| 003·1 | Urban Sax | `space(8,rot .05) → form(sax)` | .30 | eight moving sources |
| 003·2 | Swarm of saxophones | `cloud(12,±30c) ∥ res([320,780,1400],Q12)` | .25 | twelve breathing voices |
| 003·3 | Lard Free: motorik | `gate(4/4 .25,.25) → echo(.375,.45,.40)` | .20 | motorik pulse with slapback |
| 004·1 | Spectral growth | `res(peaks,Q60,ramp) → dyn(swell)` | .15 | the file's own partials grow |
| 004·2 | Arborescences | `harm([1,1.5,2.25,3.375], stagger 1 s) → shelf(2k→6k,+6)` | .25 | four branches enter one by one |
| 004·3 | Inner light | `freeze(140 ms,±2c) → shelf(1.2k→5k,+9)` | .15 | one instant slowly brightens |
| 005·1 | Folk line | `harm([1,1.5,2]) → trem(5 Hz,.2)` | .35 | fifth/octave double with vibrato |
| 005·2 | Cluster background | `cloud(13,±600c) ∥ dry` | .40 | semitone mass under the line |
| 005·3 | Sinfonía negra | `gate([.3,.3,.6],.1) → res([110,165,220],Q20)` | .20 | dark ritual ostinato |
| 006·1 | File inside a silo | `comb([82,123,196],fb .7) → echo(.42,.5,.5)` | .10 | metal tank, long tail |
| 006·2 | Flagong: glass | `res([660,1531,2805,4376],Q70,T60 2) → dyn(swell)` | .15 | glass shimmer 1:2.32:4.25:6.63 |
| 006·3 | Sound landscape | `space(4,rot .02)` | .70 | place moves, sound stays itself |
| 007·1 | Brassage | `grain(rand,30/s,50 ms)` | .15 | classic GRM granular blur |
| 007·2 | Time freeze | `freeze(120 ms,±3c) → trem(.5 Hz,.3)` | .10 | a stuck instant, breathing |
| 007·3 | Acousmatic montage | `tape.shuffle(24) → BP(400→2400,Q1)` | .15 | gesture survives, cause vanishes |
| 008·1 | Intervallic cells | `harm([1,1.682,2.119])` | .40 | m7/m9 cells, clarity not mass |
| 008·2 | Neoclassical clarity | `BP(600→1800,Q.8) → gate([.15,.45,.15,.8],.2)` | .25 | transparent line, sharp accents |
| 008·3 | Serialization of order | `tape.shuffle(12,seed 44) → harm([1,1.059])` | .25 | reproducible permutation |
| 009·1 | Thema | `grain(scan,24/s,80 ms) → BP(300→3000,Q2)` | .10 | voice dissolves into abstraction |
| 009·2 | Sequenza | `tape.stutter(250→80 ms) → dyn(swell)` | .15 | explosive vocal stutters |
| 009·3 | Sinfonia: palimpsest | `cloud(8,±20c) ∥ tape.shuffle(16)` | .30 | quotes floating over quotes |
| 010·1 | Music of the Spheres | `osc(sine 220,glide ×1.5) ∥ harm([1,1.5])` | .30 | sliding electric glissandi |
| 010·2 | Clusters | `cloud(13,±600c)` | .15 | palm-and-forearm tone mass |
| 010·3 | Cluster choreography | `cloud(9,±400c) → gate([.5,.3,.5,.9],.05)` | .20 | cluster switched by hand rhythm |

### 011–020 · Björk · Boulez · Brant · Braxton · Brody · Brown · Cage · Beefheart · Carter · Chávez

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 011·1 | Vespertine: microbeats | `grain(rand,40/s,20 ms) → gate([.12,.18,.12,.3],.3)` | .25 | microbeats made of the source |
| 011·2 | Medúlla: voice only | `form(voice→u) → harm([.5,1,2])` | .15 | everything becomes voice |
| 011·3 | Biophilia: gravity harp | `harm([1,1.335,1.78]) ∥ osc(220 drone)` | .30 | pendulum intervals over a drone |
| 012·1 | Répons | `space(6,rot .15) → res([262,330,392,523],Q25) → echo(.21,.4,.35)` | .25 | soloist inside an electronic aura |
| 012·2 | Anthèmes 2 | `harm([1,1.5,2.02]) → pan(1.2 Hz,.9)` | .25 | harmonizer that follows and flies |
| 012·3 | IRCAM machine | `grain(scan,20/s,90 ms) → ring(440,.5) → space(4,rot .1)` | .10 | the engine as fourth Boulez |
| 013·1 | Antiphony | `par[HP800 → pan(−1) │ LP900 → pan(+1)]` | .05 | L and R never share material |
| 013·2 | Ice Field | `cloud(4,±15c) ∥ clicks(4,.7→1.3) ∥ space(4)` | .35 | four unsynchronised ensembles |
| 013·3 | Unsynchronized ensembles | `canon([1,1.07,.93], base 2 s)` | .15 | three tempos drifting apart |
| 014·1 | For Alto | `form(sax) → grain(rand,12/s,60 ms)` | .20 | solo sax, breath as material |
| 014·2 | Ghost Trance | `gate([.22,.18,.4,.14,.3],.15) → echo(.28,.5,.4)` | .25 | ritual pulse, almost dance |
| 014·3 | Graphic scores | `tape.shuffle(20) ∥ clicks(3,.5→.9)` | .25 | diagram with pulse markers |
| 015·1 | Zikr | `tape.loop(12) → dyn(swell)` | .15 | repetition intensifies |
| 015·2 | Echo of Xenakis | `grain(rand,25/s,70 ms) ∥ cloud(6,±25c)` | .25 | stochastic mass |
| 015·3 | In memory of a friend | `osc(660 bell,dec 4) → echo(.5,.6,.6)` | .30 | bell motif shared with 054·3 |
| 016·1 | December 1952 | `clicks(6,.3→1.6) ∥ grain(rand,8/s,100 ms)` | .40 | sparse field of events |
| 016·2 | Available Forms | `tape.shuffle(14,seed)` | .15 | conductor's choice fixed by seed |
| 016·3 | 25 Pages | `tape.palin(6) → pan(.3 Hz,.6)` | .20 | pages in any order/direction |
| 017·1 | Williams Mix | `tape.shuffle(200, I-Ching seed)` | .05 | 15 ms splices; source gone |
| 017·2 | Prepared piano | `res([180,254,378,666],Q45,T60 .8)` | .20 | bolts and screws in the strings |
| 017·3 | 4′33″ | `silence(−60 dBFS)` | .00 | source gone; only room noise |
| 018·1 | Trout Mask Replica | `tape.shuffle(18) → gate(7/8,.2)` | .20 | chaos rehearsed to precision |
| 018·2 | 3 against 4 | `gate([.3,.3,.2],.15) ∥ clicks(2,.5)` | .25 | two pulses that never meet |
| 018·3 | Dachau Blues | `sat(fuzz,k12) → form(voice→i)` | .10 | voice at its limit |
| 019·1 | Metric modulation 4:5 | `phase(drift .025, base 2 s)` | .30 | tempo shifts through a shared pulse |
| 019·2 | Strata | `canon([1,1.25,.8]) ∥ grain` | .20 | three independent tempo characters |
| 019·3 | Night Fantasies | `cloud(8,±12c) → dyn(swell)` | .30 | nocturnal fluidity |
| 020·1 | Sinfonía india | `gate([.25,.25,.5]×2,.15) ∥ clicks(3,.25→.5,700)` | .25 | driving ostinato, wooden drums |
| 020·2 | Teponaztli | `res([140,434,728],Q30) → gate([.4,.2,.4,.6],.05)` | .15 | slit drum, two tongues |
| 020·3 | Open harmonies | `harm([1,1.5,2.5])` | .40 | fifths and thirds, transparent |

### 021–030 · Coleman · Cowell · Crumb · Curran · Davidovsky · Maxwell Davies · Detoni · Dr. John · Dodge · Druckman

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 021·1 | Harmolodics | `harm([1,1.189,1.498], drift)` | .30 | three equal keys, no principal |
| 021·2 | Free Jazz | `grain(rand,18/s,60 ms,jit ±.4 oct) → gate(swing,.3)` | .20 | double quartet, pitch scatter |
| 021·3 | Dancing in Your Head | `tape.loop(8) ∥ osc(tri 220,glide)` | .20 | loop-chant and a call |
| 022·1 | Tone clusters | `cloud(13,±600c)` | .10 | forearm cluster |
| 022·2 | String piano | `freeze(80 ms,±5c) → res([1200,2400,3600],Q50)` | .15 | plucks inside the lid |
| 022·3 | New Musical Resources | `canon([1,4/3,5/3]) ∥ grain` | .20 | rhythm from harmonic ratios |
| 023·1 | Black Angels | `sat(soft,k6) → res([523,1397,2610],Q40) → trem(9 Hz,.5)` | .15 | amplified quartet, metal shimmer |
| 023·2 | Vox Balaenae | `osc(180,glide ×.5) → form(voice→o)` | .20 | whale call through a mask |
| 023·3 | Numerology 7 and 13 | `gate([.7,.7,.7,1.3],.1) → echo(.13,.4,.3)` | .25 | 7 and 13 as rhythm |
| 024·1 | Hypercollage | `tape.shuffle(300) ∥ grain(15/s,40 ms)` | .05 | 10 ms splices, extreme density |
| 024·2 | A Rose Is a Round | `canon([1,1,1], off [0,.8,1.6])` | .15 | true staggered circle canon |
| 024·3 | Schtyx | `gate([.2,.1,.3,.1,.2,.4],.2) → harm([1,1.5])` | .30 | folk jitter in new fabric |
| 025·1 | Synchronisms | `par[dry .6 │ grain(seq,20/s,70 ms)]` | .40 | instrument and tape lock on attacks |
| 025·2 | Synchronization point | `tape.stutter(150→60 ms) ∥ osc(440 bell,dec 1)` | .25 | tape answers the instrument |
| 025·3 | Divergence | `phase(drift .012)` | .35 | sync → drift → rupture |
| 026·1 | Eight Songs for a Mad King | `form(voice→i) → tape.stutter(200→70 ms)` | .10 | voice across four octaves of madness |
| 026·2 | Foxtrot inside the symphony | `gate([.3,.3,.6],.25) → BP(500→2000,Q1.5)` | .25 | buried dance, deformed |
| 026·3 | Farewell to Stromness | `harm([1,1.5], g .3)` | .70 | near-dry, tender |
| 027·1 | ACEZANTEZ | `tape.shuffle(16) ∥ clicks(4,.4→.8)` | .20 | wordless stage |
| 027·2 | Phonomorphia | `grain(scan,22/s,90 ms) → LP(3000→500)` | .15 | material metamorphoses downward |
| 027·3 | Stage without words | `form(voice→e) → gate([.4,.2,.8],.15)` | .20 | characters and gestures |
| 028·1 | Gris-Gris | `gate(second-line,.2) → echo(.33,.5,.45)` | .20 | swamp voodoo groove |
| 028·2 | Voodoo chant | `harm([1,1.5]) → trem(6 Hz,.35)` | .30 | incantation in layers |
| 028·3 | Night Tripper | `pan(.2 Hz,.9) → sat(soft,k4)` | .25 | slow flight, warm grit |
| 029·1 | Any Resemblance… | `par[dry .65 │ osc(saw 220,glide) + grain(10/s)]` | .45 | dry voice inside alien synthesis |
| 029·2 | The Earth Is My Mother | `form(voice→a) → harm([1,2])` | .20 | synthetic singer |
| 029·3 | Bell Labs | `ring(660,.6) → grain(seq,16/s,60 ms)` | .10 | 1960s mainframe aesthetics |
| 030·1 | Animus: duel | `par[dry .5 │ sat(fuzz,k10) → ring(880,.4)]` | .35 | protagonist vs tape antagonist |
| 030·2 | Prism: quotes | `tape.shuffle(20) ∥ cloud(6,±18c)` | .25 | quotes refracted |
| 030·3 | Windows | `space(5,rot .08) → dyn(swell)` | .35 | orchestral windows opening |

### 031–040 · Dumitrescu · Tan Dun · Dunn · Ellington · Erb · Feldman · Foss · Gaburo · Gershwin · Graettinger

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 031·1 | Inside sound | `freeze(160 ms,±1.5c) → res(peaks,Q80,ramp)` | .10 | microscopic listening, real peaks |
| 031·2 | Glissando textures | `cloud(16,±40c,gliss +120c)` | .10 | mass glissando diverging over 10 s |
| 031·3 | Aphonic | `silence(−55 dBFS) ∥ grain(6/s,80 ms)` | .05 | threshold of hearing |
| 032·1 | Water Concerto | `BP(400→2600,Q3) ∥ grain(20/s,30 ms)` | .25 | water sweeps and drops |
| 032·2 | Organic Music: paper | `tape.transient(20) → res([900,1800,3200],Q15)` | .20 | paper and wood attacks |
| 032·3 | Ritual | `gate([1,.5,1,1.5],.1) ∥ osc(330 bell,dec 3)` | .30 | shamanic theatre |
| 033·1 | Interspecies dialogue | `harm([4]) → echo(.4,.45,.5)` | .10 | +2 octaves, echo answer |
| 033·2 | Avian range | `harm([6]) ∥ grain(24/s,25 ms)` | .10 | stream in the bird register |
| 033·3 | Insects | `trem(40 Hz,.8) → res([3200,4800,6400],Q40)` | .15 | stridulation |
| 034·1 | Jungle growl | `trem(24 Hz,.6) → BP(600→1600,Q4)` | .15 | growling brass |
| 034·2 | Ellington effect | `res([350,700,1200,2100],Q10)` | .40 | timbre written for specific people |
| 034·3 | Take the A Train | `gate(swing,.25) → harm([1,1.26,1.5])` | .30 | signature swing |
| 035·1 | Trombone + tape | `form(brass→o) → ring(440,.4)` | .15 | brass and electronics fused |
| 035·2 | The Seventh Trumpet | `res([440,880,1320],Q20) → echo(.25,.4,.4)` | .20 | theatrical trumpet |
| 035·3 | Brass theater | `pan(.6 Hz,.8) → sat(soft,k5)` | .25 | instrument as character |
| 036·1 | Silence and duration | `res(peaks,Q30,g .2,ramp)` | .85 | −18 dB; sound allowed to be itself |
| 036·2 | Rare events | `gate([2.5,.3,3,.4],.04) → echo(.6,.6,.5)` | .30 | events as rare as stars |
| 036·3 | Let it be | `shelf(2k,−8)` | .80 | non-intervention, dark tilt |
| 037·1 | Baroque Variations: erasure | `notch(peaks,Q2→30)`; bed .90→.15 | ramp | Bach erased to a ghost |
| 037·2 | Phorion | `tape.shuffle(24,return every 4th) ∥ res(peaks,Q20)` | .30 | recognisable debris returns |
| 037·3 | Improvisation ensemble | `cloud(6,±20c) → gate([.6,.3,1.2],.2)` | .30 | collective improvisation, 1957 |
| 038·1 | Linguistics of sound | `grain(seq,30/s,30 ms) → form(voice→e)` | .15 | phonemes as musical matter |
| 038·2 | Lemon Drops | `osc(880 bell,dec 1.5) → echo(.18,.5,.5)` | .30 | electronic miniature |
| 038·3 | Antiphony III | `space(4,rot .06) ∥ grain(12/s,60 ms)` | .45 | voice and tape in space |
| 039·1 | Rhapsody: glissando | `osc(tri 220,glide ×4) ∥ harm([1,1.5,2])` | .30 | the clarinet climb |
| 039·2 | Blue notes | `harm([1,1.189,1.782])` | .40 | m3/m7 against major |
| 039·3 | Swing | `gate(swing,.3)` | .55 | jazz rhythm, near-dry |
| 040·1 | City of Glass | `cloud(10,±50c) → sat(soft,k6) → res([466,622,932],Q15)` | .15 | atonal brass city |
| 040·2 | Atonal brass | `res([415,554,830],Q18) → gate([.1,.7,.1,1.1],.05)` | .20 | percussive stabs |
| 040·3 | This Modern World | `canon([1,1.12,.9])` | .20 | anxious tempo strata |

### 041–050 · Hába · Harrison · Hauer · Hendrix · Henry · Henze · Heron · Hiller · Hodgkinson · Hunt

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 041·1 | Quarter tones | `harm([2^(1/24),2^(3/24),2^(5/24)])` | .30 | audible quarter-tone beating |
| 041·2 | 24-EDO grid | `res([262,269,277,285,294,302],Q35)` | .20 | new harmonic landscape |
| 041·3 | Matka | `grain(scan,18/s,80 ms) ∥ harm([1.0293,1.0905])` | .25 | microtonal opera |
| 042·1 | Gamelan | `res([300,345,405,450,510],Q50,T60 1.5) → gate([.4,.4,.8],.1)` | .15 | slendro metal from the stream |
| 042·2 | Just intonation | `harm([1,9/8,5/4,3/2,5/3])` | .30 | pure intervals, no beating |
| 042·3 | Prepared piano | `res([200,283,420,740],Q40)` | .20 | Cage legacy |
| 043·1 | 44 tropes | `tape.shuffle(44,seed 44)` | .10 | reproducible trope permutation |
| 043·2 | 12-tone grid | `res(12-EDO 262…494,Q40)` | .20 | law as harmonic field |
| 043·3 | Zwölftonspiel | `gate([.5,.5,.5,1.5],.2) → harm([1,√2])` | .30 | meditative play by law |
| 044·1 | Fuzz + feedback | `sat(fuzz,k18) → res([1600],Q90,self-osc)` | .05 | controlled feedback whistle |
| 044·2 | Univibe | `trem(1.8 Hz,.6) → pan(.9 Hz,.7)` | .20 | four-stage vortex |
| 044·3 | Backwards guitar | `tape.reverse → echo(.3,.45,.45)` | .10 | flipped solo |
| 045·1 | Voile d'Orphée | `grain(rand,26/s,40 ms) → BP(200→3200,Q2)` | .10 | the veil tears |
| 045·2 | Porte et soupir | `tape.stutter(300→100 ms) → gate([.8,1.2,.4,1.6],.05)` | .15 | door hinge as soloist |
| 045·3 | Montage of causes | `tape.shuffle(30)` | .20 | cause hidden |
| 046·1 | El Cimarrón | `gate([.2,.4,.2,.8],.2)` | .55 | storytelling voice, guitar gate |
| 046·2 | Political gesture | `sat(soft,k6) ∥ clicks(4,.4→.7)` | .25 | music as a position |
| 046·3 | Night music | `dyn(swell) → harm([1,1.5])` | .40 | late lyricism |
| 047·1 | A Very Cellular Song | `harm([.5,1,2])` | .40 | octave chant hymn |
| 047·2 | Psychedelic folk | `phase(drift .006) ∥ res([294,330,392,440],Q15)` | .35 | slow modal phasing |
| 047·3 | Log Cabin Home in the Sky | `cloud(8,±15c)` | .25 | one voice as choir |
| 048·1 | Illiac Suite | `tape.shuffle(32,seed 1957)` | .10 | first computer score, reproducible |
| 048·2 | Markov transitions | `grain(seq,22/s,80 ms,jump p=.3)` | .15 | sequential with probabilistic jumps |
| 048·3 | HPSCHD | `cloud(7,±30c) ∥ clicks(6,.3→.9)` | .20 | computer anarchy |
| 049·1 | Henry Cow: angular riffs | `tape.shuffle(16) → gate([.2,.2,.3,.2,.5],.15)` | .20 | rock as chamber avant-garde |
| 049·2 | Polymeter 5 and 7 | `gate(5+7,.2) ∥ clicks(2,.5)` | .25 | 5 and 7 at once |
| 049·3 | Living in the Heart of the Beast | `tape.reverse → sat(fuzz,k9)` | .10 | fury of form |
| 050·1 | Haramand Plane | `clicks(8,.08→.5) ∥ grain(20/s,30 ms)` | .25 | ritual streaming |
| 050·2 | Streaming | `grain(rand,40/s,25 ms,jit ±.5 oct)` | .05 | formless pitch-scattered flow |
| 050·3 | Breath of ritual | `silence(−50 dBFS) → trem(3 Hz,.6)` | .10 | the body in the sound |

### 051–060 · Ichiyanagi · Ives · Kagel · Kamin · Kraft · Kreidler · Lachenmann · Lennon · Ligeti · Lockwood

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 051·1 | Sapporo | `freeze(200 ms,±1c) → trem(.4 Hz,.4)` | .20 | long tones |
| 051·2 | Extended Voices | `form(voice→u) → harm([1,2])` | .25 | extended voice |
| 051·3 | Sustained tones | `osc(220 drone)` | .50 | time as material |
| 052·1 | Two chapels | `par[canon(1.03) → pan(−1) │ canon(.97) → pan(+1)] ∥ harm([1,√2])` | .20 | two marches colliding |
| 052·2 | The Unanswered Question | `osc(440 bell,dec 2.5) ∥ cloud(6,±25c)` | .45 | question and non-answer |
| 052·3 | Central Park in the Dark | `cloud(8,±20c) ∥ clicks(3,.8→1.5)` | .35 | nocturnal city |
| 053·1 | Match: duel | `pan(.8 Hz,1) → gate([.3,.3,.6],.15)` | .20 | two cellists duelling L/R |
| 053·2 | Absurdist montage | `tape.shuffle(20) ∥ clicks(5,.3→.7)` | .20 | theatre of the absurd |
| 053·3 | Gesture theater | `form(voice→o) ∥ tape.stutter(250→100 ms)` | .25 | sound as stage action |
| 054·1 | Topology of time | `phase(drift .03)` | .25 | continuous tempo deformation |
| 054·2 | Prosody | `grain(seq,24/s,50 ms) → gate([.3,.2,.5,.2,.4],.15)` | .20 | syllabic segmentation |
| 054·3 | Echo to a friend | `osc(660 bell,dec 4) → echo(.5,.6,.6)` | .30 | identical motif to 015·3 |
| 055·1 | Encounters | `clicks(6,.2→.8) → space(4,rot .1)` | .30 | percussion meeting in space |
| 055·2 | Percussion theater | `tape.transient(24) → pan(.7 Hz,.8)` | .20 | attacks as characters |
| 055·3 | Rhythm mass | `gate([.15,.15,.3,.15,.45],.1) ∥ cloud(6,±20c)` | .25 | rhythm as architecture |
| 056·1 | Fremdarbeit | `tape.crush(5 bit,hold 8)` | .10 | demonstratively cheap labour |
| 056·2 | Product placements | `grain(rand,40/s,15 ms)` | .05 | microsamples as a gesture |
| 056·3 | Charts Music | `osc(pitch ← rms, 40 steps)` | .25 | loudness curve actually sung |
| 057·1 | Musique concrète instrumentale | `tape.transient(30,floor .04) → HP(1200)` | .05 | pitch gone, breath remains |
| 057·2 | Rustles | `grain(rand,28/s,30 ms) → HP(2000)` | .10 | noise matter of the instrument |
| 057·3 | Gran Torso | `tape.transient(20) → res([1800,2700,3900],Q30)` | .10 | quartet as noise theatre |
| 058·1 | Revolution 9 | `tape.shuffle(40) ∥ tape.reverse(g .4)` | .05 | loop chaos |
| 058·2 | Number nine | `tape.loop(16) → pan(.4 Hz,.8)` | .10 | obsessive phrase, drifting |
| 058·3 | Tomorrow Never Knows | `echo(.28,.55,.5) ∥ phase(.008) ∥ res([440,660],Q20)` | .20 | five loops spinning |
| 059·1 | Micropolyphony | `cloud(48 voices,±15c,delay .04)` | .05 | 48 real voices, no line audible |
| 059·2 | Poème symphonique | `clicks(24,.25→1.4 s, tempo decay)` | .05 | metronomes actually wind down |
| 059·3 | Lux Aeterna | `cloud(16,±10c) → res(peaks,Q40,ramp)` | .15 | canon without rhythm |
| 060·1 | World Rhythms | `clicks(2,1.5→2.5,300) ∥ osc(98 bell,dec 5)` | .50 | gong and river |
| 060·2 | Danube | `BP(300→1800,Q2) ∥ grain(seq,18/s,60 ms)` | .35 | sound map of a river |
| 060·3 | Sound geography | `space(4,rot .03)` | .70 | place sounds itself |

### 061–070 · Lucier · Malec · Mayuzumi · Messiaen · Milhaud · Miki · Mimaroglu · Mingus · Mitchell · Nancarrow

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 061·1 | I Am Sitting in a Room | `res(peaks,Q120, re-injection ×8)`; bed .10→0 | ramp | room modes defeat the material |
| 061·2 | Vespers | `clicks(3,.5→.9,2400) → echo(.12,.5,.6)` | .25 | echolocation |
| 061·3 | Music on a Long Thin Wire | `osc(220 drone) → trem(.3 Hz,.5)` | .35 | the wire sings itself |
| 062·1 | Triola | `phase(.02) → LP(2500→1200)` | .25 | GRM time jumps |
| 062·2 | Zeitsprünge | `grain(scan,26/s,60 ms) ∥ grain(rand,10/s,100 ms)` | .15 | montage of time |
| 062·3 | Spectral theater | `grain(scan,20/s,80 ms) → form(voice→a)` | .20 | sound as stage |
| 063·1 | Nirvana Symphony | `res([98,235,402,666],Q60,T60 4) → dyn(swell)` | .15 | bon-shō tolling 1:2.4:4.1:6.8 |
| 063·2 | Mandala | `freeze(180 ms,±2c) ∥ osc(110 drone)` | .20 | sound mandala |
| 063·3 | Bon-shō | `osc(98 bell,dec 6) → echo(.7,.6,.6)` | .25 | strike and its long shadow |
| 064·1 | Mode 2: octatonic | `res(octatonic,Q35) ∥ harm([1,1.189,1.414])` | .30 | limited transposition as field |
| 064·2 | Non-retrogradable rhythms | `gate(onsets [3,5,7,5,3], symmetric)` | .15 | rhythm identical backwards |
| 064·3 | Birds | `grain(rand,30/s,20 ms) → harm([3,4])` | .15 | chirps in the bird register |
| 065·1 | Polytonality | `harm([1,√2])` | .30 | two keys a tritone apart |
| 065·2 | Saudades do Brasil | `gate(samba,.2) → harm([1,1.5])` | .30 | Brazilian memory |
| 065·3 | Tenderness | `harm([1,1.25], g .3)` | .60 | lyricist inside Les Six |
| 066·1 | Marimba Spiritual | `res([220,660,1100],Q25) → gate(.4→.15 accel)` | .20 | wood ritual accelerating |
| 066·2 | Ritual ostinato | `gate([.25,.25,.5],.1) ∥ clicks(3,.25→.5)` | .25 | ostinato as incantation |
| 066·3 | Wood and skin | `res([180,576,990],Q20) ∥ tape.transient(16)` | .25 | material of the instrument |
| 067·1 | Songmy | `sat(fuzz,k14) ∥ tape.shuffle(24)` | .10 | protest on tape |
| 067·2 | Aggressive montage | `tape.shuffle(60) ∥ tape.speed(1.6)` | .05 | violence of form |
| 067·3 | Political tape | `ring(660,.7) → echo(.2,.5,.5)` | .10 | voice distorted by the system |
| 068·1 | Pithecanthropus Erectus | `canon([1,1.05,.95]) → dyn(swell)` | .25 | collective free canon |
| 068·2 | The Clown | `gate(swing,.25) → form(voice→o)` | .30 | jazz as narration |
| 068·3 | Double bass growl | `res([82,123,164],Q15) → trem(7 Hz,.4)` | .20 | growling bass |
| 069·1 | Open tunings | `res([131,196,262,392,330],Q25)` | .35 | guitar in open C |
| 069·2 | Blue: vocal layers | `harm([1,1.5,2])` | .45 | her own overdubbed polyphony |
| 069·3 | Dulcimer | `res([294,440,587,880],Q30) → gate([.2,.2,.4],.2)` | .30 | Appalachian strings |
| 070·1 | Tempo canon 17:18:19 | `canon([1,1.0588,1.1176]) ∥ grain` | .15 | three tempos, pitch unchanged |
| 070·2 | e : π | `canon([1,.8653], base 2 s)` | .15 | irrational canon never converges |
| 070·3 | Player piano roll | `gate([.1,.1,.2,.1,.1,.3],.05) ∥ clicks(4,.1→.3)` | .20 | perforated roll |

### 071–080 · Nono · Ohana · Parmegiani · Partch · Penderecki · Reich · Revueltas · Reynolds · Roldán · Rzewski

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 071·1 | …sofferte onde serene… | `echo(.8,.65,.6) ∥ res(peaks,Q50)` | .30 | calm waves of memory |
| 071·2 | Silence of resistance | `silence(−55) → gate([3,.4,4,.3],.02)` | .05 | rare events in near silence |
| 071·3 | La fabbrica illuminata | `tape.transient(24) → BP(400→1600,Q1)` | .15 | illuminated factory |
| 072·1 | Microtones | `harm([1.0293,1.0905]) → form(voice→a)` | .25 | Andalusian melisma |
| 072·2 | Lorca | `gate([.8,.4,1.2],.1) → res([147,220,294],Q20)` | .25 | lament |
| 072·3 | African roots | `clicks(4,.2→.6) ∥ gate([.3,.3,.2],.2)` | .25 | polyrhythm |
| 073·1 | De Natura Sonorum | `xf(dry ↔ grain(rand,24/s,50 ms), 10 s)` | .00 | natural vs formed, real crossfade |
| 073·2 | Violostries | `ring(440,.5)` | .45 | violin and its ring shadow |
| 073·3 | Matter / form | `xf(freeze ↔ grain(scan,22/s,70 ms))` | .00 | matter takes form |
| 074·1 | 43 steps | `harm([1,16/15,9/8,7/6,5/4,4/3])` | .30 | just ratios, beating-free |
| 074·2 | Cloud chambers | `res([523,1412,2667],Q70,T60 3) → dyn(swell)` | .15 | glass bowls |
| 074·3 | Bitter Music | `gate([.3,.2,.5,.2,.4],.15)` | .55 | speech as melody |
| 075·1 | Threnody: 52 strings | `cloud(52 voices,±30c,gliss +200c)` | .05 | 52 strings diverging upward |
| 075·2 | Cluster mass | `cloud(24,±600c) → sat(soft,k5)` | .10 | sound mass, not line |
| 075·3 | Polymorphia | `cloud(24,±300c,gliss −150c)` | .10 | cloud converges to centre |
| 076·1 | Come Out | `phase(drift .01, base 2 s)` | .50 | copies drift 1%/s, comb sweeps |
| 076·2 | It's Gonna Rain | `phase(.02) → echo(.25,.4,.35)` | .45 | faster phasing |
| 076·3 | Pendulum Music | `res([1200],Q90,feedback) → pan(.25 Hz,1) ∥ osc(1200 glide)` | .20 | feedback whistle sweeps |
| 077·1 | Sensemayá | `gate(7-beat,.1) → res([110,147,220],Q20)` | .20 | snake incantation |
| 077·2 | Snake chant | `harm([1,1.059]) → trem(5 Hz,.4)` | .25 | minor-second hypnosis |
| 077·3 | Ritual acceleration | `gate(.5→.2 accel) ∥ clicks(3,.3→.6)` | .20 | trance to frenzy |
| 078·1 | The Angel of Death | `xf(dry ↔ grain) then xf(grain ↔ dry, 5 s)` | .00 | domains and incidences morph |
| 078·2 | Whispers Out of Time | `grain(rand,30/s,25 ms) → echo(.45,.55,.5)` | .20 | whispers outside time |
| 078·3 | Memory of a motif | `tape.shuffle(18,return every 4th)` | .35 | recognition through distortion |
| 079·1 | Rítmicas V/VI | `tape.transient(24) ∥ clicks(4,.2→.5,800)` | .15 | percussion without pitch |
| 079·2 | Afro-Cuban clave | `gate(3-2 clave,.1)` | .20 | the key to Afro-Cuban rhythm |
| 079·3 | Percussion without pitch | `res([200,520,1300,2600],Q20) → gate([.25,.25,.5],.1)` | .20 | timbre instead of melody |
| 080·1 | Coming Together | `tape.additive(a, a+b, a+b+c…, k6) → dyn(swell)` | .10 | additive process audible |
| 080·2 | The People United | `tape.loop(10) ∥ harm([1,1.5])` | .20 | loop-variations |
| 080·3 | Attica | `gate([.3,.2,.5,.2],.15)` | .55 | political speech as music |

### 081–090 · Satie · Scelsi · Schoenberg · Schulhoff · Scriabin · Shields · Spear · Stanshall · Stapleton · Stockhausen

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 081·1 | Vexations | `tape.loop(period 11.9 ms, 840 repeats)` | .05 | repetition becomes an 84 Hz pitch |
| 081·2 | Musique d'ameublement | `echo(.35,.5,.5) → LP(1800)` | .70 | furniture music, not listened to |
| 081·3 | Relâche | `tape.loop(6) ∥ clicks(3,.6→1)` | .20 | absurd entr'acte |
| 082·1 | One note | `res(f0,Q150,T60 5) ∥ cloud(4,±2c)` | .10 | one note from inside, ±2c beats |
| 082·2 | Inside the overtones | `res(f0×1…5,Q80, staggered opening)` | .10 | the note's inner life |
| 082·3 | Unfolding | `freeze(200 ms,±1c) → dyn(swell)` | .20 | sound as sphere |
| 083·1 | 12-tone row | `res(12-grid,Q40) ∥ tape.shuffle(12,seed 12)` | .25 | row as field and permutation |
| 083·2 | Sprechstimme | `form(voice→i) ∥ grain(seq,20/s,60 ms)` | .20 | between speech and song |
| 083·3 | Emancipation of dissonance | `cloud(8,±40c) → harm([1,√2,1.059])` | .20 | dissonance without resolution |
| 084·1 | In futurum | `silence(−65 dBFS)` | .00 | score of rests, 1919 |
| 084·2 | Jazz-dance | `gate(swing,.25) → harm([1,1.26,1.5])` | .30 | 1920s jazz in academic fabric |
| 084·3 | Dada collage | `tape.shuffle(22) ∥ clicks(4,.4→.8)` | .20 | Dada gesture |
| 085·1 | Mystic chord | `res([262,370,466,330,440,294],Q50) → dyn(swell)` | .15 | C–F#–B♭–E–A–D as field |
| 085·2 | Light-music | `shelf(800→6000,+12) ∥ res([262,370,466],Q40)` | .30 | colour as harmony, brightening |
| 085·3 | Vers la flamme | `dyn(swell) → cloud(8,±20c) → shelf(+8)` | .25 | darkness to blinding light |
| 086·1 | Apocalypse | `form(voice→a) → grain(scan,18/s,80 ms)` | .15 | electronic voice opera |
| 086·2 | Shaman | `res([196,294,392],Q25) → trem(6 Hz,.5)` | .20 | ritual voice |
| 086·3 | Columbia-Princeton | `ring(880,.5) ∥ tape.shuffle(16)` | .15 | the school's method |
| 087·1 | Robot saxophone | `tape.stutter(200→80 ms) → form(sax)` | .10 | a robot plays a solo |
| 087·2 | Trouser Press | `gate(4/4,.1) → sat(soft,k5)` | .20 | absurd machine |
| 087·3 | Vaudeville | `pan(.7 Hz,.9) ∥ clicks(5,.3→.7)` | .25 | English vaudeville |
| 088·1 | Sir Henry at Rawlinson End | `form(voice→o)` | .50 | radio drama characters |
| 088·2 | Radio drama | `tape.shuffle(18) → echo(.3,.45,.4)` | .20 | surreal montage |
| 088·3 | Eccentricity | `osc(1046 bell,dec 2) ∥ gate([.4,.2,.8],.2)` | .30 | English eccentricity |
| 089·1 | Nurse With Wound | `tape.shuffle(26) → echo(.4,.55,.5)` | .15 | waking dream |
| 089·2 | Drone collage | `cloud(8,±25c) ∥ freeze(160 ms)` | .15 | drone as dream |
| 089·3 | Vinyl ghost | `tape.crush(7 bit,hold 4) ∥ clicks(6,.1→.6,3000)` | .15 | crackle as memory |
| 090·1 | Mixtur | `ring(440,.85, four-quadrant)` | .15 | sum and difference frequencies |
| 090·2 | Kontakte | `ring(660,.6) → pan(.5 Hz,1) → echo(.15,.4,.3)` | .10 | sound flying in a circle |
| 090·3 | Mantra | `par[ring(440,.5) │ ring(660,.4)] → res([262,392],Q30)` | .15 | two pianos, 13-sound formula |

### 091–100 · Sun Ra · Takemitsu · tENTATIVELY · Varèse · Williamson · Wilson · Wishart · Wolff · Wolpe · Wuorinen

| ID | Pattern | Intended chain | bed | Must be heard as |
|----|---------|----------------|-----|------------------|
| 091·1 | Space Echo | `echo(.31,.55,.55,wow) → res([800,1600,2400],Q15)` | .20 | tape echo and spring |
| 091·2 | Cosmic tuning | `cloud(8,±40c) ∥ osc(saw 220,glide)` | .25 | keyboards gone into space |
| 091·3 | Call of the horns | `res([330,660,990],Q18) → space(4,rot .06)` | .25 | signals between worlds |
| 092·1 | Ma: the space between | `gate([2,.5,3,.4],.03) → res(peaks,Q40,ramp)` | .25 | emptiness as form |
| 092·2 | Sky, Horse and Death | `tape.shuffle(20) → LP(2500→800)` | .15 | first concrete piece |
| 092·3 | Garden | `echo(.5,.5,.5) → space(3,rot .02)` | .45 | sound as garden |
| 093·1 | D.I.Y. circuit bending | `tape.crush(4 bit,hold 10) ∥ tape.stutter(300→100 ms)` | .10 | home-made electronics |
| 093·2 | Self-interruption | `tape.shuffle(16) → gate([.8,.6,.4,.8],.02)` | .15 | the work argues with itself |
| 093·3 | Low fidelity | `tape.crush(6 bit,hold 5) → echo(.28,.5,.5)` | .15 | lo-fi as a position |
| 094·1 | Poème électronique | `space(6,rot .2) ∥ osc(400 siren,glide ×3) → sat(soft,k4)` | .20 | 425 loudspeakers |
| 094·2 | Déserts: blocks | `alt(dry ↔ grain + ring(880), 2.5 s)` | .00 | instrumental vs tape blocks |
| 094·3 | Sirens | `osc(600 siren) ∥ osc(800 siren)` | .35 | sirens as instruments |
| 095·1 | Modal folk | `res([294,330,349,392,440],Q15) ∥ harm([1,1.5])` | .35 | Dorian drone |
| 095·2 | Multi-instrumental | `gate([.4,.3,.5],.2) → res(bank A ↔ bank B)` | .30 | one person, many instruments |
| 095·3 | Drone tanpura | `osc(saw 147 drone)` | .50 | the Indian root |
| 096·1 | Sometimes | `res([220,262,330,392],Q20) → ring(440,.4)` | .25 | spiritual transformed |
| 096·2 | Heterogeneous sound principle | `grain(16/s,40 ms) ∥ clicks(3) ∥ res([330,660],Q15)` | .25 | heterogeneity of timbres |
| 096·3 | Call-response | `echo(.35,.5,.55)` | .45 | antiphony |
| 097·1 | Red Bird: voice → bird | `xf(grain(seq,26/s,40 ms) ↔ grain(rand,34/s,20 ms) + harm([3]))` | .00 | voice → bird metamorphosis |
| 097·2 | Audible Design: taxonomy | `alt(dry ↔ freeze, 3.3 s) ∥ grain(scan,16/s)` | .00 | three transformations demonstrated |
| 097·3 | CDP spectrum | `xf(freeze(180 ms) ↔ res(peaks,Q90,ramp))` | .00 | time-domain → spectral morph |
| 098·1 | Duo for Pianists: cues | `gate([.5,.3,.8,.2,.6],.1, cue-triggered)` | .45 | cybernetic cue score |
| 098·2 | Burdocks | `cloud(6,±20c) ∥ clicks(4,.4→.9)` | .30 | anarchic ensemble |
| 098·3 | Agreement | `canon([1,1.02,.98])` | .40 | coordination without a conductor |
| 099·1 | Montage of contrasts | `tape.shuffle(14) → gate([.2,.8,.2,.8],.1)` | .15 | dialectical montage |
| 099·2 | Battle Piece | `sat(fuzz,k10) → gate([.15,.15,.3,.15,.45],.1)` | .10 | piano battle |
| 099·3 | Form IV: broken sequences | `grain(seq,20/s,60 ms,jump p=.4)` | .10 | sequence torn apart |
| 100·1 | Time's Encomium | `osc(square 220,glide) → ring(880,.6) ∥ grain(seq,14/s)` | .20 | RCA Mark II, time as material |
| 100·2 | Fractal slicing | `tape.shuffle(32) → tape.shuffle(8, nested)` | .10 | fragments of fragments |
| 100·3 | 12-tone grid + phase | `res(12-grid,Q40) ∥ phase(.015)` | .25 | serial pitch, drifting time |

---

## 6. Acceptance tests

| ID | Test | Pass condition |
|----|------|----------------|
| **T1** | Invasion depth | Offline render each slot; measured `I` matches bed-derived target ±3 dB |
| **T2** | Graph connectivity | Every declared op receives non-silent input (per-op RMS probe > −60 dBFS) |
| **T3** | Parameter consumption | Static lint: every key in `fx` data is read by its operator |
| **T4** | Determinism | Seeded ops (`seed`) reproduce byte-identical output across runs |
| **T5** | Analysis validity | `A.peaks` correlates with the file's measured FFT peaks (r > .7) |
| **T6** | No dead slots | No slot measures `I < −40 dB` unless `bed ≥ .8` by design |
| **T7** | Timing | Slot boundaries within ±50 ms at rate 1; ramps scale correctly with rate |
| **T8** | Freeze stability | Frozen material identical at t=0 and t=9 s of the slot |
| **T9** | Canon symmetry | Ratios below 1 produce measurable divergence, not a static delay |
| **T10** | Cloud cardinality | `cloud(n)` shows n distinct simultaneous voices in the render |

**Silence slots (017·3, 084·1, 031·3, 050·3, 071·2)** must measure source residual below −50 dBFS. These are the pieces where the concept *is* the absence — they are the strictest tests in the set.

---

## 7. Repository layout

    REDUCTIONS.html      player + engine
    SPEC.md              this document (normative)
    AUDIT.md             known gaps between code and spec
    reductions.json      machine-readable manifest (generated from C[])
    tests/
      render.mjs         OfflineAudioContext harness, all 300 slots
      report.json        T1–T10 results, 100×3 heatmap
    sound.wav            NOT committed — see below

**About `sound.wav`:** a 50-minute WAV is ~500 MB — over GitHub's 100 MB file limit. Either keep it out of the repo and load it via the file picker (current behaviour), attach it to a Release, use Git LFS, or point the URL field at an external host. GitHub Pages serves the player fine; it will not serve the audio.
