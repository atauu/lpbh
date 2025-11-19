import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/calls/[id]/reject - Call reddet
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

    // Sadece receiver reddedebilir
    if (call.receiverId !== session.user.id) {
      return NextResponse.json({ error: 'Only receiver can reject call' }, { status: 403 });
    }

    if (call.status === 'ended' || call.status === 'rejected') {
      return NextResponse.json({ error: 'Call already ended or rejected' }, { status: 400 });
    }

    const updatedCall = await prisma.call.update({
      where: { id: params.id },
      data: {
        status: 'rejected',
        endedAt: new Date(),
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
    console.error('Call reject error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

