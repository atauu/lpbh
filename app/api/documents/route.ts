import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

// GET: Belgeleri listele (arama + filtre)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const uploaderId = searchParams.get('uploaderId') || '';
  // Yeni: tek parametre ile tarih desteği
  const dateParam = searchParams.get('date') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const visibility = searchParams.get('visibility') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    const where: any = {};

    if (uploaderId) {
      where.uploadedBy = uploaderId;
    }

  // Görünürlük filtresi
  if (visibility) {
    where.visibility = visibility;
  }

  if (dateParam || startDate || endDate) {
      where.createdAt = {};
    if (dateParam) {
      // 'YYYY-MM-DD' veya 'YYYY-MM-DD,YYYY-MM-DD' formatı
      const parts = dateParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 2) {
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        end.setHours(23, 59, 59, 999);
        where.createdAt.gte = start;
        where.createdAt.lte = end;
      } else if (parts.length === 1) {
        const only = new Date(parts[0]);
        const end = new Date(parts[0]);
        end.setHours(23, 59, 59, 999);
        where.createdAt.gte = only;
        where.createdAt.lte = end;
      }
    } else {
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
      }
    }

    if (search.trim()) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Documents fetch error:', error);
    return NextResponse.json(
      { error: 'Belgeler yüklenemedi' },
      { status: 500 }
    );
  }
}

// POST: Yeni belge ekle (PDF)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const file = formData.get('file') as File;
    const visibility = (formData.get('visibility') as string) || 'herkes';

    if (!title || !file) {
      return NextResponse.json(
        { error: 'Başlık ve dosya zorunludur' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Dosya boyutu 10MB\'dan küçük olmalıdır' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Sadece PDF dosyaları yüklenebilir' },
        { status: 400 }
      );
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'documents');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const savedFileName = `${Date.now()}-${sanitizedFileName}`;
    const fullPath = join(uploadsDir, savedFileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(fullPath, buffer);

    const relativePath = `uploads/documents/${savedFileName}`;

    // PDF içeriğini parse et (meetings/researches mantığına benzer)
    let content: string | null = null;
    try {
      const pdfParse = require('pdf-parse');
      let parseFn: any = null;
      if (typeof pdfParse === 'function') {
        parseFn = pdfParse;
      } else if (pdfParse.default && typeof pdfParse.default === 'function') {
        parseFn = pdfParse.default;
      } else if (pdfParse.PDFParse) {
        const PDFParseClass = pdfParse.PDFParse;
        const parser = new PDFParseClass({ data: buffer });
        const pdfData = await parser.getText({});
        content = pdfData.text || '';
      }
      if (parseFn) {
        const pdfData = await parseFn(buffer);
        content = pdfData.text || '';
      }
    } catch (err) {
      console.error('Document PDF parse error:', err);
    }

    const doc = await prisma.document.create({
      data: {
        title,
        description: description || null,
        filePath: relativePath,
        fileName: file.name,
        fileSize: file.size,
        visibility,
        uploadedBy: session.user.id,
        content,
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
          },
        },
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error('Document creation error:', error);
    return NextResponse.json(
      { error: 'Belge oluşturulamadı' },
      { status: 500 }
    );
  }
}


