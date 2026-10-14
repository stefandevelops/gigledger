import {
  defaultFollowUpDate,
  statusProbability,
  summarizePipeline,
  type PipelineItem,
} from "@/lib/pipeline";

export type Application = PipelineItem & {
  id: string;
  company: string;
  role: string;
  type: string;
  source: string;
  nextAction: string;
  notes: string;
  createdAt: string;
};

export type ApplicationInput = {
  company: string;
  role: string;
  type: string;
  source: string;
  rateEur: number | null;
  estimatedHours: number | null;
  platformFeePct: number;
  status: string;
  nextAction?: string;
  notes?: string;
  followUpOn?: string | null;
  probability?: number;
};

const STORAGE_KEY = "gigledger-pipeline-v1";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** Realistic seed so the showcase looks alive on first visit. */
export function demoApplications(): Application[] {
  return [
    {
      id: "demo-nordic-ui",
      company: "Nordic UI Studio",
      role: "Landing page rebuild (Next.js)",
      type: "freelance",
      source: "upwork",
      rateEur: 22,
      estimatedHours: 28,
      platformFeePct: 10,
      status: "interview",
      probability: statusProbability.interview,
      followUpOn: daysAgo(1),
      nextAction: "Send revised estimate after discovery call",
      notes: "Client wants animation-heavy hero; scope fees carefully.",
      createdAt: daysAgo(8),
    },
    {
      id: "demo-brightpath",
      company: "BrightPath Coaching",
      role: "Junior frontend (React)",
      type: "job",
      source: "linkedin",
      rateEur: 18,
      estimatedHours: 160,
      platformFeePct: 0,
      status: "applied",
      probability: statusProbability.applied,
      followUpOn: daysFromNow(2),
      nextAction: "Follow up if no reply mid-week",
      notes: "Remote EU · €18/hr trial to full-time.",
      createdAt: daysAgo(5),
    },
    {
      id: "demo-harbor",
      company: "Harbor Logistics",
      role: "Dashboard widgets + CSV export",
      type: "freelance",
      source: "referral",
      rateEur: 35,
      estimatedHours: 40,
      platformFeePct: 0,
      status: "offer",
      probability: statusProbability.offer,
      followUpOn: daysFromNow(1),
      nextAction: "Sign SOW and request 30% deposit",
      notes: "Warm intro from previous client.",
      createdAt: daysAgo(12),
    },
    {
      id: "demo-quickfix",
      company: "QuickFix Apps",
      role: "Bugfix sprint on legacy PHP",
      type: "freelance",
      source: "upwork",
      rateEur: 15,
      estimatedHours: 12,
      platformFeePct: 10,
      status: "applied",
      probability: statusProbability.applied,
      followUpOn: daysAgo(2),
      nextAction: "Decline or renegotiate above floor",
      notes: "Quoted below floor after fees — demo of underpaid work.",
      createdAt: daysAgo(3),
    },
    {
      id: "demo-leafmail",
      company: "Leafmail",
      role: "Auth + billing MVP slice",
      type: "freelance",
      source: "cold",
      rateEur: 40,
      estimatedHours: 60,
      platformFeePct: 0,
      status: "won",
      probability: statusProbability.won,
      followUpOn: null,
      nextAction: "",
      notes: "Closed last month — counts toward won revenue.",
      createdAt: daysAgo(40),
    },
    {
      id: "demo-pixelbay",
      company: "PixelBay Agency",
      role: "WordPress theme polish",
      type: "freelance",
      source: "upwork",
      rateEur: 20,
      estimatedHours: 16,
      platformFeePct: 10,
      status: "rejected",
      probability: statusProbability.rejected,
      followUpOn: null,
      nextAction: "",
      notes: "Client went with cheaper bid.",
      createdAt: daysAgo(20),
    },
  ];
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadApplications(): Application[] {
  if (!canUseStorage()) return demoApplications();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = demoApplications();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw) as Application[];
    if (!Array.isArray(parsed)) throw new Error("bad shape");
    return parsed;
  } catch {
    const seed = demoApplications();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

function saveApplications(items: Application[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createApplication(input: ApplicationInput): Application[] {
  const feeDefault = input.source === "upwork" ? 10 : input.platformFeePct;
  const probability =
    input.probability ?? statusProbability[input.status] ?? 20;
  const item: Application = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `app-${Date.now()}`,
    company: input.company,
    role: input.role,
    type: input.type,
    source: input.source,
    rateEur: input.rateEur,
    estimatedHours: input.estimatedHours,
    platformFeePct: feeDefault,
    status: input.status,
    probability,
    followUpOn:
      input.followUpOn === undefined
        ? defaultFollowUpDate(input.type === "freelance" ? 2 : 4).toISOString()
        : input.followUpOn,
    nextAction: input.nextAction ?? "",
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...loadApplications()];
  saveApplications(next);
  return next;
}

export function updateApplication(
  id: string,
  patch: Partial<ApplicationInput> & { action?: string; days?: number },
): Application[] {
  const items = loadApplications();
  const next = items.map((item) => {
    if (item.id !== id) return item;

    if (patch.action === "snooze_followup") {
      return {
        ...item,
        followUpOn: defaultFollowUpDate(Number(patch.days) || 3).toISOString(),
        nextAction: patch.nextAction ?? item.nextAction,
      };
    }

    const status = patch.status ?? item.status;
    const probability =
      patch.probability ??
      (patch.status ? statusProbability[status] ?? item.probability : item.probability);

    return {
      ...item,
      company: patch.company ?? item.company,
      role: patch.role ?? item.role,
      type: patch.type ?? item.type,
      source: patch.source ?? item.source,
      rateEur: patch.rateEur === undefined ? item.rateEur : patch.rateEur,
      estimatedHours:
        patch.estimatedHours === undefined
          ? item.estimatedHours
          : patch.estimatedHours,
      platformFeePct: patch.platformFeePct ?? item.platformFeePct,
      status,
      probability,
      followUpOn:
        patch.followUpOn === undefined ? item.followUpOn : patch.followUpOn,
      nextAction: patch.nextAction ?? item.nextAction,
      notes: patch.notes ?? item.notes,
    };
  });
  saveApplications(next);
  return next;
}

export function deleteApplication(id: string): Application[] {
  const next = loadApplications().filter((item) => item.id !== id);
  saveApplications(next);
  return next;
}

export function resetToDemo(): Application[] {
  const seed = demoApplications();
  saveApplications(seed);
  return seed;
}

export function getSummary(items: Application[]) {
  return summarizePipeline(items);
}
