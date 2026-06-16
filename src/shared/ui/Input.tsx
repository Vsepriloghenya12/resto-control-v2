import type { InputHTMLAttributes, ReactNode } from 'react'
import './ui.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon?: ReactNode
  rightSlot?: ReactNode
  onRightSlotClick?: () => void
}

export function Input({ label, icon, rightSlot, onRightSlotClick, id, className = '', ...props }: InputProps) {
  return (
    <label className="rc-field" htmlFor={id}>
      <span className="rc-field__label">{label}</span>
      <span className="rc-input-wrap">
        {icon ? <span className="rc-input-wrap__icon">{icon}</span> : null}
        <input id={id} className={`rc-input ${className}`} {...props} />
        {rightSlot ? (
          onRightSlotClick
            ? <button type="button" className="rc-input-wrap__right rc-input-wrap__right--btn" onClick={onRightSlotClick} tabIndex={-1} aria-label="Показать/скрыть пароль">{rightSlot}</button>
            : <span className="rc-input-wrap__right">{rightSlot}</span>
        ) : null}
      </span>
    </label>
  )
}
