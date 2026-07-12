// Curated list of MUN-relevant delegations.
// code2 = ISO 3166-1 alpha-2 (used as terminal-style tag in chat bubbles).
export const MUN_COUNTRIES = [
  { code2: "US", flag: "🇺🇸", name: "United States",       bloc: "P5 · NATO · OECD" },
  { code2: "RU", flag: "🇷🇺", name: "Russia",              bloc: "P5 · BRICS · CSTO" },
  { code2: "CN", flag: "🇨🇳", name: "China",               bloc: "P5 · BRICS · G77" },
  { code2: "FR", flag: "🇫🇷", name: "France",              bloc: "P5 · NATO · EU" },
  { code2: "GB", flag: "🇬🇧", name: "United Kingdom",      bloc: "P5 · NATO · Commonwealth" },
  { code2: "BR", flag: "🇧🇷", name: "Brazil",              bloc: "BRICS · G77 · CELAC · IBSA" },
  { code2: "IN", flag: "🇮🇳", name: "India",               bloc: "BRICS · G77 · NAM · IBSA" },
  { code2: "DE", flag: "🇩🇪", name: "Germany",             bloc: "NATO · EU · G7" },
  { code2: "JP", flag: "🇯🇵", name: "Japan",               bloc: "G7 · QUAD · OECD" },
  { code2: "ZA", flag: "🇿🇦", name: "South Africa",        bloc: "BRICS · AU · G77 · IBSA" },
  { code2: "NG", flag: "🇳🇬", name: "Nigeria",             bloc: "AU · ECOWAS · G77" },
  { code2: "EG", flag: "🇪🇬", name: "Egypt",               bloc: "AU · Arab League · G77" },
  { code2: "MX", flag: "🇲🇽", name: "Mexico",              bloc: "OECD · CELAC · G20" },
  { code2: "AR", flag: "🇦🇷", name: "Argentina",           bloc: "G20 · CELAC · Mercosur" },
  { code2: "SA", flag: "🇸🇦", name: "Saudi Arabia",        bloc: "GCC · OPEC · Arab League" },
  { code2: "IR", flag: "🇮🇷", name: "Iran",                bloc: "NAM · OPEC · ECO" },
  { code2: "TR", flag: "🇹🇷", name: "Turkey",              bloc: "NATO · G20" },
  { code2: "KR", flag: "🇰🇷", name: "South Korea",         bloc: "OECD · G20" },
  { code2: "ID", flag: "🇮🇩", name: "Indonesia",           bloc: "ASEAN · G20 · NAM" },
  { code2: "AU", flag: "🇦🇺", name: "Australia",           bloc: "QUAD · OECD · Commonwealth" },
  { code2: "CA", flag: "🇨🇦", name: "Canada",              bloc: "NATO · G7 · Commonwealth" },
  { code2: "IT", flag: "🇮🇹", name: "Italy",               bloc: "NATO · EU · G7" },
  { code2: "ES", flag: "🇪🇸", name: "Spain",               bloc: "NATO · EU" },
  { code2: "PL", flag: "🇵🇱", name: "Poland",              bloc: "NATO · EU" },
  { code2: "UA", flag: "🇺🇦", name: "Ukraine",             bloc: "EU candidate" },
  { code2: "PK", flag: "🇵🇰", name: "Pakistan",            bloc: "NAM · G77 · OIC" },
  { code2: "ET", flag: "🇪🇹", name: "Ethiopia",            bloc: "AU · G77" },
  { code2: "KE", flag: "🇰🇪", name: "Kenya",               bloc: "AU · EAC · G77" },
  { code2: "CO", flag: "🇨🇴", name: "Colombia",            bloc: "CELAC · OAS" },
  { code2: "CL", flag: "🇨🇱", name: "Chile",               bloc: "OECD · CELAC · Pacific Alliance" },
  { code2: "IL", flag: "🇮🇱", name: "Israel",              bloc: "OECD" },
  { code2: "VE", flag: "🇻🇪", name: "Venezuela",           bloc: "OPEC · ALBA · NAM" },
  { code2: "CU", flag: "🇨🇺", name: "Cuba",                bloc: "ALBA · G77 · NAM" },
];

export function findCountryByCode(code2) {
  return MUN_COUNTRIES.find((c) => c.code2 === code2);
}
