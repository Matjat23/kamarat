// Where the person lives. Katty guesses it from the browser's time zone and
// language, and the person can change it. It is stored only in this browser.
// The country is used for official pages, for which days are the weekend when
// counting business days, and as context when a letter is explained.

import { t, dateLocale } from './i18n'

const CODES = `AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY
BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO
FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE
KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT
MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU
RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA
UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(/\s+/)

// Country names in the language on screen (English if the browser has none).
const namesByLocale = {}
function displayNames(locale) {
  if (!namesByLocale[locale]) {
    try {
      namesByLocale[locale] = new Intl.DisplayNames([locale, 'en'], { type: 'region' })
    } catch {
      namesByLocale[locale] = new Intl.DisplayNames(['en'], { type: 'region' })
    }
  }
  return namesByLocale[locale]
}

export function countryName(code, locale = dateLocale()) {
  if (!code) return ''
  try {
    return displayNames(locale).of(code) ?? code
  } catch {
    return code
  }
}

// Other names people search for, when the official one is different.
export const COUNTRY_ALIASES = {
  US: ['USA', 'America', 'United States of America'],
  GB: ['UK', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  AE: ['UAE', 'Emirates'],
  CD: ['DRC', 'DR Congo', 'Democratic Republic of the Congo'],
  CG: ['Republic of the Congo'],
  CI: ['Ivory Coast'],
  CZ: ['Czech Republic', 'Czechia'],
  NL: ['Holland'],
  KR: ['South Korea'],
  KP: ['North Korea'],
  TR: ['Turkey', 'Türkiye'],
  MM: ['Burma'],
  SZ: ['Swaziland'],
  MK: ['Macedonia'],
  CV: ['Cape Verde'],
  TL: ['East Timor'],
  PS: ['Palestine'],
  VA: ['Vatican'],
}

// For the AI, the country is always named in English.
export const countryNameEnglish = (code) => countryName(code, 'en')

export function countryList() {
  return CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name))
}

// Time zones of the most common places people move to and from.
const ZONES = `Europe/Stockholm:SE Europe/Oslo:NO Europe/Copenhagen:DK Europe/Helsinki:FI Atlantic/Reykjavik:IS
Europe/London:GB Europe/Dublin:IE Europe/Paris:FR Europe/Brussels:BE Europe/Amsterdam:NL Europe/Luxembourg:LU
Europe/Berlin:DE Europe/Vienna:AT Europe/Zurich:CH Europe/Rome:IT Europe/Madrid:ES Atlantic/Canary:ES
Europe/Lisbon:PT Europe/Warsaw:PL Europe/Prague:CZ Europe/Bratislava:SK Europe/Budapest:HU Europe/Bucharest:RO
Europe/Sofia:BG Europe/Athens:GR Europe/Zagreb:HR Europe/Ljubljana:SI Europe/Belgrade:RS Europe/Sarajevo:BA
Europe/Skopje:MK Europe/Tirane:AL Europe/Podgorica:ME Europe/Tallinn:EE Europe/Riga:LV Europe/Vilnius:LT
Europe/Kiev:UA Europe/Kyiv:UA Europe/Chisinau:MD Europe/Minsk:BY Europe/Moscow:RU Europe/Istanbul:TR
Europe/Malta:MT Asia/Nicosia:CY Asia/Tbilisi:GE Asia/Yerevan:AM Asia/Baku:AZ Asia/Tehran:IR Asia/Kabul:AF
Asia/Baghdad:IQ Asia/Damascus:SY Asia/Beirut:LB Asia/Amman:JO Asia/Jerusalem:IL Asia/Gaza:PS Asia/Hebron:PS
Asia/Riyadh:SA Asia/Dubai:AE Asia/Qatar:QA Asia/Kuwait:KW Asia/Bahrain:BH Asia/Muscat:OM Asia/Aden:YE
Asia/Karachi:PK Asia/Kolkata:IN Asia/Calcutta:IN Asia/Dhaka:BD Asia/Kathmandu:NP Asia/Colombo:LK
Asia/Yangon:MM Asia/Bangkok:TH Asia/Ho_Chi_Minh:VN Asia/Saigon:VN Asia/Phnom_Penh:KH Asia/Jakarta:ID
Asia/Kuala_Lumpur:MY Asia/Singapore:SG Asia/Manila:PH Asia/Shanghai:CN Asia/Hong_Kong:HK Asia/Taipei:TW
Asia/Seoul:KR Asia/Tokyo:JP Asia/Tashkent:UZ Asia/Almaty:KZ Asia/Bishkek:KG Asia/Dushanbe:TJ
Asia/Ashgabat:TM Asia/Ulaanbaatar:MN Australia/Sydney:AU Australia/Melbourne:AU Australia/Brisbane:AU
Australia/Perth:AU Australia/Adelaide:AU Pacific/Auckland:NZ Africa/Dakar:SN Africa/Bamako:ML
Africa/Conakry:GN Africa/Abidjan:CI Africa/Accra:GH Africa/Lagos:NG Africa/Douala:CM Africa/Kinshasa:CD
Africa/Lubumbashi:CD Africa/Brazzaville:CG Africa/Libreville:GA Africa/Luanda:AO Africa/Nairobi:KE
Africa/Addis_Ababa:ET Africa/Asmara:ER Africa/Mogadishu:SO Africa/Djibouti:DJ Africa/Kampala:UG
Africa/Kigali:RW Africa/Dar_es_Salaam:TZ Africa/Khartoum:SD Africa/Juba:SS Africa/Cairo:EG
Africa/Tripoli:LY Africa/Tunis:TN Africa/Algiers:DZ Africa/Casablanca:MA Africa/Nouakchott:MR
Africa/Banjul:GM Africa/Bissau:GW Africa/Freetown:SL Africa/Monrovia:LR Africa/Ouagadougou:BF
Africa/Niamey:NE Africa/Ndjamena:TD Africa/Lome:TG Africa/Porto-Novo:BJ Africa/Johannesburg:ZA
Africa/Maputo:MZ Africa/Harare:ZW Africa/Lusaka:ZM Africa/Windhoek:NA Africa/Gaborone:BW
America/New_York:US America/Chicago:US America/Denver:US America/Phoenix:US America/Los_Angeles:US
America/Anchorage:US Pacific/Honolulu:US America/Detroit:US America/Toronto:CA America/Vancouver:CA
America/Edmonton:CA America/Winnipeg:CA America/Halifax:CA America/Montreal:CA America/Mexico_City:MX
America/Tijuana:MX America/Bogota:CO America/Lima:PE America/Caracas:VE America/Santiago:CL
America/Argentina/Buenos_Aires:AR America/Buenos_Aires:AR America/Sao_Paulo:BR America/Montevideo:UY
America/Asuncion:PY America/La_Paz:BO America/Guayaquil:EC America/Havana:CU America/Santo_Domingo:DO
America/Port-au-Prince:HT America/Jamaica:JM America/Guatemala:GT America/El_Salvador:SV
America/Tegucigalpa:HN America/Managua:NI America/Costa_Rica:CR America/Panama:PA`
  .split(/\s+/)
  .reduce((map, pair) => {
    const [zone, code] = pair.split(':')
    map[zone] = code
    return map
  }, {})

export function guessCountry() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (ZONES[zone]) return ZONES[zone]
  } catch {
    // no time zone, try the browser language below
  }
  for (const tag of navigator.languages ?? []) {
    const region = tag.split('-')[1]?.toUpperCase()
    if (region && CODES.includes(region)) return region
  }
  return ''
}

const KEY = 'katty.country'

export function savedCountry() {
  try {
    const code = localStorage.getItem(KEY)
    return code && CODES.includes(code) ? code : ''
  } catch {
    return ''
  }
}

export function saveCountry(code) {
  try {
    localStorage.setItem(KEY, code)
  } catch {
    // private mode: the choice lasts until the page is closed
  }
}

// Which days are the weekend (0 is Sunday, 6 is Saturday), for counting
// business days. Most countries rest on Saturday and Sunday.
const FRIDAY_SATURDAY = ['SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'IL', 'JO', 'IQ', 'DZ', 'LY', 'YE', 'SD', 'BD']
const FRIDAY_ONLY = ['IR']

export function weekendDays(code) {
  if (FRIDAY_SATURDAY.includes(code)) return [5, 6]
  if (FRIDAY_ONLY.includes(code)) return [5]
  return [6, 0]
}

// Names of week days in the language on screen: [5, 6] -> "Friday and Saturday".
export function dayNames(days) {
  const label = (d) => new Date(2026, 0, 4 + d).toLocaleDateString(dateLocale(), { weekday: 'long' })
  return days.map(label).join(t(' and '))
}

export function weekendText(code) {
  return dayNames(weekendDays(code))
}
