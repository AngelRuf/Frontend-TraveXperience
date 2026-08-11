import React from 'react';

function LandingPage({ onNavigate }) {
  return (
    <div className="bg-surface text-on-surface font-sans selection:bg-secondary-container min-h-screen flex flex-col transition-colors duration-300">
      <main className="pt-20 flex-grow flex flex-col">
        
        {/* Hero Section */}
        <section className="relative min-h-[921px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div
              className="w-full h-full bg-cover bg-center scale-105 animate-[pulse_10s_infinite_alternate]"
              style={{ backgroundImage: "url('/xicotepec.png')" }}
            />

            {/* Overlay fijo para ambos temas */}
            <div className="absolute inset-0 bg-black/55"></div>

            {/* Gradiente fijo */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent"></div>
          </div>
          <div className="relative z-10 max-w-[1280px] mx-auto px-16 w-full">
            <div className="max-w-2xl">
              {/* SOLUCIÓN AQUÍ: Usamos text-white para que siempre resalte sobre el fondo negro de la imagen. 
                  Conservamos tu text-secondary-container para mantener el color amarillo/acento */}
              <h1 className="text-6xl font-bold mb-3 animate-fade-in-up leading-tight text-white">
                Descubre La Sierra Norte, <span className="text-secondary-container">a tu Manera.</span>
              </h1>
              {/* SOLUCIÓN AQUÍ: text-white/90 para que no desaparezca en modo oscuro */}
              <p className="text-lg mb-12 text-white/90 leading-relaxed">
                La plataforma integral para descubrir el Pueblo Mágico de Xicotepec de Juárez, planificar tu recorrido y organizar tus gastos sin complicaciones. Vive la Sierra Norte de Puebla sin la fricción logística.
              </p>
              <div className="flex flex-wrap gap-4">
                {/* RESTAURADO: Tu botón original con tus colores azul y amarillo */}
                <button 
                  onClick={() => onNavigate('register')}
                   className="bg-yellow-400 text-blue-950 font-bold px-10 py-5 rounded-lg hover:bg-yellow-500 active:scale-95 transition-all shadow-xl cursor-pointer border-none"
                >
                  Comienza tu Viaje
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Experience Section */}
        <section className="py-12 bg-surface-container-lowest">
          <div className="max-w-[1280px] mx-auto px-16">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="w-full lg:w-1/2 order-2 lg:order-1">
                <span className="text-secondary font-bold uppercase tracking-widest text-sm">La Experiencia</span>
                <h2 className="text-4xl font-bold mt-2 mb-6 leading-tight">Descubrimiento Visual con Planificación de Precisión</h2>
                <p className="text-lg text-on-surface-variant mb-6">
                  Nuestro mapa interactivo de Xicotepec de Juárez y la Sierra Norte de Puebla no es solo una vista; es un lienzo de planificación dinámico. Localiza cascadas, miradores y restaurantes, calcula tiempos de traslado y observa cómo tu itinerario cobra vida por la región.
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    <span className="text-base">Alertas de clima y neblina para una ruta óptima por la sierra</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    <span className="text-base">Reservas integradas de hospedaje y transporte local</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    <span className="text-base">Mapas sin conexión para las zonas de senderismo más remotas</span>
                  </li>
                </ul>
                <button 
                  onClick={() => onNavigate('login')}
                  className="border-0 border-b-2 border-solid border-primary text-primary font-bold pb-1 hover:text-secondary hover:border-secondary transition-all bg-transparent cursor-pointer"
                >
                  Ver la Experiencia del Mapa
                </button>
              </div>
              <div className="w-full lg:w-1/2 order-1 lg:order-2">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
                  <div 
                    className="aspect-video bg-cover bg-center transition-transform duration-700 group-hover:scale-110" 
                    style={{ backgroundImage: `url('https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80')` }}
                  ></div>
                  <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof / Community */}
        <section className="py-12 bg-surface">
          <div className="max-w-[1280px] mx-auto px-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-y border-solid border-outline-variant/30 py-6">
              <div className="text-center md:text-left">
                <p className="text-2xl font-bold mb-1">25k+</p>
                <p className="text-xs text-on-surface-variant">Viajeros en la Sierra Norte</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold mb-1">30+</p>
                <p className="text-xs text-on-surface-variant">Atractivos del Municipio</p>
              </div>
              <div className="text-center md:text-right">
                <div className="flex justify-center md:justify-end gap-1 text-secondary mb-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant">Planificador Mejor Valorado del Pueblo Mágico</p>
              </div>
            </div>

            {/* Marquee Slider */}
            <div className="mt-12 overflow-hidden relative w-full">
              <div className="flex gap-8 w-max animate-[marquee_20s_linear_infinite]">
                {['Cascada de Tlaxcalantongo', 'Cerro del Tabacal', 'Centro Ceremonial Xochipila', 'Museo Casa Carranza', 'Mirador Cruz Celestial'].map((dest, i) => (
                  <div key={i} className="flex items-center gap-4 bg-surface-container-high px-6 py-3 rounded-full">
                    <span className="material-symbols-outlined text-secondary">location_on</span>
                    <span className="font-semibold text-sm">{dest}</span>
                  </div>
                ))}
                {/* Duplicado para el loop */}
                {['Cascada de Tlaxcalantongo', 'Cerro del Tabacal', 'Centro Ceremonial Xochipila', 'Museo Casa Carranza', 'Mirador Cruz Celestial'].map((dest, i) => (
                  <div key={`dup-${i}`} className="flex items-center gap-4 bg-surface-container-high px-6 py-3 rounded-full">
                    <span className="material-symbols-outlined text-secondary">location_on</span>
                    <span className="font-semibold text-sm">{dest}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-12">
          <div className="max-w-[1280px] mx-auto px-16">
            {/* RESTAURADO: Tu bg-primary original */}
            <div className="bg-primary rounded-3xl p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-secondary rounded-full blur-[100px]"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary-container rounded-full blur-[100px]"></div>
              </div>
              <div className="relative z-10">
                <h2 className="text-5xl font-bold text-on-primary mb-3">¿Listo para tu próxima aventura?</h2>
                <p className="text-base text-on-primary-container max-w-xl mx-auto mb-12">
                  Únete a miles de viajeros que ya están planificando de forma más inteligente, ahorrando más y explorando más profundo. Tu viaje comienza con un solo clic.
                </p>
                {/* RESTAURADO: Tu botón original */}
                <button 
                  onClick={() => onNavigate('register')}
                  className="bg-yellow-400 text-blue-950 font-bold px-10 py-5 rounded-lg hover:bg-yellow-300 active:scale-95 transition-all shadow-xl cursor-pointer border-none"
                >
                  Comienza Gratis
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;