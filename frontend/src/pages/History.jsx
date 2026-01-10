import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSites, deleteSite } from '../api';
import { Calendar, ExternalLink, Trash2, Layers } from 'lucide-react';
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
      
      // Handle crawl type filter (single vs session)
      // Note: This is a client-side filter since backend doesn't have this specific filter
      
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 text-white flex items-center gap-3">
        <Calendar className="w-8 h-8 text-primary" />
        Crawl History
      </h1>

      {/* Filter Bar */}
      <FilterBar 
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Results Count */}
      <div className="mb-4 text-gray-400 text-sm">
        {loading ? 'Loading...' : `Showing ${crawls.length} result${crawls.length !== 1 ? 's' : ''}`}
      </div>

      {/* Crawls List */}
      <div className="grid gap-6">
        {crawls.map((crawl) => (
          <div 
            key={crawl._id} 
            className="bg-dark-light rounded-xl p-6 border border-gray-700 hover:border-primary/30 transition-colors"
          >
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
              <div className="flex-1">
                {/* Session Badge */}
                {crawl.isSession && (
                  <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold mb-2">
                    <Layers className="w-3 h-3" />
                    Recursive Session ({crawl.pageCount} pages)
                  </div>
                )}
                
                <h3 className="text-xl font-semibold text-white mb-1">{crawl.title.length > 25
                    ? crawl.title.slice(0, 10) + '...'
                    : crawl.title}</h3>
                <a 
                  href={crawl.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  {crawl.url} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="text-gray-400 text-sm font-mono text-right">
                  {new Date(crawl.createdAt).toLocaleString()}
                </div>
                <button
                  onClick={() => handleDeleteClick(crawl)}
                  className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-900/20 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="bg-dark rounded-lg p-4 border border-gray-800 mb-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Method:</span>
                  <span className={`ml-2 font-mono ${
                    crawl.crawlerStats?.method === 'axios' ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {crawl.crawlerStats?.method || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Links:</span>
                  <span className="text-gray-300 ml-2 font-mono">{crawl.links?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-gray-300 ml-2 font-mono">{crawl.crawlerStats?.duration || 0}ms</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 font-mono ${
                    crawl.crawlSuccess ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {crawl.crawlSuccess ? 'Success' : 'Failed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Session Click or Expandable Details */}
            {crawl.isSession ? (
              <button
                onClick={() => handleSessionClick(crawl.sessionId)}
                className="w-full bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-lg font-medium transition-colors"
              >
                View Session Details
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
        <div className="text-center py-12 bg-dark-light rounded-xl border border-gray-700">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No Crawls Found</h3>
          <p className="text-gray-500">
            {Object.values(filters).some(v => v !== '') 
              ? 'Try adjusting your filters' 
              : 'Start crawling websites to see them here'}
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
        title="Delete Crawl"
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
