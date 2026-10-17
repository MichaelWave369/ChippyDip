import test from 'node:test'
import assert from 'node:assert/strict'
import { NES_PRESETS, GAMEBOY_PRESETS, FM_PRESETS, SNES_PRESETS, GB_WAVES, cloneFmPatch, cloneSnesPatch } from '../.testdist/audio.js'
import { serializePattern, parsePattern } from '../.testdist/pattern.js'

const steps = [60, null, 62, null, 64, null, 65, null, 67, null, 69, null, 72, null, 67, null]
const base = (version, preset) => ({ format: 'chippydip-pattern', version, preset, steps, bpm: 116, duty: .5 })

test('v0.1 pattern files load with original NES factory patch', () => {
  const pattern = parsePattern(base(1, NES_PRESETS[0].id))
  assert.equal(pattern.preset.id, 'hero')
  assert.deepEqual(pattern.steps, steps)
  assert.equal(pattern.table, undefined)
  assert.equal(pattern.fm, undefined)
})

test('v0.2 Game Boy patterns load with original editable wave values', () => {
  const pattern = parsePattern({ ...base(2, GAMEBOY_PRESETS[0].id), table: GB_WAVES.tooth })
  assert.equal(pattern.preset.id, GAMEBOY_PRESETS[0].id)
  assert.deepEqual(pattern.table, GB_WAVES.tooth)
  assert.notEqual(pattern.table, GB_WAVES.tooth)
})

test('v0.3 FM patterns serialize and restore independent operator settings', () => {
  const patch = cloneFmPatch(FM_PRESETS[0].fm)
  patch.index = 8.4
  patch.operators[0].ratio = 6
  const file = serializePattern({ preset: FM_PRESETS[0], duty: .5, bpm: 90, steps, fm: patch })
  const decoded = parsePattern(JSON.parse(JSON.stringify(file)))
  assert.equal(file.version, 4)
  assert.equal(file.fm.index, 8.4)
  assert.equal(decoded.fm.operators[0].ratio, 6)
  assert.notEqual(decoded.fm, patch)
})

test('v0.3 NES and Game Boy save still roundtrip and do not acquire FM data', () => {
  for (const preset of [NES_PRESETS[1], GAMEBOY_PRESETS[1]]) {
    const stored = serializePattern({ preset, duty: .25, bpm: 88, steps, table: preset.table })
    const restored = parsePattern(JSON.parse(JSON.stringify(stored)))
    assert.equal(restored.preset.id, preset.id)
    assert.deepEqual(restored.steps, steps)
    assert.equal(restored.fm, undefined)
  }
})

test('import rejects malformed steps and malicious/nonfinite FM values', () => {
  const valid = base(3, FM_PRESETS[1].id)
  for (const item of [
    { ...valid, steps: [60] },
    { ...valid, steps: Array(16).fill(999) },
    { ...valid, bpm: NaN },
    { ...valid, bpm: '120' },
    { ...valid, duty: 99 },
    { ...valid, preset: 'random-file' },
    { ...valid, fm: { algorithm: 0, operators: [], index: 1 } },
    { ...valid, fm: { ...FM_PRESETS[1].fm, index: 200 } },
    { ...valid, version: 5 },
  ]) assert.throws(() => parsePattern(item))
})

test('v0.3 JSON FM files still load without v0.4 sample settings', () => {
  const older = { ...base(3, FM_PRESETS[1].id), fm: cloneFmPatch(FM_PRESETS[1].fm) }
  const parsed = parsePattern(older)
  assert.equal(parsed.preset.id, FM_PRESETS[1].id)
  assert.equal(parsed.fm.algorithm, older.fm.algorithm)
})

test('v0.4 SNES sample settings roundtrip without embedding PCM audio', () => {
  const snes = SNES_PRESETS[2]
  const edited = cloneSnesPatch(snes.sample)
  edited.tune = 7
  edited.echoMix = .49
  edited.loop = false
  const stored = serializePattern({ preset: snes, bpm: 104, duty: .5, steps, sample: edited })
  assert.equal(stored.version, 4)
  assert.equal(stored.sample.echoMix, .49)
  assert.equal(JSON.stringify(stored).includes('pcm'), false)
  const parsed = parsePattern(stored)
  assert.deepEqual(parsed.sample, edited)
  assert.notEqual(parsed.sample, edited)
  assert.equal(parsed.preset.chip, 'snes')
})

test('v0.4 rejects invalid sample parameter data and future unsupported files', () => {
  const good = { ...base(4, SNES_PRESETS[0].id), sample: cloneSnesPatch(SNES_PRESETS[0].sample) }
  for (const malformed of [
    { ...good, sample: { ...good.sample, echoMix: Infinity } },
    { ...good, sample: { ...good.sample, shape: 'not-a-factory-id' } },
    { ...good, sample: { ...good.sample, release: -1 } },
    { ...good, sample: 'binary-rom' },
    { ...good, version: 5 },
  ]) assert.throws(() => parsePattern(malformed))
})
