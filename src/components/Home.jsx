// Home: one big way in (scan or add a letter), then what is coming up and
// your letters. "How it works" is only shown until you have kept a letter.
import { useRef } from 'react'
import { upcomingDeadlines, paperActions } from '../papers'
import { daysUntil, whenText, closeness } from '../worry'
import { EXAMPLES } from '../examples'
import { isPhone } from '../device'
import { languageProps } from '../explain'
import { t } from '../i18n'
import { CameraIcon, FileIcon, ClipboardIcon, ArrowIcon, LockIcon, CheckIcon, Flag, LetterArt } from './Icons'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return t('Hello')
  if (hour < 12) return t('Good morning')
  if (hour < 18) return t('Good afternoon')
  return t('Good evening')
}

export default function Home({ papers, onResume, onFile, onPaste, onExample, onOpenPaper, onOpenPapers }) {
  const cameraInput = useRef(null)
  const fileInput = useRef(null)
  const phone = isPhone()
  const { dated, unknown } = upcomingDeadlines(papers)
  const recent = papers.slice(0, 3)

  const how = [
    { icon: CameraIcon, title: t('Add your letter'), text: t('Take a photo, upload a PDF or paste the text.') },
    { icon: LockIcon, title: t('Check what is private'), text: t('Kamarat hides your personal details on your device, and you see exactly what is sent.') },
    { icon: CheckIcon, title: t('Know what to do'), text: t('Clear steps, dates and answers, in your language.') },
  ]

  function picked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="home">
      {/* The top: a big hello, a picture and the one main button. */}
      <div className="home-hero">
      <section className="home-hello">
        <h1 className="home-title" tabIndex={-1} data-step-heading>{greeting()}</h1>
        <p className="lead">{t("Got an official letter? I'll tell you what it means and what to do.")}</p>
      </section>
      <LetterArt className="home-art" />

      <section className="scan-card">
        <button className="scan-main" onClick={() => (phone ? cameraInput : fileInput).current?.click()}>
          <span className="scan-icon"><CameraIcon width={30} height={30} /></span>
          <span>
            <strong>{phone ? t('Scan a letter') : t('Add a letter')}</strong>
            <span className="small">
              {phone ? t('Read on your device, never uploaded') : t('A photo or a PDF, read on your device')}
            </span>
          </span>
        </button>
        <div className="scan-more">
          {phone && (
            <button className="chip-button secondary" onClick={() => fileInput.current?.click()}>
              <FileIcon width={18} height={18} /> {t('Upload a file')}
            </button>
          )}
          <button className="chip-button secondary" onClick={onPaste}>
            <ClipboardIcon width={18} height={18} /> {t('Paste the text')}
          </button>
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
        <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={picked} />
      </section>
      </div>

      {/* Everything else sits on a white sheet below the top. */}
      <div className="home-sheet">
      {onResume && (
        <button className="home-card resume" onClick={onResume}>
          <span>
            <strong>{t('Continue with your letter')}</strong>
            <span className="small muted">{t('The explanation is still open.')}</span>
          </span>
          <ArrowIcon className="arrow-forward" />
        </button>
      )}

      {(dated.length > 0 || unknown.length > 0) && (
        <section className="home-section">
          <h2 className="section-title">{t('Coming up')}</h2>
          <ul className="coming-list">
            {dated.slice(0, 3).map(({ paper, action, date }) => (
              <li key={`${paper.id}-${action.index}`}>
                <button className={`coming-item ${closeness(date)}`} onClick={() => onOpenPaper(paper.id)}>
                  <span className={`coming-when ${daysUntil(date) <= 7 ? 'is-soon' : ''}`}>{whenText(date)}</span>
                  <span className="coming-body">
                    <strong {...languageProps(paper.language)}>{action.title}</strong>
                    <span className="small muted">{paper.sender}</span>
                  </span>
                  <ArrowIcon className="arrow-forward" width={18} height={18} />
                </button>
              </li>
            ))}
            {unknown.length > 0 && (
              <li>
                <button className="coming-item" onClick={() => onOpenPaper(unknown[0].paper.id)}>
                  <span className="coming-when">{t('Date not known')}</span>
                  <span className="coming-body">
                    <strong {...languageProps(unknown[0].paper.language)}>{unknown[0].action.title}</strong>
                    <span className="small muted">{t('Tell Kamarat when you got the letter')}</span>
                  </span>
                  <ArrowIcon className="arrow-forward" width={18} height={18} />
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="home-section">
          <div className="row-between">
            <h2 className="section-title">{t('Your letters')}</h2>
            <button className="link-button" onClick={onOpenPapers}>{t('All my papers')}</button>
          </div>
          <ul className="paper-list">
            {recent.map((paper) => {
              const todo = paperActions(paper).filter((a) => a.group !== 'CHECK')
              const doneCount = todo.filter((a) => a.done).length
              return (
                <li key={paper.id}>
                  <button className="paper-item" onClick={() => onOpenPaper(paper.id)}>
                    <span className="paper-item-top">
                      <strong>{paper.sender}</strong>
                      {todo.length > 0 && (
                        <span className="small muted">{t('{done} of {total} done', { done: doneCount, total: todo.length })}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {papers.length === 0 && (
        <section className="home-how" aria-label={t('How it works')}>
          <h2 className="section-title">{t('How it works')}</h2>
          <ol>
            {how.map((step) => (
              <li key={step.title}>
                <step.icon className="how-icon" width={44} height={44} strokeWidth={1.5} />
                <span>
                  <strong>{step.title}</strong>
                  <span className="small muted">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="home-examples">
            <span className="small muted">{t('No letter at hand? Try an example:')}</span>
            {EXAMPLES.map((example) => (
              <button key={example.id} className="chip-button secondary" onClick={() => onExample(example)}>
                <Flag country={example.country} /> {example.sender}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="small muted home-promise">
        <LockIcon width={16} height={16} /> {t('No account needed. Kamarat explains letters; it is not legal advice.')}
      </p>
      </div>
    </div>
  )
}
