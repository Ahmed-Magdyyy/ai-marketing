import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-background">
      <h2 className="text-9xl font-black text-primary/20 mb-4">404</h2>
      <h3 className="text-2xl font-bold text-foreground mb-4">الصفحة غير موجودة</h3>
      <p className="text-lg text-muted-foreground mb-8 max-w-md">
        عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها. ربما تم نقلها أو حذفها.
      </p>
      <Link href="/">
        <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
          العودة للصفحة الرئيسية
        </button>
      </Link>
    </div>
  );
}
