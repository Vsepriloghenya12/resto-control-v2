import { useEffect, useMemo, useState } from 'react'
import { AlertCircleIcon, CalendarIcon, SearchIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'
import './ChecklistsPage.css'

type ChecklistType = 'opening' | 'closing' | 'custom'

type ChecklistItem = {
  id: string
  title: string
  required: boolean
  requiresCompletionPhoto?: boolean
  requiresPhoto?: boolean
  exampleText?: string
  example?: string
  hasExamplePhoto?: boolean
  order?: number
}

type ChecklistTemplate = {
  id: string
  title: string
  type: ChecklistType
  position: string
  startTime: string
  endTime: string
  active: boolean
  items?: ChecklistItem[]
}

const positions = ['Официант', 'Старший официант', 'Бармен', 'Старший бармен', 'Повар', 'Су-шеф', 'Шеф-повар', 'Хостес', 'Администратор', 'Управляющий', 'Курьер', 'Мойщик', 'Уборщик', 'Клининг']
const typeLabels: Record<ChecklistType, string> = { opening: 'Открытие', closing: 'Закрытие', custom: 'Произвольный' }

function itemsCount(checklist: ChecklistTemplate) { return checklist.items?.length || 0 }
function photoItemsCount(checklist: ChecklistTemplate) { return checklist.items?.filter((item) => item.requiresCompletionPhoto || item.requiresPhoto).length || 0 }

function ChecklistCard({ checklist, active, onSelect }: { checklist: ChecklistTemplate; active: boolean; onSelect: () => void }) {
  return (
    <button className={active ? 'checklists-card checklists-card--active' : 'checklists-card'} type="button" onClick={onSelect}>
      <div className="checklists-card__top"><strong>{checklist.title}</strong><span className={checklist.active ? 'checklists-status checklists-status--active' : 'checklists-status checklists-status--inactive'}>{checklist.active ? 'Активен' : 'Выключен'}</span></div>
      <p>{typeLabels[checklist.type]} · {checklist.position}</p>
      <div className="checklists-card__meta"><span>{checklist.startTime} — {checklist.endTime}</span><span>{itemsCount(checklist)} пунктов</span><span>{photoItemsCount(checklist)} фото</span></div>
    </button>
  )
}

const emptyChecklist = (): ChecklistTemplate => ({ id: '', title: '', type: 'opening', position: 'Официант', startTime: '09:00', endTime: '11:00', active: true, items: [] })

export function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<ChecklistTemplate>(emptyChecklist())
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  async function loadChecklists() {
    try {
      const result = await api.list<ChecklistTemplate>('checklists')
      setChecklists(result.items)
      if (result.items[0]) { setSelectedId(result.items[0].id); setDraft(normalizeChecklist(result.items[0])) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось загрузить чек-листы') }
  }

  useEffect(() => { void loadChecklists() }, [])

  function normalizeChecklist(checklist: ChecklistTemplate): ChecklistTemplate {
    return { ...emptyChecklist(), ...checklist, items: checklist.items || [] }
  }

  const filteredChecklists = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return checklists
    return checklists.filter((item) => item.title.toLowerCase().includes(normalized) || item.position.toLowerCase().includes(normalized))
  }, [checklists, query])

  function selectChecklist(checklist: ChecklistTemplate) { setSelectedId(checklist.id); setDraft(normalizeChecklist(checklist)) }
  function createChecklist() { setSelectedId(''); setDraft(emptyChecklist()) }

  async function saveChecklist() {
    if (!draft.title.trim()) { setError('Введите название чек-листа.'); return }
    try {
      const payload = { ...draft, items: draft.items || [] }
      const saved = selectedId ? await api.update<ChecklistTemplate>('checklists', selectedId, payload) : await api.create<ChecklistTemplate>('checklists', payload)
      const normalized = normalizeChecklist(saved)
      setChecklists((items) => selectedId ? items.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...items])
      setSelectedId(normalized.id)
      setDraft(normalized)
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить чек-лист') }
  }

  async function deleteChecklist() {
    if (!selectedId) return
    await api.remove('checklists', selectedId)
    const next = checklists.filter((item) => item.id !== selectedId)
    setChecklists(next)
    setSelectedId(next[0]?.id || '')
    setDraft(next[0] ? normalizeChecklist(next[0]) : emptyChecklist())
  }

  function updateItem(index: number, patch: Partial<ChecklistItem>) {
    setDraft((value) => ({ ...value, items: (value.items || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }

  function addItem() {
    setDraft((value) => ({ ...value, items: [...(value.items || []), { id: `local_${Date.now()}`, title: '', required: true, requiresCompletionPhoto: false, exampleText: '', order: (value.items || []).length + 1 }] }))
  }

  function removeItem(index: number) {
    setDraft((value) => ({ ...value, items: (value.items || []).filter((_, itemIndex) => itemIndex !== index) }))
  }

  async function toggleActive() {
    const nextActive = !draft.active
    const nextDraft = { ...draft, active: nextActive }
    setDraft(nextDraft)
    if (!selectedId) return
    try {
      const saved = await api.update<ChecklistTemplate>('checklists', selectedId, { ...nextDraft, items: nextDraft.items || [] })
      const normalized = normalizeChecklist(saved)
      setChecklists((items) => items.map((item) => item.id === normalized.id ? normalized : item))
      setDraft(normalized)
      setError('')
    } catch (err) {
      setDraft((value) => ({ ...value, active: !nextActive }))
      setError(err instanceof Error ? err.message : 'Не удалось переключить статус чек-листа')
    }
  }


  return (
    <section className="checklists-page">
      <aside className="checklists-list-panel">
        <div className="checklists-list-panel__top">
          <button className="checklists-create-button" type="button" onClick={createChecklist}>+ Создать чек-лист</button>
          <label className="checklists-list-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти чек-лист..." /></label>
        </div>
        <div className="checklists-list">{filteredChecklists.map((checklist) => <ChecklistCard checklist={normalizeChecklist(checklist)} active={checklist.id === selectedId} onSelect={() => selectChecklist(checklist)} key={checklist.id} />)}</div>
        <div className="checklists-list-panel__footer">Всего чек-листов: {checklists.length}</div>
      </aside>

      <section className="checklists-editor">
        <div className="checklists-editor-toolbar">
          <div><h2>Основные настройки</h2><p>Шаблон сохраняется в backend и доступен сотрудникам в заданный период.</p></div>
          <div className="checklists-editor-toolbar__actions"><button className="checklists-secondary-button" type="button" onClick={createChecklist}>Новый</button><button className="checklists-danger-button" type="button" onClick={deleteChecklist}>Удалить</button><button className="checklists-save-button" type="button" onClick={saveChecklist}>Сохранить изменения</button></div>
        </div>
        {error ? <div className="checklists-hint"><AlertCircleIcon /><p>{error}</p></div> : null}
        <section className="checklists-settings-card">
          <div className="checklists-settings-grid">
            <label className="checklists-field"><span>Название чек-листа</span><input value={draft.title} onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))} /></label>
            <label className="checklists-field"><span>Тип чек-листа</span><select value={draft.type} onChange={(e) => setDraft((v) => ({ ...v, type: e.target.value as ChecklistType }))}><option value="opening">Открытие</option><option value="closing">Закрытие</option><option value="custom">Произвольный</option></select></label>
            <label className="checklists-field"><span>Должность</span><select value={draft.position} onChange={(e) => setDraft((v) => ({ ...v, position: e.target.value }))}>{positions.map((position) => <option key={position}>{position}</option>)}</select></label>
          </div>
          <div className="checklists-period-row">
            <label className="checklists-field checklists-field--time"><span>Время начала</span><input type="time" value={draft.startTime} onChange={(e) => setDraft((v) => ({ ...v, startTime: e.target.value }))} /></label>
            <span className="checklists-period-row__dash">—</span>
            <label className="checklists-field checklists-field--time"><span>Время окончания</span><input type="time" value={draft.endTime} onChange={(e) => setDraft((v) => ({ ...v, endTime: e.target.value }))} /></label>
            <div className="checklists-active-control"><span>Активен</span><button className={draft.active ? 'checklists-switch checklists-switch--on' : 'checklists-switch'} type="button" onClick={toggleActive}><span /></button></div>
            <div className="checklists-hint"><CalendarIcon /><p>Сотрудник увидит напоминание перед началом.</p></div>
          </div>
        </section>

        <section className="checklists-items-section">
          <div className="checklists-items-section__header"><div><h2>Пункты чек-листа</h2><p>Фото выполнения хранится внутри конкретного пункта.</p></div><button className="checklists-add-item-button" type="button" onClick={addItem}>+ Добавить пункт</button></div>
          <div className="checklists-items-list">
            {(draft.items || []).map((item, index) => (
              <article className="checklists-item-editor" key={item.id || index}>
                <span className="checklists-item-editor__number">{index + 1}</span>
                <div className="checklists-item-editor__main">
                  <input value={item.title} onChange={(e) => updateItem(index, { title: e.target.value })} placeholder="Текст пункта" />
                  <textarea value={item.exampleText || item.example || ''} onChange={(e) => updateItem(index, { exampleText: e.target.value })} placeholder="Пример выполнения" />
                  <div className="checklists-item-editor__toggles"><label><input type="checkbox" checked={item.required} onChange={(e) => updateItem(index, { required: e.target.checked })} />Обязательный</label><label><input type="checkbox" checked={Boolean(item.requiresCompletionPhoto || item.requiresPhoto)} onChange={(e) => updateItem(index, { requiresCompletionPhoto: e.target.checked })} />Нужно фото</label></div>
                </div>
                <button className="checklists-danger-button" type="button" onClick={() => removeItem(index)}>Удалить</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  )
}
