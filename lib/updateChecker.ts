import cron, { ScheduledTask } from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

let updateCronJob: ScheduledTask | null = null;

export function startAutoUpdate() {
  if (updateCronJob) {
    console.log('Auto-update already running');
    return;
  }

  console.log('Starting auto-update system...');
  console.log('Update scheduled for: Daily at 00:00:00');

  // Her gün saat 00:00'da çalışacak cron job
  updateCronJob = cron.schedule('0 0 * * *', async () => {
    console.log('\n=== AUTO-UPDATE CHECK ===');
    console.log(`Started at: ${new Date().toISOString()}`);
    
    try {
      await performUpdate();
    } catch (error) {
      console.error('Auto-update error:', error);
    }
  });

  console.log('Auto-update system started successfully');
}

export function stopAutoUpdate() {
  if (updateCronJob) {
    updateCronJob.stop();
    updateCronJob = null;
    console.log('Auto-update system stopped');
  }
}

async function performUpdate() {
  const projectRoot = process.cwd();
  const logFile = path.join(projectRoot, 'update.log');
  
  try {
    console.log('Checking for updates...');
    
    // Git fetch ile remote değişiklikleri kontrol et
    const { stdout: fetchOutput } = await execAsync('git fetch origin', {
      cwd: projectRoot,
    });
    console.log('Git fetch completed');

    // Mevcut branch'i kontrol et
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectRoot,
    });
    const branch = currentBranch.trim();

    // Uzak repo ile karşılaştır
    const { stdout: statusOutput } = await execAsync(`git rev-list --count HEAD..origin/${branch}`, {
      cwd: projectRoot,
    }).catch(() => ({ stdout: '0' }));
    
    const commitsBehind = parseInt(statusOutput.trim()) || 0;

    if (commitsBehind === 0) {
      console.log('✓ No updates available. System is up to date.');
      return;
    }

    console.log(`Found ${commitsBehind} new commit(s). Pulling updates...`);

    // Git pull ile güncellemeleri çek
    const { stdout: pullOutput } = await execAsync('git pull origin', {
      cwd: projectRoot,
    });
    console.log('Git pull completed:', pullOutput);

    // package.json değiştiyse npm install çalıştır
    const { stdout: diffOutput } = await execAsync(
      'git diff --name-only HEAD@{1} HEAD | grep -E "^package\.json$|^package-lock\.json$" || true',
      { cwd: projectRoot }
    );

    if (diffOutput.trim()) {
      console.log('Dependencies changed. Running npm install...');
      const { stdout: installOutput } = await execAsync('npm install', {
        cwd: projectRoot,
      });
      console.log('npm install completed');
    }

    // Prisma schema değiştiyse generate ve push çalıştır
    const { stdout: schemaDiff } = await execAsync(
      'git diff --name-only HEAD@{1} HEAD | grep "schema.prisma" || true',
      { cwd: projectRoot }
    );

    if (schemaDiff.trim()) {
      console.log('Prisma schema changed. Running migrations...');
      await execAsync('npm run db:generate', { cwd: projectRoot });
      await execAsync('npm run db:push', { cwd: projectRoot });
      console.log('Prisma migrations completed');
    }

    console.log('✓ Update completed successfully!');
    console.log('System needs to be restarted for changes to take effect.');

    // Log dosyasına yaz
    const logMessage = `[${new Date().toISOString()}] Update completed: ${commitsBehind} commit(s) pulled\n`;
    const fs = require('fs');
    fs.appendFileSync(logFile, logMessage);

    // Sistemi yeniden başlatma uyarısı (otomatik restart yapmıyoruz, güvenlik için)
    console.log('\n⚠️  Please restart the server manually to apply changes.');
    
  } catch (error: any) {
    console.error('Update failed:', error.message);
    const logMessage = `[${new Date().toISOString()}] Update failed: ${error.message}\n`;
    const fs = require('fs');
    fs.appendFileSync(logFile, logMessage);
    throw error;
  }
}

// Manuel güncelleme için fonksiyon
export async function manualUpdate() {
  console.log('Manual update triggered');
  try {
    await performUpdate();
    return { success: true, message: 'Update completed successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
