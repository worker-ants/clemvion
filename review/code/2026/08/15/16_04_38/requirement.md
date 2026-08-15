# 요구사항(Requirement) Review — finalizeStalledExhausted 트랜잭션 원자화

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`finalizeStalledExhausted`, 3334-3413행)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (`describe('finalizeStalledExhausted (PR4)', …)`, 4858-5048행)
- 관련 spec: `spec/5-system/4-execution-engine.md` §7.1/§7.5/§Rationale ("PR4 — BullMQ stalled 자동 재배달")

## 발견사항

- **[INFO]** 첫 테스트(`Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다`)가 바로 위에 정의된 `installStalledTx` 헬퍼를 쓰지 않고 동일한 mock 배선(`execQb`/`nodeQb`/`qbs`/`managerCqb`/`txSpy`/트랜잭션-밖-throw 가드)을 손으로 한 번 더 반복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4914` (테스트 본문), 헬퍼 정의는 `:4879`
  - 상세: 기능·커버리지에는 영향 없음(양쪽 다 트랜잭션 경계를 정확히 검증) — 순수 중복. 헬퍼가 이 테스트 직전에 "자매 `installCancelTx` 와 동형"이라는 주석과 함께 도입됐는데 정작 이 첫 테스트만 재사용하지 않고 아래 두 테스트만 사용한다.
  - 제안: 이 테스트도 `installStalledTx(1)` 로 교체해 중복 제거(동작 변경 없음, 선택적 정리).

## 상세 분석

**기능 완전성 / 비즈니스 로직**: `finalizeStalledExhausted`가 `Execution` FAILED UPDATE 와 자식 `NodeExecution` RUNNING→FAILED cascade UPDATE 를 `this.dataSource.transaction`으로 원자화했다. 이는 이미 원자화돼 있던 자매 함수 `cancelParkedExecution`(1023행)·`markWebChatIdleTimeout`(1152행)과 **완전히 동형 패턴**(트랜잭션 안에서 `manager.createQueryBuilder()` 2회 → 커밋 후 best-effort 부수효과 → emit)이다. 커밋 이전 코드는 두 UPDATE 가 각각 autocommit 이라 첫 문장 커밋 후 둘째가 실패하면 자식 `NodeExecution`이 영구 `RUNNING`으로 잔류하는 결함이 있었고(자매 두 함수의 JSDoc 이 경고하던 바로 그 실패 모드), 이번 diff 로 셋 다 동일 보장을 갖게 됐다.

**엣지 케이스**: `affected=0`(이미 terminal) 분기는 트랜잭션 콜백 내부에서 `return`하여 자식 cascade UPDATE 를 아예 만들지 않는다(`finalized`는 `false`로 유지). 바깥의 `if (!finalized) return;`이 `finalizeRehydrationCleanup`·`emitExecution` 호출까지 스킵시켜 no-op 경로에서 부수효과·emit 이 발생하지 않음을 보장한다 — 스펙(§Rationale "setup-throw 경로는 이미 terminal 이라 affected=0 no-op")과 일치.

**반환값**: 함수 시그니처는 `Promise<void>`로 변경 없음. 모든 분기(RUNNING 마감/이미 terminal)에서 `void` 반환 일관.

**에러 시나리오**: `this.dataSource.transaction(...)`이 던지면(트랜잭션 콜백 내부 예외) 함수 전체가 reject 되고 캐치하지 않는다 — 이는 diff 이전 원본 함수도 동일했다(원본에도 try/catch 없음, `git show HEAD~1`로 확인). 호출부 `execution-run.processor.ts:88`의 `void this.engine.finalizeStalledExhausted(executionId).catch((err_) => {...})`가 예외를 흡수하므로 unhandled rejection 은 없다. 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)는 내부에 `try/catch(err){logger.error}`를 갖고 있어 스타일이 다르지만, 이는 이번 diff 가 만든 차이가 아니라 기존부터 있던 차이이므로 회귀가 아니다.

**spec fidelity**: 같은 커밋(`3e64f2a0a`)이 `spec/5-system/4-execution-engine.md`를 함께 갱신했다 — §7.1 표 각주(851행)에 "이 마감은 단일 트랜잭션이다(2026-08-15) … Execution 을 FAILED 로 쓰는 UPDATE 와 자식 RUNNING NodeExecution cascade UPDATE 가 dataSource.transaction 으로 묶인다"가 추가됐고, §Rationale(1462행)의 "PR4 — BullMQ stalled 자동 재배달" 절도 동일 문구로 갱신됐다. 구현·spec·테스트 세 축이 같은 커밋에서 동기 갱신됐으므로 SPEC-DRIFT 없음, 불일치 없음.

**TODO/FIXME**: 도입된 코드에 TODO/FIXME/HACK/XXX 없음 (grep 확인).

**테스트 검증**: `npx jest execution-engine.service.spec.ts -t "finalizeStalledExhausted"` 3개 테스트 전부 GREEN. 트랜잭션 밖 경로(`mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.createQueryBuilder`)를 호출 시 즉시 throw 하도록 무장한 mock 이 "다시 밖으로 나가는" 회귀를 구조적으로 차단한다(커밋 메시지가 주장하는 "뮤턴트 3/3 RED"는 이 가드로 뒷받침됨 — 실제 재현은 하지 않았으나 가드 설계상 타당). "이미 terminal" 테스트의 단언이 `mockNodeExecutionRepo.createQueryBuilder` 미호출(구조 변경으로 인해 트랜잭션 안에서는 이 경로 자체를 쓰지 않아 **항상 참**이 되는 vacuous 단언)에서 `managerCqb` 호출 횟수(1회) + `nodeQb.execute` 미호출로 교체된 점도 주석(`5040-5042`행)에 명시돼 있고 실제로 유효한 단언이다.

## 요약

`finalizeStalledExhausted`의 Execution/NodeExecution 이중 UPDATE 를 단일 `dataSource.transaction`으로 원자화한 변경으로, 자매 함수 두 개와 동형 패턴을 재사용해 부분 커밋(자식 NodeExecution 영구 RUNNING 잔류) 결함을 닫았다. `affected=0` no-op 분기·부수효과 스킵·emit payload 값 고정까지 정확히 구현·검증됐고, spec 문서(`spec/5-system/4-execution-engine.md`)가 같은 커밋에서 동기 갱신되어 spec-코드 불일치가 없다. 유일한 발견사항은 신규 테스트 하나가 직전에 도입한 헬퍼를 재사용하지 않고 코드를 중복시킨 INFO 수준의 유지보수성 이슈뿐이며, 기능·엣지케이스·에러 경로·spec 정합 모두 문제 없다.

## 위험도

NONE
