import { useMemo, useState } from 'react'
import { BookIcon, SearchIcon } from '../../shared/ui/Icon'

type TtkGroup = {
  id: string
  name: string
  itemsCount: number
}

type RecipeLine = {
  ingredient: string
  amount: string
}

type TtkItem = {
  id: string
  groupId: string
  photoLabel: string
  name: string
  unit: string
  price: number
  tag: string
  description: string
  recipe: RecipeLine[]
  cookingTime: number
  output: string
  additives: string
  pairings: string
  kcal: number
  proteins: number
  fats: number
  carbs: number
  takeaway: boolean
  online: boolean
  discounts: boolean
  marked: boolean
  requiresScan: boolean
  excise: boolean
}

const groups: TtkGroup[] = [
  { id: 'burgers', name: 'Бургеры', itemsCount: 4 },
  { id: 'pizza', name: 'Пицца', itemsCount: 6 },
  { id: 'salads', name: 'Салаты', itemsCount: 8 },
  { id: 'hot', name: 'Горячее', itemsCount: 12 },
  { id: 'desserts', name: 'Десерты', itemsCount: 7 },
  { id: 'drinks', name: 'Напитки', itemsCount: 15 },
  { id: 'bar', name: 'Бар', itemsCount: 24 },
  { id: 'breakfasts', name: 'Завтраки', itemsCount: 9 },
  { id: 'addons', name: 'Добавки', itemsCount: 16 },
]

const items: TtkItem[] = [
  {
    id: 'b1',
    groupId: 'burgers',
    photoLabel: '🍔',
    name: 'Бургер с говядиной',
    unit: 'шт.',
    price: 590,
    tag: 'Хит',
    description: 'Сочная говяжья котлета, свежие овощи, фирменный соус, сыр чеддер.',
    recipe: [
      { ingredient: 'Булка', amount: '1 шт.' },
      { ingredient: 'Котлета говяжья', amount: '150 г' },
      { ingredient: 'Сыр чеддер', amount: '20 г' },
      { ingredient: 'Соус фирменный', amount: '30 г' },
    ],
    cookingTime: 15,
    output: '360 г',
    additives: 'Картофель фри, Луковые кольца, Халапеньо',
    pairings: 'Крафтовый эль, Лимонад цитрусовый',
    kcal: 650,
    proteins: 32,
    fats: 34,
    carbs: 55,
    takeaway: true,
    online: true,
    discounts: true,
    marked: false,
    requiresScan: false,
    excise: false,
  },
  {
    id: 'b2',
    groupId: 'burgers',
    photoLabel: '🍔',
    name: 'Чизбургер',
    unit: 'шт.',
    price: 520,
    tag: 'Хит',
    description: 'Классический бургер с сыром чеддер, томатами и маринованными огурцами.',
    recipe: [
      { ingredient: 'Булка', amount: '1 шт.' },
      { ingredient: 'Котлета говяжья', amount: '130 г' },
      { ingredient: 'Сыр чеддер', amount: '25 г' },
      { ingredient: 'Огурцы маринованные', amount: '18 г' },
    ],
    cookingTime: 12,
    output: '330 г',
    additives: 'Картофель фри, Бекон',
    pairings: 'Кола, Лагер светлый',
    kcal: 610,
    proteins: 29,
    fats: 31,
    carbs: 50,
    takeaway: true,
    online: true,
    discounts: true,
    marked: false,
    requiresScan: false,
    excise: false,
  },
  {
    id: 'b3',
    groupId: 'burgers',
    photoLabel: '🌶️',
    name: 'Бургер BBQ',
    unit: 'шт.',
    price: 570,
    tag: 'Острый',
    description: 'Бургер с BBQ-соусом, хрустящим луком и острым перцем халапеньо.',
    recipe: [
      { ingredient: 'Булка', amount: '1 шт.' },
      { ingredient: 'Котлета говяжья', amount: '150 г' },
      { ingredient: 'Соус BBQ', amount: '35 г' },
      { ingredient: 'Лук crispy', amount: '15 г' },
    ],
    cookingTime: 16,
    output: '350 г',
    additives: 'Сырный соус, Халапеньо',
    pairings: 'Томатный лимонад, Pale Ale',
    kcal: 670,
    proteins: 31,
    fats: 36,
    carbs: 54,
    takeaway: true,
    online: true,
    discounts: true,
    marked: false,
    requiresScan: false,
    excise: false,
  },
  {
    id: 'b4',
    groupId: 'burgers',
    photoLabel: '🥬',
    name: 'Бургер с курицей',
    unit: 'шт.',
    price: 480,
    tag: 'Новинка',
    description: 'Нежная куриная котлета, салат айсберг и соус айоли.',
    recipe: [
      { ingredient: 'Булка', amount: '1 шт.' },
      { ingredient: 'Куриная котлета', amount: '140 г' },
      { ingredient: 'Айсберг', amount: '15 г' },
      { ingredient: 'Соус айоли', amount: '20 г' },
    ],
    cookingTime: 14,
    output: '320 г',
    additives: 'Картофель по-деревенски',
    pairings: 'Лимонад, Пшеничное пиво',
    kcal: 540,
    proteins: 30,
    fats: 24,
    carbs: 47,
    takeaway: true,
    online: true,
    discounts: false,
    marked: false,
    requiresScan: false,
    excise: false,
  },
  {
    id: 'p1',
    groupId: 'pizza',
    photoLabel: '🍕',
    name: 'Пепперони',
    unit: 'шт.',
    price: 690,
    tag: 'Хит',
    description: 'Тонкое тесто, сыр моцарелла, томатный соус и пепперони.',
    recipe: [
      { ingredient: 'Тесто', amount: '250 г' },
      { ingredient: 'Пепперони', amount: '80 г' },
      { ingredient: 'Моцарелла', amount: '120 г' },
      { ingredient: 'Соус томатный', amount: '60 г' },
    ],
    cookingTime: 12,
    output: '480 г',
    additives: 'Доп. сыр, Халапеньо',
    pairings: 'Кола, Пшеничное пиво',
    kcal: 720,
    proteins: 28,
    fats: 30,
    carbs: 82,
    takeaway: true,
    online: true,
    discounts: true,
    marked: false,
    requiresScan: false,
    excise: false,
  },
]

function GroupButton({ group, active, onClick }: { group: TtkGroup; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'ttk-group ttk-group--active' : 'ttk-group'} type="button" onClick={onClick}>
      <span>{group.name}</span>
      <strong>{group.itemsCount}</strong>
    </button>
  )
}

function TagBadge({ value }: { value: string }) {
  const tone = value === 'Хит' ? 'orange' : value === 'Острый' ? 'red' : 'green'
  return <span className={`ttk-tag ttk-tag--${tone}`}>{value}</span>
}

export function TtkPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0].id)
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0].id)

  const filteredItems = useMemo(() => items.filter((item) => item.groupId === selectedGroupId), [selectedGroupId])
  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0],
    [filteredItems, selectedItemId],
  )

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]

  return (
    <section className="ttk-page">
      <div className="ttk-layout">
        <aside className="ttk-groups-card">
          <div className="ttk-panel-title">
            <h2>Группы</h2>
            <button type="button">Добавить группу</button>
          </div>
          <div className="ttk-groups-list">
            {groups.map((group) => (
              <GroupButton
                key={group.id}
                group={group}
                active={group.id === selectedGroupId}
                onClick={() => {
                  setSelectedGroupId(group.id)
                  const firstItem = items.find((item) => item.groupId === group.id)
                  if (firstItem) setSelectedItemId(firstItem.id)
                }}
              />
            ))}
          </div>
        </aside>

        <section className="ttk-table-area">
          <div className="ttk-table-header">
            <div>
              <h2>Позиции</h2>
              <p>{selectedGroup.name}</p>
            </div>
            <div className="ttk-table-header__actions">
              <label className="ttk-local-search">
                <SearchIcon />
                <input placeholder="Поиск по списку..." />
              </label>
              <button className="ttk-outline-button" type="button">Добавить позицию</button>
            </div>
          </div>

          <div className="ttk-table-scroll">
            <table className="ttk-table">
              <thead>
                <tr>
                  <th>Фото</th>
                  <th>Наименование</th>
                  <th>Ед.</th>
                  <th>Цена</th>
                  <th>Тэг</th>
                  <th>Скидки</th>
                  <th>Онлайн</th>
                  <th>На вынос</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const active = selectedItem?.id === item.id
                  return (
                    <tr key={item.id} className={active ? 'ttk-table__row ttk-table__row--active' : 'ttk-table__row'}>
                      <td>
                        <span className="ttk-photo-pill">{item.photoLabel}</span>
                      </td>
                      <td>
                        <button className="ttk-name-button" type="button" onClick={() => setSelectedItemId(item.id)}>
                          {item.name}
                        </button>
                      </td>
                      <td>{item.unit}</td>
                      <td>{item.price} ₽</td>
                      <td><TagBadge value={item.tag} /></td>
                      <td>{item.discounts ? 'Да' : 'Нет'}</td>
                      <td>{item.online ? '✓' : '—'}</td>
                      <td>{item.takeaway ? '✓' : '—'}</td>
                      <td>
                        <button className="ttk-open-button" type="button" onClick={() => setSelectedItemId(item.id)}>Открыть</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="ttk-editor-card">
          <div className="ttk-editor-card__header">
            <h2>Карточка позиции</h2>
          </div>

          {selectedItem ? (
            <div className="ttk-editor-sections">
              <section className="ttk-section-card">
                <div className="ttk-section-card__header"><h3>Основное</h3></div>
                <div className="ttk-basic-grid">
                  <div className="ttk-photo-card">
                    <div className="ttk-photo-preview">{selectedItem.photoLabel}</div>
                    <button type="button">Загрузить фото</button>
                    <small>JPG, PNG, до 5 МБ</small>
                  </div>

                  <div className="ttk-form-grid ttk-form-grid--basic">
                    <label>
                      <span>Наименование</span>
                      <input defaultValue={selectedItem.name} />
                    </label>
                    <label>
                      <span>Единица измерения</span>
                      <select defaultValue={selectedItem.unit}>
                        <option>шт.</option>
                        <option>порц.</option>
                        <option>мл</option>
                        <option>г</option>
                      </select>
                    </label>
                    <label>
                      <span>Цена</span>
                      <input defaultValue={selectedItem.price} />
                    </label>
                    <label>
                      <span>Группа</span>
                      <select defaultValue={selectedGroup.name}>
                        {groups.map((group) => <option key={group.id}>{group.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Тэг</span>
                      <select defaultValue={selectedItem.tag}>
                        <option>Хит</option>
                        <option>Новинка</option>
                        <option>Острый</option>
                        <option>Без тэга</option>
                      </select>
                    </label>
                    <label className="ttk-form-grid__full">
                      <span>Описание</span>
                      <textarea defaultValue={selectedItem.description} rows={3} />
                    </label>
                  </div>
                </div>
              </section>

              <section className="ttk-section-card">
                <div className="ttk-section-card__header"><h3>Технология</h3></div>
                <div className="ttk-tech-grid">
                  <div>
                    <span className="ttk-field-label">Раскладка</span>
                    <div className="ttk-recipe-table">
                      {selectedItem.recipe.map((line) => (
                        <div className="ttk-recipe-row" key={line.ingredient}>
                          <span>{line.ingredient}</span>
                          <strong>{line.amount}</strong>
                        </div>
                      ))}
                      <button className="ttk-inline-link" type="button">Добавить ингредиент</button>
                    </div>
                  </div>
                  <div className="ttk-form-grid ttk-form-grid--tech">
                    <label>
                      <span>Время приготовления</span>
                      <input defaultValue={`${selectedItem.cookingTime} мин`} />
                    </label>
                    <label>
                      <span>Выход готового блюда</span>
                      <input defaultValue={selectedItem.output} />
                    </label>
                  </div>
                </div>
              </section>

              <section className="ttk-section-card">
                <div className="ttk-section-card__header"><h3>Добавки и пары</h3></div>
                <div className="ttk-form-grid ttk-form-grid--pairs">
                  <label>
                    <span>Добавки</span>
                    <input defaultValue={selectedItem.additives} />
                  </label>
                  <label>
                    <span>Гастрономические пары</span>
                    <input defaultValue={selectedItem.pairings} />
                  </label>
                </div>
              </section>

              <section className="ttk-section-card">
                <div className="ttk-section-card__header"><h3>КБЖУ</h3></div>
                <div className="ttk-kbju-grid">
                  <label><span>Ккал</span><input defaultValue={selectedItem.kcal} /></label>
                  <label><span>Белки</span><input defaultValue={`${selectedItem.proteins} г`} /></label>
                  <label><span>Жиры</span><input defaultValue={`${selectedItem.fats} г`} /></label>
                  <label><span>Углеводы</span><input defaultValue={`${selectedItem.carbs} г`} /></label>
                </div>
              </section>

              <section className="ttk-section-card">
                <div className="ttk-section-card__header"><h3>Продажа</h3></div>
                <div className="ttk-switch-grid">
                  <label className="ttk-switch-row"><input type="checkbox" defaultChecked={selectedItem.takeaway} /><span>Доступно на вынос</span></label>
                  <label className="ttk-switch-row"><input type="checkbox" defaultChecked={selectedItem.online} /><span>Доступно для онлайн-заказа</span></label>
                  <label className="ttk-switch-row"><input type="checkbox" defaultChecked={selectedItem.discounts} /><span>Скидки применяются</span></label>
                </div>
              </section>

              <section className="ttk-section-card">
                <div className="ttk-section-card__header"><h3>Ограничения и контроль</h3></div>
                <div className="ttk-switch-grid ttk-switch-grid--three">
                  <label className="ttk-switch-row"><input type="checkbox" defaultChecked={selectedItem.marked} /><span>Маркировочный товар</span></label>
                  <label className="ttk-switch-row"><input type="checkbox" defaultChecked={selectedItem.requiresScan} /><span>Нельзя взять без пика / сканирования</span></label>
                  <label className="ttk-switch-row"><input type="checkbox" defaultChecked={selectedItem.excise} /><span>Подакцизный товар</span></label>
                </div>
              </section>

              <section className="ttk-section-card">
                <div className="ttk-section-card__header"><h3>Групповые операции</h3></div>
                <div className="ttk-group-ops">
                  <label>
                    <span>Группа</span>
                    <select defaultValue={selectedGroup.name}>
                      {groups.map((group) => <option key={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Действие</span>
                    <select defaultValue="Скидки не применяются">
                      <option>Скидки не применяются</option>
                      <option>Скидки применяются</option>
                      <option>Доступно для онлайн-заказа</option>
                      <option>Недоступно для онлайн-заказа</option>
                      <option>Доступно на вынос</option>
                      <option>Недоступно на вынос</option>
                      <option>Пометить как маркировочный</option>
                      <option>Снять маркировку</option>
                      <option>Подакцизный товар</option>
                      <option>Снять подакцизность</option>
                      <option>Запретить без пика / сканирования</option>
                      <option>Разрешить без пика / сканирования</option>
                    </select>
                  </label>
                  <button className="ttk-outline-button" type="button">Применить к группе</button>
                </div>
              </section>

              <div className="ttk-editor-actions">
                <button className="ttk-primary-button" type="button">Сохранить изменения</button>
                <button className="ttk-outline-button" type="button">Дублировать</button>
                <button className="ttk-danger-button" type="button">Удалить</button>
              </div>
            </div>
          ) : (
            <div className="ttk-empty">
              <span><BookIcon /></span>
              <strong>Выберите позицию</strong>
              <p>Откройте блюдо или товар из списка, чтобы посмотреть и отредактировать карточку.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
