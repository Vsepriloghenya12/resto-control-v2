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
  const [sliderIdx, setSliderIdx] = useState(selectedIdx)

  const tier = tariffs[sliderIdx]
  const isEnterprise = tier.price === 'Индивидуально'
  const isCurrent = tier.id === selectedId

  const fillPct = (sliderIdx / (tariffs.length - 1)) * 100

  return (
    <div className="lps">
      <div className="lps__left">
        <p className="lps__left-label">Выберите размер команды</p>
        <p className="lps__left-count">{tier.employees}</p>

        <div className="lps__slider-wrap">
          <input
            className="lps__range"
            type="range"
            min={0}
            max={tariffs.length - 1}
            step={1}
            value={sliderIdx}
            onChange={e => setSliderIdx(Number(e.target.value))}
            style={{ '--lps-fill': `${fillPct}%` } as React.CSSProperties}
            aria-label="Выбор тарифа"
          />
        </div>

        {tier.id === tariffs[tariffs.length - 1].id && (
          <p className="lps__left-custom">
            Нужно больше?{' '}
            <button type="button" className="lps__contact-link" onClick={() => onSelect?.(tariffs[tariffs.length - 1])}>
              Свяжитесь с нами →
            </button>
          </p>
        )}
      </div>

      <div className="lps__right">
        <p className="lps__right-label">Ваш тариф</p>
        {isEnterprise ? (
          <p className="lps__right-price">Индивидуально</p>
        ) : (
          <p className="lps__right-price">
            {tier.price}
            {tier.period && <span className="lps__right-period">{tier.period}</span>}
          </p>
        )}
        <p className="lps__right-note">{tier.note}</p>
        <button
          className="lps__select-btn"
          type="button"
          onClick={() => onSelect?.(tier)}
        >
          {isCurrent ? '✓ Текущий тариф' : 'Выбрать тариф'}
        </button>
      </div>
    </div>
  )
}
