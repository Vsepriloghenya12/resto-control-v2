import { useEffect, useMemo, useState } from 'react'
import { AlertCircleIcon, SearchIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'
import './TasksPage.css'

type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'overdue'
type AssignmentType = 'position' | 'employee'

type Task = {
  id: string
  title: string
  description?: string
  assignmentType: AssignmentType
  assignedPosition?: string
  assignedEmployeeId?: string
  assignee?: string
  status: TaskStatus
  dueDate: string
  dueTime: string
  requiresPhoto: boolean
  active: boolean
  extraNote?: string
}

const statusLabels: Record<TaskStatus, string> = { not_started: 'Не начата', in_progress: 'В работе', done: 'Выполнена', overdue: 'Просрочена' }
const statuses = ['Все', 'Не начата', 'В работе', 'Выполнена', 'Просрочена']
const assignmentOptions = ['Все', 'Должность', 'Сотрудник']
const photoOptions = ['Все', 'Нужно фото', 'Фото не нужно']
const positions = ['Официант', 'Старший официант', 'Бармен', 'Старший бармен', 'Повар', 'Су-шеф', 'Шеф-повар', 'Хостес', 'Администратор', 'Управляющий', 'Курьер', 'Мойщик', 'Уборщик', 'Клининг']

function assigneeName(task: Task) {
  return task.assignee || task.assignedPosition || task.assignedEmployeeId || 'Не назначено'
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`tasks-status tasks-status--${status}`}>{statusLabels[status]}</span>
}

function TaskListItem({ task, active, onSelect }: { task: Task; active: boolean; onSelect: () => void }) {
  return (
    <button className={active ? 'tasks-list-item tasks-list-item--active' : 'tasks-list-item'} type="button" onClick={onSelect}>
      <div className="tasks-list-item__top"><strong>{task.title}</strong><StatusBadge status={task.status} /></div>
      <p>{assigneeName(task)} · {task.dueDate} до {task.dueTime}</p>
      <div className="tasks-list-item__meta"><span>{task.requiresPhoto ? 'Нужно фото' : 'Фото не нужно'}</span><span>{task.assignmentType === 'position' ? 'Должность' : 'Сотрудник'}</span></div>
    </button>
  )
}

const emptyTask = (): Partial<Task> => ({
  title: '',
  description: '',
  assignmentType: 'position',
  assignedPosition: 'Официант',
  status: 'not_started',
  dueDate: new Date().toISOString().slice(0, 10),
  dueTime: '18:00',
  requiresPhoto: false,
  active: true,
  extraNote: '',
})

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<Partial<Task>>(emptyTask())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Все')
  const [assignment, setAssignment] = useState('Все')
  const [photo, setPhoto] = useState('Все')
  const [error, setError] = useState('')

  async function loadTasks() {
    try {
      const result = await api.list<Task>('tasks')
      setTasks(result.items)
      const first = result.items[0]
      if (first) { setSelectedId(first.id); setDraft(first) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить задачи')
    }
  }

  useEffect(() => { void loadTasks() }, [])

  const selectedTask = useMemo(() => tasks.find((item) => item.id === selectedId), [selectedId, tasks])

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesQuery = !normalized || task.title.toLowerCase().includes(normalized) || assigneeName(task).toLowerCase().includes(normalized)
      const matchesStatus = status === 'Все' || statusLabels[task.status] === status
      const matchesAssignment = assignment === 'Все' || (assignment === 'Должность' ? task.assignmentType === 'position' : task.assignmentType === 'employee')
      const matchesPhoto = photo === 'Все' || (photo === 'Нужно фото' ? task.requiresPhoto : !task.requiresPhoto)
      return matchesQuery && matchesStatus && matchesAssignment && matchesPhoto
    })
  }, [assignment, photo, query, status, tasks])

  function selectTask(task: Task) {
    setSelectedId(task.id)
    setDraft(task)
  }

  function createNewTask() {
    setSelectedId('')
    setDraft(emptyTask())
  }

  async function saveTask() {
    if (!draft.title?.trim()) { setError('Введите название задачи.'); return }
    const payload = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description || '',
      assignedPosition: draft.assignmentType === 'position' ? draft.assignedPosition : undefined,
      status: draft.status || 'not_started',
    }
    try {
      const saved = selectedId ? await api.update<Task>('tasks', selectedId, payload) : await api.create<Task>('tasks', payload)
      setTasks((items) => selectedId ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items])
      setSelectedId(saved.id)
      setDraft(saved)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить задачу')
    }
  }

  async function deleteTask() {
    if (!selectedId) return
    await api.remove('tasks', selectedId)
    const next = tasks.filter((item) => item.id !== selectedId)
    setTasks(next)
    setSelectedId(next[0]?.id || '')
    setDraft(next[0] || emptyTask())
  }

  async function completeTask() {
    if (!selectedId) return
    const updated = await api.update<Task>('tasks', selectedId, { status: 'done' })
    setTasks((items) => items.map((item) => item.id === updated.id ? updated : item))
    setDraft(updated)
  }

  return (
    <section className="tasks-page">
      <aside className="tasks-list-panel">
        <div className="tasks-list-panel__top">
          <button className="tasks-create-button" type="button" onClick={createNewTask}>+ Создать задачу</button>
          <label className="tasks-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию..." /></label>
          <div className="tasks-filters-row">
            <label className="tasks-filter"><span>Статус:</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="tasks-filter"><span>Назначено:</span><select value={assignment} onChange={(event) => setAssignment(event.target.value)}>{assignmentOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="tasks-filter"><span>Фото:</span><select value={photo} onChange={(event) => setPhoto(event.target.value)}>{photoOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="tasks-reset-button" type="button" onClick={() => { setQuery(''); setStatus('Все'); setAssignment('Все'); setPhoto('Все') }}>Сбросить</button>
          </div>
        </div>
        <div className="tasks-list">{filteredTasks.map((task) => <TaskListItem task={task} active={task.id === selectedTask?.id} onSelect={() => selectTask(task)} key={task.id} />)}</div>
        <div className="tasks-list-panel__footer">Всего задач: {tasks.length}</div>
      </aside>

      <section className="tasks-editor">
        <div className="tasks-editor-toolbar">
          <div><h2>{selectedId ? 'Редактирование задачи' : 'Создание задачи'}</h2></div>
          <div className="tasks-editor-toolbar__actions"><button className="tasks-secondary-button" type="button" onClick={completeTask}>Выполнена</button><button className="tasks-danger-button" type="button" onClick={deleteTask}>Удалить</button><button className="tasks-save-button" type="button" onClick={saveTask}>Сохранить</button></div>
        </div>
        {error ? <div className="tasks-info-card"><AlertCircleIcon /><p>{error}</p></div> : null}
        <div className="tasks-editor-card">
          <div className="tasks-active-row"><label className="tasks-switch"><span>Активна</span><input type="checkbox" checked={Boolean(draft.active)} onChange={(e) => setDraft((v) => ({ ...v, active: e.target.checked }))} /></label></div>
          <label className="tasks-field tasks-field--full"><span>Название задачи</span><input value={draft.title || ''} onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))} /></label>
          <label className="tasks-field tasks-field--full"><span>Описание задачи</span><textarea value={draft.description || ''} onChange={(e) => setDraft((v) => ({ ...v, description: e.target.value }))} /></label>
          <div className="tasks-form-grid">
            <label className="tasks-field"><span>Кому назначить</span><select value={draft.assignedPosition || 'Официант'} onChange={(e) => setDraft((v) => ({ ...v, assignedPosition: e.target.value }))}>{positions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="tasks-assignment-card"><span>Тип назначения</span><label><input type="radio" checked={draft.assignmentType === 'position'} onChange={() => setDraft((v) => ({ ...v, assignmentType: 'position' }))} /><strong>Должность</strong></label><label><input type="radio" checked={draft.assignmentType === 'employee'} onChange={() => setDraft((v) => ({ ...v, assignmentType: 'employee' }))} /><strong>Конкретный сотрудник</strong></label></div>
          </div>
          <div className="tasks-form-grid tasks-form-grid--three">
            <label className="tasks-field"><span>Дата выполнения</span><input type="date" value={draft.dueDate || ''} onChange={(e) => setDraft((v) => ({ ...v, dueDate: e.target.value }))} /></label>
            <label className="tasks-field"><span>Время выполнения</span><input type="time" value={draft.dueTime || ''} onChange={(e) => setDraft((v) => ({ ...v, dueTime: e.target.value }))} /></label>
            <label className="tasks-photo-toggle"><span>Нужно фото выполнения</span><input type="checkbox" checked={Boolean(draft.requiresPhoto)} onChange={(e) => setDraft((v) => ({ ...v, requiresPhoto: e.target.checked }))} /></label>
          </div>
          <label className="tasks-field tasks-field--full"><span>Дополнительно</span><textarea value={draft.extraNote || ''} onChange={(e) => setDraft((v) => ({ ...v, extraNote: e.target.value }))} /></label>
        </div>
      </section>
    </section>
  )
}
