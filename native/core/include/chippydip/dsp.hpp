#pragma once
// ChippyDip native DSP v0.6. Original, dependency-free musical synthesis.
// Hardware-inspired; no cycle-accurate console emulation is claimed.
#include <array>
#include <cstddef>
#include <cstdint>

namespace chippydip {

constexpr std::size_t kMaxVoices = 32;
constexpr std::size_t kWaveSteps = 32;
constexpr std::size_t kFmOperators = 4;

enum class VoiceKind : std::uint8_t { Pulse, Triangle, Noise, WaveTable, FM, PCM };

struct FmOperator {
  float ratio = 1.0f;
  float level = 0.5f;
};

struct SampleView {
  // The caller owns PCM and MUST keep data alive while its voices play.
  const float* data = nullptr;
  std::size_t frames = 0;
  double sampleRate = 32000.0;
  int rootMidi = 57;
  bool loop = false;
};

struct Patch {
  VoiceKind kind = VoiceKind::Pulse;
  float level = 0.18f;
  float duty = 0.5f;
  float attack = 0.005f;
  float decay = 0.12f;
  float sustain = 0.65f;
  float release = 0.16f;
  float fmIndex = 2.8f;
  std::uint8_t fmAlgorithm = 0;
  std::array<FmOperator, kFmOperators> fm = {{{1.f, .9f}, {2.f, .55f}, {3.f, .4f}, {1.f, .3f}}};
  std::array<std::uint8_t, kWaveSteps> wave = {};
  SampleView sample = {};
};

[[nodiscard]] Patch makeNesPulse() noexcept;
[[nodiscard]] Patch makeNesTriangle() noexcept;
[[nodiscard]] Patch makeNesNoise() noexcept;
[[nodiscard]] Patch makePocketWave() noexcept;
[[nodiscard]] Patch makeGenesisFm() noexcept;
[[nodiscard]] Patch makeSamplePatch(SampleView sample) noexcept;

[[nodiscard]] double midiFrequency(int midi) noexcept;
[[nodiscard]] bool validPatch(const Patch& patch) noexcept;

class Engine {
public:
  explicit Engine(double sampleRate) noexcept;
  [[nodiscard]] bool valid() const noexcept;
  [[nodiscard]] double sampleRate() const noexcept;
  // noteOn copies the Patch but NOT the pointed-to sample bytes. No allocation.
  // Returns false for invalid data or no free voices; never steals a voice.
  [[nodiscard]] bool noteOn(int midi, const Patch& patch, float velocity = 1.f) noexcept;
  void noteOff(int midi) noexcept;
  void allNotesOff() noexcept;
  void reset() noexcept;
  // Mono float32 output, overwrite not additive. No heap, locks, I/O or logs.
  void render(float* mono, std::size_t frames) noexcept;
  [[nodiscard]] std::size_t activeVoiceCount() const noexcept;

private:
  struct Voice {
    bool active = false;
    bool released = false;
    int midi = 60;
    Patch patch = {};
    double frequency = 440.0;
    double phase = 0.0;
    std::array<double, kFmOperators> fmPhase = {};
    double samplePosition = 0.0;
    std::uint16_t noise = 1;
    float velocity = 1.f;
    float envelope = 0.f;
    float releaseStart = 0.f;
    double age = 0.0;
    double releaseAge = 0.0;
  };

  [[nodiscard]] float nextSample(Voice& voice) noexcept;
  [[nodiscard]] float envelope(Voice& voice) const noexcept;
  double sampleRate_;
  std::array<Voice, kMaxVoices> voices_ = {};
};

} // namespace chippydip
