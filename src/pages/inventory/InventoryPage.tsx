import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircleIcon, BoxIcon, CalendarIcon, ChecklistIcon, ChevronRightIcon, SearchIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type InventoryTab = 'products' | 'assigned' | 'submitted'
type SectionKey = 'bar' | 'kitchen' | 'household' | 'dishes'
type ActionMode = 'addProduct' | 'assignInventory' | 'submittedRuns'
type InventorySection = { id: SectionKey; title: string; icon: ReactNode }
type InventoryProduct = { id: string; name: string; unit: string; category: string; section: string; minBalance?: number; active?: boolean; updatedAt?: string }
type InventoryAssignment = { id: string; title?: string; template?: string; section: string; assignedPosition?: string; assignee?: string; dueDate?: string; date?: string; status: 'assigned' | 'completed' | 'draft' | 'submitted' | 'in_progress'; rowsCount?: number }

const sections: InventorySection[] = [
  { id: 'bar', title: 'Бар', icon: <BoxIcon /> },
  { id: 'kitchen', title: 'Кухня', icon: <ChecklistIcon /> },
  { id: 'household', title: 'Хозтовары', icon: <BoxIcon /> },
  { id: 'dishes', title: 'Посуда', icon: <AlertCircleIcon /> },
]

const sectionNames: Record<SectionKey, string> = { bar: 'Бар', kitchen: 'Кухня', household: 'Хозтовары', dishes: 'Посуда' }
const sectionIdsByName: Record<string, SectionKey> = { Бар: 'bar', Кухня: 'kitchen', Хозтовары: 'household', Посуда: 'dishes' }

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
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [assignments, setAssignments] = useState<InventoryAssignment[]>([])
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showNotice(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 3000)
  }
  const [productForm, setProductForm] = useState({ name: '', unit: '', category: '' })

  // iiko import state
  type IikoItem = { name: string; unit: string; category: string }
  const [iikoOpen, setIikoOpen] = useState(false)
  const [iikoLoading, setIikoLoading] = useState(false)
  const [iikoError, setIikoError] = useState('')
  const [iikoAllItems, setIikoAllItems] = useState<IikoItem[]>([])
  // checked: idx → SectionKey (присвоен раздел)
  const [iikoChecked, setIikoChecked] = useState<Map<number, SectionKey>>(new Map())
  const [iikoActiveCat, setIikoActiveCat] = useState<string>('all')
  const [iikoSearch, setIikoSearch] = useState('')
  const [iikoImporting, setIikoImporting] = useState(false)
  const [assignForm, setAssignForm] = useState({ template: 'Вечерняя инвентаризация', assignee: 'Старший бармен', date: new Date().toISOString().slice(0, 10) })

  async function loadInventory() {
    const [productsResult, assignmentsResult] = await Promise.all([api.list<InventoryProduct>('inventory-products'), api.list<InventoryAssignment>('inventory-assignments')])
    setProducts(productsResult.items.filter((item) => item.active !== false))
    setAssignments(assignmentsResult.items)
  }

  useEffect(() => { void loadInventory() }, [])

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0]
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return products.filter((product) => (sectionIdsByName[product.section] || product.section) === selectedSectionId && (!normalized || product.name.toLowerCase().includes(normalized) || product.category.toLowerCase().includes(normalized)))
  }, [products, query, selectedSectionId])

  const sectionAssignments = assignments.filter((assignment) => (sectionIdsByName[assignment.section] || assignment.section) === selectedSectionId)
  const assigned = sectionAssignments.filter((assignment) => assignment.status !== 'completed' && assignment.status !== 'submitted')
  const submitted = sectionAssignments.filter((assignment) => assignment.status === 'completed' || assignment.status === 'submitted')

  async function addProduct() {
    if (!productForm.name.trim()) { setNotice('Введите название товара.'); return }
    const created = await api.create<InventoryProduct>('inventory-products', { name: productForm.name.trim(), unit: productForm.unit.trim() || 'шт', category: productForm.category.trim() || 'Без категории', section: sectionNames[selectedSectionId], minBalance: 0, active: true })
    setProducts((items) => [created, ...items])
    setProductForm({ name: '', unit: '', category: '' })
    setNotice('Товар добавлен.')
  }

  async function assignInventory() {
    const created = await api.create<InventoryAssignment>('inventory-assignments', { title: assignForm.template, template: assignForm.template, section: sectionNames[selectedSectionId], assignedPosition: assignForm.assignee, assignee: assignForm.assignee, dueDate: assignForm.date, date: assignForm.date, status: 'assigned', rowsCount: filteredProducts.length })
    setAssignments((items) => [created, ...items])
    setNotice('Инвентаризация назначена.')
  }

  async function completeAssignment(id: string) {
    const updated = await api.update<InventoryAssignment>('inventory-assignments', id, { status: 'completed' })
    setAssignments((items) => items.map((item) => item.id === updated.id ? updated : item))
    setNotice('Инвентаризация отмечена как сданная.')
  }


  function downloadSubmitted() {
    const rows = [['Название', 'Раздел', 'Ответственный', 'Статус'], ...submitted.map((item) => [item.title || item.template || 'Инвентаризация', item.section, item.assignee || item.assignedPosition || '—', item.status])]
    downloadCsv('inventory-submitted.csv', rows)
  }

  async function openIikoImport() {
    setIikoOpen(true)
    setIikoLoading(true)
    setIikoError('')
    setIikoAllItems([])
    setIikoChecked(new Map())
    setIikoSearch('')
    setIikoActiveCat('all')
    try {
      const resp = await fetch('/api/iiko/inventory', { credentials: 'include' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Ошибка загрузки')
      setIikoAllItems(data.items as IikoItem[])
    } catch (e) {
      setIikoError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setIikoLoading(false)
    }
  }

  function iikoSetSec(idx: number, sec: SectionKey | '') {
    setIikoChecked((prev) => {
      const next = new Map(prev)
      if (sec) next.set(idx, sec)
      else next.delete(idx)
      return next
    })
  }

  function iikoSelectAllVisible(sec: SectionKey) {
    setIikoChecked((prev) => {
      const next = new Map(prev)
      iikoVisible.forEach(({ idx }) => next.set(idx, sec))
      return next
    })
  }

  function iikoClearVisible() {
    setIikoChecked((prev) => {
      const next = new Map(prev)
      iikoVisible.forEach(({ idx }) => next.delete(idx))
      return next
    })
  }

  async function doIikoImport() {
    setIikoImporting(true)
    let count = 0
    for (const [idx, sec] of iikoChecked.entries()) {
      const item = iikoAllItems[idx]
      if (!item) continue
      const created = await api.create<InventoryProduct>('inventory-products', {
        name: item.name,
        unit: item.unit,
        category: item.category || 'Из iiko',
        section: sectionNames[sec],
        minBalance: 0,
        active: true,
      })
      setProducts((prev) => [...prev, created])
      count++
    }
    setIikoImporting(false)
    setIikoOpen(false)
    showNotice(`Импортировано ${count} позиций из iiko.`)
  }

  const iikoCats = useMemo(() => {
    const cats = Array.from(new Set(iikoAllItems.map((i) => i.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))
    return cats
  }, [iikoAllItems])

  const iikoVisible = useMemo(() => {
    const q = iikoSearch.trim().toLowerCase()
    return iikoAllItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        if (iikoActiveCat !== 'all' && item.category !== iikoActiveCat) return false
        if (q && !item.name.toLowerCase().includes(q)) return false
        return true
      })
  }, [iikoAllItems, iikoSearch, iikoActiveCat])

  const iikoCheckedTotal = iikoChecked.size
  const iikoCatCount = (cat: string) => {
    const items = cat === 'all' ? iikoAllItems.map((_, i) => i) : iikoAllItems.map((item, i) => ({ item, i })).filter(({ item }) => item.category === cat).map(({ i }) => i)
    return items.filter((i) => iikoChecked.has(i)).length
  }

  return (
    <section className="inventory-page">
      <aside className="inventory-sections-panel">
        <div className="inventory-sections-panel__header"><h2>Разделы</h2></div>
        <div className="inventory-sections-list">{sections.map((section) => <button className={section.id === selectedSectionId ? 'inventory-section inventory-section--active' : 'inventory-section'} type="button" key={section.id} onClick={() => setSelectedSectionId(section.id)}><span>{section.icon}</span><div><strong>{section.title}</strong><p>{products.filter((product) => (sectionIdsByName[product.section] || product.section) === section.id).length} товаров</p></div></button>)}</div>
      </aside>

      <main className="inventory-main-panel">
        {notice ? <div className="inventory-notice">{notice}</div> : null}
        <div className="inventory-tabs"><TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} count={filteredProducts.length}>Товары и бланки</TabButton><TabButton active={activeTab === 'assigned'} onClick={() => setActiveTab('assigned')} count={assigned.length}>Назначенные</TabButton><TabButton active={activeTab === 'submitted'} onClick={() => setActiveTab('submitted')} count={submitted.length}>Сданные</TabButton></div>
        <div className="inventory-search-row"><label><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Поиск: ${selectedSection.title}`} /></label></div>

        {activeTab === 'products' ? <div className="inventory-table-card"><div className="inventory-table-card__header"><div><h2>{selectedSection.title}</h2></div></div><table className="inventory-table"><thead><tr><th>Название</th><th>Ед.</th><th>Категория</th><th>Раздел</th><th>Обновлено</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.unit}</td><td>{product.category}</td><td>{product.section}</td><td>{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('ru-RU') : '—'}</td></tr>)}{filteredProducts.length === 0 ? <tr><td colSpan={5}>Товаров пока нет.</td></tr> : null}</tbody></table></div> : null}

        {activeTab === 'assigned' ? <div className="inventory-table-card"><div className="inventory-table-card__header"><div><h2>Назначенные инвентаризации</h2></div></div><table className="inventory-table"><thead><tr><th>Бланк</th><th>Дата</th><th>Ответственный</th><th>Статус</th><th></th></tr></thead><tbody>{assigned.map((assignment) => <tr key={assignment.id}><td>{assignment.title || assignment.template}</td><td>{assignment.dueDate || assignment.date || '—'}</td><td>{assignment.assignee || assignment.assignedPosition || '—'}</td><td>{assignment.status}</td><td><button type="button" onClick={() => void completeAssignment(assignment.id)}>Сдано</button></td></tr>)}{assigned.length === 0 ? <tr><td colSpan={5}>Назначений нет.</td></tr> : null}</tbody></table></div> : null}

        {activeTab === 'submitted' ? <div className="inventory-table-card"><div className="inventory-table-card__header"><div><h2>Сданные инвентаризации</h2></div><button type="button" onClick={downloadSubmitted}>Скачать CSV</button></div><table className="inventory-table"><thead><tr><th>Бланк</th><th>Дата</th><th>Сотрудник</th><th>Строк</th></tr></thead><tbody>{submitted.map((run) => <tr key={run.id}><td>{run.title || run.template}</td><td>{run.dueDate || run.date || '—'}</td><td>{run.assignee || run.assignedPosition || '—'}</td><td>{run.rowsCount || 0}</td></tr>)}{submitted.length === 0 ? <tr><td colSpan={4}>Сданных инвентаризаций нет.</td></tr> : null}</tbody></table></div> : null}
      </main>

      <aside className="inventory-actions-panel"><div className="inventory-actions-panel__header"><h2>Действия</h2></div><ActionItem mode="addProduct" activeMode={actionMode} title="Добавить товар" text="Создать позицию вручную" icon={<BoxIcon />} onClick={() => setActionMode('addProduct')} /><ActionItem mode="assignInventory" activeMode={actionMode} title="Назначить" text="Отправить сотруднику" icon={<CalendarIcon />} onClick={() => setActionMode('assignInventory')} /><ActionItem mode="submittedRuns" activeMode={actionMode} title="Сданные" text="Скачать историю" icon={<ChevronRightIcon />} onClick={() => { setActionMode('submittedRuns'); setActiveTab('submitted') }} />
        <button type="button" className="inventory-iiko-btn" onClick={() => void openIikoImport()}>↓ Загрузить из iiko</button>
        {actionMode === 'addProduct' ? <div className="inventory-action-form"><label><span>Название</span><input value={productForm.name} onChange={(e) => setProductForm((v) => ({ ...v, name: e.target.value }))} placeholder="Например, Лимон" /></label><label><span>Единица</span><input value={productForm.unit} onChange={(e) => setProductForm((v) => ({ ...v, unit: e.target.value }))} placeholder="кг, шт, л" /></label><label><span>Категория</span><input value={productForm.category} onChange={(e) => setProductForm((v) => ({ ...v, category: e.target.value }))} placeholder="Овощи, алкоголь..." /></label><button type="button" onClick={() => void addProduct()}>Добавить товар</button></div> : null}
        {actionMode === 'assignInventory' ? <div className="inventory-action-form"><label><span>Бланк</span><input value={assignForm.template} onChange={(e) => setAssignForm((v) => ({ ...v, template: e.target.value }))} /></label><label><span>Кому</span><input value={assignForm.assignee} onChange={(e) => setAssignForm((v) => ({ ...v, assignee: e.target.value }))} /></label><label><span>Дата</span><input type="date" value={assignForm.date} onChange={(e) => setAssignForm((v) => ({ ...v, date: e.target.value }))} /></label><button type="button" onClick={() => void assignInventory()}>Назначить</button></div> : null}
      </aside>

      {/* iiko import modal */}
      {iikoOpen && (
        <div className="inv-iiko-backdrop" onMouseDown={() => !iikoImporting && setIikoOpen(false)}>
          <div className="inv-iiko-modal" onMouseDown={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="inv-iiko-modal__header">
              <div>
                <strong>Загрузка из iiko</strong>
                {!iikoLoading && !iikoError && <span>{iikoAllItems.length} позиций · выбрано {iikoCheckedTotal}</span>}
              </div>
              {!iikoImporting && <button type="button" className="inv-iiko-close" onClick={() => setIikoOpen(false)}>✕</button>}
            </div>

            {iikoLoading && <div className="inv-iiko-state">Подключаюсь к iiko...</div>}
            {iikoError && <div className="inv-iiko-state inv-iiko-state--error">⚠ {iikoError}<br /><small>Проверьте настройки в разделе «Интеграции»</small></div>}
            {iikoImporting && <div className="inv-iiko-state">Импортирую {iikoCheckedTotal} позиций...</div>}

            {!iikoLoading && !iikoError && !iikoImporting && (
              <>
                {/* Категории из iiko как вкладки */}
                <div className="inv-iiko-sec-tabs">
                  <button type="button" className={`inv-iiko-sec-tab${iikoActiveCat === 'all' ? ' is-active' : ''}`} onClick={() => setIikoActiveCat('all')}>
                    Все
                    {iikoCatCount('all') > 0 && <span className="inv-iiko-sec-tab__cnt">{iikoCatCount('all')}</span>}
                  </button>
                  {iikoCats.map((cat) => {
                    const cnt = iikoCatCount(cat)
                    return (
                      <button key={cat} type="button" className={`inv-iiko-sec-tab${iikoActiveCat === cat ? ' is-active' : ''}`} onClick={() => setIikoActiveCat(cat)}>
                        {cat}
                        {cnt > 0 && <span className="inv-iiko-sec-tab__cnt">{cnt}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Поиск + быстрое назначение всех видимых */}
                <div className="inv-iiko-controls">
                  <div className="inv-iiko-search">
                    <SearchIcon />
                    <input
                      placeholder="Поиск по названию..."
                      value={iikoSearch}
                      onChange={(e) => setIikoSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="inv-iiko-bulk">
                    <span>Все видимые ({iikoVisible.length}) →</span>
                    {sections.map((s) => (
                      <button key={s.id} type="button" className="inv-iiko-bulk-btn" onClick={() => iikoSelectAllVisible(s.id)}>{s.title}</button>
                    ))}
                    {iikoVisible.some(({ idx }) => iikoChecked.has(idx)) && (
                      <button type="button" className="inv-iiko-bulk-btn inv-iiko-bulk-btn--clear" onClick={iikoClearVisible}>✕</button>
                    )}
                  </div>
                </div>

                {/* Список */}
                <div className="inv-iiko-list-head">
                  <span>Название</span>
                  <span>Ед.</span>
                  <span>Склад</span>
                </div>

                <div className="inv-iiko-list">
                  {iikoVisible.length === 0 && <div className="inv-iiko-empty">Ничего не найдено</div>}
                  {iikoVisible.map(({ item, idx }) => {
                    const checkedSec = iikoChecked.get(idx)
                    const secColors: Record<SectionKey, string> = { bar: '#dbeafe', kitchen: '#dcfce7', household: '#fef9c3', dishes: '#fce7f3' }
                    return (
                      <div key={idx} className={`inv-iiko-row${checkedSec ? ' is-checked' : ''}`}>
                        <div className="inv-iiko-row__info">
                          <span className="inv-iiko-row__name">{item.name}</span>
                        </div>
                        <span className="inv-iiko-row__unit">{item.unit}</span>
                        <select
                          className="inv-iiko-row__sec"
                          value={checkedSec ?? ''}
                          onChange={(e) => iikoSetSec(idx, e.target.value as SectionKey | '')}
                          style={checkedSec ? { background: secColors[checkedSec], borderColor: secColors[checkedSec], fontWeight: 700 } : {}}
                        >
                          <option value="">— склад</option>
                          {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>

                <div className="inv-iiko-footer">
                  <button type="button" className="inv-iiko-cancel" onClick={() => setIikoOpen(false)}>Отмена</button>
                  <button type="button" className="inv-iiko-import" disabled={iikoCheckedTotal === 0} onClick={() => void doIikoImport()}>
                    Импортировать {iikoCheckedTotal} позиций
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
