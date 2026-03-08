'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { resetPassword } from '@/lib/api/auth';
import { handleError } from '@/lib/errorHandler';

const resetPasswordSchema = z.object({
  password: z.string().min(6, { message: 'يجب أن لا تقل كلمة المرور عن 6 أحرف' }),
  confirmPassword: z.string().min(6, { message: 'يجب تأكيد كلمة المرور' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      await resetPassword(data);
      toast.success('تم تغيير كلمة المرور بنجاح');
      window.location.href = '/login';
    } catch (error) {
      handleError(error, 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full mb-6">
        <h3 className="text-xl font-bold text-[#f0f2f8] mb-2">عين كلمة مرور جديدة</h3>
        <p className="text-sm text-[#8b8fa8]">يرجى إدخال كلمة المرور الجديدة وتأكيدها أدناه.</p>
      </div>

      <div className="space-y-4 w-full">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-[#f0f2f8]">كلمة المرور الجديدة</Label>
          <Input 
            id="password" 
            type="password" 
            dir="ltr"
            {...register('password')} 
            disabled={isLoading}
            className="bg-[#22263a] border-[#2a2d3e] focus-visible:ring-[#0d7e8a] focus-visible:border-[#0d7e8a] text-[#f0f2f8] placeholder:text-[#8b8fa8]"
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-[#f0f2f8]">تأكيد كلمة المرور الجديدة</Label>
          <Input 
            id="confirmPassword" 
            type="password" 
            dir="ltr"
            {...register('confirmPassword')} 
            disabled={isLoading}
            className="bg-[#22263a] border-[#2a2d3e] focus-visible:ring-[#0d7e8a] focus-visible:border-[#0d7e8a] text-[#f0f2f8] placeholder:text-[#8b8fa8]"
          />
          {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="button" onClick={handleSubmit(onSubmit)} className="w-full bg-[#0d7e8a] hover:bg-[#0a6b75] text-white transition-colors" disabled={isLoading}>
          {isLoading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
        </Button>
      </div>
    </div>
  );
}
