// ChippyDip: original four-console VST3 instrument wrapper for native C++ DSP.
// Host VST3 events are applied at sample-accurate note offsets. No allocations
// or file system access in process(); all PCM is precomputed outside the callback.
#include "processor.hpp"
#include "ids.hpp"
#include "base/source/fstreamer.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include <algorithm>
#include <cmath>

namespace chippydip::vst3 {
using namespace Steinberg;
namespace {
constexpr double pi = 3.14159265358979323846;
int choice(double normalized) noexcept {
  return std::clamp(static_cast<int>(std::round(normalized * 3.0)), 0, 3);
}
bool unit(double normalized) noexcept {
  return std::isfinite(normalized) && normalized >= 0.0 && normalized <= 1.0;
}
} // namespace

Processor::Processor() {
  setControllerClass(kControllerId);
  buildSamples();
}

tresult PLUGIN_API Processor::initialize(FUnknown* context) {
  const auto result = AudioEffect::initialize(context);
  if (result != kResultOk) return result;
  addAudioOutput(STR16("Stereo Out"), Vst::SpeakerArr::kStereo);
  addEventInput(STR16("MIDI In"), 1);
  return kResultOk;
}

tresult PLUGIN_API Processor::setActive(TBool state) {
  if (!state) engine_.reset();
  return AudioEffect::setActive(state);
}

tresult PLUGIN_API Processor::setupProcessing(Vst::ProcessSetup& setup) {
  if (!std::isfinite(setup.sampleRate) || setup.sampleRate < 8000.0 ||
      setup.sampleRate > 192000.0) return kResultFalse;
  engine_ = chippydip::Engine(setup.sampleRate);
  smoothingStep_ = 1.0 - std::exp(-1.0 / (.009 * setup.sampleRate));
  smoothedVolume_ = volume_;
  return AudioEffect::setupProcessing(setup);
}

tresult PLUGIN_API Processor::canProcessSampleSize(int32 symbolicSampleSize) {
  return symbolicSampleSize == Vst::kSample32 ? kResultTrue : kResultFalse;
}

chippydip::Patch Processor::selectedPatch() const noexcept {
  const int bank = choice(bank_);
  const int variant = choice(patch_);
  chippydip::Patch p;
  switch (bank) {
    case 0:
      p = variant == 1 ? chippydip::makeNesTriangle()
        : variant == 2 ? chippydip::makeNesNoise()
        : chippydip::makeNesPulse();
      if (variant == 3) p.duty = .125f;
      break;
    case 1:
      p = chippydip::makePocketWave();
      if (variant == 1) {
        for (std::size_t i = 0; i < p.wave.size(); ++i)
          p.wave[i] = static_cast<std::uint8_t>(i < 12 ? 15 : i < 24 ? 6 : 0);
      } else if (variant == 2) {
        for (std::size_t i = 0; i < p.wave.size(); ++i)
          p.wave[i] = static_cast<std::uint8_t>(i * 15 / 31);
      } else if (variant == 3) {
        for (std::size_t i = 0; i < p.wave.size(); ++i)
          p.wave[i] = static_cast<std::uint8_t>(i % 8 < 4 ? 15 : 0);
      }
      break;
    case 2:
      p = chippydip::makeGenesisFm();
      p.fmAlgorithm = static_cast<std::uint8_t>(variant);
      break;
    default:
      p = chippydip::makeSamplePatch({
        sampleBank_[static_cast<std::size_t>(variant)].data(),
        kSampleFrames, 32000.0, 57, variant >= 2
      });
      break;
  }
  return p;
}

void Processor::buildSamples() noexcept {
  // Independent procedural PCM: no SNES ROM or samples from other products.
  for (std::size_t v = 0; v < sampleBank_.size(); ++v) {
    for (std::size_t i = 0; i < kSampleFrames; ++i) {
      const double t = static_cast<double>(i) / 32000.0;
      const double phase = 2.0 * pi * 220.0 * t;
      double value = 0.0;
      if (v == 0)
        value = .7 * std::sin(phase) + .21 * std::sin(2 * phase);
      else if (v == 1)
        value = .55 * std::sin(phase) + .17 * std::sin(2.4 * phase) + .10 * std::sin(4.2 * phase);
      else if (v == 2)
        value = .40 * std::sin(phase) + .27 * std::sin(2 * phase) + .12 * std::sin(4 * phase);
      else
        value = .42 * std::sin(phase) + .24 * std::sin(3 * phase) + .08 * std::sin(5 * phase);
      sampleBank_[v][i] = static_cast<float>(value * .65);
    }
  }
}

void Processor::updateParameters(Vst::ProcessData& data) noexcept {
  if (!data.inputParameterChanges) return;
  const int32 count = data.inputParameterChanges->getParameterCount();
  for (int32 i = 0; i < count; ++i) {
    auto* queue = data.inputParameterChanges->getParameterData(i);
    if (!queue || queue->getPointCount() <= 0) continue;
    Vst::ParamValue normalized = 0;
    int32 offset = 0;
    if (queue->getPoint(queue->getPointCount() - 1, offset, normalized) != kResultTrue ||
        !unit(normalized)) continue;
    switch (queue->getParameterId()) {
      case kBank: bank_ = normalized; break;
      case kPatch: patch_ = normalized; break;
      case kVolume: volume_ = normalized; break;
    }
  }
}

void Processor::renderPart(Vst::ProcessData& data, int32 offset, int32 frames) noexcept {
  if (data.numOutputs <= 0 || !data.outputs || frames <= 0) return;
  auto& out = data.outputs[0];
  if (out.numChannels < 1 || !out.channelBuffers32) return;
  const int32 count = std::min<int32>(2, out.numChannels);
  for (int32 rendered = 0; rendered < frames; ) {
    const int32 n = std::min<int32>(static_cast<int32>(kRenderBlock), frames - rendered);
    engine_.render(scratch_.data(), static_cast<std::size_t>(n));
    for (int32 frame = 0; frame < n; ++frame) {
      smoothedVolume_ += (volume_ - smoothedVolume_) * smoothingStep_;
      const float sample = static_cast<float>(scratch_[static_cast<std::size_t>(frame)] * smoothedVolume_);
      for (int32 ch = 0; ch < count; ++ch) {
        if (out.channelBuffers32[ch]) out.channelBuffers32[ch][offset + rendered + frame] = sample;
      }
    }
    rendered += n;
  }
}

tresult PLUGIN_API Processor::process(Vst::ProcessData& data) {
  if (data.symbolicSampleSize != Vst::kSample32) return kResultFalse;
  if (data.numSamples <= 0) return kResultOk;
  updateParameters(data);
  int32 cursor = 0;
  const int32 eventCount = data.inputEvents ? data.inputEvents->getEventCount() : 0;
  for (int32 i = 0; i < eventCount; ++i) {
    Vst::Event event{};
    if (data.inputEvents->getEvent(i, event) != kResultOk) continue;
    const int32 offset = std::clamp(event.sampleOffset, cursor, data.numSamples);
    renderPart(data, cursor, offset - cursor);
    cursor = offset;
    if (event.type == Vst::Event::kNoteOnEvent) {
      if (event.noteOn.pitch >= 0 && event.noteOn.pitch <= 127 &&
          event.noteOn.velocity > 0.0f && event.noteOn.velocity <= 1.0f) {
        (void)engine_.noteOn(event.noteOn.pitch, selectedPatch(), event.noteOn.velocity);
      }
    } else if (event.type == Vst::Event::kNoteOffEvent) {
      engine_.noteOff(event.noteOff.pitch);
    }
  }
  renderPart(data, cursor, data.numSamples - cursor);
  return kResultOk;
}

tresult PLUGIN_API Processor::getState(IBStream* state) {
  if (!state) return kResultFalse;
  IBStreamer writer(state, kLittleEndian);
  if (!writer.writeInt32(1) || !writer.writeDouble(bank_) ||
      !writer.writeDouble(patch_) || !writer.writeDouble(volume_)) return kResultFalse;
  return kResultOk;
}

tresult PLUGIN_API Processor::setState(IBStream* state) {
  if (!state) return kResultFalse;
  IBStreamer reader(state, kLittleEndian);
  int32 version = 0;
  double bank = 0, patch = 0, volume = 0;
  if (!reader.readInt32(version) || version != 1 ||
      !reader.readDouble(bank) || !reader.readDouble(patch) ||
      !reader.readDouble(volume) ||
      !unit(bank) || !unit(patch) || !unit(volume)) return kResultFalse;
  bank_ = bank; patch_ = patch; volume_ = volume; smoothedVolume_ = volume;
  return kResultOk;
}
} // namespace chippydip::vst3
