import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended' | 'banned' | 'unverified';
  createdAt: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, token) =>
    set({ user, accessToken: token, isAuthenticated: true }),

  setToken: (token) =>
    set((state) => ({ ...state, accessToken: token })),

  setUser: (user) =>
    set((state) => ({ ...state, user })),

  logout: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),
}));

// Helpful vanilla getter for outside of React (like Axios interceptors)
export const getAuthToken = () => useAuthStore.getState().accessToken;
export const clearAuth = () => useAuthStore.getState().logout();
