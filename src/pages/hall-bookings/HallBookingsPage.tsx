import { useMemo, useState } from 'react'
import { CalendarIcon, ClockIcon, SearchIcon } from '../../shared/ui/Icon'

type HallStatus = 'free' | 'reserved' | 'arrived' | 'occupied' | 'disabled'
type BookingStatus = 'new' | 'confirmed' | 'arrived' | 'seated' | 'cancelled' | 'no_show'
type ViewMode = 'plan' | 'bookings'

type Hall = { id: string; name: string; active: boolean }
type HallTable = { id: string; hallId: string; name: string; seats: number; status: HallStatus; nearestTime?: string; guestName?: string; guestsCount?: number; phone?: string; comment?: string }
type Booking = { id: string; hallId: string; tableId: string; guestName: string; phone: string; time: string; guestsCount: number; status: BookingStatus; comment?: string }

const initialHalls: Hall[] = [
  { id: 'main', name: 'Основной зал', active: true },
  { id: 'terrace', name: 'Терраса', active: true },
  { id: 'vip', name: 'VIP-зал', active: true },
  { id: 'bar', name: 'Барная зона', active: true },
]

const initialTables: HallTable[] = [
  { id: 't1', hallId: 'main', name: 'Стол 1', seats: 2, status: 'free' },
  { id: 't2', hallId: 'main', name: 'Стол 2', seats: 4, status: 'free' },
  { id: 't3', hallId: 'main', name: 'Стол 3', seats: 2, status: 'disabled' },
  { id: 't4', hallId: 'main', name: 'Стол 4', seats: 6, status: 'arrived', nearestTime: '19:30', guestName: 'Дмитрий Волков', guestsCount: 6, phone: '+7 921 222-44-10', comment: 'Гости уже в холле' },
  { id: 't5', hallId: 'main', name: 'Стол 5', seats: 4, status: 'reserved', nearestTime: '20:00', guestName: 'Анна Смирнова', guestsCount: 4, phone: '+7 921 123-45-67', comment: 'У окна, детский стул' },
  { id: 't6', hallId: 'main', name: 'Стол 6', seats: 4, status: 'free' },
  { id: 'tr1', hallId: 'terrace', name: 'Стол T1', seats: 4, status: 'reserved', nearestTime: '19:00', guestName: 'Павел Орлов', guestsCount: 4, phone: '+7 921 651-23-78', comment: 'Терраса, ближе к краю' },
  { id: 'tr2', hallId: 'terrace', name: 'Стол T2', seats: 2, status: 'free' },
  { id: 'tr3', hallId: 'terrace', name: 'Стол T3', seats: 6, status: 'occupied', nearestTime: '18:00', guestName: 'Елена Соколова', guestsCount: 6, phone: '+7 921 672-00-91', comment: 'Гости сели' },
  { id: 'vip1', hallId: 'vip', name: 'VIP 1', seats: 6, status: 'reserved', nearestTime: '20:30', guestName: 'Игорь Лебедев', guestsCount: 6, phone: '+7 921 700-11-22', comment: 'Закрытый ужин' },
  { id: 'bar1', hallId: 'bar', name: 'Бар 1', seats: 2, status: 'free' },
  { id: 'bar2', hallId: 'bar', name: 'Бар 2', seats: 2, status: 'reserved', nearestTime: '21:30', guestName: 'Артём Николаев', guestsCount: 2, phone: '+7 921 903-55-13', comment: 'У бара' },
]

const initialBookings: Booking[] = [
  { id: 'b1', hallId: 'main', tableId: 't4', guestName: 'Дмитрий Волков', phone: '+7 921 222-44-10', time: '19:30', guestsCount: 6, status: 'arrived', comment: 'Гости уже в холле' },
  { id: 'b2', hallId: 'main', tableId: 't5', guestName: 'Анна Смирнова', phone: '+7 921 123-45-67', time: '20:00', guestsCount: 4, status: 'confirmed', comment: 'У окна, детский стул' },
  { id: 'b3', hallId: 'terrace', tableId: 'tr3', guestName: 'Елена Соколова', phone: '+7 921 672-00-91', time: '18:00', guestsCount: 6, status: 'seated', comment: 'Гости сели' },
  { id: 'b4', hallId: 'vip', tableId: 'vip1', guestName: 'Игорь Лебедев', phone: '+7 921 700-11-22', time: '20:30', guestsCount: 6, status: 'confirmed', comment: 'Закрытый ужин' },
]

const statusLabels: Record<HallStatus, string> = { free: 'Свободен', reserved: 'Забронирован', arrived: 'Пришли по брони', occupied: 'Гости сели', disabled: 'Недоступен' }
const bookingStatusLabels: Record<BookingStatus, string> = { new: 'Новая', confirmed: 'Подтверждена', arrived: 'Пришли', seated: 'Гости сели', cancelled: 'Отменена', no_show: 'Не пришли' }
const statusOptions = ['Все статусы', 'Свободен', 'Забронирован', 'Пришли по брони', 'Гости сели', 'Недоступен']

function StatusBadge({ status }: { status: HallStatus }) { return <span className={`hall-status hall-status--${status}`}>{statusLabels[status]}</span> }
function BookingStatusBadge({ status }: { status: BookingStatus }) { return <span className={`hall-booking-status hall-booking-status--${status}`}>{bookingStatusLabels[status]}</span> }

function HallCard({ hall, active, tables, onSelect }: { hall: Hall; active: boolean; tables: HallTable[]; onSelect: () => void }) {
  const free = tables.filter((item) => item.status === 'free').length
  const reserved = tables.filter((item) => item.status === 'reserved' || item.status === 'arrived').length
  const occupied = tables.filter((item) => item.status === 'occupied').length
  const seats = tables.reduce((sum, item) => sum + item.seats, 0)
  return (
    <button className={active ? 'hall-card hall-card--active' : 'hall-card'} type="button" onClick={onSelect}>
      <div className="hall-card__top"><strong>{hall.name}</strong><span>{hall.active ? 'Активен' : 'Выключен'}</span></div>
      <p>{tables.length} столов · {seats} посадочных мест</p>
      <div className="hall-card__stats"><span><i className="hall-dot hall-dot--free" />{free}<small>свободно</small></span><span><i className="hall-dot hall-dot--reserved" />{reserved}<small>брони</small></span><span><i className="hall-dot hall-dot--occupied" />{occupied}<small>занято</small></span></div>
    </button>
  )
}

function mapBookingStatusToTable(status: BookingStatus): HallStatus {
  if (status === 'arrived') return 'arrived'
  if (status === 'seated') return 'occupied'
  if (status === 'cancelled' || status === 'no_show') return 'free'
  return 'reserved'
}

export function HallBookingsPage() {
  const [halls] = useState(initialHalls)
  const [tables, setTables] = useState(initialTables)
  const [bookings, setBookings] = useState(initialBookings)
  const [selectedHallId, setSelectedHallId] = useState(halls[0].id)
  const [selectedTableId, setSelectedTableId] = useState('t5')
  const [statusFilter, setStatusFilter] = useState('Все статусы')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ViewMode>('plan')
  const [notice, setNotice] = useState('')

  const selectedHall = halls.find((hall) => hall.id === selectedHallId) ?? halls[0]
  const selectedHallTables = tables.filter((table) => table.hallId === selectedHall.id)
  const selectedTable = tables.find((table) => table.id === selectedTableId && table.hallId === selectedHall.id) ?? selectedHallTables[0]
  const selectedBooking = bookings.find((booking) => booking.tableId === selectedTable?.id && !['cancelled', 'no_show'].includes(booking.status))

  const filteredTables = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return selectedHallTables.filter((table) => {
      const matchesStatus = statusFilter === 'Все статусы' || statusLabels[table.status] === statusFilter
      const matchesQuery = !normalized || table.name.toLowerCase().includes(normalized) || (table.guestName ?? '').toLowerCase().includes(normalized) || (table.phone ?? '').toLowerCase().includes(normalized)
      return matchesStatus && matchesQuery
    })
  }, [query, selectedHallTables, statusFilter])

  const filteredBookings = bookings.filter((booking) => booking.hallId === selectedHall.id && !['cancelled', 'no_show'].includes(booking.status))

  function selectHall(hallId: string) {
    setSelectedHallId(hallId)
    setSelectedTableId(tables.find((table) => table.hallId === hallId)?.id ?? '')
  }

  function setBookingStatus(status: BookingStatus) {
    if (!selectedTable || !selectedBooking) return
    setBookings((items) => items.map((item) => item.id === selectedBooking.id ? { ...item, status } : item))
    const tableStatus = mapBookingStatusToTable(status)
    setTables((items) => items.map((item) => item.id === selectedTable.id ? { ...item, status: tableStatus, ...(tableStatus === 'free' ? { guestName: undefined, nearestTime: undefined, guestsCount: undefined, phone: undefined, comment: undefined } : {}) } : item))
    setNotice(`Статус брони обновлён: ${bookingStatusLabels[status]}`)
  }

  function createBookingForSelectedTable() {
    if (!selectedTable) return
    const id = `booking_${Date.now()}`
    const booking: Booking = { id, hallId: selectedTable.hallId, tableId: selectedTable.id, guestName: 'Новая бронь', phone: '+7 900 000-00-00', time: '19:00', guestsCount: selectedTable.seats, status: 'confirmed', comment: 'Создано из плана зала' }
    setBookings((items) => [booking, ...items])
    setTables((items) => items.map((item) => item.id === selectedTable.id ? { ...item, status: 'reserved', nearestTime: booking.time, guestName: booking.guestName, guestsCount: booking.guestsCount, phone: booking.phone, comment: booking.comment } : item))
    setNotice('Бронь создана. Откройте карточку стола, чтобы изменить детали.')
  }

  return (
    <section className="hall-page">
      {notice ? <div className="hall-notice">{notice}</div> : null}
      <div className="hall-page-toolbar">
        <div className="hall-tabs" role="tablist" aria-label="Режим страницы">
          <button className={mode === 'plan' ? 'hall-tab hall-tab--active' : 'hall-tab'} type="button" onClick={() => setMode('plan')}>План зала</button>
          <button className={mode === 'bookings' ? 'hall-tab hall-tab--active' : 'hall-tab'} type="button" onClick={() => setMode('bookings')}>Брони</button>
        </div>
        <div className="hall-filters">
          <label className="hall-date-filter"><CalendarIcon /><input value="сегодня" readOnly /></label>
          <label className="hall-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск гостя или телефона" /></label>
          <label className="hall-select"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="hall-reset-button" type="button" onClick={() => { setQuery(''); setStatusFilter('Все статусы') }}>Сбросить</button>
        </div>
      </div>

      <div className="hall-workspace">
        <aside className="hall-list-panel">
          <div className="hall-list-panel__header"><h2>Залы</h2></div>
          <div className="hall-list">{halls.map((hall) => <HallCard key={hall.id} hall={hall} active={hall.id === selectedHall.id} tables={tables.filter((table) => table.hallId === hall.id)} onSelect={() => selectHall(hall.id)} />)}</div>
        </aside>

        <main className="hall-tables-panel">
          <div className="hall-tables-panel__header"><div><h2>{selectedHall.name}</h2><p>{selectedHallTables.length} столов · {selectedHallTables.reduce((sum, item) => sum + item.seats, 0)} посадочных мест</p></div></div>
          {mode === 'plan' ? (
            <div className="hall-table-wrap">
              <table className="hall-table hall-table--clickable">
                <thead><tr><th>Стол</th><th>Мест</th><th>Статус</th><th>Бронь</th><th>Гость</th><th>Время</th></tr></thead>
                <tbody>{filteredTables.map((table) => <tr className={table.id === selectedTable?.id ? 'hall-table-row--active' : ''} key={table.id} onClick={() => setSelectedTableId(table.id)}><td>{table.name}</td><td>{table.seats}</td><td><StatusBadge status={table.status} /></td><td>{table.nearestTime ? 'Есть' : '—'}</td><td>{table.guestName ?? '—'}</td><td>{table.nearestTime ?? '—'}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <section className="hall-bookings-list">
              <div className="hall-bookings-list__header"><h3>Брони на сегодня</h3><button type="button" onClick={createBookingForSelectedTable}>+ Создать бронь</button></div>
              {filteredBookings.map((booking) => <button className="hall-booking-row" type="button" key={booking.id} onClick={() => { setSelectedTableId(booking.tableId); setMode('plan') }}><span>{booking.time}</span><strong>{booking.guestName}</strong><span>{booking.guestsCount} гостя</span><span>{tables.find((table) => table.id === booking.tableId)?.name}</span><BookingStatusBadge status={booking.status} /></button>)}
            </section>
          )}
          <div className="hall-legend"><span><i className="hall-dot hall-dot--free" />Свободен</span><span><i className="hall-dot hall-dot--reserved" />Забронирован</span><span><i className="hall-dot hall-dot--arrived" />Пришли по брони</span><span><i className="hall-dot hall-dot--occupied" />Гости сели</span><span><i className="hall-dot hall-dot--disabled" />Недоступен</span></div>
        </main>

        {selectedTable ? (
          <aside className="hall-side-panel">
            <div className="hall-side-panel__header"><div><h2>{selectedTable.name}</h2><StatusBadge status={selectedTable.status} /></div></div>
            <div className="hall-info-grid"><div><span>Зал</span><strong>{selectedHall.name}</strong></div><div><span>Посадочных мест</span><strong>{selectedTable.seats}</strong></div></div>
            {selectedBooking ? (
              <section className="hall-booking-card">
                <div className="hall-booking-card__top"><h3>Бронь на сегодня</h3><BookingStatusBadge status={selectedBooking.status} /></div>
                <dl><div><dt>Гость</dt><dd>{selectedBooking.guestName}</dd></div><div><dt>Телефон</dt><dd>{selectedBooking.phone}</dd></div><div><dt>Время</dt><dd>{selectedBooking.time}</dd></div><div><dt>Количество гостей</dt><dd>{selectedBooking.guestsCount}</dd></div><div><dt>Комментарий</dt><dd>{selectedBooking.comment}</dd></div></dl>
                <div className="hall-action-stack">
                  {selectedBooking.status !== 'arrived' && selectedBooking.status !== 'seated' ? <button className="hall-arrived-button" type="button" onClick={() => setBookingStatus('arrived')}>Пришли по брони</button> : null}
                  {selectedBooking.status !== 'seated' ? <button className="hall-seated-button" type="button" onClick={() => setBookingStatus('seated')}>Гости сели</button> : null}
                  <button className="hall-muted-button" type="button" onClick={() => setBookingStatus('no_show')}>Не пришли</button>
                  <button className="hall-cancel-button" type="button" onClick={() => setBookingStatus('cancelled')}>Отменить бронь</button>
                </div>
              </section>
            ) : (
              <section className="hall-empty-booking"><h3>На этот стол брони нет</h3><p>Создайте бронь для выбранного стола.</p><button type="button" onClick={createBookingForSelectedTable}>Создать бронь</button></section>
            )}
          </aside>
        ) : null}
      </div>

      <section className="hall-help-note"><ClockIcon /><p>Нажмите на строку стола или бронь. Статусы меняются только в карточке справа, без дублей действий в таблице.</p></section>
    </section>
  )
}
