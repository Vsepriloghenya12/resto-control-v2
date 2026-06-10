import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircleIcon, ChecklistIcon, SearchIcon, TeamIcon, UserIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type EmployeeStatus = 'active' | 'blocked'
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
const statuses = ['Все', 'На смене', 'Не на смене', 'Заблокирован']

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'С'
}

function getStatusLabel(employee: Employee) {
  if (employee.status === 'blocked') return 'Заблокирован'
  if (employee.shiftStatus === 'open') return 'На смене'
  return 'Не на смене'
}

function getStatusClass(employee: Employee) {
  if (employee.status === 'blocked') return 'blocked'
  if (employee.shiftStatus === 'open') return 'onShift'
  return 'offShift'
}

function getAttestationTone(value: number): AttestationTone {
  if (value >= 75) return 'good'
  if (value >= 55) return 'medium'
  return 'low'
}

function EmployeeMetric({ icon, value, label, hint, tone }: { icon: ReactNode; value: string; label: string; hint: string; tone: 'blue' | 'green' | 'red' | 'purple' }) {
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
      <span>
        <i className={`employees-attestation__bar employees-attestation__bar--${tone}`} style={{ width: `${value}%` }} />
      </span>
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
  const [form, setForm] = useState({ name: '', login: '', position: '', password: '' })

  async function loadEmployees() {
    setIsLoading(true)
    setError('')
    try {
      const result = await api.list<Employee>('employees')
      setEmployees(result.items)
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

  const onShiftCount = employees.filter((item) => item.shiftStatus === 'open' && item.status !== 'blocked').length
  const blockedCount = employees.filter((item) => item.status === 'blocked').length
  const avgAttestation = employees.length ? Math.round(employees.reduce((sum, item) => sum + (item.attestationPercent || 0), 0) / employees.length) : 0

  async function createEmployee() {
    if (!form.name.trim() || !form.login.trim() || !form.position || !form.password.trim()) {
      setError('Заполните имя, телефон/email, должность и временный пароль.')
      return
    }
    try {
      const created = await api.create<Employee>('employees', {
        name: form.name.trim(),
        login: form.login.trim(),
        position: form.position,
        password: form.password,
        status: 'active',
        shiftStatus: 'closed',
        attestationPercent: 0,
      })
      setEmployees((items) => [created, ...items])
      setForm({ name: '', login: '', position: '', password: '' })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сотрудника')
    }
  }

  async function toggleBlock(employee: Employee) {
    const nextStatus: EmployeeStatus = employee.status === 'blocked' ? 'active' : 'blocked'
    const updated = await api.update<Employee>('employees', employee.id, { status: nextStatus })
    setEmployees((items) => items.map((item) => item.id === employee.id ? updated : item))
  }

  async function removeEmployee(employee: Employee) {
    await api.remove('employees', employee.id)
    setEmployees((items) => items.filter((item) => item.id !== employee.id))
  }

  return (
    <section className="employees-page">
      <section className="employees-metrics-grid" aria-label="Сводка по сотрудникам">
        <EmployeeMetric icon={<TeamIcon />} value={String(employees.length)} label="Всего сотрудников" hint="Активные и заблокированные" tone="blue" />
        <EmployeeMetric icon={<UserIcon />} value={String(onShiftCount)} label="На смене сейчас" hint="Открыли смену" tone="green" />
        <EmployeeMetric icon={<AlertCircleIcon />} value={String(blockedCount)} label="Заблокированы" hint="Без доступа" tone="red" />
        <EmployeeMetric icon={<ChecklistIcon />} value={`${avgAttestation}%`} label="Средняя аттестация" hint="По всем сотрудникам" tone="purple" />
      </section>

      {error ? <div className="employees-add-panel__hint"><AlertCircleIcon /><p>{error}</p></div> : null}

      <div className="employees-layout">
        <section className="employees-table-card">
          <div className="employees-filters">
            <label className="employees-search">
              <SearchIcon />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по имени или телефону..." />
            </label>
            <label className="employees-select">
              <span>Должность:</span>
              <select value={position} onChange={(event) => setPosition(event.target.value)}>
                {positions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="employees-select">
              <span>Статус:</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <button className="employees-reset-button" type="button" onClick={() => { setSearch(''); setPosition('Все'); setStatus('Все') }}>Сбросить</button>
          </div>

          <div className="employees-table-wrap">
            <table className="employees-table">
              <thead>
                <tr><th>Сотрудник</th><th>Должность</th><th>Статус</th><th>Аттестация</th><th>Сегодня</th><th>Задачи</th><th>Активность</th><th>Действия</th></tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={8}>Загрузка...</td></tr> : null}
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td><div className="employees-person"><span>{getInitials(employee.name)}</span><div><strong>{employee.name}</strong><small>{employee.login}</small></div></div></td>
                    <td>{employee.position}</td>
                    <td><span className={`employees-status employees-status--${getStatusClass(employee)}`}>{getStatusLabel(employee)}</span></td>
                    <td><AttestationBar value={employee.attestationPercent || 0} /></td>
                    <td>{employee.shiftStatus === 'open' ? 'Смена открыта' : 'Смена не открыта'}</td>
                    <td><span className="employees-task-progress">—</span></td>
                    <td>{employee.updatedAt ? new Date(employee.updatedAt).toLocaleDateString('ru-RU') : '—'}</td>
                    <td><div className="employees-actions"><button type="button" onClick={() => toggleBlock(employee)}>{employee.status === 'blocked' ? 'Разблокировать' : 'Блок'}</button><button type="button" onClick={() => removeEmployee(employee)}>Удалить</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="employees-table-footer"><span>Показано {filteredEmployees.length} из {employees.length}</span></div>
        </section>

        <aside className="employees-add-panel" aria-label="Добавить сотрудника">
          <div className="employees-add-panel__header"><h3>Добавить сотрудника</h3></div>
          <label><span>Имя сотрудника</span><input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Введите имя сотрудника" /></label>
          <label><span>Телефон или email</span><input value={form.login} onChange={(e) => setForm((v) => ({ ...v, login: e.target.value }))} placeholder="Введите телефон или email" /></label>
          <label><span>Должность</span><select value={form.position} onChange={(e) => setForm((v) => ({ ...v, position: e.target.value }))}><option value="" disabled>Выберите должность</option>{positions.filter((item) => item !== 'Все').map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Временный пароль</span><input value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} placeholder="Придумайте пароль" type="password" /></label>
          <div className="employees-add-panel__spacer" />
          <button className="employees-create-button" type="button" onClick={createEmployee}>Создать сотрудника</button>
          <button className="employees-cancel-button" type="button" onClick={() => setForm({ name: '', login: '', position: '', password: '' })}>Отмена</button>
          <div className="employees-add-panel__hint"><AlertCircleIcon /><p>После создания сотрудник сможет войти по указанному телефону или email и временному паролю.</p></div>
        </aside>
      </div>
    </section>
  )
}
