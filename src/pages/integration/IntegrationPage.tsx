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
    <svg viewBox="-40 -40 592 592" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect x="160" y="160" width="330" height="330" rx="78" fill="#3b35d4" />
      <circle cx="190" cy="190" r="200" fill="#ff1f3d" />
      <rect x="261" y="210" width="52" height="210" rx="26" fill="#fff"
        transform="rotate(-45 287 315)" />
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

function detectSystemName(host: string): string {
  const h = host.toLowerCase()
  if (h.includes('iiko')) return 'iiko'
  if (h.includes('quickresto') || h.includes('syrve')) return 'Quick Resto'
  return 'кассовой системы'
}

export function IntegrationPage() {
  const [conn, setConn] = useState<Connection>({ host: '', login: '', password: '' })
  const [st, setSt] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const systemName = detectSystemName(conn.host)
  const isConnected = st === 'ok'
  const isTesting = st === 'testing'

  function showNotice(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 3000)
  }

  useEffect(() => { void loadSettings() }, [])

  async function loadSettings() {
    try {
      const resp = await fetch('/api/restaurant', { credentials: 'include' })
      if (!resp.ok) return
      const r = await resp.json()
      const host = r.iikoHost || r.qrHost || ''
      const login = r.iikoLogin || r.qrLogin || ''
      const password = r.iikoPassword || r.qrPassword || ''
      setConn({ host, login, password })
      if (host) setSt('ok')
    } catch { /* ignore */ }
  }

  function setField(field: keyof Connection, value: string) {
    setConn((c) => ({ ...c, [field]: value }))
    if (st !== 'idle') setSt('idle')
    setErr('')
  }

  async function save() {
    setIsSaving(true)
    const h = conn.host.toLowerCase()
    const isQR = h.includes('quickresto') || h.includes('syrve')
    const patch = isQR
      ? { qrHost: conn.host.trim(), qrLogin: conn.login.trim(), qrPassword: conn.password, iikoHost: '', iikoLogin: '', iikoPassword: '' }
      : { iikoHost: conn.host.trim(), iikoLogin: conn.login.trim(), iikoPassword: conn.password, qrHost: '', qrLogin: '', qrPassword: '' }
    try {
      const resp = await fetch('/api/restaurant', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      if (!resp.ok) throw new Error('Ошибка сохранения')
      showNotice('Настройки сохранены.')
    } catch (e) {
      showNotice(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setIsSaving(false)
    }
  }

  async function testConnection() {
    setSt('testing')
    setErr('')
    try {
      await save()
      const h = conn.host.toLowerCase()
      const isQR = h.includes('quickresto') || h.includes('syrve')
      const endpoint = isQR ? '/api/quickresto/test' : '/api/iiko/test'
      const resp = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: conn.host.trim(), login: conn.login.trim(), password: conn.password }) })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Ошибка подключения')
      setSt('ok')
    } catch (e) {
      setSt('error')
      setErr(e instanceof Error ? e.message : 'Ошибка подключения')
    }
  }

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
            <div className="int-card__title">
              <strong>Подключение к кассе</strong>
              <div className={`int-status-badge int-status-badge--${isConnected ? 'ok' : st === 'error' ? 'error' : 'idle'}`}>
                {isConnected ? `● ${systemName}` : st === 'error' ? '● Ошибка' : '○ Не настроено'}
              </div>
            </div>

            <div className="int-divider" />

            <div className="int-form">
              <div className="int-field">
                <label className="int-field__label">Хост</label>
                <div className="int-field__wrap">
                  <ServerIcon className="int-field__icon" />
                  <input className="int-input" type="text" placeholder="Хост или IP-адрес" value={conn.host} onChange={(e) => setField('host', e.target.value)} autoComplete="off" />
                </div>
              </div>

              <div className="int-field">
                <label className="int-field__label">Логин</label>
                <div className="int-field__wrap">
                  <UserIcon className="int-field__icon" />
                  <input className="int-input" type="text" placeholder="Логин" value={conn.login} onChange={(e) => setField('login', e.target.value)} autoComplete="new-password" />
                </div>
              </div>

              <div className="int-field">
                <label className="int-field__label">Пароль</label>
                <div className="int-field__wrap">
                  <LockIcon className="int-field__icon" />
                  <PasswordInput value={conn.password} onChange={(v) => setField('password', v)} />
                </div>
              </div>

              {err && <div className="int-error"><span>⚠</span> {err}</div>}

              <div className="int-actions">
                <button type="button" className="int-btn int-btn--secondary" disabled={isTesting || isSaving || !conn.host || !conn.login || !conn.password} onClick={() => void testConnection()}>
                  {isTesting ? 'Проверяю...' : 'Проверить соединение'}
                </button>
                <button type="button" className="int-btn int-btn--primary" disabled={isSaving || !conn.host || !conn.login || !conn.password} onClick={() => void save()}>
                  {isSaving ? 'Сохраняю...' : 'Сохранить'}
                </button>
              </div>
            </div>

            {isConnected && (
              <div className="int-connected-note">
                <span className="int-connected-note__dot" />
                Подключено к <strong>{systemName}</strong>
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
        autoComplete="new-password"
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
