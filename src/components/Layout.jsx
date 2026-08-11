import React from 'react';

/**
 * Layout – shared wrapper for all pages.
 * Applies the global design tokens defined in index.css:
 *   - bg-surface / text-on-surface for background and text colors
 *   - min-h-screen to ensure the page fills the viewport
 *   - flex flex-col to allow a header/footer layout if needed later
 *   - font-sans and selection:bg-secondary-container for consistent typography.
 *
 * Props
 *   - children: page content rendered inside the layout.
 */
export default function Layout({ children }) {
  return (
    <div className="bg-surface text-on-surface font-sans selection:bg-secondary-container min-h-screen flex flex-col">
      {/* Optional future header could be placed here */}
      {children}
      {/* Optional future footer could be placed here */}
    </div>
  );
}
