import { useMemo, useState, type ReactNode } from 'react'
import {
  BookIcon,
  CalendarIcon,
  ChevronRightIcon,
  SearchIcon,
  TeamIcon,
  UserIcon,
} from '../../shared/ui/Icon'

type KnowledgeSectionId =
  | 'intro'
  | 'hierarchy'
  | 'documents'
  | 'guests_events'
  | 'regular_guests'
  | 'team_wall'

type MaterialStatus = 'published' | 'draft' | 'hidden' | 'planned'
type MaterialType = 'photo' | 'video' | 'scheme' | 'document' | 'event' | 'guest' | 'team_post'

type KnowledgeSection = {
  id: KnowledgeSectionId
  title: string
  count: number
  description: string
  icon: ReactNode
  parent?: string
}

type KnowledgeMaterial = {
  id: string
  sectionId: KnowledgeSectionId
  title: string
  type: MaterialType
  status: MaterialStatus
  updatedAt: string
  author: string
  summary: string
}

const sections: KnowledgeSection[] = [
  {
    id: 'intro',
    title: 'Знакомство с компанией',
    count: 12,
    description: 'Фото, видео и короткие карточки адаптации',
    icon: <UserIcon />,
  },
  {
    id: 'hierarchy',
    title: 'Иерархия и ответственность',
    count: 8,
    description: 'Команда, должности и зоны ответственности',
    icon: <TeamIcon />,
  },
  {
    id: 'documents',
    title: 'Документы компании',
    count: 9,
    description: 'Обучающие PDF, инструкции и правила',
    icon: <BookIcon />,
  },
  {
    id: 'guests_events',
    title: 'Мы и гости',
    count: 5,
    description: 'События с гостями: были, есть и будут',
    icon: <CalendarIcon />,
    parent: 'Корпоративная жизнь',
  },
  {
    id: 'regular_guests',
    title: 'Постоянные гости',
    count: 6,
    description: 'Предпочтения, ограничения и сервисные заметки',
    icon: <UserIcon />,
    parent: 'Корпоративная жизнь',
  },
  {
    id: 'team_wall',
    title: 'Мы — команда',
    count: 4,
    description: 'Корпоративы, дни рождения и внутренняя стена',
    icon: <TeamIcon />,
    parent: 'Корпоративная жизнь',
  },
]

const materials: KnowledgeMaterial[] = [
  {
    id: 'm1',
    sectionId: 'intro',
    title: 'Первый день в ресторане',
    type: 'video',
    status: 'published',
    updatedAt: 'сегодня',
    author: 'Иван Петров',
    summary: 'Короткое видео для нового сотрудника: куда прийти, к кому обратиться, что сделать в первую смену.',
  },
  {
    id: 'm2',
    sectionId: 'intro',
    title: 'Как устроен ресторан',
    type: 'photo',
    status: 'published',
    updatedAt: 'вчера',
    author: 'Анна Смирнова',
    summary: 'Фото основных зон ресторана и короткие пояснения для адаптации.',
  },
  {
    id: 'm3',
    sectionId: 'hierarchy',
    title: 'Схема команды смены',
    type: 'scheme',
    status: 'published',
    updatedAt: 'сегодня',
    author: 'Иван Петров',
    summary: 'Кто кому подчиняется, обязательные зоны со звёздочкой и комментарии по ответственности.',
  },
  {
    id: 'm4',
    sectionId: 'documents',
    title: 'Стандарты сервиса для зала',
    type: 'document',
    status: 'published',
    updatedAt: '10 июня',
    author: 'Анна Смирнова',
    summary: 'Обучающий PDF для официантов и хостес: приветствие, посадка, коммуникация с гостем.',
  },
  {
    id: 'm5',
    sectionId: 'documents',
    title: 'Правила безопасности на кухне',
    type: 'document',
    status: 'published',
    updatedAt: '8 июня',
    author: 'Мария Иванова',
    summary: 'Инструкция для сотрудников кухни: санитария, оборудование, хранение и безопасная работа.',
  },
  {
    id: 'm6',
    sectionId: 'guests_events',
    title: 'День рождения ресторана',
    type: 'event',
    status: 'planned',
    updatedAt: '15 июня',
    author: 'Иван Петров',
    summary: 'Вечер для команды и гостей: живая музыка, специальное меню и фотографии события.',
  },
  {
    id: 'm7',
    sectionId: 'guests_events',
    title: 'Дегустация нового меню',
    type: 'event',
    status: 'published',
    updatedAt: '10 июня',
    author: 'Анна Смирнова',
    summary: 'Событие с постоянными гостями и командой зала.',
  },
  {
    id: 'm8',
    sectionId: 'regular_guests',
    title: 'Анна Смирнова',
    type: 'guest',
    status: 'published',
    updatedAt: 'сегодня',
    author: 'Мария Иванова',
    summary: 'Любит стол у окна, без кинзы, часто приходит с ребёнком — нужен детский стул.',
  },
  {
    id: 'm9',
    sectionId: 'team_wall',
    title: 'День рождения Сергея',
    type: 'team_post',
    status: 'published',
    updatedAt: '9 июня',
    author: 'Анна Смирнова',
    summary: 'Фото команды и поздравление старшего бармена.',
  },
]

const typeLabels: Record<MaterialType, string> = {
  photo: 'Фото',
  video: 'Видео',
  scheme: 'Схема',
  document: 'Документ',
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

function StatusBadge({ status }: { status: MaterialStatus }) {
  return <span className={`knowledge-status knowledge-status--${status}`}>{statusLabels[status]}</span>
}

function TypeBadge({ type }: { type: MaterialType }) {
  return <span className="knowledge-type">{typeLabels[type]}</span>
}

function SectionCard({ section, active, onClick }: { section: KnowledgeSection; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'knowledge-section knowledge-section--active' : 'knowledge-section'} type="button" onClick={onClick}>
      <span className="knowledge-section__icon">{section.icon}</span>
      <div>
        <strong>{section.title}</strong>
        <p>{section.description}</p>
      </div>
      <small>{section.count}</small>
    </button>
  )
}

function CorporateSubsection({ section, active, onClick }: { section: KnowledgeSection; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'knowledge-corporate-item knowledge-corporate-item--active' : 'knowledge-corporate-item'} type="button" onClick={onClick}>
      <span />
      <strong>{section.title}</strong>
      <small>{section.count}</small>
    </button>
  )
}

function EditorIntro({ material }: { material: KnowledgeMaterial }) {
  return (
    <div className="knowledge-editor-form">
      <label>
        <span>Название материала</span>
        <input defaultValue={material.title} />
      </label>
      <label>
        <span>Тип</span>
        <select defaultValue={material.type}>
          <option value="photo">Фото</option>
          <option value="video">Видео</option>
          <option value="scheme">Схема</option>
        </select>
      </label>
      <label>
        <span>Короткое описание</span>
        <textarea defaultValue={material.summary} rows={4} />
      </label>
      <div className="knowledge-media-row">
        <div className="knowledge-media-thumb">Фото</div>
        <div className="knowledge-media-thumb">Видео</div>
        <button type="button">Добавить медиа</button>
      </div>
    </div>
  )
}

function EditorHierarchy() {
  return (
    <div className="knowledge-editor-form">
      <label>
        <span>Название схемы</span>
        <input defaultValue="Схема команды смены" />
      </label>
      <div className="knowledge-hierarchy-list">
        <div className="knowledge-hierarchy-node">
          <strong>Иван Петров</strong>
          <span>Управляющий</span>
          <p>* Контроль смены<br />* Сотрудники</p>
          <small>Комментарий: отвечает за запуск смены и связь с владельцем</small>
        </div>
        <div className="knowledge-hierarchy-node">
          <strong>Сергей Петров</strong>
          <span>Старший бармен</span>
          <p>* Бар<br />* Инвентаризация бара</p>
          <small>Комментарий: обучает новых барменов</small>
        </div>
      </div>
      <button className="knowledge-outline-button" type="button">Добавить сотрудника в схему</button>
    </div>
  )
}

function EditorDocument({ material }: { material: KnowledgeMaterial }) {
  return (
    <div className="knowledge-editor-form">
      <label>
        <span>Название документа</span>
        <input defaultValue={material.title} />
      </label>
      <label>
        <span>Тип документа</span>
        <select defaultValue="Обучающий PDF">
          <option>Обучающий PDF</option>
          <option>Инструкция</option>
          <option>Регламент</option>
          <option>Правила компании</option>
          <option>Философия компании</option>
          <option>Видеоинструкция</option>
        </select>
      </label>
      <div className="knowledge-upload-box">
        <BookIcon />
        <strong>PDF / видео / инструкция</strong>
        <p>Загрузите обучающий материал для сотрудников. Чек-листы сюда не добавляются.</p>
        <button type="button">Выбрать файл</button>
      </div>
      <label>
        <span>Описание для сотрудника</span>
        <textarea defaultValue={material.summary} rows={3} />
      </label>
    </div>
  )
}

function EditorEvent({ material }: { material: KnowledgeMaterial }) {
  return (
    <div className="knowledge-editor-form">
      <label>
        <span>Название события</span>
        <input defaultValue={material.title} />
      </label>
      <div className="knowledge-two-cols">
        <label>
          <span>Дата</span>
          <input defaultValue="15.06.2026" />
        </label>
        <label>
          <span>Время</span>
          <input defaultValue="19:00" />
        </label>
      </div>
      <label>
        <span>Статус</span>
        <select defaultValue="planned">
          <option value="published">Опубликовано</option>
          <option value="planned">Запланировано</option>
          <option value="draft">Черновик</option>
          <option value="hidden">Скрыто</option>
        </select>
      </label>
      <label>
        <span>Описание</span>
        <textarea defaultValue={material.summary} rows={4} />
      </label>
      <div className="knowledge-media-row">
        <div className="knowledge-media-thumb">Фото</div>
        <div className="knowledge-media-thumb">Видео</div>
        <button type="button">Добавить</button>
      </div>
    </div>
  )
}

function EditorGuest({ material }: { material: KnowledgeMaterial }) {
  return (
    <div className="knowledge-editor-form">
      <label>
        <span>Имя гостя</span>
        <input defaultValue={material.title} />
      </label>
      <label>
        <span>Телефон</span>
        <input placeholder="Необязательно" />
      </label>
      <label>
        <span>Предпочтения</span>
        <textarea defaultValue="Любит стол у окна, часто заказывает чизкейк и капучино." rows={3} />
      </label>
      <label>
        <span>Ограничения / аллергии</span>
        <input defaultValue="Без кинзы" />
      </label>
      <label>
        <span>Комментарий для сервиса</span>
        <textarea defaultValue="Приходит с ребёнком, нужен детский стул." rows={3} />
      </label>
    </div>
  )
}

function EditorTeamPost({ material }: { material: KnowledgeMaterial }) {
  return (
    <div className="knowledge-editor-form">
      <label>
        <span>Заголовок</span>
        <input defaultValue={material.title} />
      </label>
      <label>
        <span>Описание</span>
        <textarea defaultValue={material.summary} rows={4} />
      </label>
      <div className="knowledge-media-row">
        <div className="knowledge-media-thumb">Фото</div>
        <div className="knowledge-media-thumb">Видео</div>
        <button type="button">Добавить</button>
      </div>
    </div>
  )
}

function EditorContent({ material }: { material: KnowledgeMaterial }) {
  if (material.sectionId === 'hierarchy') return <EditorHierarchy />
  if (material.sectionId === 'documents') return <EditorDocument material={material} />
  if (material.sectionId === 'guests_events') return <EditorEvent material={material} />
  if (material.sectionId === 'regular_guests') return <EditorGuest material={material} />
  if (material.sectionId === 'team_wall') return <EditorTeamPost material={material} />
  return <EditorIntro material={material} />
}

export function KnowledgeBasePage() {
  const [selectedSectionId, setSelectedSectionId] = useState<KnowledgeSectionId>('guests_events')
  const [selectedMaterialId, setSelectedMaterialId] = useState('m6')

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0]
  const visibleMaterials = useMemo(() => materials.filter((material) => material.sectionId === selectedSectionId), [selectedSectionId])
  const selectedMaterial = visibleMaterials.find((material) => material.id === selectedMaterialId) ?? visibleMaterials[0]
  const mainSections = sections.filter((section) => !section.parent)
  const corporateSections = sections.filter((section) => section.parent === 'Корпоративная жизнь')

  const handleSelectSection = (sectionId: KnowledgeSectionId) => {
    setSelectedSectionId(sectionId)
    const firstMaterial = materials.find((material) => material.sectionId === sectionId)
    if (firstMaterial) setSelectedMaterialId(firstMaterial.id)
  }

  return (
    <section className="knowledge-page">
      <div className="knowledge-layout">
        <aside className="knowledge-sections-card">
          <div className="knowledge-panel-title">
            <h2>Разделы</h2>
            <button type="button">+</button>
          </div>

          <div className="knowledge-section-list">
            {mainSections.map((section) => (
              <SectionCard key={section.id} section={section} active={section.id === selectedSectionId} onClick={() => handleSelectSection(section.id)} />
            ))}

            <div className={corporateSections.some((section) => section.id === selectedSectionId) ? 'knowledge-corporate knowledge-corporate--active' : 'knowledge-corporate'}>
              <div className="knowledge-corporate__header">
                <span><BookIcon /></span>
                <div>
                  <strong>Корпоративная жизнь</strong>
                  <p>События, гости и команда</p>
                </div>
              </div>
              <div className="knowledge-corporate__list">
                {corporateSections.map((section) => (
                  <CorporateSubsection key={section.id} section={section} active={section.id === selectedSectionId} onClick={() => handleSelectSection(section.id)} />
                ))}
              </div>
            </div>
          </div>

          <div className="knowledge-info-card">
            <strong>Что хранится здесь</strong>
            <p>Фото, видео, схемы, обучающие PDF, инструкции, иерархия, гости и события команды.</p>
          </div>
        </aside>

        <section className="knowledge-list-card">
          <div className="knowledge-list-header">
            <div>
              <h2>Материалы раздела</h2>
              <p>{selectedSection.parent ? `${selectedSection.parent} › ${selectedSection.title}` : selectedSection.title}</p>
            </div>
            <button className="knowledge-primary-button" type="button">Добавить материал</button>
          </div>

          <label className="knowledge-local-search">
            <SearchIcon />
            <input placeholder="Поиск по материалам..." />
          </label>

          <div className="knowledge-table-scroll">
            <table className="knowledge-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Статус</th>
                  <th>Обновлено</th>
                  <th>Автор</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleMaterials.map((material) => (
                  <tr key={material.id} className={selectedMaterial?.id === material.id ? 'knowledge-table__row knowledge-table__row--active' : 'knowledge-table__row'}>
                    <td>
                      <button className="knowledge-material-name" type="button" onClick={() => setSelectedMaterialId(material.id)}>{material.title}</button>
                    </td>
                    <td><TypeBadge type={material.type} /></td>
                    <td><StatusBadge status={material.status} /></td>
                    <td>{material.updatedAt}</td>
                    <td>{material.author}</td>
                    <td><button className="knowledge-dots-button" type="button"><ChevronRightIcon /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="knowledge-editor-card">
          <div className="knowledge-editor-card__header">
            <div>
              <h2>Редактор материала</h2>
              <p>{selectedMaterial ? typeLabels[selectedMaterial.type] : 'Материал'}</p>
            </div>
            <button type="button">×</button>
          </div>

          {selectedMaterial ? (
            <>
              <EditorContent material={selectedMaterial} />
              <div className="knowledge-editor-actions">
                <button className="knowledge-primary-button" type="button">Сохранить</button>
                <button className="knowledge-outline-button" type="button">Опубликовать</button>
                <button className="knowledge-danger-button" type="button">Удалить</button>
              </div>
            </>
          ) : (
            <div className="knowledge-empty-editor">
              <BookIcon />
              <strong>Выберите материал</strong>
              <p>Откройте материал из списка, чтобы отредактировать его.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
