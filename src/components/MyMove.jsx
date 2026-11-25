// "My move": tell Kamarat where you are moving and why, and get the setup steps
// for the new country in one list you can tick off. Kept only on this device.
import { useEffect, useId, useMemo, useState } from 'react'
import {
  makeMovePlan, loadMovePlan, saveMovePlan, moveProgress, addOwnStep,
  PHASES, PHASE_TITLES, PURPOSES, MOVE_CHANGED,
} from '../move'
import { countryList, countryName } from '../countries'
import { languageProps } from '../explain'
import { t } from '../i18n'
import { ArrowIcon, ChatIcon, CheckIcon, LandmarkIcon, LockIcon, Dots } from './Icons'

function MoveSetup({ country, language, onMade }) {
  const uid = useId()
  const countries = useMemo(() => countryList(), [])
  const [to, setTo] = useState(country || '')
  const [from, setFrom] = useState('')
  const [purpose, setPurpose] = useState('')
  const [state, setState] = useState({ status: 'idle' })

  async function make() {
    setState({ status: 'loading', text: t('Making your list...') })
    try {
      const plan = await makeMovePlan({
        to,
        from,
        purpose: purpose || 'OTHER',
        language,
        onStatus: (text) => setState({ status: 'loading', text: t(text) }),
      })
      saveMovePlan(plan)
      onMade(plan)
    } catch (err) {
      setState({ status: 'error', text: err.message })
    }
  }

  return (
    <section className="card move-setup">
      <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('My move')}</h1>
      <p className="lead">{t('Tell Kamarat where you are moving, and get your setup steps in one list you can tick off.')}</p>

      <div className="move-field">
        <label htmlFor={`${uid}-to`}>{t('Where are you moving to, or where do you live now?')}</label>
        <select id={`${uid}-to`} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">{t('Choose a country')}</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>

      <div className="move-field">
        <label htmlFor={`${uid}-from`}>{t('Where are you moving from? (you can skip this)')}</label>
        <select id={`${uid}-from`} value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">{t('Skip')}</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>

      <fieldset className="move-field">
        <legend>{t('Why are you moving?')}</legend>
        <div className="chips">
          {PURPOSES.map((p) => (
            <label key={p.id} className={`chip-button chip-radio ${purpose === p.id ? 'chip-selected' : ''}`}>
              <input
                type="radio"
                name={`${uid}-purpose`}
                value={p.id}
                checked={purpose === p.id}
                onChange={() => setPurpose(p.id)}
                className="visually-hidden"
              />
              {t(p.label)}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="small muted move-privacy">
        <LockIcon width={16} height={16} /> {t('Only the countries and your reason are sent to Gemini. Nothing about you.')}
      </p>

      {state.status === 'error' && <p className="notice notice-warn" role="alert">{t(state.text)}.</p>}

      <button className="primary" onClick={make} disabled={!to || state.status === 'loading'}>
        {state.status === 'loading' ? <span role="status"><Dots /> {state.text}</span> : <>{t('Make my list')} <ArrowIcon className="arrow-forward" width={18} height={18} /></>}
      </button>
    </section>
  )
}

function StepItem({ step, language, onToggle, onAsk }) {
  return (
    <li className={`move-step ${step.done ? 'is-done' : ''}`}>
      <button
        className={`done-toggle ${step.done ? 'is-done' : ''}`}
        aria-pressed={step.done}
        aria-label={step.done ? t('Mark as not done') : t('Mark as done')}
        onClick={onToggle}
      >
        {step.done && <CheckIcon width={18} height={18} />}
      </button>
      <div className="move-step-body">
        <strong {...languageProps(language)}>{step.title}</strong>
        {step.why && <span className="small muted" {...languageProps(language)}>{step.why}</span>}
        <span className="move-step-links">
          {step.organisation && step.website && (
            <a className="move-site" href={`https://${step.website}`} target="_blank" rel="noopener noreferrer">
              <LandmarkIcon width={16} height={16} /> {step.organisation} · {step.website}
            </a>
          )}
          {step.organisation && !step.website && (
            <span className="small muted"><LandmarkIcon width={16} height={16} /> {step.organisation}</span>
          )}
          <button className="link-button small" onClick={() => onAsk(step)}>
            <ChatIcon width={16} height={16} /> {t('Ask about this')}
          </button>
        </span>
      </div>
    </li>
  )
}

export default function MyMove({ country, language, onAsk }) {
  const uid = useId()
  const [plan, setPlan] = useState(loadMovePlan)
  const [own, setOwn] = useState('')

  useEffect(() => {
    const onChange = () => setPlan(loadMovePlan())
    window.addEventListener(MOVE_CHANGED, onChange)
    return () => window.removeEventListener(MOVE_CHANGED, onChange)
  }, [])

  if (!plan) return <MoveSetup country={country} language={language} onMade={setPlan} />

  const { done, total } = moveProgress(plan)

  function update(next) {
    setPlan(next)
    saveMovePlan(next)
  }

  function toggle(id) {
    update({ ...plan, steps: plan.steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) })
  }

  function startOver() {
    if (window.confirm(t('Make a new list? Your ticks on this list will be removed.'))) {
      saveMovePlan(null)
      setPlan(null)
    }
  }

  function addOwn(event) {
    event.preventDefault()
    if (!own.trim()) return
    update(addOwnStep(plan, own.trim()))
    setOwn('')
  }

  return (
    <div className="move">
      <section className="move-head">
        <h1 className="flow-title" tabIndex={-1} data-step-heading>
          {t('Your move to {country}', { country: countryName(plan.to) })}
        </h1>
        <div className="move-progress" aria-label={t('{done} of {total} done', { done, total })}>
          <div className="progress-track"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
          <span className="small muted">{t('{done} of {total} done', { done, total })}</span>
        </div>
      </section>

      <div className="move-sheet">
        {PHASES.map((phase) => {
          const steps = plan.steps.filter((s) => s.phase === phase)
          if (steps.length === 0) return null
          return (
            <section key={phase} className="move-phase">
              <h2 className="section-title">{t(PHASE_TITLES[phase])}</h2>
              <ol className="move-steps">
                {steps.map((step) => (
                  <StepItem
                    key={step.id}
                    step={step}
                    language={step.own ? undefined : plan.language}
                    onToggle={() => toggle(step.id)}
                    onAsk={(s) => onAsk(t('How do I do this: {step}?', { step: s.title }))}
                  />
                ))}
              </ol>
            </section>
          )
        })}

        <form className="move-own" onSubmit={addOwn}>
          <label htmlFor={`${uid}-own`} className="small muted">{t('Add your own step')}</label>
          <div className="move-own-row">
            <input id={`${uid}-own`} value={own} onChange={(e) => setOwn(e.target.value)} dir="auto" />
            <button className="secondary" type="submit" disabled={!own.trim()}>{t('Add')}</button>
          </div>
        </form>

        <p className="small muted">
          {t('Kamarat made this list with AI. Check each step on the official website before you rely on it. Only government websites are shown as links.')}
        </p>
        <div className="buttons">
          <button className="secondary" onClick={() => onAsk('')}>
            <ChatIcon width={18} height={18} /> {t('Ask Kamarat')}
          </button>
          <button className="ghost" onClick={startOver}>{t('Make a new list')}</button>
        </div>
      </div>
    </div>
  )
}
