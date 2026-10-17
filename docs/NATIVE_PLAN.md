# Native ChippyDip: standalone + VST3 plan

The Web Lab is an interactive proof of instrument workflow, not a VST. Native playback must remain independent of browser APIs and allocation-heavy UI code.

## Recommended split

```text
native/
  core/          # deterministic chip-inspired DSP, C++20, no GUI dependencies
  instruments/   # patch voice allocation, modulation, sequencer
  format/        # versioned patch/pattern serialization
  tests/         # deterministic trace and audio regression fixtures
  plugin/        # VST3 bridge, host transport, MIDI, automation
  standalone/    # device and MIDI I/O
  ui/            # graphics + controls, never executed on audio thread
```

Plugin candidate: iPlug2 with permissive licensing (revalidate SDK/toolchain versions at implementation time). The VST3 target should honor Steinberg's current SDK terms. The browser app remains an independent preview until cross-platform DSP has passed parity tests.

## Audio engine contract

- Fixed sample-rate and block processing interfaces with explicit time in sample frames.
- No dynamic allocation, locking, file access, logging or networking on the real-time render thread.
- Parameter smoothing, deterministic reset and stable MIDI note-on/note-off semantics.
- One master clock for cross-chip transport; separate per-chip timing domains.
- Polyphony policies explicit: faithful constraints vs extended multi-voice mode.
- Consistent serialization contract with version tags and safe migration.

## Validated sound tiers

1. **Inspired**: original sound design based on public hardware descriptions. Applies to v0.1.
2. **Register-aware**: hardware-specific shapes, tables, envelopes and timing models tested against openly documented traces.
3. **Verified emulation**: independently checked reference behavior across edge cases with documented uncertainty.

Do not use a higher tier for a feature without tests proving it. Authenticity is per engine, never a blanket marketing claim.

## v0.7 host acceptance

- Windows x64 standalone runs with system audio and MIDI keyboard.
- Windows x64 VST3 can be scanned, loaded, removed and reloaded in a recent supported FL Studio build.
- MIDI note-on/off, voice-steal policies, automation and preset reload tested.
- Host sample-rate changes, block sizes, transport stop/start and offline bounce verified.
- Host and plugin don't hang or allocate in audio callback.
- Installer/package and release SHA-256 checksum created by CI.

## Compatibility and IP

The engine may implement publicly documented *behavior* with independently written code. Do not copy emulation cores, ROMs, commercial samples or commercial plugin assets. Use original factory presets; clearly distinguish accurate recreation from artistic approximations.

## Next incremental PR

Add portable `native/core` oscillator unit tests, independent of iPlug2. Once reference waveforms, timing and release behavior pass, bridge that same core to a standalone host and VST3 plugin. This sequencing avoids promising a functional plugin before a native audio engine exists.
