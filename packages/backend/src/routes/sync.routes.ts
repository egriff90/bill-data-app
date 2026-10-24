import { Router, type Router as RouterType } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { prisma } from '../services/db';
import { runFullSync, runIncrementalSync } from '../sync';
import { rateLimit } from '../middleware/security';
import { queryString } from './query';

const router: RouterType = Router();

// Compares digests so the time taken doesn't reveal how much of the key was right.
function keyMatches(supplied: unknown, expected: string): boolean {
  if (typeof supplied !== 'string') return false;
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// POST /api/v1/sync/run - Trigger a sync
// Limited per IP so the key can't be guessed by brute force.
router.post('/run', rateLimit(60 * 60_000, 10), async (req, res) => {
  // Verify API key
  const apiKey = req.headers['x-sync-api-key'];
  const expectedKey = process.env.SYNC_API_KEY;

  if (!expectedKey) {
    res.status(500).json({ error: 'SYNC_API_KEY not configured on server' });
  } else if (!keyMatches(apiKey, expectedKey)) {
    res.status(401).json({ error: 'Invalid or missing API key' });
  } else {
    // Check if sync is already running
    const runningSync = await prisma.syncLog.findFirst({
      where: { status: 'running' },
    });

    if (runningSync) {
      res.status(409).json({ error: 'A sync is already running', syncId: runningSync.id });
    } else {
      const syncType = queryString(req.query.type) || 'incremental';

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
