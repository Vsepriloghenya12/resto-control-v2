import { useEffect, useMemo, useState } from 'react'
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
const statuses: TaskStatus[] = ['not_started', 'in_progress', 'done', 'overdue']
const positions = ['Официант', 'Старший официант', 'Бармен', 'Старший бармен', 'Повар', 'Су-шеф', 'Шеф-повар', 'Хостес', 'Администратор', 'Управляющий', 'Курьер', 'Мойщик', 'Уборщик', 'Клининг']

function assigneeName(task: Task) {
  return task.assignee || task.assignedPosition || task.assignedEmployeeId || 'Не назначено'
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`tasks-status tasks-status--${status}`}>{statusLabels[status]}</span>
}

const emptyDraft = (): Partial<Task> => ({
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
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Task>>(emptyDraft())
  const [saving, setSaving] = useState(false)

  async function loadTasks() {
    const result = await api.list<Task>('tasks')
    setTasks(result.items)
  }

  useEffect(() => { void loadTasks() }, [])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => statusFilter === 'all' || task.status === statusFilter)
  }, [statusFilter, tasks])

  function openCreate() {
    setEditingId(null)
    setDraft(emptyDraft())
    setModalOpen(true)
  }

  function openEdit(task: Task) {
    setEditingId(task.id)
    setDraft({ ...task })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  function showNotice(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  async function saveTask() {
    if (!draft.title?.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...draft,
        title: draft.title.trim(),
        description: draft.description || '',
        assignedPosition: draft.assignmentType === 'position' ? draft.assignedPosition : undefined,
        status: draft.status || 'not_started',
      }
      const saved = editingId
        ? await api.update<Task>('tasks', editingId, payload)
        : await api.create<Task>('tasks', payload)
      setTasks((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items])
      closeModal()
      showNotice(editingId ? 'Задача обновлена.' : 'Задача создана.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTask() {
    if (!editingId) return
    if (!window.confirm('Удалить задачу?')) return
    await api.remove('tasks', editingId)
    setTasks((items) => items.filter((item) => item.id !== editingId))
    closeModal()
    showNotice('Задача удалена.')
  }

  async function setTaskStatus(id: string, status: TaskStatus) {
    const updated = await api.update<Task>('tasks', id, { status })
    setTasks((items) => items.map((item) => item.id === updated.id ? updated : item))
    showNotice(`Статус: ${statusLabels[status]}`)
  }

  return (
    <section className="tasks-page">
      {notice ? <div className="tasks-notice">{notice}</div> : null}

      <div className="tasks-toolbar">
        <button className="tasks-create-btn" type="button" onClick={openCreate}>+ Создать задачу</button>
        <div className="tasks-status-tabs">
          <button type="button" className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>Все <span>{tasks.length}</span></button>
          {statuses.map((s) => (
            <button key={s} type="button" className={statusFilter === s ? 'active' : ''} onClick={() => setStatusFilter(s)}>
              {statusLabels[s]} <span>{tasks.filter((t) => t.status === s).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tasks-list">
        {filteredTasks.length === 0 ? (
          <div className="tasks-empty">Задач нет. Нажмите «+ Создать задачу».</div>
        ) : filteredTasks.map((task) => (
          <div key={task.id} className="tasks-row" onClick={() => openEdit(task)}>
            <div className="tasks-row__main">
              <div className="tasks-row__title">{task.title}</div>
              {task.description ? <div className="tasks-row__desc">{task.description}</div> : null}
            </div>
            <div className="tasks-row__meta">
              <span className="tasks-row__assignee">{assigneeName(task)}</span>
              <span className="tasks-row__due">{task.dueDate} · {task.dueTime}</span>
              {task.requiresPhoto ? <span className="tasks-row__photo-badge">Фото</span> : null}
            </div>
            <StatusBadge status={task.status} />
            <div className="tasks-row__actions" onClick={(e) => e.stopPropagation()}>
              {task.status !== 'done' ? (
                <button type="button" className="tasks-row__done-btn" onClick={() => void setTaskStatus(task.id, 'done')}>✓</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <div className="tasks-modal-backdrop" onMouseDown={closeModal}>
          <div className="tasks-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="tasks-modal__header">
              <h3>{editingId ? 'Редактирование задачи' : 'Новая задача'}</h3>
              <button type="button" className="tasks-modal__close" onClick={closeModal}>✕</button>
            </div>
            <div className="tasks-modal__body">
              <label className="tasks-modal__field tasks-modal__field--full">
                <span>Название задачи *</span>
                <input type="text" value={draft.title || ''} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Что нужно сделать?" />
              </label>
              <label className="tasks-modal__field tasks-modal__field--full">
                <span>Описание</span>
                <textarea value={draft.description || ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Подробности задачи..." />
              </label>
              <div className="tasks-modal__row">
                <label className="tasks-modal__field">
                  <span>Дата выполнения</span>
                  <input type="date" value={draft.dueDate || ''} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
                </label>
                <label className="tasks-modal__field">
                  <span>Время выполнения</span>
                  <input type="time" value={draft.dueTime || ''} onChange={(e) => setDraft((d) => ({ ...d, dueTime: e.target.value }))} />
                </label>
                <label className="tasks-modal__field">
                  <span>Статус</span>
                  <select value={draft.status || 'not_started'} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as TaskStatus }))}>
                    {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
                  </select>
                </label>
              </div>
              <div className="tasks-modal__row">
                <div className="tasks-modal__field">
                  <span>Тип назначения</span>
                  <div className="tasks-modal__radio-group">
                    <label><input type="radio" checked={draft.assignmentType === 'position'} onChange={() => setDraft((d) => ({ ...d, assignmentType: 'position' }))} /> Должность</label>
                    <label><input type="radio" checked={draft.assignmentType === 'employee'} onChange={() => setDraft((d) => ({ ...d, assignmentType: 'employee' }))} /> Сотрудник</label>
                  </div>
                </div>
                {draft.assignmentType === 'position' ? (
                  <label className="tasks-modal__field">
                    <span>Должность</span>
                    <select value={draft.assignedPosition || 'Официант'} onChange={(e) => setDraft((d) => ({ ...d, assignedPosition: e.target.value }))}>
                      {positions.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="tasks-modal__field">
                    <span>ФИО сотрудника</span>
                    <input type="text" value={draft.assignee || ''} onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))} placeholder="Иванов Иван" />
                  </label>
                )}
              </div>
              <label className="tasks-modal__field tasks-modal__field--full">
                <span>Дополнительно</span>
                <input type="text" value={draft.extraNote || ''} onChange={(e) => setDraft((d) => ({ ...d, extraNote: e.target.value }))} placeholder="Примечание" />
              </label>
              <div className="tasks-modal__toggles">
                <label className="tasks-modal__toggle">
                  <input type="checkbox" checked={Boolean(draft.requiresPhoto)} onChange={(e) => setDraft((d) => ({ ...d, requiresPhoto: e.target.checked }))} />
                  <span>Требуется фото выполнения</span>
                </label>
                <label className="tasks-modal__toggle">
                  <input type="checkbox" checked={Boolean(draft.active)} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
                  <span>Активна</span>
                </label>
              </div>
              <div className="tasks-modal__footer">
                {editingId ? <button type="button" className="tasks-modal__delete-btn" onClick={() => void deleteTask()}>Удалить</button> : <span />}
                <button type="button" className="tasks-modal__save-btn" disabled={!draft.title?.trim() || saving} onClick={() => void saveTask()}>
                  {saving ? 'Сохранение...' : editingId ? 'Сохранить' : 'Создать задачу'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
