import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/calls/[id] - Call detayı
export async function GET(
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

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Sadece caller veya receiver görebilir
    if (call.callerId !== session.user.id && call.receiverId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(call);
  } catch (error) {
    console.error('Call fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/calls/[id] - Call güncelle
export async function PATCH(
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

    // Sadece caller veya receiver güncelleyebilir
    if (call.callerId !== session.user.id && call.receiverId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status, startedAt, endedAt, duration } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (startedAt) updateData.startedAt = new Date(startedAt);
    if (endedAt) updateData.endedAt = new Date(endedAt);
    if (duration !== undefined) updateData.duration = duration;

    const updatedCall = await prisma.call.update({
      where: { id: params.id },
      data: updateData,
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
    console.error('Call update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

