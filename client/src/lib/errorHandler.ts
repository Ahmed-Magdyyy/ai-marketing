import { toast } from './toast';
import { ErrorCode } from './errorCodes';
import { ApiResponse } from '@/types/api';
import { isAxiosError } from 'axios';

export const handleError = (error: unknown, fallbackMessage = 'An unexpected error occurred') => {
  if (isAxiosError(error)) {
    const data = error.response?.data as ApiResponse | undefined;
    
    if (data?.error) {
      const code = data.error.code as ErrorCode;
      
      switch (code) {
        case ErrorCode.UNAUTHORIZED:
          // Usually handled by generic axios interceptors for redirect,
          // but can emit a toast here if preferred.
          break;
        case ErrorCode.ACCOUNT_SUSPENDED:
          toast.error('Your account is suspended. Please contact support.');
          break;
        case ErrorCode.ACCOUNT_BANNED:
          toast.error('Your account has been banned.');
          break;
        default:
          toast.error(data.error.message || fallbackMessage);
          break;
      }
      return data.error;
    }
  }

  // Handle generic / non-axios errors
  console.error("Unhanded Error:", error);
  toast.error(fallbackMessage);
  
  return null;
};
