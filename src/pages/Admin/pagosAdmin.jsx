import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useModalScrollLock from '../../hooks/useModalScrollLock.jsx';
import AdminLayout from '../../components/adminLayout.jsx';
import { AdminErrorBanner } from '../../components/adminAsyncState.jsx';
import {
  getFinances,
  getTransactions,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  transferFunds,
  classifyAdminError,
} from '../../services/adminService';

const STATUS_OPTIONS = ['todos', 'Completado', 'Pendiente', 'Reembolsado'];

const STATUS_STYLES = {
  Completado: 'bg-green-500/10 text-green-500 border border-green-500/20',
  Pendiente: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
  Reembolsado: 'bg-error/10 text-error border border-error/20',
};

// ---------- Utilidades de tarjeta ----------
function onlyDigits(value) {
  return (value || '').replace(/\D/g, '');
}

function formatCardNumber(value) {
  return onlyDigits(value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function detectCardBrand(digits) {
  if (/^4/.test(digits)) return 'VISA';
  if (/^5[1-5]/.test(digits) || /^2(2[2-9][1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  return 'TARJETA';
}

function luhnCheck(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ---------- Validaciones ----------
const IBAN_LIKE_REGEX = /^[A-Za-z0-9\s-]{8,34}$/;

function validateTransferField(field, value, availableBalance) {
  switch (field) {
    case 'destino': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'La cuenta destino es obligatoria.';
      if (!IBAN_LIKE_REGEX.test(trimmed)) return 'Ingresa un número de cuenta / IBAN válido.';
      return '';
    }
    case 'monto': {
      if (value === '' || value === null) return 'El monto es obligatorio.';
      const num = Number(value);
      if (Number.isNaN(num) || num <= 0) return 'Ingresa un monto válido mayor a 0.';
      if (availableBalance != null && num > availableBalance) {
        return `El monto excede el saldo disponible ($${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}).`;
      }
      return '';
    }
    case 'concepto': {
      const trimmed = (value || '').trim();
      if (trimmed && trimmed.length < 3) return 'El concepto debe tener al menos 3 caracteres.';
      return '';
    }
    default:
      return '';
  }
}

function validateCardField(field, value) {
  switch (field) {
    case 'numero': {
      const digits = onlyDigits(value);
      if (!digits) return 'El número de tarjeta es obligatorio.';
      if (!/^\d{13,19}$/.test(digits)) return 'Ingresa un número de tarjeta válido.';
      if (!luhnCheck(digits)) return 'El número de tarjeta no es válido.';
      return '';
    }
    case 'vencimiento': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'La fecha de vencimiento es obligatoria.';
      const match = trimmed.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
      if (!match) return 'Usa el formato MM/AA.';
      const month = parseInt(match[1], 10);
      const year = 2000 + parseInt(match[2], 10);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      if (year < currentYear || (year === currentYear && month < currentMonth)) return 'La tarjeta está vencida.';
      if (year > currentYear + 20) return 'Verifica el año de vencimiento.';
      return '';
    }
    case 'titular': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El nombre del titular es obligatorio.';
      if (trimmed.length < 3) return 'Ingresa el nombre completo del titular.';
      if (!/^[A-Za-zÀ-ÿ\s'.-]+$/.test(trimmed)) return 'El nombre solo puede contener letras y espacios.';
      return '';
    }
    default:
      return '';
  }
}

// ---------- Modal Genérico Mejorado ----------
function Modal({ title, icon, onClose, children }) {
  useModalScrollLock(true);

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
          <div className="w-12 h-12 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function fmtCurrency(n) {
  if (n === null || n === undefined || n === '') return '—';
  if (typeof n === 'object') return '—'; 
  const num = typeof n === 'string' ? Number(n.replace(/[^0-9.-]/g, '')) : n;
  if (Number.isNaN(num)) return '—';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

const PAGE_SIZE = 10;

function AdminPagos({ onNavigate }) {
  const [activeModal, setActiveModal] = useState(null); 

  // --- Finanzas ---
  const [finances, setFinances] = useState(null);
  const [financesLoading, setFinancesLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);

  // --- Transacciones ---
  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // --- Métodos de pago ---
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  // Debounce para búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
      setTxPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const loadFinances = useCallback(async () => {
    setFinancesLoading(true);
    try {
      const data = await getFinances();
      setFinances(data);
    } catch (err) {
      setErrorInfo(classifyAdminError(err));
    } finally {
      setFinancesLoading(false);
    }
  }, []);

  const loadCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const data = await getPaymentMethods();
      setCards(Array.isArray(data) ? data : []);
    } catch (err) {
      setCards([]);
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (page = 1) => {
    setTxLoading(true);
    setTxError('');
    try {
      const { transactions: list, total } = await getTransactions({
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
        status: statusFilter,
        category: categoryFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setTransactions(list);
      setTxTotal(total);
      setTxPage(page);
    } catch (err) {
      const info = classifyAdminError(err);
      setTxError(info.message);
      if (info.type === 'unauthorized') setErrorInfo(info);
    } finally {
      setTxLoading(false);
    }
  }, [search, statusFilter, categoryFilter, dateFrom, dateTo]);

  useEffect(() => { loadFinances(); loadCards(); }, [loadFinances, loadCards]);
  useEffect(() => { loadTransactions(1); }, [search, statusFilter, categoryFilter, dateFrom, dateTo, loadTransactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category).filter(Boolean));
    return ['todas', ...set];
  }, [transactions]);

  const totalPages = Math.max(1, Math.ceil(txTotal / PAGE_SIZE));

  // --- Transferir Fondos ---
  const [transferValues, setTransferValues] = useState({ destino: '', monto: '', concepto: '' });
  const [transferErrors, setTransferErrors] = useState({ destino: '', monto: '', concepto: '' });
  const [transferTouched, setTransferTouched] = useState({ destino: false, monto: false, concepto: false });
  const [transferStatus, setTransferStatus] = useState('idle'); 
  const [transferServerError, setTransferServerError] = useState('');

  const availableBalance = finances?.budget != null ? finances.budget : null;

  const handleTransferChange = (field) => (e) => {
    const value = e.target.value;
    setTransferValues((prev) => ({ ...prev, [field]: value }));
    if (transferTouched[field]) {
      setTransferErrors((prev) => ({ ...prev, [field]: validateTransferField(field, value, availableBalance) }));
    }
  };

  const handleTransferBlur = (field) => () => {
    setTransferTouched((prev) => ({ ...prev, [field]: true }));
    setTransferErrors((prev) => ({ ...prev, [field]: validateTransferField(field, transferValues[field], availableBalance) }));
  };

  const transferInputClasses = (field) =>
    `w-full px-4 py-3 bg-surface border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      transferErrors[field] && transferTouched[field] ? 'border-error focus:border-error' : 'border-outline-variant/60 focus:border-yellow-500'
    }`;

  const submitTransfer = async () => {
    if (transferStatus === 'sending') return;

    const fields = ['destino', 'monto', 'concepto'];
    const newErrors = {};
    fields.forEach((f) => { newErrors[f] = validateTransferField(f, transferValues[f], availableBalance); });
    setTransferErrors(newErrors);
    setTransferTouched({ destino: true, monto: true, concepto: true });

    if (Object.values(newErrors).some((e) => e !== '')) return;

    const payload = {
      destino: transferValues.destino.trim(),
      monto: Number(transferValues.monto),
      concepto: transferValues.concepto.trim(),
    };

    setTransferStatus('sending');
    setTransferServerError('');
    try {
      await transferFunds(payload);
      setTransferStatus('success');
      loadFinances();
      setTimeout(() => {
        setActiveModal(null);
        setTransferStatus('idle');
        setTransferValues({ destino: '', monto: '', concepto: '' });
        setTransferTouched({ destino: false, monto: false, concepto: false });
        setTransferErrors({ destino: '', monto: '', concepto: '' });
      }, 1200);
    } catch (err) {
      setTransferStatus('error');
      setTransferServerError(classifyAdminError(err).message);
    }
  };

  const closeModal = () => {
    if (transferStatus === 'sending' || cardStatus === 'sending') return;
    setActiveModal(null);
    setCardPendingDeleteId(null);
  };

  // --- Métodos de Pago ---
  const [cardValues, setCardValues] = useState({ numero: '', vencimiento: '', titular: '', predeterminada: false });
  const [cardErrors, setCardErrors] = useState({ numero: '', vencimiento: '', titular: '' });
  const [cardTouched, setCardTouched] = useState({ numero: false, vencimiento: false, titular: false });
  const [cardStatus, setCardStatus] = useState('idle'); 
  const [cardServerError, setCardServerError] = useState('');
  const [cardPendingDeleteId, setCardPendingDeleteId] = useState(null);

  const handleCardChange = (field) => (e) => {
    let value = field === 'predeterminada' ? e.target.checked : e.target.value;
    if (field === 'numero') value = formatCardNumber(value);
    if (field === 'vencimiento') value = formatExpiry(value);
    setCardValues((prev) => ({ ...prev, [field]: value }));
    if (field !== 'predeterminada' && cardTouched[field]) {
      setCardErrors((prev) => ({ ...prev, [field]: validateCardField(field, value) }));
    }
  };

  const handleCardBlur = (field) => () => {
    setCardTouched((prev) => ({ ...prev, [field]: true }));
    setCardErrors((prev) => ({ ...prev, [field]: validateCardField(field, cardValues[field]) }));
  };

  const cardInputClasses = (field) =>
    `w-full px-4 py-3 bg-surface border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      cardErrors[field] && cardTouched[field] ? 'border-error focus:border-error' : 'border-outline-variant/60 focus:border-yellow-500'
    }`;

  const resetCardForm = () => {
    setCardValues({ numero: '', vencimiento: '', titular: '', predeterminada: false });
    setCardTouched({ numero: false, vencimiento: false, titular: false });
    setCardErrors({ numero: '', vencimiento: '', titular: '' });
  };

  const submitAddCard = async () => {
    if (cardStatus === 'sending') return;

    const fields = ['numero', 'vencimiento', 'titular'];
    const newErrors = {};
    fields.forEach((f) => { newErrors[f] = validateCardField(f, cardValues[f]); });
    setCardErrors(newErrors);
    setCardTouched({ numero: true, vencimiento: true, titular: true });

    if (Object.values(newErrors).some((e) => e !== '')) return;

    const digits = onlyDigits(cardValues.numero);
    const payload = {
      numero: digits,
      last4: digits.slice(-4),
      vencimiento: cardValues.vencimiento,
      brand: detectCardBrand(digits),
      predeterminada: cardValues.predeterminada,
    };

    setCardStatus('sending');
    setCardServerError('');
    try {
      await addPaymentMethod(payload);
      setCardStatus('success');
      await loadCards();
      setTimeout(() => {
        setActiveModal(null);
        setCardStatus('idle');
        resetCardForm();
      }, 1000);
    } catch (err) {
      setCardStatus('error');
      setCardServerError(classifyAdminError(err).message);
    }
  };

  const requestDeleteCard = (id) => {
    setCardPendingDeleteId(id);
    setActiveModal('deleteCard');
  };

  const confirmDeleteCard = async () => {
    if (!cardPendingDeleteId || cardStatus === 'sending') return;
    setCardStatus('sending');
    setCardServerError('');
    try {
      await deletePaymentMethod(cardPendingDeleteId);
      await loadCards();
      setCardStatus('idle');
      setCardPendingDeleteId(null);
      setActiveModal(null);
    } catch (err) {
      setCardStatus('error');
      setCardServerError(classifyAdminError(err).message);
    }
  };

  const makeDefaultCard = async (id) => {
    try {
      await setDefaultPaymentMethod(id);
      await loadCards();
    } catch {
      // Silencioso
    }
  };

  const cardPendingDelete = cards.find((c) => c.id === cardPendingDeleteId) || null;

  const downloadStatement = () => {
    const rows = [
      ['Resumen Financiero - TraveXperience'],
      [],
      ['Total gastado', finances?.totalSpent ?? '0'],
      ['Presupuesto Asignado', finances?.budget ?? '0'],
      ['Ahorros recientes', finances?.recentSavings ?? '0'],
      [],
      ['Concepto', 'Categoría', 'Fecha', 'Estado', 'Monto'],
      ...transactions.map((t) => [t.concept, t.category, t.date, t.status, typeof t.amount === 'number' ? t.amount : t.amount]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estado-de-cuenta-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const categoryPct = (finances?.categories || []).map((c) => ({ name: c.name, pct: c.pct ?? c.percentage ?? 0 }));

  return (
    <AdminLayout activePage="admin-pagos" onNavigate={onNavigate}>

      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-surface-container-low border border-solid border-outline-variant/30 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-on-surface mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-yellow-500">account_balance</span>
              Finanzas y Pagos
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl font-medium">
              Gestiona el flujo de caja, revisa el historial de transacciones y administra los métodos de pago vinculados a la plataforma operativa.
            </p>
          </div>
        </div>
        
        <div className="w-full lg:w-auto flex flex-col gap-3 justify-center">
          <button
            onClick={downloadStatement}
            className="h-14 bg-surface border border-solid border-outline-variant/60 text-on-surface font-bold rounded-2xl px-6 flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            Descargar Estado
          </button>
          <button
            onClick={() => setActiveModal('transfer')}
            className="h-14 bg-yellow-500 text-black font-bold rounded-2xl px-6 flex items-center justify-center gap-2 hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer shadow-md shadow-yellow-500/20"
          >
            <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
            Transferir Fondos
          </button>
        </div>
      </div>

      {errorInfo && (
        <div className="mb-6">
          <AdminErrorBanner {...errorInfo} onNavigate={onNavigate} onRetry={() => { loadFinances(); loadTransactions(1); }} />
        </div>
      )}

      {/* Stat Cards */}
      {financesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-container-high rounded-3xl h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-8">
          
          <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-solid border-blue-500/20">
                <span className="material-symbols-outlined text-blue-500 text-[22px]">payments</span>
              </div>
              {finances?.totalSpentChangePct != null && (
                <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${finances.totalSpentChangePct >= 0 ? 'bg-error/10 text-error' : 'bg-green-500/10 text-green-500'}`}>
                  {finances.totalSpentChangePct > 0 ? '+' : ''}{finances.totalSpentChangePct}%
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Total Gastado</p>
            <p className="text-3xl font-black text-on-surface">{fmtCurrency(finances?.totalSpent)}</p>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center border border-solid border-purple-500/20">
                <span className="material-symbols-outlined text-purple-400 text-[22px]">account_balance_wallet</span>
              </div>
              {finances?.budgetUsedPct != null && (
                <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-surface-container-highest text-on-surface">
                  {finances.budgetUsedPct}% Usado
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Presupuesto</p>
            <p className="text-3xl font-black text-on-surface mb-3">{fmtCurrency(finances?.budget)}</p>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${finances?.budgetUsedPct ?? 0}%` }} />
            </div>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center border border-solid border-green-500/20 mb-5">
              <span className="material-symbols-outlined text-green-500 text-[22px]">savings</span>
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ahorros Recientes</p>
            <p className="text-3xl font-black text-on-surface mb-2">{fmtCurrency(finances?.recentSavings)}</p>
            {finances?.savingsNote && <p className="text-[11px] font-medium text-green-500 line-clamp-1">{finances.savingsNote}</p>}
          </div>

          <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm lg:col-span-1 md:col-span-3">
            <h3 className="text-sm font-bold text-on-surface mb-4">Gastos por Categoría</h3>
            {categoryPct.length === 0 ? (
              <div className="h-16 flex items-center justify-center border border-dashed border-outline-variant/50 rounded-xl">
                <p className="text-xs text-on-surface-variant">Sin datos todavía.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {categoryPct.map((c) => (
                  <div key={c.name} className="group">
                    <div className="flex justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                      <span className="group-hover:text-yellow-500 transition-colors">{c.name}</span>
                      <span className="text-on-surface">{c.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Cards & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        {/* --- Métodos de Pago --- */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-500">wallet</span>
              Mis Tarjetas
            </h3>
            <button
              onClick={() => setActiveModal('addCard')}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-yellow-500 hover:text-black flex items-center justify-center text-on-surface transition-colors cursor-pointer border-none shadow-sm"
              title="Añadir nueva tarjeta"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>

          {cardsLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-44 rounded-3xl bg-surface-container-high animate-pulse" />
            ))
          ) : (
            <>
              {cards.length === 0 && (
                <div className="border border-dashed border-outline-variant/60 rounded-3xl p-8 text-center bg-surface-container-lowest/50">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-2">credit_card_off</span>
                  <p className="text-sm font-bold text-on-surface mb-1">Sin tarjetas</p>
                  <p className="text-xs text-on-surface-variant">Añade un método de pago para operar.</p>
                </div>
              )}

              {cards.map((card) =>
                card.isDefault ? (
                  <div key={card.id} className="relative rounded-3xl p-6 overflow-hidden group shadow-lg border border-yellow-500/30 bg-gradient-to-tr from-surface-container-highest via-surface to-surface-container-highest">
                    {/* Glow effect */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <span className="material-symbols-outlined text-[28px] text-yellow-500">contactless</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-wider bg-yellow-500 text-black px-2 py-0.5 rounded-md shadow-sm">Default</span>
                        <button
                          onClick={() => requestDeleteCard(card.id)}
                          title="Eliminar tarjeta"
                          className="w-7 h-7 rounded-full bg-surface-container hover:bg-error hover:text-white flex items-center justify-center text-on-surface transition-colors cursor-pointer border-none shadow-sm opacity-0 group-hover:opacity-100"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xl font-mono tracking-widest text-on-surface mb-4">•••• •••• •••• {card.last4}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-0.5">Expira</p>
                        <p className="text-sm font-bold text-on-surface">{card.expiry}</p>
                      </div>
                      <span className="font-black text-on-surface italic tracking-wider opacity-80">{card.brand}</span>
                    </div>
                  </div>
                ) : (
                  <div key={card.id} className="relative rounded-3xl p-6 overflow-hidden group border border-solid border-outline-variant/40 bg-surface shadow-sm hover:border-outline-variant transition-colors">
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant/50">credit_card</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => makeDefaultCard(card.id)}
                          title="Usar por defecto"
                          className="w-7 h-7 rounded-full bg-surface-container hover:bg-yellow-500 hover:text-black flex items-center justify-center text-on-surface transition-colors cursor-pointer border-none shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[14px]">star</span>
                        </button>
                        <button
                          onClick={() => requestDeleteCard(card.id)}
                          title="Eliminar tarjeta"
                          className="w-7 h-7 rounded-full bg-surface-container hover:bg-error hover:text-white flex items-center justify-center text-on-surface transition-colors cursor-pointer border-none shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xl font-mono tracking-widest text-on-surface-variant mb-4">•••• •••• •••• {card.last4}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-0.5">Expira</p>
                        <p className="text-sm font-bold text-on-surface-variant">{card.expiry}</p>
                      </div>
                      <span className="font-bold text-on-surface-variant italic tracking-wider opacity-50">{card.brand}</span>
                    </div>
                  </div>
                )
              )}
            </>
          )}

          <div className="relative overflow-hidden bg-surface-container-high rounded-3xl p-6 mt-4 border border-solid border-outline-variant/20 shadow-inner">
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-surface-container-highest text-9xl">shield_locked</span>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-green-500 text-[20px]">verified_user</span>
                <h4 className="text-sm font-bold text-on-surface">Pagos Seguros</h4>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-4 max-w-[200px]">
                Todas las transacciones están encriptadas con protocolos de seguridad bancaria.
              </p>
            </div>
          </div>
        </div>

        {/* --- Historial de Transacciones --- */}
        <div className="bg-surface border border-solid border-outline-variant/40 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full">
          
          {/* Toolbar Transacciones */}
          <div className="p-6 border-0 border-b border-solid border-outline-variant/30 bg-surface-container-lowest/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500">receipt_long</span>
                Historial de Movimientos
              </h3>
              <button
                onClick={() => setFiltersOpen((prev) => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-solid ${
                  filtersOpen ? 'bg-surface-container text-on-surface border-outline-variant' : 'bg-transparent text-on-surface border-outline-variant/60 hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">filter_list</span>
                Filtros
              </button>
            </div>
            
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
              <input
                type="text"
                placeholder="Buscar por concepto o ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface border border-solid border-outline-variant/60 rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
              />
            </div>

            {/* Filtros Plegables */}
            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 transition-all duration-300 overflow-hidden ${filtersOpen ? 'mt-4 max-h-40 opacity-100' : 'max-h-0 opacity-0 m-0'}`}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-surface border border-solid border-outline-variant/60 rounded-xl text-xs font-bold text-on-surface outline-none focus:border-yellow-500 cursor-pointer appearance-none"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'todos' ? 'Todos los estados' : s}</option>)}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2.5 bg-surface border border-solid border-outline-variant/60 rounded-xl text-xs font-bold text-on-surface outline-none focus:border-yellow-500 cursor-pointer appearance-none"
              >
                {categoryOptions.map((c) => <option key={c} value={c}>{c === 'todas' ? 'Todas las categorías' : c}</option>)}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2.5 bg-surface border border-solid border-outline-variant/60 rounded-xl text-xs font-bold text-on-surface outline-none focus:border-yellow-500"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2.5 bg-surface border border-solid border-outline-variant/60 rounded-xl text-xs font-bold text-on-surface outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          {txError && (
            <div className="p-4 border-b border-solid border-outline-variant/30">
              <AdminErrorBanner type="error" message={txError} onRetry={() => loadTransactions(txPage)} />
            </div>
          )}

          {/* Tabla */}
          <div className="overflow-x-auto no-scrollbar flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest">
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Concepto</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {txLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-5"><div className="h-6 rounded-md bg-surface-container-high w-3/4" /></td>
                      <td className="px-6 py-5"><div className="h-4 rounded-md bg-surface-container-high w-1/2" /></td>
                      <td className="px-6 py-5"><div className="h-4 rounded-md bg-surface-container-high w-2/3" /></td>
                      <td className="px-6 py-5"><div className="h-6 rounded-full bg-surface-container-high w-20" /></td>
                      <td className="px-6 py-5"><div className="h-6 rounded-md bg-surface-container-high w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl">receipt_long</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface mb-1">Sin resultados</p>
                      <p className="text-xs text-on-surface-variant">No hay transacciones que coincidan con la búsqueda.</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const amountNum = typeof t.amount === 'number' ? t.amount : Number(String(t.amount).replace(/[^0-9.-]/g, ''));
                    const isNegative = amountNum < 0;
                    return (
                      <tr key={t.id} className="hover:bg-surface-container-lowest/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0 border border-solid border-outline-variant/30 group-hover:border-yellow-500/50 transition-colors">
                              <span className="material-symbols-outlined text-on-surface-variant text-[20px] group-hover:text-yellow-500">{t.icon || 'receipt_long'}</span>
                            </div>
                            <span className="text-sm font-bold text-on-surface">{t.concept}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-surface-container-low px-2.5 py-1 rounded-md text-xs font-bold text-on-surface-variant">
                            {t.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-on-surface-variant whitespace-nowrap">{t.date}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[t.status] || 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm font-black text-right whitespace-nowrap ${isNegative ? 'text-error' : 'text-on-surface'}`}>
                          {fmtCurrency(t.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer Paginación */}
          <div className="flex items-center justify-between px-6 py-4 border-0 border-t border-solid border-outline-variant/30 bg-surface-container-lowest/50">
            <span className="text-xs text-on-surface-variant font-medium">
              Mostrando <span className="font-bold text-on-surface">{(txPage - 1) * PAGE_SIZE + 1}</span> – <span className="font-bold text-on-surface">{Math.min(txPage * PAGE_SIZE, txTotal)}</span> de <span className="font-bold text-on-surface">{txTotal}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => loadTransactions(txPage - 1)}
                disabled={txPage <= 1 || txLoading}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <div className="px-2 py-1 text-xs font-bold text-on-surface bg-surface-container rounded-md">
                {txPage} / {totalPages}
              </div>
              <button
                onClick={() => loadTransactions(txPage + 1)}
                disabled={txPage >= totalPages || txLoading}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Modal: Transferir Fondos ---- */}
      {activeModal === 'transfer' && (
        <Modal title="Transferir Fondos" icon="swap_horiz" onClose={closeModal}>
          <div className="space-y-5">
            {availableBalance != null && (
              <div className="bg-surface-container-low border border-solid border-outline-variant/40 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Saldo Disponible</span>
                <span className="text-lg font-black text-on-surface">{fmtCurrency(availableBalance)}</span>
              </div>
            )}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Cuenta / IBAN Destino</label>
              <input
                type="text"
                placeholder="Ej. ES12 3456 7890 1234 5678"
                className={transferInputClasses('destino')}
                value={transferValues.destino}
                onChange={handleTransferChange('destino')}
                onBlur={handleTransferBlur('destino')}
              />
              {transferErrors.destino && transferTouched.destino && <p className="text-xs text-error font-semibold mt-1">{transferErrors.destino}</p>}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Monto a Transferir (MXN)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={`${transferInputClasses('monto')} pl-8`}
                  value={transferValues.monto}
                  onChange={handleTransferChange('monto')}
                  onBlur={handleTransferBlur('monto')}
                />
              </div>
              {transferErrors.monto && transferTouched.monto && <p className="text-xs text-error font-semibold mt-1">{transferErrors.monto}</p>}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Concepto (Opcional)</label>
              <input
                type="text"
                placeholder="Ej. Pago a proveedor de transporte"
                className={transferInputClasses('concepto')}
                value={transferValues.concepto}
                onChange={handleTransferChange('concepto')}
                onBlur={handleTransferBlur('concepto')}
              />
              {transferErrors.concepto && transferTouched.concepto && <p className="text-xs text-error font-semibold mt-1">{transferErrors.concepto}</p>}
            </div>

            {transferStatus === 'error' && transferServerError && (
              <div className="bg-error/10 border border-solid border-error/30 rounded-lg p-3 flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <p className="text-xs font-bold">{transferServerError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-solid border-outline-variant/30 mt-2">
              <button
                onClick={closeModal}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={submitTransfer}
                disabled={transferStatus === 'sending'}
                className="flex-1 bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-yellow-500/20 flex items-center justify-center gap-2"
              >
                {transferStatus === 'success' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                {transferStatus === 'success' ? 'Enviada' : transferStatus === 'sending' ? 'Procesando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- Modal: Agregar Tarjeta ---- */}
      {activeModal === 'addCard' && (
        <Modal title="Nueva Tarjeta" icon="add_card" onClose={closeModal}>
          <div className="space-y-5">
            
            {/* Visual preview de la tarjeta */}
            <div className="w-full h-36 rounded-2xl bg-gradient-to-tr from-surface-container-highest to-surface border border-solid border-outline-variant/50 p-5 flex flex-col justify-between shadow-inner">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-on-surface-variant/50 text-[24px]">contactless</span>
                <span className="text-sm font-black text-on-surface-variant italic opacity-50">{detectCardBrand(onlyDigits(cardValues.numero))}</span>
              </div>
              <div>
                <p className="text-lg font-mono tracking-widest text-on-surface mb-2">
                  {cardValues.numero || '•••• •••• •••• ••••'}
                </p>
                <div className="flex justify-between items-end">
                  <p className="text-xs font-bold text-on-surface-variant truncate max-w-[200px] uppercase">
                    {cardValues.titular || 'NOMBRE DEL TITULAR'}
                  </p>
                  <p className="text-xs font-bold text-on-surface-variant">{cardValues.vencimiento || 'MM/AA'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Número de Tarjeta</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                className={cardInputClasses('numero')}
                value={cardValues.numero}
                onChange={handleCardChange('numero')}
                onBlur={handleCardBlur('numero')}
              />
              {cardErrors.numero && cardTouched.numero && <p className="text-xs text-error font-semibold mt-1">{cardErrors.numero}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Vencimiento</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/AA"
                  maxLength={5}
                  className={cardInputClasses('vencimiento')}
                  value={cardValues.vencimiento}
                  onChange={handleCardChange('vencimiento')}
                  onBlur={handleCardBlur('vencimiento')}
                />
                {cardErrors.vencimiento && cardTouched.vencimiento && <p className="text-xs text-error font-semibold mt-1">{cardErrors.vencimiento}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Titular</label>
                <input
                  type="text"
                  placeholder="Como aparece en la tarjeta"
                  className={cardInputClasses('titular')}
                  value={cardValues.titular}
                  onChange={handleCardChange('titular')}
                  onBlur={handleCardBlur('titular')}
                />
                {cardErrors.titular && cardTouched.titular && <p className="text-xs text-error font-semibold mt-1">{cardErrors.titular}</p>}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer w-fit p-3 bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-xl hover:bg-surface-container-low transition-colors mt-2">
              <input
                type="checkbox"
                checked={cardValues.predeterminada}
                onChange={handleCardChange('predeterminada')}
                className="w-5 h-5 accent-yellow-500 cursor-pointer"
              />
              <div>
                <p className="text-sm font-bold text-on-surface">Tarjeta predeterminada</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Usar para cargos automáticos.</p>
              </div>
            </label>

            {cardStatus === 'error' && cardServerError && (
              <div className="bg-error/10 border border-solid border-error/30 rounded-lg p-3 flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <p className="text-xs font-bold">{cardServerError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-solid border-outline-variant/30 mt-2">
              <button
                onClick={closeModal}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={submitAddCard}
                disabled={cardStatus === 'sending'}
                className="flex-1 bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-yellow-500/20 flex items-center justify-center gap-2"
              >
                {cardStatus === 'success' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                {cardStatus === 'success' ? 'Agregada' : cardStatus === 'sending' ? 'Guardando…' : 'Agregar Tarjeta'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- Modal: Confirmar Eliminación de Tarjeta ---- */}
      {activeModal === 'deleteCard' && cardPendingDelete && (
        <Modal title="Eliminar Tarjeta" icon="credit_card_off" onClose={closeModal}>
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              ¿Seguro que deseas eliminar la tarjeta terminada en <strong className="text-on-surface">{cardPendingDelete.last4}</strong>? 
              {cardPendingDelete.isDefault ? ' Al ser predeterminada, deberás asignar otra para futuros cobros.' : ' Esta acción no se puede deshacer.'}
            </p>
            
            {cardStatus === 'error' && cardServerError && (
              <p className="text-xs font-bold text-error bg-error/10 p-2 rounded-md">{cardServerError}</p>
            )}
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={closeModal}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCard}
                disabled={cardStatus === 'sending'}
                className="flex-1 bg-error text-white py-3 rounded-xl text-sm font-bold hover:bg-error/90 transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-error/20"
              >
                {cardStatus === 'sending' ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </AdminLayout>
  );
}

export default AdminPagos;