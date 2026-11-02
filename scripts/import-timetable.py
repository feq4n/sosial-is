"""Rəsmi dərs cədvəli Excel faylını src/data/timetable.json və supabase/seed/groups.sql faylına çevirir.

Mənbə format (ADPK_ders_cedveli_*.xlsx): «Hamısı» vərəqi, hər sətir bir dərs:
  Qrup | Gün | Dərs № | Başlama | Bitmə | Həftə | Yarımqrup | Fənn | Növ | Müəllim | Otaq
Qrup üzrə vərəqlər və «Müəllimlər» vərəqi yalnız oxunaqlı görünüşdür, oxunmur.

İkinci dəstəklənən format: şöbənin çap üçün hazırladığı geniş cədvəl («ÜMUMİ» vərəqi; sətir = qrup və dərs yeri,
sütunlar = I–V gün × Fənn/Müəllim/otaq). Bu formatda dərs növü (mühazirə/seminar/praktika) yoxdur, ona görə kind=null
yazılır və saytda göstərilmir; “ÜST/ALT” həftəni, bir xanada iki müəllim adı isə 1-ci/2-ci yarımqrupu bildirir.

Qaydalar:
- Heç nə uydurulmur: boş xanalar boş qalır, “XXX” qeydləri pending=true ilə saxlanılır.
- İxtisas qrup kodunun prefiksindən (Sİ / KŞATS / KŞŞİ), növbə isə dərsin saatından təyin edilir.
- Eyni qrupun eyni gün/dərs/həftə/yarımqrup yerində iki dərs olması, həmçinin eyni vaxtda müəllim və ya otaq
  toqquşması xəta deyil, DİQQƏT kimi çap olunur: mənbə olduğu kimi köçürülür, düzəliş cədvəl tərtib edənindir.
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
SHEET = "Hamısı"
COLUMNS = ["Qrup", "Gün", "Dərs №", "Başlama", "Bitmə", "Həftə", "Yarımqrup", "Fənn", "Növ", "Müəllim", "Otaq"]
DAYS = {"Bazar ertəsi": 1, "Çərşənbə axşamı": 2, "Çərşənbə": 3, "Cümə axşamı": 4, "Cümə": 5}
WEEKS = {"Hər həftə": "all", "Üst həftə": "upper", "Alt həftə": "lower"}
WEEK_ORDER = {"all": 0, "upper": 1, "lower": 2}
SUBGROUPS = {"Hamısı": None, "1-ci": 1, "2-ci": 2}
KINDS = {"Mühazirə", "Seminar", "Praktika"}
# (dərs №, başlama, bitmə) -> növbə; dərs saatları rəsmi zəng cədvəlidir
SLOTS = {
    (1, "09:00", "10:20"): 1, (2, "10:30", "11:50"): 1, (3, "12:00", "13:20"): 1, (4, "13:30", "14:50"): 1,
    (1, "13:30", "14:50"): 2, (2, "15:00", "16:20"): 2, (3, "16:30", "17:50"): 2,
}
GROUP_RE = re.compile(r"^(KŞATS|KŞŞİ|Sİ)\d{2}/\d{2}SB$")
# Saytda əvvəldən göstərilən ixtisas sırası (dəyişdirilmir); yeni kod olsa sona əlavə olunur.
SPECIALTY_ORDER = ["KŞATS", "KŞŞİ", "Sİ"]
PLACEHOLDER_RE = re.compile(r"^X+$", re.IGNORECASE)
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


def text(value):
    if value is None:
        return None
    s = re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(value))).strip()
    return s or None


def is_pending(subject):
    parts = [p.strip() for p in subject.split("/")]
    return all(PLACEHOLDER_RE.match(p) for p in parts if p) and any(parts)


def hhmm(value, where):
    m = TIME_RE.match(text(value) or "")
    if not m:
        raise SystemExit(f"{where}: saat formatı tanınmadı: {value!r}")
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def read_rows(ws):
    header = [text(ws.cell(1, c).value) for c in range(1, len(COLUMNS) + 1)]
    if header != COLUMNS:
        raise SystemExit(f"'{ws.title}' başlıqları gözlənilənlə üst-üstə düşmür.\n  tapıldı:  {header}\n  gözlənən: {COLUMNS}")
    for r in range(2, ws.max_row + 1):
        cells = [ws.cell(r, c).value for c in range(1, len(COLUMNS) + 1)]
        if all(text(c) is None for c in cells):
            continue
        yield r, [text(c) for c in cells]


def parse(ws):
    lessons = []
    for r, (group, day, no, start, end, week, sub, subject, kind, teacher, room) in read_rows(ws):
        where = f"'{ws.title}' sətir {r}"
        if not group or not GROUP_RE.match(group):
            raise SystemExit(f"{where}: qrup kodu tanınmadı: {group!r}")
        if day not in DAYS:
            raise SystemExit(f"{where}: gün tanınmadı: {day!r}")
        if week not in WEEKS:
            raise SystemExit(f"{where}: həftə tanınmadı: {week!r}")
        if sub not in SUBGROUPS:
            raise SystemExit(f"{where}: yarımqrup tanınmadı: {sub!r}")
        if kind not in KINDS:
            raise SystemExit(f"{where}: dərs növü tanınmadı: {kind!r}")
        if not subject:
            raise SystemExit(f"{where}: fənn boşdur")
        try:
            lesson_no = int(no)
        except (TypeError, ValueError):
            raise SystemExit(f"{where}: dərs № rəqəm deyil: {no!r}")
        s, e = hhmm(start, where), hhmm(end, where)
        if (lesson_no, s, e) not in SLOTS:
            raise SystemExit(f"{where}: dərs {lesson_no} üçün {s}–{e} rəsmi zəng cədvəlində yoxdur")
        lessons.append({
            "group": group,
            "day": DAYS[day],
            "lesson": lesson_no,
            "start": s,
            "end": e,
            "week": WEEKS[week],
            "subgroup": SUBGROUPS[sub],
            "subject": subject,
            "kind": kind,
            "teacher": teacher,
            "room": room,
            "pending": is_pending(subject),
        })
    return lessons


GRID_SHEET = "ÜMUMİ"
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4}
FIRST_DAY_COL, GRID_FIRST_ROW = 6, 10
GRID_TIME_RE = re.compile(r"(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})")
WEEK_MARK_RE = re.compile(r"\b(ÜST|ALT)\b")
# Mənbədəki aşkar yazılış səhvləri. Yalnız burada sadalananlar düzəldilir; hər düzəliş çap olunur.
SUBJECT_FIXES = {
    "Phyton proqramlaşdırma dili": "Python proqramlaşdırma dili",
    "Sosial iş təcübəsində etik prinsiplər": "Sosial iş təcrübəsində etik prinsiplər",
    "İnformasiya texonologiyaları": "İnformasiya texnologiyaları",
    "Kompüter arxiyekturası": "Kompüter arxitekturası",
    "Kompüterin arxitekturası": "Kompüter arxitekturası",
    "Kompüterlərin arxitekturası": "Kompüter arxitekturası",
    "Fizili tərbiyə": "Fiziki tərbiyə",
}
TEACHER_FIXES = {
    "Xatirə Xəlilli": "Xatirə Xəlilova",
    "Nazilə Qəhrəmaniva": "Nazilə Qəhrəmanova",
    "Murad MƏmmədli": "Murad Məmmədli",
    "Dürdanə Əlbabayeva": "Dürdanə Əlibabayeva",
    "Gülər Rüsməmova": "Gülər Rüstəmova",
    "Aida Zamanova": "Aidə Zamanova",
}
APPLIED_FIXES = Counter()
GRID_NOTES = []


def week_segments(raw, where):
    """“ÜST X ALT Y” kimi xananı [(həftə, mətn)] siyahısına ayırır; işarə yoxdursa [('all', mətn)]."""
    raw = unicodedata.normalize("NFC", str(raw)).strip()
    if not WEEK_MARK_RE.search(raw):
        return [("all", raw)]
    parts = WEEK_MARK_RE.split(raw)
    if parts[0].strip():
        raise SystemExit(f"{where}: ÜST/ALT işarəsindən əvvəl mətn var: {raw!r}")
    out = []
    for mark, body in zip(parts[1::2], parts[2::2]):
        out.append(("upper" if mark == "ÜST" else "lower", body.strip()))
    if len({w for w, _ in out}) != len(out):
        raise SystemExit(f"{where}: eyni həftə iki dəfə yazılıb: {raw!r}")
    return out


def split_teachers(body, where):
    """Bir xanada iki ad (çox boşluqla və ya 2+2 sözlə) = 1-ci və 2-ci yarımqrup müəllimi."""
    parts = [p for p in re.split(r"\s{2,}", body.strip()) if p]
    if len(parts) == 1:
        toks = parts[0].split()
        if len(toks) == 4:
            parts = [" ".join(toks[:2]), " ".join(toks[2:])]
    names = [text(p) for p in parts]
    if len(names) > 2:
        raise SystemExit(f"{where}: ikidən çox müəllim adı: {body!r}")
    return names


def fix(value, table):
    if value in table:
        APPLIED_FIXES[(value, table[value])] += 1
        return table[value]
    return value


def clean_room(value):
    r = text(value)
    if r and "\\" in r:
        APPLIED_FIXES[(r, r.replace("\\", ""))] += 1
        r = r.replace("\\", "")
    return r


def parse_grid(ws):
    lessons = []
    r = GRID_FIRST_ROW
    while r <= ws.max_row:
        group = text(ws.cell(r, 2).value)
        if not group or not GROUP_RE.match(group):
            break
        lesson_no = ROMAN.get(text(ws.cell(r, 4).value) or "")
        m = GRID_TIME_RE.search(text(ws.cell(r, 5).value) or "")
        where = f"'{ws.title}' sətir {r} ({group})"
        if not lesson_no or not m:
            raise SystemExit(f"{where}: dərs № və ya saat tanınmadı")
        s, e = f"{int(m[1]):02d}:{m[2]}", f"{int(m[3]):02d}:{m[4]}"
        if (lesson_no, s, e) not in SLOTS:
            raise SystemExit(f"{where}: dərs {lesson_no} üçün {s}–{e} rəsmi zəng cədvəlində yoxdur")
        for day in range(1, 6):
            c = FIRST_DAY_COL + (day - 1) * 3
            subj_raw, teach_raw, room_raw = (ws.cell(r, c + i).value for i in range(3))
            cell = f"{where}, gün {day}"
            if text(subj_raw) is None:
                if text(teach_raw) or text(room_raw):
                    raise SystemExit(f"{cell}: fənn boşdur, amma müəllim/otaq yazılıb")
                continue
            if text(teach_raw) is None:
                raise SystemExit(f"{cell}: müəllim boşdur: {subj_raw!r}")
            subj = week_segments(subj_raw, cell)
            teach = dict(week_segments(teach_raw, cell))
            if set(teach) == {"all"} and len(subj) == 1 and subj[0][0] != "all":
                # Fənn xanasında ÜST/ALT var, müəllim xanasında yoxdur: müəllim həmin həftəyə aid sayılır.
                GRID_NOTES.append(f"{cell}: yalnız fənn xanasında {subj[0][0] == 'upper' and 'ÜST' or 'ALT'} yazılıb, müəllim ({teach['all']}) həmin həftəyə aid sayıldı")
                teach = {subj[0][0]: teach["all"]}
            if {w for w, _ in subj} != set(teach):
                raise SystemExit(f"{cell}: fənn və müəllim xanalarında ÜST/ALT uyğun deyil: {subj_raw!r} / {teach_raw!r}")
            room = clean_room(room_raw)
            for week, subject_raw in subj:
                subject = fix(text(subject_raw), SUBJECT_FIXES)
                names = [fix(n, TEACHER_FIXES) for n in split_teachers(teach[week], cell)]
                for i, name in enumerate(names):
                    lessons.append({
                        "group": group, "day": day, "lesson": lesson_no, "start": s, "end": e,
                        "week": week, "subgroup": (i + 1) if len(names) == 2 else None,
                        "subject": subject, "kind": None, "teacher": name, "room": room,
                        "pending": is_pending(subject),
                    })
        r += 1
    return lessons


def clash_warnings(lessons):
    """Mənbədəki ehtimal olunan ziddiyyətləri çap üçün toplayır (məlumat dəyişdirilmir)."""
    out = []
    key = lambda x: (x["group"], x["day"], x["lesson"], x["week"], x["subgroup"])
    for k, n in Counter(key(x) for x in lessons).items():
        if n > 1:
            subs = [f"{x['subject']} ({x['kind']}, {x['teacher']}, otaq {x['room']})" for x in lessons if key(x) == k]
            out.append(f"{k[0]}, gün {k[1]}, dərs {k[2]}: eyni yerdə {n} dərs yazılıb: " + " | ".join(subs))
    by_slot = defaultdict(list)
    for x in lessons:
        by_slot[(x["day"], x["lesson"], x["start"])].append(x)
    for (day, no, _), items in sorted(by_slot.items()):
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if a["group"] == b["group"]:
                    continue
                if "all" not in (a["week"], b["week"]) and a["week"] != b["week"]:
                    continue
                same = (a["subject"], a["teacher"], a["kind"]) == (b["subject"], b["teacher"], b["kind"])
                if a["teacher"] and a["teacher"] == b["teacher"] and not same:
                    out.append(f"müəllim toqquşması: {a['teacher']} gün {day}, dərs {no}: {a['group']} və {b['group']}")
                if a["room"] and a["room"] == b["room"] and a["room"] != "OZ" and not same:
                    out.append(f"otaq toqquşması: otaq {a['room']} gün {day}, dərs {no}: {a['group']} və {b['group']}")
    return out


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
    if SHEET in wb.sheetnames:
        lessons = parse(wb[SHEET])
    elif GRID_SHEET in wb.sheetnames:
        lessons = parse_grid(wb[GRID_SHEET])
    else:
        raise SystemExit(f"'{SHEET}' və ya '{GRID_SHEET}' vərəqi tapılmadı. Mövcud vərəqlər: {wb.sheetnames[:5]}…")

    shifts = defaultdict(set)
    for x in lessons:
        shifts[x["group"]].add(SLOTS[(x["lesson"], x["start"], x["end"])])
    bad = {g: sorted(s) for g, s in shifts.items() if len(s) != 1}
    if bad:
        raise SystemExit(f"Qrup həm I, həm II növbənin dərs saatlarına malikdir: {bad}")
    specialty_of = lambda code: GROUP_RE.match(code).group(1)
    present = {specialty_of(c) for c in shifts}
    order = [s for s in SPECIALTY_ORDER if s in present] + sorted(present - set(SPECIALTY_ORDER))
    groups_out = sorted(
        ({"code": c, "specialty": specialty_of(c), "shift": next(iter(s))} for c, s in shifts.items()),
        key=lambda g: (order.index(g["specialty"]), g["code"]),
    )
    lessons_out = sorted(lessons, key=lambda x: (x["group"], x["day"], x["lesson"], WEEK_ORDER[x["week"]], x["subgroup"] or 0))
    names = json.loads((ROOT / "scripts" / "specialty-names.json").read_text(encoding="utf-8"))
    specialties = [{"code": c, **({"name": names[c]} if c in names else {})} for c in order]
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
    by_week = Counter(x["week"] for x in lessons_out)
    by_kind = Counter(x["kind"] for x in lessons_out)
    print(f"ixtisas: {len(specialties)}, qrup: {len(groups_out)}, dərs: {len(lessons_out)} (təyin olunmamış 'XXX': {pending})")
    print(f"həftə: {dict(by_week)}; növ: {dict(by_kind)}; yarımqrup sətirləri: {sum(1 for x in lessons_out if x['subgroup'])}")
    for (old, new), n in sorted(APPLIED_FIXES.items()):
        print(f"DÜZƏLİŞ: {old!r} -> {new!r} ({n}×)")
    for line in GRID_NOTES:
        print("QEYD:", line)
    for line in clash_warnings(lessons_out):
        print("DİQQƏT:", line)


main()
