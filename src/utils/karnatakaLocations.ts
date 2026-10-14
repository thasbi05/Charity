/**
 * Karnataka Districts & Taluks Directory
 * Specifically tailored for Coastal Karnataka (Udupi / Mangalore) community records
 */

export const KARNATAKA_DISTRICTS = [
  'Udupi',
  'Dakshina Kannada (Mangalore)',
  'Uttara Kannada (Karwar)',
  'Shimoga',
  'Chikmagalur',
  'Hassan',
  'Bengaluru',
  'Other Karnataka District',
] as const;

export type KarnatakaDistrict = typeof KARNATAKA_DISTRICTS[number];

export const KARNATAKA_TALUKS: Record<string, string[]> = {
  'Udupi': [
    'Udupi',
    'Kapu (Kaup)',
    'Brahmavar',
    'Kundapura',
    'Karkala',
    'Byndoor',
    'Hebri',
    'Other / Custom',
  ],
  'Dakshina Kannada (Mangalore)': [
    'Mangalore',
    'Bantwal',
    'Belthangady',
    'Puttur',
    'Sullia',
    'Moodbidri',
    'Kadaba',
    'Mulki',
    'Other / Custom',
  ],
  'Uttara Kannada (Karwar)': [
    'Karwar',
    'Bhatkal',
    'Kumta',
    'Honnavar',
    'Ankola',
    'Sirsi',
    'Siddapur',
    'Yellapur',
    'Dandeli',
    'Haliyal',
    'Joida',
    'Other / Custom',
  ],
  'Shimoga': [
    'Shivamogga',
    'Bhadravathi',
    'Thirthahalli',
    'Sagar',
    'Shikaripura',
    'Soraba',
    'Hosanagara',
    'Other / Custom',
  ],
  'Chikmagalur': [
    'Chikkamagaluru',
    'Mudigere',
    'Koppa',
    'Sringeri',
    'Narasimharajapura',
    'Tarikere',
    'Kadur',
    'Ajjampura',
    'Other / Custom',
  ],
  'Hassan': [
    'Hassan',
    'Arsikere',
    'Channarayapatna',
    'Holenarasipura',
    'Sakleshpur',
    'Arkalgud',
    'Belur',
    'Alur',
    'Other / Custom',
  ],
  'Bengaluru': [
    'Bengaluru North',
    'Bengaluru South',
    'Bengaluru East',
    'Anekal',
    'Yelahanka',
    'Other / Custom',
  ],
  'Other Karnataka District': [
    'Other / Custom',
  ],
};
