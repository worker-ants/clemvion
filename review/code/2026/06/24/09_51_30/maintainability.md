# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `persistAssistantTurn` 시그니처의 positional 파라미터 과다
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L548–586
- 상세: `persistAssistantTurn`은 7개의 positional 파라미터를 받는다(`sessionId`, `content`, `toolCalls`, `plan`, `usage`, `finishReason`, `resumeMeta`). 호출부 4곳에서 파라미터 순서를 시각적으로 추적해야 하며, `null`이 나란히 3개 이상 오는 케이스(L196, L209 등 스펙 파일 참조)에서 의미를 구분하기 어렵다. 기존 패턴(AssistantToolRouter, AssistantFinishGuard)도 동일 스타일이므로 이번 PR의 신규 도입은 아니지만, 서비스가 독립 파일로 분리된 지금이 options object(`AssistantPersistParams`)로 리팩터하기에 적합한 시점이다.
- 제안: `{ sessionId, content, toolCalls, plan, usage, finishReason, resumeMeta? }` 형태의 파라미터 객체 타입을 도입해 호출부의 positional null 나열을 제거. 이 변경은 테스트 fixture에서도 명시적으로 필드를 기술하게 해 spec 파일의 가독성을 향상시킨다.

### [INFO] `persistUserTurn`의 단일 라인 if 본체
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L543–544
- 상세: `if (derived) await ...` 가 중괄호 없이 한 줄로 작성되어 있다. 프로젝트 전반의 다른 코드는 중괄호를 일관되게 사용한다. 내용은 명확하고 의도도 쉽게 파악되나, 추후 조건 분기를 추가할 때 버그 유입 위험이 있다.
- 제안: 중괄호를 명시해 `if (derived) { await this.sessionService.setTitleIfEmpty(sessionId, derived); }` 로 통일.

### [INFO] `makeResumeMeta(0)` 기본값의 의미 불명확성
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L572 (`= makeResumeMeta(0)`)
- 상세: 기본 파라미터로 `makeResumeMeta(0)`을 사용하는 것은 동작상 올바르나, 코드를 처음 읽는 사람에게는 `0`이 "정상 턴" 또는 "stall 없음"을 의미한다는 것이 즉시 명확하지 않다. JSDoc이 함수 레벨에만 있고 기본값 주석은 없다.
- 제안: 매직 넘버 `0`에 인라인 주석(`/* stallRounds=0: no stall recovery */`) 추가 또는 `makeResumeMeta(0)` 대신 명명 상수(`DEFAULT_RESUME_META = makeResumeMeta(0)`)를 export해 의미를 자명하게 표현.

### [INFO] 테스트에서 `as never` 타입 단언 반복 사용
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` L92, `/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` L777
- 상세: mock을 `as never`로 주입하는 패턴이 이미 코드베이스 전반에서 관용적으로 쓰이므로 새로운 문제는 아니다. 그러나 `AssistantTurnPersistenceService`의 생성자가 `WorkflowAssistantSessionService`만 받는 간단한 구조임에도 불구하고 타입 체크를 완전히 우회한다. 유닛 테스트에서 서비스 인터페이스만 뽑은 최소 타입(`Pick<WorkflowAssistantSessionService, 'appendMessage' | 'setTitleIfEmpty'>`)을 사용하면 mock 형태 변경 시 컴파일 단계에서 테스트 오류를 잡을 수 있다.
- 제안: `as never` 를 `as Pick<WorkflowAssistantSessionService, 'appendMessage' | 'setTitleIfEmpty'>` 로 교체 (선택적 개선).

### [INFO] `WorkflowAssistantStreamService`에 `makeResumeMeta` import 잔류
- 위치: `/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` L845–847
- 상세: `makeResumeMeta`를 `AssistantTurnPersistenceService`로 이동하면서 `stream.service.ts`도 같은 파일에서 re-import해 4곳의 `persistAssistantTurn` 호출부에서 직접 사용하고 있다. 이동 의도("leaf 헬퍼를 persist 본체와 같은 파일에 둬 두 곳에서 공유")가 서비스 경계를 관통하는 약한 결합을 만든다. `stream.service.ts`는 `makeResumeMeta`를 알 필요가 없으며, `totalStallCount`를 `persistAssistantTurn`에 넘기기 전에 `makeResumeMeta`로 변환하는 책임을 `AssistantTurnPersistenceService`가 오버로드(`stallRounds: number` 파라미터)로 직접 받거나, `stream.service.ts`가 `turnPersistence.persistAssistantTurn(... , makeResumeMeta(totalStallCount))` 대신 `turnPersistence.persistAssistantTurnWithStall(... , totalStallCount)`을 호출하는 방식으로 캡슐화를 높일 수 있다. 현재 동작은 정상이나, `makeResumeMeta`의 내부 로직이 변경될 때 `stream.service.ts`에서도 import 체인을 추적해야 하는 부담이 남는다.
- 제안: `persistAssistantTurn`의 마지막 파라미터를 `resumeMeta | number`로 오버로드하거나, `stream.service.ts`에서 숫자만 넘기고 변환은 서비스 내부에서 처리. 또는 현행 유지하되 `makeResumeMeta` import이 의도적임을 주석으로 명시.

## 요약

이번 변경(M-3 3단계)은 `WorkflowAssistantStreamService`에서 세션/메시지 영속 책임을 `AssistantTurnPersistenceService`라는 무상태 collaborator로 분리하는 behavior-preserving 리팩터다. 1단계(AssistantToolRouter)·2단계(AssistantFinishGuard)와 동일한 패턴을 일관되게 적용했고, 클래스·파일명·배치·NestJS DI 등록 모두 기존 코드베이스 관습을 잘 따른다. 신규 단위 스펙(13건)은 경계 케이스(음수 stallRounds, whitespace-only content, 명시적 resumeMeta 전달)를 명확히 커버하며 테스트 의도도 설명적이다. 지적사항은 모두 INFO 수준으로, CRITICAL 또는 WARNING에 해당하는 구조적 문제는 없다. `persistAssistantTurn`의 파라미터 수와 `makeResumeMeta` 결합도는 향후 이 서비스가 추가 호출 지점을 얻을 경우 유지보수 부담이 될 수 있으나, 현재 범위(4개 호출부)에서는 수용 가능하다.

## 위험도

LOW
