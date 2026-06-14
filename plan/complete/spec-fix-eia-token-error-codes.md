---
worktree: eia-token-codes-revoke-outbox-2639e5 (branch claude/eia-token-codes-revoke-outbox-2639e5)
started: 2026-05-29
completed: 2026-06-14
owner: project-planner
status: complete
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
code:
  - codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts
  - codebase/backend/src/modules/external-interaction/interaction-token.service.ts
---

> **완료 (2026-06-14)**: 사용자 결정 **D1=A · D2=A · D3=A**(AskUserQuestion). 결정 1·2 는 spec-only(구현이 이미 일치), 결정 3=A 는 본 PR 에서 **reconciler 구현까지 포함**(별도 후속 plan 불요). 아래 체크박스 전원 이행.
>
> - **결정 1·2 (spec)**: §5.1 `403 SCOPE_MISMATCH` → `401 TOKEN_SCOPE_MISMATCH`, `TOKEN_REVOKED`·`TOKEN_AUDIENCE_MISMATCH` 행 + `X-Refresh-Token-Url` 일반화 note + R14(401 통일 근거). 구현/e2e 무변경(이미 401).
> - **결정 3=A (spec + 구현)**: §3.4 EIA-RL-06 + §9.3 + R15(at-least-once via `execution_token` reconciliation, 전용 outbox 미신설). 구현: `TerminalRevokeReconcilerService`(BullMQ repeatable, 분 단위) + `InteractionTokenService.reconcileTerminalRevocations()`. unit(reconcile 4 + reconciler 4) + be lint·unit(6912)·build·e2e(191) ✓.
> - 동반 EIA nit 정비(consistency 14_51_58/15_42_23): requestId 예시·`@ApiSecurity` 제거·§3.3.1 v1 구현 반영·§7.3 execution_token·WS §4.6 URL·`VALIDATION_FAILED`→`VALIDATION_ERROR`(+details 배열, api-convention §5.3 정합).

# EIA — spec §5.1 토큰 에러 코드 정합 + terminal revoke 신뢰성 명시

> 작성일: 2026-05-29
> 출처: `review/code/2026/05/29/00_41_07/SUMMARY.md` (eia-jti-tracking 구현 중 ai-review 가 발견한 spec 갭)
> 관련 spec: [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §5.1 / §3.3 / §3.4 / §9.3

## 배경

`plan/complete/eia-jti-tracking.md` 구현 중 ai-review 가 코드와 spec 본문 간 불일치 2건 + 신뢰성 미명시 1건을 발견. 모두 **spec 수정 영역** (developer 권한 밖) 이라 별도 plan 으로 분리.

## 작업 단위

### 1. spec §5.1 에러 표에 `TOKEN_REVOKED` 추가

- [x] 현재 구현 `InteractionGuard.mapReason()` 는 blacklisted (terminal revoke) jti 에 대해 `401 TOKEN_REVOKED` 를 반환하나, spec §5.1 에러 표에 해당 코드가 누락. `401 Unauthorized | TOKEN_REVOKED | execution 종료(또는 refresh)로 토큰이 즉시 무효화됨` 행 추가.
- [x] `X-Refresh-Token-Url` 헤더 동봉 여부도 표/본문에 명시 (현 구현은 동봉).

### 2. `SCOPE_MISMATCH` HTTP status 정합 (spec 403 vs 구현 401)

- [x] spec §5.1 은 `403 Forbidden | SCOPE_MISMATCH`, 구현·e2e (test D) 는 `401 + TOKEN_SCOPE_MISMATCH`. 둘 중 하나로 통일 결정 필요.
- [x] 권장: 토큰류 실패는 모두 401 로 통일 (정보 노출 최소화 — §8.2 "algorithm leak 차단" 정신과 일치). 그 경우 spec §5.1 의 403 행을 401 `TOKEN_SCOPE_MISMATCH` 로 수정. 코드명도 `SCOPE_MISMATCH` → `TOKEN_SCOPE_MISMATCH` 로 spec 반영.
- [x] 결정 후 spec 수정 + (코드명 변경 시) developer 위임으로 guard·e2e 동기화.

### 3. terminal revoke 신뢰성 명시 (EIA-AU-04 vs 단일 RxJS 구독)

- [x] 현 구현: terminal 토큰 revoke 는 `NotificationFanout` 의 단일 in-memory RxJS 구독 (`executionEvents$`) 에 의존. process 재시작으로 in-flight terminal event 가 소실되면 revoke 누락 → 토큰이 ttl(기본 1h) 까지 잔존.
- [x] fail-open 정책 (Redis/DB 장애 시 warn 후 진행) 도 spec 에 의도적 트레이드오프로 명시되어 있지 않음.
- [x] §3.4 / §9.3 에 다음을 결정·명시: (a) at-least-once revoke 보장을 위한 outbox/after-commit 전환 여부, (b) revoke 실패 시 알람 에스컬레이션 정책, (c) 잔여 위험(ttl 단축 등) 허용 범위.
- [x] 결정이 outbox 전환이면 후속 구현 plan 신설.

## 수용 기준

- spec §5.1 에 `TOKEN_REVOKED` 명시, `SCOPE_MISMATCH` status/code 가 구현과 일치
- terminal revoke 신뢰성·fail-open 트레이드오프가 §3.4/§9.3 에 문서화
- 코드명 변경이 수반되면 guard·e2e 동기화 (developer 위임)

## 결정 옵션 (2026-06-13)

> 본 절은 위 「작업 단위」 1·2·3 의 inline 권장 라인을 정식 옵션/장단점/권장/트레이드오프로 확장한 것이다. 기존 체크박스·권장 라인은 그대로 유지하며, 본 절이 그 판단 근거를 보강한다.

### 결정 1 — §5.1 에러 표에 `TOKEN_REVOKED` 행 + `X-Refresh-Token-Url` 헤더 명시

**맥락**: 구현 `InteractionGuard.mapReason()` 는 blacklist (terminal revoke) 된 jti 의 `'blacklisted'` reason 을 `TOKEN_REVOKED` 로 매핑한다 ([`interaction.guard.ts:177-178`](../../codebase/backend/src/modules/external-interaction/interaction.guard.ts)). 이 코드는 spec §5.1 에러 표 (14-external-interaction-api.md:311-321) 에 행이 없다 — 표에는 `TOKEN_INVALID` / `TOKEN_EXPIRED` (401), `SCOPE_MISMATCH` (403) 만 존재. 또한 `deny()` 는 모든 401 응답에 `X-Refresh-Token-Url` 헤더를 무조건 첨부하나 ([`interaction.guard.ts:159-167`](../../codebase/backend/src/modules/external-interaction/interaction.guard.ts)), spec §5.1 의 헤더 명시는 `TOKEN_INVALID/TOKEN_EXPIRED` 행에만 괄호로 달려 있다 (14-...:315). EIA-AU-06 (§3.3, 14-...:95) 은 "토큰 무효/만료 시" 헤더 안내를 권장으로 규정 — revoke 도 "무효" 의 한 갈래이므로 헤더 동봉이 일관적이다.

- **옵션 A — `TOKEN_REVOKED` 행 추가 + 헤더 범위 명문화 (doc-only)**: §5.1 표에 `401 Unauthorized | TOKEN_REVOKED | execution 종료(또는 refresh)로 토큰이 즉시 무효화됨 (응답 헤더 X-Refresh-Token-Url 동봉)` 행을 추가하고, §5.1 의 헤더 노트를 "모든 401 토큰 실패 응답에 X-Refresh-Token-Url 동봉" 으로 일반화. 코드 무변경.
  - **장점**: 구현이 이미 이렇게 동작하므로 코드/e2e 변경 0. spec 이 실측 동작을 따라가는 순수 정합. EIA-AU-06 과 §5.1 표 간 헤더 안내 누락 gap 동시 해소.
  - **단점**: 없음에 가까움. 다만 §5.1 표의 행 수가 늘어 401 코드가 3종(`TOKEN_INVALID`/`TOKEN_EXPIRED`/`TOKEN_REVOKED`)이 되어 클라이언트 분기 문서가 약간 길어짐.
- **옵션 B — `TOKEN_REVOKED` 를 별도 행 없이 `TOKEN_EXPIRED` 행에 통합 표기**: revoke 도 "더 이상 유효하지 않음" 으로 보고 표에 신규 행 없이 기존 행 설명에 "(revoke 포함)" 만 부기.
  - **장점**: 표가 짧게 유지됨.
  - **단점**: 코드는 실제로 `TOKEN_REVOKED` 라는 **별개 code 문자열**을 반환하므로 (mapReason 의 `'blacklisted'` 분기), 표의 code 열과 wire 의 `error.code` 가 불일치하게 됨 — 정합 목표에 역행. 클라이언트가 revoke (재발급 불가, execution 종료) 와 expired (refresh 가능) 를 구분 못 함.

**권장안**: **옵션 A**. 본 작업 단위의 성격은 "구현이 이미 내는 코드를 spec 에 반영" 이며 (배경: ai-review 가 발견한 spec 갭), 옵션 A 가 wire 와 표를 1:1 로 맞춘다. revoke 와 expired 의 의미 구분 (전자는 refresh 불가) 도 보존된다. inline 권장 라인 (작업 단위 1) 과 동일 방향.

**트레이드오프**: 비용 최소 — `project-planner` 가 §5.1 표 1행 추가 + §5.1 헤더 노트 1줄 일반화만 수행. developer 위임·코드 변경 없음. 저논쟁 doc-alignment 로, 결정 2·3 과 독립적으로 선반영 가능.

### 결정 2 — `SCOPE_MISMATCH` HTTP status/code 통일 (spec 403 vs 구현 401)

**맥락**: spec §5.1 표는 `403 Forbidden | SCOPE_MISMATCH | 토큰 scope 가 해당 execution 에 일치하지 않음` 으로 규정 (14-...:316). 구현은 scope 불일치 reason `'scope_mismatch'` 를 `TOKEN_SCOPE_MISMATCH` (401) 로 매핑하며 ([`interaction.guard.ts:179-180`](../../codebase/backend/src/modules/external-interaction/interaction.guard.ts), `deny()` 는 `UnauthorizedException`=401), e2e/unit 도 401 `TOKEN_SCOPE_MISMATCH` 를 단언한다 ([`interaction.guard.spec.ts:116`](../../codebase/backend/src/modules/external-interaction/interaction.guard.spec.ts)). 즉 **status (403 vs 401)** 와 **code 명 (`SCOPE_MISMATCH` vs `TOKEN_SCOPE_MISMATCH`)** 둘 다 불일치. §8.2 (14-...:640-645) 은 HMAC 실패 시 "누락/형식 오류/window 초과/검증 실패 모두 동일 401 — algorithm leak 차단" 원칙을 명문화 — 토큰 실패 표면도 동일 정신(어떤 토큰 속성이 틀렸는지 외부에 미세 구분 노출 최소화)을 따르는 것이 일관적이다.

- **옵션 A — 401 `TOKEN_SCOPE_MISMATCH` 로 통일 (spec 을 코드에 맞춤)**: §5.1 표의 403 행을 `401 Unauthorized | TOKEN_SCOPE_MISMATCH | 토큰 scope 가 해당 execution 에 일치하지 않음 (응답 헤더 X-Refresh-Token-Url 동봉)` 으로 수정. 코드명 `SCOPE_MISMATCH` → `TOKEN_SCOPE_MISMATCH` 도 spec 에 반영. 코드 무변경.
  - **장점**: 모든 토큰류 실패 (invalid/expired/revoked/scope/audience) 가 401 단일 status 로 수렴 → §8.2 algorithm-leak 차단 정신과 일치, 외부에 "토큰은 존재하나 권한만 부족(403)" 이라는 정보 노출을 줄임. 구현·e2e 무변경 (zero developer 비용). `mapReason` 의 `TOKEN_AUDIENCE_MISMATCH` (401) 와도 같은 prefix·status 계열로 정렬.
  - **단점**: HTTP 의미론상 "인증은 됐으나 인가 실패" 는 본디 403 — 순수 REST 시맨틱 관점에선 401 이 부정확하다는 비판 가능. 단 EIA 토큰은 execution-scoped 라 "다른 execution 토큰" 은 사실상 인증 실패에 가까워 401 정당화 여지 큼.
- **옵션 B — spec 의 403 `SCOPE_MISMATCH` 유지 + 코드/e2e 변경 (코드를 spec 에 맞춤)**: `mapReason` 이 `'scope_mismatch'` → `SCOPE_MISMATCH` 반환하도록 변경하고 `deny()` 를 403(`ForbiddenException`) path 로 분기. guard unit/e2e 단언도 403 `SCOPE_MISMATCH` 로 동기화.
  - **장점**: REST status 시맨틱 (403=인가 실패) 정석 준수. 클라이언트가 "토큰 자체는 유효하나 대상 execution 권한 없음" 을 status 만으로 구분.
  - **단점**: §8.2 의 정보 노출 최소화 정신과 충돌 (어떤 토큰이 어느 execution 에 valid 한지 403 vs 401 로 probing 가능). `deny()` 가 현재 401 전용 (`UnauthorizedException`) 이라 status 분기 도입 = guard 리팩토링 + 단언 spec 다수 수정 → developer 위임 필수, e2e 회귀 위험. 구현 변경 비용이 결정 1·결정 3 doc-only 대비 비대칭적으로 큼.

**권장안**: **옵션 A (401 통일)**. inline 권장 라인 (작업 단위 2) 및 §8.2 algorithm-leak 차단 정신과 일치한다. 핵심 근거: (1) EIA 토큰은 execution-scoped 이라 scope 불일치는 "이 리소스에 대한 인증 실패" 로 해석하는 것이 자연스럽고, (2) 모든 토큰 실패를 401 단일 표면으로 묶으면 외부 probing 표면이 줄며, (3) 구현·e2e 가 이미 401 `TOKEN_SCOPE_MISMATCH` 라 spec 1열 수정으로 정합 완료 — 가장 낮은 비용으로 코드·spec·e2e 가 동시에 일치.

**트레이드오프**: 옵션 A 채택 시 비용 = `project-planner` 의 §5.1 표 403 행 → 401 행 수정 1건 (status + code명). **developer 위임 불요** (코드가 이미 채택안과 일치). 만약 옵션 B 였다면 guard `deny()` status 분기 + `mapReason` 코드명 변경 + guard.spec/e2e 동기화 (developer 위임) + 기존 401 단언 회귀 리스크가 발생 — 본 권장이 이 downstream 비용을 회피한다. 단 결정 1 의 헤더 일반화와 묶어 §5.1 표를 한 번에 갱신하는 것이 효율적.

### 결정 3 — terminal revoke 신뢰성 (EIA-AU-04) + fail-open 정책 명시

**맥락**: terminal 토큰 revoke 는 `NotificationFanout` 이 `WebsocketService.executionEvents$` 단일 in-memory RxJS 스트림을 구독해 수행한다 ([`notification-fanout.service.ts:58-92`](../../codebase/backend/src/modules/external-interaction/notification-fanout.service.ts) — terminal event 시 `tokenService.revokeAllForExecution()`). 그 소스는 **plain `Subject`** (`new Subject<ExecutionChannelEvent>()`, [`websocket.service.ts:343`](../../codebase/backend/src/modules/websocket/websocket.service.ts); `executionEvents$` 는 그 Observable view, `:346`) — ReplaySubject 가 아니므로 버퍼가 없고, **process 재시작/크래시로 in-flight terminal event 가 소실되면 revoke 가 누락** 되어 토큰이 jti TTL (`IEXT_DEFAULT_TTL_SEC = 1h`, [`interaction-token.service.ts:34`](../../codebase/backend/src/modules/external-interaction/interaction-token.service.ts)) 까지 잔존한다. 또한 revoke 경로 전반이 **fail-open** 이다: `revokeAllForExecution` 의 Repository 미주입 시 no-op (`:296-298`), `revokePerExecution` 의 Redis 미가용/SET 실패 시 warn 후 진행 (`:221-236`), `NotificationFanout.handle` 의 revoke 실패도 warn 후 fanout 계속 (`notification-fanout.service.ts:87-91`). 이 fail-open 트레이드오프 자체는 §8.3 토큰 일반 규약 (14-...:649-654) 에 "Redis down 시 blacklist 검사 fail-open" 으로 일부 언급되나, §3.4 신뢰성 표·§9.3 발송 순서 절에는 revoke 누락의 잔여 위험·알람 정책이 명시돼 있지 않다. §9.3 (14-...:730) 은 dispatcher 를 "after-commit hook (또는 outbox pattern 의 별도 worker — 구현 선택)" 으로 규정해 outbox 를 허용은 하나 revoke 채널엔 적용돼 있지 않다.

- **옵션 A — at-least-once outbox / after-commit 전환**: terminal event 를 execution 상태 TX 와 같은 commit 에 outbox row 로 적재하고, 별도 worker 가 outbox 를 폴링해 `revokeAllForExecution` 을 at-least-once 로 보장 (process 재시작에도 미처리 outbox 가 남아 재시도). §9.3 의 "outbox pattern 별도 worker" 선택지를 revoke 채널에 실제 적용.
  - **장점**: revoke 누락의 근본 해소 — in-memory Subject 소실에 영향받지 않음. EIA-AU-04 "종료 시 즉시 invalidate" 를 신뢰성 있게 충족. notification dispatch 와 동일한 at-least-once 보장 모델로 수렴.
  - **단점**: 신규 인프라 (outbox 테이블 + 폴링 worker 또는 BullMQ 재사용) = 마이그레이션·운영 비용. revoke 가 "즉시" 에서 "polling latency 만큼 지연된 at-least-once" 로 약화 (수 초). spec 결정 + 별도 구현 plan 신설 + developer 대형 위임 필요 — 본 plan 의 범위(spec 정합)를 크게 초과.
- **옵션 B — 현행 in-memory revoke 유지 + TTL 단축 + revoke 실패 알람 에스컬레이션**: 아키텍처는 유지하되 (1) `IEXT_DEFAULT_TTL` 을 1h → 예: 15분으로 단축해 잔존 위험 window 를 축소, (2) `revokeAllForExecution` / `revokePerExecution` 의 fail-open warn 을 **메트릭/알람 에스컬레이션** (예: `revoke_failure_total` counter + 임계 초과 시 알람) 으로 격상해 누락을 관측 가능하게 함. §3.4 에 "revoke 는 best-effort 즉시 + 실패 시 TTL 잔여 위험, 알람으로 관측" 으로 명시.
  - **장점**: 신규 인프라 0 (TTL 상수 변경 + 알람 wiring 만). 잔여 위험을 정량적으로 줄이고(window↓) 운영 가시성을 확보. 본 plan 범위 내 소규모 developer 위임으로 종결 가능.
  - **단점**: 여전히 process 재시작 시 in-flight event 소실 가능 (근본 해소 아님 — 단축된 TTL 까지 토큰 잔존). TTL 단축은 정상 클라이언트의 refresh 빈도를 높여 (§5.5 refresh-token) UX·요청량에 영향. 알람은 탐지일 뿐 자동 복구 아님.
- **옵션 C — 현행 유지 + fail-open / 잔여 위험을 의도적 트레이드오프로 spec 명시만 (doc-only)**: 코드·TTL 무변경. §3.4 신뢰성 표에 신규 행 (예: `EIA-RL-06 terminal revoke 는 best-effort 즉시 — in-memory event 소실 / Redis·DB 장애 시 fail-open, 잔여 위험은 jti TTL(기본 1h)까지`) 추가 + §9.3 에 revoke 채널의 fail-open 근거 (시스템 가용성 > 단명 토큰 즉시성) 를 문서화.
  - **장점**: 비용 최소 (doc-only), 결정 1·2 와 동일 성격으로 한 번의 spec write 에 묶임. 현 동작과 spec 이 정합되어 ai-review 가 짚은 "신뢰성 미명시" gap 자체는 해소. 후속 하드닝(옵션 A/B)을 backlog 로 분리해 점진 진행 가능.
  - **단점**: 실질적 신뢰성 개선 없음 — 잔여 위험 (재시작 시 최대 1h 토큰 잔존) 이 그대로 남고, "문서화했으니 OK" 가 실제 보안 노출을 정당화하지 못한다는 비판 가능. 단명·execution-scoped 토큰이라 위험도가 낮다는 전제에 의존.

**권장안**: **본 plan 단계에서는 옵션 C (fail-open·잔여 위험 명시) 를 즉시 반영하고, 옵션 A (outbox 전환) 를 후속 하드닝 plan 으로 분리 신설** 한다. 근거: (1) 본 plan 의 수용 기준은 "신뢰성·fail-open 트레이드오프가 §3.4/§9.3 에 문서화" 이며 옵션 C 가 이를 정확히 충족 — 결정 1·2 와 같은 spec-only 작업으로 한 턴에 종결 가능. (2) at-least-once 가 바람직한 종착점이나 (옵션 A) 신규 인프라 + 대형 developer 위임이라 spec 정합 plan 에 끼워 넣으면 범위가 폭발하므로 별도 plan 이 옳다. (3) 옵션 B 의 TTL 단축은 UX·요청량 부작용이 있어, 알람 에스컬레이션 부분만 옵션 C 의 "fail-open 을 알람으로 관측" 권고에 흡수해 두고 TTL 변경은 outbox 후속 plan 에서 함께 판단한다. 즉 **C(now) → A(follow-up)**, B 의 알람 요소는 C 에 통합.

**트레이드오프**: 즉시 비용 = `project-planner` 의 §3.4 신뢰성 행 1건 추가 + §9.3 revoke 채널 fail-open 근거 문단 추가 (doc-only, developer 위임 불요). Downstream = (a) 옵션 A 를 채택할 후속 **구현 plan 신설** (outbox 테이블 마이그레이션 + worker, BullMQ 재사용 검토, developer 대형 위임) — 본 plan 의 작업 단위 3 마지막 체크박스 "결정이 outbox 전환이면 후속 구현 plan 신설" 과 연결. (b) fail-open 관측을 위한 revoke-failure 메트릭/알람 wiring 은 옵션 C 명시 시 권고 항목으로 기재하되 구현 시점은 후속 plan 으로 미룸. 잔여 보안 위험 (재시작 시 최대 TTL 토큰 잔존) 은 후속 plan 종료까지 명시적으로 수용된다.
