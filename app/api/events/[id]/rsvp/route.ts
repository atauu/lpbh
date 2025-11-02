import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// POST: Etkinlik için RSVP kaydet (katılım durumu)
export async function POST(
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

    const eventId = params.id;
    const body = await request.json();
    const { status } = body; // 'attending' | 'not_attending' | null

    // Event var mı kontrol et
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Etkinlik bulunamadı' },
        { status: 404 }
      );
    }

    // Geçmiş etkinlikler için RSVP kabul etme
    if (new Date(event.eventDate) < new Date()) {
      return NextResponse.json(
        { error: 'Geçmiş etkinlikler için katılım durumu güncellenemez' },
        { status: 400 }
      );
    }

    // RSVP kaydet veya güncelle (status null değilse kaydet)
    if (status) {
      const attendance = await prisma.eventAttendance.upsert({
        where: {
          eventId_userId: {
            eventId: eventId,
            userId: session.user.id,
          },
        },
        update: {
          status: status,
        },
        create: {
          eventId: eventId,
          userId: session.user.id,
          status: status,
        },
      });

      // RSVP logunu kaydet
      const userNameDisplay = session?.user?.username || '';
      const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
        ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
        : '';
      const description = getActivityDescription(userNameDisplay, userFullName, 'event_rsvp');
      
      const ipAddress = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      
      await logActivity(
        session.user.id,
        'event_rsvp',
        description,
        {},
        ipAddress,
        userAgent
      );

      return NextResponse.json(attendance, { status: 200 });
    } else {
      // Status null ise kayıt sil (cevapsız olarak kalacak)
      await prisma.eventAttendance.deleteMany({
        where: {
          eventId: eventId,
          userId: session.user.id,
        },
      });

      return NextResponse.json({ message: 'RSVP kaydı silindi' }, { status: 200 });
    }
  } catch (error) {
    console.error('RSVP error:', error);
    return NextResponse.json(
      { error: 'Katılım durumu kaydedilemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

