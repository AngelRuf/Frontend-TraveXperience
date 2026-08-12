import React, { useEffect, useState } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock.jsx';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import Layout from '../components/Layout.jsx';
import { createPaymentIntent, getSavedCards } from '../services/paymentService';
import { ApiError } from '../services/apiClient';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

let stripePromise = null;
const getStripePromise = () => {
  if (!STRIPE_PUBLISHABLE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  return stripePromise;
};

function Checkout({ onNavigate, hotel }) {
  const [clientSecret, setClientSecret] = useState('');
  const [intentStatus, setIntentStatus] = useState('loading');
  const [intentError, setIntentError] = useState('');
  
  // Detecta el esquema de colores para decirle a Stripe que use su versión oscura si es necesario
  const isDarkMode = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  useEffect(() => {
    let cancelled = false;

    const fetchIntent = () => {
      setIntentStatus('loading');
      setIntentError('');

      createPaymentIntent({
        amount: hotel && hotel.price ? hotel.price : undefined,
        currency: 'mxn',
        hotelId: hotel && hotel.id,
      })
        .then(({ clientSecret: secret }) => {
          if (cancelled) return;
          if (!secret) {
            setIntentStatus('error');
            setIntentError('No se pudo iniciar el pago. Intenta de nuevo.');
            return;
          }
          setClientSecret(secret);
          setIntentStatus('ready');
        })
        .catch((error) => {
          if (cancelled) return;
          setIntentStatus('error');
          setIntentError(
            error instanceof ApiError ? error.message : 'No se pudo conectar con el servicio de pagos.'
          );
        });
    };

    fetchIntent();
    return () => {
      cancelled = true;
    };
  }, [hotel]);

  if (intentStatus === 'loading') {
    return (
      <Layout>
        <main className="pt-24 pb-20 px-6 md:px-16 max-w-[1280px] mx-auto flex flex-col items-center justify-center min-h-[70vh] gap-5 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <span className="animate-spin material-symbols-outlined text-yellow-500 text-5xl">progress_activity</span>
            <p className="text-base text-on-surface font-bold">Estableciendo conexión segura...</p>
            <p className="text-xs text-on-surface-variant font-medium">Cifrando los datos de tu reserva.</p>
          </div>
        </main>
      </Layout>
    );
  }

  if (intentStatus === 'error' || !clientSecret) {
    return (
      <Layout>
        <main className="pt-24 pb-20 px-6 md:px-16 max-w-[1280px] mx-auto flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-error/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center gap-4 bg-surface border border-dashed border-error/40 rounded-3xl p-10 max-w-md shadow-xl">
            <span className="material-symbols-outlined text-error text-5xl">gpp_bad</span>
            <h3 className="text-lg font-bold text-on-surface">Error de Conexión</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-md">{intentError || 'No se pudo iniciar el proceso de pago. Verifica tu conexión.'}</p>
            <button
              onClick={() => { if (onNavigate) onNavigate('itinerario'); }}
              className="mt-4 bg-surface-container-high text-on-surface border border-outline-variant/50 px-6 py-3 rounded-xl text-sm font-bold hover:bg-surface-container-highest transition-all cursor-pointer shadow-sm"
            >
              Volver al Itinerario
            </button>
          </div>
        </main>
      </Layout>
    );
  }

  if (!STRIPE_PUBLISHABLE_KEY) {
    return (
      <Layout>
        <main className="pt-24 pb-20 px-6 md:px-16 max-w-[1280px] mx-auto flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
          <div className="bg-error/10 border border-dashed border-error/40 rounded-3xl p-10 max-w-md shadow-xl">
            <span className="material-symbols-outlined text-error text-5xl mb-4">key_off</span>
            <p className="text-sm text-error font-bold">
              Falta configurar <span className="font-mono bg-error/20 px-2 py-0.5 rounded">VITE_STRIPE_PUBLISHABLE_KEY</span> en el archivo .env del frontend.
            </p>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Elements
      stripe={getStripePromise()}
      options={{
        clientSecret,
        appearance: { 
          theme: isDarkMode ? 'night' : 'stripe',
          variables: { 
            colorPrimary: '#eab308', // Accent yellow
            colorBackground: 'transparent',
            colorText: isDarkMode ? '#ffffff' : '#1a1a1a',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '12px',
          },
          rules: {
            '.Input': {
              border: '1px solid rgba(150, 150, 150, 0.3)',
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
              boxShadow: 'none',
            },
            '.Input:focus': {
              border: '1px solid #eab308',
              boxShadow: '0 0 0 1px rgba(234, 179, 8, 0.2)',
            }
          }
        },
      }}
    >
      <CheckoutForm onNavigate={onNavigate} hotel={hotel} />
    </Elements>
  );
}

function CheckoutForm({ onNavigate, hotel }) {
  const stripe = useStripe();
  const elements = useElements();

  const [billingSameAsTraveler, setBillingSameAsTraveler] = useState(true);
  const [status, setStatus] = useState('idle');
  const [serverError, setServerError] = useState('');
  const [savedCards, setSavedCards] = useState([]);
  const [savedCardsStatus, setSavedCardsStatus] = useState('loading');

  useModalScrollLock(status === 'success');

  // Matemáticas dinámicas para el resumen del pedido
  const total = hotel?.price || 0;
  const taxes = total * 0.16; // 16% de IVA
  const subtotal = total - taxes;

  useEffect(() => {
    let cancelled = false;
    getSavedCards()
      .then((cards) => {
        if (!cancelled) {
          setSavedCards(cards);
          setSavedCardsStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setSavedCardsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCompleteBooking = async () => {
    if (!stripe || !elements) return;

    setServerError('');
    setStatus('loading');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}#payment-success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setStatus('idle');
      setServerError(error.message || 'No se pudo procesar el pago. Verifica los datos.');
      return;
    }

    setStatus('success');
    setTimeout(() => {
      if (onNavigate) {
        onNavigate('payment-success', {
          paymentResult: {
            status: paymentIntent ? paymentIntent.status : 'succeeded',
            amount: paymentIntent ? paymentIntent.amount : undefined,
            currency: paymentIntent ? paymentIntent.currency : undefined,
            id: paymentIntent ? paymentIntent.id : undefined,
          },
        });
      }
    }, 1500);
  };

  return (
    <Layout>
      <main className="pt-24 pb-20 px-4 md:px-12 max-w-[1400px] mx-auto bg-background text-on-background min-h-screen relative">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/4" />
        
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12 relative z-10">

          {/* --- Columna Izquierda: Formularios de Pago --- */}
          <div className="xl:col-span-7 flex flex-col gap-8">
            <header>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-yellow-500 mb-3 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Pago Seguro
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-on-surface tracking-tight mb-2">Checkout</h1>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                Estás a un paso de confirmar tu experiencia en la Sierra Norte. Completa tu información de pago a continuación.
              </p>
            </header>

            {/* Opciones de Pago Rápido */}
            <div className="bg-surface/80 backdrop-blur-xl border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500 text-[18px]">bolt</span>
                Pago Exprés
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 py-3.5 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all border-none cursor-pointer shadow-md"
                  aria-label="Pagar con Apple Pay"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.365 1.43c0 1.14-.462 2.06-1.155 2.75-.75.75-1.98 1.32-2.985 1.24-.135-1.11.435-2.28 1.11-3 .75-.81 2.04-1.41 3.03-1.44.015.15.015.3.015.45zM20.4 17.19c-.555 1.29-.825 1.86-1.53 3-.99 1.575-2.385 3.54-4.11 3.555-1.53.015-1.92-1.005-3.99-.99-2.07.015-2.505 1.005-4.035.99-1.725-.015-3.045-1.785-4.035-3.36C-.06 17.19-.855 13.2.615 10.5c1.02-1.875 2.85-3.06 4.83-3.075 1.635-.015 2.895 1.11 3.99 1.11 1.08 0 2.7-1.365 4.53-1.17.75.03 2.865.3 4.29 2.31-.105.07-2.565 1.5-2.535 4.47.03 3.57 3.12 4.755 3.15 4.77-.03.09-.5 1.68-1.47 3.275z"/>
                  </svg>
                  <span>Apple Pay</span>
                </button>

                <button
                  type="button"
                  className="flex items-center justify-center gap-2 py-3.5 bg-surface-container border border-solid border-outline-variant/50 rounded-xl font-bold text-on-surface hover:bg-surface-container-high hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                  aria-label="Pagar con Google Pay"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.55c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.77c-.99.66-2.25 1.06-3.73 1.06-2.87 0-5.3-1.94-6.17-4.53H2.18v2.85A11 11 0 0 0 12 23z" fill="#34A853"/>
                    <path d="M5.83 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.18a11 11 0 0 0 0 9.9l3.65-2.85z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.99 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.65 2.85C6.7 7.32 9.13 5.38 12 5.38z" fill="#EA4335"/>
                  </svg>
                  <span>Google Pay</span>
                </button>
              </div>

              <div className="relative flex items-center justify-center my-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/30"></div></div>
                <div className="relative bg-surface px-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">O paga con tarjeta</div>
              </div>

              {/* Tarjetas Guardadas */}
              {savedCardsStatus === 'ready' && savedCards.length > 0 && (
                <div className="mb-8">
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 ml-1">
                    Tus métodos guardados
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedCards.map((card) => (
                      <div
                        key={card.id}
                        className="flex flex-col justify-between p-4 rounded-2xl border border-solid border-outline-variant/40 bg-surface-container-lowest hover:border-yellow-500/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className="material-symbols-outlined text-[24px] text-on-surface-variant group-hover:text-yellow-500 transition-colors">credit_card</span>
                          {card.isDefault && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20">
                              Default
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface capitalize tracking-widest mb-1">
                            •••• {card.last4}
                          </p>
                          <div className="flex justify-between items-end">
                            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
                              {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                            </p>
                            <p className="text-xs font-black text-on-surface-variant uppercase italic opacity-70">{card.brand}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stripe Payment Element */}
              <div className="min-h-[200px]">
                <PaymentElement />
              </div>

              {serverError && (
                <div className="mt-6 bg-error/10 border border-error/20 rounded-xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-error text-[20px]">error</span>
                  <p className="text-sm text-error font-bold">{serverError}</p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-outline-variant/30">
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <input
                    checked={billingSameAsTraveler}
                    onChange={(e) => setBillingSameAsTraveler(e.target.checked)}
                    className="w-5 h-5 rounded border-outline-variant/50 accent-yellow-500 cursor-pointer"
                    type="checkbox"
                  />
                  <div>
                    <span className="text-sm font-bold text-on-surface block">Dirección de facturación</span>
                    <span className="text-xs text-on-surface-variant font-medium">Usar la misma dirección del perfil principal</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 py-2 opacity-60">
              <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Cifrado SSL 256-bit
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                PCI-DSS Compliant
              </div>
            </div>
          </div>

          {/* --- Columna Derecha: Resumen del Pedido (Sticky) --- */}
          <div className="xl:col-span-5">
            <div className="sticky top-28 space-y-6">
              
              <div className="bg-surface/80 backdrop-blur-xl border border-outline-variant/30 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex flex-col">
                
                {/* Imagen de Cabecera */}
                <div className="h-48 md:h-56 w-full relative bg-surface-container-high shrink-0">
                  {/* Si el hotel no tiene imagen, usamos esta espectacular por defecto */}
                  <img 
                    src={hotel?.image || "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=800&q=80"} 
                    alt="Destino" 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <span className="inline-block bg-yellow-500/20 backdrop-blur-md border border-yellow-500/30 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md mb-2">
                      Detalles de la Experiencia
                    </span>
                    <h3 className="text-2xl font-black text-white leading-tight drop-shadow-md">
                      {hotel ? hotel.title : 'Viaje a la Sierra Norte'}
                    </h3>
                  </div>
                </div>

                {/* Desglose de Costos */}
                <div className="p-6 md:p-8 flex flex-col flex-grow">
                  <h4 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-4">Resumen del Pedido</h4>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-on-surface">{hotel ? hotel.title : 'Alojamiento / Paquete'}</p>
                        <p className="text-xs text-on-surface-variant font-medium mt-0.5">Tarifa base x {hotel?.nights || 1} {hotel?.nights === 1 ? 'noche' : 'noches'}</p>
                      </div>
                      <p className="text-sm font-bold text-on-surface">
                        ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-outline-variant/20 w-full mb-4" />

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant font-medium">Impuestos locales (16%)</span>
                      <span className="font-bold text-on-surface">${taxes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant font-medium flex items-center gap-1">
                        Tarifa de plataforma <span className="material-symbols-outlined text-[14px] opacity-50 cursor-help" title="Costo por mantenimiento del sistema">info</span>
                      </span>
                      <span className="font-black text-green-500 uppercase tracking-wider text-xs bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Gratis</span>
                    </div>
                  </div>

                  {/* Total Container */}
                  <div className="bg-surface-container border border-outline-variant/40 p-5 rounded-2xl mb-6">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-lg font-black text-on-surface leading-none">Total</span>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Impuestos incluidos</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-black text-yellow-500 drop-shadow-sm">
                          ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} 
                          <span className="text-sm font-bold text-on-surface ml-1">MXN</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCompleteBooking}
                    disabled={status === 'loading' || !stripe || !elements || total === 0}
                    className="w-full bg-yellow-500 text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:bg-yellow-400 hover:shadow-[0_8px_20px_rgba(234,179,8,0.3)] disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer mt-auto"
                  >
                    {status === 'idle' && (
                      <>
                        <span className="material-symbols-outlined text-[20px]">lock</span>
                        Confirmar Pago
                      </>
                    )}
                    {status === 'loading' && (
                      <>
                        <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
                        Procesando...
                      </>
                    )}
                    {status === 'success' && '¡Aprobado!'}
                  </button>

                  <p className="text-center text-[10px] font-medium text-on-surface-variant/80 mt-5 leading-relaxed">
                    Al confirmar, aceptas nuestros <a className="underline hover:text-yellow-500 transition-colors cursor-pointer" href="#">Términos de Servicio</a> y la <a className="underline hover:text-yellow-500 transition-colors cursor-pointer" href="#">Política de Privacidad</a>.
                  </p>
                </div>
              </div>

              {/* Módulo de Ayuda */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 text-on-surface p-6 rounded-3xl relative overflow-hidden shadow-sm group hover:border-outline-variant/60 transition-colors">
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <span className="material-symbols-outlined text-[24px]">support_agent</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-base mb-1">¿Necesitas Asistencia?</h5>
                    <p className="text-xs font-medium text-on-surface-variant leading-relaxed mb-3">
                      Nuestro servicio de Concierge está disponible 24/7 para asistirte con tu reserva o dudas sobre el pago.
                    </p>
                    <button className="text-xs font-bold text-blue-500 hover:text-blue-400 bg-transparent border-none p-0 cursor-pointer flex items-center gap-1 transition-colors">
                      Contactar Soporte
                      <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Modal de Éxito Inmersivo */}
      {status === 'success' && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center px-4 animate-fade-in">
          <div className="bg-surface border border-outline-variant/30 p-10 md:p-14 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] text-center max-w-md mx-auto transform transition-transform duration-500 scale-100 animate-scale-in relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner border border-green-500/30">
              <span className="material-symbols-outlined text-[48px]">check_circle</span>
            </div>
            <h2 className="text-3xl font-black text-on-surface mb-3 relative z-10 tracking-tight">¡Pago Exitoso!</h2>
            <p className="text-on-surface-variant font-medium text-sm leading-relaxed mb-8 relative z-10">
              Tu reserva está confirmada y asegurada. Preparando tu itinerario personalizado...
            </p>
            <div className="flex justify-center relative z-10">
              <span className="animate-spin material-symbols-outlined text-yellow-500 text-2xl">sync</span>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Checkout;