import DashboardLayout from '@/components/DashboardLayout';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="text-gray-400">Yükleniyor...</div></div>}>
        {children}
      </Suspense>
    </DashboardLayout>
  );
}

