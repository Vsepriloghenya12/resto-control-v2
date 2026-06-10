import { FormEvent, useState } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { Button } from '../../shared/ui/Button'
import { Input } from '../../shared/ui/Input'
import { LockIcon, MailIcon, UserIcon } from '../../shared/ui/Icon'

export function RegisterRestaurantForm() {
  const { registerRestaurant } = useSession()
  const [form, setForm] = useState({ restaurantName: '', ownerName: '', login: '', password: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!form.restaurantName.trim() || !form.ownerName.trim() || !form.login.trim() || !form.password.trim()) {
      setError('Заполните все поля для создания ресторана.')
      return
    }

    if (form.password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.')
      return
    }

    await registerRestaurant(form)
    setMessage('Ресторан создан. Можно продолжать работу.')
  }

  return (
    <form className="auth-form auth-form--register" onSubmit={onSubmit}>
      <Input
        id="restaurantName"
        label="Название ресторана"
        icon={<UserIcon />}
        placeholder="Например, Север"
        autoComplete="organization"
        value={form.restaurantName}
        onChange={(event) => setForm((current) => ({ ...current, restaurantName: event.target.value }))}
      />

      <Input
        id="ownerName"
        label="Имя владельца / управляющего"
        icon={<UserIcon />}
        placeholder="Введите имя"
        autoComplete="name"
        value={form.ownerName}
        onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
      />

      <Input
        id="registerLogin"
        label="Телефон или email"
        icon={<MailIcon />}
        placeholder="Введите телефон или email"
        autoComplete="username"
        value={form.login}
        onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
      />

      <Input
        id="registerPassword"
        label="Пароль"
        type="password"
        icon={<LockIcon />}
        placeholder="Минимум 6 символов"
        autoComplete="new-password"
        value={form.password}
        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
      />

      <div className="auth-trial-note">
        <strong>Пробный период 14 дней</strong>
        <span>После создания ресторана доступ включится автоматически. Счёт можно будет оформить позже во вкладке «Оплата».</span>
      </div>

      {error ? <p className="auth-message auth-message--error">{error}</p> : null}
      {message ? <p className="auth-message auth-message--success">{message}</p> : null}

      <Button type="submit" fullWidth>
        Создать ресторан
      </Button>
    </form>
  )
}
