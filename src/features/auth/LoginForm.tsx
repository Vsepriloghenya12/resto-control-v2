import { FormEvent, useState } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { Button } from '../../shared/ui/Button'
import { Input } from '../../shared/ui/Input'
import { EyeIcon, LockIcon, MailIcon } from '../../shared/ui/Icon'

type ResetStep = 'email' | 'code' | 'password' | 'done'

function ForgotPasswordFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<ResetStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSendCode(e: FormEvent) {
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Ошибка при отправке.')
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (code.trim().length !== 6) { setError('Введите 6-значный код из письма.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Неверный код.')
      setStep('password')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) { setError('Пароль должен быть не менее 6 символов.'); return }
    if (newPassword !== confirmPassword) { setError('Пароли не совпадают.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), password: newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Ошибка при сбросе.')
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сбросе.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="auth-form">
        <p className="auth-message auth-message--success">Пароль успешно изменён. Войдите с новым паролем.</p>
        <Button type="button" fullWidth onClick={onBack}>Войти</Button>
      </div>
    )
  }

  if (step === 'password') {
    return (
      <form className="auth-form" onSubmit={handleResetPassword}>
        <p className="auth-forgot-hint">Придумайте новый пароль.</p>
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

  if (step === 'code') {
    return (
      <form className="auth-form" onSubmit={handleVerifyCode}>
        <p className="auth-forgot-hint">
          Код отправлен на <strong>{email}</strong>. Проверьте папку «Входящие» или «Спам».
        </p>
        <div className="auth-code-input-wrap">
          <input
            className="auth-code-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="_ _ _ _ _ _"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
          />
        </div>
        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        <Button type="submit" fullWidth disabled={loading || code.length !== 6}>
          {loading ? 'Проверка...' : 'Подтвердить код'}
        </Button>
        <button type="button" className="auth-forgot-link" onClick={() => { setStep('email'); setCode(''); setError(null) }}>
          Изменить email
        </button>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSendCode}>
      <p className="auth-forgot-hint">
        Введите email, указанный при регистрации. Мы отправим 6-значный код.
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
      <Button type="submit" fullWidth disabled={loading}>{loading ? 'Отправка...' : 'Получить код'}</Button>
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
  const [showForgot, setShowForgot] = useState(false)

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

  if (showForgot) {
    return <ForgotPasswordFlow onBack={() => setShowForgot(false)} />
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
        <button type="button" className="auth-forgot-link" onClick={() => setShowForgot(true)}>
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
