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
  jsonData,
  disabled,
  compact,
}: ExportToolbarProps) {
  const shopProfile = useShopPrintProfile();
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${filenamePrefix}-${stamp}`;
  const noData = rows.length === 0;

  function exportCsv() {
    downloadCsv(base, columns, rows);
  }

  async function exportPdf() {
    try {
      await downloadPdf({ filename: base, title, shopProfile, subtitle, columns, rows });
    } catch (err) {
      console.error('[Chai Khata] PDF export failed:', err);
    }
  }

  function exportPrint() {
    printTable({ title, shopProfile, subtitle, columns, rows });
  }

  function exportJson() {
    const payload = jsonData ?? { exportedAt: new Date().toISOString(), title, rows };
    downloadJson(base, JSON.stringify(payload, null, 2));
  }

  return (
    <div className={`export-toolbar${compact ? ' compact' : ''}`}>
      <button type="button" className="btn sm" disabled={disabled || noData} onClick={exportCsv} title="Download CSV">
        📥 <Label k="export.csv" variant="compact" />
      </button>
      <button type="button" className="btn sm" disabled={disabled || noData} onClick={exportPdf} title="Download PDF">
        📄 <Label k="export.pdf" variant="compact" />
      </button>
      <button type="button" className="btn sm" disabled={disabled || noData} onClick={exportPrint} title="Print">
        🖨 <Label k="export.print" variant="compact" />
      </button>
      <button type="button" className="btn sm" disabled={disabled || noData} onClick={exportJson} title="Download JSON">
        {`{ }`} <Label k="export.json" variant="compact" />
      </button>
    </div>
  );
}
