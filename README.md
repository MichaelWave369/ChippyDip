# 🍟 ChippyDip

**Dip into the chips. Make something loud.**

ChippyDip is an original, open-source retro-console-inspired instrument lab, building toward a **Windows standalone instrument + VST3 for FL Studio**. Its first real deliverable is a playable browser lab with four chip families: no account, ROM, emulator or copyrighted game sample required.

> **Status: v0.5 browser Web Lab + v0.6 native C++ DSP foundation.** NES, Game Boy, Genesis and SNES-style sample sounds are **hardware-inspired**, not cycle-accurate hardware emulation. Standalone/VST3 builds remain planned.

## Try it

After the first merge and enabling GitHub Pages (Settings → Pages → Build and deployment → GitHub Actions):

**https://michaelwave369.github.io/ChippyDip/**

Or locally (Node.js 22+ recommended):

```bash
npm install
npm run dev
```

Visit the local address printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

## Native v0.6 (C++20 and offline WAV)

New: a **dependency-free native C++20 DSP library**, a four-family native demo **WAV command-line renderer**, and CTest regression checks built on **Windows and Linux**. This is native audio code, not yet a Windows live-audio app or a VST3. See [native setup and fidelity boundaries](docs/NATIVE_CORE.md) for build/run instructions, including a WAV you can import into FL Studio.

## What works now

- **DOUBLE DIP:** new four-lane cross-console instrument rack. Enable/mute each chip, choose individual presets, adjust level and transpose, then play all active layers from one key or the 16-step sequencer. Normalized mix and shared compressor feed the output; WAV exports render all four layers.\n- **NES Classics:** the five *unchanged* v0.1 factory patches: Hero Pulse, Pixel Pluck, Duty Dream, Triangle Bass, Noise Machine.\n- **Pocket Wave Lab:** four original Game Boy-inspired 32-step/4-bit wavetable patches, and a click/tap editor for drawing new waves.\n- Waveform edits are kept separately per pocket preset, and can be stored in pattern JSON.\n- **SNES Sample Lab:** four independently generated PCM factory instruments (harp, bell, strings, choir) with pitch tracking, looping, ADSR, controllable echo, and session-local audio file import. Imported audio works in live playback and WAV rendering but is **not embedded in JSON patterns**.\n- **Genesis FM Lab:** four original four-operator FM factory patches, four graph algorithms, modulation-index slider, oscillator ratios/levels, and individual ADSR envelope editors. Audio-rate modulator connections drive oscillator frequency inputs.
- 12.5%, 25%, 50% and 75% pulse duty controls.
- A simple, polyphonic virtual keyboard (mouse, touch, computer A–K keys).
- A 16-step pattern sequencer with pitch painting, BPM and transport.
- Save and load patterns as validated ChippyDip JSON. The v0.5 exporter saves format version 5, including single/double mode, all four layer settings, edited Game Boy waves, Genesis FM operators, or SNES sample controls. Legacy v1, v2, v3 and v4 files still load. Imported audio bytes are never embedded in these JSON files.
- **Offline WAV export** of the one-bar pattern: PCM 16-bit stereo, 44.1 kHz.
- Real-time waveform scope, master volume and compressor/limiter.
- Responsive web UI, GitHub Pages deployment workflow.

### Keyboard

A W S E D F T G Y H U J K maps chromatically from C to C of the selected octave. Click a key, then click sequencer steps to assign that pitch. Click a step containing the currently selected pitch again to clear it. The tempo is constrained to 60–200 BPM.

Browsers suspend audio until a user gesture; press a note or Play to activate it. WAV exporting renders audio directly through the offline synth, not through a microphone.

## Roadmap

| Stage | Focus | Definition of done |
| --- | --- | --- |
| v0.1 Web Lab | Original pulse/triangle/noise prototype | Produces sound, plays steps, saves patterns, exports WAV |
| v0.2 | Game Boy-inspired 32-slot wavetable and instruments | Preset-preservation tests, editable waves and WAV export |
| v0.3 | Genesis-inspired four-operator FM | Four routing graphs, editor, preset tests, JSON v3 compatibility |
| v0.4 | SNES-inspired PCM sample lab | Original factory samples, audio import, playback, echo and tests; BRR decoder/encoder future |
| v0.5 | DOUBLE DIP cross-chip layers | Four independent lanes, levels, transpose, mute, presets, JSON v5 and WAV |
| v0.6 | Native DSP core | Portable C++20 library, 32 voices, Windows/Linux CI, 4-family WAV demo |
| v0.7 | Standalone + VST3 | Plugin loads in current FL Studio, MIDI and automation verified |
| v1.0 | Full release | Reproducible installers, compatibility testing, documentation |

## Architecture

- `native/core` contains the original C++20 DSP contract, and `native/tools` includes a portable WAV renderer.\n- `src/audio.ts` contains **independently written** Web Audio voice generation and offline WAV rendering.
- `src/layers.ts` holds the typed four-chip rack and import validation, and `src/LayerRack.tsx` presents the rack.\n- `src/App.tsx` handles the interface, transport, input and pattern controls.
- `src/styles.css` contains ChippyDip's responsive, pixel-arcade visual system.
- The future native core will use shared behavior specifications and test fixtures; **Web Audio code is not a drop-in native VST DSP implementation**.
- `docs/NATIVE_PLAN.md` describes the standalone/plugin architecture and acceptance gates.

ChippyDip makes its own sound. Do not commit commercial ROMs, ripped soundtracks, proprietary game samples, or unlicensed BIOS data.

## Verification and limitations

`npm run check` typechecks; `npm run build` builds the web app. Browser audio still needs listening tests with Chrome, Firefox and Edge. A GitHub Pages URL will work after Pages is enabled and the deploy workflow completes.

The NES, Game Boy, Genesis and SNES-style sounds are *musical interpretations*. The Game Boy renderer uses Fourier synthesis of 32 4-bit wave values, NOT original sample-rate/timing behavior. The Genesis-inspired FM engine uses Web Audio sine oscillators and audio-rate modulation connections, NOT YM2612 phase-generation tables, DAC quantization, chip register behavior, or timing. They are not yet cycle-accurate CPU/APU timing, memory-mapped registers, sweep units, NES nonlinear mixing, DPCM playback or platform-specific chip bugs. Authenticity claims require reference traces and regression fixtures.

## Patch preservation and import safety

The first five NES-inspired v0.1 factory parameters stay untouched and are checked by a literal regression snapshot in `tests/audio.test.mjs`. The four Game Boy patches remain distinct, and the new Genesis FM patches have their own regression tests. Exported pattern files use JSON version 5; the importer accepts versions 1, 2, 3, 4 and 5. The parser checks 16 sequencer steps, tempo, pulse duty, optional 32-step wave data, four-operator FM structures and sample settings before applying state. Original patches aren't mutated when editing custom variations. Audio files are generated locally; no user audio is uploaded.

See [Double Dip layering architecture](docs/DOUBLE_DIP.md), [SNES Sample Lab design and limits](docs/SNES_SAMPLE_LAB.md) and [FM architecture and limitations](docs/FM_ENGINE.md) for current synthesis behavior and verification gates.

## Principles

Original implementation. No copied synthesizer code. No bundled game audio. No invented fidelity claims. Compatibility gates before shipping. Build outward, circle back.

MIT licensed. © 2026 ChippyDip contributors.
