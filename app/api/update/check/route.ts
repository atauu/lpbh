import { NextRequest, NextResponse } from 'next/server';
import { manualUpdate } from '@/lib/updateChecker';

// Manuel güncelleme endpoint'i
export async function POST(request: NextRequest) {
  try {
    const result = await manualUpdate();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
