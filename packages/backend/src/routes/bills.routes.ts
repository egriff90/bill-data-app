import { Router } from 'express';
import { prisma } from '../services/db';

const router = Router();

// GET /api/v1/bills - List bills with optional filtering
router.get('/', async (req, res) => {
  try {
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : undefined;
    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 100;

    // Status filter: 'all', 'active', 'acts', 'withdrawn', 'defeated'
    const status = (req.query.status as string) || 'all';

    const where: any = {};

    if (sessionId) {
      where.sessionId = sessionId;
    }

    // Apply status filter
    switch (status) {
      case 'active':
        where.isWithdrawn = false;
        where.isDefeated = false;
        where.isAct = false;
        break;
      case 'acts':
        where.isAct = true;
        break;
      case 'withdrawn':
        where.isWithdrawn = true;
        break;
      case 'defeated':
        where.isDefeated = true;
        break;
      // 'all' - no filter
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        orderBy: { shortTitle: 'asc' },
        skip,
        take,
        include: {
          session: {
            select: { name: true },
          },
          _count: {
            select: { stages: true },
          },
          stages: {
            include: {
              _count: {
                select: { amendments: true },
              },
            },
          },
        },
      }),
      prisma.bill.count({ where }),
    ]);

    res.json({
      items: bills.map(bill => ({
        id: bill.id,
        shortTitle: bill.shortTitle,
        longTitle: bill.longTitle,
        sessionId: bill.sessionId,
        sessionName: bill.session.name,
        introducedSessionId: bill.introducedSessionId,
        isCarryOver: bill.introducedSessionId !== null && bill.introducedSessionId !== bill.sessionId,
        originatingHouse: bill.originatingHouse,
        currentHouse: bill.currentHouse,
        isWithdrawn: bill.isWithdrawn,
        isDefeated: bill.isDefeated,
        isAct: bill.isAct,
        lastUpdate: bill.lastUpdate,
        stageCount: bill._count.stages,
        amendmentCount: bill.stages.reduce((sum, s) => sum + s._count.amendments, 0),
      })),
      total,
      skip,
      take,
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// GET /api/v1/bills/:id - Get bill details
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        session: true,
        stages: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: { amendments: true },
            },
          },
        },
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json({
      ...bill,
      stages: bill.stages.map(stage => ({
        ...stage,
        amendmentCount: stage._count.amendments,
      })),
    });
  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
});

// GET /api/v1/bills/:id/stages/:stageId/amendments - Get amendments for a stage
router.get('/:id/stages/:stageId/amendments', async (req, res) => {
  try {
    const billId = parseInt(req.params.id);
    const stageId = parseInt(req.params.stageId);
    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 100;

    const [amendments, total] = await Promise.all([
      prisma.amendment.findMany({
        where: { billStageId: stageId },
        skip,
        take,
        include: {
          sponsors: {
            orderBy: { sortOrder: 'asc' },
            include: {
              member: true,
            },
          },
          billStage: {
            include: {
              bill: {
                select: { id: true, shortTitle: true },
              },
            },
          },
        },
      }),
      prisma.amendment.count({ where: { billStageId: stageId } }),
    ]);

    res.json({
      items: amendments.map(a => ({
        id: a.id,
        amendmentNumber: a.amendmentNumber,
        amendmentType: a.amendmentType,
        decision: a.decision,
        decisionExplanation: a.decisionExplanation,
        summaryText: a.summaryText,
        bill: a.billStage.bill,
        billStage: {
          id: a.billStage.id,
          description: a.billStage.description,
          house: a.billStage.house,
        },
        sponsors: a.sponsors.map(s => ({
          ...s.member,
          isLead: s.isLead,
          sortOrder: s.sortOrder,
        })),
      })),
      total,
      skip,
      take,
    });
  } catch (error) {
    console.error('Error fetching amendments:', error);
    res.status(500).json({ error: 'Failed to fetch amendments' });
  }
});

export default router;
