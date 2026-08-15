# 요구사항(Requirement) Review — `finalizeStalledExhausted` 트랜잭션 원자화 (재검증)

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`finalizeStalledExhausted`, 3315-3423행)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (`describe('finalizeStalledExhausted (PR4)', …)`, 4858-5085행 부근)
- 관련 spec: `spec/5-system/4-execution-engine.md` §7.1 (851행 각주) / §Rationale "PR4 — BullMQ stalled 자동 재배달" (1462-1468행)
- 관련 plan: `plan/in-progress/eia-stalled-atomicity.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 갱신)

이 diff 는 `3e64f2a0a → 5ba4b125c → 749488801 → 0d9c6166f → a184edc00` 5개 커밋의 누적 결과이며, 이전 3라운드 리뷰(`16_04_38`, `16_19_26`, `16_31_53`)에서 지적된 WARNING 이 모두 해소된 이후의 상태다. 본 라운드는 그 누적 diff(`origin/main...HEAD`)를 처음부터 재검증했다.

## 검증 방법

코드를 읽는 것에 그치지 않고 실측했다:

1. `git diff origin/main...HEAD`로 실제 diff 를 직접 확인(프롬프트의 diff 생략 구간 보완).
2. `npx jest execution-engine.service.spec.ts` 전체 실행 — **454/454 통과**.
3. 뮤테이션 2건을 직접 주입해 판별력을 재현(스크래치 사본에서 원본 복원 후 진행, `git diff --stat` 로 원상복구 확인):
   - **트랜잭션 제거**(`dataSource.transaction` 콜백을 즉시-호출 IIFE 로 치환, `manager` 인자만 주입) → 관련 테스트 3건 전부 **RED**(`Cannot read properties of undefined (reading 'createQueryBuilder')` / `트랜잭션 밖 ... 사용` throw 미도달).
   - **예외 삼킴**(`await this.dataSource.transaction(...)` 을 `try { … } catch { return; }` 로 감쌈) → `트랜잭션 중간 실패는 삼키지 않고 던진다` 테스트가 **RED**(`Resolved to value: undefined`, 기대는 reject).
   - 두 뮤턴트 모두 원본으로 정확히 복원(`git diff` clean 확인 완료).

이는 plan(`eia-stalled-atomicity.md` "## 판별력") 과 RESOLUTION(`16_31_53`)이 주장한 "트랜잭션 제거 3/3 RED", "예외 삼킴 RED" 를 재현·확인한 것이다.

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** 이론적 race(부팅 backstop `recoverStuckExecutions` 와의 좁은 창)는 이번 diff 가 만들거나 넓힌 것이 아니라 JSDoc(3336-3343행)에 이미 "수용됨"으로 명시된 기존 노출이다. 트랜잭션화는 **두 자식 UPDATE 사이**의 원자성만 다루고 함수 **간** race 는 범위 밖 — 요구사항 범위 판단이 정확하다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3336-3343`
  - 상세/제안: 조치 불요. `spec/5-system/4-execution-engine.md` §Rationale "잔여 zombie race" 항목과 문구도 일치한다.

## 점검 관점별 확인

1. **기능 완전성**: 목표(부분 커밋 시 자식 `NodeExecution` 영구 `RUNNING` 잔류 방지)를 `dataSource.transaction` 원자화로 완전히 구현. `manager.createQueryBuilder()`만 트랜잭션 내부에서 사용하고(`executionRepository`/`nodeExecutionRepository` 직접 사용 금지가 테스트에서 throw 로 하드닝됨), 커밋 후 부수효과(cleanup·emit)를 분리한 구조가 자매 `cancelParkedExecution`(1023행)·`markWebChatIdleTimeout`(1152행)과 line-level 로 동형이다.
2. **엣지 케이스**: `affected===0`(이미 terminal) 은 트랜잭션 콜백 내부 `return`으로 두 번째 UPDATE 자체를 생성하지 않고(`finalized`는 `false` 유지), 바깥의 `if (!finalized) return;`이 로그·cleanup·emit 을 전부 스킵시킨다 — 원본의 no-op 의미론을 정확히 보존. 전용 테스트(`이미 terminal (affected=0) 이면 no-op`)가 `managerCqb` 1회 호출 + `nodeQb.execute` 미호출로 이를 검증한다(과거 "`mockNodeExecutionRepo.createQueryBuilder` 미호출" 이라는 vacuous-화된 단언을 실효 단언으로 교체한 것도 확인됨 — 리팩터링 후 그 mock 자체를 안 쓰게 돼 항상 참이 될 뻔했던 단언이었다).
3. **TODO/FIXME**: `git diff` 범위 내 grep 결과 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 함수 JSDoc이 "두 UPDATE 는 단일 트랜잭션", "함수 레벨 try/catch 는 의도적으로 없다(호출부 `.catch()` 가 흡수)"를 명시하고, 구현이 정확히 그 서술대로다 — 트랜잭션 콜백 예외를 잡지 않고 그대로 전파(위 뮤테이션 검증에서 확인).
5. **에러 시나리오**: 트랜잭션 콜백 내부에서 예외가 발생하면(`NodeExecution` UPDATE 실패 등) 함수 전체가 reject 되고, 종결 이벤트(`EXECUTION_FAILED`)는 나가지 않는다 — 신규 테스트로 잠겨 있고 뮤테이션 검증 완료. 유일 호출부 `execution-run.processor.ts` 의 `onFailed`(69행)가 `.catch()`로 흡수해 unhandled rejection 없음.
6. **데이터 유효성**: 내부 서비스 함수로 외부 입력 검증 대상 아님 — 해당 없음.
7. **비즈니스 로직**: WHERE 가드(`Execution: id + status='running'`, `NodeExecution: execution_id + status='running'`) 모두 테스트로 단언되어 있고(대상 오식별 방지), lock 순서(Execution → NodeExecution)가 두 자매와 동일해 교차 함수 데드락 위험을 늘리지 않는다.
8. **반환값**: `Promise<void>` 시그니처 유지, 모든 분기(RUNNING 마감/이미 terminal/예외)에서 일관된 동작.
9. **spec fidelity**: `spec/5-system/4-execution-engine.md` §7.1(851행)과 §Rationale(1462-1468행)이 같은 작업 범위에서 갱신되어 "이 마감은 단일 트랜잭션이다(2026-08-15) — Execution FAILED UPDATE 와 자식 RUNNING `NodeExecution` cascade UPDATE 가 `dataSource.transaction` 으로 묶인다" 문구가 코드와 line-level 로 정확히 일치한다. SPEC-DRIFT 없음.

## 요약

`finalizeStalledExhausted` 의 Execution/NodeExecution 이중 UPDATE 를 `dataSource.transaction` 으로 원자화한 이번 변경은 목적(부분 커밋에 의한 자식 NodeExecution 영구 RUNNING 잔류 방지)을 정확히 달성했다. 이전 3라운드 리뷰에서 지적된 항목(헬퍼 미재사용, WHERE 가드 미검증, Execution UPDATE 의 `id` 조건 미검증, 트랜잭션 중간 실패 테스트 부재)이 모두 코드/테스트에 반영돼 있음을 직접 실행(전체 454 테스트 통과)과 뮤테이션 재현(트랜잭션 제거 3/3 RED, 예외 삼킴 RED)으로 재확인했다. spec(`4-execution-engine.md` §7.1/§Rationale)도 같은 범위에서 갱신되어 구현과 line-level 로 일치하며, plan 문서(`eia-stalled-atomicity.md`)의 조치/판별력 claim 도 실측과 부합한다. 기능 완전성·엣지 케이스·에러 전파·반환값·비즈니스 규칙(WHERE 가드·lock 순서) 어느 항목에서도 결함이 발견되지 않았다.

## 위험도

NONE
