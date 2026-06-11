import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircleIcon, ChecklistIcon, SearchIcon, TeamIcon, UserIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type EmployeeStatus = 'active' | 'fired' | 'blocked'
type ShiftStatus = 'open' | 'closed'
type AttestationTone = 'good' | 'medium' | 'low'

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

const positions = ['Все', 'Официант', 'Старший официант', 'Бармен', 'Старший бармен', 'Повар', 'Су-шеф', 'Шеф-повар', 'Хостес', 'Администратор', 'Управляющий', 'Курьер', 'Мойщик', 'Уборщик', 'Клининг']
const statuses = ['Все', 'На смене', 'Не на смене']
const emptyForm = { name: '', login: '', position: '', password: '', shiftStatus: 'closed' as ShiftStatus, attestationPercent: 0 }

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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сотрудников')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadEmployees() }, [])

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
          {!selectedEmployee ? <label><span>Временный пароль</span><input value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} placeholder="Придумайте пароль" type="password" /></label> : null}
          <button className="employees-create-button" type="button" onClick={saveEmployee}>{selectedEmployee ? 'Сохранить карточку' : 'Создать сотрудника'}</button>
          {selectedEmployee ? <button className="employees-cancel-button" type="button" onClick={fireEmployee}>Удалить сотрудника</button> : <button className="employees-cancel-button" type="button" onClick={startCreate}>Очистить</button>}
        </aside>
      </div>
    </section>
  )
}
