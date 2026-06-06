# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: codebase/backend/src/modules/executions/executions.service.ts

- **[INFO]** `reconcilePreParkWaitingStatus` JSDoc 이 함수 본체(11줄)보다 훨씬 길다(약 30줄). 이전 리뷰(13_57_06) 에서도 동일 발견이 있었으나 이번 diff 에서 이미 `@param`/`@returns` 태그가 추가되어 일부 개선됐다. 그럼에도 인라인 배경 설명이 여전히 길어 코드 대 주석 비율이 역전된 상태다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` L80–L127 (`reconcilePreParkWaitingStatus` JSDoc)
  - 상세: `@param`/`@returns` 태그 추가(W4 fix)는 완료됐다. 나머지 배경 설명은 spec 링크 한 줄로 대체하면 5줄 이내로 압축 가능하다. 이번 diff 의 진입 상태에서 이미 태그가 존재하므로 이 항목은 INFO 로 유지된다.
  - 제안: JSDoc 의 7–15번째 줄(기존 Phase 3 fix 비교 설명) 부분을 `spec/5-system/4-execution-engine.md §1.1 "원자성 보장"` 참조 한 줄로 요약하면 함수 의도의 핵심인 pure function 선언 + @param/@returns 가 더 눈에 띈다.

- **[INFO]** `(ne.outputData as { status?: unknown } | null)?.status === NodeExecutionStatus.WAITING_FOR_INPUT` 패턴이 frontend `isNodeWaitingForInput` 의 `(ne.outputData as { status?: unknown } | null)?.status === "waiting_for_input"` 과 구조적으로 동일하다. 패키지 경계상 직접 공유는 어렵지만 타입 캐스트 형태까지 동일하므로, 한쪽에서 outputData 구조가 변경될 경우 다른 쪽 캐스트가 누락될 위험이 있다.
  - 위치: `executions.service.ts` L120 / `apply-execution-snapshot.ts` L376
  - 상세: 이번 diff 에서 backend 는 enum 상수(`NodeExecutionStatus.WAITING_FOR_INPUT`)를 쓰지만, frontend 는 문자열 리터럴(`"waiting_for_input"`)을 쓴다. 값은 동일하나 형태가 다르다.
  - 제안: frontend `isNodeWaitingForInput` 의 비교 대상도 공유 타입에서 가져오거나 파일 내 상수로 추출하면 일관성이 높아진다. 또는 현재 상태를 수용하고 두 JSDoc 의 상호 참조 주석을 통해 동기화 안전망을 유지한다(이미 이번 diff 에서 frontend JSDoc 에 backend 동기화 필요 문구가 추가됐으므로, backend JSDoc 에도 역방향 참조가 있는지 확인 필요 — 현재 없음).

- **[INFO]** `reconcilePreParkWaitingStatus` 는 서비스 클래스 바깥 자유 함수로 배치됐고, 타입 정의 블록(`ExecutionDetailWithTrigger`) 직후에 위치한다. 파일 레이아웃 관점에서 타입→함수→클래스 순서는 자연스럽지 않다. 현재 규모에서 즉각 이동 필요는 없다.
  - 위치: `executions.service.ts` L113
  - 제안: 추후 리팩터링 시 `executions.utils.ts` 로 이전 고려.

---

### 파일 2: codebase/backend/src/modules/executions/executions.service.spec.ts

- **[INFO]** 신규 4개 테스트 중 `eW3`(pending 케이스)와 `eW4`(혼합 케이스)는 `mockReturnValueOnce` 를 일관되게 사용하고 있으며, 이번 diff 의 코멘트(INFO#9 참조 주석)도 이를 명시한다. 이전 리뷰 발견사항(mockReturnValue 영구 mock 혼재)은 이번 변경에서 해소됐다.

- **[INFO]** 신규 테스트 픽스처(`nodeExecutionRepo.find.mockResolvedValue` 내 객체)는 `NodeExecution` 타입 어노테이션 없이 plain 객체 리터럴이다. 기존 테스트와 동일 패턴을 따르므로 일관성은 유지되나, 스키마 변경 시 컴파일 오류 없이 테스트가 런타임에서 실패할 수 있다. 파일 전체의 기존 패턴과 일치하므로 이번 변경 범위에서 단독 개선은 오히려 불일치를 만든다.
  - 위치: 각 신규 테스트 L542–L558, L571–L583, L598–L604, L622–L640
  - 제안: 파일 전체 픽스처 타입 강화는 별도 이슈로 추적.

- **[INFO]** 테스트 설명(it 문자열)에 한국어가 사용되며, 기술 조건(`status='running' + outputData.status='waiting_for_input'`)이 포함돼 있어 의도 파악이 쉽다. 파일 전체 스타일과 일치한다.

---

### 파일 3: codebase/backend/test/execution-park-resume.e2e-spec.ts

- **[INFO]** 이번 diff 는 순수 포맷팅 변경(긴 줄 분리, 단언 배열 인라인화)이다. 유지보수성에 미치는 영향은 없거나 미미하게 긍정적이다(라인 길이 단축으로 diff 가독성 향상).

---

### 파일 4: codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts

- **[INFO]** `waitFor(() => expect(callCount).toBe(2))` 에서 `await waitFor(() => expect(result.current.state.executionId).toBe("e2"))` 로 교체한 변경은 race condition 을 제거하는 올바른 수정이다. 단언 순서(`callCount` 를 waitFor 이후에 동기로 확인)가 역전되어, state 기반 대기 후 부수 효과를 검증하는 테스트 패턴으로 개선됐다. 유지보수성 향상.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L338–L339
  - 추가된 주석이 race 원인을 명확히 설명하고 있어 후임자 이해를 돕는다.

---

### 파일 5: codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts

- **[WARNING]** `isNodeWaitingForInput` JSDoc 에 "이 함수의 조건을 변경할 때는 backend `reconcilePreParkWaitingStatus` 도 동일 조건으로 함께 변경해야 한다" 는 연결고리가 이번 diff 에서 추가됐다(W3 fix). 역방향(backend JSDoc → frontend) 연결고리는 backend JSDoc 에 없다. 의도적 중복 방어 레이어임에도 단방향 참조만 존재하면, backend 를 먼저 탐색하는 개발자가 frontend 동기화 요건을 놓칠 수 있다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` L80–L127 (`reconcilePreParkWaitingStatus` JSDoc) — 역방향 참조 미존재
  - 상세: frontend JSDoc 에는 "backend `reconcilePreParkWaitingStatus` 도 동일 조건으로 변경 필요" 가 명시돼 있다. 그러나 backend JSDoc 에는 frontend 동기 변경 필요 문구가 없다. 두 함수는 "의도적 중복 방어 레이어"라고 frontend JSDoc 에 선언됐으나, backend 개발자에게는 그 관계가 보이지 않는다.
  - 제안: `reconcilePreParkWaitingStatus` JSDoc 에 "이 함수의 판정 조건을 변경할 때는 frontend `apply-execution-snapshot.ts: isNodeWaitingForInput` 도 동일 조건으로 함께 변경해야 한다 (의도적 중복 방어 레이어)" 한 줄을 추가한다.

- **[INFO]** `isNodeWaitingForInput` 가 `export` 로 공개돼 있어 `websocket/` 폴더 외부에서도 임의로 임포트 가능하다. 현재는 `use-execution-events.ts` 공유 용도이나, 소비자 확장에 따라 캡슐화가 약화될 수 있다. 이전 리뷰(INFO#10)에서 배럴 제외 또는 공유 유틸 이전으로 추적됐다.
  - 위치: `apply-execution-snapshot.ts` L372 (`export function isNodeWaitingForInput`)
  - 제안: 배럴(`index.ts`)이 있다면 해당 함수를 re-export 에서 제외하거나, 별도 `node-execution-status.util.ts` 로 분리. 즉각 조치보다는 별도 리팩터링 후보.

- **[INFO]** `isNodeWaitingForInput` 의 `"waiting_for_input"` 비교가 문자열 리터럴로 3회 사용된다. 파일 내 다른 함수(`mapNodeStatus`, `STATUS_PRIORITY` 등)도 리터럴을 쓰는 기존 패턴과 일치하므로 현재는 일관된 상태다. 그러나 `NodeExecutionStatus` 공유 타입이 존재한다면 해당 타입 상수를 사용하는 것이 타입 안전성을 높인다.

---

### 파일 6: plan/in-progress/fix-carousel-waiting-status.md

- **[INFO]** 이전 리뷰(INFO#6, documentation.md)에서 지적된 파일 말미의 XML 아티팩트(`</content>`, `</invoke>`) 잔재가 현재 파일 상태에서 존재하지 않는다. 실제 파일을 확인한 결과 L1–L58 이 체크리스트로 정상 종결된다. 이 항목은 해소된 것으로 판단한다.

- **[INFO]** `spec: spec/5-system/4-execution-engine.md` frontmatter 에 `status: in-progress` 가 유지돼 있다. 체크리스트가 모두 완료(`[x]`) 상태이나 plan 이동(→ `plan/complete/`) 이 아직 수행되지 않은 상태다. 유지보수성 관점에서는 plan 상태가 코드 상태와 일치해야 한다. 이는 developer SKILL 의 plan-lifecycle 이동 단계 문제로 코드 변경 범위 외이나 기록한다.

---

## 요약

이번 변경 세트(이전 리뷰 W3·W4 fix 포함 이후 상태)는 유지보수성 관점에서 양호하다. `reconcilePreParkWaitingStatus` 는 pure function 으로 전환되고 `@param`/`@returns` 태그가 추가됐으며, `isNodeWaitingForInput` JSDoc 에 backend 동기 변경 필요 문구가 추가됐다. `mockReturnValueOnce` 패턴 통일, enum 상수 사용, 테스트 race 수정도 이번 diff 에서 처리됐다. 남은 주요 유지보수성 우려는 backend `reconcilePreParkWaitingStatus` JSDoc 에 frontend 역방향 참조가 없어 단방향 연결고리만 존재한다는 점이다 — backend 를 먼저 탐색하는 개발자가 동기화 요건을 놓칠 수 있으므로 한 줄 추가가 권고된다. 나머지는 JSDoc 길이, 픽스처 타입 강화, export 캡슐화 등 소규모 INFO 사항이다.

## 위험도

LOW

STATUS: SUCCESS
