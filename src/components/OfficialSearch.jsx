// "Search official websites": finds official pages for this letter in any
// country with Google Search, and shows only links on government web addresses.
import { useEffect, useRef, useState } from 'react'
import { findOfficialPages } from '../officialPages'
import { countryName } from '../countries'
import { languageProps } from '../explain'
import { LandmarkIcon, ArrowIcon, Dots } from './Icons'

// Google's search suggestions, shown as Google provides them. A shadow root
// keeps their styles apart from Kamarat's.
function SearchSuggestions({ html }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !html) return
    const root = ref.current.shadowRoot ?? ref.current.attachShadow({ mode: 'open' })
    root.innerHTML = html
  }, [html])
  return <div ref={ref} className="search-suggestions" />
}

export default function OfficialSearch({ letter, steps, country }) {
  const [state, setState] = useState({ phase: 'idle' })
  const where = country ? countryName(country) : ''
  const langProps = languageProps(letter.language)

  async function search() {
    setState({ phase: 'loading' })
    try {
      const found = await findOfficialPages({
        sender: letter.sender,
        summary: letter.summary,
        steps,
        country,
        language: letter.language,
      })
      setState({ phase: 'done', ...found })
    } catch (err) {
      console.warn('Official page search failed:', err.message)
      setState({
        phase: 'error',
        message: err.quota ? `${err.message}.` : 'Kamarat could not search right now. Try again in a minute.',
      })
    }
  }

  return (
    <div className="official-search">
      {state.phase !== 'done' && (
        <>
          <button className="secondary" onClick={search} disabled={state.phase === 'loading'}>
            {state.phase === 'loading' ? (
              <span role="status"><Dots /> Searching official websites...</span>
            ) : (
              <>
                <LandmarkIcon width={18} height={18} /> Search official websites{where ? ` for ${where}` : ''}
              </>
            )}
          </button>
          <p className="small muted">
            Kamarat sends a short summary of your letter, not the letter, to Google Search, and only shows
            government websites.
          </p>
        </>
      )}
      {state.phase === 'error' && <p className="small warning-text" role="alert">{state.message}</p>}

      {state.phase === 'done' && (
        <>
          {state.pages.length === 0 ? (
            <p className="small muted">
              Google Search found no government pages for this letter. Your country's official website or the
              sender's website is the best place to look.
            </p>
          ) : (
            <div className="sources">
              {state.pages.map((page) => (
                <a key={page.domain} className="source" href={page.url} target="_blank" rel="noopener noreferrer">
                  <span className="source-icon" aria-hidden="true"><LandmarkIcon /></span>
                  <span className="source-body">
                    <span className="eyebrow">Official website</span>
                    <strong>{page.domain}</strong>
                    {page.why && <span className="small" {...langProps}>{page.why}</span>}
                    <span className="small source-url">Found with Google Search. Government address checked.</span>
                  </span>
                  <ArrowIcon className="source-arrow" />
                </a>
              ))}
            </div>
          )}
          {state.dropped > 0 && (
            <p className="small muted">
              {state.dropped} other {state.dropped === 1 ? 'result was' : 'results were'} not on a government
              website, so Kamarat left {state.dropped === 1 ? 'it' : 'them'} out.
            </p>
          )}
          {state.suggestions && <SearchSuggestions html={state.suggestions} />}
        </>
      )}
    </div>
  )
}
