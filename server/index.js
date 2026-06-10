import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const dataDir = path.join(__dirname, 'data')
const jsonFile = path.join(dataDir, 'db.json')
const PORT = Number(process.env.PORT || 4173)
const COOKIE_NAME = 'rc_session'
const DATABASE_URL = process.env.DATABASE_URL || ''

let pgPool = null
let memoryState = null

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

function nowIso() {
  return new Date().toISOString()
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString()
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase()
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
}

function parseCookies(header = '') {
  return header.split(';').reduce((acc, item) => {
    const index = item.indexOf('=')
    if (index === -1) return acc
    const key = item.slice(0, index).trim()
    const value = decodeURIComponent(item.slice(index + 1).trim())
    acc[key] = value
    return acc
  }, {})
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    throw httpError(400, 'Некорректный JSON в запросе.')
  }
}

function send(res, status, payload, headers = {}) {
  res.writeHead(status, { ...jsonHeaders, ...headers })
  res.end(JSON.stringify(payload))
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function cleanUser(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return rest
}

function sessionPayload(state, session) {
  const user = state.users.find((item) => item.id === session.userId)
  const membership = state.memberships.find((item) => item.id === session.membershipId)
  const restaurant = state.restaurants.find((item) => item.id === session.restaurantId) || state.restaurants[0]

  if (!user || !membership || !restaurant) return null

  return {
    token: session.id,
    user: cleanUser(user),
    restaurant,
    membership,
  }
}

function createSession(state, user, membership, remember = true) {
  const session = {
    id: id('session'),
    userId: user.id,
    membershipId: membership.id,
    restaurantId: membership.restaurantId,
    expiresAt: addDays(new Date(), remember ? 30 : 1),
    createdAt: nowIso(),
  }
  state.sessions.push(session)
  return session
}

function cookieHeader(session, clear = false) {
  if (clear) {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  }

  const maxAge = Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(session.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function createSeedState() {
  const createdAt = nowIso()
  const serviceUser = {
    id: 'user_service_owner',
    name: 'Владелец сервиса',
    login: 'admin@resto.local',
    passwordHash: hashPassword('admin123'),
    roleHint: 'service_owner',
    createdAt,
    updatedAt: createdAt,
  }
  const ownerUser = {
    id: 'user_owner_demo',
    name: 'Владелец',
    login: 'owner@resto.local',
    passwordHash: hashPassword('owner123'),
    roleHint: 'owner',
    createdAt,
    updatedAt: createdAt,
  }
  const employeeUser = {
    id: 'user_employee_demo',
    name: 'Мария',
    login: 'employee@resto.local',
    passwordHash: hashPassword('employee123'),
    roleHint: 'employee',
    createdAt,
    updatedAt: createdAt,
  }
  const restaurant = {
    id: 'restaurant_demo',
    name: 'Resto Control',
    legalType: 'ООО',
    legalName: 'ООО «Ресто Контроль»',
    inn: '2312345678',
    kpp: '231201001',
    ogrn: '1232300000000',
    legalAddress: 'Краснодарский край, г. Сочи',
    bankName: 'Банк',
    bik: '040000000',
    account: '40702810000000000000',
    corrAccount: '30101810000000000000',
    contactEmail: 'owner@resto.local',
    contactPhone: '+7 900 000-00-00',
    plan: 'standard',
    subscriptionStatus: 'active',
    trialStartedAt: addDays(new Date(), -9),
    trialEndsAt: addDays(new Date(), 5),
    subscriptionEndsAt: addDays(new Date(), 5),
    createdAt,
    updatedAt: createdAt,
  }

  return {
    meta: { version: 1, createdAt, updatedAt: createdAt },
    users: [serviceUser, ownerUser, employeeUser],
    restaurants: [restaurant],
    memberships: [
      { id: 'membership_service_owner', userId: serviceUser.id, restaurantId: restaurant.id, role: 'service_owner', position: 'Владелец сервиса', status: 'active', createdAt, updatedAt: createdAt },
      { id: 'membership_owner_demo', userId: ownerUser.id, restaurantId: restaurant.id, role: 'owner', position: 'Владелец', status: 'active', createdAt, updatedAt: createdAt },
      { id: 'membership_employee_demo', userId: employeeUser.id, restaurantId: restaurant.id, role: 'employee', position: 'Администратор', status: 'active', createdAt, updatedAt: createdAt },
    ],
    sessions: [],
    employees: [
      { id: 'employee_1', restaurantId: restaurant.id, name: 'Мария Иванова', login: 'employee@resto.local', position: 'Администратор', status: 'active', shiftStatus: 'open', attestationPercent: 78, createdAt, updatedAt: createdAt },
      { id: 'employee_2', restaurantId: restaurant.id, name: 'Алексей Смирнов', login: 'barman@resto.local', position: 'Бармен', status: 'active', shiftStatus: 'closed', attestationPercent: 62, createdAt, updatedAt: createdAt },
      { id: 'employee_3', restaurantId: restaurant.id, name: 'Ольга Соколова', login: 'cleaning@resto.local', position: 'Клининг', status: 'active', shiftStatus: 'closed', attestationPercent: 55, createdAt, updatedAt: createdAt },
    ],
    tasks: [
      { id: 'task_1', restaurantId: restaurant.id, title: 'Проверить резерв на вечер', description: 'Проверить брони и подготовить зал.', assignmentType: 'position', assignedPosition: 'Администратор', status: 'not_started', dueDate: new Date().toISOString().slice(0, 10), dueTime: '17:00', requiresPhoto: false, active: true, createdAt, updatedAt: createdAt },
      { id: 'task_2', restaurantId: restaurant.id, title: 'Протереть столы на террасе', description: 'Фото не отдельный раздел, а часть задачи.', assignmentType: 'position', assignedPosition: 'Клининг', status: 'overdue', dueDate: new Date().toISOString().slice(0, 10), dueTime: '10:30', requiresPhoto: true, active: true, createdAt, updatedAt: createdAt },
    ],
    checklistTemplates: [
      { id: 'checklist_1', restaurantId: restaurant.id, title: 'Открытие зала', type: 'opening', position: 'Администратор', active: true, startTime: '09:00', endTime: '11:00', createdAt, updatedAt: createdAt, items: [
        { id: 'checklist_item_1', title: 'Проверить чистоту входной зоны', required: true, requiresCompletionPhoto: false, order: 1 },
        { id: 'checklist_item_2', title: 'Проверить брони на вечер', required: true, requiresCompletionPhoto: false, order: 2 },
      ] },
    ],
    halls: [
      { id: 'hall_main', restaurantId: restaurant.id, name: 'Основной зал', tablesCount: 5, seatsCount: 20, active: true, createdAt, updatedAt: createdAt },
      { id: 'hall_terrace', restaurantId: restaurant.id, name: 'Терраса', tablesCount: 3, seatsCount: 12, active: true, createdAt, updatedAt: createdAt },
    ],
    tables: [
      { id: 'table_1', restaurantId: restaurant.id, hallId: 'hall_main', name: 'Стол 1', seats: 2, status: 'free', active: true, createdAt, updatedAt: createdAt },
      { id: 'table_2', restaurantId: restaurant.id, hallId: 'hall_main', name: 'Стол 2', seats: 4, status: 'reserved', active: true, createdAt, updatedAt: createdAt },
      { id: 'table_3', restaurantId: restaurant.id, hallId: 'hall_main', name: 'Стол 3', seats: 4, status: 'arrived', active: true, createdAt, updatedAt: createdAt },
      { id: 'table_4', restaurantId: restaurant.id, hallId: 'hall_main', name: 'Стол 4', seats: 6, status: 'occupied', active: true, createdAt, updatedAt: createdAt },
      { id: 'table_5', restaurantId: restaurant.id, hallId: 'hall_terrace', name: 'Терраса 1', seats: 4, status: 'reserved', active: true, createdAt, updatedAt: createdAt },
    ],
    bookings: [
      { id: 'booking_1', restaurantId: restaurant.id, hallId: 'hall_main', tableId: 'table_2', guestName: 'Анна Смирнова', phone: '+7 900 111-22-33', date: new Date().toISOString().slice(0, 10), time: '19:00', guestsCount: 4, status: 'confirmed', comment: 'Стол у окна, без кинзы.', createdAt, updatedAt: createdAt },
      { id: 'booking_2', restaurantId: restaurant.id, hallId: 'hall_main', tableId: 'table_3', guestName: 'Иван Петров', phone: '+7 900 333-44-55', date: new Date().toISOString().slice(0, 10), time: '18:30', guestsCount: 2, status: 'arrived', comment: 'Постоянный гость.', createdAt, updatedAt: createdAt },
    ],
    inventoryProducts: [],
    inventoryAssignments: [],
    ttkItems: [],
    payments: [
      { id: 'payment_1', restaurantId: restaurant.id, invoiceNumber: '1287', plan: 'Стандарт', period: 'Июнь 2026', amount: 2990, status: 'paid', issuedAt: addDays(new Date(), -20), paidAt: addDays(new Date(), -18), closingDocument: 'Акт №1287', createdAt, updatedAt: createdAt },
      { id: 'payment_2', restaurantId: restaurant.id, invoiceNumber: '1288', plan: 'Стандарт', period: 'Июль 2026', amount: 2990, status: 'issued', issuedAt: nowIso(), createdAt, updatedAt: createdAt },
    ],
    technicalRequests: [],
    knowledgeMaterials: [
      { id: 'knowledge_1', restaurantId: restaurant.id, section: 'company_intro', type: 'video', title: 'Знакомство с компанией', status: 'published', description: 'Короткий материал для первого дня.', createdAt, updatedAt: createdAt },
      { id: 'knowledge_2', restaurantId: restaurant.id, section: 'documents', type: 'pdf', title: 'Обучающий PDF по сервису', status: 'published', description: 'Документ компании без чек-листов.', createdAt, updatedAt: createdAt },
    ],
    regularGuests: [
      { id: 'guest_1', restaurantId: restaurant.id, name: 'Анна Смирнова', preferences: 'Стол у окна', restrictions: 'Без кинзы', favoriteTable: 'Стол 2', favoriteItems: ['Чизкейк', 'Капучино'], serviceComment: 'Приходит с ребёнком, нужен детский стул.', createdAt, updatedAt: createdAt },
    ],
    pushSubscriptions: [],
  }
}

async function initPg() {
  if (!DATABASE_URL || pgPool) return pgPool
  try {
    const pg = await import('pg')
    pgPool = new pg.Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } })
    await pgPool.query('CREATE TABLE IF NOT EXISTS resto_state (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())')
    return pgPool
  } catch (error) {
    console.warn('PostgreSQL недоступен, используется JSON-хранилище:', error.message)
    pgPool = null
    return null
  }
}

async function loadState() {
  const pool = await initPg()
  if (pool) {
    const result = await pool.query('SELECT data FROM resto_state WHERE id = $1', ['main'])
    if (result.rows[0]?.data) return result.rows[0].data
    const seed = createSeedState()
    await pool.query('INSERT INTO resto_state (id, data) VALUES ($1, $2)', ['main', seed])
    return seed
  }

  if (memoryState) return memoryState
  await fs.mkdir(dataDir, { recursive: true })
  try {
    const content = await fs.readFile(jsonFile, 'utf8')
    memoryState = JSON.parse(content)
    return memoryState
  } catch {
    memoryState = createSeedState()
    await fs.writeFile(jsonFile, JSON.stringify(memoryState, null, 2))
    return memoryState
  }
}

async function saveState(state) {
  state.meta = { ...(state.meta || {}), updatedAt: nowIso() }
  const pool = await initPg()
  if (pool) {
    await pool.query('INSERT INTO resto_state (id, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', ['main', state])
    return
  }
  memoryState = state
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(jsonFile, JSON.stringify(state, null, 2))
}

async function getAuth(req, state) {
  const cookies = parseCookies(req.headers.cookie || '')
  const sessionId = cookies[COOKIE_NAME]
  if (!sessionId) return null
  const session = state.sessions.find((item) => item.id === sessionId)
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null
  const payload = sessionPayload(state, session)
  return payload ? { session, payload } : null
}

function requireAuth(auth) {
  if (!auth) throw httpError(401, 'Нужно войти в систему.')
  return auth.payload
}

function requireRole(auth, roles) {
  const payload = requireAuth(auth)
  if (!roles.includes(payload.membership.role)) {
    throw httpError(403, 'Недостаточно прав для действия.')
  }
  return payload
}

function restaurantIdFrom(auth) {
  return auth.payload.restaurant.id
}

function collectionByPath(state, name) {
  const allowed = {
    employees: 'employees',
    tasks: 'tasks',
    checklists: 'checklistTemplates',
    halls: 'halls',
    tables: 'tables',
    bookings: 'bookings',
    payments: 'payments',
    'technical-requests': 'technicalRequests',
    knowledge: 'knowledgeMaterials',
    guests: 'regularGuests',
    'push-subscriptions': 'pushSubscriptions',
    'inventory-assignments': 'inventoryAssignments',
    'inventory-products': 'inventoryProducts',
    ttk: 'ttkItems',
  }
  const key = allowed[name]
  if (!key) return null
  if (!Array.isArray(state[key])) state[key] = []
  return { key, items: state[key] }
}

async function handleAuth(req, res, state, pathname, auth) {
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    if (!auth) throw httpError(401, 'Сессия не найдена.')
    send(res, 200, auth.payload)
    return true
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    if (auth) {
      state.sessions = state.sessions.filter((item) => item.id !== auth.session.id)
      await saveState(state)
    }
    send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(null, true) })
    return true
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req)
    const login = normalizeLogin(body.login)
    const password = String(body.password || '')
    if (!login || !password) throw httpError(400, 'Введите логин и пароль.')

    let user = state.users.find((item) => item.login === login)

    if (!user && (login.includes('admin') || login.includes('super') || login.includes('service') || login.includes('platform'))) {
      user = { id: id('user'), name: 'Владелец сервиса', login, passwordHash: hashPassword(password), roleHint: 'service_owner', createdAt: nowIso(), updatedAt: nowIso() }
      state.users.push(user)
      const restaurant = state.restaurants[0] || createSeedState().restaurants[0]
      if (!state.restaurants.find((item) => item.id === restaurant.id)) state.restaurants.push(restaurant)
      state.memberships.push({ id: id('membership'), userId: user.id, restaurantId: restaurant.id, role: 'service_owner', position: 'Владелец сервиса', status: 'active', createdAt: nowIso(), updatedAt: nowIso() })
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw httpError(401, 'Неверный логин или пароль.')
    }

    const membership = state.memberships.find((item) => item.userId === user.id && item.status === 'active')
    if (!membership) throw httpError(403, 'Нет активного доступа к ресторану.')

    const session = createSession(state, user, membership, Boolean(body.remember))
    await saveState(state)
    send(res, 200, sessionPayload(state, session), { 'Set-Cookie': cookieHeader(session) })
    return true
  }

  if (pathname === '/api/auth/register-restaurant' && req.method === 'POST') {
    const body = await readBody(req)
    const restaurantName = String(body.restaurantName || '').trim()
    const ownerName = String(body.ownerName || '').trim()
    const login = normalizeLogin(body.login)
    const password = String(body.password || '')
    if (!restaurantName || !ownerName || !login || password.length < 6) {
      throw httpError(400, 'Заполните все поля. Пароль должен быть не короче 6 символов.')
    }
    if (state.users.some((item) => item.login === login)) {
      throw httpError(409, 'Пользователь с таким логином уже есть.')
    }

    const createdAt = nowIso()
    const user = { id: id('user'), name: ownerName, login, passwordHash: hashPassword(password), roleHint: 'owner', createdAt, updatedAt: createdAt }
    const restaurant = {
      id: id('restaurant'),
      name: restaurantName,
      plan: 'trial',
      subscriptionStatus: 'trial',
      trialStartedAt: createdAt,
      trialEndsAt: addDays(new Date(), 14),
      subscriptionEndsAt: addDays(new Date(), 14),
      createdAt,
      updatedAt: createdAt,
    }
    const membership = { id: id('membership'), userId: user.id, restaurantId: restaurant.id, role: 'owner', position: 'Владелец', status: 'active', createdAt, updatedAt: createdAt }

    state.users.push(user)
    state.restaurants.push(restaurant)
    state.memberships.push(membership)
    state.halls.push({ id: id('hall'), restaurantId: restaurant.id, name: 'Основной зал', tablesCount: 0, seatsCount: 0, active: true, createdAt, updatedAt: createdAt })
    const session = createSession(state, user, membership, true)
    await saveState(state)
    send(res, 200, sessionPayload(state, session), { 'Set-Cookie': cookieHeader(session) })
    return true
  }

  return false
}

async function handleServiceOwner(req, res, state, pathname, auth) {
  if (!pathname.startsWith('/api/service-owner')) return false
  requireRole(auth, ['service_owner'])

  if (pathname === '/api/service-owner/overview' && req.method === 'GET') {
    const restaurants = state.restaurants.map((restaurant) => {
      const ownerMembership = state.memberships.find((item) => item.restaurantId === restaurant.id && item.role === 'owner')
      const owner = state.users.find((item) => item.id === ownerMembership?.userId)
      return {
        ...restaurant,
        owner: owner ? cleanUser(owner) : null,
        employeesCount: state.employees.filter((item) => item.restaurantId === restaurant.id).length,
        payments: state.payments.filter((item) => item.restaurantId === restaurant.id),
      }
    })
    send(res, 200, { restaurants, payments: state.payments })
    return true
  }

  return false
}

async function handleCollections(req, res, state, pathname, auth) {
  const match = pathname.match(/^\/api\/(employees|tasks|checklists|halls|tables|bookings|payments|technical-requests|knowledge|guests|push-subscriptions|inventory-assignments|inventory-products|ttk)(?:\/([^/]+))?(?:\/([^/]+))?$/)
  if (!match) return false
  const [, name, itemId, action] = match
  const collection = collectionByPath(state, name)
  if (!collection) return false
  const payload = requireAuth(auth)
  const role = payload.membership.role
  const currentRestaurantId = restaurantIdFrom(auth)

  if (name === 'push-subscriptions' && req.method === 'POST') {
    const body = await readBody(req)
    const item = { id: id('push'), userId: payload.user.id, restaurantId: currentRestaurantId, subscription: body.subscription || body, createdAt: nowIso(), updatedAt: nowIso() }
    collection.items.push(item)
    await saveState(state)
    send(res, 201, item)
    return true
  }

  if (req.method === 'GET' && !itemId) {
    let result = collection.items
    if (role !== 'service_owner') result = result.filter((item) => !item.restaurantId || item.restaurantId === currentRestaurantId)
    send(res, 200, { items: result })
    return true
  }

  if (req.method === 'POST' && !itemId) {
    const body = await readBody(req)
    if (name === 'employees' && String(body.position || '').toLowerCase().includes('кладов')) {
      throw httpError(400, 'Должность «Кладовщик» не используется. Используйте «Клининг».')
    }
    const item = {
      id: id(name.replace(/-/g, '_')),
      restaurantId: role === 'service_owner' && body.restaurantId ? body.restaurantId : currentRestaurantId,
      ...body,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    collection.items.push(item)
    await saveState(state)
    send(res, 201, item)
    return true
  }

  const item = collection.items.find((entry) => entry.id === itemId)
  if (!item) throw httpError(404, 'Запись не найдена.')
  if (role !== 'service_owner' && item.restaurantId && item.restaurantId !== currentRestaurantId) {
    throw httpError(403, 'Нет доступа к этой записи.')
  }

  if ((req.method === 'PATCH' || req.method === 'PUT') && itemId) {
    const body = await readBody(req)
    if (name === 'bookings' && action === 'status') {
      const status = body.status
      const allowedStatuses = ['new', 'confirmed', 'arrived', 'seated', 'cancelled', 'no_show']
      if (!allowedStatuses.includes(status)) throw httpError(400, 'Некорректный статус брони.')
      item.status = status
      item.updatedAt = nowIso()
      const table = state.tables.find((tableItem) => tableItem.id === item.tableId)
      if (table) {
        table.status = status === 'arrived' ? 'arrived' : status === 'seated' ? 'occupied' : status === 'confirmed' ? 'reserved' : table.status
        table.updatedAt = nowIso()
      }
    } else {
      Object.assign(item, body, { updatedAt: nowIso() })
    }
    await saveState(state)
    send(res, 200, item)
    return true
  }

  if (req.method === 'DELETE' && itemId) {
    state[collection.key] = collection.items.filter((entry) => entry.id !== itemId)
    await saveState(state)
    send(res, 200, { ok: true })
    return true
  }

  return false
}

async function handleDashboard(req, res, state, pathname, auth) {
  if (pathname !== '/api/dashboard/summary' || req.method !== 'GET') return false
  const payload = requireAuth(auth)
  const restaurantId = payload.restaurant.id
  const subscriptionEndsAt = payload.restaurant.subscriptionEndsAt || payload.restaurant.trialEndsAt
  const daysLeft = subscriptionEndsAt ? Math.ceil((new Date(subscriptionEndsAt).getTime() - Date.now()) / 86400000) : null

  send(res, 200, {
    restaurant: payload.restaurant,
    paymentNotice: daysLeft !== null && daysLeft <= 5 ? { subscriptionEndsAt, daysLeft: Math.max(0, daysLeft) } : null,
    employeesOnShift: state.employees.filter((item) => item.restaurantId === restaurantId && item.shiftStatus === 'open').length,
    tasks: state.tasks.filter((item) => item.restaurantId === restaurantId),
    checklists: state.checklistTemplates.filter((item) => item.restaurantId === restaurantId),
    bookings: state.bookings.filter((item) => item.restaurantId === restaurantId),
    technicalRequests: state.technicalRequests.filter((item) => item.restaurantId === restaurantId),
  })
  return true
}

async function handleMobile(req, res, state, pathname, auth) {
  if (!pathname.startsWith('/api/mobile')) return false
  const payload = requireAuth(auth)
  const restaurantId = payload.restaurant.id

  if (pathname === '/api/mobile/overview' && req.method === 'GET') {
    const membership = payload.membership
    const position = membership.position || 'Сотрудник'
    const activeInventory = state.inventoryAssignments.find((item) => item.restaurantId === restaurantId && item.status === 'assigned') || null
    send(res, 200, {
      employee: { name: payload.user.name, position, restaurantName: payload.restaurant.name },
      shift: { status: 'opened', openedAt: '09:42', plannedEndAt: '23:00' },
      cards: {
        checklist: state.checklistTemplates.find((item) => item.restaurantId === restaurantId && item.active),
        tasks: state.tasks.filter((item) => item.restaurantId === restaurantId),
        inventory: activeInventory,
        hallPlan: state.bookings.filter((item) => item.restaurantId === restaurantId),
      },
    })
    return true
  }

  if (pathname === '/api/mobile/hall-plan' && req.method === 'GET') {
    send(res, 200, {
      halls: state.halls.filter((item) => item.restaurantId === restaurantId && item.active !== false),
      tables: state.tables.filter((item) => item.restaurantId === restaurantId && item.active !== false),
      bookings: state.bookings.filter((item) => item.restaurantId === restaurantId),
    })
    return true
  }

  return false
}

async function handleRequest(req, res) {
  const state = await loadState()
  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req))
    res.end()
    return
  }

  const auth = await getAuth(req, state)

  if (pathname === '/api/health') {
    send(res, 200, { ok: true, storage: DATABASE_URL && pgPool ? 'postgres' : 'json', time: nowIso() }, corsHeaders(req))
    return
  }

  if (pathname.startsWith('/api/')) {
    const wrappedSend = res.writeHead.bind(res)
    res.writeHead = (statusCode, headers = {}) => wrappedSend(statusCode, { ...corsHeaders(req), ...headers })

    if (await handleAuth(req, res, state, pathname, auth)) return
    if (await handleServiceOwner(req, res, state, pathname, auth)) return
    if (await handleDashboard(req, res, state, pathname, auth)) return
    if (await handleMobile(req, res, state, pathname, auth)) return
    if (await handleCollections(req, res, state, pathname, auth)) return

    throw httpError(404, 'API endpoint не найден.')
  }

  await serveStatic(req, res, pathname)
}

function corsHeaders(req) {
  const origin = req.headers.origin
  const headers = { 'Vary': 'Origin' }
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PATCH,PUT,DELETE,OPTIONS'
  }
  return headers
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
  }
  return map[ext] || 'application/octet-stream'
}

async function serveStatic(req, res, pathname) {
  let safePath = decodeURIComponent(pathname.split('?')[0])
  if (safePath === '/') safePath = '/index.html'
  const target = path.normalize(path.join(distDir, safePath))
  if (!target.startsWith(distDir)) throw httpError(403, 'Недоступный путь.')

  try {
    const stat = await fs.stat(target)
    if (!stat.isFile()) throw new Error('not file')
    res.writeHead(200, { 'Content-Type': contentType(target) })
    if (req.method === 'HEAD') return res.end()
    res.end(await fs.readFile(target))
  } catch {
    const fallback = path.join(distDir, 'index.html')
    try {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(await fs.readFile(fallback))
    } catch {
      throw httpError(500, 'Frontend не собран. Выполните npm run build.')
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!safeMethods.has(req.method) && !req.headers['content-type']?.includes('application/json') && req.url?.startsWith('/api/')) {
      // Позволяем пустой POST без JSON для logout, но остальные формы должны слать JSON.
    }
    await handleRequest(req, res)
  } catch (error) {
    const status = error.status || 500
    send(res, status, { message: status === 500 ? 'Внутренняя ошибка сервера.' : error.message })
    if (status === 500) console.error(error)
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Resto Control fullstack server started on port ${PORT}`)
})
