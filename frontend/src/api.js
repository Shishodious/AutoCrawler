import axios from 'axios';

const api = axios.create({
  // Defaults to production; override with VITE_API_URL (e.g. in .env.local) for local dev
  baseURL: import.meta.env.VITE_API_URL || 'https://autocrawler-1.onrender.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// Crawl Operations
// ============================================
// Start a single-page crawl
export const startCrawl = async (url, options = {}, socketId = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Add socket ID header if provided
  if (socketId) {
    headers['X-Socket-ID'] = socketId;
  }
  
  const response = await api.post('/crawl', { url, options }, { headers });
  return response.data;
};

export const startRecursiveCrawl = async (url, options = {}, socketId = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Add socket ID header if provided
  if (socketId) {
    headers['X-Socket-ID'] = socketId;
  }
  
  const response = await api.post('/crawl/recursive', { url, options }, { headers });
  return response.data;
};

// Fetch status/result of a queued crawl job
export const getCrawlJob = (jobId) =>
  api.get(`/crawl/jobs/${jobId}`);

// ============================================
// Extraction Operations
// ============================================
export const startExtract = async (payload, socketId = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (socketId) headers['X-Socket-ID'] = socketId;
  const response = await api.post('/extract', payload, { headers });
  return response.data;
};

export const getExtractTemplates = () => api.get('/extract/templates');
export const createExtractTemplate = (payload) => api.post('/extract/templates', payload);
export const deleteExtractTemplate = (id) => api.delete(`/extract/templates/${id}`);

// Report/export — returns the raw URL for downloads (auth via header interceptor for json;
// for file downloads we fetch as blob)
export const getReportUrl = (siteId, format) => `/sites/${siteId}/report?format=${format}`;
export const downloadReport = (siteId, format) =>
  api.get(`/sites/${siteId}/report?format=${format}`, {
    responseType: format === 'json' ? 'json' : 'blob',
  });

// ============================================
// Sites/History Operations
// ============================================
export const getSites = (params = {}) => 
  api.get('/sites', { params });

export const getSiteById = (id) => 
  api.get(`/sites/${id}`);

export const deleteSite = (id) => 
  api.delete(`/sites/${id}`);

// ============================================
// Session Operations
// ============================================
export const getSession = (sessionId) => 
  api.get(`/crawl/sessions/${sessionId}`);

// ============================================
// Statistics
// ============================================
export const getStats = () => 
  api.get('/stats');

export default api;
