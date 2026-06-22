import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client'

type AttestationQuestion = {
  id: string
  source: 'ttk' | 'knowledge'
  sourceId: string
  text: string
  options: string[]
  correctIndex: number
}

type Attestation = {
  id: string
  title: string
  type: 'full' | 'menu' | 'knowledge'
  status: 'active' | 'completed' | 'draft'
  employeeIds: string[]
  deadline: string | null
  questions: AttestationQuestion[]
  createdAt: string
}

type AttestationResult = {
  id: string
  attestationId: string
  employeeId: string
  employeeName: string
  answers: { questionId: string; selectedIndex: number }[]
  score: number
  completedAt: string
}

type Employee = {
  id: string
  name: string
  position: string
  status?: string
}

const typeLabels: Record<Attestation['type'], string> = {
  full: 'Полная',
  menu: 'По меню',
  knowledge: 'По базе знаний',
}

export function AttestationPage() {
  const [attestations, setAttestations] = useState<Attestation[]>([])
  const [results, setResults] = useState<AttestationResult[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Attestation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const [draft, setDraft] = useState({
    title: '',
    type: 'menu' as Attestation['type'],
    employeeIds: [] as string[],
    deadline: '',
  })

  useEffect(() => { void loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [aRes, rRes, eRes] = await Promise.all([
        api.list<Attestation>('attestations'),
        api.list<AttestationResult>('attestation-results'),
        api.list<Employee>('employees'),
      ])
      setAttestations(aRes.items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      setResults(rRes.items)
      setEmployees(eRes.items.filter((e) => e.status !== 'fired' && e.status !== 'blocked'))
    } finally {
      setLoading(false)
    }
  }

  function showNotice(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  async function createAttestation() {
    setSaving(true)
    try {
      const created = await api.create<Attestation>('attestations', {
        title: draft.title || `Аттестация — ${typeLabels[draft.type]}`,
        type: draft.type,
        employeeIds: draft.employeeIds,
        deadline: draft.deadline || null,
      })
      setAttestations((prev) => [created, ...prev])
      setModalOpen(false)
      setDraft({ title: '', type: 'menu', employeeIds: [], deadline: '' })
      showNotice(`Аттестация создана: ${created.questions.length} вопросов`)
      setSelected(created)
    } catch (e) {
      showNotice(e instanceof Error ? e.message : 'Ошибка создания')
    } finally {
      setSaving(false)
    }
  }

  async function closeAttestation(id: string) {
    if (!window.confirm('Завершить аттестацию? Сотрудники больше не смогут её пройти.')) return
    await api.update('attestations', id, { status: 'completed' })
    setAttestations((prev) => prev.map((a) => a.id === id ? { ...a, status: 'completed' } : a))
    if (selected?.id === id) setSelected((a) => a ? { ...a, status: 'completed' } : a)
    showNotice('Аттестация завершена.')
  }

  function toggleEmployee(id: string) {
    setDraft((d) => ({
      ...d,
      employeeIds: d.employeeIds.includes(id)
        ? d.employeeIds.filter((e) => e !== id)
        : [...d.employeeIds, id],
    }))
  }

  const attestationResults = selected ? results.filter((r) => r.attestationId === selected.id) : []

  const passScore = 70

  return (
    <div className="attest-page">
      {notice && <div className="attest-notice">{notice}</div>}

      <div className="attest-layout">
        {/* Левая панель — список */}
        <aside className="attest-sidebar">
          <div className="attest-sidebar__header">
            <h2>Аттестации</h2>
            <button type="button" className="attest-create-btn" onClick={() => setModalOpen(true)}>+ Создать</button>
          </div>

          {loading && <p className="attest-empty">Загрузка...</p>}
          {!loading && attestations.length === 0 && <p className="attest-empty">Аттестаций пока нет.</p>}

          <div className="attest-list">
            {attestations.map((a) => {
              const aResults = results.filter((r) => r.attestationId === a.id)
              const passed = aResults.filter((r) => r.score >= passScore).length
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`attest-list-item${selected?.id === a.id ? ' is-active' : ''}`}
                  onClick={() => setSelected(a)}
                >
                  <div className="attest-list-item__top">
                    <strong>{a.title}</strong>
                    <span className={`attest-badge attest-badge--${a.status}`}>
                      {a.status === 'active' ? 'Активна' : 'Завершена'}
                    </span>
                  </div>
                  <div className="attest-list-item__meta">
                    <span>{typeLabels[a.type]}</span>
                    <span>·</span>
                    <span>{a.questions.length} вопросов</span>
                    {aResults.length > 0 && <><span>·</span><span>{passed}/{aResults.length} прошли</span></>}
                  </div>
                  {a.deadline && <div className="attest-list-item__deadline">До {new Date(a.deadline).toLocaleDateString('ru')}</div>}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Правая панель — детали */}
        <main className="attest-detail">
          {!selected ? (
            <div className="attest-detail-empty">
              <strong>Выберите аттестацию</strong>
              <span>или создайте новую</span>
            </div>
          ) : (
            <>
              <div className="attest-detail__header">
                <div>
                  <h2>{selected.title}</h2>
                  <p>{typeLabels[selected.type]} · {selected.questions.length} вопросов{selected.deadline ? ` · до ${new Date(selected.deadline).toLocaleDateString('ru')}` : ''}</p>
                </div>
                {selected.status === 'active' && (
                  <button type="button" className="attest-close-btn" onClick={() => closeAttestation(selected.id)}>Завершить</button>
                )}
              </div>

              {/* Результаты */}
              <section className="attest-results-section">
                <h3>Результаты сотрудников</h3>
                {attestationResults.length === 0 ? (
                  <p className="attest-empty">Никто ещё не прошёл аттестацию.</p>
                ) : (
                  <div className="attest-results-table">
                    <div className="attest-results-table__head">
                      <span>Сотрудник</span>
                      <span>Результат</span>
                      <span>Статус</span>
                      <span>Дата</span>
                    </div>
                    {attestationResults
                      .sort((a, b) => b.score - a.score)
                      .map((r) => (
                        <div key={r.id} className="attest-results-table__row">
                          <span>{r.employeeName}</span>
                          <span>
                            <span className={`attest-score${r.score >= passScore ? ' attest-score--pass' : ' attest-score--fail'}`}>
                              {r.score}%
                            </span>
                            <span className="attest-score-detail"> ({r.answers.filter((a, i) => selected.questions[i]?.correctIndex === a.selectedIndex).length}/{selected.questions.length})</span>
                          </span>
                          <span className={r.score >= passScore ? 'attest-pass' : 'attest-fail'}>
                            {r.score >= passScore ? '✓ Прошёл' : '✗ Не прошёл'}
                          </span>
                          <span>{new Date(r.completedAt).toLocaleDateString('ru')}</span>
                        </div>
                      ))}
                  </div>
                )}
              </section>

              {/* Вопросы */}
              <section className="attest-questions-section">
                <h3>Вопросы аттестации</h3>
                <div className="attest-questions-list">
                  {selected.questions.map((q, i) => (
                    <div key={q.id} className="attest-question-card">
                      <div className="attest-question-card__num">{i + 1}</div>
                      <div className="attest-question-card__body">
                        <p>{q.text}</p>
                        <div className="attest-question-options">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className={`attest-question-opt${oi === q.correctIndex ? ' is-correct' : ''}`}>
                              {oi === q.correctIndex ? '✓' : '○'} {opt}
                            </div>
                          ))}
                        </div>
                        <div className="attest-question-source">{q.source === 'ttk' ? '📋 Из меню' : '📚 Из базы знаний'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {/* Модалка создания */}
      {modalOpen && (
        <div className="attest-modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="attest-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="attest-modal__header">
              <strong>Новая аттестация</strong>
              <button type="button" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="attest-modal__body">
              <label>
                <span>Название (необязательно)</span>
                <input type="text" placeholder="Аттестация июнь 2026" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
              </label>

              <label>
                <span>Тип аттестации</span>
                <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as Attestation['type'] }))}>
                  <option value="menu">По меню — вопросы из номенклатуры</option>
                  <option value="knowledge">По базе знаний — вопросы из документов</option>
                  <option value="full">Полная — меню + база знаний</option>
                </select>
              </label>

              <label>
                <span>Дедлайн (необязательно)</span>
                <input type="date" value={draft.deadline} onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))} />
              </label>

              <div className="attest-modal__employees">
                <span>Назначить сотрудникам <em>(пусто = все)</em></span>
                <div className="attest-employee-list">
                  {employees.map((emp) => (
                    <label key={emp.id} className={`attest-employee-chip${draft.employeeIds.includes(emp.id) ? ' is-selected' : ''}`}>
                      <input type="checkbox" checked={draft.employeeIds.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                      {emp.name} <em>{emp.position}</em>
                    </label>
                  ))}
                </div>
              </div>

              <div className="attest-modal__note">
                Система автоматически сгенерирует вопросы из имеющихся данных. Вы сможете просмотреть их после создания.
              </div>
            </div>

            <div className="attest-modal__footer">
              <button type="button" className="attest-modal__cancel" onClick={() => setModalOpen(false)}>Отмена</button>
              <button type="button" className="attest-modal__submit" onClick={() => void createAttestation()} disabled={saving}>
                {saving ? 'Генерирую вопросы...' : 'Создать аттестацию'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
