import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type MainTab = 'assign' | 'submitted' | 'nomenclature'
type SectionKey = 'bar' | 'kitchen' | 'household' | 'dishes'
type InventoryProduct = { id: string; name: string; unit: string; category: string; section: string; minBalance?: number; active?: boolean; updatedAt?: string }
type InventoryAssignment = { id: string; title?: string; template?: string; section: string; assignedPosition?: string; assignee?: string; dueDate?: string; date?: string; status: string; rowsCount?: number }

const sectionNames: Record<SectionKey, string> = { bar: 'Бар', kitchen: 'Кухня', household: 'Хозтовары', dishes: 'Посуда' }
const sections: { id: SectionKey; title: string }[] = [
  { id: 'bar', title: 'Бар' },
  { id: 'kitchen', title: 'Кухня' },
  { id: 'household', title: 'Хозтовары' },
  { id: 'dishes', title: 'Посуда' },
]

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function InventoryPage() {
  const [tab, setTab] = useState<MainTab>('assign')
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [assignments, setAssignments] = useState<InventoryAssignment[]>([])
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showNotice(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 3000)
  }

  // Назначить инвентаризацию
  const [assignSection, setAssignSection] = useState<SectionKey>('bar')
  const [assignee, setAssignee] = useState('')
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10))
  const [assignTitle, setAssignTitle] = useState('Вечерняя инвентаризация')

  // Номенклатура
  const [nomQuery, setNomQuery] = useState('')
  const [nomSection, setNomSection] = useState<SectionKey | 'all'>('all')

  // Добавить товар вручную
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addUnit, setAddUnit] = useState('шт')
  const [addCategory, setAddCategory] = useState('')
  const [addSection, setAddSection] = useState<SectionKey>('bar')
  const [addSaving, setAddSaving] = useState(false)

  async function doAddProduct() {
    if (!addName.trim()) return
    setAddSaving(true)
    const created = await api.create<InventoryProduct>('inventory-products', {
      name: addName.trim(), unit: addUnit.trim() || 'шт',
      category: addCategory.trim() || 'Без категории',
      section: sectionNames[addSection], minBalance: 0, active: true,
    })
    setProducts(prev => [...prev, created])
    setAddOpen(false); setAddName(''); setAddUnit('шт'); setAddCategory('')
    setAddSaving(false)
    showNotice('Товар добавлен.')
  }

  // iiko import
  type IikoItem = { name: string; unit: string; category: string }
  const [iikoOpen, setIikoOpen] = useState(false)
  const [iikoLoading, setIikoLoading] = useState(false)
  const [iikoError, setIikoError] = useState('')
  const [iikoAllItems, setIikoAllItems] = useState<IikoItem[]>([])
  const [iikoActiveCat, setIikoActiveCat] = useState('all')
  const [iikoChecked, setIikoChecked] = useState<Set<number>>(new Set())
  const [iikoTargetSection, setIikoTargetSection] = useState<SectionKey>('bar')
  const [iikoSearch, setIikoSearch] = useState('')
  const [iikoImporting, setIikoImporting] = useState(false)

  useEffect(() => {
    void api.list<InventoryProduct>('inventory-products').then(r => setProducts(r.items.filter(p => p.active !== false)))
    void api.list<InventoryAssignment>('inventory-assignments').then(r => setAssignments(r.items))
  }, [])

  // Назначить
  async function doAssign() {
    const sectionProds = products.filter(p => (p.section === sectionNames[assignSection] || p.section === assignSection))
    const created = await api.create<InventoryAssignment>('inventory-assignments', {
      title: assignTitle, template: assignTitle,
      section: sectionNames[assignSection],
      assignee: assignee.trim(), assignedPosition: assignee.trim(),
      dueDate: assignDate, date: assignDate,
      status: 'assigned', rowsCount: sectionProds.length,
    })
    setAssignments(prev => [created, ...prev])
    showNotice('Инвентаризация назначена.')
  }

  async function completeAssignment(id: string) {
    const updated = await api.update<InventoryAssignment>('inventory-assignments', id, { status: 'completed' })
    setAssignments(prev => prev.map(a => a.id === id ? updated : a))
  }

  const active = assignments.filter(a => a.status !== 'completed' && a.status !== 'submitted')
  const submitted = assignments.filter(a => a.status === 'completed' || a.status === 'submitted')

  // Номенклатура
  const nomProducts = useMemo(() => {
    const q = nomQuery.trim().toLowerCase()
    return products.filter(p => {
      if (nomSection !== 'all') {
        const sec = p.section === sectionNames[nomSection] || p.section === nomSection
        if (!sec) return false
      }
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, nomQuery, nomSection])

  async function deleteProduct(id: string) {
    await api.update<InventoryProduct>('inventory-products', id, { active: false })
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  // iiko
  const iikoCats = useMemo(() =>
    Array.from(new Set(iikoAllItems.map(i => i.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))
  , [iikoAllItems])

  const iikoVisible = useMemo(() => {
    const q = iikoSearch.trim().toLowerCase()
    return iikoAllItems.map((item, idx) => ({ item, idx })).filter(({ item }) => {
      if (iikoActiveCat !== 'all' && item.category !== iikoActiveCat) return false
      if (q && !item.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [iikoAllItems, iikoSearch, iikoActiveCat])

  const iikoCheckedTotal = iikoChecked.size
  const iikoAllVisibleChecked = iikoVisible.length > 0 && iikoVisible.every(({ idx }) => iikoChecked.has(idx))

  async function openIikoImport() {
    setIikoOpen(true); setIikoLoading(true); setIikoError('')
    setIikoAllItems([]); setIikoChecked(new Set()); setIikoSearch('')
    setIikoActiveCat('all'); setIikoTargetSection('bar')
    try {
      const resp = await fetch('/api/iiko/inventory', { credentials: 'include' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Ошибка загрузки')
      setIikoAllItems(data.items as IikoItem[])
    } catch (e) { setIikoError(e instanceof Error ? e.message : 'Ошибка') }
    finally { setIikoLoading(false) }
  }

  function iikoToggle(idx: number) {
    setIikoChecked(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function iikoSelectAll(checked: boolean) {
    setIikoChecked(prev => { const n = new Set(prev); iikoVisible.forEach(({ idx }) => checked ? n.add(idx) : n.delete(idx)); return n })
  }

  async function doIikoImport() {
    setIikoImporting(true)
    let count = 0
    for (const idx of iikoChecked) {
      const item = iikoAllItems[idx]
      if (!item) continue
      const created = await api.create<InventoryProduct>('inventory-products', {
        name: item.name, unit: item.unit, category: item.category || 'Из iiko',
        section: sectionNames[iikoTargetSection], minBalance: 0, active: true,
      })
      setProducts(prev => [...prev, created])
      count++
    }
    setIikoImporting(false); setIikoOpen(false)
    showNotice(`Импортировано ${count} позиций из iiko.`)
  }

  return (
    <section className="inv-page">
      {notice && <div className="inv-notice">{notice}</div>}

      {/* Три вкладки */}
      <div className="inv-tabs">
        <button type="button" className={`inv-tab${tab === 'assign' ? ' is-active' : ''}`} onClick={() => setTab('assign')}>
          Назначить инвентаризацию
          {active.length > 0 && <span className="inv-tab__badge">{active.length}</span>}
        </button>
        <button type="button" className={`inv-tab${tab === 'submitted' ? ' is-active' : ''}`} onClick={() => setTab('submitted')}>
          Сданные инвентаризации
          {submitted.length > 0 && <span className="inv-tab__badge">{submitted.length}</span>}
        </button>
        <button type="button" className={`inv-tab${tab === 'nomenclature' ? ' is-active' : ''}`} onClick={() => setTab('nomenclature')}>
          Номенклатура
          {products.length > 0 && <span className="inv-tab__badge">{products.length}</span>}
        </button>
      </div>

      {/* ── Назначить инвентаризацию ── */}
      {tab === 'assign' && (
        <div className="inv-content">
          <div className="inv-assign-layout">
            {/* Форма */}
            <div className="inv-assign-form-card">
              <h3>Новая инвентаризация</h3>

              <label className="inv-field">
                <span>Подразделение</span>
                <div className="inv-section-btns">
                  {sections.map(s => (
                    <button key={s.id} type="button"
                      className={`inv-section-btn${assignSection === s.id ? ' is-active' : ''}`}
                      onClick={() => setAssignSection(s.id)}>{s.title}</button>
                  ))}
                </div>
              </label>

              <label className="inv-field">
                <span>Название бланка</span>
                <input value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="Вечерняя инвентаризация" />
              </label>

              <label className="inv-field">
                <span>Ответственный <em className="inv-field__opt">необязательно</em></span>
                <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Конкретный сотрудник или оставьте пустым" />
              </label>

              <label className="inv-field">
                <span>Дата</span>
                <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} />
              </label>

              <button type="button" className="inv-submit-btn" onClick={() => void doAssign()}>
                Назначить инвентаризацию
              </button>
            </div>

            {/* Активные */}
            <div className="inv-assign-list-card">
              <h3>Активные <span>{active.length}</span></h3>
              {active.length === 0
                ? <p className="inv-empty">Нет активных инвентаризаций</p>
                : <table className="inv-table">
                    <thead><tr><th>Бланк</th><th>Подразделение</th><th>Ответственный</th><th>Дата</th><th></th></tr></thead>
                    <tbody>
                      {active.map(a => (
                        <tr key={a.id}>
                          <td>{a.title || a.template || '—'}</td>
                          <td>{a.section}</td>
                          <td>{a.assignee || a.assignedPosition || <span className="inv-cell-dim">Всё подразделение</span>}</td>
                          <td>{a.dueDate || a.date || '—'}</td>
                          <td><button type="button" className="inv-done-btn" onClick={() => void completeAssignment(a.id)}>Сдано</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Сданные ── */}
      {tab === 'submitted' && (
        <div className="inv-content">
          <div className="inv-card">
            <div className="inv-card__header">
              <h3>Сданные инвентаризации</h3>
              {submitted.length > 0 && (
                <button type="button" className="inv-csv-btn" onClick={() => downloadCsv('inventories.csv', [
                  ['Бланк', 'Подразделение', 'Сотрудник', 'Дата', 'Позиций'],
                  ...submitted.map(r => [r.title || r.template || '—', r.section, r.assignee || r.assignedPosition || '—', r.dueDate || r.date || '—', String(r.rowsCount || 0)])
                ])}>Скачать CSV</button>
              )}
            </div>
            {submitted.length === 0
              ? <p className="inv-empty">Сданных инвентаризаций пока нет</p>
              : <table className="inv-table">
                  <thead><tr><th>Бланк</th><th>Подразделение</th><th>Сотрудник</th><th>Дата</th><th>Позиций</th></tr></thead>
                  <tbody>
                    {submitted.map(r => (
                      <tr key={r.id}>
                        <td>{r.title || r.template || '—'}</td>
                        <td>{r.section}</td>
                        <td>{r.assignee || r.assignedPosition || '—'}</td>
                        <td>{r.dueDate || r.date || '—'}</td>
                        <td>{r.rowsCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}

      {/* ── Номенклатура ── */}
      {tab === 'nomenclature' && (
        <div className="inv-content">
          <div className="inv-card">
            <div className="inv-card__header">
              <h3>Номенклатура <span className="inv-card__count">{nomProducts.length}</span></h3>
              <div className="inv-card__actions">
                <button type="button" className="inv-add-btn" onClick={() => setAddOpen(true)}>+ Добавить товар</button>
                <button type="button" className="inv-iiko-load-btn" onClick={() => void openIikoImport()}>↓ Загрузить из iiko</button>
              </div>
            </div>

            <div className="inv-nom-filters">
              <div className="inv-nom-search">
                <SearchIcon />
                <input value={nomQuery} onChange={e => setNomQuery(e.target.value)} placeholder="Поиск по названию..." />
              </div>
              <div className="inv-section-btns">
                <button type="button" className={`inv-section-btn${nomSection === 'all' ? ' is-active' : ''}`} onClick={() => setNomSection('all')}>Все</button>
                {sections.map(s => (
                  <button key={s.id} type="button"
                    className={`inv-section-btn${nomSection === s.id ? ' is-active' : ''}`}
                    onClick={() => setNomSection(s.id)}>{s.title}</button>
                ))}
              </div>
            </div>

            {nomProducts.length === 0
              ? <p className="inv-empty">Позиций не найдено</p>
              : <table className="inv-table">
                  <thead><tr><th>Название</th><th>Ед.</th><th>Категория</th><th>Подразделение</th><th></th></tr></thead>
                  <tbody>
                    {nomProducts.map(p => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.unit}</td>
                        <td>{p.category}</td>
                        <td>{p.section}</td>
                        <td><button type="button" className="inv-del-btn" onClick={() => void deleteProduct(p.id)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}

      {/* Добавить товар вручную */}
      {addOpen && (
        <div className="inv-iiko-backdrop" onMouseDown={() => !addSaving && setAddOpen(false)}>
          <div className="inv-add-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="inv-add-modal__header">
              <strong>Добавить товар</strong>
              <button type="button" className="inv-iiko-close" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <div className="inv-add-modal__body">
              <label className="inv-field">
                <span>Название *</span>
                <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Название товара" autoFocus />
              </label>
              <div className="inv-add-row">
                <label className="inv-field">
                  <span>Единица измерения</span>
                  <input value={addUnit} onChange={e => setAddUnit(e.target.value)} placeholder="шт" />
                </label>
                <label className="inv-field">
                  <span>Категория</span>
                  <input value={addCategory} onChange={e => setAddCategory(e.target.value)} placeholder="Например: Алкоголь" />
                </label>
              </div>
              <label className="inv-field">
                <span>Подразделение</span>
                <div className="inv-section-btns">
                  {sections.map(s => (
                    <button key={s.id} type="button"
                      className={`inv-section-btn${addSection === s.id ? ' is-active' : ''}`}
                      onClick={() => setAddSection(s.id)}>{s.title}</button>
                  ))}
                </div>
              </label>
            </div>
            <div className="inv-add-modal__footer">
              <button type="button" className="inv-iiko-cancel" onClick={() => setAddOpen(false)}>Отмена</button>
              <button type="button" className="inv-iiko-import" disabled={!addName.trim() || addSaving} onClick={() => void doAddProduct()}>
                {addSaving ? 'Сохраняю...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iiko import modal */}
      {iikoOpen && (
        <div className="inv-iiko-backdrop" onMouseDown={() => !iikoImporting && setIikoOpen(false)}>
          <div className="inv-iiko-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="inv-iiko-modal__header">
              <div>
                <strong>Загрузка из iiko</strong>
                {!iikoLoading && !iikoError && <span>{iikoAllItems.length} позиций · выбрано {iikoCheckedTotal}</span>}
              </div>
              {!iikoImporting && <button type="button" className="inv-iiko-close" onClick={() => setIikoOpen(false)}>✕</button>}
            </div>

            {iikoLoading && <div className="inv-iiko-state">Загружаю товары из iiko...</div>}
            {iikoError && <div className="inv-iiko-state inv-iiko-state--error">⚠ {iikoError}<br /><small>Проверьте настройки в разделе «Интеграции»</small></div>}
            {iikoImporting && <div className="inv-iiko-state">Импортирую {iikoCheckedTotal} позиций...</div>}

            {!iikoLoading && !iikoError && !iikoImporting && (
              <>
                <div className="inv-iiko-sec-tabs">
                  <button type="button" className={`inv-iiko-sec-tab${iikoActiveCat === 'all' ? ' is-active' : ''}`} onClick={() => setIikoActiveCat('all')}>
                    Все <span className="inv-iiko-sec-tab__cnt inv-iiko-sec-tab__cnt--gray">{iikoAllItems.length}</span>
                  </button>
                  {iikoCats.map(cat => (
                    <button key={cat} type="button" className={`inv-iiko-sec-tab${iikoActiveCat === cat ? ' is-active' : ''}`} onClick={() => setIikoActiveCat(cat)}>{cat}</button>
                  ))}
                </div>

                <div className="inv-iiko-controls">
                  <div className="inv-iiko-search">
                    <SearchIcon />
                    <input placeholder="Поиск..." value={iikoSearch} onChange={e => setIikoSearch(e.target.value)} autoFocus />
                  </div>
                  <label className="inv-iiko-selectall-label">
                    <input type="checkbox" checked={iikoAllVisibleChecked} onChange={e => iikoSelectAll(e.target.checked)} />
                    <span>Выбрать все ({iikoVisible.length})</span>
                  </label>
                </div>

                <div className="inv-iiko-list-head">
                  <span></span><span>Название</span><span>Ед.</span>
                </div>

                <div className="inv-iiko-list">
                  {iikoVisible.length === 0 && <div className="inv-iiko-empty">Ничего не найдено</div>}
                  {iikoVisible.map(({ item, idx }) => {
                    const checked = iikoChecked.has(idx)
                    return (
                      <label key={idx} className={`inv-iiko-row inv-iiko-row--check${checked ? ' is-checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => iikoToggle(idx)} />
                        <div className="inv-iiko-row__info">
                          <span className="inv-iiko-row__name">{item.name}</span>
                          {item.category && iikoActiveCat === 'all' && <span className="inv-iiko-row__cat">{item.category}</span>}
                        </div>
                        <span className="inv-iiko-row__unit">{item.unit}</span>
                      </label>
                    )
                  })}
                </div>

                <div className="inv-iiko-footer">
                  <div className="inv-iiko-footer__section">
                    <span>Подразделение:</span>
                    <div className="inv-iiko-section-btns">
                      {sections.map(s => (
                        <button key={s.id} type="button"
                          className={`inv-iiko-section-btn${iikoTargetSection === s.id ? ' is-active' : ''}`}
                          onClick={() => setIikoTargetSection(s.id)}>{s.title}</button>
                      ))}
                    </div>
                  </div>
                  <div className="inv-iiko-footer__actions">
                    <button type="button" className="inv-iiko-cancel" onClick={() => setIikoOpen(false)}>Отмена</button>
                    <button type="button" className="inv-iiko-import" disabled={iikoCheckedTotal === 0} onClick={() => void doIikoImport()}>
                      Импортировать {iikoCheckedTotal} позиций
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
