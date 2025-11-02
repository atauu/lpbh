import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Mevcut kullanıcıların membershipStatus değerlerini güncelliyor...');

  // Tüm kullanıcıları al
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      membershipStatus: true,
    },
  });

  console.log(`Toplam ${users.length} kullanıcı bulundu`);

  // membershipStatus null veya undefined olan kullanıcıları approved yap
  let updatedCount = 0;
  for (const user of users) {
    if (!user.membershipStatus || user.membershipStatus === null) {
      await prisma.user.update({
        where: { id: user.id },
        data: { membershipStatus: 'approved' },
      });
      console.log(`✓ ${user.username} -> approved`);
      updatedCount++;
    } else {
      console.log(`- ${user.username} -> ${user.membershipStatus} (zaten ayarlanmış)`);
    }
  }

  console.log(`\nToplam ${updatedCount} kullanıcı güncellendi.`);
}

main()
  .catch((e) => {
    console.error('Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


