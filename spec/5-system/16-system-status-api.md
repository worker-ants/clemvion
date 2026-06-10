---
id: system-status-api
status: implemented
code:
  - codebase/backend/src/modules/system-status/**
---

# Spec: 시스템 상태 API (큐 모니터링)

> 관련 문서: [Spec 실행 엔진](./4-execution-engine.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [비기능 요구사항 §5 관측성](./_product-overview.md#5-관측성observability) · [Spec API 컨벤션](./2-api-convention.md) · [데이터 흐름 §4 BullMQ 큐 카탈로그](../data-flow/0-overview.md#4-bullmq-큐-카탈로그) · [Spec 시스템 상태 화면](../2-navigation/15-system-status.md)

전체 시스템의 BullMQ 큐 상태를 **집계 카운트 + 파생 health** 로 노출하는 관측성 API. 개별 job 데이터(payload·jobId)는 노출하지 않는다.

## 1. 대상 큐 레지스트리

`SystemStatusModule` 은 단일 `QueueRegistry` 로 모니터링 대상 큐를 enumerate 한다. 각 엔트리는 `{ name, group, concurrency }` 메타를 가진다.

> **SoT 주의**: 큐 목록의 단일 진실은 [`spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그`](../data-flow/0-overview.md#4-bullmq-큐-카탈로그) 다. 아래 표는 **모니터링 그룹·concurrency 관점의 요약**이며, 큐가 추가/삭제되면 카탈로그(§4)를 먼저 갱신하고 본 레지스트리(코드 상수)를 동기화한다. `QueueRegistry` 는 각 큐 정의 모듈의 큐 이름 상수를 재사용해 문자열 중복을 피한다.

| name | group | concurrency | 비고 |
|------|-------|-------------|------|
| execution-run | execution | 1 (env `EXECUTION_RUN_WORKER_CONCURRENCY`) | Execution intake — 첫 active 세그먼트 work-stealing (intake 큐 burst 시 `waiting>0 && active===0` 일시 오탐 가능) |
| background-execution | execution | 1 (기본) | Background 노드 자식 흐름 |
| execution-continuation | execution | 1 (env `CONTINUATION_WORKER_CONCURRENCY`) | 사용자 입력 fan-out |
| document-embedding | knowledge-base | 3 | 문서 임베딩 |
| graph-extraction | knowledge-base | 2 | entity/relation 추출 |
| notification-webhook | integration | 1 (기본) | outbound 웹훅 |
| cafe24-token-refresh | integration | 1 (기본) | Cafe24 토큰 갱신 |
| makeshop-token-refresh | integration | 1 (기본) | MakeShop 토큰 갱신 (proactive + reactive_401) |
| schedule-execution | system | 1 (기본) | 스케줄 트리거 실행 |
| login-history-pruner | system | 1 (기본) | repeatable cron |
| notification-secret-rotator | system | 1 (기본) | repeatable cron |
| chat-channel-token-rotator | system | 1 (기본) | repeatable cron |
| integration-expiry-scanner | system | 1 (기본) | repeatable cron (6h) |
| alerts-evaluator | system | 1 (기본) | repeatable cron (5분) |
| agent-memory-extraction | knowledge-base | 2 | Agent Memory 턴 경계 비동기 추출 ([data-flow §4](../data-flow/0-overview.md), [Agent Memory §3](./17-agent-memory.md)) |

> concurrency 가 코드 worker 옵션에 명시되지 않은 큐는 BullMQ 기본값 1 로 본다.
>
> ⚠ **구현 갭**: 코드의 `MONITORED_QUEUES` (`system-status.constants.ts`) 에는 `makeshop-token-refresh` 와 `agent-memory-extraction` 이 아직 미등재 — 본 표(모니터링 대상 선언)와 코드 레지스트리의 동기화가 필요하다 (2026-06-10 감사 보고 V-15 추적).

## 2. API

### GET /api/system-status/overview

- 인증: JWT (`@ApiBearerAuth('access-token')`). **admin role 가드 없음** — 집계 카운트만 반환하므로 워크스페이스·유저 식별 불가 (§4 보안).
- **워크스페이스 스코핑 예외**: 본 API 는 시스템 전역 상태를 반환하므로 [API 컨벤션 §2.3](./2-api-convention.md#23-워크스페이스-스코핑) 의 `X-Workspace-Id` 스코핑을 적용하지 않는다 (헤더가 와도 무시). 응답은 모든 워크스페이스를 가로지르는 합산값이다.
- 응답: `{ data: SystemStatusOverviewDto }` (전역 `TransformInterceptor` 의 `{data}` 래핑 준수).

```ts
SystemStatusOverviewDto {
  generatedAt: string;                      // ISO8601, 응답 생성 시각
  overall: "healthy" | "degraded" | "down"; // 큐 health 의 최악값 집계
  totalFailed: number;                      // 전 큐 failed(보관 중 누적) 합산
  totalRecentFailed: number;                // 전 큐 recentFailed(최근 윈도우) 합산
  recentFailedCapped: boolean;              // 큐 중 하나라도 스캔 캡 소진으로 하한값이면 true (집계 OR)
  failedWindowMinutes: number;              // recentFailed 산정 윈도우(분). env SYSTEM_STATUS_FAILED_WINDOW_MINUTES, 기본 60
  queues: QueueStatusDto[];
}

QueueStatusDto {
  name: string;
  group: "execution" | "knowledge-base" | "integration" | "system";
  counts: { waiting: number; active: number; delayed: number; failed: number; paused: number; };
  recentFailed: number;                     // 최근 윈도우 내 finishedOn 기준 실패 수 (스캔 캡 도달 시 하한값)
  recentFailedCapped: boolean;              // 이 큐의 recentFailed 가 스캔 캡 소진으로 종료돼 하한값인지 여부
  concurrency: number;
  utilization: number;                      // active / concurrency, 소수 2자리. concurrency=0 이면 0
  isPaused: boolean;
  health: "healthy" | "degraded" | "down";
}
```

- **`failed`(및 `totalFailed`) 의 의미**: lifetime 누적이 아니라 **각 큐의 `removeOnFail` 보관기간 내에 현재 보관 중인 실패 job 수**다. 보관정책은 큐마다 다르다 (`execution-continuation` 은 `removeOnFail: false` 로 무한 보관, 그 외 100건/5분/7일/30일 등). 그래서 UI 는 이 값을 "누적(보관 중)" 으로 라벨한다.
- **`recentFailed` 의 의미**: `queue.getFailed()` 로 가져온 실패 job 중 `finishedOn >= now - failedWindowMinutes*60_000` 인 수. "지금 정상인가" 를 답하는 주 지표다.
- **구현 / 비용**:
  - `waiting/active/delayed/failed/paused` 집계는 종전대로 큐별 `queue.getJobCounts(...)` + `queue.isPaused()` (큐당 상수 비용).
  - `recentFailed` 산정을 위해 큐마다 `queue.getFailed()` 를 **newest→역순으로 스캔**해 `finishedOn` 이 윈도우를 벗어나면 중단한다. 따라서 추가 비용은 더 이상 상수가 아니라 **윈도우 내 실패 수 + 스캔 캡에 비례**한다.
  - 큐당 스캔 상한(캡) env `SYSTEM_STATUS_FAILED_SCAN_CAP`(기본 1000). 캡 **소진**으로 스캔이 종료되면(윈도우 경계·실패 집합 끝이 아님) `recentFailed` 는 **하한값**이고 `recentFailedCapped=true` 로 표시한다. 윈도우 경계나 집합 끝에서 자연 종료되면 `recentFailedCapped=false`(정확값). 클라이언트는 이 플래그가 참일 때 수치를 "N+"(하한값)로 렌더한다. `SystemStatusOverviewDto.recentFailedCapped` 는 큐별 플래그의 OR 집계다.
  - 윈도우는 보관기간보다 짧게 운영하는 것을 전제로 한다 (기본 60분 ≪ 대부분 큐 보관기간). 보관기간이 윈도우보다 짧은 큐(`cafe24-token-refresh` 5분)는 `recentFailed` 가 보관분으로 제한될 수 있다.
  - 큐 enumerate 는 `QueueRegistry`.
- 단일 큐가 Redis 오류로 조회 실패해도 전체 응답이 죽지 않도록, 해당 큐는 `health: "down"` + counts 0(`recentFailed` 0) 으로 degrade 표기하고 나머지는 정상 반환한다.

## 3. health 파생 규칙

큐 단위 `health` 는 다음 순서로 평가한다 (휴리스틱):

1. `isPaused === true` → **down**
2. `waiting > 0 && active === 0` → **down** (워커 미가동 추정 — 단일 스냅샷 휴리스틱이라 idle 한 concurrency=1 큐에서 일시 오탐 가능. UI 는 "점검 필요(추정)" 뉘앙스로 표기하고 단정하지 않는다. Rationale R-3)
3. `recentFailed >= getFailedDegradedThreshold()` 또는 `delayed >= getDelayedDegradedThreshold()` → **degraded**
4. 그 외 → **healthy**

- 규칙 1·2 는 변경 없다. 규칙 2 의 워커 미가동 판정(R-3)은 `recentFailed` 와 **독립 동작**한다.
- getter ↔ env 매핑: `getFailedDegradedThreshold()` ← `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1), `getDelayedDegradedThreshold()` ← `SYSTEM_STATUS_DELAYED_THRESHOLD`(기본 50). 기본값은 운영 경험으로 재조정 가능. (모듈 로드 순서·테스트 격리 영향을 받지 않도록 모듈 스코프 상수 대신 getter 로 평가 — 2026-06-10 dead code 제거에서 deprecated 상수 export `FAILED_DEGRADED_THRESHOLD`/`DELAYED_DEGRADED_THRESHOLD` 폐기. 의미·env 키 불변.)
- 본 API 의 관련 env 일람: `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1), `SYSTEM_STATUS_DELAYED_THRESHOLD`(기본 50), `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`(기본 60, `recentFailed` 윈도우), `SYSTEM_STATUS_FAILED_SCAN_CAP`(기본 1000, 큐당 getFailed 스캔 상한). 모두 음수·0 입력 시 안전값으로 폴백(§2).
- **의미 변경 주의**: `SYSTEM_STATUS_FAILED_THRESHOLD` 의 비교 대상이 기존 "보관 중 누적 `failed`" 에서 **"최근 윈도우 `recentFailed`"** 로 바뀐다. 기존 설정값을 유지해 배포하면 degraded 판정 동작이 달라질 수 있으므로 운영자는 설정값을 재검토한다 (R-5).
- `overall` 은 큐 health 의 최악값 (down > degraded > healthy).

## 4. 보안

- 응답에는 **전역 합산 정수 카운트만** 포함. job id·payload·workflow/execution/workspace 식별자가 일절 없다 → 특정 워크스페이스·유저 데이터를 식별할 수 없다.
- 따라서 모든 로그인 사용자에게 노출해도 정보 유출 위험이 없다. 사용자 매뉴얼(`NAV-UG-05`)이 전원 노출인 것과 동일한 노출 모델이다.

## Rationale

### R-1. 왜 개별 job 을 노출하지 않는가
BullMQ 큐는 워크스페이스 경계 없는 전역 인프라이고 job payload 에 실행 input·대화 내용 등 cross-workspace 민감정보가 들어있다. 개별 job 을 노출하면 워크스페이스 귀속(attribution)·payload 마스킹·권한 가드가 모두 필요해진다. 집계 카운트만 노출하면 이 문제들이 **구조적으로** 사라진다 — "정상 운영 여부" 라는 목적에 카운트·health 로 충분하므로 최소 노출을 택했다.

### R-2. 왜 throughput 시계열을 v1 에서 제외하는가
순간 카운트·포화도·health 로 "지금 정상인지" 는 답할 수 있다. throughput 추이는 BullMQ `metrics`(job hot-path 의 per-job 오버헤드) 또는 샘플링 cron(별도 저장·구성요소)이 필요하다. 부하 추이가 실제로 필요해지면 후속에서 **샘플링 cron 을 우선 검토**한다 (job 경로 무간섭·비용 상수·depth 추이까지 확보). 단, `recentFailed`(R-5)는 시계열이 아니라 **단일 윈도우 스냅샷**이라 별도 저장소 없이 이미 보관 중인 failed 집합을 필터링할 뿐이므로 본 결정과 모순되지 않는다.

### R-3. 워커 미가동 판정의 한계
`waiting>0 && active===0` 는 단일 스냅샷 휴리스틱이다. concurrency=1 큐가 마침 idle 한 순간 오탐할 수 있어 UI 는 "점검 필요(추정)" 뉘앙스로 표기한다. 정확한 워커 liveness 는 별도 heartbeat 가 필요하며 v1 범위 밖이다.

### R-4. health 어휘를 `healthy/degraded/down` 으로 둔 이유
기존 `/health` 엔드포인트는 binary `healthy | unhealthy` 다 ([`health.service.ts`](../../codebase/backend/src/modules/health/health.service.ts)). 큐 상태는 "적체는 있으나 처리 중(degraded)" 과 "처리 자체가 멈춤(down)" 을 구분할 가치가 있어 `unhealthy` 를 심각도 2단계로 분리했다. 정상 상태는 기존 어휘 `healthy` 를 그대로 유지해 일관성을 지켰다.

### R-5. 왜 실패 지표를 "최근 윈도우 + 누적(보관 중)" 으로 분화하는가
- **문제**: 스냅샷 지표(waiting/active/delayed/paused/utilization)는 이미 "현재 상태"지만 `failed` 만 보관 정책에 따라 누적되어 "전 기간 누적"처럼 읽혔다. "지금 정상인가" 라는 본 API 의 목적과 어긋났다.
- **누적이 진짜 lifetime 이 아닌 이유**: `getJobCounts('failed')` 는 BullMQ `removeOnFail` 보관 집합의 크기이고, 큐마다 보관정책이 달라(무한~5분) lifetime 합계가 아니다. 그래서 주 지표를 최근 윈도우 `recentFailed` 로 두고, 누적은 "보관 중" 임을 명확히 라벨해 참고치로만 병기한다.
- **상수 비용 전제 포기 (연속성)**: §2 의 "큐 수 비례 상수 비용" 문장은 설계 원칙이 아니라 getJobCounts 만 쓰던 시점의 **구현 관찰**이었다. 이번 개정으로 그 문장을 삭제·대체했다. `recentFailed` 는 `getFailed()` 스캔이 필요해 상수성을 포기하지만, "현재 상태 반영" 을 우선하고 스캔 캡(`SYSTEM_STATUS_FAILED_SCAN_CAP`)으로 비용 상한을 보장한다.
- **R-2 와의 대조**: R-2 의 throughput 추이는 별도 샘플링 cron·저장소가 필요하지만, `recentFailed` 는 단일 윈도우 스냅샷이라 별도 저장소가 불필요하다 — 시계열이 아니므로 R-2 의 v1 제외 결정과 충돌하지 않는다.
- **health 를 윈도우로 옮긴 이유**: degraded 가 "지금" 문제인지를 반영하도록 규칙 3 의 비교 대상을 `recentFailed` 로 바꿨다. 기존엔 보관 실패 1건만 있어도 영구 degraded 되는 오탐이 있었고, 윈도우 기준이면 최근 실패가 사라지면 자동 healthy 복귀한다. **트레이드오프**: 보관 중 누적 실패가 윈도우 밖으로 벗어나면 degraded 신호가 자동 소멸할 수 있다 — 이를 인지하고, 디버깅용으로 누적(보관 중)을 부 지표로 계속 병기하는 것으로 보완한다.
- **`recentFailedCapped` 를 별도 boolean 으로 둔 이유**: `recentFailed === scanCap` 단순 비교는 "정확히 캡과 같은 정상 케이스"와 "캡으로 잘린 케이스"를 구분하지 못한다. 스캔 종료 사유(윈도우 경계/집합 끝 vs 캡 소진)를 서버가 직접 추적해 정확한 하한값 신호를 준다. Overview 집계는 **보수적 OR**(하나라도 capped 면 시스템 전역 수치도 하한값일 수 있음)로 둬, 사용자가 "N+" 를 과소평가하지 않게 한다.
