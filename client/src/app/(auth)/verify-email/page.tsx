'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { verifyEmail, resendVerificationEmail } from '@/lib/api/auth';
import { handleError } from '@/lib/errorHandler';

const otpSchema = z.object({
  code: z.string().length(6, { message: 'يجب أن يتكون الرمز من 6 أرقام' }),
});

type OtpFormData = z.infer<typeof otpSchema>;

export default function VerifyEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const { register, handleSubmit, formState: { errors } } = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const onSubmit = async (data: OtpFormData) => {
    setIsLoading(true);
    try {
      await verifyEmail(data);
      toast.success('تم تأكيد البريد الإلكتروني بنجاح');
      window.location.href = '/dashboard';
    } catch (error) {
      handleError(error, 'رمز التحقق غير صحيح');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerificationEmail();
      setCountdown(60);
      toast.success('تم إرسال رمز جديد');
    } catch (error) {
      handleError(error, 'فشل إرسال رمز جديد');
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full mb-6">
        <h3 className="text-xl font-bold text-[#f0f2f8] mb-2">تأكيد البريد الإلكتروني</h3>
        <p className="text-sm text-[#8b8fa8]">لقد قمنا بإرسال رمز تحقق مكون من 6 أرقام إلى بريدك الإلكتروني.</p>
      </div>

      <div className="space-y-4 w-full">
        <div className="space-y-2">
          <Label htmlFor="code" className="text-[#f0f2f8]">رمز التحقق</Label>
          <Input 
            id="code" 
            placeholder="000000"
            className="text-center text-lg tracking-[0.5em] bg-[#22263a] border-[#2a2d3e] focus-visible:ring-[#0d7e8a] focus-visible:border-[#0d7e8a] text-[#f0f2f8] placeholder:text-[#8b8fa8]"
            maxLength={6}
            dir="ltr"
            {...register('code')} 
            disabled={isLoading}
          />
          {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
        </div>

        <Button type="button" onClick={handleSubmit(onSubmit)} className="w-full bg-[#0d7e8a] hover:bg-[#0a6b75] text-white transition-colors" disabled={isLoading}>
          {isLoading ? 'جاري التحقق...' : 'تأكيد الرمز'}
        </Button>
      </div>

      <div className="mt-6 w-full text-center text-sm text-[#8b8fa8]">
        لم يصلك الرمز؟{' '}
        <button 
          onClick={handleResend}
          disabled={countdown > 0}
          className="font-medium text-[#0d7e8a] hover:text-[#0a6b75] transition-colors hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {countdown > 0 ? `إعادة الإرسال بعد ${countdown}ث` : 'إرسال رمز جديد'}
        </button>
      </div>
    </div>
  );
}
