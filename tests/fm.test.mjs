import test from 'node:test'
import assert from 'node:assert/strict'
import { FM_PRESETS, FM_ALGORITHMS, isValidFmPatch, cloneFmPatch, createFmVoice } from '../.testdist/fm.js'

test('four new FM presets have distinct names and fully valid four-operator layouts', () => {
  assert.equal(FM_PRESETS.length, 4)
  assert.equal(new Set(FM_PRESETS.map(p => p.id)).size, FM_PRESETS.length)
  for (const patch of FM_PRESETS) {
    assert.equal(patch.wave, 'fm')
    assert.equal(patch.chip, 'genesis')
    assert.ok(isValidFmPatch(patch.fm), patch.id)
    assert.equal(patch.fm.operators.length, 4)
  }
})

test('FM algorithm routes have four bounded operators and no self-edges or loops', () => {
  assert.equal(FM_ALGORITHMS.length, 4)
  assert.equal(new Set(FM_ALGORITHMS.map(route => JSON.stringify(route.edges))).size, 4)
  for (const route of FM_ALGORITHMS) {
    assert.ok(route.carriers.length > 0)
    assert.ok(route.carriers.every(index => Number.isInteger(index) && index >= 0 && index <= 3))
    // All edges go from a higher op index toward a lower one, so cycles are impossible.
    assert.ok(route.edges.every(([from, to]) => from > to && from <= 3 && to >= 0))
  }
})

test('FM import validation rejects invalid algorithms, shapes and nonfinite parameter values', () => {
  const valid = cloneFmPatch(FM_PRESETS[0].fm)
  assert.equal(isValidFmPatch(valid), true)
  for (const invalid of [null, {}, { ...valid, algorithm: 5 }, { ...valid, index: 99 },
    { ...valid, operators: valid.operators.slice(0, 3) },
    { ...valid, operators: valid.operators.map((op, i) => i === 1 ? { ...op, ratio: NaN } : op) },
    { ...valid, operators: valid.operators.map((op, i) => i === 2 ? { ...op, level: Infinity } : op) },
    { ...valid, operators: valid.operators.map((op, i) => i === 3 ? { ...op, release: -1 } : op) }]) {
    assert.equal(isValidFmPatch(invalid), false)
  }
})

test('changing a saved FM patch never mutates its factory preset', () => {
  const factory = FM_PRESETS[1].fm
  const copy = cloneFmPatch(factory)
  copy.operators[0].ratio = 12
  copy.index = 5
  assert.notEqual(factory.operators[0].ratio, copy.operators[0].ratio)
  assert.notEqual(factory.index, copy.index)
})

test('FM voice creates 4 sine operators, routes carrier and modulator paths, and releases once', () => {
  const oscillators = []
  const gainNodes = []
  const params = []
  function param() {
    const value = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }
    params.push(value)
    return value
  }
  const host = {
    currentTime: 0,
    createOscillator() {
      const osc = {
        type: '',
        frequency: param(), connections: [], starts: [], stops: [],
        connect(to) { this.connections.push(to) },
        start(at) { this.starts.push(at) },
        stop(at) { this.stops.push(at) },
      }
      oscillators.push(osc)
      return osc
    },
    createGain() {
      const gain = { gain: param(), connections: [], connect(to) { this.connections.push(to) } }
      gainNodes.push(gain)
      return gain
    },
  }
  const patch = cloneFmPatch(FM_PRESETS[0].fm)
  const stop = createFmVoice(host, { output: true }, 69, patch, .24, .05)
  assert.equal(oscillators.length, 4)
  assert.ok(oscillators.every(osc => osc.type === 'sine' && osc.starts.length === 1))
  const frequencyParams = oscillators.map(osc => osc.frequency)
  const wiredModPaths = gainNodes.filter(gain => gain.connections.some(target => frequencyParams.includes(target)))
  assert.equal(wiredModPaths.length, FM_ALGORITHMS[patch.algorithm].edges.length)
  assert.ok(gainNodes.some(gain => gain.connections.some(target => target.output === true)))
  stop(.2)
  stop(.3)
  assert.ok(oscillators.every(osc => osc.stops.length === 1))
  assert.ok(oscillators.every(osc => osc.stops[0] > .2))
})
