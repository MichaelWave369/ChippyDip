# 🍟 ChippyDip

**Dip into the chips. Make something loud.**

ChippyDip is an original, open-source retro-console-inspired instrument lab, building toward a **Windows standalone instrument + VST3 for FL Studio**. Its first real deliverable is a playable browser lab: no account, ROM, emulator or copyrighted game sample required.

> **Status: v0.1 Web Lab prototype.** This is *NES-inspired* synthesis, not a cycle-accurate NES APU, and **not yet a VST plugin**.

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

## What works now

- Five synthesized presets: Hero Pulse, Pixel Pluck, Duty Dream, Triangle Bass, Noise Machine.
- 12.5%, 25%, 50% and 75% pulse duty controls.
- A simple, polyphonic virtual keyboard (mouse, touch, computer A–K keys).
- A 16-step pattern sequencer with pitch painting, BPM and transport.
- Save and load patterns as validated ChippyDip JSON.
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
| v0.2 | Game Boy-style wave channel and instruments | Independently tested voice/channel behavior |
| v0.3 | Genesis-inspired 4-op FM + PSG | Operator editor and audible parameter tests |
| v0.4 | SNES-inspired sample/BRR architecture | Import, sample playback, echo and conversion tests |
| v0.5 | Cross-chip layers | Mix, modulation and preset recall |
| v0.6 | Native DSP core | Portable C++ DSP with regression tests |
| v0.7 | Standalone + VST3 | Plugin loads in current FL Studio, MIDI and automation verified |
| v1.0 | Full release | Reproducible installers, compatibility testing, documentation |

## Architecture

- `src/audio.ts` contains **independently written** Web Audio voice generation and offline WAV rendering.
- `src/App.tsx` handles the interface, transport, input and pattern controls.
- `src/styles.css` contains ChippyDip's responsive, pixel-arcade visual system.
- The future native core will use shared behavior specifications and test fixtures; **Web Audio code is not a drop-in native VST DSP implementation**.
- `docs/NATIVE_PLAN.md` describes the standalone/plugin architecture and acceptance gates.

ChippyDip makes its own sound. Do not commit commercial ROMs, ripped soundtracks, proprietary game samples, or unlicensed BIOS data.

## Verification and limitations

`npm run check` typechecks; `npm run build` builds the web app. Browser audio still needs listening tests with Chrome, Firefox and Edge. A GitHub Pages URL will work after Pages is enabled and the deploy workflow completes.

The v0.1 waveform shapes, noise register, envelopes and sequencer are *musical interpretations*. They are not yet cycle-accurate CPU/APU timing, memory-mapped registers, sweep units, NES nonlinear mixing, DPCM playback or platform-specific chip bugs. Authenticity claims require reference traces and regression fixtures.

## Principles

Original implementation. No copied synthesizer code. No bundled game audio. No invented fidelity claims. Compatibility gates before shipping. Build outward, circle back.

MIT licensed. © 2026 ChippyDip contributors.
