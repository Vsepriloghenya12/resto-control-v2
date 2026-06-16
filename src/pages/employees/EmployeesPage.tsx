import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircleIcon, ChecklistIcon, EyeIcon, SearchIcon, TeamIcon, UserIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type EmployeeStatus = 'active' | 'fired' | 'blocked'
type ShiftStatus = 'open' | 'closed'
type AttestationTone = 'good' | 'medium' | 'low'
type ScheduleScope = 'employee' | 'department' | 'selection'
type CopyPeriod = 'day' | 'week' | 'month' | 'year'
type ChecklistColor = 'green' | 'yellow' | 'red'

type Employee = {
  id: string
  name: string
  login: string
  position: string
  status: EmployeeStatus
  shiftStatus?: ShiftStatus
  attestationPercent?: number
  createdAt?: string
  updatedAt?: string
}

type StaffSchedule = {
  id: string
  employeeId: string
  employeeName?: string
  position?: string
  department?: string
  month: string
  day: number
  date?: string
  value?: string
  plannedStart?: string
  plannedEnd?: string
  plannedHours?: number
  actualStart?: string
  actualEnd?: string
  actualHours?: number
  openChecklistDone?: boolean
  closeChecklistDone?: boolean
  editedAfterFact?: boolean
  note?: string
  editHistory?: Array<{ at: string; reason: string }>
  createdAt?: string
  updatedAt?: string
}

type ScheduleForm = {
  scope: ScheduleScope
  employeeId: string
  department: string
  employeeIds: string[]
  day: number
  plannedStart: string
  plannedEnd: string
}

type CopyForm = {
  period: CopyPeriod
  fromDay: number
  toDay: number
  targetMonth: string
  replaceFromId: string
  replaceToId: string
}

type ShiftEditor = {
  id: string
  plannedStart: string
  plannedEnd: string
  actualStart: string
  actualEnd: string
  openChecklistDone: boolean
  closeChecklistDone: boolean
  note: string
}

const positions = ['Все', 'Официант', 'Старший официант', 'Бармен', 'Старший бармен', 'Повар', 'Су-шеф', 'Шеф-повар', 'Хостес', 'Администратор', 'Управляющий', 'Курьер', 'Мойщик', 'Уборщик', 'Клининг']
const statuses = ['Все', 'На смене', 'Не на смене']
const scheduleDepartments = ['Зал', 'Бар', 'Кухня', 'Клининг']
const emptyForm = { name: '', login: '', position: '', password: '', shiftStatus: 'closed' as ShiftStatus, attestationPercent: 0 }

const emptyScheduleForm: ScheduleForm = {
  scope: 'employee',
  employeeId: '',
  department: 'Зал',
  employeeIds: [],
  day: new Date().getDate(),
  plannedStart: '09:00',
  plannedEnd: '18:00',
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'С'
}

function getStatusLabel(employee: Employee) {
  if (employee.shiftStatus === 'open') return 'На смене'
  return 'Не на смене'
}

function getStatusClass(employee: Employee) {
  if (employee.shiftStatus === 'open') return 'onShift'
  return 'offShift'
}

function getAttestationTone(value: number): AttestationTone {
  if (value >= 75) return 'good'
  if (value >= 55) return 'medium'
  return 'low'
}

function getCurrentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(year, monthIndex - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getDaysInMonth(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex, 0).getDate()
}

function getMonthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex - 1, 1)).toUpperCase()
}

function getWeekdayLabel(month: string, day: number) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(new Date(year, monthIndex - 1, day)).replace('.', '')
}

function getDateIso(month: string, day: number) {
  return `${month}-${String(day).padStart(2, '0')}`
}

function getDepartment(position: string) {
  const value = position.toLowerCase()
  if (value.includes('бар')) return 'Бар'
  if (value.includes('повар') || value.includes('су-шеф') || value.includes('шеф')) return 'Кухня'
  if (value.includes('клининг') || value.includes('убор') || value.includes('мойщик')) return 'Клининг'
  return 'Зал'
}

function timeToMinutes(value?: string) {
  const [hoursRaw, minutesRaw] = String(value || '').split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0
  return hours * 60 + minutes
}

function hoursBetween(start?: string, end?: string) {
  const startMinutes = timeToMinutes(start)
  let endMinutes = timeToMinutes(end)
  if (!startMinutes && !endMinutes) return 0
  if (endMinutes < startMinutes) endMinutes += 24 * 60
  return Math.max(0, Math.round(((endMinutes - startMinutes) / 60) * 100) / 100)
}

function formatHours(value: number) {
  if (!value) return '0 ч'
  const rounded = Math.round(value * 100) / 100
  return `${String(rounded).replace('.', ',')} ч`
}

function getPlannedStart(shift?: StaffSchedule) {
  return shift?.plannedStart || '09:00'
}

function getPlannedEnd(shift?: StaffSchedule) {
  if (shift?.plannedEnd) return shift.plannedEnd
  if (shift?.value === '0.5') return '14:00'
  return '18:00'
}

function getPlannedHours(shift?: StaffSchedule) {
  if (!shift) return 0
  if (typeof shift.plannedHours === 'number') return shift.plannedHours
  if (shift.plannedStart || shift.plannedEnd) return hoursBetween(getPlannedStart(shift), getPlannedEnd(shift))
  if (shift.value === '0.5') return 4.5
  if (shift.value === '1') return 9
  return 0
}

function getActualStart(shift?: StaffSchedule) {
  if (!shift) return ''
  return shift.actualStart || getPlannedStart(shift)
}

function getActualEnd(shift?: StaffSchedule) {
  if (!shift) return ''
  return shift.actualEnd || getPlannedEnd(shift)
}

function getActualHours(shift?: StaffSchedule) {
  if (!shift) return 0
  if (typeof shift.actualHours === 'number') return shift.actualHours
  return hoursBetween(getActualStart(shift), getActualEnd(shift)) || getPlannedHours(shift)
}

function getShiftColor(shift?: StaffSchedule): ChecklistColor | '' {
  if (!shift) return ''
  if (shift.openChecklistDone && shift.closeChecklistDone) return 'green'
  if (shift.openChecklistDone || shift.closeChecklistDone) return 'yellow'
  return 'red'
}

function getChecklistStatusText(shift?: StaffSchedule) {
  if (!shift) return 'Нет смены'
  if (shift.openChecklistDone && shift.closeChecklistDone) return 'Открытие и закрытие выполнены'
  if (shift.openChecklistDone) return 'Выполнено только открытие'
  if (shift.closeChecklistDone) return 'Выполнено только закрытие'
  return 'Чек-листы не выполнены, факт по графику'
}

function getShiftDeviation(shift?: StaffSchedule) {
  return getActualHours(shift) - getPlannedHours(shift)
}

function formatDeviation(value: number) {
  const rounded = Math.round(value * 100) / 100
  if (!rounded) return '0 ч'
  return `${rounded > 0 ? '+' : ''}${String(rounded).replace('.', ',')} ч`
}

function EmployeeMetric({ icon, value, label, hint, tone }: { icon: ReactNode; value: string; label: string; hint: string; tone: 'blue' | 'green' | 'purple' }) {
  return (
    <article className="employees-metric-card">
      <span className={`employees-metric-card__icon employees-metric-card__icon--${tone}`}>{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
        <small>{hint}</small>
      </div>
    </article>
  )
}

function AttestationBar({ value }: { value: number }) {
  const tone = getAttestationTone(value)
  return (
    <div className="employees-attestation" aria-label={`Аттестация ${value}%`}>
      <strong>{value}%</strong>
      <span><i className={`employees-attestation__bar employees-attestation__bar--${tone}`} style={{ width: `${value}%` }} /></span>
    </div>
  )
}

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState('Все')
  const [status, setStatus] = useState('Все')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [form, setForm] = useState(emptyForm)
  const [showEmployeePassword, setShowEmployeePassword] = useState(false)
  const [scheduleMonth, setScheduleMonth] = useState(getCurrentMonth())
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm)
  const [copyForm, setCopyForm] = useState<CopyForm>({ period: 'day', fromDay: new Date().getDate(), toDay: new Date().getDate() + 1, targetMonth: shiftMonth(getCurrentMonth(), 1), replaceFromId: '', replaceToId: '' })
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [shiftEditor, setShiftEditor] = useState<ShiftEditor | null>(null)

  async function loadEmployees() {
    setIsLoading(true)
    setError('')
    try {
      const result = await api.list<Employee>('employees')
      const visible = result.items.filter((item) => item.status !== 'blocked' && item.status !== 'fired')
      setEmployees(visible)
      if (visible[0]) {
        setSelectedId(visible[0].id)
        setForm({
          name: visible[0].name,
          login: visible[0].login,
          position: visible[0].position,
          password: '',
          shiftStatus: visible[0].shiftStatus || 'closed',
          attestationPercent: visible[0].attestationPercent || 0,
        })
        setScheduleForm((current) => ({ ...current, employeeId: visible[0].id, employeeIds: [visible[0].id], department: getDepartment(visible[0].position) }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сотрудников')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadSchedule() {
    try {
      const result = await api.list<StaffSchedule>('staff-schedules')
      setSchedules(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить график')
    }
  }

  useEffect(() => { void loadEmployees(); void loadSchedule() }, [])
  useEffect(() => { void loadSchedule() }, [scheduleMonth])

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return employees.filter((employee) => {
      const matchesSearch = !normalizedSearch || employee.name.toLowerCase().includes(normalizedSearch) || employee.login.toLowerCase().includes(normalizedSearch)
      const matchesPosition = position === 'Все' || employee.position === position
      const matchesStatus = status === 'Все' || getStatusLabel(employee) === status
      return matchesSearch && matchesPosition && matchesStatus
    })
  }, [employees, position, search, status])

  const selectedEmployee = employees.find((item) => item.id === selectedId)
  const onShiftCount = employees.filter((item) => item.shiftStatus === 'open').length
  const avgAttestation = employees.length ? Math.round(employees.reduce((sum, item) => sum + (item.attestationPercent || 0), 0) / employees.length) : 0
  const managersCount = employees.filter((item) => ['Управляющий', 'Администратор', 'Старший официант', 'Старший бармен', 'Су-шеф', 'Шеф-повар'].includes(item.position)).length
  const scheduleDays = Array.from({ length: getDaysInMonth(scheduleMonth) }, (_, index) => index + 1)
  const monthSchedules = schedules.filter((item) => item.month === scheduleMonth)
  const employeesByDepartment = useMemo(() => {
    return employees.reduce<Record<string, Employee[]>>((groups, employee) => {
      const department = getDepartment(employee.position)
      groups[department] = groups[department] || []
      groups[department].push(employee)
      return groups
    }, {})
  }, [employees])

  const scheduleSummary = useMemo(() => {
    const planShifts = monthSchedules.length
    const factShifts = monthSchedules.filter((shift) => shift.openChecklistDone || shift.closeChecklistDone).length
    const planHours = monthSchedules.reduce((sum, shift) => sum + getPlannedHours(shift), 0)
    const factHours = monthSchedules.reduce((sum, shift) => sum + getActualHours(shift), 0)
    const green = monthSchedules.filter((shift) => getShiftColor(shift) === 'green').length
    const yellow = monthSchedules.filter((shift) => getShiftColor(shift) === 'yellow').length
    const red = monthSchedules.filter((shift) => getShiftColor(shift) === 'red').length
    return { planShifts, factShifts, planHours, factHours, green, yellow, red }
  }, [monthSchedules])

  function startCreate() {
    setSelectedId('')
    setForm(emptyForm)
    setError('')
  }

  function openEmployee(employee: Employee) {
    setSelectedId(employee.id)
    setForm({
      name: employee.name,
      login: employee.login,
      position: employee.position,
      password: '',
      shiftStatus: employee.shiftStatus || 'closed',
      attestationPercent: employee.attestationPercent || 0,
    })
    setScheduleForm((current) => ({ ...current, employeeId: employee.id, employeeIds: Array.from(new Set([...current.employeeIds, employee.id])), department: getDepartment(employee.position) }))
    setError('')
  }

  async function saveEmployee() {
    if (!form.name.trim() || !form.login.trim() || !form.position) {
      setError('Заполните имя, телефон/email и должность.')
      return
    }

    if (!selectedId && !form.password.trim()) {
      setError('Для нового сотрудника нужен временный пароль.')
      return
    }

    try {
      if (selectedId) {
        const updated = await api.update<Employee>('employees', selectedId, {
          name: form.name.trim(),
          login: form.login.trim(),
          position: form.position,
          shiftStatus: form.shiftStatus,
          attestationPercent: Number(form.attestationPercent || 0),
          status: 'active',
        })
        setEmployees((items) => items.map((item) => item.id === selectedId ? updated : item))
      } else {
        const created = await api.create<Employee>('employees', {
          name: form.name.trim(),
          login: form.login.trim(),
          position: form.position,
          password: form.password,
          status: 'active',
          shiftStatus: form.shiftStatus,
          attestationPercent: Number(form.attestationPercent || 0),
        })
        setEmployees((items) => [created, ...items])
        setSelectedId(created.id)
        setForm({ name: created.name, login: created.login, position: created.position, password: '', shiftStatus: created.shiftStatus || 'closed', attestationPercent: created.attestationPercent || 0 })
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить сотрудника')
    }
  }

  async function fireEmployee() {
    if (!selectedId) return
    try {
      await api.remove('employees', selectedId)
      const next = employees.filter((item) => item.id !== selectedId)
      setEmployees(next)
      if (next[0]) openEmployee(next[0])
      else startCreate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить сотрудника')
    }
  }

  function getScheduleEntries(employeeId: string, day: number, month = scheduleMonth) {
    return schedules.filter((item) => item.employeeId === employeeId && item.month === month && Number(item.day) === day)
  }

  function getFirstScheduleEntry(employeeId: string, day: number, month = scheduleMonth) {
    return getScheduleEntries(employeeId, day, month)[0]
  }

  function getTargetEmployees() {
    if (scheduleForm.scope === 'employee') return employees.filter((employee) => employee.id === scheduleForm.employeeId)
    if (scheduleForm.scope === 'department') return employees.filter((employee) => getDepartment(employee.position) === scheduleForm.department)
    return employees.filter((employee) => scheduleForm.employeeIds.includes(employee.id))
  }

  async function upsertShift(employee: Employee, month: string, day: number, patch: Partial<StaffSchedule>) {
    const existing = getFirstScheduleEntry(employee.id, day, month)
    const payload = {
      employeeId: employee.id,
      employeeName: employee.name,
      position: employee.position,
      department: getDepartment(employee.position),
      month,
      day,
      date: getDateIso(month, day),
      ...patch,
    }

    if (existing) {
      const updated = await api.update<StaffSchedule>('staff-schedules', existing.id, payload)
      setSchedules((items) => items.map((item) => item.id === existing.id ? updated : item))
      return updated
    }

    const created = await api.create<StaffSchedule>('staff-schedules', payload)
    setSchedules((items) => [...items, created])
    return created
  }

  async function createScheduleShifts() {
    const targets = getTargetEmployees()
    if (!targets.length) {
      setError('Выберите сотрудника, подразделение или несколько сотрудников.')
      return
    }

    try {
      for (const employee of targets) {
        await upsertShift(employee, scheduleMonth, scheduleForm.day, {
          plannedStart: scheduleForm.plannedStart,
          plannedEnd: scheduleForm.plannedEnd,
          plannedHours: hoursBetween(scheduleForm.plannedStart, scheduleForm.plannedEnd),
          actualStart: '',
          actualEnd: '',
          actualHours: undefined,
          openChecklistDone: false,
          closeChecklistDone: false,
          editedAfterFact: false,
          note: '',
        })
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось поставить смены')
    }
  }

  async function quickCreateShift(employee: Employee, day: number) {
    try {
      await upsertShift(employee, scheduleMonth, day, {
        plannedStart: scheduleForm.plannedStart,
        plannedEnd: scheduleForm.plannedEnd,
        plannedHours: hoursBetween(scheduleForm.plannedStart, scheduleForm.plannedEnd),
        actualStart: '',
        actualEnd: '',
        openChecklistDone: false,
        closeChecklistDone: false,
        note: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать смену')
    }
  }

  function openShiftEditor(shift: StaffSchedule) {
    setSelectedShiftId(shift.id)
    setShiftEditor({
      id: shift.id,
      plannedStart: getPlannedStart(shift),
      plannedEnd: getPlannedEnd(shift),
      actualStart: shift.actualStart || '',
      actualEnd: shift.actualEnd || '',
      openChecklistDone: Boolean(shift.openChecklistDone),
      closeChecklistDone: Boolean(shift.closeChecklistDone),
      note: shift.note || '',
    })
  }

  async function saveShiftEditor() {
    if (!shiftEditor) return
    const shift = schedules.find((item) => item.id === shiftEditor.id)
    if (!shift) return
    try {
      const updated = await api.update<StaffSchedule>('staff-schedules', shift.id, {
        plannedStart: shiftEditor.plannedStart,
        plannedEnd: shiftEditor.plannedEnd,
        plannedHours: hoursBetween(shiftEditor.plannedStart, shiftEditor.plannedEnd),
        actualStart: shiftEditor.actualStart,
        actualEnd: shiftEditor.actualEnd,
        actualHours: shiftEditor.actualStart && shiftEditor.actualEnd ? hoursBetween(shiftEditor.actualStart, shiftEditor.actualEnd) : undefined,
        openChecklistDone: shiftEditor.openChecklistDone,
        closeChecklistDone: shiftEditor.closeChecklistDone,
        editedAfterFact: true,
        note: shiftEditor.note,
        editHistory: [...(shift.editHistory || []), { at: new Date().toISOString(), reason: 'Редактирование менеджером' }],
      })
      setSchedules((items) => items.map((item) => item.id === updated.id ? updated : item))
      setSelectedShiftId(updated.id)
      setShiftEditor(null)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить смену')
    }
  }

  async function deleteSelectedShift() {
    if (!shiftEditor) return
    try {
      await api.remove('staff-schedules', shiftEditor.id)
      setSchedules((items) => items.filter((item) => item.id !== shiftEditor.id))
      setShiftEditor(null)
      setSelectedShiftId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить смену')
    }
  }

  function toggleScheduleEmployee(employeeId: string) {
    setScheduleForm((current) => {
      const exists = current.employeeIds.includes(employeeId)
      return { ...current, employeeIds: exists ? current.employeeIds.filter((id) => id !== employeeId) : [...current.employeeIds, employeeId] }
    })
  }

  function getCopyTargets() {
    const sourceMonth = scheduleMonth
    if (copyForm.period === 'day') return [{ fromMonth: sourceMonth, fromDay: copyForm.fromDay, toMonth: sourceMonth, toDay: copyForm.toDay }]
    if (copyForm.period === 'week') {
      return Array.from({ length: 7 }, (_, index) => ({ fromMonth: sourceMonth, fromDay: copyForm.fromDay + index, toMonth: sourceMonth, toDay: copyForm.toDay + index }))
        .filter((item) => item.fromDay <= getDaysInMonth(sourceMonth) && item.toDay <= getDaysInMonth(sourceMonth))
    }
    if (copyForm.period === 'month') {
      const days = getDaysInMonth(sourceMonth)
      return Array.from({ length: days }, (_, index) => ({ fromMonth: sourceMonth, fromDay: index + 1, toMonth: copyForm.targetMonth, toDay: index + 1 }))
        .filter((item) => item.toDay <= getDaysInMonth(item.toMonth))
    }
    const [targetYear] = copyForm.targetMonth.split('-')
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const month = `${targetYear}-${String(monthIndex + 1).padStart(2, '0')}`
      return Array.from({ length: Math.min(getDaysInMonth(sourceMonth), getDaysInMonth(month)) }, (_, dayIndex) => ({ fromMonth: sourceMonth, fromDay: dayIndex + 1, toMonth: month, toDay: dayIndex + 1 }))
    }).flat()
  }

  async function copySchedule() {
    const targets = getCopyTargets()
    const replaceFrom = employees.find((employee) => employee.id === copyForm.replaceFromId)
    const replaceTo = employees.find((employee) => employee.id === copyForm.replaceToId)

    try {
      for (const target of targets) {
        const sourceShifts = schedules.filter((item) => item.month === target.fromMonth && Number(item.day) === target.fromDay)
        for (const source of sourceShifts) {
          const originalEmployee = employees.find((employee) => employee.id === source.employeeId)
          const targetEmployee = replaceFrom && replaceTo && source.employeeId === replaceFrom.id ? replaceTo : originalEmployee
          if (!targetEmployee) continue
          await upsertShift(targetEmployee, target.toMonth, target.toDay, {
            plannedStart: getPlannedStart(source),
            plannedEnd: getPlannedEnd(source),
            plannedHours: getPlannedHours(source),
            actualStart: '',
            actualEnd: '',
            actualHours: undefined,
            openChecklistDone: false,
            closeChecklistDone: false,
            editedAfterFact: false,
            note: source.note ? `Скопировано: ${source.note}` : '',
          })
        }
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скопировать график')
    }
  }

  function renderScheduleCell(employee: Employee, day: number) {
    const entries = getScheduleEntries(employee.id, day)
    const entry = entries[0]
    if (!entry) {
      return (
        <button type="button" className="employees-schedule__cell-button employees-schedule__cell-button--empty" onClick={() => void quickCreateShift(employee, day)} aria-label={`Поставить смену ${employee.name} на ${day} число`}>
          <span className="employees-schedule__cell-plus">+</span>
        </button>
      )
    }

    const planStart = getPlannedStart(entry)
    const planEnd = getPlannedEnd(entry)
    const plannedHours = formatHours(getPlannedHours(entry))
    const statusText = getChecklistStatusText(entry)

    return (
      <button
        type="button"
        className={`employees-schedule__cell-button employees-schedule__cell-button--${getShiftColor(entry)} ${selectedShiftId === entry.id ? 'is-selected' : ''}`}
        onClick={() => openShiftEditor(entry)}
        title={`${employee.name} · ${planStart}–${planEnd} · ${plannedHours}. ${statusText}`}
      >
        <strong className="employees-schedule__cell-time">
          <span>{planStart}</span>
          <span>{planEnd}</span>
        </strong>
        <span className="employees-schedule__cell-hours">{plannedHours}</span>
        {entries.length > 1 ? <small className="employees-schedule__cell-extra">+{entries.length - 1}</small> : null}
      </button>
    )
  }

  function renderScheduleEditor() {
    if (!shiftEditor) return null

    const shift = schedules.find((item) => item.id === shiftEditor.id)
    const employee = employees.find((item) => item.id === shift?.employeeId)
    const planHours = hoursBetween(shiftEditor.plannedStart, shiftEditor.plannedEnd)
    const factHours = shiftEditor.actualStart && shiftEditor.actualEnd ? hoursBetween(shiftEditor.actualStart, shiftEditor.actualEnd) : planHours

    return (
      <div className="employees-schedule-modal" role="dialog" aria-modal="true" aria-label="Редактирование смены">
        <button className="employees-schedule-modal__backdrop" type="button" aria-label="Закрыть окно" onClick={() => { setShiftEditor(null); setSelectedShiftId('') }} />
        <aside className="employees-schedule-editor employees-schedule-editor--modal">
          <div className="employees-schedule-editor__header employees-schedule-editor__header--modal">
            <div>
              <h4>{employee?.name || shift?.employeeName || 'Смена'}</h4>
              <p>{shift?.position || employee?.position || 'Должность'} · {shift?.day} {getMonthLabel(shift?.month || scheduleMonth).toLowerCase()}</p>
            </div>
            <button className="employees-schedule-modal__close" type="button" onClick={() => { setShiftEditor(null); setSelectedShiftId('') }}>×</button>
          </div>

          <span className={`employees-schedule-status employees-schedule-status--${getShiftColor(shift)}`}>{getChecklistStatusText(shift)}</span>

          <div className="employees-schedule-editor__grid">
            <label><span>План начало</span><input type="time" value={shiftEditor.plannedStart} onChange={(event) => setShiftEditor((current) => current ? { ...current, plannedStart: event.target.value } : current)} /></label>
            <label><span>План конец</span><input type="time" value={shiftEditor.plannedEnd} onChange={(event) => setShiftEditor((current) => current ? { ...current, plannedEnd: event.target.value } : current)} /></label>
            <label><span>Факт начало</span><input type="time" value={shiftEditor.actualStart} onChange={(event) => setShiftEditor((current) => current ? { ...current, actualStart: event.target.value } : current)} /></label>
            <label><span>Факт конец</span><input type="time" value={shiftEditor.actualEnd} onChange={(event) => setShiftEditor((current) => current ? { ...current, actualEnd: event.target.value } : current)} /></label>
          </div>

          <div className="employees-schedule-editor__checks">
            <label><input type="checkbox" checked={shiftEditor.openChecklistDone} onChange={(event) => setShiftEditor((current) => current ? { ...current, openChecklistDone: event.target.checked } : current)} /> Чек-лист открытия выполнен</label>
            <label><input type="checkbox" checked={shiftEditor.closeChecklistDone} onChange={(event) => setShiftEditor((current) => current ? { ...current, closeChecklistDone: event.target.checked } : current)} /> Чек-лист закрытия выполнен</label>
          </div>

          <label className="employees-schedule-editor__note"><span>Комментарий / причина правки</span><textarea value={shiftEditor.note} onChange={(event) => setShiftEditor((current) => current ? { ...current, note: event.target.value } : current)} placeholder="Например: сотрудник задержался из-за банкета" /></label>

          <div className="employees-schedule-editor__summary">
            <span>Часы: {formatHours(factHours)} / {formatHours(planHours)}</span>
            <span>Отклонение: {formatDeviation(factHours - planHours)}</span>
          </div>

          <div className="employees-schedule-editor__actions employees-schedule-editor__actions--modal">
            <button type="button" className="employees-primary-button" onClick={() => void saveShiftEditor()}>Сохранить смену</button>
            <button type="button" className="employees-cancel-button" onClick={() => void deleteSelectedShift()}>Удалить смену</button>
          </div>
        </aside>
      </div>
    )
  }

  function renderScheduleShiftCard(shift: StaffSchedule) {
    const employee = employees.find((item) => item.id === shift.employeeId)
    const color = getShiftColor(shift) || 'red'
    const planStart = getPlannedStart(shift)
    const planEnd = getPlannedEnd(shift)
    const actualStart = getActualStart(shift)
    const actualEnd = getActualEnd(shift)
    const planHours = getPlannedHours(shift)
    const actualHours = getActualHours(shift)
    const deviation = getShiftDeviation(shift)
    const usesScheduleFact = !shift.actualStart && !shift.actualEnd

    return (
      <button type="button" key={shift.id} className={`employees-schedule-shift-card employees-schedule-shift-card--${color} ${selectedShiftId === shift.id ? 'is-selected' : ''}`} onClick={() => openShiftEditor(shift)}>
        <span className={`employees-schedule-shift-card__status employees-schedule-shift-card__status--${color}`} />
        <div className="employees-schedule-shift-card__main">
          <div className="employees-schedule-shift-card__topline">
            <strong>{employee?.name || shift.employeeName || 'Сотрудник'}</strong>
            <span>{shift.day} {getMonthLabel(shift.month).toLowerCase()}</span>
          </div>
          <p>{shift.position || employee?.position || 'Должность'} · {shift.department || getDepartment(shift.position || employee?.position || '')}</p>
          <div className="employees-schedule-shift-card__time-grid">
            <span><b>План</b>{planStart}–{planEnd} · {formatHours(planHours)}</span>
            <span><b>Факт</b>{usesScheduleFact ? 'по графику' : `${actualStart}–${actualEnd}`} · {formatHours(actualHours)}</span>
          </div>
          <div className="employees-schedule-shift-card__meta">
            <em>{getChecklistStatusText(shift)}</em>
            <small>Отклонение: {formatDeviation(deviation)}</small>
          </div>
        </div>
        <span className="employees-schedule-shift-card__edit">Изменить</span>
      </button>
    )
  }

  function renderScheduleTable() {
    const departments = scheduleDepartments.filter((department) => employeesByDepartment[department]?.length)
    const scheduleDeviation = scheduleSummary.factHours - scheduleSummary.planHours

    return (
      <section className="employees-schedule-card employees-schedule-card--redesign employees-schedule-card--grid-view">
        <div className="employees-schedule-redesign__hero">
          <div>
            <span className="employees-schedule-redesign__eyebrow">План / факт</span>
            <h3>График сотрудников</h3>
            <p>Сетка смен по сотрудникам. Нажмите на смену в ячейке, чтобы открыть редактирование в отдельном окне.</p>
          </div>
          <label className="employees-schedule-redesign__month"><span>Месяц</span><input type="month" value={scheduleMonth} onChange={(event) => setScheduleMonth(event.target.value || getCurrentMonth())} /></label>
        </div>

        <div className="employees-schedule-redesign__summary">
          <article><span>Смены</span><strong>{scheduleSummary.factShifts} / {scheduleSummary.planShifts}</strong><small>факт / план</small></article>
          <article><span>Часы</span><strong>{formatHours(scheduleSummary.factHours)} / {formatHours(scheduleSummary.planHours)}</strong><small>факт / план</small></article>
          <article className={scheduleDeviation < 0 ? 'is-negative' : scheduleDeviation > 0 ? 'is-positive' : ''}><span>Отклонение</span><strong>{formatDeviation(scheduleDeviation)}</strong><small>по фактическим часам</small></article>
          <article><span>Чек-листы</span><strong>{scheduleSummary.green} / {scheduleSummary.yellow} / {scheduleSummary.red}</strong><small>зелёные / жёлтые / красные</small></article>
        </div>

        <div className="employees-schedule-redesign__legend">
          <span><i className="legend-green" /> оба чек-листа</span>
          <span><i className="legend-yellow" /> один чек-лист</span>
          <span><i className="legend-red" /> нет чек-листов</span>
          <span className="employees-schedule-redesign__legend-note">Если чек-листов нет, факт считается по графику</span>
        </div>

        <div className="employees-schedule-redesign__actions">
          <details className="employees-schedule-redesign__panel">
            <summary><span>+ Смена</span><small>одному сотруднику, подразделению или выбранной группе</small></summary>
            <div className="employees-schedule-redesign__panel-body">
              <div className="employees-schedule-builder__grid">
                <label><span>Кому</span><select value={scheduleForm.scope} onChange={(event) => setScheduleForm((current) => ({ ...current, scope: event.target.value as ScheduleScope }))}><option value="employee">Один сотрудник</option><option value="department">Подразделение</option><option value="selection">Выбрать нескольких</option></select></label>
                <label><span>День</span><input type="number" min="1" max={getDaysInMonth(scheduleMonth)} value={scheduleForm.day} onChange={(event) => setScheduleForm((current) => ({ ...current, day: Number(event.target.value || 1) }))} /></label>
                <label><span>Начало</span><input type="time" value={scheduleForm.plannedStart} onChange={(event) => setScheduleForm((current) => ({ ...current, plannedStart: event.target.value }))} /></label>
                <label><span>Конец</span><input type="time" value={scheduleForm.plannedEnd} onChange={(event) => setScheduleForm((current) => ({ ...current, plannedEnd: event.target.value }))} /></label>
                {scheduleForm.scope === 'employee' ? <label><span>Сотрудник</span><select value={scheduleForm.employeeId} onChange={(event) => setScheduleForm((current) => ({ ...current, employeeId: event.target.value }))}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.position}</option>)}</select></label> : null}
                {scheduleForm.scope === 'department' ? <label><span>Подразделение</span><select value={scheduleForm.department} onChange={(event) => setScheduleForm((current) => ({ ...current, department: event.target.value }))}>{scheduleDepartments.map((item) => <option key={item}>{item}</option>)}</select></label> : null}
              </div>
              {scheduleForm.scope === 'selection' ? (
                <div className="employees-schedule-picker employees-schedule-picker--redesign">
                  {employees.map((employee) => <label key={employee.id}><input type="checkbox" checked={scheduleForm.employeeIds.includes(employee.id)} onChange={() => toggleScheduleEmployee(employee.id)} /> {employee.name} · {employee.position}</label>)}
                </div>
              ) : null}
              <button className="employees-primary-button" type="button" onClick={() => void createScheduleShifts()}>Поставить смену</button>
            </div>
          </details>

          <details className="employees-schedule-redesign__panel">
            <summary><span>Копировать</span><small>день, неделю, месяц или год с заменой сотрудника</small></summary>
            <div className="employees-schedule-redesign__panel-body">
              <div className="employees-schedule-builder__grid employees-schedule-builder__grid--copy">
                <label><span>Период</span><select value={copyForm.period} onChange={(event) => setCopyForm((current) => ({ ...current, period: event.target.value as CopyPeriod }))}><option value="day">День</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="year">Год</option></select></label>
                <label><span>От дня</span><input type="number" min="1" max={getDaysInMonth(scheduleMonth)} value={copyForm.fromDay} onChange={(event) => setCopyForm((current) => ({ ...current, fromDay: Number(event.target.value || 1) }))} /></label>
                <label><span>На день</span><input type="number" min="1" max={getDaysInMonth(scheduleMonth)} value={copyForm.toDay} onChange={(event) => setCopyForm((current) => ({ ...current, toDay: Number(event.target.value || 1) }))} /></label>
                <label><span>Целевой месяц</span><input type="month" value={copyForm.targetMonth} onChange={(event) => setCopyForm((current) => ({ ...current, targetMonth: event.target.value || shiftMonth(scheduleMonth, 1) }))} /></label>
                <label><span>Заменить</span><select value={copyForm.replaceFromId} onChange={(event) => setCopyForm((current) => ({ ...current, replaceFromId: event.target.value }))}><option value="">Без замены</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
                <label><span>На сотрудника</span><select value={copyForm.replaceToId} onChange={(event) => setCopyForm((current) => ({ ...current, replaceToId: event.target.value }))}><option value="">Не выбран</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
              </div>
              <button className="employees-primary-button" type="button" onClick={() => void copySchedule()}>Скопировать график</button>
              <p className="employees-schedule-builder__hint">Копируются плановые смены, роли и часы. Факт, чек-листы и отклонения остаются только у исходных смен.</p>
            </div>
          </details>
        </div>

        <div className="employees-schedule-grid-shell">
          <div className="employees-schedule-wrap employees-schedule-wrap--redesign employees-schedule-wrap--full">
            <table className="employees-schedule-table employees-schedule-table--advanced employees-schedule-table--compact">
              <thead>
                <tr>
                  <th className="employees-schedule-table__name">{getMonthLabel(scheduleMonth)}</th>
                  {scheduleDays.map((day) => <th key={day}>{day}</th>)}
                  <th>Смены</th>
                  <th>Часы</th>
                </tr>
                <tr>
                  <th className="employees-schedule-table__name" />
                  {scheduleDays.map((day) => <th key={day}>{getWeekdayLabel(scheduleMonth, day)}</th>)}
                  <th>факт/план</th>
                  <th>факт/план</th>
                </tr>
              </thead>
              {departments.length ? departments.map((department) => (
                <tbody key={department}>
                  <tr className="employees-schedule-table__group"><td colSpan={scheduleDays.length + 3}>{department}</td></tr>
                  {employeesByDepartment[department].map((employee) => {
                    const employeeMonthShifts = monthSchedules.filter((shift) => shift.employeeId === employee.id)
                    const planShifts = employeeMonthShifts.length
                    const factShifts = employeeMonthShifts.filter((shift) => shift.openChecklistDone || shift.closeChecklistDone).length
                    const planHours = employeeMonthShifts.reduce((sum, shift) => sum + getPlannedHours(shift), 0)
                    const factHours = employeeMonthShifts.reduce((sum, shift) => sum + getActualHours(shift), 0)
                    return (
                      <tr key={employee.id}>
                        <th className="employees-schedule-table__employee"><span>{employee.name}</span><small>{employee.position}</small></th>
                        {scheduleDays.map((day) => <td key={day}>{renderScheduleCell(employee, day)}</td>)}
                        <td className="employees-schedule-table__total">{factShifts}/{planShifts}</td>
                        <td className="employees-schedule-table__total">{formatHours(factHours)} / {formatHours(planHours)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              )) : <tbody><tr><td colSpan={scheduleDays.length + 3}>Добавьте сотрудников, чтобы составить график.</td></tr></tbody>}
            </table>
          </div>
        </div>

        {renderScheduleEditor()}
      </section>
    )
  }


  return (
    <section className="employees-page">
      <section className="employees-metrics-grid" aria-label="Сводка по сотрудникам">
        <EmployeeMetric icon={<TeamIcon />} value={String(employees.length)} label="Сотрудников" hint="Действующие сотрудники" tone="blue" />
        <EmployeeMetric icon={<UserIcon />} value={String(onShiftCount)} label="На смене" hint="Открыли смену" tone="green" />
        <EmployeeMetric icon={<ChecklistIcon />} value={`${avgAttestation}%`} label="Аттестация" hint="Средний показатель" tone="purple" />
        <EmployeeMetric icon={<TeamIcon />} value={String(managersCount)} label="Управленцы" hint="Старшие и менеджеры" tone="blue" />
      </section>

      {error ? <div className="employees-add-panel__hint"><AlertCircleIcon /><p>{error}</p></div> : null}

      <div className="employees-layout employees-layout--with-editor">
        <section className="employees-table-card">
          <div className="employees-filters employees-filters--compact">
            <label className="employees-search">
              <SearchIcon />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по имени или телефону..." />
            </label>
            <label className="employees-select">
              <span>Должность:</span>
              <select value={position} onChange={(event) => setPosition(event.target.value)}>{positions.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <label className="employees-select">
              <span>Статус:</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <button className="employees-reset-button" type="button" onClick={() => { setSearch(''); setPosition('Все'); setStatus('Все') }}>Сбросить</button>
            <button className="employees-primary-button" type="button" onClick={startCreate}>+ Сотрудник</button>
          </div>

          <div className="employees-table-wrap">
            <table className="employees-table employees-table--clickable">
              <thead>
                <tr><th>Сотрудник</th><th>Должность</th><th>Статус</th><th>Аттестация</th><th>Сегодня</th><th>Активность</th></tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6}>Загрузка...</td></tr> : null}
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className={employee.id === selectedId ? 'employees-row employees-row--active' : 'employees-row'} onClick={() => openEmployee(employee)}>
                    <td><div className="employees-person"><span>{getInitials(employee.name)}</span><div><strong>{employee.name}</strong><small>{employee.login}</small></div></div></td>
                    <td>{employee.position}</td>
                    <td><span className={`employees-status employees-status--${getStatusClass(employee)}`}>{getStatusLabel(employee)}</span></td>
                    <td><AttestationBar value={employee.attestationPercent || 0} /></td>
                    <td>{employee.shiftStatus === 'open' ? 'Смена открыта' : 'Смена не открыта'}</td>
                    <td>{employee.updatedAt ? new Date(employee.updatedAt).toLocaleDateString('ru-RU') : '—'}</td>
                  </tr>
                ))}
                {!isLoading && filteredEmployees.length === 0 ? <tr><td colSpan={6}>Сотрудники не найдены</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="employees-table-footer"><span>Показано {filteredEmployees.length} из {employees.length}</span></div>
        </section>

        <aside className="employees-add-panel employees-editor-panel" aria-label="Карточка сотрудника">
          <div className="employees-add-panel__header"><h3>{selectedEmployee ? 'Карточка сотрудника' : 'Новый сотрудник'}</h3></div>
          <label><span>Имя сотрудника</span><input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Введите имя сотрудника" /></label>
          <label><span>Телефон или email</span><input value={form.login} onChange={(e) => setForm((v) => ({ ...v, login: e.target.value }))} placeholder="Введите телефон или email" /></label>
          <label><span>Должность</span><select value={form.position} onChange={(e) => setForm((v) => ({ ...v, position: e.target.value }))}><option value="" disabled>Выберите должность</option>{positions.filter((item) => item !== 'Все').map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Смена</span><select value={form.shiftStatus} onChange={(e) => setForm((v) => ({ ...v, shiftStatus: e.target.value as ShiftStatus }))}><option value="closed">Смена не открыта</option><option value="open">Смена открыта</option></select></label>
          <label><span>Аттестация, %</span><input value={form.attestationPercent} onChange={(e) => setForm((v) => ({ ...v, attestationPercent: Number(e.target.value || 0) }))} type="number" min="0" max="100" /></label>
          {!selectedEmployee ? <label><span>Временный пароль</span><span style={{position:'relative',display:'flex',alignItems:'center'}}><input style={{flex:1,paddingRight:'40px'}} value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} placeholder="Придумайте пароль" type={showEmployeePassword ? 'text' : 'password'} /><button type="button" onClick={() => setShowEmployeePassword((v) => !v)} style={{position:'absolute',right:'10px',background:'none',border:'none',cursor:'pointer',color:'#8e929c',display:'flex',alignItems:'center'}}><EyeIcon style={{width:'20px',height:'20px'}} /></button></span></label> : null}
          <button className="employees-create-button" type="button" onClick={saveEmployee}>{selectedEmployee ? 'Сохранить карточку' : 'Создать сотрудника'}</button>
          {selectedEmployee ? <button className="employees-cancel-button" type="button" onClick={fireEmployee}>Удалить сотрудника</button> : <button className="employees-cancel-button" type="button" onClick={startCreate}>Очистить</button>}
        </aside>
      </div>

      {renderScheduleTable()}
    </section>
  )
}
