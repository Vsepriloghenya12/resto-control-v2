import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { api, apiRequest } from '../../shared/api/client'
import { AlertCircleIcon, BellIcon, CalendarIcon, ChefIcon, LogoutIcon, PaymentIcon, SearchIcon, SettingsIcon, TeamIcon, UserIcon } from '../../shared/ui/Icon'

type OwnerTab = 'restaurants' | 'payments' | 'requisites' | 'support' | 'create'
type RestaurantStatus = 'trial' | 'active' | 'payment_pending' | 'payment_reported' | 'expired' | 'blocked'
type InvoiceStatus = 'issued' | 'awaiting_payment' | 'payment_reported' | 'payment_order_attached' | 'paid' | 'not_found' | 'overdue' | 'draft'

type PlatformRestaurant = {
  id: string
  name: string
  city?: string
  ownerName?: string
  phone?: string
  email?: string
  contactPhone?: string
  contactEmail?: string
  employees?: number
  employeesCount?: number
  plan?: string
  status?: RestaurantStatus
  subscriptionStatus?: RestaurantStatus
  accessUntil?: string
  subscriptionEndsAt?: string
  trialEndsAt?: string
  invoicesCount?: number
  checklistRuns?: number
  pendingPayments?: number
  owner?: { id: string; name: string; login: string } | null
  payments?: Invoice[]
  latestInvoice?: Invoice
}

type Invoice = {
  id: string
  number?: string
  invoiceNumber?: string
  restaurantId?: string
  restaurantName?: string
  plan?: string
  period?: string
  amount?: number
  issuedAt?: string
  status?: InvoiceStatus
  receiptName?: string
  paymentOrderName?: string
  closingDocument?: string
}

type Overview = {
  restaurants: PlatformRestaurant[]
  payments: Invoice[]
}

type Notice = {
  id: string
  title: string
  text: string
  tone: 'orange' | 'red' | 'green' | 'blue'
  tab: OwnerTab
}

const plans = [
  { id: 'start', name: 'Старт', employees: 'до 10 сотрудников', amount: 1490 },
  { id: 'team20', name: 'Команда 20', employees: 'до 20 сотрудников', amount: 1990 },
  { id: 'standard', name: 'Стандарт', employees: 'до 30 сотрудников', amount: 2990 },
  { id: 'team40', name: 'Команда 40', employees: 'до 40 сотрудников', amount: 3990 },
  { id: 'team50', name: 'Команда 50', employees: 'до 50 сотрудников', amount: 4990 },
]

const tabItems: Array<{ id: OwnerTab; label: string; icon: ReactNode }> = [
  { id: 'restaurants', label: 'Рестораны', icon: <ChefIcon /> },
  { id: 'payments', label: 'Оплаты', icon: <PaymentIcon /> },
  { id: 'requisites', label: 'Реквизиты', icon: <SettingsIcon /> },
  { id: 'support', label: 'Техподдержка', icon: <AlertCircleIcon /> },
  { id: 'create', label: 'Создать ресторан', icon: <TeamIcon /> },
]

const statusLabels: Record<string, string> = {
  trial: 'Пробный период',
  active: 'Активен',
  payment_pending: 'Ожидает оплаты',
  payment_reported: 'Клиент оплатил',
  expired: 'Доступ истёк',
  blocked: 'Заблокирован',
}

const invoiceStatusLabels: Record<string, string> = {
  draft: 'Черновик',
  issued: 'Счёт выставлен',
  awaiting_payment: 'Ожидает оплаты',
  payment_reported: 'Клиент отметил оплату',
  payment_order_attached: 'Поручение прикреплено',
  paid: 'Оплата подтверждена',
  not_found: 'Платёж не найден',
  overdue: 'Просрочен',
}

function money(value = 0) {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`
}

function formatDate(value?: string) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU')
}

function getRestaurantStatus(restaurant: PlatformRestaurant): RestaurantStatus {
  return (restaurant.status || restaurant.subscriptionStatus || 'trial') as RestaurantStatus
}

function getAccessUntil(restaurant: PlatformRestaurant) {
  return restaurant.accessUntil || restaurant.subscriptionEndsAt || restaurant.trialEndsAt || ''
}

function getRestaurantOwnerName(restaurant: PlatformRestaurant) {
  return restaurant.owner?.name || restaurant.ownerName || 'Владелец не указан'
}

function getRestaurantOwnerLogin(restaurant: PlatformRestaurant) {
  return restaurant.owner?.login || restaurant.email || restaurant.contactEmail || 'логин не указан'
}

function getEmployeeCount(restaurant: PlatformRestaurant) {
  return restaurant.employeesCount ?? restaurant.employees ?? 0
}

function ServiceOwnerBrand() {
  return (
    <div className="service-owner-brand">
      <img className="service-owner-brand__logo-img" src="/resto-control-logo.png" alt="Ресто Контроль" />
    </div>
  )
}

function StatusBadge({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`service-owner-badge service-owner-badge--${status}`}>{children}</span>
}

function MetricCard({ label, value, text, icon, tone, onClick }: { label: string; value: string; text: string; icon: ReactNode; tone: string; onClick?: () => void }) {
  return (
    <button type="button" className="service-owner-metric service-owner-metric--button" onClick={onClick}>
      <span className={`service-owner-metric__icon service-owner-metric__icon--${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{text}</small>
      </div>
    </button>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="service-owner-empty-state"><strong>{title}</strong><span>{text}</span></div>
}

function RestaurantsTab({
  restaurants,
  selectedId,
  setSelectedId,
  search,
  isLoading,
  message,
  onCreate,
  onIssueInvoice,
  onExtend,
  onToggleBlock,
  onDelete,
}: {
  restaurants: PlatformRestaurant[]
  selectedId: string
  setSelectedId: (id: string) => void
  search: string
  isLoading: boolean
  message: string
  onCreate: () => void
  onIssueInvoice: (restaurant: PlatformRestaurant) => void
  onExtend: (restaurant: PlatformRestaurant) => void
  onToggleBlock: (restaurant: PlatformRestaurant) => void
  onDelete: (restaurant: PlatformRestaurant) => void
}) {
  const actionCount = restaurants.filter((restaurant) => (restaurant.pendingPayments || 0) > 0 || getRestaurantStatus(restaurant) === 'expired').length
  const activeCount = restaurants.filter((restaurant) => getRestaurantStatus(restaurant) === 'active').length
  const trialCount = restaurants.filter((restaurant) => getRestaurantStatus(restaurant) === 'trial').length
  const query = search.trim().toLowerCase()
  const filtered = restaurants.filter((restaurant) => !query || [restaurant.name, getRestaurantOwnerName(restaurant), getRestaurantOwnerLogin(restaurant), restaurant.city].some((value) => String(value || '').toLowerCase().includes(query)))
  const selected = restaurants.find((restaurant) => restaurant.id === selectedId) || filtered[0] || restaurants[0]

  return (
    <div className="service-owner-stack">
      {message && <div className="service-owner-message">{message}</div>}
      <section className="service-owner-metrics-grid">
        <MetricCard label="Рестораны" value={String(restaurants.length)} text="всего на платформе" icon={<ChefIcon />} tone="blue" />
        <MetricCard label="Активные" value={String(activeCount)} text="с оплаченным доступом" icon={<PaymentIcon />} tone="green" />
        <MetricCard label="Пробный период" value={String(trialCount)} text="после регистрации" icon={<CalendarIcon />} tone="purple" />
        <MetricCard label="Требуют внимания" value={String(actionCount)} text="оплаты или доступ" icon={<AlertCircleIcon />} tone="orange" />
      </section>

      <section className="service-owner-card">
        <div className="service-owner-card__header">
          <div>
            <h2>Рестораны платформы</h2>
            <p>Реальные рестораны из backend. Нажмите на строку, чтобы открыть карточку ресторана.</p>
          </div>
          <button type="button" className="service-owner-primary-button" onClick={onCreate}>Создать ресторан</button>
        </div>

        {isLoading ? <EmptyState title="Загрузка" text="Получаем рестораны из backend." /> : null}
        {!isLoading && filtered.length === 0 ? <EmptyState title="Рестораны не найдены" text="Создайте ресторан или измените поиск." /> : null}

        <div className="service-owner-restaurants-layout">
          <div className="service-owner-restaurant-list service-owner-restaurant-list--compact">
            {filtered.map((restaurant) => {
              const status = getRestaurantStatus(restaurant)
              const selectedClass = selected?.id === restaurant.id ? ' service-owner-restaurant--selected' : ''
              return (
                <button className={`service-owner-restaurant service-owner-restaurant--clickable${selectedClass}`} key={restaurant.id} type="button" onClick={() => setSelectedId(restaurant.id)}>
                  <div className="service-owner-restaurant__summary">
                    <span className="service-owner-restaurant__avatar">{restaurant.name.slice(0, 2)}</span>
                    <div className="service-owner-restaurant__title">
                      <strong>{restaurant.name}</strong>
                      <small>{getRestaurantOwnerName(restaurant)} · сотрудников: {getEmployeeCount(restaurant)}</small>
                    </div>
                    <div className="service-owner-restaurant__badges">
                      {(restaurant.pendingPayments || 0) > 0 && <StatusBadge status="payment_reported">{restaurant.pendingPayments} оплата</StatusBadge>}
                      <StatusBadge status={status}>{statusLabels[status] || status}</StatusBadge>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <aside className="service-owner-card service-owner-details-panel">
            {selected ? (
              <>
                <div className="service-owner-details-panel__header">
                  <span className="service-owner-restaurant__avatar service-owner-restaurant__avatar--large">{selected.name.slice(0, 2)}</span>
                  <div>
                    <h3>{selected.name}</h3>
                    <p>{getRestaurantOwnerName(selected)} · {getRestaurantOwnerLogin(selected)}</p>
                  </div>
                </div>
                <div className="service-owner-details-grid">
                  <div><span>Статус</span><strong>{statusLabels[getRestaurantStatus(selected)] || getRestaurantStatus(selected)}</strong></div>
                  <div><span>Тариф</span><strong>{selected.plan || 'trial'}</strong></div>
                  <div><span>Доступ до</span><strong>{formatDate(getAccessUntil(selected))}</strong></div>
                  <div><span>Сотрудников</span><strong>{getEmployeeCount(selected)}</strong></div>
                  <div><span>Телефон</span><strong>{selected.contactPhone || selected.phone || 'не указан'}</strong></div>
                  <div><span>Email</span><strong>{selected.contactEmail || selected.email || selected.owner?.login || 'не указан'}</strong></div>
                </div>
                <div className="service-owner-row-actions service-owner-row-actions--panel">
                  <button type="button" onClick={() => onExtend(selected)}>+30 дней</button>
                  <button type="button" onClick={() => onIssueInvoice(selected)}>Выставить счёт</button>
                  <button type="button" className="service-owner-danger-button" onClick={() => onToggleBlock(selected)}>{getRestaurantStatus(selected) === 'blocked' ? 'Разблокировать' : 'Заблокировать'}</button>
                  <button type="button" className="service-owner-danger-button" onClick={() => onDelete(selected)}>Удалить ресторан</button>
                </div>
                {selected.latestInvoice ? (
                  <div className="service-owner-latest-invoice service-owner-latest-invoice--panel">
                    <div>
                      <strong>Последний счёт № {selected.latestInvoice.invoiceNumber || selected.latestInvoice.number}</strong>
                      <small>{selected.latestInvoice.plan} · {money(selected.latestInvoice.amount)} · {invoiceStatusLabels[selected.latestInvoice.status || 'issued']}</small>
                    </div>
                  </div>
                ) : <div className="service-owner-empty-line">Оплат пока нет</div>}
              </>
            ) : <EmptyState title="Ресторан не выбран" text="Выберите ресторан слева." />}
          </aside>
        </div>
      </section>
    </div>
  )
}

function PaymentsTab({
  payments,
  restaurants,
  search,
  message,
  onInvoiceStatus,
  onIssueInvoice,
}: {
  payments: Invoice[]
  restaurants: PlatformRestaurant[]
  search: string
  message: string
  onInvoiceStatus: (invoice: Invoice, status: InvoiceStatus) => void
  onIssueInvoice: (restaurant: PlatformRestaurant) => void
}) {
  const query = search.trim().toLowerCase()
  const paymentsWithNames = payments.map((invoice) => ({
    ...invoice,
    restaurantName: invoice.restaurantName || restaurants.find((restaurant) => restaurant.id === invoice.restaurantId)?.name || 'Ресторан не найден',
  }))
  const filtered = paymentsWithNames.filter((invoice) => !query || [invoice.invoiceNumber, invoice.number, invoice.restaurantName, invoice.plan, invoice.period].some((value) => String(value || '').toLowerCase().includes(query)))
  const actionInvoices = filtered.filter((invoice) => ['payment_reported', 'payment_order_attached', 'overdue', 'issued'].includes(String(invoice.status)))

  return (
    <div className="service-owner-payments-layout">
      {message && <div className="service-owner-message service-owner-form-full">{message}</div>}
      <section className="service-owner-card service-owner-issue-card">
        <div className="service-owner-card__header"><div><h2>Выставить счёт</h2><p>Выберите ресторан. Счёт появится в списке оплат.</p></div></div>
        <div className="service-owner-form-grid">
          <label><span>Ресторан</span><select onChange={(event) => { const restaurant = restaurants.find((item) => item.id === event.target.value); if (restaurant) onIssueInvoice(restaurant) }} defaultValue=""><option value="" disabled>Выберите ресторан</option>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>
        </div>
        <div className="service-owner-plan-grid">
          {plans.map((plan) => <button type="button" className={plan.id === 'standard' ? 'service-owner-plan service-owner-plan--active' : 'service-owner-plan'} key={plan.id}><strong>{plan.name}</strong><span>{plan.employees}</span><b>{money(plan.amount)}</b></button>)}
        </div>
      </section>

      <section className="service-owner-card service-owner-invoices-card">
        <div className="service-owner-card__header"><div><h2>Счета ресторанов</h2><p>{actionInvoices.length} требуют действия: проверить оплату, подтвердить или отметить отсутствие платежа.</p></div></div>
        <div className="service-owner-invoice-list">
          {filtered.length === 0 ? <EmptyState title="Счетов нет" text="Выставьте первый счёт ресторану." /> : null}
          {filtered.map((invoice) => {
            const status = invoice.status || 'issued'
            return (
              <article className="service-owner-invoice" key={invoice.id}>
                <div className="service-owner-invoice__summary"><div><strong>№ {invoice.invoiceNumber || invoice.number || invoice.id.slice(0, 6)} · {invoice.restaurantName}</strong><small>{invoice.plan || 'Тариф'} · {money(invoice.amount)} · {invoice.period || 'период не указан'}</small></div><StatusBadge status={status}>{invoiceStatusLabels[status] || status}</StatusBadge></div>
                <div className="service-owner-invoice__meta"><span>Выставлен: {formatDate(invoice.issuedAt)}</span><span>Поручение: {invoice.receiptName || invoice.paymentOrderName || 'не прикреплено'}</span><span>Закрывающий документ: {invoice.closingDocument || 'ещё нет'}</span></div>
                <div className="service-owner-row-actions"><button type="button" onClick={() => alert('Скачивание PDF будет подключено после шаблона счёта.')}>Скачать счёт</button>{(invoice.receiptName || invoice.paymentOrderName) && <button type="button" onClick={() => alert(invoice.receiptName || invoice.paymentOrderName)}>Открыть поручение</button>}{status !== 'paid' && <button type="button" onClick={() => onInvoiceStatus(invoice, 'paid')}>Оплата есть</button>}{status !== 'paid' && <button type="button" className="service-owner-danger-button" onClick={() => onInvoiceStatus(invoice, 'not_found')}>Нет платежа</button>}</div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function RequisitesTab({ message, setMessage }: { message: string; setMessage: (value: string) => void }) {
  return (
    <div className="service-owner-requisites-layout">
      {message && <div className="service-owner-message service-owner-form-full">{message}</div>}
      <section className="service-owner-card">
        <div className="service-owner-card__header"><div><h2>Реквизиты для счетов и документов</h2><p>Эти данные будут использоваться в счёте, акте или УПД.</p></div></div>
        <div className="service-owner-form-grid service-owner-form-grid--wide">
          <label><span>Юридическое название</span><input defaultValue="ИП Иванов Иван Иванович" /></label><label><span>ИНН</span><input defaultValue="231234567890" /></label><label><span>ОГРН / ОГРНИП</span><input defaultValue="323237500000000" /></label><label><span>Юридический адрес</span><input defaultValue="г. Сочи, ул. Морская, 10" /></label><label><span>Банк</span><input defaultValue="Т-Банк" /></label><label><span>БИК</span><input defaultValue="044525974" /></label><label><span>Расчётный счёт</span><input defaultValue="40802810000000000000" /></label><label><span>Корреспондентский счёт</span><input defaultValue="30101810145250000974" /></label><label><span>Email</span><input defaultValue="billing@restocontrol.ru" /></label><label><span>Телефон</span><input defaultValue="+7 900 000-00-00" /></label><label><span>НДС</span><input defaultValue="Без НДС" /></label><label><span>ЭДО</span><input placeholder="Идентификатор ЭДО, если есть" /></label>
        </div>
        <button type="button" className="service-owner-primary-button" onClick={() => setMessage('Реквизиты сохранены в интерфейсе. Постоянное хранение реквизитов сервиса подключим отдельной таблицей.')}>Сохранить реквизиты</button>
      </section>
    </div>
  )
}

function SupportTab({ message, setMessage }: { message: string; setMessage: (value: string) => void }) {
  const items = [
    ['Оплата', 'Проверить оплату по счёту', 'Нужно сверить платёжное поручение и продлить доступ.'],
    ['Доступ', 'Ресторан просит продлить доступ', 'Можно продлить доступ на 30 дней из карточки ресторана.'],
    ['Счёт', 'Не виден счёт', 'Выставьте новый счёт во вкладке Оплаты.'],
  ]
  return (
    <section className="service-owner-card">
      {message && <div className="service-owner-message">{message}</div>}
      <div className="service-owner-card__header"><div><h2>Техподдержка ресторанов</h2><p>Обращения по оплате, доступу и работе сервиса.</p></div></div>
      <div className="service-owner-support-list">
        {items.map(([tag, title, text]) => <article className="service-owner-support-item" key={title}><div><strong>{title}</strong><p>{text}</p><small>Сегодня</small></div><span>{tag}</span><button type="button" onClick={() => setMessage(`${title}: ${text}`)}>Открыть</button></article>)}
      </div>
    </section>
  )
}

function CreateRestaurantTab({ onCreated, message }: { onCreated: (payload: { restaurantName: string; ownerName: string; login: string; password: string }) => void; message: string }) {
  const [form, setForm] = useState({ restaurantName: '', ownerName: '', login: '', password: '', city: '', phone: '', plan: 'Старт' })
  return (
    <section className="service-owner-card service-owner-create-card">
      {message && <div className="service-owner-message">{message}</div>}
      <div className="service-owner-card__header"><div><h2>Создать кабинет ресторана</h2><p>Владелец сервиса может создать ресторан вручную и выдать владельцу логин с паролем.</p></div></div>
      <div className="service-owner-form-grid service-owner-form-grid--wide">
        <label><span>Название ресторана</span><input value={form.restaurantName} onChange={(e) => setForm((prev) => ({ ...prev, restaurantName: e.target.value }))} placeholder="Например: Resto Terrace" /></label>
        <label><span>Владелец</span><input value={form.ownerName} onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))} placeholder="Имя владельца" /></label>
        <label><span>Город</span><input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="Город" /></label>
        <label><span>Телефон</span><input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон" /></label>
        <label><span>Логин владельца</span><input value={form.login} onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))} placeholder="owner@example.ru" /></label>
        <label><span>Временный пароль</span><input value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Минимум 6 символов" /></label>
        <label><span>Тариф</span><select value={form.plan} onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))}><option>Старт</option><option>Команда 20</option><option>Стандарт</option><option>Команда 40</option></select></label>
      </div>
      <button type="button" className="service-owner-primary-button" onClick={() => onCreated(form)}>Создать ресторан</button>
    </section>
  )
}

function NotificationsPopover({ notices, onSelect }: { notices: Notice[]; onSelect: (notice: Notice) => void }) {
  return (
    <div className="service-owner-popover">
      <strong>Уведомления сервиса</strong>
      {notices.length === 0 ? <p>Новых событий нет.</p> : notices.map((notice) => (
        <button key={notice.id} type="button" className="service-owner-popover__item" onClick={() => onSelect(notice)}>
          <span className={`service-owner-dot service-owner-dot--${notice.tone}`} />
          <div><b>{notice.title}</b><small>{notice.text}</small></div>
        </button>
      ))}
    </div>
  )
}

function ProfilePopover({ userName, login }: { userName: string; login: string }) {
  return (
    <div className="service-owner-popover service-owner-profile-popover">
      <strong>{userName}</strong>
      <p>Владелец сервиса</p>
      <small>{login}</small>
    </div>
  )
}

export function ServiceOwnerPage() {
  const { session, logout } = useSession()
  const [tab, setTab] = useState<OwnerTab>('restaurants')
  const [overview, setOverview] = useState<Overview>({ restaurants: [], payments: [] })
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const userName = session?.user.name ?? 'Владелец сервиса'

  async function loadOverview() {
    setIsLoading(true)
    try {
      const data = await apiRequest<Overview>('/api/service-owner/overview')
      setOverview(data)
      setSelectedRestaurantId((current) => current || data.restaurants[0]?.id || '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось загрузить страницу владельца сервиса.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadOverview() }, [])

  const notices = useMemo<Notice[]>(() => {
    const paymentNotices = overview.payments.filter((invoice) => ['payment_reported', 'payment_order_attached', 'overdue', 'issued'].includes(String(invoice.status))).slice(0, 5).map((invoice) => ({
      id: invoice.id,
      title: `Счёт № ${invoice.invoiceNumber || invoice.number || invoice.id.slice(0, 6)}`,
      text: `${overview.restaurants.find((restaurant) => restaurant.id === invoice.restaurantId)?.name || invoice.restaurantName || 'Ресторан'} · ${invoiceStatusLabels[invoice.status || 'issued'] || invoice.status}`,
      tone: (invoice.status === 'overdue' ? 'red' : 'orange') as Notice['tone'],
      tab: 'payments' as OwnerTab,
    }))
    const expired = overview.restaurants.filter((restaurant) => ['expired', 'blocked'].includes(getRestaurantStatus(restaurant))).map((restaurant) => ({
      id: `restaurant_${restaurant.id}`,
      title: restaurant.name,
      text: statusLabels[getRestaurantStatus(restaurant)] || getRestaurantStatus(restaurant),
      tone: (getRestaurantStatus(restaurant) === 'blocked' ? 'red' : 'orange') as Notice['tone'],
      tab: 'restaurants' as OwnerTab,
    }))
    return [...paymentNotices, ...expired]
  }, [overview])

  const paymentActionCount = notices.length
  const pageCopy: Record<OwnerTab, { title: string; subtitle: string; search: string }> = {
    restaurants: { title: 'Владелец сервиса', subtitle: 'Рестораны, доступы и статусы оплаты', search: 'Поиск ресторана...' },
    payments: { title: 'Оплаты', subtitle: 'Счета, платёжные поручения и подтверждение оплат', search: 'Поиск по счетам...' },
    requisites: { title: 'Реквизиты', subtitle: 'Данные для счетов и закрывающих документов', search: 'Поиск...' },
    support: { title: 'Техподдержка', subtitle: 'Обращения ресторанов по доступу и оплате', search: 'Поиск обращений...' },
    create: { title: 'Создать ресторан', subtitle: 'Ручное создание кабинета ресторана', search: 'Поиск...' },
  }

  async function handleCreateRestaurant(payload: { restaurantName: string; ownerName: string; login: string; password: string }) {
    if (!payload.restaurantName.trim() || !payload.ownerName.trim() || !payload.login.trim() || payload.password.length < 6) {
      setMessage('Заполните название ресторана, владельца, логин и пароль от 6 символов.')
      return
    }
    try {
      const created = await apiRequest<{ restaurant: PlatformRestaurant }>('/api/service-owner/restaurants', { method: 'POST', body: JSON.stringify(payload) })
      setMessage(`Ресторан «${created.restaurant.name}» создан. Логин владельца: ${payload.login}, пароль: ${payload.password}`)
      setTab('restaurants')
      await loadOverview()
      setSelectedRestaurantId(created.restaurant.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось создать ресторан.')
    }
  }

  async function handleDeleteRestaurant(restaurant: PlatformRestaurant) {
    const ok = window.confirm(`Удалить ресторан «${restaurant.name}»? Данные ресторана, сотрудники, задачи, брони, ТТК и оплаты будут удалены.`)
    if (!ok) return
    try {
      await apiRequest(`/api/service-owner/restaurants/${restaurant.id}`, { method: 'DELETE' })
      setMessage(`Ресторан «${restaurant.name}» удалён.`)
      setSelectedRestaurantId('')
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось удалить ресторан.')
    }
  }

  async function handleExtendRestaurant(restaurant: PlatformRestaurant) {
    try {
      const updated = await apiRequest<PlatformRestaurant>(`/api/service-owner/restaurants/${restaurant.id}/extend`, { method: 'PATCH', body: JSON.stringify({ days: 30 }) })
      setMessage(`Доступ ресторана «${updated.name}» продлён до ${formatDate(getAccessUntil(updated))}.`)
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось продлить доступ.')
    }
  }

  async function handleToggleBlockRestaurant(restaurant: PlatformRestaurant) {
    try {
      const nextStatus = getRestaurantStatus(restaurant) === 'blocked' ? 'active' : 'blocked'
      await apiRequest<PlatformRestaurant>(`/api/service-owner/restaurants/${restaurant.id}`, { method: 'PATCH', body: JSON.stringify({ subscriptionStatus: nextStatus, status: nextStatus }) })
      setMessage(nextStatus === 'blocked' ? `Ресторан «${restaurant.name}» заблокирован.` : `Ресторан «${restaurant.name}» разблокирован.`)
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось изменить статус.')
    }
  }

  async function handleIssueInvoice(restaurant: PlatformRestaurant) {
    try {
      const plan = plans.find((item) => item.id === 'standard') || plans[0]
      await api.create<Invoice>('payments', {
        restaurantId: restaurant.id,
        invoiceNumber: `${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        restaurantName: restaurant.name,
        plan: plan.name,
        period: '1 месяц',
        amount: plan.amount,
        status: 'issued',
        issuedAt: new Date().toISOString(),
      })
      setMessage(`Счёт для ресторана «${restaurant.name}» выставлен.`)
      setTab('payments')
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось выставить счёт.')
    }
  }

  async function handleInvoiceStatus(invoice: Invoice, status: InvoiceStatus) {
    try {
      await api.update<Invoice>('payments', invoice.id, { status, paidAt: status === 'paid' ? new Date().toISOString() : undefined })
      setMessage(status === 'paid' ? 'Оплата подтверждена.' : 'Платёж отмечен как не найденный.')
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось обновить счёт.')
    }
  }

  function openNotice(notice: Notice) {
    setTab(notice.tab)
    setIsNotificationsOpen(false)
    setMessage(`${notice.title}: ${notice.text}`)
  }

  return (
    <main className="service-owner-page">
      <aside className="service-owner-sidebar">
        <ServiceOwnerBrand />
        <nav className="service-owner-nav" aria-label="Меню владельца сервиса">
          {tabItems.map((item) => <button key={item.id} className={item.id === tab ? 'service-owner-nav__item service-owner-nav__item--active' : 'service-owner-nav__item'} type="button" onClick={() => { setTab(item.id); setMessage('') }}>{item.icon}<span>{item.id === 'payments' && paymentActionCount ? `Оплаты (${paymentActionCount})` : item.label}</span></button>)}
        </nav>
        <div className="service-owner-sidebar-note"><strong>Оплата по счёту</strong><p>Ресторан отмечает оплату, владелец сервиса подтверждает платёж и продлевает доступ.</p></div>
      </aside>
      <section className="service-owner-main">
        <header className="service-owner-topbar">
          <div className="service-owner-title-block"><h1>{pageCopy[tab].title}</h1><p>{pageCopy[tab].subtitle}</p></div>
          <div className="service-owner-topbar__actions">
            <label className="service-owner-search"><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={pageCopy[tab].search} /></label>
            <div className="service-owner-popover-host"><button className="service-owner-icon-button" type="button" aria-label="Уведомления" onClick={() => { setIsNotificationsOpen((value) => !value); setIsProfileOpen(false) }}><BellIcon /><span>{paymentActionCount}</span></button>{isNotificationsOpen && <NotificationsPopover notices={notices} onSelect={openNotice} />}</div>
            <div className="service-owner-popover-host"><button className="service-owner-profile" type="button" onClick={() => { setIsProfileOpen((value) => !value); setIsNotificationsOpen(false) }}><span><UserIcon /></span><div><strong>{userName}</strong><small>Владелец сервиса</small></div></button>{isProfileOpen && <ProfilePopover userName={userName} login={session?.user.login || ''} />}</div>
            <button className="service-owner-logout" type="button" onClick={logout} aria-label="Выйти"><LogoutIcon /></button>
          </div>
        </header>
        {tab === 'restaurants' && <RestaurantsTab restaurants={overview.restaurants} selectedId={selectedRestaurantId} setSelectedId={setSelectedRestaurantId} search={search} isLoading={isLoading} message={message} onCreate={() => setTab('create')} onIssueInvoice={handleIssueInvoice} onExtend={handleExtendRestaurant} onToggleBlock={handleToggleBlockRestaurant} onDelete={handleDeleteRestaurant} />}
        {tab === 'payments' && <PaymentsTab payments={overview.payments} restaurants={overview.restaurants} search={search} message={message} onInvoiceStatus={handleInvoiceStatus} onIssueInvoice={handleIssueInvoice} />}
        {tab === 'requisites' && <RequisitesTab message={message} setMessage={setMessage} />}
        {tab === 'support' && <SupportTab message={message} setMessage={setMessage} />}
        {tab === 'create' && <CreateRestaurantTab onCreated={handleCreateRestaurant} message={message} />}
      </section>
    </main>
  )
}
