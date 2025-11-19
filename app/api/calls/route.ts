import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/calls - Call listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {
      OR: [
        { callerId: session.user.id },
        { receiverId: session.user.id },
      ],
    };

    if (status) {
      where.status = status;
    }

    const calls = await prisma.call.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(calls);
  } catch (error) {
    console.error('Calls fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/calls - Yeni çağrı oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, groupId, type } = body;

    if (!receiverId && !groupId) {
      return NextResponse.json({ error: 'receiverId or groupId required' }, { status: 400 });
    }

    if (!type || (type !== 'audio' && type !== 'video')) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Eğer kendi kendine aramaya çalışıyorsa
    if (receiverId === session.user.id) {
      return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 });
    }

    // Receiver var mı kontrol et
    if (receiverId) {
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId },
      });

      if (!receiver) {
        return NextResponse.json({ error: 'Receiver not found' }, { status: 404 });
      }
    }

    // Group var mı kontrol et
    if (groupId) {
      const group = await prisma.roleGroup.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }
    }

    const call = await prisma.call.create({
      data: {
        callerId: session.user.id,
        receiverId: receiverId || session.user.id, // Group call için geçici olarak caller ID
        groupId: groupId || null,
        type,
        status: 'pending',
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

    return NextResponse.json(call, { status: 201 });
  } catch (error) {
    console.error('Call creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

