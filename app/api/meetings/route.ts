import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tüm toplantı kayıtlarını listele
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
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    // Kullanıcının rütbesini ve grubunu al
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.rutbe) {
      // Rütbe yoksa sadece herkes için olanları göster
      const meetings = await prisma.meeting.findMany({
        where: {
          visibility: 'herkes',
        },
        select: {
          id: true,
          title: true,
          meetingDate: true,
          fileName: true,
          fileSize: true,
          content: true,
          visibility: true,
          uploadedBy: true,
          createdAt: true,
          attendances: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  isim: true,
                  soyisim: true,
                },
              },
            },
          },
        },
        orderBy: {
          meetingDate: 'desc',
        },
        take: limit,
      });

      return NextResponse.json(meetings);
    }

    // Rütbeyi bul ve grubunu al
    const role = await prisma.role.findUnique({
      where: { name: user.rutbe },
      include: {
        group: true,
      },
    });

    let allowedVisibilities: string[] = [];

    if (!role || !role.group) {
      // Grup yoksa sadece herkes için olanları göster
      allowedVisibilities = ['herkes'];
    } else {
      const userGroupOrder = role.group.order;
      // Visibility mantığı:
      // order 2 (Yönetim) -> yönetim, member, herkes (tümünü görebilmeli)
      // order 1 (Member) -> member, herkes (yönetim ve member görünür olmalı)
      // order 0 (Aday) -> herkes (herkes görünür olmalı)
      if (userGroupOrder === 2) {
        allowedVisibilities = ['herkes', 'member', 'yönetim'];
      } else if (userGroupOrder === 1) {
        allowedVisibilities = ['herkes', 'member'];
      } else {
        allowedVisibilities = ['herkes'];
      }
    }

    const meetings = await prisma.meeting.findMany({
      where: {
        visibility: {
          in: allowedVisibilities,
        },
      },
      select: {
        id: true,
        title: true,
        meetingDate: true,
        fileName: true,
        fileSize: true,
        content: true,
        visibility: true,
        uploadedBy: true,
        createdAt: true,
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
      },
      orderBy: {
        meetingDate: 'desc',
      },
      take: limit,
    });

    return NextResponse.json(meetings);
  } catch (error) {
    console.error('Meetings fetch error:', error);
    return NextResponse.json(
      { error: 'Toplantı kayıtları yüklenemedi' },
      { status: 500 }
    );
  }
}

// POST: Yeni toplantı kaydı ekle
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
    if (!hasPermission(permissions, 'meetings', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const meetingDate = formData.get('meetingDate') as string;
    const file = formData.get('file') as File;
    const attendees = formData.getAll('attendees') as string[];
    const visibility = (formData.get('visibility') as string) || 'herkes';
    
    console.log('Meeting creation data:', {
      title,
      meetingDate,
      fileName: file?.name,
      fileSize: file?.size,
      attendeesCount: attendees?.length || 0,
      attendees,
    });

    if (!title || !meetingDate || !file) {
      return NextResponse.json(
        { error: 'Başlık, tarih ve dosya zorunludur' },
        { status: 400 }
      );
    }

    // Dosya boyutu kontrolü (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Dosya boyutu 10MB\'dan küçük olmalıdır' },
        { status: 400 }
      );
    }

    // PDF kontrolü
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Sadece PDF dosyaları yüklenebilir' },
        { status: 400 }
      );
    }

    // Dosya kaydetme
    const uploadsDir = join(process.cwd(), 'uploads', 'meetings');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Dosya adını temizle (özel karakterleri kaldır)
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${sanitizedFileName}`;
    const filePath = join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Veritabanına kaydedilecek path (relative path)
    const relativeFilePath = `uploads/meetings/${fileName}`;

    // PDF içeriği parse etme
    let content: string | null = null;
    try {
      // pdfjs-dist worker'ını yapılandır (server-side'da worker gerekmez)
      // Bu hatayı önlemek için: "Cannot find module './pdf.worker.mjs'"
      try {
        const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
        if (pdfjs.GlobalWorkerOptions) {
          // Worker'ı disable et - server-side'da gerekmez
          pdfjs.GlobalWorkerOptions.workerSrc = false;
        }
      } catch (workerConfigError) {
        // Worker config hatası önemli değil, devam et
      }
      
      // pdf-parse'ı require et (webpack externals sayesinde bundle edilmeden)
      const pdfParse = require('pdf-parse');
      
      // pdf-parse'un export yapısını kontrol et ve doğru fonksiyonu kullan
      let parseFunction: any = null;
      
      if (typeof pdfParse === 'function') {
        // Eski API: direkt function
        parseFunction = pdfParse;
      } else if (pdfParse.default && typeof pdfParse.default === 'function') {
        // Default export
        parseFunction = pdfParse.default;
      } else if (pdfParse.PDFParse) {
        // Yeni API: PDFParse class - options object ile kullan
        const PDFParseClass = pdfParse.PDFParse;
        const parser = new PDFParseClass({ data: buffer });
        const pdfData = await parser.getText({});
        content = pdfData.text || '';
        parseFunction = null; // İşlem tamamlandı, function gerekmez
      }
      
      if (parseFunction && typeof parseFunction === 'function') {
        // Eski API ile parse et
        const pdfData = await parseFunction(buffer);
        content = pdfData.text || '';
        console.log('PDF content extracted:', {
          pages: pdfData.numpages || 0,
          contentLength: content?.length || 0,
          preview: content?.substring(0, 100) || '',
        });
      } else if (!content) {
        // Hala içerik yoksa hata ver
        console.error('pdf-parse structure:', {
          type: typeof pdfParse,
          hasDefault: !!pdfParse.default,
          hasPDFParse: !!pdfParse.PDFParse,
          keys: Object.keys(pdfParse).slice(0, 10),
        });
        throw new Error('pdf-parse kullanılamıyor: uygun parse fonksiyonu bulunamadı');
      } else {
        // Yeni API ile başarılı, log yaz
        console.log('PDF content extracted (PDFParse API):', {
          contentLength: content.length,
          preview: content.substring(0, 100),
        });
      }
    } catch (error: any) {
      console.error('PDF parse error:', error?.message || error);
      // PDF parse hatası durumunda devam et, sadece içerik boş kalır
      // Toplantı kaydı oluşturulabilir ama içerik olmadan
    }

    // Debug: Prisma client kontrolü
    console.log('Prisma client check:', {
      prismaExists: !!prisma,
      meetingExists: !!(prisma as any).meeting,
      meetingAttendanceExists: !!(prisma as any).meetingAttendance,
      prismaKeys: prisma ? Object.keys(prisma).filter(k => !k.startsWith('_')) : [],
    });

    // Toplantı kaydı oluştur
    // Önce Meeting'i oluştur
    const meeting = await prisma.meeting.create({
      data: {
        title,
        meetingDate: new Date(meetingDate),
        fileName: file.name, // Orijinal dosya adı
        filePath: relativeFilePath, // Relative path (veritabanında)
        fileSize: file.size,
        content,
        visibility: visibility as 'yönetim' | 'member' | 'herkes',
        uploadedBy: session.user.id,
      },
    });

    // Eğer attendees varsa ve geçerliyse ekle
    const validAttendees = attendees?.filter(
      (userId) => userId && typeof userId === 'string' && userId.trim() !== ''
    ) || [];

    console.log('Creating meeting with data:', {
      meetingId: meeting.id,
      title,
      attendeesCount: validAttendees.length,
      attendees: validAttendees,
    });

    // Attendees varsa ayrı ayrı oluştur
    if (validAttendees.length > 0) {
      await prisma.meetingAttendance.createMany({
        data: validAttendees.map((userId) => ({
          meetingId: meeting.id,
          userId: userId.trim(),
          attended: true,
        })),
        skipDuplicates: true, // Eğer zaten varsa tekrar oluşturma
      });
    }

    // Tüm ilişkilerle birlikte tekrar getir
    const meetingWithAttendances = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: {
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
      },
    });

    // Toplantı oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'meeting_create');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'meeting_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(meetingWithAttendances, { status: 201 });
  } catch (error) {
    console.error('Meeting creation error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Toplantı kaydı oluşturulamadı',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

