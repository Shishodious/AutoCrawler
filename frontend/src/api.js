import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
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
export const startCrawl = (url, options = {}) => 
  api.post('/crawl', { url, options });

export const startRecursiveCrawl = (url, options = {}) => 
  api.post('/crawl/recursive', { url, options });

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
