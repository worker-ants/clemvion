# 요구사항(Requirement) Review — M-4 executeAsync setup 2차 실패 시 RUNNING 잔류 방지 (Option B)

## 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`executeAsync` 의 fire-and-forget catch 블록, L3383~L3407)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (신규 유닛 테스트 2건, L2198~L2274 부근)

## 검증 방법
- `plan/in-progress/refactor/06-concurrency.md` §M-4 원문 대조 (Option A/B 비교표, 권장안, spec 갱신 여부).
- `runExecutionFromQueue` (큐 경로, L2798~2859) 의 기존 catch 블록과 line-level 비교 — "동일 계약" 주석 검증.
- `failFirstSegmentSetup` (L497~531) 원 구현(W2 도입분) 재확인 — 이번 diff 는 신규 정의가 아니라 두 번째 호출부 추가.
- `spec/5-system/4-execution-engine.md` §7.1/§7.4/§8 stale-fail(30분), WAITING_FOR_INPUT 배제 규칙 대조.
- 실제 테스트 실행: `M-4` 태그 2건, `executeAsync` 전체 13건 — 전부 PASS.

## 발견사항

- **[INFO]** plan 체크박스 미동기화
  - 위치: `plan/in-progress/refactor/06-concurrency.md:171`
  - 상세: 커밋 `a18a8d5a0`("fix(engine): M-4 executeAsync setup 2차 실패 시 RUNNING 잔류 방지 (Option B)")가 이미 M-4 를 구현했으나, plan 파일의 `- [ ] 미착수` 체크박스가 아직 갱신되지 않았다. 코드 자체의 결함은 아니며 plan-lifecycle 문서화 누락.
  - 제안: plan 체크박스를 `[x] 완료`로 갱신하고 커밋/PR 참조를 덧붙인다(코드 리뷰 스코프 밖, developer 후속 커밋으로 처리 권장).

- **[INFO]** 이중 방어(defense-in-depth)로 인한 사실상 도달 불가 코드 경로
  - 위치: `execution-engine.service.ts:3396-3406` (및 대칭 위치 `runExecutionFromQueue` L2847-2857, 이번 diff 범위 밖이나 동일 패턴)
  - 상세: `failFirstSegmentSetup` 자신이 이미 내부 `try/catch`(L500-530)로 모든 실패를 흡수하고 절대 재throw 하지 않는다. 따라서 신규 추가된 외부 `.catch((secondaryErr) => ...)` 는 프로덕션 코드 경로상 도달 불가능하며, 오직 테스트가 `jest.spyOn(svc, 'failFirstSegmentSetup').mockRejectedValueOnce(...)` 로 내부 try/catch 를 우회해 직접 stub 할 때만 실행된다. 이는 버그는 아니고("2차 실패까지 격리"라는 방어적 설계 의도와 큐 경로와의 대칭성 확보라는 목적에 부합), plan 의 "큐 경로와 동일 복제" 권고와도 일치한다. 다만 실제 커버하는 실패 시나리오(예: `findOneBy`/`save`/`emitExecution` 자체가 throw)는 이미 내부에서 잡히므로, 이 외부 catch 가 실질적으로 방어하는 유일한 시나리오는 "테스트에서 강제로 스텁된 경우"뿐이라는 점을 인지할 필요가 있다.
  - 제안: 현행 유지 권장(큐 경로와의 대칭성·미래 리팩터 시 `failFirstSegmentSetup` 내부 try/catch 제거 가능성에 대한 안전망 가치가 있음). 코드 변경 불필요.

## Spec Fidelity

- `plan/in-progress/refactor/06-concurrency.md:169-192` (M-4 항목)이 이 변경 영역의 SoT 로 확인된다. 표에 명시된 **옵션 B**("catch 에 `failFirstSegmentSetup` + 2차 실패 격리를 큐 경로와 동일 복제")를 정확히 그대로 구현했다 — `runExecutionFromQueue`(L2837-2858)의 try/catch 블록과 신규 `executeAsync`(L3383-3407)의 `.catch()` 콜백을 라인 단위로 비교하면 동일한 조건 분기(`failFirstSegmentSetup` 호출 → 2차 실패는 `logger.error`로만 흡수)를 따른다. 유일한 구조적 차이는 `executeInline`/큐 경로가 `releaseExecutionRouting`을 추가로 호출하는데, 새 diff 는 이를 의도적으로 생략했고 그 이유를 주석(L3394-3395: "sub-workflow 는 execution routing 미등록이라 releaseExecutionRouting 은 불필요")으로 명시했다 — `executeAsync`가 sub-workflow 전용 진입점이라는 사실과 일치하며 정당하다.
- plan 은 "**spec 갱신: 불요**"(§193)라고 명시했고, `spec/5-system/4-execution-engine.md` §7.1/§7.4 를 확인한 결과 이 diff 는 기존 §7.4 `recoverStuckExecutions`(30분 stale fail) 백스톱을 대체하는 것이 아니라 그 이전 단계에서 더 빠르게 terminal 마킹하는 보완책이며, 상태 머신·필드·에러 코드 어느 것도 spec 문서와 불일치를 일으키지 않는다. SPEC-DRIFT 아님 — spec 은 이미 정합.
- 신규 테스트 2건의 주석("06 concurrency, Option B", "큐 경로 W5/W7 와 동일 계약")도 plan 서술과 정확히 일치한다.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오

- **정상 흐름**: `runExecution` 성공 시 catch 자체가 실행되지 않으므로 기존 동작 불변 — 회귀 없음(`executeAsync` 13개 테스트 전체 PASS 로 확인).
- **1차 실패(setup throw)**: `failFirstSegmentSetup` 호출로 이미 terminal(COMPLETED/FAILED/CANCELLED)이 아닌 execution 을 FAILED 로 best-effort 마감. `runExecution` 자신의 내부 catch 가 이미 처리한 경우(정상 실행 중 실패)는 `failFirstSegmentSetup` 내부의 terminal-status 가드로 no-op — 이중 마킹/이중 이벤트 emit 방지 로직이 정확하다.
- **2차 실패(failFirstSegmentSetup 자체 throw)**: `unhandled rejection` 없이 로그로 흡수 — fire-and-forget 컨텍스트에서 필수적인 안전장치이며 테스트로 명시 검증됨.
- **반환값**: `executeAsync`는 `runExecution(...).catch(...)`를 await 하지 않으므로 fire-and-forget 계약(`executionId` 즉시 반환)이 그대로 유지된다 — 문서 주석("Returns the execution ID immediately")과 일치.
- **TODO/FIXME/HACK**: 신규 diff 내 미완성 표식 없음.

## 요약

`execution-engine.service.ts`의 `executeAsync` fire-and-forget catch 블록에 `failFirstSegmentSetup` best-effort 종료 + 2차 실패 로그 흡수를 추가한 변경은 `plan/in-progress/refactor/06-concurrency.md` M-4 항목이 명시한 **Option B**(단기 fallback 복제)를 정확히 구현했으며, 큐 경로(`runExecutionFromQueue`)의 기존 W7 패턴과 line-level 로 대칭이다. 새 유닛 테스트 2건은 실제로 통과하고 1차/2차 실패 시나리오를 모두 실질 검증하며, 기존 `executeAsync` 스위트 전체(13건)에 회귀가 없다. spec 본문과 상충하는 부분이 없고(plan 도 "spec 갱신 불요"로 명시), 발견된 사항은 plan 체크박스 미동기화(INFO, 코드 밖)와 외부 `.catch` 가 프로덕션에서는 사실상 도달 불가능하지만 방어적 설계·큐 경로 대칭성 관점에서 타당하다는 INFO 뿐이다.

## 위험도

NONE
