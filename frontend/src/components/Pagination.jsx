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

  const btnClass =
    "flex items-center gap-1.5 rounded-xl border border-hairline bg-dark/60 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-hairline disabled:hover:bg-dark/60";

  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={!canGoPrevious} className={btnClass}>
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Page</span>
        <span className="rounded-lg bg-primary/15 px-3 py-1 font-mono font-semibold text-primary-soft">
          {currentPage}
        </span>
        {totalPages > 0 && (
          <>
            <span className="text-gray-500">of</span>
            <span className="font-mono font-semibold text-white">{totalPages}</span>
          </>
        )}
      </div>

      <button onClick={() => onPageChange(currentPage + 1)} disabled={!canGoNext} className={btnClass}>
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Pagination;
