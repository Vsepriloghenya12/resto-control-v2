import { FormEvent, useState } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { Button } from '../../shared/ui/Button'
import { Input } from '../../shared/ui/Input'
import { EyeIcon, LockIcon, MailIcon } from '../../shared/ui/Icon'

export function LoginForm() {
  const { login } = useSession()
  const [form, setForm] = useState({ login: '', password: '', remember: true })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!form.login.trim() || !form.password.trim()) {
      setError('Введите телефон или email и пароль.')
      return
    }

    try {
      await login(form)
      setMessage('Вход выполнен.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти.')
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <Input
        id="login"
        label="Телефон или email"
        icon={<MailIcon />}
        placeholder="Введите телефон или email"
        autoComplete="username"
        value={form.login}
        onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
      />

      <Input
        id="password"
        label="Пароль"
        type="password"
        icon={<LockIcon />}
        rightSlot={<EyeIcon />}
        placeholder="Введите пароль"
        autoComplete="current-password"
        value={form.password}
        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
      />

      <div className="auth-form__meta">
        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(event) => setForm((current) => ({ ...current, remember: event.target.checked }))}
          />
          <span>Запомнить меня</span>
        </label>

        <button className="auth-link" type="button">
          Забыли пароль?
        </button>
      </div>

      {error ? <p className="auth-message auth-message--error">{error}</p> : null}
      {message ? <p className="auth-message auth-message--success">{message}</p> : null}

      <Button type="submit" fullWidth>
        Войти
      </Button>
    </form>
  )
}
