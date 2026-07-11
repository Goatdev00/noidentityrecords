import { useState, type FormEvent } from 'react'
import { SOCIALS } from '../lib/constants'
import { sendContactMessage } from '../lib/contact'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function Contacto() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Escribe tu nombre.')
    if (!EMAIL_RE.test(email.trim())) return setError('Escribe un correo válido.')
    if (message.trim().length < 5) return setError('Escribe tu mensaje.')
    setSending(true)
    setError(null)
    try {
      await sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        website,
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col items-center gap-5 text-center">
        <p className="noid-label">CONTACTO</p>
        <h1 className="noid-title text-xl leading-relaxed text-white md:text-3xl">HABLEMOS</h1>
        <p className="max-w-md text-xs leading-loose tracking-[0.1em] text-white/50">
          ESCRÍBENOS PARA COLABORACIONES, DEMOS, PRENSA O CUALQUIER DUDA. TE
          RESPONDEMOS A TU CORREO.
        </p>
      </header>

      {sent ? (
        <div
          className="noid-card flex flex-col items-center gap-4 p-12 text-center"
          role="status"
        >
          <p className="noid-title text-base text-white">MENSAJE ENVIADO</p>
          <p className="text-xs leading-loose tracking-[0.15em] text-white/50">
            GRACIAS POR ESCRIBIRNOS. TE RESPONDEREMOS PRONTO A {email.toUpperCase()}.
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setName('')
              setEmail('')
              setSubject('')
              setMessage('')
            }}
            className="mt-2 text-[10px] uppercase tracking-[0.25em] text-white/40 transition-colors hover:text-white"
          >
            Enviar otro mensaje
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="c-name" className={labelClass}>
                Nombre *
              </label>
              <input
                id="c-name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="c-email" className={labelClass}>
                Correo *
              </label>
              <input
                id="c-email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                maxLength={200}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="c-subject" className={labelClass}>
              Asunto
            </label>
            <input
              id="c-subject"
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Colaboración, demo, prensa…"
              maxLength={150}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="c-message" className={labelClass}>
              Mensaje *
            </label>
            <textarea
              id="c-message"
              className={`${inputClass} min-h-[160px] resize-y`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cuéntanos…"
              maxLength={5000}
            />
          </div>

          {/* honeypot — hidden from humans, catches bots */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {error && (
            <p role="alert" className="text-xs tracking-[0.1em] text-accent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="noid-button self-start disabled:opacity-40"
          >
            {sending ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </form>
      )}

      {/* direct channels */}
      <section aria-label="Otros canales" className="flex flex-col items-center gap-5 border-t border-white/5 pt-10 text-center">
        <p className={labelClass}>O ESCRÍBENOS POR</p>
        <nav aria-label="Canales de contacto" className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[10px] uppercase tracking-[0.35em] text-white/40 transition-colors duration-300 hover:text-white"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </section>
    </div>
  )
}
