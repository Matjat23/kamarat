// Home: what Katty is, then three ways in by situation (moving, a letter, a
// question), then what is coming up and your letters, as rows in white cards.
// "How it works" is only shown until you have kept a letter.
import { useRef } from 'react'
import { upcomingDeadlines, paperActions } from '../papers'
import { daysUntil, whenText, closeness } from '../worry'
import { EXAMPLES } from '../examples'
import { isPhone } from '../device'
import { languageProps } from '../explain'
import { t } from '../i18n'
import { CameraIcon, FileIcon, ClipboardIcon, ChevronIcon, LockIcon, ChatIcon, ListIcon, Flag, LetterArt } from './Icons'
import { moveProgress } from '../move'
import { countryName } from '../countries'

// One row in a white card: an icon, a title, a line under it and an arrow.
function Row({ icon: Icon, title, sub, children, onClick, titleProps }) {
  return (
    <li>
      <button className="row" onClick={onClick}>
        {Icon && <Icon className="row-icon" width={20} height={20} />}
        <span className="row-text">
          <span className="row-label" {...titleProps}>{title}</span>
          {sub && <span className="row-sub">{sub}</span>}
          {children}
        </span>
        <ChevronIcon className="row-chevron arrow-forward" width={18} height={18} />
      </button>
    </li>
  )
}

export default function Home({ papers, onResume, onFile, onPaste, onExample, onOpenPaper, onOpenPapers, movePlan, onMove, onAsk }) {
  const cameraInput = useRef(null)
  const fileInput = useRef(null)
  const phone = isPhone()
  const { dated, unknown } = upcomingDeadlines(papers)
  const recent = papers.slice(0, 3)
  const progress = movePlan ? moveProgress(movePlan) : null

  const how = [
    { title: t('Add your letter'), text: t('Take a photo, upload a PDF or paste the text.') },
    { title: t('Check what is private'), text: t('Katty hides your personal details on your device, and you see exactly what is sent.') },
    { title: t('Know what to do'), text: t('Clear steps, dates and answers, in your language.') },
  ]

  function picked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="home">
      <div className="home-hero">
        <section className="home-hello">
          <h1 className="home-title" tabIndex={-1} data-step-heading>{t('Your friend in a new country')}</h1>
          <p className="lead">{t("New in a country, or about to move? I'll help you set up, understand your letters and know who to contact.")}</p>
        </section>
        <LetterArt className="home-art" />

        {/* Three ways in, by where you are in your move. The letter is green:
            it is where Katty reads private papers on your device. */}
        <div className="home-ways-wrap">
          <ul className="home-ways">
            <li>
              <button className="way" onClick={onMove}>
                <span className="way-icon"><ListIcon width={22} height={22} /></span>
                <span className="way-text">
                  <span className="way-title">{t("I'm moving or just arrived")}</span>
                  <span className="way-sub">
                    {progress
                      ? t('{country}: {done} of {total} steps done', { country: countryName(movePlan.to), ...progress })
                      : t('Your setup steps for the new country, in one list.')}
                  </span>
                  {progress && progress.total > 0 && (
                    <span className="row-progress" aria-hidden="true">
                      <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </span>
                  )}
                </span>
                <ChevronIcon className="way-chevron arrow-forward" width={20} height={20} />
              </button>
            </li>
            <li>
              <button className="way is-main" onClick={() => (phone ? cameraInput : fileInput).current?.click()}>
                <span className="way-icon"><CameraIcon width={22} height={22} /></span>
                <span className="way-text">
                  <span className="way-title">{t('I got a letter')}</span>
                  <span className="way-sub">{phone ? t('Read on your device, never uploaded') : t('A photo or a PDF, read on your device')}</span>
                </span>
                <ChevronIcon className="way-chevron arrow-forward" width={20} height={20} />
              </button>
            </li>
            <li>
              <button className="way" onClick={onAsk}>
                <span className="way-icon"><ChatIcon width={22} height={22} /></span>
                <span className="way-text">
                  <span className="way-title">{t('I have a question')}</span>
                  <span className="way-sub">{t('Questions about your new country, and who can help.')}</span>
                </span>
                <ChevronIcon className="way-chevron arrow-forward" width={20} height={20} />
              </button>
            </li>
          </ul>
          <div className="scan-more">
            {phone && (
              <button className="secondary" onClick={() => fileInput.current?.click()}>
                <FileIcon width={18} height={18} /> {t('Upload a file')}
              </button>
            )}
            <button className="secondary" onClick={onPaste}>
              <ClipboardIcon width={18} height={18} /> {t('Paste the text')}
            </button>
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
          <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={picked} />
        </div>
      </div>

      <div className="home-sheet">
        {onResume && (
          <ul className="row-group">
            <Row title={t('Continue with your letter')} sub={t('The explanation is still open.')} onClick={onResume} />
          </ul>
        )}

        {(dated.length > 0 || unknown.length > 0) && (
          <section className="home-section">
            <h2 className="section-title">{t('Coming up')}</h2>
            <ul className="row-group">
              {dated.slice(0, 3).map(({ paper, action, date }) => (
                <li key={`${paper.id}-${action.index}`}>
                  <button className={`row coming-item ${closeness(date)}`} onClick={() => onOpenPaper(paper.id)}>
                    <span className={`coming-when ${daysUntil(date) <= 7 ? 'is-soon' : ''}`}>{whenText(date)}</span>
                    <span className="row-text">
                      <span className="row-label" {...languageProps(paper.language)}>{action.title}</span>
                      <span className="row-sub">{paper.sender}</span>
                    </span>
                    <ChevronIcon className="row-chevron arrow-forward" width={18} height={18} />
                  </button>
                </li>
              ))}
              {unknown.length > 0 && (
                <li>
                  <button className="row coming-item" onClick={() => onOpenPaper(unknown[0].paper.id)}>
                    <span className="coming-when">{t('Date not known')}</span>
                    <span className="row-text">
                      <span className="row-label" {...languageProps(unknown[0].paper.language)}>{unknown[0].action.title}</span>
                      <span className="row-sub">{t('Tell Katty when you got the letter')}</span>
                    </span>
                    <ChevronIcon className="row-chevron arrow-forward" width={18} height={18} />
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
            <ul className="row-group">
              {recent.map((paper) => {
                const todo = paperActions(paper).filter((a) => a.group !== 'CHECK')
                const doneCount = todo.filter((a) => a.done).length
                return (
                  <Row
                    key={paper.id}
                    title={paper.sender}
                    sub={todo.length > 0 ? t('{done} of {total} done', { done: doneCount, total: todo.length }) : null}
                    onClick={() => onOpenPaper(paper.id)}
                  />
                )
              })}
            </ul>
          </section>
        )}

        {papers.length === 0 && (
          <section className="home-section home-how" aria-labelledby="home-how-title">
            <h2 id="home-how-title" className="section-title">{t('How it works')}</h2>
            <ol>
              {how.map((step, i) => (
                <li key={step.title}>
                  <span className="how-num" aria-hidden="true">{i + 1}</span>
                  <span>
                    <strong>{step.title}</strong>
                    <span className="row-sub">{step.text}</span>
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
          <LockIcon width={16} height={16} /> {t('No account needed. Katty explains letters; it is not legal advice.')}
        </p>
      </div>
    </div>
  )
}
