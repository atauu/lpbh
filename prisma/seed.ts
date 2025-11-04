import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Şifreyi hash'le
  const hashedPassword = await bcrypt.hash('ata', 10);

  // İlk kullanıcıyı oluştur
  const user = await prisma.user.upsert({
    where: { username: 'ata' },
    update: {},
    create: {
      username: 'ata',
      password: hashedPassword,
    },
  });

  console.log('✅ İlk kullanıcı oluşturuldu:', user.username);

  // President kullanıcısını oluştur
  const presidentPassword = await bcrypt.hash('president', 10);
  const president = await prisma.user.upsert({
    where: { username: 'thepresident' },
    update: {
      password: presidentPassword,
      rutbe: 'PRESIDENT',
    },
    create: {
      username: 'thepresident',
      password: presidentPassword,
      rutbe: 'PRESIDENT',
      membershipStatus: 'approved',
    },
  });

  console.log('✅ President kullanıcı oluşturuldu:', president.username);
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


