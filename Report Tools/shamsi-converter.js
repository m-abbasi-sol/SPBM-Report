// shamsi-converter.js
// A complete and robust set of Shamsi (Jalali) and Gregorian date conversion functions.
// This implementation aims for accuracy and consistency between toShamsi and fromShamsi.

// Global constants for days in Gregorian and Jalali months
const G_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const J_DAYS_IN_MONTH = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

/**
 * Converts a Gregorian date (year, month, day) to a Shamsi (Jalali) date.
 * @param {number} gy - Gregorian year.
 * @param {number} gm - Gregorian month (1-12).
 * @param {number} gd - Gregorian day (1-31).
 * @returns {Array<number>} An array containing [Jalali year, Jalali month, Jalali day].
 */
function toShamsi(gy, gm, gd) {
  // Days from Jan 1 to start of each Gregorian month (non-leap year)
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  
  // Adjust Gregorian year for months before March (for leap year calculation)
  const gy2 = gm > 2 ? gy + 1 : gy;
  
  // Calculate total days from a reference point (e.g., Jan 1, 1600 Gregorian)
  // This formula accounts for leap years in Gregorian calendar.
  let days =
    355666 + // Offset to align with a known reference point for conversion
    365 * gy +
    Math.floor((gy2 + 3) / 4) - // Add days for Gregorian leap years
    Math.floor((gy2 + 99) / 100) + // Subtract days for years divisible by 100 (not leap unless by 400)
    Math.floor((gy2 + 399) / 400) + // Add days back for years divisible by 400
    gd + // Add current day
    g_d_m[gm - 1]; // Add days for full months passed in the current Gregorian year

  // Calculate approximate Jalali year
  let jy = -1595 + 33 * Math.floor(days / 12053); // 12053 days in a 33-year Jalali cycle
  days %= 12053; // Remaining days within the current 33-year cycle

  // Adjust Jalali year based on 4-year leap cycles within the 33-year cycle
  jy += 4 * Math.floor(days / 1461); // 1461 days in a 4-year Jalali cycle (365*4 + 1 leap day)
  days %= 1461; // Remaining days within the current 4-year cycle

  // Final adjustment for Jalali year if days exceed a non-leap year
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  // Calculate Jalali month and day based on remaining days
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  
  return [jy, jm, jd];
}

/**
 * Converts a Shamsi (Jalali) date (year, month, day) to a Gregorian date.
 * @param {number} jy - Shamsi (Jalali) year.
 * @param {number} jm - Shamsi (Jalali) month (1-12).
 * @param {number} jd - Shamsi (Jalali) day (1-31).
 * @returns {Array<number>} An array containing [Gregorian year, Gregorian month, Gregorian day].
 */
function fromShamsi(jy, jm, jd) {
  jy = parseInt(jy);
  jm = parseInt(jm);
  jd = parseInt(jd);

  // Adjust Jalali year for calculation reference (offset from 979 Jalali year)
  jy += 1595; // Offset to align with a known Gregorian reference point

  // Calculate total days from a reference point (e.g., Jan 1, 1600 Gregorian)
  // This formula accounts for leap years in Jalali calendar.
  let days =
    -355668 + // Offset for conversion from Jalali epoch to Gregorian reference
    365 * jy +
    Math.floor(jy / 33) * 8 + // Add days for Jalali leap years (8 leap days in 33-year cycle)
    Math.floor(((jy % 33) + 3) / 4) + // Further adjustment for Jalali leap years
    jd; // Add current day

  // Add days for full months passed in the current Jalali year
  for (let i = 0; i < jm - 1; i++) {
    days += J_DAYS_IN_MONTH[i];
  }

  // Calculate approximate Gregorian year
  let gy = 400 * Math.floor(days / 146097); // 146097 days in a 400-year Gregorian cycle
  days %= 146097; // Remaining days within the current 400-year cycle

  // Adjust Gregorian year based on 100-year cycles
  if (days >= 36524) { // 36524 days in a 100-year Gregorian cycle (approx)
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
  }

  // Adjust Gregorian year based on 4-year leap cycles
  gy += 4 * Math.floor(days / 1461); // 1461 days in a 4-year Gregorian cycle
  days %= 1461; // Remaining days within the current 4-year cycle

  // Final adjustment for Gregorian year if days exceed a non-leap year
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  // Calculate Gregorian month and day based on remaining days
  let gm = 0;
  while (days >= G_DAYS_IN_MONTH[gm] + ((gm === 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) ? 1 : 0)) {
    days -= G_DAYS_IN_MONTH[gm] + ((gm === 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) ? 1 : 0);
    gm++;
  }
  const gd = days + 1;
  
  return [gy, gm + 1, gd]; // gm + 1 to make it 1-indexed month
}

/**
 * Formats a Gregorian date string (yyyy-MM-dd) into a Shamsi date string (yyyy/MM/dd).
 * @param {string} gregorianDateString - The Gregorian date string in 'yyyy-MM-dd' format.
 * @returns {string} The formatted Shamsi date string (e.g., '1404/04/01').
 */
function formatShamsiDate(gregorianDateString) {
  if (!gregorianDateString) return '';
  const [gy, gm, gd] = gregorianDateString.split('-').map(Number);
  const [jy, jm, jd] = toShamsi(gy, gm, gd);
  return `${jy}/${jm < 10 ? '0' + jm : jm}/${jd < 10 ? '0' + jd : jd}`;
}

/**
 * Converts a number to its Persian equivalent digits.
 * @param {number|string} value - The number to convert.
 * @returns {string} The number with Persian digits.
 */
function toPersianDigits(value) {
  if (value == null) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return value.toString().replace(/\d/g, (x) => farsiDigits[x]);
}

/**
 * Calculates the Gregorian date for the first day of the current Shamsi month.
 * This function uses UTC to avoid timezone issues.
 * @returns {string} - The Gregorian date string (yyyy-MM-dd) for the first day of the current Shamsi month.
 */
function getShamsiMonthStart() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Set to UTC to avoid timezone issues
  const [jy, jm] = toShamsi(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const [gy, gm, gd] = fromShamsi(jy, jm, 1);
  // Construct Date object in UTC to prevent timezone shifts
  const gregorianMonthStart = new Date(Date.UTC(gy, gm - 1, gd));
  return gregorianMonthStart.toISOString().slice(0, 10);
}

/**
 * Calculates the Gregorian date for the first day of the current Shamsi week (Saturday).
 * This function uses UTC to avoid timezone issues.
 * @returns {string} - The Gregorian date string (yyyy-MM-dd) for the first day of the current Shamsi week.
 */
function getShamsiWeekStart() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Set to UTC to avoid timezone issues
  const currentDay = today.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

  // In Iranian calendar, Saturday is the first day of the week.
  // If today is Saturday (6), subtract 0 days.
  // If today is Sunday (0), subtract 1 day.
  // If today is Monday (1), subtract 2 days.
  // ...
  // If today is Friday (5), subtract 6 days.
  const daysToSubtract = currentDay === 6 ? 0 : currentDay + 1;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - daysToSubtract);
  
  return startOfWeek.toISOString().slice(0, 10);
}

/**
 * Calculates the Gregorian date for the first day of a Shamsi month, N months ago.
 * This function uses UTC to avoid timezone issues.
 * @param {number} monthsAgo - The number of Shamsi months to go back.
 * @returns {string} - The Gregorian date string (yyyy-MM-dd) for the first day of the calculated Shamsi month.
 */
function getShamsiMonthsAgoStart(monthsAgo) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Set to UTC to avoid timezone issues
  let [jy, jm] = toShamsi(today.getFullYear(), today.getMonth() + 1, today.getDate());
  
  jm -= monthsAgo;
  while (jm <= 0) {
    jm += 12;
    jy--;
  }

  const [gy, gm, gd] = fromShamsi(jy, jm, 1);
  // Construct Date object in UTC to prevent timezone shifts
  const gregorianDate = new Date(Date.UTC(gy, gm - 1, gd));
  return gregorianDate.toISOString().slice(0, 10);
}