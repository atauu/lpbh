import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type EventType = 'meeting' | 'event' | 'assignment' | 'announcement' | 'research' | 'poll' | 'document';

// GET: Tüm event tipleri için okunmamış sayıları getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('eventType') as EventType | null;
    const eventId = searchParams.get('eventId');
    const unreadCounts = searchParams.get('unreadCounts'); // Tüm tipler için okunmamış sayıları getir

    // Eğer unreadCounts parametresi varsa, tüm tipler için okunmamış sayıları getir
    if (unreadCounts === 'true') {
      const counts: Record<string, number> = {};
      const eventTypes: EventType[] = ['meeting', 'event', 'assignment', 'announcement', 'research', 'poll', 'document'];

      for (const type of eventTypes) {
        try {
          // Tüm eventleri getir
          let events: any[] = [];
          let visibilityField = 'visibility';

          switch (type) {
            case 'meeting':
              events = await prisma.meeting.findMany({
                select: { id: true, visibility: true },
              });
              break;
            case 'event':
              // Events don't have visibility, so get all events
              events = await prisma.event.findMany({
                select: { id: true },
              });
              visibilityField = '';
              break;
            case 'assignment':
              events = await prisma.assignment.findMany({
                select: { id: true, visibility: true },
              });
              break;
            case 'announcement':
              events = await prisma.announcement.findMany({
                select: { id: true, visibility: true },
              });
              break;
            case 'research':
              events = await prisma.research.findMany({
                select: { id: true },
              });
              visibilityField = '';
              break;
            case 'poll':
              events = await prisma.poll.findMany({
                select: { id: true },
              });
              visibilityField = ''; // poll için şimdilik herkes
              break;
            case 'document':
              events = await prisma.document.findMany({
                select: { id: true, visibility: true },
              });
              break;
          }

          // Kullanıcının rütbesini al
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { rutbe: true, membershipStatus: true },
          });

          // Yönetim rolleri önceden al
          const roles = await prisma.role.findMany({
            where: {
              group: {
                name: 'Yönetim',
              },
            },
            select: { name: true },
          });
          const adminRoleNames = roles.map(r => r.name);

          // Visibility'ye göre hangi eventleri görebileceğini belirle
          const eligibleEvents = events.filter((event) => {
            // Eğer visibility field yoksa (event, research) veya event'te visibility yoksa, hepsini göster
            if (!visibilityField || !event[visibilityField]) {
              return true;
            }
            const visibility = event[visibilityField];
            
            if (visibility === 'herkes') {
              return user?.membershipStatus === 'approved';
            } else if (visibility === 'member') {
              return user?.membershipStatus === 'approved' && user?.rutbe;
            } else if (visibility === 'yönetim') {
              if (!user?.rutbe) return false;
              return adminRoleNames.includes(user.rutbe);
            }
            return false;
          });
          
          console.log(`[ReadStatus API] ${type}: totalEvents=${events.length}, eligibleEvents=${eligibleEvents.length}, userMembershipStatus=${user?.membershipStatus}, userRutbe=${user?.rutbe}`);

          const eligibleEventIds = eligibleEvents.map(e => e.id);

          // Okunmamış event sayısını hesapla
          let unreadCount = 0;
          
          if (eligibleEventIds.length > 0) {
            try {
              // Prisma client'ta readStatus modelinin mevcut olup olmadığını kontrol et
              const readStatusModel = (prisma as any).readStatus;
              if (!readStatusModel) {
                console.warn(`[ReadStatus API] ${type}: prisma.readStatus is undefined. Available models:`, Object.keys(prisma).filter(k => !k.startsWith('_')).slice(0, 10));
                // Eğer model yoksa, tüm eligible events unread sayılır
                unreadCount = eligibleEventIds.length;
              } else {
                const readStatuses = await readStatusModel.findMany({
                  where: {
                    eventType: type,
                    eventId: { in: eligibleEventIds },
                    userId: session.user.id,
                  },
                  select: { eventId: true },
                });

                const readEventIds = new Set(readStatuses.map((rs: any) => rs.eventId));
                unreadCount = eligibleEventIds.filter(id => !readEventIds.has(id)).length;
              }
            } catch (readStatusError) {
              console.error(`Error fetching read statuses for ${type}:`, readStatusError);
              // Eğer readStatus modeli yoksa veya hata varsa, tüm eligible events unread sayılır
              unreadCount = eligibleEventIds.length;
            }
          } else {
            // Eğer eligible event yoksa, unreadCount 0
            unreadCount = 0;
          }

          console.log(`[ReadStatus API] ${type}: totalEvents=${events.length}, eligibleEvents=${eligibleEventIds.length}, readEvents=${eligibleEventIds.length > 0 ? 'calculated' : 0}, unreadCount=${unreadCount}`);
          
          counts[type] = unreadCount;
        } catch (error) {
          console.error(`Error fetching unread count for ${type}:`, error);
          counts[type] = 0;
        }
      }

      return NextResponse.json({ unreadCounts: counts });
    }

    // Eğer eventType ve eventId varsa, normal okuma durumunu getir
    if (eventType && eventId) {
      // Event'in varlığını ve visibility'sini kontrol et
      let event: any = null;
      let visibility: string = 'herkes';

      switch (eventType) {
        case 'meeting':
          event = await prisma.meeting.findUnique({
            where: { id: eventId },
            select: { id: true, visibility: true },
          });
          if (event) visibility = event.visibility;
          break;
        case 'event':
          event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true },
          });
          // Events don't have visibility, so all users can see
          visibility = 'herkes';
          break;
        case 'assignment':
          event = await prisma.assignment.findUnique({
            where: { id: eventId },
            select: { id: true, visibility: true },
          });
          if (event) visibility = event.visibility;
          break;
        case 'announcement':
          event = await prisma.announcement.findUnique({
            where: { id: eventId },
            select: { id: true, visibility: true },
          });
          if (event) visibility = event.visibility;
          break;
        case 'research':
          event = await prisma.research.findUnique({
            where: { id: eventId },
            select: { id: true },
          });
          // Researches don't have visibility, so all users can see
          visibility = 'herkes';
          break;
        case 'poll':
          event = await prisma.poll.findUnique({
            where: { id: eventId },
            select: { id: true },
          });
          visibility = 'herkes';
          break;
        case 'document':
          event = await prisma.document.findUnique({
            where: { id: eventId },
            select: { id: true, visibility: true },
          });
          if (event) visibility = event.visibility;
          break;
      }

      if (!event) {
        return NextResponse.json(
          { error: 'Event bulunamadı' },
          { status: 404 }
        );
      }

      // Kullanıcının izinlerini kontrol et
      const userPermissions = (session as any)?.user?.permissions;
      const canRead = hasPermission(userPermissions, eventType === 'meeting' ? 'meetings' : eventType === 'event' ? 'events' : eventType === 'assignment' ? 'assignments' : eventType === 'announcement' ? 'announcements' : 'researches', 'read');

      if (!canRead) {
        return NextResponse.json(
          { error: 'Bu event\'i görüntüleme izniniz yok' },
          { status: 403 }
        );
      }

      // Kullanıcının rütbesini al
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { rutbe: true },
      });

      // Visibility'ye göre hangi kullanıcıların bu event'i görebileceğini belirle
      let eligibleUserIds: string[] = [];
      
      if (visibility === 'herkes') {
        const allUsers = await prisma.user.findMany({
          where: {
            membershipStatus: 'approved',
          },
          select: { id: true },
        });
        eligibleUserIds = allUsers.map(u => u.id);
      } else if (visibility === 'member') {
        // Member ve yönetim görebilir
        const memberUsers = await prisma.user.findMany({
          where: {
            membershipStatus: 'approved',
            rutbe: {
              not: null,
            },
          },
          select: { id: true },
        });
        eligibleUserIds = memberUsers.map(u => u.id);
      } else if (visibility === 'yönetim') {
        // Sadece yönetim görebilir
        const adminUsers = await prisma.user.findMany({
          where: {
            membershipStatus: 'approved',
            rutbe: {
              not: null,
            },
          },
          select: { id: true, rutbe: true },
        });
        // Rutbe kontrolü için role'leri kontrol et
        const roles = await prisma.role.findMany({
          where: {
            group: {
              name: 'Yönetim',
            },
          },
          select: { name: true },
        });
        const adminRoleNames = roles.map(r => r.name);
        eligibleUserIds = adminUsers
          .filter(u => u.rutbe && adminRoleNames.includes(u.rutbe))
          .map(u => u.id);
      }

      // Okuma durumlarını getir
      const readStatuses = await prisma.readStatus.findMany({
        where: {
          eventType,
          eventId,
          userId: {
            in: eligibleUserIds,
          },
        },
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
        orderBy: {
          readAt: 'desc',
        },
      });

      const readUserIds = new Set(readStatuses.map(rs => rs.userId));
      const unreadUserIds = eligibleUserIds.filter(id => !readUserIds.has(id));

      // Okumayan kullanıcıları getir
      const unreadUsers = await prisma.user.findMany({
        where: {
          id: {
            in: unreadUserIds,
          },
        },
        select: {
          id: true,
          username: true,
          isim: true,
          soyisim: true,
        },
      });

      return NextResponse.json({
        readCount: readStatuses.length,
        unreadCount: unreadUsers.length,
        totalEligible: eligibleUserIds.length,
        readBy: readStatuses.map(rs => ({
          id: rs.user.id,
          username: rs.user.username,
          isim: rs.user.isim,
          soyisim: rs.user.soyisim,
          readAt: rs.readAt,
        })),
        unreadBy: unreadUsers.map(u => ({
          id: u.id,
          username: u.username,
          isim: u.isim,
          soyisim: u.soyisim,
        })),
      });
    }

    // Eğer hiçbir parametre yoksa hata döndür
    return NextResponse.json(
      { error: 'eventType ve eventId veya unreadCounts parametresi gerekli' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Read status fetch error:', error);
    return NextResponse.json(
      { error: 'Okuma durumu yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Okundu işaretle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { eventType, eventId } = body;

    if (!eventType || !eventId) {
      return NextResponse.json(
        { error: 'eventType ve eventId gerekli' },
        { status: 400 }
      );
    }

    // Event'in varlığını kontrol et
    let event: any = null;
    switch (eventType) {
      case 'meeting':
        event = await prisma.meeting.findUnique({ where: { id: eventId } });
        break;
      case 'event':
        event = await prisma.event.findUnique({ where: { id: eventId } });
        break;
      case 'assignment':
        event = await prisma.assignment.findUnique({ where: { id: eventId } });
        break;
      case 'announcement':
        event = await prisma.announcement.findUnique({ where: { id: eventId } });
        break;
      case 'research':
        event = await prisma.research.findUnique({ where: { id: eventId } });
        break;
    }

    if (!event) {
      return NextResponse.json(
        { error: 'Event bulunamadı' },
        { status: 404 }
      );
    }

    // Okundu işaretle (upsert - varsa güncelle, yoksa oluştur)
    const readStatusModel = (prisma as any).readStatus;
    if (!readStatusModel) {
      console.error('[ReadStatus API] POST: prisma.readStatus is undefined');
      return NextResponse.json(
        { error: 'ReadStatus model not available' },
        { status: 500 }
      );
    }

    // Önce mevcut kaydı kontrol et
    const existingReadStatus = await readStatusModel.findUnique({
      where: {
        eventType_eventId_userId: {
          eventType: eventType as EventType,
          eventId,
          userId: session.user.id,
        },
      },
    });

    // Eğer kayıt yoksa oluştur, varsa güncelleme (ilk okuma zamanı korunur)
    const readStatus = existingReadStatus || await readStatusModel.create({
      data: {
        eventType: eventType as EventType,
        eventId,
        userId: session.user.id,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, readStatus });
  } catch (error) {
    console.error('Read status mark error:', error);
    return NextResponse.json(
      { error: 'Okundu işaretlenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH: Tüm eventleri okundu işaretle (bir eventType için)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { eventType } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: 'eventType gerekli' },
        { status: 400 }
      );
    }

    // Kullanıcının izinlerini kontrol et
    const userPermissions = (session as any)?.user?.permissions;
    const resourceMap: Record<string, string> = {
      'meeting': 'meetings',
      'event': 'events',
      'assignment': 'assignments',
      'announcement': 'announcements',
      'research': 'researches',
      'poll': 'polls',
      'document': 'documents',
    };
    const resource = resourceMap[eventType as EventType];
    const canRead = hasPermission(userPermissions, resource, 'read');

    if (!canRead) {
      return NextResponse.json(
        { error: 'Bu event\'leri görüntüleme izniniz yok' },
        { status: 403 }
      );
    }

    // Tüm eventleri getir (visibility kontrolü ile)
    let events: any[] = [];
    let visibilityField = 'visibility';

    switch (eventType) {
      case 'meeting':
        events = await prisma.meeting.findMany({
          select: { id: true, visibility: true },
        });
        break;
      case 'event':
        // Events don't have visibility, so all users can see
        events = await prisma.event.findMany({
          select: { id: true },
        });
        visibilityField = '';
        break;
      case 'assignment':
        events = await prisma.assignment.findMany({
          select: { id: true, visibility: true },
        });
        break;
      case 'announcement':
        events = await prisma.announcement.findMany({
          select: { id: true, visibility: true },
        });
        break;
      case 'research':
        // Researches don't have visibility, so all users can see
        events = await prisma.research.findMany({
          select: { id: true },
        });
        visibilityField = '';
        break;
      case 'poll':
        events = await prisma.poll.findMany({
          select: { id: true },
        });
        visibilityField = '';
        break;
      case 'document':
        events = await prisma.document.findMany({
          select: { id: true, visibility: true },
        });
        break;
    }

    // Kullanıcının rütbesini al
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { rutbe: true, membershipStatus: true },
    });

    // Yönetim rolleri önceden al
    const roles = await prisma.role.findMany({
      where: {
        group: {
          name: 'Yönetim',
        },
      },
      select: { name: true },
    });
    const adminRoleNames = roles.map(r => r.name);

    // Visibility'ye göre hangi eventleri görebileceğini belirle
    const eligibleEvents = events.filter((event) => {
      if (!visibilityField || !event[visibilityField]) {
        return true; // Visibility yoksa veya herkes için ise
      }
      const visibility = event[visibilityField];
      
      if (visibility === 'herkes') {
        return user?.membershipStatus === 'approved';
      } else if (visibility === 'member') {
        return user?.membershipStatus === 'approved' && user?.rutbe;
      } else if (visibility === 'yönetim') {
        if (!user?.rutbe) return false;
        return adminRoleNames.includes(user.rutbe);
      }
      return false;
    });

    // Tüm eligible eventleri okundu işaretle
    const eventIds = eligibleEvents.map(e => e.id);
    const now = new Date();

    // Upsert işlemi - her event için (sadece yeni kayıt oluştur, mevcutları güncelleme)
    const readStatusModel = (prisma as any).readStatus;
    if (!readStatusModel) {
      console.error('[ReadStatus API] PATCH: prisma.readStatus is undefined');
      return NextResponse.json(
        { error: 'ReadStatus model not available' },
        { status: 500 }
      );
    }

    // Mevcut kayıtları toplu olarak kontrol et
    const existingReadStatuses = await readStatusModel.findMany({
      where: {
        eventType: eventType as EventType,
        eventId: { in: eventIds },
        userId: session.user.id,
      },
      select: { eventId: true },
    });

    const existingEventIds = new Set(existingReadStatuses.map(rs => rs.eventId));
    const newEventIds = eventIds.filter(eventId => !existingEventIds.has(eventId));

    // Sadece yeni kayıtlar için oluştur (ilk okuma zamanı korunur)
    if (newEventIds.length > 0) {
      await Promise.all(
        newEventIds.map((eventId) =>
          readStatusModel.create({
            data: {
              eventType: eventType as EventType,
              eventId,
              userId: session.user.id,
              readAt: now,
            },
          })
        )
      );
    }

    return NextResponse.json({ 
      success: true, 
      markedCount: eventIds.length 
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return NextResponse.json(
      { error: 'Tüm eventler okundu işaretlenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

