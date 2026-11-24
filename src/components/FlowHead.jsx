// Header for the new-letter flow: a back button, the step title and where you
// are in the three steps.
import { ArrowIcon, CheckIcon } from './Icons'

const STEPS = ['Add', 'Check', 'Understand']

export default function FlowHead({ step, title, backLabel, onBack }) {
  return (
    <div className="flow-head">
      <button className="ghost back-button" onClick={onBack}>
        <ArrowIcon className="flip" width={18} height={18} /> {backLabel}
      </button>
      <ol className="flow-steps" aria-label={`Step ${step} of 3`}>
        {STEPS.map((label, i) => {
          const state = i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''
          return (
            <li key={label} className={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="flow-dot">{state === 'done' ? <CheckIcon width={12} height={12} /> : i + 1}</span>
              <span className="flow-label">{label}</span>
            </li>
          )
        })}
      </ol>
      <h1 className="flow-title" tabIndex={-1} data-step-heading>{title}</h1>
    </div>
  )
}
