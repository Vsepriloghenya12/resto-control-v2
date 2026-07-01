import { useEffect, useState } from 'react'
import { useSession } from '../../app/providers/SessionProvider'
import { api, apiRequest } from '../../shared/api/client'
import { LoopsPricingSlider } from '../../components/ui/pricing-slider-loops'
import './PaymentPage.css'

type InvoiceStatus = 'issued' | 'payment_reported' | 'payment_document_attached' | 'paid' | 'payment_rejected'
type Tariff = { id: string; title: string; employees: string; price: string; period?: string; note: string; featured?: boolean }
type Invoice = { id: string; invoiceNumber?: string; number?: string; plan: string; period: string; amount: number | string; issuedAt: string; status: InvoiceStatus; closingDocument?: string }

const tariffs: Tariff[] = [
  { id: 'start', title: 'Старт', employees: 'до 10 сотрудников', price: '1 490 ₽', period: '/ мес', note: 'Счёт на оплату, закрывающие документы' },
  { id: 'team20', title: 'Команда 20', employees: 'до 20 сотрудников', price: '1 990 ₽', period: '/ мес', note: 'Для небольшой команды с запасом роста' },
  { id: 'standard', title: 'Стандарт', employees: 'до 30 сотрудников', price: '2 990 ₽', period: '/ мес', note: 'Оптимально для одного ресторана', featured: true },
  { id: 'team40', title: 'Команда 40', employees: 'до 40 сотрудников', price: '3 990 ₽', period: '/ мес', note: 'Для растущей команды ресторана' },
  { id: 'team50', title: 'Команда 50', employees: 'до 50 сотрудников', price: '4 990 ₽', period: '/ мес', note: 'Для большого зала и кухни' },
  { id: 'team60', title: 'Команда 60', employees: 'до 60 сотрудников', price: '5 990 ₽', period: '/ мес', note: 'Для плотных смен и расширенной команды' },
  { id: 'network', title: 'Сеть', employees: 'до 100 сотрудников', price: '9 990 ₽', period: '/ мес', note: 'Для нескольких смен и большой команды' },
  { id: 'enterprise', title: 'Enterprise', employees: '100+ сотрудников', price: 'Индивидуально', period: '', note: 'Индивидуальный договор и условия' },
]

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  issued: 'Счёт выставлен', payment_reported: 'Клиент отметил оплату', payment_document_attached: 'Поручение прикреплено', paid: 'Оплата подтверждена', payment_rejected: 'Платёж не найден',
}

function StatusBadge({ status }: { status: InvoiceStatus }) { return <span className={`payment-status payment-status--${status}`}>{invoiceStatusLabels[status]}</span> }
function ToggleButton({ active, children, onClick }: { active?: boolean; children: string; onClick: () => void }) { return <button className={active ? 'payment-toggle payment-toggle--active' : 'payment-toggle'} type="button" onClick={onClick}>{children}</button> }

export function PaymentPage() {
  const { session } = useSession()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [restaurant, setRestaurant] = useState(session?.restaurant)
  const [message, setMessage] = useState('')
  const [supportOpen, setSupportOpen] = useState(false)
  const [requisites, setRequisites] = useState({
    legalType: session?.restaurant.legalType || 'ИП', legalName: session?.restaurant.legalName || '', inn: session?.restaurant.inn || '', kpp: session?.restaurant.kpp || '', ogrn: session?.restaurant.ogrn || '', legalAddress: session?.restaurant.legalAddress || '', bankName: session?.restaurant.bankName || '', bik: session?.restaurant.bik || '', account: session?.restaurant.account || '', corrAccount: session?.restaurant.corrAccount || '', contactEmail: session?.restaurant.contactEmail || '', contactPhone: session?.restaurant.contactPhone || '', edo: session?.restaurant.edo || '',
  })

  async function loadPayments() {
    const result = await api.list<Invoice>('payments')
    setInvoices(result.items)
  }
  useEffect(() => { void loadPayments() }, [])

  const currentTariff = tariffs.find((tariff) => tariff.id === (restaurant?.plan || 'standard')) ?? tariffs[2]
  const paidUntil = restaurant?.subscriptionEndsAt ? new Date(restaurant.subscriptionEndsAt).toLocaleDateString('ru-RU') : '—'
  const daysLeft = restaurant?.subscriptionEndsAt ? Math.max(0, Math.ceil((new Date(restaurant.subscriptionEndsAt).getTime() - Date.now()) / 86400000)) : null
  const latestInvoice = invoices[0]

  async function selectTariff(tariff: Tariff) {
    try {
      const updated = await apiRequest<typeof restaurant>('/api/restaurant', { method: 'PATCH', body: JSON.stringify({ plan: tariff.id }) })
      setRestaurant(updated)
      setMessage(`Выбран тариф «${tariff.title}». Счёт выставляет владелец сервиса.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось изменить тариф.')
    }
  }

  const REQUIRED_FIELDS = ['legalName', 'inn', 'bankName', 'bik', 'account'] as const

  async function saveRequisites() {
    const missing = REQUIRED_FIELDS.filter((f) => !String(requisites[f] || '').trim())
    if (missing.length > 0) {
      setMessage('Заполните обязательные поля: ' + missing.map((f) => ({ legalName: 'Юридическое название', inn: 'ИНН', bankName: 'Банк', bik: 'БИК', account: 'Расчётный счёт' }[f])).join(', ') + '.')
      return
    }
    try {
      const updated = await apiRequest<typeof restaurant>('/api/restaurant', { method: 'PATCH', body: JSON.stringify(requisites) })
      setRestaurant(updated)
      setMessage('Реквизиты сохранены в карточке ресторана.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось сохранить реквизиты.')
    }
  }

  async function reportPaid(invoice: Invoice) {
    const updated = await api.update<Invoice>('payments', invoice.id, { status: 'payment_reported' })
    setInvoices((items) => items.map((item) => item.id === updated.id ? updated : item))
  }

  async function attachPaymentOrder(invoice: Invoice) {
    const updated = await api.update<Invoice>('payments', invoice.id, { status: 'payment_document_attached', paymentOrderAttachedAt: new Date().toISOString() })
    setInvoices((items) => items.map((item) => item.id === updated.id ? updated : item))
  }

  return (
    <section className="payment-page">
      <section className="payment-summary-grid">
        <article className="payment-summary-card payment-summary-card--main"><div><span>Тариф</span><strong>{currentTariff.title}</strong><p>{daysLeft !== null ? `Доступ активен. До окончания ${daysLeft} дней.` : 'Доступ активен.'}</p></div><b>Оплачено до {paidUntil}</b></article>
        <article className="payment-summary-card"><span>Последний счёт</span><strong>{latestInvoice ? `№ ${latestInvoice.invoiceNumber || latestInvoice.number}` : '—'}</strong><p>{latestInvoice ? `${latestInvoice.amount} ₽ · ${invoiceStatusLabels[latestInvoice.status]}` : 'Счётов пока нет'}</p></article>
        <article className="payment-summary-card"><span>Поддержка</span><strong>Нужна помощь?</strong><p>Вопросы по счёту, оплате, тарифу или закрывающим документам.</p><button className="payment-support-button" type="button" onClick={() => setSupportOpen(true)}>Поддержка</button></article>
      </section>

      <section className="payment-tariffs-card">
        <div className="payment-card-header">
          <div><h2>Тарифы</h2><p>Стоимость зависит от размера команды.</p></div>
          <span className="payment-trial-pill">Пробный период 14 дней при регистрации</span>
        </div>
        <LoopsPricingSlider tariffs={tariffs} selectedId={restaurant?.plan ?? 'standard'} onSelect={selectTariff} />
      </section>

      <div className="payment-layout"><section className="payment-requisites-card"><div className="payment-card-header"><div><h2>Реквизиты ресторана</h2><p>По ним владелец сервиса выставляет счёт и закрывающие документы.</p></div><div className="payment-toggle-group"><ToggleButton active={requisites.legalType === 'ИП'} onClick={() => setRequisites((v) => ({ ...v, legalType: 'ИП' }))}>ИП</ToggleButton><ToggleButton active={requisites.legalType === 'ООО'} onClick={() => setRequisites((v) => ({ ...v, legalType: 'ООО' }))}>ООО</ToggleButton></div></div>
        <div className="payment-form-grid">
          {([['legalName','Юридическое название'],['inn','ИНН'],['kpp','КПП'],['ogrn','ОГРН / ОГРНИП'],['legalAddress','Юридический адрес'],['bankName','Банк'],['bik','БИК'],['account','Расчётный счёт'],['corrAccount','Корреспондентский счёт'],['contactEmail','Email для документов'],['contactPhone','Телефон бухгалтерии'],['edo','ЭДО']] as const).map(([key, label]) => {
            const required = (REQUIRED_FIELDS as readonly string[]).includes(key)
            const empty = required && !String(requisites[key] || '').trim()
            return (
              <label key={key} className={['payment-form-grid__label', key === 'legalAddress' ? 'payment-form-grid__wide' : '', empty ? 'payment-form-grid__label--error' : ''].filter(Boolean).join(' ')}>
                <span>{label}{required && <span className="payment-required-mark"> *</span>}</span>
                <input value={String(requisites[key] || '')} onChange={(e) => setRequisites((v) => ({ ...v, [key]: e.target.value }))} />
              </label>
            )
          })}
        </div><div className="payment-card-actions"><button className="payment-primary-button" type="button" onClick={saveRequisites}>Сохранить реквизиты</button><span>Счёт создаёт владелец сервиса после проверки реквизитов.</span></div></section>
        <aside className="payment-side-card"><h2>Порядок оплаты</h2><ol><li><strong>Выбрать тариф</strong><span>Тариф зависит от количества сотрудников.</span></li><li><strong>Заполнить реквизиты</strong><span>ИП или ООО, банк, расчётный счёт и email.</span></li><li><strong>Получить счёт</strong><span>Счёт выставляет владелец приложения.</span></li><li><strong>Отметить оплату</strong><span>При необходимости прикрепить платёжное поручение.</span></li></ol></aside></div>

      <section className="payment-table-card"><div className="payment-card-header"><div><h2>Счета к оплате</h2></div></div><div className="payment-table-scroll"><table className="payment-table"><thead><tr><th>Счёт</th><th>Тариф</th><th>Период</th><th>Сумма</th><th>Статус</th><th>Дата</th><th>Действия</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>№ {invoice.invoiceNumber || invoice.number}</td><td>{invoice.plan}</td><td>{invoice.period}</td><td>{invoice.amount} ₽</td><td><StatusBadge status={invoice.status} /></td><td>{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('ru-RU') : '—'}</td><td><div className="payment-row-actions">{invoice.status !== 'paid' && <button type="button" onClick={() => reportPaid(invoice)}>Оплатил</button>}{invoice.status !== 'paid' && <button type="button" onClick={() => attachPaymentOrder(invoice)}>Поручение прикреплено</button>}{invoice.status === 'paid' ? <span className="payment-row-note">Оплачено</span> : null}</div></td></tr>)}</tbody></table></div></section>

      <section className="payment-documents-card"><div className="payment-card-header"><div><h2>Закрывающие документы</h2></div></div><div className="payment-documents-list">{invoices.filter((invoice) => invoice.status === 'paid' || invoice.closingDocument).map((invoice) => <article className="payment-document" key={invoice.id}><div><strong>{invoice.closingDocument || `Акт №${invoice.invoiceNumber || invoice.number}`}</strong><span>{invoice.amount} ₽ · период {invoice.period}</span></div><em>Выставлен</em></article>)}</div></section>
      {supportOpen ? <div className="payment-support-modal" role="presentation" onMouseDown={() => setSupportOpen(false)}><section className="payment-support-dialog" role="dialog" aria-modal="true" aria-label="Поддержка по оплате" onMouseDown={(event) => event.stopPropagation()}><div className="payment-card-header"><div><h2>Поддержка по оплате</h2></div></div><textarea rows={5} placeholder="Например: не вижу счёт, нужно проверить оплату..." /><div className="payment-card-actions"><button className="payment-primary-button" type="button" onClick={async () => { await api.create('technical-requests', { title: 'Вопрос по оплате', description: 'Обращение из раздела оплаты', area: 'Оплата', priority: 'medium', status: 'new', createdByPosition: 'Владелец / управляющий' }); setMessage('Обращение создано.'); setSupportOpen(false) }}>Отправить</button><button type="button" onClick={() => setSupportOpen(false)}>Закрыть</button></div></section></div> : null}
    </section>
  )
}
