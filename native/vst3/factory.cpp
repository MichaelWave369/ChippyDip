// ChippyDip VST3 factory. Unique stable component/controller IDs.
#include "processor.hpp"
#include "controller.hpp"
#include "ids.hpp"
#include "public.sdk/source/main/pluginfactory.h"
#include "pluginterfaces/vst/vsttypes.h"

#define stringPluginName "ChippyDip"
#define FULL_VERSION_STR "0.7.0"

using namespace Steinberg;
using namespace Steinberg::Vst;

BEGIN_FACTORY_DEF("ChippyDip", "https://github.com/MichaelWave369/ChippyDip", "")

DEF_CLASS2(INLINE_UID_FROM_FUID(chippydip::vst3::kProcessorId),
  PClassInfo::kManyInstances, kVstAudioEffectClass, stringPluginName,
  Vst::kDistributable, "Instrument|Synth", FULL_VERSION_STR, kVstVersionString,
  chippydip::vst3::Processor::createInstance)

DEF_CLASS2(INLINE_UID_FROM_FUID(chippydip::vst3::kControllerId),
  PClassInfo::kManyInstances, kVstComponentControllerClass, "ChippyDip Controller",
  0, "", FULL_VERSION_STR, kVstVersionString,
  chippydip::vst3::Controller::createInstance)

END_FACTORY
