import { useState } from 'react'
import { LoginForm } from '../../features/auth/LoginForm'
import { RegisterRestaurantForm } from '../../features/auth/RegisterRestaurantForm'
import { BookIcon, BoxIcon, CalendarIcon, ChecklistIcon, MailIcon, TeamIcon, UserIcon } from '../../shared/ui/Icon'
import './AuthPage.css'

type AuthTab = 'login' | 'register'

const brandFeatures = [
  {
    icon: <ChecklistIcon />,
    title: 'Чек-листы и стандарты',
    text: 'Открытие, закрытие, проверки',
  },
  {
    icon: <TeamIcon />,
    title: 'Управление сотрудниками',
    text: 'Роли, смены, задачи, обучение',
  },
  {
    icon: <CalendarIcon />,
    title: 'План зала',
    text: 'Столы, бронирование, сервис',
  },
  {
    icon: <BoxIcon />,
    title: 'Инвентаризация',
    text: 'Склад, списания, отчёты',
  },
  {
    icon: <BookIcon />,
    title: 'База знаний и ТТК',
    text: 'Рецепты, инструкции, документы',
  },
]

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <img
      className={compact ? 'brand-logo-img brand-logo-img--compact' : 'brand-logo-img'}
      src="/resto-control-logo.png"
      alt="Ресто Контроль"
    />
  )
}

function DesktopBrandPanel() {
  return (
    <aside className="auth-brand" aria-label="Resto Control">
      <div className="auth-brand__content">
        <div className="auth-brand__top">
          <BrandMark />
          <div>
            <p>Контроль процессов ресторана</p>
          </div>
        </div>

        <span className="auth-brand__accent-line" />

        <h1>Порядок в ресторане начинается с контроля</h1>

        <div className="auth-brand__features">
          {brandFeatures.map((item) => (
            <div className="brand-feature" key={item.title}>
              <div className="brand-feature__icon">{item.icon}</div>
              <div>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="auth-brand__copyright">© 2026 Resto Control</p>
      </div>
    </aside>
  )
}

function MobileHeader() {
  return (
    <header className="auth-mobile-header">
      <BrandMark compact />
      <h1>Ресто Контроль</h1>
      <p>Рабочий вход для сотрудника</p>
    </header>
  )
}

export function AuthPage() {
  const [activeTab, setActiveTab] = useState<AuthTab>('login')
  const [supportOpen, setSupportOpen] = useState(false)

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <DesktopBrandPanel />

        <section className="auth-panel" aria-label="Авторизация">
          <MobileHeader />

          <div className="auth-card">
            <div className="auth-tabs" role="tablist" aria-label="Сценарий авторизации">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'login'}
                className={activeTab === 'login' ? 'auth-tabs__item auth-tabs__item--active' : 'auth-tabs__item'}
                onClick={() => setActiveTab('login')}
              >
                Войти
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'register'}
                className={activeTab === 'register' ? 'auth-tabs__item auth-tabs__item--active' : 'auth-tabs__item'}
                onClick={() => setActiveTab('register')}
              >
                Создать ресторан
              </button>
            </div>

            {activeTab === 'login' ? <LoginForm /> : <RegisterRestaurantForm />}
          </div>

          <div className="auth-panel-footer">
            <div className="employee-access-note">
              <span className="employee-access-note__icon"><UserIcon /></span>
              <span>Нет доступа? Обратитесь к управляющему.</span>
            </div>

            <button
              className="auth-support-button"
              type="button"
              onClick={() => setSupportOpen(true)}
            >
              <MailIcon />
              <span>Поддержка</span>
            </button>
          </div>
        </section>
      </div>
      {supportOpen ? (
        <div className="auth-support-modal" role="presentation" onMouseDown={() => setSupportOpen(false)}>
          <section className="auth-support-dialog" role="dialog" aria-modal="true" aria-label="Поддержка" onMouseDown={(event) => event.stopPropagation()}>
            <div className="auth-support-dialog__header">
              <div>
                <h2>Поддержка</h2>
                <p>Напишите вопрос управляющему или владельцу сервиса. На публичной странице обращение не отправляется автоматически.</p>
              </div>
              <button type="button" onClick={() => setSupportOpen(false)} aria-label="Закрыть">×</button>
            </div>
            <label>
              <span>Ваш вопрос</span>
              <textarea rows={4} placeholder="Например: не получается войти, нужен доступ сотрудника..." />
            </label>
            <div className="auth-support-dialog__actions">
              <button type="button" onClick={() => setSupportOpen(false)}>Понятно</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
