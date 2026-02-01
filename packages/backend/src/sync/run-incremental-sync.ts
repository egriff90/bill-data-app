import { runIncrementalSync } from './incremental-sync';

async function main() {
  console.log('='.repeat(60));
  console.log('UK Parliament Bill Amendment Sync (Incremental)');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  try {
    const stats = await runIncrementalSync();
    console.log('');
    console.log('='.repeat(60));
    console.log('Sync Summary');
    console.log('='.repeat(60));
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

main();
