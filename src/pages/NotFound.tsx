import EmptyState from '../components/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      label="404"
      title="AQUÍ NO HAY NADA"
      copy="LA PÁGINA QUE BUSCAS NO EXISTE. EL VACÍO ES REAL."
    />
  )
}
