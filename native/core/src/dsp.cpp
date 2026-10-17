#include "chippydip/dsp.hpp"
#include <algorithm>
#include <cmath>
#include <limits>

namespace chippydip {
namespace {
constexpr double pi = 3.1415926535897932384626433832795;
constexpr double twoPi = 2.0 * pi;
[[nodiscard]] bool bounded(float x, float min, float max) noexcept {
  return std::isfinite(x) && x >= min && x <= max;
}
[[nodiscard]] double wrap(double x) noexcept {
  return x - std::floor(x);
}
[[nodiscard]] float sampleMod(double phase, double offset) noexcept {
  return static_cast<float>(std::sin(twoPi * (phase + offset)));
}
} // namespace

double midiFrequency(int midi) noexcept {
  if (midi < 0 || midi > 127) return 0.0;
  return 440.0 * std::pow(2.0, (static_cast<double>(midi) - 69.0) / 12.0);
}

Patch makeNesPulse() noexcept {
  Patch p;
  p.kind = VoiceKind::Pulse; p.level = .18f; p.duty = .5f;
  p.attack = .004f; p.decay = .08f; p.sustain = .72f; p.release = .13f;
  return p;
}
Patch makeNesTriangle() noexcept {
  Patch p = makeNesPulse();
  p.kind = VoiceKind::Triangle; p.level = .22f; p.decay = .12f; p.release = .15f;
  return p;
}
Patch makeNesNoise() noexcept {
  Patch p = makeNesPulse();
  p.kind = VoiceKind::Noise; p.level = .10f; p.decay = .09f; p.sustain = .05f; p.release = .05f;
  return p;
}
Patch makePocketWave() noexcept {
  Patch p = makeNesPulse();
  p.kind = VoiceKind::WaveTable; p.level = .19f; p.attack = .006f;
  for (std::size_t i = 0; i < kWaveSteps; ++i) {
    p.wave[i] = static_cast<std::uint8_t>(
      std::clamp(std::lround(7.5 + 7.5 * std::sin(twoPi * static_cast<double>(i) / 32.0)), 0L, 15L));
  }
  return p;
}
Patch makeGenesisFm() noexcept {
  Patch p = makeNesPulse();
  p.kind = VoiceKind::FM; p.level = .15f; p.release = .22f; p.fmAlgorithm = 0; p.fmIndex = 2.8f;
  return p;
}
Patch makeSamplePatch(SampleView sample) noexcept {
  Patch p = makeNesPulse();
  p.kind = VoiceKind::PCM; p.level = .24f; p.attack = .02f; p.decay = .2f;
  p.sustain = .75f; p.release = .35f; p.sample = sample;
  return p;
}

bool validPatch(const Patch& p) noexcept {
  if (!bounded(p.level, 0.f, 1.f) || !bounded(p.duty, .0625f, .9375f) ||
      !bounded(p.attack, .001f, 2.f) || !bounded(p.decay, .005f, 3.f) ||
      !bounded(p.sustain, 0.f, 1.f) || !bounded(p.release, .01f, 4.f) ||
      !bounded(p.fmIndex, 0.f, 12.f) || p.fmAlgorithm > 3)
    return false;
  switch (p.kind) {
    case VoiceKind::Pulse: case VoiceKind::Triangle: case VoiceKind::Noise:
    case VoiceKind::WaveTable: case VoiceKind::FM: case VoiceKind::PCM: break;
    default: return false;
  }
  for (auto value : p.wave) if (value > 15) return false;
  for (const auto& op : p.fm)
    if (!bounded(op.ratio, .5f, 16.f) || !bounded(op.level, 0.f, 1.f)) return false;
  if (p.kind == VoiceKind::PCM) {
    if (p.sample.data == nullptr || p.sample.frames < 2 || p.sample.frames > 384000 ||
        !std::isfinite(p.sample.sampleRate) || p.sample.sampleRate < 8000.0 ||
        p.sample.sampleRate > 96000.0 || p.sample.rootMidi < 0 || p.sample.rootMidi > 127) return false;
  }
  return true;
}

Engine::Engine(double sampleRate) noexcept : sampleRate_(sampleRate) {}
bool Engine::valid() const noexcept {
  return std::isfinite(sampleRate_) && sampleRate_ >= 8000.0 && sampleRate_ <= 192000.0;
}
double Engine::sampleRate() const noexcept { return sampleRate_; }

bool Engine::noteOn(int midi, const Patch& patch, float velocity) noexcept {
  if (!valid() || midi < 0 || midi > 127 || !bounded(velocity, 0.f, 1.f) ||
      velocity == 0.f || !validPatch(patch)) return false;
  for (auto& voice : voices_) {
    if (voice.active) continue;
    voice = Voice{};
    voice.active = true;
    voice.midi = midi;
    voice.patch = patch;
    voice.frequency = midiFrequency(midi);
    voice.velocity = velocity;
    voice.noise = static_cast<std::uint16_t>(1 + midi * 181);
    return true;
  }
  return false;
}

void Engine::noteOff(int midi) noexcept {
  for (auto& voice : voices_) {
    if (voice.active && !voice.released && voice.midi == midi) {
      voice.released = true;
      voice.releaseStart = voice.envelope;
      voice.releaseAge = 0.0;
    }
  }
}
void Engine::allNotesOff() noexcept {
  for (auto& voice : voices_) {
    if (voice.active && !voice.released) {
      voice.released = true;
      voice.releaseStart = voice.envelope;
      voice.releaseAge = 0.0;
    }
  }
}
void Engine::reset() noexcept { voices_ = {}; }
std::size_t Engine::activeVoiceCount() const noexcept {
  std::size_t n = 0;
  for (const auto& voice : voices_) if (voice.active) ++n;
  return n;
}

float Engine::envelope(Voice& v) const noexcept {
  const auto& p = v.patch;
  const double age = v.age;
  float env = 0.f;
  if (v.released) {
    env = v.releaseStart * static_cast<float>(std::max(0.0, 1.0 - v.releaseAge / p.release));
    if (v.releaseAge >= p.release) v.active = false;
  } else if (age < p.attack) {
    env = static_cast<float>(age / p.attack);
  } else if (age < p.attack + p.decay) {
    const float ratio = static_cast<float>((age - p.attack) / p.decay);
    env = 1.f + (p.sustain - 1.f) * ratio;
  } else {
    env = p.sustain;
  }
  v.envelope = env;
  return env;
}

float Engine::nextSample(Voice& v) noexcept {
  const auto& p = v.patch;
  const double step = v.frequency / sampleRate_;
  const double phase = v.phase;
  float value = 0.f;
  switch (p.kind) {
    case VoiceKind::Pulse:
      value = phase < p.duty ? 1.f : -1.f;
      break;
    case VoiceKind::Triangle:
      value = static_cast<float>(1.0 - 4.0 * std::abs(phase - .5));
      break;
    case VoiceKind::Noise: {
      v.phase += step;
      while (v.phase >= 1.0) {
        const std::uint16_t bit = (v.noise ^ (v.noise >> 1)) & 1u;
        v.noise = static_cast<std::uint16_t>((v.noise >> 1) | (bit << 14));
        v.phase -= 1.0;
      }
      return (v.noise & 1u) ? .75f : -.75f;
    }
    case VoiceKind::WaveTable: {
      const auto index = std::min(static_cast<std::size_t>(phase * 32.0), std::size_t{31});
      value = static_cast<float>(p.wave[index]) / 7.5f - 1.f;
      break;
    }
    case VoiceKind::FM: {
      std::array<float, 4> op = {};
      // Oscillator 4 -> 1 in descending index: routing is acyclic.
      for (int n = 3; n >= 0; --n) {
        double incoming = 0.0;
        if (p.fmAlgorithm == 0) {
          if (n == 2) incoming = op[3]; else if (n == 1) incoming = op[2]; else if (n == 0) incoming = op[1];
        } else if (p.fmAlgorithm == 1) {
          if (n == 1) incoming = op[3]; else if (n == 0) incoming = op[2];
        } else if (p.fmAlgorithm == 2) {
          if (n == 2) incoming = op[3]; else if (n == 0) incoming = op[2] + op[1];
        } else if (n == 2) incoming = op[3];
        const double amount = incoming * p.fmIndex / twoPi;
        op[static_cast<std::size_t>(n)] =
          sampleMod(v.fmPhase[static_cast<std::size_t>(n)], amount) * p.fm[static_cast<std::size_t>(n)].level;
        v.fmPhase[static_cast<std::size_t>(n)] =
          wrap(v.fmPhase[static_cast<std::size_t>(n)] + step * p.fm[static_cast<std::size_t>(n)].ratio);
      }
      value = p.fmAlgorithm == 1 ? (op[0] + op[1]) * .5f :
        p.fmAlgorithm == 3 ? (op[0] + op[1] + op[2]) / 3.f : op[0];
      break;
    }
    case VoiceKind::PCM: {
      const auto& sample = p.sample;
      if (v.samplePosition >= static_cast<double>(sample.frames)) {
        if (!sample.loop) { v.active = false; return 0.f; }
        v.samplePosition = std::fmod(v.samplePosition, static_cast<double>(sample.frames));
      }
      const auto i = static_cast<std::size_t>(v.samplePosition);
      const auto j = i + 1 < sample.frames ? i + 1 : (sample.loop ? 0 : i);
      const double fraction = v.samplePosition - static_cast<double>(i);
      value = static_cast<float>(sample.data[i] + (sample.data[j] - sample.data[i]) * fraction);
      v.samplePosition += std::pow(2.0, (static_cast<double>(v.midi - sample.rootMidi)) / 12.0) *
                          sample.sampleRate / sampleRate_;
      return std::clamp(value, -1.f, 1.f);
    }
    default: break;
  }
  v.phase = wrap(v.phase + step);
  return value;
}

void Engine::render(float* mono, std::size_t frames) noexcept {
  if (mono == nullptr || !valid()) return;
  for (std::size_t i = 0; i < frames; ++i) {
    float mix = 0.f;
    for (auto& voice : voices_) {
      if (!voice.active) continue;
      const float env = envelope(voice);
      if (!voice.active) continue;
      const float signal = nextSample(voice);
      mix += signal * env * voice.patch.level * voice.velocity;
      voice.age += 1.0 / sampleRate_;
      if (voice.released) voice.releaseAge += 1.0 / sampleRate_;
    }
    mono[i] = std::clamp(mix, -.98f, .98f);
  }
}
} // namespace chippydip
