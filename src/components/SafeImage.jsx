import React, { useEffect, useState } from 'react';

export default function SafeImage({ src, alt = '', className = '', onClick }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className} flex items-center justify-center bg-surface-container-high`}
        onClick={onClick}
      >
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">
          image_not_supported
        </span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onClick={onClick} onError={() => setFailed(true)} />;
}
