import { Metadata } from 'next';
import { buttonVariants } from '@/components/ui/button';
import { Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'حساب محظور | AI Marketing',
  description: 'حسابك محظور بشكل دائم',
};

export default function BannedPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <Ban className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-4">تم حظر حسابك</h3>
      <p className="text-sm text-muted-foreground mb-8">
        لأسف، لقد تم حظر حسابك بشكل دائم بسبب انتهاك شروط الخدمة الخاصة بمنصتنا. لا يمكن استعادة الحسابات المحظورة.
      </p>
      
      <a 
        href="mailto:appeals@aimarketing.com" 
        className={cn(buttonVariants({ variant: "destructive" }), "w-full")}
      >
        تقديم استئناف
      </a>
    </div>
  );
}
