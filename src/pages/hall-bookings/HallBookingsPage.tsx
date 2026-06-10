import { useMemo, useState } from 'react'
import {
  CalendarIcon,
  ClockIcon,
  SearchIcon,
  SettingsIcon,
  TeamIcon,
} from '../../shared/ui/Icon'

type HallStatus = 'free' | 'reserved' | 'arrived' | 'occupied' | 'disabled'
type BookingStatus = 'new' | 'confirmed' | 'arrived' | 'seated' | 'cancelled' | 'no_show'
type PanelMode = 'table' | 'hall-settings' | 'booking'
type ViewMode = 'plan' | 'bookings'

type Hall = {
  id: string
  name: string
  tablesCount: number
  seatsCount: number
  freeCount: number
  reservedCount: number
  occupiedCount: number
  active: boolean
}

type HallTable = {
  id: string
  hallId: string
  name: string
  seats: number
  status: HallStatus
  nearestTime?: string
  guestName?: string
  guestsCount?: number
  phone?: string
  comment?: string
}

type Booking = {
  id: string
  hallId: string
  tableId: string
  guestName: string
  phone: string
  time: string
  guestsCount: number
  status: BookingStatus
  comment?: string
}

const halls: Hall[] = [
  { id: 'main', name: 'Основной зал', tablesCount: 12, seatsCount: 48, freeCount: 7, reservedCount: 3, occupiedCount: 2, active: true },
  { id: 'terrace', name: 'Терраса', tablesCount: 8, seatsCount: 32, freeCount: 5, reservedCount: 2, occupiedCount: 1, active: true },
  { id: 'vip', name: 'VIP-зал', tablesCount: 4, seatsCount: 16, freeCount: 2, reservedCount: 1, occupiedCount: 1, active: true },
  { id: 'bar', name: 'Барная зона', tablesCount: 6, seatsCount: 18, freeCount: 4, reservedCount: 1, occupiedCount: 1, active: true },
]

const tables: HallTable[] = [
  { id: 't1', hallId: 'main', name: 'Стол 1', seats: 2, status: 'free' },
  { id: 't2', hallId: 'main', name: 'Стол 2', seats: 4, status: 'free' },
  { id: 't3', hallId: 'main', name: 'Стол 3', seats: 2, status: 'disabled' },
  { id: 't4', hallId: 'main', name: 'Стол 4', seats: 6, status: 'arrived', nearestTime: '19:30', guestName: 'Дмитрий Волков', guestsCount: 6, phone: '+7 921 222-44-10', comment: 'Гости уже в холле' },
  { id: 't5', hallId: 'main', name: 'Стол 5', seats: 4, status: 'reserved', nearestTime: '20:00', guestName: 'Анна Смирнова', guestsCount: 4, phone: '+7 921 123-45-67', comment: 'У окна, детский стул' },
  { id: 't6', hallId: 'main', name: 'Стол 6', seats: 4, status: 'free' },
  { id: 't7', hallId: 'main', name: 'Стол 7', seats: 4, status: 'reserved', nearestTime: '18:30', guestName: 'Ольга Петрова', guestsCount: 4, phone: '+7 921 333-12-00', comment: 'Попросили тихий стол' },
  { id: 't8', hallId: 'main', name: 'Стол 8', seats: 8, status: 'occupied', nearestTime: '20:15', guestName: 'Сергей Иванов', guestsCount: 8, phone: '+7 921 444-55-66', comment: 'Компания на день рождения' },
  { id: 't9', hallId: 'main', name: 'Стол 9', seats: 2, status: 'free' },
  { id: 't10', hallId: 'main', name: 'Стол 10', seats: 4, status: 'reserved', nearestTime: '21:00', guestName: 'Мария Кузнецова', guestsCount: 3, phone: '+7 921 555-77-88', comment: 'Без алкоголя' },
  { id: 'tr1', hallId: 'terrace', name: 'Стол T1', seats: 4, status: 'reserved', nearestTime: '19:00', guestName: 'Павел Орлов', guestsCount: 4, phone: '+7 921 651-23-78', comment: 'Терраса, ближе к краю' },
  { id: 'tr2', hallId: 'terrace', name: 'Стол T2', seats: 2, status: 'free' },
  { id: 'tr3', hallId: 'terrace', name: 'Стол T3', seats: 6, status: 'occupied', nearestTime: '18:00', guestName: 'Елена Соколова', guestsCount: 6, phone: '+7 921 672-00-91', comment: 'Гости сели' },
  { id: 'vip1', hallId: 'vip', name: 'VIP 1', seats: 6, status: 'reserved', nearestTime: '20:30', guestName: 'Игорь Лебедев', guestsCount: 6, phone: '+7 921 700-11-22', comment: 'Закрытый ужин' },
  { id: 'bar1', hallId: 'bar', name: 'Бар 1', seats: 2, status: 'free' },
  { id: 'bar2', hallId: 'bar', name: 'Бар 2', seats: 2, status: 'reserved', nearestTime: '21:30', guestName: 'Артём Николаев', guestsCount: 2, phone: '+7 921 903-55-13', comment: 'У бара' },
]

const bookings: Booking[] = [
  { id: 'b1', hallId: 'main', tableId: 't7', guestName: 'Ольга Петрова', phone: '+7 921 333-12-00', time: '18:30', guestsCount: 4, status: 'arrived', comment: 'Попросили тихий стол' },
  { id: 'b2', hallId: 'main', tableId: 't5', guestName: 'Анна Смирнова', phone: '+7 921 123-45-67', time: '20:00', guestsCount: 4, status: 'confirmed', comment: 'У окна, детский стул' },
  { id: 'b3', hallId: 'main', tableId: 't8', guestName: 'Сергей Иванов', phone: '+7 921 444-55-66', time: '20:15', guestsCount: 8, status: 'seated', comment: 'Компания на день рождения' },
  { id: 'b4', hallId: 'main', tableId: 't10', guestName: 'Мария Кузнецова', phone: '+7 921 555-77-88', time: '21:00', guestsCount: 3, status: 'confirmed', comment: 'Без алкоголя' },
]

const statusLabels: Record<HallStatus, string> = {
  free: 'Свободен',
  reserved: 'Забронирован',
  arrived: 'Пришли по брони',
  occupied: 'Гости сели',
  disabled: 'Недоступен',
}

const bookingStatusLabels: Record<BookingStatus, string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  arrived: 'Пришли',
  seated: 'Гости сели',
  cancelled: 'Отменена',
  no_show: 'Не пришли',
}

const statusOptions = ['Все статусы', 'Свободен', 'Забронирован', 'Пришли по брони', 'Гости сели', 'Недоступен']

function StatusBadge({ status }: { status: HallStatus }) {
  return <span className={`hall-status hall-status--${status}`}>{statusLabels[status]}</span>
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`hall-booking-status hall-booking-status--${status}`}>{bookingStatusLabels[status]}</span>
}

function HallCard({ hall, active, onSelect }: { hall: Hall; active: boolean; onSelect: () => void }) {
  return (
    <button className={active ? 'hall-card hall-card--active' : 'hall-card'} type="button" onClick={onSelect}>
      <div className="hall-card__top">
        <strong>{hall.name}</strong>
        <span>{hall.active ? 'Активен' : 'Выключен'}</span>
      </div>
      <p>{hall.tablesCount} столов · {hall.seatsCount} посадочных мест</p>
      <div className="hall-card__stats">
        <span><i className="hall-dot hall-dot--free" />{hall.freeCount}<small>свободно</small></span>
        <span><i className="hall-dot hall-dot--reserved" />{hall.reservedCount}<small>забронировано</small></span>
        <span><i className="hall-dot hall-dot--occupied" />{hall.occupiedCount}<small>занято</small></span>
      </div>
    </button>
  )
}

function TableDetails({ table, hall, onSettings }: { table: HallTable; hall: Hall; onSettings: () => void }) {
  const hasBooking = Boolean(table.guestName)

  return (
    <aside className="hall-side-panel">
      <div className="hall-side-panel__header">
        <div>
          <h2>{table.name}</h2>
          <StatusBadge status={table.status} />
        </div>
        <button type="button" aria-label="Настройки зала" onClick={onSettings}><SettingsIcon /></button>
      </div>

      <div className="hall-info-grid">
        <div>
          <span>Зал</span>
          <strong>{hall.name}</strong>
        </div>
        <div>
          <span>Посадочных мест</span>
          <strong>{table.seats} места</strong>
        </div>
      </div>

      {hasBooking ? (
        <section className="hall-booking-card">
          <div className="hall-booking-card__top">
            <h3>Бронь на 09.06.2026</h3>
            <span>№ 1287</span>
          </div>
          <dl>
            <div><dt>Гость</dt><dd>{table.guestName}</dd></div>
            <div><dt>Телефон</dt><dd>{table.phone}</dd></div>
            <div><dt>Время</dt><dd>{table.nearestTime}</dd></div>
            <div><dt>Количество гостей</dt><dd>{table.guestsCount} гостя</dd></div>
            <div><dt>Комментарий</dt><dd>{table.comment}</dd></div>
          </dl>
          <div className="hall-action-stack">
            <button className="hall-arrived-button" type="button">Пришли по брони</button>
            <button className="hall-seated-button" type="button">Гости сели</button>
            <button className="hall-cancel-button" type="button">Отменить бронь</button>
            <button className="hall-muted-button" type="button">Отметить не пришли</button>
          </div>
        </section>
      ) : (
        <section className="hall-empty-booking">
          <h3>На этот стол брони нет</h3>
          <p>Можно создать бронь или временно сделать стол недоступным.</p>
          <button type="button">Создать бронь</button>
        </section>
      )}
    </aside>
  )
}

function HallSettingsPanel({ hall, hallTables }: { hall: Hall; hallTables: HallTable[] }) {
  return (
    <aside className="hall-side-panel hall-settings-panel">
      <div className="hall-side-panel__header">
        <div>
          <h2>Настройки зала</h2>
          <p>{hall.name}</p>
        </div>
      </div>

      <div className="hall-form-grid">
        <label>
          <span>Название зала</span>
          <input defaultValue={hall.name} />
        </label>
        <div className="hall-summary-pair">
          <div>
            <span>Столов</span>
            <strong>{hall.tablesCount}</strong>
          </div>
          <div>
            <span>Посадочных мест</span>
            <strong>{hall.seatsCount}</strong>
          </div>
        </div>
        <label className="hall-switch-row">
          <span>Зал активен</span>
          <input type="checkbox" defaultChecked={hall.active} />
        </label>
      </div>

      <section className="hall-settings-tables">
        <div className="hall-settings-tables__header">
          <h3>Столы зала</h3>
          <button type="button">+ Добавить стол</button>
        </div>
        <div className="hall-settings-tables__list">
          {hallTables.slice(0, 6).map((table) => (
            <div className="hall-settings-table-row" key={table.id}>
              <input defaultValue={table.name} aria-label="Название стола" />
              <input defaultValue={table.seats} aria-label="Количество мест" />
              <select defaultValue={table.status} aria-label="Статус стола">
                <option value="free">Свободен</option>
                <option value="reserved">Забронирован</option>
                <option value="arrived">Пришли по брони</option>
                <option value="occupied">Гости сели</option>
                <option value="disabled">Недоступен</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="hall-action-stack">
        <button className="hall-save-button" type="button">Сохранить настройки</button>
        <button className="hall-muted-button" type="button">Добавить стол</button>
        <button className="hall-cancel-button" type="button">Удалить зал</button>
      </div>
    </aside>
  )
}

export function HallBookingsPage() {
  const [selectedHallId, setSelectedHallId] = useState(halls[0].id)
  const [selectedTableId, setSelectedTableId] = useState('t5')
  const [statusFilter, setStatusFilter] = useState('Все статусы')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ViewMode>('plan')
  const [panelMode, setPanelMode] = useState<PanelMode>('table')

  const selectedHall = halls.find((hall) => hall.id === selectedHallId) ?? halls[0]
  const selectedHallTables = tables.filter((table) => table.hallId === selectedHall.id)
  const selectedTable = tables.find((table) => table.id === selectedTableId && table.hallId === selectedHall.id) ?? selectedHallTables[0]

  const filteredTables = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return selectedHallTables.filter((table) => {
      const matchesStatus = statusFilter === 'Все статусы' || statusLabels[table.status] === statusFilter
      const matchesQuery = !normalized
        || table.name.toLowerCase().includes(normalized)
        || (table.guestName ?? '').toLowerCase().includes(normalized)
        || (table.phone ?? '').toLowerCase().includes(normalized)
      return matchesStatus && matchesQuery
    })
  }, [query, selectedHallTables, statusFilter])

  const filteredBookings = bookings.filter((booking) => booking.hallId === selectedHall.id)

  return (
    <section className="hall-page">
      <div className="hall-page-toolbar">
        <div className="hall-tabs" role="tablist" aria-label="Режим страницы">
          <button className={mode === 'plan' ? 'hall-tab hall-tab--active' : 'hall-tab'} type="button" onClick={() => setMode('plan')}>План зала</button>
          <button className={mode === 'bookings' ? 'hall-tab hall-tab--active' : 'hall-tab'} type="button" onClick={() => setMode('bookings')}>Брони</button>
        </div>

        <div className="hall-filters">
          <label className="hall-date-filter">
            <CalendarIcon />
            <input value="09.06.2026" readOnly />
          </label>
          <label className="hall-search">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск гостя или телефона" />
          </label>
          <label className="hall-select">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button className="hall-reset-button" type="button" onClick={() => { setQuery(''); setStatusFilter('Все статусы') }}>Сбросить</button>
        </div>
      </div>

      <div className="hall-workspace">
        <aside className="hall-list-panel">
          <div className="hall-list-panel__header">
            <h2>Залы</h2>
            <button type="button">+ Добавить зал</button>
          </div>

          <div className="hall-list">
            {halls.map((hall) => (
              <HallCard
                hall={hall}
                active={hall.id === selectedHall.id}
                onSelect={() => {
                  setSelectedHallId(hall.id)
                  setSelectedTableId(tables.find((table) => table.hallId === hall.id)?.id ?? '')
                  setPanelMode('table')
                }}
                key={hall.id}
              />
            ))}
          </div>
        </aside>

        <main className="hall-tables-panel">
          <div className="hall-tables-panel__header">
            <div>
              <h2>{selectedHall.name}</h2>
              <p>{selectedHall.tablesCount} столов · {selectedHall.seatsCount} посадочных мест</p>
            </div>
            <div>
              <button className="hall-secondary-button" type="button">+ Добавить стол</button>
              <button className="hall-secondary-button" type="button" onClick={() => setPanelMode('hall-settings')}><SettingsIcon /> Настройки зала</button>
            </div>
          </div>

          {mode === 'plan' ? (
            <div className="hall-table-wrap">
              <table className="hall-table">
                <thead>
                  <tr>
                    <th>Стол</th>
                    <th>Мест</th>
                    <th>Статус</th>
                    <th>Ближайшая бронь</th>
                    <th>Гость</th>
                    <th>Время</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTables.map((table) => (
                    <tr className={table.id === selectedTable?.id ? 'hall-table-row--active' : ''} key={table.id}>
                      <td>{table.name}</td>
                      <td>{table.seats}</td>
                      <td><StatusBadge status={table.status} /></td>
                      <td>{table.nearestTime ?? '—'}</td>
                      <td>{table.guestName ?? '—'}</td>
                      <td>{table.nearestTime ?? '—'}</td>
                      <td>
                        <button type="button" onClick={() => { setSelectedTableId(table.id); setPanelMode('table') }}>
                          {table.guestName ? 'Открыть' : 'Создать бронь'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="hall-bookings-list">
              <div className="hall-bookings-list__header">
                <h3>Брони на 09.06.2026</h3>
                <button type="button">+ Создать бронь</button>
              </div>
              {filteredBookings.map((booking) => (
                <button className="hall-booking-row" type="button" key={booking.id} onClick={() => { setSelectedTableId(booking.tableId); setPanelMode('table') }}>
                  <span>{booking.time}</span>
                  <strong>{booking.guestName}</strong>
                  <span>{booking.guestsCount} гостя</span>
                  <span>{tables.find((table) => table.id === booking.tableId)?.name}</span>
                  <BookingStatusBadge status={booking.status} />
                </button>
              ))}
            </section>
          )}

          <div className="hall-legend">
            <span><i className="hall-dot hall-dot--free" />Свободен</span>
            <span><i className="hall-dot hall-dot--reserved" />Забронирован</span>
            <span><i className="hall-dot hall-dot--arrived" />Пришли по брони</span>
            <span><i className="hall-dot hall-dot--occupied" />Гости сели</span>
            <span><i className="hall-dot hall-dot--disabled" />Недоступен</span>
          </div>
        </main>

        {panelMode === 'hall-settings'
          ? <HallSettingsPanel hall={selectedHall} hallTables={selectedHallTables} />
          : selectedTable && <TableDetails table={selectedTable} hall={selectedHall} onSettings={() => setPanelMode('hall-settings')} />}
      </div>

      <section className="hall-help-note">
        <ClockIcon />
        <p>Статусы столов меняются через бронь: «Пришли по брони» и «Гости сели» — разные этапы посадки.</p>
      </section>
    </section>
  )
}
