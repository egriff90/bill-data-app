import { PrismaClient } from '@prisma/client';
import { parliamentApi } from '../parliament-api';
import type { ParliamentBill, ParliamentAmendment } from '@bill-data-app/shared';

const prisma = new PrismaClient();

interface SyncStats {
  sessionsProcessed: number;
  billsProcessed: number;
  billsSkipped: number;
  stagesProcessed: number;
  amendmentsProcessed: number;
  membersProcessed: number;
  errors: string[];
}

const BILL_DELAY_MS = 100;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Checks if a bill is still active (not withdrawn, defeated, or an act)
 */
function isActiveBill(bill: ParliamentBill): boolean {
  const isWithdrawn = bill.billWithdrawn !== null && bill.billWithdrawn !== undefined;
  return !isWithdrawn && !bill.isDefeated && !bill.isAct;
}

/**
 * Run an incremental sync that only processes active bills
 * (bills that are not withdrawn, defeated, or marked as Act)
 */
export async function runIncrementalSync(): Promise<SyncStats> {
  const stats: SyncStats = {
    sessionsProcessed: 0,
    billsProcessed: 0,
    billsSkipped: 0,
    stagesProcessed: 0,
    amendmentsProcessed: 0,
    membersProcessed: 0,
    errors: [],
  };

  const memberIdsToFetch = new Set<number>();

  console.log('Starting incremental sync (active bills only)...');

  const syncLog = await prisma.syncLog.create({
    data: {
      type: 'incremental',
      status: 'running',
    },
  });

  try {
    // Get sessions (last 4)
    const sessions = await parliamentApi.getSessions();
    console.log(`Processing ${sessions.length} sessions`);

    // Upsert sessions
    for (const session of sessions) {
      await prisma.session.upsert({
        where: { id: session.id },
        update: {
          name: session.name,
          startDate: new Date(session.startDate),
          endDate: session.endDate ? new Date(session.endDate) : null,
          isCurrent: session.endDate === null,
        },
        create: {
          id: session.id,
          name: session.name,
          startDate: new Date(session.startDate),
          endDate: session.endDate ? new Date(session.endDate) : null,
          isCurrent: session.endDate === null,
        },
      });
      stats.sessionsProcessed++;
    }

    // Process only active bills from each session
    for (const session of sessions) {
      console.log(`\nFetching bills for session ${session.name} (ID: ${session.id})...`);

      let bills: ParliamentBill[];
      try {
        bills = await parliamentApi.getBillsForSession(session.id);
      } catch (error) {
        const errorMsg = `Failed to fetch bills for session ${session.id}: ${error}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
        continue;
      }

      // Filter to active bills only
      const activeBills = bills.filter(isActiveBill);
      console.log(`Found ${bills.length} bills, ${activeBills.length} active (skipping ${bills.length - activeBills.length} withdrawn/defeated/acts)`);

      stats.billsSkipped += bills.length - activeBills.length;

      for (const bill of activeBills) {
        try {
          await processBill(bill, session.id, memberIdsToFetch, stats);
          await sleep(BILL_DELAY_MS);
        } catch (error) {
          const errorMsg = `Failed to process bill ${bill.billId}: ${error}`;
          console.error(errorMsg);
          stats.errors.push(errorMsg);
        }
      }
    }

    // Fetch member details
    console.log(`\nFetching details for ${memberIdsToFetch.size} members...`);
    await fetchMemberDetails(memberIdsToFetch, stats);

    // Mark sync as completed
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        stats: JSON.stringify(stats),
      },
    });

    console.log('\nIncremental sync completed!');
    console.log(`Sessions: ${stats.sessionsProcessed}`);
    console.log(`Bills processed: ${stats.billsProcessed}`);
    console.log(`Bills skipped: ${stats.billsSkipped}`);
    console.log(`Stages: ${stats.stagesProcessed}`);
    console.log(`Amendments: ${stats.amendmentsProcessed}`);
    console.log(`Members: ${stats.membersProcessed}`);
    if (stats.errors.length > 0) {
      console.log(`Errors: ${stats.errors.length}`);
    }

    return stats;
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: String(error),
        stats: JSON.stringify(stats),
      },
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function processBill(
  bill: ParliamentBill,
  sessionId: number,
  memberIdsToFetch: Set<number>,
  stats: SyncStats
): Promise<void> {
  console.log(`  Processing bill: ${bill.shortTitle} (ID: ${bill.billId})`);

  const actualSessionId = bill.includedSessionIds && bill.includedSessionIds.length > 0
    ? Math.max(...bill.includedSessionIds)
    : sessionId;

  const existingBill = await prisma.bill.findUnique({
    where: { id: bill.billId },
    select: { sessionId: true },
  });

  const shouldUpdateSession = !existingBill || actualSessionId > existingBill.sessionId;

  await prisma.bill.upsert({
    where: { id: bill.billId },
    update: {
      shortTitle: bill.shortTitle,
      longTitle: bill.longTitle || null,
      ...(shouldUpdateSession && { sessionId: actualSessionId }),
      introducedSessionId: bill.introducedSessionId,
      originatingHouse: bill.originatingHouse,
      currentHouse: bill.currentHouse,
      isWithdrawn: bill.billWithdrawn !== null && bill.billWithdrawn !== undefined,
      isDefeated: bill.isDefeated,
      isAct: bill.isAct,
      lastUpdate: new Date(bill.lastUpdate),
    },
    create: {
      id: bill.billId,
      shortTitle: bill.shortTitle,
      longTitle: bill.longTitle || null,
      sessionId: actualSessionId,
      introducedSessionId: bill.introducedSessionId,
      originatingHouse: bill.originatingHouse,
      currentHouse: bill.currentHouse,
      isWithdrawn: bill.billWithdrawn !== null && bill.billWithdrawn !== undefined,
      isDefeated: bill.isDefeated,
      isAct: bill.isAct,
      lastUpdate: new Date(bill.lastUpdate),
    },
  });
  stats.billsProcessed++;

  const stages = await parliamentApi.getBillStages(bill.billId);
  console.log(`    Found ${stages.length} stages`);

  for (const stage of stages) {
    await prisma.billStage.upsert({
      where: { id: stage.id },
      update: {
        billId: bill.billId,
        stageTypeId: stage.stageId,
        description: stage.description,
        house: stage.house,
        sortOrder: stage.sortOrder,
      },
      create: {
        id: stage.id,
        billId: bill.billId,
        stageTypeId: stage.stageId,
        description: stage.description,
        house: stage.house,
        sortOrder: stage.sortOrder,
      },
    });
    stats.stagesProcessed++;

    const amendments = await parliamentApi.getAmendments(bill.billId, stage.id);

    if (amendments.length > 0) {
      console.log(`      Stage "${stage.description}": ${amendments.length} amendments`);
    }

    for (const amendment of amendments) {
      await processAmendment(amendment, stage.id, memberIdsToFetch, stats);
    }
  }
}

async function processAmendment(
  amendment: ParliamentAmendment,
  billStageId: number,
  memberIdsToFetch: Set<number>,
  stats: SyncStats
): Promise<void> {
  await prisma.amendment.upsert({
    where: { id: amendment.amendmentId },
    update: {
      billStageId: billStageId,
      amendmentNumber: amendment.lineNumber?.toString() || null,
      amendmentType: amendment.amendmentType,
      decision: amendment.decision,
      decisionExplanation: amendment.decisionExplanation || null,
      summaryText: amendment.summaryText?.join('\n') || null,
      marshalledListText: amendment.marshalledListText || null,
    },
    create: {
      id: amendment.amendmentId,
      billStageId: billStageId,
      amendmentNumber: amendment.lineNumber?.toString() || null,
      amendmentType: amendment.amendmentType,
      decision: amendment.decision,
      decisionExplanation: amendment.decisionExplanation || null,
      summaryText: amendment.summaryText?.join('\n') || null,
      marshalledListText: amendment.marshalledListText || null,
    },
  });
  stats.amendmentsProcessed++;

  await prisma.amendmentSponsor.deleteMany({
    where: { amendmentId: amendment.amendmentId },
  });

  for (const sponsor of amendment.sponsors) {
    memberIdsToFetch.add(sponsor.memberId);

    await prisma.member.upsert({
      where: { id: sponsor.memberId },
      update: {
        name: sponsor.name,
        displayName: sponsor.name,
        party: sponsor.party || 'Unknown',
        partyColour: sponsor.partyColour || null,
        house: sponsor.house || 'Unknown',
        memberFrom: sponsor.memberFrom || '',
        thumbnailUrl: sponsor.memberPhoto || null,
      },
      create: {
        id: sponsor.memberId,
        name: sponsor.name,
        displayName: sponsor.name,
        party: sponsor.party || 'Unknown',
        partyColour: sponsor.partyColour || null,
        house: sponsor.house || 'Unknown',
        memberFrom: sponsor.memberFrom || '',
        thumbnailUrl: sponsor.memberPhoto || null,
      },
    });

    await prisma.amendmentSponsor.create({
      data: {
        amendmentId: amendment.amendmentId,
        memberId: sponsor.memberId,
        isLead: sponsor.sortOrder === 0,
        sortOrder: sponsor.sortOrder,
      },
    });
  }
}

async function fetchMemberDetails(
  memberIds: Set<number>,
  stats: SyncStats
): Promise<void> {
  const ids = Array.from(memberIds);
  let processed = 0;

  for (const memberId of ids) {
    try {
      const memberData = await parliamentApi.getMember(memberId);

      if (memberData?.value) {
        const member = memberData.value;
        await prisma.member.update({
          where: { id: memberId },
          data: {
            name: member.nameListAs,
            displayName: member.nameDisplayAs,
            party: member.latestParty?.name || 'Unknown',
            partyColour: member.latestParty?.backgroundColour || null,
            house: member.latestHouseMembership?.house === 1 ? 'Commons' : 'Lords',
            memberFrom: member.latestHouseMembership?.membershipFrom || '',
            thumbnailUrl: member.thumbnailUrl || null,
          },
        });
        stats.membersProcessed++;
      }

      processed++;
      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${ids.length} members`);
      }
    } catch (error) {
      console.warn(`  Failed to fetch member ${memberId}:`, error);
    }
  }
}
