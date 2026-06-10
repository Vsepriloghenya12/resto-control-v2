import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircleIcon,
  BoxIcon,
  CalendarIcon,
  ChecklistIcon,
  ChevronRightIcon,
  SearchIcon,
} from '../../shared/ui/Icon'

type InventoryTab = 'products' | 'assigned' | 'submitted'
type SectionKey = 'bar' | 'kitchen' | 'household' | 'dishes'
type ActionMode = 'addProduct' | 'importTemplate' | 'assignInventory' | 'submittedRuns'

type InventorySection = {
  id: SectionKey
  title: string
  positions: number
  templates: number
  updatedAt: string
  icon: ReactNode
}

type InventoryProduct = {
  id: string
  name: string
  unit: string
  category: string
  templatesCount: number
  updatedAt: string
  section: SectionKey
}

type InventoryAssignment = {
  id: string
  template: string
  date: string
  assignee: string
  status: 'assigned' | 'completed'
}

type InventoryRun = {
  id: string
  template: string
  employee: string
  completedAt: string
  rows: number
}

const sections: InventorySection[] = [
  { id: 'bar', title: 'Бар', positions: 48, templates: 2, updatedAt: 'Обновлён сегодня 10:15', icon: <BoxIcon /> },
  { id: 'kitchen', title: 'Кухня', positions: 76, templates: 3, updatedAt: 'Обновлён сегодня 09:40', icon: <ChecklistIcon /> },
  { id: 'household', title: 'Хозтовары', positions: 32, templates: 1, updatedAt: 'Обновлён вчера 18:22', icon: <BoxIcon /> },
  { id: 'dishes', title: 'Посуда', positions: 58, templates: 2, updatedAt: 'Обновлён вчера 17:05', icon: <AlertCircleIcon /> },
]

const products: InventoryProduct[] = [
  { id: 'p1', name: 'Джин', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 2, updatedAt: 'сегодня 10:15', section: 'bar' },
  { id: 'p2', name: 'Ром белый', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 1, updatedAt: 'сегодня 10:12', section: 'bar' },
  { id: 'p3', name: 'Ром тёмный', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 1, updatedAt: 'сегодня 10:12', section: 'bar' },
  { id: 'p4', name: 'Виски', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 2, updatedAt: 'сегодня 10:11', section: 'bar' },
  { id: 'p5', name: 'Текила', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 1, updatedAt: 'сегодня 10:10', section: 'bar' },
  { id: 'p6', name: 'Водка', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 2, updatedAt: 'сегодня 10:09', section: 'bar' },
  { id: 'p7', name: 'Ликёр Бейлис', unit: 'бут.', category: 'Ликёры', templatesCount: 1, updatedAt: 'сегодня 10:07', section: 'bar' },
  { id: 'p8', name: 'Мартини Бьянко', unit: 'бут.', category: 'Вермуты', templatesCount: 1, updatedAt: 'сегодня 10:06', section: 'bar' },
  { id: 'p9', name: 'Сироп ванильный', unit: 'л', category: 'Сиропы', templatesCount: 2, updatedAt: 'сегодня 10:05', section: 'bar' },
  { id: 'p10', name: 'Томаты', unit: 'кг', category: 'Овощи', templatesCount: 1, updatedAt: 'сегодня 09:30', section: 'kitchen' },
  { id: 'p11', name: 'Салфетки', unit: 'уп.', category: 'Расходники', templatesCount: 1, updatedAt: 'вчера 18:22', section: 'household' },
  { id: 'p12', name: 'Тарелка 26 см', unit: 'шт.', category: 'Тарелки', templatesCount: 2, updatedAt: 'вчера 17:05', section: 'dishes' },
]

const assignments: InventoryAssignment[] = [
  { id: 'a1', template: 'Бар — вечерняя инвентаризация', date: '10.06.2026', assignee: 'Старший бармен', status: 'assigned' },
  { id: 'a2', template: 'Кухня — заготовки', date: '10.06.2026', assignee: 'Су-шеф', status: 'assigned' },
  { id: 'a3', template: 'Посуда — зал', date: '11.06.2026', assignee: 'Администратор', status: 'assigned' },
]

const runs: InventoryRun[] = [
  { id: 'r1', template: 'Бар — открытие', employee: 'Сергей Петров', completedAt: 'сегодня 11:20', rows: 42 },
  { id: 'r2', template: 'Кухня — вечер', employee: 'Алексей Кузнецов', completedAt: 'вчера 23:10', rows: 67 },
  { id: 'r3', template: 'Хозтовары', employee: 'Игорь Соколов', completedAt: 'вчера 18:50', rows: 31 },
]

function TabButton({ active, children, count, onClick }: { active: boolean; children: string; count?: number; onClick: () => void }) {
  return (
    <button className={active ? 'inventory-tab inventory-tab--active' : 'inventory-tab'} type="button" onClick={onClick}>
      {children}
      {typeof count === 'number' && <span>{count}</span>}
    </button>
  )
}

function SectionCard({ section, active, onClick }: { section: InventorySection; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'inventory-section inventory-section--active' : 'inventory-section'} type="button" onClick={onClick}>
      <span className="inventory-section__icon">{section.icon}</span>
      <div>
        <strong>{section.title}</strong>
        <p>{section.positions} позиций <span>·</span> {section.templates} бланка</p>
        <small>{section.updatedAt}</small>
      </div>
    </button>
  )
}

function ActionItem({ mode, activeMode, title, text, icon, onClick }: { mode: ActionMode; activeMode: ActionMode; title: string; text: string; icon: ReactNode; onClick: () => void }) {
  const active = mode === activeMode
  return (
    <button className={active ? 'inventory-action inventory-action--active' : 'inventory-action'} type="button" onClick={onClick}>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <ChevronRightIcon />
    </button>
  )
}

function AddProductPanel({ selectedSection }: { selectedSection: InventorySection }) {
  return (
    <div className="inventory-action-form">
      <h3>Добавить товар</h3>
      <label>
        <span>Раздел</span>
        <select defaultValue={selectedSection.title}>
          {sections.map((section) => <option key={section.id}>{section.title}</option>)}
        </select>
      </label>
      <label>
        <span>Название товара</span>
        <input placeholder="Введите название" />
      </label>
      <label>
        <span>Единица измерения</span>
        <input placeholder="Например: бут., кг, шт." />
      </label>
      <label>
        <span>Категория</span>
        <input placeholder="Например: Крепкий алкоголь" />
      </label>
      <button className="inventory-primary-button" type="button">Сохранить товар</button>
    </div>
  )
}

function ImportPanel({ selectedSection }: { selectedSection: InventorySection }) {
  return (
    <div className="inventory-action-form">
      <h3>Импорт бланка</h3>
      <label>
        <span>Раздел</span>
        <select defaultValue={selectedSection.title}>
          {sections.map((section) => <option key={section.id}>{section.title}</option>)}
        </select>
      </label>
      <div className="inventory-upload-box">
        <BoxIcon />
        <strong>PDF / Excel / CSV</strong>
        <p>Загрузите бланк, проверьте найденные позиции и только потом добавьте новые товары.</p>
        <button type="button">Выбрать файл</button>
      </div>
      <div className="inventory-import-preview">
        <span>Найдено: 48</span>
        <span>Новых: 6</span>
        <span>Дублей: 3</span>
      </div>
      <button className="inventory-primary-button" type="button">Проверить бланк</button>
    </div>
  )
}

function AssignPanel() {
  return (
    <div className="inventory-action-form">
      <h3>Назначить инвентаризацию</h3>
      <label>
        <span>Бланк</span>
        <select defaultValue="Бар — вечерняя инвентаризация">
          <option>Бар — вечерняя инвентаризация</option>
          <option>Кухня — заготовки</option>
          <option>Посуда — зал</option>
        </select>
      </label>
      <label>
        <span>Кому назначить</span>
        <select defaultValue="Старший бармен">
          <option>Старший бармен</option>
          <option>Су-шеф</option>
          <option>Администратор</option>
          <option>Клининг</option>
        </select>
      </label>
      <label>
        <span>Дата выполнения</span>
        <input type="date" defaultValue="2026-06-10" />
      </label>
      <button className="inventory-primary-button" type="button">Назначить</button>
    </div>
  )
}

function SubmittedPanel() {
  return (
    <div className="inventory-action-form inventory-submitted-panel">
      <h3>Сданные инвентаризации</h3>
      {runs.map((run) => (
        <div className="inventory-run" key={run.id}>
          <div>
            <strong>{run.template}</strong>
            <span>{run.employee} · {run.completedAt}</span>
            <small>{run.rows} строк заполнено</small>
          </div>
          <button type="button">Excel</button>
        </div>
      ))}
    </div>
  )
}

function ProductsContent({ productsList, sectionTitle }: { productsList: InventoryProduct[]; sectionTitle: string }) {
  return (
    <section className="inventory-table-area">
      <div className="inventory-table-header">
        <div>
          <h2>Товары раздела: {sectionTitle}</h2>
        </div>
        <label className="inventory-local-search">
          <SearchIcon />
          <input placeholder="Поиск в списке..." />
        </label>
      </div>
      <div className="inventory-table-scroll">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Единица</th>
              <th>Категория</th>
              <th>В бланках</th>
              <th>Изменение</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {productsList.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.unit}</td>
                <td>{product.category}</td>
                <td>{product.templatesCount} бланка</td>
                <td>{product.updatedAt}</td>
                <td>
                  <div className="inventory-row-actions">
                    <button type="button">✎</button>
                    <button type="button">⌫</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inventory-table-footer">
        <span>Всего позиций: {productsList.length}</span>
        <div>
          <button type="button" disabled>‹</button>
          <button className="inventory-page-button--active" type="button">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <button type="button">›</button>
        </div>
      </div>
    </section>
  )
}

function AssignedContent() {
  return (
    <section className="inventory-table-area">
      <div className="inventory-table-header">
        <h2>Назначенные инвентаризации</h2>
      </div>
      <div className="inventory-assignment-list">
        {assignments.map((item) => (
          <article className="inventory-assignment" key={item.id}>
            <div>
              <strong>{item.template}</strong>
              <span>{item.assignee} · {item.date}</span>
            </div>
            <span className="inventory-status">Назначена</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function SubmittedContent() {
  return (
    <section className="inventory-table-area">
      <div className="inventory-table-header">
        <h2>Сданные остатки</h2>
      </div>
      <div className="inventory-assignment-list">
        {runs.map((item) => (
          <article className="inventory-assignment" key={item.id}>
            <div>
              <strong>{item.template}</strong>
              <span>{item.employee} · {item.completedAt}</span>
            </div>
            <button type="button">Скачать Excel</button>
          </article>
        ))}
      </div>
    </section>
  )
}

export function InventoryPage() {
  const [selectedSectionId, setSelectedSectionId] = useState<SectionKey>('bar')
  const [activeTab, setActiveTab] = useState<InventoryTab>('products')
  const [actionMode, setActionMode] = useState<ActionMode>('addProduct')
  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0]

  const filteredProducts = useMemo(() => products.filter((product) => product.section === selectedSectionId), [selectedSectionId])

  return (
    <section className="inventory-page">
      <div className="inventory-tabs" role="tablist" aria-label="Разделы инвентаризации">
        <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')}>Товары и бланки</TabButton>
        <TabButton active={activeTab === 'assigned'} count={assignments.length} onClick={() => setActiveTab('assigned')}>Назначенные</TabButton>
        <TabButton active={activeTab === 'submitted'} count={runs.length} onClick={() => setActiveTab('submitted')}>Сданные</TabButton>
      </div>

      <div className="inventory-layout">
        <aside className="inventory-sections-card">
          <div className="inventory-panel-title">
            <h2>Разделы</h2>
            <button type="button">+ Добавить раздел</button>
          </div>
          <div className="inventory-sections-list">
            {sections.map((section) => (
              <SectionCard key={section.id} section={section} active={section.id === selectedSectionId} onClick={() => setSelectedSectionId(section.id)} />
            ))}
          </div>
          <div className="inventory-sections-footer">Всего позиций: {selectedSection.positions}</div>
        </aside>

        {activeTab === 'products' ? <ProductsContent productsList={filteredProducts} sectionTitle={selectedSection.title} /> : activeTab === 'assigned' ? <AssignedContent /> : <SubmittedContent />}

        <aside className="inventory-actions-card">
          <h2>Действия</h2>
          <div className="inventory-action-list">
            <ActionItem mode="addProduct" activeMode={actionMode} title="Добавить товар" text="Ручное добавление позиции в выбранный раздел." icon={<BoxIcon />} onClick={() => setActionMode('addProduct')} />
            <ActionItem mode="importTemplate" activeMode={actionMode} title="Импорт бланка" text="Загрузка PDF, Excel или CSV с предпросмотром." icon={<AlertCircleIcon />} onClick={() => setActionMode('importTemplate')} />
            <ActionItem mode="assignInventory" activeMode={actionMode} title="Назначить инвентаризацию" text="Выберите бланк, сотрудника или должность и дату." icon={<CalendarIcon />} onClick={() => setActionMode('assignInventory')} />
            <ActionItem mode="submittedRuns" activeMode={actionMode} title="Сданные инвентаризации" text="Просмотр отправленных остатков и скачивание Excel." icon={<ChecklistIcon />} onClick={() => setActionMode('submittedRuns')} />
          </div>
          {actionMode === 'addProduct' ? <AddProductPanel selectedSection={selectedSection} /> : actionMode === 'importTemplate' ? <ImportPanel selectedSection={selectedSection} /> : actionMode === 'assignInventory' ? <AssignPanel /> : <SubmittedPanel />}
        </aside>
      </div>

      <div className="inventory-help-card">
        <AlertCircleIcon />
        <p>Добавляйте товары вручную или импортируйте их из Excel/PDF. Создавайте бланки инвентаризации и назначайте их сотрудникам.</p>
      </div>
    </section>
  )
}
