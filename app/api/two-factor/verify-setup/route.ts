import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { verifyTwoFactorToken } from '@/lib/two-factor';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { token } = await request.json();

    // Token'ı temizle ve string'e çevir
    const cleanToken = String(token || '').trim().replace(/\D/g, '').slice(0, 6);

    if (!cleanToken || cleanToken.length !== 6) {
      console.error('Invalid token format in verify-setup:', {
        originalToken: token,
        tokenType: typeof token,
        cleanToken: cleanToken,
        cleanTokenLength: cleanToken.length,
      });
      return NextResponse.json(
        { error: 'Geçerli bir 6 haneli token girin' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: '2FA setup tamamlanmamış' },
        { status: 400 }
      );
    }

    // Secret'ı temizle (authorize ile aynı format)
    const cleanSecret = user.twoFactorSecret ? String(user.twoFactorSecret).trim() : '';

    // Token'ı doğrula
    const isValid = verifyTwoFactorToken(cleanSecret, cleanToken);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Geçersiz token. Lütfen Microsoft Authenticator uygulamanızdan yeni bir kod alın.' },
        { status: 400 }
      );
    }

    // 2FA'yı aktif et
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: '2FA başarıyla aktif edildi',
    });
  } catch (error) {
    console.error('2FA verify setup error:', error);
    return NextResponse.json(
      { error: 'Doğrulama başarısız oldu' },
      { status: 500 }
    );
  }
}

