# 요구사항(Requirement) Review

## 리뷰 대상

- `codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` 함수 + `findById` 통합
- `codebase/backend/src/modules/executions/executions.service.spec.ts` — 회귀 테스트 4건 추가
- `codebase/backend/test/execution-park-resume.e2e-spec.ts` — 포맷 정리
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — W8 flaky race 안정화
- `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` — `isNodeWaitingForInput` + 4곳 교체
- `plan/in-progress/fix-carousel-waiting-status.md` — 작업 플랜
- `plan/in-progress/spec-update-execution-engine-pre-park-window.md` — SPEC-DRIFT 후속 draft

---

## 발견사항

### [WARNING] [SPEC-DRIFT] spec/5-system/4-execution-engine.md §1.1 "원자성 보장"이 pre-park window intra-row inconsistency 와 `reconcilePreParkWaitingStatus` 보정 전략을 기술하지 않음
- 위치: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §1.1 line 66 "원자성 보장" blockquote
- 상세: spec §1.1 의 "원자성 보장" 노트는 `running ↔ waiting_for_input` 전이가 단일 DB 트랜잭션으로 묶인다는 **cross-entity 원자성**만 기술한다. 그러나 코드가 수정하는 근본 원인은 다른 차원의 문제다 — `executeNode` blocking 분기가 핸들러 봉투(`outputData.status='waiting_for_input'`)를 NodeExecution.status=`running` 인 채 먼저 저장하고, 직후 `waitForXxx` 가 NodeExecution.status 를 `waiting_for_input` 으로 전이하는 두 save 사이의 read window (intra-row inconsistency). 이 창은 spec §1.1 이 보장하는 원자성(Execution↔NodeExecution 쌍 전이)이 닫는 창이 아니다. `reconcilePreParkWaitingStatus` 와 `isNodeWaitingForInput` 의 존재 이유, 조건(RUNNING/PENDING 한정·terminal 제외), 의도적 중복 방어 레이어 선언이 spec 에 전혀 없다. 코드 변경은 합리적이고 의도적이며 되돌리는 것이 오답 — spec 이 낡은 것이다.
- 제안: 코드 유지. `plan/in-progress/spec-update-execution-engine-pre-park-window.md` 에 draft 가 준비되어 있으므로 project-planner 가 `/consistency-check --spec` 후 spec §1.1 "원자성 보장" blockquote 끝에 "Pre-park read-window 정규화 (intra-row inconsistency)" 항목을 추가. 삽입 전 exec-park-b2b Phase-B §1.1 편집과의 텍스트 위치 재확인 필요 (spec-update draft §NOTE 참조).

### [WARNING] [SPEC-DRIFT] frontend `isNodeWaitingForInput` 의 "WS snapshot·read-replica 경로에서도 intra-row 도달 가능" 2차 defense-in-depth 전략이 spec 에 미기재
- 위치: `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` `isNodeWaitingForInput` JSDoc; `spec/5-system/4-execution-engine.md` §1.1
- 상세: `isNodeWaitingForInput` JSDoc 은 "backend `findById` 가 1차 정규화하지만, WS snapshot·read-replica·legacy 응답 경로에선 intra-row inconsistent row 가 여전히 도달 가능" 이라고 명시하며 2차 defense-in-depth 레이어로 동작함을 설명한다. 코드 동작은 올바르고 의도적이지만 spec 에 이 경로 존재와 전략이 기술되지 않았다.
- 제안: 코드 유지. 위 SPEC-DRIFT #1 과 동일 draft (`plan/in-progress/spec-update-execution-engine-pre-park-window.md`) 에 통합 기술 예정 — project-planner 위임. 코드 fix 는 완결.

### [INFO] `reconcilePreParkWaitingStatus` 는 `findById` 경로만 정규화 — `findByWorkflow` list 경로 미적용
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` `findByWorkflow` / `toExecutionDto`
- 상세: 함수는 `findById` 의 `nodeExecutions` 에만 적용된다. list 경로(`findByWorkflow`)의 `toExecutionDto` 는 `nodeExecutions` 를 빈 배열로 내려보내므로 정규화 대상이 없다. 이는 N+1 회피 설계와 일치하는 의도된 동작이며, SUMMARY 이전 요구사항 리뷰(파일 18)에서도 "적절. 기록용" 으로 분류됐다.
- 제안: 현재 구현 적절. 기록 목적.

### [INFO] `PENDING` 상태 정규화 대상 포함 — spec 에 언급 없으나 방어적 추가
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` `reconcilePreParkWaitingStatus` line 118-119; `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` `isNodeWaitingForInput` line 374
- 상세: 두 레이어 모두 `RUNNING` 외 `PENDING` 도 봉투 신호 채택 조건에 포함한다. pre-park window 는 사실상 `executeNode` 의 blocking 분기에서 발생하므로 NodeExecution.status=PENDING 케이스는 이론상 극히 드물다 (spec §1.2 는 PENDING→RUNNING 전이 후 핸들러가 실행됨을 명시). 방어적 포함이므로 오류가 아니고 기능 정확성에도 문제없다. spec 은 이 세부에 침묵(INFO).
- 제안: 코드 유지. PENDING 경로 커버가 의도적임을 JSDoc 에 짧게 기술하면 유지보수자 혼란을 줄일 수 있다.

### [INFO] 테스트 — `PENDING` 상태 봉투 신호 채택 경로 테스트 (backend·frontend 양측 원래 누락 → ecc17b15 에서 추가됨)
- 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` (backend spec 파일 1 diff line 73-97); 및 frontend `apply-execution-snapshot.test.ts` (파일 5 diff, 프롬프트 사이즈 제한으로 전체 diff 미포함)
- 상세: 이번 PR 에서 리뷰 대상 파일 1(backend spec)에 `status='pending'` + 봉투 신호 케이스(test line 73-97)가 추가되어 있다. 이전 SUMMARY(파일 10)에서 INFO#1 로 식별한 PENDING 테스트 누락이 ecc17b15 fix 커밋에서 해소된 것으로 확인된다. RESOLUTION.md(파일 9)에도 `INFO#1: ecc17b15 — backend status='pending' + 봉투 케이스 test 추가` 로 기록됨.
- 제안: 현재 구현 적절.

### [INFO] e2e 파일 변경은 포맷 정리만 — 기능 변경 없음
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` diff 전체
- 상세: 변경된 diff 덩어리는 (a) `JWT_SECRET` 삼항 연산자 줄바꿈, (b) `registerAndLogin` 인자 정렬, (c) `expect(finalUserTexts).toEqual([...])` 배열을 한 줄로 합침. 기능/검증 로직 변경 없다.
- 제안: 현재 구현 적절.

### [INFO] channel-web-chat W8 테스트 race 수정 — `callCount` → `executionId` 순서 교체
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` line 333-340
- 상세: `waitFor(callCount===2)` 이후 `expect(executionId).toBe("e2")` 순서에서 callCount 도달 시점에 React state commit 이 아직 완료되지 않은 race가 있었다. `waitFor(executionId==="e2")` 로 먼저 대기한 뒤 callCount 를 단언하는 방식으로 수정. 의도와 구현이 일치하고 flaky 를 올바르게 제거한다. plan.md 에도 "부수 수정" 으로 명시되어 있다.
- 제안: 현재 구현 적절.

---

## 요약

이번 변경의 핵심 목적은 Carousel/Form/AI blocking 노드의 `executeNode` blocking 분기에서 핸들러 봉투(`outputData.status='waiting_for_input'`)가 NodeExecution.status 컬럼보다 먼저 저장되는 pre-park read-window(intra-row inconsistency)로 인해 frontend 의 waiting UI 가 누락되거나 wipe 되는 회귀 버그를 레이어드 방식으로 수정하는 것이다. 기능 완전성·엣지 케이스(terminal 노드 stale 봉투 재트리거 방지, PENDING 포함)·반환값·데이터 유효성·에러 시나리오·비즈니스 로직 모두 요구사항과 일치하게 구현되었다. `reconcilePreParkWaitingStatus` 는 pure function 으로 전환되어 원본 엔티티 변이 없이 새 배열을 반환하며 snapshotCache 오염을 방지한다. TODO/FIXME/HACK 주석은 없다. 함수명·주석·구현이 일치한다. spec `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장" 은 코드가 수정하는 intra-row 불일치 창과 두 레이어 방어 전략을 기술하지 않아 `[SPEC-DRIFT]` WARNING 2건이 발생하지만, 이는 spec 갱신 누락이지 코드 버그가 아니다 — `plan/in-progress/spec-update-execution-engine-pre-park-window.md` 에 draft 가 준비되어 있다.

---

## 위험도

LOW

STATUS: SUCCESS
