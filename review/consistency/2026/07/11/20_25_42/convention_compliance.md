# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md` (EIA-RL-07 / §R19)

> 검토 모드: --impl-done · scope=`spec/5-system/14-external-interaction-api.md` · diff-base=`origin/main`
> 참고: 호출 payload 에 동봉된 "정식 규약 모음"(`audit-actions.md`, `cafe24-api-catalog/**`)은 본 diff(공개
> 위젯 idle-wait reaper — `WebchatIdleReaperService`/`markWebchatIdleTimeout`/`WEBCHAT_IDLE_TIMEOUT`)와
> 직접 관련이 없어, `spec/conventions/**` 를 직접 열람해 실제 관련 규약(`error-codes.md`,
> `spec-impl-evidence.md`, `node-cancellation.md`) 과 `PROJECT.md §변경 유형 → 갱신 위치 매핑`(spec-impl-evidence.md
> 가 인용하는 companion 규약)을 기준으로 재확인했다.

## 발견사항

- **[WARNING] 신규 BullMQ 큐가 `system-status-api` spec §1 모니터링 큐 표에 미등재**
  - target 위치: `spec/5-system/14-external-interaction-api.md` 자체에는 문제 없음 — 갭은 **연동 필수
    갱신 위치**인 `spec/5-system/16-system-status-api.md §1 대상 큐 레지스트리` 표
  - 위반 규약: `PROJECT.md §변경 유형 → 갱신 위치 매핑` — "**신규 BullMQ 큐 추가** (`@Processor` 신설 +
    `MONITORED_QUEUES` 등록)" 행의 필수 갱신 위치 (c) `spec/5-system/16-system-status-api.md §1 모니터링
    큐 표`. 본 표는 `spec/conventions/spec-impl-evidence.md` 헤더가 명시적으로 인용하는 companion
    규약이라 본 검토 범위 안이다.
  - 상세: diff 는 (a) `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `WEBCHAT_IDLE_REAPER_QUEUE`
    등록, (b) `system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 에 `'webchat-idle-reaper'` 추가,
    (d) `spec/data-flow/0-overview.md` §3 큐 개수(18개) + §4 카탈로그 표(신규 row, line 205)까지는
    정확히 동기화했다. 그러나 (c) `spec/5-system/16-system-status-api.md §1` 의 큐 표(11번째 열
    `terminal-revoke-reconcile` 다음 등)에는 `webchat-idle-reaper` row 가 없다 — 형제 큐
    `terminal-revoke-reconcile` 은 등재돼 있는데 `webchat-idle-reaper` 만 누락됐다. 해당 문서 자체가
    "SoT 주의: 큐 목록의 단일 진실은 `spec/data-flow/0-overview.md §4`… 큐가 추가/삭제되면 카탈로그(§4)를
    먼저 갱신하고 본 레지스트리(코드 상수)를 **동기화**한다" 고 명시하며, 바로 아래에 과거 유사 drift
    사례(`agent-memory-extraction` 코드 미등재)를 "⚠ 구현 갭" 으로 자체 추적 중인 문서라, 같은 성격의
    누락이 재발한 것이다.
  - 제안: `spec/5-system/16-system-status-api.md §1` 표에 `webchat-idle-reaper | system | 1 (기본) |
    repeatable cron (1분) — …` row 를 `terminal-revoke-reconcile` row 와 동일 패턴으로 추가.
    (SoT 는 `data-flow/0-overview.md §4` 이므로 기능 정합성에는 영향 없으나, PROJECT.md 매핑 표가
    명시한 "필수 갱신 위치" 이며 문서 자체가 자기 갭을 추적하는 관례를 따르는 편이 좋다.)

- **[INFO] EIA-RL-07 요구사항 행이 grace window env var 이름·기본값을 명시하지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §3.4 `EIA-RL-07` 행 (line 145) — "grace
    window(env) 초과 시"
  - 위반 규약: 엄밀한 `spec/conventions/**` 항목은 없음 — 같은 문서·인접 spec 이 이미 확립한 서술
    관례(비교 대상: 본 문서 §8.3 `INTERACTION_JWT_SECRET`/`JWT_SECRET` 명시, `4-execution-engine.md
    §8`·§7.4 의 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`(기본 `300000`ms) 명시)와의 정합성 문제.
  - 상세: 실제 env var 는 `WEBCHAT_IDLE_REAP_GRACE_MS`(기본 3600000ms/1h, `.env.example` +
    `webchat-idle-reaper.types.ts`)인데 spec 행·R19 rationale 모두 "grace window(env)" 로만 지칭하고
    변수명·기본값을 적지 않는다. 사소하지만, 이 문서의 다른 모든 env-configurable 타임아웃은 변수명과
    기본값을 인라인으로 노출하는 것이 일관된 패턴이다.
  - 제안: EIA-RL-07 행 또는 §R19 본문에 `` `WEBCHAT_IDLE_REAP_GRACE_MS`(기본 3600000ms/1h) `` 를
    1회 명시.

- **[INFO] §10 구현 파일 구조 트리에 신규 파일 미반영**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §10 `구현 파일 구조` (line 839-876)
  - 위반 규약: 명시적 `spec/conventions/**` 규정은 없음 — 본 섹션 자체의 기존 관례(형제 기능
    `terminal-revoke-reconciler.service.ts` / `terminal-revoke-reconciler.types.ts` 를 파일트리에
    명시적으로 나열)와의 국소 일관성 문제.
  - 상세: 이번 PR 이 신설한 `webchat-idle-reaper.service.ts` / `webchat-idle-reaper.types.ts` (+
    `.spec.ts` 2종)가 §10 트리에 없다. EIA-RL-06 의 형제 파일들은 주석까지 달려 나열돼 있어 비대칭이다.
  - 제안: `terminal-revoke-reconciler.service.ts` / `.types.ts` 바로 아래에 `webchat-idle-reaper.service.ts
    # BullMQ repeatable scheduler (분 단위) — 공개 위젯 idle-wait 회수 (EIA-RL-07, §R19)` /
    `webchat-idle-reaper.types.ts # BullMQ 큐 이름 상수 + grace env resolver` 2줄 추가.

## 확인했으나 이상 없음 (참고)

- **에러 코드 명명** (`error-codes.md`): `WEBCHAT_IDLE_TIMEOUT` 은 `<DOMAIN>_<CONDITION>` 도메인 prefix
  권장(§1)·`UPPER_SNAKE_CASE` 표기를 따르며, `WEBCHAT_` prefix 선택 근거(Chat Channel `CHANNEL_*` 와의
  네이밍 혼동 회피)를 §R19 Rationale 에 명시적으로 남겼다 — §1 권장 수준을 충족하는 모범 사례. 카탈로그
  SoT(`3-error-handling.md §1`)에도 신규 코드가 정확히 반영됐고 WS 프로토콜 문서(`6-websocket-protocol.md`)
  의 `cancelledBy`/`error.code` 서술도 동기화됐다.
- **`cancelledBy` 닫힌 union**: 신규 값 추가 없이 기존 `'timeout'` 을 재사용하고 `error.code` 로만 세분화 —
  §R19 rationale 이 이 원칙(닫힌 union 비확장)을 명시적으로 채택 이유로 든다.
- **frontmatter (`spec-impl-evidence.md`)**: `status: partial` + `code: codebase/backend/src/modules/
  external-interaction/**` 글로브가 신규 파일(`webchat-idle-reaper.*`)을 이미 포괄 — `code:` 갱신 불요.
  `pending_plans:` 도 기존 항목 유지로 스키마 위반 없음.
- **Rationale 구조**: §R19 는 맥락→채택(신호/메커니즘 근거)→**기각 대안**(delayed job 방식)까지 갖춰
  `Rationale "기각된 대안" 은 실제 이력 필수` 원칙에 부합하는 형태이며, "결정 2026-07-11" 날짜도 오늘
  날짜와 일치한다. R15→R19 번호도 공백 없이 순차.
- **문서 3섹션 구조**: `## Overview (제품 정의)` → 본문(§3~§12) → `## Rationale` 순서 유지.
- **node-cancellation.md 비적용**: `markWebchatIdleTimeout` 은 `waiting_for_input`(park, 핸들러 미실행)
  execution 을 조건부 UPDATE 로 종결하는 경로라 `AbortSignal` 전파 컨벤션(in-flight RUNNING 노드 대상)의
  적용 대상이 아니다 — 형제 `markQueueWaitTimeout`/`cancelParkedExecution` 과 동일하게 그 컨벤션 범위
  밖이며, 미적용을 결함으로 보지 않는다.
- **큐 명명**: `WEBCHAT_IDLE_REAPER_QUEUE = 'webchat-idle-reaper'` 는 형제 `TERMINAL_REVOKE_RECONCILE_QUEUE
  = 'terminal-revoke-reconcile'` 와 동일한 `<CONST>_QUEUE` ↔ kebab-case 문자열 네이밍 패턴을 따른다.
- **API 문서 규약 (swagger.md)**: 본 diff 는 controller/DTO 를 추가·변경하지 않아 (신규 REST 엔드포인트
  없음, 순수 백그라운드 reaper) swagger 데코레이터·DTO 명명 검토 대상 자체가 없다.

## 요약

이번 diff(EIA-RL-07 공개 위젯 idle-wait reaper)에 대한 target spec(`14-external-interaction-api.md`)
자체의 정식 규약 준수도는 높다 — 에러 코드 명명(`error-codes.md`), 닫힌 union 비확장, frontmatter
lifecycle(`spec-impl-evidence.md`), 3섹션 구조, Rationale 기각 대안 서술까지 기존 확립된 패턴을 충실히
따르며 오히려 신규 prefix 선택 근거를 명시하는 등 모범적인 부분도 있다. 다만 `PROJECT.md §변경 유형 →
갱신 위치 매핑`의 "신규 BullMQ 큐 추가" 행이 요구하는 4개 필수 갱신 위치 중 3개(코드 레지스트리 · e2e
기대값 · data-flow 카탈로그)는 정확히 동기화됐으나 나머지 1개(`16-system-status-api.md §1` 모니터링 큐
요약 표)가 누락돼 해당 문서가 이미 자체 추적 중인 "코드 vs 표 drift" 패턴이 반복됐다. 그 외 env var
명시·구현 파일 구조 트리 갱신은 하드 규약이 아닌 문서 자체 관례 수준의 사소한 보완 사항이다.

## 위험도

LOW
