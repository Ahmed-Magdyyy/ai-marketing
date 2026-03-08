import { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/RegisterForm';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'إنشاء حساب | AI Marketing',
  description: 'قم بإنشاء حساب جديد للبدء مع منصة التسويق الذكية',
};

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full mb-6">
        <h3 className="text-xl font-bold text-foreground mb-2">إنشاء حساب جديد</h3>
        <p className="text-sm text-muted-foreground">ابدأ رحلتك الآن وقم بإدارة حملاتك التسويقية بذكاء.</p>
      </div>
      
      <RegisterForm />
      
      <div className="mt-6 w-full text-center text-sm text-muted-foreground">
        لديك حساب بالفعل؟{' '}
        <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
          تسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
