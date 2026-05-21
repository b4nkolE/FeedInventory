import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding TOPFEEDS database...");

    // 1. The exact categories matching the frontend schema
    const feedCategories = [
        'PULLET_RATION',
        'BROILER_RATION',
        'CONCENTRATE',
        'PREMIUM_BROILER',
        'BROILER_PLUS_PRO',
        'FISH_FEED',
        'OMEGA_FISH_FEED'
    ];

    // This map stores the generated database IDs for the categories
    const categoryMap = {};

    // 2. Loop through and create/verify every category
    for (const categoryName of feedCategories) {
        const categoryRecord = await prisma.category.upsert({
            where: { name: categoryName },
            update: {},
            create: { name: categoryName },
        });

        categoryMap[categoryName] = categoryRecord.id;
        console.log(`Verified Category: ${categoryName}`);
    }

    // 3. Insert the entire TOPFEEDS physical inventory
    console.log("Inserting feed items...");

    await prisma.feedItem.createMany({
        data: [
            // ---------------- PULLET RATION ----------------
            { name: "CM", categoryId: categoryMap['PULLET_RATION'] },
            { name: "CCrumb", categoryId: categoryMap['PULLET_RATION'] },
            { name: "GM", categoryId: categoryMap['PULLET_RATION'] },
            { name: "GCrumb", categoryId: categoryMap['PULLET_RATION'] },
            { name: "PLM", categoryId: categoryMap['PULLET_RATION'] },
            { name: "PLayer Crumb", categoryId: categoryMap['PULLET_RATION'] },
            { name: "Layer Crumb", categoryId: categoryMap['PULLET_RATION'] },
            { name: "LM", categoryId: categoryMap['PULLET_RATION'] },
            { name: "Layer Wise", categoryId: categoryMap['PULLET_RATION'] },
            { name: "Layer phase 2", categoryId: categoryMap['PULLET_RATION'] },

            // ---------------- BROILER RATION ----------------
            { name: "BSSM", categoryId: categoryMap['BROILER_RATION'] },
            { name: "BSS Crumb", categoryId: categoryMap['BROILER_RATION'] },
            { name: "BSM", categoryId: categoryMap['BROILER_RATION'] },
            { name: "BS Crumb", categoryId: categoryMap['BROILER_RATION'] },
            { name: "BFM", categoryId: categoryMap['BROILER_RATION'] },
            { name: "BF Pellet", categoryId: categoryMap['BROILER_RATION'] },

            // ---------------- CONCENTRATES ----------------
            { name: "CC 30%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "GC 30%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "LC 30%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "CC 40%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "GC 40%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "LC 40%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "BSSC 40%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "BSC 40%", categoryId: categoryMap['CONCENTRATE'] },
            { name: "BFC 40%", categoryId: categoryMap['CONCENTRATE'] },

            // ---------------- PREMIUM BROILER FEEDS ----------------
            { name: "Premium Starter Crumbs", categoryId: categoryMap['PREMIUM_BROILER'] },
            { name: "Premium Super Starter Crumbs", categoryId: categoryMap['PREMIUM_BROILER'] },
            { name: "Premium Finisher Pellets", categoryId: categoryMap['PREMIUM_BROILER'] },

            // ---------------- BROILER PLUS PRO-LINE ----------------
            { name: "BSS Crumbles", categoryId: categoryMap['BROILER_PLUS_PRO'] },
            { name: "BS Crumbles", categoryId: categoryMap['BROILER_PLUS_PRO'] },
            { name: "BF Pellets", categoryId: categoryMap['BROILER_PLUS_PRO'] },

            // ---------------- FISH FEEDS ----------------
            { name: "Fish Feed 2mm", categoryId: categoryMap['FISH_FEED'] },
            { name: "Fish Feed 3mm", categoryId: categoryMap['FISH_FEED'] },
            { name: "Fish Feed 4.5mm", categoryId: categoryMap['FISH_FEED'] },
            { name: "Fish Feed 6mm", categoryId: categoryMap['FISH_FEED'] },
            { name: "Fish Feed 9mm", categoryId: categoryMap['FISH_FEED'] },

            // ---------------- OMEGA FISH FEEDS ----------------
            { name: "Omega Fish Feed 4.5mm", categoryId: categoryMap['OMEGA_FISH_FEED'] },
            { name: "Omega Fish Feed 6mm", categoryId: categoryMap['OMEGA_FISH_FEED'] },
            { name: "Omega Fish Feed 9mm", categoryId: categoryMap['OMEGA_FISH_FEED'] }
        ],
        skipDuplicates: true // Ensures you can run this file multiple times safely
    });

    console.log("Database seeded successfully with real inventory!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });