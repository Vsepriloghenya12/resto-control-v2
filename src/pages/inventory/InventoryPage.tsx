import { useMemo, useState, type ReactNode } from 'react'
import { AlertCircleIcon, BoxIcon, CalendarIcon, ChecklistIcon, ChevronRightIcon, SearchIcon } from '../../shared/ui/Icon'

type InventoryTab = 'products' | 'assigned' | 'submitted'
type SectionKey = 'bar' | 'kitchen' | 'household' | 'dishes'
type ActionMode = 'addProduct' | 'importTemplate' | 'assignInventory' | 'submittedRuns'
type InventorySection = { id: SectionKey; title: string; icon: ReactNode }
type InventoryProduct = { id: string; name: string; unit: string; category: string; templatesCount: number; updatedAt: string; section: SectionKey }
type InventoryAssignment = { id: string; template: string; date: string; assignee: string; status: 'assigned' | 'completed' }
type InventoryRun = { id: string; template: string; employee: string; completedAt: string; rows: number }

const sections: InventorySection[] = [
  { id: 'bar', title: 'Бар', icon: <BoxIcon /> },
  { id: 'kitchen', title: 'Кухня', icon: <ChecklistIcon /> },
  { id: 'household', title: 'Хозтовары', icon: <BoxIcon /> },
  { id: 'dishes', title: 'Посуда', icon: <AlertCircleIcon /> },
]

const initialProducts: InventoryProduct[] = [
  { id: 'p1', name: 'Джин', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 2, updatedAt: 'сегодня 10:15', section: 'bar' },
  { id: 'p2', name: 'Ром белый', unit: 'бут.', category: 'Крепкий алкоголь', templatesCount: 1, updatedAt: 'сегодня 10:12', section: 'bar' },
  { id: 'p3', name: 'Сироп ванильный', unit: 'л', category: 'Сиропы', templatesCount: 2, updatedAt: 'сегодня 10:05', section: 'bar' },
  { id: 'p4', name: 'Томаты', unit: 'кг', category: 'Овощи', templatesCount: 1, updatedAt: 'сегодня 09:30', section: 'kitchen' },
  { id: 'p5', name: 'Куриное филе', unit: 'кг', category: 'Мясо', templatesCount: 1, updatedAt: 'сегодня 09:20', section: 'kitchen' },
  { id: 'p6', name: 'Салфетки', unit: 'уп.', category: 'Расходники', templatesCount: 1, updatedAt: 'вчера 18:22', section: 'household' },
  { id: 'p7', name: 'Моющее средство', unit: 'л', category: 'Хозтовары', templatesCount: 1, updatedAt: 'вчера 18:12', section: 'household' },
  { id: 'p8', name: 'Тарелка 26 см', unit: 'шт.', category: 'Тарелки', templatesCount: 2, updatedAt: 'вчера 17:05', section: 'dishes' },
  { id: 'p9', name: 'Бокал винный', unit: 'шт.', category: 'Стекло', templatesCount: 1, updatedAt: 'вчера 16:48', section: 'dishes' },
]

const initialAssignments: InventoryAssignment[] = [
  { id: 'a1', template: 'Бар — вечерняя инвентаризация', date: '10.06.2026', assignee: 'Старший бармен', status: 'assigned' },
  { id: 'a2', template: 'Кухня — заготовки', date: '10.06.2026', assignee: 'Су-шеф', status: 'assigned' },
  { id: 'a3', template: 'Посуда — зал', date: '11.06.2026', assignee: 'Администратор', status: 'assigned' },
]

const initialRuns: InventoryRun[] = [
  { id: 'r1', template: 'Бар — открытие', employee: 'Сергей Петров', completedAt: 'сегодня 11:20', rows: 42 },
  { id: 'r2', template: 'Кухня — вечер', employee: 'Алексей Кузнецов', completedAt: 'вчера 23:10', rows: 67 },
  { id: 'r3', template: 'Хозтовары', employee: 'Игорь Соколов', completedAt: 'вчера 18:50', rows: 31 },
]

function TabButton({ active, children, count, onClick }: { active: boolean; children: string; count?: number; onClick: () => void }) {
  return <button className={active ? 'inventory-tab inventory-tab--active' : 'inventory-tab'} type="button" onClick={onClick}>{children}{typeof count === 'number' && <span>{count}</span>}</button>
}

function ActionItem({ mode, activeMode, title, text, icon, onClick }: { mode: ActionMode; activeMode: ActionMode; title: string; text: string; icon: ReactNode; onClick: () => void }) {
  return <button className={mode === activeMode ? 'inventory-action inventory-action--active' : 'inventory-action'} type="button" onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div><ChevronRightIcon /></button>
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function InventoryPage() {
  const [selectedSectionId, setSelectedSectionId] = useState<SectionKey>('bar')
  const [activeTab, setActiveTab] = useState<InventoryTab>('products')
  const [actionMode, setActionMode] = useState<ActionMode>('addProduct')
  const [products, setProducts] = useState(initialProducts)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [runs, setRuns] = useState(initialRuns)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [productForm, setProductForm] = useState({ name: '', unit: '', category: '' })
  const [assignForm, setAssignForm] = useState({ template: 'Бар — вечерняя инвентаризация', assignee: 'Старший бармен', date: '2026-06-10' })

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0]
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return products.filter((product) => product.section === selectedSectionId && (!normalized || product.name.toLowerCase().includes(normalized) || product.category.toLowerCase().includes(normalized)))
  }, [products, query, selectedSectionId])

  function addProduct() {
    if (!productForm.name.trim() || !productForm.unit.trim() || !productForm.category.trim()) {
      setNotice('Заполните название, единицу и категорию товара.')
      return
    }
    setProducts((items) => [{ id: `p_${Date.now()}`, name: productForm.name.trim(), unit: productForm.unit.trim(), category: productForm.category.trim(), templatesCount: 1, updatedAt: 'только что', section: selectedSectionId }, ...items])
    setProductForm({ name: '', unit: '', category: '' })
    setNotice('Товар добавлен в выбранный раздел.')
  }

  function importTemplate() {
    const sample = [
      { name: 'Импорт: позиция 1', unit: 'шт.', category: 'Импорт' },
      { name: 'Импорт: позиция 2', unit: 'кг', category: 'Импорт' },
      { name: 'Импорт: позиция 3', unit: 'л', category: 'Импорт' },
    ]
    setProducts((items) => [...sample.map((item, index) => ({ id: `import_${Date.now()}_${index}`, ...item, templatesCount: 1, updatedAt: 'только что', section: selectedSectionId })), ...items])
    setNotice('Бланк проверен: добавлены 3 тестовые позиции импорта.')
  }

  function assignInventory() {
    setAssignments((items) => [{ id: `a_${Date.now()}`, template: assignForm.template, assignee: assignForm.assignee, date: new Date(assignForm.date).toLocaleDateString('ru-RU'), status: 'assigned' }, ...items])
    setActiveTab('assigned')
    setNotice('Инвентаризация назначена.')
  }

  function completeAssignment(id: string) {
    const assignment = assignments.find((item) => item.id === id)
    if (!assignment) return
    setAssignments((items) => items.filter((item) => item.id !== id))
    setRuns((items) => [{ id: `r_${Date.now()}`, template: assignment.template, employee: assignment.assignee, completedAt: 'только что', rows: filteredProducts.length || 1 }, ...items])
    setNotice('Инвентаризация отмечена как сданная.')
  }

  return (
    <section className="inventory-page">
      {notice ? <div className="inventory-notice">{notice}</div> : null}
      <div className="inventory-tabs" role="tablist" aria-label="Разделы инвентаризации">
        <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')}>Товары и бланки</TabButton>
        <TabButton active={activeTab === 'assigned'} count={assignments.length} onClick={() => setActiveTab('assigned')}>Назначенные</TabButton>
        <TabButton active={activeTab === 'submitted'} count={runs.length} onClick={() => setActiveTab('submitted')}>Сданные</TabButton>
      </div>

      <div className="inventory-layout">
        <aside className="inventory-sections-card">
          <div className="inventory-panel-title"><h2>Разделы</h2><button type="button" onClick={() => setNotice('Новый раздел добавляется через настройки инвентаризации. В MVP используются четыре базовых раздела.')}>+ Добавить раздел</button></div>
          <div className="inventory-sections-list">
            {sections.map((section) => {
              const sectionProducts = products.filter((item) => item.section === section.id)
              return <button key={section.id} className={section.id === selectedSectionId ? 'inventory-section inventory-section--active' : 'inventory-section'} type="button" onClick={() => setSelectedSectionId(section.id)}><span className="inventory-section__icon">{section.icon}</span><div><strong>{section.title}</strong><p>{sectionProducts.length} позиций <span>·</span> 1 бланк</p><small>Обновлено в интерфейсе</small></div></button>
            })}
          </div>
          <div className="inventory-sections-footer">Всего позиций: {products.filter((product) => product.section === selectedSectionId).length}</div>
        </aside>

        <section className="inventory-table-area">
          {activeTab === 'products' ? (
            <>
              <div className="inventory-table-header"><div><h2>Товары раздела: {selectedSection.title}</h2></div><label className="inventory-local-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск в списке..." /></label></div>
              <div className="inventory-table-scroll"><table className="inventory-table"><thead><tr><th>Товар</th><th>Единица</th><th>Категория</th><th>В бланках</th><th>Изменение</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.unit}</td><td>{product.category}</td><td>{product.templatesCount} бланка</td><td>{product.updatedAt}</td></tr>)}</tbody></table></div>
              <div className="inventory-table-footer"><span>Всего позиций: {filteredProducts.length}</span></div>
            </>
          ) : activeTab === 'assigned' ? (
            <><div className="inventory-table-header"><h2>Назначенные инвентаризации</h2></div><div className="inventory-assignment-list">{assignments.map((item) => <article className="inventory-assignment" key={item.id}><div><strong>{item.template}</strong><span>{item.assignee} · {item.date}</span></div><span className="inventory-status">Назначена</span><button type="button" onClick={() => completeAssignment(item.id)}>Отметить сданной</button></article>)}</div></>
          ) : (
            <><div className="inventory-table-header"><h2>Сданные остатки</h2></div><div className="inventory-assignment-list">{runs.map((item) => <article className="inventory-assignment" key={item.id}><div><strong>{item.template}</strong><span>{item.employee} · {item.completedAt}</span></div><button type="button" onClick={() => downloadCsv('inventory.csv', [['Бланк', item.template], ['Сотрудник', item.employee], ['Строк', String(item.rows)]])}>Скачать Excel</button></article>)}</div></>
          )}
        </section>

        <aside className="inventory-actions-card">
          <h2>Действия</h2>
          <div className="inventory-action-list">
            <ActionItem mode="addProduct" activeMode={actionMode} title="Добавить товар" text="Ручное добавление позиции в выбранный раздел." icon={<BoxIcon />} onClick={() => setActionMode('addProduct')} />
            <ActionItem mode="importTemplate" activeMode={actionMode} title="Импорт бланка" text="Загрузка PDF, Excel или CSV с предпросмотром." icon={<AlertCircleIcon />} onClick={() => setActionMode('importTemplate')} />
            <ActionItem mode="assignInventory" activeMode={actionMode} title="Назначить инвентаризацию" text="Выберите бланк, сотрудника или должность и дату." icon={<CalendarIcon />} onClick={() => setActionMode('assignInventory')} />
            <ActionItem mode="submittedRuns" activeMode={actionMode} title="Сданные инвентаризации" text="Просмотр отправленных остатков и скачивание Excel." icon={<ChecklistIcon />} onClick={() => setActionMode('submittedRuns')} />
          </div>
          {actionMode === 'addProduct' ? <div className="inventory-action-form"><h3>Добавить товар</h3><label><span>Название товара</span><input value={productForm.name} onChange={(e) => setProductForm((value) => ({ ...value, name: e.target.value }))} placeholder="Введите название" /></label><label><span>Единица измерения</span><input value={productForm.unit} onChange={(e) => setProductForm((value) => ({ ...value, unit: e.target.value }))} placeholder="бут., кг, шт." /></label><label><span>Категория</span><input value={productForm.category} onChange={(e) => setProductForm((value) => ({ ...value, category: e.target.value }))} placeholder="Категория" /></label><button className="inventory-primary-button" type="button" onClick={addProduct}>Сохранить товар</button></div> : null}
          {actionMode === 'importTemplate' ? <div className="inventory-action-form"><h3>Импорт бланка</h3><div className="inventory-upload-box"><BoxIcon /><strong>PDF / Excel / CSV</strong><p>Проверка бланка добавит новые позиции в выбранный раздел.</p><button type="button" onClick={() => setNotice('Файл выбран. Нажмите «Проверить бланк», чтобы добавить найденные позиции.')}>Выбрать файл</button></div><div className="inventory-import-preview"><span>Найдено: 48</span><span>Новых: 3</span><span>Дублей: 0</span></div><button className="inventory-primary-button" type="button" onClick={importTemplate}>Проверить бланк</button></div> : null}
          {actionMode === 'assignInventory' ? <div className="inventory-action-form"><h3>Назначить инвентаризацию</h3><label><span>Бланк</span><select value={assignForm.template} onChange={(e) => setAssignForm((value) => ({ ...value, template: e.target.value }))}><option>Бар — вечерняя инвентаризация</option><option>Кухня — заготовки</option><option>Посуда — зал</option></select></label><label><span>Кому назначить</span><select value={assignForm.assignee} onChange={(e) => setAssignForm((value) => ({ ...value, assignee: e.target.value }))}><option>Старший бармен</option><option>Су-шеф</option><option>Администратор</option><option>Клининг</option></select></label><label><span>Дата выполнения</span><input type="date" value={assignForm.date} onChange={(e) => setAssignForm((value) => ({ ...value, date: e.target.value }))} /></label><button className="inventory-primary-button" type="button" onClick={assignInventory}>Назначить</button></div> : null}
          {actionMode === 'submittedRuns' ? <div className="inventory-action-form inventory-submitted-panel"><h3>Сданные инвентаризации</h3>{runs.map((run) => <div className="inventory-run" key={run.id}><div><strong>{run.template}</strong><span>{run.employee} · {run.completedAt}</span><small>{run.rows} строк заполнено</small></div><button type="button" onClick={() => downloadCsv('inventory.csv', [['Бланк', run.template], ['Сотрудник', run.employee]])}>Excel</button></div>)}</div> : null}
        </aside>
      </div>

      <div className="inventory-help-card"><AlertCircleIcon /><p>Все кнопки на этой странице теперь дают действие на экране: добавляют товары, имитируют импорт, назначают и закрывают инвентаризацию, скачивают CSV-файл.</p></div>
    </section>
  )
}
