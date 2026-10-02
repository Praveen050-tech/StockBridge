/**
 * Standalone Seed Script for Prisma MySQL Database
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting StockBridge Database Seeding...');

  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('admin123', salt);
  const shopHash = await bcrypt.hash('shop123', salt);

  // 1. Create Godown Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'godown@stockbridge.io' },
    update: {},
    create: {
      name: 'Ramesh Sundaram (Central Godown)',
      phone: '9840123456',
      email: 'godown@stockbridge.io',
      password_hash: adminHash,
      role: 'godown_admin'
    }
  });

  // 2. Create Godown
  const godown = await prisma.godown.upsert({
    where: { admin_user_id: adminUser.id },
    update: {},
    create: {
      name: 'Metro Logistics Godown #4',
      location: 'Koyambedu Wholesale Hub, Chennai',
      admin_user_id: adminUser.id
    }
  });

  // 3. Create Shop Owner
  const shopUser = await prisma.user.upsert({
    where: { email: 'shop@stockbridge.io' },
    update: { godown_id: godown.id },
    create: {
      name: 'Murugan Kirana & Provisions',
      phone: '9840987654',
      email: 'shop@stockbridge.io',
      password_hash: shopHash,
      role: 'shop_owner',
      godown_id: godown.id
    }
  });

  // 4. Products
  const seedProducts = [
    { name: 'Ponni Boiled Rice (Deluxe)', category: 'Grains & Rice', unit: 'kg', price: 58.00, stock: 1500, shopStock: 8.5, threshold: 25 },
    { name: 'Toor Dal (Premium Unpolished)', category: 'Pulses & Dals', unit: 'kg', price: 165.00, stock: 800, shopStock: 5.0, threshold: 15 },
    { name: 'Aashirvaad Whole Wheat Atta 5kg', category: 'Flours', unit: 'box', price: 275.00, stock: 240, shopStock: 14.0, threshold: 10 },
    { name: 'Gold Winner Refined Sunflower Oil 1L', category: 'Oils & Ghee', unit: 'l', price: 135.00, stock: 450, shopStock: 6.0, threshold: 20 },
    { name: 'Tata Iodized Salt 1kg Packet', category: 'Spices & Essentials', unit: 'box', price: 26.00, stock: 600, shopStock: 32.0, threshold: 15 },
    { name: 'White Refined Crystal Sugar', category: 'Sugar & Sweeteners', unit: 'kg', price: 44.00, stock: 1200, shopStock: 50.0, threshold: 20 },
    { name: 'Red Chilli Whole (Guntur S4)', category: 'Spices & Essentials', unit: 'kg', price: 290.00, stock: 18, shopStock: 2.0, threshold: 5 },
    { name: 'Chakra Gold Dust Tea 250g', category: 'Beverages', unit: 'pcs', price: 125.00, stock: 350, shopStock: 12.0, threshold: 10 }
  ];

  for (const item of seedProducts) {
    const product = await prisma.product.create({
      data: {
        godown_id: godown.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        price_per_unit: item.price
      }
    });

    await prisma.godownStock.create({
      data: {
        product_id: product.id,
        godown_id: godown.id,
        quantity_available: item.stock
      }
    });

    await prisma.shopStock.create({
      data: {
        shop_user_id: shopUser.id,
        product_id: product.id,
        quantity_on_hand: item.shopStock,
        reorder_threshold: item.threshold
      }
    });

    await prisma.stockMovement.create({
      data: {
        product_id: product.id,
        godown_id: godown.id,
        movement_type: 'restock_in',
        quantity: item.stock
      }
    });
  }

  console.log('✅ StockBridge database successfully seeded!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
