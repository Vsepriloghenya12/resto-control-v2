import React, { useEffect, useRef, useState } from 'react'

function IikoLogo() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#e8390e" />
      <text x="24" y="32" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900"
        fontSize="22" fill="#fff" letterSpacing="-1">iiko</text>
    </svg>
  )
}

function QuickRestoLogo() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {/* Blue rounded square (back) */}
      <rect x="14" y="14" width="34" height="34" rx="9" fill="#3b35d4" />
      {/* Red circle (front-left) */}
      <circle cx="18" cy="22" r="18" fill="#ff1f3d" />
      {/* White diagonal stroke */}
      <rect x="20" y="12" width="6" height="26" rx="3" fill="#fff"
        transform="rotate(38 23 25)" />
    </svg>
  )
}

type System = 'iiko' | 'quickresto'

type Connection = {
  host: string
  login: string
  password: string
}

const SYSTEMS: Array<{ key: System; name: string; color: string; tagline: string; logo: React.ReactNode }> = [
  {
    key: 'quickresto',
    name: 'Quick Resto',
    color: '#3b35d4',
    tagline: 'Quick Resto POS',
    logo: <QuickRestoLogo />,
  },
  {
    key: 'iiko',
    name: 'iiko',
    color: '#e8390e',
    tagline: 'iiko Office / iikoChain',
    logo: <IikoLogo />,
  },
]

export function IntegrationPage() {
  const [active, setActive] = useState<System>('quickresto')
  const [connections, setConnections] = useState<Record<System, Connection>>({
    iiko: { host: '', login: '', password: '' },
    quickresto: { host: '', login: '', password: '' },
  })
  const [status, setStatus] = useState<Record<System, 'idle' | 'testing' | 'ok' | 'error'>>({
    iiko: 'idle',
    quickresto: 'idle',
  })
  const [errorMsg, setErrorMsg] = useState<Record<System, string>>({ iiko: '', quickresto: '' })
  const [saving, setSaving] = useState<Record<System, boolean>>({ iiko: false, quickresto: false })
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showNotice(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 3000)
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const resp = await fetch('/api/restaurant', { credentials: 'include' })
      if (!resp.ok) return
      const r = await resp.json()
      setConnections({
        iiko: {
          host: r.iikoHost || '',
          login: r.iikoLogin || '',
          password: r.iikoPassword || '',
        },
        quickresto: {
          host: r.qrHost || '',
          login: r.qrLogin || '',
          password: r.qrPassword || '',
        },
      })
      if (r.iikoHost) setStatus((s) => ({ ...s, iiko: 'ok' }))
      if (r.qrHost) setStatus((s) => ({ ...s, quickresto: 'ok' }))
    } catch { /* ignore */ }
  }

  function setField(sys: System, field: keyof Connection, value: string) {
    setConnections((c) => ({ ...c, [sys]: { ...c[sys], [field]: value } }))
    if (status[sys] !== 'idle') setStatus((s) => ({ ...s, [sys]: 'idle' }))
    setErrorMsg((e) => ({ ...e, [sys]: '' }))
  }

  async function save(sys: System) {
    setSaving((s) => ({ ...s, [sys]: true }))
    const c = connections[sys]
    const patch = sys === 'iiko'
      ? { iikoHost: c.host.trim(), iikoLogin: c.login.trim(), iikoPassword: c.password }
      : { qrHost: c.host.trim(), qrLogin: c.login.trim(), qrPassword: c.password }
    try {
      const resp = await fetch('/api/restaurant', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!resp.ok) throw new Error('Ошибка сохранения')
      showNotice('Настройки сохранены.')
    } catch (e) {
      showNotice(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving((s) => ({ ...s, [sys]: false }))
    }
  }

  async function testConnection(sys: System) {
    setStatus((s) => ({ ...s, [sys]: 'testing' }))
    setErrorMsg((e) => ({ ...e, [sys]: '' }))
    const c = connections[sys]
    try {
      await save(sys)
      const endpoint = sys === 'iiko' ? '/api/iiko/test' : '/api/quickresto/test'
      const resp = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: c.host.trim(), login: c.login.trim(), password: c.password }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Ошибка подключения')
      setStatus((s) => ({ ...s, [sys]: 'ok' }))
    } catch (e) {
      setStatus((s) => ({ ...s, [sys]: 'error' }))
      setErrorMsg((er) => ({ ...er, [sys]: e instanceof Error ? e.message : 'Ошибка подключения' }))
    }
  }

  const sys = SYSTEMS.find((s) => s.key === active)!
  const conn = connections[active]
  const st = status[active]
  const err = errorMsg[active]
  const isSaving = saving[active]

  const isConnected = st === 'ok'
  const isTesting = st === 'testing'

  const hostPlaceholder = active === 'iiko' ? 'myrest.iiko.it или 192.168.1.1:443' : 'myrest.quickresto.ru'
  const loginPlaceholder = active === 'iiko' ? 'admin' : 'owner@myrest.ru'

  return (
    <div className="int-page">
      {notice && <div className="int-notice">{notice}</div>}

      <div className="int-shell">
        {/* Левая панель */}
        <div className="int-brand">
          <div className="int-brand__content">
            <div className="int-brand__header">
              <div className="int-brand__icon">
                <IntegrationBrandIcon />
              </div>
              <div>
                <div className="int-brand__logo">Интеграции</div>
                <p>Подключение к кассовым системам</p>
              </div>
            </div>

            <div className="int-brand__accent" />

            <h2>Синхронизируйте данные автоматически</h2>

            <ul className="int-brand__features">
              <li>
                <span className="int-brand__feat-icon"><SyncIcon /></span>
                <div>
                  <strong>Номенклатура</strong>
                  <span>Импорт блюд и товаров из кассы одним нажатием</span>
                </div>
              </li>
              <li>
                <span className="int-brand__feat-icon"><ShieldIcon /></span>
                <div>
                  <strong>Аттестация по меню</strong>
                  <span>Вопросы генерируются из актуальной номенклатуры</span>
                </div>
              </li>
              <li>
                <span className="int-brand__feat-icon"><ClockIcon /></span>
                <div>
                  <strong>Всегда актуально</strong>
                  <span>Обновление в любой момент без ручного ввода</span>
                </div>
              </li>
            </ul>

            <p className="int-brand__footnote">Данные передаются напрямую через ваш сервер — без посредников.</p>
          </div>
        </div>

        {/* Правая панель */}
        <div className="int-panel">
          <div className="int-card">
            {/* Табы систем */}
            <div className="int-tabs">
              {SYSTEMS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`int-tab${active === s.key ? ' int-tab--active' : ''}`}
                  style={active === s.key ? { '--tab-color': s.color } as React.CSSProperties : undefined}
                  onClick={() => setActive(s.key)}
                >
                  <span className="int-tab__logo">{s.logo}</span>
                  <span className="int-tab__name">{s.name}</span>
                  {status[s.key] === 'ok' && <span className="int-tab__dot" />}
                </button>
              ))}
            </div>

            {/* Карточка системы */}
            <div className="int-system-header">
              <div className="int-system-logo">
                {sys.logo}
              </div>
              <div>
                <strong>{sys.name}</strong>
                <span>{sys.tagline}</span>
              </div>
              <div className={`int-status-badge int-status-badge--${isConnected ? 'ok' : st === 'error' ? 'error' : 'idle'}`}>
                {isConnected ? '● Подключено' : st === 'error' ? '● Ошибка' : '○ Не настроено'}
              </div>
            </div>

            <div className="int-divider" />

            {/* Поля */}
            <div className="int-form">
              <div className="int-field">
                <label className="int-field__label">Хост</label>
                <div className="int-field__wrap">
                  <ServerIcon className="int-field__icon" />
                  <input
                    className="int-input"
                    type="text"
                    placeholder={hostPlaceholder}
                    value={conn.host}
                    onChange={(e) => setField(active, 'host', e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="int-field">
                <label className="int-field__label">Логин</label>
                <div className="int-field__wrap">
                  <UserIcon className="int-field__icon" />
                  <input
                    className="int-input"
                    type="text"
                    placeholder={loginPlaceholder}
                    value={conn.login}
                    onChange={(e) => setField(active, 'login', e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="int-field">
                <label className="int-field__label">Пароль</label>
                <div className="int-field__wrap">
                  <LockIcon className="int-field__icon" />
                  <PasswordInput
                    value={conn.password}
                    onChange={(v) => setField(active, 'password', v)}
                  />
                </div>
              </div>

              {err && (
                <div className="int-error">
                  <span>⚠</span> {err}
                </div>
              )}

              <div className="int-actions">
                <button
                  type="button"
                  className="int-btn int-btn--secondary"
                  disabled={isTesting || isSaving || !conn.host || !conn.login || !conn.password}
                  onClick={() => void testConnection(active)}
                >
                  {isTesting ? 'Проверяю...' : 'Проверить соединение'}
                </button>
                <button
                  type="button"
                  className="int-btn int-btn--primary"
                  disabled={isSaving || !conn.host || !conn.login || !conn.password}
                  onClick={() => void save(active)}
                >
                  {isSaving ? 'Сохраняю...' : 'Сохранить'}
                </button>
              </div>
            </div>

            {isConnected && (
              <div className="int-connected-note">
                <span className="int-connected-note__dot" />
                Подключение активно. Номенклатуру можно синхронизировать в разделе <strong>Номенклатура → ↓ iiko</strong>.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Password input with show/hide ────────────────────────────────────────────

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <input
        className="int-input"
        type={show ? 'text' : 'password'}
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="current-password"
      />
      <button type="button" className="int-field__eye" onClick={() => setShow((s) => !s)} tabIndex={-1}>
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IntegrationBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17.5 14v7M14 17.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 6.5h4M17.5 10v4M10 17.5H6.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12A7.5 7.5 0 0 1 17 6.5l2.5 2.5M19.5 12A7.5 7.5 0 0 1 7 17.5L4.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 4v5h5M7 20v-5H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 4.5 6.5v5.25C4.5 16.18 7.85 19.82 12 21c4.15-1.18 7.5-4.82 7.5-9.25V6.5L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.75" y="4.75" width="16.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.75" y="13.75" width="16.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="7.5" cy="16.5" r="1" fill="currentColor" />
    </svg>
  )
}
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.25 10.75h9.5v8.5h-9.5v-8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 10.5V8.25a3 3 0 1 1 6 0v2.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12C4.5 7 8 4.75 12 4.75S19.5 7 21.5 12c-2 5-5.5 7.25-9.5 7.25S4.5 17 2.5 12Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18M10.5 10.677A2.5 2.5 0 0 0 13.323 13.5M6.357 6.534C4.33 7.8 2.9 9.75 2.5 12c2 5 5.5 7.25 9.5 7.25 1.87 0 3.6-.55 5.07-1.5M9.5 5.25A9.6 9.6 0 0 1 12 4.75c4 0 7.5 2.25 9.5 7.25a12.6 12.6 0 0 1-2.13 3.37" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
