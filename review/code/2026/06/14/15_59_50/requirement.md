# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] [SPEC-DRIFT] spec §10 파일 구조 목록에 `terminal-revoke-reconciler.service.ts` 미등재
- 위치: `spec/5-system/14-external-interaction-api.md` §10 (line 752–781)
- 상세: spec §10 구현 파일 구조 목록에는 `external-interaction/` 디렉터리 아래의 파일들이 나열되어 있으나 신규 추가된 `terminal-revoke-reconciler.service.ts` 가 포함되어 있지 않다. 코드는 의도적으로 올바르게 추가된 것이며, spec §10 파일 목록이 갱신 누락된 상태다.
- 제안: 코드 유지. spec §10 의 `external-interaction/` 파일 목록에 `terminal-revoke-reconciler.service.ts  # BullMQ repeatable scheduler — terminal execution 의 잔존 interaction token reconciliation sweep (EIA-RL-06)` 행을 추가하여 spec 반영.

### [INFO] `onModuleInit` fail-fast 동작 vs spec 명시 간 세부 명세 부재
- 위치: `terminal-revoke-reconciler.service.ts` `onModuleInit`, `terminal-revoke-reconciler.service.spec.ts` line 30–32
- 상세: `onModuleInit` 에서 `upsertJobScheduler` 실패 시 에러를 전파해 부팅을 거부(fail-fast)한다. 테스트도 이를 단언한다. EIA-RL-06 / §9.3 / R15 본문은 reconciler 가 BullMQ repeatable scheduler 를 사용함을 명시하나, 부팅 시 scheduler 등록 실패 정책(fail-fast vs fail-open)은 spec 에 명시되어 있지 않다. 구현의 fail-fast 선택은 합리적이다(scheduler 미등록 상태에서 reconciliation 이 영구 비활성화되는 것이 더 위험). spec 이 침묵하는 영역이므로 INFO.
- 제안: 코드 유지. spec §9.3 / R15 에 "scheduler 등록 실패 시 부팅 중단(fail-fast)" 을 권고 사항으로 추가하면 명세가 완전해진다.

### [INFO] `reconcileTerminalRevocations` 의 `batchLimit` 기본값(500) spec 에 미명시
- 위치: `interaction-token.service.ts` `reconcileTerminalRevocations(batchLimit = 500)` 파라미터
- 상세: spec EIA-RL-06 / §9.3 / R15 는 "execution_token 과 terminal execution 을 join 해 잔존 토큰을 회수" 한다고 명시하나, 배치 크기 상한(500)은 spec 에 언급되지 않는다. 코드의 500 선택 자체는 합리적이나 spec 본문에 없다. spec 이 침묵하는 영역이므로 INFO.
- 제안: spec §9.3 / R15 에 "단일 sweep 당 처리 execution 수 상한(현 기본값 500)" 을 기술하면 완전해진다.

---

## 기능 완전성 평가

### 파일 1: `external-interaction.module.ts`
`TERMINAL_REVOKE_RECONCILE_QUEUE` 큐 등록과 `TerminalRevokeReconcilerService` 프로바이더 추가가 올바르게 이루어졌다. exports 에 추가되지 않은 것도 적절하다(내부 스케줄러 서비스는 외부 모듈에 공개할 필요 없음).

### 파일 2: `interaction-token.service.spec.ts` (reconcileTerminalRevocations 테스트)
4개 케이스가 요구사항을 충분히 커버한다:
- Repository 미주입 → no-op (swept:0, revoked:0)
- terminal execution 의 잔존 토큰 회수 (terminal status 필터, revokeAllForExecution 재사용)
- 잔존 토큰 없음 → no-op
- 개별 execution revoke 실패 → fail-open, 다음 execution 계속

`where` 절에 `completed`/`failed`/`cancelled` 세 status 가 포함되는지 단언하고 있어 EIA-RL-06 의 "execution 종료(completed/failed/cancelled)" 요구사항과 정확히 일치한다.

### 파일 3: `interaction-token.service.ts` (`reconcileTerminalRevocations`)
- Repository 미주입 시 early return (no-op) 올바름
- `innerJoin('et.execution', 'e')` + `e.status IN (:...terminal)` 로 terminal execution 과 join 올바름
- `select('et.executionId').distinct(true).limit(batchLimit)` 로 execution 별 deduplicate 후 배치 상한 올바름
- `revokeAllForExecution` 재사용으로 idempotent revoke 보장 올바름
- 개별 execution 실패 시 `catch + warn log + continue` (fail-open) 올바름
- `rows.length > 0` 일 때만 log — 매 분 빈 sweep 로그 방지

엣지 케이스:
- 빈 `rows` → 루프 미진입, `swept:0 revoked:0` 반환 올바름
- 이미 자연 만료된 jti 는 `revokeAllForExecution` 내부에서 `ttl <= 0` 분기로 skip 올바름
- `revokeAllForExecution` 자체가 idempotent(blacklist SET EX 재실행, row DELETE 재실행 무해) 올바름

### 파일 4: `terminal-revoke-reconciler.service.spec.ts`
4개 케이스가 요구사항을 충분히 커버한다:
- `onModuleInit` 이 분 단위 cron(`* * * * *`) 스케줄러를 등록
- scheduler 등록 실패 → 예외 전파 (fail-fast)
- `process` → `reconcileTerminalRevocations` 위임
- reconcile 실패 → swallow (fail-open, `process` 는 throw 안 함)

### 파일 5: `terminal-revoke-reconciler.service.ts`
- `@Processor(TERMINAL_REVOKE_RECONCILE_QUEUE)` + `WorkerHost` 상속으로 BullMQ 워커 패턴 올바름
- `upsertJobScheduler` 는 idempotent 이므로 멀티 인스턴스에서 중복 등록 안전
- `process` → `reconcile` 분리 설계로 `reconcile` 을 직접 테스트·호출 가능
- `reconcile` 내부 catch 로 실패를 swallow — spec §9.3 의 "다음 tick 재시도" 의도와 일치
- `removeOnComplete: { age: 24h }`, `removeOnFail: { age: 7d }` — 운영 관리 측면에서 합리적

### 파일 6: `plan/complete/spec-fix-eia-token-error-codes.md`
plan 추적 문서. status: complete, 체크박스 전원 이행. frontmatter 필드(worktree, started, completed, owner, status, spec_impact, code) 모두 정확히 기록.

## Spec Fidelity 점검

관련 spec: `spec/5-system/14-external-interaction-api.md` (worktree 버전 기준)

| 코드 참조 | Spec 본문 상태 | 판정 |
|-----------|--------------|------|
| `EIA-RL-06` (코드 주석) | worktree spec §3.4 line 145 에 존재 | 일치 |
| `R15` (코드 주석) | worktree spec §Rationale line 1012 에 존재 | 일치 |
| `completed/failed/cancelled` terminal status | EIA-RL-06 명시 | 일치 |
| BullMQ repeatable `* * * * *` | §9.3 line 744 "분 단위 `* * * * *`" | 일치 |
| `execution_token` 을 outbox 로 재사용 (별도 outbox 미신설) | R15 명시 | 일치 |
| 멀티 인스턴스 전역 1회 | EIA-RL-06 / R15 명시 | 일치 |
| `terminal-revoke-reconciler.service.ts` 파일 존재 | spec §10 파일 목록 미등재 | [SPEC-DRIFT] INFO |
| `TOKEN_REVOKED`(401) 코드 | worktree spec §5.1 line 317 에 존재 | 일치 |
| `TOKEN_SCOPE_MISMATCH`(401) 코드 | worktree spec §5.1 line 318 에 존재 | 일치 |

worktree 의 spec 은 구현과 충분히 일치한다.

## TODO/FIXME 점검

변경된 파일들에서 TODO, FIXME, HACK, XXX 주석 없음. 미완성 작업 없음.

## 요약

5개 코드 변경 파일 모두 의도한 기능(terminal revoke at-least-once 보장 — EIA-RL-06)을 완전하게 구현하고 있다. `reconcileTerminalRevocations` 는 terminal execution 과의 DB join, distinct executionId, 배치 상한, fail-open per-execution 처리, idempotent revoke 재사용을 올바르게 구현했으며, `TerminalRevokeReconcilerService` 는 BullMQ repeatable scheduler 를 통해 분 단위로 이를 호출하는 어댑터 역할을 명확히 분리했다. 모듈 등록(`external-interaction.module.ts`)도 큐와 프로바이더 양쪽이 올바르게 추가됐다. 테스트 커버리지는 경계값(repository 미주입, 빈 결과, fail-open, fail-fast)을 충분히 다룬다. 발견된 사항은 spec §10 파일 목록 갱신 누락(INFO/SPEC-DRIFT) 1건과 spec 침묵 영역 INFO 2건으로, 코드 버그 또는 요구사항 누락은 없다.

## 위험도

NONE
