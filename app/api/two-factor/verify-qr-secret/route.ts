import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import speakeasy from 'speakeasy';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: '2FA secret not found' },
        { status: 404 }
      );
    }

    const dbSecret = String(user.twoFactorSecret).trim();
    
    // QR kod URL'ini yeniden oluştur ve secret'ı parse et
    const qrCodeUrl = `otpauth://totp/LPBH%20FOP%20(${user.username})?secret=${dbSecret}&issuer=LPBH%20FOP`;
    
    // URL'den secret'ı parse et (Microsoft Authenticator'ın yaptığı gibi)
    const urlParams = new URL(qrCodeUrl).searchParams;
    const parsedSecret = urlParams.get('secret');
    
    // Mevcut token'ları oluştur (hem DB secret hem de parsed secret ile)
    const time = Math.floor(Date.now() / 1000);
    
    const dbToken = speakeasy.totp({
      secret: dbSecret,
      encoding: 'base32',
      step: 30,
    });
    
    const parsedToken = parsedSecret ? speakeasy.totp({
      secret: parsedSecret,
      encoding: 'base32',
      step: 30,
    }) : null;

    // Window içindeki tüm token'ları oluştur
    const dbTokens = [];
    const parsedTokens = [];
    
    for (let i = -3; i <= 3; i++) {
      const dbToken = speakeasy.totp({
        secret: dbSecret,
        encoding: 'base32',
        step: 30,
        time: time + (i * 30),
      });
      dbTokens.push({
        offset: i,
        token: dbToken,
        timeWindow: `${i * 30}s`,
      });
      
      if (parsedSecret) {
        const parsedToken = speakeasy.totp({
          secret: parsedSecret,
          encoding: 'base32',
          step: 30,
          time: time + (i * 30),
        });
        parsedTokens.push({
          offset: i,
          token: parsedToken,
          timeWindow: `${i * 30}s`,
        });
      }
    }

    return NextResponse.json({
      username: user.username,
      twoFactorEnabled: user.twoFactorEnabled,
      dbSecret: {
        preview: dbSecret.substring(0, 20) + '...',
        length: dbSecret.length,
        isBase32: /^[A-Z2-7]+$/.test(dbSecret),
        currentToken: dbToken,
        allTokens: dbTokens,
      },
      parsedSecret: parsedSecret ? {
        preview: parsedSecret.substring(0, 20) + '...',
        length: parsedSecret.length,
        isBase32: /^[A-Z2-7]+$/.test(parsedSecret),
        currentToken: parsedToken,
        allTokens: parsedTokens,
        matchesDbSecret: parsedSecret === dbSecret,
      } : null,
      qrCodeUrl,
      instruction: 'Microsoft Authenticator\'dan gösterilen token ile bu listedeki token\'ları karşılaştırın. Eğer hiçbiri eşleşmiyorsa, cihazınızın saat ayarını kontrol edin veya QR kodunu yeniden tarayın.',
    });
  } catch (error) {
    console.error('Verify QR secret API error:', error);
    return NextResponse.json(
      { 
        error: 'Verify QR secret API failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


