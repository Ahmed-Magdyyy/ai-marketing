import hotToast, { ToastOptions } from 'react-hot-toast';

const defaultOptions: ToastOptions = {
  duration: 4000,
  position: 'top-center',
  style: {
    fontFamily: 'var(--font-cairo)',
    borderRadius: '8px',
    background: '#333',
    color: '#fff',
  },
};

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return hotToast.success(message, { ...defaultOptions, ...options });
  },
  error: (message: string, options?: ToastOptions) => {
    return hotToast.error(message, { ...defaultOptions, ...options });
  },
  loading: (message: string, options?: ToastOptions) => {
    return hotToast.loading(message, { ...defaultOptions, ...options });
  },
  dismiss: (toastId?: string) => {
    hotToast.dismiss(toastId);
  },
};
