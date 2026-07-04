import { Link } from 'react-router-dom'
import { SOCIALS } from '../lib/constants'

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '01 · Quiénes somos',
    body: 'No.ID Records es un sello y colectivo de techno con sede en Bogotá, Colombia. A través de este sitio ofrecemos cursos de la academia, productos de la tienda (merch) y enlaces a nuestra música. Al usar el sitio aceptas estos términos.',
  },
  {
    title: '02 · Cuentas',
    body: 'Para comprar cursos o merch necesitas una cuenta. Eres responsable de la confidencialidad de tu contraseña y de la actividad de tu cuenta. Puedes registrarte con correo y contraseña o con Google.',
  },
  {
    title: '03 · Academia y acceso a cursos',
    body: 'Los cursos se compran una sola vez y otorgan ACCESO PERMANENTE a su contenido mientras la plataforma exista. El contenido es para uso personal: no puedes redistribuir, revender ni compartir los videos ni los materiales. El acceso se otorga una vez confirmado el pago.',
  },
  {
    title: '04 · Certificados',
    body: 'Al completar el 100% de un curso puedes generar un certificado digital con un código único de verificación. El certificado acredita la finalización del curso; no constituye un título académico oficial.',
  },
  {
    title: '05 · Tienda y envíos',
    body: 'Los productos se venden según disponibilidad de inventario. Al finalizar la compra debes proporcionar datos de envío válidos (nombre, documento, dirección, ciudad y teléfono). Los tiempos de entrega se informan al confirmar el pedido.',
  },
  {
    title: '06 · Pagos',
    body: 'Los pagos se procesan en pesos colombianos (COP) a través de Bold, nuestra pasarela de pago. No almacenamos los datos de tu tarjeta. El acceso a cursos y el despacho de pedidos se realizan una vez que el pago queda aprobado.',
  },
  {
    title: '07 · Reembolsos',
    body: 'Por tratarse de contenido digital de acceso inmediato, las compras de cursos no son reembolsables una vez otorgado el acceso. Para pedidos de merch, escríbenos ante cualquier problema con tu producto o envío y buscaremos una solución.',
  },
  {
    title: '08 · Privacidad',
    body: 'Recopilamos únicamente los datos necesarios para prestar el servicio (cuenta, compras, datos de envío). No vendemos tus datos. Los correos transaccionales se envían desde no-reply@noidentityrecords.com.',
  },
  {
    title: '09 · Propiedad intelectual',
    body: 'La música, los cursos, la marca No.ID y todo el contenido del sitio pertenecen a sus respectivos autores y a No.ID Records. No está permitido su uso sin autorización.',
  },
  {
    title: '10 · Contacto',
    body: 'Para cualquier duda sobre estos términos, escríbenos por nuestros canales oficiales.',
  },
]

export default function Terminos() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-4">
        <h1 className="noid-label">TÉRMINOS Y CONDICIONES</h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">
          Última actualización: julio de 2026
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {SECTIONS.map((s) => (
          <section key={s.title} className="flex flex-col gap-3">
            <h2 className="font-display text-[11px] uppercase tracking-[0.25em] text-white">
              {s.title}
            </h2>
            <p className="text-sm leading-loose tracking-[0.03em] text-white/60">{s.body}</p>
          </section>
        ))}
      </div>

      <nav aria-label="Canales oficiales" className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/5 pt-8">
        {SOCIALS.map((s) => (
          <a
            key={s.label}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-[10px] uppercase tracking-[0.35em] text-white/40 transition-colors hover:text-white"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <Link
        to="/"
        className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
      >
        ← Volver al inicio
      </Link>
    </div>
  )
}
