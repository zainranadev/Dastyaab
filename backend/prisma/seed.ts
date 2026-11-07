import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  'Electrical', 'Plumbing', 'Construction', 'Carpentry', 'Painting', 'AC and Appliance Repair', 'Cleaning', 'Other',
];
const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function user(email: string, phone: string, fullName: string, role: Role, password: string) {
  return prisma.user.upsert({
    where: { email },
    update: {}, // never overwrite an existing account on re-seed
    create: { email, phone, fullName, role, passwordHash: await bcrypt.hash(password, 12) },
  });
}

async function main() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
  }

  await user(
    process.env.SEED_ADMIN_EMAIL ?? 'admin@services.local',
    '+920000000000',
    'Platform Admin',
    Role.ADMIN,
    process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345',
  );

  if (process.env.NODE_ENV !== 'production') {
    const city = process.env.SEED_CITY ?? 'Faisalabad';
    await user('customer@demo.local', '+923000000001', 'Demo Customer', Role.CUSTOMER, 'Demo12345');
    const contractor = await user('contractor@demo.local', '+923000000002', 'Demo Electrician', Role.CONTRACTOR, 'Demo12345');

    const profile = await prisma.contractorProfile.upsert({
      where: { userId: contractor.id },
      update: {},
      create: {
        userId: contractor.id,
        bio: 'Licensed electrician, 8 years of residential wiring and fault finding.',
        yearsExperience: 8,
        city,
        verificationStatus: 'VERIFIED',
      },
    });
    for (const name of ['Electrical', 'Plumbing']) {
      const category = await prisma.category.findUniqueOrThrow({ where: { slug: slugify(name) } });
      await prisma.contractorCategory.upsert({
        where: { contractorId_categoryId: { contractorId: profile.id, categoryId: category.id } },
        update: {},
        create: { contractorId: profile.id, categoryId: category.id },
      });
    }
    console.log('Demo accounts: customer@demo.local / contractor@demo.local (password Demo12345)');
  }
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
