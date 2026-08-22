/**
 * Dynamic Delivery Fee Calculator
 * Calculates delivery fee based on:
 * 1. Day of week (Weekday vs Weekend surge factor)
 * 2. Distance / Location (Central, Mid-range, Industrial/Outskirts of Adama City)
 * 3. Item Quantity (Base fee covers up to 5 items; bulk freight surcharge for 6+ items)
 */
function calculateDynamicDeliveryFee({ address, totalQuantity = 1, date = new Date() }) {
  const parsedDate = date ? new Date(date) : new Date();

  // 1. Distance Base Fee (Zone mapping for Adama City)
  let distanceFee = 100; // Default mid-distance (100 ETB)
  const locationStr = [
    address?.streetAddress,
    address?.subCity,
    address?.city,
    address?.title
  ].filter(Boolean).join(' ').toLowerCase();

  if (/01|02|03|04|center|central|piazza|stadium/i.test(locationStr)) {
    distanceFee = 70; // Central Adama (Short distance)
  } else if (/11|12|13|14|industrial|park|wonji|expressway|outskirt/i.test(locationStr)) {
    distanceFee = 180; // Industrial Park / Outskirts (Long distance)
  } else if (/05|06|07|08|09|10|bole|station|post office/i.test(locationStr)) {
    distanceFee = 120; // Mid-distance
  }

  // 2. Quantity Surcharge
  // Base fee covers up to 5 items.
  // 6-15 items: +15 ETB per item.
  // > 15 items: +25 ETB per item for heavy bulk handling.
  const qty = Number(totalQuantity) || 1;
  let quantitySurcharge = 0;
  if (qty > 5) {
    if (qty <= 15) {
      quantitySurcharge = (qty - 5) * 15;
    } else {
      quantitySurcharge = (10 * 15) + ((qty - 15) * 25);
    }
  }

  // 3. Day of Week Surge Factor
  // Saturday (6) & Sunday (0): 25% surge multiplier
  const dayOfWeek = parsedDate.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  const dayMultiplier = isWeekend ? 1.25 : 1.0;
  const dayLabel = isWeekend ? 'Weekend Peak (+25%)' : 'Weekday Standard';

  const rawTotal = (distanceFee + quantitySurcharge) * dayMultiplier;
  const finalFee = Math.round(rawTotal);

  return {
    deliveryFee: finalFee,
    breakdown: {
      distanceFee,
      quantitySurcharge,
      dayMultiplier,
      dayLabel,
      dayName: parsedDate.toLocaleDateString('en-US', { weekday: 'long' }),
      totalQuantity: qty,
      locationZone: distanceFee === 70 ? 'Central Adama Zone' : (distanceFee === 180 ? 'Industrial & Outskirts Zone' : 'Mid-Range Adama Zone'),
    },
  };
}

module.exports = { calculateDynamicDeliveryFee };
