import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarIcon, ClockIcon, SearchIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type HallStatus = 'free' | 'reserved' | 'arrived' | 'occupied' | 'disabled'
type BookingStatus = 'new' | 'confirmed' | 'arrived' | 'seated' | 'cancelled' | 'no_show'
type ViewMode = 'plan' | 'schema' | 'bookings'

type Hall = { id: string; name: string; active: boolean; tablesCount?: number; seatsCount?: number; schemaElements?: SchemaElement[]; schemaW?: number; schemaH?: number }
type HallTable = { id: string; hallId: string; name: string; seats: number; status: HallStatus; active?: boolean; x?: number; y?: number; w?: number; h?: number; shape?: 'rect' | 'circle' }
type Booking = { id: string; hallId: string; tableId: string; guestName: string; phone: string; time: string; guestsCount: number; status: BookingStatus; comment?: string }
type SchemaElement = { id: string; type: 'wall' | 'entrance'; x: number; y: number; w: number; h: number }

const statusLabels: Record<HallStatus, string> = { free: 'Свободен', reserved: 'Забронирован', arrived: 'Пришли по брони', occupied: 'Гости за столом', disabled: 'Недоступен' }
const bookingStatusLabels: Record<BookingStatus, string> = { new: 'Новая', confirmed: 'Подтверждена', arrived: 'Пришли', seated: 'Гости за столом', cancelled: 'Отменена', no_show: 'Не пришли' }
const statusOptions = ['Все статусы', 'Свободен', 'Забронирован', 'Пришли по брони', 'Гости за столом', 'Недоступен']

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
  const [dateMode, setDateMode] = useState<'day' | 'period'>('day')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [periodFrom, setPeriodFrom] = useState(new Date().toISOString().slice(0, 10))
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10))
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [hallEditModal, setHallEditModal] = useState<Hall | null>(null)
  const [hallEditName, setHallEditName] = useState('')
  const [hallEditCount, setHallEditCount] = useState(0)
  const [hallTablesModal, setHallTablesModal] = useState(false)
  type TableDraft = { name: string; seats: number }
  const [tableDrafts, setTableDrafts] = useState<TableDraft[]>([])

  // Schema state
  const [schemaEditMode, setSchemaEditMode] = useState(false)
  const [schemaElements, setSchemaElements] = useState<SchemaElement[]>([])
  const [schemaSize, setSchemaSize] = useState<{ w: number; h: number }>({ w: 800, h: 520 })
  // local overrides while editing
  const [editTables, setEditTables] = useState<Record<string, Partial<HallTable>>>({})
  const schemaRef = useRef<HTMLDivElement>(null)
  type DragTarget = { kind: 'table'; id: string } | { kind: 'element'; id: string } | { kind: 'resize-table'; id: string } | { kind: 'resize-element'; id: string }
  const dragRef = useRef<{ target: DragTarget; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null)

  function getTableState(table: HallTable): HallTable {
    return { ...table, ...editTables[table.id] }
  }

  function startDrag(e: React.MouseEvent, target: DragTarget, origX: number, origY: number, origW = 0, origH = 0) {
    if (!schemaEditMode) return
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { target, startX: e.clientX, startY: e.clientY, origX, origY, origW, origH }
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      const { target: t, origX: ox, origY: oy, origW: ow, origH: oh } = dragRef.current
      if (t.kind === 'table') {
        setEditTables(prev => ({ ...prev, [t.id]: { ...prev[t.id], x: Math.max(0, ox + dx), y: Math.max(0, oy + dy) } }))
      } else if (t.kind === 'resize-table') {
        setEditTables(prev => ({ ...prev, [t.id]: { ...prev[t.id], w: Math.max(60, ow + dx), h: Math.max(50, oh + dy) } }))
      } else if (t.kind === 'element') {
        setSchemaElements(prev => prev.map(el => el.id === t.id ? { ...el, x: Math.max(0, ox + dx), y: Math.max(0, oy + dy) } : el))
      } else if (t.kind === 'resize-element') {
        setSchemaElements(prev => prev.map(el => el.id === t.id ? { ...el, w: Math.max(20, ow + dx), h: Math.max(10, oh + dy) } : el))
      }
    }
    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function enterEditMode() {
    const overrides: Record<string, Partial<HallTable>> = {}
    const COL_W = 130; const ROW_H = 100; const COLS = 4; const PAD = 20
    selectedHallTables.forEach((t, i) => {
      const hasPos = t.x != null && t.y != null
      const col = i % COLS; const row = Math.floor(i / COLS)
      overrides[t.id] = {
        x: hasPos ? t.x : PAD + col * COL_W,
        y: hasPos ? t.y : PAD + row * ROW_H,
        w: t.w ?? 100,
        h: t.h ?? 70,
        shape: t.shape ?? 'rect',
      }
    })
    setEditTables(overrides)
    setSchemaElements(selectedHall?.schemaElements ?? [])
    setSchemaSize({ w: selectedHall?.schemaW ?? 800, h: selectedHall?.schemaH ?? 520 })
    setSchemaEditMode(true)
  }

  async function saveSchema() {
    // save each table position/size/shape
    await Promise.all(selectedHallTables.map(t => {
      const ov = editTables[t.id]
      if (!ov) return Promise.resolve()
      return api.update('tables', t.id, { x: Math.round(ov.x ?? t.x ?? 40), y: Math.round(ov.y ?? t.y ?? 40), w: Math.round(ov.w ?? t.w ?? 100), h: Math.round(ov.h ?? t.h ?? 70), shape: ov.shape ?? t.shape ?? 'rect' })
    }))
    // save elements and canvas size to hall
    if (selectedHall) await api.update('halls', selectedHall.id, { schemaElements, schemaW: schemaSize.w, schemaH: schemaSize.h })
    // update local state
    setTables(prev => prev.map(t => {
      const ov = editTables[t.id]
      return ov ? { ...t, ...ov } : t
    }))
    setHalls(prev => prev.map(h => h.id === selectedHall?.id ? { ...h, schemaElements, schemaW: schemaSize.w, schemaH: schemaSize.h } : h))
    setSchemaEditMode(false)
    setEditTables({})
  }

  function addSchemaElement(type: SchemaElement['type']) {
    const el: SchemaElement = { id: Math.random().toString(36).slice(2), type, x: 80, y: 80, w: type === 'wall' ? 160 : 60, h: type === 'wall' ? 12 : 40 }
    setSchemaElements(prev => [...prev, el])
  }

  function removeSchemaElement(id: string) {
    setSchemaElements(prev => prev.filter(el => el.id !== id))
  }

  type BookingDraft = { guestName: string; phone: string; date: string; time: string; guestsCount: number; comment: string; tableIds: string[] }
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>({ guestName: '', phone: '', date: new Date().toISOString().slice(0, 10), time: '19:00', guestsCount: 2, comment: '', tableIds: [] })

  function formatDateLabel() {
    if (dateMode === 'day') {
      const d = new Date(selectedDate)
      const today = new Date().toISOString().slice(0, 10)
      if (selectedDate === today) return 'Сегодня'
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    }
    const f = new Date(periodFrom).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    const t = new Date(periodTo).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    return `${f} — ${t}`
  }

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
      // не открываем модал автоматически
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadHall() }, [])

  const selectedHall = halls.find((hall) => hall.id === selectedHallId) ?? halls[0]
  const selectedHallTables = tables.filter((table) => table.hallId === selectedHall?.id)
  const selectedTable = tables.find((table) => table.id === selectedTableId && table.hallId === selectedHall?.id)
  const selectedBooking = bookings.find((booking) => booking.tableId === selectedTable?.id && !['cancelled', 'no_show'].includes(booking.status))
  const selectedTableBookings = bookings.filter((booking) => booking.tableId === selectedTable?.id && !['cancelled', 'no_show'].includes(booking.status))

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
    setSelectedTableId('')
  }

  async function setBookingStatus(bookingId: string, status: BookingStatus) {
    const updated = await api.bookingStatus<Booking>(bookingId, status)
    setBookings((items) => items.map((item) => item.id === updated.id ? updated : item))
    setTables((items) => items.map((item) => item.id === updated.tableId ? { ...item, status: mapBookingStatusToTable(status) } : item))
    setNotice(`Статус брони обновлён: ${bookingStatusLabels[status]}`)
  }

  async function createHall() {
    const hall = await api.create<Hall>('halls', { name: `Зал ${halls.length + 1}`, active: true })
    setHalls((items) => [...items, hall])
    setSelectedHallId(hall.id)
  }

  function openHallEdit(hall: Hall) {
    setHallEditModal(hall)
    setHallEditName(hall.name)
    const count = tables.filter((t) => t.hallId === hall.id).length
    setHallEditCount(count)
    setHallTablesModal(false)
  }

  function proceedToTables() {
    const existing = tables.filter((t) => t.hallId === hallEditModal!.id)
    const drafts: TableDraft[] = Array.from({ length: hallEditCount }, (_, i) => ({
      name: existing[i]?.name ?? `Стол ${i + 1}`,
      seats: existing[i]?.seats ?? 4,
    }))
    setTableDrafts(drafts)
    setHallTablesModal(true)
  }

  async function saveHallAndTables() {
    if (!hallEditModal) return
    await api.update<Hall>('halls', hallEditModal.id, { name: hallEditName.trim() || hallEditModal.name })
    setHalls((items) => items.map((h) => h.id === hallEditModal.id ? { ...h, name: hallEditName.trim() || h.name } : h))
    const existing = tables.filter((t) => t.hallId === hallEditModal.id)
    // update or create tables
    const updated: HallTable[] = []
    for (let i = 0; i < tableDrafts.length; i++) {
      const draft = tableDrafts[i]
      if (existing[i]) {
        const upd = await api.update<HallTable>('tables', existing[i].id, { name: draft.name, seats: draft.seats })
        updated.push(upd)
      } else {
        const created = await api.create<HallTable>('tables', { hallId: hallEditModal.id, name: draft.name, seats: draft.seats, status: 'free', active: true })
        updated.push(created)
      }
    }
    // remove excess tables
    for (let i = tableDrafts.length; i < existing.length; i++) {
      await api.remove('tables', existing[i].id)
    }
    setTables((items) => {
      const without = items.filter((t) => t.hallId !== hallEditModal.id)
      return [...without, ...updated]
    })
    setHallEditModal(null)
    setHallTablesModal(false)
  }

  async function deleteHall(hall: Hall) {
    if (!window.confirm(`Удалить зал «${hall.name}»? Все столы этого зала тоже будут удалены.`)) return
    const hallTables = tables.filter((t) => t.hallId === hall.id)
    await Promise.all(hallTables.map((t) => api.remove('tables', t.id)))
    await api.remove('halls', hall.id)
    const nextHalls = halls.filter((h) => h.id !== hall.id)
    setHalls(nextHalls)
    setTables((items) => items.filter((t) => t.hallId !== hall.id))
    setSelectedHallId(nextHalls[0]?.id || '')
  }

  async function createTable() {
    if (!selectedHall) return
    const table = await api.create<HallTable>('tables', { hallId: selectedHall.id, name: `Стол ${selectedHallTables.length + 1}`, seats: 4, status: 'free', active: true })
    setTables((items) => [...items, table])
    setSelectedTableId(table.id)
    setNotice('Стол создан.')
  }

  function openBookingModal(preselectedTableId?: string) {
    const tableId = preselectedTableId || selectedTable?.id || ''
    setBookingDraft({ guestName: '', phone: '', date: selectedDate, time: '19:00', guestsCount: 2, comment: '', tableIds: tableId ? [tableId] : [] })
    setBookingModalOpen(true)
  }

  async function saveBooking() {
    if (!selectedHall || bookingDraft.tableIds.length === 0) return
    const created: Booking[] = []
    for (const tableId of bookingDraft.tableIds) {
      const booking = await api.create<Booking>('bookings', { hallId: selectedHall.id, tableId, guestName: bookingDraft.guestName.trim() || 'Гость', phone: bookingDraft.phone.trim(), date: bookingDraft.date, time: bookingDraft.time, guestsCount: bookingDraft.guestsCount, status: 'confirmed', comment: bookingDraft.comment.trim() })
      created.push(booking)
    }
    setBookings((items) => [...created, ...items])
    setTables((items) => items.map((item) => bookingDraft.tableIds.includes(item.id) ? { ...item, status: 'reserved' } : item))
    setBookingModalOpen(false)
    setNotice(`Бронь создана (${created.length} стол${created.length === 1 ? '' : created.length < 5 ? 'а' : 'ов'}).`)
  }

  return (
    <section className="hall-page">
      {notice ? <div className="hall-notice">{notice}</div> : null}

      <div className="hall-date-bar">
        <button className="hall-date-filter hall-date-filter--btn" type="button" onClick={() => setDateModalOpen(true)}>
          <CalendarIcon /><span>{formatDateLabel()}</span>
        </button>
        <button className="hall-add-hall-btn" type="button" onClick={() => void createHall()}>+ Добавить зал</button>
      </div>

      {dateModalOpen ? (
        <div className="hall-modal-backdrop" onMouseDown={() => setDateModalOpen(false)}>
          <div className="hall-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hall-modal__header">
              <h3>Выбор даты</h3>
              <button type="button" className="hall-modal__close" onClick={() => setDateModalOpen(false)}>✕</button>
            </div>
            <div className="hall-modal__body">
              <div className="hall-date-modal__tabs">
                <button type="button" className={dateMode === 'day' ? 'active' : ''} onClick={() => setDateMode('day')}>Один день</button>
                <button type="button" className={dateMode === 'period' ? 'active' : ''} onClick={() => setDateMode('period')}>Период</button>
              </div>
              {dateMode === 'day' ? (
                <label className="hall-date-modal__field"><span>Дата</span><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></label>
              ) : (
                <div className="hall-date-modal__period">
                  <label className="hall-date-modal__field"><span>С</span><input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} /></label>
                  <label className="hall-date-modal__field"><span>По</span><input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} /></label>
                </div>
              )}
              <div className="hall-date-modal__shortcuts">
                {dateMode === 'day' ? (<>
                  <button type="button" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>Сегодня</button>
                  <button type="button" onClick={() => { const t = new Date(); t.setDate(t.getDate() + 1); setSelectedDate(t.toISOString().slice(0, 10)) }}>Завтра</button>
                </>) : (
                  <button type="button" onClick={() => { const t = new Date(); const from = new Date(t); from.setDate(t.getDate() - t.getDay() + 1); const to = new Date(from); to.setDate(from.getDate() + 6); setPeriodFrom(from.toISOString().slice(0, 10)); setPeriodTo(to.toISOString().slice(0, 10)) }}>Эта неделя</button>
                )}
              </div>
              <button className="hall-add-hall-btn" style={{ width: '100%', marginTop: 4 }} type="button" onClick={() => setDateModalOpen(false)}>Применить</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hall-halls-bar">
        {halls.map((hall) => {
          const hallTables = tables.filter((table) => table.hallId === hall.id)
          return (
            <button
              key={hall.id}
              type="button"
              className={hall.id === selectedHall?.id ? 'hall-halls-bar__item hall-halls-bar__item--active' : 'hall-halls-bar__item'}
              onClick={() => selectHall(hall.id)}
            >
              <span className="hall-halls-bar__name">{hall.name}</span>
              <span className="hall-halls-bar__meta">{hallTables.length} ст · {hallTables.reduce((s, t) => s + t.seats, 0)} мест</span>
              <span className="hall-halls-bar__edit" role="button" onClick={(e) => { e.stopPropagation(); openHallEdit(hall) }}>✎</span>
              <span className="hall-halls-bar__delete" role="button" onClick={(e) => { e.stopPropagation(); void deleteHall(hall) }}>✕</span>
            </button>
          )
        })}
        {!isLoading && halls.length === 0 && <span className="hall-empty-text" style={{ padding: '0 8px' }}>Залов нет</span>}
      </div>

      <div className="hall-workspace">
        <main className="hall-tables-panel">
          <div className="hall-tables-panel__header">
            <div><h2>{selectedHall?.name || 'План зала'}</h2><p>{selectedHallTables.length} столов · {selectedHallTables.reduce((sum, item) => sum + item.seats, 0)} посадочных мест</p></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="hall-view-toggle">
                <button type="button" className={mode === 'plan' ? 'hall-view-toggle__btn hall-view-toggle__btn--active' : 'hall-view-toggle__btn'} onClick={() => setMode('plan')}>Список</button>
                <button type="button" className={mode === 'schema' ? 'hall-view-toggle__btn hall-view-toggle__btn--active' : 'hall-view-toggle__btn'} onClick={() => setMode('schema')}>Схема</button>
                <button type="button" className={mode === 'bookings' ? 'hall-view-toggle__btn hall-view-toggle__btn--active' : 'hall-view-toggle__btn'} onClick={() => setMode('bookings')}>Брони</button>
              </div>
              <button type="button" onClick={createTable}>+ Стол</button>
            </div>
          </div>
          {mode === 'plan' ? (
            <div className="hall-table-wrap"><table className="hall-table hall-table--clickable"><thead><tr><th>Стол</th><th>Мест</th><th>Статус</th><th>Бронь</th><th>Гость</th><th>Время</th></tr></thead><tbody>{filteredTables.map((table) => { const booking = bookings.find((item) => item.tableId === table.id && !['cancelled', 'no_show'].includes(item.status)); return <tr key={table.id} onClick={() => setSelectedTableId(table.id)}><td>{table.name}</td><td>{table.seats}</td><td><StatusBadge status={table.status} /></td><td>{booking ? 'Есть' : '—'}</td><td>{booking?.guestName ?? '—'}</td><td>{booking?.time ?? '—'}</td></tr> })}{!isLoading && filteredTables.length === 0 ? <tr><td colSpan={6}>Столов нет. Создайте первый стол.</td></tr> : null}</tbody></table></div>
          ) : mode === 'schema' ? (
            <>
              <div
                className="hall-schema"
                ref={schemaRef}
                style={{
                  width: schemaEditMode ? schemaSize.w : (selectedHall?.schemaW ?? 'auto'),
                  minHeight: schemaEditMode ? schemaSize.h : (selectedHall?.schemaH ?? 520),
                }}
              >
                {/* Элементы схемы (перегородки, вход) */}
                {(schemaEditMode ? schemaElements : (selectedHall?.schemaElements ?? [])).map(el => (
                  <div
                    key={el.id}
                    className={`hall-schema-element hall-schema-element--${el.type}`}
                    style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
                    onMouseDown={schemaEditMode ? (e) => startDrag(e, { kind: 'element', id: el.id }, el.x, el.y, el.w, el.h) : undefined}
                  >
                    <span className="hall-schema-element__label">{el.type === 'entrance' ? '🚪 Вход' : ''}</span>
                    {schemaEditMode && (
                      <>
                        <button type="button" className="hall-schema-delete" onMouseDown={e => e.stopPropagation()} onClick={() => removeSchemaElement(el.id)}>✕</button>
                        <div className="hall-schema-resize" onMouseDown={(e) => startDrag(e, { kind: 'resize-element', id: el.id }, el.x, el.y, el.w, el.h)} />
                      </>
                    )}
                  </div>
                ))}
                {/* Столы */}
                {selectedHallTables.map((rawTable) => {
                  const table = schemaEditMode ? getTableState(rawTable) : rawTable
                  const booking = bookings.find(b => b.tableId === table.id && !['cancelled', 'no_show'].includes(b.status))
                  const x = table.x ?? 40; const y = table.y ?? 40
                  const w = table.w ?? 100; const h = table.h ?? 70
                  const isCircle = table.shape === 'circle'
                  return (
                    <div
                      key={table.id}
                      className={`hall-schema-table hall-schema-table--${table.status}${isCircle ? ' hall-schema-table--circle' : ''}`}
                      style={{ left: x, top: y, width: w, height: h }}
                      onMouseDown={schemaEditMode ? (e) => startDrag(e, { kind: 'table', id: table.id }, x, y, w, h) : undefined}
                      onClick={!schemaEditMode ? () => setSelectedTableId(table.id) : undefined}
                    >
                      <span className="hall-schema-table__name">{table.name}</span>
                      <span className="hall-schema-table__seats">{table.seats} мест</span>
                      {booking && <span className="hall-schema-table__guest">{booking.guestName}</span>}
                      {schemaEditMode && (
                        <>
                          <button
                            type="button"
                            className="hall-schema-shape-btn"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => setEditTables(prev => ({ ...prev, [table.id]: { ...prev[table.id], shape: isCircle ? 'rect' : 'circle' } }))}
                          >{isCircle ? '⬜' : '⭕'}</button>
                          <div className="hall-schema-resize" onMouseDown={(e) => startDrag(e, { kind: 'resize-table', id: table.id }, x, y, w, h)} />
                        </>
                      )}
                    </div>
                  )
                })}
                {selectedHallTables.length === 0 && <p className="hall-schema__empty">Столов нет. Создайте первый стол.</p>}
                {schemaEditMode && (
                  <div
                    className="hall-schema-canvas-resize"
                    onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      const startX = e.clientX; const startY = e.clientY
                      const origW = schemaSize.w; const origH = schemaSize.h
                      function onMove(ev: MouseEvent) {
                        setSchemaSize({ w: Math.max(400, origW + ev.clientX - startX), h: Math.max(300, origH + ev.clientY - startY) })
                      }
                      function onUp() {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                  />
                )}
              </div>
              {/* Нижняя панель схемы */}
              <div className="hall-schema-toolbar">
                {schemaEditMode ? (
                  <>
                    <button type="button" className="hall-schema-toolbar__btn" onClick={() => addSchemaElement('wall')}>+ Перегородка</button>
                    <button type="button" className="hall-schema-toolbar__btn" onClick={() => addSchemaElement('entrance')}>+ Вход</button>
                    <div style={{ flex: 1 }} />
                    <button type="button" className="hall-schema-toolbar__save" onClick={() => void saveSchema()}>Сохранить схему</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1 }} />
                    <button type="button" className="hall-schema-toolbar__edit" onClick={enterEditMode}>Редактировать схему</button>
                  </>
                )}
              </div>
            </>
          ) : (
            <section className="hall-bookings-list"><div className="hall-bookings-list__header"><h3>Брони на сегодня</h3><button type="button" onClick={() => openBookingModal()}>+ Создать бронь</button></div>{filteredBookings.map((booking) => <button className="hall-booking-row" type="button" key={booking.id} onClick={() => { setSelectedTableId(booking.tableId); setMode('plan') }}><span>{booking.time}</span><strong>{booking.guestName}</strong><span>{booking.guestsCount} гостя</span><span>{tables.find((table) => table.id === booking.tableId)?.name}</span><BookingStatusBadge status={booking.status} /></button>)}{filteredBookings.length === 0 ? <p className="hall-empty-text">Броней нет.</p> : null}</section>
          )}
          <div className="hall-legend"><span><i className="hall-dot hall-dot--free" />Свободен</span><span><i className="hall-dot hall-dot--reserved" />Забронирован</span><span><i className="hall-dot hall-dot--arrived" />Пришли по брони</span><span><i className="hall-dot hall-dot--occupied" />Гости за столом</span><span><i className="hall-dot hall-dot--disabled" />Недоступен</span></div>
        </main>

        {selectedTable ? (
          <div className="hall-modal-backdrop" onMouseDown={() => setSelectedTableId('')}>
            <div className="hall-modal hall-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
              <div className="hall-modal__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3>{selectedTable.name}</h3>
                  <StatusBadge status={selectedTable.status} />
                </div>
                <button type="button" className="hall-modal__close" onClick={() => setSelectedTableId('')}>✕</button>
              </div>
              <div className="hall-modal__body">
                <div className="hall-info-grid">
                  <div><span>Зал</span><strong>{selectedHall?.name}</strong></div>
                  <div><span>Посадочных мест</span><strong>{selectedTable.seats}</strong></div>
                </div>
                {selectedTableBookings.length === 0 ? (
                  <section className="hall-empty-booking">
                    <h3>На этот стол брони нет</h3>
                    <button type="button" onClick={() => openBookingModal(selectedTable.id)}>Создать бронь</button>
                  </section>
                ) : (
                  <>
                    {selectedTableBookings.map((booking) => (
                      <section className="hall-booking-card" key={booking.id}>
                        <div className="hall-booking-card__top"><h3>{booking.time} · {booking.guestName}</h3><BookingStatusBadge status={booking.status} /></div>
                        <dl>
                          <div><dt>Телефон</dt><dd>{booking.phone}</dd></div>
                          <div><dt>Количество гостей</dt><dd>{booking.guestsCount}</dd></div>
                          {booking.comment ? <div><dt>Комментарий</dt><dd>{booking.comment}</dd></div> : null}
                        </dl>
                        <div className="hall-action-stack">
                          {booking.status !== 'arrived' && booking.status !== 'seated' ? <button className="hall-arrived-button" type="button" onClick={() => void setBookingStatus(booking.id, 'arrived')}>Пришли по брони</button> : null}
                          {booking.status !== 'seated' ? <button className="hall-seated-button" type="button" onClick={() => void setBookingStatus(booking.id, 'seated')}>Гости за столом</button> : null}
                          <button className="hall-muted-button" type="button" onClick={() => void setBookingStatus(booking.id, 'no_show')}>Не пришли</button>
                          <button className="hall-cancel-button" type="button" onClick={() => void setBookingStatus(booking.id, 'cancelled')}>Отменить бронь</button>
                        </div>
                      </section>
                    ))}
                    <button className="hall-add-booking-btn" type="button" onClick={() => openBookingModal(selectedTable.id)}>+ Добавить бронь</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Модальное окно создания брони */}
      {bookingModalOpen ? (
        <div className="hall-modal-backdrop" onMouseDown={() => setBookingModalOpen(false)}>
          <div className="hall-modal hall-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hall-modal__header">
              <h3>Новая бронь</h3>
              <button type="button" className="hall-modal__close" onClick={() => setBookingModalOpen(false)}>✕</button>
            </div>
            <div className="hall-modal__body">
              <label className="hall-date-modal__field"><span>Имя гостя</span><input type="text" value={bookingDraft.guestName} onChange={(e) => setBookingDraft((d) => ({ ...d, guestName: e.target.value }))} placeholder="Иван Иванов" /></label>
              <label className="hall-date-modal__field"><span>Телефон</span><input type="tel" value={bookingDraft.phone} onChange={(e) => setBookingDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+7 900 000-00-00" /></label>
              <div className="hall-booking-modal__row">
                <label className="hall-date-modal__field"><span>Дата</span><input type="date" value={bookingDraft.date} onChange={(e) => setBookingDraft((d) => ({ ...d, date: e.target.value }))} /></label>
                <label className="hall-date-modal__field"><span>Время</span><input type="time" value={bookingDraft.time} onChange={(e) => setBookingDraft((d) => ({ ...d, time: e.target.value }))} /></label>
                <label className="hall-date-modal__field"><span>Гостей</span><input type="number" min="1" max="100" value={bookingDraft.guestsCount} onChange={(e) => setBookingDraft((d) => ({ ...d, guestsCount: Number(e.target.value) || 1 }))} /></label>
              </div>
              <label className="hall-date-modal__field"><span>Комментарий</span><input type="text" value={bookingDraft.comment} onChange={(e) => setBookingDraft((d) => ({ ...d, comment: e.target.value }))} placeholder="Необязательно" /></label>
              <div className="hall-booking-modal__tables-label">Столы</div>
              <div className="hall-booking-modal__tables">
                {selectedHallTables.map((table) => {
                  const checked = bookingDraft.tableIds.includes(table.id)
                  return (
                    <label key={table.id} className={`hall-booking-modal__table-option${checked ? ' hall-booking-modal__table-option--checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => setBookingDraft((d) => ({ ...d, tableIds: checked ? d.tableIds.filter((id) => id !== table.id) : [...d.tableIds, table.id] }))} />
                      <span>{table.name}</span>
                      <span className="hall-booking-modal__table-seats">{table.seats} м</span>
                    </label>
                  )
                })}
              </div>
              <button className="hall-add-hall-btn" style={{ width: '100%', marginTop: 8 }} type="button" disabled={bookingDraft.tableIds.length === 0} onClick={() => void saveBooking()}>
                Создать бронь{bookingDraft.tableIds.length > 1 ? ` (${bookingDraft.tableIds.length} стола)` : ''}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Шаг 1: редактирование зала */}
      {hallEditModal && !hallTablesModal ? (
        <div className="hall-modal-backdrop" onMouseDown={() => setHallEditModal(null)}>
          <div className="hall-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hall-modal__header">
              <h3>Редактирование зала</h3>
              <button type="button" className="hall-modal__close" onClick={() => setHallEditModal(null)}>✕</button>
            </div>
            <div className="hall-modal__body">
              <label className="hall-date-modal__field">
                <span>Название зала</span>
                <input type="text" value={hallEditName} onChange={(e) => setHallEditName(e.target.value)} placeholder="Введите название" />
              </label>
              <label className="hall-date-modal__field">
                <span>Количество столов</span>
                <input type="number" min="1" max="100" value={hallEditCount || ''} onChange={(e) => setHallEditCount(Number(e.target.value) || 0)} placeholder="0" />
              </label>
              <button className="hall-add-hall-btn" style={{ width: '100%' }} type="button"
                disabled={!hallEditName.trim() || hallEditCount < 1}
                onClick={proceedToTables}>
                Далее → настроить столы
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Шаг 2: настройка столов */}
      {hallEditModal && hallTablesModal ? (
        <div className="hall-modal-backdrop" onMouseDown={() => setHallTablesModal(false)}>
          <div className="hall-modal hall-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hall-modal__header">
              <h3>Столы зала «{hallEditName}»</h3>
              <button type="button" className="hall-modal__close" onClick={() => setHallTablesModal(false)}>✕</button>
            </div>
            <div className="hall-modal__body">
              <div className="hall-tables-draft">
                <div className="hall-tables-draft__header">
                  <span>Номер стола</span>
                  <span>Мест</span>
                </div>
                {tableDrafts.map((draft, i) => (
                  <div key={i} className="hall-tables-draft__row">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setTableDrafts((prev) => prev.map((d, idx) => idx === i ? { ...d, name: e.target.value } : d))}
                      placeholder={`Стол ${i + 1}`}
                    />
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={draft.seats}
                      onChange={(e) => setTableDrafts((prev) => prev.map((d, idx) => idx === i ? { ...d, seats: Number(e.target.value) || 1 } : d))}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="hall-modal__back-btn" type="button" onClick={() => setHallTablesModal(false)}>← Назад</button>
                <button className="hall-add-hall-btn" style={{ flex: 1 }} type="button" onClick={() => void saveHallAndTables()}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
