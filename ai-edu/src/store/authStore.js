import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

// Decode JWT to get user info (without verification - we trust the server)
const decodeToken = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded;
  } catch {
    return null;
  }
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Initialize from stored token
      init: () => {
        const state = get();
        if (state.token) {
          const decoded = decodeToken(state.token);
          if (decoded && decoded.exp * 1000 > Date.now()) {
            set({ user: { ...decoded }, isAuthenticated: true });
          } else {
            // Token expired, clear it
            get().logout();
          }
        }
      },

      // Login
      login: async (username, password, turnstileToken) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, turnstileToken })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || '登录失败');
          }

          const decoded = decodeToken(data.token);

          set({
            token: data.token,
            user: decoded,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });

          return { success: true };
        } catch (error) {
          set({
            isLoading: false,
            error: error.message
          });
          return { success: false, error: error.message };
        }
      },

      // Register
      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(get().token ? { Authorization: `Bearer ${get().token}` } : {})
            },
            body: JSON.stringify(userData)
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || '注册失败');
          }

          const decoded = decodeToken(data.token);

          set({
            token: data.token,
            user: decoded,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });

          return { success: true };
        } catch (error) {
          set({
            isLoading: false,
            error: error.message
          });
          return { success: false, error: error.message };
        }
      },

      // Logout
      logout: async () => {
        const token = get().token;

        // Try to add token to blacklist (ignore errors)
        if (token) {
          try {
            await fetch(`${API_URL}/api/auth/logout`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch {
            // Ignore logout API errors
          }
        }

        set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: null
        });
      },

      // Get current user from server
      fetchCurrentUser: async () => {
        const token = get().token;
        if (!token) return { success: false, error: 'No token' };

        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || '获取用户信息失败');
          }

          set({
            user: {
              ...get().user,
              ...data.user
            }
          });

          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      // Update user profile
      updateProfile: async (profileData) => {
        const token = get().token;
        if (!token) return { success: false, error: 'No token' };

        try {
          const response = await fetch(`${API_URL}/api/auth/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || '更新资料失败');
          }

          set({
            user: {
              ...get().user,
              ...data.user
            }
          });

          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      // Change password
      changePassword: async (currentPassword, newPassword) => {
        const token = get().token;
        if (!token) return { success: false, error: 'No token' };

        try {
          const response = await fetch(`${API_URL}/api/auth/password`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || '修改密码失败');
          }

          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Check if user has role
      hasRole: (role) => {
        const user = get().user;
        if (!user) return false;
        if (typeof role === 'string') {
          return user.role === role;
        }
        return role.includes(user.role);
      },

      // Check if user is admin
      isAdmin: () => get().user?.role === 'admin',

      // Check if user is teacher
      isTeacher: () => get().user?.role === 'teacher',

      // Check if user is student
      isStudent: () => get().user?.role === 'student',

      // Get auth header
      getAuthHeader: () => {
        const token = get().token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      }
    }),
    {
      name: 'ai-edu-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

// Initialize auth store on import
if (typeof window !== 'undefined') {
  useAuthStore.getState().init();
}