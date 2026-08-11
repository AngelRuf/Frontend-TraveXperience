import React from 'react';

function NotFound() {
  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary-container selection:text-on-secondary-container antialiased min-h-screen flex flex-col justify-between">

      {/* Contenido Principal de Error */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-16 text-center max-w-2xl mx-auto">
        
        {/* Ilustración de radar de navegación o brújula perdida en CSS puro */}
        <div className="relative w-44 h-44 mb-8 flex items-center justify-center">
          {/* Círculos concéntricos de radar */}
          <div className="absolute inset-0 rounded-full border border-primary/5 animate-ping opacity-75 [animation-duration:3s]"></div>
          <div className="absolute inset-4 rounded-full border border-primary/10"></div>
          <div className="absolute inset-10 rounded-full border border-primary/20 bg-surface-container-low shadow-inner"></div>
          
          {/* El gran número 404 integrado estéticamente */}
          <span className="relative z-10 text-5xl font-black font-display-lg text-primary tracking-tight">
            404
          </span>
          
          {/* Aguja de brújula o marcador de posición descentrado */}
          <span className="material-symbols-outlined absolute top-6 right-6 text-secondary text-2xl fill-1 rotate-45 animate-pulse">
            explore
          </span>
        </div>

        {/* Mensaje de Error */}
        <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-on-surface tracking-tight mb-3">
          Destino Fuera del Mapa
        </h1>
        
        <p className="text-on-surface-variant text-sm font-medium leading-relaxed max-w-md mb-8">
          Parece que la ruta que intentas seguir no existe o ha cambiado de coordenadas. No te preocupes, incluso los mejores exploradores toman un desvío.
        </p>

        {/* Botones Bento de Acción de Rápido Acceso */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <button 
            onClick={() => window.location.href = '#explore'}
            className="flex items-center justify-center gap-2 bg-primary text-on-primary py-3 px-5 rounded-xl text-xs font-bold hover:opacity-95 transition-all border-none cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            Volver a Explorar
          </button>
          
          <button 
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 bg-surface-container-high text-primary py-3 px-5 rounded-xl text-xs font-bold hover:bg-surface-container-highest transition-all border-none cursor-pointer active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Regresar al mapa
          </button>
        </div>

        {/* Enlaces de soporte sutiles */}
        <div className="mt-12 flex items-center gap-6 text-xs text-outline font-semibold">
          <a href="#help" className="hover:text-primary transition-colors">Centro de ayuda</a>
          <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
          <a href="#report" className="hover:text-primary transition-colors">Reportar un error</a>
        </div>
      </main>

    </div>
  );
}

export default NotFound;