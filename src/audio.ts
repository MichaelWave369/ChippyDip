/**
 * ChippyDip's original, NES-inspired Web Audio voice engine.
 * This is a musical interpretation of the APU, NOT cycle-accurate emulation.
 * No ROMs, proprietary samples, or borrowed emulation cores.
 */
import { createFmVoice, FM_PRESETS } from './fm.js'
import type { FmPatch } from './fm.js'

export { FM_PRESETS, FM_ALGORITHMS, isValidFmPatch, cloneFmPatch } from './fm.js'
export type { FmPatch, FmOperator, FmAlgorithm } from './fm.js'

export type WaveKind = 'pulse' | 'triangle' | 'noise' | 'wavetable' | 'fm'
export type ChipFamily = 'nes' | 'gameboy' | 'genesis'

export interface Preset {
  id: string
  name: string
  caption: string
  wave: WaveKind
  duty: number
  attack: number
  decay: number
  sustain: number
  release: number
  level: number
  accent: string
  chip?: ChipFamily
  table?: number[]
  fm?: FmPatch
}

// The v0.1 factory patches and their sound settings are deliberately unchanged.
export const NES_PRESETS: Preset[] = [
  { id: 'hero', name: 'HERO PULSE', caption: 'Bright 8-bit lead', wave: 'pulse', duty: .5, attack: .004, decay: .08, sustain: .72, release: .13, level: .20, accent: '#c3fb6d' },
  { id: 'pluck', name: 'PIXEL PLUCK', caption: 'Short arcade melody', wave: 'pulse', duty: .125, attack: .002, decay: .14, sustain: .12, release: .08, level: .18, accent: '#f7a2c5' },
  { id: 'hollow', name: 'DUTY DREAM', caption: 'Hollow pulse texture', wave: 'pulse', duty: .25, attack: .035, decay: .18, sustain: .65, release: .24, level: .19, accent: '#97b3ff' },
  { id: 'bass', name: 'TRIANGLE BASS', caption: 'Round low-end pulse', wave: 'triangle', duty: .5, attack: .003, decay: .12, sustain: .80, release: .15, level: .24, accent: '#ffd07c' },
  { id: 'noise', name: 'NOISE MACHINE', caption: 'LFSR percussion', wave: 'noise', duty: .5, attack: .001, decay: .095, sustain: .04, release: .05, level: .24, accent: '#81edeb' },
]

/** Original 32-entry, 4-bit (0..15) sound shapes, inspired by handheld wave RAM. */
export const GB_WAVES: Record<string, number[]> = {
  round: Array.from({ length: 32 }, (_, i) => Math.max(0, Math.min(15, Math.round(7.5 + 7.5 * Math.sin(2 * Math.PI * i / 32))))),
  tooth: Array.from({ length: 32 }, (_, i) => Math.round(15 * i / 31)),
  bite: Array.from({ length: 32 }, (_, i) => i < 8 ? 15 : i < 16 ? 10 : i < 24 ? 4 : 0),
  bell: Array.from({ length: 32 }, (_, i) => Math.max(0, Math.min(15, Math.round(7.5 + 4.8 * Math.sin(2 * Math.PI * i / 32) + 3.1 * Math.sin(6 * Math.PI * i / 32))))),
}

export const GAMEBOY_PRESETS: Preset[] = [
  { id: 'pocket-round', name: 'POCKET ROUND', caption: 'Soft handheld lead', chip: 'gameboy', wave: 'wavetable', table: GB_WAVES.round, duty: .5, attack: .007, decay: .13, sustain: .68, release: .16, level: .23, accent: '#a9d887' },
  { id: 'pocket-bite', name: 'POCKET BITE', caption: 'Chunky wave bass', chip: 'gameboy', wave: 'wavetable', table: GB_WAVES.bite, duty: .5, attack: .002, decay: .095, sustain: .66, release: .11, level: .20, accent: '#f7d47d' },
  { id: 'pocket-bell', name: 'POCKET BELL', caption: 'Shimmering wave tone', chip: 'gameboy', wave: 'wavetable', table: GB_WAVES.bell, duty: .5, attack: .007, decay: .32, sustain: .25, release: .35, level: .21, accent: '#96c1ff' },
  { id: 'pocket-tooth', name: 'POCKET TOOTH', caption: 'Crunchy rising edge', chip: 'gameboy', wave: 'wavetable', table: GB_WAVES.tooth, duty: .5, attack: .001, decay: .08, sustain: .8, release: .10, level: .18, accent: '#f2a3d5' },
]
export const PRESETS: Preset[] = [...NES_PRESETS, ...GAMEBOY_PRESETS, ...FM_PRESETS]

export function isValidWaveTable(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 32 &&
    value.every(sample => Number.isInteger(sample) && sample >= 0 && sample <= 15)
}

export const DEFAULT_STEPS: (number | null)[] =
  [60, null, 67, 72, 60, 67, 64, null, 65, null, 72, 69, 67, 64, 62, null]

export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

export function noteLabel(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return names[((note % 12) + 12) % 12] + (Math.floor(note / 12) - 1)
}

type AudioHost = AudioContext | OfflineAudioContext
type StopVoice = (when?: number) => void

function makePulse(host: AudioHost, duty: number): PeriodicWave {
  // Fourier representation of a duty-cycle pulse, with partials limited to 64.
  const real = new Float32Array(65)
  const imag = new Float32Array(65)
  for (let n = 1; n <= 64; n++) {
    real[n] = (2 / (Math.PI * n)) * Math.sin(2 * Math.PI * n * duty)
    imag[n] = (2 / (Math.PI * n)) * (1 - Math.cos(2 * Math.PI * n * duty))
  }
  return host.createPeriodicWave(real, imag, { disableNormalization: false })
}

function makeLfsrBuffer(host: AudioHost): AudioBuffer {
  const length = Math.round(host.sampleRate * .6)
  const buffer = host.createBuffer(1, length, host.sampleRate)
  const channel = buffer.getChannelData(0)
  let shift = 1
  for (let i = 0; i < length; i++) {
    const bit = (shift ^ (shift >> 1)) & 1
    shift = (shift >> 1) | (bit << 14)
    channel[i] = (shift & 1) ? .78 : -.78
  }
  return buffer
}

const pulseWaves = new WeakMap<AudioHost, Map<number, PeriodicWave>>()
const noiseBuffers = new WeakMap<AudioHost, AudioBuffer>()
const tableWaves = new WeakMap<AudioHost, Map<string, PeriodicWave>>()

/** Fourier synth of a 32-slot, 4-bit wavetable; musical, not cycle-accurate wave RAM. */
function getTableWave(host: AudioHost, table: number[]): PeriodicWave {
  const key = table.join(',')
  let cache = tableWaves.get(host)
  if (!cache) {
    cache = new Map()
    tableWaves.set(host, cache)
  }
  const found = cache.get(key)
  if (found) return found
  const real = new Float32Array(17)
  const imag = new Float32Array(17)
  const mean = table.reduce((sum, n) => sum + n, 0) / 32
  for (let harmonic = 1; harmonic <= 16; harmonic++) {
    for (let index = 0; index < 32; index++) {
      const angle = 2 * Math.PI * harmonic * index / 32
      const value = (table[index] - mean) / 7.5
      real[harmonic] += (2 / 32) * value * Math.cos(angle)
      imag[harmonic] += (2 / 32) * value * Math.sin(angle)
    }
  }
  const wave = host.createPeriodicWave(real, imag, { disableNormalization: false })
  // A capped cache avoids unbounded growth while editing wave columns.
  if (cache.size >= 96) cache.clear()
  cache.set(key, wave)
  return wave
}

function getPulse(host: AudioHost, duty: number): PeriodicWave {
  let cache = pulseWaves.get(host)
  if (!cache) {
    cache = new Map()
    pulseWaves.set(host, cache)
  }
  if (!cache.has(duty)) cache.set(duty, makePulse(host, duty))
  return cache.get(duty)!
}

function getNoise(host: AudioHost): AudioBuffer {
  let buffer = noiseBuffers.get(host)
  if (!buffer) {
    buffer = makeLfsrBuffer(host)
    noiseBuffers.set(host, buffer)
  }
  return buffer
}

export function createVoice(
  host: AudioHost,
  destination: AudioNode,
  midi: number,
  preset: Preset,
  when: number,
  velocity = .85,
  dutyOverride?: number,
  tableOverride?: number[],
  fmOverride?: FmPatch,
): StopVoice {
  if (preset.wave === 'fm') {
    const patch = fmOverride ?? preset.fm
    if (!patch) throw new Error('FM preset missing operator patch')
    return createFmVoice(host, destination, midi, patch, preset.level, when, velocity)
  }
  const gain = host.createGain()
  const attackEnd = when + Math.max(.001, preset.attack)
  const decayEnd = attackEnd + Math.max(.002, preset.decay)
  const peak = preset.level * Math.max(.1, Math.min(1, velocity))
  gain.gain.setValueAtTime(.0001, when)
  gain.gain.linearRampToValueAtTime(peak, attackEnd)
  gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * preset.sustain), decayEnd)
  gain.connect(destination)

  let source: OscillatorNode | AudioBufferSourceNode
  if (preset.wave === 'noise') {
    const noise = host.createBufferSource()
    noise.buffer = getNoise(host)
    noise.loop = true
    noise.playbackRate.value = Math.max(.15, Math.min(5, midiToHz(midi) / 300))
    const filter = host.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = Math.min(11500, Math.max(350, midiToHz(midi) * 10))
    filter.Q.value = .8
    noise.connect(filter)
    filter.connect(gain)
    source = noise
  } else {
    const osc = host.createOscillator()
    osc.frequency.setValueAtTime(midiToHz(midi), when)
    if (preset.wave === 'pulse') osc.setPeriodicWave(getPulse(host, dutyOverride ?? preset.duty))
    else if (preset.wave === 'wavetable') osc.setPeriodicWave(getTableWave(host, tableOverride ?? preset.table ?? GB_WAVES.round))
    else osc.type = 'triangle'
    osc.connect(gain)
    source = osc
  }
  source.start(when)

  let released = false
  return (requested?: number) => {
    if (released) return
    released = true
    const at = Math.max(when + .002, requested ?? host.currentTime)
    const release = Math.max(.012, preset.release)
    gain.gain.cancelScheduledValues(at)
    gain.gain.setTargetAtTime(.0001, at, release / 4)
    source.stop(at + release * 2.5 + .03)
  }
}

export class ChippyAudio {
  private ctx: AudioContext | null = null
  private input: GainNode | null = null
  private scope: AnalyserNode | null = null
  private voices = new Set<StopVoice>()
  private level = .72

  async wake(): Promise<void> {
    if (!this.ctx) {
      const ctx = new AudioContext()
      const input = ctx.createGain()
      input.gain.value = this.level
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -12
      limiter.knee.value = 8
      limiter.ratio.value = 8
      limiter.attack.value = .003
      limiter.release.value = .16
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      input.connect(limiter)
      limiter.connect(analyser)
      analyser.connect(ctx.destination)
      this.ctx = ctx
      this.input = input
      this.scope = analyser
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }

  get time(): number { return this.ctx?.currentTime ?? 0 }
  get analyser(): AnalyserNode | null { return this.scope }

  setVolume(volume: number): void {
    this.level = Math.max(0, Math.min(1, volume))
    this.input?.gain.setTargetAtTime(this.level, this.time, .015)
  }

  noteOn(note: number, preset: Preset, duty?: number, table?: number[], fm?: FmPatch): StopVoice {
    if (!this.ctx || !this.input) return () => {}
    const voice = createVoice(this.ctx, this.input, note, preset, this.time + .006, .95, duty, table, fm)
    this.voices.add(voice)
    return () => {
      voice()
      this.voices.delete(voice)
    }
  }

  trigger(note: number, preset: Preset, start: number, duration: number, duty?: number, table?: number[], fm?: FmPatch): void {
    if (!this.ctx || !this.input) return
    const stop = createVoice(this.ctx, this.input, note, preset, start, .82, duty, table, fm)
    stop(start + duration)
  }

  stopAll(): void {
    for (const stop of this.voices) stop()
    this.voices.clear()
  }

  async close(): Promise<void> {
    this.stopAll()
    await this.ctx?.close()
    this.ctx = null
    this.input = null
    this.scope = null
  }
}

/** Render the sequencer from the SAME original voice generator, without recording speakers. */
export async function exportLoop(
  steps: (number | null)[],
  preset: Preset,
  bpm: number,
  duty?: number,
  table?: number[],
  fm?: FmPatch,
): Promise<Blob> {
  const stepTime = 60 / bpm / 4
  const sampleRate = 44100
  const seconds = stepTime * steps.length + .8
  const offline = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)
  const input = offline.createGain()
  input.gain.value = .68
  const compressor = offline.createDynamicsCompressor()
  compressor.threshold.value = -12
  compressor.ratio.value = 8
  input.connect(compressor)
  compressor.connect(offline.destination)
  steps.forEach((note, i) => {
    if (note === null) return
    const at = .05 + stepTime * i
    const stop = createVoice(offline, input, note, preset, at, .83, duty, table, fm)
    stop(at + stepTime * .76)
  })
  const rendered = await offline.startRendering()
  return encodeWav(rendered)
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels
  const sampleCount = buffer.length
  const bytes = 44 + sampleCount * channels * 2
  const array = new ArrayBuffer(bytes)
  const view = new DataView(array)
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, bytes - 8, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, bytes - 44, true)
  const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i))
  let offset = 44
  for (let sample = 0; sample < sampleCount; sample++) {
    for (let ch = 0; ch < channels; ch++) {
      const value = Math.max(-1, Math.min(1, data[ch][sample]))
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([array], { type: 'audio/wav' })
}
