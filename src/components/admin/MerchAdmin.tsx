import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import { formatCOP } from '../../lib/format'
import {
  addVariant,
  createProduct,
  deleteProduct,
  deleteVariant,
  fetchAllProductsAdmin,
  updateProduct,
  updateVariantStock,
  uploadMerchImage,
  type AdminProduct,
  type ProductInput,
} from '../../lib/admin'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'

/** Variant editor — only shown when editing a saved product (needs its id). */
function VariantsEditor({ product, onChange }: { product: AdminProduct; onChange: () => void }) {
  const [size, setSize] = useState('')
  const [stock, setStock] = useState('0')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!size.trim()) return
    setBusy(true)
    try {
      await addVariant(product.id, size, Number(stock) || 0)
      setSize('')
      setStock('0')
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
      <label className={labelClass}>Tallas y stock</label>
      {product.variants.length > 0 && (
        <ul className="flex flex-col gap-2">
          {product.variants.map((v) => (
            <li key={v.id} className="flex items-center gap-3">
              <span className="w-16 text-xs uppercase tracking-[0.15em] text-white">{v.size}</span>
              <input
                type="number"
                min={0}
                defaultValue={v.stock}
                onBlur={(e) => {
                  const n = Number(e.target.value)
                  if (n !== v.stock) void updateVariantStock(v.id, n).then(onChange)
                }}
                className="w-24 border border-white/10 bg-transparent px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                aria-label={`Stock talla ${v.size}`}
              />
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">
                {v.stock === 0 ? 'sin stock' : 'unidades'}
              </span>
              <button
                type="button"
                onClick={() => void deleteVariant(v.id).then(onChange)}
                className="ml-auto text-[9px] uppercase tracking-[0.2em] text-white/30 hover:text-accent"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="TALLA (S, M, ÚNICA…)"
          className="w-40 border border-white/10 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
        />
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="Stock"
          className="w-24 border border-white/10 bg-transparent px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
          aria-label="Stock inicial"
        />
        <button type="button" onClick={() => void add()} disabled={busy} className="noid-button disabled:opacity-40">
          Añadir talla
        </button>
      </div>
    </div>
  )
}

function ProductForm({
  initial,
  onSaved,
  onCancel,
  onReloadInitial,
}: {
  initial?: AdminProduct
  onSaved: () => void
  onCancel: () => void
  onReloadInitial?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial ? String(initial.price_cop) : '')
  const [images, setImages] = useState<string[]>(initial?.images ?? [])
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onUpload = async (files: FileList) => {
    setUploading(true)
    setError(null)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) urls.push(await uploadMerchImage(file, 'merch'))
      setImages((prev) => [...prev, ...urls])
    } catch {
      setError('No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!name.trim()) return setError('Ponle un nombre al producto.')
    const priceNum = Number(price)
    if (!priceNum || priceNum <= 0) return setError('Escribe un precio válido en COP.')
    setSaving(true)
    setError(null)
    const input: ProductInput = {
      name: name.trim(),
      description: description.trim() || null,
      price_cop: Math.round(priceNum),
      images,
      active,
    }
    try {
      if (initial) await updateProduct(initial.id, input)
      else await createProduct(input)
      onSaved()
    } catch {
      setError('No se pudo guardar el producto.')
      setSaving(false)
    }
  }

  return (
    <div className="noid-card flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Nombre *</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Camiseta Oversize Flor" />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Descripción</label>
        <textarea
          className={`${inputClass} min-h-[90px] resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Material, corte, detalles…"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Precio (COP) *</label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="120000"
        />
        {Number(price) > 0 && (
          <span className="text-[10px] tracking-[0.15em] text-white/40">{formatCOP(Number(price))}</span>
        )}
      </div>

      {/* images */}
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Fotos</label>
        <div className="flex flex-wrap items-center gap-3">
          {images.map((url, i) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="h-20 w-20 object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Quitar foto"
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center border border-white/20 bg-black text-[10px] text-white/70 hover:text-accent"
              >
                ✕
              </button>
            </div>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && onUpload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 items-center justify-center border border-dashed border-white/20 text-2xl text-white/40 hover:border-white/50 disabled:opacity-40"
          >
            {uploading ? '…' : '+'}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#9a64ff]" />
        <span className="text-xs uppercase tracking-[0.15em] text-white/70">Visible en la tienda</span>
      </label>

      {/* variants only when the product exists */}
      {initial ? (
        <VariantsEditor product={initial} onChange={() => onReloadInitial?.()} />
      ) : (
        <p className="border-t border-white/5 pt-4 text-[10px] uppercase tracking-[0.15em] text-white/30">
          Guarda el producto para añadir tallas y stock.
        </p>
      )}

      {error && <p className="text-xs tracking-[0.1em] text-accent">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => void save()} disabled={saving} className="noid-button disabled:opacity-40">
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button onClick={onCancel} className="text-[10px] uppercase tracking-[0.25em] text-white/40 hover:text-white">
          {initial ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </div>
  )
}

export default function MerchAdmin() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null)

  const reload = () =>
    fetchAllProductsAdmin()
      .then(setProducts)
      .catch(() => setProducts([]))

  useEffect(() => {
    reload()
  }, [])

  const editingProduct = products?.find((p) => p.id === editing) ?? null

  const onDelete = async () => {
    const t = pendingDelete
    setPendingDelete(null)
    if (!t) return
    await deleteProduct(t.id).catch(() => {})
    reload()
  }

  const totalStock = (p: AdminProduct) => p.variants.reduce((s, v) => s + v.stock, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="noid-label">MERCH</h2>
        {!creating && !editing && (
          <button onClick={() => setCreating(true)} className="noid-button">
            + Nuevo producto
          </button>
        )}
      </div>

      {creating && (
        <ProductForm
          onSaved={() => {
            setCreating(false)
            reload()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && editingProduct && (
        <ProductForm
          initial={editingProduct}
          onReloadInitial={reload}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {products === null ? (
        <p className="noid-label animate-pulse py-8 text-center" role="status">
          CARGANDO
        </p>
      ) : products.length === 0 && !creating ? (
        <p className="py-8 text-center text-xs tracking-[0.15em] text-white/40">
          AÚN NO HAY PRODUCTOS. CREA EL PRIMERO.
        </p>
      ) : (
        !editing && (
          <ul className="flex flex-col gap-3">
            {products.map((p) => (
              <li
                key={p.id}
                className="noid-card flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt="" className="h-14 w-14 shrink-0 object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center border border-white/10 text-[9px] text-white/30">
                      s/foto
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-[12px] uppercase tracking-[0.15em] text-white">
                      {p.name}
                    </p>
                    <p className="mt-1 text-[10px] tracking-[0.15em] text-white/40">
                      {formatCOP(p.price_cop)} · {totalStock(p)} en stock
                      {!p.active && ' · OCULTO'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <button
                    onClick={() => setEditing(p.id)}
                    className="text-[9px] uppercase tracking-[0.25em] text-white/50 hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setPendingDelete(p)}
                    className="text-[9px] uppercase tracking-[0.25em] text-white/30 hover:text-accent"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="ELIMINAR PRODUCTO"
        copy={`SE ELIMINARÁ "${pendingDelete?.name}" CON SUS TALLAS. ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Eliminar"
        onConfirm={() => void onDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
