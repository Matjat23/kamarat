// "My move": tell Kamarat where you are moving and why, and get the setup steps
// for the new country in one list you can tick off. Kept only on this device.
// When Gemini is busy, an example list written by hand shows how it works.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  makeMovePlan, loadMovePlan, saveMovePlan, moveProgress, addOwnStep,
  PHASES, PHASE_TITLES, PURPOSES, MOVE_CHANGED, EXAMPLE_PLAN,
} from '../move'
import { countryList, countryName } from '../countries'
import { languageProps } from '../explain'
import { t, uiLanguageCode } from '../i18n'
import { ArrowIcon, ChatIcon, CheckIcon, LandmarkIcon, LockIcon, Dots } from './Icons'

// A web search for the organisation in that country, marked as a search.
const searchLink = (name, place) => `https://www.google.com/search?q=${encodeURIComponent(`${name} ${place}`)}`

function CountrySelect({ id, value, onChange, countries, empty }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
    </select>
  )
}

function MoveSetup({ country, language, onMade, onExample }) {
  const uid = useId()
  // Country names follow the screen language, once its translation has loaded.
  const screenLanguage = uiLanguageCode()
  const countries = useMemo(() => countryList(), [screenLanguage])
  const [to, setTo] = useState(country || '')
  const [from, setFrom] = useState('')
  const [citizenship, setCitizenship] = useState('')
  const [purpose, setPurpose] = useState('')
  const [state, setState] = useState({ status: 'idle' })

  async function make() {
    setState({ status: 'loading', text: t('Making your list...') })
    try {
      const plan = await makeMovePlan({
        to,
        from,
        citizenship,
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
        <CountrySelect id={`${uid}-to`} value={to} onChange={setTo} countries={countries} empty={t('Choose a country')} />
      </div>

      <div className="move-field">
        <label htmlFor={`${uid}-from`}>{t('Where are you moving from? (you can skip this)')}</label>
        <CountrySelect id={`${uid}-from`} value={from} onChange={setFrom} countries={countries} empty={t('Skip')} />
      </div>

      <div className="move-field">
        <label htmlFor={`${uid}-citizenship`}>{t('Your citizenship (you can skip this)')}</label>
        <CountrySelect
          id={`${uid}-citizenship`}
          value={citizenship}
          onChange={setCitizenship}
          countries={countries}
          empty={t('Skip')}
        />
        <span className="small muted">{t('Some steps depend on it, for example whether you need a work permit.')}</span>
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
        <LockIcon width={16} height={16} /> {t('Only the countries you choose here and your reason are sent to Gemini. Nothing else about you.')}
      </p>

      {state.status === 'error' && (
        <div className="notice notice-warn move-error" role="alert">
          <p>{t(state.text)}.</p>
          <button className="secondary small-btn" onClick={onExample}>{t('See an example list')}</button>
        </div>
      )}

      <button className="primary" onClick={make} disabled={!to || state.status === 'loading'}>
        {state.status === 'loading' ? <span role="status"><Dots /> {state.text}</span> : <>{t('Make my list')} <ArrowIcon className="arrow-forward" width={18} height={18} /></>}
      </button>
    </section>
  )
}

function StepItem({ step, language, place, onToggle, onAsk }) {
  return (
    <li className={`move-step ${step.done ? 'is-done' : ''}`}>
      {onToggle ? (
        <button
          className={`done-toggle ${step.done ? 'is-done' : ''}`}
          aria-pressed={step.done}
          aria-label={step.done ? t('Mark as not done') : t('Mark as done')}
          onClick={onToggle}
        >
          {step.done && <CheckIcon width={18} height={18} />}
        </button>
      ) : (
        <span className="example-mark" aria-hidden="true" />
      )}
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
            <a
              className="move-site move-search"
              href={searchLink(step.organisation, place)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LandmarkIcon width={16} height={16} /> {step.organisation} · {t('Search the web for them')}
            </a>
          )}
          <button className="link-button small" onClick={() => onAsk(step)}>
            <ChatIcon width={16} height={16} /> {t('Ask about this')}
          </button>
        </span>
      </div>
    </li>
  )
}

function Phases({ steps, language, place, onToggle, onAsk }) {
  return PHASES.map((phase) => {
    const inPhase = steps.filter((s) => s.phase === phase)
    if (inPhase.length === 0) return null
    return (
      <section key={phase} className="move-phase">
        <h2 className="section-title">{t(PHASE_TITLES[phase])}</h2>
        <ol className="move-steps">
          {inPhase.map((step) => (
            <StepItem
              key={step.id}
              step={step}
              language={step.own ? undefined : language}
              place={place}
              onToggle={onToggle ? () => onToggle(step.id) : null}
              onAsk={(s) => onAsk(t('How do I do this: {step}?', { step: s.title }))}
            />
          ))}
        </ol>
      </section>
    )
  })
}

// Shown when Gemini is busy. Read only, never saved, and clearly an example.
function ExampleList({ onAsk, onBack }) {
  const heading = useRef(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [])
  const steps = EXAMPLE_PLAN.steps.map((s) => ({ ...s, title: t(s.title), why: t(s.why) }))
  return (
    <div className="move">
      <section className="move-head">
        <h1 className="flow-title" tabIndex={-1} ref={heading}>{t('Example: moving to Sweden to work')}</h1>
        <p className="notice notice-warn">
          {t('Gemini is busy, so this is an example list written by hand. It shows how My move works. It is not your list, and nothing is saved.')}
        </p>
      </section>
      <div className="move-sheet">
        <Phases steps={steps} place={countryName(EXAMPLE_PLAN.to)} onAsk={onAsk} />
        <div className="buttons">
          <button className="primary" onClick={onBack}>{t('Make my own list')}</button>
        </div>
      </div>
    </div>
  )
}

export default function MyMove({ country, language, onAsk }) {
  const uid = useId()
  const [plan, setPlan] = useState(loadMovePlan)
  const [own, setOwn] = useState('')
  const [example, setExample] = useState(false)

  useEffect(() => {
    const onChange = () => setPlan(loadMovePlan())
    window.addEventListener(MOVE_CHANGED, onChange)
    return () => window.removeEventListener(MOVE_CHANGED, onChange)
  }, [])

  if (!plan && example) return <ExampleList onAsk={onAsk} onBack={() => setExample(false)} />
  if (!plan) return <MoveSetup country={country} language={language} onMade={setPlan} onExample={() => setExample(true)} />

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
        <Phases steps={plan.steps} language={plan.language} place={countryName(plan.to)} onToggle={toggle} onAsk={onAsk} />

        <form className="move-own" onSubmit={addOwn}>
          <label htmlFor={`${uid}-own`} className="small muted">{t('Add your own step')}</label>
          <div className="move-own-row">
            <input id={`${uid}-own`} value={own} onChange={(e) => setOwn(e.target.value)} dir="auto" />
            <button className="secondary" type="submit" disabled={!own.trim()}>{t('Add')}</button>
          </div>
        </form>

        <p className="small muted">
          {t('Kamarat made this list with AI. Check each step on the official website before you rely on it. Kamarat only links to official websites and well-known help organisations it has checked.')}
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
