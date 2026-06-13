import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

const FilterBar = ({ filters, onFilterChange, onReset }) => {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '');

  const selectClass =
    "w-full rounded-xl border border-hairline bg-dark/60 px-4 py-2.5 text-white transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
  const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500";

  return (
    <div className="glass-card mb-6 rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <SlidersHorizontal className="w-5 h-5 text-primary-soft" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-danger/40 hover:text-danger"
          >
            <X className="w-4 h-4" />
            Reset all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Search */}
        <div className="lg:col-span-3">
          <label className={labelClass}>Search URL or title</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search…"
              value={filters.search || ''}
              onChange={(e) => handleChange('search', e.target.value)}
              className="w-full rounded-xl border border-hairline bg-dark/60 pl-10 pr-4 py-2.5 text-white placeholder:text-gray-600 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Method Filter */}
        <div>
          <label className={labelClass}>Method</label>
          <select value={filters.method || ''} onChange={(e) => handleChange('method', e.target.value)} className={selectClass}>
            <option value="">All methods</option>
            <option value="axios">Axios</option>
            <option value="puppeteer">Puppeteer</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className={labelClass}>Status</label>
          <select value={filters.crawlSuccess || ''} onChange={(e) => handleChange('crawlSuccess', e.target.value)} className={selectClass}>
            <option value="">All statuses</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </div>

        {/* Crawl Type Filter */}
        <div>
          <label className={labelClass}>Crawl type</label>
          <select value={filters.crawlType || ''} onChange={(e) => handleChange('crawlType', e.target.value)} className={selectClass}>
            <option value="">All types</option>
            <option value="single">Single crawl</option>
            <option value="session">Recursive session</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className={labelClass}>Date from</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className={selectClass}
          />
        </div>

        {/* Date To */}
        <div>
          <label className={labelClass}>Date to</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className={selectClass}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
