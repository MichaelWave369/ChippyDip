import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SNES_PRESETS, SNES_SAMPLE_IDS, makeFactorySample, isValidSnesPatch,
  cloneSnesPatch, isValidSampleData, createSampleVoice,
} from '../.testdist/snes.js'

test('the SNES-inspired sample bank ships four distinct original instruments', () => {
  assert.equal(SNES_PRESETS.length, 4)
  assert.equal(new Set(SNES_PRESETS.map(p => p.id)).size, 4)
  assert.equal(SNES_SAMPLE_IDS.length, 4)
  assert.ok(SNES_PRESETS.every(p => p.wave === 'sample' && p.chip === 'snes' && isValidSnesPatch(p.sample)))
})

test('original generated sample data is stable, finite, amplitude bounded and cached', () => {
  for (const shape of SNES_SAMPLE_IDS) {
    const sample = makeFactorySample(shape)
    assert.equal(sample.sampleRate, 32000)
    assert.equal(sample.rootMidi, 57)
    assert.ok(isValidSampleData(sample), shape)
    assert.equal(sample, makeFactorySample(shape))
    assert.ok(sample.pcm.some(n => Math.abs(n) > .1), shape)
    assert.ok(sample.pcm.every(n => Math.abs(n) <= 1), shape)
  }
})

test('invalid sample and patch settings are rejected, preset patch reset is independent', () => {
  const source = SNES_PRESETS[0].sample
  const copy = cloneSnesPatch(source)
  copy.echoMix = .6
  assert.notEqual(copy.echoMix, source.echoMix)
  assert.ok(isValidSnesPatch(copy))
  for (const bad of [
    null, {}, { ...source, echoMix: NaN }, { ...source, echoMix: 20 },
    { ...source, loop: 'true' }, { ...source, shape: 'ripped-rom' },
    { ...source, tune: Infinity }, { ...source, release: -3 },
  ]) assert.equal(isValidSnesPatch(bad), false)
  const sample = makeFactorySample('harp')
  assert.equal(isValidSampleData({ ...sample, rootMidi: 200 }), false)
  assert.equal(isValidSampleData({ ...sample, pcm: Float32Array.of(NaN) }), false)
})

test('sample voice routes buffer playback and echo nodes and stops only once', () => {
  const sources = [], delays = [], gains = []
  const param = () => ({
    value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    setTargetAtTime() {}, cancelScheduledValues() {},
  })
  const host = {
    currentTime: 0,
    createBuffer(channels, length, rate) {
      assert.equal(channels, 1)
      return { copyToChannel() {}, length, sampleRate: rate }
    },
    createBufferSource() {
      const node = {
        buffer: null, loop: false, playbackRate: param(), starts: [], stops: [],
        connect() {}, start(t) { this.starts.push(t) }, stop(t) { this.stops.push(t) },
      }
      sources.push(node); return node
    },
    createGain() {
      const node = { gain: param(), connections: [], connect(dest) { this.connections.push(dest) } }
      gains.push(node); return node
    },
    createDelay() {
      const node = { delayTime: { value: 0 }, connections: [], connect(dest) { this.connections.push(dest) } }
      delays.push(node); return node
    },
  }
  const patch = cloneSnesPatch(SNES_PRESETS[1].sample)
  const stop = createSampleVoice(host, {}, 69, patch, .2, .1)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].starts[0], .1)
  assert.equal(delays.length, 1)
  assert.ok(delays[0].delayTime.value > 0)
  assert.ok(gains.length >= 3)
  stop(.3)
  stop(.4)
  assert.equal(sources[0].stops.length, 1)
  assert.ok(sources[0].stops[0] > .3)
})

test('no echo patch skips delay network', () => {
  let createdDelays = 0
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} })
  const host = {
    currentTime: 0,
    createBuffer() { return { copyToChannel() {} } },
    createBufferSource() { return { playbackRate: param(), connect() {}, start() {}, stop() {} } },
    createGain() { return { gain: param(), connect() {} } },
    createDelay() { createdDelays++; return { delayTime: param(), connect() {} } },
  }
  createSampleVoice(host, {}, 60, { ...SNES_PRESETS[2].sample, echoMix: 0 }, .18, .2)(.3)
  assert.equal(createdDelays, 0)
})
