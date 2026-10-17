/**
 * ChippyDip versioned pattern contract, shared by browser UI and tests.
 * v1 NES patterns and v2 Pocket Wave patterns remain import-compatible.
 * v3 carries FM routing/operator edits; v4 adds SNES sample settings.
 * v5 saves the four-lane Double Dip rack and single/double mode.
 * Imported PCM is session-only and deliberately never embedded in JSON.
 */
import { PRESETS, isValidWaveTable } from './audio.js'
import type { Preset } from './audio.js'
import { cloneFmPatch, isValidFmPatch } from './fm.js'
import type { FmPatch } from './fm.js'
import { cloneSnesPatch, isValidSnesPatch } from './snes.js'
import type { SnesPatch } from './snes.js'
import { DEFAULT_LAYERS, cloneLayers, isValidLayerRack } from './layers.js'
import type { SoundLayer, PlayMode } from './layers.js'

export interface ParsedPattern {
  preset: Preset
  bpm: number
  duty: number
  steps: (number | null)[]
  table?: number[]
  fm?: FmPatch
  sample?: SnesPatch
  mode?: PlayMode
  layers?: SoundLayer[]
}
export interface PatternFile {
  format: 'chippydip-pattern'
  version: 5
  preset: string
  duty: number
  bpm: number
  steps: (number | null)[]
  table?: number[]
  fm?: FmPatch
  sample?: SnesPatch
  mode: PlayMode
  layers: SoundLayer[]
}
const DUTIES = [.125, .25, .5, .75]

export function serializePattern(input: ParsedPattern): PatternFile {
  const layers = input.layers ?? DEFAULT_LAYERS
  if (!isValidLayerRack(layers)) throw new Error('Invalid Double Dip rack')
  return {
    format: 'chippydip-pattern',
    version: 5,
    preset: input.preset.id,
    duty: input.duty,
    bpm: input.bpm,
    steps: [...input.steps],
    ...(input.preset.wave === 'wavetable' && input.table ? { table: [...input.table] } : {}),
    ...(input.preset.wave === 'fm' && input.fm ? { fm: cloneFmPatch(input.fm) } : {}),
    ...(input.preset.wave === 'sample' && input.sample ? { sample: cloneSnesPatch(input.sample) } : {}),
    mode: input.mode ?? 'single',
    layers: cloneLayers(layers),
  }
}

export function parsePattern(input: unknown): ParsedPattern {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Not a pattern')
  const data = input as Record<string, unknown>
  if (data.format !== 'chippydip-pattern' || ![1, 2, 3, 4, 5].includes(data.version as number)) {
    throw new Error('Unsupported pattern format')
  }
  const version = data.version as number
  if (version === 5 && (data.mode !== 'single' && data.mode !== 'double')) {
    throw new Error('Invalid sound mode')
  }
  if (version === 5 && !isValidLayerRack(data.layers)) {
    throw new Error('Invalid Double Dip rack')
  }
  const mode: PlayMode = version === 5 ? data.mode as PlayMode : 'single'
  const layers = version === 5 ? cloneLayers(data.layers as SoundLayer[]) : cloneLayers(DEFAULT_LAYERS)
  if (!Array.isArray(data.steps) || data.steps.length !== 16 ||
    !data.steps.every((note: unknown) => note === null ||
      (typeof note === 'number' && Number.isInteger(note) && note >= 24 && note <= 108))) {
    throw new Error('Invalid sequencer steps')
  }
  const preset = PRESETS.find(p => p.id === data.preset)
  if (!preset) throw new Error('Unknown factory patch')
  if (typeof data.bpm !== 'number' || !Number.isFinite(data.bpm) || data.bpm < 60 || data.bpm > 200) {
    throw new Error('Invalid tempo')
  }
  if (!DUTIES.includes(data.duty as number)) throw new Error('Invalid pulse duty')
  let table: number[] | undefined
  let fm: FmPatch | undefined
  let sample: SnesPatch | undefined
  if (preset.wave === 'wavetable') {
    if (version !== 1 && data.table !== undefined && !isValidWaveTable(data.table)) {
      throw new Error('Invalid handheld wavetable')
    }
    table = version !== 1 && isValidWaveTable(data.table) ? [...data.table] : [...(preset.table ?? [])]
  }
  if (preset.wave === 'fm') {
    if (version >= 3 && data.fm !== undefined && !isValidFmPatch(data.fm)) {
      throw new Error('Invalid FM patch')
    }
    fm = version >= 3 && isValidFmPatch(data.fm)
      ? cloneFmPatch(data.fm)
      : preset.fm ? cloneFmPatch(preset.fm) : undefined
  }
  if (preset.wave === 'sample') {
    if (version >= 4 && data.sample !== undefined && !isValidSnesPatch(data.sample)) {
      throw new Error('Invalid SNES sample settings')
    }
    sample = version >= 4 && isValidSnesPatch(data.sample)
      ? cloneSnesPatch(data.sample)
      : preset.sample ? cloneSnesPatch(preset.sample) : undefined
  }
  // Any invalid optional data is rejected instead of being silently persisted.
  if (version >= 3 && data.fm !== undefined && !isValidFmPatch(data.fm)) {
    throw new Error('Malformed FM data')
  }
  if (version !== 1 && data.table !== undefined && !isValidWaveTable(data.table)) {
    throw new Error('Malformed wave data')
  }
  if (version >= 4 && data.sample !== undefined && !isValidSnesPatch(data.sample)) {
    throw new Error('Malformed sample settings')
  }
  return { preset, duty: data.duty as number, bpm: data.bpm, steps: [...data.steps], table, fm, sample, mode, layers }
}
