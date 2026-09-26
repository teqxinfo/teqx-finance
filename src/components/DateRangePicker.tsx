import React, { useState } from 'react';
import { Calendar, ChevronDown, RotateCcw, Filter, Check } from 'lucide-react';

export type DatePreset = 'this_month' | 'last_30_days' | 'this_year' | 'all_time' | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  preset: DatePreset;
}

interface DateRangePickerProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  filteredCount?: number;
  totalCount?: number;
}

export const getPresetDates = (preset: DatePreset): { startDate: string; endDate: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  switch (preset) {
    case 'this_month': {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return { startDate: format(firstDay), endDate: format(lastDay) };
    }
    case 'last_30_days': {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return { startDate: format(thirtyDaysAgo), endDate: format(now) };
    }
    case 'this_year': {
      const firstDayOfYear = new Date(year, 0, 1);
      const lastDayOfYear = new Date(year, 11, 31);
      return { startDate: format(firstDayOfYear), endDate: format(lastDayOfYear) };
    }
    case 'all_time':
    default:
      return { startDate: '', endDate: '' };
  }
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  range,
  onChange,
  filteredCount,
  totalCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(range.startDate || '');
  const [customEnd, setCustomEnd] = useState(range.endDate || '');

  const presets: { id: DatePreset; label: string }[] = [
    { id: 'all_time', label: 'All Time' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'this_year', label: 'This Year' },
    { id: 'custom', label: 'Custom Range' },
  ];

  const handlePresetSelect = (p: DatePreset) => {
    if (p === 'custom') {
      onChange({
        startDate: customStart,
        endDate: customEnd,
        preset: 'custom',
      });
      setIsOpen(true);
    } else {
      const dates = getPresetDates(p);
      onChange({
        startDate: dates.startDate,
        endDate: dates.endDate,
        preset: p,
      });
      setIsOpen(false);
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart && !customEnd) return;
    onChange({
      startDate: customStart,
      endDate: customEnd,
      preset: 'custom',
    });
    setIsOpen(false);
  };

  const handleReset = () => {
    setCustomStart('');
    setCustomEnd('');
    onChange({
      startDate: '',
      endDate: '',
      preset: 'all_time',
    });
    setIsOpen(false);
  };

  // Human readable label for current active range
  const getDisplayLabel = () => {
    if (range.preset === 'all_time') return 'All Time';
    if (range.preset === 'this_month') return 'This Month';
    if (range.preset === 'last_30_days') return 'Last 30 Days';
    if (range.preset === 'this_year') return 'This Year';
    if (range.startDate && range.endDate) {
      return `${range.startDate} to ${range.endDate}`;
    }
    if (range.startDate) return `From ${range.startDate}`;
    if (range.endDate) return `Until ${range.endDate}`;
    return 'Custom Range';
  };

  const isFiltered = range.preset !== 'all_time' && (range.startDate || range.endDate);

  return (
    <div className="relative z-20">
      {/* Trigger Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-400">Date Range:</span>
            <span className="font-bold text-white">{getDisplayLabel()}</span>
          </div>

          {/* Quick preset buttons */}
          <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
            {presets.map((p) => {
              const active = range.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Mobile dropdown trigger for presets */}
          <div className="sm:hidden relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200"
            >
              <span>{getDisplayLabel()}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Right side: filter summary and reset */}
        <div className="flex items-center gap-2">
          {typeof filteredCount === 'number' && typeof totalCount === 'number' && (
            <span className="text-xs text-slate-400 font-mono">
              <strong className="text-emerald-400">{filteredCount}</strong>/{totalCount} txns
            </span>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Reset date filter to All Time"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`p-1.5 rounded-xl border transition-colors ${
              isOpen
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Configure custom date range"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Custom Range Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Filter by Date Range
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Close
            </button>
          </div>

          {/* Quick preset list */}
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id)}
                className={`py-1.5 px-2.5 text-xs font-semibold rounded-xl text-left flex items-center justify-between transition-colors ${
                  range.preset === p.id
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                <span>{p.label}</span>
                {range.preset === p.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            ))}
          </div>

          {/* Custom Date Form */}
          <form onSubmit={handleApplyCustom} className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
              >
                Apply Range
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
