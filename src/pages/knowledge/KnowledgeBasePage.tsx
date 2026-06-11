import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../../shared/api/client'
import {
  BookIcon,
  CalendarIcon,
  ChevronRightIcon,
  SearchIcon,
  TeamIcon,
  UserIcon,
} from '../../shared/ui/Icon'
import './KnowledgeBasePage.css'

type KnowledgeSectionId =
  | 'company_intro'
  | 'hierarchy'
  | 'documents'
  | 'guests_events'
  | 'regular_guests'
  | 'team_wall'

type MaterialStatus = 'published' | 'draft' | 'hidden' | 'planned'
type MaterialType = 'photo' | 'video' | 'scheme' | 'pdf' | 'instruction' | 'event' | 'guest' | 'team_post'

type KnowledgeMaterial = {
  id: string
  section: KnowledgeSectionId
  title: string
  type: MaterialType
  status: MaterialStatus
  description?: string
  author?: string
  updatedAt?: string
  fileName?: string
  eventDate?: string
  eventTime?: string
  guestPhone?: string
  guestPreferences?: string
  guestRestrictions?: string
  guestComment?: string
}

type Employee = {
  id: string
  name: string
  login?: string
  position: string
  status?: string
  shiftStatus?: string
  responsibilities?: string
  responsibilityComment?: string
  reportsTo?: string
}

type EmployeeDraft = {
  responsibilities: string
  responsibilityComment: string
  reportsTo: string
}

type KnowledgeSection = {
  id: KnowledgeSectionId
  title: string
  description: string
  icon: ReactNode
  parent?: string
}

const sections: KnowledgeSection[] = [
  { id: 'company_intro', title: 'Знакомство с компанией', description: 'Фото, видео и материалы адаптации', icon: <UserIcon /> },
  { id: 'hierarchy', title: 'Иерархия и ответственность', description: 'Команда, должности и зоны ответственности', icon: <TeamIcon /> },
  { id: 'documents', title: 'Документы компании', description: 'Обучающие PDF, инструкции и правила', icon: <BookIcon /> },
  { id: 'guests_events', title: 'Мы и гости', description: 'События с гостями: были, есть и будут', icon: <CalendarIcon />, parent: 'Корпоративная жизнь' },
  { id: 'regular_guests', title: 'Постоянные гости', description: 'Предпочтения, ограничения и заметки', icon: <UserIcon />, parent: 'Корпоративная жизнь' },
  { id: 'team_wall', title: 'Мы — команда', description: 'Корпоративы, дни рождения и внутренняя стена', icon: <TeamIcon />, parent: 'Корпоративная жизнь' },
]

const typeLabels: Record<MaterialType, string> = {
  photo: 'Фото',
  video: 'Видео',
  scheme: 'Схема',
  pdf: 'PDF',
  instruction: 'Инструкция',
  event: 'Событие',
  guest: 'Гость',
  team_post: 'Пост команды',
}

const statusLabels: Record<MaterialStatus, string> = {
  published: 'Опубликовано',
  draft: 'Черновик',
  hidden: 'Скрыто',
  planned: 'Запланировано',
}

function defaultTypeForSection(section: KnowledgeSectionId): MaterialType {
  if (section === 'hierarchy') return 'scheme'
  if (section === 'documents') return 'pdf'
  if (section === 'guests_events') return 'event'
  if (section === 'regular_guests') return 'guest'
  if (section === 'team_wall') return 'team_post'
  return 'video'
}

function defaultTitleForSection(section: KnowledgeSectionId) {
  if (section === 'company_intro') return 'Новый материал адаптации'
  if (section === 'hierarchy') return 'Новая схема ответственности'
  if (section === 'documents') return 'Новый обучающий документ'
  if (section === 'guests_events') return 'Новое событие'
  if (section === 'regular_guests') return 'Новый постоянный гость'
  return 'Новая запись команды'
}

function StatusBadge({ status }: { status: MaterialStatus }) {
  return <span className={`knowledge-status knowledge-status--${status}`}>{statusLabels[status]}</span>
}

function TypeBadge({ type }: { type: MaterialType }) {
  return <span className="knowledge-type">{typeLabels[type] || type}</span>
}

const leaderPositions = ['Владелец', 'Управляющий', 'Администратор', 'Шеф-повар', 'Су-шеф', 'Старший официант', 'Старший бармен']
const hierarchyOrder = ['Руководители', 'Зал', 'Бар', 'Кухня', 'Клининг', 'Доставка', 'Остальные']

function hierarchyGroup(position: string) {
  if (leaderPositions.includes(position)) return 'Руководители'
  const value = position.toLowerCase()
  if (value.includes('бар')) return 'Бар'
  if (value.includes('повар') || value.includes('шеф')) return 'Кухня'
  if (value.includes('клининг') || value.includes('убор') || value.includes('мойщик')) return 'Клининг'
  if (value.includes('курьер')) return 'Доставка'
  if (value.includes('официант') || value.includes('хостес')) return 'Зал'
  return 'Остальные'
}

function defaultResponsibilities(position: string) {
  if (position === 'Управляющий') return '* Контроль смены\n* Команда и дисциплина\n* График и задачи\nРешает спорные ситуации с гостями'
  if (position === 'Администратор') return '* План зала\n* Брони и посадка гостей\n* Открытие и закрытие смены\nПередаёт задачи залу'
  if (position === 'Старший официант') return '* Официанты на смене\n* Сервис в зале\n* Чек-листы зала\nПомогает администратору'
  if (position === 'Старший бармен') return '* Бар\n* Заготовки бара\n* Стоп-лист напитков\nКонтролирует барменов'
  if (position === 'Шеф-повар') return '* Кухня\n* Качество блюд\n* Стоп-лист кухни\nКонтролирует поваров'
  if (position === 'Су-шеф') return '* Заготовки кухни\n* Маркировка\n* Инвентаризация кухни\nПомогает шеф-повару'
  if (position === 'Бармен') return '* Барная станция\n* Напитки\n* Инвентаризация бара\nСледит за чистотой бара'
  if (position === 'Повар') return '* Своя станция\n* Заготовки\n* Маркировка\nСоблюдает ТТК'
  if (position === 'Официант') return '* Свои столы\n* Сервис гостей\n* Передача заказов\nСледит за чистотой зоны'
  if (position === 'Хостес') return '* Встреча гостей\n* Брони\n* Очередь и посадка\nПередаёт гостей официантам'
  if (position === 'Клининг' || position === 'Уборщик' || position === 'Мойщик') return '* Чистота зон\n* Санитарные точки\n* Расходники\nФиксирует проблемы через тех. заявку'
  return '* Рабочая зона\n* Задачи по должности\nКомментарий управляющего'
}

function formatResponsibilities(text?: string, position?: string) {
  return String(text || defaultResponsibilities(position || '')).split('\n').map((line) => line.trim()).filter(Boolean)
}

export function KnowledgeBasePage() {
  const [items, setItems] = useState<KnowledgeMaterial[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<KnowledgeSectionId>('company_intro')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<KnowledgeMaterial | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>({ responsibilities: '', responsibilityComment: '', reportsTo: '' })
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  async function loadMaterials(nextSelectedId?: string) {
    setIsLoading(true)
    const response = await api.list<KnowledgeMaterial>('knowledge')
    const normalized = response.items.map((item) => ({
      ...item,
      section: (item.section || 'company_intro') as KnowledgeSectionId,
      type: (item.type || defaultTypeForSection((item.section || 'company_intro') as KnowledgeSectionId)) as MaterialType,
      status: (item.status || 'draft') as MaterialStatus,
      description: item.description || '',
    }))
    setItems(normalized)
    const selectedId = nextSelectedId || selectedMaterialId
    const selected = normalized.find((item) => item.id === selectedId) || normalized.find((item) => item.section === selectedSectionId) || normalized[0]
    if (selected) {
      setSelectedSectionId(selected.section)
      setSelectedMaterialId(selected.id)
      setDraft(selected)
    } else {
      setDraft(null)
      setSelectedMaterialId('')
    }
    setIsLoading(false)
  }

  async function loadEmployees(nextSelectedEmployeeId?: string) {
    const response = await api.list<Employee>('employees')
    const visible = response.items.filter((item) => item.status !== 'blocked' && item.status !== 'fired' && item.status !== 'deleted')
    setEmployees(visible)
    const selected = visible.find((item) => item.id === (nextSelectedEmployeeId || selectedEmployeeId)) || visible[0]
    if (selected) {
      setSelectedEmployeeId(selected.id)
      setEmployeeDraft({
        responsibilities: selected.responsibilities || defaultResponsibilities(selected.position),
        responsibilityComment: selected.responsibilityComment || '',
        reportsTo: selected.reportsTo || '',
      })
    } else {
      setSelectedEmployeeId('')
      setEmployeeDraft({ responsibilities: '', responsibilityComment: '', reportsTo: '' })
    }
  }

  useEffect(() => {
    void Promise.all([loadMaterials(), loadEmployees()]).catch(() => {
      setNotice('Не удалось загрузить базу знаний.')
      setIsLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.section] = (acc[item.section] || 0) + 1
      return acc
    }, {})
  }, [items])

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0]
  const visibleMaterials = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()
    return items.filter((item) => {
      if (item.section !== selectedSectionId) return false
      if (!lowerQuery) return true
      return [item.title, item.description, item.author, item.fileName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(lowerQuery))
    })
  }, [items, query, selectedSectionId])

  const mainSections = sections.filter((section) => !section.parent)
  const corporateSections = sections.filter((section) => section.parent === 'Корпоративная жизнь')
  const hierarchyEmployees = useMemo(() => {
    const groups = employees.reduce<Record<string, Employee[]>>((acc, employee) => {
      const group = hierarchyGroup(employee.position)
      acc[group] = acc[group] || []
      acc[group].push(employee)
      return acc
    }, {})
    return hierarchyOrder.map((group) => ({
      group,
      employees: (groups[group] || []).sort((a, b) => leaderPositions.indexOf(a.position) - leaderPositions.indexOf(b.position) || a.name.localeCompare(b.name, 'ru')),
    })).filter((entry) => entry.employees.length)
  }, [employees])
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId)

  function selectHierarchyEmployee(employee: Employee) {
    setSelectedEmployeeId(employee.id)
    setEmployeeDraft({
      responsibilities: employee.responsibilities || defaultResponsibilities(employee.position),
      responsibilityComment: employee.responsibilityComment || '',
      reportsTo: employee.reportsTo || '',
    })
  }

  async function saveHierarchyEmployee() {
    if (!selectedEmployee) return
    const updated = await api.update<Employee>('employees', selectedEmployee.id, {
      responsibilities: employeeDraft.responsibilities,
      responsibilityComment: employeeDraft.responsibilityComment,
      reportsTo: employeeDraft.reportsTo,
    })
    setEmployees((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
    setNotice('Ответственность сотрудника сохранена.')
  }

  function selectSection(sectionId: KnowledgeSectionId) {
    setSelectedSectionId(sectionId)
    const material = items.find((item) => item.section === sectionId)
    if (material) {
      setSelectedMaterialId(material.id)
      setDraft(material)
    } else {
      const blank: KnowledgeMaterial = {
        id: '',
        section: sectionId,
        title: defaultTitleForSection(sectionId),
        type: defaultTypeForSection(sectionId),
        status: 'draft',
        description: '',
        author: 'Управляющий',
      }
      setSelectedMaterialId('')
      setDraft(blank)
    }
  }

  function selectMaterial(material: KnowledgeMaterial) {
    setSelectedMaterialId(material.id)
    setDraft(material)
  }

  async function createMaterial() {
    const payload: Omit<KnowledgeMaterial, 'id'> = {
      section: selectedSectionId,
      title: defaultTitleForSection(selectedSectionId),
      type: defaultTypeForSection(selectedSectionId),
      status: 'draft',
      description: '',
      author: 'Управляющий',
    }
    const created = await api.create<KnowledgeMaterial>('knowledge', payload)
    setNotice('Материал создан.')
    await loadMaterials(created.id)
  }

  async function saveMaterial(statusOverride?: MaterialStatus) {
    if (!draft) return
    const payload = { ...draft, status: statusOverride || draft.status }
    if (!draft.id) {
      const created = await api.create<KnowledgeMaterial>('knowledge', payload)
      setNotice(statusOverride === 'published' ? 'Материал создан и опубликован.' : 'Материал создан.')
      await loadMaterials(created.id)
      return
    }
    const updated = await api.update<KnowledgeMaterial>('knowledge', draft.id, payload)
    setNotice(statusOverride === 'published' ? 'Материал опубликован.' : 'Изменения сохранены.')
    await loadMaterials(updated.id)
  }

  async function deleteMaterial() {
    if (!draft?.id) return
    if (!window.confirm('Удалить материал из базы знаний?')) return
    await api.remove('knowledge', draft.id)
    setNotice('Материал удалён.')
    setDraft(null)
    setSelectedMaterialId('')
    await loadMaterials()
  }

  function updateDraft(patch: Partial<KnowledgeMaterial>) {
    setDraft((current) => current ? { ...current, ...patch } : current)
  }

  function renderHierarchyList() {
    return (
      <section className="knowledge-list-card knowledge-hierarchy-card">
        <div className="knowledge-list-header">
          <div><h2>Схема иерархии</h2><p>Сотрудники, должности и зоны ответственности</p></div>
        </div>
        <div className="knowledge-hierarchy-groups">
          {hierarchyEmployees.length ? hierarchyEmployees.map((entry) => (
            <section key={entry.group} className="knowledge-hierarchy-group">
              <h3>{entry.group}</h3>
              <div className="knowledge-hierarchy-employee-list">
                {entry.employees.map((employee) => (
                  <button key={employee.id} type="button" className={employee.id === selectedEmployeeId ? 'knowledge-hierarchy-employee knowledge-hierarchy-employee--active' : 'knowledge-hierarchy-employee'} onClick={() => selectHierarchyEmployee(employee)}>
                    <div className="knowledge-hierarchy-employee__avatar">{employee.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div className="knowledge-hierarchy-employee__body">
                      <strong>{employee.name}</strong>
                      <span>{employee.position}{employee.reportsTo ? ` · отвечает перед: ${employee.reportsTo}` : ''}</span>
                      <ul>
                        {formatResponsibilities(employee.responsibilities, employee.position).slice(0, 3).map((line) => <li key={line} className={line.startsWith('*') ? 'is-required' : ''}>{line.replace(/^\*\s*/, '')}</li>)}
                      </ul>
                      {employee.responsibilityComment ? <p>{employee.responsibilityComment}</p> : null}
                    </div>
                    <ChevronRightIcon />
                  </button>
                ))}
              </div>
            </section>
          )) : <div className="knowledge-empty-row">Добавьте сотрудников, чтобы сформировать иерархию.</div>}
        </div>
      </section>
    )
  }

  function renderHierarchyEditor() {
    return (
      <aside className="knowledge-editor-card knowledge-hierarchy-editor">
        <div className="knowledge-editor-card__header">
          <div><h2>{selectedEmployee ? selectedEmployee.name : 'Сотрудник не выбран'}</h2><p>{selectedEmployee?.position || 'Выберите сотрудника в списке'}</p></div>
        </div>
        {selectedEmployee ? (
          <>
            <div className="knowledge-editor-form">
              <label><span>Кому подчиняется / кто руководитель</span><input value={employeeDraft.reportsTo} onChange={(event) => setEmployeeDraft((current) => ({ ...current, reportsTo: event.target.value }))} placeholder="Например: Управляющий / Администратор" /></label>
              <label><span>Зоны ответственности</span><textarea value={employeeDraft.responsibilities} onChange={(event) => setEmployeeDraft((current) => ({ ...current, responsibilities: event.target.value }))} rows={8} placeholder="* Зал\n* Брони\nКомментарий без звёздочки" /></label>
              <label><span>Комментарий</span><textarea value={employeeDraft.responsibilityComment} onChange={(event) => setEmployeeDraft((current) => ({ ...current, responsibilityComment: event.target.value }))} rows={3} placeholder="Необязательный комментарий" /></label>
            </div>
            <div className="knowledge-editor-actions"><button className="knowledge-primary-button" type="button" onClick={() => void saveHierarchyEmployee()}>Сохранить ответственность</button></div>
          </>
        ) : <div className="knowledge-empty-editor"><TeamIcon /><strong>Сотрудники не добавлены</strong></div>}
      </aside>
    )
  }

  return (
    <section className="knowledge-page">
      {notice ? <button className="knowledge-notice" type="button" onClick={() => setNotice('')}>{notice}</button> : null}
      <div className="knowledge-layout">
        <aside className="knowledge-sections-card">
          <div className="knowledge-panel-title">
            <h2>Разделы</h2>
          </div>

          <div className="knowledge-section-list">
            {mainSections.map((section) => (
              <button key={section.id} className={section.id === selectedSectionId ? 'knowledge-section knowledge-section--active' : 'knowledge-section'} type="button" onClick={() => selectSection(section.id)}>
                <span className="knowledge-section__icon">{section.icon}</span>
                <div><strong>{section.title}</strong><p>{section.description}</p></div>
                <small>{counts[section.id] || 0}</small>
              </button>
            ))}

            <div className={corporateSections.some((section) => section.id === selectedSectionId) ? 'knowledge-corporate knowledge-corporate--active' : 'knowledge-corporate'}>
              <div className="knowledge-corporate__header">
                <span><BookIcon /></span>
                <div><strong>Корпоративная жизнь</strong><p>События, гости и команда</p></div>
              </div>
              <div className="knowledge-corporate__list">
                {corporateSections.map((section) => (
                  <button key={section.id} className={section.id === selectedSectionId ? 'knowledge-corporate-item knowledge-corporate-item--active' : 'knowledge-corporate-item'} type="button" onClick={() => selectSection(section.id)}>
                    <span />
                    <strong>{section.title}</strong>
                    <small>{counts[section.id] || 0}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </aside>

        {selectedSectionId === 'hierarchy' ? renderHierarchyList() : (
        <section className="knowledge-list-card">
          <div className="knowledge-list-header">
            <div><h2>Материалы раздела</h2><p>{selectedSection.parent ? `${selectedSection.parent} › ${selectedSection.title}` : selectedSection.title}</p></div>
            <button className="knowledge-primary-button" type="button" onClick={createMaterial}>Добавить материал</button>
          </div>

          <label className="knowledge-local-search">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по материалам..." />
          </label>

          <div className="knowledge-table-scroll">
            <table className="knowledge-table">
              <thead>
                <tr><th>Название</th><th>Тип</th><th>Статус</th><th>Обновлено</th><th>Автор</th></tr>
              </thead>
              <tbody>
                {visibleMaterials.map((material) => (
                  <tr key={material.id} className={selectedMaterialId === material.id ? 'knowledge-table__row knowledge-table__row--active' : 'knowledge-table__row'} onClick={() => selectMaterial(material)}>
                    <td><button className="knowledge-material-name" type="button" onClick={(event) => { event.stopPropagation(); selectMaterial(material) }}>{material.title}</button></td>
                    <td><TypeBadge type={material.type} /></td>
                    <td><StatusBadge status={material.status} /></td>
                    <td>{material.updatedAt ? new Date(material.updatedAt).toLocaleDateString('ru-RU') : '—'}</td>
                    <td>{material.author || '—'}</td>
                  </tr>
                ))}
                {!visibleMaterials.length ? <tr><td colSpan={5}><div className="knowledge-empty-row">Материалов пока нет.</div></td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        )}

        {selectedSectionId === 'hierarchy' ? renderHierarchyEditor() : (
        <aside className="knowledge-editor-card">
          <div className="knowledge-editor-card__header">
            <div><h2>Редактор материала</h2><p>{draft ? typeLabels[draft.type] || 'Материал' : 'Материал не выбран'}</p></div>
          </div>

          {draft ? (
            <>
              <div className="knowledge-editor-form">
                <label><span>Название</span><input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} /></label>
                <div className="knowledge-two-cols">
                  <label><span>Тип</span><select value={draft.type} onChange={(event) => updateDraft({ type: event.target.value as MaterialType })}><option value="photo">Фото</option><option value="video">Видео</option><option value="scheme">Схема</option><option value="pdf">PDF</option><option value="instruction">Инструкция</option><option value="event">Событие</option><option value="guest">Гость</option><option value="team_post">Пост команды</option></select></label>
                  <label><span>Статус</span><select value={draft.status} onChange={(event) => updateDraft({ status: event.target.value as MaterialStatus })}><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="planned">Запланировано</option><option value="hidden">Скрыто</option></select></label>
                </div>
                <label><span>Автор / ответственный</span><input value={draft.author || ''} onChange={(event) => updateDraft({ author: event.target.value })} placeholder="Кто добавил материал" /></label>
                <label><span>Описание</span><textarea value={draft.description || ''} onChange={(event) => updateDraft({ description: event.target.value })} rows={4} placeholder="Что должен понять сотрудник" /></label>

                {draft.section === 'hierarchy' ? <div className="knowledge-hierarchy-list"><div className="knowledge-hierarchy-node"><strong>Обязательные зоны отмечайте звёздочкой</strong><span>Пример: * Зал, * Бар, комментарий без звёздочки</span><p>{draft.description || '* Зона ответственности\nКомментарий без звёздочки'}</p></div></div> : null}
                {draft.section === 'regular_guests' ? <><label><span>Телефон гостя</span><input value={draft.guestPhone || ''} onChange={(event) => updateDraft({ guestPhone: event.target.value })} /></label><label><span>Предпочтения</span><textarea value={draft.guestPreferences || ''} onChange={(event) => updateDraft({ guestPreferences: event.target.value })} rows={3} /></label><label><span>Ограничения / аллергии</span><input value={draft.guestRestrictions || ''} onChange={(event) => updateDraft({ guestRestrictions: event.target.value })} /></label><label><span>Комментарий для сервиса</span><textarea value={draft.guestComment || ''} onChange={(event) => updateDraft({ guestComment: event.target.value })} rows={3} /></label></> : null}
                {draft.section === 'guests_events' ? <div className="knowledge-two-cols"><label><span>Дата</span><input value={draft.eventDate || ''} onChange={(event) => updateDraft({ eventDate: event.target.value })} placeholder="15.06.2026" /></label><label><span>Время</span><input value={draft.eventTime || ''} onChange={(event) => updateDraft({ eventTime: event.target.value })} placeholder="19:00" /></label></div> : null}

                <div className="knowledge-upload-box">
                  <BookIcon />
                  <strong>{draft.fileName || 'Файл не выбран'}</strong>
                  <p>Укажите название файла или ссылку на материал, чтобы сотрудник понимал, что открыть или запросить у управляющего.</p>
                  <button type="button" onClick={() => { const name = window.prompt('Название файла или ссылка на материал'); if (name) updateDraft({ fileName: name }) }}>Указать файл / ссылку</button>
                </div>
              </div>

              <div className="knowledge-editor-actions">
                <button className="knowledge-primary-button" type="button" onClick={() => saveMaterial()}>Сохранить</button>
                <button className="knowledge-outline-button" type="button" onClick={() => saveMaterial('published')}>Опубликовать</button>
                <button className="knowledge-danger-button" type="button" onClick={deleteMaterial} disabled={!draft.id}>Удалить</button>
              </div>
            </>
          ) : (
            <div className="knowledge-empty-editor"><BookIcon /><strong>{isLoading ? 'Загрузка...' : 'Выберите материал'}</strong></div>
          )}
        </aside>
        )}
      </div>
    </section>
  )
}
