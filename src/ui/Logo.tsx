/** The app icon (a tracker's tricorn against the moon), drawn by scripts/make-icons.mjs. */
export function Logo({ className = '' }: { className?: string }) {
  return <img src="/icon.svg" alt="" aria-hidden="true" draggable={false} className={className} />
}
