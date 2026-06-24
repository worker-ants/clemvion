# 테스트(Testing) 리뷰 — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

### [INFO] 테스트 존재 여부 — 신규 서비스에 전용 단위 테스트 파일 추가됨
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` (신규)
- 상세: `AssistantTurnPersistenceService` 와 `makeResumeMeta` 헬퍼 양쪽에 대한 전용 단위 테스트가 함께 추가되었다. 통합 테스트(`workflow-assistant-stream.service.spec.ts`)도 `AssistantTurnPersistenceService` 를 실제로 생성해 주입하는 방식으로 갱신되어 분리 후에도 persist 동작 단언이 성립한다.
- 제안: 없음.

### [INFO] 커버리지 갭 — `persistUserTurn` 에서 `currentTitle` 이 `undefined` 인 경우 미테스트
- 위치: `assistant-turn-persistence.service.spec.ts` `persistUserTurn` describe 블록
- 상세: 시그니처는 `currentTitle: string | null | undefined` 이지만 테스트는 `null` 과 `'Existing title'` 만 다룬다. `undefined` 전달 시 `!currentTitle` 이 `true` 로 평가되어 `setTitleIfEmpty` 가 호출된다는 동작이 암묵적으로만 성립한다. 실용적으로는 동일 코드 경로이므로 LOW 위험이다.
- 제안: `persistUserTurn('sess-1', 'hello', undefined)` 케이스를 추가해 `undefined` 도 `null` 과 동일하게 title derive 를 시도함을 명시한다.

### [INFO] 커버리지 갭 — whitespace-only content 에서 `appendMessage` 단언 부재 (이전 리뷰 INFO #7 이 이미 지적)
- 위치: `assistant-turn-persistence.service.spec.ts` L120–129
- 상세: `persistUserTurn('sess-1', '   \n\t  ', null)` 케이스에서 `setTitleIfEmpty` 비호출 단언은 있으나, RESOLUTION.md 에 따르면 INFO #7 수정으로 `appendMessage` 원문 호출 단언이 이미 추가된 것으로 기록되어 있다 (L125–129 에 해당 단언 존재 확인). 해당 수정이 이 커밋에 포함되어 있으므로 이 항목은 해소됨.
- 제안: 없음.

### [INFO] 엣지 케이스 — `content` 가 정확히 40자인 경우 title slice 동작 미테스트
- 위치: `assistant-turn-persistence.service.spec.ts` `persistUserTurn` describe 블록
- 상세: title derive 로직은 `content.trim().slice(0, 40)` 이다. 테스트에서 40자를 초과하는 긴 문자열(46자)을 쓰는 케이스가 있어 slicing 을 검증하지만, 경계값(exactly 40자)에 대한 케이스는 없다. 실용적 영향은 매우 낮으나 경계값 테스트로서의 완결성 관점.
- 제안: 40자 문자열을 content 로 전달해 `setTitleIfEmpty` 가 40자 전체를 그대로 넘기는지 단언하는 케이스 추가(선택).

### [INFO] Mock 적절성 — `as never` 패턴 전반
- 위치: `assistant-turn-persistence.service.spec.ts` L58, `workflow-assistant-stream.service.spec.ts` L431
- 상세: `new AssistantTurnPersistenceService(sessionService as never)` 와 같이 `as never` 로 mock 타입을 강제한다. mock 객체가 `appendMessage`/`setTitleIfEmpty` 만 구현하면 되므로 현실적으로 작동하지만, `WorkflowAssistantSessionService` 의 메서드 시그니처가 변경되었을 때 컴파일 오류가 발생하지 않아 테스트가 silent하게 stale 될 수 있다. 이 패턴은 기존 코드베이스 전반의 관행과 일치한다(RESOLUTION defer #6).
- 제안: 장기적으로 `as Pick<WorkflowAssistantSessionService, 'appendMessage' | 'setTitleIfEmpty'>` 로 교체하면 타입 체킹이 회복된다. 현 단계는 필수 아님.

### [INFO] 테스트 격리 — 각 테스트가 `makeService()` 로 독립 인스턴스 생성
- 위치: `assistant-turn-persistence.service.spec.ts` L56–60
- 상세: 모든 테스트 케이스가 `makeService()` 를 호출해 fresh mock 과 서비스 인스턴스를 생성하므로 테스트 간 shared state 가 없다. `beforeEach` 없이도 격리가 보장된다.
- 제안: 없음.

### [INFO] 테스트 가독성 — 한국어 주석과 describe/it 명명이 의도를 명확하게 표현
- 위치: `assistant-turn-persistence.service.spec.ts` 전체
- 상세: `makeResumeMeta`, `persistUserTurn`, `persistAssistantTurn` 별로 describe 블록이 분리되어 있고, 각 it 문자열이 동작 계약("non-resumed default meta when stallRounds <= 0", "normalizes empty content to null and empty toolCalls to null" 등)을 명확히 기술한다. 인라인 주석도 의도와 예외 케이스를 보충한다.
- 제안: 없음.

### [INFO] 회귀 테스트 — 통합 테스트에서 `sessionService` mock 재사용으로 기존 단언 유지
- 위치: `workflow-assistant-stream.service.spec.ts` L428–442
- 상세: `turnPersistence` 를 `mocks.sessionService` 를 공유해 생성함으로써, `mocks.sessionService.appendMessage` 에 대한 기존 persist 단언이 `AssistantTurnPersistenceService` 위임 경유 후에도 그대로 성립한다. 분리 후 기존 87개 케이스가 PASS 임이 RESOLUTION.md 에서 확인되어 회귀 없음.
- 제안: 없음.

### [INFO] 테스트 용이성 — 생성자 주입으로 mock 교체가 용이한 구조
- 위치: `assistant-turn-persistence.service.ts` L339–342
- 상세: `AssistantTurnPersistenceService` 는 `WorkflowAssistantSessionService` 를 생성자 주입으로만 소비하고 static import 나 내부 인스턴스 생성이 없으므로, 단위 테스트에서 최소 mock 객체 2개 메서드(`appendMessage`, `setTitleIfEmpty`)만 구현하면 전체 서비스를 격리 테스트할 수 있다. 테스트 용이성 측면에서 매우 적절한 구조다.
- 제안: 없음.

### [INFO] `resumeMeta` 기본값 경로 — 기존 케이스로 이미 충족
- 위치: `assistant-turn-persistence.service.spec.ts` L142–163
- 상세: `persistAssistantTurn` 을 `resumeMeta` 인자 없이(기본값 `makeResumeMeta(0)`) 호출하는 케이스("appends an assistant row with the default (non-resumed) meta")가 존재하며, `autoResumed: false, autoResumeReason: null, autoResumeAttempt: null` 을 단언한다. RESOLUTION defer #9 에서 "이미 충족"으로 판정된 것과 일치.
- 제안: 없음.

## 요약

M-3 3단계 `AssistantTurnPersistenceService` 분리는 테스트 측면에서 양호하게 수행되었다. 신규 서비스에 대한 전용 단위 테스트 파일이 함께 추가되었고, `makeResumeMeta` 헬퍼·`persistUserTurn`·`persistAssistantTurn` 의 주요 코드 경로(정상/엣지/stall 복구/usage 스냅샷/provider-opaque finishReason)가 고르게 커버된다. 통합 테스트는 shared mock sessionService 재사용으로 기존 단언이 분리 후에도 성립함을 확인했으며, 테스트 격리(케이스별 독립 인스턴스)와 가독성(describe/it 명명, 인라인 주석) 모두 기준 이상이다. 잔여 갭은 `currentTitle: undefined` 케이스, 정확히 40자 경계값 케이스, `as never` 패턴으로 인한 잠재적 silent stale 등 INFO 수준에 한정되며, 이전 리뷰 RESOLUTION 에서 이미 식별·defer 판정된 사항들이다.

## 위험도

LOW
