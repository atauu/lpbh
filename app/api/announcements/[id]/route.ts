import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tek bir duyuru detayını getir
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

    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
            rutbe: true,
          },
        },
      },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: 'Duyuru bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(announcement);
  } catch (error) {
    console.error('Announcement fetch error:', error);
    return NextResponse.json(
      { error: 'Duyuru yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT: Duyuruyu güncelle
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
    const permissions = (session as any)?.user?.permissions;
    if (!hasPermission(permissions, 'announcements', 'update')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, visibility, importance, isScheduled, scheduledAt, notifyBefore } = body;

    // Sadece oluşturan güncelleyebilir
    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: 'Duyuru bulunamadı' },
        { status: 404 }
      );
    }

    if (announcement.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Bu duyuruyu sadece oluşturan güncelleyebilir' },
        { status: 403 }
      );
    }

    // Planlı duyuru kontrolü
    let announcementStatus = announcement.status;
    let finalScheduledAt: Date | null = announcement.scheduledAt;
    
    if (isScheduled !== undefined) {
      if (isScheduled && scheduledAt) {
        const scheduledDate = new Date(scheduledAt);
        const now = new Date();
        
        if (scheduledDate <= now) {
          return NextResponse.json(
            { error: 'Planlı duyuru tarihi gelecekte olmalıdır' },
            { status: 400 }
          );
        }
        
        announcementStatus = 'scheduled';
        finalScheduledAt = scheduledDate;
      } else if (!isScheduled) {
        announcementStatus = 'published';
        finalScheduledAt = null;
      }
    }

    const updatedAnnouncement = await prisma.announcement.update({
      where: { id: params.id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(visibility && { visibility }),
        ...(importance && { importance }),
        ...(isScheduled !== undefined && { 
          status: announcementStatus,
          scheduledAt: finalScheduledAt,
          notifyBefore: notifyBefore !== undefined ? notifyBefore : announcement.notifyBefore,
        }),
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
            rutbe: true,
          },
        },
      },
    });

    // Duyuru güncelleme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'announcement_update');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'announcement_update',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(updatedAnnouncement);
  } catch (error) {
    console.error('Announcement update error:', error);
    return NextResponse.json(
      { error: 'Duyuru güncellenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: Duyuruyu sil
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
    if (!hasPermission(permissions, 'announcements', 'delete')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    // Sadece oluşturan silebilir
    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: 'Duyuru bulunamadı' },
        { status: 404 }
      );
    }

    if (announcement.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Bu duyuruyu sadece oluşturan silebilir' },
        { status: 403 }
      );
    }

    await prisma.announcement.delete({
      where: { id: params.id },
    });

    // Duyuru silme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'announcement_delete');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'announcement_delete',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      { message: 'Duyuru başarıyla silindi.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Announcement deletion error:', error);
    return NextResponse.json(
      { error: 'Duyuru silinemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
