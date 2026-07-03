-- ============================================================================
-- NO.ID RECORDS — demo product seed (fase 9)
--
-- One example product so /merch is demonstrable out of the box. Products are
-- managed from the Supabase dashboard; delete this row (and its variants)
-- once real products exist. Idempotent: seeds only when the table is empty.
-- ============================================================================

do $$
declare
  demo_id uuid;
begin
  if not exists (select 1 from public.products) then
    insert into public.products (slug, name, description, price_cop, images, active)
    values (
      'camiseta-noid-ejemplo',
      'Camiseta No.ID — Ejemplo',
      'Producto de ejemplo. Reemplázalo o elimínalo desde el panel de Supabase. '
      || 'Algodón 100%, estampado del colectivo, edición limitada.',
      90000,
      '{}',
      true
    )
    returning id into demo_id;

    insert into public.product_variants (product_id, size, stock) values
      (demo_id, 'S', 5),
      (demo_id, 'M', 8),
      (demo_id, 'L', 3),
      (demo_id, 'XL', 0);
  end if;
end $$;
