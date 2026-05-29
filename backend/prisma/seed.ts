import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';

config();

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@example.com';
  const password = process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@12345';
  const name = process.env['SEED_ADMIN_NAME'] ?? 'Admin';

  const passwordHash = await hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: 'ADMIN' },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log('Seeded admin user:', admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
