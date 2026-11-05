import logoUrl from '../assets/swiftslate-logo.png'

export function BrandLogo({
  size,
  className = '',
  label,
}: {
  size: number
  className?: string
  label?: string
}) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      className={`brand-logo ${className}`.trim()}
      alt={label || ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  )
}
