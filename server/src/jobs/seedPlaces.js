const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
const envExamplePath = path.join(__dirname, '../../.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
} else {
  dotenv.config();
}

const User = require('../models/User');
const MapPlace = require('../models/MapPlace');
const Category = require('../models/Category');
const MaterialType = require('../models/MaterialType');
const Product = require('../models/Product');

// 1. Realistic Demo Sellers inside Adama City
const DEMO_SELLERS = [
  {
    name: 'Abebe Kebede',
    email: 'seller1@marketplace.com',
    phoneNumber: '+251911223344',
    shopName: 'Abebe Scrap Metal & Hardware [Demo]',
    shopDescription: 'Reclaimed structural angle iron, corrugated zinc roofing sheets, rebar offcuts, and copper pipes.',
    shopAddress: 'Kebele 01, Bole Subcity, Adama',
    coordinates: [39.2580, 8.5440], // [lng, lat]
    categoryName: 'Used Construction Materials',
    materialName: 'Metal',
  },
  {
    name: 'Kebede Tadesse',
    email: 'seller2@marketplace.com',
    phoneNumber: '+251933445566',
    shopName: 'Kebede Used Fixtures & Electrical Supplies [Demo]',
    shopDescription: 'Industrial circuit breakers, high-gauge copper wiring, power distribution boxes, and refurbished transformers.',
    shopAddress: 'Kebele 04, Central Commercial District, Adama',
    coordinates: [39.2650, 8.5480],
    categoryName: 'Electronics & Appliances',
    materialName: 'Electronic',
  },
  {
    name: 'Oromia Scrap Steel Works',
    email: 'seller3@marketplace.com',
    phoneNumber: '+251944556677',
    shopName: 'Oromia Scrap Steel & Metal Yard [Demo]',
    shopDescription: 'Heavy structural H-beams, channel steel, thick steel plates, and angle iron salvage.',
    shopAddress: 'Kebele 02, Post Office Area, Adama',
    coordinates: [39.2710, 8.5530],
    categoryName: 'Industrial Scrap & Heavy Materials',
    materialName: 'Metal',
  },
  {
    name: 'Adama Circular Plastics',
    email: 'seller4@marketplace.com',
    phoneNumber: '+251955667788',
    shopName: 'Adama Circular Plastics & Recyclables [Demo]',
    shopDescription: 'High-density HDPE chemical barrels, industrial plastic crates, PVC pipes, and reground polymer scrap.',
    shopAddress: 'Aba Geda Subcity, Wonji Road, Adama',
    coordinates: [39.2840, 8.5260],
    categoryName: 'Household Items',
    materialName: 'Plastic',
  },
  {
    name: 'Rift Valley Timber Supply',
    email: 'seller5@marketplace.com',
    phoneNumber: '+251966778899',
    shopName: 'Rift Valley Timber & Pallet Depot [Demo]',
    shopDescription: 'Treated eucalyptus construction poles, reclaimed wooden Euro pallets, scaffolding timber, and plywood sheets.',
    shopAddress: 'Melka Hida Area, Adama',
    coordinates: [39.2560, 8.5320],
    categoryName: 'Furniture',
    materialName: 'Wood',
  },
  {
    name: 'Boku Machinery Surplus',
    email: 'seller6@marketplace.com',
    phoneNumber: '+251977889900',
    shopName: 'Boku Industrial Surplus & Motors [Demo]',
    shopDescription: 'Decommissioned electric motors, industrial 3-phase water pumps, heavy gearboxes, and salvaged compressors.',
    shopAddress: 'Boku Subcity, Mojo Road Corridor, Adama',
    coordinates: [39.2480, 8.5620],
    categoryName: 'Industrial Scrap & Heavy Materials',
    materialName: 'Metal',
  },
];

// 2. Realistic Admin-Managed Depots in Adama City
const DEMO_MAP_PLACES = [
  {
    name: 'Adama Central Scrap Metal Hub [Demo]',
    category: 'Scrap Metals & Machinery',
    materials: ['Structural Steel', 'Cast Iron', 'Copper Wire', 'Sheet Metal'],
    description: 'Verified regional recycling depot accepting bulk structural scrap and industrial metal equipment.',
    address: 'Kebele 03, Ring Road Corridor, Adama',
    phone: '+251221112233',
    coordinates: [39.2910, 8.5520], // [lng, lat]
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
  {
    name: 'Nazret Timber & Salvage Yard [Demo]',
    category: 'Reclaimed Timber & Wood',
    materials: ['Hardwood Beams', 'Planks', 'Plywood', 'Reclaimed Doors'],
    description: 'Verified reclaimed construction timber depot offering beams, salvaged doors, and roofing wood.',
    address: 'Wonji Road Junction, Kebele 11, Adama',
    phone: '+251221114455',
    coordinates: [39.2820, 8.5180],
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
  {
    name: 'Bole Industrial Scrap Collection Center [Demo]',
    category: 'Industrial Scrap & Refuse',
    materials: ['Aluminum Shavings', 'Steel Trimmings', 'Industrial Pallets'],
    description: 'Consolidation center for manufacturing surplus, sheet trimmings, and metal machining offcuts.',
    address: 'Bole Subcity, Industry Zone East, Adama',
    phone: '+251221116677',
    coordinates: [39.2880, 8.5380],
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
  {
    name: 'Adama Municipal Plastics Recycling Depot [Demo]',
    category: 'Plastics & Polymers',
    materials: ['PET Flakes', 'HDPE Crates', 'Polymer Scrap', 'Nylon Sacks'],
    description: 'Municipal sorting and recycling plant processing post-consumer polymers and industrial plastics.',
    address: 'Kebele 06, Near Stadium, Adama',
    phone: '+251221118899',
    coordinates: [39.2680, 8.5410],
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
  {
    name: 'Goro Salvage & Demolition Materials Yard [Demo]',
    category: 'Construction & Demolition Salvage',
    materials: ['Rebar Offcuts', 'Used Bricks', 'Roofing Tiles', 'Stone Slabs'],
    description: 'Demolition salvage yard providing cleaned clay bricks, foundation stone, and rebar ties.',
    address: 'Goro Subcity, North Gate, Adama',
    phone: '+251221119900',
    coordinates: [39.2750, 8.5720],
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
  {
    name: 'Adama University Corridor E-Waste Dropoff [Demo]',
    category: 'Electronic Waste & Components',
    materials: ['Motherboards', 'Copper Coils', 'Computer Chassis', 'Lithium Batteries'],
    description: 'Eco-certified drop-off facility for obsolete computing hardware, circuit boards, and telecomm cables.',
    address: 'ASTU University Road, Kebele 08, Adama',
    phone: '+251221113322',
    coordinates: [39.2950, 8.5580],
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
  {
    name: 'Wonji Sugar By-product & Scrap Depot [Demo]',
    category: 'Agricultural & Industrial Salvage',
    materials: ['Heavy Steel Pipes', 'Bagasse Fibers', 'Conveyor Belting', 'Brass Valves'],
    description: 'Industrial salvage yard for agricultural processing scrap, piping, and mechanical valves.',
    address: 'Wonji Sugar Estate Access Road, South Adama',
    phone: '+251221115544',
    coordinates: [39.2800, 8.5050],
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
  {
    name: 'Melka Hida Heavy Vehicle Scrap Yard [Demo]',
    category: 'Automotive & Heavy Equipment Scrap',
    materials: ['Truck Leaf Springs', 'Axles', 'Cast Engine Blocks', 'Tire Rubber'],
    description: 'Specialized vehicle dismantling yard offering high-tensile steel springs, axles, and engine scrap.',
    address: 'Melka Hida Industrial Bypass, West Adama',
    phone: '+251221117766',
    coordinates: [39.2380, 8.5250],
    source: 'ADMIN_MANAGED',
    isVerified: true,
    isActive: true,
  },
];

/**
 * Idempotent Seed Function
 * Safely creates or updates the 14 demo places without deleting or modifying any existing production data.
 */
async function seedDemoPlaces() {
  console.log('--- Starting Idempotent Demo Places Seeding ---');

  // Find or ensure Admin User exists for reference
  let admin = await User.findOne({ role: 'ADMIN' });
  if (!admin) {
    admin = await User.create({
      name: 'Adama Admin',
      email: 'admin@marketplace.com',
      password: 'AdminPass123',
      role: 'ADMIN',
      isActive: true,
    });
    console.log('Created admin account (admin@marketplace.com)');
  }

  // 1. Seed / Upsert 6 Approved Marketplace Sellers
  console.log('\nEnsuring 6 Approved Marketplace Sellers in Adama...');
  for (const sellerInfo of DEMO_SELLERS) {
    let seller = await User.findOne({ email: sellerInfo.email });
    if (!seller) {
      seller = await User.create({
        name: sellerInfo.name,
        email: sellerInfo.email,
        password: 'SellerPass123',
        role: 'SELLER',
        roles: ['SELLER'],
        isSellerApproved: true,
        isActive: true,
        phoneNumber: sellerInfo.phoneNumber,
        sellerProfile: {
          shopName: sellerInfo.shopName,
          shopDescription: sellerInfo.shopDescription,
          shopAddress: sellerInfo.shopAddress,
          shopLocation: {
            type: 'Point',
            coordinates: sellerInfo.coordinates,
            address: sellerInfo.shopAddress,
          },
          approvalStatus: 'APPROVED',
        },
      });
      console.log(` + Created Seller: ${sellerInfo.shopName} at [${sellerInfo.coordinates.join(', ')}]`);
    } else {
      seller.sellerProfile = seller.sellerProfile || {};
      seller.sellerProfile.shopName = sellerInfo.shopName;
      seller.sellerProfile.shopDescription = sellerInfo.shopDescription;
      seller.sellerProfile.shopAddress = sellerInfo.shopAddress;
      seller.sellerProfile.shopLocation = {
        type: 'Point',
        coordinates: sellerInfo.coordinates,
        address: sellerInfo.shopAddress,
      };
      seller.sellerProfile.approvalStatus = 'APPROVED';
      seller.isSellerApproved = true;
      seller.role = 'SELLER';
      if (!seller.roles || !seller.roles.includes('SELLER')) {
        seller.roles = ['SELLER'];
      }
      await seller.save({ validateBeforeSave: false });
      console.log(` ✓ Updated Seller: ${sellerInfo.shopName} at [${sellerInfo.coordinates.join(', ')}]`);
    }
  }

  // 2. Seed / Upsert 8 Admin-Managed Depots
  console.log('\nEnsuring 8 Verified Admin-Managed Depots in Adama...');
  for (const placeInfo of DEMO_MAP_PLACES) {
    const existing = await MapPlace.findOne({ name: placeInfo.name });
    if (!existing) {
      await MapPlace.create({
        ...placeInfo,
        location: {
          type: 'Point',
          coordinates: placeInfo.coordinates,
        },
        addedBy: admin._id,
      });
      console.log(` + Created Depot: ${placeInfo.name} at [${placeInfo.coordinates.join(', ')}]`);
    } else {
      existing.category = placeInfo.category;
      existing.materials = placeInfo.materials;
      existing.description = placeInfo.description;
      existing.address = placeInfo.address;
      existing.phone = placeInfo.phone;
      existing.location = {
        type: 'Point',
        coordinates: placeInfo.coordinates,
      };
      existing.source = placeInfo.source;
      existing.isVerified = true;
      existing.isActive = true;
      await existing.save();
      console.log(` ✓ Updated Depot: ${placeInfo.name} at [${placeInfo.coordinates.join(', ')}]`);
    }
  }

  const sellerCount = await User.countDocuments({
    role: 'SELLER',
    'sellerProfile.approvalStatus': 'APPROVED',
    'sellerProfile.shopLocation.coordinates': { $exists: true, $ne: [] },
  });
  const depotCount = await MapPlace.countDocuments({ isActive: true });
  console.log(`\n🎉 Seeding Complete! Total Live Map Locations: ${sellerCount + depotCount} (${sellerCount} Sellers + ${depotCount} Depots)`);
}

// Standalone execution support
if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB()
    .then(async () => {
      await seedDemoPlaces();
      console.log('✅ Standalone seeding completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error seeding places:', err);
      process.exit(1);
    });
}

module.exports = seedDemoPlaces;
