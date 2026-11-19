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
    <footer className="relative bg-[#0F1B2D] dark:bg-black text-white transition-colors duration-500 overflow-hidden border-t border-white/10">
      
      {/* Halo de luz ambiental (AmbientGlow) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#F4B400]/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Divisor: ruta de vuelo punteada premium */}
      <div className="relative w-full h-16 overflow-hidden bg-transparent opacity-80">
        <svg
          viewBox="0 0 1440 56"
          fill="none"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M40 40 C 340 -10, 700 60, 1000 18 S 1360 -6, 1400 20"
            stroke="#F4B400"
            strokeWidth="2"
            strokeDasharray="4 8"
            strokeLinecap="round"
          />
          <circle cx="40" cy="40" r="4" fill="#F4B400" />
          <circle cx="1400" cy="20" r="4" fill="#F4B400" />
        </svg>
        <span
          className="material-symbols-outlined absolute text-[#F4B400] text-[24px] drop-shadow-[0_0_8px_rgba(244,180,0,0.8)]"
          style={{ left: '68%', top: '16px', transform: 'rotate(24deg)' }}
        >
          flight
        </span>
        {/* Base de fundido */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0F1B2D] dark:from-black to-transparent" />
      </div>

      <div className="relative max-w-[1280px] mx-auto px-6 md:px-16 pt-12 pb-10 z-10">

        {/* Fila superior: marca + columnas de enlaces */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-12 border-b border-white/10">

          {/* Marca */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img
                src="/src/assets/logo_transparente.png"
                alt="TraveXperience"
                className="h-12 w-12 object-contain"
              />
              <span className="font-display-lg text-2xl font-black text-white tracking-tighter">
                TraveXperience
              </span>
            </div>
            <p className="text-gray-400 text-sm font-medium leading-relaxed mb-8 max-w-[280px]">
              Un itinerario, todos tus destinos. Planifica en equipo, descubre por instinto.
            </p>
            
            {/* Redes sociales Monograma Premium */}
            <div className="flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-11 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-[#F4B400] hover:border-[#F4B400] text-gray-300 hover:text-black flex items-center justify-center text-[12px] font-black tracking-wide transition-all duration-300 hover:scale-110 hover:shadow-[0_4px_15px_rgba(244,180,0,0.3)]"
                >
                  {s.mono}
                </a>
              ))}
            </div>
          </div>

          {/* Columnas de enlaces */}
          {footerLinks.map((col) => (
            <div key={col.heading} className="lg:col-span-1">
              <span className="text-[11px] font-black uppercase tracking-[2px] text-[#F4B400] mb-6 block">
                {col.heading}
              </span>
              <ul className="flex flex-col gap-4">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white text-[14px] font-semibold transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Fila inferior: coordenadas de copyright + newsletter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-8">
          <div className="order-2 md:order-1">
            <p className="text-gray-500 text-xs font-semibold">
              © {new Date().getFullYear()} TraveXperience — Mapeado en cada zona horaria.
            </p>
          </div>

          {/* Newsletter Estilo App Premium */}
          <div className="order-1 md:order-2 w-full max-w-md">
            <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-500 mb-3">
              El Reporte del Viajero
            </p>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="tu@correo.com"
                className="flex-1 px-5 py-3.5 text-[13px] font-semibold rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 outline-none focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] transition-all"
              />
              <button className="bg-[#F4B400] text-black px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[1px] hover:scale-105 hover:shadow-[0_8px_20px_rgba(244,180,0,0.3)] active:scale-95 transition-all duration-300 border-none cursor-pointer whitespace-nowrap">
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