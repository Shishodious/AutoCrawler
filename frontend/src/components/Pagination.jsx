import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  hasMore = false 
}) => {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages || hasMore;

  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrevious}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark border border-gray-700 hover:border-primary/50 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-700"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      {/* Page Info */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400">Page</span>
        <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg font-mono font-semibold">
          {currentPage}
        </span>
        {totalPages > 0 && (
          <>
            <span className="text-gray-400">of</span>
            <span className="text-white font-mono font-semibold">{totalPages}</span>
          </>
        )}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark border border-gray-700 hover:border-primary/50 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-700"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Pagination;
