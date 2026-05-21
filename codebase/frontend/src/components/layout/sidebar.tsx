"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  GitBranch,
  Zap,
  Calendar,
  Puzzle,
  Lock,
  BarChart3,
  BookOpen,
  BookMarked,
  Brain,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  LogOut,
  Bell,
  Menu,
  X,
  Check,
  Plus,
  Settings,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSidebarStore, selectCollapsed } from "@/lib/stores/sidebar-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { authApi } from "@/lib/api/auth";
import { workspacesApi } from "@/lib/api/workspaces";
import { apiClient } from "@/lib/api/client";
import { CreateTeamWorkspaceDialog } from "@/components/workspace/create-team-workspace-dialog";
import { Logo, LogoMark } from "@/components/ui/logo";
import { useT, type TranslationKey } from "@/lib/i18n";
import { notificationHref } from "@/lib/notifications/href";
import {
  filterNotifications,
  FILTER_CHIPS,
  type NotificationFilter,
} from "@/lib/notifications/filter";

import type {
  WorkspaceRole,
  WorkspaceSummary,
} from "@/lib/stores/workspace-store";
import { roleLabelKey } from "@/lib/utils/workspace";

interface WorkspaceGroupProps {
  title: string;
  items: WorkspaceSummary[];
  currentWorkspaceId: string | null;
  onSelect: (id: string) => void;
  typeLabel: string;
  getRoleLabel: (role: WorkspaceRole) => string;
}

function renderWorkspaceGroup({
  title,
  items,
  currentWorkspaceId,
  onSelect,
  typeLabel,
  getRoleLabel,
}: WorkspaceGroupProps) {
  if (items.length === 0) return null;
  return (
    <div key={title}>
      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {title}
      </div>
      {items.map((w) => (
        <button
          type="button"
          key={w.id}
          onClick={() => onSelect(w.id)}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[hsl(var(--accent))]",
            w.id === currentWorkspaceId && "bg-[hsl(var(--accent))]/60",
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{w.name}</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {typeLabel} · {getRoleLabel(w.role)}
            </span>
          </span>
          {w.id === currentWorkspaceId && (
            <Check className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
          )}
        </button>
      ))}
    </div>
  );
}

const navItems = [
  { labelKey: "sidebar.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "sidebar.workflows", href: "/workflows", icon: GitBranch },
  { labelKey: "sidebar.triggers", href: "/triggers", icon: Zap },
  { labelKey: "sidebar.schedule", href: "/schedules", icon: Calendar },
  { labelKey: "sidebar.integration", href: "/integrations", icon: Puzzle },
  { labelKey: "sidebar.knowledgeBase", href: "/knowledge-bases", icon: BookOpen },
  { labelKey: "sidebar.llmConfig", href: "/llm-configs", icon: Brain },
  { labelKey: "sidebar.authentication", href: "/authentication", icon: Lock },
  { labelKey: "sidebar.statistics", href: "/statistics", icon: BarChart3 },
  { labelKey: "sidebar.userGuide", href: "/docs", icon: BookMarked },
] as const satisfies ReadonlyArray<{
  labelKey: TranslationKey;
  href: string;
  icon: typeof LayoutDashboard;
}>;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function Sidebar() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  // Sidebar store for shared collapsed state
  const collapsed = useSidebarStore(selectCollapsed);
  const toggleCollapse = useSidebarStore((s) => s.toggleCollapse);
  const setIsSmall = useSidebarStore((s) => s.setIsSmall);
  const setIsMedium = useSidebarStore((s) => s.setIsMedium);

  const isSmall = useMediaQuery("(max-width: 1279px)");
  const isMedium = useMediaQuery("(min-width: 1280px) and (max-width: 1439px)");

  // Sync media query results to sidebar store
  useEffect(() => { setIsSmall(isSmall); }, [isSmall, setIsSmall]);
  useEffect(() => { setIsMedium(isMedium); }, [isMedium, setIsMedium]);

  const hidden = isSmall && !mobileOpen;

  // Workspace list
  useQuery({
    queryKey: ["workspaces", "list"],
    queryFn: async () => {
      const list = await workspacesApi.list();
      setWorkspaces(list);
      return list;
    },
    staleTime: 60_000,
    enabled: !!user,
  });

  // Notification unread count
  const unreadQuery = useQuery<number>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const { data } = await apiClient.get("/notifications/unread-count");
      return data.data?.count ?? data.count ?? 0;
    },
    refetchInterval: 30000,
  });
  const unreadCount = unreadQuery.data ?? 0;

  // Notification list — `dismissed_at IS NULL` 알림만 (backend 가 필터링).
  // 자세한 라이프사이클은 spec/data-flow/8-notifications.md §3-§4 참조.
  const notifListQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const { data } = await apiClient.get("/notifications?limit=10");
      return (data.data?.data ?? data.data ?? []) as Array<{
        id: string;
        title: string;
        message: string;
        isRead: boolean;
        createdAt: string;
        resourceType?: string | null;
        resourceId?: string | null;
        type?: string;
      }>;
    },
    enabled: notifOpen,
  });

  const queryClient = useQueryClient();
  const invalidateNotifs = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    queryClient.invalidateQueries({
      queryKey: ["notifications", "unread-count"],
    });
  };

  // Mutations — spec/data-flow/8-notifications.md §4.2.
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: invalidateNotifs,
  });
  const dismissOneMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/notifications/${id}/dismiss`);
    },
    onSuccess: invalidateNotifs,
  });
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/notifications/mark-all-read`);
    },
    onSuccess: invalidateNotifs,
  });
  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/notifications/dismiss-all`);
    },
    onSuccess: invalidateNotifs,
  });

  // 알림 타입 필터 (popover 상단 칩 3-옵션). 클라이언트 사이드 필터링 —
  // 목록 10개 limit 안에서 동작. server-side `?type=...` 는 별 plan.
  // 라우팅 helper(`notificationHref`) 는 `@/lib/notifications/href` 에 추출됨
  // 단위 테스트로 lock 됨 (옛 인라인 함수의 `/integration` 단수 버그 회귀 방지).
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>("all");
  const visibleNotifications = filterNotifications(
    notifListQuery.data ?? [],
    notifFilter,
  );

  // popover 닫힘 → 다음 진입 시 이전 필터 상태가 잔존하지 않도록 'all' 로 리셋.
  // setState 를 useEffect 안에서 호출하면 cascading render 위험이 있어 (lint
  // 규칙 react-hooks/set-state-in-effect) close 핸들러 측에서 동기적으로 처리.
  const closeNotif = useCallback(() => {
    setNotifOpen(false);
    setNotifFilter("all");
  }, []);
  // W6: updater 함수 내에서 별도 setState 호출은 React Concurrent Mode 에서
  // 이중 호출 위험이 있으므로 분리. notifOpen 을 deps 에 추가.
  const toggleNotif = useCallback(() => {
    if (notifOpen) setNotifFilter("all");
    setNotifOpen((prev) => !prev);
  }, [notifOpen]);

  function handleNotifClick(notif: {
    id: string;
    isRead: boolean;
    type?: string;
    resourceType?: string | null;
    resourceId?: string | null;
  }) {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    const href = notificationHref(notif);
    if (href) {
      closeNotif();
      router.push(href);
    }
  }

  /** CTA 버튼(Reconnect 등) 전용 핸들러 — 항상 popover 를 닫고 deep-link 이동.
   * `handleNotifClick` 과 달리 href 유무에 관계없이 popover 닫힘을 보장한다. */
  function handleCtaClick(
    notif: Parameters<typeof handleNotifClick>[0],
    e: MouseEvent,
  ) {
    e.stopPropagation();
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    const href = notificationHref(notif);
    closeNotif();
    if (href) {
      router.push(href);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        closeNotif();
      }
      if (
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(e.target as Node)
      ) {
        setWorkspaceMenuOpen(false);
      }
    }
    if (userMenuOpen || notifOpen || workspaceMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  // W7: closeNotif 는 useCallback([], []) 으로 stable 하지만 exhaustive-deps
  // 규칙 준수를 위해 명시적으로 포함.
  }, [userMenuOpen, notifOpen, workspaceMenuOpen, closeNotif]);

  // Close mobile sidebar on navigation
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Proceed with client-side logout even if API fails
    }
    logout();
    router.push("/login");
  }

  const userInitial = user?.name?.charAt(0)?.toUpperCase() ?? "U";
  const userName = user?.name ?? t("sidebar.user");

  return (
    <>
      {/* Mobile hamburger button */}
      {isSmall && !mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-sm"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {isSmall && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <nav
        aria-label={t("sidebar.aria.mainNav")}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200",
          collapsed ? "w-16" : "w-60",
          hidden && "-translate-x-full",
        )}
      >
        {/* Logo — spec/6-brand.md §8.4.6 + spec/2-navigation/_layout.md §2.1.
            The entire logo header row is filled with vine-dark-bg-elevated
            (#111e14) so the Vine-green brand SVG remains crisp regardless of
            theme. The neutral palette of the sidebar body resumes below. */}
        <div className="flex h-14 items-center bg-[#111e14] px-4">
          {!collapsed && (
            <Link
              href="/dashboard"
              aria-label={t("sidebar.productName")}
              className="flex items-center"
            >
              <Logo variant="full" theme="dark" size={150} />
            </Link>
          )}
          {collapsed && (
            <Link
              href="/dashboard"
              aria-label={t("sidebar.productName")}
              className="mx-auto flex items-center"
            >
              <LogoMark theme="dark" size={32} />
            </Link>
          )}
          {isSmall && mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="ml-auto"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const label = t(item.labelKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                  collapsed && "justify-center px-2",
                )}
                title={collapsed ? label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Notification bell — spec/2-navigation/_layout.md §3.1, spec/data-flow/8-notifications.md §4 */}
        <div className="relative px-2 pb-1" ref={notifRef}>
          {notifOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1 max-h-[360px] overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
              <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
                <p className="text-sm font-medium">
                  {t("sidebar.notifications")}
                </p>
                {(notifListQuery.data?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => markAllReadMutation.mutate()}
                      disabled={
                        markAllReadMutation.isPending || unreadCount === 0
                      }
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent-foreground))] disabled:opacity-50"
                    >
                      {t("sidebar.markAllRead")}
                    </button>
                    <span className="text-[hsl(var(--muted-foreground))]">·</span>
                    <button
                      type="button"
                      onClick={() => dismissAllMutation.mutate()}
                      disabled={dismissAllMutation.isPending}
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] disabled:opacity-50"
                    >
                      {t("sidebar.dismissAll")}
                    </button>
                  </div>
                )}
              </div>
              {/* Type 필터 칩 — spec/2-navigation/4-integration.md §11.2 의
                  `integration_action_required` 분리 표시 (A-1 follow-up). */}
              {(notifListQuery.data?.length ?? 0) > 0 && (
                <div
                  role="tablist"
                  aria-label={t("sidebar.notificationFilter.aria")}
                  className="flex items-center gap-1 border-b border-[hsl(var(--border))] px-3 py-1.5"
                >
                  {FILTER_CHIPS.map(([value, key]) => {
                    const isActive = notifFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setNotifFilter(value)}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                          isActive
                            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                        )}
                      >
                        {t(key)}
                      </button>
                    );
                  })}
                </div>
              )}
              {!visibleNotifications.length ? (
                <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  {(notifListQuery.data?.length ?? 0) > 0
                    ? t("sidebar.noNotificationsForFilter")
                    : t("sidebar.noNotifications")}
                </div>
              ) : (
                visibleNotifications.map((notif) => {
                  const isUnread = !notif.isRead;
                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        "group relative flex items-start gap-2 border-b border-[hsl(var(--border))] px-3 py-2 last:border-b-0",
                        isUnread && "bg-[hsl(var(--accent))/0.3]",
                      )}
                    >
                      {/* Unread dot indicator (spec §4.1) */}
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          isUnread
                            ? "bg-[hsl(var(--primary))]"
                            : "bg-transparent",
                        )}
                      />
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => handleNotifClick(notif)}
                          className="block w-full cursor-pointer text-left"
                        >
                          <p className="pr-12 text-sm font-medium">
                            {notif.title}
                          </p>
                          <p className="pr-12 text-xs text-[hsl(var(--muted-foreground))]">
                            {notif.message}
                          </p>
                          <time
                            dateTime={notif.createdAt}
                            title={notif.createdAt}
                            className="mt-1 block text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
                          >
                            {formatDate(notif.createdAt, "datetime-tz")}
                          </time>
                        </button>
                        {/* Type-specific inline CTA — `integration_action_required`
                            는 사용자 즉시 액션이 필요한 능동 알림이라 hover 가
                            아닌 상시 노출 (spec §11.2 active 분류). 클릭 시
                            popover 닫고 deep-link 로 이동. */}
                        {notif.type === "integration_action_required" && (
                          <button
                            type="button"
                            onClick={(e) => handleCtaClick(notif, e)}
                            className="mt-1.5 inline-flex items-center rounded-md border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))/0.9]"
                          >
                            {t("sidebar.notificationCta.reconnect")}
                          </button>
                        )}
                      </div>
                      {/* Hover actions (spec §4.2) */}
                      <div className="absolute right-2 top-2 hidden items-center gap-1 group-hover:flex">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markReadMutation.mutate(notif.id);
                            }}
                            disabled={markReadMutation.isPending}
                            title={t("sidebar.markRead")}
                            aria-label={t("sidebar.markRead")}
                            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissOneMutation.mutate(notif.id);
                          }}
                          disabled={dismissOneMutation.isPending}
                          title={t("sidebar.dismiss")}
                          aria-label={t("sidebar.dismiss")}
                          className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--destructive))]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          <button
            type="button"
            onClick={toggleNotif}
            className={cn(
              "relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
              collapsed && "justify-center px-2",
            )}
            title={collapsed ? t("sidebar.notifications") : undefined}
          >
            <Bell className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{t("sidebar.notifications")}</span>}
            {unreadCount > 0 && (
              <span className="absolute right-2 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[hsl(var(--destructive))] px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Workspace switcher */}
        {workspaces.length > 0 && (
          <div
            className="relative border-t border-[hsl(var(--border))] px-2 pb-1 pt-2"
            ref={workspaceMenuRef}
          >
            {workspaceMenuOpen && (
              <div className="absolute bottom-full left-2 right-2 mb-1 max-h-[340px] overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
                <div className="border-b border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {t("sidebar.switchWorkspace")}
                </div>
                {renderWorkspaceGroup({
                  title: t("sidebar.yourWorkspaces"),
                  items: workspaces.filter((w) => w.type === "personal"),
                  currentWorkspaceId,
                  onSelect: (id) => {
                    switchWorkspace(id);
                    setWorkspaceMenuOpen(false);
                  },
                  typeLabel: t("workspace.personal"),
                  getRoleLabel: (r) => t(roleLabelKey(r)),
                })}
                {renderWorkspaceGroup({
                  title: t("sidebar.teamWorkspaces"),
                  items: workspaces.filter((w) => w.type === "team"),
                  currentWorkspaceId,
                  onSelect: (id) => {
                    switchWorkspace(id);
                    setWorkspaceMenuOpen(false);
                  },
                  typeLabel: t("workspace.team"),
                  getRoleLabel: (r) => t(roleLabelKey(r)),
                })}
                <div className="border-t border-[hsl(var(--border))]">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      setCreateWorkspaceOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                  >
                    <Plus className="h-4 w-4" />
                    {t("sidebar.newTeamWorkspace")}
                  </button>
                  <Link
                    href="/workspace/settings"
                    onClick={() => setWorkspaceMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                  >
                    <Settings className="h-4 w-4" />
                    {t("sidebar.settingsHere")}
                  </Link>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm transition-colors",
                "bg-[hsl(var(--accent))]/40 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]",
                collapsed && "justify-center px-2",
              )}
              title={
                collapsed && currentWorkspace
                  ? `${currentWorkspace.name} · ${currentWorkspace.type === "team" ? t("workspace.team") : t("workspace.personal")}`
                  : undefined
              }
            >
              {(() => {
                const Icon =
                  currentWorkspace?.type === "team" ? Users : User;
                return (
                  <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                );
              })()}
              {!collapsed && (
                <>
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-sm font-semibold leading-tight">
                      {currentWorkspace?.name ?? t("sidebar.workspace")}
                    </span>
                    {currentWorkspace && (
                      <span className="truncate text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">
                        {currentWorkspace.type === "team"
                          ? t("workspace.team")
                          : t("workspace.personal")}
                        {" · "}
                        {t(roleLabelKey(currentWorkspace.role))}
                      </span>
                    )}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                </>
              )}
            </button>
          </div>
        )}

        <CreateTeamWorkspaceDialog
          open={createWorkspaceOpen}
          onOpenChange={setCreateWorkspaceOpen}
        />

        {/* User area */}
        <div
          className="relative border-t border-[hsl(var(--border))] p-2"
          ref={userMenuRef}
        >
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
              <div className="border-b border-[hsl(var(--border))] px-3 py-2">
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {userName}
                </p>
                {user?.email && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {user.email}
                  </p>
                )}
              </div>
              <Link
                href="/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              >
                <User className="h-4 w-4" />
                {t("sidebar.profile")}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              >
                <LogOut className="h-4 w-4" />
                {t("sidebar.logout")}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
              collapsed && "justify-center px-2",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-semibold text-[hsl(var(--primary-foreground))]">
              {userInitial}
            </div>
            {!collapsed && <span>{userName}</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        {!isSmall && (
          <div className="border-t border-[hsl(var(--border))] p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className={cn("w-full", collapsed && "px-2")}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-2">{t("sidebar.collapse")}</span>
                </>
              )}
            </Button>
          </div>
        )}
      </nav>
    </>
  );
}
