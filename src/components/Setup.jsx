// Choosing a language and a country: once on the first visit, and later on the
// settings screen. Both lists can be searched by the name in its own language
// or in English, and Kamarat's guess from the browser is shown first.
import { useMemo, useState } from 'react'
import { LANGUAGES } from '../explain'
import { countryList, countryName, guessCountry } from '../countries'
import { t, uiLanguageCode } from '../i18n'
import { Logo, CheckIcon, ArrowIcon, LockIcon } from './Icons'

// Lower case without accents, so "francais" finds "Français".
const plain = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

function SearchList({ label, items, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = plain(query.trim())
    return q ? items.filter((item) => item.search.some((s) => plain(s).includes(q))) : items
  }, [items, query])

  return (
    <div className="search-list">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      <ul role="listbox" aria-label={label}>
        {shown.map((item) => (
          <li key={item.id}>
            <button
              role="option"
              aria-selected={item.id === value}
              className={`search-item ${item.id === value ? 'is-chosen' : ''}`}
              onClick={() => onChange(item.id)}
            >
              <span>
                <span {...item.textProps}>{item.title}</span>
                {item.note && <span className="small muted"> · {item.note}</span>}
              </span>
              {item.id === value && <CheckIcon width={18} height={18} />}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="small muted search-empty">{t('Nothing found')}</li>}
      </ul>
    </div>
  )
}

export function LanguagePicker({ value, onChange }) {
  const items = useMemo(
    () =>
      LANGUAGES.map((l) => ({
        id: l.name,
        title: l.native,
        note: l.native === l.name ? '' : l.name,
        search: [l.native, l.name],
        textProps: { lang: l.code, dir: l.rtl ? 'rtl' : 'ltr' },
      })),
    [],
  )
  return (
    <SearchList
      label={t('Language')}
      items={items}
      value={value}
      onChange={onChange}
      placeholder={t('Search {count} languages', { count: LANGUAGES.length })}
    />
  )
}

export function CountryPicker({ value, onChange }) {
  const guess = guessCountry()
  const ui = uiLanguageCode()
  const items = useMemo(() => {
    const list = countryList().map((c) => ({
      id: c.code,
      title: c.name,
      note: c.code === guess ? t('our guess') : '',
      search: [c.name, countryName(c.code, 'en'), c.code],
    }))
    const first = list.find((c) => c.id === guess)
    return first ? [first, ...list.filter((c) => c !== first)] : list
  }, [guess, ui])
  return (
    <SearchList
      label={t('Country')}
      items={items}
      value={value}
      onChange={onChange}
      placeholder={t('Search for a country')}
    />
  )
}

// The first visit: two short screens, then the app.
export default function Onboarding({ language, country, onLanguage, onCountry, onDone }) {
  const [step, setStep] = useState(1)
  return (
    <section className="card setup-card">
      <div className="setup-top">
        <Logo size={44} />
        <span className="small muted">{t('Step {step} of 2', { step })}</span>
      </div>
      {step === 1 ? (
        <>
          <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Which language do you speak?')}</h1>
          <p className="muted">{t('Kamarat explains your letters in this language.')}</p>
          <LanguagePicker value={language} onChange={onLanguage} />
          <button className="primary big wide" onClick={() => setStep(2)}>
            {t('Next')} <ArrowIcon className="arrow-forward" />
          </button>
        </>
      ) : (
        <>
          <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Where do you live now?')}</h1>
          <p className="muted">{t('So Kamarat can find the right official websites and count working days the right way.')}</p>
          <CountryPicker value={country} onChange={onCountry} />
          <p className="small muted setup-promise">
            <LockIcon width={16} height={16} /> {t('Your letters stay on this device. No account needed.')}
          </p>
          <div className="buttons">
            <button className="secondary" onClick={() => setStep(1)}>{t('Back')}</button>
            <button className="primary big" onClick={onDone}>{t('Start')}</button>
          </div>
        </>
      )}
    </section>
  )
}

// Settings: the same two choices, any time.
export function Settings({ language, country, onLanguage, onCountry, onBack }) {
  return (
    <section className="card setup-card">
      <button className="ghost back-button" onClick={onBack}>
        <ArrowIcon className="flip" width={18} height={18} /> {t('Back')}
      </button>
      <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Language and country')}</h1>
      <h2 className="step-group-title">{t('Language')}</h2>
      <LanguagePicker value={language} onChange={onLanguage} />
      <h2 className="step-group-title">{t('Where you live')}</h2>
      <CountryPicker value={country} onChange={onCountry} />
      <p className="small muted">{t('Saved only on this device.')}</p>
    </section>
  )
}
