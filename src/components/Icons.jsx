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
    // Two friends side by side: "kamrat" means friend.
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#173d33" />
      <circle cx="25" cy="23" r="7" fill="#faf6ee" />
      <path d="M13 51c0-9 5.4-15 12-15s12 6 12 15z" fill="#faf6ee" />
      <circle cx="40" cy="25" r="6.5" fill="#e08a68" />
      <path d="M29 51c0-8.4 5-14 11-14s11 5.6 11 14z" fill="#e08a68" />
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

export function GlobeIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z" />
    </svg>
  )
}

export function HomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  )
}

export function PlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ChatIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  )
}

export function MenuIcon(props) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </svg>
  )
}

export function CloseIcon(props) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  )
}

// The picture on the home page: a letter in an envelope with a lock (private),
// a speech bubble (your language), a calendar (dates) and a few bits of confetti.
export function LetterArt(props) {
  return (
    <svg viewBox="0 0 360 240" aria-hidden="true" {...props}>
      <ellipse cx="185" cy="216" rx="120" ry="9" fill="#173d33" opacity="0.08" />
      <rect x="110" y="92" width="150" height="110" rx="12" fill="#173d33" />
      <rect x="128" y="40" width="114" height="124" rx="10" fill="#fffaf0" />
      <rect x="146" y="60" width="60" height="9" rx="4.5" fill="#f2c27b" />
      <rect x="146" y="80" width="80" height="6" rx="3" fill="#ddd7c9" />
      <rect x="146" y="94" width="70" height="6" rx="3" fill="#ddd7c9" />
      <rect x="146" y="108" width="52" height="6" rx="3" fill="#ddd7c9" />
      <circle cx="216" cy="128" r="14" fill="#4ecdc4" />
      <path d="M209 128.5l5 5 9-10" fill="none" stroke="#173d33" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M110 122 L185 166 L260 122 L260 190 a12 12 0 0 1 -12 12 L122 202 a12 12 0 0 1 -12 -12 Z" fill="#2c5f50" />
      <path d="M110 202 L170 157 M260 202 L200 157" stroke="#173d33" strokeWidth="3" opacity="0.35" />
      <circle cx="112" cy="94" r="19" fill="#f2c27b" />
      <path d="M105 93 v-4 a7 7 0 0 1 14 0 v4" fill="none" stroke="#173d33" strokeWidth="3" />
      <rect x="102" y="92" width="20" height="14" rx="3" fill="#173d33" />
      <rect x="4" y="30" width="92" height="60" rx="14" fill="#cfeae6" />
      <path d="M26 88 L20 110 L48 89 Z" fill="#cfeae6" />
      <rect x="18" y="46" width="58" height="8" rx="4" fill="#ffffff" />
      <rect x="18" y="62" width="40" height="8" rx="4" fill="#173d33" opacity="0.75" />
      <rect x="64" y="62" width="20" height="8" rx="4" fill="#ffffff" />
      <rect x="270" y="112" width="74" height="80" rx="12" fill="#ffffff" />
      <path d="M270 124 a12 12 0 0 1 12 -12 h50 a12 12 0 0 1 12 12 v12 h-74 Z" fill="#c94040" />
      <rect x="286" y="104" width="6" height="16" rx="3" fill="#173d33" />
      <rect x="322" y="104" width="6" height="16" rx="3" fill="#173d33" />
      <rect x="284" y="150" width="46" height="9" rx="4.5" fill="#173d33" />
      <rect x="284" y="166" width="30" height="7" rx="3.5" fill="#ddd7c9" />
      <circle cx="306" cy="60" r="7" fill="#ff8f8f" />
      <circle cx="58" cy="176" r="6" fill="#f2c27b" />
      <rect x="326" y="210" width="12" height="12" rx="3" fill="#4ecdc4" transform="rotate(45 332 216)" />
      <path d="M118 8 v18 M109 17 h18 M111.5 10.5 l13 13 M124.5 10.5 l-13 13" stroke="#8f86e8" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M22 214 q9 -14 18 0 t18 0" fill="none" stroke="#ff8f8f" strokeWidth="4" strokeLinecap="round" />
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
