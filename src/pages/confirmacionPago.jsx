import React, { useEffect, useMemo, useRef } from 'react';

/**
 * Deriva el estado de UI evaluando los estados reales de Stripe.
 * En modo prueba, estados como 'requires_action' significan que el flujo no ha terminado.
 */
function resolveUiState(paymentResult) {
  const status = paymentResult?.status;
  if (status === 'succeeded') return 'success';
  if (status === 'processing') return 'processing';
  
  // Estados de fallo o que requieren acción (común en tarjetas de prueba)
  if (
    status === 'requires_payment_method' || 
    status === 'requires_action' || 
    status === 'canceled'
  ) {
    return 'failed';
  }
  
  return 'unknown';
}

function formatAmount(amount, currency = 'mxn') {
  if (amount === undefined || amount === null) return null;
  const value = amount / 100; // Stripe usa centavos
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase() }).format(value);
  } catch {
    return `$${value.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/**
 * @param {Object} paymentResult - El PaymentIntent de Stripe.
 * @param {Object} bookingDetails - Datos dinámicos de la reserva (hotel, fechas, bus, etc).
 */
function BookingConfirmed({ onNavigate, paymentResult, bookingDetails }) {
  const successContainerRef = useRef(null);
  const bookingRefCell = useRef(null);

  const uiState = useMemo(() => resolveUiState(paymentResult), [paymentResult]);
  const displayAmount = useMemo(() => {
    // Intenta usar el monto de Stripe, si no, usa el de los detalles de la reserva
    return formatAmount(paymentResult?.amount) || formatAmount(bookingDetails?.amountCentavos) || 'Monto pendiente';
  }, [paymentResult, bookingDetails]);

  // Efecto de Confeti solo si el pago fue exitoso
  useEffect(() => {
    if (uiState !== 'success') return undefined;
    const container = successContainerRef.current;
    if (!container) return undefined;

    const colors = ['#4648d4', '#6063ee', '#c0c1ff'];
    const confettiElements = [];

    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'absolute w-2 h-2 rounded-full opacity-0 pointer-events-none';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.top = (Math.random() * 50 + 20) + '%';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      container.appendChild(confetti);
      confettiElements.push(confetti);

      const duration = Math.random() * 2 + 1;
      const delay = Math.random() * 0.5;

      confetti.animate([
        { transform: 'translateY(0) scale(0)', opacity: 0 },
        { transform: `translateY(-${Math.random() * 100 + 50}px) translateX(${(Math.random() - 0.5) * 100}px) scale(1)`, opacity: 0.6, offset: 0.3 },
        { transform: `translateY(${Math.random() * 100}px) translateX(${(Math.random() - 0.5) * 200}px) scale(0)`, opacity: 0 }
      ], {
        duration: duration * 1000,
        delay: delay * 1000,
        easing: 'cubic-bezier(0, .9, .57, 1)',
        fill: 'forwards'
      });
    }

    return () => {
      confettiElements.forEach(el => el.remove());
    };
  }, [uiState]);

  const handleCopyCode = () => {
    if (bookingRefCell.current) {
      const range = document.createRange();
      range.selectNode(bookingRefCell.current);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);

      bookingRefCell.current.classList.add('bg-secondary-container/30', 'dark:bg-secondary-container/10');
      setTimeout(() => {
        if (bookingRefCell.current) {
          bookingRefCell.current.classList.remove('bg-secondary-container/30', 'dark:bg-secondary-container/10');
        }
      }, 500);
    }
  };

  const HEADER_BY_STATE = {
    success: {
      title: '¡Pago Exitoso!',
      subtitle: 'Tu experiencia está reservada. Tu recorrido comienza ahora.',
    },
    processing: {
      title: 'Pago en Proceso',
      subtitle: 'Stripe o tu banco están confirmando el pago (entorno de prueba o asíncrono). Te avisaremos pronto.',
    },
    failed: {
      title: 'Pago Incompleto o Fallido',
      subtitle: 'La tarjeta fue rechazada o requiere autenticación adicional. No se realizó el cargo final.',
    },
    unknown: {
      title: 'Estado No Disponible',
      subtitle: 'No pudimos confirmar el resultado. Revisa tu historial de pagos.',
    },
  };

  const header = HEADER_BY_STATE[uiState];

  // Se eliminan los hex hardcodeados para usar colores de Tailwind que respetan el modo oscuro
  const ICON_BY_STATE = {
    success: { colorClass: 'text-primary dark:text-blue-400' },
    processing: { colorClass: 'text-yellow-600 dark:text-yellow-400' },
    failed: { colorClass: 'text-error dark:text-red-400' },
    unknown: { colorClass: 'text-on-surface-variant dark:text-gray-400' },
  };
  const icon = ICON_BY_STATE[uiState];

  return (
    <div className="bg-background dark:bg-gray-950 text-on-background dark:text-gray-100 font-sans selection:bg-secondary-container min-h-screen flex flex-col antialiased">
      <style>{`
        .success-check-animate {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: dash-check 0.8s ease-in-out forwards;
        }
        @keyframes dash-check {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <main className="flex-grow w-full max-w-[800px] mx-auto px-6 md:px-0 pt-24 pb-12 flex flex-col items-center">
        
        {/* Cabecera del Estado del Pago */}
        <div ref={successContainerRef} className="relative text-center mb-12 w-full pt-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-surface dark:bg-gray-900 border border-outline-variant/30 dark:border-gray-800 shadow-md mb-8">
            <div className={icon.colorClass}>
              {uiState === 'processing' ? (
                <span className="material-symbols-outlined animate-spin text-[40px] block">
                  progress_activity
                </span>
              ) : (
                <svg className="stroke-current" fill="none" height="48" viewBox="0 0 48 48" width="48" xmlns="http://www.w3.org/2000/svg">
                  <circle className="success-check-animate" cx="24" cy="24" r="23" strokeWidth="2"></circle>
                  {uiState === 'success' && (
                    <path className="success-check-animate" d="M15 24.5L21 30.5L33 18.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" style={{ animationDelay: '0.2s' }}></path>
                  )}
                  {uiState === 'failed' && (
                    <path className="success-check-animate" d="M17 17L31 31M31 17L17 31" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" style={{ animationDelay: '0.2s' }}></path>
                  )}
                  {uiState === 'unknown' && (
                    <text x="24" y="31" textAnchor="middle" fontSize="20" fontWeight="bold" fill="currentColor">?</text>
                  )}
                </svg>
              )}
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-on-surface dark:text-white tracking-tight mb-4">{header.title}</h1>
          <p className="text-base text-on-surface-variant dark:text-gray-400 max-w-md mx-auto leading-relaxed">
            {header.subtitle}
          </p>
        </div>

        {/* Detalles Dinámicos de la Reserva */}
        {(uiState === 'success' || uiState === 'processing') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-12">
            <div className="bg-surface dark:bg-gray-900 border border-outline-variant/50 dark:border-gray-800 p-6 md:p-8 rounded-xl flex flex-col justify-between shadow-sm md:col-span-2">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-outline-variant/30 dark:border-gray-800 pb-8">
                <div>
                  <span className="text-xs font-bold text-on-surface-variant dark:text-gray-500 uppercase tracking-wider block mb-1">Destino</span>
                  <h2 className="text-xl font-bold text-on-surface dark:text-white">
                    {bookingDetails?.title || 'Alojamiento / Experiencia'}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="material-symbols-outlined text-[18px] text-secondary dark:text-blue-400">location_on</span>
                    <span className="text-sm text-on-surface-variant dark:text-gray-400">
                      {bookingDetails?.location || 'Dirección no especificada'}
                    </span>
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <span className="text-xs font-bold text-on-surface-variant dark:text-gray-500 uppercase tracking-wider block mb-1">Fechas</span>
                  <p className="text-base font-semibold text-primary dark:text-blue-300">
                    {bookingDetails?.dates || 'Fechas por confirmar'}
                  </p>
                  <p className="text-xs text-on-surface-variant dark:text-gray-400 mt-1">
                    {bookingDetails?.guestsInfo || 'Detalles de huéspedes'}
                  </p>
                </div>
              </div>

              {/* Renderizado Condicional de Transporte (Autobús) */}
              {bookingDetails?.hasBus && (
                <div className="mb-8 p-4 bg-secondary-container/20 dark:bg-gray-800 rounded-lg border border-secondary-container/40 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-secondary dark:text-blue-400">directions_bus</span>
                    <h3 className="text-sm font-bold text-on-surface dark:text-white">Tickets de Autobús Incluidos</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant dark:text-gray-400">
                    Tu viaje de ida y vuelta está programado. Revisa tus boletos en el itinerario.
                  </p>
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <span className="text-xs font-bold text-on-surface-variant dark:text-gray-500 uppercase tracking-wider block mb-1">Referencia de Reserva</span>
                  <span
                    ref={bookingRefCell}
                    onClick={handleCopyCode}
                    className="font-mono text-sm font-semibold text-primary dark:text-blue-300 px-3 py-1.5 bg-surface-container dark:bg-gray-800 rounded border border-outline-variant/30 dark:border-gray-700 select-all cursor-pointer transition-colors block text-center md:inline-block"
                  >
                    {paymentResult?.id || bookingDetails?.id || 'Ref-Pendiente'}
                  </span>
                </div>
                <div className="text-left md:text-right w-full md:w-auto">
                  <span className="text-xs font-bold text-on-surface-variant dark:text-gray-500 uppercase tracking-wider block mb-1">
                    {uiState === 'processing' ? 'Monto a Confirmar' : 'Monto Total'}
                  </span>
                  <div className="text-3xl font-bold text-primary dark:text-blue-400">{displayAmount}</div>
                  <div className="flex items-center md:justify-end gap-1 text-secondary dark:text-green-400 mt-1">
                    <span className="material-symbols-outlined text-[16px] fill-1">verified</span>
                    <span className="text-xs font-semibold">Protegido con Stripe</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta: ¿Qué sigue? */}
            <div className="bg-surface-container-low dark:bg-gray-900 border border-outline-variant/50 dark:border-gray-800 p-6 rounded-xl">
              <h3 className="text-lg font-bold text-on-surface dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary dark:text-blue-400">auto_awesome</span>
                ¿Qué sigue?
              </h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary dark:bg-blue-600 text-on-primary flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold">01</span>
                  </div>
                  <p className="text-sm text-on-surface-variant dark:text-gray-400 leading-relaxed">
                    {uiState === 'processing'
                      ? 'Te enviaremos un correo apenas tu banco confirme el pago en el entorno de prueba.'
                      : 'Revisa tu correo para ver el comprobante de confirmación y tu recibo digital.'}
                  </p>
                </li>
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary dark:bg-blue-600 text-on-primary flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold">02</span>
                  </div>
                  <p className="text-sm text-on-surface-variant dark:text-gray-400 leading-relaxed">Sincroniza tu itinerario con tu calendario personal o Google Maps.</p>
                </li>
              </ul>
            </div>

            {/* Tarjeta: Tip Visual */}
            <div className="relative overflow-hidden border border-outline-variant/50 dark:border-gray-800 rounded-xl group min-h-[160px]">
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80')` }}
              />
              <div className="absolute bottom-4 left-4 z-20">
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Tip de Viaje</p>
                <p className="text-sm text-white font-medium mt-0.5">Lleva ropa abrigadora para disfrutar del clima templado.</p>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex flex-col md:flex-row gap-4 w-full">
          {uiState === 'failed' ? (
            <button
              onClick={() => { if (onNavigate) onNavigate('checkout'); }}
              className="flex-1 bg-primary dark:bg-blue-600 text-on-primary dark:text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer border-none"
            >
              <span className="material-symbols-outlined">refresh</span>
              Intentar de Nuevo
            </button>
          ) : (
            <button
              onClick={() => { if (onNavigate) onNavigate('itinerario'); }}
              className="flex-1 bg-primary dark:bg-blue-600 text-on-primary dark:text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer border-none"
            >
              <span className="material-symbols-outlined">event_note</span>
              Ver Itinerario
            </button>
          )}
          <button
            onClick={() => { if (onNavigate) onNavigate('settings', { tab: 'Payments' }); }}
            className="flex-1 bg-surface dark:bg-gray-800 border border-outline dark:border-gray-600 text-primary dark:text-blue-400 font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container-low dark:hover:bg-gray-700 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined">receipt_long</span>
            Ver Historial
          </button>
          <button
            onClick={() => { if (onNavigate) onNavigate('inicio'); }}
            className="flex-1 bg-transparent text-on-surface-variant dark:text-gray-400 font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container dark:hover:bg-gray-800 transition-colors cursor-pointer border-none"
          >
            <span className="material-symbols-outlined">dashboard</span>
            Volver al Inicio
          </button>
        </div>
      </main>
    </div>
  );
}

export default BookingConfirmed;