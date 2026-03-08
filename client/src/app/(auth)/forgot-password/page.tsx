'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { forgotPassword } from '@/lib/api/auth';
import { handleError } from '@/lib/errorHandler';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'البريد الإلكتروني غير صالح' }),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await forgotPassword(data);
      setIsSubmitted(true);
      toast.success('تم إرسال رابط استعادة كلمة المرور');
    } catch (error) {
      handleError(error, 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Mail className="w-8 h-8 text-[#0d7e8a]" />
        </div>
        <h3 className="text-xl font-bold text-[#f0f2f8] mb-4">تحقق من بريدك الإلكتروني</h3>
        <p className="text-sm text-[#8b8fa8] mb-8">
          لقد أرسلنا رابط استعادة كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد (وأحياناً صندوق الرسائل غير المرغوب فيها).
        </p>
        <Link href="/login" className="w-full">
          <Button variant="outline" className="w-full bg-[#22263a] border-[#2a2d3e] text-[#f0f2f8] hover:bg-[#2a2d3e] hover:text-white transition-colors">
            العودة لتسجيل الدخول
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full mb-6">
        <h3 className="text-xl font-bold text-[#f0f2f8] mb-2">نسيت كلمة المرور؟</h3>
        <p className="text-sm text-[#8b8fa8]">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.</p>
      </div>

      <div className="space-y-4 w-full">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[#f0f2f8]">البريد الإلكتروني</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="name@example.com" 
            dir="ltr"
            {...register('email')} 
            disabled={isLoading}
            className="bg-[#22263a] border-[#2a2d3e] focus-visible:ring-[#0d7e8a] focus-visible:border-[#0d7e8a] text-[#f0f2f8] placeholder:text-[#8b8fa8]"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="button" onClick={handleSubmit(onSubmit)} className="w-full bg-[#0d7e8a] hover:bg-[#0a6b75] text-white transition-colors" disabled={isLoading}>
          {isLoading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
        </Button>
      </div>

      <div className="mt-6 w-full text-center text-sm text-[#8b8fa8]">
        تذكرت كلمة المرور؟{' '}
        <Link href="/login" className="font-medium text-[#0d7e8a] hover:text-[#0a6b75] transition-colors hover:underline">
          تسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
