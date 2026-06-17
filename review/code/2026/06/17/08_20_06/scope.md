# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 테스트 relocate — ai-turn-orchestrator.service.spec.ts 신설
- 위치: `/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` (신규 979줄)
- 상세: `buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `buildConversationConfigFromOutput` 단위 테스트 및 `extractAiTurnErrorPayload`, W5(processAiResumeTurn 방어 가드) 테스트가 `execution-engine.service.spec.ts` 에서 이곳으로 이동했다. 헬퍼 함수 자체는 여전히 `execution-engine.service.ts` 에 export 로 잔류하며, 신규 spec 파일이 그것을 import 한다. 이는 메서드 추출(strangler-fig)의 논리적 귀결이며 범위를 이탈하지 않는다.
- 제안: 해당 없음.

### [INFO] execution-engine.service.spec.ts — spy 타겟 변경 및 describe 블록 제거
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 전반
- 상세: `processAiResumeTurn`, `waitForAiConversation`, `handleAiResumeTurn` 에 대한 `jest.spyOn` 타겟이 `service`(엔진 인스턴스)에서 `aiTurnOrchestrator`(추출된 오케스트레이터)로 변경되고, 엔진 spec에서 중복된 `buildConversationMetaFromResumeState` / `extractAiTurnErrorPayload` / W5 describe 블록이 삭제됐다. 변경은 추출 사실을 반영하는 동기화 작업이며 새로운 동작 추가 없음.
- 제안: 해당 없음.

### [INFO] execution-engine.module.ts — AiTurnOrchestrator + ENGINE_DRIVER 바인딩 추가
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.module.ts` (9줄 추가)
- 상세: `AiTurnOrchestrator` provider 등록과 `{ provide: ENGINE_DRIVER, useExisting: ExecutionEngineService }` 바인딩만 추가됐다. 기존 provider 목록 순서 변경이나 imports/exports 변경 없음. 범위 내 최소 변경.
- 제안: 해당 없음.

### [INFO] engine-driver.interface.ts 신설 — 102줄 순수 인터페이스+토큰
- 위치: `/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: `EngineDriver` 인터페이스(9개 메서드)와 DI 토큰 `ENGINE_DRIVER` 상수만 정의. 구현 로직 없음. 메서드 시그니처는 엔진 잔류 메서드와 동형. 범위 내 신설.
- 제안: 해당 없음.

### [INFO] ai-turn-orchestrator.service.ts 신설 — 메서드 verbatim 이동
- 위치: `/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (1,332줄)
- 상세: 커밋 메시지가 명시하는 대로 `waitForAiConversation`, `processAiResumeTurn`, `handleAiResumeTurn`, `handleAiMessageTurn`, `finalizeAiNode`, `emitAiWaitingForInput`, `reparkAiResumeTurn`, `handleAiEndConversation`, `handleAiTurnError`, `extractAiTurnErrorPayload` 를 엔진에서 verbatim 이동. `this.X` 호출이 `this.driver.X` 로 재배선된 것 외에 로직 변경 없음. 범위 내 추출.
- 제안: 해당 없음.

### [INFO] execution-engine.service.ts diff — 범위 이탈 여부 확인 불가 (diff 잘림)
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: prompt의 파일 6 diff가 `... (diff omitted due to prompt size limit) ...` 로 잘렸다. 엔진 서비스의 실제 삭제/변경 내용을 직접 확인할 수 없었다. 커밋 메시지(엔진 9,657→8,411줄)와 다른 5개 파일의 일관성으로 보아 추출 후 메서드 삭제 + `implements EngineDriver` + 9개 driver 메서드 `public` 전환이 전부일 것으로 합리적으로 추정된다.
- 제안: diff가 완전히 제공됐다면 구체적 행 단위 검증이 가능했을 것이다. 위험도가 NONE → LOW 로 상향되는 유일한 원인.

## 요약

이 커밋은 god-class `ExecutionEngineService` 에서 AI 멀티턴 생명주기 메서드 ~1,250줄을 신규 `AiTurnOrchestrator` 로 strangler-fig 방식으로 추출하는 순수 리팩토링이다. 신설된 3개 파일(`ai-turn-orchestrator.service.ts`, `ai-turn-orchestrator.service.spec.ts`, `engine-driver.interface.ts`)은 모두 추출 목적에 정확히 부합하며, `execution-engine.module.ts` 와 `execution-engine.service.spec.ts` 의 변경 역시 추출 사실을 반영하는 최소 동기화다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 변경, 기능 확장의 증거는 없다. `execution-engine.service.ts` 의 diff가 잘려 전체 범위를 완전히 확인하지 못한 점만 남는다.

## 위험도

LOW
