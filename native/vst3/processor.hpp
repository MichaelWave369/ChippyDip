#pragma once
#include "chippydip/dsp.hpp"
#include "public.sdk/source/vst/vstaudioeffect.h"
#include <array>

namespace chippydip::vst3 {
class Processor final : public Steinberg::Vst::AudioEffect {
public:
  Processor();
  static Steinberg::FUnknown* createInstance(void*) {
    return static_cast<Steinberg::Vst::IAudioProcessor*>(new Processor());
  }

  Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
  Steinberg::tresult PLUGIN_API setActive(Steinberg::TBool state) override;
  Steinberg::tresult PLUGIN_API setupProcessing(Steinberg::Vst::ProcessSetup& setup) override;
  Steinberg::tresult PLUGIN_API canProcessSampleSize(Steinberg::int32 symbolicSampleSize) override;
  Steinberg::tresult PLUGIN_API process(Steinberg::Vst::ProcessData& data) override;
  Steinberg::tresult PLUGIN_API getState(Steinberg::IBStream* stream) override;
  Steinberg::tresult PLUGIN_API setState(Steinberg::IBStream* stream) override;

private:
  static constexpr std::size_t kRenderBlock = 256;
  static constexpr std::size_t kSampleFrames = 32000;
  chippydip::Engine engine_{44100.0};
  std::array<float, kRenderBlock> scratch_{};
  std::array<std::array<float, kSampleFrames>, 4> sampleBank_{};
  double bank_ = 0.0;  // 0..1 -> 4 chip families
  double patch_ = 0.0; // 0..1 -> 4 instrument choices per family
  double volume_ = 0.72;
  double smoothedVolume_ = 0.72;
  double smoothingStep_ = .005;

  void buildSamples() noexcept;
  [[nodiscard]] chippydip::Patch selectedPatch() const noexcept;
  void renderPart(Steinberg::Vst::ProcessData& data, Steinberg::int32 offset, Steinberg::int32 frames) noexcept;
  void updateParameters(Steinberg::Vst::ProcessData& data) noexcept;
};
} // namespace chippydip::vst3
