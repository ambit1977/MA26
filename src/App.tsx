import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Building2,
  ExternalLink,
  Home,
  Luggage,
  MapPin,
  NotebookPen,
  Plane,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Users,
  X,
  WifiOff,
  CalendarDays,
  BedDouble,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ElementType } from "react";
import { Button, Card, Pill, SectionTitle } from "./components/ui";
import {
  checklistItems,
  days,
  flights,
  noteSections,
  officialLinks,
  schedule,
  sessionDetails,
  todayCards,
  type DayKey,
} from "./data/trip";
import { attendeesFromRecords, defaultAttendeeText, filterAttendees, parseAttendees, type Attendee } from "./lib/attendees";
import { clearAttendeeDb, loadAttendeeDb, saveAttendeeDb, tryLoadLocalAttendeeJson } from "./lib/attendeeDb";
import { cn } from "./lib/classNames";
import { LS_KEYS, useStoredState } from "./lib/storage";

type TabKey = "home" | "schedule" | "flights" | "attendees" | "check" | "notes" | "links";
type Checks = Record<string, boolean>;
type Notes = Record<(typeof noteSections)[number]["key"], string>;

const emptyNotes = noteSections.reduce((acc, section) => ({ ...acc, [section.key]: "" }), {} as Notes);

function AppHero({ setTab }: { setTab: (tab: TabKey) => void }) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-soft">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,145,178,0.82),rgba(15,23,42,0.92)_48%,rgba(13,148,136,0.78))]" />
      <div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/15">
            <Star className="h-3.5 w-3.5" />
            Marketing Agenda Okinawa 2026
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal sm:text-5xl">
            WORK → FIELD STUDY → RESET → RETURN
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cyan-50/90">
            受付、公式プログラム、JUNGLIA視察、那覇での回復、帰京までをiPhoneで見やすくまとめた個人旅程PWA。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setTab("schedule")} className="bg-white text-slate-950 hover:bg-cyan-50">
              <CalendarDays className="h-4 w-4" />
              今日の日程
            </Button>
            <Button onClick={() => setTab("check")} variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15">
              <ClipboardCheck className="h-4 w-4" />
              出発前確認
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {days.map((day) => {
            const Icon = day.icon;
            return (
              <button
                key={day.key}
                onClick={() => setTab("schedule")}
                className="rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15"
              >
                <Icon className="mb-3 h-5 w-5 text-cyan-50" />
                <div className="text-sm font-black">{day.label}</div>
                <div className="text-xs text-cyan-50/80">{day.date}</div>
                <div className="mt-1 text-xs text-white/85">{day.theme}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HomeView({ setTab }: { setTab: (tab: TabKey) => void }) {
  return (
    <div className="space-y-5">
      <AppHero setTab={setTab} />
      <div className="grid gap-3 md:grid-cols-3">
        {todayCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="p-4">
              <Icon className="mb-3 h-6 w-6 text-teal-700" />
              <h3 className="font-black text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "全体スケジュール", tab: "schedule" as TabKey, icon: CalendarDays },
          { label: "フライト確認", tab: "flights" as TabKey, icon: Plane },
          { label: "参加者検索", tab: "attendees" as TabKey, icon: Users },
          { label: "メモを開く", tab: "notes" as TabKey, icon: NotebookPen },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => setTab(action.tab)}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left font-black text-slate-900 shadow-soft transition active:scale-[0.99]"
            >
              <Icon className="h-5 w-5 text-cyan-800" />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleView() {
  const [selectedDay, setSelectedDay] = useState<DayKey | "all">("day1");
  const [sessionQuery, setSessionQuery] = useState("");
  const visibleSessions = useMemo(() => {
    const query = sessionQuery.trim().toLocaleLowerCase("ja-JP");
    return sessionDetails.filter((session) => {
      const matchesDay = selectedDay === "all" || session.day === selectedDay;
      const haystack = [
        session.time,
        session.kind,
        session.title,
        session.subtitle,
        session.note,
        ...(session.speakers || []),
      ].join(" ").toLocaleLowerCase("ja-JP");
      return matchesDay && (!query || haystack.includes(query));
    });
  }, [selectedDay, sessionQuery]);

  return (
    <div className="space-y-5">
      <SectionTitle icon={CalendarDays} title="スケジュール" subtitle="横スクロールの全体表と、片手で追いやすい日別カードを切り替え。" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
        <Pill active={selectedDay === "all"} onClick={() => setSelectedDay("all")}>全体表</Pill>
        {days.map((day) => (
          <Pill key={day.key} active={selectedDay === day.key} onClick={() => setSelectedDay(day.key)}>
            {day.label} {day.date}
          </Pill>
        ))}
      </div>

      {selectedDay === "all" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-20 w-24 bg-slate-100 px-4 py-3 font-black">時間</th>
                  {days.map((day) => (
                    <th key={day.key} colSpan={2} className="border-l border-slate-200 px-4 py-3 text-center font-black">
                      {day.label}<span className="ml-2 text-xs font-bold text-slate-500">{day.date}</span>
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map((day) => (
                    <FragmentCells key={day.key} left="イベント内容" right="場所" />
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, index) => (
                  <tr key={row.time} className={index % 2 ? "bg-white" : "bg-slate-50/70"}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-black text-slate-950">{row.time}</td>
                    {days.map((day) => (
                      <FragmentCells key={`${row.time}-${day.key}`} left={row[day.key][0]} right={row[day.key][1]} body />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {schedule.map((row) => {
            const item = row[selectedDay];
            return (
              <motion.div key={row.time} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="grid grid-cols-[76px_1fr] gap-3 p-4">
                  <div className="flex items-start gap-1.5 pt-0.5 text-sm font-black text-slate-950">
                    <span>{row.time}</span>
                  </div>
                  <div>
                    <div className="font-black text-slate-950">{item[0]}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm leading-5 text-slate-600">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {item[1]}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-950">詳細セッション</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              公式スケジュールから拾った個別セッション、登壇者、レク情報。
            </p>
          </div>
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={sessionQuery}
              onChange={(event) => setSessionQuery(event.target.value)}
              placeholder="セッション・登壇者で検索"
              className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none ring-cyan-600 focus:ring-2"
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {visibleSessions.map((session, index) => (
            <div key={`${session.day}-${session.time}-${session.title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-800 ring-1 ring-cyan-100">
                      {days.find((day) => day.key === session.day)?.label}
                    </span>
                    <span className="text-sm font-black text-slate-700">{session.time}</span>
                    <span className="text-xs font-black text-slate-500">{session.kind}</span>
                  </div>
                  <h4 className="mt-3 font-black leading-6 text-slate-950">{session.title}</h4>
                  {session.subtitle && <p className="mt-1 text-sm leading-6 text-slate-600">{session.subtitle}</p>}
                </div>
              </div>
              {session.speakers && session.speakers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.speakers.map((speaker) => (
                    <span key={speaker} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                      {speaker}
                    </span>
                  ))}
                </div>
              )}
              {session.note && <p className="mt-3 rounded-xl bg-white p-3 text-xs font-bold leading-5 text-teal-800 ring-1 ring-teal-100">{session.note}</p>}
            </div>
          ))}
        </div>
        {visibleSessions.length === 0 && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">該当するセッションがありません。</div>
        )}
      </Card>
    </div>
  );
}

function FragmentCells({ left, right, body = false }: { left: string; right: string; body?: boolean }) {
  const Tag = body ? "td" : "th";
  return (
    <>
      <Tag className={cn("border-l border-slate-200 px-3 py-3 align-top", body ? "font-bold text-slate-800" : "text-xs font-black")}>{left}</Tag>
      <Tag className={cn("px-3 py-3 align-top", body ? "text-slate-600" : "text-xs font-black")}>{right}</Tag>
    </>
  );
}

function FlightsView() {
  return (
    <div className="space-y-5">
      <SectionTitle icon={Plane} title="フライト" subtitle="Peach確定便と、受付・帰路の注意点をカードで確認。" />
      <div className="grid gap-4 md:grid-cols-2">
        {flights.map((flight) => (
          <Card key={flight.type} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black tracking-wider text-cyan-800">{flight.type}</div>
                <h3 className="mt-1 text-xl font-black text-slate-950">{flight.flight}</h3>
                <p className="mt-1 text-sm text-slate-600">{flight.route}｜{flight.date}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">確認 {flight.code}</div>
            </div>
            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <AirportTime code={flight.from} time={flight.depart} />
              <div className="text-center text-xs font-bold text-slate-500">
                <div className="h-px w-14 bg-slate-300 sm:w-20" />
                <div className="my-1">{flight.duration}</div>
                <div className="h-px w-14 bg-slate-300 sm:w-20" />
              </div>
              <AirportTime code={flight.to} time={flight.arrive} align="right" />
            </div>
            <p className="mt-5 rounded-2xl bg-cyan-50 p-4 text-sm leading-6 text-slate-700">{flight.note}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MiniInfo icon={Luggage} title="荷物" text="6/5の荷物取り扱いと、JUNGLIA用の服装を前日までに確認。" />
        <MiniInfo icon={MapPin} title="会場" text="Day1は12:30受付開始。13:10までの受付完了を優先。" />
        <MiniInfo icon={BedDouble} title="6/5夜" text="那覇空港19:00着を前提に、宿泊・シャワー・睡眠を最優先。" />
      </div>
    </div>
  );
}

function AirportTime({ code, time, align = "left" }: { code: string; time: string; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-3xl font-black text-slate-950">{time}</div>
      <div className="text-sm font-black text-slate-600">{code}</div>
    </div>
  );
}

function MiniInfo({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) {
  return (
    <Card className="p-4">
      <Icon className="mb-3 h-5 w-5 text-teal-700" />
      <h3 className="font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </Card>
  );
}

function AttendeesView() {
  const [text, setText] = useStoredState(LS_KEYS.attendeeText, defaultAttendeeText);
  const [attendeeRows, setAttendeeRows] = useState<Attendee[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState("名簿を確認中");
  const [dbBusy, setDbBusy] = useState(false);
  const attendees = attendeeRows.length ? attendeeRows : parseAttendees(text);
  const filtered = useMemo(() => filterAttendees(attendees, query, category, companyQuery), [attendees, query, category, companyQuery]);
  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const attendee of attendees) {
      if (!attendee.company) continue;
      counts.set(attendee.company, (counts.get(attendee.company) || 0) + 1);
    }
    return counts;
  }, [attendees]);
  const companies = useMemo(() => Array.from(companyCounts.keys()).sort((a, b) => a.localeCompare(b, "ja-JP")), [companyCounts]);
  const companySuggestions = useMemo(() => {
    const value = companyQuery.trim().toLocaleLowerCase("ja-JP");
    const source = value ? companies.filter((company) => company.toLocaleLowerCase("ja-JP").includes(value)) : companies;
    return source
      .sort((a, b) => (companyCounts.get(b) || 0) - (companyCounts.get(a) || 0) || a.localeCompare(b, "ja-JP"))
      .slice(0, 14);
  }, [companies, companyCounts, companyQuery]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: attendees.length, Brand: 0, Partner: 0, Creator: 0 };
    for (const attendee of attendees) {
      for (const item of attendee.categories) {
        counts[item] = (counts[item] || 0) + 1;
      }
    }
    return counts;
  }, [attendees]);
  const categoryFilters = useMemo(
    () =>
      [
        ["all", "全て"],
        ["Brand", "Brand"],
        ["Partner", "Partner"],
        ["Creator", "Creator"],
      ].filter(([key]) => key === "all" || (categoryCounts[key] || 0) > 0),
    [categoryCounts]
  );

  useEffect(() => {
    let active = true;
    async function hydrateDb() {
      try {
        const localJson = await tryLoadLocalAttendeeJson();
        if (localJson?.records?.length || localJson?.rawText) {
          const parsed = localJson.records?.length ? attendeesFromRecords(localJson.records, localJson.rawText || "") : parseAttendees(localJson.rawText || "");
          await saveAttendeeDb({
            attendees: parsed,
            rawText: localJson.rawText || parsed.map((attendee) => attendee.raw).join("\n"),
            importedAt: new Date().toISOString(),
            source: "local-json",
            fetchedAt: localJson.fetchedAt,
          });
          if (!active) return;
          setAttendeeRows(parsed);
          setText(localJson.rawText || parsed.map((attendee) => attendee.raw).join("\n"));
          setDbStatus(`名簿読込済み: ${parsed.length}件`);
          return;
        }

        const saved = await loadAttendeeDb();
        if (!active) return;
        if (saved.attendees.length) {
          setAttendeeRows(saved.attendees);
          setText(String(saved.meta?.rawText || saved.attendees.map((attendee) => attendee.raw).join("\n")));
          setDbStatus(`名簿読込済み: ${saved.attendees.length}件`);
        } else {
          setDbStatus("名簿なし");
        }
      } catch {
        if (active) setDbStatus("名簿読込に失敗");
      }
    }
    hydrateDb();
    return () => {
      active = false;
    };
  }, [setText]);

  const reloadLocalDb = async () => {
    setDbBusy(true);
    try {
      const localJson = await tryLoadLocalAttendeeJson({ bypassCache: true });
      const parsed = localJson?.records?.length ? attendeesFromRecords(localJson.records, localJson.rawText || "") : parseAttendees(localJson?.rawText || text);
      await saveAttendeeDb({
        attendees: parsed,
        rawText: localJson?.rawText || parsed.map((attendee) => attendee.raw).join("\n"),
        importedAt: new Date().toISOString(),
        source: "local-json",
        fetchedAt: localJson?.fetchedAt,
      });
      setAttendeeRows(parsed);
      setText(localJson?.rawText || parsed.map((attendee) => attendee.raw).join("\n"));
      setDbStatus(`名簿更新済み: ${parsed.length}件`);
    } catch {
      setDbStatus("名簿更新に失敗");
    } finally {
      setDbBusy(false);
    }
  };

  const clearDb = async () => {
    setDbBusy(true);
    try {
      await clearAttendeeDb();
      setAttendeeRows([]);
      setText(defaultAttendeeText);
      setQuery("");
      setCompanyQuery("");
      setCategory("all");
      setDbStatus("名簿を削除しました");
    } catch {
      setDbStatus("名簿削除に失敗");
    } finally {
      setDbBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionTitle icon={Users} title="参加者一覧" subtitle="会いたい人を、カテゴリ・会社名・キーワードから素早く探す。" />
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-3xl font-black text-slate-950">{filtered.length}</div>
              <div className="text-xs font-black text-slate-500">表示中 / 全{attendees.length}件</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={reloadLocalDb} disabled={dbBusy} variant="outline" className="min-h-10 px-3">
                <RefreshCw className={cn("h-4 w-4", dbBusy && "animate-spin")} />
                更新
              </Button>
              <Button variant="ghost" onClick={clearDb} disabled={dbBusy} className="min-h-10 px-3 text-slate-500">
                <Trash2 className="h-4 w-4" />
                削除
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categoryFilters.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={cn(
                  "min-h-14 rounded-2xl px-4 text-left text-sm font-black transition active:scale-[0.98]",
                  category === key ? "bg-slate-950 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="block">{label}</span>
                <span className="block text-xs opacity-70">{categoryCounts[key] || 0}件</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="氏名・役職・カテゴリで検索"
                className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none ring-cyan-600 focus:ring-2"
              />
            </div>
            <div className="relative flex-1">
              <Building2 className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input
                value={companyQuery}
                onChange={(event) => setCompanyQuery(event.target.value)}
                onFocus={() => setCompanyMenuOpen(true)}
                onBlur={() => window.setTimeout(() => setCompanyMenuOpen(false), 120)}
                placeholder="会社名で絞り込み"
                className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none ring-cyan-600 focus:ring-2"
              />
              {companyQuery && (
                <button
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setCompanyQuery("")}
                  className="absolute right-3 top-2.5 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="会社名フィルタを解除"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {companyMenuOpen && (
                <div className="absolute left-0 right-0 top-12 z-30 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-soft">
                  {companySuggestions.map((company) => (
                    <button
                      key={company}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setCompanyQuery(company);
                        setCompanyMenuOpen(false);
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-bold text-slate-700 hover:bg-cyan-50"
                    >
                      <span className="truncate">{company}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{companyCounts.get(company) || 0}</span>
                    </button>
                  ))}
                  {companySuggestions.length === 0 && (
                    <div className="px-3 py-5 text-center text-sm font-bold text-slate-400">候補がありません</div>
                  )}
                </div>
              )}
            </div>
            <Button variant="outline" onClick={() => { setQuery(""); setCompanyQuery(""); setCategory("all"); }}>
              解除
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">{dbStatus}</span>
            {category !== "all" && <FilterChip label={category} onClear={() => setCategory("all")} />}
            {companyQuery && <FilterChip label={companyQuery} onClear={() => setCompanyQuery("")} />}
            {query && <FilterChip label={query} onClear={() => setQuery("")} />}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {filtered.map((attendee) => (
                <motion.div
                  key={attendee.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-950">{attendee.name}</div>
                        {attendee.company && (
                          <div className="mt-1 flex items-start gap-1.5 text-sm font-bold leading-5 text-slate-600">
                            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span>{attendee.company}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {attendee.categories.map((item) => (
                          <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    {attendee.role && <div className="text-xs font-bold leading-5 text-slate-500">{attendee.role}</div>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {filtered.length === 0 && <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">該当する参加者がありません。</div>}
        </div>
      </Card>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex min-h-8 items-center gap-1 rounded-full bg-cyan-50 px-3 text-xs font-black text-cyan-900 ring-1 ring-cyan-100"
    >
      {label}
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function ChecklistView() {
  const [checks, setChecks] = useStoredState<Checks>(LS_KEYS.checks, {});
  const done = checklistItems.filter((item) => checks[item.id]).length;
  const progress = Math.round((done / checklistItems.length) * 100);

  return (
    <div className="space-y-5">
      <SectionTitle icon={ClipboardCheck} title="チェックリスト" subtitle="出発前、現地、帰路の確認を端末内に保存。" />
      <Card className="p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-black text-slate-600">準備進捗</div>
            <div className="text-3xl font-black text-slate-950">{progress}%</div>
          </div>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {checklistItems.map((item) => {
            const checked = Boolean(checks[item.id]);
            return (
              <button
                key={item.id}
                onClick={() => setChecks((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                className={cn(
                  "flex min-h-16 items-start gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
                  checked ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                {checked ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />}
                <span>
                  <span className="block text-xs font-black text-slate-500">{item.group}</span>
                  <span className="block font-black text-slate-950">{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function NotesView() {
  const [notes, setNotes] = useStoredState<Notes>(LS_KEYS.notes, emptyNotes);

  return (
    <div className="space-y-5">
      <SectionTitle icon={NotebookPen} title="メモ" subtitle="会いたい人、商談、土産、移動のメモを端末内に保存。" />
      <div className="grid gap-4 lg:grid-cols-2">
        {noteSections.map((section) => (
          <Card key={section.key} className="p-5">
            <label className="mb-3 block font-black text-slate-950" htmlFor={`note-${section.key}`}>{section.title}</label>
            <textarea
              id={`note-${section.key}`}
              value={notes[section.key] ?? ""}
              onChange={(event) => setNotes((prev) => ({ ...prev, [section.key]: event.target.value }))}
              className="h-44 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 outline-none ring-cyan-600 focus:ring-2"
              placeholder={section.placeholder}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}

function LinksView() {
  return (
    <div className="space-y-5">
      <SectionTitle icon={ExternalLink} title="公式リンク" subtitle="公式情報は外部リンクとして開きます。認証が必要なページはブラウザ側で確認。" />
      <div className="grid gap-4 md:grid-cols-3">
        {officialLinks.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5"
          >
            <h3 className="font-black text-slate-950">{link.label}</h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{link.note}</p>
            <span className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
              開く
              <ExternalLink className="h-4 w-4" />
            </span>
          </a>
        ))}
      </div>
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
        <div className="flex gap-3">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-cyan-800" />
          <p className="text-sm leading-6 text-cyan-950">
            PWAは静的アセットと主要画面をService Workerでキャッシュします。外部公式サイトの内容はオンライン時に最新を確認してください。
          </p>
        </div>
      </div>
    </div>
  );
}

const tabs = [
  { key: "home", label: "ホーム", icon: Home, component: HomeView },
  { key: "schedule", label: "日程", icon: CalendarDays, component: ScheduleView },
  { key: "flights", label: "便", icon: Plane, component: FlightsView },
  { key: "attendees", label: "参加者", icon: Users, component: AttendeesView },
  { key: "check", label: "確認", icon: ClipboardCheck, component: ChecklistView },
  { key: "notes", label: "メモ", icon: NotebookPen, component: NotesView },
  { key: "links", label: "リンク", icon: ExternalLink, component: LinksView },
] as const;

async function warmAttendeeStorage() {
  try {
    const localJson = await tryLoadLocalAttendeeJson();
    if (!localJson?.records?.length && !localJson?.rawText) return;

    const parsed = localJson.records?.length
      ? attendeesFromRecords(localJson.records, localJson.rawText || "")
      : parseAttendees(localJson.rawText || "");
    const rawText = localJson.rawText || parsed.map((attendee) => attendee.raw).join("\n");

    await saveAttendeeDb({
      attendees: parsed,
      rawText,
      importedAt: new Date().toISOString(),
      source: "local-json",
      fetchedAt: localJson.fetchedAt,
    });
    window.localStorage.setItem(LS_KEYS.attendeeText, JSON.stringify(rawText));
  } catch {
    // Offline or first-install failures are handled by the attendee view fallback.
  }
}

export function App() {
  const [tab, setTab] = useState<TabKey>("home");
  const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];
  const Current = activeTab.component as ComponentType;

  useEffect(() => {
    warmAttendeeStorage();
  }, []);

  return (
    <div className="min-h-screen text-slate-950">
      <div className="safe-bottom mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">Okinawa Agenda</div>
            <div className="text-lg font-black text-slate-950">MA26 Trip Cockpit</div>
          </div>
          <div className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-soft ring-1 ring-slate-200">Offline ready</div>
        </div>
        <motion.main key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {activeTab.key === "home" ? <HomeView setTab={setTab} /> : <Current />}
        </motion.main>
        <footer className="text-center text-xs leading-6 text-slate-500">
          Data is stored locally in this browser. Refresh official pages before departure.
        </footer>
      </div>
      <nav className="tabbar-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/92 px-2 pt-2 shadow-[0_-12px_34px_-28px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-7 gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = item.key === tab;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition active:scale-[0.97]",
                  active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
