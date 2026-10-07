/**
 * Seeded pincode checks for the demo: format, serviceability and a city/state lookup.
 * A real build would call a pincode directory and the courier's serviceability API.
 */
import { UNSERVICEABLE_PINCODES } from "./seed";

/** First-3-digit prefixes → city (only the areas the demo uses). */
const CITY_BY_PREFIX: Record<string, string> = {
  "110": "Delhi",
  "122": "Gurugram",
  "160": "Chandigarh",
  "201": "Noida",
  "210": "Banda",
  "226": "Lucknow",
  "271": "Bahraich",
  "302": "Jaipur",
  "305": "Ajmer",
  "332": "Sikar",
  "335": "Sri Ganganagar",
  "342": "Jodhpur",
  "344": "Barmer",
  "380": "Ahmedabad",
  "400": "Mumbai",
  "411": "Pune",
  "452": "Indore",
  "500": "Hyderabad",
  "560": "Bengaluru",
  "600": "Chennai",
  "695": "Thiruvananthapuram",
  "700": "Kolkata",
  "823": "Gaya",
  "846": "Darbhanga",
};

/** First-2-digit prefixes → state (postal circles). */
const STATE_BY_PREFIX: [string[], string][] = [
  [["11"], "Delhi"],
  [["12", "13"], "Haryana"],
  [["14", "15"], "Punjab"],
  [["16"], "Chandigarh"],
  [["17"], "Himachal Pradesh"],
  [["18", "19"], "Jammu & Kashmir"],
  [["20", "21", "22", "23", "24", "25", "26", "27", "28"], "Uttar Pradesh"],
  [["30", "31", "32", "33", "34"], "Rajasthan"],
  [["36", "37", "38", "39"], "Gujarat"],
  [["40", "41", "42", "43", "44"], "Maharashtra"],
  [["45", "46", "47", "48"], "Madhya Pradesh"],
  [["49"], "Chhattisgarh"],
  [["50"], "Telangana"],
  [["51", "52", "53"], "Andhra Pradesh"],
  [["56", "57", "58", "59"], "Karnataka"],
  [["60", "61", "62", "63", "64"], "Tamil Nadu"],
  [["67", "68", "69"], "Kerala"],
  [["70", "71", "72", "73", "74"], "West Bengal"],
  [["75", "76", "77"], "Odisha"],
  [["78"], "Assam"],
  [["80", "81", "82", "83", "84", "85"], "Bihar"],
];

export type PincodeCheck =
  | { status: "empty" }
  | { status: "invalid"; error: string }
  | { status: "unserviceable"; city: string; state: string }
  | { status: "ok"; city: string; state: string };

export function checkPincode(raw: string): PincodeCheck {
  const pin = raw.trim();
  if (!pin) return { status: "empty" };
  // Indian pincodes are 6 digits and start with 1–8 (so 000000 and 999999 are invalid).
  if (!/^\d{6}$/.test(pin)) return { status: "invalid", error: "Enter a 6-digit pincode" };
  if (!/^[1-8]\d{5}$/.test(pin)) return { status: "invalid", error: "Invalid pincode" };
  const city = CITY_BY_PREFIX[pin.slice(0, 3)] ?? "";
  const state = STATE_BY_PREFIX.find(([prefixes]) => prefixes.includes(pin.slice(0, 2)))?.[1] ?? "";
  if (UNSERVICEABLE_PINCODES.includes(pin)) return { status: "unserviceable", city, state };
  return { status: "ok", city, state };
}

/** Other spellings buyers use for the cities above. */
const CITY_ALIASES: Record<string, string> = {
  "new delhi": "Delhi",
  bangalore: "Bengaluru",
  gurgaon: "Gurugram",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  trivandrum: "Thiruvananthapuram",
};

const KNOWN_CITIES: [string, string][] = [
  ...Object.values(CITY_BY_PREFIX).map((c): [string, string] => [c.toLowerCase(), c]),
  ...Object.entries(CITY_ALIASES),
];

/** Known city named in free address text (e.g. "… Rohini, Delhi 110085" → "Delhi"), or "". */
export function knownCityIn(address: string): string {
  const a = ` ${address.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
  const hit = KNOWN_CITIES.filter(([name]) => a.includes(` ${name} `)).sort(
    (x, y) => y[0].length - x[0].length,
  )[0];
  return hit?.[1] ?? "";
}

/**
 * Best guess at the city from a cleaned address: a known city if one is named, otherwise the
 * last comma-separated part (without the pincode) if it looks like a place name.
 */
export function cityFromAddress(address: string): string {
  const known = knownCityIn(address);
  if (known) return known;
  const parts = address
    .replace(/\b\d{6}\b/g, "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (parts.length < 2 || !/^[a-z][a-z .]{2,29}$/i.test(last)) return "";
  return last.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
