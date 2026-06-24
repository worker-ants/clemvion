# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] positional 파라미터 7개 — 호출부 null 나열로 가독성 저하
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` `persistAssistantTurn` 시그니처
- 상세: `persistAssistantTurn(sessionId, content, toolCalls, plan, usage, finishReason, resumeMeta)` 7개 positional 파라미터 중 `plan`, `usage` 는 각각 null 이 정상값이므로 호출부 4곳에서 `null, null, 'stop'` 같은 나열이 반복된다. 파라미터 순서 착오나 null 위치 실수가 컴파일러에 잡히지 않는다. 이 시그니처는 verbatim 이동된 pre-existing 계약이므로 이번 변경이 도입한 결함은 아니나, 중기 개선 대상이다.
- 제안: `AssistantPersistParams` options object 타입을 도입해 named property 호출로 전환. 단, 호출부 4곳 동시 변경이 필요하므로 별건 리팩터 PR 로 위임.

### [INFO] `makeResumeMeta` 반환 타입 — `ResumeMeta` 인터페이스로 추출 완료 여부 확인 권고
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L309, `persistAssistantTurn` resumeMeta 파라미터
- 상세: 이전 리뷰 사이클(RESOLUTION.md INFO #11)에서 `ResumeMeta` 인터페이스 export 추출이 적용 완료 항목으로 기록됐다. 현재 diff 에는 `export interface ResumeMeta`(L290)와 `makeResumeMeta(stallRounds: number): ResumeMeta`(L309) 가 반영되어 있어 중복 인라인 타입 문제는 해소됐다. 동일하게 `UsageSnapshot` 인터페이스(L278)도 export 되어 `usage` 파라미터 타입 중복 위험도 제거됐다. 이 항목은 조치 완료로 확인한다.
- 제안: 없음.

### [INFO] `makeResumeMeta` import 경계 관통 — 의도 주석으로 완화됨
- 위치: `/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` import 블록
- 상세: `makeResumeMeta` 가 persist 모듈(`assistant-turn-persistence.service.ts`)에 위치하지만 `streamMessage` 가 직접 import 해 stall 카운터로부터 메타를 derive 한다. turn-scoped 상태(`totalStallCount`)를 소유한 쪽이 streamMessage 이므로 derive 책임이 호출부에 있는 것이 논리적으로 타당하며, import 블록에 의도 설명 주석이 추가돼 있다. 현행 유지 타당.
- 제안: 향후 `persistAssistantTurn` 에 `stallRounds: number` 오버로드를 추가해 내부에서 `makeResumeMeta` 를 호출하는 방식을 고려하면 호출부의 import 의존을 제거할 수 있으나, 현 시점은 YAGNI.

### [INFO] 테스트 `as never` 단언 반복 — 기존 관행과 일치, 선택적 개선
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` L58, `/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` L432
- 상세: mock 을 `as never` 로 캐스팅해 DI 주입하는 패턴은 이 코드베이스 테스트 전반의 기존 관행과 일치한다. 그러나 `WorkflowAssistantSessionService` 의 형태가 변경될 경우 컴파일 오류가 발생하지 않아 테스트가 묵시적으로 잘못된 mock 을 사용하게 된다.
- 제안: `as Pick<WorkflowAssistantSessionService, 'appendMessage' | 'setTitleIfEmpty'>` 로 교체하면 필요한 메서드만 타입 체크하고 불필요한 전체 타입 요구 없이 mock 형태 변경을 조기 탐지할 수 있다. 선택적 개선 (별건 하드닝).

### [INFO] `if (!derived)` 조건 분기 — 중괄호 생략으로 일관성 약간 저하
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L360–361
- 상세: `if (derived) await this.sessionService.setTitleIfEmpty(...)` 에서 단일 문 조건에 중괄호가 생략됐다. 바로 위의 `if (!currentTitle) { ... }` 블록은 중괄호를 사용해 스타일이 혼재한다. 기능 오류는 없으나 미세한 일관성 저하다.
- 제안: `if (derived) { await ... }` 로 중괄호를 추가하거나, 전체 파일에서 단일 문 조건은 중괄호 생략으로 통일 — 현행 모듈 코드베이스 컨벤션을 따른다.

### [INFO] `persistAssistantTurn` 메서드 JSDoc — 이전 리뷰 사이클에서 추가 완료
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L365–377
- 상세: RESOLUTION.md INFO #10 항목에서 `@param resumeMeta` 포함 메서드 JSDoc 추가가 적용 완료로 기록됐으며 현재 diff 에 JSDoc 블록이 반영돼 있다. `persistUserTurn` 과의 문서화 일관성 회복됨. 조치 완료 확인.
- 제안: 없음.

## 요약

이번 변경은 `WorkflowAssistantStreamService` 에서 세션/메시지 영속 책임을 `AssistantTurnPersistenceService` 무상태 collaborator 로 분리하는 behavior-preserving 리팩터로, M-3 시리즈 1·2단계(`AssistantToolRouter`, `AssistantFinishGuard`)와 동일한 패턴을 일관되게 적용해 유지보수성을 전반적으로 향상시킨다. `ResumeMeta`·`UsageSnapshot` 인터페이스 export, `persistAssistantTurn` JSDoc 추가 등 이전 리뷰 사이클 INFO 항목들이 이미 적용 완료된 상태이며, 잔여 개선 기회는 positional 파라미터 7개(options object 화), `as never` mock 단언(Pick 타입 교체), 단일 문 중괄호 일관성의 세 가지로 모두 낮은 심각도의 선택적 중기 개선 사항이다. 새로 도입된 복잡도나 중복 코드가 없고 기존 코드베이스 스타일·패턴을 준수하며, 책임 분리로 각 클래스의 함수 길이와 복잡도가 낮아졌다.

## 위험도

LOW
