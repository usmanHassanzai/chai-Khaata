import { formatCurrency, formatKg } from '../services/calculations';
import type { Sale } from '../models/types';

interface MobileSaleCardsProps {
  sales: Sale[];
  profitFor: (sale: Sale) => number;
  showProfit?: boolean;
}

export default function MobileSaleCards({
  sales,
  profitFor,
  showProfit = true,
}: MobileSaleCardsProps) {
  return (
    <div className="mobile-card-list">
      {sales.map((s) => (
        <article key={s.id} className="mobile-data-card">
          <div className="mobile-data-card-top">
            <span className="mobile-data-card-title">{s.teaName}</span>
            <span className="mobile-data-card-amount">
              {formatCurrency(s.quantityKg * s.salePricePerKg)}
            </span>
          </div>
          <div className="mobile-data-card-meta">
            <span>{s.date}</span>
            <span>{formatKg(s.quantityKg)}</span>
            {showProfit && (
              <span className="mobile-data-card-profit">+{formatCurrency(profitFor(s))}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
