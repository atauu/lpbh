// Test script for guncel-adres-sorgula API
// Bu script network trafiğini görmek için kullanılabilir

const fetch = require('node-fetch');

async function testAPI() {
  console.log('🧪 Güncel Adres Sorgula API Test');
  console.log('================================\n');
  
  // NOT: Bu script session gerektiriyor, bu yüzden direkt çalıştırılamaz
  // Frontend'den "Güncel Adres Sorgula" butonuna tıklayın ve console loglarını izleyin
  
  console.log('ℹ️  Bu API endpoint\'i session gerektiriyor.');
  console.log('ℹ️  Test için:');
  console.log('   1. Frontend\'e gidin: http://localhost:3000/dashboard/vatandas-veritabani');
  console.log('   2. Bir vatandaş arayın');
  console.log('   3. Detay görünümünde "Güncel Adres Sorgula" butonuna tıklayın');
  console.log('   4. Console loglarını izleyin (🌐 ve 📥 işaretleriyle API istekleri görünecek)');
  console.log('\n');
  console.log('📋 İzlenecek API Endpoint\'leri:');
  console.log('   - Login API: /query/signin veya /api/auth/login');
  console.log('   - İkametgah Sorgu API: /query/ikametgah-sorgu veya benzeri');
  console.log('   - Submit API: POST isteği ile TCKN gönderimi');
}

testAPI().catch(console.error);




