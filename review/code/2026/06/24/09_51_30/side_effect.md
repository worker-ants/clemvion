# 부작용(Side Effect) 리뷰 — M-3 3단계 AssistantTurnPersistenceService 분리

## 발견사항

### [INFO] 생성자 파라미터 추가 — WorkflowAssistantStreamService 시그니처 변경
- 위치: `/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (생성자)
- 상세: `WorkflowAssistantStreamService` 생성자에 `turnPersistence: AssistantTurnPersistenceService` 파라미터가 추가됐다. NestJS DI 컨텍스트에서는 모듈 provider 등록(`workflow-assistant.module.ts`)으로 자동 주입되므로 런타임 호출자에는 영향이 없다. 수동 인스턴스화하는 테스트(`workflow-assistant-stream.service.spec.ts`)는 이미 `new AssistantTurnPersistenceService(mocks.sessionService)` 를 생성해 주입하도록 함께 수정됐다. 호출자 영향 없음.
- 제안: 없음. 대응이 완결됐다.

### [INFO] `makeResumeMeta` 이동으로 인한 import 변경
- 위치: `workflow-assistant-stream.service.ts` 상단 import 블록
- 상세: `makeResumeMeta` 가 `workflow-assistant-stream.service.ts` 에서 삭제되고 `tools/assistant-turn-persistence.service.ts` 로 이동했으며, 동시에 `workflow-assistant-stream.service.ts` 에서 해당 모듈을 named import 한다. 동일 파일 내에 중복 정의가 남지 않는다. `AutoResumeReason` import 는 `workflow-assistant-message.entity` 에서 제거됐는데, `AutoResumeReason` 은 이제 `assistant-turn-persistence.service.ts` 내부에서만 사용되므로 누락 없다.
- 제안: 없음.

### [INFO] `persistAssistantTurn` private 메서드 제거 — 내부 호출만 존재했으므로 외부 계약 변경 없음
- 위치: `workflow-assistant-stream.service.ts` 라인 961–998 (삭제 블록)
- 상세: `private async persistAssistantTurn(...)` 는 클래스 외부에 노출된 public API 가 아니었다. 4개 호출 지점 모두 `this.turnPersistence.persistAssistantTurn(...)` 으로 교체됐고 시그니처(파라미터 순서·타입)가 동일하게 유지됐다. 호출자가 직접 참조할 수 있는 public interface 변화는 없다.
- 제안: 없음.

### [INFO] `AssistantTurnPersistenceService.persistAssistantTurn` 의 `resumeMeta` 기본값 — 모듈 수준 상수 평가
- 위치: `tools/assistant-turn-persistence.service.ts` 라인 572 `resumeMeta: ... = makeResumeMeta(0)`
- 상세: TypeScript 기본 파라미터 값인 `makeResumeMeta(0)` 는 함수 호출 시점마다 평가된다(매 호출 새 객체 생성). 해당 함수는 순수 함수이고 전역 상태를 읽거나 변경하지 않으므로 의도치 않은 공유 상태 문제는 없다. 동일한 기본값 패턴이 기존 `private persistAssistantTurn` 에서도 사용됐으므로 동작 변화가 없다.
- 제안: 없음.

### [INFO] `persistUserTurn` — 조건부 DB 쓰기 부작용 검증
- 위치: `tools/assistant-turn-persistence.service.ts` `persistUserTurn` 메서드
- 상세: `currentTitle` 이 falsy 일 때만 `setTitleIfEmpty` 를 호출하는 조건(`if (!currentTitle)`)이 기존 `streamMessage` 의 `if (!session.title)` 와 의미상 동일하게 이동됐다. 단, 기존 코드는 `session.title` (로드된 엔티티의 string 필드) 를 검사했고 새 코드는 `currentTitle: string | null | undefined` 파라미터를 검사한다. 호출부에서 `session.title` 를 그대로 넘기므로(`await this.turnPersistence.persistUserTurn(sessionId, dto.content, session.title)`) 런타임 동작은 동일하다. `setTitleIfEmpty` 는 이름대로 idempotent이므로 중복 호출 시에도 side effect 가 없다.
- 제안: 없음.

### [INFO] NestJS 모듈 provider 등록 순서
- 위치: `workflow-assistant.module.ts` providers 배열
- 상세: `AssistantTurnPersistenceService` 가 `providers` 배열에 추가됐다. 이 서비스가 의존하는 `WorkflowAssistantSessionService` 는 같은 배열에 먼저 등록돼 있다. NestJS 는 DI 컨테이너에서 순서가 아닌 토큰으로 의존성을 해결하므로 순서는 관계없으나, 표기상으로도 의존 서비스가 선행 등록돼 있어 문제없다.
- 제안: 없음.

## 요약

이번 변경은 `WorkflowAssistantStreamService` 내부 메서드(`persistAssistantTurn`, user 메시지 append 블록) 와 순수 헬퍼 함수(`makeResumeMeta`)를 신규 무상태 collaborator 서비스로 verbatim 이동한 behavior-preserving 리팩터다. 전역 변수 도입 없음, 파일시스템 부작용 없음, 환경 변수 읽기/쓰기 없음, 외부 네트워크 호출 없음, 이벤트 발생 순서 변경 없음. public API(`streamMessage` 시그니처, SSE 이벤트 종류·순서, DB write 내용·타이밍) 에 변화가 없으며, 유일하게 변경된 생성자 시그니처는 NestJS DI 가 자동 처리하고 테스트는 수동 주입으로 대응 완료됐다. 의도하지 않은 부작용은 발견되지 않았다.

## 위험도

NONE
