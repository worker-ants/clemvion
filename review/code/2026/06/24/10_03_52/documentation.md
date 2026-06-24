# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `persistAssistantTurn` 메서드 JSDoc 누락 (`persistUserTurn` 은 있어 일관성 불균형)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` — `persistAssistantTurn` 메서드 선언부
  - 상세: `persistUserTurn` 에는 파라미터 의미와 동작을 설명하는 JSDoc이 작성되어 있으나, 동급 공개 메서드인 `persistAssistantTurn` 에는 JSDoc이 없다. 단, RESOLUTION.md 기록(INFO #10)에 따르면 이 리뷰 사이클 내에서 이미 `@param resumeMeta` 포함 JSDoc 추가와 `finishReason` 의도 주석이 조치된 것으로 확인된다. 현 diff 상 코드에 해당 JSDoc이 포함되어 있는지 재확인이 필요하다. diff에서 보이는 파일(new file 100644)에는 메서드 위에 `@param resumeMeta` JSDoc 블록이 포함되어 있으므로 이미 해소됨.
  - 제안: 해소 확인됨 — `persistAssistantTurn` 위 JSDoc (`finishReason` 의도 + `@param resumeMeta`) 이미 추가.

- **[INFO]** `makeResumeMeta` 반환 타입 인라인 리터럴 중복 → `ResumeMeta` 인터페이스 export 해소 여부
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` — `makeResumeMeta` 함수 및 `persistAssistantTurn` `resumeMeta` 파라미터
  - 상세: diff의 신규 파일에 `ResumeMeta` 인터페이스가 export 되어 있고 `makeResumeMeta` 반환 타입과 `resumeMeta` 파라미터 타입이 이를 참조하고 있다. RESOLUTION.md INFO #11 조치 완료로 기록됨.
  - 제안: 해소 확인됨.

- **[INFO]** `UsageSnapshot` 인터페이스 export 및 JSDoc
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` — `UsageSnapshot` 인터페이스
  - 상세: `UsageSnapshot` 인터페이스가 export 되어 있고, 클래스 JSDoc에 SSE `AssistantStreamEvent`와의 동형 관계가 명시되어 있다(RESOLUTION INFO #3 조치 완료). 인터페이스 자체의 JSDoc은 "SSE `usage` 이벤트와 동형" 설명으로 충분하다.
  - 제안: 해소 확인됨.

- **[INFO]** `makeResumeMeta` 내 `streamMessage` 가 의도적으로 공유 import하는 이유 주석
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` — import 블록
  - 상세: diff에서 `makeResumeMeta` import 블록 위에 캡슐화 경계 관통 의도를 설명하는 4줄 주석이 추가되어 있다. `streamMessage` 가 turn-scoped stall 카운터(`totalStallCount`)를 소유하므로 메타 derive 호출부에 두는 설계 근거를 명시한다. 이는 RESOLUTION INFO #5 "의도 주석 명시" 조치 완료에 해당한다.
  - 제안: 해소 확인됨.

- **[INFO]** 테스트 파일 모듈-레벨 JSDoc
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` — 파일 상단
  - 상세: 테스트 파일 상단에 "M-3 3단계로 분리한 무상태 영속 collaborator 의 단위 테스트" 임을 설명하는 블록 주석과 통합 테스트와의 역할 분담 설명이 있다. 이는 테스트 유지보수자가 이 파일의 범위를 빠르게 파악하는 데 도움을 준다. 양호한 관행.
  - 제안: 추가 조치 불요.

- **[INFO]** spec 문서 SPEC-DRIFT — collaborator 목록 및 의사코드 갱신 필요
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md` §10 Rationale 블록
  - 상세: SUMMARY.md INFO #1·#2·#12 에서 이미 식별됨. (a) §10 의사코드가 직접 호출(`this.persistAssistantTurn(...)`) 방식으로 기술되어 있으나 실제는 위임 경로(`this.turnPersistence.persistAssistantTurn(...)`). (b) `consecutiveStallRounds > 0` → `totalStallCount > 0` 갱신 필요. (c) `WorkflowAssistantStreamService` collaborator 목록에 `AssistantTurnPersistenceService` 가 반영되었는지 미확인. 세 건 모두 planner 후속으로 분류된 pre-existing drift이며, 코드 결함은 아니다. M-3 전체 완료 후 일괄 spec-sync 백로그.
  - 제안: developer 범위 외 — planner 위임. M-3 완료 후 `spec/3-workflow-editor/4-ai-assistant.md` 일괄 갱신.

- **[INFO]** CHANGELOG 업데이트 필요성
  - 위치: 프로젝트 루트 CHANGELOG (존재 여부 별도 확인 필요)
  - 상세: 이번 변경은 내부 리팩토링(behavior-preserving)으로 외부 API 계약 변경이 없다. 공개 API·사용자 대면 기능 변경이 없으므로 CHANGELOG 항목은 필수가 아니다.
  - 제안: 불필요.

- **[INFO]** README 또는 아키텍처 문서 업데이트 필요성
  - 위치: 해당 없음
  - 상세: `AssistantTurnPersistenceService` 는 내부 NestJS 서비스로 외부 사용자 대면 README 항목 추가 대상이 아니다. 아키텍처 ADR이 별도로 관리될 경우 M-3 단계 완료 후 일괄 기록 가능하나 즉시 필수 사항은 아니다.
  - 제안: 불필요.

- **[INFO]** `workflow-assistant-stream.service.spec.ts` 인라인 주석
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` — `makeService()` 함수 내 `turnPersistence` 생성 블록
  - 상세: "M-3 3단계: 세션/메시지 영속은 AssistantTurnPersistenceService 로 분리됐다" 는 4줄 설명 주석이 추가되어 있다. 기존 통합 테스트에서 mock sessionService 를 공유해 persist 위임 경유로도 단언이 성립하는 이유를 설명한다. 적절한 수준의 인라인 문서.
  - 제안: 추가 조치 불요.

## 요약

M-3 3단계(`AssistantTurnPersistenceService` 분리) 는 behavior-preserving 순수 리팩토링으로, 문서화 측면에서 전체적으로 양호하다. 신규 파일(`assistant-turn-persistence.service.ts`)은 클래스·인터페이스·헬퍼 함수 모두에 한국어 JSDoc을 갖추고 있으며, 설계 의도(무상태 collaborator, M-3 단계 참조, 선행 단계와의 패턴 일치)를 명확히 기술하고 있다. `persistAssistantTurn` JSDoc 누락과 `ResumeMeta`/`UsageSnapshot` 타입 문서 중복은 이미 이번 리뷰 사이클 RESOLUTION에서 조치 완료된 것으로 확인된다. 남은 문서화 결함은 spec SPEC-DRIFT 3건(의사코드 위임 경로·`totalStallCount` 기준·collaborator 목록)으로, 이는 planner 위임 사안이며 코드 구현의 문제가 아니다. API 문서·README·CHANGELOG 업데이트는 내부 리팩토링 성격상 불필요하다.

## 위험도

LOW
