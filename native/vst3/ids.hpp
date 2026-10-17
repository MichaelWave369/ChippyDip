#pragma once
// Unique, stable ChippyDip component/controller IDs. Never change after release.
#include "pluginterfaces/base/funknown.h"
#include "pluginterfaces/vst/vsttypes.h"

namespace chippydip::vst3 {
static const Steinberg::FUID kProcessorId(0xCA411CD3, 0xA7EB44B2, 0x965E6527, 0x8DD18714);
static const Steinberg::FUID kControllerId(0xF1E2A5C3, 0xB9D44F46, 0xA290C2C7, 0x3BEB1D26);
enum Parameter : Steinberg::Vst::ParamID {
  kBank = 100,
  kPatch = 101,
  kVolume = 102,
};
} // namespace chippydip::vst3
