import { Router, type Router as RouterType } from 'express';
import { prisma } from '../services/db';

const router: RouterType = Router();

// GET /api/v1/amendments - Search amendments
router.get('/', async (req, res) => {
  try {
    const memberId = req.query.memberId ? parseInt(req.query.memberId as string) : undefined;
    const billId = req.query.billId ? parseInt(req.query.billId as string) : undefined;
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : undefined;
    const decision = req.query.decision as string | undefined;
    const stage = req.query.stage as string | undefined;
    const house = req.query.house as string | undefined;
    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 100;

    // Build where clause
    const where: any = {};

    if (decision) {
      where.decision = decision;
    }

    // Filter by member (through sponsors relationship)
    if (memberId) {
      where.sponsors = {
        some: { memberId },
      };
    }

    // Filter by bill, session, stage, or house (through billStage relationship)
    if (billId || sessionId || stage || house) {
      where.billStage = {};
      if (billId) {
        where.billStage.billId = billId;
      }
      if (sessionId) {
        where.billStage.bill = { sessionId };
      }
      if (stage) {
        where.billStage.description = stage;
      }
      if (house) {
        where.billStage.house = house;
      }
    }

    const [amendments, total] = await Promise.all([
      prisma.amendment.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
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
                select: {
                  id: true,
                  shortTitle: true,
                  sessionId: true,
                },
              },
            },
          },
        },
      }),
      prisma.amendment.count({ where }),
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

// GET /api/v1/amendments/stats - Get amendment statistics
router.get('/stats', async (req, res) => {
  try {
    const groupBy = req.query.groupBy as string || 'bill';
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : undefined;
    const memberId = req.query.memberId ? parseInt(req.query.memberId as string) : undefined;
    const house = req.query.house as string | undefined;

    // Build where clause for filtering
    const baseWhere: any = {};
    if (memberId) {
      baseWhere.sponsors = { some: { memberId } };
    }
    if (sessionId || house) {
      baseWhere.billStage = {};
      if (sessionId) {
        baseWhere.billStage.bill = { sessionId };
      }
      if (house) {
        baseWhere.billStage.house = house;
      }
    }

    if (groupBy === 'bill') {
      // Group by bill
      const bills = await prisma.bill.findMany({
        where: sessionId ? { sessionId } : undefined,
        select: {
          id: true,
          shortTitle: true,
          stages: {
            where: house ? { house } : undefined,
            select: {
              id: true,
              description: true,
              house: true,
              amendments: {
                where: memberId ? { sponsors: { some: { memberId } } } : undefined,
                select: { id: true },
              },
            },
          },
        },
      });

      const result = bills
        .map(bill => ({
          groupKey: bill.id.toString(),
          groupLabel: bill.shortTitle,
          count: bill.stages.reduce((sum, s) => sum + s.amendments.length, 0),
          subGroups: bill.stages
            .filter(s => s.amendments.length > 0)
            .map(s => ({
              groupKey: s.id.toString(),
              groupLabel: s.description,
              count: s.amendments.length,
            })),
        }))
        .filter(b => b.count > 0)
        .sort((a, b) => b.count - a.count);

      res.json(result);
    } else if (groupBy === 'decision') {
      // Group by decision status
      const decisions = await prisma.amendment.groupBy({
        by: ['decision'],
        where: baseWhere,
        _count: { id: true },
      });

      const result = decisions.map(d => ({
        groupKey: d.decision,
        groupLabel: d.decision,
        count: d._count.id,
      }));

      res.json(result);
    } else if (groupBy === 'member') {
      // Group by sponsor member
      const sponsors = await prisma.amendmentSponsor.findMany({
        where: {
          amendment: baseWhere,
        },
        select: {
          member: true,
          amendment: { select: { id: true } },
        },
      });

      // Count amendments per member
      const memberCounts = new Map<number, { member: any; count: number }>();
      for (const s of sponsors) {
        const existing = memberCounts.get(s.member.id);
        if (existing) {
          existing.count++;
        } else {
          memberCounts.set(s.member.id, { member: s.member, count: 1 });
        }
      }

      const result = Array.from(memberCounts.values())
        .map(m => ({
          groupKey: m.member.id.toString(),
          groupLabel: m.member.displayName,
          count: m.count,
          metadata: {
            party: m.member.party,
            house: m.member.house,
          },
        }))
        .sort((a, b) => b.count - a.count);

      res.json(result);
    } else if (groupBy === 'stage') {
      // Group by stage type
      const stageWhere: any = {};
      if (sessionId) {
        stageWhere.bill = { sessionId };
      }
      if (house) {
        stageWhere.house = house;
      }
      const stages = await prisma.billStage.findMany({
        where: Object.keys(stageWhere).length > 0 ? stageWhere : undefined,
        select: {
          id: true,
          description: true,
          house: true,
          amendments: {
            where: memberId ? { sponsors: { some: { memberId } } } : undefined,
            select: { id: true },
          },
        },
      });

      // Group by stage description
      const stageGroups = new Map<string, { house: string; count: number }>();
      for (const s of stages) {
        const key = s.description;
        const existing = stageGroups.get(key);
        if (existing) {
          existing.count += s.amendments.length;
        } else {
          stageGroups.set(key, { house: s.house, count: s.amendments.length });
        }
      }

      const result = Array.from(stageGroups.entries())
        .map(([description, data]) => ({
          groupKey: description,
          groupLabel: description,
          count: data.count,
          metadata: { house: data.house },
        }))
        .filter(s => s.count > 0)
        .sort((a, b) => b.count - a.count);

      res.json(result);
    } else {
      res.status(400).json({ error: 'Invalid groupBy parameter. Use: bill, decision, member, or stage' });
    }
  } catch (error) {
    console.error('Error fetching amendment stats:', error);
    res.status(500).json({ error: 'Failed to fetch amendment statistics' });
  }
});

export default router;
