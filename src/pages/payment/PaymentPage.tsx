type InvoiceStatus = 'issued' | 'payment_reported' | 'payment_document_attached' | 'paid' | 'payment_rejected'
type DocumentStatus = 'issued' | 'signed'

type Tariff = {
  id: string
  title: string
  employees: string
  price: string
  period: string
  note: string
  featured?: boolean
}

type Invoice = {
  id: string
  number: string
  plan: string
  period: string
  amount: string
  issuedAt: string
  status: InvoiceStatus
}

type ClosingDocument = {
  id: string
  type: 'act' | 'upd'
  number: string
  period: string
  amount: string
  status: DocumentStatus
}

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
  issued: 'Счёт выставлен',
  payment_reported: 'Клиент отметил оплату',
  payment_document_attached: 'Поручение прикреплено',
  paid: 'Оплата подтверждена',
  payment_rejected: 'Платёж не найден',
}

const invoices: Invoice[] = [
  {
    id: 'inv-1287',
    number: '1287',
    plan: 'Стандарт',
    period: '01.06.2026 — 30.06.2026',
    amount: '2 990 ₽',
    issuedAt: '01.06.2026',
    status: 'paid',
  },
  {
    id: 'inv-1298',
    number: '1298',
    plan: 'Стандарт',
    period: '01.07.2026 — 31.07.2026',
    amount: '2 990 ₽',
    issuedAt: '10.06.2026',
    status: 'issued',
  },
]

const closingDocuments: ClosingDocument[] = [
  { id: 'doc-74', type: 'act', number: '74', period: 'до 30.06.2026', amount: '2 990 ₽', status: 'issued' },
  { id: 'doc-61', type: 'upd', number: '61', period: 'до 31.05.2026', amount: '2 990 ₽', status: 'signed' },
]

const paymentAccess = {
  planId: 'standard',
  paidUntil: '15.06.2026',
  daysLeft: 5,
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`payment-status payment-status--${status}`}>{invoiceStatusLabels[status]}</span>
}

function ToggleButton({ active, children }: { active?: boolean; children: string }) {
  return <button className={active ? 'payment-toggle payment-toggle--active' : 'payment-toggle'} type="button">{children}</button>
}

function TariffCard({ tariff, selected }: { tariff: Tariff; selected?: boolean }) {
  return (
    <button className={selected ? 'payment-tariff-card payment-tariff-card--selected' : tariff.featured ? 'payment-tariff-card payment-tariff-card--featured' : 'payment-tariff-card'} type="button">
      {tariff.featured ? <span className="payment-tariff-card__badge">Популярный</span> : null}
      {selected ? <span className="payment-tariff-card__selected">Текущий</span> : null}
      <div>
        <strong>{tariff.title}</strong>
        <p>{tariff.employees}</p>
      </div>
      <div className="payment-tariff-price">
        <b>{tariff.price}</b>
        {tariff.period ? <em>{tariff.period}</em> : null}
      </div>
      <small>{tariff.note}</small>
    </button>
  )
}

export function PaymentPage() {
  const latestInvoice = invoices[0]
  const currentTariff = tariffs.find((tariff) => tariff.id === paymentAccess.planId) ?? tariffs[2]

  return (
    <section className="payment-page">
      <section className="payment-summary-grid">
        <article className="payment-summary-card payment-summary-card--main">
          <div>
            <span>Тариф</span>
            <strong>{currentTariff.title}</strong>
            <p>Доступ активен. Оплаченный период заканчивается через {paymentAccess.daysLeft} дней.</p>
          </div>
          <b>Оплачено до {paymentAccess.paidUntil}</b>
        </article>

        <article className="payment-summary-card">
          <span>Последний счёт</span>
          <strong>№ {latestInvoice.number}</strong>
          <p>{latestInvoice.amount} · {invoiceStatusLabels[latestInvoice.status]}</p>
        </article>

        <article className="payment-summary-card">
          <span>Поддержка</span>
          <strong>Нужна помощь?</strong>
          <p>Вопросы по счёту, оплате, тарифу или закрывающим документам.</p>
          <button className="payment-support-button" type="button" onClick={() => { window.location.href = 'mailto:support@resto-control.ru?subject=Поддержка по оплате Resto Control' }}>Поддержка</button>
        </article>
      </section>

      <section className="payment-tariffs-card">
        <div className="payment-card-header">
          <div>
            <h2>Тарифы</h2>
            <p>Линейка тарифов как в старой версии: стоимость зависит от размера команды.</p>
          </div>
          <span className="payment-trial-pill">Пробный период 14 дней при регистрации</span>
        </div>
        <div className="payment-tariff-grid">
          {tariffs.map((tariff) => <TariffCard key={tariff.id} tariff={tariff} selected={tariff.id === paymentAccess.planId} />)}
        </div>
      </section>

      <div className="payment-layout">
        <section className="payment-requisites-card">
          <div className="payment-card-header">
            <div>
              <h2>Реквизиты ресторана</h2>
              <p>По ним владелец сервиса выставляет счёт и закрывающие документы.</p>
            </div>
            <div className="payment-toggle-group">
              <ToggleButton active>ИП</ToggleButton>
              <ToggleButton>ООО</ToggleButton>
            </div>
          </div>

          <div className="payment-form-grid">
            <label><span>Юридическое название</span><input defaultValue="ИП Иванов Иван Иванович" /></label>
            <label><span>ИНН</span><input defaultValue="231000000000" /></label>
            <label><span>КПП</span><input placeholder="Для ООО" /></label>
            <label><span>ОГРН / ОГРНИП</span><input defaultValue="326230000000000" /></label>
            <label className="payment-form-grid__wide"><span>Юридический адрес</span><input defaultValue="Краснодарский край, г. Сочи, ул. Морская, 10" /></label>
            <label><span>Банк</span><input defaultValue="Т-Банк" /></label>
            <label><span>БИК</span><input defaultValue="044525974" /></label>
            <label><span>Расчётный счёт</span><input defaultValue="40802810000000000000" /></label>
            <label><span>Корреспондентский счёт</span><input defaultValue="30101810145250000974" /></label>
            <label><span>Email для документов</span><input defaultValue="owner@restaurant.ru" /></label>
            <label><span>Телефон бухгалтерии</span><input defaultValue="+7 900 000-00-00" /></label>
            <label><span>ЭДО</span><input placeholder="Диадок / СБИС / Контур" /></label>
          </div>

          <div className="payment-card-actions">
            <button className="payment-primary-button" type="button">Сохранить реквизиты</button>
            <span>Счёт создаёт владелец сервиса после проверки реквизитов.</span>
          </div>
        </section>

        <aside className="payment-side-card">
          <h2>Порядок оплаты</h2>
          <ol>
            <li><strong>Выбрать тариф</strong><span>Тариф зависит от количества сотрудников.</span></li>
            <li><strong>Заполнить реквизиты</strong><span>ИП или ООО, банк, расчётный счёт и email.</span></li>
            <li><strong>Получить счёт</strong><span>Счёт выставляет владелец приложения.</span></li>
            <li><strong>Отметить оплату</strong><span>При необходимости прикрепить платёжное поручение.</span></li>
          </ol>
        </aside>
      </div>

      <section className="payment-table-card">
        <div className="payment-card-header">
          <div>
            <h2>Счета к оплате</h2>
            <p>Ресторан не создаёт счёт самостоятельно. Здесь отображаются выставленные счета.</p>
          </div>
        </div>

        <div className="payment-table-scroll">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Счёт</th>
                <th>Тариф</th>
                <th>Период</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>№ {invoice.number}</td>
                  <td>{invoice.plan}</td>
                  <td>{invoice.period}</td>
                  <td>{invoice.amount}</td>
                  <td><StatusBadge status={invoice.status} /></td>
                  <td>{invoice.issuedAt}</td>
                  <td>
                    <div className="payment-row-actions">
                      <button type="button">Скачать счёт</button>
                      {invoice.status !== 'paid' && <button type="button">Оплатил</button>}
                      {invoice.status !== 'paid' && <button type="button">Поручение</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="payment-documents-card">
        <div className="payment-card-header">
          <div>
            <h2>Закрывающие документы</h2>
            <p>Акты и УПД появляются после подтверждения оплаты.</p>
          </div>
        </div>

        <div className="payment-documents-list">
          {closingDocuments.map((document) => (
            <article className="payment-document" key={document.id}>
              <div>
                <strong>{document.type === 'upd' ? 'УПД' : 'Акт'} № {document.number}</strong>
                <span>{document.amount} · период {document.period}</span>
              </div>
              <em>{document.status === 'signed' ? 'Подписан' : 'Выставлен'}</em>
              <button type="button">Скачать</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
