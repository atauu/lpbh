import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tüm duyuruları listele (visibility'e göre filtrelenmiş)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Kullanıcının rütbesini ve grubunu al
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        // Rütbe bilgisini al (rutbe string olarak saklanıyor, Role modeline göre bul)
      },
    });

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    if (!user || !user.rutbe) {
      return NextResponse.json(
        { error: 'Kullanıcı rütbesi bulunamadı' },
        { status: 400 }
      );
    }

    // Rütbeyi bul ve grubunu al
    const role = await prisma.role.findUnique({
      where: { name: user.rutbe },
      include: {
        group: true,
      },
    });

    if (!role || !role.group) {
      // Grup yoksa sadece herkes için olanları göster
    // Planlı duyuruları kontrol et ve yayınla (scheduledAt geçmişte olanlar)
    const now = new Date();
    await prisma.announcement.updateMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now,
        },
      },
      data: {
        status: 'published',
      },
    });

    // Planlı duyuruları al (sadece yayınlananlar ve kullanıcının oluşturduğu planlı duyurular)
    const announcements = await prisma.announcement.findMany({
      where: {
        visibility: 'herkes',
        OR: [
          { status: 'published' },
          {
            status: 'scheduled',
            scheduledAt: {
              lte: now,
            },
          },
          // notifyBefore etkin olan planlı duyuruları (gelecekte olsa bile) HERKESE göster
          {
            status: 'scheduled',
            notifyBefore: true,
            scheduledAt: {
              gt: now,
            },
          },
          {
            status: 'scheduled',
            createdBy: session.user.id, // Kullanıcının oluşturduğu planlı duyurular
          },
        ],
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
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json(announcements);
    }

    const userGroupOrder = role.group.order;
    let allowedVisibilities: string[] = [];

    // Visibility mantığı:
    // order 2 (Yönetim) -> yönetim, member, herkes (tümünü görebilmeli)
    // order 1 (Member) -> member, herkes (yönetim ve member görünür olmalı)
    // order 0 (Aday) -> herkes (herkes görünür olmalı)
    if (userGroupOrder === 2) {
      allowedVisibilities = ['herkes', 'member', 'yönetim'];
    } else if (userGroupOrder === 1) {
      allowedVisibilities = ['herkes', 'member'];
    } else {
      allowedVisibilities = ['herkes'];
    }

    // Planlı duyuruları kontrol et ve yayınla (scheduledAt geçmişte olanlar)
    const now = new Date();
    await prisma.announcement.updateMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now,
        },
      },
      data: {
        status: 'published',
      },
    });

    // Planlı duyuruları al (sadece yayınlananlar ve kullanıcının oluşturduğu planlı duyurular)
    const announcements = await prisma.announcement.findMany({
      where: {
        visibility: {
          in: allowedVisibilities,
        },
        OR: [
          { status: 'published' },
          {
            status: 'scheduled',
            scheduledAt: {
              lte: now,
            },
          },
          // notifyBefore etkin olan planlı duyuruları (gelecekte olsa bile) görünür kıl
          {
            status: 'scheduled',
            notifyBefore: true,
            scheduledAt: {
              gt: now,
            },
          },
          {
            status: 'scheduled',
            createdBy: session.user.id, // Kullanıcının oluşturduğu planlı duyurular
          },
        ],
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
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json(announcements);
  } catch (error) {
    console.error('Announcements fetch error:', error);
    return NextResponse.json(
      { error: 'Duyurular yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Yeni duyuru oluştur
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
    if (!hasPermission(permissions, 'announcements', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, visibility, importance, isScheduled, scheduledAt, notifyBefore } = body;

    if (!title || !content || !visibility) {
      return NextResponse.json(
        { error: 'Başlık, içerik ve görünürlük zorunludur' },
        { status: 400 }
      );
    }

    if (!['yönetim', 'member', 'herkes'].includes(visibility)) {
      return NextResponse.json(
        { error: 'Geçersiz görünürlük değeri' },
        { status: 400 }
      );
    }

    if (importance && !['düşük', 'normal', 'yüksek'].includes(importance)) {
      return NextResponse.json(
        { error: 'Geçersiz önem seviyesi değeri' },
        { status: 400 }
      );
    }

    // Planlı duyuru kontrolü
    let announcementStatus = 'published';
    let finalScheduledAt: Date | null = null;
    
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
    }

    const newAnnouncement = await prisma.announcement.create({
      data: {
        title,
        content,
        visibility,
        importance: importance || 'normal',
        createdBy: session.user.id,
        scheduledAt: finalScheduledAt,
        notifyBefore: notifyBefore || false,
        status: announcementStatus,
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

    // Duyuru oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'announcement_create');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'announcement_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(newAnnouncement, { status: 201 });
  } catch (error) {
    console.error('Announcement creation error:', error);
    return NextResponse.json(
      { error: 'Duyuru oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
