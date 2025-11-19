import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

// GET: Mesajları listele
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // Pagination için
    const groupId = searchParams.get('groupId'); // Grup filtresi

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

    // Grup filtreleme - Hierarchical access
    const where: any = {
      deletedAt: null, // Soft delete kontrolü
    };
    
    if (groupId) {
      // Belirli bir grup seçilmişse - erişim kontrolü yap
      const targetGroup = await prisma.roleGroup.findUnique({
        where: { id: groupId },
        select: { order: true },
      });

      if (targetGroup) {
        // Erişim kontrolü
        let hasAccess = false;
        
        if (targetGroup.order === 2) {
          // Yönetim sohbetine sadece order 2 kullanıcılar erişebilir
          hasAccess = userGroupOrder === 2;
        } else if (targetGroup.order === 1) {
          // Member sohbetine order >= 1 kullanıcılar erişebilir
          hasAccess = userGroupOrder !== null && userGroupOrder >= 1;
        } else if (targetGroup.order === 0) {
          // Aday sohbetine order >= 0 kullanıcılar erişebilir (yani herkes)
          hasAccess = userGroupOrder !== null && userGroupOrder >= 0;
        }

        if (!hasAccess) {
          return NextResponse.json(
            { error: 'Bu sohbete erişim yetkiniz bulunmuyor' },
            { status: 403 }
          );
        }
      }

      where.groupId = groupId;
    } else {
      // Tüm erişilebilir grupları getir
      const accessibleGroupIds: string[] = []; // String ID'ler
      let includeNull = true; // null (LPBH/HERKES) dahil mi? - Herkes erişebilir
      
      if (userGroupOrder !== null) {
        // Kullanıcının grubu varsa, order'a göre erişim
        const groups = await prisma.roleGroup.findMany({
          select: { id: true, order: true },
        });

        // Yönetim (order 2) -> Yönetim sohbetine erişebilir
        if (userGroupOrder === 2) {
          accessibleGroupIds.push(...groups.filter(g => g.order === 2).map(g => g.id));
        }
        // Member (order 1) -> Member (1) ve Aday (0) sohbetine erişebilir
        if (userGroupOrder >= 1) {
          accessibleGroupIds.push(...groups.filter(g => g.order === 1).map(g => g.id));
        }
        // Aday (order 0) -> Aday (0) sohbetine erişebilir
        if (userGroupOrder >= 0) {
          accessibleGroupIds.push(...groups.filter(g => g.order === 0).map(g => g.id));
        }
        // LPBH (null) -> Herkes erişebilir (includeNull zaten true)
      }

      // Prisma'da null ve id'leri birlikte filtreleme - AND ile birleştir
      if (accessibleGroupIds.length > 0 && includeNull) {
        where.AND = [
          {
            OR: [
              { groupId: { in: accessibleGroupIds } },
              { groupId: null },
            ],
          },
        ];
      } else if (accessibleGroupIds.length > 0) {
        where.groupId = { in: accessibleGroupIds };
      } else if (includeNull) {
        where.groupId = null;
      }
    }

    // Pagination
    if (before) {
      const createdAtFilter = {
        lt: new Date(before),
      };
      
      if (where.AND) {
        where.AND.push({ createdAt: createdAtFilter });
      } else {
        where.createdAt = createdAtFilter;
      }
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
        repliedTo: {
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

    // Tarih sırasına göre tersine çevir (en eskiden en yeniye)
    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error('Messages fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    return NextResponse.json(
      { error: 'Mesajlar yüklenemedi', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST: Yeni mesaj gönder
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const type = (formData.get('type') as string) || 'text';
    let content = formData.get('content') as string | null;
    const forwardedFromId = formData.get('forwardedFromId') as string | null;
    
    // Mention validasyonu - sadece gerçek kullanıcılar mention edilebilir
    if (content && type === 'text') {
      const mentionRegex = /@\[([^:]+):([^\]]+)\]/g;
      const mentions = content.match(mentionRegex);
      if (mentions) {
        for (const mention of mentions) {
          const match = mention.match(/@\[([^:]+):([^\]]+)\]/);
          if (match) {
            const [, userId] = match;
            // Kullanıcının var olup olmadığını kontrol et
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true },
            });
            if (!user) {
              // Geçersiz mention'ı kaldır
              content = content.replace(mention, `@${match[2]}`);
            }
          }
        }
      }
    }
    const repliedToId = formData.get('repliedToId') as string | null;
    const groupIdRaw = formData.get('groupId') as string | null; // Grup ID
    const groupId = groupIdRaw && groupIdRaw.trim() !== '' ? groupIdRaw : null; // Boş string'i null'a çevir
    const latitude = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null;
    const longitude = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null;
    const locationName = formData.get('locationName') as string | null;
    const liveLocationDuration = formData.get('liveLocationDuration') ? parseInt(formData.get('liveLocationDuration') as string) : null;

    // İzin kontrolü - eğer messages permission varsa kontrol et, yoksa varsayılan olarak izin ver
    const permissions = (session as any)?.user?.permissions;
    const hasMessagePermission = permissions?.messages;
    if (hasMessagePermission !== undefined && !hasMessagePermission?.create) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    // Grup erişim kontrolü - mesaj gönderme
    if (groupId) {
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

      const targetGroup = await prisma.roleGroup.findUnique({
        where: { id: groupId },
        select: { order: true },
      });

      if (targetGroup) {
        let hasAccess = false;
        
        if (targetGroup.order === 2) {
          // Yönetim sohbetine sadece order 2 kullanıcılar erişebilir
          hasAccess = userGroupOrder === 2;
        } else if (targetGroup.order === 1) {
          // Member sohbetine order >= 1 kullanıcılar erişebilir
          hasAccess = userGroupOrder !== null && userGroupOrder >= 1;
        } else if (targetGroup.order === 0) {
          // Aday sohbetine order >= 0 kullanıcılar erişebilir (yani herkes)
          hasAccess = userGroupOrder !== null && userGroupOrder >= 0;
        }

        if (!hasAccess) {
          return NextResponse.json(
            { error: 'Bu sohbete mesaj gönderme yetkiniz bulunmuyor' },
            { status: 403 }
          );
        }
      }
    }

    let mediaPath: string | null = null;
    let mediaUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileType: string | null = null;

    // Medya dosyası varsa kaydet
    const file = formData.get('file') as File | null;
    if (file && file.size > 0) {
      // Dosya boyutu kontrolü (100MB - dosyalar için daha büyük limit)
      const maxSize = type === 'document' || type === 'file' ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `Dosya boyutu ${maxSize / 1024 / 1024}MB'dan küçük olmalıdır` },
          { status: 400 }
        );
      }

      const uploadsDir = join(process.cwd(), 'uploads', 'messages');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestampedFileName = `${Date.now()}-${sanitizedFileName}`;
      const filePath = join(uploadsDir, timestampedFileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      mediaPath = `uploads/messages/${timestampedFileName}`;
      mediaUrl = `/api/messages/media/${timestampedFileName}`;
      fileName = file.name;
      fileSize = file.size;
      fileType = file.type;
      
    }

    // Canlı konum süresi dolma zamanı hesapla
    let liveLocationExpiresAt: Date | null = null;
    if (type === 'live_location' && liveLocationDuration) {
      liveLocationExpiresAt = new Date();
      liveLocationExpiresAt.setMinutes(liveLocationExpiresAt.getMinutes() + liveLocationDuration);
    }

    const message = await prisma.message.create({
      data: {
        type,
        content: content || null,
        mediaPath,
        mediaUrl,
        fileName,
        fileSize,
        fileType,
        latitude,
        longitude,
        locationName: locationName || null,
        liveLocationExpiresAt,
        repliedToId: repliedToId || null,
        forwardedFromId: forwardedFromId || null,
        groupId: groupId || null, // null = LPBH/HERKES
        senderId: session.user.id,
      },
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
        repliedTo: {
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
    });
    
    // Okundu bilgisi oluştur (gönderen kendi mesajını okumuş sayılır)
    await prisma.readReceipt.create({
      data: {
        messageId: message.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('Message creation error:', error);
    return NextResponse.json(
      { error: 'Mesaj gönderilemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

