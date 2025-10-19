import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: number;
  github_id: string;
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  profile_data: {
    name?: string;
    bio?: string;
    location?: string;
    skills?: string[];
    experience?: string;
    portfolio?: string[];
  };
  rating: number;
  total_tasks: number;
  total_earnings: number;
  is_verified: boolean;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Actions
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      },

      setUser: (user) => {
        set({ user });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },

      login: async (accessToken, refreshToken) => {
        try {
          set({ isLoading: true, error: null });
          
          // Set tokens
          get().setTokens(accessToken, refreshToken);
          
          // Fetch user data
          const response = await api.get('/auth/me');
          const user = response.data.data;
          
          set({ user, isLoading: false });
        } catch (error: any) {
          console.error('Login error:', error);
          set({ 
            error: error.response?.data?.error?.message || 'Login failed',
            isLoading: false,
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null
          });
          delete api.defaults.headers.common['Authorization'];
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
        delete api.defaults.headers.common['Authorization'];
      },

      refreshAccessToken: async () => {
        try {
          const { refreshToken } = get();
          
          if (!refreshToken) {
            get().logout();
            return false;
          }

          const response = await api.post('/auth/refresh', {
            refreshToken
          });

          const { accessToken: newAccessToken } = response.data.data;
          
          set({ accessToken: newAccessToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          
          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return false;
        }
      },

      updateUser: (userData) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user
      })
    }
  )
);

// Initialize auth state on app start
export const initializeAuth = async () => {
  const { accessToken, refreshToken, isAuthenticated, setLoading } = useAuthStore.getState();
  
  if (isAuthenticated && accessToken) {
    try {
      // Set authorization header
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      // Verify token by fetching user data
      const response = await api.get('/auth/me');
      const user = response.data.data;
      
      useAuthStore.getState().setUser(user);
    } catch (error) {
      console.error('Auth initialization failed:', error);
      
      // Try to refresh token
      const refreshed = await useAuthStore.getState().refreshAccessToken();
      
      if (!refreshed) {
        useAuthStore.getState().logout();
      }
    }
  }
  
  setLoading(false);
};
