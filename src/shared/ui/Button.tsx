import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'ghost'
  fullWidth?: boolean
}

export function Button({ children, variant = 'primary', fullWidth = false, className = '', ...props }: ButtonProps) {
  const classes = ['rc-button', `rc-button--${variant}`, fullWidth ? 'rc-button--full' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
