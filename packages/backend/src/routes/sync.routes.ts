import { Router, type Router as RouterType } from 'express';
import { prisma } from '../services/db';
import { runFullSync, runIncrementalSync } from '../sync';

const router: RouterType = Router();

// POST /api/v1/sync/run - Trigger a sync
router.post('/run', async (req, res) => {
  // Verify API key
  const apiKey = req.headers['x-sync-api-key'];
  const expectedKey = process.env.SYNC_API_KEY;

  if (!expectedKey) {
    res.status(500).json({ error: 'SYNC_API_KEY not configured on server' });
  } else if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'Invalid or missing API key' });
  } else {
    // Check if sync is already running
    const runningSync = await prisma.syncLog.findFirst({
      where: { status: 'running' },
    });

    if (runningSync) {
      res.status(409).json({ error: 'A sync is already running', syncId: runningSync.id });
    } else {
      const syncType = (req.query.type as string) || 'incremental';

      if (syncType !== 'full' && syncType !== 'incremental') {
        res.status(400).json({ error: 'Invalid sync type. Must be "full" or "incremental"' });
      } else {
        // Start sync in background and return immediately
        res.json({
          message: `${syncType} sync started`,
          type: syncType,
          startedAt: new Date().toISOString(),
        });

        // Run sync after responding (fire and forget)
        const runSync = async () => {
          try {
            if (syncType === 'full') {
              await runFullSync();
            } else {
              await runIncrementalSync();
            }
          } catch (error) {
            console.error(`Sync (${syncType}) failed:`, error);
          }
        };
        runSync();
      }
    }
  }
});

// GET /api/v1/sync/status - Get sync status
router.get('/status', async (req, res) => {
  try {
    // Get latest sync logs
    const [lastFullSync, lastIncrementalSync, runningSync] = await Promise.all([
      prisma.syncLog.findFirst({
        where: { type: 'full', status: 'completed' },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.syncLog.findFirst({
        where: { type: 'incremental', status: 'completed' },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.syncLog.findFirst({
        where: { status: 'running' },
      }),
    ]);

    // Get database statistics
    const [billCount, amendmentCount, memberCount] = await Promise.all([
      prisma.bill.count(),
      prisma.amendment.count(),
      prisma.member.count(),
    ]);

    res.json({
      lastFullSync: lastFullSync?.completedAt || null,
      lastIncrementalSync: lastIncrementalSync?.completedAt || null,
      isRunning: !!runningSync,
      currentTask: runningSync ? 'Syncing data...' : null,
      stats: {
        bills: billCount,
        amendments: amendmentCount,
        members: memberCount,
      },
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

export default router;
