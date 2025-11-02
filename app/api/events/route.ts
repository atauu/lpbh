import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tüm etkinlikleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Prisma client kontrolü ve debug
    if (!prisma || !(prisma as any).event) {
      console.error('Prisma client error:', {
        prismaExists: !!prisma,
        eventModel: !!(prisma as any)?.event,
        availableModels: prisma ? Object.keys(prisma).filter(k => !k.startsWith('_') && typeof (prisma as any)[k] === 'object').slice(0, 10) : [],
      });
      throw new Error('Prisma client or Event model not available');
    }

    // Tüm etkinlikleri getir
    const events = await prisma.event.findMany({
      include: {
        planner: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
          },
        },
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
      },
      orderBy: {
        eventDate: 'desc',
      },
    });

    // Her etkinlik için tüm kullanıcıları getir ve cevapsızları belirle
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        isim: true,
        soyisim: true,
      },
    });

    // Her etkinlik için cevapsız kullanıcıları ekle
    const eventsWithUnanswered = events.map(event => {
      const answeredUserIds = new Set(
        event.attendances
          .filter(att => att.status !== null)
          .map(att => att.userId)
      );
      
      // Cevapsız kullanıcılar (hiç RSVP kaydı olmayan veya status null olan)
      const unansweredUsers = allUsers.filter(user => {
        const attendance = event.attendances.find(att => att.userId === user.id);
        // Eğer hiç attendance kaydı yoksa veya status null ise cevapsız
        return !attendance || attendance.status === null;
      });

      // Cevapsız kullanıcıları attendances listesine ekle (status null ile)
      const unansweredAttendances = unansweredUsers.map(user => ({
        id: `unanswered-${user.id}`,
        eventId: event.id,
        userId: user.id,
        status: null,
        user: user,
      }));

      return {
        ...event,
        attendances: [
          ...event.attendances.filter(att => att.status !== null), // Sadece cevap verenler
          ...unansweredAttendances, // Cevapsızlar
        ],
      };
    });

    return NextResponse.json(eventsWithUnanswered);
  } catch (error) {
    console.error('Events fetch error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Etkinlikler yüklenemedi',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST: Yeni etkinlik ekle
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
    if (!hasPermission(permissions, 'events', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, eventDate, location, locationUrl, description: eventDescription } = body;

    if (!title || !eventDate || !location) {
      return NextResponse.json(
        { error: 'Etkinlik adı, tarih ve lokasyon zorunludur' },
        { status: 400 }
      );
    }

    // Prisma client kontrolü
    if (!prisma || !(prisma as any).event) {
      console.error('Prisma client error (POST):', {
        prismaExists: !!prisma,
        eventModel: !!(prisma as any)?.event,
      });
      throw new Error('Prisma client or Event model not available');
    }

    const event = await prisma.event.create({
      data: {
        title,
        eventDate: new Date(eventDate),
        location,
        locationUrl: locationUrl || null,
        description: eventDescription || null,
        plannedBy: session.user.id,
      },
      include: {
        planner: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
          },
        },
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
      },
    });

    // Etkinlik oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'event_create');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'event_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Event creation error:', error);
    return NextResponse.json(
      { error: 'Etkinlik oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

