import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tüm rotaları listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const routes = await prisma.route.findMany({
      select: {
        id: true,
        name: true,
        startPoint: true,
        endPoint: true,
        url: true,
        waypoints: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Routes fetch error:', error);
    return NextResponse.json(
      { error: 'Rotalar yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Yeni rota ekle
export async function POST(request: NextRequest) {
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
    if (!hasPermission(permissions, 'routes', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, startPoint, endPoint, url, waypoints } = body;

    if (!name || !startPoint || !endPoint || !url) {
      return NextResponse.json(
        { error: 'Rota ismi, kalkış noktası, varış noktası ve URL zorunludur' },
        { status: 400 }
      );
    }

    // Waypoints array'i formatı: [{name: string, googleMapsLink: string | null}]
    const formattedWaypoints = Array.isArray(waypoints) 
      ? waypoints.map((wp: any) => ({
          name: wp.name || '',
          googleMapsLink: wp.googleMapsLink || null,
        }))
      : [];

    const route = await prisma.route.create({
      data: {
        name,
        startPoint,
        endPoint,
        url,
        waypoints: formattedWaypoints,
        createdBy: session.user.id,
      },
      select: {
        id: true,
        name: true,
        startPoint: true,
        endPoint: true,
        url: true,
        waypoints: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Rota oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'route_create');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'route_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    console.error('Route creation error:', error);
    return NextResponse.json(
      { error: 'Rota oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
