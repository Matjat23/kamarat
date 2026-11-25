// Is this web address an official public website? Kamarat only shows links that
// pass this check, wherever they came from.
//
// 1. Government web zones, where only public bodies can get an address:
//    .gov, gov.uk, gouv.fr, gob.es, go.jp, gv.at, govt.nz, admin.ch, and so on.
//    The zone has to be one of these exactly: a look-alike such as admin.de or
//    government.fr does not count.
// 2. International public bodies: .int (for example the UN migration agency,
//    iom.int) and the EU (europa.eu).
// 3. Agencies and big cities in countries where the government does not use
//    such a zone, for example Sweden's migrationsverket.se. Added by hand.
//
// isHelpDomain also accepts a short list of well-known non-profits (the Red
// Cross, UNHCR, IOM, the IRC), for the moving guide. Letters only link to
// official sites.

const GOV_ZONES = [
  'gov.uk', 'gov.scot', 'gov.wales', 'gouv.fr', 'gob.es', 'gov.pt', 'gov.it', 'gov.ie', 'gv.at', 'admin.ch',
  'gov.pl', 'gov.cz', 'gov.sk', 'gov.hu', 'gov.ro', 'gov.bg', 'gov.gr', 'gov.cy', 'gov.mt', 'gov.si', 'gov.hr',
  'gov.rs', 'gov.ba', 'gov.mk', 'gov.al', 'gov.me', 'gov.md', 'gov.ua', 'gov.lv', 'gov.lt', 'gov.ee', 'gov.by',
  'gov.ru', 'gov.tr', 'gov.ge', 'gov.am', 'gov.az',
  'gc.ca', 'gob.mx', 'gob.ar', 'gob.cl', 'gob.pe', 'gov.co', 'gob.ec', 'gob.bo', 'gob.ve', 'gob.gt', 'gob.hn',
  'gob.sv', 'gob.ni', 'gob.pa', 'gob.do', 'gob.cu', 'gub.uy', 'gov.py', 'gov.br', 'gov.jm', 'gov.tt',
  'gov.au', 'govt.nz',
  'go.jp', 'go.kr', 'gov.cn', 'gov.hk', 'gov.tw', 'gov.mo', 'gov.sg', 'gov.my', 'go.th', 'gov.vn', 'gov.ph',
  'go.id', 'gov.kh', 'gov.mm', 'gov.in', 'nic.in', 'gov.pk', 'gov.bd', 'gov.lk', 'gov.np', 'gov.af', 'gov.ir',
  'gov.kz', 'gov.uz', 'gov.kg', 'gov.tj', 'gov.mn',
  'gov.il', 'gov.jo', 'gov.lb', 'gov.sy', 'gov.iq', 'gov.sa', 'gov.ae', 'gov.qa', 'gov.kw', 'gov.bh', 'gov.om',
  'gov.ye', 'gov.eg', 'gov.ma', 'gov.dz', 'gov.tn', 'gov.ly',
  'gov.za', 'gov.ng', 'gov.gh', 'go.ke', 'go.tz', 'go.ug', 'gov.rw', 'gov.et', 'gov.zm', 'gov.zw', 'gov.bw',
  'gov.na', 'gov.mz', 'gov.mw', 'gov.so', 'gov.sd', 'gov.ss', 'gov.lr', 'gov.sl', 'gov.gm',
  'gouv.sn', 'gouv.ci', 'gouv.ml', 'gouv.bf', 'gouv.ne', 'gouv.tg', 'gouv.bj', 'gouv.cm', 'gouv.cd', 'gouv.cg',
  'gouv.ga', 'gouv.gn', 'gouv.mr', 'gouv.td', 'gouv.ht', 'gouv.qc.ca', 'gouv.nc',
]

const AGENCIES = [
  // Nordic countries
  'migrationsverket.se', 'skatteverket.se', 'forsakringskassan.se', 'informationsverige.se',
  'arbetsformedlingen.se', 'csn.se', '1177.se', 'kronofogden.se', 'polisen.se', 'regeringen.se',
  'verksamt.se', 'krisinformation.se', 'pensionsmyndigheten.se', 'transportstyrelsen.se', 'uhr.se',
  'antagning.se', 'universityadmissions.se', 'studyinsweden.se',
  'udi.no', 'skatteetaten.no', 'nav.no', 'regjeringen.no', 'politiet.no', 'helsenorge.no', 'lanekassen.no',
  'borger.dk', 'nyidanmark.dk', 'skat.dk', 'sundhed.dk', 'politi.dk',
  'migri.fi', 'vero.fi', 'kela.fi', 'suomi.fi', 'poliisi.fi', 'infofinland.fi',
  'island.is', 'utl.is',
  // Western Europe
  'bamf.de', 'bund.de', 'bundesregierung.de', 'arbeitsagentur.de', 'elster.de', 'make-it-in-germany.com',
  'auswaertiges-amt.de', 'bzst.de', 'deutsche-rentenversicherung.de', 'berlin.de', 'hamburg.de', 'muenchen.de',
  'ams.at', 'sozialversicherung.at',
  'ch.ch',
  'ind.nl', 'rijksoverheid.nl', 'government.nl', 'overheid.nl', 'belastingdienst.nl', 'duo.nl', 'svb.nl',
  'uwv.nl', 'netherlandsworldwide.nl',
  'belgium.be', 'ibz.be', 'socialsecurity.be',
  'public.lu', 'guichet.lu',
  'service-public.fr', 'ameli.fr', 'caf.fr', 'france-travail.fr', 'campusfrance.org', 'ofii.fr', 'urssaf.fr',
  'citizensinformation.ie', 'revenue.ie', 'irishimmigration.ie', 'hse.ie', 'welfare.ie',
  'nhs.uk',
  // Southern and Eastern Europe
  'agenciatributaria.es', 'seg-social.es', 'sepe.es',
  'seg-social.pt',
  'inps.it', 'poliziadistato.it', 'governo.it', 'esteri.it',
  'zus.pl',
  'gosuslugi.ru',
  // The Americas
  'canada.ca', 'ontario.ca', 'quebec.ca', 'alberta.ca', 'gov.bc.ca', 'manitoba.ca', 'novascotia.ca',
  // Asia and the Middle East
  'nic.in', 'u.ae',
  // International
  'europa.eu', 'unhcr.org',
  // Big cities, which run many services for newcomers (language courses, schools)
  'stockholm.se', 'goteborg.se', 'malmo.se', 'uppsala.se', 'linkoping.se', 'orebro.se', 'vasteras.se',
  'helsingborg.se', 'norrkoping.se', 'jonkoping.se', 'umea.se', 'lund.se',
  'oslo.kommune.no', 'bergen.kommune.no', 'kk.dk', 'aarhus.dk', 'hel.fi', 'espoo.fi', 'vantaa.fi',
  'amsterdam.nl', 'rotterdam.nl', 'denhaag.nl', 'utrecht.nl', 'paris.fr', 'lyon.fr', 'marseille.fr',
  'koeln.de', 'frankfurt.de', 'stuttgart.de', 'wien.gv.at', 'zurich.ch', 'stadt-zuerich.ch',
  'nyc.gov', 'toronto.ca', 'montreal.ca', 'vancouver.ca',
]

// Well-known non-profits that help newcomers. Only used by the moving guide.
const HELPERS = [
  'unhcr.org', 'iom.int', 'redcross.org', 'ifrc.org', 'icrc.org', 'redcross.org.uk', 'redcross.ca',
  'rodakorset.se', 'drk.de', 'croix-rouge.fr', 'rodekors.no', 'rodekors.dk', 'punainenristi.fi',
  'rodekruis.nl', 'cruzroja.es', 'cri.it', 'redcross.ie', 'rescue.org', 'nrc.no', 'caritas.org',
  'savethechildren.org',
]

export function hostOf(address) {
  try {
    return new URL(address.includes('://') ? address : `https://${address}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

const within = (host, domain) => host === domain || host.endsWith(`.${domain}`)

export function isOfficialDomain(address) {
  const host = hostOf(address)
  if (!host || !host.includes('.')) return false
  if (host.endsWith('.gov') || host.endsWith('.int')) return true
  if (GOV_ZONES.some((zone) => within(host, zone))) return true
  return AGENCIES.some((domain) => within(host, domain))
}

// Official sites, or a well-known non-profit that helps newcomers.
export function isHelpDomain(address) {
  const host = hostOf(address)
  return isOfficialDomain(host) || HELPERS.some((domain) => within(host, domain))
}
