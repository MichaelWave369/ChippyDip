// ChippyDip: original VST3 controller, using the host's generic controls.
#include "controller.hpp"
#include "ids.hpp"
#include "base/source/fstreamer.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"

namespace chippydip::vst3 {
using namespace Steinberg;

tresult PLUGIN_API Controller::initialize(FUnknown* context) {
  auto result = EditControllerEx1::initialize(context);
  if (result != kResultOk) return result;

  parameters.addParameter(STR16("Console Bank"), nullptr, 3, 0.0,
    Vst::ParameterInfo::kCanAutomate, kBank);
  parameters.addParameter(STR16("Factory Sound"), nullptr, 3, 0.0,
    Vst::ParameterInfo::kCanAutomate, kPatch);
  parameters.addParameter(STR16("Master Output"), nullptr, 0, .72,
    Vst::ParameterInfo::kCanAutomate, kVolume);
  return kResultOk;
}

tresult PLUGIN_API Controller::setComponentState(IBStream* state) {
  if (!state) return kResultFalse;
  IBStreamer reader(state, kLittleEndian);
  int32 version = 0;
  double bank = 0.0, patch = 0.0, volume = 0.0;
  if (!reader.readInt32(version) || version != 1 ||
      !reader.readDouble(bank) || !reader.readDouble(patch) ||
      !reader.readDouble(volume)) return kResultFalse;
  if (bank < 0.0 || bank > 1.0 || patch < 0.0 || patch > 1.0 ||
      volume < 0.0 || volume > 1.0) return kResultFalse;
  setParamNormalized(kBank, bank);
  setParamNormalized(kPatch, patch);
  setParamNormalized(kVolume, volume);
  return kResultOk;
}
} // namespace chippydip::vst3
