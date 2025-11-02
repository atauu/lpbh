import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Tüm rütbe gruplarını listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const groups = await prisma.roleGroup.findMany({
      include: {
        roles: {
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Role groups fetch error:', error);
    return NextResponse.json(
      { error: 'Rütbe grupları yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Yeni rütbe grubu ekle
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
    const { name, description, order } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Grup adı zorunludur' },
        { status: 400 }
      );
    }

    const existingGroup = await prisma.roleGroup.findUnique({
      where: { name },
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: 'Bu grup adı zaten mevcut' },
        { status: 400 }
      );
    }

    const newGroup = await prisma.roleGroup.create({
      data: {
        name,
        description: description || null,
        order: order || 0,
      },
    });

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error) {
    console.error('Role group creation error:', error);
    return NextResponse.json(
      { error: 'Rütbe grubu oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

