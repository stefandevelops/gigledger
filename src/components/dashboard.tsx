"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RATE_FLOOR_EUR,
  effectiveRate,
  expectedValue,
  isFollowUpOverdue,
  isUnderFloor,
} from "@/lib/pipeline";
import {
  createApplication,
  deleteApplication,
  demoApplications,
  getSummary,
  loadApplications,
  resetToDemo,
  updateApplication,
  type Application,
} from "@/lib/storage";
import { applicationSchema } from "@/lib/validators";

type Summary = ReturnType<typeof getSummary>;

const statuses = ["applied", "interview", "offer", "won", "rejected"] as const;
const sources = ["upwork", "linkedin", "referral", "cold", "other"] as const;
const initialItems = demoApplications();

function money(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function dayLabel(value: string | Date | null) {
  if (!value) return "No follow-up";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function Dashboard() {
  const [items, setItems] = useState<Application[]>(initialItems);
  const [summary, setSummary] = useState<Summary>(() => getSummary(initialItems));
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    company: "",
    role: "",
    type: "freelance",
    source: "upwork",
    rateEur: "25",
    estimatedHours: "10",
    platformFeePct: "10",
    status: "applied",
    nextAction: "Send follow-up if no reply",
    notes: "",
  });

  function refresh(next: Application[]) {
    setItems(next);
    setSummary(getSummary(next));
  }

  useEffect(() => {
    refresh(loadApplications());
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "underfloor") {
      return items.filter((i) => isUnderFloor(i.rateEur, i.platformFeePct));
    }
    if (filter === "overdue") {
      return items.filter((i) => isFollowUpOverdue(i.followUpOn, i.status));
    }
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = applicationSchema.safeParse({
      ...form,
      rateEur: form.rateEur === "" ? null : Number(form.rateEur),
      estimatedHours:
        form.estimatedHours === "" ? null : Number(form.estimatedHours),
      platformFeePct: Number(form.platformFeePct),
    });
    if (!parsed.success) {
      setError("Check the form — company, role, and numbers are required.");
      return;
    }
    refresh(
      createApplication({
        company: parsed.data.company,
        role: parsed.data.role,
        type: parsed.data.type,
        source: parsed.data.source,
        rateEur: parsed.data.rateEur ?? null,
        estimatedHours: parsed.data.estimatedHours ?? null,
        platformFeePct: parsed.data.platformFeePct,
        status: parsed.data.status,
        nextAction: parsed.data.nextAction,
        notes: parsed.data.notes,
      }),
    );
    setForm((prev) => ({
      ...prev,
      company: "",
      role: "",
      notes: "",
    }));
  }

  function setStatus(id: string, status: string) {
    refresh(updateApplication(id, { status }));
  }

  function snooze(id: string) {
    refresh(updateApplication(id, { action: "snooze_followup", days: 3 }));
  }

  function remove(id: string) {
    refresh(deleteApplication(id));
  }

  function restoreDemo() {
    refresh(resetToDemo());
    setFilter("all");
    setError("");
  }

  function exportCsv() {
    const header = [
      "company",
      "role",
      "type",
      "source",
      "rateEur",
      "effectiveRate",
      "estimatedHours",
      "expectedValue",
      "status",
      "probability",
      "followUpOn",
      "nextAction",
      "notes",
    ];
    const rows = items.map((item) => [
      item.company,
      item.role,
      item.type,
      item.source,
      item.rateEur ?? "",
      effectiveRate(item.rateEur, item.platformFeePct)?.toFixed(2) ?? "",
      item.estimatedHours ?? "",
      expectedValue(item).toFixed(2),
      item.status,
      item.probability,
      item.followUpOn ? new Date(item.followUpOn).toISOString() : "",
      item.nextAction,
      item.notes,
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gigledger-pipeline.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
            GigLedger
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
            Pipeline economics — no account needed
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Try the demo instantly. Fees, effective €/hr vs a €{RATE_FLOOR_EUR}{" "}
            floor, expected value, and overdue follow-ups persist in your browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={restoreDemo}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            Reset demo data
          </button>
        </div>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pipeline EV" value={money(summary.pipelineEv)} hint="Probability-weighted" />
        <Stat label="Won revenue" value={money(summary.wonRevenue)} hint="After platform fees" />
        <Stat
          label="Under floor"
          value={String(summary.underFloorCount)}
          hint={`Effective rate < €${RATE_FLOOR_EUR}`}
          warn={summary.underFloorCount > 0}
        />
        <Stat
          label="Overdue follow-ups"
          value={String(summary.overdueCount)}
          hint={summary.winRate == null ? "Win rate —" : `Win rate ${summary.winRate}%`}
          warn={summary.overdueCount > 0}
        />
      </div>

      <form
        onSubmit={addItem}
        className="mb-8 grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input required placeholder="Company / client" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2" />
        <input required placeholder="Role / gig title" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2">
          <option value="freelance">Freelance</option>
          <option value="job">Junior job</option>
        </select>
        <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value, platformFeePct: e.target.value === "upwork" ? "10" : "0" })} className="rounded-lg border border-[var(--line)] px-3 py-2">
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="number" min={0} step={0.5} placeholder="Quoted €/hr" value={form.rateEur} onChange={(e) => setForm({ ...form, rateEur: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2" />
        <input type="number" min={0} step={1} placeholder="Est. hours" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2" />
        <input type="number" min={0} max={40} step={1} placeholder="Platform fee %" value={form.platformFeePct} onChange={(e) => setForm({ ...form, platformFeePct: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2" />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="Next action" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2 lg:col-span-2" />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg border border-[var(--line)] px-3 py-2 lg:col-span-3" />
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-white sm:col-span-2 lg:col-span-3">
          Add to pipeline
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "overdue", "underfloor", ...statuses].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${
              filter === s ? "bg-[var(--ink)] text-white" : "border border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-12 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl">Pipeline is empty</p>
          <p className="mt-2 text-[var(--muted)]">
            Add gigs with hours + fees, or restore the demo seed to explore the tool.
          </p>
          <button
            type="button"
            onClick={restoreDemo}
            className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Restore demo data
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => {
            const eff = effectiveRate(item.rateEur, item.platformFeePct);
            const under = isUnderFloor(item.rateEur, item.platformFeePct);
            const overdue = isFollowUpOverdue(item.followUpOn, item.status);
            return (
              <li key={item.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium">
                      {item.company}{" "}
                      <span className="text-sm font-normal text-[var(--muted)]">
                        · {item.source} · {item.type} · {item.status}
                      </span>
                    </p>
                    <p className="text-sm text-[var(--muted)]">{item.role}</p>
                    <p className="mt-2 text-sm">
                      Quote {item.rateEur != null ? `€${item.rateEur}/hr` : "—"} → effective{" "}
                      <span className={under ? "font-semibold text-[var(--warn)]" : "font-semibold text-[var(--ok)]"}>
                        {eff != null ? `€${eff.toFixed(2)}/hr` : "—"}
                      </span>
                      {item.estimatedHours != null ? ` · ${item.estimatedHours}h` : ""}
                      {" · EV "}
                      {money(expectedValue(item))}
                      {" · follow-up "}
                      <span className={overdue ? "text-[var(--warn)]" : ""}>{dayLabel(item.followUpOn)}</span>
                    </p>
                    {item.nextAction ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">Next: {item.nextAction}</p>
                    ) : null}
                    {under ? (
                      <p className="mt-2 text-sm text-[var(--warn)]">
                        Below your €{RATE_FLOOR_EUR} floor after fees — renegotiate or decline.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statuses.map((s) => (
                      <button key={s} type="button" onClick={() => setStatus(item.id, s)} className="rounded-md border border-[var(--line)] px-2 py-1 text-xs capitalize">
                        {s}
                      </button>
                    ))}
                    <button type="button" onClick={() => snooze(item.id)} className="rounded-md border border-[var(--line)] px-2 py-1 text-xs">
                      Snooze +3d
                    </button>
                    <button type="button" onClick={() => remove(item.id)} className="rounded-md px-2 py-1 text-xs text-red-600">
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? "border-[var(--warn)] bg-[#fff7ed]" : "border-[var(--line)] bg-white"}`}>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}
