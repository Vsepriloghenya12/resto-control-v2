import { useEffect, useMemo, useState } from 'react'
import { CalendarIcon, ClockIcon, SearchIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type HallStatus = 'free' | 'reserved' | 'arrived' | 'occupied' | 'disabled'
type BookingStatus = 'new' | 'confirmed' | 'arrived' | 'seated' | 'cancelled' | 'no_show'
type ViewMode = 'plan' | 'bookings'

type Hall = { id: string; name: string; active: boolean; tablesCount?: number; seatsCount?: number }
type HallTable = { id: string; hallId: string; name: string; seats: number; status: HallStatus; active?: boolean }
type Booking = { id: string; hallId: string; tableId: string; guestName: string; phone: string; time: string; guestsCount: number; status: BookingStatus; comment?: string }

const statusLabels: Record<HallStatus, string> = { free: 'Свободен', reserved: 'Забронирован', arrived: 'Пришли по брони', occupied: 'Гости сели', disabled: 'Недоступен' }
const bookingStatusLabels: Record<BookingStatus, string> = { new: 'Новая', confirmed: 'Подтверждена', arrived: 'Пришли', seated: 'Гости сели', cancelled: 'Отменена', no_show: 'Не пришли' }
const statusOptions = ['Все статусы', 'Свободен', 'Забронирован', 'Пришли по брони', 'Гости сели', 'Недоступен']

function StatusBadge({ status }: { status: HallStatus }) { return <span className={`hall-status hall-status--${status}`}>{statusLabels[status]}</span> }
function BookingStatusBadge({ status }: { status: BookingStatus }) { return <span className={`hall-booking-status hall-booking-status--${status}`}>{bookingStatusLabels[status]}</span> }

function mapBookingStatusToTable(status: BookingStatus): HallStatus {
  if (status === 'arrived') return 'arrived'
  if (status === 'seated') return 'occupied'
  if (status === 'cancelled' || status === 'no_show') return 'free'
  return 'reserved'
}

export function HallBookingsPage() {
  const [halls, setHalls] = useState<Hall[]>([])
  const [tables, setTables] = useState<HallTable[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [selectedTableId, setSelectedTableId] = useState('')
  const [statusFilter, setStatusFilter] = useState('Все статусы')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ViewMode>('plan')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  async function loadHall() {
    setIsLoading(true)
    try {
      const [hallsResult, tablesResult, bookingsResult] = await Promise.all([api.list<Hall>('halls'), api.list<HallTable>('tables'), api.list<Booking>('bookings')])
      const activeHalls = hallsResult.items.filter((hall) => hall.active !== false)
      setHalls(activeHalls)
      setTables(tablesResult.items.filter((table) => table.active !== false))
      setBookings(bookingsResult.items)
      const firstHall = activeHalls[0]
      setSelectedHallId((current) => current || firstHall?.id || '')
      const firstTable = tablesResult.items.find((table) => table.hallId === (firstHall?.id || selectedHallId))
      setSelectedTableId((current) => current || firstTable?.id || '')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadHall() }, [])

  const selectedHall = halls.find((hall) => hall.id === selectedHallId) ?? halls[0]
  const selectedHallTables = tables.filter((table) => table.hallId === selectedHall?.id)
  const selectedTable = tables.find((table) => table.id === selectedTableId && table.hallId === selectedHall?.id) ?? selectedHallTables[0]
  const selectedBooking = bookings.find((booking) => booking.tableId === selectedTable?.id && !['cancelled', 'no_show'].includes(booking.status))

  const filteredTables = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return selectedHallTables.filter((table) => {
      const booking = bookings.find((item) => item.tableId === table.id && !['cancelled', 'no_show'].includes(item.status))
      const matchesStatus = statusFilter === 'Все статусы' || statusLabels[table.status] === statusFilter
      const matchesQuery = !normalized || table.name.toLowerCase().includes(normalized) || (booking?.guestName ?? '').toLowerCase().includes(normalized) || (booking?.phone ?? '').toLowerCase().includes(normalized)
      return matchesStatus && matchesQuery
    })
  }, [bookings, query, selectedHallTables, statusFilter])

  const filteredBookings = bookings.filter((booking) => booking.hallId === selectedHall?.id && !['cancelled', 'no_show'].includes(booking.status))

  function selectHall(hallId: string) {
    setSelectedHallId(hallId)
    setSelectedTableId(tables.find((table) => table.hallId === hallId)?.id ?? '')
  }

  async function setBookingStatus(status: BookingStatus) {
    if (!selectedBooking) return
    const updated = await api.bookingStatus<Booking>(selectedBooking.id, status)
    setBookings((items) => items.map((item) => item.id === updated.id ? updated : item))
    setTables((items) => items.map((item) => item.id === updated.tableId ? { ...item, status: mapBookingStatusToTable(status) } : item))
    setNotice(`Статус брони обновлён: ${bookingStatusLabels[status]}`)
  }

  async function createTable() {
    if (!selectedHall) return
    const table = await api.create<HallTable>('tables', { hallId: selectedHall.id, name: `Стол ${selectedHallTables.length + 1}`, seats: 4, status: 'free', active: true })
    setTables((items) => [...items, table])
    setSelectedTableId(table.id)
    setNotice('Стол создан.')
  }

  async function createBookingForSelectedTable() {
    if (!selectedTable || !selectedHall) return
    const booking = await api.create<Booking>('bookings', { hallId: selectedHall.id, tableId: selectedTable.id, guestName: 'Новая бронь', phone: '+7 900 000-00-00', date: new Date().toISOString().slice(0, 10), time: '19:00', guestsCount: selectedTable.seats, status: 'confirmed', comment: 'Создано из плана зала' })
    setBookings((items) => [booking, ...items])
    setTables((items) => items.map((item) => item.id === selectedTable.id ? { ...item, status: 'reserved' } : item))
    setNotice('Бронь создана.')
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
          <div className="hall-list">
            {halls.map((hall) => {
              const hallTables = tables.filter((table) => table.hallId === hall.id)
              const free = hallTables.filter((item) => item.status === 'free').length
              return <button className={hall.id === selectedHall?.id ? 'hall-card hall-card--active' : 'hall-card'} type="button" key={hall.id} onClick={() => selectHall(hall.id)}><div className="hall-card__top"><strong>{hall.name}</strong><span>Активен</span></div><p>{hallTables.length} столов · {hallTables.reduce((sum, item) => sum + item.seats, 0)} мест</p><div className="hall-card__stats"><span><i className="hall-dot hall-dot--free" />{free}<small>свободно</small></span></div></button>
            })}
            {!isLoading && halls.length === 0 ? <p className="hall-empty-text">Залы ещё не созданы.</p> : null}
          </div>
        </aside>

        <main className="hall-tables-panel">
          <div className="hall-tables-panel__header"><div><h2>{selectedHall?.name || 'План зала'}</h2><p>{selectedHallTables.length} столов · {selectedHallTables.reduce((sum, item) => sum + item.seats, 0)} посадочных мест</p></div><button type="button" onClick={createTable}>+ Стол</button></div>
          {mode === 'plan' ? (
            <div className="hall-table-wrap"><table className="hall-table hall-table--clickable"><thead><tr><th>Стол</th><th>Мест</th><th>Статус</th><th>Бронь</th><th>Гость</th><th>Время</th></tr></thead><tbody>{filteredTables.map((table) => { const booking = bookings.find((item) => item.tableId === table.id && !['cancelled', 'no_show'].includes(item.status)); return <tr className={table.id === selectedTable?.id ? 'hall-table-row--active' : ''} key={table.id} onClick={() => setSelectedTableId(table.id)}><td>{table.name}</td><td>{table.seats}</td><td><StatusBadge status={table.status} /></td><td>{booking ? 'Есть' : '—'}</td><td>{booking?.guestName ?? '—'}</td><td>{booking?.time ?? '—'}</td></tr> })}{!isLoading && filteredTables.length === 0 ? <tr><td colSpan={6}>Столов нет. Создайте первый стол.</td></tr> : null}</tbody></table></div>
          ) : (
            <section className="hall-bookings-list"><div className="hall-bookings-list__header"><h3>Брони на сегодня</h3><button type="button" onClick={createBookingForSelectedTable}>+ Создать бронь</button></div>{filteredBookings.map((booking) => <button className="hall-booking-row" type="button" key={booking.id} onClick={() => { setSelectedTableId(booking.tableId); setMode('plan') }}><span>{booking.time}</span><strong>{booking.guestName}</strong><span>{booking.guestsCount} гостя</span><span>{tables.find((table) => table.id === booking.tableId)?.name}</span><BookingStatusBadge status={booking.status} /></button>)}{filteredBookings.length === 0 ? <p className="hall-empty-text">Броней нет.</p> : null}</section>
          )}
          <div className="hall-legend"><span><i className="hall-dot hall-dot--free" />Свободен</span><span><i className="hall-dot hall-dot--reserved" />Забронирован</span><span><i className="hall-dot hall-dot--arrived" />Пришли по брони</span><span><i className="hall-dot hall-dot--occupied" />Гости сели</span><span><i className="hall-dot hall-dot--disabled" />Недоступен</span></div>
        </main>

        {selectedTable ? <aside className="hall-side-panel"><div className="hall-side-panel__header"><div><h2>{selectedTable.name}</h2><StatusBadge status={selectedTable.status} /></div></div><div className="hall-info-grid"><div><span>Зал</span><strong>{selectedHall?.name}</strong></div><div><span>Посадочных мест</span><strong>{selectedTable.seats}</strong></div></div>{selectedBooking ? <section className="hall-booking-card"><div className="hall-booking-card__top"><h3>Бронь на сегодня</h3><BookingStatusBadge status={selectedBooking.status} /></div><dl><div><dt>Гость</dt><dd>{selectedBooking.guestName}</dd></div><div><dt>Телефон</dt><dd>{selectedBooking.phone}</dd></div><div><dt>Время</dt><dd>{selectedBooking.time}</dd></div><div><dt>Количество гостей</dt><dd>{selectedBooking.guestsCount}</dd></div><div><dt>Комментарий</dt><dd>{selectedBooking.comment}</dd></div></dl><div className="hall-action-stack">{selectedBooking.status !== 'arrived' && selectedBooking.status !== 'seated' ? <button className="hall-arrived-button" type="button" onClick={() => void setBookingStatus('arrived')}>Пришли по брони</button> : null}{selectedBooking.status !== 'seated' ? <button className="hall-seated-button" type="button" onClick={() => void setBookingStatus('seated')}>Гости сели</button> : null}<button className="hall-muted-button" type="button" onClick={() => void setBookingStatus('no_show')}>Не пришли</button><button className="hall-cancel-button" type="button" onClick={() => void setBookingStatus('cancelled')}>Отменить бронь</button></div></section> : <section className="hall-empty-booking"><h3>На этот стол брони нет</h3><button type="button" onClick={createBookingForSelectedTable}>Создать бронь</button></section>}</aside> : null}
      </div>
    </section>
  )
}
