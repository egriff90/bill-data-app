import { Router } from 'express';
import { prisma } from '../services/db';

const router = Router();

// GET /api/v1/sessions - List all sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { id: 'desc' },
      include: {
        _count: {
          select: { bills: true },
        },
      },
    });

    res.json(sessions.map(s => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      isCurrent: s.isCurrent,
      billCount: s._count.bills,
    })));
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

export default router;
