/** A clue token: the thing Tireless Tracker makes. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#1f2229" />
      <circle cx="28" cy="28" r="13" fill="none" stroke="#e8b04a" strokeWidth="5" />
      <path d="M37.5 37.5 L48 48" stroke="#e8b04a" strokeWidth="6" strokeLinecap="round" />
      <path d="M22 28h12M28 22v12" stroke="#eceae6" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
