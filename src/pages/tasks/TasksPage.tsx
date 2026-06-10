import { useMemo, useState } from 'react'
import {
  AlertCircleIcon,
  CalendarIcon,
  ChecklistIcon,
  ClockIcon,
  SearchIcon,
  TeamIcon,
  UserIcon,
} from '../../shared/ui/Icon'

type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'overdue'
type AssignmentType = 'position' | 'employee'

type Task = {
  id: string
  title: string
  description: string
  assignee: string
  assignmentType: AssignmentType
  status: TaskStatus
  dueDate: string
  dueTime: string
  requiresPhoto: boolean
  active: boolean
  extraNote: string
}

const statusLabels: Record<TaskStatus, string> = {
  not_started: 'Не начата',
  in_progress: 'В работе',
  done: 'Выполнена',
  overdue: 'Просрочена',
}

const assignmentLabels: Record<AssignmentType, string> = {
  position: 'Должность',
  employee: 'Сотрудник',
}

const tasks: Task[] = [
  {
    id: 'task-1',
    title: 'Проверить чистоту летней террасы',
    description: 'Проверить и привести в порядок летнюю террасу: столы, стулья, перила, растения, мусорные урны. Убедиться в отсутствии мусора и посторонних предметов.',
    assignee: 'Официант',
    assignmentType: 'position',
    status: 'in_progress',
    dueDate: '09.06.2026',
    dueTime: '18:00',
    requiresPhoto: true,
    active: true,
    extraNote: 'Сотрудник не сможет завершить задачу без фото.',
  },
  {
    id: 'task-2',
    title: 'Пересчитать бутылки вина на баре',
    description: 'Проверить фактическое количество открытых и закрытых бутылок вина на баре перед закрытием смены.',
    assignee: 'Старший бармен',
    assignmentType: 'position',
    status: 'not_started',
    dueDate: '09.06.2026',
    dueTime: '22:00',
    requiresPhoto: false,
    active: true,
    extraNote: 'Сверить остатки с барным листом.',
  },
  {
    id: 'task-3',
    title: 'Проверить наличие ценников в зале',
    description: 'Проверить витрины, столы с предложениями и зоны продаж. Ценники должны быть на месте и повернуты к гостю.',
    assignee: 'Хостес',
    assignmentType: 'position',
    status: 'done',
    dueDate: '10.06.2026',
    dueTime: '12:00',
    requiresPhoto: true,
    active: true,
    extraNote: 'Фото прикрепляется после проверки.',
  },
  {
    id: 'task-4',
    title: 'Проверить исправность кофемашины',
    description: 'Проверить воду, помол, чистоту группы и готовность кофемашины к вечерней смене.',
    assignee: 'Бармен',
    assignmentType: 'position',
    status: 'overdue',
    dueDate: '10.06.2026',
    dueTime: '10:00',
    requiresPhoto: false,
    active: true,
    extraNote: 'При проблеме сообщить управляющему.',
  },
  {
    id: 'task-5',
    title: 'Убрать склад и проверить сроки',
    description: 'Проверить порядок на складе, убрать лишнее, вынести просроченные позиции на проверку управляющему.',
    assignee: 'Клининг',
    assignmentType: 'position',
    status: 'not_started',
    dueDate: '10.06.2026',
    dueTime: '15:00',
    requiresPhoto: true,
    active: true,
    extraNote: 'Фото нужно до и после уборки.',
  },
  {
    id: 'task-6',
    title: 'Проверить санитарное состояние кухни',
    description: 'Проверить рабочие поверхности, маркировку контейнеров и чистоту холодильников.',
    assignee: 'Повар',
    assignmentType: 'position',
    status: 'in_progress',
    dueDate: '10.06.2026',
    dueTime: '14:00',
    requiresPhoto: true,
    active: true,
    extraNote: 'Фото обязательно по завершению.',
  },
  {
    id: 'task-7',
    title: 'Заменить расходные материалы в санузлах',
    description: 'Проверить бумагу, полотенца, мыло, мусорные корзины и чистоту зеркал.',
    assignee: 'Хостес',
    assignmentType: 'position',
    status: 'done',
    dueDate: '10.06.2026',
    dueTime: '11:00',
    requiresPhoto: false,
    active: true,
    extraNote: 'Проверять перед обеденной посадкой.',
  },
]

const statuses = ['Все', 'Не начата', 'В работе', 'Выполнена', 'Просрочена']
const assignmentOptions = ['Все', 'Должность', 'Сотрудник']
const photoOptions = ['Все', 'Нужно фото', 'Фото не нужно']

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`tasks-status tasks-status--${status}`}>{statusLabels[status]}</span>
}

function TaskListItem({ task, active, onSelect }: { task: Task; active: boolean; onSelect: () => void }) {
  return (
    <button className={active ? 'tasks-list-item tasks-list-item--active' : 'tasks-list-item'} type="button" onClick={onSelect}>
      <div className="tasks-list-item__top">
        <strong>{task.title}</strong>
        <StatusBadge status={task.status} />
      </div>
      <p>{task.assignee} · {task.dueDate === '09.06.2026' ? 'сегодня' : task.dueDate} до {task.dueTime}</p>
      <div className="tasks-list-item__meta">
        <span>{task.requiresPhoto ? 'Нужно фото' : 'Фото не нужно'}</span>
        <span>{assignmentLabels[task.assignmentType]}</span>
      </div>
    </button>
  )
}

export function TasksPage() {
  const [selectedId, setSelectedId] = useState(tasks[0].id)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Все')
  const [assignment, setAssignment] = useState('Все')
  const [photo, setPhoto] = useState('Все')

  const selectedTask = useMemo(() => tasks.find((item) => item.id === selectedId) ?? tasks[0], [selectedId])

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return tasks.filter((task) => {
      const matchesQuery = !normalized || task.title.toLowerCase().includes(normalized) || task.assignee.toLowerCase().includes(normalized)
      const matchesStatus = status === 'Все' || statusLabels[task.status] === status
      const matchesAssignment = assignment === 'Все' || assignmentLabels[task.assignmentType] === assignment
      const matchesPhoto = photo === 'Все' || (photo === 'Нужно фото' ? task.requiresPhoto : !task.requiresPhoto)

      return matchesQuery && matchesStatus && matchesAssignment && matchesPhoto
    })
  }, [assignment, photo, query, status])

  return (
    <section className="tasks-page">
      <aside className="tasks-list-panel">
        <div className="tasks-list-panel__top">
          <button className="tasks-create-button" type="button">+ Создать задачу</button>
          <label className="tasks-search">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию..." />
          </label>
          <div className="tasks-filters-row">
            <label className="tasks-filter">
              <span>Статус:</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="tasks-filter">
              <span>Назначено:</span>
              <select value={assignment} onChange={(event) => setAssignment(event.target.value)}>
                {assignmentOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="tasks-filter">
              <span>Фото:</span>
              <select value={photo} onChange={(event) => setPhoto(event.target.value)}>
                {photoOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <button className="tasks-reset-button" type="button" onClick={() => { setQuery(''); setStatus('Все'); setAssignment('Все'); setPhoto('Все') }}>Сбросить</button>
          </div>
        </div>

        <div className="tasks-list">
          {filteredTasks.map((task) => (
            <TaskListItem task={task} active={task.id === selectedTask.id} onSelect={() => setSelectedId(task.id)} key={task.id} />
          ))}
        </div>

        <div className="tasks-list-panel__footer">Всего задач: {tasks.length}</div>
      </aside>

      <section className="tasks-editor">
        <div className="tasks-editor-toolbar">
          <div>
            <h2>Создание / редактирование задачи</h2>
            <p>Задача назначается должности или конкретному сотруднику.</p>
          </div>
          <div className="tasks-editor-toolbar__actions">
            <button className="tasks-secondary-button" type="button">Дублировать</button>
            <button className="tasks-danger-button" type="button">Удалить</button>
            <button className="tasks-save-button" type="button">Сохранить изменения</button>
          </div>
        </div>

        <div className="tasks-editor-card">
          <div className="tasks-active-row">
            <label className="tasks-switch">
              <span>Активна</span>
              <input type="checkbox" defaultChecked={selectedTask.active} />
            </label>
          </div>

          <label className="tasks-field tasks-field--full">
            <span>Название задачи</span>
            <input value={selectedTask.title} readOnly />
          </label>

          <label className="tasks-field tasks-field--full">
            <span>Описание задачи</span>
            <textarea value={selectedTask.description} readOnly />
          </label>

          <div className="tasks-form-grid">
            <label className="tasks-field">
              <span>Кому назначить</span>
              <select value={selectedTask.assignee}>
                <option>Официант</option>
                <option>Старший официант</option>
                <option>Бармен</option>
                <option>Старший бармен</option>
                <option>Повар</option>
                <option>Хостес</option>
                <option>Клининг</option>
                <option>Мария Иванова</option>
              </select>
            </label>

            <div className="tasks-assignment-card">
              <span>Тип назначения</span>
              <label>
                <input type="radio" checked={selectedTask.assignmentType === 'position'} readOnly />
                <strong>Должность</strong>
              </label>
              <label>
                <input type="radio" checked={selectedTask.assignmentType === 'employee'} readOnly />
                <strong>Конкретный сотрудник</strong>
              </label>
            </div>
          </div>

          <div className="tasks-form-grid tasks-form-grid--three">
            <label className="tasks-field">
              <span>Дата выполнения</span>
              <input value={selectedTask.dueDate} readOnly />
            </label>
            <label className="tasks-field">
              <span>Время выполнения</span>
              <input value={selectedTask.dueTime} readOnly />
            </label>
            <label className="tasks-photo-toggle">
              <span>Нужно фото выполнения</span>
              <input type="checkbox" defaultChecked={selectedTask.requiresPhoto} />
              <small>Сотрудник не сможет завершить задачу без фото</small>
            </label>
          </div>

          <div className="tasks-info-card">
            <AlertCircleIcon />
            <p>Задача будет отображаться у выбранных сотрудников и останется активной до наступления срока выполнения.</p>
          </div>

          <label className="tasks-field tasks-field--full">
            <span>Дополнительно</span>
            <textarea value={selectedTask.extraNote} readOnly />
          </label>
        </div>
      </section>
    </section>
  )
}
