import React, { useState, useEffect } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock.jsx';
import * as itineraryService from '../services/itineraryService';

/** "14:30" (input type=time) -> "2:30 PM" (formato que usa el itinerario). */
function to12Hour(time24h) {
  const [hStr, mStr] = (time24h || '12:00').split(':');
  let h = parseInt(hStr, 10) || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${period}`;
}

/**
 * Modal chico para elegir a qué día del viaje (o uno nuevo) y a qué hora se
 * agrega un lugar. Se usa desde el Mapa, la ficha de detalle y el propio
 * itinerario, así que el comportamiento de "agregar" es siempre el mismo en
 * toda la app.
 */
function AddToItineraryModal({ place, userId, isOpen, onClose, onAdded }) {
  const [trip, setTrip] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [time, setTime] = useState('12:00');
  const [addingNewDay, setAddingNewDay] = useState(false);
  const [newDayTitle, setNewDayTitle] = useState('');

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const current = itineraryService.getTrip(userId);
    setTrip(current);
    setDayIndex(Math.max(0, current.days.length - 1));
    setTime('12:00');
    setAddingNewDay(false);
    setNewDayTitle('');
  }, [isOpen, userId]);

  if (!isOpen || !place || !trip) return null;

  const handleConfirm = (e) => {
    e.preventDefault();
    let workingTrip = trip;
    let targetIndex = dayIndex;
    if (addingNewDay) {
      workingTrip = itineraryService.addDay(userId, trip, newDayTitle);
      targetIndex = workingTrip.days.length - 1;
    }
    const updated = itineraryService.addEventToDay(userId, workingTrip, targetIndex, place, to12Hour(time));
    onAdded?.(updated, workingTrip.days[targetIndex]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-primary/40 backdrop-blur-md flex items-start justify-center px-4 pt-20 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl p-7 animate-scale-in">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-3 min-w-0">
            {place.image && (
              <img src={place.image} alt={place.title} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold font-display-lg text-on-surface truncate">Agregar al itinerario</h3>
              <p className="text-xs text-on-surface-variant truncate">{place.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary bg-transparent border-none cursor-pointer flex-shrink-0"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4 mt-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">¿Qué día?</label>
            {!addingNewDay ? (
              <div className="flex flex-col gap-2">
                <select
                  value={dayIndex}
                  onChange={(e) => setDayIndex(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-surface-container-low border border-solid border-outline-variant rounded-xl text-sm font-semibold text-primary outline-none focus:border-primary transition-colors"
                >
                  {trip.days.map((d, i) => (
                    <option key={d.id} value={i}>{d.day} — {d.title}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddingNewDay(true)}
                  className="self-start text-xs font-bold text-primary bg-transparent border-none cursor-pointer flex items-center gap-1 hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Agregar un día nuevo
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder={`Día ${trip.days.length + 1}, ej. "Ruta de cascadas"`}
                  value={newDayTitle}
                  onChange={(e) => setNewDayTitle(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-surface-container-low border border-solid border-outline-variant rounded-xl text-sm font-medium text-primary outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setAddingNewDay(false)}
                  title="Usar un día existente"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low border border-outline-variant/40 text-on-surface-variant cursor-pointer flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-base">undo</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider" htmlFor="event-time">
              ¿A qué hora?
            </label>
            <input
              id="event-time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-solid border-outline-variant rounded-xl text-sm font-medium text-primary outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-1 bg-primary text-on-primary px-6 py-3 rounded-xl text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all border-none cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">event_available</span>
            Agregar a mi itinerario
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddToItineraryModal;
