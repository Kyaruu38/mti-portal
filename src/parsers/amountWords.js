// Rule-based amount-in-words in Indonesian, English and Mandarin (financial 大写).
// Supports IDR (no decimals) and USD (2 decimals). Grounded in the PRF sample:
//   IDR 2,862,720,000 -> "Rupiah 2 Billion 862 Million 720 Thousand Rupiah"
//                        "二十八亿六千二百七十二万印尼盾" (normal) / 大写 variant.
//   IDR 1,656,000,000 -> "壹拾陆亿伍仟陆佰万印尼盾整"

// ---------- English ----------
const EN_ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const EN_TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const EN_SCALE = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

function enTriple(n) {
  let s = '';
  const h = Math.floor(n / 100), r = n % 100;
  if (h) s += EN_ONES[h] + ' hundred' + (r ? ' ' : '');
  if (r < 20) s += r ? EN_ONES[r] : '';
  else s += EN_TENS[Math.floor(r / 10)] + (r % 10 ? '-' + EN_ONES[r % 10] : '');
  return s;
}
function enInt(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  let out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) out.push(enTriple(groups[i]) + (EN_SCALE[i] ? ' ' + EN_SCALE[i] : ''));
  }
  return out.join(' ');
}

// ---------- Indonesian ----------
const ID_ONES = ['nol','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
function idBelow1000(n) {
  let s = '';
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 1) s += 'seratus';
  else if (h > 1) s += ID_ONES[h] + ' ratus';
  if (r) { if (h) s += ' '; s += idBelow100(r); }
  return s;
}
function idBelow100(n) {
  if (n < 12) return ID_ONES[n];
  if (n < 20) return ID_ONES[n - 10] + ' belas';
  const t = Math.floor(n / 10), r = n % 10;
  return ID_ONES[t] + ' puluh' + (r ? ' ' + ID_ONES[r] : '');
}
function idInt(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'nol';
  const scales = ['', 'ribu', 'juta', 'miliar', 'triliun', 'kuadriliun'];
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  let out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    if (i === 1 && g === 1) out.push('seribu');
    else out.push(idBelow1000(g) + (scales[i] ? ' ' + scales[i] : ''));
  }
  return out.join(' ');
}

// ---------- Chinese (financial 大写) ----------
const ZH_DIGITS = ['零','壹','贰','叁','肆','伍','陆','柒','捌','玖'];
const ZH_SMALL = ['', '拾', '佰', '仟'];
const ZH_BIG = ['', '万', '亿', '兆'];

function zhFour(n) {
  // n: 0..9999 -> financial string without trailing big-unit
  let s = '', zero = false, started = false;
  for (let pos = 3; pos >= 0; pos--) {
    const d = Math.floor(n / Math.pow(10, pos)) % 10;
    if (d === 0) { zero = started; }
    else {
      if (zero) s += '零';
      s += ZH_DIGITS[d] + ZH_SMALL[pos];
      zero = false; started = true;
    }
  }
  return s;
}
function zhInt(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return '零';
  const groups = [];
  while (n > 0) { groups.push(n % 10000); n = Math.floor(n / 10000); }
  let out = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) {
      // insert a single zero between non-empty higher and lower groups
      if (out && !out.endsWith('零') && i > 0) out += '零';
      continue;
    }
    let seg = zhFour(g);
    // if this group < 1000 and there is a higher group, prefix 零
    if (out && g < 1000) out += '零';
    out += seg + ZH_BIG[i];
  }
  return out;
}

// ---------- Public API ----------
// Currency config. IDR is integer-only; USD/EUR/CNY carry decimal (jiao/fen) parts.
const CCY = {
  IDR: { integer: true, en: 'Rupiah', id: 'Rupiah', zh: '印尼盾' },
  USD: { en: 'US Dollars', id: 'Dolar AS', zh: '美元' },
  EUR: { en: 'Euros', id: 'Euro', zh: '欧元' },
  CNY: { en: 'Chinese Yuan (RMB)', id: 'Yuan Tiongkok (RMB)', zh: '元' },
};

// ccy: 'IDR' | 'USD' | 'EUR' | 'CNY'. Returns { id, en, zh }.
export function amountInWords(amount, ccy = 'IDR') {
  const cfg = CCY[ccy] || CCY.IDR;
  const abs = Math.abs(Number(amount) || 0);

  if (cfg.integer) {
    const n = Math.round(abs);
    return {
      en: cap(enInt(n)) + ' ' + cfg.en + ' only',
      id: cap(idInt(n)) + ' ' + cfg.id,
      zh: zhInt(n) + cfg.zh + '整',
    };
  }

  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);
  const en = cap(enInt(whole)) + ' ' + cfg.en + (cents ? ' and ' + enInt(cents) + ' Cents' : '') + ' only';
  const id = cap(cfg.id) + ' ' + cap(idInt(whole)) + (cents ? ' koma ' + idInt(cents) + ' sen' : '') + ' saja';
  // Chinese financial: <unit> + 角/分, or 整 when no cents.
  let zh = zhInt(whole) + cfg.zh;
  if (cents) {
    const jiao = Math.floor(cents / 10), fen = cents % 10;
    zh += (jiao ? ZH_DIGITS[jiao] + '角' : '') + (fen ? ZH_DIGITS[fen] + '分' : '');
  } else zh += '整';
  return { id, en, zh };
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
