import { Router, type Router as RouterType } from 'express';
import { prisma } from '../services/db';

const router: RouterType = Router();

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
