#pragma once
#include "public.sdk/source/vst/vsteditcontroller.h"

namespace chippydip::vst3 {
class Controller final : public Steinberg::Vst::EditControllerEx1 {
public:
  static Steinberg::FUnknown* createInstance(void*) {
    return static_cast<Steinberg::Vst::IEditController*>(new Controller());
  }
  Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
  Steinberg::tresult PLUGIN_API setComponentState(Steinberg::IBStream* state) override;
};
} // namespace chippydip::vst3
