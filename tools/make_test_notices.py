"""Make fake official notices for testing Kamarat's privacy check.

Every notice is made up, and for each one we know exactly which personal
details it contains. tools/score.py checks that none of them is left in the
text Kamarat would send.

Most notices come from four templates with random people. A few are written by
hand with other layouts (names inside sentences, titles, capitals, addresses on
one line, a letter with no personal details) so the test is not only the
templates.

Usage:
    python tools/make_test_notices.py            # writes public/eval/notices.json
    python tools/make_test_notices.py --count 40 --seed 7
"""

import argparse
import json
import random
from pathlib import Path

FIRST = ["Amina", "Lucas", "Fatou", "Omar", "Elin", "Mateo", "Sara", "Yusuf", "Leila", "Jonas",
         "Awa", "Karim", "Ingrid", "Daniel", "Mariam", "Nils", "Aisha", "Pierre", "Hana", "Tomas"]
LAST = ["Okafor", "Ferreira", "Diallo", "Haddad", "Lindqvist", "Garcia", "Nilsson", "Kaya",
        "Rahimi", "Berg", "Ndiaye", "Mansour", "Johansson", "Silva", "Ahmed", "Dubois", "Sato"]
SE_STREETS = ["Storgatan", "Kungsgatan", "Vasagatan", "Linnégatan", "Ringvägen", "Skolgatan"]
SE_CITIES = [("413 01", "Göteborg"), ("111 22", "Stockholm"), ("211 45", "Malmö"), ("753 20", "Uppsala")]
US_STREETS = ["Oak Ridge Drive", "Maple Avenue", "Lakeview Road", "University Blvd"]
US_CITIES = [("Gainesville, FL", "32601"), ("Austin, TX", "78705"), ("Madison, WI", "53703")]
FR_STREETS = ["rue de la République", "avenue Jean Jaurès", "rue Victor Hugo"]
FR_CITIES = [("69002", "Lyon"), ("31000", "Toulouse"), ("13001", "Marseille")]


def name(rng):
    return f"{rng.choice(FIRST)} {rng.choice(LAST)}"


def personnummer(rng):
    year = rng.randint(1975, 2005)
    return f"{year}{rng.randint(1, 12):02d}{rng.randint(1, 28):02d}-{rng.randint(1000, 9999)}"


def se_phone(rng):
    return f"0{rng.choice(['10', '31', '8', '70', '73'])}-{rng.randint(100, 999)} {rng.randint(10, 99)} {rng.randint(10, 99)}"


def email_for(person, domain):
    first, last = person.lower().split()
    return f"{first}.{last}@{domain}"


def swedish_migration(rng):
    person, officer = name(rng), name(rng)
    street = f"{rng.choice(SE_STREETS)} {rng.randint(1, 60)}{rng.choice(['', 'A', 'B'])}"
    post, city = rng.choice(SE_CITIES)
    case = f"{rng.randint(2025, 2026)}-{rng.randint(10000, 99999)}-{rng.randint(10, 99)}"
    pnr, phone = personnummer(rng), se_phone(rng)
    mail = email_for(officer, "example.se")
    days = rng.choice([14, 21, 30])
    text = f"""Migrationsverket

{city} 2026-11-{rng.randint(10, 28)}

{person}
{street}
{post} {city}

Ärendenummer: {case}
Personnummer: {pnr}

Begäran om komplettering

Hej {person},

Vi har tagit emot din ansökan om förlängning av uppehållstillstånd för arbete. Vi behöver ett nytt anställningsavtal och dina tre senaste lönebesked.

Skicka in kompletteringen inom {days} dagar från att du har tagit emot detta brev.

Har du frågor? Kontakta din handläggare {officer} på {phone} eller {mail}.

Med vänlig hälsning
Migrationsverket"""
    details = [
        {"text": person, "type": "NAME"}, {"text": officer, "type": "NAME"},
        {"text": f"{street}, {post} {city}", "type": "ADDRESS"}, {"text": case, "type": "CASE"},
        {"text": pnr, "type": "ID"}, {"text": phone, "type": "PHONE"}, {"text": mail, "type": "EMAIL"},
    ]
    return "se-migration", text, details


def swedish_tax(rng):
    person = name(rng)
    street = f"{rng.choice(SE_STREETS)} {rng.randint(1, 60)}"
    post, city = rng.choice(SE_CITIES)
    pnr = personnummer(rng)
    ref = f"{rng.randint(100, 999)}-{rng.randint(1000, 9999)}"
    amount = rng.choice(["1 250", "3 480", "12 900"])
    text = f"""Skatteverket

Beslut om kvarskatt

{person}
{street}
{post} {city}

Personnummer: {pnr}
Diarienummer: {ref}

Du har fått ett beslut om slutlig skatt. Du ska betala {amount} kr senast den 12 mars 2027.

Om du inte betalar i tid kan skulden lämnas till Kronofogden.

Du kan begära omprövning inom fem år efter beskattningsåret."""
    details = [
        {"text": person, "type": "NAME"}, {"text": f"{street}, {post} {city}", "type": "ADDRESS"},
        {"text": pnr, "type": "ID"}, {"text": ref, "type": "CASE"},
    ]
    return "se-tax", text, details


def us_university(rng):
    person, advisor = name(rng), name(rng)
    street = f"{rng.randint(100, 9999)} {rng.choice(US_STREETS)}, Apt {rng.randint(1, 30)}"
    city, zip_code = rng.choice(US_CITIES)
    sevis = f"N{rng.randint(10**9, 10**10 - 1)}"
    student = str(rng.randint(10**7, 10**8 - 1))
    phone = f"({rng.randint(200, 989)}) 555-{rng.randint(1000, 9999)}"
    mail = email_for(advisor, "example.edu").replace(" ", "")
    text = f"""Example State University
International Student and Scholar Services

November {rng.randint(2, 28)}, 2026

{person}
{street}
{city} {zip_code}

SEVIS ID: {sevis}
Student ID: {student}

Dear {person},

Your I-20 program end date is December {rng.randint(10, 20)}, 2026. Please upload your updated financial documents within 10 business days of this notice.

If you have questions, contact your advisor {advisor} at {phone} or {mail}.

Sincerely,
International Student and Scholar Services"""
    details = [
        {"text": person, "type": "NAME"}, {"text": advisor, "type": "NAME"},
        {"text": f"{street}, {city} {zip_code}", "type": "ADDRESS"},
        {"text": sevis, "type": "ID"}, {"text": student, "type": "ID"},
        {"text": phone, "type": "PHONE"}, {"text": mail, "type": "EMAIL"},
    ]
    return "us-university", text, details


def french_prefecture(rng):
    person = name(rng)
    street = f"{rng.randint(1, 120)} {rng.choice(FR_STREETS)}"
    post, city = rng.choice(FR_CITIES)
    dossier = f"{rng.randint(10, 99)}{rng.randint(10**6, 10**7 - 1)}"
    phone = f"0{rng.randint(1, 7)} {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}"
    text = f"""Préfecture du Rhône
Service des étrangers

{person}
{street}
{post} {city}

Numéro de dossier : {dossier}

Madame, Monsieur,

Votre demande de titre de séjour est incomplète. Merci de transmettre un justificatif de domicile de moins de trois mois avant le 15 janvier 2027.

Sans réponse de votre part, votre demande pourra être classée sans suite.

Pour toute question : {phone}."""
    details = [
        {"text": person, "type": "NAME"}, {"text": f"{street}, {post} {city}", "type": "ADDRESS"},
        {"text": dossier, "type": "CASE"}, {"text": phone, "type": "PHONE"},
    ]
    return "fr-prefecture", text, details


KINDS = [swedish_migration, swedish_tax, us_university, french_prefecture]

# Written by hand. Every person, number and address is made up.
HANDWRITTEN = [
    {
        "id": "hand-de-auslaenderbehoerde",
        "kind": "de-immigration",
        "text": """Landesamt für Einwanderung
Friedrich-Krause-Ufer 24, 13353 Berlin

Aktenzeichen: LEA-2026-448190

Sehr geehrte Frau Nguyen Thi Lan,

wohnhaft Hauptstraße 5, 10115 Berlin, Ihr Antrag auf Verlängerung der Aufenthaltserlaubnis ist bei uns eingegangen. Bitte reichen Sie bis zum 18. Dezember 2026 einen aktuellen Mietvertrag und Ihren Reisepass (Nr. C4H7K92LM) ein.

Bei Fragen erreichen Sie Herrn Becker unter 030 90269-4471.

Mit freundlichen Grüßen
Im Auftrag""",
        "details": [
            {"text": "LEA-2026-448190", "type": "CASE"},
            {"text": "Nguyen Thi Lan", "type": "NAME"},
            {"text": "Hauptstraße 5, 10115 Berlin", "type": "ADDRESS"},
            {"text": "C4H7K92LM", "type": "ID"},
            {"text": "Becker", "type": "NAME"},
            {"text": "030 90269-4471", "type": "PHONE"},
        ],
    },
    {
        "id": "hand-es-extranjeria",
        "kind": "es-immigration",
        "text": """Oficina de Extranjería de Valencia

Estimado Sr. Carlos Mendoza Ruiz:

Le informamos de que su cita para la toma de huellas (TIE) es el 9 de enero de 2027 a las 10:30. Debe traer su pasaporte y el resguardo de la tasa 790-012. Su NIE es Y7654321K.

Si no puede asistir, escriba a citas.valencia@example.es o llame al +34 612 345 678 antes del 5 de enero de 2027.

Atentamente,
Oficina de Extranjería""",
        "details": [
            {"text": "Carlos Mendoza Ruiz", "type": "NAME"},
            {"text": "Y7654321K", "type": "ID"},
            {"text": "citas.valencia@example.es", "type": "EMAIL"},
            {"text": "+34 612 345 678", "type": "PHONE"},
        ],
    },
    {
        "id": "hand-se-forsakringskassan",
        "kind": "se-benefits",
        "text": """Försäkringskassan

Hej Ahmed Yusuf Ali!

Vi har fått din ansökan om bostadsbidrag. Ditt personnummer 199003154321 är registrerat på adressen Bergsgatan 14 lgh 1102, 214 22 Malmö.

Vi behöver ditt hyresavtal senast den 4 januari 2027. Logga in på Mina sidor eller skicka det med post. Om vi inte får det kan vi inte betala ut bidraget.

Du kan nå mig, Karin Holm, på karin.holm@example.se.

Vänliga hälsningar
Försäkringskassan""",
        "details": [
            {"text": "Ahmed Yusuf Ali", "type": "NAME"},
            {"text": "199003154321", "type": "ID"},
            {"text": "Bergsgatan 14 lgh 1102, 214 22 Malmö", "type": "ADDRESS"},
            {"text": "Karin Holm", "type": "NAME"},
            {"text": "karin.holm@example.se", "type": "EMAIL"},
        ],
    },
    {
        "id": "hand-us-irs",
        "kind": "us-tax",
        "text": """Department of the Treasury
Internal Revenue Service

MARIA L. GONZALEZ
PO BOX 1123
TAMPA FL 33601

Taxpayer ID number: 912-78-4567
Notice date: November 17, 2026

We changed your 2025 Form 1040 to correct a math error. You owe $412.00. Pay by December 8, 2026 to avoid more interest. If you disagree, call us at 1-800-555-0148 within 60 days of the date of this notice.""",
        "details": [
            {"text": "MARIA L. GONZALEZ", "type": "NAME"},
            {"text": "PO BOX 1123, TAMPA FL 33601", "type": "ADDRESS"},
            {"text": "912-78-4567", "type": "ID"},
        ],
    },
    {
        "id": "hand-fr-caf",
        "kind": "fr-benefits",
        "text": """Caisse d'allocations familiales de la Haute-Garonne

M. Mamadou Diop
Appartement 12, 5 allée des Lilas, 31400 Toulouse

N° allocataire : 1234567

Monsieur,

Pour continuer à recevoir votre aide au logement, merci de déclarer vos ressources trimestrielles avant le 31 décembre 2026 sur caf.fr. Sans déclaration, le paiement sera suspendu.

Votre conseillère, Mme Sophie Laurent""",
        "details": [
            {"text": "Mamadou Diop", "type": "NAME"},
            {"text": "Appartement 12, 5 allée des Lilas, 31400 Toulouse", "type": "ADDRESS"},
            {"text": "1234567", "type": "ID"},
            {"text": "Sophie Laurent", "type": "NAME"},
        ],
    },
    {
        "id": "hand-se-general",
        "kind": "se-information",
        "text": """Skatteverket informerar

Nu kan du deklarera digitalt från den 17 mars 2027. Om du godkänner deklarationen senast den 2 maj 2027 kan du få pengar tillbaka före midsommar.

Du behöver inte göra något om uppgifterna stämmer. Läs mer på skatteverket.se.""",
        "details": [],
    },
]


def norm(text):
    return " ".join(text.lower().replace(",", " ").split())


def check(notices):
    ids = [n["id"] for n in notices]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise SystemExit(f"Duplicate notice ids: {', '.join(duplicates)}")
    for notice in notices:
        text = norm(notice["text"])
        for detail in notice["details"]:
            for piece in detail["text"].split(","):
                if norm(piece) not in text:
                    raise SystemExit(f"{notice['id']}: '{piece.strip()}' is not in the text")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--out", default="public/eval/notices.json")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    notices = []
    for i in range(args.count):
        kind, text, details = KINDS[i % len(KINDS)](rng)
        notices.append({"id": f"{kind}-{i + 1:02d}", "kind": kind, "text": text, "details": details})
    notices += HANDWRITTEN
    check(notices)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(notices, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(len(n["details"]) for n in notices)
    print(f"Wrote {len(notices)} made-up notices ({len(HANDWRITTEN)} written by hand) with {total} personal details to {out}")


if __name__ == "__main__":
    main()
