'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api/auth';
import { handleError } from '@/lib/errorHandler';
import { useAuthStore } from '@/stores/authStore';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

const loginSchema = z.object({
  email: z.string().email({ message: 'البريد الإلكتروني غير صالح' }),
  password: z.string().min(6, { message: 'يجب أن لا تقل كلمة المرور عن 6 أحرف' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await login(data);
      setAuth(response.user, response.accessToken);
      router.push('/dashboard');
    } catch (error) {
      handleError(error, 'فشل تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/auth/google`;
  };

  return (
    <div className="space-y-4 w-full max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[#f0f2f8]">{t('email')}</Label>
        <Input 
          id="email" 
          type="email" 
          placeholder="name@example.com" 
          {...register('email')} 
          disabled={isLoading}
          dir="ltr"
          className="bg-[#22263a] border-[#2a2d3e] focus-visible:ring-[#0d7e8a] focus-visible:border-[#0d7e8a] text-[#f0f2f8] placeholder:text-[#8b8fa8]"
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-[#f0f2f8]">{t('password')}</Label>
          <a href="/forgot-password" className="text-sm text-[#0d7e8a] hover:text-[#0a6b75] hover:underline transition-colors">
            نسيت كلمة المرور؟
          </a>
        </div>
        <div className="relative">
          <Input 
            id="password" 
            type={showPassword ? "text" : "password"} 
            {...register('password')} 
            disabled={isLoading}
            dir="ltr"
            className="bg-[#22263a] border-[#2a2d3e] focus-visible:ring-[#0d7e8a] focus-visible:border-[#0d7e8a] text-[#f0f2f8] placeholder:text-[#8b8fa8] pr-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#8b8fa8] hover:text-[#f0f2f8] transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <Button type="button" onClick={handleSubmit(onSubmit)} className="w-full bg-[#0d7e8a] hover:bg-[#0a6b75] text-white transition-colors" disabled={isLoading}>
        {isLoading ? 'جاري التحميل...' : t('submit')}
      </Button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#2a2d3e]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#1a1d27] px-2 text-[#8b8fa8]">
            أو
          </span>
        </div>
      </div>

      <Button 
        type="button" 
        variant="outline" 
        className="w-full bg-[#22263a] border-[#2a2d3e] text-[#f0f2f8] hover:bg-[#2a2d3e] hover:text-white transition-colors flex items-center justify-center gap-2"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
        </svg>
        تسجيل الدخول باستخدام جوجل
      </Button>
    </div>
  );
}
