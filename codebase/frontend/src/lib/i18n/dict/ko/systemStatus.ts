export const systemStatus = {
  title: "시스템 상태",
  systemWideBanner:
    "이 페이지는 전체 시스템의 상태입니다. 특정 워크스페이스나 사용자 기준이 아닙니다.",
  refresh: "새로고침",
  overall: {
    healthy: "시스템 정상",
    degraded: "일부 지연",
    down: "점검 필요",
  },
  totalRecentFailed: "최근 {{minutes}}분 실패",
  totalRetainedFailed: "누적 보관",
  groups: {
    execution: "실행",
    "knowledge-base": "지식 저장소",
    integration: "알림·통합",
    system: "스케줄·시스템",
  },
  counts: {
    waiting: "대기",
    active: "처리 중",
    delayed: "지연",
    recentFailed: "실패(최근)",
    retainedFailed: "누적 보관",
  },
  utilization: "포화도",
  scheduledJob: "정기 작업",
  paused: "일시정지",
  health: {
    healthy: "정상",
    degraded: "지연",
    down: "점검 필요",
  },
  loading: "상태를 불러오는 중…",
  loadFailed: "시스템 상태를 불러오지 못했습니다.",
  retry: "다시 시도",
} as const;
