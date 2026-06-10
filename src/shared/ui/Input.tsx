import type { InputHTMLAttributes, ReactNode } from 'react'
import './ui.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon?: ReactNode
  rightSlot?: ReactNode
}

export function Input({ label, icon, rightSlot, id, className = '', ...props }: InputProps) {
  return (
    <label className="rc-field" htmlFor={id}>
      <span className="rc-field__label">{label}</span>
      <span className="rc-input-wrap">
        {icon ? <span className="rc-input-wrap__icon">{icon}</span> : null}
        <input id={id} className={`rc-input ${className}`} {...props} />
        {rightSlot ? <span className="rc-input-wrap__right">{rightSlot}</span> : null}
      </span>
    </label>
  )
}
