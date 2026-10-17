# DOUBLE DIP · ChippyDip v0.5

A single MIDI note can fan out into four **independent sound families**: NES pulse/noise, Game Boy wavetable, Genesis-style four-operator FM, and SNES-style sampled instruments.

## How to play

1. Select **DOUBLE DIP · FOUR CHIPS** above the sound lab.
2. In the rack choose a factory patch for each chip, toggle each lane on/off and set lane level and semitone transpose.
3. Play the Dipboard, type A–K, or run the 16-step sequencer. Enabled lanes play together.
4. Press **EDIT PATCH** in a lane to show the corresponding single-instrument patch bank and its Game Boy waveform editor, Genesis FM editor or SNES controls. Edits apply to that lane when its selected preset matches.
5. Export WAV to render the entire layered pattern. Save JSON to preserve the rack and edited parameters.

**Single Chip** switches back to the existing instrument behavior. It does not erase the rack.

## Sound graph

```text
MIDI / Sequencer
        |
        +--> NES voice --------> Lane gain --+
        +--> Game Boy voice ---> Lane gain --+
        +--> Genesis FM voice -> Lane gain --+--> Master gain --> Compressor --> Scope --> Audio output
        +--> SNES sample voice -> Lane gain --+
```

For N active lanes, each gain is multiplied by `1/sqrt(N)`; this is a musical normalization heuristic and not a true mastering loudness target. All four lanes are mixed before the existing master dynamics stage. Playback and offline WAV export call the same `createLayerVoice` path.

The browser engine caps simultaneously held layered voice groups at 12. This is **not** a register-accurate NES, Game Boy, YM2612 or SNES emulation. Chip-specific operator and sample architecture limitations are documented separately.

## File contract

The `chippydip-pattern` JSON version **5** includes `mode` and four chip-ordered `layers`: each lane's chip, factory preset ID, enabled flag, gain, transpose and optional edited chip-specific table/FM/sample settings. The validator rejects unrecognized layer fields, invalid cross-chip preset assignments, non-finite levels and out-of-range parameters. The parser accepts versions **1–4** as single-chip patches and initializes their rack from safe defaults.

Imported SNES PCM is **never embedded** in the JSON, uploaded, or implicitly restored from a previous browser session. Users must re-import audio on reopening. Recording/export is local through OfflineAudioContext.

## Verification gates

- Regression tests: old factory patch definitions unchanged, versioned pattern import compatibility, rack shape, per-chip ownership, immutable clones, waveform generation and voice release behavior.
- CI: strict TypeScript, Node tests and Vite production build.
- Browser acceptance still required: Firefox/Chrome/Edge real sound checks, live-layer mutes/transposition, old JSON imports, save/reload and WAV playback.

## Next milestones

A stronger native audio-core boundary and real host MIDI clocks, then Windows standalone and VST3. These are **not included** in v0.5.
