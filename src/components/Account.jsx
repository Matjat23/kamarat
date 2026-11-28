// The account screen: optional Google sign-in that keeps My move on every
// device. Nothing else is synced.
import { useAccount, signIn, signOut, deleteAccount } from '../accountState'
import { t } from '../i18n'
import { ArrowIcon, CheckIcon, DeviceIcon, LockIcon, PersonIcon, Dots } from './Icons'

export default function Account({ onBack }) {
  const account = useAccount()
  const busy = account.status === 'busy'

  function confirmDelete() {
    if (window.confirm(t('Delete your account and the synced My move? My move stays on this device.'))) deleteAccount()
  }

  return (
    <section className="card account-card">
      <button className="ghost back-button" onClick={onBack}>
        <ArrowIcon className="flip" width={18} height={18} /> {t('Back')}
      </button>
      <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Account')}</h1>

      {account.status === 'signed-in' ? (
        <>
          <p className="account-who">
            <PersonIcon width={22} height={22} /> {t('Signed in as {name}', { name: account.name })}
          </p>
          <p className={account.syncError ? 'notice notice-warn small' : 'account-synced'} role="status">
            {account.syncError ? (
              t('My move could not be synced right now. It is still saved on this device.')
            ) : (
              <>
                <CheckIcon width={18} height={18} /> {t('My move is synced with your account.')}
              </>
            )}
          </p>
          <div className="buttons">
            <button className="secondary" onClick={signOut} disabled={busy}>{t('Sign out')}</button>
            <button className="ghost danger" onClick={confirmDelete} disabled={busy}>{t('Delete my account')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="lead">{t('Sign in to keep My move on your phone and your computer.')}</p>
          <button className="primary big" onClick={signIn} disabled={busy}>
            {busy ? <Dots /> : null} {t('Sign in with Google')}
          </button>
        </>
      )}

      {account.error && <p className="notice notice-warn small" role="alert">{t(account.error)}</p>}

      <ul className="account-facts">
        <li><DeviceIcon width={20} height={20} /> {t('Only My move is synced: where you are moving, your reason and your steps.')}</li>
        <li><LockIcon width={20} height={20} /> {t('Letters, papers and personal details stay on this device.')}</li>
        <li><PersonIcon width={20} height={20} /> {t('Signing in stores your Google name and email with Firebase, so Katty knows it is you.')}</li>
      </ul>
      <p className="small muted">{t('No account needed. Katty works the same without one.')}</p>
    </section>
  )
}
