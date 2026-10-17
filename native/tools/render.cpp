// ChippyDip's first original native output: render a four-chip demo into PCM WAV.
// This is a command-line *offline* renderer, NOT yet a standalone live instrument.
#include "chippydip/dsp.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace {
constexpr double sr = 44100.0;
constexpr double pi = 3.14159265358979323846;
void u16(std::ostream& s, std::uint16_t value) {
  for (int i = 0; i < 2; ++i) s.put(static_cast<char>((value >> (8*i)) & 255));
}
void u32(std::ostream& s, std::uint32_t value) {
  for (int i = 0; i < 4; ++i) s.put(static_cast<char>((value >> (8*i)) & 255));
}
bool saveWav(const std::string& name, const std::vector<float>& pcm) {
  if (pcm.empty() || pcm.size() > 0xffffffffu / 2) return false;
  std::ofstream out(name, std::ios::binary);
  if (!out) return false;
  const auto payload = static_cast<std::uint32_t>(pcm.size() * 2);
  out.write("RIFF", 4); u32(out, payload + 36);
  out.write("WAVEfmt ", 8); u32(out, 16);
  u16(out, 1); u16(out, 1); u32(out, static_cast<std::uint32_t>(sr));
  u32(out, static_cast<std::uint32_t>(sr) * 2); u16(out, 2); u16(out, 16);
  out.write("data", 4); u32(out, payload);
  for (float value : pcm) {
    value = std::clamp(value, -1.f, 1.f);
    const auto signedPcm = static_cast<std::int16_t>(std::lround(value * 32767.f));
    u16(out, static_cast<std::uint16_t>(signedPcm));
  }
  return static_cast<bool>(out);
}
std::vector<float> originalStrings() {
  std::vector<float> pcm(32000);
  for (std::size_t i = 0; i < pcm.size(); ++i) {
    const double phase = 2 * pi * 220 * static_cast<double>(i) / 32000.0;
    double signal = 0;
    for (int harmonic = 1; harmonic <= 7; ++harmonic)
      signal += (.56 / (harmonic * harmonic)) * std::sin(phase * harmonic);
    pcm[i] = static_cast<float>(signal);
  }
  return pcm;
}

int demo(const std::string& output) {
  using namespace chippydip;
  Engine engine(sr);
  if (!engine.valid()) return 2;
  auto pcmSample = originalStrings();
  SampleView view{pcmSample.data(), pcmSample.size(), 32000.0, 57, true};
  const auto pulse = makeNesPulse();
  const auto pocket = makePocketWave();
  const auto fm = makeGenesisFm();
  const auto strings = makeSamplePatch(view);

  constexpr std::array<int, 16> notes = {60, 64, 67, 72, 67, 64, 62, 67, 60, 67, 69, 65, 64, 62, 60, 67};
  constexpr std::size_t framesPerStep = 11025; // 250 ms at 44.1 kHz
  std::vector<float> audio(notes.size() * framesPerStep + static_cast<std::size_t>(sr));
  std::array<float, 256> scratch{};
  std::size_t position = 0;
  for (std::size_t step = 0; step < notes.size(); ++step) {
    const int note = notes[step];
    if (!engine.noteOn(note, pulse, .80f) || !engine.noteOn(note + 12, pocket, .65f) ||
        !engine.noteOn(note - 12, fm, .65f) || !engine.noteOn(note, strings, .35f)) return 3;
    for (std::size_t rendered = 0; rendered < framesPerStep; ) {
      const auto count = std::min(scratch.size(), framesPerStep - rendered);
      engine.render(scratch.data(), count);
      std::copy_n(scratch.begin(), count, audio.begin() + static_cast<std::ptrdiff_t>(position));
      position += count; rendered += count;
    }
    engine.noteOff(note); engine.noteOff(note + 12); engine.noteOff(note - 12);
  }
  engine.allNotesOff();
  while (position < audio.size()) {
    const auto count = std::min(scratch.size(), audio.size() - position);
    engine.render(scratch.data(), count);
    std::copy_n(scratch.begin(), count, audio.begin() + static_cast<std::ptrdiff_t>(position));
    position += count;
  }
  if (!saveWav(output, audio)) {
    std::cerr << "Could not write output WAV: " << output << '\n';
    return 4;
  }
  std::cout << "ChippyDip native v0.6 | four-chip inspired WAV: " << output
            << " | " << audio.size() << " frames\n";
  return 0;
}
} // namespace

int main(int argc, char** argv) {
  if (argc == 2 && std::string(argv[1]) == "--self-test") {
    chippydip::Engine e(sr);
    const auto p = chippydip::makeNesPulse();
    if (!e.valid() || !e.noteOn(69, p)) return 2;
    std::array<float, 1024> samples{};
    e.render(samples.data(), samples.size());
    return std::any_of(samples.begin(), samples.end(), [](float x) { return std::abs(x) > .01f; }) ? 0 : 3;
  }
  if (argc == 3 && std::string(argv[1]) == "--output") return demo(argv[2]);
  if (argc == 1) return demo("chippydip-demo.wav");
  std::cerr << "Usage: chippydip-render [--output output.wav | --self-test]\n";
  return 1;
}
