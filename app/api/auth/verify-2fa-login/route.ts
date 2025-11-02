import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { verifyTwoFactorToken } from '@/lib/two-factor';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, username } = body;

    console.log('2FA Login Verification Request:', {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenType: typeof token,
      hasUsername: !!username,
      username: username,
    });

    // Token'ı string'e çevir ve temizle
    const cleanToken = String(token || '').trim().replace(/\D/g, '').slice(0, 6);
    
    if (!cleanToken || cleanToken.length !== 6) {
      console.error('Invalid token format:', { token, cleanToken });
      return NextResponse.json(
        { error: 'Geçerli bir 6 haneli token girin' },
        { status: 400 }
      );
    }

    // Önce session'ı kontrol et
    const session = await getServerSession(authOptions);
    
    console.log('Session check:', {
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      providedUsername: username,
    });
    
    let user;
    
    if (session?.user?.id) {
      // Session varsa ID ile kullanıcıyı bul
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });
      console.log('User found by session ID:', { userId: user?.id, username: user?.username });
    } else if (username) {
      // Session yoksa username ile kullanıcıyı bul (login'den sonra buraya gelmiş olabilir)
      user = await prisma.user.findUnique({
        where: { username: String(username).trim() },
      });
      console.log('User found by username:', { userId: user?.id, username: user?.username });
    } else {
      console.error('No session and no username provided');
      return NextResponse.json(
        { error: 'Unauthorized - Session veya username gerekli' },
        { status: 401 }
      );
    }

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA kurulmamış' },
        { status: 400 }
      );
    }

    // Token'ı doğrula (temizlenmiş token ile)
    console.log('2FA Verification attempt:', {
      userId: user.id,
      username: user.username,
      secretExists: !!user.twoFactorSecret,
      secretLength: user.twoFactorSecret?.length,
      originalToken: token,
      cleanToken: cleanToken,
      tokenLength: cleanToken.length,
    });

    const isValid = verifyTwoFactorToken(user.twoFactorSecret!, cleanToken);

    console.log('2FA Verification result:', {
      isValid,
      userId: user.id,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: 'Geçersiz token. Lütfen Microsoft Authenticator uygulamanızdan yeni bir kod alın ve tekrar deneyin.' },
        { status: 400 }
      );
    }

    // Token geçerli - eğer session yoksa, şimdi login yapılmalı
    // Ama şifre gerekiyor. Bu durumda frontend'de handle edeceğiz
    return NextResponse.json({
      success: true,
      message: '2FA doğrulaması başarılı',
      username: user.username, // Frontend'de kullanmak için
    });
  } catch (error) {
    console.error('2FA login verification error:', error);
    return NextResponse.json(
      { error: 'Doğrulama başarısız oldu' },
      { status: 500 }
    );
  }
}

