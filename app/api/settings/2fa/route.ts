import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/settings/2fa - 2FA global ayarını getir
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sadece sistem admini görebilir
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSystemAdmin: true },
    });

    if (!user?.isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden - Only system admins can view settings' }, { status: 403 });
    }

    // 2FA ayarını getir - cache'i bypass etmek için raw query kullan
    const settingResult = await prisma.$queryRaw<Array<{ value: string; updated_at: Date; updated_by: string | null }>>`
      SELECT value, updated_at, updated_by FROM system_settings WHERE key = 'twoFactorEnabled' LIMIT 1
    `;
    
    const isEnabled = settingResult.length > 0 && settingResult[0].value === 'true';
    const setting = settingResult.length > 0 ? {
      value: settingResult[0].value,
      updatedAt: settingResult[0].updated_at,
      updatedBy: settingResult[0].updated_by,
    } : null;

    return NextResponse.json({
      enabled: isEnabled,
      updatedAt: setting?.updatedAt,
      updatedBy: setting?.updatedBy,
    });
  } catch (error) {
    console.error('Get 2FA setting error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/settings/2fa - 2FA global ayarını güncelle
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sadece sistem admini güncelleyebilir
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSystemAdmin: true },
    });

    if (!user?.isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden - Only system admins can update settings' }, { status: 403 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request - enabled must be a boolean' }, { status: 400 });
    }

    // Ayarı güncelle veya oluştur - transaction kullanarak cache'i bypass et
    const setting = await prisma.$transaction(async (tx) => {
      // Önce mevcut ayarı kontrol et
      const existing = await tx.systemSettings.findUnique({
        where: { key: 'twoFactorEnabled' },
      });

      if (existing) {
        // Güncelle
        return await tx.systemSettings.update({
          where: { key: 'twoFactorEnabled' },
          data: {
            value: enabled.toString(),
            updatedBy: session.user.id,
          },
        });
      } else {
        // Oluştur
        return await tx.systemSettings.create({
          data: {
            key: 'twoFactorEnabled',
            value: enabled.toString(),
            updatedBy: session.user.id,
          },
        });
      }
    });

    // Activity log
    const activityDescription = `İki faktörlü doğrulama (2FA) ${enabled ? 'aktif' : 'pasif'} edildi`;
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'settings_update',
        description: activityDescription,
      },
    });

    // Prisma Client cache'ini temizlemek için connection'ı refresh et (isteğe bağlı, genellikle gerekmez)
    // Bu satır opsiyonel - raw query kullandığımız için zaten cache bypass ediliyor
    // await prisma.$disconnect();
    // await prisma.$connect();

    return NextResponse.json({
      success: true,
      enabled: setting.value === 'true',
      updatedAt: setting.updatedAt,
    });
  } catch (error) {
    console.error('Update 2FA setting error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

