---
id: system-status
status: implemented
code:
  - codebase/frontend/src/app/(main)/system-status/page.tsx
---

# Spec: 시스템 상태 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#39-system-status-시스템-상태) · [Spec 레이아웃](./_layout.md) · [Spec 시스템 상태 API](../5-system/16-system-status-api.md) · [Spec 통계 화면](./7-statistics.md)

전체 시스템(BullMQ 큐)이 정상 운영 중인지를 집계 지표로 보여주는 읽기 전용 status 화면. 경로 `/system-status`.

## 1. 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  시스템 상태                                    [↻ 새로고침]   │
│  ⓘ 이 페이지는 전체 시스템의 상태입니다.                       │
│     특정 워크스페이스/사용자 기준이 아닙니다.                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  🟢 시스템 정상   실패(최근 N분): 0 · 누적 보관: 0          ││
│  └──────────────────────────────────────────────────────────┘│
│   (N = failedWindowMinutes 응답값, 기본 60)                    │
│                                                              │
│  실행 (Execution)                                            │
│  ┌────────────────────────┐ ┌─────────────────────────┐      │
│  │ background-execution 🟢│ │ execution-continuation 🟢│     │
│  │ 대기 0 · 처리중 1       │ │ 대기 0 · 처리중 0        │     │
│  │ 지연 0 · 실패(최근) 0   │ │ 지연 0 · 실패(최근) 0    │     │
│  │   └ 누적 보관 0         │ │   └ 누적 보관 0          │     │
│  │ 포화도 ▓░░░ 33%         │ │ 포화도 ░░░░ 0%           │     │
│  └────────────────────────┘ └─────────────────────────┘      │
│                                                              │
│  지식베이스 · 알림·통합 · 스케줄·시스템 (그룹별 동일 카드)     │
└──────────────────────────────────────────────────────────────┘
```

## 2. 기능 상세

### 2.1 시스템 전역 명시
- 페이지 상단에 "전체 시스템 상태 — 특정 워크스페이스/사용자 기준 아님" 배너를 **항상** 노출한다 (info 톤).

### 2.2 종합 상태 헤더
- `overall` 을 신호등 + 텍스트로 표기: healthy=🟢 시스템 정상 / degraded=🟡 일부 지연 / down=🔴 점검 필요.
- 실패 배지는 **병기**한다: `totalRecentFailed`(최근 윈도우 실패 합계)를 **주 배지**(0 초과 시 강조), `totalFailed`(누적 보관)를 **부 배지**로. 주 배지 라벨에는 `failedWindowMinutes` 응답값을 반영한다("최근 N분 실패").

### 2.3 큐 그룹 카드
- 4개 그룹(실행 / 지식베이스 / 알림·통합 / 스케줄·시스템) 섹션으로 묶어 표시.
- 각 큐 카드: health pill + counts(대기/처리중/지연) + 실패 병기 + 포화도 게이지(utilization).
- **실패 표기**: "실패(최근 윈도우)" = `recentFailed` 를 주 수치(0 초과 시 강조)로, "누적 보관" = `counts.failed` 를 부 수치로 병기한다. 해당 큐의 `recentFailedCapped` 가 참이면 `recentFailed` 를 "N+"(하한값)로 표기한다. 종합 헤더의 `totalRecentFailed` 도 집계 `recentFailedCapped` 가 참이면 "N+".
- `system` 그룹 cron 큐는 카운트가 보통 0 이므로 "정기 작업" 라벨을 함께 표기하고 paused 여부를 우선 강조한다.

### 2.4 갱신
- React Query `useQuery({ queryKey: ['system-status','overview'], refetchInterval: 5000 })` 로 5초 폴링. 수동 "새로고침" 버튼 제공.
- 읽기 전용. 카드 클릭 시 drill-down 없음 (개별 job 미노출).

### 2.5 로딩/에러
- 로딩: 스켈레톤. 에러: "상태를 불러오지 못했습니다" + 재시도. (통계 화면의 로딩/에러 처리 패턴 재사용)

## 3. 접근성·i18n
- 신호등은 색 + 텍스트 라벨을 병기한다 (색만으로 의미 전달 금지, WCAG 2.1).
- KO/EN i18n dict 갱신: 사이드바 메뉴 라벨(`sidebar.systemStatus`) + 페이지 문자열.
- 실패 병기용 신규 라벨 키 추가(최근 윈도우 / 누적 보관 / 종합 헤더 주·부 배지). 기존 `systemStatus.counts.failed` 라벨 값의 의미가 "누적 보관" 으로 바뀌므로 라벨 텍스트도 함께 갱신한다.

## Rationale

### R-1. 통계 화면과 공유하는 것 / 다른 것
레이아웃 골격·JWT 인증·`{data}` 추출 유틸·shadcn/ui 컴포넌트·React Query 사용은 기존 [통계 화면](./7-statistics.md)을 그대로 따른다. **단, 갱신 방식은 다르다** — 통계는 수동/필터 기반 refetch 인 반면, 본 화면은 "지금 정상인가" 를 보여주는 status 성격이라 `refetchInterval` 자동 폴링(5초)을 별도로 정의한다.

### R-2. drill-down 을 두지 않는 이유
집계 카운트만 노출해 보안 노출면을 0 으로 유지하기 위함 (API Spec [§4 보안](../5-system/16-system-status-api.md#4-보안) · R-1). 개별 job 조회는 워크스페이스 귀속·payload 마스킹·권한 가드를 동반하므로 v1 범위에서 의도적으로 제외했다.

### R-3. 최근 실패를 주 지표, 누적을 부 지표로 둔 이유
스냅샷 지표(대기/처리중/지연/포화도)는 이미 현재 상태를 반영하지만, 실패 수만 큐별 보관 정책에 따라 누적되어 "전 기간 누적" 으로 오인됐다. "지금 정상인가" 가 본 화면의 목적이므로 최근 윈도우 실패(`recentFailed`)를 주 지표로 전면화하고, 디버깅 참고용 누적(보관 중, `counts.failed`)은 부 지표로 병기한다. 산정 방식·비용·health 연동 근거는 [API spec R-5](../5-system/16-system-status-api.md#rationale) 참조.

스캔 캡(`SYSTEM_STATUS_FAILED_SCAN_CAP`) 소진으로 `recentFailed` 가 하한값일 때는 서버가 `recentFailedCapped` 로 알리고 UI 가 "N+" 로 표기한다 — 초기엔 "허용" 으로 뒀으나, 하한값을 정확값처럼 보이게 두면 사용자가 과소평가하므로 명시 신호 + N+ 표기로 구현했다.
