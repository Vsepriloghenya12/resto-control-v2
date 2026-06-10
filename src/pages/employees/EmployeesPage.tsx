import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircleIcon,
  ChecklistIcon,
  SearchIcon,
  TeamIcon,
  UserIcon,
} from '../../shared/ui/Icon'

type EmployeeStatus = 'onShift' | 'offShift' | 'blocked'
type AttestationTone = 'good' | 'medium' | 'low'

type Employee = {
  id: string
  name: string
  contact: string
  position: string
  status: EmployeeStatus
  today: string
  tasks: string
  activity: string
  attestation: number
  initials: string
}

const employees: Employee[] = [
  {
    id: 'emp-1',
    name: 'Анна Смирнова',
    contact: '+7 999 123-45-67',
    position: 'Старший официант',
    status: 'onShift',
    today: 'Смена открыта с 10:00',
    tasks: '2 / 3',
    activity: '12 мин назад',
    attestation: 86,
    initials: 'АС',
  },
  {
    id: 'emp-2',
    name: 'Дмитрий Волков',
    contact: '+7 999 234-56-78',
    position: 'Бармен',
    status: 'onShift',
    today: 'Смена открыта с 12:00',
    tasks: '1 / 3',
    activity: '8 мин назад',
    attestation: 78,
    initials: 'ДВ',
  },
  {
    id: 'emp-3',
    name: 'Мария Иванова',
    contact: '+7 999 345-67-89',
    position: 'Официант',
    status: 'offShift',
    today: 'Смена не открыта',
    tasks: '0 / 2',
    activity: '2 ч назад',
    attestation: 65,
    initials: 'МИ',
  },
  {
    id: 'emp-4',
    name: 'Алексей Кузнецов',
    contact: '+7 999 456-78-90',
    position: 'Повар',
    status: 'onShift',
    today: 'Смена открыта с 09:00',
    tasks: '3 / 4',
    activity: '5 мин назад',
    attestation: 92,
    initials: 'АК',
  },
  {
    id: 'emp-5',
    name: 'Сергей Петров',
    contact: '+7 999 567-89-01',
    position: 'Старший бармен',
    status: 'onShift',
    today: 'Смена открыта с 11:00',
    tasks: '2 / 2',
    activity: '3 мин назад',
    attestation: 88,
    initials: 'СП',
  },
  {
    id: 'emp-6',
    name: 'Екатерина Белова',
    contact: '+7 999 678-90-12',
    position: 'Хостес',
    status: 'offShift',
    today: 'Смена не открыта',
    tasks: '1 / 3',
    activity: '1 ч назад',
    attestation: 60,
    initials: 'ЕБ',
  },
  {
    id: 'emp-7',
    name: 'Игорь Соколов',
    contact: '+7 999 789-01-23',
    position: 'Клининг',
    status: 'blocked',
    today: '—',
    tasks: '—',
    activity: '2 дн назад',
    attestation: 40,
    initials: 'ИС',
  },
  {
    id: 'emp-8',
    name: 'Ольга Николаева',
    contact: '+7 999 890-12-34',
    position: 'Старший официант',
    status: 'onShift',
    today: 'Смена открыта с 10:30',
    tasks: '2 / 3',
    activity: '7 мин назад',
    attestation: 75,
    initials: 'ОН',
  },
]

const positions = ['Все', 'Официант', 'Старший официант', 'Бармен', 'Старший бармен', 'Повар', 'Хостес', 'Клининг']
const statuses = ['Все', 'На смене', 'Не на смене', 'Заблокирован']

function getStatusLabel(status: EmployeeStatus) {
  if (status === 'onShift') return 'На смене'
  if (status === 'blocked') return 'Заблокирован'
  return 'Не на смене'
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
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState('Все')
  const [status, setStatus] = useState('Все')

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return employees.filter((employee) => {
      const matchesSearch = !normalizedSearch
        || employee.name.toLowerCase().includes(normalizedSearch)
        || employee.contact.toLowerCase().includes(normalizedSearch)
      const matchesPosition = position === 'Все' || employee.position === position
      const matchesStatus = status === 'Все' || getStatusLabel(employee.status) === status

      return matchesSearch && matchesPosition && matchesStatus
    })
  }, [position, search, status])

  return (
    <section className="employees-page">
      <section className="employees-metrics-grid" aria-label="Сводка по сотрудникам">
        <EmployeeMetric icon={<TeamIcon />} value="24" label="Всего сотрудников" hint="Активные сотрудники" tone="blue" />
        <EmployeeMetric icon={<UserIcon />} value="8" label="На смене сейчас" hint="Открыли смену" tone="green" />
        <EmployeeMetric icon={<AlertCircleIcon />} value="4" label="Есть проблемы" hint="Требуют внимания" tone="red" />
        <EmployeeMetric icon={<ChecklistIcon />} value="72%" label="Средняя аттестация" hint="По всем сотрудникам" tone="purple" />
      </section>

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
                <tr>
                  <th>Сотрудник</th>
                  <th>Должность</th>
                  <th>Статус</th>
                  <th>Аттестация</th>
                  <th>Сегодня</th>
                  <th>Задачи</th>
                  <th>Активность</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="employees-person">
                        <span>{employee.initials}</span>
                        <div>
                          <strong>{employee.name}</strong>
                          <small>{employee.contact}</small>
                        </div>
                      </div>
                    </td>
                    <td>{employee.position}</td>
                    <td><span className={`employees-status employees-status--${employee.status}`}>{getStatusLabel(employee.status)}</span></td>
                    <td><AttestationBar value={employee.attestation} /></td>
                    <td>{employee.today}</td>
                    <td><span className="employees-task-progress">{employee.tasks}</span></td>
                    <td>{employee.activity}</td>
                    <td>
                      <div className="employees-actions">
                        <button type="button">Открыть</button>
                        <button type="button" aria-label="Действия сотрудника">⋮</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="employees-table-footer">
            <span>Показано {filteredEmployees.length} из 24</span>
            <div>
              <button type="button" disabled>‹</button>
              <button type="button" className="employees-page-button--active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">›</button>
            </div>
          </div>
        </section>

        <aside className="employees-add-panel" aria-label="Добавить сотрудника">
          <div className="employees-add-panel__header">
            <h3>Добавить сотрудника</h3>
            <button type="button" aria-label="Закрыть форму">×</button>
          </div>

          <label>
            <span>Имя сотрудника</span>
            <input placeholder="Введите имя сотрудника" />
          </label>

          <label>
            <span>Телефон или email</span>
            <input placeholder="Введите телефон или email" />
          </label>

          <label>
            <span>Должность</span>
            <select defaultValue="">
              <option value="" disabled>Выберите должность</option>
              <option>Официант</option>
              <option>Старший официант</option>
              <option>Бармен</option>
              <option>Старший бармен</option>
              <option>Повар</option>
              <option>Хостес</option>
              <option>Клининг</option>
            </select>
          </label>

          <label>
            <span>Временный пароль</span>
            <input placeholder="Придумайте пароль" type="password" />
          </label>

          <div className="employees-add-panel__spacer" />

          <button className="employees-create-button" type="button">Создать сотрудника</button>
          <button className="employees-cancel-button" type="button">Отмена</button>

          <div className="employees-add-panel__hint">
            <AlertCircleIcon />
            <p>После создания сотрудник сможет войти по указанному телефону или email и временному паролю.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
