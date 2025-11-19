import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Kullanıcının görebileceği tüm oylamaları listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    const where: any = {};

    if (search.trim()) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Visibility mantığı: meetings ile aynı şekilde rütbe/grup bazlı süzülebilir
    // Şimdilik tüm visibility'leri geçiriyoruz; ihtiyaç olursa genişletilir.

    const polls = await prisma.poll.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
          },
        },
        options: true,
        votes: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                isim: true,
                soyisim: true,
              },
            },
            option: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    });

    return NextResponse.json(polls);
  } catch (error) {
    console.error('Polls fetch error:', error);
    return NextResponse.json(
      { error: 'Oylamalar yüklenemedi' },
      { status: 500 }
    );
  }
}

// POST: Yeni oylama oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, type, allowCustomOption, options } = body as {
      title: string;
      description?: string;
      type: 'yes_no' | 'multiple';
      allowCustomOption?: boolean;
      options?: string[];
    };

    if (!title || !type) {
      return NextResponse.json(
        { error: 'Başlık ve oylama tipi zorunludur' },
        { status: 400 }
      );
    }

    let normalizedOptions: string[] = [];
    if (type === 'yes_no') {
      normalizedOptions = ['Evet', 'Hayır'];
    } else {
      // multiple
      normalizedOptions = (options || [])
        .map((o) => o?.trim())
        .filter(Boolean);

      if (!allowCustomOption && normalizedOptions.length < 2) {
        return NextResponse.json(
          { error: 'Çoklu seçenekli oylamalarda en az 2 seçenek olmalıdır' },
          { status: 400 }
        );
      }
    }

    const poll = await prisma.poll.create({
      data: {
        title,
        description: description || null,
        type,
        allowCustomOption: !!allowCustomOption,
        createdBy: session.user.id,
        options: {
          create: normalizedOptions.map((text) => ({
            text,
          })),
        },
      },
      include: {
        options: true,
      },
    });

    return NextResponse.json(poll, { status: 201 });
  } catch (error) {
    console.error('Poll creation error:', error);
    return NextResponse.json(
      { error: 'Oylama oluşturulamadı' },
      { status: 500 }
    );
  }
}


