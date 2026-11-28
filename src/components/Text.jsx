// Small pieces for showing letter text: hidden details as black bars, and a
// quoted sentence shown in its place in the letter.
//
// Letter text is marked translate="no" everywhere: Katty translates its own
// screens, and a browser's "Translate this page" would otherwise send the
// letter to a translation service.
import { findQuote } from '../explain'
import { t } from '../i18n'

// Shows text with hidden details as black redaction bars.
export function SharedText({ text, className = 'shared-text', highlight }) {
  const parts = text.split(/(\[[A-Z]+_\d+\])/g)
  return (
    <div className={className} dir="auto" translate="no">
      {parts.map((part, i) =>
        /^\[[A-Z]+_\d+\]$/.test(part) ? (
          <span key={i} className="redact" title={part}>
            <span className="redact-label">{part.slice(1, -1).replace('_', ' ')}</span>
          </span>
        ) : (
          <span key={i}>{highlight ? highlight(part) : part}</span>
        ),
      )}
    </div>
  )
}

// A short piece of the letter around the quote, with the quote marked.
export function QuoteInNotice({ shared, quote }) {
  const match = findQuote(shared, quote)
  if (!match) return <p className="small muted">{t('Katty could not find this sentence in your letter.')}</p>
  const start = Math.max(0, shared.lastIndexOf('\n\n', match.start - 1) + 1)
  const endBreak = shared.indexOf('\n\n', match.end)
  const end = endBreak === -1 ? shared.length : endBreak
  return (
    <div className="in-notice">
      <span className="quote-head">{t('In your letter')}</span>
      <SharedText text={shared.slice(start, match.start)} className="in-notice-text" />
      <mark className="in-notice-mark">
        <SharedText text={shared.slice(match.start, match.end)} className="in-notice-text" />
      </mark>
      <SharedText text={shared.slice(match.end, end)} className="in-notice-text" />
    </div>
  )
}
