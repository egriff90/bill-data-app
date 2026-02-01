/**
 * Cron entry point for Railway scheduled jobs
 * Runs an incremental sync and exits when complete
 */
import { runIncrementalSync } from './incremental-sync';

async function main() {
  console.log('='.repeat(60));
  console.log('UK Parliament Bill Amendment Sync (Cron Job)');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('Running incremental sync...');
  console.log('');

  try {
    const stats = await runIncrementalSync();
    console.log('');
    console.log('='.repeat(60));
    console.log('Sync Summary');
    console.log('='.repeat(60));
    console.log(JSON.stringify(stats, null, 2));
    console.log(`Completed at: ${new Date().toISOString()}`);
    process.exit(0);
  } catch (error) {
    console.error('Cron sync failed:', error);
    process.exit(1);
  }
}

main();
