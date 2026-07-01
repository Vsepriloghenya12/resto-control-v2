import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const dataDir = path.join(__dirname, 'data')
const jsonFile = path.join(dataDir, 'db.json')
const PORT = Number(process.env.PORT || 4173)
const COOKIE_NAME = 'rc_session'
const DATABASE_URL = process.env.DATABASE_URL || ''
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const ENABLE_DEMO_DATA = process.env.ENABLE_DEMO_DATA === 'true' || (!IS_PRODUCTION && process.env.ENABLE_DEMO_DATA !== 'false')
const SERVICE_OWNER_EMAIL = normalizeLogin(process.env.SERVICE_OWNER_EMAIL || 'admin@resto.local')
const SERVICE_OWNER_PASSWORD = String(process.env.SERVICE_OWNER_PASSWORD || (IS_PRODUCTION ? '' : 'admin123'))
const SERVICE_OWNER_NAME = String(process.env.SERVICE_OWNER_NAME || 'Владелец сервиса')
const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`

const passwordResetTokens = new Map() // token → { userId, expiresAt }

function createMailTransport() {
  if (!SMTP_HOST || !SMTP_USER) return null
  return nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
}

async function sendResetEmail(to, token) {
  const transport = createMailTransport()
  const resetUrl = `${APP_URL}/reset-password?token=${token}`
  const text = `Вы запросили сброс пароля.\n\nСсылка для сброса (действительна 1 час):\n${resetUrl}\n\nЕсли вы не запрашивали сброс — проигнорируйте это письмо.`
  const html = `<p>Вы запросили сброс пароля.</p><p><a href="${resetUrl}">Сбросить пароль</a></p><p>Ссылка действительна 1 час.</p><p>Если вы не запрашивали сброс — проигнорируйте это письмо.</p>`
  if (transport) {
    await transport.sendMail({ from: SMTP_FROM, to, subject: 'Сброс пароля — Ресто Контроль', text, html })
  } else {
    // Dev fallback: print to console
    console.log(`[DEV] Password reset for ${to}: ${resetUrl}`)
  }
}

let pgPool = null
let memoryState = null

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

function nowIso() {
  return new Date().toISOString()
}

function pickFields(obj, fields) {
  const result = {}
  for (const key of fields) {
    if (key in obj) result[key] = obj[key]
  }
  return result
}

const RESTAURANT_SERVICE_OWNER_WRITABLE = ['name', 'status', 'plan', 'subscriptionStatus', 'subscriptionEndsAt', 'trialEndsAt', 'legalType', 'legalName', 'inn', 'kpp', 'ogrn', 'legalAddress', 'bankName', 'bik', 'account', 'corrAccount', 'contactEmail', 'contactPhone', 'edo']
const RESTAURANT_OWNER_WRITABLE = ['name', 'plan', 'legalType', 'legalName', 'inn', 'kpp', 'ogrn', 'legalAddress', 'bankName', 'bik', 'account', 'corrAccount', 'contactEmail', 'contactPhone', 'edo', 'iikoHost', 'iikoLogin', 'iikoPassword', 'qrHost', 'qrLogin', 'qrPassword']

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString()
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

function normalizeLogin(login) {
  const raw = String(login || '').trim().toLowerCase()
  // If looks like a phone number — normalize to digits only, +7 → 8
  if (/^[\d\s\-\+\(\)]+$/.test(raw)) {
    const digits = raw.replace(/\D/g, '')
    if (digits.length >= 7 && digits.length <= 15) {
      // Normalize +7xxxxxxxxxx → 8xxxxxxxxxx
      if (digits.length === 11 && digits.startsWith('7')) return '8' + digits.slice(1)
      return digits
    }
  }
  return raw
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex')
  const storedBuffer = Buffer.from(hash, 'hex')
  const candidateBuffer = Buffer.from(candidate, 'hex')
  if (storedBuffer.length !== candidateBuffer.length) return false
  return crypto.timingSafeEqual(storedBuffer, candidateBuffer)
}

function parseCookies(header = '') {
  return header.split(';').reduce((acc, item) => {
    const index = item.indexOf('=')
    if (index === -1) return acc
    const key = item.slice(0, index).trim()
    try {
      acc[key] = decodeURIComponent(item.slice(index + 1).trim())
    } catch {
      acc[key] = item.slice(index + 1).trim()
    }
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
  state.sessions = Array.isArray(state.sessions)
    ? state.sessions.filter((item) => new Date(item.expiresAt).getTime() > Date.now())
    : []
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


function createEmptyState() {
  const createdAt = nowIso()
  return {
    meta: { version: 1, createdAt, updatedAt: createdAt },
    users: [],
    restaurants: [],
    memberships: [],
    sessions: [],
    employees: [],
    tasks: [],
    checklistRuns: [],
    checklistTemplates: [],
    halls: [],
    tables: [],
    bookings: [],
    inventoryProducts: [],
    inventoryAssignments: [],
    ttkItems: [],
    payments: [],
    technicalRequests: [],
    knowledgeMaterials: [],
    regularGuests: [],
    pushSubscriptions: [],
    staffSchedules: [],
  }
}

const stateArrayKeys = [
  'users',
  'restaurants',
  'memberships',
  'sessions',
  'employees',
  'tasks',
  'checklistRuns',
  'checklistTemplates',
  'halls',
  'tables',
  'bookings',
  'inventoryProducts',
  'inventoryAssignments',
  'ttkItems',
  'payments',
  'technicalRequests',
  'knowledgeMaterials',
  'regularGuests',
  'pushSubscriptions',
  'staffSchedules',
  'orders',
  'attestations',
  'attestationResults',
]

function ensureStateShape(state) {
  if (!state || typeof state !== 'object') return createEmptyState()
  for (const key of stateArrayKeys) {
    if (!Array.isArray(state[key])) state[key] = []
  }
  state.sessions = state.sessions.filter((item) => item?.expiresAt && new Date(item.expiresAt).getTime() > Date.now())
  const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
  state.inventoryAssignments = state.inventoryAssignments.filter((item) => {
    if (item.status !== 'submitted' && item.status !== 'completed') return true
    const ts = item.submittedAt || item.dueDate || item.date || item.createdAt
    return !ts || new Date(ts).getTime() > threeMonthsAgo
  })
  state.meta = { version: 1, ...(state.meta || {}), updatedAt: state.meta?.updatedAt || nowIso() }
  return state
}

function createSeedState() {
  if (!ENABLE_DEMO_DATA) return createEmptyState()

  const createdAt = nowIso()
  const serviceUser = {
    id: 'user_service_owner',
    name: SERVICE_OWNER_NAME,
    login: SERVICE_OWNER_EMAIL,
    passwordHash: hashPassword(SERVICE_OWNER_PASSWORD),
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
    positions: [
      { id: 'pos_1',  restaurantId: restaurant.id, name: 'Официант',         department: 'Зал',     order: 1,  createdAt, updatedAt: createdAt },
      { id: 'pos_2',  restaurantId: restaurant.id, name: 'Старший официант', department: 'Зал',     order: 2,  createdAt, updatedAt: createdAt },
      { id: 'pos_3',  restaurantId: restaurant.id, name: 'Хостес',           department: 'Зал',     order: 3,  createdAt, updatedAt: createdAt },
      { id: 'pos_4',  restaurantId: restaurant.id, name: 'Администратор',    department: 'Зал',     order: 4,  createdAt, updatedAt: createdAt },
      { id: 'pos_5',  restaurantId: restaurant.id, name: 'Управляющий',      department: 'Зал',     order: 5,  createdAt, updatedAt: createdAt },
      { id: 'pos_6',  restaurantId: restaurant.id, name: 'Бармен',           department: 'Бар',     order: 6,  createdAt, updatedAt: createdAt },
      { id: 'pos_7',  restaurantId: restaurant.id, name: 'Старший бармен',   department: 'Бар',     order: 7,  createdAt, updatedAt: createdAt },
      { id: 'pos_8',  restaurantId: restaurant.id, name: 'Повар',            department: 'Кухня',   order: 8,  createdAt, updatedAt: createdAt },
      { id: 'pos_9',  restaurantId: restaurant.id, name: 'Су-шеф',           department: 'Кухня',   order: 9,  createdAt, updatedAt: createdAt },
      { id: 'pos_10', restaurantId: restaurant.id, name: 'Шеф-повар',        department: 'Кухня',   order: 10, createdAt, updatedAt: createdAt },
      { id: 'pos_11', restaurantId: restaurant.id, name: 'Курьер',           department: 'Кухня',   order: 11, createdAt, updatedAt: createdAt },
      { id: 'pos_12', restaurantId: restaurant.id, name: 'Мойщик',           department: 'Клининг', order: 12, createdAt, updatedAt: createdAt },
      { id: 'pos_13', restaurantId: restaurant.id, name: 'Уборщик',          department: 'Клининг', order: 13, createdAt, updatedAt: createdAt },
      { id: 'pos_14', restaurantId: restaurant.id, name: 'Клининг',          department: 'Клининг', order: 14, createdAt, updatedAt: createdAt },
    ],
    tasks: [
      { id: 'task_1', restaurantId: restaurant.id, title: 'Проверить резерв на вечер', description: 'Проверить брони и подготовить зал.', assignmentType: 'position', assignedPosition: 'Администратор', status: 'not_started', dueDate: new Date().toISOString().slice(0, 10), dueTime: '17:00', requiresPhoto: false, active: true, createdAt, updatedAt: createdAt },
      { id: 'task_2', restaurantId: restaurant.id, title: 'Протереть столы на террасе', description: 'Фото не отдельный раздел, а часть задачи.', assignmentType: 'position', assignedPosition: 'Клининг', status: 'overdue', dueDate: new Date().toISOString().slice(0, 10), dueTime: '10:30', requiresPhoto: true, active: true, createdAt, updatedAt: createdAt },
    ],
    checklistRuns: [],
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
    staffSchedules: [],
  }
}



function ensureServiceOwner(state) {
  state = ensureStateShape(state)
  let changed = false

  if (IS_PRODUCTION && !SERVICE_OWNER_PASSWORD) {
    throw new Error('Для production нужно задать переменную SERVICE_OWNER_PASSWORD.')
  }

  if (!state.restaurants.length) {
    const createdAt = nowIso()
    state.restaurants.push({
      id: 'restaurant_service_default',
      name: ENABLE_DEMO_DATA ? 'Resto Control' : 'Сервис Resto Control',
      isServiceHome: !ENABLE_DEMO_DATA,
      legalType: '',
      legalName: '',
      inn: '',
      kpp: '',
      ogrn: '',
      legalAddress: '',
      bankName: '',
      bik: '',
      account: '',
      corrAccount: '',
      contactEmail: SERVICE_OWNER_EMAIL,
      contactPhone: '',
      plan: 'standard',
      subscriptionStatus: 'active',
      trialStartedAt: createdAt,
      trialEndsAt: addDays(new Date(), 14),
      subscriptionEndsAt: addDays(new Date(), 14),
      createdAt,
      updatedAt: createdAt,
    })
    changed = true
  }

  const restaurant = state.restaurants[0]
  const legacyLogin = 'admin@resto.local'
  let serviceUser = state.users.find((user) => user.roleHint === 'service_owner')
    || state.users.find((user) => normalizeLogin(user.login) === SERVICE_OWNER_EMAIL)
    || state.users.find((user) => normalizeLogin(user.login) === legacyLogin)

  if (!serviceUser) {
    const createdAt = nowIso()
    serviceUser = {
      id: 'user_service_owner',
      name: SERVICE_OWNER_NAME,
      login: SERVICE_OWNER_EMAIL,
      passwordHash: hashPassword(SERVICE_OWNER_PASSWORD),
      roleHint: 'service_owner',
      createdAt,
      updatedAt: createdAt,
    }
    state.users.push(serviceUser)
    changed = true
  }

  if (serviceUser.name !== SERVICE_OWNER_NAME) {
    serviceUser.name = SERVICE_OWNER_NAME
    serviceUser.updatedAt = nowIso()
    changed = true
  }

  if (normalizeLogin(serviceUser.login) !== SERVICE_OWNER_EMAIL) {
    serviceUser.login = SERVICE_OWNER_EMAIL
    serviceUser.updatedAt = nowIso()
    changed = true
  }

  if (serviceUser.roleHint !== 'service_owner') {
    serviceUser.roleHint = 'service_owner'
    serviceUser.updatedAt = nowIso()
    changed = true
  }

  if (SERVICE_OWNER_PASSWORD && !verifyPassword(SERVICE_OWNER_PASSWORD, serviceUser.passwordHash)) {
    serviceUser.passwordHash = hashPassword(SERVICE_OWNER_PASSWORD)
    serviceUser.updatedAt = nowIso()
    changed = true
  }

  const existingMembership = state.memberships.find((membership) => membership.userId === serviceUser.id && membership.role === 'service_owner')
  if (!existingMembership) {
    const createdAt = nowIso()
    state.memberships.push({
      id: 'membership_service_owner',
      userId: serviceUser.id,
      restaurantId: restaurant.id,
      role: 'service_owner',
      position: 'Владелец сервиса',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    })
    changed = true
  } else {
    if (existingMembership.restaurantId !== restaurant.id) {
      existingMembership.restaurantId = restaurant.id
      existingMembership.updatedAt = nowIso()
      changed = true
    }
    if (existingMembership.status !== 'active') {
      existingMembership.status = 'active'
      existingMembership.updatedAt = nowIso()
      changed = true
    }
  }

  return changed
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
    if (result.rows[0]?.data) {
      const state = ensureStateShape(result.rows[0].data)
      if (ensureServiceOwner(state)) {
        await pool.query('INSERT INTO resto_state (id, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', ['main', state])
      }
      return state
    }
    const seed = createSeedState()
    ensureServiceOwner(seed)
    await pool.query('INSERT INTO resto_state (id, data) VALUES ($1, $2)', ['main', seed])
    return seed
  }

  if (memoryState) {
    if (ensureServiceOwner(memoryState)) await saveState(memoryState)
    return memoryState
  }
  await fs.mkdir(dataDir, { recursive: true })
  try {
    const content = await fs.readFile(jsonFile, 'utf8')
    try {
      memoryState = ensureStateShape(JSON.parse(content))
    } catch {
      throw new Error('Локальная база server/data/db.json повреждена. Сделайте резервную копию файла и восстановите корректный JSON.')
    }
    if (ensureServiceOwner(memoryState)) await saveState(memoryState)
    return memoryState
  } catch (error) {
    if (error.code && error.code !== 'ENOENT') throw error
    memoryState = createSeedState()
    ensureServiceOwner(memoryState)
    await fs.writeFile(jsonFile, JSON.stringify(memoryState, null, 2))
    return memoryState
  }
}

async function saveState(state) {
  state = ensureStateShape(state)
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

function roleFromPosition(position) {
  const value = String(position || '').toLowerCase()
  if (value.includes('управля')) return 'manager'
  if (value.includes('старш') || value.includes('администратор')) return 'senior'
  return 'employee'
}


function canWriteCollection(name, method, itemId, action, role) {
  if (['service_owner', 'owner', 'manager', 'support'].includes(role)) return true
  if (!['senior', 'employee'].includes(role)) return false

  if (name === 'push-subscriptions' && method === 'POST' && !itemId) return true
  if (name === 'technical-requests' && method === 'POST' && !itemId) return true
  if (name === 'support-chats' && method === 'POST' && !itemId) return true
  if (name === 'support-chats' && itemId && ['PATCH', 'PUT'].includes(method)) return true
  if (name === 'support-messages' && method === 'POST' && !itemId) return true
  if (name === 'checklist-runs' && ['POST', 'PATCH', 'PUT'].includes(method)) return true
  if (name === 'tasks' && itemId && ['PATCH', 'PUT'].includes(method)) return true
  if (name === 'inventory-assignments' && itemId && ['PATCH', 'PUT'].includes(method)) return true
  if (name === 'bookings' && method === 'POST' && !itemId) return true
  if (name === 'bookings' && itemId && action === 'status' && ['PATCH', 'PUT'].includes(method)) return true
  if (name === 'orders' && method === 'POST' && !itemId) return true
  if (name === 'orders' && itemId && ['PATCH', 'PUT'].includes(method)) return true
  if (name === 'attestation-results' && method === 'POST' && !itemId) return true

  return false
}

function collectionByPath(state, name) {
  const allowed = {
    employees: 'employees',
    tasks: 'tasks',
    checklists: 'checklistTemplates',
    'checklist-runs': 'checklistRuns',
    halls: 'halls',
    tables: 'tables',
    bookings: 'bookings',
    payments: 'payments',
    'technical-requests': 'technicalRequests',
    knowledge: 'knowledgeMaterials',
    guests: 'regularGuests',
    'push-subscriptions': 'pushSubscriptions',
    'staff-schedules': 'staffSchedules',
    'inventory-assignments': 'inventoryAssignments',
    'inventory-products': 'inventoryProducts',
    ttk: 'ttkItems',
    'menu-items': 'menuItems',
    'support-chats': 'supportChats',
    'support-messages': 'supportMessages',
    orders: 'orders',
    attestations: 'attestations',
    'attestation-results': 'attestationResults',
    positions: 'positions',
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

  if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    const body = await readBody(req)
    const login = normalizeLogin(body.email || body.login)
    if (!login) throw httpError(400, 'Введите email.')
    const user = state.users.find((u) => u.login === login)
    // Always return success to avoid user enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      passwordResetTokens.set(token, { userId: user.id, expiresAt: Date.now() + 60 * 60 * 1000 })
      await sendResetEmail(login, token)
    }
    send(res, 200, { ok: true, message: 'Если аккаунт существует, письмо со ссылкой будет отправлено.' })
    return true
  }

  if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
    const body = await readBody(req)
    const token = String(body.token || '')
    const password = String(body.password || '')
    if (!token || password.length < 6) throw httpError(400, 'Неверный токен или пароль (минимум 6 символов).')
    const entry = passwordResetTokens.get(token)
    if (!entry || entry.expiresAt < Date.now()) throw httpError(400, 'Ссылка недействительна или истекла.')
    const user = state.users.find((u) => u.id === entry.userId)
    if (!user) throw httpError(400, 'Пользователь не найден.')
    user.passwordHash = hashPassword(password)
    user.updatedAt = nowIso()
    passwordResetTokens.delete(token)
    await saveState(state)
    send(res, 200, { ok: true, message: 'Пароль успешно изменён. Войдите с новым паролем.' })
    return true
  }

  return false
}

async function handleServiceOwner(req, res, state, pathname, auth) {
  if (!pathname.startsWith('/api/service-owner')) return false
  const payload = requireRole(auth, ['service_owner'])

  function restaurantOwner(restaurantId) {
    const ownerMembership = state.memberships.find((item) => item.restaurantId === restaurantId && item.role === 'owner')
    const owner = state.users.find((item) => item.id === ownerMembership?.userId)
    return owner ? cleanUser(owner) : null
  }

  function serviceHomeRestaurant() {
    let home = state.restaurants.find((item) => item.isServiceHome)
    if (!home) {
      const createdAt = nowIso()
      home = {
        id: id('restaurant_service'),
        name: 'Сервис Resto Control',
        isServiceHome: true,
        plan: 'service',
        subscriptionStatus: 'active',
        createdAt,
        updatedAt: createdAt,
      }
      state.restaurants.push(home)
    }
    return home
  }

  function publicRestaurants() {
    return state.restaurants
      .filter((restaurant) => !restaurant.isServiceHome)
      .map((restaurant) => {
        const payments = state.payments.filter((item) => item.restaurantId === restaurant.id)
        const pendingPayments = payments.filter((item) => ['payment_reported', 'payment_order_attached', 'overdue', 'issued'].includes(String(item.status))).length
        const latestInvoice = [...payments].sort((a, b) => String(b.issuedAt || b.createdAt || '').localeCompare(String(a.issuedAt || a.createdAt || '')))[0]
        return {
          ...restaurant,
          owner: restaurantOwner(restaurant.id),
          ownerName: restaurantOwner(restaurant.id)?.name || restaurant.ownerName || '',
          email: restaurantOwner(restaurant.id)?.login || restaurant.contactEmail || restaurant.email || '',
          phone: restaurant.contactPhone || restaurant.phone || '',
          employeesCount: state.employees.filter((item) => item.restaurantId === restaurant.id && item.status !== 'deleted').length,
          invoicesCount: payments.length,
          pendingPayments,
          latestInvoice,
          payments,
          checklistsCount: (state.checklists || []).filter((item) => item.restaurantId === restaurant.id).length,
          tasksCount: (state.tasks || []).filter((item) => item.restaurantId === restaurant.id).length,
          tasksOpenCount: (state.tasks || []).filter((item) => item.restaurantId === restaurant.id && !['done','cancelled'].includes(String(item.status || ''))).length,
          bookingsCount: (state.bookings || []).filter((item) => item.restaurantId === restaurant.id).length,
          inventoryAssignmentsCount: (state.inventoryAssignments || []).filter((item) => item.restaurantId === restaurant.id).length,
          ttkCount: (state.ttk || []).filter((item) => item.restaurantId === restaurant.id).length,
          knowledgeCount: (state.knowledgeBase || []).filter((item) => item.restaurantId === restaurant.id).length,
          attestationsCount: (state.attestations || []).filter((item) => item.restaurantId === restaurant.id).length,
          checklistRunsCount: (state.checklistRuns || []).filter((item) => item.restaurantId === restaurant.id).length,
          hasSupportAccess: (() => {
            const serviceUser = state.users.find((u) => u.roleHint === 'service_owner')
            return serviceUser
              ? state.memberships.some((m) => m.userId === serviceUser.id && m.restaurantId === restaurant.id && m.role === 'support' && m.status === 'active')
              : false
          })(),
        }
      })
  }

  if (pathname === '/api/service-owner/overview' && req.method === 'GET') {
    const restaurants = publicRestaurants()
    const restaurantIds = new Set(restaurants.map((restaurant) => restaurant.id))
    const payments = state.payments.filter((item) => restaurantIds.has(item.restaurantId))
    send(res, 200, { restaurants, payments })
    return true
  }

  if (pathname === '/api/service-owner/restaurants' && req.method === 'POST') {
    const body = await readBody(req)
    const restaurantName = String(body.restaurantName || body.name || '').trim()
    const ownerName = String(body.ownerName || '').trim()
    const login = normalizeLogin(body.login)
    const password = String(body.password || '')
    if (!restaurantName || !ownerName || !login || password.length < 6) {
      throw httpError(400, 'Заполните ресторан, владельца, логин и пароль от 6 символов.')
    }
    if (state.users.some((user) => user.login === login)) {
      throw httpError(409, 'Пользователь с таким логином уже существует.')
    }
    const createdAt = nowIso()
    const user = { id: id('user'), name: ownerName, login, passwordHash: hashPassword(password), roleHint: 'owner', createdAt, updatedAt: createdAt }
    const restaurant = {
      id: id('restaurant'),
      name: restaurantName,
      city: String(body.city || '').trim(),
      contactPhone: String(body.phone || '').trim(),
      contactEmail: login,
      plan: body.plan || 'trial',
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
    await saveState(state)
    send(res, 201, { restaurant, owner: cleanUser(user), membership })
    return true
  }

  const restaurantPatch = pathname.match(/^\/api\/service-owner\/restaurants\/([^/]+)$/)
  if (restaurantPatch && (req.method === 'PATCH' || req.method === 'PUT')) {
    const restaurant = state.restaurants.find((item) => item.id === restaurantPatch[1] && !item.isServiceHome)
    if (!restaurant) throw httpError(404, 'Ресторан не найден.')
    const body = await readBody(req)
    Object.assign(restaurant, pickFields(body, RESTAURANT_SERVICE_OWNER_WRITABLE), { updatedAt: nowIso() })
    await saveState(state)
    send(res, 200, restaurant)
    return true
  }

  const restaurantExtend = pathname.match(/^\/api\/service-owner\/restaurants\/([^/]+)\/extend$/)
  if (restaurantExtend && (req.method === 'PATCH' || req.method === 'PUT')) {
    const restaurant = state.restaurants.find((item) => item.id === restaurantExtend[1] && !item.isServiceHome)
    if (!restaurant) throw httpError(404, 'Ресторан не найден.')
    const body = await readBody(req)
    const days = Number(body.days || 30)
    const baseDate = restaurant.subscriptionEndsAt && new Date(restaurant.subscriptionEndsAt).getTime() > Date.now() ? new Date(restaurant.subscriptionEndsAt) : new Date()
    restaurant.subscriptionEndsAt = addDays(baseDate, days)
    restaurant.subscriptionStatus = 'active'
    restaurant.status = 'active'
    restaurant.updatedAt = nowIso()
    await saveState(state)
    send(res, 200, restaurant)
    return true
  }

  const restaurantEnter = pathname.match(/^\/api\/service-owner\/restaurants\/([^/]+)\/enter$/)
  if (restaurantEnter && req.method === 'POST') {
    const restaurantId = restaurantEnter[1]
    const serviceUser = state.users.find((u) => u.id === payload.user.id)
    if (!serviceUser) throw httpError(404, 'Пользователь не найден.')
    const supportMembership = state.memberships.find((m) => m.userId === serviceUser.id && m.restaurantId === restaurantId && m.role === 'support' && m.status === 'active')
    if (!supportMembership) throw httpError(403, 'Доступ не предоставлен.')
    const session = createSession(state, serviceUser, supportMembership, true)
    await saveState(state)
    send(res, 200, sessionPayload(state, session), { 'Set-Cookie': cookieHeader(session) })
    return true
  }

  const restaurantDelete = pathname.match(/^\/api\/service-owner\/restaurants\/([^/]+)$/)
  if (restaurantDelete && req.method === 'DELETE') {
    const restaurantId = restaurantDelete[1]
    const restaurant = state.restaurants.find((item) => item.id === restaurantId && !item.isServiceHome)
    if (!restaurant) throw httpError(404, 'Ресторан не найден.')

    const home = serviceHomeRestaurant()
    const removedMembershipIds = new Set()
    const removedUserIds = new Set()

    for (const membership of state.memberships) {
      if (membership.restaurantId !== restaurantId) continue
      if (membership.role === 'service_owner') {
        membership.restaurantId = home.id
        membership.updatedAt = nowIso()
      } else {
        removedMembershipIds.add(membership.id)
        removedUserIds.add(membership.userId)
      }
    }

    state.sessions = state.sessions
      .filter((session) => !removedMembershipIds.has(session.membershipId))
      .map((session) => {
        if (session.userId === payload.user.id && session.restaurantId === restaurantId) {
          return { ...session, restaurantId: home.id }
        }
        return session
      })
    state.memberships = state.memberships.filter((membership) => !removedMembershipIds.has(membership.id))
    state.users = state.users.filter((user) => !removedUserIds.has(user.id) || state.memberships.some((membership) => membership.userId === user.id))

    const keys = ['employees', 'tasks', 'checklistTemplates', 'checklistRuns', 'halls', 'tables', 'bookings', 'payments', 'technicalRequests', 'knowledgeMaterials', 'regularGuests', 'pushSubscriptions', 'staffSchedules', 'inventoryAssignments', 'inventoryProducts', 'ttkItems', 'supportChats', 'supportMessages', 'orders', 'attestations', 'attestationResults', 'positions']
    for (const key of keys) {
      if (Array.isArray(state[key])) state[key] = state[key].filter((item) => item.restaurantId !== restaurantId)
    }
    state.restaurants = state.restaurants.filter((item) => item.id !== restaurantId)
    await saveState(state)
    send(res, 200, { ok: true })
    return true
  }

  return false
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickDistractors(correct, pool, count = 3) {
  const others = pool.filter((v) => v !== correct)
  return shuffle(others).slice(0, count)
}

function makeOptions(correct, distractors) {
  const opts = shuffle([correct, ...distractors])
  return { options: opts, correctIndex: opts.indexOf(correct) }
}

const MENU_DECOYS = [
  'Суп харчо', 'Жульен с грибами', 'Котлета по-киевски', 'Борщ украинский',
  'Пельмени сибирские', 'Оливье с колбасой', 'Цезарь с курицей', 'Греческий салат',
  'Форель на гриле', 'Рататуй', 'Тирамису', 'Наполеон', 'Медовик', 'Лазанья',
  'Карбонара', 'Ризотто с грибами', 'Том ям', 'Утка по-пекински', 'Паэлья',
]

function generateAttestationQuestions(state, restaurantId, type) {
  const questions = []
  const qid = () => `q_${Math.random().toString(36).slice(2, 10)}`

  if (type === 'menu' || type === 'full') {
    const ttkItems = (state.ttkItems || []).filter((i) => i.restaurantId === restaurantId)
    const menuItems = (state.menuItems || []).filter((i) => i.restaurantId === restaurantId)
    const items = [...ttkItems, ...menuItems.map((i) => ({ ...i, group: i.category, cookingTime: null, gastroPairs: [] }))]
    const groups = [...new Set(items.map((i) => i.group || i.groupId).filter(Boolean))]
    const prices = [...new Set(items.map((i) => i.price).filter((p) => p > 0))]
    const times = [...new Set(items.map((i) => i.cookingTime).filter(Boolean))]

    // Price questions
    items.filter((i) => i.price > 0).forEach((item) => {
      const distractors = pickDistractors(item.price, prices)
      if (distractors.length < 3) return
      const { options, correctIndex } = makeOptions(item.price, distractors)
      questions.push({ id: qid(), source: 'ttk', sourceId: item.id, text: `Какова цена блюда «${item.name}»?`, options: options.map((p) => `${p} ₽`), correctIndex })
    })

    // Cooking time questions
    items.filter((i) => i.cookingTime).forEach((item) => {
      const distractors = pickDistractors(item.cookingTime, times)
      if (distractors.length < 3) return
      const { options, correctIndex } = makeOptions(item.cookingTime, distractors)
      questions.push({ id: qid(), source: 'ttk', sourceId: item.id, text: `Сколько времени готовится «${item.name}»?`, options, correctIndex })
    })

    // Gastro pair questions
    items.filter((i) => Array.isArray(i.gastroPairs) && i.gastroPairs.length > 0).forEach((item) => {
      const pairIds = i.gastroPairs || item.gastroPairs
      const pairItem = items.find((x) => pairIds.includes(x.id))
      if (!pairItem) return
      const distItems = shuffle(items.filter((x) => !pairIds.includes(x.id) && x.id !== item.id)).slice(0, 3)
      if (distItems.length < 3) return
      const opts = shuffle([pairItem, ...distItems])
      const correctIndex = opts.indexOf(pairItem)
      questions.push({ id: qid(), source: 'ttk', sourceId: item.id, text: `Что из перечисленного является гастропарой к «${item.name}»?`, options: opts.map((x) => x.name), correctIndex })

      // Negative: which is NOT a gastro pair
      const notPair = distItems[0]
      const notOpts = shuffle([notPair, ...shuffle(items.filter((x) => pairIds.includes(x.id))).slice(0, 3)])
      const notCorrectIndex = notOpts.indexOf(notPair)
      questions.push({ id: qid(), source: 'ttk', sourceId: item.id, text: `Что из перечисленного НЕ является гастропарой к «${item.name}»?`, options: notOpts.map((x) => x.name), correctIndex: notCorrectIndex })
    })

    // Category questions
    groups.forEach((group) => {
      const inGroup = items.filter((i) => (i.group || i.groupId) === group)
      const outGroup = items.filter((i) => (i.group || i.groupId) !== group)
      if (inGroup.length < 1 || outGroup.length < 3) return
      const correct = shuffle(inGroup)[0]
      const distractors = shuffle(outGroup).slice(0, 3)
      const { options, correctIndex } = makeOptions(correct.name, distractors.map((x) => x.name))
      const groupName = correct.group || group
      questions.push({ id: qid(), source: 'ttk', sourceId: correct.id, text: `Какое из блюд относится к категории «${groupName}»?`, options, correctIndex })

      if (inGroup.length >= 4) {
        const impostor = shuffle(outGroup)[0]
        const realOnes = shuffle(inGroup).slice(0, 3)
        const opts2 = shuffle([impostor, ...realOnes])
        const ci2 = opts2.indexOf(impostor)
        questions.push({ id: qid(), source: 'ttk', sourceId: impostor.id, text: `Какое из блюд НЕ относится к категории «${groupName}»?`, options: opts2.map((x) => x.name), correctIndex: ci2 })
      }
    })

    // "Spot the real dish" questions — work even with 1 item
    const realNames = new Set(items.map((i) => i.name))
    const availableDecoys = MENU_DECOYS.filter((n) => !realNames.has(n))
    items.forEach((item) => {
      const decoys = shuffle(availableDecoys).slice(0, 3)
      if (decoys.length < 3) return
      const { options, correctIndex } = makeOptions(item.name, decoys)
      questions.push({ id: qid(), source: 'ttk', sourceId: item.id, text: 'Какое из перечисленных блюд есть в нашем меню?', options, correctIndex })
    })

    // Extras (описание доп) questions
    items.filter((i) => i.extras && String(i.extras).trim().length > 10).forEach((item) => {
      const others = shuffle(items.filter((x) => x.extras && x.id !== item.id)).slice(0, 3)
      if (others.length < 3) return
      const opts = shuffle([item, ...others])
      const ci = opts.indexOf(item)
      questions.push({ id: qid(), source: 'ttk', sourceId: item.id, text: `К какому блюду относится описание допов: «${String(item.extras).slice(0, 80)}»?`, options: opts.map((x) => x.name), correctIndex: ci })
    })
  }

  if (type === 'knowledge' || type === 'full') {
    const materials = (state.knowledgeMaterials || []).filter((m) => m.restaurantId === restaurantId && Array.isArray(m.questions) && m.questions.length > 0)
    materials.forEach((material) => {
      material.questions.forEach((q) => {
        if (!q.text || !Array.isArray(q.options) || q.options.length < 2 || q.correctIndex == null) return
        questions.push({ id: qid(), source: 'knowledge', sourceId: material.id, text: q.text, options: q.options, correctIndex: q.correctIndex })
      })
    })
  }

  return shuffle(questions).slice(0, 30)
}

async function handleCollections(req, res, state, pathname, auth) {
  const match = pathname.match(/^\/api\/(employees|tasks|checklists|checklist-runs|halls|tables|bookings|payments|technical-requests|knowledge|guests|push-subscriptions|staff-schedules|inventory-assignments|inventory-products|ttk|menu-items|support-chats|support-messages|orders|attestations|attestation-results|positions)(?:\/([^/]+))?(?:\/([^/]+))?$/)
  if (!match) return false
  const [, name, itemId, action] = match
  const collection = collectionByPath(state, name)
  if (!collection) return false
  const payload = requireAuth(auth)
  const role = payload.membership.role
  const currentRestaurantId = restaurantIdFrom(auth)

  if (!safeMethods.has(req.method) && !canWriteCollection(name, req.method, itemId, action, role)) {
    throw httpError(403, 'Недостаточно прав для изменения этого раздела.')
  }

  if (name === 'attestations' && req.method === 'POST' && !itemId) {
    const body = await readBody(req)
    if (!['full', 'menu', 'knowledge'].includes(body.type)) throw httpError(400, 'Неверный тип аттестации.')
    const questions = generateAttestationQuestions(state, currentRestaurantId, body.type)
    if (questions.length === 0) throw httpError(400, 'Недостаточно данных для генерации вопросов. Добавьте блюда в номенклатуру или вопросы в базу знаний.')
    const item = {
      id: id('attest'),
      restaurantId: currentRestaurantId,
      title: String(body.title || '').trim() || `Аттестация ${new Date().toLocaleDateString('ru')}`,
      type: body.type,
      status: 'active',
      employeeIds: Array.isArray(body.employeeIds) ? body.employeeIds : [],
      deadline: body.deadline || null,
      questions,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    collection.items.push(item)
    await saveState(state)
    send(res, 201, item)
    return true
  }

  if (name === 'tasks' && itemId && action === 'comments' && req.method === 'POST') {
    const body = await readBody(req)
    const task = collection.items.find((i) => i.id === itemId && i.restaurantId === currentRestaurantId)
    if (!task) throw httpError(404, 'Задача не найдена')
    if (!String(body.text || '').trim()) throw httpError(400, 'Текст комментария обязателен')
    if (!task.comments) task.comments = []
    const comment = { id: id('cmt'), text: String(body.text).trim(), authorName: String(body.authorName || payload.user.name || 'Менеджер'), createdAt: nowIso() }
    task.comments.push(comment)
    task.updatedAt = nowIso()
    await saveState(state)
    send(res, 201, comment)
    return true
  }

  if (name === 'checklist-runs' && itemId && action === 'comments' && req.method === 'POST') {
    const body = await readBody(req)
    const run = collection.items.find((i) => i.id === itemId && i.restaurantId === currentRestaurantId)
    if (!run) throw httpError(404, 'Чек-лист не найден')
    if (!String(body.text || '').trim()) throw httpError(400, 'Текст комментария обязателен')
    if (!run.comments) run.comments = []
    const comment = { id: id('cmt'), text: String(body.text).trim(), authorName: String(body.authorName || payload.user.name || 'Сотрудник'), createdAt: nowIso() }
    run.comments.push(comment)
    run.updatedAt = nowIso()
    await saveState(state)
    send(res, 201, comment)
    return true
  }

  if (name === 'push-subscriptions' && req.method === 'POST') {
    const body = await readBody(req)
    const item = { id: id('push'), userId: payload.user.id, restaurantId: currentRestaurantId, subscription: body.subscription || body, createdAt: nowIso(), updatedAt: nowIso() }
    collection.items.push(item)
    await saveState(state)
    send(res, 201, item)
    return true
  }

  if (req.method === 'GET' && !itemId) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    let result = collection.items
    if (role !== 'service_owner') result = result.filter((item) => !item.restaurantId || item.restaurantId === currentRestaurantId)
    if (name === 'support-messages') {
      const chatId = url.searchParams.get('chatId')
      if (chatId) result = result.filter((item) => item.chatId === chatId)
    }
    if (name === 'employees') {
      result = result.map((emp) => {
        const u = state.users.find((u) => u.id === emp.userId)
        const pt = emp.passwordText || (u && u.passwordText) || undefined
        if (pt !== undefined) return { ...emp, passwordText: pt }
        return emp
      })
    }
    send(res, 200, { items: result })
    return true
  }

  if (req.method === 'POST' && !itemId) {
    const body = await readBody(req)
    if (name === 'employees' && String(body.position || '').toLowerCase().includes('кладов')) {
      throw httpError(400, 'Должность «Кладовщик» не используется. Используйте «Клининг».')
    }
    const targetRestaurantId = role === 'service_owner' && body.restaurantId ? body.restaurantId : currentRestaurantId
    if (role === 'service_owner' && body.restaurantId && !state.restaurants.find((r) => r.id === body.restaurantId)) {
      throw httpError(404, 'Ресторан не найден.')
    }

    if (name === 'employees') {
      const login = normalizeLogin(body.login)
      const password = String(body.password || '')
      if (!String(body.name || '').trim() || !login || !String(body.position || '').trim() || password.length < 1) {
        throw httpError(400, 'Заполните имя, телефон/email, должность и временный пароль.')
      }
      if (state.users.some((user) => user.login === login)) {
        throw httpError(409, 'Пользователь с таким телефоном или email уже существует.')
      }
      const createdAt = nowIso()
      const employeeRole = roleFromPosition(body.position)
      const user = { id: id('user'), name: String(body.name).trim(), login, passwordHash: hashPassword(password), passwordText: password, roleHint: employeeRole, createdAt, updatedAt: createdAt }
      const membership = { id: id('membership'), userId: user.id, restaurantId: targetRestaurantId, role: employeeRole, position: body.position, status: 'active', createdAt, updatedAt: createdAt }
      const employee = {
        id: id('employee'),
        restaurantId: targetRestaurantId,
        userId: user.id,
        name: user.name,
        login,
        position: body.position,
        status: body.status || 'active',
        shiftStatus: body.shiftStatus || 'closed',
        attestationPercent: Number(body.attestationPercent || 0),
        passwordText: password,
        createdAt,
        updatedAt: createdAt,
      }
      state.users.push(user)
      state.memberships.push(membership)
      collection.items.push(employee)
      await saveState(state)
      send(res, 201, employee)
      return true
    }

    const item = {
      id: id(name.replace(/-/g, '_')),
      restaurantId: targetRestaurantId,
      ...body,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    collection.items.push(item)

    if (name === 'support-messages' && item.chatId) {
      if (!Array.isArray(state.supportChats)) state.supportChats = []
      const chat = state.supportChats.find((c) => c.id === item.chatId)
      if (chat) {
        chat.lastMessageAt = item.createdAt
        chat.updatedAt = item.createdAt
        if (item.fromService) {
          chat.unreadByRestaurant = true
        } else {
          chat.unreadByService = true
        }
      }
    }

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
      const { password, ...rest } = body
      Object.assign(item, rest, { updatedAt: nowIso() })
      if (name === 'employees') {
        const user = state.users.find((u) => u.id === item.userId)
        if (user) {
          if (rest.login) user.login = normalizeLogin(rest.login)
          if (rest.name) user.name = String(rest.name).trim()
          if (password && String(password).trim().length >= 1) {
            user.passwordHash = hashPassword(String(password).trim())
            user.passwordText = String(password).trim()
            item.passwordText = String(password).trim()
          }
          user.updatedAt = nowIso()
        }
        const membership = state.memberships.find((m) => m.userId === item.userId && m.restaurantId === item.restaurantId)
        if (membership && rest.position) {
          membership.position = rest.position
          membership.role = roleFromPosition(rest.position)
          membership.updatedAt = nowIso()
        }
      }
    }
    await saveState(state)
    send(res, 200, item)
    return true
  }

  if (req.method === 'DELETE' && itemId) {
    if (name === 'employees' && item.userId) {
      state.memberships = state.memberships.filter((membership) => membership.userId !== item.userId || membership.restaurantId !== item.restaurantId)
      if (!state.memberships.some((membership) => membership.userId === item.userId)) {
        state.users = state.users.filter((user) => user.id !== item.userId)
      }
      state.sessions = state.sessions.filter((session) => session.userId !== item.userId)
    }
    state[collection.key] = collection.items.filter((entry) => entry.id !== itemId)
    await saveState(state)
    send(res, 200, { ok: true })
    return true
  }

  return false
}



async function handleMyRestaurants(req, res, state, pathname, auth) {
  if (!pathname.startsWith('/api/my-restaurants')) return false
  const payload = requireRole(auth, ['owner', 'manager'])
  const userId = payload.user.id

  if (pathname === '/api/my-restaurants' && req.method === 'GET') {
    const memberships = state.memberships.filter((item) => item.userId === userId && item.status === 'active' && ['owner', 'manager'].includes(item.role))
    const restaurants = memberships
      .map((membership) => state.restaurants.find((restaurant) => restaurant.id === membership.restaurantId))
      .filter(Boolean)
      .map((restaurant) => ({ ...restaurant, isCurrent: restaurant.id === payload.restaurant.id }))
    send(res, 200, { items: restaurants })
    return true
  }

  if (pathname === '/api/my-restaurants' && req.method === 'POST') {
    const body = await readBody(req)
    const name = String(body.name || '').trim()
    if (!name) throw httpError(400, 'Введите название ресторана.')
    const createdAt = nowIso()
    const restaurant = {
      id: id('restaurant'),
      name,
      plan: 'trial',
      subscriptionStatus: 'trial',
      trialStartedAt: createdAt,
      trialEndsAt: addDays(new Date(), 14),
      subscriptionEndsAt: addDays(new Date(), 14),
      createdAt,
      updatedAt: createdAt,
    }
    const membership = { id: id('membership'), userId, restaurantId: restaurant.id, role: payload.membership.role, position: payload.membership.position || 'Владелец', status: 'active', createdAt, updatedAt: createdAt }
    state.restaurants.push(restaurant)
    state.memberships.push(membership)
    state.halls.push({ id: id('hall'), restaurantId: restaurant.id, name: 'Основной зал', tablesCount: 0, seatsCount: 0, active: true, createdAt, updatedAt: createdAt })
    const oldSessionId = auth.session.id
    const session = createSession(state, payload.user, membership, true)
    await saveState(state)
    state.sessions = state.sessions.filter((item) => item.id !== oldSessionId)
    send(res, 201, sessionPayload(state, session), { 'Set-Cookie': cookieHeader(session) })
    return true
  }

  const switchMatch = pathname.match(/^\/api\/my-restaurants\/([^/]+)\/switch$/)
  if (switchMatch && req.method === 'POST') {
    const restaurantId = switchMatch[1]
    const membership = state.memberships.find((item) => item.userId === userId && item.restaurantId === restaurantId && item.status === 'active')
    if (!membership) throw httpError(404, 'Доступ к ресторану не найден.')
    const oldSessionId = auth.session.id
    const session = createSession(state, payload.user, membership, true)
    await saveState(state)
    state.sessions = state.sessions.filter((item) => item.id !== oldSessionId)
    send(res, 200, sessionPayload(state, session), { 'Set-Cookie': cookieHeader(session) })
    return true
  }

  return false
}

async function handleRestaurant(req, res, state, pathname, auth) {
  if (pathname !== '/api/restaurant') return false
  const payload = requireRole(auth, ['owner', 'manager', 'service_owner'])
  const restaurantId = payload.restaurant.id
  const restaurant = state.restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) throw httpError(404, 'Ресторан не найден.')

  if (req.method === 'GET') {
    send(res, 200, restaurant)
    return true
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = await readBody(req)
    const allowed = payload.membership.role === 'service_owner' ? RESTAURANT_SERVICE_OWNER_WRITABLE : RESTAURANT_OWNER_WRITABLE
    Object.assign(restaurant, pickFields(body, allowed), { updatedAt: nowIso() })
    await saveState(state)
    send(res, 200, restaurant)
    return true
  }

  return false
}

async function handleSupportAccess(req, res, state, pathname, auth) {
  if (!pathname.startsWith('/api/support-access')) return false

  const payload = requireRole(auth, ['owner', 'manager', 'service_owner'])
  const restaurantId = payload.restaurant.id

  if (pathname === '/api/support-access/status' && req.method === 'GET') {
    const serviceUser = state.users.find((u) => u.roleHint === 'service_owner')
    const hasAccess = serviceUser
      ? state.memberships.some((m) => m.userId === serviceUser.id && m.restaurantId === restaurantId && m.role === 'support' && m.status === 'active')
      : false
    send(res, 200, { hasAccess })
    return true
  }

  if (pathname === '/api/support-access/grant' && req.method === 'POST') {
    const serviceUser = state.users.find((u) => u.roleHint === 'service_owner')
    if (!serviceUser) throw httpError(404, 'Владелец сервиса не найден.')
    const existing = state.memberships.find((m) => m.userId === serviceUser.id && m.restaurantId === restaurantId && m.role === 'support')
    if (existing) {
      existing.status = 'active'
      existing.updatedAt = nowIso()
    } else {
      const createdAt = nowIso()
      state.memberships.push({ id: id('membership'), userId: serviceUser.id, restaurantId, role: 'support', position: 'Тех. поддержка', status: 'active', createdAt, updatedAt: createdAt })
    }
    await saveState(state)
    send(res, 200, { hasAccess: true })
    return true
  }

  if (pathname === '/api/support-access/revoke' && req.method === 'POST') {
    const serviceUser = state.users.find((u) => u.roleHint === 'service_owner')
    if (!serviceUser) throw httpError(404, 'Владелец сервиса не найден.')
    for (const m of state.memberships) {
      if (m.userId === serviceUser.id && m.restaurantId === restaurantId && m.role === 'support') {
        m.status = 'inactive'
        m.updatedAt = nowIso()
      }
    }
    await saveState(state)
    send(res, 200, { hasAccess: false })
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

  const employees = state.employees.filter((item) => item.restaurantId === restaurantId)
  const tasks = state.tasks.filter((item) => item.restaurantId === restaurantId)
  const checklists = state.checklistTemplates.filter((item) => item.restaurantId === restaurantId)
  const checklistRuns = (state.checklistRuns || []).filter((item) => item.restaurantId === restaurantId)
  const bookings = state.bookings.filter((item) => item.restaurantId === restaurantId)
  const technicalRequests = state.technicalRequests.filter((item) => item.restaurantId === restaurantId)
  const inventoryAssignments = state.inventoryAssignments.filter((item) => item.restaurantId === restaurantId)
  const inventoryProducts = state.inventoryProducts.filter((item) => item.restaurantId === restaurantId)
  const ttkItems = state.ttkItems.filter((item) => item.restaurantId === restaurantId)
  const staffSchedules = (state.staffSchedules || []).filter((item) => item.restaurantId === restaurantId)
  const payments = state.payments.filter((item) => item.restaurantId === restaurantId)
  const halls = state.halls.filter((item) => item.restaurantId === restaurantId)
  const tables = state.tables.filter((item) => item.restaurantId === restaurantId)
  const knowledgeMaterials = state.knowledgeMaterials.filter((item) => item.restaurantId === restaurantId)
  const guests = state.regularGuests.filter((item) => item.restaurantId === restaurantId)
  const attestationResults = (state.attestationResults || []).filter((item) => item.restaurantId === restaurantId)

  send(res, 200, {
    restaurant: payload.restaurant,
    paymentNotice: daysLeft !== null && daysLeft <= 5 ? { subscriptionEndsAt, daysLeft: Math.max(0, daysLeft) } : null,
    employeesOnShift: employees.filter((item) => item.shiftStatus === 'open').length,
    employees,
    tasks,
    checklists,
    checklistRuns,
    bookings,
    technicalRequests,
    inventoryAssignments,
    inventoryProducts,
    ttkItems,
    staffSchedules,
    payments,
    halls,
    tables,
    knowledgeMaterials,
    guests,
    attestationResults,
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


  if (pathname === '/api/mobile/shift' && req.method === 'PATCH') {
    const body = await readBody(req)
    const isOpen = Boolean(body.open)
    let employee = state.employees.find((item) => item.restaurantId === restaurantId && item.userId === payload.user.id)
    if (!employee) {
      const createdAt = nowIso()
      employee = {
        id: id('employee'),
        restaurantId,
        userId: payload.user.id,
        name: payload.user.name,
        login: payload.user.login,
        position: payload.membership.position || 'Сотрудник',
        status: 'active',
        shiftStatus: 'closed',
        attestationPercent: 0,
        createdAt,
        updatedAt: createdAt,
      }
      state.employees.push(employee)
    }
    employee.shiftStatus = isOpen ? 'open' : 'closed'
    employee.shiftUpdatedAt = nowIso()
    employee.updatedAt = nowIso()
    await saveState(state)
    send(res, 200, { ok: true, shiftStatus: employee.shiftStatus, employee })
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

// ─── iiko proxy ───────────────────────────────────────────────────────────────

function sha1(str) {
  return crypto.createHash('sha1').update(str).digest('hex')
}

function iikoGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data.trim() }))
    }).on('error', reject)
  })
}

async function iikoToken(host, login, password) {
  const passHash = sha1(password)
  const { status, body } = await iikoGet(`https://${host}/resto/api/auth?login=${encodeURIComponent(login)}&pass=${encodeURIComponent(passHash)}`)
  if (status !== 200 || !body || body.length < 8) throw new Error(`Ошибка авторизации iiko (HTTP ${status}): ${body.slice(0, 100)}`)
  return body.trim()
}

async function handleIiko(req, res, state, pathname, auth) {
  if (!pathname.startsWith('/api/iiko/') && !pathname.startsWith('/api/quickresto/')) return false
  const payload = requireAuth(auth)
  const restaurant = payload.restaurant

  if (pathname === '/api/iiko/test' && req.method === 'POST') {
    const body = await readBody(req)
    const host = body.host || restaurant.iikoHost
    const login = body.login || restaurant.iikoLogin
    const password = body.password || restaurant.iikoPassword
    if (!host || !login || !password) throw httpError(400, 'Укажите хост, логин и пароль iiko.')
    const token = await iikoToken(host, login, password)
    send(res, 200, { ok: true, token: token.slice(0, 8) + '...' })
    return true
  }

  if (pathname === '/api/quickresto/test' && req.method === 'POST') {
    const body = await readBody(req)
    const host = (body.host || restaurant.qrHost || '').trim()
    const login = (body.login || restaurant.qrLogin || '').trim()
    const password = body.password || restaurant.qrPassword || ''
    if (!host || !login || !password) throw httpError(400, 'Укажите хост, логин и пароль Quick Resto.')
    // Quick Resto: Basic Auth GET /platform/online/api/nomenclature/
    const basicAuth = Buffer.from(`${login}:${password}`).toString('base64')
    const qrHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const { status, body: responseBody } = await new Promise((resolve, reject) => {
      https.get({
        hostname: qrHost.split(':')[0],
        port: qrHost.includes(':') ? parseInt(qrHost.split(':')[1]) : 443,
        path: '/platform/online/api/nomenclature/',
        headers: { Authorization: `Basic ${basicAuth}`, Accept: 'application/json' },
        rejectUnauthorized: false,
      }, (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => resolve({ status: res.statusCode, body: data }))
      }).on('error', reject)
    })
    if (status >= 400) throw new Error(`Quick Resto HTTP ${status}: ${String(responseBody).slice(0, 100)}`)
    send(res, 200, { ok: true })
    return true
  }

  if (pathname === '/api/iiko/stores' && req.method === 'GET') {
    const host = restaurant.iikoHost
    const login = restaurant.iikoLogin
    const password = restaurant.iikoPassword
    if (!host || !login || !password) throw httpError(400, 'Подключение к iiko не настроено.')
    const token = await iikoToken(host, login, password)

    // Try corporation/stores first, fall back to stores
    let xml = ''
    const r1 = await iikoGet(`https://${host}/resto/api/corporation/stores?key=${encodeURIComponent(token)}`)
    if (r1.status === 200) {
      xml = r1.body
    } else {
      const r2 = await iikoGet(`https://${host}/resto/api/stores?key=${encodeURIComponent(token)}`)
      xml = r2.body
    }

    const stores = []
    // Try multiple XML element names
    for (const tag of ['corporateItemDto', 'store', 'storeDto', 'item']) {
      const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g')
      let sm
      while ((sm = re.exec(xml)) !== null) {
        const block = sm[1]
        const get = (t) => { const m = new RegExp(`<${t}>([^<]*)<\\/${t}>`).exec(block); return m ? m[1].trim() : '' }
        const id = get('id')
        const name = get('name')
        if (id && name) stores.push({ id, name })
      }
      if (stores.length > 0) break
    }

    // If no stores parsed, return raw snippet for debugging
    if (stores.length === 0) {
      console.log('[iiko/stores] raw xml snippet:', xml.slice(0, 500))
    }

    send(res, 200, { stores, _debug: stores.length === 0 ? xml.slice(0, 300) : undefined })
    return true
  }

  if (pathname === '/api/iiko/inventory' && req.method === 'GET') {
    const host = restaurant.iikoHost
    const login = restaurant.iikoLogin
    const password = restaurant.iikoPassword
    if (!host || !login || !password) throw httpError(400, 'Подключение к iiko не настроено.')

    const url = new URL(`http://x${req.url}`)
    const storeId = url.searchParams.get('storeId')

    const token = await iikoToken(host, login, password)

    // Parse all items: build group map + product map
    const { body: productsXml } = await iikoGet(`https://${host}/resto/api/products?key=${encodeURIComponent(token)}`)
    // groupMap: id → { name, parent }
    const groupMap = new Map()
    // productMap: id → { name, unit, parentId }
    const productMap = new Map()
    const productRe = /<productDto>([\s\S]*?)<\/productDto>/g
    let pm
    while ((pm = productRe.exec(productsXml)) !== null) {
      const block = pm[1]
      const get = (tag) => { const m = new RegExp(`<${tag}>([^<]*)<\/${tag}>`).exec(block); return m ? m[1].trim() : '' }
      const id = get('id')
      const name = get('name')
      const type = get('productType')
      const parentId = get('parent') || get('parentId') || ''
      if (!id || !name) continue
      if (!type) {
        // It's a group
        groupMap.set(id, { name, parentId })
      } else if (type === 'GOODS' || type === 'PREPARED' || type === 'DISH') {
        const unit = get('mainUnit') || 'шт'
        const price = parseFloat(get('price') || get('sellPrice') || '0') || 0
        productMap.set(id, { name, unit, parentId, type, price })
      }
    }

    // Resolve top-level group name for each product
    function resolveGroup(parentId, depth = 0) {
      if (!parentId || depth > 10) return ''
      const g = groupMap.get(parentId)
      if (!g) return ''
      // Walk up until root (no parent or parent not in map)
      if (g.parentId && groupMap.has(g.parentId)) return resolveGroup(g.parentId, depth + 1)
      return g.name
    }

    console.log('[iiko/inventory] groups:', Array.from(groupMap.values()).map(g => g.name).slice(0, 20))
    const typeCounts = {}
    for (const [, p] of productMap) { typeCounts[p.type] = (typeCounts[p.type] || 0) + 1 }
    console.log('[iiko/inventory] product types:', typeCounts)

    const filter = url.searchParams.get('filter') // 'prepared' | 'goods' | null (both)

    let items = []

    for (const [, product] of productMap) {
      if (filter === 'prepared' && product.type !== 'DISH') continue
      if (filter === 'goods' && product.type !== 'GOODS') continue
      items.push({ name: product.name, unit: product.unit, price: product.price || 0, category: resolveGroup(product.parentId) })
    }

    items.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    send(res, 200, { items, total: items.length })
    return true
  }

  if (pathname === '/api/iiko/nomenclature' && req.method === 'GET') {
    const host = restaurant.iikoHost
    const login = restaurant.iikoLogin
    const password = restaurant.iikoPassword
    if (!host || !login || !password) throw httpError(400, 'Подключение к iiko не настроено.')

    const token = await iikoToken(host, login, password)
    const { body: productsXml } = await iikoGet(`https://${host}/resto/api/products?key=${encodeURIComponent(token)}`)

    // Parse groups and dishes from same XML
    const groupMap = new Map() // id → { name, parentId }
    const dishes = []

    const productRe = /<productDto>([\s\S]*?)<\/productDto>/g
    let pm
    while ((pm = productRe.exec(productsXml)) !== null) {
      const block = pm[1]
      const get = (tag) => { const m = new RegExp(`<${tag}>([^<]*)<\/${tag}>`).exec(block); return m ? m[1].trim() : '' }
      const id = get('id')
      const name = get('name')
      const type = get('productType')
      const parentId = get('parent') || get('parentId') || ''

      if (!id || !name) continue

      if (!type) {
        groupMap.set(id, { name, parentId })
        continue
      }
      if (type !== 'DISH') continue

      const unit = get('mainUnit') || 'шт'
      // Try multiple price fields
      const priceRaw = get('price') || get('sellPrice') || get('defaultSellPrice') || '0'
      const price = parseFloat(priceRaw) || 0

      // Parse recipe from <techCardItems> block if present
      const techMatch = /<techCardItems>([\s\S]*?)<\/techCardItems>/.exec(block)
      const recipe = []
      if (techMatch) {
        const techRe = /<techCardItem>([\s\S]*?)<\/techCardItem>/g
        let tm
        while ((tm = techRe.exec(techMatch[1])) !== null) {
          const tb = tm[1]
          const tget = (tag) => { const m = new RegExp(`<${tag}>([^<]*)<\/${tag}>`).exec(tb); return m ? m[1].trim() : '' }
          const ingredient = tget('productName') || tget('name') || ''
          const amount = tget('amount') || tget('quantity') || tget('netto') || ''
          const ingUnit = tget('unitName') || tget('unit') || ''
          if (ingredient) recipe.push({ ingredient, amount: `${amount}${ingUnit ? ' ' + ingUnit : ''}` })
        }
      }

      dishes.push({ id, name, unit, price, parentId, recipe })
    }

    // Resolve group name: walk up to find meaningful (non-root) parent name
    function resolveGroup(parentId, depth = 0) {
      if (!parentId || depth > 8) return ''
      const g = groupMap.get(parentId)
      if (!g) return ''
      if (g.parentId && groupMap.has(g.parentId)) {
        // If parent has a parent → go up one more level to get a meaningful category
        const upper = resolveGroup(g.parentId, depth + 1)
        return upper || g.name
      }
      return g.name
    }

    const items = dishes.map(d => ({
      name: d.name,
      unit: d.unit,
      price: d.price,
      group: resolveGroup(d.parentId) || 'Без категории',
      recipe: d.recipe,
    })).sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    console.log('[iiko/nomenclature] dishes:', items.length, 'groups:', new Set(items.map(i => i.group)).size)
    send(res, 200, { items, total: items.length })
    return true
  }

  if (pathname === '/api/iiko/employees' && req.method === 'GET') {
    const host = restaurant.iikoHost
    const login = restaurant.iikoLogin
    const password = restaurant.iikoPassword
    if (!host || !login || !password) throw httpError(400, 'Подключение к iiko не настроено.')

    const token = await iikoToken(host, login, password)
    const { body: xml } = await iikoGet(`https://${host}/resto/api/employees?key=${encodeURIComponent(token)}`)

    const employees = []
    const empRe = /<employee>([\s\S]*?)<\/employee>/g
    let em
    while ((em = empRe.exec(xml)) !== null) {
      const block = em[1]
      const get = (tag) => { const m = new RegExp(`<${tag}>([^<]*)<\/${tag}>`).exec(block); return m ? m[1].trim() : '' }
      const id = get('id')
      const name = get('name') || get('firstName')
      if (!name || !id) continue
      const role = get('mainRole') || get('role') || ''
      const phone = get('phone') || get('login') || ''
      const dismissed = get('dismissed')
      if (dismissed === 'true') continue
      employees.push({ iikoId: id, name, role, phone })
    }

    employees.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    console.log('[iiko/employees] found:', employees.length)
    send(res, 200, { items: employees, total: employees.length })
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
    if (await handleMyRestaurants(req, res, state, pathname, auth)) return
    if (await handleRestaurant(req, res, state, pathname, auth)) return
    if (await handleSupportAccess(req, res, state, pathname, auth)) return
    if (await handleDashboard(req, res, state, pathname, auth)) return
    if (await handleMobile(req, res, state, pathname, auth)) return
    if (await handleIiko(req, res, state, pathname, auth)) return
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
  const relative = path.relative(distDir, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw httpError(403, 'Недоступный путь.')

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
    const contentLength = Number(req.headers['content-length'] || 0)
    if (!safeMethods.has(req.method) && contentLength > 0 && req.url?.startsWith('/api/') && !req.headers['content-type']?.includes('application/json')) {
      throw httpError(415, 'API принимает только JSON-запросы.')
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
