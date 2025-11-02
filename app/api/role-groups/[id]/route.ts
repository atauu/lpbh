import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Tek bir rütbe grubu detayını getir
export async function GET(
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

    const group = await prisma.roleGroup.findUnique({
      where: { id: params.id },
      include: {
        roles: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Rütbe grubu bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('Role group fetch error:', error);
    return NextResponse.json(
      { error: 'Rütbe grubu yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT: Rütbe grubunu güncelle
export async function PUT(
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

    const body = await request.json();
    const { name, description, order } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Grup adı zorunludur' },
        { status: 400 }
      );
    }

    const updatedGroup = await prisma.roleGroup.update({
      where: { id: params.id },
      data: {
        name,
        description: description || null,
        order: order || 0,
      },
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('Role group update error:', error);
    return NextResponse.json(
      { error: 'Rütbe grubu güncellenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: Rütbe grubunu sil
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

    // Bu gruba ait rütbe var mı kontrol et
    const rolesWithGroup = await prisma.role.count({
      where: { groupId: params.id },
    });

    if (rolesWithGroup > 0) {
      return NextResponse.json(
        { error: 'Bu gruba ait rütbeler olduğu için silinemez.' },
        { status: 400 }
      );
    }

    await prisma.roleGroup.delete({
      where: { id: params.id },
    });

    return NextResponse.json(
      { message: 'Rütbe grubu başarıyla silindi.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Role group deletion error:', error);
    return NextResponse.json(
      { error: 'Rütbe grubu silinemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

