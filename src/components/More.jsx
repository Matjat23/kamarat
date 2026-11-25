// "More" on phones: everything that is not on the tab bar, as rows in white
// cards. On a computer the same things are in the Menu and the footer.
import { LANGUAGES } from '../explain'
import { countryName } from '../countries'
import { t } from '../i18n'
import { ChevronIcon, FolderIcon, PlusIcon, GlobeIcon, LandmarkIcon, LockIcon, DeviceIcon, CheckIcon } from './Icons'

function Row({ icon: Icon, label, sub, onClick }) {
  return (
    <li>
      <button className="row" onClick={onClick}>
        <Icon className="row-icon" width={20} height={20} />
        <span className="row-text">
          <span className="row-label">{label}</span>
          {sub && <span className="row-sub">{sub}</span>}
        </span>
        <ChevronIcon className="row-chevron arrow-forward" width={18} height={18} />
      </button>
    </li>
  )
}

export default function More({ papersCount, language, country, onPapers, onNew, onSettings }) {
  const native = LANGUAGES.find((l) => l.name === language)?.native ?? language
  return (
    <div className="more-page">
      <h1 className="page-title" tabIndex={-1} data-step-heading>{t('More')}</h1>

      <ul className="row-group">
        <Row icon={FolderIcon} label={t('My papers')} sub={papersCount > 0 ? String(papersCount) : null} onClick={onPapers} />
        <Row icon={PlusIcon} label={t('Add a letter')} onClick={onNew} />
      </ul>

      <ul className="row-group">
        <Row icon={GlobeIcon} label={t('Language')} sub={native} onClick={onSettings} />
        <Row icon={LandmarkIcon} label={t('Where you live')} sub={countryName(country)} onClick={onSettings} />
      </ul>

      <section className="row-group row-facts" aria-labelledby="more-privacy">
        <h2 id="more-privacy" className="group-title">{t('Privacy')}</h2>
        <p><LockIcon className="row-icon" width={20} height={20} /> {t('Your personal details are hidden on your device.')}</p>
        <p><DeviceIcon className="row-icon" width={20} height={20} /> {t('Kept letters are saved only on this device.')}</p>
        <p><CheckIcon className="row-icon" width={20} height={20} /> {t('No account needed.')}</p>
      </section>

      <p className="small muted more-note">
        {t('Katty explains letters. It is not legal advice. Built with Gemini Nano on your device and Gemini in the cloud, through Firebase AI Logic.')}
      </p>
    </div>
  )
}
