import { supabase } from './supabase'

export type ProductVariant = {
  id: string
  size: string
  stock: number
}

export type ProductSummary = {
  id: string
  slug: string
  name: string
  price_cop: number
  images: string[]
}

export type ProductDetail = ProductSummary & {
  description: string | null
  variants: ProductVariant[]
}

/** Active products for the catalog (RLS already hides inactive ones). */
export async function fetchProducts(): Promise<ProductSummary[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, price_cop, images')
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProductSummary[]
}

export async function fetchProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, price_cop, images, description, variants:product_variants(id, size, stock)')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const detail = data as unknown as ProductDetail
  // stable size order (common apparel order, then anything else)
  const ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA', 'UNICA']
  detail.variants = [...(detail.variants ?? [])].sort((a, b) => {
    const ia = ORDER.indexOf(a.size.toUpperCase())
    const ib = ORDER.indexOf(b.size.toUpperCase())
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  return detail
}

/** Re-check current stock for a set of variants (used before checkout). */
export async function fetchVariantStock(
  variantIds: string[],
): Promise<Record<string, number>> {
  if (variantIds.length === 0) return {}
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, stock')
    .in('id', variantIds)
  if (error) throw error
  const map: Record<string, number> = {}
  for (const row of data ?? []) map[row.id as string] = row.stock as number
  return map
}
