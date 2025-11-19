import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: Bir oylamada oy kullan veya yeni seçenek ekle
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pollId = params.id;
    const body = await request.json();
    const { optionId, newOptionText } = body as {
      optionId?: string;
      newOptionText?: string;
    };

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Oylama bulunamadı' },
        { status: 404 }
      );
    }

    const userId = session.user.id;

    // Yes/No için: sadece mevcut seçeneklerden biri seçilebilir
    // Multiple için: allowCustomOption'a göre yeni seçenek eklenebilir

    let targetOptionId = optionId || null;

    if (poll.type === 'multiple' && poll.allowCustomOption && newOptionText) {
      const text = newOptionText.trim();
      if (!text) {
        return NextResponse.json(
          { error: 'Seçenek metni boş olamaz' },
          { status: 400 }
        );
      }

      // Her üye sadece bir seçenek oluşturabilir
      const existingCustomOption = await prisma.pollOption.findFirst({
        where: {
          pollId,
          createdBy: userId,
        },
      });

      if (existingCustomOption) {
        return NextResponse.json(
          { error: 'Her üye en fazla bir seçenek oluşturabilir' },
          { status: 400 }
        );
      }

      const createdOption = await prisma.pollOption.create({
        data: {
          pollId,
          text,
          createdBy: userId,
        },
      });

      targetOptionId = createdOption.id;
    }

    if (!targetOptionId) {
      return NextResponse.json(
        { error: 'Geçerli bir seçenek belirtilmedi' },
        { status: 400 }
      );
    }

    // Seçenek ilgili oylamaya ait mi kontrol et
    const option = await prisma.pollOption.findFirst({
      where: {
        id: targetOptionId,
        pollId,
      },
    });

    if (!option) {
      return NextResponse.json(
        { error: 'Geçersiz seçenek' },
        { status: 400 }
      );
    }

    // Kullanıcının önceki oyunu sil ve yeni oyu ekle (tek oy kuralı)
    await prisma.pollVote.deleteMany({
      where: {
        pollId,
        userId,
      },
    });

    const vote = await prisma.pollVote.create({
      data: {
        pollId,
        optionId: option.id,
        userId,
      },
      include: {
        option: true,
      },
    });

    return NextResponse.json(vote, { status: 201 });
  } catch (error) {
    console.error('Poll vote error:', error);
    return NextResponse.json(
      { error: 'Oy kullanılamadı' },
      { status: 500 }
    );
  }
}


