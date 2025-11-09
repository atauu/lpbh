import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// Sistem görevlisi atama/güncelleme
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Sadece sistem görevlisi veya roles.update yetkisi olanlar bu işlemi yapabilir
    const permissions = (session as any)?.user?.permissions;
    const isSystemAdmin = (session as any)?.user?.isSystemAdmin;
    
    if (!isSystemAdmin && !hasPermission(permissions, 'roles', 'update')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, isSystemAdmin: shouldBeSystemAdmin } = body;

    if (!userId || typeof shouldBeSystemAdmin !== 'boolean') {
      return NextResponse.json(
        { error: 'Geçersiz parametreler' },
        { status: 400 }
      );
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Sistem görevlisi durumunu güncelle
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isSystemAdmin: shouldBeSystemAdmin,
      },
      select: {
        id: true,
        username: true,
        isSystemAdmin: true,
        rutbe: true,
      },
    });

    // Eğer sistem görevlisi yapıldıysa, tüm izinleri ver
    if (shouldBeSystemAdmin) {
      // Tüm izinleri içeren bir role oluştur veya bul
      const allPermissions = {
        users: {
          create: true,
          read: {
            enabled: true,
            readableFields: ['id', 'username', 'rutbe', 'membershipStatus', 'isim', 'soyisim', 'tckn', 'telefon', 'evAdresi', 'yakiniIsmi', 'yakiniTelefon', 'ruhsatSeriNo', 'kanGrubu', 'createdAt', 'updatedAt'],
          },
          update: true,
          delete: true,
        },
        userApproval: {
          approve: true,
          reject: true,
        },
        meetings: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        events: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        assignments: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        routes: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        roles: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        announcements: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        activityLogs: {
          read: true,
        },
        researches: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
        messages: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
      };

      // Sistem görevlisi rolü var mı kontrol et
      let systemAdminRole = await prisma.role.findFirst({
        where: {
          name: 'SYSTEM_ADMIN',
        },
      });

      // Yoksa oluştur
      if (!systemAdminRole) {
        // Önce ADMIN grubunu bul veya oluştur
        let adminGroup = await prisma.roleGroup.findFirst({
          where: { name: 'Yönetim' },
        });

        if (!adminGroup) {
          adminGroup = await prisma.roleGroup.create({
            data: {
              name: 'Yönetim',
              description: 'Sistem yöneticileri',
              order: 999,
            },
          });
        }

        systemAdminRole = await prisma.role.create({
          data: {
            name: 'SYSTEM_ADMIN',
            description: 'Sistem Görevlisi - Tüm yetkilere sahip',
            permissions: allPermissions,
            groupId: adminGroup.id,
          },
        });
      } else {
        // Rol varsa izinleri güncelle
        systemAdminRole = await prisma.role.update({
          where: { id: systemAdminRole.id },
          data: {
            permissions: allPermissions,
          },
        });
      }

      // Kullanıcıya bu rolü ata (rutbe alanını güncelle)
      await prisma.user.update({
        where: { id: userId },
        data: {
          rutbe: systemAdminRole.name,
        },
      });
    }

    // İşlem kaydını logla
    const userNameDisplay = session?.user?.username || '';
    const userFullName = session?.user?.isim && session?.user?.soyisim 
      ? `${session.user.isim} ${session.user.soyisim}` 
      : '';
    const targetUserName = user.username || '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'role_update', {
      targetUser: targetUserName,
      action: shouldBeSystemAdmin ? 'Sistem görevlisi yapıldı' : 'Sistem görevlisi yetkisi kaldırıldı',
    });
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'role_update',
      description,
      { userId, isSystemAdmin: shouldBeSystemAdmin },
      ipAddress,
      userAgent
    );

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: shouldBeSystemAdmin 
        ? 'Kullanıcı sistem görevlisi yapıldı ve tüm izinler verildi' 
        : 'Sistem görevlisi yetkisi kaldırıldı',
    });
  } catch (error: any) {
    console.error('System admin assignment error:', error);
    return NextResponse.json(
      { error: 'İşlem başarısız oldu', details: error?.message },
      { status: 500 }
    );
  }
}

// Sistem görevlisi durumunu sorgula
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Tüm kullanıcıları sistem görevlisi durumuyla birlikte getir
    const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          isSystemAdmin: true,
          rutbe: true,
        },
      orderBy: {
        username: 'asc',
      },
    });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('System admin fetch error:', error);
    return NextResponse.json(
      { error: 'Kullanıcılar yüklenemedi', details: error?.message },
      { status: 500 }
    );
  }
}
