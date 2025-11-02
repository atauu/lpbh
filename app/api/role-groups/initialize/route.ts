import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST: Varsayılan rütbe gruplarını oluştur ve mevcut rütbeleri gruplara ata
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Gruplar zaten var mı kontrol et
    const existingGroups = await prisma.roleGroup.findMany();
    if (existingGroups.length > 0) {
      return NextResponse.json(
        { error: 'Rütbe grupları zaten mevcut' },
        { status: 400 }
      );
    }

    // Varsayılan grupları oluştur
    const yonetimGroup = await prisma.roleGroup.create({
      data: {
        name: 'Yönetim',
        description: 'Yönetim grubu rütbeleri',
        order: 2,
      },
    });

    const memberGroup = await prisma.roleGroup.create({
      data: {
        name: 'Member',
        description: 'Üye grubu',
        order: 1,
      },
    });

    const adayGroup = await prisma.roleGroup.create({
      data: {
        name: 'Aday',
        description: 'Aday grubu',
        order: 0,
      },
    });

    // Mevcut rütbeleri gruplara ata
    const yonetimRoles = ['PRESIDENT', 'V. PRESIDENT', 'SGT. AT ARMS', 'ROAD CAPTAIN', 'TAILGUNNER'];
    const memberRoles = ['MEMBER'];
    const adayRoles = ['PROSPECT', 'HANGAROUND'];

    // Yönetim rütbelerini ata
    for (const roleName of yonetimRoles) {
      await prisma.role.updateMany({
        where: { name: roleName },
        data: { groupId: yonetimGroup.id },
      });
    }

    // Member rütbelerini ata
    for (const roleName of memberRoles) {
      await prisma.role.updateMany({
        where: { name: roleName },
        data: { groupId: memberGroup.id },
      });
    }

    // Aday rütbelerini ata
    for (const roleName of adayRoles) {
      await prisma.role.updateMany({
        where: { name: roleName },
        data: { groupId: adayGroup.id },
      });
    }

    return NextResponse.json({
      message: 'Rütbe grupları başarıyla oluşturuldu ve rütbeler atandı',
      groups: [yonetimGroup, memberGroup, adayGroup],
    });
  } catch (error) {
    console.error('Role groups initialization error:', error);
    return NextResponse.json(
      { error: 'Rütbe grupları oluşturulamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

