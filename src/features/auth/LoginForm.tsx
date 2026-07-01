import { FormEvent, useState } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { Button } from '../../shared/ui/Button'
import { Input } from '../../shared/ui/Input'
import { EyeIcon, LockIcon, MailIcon } from '../../shared/ui/Icon'

type LoginView = 'login' | 'forgot' | 'forgot-sent' | 'reset' | 'reset-done'

function ForgotPasswordForm({ onBack, initialToken }: { onBack: () => void; initialToken?: string }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(initialToken || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [view, setView] = useState<'forgot' | 'forgot-sent' | 'reset' | 'reset-done'>(initialToken ? 'reset' : 'forgot')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleForgot(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) { setError('Введите email.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка при отправке.')
      }
      setView('forgot-sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) { setError('Пароль должен быть не менее 6 символов.'); return }
    if (newPassword !== confirmPassword) { setError('Пароли не совпадают.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Ошибка при сбросе.')
      setView('reset-done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сбросе.')
    } finally {
      setLoading(false)
    }
  }

  if (view === 'forgot-sent') {
    return (
      <div className="auth-form">
        <div className="auth-message auth-message--success">
          Если аккаунт с таким email существует, письмо со ссылкой для сброса пароля было отправлено. Проверьте почту.
        </div>
        <Button type="button" fullWidth onClick={onBack}>Вернуться к входу</Button>
      </div>
    )
  }

  if (view === 'reset-done') {
    return (
      <div className="auth-form">
        <div className="auth-message auth-message--success">
          Пароль успешно изменён. Войдите с новым паролем.
        </div>
        <Button type="button" fullWidth onClick={onBack}>Войти</Button>
      </div>
    )
  }

  if (view === 'reset') {
    return (
      <form className="auth-form" onSubmit={handleReset}>
        <p style={{ marginBottom: 8, color: 'var(--rc-text-secondary, #888)', fontSize: 14 }}>
          Введите новый пароль.
        </p>
        <Input
          id="new-password"
          label="Новый пароль"
          type="password"
          icon={<LockIcon />}
          placeholder="Не менее 6 символов"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          id="confirm-password"
          label="Повторите пароль"
          type="password"
          icon={<LockIcon />}
          placeholder="Повторите пароль"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        <Button type="submit" fullWidth disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить пароль'}</Button>
        <button type="button" className="auth-forgot-link" onClick={onBack}>Вернуться к входу</button>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleForgot}>
      <p style={{ marginBottom: 8, color: 'var(--rc-text-secondary, #888)', fontSize: 14 }}>
        Введите email, указанный при регистрации. Мы отправим ссылку для сброса пароля.
      </p>
      <Input
        id="forgot-email"
        label="Email"
        icon={<MailIcon />}
        placeholder="Введите email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error ? <p className="auth-message auth-message--error">{error}</p> : null}
      <Button type="submit" fullWidth disabled={loading}>{loading ? 'Отправка...' : 'Отправить ссылку'}</Button>
      <button type="button" className="auth-forgot-link" onClick={onBack}>Вернуться к входу</button>
    </form>
  )
}

export function LoginForm() {
  const { login } = useSession()
  const [form, setForm] = useState({ login: '', password: '', remember: true })
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const urlToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null
  const [view, setView] = useState<LoginView>(() => urlToken ? 'reset' : 'login')

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

  if (view === 'forgot' || view === 'forgot-sent' || view === 'reset' || view === 'reset-done') {
    return (
      <ForgotPasswordForm
        onBack={() => {
          setView('login')
          if (urlToken && window.history) {
            window.history.replaceState({}, '', window.location.pathname)
          }
        }}
        initialToken={view === 'reset' ? (urlToken || undefined) : undefined}
      />
    )
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
        type={showPassword ? 'text' : 'password'}
        icon={<LockIcon />}
        rightSlot={<EyeIcon />}
        onRightSlotClick={() => setShowPassword((v) => !v)}
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
        <button type="button" className="auth-forgot-link" onClick={() => setView('forgot')}>
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
