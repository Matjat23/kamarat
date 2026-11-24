// Is this web address an official public website? Kamarat only shows links that
// pass this check, wherever they came from.
//
// 1. Government domain patterns used around the world: .gov, gov.uk, gouv.fr,
//    gob.es, go.jp, gv.at, govt.nz, admin.ch, and so on.
// 2. International public bodies: the EU (europa.eu) and .int (for example
//    the UN migration agency, iom.int).
// 3. Agencies in countries where the government does not use such a pattern,
//    for example Sweden's migrationsverket.se. These were added by hand.

const PATTERN = /(^|\.)(gov|gouv|gob|go|gv|govt|gub|gc|admin|gouvernement|government)\.[a-z]{2}$/

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
]

export function hostOf(address) {
  try {
    return new URL(address.includes('://') ? address : `https://${address}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function isOfficialDomain(address) {
  const host = hostOf(address)
  if (!host || !host.includes('.')) return false
  if (host.endsWith('.gov') || host.endsWith('.int') || host === 'gov.uk') return true
  if (PATTERN.test(host)) return true
  return AGENCIES.some((domain) => host === domain || host.endsWith(`.${domain}`))
}
