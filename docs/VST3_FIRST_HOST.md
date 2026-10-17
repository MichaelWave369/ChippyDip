# ChippyDip v0.7 · First Windows VST3 instrument candidate

**Scope:** Official Steinberg MIT-licensed VST3 SDK bridge around ChippyDip's original native C++20 DSP. Unlike the native v0.6 WAV CLI, this builds an actual Windows x64 **instrument VST3 bundle**. It is an *initial host-compatibility candidate*, not yet a signed release or an FL Studio-verified plugin.

## What the plugin does

- Declares **one VST3 event input** (notes) and a **stereo audio output**. No microphone/track audio is required.
- Processes incoming VST3 note-on/note-off events at the event's sample offset inside the host audio block.
- Routes pitches into our existing 32-voice C++ sound engine. All voices release after note-off. No audio allocations, disk reads, mutexes or network calls occur in the callback.
- Supplies three host-automatable controls via the **DAW's standard parameter UI**: Console Bank (NES, Game Boy, Genesis, SNES), Factory Sound (four sound variations per bank), and Master Output.
- Remembers the bank, sound and output volume via VST3 plugin state. Audio-rate processing is 32-bit floating-point; output is dual-mono stereo.
- Builds four original PCM sample variants at initialization for the SNES-inspired bank. No game samples, emulator cores or proprietary assets included.
- Uses an output gain smoother. **Note offsets** are sample-accurate; continuous host automation currently applies the last parameter point at block start, not yet sample-accurate automation.
- Uses a generic host-generated parameter editor; **there is no custom ChippyDip graphical VST window yet**.

## GitHub Actions

The separate `Windows VST3 Candidate` workflow downloads the **official**, tagged `steinbergmedia/vst3sdk` checkout as a build-only dependency, configures the instrument and compiles a genuine `ChippyDip.vst3` bundle. If successful, an unsigned `ChippyDip-v0.7-Windows-x64-VST3-CANDIDATE` artifact contains a ZIP of the VST3 bundle.

Steinberg SDK source is **not copied into ChippyDip**. The synthesizer DSP and wrapper are authored inside this repo. The SDK is MIT-licensed, but all associated trademark and packaging requirements still apply.

### Local build (Windows, Visual Studio 2022 + CMake)

```powershell
git clone --recursive --branch v3.8.1_build_84 https://github.com/steinbergmedia/vst3sdk.git third_party/vst3sdk
cmake -S native -B build/vst3 -A x64 -DCHIPPYDIP_BUILD_VST3=ON "-DCHIPPYDIP_VST3_SDK_PATH=$PWD/third_party/vst3sdk"
cmake --build build/vst3 --config Release --target ChippyDip
```

Normal `cmake -S native -B build/native` still builds only the v0.6 CLI/core/tests without any VST3 SDK.

## FL Studio manual acceptance gate (NOT YET VERIFIED)

1. Download/extract the Windows x64 VST3 candidate artifact produced by the successful Actions workflow.
2. Copy the **whole** `ChippyDip.vst3` bundle into the Windows system VST3 plugin directory (commonly `C:\Program Files\Common Files\VST3`). Do not flatten the bundle.
3. In FL Studio, use its plugin manager's **rescan** / verify plugins operation.
4. Confirm ChippyDip appears as an **instrument**, loads and can be removed without error.
5. In a fresh project, play MIDI notes, switch among all four banks, change the four sound variations and Master Output, then stop notes. Save, close and reload the project to verify state.
6. Test sample rates 44.1k/48k/96k, several host block sizes, transport stop, and offline bounce. Check CPU overload, clicks, stuck notes and scanner crashes.
7. Report any FL Studio host or scanner error before considering a signed release.

## Known limitations

- No custom plugin UI, MIDI expression/modwheel, host transport sync, true hardware emulation, native Double Dip four-layer control, DAW preset bank browser or signed installer.
- Console sounds are inspired, not hardware-cycle-accurate, and native patch variants are not 1:1 copies of all 17 browser presets.
- Sample-accurate VST MIDI event handling is implemented; host automation timing and project reload require real-host verification.
- The plugin uses the caller/host's sample clock and only supports **32-bit float** I/O in this candidate.
- Build success is **not** evidence of compatibility with any particular version of FL Studio. The first user-side FL Studio test is a separate acceptance gate.

**Ledger: candidate -> verify with real FL Studio -> improve/stabilize -> release.**
