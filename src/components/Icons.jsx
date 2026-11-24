// Small line icons and the Kamarat logo, drawn as SVG so no icon package is needed.

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#2f5d50" />
      <path d="M20 12h17l9 9v31H20z" fill="#faf6ee" />
      <path d="M37 12v9h9z" fill="#beb4a5" />
      <rect x="25" y="25" width="13" height="2.6" rx="1.3" fill="#beb4a5" />
      <rect x="25" y="31" width="16" height="4.4" rx="1" fill="#1f1b16" />
      <rect x="25" y="39" width="14" height="2.6" rx="1.3" fill="#beb4a5" />
      <circle cx="39.5" cy="46" r="3" fill="#c2603f" />
    </svg>
  )
}

export function LockIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function QuoteIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 7h4v4c0 3-1.5 5-4 6" />
      <path d="M14 7h4v4c0 3-1.5 5-4 6" />
    </svg>
  )
}

export function LandmarkIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M3.5 20.5h17" />
    </svg>
  )
}

export function DeviceIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="11" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  )
}

export function CloudIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 18.5h9.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 .5 9z" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export function ClipboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="5" width="12" height="16" rx="2" />
      <path d="M9.5 3.5h5v3h-5z" />
    </svg>
  )
}

export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </svg>
  )
}

export function MailIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </svg>
  )
}

export function ArrowIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function CameraIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  )
}

export function FileIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7l4.5 4.5v12.5H7z" />
      <path d="M14 3.5V8h4.5" />
    </svg>
  )
}

export function SpeakerIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  )
}

export function FolderIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function PenIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15.5 4.5 19.5 8.5 9 19H5v-4z" />
    </svg>
  )
}

// Small flags drawn in SVG, because Windows does not show flag emoji.
export function Flag({ country }) {
  const common = { width: 32, height: 22, viewBox: '0 0 32 22', 'aria-hidden': true, className: 'flag' }
  if (country === 'SE') {
    return (
      <svg {...common}>
        <rect width="32" height="22" fill="#006aa7" />
        <rect x="9" width="5" height="22" fill="#fecc02" />
        <rect y="8.5" width="32" height="5" fill="#fecc02" />
      </svg>
    )
  }
  if (country === 'US') {
    return (
      <svg {...common}>
        <rect width="32" height="22" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
          <rect key={i} y={i * (22 / 13)} width="32" height={22 / 13} fill="#b22234" />
        ))}
        <rect width="14" height={(22 / 13) * 7} fill="#3c3b6e" />
      </svg>
    )
  }
  if (country === 'FR') {
    return (
      <svg {...common}>
        <rect width="11" height="22" fill="#002395" />
        <rect x="11" width="10" height="22" fill="#fff" />
        <rect x="21" width="11" height="22" fill="#ed2939" />
      </svg>
    )
  }
  return null
}

export function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}
