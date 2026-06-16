import { useEffect, useMemo, useState } from 'react'
import { BookIcon } from '../../shared/ui/Icon'
import { api } from '../../shared/api/client'

type RecipeLine = { ingredient: string; amount?: string; quantity?: string }

type TtkItem = {
  id: string
  group?: string
  groupId?: string
  photoLabel?: string
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

const groups: TtkGroup[] = [
  { id: 'Бургеры', name: 'Бургеры' },
  { id: 'Пицца', name: 'Пицца' },
  { id: 'Салаты', name: 'Салаты' },
  { id: 'Горячее', name: 'Горячее' },
  { id: 'Десерты', name: 'Десерты' },
  { id: 'Напитки', name: 'Напитки' },
  { id: 'Бар', name: 'Бар' },
  { id: 'Завтраки', name: 'Завтраки' },
  { id: 'Добавки', name: 'Добавки' },
]

function getItemGroup(item: TtkItem) { return item.group || item.groupId || 'Бургеры' }
function getKcal(item: TtkItem) { return item.kbju?.kcal ?? item.kcal ?? 0 }
function getProtein(item: TtkItem) { return item.kbju?.protein ?? item.kbju?.proteins ?? item.proteins ?? 0 }
function getFat(item: TtkItem) { return item.kbju?.fat ?? item.kbju?.fats ?? item.fats ?? 0 }
function getCarbs(item: TtkItem) { return item.kbju?.carbs ?? item.carbs ?? 0 }

export function TtkPage() {
  const [items, setItems] = useState<TtkItem[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0].id)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')

  async function loadItems() {
    const result = await api.list<TtkItem>('ttk')
    setItems(result.items)
    setSelectedItemId((current) => current || result.items[0]?.id || '')
    if (result.items[0]) setSelectedGroupId(getItemGroup(result.items[0]))
  }

  useEffect(() => { void loadItems() }, [])

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return items.filter((item) => getItemGroup(item) === selectedGroupId && (!normalized || item.name.toLowerCase().includes(normalized) || String(item.tag || '').toLowerCase().includes(normalized) || String(item.description || '').toLowerCase().includes(normalized)))
  }, [items, query, selectedGroupId])
  const selectedItem = items.find((item) => item.id === selectedItemId) || filteredItems[0]

  async function createItem() {
    const created = await api.create<TtkItem>('ttk', { name: 'Новая позиция', group: selectedGroupId, unit: 'шт', price: 0, tag: '', description: '', recipe: [], cookingTime: '0 мин', output: '', takeaway: true, online: true, discounts: true, marked: false, requiresScan: false, excise: false })
    setItems((current) => [created, ...current])
    setSelectedItemId(created.id)
    setNotice('Позиция создана.')
  }

  async function saveSelected() {
    if (!selectedItem) return
    const saved = await api.update<TtkItem>('ttk', selectedItem.id, selectedItem)
    setItems((current) => current.map((item) => item.id === saved.id ? saved : item))
    setNotice('Карточка сохранена.')
  }

  function updateSelected(patch: Partial<TtkItem>) {
    if (!selectedItem) return
    setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, ...patch } : item))
  }

  return (
    <section className="ttk-page">
      {notice ? <div className="ttk-notice">{notice}</div> : null}
      <aside className="ttk-groups-panel">
        <div className="ttk-groups-panel__header"><h2>Группы</h2><p>Выберите категорию позиции.</p></div>
        <div className="ttk-groups-list">{groups.map((group) => <button className={group.id === selectedGroupId ? 'ttk-group ttk-group--active' : 'ttk-group'} type="button" key={group.id} onClick={() => { setSelectedGroupId(group.id); setSelectedItemId(items.find((item) => getItemGroup(item) === group.id)?.id || '') }}><span><BookIcon /></span><div><strong>{group.name}</strong><p>{items.filter((item) => getItemGroup(item) === group.id).length} позиций</p></div></button>)}</div>
      </aside>

      <div className="ttk-content-grid">
        <main className="ttk-list-panel">
          <div className="ttk-list-toolbar"><label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по позициям, ингредиентам, тэгам..." /></label><button className="ttk-primary-button" type="button" onClick={() => void createItem()}>+ Позиция</button></div>
          <div className="ttk-table-wrap"><table className="ttk-table ttk-table--clickable"><thead><tr><th>Фото</th><th>Наименование</th><th>Ед.</th><th>Цена</th><th>Тэг</th><th>Скидки</th><th>Онлайн</th><th>На вынос</th></tr></thead><tbody>{filteredItems.map((item) => <tr className={item.id === selectedItem?.id ? 'ttk-row--active' : ''} key={item.id} onClick={() => setSelectedItemId(item.id)}><td><span className="ttk-photo-cell">{item.photoLabel || '🍽'}</span></td><td><strong>{item.name}</strong></td><td>{item.unit}</td><td>{Number(item.price || 0).toLocaleString('ru-RU')} ₽</td><td>{item.tag || '—'}</td><td>{item.discounts ? 'Да' : 'Нет'}</td><td>{item.online ? 'Да' : 'Нет'}</td><td>{item.takeaway ? 'Да' : 'Нет'}</td></tr>)}{filteredItems.length === 0 ? <tr><td colSpan={8}>В этой группе пока нет позиций.</td></tr> : null}</tbody></table></div>
        </main>

        <aside className="ttk-editor-panel">
          {selectedItem ? <div className="ttk-editor-scroll"><section className="ttk-card-hero"><div className="ttk-card-hero__photo">{selectedItem.photoLabel || '🍽'}</div><div><span>{selectedGroup.name}</span><h2>{selectedItem.name}</h2><p>{selectedItem.description || 'Описание позиции пока не заполнено.'}</p></div></section>
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>Основное</h3></div><div className="ttk-form-grid"><label><span>Наименование</span><input value={selectedItem.name} onChange={(e) => updateSelected({ name: e.target.value })} /></label><label><span>Единица измерения</span><input value={selectedItem.unit} onChange={(e) => updateSelected({ unit: e.target.value })} /></label><label><span>Цена</span><input value={selectedItem.price} type="number" onChange={(e) => updateSelected({ price: Number(e.target.value || 0) })} /></label><label><span>Тэг</span><input value={selectedItem.tag || ''} onChange={(e) => updateSelected({ tag: e.target.value })} /></label><label className="ttk-field-wide"><span>Описание</span><textarea value={selectedItem.description || ''} onChange={(e) => updateSelected({ description: e.target.value })} /></label></div></section>
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>Технология</h3></div><div className="ttk-recipe-list">{(selectedItem.recipe || []).map((line, index) => <div className="ttk-recipe-line" key={`${line.ingredient}-${index}`}><span>{index + 1}</span><input value={line.ingredient} readOnly /><input value={line.amount || line.quantity || ''} readOnly /></div>)}{!selectedItem.recipe?.length ? <p className="ttk-empty-small">Раскладка ещё не заполнена.</p> : null}<div className="ttk-form-grid ttk-form-grid--two"><label><span>Время приготовления</span><input value={String(selectedItem.cookingTime || '')} onChange={(e) => updateSelected({ cookingTime: e.target.value })} /></label><label><span>Выход готового блюда</span><input value={selectedItem.output || ''} onChange={(e) => updateSelected({ output: e.target.value })} /></label></div></div></section>
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>КБЖУ</h3></div><div className="ttk-kbju-grid"><label><span>Ккал</span><input value={getKcal(selectedItem)} readOnly /></label><label><span>Белки</span><input value={`${getProtein(selectedItem)} г`} readOnly /></label><label><span>Жиры</span><input value={`${getFat(selectedItem)} г`} readOnly /></label><label><span>Углеводы</span><input value={`${getCarbs(selectedItem)} г`} readOnly /></label></div></section>
            <section className="ttk-section-card"><div className="ttk-section-card__header"><h3>Продажа и контроль</h3></div><div className="ttk-switch-grid"><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.takeaway)} onChange={(e) => updateSelected({ takeaway: e.target.checked })} /><span>Доступно на вынос</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.online)} onChange={(e) => updateSelected({ online: e.target.checked })} /><span>Доступно для онлайн-заказа</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.discounts)} onChange={(e) => updateSelected({ discounts: e.target.checked })} /><span>Скидки применяются</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.marked)} onChange={(e) => updateSelected({ marked: e.target.checked })} /><span>Маркировочный товар</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.requiresScan)} onChange={(e) => updateSelected({ requiresScan: e.target.checked })} /><span>Нельзя взять без пика / сканирования</span></label><label className="ttk-switch-row"><input type="checkbox" checked={Boolean(selectedItem.excise)} onChange={(e) => updateSelected({ excise: e.target.checked })} /><span>Подакцизный товар</span></label></div></section>
            <div className="ttk-editor-actions"><button className="ttk-primary-button" type="button" onClick={() => void saveSelected()}>Сохранить изменения</button></div>
          </div> : <div className="ttk-empty"><span><BookIcon /></span><strong>Выберите позицию</strong></div>}
        </aside>
      </div>
    </section>
  )
}
