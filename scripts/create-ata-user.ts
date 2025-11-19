import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Mevcut kullanıcıyı kontrol et
  const existingUser = await prisma.user.findUnique({
    where: { username: 'ata' },
  });

  if (existingUser) {
    console.log('Kullanıcı "ata" zaten mevcut. Güncelleniyor...');
    
    // Şifreyi hash'le
    const hashedPassword = await bcrypt.hash('ata', 10);
    
    // Kullanıcıyı güncelle
    await prisma.user.update({
      where: { username: 'ata' },
      data: {
        password: hashedPassword,
        rutbe: 'PRESIDENT',
        membershipStatus: 'approved',
        isim: null,
        soyisim: null,
        tckn: null,
        telefon: null,
        evAdresi: null,
        yakiniIsmi: null,
        yakiniTelefon: null,
        ruhsatSeriNo: null,
        kanGrubu: null,
      },
    });
    
    console.log('Kullanıcı "ata" başarıyla güncellendi.');
  } else {
    console.log('Yeni kullanıcı "ata" oluşturuluyor...');
    
    // Şifreyi hash'le
    const hashedPassword = await bcrypt.hash('ata', 10);
    
    // Yeni kullanıcı oluştur
    const user = await prisma.user.create({
      data: {
        username: 'ata',
        password: hashedPassword,
        rutbe: 'PRESIDENT',
        membershipStatus: 'approved',
        // Diğer alanlar null olarak kalacak
      },
    });
    
    console.log('Kullanıcı "ata" başarıyla oluşturuldu:', user);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


