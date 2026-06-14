# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done  
대상 spec: `spec/5-system/14-external-interaction-api.md`  
diff-base: `fc5d832b`

---

## 발견사항

### [CRITICAL] EIA-RL-06 요구사항 ID — spec 에 존재하지 않는 ID 를 구현이 참조
- **target 신규 식별자**: `EIA-RL-06` (코드 주석·테스트 describe 블록에서 `[Spec EIA §3.4 EIA-RL-06]` 로 참조)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §3.4 신뢰성·일관성 표 — EIA-RL-01 ~ EIA-RL-05 만 존재. EIA-RL-06 행 없음 (라인 140–144)
- **상세**: 구현 diff 의 다음 위치들이 `EIA-RL-06` 을 spec anchor 로 인용한다.
  - `external-interaction.module.ts` 주석: `TerminalRevokeReconcilerService (EIA-RL-06 — terminal revoke at-least-once sweep)`
  - `interaction-token.service.ts` JSDoc: `[Spec EIA §3.4 EIA-RL-06 / §9.3 / §Rationale R15]`
  - `terminal-revoke-reconciler.service.ts` JSDoc: `[Spec EIA §3.4 EIA-RL-06 / §9.3 / §Rationale R15]`
  - 테스트 describe 블록: `reconcileTerminalRevocations — at-least-once sweep [Spec EIA §3.4 EIA-RL-06 / R15]`
  - `terminal-revoke-reconciler.service.spec.ts` describe: `TerminalRevokeReconcilerService [Spec EIA §3.4 EIA-RL-06 / R15]`
  
  이 ID 는 spec 에 없는 유령 ID 다. spec 과 코드가 끊어져 있어 spec-coverage audit 나 미래 spec 변경 시 어느 요구사항을 구현했는지 추적 불가.
- **제안**: `project-planner` 를 통해 `spec/5-system/14-external-interaction-api.md` §3.4 표에 EIA-RL-06 행을 추가하고, §Rationale 에 R14 또는 R15 (기존 R13 이후 번호 결정 필요) 절을 신설한다. 내용은 구현의 JSDoc (`execution_token` 이 durable outbox 역할, BullMQ repeatable 분 단위 sweep, 별도 outbox 테이블 불필요 결정 근거) 을 정식화.

---

### [CRITICAL] Rationale R15 — spec 에 존재하지 않는 Rationale 번호를 구현이 참조
- **target 신규 식별자**: `R15` (구현 JSDoc 에서 `§Rationale R15` 로 참조)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` Rationale 섹션 — R1 ~ R13 만 존재 (R14 도 없음). 마지막이 R13 (라인 977)
- **상세**: 구현 코드가 `§9.3 / §Rationale R15` 를 반복 인용하지만 spec 에 §9.3 내 R15 관련 서술도 없고 Rationale 섹션에 R14·R15 절도 없다. 앞의 EIA-RL-06 발견과 연동된 누락이다. R15 가 가리키는 내용(execution_token 을 outbox 대용으로 쓰는 결정, BullMQ repeatable sweep 채택 근거)은 현재 spec 어디에도 공식화되어 있지 않다.
- **제안**: EIA-RL-06 행 추가와 함께 Rationale R14 (또는 R15, 번호 확정 필요) 절을 신설해 "execution_token outbox 대용 결정, 별도 outbox 테이블 불필요, BullMQ repeatable 분 단위 sweep 채택 근거" 를 공식화한다.

---

### [WARNING] `TERMINAL_STATUSES` 상수명 동일 — 같은 모듈 폴더 내 서로 다른 타입으로 중복 선언
- **target 신규 식별자**: `TERMINAL_STATUSES: readonly ExecutionStatus[]` — `interaction-token.service.ts` 에 새로 추가된 모듈 레벨 상수
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/interaction.service.ts` 라인 33: `const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus>` — 같은 `external-interaction/` 폴더 내 다른 파일
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 710: `private static readonly TERMINAL_STATUSES = new Set<ExecutionStatus>([…])`
  - e2e 테스트 4개 파일에도 동일 이름 로컬 상수 존재
- **상세**: 런타임 충돌은 없다(각각 파일 스코프 또는 클래스 private static). 그러나 `external-interaction/` 폴더 안에만 같은 이름이 두 파일에 독립적으로 선언되고, 타입도 다르다(`ReadonlySet` vs `readonly []`). 같은 값(completed/failed/cancelled)을 두 곳에서 별도 선언하므로 향후 terminal 상태 목록이 바뀔 때 한 쪽만 갱신되는 drift 위험이 있다.
- **제안**: `external-interaction/` 폴더 내 공유 상수 파일(예: `interaction.types.ts`)에 단일 선언으로 통합하고 두 파일이 import 해 쓰도록 리팩토링. 타입도 통일(`ReadonlySet` 또는 `readonly []` 중 하나).

---

### [INFO] `REMOVE_ON_COMPLETE_AGE_SEC` / `REMOVE_ON_FAIL_AGE_SEC` — 기존 패턴과 인라인 값 혼용
- **target 신규 식별자**: `REMOVE_ON_COMPLETE_AGE_SEC = 24 * 60 * 60`, `REMOVE_ON_FAIL_AGE_SEC = 7 * 24 * 60 * 60` — `terminal-revoke-reconciler.service.ts` 모듈 상단
- **기존 사용처**: 기존 유사 서비스(`chat-channel-token-rotator.service.ts`, `makeshop-api.client.ts`, `cafe24-api.client.ts`)는 인라인 숫자 리터럴을 직접 사용하고 명명 상수 패턴을 쓰지 않는다
- **상세**: 충돌은 없다. 신규 파일은 개선된 방식(명명 상수)을 채택했으나 기존 BullMQ 서비스들과 일관성이 없다. 실질 영향 없음.
- **제안**: 참고 수준. 향후 프로젝트 공통 BullMQ 옵션 상수 파일을 만들 때 통합 고려.

---

## 요약

이번 구현(`TerminalRevokeReconcilerService`, `reconcileTerminalRevocations`, `TERMINAL_REVOKE_RECONCILE_QUEUE`)의 서비스명·큐명·메서드명 자체는 기존 코드베이스와 충돌하지 않는다. 그러나 코드 전체가 `EIA-RL-06`(§3.4)과 `R15`(§Rationale)를 spec anchor 로 참조하는데, 두 ID 모두 `spec/5-system/14-external-interaction-api.md`에 존재하지 않는다. spec-to-code traceability 가 단절되어 있어 향후 spec 변경·audit 시 해당 구현이 어느 요구사항을 충족하는지 추적 불가능하다. 이는 SDD 프로젝트의 단일 진실 원칙 위반이므로 CRITICAL 로 분류했다. 추가로 같은 `external-interaction/` 폴더 내 두 파일이 동일 이름·동일 값의 `TERMINAL_STATUSES` 상수를 서로 다른 타입으로 중복 선언하고 있어 drift 위험이 있다(WARNING).

## 위험도

HIGH
