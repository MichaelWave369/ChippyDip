# ChippyDip v0.6 · Native DSP foundation

**Status:** Native C++20 DSP **library** + offline native WAV **command-line renderer**. Builds with no external audio, SDK, GUI or proprietary code. This milestone is **not** a VST3, DAW instrument, or real-time Windows audio app yet.

## Build and listen (Windows PowerShell)

Requires CMake 3.20+ and Visual Studio Build Tools 2022 with the C++ desktop workload (or another supported C++20 compiler).

```powershell
cmake -S native -B build/native -DCMAKE_BUILD_TYPE=Release
cmake --build build/native --config Release
ctest --test-dir build/native -C Release --output-on-failure
.\build\native\Release\chippydip-render.exe --output chippydip-demo.wav
```

Play `chippydip-demo.wav` in FL Studio or any audio editor. This demonstrates a native WAV export, **not** a plugin connection or real-time host audio input.

On Linux:

```bash
cmake -S native -B build/native -DCMAKE_BUILD_TYPE=Release
cmake --build build/native --config Release -j
ctest --test-dir build/native -C Release --output-on-failure
./build/native/chippydip-render --output chippydip-demo.wav
```

GitHub Actions runs both Linux and Windows toolchains. It saves the CLI binary and demo WAV as CI artifacts (for current PR/release runs); this is **not a signed installer**.

## Architecture and API

```text
native/core/include/chippydip/dsp.hpp   Public no-dependency sound contracts
native/core/src/dsp.cpp                 Original DSP/voice manager implementation
native/tools/render.cpp                 Offline demo / mono 16-bit PCM WAV CLI
native/tests/dsp_tests.cpp              Deterministic, non-NDEBUG assertions
native/CMakeLists.txt                   Native CMake library, CLI, CTest
.github/workflows/native.yml            Windows + Linux CI
```

API: `Engine(double sampleRate)`, `noteOn(midi, patch, velocity)`, `noteOff(midi)`, `allNotesOff()`, `reset()`, `render(float* mono, frames)` and `activeVoiceCount()`. Rendering **overwrites** a caller-provided mono buffer. It uses a fixed 32-voice array and has no allocation, locking, I/O, networking or logging inside the audio callback.

All oscillator parameters use numeric, bounded structs; invalid notes, patch settings and full voice capacity are rejected rather than guessed or silently voice-stolen. The sample playback view is **non-owning**: the caller must keep PCM alive until voices end or the engine is reset. This is a deliberate contract so the real-time renderer never allocates.

## Sound engines

- **NES-inspired:** duty pulse, triangle and 15-bit LFSR-style noise. No verified NES sweep/volume registers, timer quantization or hardware nonlinear mixer.
- **Game Boy-inspired:** 32-position, 4-bit waveform lookup and MIDI pitch mapping. No verified channel timer behavior.
- **Genesis-inspired FM:** 4 sine oscillators and four original operator routing algorithms. Native prototype uses per-voice envelope, not the Web Audio version's separate per-operator envelopes, and is **not** a YM2612 emulator.
- **SNES-inspired PCM:** linear-interpolated sample playback, stable sample view, MIDI transposition and optional looping. No BRR decoder/encoder, DSP interpolation/echo or sample memory emulation yet.

The native sound timbres **are not guaranteed to match** the browser Web Audio presets. This phase establishes API, build compatibility and regression tests. Reference audio parity and per-chip envelope fidelity are future gates.

## Critical next steps

1. Run acoustic test vectors and listen to Windows-produced WAVs, including sample aliasing and envelope release.
2. Add deterministic parameter serialization/restore across the browser JSON v5 format and native patch structs.
3. Add buffer-accurate MIDI event timing, parameter smoothing and host-controlled sample rate handling.
4. Integrate with a suitable permissively licensed VST3/standalone framework after reviewing current SDK licenses and verifying an end-to-end FL Studio scan/load/audio pass.
5. Real-time device/MIDI, VST3, a working standalone GUI, a Windows installer and CLAP remain **future** milestones.

**Ledger:** v0.6 is a portable native renderer and C++ library. Do not announce a finished VST3 or hardware-accurate emulation based on this milestone.
