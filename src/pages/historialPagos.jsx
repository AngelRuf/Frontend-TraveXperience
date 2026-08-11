import React, { useEffect, useState } from 'react';
import Header from '../components/header';
import Footer from '../components/footer';
import { getSavedCards, getPaymentHistory, downloadReceipt } from '../services/paymentService';
import { ApiError } from '../services/apiClient';

// --- Helpers de formato y validación ---
const onlyDigits = (value) => value.replace(/\D/g, '');

function formatCardNumber(value) {
  const digits = onlyDigits(value).slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiry(value) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function luhnCheck(numberStr) {
  const digits = onlyDigits(numberStr);
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return digits.length > 0 && sum % 10 === 0;
}

function detectBrand(digits) {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  return 'Tarjeta';
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60}$/;

function validateCardField(field, value) {
  switch (field) {
    case 'cardholderName': {
      const trimmed = value.trim();
      if (!trimmed) return 'El nombre del titular es obligatorio.';
      if (!NAME_REGEX.test(trimmed)) return 'Ingresa el nombre tal como aparece en la tarjeta.';
      return '';
    }
    case 'cardNumber': {
      const digits = onlyDigits(value);
      if (!digits) return 'El número de tarjeta es obligatorio.';
      if (digits.length < 13 || digits.length > 19) return 'El número de tarjeta no es válido.';
      if (!luhnCheck(digits)) return 'El número de tarjeta ingresado no es válido.';
      return '';
    }
    case 'expiry': {
      if (!value) return 'La fecha de expiración es obligatoria.';
      const match = /^(\d{2})\/(\d{2})$/.exec(value);
      if (!match) return 'Usa el formato MM/AA.';
      const month = parseInt(match[1], 10);
      const year = parseInt(`20${match[2]}`, 10);
      if (month < 1 || month > 12) return 'El mes ingresado no es válido.';
      const now = new Date();
      if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        return 'Esta tarjeta ya expiró.';
      }
      return '';
    }
    case 'cvc': {
      const digits = onlyDigits(value);
      if (!digits) return 'El CVC es obligatorio.';
      if (digits.length < 3 || digits.length > 4) return 'El CVC debe tener 3 o 4 dígitos.';
      return '';
    }
    default:
      return '';
  }
}

const EMPTY_CARD_FORM = { cardholderName: '', cardNumber: '', expiry: '', cvc: '' };

// --- Modal Genérico Premium ---
function Modal({ title, icon, iconColor = 'text-yellow-500', iconBg = 'bg-yellow-500/10', onClose, children }) {
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!window.__openModalCount) window.__openModalCount = 0;
    window.__openModalCount += 1;
    const prevOverflow = document.body.style.overflow;
    // lock body scroll and ensure modal is visible at top
    document.body.style.overflow = 'hidden';
    window.scrollTo({ top: 0, behavior: 'auto' });
    return () => {
      window.__openModalCount = Math.max(0, (window.__openModalCount || 1) - 1);
      if (!window.__openModalCount) {
        document.body.style.overflow = prevOverflow || '';
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl w-full max-w-md p-6 md:p-8 relative shadow-2xl animate-scale-in mt-12 md:mt-20 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer border-none"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div className="flex items-center gap-3 mb-6 border-b border-solid border-outline-variant/30 pb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${iconBg} ${iconColor}`}>
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function PaymentsBilling({ onNavigate, isSettingsTab = false }) {
  const [searchTerm, setSearchTerm] = useState('');

  const [cards, setCards] = useState([]);
  const [cardsStatus, setCardsStatus] = useState('loading'); 
  const [cardsError, setCardsError] = useState('');

  const [cardPendingDelete, setCardPendingDelete] = useState(null); 

  const [showAddCard, setShowAddCard] = useState(false);
  const [cardForm, setCardForm] = useState(EMPTY_CARD_FORM);
  const [cardFormErrors, setCardFormErrors] = useState(EMPTY_CARD_FORM);
  const [cardFormTouched, setCardFormTouched] = useState({
    cardholderName: false, cardNumber: false, expiry: false, cvc: false,
  });

  const openAddCardModal = () => {
    setCardForm(EMPTY_CARD_FORM);
    setCardFormErrors(EMPTY_CARD_FORM);
    setCardFormTouched({ cardholderName: false, cardNumber: false, expiry: false, cvc: false });
    setShowAddCard(true);
  };

  const handleCardFormChange = (field) => (e) => {
    let value = e.target.value;
    if (field === 'cardNumber') value = formatCardNumber(value);
    if (field === 'expiry') value = formatExpiry(value);
    if (field === 'cvc') value = onlyDigits(value).slice(0, 4);

    setCardForm((prev) => ({ ...prev, [field]: value }));
    if (cardFormTouched[field]) {
      setCardFormErrors((prev) => ({ ...prev, [field]: validateCardField(field, value) }));
    }
  };

  const handleCardFormBlur = (field) => () => {
    setCardFormTouched((prev) => ({ ...prev, [field]: true }));
    setCardFormErrors((prev) => ({ ...prev, [field]: validateCardField(field, cardForm[field]) }));
  };

  const handleAddCardSubmit = (e) => {
    e.preventDefault();
    const newErrors = {
      cardholderName: validateCardField('cardholderName', cardForm.cardholderName),
      cardNumber: validateCardField('cardNumber', cardForm.cardNumber),
      expiry: validateCardField('expiry', cardForm.expiry),
      cvc: validateCardField('cvc', cardForm.cvc),
    };
    setCardFormErrors(newErrors);
    setCardFormTouched({ cardholderName: true, cardNumber: true, expiry: true, cvc: true });
    if (!Object.values(newErrors).every((err) => !err)) return;

    const digits = onlyDigits(cardForm.cardNumber);
    const newCard = {
      id: `card-${Date.now()}`,
      brand: detectBrand(digits),
      last4: digits.slice(-4),
      holder: cardForm.cardholderName.trim().toUpperCase(),
      expiry: cardForm.expiry,
      isDefault: cards.length === 0,
      variant: cards.length % 2 === 0 ? 'primary' : 'secondary',
    };
    setCards((prev) => [...prev, newCard]);
    setShowAddCard(false);
  };

  const confirmDeleteCard = () => {
    if (!cardPendingDelete) return;
    setCards((prev) => prev.filter((c) => c.id !== cardPendingDelete.id));
    setCardPendingDelete(null);
  };

  const [transactions, setTransactions] = useState([]);
  const [txStatus, setTxStatus] = useState('loading'); 
  const [txError, setTxError] = useState('');

  const TX_STATUS_STYLES = {
    completado: { label: 'Completado', className: 'bg-green-500/10 text-green-500 border-green-500/20', dot: 'bg-green-500' },
    exitoso: { label: 'Completado', className: 'bg-green-500/10 text-green-500 border-green-500/20', dot: 'bg-green-500' },
    pagado: { label: 'Completado', className: 'bg-green-500/10 text-green-500 border-green-500/20', dot: 'bg-green-500' },
    succeeded: { label: 'Completado', className: 'bg-green-500/10 text-green-500 border-green-500/20', dot: 'bg-green-500' },
    paid: { label: 'Completado', className: 'bg-green-500/10 text-green-500 border-green-500/20', dot: 'bg-green-500' },
    procesando: { label: 'Procesando', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', dot: 'bg-yellow-500 animate-pulse' },
    pendiente: { label: 'Procesando', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', dot: 'bg-yellow-500 animate-pulse' },
    pending: { label: 'Procesando', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', dot: 'bg-yellow-500 animate-pulse' },
    processing: { label: 'Procesando', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', dot: 'bg-yellow-500 animate-pulse' },
    reembolsado: { label: 'Reembolsado', className: 'bg-error/10 text-error border-error/20', dot: 'bg-error' },
    refunded: { label: 'Reembolsado', className: 'bg-error/10 text-error border-error/20', dot: 'bg-error' },
    fallido: { label: 'Fallido', className: 'bg-error/10 text-error border-error/20', dot: 'bg-error' },
    failed: { label: 'Fallido', className: 'bg-error/10 text-error border-error/20', dot: 'bg-error' },
    cancelado: { label: 'Fallido', className: 'bg-error/10 text-error border-error/20', dot: 'bg-error' },
    desconocido: { label: 'Desconocido', className: 'bg-surface-container text-on-surface-variant border-outline-variant/30', dot: 'bg-outline-variant' },
  };

  function fmtAmount(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') {
      return `$${raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    const str = String(raw).trim();
    if (str.startsWith('$')) return str;
    const num = Number(str.replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(num)) return str;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  function mapCard(raw, index) {
    return {
      id: raw.id ?? `card-${index}`,
      brand: raw.brand ?? raw.marca ?? 'Tarjeta',
      last4: raw.last4 ?? raw.ultimos4 ?? '0000',
      holder: (raw.holder ?? raw.titular ?? '').toUpperCase(),
      expiry: raw.expiry ?? raw.expiracion ?? '--/--',
      isDefault: !!(raw.isDefault ?? raw.predeterminada),
      variant: index % 2 === 0 ? 'primary' : 'secondary',
    };
  }

  function mapTransaction(raw, index) {
    const rawStatus = raw.status ?? raw.estado ?? raw.state ?? raw.paymentStatus ?? raw.pagoEstado;
    const statusKey = rawStatus ? String(rawStatus).toLowerCase() : 'desconocido';
    const statusStyle = TX_STATUS_STYLES[statusKey] || (rawStatus ? { label: String(rawStatus), className: 'bg-surface-container text-on-surface-variant border-outline-variant/30', dot: 'bg-outline-variant' } : TX_STATUS_STYLES.desconocido);
    const amount = fmtAmount(raw.amount ?? raw.monto ?? raw.total ?? raw.price ?? raw.importe);
    return {
      id: raw.id ?? index,
      date: raw.date ?? raw.fecha ?? raw.createdAt ?? raw.fechaCreacion ?? raw.timestamp ?? '',
      description: raw.description ?? raw.descripcion ?? raw.concept ?? raw.concepto ?? raw.title ?? 'Transacción',
      category: raw.categoryIcon ?? raw.icono ?? 'receipt_long',
      categoryBg: raw.categoryBg ?? 'bg-surface-container-high text-on-surface',
      method: raw.method ?? raw.metodo ?? '',
      amount: amount ?? '—',
      status: statusStyle.label,
      statusClass: statusStyle.className,
      statusDot: statusStyle.dot,
      lineThrough: statusKey === 'reembolsado' || statusKey === 'refunded' || statusKey === 'fallido' || statusKey === 'cancelado',
    };
  }

  useEffect(() => {
    let cancelled = false;

    setCardsStatus('loading');
    getSavedCards()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.cards || [];
        setCards(list.map(mapCard));
        setCardsStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setCardsStatus('error');
        setCardsError(error instanceof ApiError ? error.message : 'No se pudieron cargar tus tarjetas guardadas.');
      });

    setTxStatus('loading');
    getPaymentHistory()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.transactions || [];
        setTransactions(list.map(mapTransaction));
        setTxStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setTxStatus('error');
        setTxError(error instanceof ApiError ? error.message : 'No se pudo cargar tu historial de pagos.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [txPendingDelete, setTxPendingDelete] = useState(null); 

  React.useEffect(() => {
    if (showAddCard || cardPendingDelete || txPendingDelete) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showAddCard, cardPendingDelete, txPendingDelete]);

  const confirmDeleteTransaction = () => {
    if (!txPendingDelete) return;
    setTransactions((prev) => prev.filter((t) => t.id !== txPendingDelete.id));
    setTxPendingDelete(null);
  };

  const [downloadingTxId, setDownloadingTxId] = useState(null);
  const [downloadErrorId, setDownloadErrorId] = useState(null);

  const handleDownloadReceipt = async (transaction) => {
    setDownloadingTxId(transaction.id);
    setDownloadErrorId(null);
    try {
      await downloadReceipt(transaction.id);
    } catch {
      setDownloadErrorId(transaction.id);
      setTimeout(() => setDownloadErrorId(null), 3000);
    } finally {
      setDownloadingTxId(null);
    }
  };

  const filteredTransactions = transactions.filter((t) =>
    t.description.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const cardFormInputClasses = (field) =>
    `w-full px-4 py-3 bg-surface border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      cardFormErrors[field] && cardFormTouched[field]
        ? 'border-error focus:border-error'
        : 'border-outline-variant/60 focus:border-yellow-500'
    }`;

  const content = (
    <div className={`w-full max-w-[1280px] mx-auto flex-grow ${isSettingsTab ? 'px-6 md:px-12 py-6' : 'px-6 md:px-12 py-10'}`}>
      
      {/* Header Section */}
      {!isSettingsTab && (
        <header className="mb-10 relative overflow-hidden bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-yellow-500/10 blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/4" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-yellow-500 mb-2">
                <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                Finanzas
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight mb-2">Pagos y Facturación</h1>
              <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed font-medium">
                Administra tus métodos de pago guardados y haz el seguimiento detallado de tus transacciones y recibos.
              </p>
            </div>
            <button 
              type="button"
              onClick={openAddCardModal}
              className="bg-yellow-500 text-black px-6 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all active:scale-[0.98] border-none cursor-pointer shadow-md shadow-yellow-500/20 shrink-0 w-full md:w-auto"
            >
              <span className="material-symbols-outlined text-[20px]">add_card</span>
              Agregar Tarjeta
            </button>
          </div>
        </header>
      )}

      {isSettingsTab && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 border-b border-solid border-outline-variant/30 pb-4 gap-4">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-500">payments</span>
            Métodos de Pago
          </h2>
          <button 
            type="button"
            onClick={openAddCardModal}
            className="bg-surface-container border border-solid border-outline-variant/50 text-on-surface px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-surface-container-high transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Nueva Tarjeta
          </button>
        </div>
      )}

      {/* Saved Cards Section */}
      <section className="mb-10">
        {cardsStatus === 'error' && (
          <p className="text-sm text-error font-bold flex items-center gap-1.5 bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-6">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {cardsError}
          </p>
        )}

        {cardsStatus === 'loading' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-48 rounded-3xl bg-surface-container-low border border-outline-variant/20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) =>
              card.variant === 'primary' ? (
                <div
                  key={card.id}
                  className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-tr from-surface-container-highest to-surface text-on-surface flex flex-col justify-between h-48 border border-outline-variant/30 group transition-all duration-300 hover:-translate-y-1 shadow-md hover:shadow-lg"
                >
                  {/* Decoraciones de la tarjeta */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex flex-col gap-1">
                      {card.isDefault && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 w-fit">
                          Predeterminada
                        </span>
                      )}
                      <span className="text-base font-black tracking-wide">{card.brand}</span>
                    </div>
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant/50">contactless</span>
                  </div>
                  
                  <div className="relative z-10">
                    <p className="font-mono text-lg tracking-[0.15em] mb-4">•••• •••• •••• {card.last4}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-0.5">Titular</p>
                        <p className="text-xs font-bold truncate max-w-[120px]">{card.holder}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-0.5">Expira</p>
                        <p className="text-xs font-bold">{card.expiry}</p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-20 border border-outline-variant/50 rounded-3xl">
                    <button type="button" className="w-12 h-12 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-colors shadow border-none cursor-pointer" title="Editar tarjeta">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardPendingDelete(card)}
                      className="w-12 h-12 rounded-full bg-surface-container-highest text-error flex items-center justify-center hover:bg-error hover:text-white transition-colors shadow border-none cursor-pointer"
                      title="Eliminar tarjeta"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={card.id}
                  className="relative overflow-hidden p-6 rounded-3xl bg-surface-container-lowest border border-solid border-outline-variant/40 flex flex-col justify-between h-48 group transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex flex-col gap-1">
                      {card.isDefault && (
                        <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest w-fit border border-outline-variant/30">
                          Predeterminada
                        </span>
                      )}
                      <span className="text-base font-black tracking-wide text-on-surface-variant/80">{card.brand}</span>
                    </div>
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant/30">credit_card</span>
                  </div>
                  
                  <div className="relative z-10">
                    <p className="font-mono text-lg tracking-[0.15em] text-on-surface-variant mb-4">•••• •••• •••• {card.last4}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] text-on-surface-variant/70 uppercase tracking-wider mb-0.5">Titular</p>
                        <p className="text-xs font-bold text-on-surface-variant truncate max-w-[120px]">{card.holder}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-on-surface-variant/70 uppercase tracking-wider mb-0.5">Expira</p>
                        <p className="text-xs font-bold text-on-surface-variant">{card.expiry}</p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-20 border border-outline-variant/50 rounded-3xl">
                    <button type="button" className="w-12 h-12 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-colors shadow border-none cursor-pointer" title="Editar tarjeta">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardPendingDelete(card)}
                      className="w-12 h-12 rounded-full bg-surface-container-highest text-error flex items-center justify-center hover:bg-error hover:text-white transition-colors shadow border-none cursor-pointer"
                      title="Eliminar tarjeta"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Add New Placeholder */}
            <button 
              type="button"
              onClick={openAddCardModal}
              className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center h-48 hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all group bg-transparent cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-3 group-hover:bg-yellow-500 group-hover:text-black transition-colors text-on-surface-variant shadow-inner">
                <span className="material-symbols-outlined text-[24px]">add</span>
              </div>
              <span className="text-xs font-bold text-on-surface-variant group-hover:text-yellow-500 transition-colors tracking-wider uppercase">Vincular Tarjeta</span>
            </button>
          </div>
        )}
      </section>

      {/* Transactions Section */}
      <section className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-outline-variant/20 pb-6">
          <div>
            <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-500">receipt_long</span>
              Historial de Transacciones
            </h3>
            <p className="text-[11px] font-medium text-on-surface-variant mt-1">Sigue el rastro de tus pagos y recibos.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[20px] pointer-events-none">search</span>
              <input 
                className="w-full bg-surface-container-lowest py-3 pl-11 pr-4 rounded-xl border border-solid border-outline-variant/60 focus:outline-none focus:border-yellow-500 text-sm font-medium text-on-surface transition-colors placeholder:text-on-surface-variant/50 shadow-sm" 
                placeholder="Buscar movimiento..." 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button type="button" className="w-12 h-12 flex items-center justify-center bg-surface-container-lowest rounded-xl text-on-surface hover:bg-surface-container transition-colors border border-solid border-outline-variant/60 cursor-pointer shadow-sm">
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
            </button>
          </div>
        </div>

        {txStatus === 'error' && (
          <p className="text-sm text-error font-bold flex items-center gap-1.5 bg-error/10 rounded-xl px-4 py-3 mb-4">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {txError}
          </p>
        )}

        {txStatus === 'loading' ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse h-16 rounded-xl bg-surface-container-low border border-outline-variant/20" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest">
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider rounded-l-xl">Fecha</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Concepto</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Método</th>
                  <th className="text-right py-4 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Monto</th>
                  <th className="text-center py-4 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Estado</th>
                  <th className="text-right py-4 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider rounded-r-xl">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-solid divide-outline-variant/20">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                    <td className="py-4 px-4 font-mono text-[13px] text-on-surface font-medium whitespace-nowrap">{transaction.date}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-outline-variant/30 shadow-sm shrink-0 ${transaction.categoryBg}`}>
                          <span className="material-symbols-outlined text-[20px]">{transaction.category}</span>
                        </div>
                        <span className={`text-sm font-bold text-on-surface truncate max-w-[200px] md:max-w-xs ${transaction.lineThrough ? 'line-through text-on-surface-variant/60' : ''}`}>
                          {transaction.description}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 bg-surface-container-high w-fit px-2.5 py-1 rounded-md border border-outline-variant/30">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">credit_card</span>
                        <span className="text-xs text-on-surface font-bold">{transaction.method}</span>
                      </div>
                    </td>
                    <td className={`py-4 px-4 text-right font-mono font-black text-sm whitespace-nowrap ${transaction.lineThrough ? 'text-error' : 'text-on-surface'}`}>
                      {transaction.amount}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-solid text-[10px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap ${transaction.statusClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${transaction.statusDot || 'bg-green-500'}`}></span>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          type="button"
                          onClick={() => handleDownloadReceipt(transaction)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-transparent border-none cursor-pointer ${
                            transaction.status === 'Procesando' 
                              ? 'text-outline-variant cursor-not-allowed' 
                              : downloadErrorId === transaction.id 
                                ? 'bg-error/10 text-error' 
                                : 'hover:bg-surface-container-high text-on-surface-variant hover:text-primary'
                          }`}
                          disabled={transaction.status === 'Procesando' || downloadingTxId === transaction.id}
                          title={downloadErrorId === transaction.id ? 'No se pudo descargar. Intenta de nuevo.' : 'Descargar Factura/PDF'}
                        >
                          <span className={`material-symbols-outlined text-[18px] ${downloadingTxId === transaction.id ? 'animate-spin text-yellow-500' : ''}`}>
                            {downloadingTxId === transaction.id
                              ? 'progress_activity'
                              : downloadErrorId === transaction.id
                              ? 'error'
                              : transaction.status === 'Reembolsado'
                              ? 'receipt_long'
                              : 'download'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxPendingDelete(transaction)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors bg-transparent border-none cursor-pointer"
                          title="Eliminar historial"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-10">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-container-high mb-3">
                        <span className="material-symbols-outlined text-on-surface-variant text-[24px]">search_off</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface">Sin resultados</p>
                      <p className="text-xs text-on-surface-variant mt-1">No hay transacciones que coincidan con tu búsqueda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center border-0 border-t border-solid border-outline-variant/20 pt-6 gap-4 bg-surface-container-lowest/50 px-4 pb-2 rounded-b-2xl">
          <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">
            Mostrando {filteredTransactions.length > 0 ? 1 : 0} - {filteredTransactions.length} de {filteredTransactions.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button type="button" className="w-8 h-8 rounded-lg border border-solid border-outline-variant/40 flex items-center justify-center hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed bg-transparent transition-colors" disabled>
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button type="button" className="w-8 h-8 rounded-lg bg-surface-container-highest text-on-surface flex items-center justify-center text-xs font-bold border border-solid border-outline-variant/50 cursor-pointer shadow-sm">1</button>
            <button type="button" className="w-8 h-8 rounded-lg border border-solid border-outline-variant/40 flex items-center justify-center hover:bg-surface text-xs font-bold text-on-surface-variant bg-transparent cursor-pointer transition-colors">2</button>
            <button type="button" className="w-8 h-8 rounded-lg border border-solid border-outline-variant/40 flex items-center justify-center hover:bg-surface bg-transparent cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </section>

      {/* Floating Widget */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-surface/90 backdrop-blur-xl border border-solid border-outline-variant/40 px-5 py-3 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-30 animate-fade-in-up">
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </div>
        <span className="text-[10px] font-black text-on-surface uppercase tracking-widest">
          Conexión Segura <span className="text-green-500 ml-1">Activa</span>
        </span>
      </div>

      {/* --- Modales --- */}

      {showAddCard && (
        <Modal title="Vincular Tarjeta" icon="add_card" onClose={() => setShowAddCard(false)}>
          <form onSubmit={handleAddCardSubmit} className="space-y-5" noValidate>
            
            {/* Visual Preview */}
            <div className="w-full h-36 rounded-2xl bg-gradient-to-tr from-surface-container-highest to-surface border border-solid border-outline-variant/50 p-5 flex flex-col justify-between shadow-inner mb-2">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-on-surface-variant/50 text-[24px]">contactless</span>
                <span className="text-sm font-black text-on-surface-variant italic opacity-50">{detectBrand(onlyDigits(cardForm.cardNumber))}</span>
              </div>
              <div>
                <p className="text-lg font-mono tracking-widest text-on-surface mb-2">
                  {cardForm.cardNumber || '•••• •••• •••• ••••'}
                </p>
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-bold text-on-surface-variant truncate max-w-[200px] uppercase tracking-wider">
                    {cardForm.cardholderName || 'TITULAR DE LA TARJETA'}
                  </p>
                  <p className="text-[10px] font-bold text-on-surface-variant tracking-wider">{cardForm.expiry || 'MM/AA'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="new-cardholderName">
                Titular de la Tarjeta
              </label>
              <input
                id="new-cardholderName"
                type="text"
                placeholder="Como aparece en el plástico"
                value={cardForm.cardholderName}
                onChange={handleCardFormChange('cardholderName')}
                onBlur={handleCardFormBlur('cardholderName')}
                className={cardFormInputClasses('cardholderName')}
              />
              {cardFormErrors.cardholderName && cardFormTouched.cardholderName && (
                <p className="text-[10px] font-bold text-error mt-0.5 ml-1">{cardFormErrors.cardholderName}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="new-cardNumber">
                Número de Tarjeta
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-on-surface-variant/50 pointer-events-none">credit_card</span>
                <input
                  id="new-cardNumber"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={cardForm.cardNumber}
                  onChange={handleCardFormChange('cardNumber')}
                  onBlur={handleCardFormBlur('cardNumber')}
                  className={`${cardFormInputClasses('cardNumber')} pl-11`}
                />
              </div>
              {cardFormErrors.cardNumber && cardFormTouched.cardNumber && (
                <p className="text-[10px] font-bold text-error mt-0.5 ml-1">{cardFormErrors.cardNumber}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="new-expiry">
                  Expiración
                </label>
                <input
                  id="new-expiry"
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/YY"
                  value={cardForm.expiry}
                  onChange={handleCardFormChange('expiry')}
                  onBlur={handleCardFormBlur('expiry')}
                  className={cardFormInputClasses('expiry')}
                />
                {cardFormErrors.expiry && cardFormTouched.expiry && (
                  <p className="text-[10px] font-bold text-error mt-0.5 ml-1">{cardFormErrors.expiry}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="new-cvc">
                  CVC
                </label>
                <input
                  id="new-cvc"
                  type="text"
                  inputMode="numeric"
                  placeholder="•••"
                  value={cardForm.cvc}
                  onChange={handleCardFormChange('cvc')}
                  onBlur={handleCardFormBlur('cvc')}
                  className={cardFormInputClasses('cvc')}
                />
                {cardFormErrors.cvc && cardFormTouched.cvc && (
                  <p className="text-[10px] font-bold text-error mt-0.5 ml-1">{cardFormErrors.cvc}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-solid border-outline-variant/30 mt-2">
              <button
                type="button"
                onClick={() => setShowAddCard(false)}
                className="flex-1 py-3.5 border border-solid border-outline-variant rounded-xl text-on-surface text-sm font-bold bg-transparent hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all cursor-pointer border-none shadow-md shadow-yellow-500/20"
              >
                Guardar Tarjeta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {cardPendingDelete && (
        <Modal title="Eliminar Tarjeta" icon="credit_card_off" iconColor="text-error" iconBg="bg-error/10" onClose={() => setCardPendingDelete(null)}>
          <div className="text-center">
            <p className="text-sm text-on-surface-variant leading-relaxed mb-8">
              ¿Estás seguro de que quieres eliminar tu tarjeta <span className="font-bold text-on-surface">{cardPendingDelete.brand}</span> terminación <span className="font-bold text-on-surface">{cardPendingDelete.last4}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCardPendingDelete(null)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Mantener
              </button>
              <button
                type="button"
                onClick={confirmDeleteCard}
                className="flex-1 bg-error text-white py-3.5 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-[0.98] transition-all cursor-pointer border-none shadow-md shadow-error/20"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {txPendingDelete && (
        <Modal title="Eliminar Registro" icon="receipt_long" iconColor="text-error" iconBg="bg-error/10" onClose={() => setTxPendingDelete(null)}>
          <div className="text-center">
            <p className="text-sm text-on-surface-variant leading-relaxed mb-2">
              Se eliminará <span className="font-bold text-on-surface">{txPendingDelete.description}</span> de tu historial visual.
            </p>
            <p className="text-[11px] text-error font-medium mb-8 bg-error/10 p-2 rounded-lg">
              Nota: Esto no cancela el cobro ni afecta los registros fiscales.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTxPendingDelete(null)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteTransaction}
                className="flex-1 bg-error text-white py-3.5 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-[0.98] transition-all cursor-pointer border-none shadow-md shadow-error/20"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  if (isSettingsTab) {
    return content;
  }

  return (
    <div className="bg-background text-on-background font-sans min-h-screen flex flex-col relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none bg-background" />
      <Header onNavigate={onNavigate} />
      
      <div className="pt-16 md:pt-20 flex-grow flex flex-col relative z-10 w-full">
        {content}
      </div>

      <Footer />
    </div>
  );
}

export default PaymentsBilling;