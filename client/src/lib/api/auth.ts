import { apiClient } from './client';
import { User } from '@/stores/authStore';

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const login = async (data: any): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/login', data);
  return response.data.data;
};

export const registerUser = async (data: any): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/register', data);
  return response.data.data;
};

export const verifyEmail = async (data: any): Promise<any> => {
  const response = await apiClient.post('/auth/verify-email', data);
  return response.data;
};

export const resendVerificationEmail = async (data: any = {}): Promise<any> => {
  const response = await apiClient.post('/auth/resend-verification', data);
  return response.data;
};

export const forgotPassword = async (data: any): Promise<any> => {
  const response = await apiClient.post('/auth/forgot-password', data);
  return response.data;
};

export const resetPassword = async (data: any): Promise<any> => {
  const response = await apiClient.post('/auth/reset-password', data);
  return response.data;
};
