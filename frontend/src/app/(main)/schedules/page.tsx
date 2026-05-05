"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Inbox,
  Trash2,
  X,
  Play,
  List,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import { Pagination } from "@/components/ui/pagination";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
import { RoleGate } from "@/components/auth/role-gate";
import {
  parseCronToVisualOrNull,
  buildCronFromVisual,
  DEFAULT_VISUAL_STATE,
  type Frequency,
  type VisualState,
} from "@/lib/utils/cron-to-visual";

const PAGE_SIZE = 20;

interface Schedule {
  id: string;
  name: string;
  cronExpression: string;
  cronDescription?: string;
  timezone: string;
  isActive: boolean;
  nextRunAt?: string;
  workflowId: string;
  workflowName: string;
  parameterValues?: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
}

type CronEditorTab = "expression" | "visual";
type ViewMode = "list" | "calendar";

const DAYS_OF_WEEK: { labelKey: TranslationKey; value: number }[] = [
  { labelKey: "schedules.dayShortSun", value: 0 },
  { labelKey: "schedules.dayShortMon", value: 1 },
  { labelKey: "schedules.dayShortTue", value: 2 },
  { labelKey: "schedules.dayShortWed", value: 3 },
  { labelKey: "schedules.dayShortThu", value: 4 },
  { labelKey: "schedules.dayShortFri", value: 5 },
  { labelKey: "schedules.dayShortSat", value: 6 },
];

function getCronDescription(expression: string): string | null {
  try {
    return cronstrue.toString(expression);
  } catch {
    return null;
  }
}

function getNextRuns(
  expression: string,
  timezone: string,
  count: number,
): Date[] {
  try {
    const interval = CronExpressionParser.parse(expression, { tz: timezone });
    const runs: Date[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(interval.next().toDate());
    }
    return runs;
  } catch {
    return [];
  }
}

function getRunDaysInMonth(
  expression: string,
  timezone: string,
  year: number,
  month: number,
): Set<number> {
  const days = new Set<number>();
  try {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    const interval = CronExpressionParser.parse(expression, {
      tz: timezone,
      currentDate: startOfMonth,
    });
    let next = interval.next().toDate();
    while (next <= endOfMonth) {
      days.add(next.getDate());
      try {
        next = interval.next().toDate();
      } catch {
        break;
      }
    }
  } catch {
    // invalid cron
  }
  return days;
}

function NextRunsPreview({
  expression,
  timezone,
  t,
}: {
  expression: string;
  timezone: string;
  t: TFunction;
}) {
  const runs = useMemo(
    () => getNextRuns(expression, timezone, 5),
    [expression, timezone],
  );

  if (!expression.trim() || runs.length === 0) return null;

  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
      <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {t("schedules.nextFiveRuns")}
      </p>
      <ul className="space-y-1">
        {runs.map((run, i) => (
          <li
            key={i}
            className="text-xs text-[hsl(var(--foreground))]"
          >
            {run.toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisualCronEditor({
  state,
  onChange,
  cronCannotRepresent,
  cronExpression,
  t,
}: {
  state: VisualState;
  onChange: (next: VisualState) => void;
  cronCannotRepresent: boolean;
  cronExpression: string;
  t: TFunction;
}) {
  const { frequency, minute, hour, selectedDays, dayOfMonth } = state;
  const update = (patch: Partial<VisualState>) => onChange({ ...state, ...patch });

  const handleDayToggle = (day: number) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort((a, b) => a - b);
    update({ selectedDays: next });
  };

  return (
    <div className="space-y-4">
      {cronCannotRepresent && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          {t("schedules.expressionNotRepresentable")}
        </div>
      )}
      <div>
        <Label htmlFor="visual-frequency">{t("schedules.frequency")}</Label>
        <select
          id="visual-frequency"
          className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          value={frequency}
          onChange={(e) => update({ frequency: e.target.value as Frequency })}
        >
          <option value="every-minute">{t("schedules.frequencyEveryMinute")}</option>
          <option value="hourly">{t("schedules.frequencyHourly")}</option>
          <option value="daily">{t("schedules.frequencyDaily")}</option>
          <option value="weekly">{t("schedules.frequencyWeekly")}</option>
          <option value="monthly">{t("schedules.frequencyMonthly")}</option>
        </select>
      </div>

      {frequency === "hourly" && (
        <div>
          <Label htmlFor="visual-at-minute">{t("schedules.atMinute")}</Label>
          <select
            id="visual-at-minute"
            className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
            value={minute}
            onChange={(e) => update({ minute: Number(e.target.value) })}
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={i}>
                :{String(i).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
      )}

      {(frequency === "daily" ||
        frequency === "weekly" ||
        frequency === "monthly") && (
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="visual-hour">{t("schedules.hour")}</Label>
            <select
              id="visual-hour"
              className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              value={hour}
              onChange={(e) => update({ hour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Label htmlFor="visual-minute">{t("schedules.minute")}</Label>
            <select
              id="visual-minute"
              className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              value={minute}
              onChange={(e) => update({ minute: Number(e.target.value) })}
            >
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {frequency === "weekly" && (
        <div>
          <Label>{t("schedules.daysOfWeek")}</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedDays.includes(day.value)
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
                )}
                onClick={() => handleDayToggle(day.value)}
              >
                {t(day.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {frequency === "monthly" && (
        <div>
          <Label htmlFor="visual-day-of-month">{t("schedules.dayOfMonth")}</Label>
          <select
            id="visual-day-of-month"
            className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
            value={dayOfMonth}
            onChange={(e) => update({ dayOfMonth: Number(e.target.value) })}
          >
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      {cronExpression && (
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("schedules.generatedExpression")}
          </p>
          <code className="text-sm font-mono text-[hsl(var(--foreground))]">
            {cronExpression}
          </code>
          {getCronDescription(cronExpression) && (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {getCronDescription(cronExpression)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarView({
  schedules,
  t,
}: {
  schedules: Schedule[];
  t: TFunction;
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  const scheduleDays = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const schedule of schedules) {
      if (!schedule.isActive) continue;
      const days = getRunDaysInMonth(
        schedule.cronExpression,
        schedule.timezone,
        year,
        month,
      );
      for (const day of days) {
        const existing = map.get(day) ?? [];
        existing.push(schedule.name);
        map.set(day, existing);
      }
    }
    return map;
  }, [schedules, year, month]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const monthName = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          aria-label={t("common.aria.previousMonth")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="text-sm font-semibold">{monthName}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          aria-label={t("common.aria.nextMonth")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-xs">
        {(["schedules.dayShortSun", "schedules.dayShortMon", "schedules.dayShortTue", "schedules.dayShortWed", "schedules.dayShortThu", "schedules.dayShortFri", "schedules.dayShortSat"] satisfies TranslationKey[]).map((key) => (
          <div
            key={key}
            className="py-2 font-medium text-[hsl(var(--muted-foreground))]"
          >
            {t(key)}
          </div>
        ))}
        {cells.map((day, idx) => {
          const names = day ? scheduleDays.get(day) : undefined;
          const isToday = isCurrentMonth && day === today.getDate();

          return (
            <div
              key={idx}
              className={cn(
                "relative flex min-h-[3rem] flex-col items-center justify-start rounded-md py-1",
                day
                  ? "text-[hsl(var(--foreground))]"
                  : "text-transparent",
                isToday && "bg-[hsl(var(--accent))]",
              )}
              title={names ? names.join(", ") : undefined}
            >
              <span
                className={cn(
                  "text-xs",
                  isToday && "font-bold",
                )}
              >
                {day ?? ""}
              </span>
              {names && names.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                  {names.slice(0, 3).map((_, dotIdx) => (
                    <span
                      key={dotIdx}
                      className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]"
                    />
                  ))}
                  {names.length > 3 && (
                    <span className="text-[8px] leading-none text-[hsl(var(--muted-foreground))]">
                      +{names.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [cronTab, setCronTab] = useState<CronEditorTab>("expression");

  const [formName, setFormName] = useState("");
  const [formWorkflowId, setFormWorkflowId] = useState("");
  const [formCron, setFormCron] = useState("");
  // visual 편집기 상태를 부모로 lift 해 두 모드 사이를 왕복해도 손실되지 않게
  // 한다. expression 입력은 매번 parser 를 통해 visual state 를 동기화하고,
  // visual 컨트롤 변경은 build 함수로 cron 을 재생성한다.
  const [formVisualState, setFormVisualState] =
    useState<VisualState>(DEFAULT_VISUAL_STATE);
  const [formTimezone, setFormTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [formParameterValuesJson, setFormParameterValuesJson] = useState("{}");
  const [parameterValuesError, setParameterValuesError] = useState<string | null>(
    null,
  );

  const { page, setPage } = usePageParam();
  // Raw row shape from /schedules — only the fields we map
  interface RawSchedule {
    id: string;
    name?: string;
    cronExpression: string;
    timezone: string;
    isActive: boolean;
    nextRunAt?: string;
    parameterValues?: Record<string, unknown>;
    trigger?: {
      name?: string;
      workflowId?: string;
      workflow?: { name?: string };
    };
  }
  function mapSchedule(s: RawSchedule): Schedule {
    return {
      id: s.id,
      name: s.trigger?.name ?? s.name ?? "",
      cronExpression: s.cronExpression,
      timezone: s.timezone,
      isActive: s.isActive,
      nextRunAt: s.nextRunAt,
      workflowId: s.trigger?.workflowId ?? "",
      workflowName: s.trigger?.workflow?.name ?? "",
      parameterValues: s.parameterValues ?? {},
    };
  }

  // List view: paginated.
  const schedulesQuery = useQuery<{ items: Schedule[]; totalPages: number }>({
    queryKey: ["schedules", "list", page],
    queryFn: async () => {
      const res = await apiClient.get("/schedules", {
        params: { page, limit: PAGE_SIZE },
      });
      const { items: raw, totalPages } = normalizePagedResponse<RawSchedule>(
        res.data,
        page,
      );
      return { items: raw.map(mapSchedule), totalPages };
    },
    enabled: viewMode === "list",
    placeholderData: (prev) => prev,
  });

  // Calendar view: needs every schedule to render run-day dots, so fetch with
  // a large limit on the same endpoint. A dedicated unpaginated endpoint
  // would be cleaner, but limit=200 covers realistic workspace sizes today.
  const calendarSchedulesQuery = useQuery<Schedule[]>({
    queryKey: ["schedules", "calendar"],
    queryFn: async () => {
      const res = await apiClient.get("/schedules", {
        params: { page: 1, limit: 200 },
      });
      const { items } = normalizePagedResponse<RawSchedule>(res.data, 1);
      return items.map(mapSchedule);
    },
    enabled: viewMode === "calendar",
  });

  const schedules: Schedule[] =
    viewMode === "calendar"
      ? (calendarSchedulesQuery.data ?? [])
      : (schedulesQuery.data?.items ?? []);
  const totalPages: number = schedulesQuery.data?.totalPages ?? 1;
  const isLoading =
    viewMode === "calendar"
      ? calendarSchedulesQuery.isLoading
      : schedulesQuery.isLoading;
  const isError =
    viewMode === "calendar"
      ? calendarSchedulesQuery.isError
      : schedulesQuery.isError;

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["workflows-list"],
    queryFn: async () => {
      const res = await apiClient.get("/workflows");
      return res.data.data ?? res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (parameterValues: Record<string, unknown>) => {
      await apiClient.post("/schedules", {
        name: formName,
        workflowId: formWorkflowId,
        cronExpression: formCron,
        timezone: formTimezone,
        parameterValues,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(t("schedules.created"));
      resetForm();
    },
    onError: () => {
      toast.error(t("schedules.createFailed"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name: string;
        cronExpression: string;
        timezone: string;
        parameterValues: Record<string, unknown>;
      };
    }) => {
      await apiClient.patch(`/schedules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(t("schedules.updated"));
      resetForm();
    },
    onError: () => {
      toast.error(t("schedules.updateFailed"));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/schedules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(t("schedules.updated"));
    },
    onError: () => {
      toast.error(t("schedules.updateFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(t("schedules.deleted"));
      setDeleteTarget(null);
      if (
        viewMode === "list" &&
        schedules.length === 1 &&
        page > 1
      ) {
        setPage(page - 1);
      }
    },
    onError: () => {
      toast.error(t("schedules.deleteFailed"));
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/schedules/${id}/run-now`);
    },
    onSuccess: () => {
      toast.success(t("schedules.executed"));
    },
    onError: () => {
      toast.error(t("schedules.executeFailed"));
    },
  });

  function resetForm() {
    setFormName("");
    setFormWorkflowId("");
    setFormCron("");
    setFormVisualState(DEFAULT_VISUAL_STATE);
    setFormTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setFormParameterValuesJson("{}");
    setParameterValuesError(null);
    setCronTab("expression");
    setEditTarget(null);
    setShowDialog(false);
  }

  function openEdit(schedule: Schedule) {
    setFormName(schedule.name);
    setFormWorkflowId(schedule.workflowId);
    setFormCron(schedule.cronExpression);
    // 편집 진입 시 cron 을 visual 로 분해 시도. 분해 실패(visual 표현 불가)
    // 면 시각 편집 탭에서 안내가 표시되며, 마지막 시각 state(여기선 디폴트)
    // 가 컨트롤 초기값으로 사용된다.
    setFormVisualState(
      parseCronToVisualOrNull(schedule.cronExpression) ?? DEFAULT_VISUAL_STATE,
    );
    setFormTimezone(schedule.timezone);
    setFormParameterValuesJson(
      JSON.stringify(schedule.parameterValues ?? {}, null, 2),
    );
    setParameterValuesError(null);
    setEditTarget(schedule);
    setShowDialog(true);
  }

  // expression input 변경 시 cron 을 visual state 로도 분해하여 두 모드를
  // 단일 진실 원천으로 묶는다. 분해 실패 시 visual state 는 직전 값을
  // 유지하며, VisualCronEditor 가 안내 문구를 표시한다.
  function handleCronInputChange(cron: string) {
    setFormCron(cron);
    const parsed = parseCronToVisualOrNull(cron);
    if (parsed) setFormVisualState(parsed);
  }

  function handleVisualStateChange(next: VisualState) {
    setFormVisualState(next);
    setFormCron(buildCronFromVisual(next));
  }

  // 새 스케줄에서 cron 입력 없이 시각 탭으로 진입하면 디폴트 시각 state 의
  // cron 을 즉시 적용해 사용자가 별도 행동 없이도 저장 가능한 상태로 만든다.
  function handleSetCronTab(tab: CronEditorTab) {
    setCronTab(tab);
    if (tab === "visual" && !formCron.trim()) {
      setFormCron(buildCronFromVisual(formVisualState));
    }
  }

  function handleSubmit() {
    if (!formName.trim() || !formWorkflowId || !formCron.trim()) {
      toast.error(t("schedules.fillRequired"));
      return;
    }
    let parameterValues: Record<string, unknown>;
    try {
      const trimmed = formParameterValuesJson.trim();
      const parsed: unknown = trimmed.length === 0 ? {} : JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(t("schedules.paramsMustBeObject"));
      }
      parameterValues = parsed as Record<string, unknown>;
      setParameterValuesError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("schedules.invalidJson");
      setParameterValuesError(message);
      toast.error(message);
      return;
    }
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        data: {
          name: formName,
          cronExpression: formCron,
          timezone: formTimezone,
          parameterValues,
        },
      });
    } else {
      createMutation.mutate(parameterValues);
    }
  }

  const formCronDescription = useMemo(
    () => getCronDescription(formCron),
    [formCron],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("schedules.title")}</h1>
        <div className="flex items-center gap-2">
          {/* List / Calendar toggle */}
          <div className="flex rounded-md border border-[hsl(var(--border))]">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1 h-4 w-4" />
              {t("schedules.listView")}
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode("calendar")}
            >
              <Calendar className="mr-1 h-4 w-4" />
              {t("schedules.calendarView")}
            </Button>
          </div>
          <RoleGate minRole="editor">
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("schedules.addSchedule")}
            </Button>
          </RoleGate>
        </div>
      </div>

      {/* Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editTarget ? t("schedules.editSchedule") : t("schedules.addSchedule")}</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="schedule-name">{t("schedules.name")}</Label>
                <Input
                  id="schedule-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("schedules.schedulePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="schedule-workflow">{t("schedules.workflow")}</Label>
                <select
                  id="schedule-workflow"
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
                  value={formWorkflowId}
                  onChange={(e) => setFormWorkflowId(e.target.value)}
                  disabled={!!editTarget}
                >
                  <option value="">{t("schedules.selectWorkflow")}</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cron Expression Tabs */}
              <div>
                <div className="mb-2 flex rounded-md border border-[hsl(var(--border))]">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-l-md px-3 py-1.5 text-sm font-medium transition-colors",
                      cronTab === "expression"
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
                    )}
                    onClick={() => handleSetCronTab("expression")}
                  >
                    {t("schedules.expressionTab")}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-r-md px-3 py-1.5 text-sm font-medium transition-colors",
                      cronTab === "visual"
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
                    )}
                    onClick={() => handleSetCronTab("visual")}
                  >
                    {t("schedules.visualTab")}
                  </button>
                </div>

                {cronTab === "expression" ? (
                  <div className="space-y-2">
                    <Label htmlFor="schedule-cron">{t("schedules.cronExpression")}</Label>
                    <Input
                      id="schedule-cron"
                      value={formCron}
                      onChange={(e) => handleCronInputChange(e.target.value)}
                      placeholder="0 * * * *"
                    />
                    {formCronDescription && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formCronDescription}
                      </p>
                    )}
                  </div>
                ) : (
                  <VisualCronEditor
                    state={formVisualState}
                    onChange={handleVisualStateChange}
                    cronCannotRepresent={
                      formCron.trim() !== "" &&
                      parseCronToVisualOrNull(formCron) === null
                    }
                    cronExpression={formCron}
                    t={t}
                  />
                )}
              </div>

              {/* Next 5 runs preview */}
              {formCron.trim() && (
                <NextRunsPreview
                  expression={formCron}
                  timezone={formTimezone}
                  t={t}
                />
              )}

              <div>
                <Label htmlFor="schedule-tz">{t("schedules.timezone")}</Label>
                <Input
                  id="schedule-tz"
                  value={formTimezone}
                  onChange={(e) => setFormTimezone(e.target.value)}
                  placeholder={t("schedules.timezonePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="schedule-params">
                  {t("schedules.paramsLabel")}
                </Label>
                <textarea
                  id="schedule-params"
                  value={formParameterValuesJson}
                  onChange={(e) => {
                    setFormParameterValuesJson(e.target.value);
                    setParameterValuesError(null);
                  }}
                  rows={5}
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                  placeholder={`{\n  "region": "kr",\n  "runAt": "{{ $now }}"\n}`}
                />
                <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  {t("schedules.paramsHelp")}
                </p>
                {parameterValuesError && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {parameterValuesError}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {editTarget ? t("common.save") : t("common.create")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">{t("schedules.deleteTitle")}</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("schedules.deleteMessage")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("schedules.loadFailed")}
        </p>
      )}

      {!isLoading && !isError && schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">{t("schedules.noneFound")}</p>
        </div>
      )}

      {!isLoading && !isError && schedules.length > 0 && viewMode === "list" && (
        <>
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("schedules.columnStatus")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("schedules.columnName")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("schedules.columnCron")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("schedules.columnNextRun")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("schedules.columnWorkflow")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("schedules.columnActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {schedules.map((schedule) => {
                const description = getCronDescription(
                  schedule.cronExpression,
                );
                return (
                  <tr key={schedule.id}>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          schedule.isActive ? "bg-green-500" : "bg-gray-400",
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{schedule.name}</td>
                    <td className="px-4 py-3">
                      <div>
                        <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
                          {schedule.cronExpression}
                        </code>
                        {description && (
                          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                            {description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {schedule.nextRunAt
                        ? new Date(schedule.nextRunAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{schedule.workflowName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={runNowMutation.isPending}
                          onClick={() => runNowMutation.mutate(schedule.id)}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          {t("schedules.runNow")}
                        </Button>
                        <RoleGate minRole="editor">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={toggleMutation.isPending}
                            onClick={() =>
                              toggleMutation.mutate({
                                id: schedule.id,
                                isActive: !schedule.isActive,
                              })
                            }
                          >
                            {schedule.isActive ? t("schedules.toggleDeactivate") : t("schedules.toggleActivate")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(schedule)}
                            aria-label={t("schedules.editTooltip")}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[hsl(var(--destructive))]"
                            onClick={() => setDeleteTarget(schedule.id)}
                            aria-label={t("schedules.deleteTooltip")}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </RoleGate>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {!isLoading &&
        !isError &&
        schedules.length > 0 &&
        viewMode === "calendar" && (
          <CalendarView schedules={schedules} t={t} />
        )}
    </div>
  );
}
