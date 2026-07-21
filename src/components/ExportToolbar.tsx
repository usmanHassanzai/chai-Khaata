import { useEffect, useRef, useState } from 'react';
import { useShopPrintProfile } from '../hooks/useShopPrintProfile';
import { Label } from '../i18n/useLabel';
import {
  downloadCsv,
  downloadJson,
  downloadPdf,
  printTable,
  type ExportColumn,
} from '../services/export';

type ExportToolbarProps = {
  filenamePrefix: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  /** Optional narrower columns for PDF / print (CSV still uses `columns`). */
  pdfColumns?: ExportColumn[];
  pdfRows?: Record<string, string | number>[];
  /** Custom PDF builder (e.g. professional Godaam report). */
  onPdf?: () => void | Promise<void>;
  jsonData?: unknown;
  disabled?: boolean;
  compact?: boolean;
};

export default function ExportToolbar({
  filenamePrefix,
  title,
  subtitle,
  columns,
  rows,
  pdfColumns,
  pdfRows,
  onPdf,
  jsonData,
  disabled,
  compact,
}: ExportToolbarProps) {
  const shopProfile = useShopPrintProfile();
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${filenamePrefix}-${stamp}`;
  const noData = rows.length === 0 && !(pdfRows && pdfRows.length > 0);
  const blocked = disabled || noData;
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  function exportCsv() {
    downloadCsv(base, columns, rows);
    setMenuOpen(false);
  }

  async function exportPdf() {
    try {
      if (onPdf) {
        await onPdf();
      } else {
        await downloadPdf({
          filename: base,
          title,
          shopProfile,
          subtitle,
          columns: pdfColumns ?? columns,
          rows: pdfRows ?? rows,
        });
      }
    } catch (err) {
      console.error('[Chai Khata] PDF export failed:', err);
    }
    setMenuOpen(false);
  }

  function exportPrint() {
    printTable({
      title,
      shopProfile,
      subtitle,
      columns: pdfColumns ?? columns,
      rows: pdfRows ?? rows,
    });
    setMenuOpen(false);
  }

  function exportJson() {
    const payload = jsonData ?? { exportedAt: new Date().toISOString(), title, rows };
    downloadJson(base, JSON.stringify(payload, null, 2));
    setMenuOpen(false);
  }

  return (
    <div ref={rootRef} className={`export-toolbar${compact ? ' compact' : ''}${menuOpen ? ' is-open' : ''}`}>
      {/* Desktop / laptop — keep full button row */}
      <div className="export-toolbar-desktop">
        <button type="button" className="btn sm" disabled={blocked} onClick={exportCsv} title="Download CSV">
          📥 <Label k="export.csv" variant="compact" />
        </button>
        <button type="button" className="btn sm" disabled={blocked} onClick={() => void exportPdf()} title="Download PDF">
          📄 <Label k="export.pdf" variant="compact" />
        </button>
        <button type="button" className="btn sm" disabled={blocked} onClick={exportPrint} title="Print">
          🖨 <Label k="export.print" variant="compact" />
        </button>
        <button type="button" className="btn sm" disabled={blocked} onClick={exportJson} title="Download JSON">
          {`{ }`} <Label k="export.json" variant="compact" />
        </button>
      </div>

      {/* Mobile — one clean Download control */}
      <div className="export-toolbar-mobile">
        <button
          type="button"
          className="btn sm export-mobile-trigger"
          disabled={blocked}
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
        >
          📥 <Label k="export.downloadMenu" variant="compact" />
          <span className="export-caret" aria-hidden>{menuOpen ? '▴' : '▾'}</span>
        </button>
        {menuOpen && (
          <div className="export-mobile-sheet" role="menu">
            <button type="button" className="export-sheet-item" role="menuitem" onClick={() => void exportPdf()}>
              <span>📄</span>
              <Label k="export.pdf" variant="compact" />
            </button>
            <button type="button" className="export-sheet-item" role="menuitem" onClick={exportCsv}>
              <span>📥</span>
              <Label k="export.csv" variant="compact" />
            </button>
            <button type="button" className="export-sheet-item" role="menuitem" onClick={exportPrint}>
              <span>🖨</span>
              <Label k="export.print" variant="compact" />
            </button>
            <button type="button" className="export-sheet-item" role="menuitem" onClick={exportJson}>
              <span>{`{ }`}</span>
              <Label k="export.json" variant="compact" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
