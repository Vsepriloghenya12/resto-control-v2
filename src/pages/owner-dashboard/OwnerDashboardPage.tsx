import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import type { Restaurant } from '../../features/auth/authTypes'
import { api, apiRequest } from '../../shared/api/client'
import {
  AlertCircleIcon,
  BellIcon,
  BookIcon,
  BoxIcon,
  CalendarIcon,
  ChecklistIcon,
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
  target: OwnerSection
}

type OperationRow = {
  label: string
  value: string
  percent: number
  tone: 'good' | 'medium' | 'low'
  icon: ReactNode
  target: OwnerSection
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
  target: OwnerSection
}

type ShiftEmployee = {
  name: string
  role: string
  zone: string
  status: string
  tone: StatusTone
  initials: string
}

type DashboardSummary = {
  restaurant: Restaurant
  paymentNotice?: { subscriptionEndsAt: string; daysLeft: number } | null
  employees?: Array<{ id: string; name: string; position: string; shiftStatus?: string; status?: string }>
  employeesOnShift?: number
  tasks?: Array<{ id: string; title: string; description?: string; status?: string; assignedPosition?: string; dueTime?: string; updatedAt?: string }>
  checklists?: Array<{ id: string; title: string; position?: string; active?: boolean; items?: unknown[] }>
  bookings?: Array<{ id: string; guestName?: string; status?: string; time?: string; guestsCount?: number }>
  technicalRequests?: Array<{ id: string; title: string; status?: string; priority?: string; updatedAt?: string }>
  inventoryAssignments?: Array<{ id: string; title: string; status?: string; section?: string }>
  ttkItems?: Array<{ id: string; name: string }>
  payments?: Array<{ id: string; status?: string }>
  halls?: Array<{ id: string; name: string }>
  tables?: Array<{ id: string; name: string; status?: string }>
  knowledgeMaterials?: Array<{ id: string; title: string }>
  guests?: Array<{ id: string; name: string }>
}

const navItems: Array<{ label: string; section: OwnerSection; icon: ReactNode }> = [
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

function formatRuDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function percent(done: number, total: number) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

function toneByPercent(value: number): 'good' | 'medium' | 'low' {
  if (value >= 70) return 'good'
  if (value >= 40) return 'medium'
  return 'low'
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

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'С'
}

function buildDashboardModel(summary: DashboardSummary | null) {
  const employees = (summary?.employees || []).filter((item) => item.status !== 'fired' && item.status !== 'blocked')
  const tasks = summary?.tasks || []
  const checklists = summary?.checklists || []
  const bookings = summary?.bookings || []
  const technicalRequests = summary?.technicalRequests || []
  const inventoryAssignments = summary?.inventoryAssignments || []
  const ttkItems = summary?.ttkItems || []

  const tasksDone = tasks.filter((item) => item.status === 'done').length
  const overdueTasks = tasks.filter((item) => item.status === 'overdue')
  const activeChecklists = checklists.filter((item) => item.active !== false).length
  const employeesOnShift = employees.filter((item) => item.shiftStatus === 'open').length
  const openBookings = bookings.filter((item) => !['cancelled', 'no_show'].includes(String(item.status || ''))).length
  const activeInventory = inventoryAssignments.filter((item) => ['assigned', 'draft', 'in_progress'].includes(String(item.status || ''))).length
  const openTechRequests = technicalRequests.filter((item) => !['done', 'closed', 'cancelled'].includes(String(item.status || ''))).length
  const problemCount = overdueTasks.length + openTechRequests + inventoryAssignments.filter((item) => item.status === 'draft').length

  const metrics: SummaryMetric[] = [
    { label: 'Сотрудников', value: String(employees.length), description: employeesOnShift ? `${employeesOnShift} на смене` : 'действующие', icon: <TeamIcon />, tone: 'blue', target: 'employees' },
    { label: 'Чек-листов', value: String(activeChecklists), subValue: checklists.length ? ` / ${checklists.length}` : '', description: checklists.length ? 'активно' : 'ещё не созданы', icon: <ChecklistIcon />, tone: 'blue', target: 'checklists' },
    { label: 'Задач', value: String(tasksDone), subValue: tasks.length ? ` / ${tasks.length}` : '', description: tasks.length ? 'выполнено' : 'задач нет', icon: <ClockIcon />, tone: overdueTasks.length ? 'orange' : 'green', target: 'tasks' },
    { label: 'Броней', value: String(openBookings), description: bookings.length ? 'активные брони' : 'броней нет', icon: <CalendarIcon />, tone: 'purple', target: 'hallBookings' },
    { label: 'Тех. заявок', value: String(openTechRequests), description: openTechRequests ? 'открыто' : 'заявок нет', icon: <AlertCircleIcon />, tone: openTechRequests ? 'red' : 'green', target: 'tasks' },
    { label: 'Инвентаризации', value: String(activeInventory), description: activeInventory ? 'в работе' : 'не назначено', icon: <BoxIcon />, tone: activeInventory ? 'green' : 'blue', target: 'inventory' },
  ]

  const operationRows: OperationRow[] = [
    { label: 'Активные чек-листы', value: `${activeChecklists} из ${checklists.length}`, percent: percent(activeChecklists, checklists.length), tone: toneByPercent(percent(activeChecklists, checklists.length)), icon: <ChecklistIcon />, target: 'checklists' },
    { label: 'Выполнено задач', value: `${tasksDone} из ${tasks.length}`, percent: percent(tasksDone, tasks.length), tone: toneByPercent(percent(tasksDone, tasks.length)), icon: <ClockIcon />, target: 'tasks' },
    { label: 'Требует внимания', value: String(problemCount), percent: problemCount ? Math.min(100, problemCount * 15) : 0, tone: problemCount ? 'low' : 'good', icon: <AlertCircleIcon />, target: problemCount ? 'tasks' : 'dashboard' },
    { label: 'Сотрудники на смене', value: `${employeesOnShift} из ${employees.length}`, percent: percent(employeesOnShift, employees.length), tone: toneByPercent(percent(employeesOnShift, employees.length)), icon: <TeamIcon />, target: 'employees' },
  ]

  const checklistGroups = Array.from(checklists.reduce((map, item) => {
    const key = item.position || 'Без должности'
    const current = map.get(key) || { label: key, total: 0, active: 0 }
    current.total += 1
    if (item.active !== false) current.active += 1
    map.set(key, current)
    return map
  }, new Map<string, { label: string; total: number; active: number }>()).values())

  const zones: ZoneReadiness[] = checklistGroups.slice(0, 5).map((item) => {
    const value = percent(item.active, item.total)
    return { label: item.label, percent: value, completed: `${item.active} из ${item.total}`, tone: toneByPercent(value) }
  })

  const attentionItems: AttentionItem[] = []
  overdueTasks.slice(0, 3).forEach((task) => {
    attentionItems.push({ title: task.title, description: task.description || 'Просроченная задача', time: task.dueTime ? `до ${task.dueTime}` : 'требует внимания', tone: 'danger', target: 'tasks' })
  })
  technicalRequests.filter((item) => !['done', 'closed', 'cancelled'].includes(String(item.status || ''))).slice(0, 3).forEach((request) => {
    attentionItems.push({ title: request.title, description: request.priority === 'high' ? 'Высокий приоритет' : 'Техническая заявка открыта', time: 'активна', tone: request.priority === 'high' ? 'danger' : 'warning', target: 'tasks' })
  })
  inventoryAssignments.filter((item) => item.status === 'draft').slice(0, 2).forEach((assignment) => {
    attentionItems.push({ title: assignment.title, description: 'Инвентаризация не назначена', time: assignment.section || 'инвентаризация', tone: 'warning', target: 'inventory' })
  })
  bookings.filter((item) => item.status === 'new').slice(0, 2).forEach((booking) => {
    attentionItems.push({ title: `Новая бронь: ${booking.guestName || 'гость'}`, description: `${booking.guestsCount || 1} гостей${booking.time ? `, ${booking.time}` : ''}`, time: 'сегодня', tone: 'neutral', target: 'hallBookings' })
  })

  const shiftEmployees: ShiftEmployee[] = employees
    .filter((employee) => employee.shiftStatus === 'open')
    .slice(0, 6)
    .map((employee) => ({
      name: employee.name,
      role: employee.position,
      zone: employee.position.includes('Бар') ? 'Бар' : employee.position.includes('Повар') || employee.position.includes('Шеф') ? 'Кухня' : employee.position.includes('Клининг') || employee.position.includes('Убор') ? 'Клининг' : 'Зал',
      status: 'Смена открыта',
      tone: 'success',
      initials: getInitials(employee.name),
    }))

  const readinessPercent = percent(activeChecklists + tasksDone, checklists.length + tasks.length)

  return {
    employees,
    tasks,
    checklists,
    bookings,
    technicalRequests,
    inventoryAssignments,
    ttkItems,
    metrics,
    operationRows,
    zones,
    attentionItems,
    shiftEmployees,
    readinessPercent,
    completedProcesses: activeChecklists + tasksDone,
    totalProcesses: checklists.length + tasks.length,
  }
}

function BrandLogo() {
  return (
    <div className="owner-brand">
      <img className="owner-brand__logo-img" src="/resto-control-logo.png" alt="Ресто Контроль" />
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

function SummaryMetricCard({ item, onClick }: { item: SummaryMetric; onClick: () => void }) {
  return (
    <button className="owner-metric-card owner-clickable-card" type="button" onClick={onClick}>
      <div className={`owner-metric-card__icon owner-metric-card__icon--${item.tone}`}>{item.icon}</div>
      <div>
        <strong>{item.value}<span>{item.subValue}</span></strong>
        <p>{item.label}</p>
        <small>{item.description}</small>
      </div>
    </button>
  )
}

function AttentionIcon({ tone }: { tone: StatusTone }) {
  if (tone === 'neutral') {
    return <span className={`owner-attention__icon owner-attention__icon--${tone}`}><BellIcon /></span>
  }
  return <span className={`owner-attention__icon owner-attention__icon--${tone}`}><AlertCircleIcon /></span>
}

function PaymentAccessBadge({ paidUntil, daysLeft, onClick }: { paidUntil: string; daysLeft: number; onClick: () => void }) {
  return (
    <button className="owner-payment-badge" type="button" aria-label="Открыть оплату" onClick={onClick}>
      <span>Оплата</span>
      <strong>Оплачено до {paidUntil}</strong>
      <p>До окончания оплаченного периода осталось {daysLeft} дней</p>
    </button>
  )
}


function DonutSegment({ value, offset, color, active, index, onHover }: { value: number; offset: number; color: string; active: boolean; index: number; onHover: (index: number) => void }) {
  const safeValue = Math.max(0.1, Math.min(100, value))

  return (
    <circle
      className={active ? 'owner-donut-widget__segment owner-donut-widget__segment--active' : 'owner-donut-widget__segment'}
      cx="130"
      cy="130"
      r="96"
      pathLength="100"
      stroke={color}
      strokeDasharray={`${safeValue} ${100 - safeValue}`}
      strokeDashoffset={String(-offset)}
      onMouseEnter={() => onHover(index)}
      onFocus={() => onHover(index)}
      tabIndex={0}
    />
  )
}

function OperationalDonutWidget({ model, onOpen }: { model: ReturnType<typeof buildDashboardModel>; onOpen: (section: OwnerSection) => void }) {
  const palette = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444']
  const baseRows = model.operationRows.map((row, index) => ({
    ...row,
    color: palette[index % palette.length],
    weight: row.percent,
  }))
  const positiveRows = baseRows.filter((row) => row.weight > 0)
  const totalWeight = positiveRows.reduce((sum, row) => sum + row.weight, 0)
  const gap = positiveRows.length > 1 ? 2.2 : 0
  const drawableLength = Math.max(0, 100 - gap * positiveRows.length)
  let preparedLength = 0
  const rows = positiveRows.length
    ? positiveRows.map((row, index) => {
        const isLast = index === positiveRows.length - 1
        const segmentLength = isLast
          ? Math.max(0.1, drawableLength - preparedLength)
          : Math.max(0.1, (row.weight / totalWeight) * drawableLength)
        preparedLength += segmentLength
        return {
          ...row,
          share: segmentLength,
          displayPercent: row.percent,
        }
      })
    : [{ ...baseRows[0], label: 'Нет данных', value: '0', color: '#cbd5e1', weight: 1, share: 100, displayPercent: 0, target: 'dashboard' as OwnerSection }]

  const [activeIndex, setActiveIndex] = useState(0)
  let offset = 0
  const active = rows[activeIndex] || rows[0]

  return (
    <section className="owner-donut-widget" aria-label="Инфографика рабочих действий">
      <header className="owner-donut-widget__header">
        <div>
          <h2>Рабочие действия</h2>
          <p>Операционная картина смены</p>
        </div>
        <div className="owner-donut-widget__tabs" aria-label="Период">
          <button type="button">Сегодня</button>
          <button type="button" className="is-active">7 дней</button>
          <button type="button">30 дней</button>
        </div>
      </header>

      <div className="owner-donut-widget__body">
        <div className="owner-donut-widget__chart" aria-label="Диаграмма рабочих действий">
          <svg viewBox="0 0 260 260" role="img">
            <circle className="owner-donut-widget__track" cx="130" cy="130" r="96" pathLength="100" />
            {rows.map((row, index) => {
              const currentOffset = offset
              offset += row.share + gap
              return <DonutSegment key={row.label} value={row.share} offset={currentOffset} color={row.color} active={index === activeIndex} index={index} onHover={setActiveIndex} />
            })}
          </svg>
          <div className="owner-donut-widget__center">
            <strong>{active?.displayPercent ?? 0}%</strong>
            <span>{active?.label || 'Смена'}</span>
          </div>
        </div>

        <div className="owner-donut-widget__list">
          {rows.map((row, index) => (
            <button
              className={index === activeIndex ? 'owner-donut-widget__item owner-donut-widget__item--active' : 'owner-donut-widget__item'}
              type="button"
              key={row.label}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => onOpen(row.target)}
            >
              <span className="owner-donut-widget__dot" style={{ background: row.color }} />
              <span className="owner-donut-widget__percent">{row.displayPercent}%</span>
              <span className="owner-donut-widget__name">{row.label}</span>
              <span className="owner-donut-widget__value">{row.value}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}


function RestaurantHeader({ restaurants, currentRestaurantId, onSwitch, onAdd }: { restaurants: Array<Restaurant & { isCurrent?: boolean }>; currentRestaurantId?: string; onSwitch: (id: string) => void; onAdd: () => void }) {
  return (
    <section className="owner-restaurant-row" aria-label="Рестораны владельца">
      <div className="owner-restaurant-tabs">
        {restaurants.length ? restaurants.map((restaurant) => {
          const isCurrent = restaurant.id === currentRestaurantId || restaurant.isCurrent
          return (
            <button
              key={restaurant.id}
              type="button"
              className={isCurrent ? 'owner-restaurant-tab owner-restaurant-tab--active' : 'owner-restaurant-tab'}
              onClick={() => !isCurrent && onSwitch(restaurant.id)}
            >
              {restaurant.name}
            </button>
          )
        }) : (
          <span className="owner-restaurant-empty">Ресторан не выбран</span>
        )}
      </div>
      <button className="owner-add-restaurant" type="button" onClick={onAdd}>+ Добавить ресторан</button>
    </section>
  )
}

function AddRestaurantDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div className="owner-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="owner-support-dialog owner-add-restaurant-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Добавить ресторан"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault()
          if (!name.trim()) {
            setError('Введите название ресторана.')
            return
          }
          try {
            setSaving(true)
            await onCreated(name.trim())
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать ресторан')
          } finally {
            setSaving(false)
          }
        }}
      >
        <div className="owner-support-dialog__header">
          <div>
            <h2>Добавить ресторан</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <label>
          <span>Название ресторана</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Resto Bar" autoFocus />
        </label>
        {error ? <p className="owner-form-error">{error}</p> : null}
        <div className="owner-support-dialog__actions">
          <button type="submit" disabled={saving}>{saving ? 'Создаю...' : 'Создать ресторан'}</button>
          <button type="button" onClick={onClose}>Отмена</button>
        </div>
      </form>
    </div>
  )
}

function SupportDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  async function submitSupport() {
    if (!title.trim() && !description.trim()) {
      setMessage('Опишите вопрос.')
      return
    }
    await api.create('technical-requests', {
      title: title.trim() || 'Обращение в поддержку',
      description: description.trim(),
      area: 'Поддержка',
      priority: 'medium',
      status: 'new',
      createdByPosition: 'Владелец / управляющий',
    })
    setMessage('Обращение создано. Оно появится в тех. заявках ресторана.')
    setTitle('')
    setDescription('')
  }

  return (
    <div className="owner-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="owner-support-dialog" role="dialog" aria-modal="true" aria-label="Поддержка" onMouseDown={(event) => event.stopPropagation()}>
        <div className="owner-support-dialog__header">
          <div>
            <h2>Поддержка</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <label>
          <span>Тема</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: проблема с чек-листом" />
        </label>
        <label>
          <span>Сообщение</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Опишите, что нужно исправить или проверить" />
        </label>
        {message ? <p className="owner-form-message">{message}</p> : null}
        <div className="owner-support-dialog__actions">
          <button type="button" onClick={() => void submitSupport()}>Создать обращение</button>
          <button type="button" onClick={onClose}>Закрыть</button>
        </div>
      </section>
    </div>
  )
}

function ProfileDialog({ userName, login, roleLabel, restaurantName, onClose }: { userName: string; login?: string; roleLabel: string; restaurantName: string; onClose: () => void }) {
  return (
    <div className="owner-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="owner-support-dialog owner-profile-dialog" role="dialog" aria-modal="true" aria-label="Профиль" onMouseDown={(event) => event.stopPropagation()}>
        <div className="owner-support-dialog__header">
          <div>
            <h2>Профиль</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="owner-profile-dialog__rows">
          <div><span>Имя</span><strong>{userName}</strong></div>
          <div><span>Логин</span><strong>{login || '—'}</strong></div>
          <div><span>Роль</span><strong>{roleLabel}</strong></div>
          <div><span>Ресторан</span><strong>{restaurantName}</strong></div>
        </div>
        <div className="owner-support-dialog__actions">
          <button type="button" onClick={onClose}>Закрыть</button>
        </div>
      </section>
    </div>
  )
}

function DashboardContent({ summary, onOpen }: { summary: DashboardSummary | null; onOpen: (section: OwnerSection) => void }) {
  const model = useMemo(() => buildDashboardModel(summary), [summary])

  return (
    <>
      <OperationalDonutWidget model={model} onOpen={onOpen} />

      <section className="owner-metrics-grid" aria-label="Ключевые показатели смены">
        {model.metrics.map((item) => <SummaryMetricCard item={item} key={item.label} onClick={() => onOpen(item.target)} />)}
      </section>

      <section className="owner-lower-grid">
        <article className="owner-section-card owner-attention-card">
          <div className="owner-section-card__header">
            <h2>Требует внимания</h2>
            <button type="button" onClick={() => model.attentionItems[0] ? onOpen(model.attentionItems[0].target) : onOpen('tasks')}>Все ({model.attentionItems.length})</button>
          </div>
          {model.attentionItems.length ? (
            <div className="owner-attention-list">
              {model.attentionItems.map((item) => (
                <button className="owner-attention owner-clickable-row" type="button" key={`${item.title}-${item.description}`} onClick={() => onOpen(item.target)}>
                  <AttentionIcon tone={item.tone} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <small>{item.time}</small>
                </button>
              ))}
            </div>
          ) : <p className="owner-empty-text">Сейчас нет событий, требующих внимания.</p>}
        </article>

        <article className="owner-section-card owner-employees-card">
          <div className="owner-section-card__header">
            <h2>Сотрудники на смене</h2>
            <button type="button" onClick={() => onOpen('employees')}>Все</button>
          </div>
          {model.shiftEmployees.length ? (
            <div className="owner-employees-list">
              {model.shiftEmployees.map((employee) => (
                <button className="owner-employee owner-clickable-row" type="button" key={employee.name} onClick={() => onOpen('employees')}>
                  <span className="owner-employee__avatar">{employee.initials}</span>
                  <div>
                    <strong>{employee.name}</strong>
                    <p>{employee.role}</p>
                  </div>
                  <small>{employee.zone}</small>
                  <StatusBadge tone={employee.tone}>{employee.status}</StatusBadge>
                </button>
              ))}
            </div>
          ) : <p className="owner-empty-text">Никто не открыл смену.</p>}
        </article>
      </section>
    </>
  )
}

export function OwnerDashboardPage() {
  const { session, logout } = useSession()
  const [section, setSection] = useState<OwnerSection>('dashboard')
  const [globalSearch, setGlobalSearch] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryError, setSummaryError] = useState('')
  const [restaurants, setRestaurants] = useState<Array<Restaurant & { isCurrent?: boolean }>>([])
  const [addRestaurantOpen, setAddRestaurantOpen] = useState(false)
  const userName = session?.user.name ?? 'Пользователь'
  const restaurantName = summary?.restaurant?.name || session?.restaurant.name || 'Ресторан'
  const paymentAccess = getPaymentAccess(summary?.restaurant || session?.restaurant)
  const dashboardModel = useMemo(() => buildDashboardModel(summary), [summary])
  const notifications = dashboardModel.attentionItems

  async function loadSummary() {
    try {
      const nextSummary = await apiRequest<DashboardSummary>('/api/dashboard/summary')
      setSummary(nextSummary)
      setSummaryError('')
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Не удалось загрузить данные главной')
    }
  }

  async function loadRestaurants() {
    try {
      const result = await apiRequest<{ items: Array<Restaurant & { isCurrent?: boolean }> }>('/api/my-restaurants')
      setRestaurants(result.items)
    } catch {
      setRestaurants(summary?.restaurant ? [summary.restaurant] : session?.restaurant ? [session.restaurant] : [])
    }
  }

  async function switchRestaurant(restaurantId: string) {
    await apiRequest(`/api/my-restaurants/${restaurantId}/switch`, { method: 'POST' })
    window.location.reload()
  }

  async function createRestaurant(name: string) {
    await apiRequest('/api/my-restaurants', { method: 'POST', body: JSON.stringify({ name }) })
    window.location.reload()
  }

  useEffect(() => { void loadSummary(); void loadRestaurants() }, [])
  useEffect(() => {
    if (section === 'dashboard') {
      void loadSummary()
      void loadRestaurants()
    }
  }, [section])

  const openSection = (nextSection: OwnerSection) => {
    setSection(nextSection)
    setNotificationsOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = globalSearch.trim().toLowerCase()
    if (!value) return

    if (value.includes('сотруд')) openSection('employees')
    else if (value.includes('чек')) openSection('checklists')
    else if (value.includes('задач')) openSection('tasks')
    else if (value.includes('брон') || value.includes('зал') || value.includes('стол')) openSection('hallBookings')
    else if (value.includes('инвентар') || value.includes('стоп')) openSection('inventory')
    else if (value.includes('ттк') || value.includes('блюд')) openSection('ttk')
    else if (value.includes('знани') || value.includes('обуч')) openSection('knowledge')
    else if (value.includes('оплат') || value.includes('счет') || value.includes('счёт')) openSection('payment')
  }

  const pageCopy: Record<OwnerSection, { title: string; subtitle: string; searchPlaceholder: string }> = {
    dashboard: { title: `Добрый день, ${userName}!`, subtitle: restaurantName, searchPlaceholder: 'Поиск...' },
    employees: { title: 'Сотрудники', subtitle: 'Команда ресторана, должности и рабочий статус', searchPlaceholder: 'Поиск сотрудника...' },
    checklists: { title: 'Чек-листы', subtitle: 'Создание и настройка стандартов работы', searchPlaceholder: 'Поиск чек-листа...' },
    tasks: { title: 'Задачи', subtitle: 'Создание и назначение рабочих задач', searchPlaceholder: 'Поиск задач...' },
    hallBookings: { title: 'План зала / Брони', subtitle: 'Залы, столы, посадочные места и бронирования', searchPlaceholder: 'Поиск...' },
    inventory: { title: 'Инвентаризация', subtitle: 'Бланки, товары, назначения и сданные остатки', searchPlaceholder: 'Поиск по товарам...' },
    ttk: { title: 'ТТК', subtitle: 'Карточки блюд и товаров', searchPlaceholder: 'Поиск по позициям...' },
    knowledge: { title: 'База знаний', subtitle: 'Знакомство, обучение и корпоративная жизнь', searchPlaceholder: 'Поиск по материалам...' },
    payment: { title: 'Оплата', subtitle: 'Тариф, реквизиты, счета и закрывающие документы', searchPlaceholder: 'Поиск по счетам...' },
  }

  const activeLabel = navItems.find((item) => item.section === section)?.label || 'Главная'
  const pageTitle = pageCopy[section].title
  const pageSubtitle = pageCopy[section].subtitle
  const searchPlaceholder = pageCopy[section].searchPlaceholder
  const roleLabel = session?.membership.role === 'owner' ? 'Владелец' : session?.membership.role === 'manager' ? 'Управляющий' : 'Сотрудник'

  return (
    <main className="owner-dashboard">
      <aside className="owner-sidebar">
        <BrandLogo />

        <nav className="owner-nav" aria-label="Главное меню">
          {navItems.map((item) => {
            const isActive = item.label === activeLabel
            return (
              <button className={isActive ? 'owner-nav__item owner-nav__item--active' : 'owner-nav__item'} type="button" key={item.label} onClick={() => openSection(item.section)}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <button className="owner-support-button" type="button" onClick={() => setSupportOpen(true)}>
          <MailIcon />
          <span>Поддержка</span>
        </button>


      </aside>

      <section className="owner-main">
        <header className="owner-topbar">
          <div className="owner-title-block">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>

          {section === 'dashboard' && paymentAccess ? <PaymentAccessBadge paidUntil={paymentAccess.paidUntil} daysLeft={paymentAccess.daysLeft} onClick={() => openSection('payment')} /> : null}

          <div className="owner-topbar__actions">
            <form className="owner-search" onSubmit={handleGlobalSearch}>
              <button className="owner-search__submit" type="submit" aria-label="Найти"><SearchIcon /></button>
              <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder={searchPlaceholder} />
            </form>
            <div className="owner-notifications-wrap">
              <button className="owner-icon-button" type="button" aria-label="Уведомления" onClick={() => setNotificationsOpen((value) => !value)}>
                <BellIcon />
                {notifications.length ? <span>{notifications.length}</span> : null}
              </button>
              {notificationsOpen ? (
                <div className="owner-notifications-popover">
                  <div className="owner-notifications-popover__header">
                    <strong>Уведомления</strong>
                    <small>{notifications.length ? `${notifications.length} событий` : 'нет новых'}</small>
                  </div>
                  {notifications.length ? notifications.map((item) => (
                    <button key={`${item.title}-${item.description}`} type="button" onClick={() => openSection(item.target)}>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      <small>{item.time}</small>
                    </button>
                  )) : <p className="owner-empty-text owner-empty-text--popover">Новых уведомлений нет.</p>}
                </div>
              ) : null}
            </div>
            <button className="owner-profile" type="button" onClick={() => setProfileOpen(true)}>
              <span><UserIcon /></span>
              <div>
                <strong>{userName}</strong>
                <small>{roleLabel}</small>
              </div>
            </button>
            <button className="owner-logout" type="button" onClick={logout} aria-label="Выйти"><LogoutIcon /></button>
          </div>
        </header>

        {section === 'dashboard' ? <RestaurantHeader restaurants={restaurants.length ? restaurants : (summary?.restaurant ? [summary.restaurant] : session?.restaurant ? [session.restaurant] : [])} currentRestaurantId={(summary?.restaurant || session?.restaurant)?.id} onSwitch={switchRestaurant} onAdd={() => setAddRestaurantOpen(true)} /> : null}
        {summaryError ? <div className="owner-action-notice" role="status">{summaryError}</div> : null}

        {section === 'employees' ? <EmployeesPage /> : section === 'checklists' ? <ChecklistsPage /> : section === 'tasks' ? <TasksPage /> : section === 'hallBookings' ? <HallBookingsPage /> : section === 'inventory' ? <InventoryPage /> : section === 'ttk' ? <TtkPage /> : section === 'knowledge' ? <KnowledgeBasePage /> : section === 'payment' ? <PaymentPage /> : <DashboardContent summary={summary} onOpen={openSection} />}
      </section>
      {supportOpen ? <SupportDialog onClose={() => setSupportOpen(false)} /> : null}
      {profileOpen ? <ProfileDialog userName={userName} login={session?.user.login} roleLabel={roleLabel} restaurantName={restaurantName} onClose={() => setProfileOpen(false)} /> : null}
      {addRestaurantOpen ? <AddRestaurantDialog onClose={() => setAddRestaurantOpen(false)} onCreated={createRestaurant} /> : null}
    </main>
  )
}
