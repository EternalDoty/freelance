import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const { refreshToken } = useAuthStore.getState();
        
        if (refreshToken) {
          const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
            refreshToken
          });

          const { accessToken } = response.data.data;
          
          // Update store
          useAuthStore.getState().setTokens(accessToken, refreshToken);
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        window.location.href = '/auth/callback';
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    if (error.response?.status >= 500) {
      toast.error('Сервер временно недоступен. Попробуйте позже.');
    } else if (error.response?.status === 429) {
      toast.error('Слишком много запросов. Подождите немного.');
    } else if (error.response?.status === 403) {
      toast.error('Доступ запрещен.');
    } else if (error.response?.status === 404) {
      toast.error('Ресурс не найден.');
    }

    return Promise.reject(error);
  }
);

// Import useAuthStore after api is defined to avoid circular dependency
import { useAuthStore } from '../store/authStore';

// API endpoints
export const endpoints = {
  // Auth
  auth: {
    me: '/auth/me',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    profile: '/auth/profile',
  },
  
  // Users
  users: {
    list: '/users',
    get: (id: number) => `/users/${id}`,
    update: (id: number) => `/users/${id}`,
    ratings: (id: number) => `/users/${id}/ratings`,
  },
  
  // Tasks
  tasks: {
    list: '/tasks',
    get: (id: number) => `/tasks/${id}`,
    create: '/tasks',
    update: (id: number) => `/tasks/${id}`,
    delete: (id: number) => `/tasks/${id}`,
    proposals: (id: number) => `/tasks/${id}/proposals`,
  },
  
  // Proposals
  proposals: {
    list: '/proposals',
    get: (id: number) => `/proposals/${id}`,
    create: '/proposals',
    update: (id: number) => `/proposals/${id}`,
    delete: (id: number) => `/proposals/${id}`,
    accept: (id: number) => `/proposals/${id}/accept`,
    reject: (id: number) => `/proposals/${id}/reject`,
  },
  
  // Escrow
  escrow: {
    fund: '/escrow/fund',
    release: (id: number) => `/escrow/${id}/release`,
    refund: (id: number) => `/escrow/${id}/refund`,
    transactions: '/escrow/transactions',
    get: (id: number) => `/escrow/${id}`,
  },
  
  // Ratings
  ratings: {
    list: '/ratings',
    create: '/ratings',
    update: (id: number) => `/ratings/${id}`,
    delete: (id: number) => `/ratings/${id}`,
  },
  
  // Appeals
  appeals: {
    list: '/appeals',
    create: '/appeals',
    get: (id: number) => `/appeals/${id}`,
    update: (id: number) => `/appeals/${id}`,
  },
  
  // Support
  support: {
    tickets: '/support/tickets',
    create: '/support/tickets',
    get: (id: number) => '/support/tickets/${id}',
    update: (id: number) => '/support/tickets/${id}',
  },
  
  // Notifications
  notifications: {
    list: '/notifications',
    markRead: (id: number) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },
  
  // Admin
  admin: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
    tasks: '/admin/tasks',
    appeals: '/admin/appeals',
    blocks: '/admin/blocks',
    stats: '/admin/stats',
  },
};

// Helper functions
export const apiHelpers = {
  // Handle API errors
  handleError: (error: any) => {
    if (error.response?.data?.error) {
      return error.response.data.error.message;
    }
    return 'Произошла ошибка';
  },
  
  // Format API response
  formatResponse: (response: any) => {
    return response.data;
  },
  
  // Create query key for React Query
  createQueryKey: (endpoint: string, params?: any) => {
    return [endpoint, params];
  },
  
  // Get pagination info
  getPagination: (response: any) => {
    return response.data?.pagination || null;
  },
  
  // Get data from response
  getData: (response: any) => {
    return response.data?.data || response.data;
  },
};

// Export default api instance
export default api;
