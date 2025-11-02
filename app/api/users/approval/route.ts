import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Onay bekleyen üyeleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Sadece yetkili kullanıcılar görebilir (örneğin PRESIDENT, V. PRESIDENT vb.)
    // Bu kontrolü role permissions'a göre yapabilirsiniz
    // Şimdilik herhangi bir kullanıcı görebilir, gerekirse yetki kontrolü ekleyin

    // Hem pending_info hem de pending_approval durumundaki üyeleri göster
    const pendingUsers = await prisma.user.findMany({
      where: {
        membershipStatus: {
          in: ['pending_info', 'pending_approval'],
        },
      },
      select: {
        id: true,
        username: true,
        rutbe: true,
        isim: true,
        soyisim: true,
        tckn: true,
        telefon: true,
        evAdresi: true,
        yakiniIsmi: true,
        yakiniTelefon: true,
        ruhsatSeriNo: true,
        kanGrubu: true,
        membershipStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(pendingUsers);
  } catch (error) {
    console.error('Pending users fetch error:', error);
    return NextResponse.json(
      { error: 'Onay bekleyen üyeler yüklenemedi' },
      { status: 500 }
    );
  }
}

// POST: Üyeliği onayla veya reddet
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, action } = body; // action: 'approve' | 'reject'

    if (!userId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Geçersiz parametreler' },
        { status: 400 }
      );
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    if (user.membershipStatus !== 'pending_approval' && user.membershipStatus !== 'pending_info') {
      return NextResponse.json(
        { error: 'Bu kullanıcı onay bekleyen durumda değil' },
        { status: 400 }
      );
    }

    // Durumu güncelle veya sil
    if (action === 'approve') {
      // Onayla
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          membershipStatus: 'approved',
        },
        select: {
          id: true,
          username: true,
          membershipStatus: true,
          isim: true,
          soyisim: true,
          rutbe: true,
        },
      });

      // Onaylama logunu kaydet
      const approvedUserFullName = updatedUser.isim && updatedUser.soyisim 
        ? `${updatedUser.isim} ${updatedUser.soyisim}` 
        : '';
      const approverName = session?.user?.username || '';
      const approverFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
        ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
        : '';
      const description = getActivityDescription(approverName, approverFullName, 'user_approval_approve', {
        userInfo: updatedUser.isim && updatedUser.soyisim 
          ? `${updatedUser.isim} ${updatedUser.soyisim} (${updatedUser.username})` 
          : updatedUser.username
      });
      
      const ipAddress = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      
      await logActivity(
        session.user.id,
        'user_approval_approve',
        description,
        {},
        ipAddress,
        userAgent
      );

      return NextResponse.json({
        message: 'Üyelik onaylandı',
        user: updatedUser,
      }, { status: 200 });
    } else {
      // Reddet - üyeyi sil
      // Önce bilgileri al
      const userInfo = {
        username: user.username,
        isim: user.isim,
        soyisim: user.soyisim,
        rutbe: user.rutbe,
      };

      await prisma.user.delete({
        where: { id: userId },
      });

      // Reddetme logunu kaydet
      const rejectedUserFullName = userInfo.isim && userInfo.soyisim 
        ? `${userInfo.isim} ${userInfo.soyisim}` 
        : '';
      const rejecterName = session?.user?.username || '';
      const rejecterFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
        ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
        : '';
      const description = getActivityDescription(rejecterName, rejecterFullName, 'user_approval_reject', {
        userInfo: userInfo.isim && userInfo.soyisim 
          ? `${userInfo.isim} ${userInfo.soyisim} (${userInfo.username})` 
          : userInfo.username
      });
      
      const ipAddress = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      
      await logActivity(
        session.user.id,
        'user_approval_reject',
        description,
        {},
        ipAddress,
        userAgent
      );

      return NextResponse.json({
        message: 'Üyelik reddedildi ve üye silindi',
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { error: 'İşlem başarısız' },
      { status: 500 }
    );
  }
}

