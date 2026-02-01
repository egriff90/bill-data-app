import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const SQLITE_PATH = path.resolve(__dirname, '../data/parliament.db');

interface Session {
  id: number;
  name: string;
  startDate: string;
  endDate: string | null;
  isCurrent: number;
}

interface Bill {
  id: number;
  shortTitle: string;
  longTitle: string | null;
  sessionId: number;
  introducedSessionId: number | null;
  originatingHouse: string;
  currentHouse: string;
  isWithdrawn: number;
  isDefeated: number;
  isAct: number;
  lastUpdate: string;
}

interface BillStage {
  id: number;
  billId: number;
  stageTypeId: number;
  description: string;
  house: string;
  sortOrder: number;
}

interface Member {
  id: number;
  name: string;
  displayName: string;
  party: string;
  partyColour: string | null;
  house: string;
  memberFrom: string;
  thumbnailUrl: string | null;
}

interface Amendment {
  id: number;
  billStageId: number;
  amendmentNumber: string | null;
  amendmentType: string;
  decision: string;
  decisionExplanation: string | null;
  summaryText: string | null;
  marshalledListText: string | null;
}

interface AmendmentSponsor {
  amendmentId: number;
  memberId: number;
  isLead: number;
  sortOrder: number;
}

interface SyncLog {
  id: number;
  type: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  stats: string | null;
}

async function main() {
  console.log('Starting data migration from SQLite to PostgreSQL...\n');

  // Check if SQLite database exists
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  console.log(`Connected to SQLite database: ${SQLITE_PATH}`);

  // Connect to PostgreSQL
  const prisma = new PrismaClient();
  console.log('Connected to PostgreSQL database\n');

  try {
    // Get counts from SQLite for verification
    const sqliteCounts = {
      sessions: sqlite.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number },
      bills: sqlite.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number },
      billStages: sqlite.prepare('SELECT COUNT(*) as count FROM bill_stages').get() as { count: number },
      members: sqlite.prepare('SELECT COUNT(*) as count FROM members').get() as { count: number },
      amendments: sqlite.prepare('SELECT COUNT(*) as count FROM amendments').get() as { count: number },
      amendmentSponsors: sqlite.prepare('SELECT COUNT(*) as count FROM amendment_sponsors').get() as { count: number },
      syncLogs: sqlite.prepare('SELECT COUNT(*) as count FROM sync_logs').get() as { count: number },
    };

    console.log('SQLite record counts:');
    console.log(`  Sessions: ${sqliteCounts.sessions.count}`);
    console.log(`  Bills: ${sqliteCounts.bills.count}`);
    console.log(`  Bill Stages: ${sqliteCounts.billStages.count}`);
    console.log(`  Members: ${sqliteCounts.members.count}`);
    console.log(`  Amendments: ${sqliteCounts.amendments.count}`);
    console.log(`  Amendment Sponsors: ${sqliteCounts.amendmentSponsors.count}`);
    console.log(`  Sync Logs: ${sqliteCounts.syncLogs.count}`);
    console.log('');

    // Clear existing data in PostgreSQL (in reverse FK order)
    console.log('Clearing existing PostgreSQL data...');
    await prisma.amendmentSponsor.deleteMany();
    await prisma.amendment.deleteMany();
    await prisma.billStage.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.session.deleteMany();
    await prisma.member.deleteMany();
    await prisma.syncLog.deleteMany();
    console.log('PostgreSQL data cleared\n');

    // Migrate Sessions
    console.log('Migrating sessions...');
    const sessions = sqlite.prepare('SELECT * FROM sessions').all() as Session[];
    for (const session of sessions) {
      await prisma.session.create({
        data: {
          id: session.id,
          name: session.name,
          startDate: new Date(session.startDate),
          endDate: session.endDate ? new Date(session.endDate) : null,
          isCurrent: session.isCurrent === 1,
        },
      });
    }
    console.log(`  Migrated ${sessions.length} sessions`);

    // Migrate Bills
    console.log('Migrating bills...');
    const bills = sqlite.prepare('SELECT * FROM bills').all() as Bill[];
    for (const bill of bills) {
      await prisma.bill.create({
        data: {
          id: bill.id,
          shortTitle: bill.shortTitle,
          longTitle: bill.longTitle,
          sessionId: bill.sessionId,
          introducedSessionId: bill.introducedSessionId,
          originatingHouse: bill.originatingHouse,
          currentHouse: bill.currentHouse,
          isWithdrawn: bill.isWithdrawn === 1,
          isDefeated: bill.isDefeated === 1,
          isAct: bill.isAct === 1,
          lastUpdate: new Date(bill.lastUpdate),
        },
      });
    }
    console.log(`  Migrated ${bills.length} bills`);

    // Migrate Bill Stages
    console.log('Migrating bill stages...');
    const billStages = sqlite.prepare('SELECT * FROM bill_stages').all() as BillStage[];
    for (const stage of billStages) {
      await prisma.billStage.create({
        data: {
          id: stage.id,
          billId: stage.billId,
          stageTypeId: stage.stageTypeId,
          description: stage.description,
          house: stage.house,
          sortOrder: stage.sortOrder,
        },
      });
    }
    console.log(`  Migrated ${billStages.length} bill stages`);

    // Migrate Members
    console.log('Migrating members...');
    const members = sqlite.prepare('SELECT * FROM members').all() as Member[];
    for (const member of members) {
      await prisma.member.create({
        data: {
          id: member.id,
          name: member.name,
          displayName: member.displayName,
          party: member.party,
          partyColour: member.partyColour,
          house: member.house,
          memberFrom: member.memberFrom,
          thumbnailUrl: member.thumbnailUrl,
        },
      });
    }
    console.log(`  Migrated ${members.length} members`);

    // Migrate Amendments (in batches for performance)
    console.log('Migrating amendments...');
    const amendments = sqlite.prepare('SELECT * FROM amendments').all() as Amendment[];
    const BATCH_SIZE = 1000;
    for (let i = 0; i < amendments.length; i += BATCH_SIZE) {
      const batch = amendments.slice(i, i + BATCH_SIZE);
      await prisma.amendment.createMany({
        data: batch.map((amendment) => ({
          id: amendment.id,
          billStageId: amendment.billStageId,
          amendmentNumber: amendment.amendmentNumber,
          amendmentType: amendment.amendmentType,
          decision: amendment.decision,
          decisionExplanation: amendment.decisionExplanation,
          summaryText: amendment.summaryText,
          marshalledListText: amendment.marshalledListText,
        })),
      });
      console.log(`  Migrated ${Math.min(i + BATCH_SIZE, amendments.length)}/${amendments.length} amendments`);
    }

    // Migrate Amendment Sponsors (in batches for performance)
    console.log('Migrating amendment sponsors...');
    const sponsors = sqlite.prepare('SELECT * FROM amendment_sponsors').all() as AmendmentSponsor[];
    for (let i = 0; i < sponsors.length; i += BATCH_SIZE) {
      const batch = sponsors.slice(i, i + BATCH_SIZE);
      await prisma.amendmentSponsor.createMany({
        data: batch.map((sponsor) => ({
          amendmentId: sponsor.amendmentId,
          memberId: sponsor.memberId,
          isLead: sponsor.isLead === 1,
          sortOrder: sponsor.sortOrder,
        })),
      });
      console.log(`  Migrated ${Math.min(i + BATCH_SIZE, sponsors.length)}/${sponsors.length} amendment sponsors`);
    }

    // Migrate Sync Logs
    console.log('Migrating sync logs...');
    const syncLogs = sqlite.prepare('SELECT * FROM sync_logs').all() as SyncLog[];
    for (const log of syncLogs) {
      await prisma.syncLog.create({
        data: {
          id: log.id,
          type: log.type,
          status: log.status,
          startedAt: new Date(log.startedAt),
          completedAt: log.completedAt ? new Date(log.completedAt) : null,
          error: log.error,
          stats: log.stats,
        },
      });
    }
    console.log(`  Migrated ${syncLogs.length} sync logs`);

    // Reset PostgreSQL sequence for sync_logs (the only table with autoincrement)
    console.log('\nResetting PostgreSQL sequence for sync_logs...');
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('sync_logs', 'id'), (SELECT COALESCE(MAX(id), 0) FROM sync_logs))`;

    // Verify counts in PostgreSQL
    console.log('\nVerifying PostgreSQL record counts...');
    const pgCounts = {
      sessions: await prisma.session.count(),
      bills: await prisma.bill.count(),
      billStages: await prisma.billStage.count(),
      members: await prisma.member.count(),
      amendments: await prisma.amendment.count(),
      amendmentSponsors: await prisma.amendmentSponsor.count(),
      syncLogs: await prisma.syncLog.count(),
    };

    console.log('PostgreSQL record counts:');
    console.log(`  Sessions: ${pgCounts.sessions} (expected: ${sqliteCounts.sessions.count})`);
    console.log(`  Bills: ${pgCounts.bills} (expected: ${sqliteCounts.bills.count})`);
    console.log(`  Bill Stages: ${pgCounts.billStages} (expected: ${sqliteCounts.billStages.count})`);
    console.log(`  Members: ${pgCounts.members} (expected: ${sqliteCounts.members.count})`);
    console.log(`  Amendments: ${pgCounts.amendments} (expected: ${sqliteCounts.amendments.count})`);
    console.log(`  Amendment Sponsors: ${pgCounts.amendmentSponsors} (expected: ${sqliteCounts.amendmentSponsors.count})`);
    console.log(`  Sync Logs: ${pgCounts.syncLogs} (expected: ${sqliteCounts.syncLogs.count})`);

    // Check for mismatches
    const mismatches: string[] = [];
    if (pgCounts.sessions !== sqliteCounts.sessions.count) mismatches.push('sessions');
    if (pgCounts.bills !== sqliteCounts.bills.count) mismatches.push('bills');
    if (pgCounts.billStages !== sqliteCounts.billStages.count) mismatches.push('billStages');
    if (pgCounts.members !== sqliteCounts.members.count) mismatches.push('members');
    if (pgCounts.amendments !== sqliteCounts.amendments.count) mismatches.push('amendments');
    if (pgCounts.amendmentSponsors !== sqliteCounts.amendmentSponsors.count) mismatches.push('amendmentSponsors');
    if (pgCounts.syncLogs !== sqliteCounts.syncLogs.count) mismatches.push('syncLogs');

    if (mismatches.length > 0) {
      console.error(`\n❌ Migration verification FAILED! Mismatches in: ${mismatches.join(', ')}`);
      process.exit(1);
    }

    console.log('\n✅ Migration completed successfully!');
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
