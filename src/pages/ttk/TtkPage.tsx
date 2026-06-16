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
    await Promise.all(groupItems.map((item) => api.remove('ttk', item.id)))
    const nextItems = items.filter((item) => getItemGroup(item) !== selectedGroupId)
    setItems(nextItems)
    setExtraGroups((cur) => cur.filter((g) => g.id !== selectedGroupId))
    const nextGroup = groups.find((g) => g.id !== selectedGroupId)
    setSelectedGroupId(nextGroup?.id || '')
    setSelectedItemId(nextItems.find((item) => getItemGroup(item) === nextGroup?.id)?.id || '')
    showNotice('Группа удалена.')
  }

  return (
    <section className="ttk-page">
      {notice ? <div className="ttk-notice">{notice}</div> : null}
      <aside className="ttk-groups-panel">
        <div className="ttk-groups-panel__header">
          <h2>Группы</h2>
          <div className="ttk-groups-panel__actions">
            <button className="ttk-ref-btn" type="button" onClick={() => setRefOpen(true)}>Справочники</button>
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
              <div className="ttk-table-wrap"><table className="ttk-table ttk-table--clickable"><thead><tr><th>Фото</th><th>Наименование</th><th>Ед.</th><th>Цена</th><th>Тэг</th><th>Скидки</th><th>Онлайн</th><th>На вынос</th></tr></thead><tbody>{filteredItems.map((item) => <tr className={item.id === selectedItem?.id ? 'ttk-row--active' : ''} key={item.id} onClick={() => setSelectedItemId(item.id)}><td><span className="ttk-photo-cell">{item.photoLabel || '🍽'}</span></td><td><strong>{item.name}</strong></td><td>{item.unit}</td><td>{Number(item.price || 0).toLocaleString('ru-RU')} ₽</td><td>{item.tag || '—'}</td><td>{item.discounts ? 'Да' : 'Нет'}</td><td>{item.online ? 'Да' : 'Нет'}</td><td>{item.takeaway ? 'Да' : 'Нет'}</td></tr>)}{filteredItems.length === 0 ? <tr><td colSpan={8}>В этой группе пока нет позиций.</td></tr> : null}</tbody></table></div>
            </>
          )}
        </main>

        <aside className="ttk-editor-panel">
          {selectedItem ? <div className="ttk-editor-scroll"><section className="ttk-card-hero">
            <div className="ttk-card-hero__cover" onClick={() => photoInputRef.current?.click()}>
              {selectedItem.photoUrl
                ? <img className="ttk-card-hero__cover-img" src={selectedItem.photoUrl} alt={selectedItem.name} />
                : <div className="ttk-card-hero__cover-empty"><span>🍽</span><span>Нажмите чтобы добавить фото</span></div>}
              <div className="ttk-card-hero__cover-overlay">
                {selectedItem.photoUrl ? 'Изменить фото' : '+ Добавить фото'}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </div>
            {selectedItem.photoUrl ? (
              <button type="button" className="ttk-card-hero__photo-remove" onClick={() => updateSelected({ photoUrl: '' })}>✕ Удалить фото</button>
            ) : null}
            <div className="ttk-card-hero__info"><span>{selectedGroup?.name}</span><h2>{selectedItem.name}</h2><p>{selectedItem.description || 'Описание позиции пока не заполнено.'}</p></div></section>
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>Основное</h3></div><div className="ttk-form-grid"><label><span>Наименование</span><input value={selectedItem.name} onChange={(e) => updateSelected({ name: e.target.value })} /></label><label><span>Единица измерения</span><select value={selectedItem.unit} onChange={(e) => updateSelected({ unit: e.target.value })}><option value="">—</option>{refUnits.map((u) => <option key={u}>{u}</option>)}</select></label><label><span>Цена</span><input value={selectedItem.price} type="number" onChange={(e) => updateSelected({ price: Number(e.target.value || 0) })} /></label><label><span>Тэг</span><select value={selectedItem.tag || ''} onChange={(e) => updateSelected({ tag: e.target.value })}><option value="">—</option>{refTags.map((t) => <option key={t}>{t}</option>)}</select></label><label className="ttk-field-wide"><span>Описание</span><textarea value={selectedItem.description || ''} onChange={(e) => updateSelected({ description: e.target.value })} /></label></div></section>
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>Технология</h3></div><div className="ttk-recipe-list">{(selectedItem.recipe || []).map((line, index) => <div className="ttk-recipe-line" key={`${line.ingredient}-${index}`}><span>{index + 1}</span><input value={line.ingredient} readOnly /><input value={line.amount || line.quantity || ''} readOnly /></div>)}{!selectedItem.recipe?.length ? <p className="ttk-empty-small">Раскладка ещё не заполнена.</p> : null}<div className="ttk-form-grid ttk-form-grid--two"><label><span>Время приготовления</span><input value={String(selectedItem.cookingTime || '')} onChange={(e) => updateSelected({ cookingTime: e.target.value })} /></label><label><span>Выход готового блюда</span><input value={selectedItem.output || ''} onChange={(e) => updateSelected({ output: e.target.value })} /></label></div></div></section>
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>КБЖУ</h3></div><div className="ttk-kbju-grid"><label><span>Ккал</span><input type="number" min="0" value={getKcal(selectedItem)} onChange={(e) => updateSelected({ kcal: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, kcal: Number(e.target.value || 0) } })} /></label><label><span>Белки, г</span><input type="number" min="0" value={getProtein(selectedItem)} onChange={(e) => updateSelected({ proteins: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, protein: Number(e.target.value || 0), proteins: Number(e.target.value || 0) } })} /></label><label><span>Жиры, г</span><input type="number" min="0" value={getFat(selectedItem)} onChange={(e) => updateSelected({ fats: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, fat: Number(e.target.value || 0), fats: Number(e.target.value || 0) } })} /></label><label><span>Углеводы, г</span><input type="number" min="0" value={getCarbs(selectedItem)} onChange={(e) => updateSelected({ carbs: Number(e.target.value || 0), kbju: { ...selectedItem.kbju, carbs: Number(e.target.value || 0) } })} /></label></div></section>
            <section className="ttk-section-card">
              <div className="ttk-section-card__header">
                <h3>Гастрономические пары</h3>
                <button type="button" className="ttk-ref-btn ttk-ref-btn--primary" onClick={() => updateSelected({ gastroPairs: [...(selectedItem.gastroPairs || []), ''] })}>+ Добавить</button>
              </div>
              <div className="ttk-pairs-list">
                {(selectedItem.gastroPairs || []).length === 0 ? <p className="ttk-empty-small">Гастропары ещё не добавлены.</p> : null}
                {(selectedItem.gastroPairs || []).map((pair, i) => (
                  <div key={i} className="ttk-pair-row">
                    <span className="ttk-pair-row__num">{i + 1}</span>
                    <select
                      value={pair}
                      onChange={(e) => {
                        const next = [...(selectedItem.gastroPairs || [])]
                        next[i] = e.target.value
                        updateSelected({ gastroPairs: next })
                      }}
                    >
                      <option value="">— выберите блюдо —</option>
                      {items.filter((it) => it.id !== selectedItem.id).map((it) => (
                        <option key={it.id} value={it.id}>{it.name}</option>
                      ))}
                    </select>
                    <button type="button" className="ttk-pair-row__del" onClick={() => {
                      const next = (selectedItem.gastroPairs || []).filter((_, idx) => idx !== i)
                      updateSelected({ gastroPairs: next })
                    }}>✕</button>
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
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>Продажа и контроль</h3></div><div className="ttk-switch-grid"><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.takeaway)} onChange={(e) => updateSelected({ takeaway: e.target.checked })} /><span>Доступно на вынос</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.online)} onChange={(e) => updateSelected({ online: e.target.checked })} /><span>Доступно для онлайн-заказа</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.discounts)} onChange={(e) => updateSelected({ discounts: e.target.checked })} /><span>Скидки применяются</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.marked)} onChange={(e) => updateSelected({ marked: e.target.checked })} /><span>Маркировочный товар</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.requiresScan)} onChange={(e) => updateSelected({ requiresScan: e.target.checked })} /><span>Нельзя взять без пика / сканирования</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.excise)} onChange={(e) => updateSelected({ excise: e.target.checked })} /><span>Подакцизный товар</span></label></div></section>
            <div className="ttk-editor-actions"><button className="ttk-primary-button" type="button" onClick={() => void saveSelected()}>Сохранить изменения</button><button className="ttk-danger-button" type="button" onClick={() => void deleteItem()}>Удалить позицию</button></div>
          </div> : <div className="ttk-empty"><span><BookIcon /></span><strong>Выберите позицию</strong></div>}
        </aside>
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
    </section>
  )
}
