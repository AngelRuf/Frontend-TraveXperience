/**
 * components/Captcha.jsx
 * -----------------------------------------------------------------------
 * Verificación anti-bot simple y autocontenida (un reto aritmético), para
 * no depender de una API key externa que todavía no tenemos configurada.
 *
 * Si más adelante Anthropic... perdón, si el equipo consigue un sitekey de
 * Google reCAPTCHA, este componente se puede reemplazar por el widget
 * oficial sin tocar los formularios que lo usan: ambos exponen la misma
 * prop `onVerify(boolean)`.
 * -----------------------------------------------------------------------
 */

import { useState, useCallback, useEffect } from 'react';

function generateChallenge() {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  const ops = ['+', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const answer = op === '+' ? a + b : a * b;
  return { a, b, op, answer };
}

function Captcha({ onVerify, resetSignal }) {
  const [challenge, setChallenge] = useState(generateChallenge);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('pending'); // 'pending' | 'ok' | 'error'

  const refresh = useCallback(() => {
    setChallenge(generateChallenge());
    setValue('');
    setStatus('pending');
    if (onVerify) onVerify(false);
  }, [onVerify]);

  // Permite que el formulario padre pida un nuevo reto (ej. tras un envío fallido).
  useEffect(() => {
    if (resetSignal !== undefined) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^\d-]/g, '');
    setValue(raw);
    const isCorrect = raw !== '' && Number(raw) === challenge.answer;
    setStatus(raw === '' ? 'pending' : isCorrect ? 'ok' : 'error');
    if (onVerify) onVerify(isCorrect);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-solid px-4 py-3 transition-colors ${
        status === 'ok'
          ? 'border-green-500/60 bg-green-500/5'
          : status === 'error'
          ? 'border-error/60 bg-error/5'
          : 'border-outline-variant bg-surface-container-lowest'
      }`}
    >
      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">shield_person</span>
      <label htmlFor="captcha-answer" className="text-sm font-semibold text-on-surface whitespace-nowrap">
        Verifica que eres humano: {challenge.a} {challenge.op} {challenge.b} =
      </label>
      <input
        id="captcha-answer"
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        className="w-16 text-center bg-transparent border-b-2 border-solid border-outline-variant focus:border-primary outline-none text-sm font-bold text-on-surface py-1"
        aria-label="Respuesta de verificación"
      />
      {status === 'ok' && <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>}
      {status === 'error' && <span className="material-symbols-outlined text-error text-[20px]">cancel</span>}
      <button
        type="button"
        onClick={refresh}
        title="Generar otro reto"
        className="text-on-surface-variant/60 dark:text-slate-400 hover:text-primary dark:hover:text-white dark:hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300 cursor-pointer bg-transparent border-none p-1"
      >
        <span className="material-symbols-outlined text-[18px]">refresh</span>
      </button>
    </div>
  );
}

export default Captcha;
