import { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'حساب موقوف | AI Marketing',
  description: 'حسابك موقوف حالياً',
};

export default function SuspendedPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-yellow-600" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-4">تم إيقاف حسابك مؤقتاً</h3>
      <p className="text-sm text-muted-foreground mb-8">
        لقد تم إيقاف حسابك مؤقتاً لمراجعة بعض النشاطات ولضمان سلامة المنصة. يرجى التواصل مع فريق الدعم الفني لمعرفة المزيد ولحل هذه المشكلة.
      </p>
      
      <div className="space-y-3 w-full">
        <a 
          href="mailto:support@aimarketing.com"
          className={cn(buttonVariants({ variant: "default" }), "w-full")}
        >
          تواصل مع الدعم الفني
        </a>
        <Link 
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          العودة لتسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
