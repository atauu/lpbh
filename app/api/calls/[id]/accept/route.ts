import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSocketServer } from '@/lib/socket-server';

export const dynamic = 'force-dynamic';

// POST /api/calls/[id]/accept - Call kabul et
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

    // Sadece receiver kabul edebilir
    if (call.receiverId !== session.user.id) {
      return NextResponse.json({ error: 'Only receiver can accept call' }, { status: 403 });
    }

    if (call.status !== 'pending' && call.status !== 'ringing') {
      return NextResponse.json({ error: 'Call cannot be accepted' }, { status: 400 });
    }

    const updatedCall = await prisma.call.update({
      where: { id: params.id },
      data: {
        status: 'active',
        startedAt: new Date(),
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

    // Notify caller via socket that call was accepted
    try {
      const io = getSocketServer();
      if (io) {
        io.to(`user:${call.callerId}`).emit('call:accepted', {
          callId: params.id,
          receiverId: session.user.id,
        });
      }
    } catch (socketError) {
      console.error('Socket notification error:', socketError);
      // Don't fail the request if socket notification fails
    }

    return NextResponse.json(updatedCall);
  } catch (error) {
    console.error('Call accept error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

