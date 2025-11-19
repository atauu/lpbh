import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/calls/[id]/end - Call bitir
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const call = await prisma.call.findUnique({
      where: { id: params.id },
    });

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Sadece caller veya receiver bitirebilir
    if (call.callerId !== session.user.id && call.receiverId !== session.user.id) {
      return NextResponse.json({ error: 'Only caller or receiver can end call' }, { status: 403 });
    }

    // Allow ending call even if already ended (idempotent)
    // This prevents errors when cleanup happens multiple times
    if (call.status === 'ended') {
      const alreadyEndedCall = await prisma.call.findUnique({
        where: { id: params.id },
        include: {
          caller: {
            select: {
              id: true,
              username: true,
              rutbe: true,
              isim: true,
              soyisim: true,
            },
          },
          receiver: {
            select: {
              id: true,
              username: true,
              rutbe: true,
              isim: true,
              soyisim: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return NextResponse.json(alreadyEndedCall);
    }

    // Body optional - duration can be calculated automatically
    let duration: number | undefined;
    
    // Check if request has body
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const body = await request.json().catch(() => null);
        if (body && typeof body.duration === 'number') {
          duration = body.duration;
        }
      } catch (error) {
        // Body is empty or invalid, calculate duration automatically
      }
    }

    const now = new Date();
    const startedAt = call.startedAt || call.createdAt;
    const calculatedDuration = duration !== undefined ? duration : Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));

    const updatedCall = await prisma.call.update({
      where: { id: params.id },
      data: {
        status: 'ended',
        endedAt: now,
        duration: calculatedDuration,
      },
      include: {
        caller: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(updatedCall);
  } catch (error) {
    console.error('Call end error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

