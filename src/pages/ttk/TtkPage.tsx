import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { BookIcon, PlusIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type RecipeLine = { ingredient: string; amount?: string; quantity?: string }

type TtkItem = {
  id: string
  group?: string
  groupId?: string
  photoLabel?: string
  photoUrl?: string
  name: string
  unit: string
  price: number
  tag?: string
  description?: string
  recipe?: RecipeLine[]
  cookingTime?: number | string
  output?: string
  additions?: string
  additives?: string
  pairs?: string
  pairings?: string
  gastroPairs?: string[]
  extras?: string
  kbju?: { kcal?: number; protein?: number; proteins?: number; fat?: number; fats?: number; carbs?: number }
  kcal?: number
  proteins?: number
  fats?: number
  carbs?: number
  takeaway?: boolean
  online?: boolean
  discounts?: boolean
  marked?: boolean
  requiresScan?: boolean
  excise?: boolean
}

type TtkGroup = { id: string; name: string }

function getItemGroup(item: TtkItem) { return item.group || item.groupId || '' }
function getKcal(item: TtkItem) { return item.kbju?.kcal ?? item.kcal ?? 0 }
function getProtein(item: TtkItem) { return item.kbju?.protein ?? item.kbju?.proteins ?? item.proteins ?? 0 }
function getFat(item: TtkItem) { return item.kbju?.fat ?? item.kbju?.fats ?? item.fats ?? 0 }
function getCarbs(item: TtkItem) { return item.kbju?.carbs ?? item.carbs ?? 0 }

export function TtkPage() {
  const [items, setItems] = useState<TtkItem[]>([])
  const [extraGroups, setExtraGroups] = useState<TtkGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showNotice(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => showNotice(''), 3000)
  }
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateSelected({ photoUrl: reader.result as string })
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const [refOpen, setRefOpen] = useState(false)
  const [refUnits, setRefUnits] = useState<string[]>(['шт', 'кг', 'г', 'л', 'мл', 'порц', 'уп'])
  const [refTags, setRefTags] = useState<string[]>(['Завтрак', 'Обед', 'Ужин', 'Веган', 'Острое', 'Алкоголь', 'Десерт'])
  const [newUnit, setNewUnit] = useState('')
  const [newTag, setNewTag] = useState('')

  // iiko sync
  const [iikoModalStep, setIikoModalStep] = useState<'closed' | 'settings' | 'preview' | 'importing'>('closed')
  const [iikoHost, setIikoHost] = useState('')
  const [iikoLogin, setIikoLogin] = useState('')
  const [iikoPassword, setIikoPassword] = useState('')
  const [iikoConnecting, setIikoConnecting] = useState(false)
  const [iikoError, setIikoError] = useState('')
  const [iikoPreviewItems, setIikoPreviewItems] = useState<{ name: string; unit: string; price: number; group: string }[]>([])
  const [iikoSelectedGroups, setIikoSelectedGroups] = useState<Set<string>>(new Set())
  const [editModalOpen, setEditModalOpen] = useState(false)

  async function loadItems() {
    const result = await api.list<TtkItem>('ttk')
    setItems(result.items)
    if (result.items[0]) {
      const firstGroup = getItemGroup(result.items[0])
      setSelectedGroupId((cur) => cur || firstGroup)
      setSelectedItemId((cur) => cur || result.items[0].id)
    }
  }

  useEffect(() => { void loadItems() }, [])

  useEffect(() => {
    if (addingGroup) newGroupInputRef.current?.focus()
  }, [addingGroup])

  const groups: TtkGroup[] = useMemo(() => {
    const seen = new Set<string>()
    const result: TtkGroup[] = []
    for (const item of items) {
      const g = getItemGroup(item)
      if (g && !seen.has(g)) { seen.add(g); result.push({ id: g, name: g }) }
    }
    for (const eg of extraGroups) {
      if (!seen.has(eg.id)) { seen.add(eg.id); result.push(eg) }
    }
    return result
  }, [items, extraGroups])

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0]
  const filteredItems = useMemo(() => {
    if (!selectedGroupId && groups.length) return []
    const normalized = query.trim().toLowerCase()
    return items.filter((item) => getItemGroup(item) === selectedGroupId && (!normalized || item.name.toLowerCase().includes(normalized) || String(item.tag || '').toLowerCase().includes(normalized) || String(item.description || '').toLowerCase().includes(normalized)))
  }, [items, query, selectedGroupId, groups])
  const selectedItem = items.find((item) => item.id === selectedItemId) || filteredItems[0]


  function confirmAddGroup() {
    const name = newGroupName.trim()
    if (!name) { setAddingGroup(false); setNewGroupName(''); return }
    setExtraGroups((cur) => [...cur, { id: name, name }])
    setSelectedGroupId(name)
    setSelectedItemId('')
    setAddingGroup(false)
    setNewGroupName('')
  }

  async function createItem() {
    if (!selectedGroupId) return
    const created = await api.create<TtkItem>('ttk', { name: 'Новая позиция', group: selectedGroupId, unit: 'шт', price: 0, tag: '', description: '', recipe: [], cookingTime: '0 мин', output: '', takeaway: true, online: true, discounts: true, marked: false, requiresScan: false, excise: false })
    setItems((current) => [created, ...current])
    setSelectedItemId(created.id)
    showNotice('Позиция создана.')
  }

  async function saveSelected() {
    if (!selectedItem) return
    const saved = await api.update<TtkItem>('ttk', selectedItem.id, selectedItem)
    setItems((current) => current.map((item) => item.id === saved.id ? saved : item))
    showNotice('Карточка сохранена.')
  }

  function updateSelected(patch: Partial<TtkItem>) {
    if (!selectedItem) return
    setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, ...patch } : item))
  }

  async function deleteItem() {
    if (!selectedItem) return
    if (!window.confirm(`Удалить «${selectedItem.name}»?`)) return
    await api.remove('ttk', selectedItem.id)
    const next = items.filter((item) => item.id !== selectedItem.id)
    setItems(next)
    setSelectedItemId(next.find((item) => getItemGroup(item) === selectedGroupId)?.id || '')
    showNotice('Позиция удалена.')
  }

  async function deleteGroup() {
    if (!selectedGroupId) return
    const groupItems = items.filter((item) => getItemGroup(item) === selectedGroupId)
    if (!window.confirm(`Удалить группу «${selectedGroup?.name}» и все ${groupItems.length} позиций в ней?`)) return
    try {
      for (const item of groupItems) {
        await api.remove('ttk', item.id)
      }
      const nextItems = items.filter((item) => getItemGroup(item) !== selectedGroupId)
      setItems(nextItems)
      setExtraGroups((cur) => cur.filter((g) => g.id !== selectedGroupId))
      const nextGroup = groups.find((g) => g.id !== selectedGroupId)
      setSelectedGroupId(nextGroup?.id || '')
      setSelectedItemId(nextItems.find((item) => getItemGroup(item) === nextGroup?.id)?.id || '')
      showNotice('Группа удалена.')
    } catch (e) {
      showNotice('Ошибка при удалении: ' + (e instanceof Error ? e.message : 'неизвестная ошибка'))
    }
  }

  async function openIikoSync() {
    // Load saved settings from restaurant
    try {
      const resp = await fetch('/api/restaurant', { credentials: 'include' })
      if (resp.ok) {
        const r = await resp.json()
        if (r.iikoHost) setIikoHost(r.iikoHost)
        if (r.iikoLogin) setIikoLogin(r.iikoLogin)
        if (r.iikoPassword) setIikoPassword(r.iikoPassword)
        // If already configured, go straight to preview
        if (r.iikoHost && r.iikoLogin && r.iikoPassword) {
          setIikoModalStep('settings')
          return
        }
      }
    } catch { /* ignore */ }
    setIikoModalStep('settings')
  }

  async function saveIikoSettings() {
    await fetch('/api/restaurant', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iikoHost: iikoHost.trim(), iikoLogin: iikoLogin.trim(), iikoPassword }),
    })
  }

  async function testAndFetch() {
    setIikoConnecting(true)
    setIikoError('')
    try {
      await saveIikoSettings()
      const resp = await fetch('/api/iiko/inventory?filter=prepared', { credentials: 'include' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Ошибка')
      // inventory endpoint returns {name, unit, category, price} — remap category → group
      const mapped = (data.items as { name: string; unit: string; category: string; price?: number }[]).map(i => ({
        name: i.name,
        unit: i.unit,
        price: i.price || 0,
        group: i.category || 'Без категории',
      }))
      setIikoPreviewItems(mapped)
      setIikoCheckedItems(new Set())
      setIikoExpandedGroups(new Set())
      setIikoModalStep('preview')
    } catch (e) {
      setIikoError(e instanceof Error ? e.message : 'Ошибка подключения')
    } finally {
      setIikoConnecting(false)
    }
  }

  async function importIikoItems() {
    setIikoModalStep('importing')
    const toImport = iikoPreviewItems.filter((_, idx) => iikoCheckedItems.has(idx))
    let count = 0
    for (const item of toImport) {
      const created = await api.create<TtkItem>('ttk', {
        name: item.name,
        group: item.group,
        unit: item.unit,
        price: item.price || 0,
      })
      setItems((cur) => [...cur, created])
      count++
    }
    setIikoModalStep('closed')
    showNotice(`Импортировано ${count} позиций из iiko.`)
    if (count > 0 && !selectedGroupId) {
      setSelectedGroupId(toImport[0].group)
    }
  }

  const iikoGroupList = Array.from(new Set(iikoPreviewItems.map((i) => i.group))).sort()

  // Выбор отдельных позиций (индексы в iikoPreviewItems)
  const [iikoCheckedItems, setIikoCheckedItems] = useState<Set<number>>(new Set())
  const [iikoExpandedGroups, setIikoExpandedGroups] = useState<Set<string>>(new Set())

  function toggleIikoItem(idx: number) {
    setIikoCheckedItems(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function toggleIikoGroup(g: string) {
    const idxs = iikoPreviewItems.map((it, i) => it.group === g ? i : -1).filter(i => i >= 0)
    const allChecked = idxs.every(i => iikoCheckedItems.has(i))
    setIikoCheckedItems(prev => {
      const n = new Set(prev)
      idxs.forEach(i => allChecked ? n.delete(i) : n.add(i))
      return n
    })
  }
  function toggleIikoExpand(g: string) {
    setIikoExpandedGroups(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n })
  }

  return (
    <section className="ttk-page">
      {notice ? <div className="ttk-notice">{notice}</div> : null}
      <aside className="ttk-groups-panel">
        <div className="ttk-groups-panel__header">
          <h2>Группы</h2>
          <div className="ttk-groups-panel__actions">
            <button className="ttk-ref-btn" type="button" onClick={() => setRefOpen(true)}>Справочники</button>
            <button className="ttk-ref-btn" type="button" onClick={() => void openIikoSync()}>↓ iiko</button>
            <button className="ttk-ref-btn ttk-ref-btn--primary" type="button" onClick={() => setAddingGroup(true)}>+ Добавить группу</button>
          </div>
        </div>
        <div className="ttk-groups-list">
          {groups.length === 0 && !addingGroup ? (
            <p className="ttk-groups-empty">Создайте первую группу — нажмите&nbsp;«+»</p>
          ) : null}
          {groups.map((group) => (
            <div key={group.id} className={`ttk-group-row${group.id === selectedGroupId ? ' ttk-group-row--active' : ''}`}
              onClick={() => { setSelectedGroupId(group.id); setSelectedItemId(items.find((item) => getItemGroup(item) === group.id)?.id || '') }}>
              <span className="ttk-group-row__name">{group.name}</span>
              <span className="ttk-group-row__count">{items.filter((item) => getItemGroup(item) === group.id).length} позиций</span>
              <button className="ttk-delete-group-btn" type="button" title="Удалить группу" onClick={(e) => { e.stopPropagation(); void deleteGroup() }}>✕</button>
            </div>
          ))}
          {addingGroup ? (
            <div className="ttk-group-add-row">
              <input ref={newGroupInputRef} className="ttk-group-add-input" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Название группы" onKeyDown={(e) => { if (e.key === 'Enter') confirmAddGroup(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName('') } }} />
              <button className="ttk-primary-button" type="button" onClick={confirmAddGroup}>ОК</button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="ttk-content-grid">
        <main className="ttk-list-panel">
          {groups.length === 0 ? (
            <div className="ttk-empty"><span><BookIcon /></span><strong>Создайте группу в панели слева</strong></div>
          ) : (
            <>
              <div className="ttk-list-toolbar">
                <button className="ttk-primary-button" type="button" onClick={() => void createItem()}>+ Позиция</button>
              </div>
              <div className="ttk-table-wrap"><table className="ttk-table ttk-table--clickable"><thead><tr><th>Фото</th><th>Наименование</th><th>Ед.</th><th>Цена</th><th>Тэг</th><th>Скидки</th><th>Онлайн</th><th>На вынос</th></tr></thead><tbody>{filteredItems.map((item) => <tr className={item.id === selectedItem?.id ? 'ttk-row--active' : ''} key={item.id} onClick={() => { setSelectedItemId(item.id); setEditModalOpen(true) }}><td><span className="ttk-photo-cell">{item.photoLabel || '🍽'}</span></td><td><strong>{item.name}</strong></td><td>{item.unit}</td><td>{Number(item.price || 0).toLocaleString('ru-RU')} ₽</td><td>{item.tag || '—'}</td><td>{item.discounts ? 'Да' : 'Нет'}</td><td>{item.online ? 'Да' : 'Нет'}</td><td>{item.takeaway ? 'Да' : 'Нет'}</td></tr>)}{filteredItems.length === 0 ? <tr><td colSpan={8}>В этой группе пока нет позиций.</td></tr> : null}</tbody></table></div>
            </>
          )}
        </main>

      </div>

      {refOpen ? (
        <div className="ttk-modal-backdrop" onMouseDown={() => setRefOpen(false)}>
          <div className="ttk-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="ttk-modal__header">
              <h3>Справочники</h3>
              <button type="button" className="ttk-modal__close" onClick={() => setRefOpen(false)}>✕</button>
            </div>
            <div className="ttk-modal__body">
              <div className="ttk-ref-section">
                <h4>Единицы измерения</h4>
                <div className="ttk-ref-list">
                  {refUnits.map((u) => (
                    <div key={u} className="ttk-ref-tag">
                      <span>{u}</span>
                      <button type="button" onClick={() => setRefUnits((prev) => prev.filter((x) => x !== u))}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="ttk-ref-add">
                  <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Новая единица..."
                    onKeyDown={(e) => { if (e.key === 'Enter' && newUnit.trim()) { setRefUnits((p) => [...p, newUnit.trim()]); setNewUnit('') } }} />
                  <button type="button" className="ttk-primary-button" onClick={() => { if (newUnit.trim()) { setRefUnits((p) => [...p, newUnit.trim()]); setNewUnit('') } }}>+</button>
                </div>
              </div>
              <div className="ttk-ref-section">
                <h4>Тэги</h4>
                <div className="ttk-ref-list">
                  {refTags.map((t) => (
                    <div key={t} className="ttk-ref-tag">
                      <span>{t}</span>
                      <button type="button" onClick={() => setRefTags((prev) => prev.filter((x) => x !== t))}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="ttk-ref-add">
                  <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Новый тэг..."
                    onKeyDown={(e) => { if (e.key === 'Enter' && newTag.trim()) { setRefTags((p) => [...p, newTag.trim()]); setNewTag('') } }} />
                  <button type="button" className="ttk-primary-button" onClick={() => { if (newTag.trim()) { setRefTags((p) => [...p, newTag.trim()]); setNewTag('') } }}>+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* iiko sync modal */}
      {iikoModalStep !== 'closed' && (
        <div className="ttk-modal-backdrop" onMouseDown={() => setIikoModalStep('closed')}>
          <div className="ttk-modal" style={{ maxWidth: 520 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="ttk-modal__header">
              <h3>{iikoModalStep === 'preview' ? `Импорт из iiko — ${iikoPreviewItems.length} позиций` : iikoModalStep === 'importing' ? 'Импортирую...' : 'Подключение к iiko'}</h3>
              <button type="button" className="ttk-modal__close" onClick={() => setIikoModalStep('closed')}>✕</button>
            </div>
            <div className="ttk-modal__body">
              {iikoModalStep === 'settings' && (
                <>
                  <div className="ttk-iiko-form">
                    <label>
                      <span>Хост iiko (например: myrest.iiko.it или 192.168.1.1:443)</span>
                      <input value={iikoHost} onChange={(e) => setIikoHost(e.target.value)} placeholder="myrest.iiko.it" />
                    </label>
                    <label>
                      <span>Логин</span>
                      <input value={iikoLogin} onChange={(e) => setIikoLogin(e.target.value)} placeholder="admin" />
                    </label>
                    <label>
                      <span>Пароль</span>
                      <input type="password" value={iikoPassword} onChange={(e) => setIikoPassword(e.target.value)} placeholder="••••••••" />
                    </label>
                    {iikoError && <p className="ttk-iiko-error">{iikoError}</p>}
                  </div>
                  <div className="ttk-modal__footer-row">
                    <button className="ttk-primary-button" type="button" disabled={iikoConnecting || !iikoHost || !iikoLogin || !iikoPassword} onClick={() => void testAndFetch()}>
                      {iikoConnecting ? 'Подключаюсь...' : 'Загрузить номенклатуру'}
                    </button>
                  </div>
                </>
              )}

              {iikoModalStep === 'preview' && (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
                    Разверните категорию и выберите нужные позиции. Выбрано: <strong>{iikoCheckedItems.size}</strong>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                    {iikoGroupList.map((g) => {
                      const groupItems = iikoPreviewItems.map((it, i) => ({ it, i })).filter(({ it }) => it.group === g)
                      const expanded = iikoExpandedGroups.has(g)
                      const checkedCount = groupItems.filter(({ i }) => iikoCheckedItems.has(i)).length
                      const allChecked = groupItems.length > 0 && checkedCount === groupItems.length
                      return (
                        <div key={g} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                          <div onClick={() => toggleIikoExpand(g)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: '#f9fafb', userSelect: 'none' }}>
                            <input type="checkbox" checked={allChecked} onChange={() => toggleIikoGroup(g)}
                              onClick={e => e.stopPropagation()} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>{g || 'Без категории'}</span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>{checkedCount > 0 ? `${checkedCount}/` : ''}{groupItems.length} поз.</span>
                            <span style={{ fontSize: 10, color: '#9ca3af' }}>{expanded ? '▲' : '▼'}</span>
                          </div>
                          {expanded && (
                            <div style={{ borderTop: '1px solid #f0f2f5' }}>
                              {groupItems.map(({ it, i }) => (
                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', background: iikoCheckedItems.has(i) ? '#eff6ff' : '#fff', borderBottom: '1px solid #f9fafb' }}>
                                  <input type="checkbox" checked={iikoCheckedItems.has(i)} onChange={() => toggleIikoItem(i)} />
                                  <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>{it.name}</span>
                                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 50, textAlign: 'right' }}>{it.price ? `${it.price} ₽` : '—'}</span>
                                  <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 30, textAlign: 'right' }}>{it.unit}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="ttk-modal__footer-row" style={{ marginTop: 16 }}>
                    <button className="ttk-ref-btn" type="button" onClick={() => setIikoModalStep('settings')}>← Назад</button>
                    <button className="ttk-primary-button" type="button"
                      disabled={iikoCheckedItems.size === 0}
                      onClick={() => void importIikoItems()}>
                      Импортировать {iikoCheckedItems.size} позиций
                    </button>
                  </div>
                </>
              )}

              {iikoModalStep === 'importing' && (
                <p style={{ padding: '20px 0', textAlign: 'center', color: '#6b7280' }}>Создаю позиции в базе...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модалка редактирования блюда */}
      {editModalOpen && selectedItem && (
        <div className="ttk-modal-backdrop" onMouseDown={() => setEditModalOpen(false)}>
          <div className="ttk-edit-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="ttk-modal__header">
              <h3>{selectedItem.name}</h3>
              <button type="button" className="ttk-modal__close" onClick={() => setEditModalOpen(false)}>✕</button>
            </div>
            <div className="ttk-edit-modal__body">
              <div className="ttk-editor-cols">
                {/* ── Левая колонка ── */}
                <div className="ttk-editor-left">
                  <section className="ttk-section-card">
                    <div className="ttk-section-card__header"><h3>Основное</h3></div>
                    <div className="ttk-form-grid">
                      <label className="ttk-field-wide"><span>Наименование</span><input value={selectedItem.name} onChange={(e) => updateSelected({ name: e.target.value })} /></label>
                      <label><span>Единица измерения</span><select value={selectedItem.unit} onChange={(e) => updateSelected({ unit: e.target.value })}><option value="">—</option>{refUnits.map((u) => <option key={u}>{u}</option>)}</select></label>
                      <label><span>Цена</span><input value={selectedItem.price} type="number" onChange={(e) => updateSelected({ price: Number(e.target.value || 0) })} /></label>
                      <label><span>Тэг</span><select value={selectedItem.tag || ''} onChange={(e) => updateSelected({ tag: e.target.value })}><option value="">—</option>{refTags.map((t) => <option key={t}>{t}</option>)}</select></label>
                      <label className="ttk-field-wide"><span>Описание</span><textarea value={selectedItem.description || ''} onChange={(e) => updateSelected({ description: e.target.value })} /></label>
                    </div>
                  </section>

                  <section className="ttk-section-card">
                    <div className="ttk-section-card__header"><h3>Технология</h3></div>
                    <div className="ttk-recipe-list">
                      {(selectedItem.recipe || []).map((line, index) => (
                        <div className="ttk-recipe-line" key={`${line.ingredient}-${index}`}>
                          <span>{index + 1}</span>
                          <input value={line.ingredient} readOnly />
                          <input value={line.amount || line.quantity || ''} readOnly />
                        </div>
                      ))}
                      {!selectedItem.recipe?.length ? <p className="ttk-empty-small">Раскладка ещё не заполнена.</p> : null}
                      <div className="ttk-form-grid">
                        <label><span>Время приготовления</span><input value={String(selectedItem.cookingTime || '')} onChange={(e) => updateSelected({ cookingTime: e.target.value })} /></label>
                        <label><span>Выход готового блюда</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input style={{ flex: 1 }} value={selectedItem.output || ''} onChange={(e) => updateSelected({ output: e.target.value })} placeholder="300" />
                            <select style={{ width: 72 }} value={(selectedItem as any).outputUnit || ''} onChange={(e) => updateSelected({ outputUnit: e.target.value } as any)}>
                              <option value="">—</option>
                              {refUnits.map((u) => <option key={u}>{u}</option>)}
                            </select>
                          </div>
                        </label>
                      </div>
                    </div>
                  </section>

                  <section className="ttk-section-card">
                    <div className="ttk-section-card__header"><h3>Продажа и контроль</h3></div>
                    <div className="ttk-switch-grid">
                      <label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.takeaway)} onChange={(e) => updateSelected({ takeaway: e.target.checked })} /><span>На вынос</span></label>
                      <label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.online)} onChange={(e) => updateSelected({ online: e.target.checked })} /><span>Онлайн-заказ</span></label>
                      <label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.discounts)} onChange={(e) => updateSelected({ discounts: e.target.checked })} /><span>Скидки</span></label>
                      <label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.marked)} onChange={(e) => updateSelected({ marked: e.target.checked })} /><span>Маркировка</span></label>
                      <label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.requiresScan)} onChange={(e) => updateSelected({ requiresScan: e.target.checked })} /><span>Нужен скан</span></label>
                      <label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.excise)} onChange={(e) => updateSelected({ excise: e.target.checked })} /><span>Подакцизный</span></label>
                    </div>
                  </section>
                </div>

                {/* ── Правая колонка ── */}
                <div className="ttk-editor-right">
                  <section className="ttk-section-card">
                    <div className="ttk-section-card__header"><h3>Фото</h3></div>
                    <div className="ttk-photo-block">
                      <div className="ttk-card-hero__cover" onClick={() => photoInputRef.current?.click()}>
                        {selectedItem.photoUrl
                          ? <img className="ttk-card-hero__cover-img" src={selectedItem.photoUrl} alt={selectedItem.name} />
                          : <div className="ttk-card-hero__cover-empty"><span>🍽</span><span>Добавить фото</span></div>}
                        <div className="ttk-card-hero__cover-overlay">{selectedItem.photoUrl ? 'Изменить' : '+ Фото'}</div>
                        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                      </div>
                      {selectedItem.photoUrl && (
                        <button type="button" className="ttk-card-hero__photo-remove" onClick={() => updateSelected({ photoUrl: '' })}>✕ Удалить фото</button>
                      )}
                    </div>
                  </section>

                  <section className="ttk-section-card">
                    <div className="ttk-section-card__header"><h3>КБЖУ</h3></div>
                    <div className="ttk-kbju-grid">
                      <label><span>Ккал</span><input type="number" min="0" value={getKcal(selectedItem)} onChange={(e) => updateSelected({ kcal: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, kcal: Number(e.target.value || 0) } })} /></label>
                      <label><span>Белки, г</span><input type="number" min="0" value={getProtein(selectedItem)} onChange={(e) => updateSelected({ proteins: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, protein: Number(e.target.value || 0), proteins: Number(e.target.value || 0) } })} /></label>
                      <label><span>Жиры, г</span><input type="number" min="0" value={getFat(selectedItem)} onChange={(e) => updateSelected({ fats: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, fat: Number(e.target.value || 0), fats: Number(e.target.value || 0) } })} /></label>
                      <label><span>Углеводы, г</span><input type="number" min="0" value={getCarbs(selectedItem)} onChange={(e) => updateSelected({ carbs: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, carbs: Number(e.target.value || 0) } })} /></label>
                    </div>
                  </section>

                  <section className="ttk-section-card">
                    <div className="ttk-section-card__header">
                      <h3>Гастропары</h3>
                      <button type="button" className="ttk-ref-btn ttk-ref-btn--primary" onClick={() => updateSelected({ gastroPairs: [...(selectedItem.gastroPairs || []), ''] })}>+ Добавить</button>
                    </div>
                    <div className="ttk-pairs-list">
                      {(selectedItem.gastroPairs || []).length === 0 ? <p className="ttk-empty-small">Не добавлены.</p> : null}
                      {(selectedItem.gastroPairs || []).map((pair, i) => (
                        <div key={i} className="ttk-pair-row">
                          <span className="ttk-pair-row__num">{i + 1}</span>
                          <select value={pair} onChange={(e) => { const next = [...(selectedItem.gastroPairs || [])]; next[i] = e.target.value; updateSelected({ gastroPairs: next }) }}>
                            <option value="">— выберите блюдо —</option>
                            {items.filter((it) => it.id !== selectedItem.id).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                          </select>
                          <button type="button" className="ttk-pair-row__del" onClick={() => updateSelected({ gastroPairs: (selectedItem.gastroPairs || []).filter((_, idx) => idx !== i) })}>✕</button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="ttk-section-card">
                    <div className="ttk-section-card__header"><h3>Допы</h3></div>
                    <div className="ttk-form-grid">
                      <label className="ttk-field-wide">
                        <span>Комментарий по допам</span>
                        <textarea value={selectedItem.extras || ''} onChange={(e) => updateSelected({ extras: e.target.value })} placeholder="Опишите возможные дополнения к блюду..." />
                      </label>
                    </div>
                  </section>
                </div>
              </div>
            </div>
            <div className="ttk-modal__footer-row">
              <button className="ttk-danger-button" type="button" onClick={() => { void deleteItem(); setEditModalOpen(false) }}>Удалить</button>
              <button className="ttk-primary-button" type="button" onClick={() => { void saveSelected(); setEditModalOpen(false) }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
