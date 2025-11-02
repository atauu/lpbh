import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tek bir rütbe detayını getir
export async function GET(
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

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        group: true,
      },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Rütbe bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(role);
  } catch (error) {
    console.error('Role fetch error:', error);
    return NextResponse.json(
      { error: 'Rütbe yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT
export async function PUT(
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
    const userPermissions = (session as any)?.user?.permissions;
    if (!hasPermission(userPermissions, 'roles', 'update')) {
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

    // Mevcut rütbeyi kontrol et
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Rütbe bulunamadı' },
        { status: 404 }
      );
    }

    // Eğer isim değiştiyse, yeni ismin benzersiz olduğunu kontrol et
    if (name.trim() !== existingRole.name) {
      const nameExists = await prisma.role.findUnique({
        where: { name: name.trim() },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'Bu rütbe adı zaten kullanılıyor' },
          { status: 400 }
        );
      }
    }

    const role = await prisma.role.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        description: roleDescription?.trim() || null,
        permissions: permissions || existingRole.permissions,
        groupId: groupId !== undefined ? (groupId || null) : existingRole.groupId,
      },
      include: {
        group: true,
      },
    });

    // Rütbe güncelleme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'role_update');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'role_update',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(role, { status: 200 });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json(
      { error: 'Rütbe güncellenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: Rütbeyi sil
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
    if (!hasPermission(permissions, 'roles', 'delete')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: params.id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Rütbe bulunamadı' },
        { status: 404 }
      );
    }

    // Bu rütbeyi kullanan kullanıcı var mı kontrol et
    const usersWithRole = await prisma.user.findFirst({
      where: { rutbe: existingRole.name },
    });

    if (usersWithRole) {
      return NextResponse.json(
        { error: 'Bu rütbeyi kullanan kullanıcılar var. Önce kullanıcıların rütbelerini değiştirin.' },
        { status: 400 }
      );
    }

    await prisma.role.delete({
      where: { id: params.id },
    });

    // Rütbe silme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'role_delete');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'role_delete',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      { message: 'Rütbe başarıyla silindi.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Role deletion error:', error);
    return NextResponse.json(
      { error: 'Rütbe silinemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

