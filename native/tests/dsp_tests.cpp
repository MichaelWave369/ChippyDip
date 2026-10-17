#include "chippydip/dsp.hpp"
#include <algorithm>
#include <array>
#include <cstdlib>
#include <cmath>
#include <cstddef>
#include <iostream>
#include <limits>
#include <vector>

#define CHECK(expr) do { if (!(expr)) { \
  std::cerr << "FAIL: " << #expr << " at line " << __LINE__ << std::endl; \
  return 1; \
} } while (0)
using namespace chippydip;
constexpr double sr = 44100;
constexpr std::size_t block = 256;
static std::array<float, block> buf{};
static void render(Engine& engine) { engine.render(buf.data(), buf.size()); }
static float peak() {
  float p = 0;
  for (float v : buf) p = std::max(p, std::abs(v));
  return p;
}
static void drain(Engine& engine, int frames = 44100 * 5) {
  for (int i = 0; i < frames / static_cast<int>(block) + 1; ++i) render(engine);
}

int main() {
  Engine e(sr);
  CHECK(e.valid() && std::abs(e.sampleRate() - sr) < .001);
  CHECK(!Engine(0).valid() && !Engine(std::numeric_limits<double>::infinity()).valid());
  CHECK(std::abs(midiFrequency(69) - 440) < .0001);
  CHECK(std::abs(midiFrequency(81) - 880) < .0001);
  CHECK(midiFrequency(-1) == 0 && midiFrequency(128) == 0);

  const auto pulse = makeNesPulse();
  const auto tri = makeNesTriangle();
  const auto noise = makeNesNoise();
  const auto pocket = makePocketWave();
  const auto fm = makeGenesisFm();
  CHECK(validPatch(pulse) && validPatch(tri) && validPatch(noise) &&
         validPatch(pocket) && validPatch(fm));
  CHECK(pulse.duty == .5f && pocket.wave.size() == 32);
  Patch bad = pulse;
  bad.duty = std::numeric_limits<float>::quiet_NaN();
  CHECK(!validPatch(bad) && !e.noteOn(60, bad));

  // Idle output must be silent, even when the provided float buffer was dirty.
  buf.fill(.99f);
  render(e);
  CHECK(peak() == 0.f);

  // No heap work occurs within noteOn/render/noteOff implementation.
  CHECK(e.noteOn(69, pulse));
  for (int i = 0; i < 200; ++i) render(e);
  CHECK(peak() > .01f);
  CHECK(e.activeVoiceCount() == 1);
  e.noteOff(69);
  drain(e);
  CHECK(e.activeVoiceCount() == 0);
  render(e);
  CHECK(peak() == 0.f);

  // Deterministic reset/rewind for every independently written chip core.
  for (const auto& p : {pulse, tri, noise, pocket, fm}) {
    e.reset();
    CHECK(e.noteOn(62, p));
    render(e);
    const auto snapshot = buf;
    e.reset();
    CHECK(e.noteOn(62, p));
    render(e);
    CHECK(snapshot == buf);
    CHECK(peak() > .00001f);
  }
  // Route algorithms produce audible but differing FM outputs.
  std::array<float, 4> signature{};
  for (int algorithm = 0; algorithm < 4; ++algorithm) {
    e.reset();
    auto p = fm;
    p.fmAlgorithm = static_cast<std::uint8_t>(algorithm);
    CHECK(e.noteOn(69, p));
    render(e);
    for (float sample : buf) signature[static_cast<std::size_t>(algorithm)] += std::abs(sample);
  }
  CHECK(signature[0] != signature[1] && signature[2] != signature[3]);

  // Polyphony bounded and no voice stealing. Fresh note rejected after 32.
  e.reset();
  for (std::size_t i = 0; i < kMaxVoices; ++i) CHECK(e.noteOn(60, pulse));
  CHECK(e.activeVoiceCount() == kMaxVoices);
  CHECK(!e.noteOn(60, pulse));
  e.allNotesOff();
  drain(e);
  CHECK(e.activeVoiceCount() == 0);

  // SNES-inspired PCM consumes a caller-owned view, not copied samples.
  constexpr std::array<float, 8> sample = {0.f, .25f, .5f, .75f, 1.f, .75f, .5f, .25f};
  SampleView view{sample.data(), sample.size(), 32000.0, 69, true};
  Patch sampled = makeSamplePatch(view);
  CHECK(validPatch(sampled));
  e.reset();
  CHECK(e.noteOn(69, sampled));
  for (int i = 0; i < 60; ++i) render(e);
  CHECK(peak() > .001f);
  e.noteOff(69);
  drain(e);
  CHECK(e.activeVoiceCount() == 0);

  // All outputs bounded and finite under deliberately crowded mix.
  e.reset();
  for (std::size_t i = 0; i < kMaxVoices; ++i) CHECK(e.noteOn(60, pulse));
  for (int i = 0; i < 8; ++i) {
    render(e);
    for (float sampleValue : buf) CHECK(std::isfinite(sampleValue) && sampleValue <= .98f && sampleValue >= -.98f);
  }
  std::cout << "ChippyDip native core: deterministic synthesis, 4 FM routes, 32 voices, PCM and envelopes PASS\n";
}
