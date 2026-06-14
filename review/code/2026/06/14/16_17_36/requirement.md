# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] [SPEC-DRIFT] `reconcile()` 의 중복 로그 제거 — spec §9.3 내 로그 책임 기술 부재
- 위치: `terminal-revoke-reconciler.service.ts` — `reconcile()` 메서드 (diff: swept 로그 블록 제거)
- 상세: 이전 구현에서 `TerminalRevokeReconcilerService.reconcile()` 가 swept/revoked 수치를 중복으로 로그했으나, 이번 변경에서 reconciler 의 swept 로그를 제거하고 `InteractionTokenService.reconcileTerminalRevocations()` 단일 책임으로 통합했다. 구현 방향은 합리적이며 중복 로그를 제거한 의도적 개선이다. 그러나 spec §9.3 / EIA-RL-06 / R15 어디에도 "로그 책임은 InteractionTokenService 단일" 이라는 기술이 없어 spec 이 낡은 상태다.
- 제안: 코드 유지 (합리적 개선). spec §9.3 의 "Reconciliation sweep" 설명에 "sweep 결과 로그는 `InteractionTokenService.reconcileTerminalRevocations()` 가 단일 책임으로 남긴다" 를 추가하면 spec 이 완전해진다.

### [INFO] [SPEC-DRIFT] bounded-concurrency 병렬화 (`RECONCILE_CONCURRENCY=20`) — spec R15 미기술
- 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations()` 내 `Promise.allSettled` 청크 루프
- 상세: spec R15 는 `execution_token` 기반 reconciliation sweep 을 BullMQ repeatable + `revokeAllForExecution` 재사용으로 기술하지만, execution 단위 bounded-concurrency 병렬화(`RECONCILE_CONCURRENCY=20`) 는 언급하지 않는다. 이는 성능 개선을 위한 의도적 구현 세부사항으로 spec 이 낡은 것이다 (구현을 되돌리는 것이 오답).
- 제안: 코드 유지. spec R15 또는 §9.3 에 "execution 단위 bounded-concurrency (기본 20) 병렬화 — per-execution revoke 는 idempotent·fail-open 이라 병렬 안전" 을 기술하면 완전해진다.

### [INFO] [SPEC-DRIFT] `batchLimit` clamp 로직 — spec R15 / EIA §9.3 미기술
- 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations()` 내 `safeLimit` 계산 (`Math.min(Math.max(1, Math.floor(batchLimit)), RECONCILE_BATCH_MAX)`)
- 상세: spec EIA §9.3 / R15 는 sweep 의 배치 상한 개념을 언급하나(기본값 500), `[1, 1000]` clamp 규칙과 `RECONCILE_BATCH_MAX=1000` 상한은 spec 에 미기술이다. 구현의 방어적 입력 검증은 합리적 개선이다.
- 제안: 코드 유지. spec §9.3 또는 R15 에 "batchLimit 인자는 [1, 1000] 으로 clamp — 과대 입력 방어" 를 추가하면 spec 이 완전해진다.

### [INFO] `TERMINAL_STATUSES` 배열 동기화 — enum 확장 시 수동 갱신 필요
- 위치: `interaction-token.service.ts` L121–125 (`TERMINAL_STATUSES` 상수)
- 상세: `[COMPLETED, FAILED, CANCELLED]` 세 상태는 EIA-AU-04 의 "execution 종료(completed/failed/cancelled)" 정의 및 EIA-RL-06 과 완벽히 일치한다. 단 JSDoc 주석("enum 확장 시 본 배열 동기화")이 명시하듯, `ExecutionStatus` enum 에 신규 terminal 상태가 추가될 경우 컴파일러 강제 없이 수동 동기화가 필요하다. 현재는 완전히 정확하다.
- 제안: 현재 구현 수용.

### [INFO] `@Processor(..., { concurrency: 1 })` — spec §9.3 "멀티 인스턴스 전역 1회" 와 보완적
- 위치: `terminal-revoke-reconciler.service.ts` — `@Processor(TERMINAL_REVOKE_RECONCILE_QUEUE, { concurrency: 1 })`
- 상세: spec §9.3 은 "BullMQ repeatable 은 Redis 중앙 스케줄에 단일 entry 로 등록돼 멀티 인스턴스에서도 전역 1회만 실행된다" 고 기술한다. `concurrency: 1` 은 동일 인스턴스 내 중복 실행을 방지하는 보완적 설정으로, spec 의 멀티 인스턴스 안전성 정책과 일치한다. 이전 concurrency 리뷰에서도 명시를 권고했던 항목이 반영된 것이다.
- 제안: 없음.

## 기능 완전성 평가

### 파일 1: `external-interaction.module.ts`
JSDoc Wire-up 목록에 `TerminalRevokeReconcilerService (EIA-RL-06 — terminal revoke at-least-once sweep, BullMQ repeatable)` 가 추가됐다. 이번 변경은 문서화 개선이며 기능 완전성에 영향 없다.

### 파일 2: `interaction-token.service.spec.ts`
세 신규 테스트 케이스:
1. `batchLimit=999_999` 과대 입력 → `limit(1000)` clamp 단언 — batchLimit 상한 clamp 검증 완전.
2. `ttl <= 0` 만료 jti → `redis.set` 미호출 (`revoked:0`) — 이미 만료된 토큰의 blacklist skip 경로 검증 완전.
3. distinct/select/limit(500) 단언 추가 — QueryBuilder 체이닝 단언 완전.

`ttl <= 0` 케이스에서 `result.swept === 1` (행 처리됨) 이고 `result.revoked === 0` (blacklist SET 불필요) 임을 검증하는 것은 만료 토큰 skip 최적화 경로의 정확한 동작을 증명한다.

### 파일 3: `interaction-token.service.ts`
- 모든 상수 추출 완전 (`RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY`, `TERMINAL_STATUSES`, `REMOVE_ON_*_AGE_SEC`).
- `safeLimit` clamp 로직: `Math.min(Math.max(1, Math.floor(batchLimit)), RECONCILE_BATCH_MAX)` — 음수·비정수·과대값 모두 방어. [1, 1000] 범위 내 정수 보장.
- `TERMINAL_STATUSES` 상수 참조 — EIA-AU-04 / EIA-RL-06 의 terminal status 정의와 정확히 일치.
- bounded-concurrency `Promise.allSettled` 루프 — CONCURRENCY=20 청크 단위. `forEach` 내 fulfilled/rejected 분기로 fail-open 동작 유지. warn 로그에 `chunk[idx].executionId` 로 정확한 실패 executionId 추적.

반환값 경로:
- `!this.executionTokenRepository` → `{ swept: 0, revoked: 0 }` 조기 반환 ✓
- `rows.length === 0` → 루프 미진입 → swept=0, revoked=0 ✓
- 정상 처리 → `rows.length` swept, accumulated revoked 반환 ✓
- 전체 execution throw → fail-open, revoked=0, swept=rows.length ✓

### 파일 4: `terminal-revoke-reconciler.service.spec.ts`
두 신규 테스트:
1. `reconcile()` 직접 호출 성공 — `reconcileTerminalRevocations` 위임 1회 단언 ✓
2. `reconcile()` throw swallow — `resolves.toBeUndefined()` 단언으로 fail-open 검증 ✓

`process` 경유 간접 검증 + `reconcile` 직접 호출 검증 양쪽이 모두 갖춰졌다.

### 파일 5: `terminal-revoke-reconciler.service.ts`
- `@Processor(..., { concurrency: 1 })` — spec §9.3 멀티 인스턴스 정책과 일치하며 단일 인스턴스 내 중복 방지 의도 명시.
- `REMOVE_ON_COMPLETE_AGE_SEC`, `REMOVE_ON_FAIL_AGE_SEC` 상수 추출 — 가독성 개선.
- `reconcile()` JSDoc 추가 — fail-open 동작, sweep 결과 로그 단일 책임, public 가시성 이유 명시.
- reconciler 내 swept/revoked 중복 로그 제거 — `InteractionTokenService` 단일 책임 확립. spec EIA-RL-06 의 fail-open 정책 유지.

## Spec Fidelity 점검

관련 spec: `spec/5-system/14-external-interaction-api.md` (worktree 버전 기준 — EIA-RL-06, R15 모두 존재 확인됨)

| 코드 구현 | Spec 본문 | 판정 |
|-----------|-----------|------|
| `TERMINAL_STATUSES: [COMPLETED, FAILED, CANCELLED]` | EIA-AU-04 "execution 종료(completed/failed/cancelled)" · EIA-RL-06 동일 | 일치 |
| BullMQ repeatable `* * * * *` 스케줄 | §9.3 "분 단위 `* * * * *`" · R15 | 일치 |
| `@Processor(..., { concurrency: 1 })` | §9.3 "멀티 인스턴스 전역 1회는 Redis 단일 entry 가 보장" | 일치 (보완적) |
| `safeLimit` clamp `[1, 1000]` | spec §9.3 batchLimit 기본값 500 기술 — clamp 상한 1000 미기술 | [SPEC-DRIFT] INFO |
| `Promise.allSettled` bounded-concurrency 20 | R15 미기술 | [SPEC-DRIFT] INFO |
| reconciler swept 로그 제거 (token service 단일 책임) | spec 미기술 | [SPEC-DRIFT] INFO |
| `terminal-revoke-reconciler.service.ts` 파일명 | spec §10 line 762 에 등재됨 | 일치 |
| `reconcileTerminalRevocations` + `@param batchLimit` JSDoc | spec §9.3 / R15 기술과 일치 | 일치 |
| fail-open per-execution catch + warn 로그 | EIA-RL-06 "fail-open" 정책 | 일치 |
| `RECONCILE_BATCH_LIMIT=500` 기본값 | spec §9.3 "단일 sweep 당 처리 execution 수 상한(현 기본값 500)" | 일치 |
| `revokeAllForExecution` idempotent 재사용 | R15 "revoke 는 idempotent" 명시 | 일치 |

## TODO/FIXME 점검

변경된 파일들에서 TODO, FIXME, HACK, XXX 주석 없음. 미완성 작업 없음.

## 요약

이번 변경은 15:59:50 리뷰의 RESOLUTION에서 확약된 WARNING/INFO 픽스들 — W2(직렬 N+1 병렬화), W3(batchLimit clamp), W6(상한 검증), W7(reconcile 단독 테스트), I5/I6/I9(매직 넘버 상수화), I7/I18(reconcile JSDoc), I8(module JSDoc), I10(concurrency 명시), I14-I17(테스트 갭) — 을 올바르게 구현했다. EIA-RL-06 의 핵심 요구사항인 terminal status 3종 필터, distinct executionId 배치 처리, idempotent revokeAllForExecution 재사용, fail-open per-execution 처리, BullMQ repeatable 멀티 인스턴스 안전성은 완전히 유지되며 구현이 worktree spec 과 line-level 로 일치한다. 발견된 사항은 구현 개선이 spec 에 아직 반영되지 않은 SPEC-DRIFT INFO 3건 뿐으로, 코드 버그·요구사항 누락·spec 위반은 없다.

## 위험도

NONE
