// Choosing a language and a country: once on the first visit, and later on the
// settings screen. Both lists can be searched by the name in the chosen
// language or in English, and Katty's guess from the browser comes first.
// Country names come from the browser in the chosen language, so they work
// even before Katty's own texts are translated.
import { useEffect, useMemo, useRef, useState } from 'react'
import { LANGUAGES } from '../explain'
import { countryList, countryName, guessCountry, COUNTRY_ALIASES } from '../countries'
import { t } from '../i18n'
import { Wordmark, CheckIcon, ArrowIcon, LockIcon, Dots } from './Icons'

// Lower case without accents, so "francais" finds "Français".
const plain = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

// How well an item matches the search, lower is better: 0 the whole name or a
// short form ("us", "uk"), 1 the name on screen starts with it, 2 another name
// or a word in a name starts with it, 3 only somewhere inside a word. -1 is no
// match. The first entry of item.search is the name on screen, so "d" lists
// Denmark before Congo - Kinshasa (also called DRC).
function matchRank(item, q) {
  const names = item.search.map(plain)
  if (names.includes(q) || (item.exact ?? []).some((s) => plain(s) === q)) return 0
  if (names[0].startsWith(q)) return 1
  if (names.some((s) => s.startsWith(q) || s.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(q)))) return 2
  if (names.some((s) => s.includes(q))) return 3
  return -1
}

// A searchable list. Only one option is in the tab order; the arrow keys move
// between options, and Enter or Space chooses one.
function SearchList({ label, items, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const listRef = useRef(null)
  const shown = useMemo(() => {
    const q = plain(query.trim())
    if (!q) return items
    const ranked = items.map((item) => ({ item, rank: matchRank(item, q) })).filter((m) => m.rank >= 0)
    // "us" should not list Australia and Belarus: letters inside a word only
    // count when nothing starts with them (names without spaces, like 美国).
    const good = ranked.filter((m) => m.rank < 3)
    return (good.length ? good : ranked).sort((a, b) => a.rank - b.rank).map((m) => m.item)
  }, [items, query])
  const tabbable = shown.some((item) => item.id === value) ? value : shown[0]?.id

  function move(event) {
    const options = [...(listRef.current?.querySelectorAll('[role="option"]') ?? [])]
    const index = options.indexOf(document.activeElement)
    let next = null
    if (event.key === 'ArrowDown') next = options[Math.min(index + 1, options.length - 1)] ?? options[0]
    if (event.key === 'ArrowUp') next = index <= 0 ? null : options[index - 1]
    if (event.key === 'Home') next = options[0]
    if (event.key === 'End') next = options[options.length - 1]
    if (event.key === 'ArrowUp' && index <= 0) {
      event.preventDefault()
      listRef.current?.parentElement?.querySelector('input')?.focus()
      return
    }
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  return (
    <div className="search-list">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            listRef.current?.querySelector('[role="option"]')?.focus()
          }
        }}
        placeholder={placeholder}
        aria-label={label}
      />
      <ul role="listbox" aria-label={label} ref={listRef} onKeyDown={move}>
        {shown.map((item) => (
          <li key={item.id} role="none">
            <button
              role="option"
              aria-selected={item.id === value}
              tabIndex={item.id === tabbable ? 0 : -1}
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

// locale: the code of the chosen language, for the country names.
export function CountryPicker({ value, onChange, locale = 'en' }) {
  const guess = guessCountry()
  const items = useMemo(() => {
    const list = countryList()
      .map((c) => ({
        id: c.code,
        title: countryName(c.code, locale),
        note: c.code === guess ? t('our guess') : '',
        search: [countryName(c.code, locale), countryName(c.code, 'en'), ...(COUNTRY_ALIASES[c.code] ?? [])],
        // The two-letter code only counts as a whole ("se", "us"), so typing
        // "d" does not show Germany (DE).
        exact: [c.code],
      }))
      .sort((a, b) => a.title.localeCompare(b.title, locale))
    const first = list.find((c) => c.id === guess)
    return first ? [first, ...list.filter((c) => c !== first)] : list
  }, [guess, locale])
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

// While Katty's own texts are being translated, or if that failed.
// The note is in English on purpose: the translation is not there yet.
function TranslationNote({ status, onRetry, language }) {
  const native = LANGUAGES.find((l) => l.name === language)?.native ?? language
  if (status === 'loading') {
    return (
      <p className="small muted setup-note" role="status">
        <Dots /> Translating Katty into <bdi>{native}</bdi>. You can go on meanwhile.
      </p>
    )
  }
  if (status === 'failed') {
    return (
      <p className="small muted setup-note" role="status">
        Screens stay in English for now.{' '}
        <button className="link-button" onClick={onRetry}>Try again</button>
      </p>
    )
  }
  return null
}

// The first visit: two short screens, then the app.
export default function Onboarding({ language, country, onLanguage, onCountry, onDone, uiStatus, onRetry }) {
  const [step, setStep] = useState(1)
  const headingRef = useRef(null)
  const locale = LANGUAGES.find((l) => l.name === language)?.code ?? 'en'

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  return (
    <section className="card setup-card">
      <div className="setup-top">
        <Wordmark height={32} title="Katty" />
        <span className="small muted">{t('Step {step} of 2', { step })}</span>
      </div>
      {step === 1 ? (
        <>
          <h1 className="flow-title" tabIndex={-1} ref={headingRef} data-step-heading>{t('Which language do you speak?')}</h1>
          <p className="muted">{t('Katty helps you in this language: your move, your questions and your letters.')}</p>
          <LanguagePicker value={language} onChange={onLanguage} />
          <TranslationNote status={uiStatus} onRetry={onRetry} language={language} />
          <button className="primary big wide" onClick={() => setStep(2)}>
            {t('Next')} <ArrowIcon className="arrow-forward" />
          </button>
        </>
      ) : (
        <>
          <h1 className="flow-title" tabIndex={-1} ref={headingRef} data-step-heading>{t('Where do you live now?')}</h1>
          <p className="muted">{t('So Katty can find the right official websites and count working days the right way.')}</p>
          <CountryPicker value={country} onChange={onCountry} locale={locale} />
          <TranslationNote status={uiStatus} onRetry={onRetry} language={language} />
          <p className="small muted setup-promise">
            <LockIcon width={16} height={16} /> {t('Kept letters are saved only on this device. No account needed.')}
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
  const locale = LANGUAGES.find((l) => l.name === language)?.code ?? 'en'
  return (
    <section className="card setup-card">
      <button className="ghost back-button" onClick={onBack}>
        <ArrowIcon className="flip" width={18} height={18} /> {t('Back')}
      </button>
      <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Language and country')}</h1>
      <h2 className="step-group-title">{t('Language')}</h2>
      <LanguagePicker value={language} onChange={onLanguage} />
      <h2 className="step-group-title">{t('Where you live')}</h2>
      <CountryPicker value={country} onChange={onCountry} locale={locale} />
      <p className="small muted">{t('Saved only on this device.')}</p>
    </section>
  )
}
