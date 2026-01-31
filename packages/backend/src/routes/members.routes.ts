import { Router } from 'express';
import { prisma } from '../services/db';

const router = Router();

// GET /api/v1/members/search - Search members by name
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const house = req.query.house as string | undefined;
    const take = parseInt(req.query.take as string) || 20;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const where: any = {
      OR: [
        { name: { contains: query } },
        { displayName: { contains: query } },
        { memberFrom: { contains: query } },
      ],
    };

    if (house) {
      where.house = house;
    }

    const members = await prisma.member.findMany({
      where,
      take,
      orderBy: { displayName: 'asc' },
    });

    res.json(members);
  } catch (error) {
    console.error('Error searching members:', error);
    res.status(500).json({ error: 'Failed to search members' });
  }
});

// GET /api/v1/members/:id - Get member details
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        sponsorships: {
          include: {
            amendment: {
              include: {
                billStage: {
                  include: {
                    bill: {
                      select: { id: true, shortTitle: true, sessionId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Calculate statistics
    const amendments = member.sponsorships.map(s => s.amendment);
    const decisionCounts: Record<string, number> = {};
    for (const a of amendments) {
      decisionCounts[a.decision] = (decisionCounts[a.decision] || 0) + 1;
    }

    res.json({
      id: member.id,
      name: member.name,
      displayName: member.displayName,
      party: member.party,
      partyColour: member.partyColour,
      house: member.house,
      memberFrom: member.memberFrom,
      thumbnailUrl: member.thumbnailUrl,
      stats: {
        totalAmendments: amendments.length,
        decisionBreakdown: decisionCounts,
      },
      recentAmendments: amendments.slice(0, 20).map(a => ({
        id: a.id,
        decision: a.decision,
        summaryText: a.summaryText,
        bill: a.billStage.bill,
        stage: {
          id: a.billStage.id,
          description: a.billStage.description,
          house: a.billStage.house,
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

export default router;
