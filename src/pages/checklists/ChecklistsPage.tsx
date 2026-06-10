import { useMemo, useState } from 'react'
import {
  BookIcon,
  CalendarIcon,
  ChecklistIcon,
  ClockIcon,
  SearchIcon,
} from '../../shared/ui/Icon'
import './ChecklistsPage.css'

type ChecklistType = 'opening' | 'closing' | 'custom'

type ChecklistTemplate = {
  id: string
  title: string
  type: ChecklistType
  position: string
  startTime: string
  endTime: string
  active: boolean
  itemsCount: number
  photoItemsCount: number
}

type ChecklistItem = {
  id: string
  title: string
  required: boolean
  requiresPhoto: boolean
  example: string
  hasExamplePhoto: boolean
}

const checklists: ChecklistTemplate[] = [
  {
    id: 'bar-opening',
    title: 'Открытие бара',
    type: 'opening',
    position: 'Бармен',
    startTime: '09:00',
    endTime: '11:00',
    active: true,
    itemsCount: 12,
    photoItemsCount: 3,
  },
  {
    id: 'kitchen-closing',
    title: 'Закрытие кухни',
    type: 'closing',
    position: 'Повар',
    startTime: '22:00',
    endTime: '23:30',
    active: true,
    itemsCount: 18,
    photoItemsCount: 5,
  },
  {
    id: 'showcase-check',
    title: 'Проверка витрины',
    type: 'custom',
    position: 'Хостес',
    startTime: '16:00',
    endTime: '17:00',
    active: true,
    itemsCount: 6,
    photoItemsCount: 2,
  },
  {
    id: 'hall-cleaning',
    title: 'Подготовка зала',
    type: 'custom',
    position: 'Официант',
    startTime: '14:00',
    endTime: '15:00',
    active: false,
    itemsCount: 10,
    photoItemsCount: 0,
  },
  {
    id: 'storage-check',
    title: 'Проверка склада',
    type: 'custom',
    position: 'Клининг',
    startTime: '08:00',
    endTime: '09:00',
    active: true,
    itemsCount: 9,
    photoItemsCount: 1,
  },
]

const checklistItems: ChecklistItem[] = [
  {
    id: 'item-1',
    title: 'Проверить чистоту барной стойки',
    required: true,
    requiresPhoto: false,
    example: 'Барная стойка должна быть сухой, без посуды, пятен и лишних предметов.',
    hasExamplePhoto: true,
  },
  {
    id: 'item-2',
    title: 'Проверить выкладку алкоголя на полках',
    required: true,
    requiresPhoto: true,
    example: 'Бутылки стоят ровно, все этикетки повернуты к гостю, ценники на месте.',
    hasExamplePhoto: true,
  },
  {
    id: 'item-3',
    title: 'Проверить наличие льда и его чистоту',
    required: true,
    requiresPhoto: false,
    example: 'Лёд в бункере, совок и станция чистые, без посторонних предметов.',
    hasExamplePhoto: false,
  },
]

const checklistTypes: Record<ChecklistType, string> = {
  opening: 'Открытие',
  closing: 'Закрытие',
  custom: 'Произвольный',
}

const positions = ['Бармен', 'Старший бармен', 'Официант', 'Старший официант', 'Повар', 'Су-шеф', 'Шеф-повар', 'Хостес', 'Администратор', 'Клининг']

function ChecklistCard({ checklist, active, onSelect }: { checklist: ChecklistTemplate; active: boolean; onSelect: () => void }) {
  return (
    <button className={active ? 'checklists-list-card checklists-list-card--active' : 'checklists-list-card'} type="button" onClick={onSelect}>
      <div className="checklists-list-card__top">
        <strong>{checklist.title}</strong>
        <span className={checklist.active ? 'checklists-status checklists-status--active' : 'checklists-status checklists-status--inactive'}>
          {checklist.active ? 'Активен' : 'Выключен'}
        </span>
      </div>
      <p>{checklistTypes[checklist.type]} · {checklist.position}</p>
      <div className="checklists-list-card__meta">
        <span><ClockIcon /> {checklist.startTime}–{checklist.endTime}</span>
        <span><ChecklistIcon /> {checklist.itemsCount} пунктов</span>
        <span><BookIcon /> {checklist.photoItemsCount} фото</span>
      </div>
    </button>
  )
}

function ChecklistItemEditor({ item, index }: { item: ChecklistItem; index: number }) {
  return (
    <article className="checklists-item-editor">
      <div className="checklists-item-editor__handle" aria-hidden="true">⋮⋮</div>
      <div className="checklists-item-editor__number">{index + 1}</div>

      <div className="checklists-item-editor__main">
        <label className="checklists-field checklists-field--item-title">
          <span>Пункт чек-листа</span>
          <input value={item.title} readOnly />
        </label>

        <div className="checklists-item-editor__toggles">
          <label className="checklists-field">
            <span>Обязательный</span>
            <select value={item.required ? 'yes' : 'no'}>
              <option value="yes">Да</option>
              <option value="no">Нет</option>
            </select>
          </label>
          <label className="checklists-field">
            <span>Фото выполнения</span>
            <select value={item.requiresPhoto ? 'yes' : 'no'}>
              <option value="yes">Да</option>
              <option value="no">Нет</option>
            </select>
          </label>
        </div>

        <div className="checklists-example-row">
          <label className="checklists-field checklists-field--example">
            <span>Пример выполнения, если нужен</span>
            <textarea value={item.example} readOnly />
          </label>

          <div className="checklists-example-photo">
            <span>Фото примера, если нужно</span>
            <div className={item.hasExamplePhoto ? 'checklists-example-photo__box checklists-example-photo__box--filled' : 'checklists-example-photo__box'}>
              {item.hasExamplePhoto ? <span>Фото примера</span> : <button type="button">+ Добавить фото</button>}
            </div>
          </div>
        </div>
      </div>

      <button className="checklists-item-editor__remove" type="button" aria-label="Удалить пункт">×</button>
    </article>
  )
}

export function ChecklistsPage() {
  const [selectedId, setSelectedId] = useState(checklists[0].id)
  const [query, setQuery] = useState('')

  const selectedChecklist = useMemo(() => checklists.find((item) => item.id === selectedId) ?? checklists[0], [selectedId])
  const filteredChecklists = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return checklists
    return checklists.filter((item) => item.title.toLowerCase().includes(normalized) || item.position.toLowerCase().includes(normalized))
  }, [query])

  return (
    <section className="checklists-page">
      <aside className="checklists-list-panel">
        <div className="checklists-list-panel__top">
          <button className="checklists-create-button" type="button">+ Создать чек-лист</button>
          <label className="checklists-list-search">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти чек-лист..." />
          </label>
        </div>

        <div className="checklists-list">
          {filteredChecklists.map((checklist) => (
            <ChecklistCard
              checklist={checklist}
              active={checklist.id === selectedChecklist.id}
              onSelect={() => setSelectedId(checklist.id)}
              key={checklist.id}
            />
          ))}
        </div>

        <div className="checklists-list-panel__footer">Всего чек-листов: {checklists.length}</div>
      </aside>

      <section className="checklists-editor">
        <div className="checklists-editor-toolbar">
          <div>
            <h2>Основные настройки</h2>
            <p>Шаблон, который сотрудники будут выполнять в заданный период.</p>
          </div>
          <div className="checklists-editor-toolbar__actions">
            <button className="checklists-secondary-button" type="button">Дублировать</button>
            <button className="checklists-danger-button" type="button">Удалить</button>
            <button className="checklists-save-button" type="button">Сохранить изменения</button>
          </div>
        </div>

        <section className="checklists-settings-card">
          <div className="checklists-settings-grid">
            <label className="checklists-field">
              <span>Название чек-листа</span>
              <input value={selectedChecklist.title} readOnly />
            </label>
            <label className="checklists-field">
              <span>Тип чек-листа</span>
              <select value={selectedChecklist.type}>
                <option value="opening">Открытие</option>
                <option value="closing">Закрытие</option>
                <option value="custom">Произвольный</option>
              </select>
            </label>
            <label className="checklists-field">
              <span>Должность</span>
              <select value={selectedChecklist.position}>
                {positions.map((position) => <option key={position}>{position}</option>)}
              </select>
            </label>
          </div>

          <div className="checklists-period-row">
            <label className="checklists-field checklists-field--time">
              <span>Время начала</span>
              <input value={selectedChecklist.startTime} readOnly />
            </label>
            <span className="checklists-period-row__dash">—</span>
            <label className="checklists-field checklists-field--time">
              <span>Время окончания</span>
              <input value={selectedChecklist.endTime} readOnly />
            </label>
            <div className="checklists-active-control">
              <span>Активен</span>
              <button className={selectedChecklist.active ? 'checklists-switch checklists-switch--on' : 'checklists-switch'} type="button" aria-label="Активность чек-листа">
                <span />
              </button>
            </div>
            <div className="checklists-hint">
              <CalendarIcon />
              <p>Чек-лист должен быть выполнен в указанный период. Сотрудник увидит напоминание перед началом.</p>
            </div>
          </div>
        </section>

        <section className="checklists-items-section">
          <div className="checklists-items-section__header">
            <div>
              <h2>Пункты чек-листа</h2>
              <p>Для каждого пункта можно добавить пример и фото образца.</p>
            </div>
            <button className="checklists-add-item-button" type="button">+ Добавить пункт</button>
          </div>

          <div className="checklists-items-list">
            {checklistItems.map((item, index) => <ChecklistItemEditor item={item} index={index} key={item.id} />)}
          </div>

          <p className="checklists-order-note">Пункты можно будет перетаскивать, чтобы менять порядок выполнения.</p>
        </section>
      </section>
    </section>
  )
}
