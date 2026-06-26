import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'
import { useSession } from '../../app/providers/SessionProvider'

type MainTab = 'assign' | 'submitted' | 'nomenclature'
type SectionKey = 'bar' | 'kitchen' | 'household' | 'dishes'
type InventoryProduct = { id: string; name: string; unit: string; category: string; section: string; minBalance?: number; active?: boolean; updatedAt?: string }
type InvSubmission = { employeeId: string; employeeName: string; submittedAt: string }
type InventoryAssignment = { id: string; title?: string; template?: string; section: string; assignedPosition?: string; assignee?: string; assigneeId?: string; assignedBy?: string; dueDate?: string; date?: string; status: string; rowsCount?: number; results?: Record<string, number>; submittedAt?: string; submissions?: InvSubmission[] }
type MenuItem = { id: string; name: string; unit: string; category: string; price?: number; description?: string; output?: string; active?: boolean }
type NomSubTab = 'products' | 'menu'
type Employee = { id: string; name: string; position: string; status?: string }

const presetSectionNames: Record<SectionKey, string> = { bar: 'Бар', kitchen: 'Кухня', household: 'Хозтовары', dishes: 'Посуда' }
const presetSections: { id: SectionKey; title: string }[] = [
  { id: 'bar', title: 'Бар' },
  { id: 'kitchen', title: 'Кухня' },
  { id: 'household', title: 'Хозтовары' },
  { id: 'dishes', title: 'Посуда' },
]

function getSectionTitle(id: string): string {
  return presetSectionNames[id as SectionKey] || id
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function statusLabel(status: string) {
  if (status === 'submitted' || status === 'completed') return 'Завершена'
  if (status === 'assigned') return 'Назначена'
  return status || '—'
}

function downloadRevision(r: InventoryAssignment, products: InventoryProduct[]) {
  const date = r.dueDate || r.date || r.submittedAt?.slice(0, 10) || '—'
  const section = r.section || 'подразделение'
  const filename = `инвентаризация_${section}_${date}.csv`.replace(/[\s/\\:*?"<>|]/g, '_')
  const fmt = (iso?: string) => iso
    ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const rows: string[][] = [
    ['Бланк', r.title || r.template || '—'],
    ['Подразделение / Место', section],
    ['Назначил', r.assignedBy || '—'],
    ['Ответственный', r.assignee || r.assignedPosition || 'Всё подразделение'],
    ['Дата проведения', date],
    ['Статус', statusLabel(r.status)],
    ['Позиций', String(r.rowsCount || 0)],
    [],
  ]
  if (r.submissions && r.submissions.length > 0) {
    rows.push(['Кто сдал подсчёт', 'Время сдачи', ''])
    r.submissions.forEach(s => rows.push([s.employeeName, fmt(s.submittedAt), '']))
    rows.push([])
  }
  rows.push(['Позиция', 'Количество', 'Ед. изм.'])
  if (r.results && Object.keys(r.results).length > 0) {
    products.filter(p => r.results![p.id] !== undefined).forEach(p => {
      rows.push([p.name, String(r.results![p.id]), p.unit || ''])
    })
  } else {
    rows.push(['Данные не внесены', '', ''])
  }
  downloadCsv(filename, rows)
}

function detectSystemName(host: string): string {
  const h = host.toLowerCase()
  if (h.includes('iiko')) return 'iiko'
  if (h.includes('quickresto') || h.includes('syrve')) return 'Quick Resto'
  return ''
}

export function InventoryPage() {
  const { session } = useSession()
  const [tab, setTab] = useState<MainTab>('assign')
  const [intSystemName, setIntSystemName] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [customSections, setCustomSections] = useState<string[]>([])
  const [hiddenPresets, setHiddenPresets] = useState<SectionKey[]>([])
  const [renamedPresets, setRenamedPresets] = useState<Partial<Record<SectionKey, string>>>({})
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [editSectionName, setEditSectionName] = useState<string | null>(null)
  const [editSectionValue, setEditSectionValue] = useState('')
  const [docModal, setDocModal] = useState<InventoryAssignment | null>(null)

  useEffect(() => {
    fetch('/api/restaurant', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(r => {
        if (!r) return
        const host = r.iikoHost || r.qrHost || ''
        setIntSystemName(detectSystemName(host))
      })
      .catch(() => {})
  }, [])
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
  const [assignSection, setAssignSection] = useState<string>('bar')
  const [assignee, setAssignee] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10))
  const [assignTitle, setAssignTitle] = useState('Вечерняя инвентаризация')

  // ── Номенклатура (бланки по подразделениям) ──
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [nomQuery, setNomQuery] = useState('')
  const [nomBlank, setNomBlank] = useState<string>('bar')
  const [nomSubTab, setNomSubTab] = useState<NomSubTab>('products')
  const [menuQuery, setMenuQuery] = useState('')

  // Добавить / редактировать позицию справочника блюд
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('шт')
  const [editCategory, setEditCategory] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editOutput, setEditOutput] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  function openEdit(item?: MenuItem) {
    setEditTarget(item ?? null)
    setEditName(item?.name ?? '')
    setEditUnit(item?.unit ?? 'шт')
    setEditCategory(item?.category ?? '')
    setEditPrice(item?.price != null ? String(item.price) : '')
    setEditDesc(item?.description ?? '')
    setEditOutput(item?.output ?? '')
    setEditOpen(true)
  }

  async function doSaveEdit() {
    if (!editName.trim()) return
    setEditSaving(true)
    const payload = {
      name: editName.trim(), unit: editUnit.trim() || 'шт',
      category: editCategory.trim() || 'Без категории',
      price: editPrice ? parseFloat(editPrice) : undefined,
      description: editDesc.trim() || undefined,
      output: editOutput.trim() || undefined,
      active: true,
    }
    if (editTarget) {
      const updated = await api.update<MenuItem>('menu-items', editTarget.id, payload)
      setMenuItems(prev => prev.map(m => m.id === editTarget.id ? updated : m))
    } else {
      const created = await api.create<MenuItem>('menu-items', payload)
      setMenuItems(prev => [...prev, created])
    }
    setEditOpen(false); setEditSaving(false)
    showNotice(editTarget ? 'Позиция обновлена.' : 'Позиция добавлена.')
  }

  async function deleteMenuItem(id: string) {
    await api.update<MenuItem>('menu-items', id, { active: false })
    setMenuItems(prev => prev.filter(m => m.id !== id))
  }

  // iiko импорт для меню (отдельный от инвентарного)
  const [menuIikoOpen, setMenuIikoOpen] = useState(false)
  const [menuIikoLoading, setMenuIikoLoading] = useState(false)
  const [menuIikoError, setMenuIikoError] = useState('')
  const [menuIikoItems, setMenuIikoItems] = useState<{ name: string; unit: string; category: string }[]>([])
  const [menuIikoCat, setMenuIikoCat] = useState('all')
  const [menuIikoChecked, setMenuIikoChecked] = useState<Set<number>>(new Set())
  const [menuIikoSearch, setMenuIikoSearch] = useState('')
  const [menuIikoImporting, setMenuIikoImporting] = useState(false)

  async function openMenuIiko() {
    setMenuIikoOpen(true); setMenuIikoLoading(true); setMenuIikoError('')
    setMenuIikoItems([]); setMenuIikoChecked(new Set()); setMenuIikoSearch(''); setMenuIikoCat('all')
    try {
      const resp = await fetch('/api/iiko/inventory?filter=prepared', { credentials: 'include' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Ошибка загрузки')
      setMenuIikoItems(data.items)
    } catch (e) { setMenuIikoError(e instanceof Error ? e.message : 'Ошибка') }
    finally { setMenuIikoLoading(false) }
  }

  const menuIikoCats = useMemo(() =>
    Array.from(new Set(menuIikoItems.map(i => i.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))
  , [menuIikoItems])

  const menuIikoVisible = useMemo(() => {
    const q = menuIikoSearch.trim().toLowerCase()
    return menuIikoItems.map((item, idx) => ({ item, idx })).filter(({ item }) => {
      if (menuIikoCat !== 'all' && item.category !== menuIikoCat) return false
      if (q && !item.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [menuIikoItems, menuIikoSearch, menuIikoCat])

  const menuIikoAllChecked = menuIikoVisible.length > 0 && menuIikoVisible.every(({ idx }) => menuIikoChecked.has(idx))

  function menuIikoToggle(idx: number) {
    setMenuIikoChecked(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function menuIikoSelectAll(checked: boolean) {
    setMenuIikoChecked(prev => { const n = new Set(prev); menuIikoVisible.forEach(({ idx }) => checked ? n.add(idx) : n.delete(idx)); return n })
  }

  async function doMenuIikoImport() {
    setMenuIikoImporting(true)
    let count = 0
    for (const idx of menuIikoChecked) {
      const item = menuIikoItems[idx]
      if (!item) continue
      const created = await api.create<MenuItem>('menu-items', {
        name: item.name, unit: item.unit,
        category: item.category || 'Без категории',
        active: true,
      })
      setMenuItems(prev => [...prev, created])
      count++
    }
    setMenuIikoImporting(false); setMenuIikoOpen(false)
    showNotice(`Импортировано ${count} позиций из ${intSystemName || 'кассы'}.`)
  }

  // Добавить продукт вручную
  const [addProdOpen, setAddProdOpen] = useState(false)
  const [addProdName, setAddProdName] = useState('')
  const [addProdUnit, setAddProdUnit] = useState('шт')
  const [addProdCat, setAddProdCat] = useState('')
  const [addProdMin, setAddProdMin] = useState('')
  const [addProdSaving, setAddProdSaving] = useState(false)

  function openAddProduct() {
    setAddProdName(''); setAddProdUnit('шт'); setAddProdCat(''); setAddProdMin('')
    setAddProdOpen(true)
  }

  async function doAddProduct() {
    if (!addProdName.trim()) return
    setAddProdSaving(true)
    const created = await api.create<InventoryProduct>('inventory-products', {
      name: addProdName.trim(), unit: addProdUnit.trim() || 'шт',
      category: addProdCat.trim() || 'Без категории',
      section: getSectionTitle(nomBlank),
      minBalance: addProdMin ? parseFloat(addProdMin) : 0,
      active: true,
    })
    setProducts(prev => [...prev, created])
    setAddProdOpen(false); setAddProdSaving(false)
    showNotice('Продукт добавлен.')
  }

  // iiko import
  type IikoItem = { name: string; unit: string; category: string }
  const [iikoOpen, setIikoOpen] = useState(false)
  const [iikoLoading, setIikoLoading] = useState(false)
  const [iikoError, setIikoError] = useState('')
  const [iikoAllItems, setIikoAllItems] = useState<IikoItem[]>([])
  const [iikoActiveCat, setIikoActiveCat] = useState('all')
  const [iikoChecked, setIikoChecked] = useState<Set<number>>(new Set())
  const [iikoTargetSection, setIikoTargetSection] = useState<string>('bar')
  const [iikoSearch, setIikoSearch] = useState('')
  const [iikoImporting, setIikoImporting] = useState(false)

  const allSections = useMemo(() => [
    ...presetSections
      .filter(s => !hiddenPresets.includes(s.id))
      .map(s => ({ id: s.id, title: renamedPresets[s.id] ?? s.title })),
    ...customSections.map(name => ({ id: name, title: name })),
  ], [customSections, hiddenPresets, renamedPresets])

  useEffect(() => {
    void api.list<InventoryProduct>('inventory-products').then(r => setProducts(r.items.filter(p => p.active !== false)))
    void api.list<InventoryAssignment>('inventory-assignments').then(r => setAssignments(r.items))
    void api.list<MenuItem>('menu-items').then(r => setMenuItems(r.items.filter(m => m.active !== false)))
    void api.list<Employee>('employees').then(r => setEmployees((r.items as Employee[]).filter(e => e.status !== 'blocked' && e.status !== 'fired' && e.status !== 'deleted')))
  }, [])

  // Категории меню для фильтрации
  const menuCats = useMemo(() =>
    Array.from(new Set(menuItems.map(m => m.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))
  , [menuItems])

  const nomVisible = useMemo(() => {
    const q = nomQuery.trim().toLowerCase()
    const sectionTitle = getSectionTitle(nomBlank)
    return products.filter(p => {
      if (p.section !== sectionTitle && p.section !== nomBlank) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, nomQuery, nomBlank])

  // Назначить
  async function doAssign() {
    const sectionTitle = getSectionTitle(assignSection)
    const sectionProds = products.filter(p => p.section === sectionTitle || p.section === assignSection)
    const selectedEmp = employees.find(e => e.id === assigneeId)
    const created = await api.create<InventoryAssignment>('inventory-assignments', {
      title: assignTitle, template: assignTitle,
      section: sectionTitle,
      assignee: selectedEmp?.name || assignee.trim() || '',
      assigneeId: assigneeId || undefined,
      assignedPosition: selectedEmp?.position || '',
      assignedBy: session?.user?.name || '',
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

  async function deleteAssignment(id: string) {
    if (!window.confirm('Удалить эту инвентаризацию?')) return
    await api.remove('inventory-assignments', id)
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
  const active = assignments.filter(a => a.status !== 'completed' && a.status !== 'submitted')
  const submitted = assignments
    .filter(a => a.status === 'completed' || a.status === 'submitted' || (a.submissions && a.submissions.length > 0))
    .filter(a => {
      const ts = a.submittedAt || a.dueDate || a.date
      return !ts || new Date(ts).getTime() > threeMonthsAgo
    })
    .sort((a, b) => {
      const ta = new Date(a.submittedAt || a.dueDate || a.date || 0).getTime()
      const tb = new Date(b.submittedAt || b.dueDate || b.date || 0).getTime()
      return tb - ta
    })


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
    setIikoActiveCat('all'); setIikoTargetSection(nomBlank)
    try {
      const resp = await fetch('/api/iiko/inventory?filter=goods', { credentials: 'include' })
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
        name: item.name, unit: item.unit, category: item.category || 'Из кассы',
        section: getSectionTitle(iikoTargetSection), minBalance: 0, active: true,
      })
      setProducts(prev => [...prev, created])
      count++
    }
    setIikoImporting(false); setIikoOpen(false)
    showNotice(`Импортировано ${count} позиций из ${intSystemName || 'кассы'}.`)
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
          Список позиций
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
                  {allSections.map(s => {
                    const isCustom = customSections.includes(s.id)
                    return (
                      <span key={s.id} className="inv-section-btn-wrap">
                        <button type="button" className={`inv-section-btn${assignSection === s.id ? ' is-active' : ''}`} onClick={() => setAssignSection(s.id)}>{s.title}</button>
                        <button type="button" className="inv-section-inline-edit" title="Переименовать" onClick={() => { setEditSectionName(s.id); setEditSectionValue(s.title) }}>✎</button>
                        <button type="button" className="inv-section-inline-del" title="Удалить" onClick={() => { if (window.confirm(`Удалить группу «${s.title}»?`)) { if (isCustom) { setCustomSections(prev => prev.filter(n => n !== s.id)) } else { setHiddenPresets(prev => [...prev, s.id as SectionKey]) } if (assignSection === s.id) setAssignSection(allSections.find(x => x.id !== s.id)?.id ?? 'bar') } }}>✕</button>
                      </span>
                    )
                  })}
                  <button type="button" className="inv-section-btn inv-section-btn--add" onClick={() => { setNewSectionName(''); setAddSectionOpen(true) }}>+ Своя группа</button>
                </div>
              </label>

              <label className="inv-field">
                <span>Название бланка</span>
                <input value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="Вечерняя инвентаризация" />
              </label>

              <label className="inv-field">
                <span>Ответственный <em className="inv-field__opt">необязательно</em></span>
                <select value={assigneeId} onChange={e => { setAssigneeId(e.target.value); setAssignee('') }} className="inv-select">
                  <option value="">— Всё подразделение —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} · {emp.position}</option>)}
                </select>
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
                  <thead><tr><th>Бланк</th><th>Подразделение</th><th>Ответственный</th><th>Назначил</th><th>Дата</th><th>Позиций</th><th></th></tr></thead>
                  <tbody>
                    {submitted.map(r => (
                      <tr key={r.id} className="inv-table__row--clickable" onClick={() => setDocModal(r)}>
                        <td>{r.title || r.template || '—'}</td>
                        <td>{r.section}</td>
                        <td>{r.assignee || r.assignedPosition || <span className="inv-cell-dim">Всё подразделение</span>}</td>
                        <td>{r.assignedBy || <span className="inv-cell-dim">—</span>}</td>
                        <td>{r.dueDate || r.date || '—'}</td>
                        <td>{r.rowsCount || 0}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="inv-row-actions">
                            {r.results && Object.keys(r.results).length > 0 && (
                              <button type="button" className="inv-dl-btn" onClick={() => downloadRevision(r, products)} title="Скачать CSV">↓</button>
                            )}
                            <button type="button" className="inv-dl-btn inv-dl-btn--del" onClick={() => void deleteAssignment(r.id)} title="Удалить">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}

      {/* ── Номенклатура (бланки по подразделениям) ── */}
      {tab === 'nomenclature' && (
        <div className="inv-content">
          {/* Sub-tabs */}
          <div className="inv-nom-subtabs">
            <button type="button" className={`inv-nom-subtab${nomSubTab === 'products' ? ' is-active' : ''}`} onClick={() => setNomSubTab('products')}>
              Продукты и товары
              <span className="inv-tab__badge">{products.length}</span>
            </button>
            <button type="button" className={`inv-nom-subtab${nomSubTab === 'menu' ? ' is-active' : ''}`} onClick={() => setNomSubTab('menu')}>
              Справочник блюд
              <span className="inv-tab__badge">{menuItems.length}</span>
            </button>
          </div>

          {nomSubTab === 'menu' && (
            <div className="inv-card">
              <div className="inv-card__header">
                <h3>Справочник блюд <span className="inv-card__count">{menuItems.filter(m => !menuQuery || m.name.toLowerCase().includes(menuQuery.toLowerCase())).length} позиций</span></h3>
                <div className="inv-card__actions">
                  <button type="button" className="inv-add-btn" onClick={() => openEdit()}>+ Добавить</button>
                  {intSystemName && <button type="button" className="inv-iiko-load-btn" onClick={() => void openMenuIiko()}>↓ Из {intSystemName}</button>}
                </div>
              </div>
              <div className="inv-nom-filters">
                <div className="inv-nom-search"><SearchIcon /><input value={menuQuery} onChange={e => setMenuQuery(e.target.value)} placeholder="Поиск по названию..." /></div>
              </div>
              {menuItems.length === 0
                ? <p className="inv-empty">Справочник пуст. Добавьте блюда вручную{intSystemName ? ` или импортируйте из ${intSystemName}` : ''}.</p>
                : <table className="inv-table">
                    <thead><tr><th>Название</th><th>Категория</th><th>Ед.</th><th>Выход</th><th>Цена</th><th></th></tr></thead>
                    <tbody>
                      {menuItems
                        .filter(m => !menuQuery || m.name.toLowerCase().includes(menuQuery.toLowerCase()))
                        .map(m => (
                          <tr key={m.id}>
                            <td><strong>{m.name}</strong></td>
                            <td>{m.category || <span className="inv-cell-dim">—</span>}</td>
                            <td>{m.unit}</td>
                            <td>{m.output ? <span className="inv-output-badge">{m.output}</span> : <span className="inv-cell-dim">—</span>}</td>
                            <td>{m.price != null ? `${m.price} ₽` : <span className="inv-cell-dim">—</span>}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" className="inv-edit-btn" onClick={() => openEdit(m)}>✎</button>
                                <button type="button" className="inv-del-btn" onClick={() => void deleteMenuItem(m.id)}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
              }
            </div>
          )}

          {nomSubTab === 'products' && <>
          {/* Выбор подразделения */}
          <div className="inv-blanks">
            {allSections.map(s => {
              const isCustom = customSections.includes(s.id)
              const count = products.filter(p => p.section === s.title || p.section === s.id).length
              return (
                <div key={s.id} className={`inv-blank-btn inv-blank-btn--editable${nomBlank === s.id ? ' is-active' : ''}`}>
                  <button type="button" className="inv-blank-btn__main" onClick={() => setNomBlank(s.id)}>
                    <span className="inv-blank-btn__name">{s.title}</span>
                    <span className="inv-blank-btn__cnt">{count} позиций</span>
                  </button>
                  <div className="inv-blank-btn__actions">
                    <button type="button" title="Переименовать" onClick={e => { e.stopPropagation(); setEditSectionName(s.id); setEditSectionValue(s.title) }}>✎</button>
                    <button type="button" title="Удалить группу" onClick={e => { e.stopPropagation(); if (window.confirm(`Удалить группу «${s.title}»? Позиции останутся в базе.`)) { if (isCustom) { setCustomSections(prev => prev.filter(n => n !== s.id)) } else { setHiddenPresets(prev => [...prev, s.id as SectionKey]) } if (nomBlank === s.id) setNomBlank(allSections.find(x => x.id !== s.id)?.id ?? 'bar') } }}>✕</button>
                  </div>
                </div>
              )
            })}
            <button type="button" className="inv-blank-btn inv-blank-btn--add" onClick={() => { setNewSectionName(''); setAddSectionOpen(true) }}>
              <span className="inv-blank-btn__name">+ Своя группа</span>
            </button>
          </div>

          <div className="inv-card">
            <div className="inv-card__header">
              <h3>{getSectionTitle(nomBlank)} <span className="inv-card__count">{nomVisible.length} позиций</span></h3>
              <div className="inv-card__actions">
                <button type="button" className="inv-add-btn" onClick={() => openAddProduct()}>+ Добавить вручную</button>
                <button type="button" className="inv-iiko-load-btn" onClick={() => void openIikoImport()}>↓ Из {intSystemName || 'кассы'}</button>
              </div>
            </div>

            <div className="inv-nom-filters">
              <div className="inv-nom-search">
                <SearchIcon />
                <input value={nomQuery} onChange={e => setNomQuery(e.target.value)} placeholder="Поиск по названию..." />
              </div>
            </div>

            {nomVisible.length === 0
              ? <p className="inv-empty">
                  {products.filter(p => p.section === getSectionTitle(nomBlank) || p.section === nomBlank).length === 0
                    ? <>Бланк пуст. {intSystemName ? <>Добавьте товары из {intSystemName} или вручную.</> : <>Добавьте товары вручную.</>}</>
                    : <>Ничего не найдено</>}
                </p>
              : <table className="inv-table">
                  <thead>
                    <tr><th>Название</th><th>Ед.</th></tr>
                  </thead>
                  <tbody>
                    {nomVisible.map(p => (
                      <tr key={p.id}>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong>{p.name}</strong>
                            <button type="button" className="inv-del-btn" onClick={() => void deleteProduct(p.id)}>✕</button>
                          </span>
                        </td>
                        <td>{p.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
          </> }
        </div>
      )}

      {/* Редактировать / добавить позицию меню */}
      {editOpen && (
        <div className="inv-iiko-backdrop" onMouseDown={() => !editSaving && setEditOpen(false)}>
          <div className="inv-add-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="inv-add-modal__header">
              <strong>{editTarget ? 'Редактировать позицию' : 'Добавить позицию'}</strong>
              <button type="button" className="inv-iiko-close" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <div className="inv-add-modal__body">
              <label className="inv-field">
                <span>Название *</span>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Название блюда или товара" autoFocus />
              </label>
              <label className="inv-field">
                <span>Категория</span>
                <input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Например: Горячие блюда" list="edit-cats" />
                <datalist id="edit-cats">
                  {menuCats.map(c => <option key={c} value={c} />)}
                </datalist>
              </label>
              <div className="inv-add-row">
                <label className="inv-field">
                  <span>Единица измерения</span>
                  <input value={editUnit} onChange={e => setEditUnit(e.target.value)} placeholder="шт" />
                </label>
                <label className="inv-field">
                  <span>Выход готового блюда</span>
                  <input value={editOutput} onChange={e => setEditOutput(e.target.value)} placeholder="Например: 250 г / 300 мл" />
                </label>
              </div>
              <div className="inv-add-row">
                <label className="inv-field">
                  <span>Цена <em className="inv-field__opt">₽, необязательно</em></span>
                  <input type="number" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="0.00" />
                </label>
                <label className="inv-field">
                  <span>Описание <em className="inv-field__opt">необязательно</em></span>
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Краткое описание" />
                </label>
              </div>
            </div>
            <div className="inv-add-modal__footer">
              <button type="button" className="inv-iiko-cancel" onClick={() => setEditOpen(false)}>Отмена</button>
              <button type="button" className="inv-iiko-import" disabled={!editName.trim() || editSaving} onClick={() => void doSaveEdit()}>
                {editSaving ? 'Сохраняю...' : editTarget ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iiko импорт для меню (блюда PREPARED) */}
      {menuIikoOpen && (
        <div className="inv-iiko-backdrop" onMouseDown={() => !menuIikoImporting && setMenuIikoOpen(false)}>
          <div className="inv-iiko-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="inv-iiko-modal__header">
              <div>
                <strong>Меню из {intSystemName || 'кассы'}</strong>
                {!menuIikoLoading && !menuIikoError && <span>{menuIikoItems.length} блюд · выбрано {menuIikoChecked.size}</span>}
              </div>
              {!menuIikoImporting && <button type="button" className="inv-iiko-close" onClick={() => setMenuIikoOpen(false)}>✕</button>}
            </div>

            {menuIikoLoading && <div className="inv-iiko-state">Загружаю меню из {intSystemName || 'кассы'}...</div>}
            {menuIikoError && <div className="inv-iiko-state inv-iiko-state--error">⚠ {menuIikoError}<br /><small>Проверьте настройки в разделе «Интеграции»</small></div>}
            {menuIikoImporting && <div className="inv-iiko-state">Импортирую {menuIikoChecked.size} позиций...</div>}

            {!menuIikoLoading && !menuIikoError && !menuIikoImporting && (
              <>
                <div className="inv-iiko-sec-tabs">
                  <button type="button" className={`inv-iiko-sec-tab${menuIikoCat === 'all' ? ' is-active' : ''}`} onClick={() => setMenuIikoCat('all')}>
                    Все <span className="inv-iiko-sec-tab__cnt inv-iiko-sec-tab__cnt--gray">{menuIikoItems.length}</span>
                  </button>
                  {menuIikoCats.map(cat => (
                    <button key={cat} type="button" className={`inv-iiko-sec-tab${menuIikoCat === cat ? ' is-active' : ''}`} onClick={() => setMenuIikoCat(cat)}>{cat}</button>
                  ))}
                </div>

                <div className="inv-iiko-controls">
                  <div className="inv-iiko-search">
                    <SearchIcon />
                    <input placeholder="Поиск..." value={menuIikoSearch} onChange={e => setMenuIikoSearch(e.target.value)} autoFocus />
                  </div>
                  <label className="inv-iiko-selectall-label">
                    <input type="checkbox" checked={menuIikoAllChecked} onChange={e => menuIikoSelectAll(e.target.checked)} />
                    <span>Выбрать все ({menuIikoVisible.length})</span>
                  </label>
                </div>

                <div className="inv-iiko-list-head">
                  <span></span><span>Название</span><span>Ед.</span>
                </div>

                <div className="inv-iiko-list">
                  {menuIikoVisible.length === 0 && <div className="inv-iiko-empty">Ничего не найдено</div>}
                  {menuIikoVisible.map(({ item, idx }) => {
                    const checked = menuIikoChecked.has(idx)
                    return (
                      <label key={idx} className={`inv-iiko-row inv-iiko-row--check${checked ? ' is-checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => menuIikoToggle(idx)} />
                        <div className="inv-iiko-row__info">
                          <span className="inv-iiko-row__name">{item.name}</span>
                          {item.category && menuIikoCat === 'all' && <span className="inv-iiko-row__cat">{item.category}</span>}
                        </div>
                        <span className="inv-iiko-row__unit">{item.unit}</span>
                      </label>
                    )
                  })}
                </div>

                <div className="inv-iiko-footer">
                  <div className="inv-iiko-footer__actions">
                    <button type="button" className="inv-iiko-cancel" onClick={() => setMenuIikoOpen(false)}>Отмена</button>
                    <button type="button" className="inv-iiko-import" disabled={menuIikoChecked.size === 0} onClick={() => void doMenuIikoImport()}>
                      Импортировать {menuIikoChecked.size} позиций
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Добавить продукт вручную */}
      {addProdOpen && (
        <div className="inv-iiko-backdrop" onMouseDown={() => !addProdSaving && setAddProdOpen(false)}>
          <div className="inv-add-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="inv-add-modal__header">
              <strong>Добавить продукт в «{getSectionTitle(nomBlank)}»</strong>
              <button type="button" className="inv-iiko-close" onClick={() => setAddProdOpen(false)}>✕</button>
            </div>
            <div className="inv-add-modal__body">
              <label className="inv-field">
                <span>Название *</span>
                <input value={addProdName} onChange={e => setAddProdName(e.target.value)} placeholder="Например: Сыр Гауда" autoFocus />
              </label>
              <div className="inv-add-row">
                <label className="inv-field">
                  <span>Единица измерения</span>
                  <input value={addProdUnit} onChange={e => setAddProdUnit(e.target.value)} placeholder="шт" />
                </label>
                <label className="inv-field">
                  <span>Мин. остаток</span>
                  <input type="number" min="0" value={addProdMin} onChange={e => setAddProdMin(e.target.value)} placeholder="0" />
                </label>
              </div>
              <label className="inv-field">
                <span>Категория</span>
                <input value={addProdCat} onChange={e => setAddProdCat(e.target.value)} placeholder="Например: Молочка" />
              </label>
            </div>
            <div className="inv-add-modal__footer">
              <button type="button" className="inv-iiko-cancel" onClick={() => setAddProdOpen(false)}>Отмена</button>
              <button type="button" className="inv-iiko-import" disabled={!addProdName.trim() || addProdSaving} onClick={() => void doAddProduct()}>
                {addProdSaving ? 'Сохраняю...' : 'Добавить'}
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
                <strong>Загрузка из {intSystemName || 'кассы'}</strong>
                {!iikoLoading && !iikoError && <span>{iikoAllItems.length} позиций · выбрано {iikoCheckedTotal}</span>}
              </div>
              {!iikoImporting && <button type="button" className="inv-iiko-close" onClick={() => setIikoOpen(false)}>✕</button>}
            </div>

            {iikoLoading && <div className="inv-iiko-state">Загружаю товары из {intSystemName || 'кассы'}...</div>}
            {iikoError && <div className="inv-iiko-state inv-iiko-state--error">⚠ {iikoError}<br /><small>Проверьте настройки в разделе «Интеграции»</small></div>}
            {iikoImporting && <div className="inv-iiko-state">Импортирую {iikoCheckedTotal} позиций в «{getSectionTitle(iikoTargetSection)}»...</div>}

            {!iikoLoading && !iikoError && !iikoImporting && (
              <>
                {/* ШАГ 1: выбор бланка */}
                <div className="inv-iiko-target">
                  <span className="inv-iiko-target__label">Добавить в бланк:</span>
                  <div className="inv-iiko-target__btns">
                    {allSections.map(s => (
                      <button key={s.id} type="button"
                        className={`inv-iiko-target__btn${iikoTargetSection === s.id ? ' is-active' : ''}`}
                        onClick={() => setIikoTargetSection(s.id)}>{s.title}</button>
                    ))}
                  </div>
                </div>

                {/* ШАГ 2: группы из iiko */}
                <div className="inv-iiko-sec-tabs">
                  <button type="button" className={`inv-iiko-sec-tab${iikoActiveCat === 'all' ? ' is-active' : ''}`} onClick={() => setIikoActiveCat('all')}>
                    Все <span className="inv-iiko-sec-tab__cnt inv-iiko-sec-tab__cnt--gray">{iikoAllItems.length}</span>
                  </button>
                  {iikoCats.map(cat => (
                    <button key={cat} type="button" className={`inv-iiko-sec-tab${iikoActiveCat === cat ? ' is-active' : ''}`} onClick={() => setIikoActiveCat(cat)}>
                      {cat} <span className="inv-iiko-sec-tab__cnt">{iikoAllItems.filter(i => i.category === cat).length}</span>
                    </button>
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
                  <div className="inv-iiko-footer__actions">
                    <button type="button" className="inv-iiko-cancel" onClick={() => setIikoOpen(false)}>Отмена</button>
                    <button type="button" className="inv-iiko-import" disabled={iikoCheckedTotal === 0} onClick={() => void doIikoImport()}>
                      Добавить {iikoCheckedTotal > 0 ? `${iikoCheckedTotal} позиций` : ''} в «{getSectionTitle(iikoTargetSection)}»
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Переименовать группу */}
      {editSectionName !== null && (
        <div className="inv-iiko-backdrop" onMouseDown={() => setEditSectionName(null)}>
          <div className="inv-add-modal" style={{ maxWidth: 400 }} onMouseDown={e => e.stopPropagation()}>
            <div className="inv-add-modal__header">
              <strong>Переименовать группу</strong>
              <button type="button" className="inv-iiko-close" onClick={() => setEditSectionName(null)}>✕</button>
            </div>
            <div className="inv-add-modal__body">
              <label className="inv-field">
                <span>Новое название *</span>
                <input value={editSectionValue} onChange={e => setEditSectionValue(e.target.value)} autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && editSectionValue.trim() && editSectionName !== null) {
                      const sectionId = editSectionName
                      const newName = editSectionValue.trim()
                      const isCustom = customSections.includes(sectionId)
                      if (isCustom) {
                        setCustomSections(prev => prev.map(n => n === sectionId ? newName : n))
                        setProducts(prev => prev.map(p => p.section === sectionId ? { ...p, section: newName } : p))
                        if (nomBlank === sectionId) setNomBlank(newName)
                        if (assignSection === sectionId) setAssignSection(newName)
                      } else {
                        setRenamedPresets(prev => ({ ...prev, [sectionId]: newName }))
                      }
                      setEditSectionName(null)
                    }
                  }}
                />
              </label>
            </div>
            <div className="inv-add-modal__footer">
              <button type="button" className="inv-iiko-cancel" onClick={() => setEditSectionName(null)}>Отмена</button>
              <button type="button" className="inv-iiko-import" disabled={!editSectionValue.trim()} onClick={() => {
                const sectionId = editSectionName!
                const newName = editSectionValue.trim()
                const isCustom = customSections.includes(sectionId)
                if (isCustom) {
                  setCustomSections(prev => prev.map(n => n === sectionId ? newName : n))
                  setProducts(prev => prev.map(p => p.section === sectionId ? { ...p, section: newName } : p))
                  if (nomBlank === sectionId) setNomBlank(newName)
                  if (assignSection === sectionId) setAssignSection(newName)
                } else {
                  setRenamedPresets(prev => ({ ...prev, [sectionId]: newName }))
                }
                setEditSectionName(null)
              }}>
                Переименовать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Создать свою группу */}
      {addSectionOpen && (
        <div className="inv-iiko-backdrop" onMouseDown={() => setAddSectionOpen(false)}>
          <div className="inv-add-modal" style={{ maxWidth: 400 }} onMouseDown={e => e.stopPropagation()}>
            <div className="inv-add-modal__header">
              <strong>Своя группа инвентаризации</strong>
              <button type="button" className="inv-iiko-close" onClick={() => setAddSectionOpen(false)}>✕</button>
            </div>
            <div className="inv-add-modal__body">
              <label className="inv-field">
                <span>Название группы *</span>
                <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Например: Терраса, Склад, Выборочная" autoFocus onKeyDown={e => { if (e.key === 'Enter' && newSectionName.trim()) { setCustomSections(prev => [...prev, newSectionName.trim()]); setAssignSection(newSectionName.trim()); setAddSectionOpen(false) } }} />
              </label>
            </div>
            <div className="inv-add-modal__footer">
              <button type="button" className="inv-iiko-cancel" onClick={() => setAddSectionOpen(false)}>Отмена</button>
              <button type="button" className="inv-iiko-import" disabled={!newSectionName.trim()} onClick={() => { setCustomSections(prev => [...prev, newSectionName.trim()]); setAssignSection(newSectionName.trim()); setAddSectionOpen(false) }}>
                Создать группу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Документ инвентаризации */}
      {docModal && (
        <div className="inv-iiko-backdrop" onMouseDown={() => setDocModal(null)}>
          <div className="inv-doc-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="inv-doc-modal__header">
              <div>
                <strong>Инвентаризация</strong>
                <span>{docModal.section}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {docModal.results && Object.keys(docModal.results).length > 0 && (
                  <button type="button" className="inv-csv-btn" onClick={() => downloadRevision(docModal, products)}>↓ CSV</button>
                )}
                <button type="button" className="inv-iiko-close" onClick={() => setDocModal(null)}>✕</button>
              </div>
            </div>
            <div className="inv-doc-modal__meta">
              <div className="inv-doc-meta-row"><span>Дата</span><strong>{docModal.dueDate || docModal.date || '—'}</strong></div>
              <div className="inv-doc-meta-row"><span>Зона / Подразделение</span><strong>{docModal.section}</strong></div>
              <div className="inv-doc-meta-row"><span>Назначил</span><strong>{docModal.assignedBy || '—'}</strong></div>
              <div className="inv-doc-meta-row"><span>Ответственный</span><strong>{docModal.assignee || docModal.assignedPosition || 'Всё подразделение'}</strong></div>
              <div className="inv-doc-meta-row"><span>Бланк</span><strong>{docModal.title || docModal.template || '—'}</strong></div>
              <div className="inv-doc-meta-row"><span>Позиций</span><strong>{docModal.rowsCount || 0}</strong></div>
              <div className="inv-doc-meta-row"><span>Статус</span><strong>{statusLabel(docModal.status)}</strong></div>
            </div>
            {docModal.submissions && docModal.submissions.length > 0 && (
              <div className="inv-doc-modal__results">
                <h4>Сдали подсчёт</h4>
                <table className="inv-table">
                  <thead><tr><th>Сотрудник</th><th>Время</th></tr></thead>
                  <tbody>
                    {docModal.submissions.map((s, i) => (
                      <tr key={i}>
                        <td>{s.employeeName}</td>
                        <td>{new Date(s.submittedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {docModal.results && Object.keys(docModal.results).length > 0 && (
              <div className="inv-doc-modal__results">
                <h4>Результаты подсчёта</h4>
                <table className="inv-table">
                  <thead><tr><th>Позиция</th><th>Количество</th><th>Ед.</th></tr></thead>
                  <tbody>
                    {products
                      .filter(p => docModal.results![p.id] !== undefined)
                      .map(p => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{docModal.results![p.id]}</td>
                          <td>{p.unit}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
