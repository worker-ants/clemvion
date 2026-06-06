# 요구사항(Requirement) Review

## 리뷰 대상

- `codebase/backend/src/modules/executions/executions.service.spec.ts` — 회귀 테스트 2건 추가
- `codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` 함수 + `findById` 호출
- `codebase/backend/test/execution-park-resume.e2e-spec.ts` — 포맷 정리(함수 인자 줄바꿈, 단언 순서 교체)
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — W8 flaky race 안정화
- `codebase/frontend/src/lib/websocket/__tests__/apply-execution-snapshot.test.ts` — 3개 새 케이스 추가
- `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` — `isNodeWaitingForInput` + 4곳 교체
- `plan/in-progress/fix-carousel-waiting-status.md` — 작업 플랜

---

## 발견사항

### [WARNING] [SPEC-DRIFT] spec 이 `reconcilePreParkWaitingStatus` / `isNodeWaitingForInput` 를 기술하지 않음
- 위치: `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장" 항목
- 상세: spec §1.1 "원자성 보장" 노트는 "`running ↔ waiting_for_input` 전이는 … 단일 DB 트랜잭션으로 묶인다" 고 명시하지만, **blocking 노드의 핸들러가 봉투(`outputData.status='waiting_for_input'`)를 저장한 뒤 `waitForXxx` 호출 전에 snapshot 을 읽으면 intra-row inconsistency 가 발생하는 `pre-park window`** 와 그 보정 전략(read-side normalization)은 spec 에 전혀 언급이 없다. 코드 변경은 의도적이고 합리적인 방어 — 되돌리는 것이 오답이다. spec 이 낡은 것이다.
- 제안: 코드 유지. `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장" 노트 하단에 아래 취지를 추가 (project-planner 위임):
  > **Pre-park read-window 정규화**: `executeNode` blocking 분기가 핸들러 봉투(`outputData.status='waiting_for_input'`)를 NodeExecution.status=`running` 인 채 먼저 저장하고 직후 `waitForXxx` 가 atomic 전이한다. 그 사이 snapshot 이 읽히면 intra-row inconsistent 가 된다. `findById` 는 read-side normalization(`reconcilePreParkWaitingStatus`)으로 비터미널 row 의 봉투 신호를 surface 해 소비자에 일관된 상태를 노출한다. DB write/원자성은 불변.

---

### [WARNING] [SPEC-DRIFT] frontend `isNodeWaitingForInput` 의 "WS snapshot·read-replica 경로에서도 intra-row 도달 가능" 가드가 spec 에 미기재
- 위치: `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` `isNodeWaitingForInput` JSDoc; `spec/5-system/4-execution-engine.md` §1.1
- 상세: `isNodeWaitingForInput` JSDoc 은 "backend `findById` 가 1차 정규화하지만, WS snapshot·read-replica·legacy 응답 경로에선 여전히 intra-row inconsistent row 가 도착 가능"이라고 명시한다. 코드는 2차 defense-in-depth 로 frontend 에서도 봉투 신호를 읽는다. 이 경로 존재 자체가 spec 에 없다.
- 제안: 코드 유지. spec §1.1 에 "frontend `applyExecutionSnapshot` 도 동일 봉투 신호를 `isNodeWaitingForInput` 으로 2차 방어한다 (defense-in-depth)" 취지를 보강 (project-planner 위임).

---

### [INFO] `reconcilePreParkWaitingStatus` 는 `findById` 경로만 정규화 — `findByWorkflow` list 경로는 미적용
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` `findByWorkflow` / `toExecutionDto`
- 상세: 함수는 `findById` 의 `nodeExecutions` 에만 적용된다. list 경로(`findByWorkflow`)의 `toExecutionDto` 는 `nodeExecutions`를 빈 배열로 내려보내므로 정규화 대상이 없다. 이는 N+1 회피 설계와 일치하는 의도된 동작이다.
- 제안: 현재 구현 적절. 기록 목적으로 남긴다.

---

### [INFO] `PENDING` 상태도 정규화 대상 포함 — spec 에 언급 없으나 방어적 추가
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` `reconcilePreParkWaitingStatus` (line 746–748); `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` `isNodeWaitingForInput` (line 3359)
- 상세: 정규화 대상을 `RUNNING` 외 `PENDING` 까지 포함한다. pre-park window 는 사실상 blocking 핸들러가 `RUNNING` 상태에서 발생하므로 `PENDING` 케이스는 이론상 극히 드물지만, 방어적 포함이므로 오류가 아니다. spec 은 이 세부에 침묵한다(INFO).

---

### [INFO] e2e 파일 변경은 포맷 정리만 — 기능 변경 없음
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (diff 전체)
- 상세: 변경된 두 diff 덩어리는 (a) `JWT_SECRET` 삼항 연산자 줄바꿈, (b) `registerAndLogin` 인자 정렬, (c) `expect(finalUserTexts).toEqual(...)` 를 한 줄로 합침. 기능/검증 로직 변경 없다.

---

### [INFO] channel-web-chat W8 테스트 race 수정 — `callCount` → `executionId` 순서 교체
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (line ~2287–2293)
- 상세: `waitFor(callCount===2)` 이후 `expect(executionId).toBe("e2")` 순서에서 callCount 도달 시점에 React state commit 이 아직 안 된 race 가 있었다. `waitFor(executionId==="e2")` 로 먼저 대기한 뒤 callCount 를 단언하는 방식으로 수정. 의도와 구현이 일치하고 flaky 를 올바르게 제거한다.

---

### [INFO] 테스트 mock 라우팅 — entity class name 의존성
- 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` `beforeEach` `transactionImpl` (line ~217–221)
- 상세: `manager.find` 의 entity-to-repo 라우팅이 `ctor?.name === 'ExecutionNodeLog'` 문자열 비교에 의존한다. TypeScript 빌드 minification 이나 클래스명 변경 시 라우팅이 깨질 수 있다. 현재 e2e·단위 테스트 환경에서는 클래스명이 보존되므로 실제 문제는 아니나, 취약한 패턴이다. 단, 이는 기존 코드 패턴이지 이번 diff 가 새로 도입한 것이 아니므로 INFO 로만 기록한다.

---

## 요약

이번 변경의 핵심 목적은 "blocking 노드(Carousel/Form/AI)가 `outputData.status='waiting_for_input'` 봉투를 DB 에 저장했으나 `NodeExecution.status` 컬럼이 아직 `running` 인 pre-park 윈도우에서 snapshot 이 읽혔을 때 frontend 가 waiting UI 를 누락하거나 wipe 하는 회귀 버그"를 레이어드 픽스로 해결하는 것이다. 백엔드(`reconcilePreParkWaitingStatus`)와 프론트(`isNodeWaitingForInput`)가 각각 봉투 신호를 2차적으로도 인식하도록 보강했다. 기능 완전성, 엣지 케이스(terminal 노드 stale 봉투 재트리거 방지, PENDING 포함), 반환값, 데이터 유효성, 에러 시나리오 모두 요구사항과 일치한다. TODO/FIXME/HACK 주석은 없다. 함수명·주석·구현이 일치한다. spec `/5-system/4-execution-engine.md` 의 원자성 보장 명세는 코드가 수정하는 근본 원인(인트라-row 불일치)을 기술하지 않아 `[SPEC-DRIFT]` WARNING 2건이 발생하나 이는 spec 갱신 누락이며 코드 버그가 아니다.

## 위험도

LOW
