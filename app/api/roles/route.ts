import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tüm rütbeleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const roles = await prisma.role.findMany({
      include: {
        group: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error('Roles fetch error:', error);
    return NextResponse.json(
      { error: 'Rütbeler yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Yeni rütbe ekle
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
    const userPermissions = (session as any)?.user?.permissions;
    if (!hasPermission(userPermissions, 'roles', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description: roleDescription, permissions, groupId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Rütbe adı zorunludur' },
        { status: 400 }
      );
    }

    // Rütbe adının benzersiz olduğunu kontrol et
    const existingRole = await prisma.role.findUnique({
      where: { name: name.trim() },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'Bu rütbe adı zaten kullanılıyor' },
        { status: 400 }
      );
    }

    // Default permissions (tüm izinler false)
    const defaultPermissions = {
      users: { create: false, read: false, update: false, delete: false },
      meetings: { create: false, read: false, update: false, delete: false },
      events: { create: false, read: false, update: false, delete: false },
      assignments: { create: false, read: false, update: false, delete: false },
      routes: { create: false, read: false, update: false, delete: false },
      roles: { create: false, read: false, update: false, delete: false },
    };

    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        description: roleDescription?.trim() || null,
        permissions: permissions || defaultPermissions,
        groupId: groupId || null,
      },
    });

    // Rütbe oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'role_create');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'role_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error('Role creation error:', error);
    return NextResponse.json(
      { error: 'Rütbe oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

