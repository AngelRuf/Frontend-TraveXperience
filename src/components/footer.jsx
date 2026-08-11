import React from 'react';

const footerLinks = [
  {
    heading: 'Compañía',
    links: [
      { label: 'Sobre Nosotros', href: '#about' },
      { label: 'Carreras', href: '#careers' },
      { label: 'Prensa', href: '#press' },
      { label: 'Blog', href: '#blog' },
    ],
  },
  {
    heading: 'Producto',
    links: [
      { label: 'Funciones', href: '#features' },
      { label: 'Precios', href: '#pricing' },
      { label: 'App Móvil', href: '#mobile' },
      { label: 'Integraciones', href: '#integrations' },
    ],
  },
  {
    heading: 'Soporte',
    links: [
      { label: 'Centro de Ayuda', href: '#help' },
      { label: 'Privacidad', href: '#privacy' },
      { label: 'Términos', href: '#terms' },
      { label: 'Contacto', href: '#contact' },
    ],
  },
];

const socials = [
  { label: 'Instagram', mono: 'IG', href: '#instagram' },
  { label: 'X / Twitter', mono: 'X', href: '#twitter' },
  { label: 'LinkedIn', mono: 'in', href: '#linkedin' },
];

function Footer() {
  return (
    <footer className="bg-primary text-on-primary">

      {/* Divisor: ruta de vuelo punteada — el detalle de firma de la marca */}
      <div className="relative w-full h-14 overflow-hidden bg-surface">
        <svg
          viewBox="0 0 1440 56"
          fill="none"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0 56 C 0 56, 0 56, 0 56" />
          <path
            d="M40 40 C 340 -10, 700 60, 1000 18 S 1360 -6, 1400 20"
            stroke="var(--color-outline-variant)"
            strokeWidth="1.5"
            strokeDasharray="1 9"
            strokeLinecap="round"
          />
          <circle cx="40" cy="40" r="4" fill="var(--color-secondary)" />
          <circle cx="1400" cy="20" r="4" fill="var(--color-secondary)" />
        </svg>
        <span
          className="material-symbols-outlined absolute text-secondary text-[20px]"
          style={{ left: '68%', top: '18px', transform: 'rotate(24deg)' }}
        >
          flight
        </span>
        {/* Base sólida que se funde con el footer */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-primary [mask-image:linear-gradient(to_top,black,transparent)]" />
      </div>

      <div className="max-w-[1280px] mx-auto px-6 md:px-16 pt-10 pb-8">

        {/* Fila superior: marca + columnas de enlaces */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-white/10">

          {/* Marca */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="/src/assets/logo_transparente.png"
                alt="TraveXperience"
                className="h-10 w-10 object-contain"
              />
              <span className="font-display-lg text-xl font-bold text-on-primary tracking-tighter">
                TraveXperience
              </span>
            </div>
            <p className="text-on-primary/50 text-sm leading-relaxed mb-6 max-w-[240px]">
              Un itinerario, todos tus destinos. Planifica en equipo, descubre por instinto.
            </p>
            {/* Redes sociales como monogramas — más honesto que iconos genéricos */}
            <div className="flex gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-secondary-container text-on-primary/80 hover:text-on-secondary-container flex items-center justify-center text-[11px] font-bold tracking-tight transition-all duration-200"
                >
                  {s.mono}
                </a>
              ))}
            </div>
          </div>

          {/* Columnas de enlaces */}
          {footerLinks.map((col) => (
            <div key={col.heading}>
              <span className="text-xs font-bold uppercase tracking-widest text-secondary-container mb-4 block">
                {col.heading}
              </span>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-on-primary/60 hover:text-on-primary text-sm transition-colors duration-150 font-medium"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Fila inferior: coordenadas de copyright + newsletter con voz de viaje */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-8">
          <div className="order-2 md:order-1">
            <p className="text-on-primary/40 text-xs font-medium">
              © {new Date().getFullYear()} TraveXperience — mapeado en cada zona horaria.
            </p>
          </div>

          <div className="order-1 md:order-2 w-full max-w-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-primary/40 mb-2">
              El Reporte del Viajero
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="tu@correo.com"
                className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-white/10 border border-white/10 text-on-primary placeholder:text-on-primary/40 outline-none focus:border-secondary-container transition-colors"
              />
              <button className="bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer border-none">
                Recibir
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;