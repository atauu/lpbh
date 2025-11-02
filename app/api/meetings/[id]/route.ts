import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// DELETE: Toplantı kaydını sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    if (!hasPermission(permissions, 'meetings', 'delete')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const meetingId = params.id;

    // Önce meeting'i bul (dosya yolunu almak için)
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        filePath: true,
        title: true,
      },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: 'Toplantı kaydı bulunamadı' },
        { status: 404 }
      );
    }

    // Dosya yolunu oluştur
    let filePath: string;
    if (meeting.filePath.startsWith('uploads/')) {
      filePath = join(process.cwd(), meeting.filePath);
    } else if (meeting.filePath.startsWith('/')) {
      filePath = meeting.filePath;
    } else {
      filePath = join(process.cwd(), meeting.filePath);
    }

    // Meeting'i sil (cascade ile attendances da silinecek)
    await prisma.meeting.delete({
      where: { id: meetingId },
    });

    // Dosyayı da sil (varsa)
    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
        console.log('File deleted:', filePath);
      } catch (error) {
        console.error('File deletion error:', error);
        // Dosya silinmese bile devam et
      }
    }

    // Toplantı silme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'meeting_delete');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'meeting_delete',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Meeting deletion error:', error);
    return NextResponse.json(
      { error: 'Toplantı kaydı silinemedi' },
      { status: 500 }
    );
  }
}

