/**
 * Idempotent seed: two users, four pieces of equipment, and enough cleaning records on
 * the first one to exercise pagination in the UI without clicking "add" 25 times.
 * Every seeded record gets a matching CREATE audit entry, and one record is updated so
 * there is a realistic old -> new trail to look at immediately.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, type CleaningStatus } from '@prisma/client';
import { diffFields, diffForCreate } from '../src/lib/audit-diff.js';

const prisma = new PrismaClient();

const AUDITED_FIELDS = ['cleanedBy', 'cleanedAt', 'method', 'notes', 'status'] as const;

const METHODS = [
  'CIP - Alkaline wash',
  'CIP - Acid rinse',
  'Manual swab + IPA 70%',
  'Steam sterilisation (SIP)',
  'WFI final rinse',
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 10);

  const operator = await prisma.user.upsert({
    where: { email: 'operator@cleen.test' },
    update: {},
    create: { email: 'operator@cleen.test', name: 'Priya Nair', passwordHash },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@cleen.test' },
    update: {},
    create: { email: 'supervisor@cleen.test', name: 'Marcus Vogel', passwordHash },
  });

  const equipmentSeed = [
    { code: 'MIX-001', name: 'Granulation Mixer 1', status: 'ACTIVE' as const },
    { code: 'TAB-002', name: 'Tablet Press 2', status: 'ACTIVE' as const },
    { code: 'FIL-003', name: 'Fluid Bed Dryer 3', status: 'ACTIVE' as const },
    { code: 'CTR-009', name: 'Centrifuge 9 (decommissioned)', status: 'RETIRED' as const },
  ];

  const equipment = [];
  for (const item of equipmentSeed) {
    equipment.push(
      await prisma.equipment.upsert({
        where: { code: item.code },
        update: { name: item.name, status: item.status },
        create: item,
      }),
    );
  }

  const mixer = equipment[0]!;
  const press = equipment[1]!;

  const existing = await prisma.cleaningRecord.count({ where: { equipmentId: mixer.id } });
  if (existing > 0) {
    console.log('Cleaning records already seeded, skipping.');
    return;
  }

  // 26 records on the mixer, one every 12 hours going back in time.
  const base = Date.now();
  for (let i = 0; i < 26; i += 1) {
    const actor = i % 3 === 0 ? supervisor : operator;
    const status: CleaningStatus = i % 4 === 0 ? 'PENDING' : 'VERIFIED';

    const record = await prisma.cleaningRecord.create({
      data: {
        equipmentId: mixer.id,
        cleanedBy: actor.name,
        cleanedById: actor.id,
        cleanedAt: new Date(base - i * 12 * 60 * 60 * 1000),
        method: METHODS[i % METHODS.length]!,
        notes: i % 5 === 0 ? `Batch changeover #${1000 + i}. Visual inspection passed.` : null,
        status,
      },
    });

    await prisma.auditEntry.create({
      data: {
        cleaningRecordId: record.id,
        action: 'CREATE',
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        changes: {
          create: diffForCreate(
            {
              cleanedBy: record.cleanedBy,
              cleanedAt: record.cleanedAt,
              method: record.method,
              notes: record.notes,
              status: record.status,
            },
            AUDITED_FIELDS,
          ),
        },
      },
    });
  }

  // A couple of records on the second machine, so switching equipment shows real data.
  for (let i = 0; i < 3; i += 1) {
    const record = await prisma.cleaningRecord.create({
      data: {
        equipmentId: press.id,
        cleanedBy: operator.name,
        cleanedById: operator.id,
        cleanedAt: new Date(base - i * 36 * 60 * 60 * 1000),
        method: METHODS[(i + 2) % METHODS.length]!,
        notes: null,
        status: 'PENDING',
      },
    });

    await prisma.auditEntry.create({
      data: {
        cleaningRecordId: record.id,
        action: 'CREATE',
        actorId: operator.id,
        actorName: operator.name,
        actorEmail: operator.email,
        changes: {
          create: diffForCreate(
            {
              cleanedBy: record.cleanedBy,
              cleanedAt: record.cleanedAt,
              method: record.method,
              notes: record.notes,
              status: record.status,
            },
            AUDITED_FIELDS,
          ),
        },
      },
    });
  }

  // Verify the newest mixer record, so the seeded data contains a real UPDATE diff.
  const newest = await prisma.cleaningRecord.findFirst({
    where: { equipmentId: mixer.id },
    orderBy: [{ cleanedAt: 'desc' }, { id: 'desc' }],
  });

  if (newest) {
    const patch = {
      status: 'VERIFIED' as const,
      notes: 'Verified against SOP-CLN-014 by supervisor.',
    };

    const changes = diffFields(
      {
        cleanedBy: newest.cleanedBy,
        cleanedAt: newest.cleanedAt,
        method: newest.method,
        notes: newest.notes,
        status: newest.status,
      },
      patch,
      AUDITED_FIELDS,
    );

    if (changes.length > 0) {
      await prisma.cleaningRecord.update({ where: { id: newest.id }, data: patch });
      await prisma.auditEntry.create({
        data: {
          cleaningRecordId: newest.id,
          action: 'UPDATE',
          actorId: supervisor.id,
          actorName: supervisor.name,
          actorEmail: supervisor.email,
          changes: { create: changes },
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('  operator@cleen.test / password123');
  console.log('  supervisor@cleen.test / password123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
