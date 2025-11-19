// Ücretsiz proxy test scripti
// Bu script çalışan bir proxy bulmak için kullanılabilir

import puppeteer from 'puppeteer';

// Ücretsiz proxy listesi (örnek - gerçek proxy'ler güncel olmayabilir)
const testProxies = [
  // Bu proxy'ler örnek, gerçek çalışan proxy'lerle değiştirilmeli
  // Format: host:port
];

async function testProxy(proxy: string) {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      args: [`--proxy-server=${proxy}`],
    });
    
    const page = await browser.newPage();
    await page.goto('https://pyrocheck.xrent.store', { timeout: 10000 });
    
    const title = await page.title();
    console.log(`Proxy ${proxy} çalışıyor! Sayfa: ${title}`);
    
    await browser.close();
    return true;
  } catch (error) {
    console.log(`Proxy ${proxy} çalışmıyor: ${error}`);
    return false;
  }
}

// Proxy test et
// testProxy('proxy-host:port').then(console.log);





