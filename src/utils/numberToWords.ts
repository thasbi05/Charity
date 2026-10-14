/**
 * Number to words converter utility for official receipts and vouchers.
 * Supports multi-currency naming (AED, INR, USD, EUR, GBP, SAR) and fraction units.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

const CURRENCY_UNITS: Record<string, { main: string; plural: string; fraction: string }> = {
  AED: { main: 'UAE Dirham', plural: 'UAE Dirhams', fraction: 'Fils' },
  INR: { main: 'Indian Rupee', plural: 'Indian Rupees', fraction: 'Paise' },
  USD: { main: 'US Dollar', plural: 'US Dollars', fraction: 'Cents' },
  EUR: { main: 'Euro', plural: 'Euros', fraction: 'Cents' },
  GBP: { main: 'British Pound', plural: 'British Pounds', fraction: 'Pence' },
  SAR: { main: 'Saudi Riyal', plural: 'Saudi Riyals', fraction: 'Halalas' },
  QAR: { main: 'Qatari Riyal', plural: 'Qatari Riyals', fraction: 'Dirhams' },
  OMR: { main: 'Omani Rial', plural: 'Omani Rials', fraction: 'Baisa' },
  KWD: { main: 'Kuwaiti Dinar', plural: 'Kuwaiti Dinars', fraction: 'Fils' },
  BHD: { main: 'Bahraini Dinar', plural: 'Bahraini Dinars', fraction: 'Fils' },
  PKR: { main: 'Pakistani Rupee', plural: 'Pakistani Rupees', fraction: 'Paisa' },
  BDT: { main: 'Bangladeshi Taka', plural: 'Bangladeshi Taka', fraction: 'Poisha' },
  EGP: { main: 'Egyptian Pound', plural: 'Egyptian Pounds', fraction: 'Piastres' },
  JOD: { main: 'Jordanian Dinar', plural: 'Jordanian Dinars', fraction: 'Piastres' },
  CAD: { main: 'Canadian Dollar', plural: 'Canadian Dollars', fraction: 'Cents' },
  AUD: { main: 'Australian Dollar', plural: 'Australian Dollars', fraction: 'Cents' },
  SGD: { main: 'Singapore Dollar', plural: 'Singapore Dollars', fraction: 'Cents' },
  MYR: { main: 'Malaysian Ringgit', plural: 'Malaysian Ringgit', fraction: 'Sen' },
  TRY: { main: 'Turkish Lira', plural: 'Turkish Lira', fraction: 'Kurus' },
  ZAR: { main: 'South African Rand', plural: 'South African Rand', fraction: 'Cents' },
};

function convertBelowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n] + ' ';
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') + ' ';
  return ONES[Math.floor(n / 100)] + ' Hundred ' + convertBelowThousand(n % 100);
}

export function numberToWords(amount: number, currency = 'AED'): string {
  if (isNaN(amount) || amount === 0) {
    const unit = CURRENCY_UNITS[currency.toUpperCase()]?.plural || currency;
    return `Zero ${unit} Only`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const wholeNumber = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - wholeNumber) * 100);

  let result = '';

  const billions = Math.floor(wholeNumber / 1000000000);
  const millions = Math.floor((wholeNumber % 1000000000) / 1000000);
  const thousands = Math.floor((wholeNumber % 1000000) / 1000);
  const remainder = wholeNumber % 1000;

  if (billions) result += convertBelowThousand(billions) + 'Billion ';
  if (millions) result += convertBelowThousand(millions) + 'Million ';
  if (thousands) result += convertBelowThousand(thousands) + 'Thousand ';
  if (remainder) result += convertBelowThousand(remainder);

  result = result.trim();

  const unitMeta = CURRENCY_UNITS[currency.toUpperCase()];
  const currencyName = wholeNumber === 1 ? (unitMeta?.main || currency) : (unitMeta?.plural || currency);

  let formatted = `${isNegative ? 'Negative ' : ''}${currencyName} ${result || 'Zero'}`;

  if (decimalPart > 0) {
    const fractionName = unitMeta?.fraction || 'Fils';
    formatted += ` and ${decimalPart}/100 ${fractionName}`;
  }

  formatted += ' Only';
  return formatted;
}
