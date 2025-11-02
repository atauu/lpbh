import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tüm görevlendirmeleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Kullanıcının rütbesini ve grubunu al
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.rutbe) {
      return NextResponse.json(
        { error: 'Kullanıcı rütbesi bulunamadı' },
        { status: 400 }
      );
    }

    // Rütbeyi bul ve grubunu al
    const role = await prisma.role.findUnique({
      where: { name: user.rutbe },
      include: {
        group: true,
      },
    });

    const { searchParams } = new URL(request.url);
    const assigneeId = searchParams.get('assigneeId'); // Filtreleme için

    const where: any = {};
    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    // Visibility filtresi ekle
    if (role && role.group) {
      const userGroupOrder = role.group.order;
      let allowedVisibilities: string[] = [];

      // Visibility mantığı:
      // order 2 (Yönetim) -> yönetim, member (çünkü yönetim her şeyi görebilmeli)
      // order 1 (Member) -> member, yönetim
      // order 0 (Aday) -> herkes, member, yönetim
      if (userGroupOrder >= 2) {
        // Yönetim grubu tüm görevleri görebilir
        allowedVisibilities = ['herkes', 'member', 'yönetim'];
      } else if (userGroupOrder >= 1) {
        allowedVisibilities = ['yönetim', 'member'];
      } else {
        allowedVisibilities = ['herkes', 'yönetim', 'member'];
      }

      // Visibility filtresi - kullanıcı kendisi assignee ise tüm görevleri görebilir
      where.OR = [
        { visibility: { in: allowedVisibilities } },
        { assigneeId: session.user.id }, // Görevlendirilen kişi her zaman kendi görevini görebilir
      ];
    } else {
      // Grup yoksa sadece herkes için olanları göster
      where.OR = [
        { visibility: 'herkes' },
        { assigneeId: session.user.id }, // Görevlendirilen kişi her zaman kendi görevini görebilir
      ];
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        assigner: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
      },
      orderBy: {
        issueDate: 'desc',
      },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Assignments fetch error:', error);
    return NextResponse.json(
      { error: 'Görevlendirmeler yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Yeni görevlendirme ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    if (!hasPermission(permissions, 'assignments', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const assigneeId = formData.get('assigneeId') as string;
    const task = formData.get('task') as string;
    const issueDate = formData.get('issueDate') as string;
    const expectedDelivery = formData.get('expectedDelivery') as string;
    const visibility = formData.get('visibility') as string || 'herkes';
    const files = formData.getAll('files') as File[];

    if (!assigneeId || !task || !issueDate || !expectedDelivery) {
      return NextResponse.json(
        { error: 'Görevlendirilen, görev, ibraz tarihi ve beklenilen teslim tarihi zorunludur' },
        { status: 400 }
      );
    }

    // Dosyaları kaydet
    const filePaths: string[] = [];
    if (files && files.length > 0) {
      const uploadsDir = join(process.cwd(), 'uploads', 'assignments');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      for (const file of files) {
        if (file.size > 0) {
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = `${Date.now()}-${sanitizedFileName}`;
          const filePath = join(uploadsDir, fileName);

          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          await writeFile(filePath, buffer);

          filePaths.push(`uploads/assignments/${fileName}`);
        }
      }
    }

    // Status belirleme: Eğer bugün > beklenilen teslim tarihi ise 'cancelled' (otomatik)
    const today = new Date();
    const expectedDate = new Date(expectedDelivery);
    let status = 'pending';
    if (today > expectedDate) {
      status = 'cancelled';
    }

    const assignment = await prisma.assignment.create({
      data: {
        assignerId: session.user.id,
        assigneeId,
        task,
        issueDate: new Date(issueDate),
        expectedDelivery: new Date(expectedDelivery),
        visibility,
        status,
        files: filePaths,
      },
      include: {
        assigner: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
      },
    });

    // Görevlendirme oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'assignment_create');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'assignment_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Assignment creation error:', error);
    return NextResponse.json(
      { error: 'Görevlendirme oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

