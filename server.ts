#!/usr/bin/env node
import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import { startAutoUpdate, stopAutoUpdate } from './lib/updateChecker';

let serverProcess: ChildProcess | null = null;

function startNextServer() {
  console.log('Starting Next.js server...');
  
  // Next.js sunucusunu başlat
  serverProcess = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true,
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

// Ana fonksiyon
async function main() {
  console.log('=== LPBH FOP Server ===\n');

  // Komut satırı argümanlarını kontrol et
  const args = process.argv.slice(2);
  const enableUpdate = args.includes('--enable-update') || args.includes('-u');

  if (!enableUpdate) {
    // Parametre yoksa sor
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Do you want to enable auto-update system? (Y/N): ', resolve);
    });

    rl.close();

    if (answer.trim().toUpperCase() === 'Y') {
      console.log('Auto-update enabled');
      startAutoUpdate();
    } else {
      console.log('Auto-update disabled');
    }
  } else {
    console.log('Auto-update enabled (via parameter)');
    startAutoUpdate();
  }

  // Sunucuyu başlat
  startNextServer();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
