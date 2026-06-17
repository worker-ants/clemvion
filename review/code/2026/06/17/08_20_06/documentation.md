# Documentation Review

## 발견사항

- **[INFO]** AiTurnOrchestrator — `waitForAiConversation` public 메서드 JSDoc 누락
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `waitForAiConversation` 메서드
  - 상세: `handleAiResumeTurn`/`processAiResumeTurn`에는 상세 JSDoc이 있으나 `waitForAiConversation`(첫 turn park 진입점)에는 없다. 이 메서드는 engine의 `ai_conversation` 분기가 직접 호출하는 public 진입점이므로 park/PARK_RELEASED 반환 의미, resumeState rawConfig 주입 사이드이펙트가 문서화될 필요가 있다.
  - 제안: 다른 public 메서드와 동일 수준의 `/** ... */` JSDoc 추가(park 의미, 반환 PARK_RELEASED 이유, rawConfig 주입 설명).

- **[INFO]** EngineDriver 인터페이스 — `resolveHasDefaultLlmConfigCached` 파라미터/반환 시맨틱 미문서화
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` — `resolveHasDefaultLlmConfigCached` 메서드 (라인 2011-2018 기준)
  - 상세: 현재 주석은 "orchestrator 에서 직접 쓰지 않더라도 driver 에 둔다"는 배치 이유만 설명한다. `workspaceId`·`context` 파라미터의 의미와 `Promise<boolean>` 반환이 무엇을 나타내는지(workspace에 기본 LLM config 존재 여부) 설명이 없다. 인터페이스 다른 멤버들은 파라미터 의미까지 JSDoc으로 서술하고 있어 일관성이 깨진다.
  - 제안: 파라미터별 설명과 `true` = 기본 LLM config 존재 의미를 JSDoc에 추가.

- **[INFO]** execution-engine.module.ts — 순환 DI 해결 방법 문서 불완전
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` — `ENGINE_DRIVER` 바인딩 블록
  - 상세: 주석에 "엔진과 forwardRef 순환 DI"라 명시돼 있으나 실제 `forwardRef()` 없이 `useExisting: ExecutionEngineService`만 사용된다. `useExisting`이 프로바이더 인스턴스 재사용으로 순환 참조를 어떻게 회피하는지 설명이 없어, 첫 접근 개발자에게 혼란을 줄 수 있다.
  - 제안: 주석에 "`useExisting` 은 동일 인스턴스를 다른 토큰으로 노출 — NestJS 가 이미 해소된 인스턴스를 재사용하므로 circular 해결 불필요" 한 줄 추가.

- **[INFO]** execution-engine.service.spec.ts — 파일 레벨 이관 안내 주석 미흡
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 파일 상단
  - 상세: W5, extractAiTurnErrorPayload, buildConversationMetaFromResumeState 등 다수 describe 블록이 `ai-turn-orchestrator.service.spec.ts`로 이관됐다. 개별 제거 지점에는 C-1 step2 이유 주석이 잘 달려 있으나, 파일 상단에 "AI 멀티턴 lifecycle 단위 테스트는 ai-turn-orchestrator.service.spec.ts 참조" 안내가 없어 특정 테스트를 찾는 개발자가 혼란을 겪을 수 있다.
  - 제안: 파일 최상단 또는 메인 `describe('ExecutionEngineService')` 직전에 이관 안내 주석 1줄 추가.

- **[INFO]** 헬퍼 함수 소속 결정 근거 코드에만 존재 — spec 미반영
  - 위치: `ai-turn-orchestrator.service.spec.ts` 라인 622-626 주석, `execution-engine.service.ts` export
  - 상세: `buildConversationConfigFromOutput` / `buildConversationMetaFromResumeState` / `buildAiMessageDebugFromResumeState` 세 함수가 "구현은 엔진 파일에 잔류하며 export만 된다"고 코드 주석에 명시됐다. 커밋 메시지는 "spec 무변"이라 하나, 이 함수들의 장기 소속 결정 근거(C-1 후속 이관 계획 여부)가 spec 문서에는 반영돼 있지 않다.
  - 제안: C-1 후속 단계에서 `spec/5-system/4-execution-engine.md` 갱신 시 이 함수들의 최종 소속 위치와 이유를 rationale로 추가.

## 요약

이번 변경은 AI 멀티턴 생명주기를 `ExecutionEngineService`에서 `AiTurnOrchestrator`로 추출한 대규모 내부 리팩토링으로, 전반적인 문서화 품질은 양호하다. 클래스 레벨 JSDoc, `EngineDriver` 인터페이스 주석, 테스트 파일의 이관 이유 주석 모두 설계 의도를 명확히 전달한다. 주요 미흡점은 `waitForAiConversation` public 메서드의 JSDoc 누락, `resolveHasDefaultLlmConfigCached` 파라미터 시맨틱 불완전, `execution-engine.service.spec.ts` 상단의 이관 안내 주석 부재이며 모두 INFO 수준이다. public API·환경변수·설정 옵션 변경이 없으므로 README·CHANGELOG 업데이트 요구사항은 없다.

## 위험도
LOW
