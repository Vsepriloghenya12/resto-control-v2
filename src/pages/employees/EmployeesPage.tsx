import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircleIcon, ChecklistIcon, EyeIcon, SearchIcon, TeamIcon, UserIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type EmployeeStatus = 'active' | 'fired' | 'blocked'
type ShiftStatus = 'open' | 'closed'
type ShiftCloseMethod = 'checklist' | 'button' | 'schedule'
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
  shiftCloseMethod?: ShiftCloseMethod
  attestationPercent?: number
  passwordText?: string
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

type Position = { id: string; name: string; department: string; order: number }
const DEFAULT_POSITIONS = ['Официант', 'Старший официант', 'Бармен', 'Старший бармен', 'Повар', 'Су-шеф', 'Шеф-повар', 'Хостес', 'Администратор', 'Управляющий', 'Курьер', 'Мойщик', 'Уборщик', 'Клининг']
const statuses = ['Все', 'На смене', 'Не на смене']
const scheduleDepartments = ['Зал', 'Бар', 'Кухня', 'Клининг']
const defaultWorkModes: Record<string, { start: string; end: string }> = {
  'Зал': { start: '10:00', end: '22:00' },
  'Бар': { start: '12:00', end: '00:00' },
  'Кухня': { start: '09:00', end: '21:00' },
  'Клининг': { start: '08:00', end: '16:00' },
}
const emptyForm = { name: '', login: '', position: '', password: '', shiftStatus: 'closed' as ShiftStatus, shiftCloseMethod: 'button' as ShiftCloseMethod, attestationPercent: 0 }

const emptyScheduleForm: ScheduleForm = {
  scope: 'employee',
  employeeId: '',
  department: 'Зал',
  employeeIds: [],
  day: new Date().getDate(),
  plannedStart: defaultWorkModes['Зал'].start,
  plannedEnd: defaultWorkModes['Зал'].end,
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
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [workModes, setWorkModes] = useState<Record<string, { start: string; end: string }>>(defaultWorkModes)
  const [deptRates, setDeptRates] = useState<Record<string, { hourly: number; kpi: number }>>(() =>
    Object.fromEntries(scheduleDepartments.map((d) => [d, { hourly: 0, kpi: 0 }]))
  )
  const [empRates, setEmpRates] = useState<Record<string, { hourly: number; kpi: number }>>({})
  const [empRevenue, setEmpRevenue] = useState<Record<string, number>>({})

  // positions reference
  const [positionsList, setPositionsList] = useState<Position[]>([])
  const [positionsOpen, setPositionsOpen] = useState(false)
  const [positionNewName, setPositionNewName] = useState('')
  const [positionNewDept, setPositionNewDept] = useState('Зал')
  const [positionSaving, setPositionSaving] = useState(false)
  const [positionError, setPositionError] = useState('')

  const positionNames = positionsList.length > 0 ? positionsList.map(p => p.name) : DEFAULT_POSITIONS

  async function loadPositions() {
    try {
      const data = await api.list<Position>('positions')
      setPositionsList(data.items.sort((a, b) => a.order - b.order))
    } catch {
      setPositionsList([])
    }
  }

  async function addPosition() {
    const name = positionNewName.trim()
    if (!name) return
    setPositionSaving(true)
    setPositionError('')
    try {
      const created = await api.create<Position>('positions', { name, department: positionNewDept, order: positionsList.length + 1 })
      setPositionsList(prev => [...prev, created])
      setPositionNewName('')
    } catch (e) {
      setPositionError(e instanceof Error ? e.message : 'Ошибка при добавлении')
    } finally {
      setPositionSaving(false)
    }
  }

  async function deletePosition(id: string) {
    await api.remove('positions', id)
    setPositionsList(prev => prev.filter(p => p.id !== id))
  }

  const [connectedSystem, setConnectedSystem] = useState('')

  // iiko import
  type IikoEmployee = { iikoId: string; name: string; role: string; phone: string }
  const [iikoImportOpen, setIikoImportOpen] = useState(false)
  const [iikoImportLoading, setIikoImportLoading] = useState(false)
  const [iikoImportError, setIikoImportError] = useState('')
  const [iikoImportItems, setIikoImportItems] = useState<IikoEmployee[]>([])
  const [iikoImportChecked, setIikoImportChecked] = useState<Set<number>>(new Set())
  const [iikoImportPositions, setIikoImportPositions] = useState<Record<number, string>>({})
  const [iikoImporting, setIikoImporting] = useState(false)

  async function loadIikoEmployees() {
    setIikoImportLoading(true)
    setIikoImportError('')
    setIikoImportItems([])
    setIikoImportChecked(new Set())
    setIikoImportPositions({})
    try {
      const resp = await fetch('/api/iiko/employees', { credentials: 'include' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Ошибка')
      const items: IikoEmployee[] = data.items || []
      // pre-check all, pre-fill positions
      setIikoImportItems(items)
      setIikoImportChecked(new Set(items.map((_, i) => i)))
      setIikoImportPositions(Object.fromEntries(items.map((it, i) => [i, guessPosition(it.role)])))
    } catch (e) {
      setIikoImportError(e instanceof Error ? e.message : 'Не удалось загрузить сотрудников')
    } finally {
      setIikoImportLoading(false)
    }
  }

  function guessPosition(role: string): string {
    const r = role.toLowerCase()
    for (const p of positionNames) {
      if (r.includes(p.toLowerCase())) return p
    }
    return ''
  }

  async function doIikoImport() {
    setIikoImporting(true)
    let count = 0
    try {
      for (const [idxStr] of Object.entries(iikoImportPositions)) {
        const idx = Number(idxStr)
        if (!iikoImportChecked.has(idx)) continue
        const item = iikoImportItems[idx]
        const pos = iikoImportPositions[idx] || 'Официант'
        // skip if same name already exists
        if (employees.some(e => e.name === item.name)) continue
        const created = await api.create<Employee>('employees', {
          name: item.name,
          login: item.phone || item.name,
          position: pos,
          password: 'iiko123',
          status: 'active',
          shiftStatus: 'closed',
          attestationPercent: 0,
        })
        setEmployees(prev => [...prev, created])
        count++
      }
      setIikoImportOpen(false)
    } catch (e) {
      setIikoImportError(e instanceof Error ? e.message : 'Ошибка при импорте')
    } finally {
      setIikoImporting(false)
      if (count > 0) setError('')
    }
  }


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
          shiftCloseMethod: visible[0].shiftCloseMethod || 'button',
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

  useEffect(() => {
    void loadEmployees(); void loadSchedule(); void loadPositions()
    fetch('/api/restaurant', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((r) => {
        if (!r) return
        const host: string = r.iikoHost || r.qrHost || ''
        const h = host.toLowerCase()
        if (h.includes('iiko')) setConnectedSystem('iiko')
        else if (h.includes('quickresto') || h.includes('syrve')) setConnectedSystem('Quick Resto')
      })
      .catch(() => {})
  }, [])
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
    setShowEmployeePassword(false)
    setIsCreating(true)
  }

  function closeCreateModal() {
    setIsCreating(false)
    setForm(emptyForm)
    setError('')
  }

  function openEmployee(employee: Employee) {
    setSelectedId(employee.id)
    setForm({
      name: employee.name,
      login: employee.login,
      position: employee.position,
      password: employee.passwordText || '',
      shiftStatus: employee.shiftStatus || 'closed',
      shiftCloseMethod: employee.shiftCloseMethod || 'button',
      attestationPercent: employee.attestationPercent || 0,
    })
    setScheduleForm((current) => ({ ...current, employeeId: employee.id, employeeIds: Array.from(new Set([...current.employeeIds, employee.id])), department: getDepartment(employee.position) }))
    setShowEmployeePassword(false)
    setError('')
    setIsEditing(true)
  }

  function closeEditModal() {
    setIsEditing(false)
    setError('')
  }

  async function saveEmployee() {
    if (!form.name.trim() || !form.login.trim() || !form.position) {
      setError('Заполните имя, телефон/email и должность.')
      return
    }

    if (!selectedId && !form.password) {
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
          shiftCloseMethod: form.shiftCloseMethod,
          attestationPercent: Number(form.attestationPercent || 0),
          status: 'active',
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        })
        setEmployees((items) => items.map((item) => item.id === selectedId ? updated : item))
        setIsEditing(false)
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
        setForm({ name: created.name, login: created.login, position: created.position, password: '', shiftStatus: created.shiftStatus || 'closed', shiftCloseMethod: created.shiftCloseMethod || 'button', attestationPercent: created.attestationPercent || 0 })
        setIsCreating(false)
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
      setIsEditing(false)
      setSelectedId(next[0]?.id || '')
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
          <article><span>Смены</span><strong>{scheduleSummary.planShifts} / {scheduleSummary.factShifts}</strong><small>план / факт</small></article>
          <article><span>Часы</span><strong>{formatHours(scheduleSummary.planHours)} / {formatHours(scheduleSummary.factHours)}</strong><small>план / факт</small></article>
          <article className={scheduleDeviation < 0 ? 'is-negative' : scheduleDeviation > 0 ? 'is-positive' : ''}><span>Отклонение</span><strong>{formatDeviation(scheduleDeviation)}</strong><small>по фактическим часам</small></article>
          <article><span>Чек-листы</span><strong>{scheduleSummary.green} / {scheduleSummary.yellow} / {scheduleSummary.red}</strong><small>зелёные / жёлтые / красные</small></article>
        </div>

        <div className="employees-schedule-redesign__legend">
          <span><i className="legend-green" /> оба чек-листа</span>
          <span><i className="legend-yellow" /> один чек-лист</span>
          <span><i className="legend-red" /> нет чек-листов</span>
          <span className="employees-schedule-redesign__legend-note">Если чек-листов нет, факт считается по графику</span>
        </div>

        <div className="employees-schedule-work-modes">
          <div className="employees-schedule-work-modes__header"><strong>Режим работы</strong><small>Часы по умолчанию при добавлении смены</small></div>
          <div className="employees-schedule-work-modes__grid">
            {scheduleDepartments.map((dept) => (
              <div key={dept} className="employees-schedule-work-modes__row">
                <span>{dept}</span>
                <label><span>Начало</span><input type="time" value={workModes[dept]?.start ?? '09:00'} onChange={(e) => setWorkModes((prev) => ({ ...prev, [dept]: { ...prev[dept], start: e.target.value } }))} /></label>
                <label><span>Конец</span><input type="time" value={workModes[dept]?.end ?? '18:00'} onChange={(e) => setWorkModes((prev) => ({ ...prev, [dept]: { ...prev[dept], end: e.target.value } }))} /></label>
              </div>
            ))}
          </div>
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
                  <th>план/факт</th>
                  <th>план/факт</th>
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
                        <td className="employees-schedule-table__total">{planShifts}/{factShifts}</td>
                        <td className="employees-schedule-table__total">{formatHours(planHours)} / {formatHours(factHours)}</td>
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

  function renderSalaryFund() {
    const monthSchedules = schedules.filter((s) => s.month === scheduleMonth)

    // Per-employee planned hours this month
    const empHours: Record<string, number> = {}
    for (const s of monthSchedules) {
      empHours[s.employeeId] = (empHours[s.employeeId] ?? 0) + (s.plannedHours ?? 0)
    }

    // Rows per department
    const departments = scheduleDepartments.filter((d) => employeesByDepartment[d]?.length)

    let totalFund = 0
    const deptTotals: Array<{ dept: string; fund: number; hours: number }> = []

    for (const dept of departments) {
      let deptFund = 0
      let deptHours = 0
      for (const emp of (employeesByDepartment[dept] ?? [])) {
        const hours = empHours[emp.id] ?? 0
        const rate = empRates[emp.id] ?? deptRates[dept] ?? { hourly: 0, kpi: 0 }
        const revenue = empRevenue[emp.id] ?? 0
        const base = hours * rate.hourly
        deptFund += base + revenue * (rate.kpi / 100)
        deptHours += hours
      }
      deptTotals.push({ dept, fund: deptFund, hours: deptHours })
      totalFund += deptFund
    }

    function fmtMoney(n: number) {
      return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
    }

    return (
      <section className="employees-salary-card">
        <div className="employees-salary-card__hero">
          <div>
            <span className="employees-salary-card__eyebrow">Зарплатный фонд</span>
            <h3>Настройка ставок и расчёт ФОТ</h3>
            <p>Укажите стоимость часа и процент для каждого подразделения. Для отдельного сотрудника можно задать индивидуальную ставку — она перекрывает ставку подразделения.</p>
          </div>
          <div className="employees-salary-card__total">
            <span>Итого план</span>
            <strong>{fmtMoney(totalFund)}</strong>
          </div>
        </div>

        <div className="employees-salary-card__body">
          {/* Department rates */}
          <div className="employees-salary-dept">
            <div className="employees-salary-dept__header">
              <span className="employees-salary-dept__col--name">Подразделение</span>
              <span className="employees-salary-dept__col">Часов (план)</span>
              <span className="employees-salary-dept__col">Ставка, ₽/ч</span>
              <span className="employees-salary-dept__col">KPI, %</span>
              <span className="employees-salary-dept__col employees-salary-dept__col--right">Фонд</span>
            </div>
            {departments.map((dept) => {
              const row = deptTotals.find((r) => r.dept === dept)!
              const rate = deptRates[dept] ?? { hourly: 0, kpi: 0 }
              return (
                <div key={dept} className="employees-salary-dept__row">
                  <span className="employees-salary-dept__col--name">{dept}</span>
                  <span className="employees-salary-dept__col">{row.hours.toFixed(1)} ч</span>
                  <input
                    className="employees-salary-dept__input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rate.hourly || ''}
                    onChange={(e) => setDeptRates((prev) => ({ ...prev, [dept]: { ...prev[dept], hourly: Number(e.target.value || 0) } }))}
                  />
                  <input
                    className="employees-salary-dept__input employees-salary-dept__input--pct"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={rate.kpi || ''}
                    onChange={(e) => setDeptRates((prev) => ({ ...prev, [dept]: { ...prev[dept], kpi: Number(e.target.value || 0) } }))}
                  />
                  <span className="employees-salary-dept__col employees-salary-dept__col--right employees-salary-dept__fund">{fmtMoney(row.fund)}</span>
                </div>
              )
            })}
          </div>

          {/* Individual overrides */}
          <details className="employees-salary-individual">
            <summary>Индивидуальные ставки сотрудников</summary>
            <div className="employees-salary-individual__body">
              <div className="employees-salary-dept__header">
                <span className="employees-salary-dept__col--name">Сотрудник</span>
                <span className="employees-salary-dept__col">Часов (план)</span>
                <span className="employees-salary-dept__col">Ставка, ₽/ч</span>
                <span className="employees-salary-dept__col">Выручка, ₽</span>
                <span className="employees-salary-dept__col">KPI, %</span>
                <span className="employees-salary-dept__col employees-salary-dept__col--right">Фонд</span>
              </div>
              {employees.map((emp) => {
                const hours = empHours[emp.id] ?? 0
                const dept = getDepartment(emp.position)
                const deptRate = deptRates[dept] ?? { hourly: 0, kpi: 0 }
                const override = empRates[emp.id]
                const rate = override ?? deptRate
                const revenue = empRevenue[emp.id] ?? 0
                const fund = hours * rate.hourly + revenue * (rate.kpi / 100)
                return (
                  <div key={emp.id} className={`employees-salary-dept__row${override ? ' employees-salary-dept__row--override' : ''}`}>
                    <span className="employees-salary-dept__col--name">
                      {emp.name}
                      {override ? <small> (инд.)</small> : null}
                    </span>
                    <span className="employees-salary-dept__col">{hours.toFixed(1)} ч</span>
                    <input
                      className="employees-salary-dept__input"
                      type="number"
                      min="0"
                      placeholder={String(deptRate.hourly || 0)}
                      value={override?.hourly ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setEmpRates((prev) => {
                          const cur = prev[emp.id] ?? { hourly: deptRate.hourly, kpi: deptRate.kpi }
                          if (val === '' && !cur.kpi) { const next = { ...prev }; delete next[emp.id]; return next }
                          return { ...prev, [emp.id]: { ...cur, hourly: Number(val || 0) } }
                        })
                      }}
                    />
                    <input
                      className="employees-salary-dept__input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={revenue || ''}
                      onChange={(e) => setEmpRevenue((prev) => ({ ...prev, [emp.id]: Number(e.target.value || 0) }))}
                    />
                    <input
                      className="employees-salary-dept__input employees-salary-dept__input--pct"
                      type="number"
                      min="0"
                      max="100"
                      placeholder={String(deptRate.kpi || 0)}
                      value={override?.kpi ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setEmpRates((prev) => {
                          const cur = prev[emp.id] ?? { hourly: deptRate.hourly, kpi: deptRate.kpi }
                          if (val === '' && !cur.hourly) { const next = { ...prev }; delete next[emp.id]; return next }
                          return { ...prev, [emp.id]: { ...cur, kpi: Number(val || 0) } }
                        })
                      }}
                    />
                    <span className="employees-salary-dept__col employees-salary-dept__col--right employees-salary-dept__fund">{fmtMoney(fund)}</span>
                  </div>
                )
              })}
            </div>
          </details>
        </div>
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

      <div className="employees-layout">
        <section className="employees-table-card">
          <div className="employees-filters employees-filters--compact">
            <label className="employees-search">
              <SearchIcon />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по имени или телефону..." />
            </label>
            <label className="employees-select">
              <span>Должность:</span>
              <select value={position} onChange={(event) => setPosition(event.target.value)}>{['Все', ...positionNames].map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <label className="employees-select">
              <span>Статус:</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <button className="employees-reset-button" type="button" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => { setIikoImportOpen(true); void loadIikoEmployees() }}>↓ {connectedSystem || 'Импорт'}</button>
            <button className="employees-reset-button" type="button" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setPositionsOpen(true)}>Должности</button>
            <button className="employees-primary-button" type="button" onClick={startCreate}>+ Сотрудник</button>
          </div>

          <div className="employees-table-wrap">
            <table className="employees-table employees-table--clickable">
              <thead>
                <tr><th>Сотрудник</th><th>Должность</th><th>Аттестация</th><th>Смен в этом месяце</th></tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6}>Загрузка...</td></tr> : null}
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="employees-row employees-table--clickable" onClick={() => openEmployee(employee)}>
                    <td><div className="employees-person"><span>{getInitials(employee.name)}</span><div><strong>{employee.name}</strong><small>{employee.login}</small></div></div></td>
                    <td>{employee.position}</td>
                    <td><AttestationBar value={employee.attestationPercent || 0} /></td>
                    <td>{monthSchedules.filter(s => s.employeeId === employee.id).length || '—'}</td>
                  </tr>
                ))}
                {!isLoading && filteredEmployees.length === 0 ? <tr><td colSpan={6}>Сотрудники не найдены</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="employees-table-footer"><span>Показано {filteredEmployees.length} из {employees.length}</span></div>
        </section>

      </div>

      {renderScheduleTable()}

      {renderSalaryFund()}

      {isCreating ? (
        <div className="employees-modal-backdrop" role="presentation" onMouseDown={closeCreateModal}>
          <div className="employees-modal" role="dialog" aria-modal="true" aria-label="Новый сотрудник" onMouseDown={(e) => e.stopPropagation()}>
            <div className="employees-modal__header">
              <h3>Новый сотрудник</h3>
              <button type="button" className="employees-modal__close" onClick={closeCreateModal} aria-label="Закрыть">×</button>
            </div>
            <div className="employees-modal__body">
              <label><span>Имя сотрудника</span><input autoFocus value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Введите имя сотрудника" /></label>
              <label><span>Телефон или email</span><input value={form.login} onChange={(e) => setForm((v) => ({ ...v, login: e.target.value }))} placeholder="Введите телефон или email" /></label>
              <label><span>Должность</span><select value={form.position} onChange={(e) => setForm((v) => ({ ...v, position: e.target.value }))}><option value="" disabled>Выберите должность</option>{positionNames.map((item) => <option key={item}>{item}</option>)}</select></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--rc-text)' }}>Временный пароль</span>
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input style={{ flex: 1, paddingRight: '40px', width: '100%', boxSizing: 'border-box' }} value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} placeholder="Придумайте пароль" type={showEmployeePassword ? 'text' : 'password'} />
                  <button type="button" onClick={() => setShowEmployeePassword((v) => !v)} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#8e929c', display: 'flex', alignItems: 'center' }}><EyeIcon style={{ width: '20px', height: '20px' }} /></button>
                </span>
              </div>
              {error ? <p className="employees-error">{error}</p> : null}
            </div>
            <div className="employees-modal__footer">
              <button className="employees-create-button" type="button" onClick={saveEmployee}>Создать сотрудника</button>
              <button className="employees-cancel-button" type="button" onClick={closeCreateModal}>Отмена</button>
            </div>
          </div>
        </div>
      ) : null}

      {iikoImportOpen && (
        <div className="employees-modal-backdrop" role="presentation" onMouseDown={() => setIikoImportOpen(false)}>
          <div className="employees-modal" role="dialog" aria-modal="true" style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="employees-modal__header">
              <h3>Импорт сотрудников{connectedSystem ? ` из ${connectedSystem}` : ''}</h3>
              <button type="button" className="employees-modal__close" onClick={() => setIikoImportOpen(false)}>×</button>
            </div>

            {iikoImportLoading && <p style={{ padding: '24px 20px', color: '#6b7280', textAlign: 'center' }}>Загружаю сотрудников{connectedSystem ? ` из ${connectedSystem}` : ''}...</p>}
            {iikoImportError && <p style={{ padding: '12px 20px', color: '#ef4444' }}>{iikoImportError}</p>}
            {!iikoImportLoading && iikoImportItems.length === 0 && !iikoImportError && <p style={{ padding: '24px 20px', color: '#6b7280' }}>Сотрудники не найдены</p>}

            {iikoImportItems.length > 0 && <>
              <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="iiko-check-all"
                  checked={iikoImportItems.every((_, i) => iikoImportChecked.has(i))}
                  onChange={(e) => setIikoImportChecked(e.target.checked ? new Set(iikoImportItems.map((_, i) => i)) : new Set())}
                />
                <label htmlFor="iiko-check-all" style={{ fontSize: 13, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                  Выбрать всех · <span style={{ color: '#6b7280' }}>{iikoImportChecked.size} / {iikoImportItems.length}</span>
                </label>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>Временный пароль: <strong>123456</strong></span>
              </div>

              <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                {iikoImportItems.map((it, i) => {
                  const exists = employees.some(e => e.name === it.name)
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: '1px solid #f9fafb', background: exists ? '#f9fafb' : iikoImportChecked.has(i) ? '#eff6ff' : 'transparent', opacity: exists ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        disabled={exists}
                        checked={iikoImportChecked.has(i)}
                        onChange={() => setIikoImportChecked(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })}
                        style={{ justifySelf: 'center' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.name}
                          {exists && <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>уже есть</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.role}{it.phone ? ` · ${it.phone}` : ''}</div>
                      </div>
                      <select
                        disabled={exists || !iikoImportChecked.has(i)}
                        value={iikoImportPositions[i] || ''}
                        onChange={(e) => setIikoImportPositions(prev => ({ ...prev, [i]: e.target.value }))}
                        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', width: 150 }}
                      >
                        <option value="" disabled>Должность</option>
                        {positionNames.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </>}

            {iikoImportItems.length > 0 && !iikoImportLoading && (
              <div className="employees-modal__footer">
                <button className="employees-create-button" type="button" disabled={iikoImporting || iikoImportChecked.size === 0} onClick={() => void doIikoImport()}>
                  {iikoImporting ? 'Импортирую...' : `Импортировать ${iikoImportChecked.size} сотрудников`}
                </button>
                <button className="employees-cancel-button" type="button" onClick={() => setIikoImportOpen(false)}>Отмена</button>
              </div>
            )}
          </div>
        </div>
      )}

      {positionsOpen && (
        <div className="employees-modal-backdrop" role="presentation" onMouseDown={() => setPositionsOpen(false)}>
          <div className="employees-modal employees-modal--positions" role="dialog" aria-modal="true" aria-label="Справочник должностей" onMouseDown={(e) => e.stopPropagation()}>
            <div className="employees-modal__header">
              <h3>Должности</h3>
              <button type="button" className="employees-modal__close" onClick={() => setPositionsOpen(false)} aria-label="Закрыть">×</button>
            </div>
            <div className="employees-positions__add">
              <input
                value={positionNewName}
                onChange={(e) => { setPositionNewName(e.target.value); setPositionError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') void addPosition() }}
                placeholder="Название должности"
                autoFocus
              />
              <select value={positionNewDept} onChange={(e) => setPositionNewDept(e.target.value)}>
                {scheduleDepartments.map(d => <option key={d}>{d}</option>)}
              </select>
              <button type="button" className="employees-positions__add-btn" disabled={positionSaving || !positionNewName.trim()} onClick={() => void addPosition()}>
                {positionSaving ? '...' : '+ Добавить'}
              </button>
            </div>
            {positionError && <p className="employees-error" style={{ margin: '0', padding: '0 24px 8px', fontSize: 13 }}>{positionError}</p>}
            <div className="employees-positions__list">
              {positionsList.length === 0 && (
                <p className="employees-positions__empty">Должностей пока нет</p>
              )}
              {Object.entries(
                positionsList.reduce<Record<string, Position[]>>((acc, p) => {
                  const d = p.department || 'Другое';
                  (acc[d] = acc[d] || []).push(p)
                  return acc
                }, {})
              ).map(([dept, items]) => (
                <div key={dept} className="employees-positions__group">
                  <span className="employees-positions__dept">{dept}</span>
                  {items.map(p => (
                    <div key={p.id} className="employees-positions__item">
                      <span>{p.name}</span>
                      <button type="button" className="employees-positions__delete" onClick={() => void deletePosition(p.id)} aria-label="Удалить">×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isEditing && selectedEmployee ? (
        <div className="employees-modal-backdrop" role="presentation" onMouseDown={closeEditModal}>
          <div className="employees-modal" role="dialog" aria-modal="true" aria-label="Редактирование сотрудника" onMouseDown={(e) => e.stopPropagation()}>
            <div className="employees-modal__header">
              <h3>Редактирование сотрудника</h3>
              <button type="button" className="employees-modal__close" onClick={closeEditModal} aria-label="Закрыть">×</button>
            </div>
            <div className="employees-modal__body">
              <label><span>Имя сотрудника</span><input autoFocus value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Введите имя сотрудника" /></label>
              <label><span>Телефон или email</span><input value={form.login} onChange={(e) => setForm((v) => ({ ...v, login: e.target.value }))} placeholder="Введите телефон или email" /></label>
              <label><span>Должность</span><select value={form.position} onChange={(e) => setForm((v) => ({ ...v, position: e.target.value }))}><option value="" disabled>Выберите должность</option>{positionNames.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Закрытие смены</span><select value={form.shiftCloseMethod} onChange={(e) => setForm((v) => ({ ...v, shiftCloseMethod: e.target.value as ShiftCloseMethod }))}><option value="checklist">По чек-листу закрытия</option><option value="button">По кнопке «Закрыть смену»</option><option value="schedule">По графику (автоматически)</option></select></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--rc-text)' }}>Новый пароль <small style={{ fontWeight: 400, color: 'var(--rc-muted)' }}>(оставьте пустым чтобы не менять)</small></span>
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input style={{ flex: 1, paddingRight: '40px', width: '100%', boxSizing: 'border-box' }} value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} placeholder="Введите новый пароль" type={showEmployeePassword ? 'text' : 'password'} />
                  <button type="button" onClick={() => setShowEmployeePassword((v) => !v)} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rc-muted)', display: 'flex', alignItems: 'center' }}><EyeIcon style={{ width: '20px', height: '20px' }} /></button>
                </span>
              </div>
{error ? <p className="employees-error">{error}</p> : null}
            </div>
            <div className="employees-modal__footer employees-modal__footer--edit">
              <button className="employees-create-button" type="button" onClick={saveEmployee}>Сохранить</button>
              <button className="employees-cancel-button employees-cancel-button--danger" type="button" onClick={fireEmployee}>Удалить</button>
              <button className="employees-cancel-button" type="button" onClick={closeEditModal}>Отмена</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
