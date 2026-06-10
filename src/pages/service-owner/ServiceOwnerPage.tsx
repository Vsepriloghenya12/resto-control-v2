import { useMemo, useState, type ReactNode } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { AlertCircleIcon, BellIcon, CalendarIcon, ChefIcon, LogoutIcon, PaymentIcon, SearchIcon, SettingsIcon, TeamIcon, UserIcon } from '../../shared/ui/Icon'

type OwnerTab = 'restaurants' | 'payments' | 'requisites' | 'support' | 'create'
type RestaurantStatus = 'trial' | 'active' | 'payment_pending' | 'payment_reported' | 'expired' | 'blocked'
type InvoiceStatus = 'issued' | 'awaiting_payment' | 'payment_reported' | 'payment_order_attached' | 'paid' | 'not_found' | 'overdue'

type PlatformRestaurant = {
  id: string
  name: string
  city: string
  ownerName: string
  phone: string
  email: string
  employees: number
  plan: string
  status: RestaurantStatus
  accessUntil: string
  invoicesCount: number
  checklistRuns: number
  pendingPayments: number
  latestInvoice?: {
    number: string
    plan: string
    amount: number
    status: InvoiceStatus
    receiptName?: string
  }
}

type Invoice = {
  id: string
  number: string
  restaurantName: string
  plan: string
  period: string
  amount: number
  issuedAt: string
  status: InvoiceStatus
  receiptName?: string
  closingDocument?: string
}

const restaurants: PlatformRestaurant[] = [
  { id: 'r1', name: 'Resto Terrace', city: 'Сочи', ownerName: 'Иван Петров', phone: '+7 900 111-22-33', email: 'owner@terrace.ru', employees: 22, plan: 'Стандарт', status: 'payment_reported', accessUntil: '15.06.2026', invoicesCount: 4, checklistRuns: 128, pendingPayments: 1, latestInvoice: { number: '1287', plan: 'Стандарт · 1 месяц', amount: 2990, status: 'payment_reported', receiptName: 'payment-order-1287.pdf' } },
  { id: 'r2', name: 'Resto Bar', city: 'Краснодар', ownerName: 'Алексей Смирнов', phone: '+7 900 444-55-66', email: 'bar@example.ru', employees: 38, plan: 'Команда 40', status: 'active', accessUntil: '30.06.2026', invoicesCount: 6, checklistRuns: 244, pendingPayments: 0, latestInvoice: { number: '1284', plan: 'Команда 40 · 1 месяц', amount: 3990, status: 'paid', receiptName: 'payment-order-1284.pdf' } },
  { id: 'r3', name: 'Север', city: 'Москва', ownerName: 'Мария Иванова', phone: '+7 900 777-88-99', email: 'north@example.ru', employees: 9, plan: 'Старт', status: 'trial', accessUntil: '24.06.2026', invoicesCount: 0, checklistRuns: 17, pendingPayments: 0 },
  { id: 'r4', name: 'Море', city: 'Адлер', ownerName: 'Олег Волков', phone: '+7 900 333-11-22', email: 'sea@example.ru', employees: 14, plan: 'Команда 20', status: 'expired', accessUntil: '04.06.2026', invoicesCount: 2, checklistRuns: 58, pendingPayments: 0, latestInvoice: { number: '1278', plan: 'Команда 20 · 1 месяц', amount: 1990, status: 'overdue' } },
]

const invoices: Invoice[] = [
  { id: 'i1', number: '1287', restaurantName: 'Resto Terrace', plan: 'Стандарт', period: '15.06.2026 — 15.07.2026', amount: 2990, issuedAt: '10.06.2026', status: 'payment_reported', receiptName: 'payment-order-1287.pdf' },
  { id: 'i2', number: '1284', restaurantName: 'Resto Bar', plan: 'Команда 40', period: '01.06.2026 — 30.06.2026', amount: 3990, issuedAt: '29.05.2026', status: 'paid', receiptName: 'payment-order-1284.pdf', closingDocument: 'act-1284.pdf' },
  { id: 'i3', number: '1278', restaurantName: 'Море', plan: 'Команда 20', period: '05.06.2026 — 05.07.2026', amount: 1990, issuedAt: '01.06.2026', status: 'overdue' },
  { id: 'i4', number: '1272', restaurantName: 'Resto Terrace', plan: 'Стандарт', period: '15.05.2026 — 15.06.2026', amount: 2990, issuedAt: '12.05.2026', status: 'paid', receiptName: 'payment-order-1272.pdf', closingDocument: 'upd-1272.pdf' },
]

const plans = [
  { id: 'start', name: 'Старт', employees: 'до 10 сотрудников', amount: '1 490 ₽' },
  { id: 'team20', name: 'Команда 20', employees: 'до 20 сотрудников', amount: '1 990 ₽' },
  { id: 'standard', name: 'Стандарт', employees: 'до 30 сотрудников', amount: '2 990 ₽' },
  { id: 'team40', name: 'Команда 40', employees: 'до 40 сотрудников', amount: '3 990 ₽' },
  { id: 'team50', name: 'Команда 50', employees: 'до 50 сотрудников', amount: '4 990 ₽' },
]

const tabItems: Array<{ id: OwnerTab; label: string; icon: ReactNode }> = [
  { id: 'restaurants', label: 'Рестораны', icon: <ChefIcon /> },
  { id: 'payments', label: 'Оплаты', icon: <PaymentIcon /> },
  { id: 'requisites', label: 'Реквизиты', icon: <SettingsIcon /> },
  { id: 'support', label: 'Техподдержка', icon: <AlertCircleIcon /> },
  { id: 'create', label: 'Создать ресторан', icon: <TeamIcon /> },
]

const statusLabels: Record<RestaurantStatus, string> = {
  trial: 'Пробный период',
  active: 'Активен',
  payment_pending: 'Ожидает оплаты',
  payment_reported: 'Клиент оплатил',
  expired: 'Доступ истёк',
  blocked: 'Заблокирован',
}

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  issued: 'Счёт выставлен',
  awaiting_payment: 'Ожидает оплаты',
  payment_reported: 'Клиент отметил оплату',
  payment_order_attached: 'Поручение прикреплено',
  paid: 'Оплата подтверждена',
  not_found: 'Платёж не найден',
  overdue: 'Просрочен',
}

function money(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`
}

function ServiceOwnerBrand() {
  return (
    <div className="service-owner-brand">
      <img className="service-owner-brand__logo-img" src="/resto-control-logo.png" alt="Ресто Контроль" />
      <span>Владелец сервиса</span>
    </div>
  )
}

function StatusBadge({ status, children }: { status: RestaurantStatus | InvoiceStatus; children: ReactNode }) {
  return <span className={`service-owner-badge service-owner-badge--${status}`}>{children}</span>
}

function MetricCard({ label, value, text, icon, tone }: { label: string; value: string; text: string; icon: ReactNode; tone: string }) {
  return (
    <article className="service-owner-metric">
      <span className={`service-owner-metric__icon service-owner-metric__icon--${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{text}</small>
      </div>
    </article>
  )
}

function RestaurantsTab() {
  const actionCount = restaurants.filter((restaurant) => restaurant.pendingPayments > 0 || restaurant.status === 'expired').length

  return (
    <div className="service-owner-stack">
      <section className="service-owner-metrics-grid">
        <MetricCard label="Рестораны" value="4" text="всего на платформе" icon={<ChefIcon />} tone="blue" />
        <MetricCard label="Активные" value="2" text="с оплаченным доступом" icon={<PaymentIcon />} tone="green" />
        <MetricCard label="Пробный период" value="1" text="14 дней после регистрации" icon={<CalendarIcon />} tone="purple" />
        <MetricCard label="Требуют внимания" value={String(actionCount)} text="оплаты или доступ" icon={<AlertCircleIcon />} tone="orange" />
      </section>

      <section className="service-owner-card">
        <div className="service-owner-card__header">
          <div>
            <h2>Рестораны платформы</h2>
            <p>Статусы доступа, владельцы, сотрудники и последние оплаты.</p>
          </div>
          <button type="button" className="service-owner-primary-button">Создать ресторан</button>
        </div>

        <div className="service-owner-restaurant-list">
          {restaurants.map((restaurant) => (
            <article className="service-owner-restaurant" key={restaurant.id}>
              <div className="service-owner-restaurant__summary">
                <span className="service-owner-restaurant__avatar">{restaurant.name.slice(0, 2)}</span>
                <div className="service-owner-restaurant__title">
                  <strong>{restaurant.name}</strong>
                  <small>{restaurant.city} · {restaurant.ownerName} · сотрудников: {restaurant.employees}</small>
                </div>
                <div className="service-owner-restaurant__badges">
                  {restaurant.pendingPayments > 0 && <StatusBadge status="payment_reported">{restaurant.pendingPayments} оплата</StatusBadge>}
                  <StatusBadge status={restaurant.status}>{statusLabels[restaurant.status]}</StatusBadge>
                </div>
              </div>

              <div className="service-owner-restaurant__details">
                <div><span>Контакты</span><strong>{restaurant.phone}</strong><small>{restaurant.email}</small></div>
                <div><span>Доступ</span><strong>{restaurant.plan}</strong><small>до {restaurant.accessUntil}</small></div>
                <div><span>Активность</span><strong>{restaurant.checklistRuns} чек-листов</strong><small>{restaurant.invoicesCount} оплат</small></div>
              </div>

              {restaurant.latestInvoice ? (
                <div className="service-owner-latest-invoice">
                  <div>
                    <strong>Последняя оплата № {restaurant.latestInvoice.number}</strong>
                    <small>{restaurant.latestInvoice.plan} · {money(restaurant.latestInvoice.amount)} · {invoiceStatusLabels[restaurant.latestInvoice.status]}</small>
                  </div>
                  {restaurant.latestInvoice.receiptName ? <button type="button">Открыть поручение</button> : <em>поручения нет</em>}
                </div>
              ) : <div className="service-owner-empty-line">Оплат пока нет</div>}

              <div className="service-owner-row-actions">
                <button type="button">+30 дней</button>
                <button type="button">Выставить счёт</button>
                <button type="button" className="service-owner-danger-button">Блок</button>
                <button type="button" className="service-owner-danger-button">Удалить</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function PaymentsTab() {
  const actionInvoices = invoices.filter((invoice) => ['payment_reported', 'payment_order_attached', 'overdue'].includes(invoice.status))

  return (
    <div className="service-owner-payments-layout">
      <section className="service-owner-card service-owner-invoice-form-card">
        <div className="service-owner-card__header"><div><h2>Выставить счёт</h2><p>Счёт создаёт владелец сервиса после выбора ресторана, тарифа и периода.</p></div></div>
        <div className="service-owner-form-grid">
          <label><span>Ресторан</span><select defaultValue="Resto Terrace">{restaurants.map((restaurant) => <option key={restaurant.id}>{restaurant.name}</option>)}</select></label>
          <label><span>Период</span><select defaultValue="1 месяц"><option>1 месяц</option><option>3 месяца</option><option>6 месяцев</option><option>12 месяцев</option></select></label>
          <label><span>Начало доступа</span><input type="date" defaultValue="2026-06-15" /></label>
        </div>
        <div className="service-owner-plan-grid">
          {plans.map((plan) => (
            <button type="button" className={plan.id === 'standard' ? 'service-owner-plan service-owner-plan--active' : 'service-owner-plan'} key={plan.id}>
              <strong>{plan.name}</strong><span>{plan.employees}</span><b>{plan.amount}</b>
            </button>
          ))}
        </div>
        <button type="button" className="service-owner-primary-button service-owner-wide-button">Выставить счёт</button>
      </section>

      <section className="service-owner-card service-owner-invoices-card">
        <div className="service-owner-card__header"><div><h2>Счета ресторанов</h2><p>{actionInvoices.length} требуют действия: проверить оплату, подтвердить или отметить отсутствие платежа.</p></div></div>
        <div className="service-owner-invoice-list">
          {invoices.map((invoice) => (
            <article className="service-owner-invoice" key={invoice.id}>
              <div className="service-owner-invoice__summary"><div><strong>№ {invoice.number} · {invoice.restaurantName}</strong><small>{invoice.plan} · {money(invoice.amount)} · {invoice.period}</small></div><StatusBadge status={invoice.status}>{invoiceStatusLabels[invoice.status]}</StatusBadge></div>
              <div className="service-owner-invoice__meta"><span>Выставлен: {invoice.issuedAt}</span><span>Поручение: {invoice.receiptName || 'не прикреплено'}</span><span>Закрывающий документ: {invoice.closingDocument || 'ещё нет'}</span></div>
              <div className="service-owner-row-actions"><button type="button">Скачать счёт</button>{invoice.receiptName && <button type="button">Открыть поручение</button>}{invoice.status !== 'paid' && <button type="button">Оплата есть</button>}{invoice.status !== 'paid' && <button type="button" className="service-owner-danger-button">Нет платежа</button>}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function RequisitesTab() {
  return (
    <div className="service-owner-requisites-layout">
      <section className="service-owner-card">
        <div className="service-owner-card__header"><div><h2>Реквизиты для счетов и документов</h2><p>Эти данные попадают в счёт, акт или УПД для ресторанов.</p></div></div>
        <div className="service-owner-form-grid service-owner-form-grid--wide">
          <label><span>Юридическое название</span><input defaultValue="ИП Иванов Иван Иванович" /></label><label><span>ИНН</span><input defaultValue="231234567890" /></label><label><span>ОГРН / ОГРНИП</span><input defaultValue="323237500000000" /></label><label><span>Юридический адрес</span><input defaultValue="г. Сочи, ул. Морская, 10" /></label><label><span>Банк</span><input defaultValue="Т-Банк" /></label><label><span>БИК</span><input defaultValue="044525974" /></label><label><span>Расчётный счёт</span><input defaultValue="40802810000000000000" /></label><label><span>Корреспондентский счёт</span><input defaultValue="30101810145250000974" /></label><label><span>Email</span><input defaultValue="billing@restocontrol.ru" /></label><label><span>Телефон</span><input defaultValue="+7 900 000-00-00" /></label><label><span>НДС</span><input defaultValue="Без НДС" /></label><label><span>ЭДО</span><input placeholder="Идентификатор ЭДО, если есть" /></label>
        </div>
        <button type="button" className="service-owner-primary-button">Сохранить реквизиты</button>
      </section>
      <section className="service-owner-card">
        <div className="service-owner-card__header"><div><h2>Оплата переводом</h2><p>Куда ресторан может перевести оплату, если счёт оплачивается не через банк-клиент.</p></div></div>
        <div className="service-owner-form-grid"><label><span>Получатель</span><input defaultValue="Resto Control" /></label><label><span>Телефон / СБП</span><input defaultValue="+7 900 000-00-00" /></label><label><span>Карта</span><input placeholder="Номер карты, если используется" /></label><label><span>Банк</span><input defaultValue="Т-Банк" /></label><label className="service-owner-form-full"><span>Комментарий</span><input defaultValue="После оплаты нажмите «Оплатил» и прикрепите платёжное поручение, если оно есть." /></label></div>
      </section>
    </div>
  )
}

function SupportTab() {
  return (
    <section className="service-owner-card">
      <div className="service-owner-card__header"><div><h2>Техподдержка ресторанов</h2><p>Обращения по оплате, доступу и работе сервиса.</p></div></div>
      <div className="service-owner-support-list">
        {[
          ['Resto Terrace', 'Нужно проверить оплату по счёту №1287', 'Оплата', 'Сегодня 12:40'],
          ['Море', 'Просит продлить доступ на 3 дня до оплаты', 'Доступ', 'Вчера 19:10'],
          ['Север', 'Не видит счёт после окончания пробного периода', 'Счёт', 'Вчера 14:25'],
        ].map(([restaurant, text, tag, time]) => <article className="service-owner-support-item" key={`${restaurant}-${time}`}><div><strong>{restaurant}</strong><p>{text}</p><small>{time}</small></div><span>{tag}</span><button type="button">Открыть</button></article>)}
      </div>
    </section>
  )
}

function CreateRestaurantTab() {
  return (
    <section className="service-owner-card service-owner-create-card">
      <div className="service-owner-card__header"><div><h2>Создать кабинет ресторана</h2><p>Владелец сервиса может создать ресторан вручную и выдать владельцу логин с паролем.</p></div></div>
      <div className="service-owner-form-grid service-owner-form-grid--wide">
        <label><span>Название ресторана</span><input placeholder="Например: Resto Terrace" /></label><label><span>Владелец</span><input placeholder="Имя владельца" /></label><label><span>Город</span><input placeholder="Город" /></label><label><span>Телефон</span><input placeholder="Телефон" /></label><label><span>Email</span><input placeholder="Email" /></label><label><span>Логин владельца</span><input placeholder="owner@example.ru" /></label><label><span>Временный пароль</span><input placeholder="Минимум 6 символов" /></label><label><span>Тариф</span><select defaultValue="Старт"><option>Старт</option><option>Команда 20</option><option>Стандарт</option><option>Команда 40</option></select></label>
      </div>
      <button type="button" className="service-owner-primary-button">Создать ресторан</button>
    </section>
  )
}

export function ServiceOwnerPage() {
  const { session, logout } = useSession()
  const [tab, setTab] = useState<OwnerTab>('restaurants')
  const userName = session?.user.name ?? 'Владелец сервиса'
  const paymentActionCount = useMemo(() => invoices.filter((invoice) => ['payment_reported', 'payment_order_attached', 'overdue'].includes(invoice.status)).length, [])
  const pageCopy: Record<OwnerTab, { title: string; subtitle: string; search: string }> = {
    restaurants: { title: 'Владелец сервиса', subtitle: 'Рестораны, доступы и статусы оплаты', search: 'Поиск ресторана...' },
    payments: { title: 'Оплаты', subtitle: 'Счета, платёжные поручения и подтверждение оплат', search: 'Поиск по счетам...' },
    requisites: { title: 'Реквизиты', subtitle: 'Данные для счетов и закрывающих документов', search: 'Поиск...' },
    support: { title: 'Техподдержка', subtitle: 'Обращения ресторанов по доступу и оплате', search: 'Поиск обращений...' },
    create: { title: 'Создать ресторан', subtitle: 'Ручное создание кабинета ресторана', search: 'Поиск...' },
  }

  return (
    <main className="service-owner-page">
      <aside className="service-owner-sidebar">
        <ServiceOwnerBrand />
        <nav className="service-owner-nav" aria-label="Меню владельца сервиса">
          {tabItems.map((item) => <button key={item.id} className={item.id === tab ? 'service-owner-nav__item service-owner-nav__item--active' : 'service-owner-nav__item'} type="button" onClick={() => setTab(item.id)}>{item.icon}<span>{item.id === 'payments' && paymentActionCount ? `Оплаты (${paymentActionCount})` : item.label}</span></button>)}
        </nav>
        <div className="service-owner-sidebar-note"><strong>Оплата по счёту</strong><p>Ресторан отмечает оплату, владелец сервиса подтверждает платёж и продлевает доступ.</p></div>
      </aside>
      <section className="service-owner-main">
        <header className="service-owner-topbar">
          <div className="service-owner-title-block"><h1>{pageCopy[tab].title}</h1><p>{pageCopy[tab].subtitle}</p></div>
          <div className="service-owner-topbar__actions"><label className="service-owner-search"><SearchIcon /><input placeholder={pageCopy[tab].search} /></label><button className="service-owner-icon-button" type="button" aria-label="Уведомления"><BellIcon /><span>{paymentActionCount}</span></button><button className="service-owner-profile" type="button"><span><UserIcon /></span><div><strong>{userName}</strong><small>Владелец сервиса</small></div></button><button className="service-owner-logout" type="button" onClick={logout} aria-label="Выйти"><LogoutIcon /></button></div>
        </header>
        {tab === 'restaurants' && <RestaurantsTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'requisites' && <RequisitesTab />}
        {tab === 'support' && <SupportTab />}
        {tab === 'create' && <CreateRestaurantTab />}
      </section>
    </main>
  )
}
