#!/usr/bin/env node
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { startAutoUpdate, stopAutoUpdate } from './lib/updateChecker';

let serverProcess: ChildProcess | null = null;

// Build kontrolü ve gerekirse build yapma
async function ensureBuild(): Promise<void> {
  const prerenderManifest = join(process.cwd(), '.next', 'prerender-manifest.json');
  
  if (!existsSync(prerenderManifest)) {
    console.log('\n⚠️  Build dosyaları eksik. Build yapılıyor...\n');
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: 'inherit',
        shell: false,
        cwd: process.cwd(),
      });

      buildProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('\n✓ Build tamamlandı.\n');
          resolve();
        } else {
          console.error('\n✗ Build başarısız oldu. Lütfen manuel olarak "npm run build" çalıştırın.\n');
          reject(new Error(`Build failed with code ${code}`));
        }
      });

      buildProcess.on('error', (error) => {
        console.error('\n✗ Build hatası:', error);
        reject(error);
      });
    });
  }
}

function startNextServer() {
  console.log('Starting Next.js server...');
  
  // Next.js sunucusunu başlat
  serverProcess = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: false,
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    if (code !== 0 && code !== null) {
      console.log('Server crashed. Exiting...');
      process.exit(1);
    }
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

function stopNextServer() {
  if (serverProcess) {
    console.log('Stopping Next.js server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  stopAutoUpdate();
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  stopNextServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  stopNextServer();
  process.exit(0);
});

// Raw mode ile soru sorma fonksiyonu
function askQuestionWithTimeout(question: string, timeout: number = 10): Promise<string> {
  return new Promise<string>((resolve) => {
    let answered = false;
    let timeLeft = timeout;
    let inputBuffer = '';
    
    // TTY kontrolü - eğer stdin TTY değilse basit bir yaklaşım kullan
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      // TTY değilse, timeout sonrası otomatik olarak "E" kabul et
      console.log(`${question} (${timeout} saniye içinde cevap verilmezse otomatik olarak "Evet" kabul edilecek)`);
      const timeoutId = setTimeout(() => {
        if (!answered) {
          answered = true;
          console.log(`\n${timeout} saniye içinde cevap verilmedi, varsayılan olarak "Evet" kabul edildi.`);
          resolve('E');
        }
      }, timeout * 1000);
      
      // Basit readline ile sor
      process.stdin.setEncoding('utf8');
      process.stdin.resume();
      process.stdin.once('data', (data: string) => {
        if (!answered) {
          answered = true;
          clearTimeout(timeoutId);
          const answer = data.toString().trim().toUpperCase();
          resolve(answer || 'E');
        }
      });
      return;
    }
    
    // Önceki event listener'ları temizle ve stdin'i düzgün temizle
    process.stdin.removeAllListeners('data');
    if (process.stdin.isRaw && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    
    // Yeni satıra geç ve stdout'u flush et
    process.stdout.write('\n');
    
    // Kısa bir bekleme sonrası raw mode'a geç
    setTimeout(() => {
      // Stdin'i raw mode'a geçir (char-by-char okumak için)
      const wasRaw = process.stdin.isRaw;
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      // Geri sayım ve soru gösterimi - daha agresif temizleme
      const updatePrompt = () => {
        const line = `${question} [${timeLeft}s]: ${inputBuffer}`;
        // ANSI escape kodları: cursor'ı satır başına getir, satırı temizle, yaz
        // \x1b[2K = tüm satırı temizle, \x1b[0G = cursor'ı başa getir
        process.stdout.write(`\x1b[2K\x1b[0G${line}`);
      };

      // İlk prompt'u göster
      updatePrompt();

      // İlk güncellemeyi 900ms sonra yap (1 saniye dolmadan önce 10'dan 9'a düşsün)
      const firstUpdate = setTimeout(() => {
        if (!answered && timeLeft === timeout) {
          timeLeft = timeout - 1;
          updatePrompt();
        }
      }, 900);

      // Her saniye geri sayımı güncelle (ilk saniyeden sonra başla)
      const countdown = setInterval(() => {
        if (!answered && timeLeft > 0) {
          timeLeft--;
          updatePrompt();
        } else if (timeLeft <= 0) {
          clearInterval(countdown);
        }
      }, 1000);

      // Timeout sonrası varsayılan olarak "evet" kabul et
      const timeoutId = setTimeout(() => {
        if (!answered) {
          answered = true;
          clearInterval(countdown);
          clearTimeout(firstUpdate);
          process.stdout.write(`\n\n${timeout} saniye içinde cevap verilmedi, varsayılan olarak "Evet" kabul edildi.\n`);
          if (process.stdin.setRawMode) {
            process.stdin.setRawMode(wasRaw);
          }
          process.stdin.pause();
          process.stdin.removeAllListeners('data');
          resolve('E');
        }
      }, timeout * 1000);

      // Kullanıcı input'unu dinle
      const onData = (char: string) => {
        if (answered) return;

        // Enter tuşu (carriage return veya line feed)
        if (char === '\r' || char === '\n') {
          answered = true;
          clearTimeout(timeoutId);
          clearTimeout(firstUpdate);
          clearInterval(countdown);
          process.stdout.write('\n');
          if (process.stdin.setRawMode) {
            process.stdin.setRawMode(wasRaw);
          }
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          
          const finalAnswer = inputBuffer.trim().toUpperCase();
          resolve(finalAnswer || 'E'); // Boşsa varsayılan olarak E
          return;
        }

        // Backspace veya Delete
        if (char === '\u007f' || char === '\u0008') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            updatePrompt();
          }
          return;
        }

        // Ctrl+C
        if (char === '\u0003') {
          process.exit(0);
          return;
        }

        // Diğer karakterleri buffer'a ekle
        if (char.charCodeAt(0) >= 32) { // Printable characters
          inputBuffer += char;
          updatePrompt();
        }
      };

      process.stdin.on('data', onData);
    }, 300); // 300ms bekleme - önceki çıktıların tamamlanması için
  });
}

// Ana fonksiyon
async function main() {
  console.log('=== LPBH FOP Server ===\n');

  // Komut satırı argümanlarını kontrol et
  const args = process.argv.slice(2);
  const enableUpdate = args.includes('--enable-update') || args.includes('-u');

  if (!enableUpdate) {
    // Parametre yoksa sor
    const answer = await askQuestionWithTimeout('Otomatik güncelleme sistemini etkinleştirmek istiyor musunuz? (E/H)', 10);
    
    if (answer.trim().toUpperCase() === 'E' || answer.trim().toUpperCase() === 'Y') {
      console.log('Otomatik güncelleme etkinleştirildi.');
      startAutoUpdate();
    } else {
      console.log('Otomatik güncelleme devre dışı bırakıldı.');
    }
  } else {
    console.log('Otomatik güncelleme etkinleştirildi (parametre ile).');
    startAutoUpdate();
  }

  // Sunucu otomatik başlatma sorusu
  const answer = await askQuestionWithTimeout('Sunucu başlangıcında sunucuyu otomatik olarak başlatmak istiyor musunuz? (E/H)', 10);

  if (answer.trim().toUpperCase() === 'E' || answer.trim().toUpperCase() === 'Y') {
    console.log('Sunucu başlatılıyor...');
    
    // Build kontrolü
    try {
      await ensureBuild();
    } catch (error) {
      console.error('Build kontrolü başarısız:', error);
      console.log('Sunucu başlatılamadı. Lütfen "npm run build" komutunu çalıştırın ve tekrar deneyin.');
      process.exit(1);
    }
    
    startNextServer();
  } else {
    console.log('Sunucu başlatılmadı. Çıkılıyor...');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
