/** Square artist photo, or the faded wordmark when there's none yet.
 *  Width comes from `className` (defaults to full width) — never both. */
export default function ArtistThumb({
  name,
  imageUrl,
  className = 'w-full',
  hover = false,
}: {
  name: string
  imageUrl: string | null
  className?: string
  /** subtle zoom/colour on parent `.group` hover (catalog cards) */
  hover?: boolean
}) {
  return (
    <div className={`aspect-square overflow-hidden bg-white/[0.02] ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className={`h-full w-full object-cover ${
            hover
              ? 'grayscale-[0.2] transition-[filter,transform] duration-700 group-hover:scale-[1.03] group-hover:grayscale-0'
              : ''
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <img src="/logo-noid-wordmark.png" alt="" className="w-1/3 max-w-16 opacity-10" />
        </div>
      )}
    </div>
  )
}
