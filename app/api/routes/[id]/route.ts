import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// DELETE: Rotayı sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    if (!hasPermission(permissions, 'routes', 'delete')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const routeId = params.id;

    const route = await prisma.route.findUnique({
      where: { id: routeId },
      select: {
        name: true,
      },
    });

    if (!route) {
      return NextResponse.json(
        { error: 'Rota bulunamadı' },
        { status: 404 }
      );
    }

    await prisma.route.delete({
      where: { id: routeId },
    });

    // Rota silme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'route_delete');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'route_delete',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      { message: `"${route.name}" başlıklı rota başarıyla silindi.` },
      { status: 200 }
    );
  } catch (error) {
    console.error('Route deletion error:', error);
    return NextResponse.json(
      { error: 'Rota silinemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

