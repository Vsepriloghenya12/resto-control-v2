import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { api, apiRequest } from '../../shared/api/client'
import {
  AlertCircleIcon,
  BellIcon,
  BookIcon,
  BoxIcon,
  CalendarIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ClipboardIcon,
  ClockIcon,
  LogoutIcon,
  MailIcon,
  OverviewIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from '../../shared/ui/Icon'
import './EmployeeStartPage.css'

type MobileTab = 'overview' | 'tasks' | 'request' | 'checklists' | 'hallPlan'
type DetailKind = 'task' | 'checklist' | 'inventory' | 'notification' | 'knowledge' | 'guest' | 'support' | null
type HallStatus = 'free' | 'reserved' | 'arrived' | 'occupied' | 'disabled'
type HallMode = 'tables' | 'bookings'
type HallFilter = 'all' | HallStatus

type Task = { id: string; title: string; description?: string; status?: string; assignedPosition?: string; dueTime?: string; dueDate?: string; requiresPhoto?: boolean }
type Checklist = { id: string; title: string; position?: string; active?: boolean; startTime?: string; endTime?: string; items?: Array<{ id: string; title: string; required?: boolean; requiresCompletionPhoto?: boolean }> }
type InventoryAssignment = { id: string; title: string; section?: string; status?: string; assignedPosition?: string; dueDate?: string; rowsCount?: number }
type Knowledge = { id: string; title: string; section?: string; type?: string; description?: string; status?: string }
type Guest = { id: string; name: string; phone?: string; preferences?: string; restrictions?: string; favoriteTable?: string; serviceComment?: string }
type TechRequest = { id: string; title: string; description?: string; priority?: string; status?: string }

type DashboardSummary = {
  restaurant: { id: string; name: string }
  employees?: Array<{ id: string; userId?: string; name: string; position: string; shiftStatus?: string; status?: string }>
  tasks?: Task[]
  checklists?: Checklist[]
  bookings?: Array<{ id: string; guestName?: string; status?: string; time?: string; guestsCount?: number }>
  technicalRequests?: TechRequest[]
  inventoryAssignments?: InventoryAssignment[]
  knowledgeMaterials?: Knowledge[]
  guests?: Guest[]
}

type MobileHall = { id: string; name: string; tablesCount: number }
type MobileBooking = { id: string; guestName: string; phone?: string; time: string; guestsCount: number; status: 'new' | 'confirmed' | 'arrived' | 'seated' | 'cancelled' | 'no_show'; comment?: string }
type MobileHallTable = { id: string; hallId: string; name: string; seats: number; status: HallStatus; booking?: MobileBooking }
type DetailState = { kind: DetailKind; title: string; subtitle?: string; body?: ReactNode; actions?: ReactNode }

function getHallStatusLabel(status: HallStatus) {
  const labels: Record<HallStatus, string> = {
    free: 'Свободен',
    reserved: 'Подтверждена',
    arrived: 'Пришли по брони',
    occupied: 'Гости сели',
    disabled: 'Недоступен',
  }
  return labels[status]
}

function getBookingStatusLabel(status: MobileBooking['status']) {
  const labels: Record<MobileBooking['status'], string> = {
    new: 'Новая',
    confirmed: 'Подтверждена',
    arrived: 'Пришли по брони',
    seated: 'Гости сели',
    cancelled: 'Отменена',
    no_show: 'Не пришли',
  }
  return labels[status]
}

function statusText(status?: string) {
  if (status === 'done') return 'Выполнена'
  if (status === 'in_progress') return 'В работе'
  if (status === 'overdue') return 'Просрочена'
  if (status === 'assigned') return 'Назначена'
  if (status === 'draft') return 'Черновик'
  if (status === 'closed') return 'Закрыта'
  if (status === 'new') return 'Новая'
  return 'Не начата'
}

function samePosition(itemPosition: string | undefined, employeePosition: string) {
  if (!itemPosition) return true
  return itemPosition.toLowerCase() === employeePosition.toLowerCase()
}

function getTone(status?: string): 'green' | 'orange' | 'blue' | 'red' | 'purple' {
  if (status === 'done' || status === 'closed') return 'green'
  if (status === 'overdue') return 'red'
  if (status === 'in_progress' || status === 'assigned') return 'orange'
  if (status === 'draft') return 'purple'
  return 'blue'
}


function ChecklistRunPanel({ checklist, onSaved }: { checklist: Checklist; onSaved: () => Promise<void> }) {
  const [progress, setProgress] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const items = checklist.items || []
  const doneCount = items.filter((item) => progress[item.id]).length

  async function saveRun() {
    setSaving(true)
    await api.create('checklist-runs', {
      checklistId: checklist.id,
      title: checklist.title,
      position: checklist.position,
      status: doneCount === items.length ? 'completed' : 'in_progress',
      completedItems: doneCount,
      totalItems: items.length,
      items: items.map((item) => ({ ...item, done: Boolean(progress[item.id]) })),
      submittedAt: new Date().toISOString(),
    })
    await onSaved()
    setSaving(false)
  }

  return (
    <div className="employee-mobile__checklist-run">
      <p className="employee-mobile__run-progress">Выполнено {doneCount} из {items.length}</p>
      <div className="employee-mobile__detail-list">
        {items.length ? items.map((item, index) => (
          <button key={item.id || item.title} className={progress[item.id] ? 'employee-mobile__detail-item employee-mobile__detail-item--done' : 'employee-mobile__detail-item'} type="button" onClick={() => setProgress((current) => ({ ...current, [item.id]: !current[item.id] }))}>
            <strong>{index + 1}. {item.title}</strong>
            <span>{progress[item.id] ? 'Выполнено' : item.required ? 'Обязательный' : 'Необязательный'}{item.requiresCompletionPhoto ? ' · нужно фото' : ''}</span>
          </button>
        )) : <p>Пункты чек-листа ещё не настроены.</p>}
      </div>
      <div className="employee-mobile__sheet-actions">
        <button type="button" onClick={() => void saveRun()} disabled={!items.length || saving}>{saving ? 'Сохраняю...' : 'Сохранить прохождение'}</button>
      </div>
    </div>
  )
}

export function EmployeeStartPage() {
  const { session, logout } = useSession()
  const [activeTab, setActiveTab] = useState<MobileTab>('overview')
  const [shiftOpen, setShiftOpen] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [halls, setHalls] = useState<MobileHall[]>([])
  const [hallTables, setHallTables] = useState<MobileHallTable[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [hallMode, setHallMode] = useState<HallMode>('tables')
  const [hallFilter, setHallFilter] = useState<HallFilter>('all')
  const [selectedTable, setSelectedTable] = useState<MobileHallTable | null>(null)
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [notice, setNotice] = useState('')

  const employee = {
    name: session?.user.name || 'Сотрудник',
    position: session?.membership.position || (session?.membership.role === 'manager' ? 'Управляющий' : 'Сотрудник'),
    restaurantName: summary?.restaurant.name || session?.restaurant.name || 'Ресторан',
    isManager: session?.membership.role === 'manager' || session?.membership.role === 'owner',
  }

  const userTasks = useMemo(() => {
    const tasks = summary?.tasks || []
    if (employee.isManager) return tasks
    return tasks.filter((item) => samePosition(item.assignedPosition, employee.position))
  }, [employee.isManager, employee.position, summary?.tasks])

  const userChecklists = useMemo(() => {
    const checklists = summary?.checklists || []
    if (employee.isManager) return checklists.filter((item) => item.active !== false)
    return checklists.filter((item) => item.active !== false && samePosition(item.position, employee.position))
  }, [employee.isManager, employee.position, summary?.checklists])

  const userInventory = useMemo(() => {
    const assignments = summary?.inventoryAssignments || []
    if (employee.isManager) return assignments.filter((item) => item.status !== 'submitted' && item.status !== 'done')
    return assignments.filter((item) => samePosition(item.assignedPosition, employee.position) && item.status !== 'submitted' && item.status !== 'done')
  }, [employee.isManager, employee.position, summary?.inventoryAssignments])

  const notifications = useMemo(() => {
    const items: Array<{ title: string; text: string; target: MobileTab; detail: DetailState }> = []
    userTasks.filter((item) => item.status === 'overdue').slice(0, 3).forEach((task) => {
      items.push({ title: task.title, text: 'Просроченная задача', target: 'tasks', detail: taskDetail(task) })
    })
    userInventory.slice(0, 2).forEach((item) => {
      items.push({ title: item.title, text: item.section || 'Инвентаризация назначена', target: 'overview', detail: inventoryDetail(item) })
    })
    ;(summary?.bookings || []).filter((booking) => ['new', 'confirmed', 'arrived'].includes(String(booking.status || ''))).slice(0, 3).forEach((booking) => {
      items.push({ title: booking.guestName ? `Бронь: ${booking.guestName}` : 'Бронь на сегодня', text: `${booking.time || 'время не указано'} · ${booking.guestsCount || 1} гостей`, target: 'hallPlan', detail: { kind: 'notification', title: booking.guestName || 'Бронь', subtitle: `${booking.time || ''} · ${booking.guestsCount || 1} гостей` } })
    })
    return items
  }, [summary?.bookings, userInventory, userTasks])

  async function loadData() {
    const nextSummary = await apiRequest<DashboardSummary>('/api/dashboard/summary')
    setSummary(nextSummary)
    const currentEmployee = nextSummary.employees?.find((item) => item.userId === session?.user.id || item.name === session?.user.name)
    if (currentEmployee?.shiftStatus) setShiftOpen(currentEmployee.shiftStatus === 'open')
  }

  async function loadHallPlan() {
    const result = await apiRequest<{ halls: Array<{ id: string; name: string; tablesCount?: number }>; tables: Array<{ id: string; hallId: string; name: string; seats: number; status: HallStatus }>; bookings: Array<{ id: string; tableId: string; guestName: string; phone?: string; time: string; guestsCount: number; status: MobileBooking['status']; comment?: string }> }>('/api/mobile/hall-plan')
    const nextTables = result.tables.map((table) => {
      const booking = result.bookings.find((item) => item.tableId === table.id && !['cancelled', 'no_show'].includes(item.status))
      return { ...table, booking: booking ? { ...booking, phone: booking.phone || '', comment: booking.comment || '' } : undefined }
    })
    const nextHalls = result.halls.map((hall) => ({ id: hall.id, name: hall.name, tablesCount: hall.tablesCount || nextTables.filter((table) => table.hallId === hall.id).length }))
    setHalls(nextHalls)
    setHallTables(nextTables)
    setSelectedHallId((current) => current && nextHalls.some((hall) => hall.id === current) ? current : nextHalls[0]?.id || '')
  }



  async function toggleShift() {
    const nextOpen = !shiftOpen
    setShiftOpen(nextOpen)
    try {
      await apiRequest('/api/mobile/shift', { method: 'PATCH', body: JSON.stringify({ open: nextOpen }) })
      setNotice(nextOpen ? 'Смена открыта.' : 'Смена закрыта.')
      await loadData()
    } catch (error) {
      setShiftOpen(!nextOpen)
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить смену.')
    }
  }

  useEffect(() => {
    void loadData().catch(() => setNotice('Не удалось загрузить данные смены.'))
    void loadHallPlan().catch(() => undefined)
  }, [])

  function taskDetail(task: Task): DetailState {
    return {
      kind: 'task',
      title: task.title,
      subtitle: statusText(task.status),
      body: (
        <div className="employee-mobile__detail-text">
          <p>{task.description || 'Описание задачи не заполнено.'}</p>
          <span>Должность: {task.assignedPosition || 'любая'}</span>
          <span>Срок: {task.dueTime || 'не указан'}</span>
          {task.requiresPhoto ? <span>Для закрытия нужно фото.</span> : null}
        </div>
      ),
      actions: task.status === 'done' ? null : <button type="button" onClick={() => completeTask(task.id)}>Отметить выполненной</button>,
    }
  }

  function checklistDetail(checklist: Checklist): DetailState {
    return {
      kind: 'checklist',
      title: checklist.title,
      subtitle: `${checklist.startTime || '—'} — ${checklist.endTime || '—'}`,
      body: <ChecklistRunPanel checklist={checklist} onSaved={async () => { setNotice('Прохождение чек-листа сохранено.'); setDetail(null); await loadData() }} />,
    }
  }

  function inventoryDetail(item: InventoryAssignment): DetailState {
    return {
      kind: 'inventory',
      title: item.title,
      subtitle: item.section || 'Инвентаризация',
      body: (
        <div className="employee-mobile__detail-text">
          <span>Статус: {statusText(item.status)}</span>
          <span>Строк: {item.rowsCount || 0}</span>
          <span>Срок: {item.dueDate || 'не указан'}</span>
        </div>
      ),
      actions: <button type="button" onClick={() => submitInventory(item.id)}>Отметить как сданную</button>,
    }
  }

  function knowledgeDetail(item: Knowledge): DetailState {
    return {
      kind: 'knowledge',
      title: item.title,
      subtitle: item.type || 'Материал базы знаний',
      body: (
        <div className="employee-mobile__detail-text">
          <p>{item.description || 'Описание материала не заполнено.'}</p>
          <span>Раздел: {item.section || 'база знаний'}</span>
          <span>Статус: {statusText(item.status)}</span>
        </div>
      ),
    }
  }

  function guestDetail(guest: Guest): DetailState {
    return {
      kind: 'guest',
      title: guest.name,
      subtitle: guest.phone || 'Постоянный гость',
      body: (
        <div className="employee-mobile__detail-text">
          <span>Предпочтения: {guest.preferences || 'не указаны'}</span>
          <span>Ограничения: {guest.restrictions || 'нет'}</span>
          <span>Любимый стол: {guest.favoriteTable || 'не указан'}</span>
          <p>{guest.serviceComment || 'Комментарий для сервиса не заполнен.'}</p>
        </div>
      ),
      actions: guest.phone ? <button type="button" onClick={() => window.location.href = `tel:${guest.phone}`}>Позвонить</button> : undefined,
    }
  }

  function knowledgeListDetail(): DetailState {
    const materials = summary?.knowledgeMaterials || []
    return {
      kind: 'knowledge',
      title: 'База знаний',
      subtitle: employee.restaurantName,
      body: (
        <div className="employee-mobile__detail-list">
          {materials.length ? materials.map((item) => (
            <button key={item.id} type="button" onClick={() => setDetail(knowledgeDetail(item))}>
              <strong>{item.title}</strong>
              <span>{item.description || item.type || 'Материал'}</span>
            </button>
          )) : <p>Материалы ещё не добавлены управляющим.</p>}
        </div>
      ),
    }
  }

  function guestsListDetail(): DetailState {
    const guests = summary?.guests || []
    return {
      kind: 'guest',
      title: 'Постоянные гости',
      subtitle: employee.restaurantName,
      body: (
        <div className="employee-mobile__detail-list">
          {guests.length ? guests.map((guest) => (
            <button key={guest.id} type="button" onClick={() => setDetail(guestDetail(guest))}>
              <strong>{guest.name}</strong>
              <span>{guest.preferences || guest.serviceComment || guest.phone || 'Карточка гостя'}</span>
            </button>
          )) : <p>Постоянные гости ещё не добавлены.</p>}
        </div>
      ),
    }
  }

  function supportDetail(): DetailState {
    return {
      kind: 'support',
      title: 'Поддержка',
      subtitle: 'Создайте заявку или напишите управляющему',
      body: <div className="employee-mobile__detail-text"><p>Для технической проблемы нажмите центральную кнопку «Тех. заявка». По срочному вопросу можно написать в поддержку.</p></div>,
      actions: <button type="button" onClick={async () => { await api.create('technical-requests', { title: 'Обращение в поддержку', description: 'Запрос помощи из мобильного приложения', area: 'Поддержка', priority: 'medium', status: 'new', createdByPosition: employee.position }); setNotice('Обращение создано.'); setDetail(null) }}>Создать обращение</button>,
    }
  }

  async function completeTask(id: string) {
    await api.update('tasks', id, { status: 'done' })
    setNotice('Задача выполнена.')
    setDetail(null)
    await loadData()
  }

  async function submitInventory(id: string) {
    await api.update('inventory-assignments', id, { status: 'submitted', submittedAt: new Date().toISOString() })
    setNotice('Инвентаризация отмечена как сданная.')
    setDetail(null)
    await loadData()
  }

  async function updateSelectedBookingStatus(status: MobileBooking['status']) {
    if (!selectedTable?.booking) return
    await api.bookingStatus(selectedTable.booking.id, status)
    await loadHallPlan()
    setSelectedTable(null)
  }

  async function seatWalkIn(table: MobileHallTable | null) {
    if (!table) return
    const booking = await api.create<MobileBooking>('bookings', {
      hallId: table.hallId,
      tableId: table.id,
      guestName: 'Гости без брони',
      phone: '',
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      guestsCount: table.seats || 1,
      status: 'seated',
      comment: 'Посадка без предварительной брони',
    })
    await api.bookingStatus(booking.id, 'seated')
    setNotice('Гости посажены за стол.')
    await loadHallPlan()
    setSelectedTable(null)
  }

  const selectedHall = halls.find((hall) => hall.id === selectedHallId) ?? halls[0]
  const visibleHallTables = hallTables.filter((table) => {
    if (table.hallId !== selectedHallId) return false
    if (hallFilter === 'all') return true
    return table.status === hallFilter
  })
  const visibleBookings = visibleHallTables.filter((table) => table.booking).sort((a, b) => String(a.booking?.time).localeCompare(String(b.booking?.time)))

  const overviewCards = [
    ...userChecklists.slice(0, 1).map((checklist) => ({ id: `checklist-${checklist.id}`, title: checklist.title, subtitle: `${checklist.items?.length || 0} пунктов`, meta: `${checklist.startTime || '—'} — ${checklist.endTime || '—'}`, tone: 'orange' as const, icon: <ChecklistIcon />, onClick: () => setDetail(checklistDetail(checklist)) })),
    { id: 'tasks', title: 'Задачи', subtitle: `${userTasks.filter((item) => item.status !== 'done').length} активные`, meta: userTasks.some((item) => item.status === 'overdue') ? 'есть просроченные' : 'без просрочек', tone: 'blue' as const, icon: <ClipboardIcon />, onClick: () => setActiveTab('tasks') },
    ...userInventory.slice(0, 1).map((item) => ({ id: `inventory-${item.id}`, title: 'Инвентаризация', subtitle: item.title, meta: item.section || 'назначена', tone: 'green' as const, icon: <BoxIcon />, onClick: () => setDetail(inventoryDetail(item)) })),
    { id: 'hall', title: 'План зала', subtitle: `${(summary?.bookings || []).length} броней`, meta: `${halls.length} залов`, tone: 'purple' as const, icon: <CalendarIcon />, onClick: () => setActiveTab('hallPlan') },
  ]

  const infoCards = [
    { id: 'knowledge', title: 'База знаний', subtitle: `${summary?.knowledgeMaterials?.length || 0} материалов`, meta: 'обучение и правила', tone: 'blue' as const, icon: <BookIcon />, onClick: () => setDetail(knowledgeListDetail()) },
    { id: 'guests', title: 'Постоянные гости', subtitle: `${summary?.guests?.length || 0} гостей`, meta: 'предпочтения и заметки', tone: 'green' as const, icon: <UserIcon />, onClick: () => setDetail(guestsListDetail()) },
    { id: 'support', title: 'Поддержка', subtitle: 'заявки и помощь', meta: 'открыть диалог', tone: 'orange' as const, icon: <MailIcon />, onClick: () => setDetail(supportDetail()) },
  ]

  function renderOverview() {
    return (
      <>
        <section className="employee-mobile__shift-card">
          <div className="employee-mobile__shift-status">
            <div className={shiftOpen ? 'employee-mobile__shift-icon employee-mobile__shift-icon--open' : 'employee-mobile__shift-icon'}><ClockIcon /></div>
            <div>
              <strong>{shiftOpen ? 'Смена открыта' : 'Смена не открыта'}</strong>
              <span>{shiftOpen ? 'Рабочий день активен' : 'Откройте смену перед работой'}</span>
            </div>
          </div>
          <button className={shiftOpen ? 'employee-mobile__shift-button' : 'employee-mobile__shift-button employee-mobile__shift-button--primary'} type="button" onClick={() => void toggleShift()}>
            {shiftOpen ? 'Закрыть смену' : 'Открыть смену'}
          </button>
        </section>

        <section className="employee-mobile__section">
          <div className="employee-mobile__section-title"><h2>Сегодня</h2></div>
          <div className="employee-mobile__card-list">
            {overviewCards.map((card) => (
              <button key={card.id} className={`employee-mobile__work-card employee-mobile__work-card--${card.tone}`} type="button" onClick={card.onClick}>
                <div className="employee-mobile__work-icon">{card.icon}</div>
                <div className="employee-mobile__work-content">
                  <strong>{card.title}</strong>
                  <p>{card.subtitle}</p>
                  <small>{card.meta}</small>
                </div>
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        </section>

        <section className="employee-mobile__section">
          <div className="employee-mobile__section-title"><h2>Материалы и связь</h2></div>
          <div className="employee-mobile__card-list">
            {infoCards.map((card) => (
              <button key={card.id} className={`employee-mobile__work-card employee-mobile__work-card--${card.tone}`} type="button" onClick={card.onClick}>
                <div className="employee-mobile__work-icon">{card.icon}</div>
                <div className="employee-mobile__work-content"><strong>{card.title}</strong><p>{card.subtitle}</p><small>{card.meta}</small></div>
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        </section>

        <section className="employee-mobile__section">
          <div className="employee-mobile__section-title">
            <h2>Уведомления</h2>
            <button type="button" onClick={() => setShowNotifications(true)}>Все</button>
          </div>
          {notifications.length ? (
            <button className="employee-mobile__alert-card" type="button" onClick={() => { setActiveTab(notifications[0].target); setDetail(notifications[0].detail) }}>
              <div className="employee-mobile__alert-icon"><AlertCircleIcon /></div>
              <div className="employee-mobile__alert-content"><strong>{notifications[0].title}</strong><span>{notifications[0].text}</span></div>
              <ChevronRightIcon />
            </button>
          ) : <p className="employee-mobile__empty">Новых событий нет.</p>}
        </section>
      </>
    )
  }

  function renderTasks() {
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title"><h2>Мои задачи</h2></div>
        <div className="employee-mobile__plain-list">
          {userTasks.length ? userTasks.map((task) => (
            <button key={task.id} className="employee-mobile__list-card employee-mobile__list-card--chevron" type="button" onClick={() => setDetail(taskDetail(task))}>
              <div><strong>{task.title}</strong><p className={task.status === 'overdue' ? 'employee-mobile__danger' : ''}>{statusText(task.status)}</p><small>{task.dueTime || 'срок не указан'}</small></div>
              <ChevronRightIcon />
            </button>
          )) : <p className="employee-mobile__empty">Для вашей должности задач нет.</p>}
        </div>
      </section>
    )
  }

  function renderChecklists() {
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title"><h2>Чек-листы</h2></div>
        <div className="employee-mobile__plain-list">
          {userChecklists.length ? userChecklists.map((item) => (
            <button key={item.id} className="employee-mobile__list-card employee-mobile__list-card--chevron" type="button" onClick={() => setDetail(checklistDetail(item))}>
              <div><strong>{item.title}</strong><p>{item.items?.length || 0} пунктов</p><small>{item.startTime || '—'} — {item.endTime || '—'}</small></div>
              <ChevronRightIcon />
            </button>
          )) : <p className="employee-mobile__empty">Для вашей должности нет активных чек-листов.</p>}
        </div>
      </section>
    )
  }

  function renderHallPlan() {
    const filters: Array<{ value: HallFilter; label: string }> = [
      { value: 'all', label: 'Все' },
      { value: 'free', label: 'Свободные' },
      { value: 'reserved', label: 'Брони' },
      { value: 'arrived', label: 'Пришли' },
      { value: 'occupied', label: 'Сели' },
    ]

    return (
      <section className="employee-mobile__hall-page">
        <div className="employee-mobile__hall-header">
          <div><h2>План зала</h2><p>{employee.restaurantName}</p></div>
          <button type="button" className="employee-mobile__hall-search" aria-label="Обновить" onClick={() => { void loadHallPlan(); setNotice('План зала обновлён.') }}><SearchIcon /></button>
        </div>

        <div className="employee-mobile__hall-tabs" aria-label="Залы">
          {halls.map((hall) => <button type="button" key={hall.id} className={hall.id === selectedHallId ? 'is-active' : ''} onClick={() => { setSelectedHallId(hall.id); setHallFilter('all'); setSelectedTable(null) }}><strong>{hall.name}</strong><span>{hall.tablesCount} столов</span></button>)}
        </div>

        <div className="employee-mobile__hall-mode" aria-label="Режим плана зала">
          <button type="button" className={hallMode === 'tables' ? 'is-active' : ''} onClick={() => setHallMode('tables')}>Столы</button>
          <button type="button" className={hallMode === 'bookings' ? 'is-active' : ''} onClick={() => setHallMode('bookings')}>Брони</button>
        </div>

        <div className="employee-mobile__hall-filters" aria-label="Фильтр столов">
          {filters.map((filter) => <button type="button" key={filter.value} className={hallFilter === filter.value ? 'is-active' : ''} onClick={() => setHallFilter(filter.value)}>{filter.label}</button>)}
        </div>

        {hallMode === 'tables' ? (
          <div className="employee-mobile__hall-grid">
            {visibleHallTables.length ? visibleHallTables.map((table) => (
              <button type="button" key={table.id} className={`employee-mobile__table-card employee-mobile__table-card--${table.status}`} onClick={() => setSelectedTable(table)}>
                <div><strong>{table.name}</strong><span>{table.seats} места</span></div>
                <p>{table.booking ? `${table.booking.time} · ${table.booking.guestName}` : 'Без брони'}</p>
                <small>{getHallStatusLabel(table.status)}</small>
              </button>
            )) : <p className="employee-mobile__empty">Столы не настроены.</p>}
          </div>
        ) : (
          <div className="employee-mobile__booking-list">
            {visibleBookings.length ? visibleBookings.map((table) => (
              <button type="button" key={table.id} onClick={() => setSelectedTable(table)}>
                <time>{table.booking?.time}</time>
                <div><strong>{table.booking?.guestName}</strong><span>{table.name} · {table.booking?.guestsCount || 1} гостей</span></div>
                <small className={`employee-mobile__booking-status employee-mobile__booking-status--${table.status}`}>{table.booking ? getBookingStatusLabel(table.booking.status) : getHallStatusLabel(table.status)}</small>
              </button>
            )) : <p className="employee-mobile__empty">Активных броней нет.</p>}
          </div>
        )}
      </section>
    )
  }


  return (
    <main className="employee-mobile">
      <header className="employee-mobile__header">
        <div><h1>Доброе утро, {employee.name}!</h1><p>{employee.position} · {employee.restaurantName}</p></div>
        <div className="employee-mobile__header-actions">
          <button type="button" onClick={() => setShowNotifications(true)} aria-label="Уведомления"><BellIcon />{notifications.length ? <b>{notifications.length}</b> : null}</button>
        </div>
      </header>

      {notice ? <button className="employee-mobile__notice" type="button" onClick={() => setNotice('')}>{notice}</button> : null}

      <section className="employee-mobile__content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'checklists' && renderChecklists()}
        {activeTab === 'hallPlan' && renderHallPlan()}
      </section>

      <nav className="employee-mobile__bottom-nav employee-mobile__bottom-nav--compact" aria-label="Нижнее меню">
        <button type="button" className={activeTab === 'overview' ? 'is-active' : ''} onClick={() => setActiveTab('overview')}><OverviewIcon /><span>Обзор</span></button>
        <button type="button" className={activeTab === 'tasks' ? 'is-active' : ''} onClick={() => setActiveTab('tasks')}><ClipboardIcon /><span>Задачи</span></button>
        <button type="button" className="employee-mobile__plus-button" onClick={() => setShowRequestModal(true)}><span><PlusIcon /></span><strong>Заявка</strong></button>
        <button type="button" className={activeTab === 'checklists' ? 'is-active' : ''} onClick={() => setActiveTab('checklists')}><ChecklistIcon /><span>Чек-листы</span></button>
        <button type="button" className={activeTab === 'hallPlan' ? 'is-active' : ''} onClick={() => setActiveTab('hallPlan')}><CalendarIcon /><span>Зал</span></button>
      </nav>

      {selectedTable ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setSelectedTable(null)}>
          <div className="employee-mobile__sheet employee-mobile__hall-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__hall-sheet-title"><div><strong>{selectedTable.name}</strong><p>{selectedHall?.name || 'Зал'} · {selectedTable.seats} места</p></div><button type="button" onClick={() => setSelectedTable(null)}>×</button></div>
            {selectedTable.booking ? <div className="employee-mobile__booking-card"><small>Бронь на сегодня</small><strong>{selectedTable.booking.guestName}</strong><p>{selectedTable.booking.time} · {selectedTable.booking.guestsCount} гостей</p>{selectedTable.booking.phone ? <span>Телефон: {selectedTable.booking.phone}</span> : null}{selectedTable.booking.comment ? <span>Комментарий: {selectedTable.booking.comment}</span> : null}</div> : <div className="employee-mobile__booking-card"><small>Бронь на сегодня</small><strong>Брони нет</strong><p>{selectedTable.status === 'disabled' ? 'Стол недоступен' : 'Стол свободен для посадки'}</p></div>}
            <div className="employee-mobile__hall-actions">
              {selectedTable.booking ? <>
                <button type="button" className="employee-mobile__hall-actions-blue" onClick={() => updateSelectedBookingStatus('arrived')}>Пришли</button>
                <button type="button" className="employee-mobile__hall-actions-purple" onClick={() => updateSelectedBookingStatus('seated')}>Гости сели</button>
                {selectedTable.booking.phone ? <button type="button" onClick={() => { window.location.href = `tel:${selectedTable.booking?.phone}` }}>Позвонить</button> : null}
                <button type="button" className="employee-mobile__hall-actions-red" onClick={() => updateSelectedBookingStatus('no_show')}>Не пришли</button>
              </> : <button type="button" className="employee-mobile__hall-actions-green" onClick={() => { void seatWalkIn(selectedTable) }}>Посадить гостей</button>}
            </div>
          </div>
        </div>
      ) : null}

      {showNotifications ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setShowNotifications(false)}>
          <div className="employee-mobile__sheet" onClick={(event) => event.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__sheet-title"><strong>Уведомления</strong><p>Важные события по смене</p></div>
            <div className="employee-mobile__notification-list">
              {notifications.length ? notifications.map((item) => <button key={`${item.title}-${item.text}`} type="button" onClick={() => { setShowNotifications(false); setActiveTab(item.target); setDetail(item.detail) }}><strong>{item.title}</strong><span>{item.text}</span></button>) : <p className="employee-mobile__empty">Новых уведомлений нет.</p>}
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setDetail(null)}>
          <div className="employee-mobile__sheet" onClick={(event) => event.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__sheet-title"><strong>{detail.title}</strong>{detail.subtitle ? <p>{detail.subtitle}</p> : null}</div>
            {detail.body}
            {detail.actions ? <div className="employee-mobile__sheet-actions">{detail.actions}</div> : null}
          </div>
        </div>
      ) : null}

      {showRequestModal ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setShowRequestModal(false)}>
          <div className="employee-mobile__sheet employee-mobile__sheet--form" onClick={(event) => event.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__sheet-title"><strong>Новая тех. заявка</strong><p>Сообщите о проблеме по оборудованию или расходникам</p></div>
            {requestSubmitted ? <div className="employee-mobile__request-success"><strong>Заявка создана</strong><p>Техническая заявка отправлена управляющему.</p><button type="button" onClick={() => { setRequestSubmitted(false); setShowRequestModal(false); void loadData() }}>Готово</button></div> : (
              <form className="employee-mobile__request-form" onSubmit={async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); await api.create('technical-requests', { category: String(formData.get('category') || 'Оборудование'), title: String(formData.get('title') || 'Тех. заявка'), description: String(formData.get('description') || ''), area: String(formData.get('area') || ''), status: 'new', priority: 'medium', createdByPosition: employee.position }); setRequestSubmitted(true) }}>
                <label><span>Категория</span><select name="category" defaultValue="Оборудование"><option>Оборудование</option><option>Клининг</option><option>Расходники</option><option>Электрика</option><option>Мебель</option></select></label>
                <label><span>Зона</span><input name="area" placeholder="Например: бар, зал, вход" /></label>
                <label><span>Коротко о проблеме</span><input name="title" placeholder="Например: не работает лампа" /></label>
                <label><span>Описание</span><textarea name="description" rows={4} placeholder="Что случилось и где именно" /></label>
                <button type="submit">Создать заявку</button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}
