import { PrismaClient } from '@prisma/client';
import { parliamentApi } from '../parliament-api';
import type { ParliamentBill, ParliamentAmendment, ParliamentSponsor } from '@bill-data-app/shared';

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

// Delay between processing bills to avoid overwhelming the API
const BILL_DELAY_MS = 100;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runFullSync(): Promise<SyncStats> {
  const stats: SyncStats = {
    sessionsProcessed: 0,
    billsProcessed: 0,
    billsSkipped: 0,
    stagesProcessed: 0,
    amendmentsProcessed: 0,
    membersProcessed: 0,
    errors: [],
  };

  // Track members to fetch
  const memberIdsToFetch = new Set<number>();

  console.log('Starting full sync...');

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      type: 'full',
      status: 'running',
    },
  });

  try {
    // Step 1: Get sessions (last 4)
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

    // Step 2: For each session, fetch and filter bills
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

      console.log(`Found ${bills.length} bills in session ${session.name}`);

      // Process all bills (no filtering - we want withdrawn/defeated/acts too)
      for (const bill of bills) {
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

    // Step 3: Fetch member details
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

    console.log('\nSync completed!');
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
    // Mark sync as failed
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

  // Determine the correct sessionId - use the max from includedSessionIds if available
  // This ensures carry-over bills are assigned to their most recent active session
  const actualSessionId = bill.includedSessionIds && bill.includedSessionIds.length > 0
    ? Math.max(...bill.includedSessionIds)
    : sessionId;

  // Check if bill already exists to determine if we should update sessionId
  const existingBill = await prisma.bill.findUnique({
    where: { id: bill.billId },
    select: { sessionId: true },
  });

  // Only update sessionId if the bill doesn't exist or if actual session is more recent
  const shouldUpdateSession = !existingBill || actualSessionId > existingBill.sessionId;

  // Upsert bill
  await prisma.bill.upsert({
    where: { id: bill.billId },
    update: {
      shortTitle: bill.shortTitle,
      longTitle: bill.longTitle || null,
      // Only update sessionId if this is a more recent session
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

  // Fetch all stages for this bill
  const stages = await parliamentApi.getBillStages(bill.billId);
  console.log(`    Found ${stages.length} stages`);

  // Process each stage
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

    // Upsert stage sittings
    for (const sitting of stage.stageSittings || []) {
      await prisma.billStageSitting.upsert({
        where: { id: sitting.id },
        update: {
          billStageId: stage.id,
          billId: bill.billId,
          stageId: sitting.stageId,
          date: sitting.date ? new Date(sitting.date) : null,
        },
        create: {
          id: sitting.id,
          billStageId: stage.id,
          billId: bill.billId,
          stageId: sitting.stageId,
          date: sitting.date ? new Date(sitting.date) : null,
        },
      });
    }

    // Fetch amendments for this stage
    const amendments = await parliamentApi.getAmendments(bill.billId, stage.id);

    if (amendments.length > 0) {
      console.log(`      Stage "${stage.description}": ${amendments.length} amendments`);
    }

    // Process each amendment
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
  // Upsert amendment
  await prisma.amendment.upsert({
    where: { id: amendment.amendmentId },
    update: {
      billStageId: billStageId,
      amendmentNumber: amendment.lineNumber?.toString() || null,
      dNum: amendment.dNum || null,
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
      dNum: amendment.dNum || null,
      amendmentType: amendment.amendmentType,
      decision: amendment.decision,
      decisionExplanation: amendment.decisionExplanation || null,
      summaryText: amendment.summaryText?.join('\n') || null,
      marshalledListText: amendment.marshalledListText || null,
    },
  });
  stats.amendmentsProcessed++;

  // Process sponsors
  // First delete existing sponsors for this amendment
  await prisma.amendmentSponsor.deleteMany({
    where: { amendmentId: amendment.amendmentId },
  });

  // Create sponsor records and track member IDs
  for (const sponsor of amendment.sponsors) {
    memberIdsToFetch.add(sponsor.memberId);

    // Create a basic member record if it doesn't exist
    // (will be updated with full details later)
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

    // Create sponsor relationship
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
