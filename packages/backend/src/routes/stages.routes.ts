import { Router, type Router as RouterType } from 'express';
import { prisma } from '../services/db';

const router: RouterType = Router();

// GET /api/v1/stages/with-amendments - Stages that have amendments, with sitting dates
router.get('/with-amendments', async (req, res) => {
  try {
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : undefined;
    const house = req.query.house as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 100;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const where: any = {
      bill: { sessionId },
      amendments: { some: {} },
    };

    if (house) {
      where.house = house;
    }

    const stages = await prisma.billStage.findMany({
      where,
      include: {
        bill: {
          select: { id: true, shortTitle: true },
        },
        sittings: {
          orderBy: { date: 'asc' },
        },
        _count: {
          select: { amendments: true },
        },
      },
    });

    // Flatten: one row per sitting date (or one row if no sittings)
    const items: any[] = [];
    for (const stage of stages) {
      if (stage.sittings.length > 0) {
        for (const sitting of stage.sittings) {
          items.push({
            billStageId: stage.id,
            billId: stage.bill.id,
            billTitle: stage.bill.shortTitle,
            stageDescription: stage.description,
            house: stage.house,
            sittingDate: sitting.date ? sitting.date.toISOString() : null,
            amendmentCount: stage._count.amendments,
          });
        }
      } else {
        items.push({
          billStageId: stage.id,
          billId: stage.bill.id,
          billTitle: stage.bill.shortTitle,
          stageDescription: stage.description,
          house: stage.house,
          sittingDate: null,
          amendmentCount: stage._count.amendments,
        });
      }
    }

    // Sort by sitting date (nulls last)
    items.sort((a, b) => {
      if (!a.sittingDate && !b.sittingDate) return 0;
      if (!a.sittingDate) return 1;
      if (!b.sittingDate) return -1;
      return a.sittingDate.localeCompare(b.sittingDate);
    });

    // Filter by date range
    let filtered = items;
    if (fromDate) {
      const from = new Date(fromDate).toISOString();
      filtered = filtered.filter(i => i.sittingDate && i.sittingDate >= from);
    }
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59.999Z').toISOString();
      filtered = filtered.filter(i => i.sittingDate && i.sittingDate <= to);
    }

    const total = filtered.length;
    const paginatedItems = filtered.slice(skip, skip + take);

    res.json({
      items: paginatedItems,
      total,
      skip,
      take,
    });
  } catch (error) {
    console.error('Error fetching stages with amendments:', error);
    res.status(500).json({ error: 'Failed to fetch stages with amendments' });
  }
});

export default router;
