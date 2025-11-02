# LPBH - Fonksiyonel Organizasyon Paneli (FOP)

Los Perdidos Brotherhood için özel olarak tasarlanmış web tabanlı fonksiyonel organizasyon paneli.

## Teknoloji Yığını

- **Framework:** Next.js 14+ (App Router)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** NextAuth.js
- **Styling:** Tailwind CSS
- **Language:** TypeScript

## Kurulum

### Gereksinimler

- Node.js 18+ 
- PostgreSQL 14+

### Adımlar

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. PostgreSQL veritabanını oluşturun:
```bash
createdb lpbh_fop
```

3. `.env` dosyasını oluşturun ve aşağıdaki değerleri ekleyin:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/lpbh_fop?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

NEXTAUTH_SECRET için güçlü bir secret key oluşturun:
```bash
openssl rand -base64 32
```

4. Prisma client'ı oluşturun ve veritabanını migrate edin:
```bash
npm run db:generate
npm run db:push
```

5. İlk kullanıcıyı ekleyin:
```bash
npm run db:seed
```

İlk kullanıcı bilgileri:
- Kullanıcı adı: `ata`
- Şifre: `ata`

6. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışacaktır.

## Production Sunucusu

### Standart Başlatma

Production sunucusunu normal şekilde başlatmak için:

```bash
npm run build
npm run server
```

Sunucu başlatılırken otomatik güncelleme sistemi açılmayı sorar.

### Otomatik Güncelleme ile Başlatma

Otomatik güncellemeyi parametre ile aktifleştirmek için:

```bash
npm run build
npm run server:update
```

veya:

```bash
npm run build
npm run server -- --enable-update
```

### Otomatik Güncelleme Sistemi

Otomatik güncelleme sistemi aktifleştirildiğinde:
- Her gün saat 00:00'da GitHub'dan yeni değişiklikler kontrol edilir
- Sadece değişen dosyalar indirilir (git pull)
- package.json değiştiyse `npm install` çalıştırılır
- Prisma schema değiştiyse migration'lar uygulanır
- Güncelleme logları `update.log` dosyasına yazılır

**Önemli:** Güncelleme sonrası sunucuyu manuel olarak yeniden başlatmanız gerekir.

## Veritabanı Yapısı

### Kullanıcı Alanları

- **Zorunlu:** username, password
- **Opsiyonel:** rutbe, isim, soyisim, tckn, telefon, evAdresi, yakiniIsmi, yakiniTelefon, ruhsatSeriNo, kanGrubu

## Güvenlik

- Şifreler bcrypt ile hash'lenir
- NextAuth.js ile güvenli oturum yönetimi
- İleride 2FA desteği eklenecek (Microsoft Authenticator)


