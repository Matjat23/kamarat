"""Make fake official notices for testing Kamarat's privacy check.

Every notice is made up, and for each one we know exactly which personal
details it contains. tools/score.py compares that list with what Kamarat found.

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

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(notices, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(len(n["details"]) for n in notices)
    print(f"Wrote {len(notices)} made-up notices with {total} personal details to {out}")


if __name__ == "__main__":
    main()
