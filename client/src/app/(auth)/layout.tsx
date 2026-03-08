export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div 
      className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" 
      style={{ 
        backgroundColor: '#0f1117',
        backgroundImage: 'radial-gradient(ellipse at center, rgba(13,126,138,0.08) 0%, #0f1117 70%)'
      }}
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-[#f0f2f8] tracking-tight">
          منصة التسويق الذكية
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#1a1d27] py-8 px-4 shadow-[0_24px_64px_rgba(0,0,0,0.6)] sm:rounded-xl sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
