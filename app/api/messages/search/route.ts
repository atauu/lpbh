import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Mesajları ara
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
    const query = searchParams.get('q');
    const groupId = searchParams.get('groupId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!query || query.trim().length === 0) {
      return NextResponse.json([]);
    }

    // Kullanıcının rol bilgisini al
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { rutbe: true },
    });

    let userGroupOrder: number | null = null;
    if (user?.rutbe) {
      const role = await prisma.role.findUnique({
        where: { name: user.rutbe },
        include: { group: true },
      });
      userGroupOrder = role?.group?.order ?? null;
    }

    const where: any = {
      deletedAt: null,
      content: {
        contains: query,
        mode: 'insensitive',
      },
    };

    if (groupId) {
      const targetGroup = await prisma.roleGroup.findUnique({
        where: { id: groupId },
        select: { order: true },
      });

      if (targetGroup) {
        let hasAccess = false;
        
        if (targetGroup.order === 2) {
          hasAccess = userGroupOrder === 2;
        } else if (targetGroup.order === 1) {
          hasAccess = userGroupOrder !== null && userGroupOrder >= 1;
        } else if (targetGroup.order === 0) {
          hasAccess = userGroupOrder !== null && userGroupOrder >= 0;
        }

        if (!hasAccess) {
          return NextResponse.json(
            { error: 'Bu sohbette arama yapma yetkiniz bulunmuyor' },
            { status: 403 }
          );
        }
      }

      where.groupId = groupId;
    } else {
      // Tüm erişilebilir grupları getir
      const accessibleGroupIds: string[] = [];
      
      if (userGroupOrder !== null) {
        const allGroups = await prisma.roleGroup.findMany({
          select: { id: true, order: true },
        });

        allGroups.forEach(group => {
          if (group.order === 2) {
            if (userGroupOrder === 2) {
              accessibleGroupIds.push(group.id);
            }
          } else if (group.order === 1) {
            if (userGroupOrder !== null && userGroupOrder >= 1) {
              accessibleGroupIds.push(group.id);
            }
          } else if (group.order === 0) {
            if (userGroupOrder !== null && userGroupOrder >= 0) {
              accessibleGroupIds.push(group.id);
            }
          }
        });
      }

      // LPBH (null groupId) her zaman erişilebilir
      where.OR = [
        { groupId: null },
        { groupId: { in: accessibleGroupIds } },
      ];
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
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
            order: true,
          },
        },
        forwardedFrom: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                rutbe: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                rutbe: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                rutbe: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
        starredBy: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Kullanıcının yıldızladığı mesajları işaretle
    const starredMessageIds = await prisma.starredMessage.findMany({
      where: {
        userId: session.user.id,
        messageId: {
          in: messages.map(m => m.id),
        },
      },
      select: {
        messageId: true,
      },
    });

    const starredIds = new Set(starredMessageIds.map(s => s.messageId));
    messages.forEach(message => {
      (message as any).isStarred = starredIds.has(message.id);
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Message search error:', error);
    return NextResponse.json(
      { error: 'Arama yapılamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



