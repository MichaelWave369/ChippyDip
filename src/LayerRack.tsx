import type { ChipFamily } from './audio'
import { PRESETS } from './audio'
import type { SoundLayer } from './layers'
import { activeLayers } from './layers'

interface LayerRackProps {
  layers: SoundLayer[]
  onChange: (layers: SoundLayer[]) => void
  onEdit: (chip: ChipFamily, presetId: string) => void
}

const LABEL: Record<ChipFamily, string> = {
  nes: 'NES PULSE & NOISE',
  gameboy: 'GAME BOY WAVES',
  genesis: 'GENESIS FM',
  snes: 'SNES SAMPLE',
}
const COLORS: Record<ChipFamily, string> = {
  nes: '#c6f977', gameboy: '#91d8b1', genesis: '#f4a5ca', snes: '#b6b1ff',
}

export default function LayerRack({ layers, onChange, onEdit }: LayerRackProps) {
  const active = activeLayers(layers).length
  const update = (chip: ChipFamily, fields: Partial<SoundLayer>) =>
    onChange(layers.map(layer => layer.chip === chip
      ? {
          ...layer,
          ...fields,
          // An instrument switch always clears any edits specific to the
          // previous patch. The App tracks custom settings by preset ID.
          ...(fields.presetId ? { table: undefined, fm: undefined, sample: undefined } : {}),
        }
      : layer))

  return (
    <section className="double-rack panel" aria-label="Double Dip cross-chip layering">
      <div className="double-header">
        <div>
          <div className="double-eyebrow">THE DOUBLE DIP ENGINE</div>
          <h2>FOUR CHIPS. ONE KEYBOARD.</h2>
          <p>Each active layer plays the same note through its own original sound engine. Make your own cross-console instrument.</p>
        </div>
        <span className="double-count">{active} / 4 LAYERS ACTIVE</span>
      </div>
      <div className="double-grid">
        {layers.map((layer, index) => (
          <article className={'double-lane ' + (!layer.enabled ? 'off' : '')}
            key={layer.chip} style={{ '--lane': COLORS[layer.chip] } as React.CSSProperties}>
            <div className="lane-heading">
              <span className="lane-nr">0{index + 1}</span>
              <strong>{LABEL[layer.chip]}</strong>
              <label className="lane-toggle" title={layer.enabled ? 'Mute layer' : 'Enable layer'}>
                <input type="checkbox" checked={layer.enabled}
                  aria-label={'Enable ' + LABEL[layer.chip]}
                  onChange={event => update(layer.chip, { enabled: event.target.checked })}/>
                <span>{layer.enabled ? 'ON' : 'OFF'}</span>
              </label>
            </div>
            <label className="lane-label">PATCH
              <select value={layer.presetId}
                aria-label={LABEL[layer.chip] + ' instrument'}
                onChange={event => update(layer.chip, { presetId: event.target.value })}>
                {PRESETS.filter(p => (p.chip ?? 'nes') === layer.chip).map(p =>
                  <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="lane-level">
              <label htmlFor={'lane-gain-' + layer.chip}>LEVEL <b>{Math.round(layer.gain * 100)}%</b></label>
              <input id={'lane-gain-' + layer.chip} type="range" min="0" max="1" step=".01" value={layer.gain}
                onChange={event => update(layer.chip, { gain: Number(event.target.value) })}/>
            </div>
            <div className="lane-footer">
              <label>TRANSPOSE
                <select value={layer.transpose} aria-label={LABEL[layer.chip] + ' transpose'}
                  onChange={event => update(layer.chip, { transpose: Number(event.target.value) })}>
                  {[-24, -12, -7, -5, 0, 5, 7, 12, 24].map(n => (
                    <option value={n} key={n}>{n > 0 ? '+' : ''}{n} st</option>
                  ))}
                </select>
              </label>
              <button type="button" title="Open this layer's patch editor in the Sound Lab"
                onClick={() => onEdit(layer.chip, layer.presetId)}>EDIT PATCH ↗</button>
            </div>
          </article>
        ))}
      </div>
      <p className="double-note">Levels are normalized across enabled chips before reaching the master limiter. Edited Game Boy, FM and SNES patch settings follow their selected preset. Imported audio stays local to your browser session.</p>
    </section>
  )
}
