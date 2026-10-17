import { useCallback, useEffect, useRef, useState } from 'react'
import { ChippyAudio, DEFAULT_STEPS, PRESETS, NES_PRESETS, GAMEBOY_PRESETS, FM_PRESETS, FM_ALGORITHMS, GB_WAVES, cloneFmPatch, exportLoop, noteLabel } from './audio'
import type { ChipFamily, FmPatch, FmOperator } from './audio'
import { parsePattern, serializePattern } from './pattern'

const KEYS = [
  { offset: 0, key: 'A' }, { offset: 1, key: 'W' }, { offset: 2, key: 'S' },
  { offset: 3, key: 'E' }, { offset: 4, key: 'D' }, { offset: 5, key: 'F' },
  { offset: 6, key: 'T' }, { offset: 7, key: 'G' }, { offset: 8, key: 'Y' },
  { offset: 9, key: 'H' }, { offset: 10, key: 'U' }, { offset: 11, key: 'J' },
  { offset: 12, key: 'K' },
]
const BLACK = new Set([1, 3, 6, 8, 10])
const DUTIES = [.125, .25, .5, .75]
const FM_RATIOS = [.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16]
const repoUrl = 'https://github.com/MichaelWave369/ChippyDip'

function Oscilloscope({ analyser }: { analyser: () => AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let frame = 0
    const canvas = canvasRef.current
    const draw = () => {
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      context.fillStyle = '#0e1524'
      context.fillRect(0, 0, width, height)
      context.strokeStyle = 'rgba(143, 175, 180, .12)'
      context.lineWidth = 1
      for (let i = 1; i < 12; i++) {
        const x = i * width / 12
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke()
      }
      for (let i = 1; i < 5; i++) {
        const y = i * height / 5
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke()
      }
      const node = analyser()
      const data = node ? new Uint8Array(node.fftSize) : null
      if (node && data) node.getByteTimeDomainData(data)
      context.beginPath()
      context.lineWidth = Math.max(2, dpr * 1.8)
      context.strokeStyle = '#c7ff7c'
      context.shadowBlur = 14 * dpr
      context.shadowColor = 'rgba(181, 255, 103, .6)'
      for (let i = 0; i < width; i++) {
        const v = data
          ? (data[Math.floor(i / width * data.length)] - 128) / 128
          : Math.sin(i / width * 8 * Math.PI) * .12
        const y = height / 2 + v * height * .42
        if (i === 0) context.moveTo(i, y)
        else context.lineTo(i, y)
      }
      context.stroke()
      context.shadowBlur = 0
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [analyser])
  return <canvas ref={canvasRef} className="scope" aria-label="Live waveform oscilloscope" role="img" />
}

export default function App() {
  const engineRef = useRef<ChippyAudio | null>(null)
  if (!engineRef.current) engineRef.current = new ChippyAudio()
  const audio = engineRef.current
  const heldRef = useRef(new Set<string>())
  const releasesRef = useRef(new Map<string, () => void>())
  const [chip, setChip] = useState<ChipFamily>('nes')
  const [presetId, setPresetId] = useState('hero')
  const [customWaveTables, setCustomWaveTables] = useState<Record<string, number[]>>({})
  const [customFmPatches, setCustomFmPatches] = useState<Record<string, FmPatch>>({})
  const [duty, setDuty] = useState(.5)
  const [volume, setVolume] = useState(72)
  const [bpm, setBpm] = useState(116)
  const [octave, setOctave] = useState(4)
  const [selectedNote, setSelectedNote] = useState(60)
  const [steps, setSteps] = useState<(number | null)[]>([...DEFAULT_STEPS])
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(-1)
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle')
  const [exporting, setExporting] = useState(false)
  const preset = PRESETS.find(p => p.id === presetId) ?? PRESETS[0]
  const currentBank = chip === 'nes' ? NES_PRESETS : chip === 'gameboy' ? GAMEBOY_PRESETS : FM_PRESETS
  const activeWave = customWaveTables[preset.id] ?? preset.table ?? GB_WAVES.round
  const activeFm = customFmPatches[preset.id] ?? preset.fm
  const latestRef = useRef({ steps, preset, duty, activeWave, activeFm })
  latestRef.current = { steps, preset, duty, activeWave, activeFm }

  const selectChip = (selected: ChipFamily) => {
    setChip(selected)
    setPresetId(selected === 'nes' ? NES_PRESETS[0].id : selected === 'gameboy' ? GAMEBOY_PRESETS[0].id : FM_PRESETS[0].id)
  }

  const editWaveValue = (index: number, value: number) => {
    if (preset.wave !== 'wavetable') return
    const next = [...activeWave]
    next[index] = Math.max(0, Math.min(15, Math.round(value)))
    setCustomWaveTables(previous => ({ ...previous, [preset.id]: next }))
  }

  const updateFm = (update: (fm: FmPatch) => FmPatch) => {
    if (preset.wave !== 'fm' || !preset.fm) return
    setCustomFmPatches(previous => ({
      ...previous,
      [preset.id]: update(cloneFmPatch(previous[preset.id] ?? preset.fm!)),
    }))
  }

  const setFmOperator = (index: number, field: keyof FmOperator, value: number) => {
    updateFm(fm => {
      fm.operators[index][field] = value
      return fm
    })
  }

  const wake = useCallback(async () => {
    try {
      await audio.wake()
      audio.setVolume(volume / 100)
      setStatus('ready')
      return true
    } catch (error) {
      console.error('Audio unavailable', error)
      setStatus('error')
      return false
    }
  }, [audio, volume])

  const press = useCallback((id: string, note: number) => {
    if (heldRef.current.has(id)) return
    heldRef.current.add(id)
    setSelectedNote(note)
    void wake().then(ready => {
      if (!ready || !heldRef.current.has(id)) return
      const stop = audio.noteOn(note, preset, duty, activeWave, activeFm)
      releasesRef.current.set(id, stop)
    })
  }, [wake, audio, preset, duty, activeWave, activeFm])

  const release = useCallback((id: string) => {
    heldRef.current.delete(id)
    releasesRef.current.get(id)?.()
    releasesRef.current.delete(id)
  }, [])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.metaKey || event.ctrlKey) return
      if (event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      const key = KEYS.find(k => k.key.toLowerCase() === event.key.toLowerCase())
      if (!key) return
      event.preventDefault()
      press('key-' + key.key, (octave + 1) * 12 + key.offset)
    }
    const keyUp = (event: KeyboardEvent) => {
      const key = KEYS.find(k => k.key.toLowerCase() === event.key.toLowerCase())
      if (key) release('key-' + key.key)
    }
    const blur = () => {
      for (const id of Array.from(heldRef.current)) release(id)
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
    }
  }, [octave, press, release])

  useEffect(() => {
    if (!playing) { setPlayhead(-1); return }
    let index = 0
    let nextAt = audio.time + .07
    const stepTime = 60 / bpm / 4
    const tick = () => {
      const horizon = audio.time + .11
      while (nextAt < horizon) {
        const { steps: notes, preset: patch, duty: pulseDuty, activeWave: table, activeFm: fm } = latestRef.current
        const note = notes[index]
        if (note !== null) audio.trigger(note, patch, nextAt, stepTime * .74, pulseDuty, table, fm)
        const highlight = index
        window.setTimeout(() => setPlayhead(highlight), Math.max(0, (nextAt - audio.time) * 1000))
        nextAt += stepTime
        index = (index + 1) % notes.length
      }
    }
    tick()
    const timer = window.setInterval(tick, 25)
    return () => window.clearInterval(timer)
  }, [playing, bpm, audio])

  useEffect(() => () => {
    audio.stopAll()
    void audio.close()
  }, [audio])

  const togglePlayback = async () => {
    if (playing) { setPlaying(false); return }
    if (await wake()) setPlaying(true)
  }

  const toggleStep = (index: number) => {
    setSteps(before => before.map((note, i) =>
      i === index ? (note === selectedNote ? null : selectedNote) : note,
    ))
  }

  const savePatch = () => {
    const data = serializePattern({
      preset, duty, bpm, steps,
      ...(preset.wave === 'wavetable' ? { table: activeWave } : {}),
      ...(preset.wave === 'fm' && activeFm ? { fm: activeFm } : {}),
    })
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'chippydip-pattern.json')
  }

  const loadPatch = async (file: File | undefined) => {
    if (!file) return
    try {
      if (file.size > 150000) throw new Error('Oversized pattern')
      const result = parsePattern(JSON.parse(await file.text()))
      setSteps(result.steps)
      setPresetId(result.preset.id)
      setChip(result.preset.chip ?? 'nes')
      if (result.table) {
        setCustomWaveTables(previous => ({ ...previous, [result.preset.id]: result.table! }))
      }
      if (result.fm) {
        setCustomFmPatches(previous => ({ ...previous, [result.preset.id]: result.fm! }))
      }
      setDuty(result.duty)
      setBpm(result.bpm)
    } catch {
      window.alert('This does not look like a compatible ChippyDip pattern.')
    }
  }

  const renderWav = async () => {
    setExporting(true)
    try {
      const wav = await exportLoop(steps, preset, bpm, duty, activeWave, activeFm)
      download(wav, 'chippydip-' + preset.id + '-' + bpm + 'bpm.wav')
    } catch (error) {
      console.error('WAV rendering failed', error)
      window.alert('WAV export failed. Your browser may not support offline audio rendering.')
    } finally {
      setExporting(false)
    }
  }

  const scopeNode = useCallback(() => audio.analyser, [audio])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brandmark" aria-hidden="true"><span>✳</span></div>
        <div className="top-brand">CHIPPY<span>DIP</span><sup>®*</sup></div>
        <div className="top-spacer" />
        <span className="top-build">WEB LAB <b>v0.3</b></span>
        <a className="top-link" href={repoUrl} target="_blank" rel="noreferrer">GITHUB ↗</a>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow"><span className="led" /> INSERT COIN · MAKE NOISE · REPEAT</div>
            <h1>CHIPPY<span>DIP!</span></h1>
            <p>Old-school pixels. New-school possibilities. Your retro sound laboratory starts right here.</p>
            <div className="hero-tags"><span>★ ORIGINAL SYNTHESIS</span><span>♫ BROWSER PLAYABLE</span><span>↗ WAV EXPORT</span></div>
          </div>
          <div className="chip-art" aria-hidden="true">
            <div className="chip-shadow" />
            <div className="chip-body">
              <div className="chip-brow" />
              <div className="chip-face"><i /><i /></div>
              <div className="chip-mouth" />
              <div className="chip-text">8 BIT</div>
            </div>
            <div className="spark spark-a">✦</div>
            <div className="spark spark-b">+</div>
            <div className="spark spark-c">✦</div>
          </div>
        </section>

        <div className="section-heading"><span>01 / SOUND LAB</span><span className="status"><i className={status === 'ready' ? 'on' : ''} /> {status === 'idle' ? 'CLICK A KEY TO START AUDIO' : status === 'ready' ? 'AUDIO ENGINE ONLINE' : 'AUDIO BLOCKED'}</span></div>
        <section className="workbench">
          <aside className="preset-panel panel">
            <div className="panel-heading"><span>PATCH BAY</span><span>{chip === 'nes' ? 'NES CLASSICS' : chip === 'gameboy' ? 'POCKET WAVE LAB' : 'GENESIS FM LAB'}</span></div>
            <div className="chip-selector" role="group" aria-label="Select sound chip">
              <button className={chip === 'nes' ? 'selected' : ''} aria-pressed={chip === 'nes'} onClick={() => selectChip('nes')}>NES <small>01</small></button>
              <button className={chip === 'gameboy' ? 'selected' : ''} aria-pressed={chip === 'gameboy'} onClick={() => selectChip('gameboy')}>GAME BOY <small>02</small></button>
              <button className={chip === 'genesis' ? 'selected' : ''} aria-pressed={chip === 'genesis'} onClick={() => selectChip('genesis')}>GENESIS <small>03</small></button>
            </div>
            <div className="preset-list">
              {currentBank.map((p, i) => (
                <button className={'preset-row ' + (preset.id === p.id ? 'active' : '')}
                  style={{ '--patch': p.accent } as React.CSSProperties}
                  key={p.id} aria-pressed={preset.id === p.id} onClick={() => setPresetId(p.id)}>
                  <span className="preset-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="preset-title"><strong>{p.name}</strong><small>{p.caption}</small></span>
                  <span className="preset-arrow">↗</span>
                </button>
              ))}
            </div>
            <div className="panel-foot">{chip === 'nes' ? '5 ORIGINAL v0.1 PATCHES · PRESERVED' : chip === 'gameboy' ? '4 POCKET PATCHES · 32-STEP WAVE RAM' : '4 FM FACTORY PATCHES · 4 OPERATORS'}</div>
          </aside>

          <div className="main-panel panel">
            <div className="panel-heading"><span>CHIP SCOPE / {chip === 'nes' ? 'NES-INSPIRED' : chip === 'gameboy' ? 'GAME BOY-INSPIRED' : 'GENESIS-INSPIRED FM'}</span><span className="wave-tag">{preset.wave.toUpperCase()} CHANNEL</span></div>
            <div className="screen"><Oscilloscope analyser={scopeNode} /><span className="scope-corner top">CH 01 / LIVE</span><span className="scope-corner bottom">♪ {noteLabel(selectedNote)} · {Math.round(440 * Math.pow(2, (selectedNote - 69) / 12))} Hz</span></div>
            <div className="controls">
              <div className="control-group"><label htmlFor="volume">MASTER VOLUME <b>{volume}%</b></label><input id="volume" type="range" min="0" max="100" value={volume} onChange={event => { const v = Number(event.target.value); setVolume(v); audio.setVolume(v / 100) }} /></div>
              <div className="control-group duty-group"><span className="input-label">PULSE DUTY</span><div className="duty-options">{DUTIES.map(d => <button key={d} disabled={preset.wave !== 'pulse'} className={duty === d ? 'chosen' : ''} onClick={() => setDuty(d)} aria-pressed={duty === d}>{d * 100}%</button>)}</div></div>
            </div>
            {preset.wave === 'fm' && activeFm && (
              <div className="fm-editor">
                <div className="fm-header">
                  <div><strong>4-OPERATOR FM PATCH LAB</strong><small>ORIGINAL AUDIO-RATE FREQUENCY MODULATION</small></div>
                  <button onClick={() => {
                    if (preset.fm) setCustomFmPatches(prev => ({ ...prev, [preset.id]: cloneFmPatch(preset.fm!) }))
                  }}>RESET PATCH ↺</button>
                </div>
                <div className="fm-algorithms" role="group" aria-label="FM routing algorithm">
                  {FM_ALGORITHMS.map((route, index) => (
                    <button key={index} className={activeFm.algorithm === index ? 'selected' : ''} aria-pressed={activeFm.algorithm === index}
                      onClick={() => updateFm(fm => ({ ...fm, algorithm: index as FmPatch['algorithm'] }))}>
                      <b>ALG {index + 1}</b><small>{route.label}</small>
                    </button>
                  ))}
                </div>
                <label className="fm-index">MODULATION INDEX <strong>{activeFm.index.toFixed(1)}</strong>
                  <input type="range" min="0" max="12" step=".1" value={activeFm.index}
                    onChange={event => updateFm(fm => ({ ...fm, index: Number(event.target.value) }))}/>
                </label>
                <div className="fm-operators">
                  {activeFm.operators.map((operator, index) => (
                    <div className="fm-operator" key={index}>
                      <div className="fm-operator-head"><b>OP {index + 1}</b><span>SINE OSCILLATOR</span></div>
                      <div className="fm-operator-main">
                        <label>RATIO
                          <select aria-label={'Operator ' + (index + 1) + ' frequency ratio'} value={operator.ratio}
                            onChange={event => setFmOperator(index, 'ratio', Number(event.target.value))}>
                            {FM_RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}×</option>)}
                          </select>
                        </label>
                        <label>LEVEL <b>{Math.round(operator.level * 100)}%</b>
                          <input aria-label={'Operator ' + (index + 1) + ' level'} type="range" min="0" max="1" step=".01" value={operator.level}
                            onChange={event => setFmOperator(index, 'level', Number(event.target.value))}/>
                        </label>
                      </div>
                      <details className="fm-envelope">
                        <summary>ADSR ENVELOPE <span>A / D / S / R</span></summary>
                        {(['attack', 'decay', 'sustain', 'release'] as const).map(parameter => (
                          <label key={parameter}>{parameter.toUpperCase()} <b>{operator[parameter].toFixed(parameter === 'sustain' ? 2 : 3)}</b>
                            <input aria-label={'Operator ' + (index + 1) + ' ' + parameter} type="range"
                              min={parameter === 'attack' ? '.001' : parameter === 'decay' ? '.005' : parameter === 'release' ? '.01' : '0'}
                              max={parameter === 'attack' ? '2' : parameter === 'decay' ? '3' : parameter === 'release' ? '4' : '1'}
                              step={parameter === 'sustain' ? '.01' : '.005'}
                              value={operator[parameter]}
                              onChange={event => setFmOperator(index, parameter, Number(event.target.value))}/>
                          </label>
                        ))}
                      </details>
                    </div>
                  ))}
                </div>
                <p>Operators modulate each other at audio rate. Change the routing, ratios, levels and envelopes; play or export the result.</p>
              </div>
            )}
            {preset.wave === 'wavetable' && (
              <div className="wave-editor">
                <div className="wave-editor-title">
                  <div><strong>32-STEP WAVE RAM</strong><small>4-BIT LEVELS · TAP EACH COLUMN TO DRAW</small></div>
                  <button onClick={() => setCustomWaveTables(prev => ({ ...prev, [preset.id]: [...(preset.table ?? GB_WAVES.round)] }))}>RESET WAVE ↺</button>
                </div>
                <div className="wave-bars" role="group" aria-label="Editable 32-column Game Boy-style wavetable">
                  {activeWave.map((value, i) => (
                    <button key={i} type="button" className="wave-bar"
                      aria-label={'Wave column ' + (i + 1) + ', level ' + value + ' of 15'}
                      title={'Step ' + (i + 1) + ': ' + value + ' / 15'}
                      onPointerDown={event => {
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        editWaveValue(i, 15 - Math.floor((event.clientY - rect.top) / rect.height * 16))
                      }}
                      onKeyDown={event => {
                        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                          event.preventDefault()
                          editWaveValue(i, value + (event.key === 'ArrowUp' ? 1 : -1))
                        }
                      }}>
                      <span className="wave-fill" style={{ height: ((value + 1) / 16 * 100) + '%' }} />
                    </button>
                  ))}
                </div>
                <p>Shape a sound, play the Dipboard, then save JSON or export WAV. Each pocket patch keeps its own edited waveform.</p>
              </div>
            )}
          </div>
        </section>

        <div className="section-heading"><span>02 / PIXEL SEQUENCER</span><span>16 STEPS · ONE BAR · YOUR RULES</span></div>
        <section className="sequencer panel">
          <div className="sequencer-toolbar">
            <button className={'play-button ' + (playing ? 'playing' : '')} onClick={() => void togglePlayback()}>{playing ? '■ STOP' : '▶ PLAY'}</button>
            <label className="bpm">TEMPO <input aria-label="Tempo BPM" type="number" min="60" max="200" value={bpm} onChange={event => setBpm(Math.max(60, Math.min(200, Number(event.target.value) || 60)))} /> BPM</label>
            <div className="toolbar-spacer" />
            <button className="tool-button" onClick={() => setSteps(Array(16).fill(null))}>CLEAR</button>
            <button className="tool-button" onClick={() => setSteps([...DEFAULT_STEPS])}>RESET</button>
            <button className="tool-button" onClick={savePatch}>SAVE JSON ↓</button>
            <label className="tool-button file-label">LOAD JSON ↑<input type="file" accept=".json,application/json" onChange={event => { void loadPatch(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>
          </div>
          <div className="step-grid">
            {steps.map((note, i) => <button key={i} className={'step ' + (note === null ? 'empty ' : 'filled ') + (playhead === i ? 'current' : '')}
              onClick={() => toggleStep(i)} aria-label={'Step ' + (i + 1) + ': ' + (note === null ? 'rest' : noteLabel(note))} title="Click to place or remove the selected note">
              <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
              <span className="step-note">{note === null ? '·' : noteLabel(note)}</span>
            </button>)}
          </div>
          <div className="sequencer-bottom"><span>TIP: SELECT A NOTE ON THE KEYBOARD, THEN TAP STEPS TO PAINT IT.</span><button className="export-button" onClick={() => void renderWav()} disabled={exporting}>{exporting ? 'RENDERING…' : '↓ EXPORT WAV'}</button></div>
        </section>

        <div className="section-heading"><span>03 / PLAY IT LIVE</span><span>KEYBOARD FRIENDLY · TOUCH FRIENDLY</span></div>
        <section className="keyboard-panel panel">
          <div className="keyboard-top"><div><b>THE DIPBOARD</b><small>CLICK, TAP OR USE YOUR COMPUTER KEYBOARD</small></div><div className="octave"><span>OCTAVE</span><button aria-label="Lower octave" disabled={octave <= 2} onClick={() => setOctave(v => Math.max(2, v - 1))}>−</button><b>{octave}</b><button aria-label="Raise octave" disabled={octave >= 6} onClick={() => setOctave(v => Math.min(6, v + 1))}>+</button></div></div>
          <div className="keyboard">
            {KEYS.map(({ offset, key }) => {
              const note = (octave + 1) * 12 + offset
              const id = 'pad-' + offset
              return <button key={offset} className={'piano-key ' + (BLACK.has(offset) ? 'black' : 'white') + (selectedNote === note ? 'selected' : '')}
                aria-label={'Play ' + noteLabel(note)}
                onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); press(id, note) }}
                onPointerUp={() => release(id)} onPointerCancel={() => release(id)} onLostPointerCapture={() => release(id)}>
                <span className="key-name">{noteLabel(note)}</span><span className="key-shortcut">{key}</span>
              </button>
            })}
          </div>
        </section>

        <section className="future-section">
          <div><span className="eyebrow">THREE CHIP BANKS · MORE TO GO</span><h2>THE DIP KEEPS GETTING DEEPER.</h2><p>NES classics, Game Boy waveforms and four-operator Genesis-inspired FM sounds are now playable. Next up: SNES sample synthesis, Double Dip multi-chip layering, native standalone and VST3 builds.</p></div>
          <div className="future-chips"><span>GAME BOY <small>NOW PLAYABLE</small></span><span>GENESIS <small>NOW PLAYABLE</small></span><span>SNES <small>PLANNED</small></span><span>VST3 <small>PLANNED</small></span></div>
        </section>
      </main>
      <footer><span>© 2026 CHIPPYDIP · AN ORIGINAL OPEN-SOURCE SOUND LAB</span><span>BUILT FOR THE BROS WHO LOVE THE BLEEP-BLOOPS.</span></footer>
      <div className="disclaimer">* The decorative ®* label is retro UI styling, not a claim of trademark registration. Hardware names refer to sound inspiration, not affiliation.</div>
    </div>
  )
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
