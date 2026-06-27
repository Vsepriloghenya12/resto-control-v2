import { useState } from 'react'
import './pricing-slider-loops.css'

export type PricingTier = {
  id: string
  title: string
  employees: string
  price: string
  period?: string
  note: string
  featured?: boolean
}

interface LoopsPricingSliderProps {
  tariffs: PricingTier[]
  selectedId?: string
  onSelect?: (tariff: PricingTier) => void
}

export function LoopsPricingSlider({ tariffs, selectedId, onSelect }: LoopsPricingSliderProps) {
  const selectedIdx = Math.max(0, tariffs.findIndex(t => t.id === selectedId))
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const displayIdx = hoverIdx ?? selectedIdx
  const tier = tariffs[displayIdx]
  const isEnterprise = tier.price === 'Индивидуально'

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const idx = Number(e.target.value)
    onSelect?.(tariffs[idx])
  }

  return (
    <div className="lps">
      <div className="lps__display">
        <div className="lps__tier-info">
          <div className="lps__tier-header">
            <span className="lps__tier-name">{tier.title}</span>
            {tier.featured && <span className="lps__badge lps__badge--popular">★ Популярный</span>}
            {tier.id === selectedId && !tier.featured && <span className="lps__badge lps__badge--current">✓ Текущий</span>}
          </div>
          <p className="lps__tier-staff">{tier.employees}</p>
          <p className="lps__tier-note">{tier.note}</p>
        </div>
        <div className="lps__price-block">
          {isEnterprise ? (
            <span className="lps__price-main">Индивидуально</span>
          ) : (
            <>
              <span className="lps__price-main">{tier.price}</span>
              {tier.period && <span className="lps__price-period">{tier.period}</span>}
            </>
          )}
          <button
            className="lps__select-btn"
            type="button"
            onClick={() => onSelect?.(tier)}
            disabled={tier.id === selectedId}
          >
            {tier.id === selectedId ? '✓ Текущий тариф' : 'Выбрать тариф'}
          </button>
        </div>
      </div>

      <div className="lps__slider-wrap">
        <input
          className="lps__range"
          type="range"
          min={0}
          max={tariffs.length - 1}
          step={1}
          value={selectedIdx}
          onChange={handleChange}
          onMouseMove={e => {
            const input = e.currentTarget
            const rect = input.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            setHoverIdx(Math.round(ratio * (tariffs.length - 1)))
          }}
          onMouseLeave={() => setHoverIdx(null)}
          aria-label="Выбор тарифа"
        />
        <div className="lps__ticks">
          {tariffs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={['lps__tick', i === selectedIdx && 'lps__tick--active', i === hoverIdx && 'lps__tick--hover'].filter(Boolean).join(' ')}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => onSelect?.(t)}
            >
              <span className="lps__tick-label">{t.employees.replace('до ', '').replace(' сотрудников', ' чел.').replace('+ сотрудников', '+')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
