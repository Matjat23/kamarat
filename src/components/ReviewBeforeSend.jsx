// The last check before a question you typed leaves the device: exactly the
// text that will be sent, with numbers, emails and any names found already
// hidden. Used by both chats.
import { SharedText } from './Text'
import { t } from '../i18n'

export default function ReviewBeforeSend({ review, onEdit, onSend }) {
  let head
  if (!review.namesChecked) {
    head = t('On this device Kamarat cannot spot names. Check that there are no names or other personal details, then send. This is exactly what will be sent:')
  } else if (review.found) {
    head = t('Kamarat found more personal details and hid them. This is exactly what will be sent:')
  } else {
    head = t('Kamarat looked for names on your device and found none. Check it yourself too. This is exactly what will be sent:')
  }
  return (
    <div className="review-note review-final" role="status">
      <span className="quote-head">{head}</span>
      <SharedText text={review.masked} className="review-note-text" />
      <div className="buttons">
        <button className="secondary" onClick={onEdit}>{t('Edit question')}</button>
        {/* The form is gone while this shows, so focus moves here. */}
        <button className="primary" onClick={onSend} autoFocus>{t('Send it')}</button>
      </div>
    </div>
  )
}
