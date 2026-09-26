import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Transaction } from '../types';
import { formatINR, CURRENCY_SYMBOL } from '../utils/currency';

interface TrendLineChartProps {
  transactions: Transaction[];
}

type AggregationMode = 'daily' | 'monthly';

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ transactions }) => {
  const [mode, setMode] = useState<AggregationMode>('daily');
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    income: number;
    expense: number;
    x: number;
    yIncome: number;
    yExpense: number;
  } | null>(null);

  // Prepare aggregated trend data
  const dataPoints = useMemo(() => {
    if (mode === 'daily') {
      // Group by daily date for the last 14-30 days
      const map: { [date: string]: { income: number; expense: number } } = {};
      
      // Collect dates from transactions, sorted
      const sortedTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
      
      sortedTxs.forEach((tx) => {
        if (!tx.date) return;
        if (!map[tx.date]) {
          map[tx.date] = { income: 0, expense: 0 };
        }
        if (tx.type === 'Income') {
          map[tx.date].income += tx.amount;
        } else {
          map[tx.date].expense += tx.amount;
        }
      });

      const dates = Object.keys(map).sort();
      // If we have fewer than 3 dates, add some filler dates so line looks great
      if (dates.length === 0) {
        return [];
      }

      return dates.map((date) => {
        // Format label as "MMM D"
        const [, m, d] = date.split('-');
        const dateObj = new Date(parseInt(date.split('-')[0]), parseInt(m) - 1, parseInt(d));
        const label = dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        return {
          rawKey: date,
          label,
          income: map[date].income,
          expense: map[date].expense,
        };
      });
    } else {
      // Monthly aggregation
      const map: { [yearMonth: string]: { income: number; expense: number } } = {};

      transactions.forEach((tx) => {
        if (!tx.date) return;
        const ym = tx.date.substring(0, 7); // YYYY-MM
        if (!map[ym]) {
          map[ym] = { income: 0, expense: 0 };
        }
        if (tx.type === 'Income') {
          map[ym].income += tx.amount;
        } else {
          map[ym].expense += tx.amount;
        }
      });

      const months = Object.keys(map).sort();
      return months.map((ym) => {
        const [y, m] = ym.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        const label = dateObj.toLocaleDateString('default', { month: 'short', year: '2-digit' });
        return {
          rawKey: ym,
          label,
          income: map[ym].income,
          expense: map[ym].expense,
        };
      });
    }
  }, [transactions, mode]);

  // Chart Dimensions & Scales
  const width = 640;
  const height = 260;
  const paddingLeft = 50;
  const paddingRight = 25;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    let m = 100;
    dataPoints.forEach((d) => {
      if (d.income > m) m = d.income;
      if (d.expense > m) m = d.expense;
    });
    // Add 15% headroom
    return Math.ceil(m * 1.15);
  }, [dataPoints]);

  // Generate coordinates
  const pointsWithCoords = useMemo(() => {
    if (dataPoints.length === 0) return [];
    const stepX = dataPoints.length > 1 ? chartWidth / (dataPoints.length - 1) : chartWidth / 2;

    return dataPoints.map((d, index) => {
      const x = paddingLeft + (dataPoints.length === 1 ? chartWidth / 2 : index * stepX);
      const yIncome = paddingTop + chartHeight - (d.income / maxVal) * chartHeight;
      const yExpense = paddingTop + chartHeight - (d.expense / maxVal) * chartHeight;
      return {
        ...d,
        x,
        yIncome,
        yExpense,
      };
    });
  }, [dataPoints, chartWidth, chartHeight, maxVal, paddingLeft, paddingTop]);

  // Generate SVG path for a series
  const buildSvgPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    // Smooth curve using cubic beziers
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const incomePoints = pointsWithCoords.map((p) => ({ x: p.x, y: p.yIncome }));
  const expensePoints = pointsWithCoords.map((p) => ({ x: p.x, y: p.yExpense }));

  const incomePath = buildSvgPath(incomePoints);
  const expensePath = buildSvgPath(expensePoints);

  // Area paths for subtle gradient under lines
  const groundY = paddingTop + chartHeight;
  const incomeAreaPath =
    pointsWithCoords.length > 0
      ? `${incomePath} L ${pointsWithCoords[pointsWithCoords.length - 1].x} ${groundY} L ${pointsWithCoords[0].x} ${groundY} Z`
      : '';
  const expenseAreaPath =
    pointsWithCoords.length > 0
      ? `${expensePath} L ${pointsWithCoords[pointsWithCoords.length - 1].x} ${groundY} L ${pointsWithCoords[0].x} ${groundY} Z`
      : '';

  // Horizontal Grid Lines
  const gridLinesCount = 4;
  const gridLines = Array.from({ length: gridLinesCount + 1 }).map((_, i) => {
    const val = (maxVal / gridLinesCount) * (gridLinesCount - i);
    const y = paddingTop + (chartHeight / gridLinesCount) * i;
    return { val, y };
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Income vs Expenditure Trend</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cashflow comparison over time from spreadsheet logs
          </p>
        </div>

        {/* Daily vs Monthly Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setMode('daily');
              setHoveredPoint(null);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              mode === 'daily'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily Trend
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('monthly');
              setHoveredPoint(null);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              mode === 'monthly'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly Trend
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs mb-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
          <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-2.5 shadow-sm" />
          <span className="text-slate-300 font-medium">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-rose-400 rounded-full" />
          <span className="w-2 h-2 rounded-full bg-rose-400 -ml-2.5 shadow-sm" />
          <span className="text-slate-300 font-medium">Expenses</span>
        </div>
      </div>

      {dataPoints.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
          <Calendar className="w-10 h-10 stroke-[1.5] mb-2 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No trend data available</p>
          <p className="text-xs text-slate-500 mt-0.5">Transactions added will automatically generate the cashflow trend line</p>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {gridLines.map((gl, i) => (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={gl.y}
                  x2={width - paddingRight}
                  y2={gl.y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={gl.y + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {formatINR(gl.val, { compact: true, showDecimals: false })}
                </text>
              </g>
            ))}

            {/* Area Fills */}
            {incomeAreaPath && (
              <path d={incomeAreaPath} fill="url(#incomeGradient)" />
            )}
            {expenseAreaPath && (
              <path d={expenseAreaPath} fill="url(#expenseGradient)" />
            )}

            {/* Income Line */}
            <path
              d={incomePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Expense Line */}
            <path
              d={expensePath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Active vertical hover marker */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={groundY}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* Data points & hover triggers */}
            {pointsWithCoords.map((pt, idx) => (
              <g key={idx}>
                {/* Income point */}
                <circle
                  cx={pt.x}
                  cy={pt.yIncome}
                  r={hoveredPoint?.x === pt.x ? 5 : 3.5}
                  className="fill-slate-900 stroke-emerald-400 stroke-2 cursor-pointer transition-all"
                />
                {/* Expense point */}
                <circle
                  cx={pt.x}
                  cy={pt.yExpense}
                  r={hoveredPoint?.x === pt.x ? 5 : 3.5}
                  className="fill-slate-900 stroke-rose-400 stroke-2 cursor-pointer transition-all"
                />

                {/* X-axis labels (render sparsely if many items) */}
                {(pointsWithCoords.length <= 8 || idx % Math.ceil(pointsWithCoords.length / 7) === 0 || idx === pointsWithCoords.length - 1) && (
                  <text
                    x={pt.x}
                    y={groundY + 16}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px] font-mono"
                  >
                    {pt.label}
                  </text>
                )}

                {/* Invisible hover area for easy cursor targeting */}
                <rect
                  x={pt.x - 15}
                  y={paddingTop}
                  width={30}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(pt)}
                />
              </g>
            ))}
          </svg>

          {/* Interactive Tooltip Card */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none bg-slate-950/95 border border-slate-700 rounded-xl p-2.5 shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-full mb-3"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(Math.min(hoveredPoint.yIncome, hoveredPoint.yExpense) / height) * 100}%`,
              }}
            >
              <div className="text-[11px] font-bold text-slate-300 mb-1 border-b border-slate-800 pb-1 flex items-center justify-between gap-3">
                <span>{hoveredPoint.label}</span>
                <span className="font-mono text-slate-500 text-[10px]">{mode.toUpperCase()}</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between gap-4 text-emerald-400">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
                    <ArrowUpRight className="w-3 h-3 text-emerald-400" /> Income:
                  </span>
                  <span className="font-bold">{formatINR(hoveredPoint.income)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-rose-400">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
                    <ArrowDownRight className="w-3 h-3 text-rose-400" /> Expense:
                  </span>
                  <span className="font-bold">{formatINR(hoveredPoint.expense)}</span>
                </div>
                <div className="pt-1 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-slate-500 font-sans">Net Diff:</span>
                  <span
                    className={`font-bold ${
                      hoveredPoint.income - hoveredPoint.expense >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {hoveredPoint.income - hoveredPoint.expense >= 0 ? '+' : '-'}
                    {formatINR(hoveredPoint.income - hoveredPoint.expense)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
