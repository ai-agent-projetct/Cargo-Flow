// Chargeable-weight / chargeable-volume maths shared by quotes, house
// shipments and service jobs.
//
// Upstream models this as a `volumetric.divided.value` master plus a
// `divide_value` override on the quote, so the divisor is data, not a
// constant. `DEFAULT_DIVISORS` is only the fallback when no master row and
// no override apply.
//
// Units in: weight in kg, volume in m3, length/width/height in cm.

// Volumetric divisors in cm3 per kg. Air freight bills 1:6000 (IATA),
// express/courier 1:5000. Sea and road do not use a cm3 divisor - they are
// handled by their own branch below.
const DEFAULT_DIVISORS = {
  AIR: 6000,
  COURIER: 5000,
};

// Road LTL: kg of chargeable weight per m3 of space. 333 kg/m3 is the common
// European groupage convention (1 m3 ~ 333 kg).
const DEFAULT_ROAD_KG_PER_M3 = 333;

const CM3_PER_M3 = 1000000;

const num = (v, fallback = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
};

const round = (v, dp = 3) => {
  const f = 10 ** dp;
  return Math.round((num(v) + Number.EPSILON) * f) / f;
};

/**
 * Volume in m3 from package dimensions in cm.
 * @param {{length:number,width:number,height:number,quantity?:number}[]} packages
 */
const volumeFromPackages = (packages = []) =>
  round(
    packages.reduce((sum, p) => {
      const qty = num(p.quantity, 1) || 1;
      return sum + (num(p.length) * num(p.width) * num(p.height) * qty) / CM3_PER_M3;
    }, 0),
  );

/**
 * Volumetric (dimensional) weight in kg for a cm3-per-kg divisor.
 * volume m3 -> cm3 -> / divisor
 */
const volumetricWeight = (volumeM3, divisor) => {
  const d = num(divisor);
  if (d <= 0) return 0;
  return round((num(volumeM3) * CM3_PER_M3) / d);
};

/**
 * Chargeable figures for one cargo parcel.
 *
 * @param {object} input
 * @param {'AIR'|'SEA'|'ROAD'|'RAIL'|'COURIER'} input.transportMode
 * @param {'FCL'|'LCL'|'FTL'|'LTL'|string} [input.shipmentType] distinguishes
 *        full-load (per container / per truck) from groupage (per W/M or ldm).
 * @param {number} [input.grossWeight] kg
 * @param {number} [input.volume] m3 - takes precedence over `packages`
 * @param {object[]} [input.packages] dimension rows, used when volume is absent
 * @param {number} [input.divisor] override for the cm3-per-kg divisor
 * @param {number} [input.roadKgPerM3] override for road groupage kg per m3
 * @param {number} [input.containerCount]
 * @param {number} [input.truckCount]
 * @returns {{chargeableWeight:number, chargeableVolume:number,
 *            weightVolume:number, volumetricWeight:number, volume:number,
 *            grossWeight:number, basis:string, divisorUsed:number|null,
 *            units:number}}
 */
const computeChargeable = (input = {}) => {
  const mode = String(input.transportMode || 'SEA').toUpperCase();
  const shipmentType = String(input.shipmentType || '').toUpperCase();
  const grossWeight = round(num(input.grossWeight));
  const volume = input.volume != null && input.volume !== ''
    ? round(num(input.volume))
    : volumeFromPackages(input.packages);

  const out = {
    grossWeight,
    volume,
    volumetricWeight: 0,
    weightVolume: 0,
    chargeableWeight: 0,
    chargeableVolume: volume,
    basis: 'weight',
    divisorUsed: null,
    units: 1,
  };

  if (mode === 'AIR' || mode === 'COURIER') {
    const divisor = num(input.divisor) > 0
      ? num(input.divisor)
      : DEFAULT_DIVISORS[mode === 'COURIER' ? 'COURIER' : 'AIR'];
    out.divisorUsed = divisor;
    out.volumetricWeight = volumetricWeight(volume, divisor);
    out.chargeableWeight = round(Math.max(grossWeight, out.volumetricWeight));
    out.weightVolume = out.chargeableWeight;
    out.basis = out.volumetricWeight > grossWeight ? 'volumetric' : 'weight';
    return out;
  }

  if (mode === 'SEA') {
    // FCL bills per container, not per W/M. Chargeable weight stays the
    // actual gross weight so VGM and overweight checks still read true.
    if (shipmentType === 'FCL') {
      out.units = Math.max(1, Math.round(num(input.containerCount, 1) || 1));
      out.chargeableWeight = grossWeight;
      // `weightVolume` is the revenue ton, and a revenue ton is the greater of
      // metric tonnes and cubic metres whatever the shipment type. Setting it
      // to the gross weight in kg here made any W/M-based charge that landed
      // on an FCL shipment bill a thousand times over.
      out.weightVolume = round(Math.max(grossWeight / 1000, volume));
      out.basis = 'per_container';
      return out;
    }
    // LCL / breakbulk: revenue ton = max(metric tonnes, m3).
    const tonnes = round(grossWeight / 1000);
    const revenueTons = round(Math.max(tonnes, volume));
    out.weightVolume = revenueTons;
    out.chargeableVolume = revenueTons;
    out.chargeableWeight = round(revenueTons * 1000);
    out.basis = volume > tonnes ? 'measurement' : 'weight';
    return out;
  }

  if (mode === 'ROAD' || mode === 'RAIL') {
    if (shipmentType === 'FTL') {
      out.units = Math.max(1, Math.round(num(input.truckCount, 1) || 1));
      out.chargeableWeight = grossWeight;
      out.weightVolume = grossWeight;
      out.basis = 'per_truck';
      return out;
    }
    const kgPerM3 = num(input.roadKgPerM3) > 0
      ? num(input.roadKgPerM3)
      : DEFAULT_ROAD_KG_PER_M3;
    out.divisorUsed = kgPerM3;
    out.volumetricWeight = round(volume * kgPerM3);
    out.chargeableWeight = round(Math.max(grossWeight, out.volumetricWeight));
    out.weightVolume = out.chargeableWeight;
    out.basis = out.volumetricWeight > grossWeight ? 'volumetric' : 'weight';
    return out;
  }

  out.chargeableWeight = grossWeight;
  out.weightVolume = grossWeight;
  return out;
};

/**
 * Quantity to bill a charge line for, given its measurement basis.
 * Mirrors upstream `freight.measurement.basis` codes.
 */
const quantityForBasis = (basis, figures = {}, extra = {}) => {
  // Strip every non-alphanumeric so "W/M", "Weight-Volume" and
  // "weight_volume" all land on the same key.
  const key = String(basis || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (key) {
    case 'chargeableweight':
    case 'chargeable':
      return num(figures.chargeableWeight);
    case 'grossweight':
    case 'weight':
      return num(figures.grossWeight);
    case 'netweight':
      return num(extra.netWeight);
    case 'volume':
    case 'cbm':
      return num(figures.volume);
    case 'chargeablevolume':
      return num(figures.chargeableVolume);
    case 'weightvolume':
    case 'wm':
    case 'revenueton':
      return num(figures.weightVolume);
    case 'container':
    case 'percontainer':
    case 'teu':
      return num(extra.containerCount, figures.units) || 1;
    case 'truck':
    case 'pertruck':
      return num(extra.truckCount, figures.units) || 1;
    case 'package':
    case 'perpackage':
    case 'pkg':
      return num(extra.packageCount) || 1;
    case 'shipment':
    case 'pershipment':
    case 'flat':
    case 'lumpsum':
      return 1;
    default:
      return num(extra.quantity, 1) || 1;
  }
};

module.exports = {
  DEFAULT_DIVISORS,
  DEFAULT_ROAD_KG_PER_M3,
  volumeFromPackages,
  volumetricWeight,
  computeChargeable,
  quantityForBasis,
  round,
};

// --- self-check -------------------------------------------------------------
// node src/services/chargeableWeight.js
if (require.main === module) {
  const assert = require('assert');

  // Air, IATA 1:6000. 2 m3 -> 2,000,000 cm3 / 6000 = 333.333 kg, beats 100 kg.
  let r = computeChargeable({ transportMode: 'AIR', grossWeight: 100, volume: 2 });
  assert.strictEqual(r.volumetricWeight, 333.333);
  assert.strictEqual(r.chargeableWeight, 333.333);
  assert.strictEqual(r.basis, 'volumetric');

  // Air where actual weight wins.
  r = computeChargeable({ transportMode: 'AIR', grossWeight: 900, volume: 2 });
  assert.strictEqual(r.chargeableWeight, 900);
  assert.strictEqual(r.basis, 'weight');

  // Courier 1:5000 is denser, so the same 2 m3 costs more.
  r = computeChargeable({ transportMode: 'COURIER', grossWeight: 100, volume: 2 });
  assert.strictEqual(r.volumetricWeight, 400);
  assert.strictEqual(r.divisorUsed, 5000);

  // Sea LCL W/M: 3.2 t vs 5 m3 -> 5 revenue tons.
  r = computeChargeable({ transportMode: 'SEA', shipmentType: 'LCL', grossWeight: 3200, volume: 5 });
  assert.strictEqual(r.weightVolume, 5);
  assert.strictEqual(r.chargeableWeight, 5000);
  assert.strictEqual(r.basis, 'measurement');

  // Sea LCL where weight wins: 8 t vs 5 m3 -> 8 revenue tons.
  r = computeChargeable({ transportMode: 'SEA', shipmentType: 'LCL', grossWeight: 8000, volume: 5 });
  assert.strictEqual(r.weightVolume, 8);
  assert.strictEqual(r.basis, 'weight');

  // Sea FCL bills per container and leaves gross weight alone.
  r = computeChargeable({ transportMode: 'SEA', shipmentType: 'FCL', grossWeight: 21000, volume: 60, containerCount: 2 });
  assert.strictEqual(r.chargeableWeight, 21000);
  assert.strictEqual(r.units, 2);
  assert.strictEqual(r.basis, 'per_container');
  // A revenue ton stays a revenue ton on an FCL shipment: 21 t vs 60 m3 -> 60.
  assert.strictEqual(r.weightVolume, 60);
  assert.strictEqual(quantityForBasis('W/M', r), 60);
  // And where the weight wins: 30 t vs 25 m3 -> 30.
  r = computeChargeable({ transportMode: 'SEA', shipmentType: 'FCL', grossWeight: 30000, volume: 25, containerCount: 1 });
  assert.strictEqual(r.weightVolume, 30);

  // Road groupage at 333 kg/m3.
  r = computeChargeable({ transportMode: 'ROAD', shipmentType: 'LTL', grossWeight: 500, volume: 4 });
  assert.strictEqual(r.volumetricWeight, 1332);
  assert.strictEqual(r.chargeableWeight, 1332);

  // Road FTL is per truck.
  r = computeChargeable({ transportMode: 'ROAD', shipmentType: 'FTL', grossWeight: 18000, truckCount: 3 });
  assert.strictEqual(r.units, 3);
  assert.strictEqual(r.basis, 'per_truck');

  // Volume derived from package dimensions: 120x80x100 cm x2 = 1.92 m3.
  assert.strictEqual(
    volumeFromPackages([{ length: 120, width: 80, height: 100, quantity: 2 }]),
    1.92,
  );

  // A zero/absent divisor must not produce Infinity or NaN.
  assert.strictEqual(volumetricWeight(5, 0), 0);
  r = computeChargeable({ transportMode: 'AIR', grossWeight: 10, volume: 'oops' });
  assert.strictEqual(r.volume, 0);
  assert.strictEqual(r.chargeableWeight, 10);

  // Measurement basis routing.
  const figs = computeChargeable({ transportMode: 'SEA', shipmentType: 'LCL', grossWeight: 3200, volume: 5 });
  assert.strictEqual(quantityForBasis('W/M', figs), 5);
  assert.strictEqual(quantityForBasis('Gross Weight', figs), 3200);
  assert.strictEqual(quantityForBasis('Per Shipment', figs), 1);
  assert.strictEqual(quantityForBasis('Container', figs, { containerCount: 4 }), 4);
  assert.strictEqual(quantityForBasis('nonsense', figs, { quantity: 7 }), 7);

  console.log('chargeableWeight self-check OK');
}
