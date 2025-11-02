import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Mevcut kullanıcıları approved yapıyoruz...');

  // Tüm kullanıcıları al
  const users = await prisma.user.findMany();

  for (const user of users) {
    // membershipStatus null veya undefined ise veya pending_info ise (mevcut kullanıcılar için)
    if (!user.membershipStatus || user.membershipStatus === 'pending_info') {
      await prisma.user.update({
        where: { id: user.id },
        data: { membershipStatus: 'approved' },
      });
      console.log(`✓ ${user.username} -> approved`);
    } else {
      console.log(`- ${user.username} -> ${user.membershipStatus} (zaten ayarlanmış)`);
    }
  }

  console.log('\nİşlem tamamlandı.');
}

main()
  .catch((e) => {
    console.error('Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


