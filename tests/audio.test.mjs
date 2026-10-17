import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NES_PRESETS, GAMEBOY_PRESETS, GB_WAVES, PRESETS,
  isValidWaveTable, noteLabel, midiToHz, createVoice,
} from '../.testdist/audio.js'

// v0.1 factory snapshots are deliberately literal: future patches may not silently
// change the first five historical timbres or their parameter defaults.
const v01 = [
  ['hero', 'HERO PULSE', 'Bright 8-bit lead', 'pulse', .5, .004, .08, .72, .13, .20, '#c3fb6d'],
  ['pluck', 'PIXEL PLUCK', 'Short arcade melody', 'pulse', .125, .002, .14, .12, .08, .18, '#f7a2c5'],
  ['hollow', 'DUTY DREAM', 'Hollow pulse texture', 'pulse', .25, .035, .18, .65, .24, .19, '#97b3ff'],
  ['bass', 'TRIANGLE BASS', 'Round low-end pulse', 'triangle', .5, .003, .12, .80, .15, .24, '#ffd07c'],
  ['noise', 'NOISE MACHINE', 'LFSR percussion', 'noise', .5, .001, .095, .04, .05, .24, '#81edeb'],
]

test('the five original v0.1 factory presets remain exactly as released', () => {
  assert.equal(NES_PRESETS.length, 5)
  assert.deepEqual(NES_PRESETS.map(p => [
    p.id, p.name, p.caption, p.wave, p.duty, p.attack,
    p.decay, p.sustain, p.release, p.level, p.accent,
  ]), v01)
  assert.deepEqual(NES_PRESETS.map(p => p.chip), Array(5).fill(undefined))
  assert.deepEqual(NES_PRESETS.map(p => p.table), Array(5).fill(undefined))
})

test('the Pocket Wave Lab offers four separate new 32-sample, 4-bit factory patches', () => {
  assert.equal(GAMEBOY_PRESETS.length, 4)
  assert.equal(PRESETS.length, 13)
  assert.equal(new Set(PRESETS.map(p => p.id)).size, 13)
  assert.ok(GAMEBOY_PRESETS.every(p => p.chip === 'gameboy' && p.wave === 'wavetable'))
  assert.ok(GAMEBOY_PRESETS.every(p => isValidWaveTable(p.table)))
  assert.ok(Object.values(GB_WAVES).every(isValidWaveTable))
})

test('strict wave data validation protects import and synthesis boundaries', () => {
  assert.equal(isValidWaveTable(Array(32).fill(0)), true)
  assert.equal(isValidWaveTable(Array(32).fill(15)), true)
  for (const value of [null, 'bad', {}, Array(31).fill(7), Array(33).fill(7), Array(32).fill(-1), Array(32).fill(16), Array(32).fill(1.2), Array(32).fill(NaN)]) {
    assert.equal(isValidWaveTable(value), false)
  }
})

test('MIDI conversion has stable canonical concert A and octave labels', () => {
  assert.equal(midiToHz(69), 440)
  assert.equal(midiToHz(81), 880)
  assert.equal(noteLabel(60), 'C4')
  assert.equal(noteLabel(69), 'A4')
})

test('Game Boy-inspired 32-value table generates a bounded and finite periodic wave', () => {
  let renderedWave
  const envelope = {
    setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
    cancelScheduledValues() {}, setTargetAtTime() {},
  }
  const host = {
    currentTime: 0,
    createGain() { return { gain: envelope, connect() {} } },
    createOscillator() {
      return { frequency: { setValueAtTime() {} }, setPeriodicWave(wave) { renderedWave = wave }, connect() {}, start() {}, stop() {} }
    },
    createPeriodicWave(real, imag) {
      return { real: [...real], imag: [...imag] }
    },
  }
  const stop = createVoice(host, {}, 69, GAMEBOY_PRESETS[0], .1, .85, undefined, GB_WAVES.bell)
  assert.equal(typeof stop, 'function')
  assert.equal(renderedWave.real.length, 17)
  assert.equal(renderedWave.imag.length, 17)
  assert.ok(renderedWave.real.every(Number.isFinite))
  assert.ok(renderedWave.imag.every(Number.isFinite))
  assert.ok(renderedWave.imag.some(n => Math.abs(n) > .1))
  stop(.3)
})
