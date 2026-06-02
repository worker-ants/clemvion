---
name: system-status-page
status: in-progress
worktree: .claude/worktrees/system-status-page-f96d24
branch: claude/system-status-page-f96d24
created: 2026-06-03
owner: developer
summary: 전체 시스템(BullMQ 큐) 상태를 집계 카운트·health 로 보여주는 "시스템 상태" 페이지 신규 추가 (spec → 구현)
---

# 시스템 상태(System Status) 페이지

## 목적

로그인 사용자가 **전체 시스템**(MQ/큐 인프라)이 정상 운영 중인지 한눈에 확인할 수 있는 status 지표 페이지. 워크스페이스/유저 기준이 아니라 **시스템 전역** 상태임을 화면에 명시한다.

## 합의된 설계 (사용자와 4라운드 확정)

- 대상: 현재 운영 중인 12개 BullMQ 큐 (아래 그룹 참조).
- **집계 카운트·health 만 노출**. 개별 job 상세·payload·jobId·drill-down·워크스페이스 귀속 **일절 없음** → 민감정보 노출이 구조적으로 불가능 → admin role 가드 불필요, 로그인 사용자 전원 노출 안전.
- v1 명시 제외: throughput 시계열 (BullMQ `metrics` enable / 샘플링 cron 둘 다 제외).

### 큐 그룹 (4개)

| 그룹 | 큐 |
|------|----|
| 실행 (execution) | `background-execution`, `execution-continuation` |
| 지식베이스 (knowledge-base) | `document-embedding`, `graph-extraction` |
| 알림·통합 (integration) | `notification-webhook`, `cafe24-token-refresh` |
| 스케줄·시스템 cron (system) | `schedule-execution`, `login-history-pruner`, `notification-secret-rotator`, `chat-channel-token-rotator`, `integration-expiry-scanner`, `alerts-evaluator` |

---

## 변경 대상 spec (draft)

### A. 신규 `spec/5-system/16-system-status.md` (백엔드 API)

```markdown
---
id: system-status
status: planned
code:
  - codebase/backend/src/modules/queue-monitor/**
---

# Spec: 시스템 상태 API (큐 모니터링)

> 관련 문서: [Spec 실행 엔진](./4-execution-engine.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [비기능 요구사항 §5 관측성](./_product-overview.md#5-관측성observability) · [Spec API 컨벤션](./2-api-convention.md)

전체 시스템의 BullMQ 큐 상태를 **집계 카운트 + 파생 health** 로 노출하는 관측성 API. 개별 job 데이터는 노출하지 않는다.

## 1. 대상 큐 레지스트리

12개 BullMQ 큐를 단일 `QueueRegistry` 로 enumerate 한다. 각 엔트리는 `{ name, group, concurrency }` 메타를 가진다.

| name | group | concurrency | 비고 |
|------|-------|-------------|------|
| background-execution | execution | (기본 1) | Background 노드 자식 흐름 |
| execution-continuation | execution | 1 (env `CONTINUATION_WORKER_CONCURRENCY`) | 사용자 입력 fan-out |
| document-embedding | knowledge-base | 3 | 문서 임베딩 |
| graph-extraction | knowledge-base | 2 | entity/relation 추출 |
| notification-webhook | integration | (기본 1) | outbound 웹훅 |
| cafe24-token-refresh | integration | (기본 1) | Cafe24 토큰 갱신 |
| schedule-execution | system | (기본 1) | 스케줄 트리거 실행 |
| login-history-pruner | system | (기본 1) | repeatable cron |
| notification-secret-rotator | system | (기본 1) | repeatable cron |
| chat-channel-token-rotator | system | (기본 1) | repeatable cron |
| integration-expiry-scanner | system | (기본 1) | repeatable cron (6h) |
| alerts-evaluator | system | (기본 1) | repeatable cron (5분) |

> concurrency 가 코드에 명시되지 않은 큐는 BullMQ 기본값 1 로 본다. 레지스트리는 실제 worker 설정과 단일 진실을 공유하도록 큐 정의 상수를 재사용한다.

## 2. API

### GET /queue-monitor/overview

- 인증: JWT (`@ApiBearerAuth('access-token')`). admin role 가드 없음 — 집계 카운트만 반환하므로 워크스페이스 식별 불가.
- 응답: `{ data: SystemStatusOverviewDto }` (전역 `{data}` 래핑 컨벤션 준수).

```
SystemStatusOverviewDto {
  generatedAt: string;          // ISO8601, 응답 생성 시각
  overall: "ok" | "degraded" | "down";   // 큐 health 의 최악값 집계
  totalFailed: number;          // 전 큐 failed 합산
  queues: QueueStatusDto[];
}

QueueStatusDto {
  name: string;
  group: "execution" | "knowledge-base" | "integration" | "system";
  counts: { waiting: number; active: number; delayed: number; failed: number; paused: number; };
  concurrency: number;
  utilization: number;          // active / concurrency, 소수 2자리 (concurrency=0 이면 0)
  isPaused: boolean;
  health: "ok" | "degraded" | "down";
}
```

- 구현: 큐별 `queue.getJobCounts('waiting','active','delayed','failed','paused')` + `queue.isPaused()`. 큐 enumerate 는 `QueueRegistry`. 추가 Redis 비용은 큐 수에 비례하는 상수 (job 처리량 무관).

## 3. health 파생 규칙

큐 단위 `health` 는 다음 순서로 평가한다 (휴리스틱):

1. `isPaused === true` → **down**
2. `waiting > 0 && active === 0` → **down** (워커 미가동 추정 — 휴리스틱이며 단일 스냅샷 기반이라 일시적 오탐 가능. UI 는 "점검 필요" 로 표기하되 단정하지 않는다.)
3. `failed >= FAILED_DEGRADED_THRESHOLD` 또는 `delayed >= DELAYED_DEGRADED_THRESHOLD` → **degraded**
4. 그 외 → **ok**

- 임계값은 환경변수로 조정 가능 (`QUEUE_MONITOR_FAILED_THRESHOLD`, `QUEUE_MONITOR_DELAYED_THRESHOLD`). 기본값은 구현 단계에서 보수적으로 설정.
- `overall` 은 큐 health 의 최악값 (down > degraded > ok).

## 4. 보안

- 응답에는 **전역 합산 정수 카운트만** 포함. job id·payload·workflow/execution/workspace 식별자 일절 없음 → 특정 워크스페이스·유저 데이터 식별 불가.
- 따라서 모든 로그인 사용자에게 노출해도 정보 유출 위험이 없다. NAV-UG-05(가이드 전원 노출)와 동일한 노출 모델.

## Rationale

### R-1. 왜 개별 job 을 노출하지 않는가
BullMQ 큐는 워크스페이스 경계 없는 전역 인프라이고 job payload 에 실행 input·대화 내용 등 cross-workspace 민감정보가 들어있다. 개별 job 을 노출하면 워크스페이스 귀속(attribution)·payload 마스킹·권한 가드가 필요해진다. 집계 카운트만 노출하면 이 문제들이 **구조적으로** 사라진다 — "정상 운영 여부" 라는 목적에 카운트·health 로 충분하므로 최소 노출을 택했다.

### R-2. 왜 throughput 시계열을 v1 에서 제외하는가
순간 카운트·포화도·health 로 "지금 정상인지" 는 답할 수 있다. throughput 추이는 BullMQ `metrics`(job hot-path 에 per-job 오버헤드) 또는 샘플링 cron(별도 저장·구성요소)이 필요하다. 부하 추이가 실제로 필요해지면 후속에서 샘플링 cron 을 우선 검토한다 (job 경로 무간섭·비용 상수).

### R-3. 워커 미가동 판정의 한계
`waiting>0 && active===0` 는 단일 스냅샷 휴리스틱이다. concurrency=1 큐가 마침 idle 한 순간 오탐할 수 있어 UI 는 "점검 필요(추정)" 뉘앙스로 표기한다. 정확한 워커 liveness 는 별도 heartbeat 가 필요하며 v1 범위 밖.
```

### B. 신규 `spec/2-navigation/15-system-status.md` (프론트 페이지)

```markdown
---
id: system-status-page
status: planned
code:
  - codebase/frontend/src/app/(main)/queue-monitor/page.tsx
---

# Spec: 시스템 상태 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#39-system-status-시스템-상태) · [Spec 레이아웃](./_layout.md) · [Spec 시스템 상태 API](../5-system/16-system-status.md)

## 1. 화면 구조

\`\`\`
┌──────────────────────────────────────────────────────────────┐
│  시스템 상태                                    [↻ 새로고침]   │
│  ⓘ 이 페이지는 전체 시스템의 상태입니다.                       │
│     특정 워크스페이스/사용자 기준이 아닙니다.                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  🟢 시스템 정상            실패 작업 합계: 0                ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  실행 (Execution)                                            │
│  ┌────────────────────────┐ ┌────────────────────────┐       │
│  │ background-execution 🟢│ │ execution-continuation🟢│      │
│  │ 대기 0 · 처리중 1       │ │ 대기 0 · 처리중 0       │      │
│  │ 지연 0 · 실패 0         │ │ 지연 0 · 실패 0         │      │
│  │ 포화도 ▓░░░ 33%         │ │ 포화도 ░░░░ 0%          │      │
│  └────────────────────────┘ └────────────────────────┘       │
│                                                              │
│  지식베이스 · 알림·통합 · 스케줄·시스템 (그룹별 동일 카드)     │
└──────────────────────────────────────────────────────────────┘
\`\`\`

## 2. 기능 상세

### 2.1 시스템 전역 명시
- 페이지 상단에 "전체 시스템 상태 — 특정 워크스페이스/사용자 기준 아님" 배너를 **항상** 노출한다 (info 톤).

### 2.2 종합 상태 헤더
- `overall` 을 신호등으로 표기: ok=🟢 시스템 정상 / degraded=🟡 일부 지연 / down=🔴 점검 필요.
- `totalFailed` (전 큐 실패 합계) 배지. 0 초과 시 강조.

### 2.3 큐 그룹 카드
- 4개 그룹(실행/지식베이스/알림·통합/스케줄·시스템) 섹션으로 묶어 표시.
- 각 큐 카드: health pill + counts(대기/처리중/지연/실패) + 포화도 게이지(utilization).
- `system` 그룹 cron 큐는 카운트가 보통 0 이므로 "정기 작업" 라벨을 함께 표기하고, paused 여부를 우선 강조.

### 2.4 갱신
- React Query `useQuery` + `refetchInterval` ~5초 폴링. 수동 "새로고침" 버튼 제공.
- 읽기 전용. 카드 클릭 시 drill-down 없음 (개별 job 미노출).

### 2.5 로딩/에러
- 로딩: 스켈레톤. 에러: "상태를 불러오지 못했습니다" + 재시도. (통계 페이지 패턴 재사용)

## 3. 접근성·i18n
- 신호등은 색 + 텍스트 라벨 병기 (색만으로 의미 전달 금지, WCAG).
- KO/EN dict 갱신: 메뉴 라벨 + 페이지 문자열.

## Rationale
- 구조·인증·`{data}` 추출·폴링 패턴은 기존 통계 화면([7-statistics.md](./7-statistics.md))을 그대로 따른다.
```

### C. `spec/2-navigation/_layout.md` §2.2 메뉴 항목 표 수정

Statistics(9) 와 User Guide(10) 사이에 삽입, 이후 번호 +1:

```
| 9  | Statistics    | 차트 아이콘 (BarChart3)   | /statistics    | |
| 10 | System Status | 활동 아이콘 (Activity)    | /queue-monitor | 전체 시스템(큐) 상태 지표. 상세는 [System Status](./15-system-status.md) |
| 11 | User Guide    | 책 아이콘 (BookMarked)    | /docs          | ... |
```

### D. `spec/2-navigation/_product-overview.md` 수정

- 영역 트리에 `System Status` 항목을 Statistics 와 User Guide 사이에 추가 (✅→🚧/계획). 상태 범례상 신규라 계획 단계 표기.
- §3.9 로 "System Status (시스템 상태)" 신설, 기존 3.9 Marketplace→3.10, 3.10 User Guide→3.11, 3.11 User Profile→3.12 로 재번호.

신규 §3.9 요구사항:

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-SS-01 | 전체 시스템(큐) 상태를 집계 카운트로 표시 | 필수 | 🚧(계획) |
| NAV-SS-02 | 큐별 health(정상/지연/점검) 신호등 + 종합 상태 | 필수 | 🚧(계획) |
| NAV-SS-03 | "전체 시스템 기준(워크스페이스/유저 무관)" 명시 배너 | 필수 | 🚧(계획) |
| NAV-SS-04 | 개별 job·payload 미노출 (집계만) | 필수 | 🚧(계획) |
| NAV-SS-05 | 자동 폴링(~5초) + 수동 새로고침 | 권장 | 🚧(계획) |
| NAV-SS-06 | 모든 로그인 사용자에게 사이드바 메뉴로 노출 | 필수 | 🚧(계획) |

> 재번호로 인해 기존 ID(NAV-MP-*, NAV-UG-*)는 불변, 섹션 번호만 이동.

### E. `spec/5-system/_product-overview.md` §5 관측성 수정

NF-OB-06 추가:

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-OB-06 | 시스템 상태 가시화 — 큐 적체/실패/포화도를 집계 UI 로 노출 (개별 job 미노출) | 권장 | 🚧 (계획, `/queue-monitor/overview` + `/queue-monitor` 페이지) |

---

## consistency-check 반영 메모 (2026-06-03, BLOCK: NO)

- 네이밍 통일: route `/system-status`, API `GET /api/system-status/overview`, backend 모듈 `system-status`, spec id `system-status`(프론트)·`system-status-api`(백엔드). 이전 `/queue-monitor` 표기 폐기.
- frontmatter: `status: spec-only`, `code: []`, `pending_plans: [이 plan]` (W-1, W-2).
- 큐 SoT 는 `spec/data-flow/0-overview.md §4` — spec A 표는 요약·cross-ref (W-8).
- 재번호 anchor 갱신 완료: 8-marketplace(#310), 9-user-profile(#312), marketplace plan §3.9→§3.10 (W-4, W-9).
- `_layout.md §1` ASCII + §2.2 표, `_product-overview.md §2` 트리 동기화 완료 (W-5, W-6).
- health 어휘 `healthy/degraded/down` (기존 `healthy` 유지, Rationale R-4) (I-6). `/api/` prefix·`refetchInterval:5000`·X-Workspace-Id 무시 명시 (I-1,I-4,I-5).

## impl-prep 결과 (2026-06-03, BLOCK: NO)

- 내 신규 spec 의 직접 entailment WARNING 동기화 완료:
  - W-1/W-7: `3-error-handling.md §7.2` 에 큐 상태 API 별도 health 어휘 노트 추가.
  - W-2: `1-auth.md §3.2` RBAC 매트릭스에 System Status 행 + 전역 예외 각주.
  - W-3: `2-api-convention.md §2.3` 에 시스템 전역 API 예외 카테고리 + 첫 사례.
- **본 PR 범위 밖 (무관 기존 spec 결함, 별도 처리 필요)**:
  - W-4: `1-auth.md §1.5.4` 초대 에러코드 6개 lower_snake_case → UPPER_SNAKE 교정 필요.
  - W-5/W-6: `10-graph-rag.md` Overview/본문/Rationale 구조 정리 필요.
  - → scope 확대 방지를 위해 본 기능 PR 에서 건드리지 않음. 발견 사실만 기록.
- 후속 문서 동기화(구현 완료 단계): `data-flow/9-observability.md` 흐름 추가(I-1), `0-overview.md §8` 문서맵·§6.1 내비 등록(I-2).

## 작업 체크리스트

- [x] consistency-check --spec (이 draft) — BLOCK: NO
- [x] spec 반영 (A~E + WARNING/INFO 교정)
- [ ] spec commit
- [ ] consistency-check --impl-prep spec/2-navigation/ (또는 spec/5-system/)
- [ ] 구현 (backend system-status 모듈 + frontend `/system-status` 페이지)
- [ ] 사이드바 nav 순서 확인 — Statistics 다음, User Guide 앞 (Activity 아이콘) (W-10)
- [ ] KO/EN i18n dict 갱신 (`sidebar.systemStatus` + 페이지 문자열)
- [ ] unit/integration/e2e 테스트
- [ ] **구현 완료 후** `spec/0-overview.md §6.1` 내비게이션 완료 목록에 "시스템 상태" 추가 + spec frontmatter status 승격(spec-only→partial/implemented) + `code:` 실제 경로 기입 (W-7, W-2)
- [ ] ai-review + fix
