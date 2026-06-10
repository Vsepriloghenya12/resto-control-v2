import { useState, type ReactNode } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import type { Restaurant } from '../../features/auth/authTypes'
import {
  AlertCircleIcon,
  BellIcon,
  BookIcon,
  BoxIcon,
  CalendarIcon,
  ChecklistIcon,
  ChefIcon,
  ClockIcon,
  HomeIcon,
  LogoutIcon,
  MailIcon,
  PaymentIcon,
  SearchIcon,
  TeamIcon,
  UserIcon,
} from '../../shared/ui/Icon'
import { EmployeesPage } from '../employees/EmployeesPage'
import { ChecklistsPage } from '../checklists/ChecklistsPage'
import { TasksPage } from '../tasks/TasksPage'
import { HallBookingsPage } from '../hall-bookings/HallBookingsPage'
import { InventoryPage } from '../inventory/InventoryPage'
import { TtkPage } from '../ttk/TtkPage'
import { KnowledgeBasePage } from '../knowledge/KnowledgeBasePage'
import { PaymentPage } from '../payment/PaymentPage'
import './OwnerDashboardPage.css'
import '../employees/EmployeesPage.css'
import '../checklists/ChecklistsPage.css'
import '../tasks/TasksPage.css'
import '../hall-bookings/HallBookingsPage.css'
import '../inventory/InventoryPage.css'
import '../ttk/TtkPage.css'
import '../knowledge/KnowledgeBasePage.css'
import '../payment/PaymentPage.css'

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple'
type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'
type OwnerSection = 'dashboard' | 'employees' | 'checklists' | 'tasks' | 'hallBookings' | 'inventory' | 'ttk' | 'knowledge' | 'payment'

type SummaryMetric = {
  label: string
  value: string
  subValue?: string
  description: string
  icon: ReactNode
  tone: Tone
}

type ZoneReadiness = {
  label: string
  percent: number
  completed: string
  tone: 'good' | 'medium' | 'low'
}

type AttentionItem = {
  title: string
  description: string
  time: string
  tone: StatusTone
}

type ShiftEmployee = {
  name: string
  role: string
  zone: string
  status: string
  tone: StatusTone
  initials: string
}

const navItems: Array<{ label: string; section?: OwnerSection; icon: ReactNode }> = [
  { label: 'Главная', section: 'dashboard', icon: <HomeIcon /> },
  { label: 'Сотрудники', section: 'employees', icon: <TeamIcon /> },
  { label: 'Чек-листы', section: 'checklists', icon: <ChecklistIcon /> },
  { label: 'Задачи', section: 'tasks', icon: <ClockIcon /> },
  { label: 'План зала / Брони', section: 'hallBookings', icon: <CalendarIcon /> },
  { label: 'Инвентаризация', section: 'inventory', icon: <BoxIcon /> },
  { label: 'ТТК', section: 'ttk', icon: <BookIcon /> },
  { label: 'База знаний', section: 'knowledge', icon: <BookIcon /> },
  { label: 'Оплата', section: 'payment', icon: <PaymentIcon /> },
]

const summaryMetrics: SummaryMetric[] = [
  {
    label: 'Сотрудников',
    value: '6',
    description: 'на смене',
    icon: <TeamIcon />,
    tone: 'blue',
  },
  {
    label: 'Чек-листов',
    value: '8',
    subValue: '/ 12',
    description: 'выполнено',
    icon: <ChecklistIcon />,
    tone: 'blue',
  },
  {
    label: 'Задач',
    value: '5',
    subValue: '/ 9',
    description: 'выполнено',
    icon: <ClockIcon />,
    tone: 'orange',
  },
  {
    label: 'Броней',
    value: '14',
    description: 'сегодня',
    icon: <CalendarIcon />,
    tone: 'purple',
  },
  {
    label: 'Позиций',
    value: '7',
    description: 'в стоп-листе',
    icon: <AlertCircleIcon />,
    tone: 'red',
  },
  {
    label: 'Инвентаризации',
    value: '2',
    description: 'назначено',
    icon: <BoxIcon />,
    tone: 'green',
  },
]

const zones: ZoneReadiness[] = [
  { label: 'Открытие', percent: 90, completed: '9 из 10', tone: 'good' },
  { label: 'Зал', percent: 80, completed: '8 из 10', tone: 'good' },
  { label: 'Кухня', percent: 72, completed: '13 из 18', tone: 'good' },
  { label: 'Бар', percent: 58, completed: '7 из 12', tone: 'medium' },
  { label: 'Склад', percent: 40, completed: '4 из 10', tone: 'low' },
]

const attentionItems: AttentionItem[] = [
  {
    title: 'Бар не завершил чек-лист открытия',
    description: 'Чек-лист «Открытие бара»',
    time: '15 мин назад',
    tone: 'danger',
  },
  {
    title: 'У официанта Марии просрочена задача',
    description: 'Протереть стопы на террасе',
    time: '45 мин назад',
    tone: 'warning',
  },
  {
    title: 'В стоп-лист добавлены 3 позиции',
    description: 'Список обновлён',
    time: '1 ч назад',
    tone: 'warning',
  },
  {
    title: 'Инвентаризация кухни не назначена',
    description: 'Назначьте ответственного',
    time: '2 ч назад',
    tone: 'neutral',
  },
]

const shiftEmployees: ShiftEmployee[] = [
  { name: 'Мария Иванова', role: 'Официант', zone: 'Зал', status: 'Смена открыта', tone: 'success', initials: 'МИ' },
  { name: 'Алексей Смирнов', role: 'Бармен', zone: 'Бар', status: 'Смена открыта', tone: 'success', initials: 'АС' },
  { name: 'Дмитрий Кузнецов', role: 'Повар', zone: 'Кухня', status: 'Смена открыта', tone: 'success', initials: 'ДК' },
  { name: 'Анна Петрова', role: 'Хостес', zone: 'Зал', status: 'Есть задачи', tone: 'warning', initials: 'АП' },
  { name: 'Сергей Волков', role: 'Клининг', zone: 'Склад', status: 'Просрочено', tone: 'danger', initials: 'СВ' },
  { name: 'Ольга Соколова', role: 'Повар', zone: 'Кухня', status: 'Смена открыта', tone: 'success', initials: 'ОС' },
]

function formatRuDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function getPaymentAccess(restaurant?: Restaurant) {
  if (!restaurant || restaurant.subscriptionStatus !== 'active' || !restaurant.subscriptionEndsAt) {
    return null
  }

  const endDate = new Date(restaurant.subscriptionEndsAt)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)

  const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86_400_000)

  if (daysLeft < 0 || daysLeft > 5) {
    return null
  }

  return {
    paidUntil: formatRuDate(endDate),
    daysLeft,
  }
}

const operationRows = [
  { label: 'Завершено чек-листов', value: '8 из 12', percent: 67, tone: 'good', icon: <ChecklistIcon /> },
  { label: 'Выполнено задач', value: '5 из 9', percent: 56, tone: 'medium', icon: <ClockIcon /> },
  { label: 'Проблемы требуют внимания', value: '3', percent: 30, tone: 'low', icon: <AlertCircleIcon /> },
  { label: 'Сотрудники на смене', value: '6 из 8', percent: 75, tone: 'good', icon: <TeamIcon /> },
]

function BrandLogo() {
  return (
    <div className="owner-brand">
      <img className="owner-brand__logo-img" src="/resto-control-logo.png" alt="Ресто Контроль" />
      <span>Панель владельца</span>
    </div>
  )
}

function StatusBadge({ children, tone }: { children: string; tone: StatusTone }) {
  return <span className={`owner-badge owner-badge--${tone}`}>{children}</span>
}

function ProgressLine({ item, compact = false }: { item: ZoneReadiness; compact?: boolean }) {
  return (
    <div className={compact ? 'owner-progress owner-progress--compact' : 'owner-progress'}>
      <div className="owner-progress__top">
        <span>{item.label}</span>
        {!compact && <strong>{item.percent}%</strong>}
        {compact && <small>{item.completed}</small>}
      </div>
      <div className="owner-progress__track" aria-hidden="true">
        <span className={`owner-progress__bar owner-progress__bar--${item.tone}`} style={{ width: `${item.percent}%` }} />
      </div>
      {compact && <strong>{item.percent}%</strong>}
    </div>
  )
}

function SummaryMetricCard({ item }: { item: SummaryMetric }) {
  return (
    <article className="owner-metric-card">
      <div className={`owner-metric-card__icon owner-metric-card__icon--${item.tone}`}>{item.icon}</div>
      <div>
        <strong>{item.value}<span>{item.subValue}</span></strong>
        <p>{item.label}</p>
        <small>{item.description}</small>
      </div>
    </article>
  )
}

function AttentionIcon({ tone }: { tone: StatusTone }) {
  if (tone === 'neutral') {
    return <span className={`owner-attention__icon owner-attention__icon--${tone}`}><BellIcon /></span>
  }

  return <span className={`owner-attention__icon owner-attention__icon--${tone}`}><AlertCircleIcon /></span>
}

function PaymentAccessBadge({ paidUntil, daysLeft }: { paidUntil: string; daysLeft: number }) {
  return (
    <div className="owner-payment-badge" aria-label="Статус оплаты">
      <span>Оплата</span>
      <strong>Оплачено до {paidUntil}</strong>
      <p>До окончания оплаченного периода осталось {daysLeft} дней</p>
    </div>
  )
}

function RestaurantTabs({
  restaurants,
  activeRestaurantId,
  onSelect,
}: {
  restaurants: Array<{ id: string; name: string }>
  activeRestaurantId: string
  onSelect: (restaurantId: string) => void
}) {
  return (
    <section className="owner-restaurant-row" aria-label="Рестораны владельца">
      <div className="owner-restaurant-tabs">
        {restaurants.map((restaurant) => (
          <button
            className={restaurant.id === activeRestaurantId ? 'owner-restaurant-tab owner-restaurant-tab--active' : 'owner-restaurant-tab'}
            type="button"
            key={restaurant.id}
            onClick={() => onSelect(restaurant.id)}
          >
            {restaurant.name}
          </button>
        ))}
      </div>
      <span className="owner-restaurant-divider" aria-hidden="true" />
      <button className="owner-add-restaurant" type="button">+ Добавить ресторан</button>
    </section>
  )
}


function DashboardContent() {
  return (
    <>
      <section className="owner-overview-card" aria-label="Операционная сводка за сегодня">
        <div className="owner-overview-card__left">
          <h2>Операционная сводка за сегодня</h2>
          <div className="owner-readiness-ring" aria-label="Готовность смены 67 процентов">
            <div>
              <strong>67%</strong>
              <span>Готовность смены</span>
              <p>8 из 12 процессов завершено</p>
            </div>
          </div>
        </div>

        <div className="owner-operation-list">
          {operationRows.map((row) => (
            <div className="owner-operation-row" key={row.label}>
              <div className={`owner-operation-row__icon owner-operation-row__icon--${row.tone}`}>{row.icon}</div>
              <div className="owner-operation-row__content">
                <div>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
                <div className="owner-operation-row__track" aria-hidden="true">
                  <span className={`owner-operation-row__bar owner-operation-row__bar--${row.tone}`} style={{ width: `${row.percent}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="owner-zones-card">
          <div className="owner-zones-card__header">
            <h2>Готовность по зонам</h2>
            <button type="button">Подробнее</button>
          </div>
          <div className="owner-zones-list">
            {zones.map((item) => <ProgressLine item={item} key={item.label} />)}
          </div>
        </div>
      </section>

      <section className="owner-metrics-grid" aria-label="Ключевые показатели смены">
        {summaryMetrics.map((item) => <SummaryMetricCard item={item} key={item.label} />)}
      </section>

      <section className="owner-lower-grid">
        <article className="owner-section-card owner-zone-details">
          <div className="owner-section-card__header">
            <h2>Готовность процессов по зонам</h2>
            <button type="button">Сегодня</button>
          </div>
          <div className="owner-zone-details__list">
            {zones.map((item) => <ProgressLine item={item} compact key={item.label} />)}
          </div>
          <button className="owner-link-button" type="button">Перейти ко всем чек-листам</button>
        </article>

        <article className="owner-section-card owner-attention-card">
          <div className="owner-section-card__header">
            <h2>Требует внимания</h2>
            <button type="button">Все (3)</button>
          </div>
          <div className="owner-attention-list">
            {attentionItems.map((item) => (
              <div className="owner-attention" key={item.title}>
                <AttentionIcon tone={item.tone} />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </div>
                <small>{item.time}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="owner-section-card owner-employees-card">
          <div className="owner-section-card__header">
            <h2>Сотрудники на смене</h2>
            <button type="button">Все</button>
          </div>
          <div className="owner-employees-list">
            {shiftEmployees.map((employee) => (
              <div className="owner-employee" key={employee.name}>
                <span className="owner-employee__avatar">{employee.initials}</span>
                <div>
                  <strong>{employee.name}</strong>
                  <p>{employee.role}</p>
                </div>
                <small>{employee.zone}</small>
                <StatusBadge tone={employee.tone}>{employee.status}</StatusBadge>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  )
}

function UnsupportedSectionNotice({ label }: { label: string }) {
  return (
    <section className="owner-section-card owner-empty-section">
      <span className="owner-empty-section__icon"><BookIcon /></span>
      <h2>{label}</h2>
      <p>Раздел будет собран отдельным шагом, чтобы не смешивать сценарии и не ломать готовые страницы.</p>
    </section>
  )
}

export function OwnerDashboardPage() {
  const { session, logout } = useSession()
  const [section, setSection] = useState<OwnerSection>('dashboard')
  const [pendingLabel, setPendingLabel] = useState('')
  const userName = session?.user.name ?? 'Иван'
  const restaurantName = session?.restaurant.name ?? 'Resto Control'
  const paymentAccess = getPaymentAccess(session?.restaurant)
  const ownerRestaurants = [
    { id: 'main', name: restaurantName },
    { id: 'terrace', name: 'Resto Terrace' },
    { id: 'bar', name: 'Resto Bar' },
  ]
  const [activeRestaurantId, setActiveRestaurantId] = useState(ownerRestaurants[0].id)

  const handleNavigate = (item: { label: string; section?: OwnerSection }) => {
    if (item.section) {
      setSection(item.section)
      setPendingLabel('')
      return
    }

    setPendingLabel(item.label)
  }

  const pageCopy: Record<OwnerSection, { title: string; subtitle: string; searchPlaceholder: string }> = {
    dashboard: {
      title: `Добрый день, ${userName}!`,
      subtitle: 'Выберите ресторан или добавьте новое заведение',
      searchPlaceholder: 'Поиск...',
    },
    employees: {
      title: 'Сотрудники',
      subtitle: 'Команда ресторана, должности и рабочий статус',
      searchPlaceholder: 'Поиск сотрудника...',
    },
    checklists: {
      title: 'Чек-листы',
      subtitle: 'Создание и настройка стандартов работы',
      searchPlaceholder: 'Поиск чек-листа...',
    },
    tasks: {
      title: 'Задачи',
      subtitle: 'Создание и назначение рабочих задач',
      searchPlaceholder: 'Поиск задач...',
    },
    hallBookings: {
      title: 'План зала / Брони',
      subtitle: 'Залы, столы, посадочные места и бронирования',
      searchPlaceholder: 'Поиск...',
    },
    inventory: {
      title: 'Инвентаризация',
      subtitle: 'Бланки, товары, назначения и сданные остатки',
      searchPlaceholder: 'Поиск по товарам...',
    },
    ttk: {
      title: 'ТТК',
      subtitle: 'Карточки блюд и товаров',
      searchPlaceholder: 'Поиск по позициям, ингредиентам, тэгам...',
    },
    knowledge: {
      title: 'База знаний',
      subtitle: 'Знакомство, обучение и корпоративная жизнь',
      searchPlaceholder: 'Поиск по материалам...',
    },
    payment: {
      title: 'Оплата',
      subtitle: 'Тариф, реквизиты, счета и закрывающие документы',
      searchPlaceholder: 'Поиск по счетам и документам...',
    },
  }

  const activeLabel = pendingLabel || (section === 'employees' ? 'Сотрудники' : section === 'checklists' ? 'Чек-листы' : section === 'tasks' ? 'Задачи' : section === 'hallBookings' ? 'План зала / Брони' : section === 'inventory' ? 'Инвентаризация' : section === 'ttk' ? 'ТТК' : section === 'knowledge' ? 'База знаний' : section === 'payment' ? 'Оплата' : 'Главная')
  const pageTitle = pendingLabel ? pendingLabel : pageCopy[section].title
  const pageSubtitle = pendingLabel ? 'Раздел будет подключён отдельным экраном' : pageCopy[section].subtitle
  const searchPlaceholder = pendingLabel ? 'Поиск...' : pageCopy[section].searchPlaceholder

  return (
    <main className="owner-dashboard">
      <aside className="owner-sidebar">
        <BrandLogo />

        <nav className="owner-nav" aria-label="Главное меню">
          {navItems.map((item) => {
            const isActive = item.label === activeLabel
            return (
              <button
                className={isActive ? 'owner-nav__item owner-nav__item--active' : 'owner-nav__item'}
                type="button"
                key={item.label}
                onClick={() => handleNavigate(item)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <button
          className="owner-support-button"
          type="button"
          onClick={() => { window.location.href = 'mailto:support@resto-control.ru?subject=Поддержка Resto Control' }}
        >
          <MailIcon />
          <span>Поддержка</span>
        </button>

        <div className="owner-sidebar-status">
          <span />
          <strong>Смена открыта</strong>
          <p>Сегодня до 23:00</p>
          <button type="button">Закрыть смену</button>
        </div>
      </aside>

      <section className="owner-main">
        <header className="owner-topbar">
          <div className="owner-title-block">
            <h1>{pageTitle}</h1>
            {section !== 'dashboard' || pendingLabel ? <p>{pageSubtitle}</p> : null}
          </div>

          {section === 'dashboard' && !pendingLabel && paymentAccess ? <PaymentAccessBadge paidUntil={paymentAccess.paidUntil} daysLeft={paymentAccess.daysLeft} /> : null}

          <div className="owner-topbar__actions">
            <label className="owner-search">
              <SearchIcon />
              <input placeholder={searchPlaceholder} />
            </label>
            <button className="owner-icon-button" type="button" aria-label="Уведомления">
              <BellIcon />
              <span>3</span>
            </button>
            <button className="owner-profile" type="button">
              <span><UserIcon /></span>
              <div>
                <strong>{userName}</strong>
                <small>{session?.membership.role === 'owner' ? 'Владелец' : 'Управляющий'}</small>
              </div>
            </button>
            <button className="owner-logout" type="button" onClick={logout} aria-label="Выйти">
              <LogoutIcon />
            </button>
          </div>
        </header>

        {section === 'dashboard' && !pendingLabel ? (
          <RestaurantTabs
            restaurants={ownerRestaurants}
            activeRestaurantId={activeRestaurantId}
            onSelect={setActiveRestaurantId}
          />
        ) : null}

        {pendingLabel ? <UnsupportedSectionNotice label={pendingLabel} /> : section === 'employees' ? <EmployeesPage /> : section === 'checklists' ? <ChecklistsPage /> : section === 'tasks' ? <TasksPage /> : section === 'hallBookings' ? <HallBookingsPage /> : section === 'inventory' ? <InventoryPage /> : section === 'ttk' ? <TtkPage /> : section === 'knowledge' ? <KnowledgeBasePage /> : section === 'payment' ? <PaymentPage /> : <DashboardContent />}
      </section>
    </main>
  )
}
