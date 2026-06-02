---
id: system-status-api
status: spec-only
code: []
pending_plans:
  - plan/in-progress/system-status-page.md
---

# Spec: 시스템 상태 API (큐 모니터링)

> 관련 문서: [Spec 실행 엔진](./4-execution-engine.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [비기능 요구사항 §5 관측성](./_product-overview.md#5-관측성observability) · [Spec API 컨벤션](./2-api-convention.md) · [데이터 흐름 §4 BullMQ 큐 카탈로그](../data-flow/0-overview.md#4-bullmq-큐-카탈로그) · [Spec 시스템 상태 화면](../2-navigation/15-system-status.md)

전체 시스템의 BullMQ 큐 상태를 **집계 카운트 + 파생 health** 로 노출하는 관측성 API. 개별 job 데이터(payload·jobId)는 노출하지 않는다.

## 1. 대상 큐 레지스트리

`SystemStatusModule` 은 단일 `QueueRegistry` 로 모니터링 대상 큐를 enumerate 한다. 각 엔트리는 `{ name, group, concurrency }` 메타를 가진다.

> **SoT 주의**: 큐 목록의 단일 진실은 [`spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그`](../data-flow/0-overview.md#4-bullmq-큐-카탈로그) 다. 아래 표는 **모니터링 그룹·concurrency 관점의 요약**이며, 큐가 추가/삭제되면 카탈로그(§4)를 먼저 갱신하고 본 레지스트리(코드 상수)를 동기화한다. `QueueRegistry` 는 각 큐 정의 모듈의 큐 이름 상수를 재사용해 문자열 중복을 피한다.

| name | group | concurrency | 비고 |
|------|-------|-------------|------|
| background-execution | execution | 1 (기본) | Background 노드 자식 흐름 |
| execution-continuation | execution | 1 (env `CONTINUATION_WORKER_CONCURRENCY`) | 사용자 입력 fan-out |
| document-embedding | knowledge-base | 3 | 문서 임베딩 |
| graph-extraction | knowledge-base | 2 | entity/relation 추출 |
| notification-webhook | integration | 1 (기본) | outbound 웹훅 |
| cafe24-token-refresh | integration | 1 (기본) | Cafe24 토큰 갱신 |
| schedule-execution | system | 1 (기본) | 스케줄 트리거 실행 |
| login-history-pruner | system | 1 (기본) | repeatable cron |
| notification-secret-rotator | system | 1 (기본) | repeatable cron |
| chat-channel-token-rotator | system | 1 (기본) | repeatable cron |
| integration-expiry-scanner | system | 1 (기본) | repeatable cron (6h) |
| alerts-evaluator | system | 1 (기본) | repeatable cron (5분) |

> concurrency 가 코드 worker 옵션에 명시되지 않은 큐는 BullMQ 기본값 1 로 본다.

## 2. API

### GET /api/system-status/overview

- 인증: JWT (`@ApiBearerAuth('access-token')`). **admin role 가드 없음** — 집계 카운트만 반환하므로 워크스페이스·유저 식별 불가 (§4 보안).
- **워크스페이스 스코핑 예외**: 본 API 는 시스템 전역 상태를 반환하므로 [API 컨벤션 §2.3](./2-api-convention.md#23-워크스페이스-스코핑) 의 `X-Workspace-Id` 스코핑을 적용하지 않는다 (헤더가 와도 무시). 응답은 모든 워크스페이스를 가로지르는 합산값이다.
- 응답: `{ data: SystemStatusOverviewDto }` (전역 `TransformInterceptor` 의 `{data}` 래핑 준수).

```
SystemStatusOverviewDto {
  generatedAt: string;                      // ISO8601, 응답 생성 시각
  overall: "healthy" | "degraded" | "down"; // 큐 health 의 최악값 집계
  totalFailed: number;                      // 전 큐 failed 합산
  queues: QueueStatusDto[];
}

QueueStatusDto {
  name: string;
  group: "execution" | "knowledge-base" | "integration" | "system";
  counts: { waiting: number; active: number; delayed: number; failed: number; paused: number; };
  concurrency: number;
  utilization: number;                      // active / concurrency, 소수 2자리. concurrency=0 이면 0
  isPaused: boolean;
  health: "healthy" | "degraded" | "down";
}
```

- 구현: 큐별 `queue.getJobCounts('waiting','active','delayed','failed','paused')` + `queue.isPaused()`. 큐 enumerate 는 `QueueRegistry`. 추가 Redis 비용은 **큐 수에 비례하는 상수** (job 처리량과 무관 — getJobCounts 는 카운터 조회).
- 단일 큐가 Redis 오류로 조회 실패해도 전체 응답이 죽지 않도록, 해당 큐는 `health: "down"` + counts 0 으로 degrade 표기하고 나머지는 정상 반환한다.

## 3. health 파생 규칙

큐 단위 `health` 는 다음 순서로 평가한다 (휴리스틱):

1. `isPaused === true` → **down**
2. `waiting > 0 && active === 0` → **down** (워커 미가동 추정 — 단일 스냅샷 휴리스틱이라 idle 한 concurrency=1 큐에서 일시 오탐 가능. UI 는 "점검 필요(추정)" 뉘앙스로 표기하고 단정하지 않는다. Rationale R-3)
3. `failed >= FAILED_DEGRADED_THRESHOLD` 또는 `delayed >= DELAYED_DEGRADED_THRESHOLD` → **degraded**
4. 그 외 → **healthy**

- 임계값은 환경변수로 조정 가능: `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1), `SYSTEM_STATUS_DELAYED_THRESHOLD`(기본 50). 기본값은 구현 단계에서 운영 경험으로 재조정 가능.
- `overall` 은 큐 health 의 최악값 (down > degraded > healthy).

## 4. 보안

- 응답에는 **전역 합산 정수 카운트만** 포함. job id·payload·workflow/execution/workspace 식별자가 일절 없다 → 특정 워크스페이스·유저 데이터를 식별할 수 없다.
- 따라서 모든 로그인 사용자에게 노출해도 정보 유출 위험이 없다. 사용자 매뉴얼(`NAV-UG-05`)이 전원 노출인 것과 동일한 노출 모델이다.

## Rationale

### R-1. 왜 개별 job 을 노출하지 않는가
BullMQ 큐는 워크스페이스 경계 없는 전역 인프라이고 job payload 에 실행 input·대화 내용 등 cross-workspace 민감정보가 들어있다. 개별 job 을 노출하면 워크스페이스 귀속(attribution)·payload 마스킹·권한 가드가 모두 필요해진다. 집계 카운트만 노출하면 이 문제들이 **구조적으로** 사라진다 — "정상 운영 여부" 라는 목적에 카운트·health 로 충분하므로 최소 노출을 택했다.

### R-2. 왜 throughput 시계열을 v1 에서 제외하는가
순간 카운트·포화도·health 로 "지금 정상인지" 는 답할 수 있다. throughput 추이는 BullMQ `metrics`(job hot-path 의 per-job 오버헤드) 또는 샘플링 cron(별도 저장·구성요소)이 필요하다. 부하 추이가 실제로 필요해지면 후속에서 **샘플링 cron 을 우선 검토**한다 (job 경로 무간섭·비용 상수·depth 추이까지 확보).

### R-3. 워커 미가동 판정의 한계
`waiting>0 && active===0` 는 단일 스냅샷 휴리스틱이다. concurrency=1 큐가 마침 idle 한 순간 오탐할 수 있어 UI 는 "점검 필요(추정)" 뉘앙스로 표기한다. 정확한 워커 liveness 는 별도 heartbeat 가 필요하며 v1 범위 밖이다.

### R-4. health 어휘를 `healthy/degraded/down` 으로 둔 이유
기존 `/health` 엔드포인트는 binary `healthy | unhealthy` 다 ([`health.service.ts`](../../codebase/backend/src/modules/health/health.service.ts)). 큐 상태는 "적체는 있으나 처리 중(degraded)" 과 "처리 자체가 멈춤(down)" 을 구분할 가치가 있어 `unhealthy` 를 심각도 2단계로 분리했다. 정상 상태는 기존 어휘 `healthy` 를 그대로 유지해 일관성을 지켰다.
