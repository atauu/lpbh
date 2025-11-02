#!/bin/bash

# PostgreSQL veritabanı kurulum scripti

echo "🚀 LPBH FOP - PostgreSQL Kurulum Scripti"
echo ""

# PostgreSQL servisini kontrol et
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL bulunamadı. Lütfen PostgreSQL'i yükleyin:"
    echo "   macOS: brew install postgresql@14"
    echo "   Linux: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

echo "✅ PostgreSQL bulundu"
echo ""

# Veritabanı adı
DB_NAME="lpbh_fop"
DB_USER="${USER}"

# Kullanıcıdan PostgreSQL şifresi iste
read -sp "PostgreSQL kullanıcı şifrenizi girin (boş bırakabilirsiniz): " PG_PASSWORD
echo ""

# Veritabanını oluştur
echo "📦 Veritabanı oluşturuluyor: $DB_NAME"
createdb $DB_NAME 2>/dev/null || echo "⚠️  Veritabanı zaten mevcut veya oluşturulamadı"
echo ""

# .env dosyası kontrolü
if [ ! -f .env ]; then
    echo "📝 .env dosyası oluşturuluyor..."
    
    # NEXTAUTH_SECRET oluştur
    if command -v openssl &> /dev/null; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
    else
        NEXTAUTH_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    fi
    
    cat > .env << EOF
# Database
DATABASE_URL="postgresql://${DB_USER}${PG_PASSWORD:+:${PG_PASSWORD}}@localhost:5432/${DB_NAME}?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
EOF
    echo "✅ .env dosyası oluşturuldu"
else
    echo "⚠️  .env dosyası zaten mevcut"
fi

echo ""
echo "✅ Kurulum tamamlandı!"
echo ""
echo "📋 Sonraki adımlar:"
echo "   1. npm install"
echo "   2. npm run db:generate"
echo "   3. npm run db:push"
echo "   4. npm run db:seed"
echo "   5. npm run dev"


