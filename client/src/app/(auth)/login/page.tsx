import { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'تسجيل الدخول | AI Marketing',
  description: 'قم بتسجيل الدخول للوصول إلى منصة التسويق الذكية',
};

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full mb-6">
        <h3 className="text-xl font-bold text-[#f0f2f8] mb-2">تسجيل الدخول</h3>
        <p className="text-sm text-[#8b8fa8]">مرحباً بعودتك! الرجاء إدخال بياناتك للمتابعة.</p>
      </div>
      
      <LoginForm />
      
      <div className="mt-6 w-full text-center text-sm text-[#8b8fa8]">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-medium text-[#0d7e8a] hover:text-[#0a6b75] transition-colors">
          إنشاء حساب جديد
        </Link>
      </div>
    </div>
  );
}
