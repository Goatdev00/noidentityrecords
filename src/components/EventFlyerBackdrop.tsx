/**
 * Blurred, dimmed flyer used as the backdrop of an event card (home banner +
 * /eventos). The parent must be `relative overflow-hidden group`, and the card
 * content should sit in a `relative z-10` layer above it.
 */
export default function EventFlyerBackdrop({ src }: { src: string }) {
  return (
    <>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl transition-transform duration-700 group-hover:scale-125"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/40"
      />
    </>
  )
}
