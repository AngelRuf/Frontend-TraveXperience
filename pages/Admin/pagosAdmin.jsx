import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  disputePayment,
  classifyAdminError,
} from '../../services/adminService';

const STATUS_OPTIONS = ['todos', 'Completado', 'Pendiente', 'Reembolsado'];

const STATUS_STYLES = {
  Completado: 'bg-green-500/10 text-green-700',
  Pendiente: 'bg-secondary-container/30 text-secondary',
  Reembolsado: 'bg-error/10 text-error',
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

function validateDisputeField(field, value) {
  switch (field) {
    case 'transactionId': {
      if (!value) return 'Selecciona la transacción a disputar.';
      return '';
    }
    case 'motivo': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El motivo de la disputa es obligatorio.';
      if (trimmed.length < 20) return 'Describe el motivo con al menos 20 caracteres.';
      if (value.length > 500) return 'El motivo no puede superar los 500 caracteres.';
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

// ---------- Modal genérico ----------
function Modal({ title, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-surface rounded-2xl w-full max-w-md p-6 md:p-8 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface bg-transparent border-none cursor-pointer material-symbols-outlined"
        >
          close
        </button>
        <div className="flex items-center gap-2 text-on-surface mb-6">
          <span className="material-symbols-outlined">{icon}</span>
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function fmtCurrency(n) {
  if (n === null || n === undefined) return '—';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

const PAGE_SIZE = 10;

function AdminPagos({ onNavigate }) {
  const [activeModal, setActiveModal] = useState(null); // null | 'transfer' | 'dispute' | 'addCard' | 'deleteCard'

  // --- Finanzas (resumen) ---
  const [finances, setFinances] = useState(null);
  const [financesLoading, setFinancesLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);

  // --- Transacciones ---
  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // --- Métodos de pago ---
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);

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
  useEffect(() => {
    const timer = setTimeout(() => loadTransactions(1), 300); // debounce de búsqueda/filtros
    return () => clearTimeout(timer);
  }, [search, statusFilter, categoryFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryOptions = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category).filter(Boolean));
    return ['todas', ...set];
  }, [transactions]);

  const totalPages = Math.max(1, Math.ceil(txTotal / PAGE_SIZE));

  // --- Transferir Fondos ---
  const [transferValues, setTransferValues] = useState({ destino: '', monto: '', concepto: '' });
  const [transferErrors, setTransferErrors] = useState({ destino: '', monto: '', concepto: '' });
  const [transferTouched, setTransferTouched] = useState({ destino: false, monto: false, concepto: false });
  const [transferStatus, setTransferStatus] = useState('idle'); // idle | sending | success | error
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
    `w-full px-4 py-3 bg-surface-container-lowest border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      transferErrors[field] && transferTouched[field] ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
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

  // --- Disputar Pago ---
  const [disputeValues, setDisputeValues] = useState({ transactionId: '', motivo: '' });
  const [disputeErrors, setDisputeErrors] = useState({ transactionId: '', motivo: '' });
  const [disputeTouched, setDisputeTouched] = useState({ transactionId: false, motivo: false });
  const [disputeStatus, setDisputeStatus] = useState('idle'); // idle | sending | success | error
  const [disputeServerError, setDisputeServerError] = useState('');

  const handleDisputeChange = (field) => (e) => {
    const value = e.target.value;
    setDisputeValues((prev) => ({ ...prev, [field]: value }));
    if (disputeTouched[field]) {
      setDisputeErrors((prev) => ({ ...prev, [field]: validateDisputeField(field, value) }));
    }
  };

  const handleDisputeBlur = (field) => () => {
    setDisputeTouched((prev) => ({ ...prev, [field]: true }));
    setDisputeErrors((prev) => ({ ...prev, [field]: validateDisputeField(field, disputeValues[field]) }));
  };

  const disputeInputClasses = (field) =>
    `w-full px-4 py-3 bg-surface-container-lowest border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      disputeErrors[field] && disputeTouched[field] ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
    }`;

  const submitDispute = async () => {
    if (disputeStatus === 'sending') return;

    const fields = ['transactionId', 'motivo'];
    const newErrors = {};
    fields.forEach((f) => { newErrors[f] = validateDisputeField(f, disputeValues[f]); });
    setDisputeErrors(newErrors);
    setDisputeTouched({ transactionId: true, motivo: true });

    if (Object.values(newErrors).some((e) => e !== '')) return;

    const payload = {
      transactionId: disputeValues.transactionId,
      motivo: disputeValues.motivo.trim(),
    };

    setDisputeStatus('sending');
    setDisputeServerError('');
    try {
      await disputePayment(payload);
      setDisputeStatus('success');
      loadTransactions(txPage);
      setTimeout(() => {
        setActiveModal(null);
        setDisputeStatus('idle');
        setDisputeValues({ transactionId: '', motivo: '' });
        setDisputeTouched({ transactionId: false, motivo: false });
        setDisputeErrors({ transactionId: '', motivo: '' });
      }, 1200);
    } catch (err) {
      setDisputeStatus('error');
      setDisputeServerError(classifyAdminError(err).message);
    }
  };

  const closeModal = () => {
    if (transferStatus === 'sending' || disputeStatus === 'sending' || cardStatus === 'sending') return;
    setActiveModal(null);
    setCardPendingDeleteId(null);
  };

  // --- Métodos de Pago (agregar / eliminar tarjetas) ---
  const [cardValues, setCardValues] = useState({ numero: '', vencimiento: '', titular: '', predeterminada: false });
  const [cardErrors, setCardErrors] = useState({ numero: '', vencimiento: '', titular: '' });
  const [cardTouched, setCardTouched] = useState({ numero: false, vencimiento: false, titular: false });
  const [cardStatus, setCardStatus] = useState('idle'); // idle | sending | success | error
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
    `w-full px-4 py-3 bg-surface-container-lowest border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      cardErrors[field] && cardTouched[field] ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
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
      // Silencioso: el usuario puede reintentar desde la lista.
    }
  };

  const cardPendingDelete = cards.find((c) => c.id === cardPendingDeleteId) || null;

  const categoryPct = (finances?.categories || []).map((c) => ({ name: c.name, pct: c.pct ?? c.percentage ?? 0 }));

  return (
    <AdminLayout activePage="admin-pagos" onNavigate={onNavigate}>

      {errorInfo && (
        <div className="mb-6">
          <AdminErrorBanner {...errorInfo} onNavigate={onNavigate} onRetry={() => { loadFinances(); loadTransactions(1); }} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">Finanzas y Pagos</span>
          <h1 className="text-4xl font-bold text-on-surface mt-1">Panel de Control</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Descargar Estado
          </button>
          <button
            onClick={() => setActiveModal('transfer')}
            className="flex items-center gap-2 px-5 py-2.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
            Transferir Fondos
          </button>
          <button
            onClick={() => setActiveModal('dispute')}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:opacity-90 transition-all border-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">gavel</span>
            Disputar Pago
          </button>
        </div>
      </div>

      {/* Stat cards + Gastos por categoría */}
      {financesLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_1.2fr] gap-5 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_1.2fr] gap-5 mb-6">
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="w-9 h-9 rounded-lg bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-on-secondary-container text-[18px]">
                  account_balance_wallet
                </span>
              </div>
              {finances?.totalSpentChangePct != null && (
                <span className={`text-[11px] font-bold ${finances.totalSpentChangePct >= 0 ? 'text-green-700' : 'text-error'}`}>
                  {finances.totalSpentChangePct > 0 ? '+' : ''}{finances.totalSpentChangePct}% vs mes pasado
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Total Gastado</p>
            <p className="text-2xl font-bold text-on-surface">{fmtCurrency(finances?.totalSpent)}</p>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
            <div className="w-9 h-9 rounded-lg bg-primary-container/30 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-primary text-[18px]">credit_card</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Presupuesto</p>
              {finances?.budgetUsedPct != null && <span className="text-xs font-bold text-secondary">{finances.budgetUsedPct}%</span>}
            </div>
            <p className="text-2xl font-bold text-on-surface mb-2">{fmtCurrency(finances?.budget)}</p>
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full" style={{ width: `${finances?.budgetUsedPct ?? 0}%` }} />
            </div>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-green-700 text-[18px]">savings</span>
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ahorros Recientes</p>
            <p className="text-2xl font-bold text-on-surface mb-1">{fmtCurrency(finances?.recentSavings)}</p>
            {finances?.savingsNote && <p className="text-[11px] text-on-surface-variant italic">{finances.savingsNote}</p>}
          </div>

          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-on-surface">Gastos por Categoría</h3>
            </div>
            {categoryPct.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Sin datos de categorías todavía.</p>
            ) : (
              <div className="space-y-3">
                {categoryPct.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wide mb-1">
                      <span>{c.name}</span>
                      <span className="text-on-surface">{c.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Métodos de pago + Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-on-surface">Métodos de Pago</h3>
            <button
              onClick={() => setActiveModal('addCard')}
              className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface bg-transparent border-none cursor-pointer material-symbols-outlined text-[16px]"
            >
              add
            </button>
          </div>

          {cardsLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-surface-container-high animate-pulse" />
            ))
          ) : (
            <>
              {cards.length === 0 && (
                <div className="border border-dashed border-outline-variant rounded-2xl p-6 text-center">
                  <p className="text-xs text-on-surface-variant">No tienes tarjetas registradas.</p>
                </div>
              )}

              {cards.map((card) =>
                card.isDefault ? (
                  <div key={card.id} className="bg-primary rounded-2xl p-5 text-on-primary relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-8">
                      <span className="material-symbols-outlined text-[22px]">credit_card</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-on-primary/10 px-2 py-0.5 rounded-full">PREDETERMINADA</span>
                        <button
                          onClick={() => requestDeleteCard(card.id)}
                          title="Eliminar tarjeta"
                          className="w-6 h-6 rounded-full bg-on-primary/10 hover:bg-on-primary/20 flex items-center justify-center text-on-primary bg-transparent border-none cursor-pointer material-symbols-outlined text-[14px]"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                    <p className="text-lg font-mono tracking-widest mb-4">•••• •••• •••• {card.last4}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-primary/70">EXPIRES {card.expiry}</span>
                      <span className="font-bold">{card.brand}</span>
                    </div>
                  </div>
                ) : (
                  <div key={card.id} className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-5 group">
                    <div className="flex justify-between items-start mb-8">
                      <span className="material-symbols-outlined text-on-surface text-[22px]">credit_card</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => makeDefaultCard(card.id)}
                          title="Marcar como predeterminada"
                          className="text-[10px] font-bold text-on-surface-variant hover:text-primary bg-transparent border-none cursor-pointer uppercase tracking-wide"
                        >
                          Usar por defecto
                        </button>
                        <button
                          onClick={() => requestDeleteCard(card.id)}
                          title="Eliminar tarjeta"
                          className="w-6 h-6 rounded-full bg-surface-container-low hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant bg-transparent border-none cursor-pointer material-symbols-outlined text-[14px]"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                    <p className="text-lg font-mono tracking-widest text-on-surface mb-4">•••• •••• •••• {card.last4}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant">EXPIRES {card.expiry}</span>
                      <span className="font-bold text-on-surface">{card.brand}</span>
                    </div>
                  </div>
                )
              )}
            </>
          )}

          <div className="relative overflow-hidden bg-secondary-container rounded-2xl p-5">
            <span className="material-symbols-outlined absolute -bottom-3 -right-3 text-primary/10 text-8xl">shield</span>
            <div className="relative z-10">
              <h4 className="text-sm font-bold text-black mb-1">Seguro de Viaje Pro</h4>
              <p className="text-xs text-primary/80 leading-relaxed mb-4">
                Cubre todos tus pagos con protección antifraude global.
              </p>
              <button className="bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-all border-none cursor-pointer">
                Activar Ahora
              </button>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl overflow-hidden">
          <div className="flex flex-col gap-4 px-6 py-5 border-0 border-b border-solid border-outline-variant/40">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-surface">Historial de Transacciones</h3>
              <button
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-4 py-2 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">filter_list</span>
                Filtros
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar por concepto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-solid border-outline-variant rounded-lg text-sm text-on-surface outline-none focus:border-primary transition-colors"
            />
            {filtersOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-surface-container-lowest border border-solid border-outline-variant rounded-lg text-xs text-on-surface outline-none"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'todos' ? 'Todos los estados' : s}</option>)}
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-surface-container-lowest border border-solid border-outline-variant rounded-lg text-xs text-on-surface outline-none"
                >
                  {categoryOptions.map((c) => <option key={c} value={c}>{c === 'todas' ? 'Todas las categorías' : c}</option>)}
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 bg-surface-container-lowest border border-solid border-outline-variant rounded-lg text-xs text-on-surface outline-none"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 bg-surface-container-lowest border border-solid border-outline-variant rounded-lg text-xs text-on-surface outline-none"
                />
              </div>
            )}
          </div>

          {txError && (
            <div className="p-4">
              <AdminErrorBanner type="error" message={txError} onRetry={() => loadTransactions(txPage)} />
            </div>
          )}

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-lowest">
                  <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Concepto</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-6 py-4"><div className="h-6 rounded bg-surface-container-high animate-pulse" /></td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant">No hay transacciones que coincidan con los filtros.</td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const amountNum = typeof t.amount === 'number' ? t.amount : Number(String(t.amount).replace(/[^0-9.-]/g, ''));
                    const isNegative = amountNum < 0;
                    return (
                      <tr key={t.id} className="border-0 border-b border-solid border-outline-variant/30 last:border-0 hover:bg-surface-container-lowest/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-on-surface text-[18px]">{t.icon || 'receipt_long'}</span>
                            </div>
                            <span className="text-sm font-bold text-on-surface">{t.concept}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-on-surface-variant whitespace-nowrap">{t.category}</td>
                        <td className="px-6 py-4 text-xs font-semibold text-on-surface-variant whitespace-nowrap">{t.date}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${STATUS_STYLES[t.status] || 'bg-surface-container-high text-on-surface-variant'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm font-bold text-right whitespace-nowrap ${isNegative ? 'text-error' : 'text-on-surface'}`}>
                          {typeof t.amount === 'number' ? fmtCurrency(t.amount) : t.amount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-0 border-t border-solid border-outline-variant/40">
            <span className="text-[11px] text-on-surface-variant font-medium">
              Página {txPage} de {totalPages} · {txTotal} transacciones
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => loadTransactions(txPage - 1)}
                disabled={txPage <= 1 || txLoading}
                className="px-3 py-1.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => loadTransactions(txPage + 1)}
                disabled={txPage >= totalPages || txLoading}
                className="px-3 py-1.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Modal: Transferir Fondos ---- */}
      {activeModal === 'transfer' && (
        <Modal title="Transferir Fondos" icon="swap_horiz" onClose={closeModal}>
          <div className="space-y-4">
            {availableBalance != null && (
              <p className="text-xs text-on-surface-variant -mt-2 mb-2">
                Saldo disponible: <span className="font-bold text-on-surface">{fmtCurrency(availableBalance)}</span>
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cuenta / IBAN Destino</label>
              <input
                type="text"
                placeholder="Ej. ES12 3456 7890 1234 5678"
                className={transferInputClasses('destino')}
                value={transferValues.destino}
                onChange={handleTransferChange('destino')}
                onBlur={handleTransferBlur('destino')}
              />
              {transferErrors.destino && transferTouched.destino && <p className="text-xs text-error">{transferErrors.destino}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Monto (MXN)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-semibold">$</span>
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
              {transferErrors.monto && transferTouched.monto && <p className="text-xs text-error">{transferErrors.monto}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Concepto (opcional)</label>
              <input
                type="text"
                placeholder="Ej. Pago a proveedor"
                className={transferInputClasses('concepto')}
                value={transferValues.concepto}
                onChange={handleTransferChange('concepto')}
                onBlur={handleTransferBlur('concepto')}
              />
              {transferErrors.concepto && transferTouched.concepto && <p className="text-xs text-error">{transferErrors.concepto}</p>}
            </div>

            {transferStatus === 'error' && transferServerError && (
              <p className="text-xs text-error">{transferServerError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={submitTransfer}
                disabled={transferStatus === 'sending'}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:opacity-90 transition-all border-none cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {transferStatus === 'success' && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                {transferStatus === 'success'
                  ? 'Transferencia Enviada'
                  : transferStatus === 'sending'
                  ? 'Procesando…'
                  : 'Confirmar Transferencia'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- Modal: Disputar Pago ---- */}
      {activeModal === 'dispute' && (
        <Modal title="Disputar Pago" icon="gavel" onClose={closeModal}>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Transacción</label>
              <select
                className={disputeInputClasses('transactionId')}
                value={disputeValues.transactionId}
                onChange={handleDisputeChange('transactionId')}
                onBlur={handleDisputeBlur('transactionId')}
              >
                <option value="">Selecciona una transacción</option>
                {transactions.map((t) => (
                  <option key={t.id} value={t.id}>{t.concept} — {typeof t.amount === 'number' ? fmtCurrency(t.amount) : t.amount}</option>
                ))}
              </select>
              {disputeErrors.transactionId && disputeTouched.transactionId && (
                <p className="text-xs text-error">{disputeErrors.transactionId}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Motivo de la Disputa</label>
              <textarea
                rows={4}
                maxLength={500}
                placeholder="Describe detalladamente el motivo de la disputa..."
                className={`${disputeInputClasses('motivo')} resize-none`}
                value={disputeValues.motivo}
                onChange={handleDisputeChange('motivo')}
                onBlur={handleDisputeBlur('motivo')}
              />
              <div className="flex justify-between">
                {disputeErrors.motivo && disputeTouched.motivo ? (
                  <p className="text-xs text-error">{disputeErrors.motivo}</p>
                ) : <span />}
                <span className="text-[11px] text-on-surface-variant/60">{disputeValues.motivo.length}/500</span>
              </div>
            </div>

            {disputeStatus === 'error' && disputeServerError && (
              <p className="text-xs text-error">{disputeServerError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={submitDispute}
                disabled={disputeStatus === 'sending'}
                className="px-5 py-2.5 bg-error text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all border-none cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {disputeStatus === 'success' && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                {disputeStatus === 'success'
                  ? 'Disputa Enviada'
                  : disputeStatus === 'sending'
                  ? 'Enviando…'
                  : 'Enviar Disputa'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- Modal: Agregar Tarjeta ---- */}
      {activeModal === 'addCard' && (
        <Modal title="Agregar Tarjeta" icon="add_card" onClose={closeModal}>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Número de Tarjeta</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                className={cardInputClasses('numero')}
                value={cardValues.numero}
                onChange={handleCardChange('numero')}
                onBlur={handleCardBlur('numero')}
              />
              {cardErrors.numero && cardTouched.numero && <p className="text-xs text-error">{cardErrors.numero}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Vencimiento</label>
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
                {cardErrors.vencimiento && cardTouched.vencimiento && <p className="text-xs text-error">{cardErrors.vencimiento}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nombre del Titular</label>
                <input
                  type="text"
                  placeholder="Como aparece en la tarjeta"
                  className={cardInputClasses('titular')}
                  value={cardValues.titular}
                  onChange={handleCardChange('titular')}
                  onBlur={handleCardBlur('titular')}
                />
                {cardErrors.titular && cardTouched.titular && <p className="text-xs text-error">{cardErrors.titular}</p>}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cardValues.predeterminada}
                onChange={handleCardChange('predeterminada')}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              Marcar como predeterminada
            </label>

            {cardStatus === 'error' && cardServerError && (
              <p className="text-xs text-error">{cardServerError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={submitAddCard}
                disabled={cardStatus === 'sending'}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:opacity-90 transition-all border-none cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cardStatus === 'success' && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                {cardStatus === 'success'
                  ? 'Tarjeta Agregada'
                  : cardStatus === 'sending'
                  ? 'Guardando…'
                  : 'Agregar Tarjeta'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- Modal: Confirmar Eliminación de Tarjeta ---- */}
      {activeModal === 'deleteCard' && cardPendingDelete && (
        <Modal title="Eliminar Tarjeta" icon="delete" onClose={closeModal}>
          <div className="space-y-5">
            <p className="text-sm text-on-surface-variant">
              ¿Seguro que deseas eliminar la tarjeta terminada en{' '}
              <span className="font-bold text-on-surface">{cardPendingDelete.last4}</span>
              {cardPendingDelete.isDefault ? ' (predeterminada)' : ''}? Esta acción no se puede deshacer.
            </p>
            {cardStatus === 'error' && cardServerError && (
              <p className="text-xs text-error">{cardServerError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCard}
                disabled={cardStatus === 'sending'}
                className="px-5 py-2.5 bg-error text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all border-none cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cardStatus === 'sending' ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </AdminLayout>
  );
}

export default AdminPagos;
