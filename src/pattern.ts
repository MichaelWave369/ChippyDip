/**
 * ChippyDip versioned pattern contract, shared by browser UI and tests.
 * v1 NES patterns and v2 Pocket Wave patterns remain import-compatible.
 * v3 carries FM routing/operator edits. Reject malformed file content.
 */
import { PRESETS, isValidWaveTable } from './audio.js'
import type { Preset } from './audio.js'
import { cloneFmPatch, isValidFmPatch } from './fm.js'
import type { FmPatch } from './fm.js'

export interface ParsedPattern {
  preset: Preset
  bpm: number
  duty: number
  steps: (number | null)[]
  table?: number[]
  fm?: FmPatch
}
export interface PatternFile {
  format: 'chippydip-pattern'
  version: 3
  preset: string
  duty: number
  bpm: number
  steps: (number | null)[]
  table?: number[]
  fm?: FmPatch
}
const DUTIES = [.125, .25, .5, .75]

export function serializePattern(input: ParsedPattern): PatternFile {
  return {
    format: 'chippydip-pattern',
    version: 3,
    preset: input.preset.id,
    duty: input.duty,
    bpm: input.bpm,
    steps: [...input.steps],
    ...(input.preset.wave === 'wavetable' && input.table ? { table: [...input.table] } : {}),
    ...(input.preset.wave === 'fm' && input.fm ? { fm: cloneFmPatch(input.fm) } : {}),
  }
}

export function parsePattern(input: unknown): ParsedPattern {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Not a pattern')
  const data = input as Record<string, unknown>
  if (data.format !== 'chippydip-pattern' || ![1, 2, 3].includes(data.version as number)) {
    throw new Error('Unsupported pattern format')
  }
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
  if (preset.wave === 'wavetable') {
    if (data.version !== 1 && data.table !== undefined && !isValidWaveTable(data.table)) {
      throw new Error('Invalid handheld wavetable')
    }
    table = data.version !== 1 && isValidWaveTable(data.table) ? [...data.table] : [...(preset.table ?? [])]
  }
  if (preset.wave === 'fm') {
    if (data.version === 3 && data.fm !== undefined && !isValidFmPatch(data.fm)) {
      throw new Error('Invalid FM patch')
    }
    fm = data.version === 3 && isValidFmPatch(data.fm)
      ? cloneFmPatch(data.fm)
      : preset.fm ? cloneFmPatch(preset.fm) : undefined
  }
  // Any invalid optional data is rejected instead of being silently persisted.
  if (data.version === 3 && data.fm !== undefined && !isValidFmPatch(data.fm)) {
    throw new Error('Malformed FM data')
  }
  if (data.version !== 1 && data.table !== undefined && !isValidWaveTable(data.table)) {
    throw new Error('Malformed wave data')
  }
  return { preset, duty: data.duty as number, bpm: data.bpm, steps: [...data.steps], table, fm }
}
