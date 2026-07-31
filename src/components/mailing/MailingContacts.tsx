import { useEffect, useRef, useState } from 'react'
import {
  createGroup,
  deleteContact,
  deleteGroup,
  fetchContacts,
  fetchGroups,
  parseContactsFile,
  saveContacts,
  saveContactsToGroup,
  type Contact,
  type Group,
} from '../../lib/mailing'

const inputClass =
  'min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function MailingContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newGroup, setNewGroup] = useState('')
  const [targetGroup, setTargetGroup] = useState<string>('') // '' = todos (general)
  const [query, setQuery] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    const [c, g] = await Promise.all([fetchContacts(), fetchGroups()])
    setContacts(c)
    setGroups(g)
  }

  useEffect(() => {
    reload()
      .catch(() => setError('No pudimos cargar los contactos.'))
      .finally(() => setLoading(false))
  }, [])

  const onFile = async (file: File) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const parsed = await parseContactsFile(file)
      if (parsed.length === 0) {
        setError('No encontramos correos válidos en el archivo.')
        return
      }
      const res = targetGroup
        ? await saveContactsToGroup(targetGroup, parsed)
        : await saveContacts(parsed)
      setNotice(
        `${res.added} contacto(s) nuevo(s) guardado(s), ${res.duplicates} ya existían (no se duplican)` +
          (targetGroup ? ' y se agregaron al grupo.' : '.'),
      )
      await reload()
    } catch (e) {
      console.error('Error al subir la lista de contactos:', e)
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'No se pudo procesar el archivo. Revisa que sea .xlsx o .csv.',
      )
    } finally {
      setBusy(false)
    }
  }

  const onAddOne = async () => {
    const email = manualEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      setError('Escribe un correo válido.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const one = [{ email, name: manualName.trim() || null }]
      const res = targetGroup
        ? await saveContactsToGroup(targetGroup, one)
        : await saveContacts(one)
      setNotice(
        res.added > 0
          ? `Contacto agregado${targetGroup ? ' al grupo.' : '.'}`
          : `Ese correo ya estaba en la lista${targetGroup ? ' — se agregó al grupo.' : ' (no se duplica).'}`,
      )
      setManualEmail('')
      setManualName('')
      await reload()
    } catch (e) {
      console.error('Error al agregar contacto:', e)
      setError(e instanceof Error && e.message ? e.message : 'No se pudo agregar el contacto.')
    } finally {
      setBusy(false)
    }
  }

  const onCreateGroup = async () => {
    if (!newGroup.trim()) return
    setError(null)
    try {
      await createGroup(newGroup.trim())
      setNewGroup('')
      await reload()
    } catch {
      setError('No se pudo crear el grupo.')
    }
  }

  const filtered = query
    ? contacts.filter(
        (c) =>
          c.email.includes(query.toLowerCase()) ||
          (c.name ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : contacts

  return (
    <div className="flex flex-col gap-10">
      {/* upload */}
      <section className="flex flex-col gap-4">
        <h2 className="noid-label">SUBIR LISTA</h2>
        <p className="text-xs leading-loose tracking-[0.1em] text-white/60">
          Sube un Excel (.xlsx) o CSV con los correos. Detectamos la columna de
          correo automáticamente, quitamos duplicados y conservamos los contactos
          que ya tenías.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            Guardar en
          </label>
          <select
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
            className={`${inputClass} sm:w-56`}
          >
            <option value="">Todos (general)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="noid-button disabled:opacity-40"
          >
            {busy ? 'Procesando…' : 'Subir archivo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {notice && (
          <p role="status" className="text-xs tracking-[0.1em] text-accent">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs tracking-[0.1em] text-accent">
            {error}
          </p>
        )}
      </section>

      {/* add one manually */}
      <section className="flex flex-col gap-4">
        <h2 className="noid-label">AGREGAR UNO</h2>
        <p className="text-xs leading-loose tracking-[0.1em] text-white/60">
          Agrega un correo a mano. Se guarda en «{targetGroup
            ? groups.find((g) => g.id === targetGroup)?.name ?? 'el grupo'
            : 'Todos (general)'}» (cámbialo arriba en «Guardar en»).
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddOne())}
            placeholder="correo@ejemplo.com"
            aria-label="Correo del contacto"
            className={`${inputClass} flex-1`}
          />
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddOne())}
            placeholder="NOMBRE (OPCIONAL)"
            aria-label="Nombre del contacto"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => void onAddOne()}
            disabled={busy || !manualEmail.trim()}
            className="noid-button disabled:opacity-40"
          >
            + Agregar
          </button>
        </div>
      </section>

      {/* groups */}
      <section className="flex flex-col gap-4">
        <h2 className="noid-label">GRUPOS</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onCreateGroup())}
            placeholder="NOMBRE DEL GRUPO"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => void onCreateGroup()}
            disabled={!newGroup.trim()}
            className="noid-button disabled:opacity-40"
          >
            + Grupo
          </button>
        </div>
        {groups.length > 0 && (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-4 border border-white/5 px-4 py-3"
              >
                <span className="text-xs uppercase tracking-[0.15em] text-white">{g.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] tracking-[0.2em] text-white/40">
                    {g.member_count} contactos
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      deleteGroup(g.id).then(reload).catch(() => setError('No se pudo eliminar.'))
                    }
                    className="text-[9px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-accent"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* contacts list */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="noid-label">CONTACTOS</h2>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            {contacts.length} en total
          </span>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="BUSCAR POR CORREO O NOMBRE"
          className={`${inputClass} w-full`}
        />
        {loading ? (
          <p className="noid-label animate-pulse py-6 text-center" role="status">
            CARGANDO
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-xs tracking-[0.15em] text-white/40">
            {contacts.length === 0 ? 'AÚN NO HAY CONTACTOS.' : 'SIN RESULTADOS.'}
          </p>
        ) : (
          <ul className="flex max-h-[420px] flex-col divide-y divide-white/5 overflow-y-auto border border-white/5">
            {filtered.slice(0, 500).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs tracking-[0.05em] text-white/80">{c.email}</p>
                  {c.name && (
                    <p className="truncate text-[10px] tracking-[0.1em] text-white/35">{c.name}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    deleteContact(c.id)
                      .then(() => setContacts((p) => p.filter((x) => x.id !== c.id)))
                      .catch(() => setError('No se pudo eliminar.'))
                  }
                  aria-label={`Eliminar ${c.email}`}
                  className="shrink-0 text-[9px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-accent"
                >
                  Quitar
                </button>
              </li>
            ))}
            {filtered.length > 500 && (
              <li className="px-4 py-3 text-center text-[10px] tracking-[0.2em] text-white/30">
                … y {filtered.length - 500} más
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
