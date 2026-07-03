import type { MediaEmbed } from '../data/mediaEmbeds'

/**
 * Replica of the original `noid-audio-container` card.
 * Bandcamp players carry their own artwork/title, so — like the original —
 * only SoundCloud cards get the title header (bg-white/5, title + meta).
 */
export default function AudioEmbed({ embed }: { embed: MediaEmbed }) {
  return (
    <article className="noid-card group">
      {embed.platform === 'soundcloud' && (
        <header className="flex items-center justify-between gap-4 bg-white/5 px-5 py-3 transition-colors duration-300 group-hover:bg-white/10">
          <h3 className="noid-title truncate text-[14px] font-normal text-white/60">
            {embed.title}
          </h3>
          <span className="shrink-0 text-[12px] font-bold tracking-widest text-white/30">
            {embed.meta}
          </span>
        </header>
      )}
      <div className="bg-black" style={{ minHeight: embed.height }}>
        <iframe
          src={embed.embed_url}
          title={`${embed.title} — ${embed.meta} (${embed.platform})`}
          loading="lazy"
          scrolling="no"
          width="100%"
          height={embed.height}
          style={{ border: 0, display: 'block' }}
          allow="autoplay"
        />
      </div>
    </article>
  )
}
