import json
import re
import sys
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6}
SHIFT_SHEETS = {"I növbə": 1, "II növbə": 2}
DAY_RE = re.compile(r"^(I|II|III|IV|V) gün$")
LESSON_RE = re.compile(r"^(I|II|III|IV|V|VI) dərs$")
TIME_RE = re.compile(r"^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$")
PLACEHOLDER_RE = re.compile(r"^X+$", re.IGNORECASE)


def text(value):
    if value is None:
        return None
    s = re.sub(r"\s+", " ", str(value)).strip()
    return s or None


def is_pending(subject):
    parts = [p.strip() for p in subject.split("/")]
    return all(PLACEHOLDER_RE.match(p) for p in parts if p) and any(parts)


def pad(t):
    h, m = t.split(":")
    return f"{int(h):02d}:{m}"


def parse_sheet(ws, shift, report):
    header_row = None
    for r in range(1, 30):
        if text(ws.cell(r, 1).value) == "İxtisas" and text(ws.cell(r, 4).value) == "Dərs":
            header_row = r
            break
    if header_row is None:
        raise SystemExit(f"'{ws.title}': başlıq sətri tapılmadı")
    days = {}
    for c in range(1, ws.max_column + 1):
        m = DAY_RE.match(text(ws.cell(header_row, c).value) or "")
        if m:
            days[ROMAN[m.group(1)]] = c
    if sorted(days) != [1, 2, 3, 4, 5]:
        raise SystemExit(f"'{ws.title}': gün sütunları tam deyil: {sorted(days)}")
    groups = {}
    lessons = []
    for r in range(header_row + 2, ws.max_row + 1):
        spec, group, course, lesson_label, slot = (text(ws.cell(r, c).value) for c in range(1, 6))
        if not spec:
            continue
        if not (group and course and lesson_label and slot):
            raise SystemExit(f"'{ws.title}' sətir {r}: ixtisas/qrup/kurs/dərs/saat natamamdır")
        lm = LESSON_RE.match(lesson_label)
        tm = TIME_RE.match(slot)
        if not lm or not tm:
            raise SystemExit(f"'{ws.title}' sətir {r}: dərs və ya saat formatı tanınmadı: {lesson_label!r}, {slot!r}")
        info = {"code": group, "specialty": spec, "course": course, "shift": shift}
        if group in groups and groups[group] != info:
            raise SystemExit(f"'{ws.title}' sətir {r}: {group} qrupunun ixtisas/kurs məlumatı ziddiyyətlidir")
        groups[group] = info
        for day, col in days.items():
            subject = text(ws.cell(r, col).value)
            teacher = text(ws.cell(r, col + 1).value)
            room = text(ws.cell(r, col + 2).value)
            if not subject:
                if teacher or room:
                    report["orphan_cells"].append(f"{ws.title}!R{r} {group} gün {day}: fənn boşdur, müəllim={teacher!r}, otaq={room!r}")
                report["empty_slots"] += 1
                continue
            lessons.append({
                "group": group,
                "day": day,
                "lesson": ROMAN[lm.group(1)],
                "start": pad(tm.group(1)),
                "end": pad(tm.group(2)),
                "subject": subject,
                "teacher": teacher,
                "room": room,
                "pending": is_pending(subject),
            })
    return groups, lessons



def group_seed_sql(groups):
    """Supabase `public.groups` cədvəlini cədvəl məlumatı ilə sinxronlaşdıran təkrar işlədilə bilən SQL.
    Köhnə qruplar silinmir (profillər onlara istinad edə bilər), yalnız active=false olur."""
    values = ",\n".join(f"  ('{g['code']}', '{g['specialty']}')" for g in groups)
    codes = ", ".join(f"'{g['code']}'" for g in groups)
    return (
        "-- Avtomatik yaradılıb: scripts/import-timetable.py. Əl ilə dəyişməyin.\n"
        "-- Supabase SQL Editor-də işə salın; təkrar işlətmək təhlükəsizdir.\n"
        "insert into public.groups (code, specialty, active) \nselect v.code, v.specialty, true from (values\n"
        f"{values}\n) as v (code, specialty)\n"
        "on conflict (code) do update set specialty = excluded.specialty, active = true;\n\n"
        f"update public.groups set active = false where code not in ({codes});\n"
    )


def main():
    if len(sys.argv) < 2:
        raise SystemExit("İstifadə: python3 scripts/import-timetable.py <cədvəl.xlsx> [tədris ili] [semestr]")
    src = Path(sys.argv[1])
    academic_year = sys.argv[2] if len(sys.argv) > 2 else "2026/2027"
    semester = sys.argv[3] if len(sys.argv) > 3 else "payız"
    wb = load_workbook(src, data_only=True)
    report = {"orphan_cells": [], "empty_slots": 0}
    all_groups, all_lessons = {}, []
    for ws in wb.worksheets:
        shift = SHIFT_SHEETS.get(ws.title.strip())
        if shift is None:
            raise SystemExit(f"Naməlum vərəq adı: {ws.title!r}")
        g, l = parse_sheet(ws, shift, report)
        dup = set(all_groups) & set(g)
        if dup:
            raise SystemExit(f"Qrup hər iki növbədə var: {sorted(dup)}")
        all_groups.update(g)
        all_lessons.extend(l)
    keys = Counter((x["group"], x["day"], x["lesson"]) for x in all_lessons)
    clash = [k for k, n in keys.items() if n > 1]
    if clash:
        raise SystemExit(f"Təkrarlanan dərs yerləri: {clash}")
    names = json.loads((ROOT / "scripts" / "specialty-names.json").read_text(encoding="utf-8"))
    order = []
    for g in all_groups.values():
        if g["specialty"] not in order:
            order.append(g["specialty"])
    specialties = [{"code": c, **({"name": names[c]} if c in names else {})} for c in order]
    groups_out = sorted(all_groups.values(), key=lambda g: (order.index(g["specialty"]), g["code"]))
    lessons_out = sorted(all_lessons, key=lambda x: (x["group"], x["day"], x["lesson"]))
    data = {
        "meta": {"academicYear": academic_year, "semester": semester, "source": src.name},
        "specialties": specialties,
        "groups": groups_out,
        "lessons": lessons_out,
    }
    out = ROOT / "src" / "data" / "timetable.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    seed = ROOT / "supabase" / "seed" / "groups.sql"
    seed.parent.mkdir(parents=True, exist_ok=True)
    seed.write_text(group_seed_sql(groups_out), encoding="utf-8")

    pending = sum(1 for x in lessons_out if x["pending"])
    print(f"ixtisas: {len(specialties)}, qrup: {len(groups_out)}, dərs: {len(lessons_out)} (təyin olunmamış 'XXX': {pending})")
    print(f"boş xanalar: {report['empty_slots']}")
    for line in report["orphan_cells"]:
        print("DİQQƏT:", line)


main()
