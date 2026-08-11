import React from 'react';

function MapSidebar({ currentTab = 'Capas', onTabChange }) {
  // Elementos de menú adaptados para las herramientas del mapa
  const mapMenuItems = [
    { name: 'Capas', icon: 'layers', description: 'Tipos de mapa y vistas' },
    { name: 'Rutas', icon: 'directions_car', description: 'Itinerarios y caminos' },
    { name: 'Clima', icon: 'partly_sunny', description: 'Predicciones meteorológicas' },
    { name: 'Guardados', icon: 'bookmark', description: 'Tus sitios favoritos' },
    { name: 'Tránsito', icon: 'traffic', description: 'Estado del tráfico en tiempo real' },
    { name: 'Filtros', icon: 'tune', description: 'Personalizar puntos de interés' },
  ];

  return (
    <aside className="hidden md:flex flex-col h-[calc(100vh-80px)] w-64 fixed left-0 top-20 border-0 border-r border-solid border-outline-variant bg-surface p-6 z-40">
      
      {/* Título de la sección del mapa */}
      <div className="flex flex-col gap-1 mb-6">
        <span className="font-display-lg text-xl font-bold text-primary tracking-tight">
          Exploración
        </span>
        <span className="font-sans text-xs font-medium text-on-surface-variant">
          Herramientas del mapa
        </span>
      </div>

      {/* Enlaces de Navegación del Mapa */}
      <nav className="flex flex-col gap-2">
        {mapMenuItems.map((item) => {
          const isActive = currentTab === item.name;
          return (
            <a
              key={item.name}
              href={`#${item.name.toLowerCase()}`}
              onClick={(e) => {
                if (onTabChange) {
                  e.preventDefault();
                  onTabChange(item.name);
                }
              }}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 font-sans text-sm font-semibold tracking-wide transition-all border-none cursor-pointer active:scale-[0.98] ${
                isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              title={item.description}
            >
              <span className="material-symbols-outlined text-lg">
                {item.icon}
              </span>
              <span>{item.name}</span>
            </a>
          );
        })}
      </nav>

      {/* Acceso rápido inferior (ej. Limpiar capas o Resetear mapa) */}
      <div className="mt-auto">
        <button className="w-full flex items-center justify-center gap-2 py-3 border border-solid border-outline rounded-lg font-sans text-sm font-semibold tracking-wide text-on-surface-variant bg-transparent hover:bg-surface-container-low transition-all cursor-pointer">
          <span className="material-symbols-outlined text-lg">restart_alt</span>
          <span>Resetear Vista</span>
        </button>
      </div>

    </aside>
  );
}

export default MapSidebar;