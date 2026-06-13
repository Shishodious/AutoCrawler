import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSites, deleteSite } from '../api';
import { History as HistoryIcon, ExternalLink, Trash2, Layers, Link2, Clock, Gauge, Zap, ArrowRight } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import CrawlDetailsExpand from '../components/CrawlDetailsExpand';

const History = () => {
  const navigate = useNavigate();
  const [crawls, setCrawls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasMore: false
  });

  const [filters, setFilters] = useState({
    search: '',
    method: '',
    crawlSuccess: '',
    crawlType: '',
    dateFrom: '',
    dateTo: ''
  });

  const [expandedId, setExpandedId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchHistory();
  }, [filters, pagination.currentPage]);

  const fetchHistory = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = {
        limit: ITEMS_PER_PAGE,
        skip: (pagination.currentPage - 1) * ITEMS_PER_PAGE,
        sortBy: 'createdAt',
        order: 'desc'
      };

      // Add filters
      if (filters.search) params.search = filters.search;
      if (filters.method) params.method = filters.method;
      if (filters.crawlSuccess) params.crawlSuccess = filters.crawlSuccess;

      const response = await getSites(params);

      let fetchedCrawls = response.data.data || [];

      // Group recursive crawl sessions
      const groupedCrawls = groupRecursiveSessions(fetchedCrawls);

      // Apply crawl type filter
      let filteredCrawls = groupedCrawls;
      if (filters.crawlType === 'single') {
        filteredCrawls = groupedCrawls.filter(c => !c.isSession);
      } else if (filters.crawlType === 'session') {
        filteredCrawls = groupedCrawls.filter(c => c.isSession);
      }

      // Apply date filters
      if (filters.dateFrom || filters.dateTo) {
        filteredCrawls = filteredCrawls.filter(crawl => {
          const crawlDate = new Date(crawl.createdAt);
          if (filters.dateFrom && crawlDate < new Date(filters.dateFrom)) return false;
          if (filters.dateTo && crawlDate > new Date(filters.dateTo + 'T23:59:59')) return false;
          return true;
        });
      }

      setCrawls(filteredCrawls);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 1,
        hasMore: response.data.pagination?.hasMore || false
      }));
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupRecursiveSessions = (crawls) => {
    const sessions = {};
    const singles = [];

    crawls.forEach(crawl => {
      if (crawl.crawlSessionId) {
        if (!sessions[crawl.crawlSessionId]) {
          sessions[crawl.crawlSessionId] = {
            ...crawl,
            isSession: true,
            sessionId: crawl.crawlSessionId,
            pageCount: 1,
            pages: [crawl]
          };
        } else {
          sessions[crawl.crawlSessionId].pageCount++;
          sessions[crawl.crawlSessionId].pages.push(crawl);
        }
      } else {
        singles.push({ ...crawl, isSession: false });
      }
    });

    return [...Object.values(sessions), ...singles];
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      method: '',
      crawlSuccess: '',
      crawlType: '',
      dateFrom: '',
      dateTo: ''
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (crawl) => {
    setItemToDelete(crawl);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setDeleting(true);

      if (itemToDelete.isSession) {
        // Delete all pages in the session
        for (const page of itemToDelete.pages) {
          await deleteSite(page._id);
        }
      } else {
        // Delete single crawl
        await deleteSite(itemToDelete._id);
      }

      // Refresh the list
      await fetchHistory();
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete crawl. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSessionClick = (sessionId) => {
    navigate(`/session/${sessionId}`);
  };

  if (loading && crawls.length === 0) {
    return (
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <div className="h-9 w-56 rounded-lg bg-dark-light shimmer mb-8" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-dark-light shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-10 max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3 animate-fade-in">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-primary/15 border border-primary/25">
          <HistoryIcon className="w-6 h-6 text-primary-soft" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Crawl history</h1>
          <p className="text-sm text-gray-400">Browse, filter and manage every crawl you&apos;ve run.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-500">
        {loading ? 'Loading…' : `Showing ${crawls.length} result${crawls.length !== 1 ? 's' : ''}`}
      </div>

      {/* Crawls List */}
      <div className="grid gap-5 stagger">
        {crawls.map((crawl) => (
          <div
            key={crawl._id}
            className="glass-card card-hover rounded-2xl p-6"
          >
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row">
              <div className="min-w-0 flex-1">
                {/* Session Badge */}
                {crawl.isSession && (
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary-soft">
                    <Layers className="w-3 h-3" />
                    Recursive session · {crawl.pageCount} pages
                  </div>
                )}

                <h3 className="truncate text-lg font-semibold text-white" title={crawl.title}>
                  {crawl.title || 'Untitled page'}
                </h3>
                <a
                  href={crawl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 flex items-center gap-1 truncate text-sm text-primary-soft hover:text-white transition-colors"
                >
                  <span className="truncate">{crawl.url}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>

              <div className="flex items-start gap-3">
                <div className="text-right font-mono text-xs text-gray-500">
                  {new Date(crawl.createdAt).toLocaleString()}
                </div>
                <button
                  onClick={() => handleDeleteClick(crawl)}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-danger/10 hover:text-danger"
                  title="Delete"
                >
                  <Trash2 className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-hairline bg-dark/50 p-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">Method</span>
                <span className={`font-mono ${
                  crawl.crawlerStats?.method === 'axios' ? 'text-success' : 'text-accent'
                }`}>
                  {crawl.crawlerStats?.method || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">Links</span>
                <span className="font-mono text-gray-300">{crawl.links?.length || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">Duration</span>
                <span className="font-mono text-gray-300">{crawl.crawlerStats?.duration || 0}ms</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">Status</span>
                <span className={`font-mono ${crawl.crawlSuccess ? 'text-success' : 'text-danger'}`}>
                  {crawl.crawlSuccess ? 'Success' : 'Failed'}
                </span>
              </div>
            </div>

            {/* Session Click or Expandable Details */}
            {crawl.isSession ? (
              <button
                onClick={() => handleSessionClick(crawl.sessionId)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-2.5 font-medium text-primary-soft transition-colors hover:bg-primary/20"
              >
                View session details
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <CrawlDetailsExpand
                crawl={crawl}
                isExpanded={expandedId === crawl._id}
                onToggle={() => setExpandedId(expandedId === crawl._id ? null : crawl._id)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {crawls.length === 0 && !loading && (
        <div className="glass-card rounded-2xl py-16 text-center animate-fade-in">
          <span className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-2xl bg-dark/60 border border-hairline">
            <HistoryIcon className="w-8 h-8 text-gray-600" />
          </span>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No crawls found</h3>
          <p className="text-gray-500">
            {Object.values(filters).some(v => v !== '')
              ? 'Try adjusting your filters.'
              : 'Start crawling websites to see them here.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {crawls.length > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          hasMore={pagination.hasMore}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete crawl"
        message={
          itemToDelete?.isSession
            ? `Are you sure you want to delete this recursive crawl session with ${itemToDelete.pageCount} pages? This action cannot be undone.`
            : 'Are you sure you want to delete this crawl? This action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />
    </div>
  );
};

export default History;
