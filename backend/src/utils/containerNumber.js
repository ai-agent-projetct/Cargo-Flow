// ISO 6346 container numbers: a 3-letter owner code, an equipment category
// letter (U for freight containers), a 6-digit serial and a check digit.
//
// The check digit is what catches a mistyped container number before it is
// printed on a bill of lading, so it is validated wherever a number is keyed
// in, and computed when one is generated.

// Letter values skip every multiple of 11 (11, 22, 33), per the standard.
const LETTER_VALUES = (() => {
  const out = {};
  let v = 10;
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (v % 11 === 0) v += 1;
    out[ch] = v;
    v += 1;
  }
  return out;
})();

const FORMAT = /^[A-Z]{3}[UJZ][0-9]{6}[0-9]$/;

/** Check digit for the first ten characters (owner + category + serial). */
const checkDigit = (first10) => {
  const s = String(first10 || '').toUpperCase();
  if (!/^[A-Z]{3}[UJZ][0-9]{6}$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < 10; i += 1) {
    const ch = s[i];
    const value = /[0-9]/.test(ch) ? Number(ch) : LETTER_VALUES[ch];
    total += value * (2 ** i);
  }
  // A remainder of 10 is written as 0.
  return (total % 11) % 10;
};

/**
 * Validate a container number.
 * @returns {{ valid: boolean, normalised: string, reason?: string }}
 */
const validate = (raw) => {
  const normalised = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
  if (!FORMAT.test(normalised)) {
    return {
      valid: false,
      normalised,
      reason: 'Expected 4 letters, 6 digits and a check digit, e.g. MSCU1234565',
    };
  }
  const expected = checkDigit(normalised.slice(0, 10));
  if (expected !== Number(normalised[10])) {
    return {
      valid: false,
      normalised,
      reason: `Check digit should be ${expected}, not ${normalised[10]}`,
    };
  }
  return { valid: true, normalised };
};

/** Build a valid number from an owner prefix (e.g. "MSCU") and a serial. */
const make = (ownerPrefix, serial) => {
  const prefix = String(ownerPrefix || 'CFXU').toUpperCase().slice(0, 4).padEnd(4, 'U');
  const six = String(Math.abs(Math.trunc(Number(serial) || 0)) % 1000000).padStart(6, '0');
  return `${prefix}${six}${checkDigit(prefix + six)}`;
};

module.exports = { checkDigit, validate, make };

// --- self-check -------------------------------------------------------------
// node src/utils/containerNumber.js
if (require.main === module) {
  const assert = require('assert');
  // Worked example from the ISO 6346 standard.
  assert.strictEqual(checkDigit('CSQU305438'), 3);
  assert.strictEqual(validate('CSQU3054383').valid, true);
  assert.strictEqual(validate('csqu 305438-3').valid, true);
  // One wrong digit is caught.
  const bad = validate('CSQU3054384');
  assert.strictEqual(bad.valid, false);
  assert.match(bad.reason, /should be 3/);
  // Malformed input is rejected rather than thrown on.
  assert.strictEqual(validate('MSC123').valid, false);
  assert.strictEqual(validate(null).valid, false);
  // A generated number always validates.
  for (let i = 0; i < 500; i += 1) {
    assert.strictEqual(validate(make('MSCU', i * 7919)).valid, true);
  }
  // Letter values skip the multiples of 11.
  assert.strictEqual(LETTER_VALUES.A, 10);
  assert.strictEqual(LETTER_VALUES.K, 21);
  assert.strictEqual(LETTER_VALUES.L, 23);
  assert.strictEqual(LETTER_VALUES.V, 34);
  console.log('containerNumber self-check OK');
}
