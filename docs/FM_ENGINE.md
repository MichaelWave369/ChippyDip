# ChippyDip v0.3 · Genesis-style four-operator FM

This is **original, Web Audio-based frequency modulation**, designed to capture a family of vintage 16-bit console timbres. It is **not a YM2612 emulator** or a Sega-licensed plugin.

## Signal topology

Each voice instantiates four sine oscillators and per-operator gain envelopes. Modulator oscillators feed downstream `OscillatorNode.frequency` parameters through gain scaling. Thus routing changes audio-rate instantaneous pitch, not merely the volume of a mixed sound.

| Algorithm | Internal modulation edges (OP → OP) | Audible carriers |
| --- | --- | --- |
| 1 Stack | 4→3, 3→2, 2→1 | 1 |
| 2 Split | 3→1, 4→2 | 1 + 2 |
| 3 Fork | 4→3, 3→1, 2→1 | 1 |
| 4 Layer | 4→3 | 1 + 2 + 3 |

The UI numbers operators 1 through 4; the audio engine uses indices 0 through 3. All four route graphs are directed acyclic networks, avoiding unbounded audio feedback loops for this prototype.

## Parameters

- **Ratio:** oscillator frequency as a multiple of MIDI note frequency, 0.5× to 16×.
- **Level:** per-operator amplitude before modulation and audible mixing, 0–100%.
- **Index:** global scaling of the modulation path, 0–12 in fundamental-frequency units.
- **ADSR:** attack, decay, sustain and release are set per operator. Decay approaches sustain using Web Audio exponential target scheduling; it is not YM2612's exact envelope generator.
- **Algorithms:** operators may be modulators, carriers, or both depending on routing.
- **Preset editing:** clone the factory patch into per-preset UI state. Reset returns to factory values.
- **Playback:** keyboard, sequencer and WAV export all call the same `createFmVoice` DSP entry point.
- **Storage:** pattern JSON v3 serializes edits. Files v1/v2 remain readable.

## Hardware fidelity boundary

The real Genesis/Mega Drive audio subsystem combines YM2612 and PSG hardware. ChippyDip v0.3 offers **four-op FM only**, not the separate PSG channels or complete six-channel YM2612 architecture. Features such as channel 3 special modes, hardware DAC playback, SSG-EG envelopes, envelope tick timing, hardware phase quantization, detune tables and analog path response are out of scope.

All factory patches and FM topology implementations were independently written without bundled game audio or copied emulator implementations.

## Validation and future work

Automated unit tests check factory presets, patch-value range validation, algorithm topology and voice graph/stop calls using a mocked AudioContext. Browser listening, offline rendering comparisons and measured hardware-reference tests are separate acceptance gates. Native C++/VST3 processing should replace Web Audio nodes with block-based deterministic DSP behind the same patch serialization model, not pretend the JS AudioContext runs inside VST3.

Next: test host behavior, add channel count and authentic PSG separately, followed by multi-chip Double Dip.
