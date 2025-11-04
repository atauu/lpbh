import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

export const dynamic = 'force-dynamic';

// GET: Tüm araştırmaları listele
export async function GET(request: NextRequest) {
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
    if (!hasPermission(permissions, 'researches', 'read')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || '';
    const searchType = searchParams.get('searchType') || 'all'; // 'title' | 'all'
    const authorId = searchParams.get('authorId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // Filtreleme koşulları
    const where: any = {};

    // Yazar filtresi
    if (authorId) {
      where.createdBy = authorId;
    }

    // Tarih aralığı filtresi
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateObj;
      }
    }

    // Arama filtresi
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      if (searchType === 'title') {
        // Sadece başlıkta ara
        where.title = {
          contains: searchTerm,
          mode: 'insensitive',
        };
      } else {
        // Tümü: başlık, içerik ve dosya içeriğinde ara
        where.OR = [
          {
            title: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            content: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          ...(searchTerm.trim()
            ? [
                {
                  fileContent: {
                    contains: searchTerm,
                    mode: 'insensitive',
                  },
                },
              ]
            : []),
        ];
      }
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    const researches = await prisma.research.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
            rutbe: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      ...(limit ? { take: limit } : {}),
    });

    return NextResponse.json(researches);
  } catch (error) {
    console.error('Researches fetch error:', error);
    return NextResponse.json(
      { error: 'Araştırmalar yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Yeni araştırma ekle
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
    if (!hasPermission(permissions, 'researches', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const file = formData.get('file') as File | null;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Başlık ve içerik zorunludur' },
        { status: 400 }
      );
    }

    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileContent: string | null = null;

    // Dosya varsa işle
    if (file && file.size > 0) {
      // Dosya boyutu kontrolü (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Dosya boyutu 10MB\'dan küçük olmalıdır' },
          { status: 400 }
        );
      }

      // Dosya kaydetme
      const uploadsDir = join(process.cwd(), 'uploads', 'researches');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const savedFileName = `${Date.now()}-${sanitizedFileName}`;
      const fullFilePath = join(uploadsDir, savedFileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(fullFilePath, buffer);

      filePath = `uploads/researches/${savedFileName}`;
      fileName = file.name;
      fileSize = file.size;

      // PDF içeriği parse etme (arama için)
      if (file.type === 'application/pdf') {
        try {
          // pdf-parse'ı require et
          const pdfParse = require('pdf-parse');
          let parseFunction: any = null;

          if (typeof pdfParse === 'function') {
            parseFunction = pdfParse;
          } else if (pdfParse.default && typeof pdfParse.default === 'function') {
            parseFunction = pdfParse.default;
          } else if (pdfParse.PDFParse) {
            const PDFParseClass = pdfParse.PDFParse;
            const parser = new PDFParseClass({ data: buffer });
            const pdfData = await parser.getText({});
            fileContent = pdfData.text || '';
          }

          if (parseFunction && typeof parseFunction === 'function') {
            const pdfData = await parseFunction(buffer);
            fileContent = pdfData.text || '';
          }
        } catch (error: any) {
          console.error('PDF parse error:', error?.message || error);
          // PDF parse hatası durumunda devam et
        }
      }
    }

    // Araştırma oluştur
    const research = await prisma.research.create({
      data: {
        title,
        content,
        filePath,
        fileName,
        fileSize,
        fileContent,
        createdBy: session.user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
            rutbe: true,
          },
        },
      },
    });

    // Araştırma oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}`
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'research_create');
    
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logActivity(
      session.user.id,
      'research_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(research, { status: 201 });
  } catch (error) {
    console.error('Research creation error:', error);
    return NextResponse.json(
      {
        error: 'Araştırma oluşturulamadı',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

