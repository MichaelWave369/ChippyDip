import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_LAYERS, CHIP_ORDER, isValidLayerRack, cloneLayers, activeLayers } from '../.testdist/layers.js'
import { createLayerVoice, NES_PRESETS, GAMEBOY_PRESETS, FM_PRESETS, SNES_PRESETS, PRESETS } from '../.testdist/audio.js'

test('Double Dip begins with four independently selectable chip families', () => {
  assert.deepEqual(DEFAULT_LAYERS.map(layer => layer.chip), CHIP_ORDER)
  assert.equal(isValidLayerRack(DEFAULT_LAYERS), true)
  assert.equal(activeLayers(DEFAULT_LAYERS).length, 4)
  assert.equal(PRESETS.length, 17)
  assert.deepEqual(
    [NES_PRESETS.length, GAMEBOY_PRESETS.length, FM_PRESETS.length, SNES_PRESETS.length],
    [5, 4, 4, 4],
  )
})

test('Double Dip rack import rejects foreign presets, duplicate lanes and non-finite levels', () => {
  for (const bad of [
    null, [],
    DEFAULT_LAYERS.slice(1),
    DEFAULT_LAYERS.concat(DEFAULT_LAYERS[0]),
    DEFAULT_LAYERS.map((layer, i) => i === 1 ? { ...layer, chip: 'nes' } : layer),
    DEFAULT_LAYERS.map((layer, i) => i === 2 ? { ...layer, presetId: 'hero' } : layer),
    DEFAULT_LAYERS.map((layer, i) => i === 0 ? { ...layer, gain: Infinity } : layer),
    DEFAULT_LAYERS.map((layer, i) => i === 0 ? { ...layer, transpose: 37 } : layer),
    DEFAULT_LAYERS.map((layer, i) => i === 0 ? { ...layer, enabled: 'yes' } : layer),
    DEFAULT_LAYERS.map((layer, i) => i === 0 ? { ...layer, pcm: [1, 2, 3] } : layer),
  ]) assert.equal(isValidLayerRack(bad), false)
})

test('rack clone preserves editable patches without retaining shared references', () => {
  const rack = cloneLayers(DEFAULT_LAYERS)
  rack[0].gain = 0
  assert.equal(DEFAULT_LAYERS[0].gain, .60)
  const custom = cloneLayers(DEFAULT_LAYERS)
  custom[1].table = Array(32).fill(7)
  custom[2].fm = FM_PRESETS[0].fm
  custom[3].sample = SNES_PRESETS[0].sample
  const clone = cloneLayers(custom)
  assert.deepEqual(clone[1].table, custom[1].table)
  assert.notEqual(clone[1].table, custom[1].table)
  assert.notEqual(clone[2].fm, custom[2].fm)
  assert.notEqual(clone[3].sample, custom[3].sample)
  assert.equal(isValidLayerRack(custom), true)
  assert.equal(isValidLayerRack(clone), true)
})

test('zero and muted lanes create no additional oscillators', () => {
  const rack = cloneLayers(DEFAULT_LAYERS)
  rack[0].enabled = false
  rack[1].gain = 0
  rack[2].enabled = false
  rack[3].gain = 0
  const host = { createGain() { throw Error('No nodes should be allocated') } }
  const stop = createLayerVoice(host, {}, 60, rack, 0)
  assert.equal(typeof stop, 'function')
  stop(.2)
  stop(.3)
})

test('two chip voices route to unique normalized gains, transpose and release once', () => {
  const nodes = [], oscillators = [], frequencies = []
  const param = () => ({
    value: 0, setValueAtTime(v) { this.value = v; frequencies.push(v) },
    linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {},
  })
  const host = {
    currentTime: 0, sampleRate: 44100,
    createGain() {
      const node = { gain: param(), connections: [], connect(target) { this.connections.push(target) } }
      nodes.push(node); return node
    },
    createOscillator() {
      const osc = { frequency: param(), starts: [], stops: [], connect() {}, setPeriodicWave() {},
        start(at) { this.starts.push(at) }, stop(at) { this.stops.push(at) } }
      oscillators.push(osc); return osc
    },
    createPeriodicWave(real, imag) { return { real, imag } },
  }
  const rack = cloneLayers(DEFAULT_LAYERS)
  rack[2].enabled = false
  rack[3].enabled = false
  const stop = createLayerVoice(host, { output: true }, 60, rack, .03, .8)
  assert.equal(oscillators.length, 2)
  const lanes = nodes.filter(node => node.connections.some(target => target.output === true))
  assert.equal(lanes.length, 2)
  assert.ok(Math.abs(lanes[0].gain.value - rack[0].gain / Math.sqrt(2)) < .0001)
  assert.ok(Math.abs(lanes[1].gain.value - rack[1].gain / Math.sqrt(2)) < .0001)
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12)
  assert.ok(frequencies.some(n => Math.abs(n - freq(60)) < .001))
  assert.ok(frequencies.some(n => Math.abs(n - freq(72)) < .001))
  stop(.2)
  stop(.3)
  assert.ok(oscillators.every(osc => osc.stops.length === 1))
})
