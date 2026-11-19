import React from 'react';
import { CircleMarker, Popup } from 'react-leaflet';

const SEVERITY_COLORS = {
  bajo: '#16a34a',
  moderado: '#d97706',
  alto: '#dc2626',
};

export default function RiskMapLayer({ risks = [] }) {
  return risks
    .filter((risk) => risk.lat != null && risk.lng != null)
    .map((risk) => {
      const color = SEVERITY_COLORS[risk.severity] || SEVERITY_COLORS.moderado;
      return (
        <CircleMarker
          key={risk.id}
          center={[risk.lat, risk.lng]}
          radius={10}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
        >
          <Popup>
            <div className="max-w-64 p-3">
              <p className="text-xs font-black uppercase text-on-surface-variant">{risk.type} · {risk.severity}</p>
              <p className="mt-1 font-bold text-on-surface">{risk.title}</p>
              {risk.description && <p className="mt-2 text-sm text-on-surface-variant">{risk.description}</p>}
              {risk.recommendation && <p className="mt-2 text-xs font-semibold text-on-surface">{risk.recommendation}</p>}
              {risk.updatedAt && (
                <p className="mt-2 text-[10px] text-on-surface-variant">
                  Actualizado: {new Date(risk.updatedAt).toLocaleString('es-MX')}
                </p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      );
    });
}
