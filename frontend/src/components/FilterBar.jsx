import React from 'react';
import { Search, Filter, X } from 'lucide-react';

const FilterBar = ({ filters, onFilterChange, onReset }) => {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '');

  return (
    <div className="bg-dark-light rounded-xl p-6 border border-gray-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Reset All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Search */}
        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Search URL or Title
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search || ''}
              onChange={(e) => handleChange('search', e.target.value)}
              className="w-full bg-dark border border-gray-600 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
            />
          </div>
        </div>

        {/* Method Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Method
          </label>
          <select
            value={filters.method || ''}
            onChange={(e) => handleChange('method', e.target.value)}
            className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
          >
            <option value="">All Methods</option>
            <option value="axios">Axios</option>
            <option value="puppeteer">Puppeteer</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Status
          </label>
          <select
            value={filters.crawlSuccess || ''}
            onChange={(e) => handleChange('crawlSuccess', e.target.value)}
            className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
          >
            <option value="">All Status</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </div>

        {/* Crawl Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Crawl Type
          </label>
          <select
            value={filters.crawlType || ''}
            onChange={(e) => handleChange('crawlType', e.target.value)}
            className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
          >
            <option value="">All Types</option>
            <option value="single">Single Crawl</option>
            <option value="session">Recursive Session</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Date From
          </label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Date To
          </label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
          />
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
