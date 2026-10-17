# ChippyDip v0.4 · SNES-inspired Sample Lab

## What is real today

- Four **original procedurally generated** PCM instrument timbres: Starlight Harp, Moon Bell, Pixel Strings, Neon Choir.
- Pitched and looped sample playback through Web Audio, adjustable attack, decay, sustain, release, semitone tuning, delay time and echo wet mix.
- Browser-supported local audio file import (max 6 MiB, decoded 8 seconds maximum, mono/stereo). Files are decoded and mixed down to mono in the browser; decoded samples also have a strict 384,000-frame ceiling. Import fails if either limit is exceeded.
- The same sample playback path is used by the Dipboard, sequencer and offline WAV rendering.
- Saved ChippyDip JSON v4 stores sample **settings only**, never PCM bytes, file paths or audio URLs. Imported audio is session-only. Re-import after reopening; loading a SNES pattern clears any old imported sample for that patch to avoid accidental mismatches.
- Original v0.1 NES, v0.2 Game Boy and v0.3 Genesis patches and v1–v3 patterns remain compatible.

## Hardware fidelity boundary

This is **SNES-inspired sampled synthesis**, *not* an SPC700/S-DSP emulator. The real hardware uses BRR compressed samples, 32 kHz DSP mixing, Gaussian interpolation, echo FIR filtering, specific ADSR and gain envelopes, pitch tables and eight-voice hardware limitations. v0.4 intentionally uses ordinary PCM buffers, Web Audio resampling, standard envelopes and a configurable feedback delay echo. No cycle-accuracy, true BRR import/export, SPC soundtrack playback or ripped game audio is claimed.

## Originality and rights

Factory sample bytes are created deterministically by ChippyDip's own algorithms. No commercial game ROM, BIOS, soundtrack or sample bank is included. Users should only import audio they have the right to use.

## Next independent milestones

1. Measure sample behavior and add deterministic render/regression tests.
2. Implement an **original** BRR decode-and-encode path with public spec references and independent test fixtures.
3. Add a hardware-inspired eight-voice sample scheduler and closer echo DSP.
4. Build **Double Dip** cross-family layering before moving toward the native C++ audio engine, standalone Windows and FL Studio VST3.
