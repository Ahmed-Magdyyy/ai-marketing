import axios from 'axios';
import { getAuthToken, clearAuth } from '@/stores/authStore';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For httpOnly cookies like refresh tokens
});

// Request Interceptor: Attach access token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle global errors & token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized for token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Assume backend has a /auth/refresh endpoint relying on httpOnly cookies
        const refreshResponse = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = refreshResponse.data.data;
        
        // Update the token in our zustand store
        // We'll dispatch this implicitly or the caller will handle it, 
        // but for now we just mutate headers.
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        // Re-run original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, force logout
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
