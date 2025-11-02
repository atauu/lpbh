import { NextRequest, NextResponse } from 'next/server';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, metadata } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId ve action gerekli' },
        { status: 400 }
      );
    }

    // IP adresi ve user agent al
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Kullanıcı bilgilerini al (username ve full name için)
    // Bu bilgileri metadata'dan alacağız veya ayrı bir fetch yapacağız
    const description = getActivityDescription(
      body.username || '',
      body.fullName || '',
      action,
      metadata
    );

    await logActivity(
      userId,
      action,
      description,
      metadata,
      ipAddress,
      userAgent
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Activity log error:', error);
    return NextResponse.json(
      { error: 'İşlem kaydı oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


