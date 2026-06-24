import { useEffect, useMemo, useRef, useState } from 'react'
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
  ChevronLeftIcon,
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

type MobileTab = 'overview' | 'tasks' | 'checklists' | 'hallPlan' | 'ttk' | 'knowledge' | 'schedule' | 'orders' | 'attestation'

type AttestationQuestion = { id: string; text: string; options: string[]; correctIndex: number }
type Attestation = {
  id: string
  title: string
  type: 'full' | 'menu' | 'knowledge'
  status: 'active' | 'completed'
  employeeIds: string[]
  deadline: string | null
  questions: AttestationQuestion[]
  createdAt: string
}

type Order = {
  id: string
  restaurantId: string
  tableId: string | null
  tableName: string
  hallId: string | null
  guestsCount: number
  comment: string
  items: OrderCartItem[]
  total: number
  status: 'new' | 'in_progress' | 'done' | 'cancelled'
  createdByName: string
  createdByPosition: string
  createdAt: string
}
type DetailKind = 'task' | 'checklist' | 'inventory' | 'notification' | 'knowledge' | 'guest' | 'support' | 'ttk' | 'stopList' | 'schedule' | null
type HallStatus = 'free' | 'reserved' | 'arrived' | 'occupied' | 'disabled'
type HallMode = 'tables' | 'bookings'
type HallFilter = 'all' | HallStatus

type Task = { id: string; title: string; description?: string; status?: string; assignedPosition?: string; dueTime?: string; dueDate?: string; requiresPhoto?: boolean }
type Checklist = { id: string; title: string; position?: string; active?: boolean; startTime?: string; endTime?: string; items?: Array<{ id: string; title: string; required?: boolean; requiresCompletionPhoto?: boolean }> }
type InventoryAssignment = { id: string; title: string; section?: string; status?: string; assignedPosition?: string; dueDate?: string; rowsCount?: number }
type Knowledge = { id: string; title: string; section?: string; type?: string; description?: string; status?: string }
type TtkItem = { id: string; name: string; group?: string; groupId?: string; unit?: string; price?: number; tag?: string; description?: string; cookingTime?: string; output?: string; online?: boolean; takeaway?: boolean; stopList?: boolean; inStopList?: boolean; isStopped?: boolean; status?: string }
type TtkGroup = { id: string; name: string }
type OrderCartItem = { itemId: string; name: string; price: number; quantity: number; comment?: string }
type Guest = { id: string; name: string; phone?: string; preferences?: string; restrictions?: string; favoriteTable?: string; serviceComment?: string }
type TechRequest = { id: string; title: string; description?: string; priority?: string; status?: string }
type StaffSchedule = { id: string; employeeId: string; employeeName?: string; position?: string; month: string; day: number; value?: string; note?: string }

type DashboardSummary = {
  restaurant: { id: string; name: string }
  employees?: Array<{ id: string; userId?: string; name: string; position: string; shiftStatus?: string; status?: string; responsibilities?: string; responsibilityComment?: string; reportsTo?: string }>
  tasks?: Task[]
  checklists?: Checklist[]
  bookings?: Array<{ id: string; guestName?: string; status?: string; time?: string; guestsCount?: number }>
  technicalRequests?: TechRequest[]
  inventoryAssignments?: InventoryAssignment[]
  knowledgeMaterials?: Knowledge[]
  guests?: Guest[]
  ttkItems?: TtkItem[]
  staffSchedules?: StaffSchedule[]
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

function getCurrentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getScheduleDateLabel(month: string, day: number) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }).format(new Date(year, monthIndex - 1, day))
}

function getScheduleSortValue(item: StaffSchedule) {
  return Number(String(item.month).replace('-', '') + String(item.day).padStart(2, '0'))
}

const mobileLeaderPositions = ['Владелец', 'Управляющий', 'Администратор', 'Шеф-повар', 'Су-шеф', 'Старший официант', 'Старший бармен']
const mobileHierarchyOrder = ['Руководители', 'Зал', 'Бар', 'Кухня', 'Клининг', 'Доставка', 'Остальные']

function getMobileHierarchyGroup(position: string) {
  if (mobileLeaderPositions.includes(position)) return 'Руководители'
  const value = position.toLowerCase()
  if (value.includes('бар')) return 'Бар'
  if (value.includes('повар') || value.includes('шеф')) return 'Кухня'
  if (value.includes('клининг') || value.includes('убор') || value.includes('мойщик')) return 'Клининг'
  if (value.includes('курьер')) return 'Доставка'
  if (value.includes('официант') || value.includes('хостес')) return 'Зал'
  return 'Остальные'
}

function getMobileDefaultResponsibilities(position: string) {
  if (position === 'Управляющий') return '* Контроль смены\n* Команда и дисциплина\n* График и задачи'
  if (position === 'Администратор') return '* План зала\n* Брони и посадка гостей\n* Открытие и закрытие смены'
  if (position === 'Старший официант') return '* Официанты на смене\n* Сервис в зале\n* Чек-листы зала'
  if (position === 'Старший бармен') return '* Бар\n* Заготовки бара\n* Стоп-лист напитков'
  if (position === 'Шеф-повар') return '* Кухня\n* Качество блюд\n* Стоп-лист кухни'
  if (position === 'Су-шеф') return '* Заготовки кухни\n* Маркировка\n* Инвентаризация кухни'
  if (position === 'Бармен') return '* Барная станция\n* Напитки\n* Инвентаризация бара'
  if (position === 'Повар') return '* Своя станция\n* Заготовки\n* Маркировка'
  if (position === 'Официант') return '* Свои столы\n* Сервис гостей\n* Передача заказов'
  if (position === 'Хостес') return '* Встреча гостей\n* Брони\n* Очередь и посадка'
  if (position === 'Клининг' || position === 'Уборщик' || position === 'Мойщик') return '* Чистота зон\n* Санитарные точки\n* Расходники'
  return '* Рабочая зона\n* Задачи по должности'
}

function splitResponsibilityLines(text?: string, position?: string) {
  return String(text || getMobileDefaultResponsibilities(position || '')).split('\n').map((line) => line.trim()).filter(Boolean)
}


function getTone(status?: string): 'green' | 'orange' | 'blue' | 'red' | 'purple' {
  if (status === 'done' || status === 'closed') return 'green'
  if (status === 'overdue') return 'red'
  if (status === 'in_progress' || status === 'assigned') return 'orange'
  if (status === 'draft') return 'purple'
  return 'blue'
}

function accentColor(status?: string) {
  if (status === 'overdue') return 'red'
  if (status === 'in_progress') return 'orange'
  if (status === 'done' || status === 'closed') return 'green'
  if (status === 'assigned' || status === 'new') return 'blue'
  return 'gray'
}


function ChecklistRunPanel({ checklist, onSaved }: { checklist: Checklist; onSaved: () => Promise<void> }) {
  const [progress, setProgress] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [runComment, setRunComment] = useState('')
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
      comments: runComment.trim() ? [{ id: `cmt_${Date.now()}`, text: runComment.trim(), authorName: 'Сотрудник', createdAt: new Date().toISOString() }] : [],
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
      <textarea
        className="employee-mobile__run-comment"
        placeholder="Комментарий к чек-листу (необязательно)..."
        value={runComment}
        onChange={(e) => setRunComment(e.target.value)}
        rows={2}
      />
      <div className="employee-mobile__sheet-actions">
        <button type="button" onClick={() => void saveRun()} disabled={!items.length || saving}>{saving ? 'Сохраняю...' : 'Сохранить прохождение'}</button>
      </div>
    </div>
  )
}

function SwipeableCartItem({ item, onDelete, onComment, onQty }: {
  item: OrderCartItem
  onDelete: () => void
  onComment: () => void
  onQty: (delta: number) => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const startX = useRef(0)
  const committed = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    committed.current = false
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    setSwipeX(Math.max(-72, Math.min(72, dx)))
  }

  function onTouchEnd() {
    if (!committed.current) {
      if (swipeX < -56) { committed.current = true; onDelete(); return }
      if (swipeX > 56) { committed.current = true; onComment(); }
    }
    setSwipeX(0)
  }

  return (
    <div className="order-swipe-wrap">
      <div className="order-swipe-bg order-swipe-bg--left"><span>✕ Удалить</span></div>
      <div className="order-swipe-bg order-swipe-bg--right"><span>✎ Коммент</span></div>
      <div
        className="order-swipe-item"
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="order-swipe-item__info">
          <strong>{item.name}</strong>
          {item.comment ? <span className="order-swipe-item__comment">💬 {item.comment}</span> : null}
          <span>{item.price} ₽ × {item.quantity} = {item.price * item.quantity} ₽</span>
        </div>
        <div className="order-swipe-item__qty">
          <button type="button" onClick={() => onQty(-1)}>−</button>
          <span>{item.quantity}</span>
          <button type="button" onClick={() => onQty(1)}>+</button>
        </div>
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
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showNotice(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => showNotice(''), 3000)
  }
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'overdue' | 'done'>('all')
  const [bookingForm, setBookingForm] = useState<{ guestName: string; phone: string; date: string; time: string; guestsCount: number; comment: string } | null>(null)
  const [bookingSaving, setBookingSaving] = useState(false)
  const [orderModal, setOrderModal] = useState(false)
  const [orderStep, setOrderStep] = useState<'table' | 'order'>('table')
  const [orderSubStep, setOrderSubStep] = useState<'categories' | 'dishes'>('categories')
  const [orderHallId, setOrderHallId] = useState('')
  const [orderDraft, setOrderDraft] = useState({ tableId: '', guestsCount: 2, comment: '' })
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderCategoryId, setOrderCategoryId] = useState('')
  const [orderCart, setOrderCart] = useState<OrderCartItem[]>([])
  const [orderCartOpen, setOrderCartOpen] = useState(false)
  const [commentTarget, setCommentTarget] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [attestations, setAttestations] = useState<Attestation[]>([])
  const [activeAttestation, setActiveAttestation] = useState<Attestation | null>(null)
  const [attestAnswers, setAttestAnswers] = useState<Record<string, number>>({})
  const [attestStep, setAttestStep] = useState(0)
  const [attestDone, setAttestDone] = useState(false)
  const [attestScore, setAttestScore] = useState(0)
  const [attestSaving, setAttestSaving] = useState(false)

  function cartTotal() { return orderCart.reduce((sum, i) => sum + i.price * i.quantity, 0) }
  function cartCount() { return orderCart.reduce((sum, i) => sum + i.quantity, 0) }

  function addToCart(item: TtkItem) {
    setOrderCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id)
      if (existing) return prev.map((c) => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { itemId: item.id, name: item.name, price: item.price || 0, quantity: 1 }]
    })
  }

  function removeFromCart(itemId: string) {
    setOrderCart((prev) => prev.filter((c) => c.itemId !== itemId))
  }

  function changeQty(itemId: string, delta: number) {
    setOrderCart((prev) => {
      const item = prev.find((c) => c.itemId === itemId)
      if (!item) return prev
      if (item.quantity + delta <= 0) return prev.filter((c) => c.itemId !== itemId)
      return prev.map((c) => c.itemId === itemId ? { ...c, quantity: c.quantity + delta } : c)
    })
  }
  const [navHistory, setNavHistory] = useState<Array<{ tab: MobileTab; detail: DetailState | null }>>([])

  function navigate(tab: MobileTab, nextDetail: DetailState | null = null) {
    setNavHistory((prev) => [...prev, { tab: activeTab, detail }])
    setActiveTab(tab)
    setDetail(nextDetail)
  }

  function goBack() {
    const prev = navHistory[navHistory.length - 1]
    if (!prev) return
    setNavHistory((h) => h.slice(0, -1))
    setActiveTab(prev.tab)
    setDetail(prev.detail)
  }

  const canGoBack = navHistory.length > 0

  const employee = {
    id: session?.user.id || '',
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


  const currentEmployee = useMemo(() => {
    return summary?.employees?.find((item) => item.userId === session?.user.id || item.name === session?.user.name || item.position === employee.position) || null
  }, [employee.position, session?.user.id, session?.user.name, summary?.employees])

  const userSchedule = useMemo(() => {
    if (!currentEmployee) return []
    return (summary?.staffSchedules || [])
      .filter((item) => item.employeeId === currentEmployee.id && item.value)
      .sort((a, b) => getScheduleSortValue(a) - getScheduleSortValue(b))
  }, [currentEmployee, summary?.staffSchedules])

  const todaySchedule = useMemo(() => {
    const month = getCurrentMonth()
    const day = new Date().getDate()
    return userSchedule.find((item) => item.month === month && Number(item.day) === day)
  }, [userSchedule])

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
      showNotice(nextOpen ? 'Смена открыта.' : 'Смена закрыта.')
      await loadData()
    } catch (error) {
      setShiftOpen(!nextOpen)
      showNotice(error instanceof Error ? error.message : 'Не удалось сохранить смену.')
    }
  }

  async function loadAttestations() {
    try {
      const result = await api.list<Attestation>('attestations')
      const myId = employee.id || ''
      const active = result.items.filter((a) =>
        a.status === 'active' && (a.employeeIds.length === 0 || a.employeeIds.includes(myId))
      )
      setAttestations(active)
    } catch { /* ignore */ }
  }

  async function submitAttestation() {
    if (!activeAttestation) return
    setAttestSaving(true)
    try {
      const answers = activeAttestation.questions.map((q) => ({
        questionId: q.id,
        selectedIndex: attestAnswers[q.id] ?? -1,
      }))
      const correct = answers.filter((a, i) => activeAttestation.questions[i]?.correctIndex === a.selectedIndex).length
      const score = Math.round((correct / activeAttestation.questions.length) * 100)
      await api.create('attestation-results', {
        attestationId: activeAttestation.id,
        employeeId: employee.id || '',
        employeeName: employee.name,
        answers,
        score,
        completedAt: new Date().toISOString(),
      })
      setAttestScore(score)
      setAttestDone(true)
    } catch {
      showNotice('Ошибка при отправке результатов.')
    } finally {
      setAttestSaving(false)
    }
  }

  async function loadOrders() {
    setOrdersLoading(true)
    try {
      const result = await api.list<Order>('orders')
      setOrders(result.items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch { /* ignore */ } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    void loadData().catch(() => showNotice('Не удалось загрузить данные смены.'))
    void loadHallPlan().catch(() => undefined)
    void loadOrders()
    void loadAttestations()
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
      body: <ChecklistRunPanel checklist={checklist} onSaved={async () => { showNotice('Прохождение чек-листа сохранено.'); setDetail(null); await loadData() }} />,
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

  function hierarchyDetail(): DetailState {
    const employees = (summary?.employees || []).filter((item) => item.status !== 'blocked' && item.status !== 'fired' && item.status !== 'deleted')
    const grouped = mobileHierarchyOrder
      .map((group) => ({
        group,
        employees: employees
          .filter((item) => getMobileHierarchyGroup(item.position) === group)
          .sort((a, b) => mobileLeaderPositions.indexOf(a.position) - mobileLeaderPositions.indexOf(b.position) || a.name.localeCompare(b.name, 'ru')),
      }))
      .filter((entry) => entry.employees.length)

    return {
      kind: 'knowledge',
      title: 'Схема иерархии',
      subtitle: employee.restaurantName,
      body: (
        <div className="employee-mobile__hierarchy">
          {grouped.length ? grouped.map((entry) => (
            <section key={entry.group}>
              <h3>{entry.group}</h3>
              {entry.employees.map((person) => (
                <article key={person.id} className="employee-mobile__hierarchy-person">
                  <strong>{person.name}</strong>
                  <span>{person.position}{person.reportsTo ? ` · отвечает перед: ${person.reportsTo}` : ''}</span>
                  <ul>
                    {splitResponsibilityLines(person.responsibilities, person.position).map((line) => (
                      <li key={line} className={line.startsWith('*') ? 'is-required' : ''}>{line.replace(/^\*\s*/, '')}</li>
                    ))}
                  </ul>
                  {person.responsibilityComment ? <p>{person.responsibilityComment}</p> : null}
                </article>
              ))}
            </section>
          )) : <p>Сотрудники ещё не добавлены.</p>}
        </div>
      ),
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
            <button key={item.id} type="button" onClick={() => navigate(activeTab, knowledgeDetail(item))}>
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
            <button key={guest.id} type="button" onClick={() => navigate(activeTab, guestDetail(guest))}>
              <strong>{guest.name}</strong>
              <span>{guest.preferences || guest.serviceComment || guest.phone || 'Карточка гостя'}</span>
            </button>
          )) : <p>Постоянные гости ещё не добавлены.</p>}
        </div>
      ),
    }
  }

  function ttkDetail(item: TtkItem): DetailState {
    return {
      kind: 'ttk',
      title: item.name,
      subtitle: item.group || 'ТТК',
      body: (
        <div className="employee-mobile__detail-text">
          <span>Ед.: {item.unit || 'не указана'}</span>
          <span>Цена: {item.price ? `${item.price} ₽` : 'не указана'}</span>
          <span>Тэг: {item.tag || 'без тэга'}</span>
          <span>Время приготовления: {item.cookingTime || 'не указано'}</span>
          <span>Выход: {item.output || 'не указан'}</span>
          <p>{item.description || 'Описание позиции не заполнено.'}</p>
        </div>
      ),
    }
  }

  function stopListDetail(): DetailState {
    const items = stopListItems
    return {
      kind: 'stopList',
      title: 'Стоп-лист',
      subtitle: items.length ? `${items.length} позиций` : 'Позиции не добавлены',
      body: (
        <div className="employee-mobile__detail-list">
          {items.length ? items.map((item) => (
            <button key={item.id} type="button" onClick={() => setDetail(ttkDetail(item))}>
              <strong>{item.name}</strong>
              <span>{item.group || 'ТТК'} · {item.tag || 'без тэга'}</span>
            </button>
          )) : <p>Стоп-лист пуст.</p>}
        </div>
      ),
    }
  }

  function supportDetail(): DetailState {
    return {
      kind: 'support',
      title: 'Поддержка',
      subtitle: 'Обращение управляющему',
      actions: <button type="button" onClick={async () => { await api.create('technical-requests', { title: 'Обращение в поддержку', description: 'Запрос помощи из мобильного приложения', area: 'Поддержка', priority: 'medium', status: 'new', createdByPosition: employee.position }); showNotice('Обращение создано.'); setDetail(null) }}>Создать обращение</button>,
    }
  }

  async function completeTask(id: string) {
    await api.update('tasks', id, { status: 'done' })
    showNotice('Задача выполнена.')
    setDetail(null)
    await loadData()
  }

  async function submitInventory(id: string) {
    await api.update('inventory-assignments', id, { status: 'submitted', submittedAt: new Date().toISOString() })
    showNotice('Инвентаризация отмечена как сданная.')
    setDetail(null)
    await loadData()
  }

  async function updateSelectedBookingStatus(status: MobileBooking['status']) {
    if (!selectedTable?.booking) return
    await api.bookingStatus(selectedTable.booking.id, status)
    await loadHallPlan()
    setSelectedTable(null)
  }

  async function saveOrder() {
    setOrderSaving(true)
    try {
      const table = hallTables.find((t) => t.id === orderDraft.tableId)
      await api.create('orders', {
        tableId: orderDraft.tableId || null,
        tableName: table?.name || 'Без стола',
        hallId: table?.hallId || null,
        guestsCount: orderDraft.guestsCount,
        comment: orderDraft.comment.trim(),
        items: orderCart,
        total: cartTotal(),
        status: 'new',
        createdByPosition: employee.position,
        createdByName: employee.name,
        createdAt: new Date().toISOString(),
      })
      showNotice('Заказ принят.')
      setOrderModal(false)
      setOrderCart([])
      setOrderDraft({ tableId: '', guestsCount: 2, comment: '' })
      void loadOrders()
    } finally {
      setOrderSaving(false)
    }
  }

  function openBookingForm() {
    setBookingForm({
      guestName: '',
      phone: '',
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      guestsCount: selectedTable?.seats || 2,
      comment: '',
    })
  }

  async function saveBookingForm() {
    if (!selectedTable || !bookingForm) return
    setBookingSaving(true)
    try {
      await api.create('bookings', {
        hallId: selectedTable.hallId,
        tableId: selectedTable.id,
        guestName: bookingForm.guestName.trim() || 'Гость',
        phone: bookingForm.phone.trim(),
        date: bookingForm.date,
        time: bookingForm.time,
        guestsCount: bookingForm.guestsCount,
        status: 'confirmed',
        comment: bookingForm.comment.trim(),
      })
      showNotice('Бронь создана.')
      setBookingForm(null)
      setSelectedTable(null)
      await loadHallPlan()
    } finally {
      setBookingSaving(false)
    }
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
    showNotice('Гости посажены за стол.')
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

  const ttkItems = summary?.ttkItems || []
  const ttkGroups: TtkGroup[] = (() => {
    const seen = new Set<string>()
    const result: TtkGroup[] = []
    for (const item of ttkItems) {
      const g = item.group || item.groupId || ''
      if (g && !seen.has(g)) { seen.add(g); result.push({ id: g, name: g }) }
    }
    return result
  })()
  const stopListItems = ttkItems.filter((item) => Boolean(item.stopList || item.inStopList || item.isStopped || item.status === 'stop'))
  const activeTasks = userTasks.filter((item) => item.status !== 'done')
  const activeChecklists = userChecklists.filter((item) => item.active !== false)
  const activeBookingsCount = (summary?.bookings || []).filter((booking) => !['cancelled', 'no_show'].includes(String(booking.status || ''))).length
  const freeTablesCount = hallTables.filter((table) => table.status === 'free').length

  const overviewCards = [
    {
      id: 'checklists',
      title: 'Чек-листы',
      subtitle: activeChecklists.length ? `${activeChecklists.length} активных` : 'нет активных',
      meta: activeChecklists[0] ? `${activeChecklists[0].startTime || '—'} — ${activeChecklists[0].endTime || '—'}` : 'без назначений',
      tone: 'green' as const,
      icon: <ChecklistIcon />,
      onClick: () => navigate('checklists'),
    },
    {
      id: 'tasks',
      title: 'Задачи',
      subtitle: activeTasks.length ? `${activeTasks.length} активных` : 'нет задач',
      meta: userTasks.some((item) => item.status === 'overdue') ? 'есть просроченные' : 'без просрочек',
      tone: 'blue' as const,
      icon: <ClipboardIcon />,
      onClick: () => navigate('tasks'),
    },
    {
      id: 'hall',
      title: 'План зала',
      subtitle: activeBookingsCount ? `${activeBookingsCount} броней` : 'броней нет',
      meta: freeTablesCount ? `${freeTablesCount} свободных столов` : `${halls.length} залов`,
      tone: 'purple' as const,
      icon: <CalendarIcon />,
      onClick: () => navigate('hallPlan'),
    },
    {
      id: 'stop-list',
      title: 'Стоп-лист',
      subtitle: stopListItems.length ? `${stopListItems.length} позиций` : 'пусто',
      meta: 'блюда и товары под запретом',
      tone: 'red' as const,
      icon: <AlertCircleIcon />,
      onClick: () => navigate(activeTab, stopListDetail()),
    },
    ...userInventory.slice(0, 1).map((item) => ({
      id: `inventory-${item.id}`,
      title: 'Инвентаризация',
      subtitle: item.title,
      meta: `${item.rowsCount || 0} позиций${item.dueDate ? ` · до ${item.dueDate}` : ''}`,
      tone: 'orange' as const,
      icon: <BoxIcon />,
      onClick: () => navigate(activeTab, inventoryDetail(item)),
    })),
  ]

  function renderOverview() {
    return (
      <>
        <section className="employee-mobile__shift-card employee-mobile__shift-card--compact">
          <div className="employee-mobile__shift-status">
            <div className={shiftOpen ? 'employee-mobile__shift-icon employee-mobile__shift-icon--open' : 'employee-mobile__shift-icon'}><ClockIcon /></div>
            <div>
              <strong>{shiftOpen ? 'Смена открыта' : 'Смена не открыта'}</strong>
              <span>{shiftOpen ? 'Рабочий день активен' : 'Откройте смену перед началом работы'}</span>
            </div>
          </div>
          <button className={shiftOpen ? 'employee-mobile__shift-button' : 'employee-mobile__shift-button employee-mobile__shift-button--primary'} type="button" onClick={() => void toggleShift()}>
            {shiftOpen ? 'Закрыть' : 'Открыть'}
          </button>
        </section>

        <button type="button" className="employee-mobile__accept-order-btn" onClick={() => { setOrderDraft({ tableId: '', guestsCount: 2, comment: '' }); setOrderStep('table'); setOrderSubStep('categories'); setOrderHallId(halls[0]?.id || ''); setOrderCart([]); setOrderCartOpen(false); setOrderCategoryId(''); setOrderModal(true) }}>
          <ClipboardIcon />
          <span>Принять заказ</span>
        </button>

        <section className="employee-mobile__section employee-mobile__section--tools">
          <div className="employee-mobile__section-title"><h2>Главная</h2></div>
          <div className="employee-mobile__card-list employee-mobile__card-list--tools">
            {overviewCards.map((card) => (
              <button key={card.id} className={`employee-mobile__work-card employee-mobile__work-card--${card.tone}`} type="button" onClick={card.onClick}>
                <div className="employee-mobile__work-icon">{card.icon}</div>
                <div className="employee-mobile__work-content">
                  <strong>{card.title}</strong>
                  <p>{card.subtitle}</p>
                  <small>{card.meta}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        {notifications.length ? (
          <section className="employee-mobile__section employee-mobile__section--compact">
            <div className="employee-mobile__section-title"><h2>События</h2><button type="button" onClick={() => setShowNotifications(true)}>Все</button></div>
            <button className="employee-mobile__alert-card" type="button" onClick={() => navigate(notifications[0].target, notifications[0].detail)}>
              <div className="employee-mobile__alert-icon"><AlertCircleIcon /></div>
              <div className="employee-mobile__alert-content"><strong>{notifications[0].title}</strong><span>{notifications[0].text}</span></div>
            </button>
          </section>
        ) : null}
      </>
    )
  }

  function renderTasks() {
    const filtered = taskFilter === 'all' ? userTasks
      : taskFilter === 'active' ? userTasks.filter((t) => t.status !== 'done' && t.status !== 'closed')
      : taskFilter === 'overdue' ? userTasks.filter((t) => t.status === 'overdue')
      : userTasks.filter((t) => t.status === 'done' || t.status === 'closed')
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title"><h2>Мои задачи</h2></div>
        <div className="employee-mobile__filter-pills">
          {([['all', 'Все'], ['active', 'Активные'], ['overdue', 'Просроченные'], ['done', 'Выполненные']] as const).map(([value, label]) => (
            <button key={value} type="button" className={taskFilter === value ? 'is-active' : ''} onClick={() => setTaskFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="employee-mobile__plain-list">
          {filtered.length ? filtered.map((task) => (
            <button key={task.id} className="employee-mobile__list-card" type="button" onClick={() => navigate(activeTab, taskDetail(task))}>
              <div className={`employee-mobile__list-card__accent employee-mobile__list-card__accent--${accentColor(task.status)}`} />
              <div className="employee-mobile__list-card__body"><strong>{task.title}</strong><p className={task.status === 'overdue' ? 'employee-mobile__danger' : ''}>{statusText(task.status)}</p><small>{task.dueTime || 'срок не указан'}</small></div>
              <div className="employee-mobile__list-card__chevron"><ChevronRightIcon /></div>
            </button>
          )) : <p className="employee-mobile__empty">Задач нет.</p>}
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
            <button key={item.id} className="employee-mobile__list-card" type="button" onClick={() => navigate(activeTab, checklistDetail(item))}>
              <div className="employee-mobile__list-card__accent employee-mobile__list-card__accent--green" />
              <div className="employee-mobile__list-card__body"><strong>{item.title}</strong><p>{item.items?.length || 0} пунктов</p><small>{item.startTime || '—'} — {item.endTime || '—'}</small></div>
              <div className="employee-mobile__list-card__chevron"><ChevronRightIcon /></div>
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
        <div className="employee-mobile__hall-tabs-row">
          <div className="employee-mobile__hall-tabs" aria-label="Залы">
            {halls.map((hall) => <button type="button" key={hall.id} className={hall.id === selectedHallId ? 'is-active' : ''} onClick={() => { setSelectedHallId(hall.id); setHallFilter('all'); setSelectedTable(null) }}><strong>{hall.name}</strong><span>{hall.tablesCount} столов</span></button>)}
          </div>
          <button type="button" className="employee-mobile__hall-search" aria-label="Обновить" onClick={() => { void loadHallPlan(); showNotice('План зала обновлён.') }}><SearchIcon /></button>
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

  function renderTtk() {
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title"><h2>ТТК</h2></div>
        <div className="employee-mobile__plain-list">
          {ttkItems.length ? ttkItems.map((item) => (
            <button key={item.id} className="employee-mobile__list-card" type="button" onClick={() => navigate(activeTab, ttkDetail(item))}>
              <div className="employee-mobile__list-card__accent employee-mobile__list-card__accent--orange" />
              <div className="employee-mobile__list-card__body"><strong>{item.name}</strong><p>{item.group || 'Без группы'}{item.price ? ` · ${item.price} ₽` : ''}</p><small>{item.tag || item.cookingTime || 'карточка позиции'}</small></div>
              <div className="employee-mobile__list-card__chevron"><ChevronRightIcon /></div>
            </button>
          )) : <p className="employee-mobile__empty">ТТК ещё не добавлены.</p>}
        </div>
      </section>
    )
  }

  function renderKnowledge() {
    const sections = [
      { id: 'hierarchy', title: 'Схема иерархии', subtitle: 'Кто за что отвечает', icon: <UserIcon />, action: () => setDetail(hierarchyDetail()) },
      { id: 'we-guests', title: 'Мы и гости', subtitle: `${summary?.guests?.length || 0} постоянных гостей`, icon: <UserIcon />, action: () => setDetail(guestsListDetail()) },
      { id: 'team', title: 'Мы команда', subtitle: 'События и жизнь ресторана', icon: <MailIcon />, action: () => setDetail({ kind: 'knowledge', title: 'Мы команда', subtitle: employee.restaurantName, body: <div className="employee-mobile__detail-text"><p>Корпоративные события, дни рождения и внутренняя жизнь команды.</p></div> }) },
      { id: 'materials', title: 'Материалы', subtitle: `${summary?.knowledgeMaterials?.length || 0} материалов`, icon: <BookIcon />, action: () => setDetail(knowledgeListDetail()) },
    ]
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title"><h2>База знаний</h2></div>
        <div className="employee-mobile__plain-list">
          {sections.map((item) => (
            <button key={item.id} className="employee-mobile__list-card employee-mobile__knowledge-row" type="button" onClick={() => { setNavHistory((prev) => [...prev, { tab: activeTab, detail }]); item.action() }}>
              <div className="employee-mobile__list-card__accent employee-mobile__list-card__accent--blue" />
              <div className="employee-mobile__more-icon">{item.icon}</div>
              <div className="employee-mobile__list-card__body"><strong>{item.title}</strong><p>{item.subtitle}</p></div>
              <div className="employee-mobile__list-card__chevron"><ChevronRightIcon /></div>
            </button>
          ))}
        </div>
      </section>
    )
  }

  function renderSchedule() {
    const visibleSchedule = userSchedule.filter((item) => item.month >= getCurrentMonth()).slice(0, 20)
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title"><h2>График</h2></div>
        {todaySchedule ? (
          <div className="employee-mobile__schedule-today">
            <CalendarIcon />
            <div><strong>Сегодня смена по графику</strong><p>{todaySchedule.value === '0.5' ? 'Половина смены' : 'Полная смена'}</p></div>
          </div>
        ) : shiftOpen ? (
          <div className="employee-mobile__schedule-today employee-mobile__schedule-today--warning">
            <AlertCircleIcon />
            <div><strong>Смена открыта вне графика</strong><p>Уточните смену у управляющего</p></div>
          </div>
        ) : null}
        <div className="employee-mobile__plain-list">
          {visibleSchedule.length ? visibleSchedule.map((item) => (
            <button key={item.id} className="employee-mobile__list-card" type="button" onClick={() => navigate(activeTab, { kind: 'schedule', title: 'Смена по графику', subtitle: getScheduleDateLabel(item.month, Number(item.day)), body: <div className="employee-mobile__detail-text"><span>{item.value === '0.5' ? 'Половина смены' : 'Полная смена'}</span>{item.note ? <p>{item.note}</p> : null}</div> })}>
              <div className="employee-mobile__list-card__accent employee-mobile__list-card__accent--blue" />
              <div className="employee-mobile__list-card__body"><strong>{getScheduleDateLabel(item.month, Number(item.day))}</strong><p>{item.value === '0.5' ? '0.5 смены' : '1 смена'}</p><small>{item.position || employee.position}</small></div>
              <div className="employee-mobile__list-card__chevron"><ChevronRightIcon /></div>
            </button>
          )) : <p className="employee-mobile__empty">Смены по графику ещё не назначены.</p>}
        </div>
      </section>
    )
  }



  function renderOrders() {
    const orderStatusLabel: Record<Order['status'], string> = {
      new: 'Новый',
      in_progress: 'Готовится',
      done: 'Выполнен',
      cancelled: 'Отменён',
    }
    const orderStatusColor: Record<Order['status'], string> = {
      new: 'orange',
      in_progress: 'blue',
      done: 'green',
      cancelled: 'gray',
    }

    async function updateOrderStatus(orderId: string, status: Order['status']) {
      try {
        await api.update('orders', orderId, { status })
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o))
      } catch {
        showNotice('Не удалось обновить статус.')
      }
    }

    return (
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Заказы</h2>
          <button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, fontSize: 14, cursor: 'pointer' }} onClick={() => void loadOrders()}>Обновить</button>
        </div>
        {ordersLoading && <p className="employee-mobile__empty">Загрузка...</p>}
        {!ordersLoading && orders.length === 0 && <p className="employee-mobile__empty">Заказов пока нет.</p>}
        <div className="employee-mobile__plain-list">
          {orders.map((order) => (
            <div key={order.id} className="employee-mobile__list-card" style={{ display: 'block', padding: 0, overflow: 'hidden' }}>
              <div className={`employee-mobile__list-card__accent employee-mobile__list-card__accent--${orderStatusColor[order.status]}`} style={{ width: '100%', height: 3 }} />
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 15, fontWeight: 700 }}>{order.tableName}</strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: order.status === 'done' ? '#16a34a' : order.status === 'cancelled' ? '#9ca3af' : order.status === 'in_progress' ? '#2563eb' : '#ea580c' }}>{orderStatusLabel[order.status]}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  {order.guestsCount} гостей · {order.total} ₽ · {new Date(order.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  {order.createdByName ? ` · ${order.createdByName}` : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#374151' }}>
                      {item.name} × {item.quantity}
                      {item.comment ? <span style={{ color: '#2563eb' }}> — {item.comment}</span> : null}
                    </div>
                  ))}
                </div>
                {order.comment ? <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>💬 {order.comment}</div> : null}
                {order.status === 'new' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => void updateOrderStatus(order.id, 'in_progress')} style={{ flex: 1, height: 36, border: 'none', borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Готовится</button>
                    <button type="button" onClick={() => void updateOrderStatus(order.id, 'cancelled')} style={{ flex: 1, height: 36, border: '1px solid #fecaca', borderRadius: 10, background: '#fff5f5', color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Отменить</button>
                  </div>
                )}
                {order.status === 'in_progress' && (
                  <button type="button" onClick={() => void updateOrderStatus(order.id, 'done')} style={{ width: '100%', height: 36, border: 'none', borderRadius: 10, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Выполнен</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  function renderAttestation() {
    const typeLabels: Record<string, string> = { full: 'Полная', menu: 'По меню', knowledge: 'По базе знаний' }

    if (activeAttestation) {
      const q = activeAttestation.questions[attestStep]
      const total = activeAttestation.questions.length

      if (attestDone) {
        const passed = attestScore >= 70
        return (
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 64 }}>{passed ? '🎉' : '😔'}</div>
            <strong style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{passed ? 'Аттестация пройдена!' : 'Не пройдено'}</strong>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: passed ? '#16a34a' : '#dc2626' }}>{attestScore}%</p>
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Правильных ответов: {Math.round(attestScore * total / 100)} из {total}</p>
            <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>{passed ? 'Результат отправлен управляющему.' : 'Результат сохранён. Попробуйте ещё раз позже.'}</p>
            <button type="button" style={{ marginTop: 8, height: 48, padding: '0 32px', border: 'none', borderRadius: 14, background: '#111', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
              onClick={() => { setActiveAttestation(null); setAttestAnswers({}); setAttestStep(0); setAttestDone(false); void loadAttestations() }}>
              К списку аттестаций
            </button>
          </section>
        )
      }

      return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}
              onClick={() => { setActiveAttestation(null); setAttestAnswers({}); setAttestStep(0) }}>
              ← Назад
            </button>
            <span style={{ flex: 1, fontSize: 13, color: '#9ca3af', textAlign: 'right' }}>{attestStep + 1} / {total}</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, borderRadius: 4, background: '#e5e7eb' }}>
            <div style={{ height: '100%', borderRadius: 4, background: '#111', width: `${((attestStep + 1) / total) * 100}%`, transition: 'width 0.3s' }} />
          </div>

          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 18px', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#111', lineHeight: 1.4 }}>{q.text}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.options.map((opt, oi) => {
                const selected = attestAnswers[q.id] === oi
                return (
                  <button key={oi} type="button"
                    style={{ textAlign: 'left', padding: '14px 16px', border: `2px solid ${selected ? '#111' : '#e5e7eb'}`, borderRadius: 14, background: selected ? '#111' : '#fff', color: selected ? '#fff' : '#374151', fontWeight: selected ? 700 : 500, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => setAttestAnswers((prev) => ({ ...prev, [q.id]: oi }))}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${selected ? '#fff' : '#d1d5db'}`, background: selected ? '#fff' : 'transparent', color: selected ? '#111' : '#9ca3af', fontSize: 11, fontWeight: 800, marginRight: 10, flexShrink: 0 }}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {attestStep > 0 && (
              <button type="button" style={{ flex: 1, height: 48, border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', color: '#374151', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                onClick={() => setAttestStep((s) => s - 1)}>
                Назад
              </button>
            )}
            {attestStep < total - 1 ? (
              <button type="button" style={{ flex: 2, height: 48, border: 'none', borderRadius: 14, background: attestAnswers[q.id] != null ? '#111' : '#e5e7eb', color: attestAnswers[q.id] != null ? '#fff' : '#9ca3af', fontWeight: 700, fontSize: 15, cursor: attestAnswers[q.id] != null ? 'pointer' : 'not-allowed' }}
                disabled={attestAnswers[q.id] == null}
                onClick={() => setAttestStep((s) => s + 1)}>
                Далее
              </button>
            ) : (
              <button type="button" style={{ flex: 2, height: 48, border: 'none', borderRadius: 14, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                disabled={attestSaving}
                onClick={() => void submitAttestation()}>
                {attestSaving ? 'Отправляю...' : 'Завершить аттестацию'}
              </button>
            )}
          </div>
        </section>
      )
    }

    return (
      <section>
        <h2 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700 }}>Аттестация</h2>
        {attestations.length === 0 ? (
          <p className="employee-mobile__empty">Активных аттестаций нет.</p>
        ) : (
          <div className="employee-mobile__plain-list">
            {attestations.map((a) => (
              <button key={a.id} type="button" className="employee-mobile__list-card"
                onClick={() => { setActiveAttestation(a); setAttestAnswers({}); setAttestStep(0); setAttestDone(false) }}>
                <div className="employee-mobile__list-card__accent employee-mobile__list-card__accent--blue" />
                <div className="employee-mobile__list-card__body">
                  <strong>{a.title}</strong>
                  <p>{typeLabels[a.type]} · {a.questions.length} вопросов</p>
                  {a.deadline && <small>До {new Date(a.deadline).toLocaleDateString('ru')}</small>}
                </div>
                <div className="employee-mobile__list-card__chevron"><ChevronRightIcon /></div>
              </button>
            ))}
          </div>
        )}
      </section>
    )
  }

  const tabTitles: Record<MobileTab, string> = {
    overview: 'Главная',
    tasks: 'Мои задачи',
    checklists: 'Чек-листы',
    hallPlan: 'План зала',
    ttk: 'Номенклатура',
    knowledge: 'База знаний',
    schedule: 'График',
    orders: 'Заказы',
    attestation: 'Аттестация',
  }

  return (
    <main className="employee-mobile">
      <header className="employee-mobile__header">
        {canGoBack ? (
          <button type="button" className="employee-mobile__back-btn" onClick={goBack} aria-label="Назад"><ChevronLeftIcon /></button>
        ) : null}
        <div className={canGoBack ? 'employee-mobile__header-info employee-mobile__header-info--shifted' : 'employee-mobile__header-info'}>
          <div className="employee-mobile__header-name">
            {canGoBack ? (detail?.title || tabTitles[activeTab]) : employee.name}
          </div>
          <p className="employee-mobile__header-sub">{canGoBack ? (detail?.subtitle || employee.restaurantName) : `${employee.position} · ${employee.restaurantName}`}</p>
        </div>
        <div className="employee-mobile__header-actions">
          {!canGoBack ? <button type="button" className="employee-mobile__header-request-btn" onClick={() => setShowRequestModal(true)} aria-label="Тех. заявка"><PlusIcon /></button> : null}
          {!canGoBack ? <button type="button" onClick={() => setShowNotifications(true)} aria-label="Уведомления"><BellIcon />{notifications.length ? <b>{notifications.length}</b> : null}</button> : null}
          {!canGoBack ? <button type="button" onClick={() => { if (window.confirm('Выйти из аккаунта?')) logout() }} aria-label="Выйти"><LogoutIcon /></button> : null}
        </div>
      </header>

      {notice ? <div className="employee-mobile__notice">{notice}</div> : null}

      <section className="employee-mobile__content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'checklists' && renderChecklists()}
        {activeTab === 'hallPlan' && renderHallPlan()}
        {activeTab === 'ttk' && renderTtk()}
        {activeTab === 'knowledge' && renderKnowledge()}
        {activeTab === 'schedule' && renderSchedule()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'attestation' && renderAttestation()}
      </section>

      <nav className="employee-mobile__bottom-nav employee-mobile__bottom-nav--compact" aria-label="Нижнее меню">
        <button type="button" className={activeTab === 'overview' ? 'is-active' : ''} onClick={() => { setActiveTab('overview'); setDetail(null); setNavHistory([]) }}><OverviewIcon /><span>Главная</span></button>
        <button type="button" className={activeTab === 'hallPlan' ? 'is-active' : ''} onClick={() => { setActiveTab('hallPlan'); setDetail(null); setNavHistory([]) }}><CalendarIcon /><span>Зал</span></button>
        <button type="button" className={`employee-mobile__plus-button${activeTab === 'orders' ? ' is-active' : ''}`} onClick={() => { setActiveTab('orders'); setDetail(null); setNavHistory([]); void loadOrders() }}><span><ClipboardIcon /></span><strong>Заказы</strong></button>
        <button type="button" className={activeTab === 'tasks' ? 'is-active' : ''} onClick={() => { setActiveTab('tasks'); setDetail(null); setNavHistory([]) }}><ChecklistIcon /><span>Задачи</span></button>
        <button type="button" className={`${activeTab === 'attestation' ? 'is-active' : ''}${attestations.length > 0 ? ' employee-mobile__nav-badge' : ''}`} onClick={() => { setActiveAttestation(null); setAttestAnswers({}); setAttestStep(0); setAttestDone(false); setActiveTab('attestation'); setDetail(null); setNavHistory([]); void loadAttestations() }}><BookIcon /><span>Тест</span>{attestations.length > 0 && <b>{attestations.length}</b>}</button>
      </nav>

      {selectedTable && !bookingForm ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setSelectedTable(null)}>
          <div className="employee-mobile__sheet employee-mobile__hall-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__hall-sheet-title"><div><strong>{selectedTable.name}</strong><p>{selectedHall?.name || 'Зал'} · {selectedTable.seats} места</p></div><button type="button" onClick={() => setSelectedTable(null)}>×</button></div>
            {selectedTable.booking
              ? <div className="employee-mobile__booking-card"><small>Активная бронь</small><strong>{selectedTable.booking.guestName}</strong><p>{selectedTable.booking.time} · {selectedTable.booking.guestsCount} гостей</p>{selectedTable.booking.phone ? <span>Телефон: {selectedTable.booking.phone}</span> : null}{selectedTable.booking.comment ? <span>Комментарий: {selectedTable.booking.comment}</span> : null}</div>
              : <div className="employee-mobile__booking-card"><small>Бронь</small><strong>Брони нет</strong><p>{selectedTable.status === 'disabled' ? 'Стол недоступен' : 'Стол свободен для посадки'}</p></div>}
            <div className="employee-mobile__hall-actions">
              {selectedTable.booking ? <>
                {selectedTable.booking.status !== 'arrived' && selectedTable.booking.status !== 'seated' ? <button type="button" className="employee-mobile__hall-actions-blue" onClick={() => updateSelectedBookingStatus('arrived')}>Пришли</button> : null}
                {selectedTable.booking.status !== 'seated' ? <button type="button" className="employee-mobile__hall-actions-purple" onClick={() => updateSelectedBookingStatus('seated')}>Гости сели</button> : null}
                {selectedTable.booking.status === 'seated' || selectedTable.booking.status === 'arrived' ? <button type="button" className="employee-mobile__hall-actions-green" onClick={() => updateSelectedBookingStatus('cancelled')}>Гости ушли</button> : null}
                {selectedTable.booking.phone ? <button type="button" onClick={() => { window.location.href = `tel:${selectedTable.booking?.phone}` }}>Позвонить</button> : null}
                <button type="button" className="employee-mobile__hall-actions-red" onClick={() => updateSelectedBookingStatus('no_show')}>Не пришли</button>
              </> : <button type="button" className="employee-mobile__hall-actions-green" onClick={() => { void seatWalkIn(selectedTable) }}>Посадить без брони</button>}
              <button type="button" className="employee-mobile__hall-actions-create" onClick={openBookingForm}>+ Создать бронь</button>
            </div>
          </div>
        </div>
      ) : null}

      {bookingForm ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setBookingForm(null)}>
          <div className="employee-mobile__sheet employee-mobile__sheet--form" onClick={(e) => e.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__hall-sheet-title">
              <div><strong>Новая бронь</strong><p>{selectedTable?.name} · {selectedHall?.name}</p></div>
              <button type="button" onClick={() => setBookingForm(null)}>×</button>
            </div>
            <form className="employee-mobile__booking-form" onSubmit={(e) => { e.preventDefault(); void saveBookingForm() }}>
              <label><span>Имя гостя</span><input type="text" value={bookingForm.guestName} onChange={(e) => setBookingForm((f) => f && ({ ...f, guestName: e.target.value }))} placeholder="Иван Иванов" /></label>
              <label><span>Телефон</span><input type="tel" value={bookingForm.phone} onChange={(e) => setBookingForm((f) => f && ({ ...f, phone: e.target.value }))} placeholder="+7 900 000-00-00" /></label>
              <div className="employee-mobile__booking-form__row">
                <label><span>Дата</span><input type="date" value={bookingForm.date} onChange={(e) => setBookingForm((f) => f && ({ ...f, date: e.target.value }))} /></label>
                <label><span>Время</span><input type="time" value={bookingForm.time} onChange={(e) => setBookingForm((f) => f && ({ ...f, time: e.target.value }))} /></label>
              </div>
              <label><span>Количество гостей</span><input type="number" min="1" max="50" value={bookingForm.guestsCount} onChange={(e) => setBookingForm((f) => f && ({ ...f, guestsCount: Number(e.target.value) || 1 }))} /></label>
              <label><span>Комментарий</span><input type="text" value={bookingForm.comment} onChange={(e) => setBookingForm((f) => f && ({ ...f, comment: e.target.value }))} placeholder="Необязательно" /></label>
              <button type="submit" className="employee-mobile__hall-actions-create" disabled={bookingSaving}>{bookingSaving ? 'Сохраняю...' : 'Создать бронь'}</button>
            </form>
          </div>
        </div>
      ) : null}

      {showNotifications ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setShowNotifications(false)}>
          <div className="employee-mobile__sheet" onClick={(event) => event.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__sheet-title"><strong>Уведомления</strong><p>Важные события по смене</p></div>
            <div className="employee-mobile__notification-list">
              {notifications.length ? notifications.map((item) => <button key={`${item.title}-${item.text}`} type="button" onClick={() => { setShowNotifications(false); navigate(item.target, item.detail) }}><strong>{item.title}</strong><span>{item.text}</span></button>) : <p className="employee-mobile__empty">Новых уведомлений нет.</p>}
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

      {orderModal ? (
        <div className="order-modal-backdrop" onClick={() => { setOrderModal(false); setOrderCart([]) }}>
          <div className="order-modal" onClick={(e) => e.stopPropagation()}>

            {/* Шаг 1: выбор стола */}
            {orderStep === 'table' && <>
              <div className="order-modal__header">
                <strong>Выберите стол</strong>
                <button type="button" onClick={() => { setOrderModal(false); setOrderCart([]) }}>×</button>
              </div>
              <div className="employee-mobile__order-halls" style={{ padding: '0 16px' }}>
                {halls.map((hall) => (
                  <button key={hall.id} type="button" className={`employee-mobile__order-hall-tab${orderHallId === hall.id ? ' is-active' : ''}`} onClick={() => setOrderHallId(hall.id)}>{hall.name}</button>
                ))}
              </div>
              <div className="employee-mobile__order-tables" style={{ padding: '0 16px' }}>
                {hallTables.filter((t) => t.hallId === (orderHallId || halls[0]?.id)).map((table) => (
                  <button key={table.id} type="button" className={`employee-mobile__order-table employee-mobile__order-table--${table.status}`}
                    onClick={() => { setOrderDraft((d) => ({ ...d, tableId: table.id, guestsCount: table.seats })); setOrderCategoryId(''); setOrderSubStep('categories'); setOrderStep('order') }}>
                    <strong>{table.name}</strong>
                    <span>{table.seats} мест</span>
                    <small>{table.status === 'free' ? 'Свободен' : table.status === 'reserved' ? 'Бронь' : table.status === 'occupied' ? 'Занят' : table.status === 'arrived' ? 'Пришли' : 'Недоступен'}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="employee-mobile__order-skip" style={{ margin: '0 16px 16px' }} onClick={() => { setOrderDraft((d) => ({ ...d, tableId: '' })); setOrderCategoryId(''); setOrderSubStep('categories'); setOrderStep('order') }}>Продолжить без стола</button>
            </>}

            {/* Шаг 2: категории → блюда */}
            {orderStep === 'order' && (() => {
              const selectedGroup = ttkGroups.find((g) => g.id === orderCategoryId)
              const categoryItems = !orderCategoryId
                ? ttkItems
                : ttkItems.filter((it) => it.group === orderCategoryId || it.groupId === orderCategoryId || it.group === selectedGroup?.name)
              const tableName = hallTables.find((t) => t.id === orderDraft.tableId)?.name || 'Без стола'
              return <>
                <div className="order-modal__header">
                  <button type="button" className="employee-mobile__order-back" onClick={() => {
                    if (orderSubStep === 'dishes') { setOrderSubStep('categories') }
                    else { setOrderStep('table') }
                  }}><ChevronLeftIcon /></button>
                  <strong>{orderSubStep === 'dishes' && selectedGroup ? selectedGroup.name : tableName}</strong>
                  <button type="button" onClick={() => { setOrderModal(false); setOrderCart([]) }}>×</button>
                </div>

                {/* Сетка категорий */}
                {orderSubStep === 'categories' && (
                  <div className="employee-mobile__order-categories" style={{ padding: '10px 14px', flex: 1, overflowY: 'auto' }}>
                    {ttkGroups.map((g) => {
                      const count = ttkItems.filter((it) => it.group === g.id || it.groupId === g.id || it.group === g.name).length
                      const inCartCount = orderCart.filter((ci) => {
                        const item = ttkItems.find((it) => it.id === ci.itemId)
                        return item && (item.group === g.id || item.groupId === g.id || item.group === g.name)
                      }).reduce((s, ci) => s + ci.quantity, 0)
                      return (
                        <button key={g.id} type="button" className={`employee-mobile__order-category${inCartCount > 0 ? ' employee-mobile__order-category--in-cart' : ''}`} onClick={() => { setOrderCategoryId(g.id); setOrderSubStep('dishes') }}>
                          <strong>{g.name}</strong>
                          <span>{count} поз.{inCartCount > 0 ? ` · ${inCartCount} в корзине` : ''}</span>
                        </button>
                      )
                    })}
                    {ttkGroups.length === 0 && <p className="employee-mobile__empty">Нет категорий. Добавьте блюда в номенклатуру.</p>}
                  </div>
                )}

                {/* Список блюд выбранной категории */}
                {orderSubStep === 'dishes' && (
                  <div className="employee-mobile__order-items" style={{ padding: '0 14px', flex: 1, overflowY: 'auto' }}>
                    {categoryItems.map((item) => {
                      const inCart = orderCart.find((c) => c.itemId === item.id)
                      return (
                        <div key={item.id} className={`employee-mobile__order-item${inCart ? ' employee-mobile__order-item--in-cart' : ''}`}>
                          <div className="employee-mobile__order-item__info">
                            <strong>{item.name}</strong>
                            {(item.price || item.cookingTime) && <span>{item.price ? `${item.price} ₽` : ''}{item.cookingTime ? `${item.price ? ' · ' : ''}${item.cookingTime}` : ''}</span>}
                          </div>
                          <div className="employee-mobile__order-item__qty">
                            {inCart ? <>
                              <button type="button" onClick={() => changeQty(item.id, -1)}>−</button>
                              <span>{inCart.quantity}</span>
                              <button type="button" onClick={() => changeQty(item.id, 1)}>+</button>
                            </> : (
                              <button type="button" className="employee-mobile__order-item__add" onClick={() => addToCart(item)}>+</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {categoryItems.length === 0 && <p className="employee-mobile__empty" style={{ padding: '16px 0' }}>Нет блюд в этой категории.</p>}
                  </div>
                )}

                {/* Нижняя панель — корзина */}
                <div className="order-modal__cart-panel">
                  {orderCartOpen && orderCart.length > 0 && (
                    <div className="order-modal__cart-list">
                      {orderCart.map((ci) => (
                        <SwipeableCartItem
                          key={ci.itemId}
                          item={ci}
                          onDelete={() => removeFromCart(ci.itemId)}
                          onComment={() => { setCommentTarget(ci.itemId); setCommentText(ci.comment || '') }}
                          onQty={(d) => changeQty(ci.itemId, d)}
                        />
                      ))}
                      <div className="order-modal__cart-fields">
                        <label><span>Гостей</span><input type="number" min="1" max="50" value={orderDraft.guestsCount} onChange={(e) => setOrderDraft((d) => ({ ...d, guestsCount: Number(e.target.value) || 1 }))} /></label>
                        <label><span>Комментарий</span><input type="text" value={orderDraft.comment} onChange={(e) => setOrderDraft((d) => ({ ...d, comment: e.target.value }))} placeholder="Пожелания..." /></label>
                      </div>
                    </div>
                  )}
                  <div className="order-modal__cart-bar" onClick={() => cartCount() > 0 && setOrderCartOpen((v) => !v)}>
                    <div className="order-modal__cart-bar__left">
                      {cartCount() > 0
                        ? <><span className="order-modal__cart-count">{cartCount()}</span><span>позиций · {cartTotal()} ₽</span></>
                        : <span style={{ color: '#9ca3af' }}>Заказ пуст</span>}
                    </div>
                    <button
                      type="button"
                      className="order-modal__send-btn"
                      disabled={orderSaving || orderCart.length === 0}
                      onClick={(e) => { e.stopPropagation(); void saveOrder() }}
                    >
                      {orderSaving ? '...' : 'Отправить'}
                    </button>
                  </div>
                </div>
              </>
            })()}
          </div>
        </div>
      ) : null}

      {/* Модалка комментария к позиции */}
      {commentTarget && (
        <div className="order-modal-backdrop" onClick={() => setCommentTarget(null)}>
          <div className="order-comment-modal" onClick={(e) => e.stopPropagation()}>
            <strong>Комментарий к блюду</strong>
            <p>{orderCart.find((c) => c.itemId === commentTarget)?.name}</p>
            <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Без лука, средняя прожарка..." autoFocus />
            <button type="button" onClick={() => {
              setOrderCart((prev) => prev.map((c) => c.itemId === commentTarget ? { ...c, comment: commentText.trim() } : c))
              setCommentTarget(null)
            }}>Сохранить</button>
          </div>
        </div>
      )}

      {showRequestModal ? (
        <div className="employee-mobile__sheet-backdrop" onClick={() => setShowRequestModal(false)}>
          <div className="employee-mobile__sheet employee-mobile__sheet--form" onClick={(event) => event.stopPropagation()}>
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__sheet-title"><strong>Новая тех. заявка</strong></div>
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
