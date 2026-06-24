# 부작용(Side Effect) 리뷰 — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

### [INFO] 전역/공유 상태 변경 없음
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` 전체
- 상세: `AssistantTurnPersistenceService` 는 인스턴스 필드로 `sessionService` 참조만 보유하며 가변 상태를 소유하지 않는다. `makeResumeMeta` 는 순수 함수(입력→출력, 부수효과 없음). 모듈 레벨 전역 변수 신규 도입 없음.
- 제안: 없음.

### [INFO] 파일시스템 부작용 없음
- 위치: 변경된 파일 전체
- 상세: 이번 변경은 TS 소스·spec·리뷰 문서 파일만 수정/신규 생성한다. 런타임에 파일을 생성·수정·삭제하는 코드가 없으며, NestJS DI 프레임워크의 표준 서비스 등록 패턴만 사용한다.
- 제안: 없음.

### [INFO] 시그니처 변경 — `WorkflowAssistantStreamService` 생성자 파라미터 추가
- 위치: `workflow-assistant-stream.service.ts` L183 — `private readonly turnPersistence: AssistantTurnPersistenceService` 추가
- 상세: `WorkflowAssistantStreamService` 생성자에 `AssistantTurnPersistenceService` 인자가 추가됐다. NestJS IoC 컨테이너가 DI 그래프를 통해 자동 주입하므로 애플리케이션 런타임에는 영향이 없다. 단, `workflow-assistant-stream.service.spec.ts` 의 `makeService()` 헬퍼가 수동으로 인스턴스를 생성하는 통합 테스트가 존재하며, 이는 이미 이번 변경에서 `turnPersistence` 를 함께 전달하도록 업데이트됐다. 다른 테스트 파일에서 `WorkflowAssistantStreamService` 를 직접 `new` 로 생성하는 경우 컴파일 오류가 발생하지만, 해당 케이스는 현재 diff 내에 없다.
- 제안: 다른 테스트 파일에서 `WorkflowAssistantStreamService` 직접 생성 패턴이 있는지 확인 권장(현재 diff 범위에는 없음).

### [INFO] 공개 API 변경 없음 — 기존 호출자 영향 없음
- 위치: `workflow-assistant.module.ts`, `WorkflowAssistantController`
- 상세: HTTP 엔드포인트·DTO·SSE 이벤트 구조가 변경되지 않았다. `WorkflowAssistantModule` 의 `exports` 배열에 `AssistantTurnPersistenceService` 가 포함되지 않아 모듈 외부 노출 없음. 모듈 외부 호출자(컨트롤러, 다른 모듈)에 대한 breaking change 없음.
- 제안: 없음.

### [INFO] 환경 변수 읽기/쓰기 없음
- 위치: 변경된 파일 전체
- 상세: `process.env` 접근, 환경 변수 읽기·쓰기가 신규 도입되지 않았다.
- 제안: 없음.

### [INFO] 네트워크 호출 없음
- 위치: `assistant-turn-persistence.service.ts` 전체
- 상세: 외부 HTTP 호출, 소켓 연결, 메시지 큐 호출이 없다. `WorkflowAssistantSessionService.appendMessage` / `setTitleIfEmpty` 위임만 수행하며 이는 기존 DB 레이어다.
- 제안: 없음.

### [INFO] 이벤트/콜백 발생 변경 없음
- 위치: `workflow-assistant-stream.service.ts` — `streamMessage` 위임 호출부 4곳
- 상세: SSE `yield` 순서, `persistAssistantTurn` 호출 시점, `auto_resume` 이벤트 발행 순서가 이전과 동일하게 유지된다. persist 완료 후 SSE 이벤트를 yield 하는 순서가 보존되어 클라이언트가 수신하는 이벤트 스트림에 변화가 없다.
- 제안: 없음.

### [INFO] `makeResumeMeta` 교차 import — 의도된 설계
- 위치: `workflow-assistant-stream.service.ts` — `import { makeResumeMeta } from './tools/assistant-turn-persistence.service'`
- 상세: `streamMessage` 가 `makeResumeMeta` 를 `assistant-turn-persistence.service.ts` 에서 직접 import 하므로 캡슐화 경계를 관통하는 형태지만, turn-scoped stall 카운터(`totalStallCount`) 소유권이 `streamMessage` 에 있어 메타 derive 가 호출부에 있는 것이 무상태 collaborator 패턴과 정합한다. 의도 주석이 import 블록에 명시돼 있다. 부작용 관점에서 공유 가변 상태를 노출하거나 예상치 못한 상태 변경을 일으키지 않는다.
- 제안: 없음.

## 요약

이번 변경은 `WorkflowAssistantStreamService` 의 `persistUserTurn`·`persistAssistantTurn` 두 메서드와 `makeResumeMeta` 헬퍼를 신규 `AssistantTurnPersistenceService` 무상태 collaborator로 verbatim 이동한 순수 구조 리팩토링이다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 접근, 네트워크 호출, 이벤트 순서 변경이 전혀 없다. `WorkflowAssistantStreamService` 생성자에 파라미터가 추가됐으나 NestJS DI 컨테이너 및 업데이트된 테스트 헬퍼가 이를 처리하며, 모듈 외부 공개 API에 대한 breaking change가 없다. DB write 순서·SSE 이벤트 발행 순서·stall 복구 흐름이 이전과 동일하게 보존된다.

## 위험도

NONE
