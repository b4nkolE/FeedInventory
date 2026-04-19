// prisma/seed.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const feedInventory = [
    // --- PULLET RATION ---
    { name: 'CM', category: 'PULLET_RATION' },
    { name: 'CCrumb', category: 'PULLET_RATION' },
    { name: 'GM', category: 'PULLET_RATION' },
    { name: 'GCrumb', category: 'PULLET_RATION' },
    { name: 'PLM', category: 'PULLET_RATION' },
    { name: 'PLayer Crumb', category: 'PULLET_RATION' },
    { name: 'Layer Crumb', category: 'PULLET_RATION' },
    { name: 'LM', category: 'PULLET_RATION' },
    { name: 'Layer Wise', category: 'PULLET_RATION' },
    { name: 'Layer phase 2', category: 'PULLET_RATION' },

    // --- BROILER RATION ---
    { name: 'BSSM', category: 'BROILER_RATION' },
    { name: 'BSS Crumb', category: 'BROILER_RATION' },
    { name: 'BSM', category: 'BROILER_RATION' },
    { name: 'BS Crumb', category: 'BROILER_RATION' },
    { name: 'BFM', category: 'BROILER_RATION' },
    { name: 'BF Pellet', category: 'BROILER_RATION' },

    // --- CONCENTRATES ---
    { name: 'CC 30%', category: 'CONCENTRATE' },
    { name: 'GC 30%', category: 'CONCENTRATE' },
    { name: 'LC 30%', category: 'CONCENTRATE' },
    { name: 'CC 40%', category: 'CONCENTRATE' },
    { name: 'GC 40%', category: 'CONCENTRATE' },
    { name: 'LC 40%', category: 'CONCENTRATE' },
    { name: 'BSSC 40%', category: 'CONCENTRATE' },
    { name: 'BSC 40%', category: 'CONCENTRATE' },
    { name: 'BFC 40%', category: 'CONCENTRATE' },

    // --- PREMIUM BROILER FEEDS ---
    { name: 'Premium Starter Crumbs', category: 'PREMIUM_BROILER' },
    { name: 'Premium Super Starter Crumbs', category: 'PREMIUM_BROILER' },
    { name: 'Premium Finisher Pellets', category: 'PREMIUM_BROILER' },

    // --- BROILER PLUS PRO-LINE ---
    { name: 'Pro-Line BSS Crumbles', category: 'BROILER_PLUS_PRO' },
    { name: 'Pro-Line BS Crumbles', category: 'BROILER_PLUS_PRO' },
    { name: 'Pro-Line BF Pellets', category: 'BROILER_PLUS_PRO' },

    // --- FISH FEEDS (Prefixed to ensure uniqueness) ---
    { name: 'Standard Fish Feed 2mm', category: 'FISH_FEED' },
    { name: 'Standard Fish Feed 3mm', category: 'FISH_FEED' },
    { name: 'Standard Fish Feed 4.5mm', category: 'FISH_FEED' },
    { name: 'Standard Fish Feed 6mm', category: 'FISH_FEED' },
    { name: 'Standard Fish Feed 9mm', category: 'FISH_FEED' },

    // --- OMEGA FISH FEEDS ---
    { name: 'Omega Fish Feed 4.5mm', category: 'OMEGA_FISH_FEED' },
    { name: 'Omega Fish Feed 6mm', category: 'OMEGA_FISH_FEED' },
    { name: 'Omega Fish Feed 9mm', category: 'OMEGA_FISH_FEED' }
];

async function main() {
    console.log('🌱 Starting database seeding...');

    // Using createMany with skipDuplicates ensures we can run this script 
    // multiple times without crashing if the data is already there.
    const result = await prisma.feedItem.createMany({
        data: feedInventory,
        skipDuplicates: true,
    });

    console.log(`✅ Successfully seeded ${result.count} feed items into the database.`);
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        // This strictly closes the database connection when the script finishes
        await prisma.$disconnect();
    });