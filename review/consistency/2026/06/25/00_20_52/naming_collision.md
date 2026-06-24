# 신규 식별자 충돌 검토 결과

## 발견사항

- **[WARNING]** `buildSingleTurnSystemPrompt` 메서드명이 다른 클래스에서 동일하게 사용 중
  - target 신규 식별자: `AiTurnExecutor.buildSingleTurnSystemPrompt` (private) — `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
  - 기존 사용처: `InformationExtractorHandler.buildSingleTurnSystemPrompt` (private) — `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (정의 라인 1554, 호출부 라인 429)
  - 상세: 두 메서드는 서로 다른 클래스에 속하며 TypeScript private 접근자로 런타임 충돌은 없다. 그러나 시그니처와 의미가 완전히 다르다 — `InformationExtractorHandler.buildSingleTurnSystemPrompt`는 `(outputSchema, instructions, examples) → string` 형태로 정보 추출 전용 시스템 프롬프트를 조립하고, `AiTurnExecutor.buildSingleTurnSystemPrompt`는 `(context, config, systemPrompt, knowledgeBases, conditions) → string` 형태로 §11.4 ordering 에 따른 AI Agent 시스템 프롬프트를 조립한다. 같은 AI 노드 카테고리(`codebase/backend/src/nodes/ai/`) 내 인접 파일 두 곳이 동일 이름을 다른 의미로 사용하므로, IDE 전역 검색·코드 리뷰·향후 유지보수 시 혼동 위험이 있다.
  - 제안: `AiTurnExecutor`의 새 메서드를 `buildAgentSingleTurnSystemPrompt` 또는 `buildSingleTurnAgentSystemPrompt`로 rename 한다. private 메서드이므로 동일 파일(`ai-turn-executor.ts`) 내 정의 1곳 + 호출 1곳(`executeSingleTurn`)만 수정하면 되며, 테스트 파일(`ai-turn-executor.spec.ts`)의 주석에도 반영한다. public API에 영향 없음.

- **[INFO]** `buildSingleTurnMessages` — 전체 코드베이스에서 유일, 충돌 없음
  - target 신규 식별자: `AiTurnExecutor.buildSingleTurnMessages` (private)
  - 기존 사용처: 없음

- **[INFO]** `applySingleTurnMemoryInjection` — 전체 코드베이스에서 유일, 충돌 없음
  - target 신규 식별자: `AiTurnExecutor.applySingleTurnMemoryInjection` (private)
  - 기존 사용처: 없음

## 요약

이번 C-2 1차 슬라이스가 도입하는 신규 private 메서드 3개 중 `buildSingleTurnSystemPrompt`가 같은 AI 노드 카테고리 내 `InformationExtractorHandler` (`/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`) 에 이미 동명의 private 메서드로 존재한다. TypeScript 클래스 스코프 차이로 런타임 충돌은 없지만 시그니처·의미가 다른 동명 메서드가 인접 파일에 공존하므로 IDE 검색·리뷰 혼동 위험이 있다. `AiTurnExecutor` 측 메서드를 `buildAgentSingleTurnSystemPrompt` 등으로 rename 해 구분하는 것을 권장한다. 나머지 두 메서드(`buildSingleTurnMessages`, `applySingleTurnMemoryInjection`)는 전체 코드베이스에서 유일하며 충돌 없음.

## 위험도

LOW
