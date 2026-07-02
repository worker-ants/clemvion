# 요구사항(Requirement) Review — M-7 ai-turn-executor 클러스터 (retry/resume-state 타입화)

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/utils/to-record.spec.ts` (문서화 테스트 4건 추가)
- `codebase/backend/src/modules/execution-engine/utils/to-record.ts` (`isRecord` JSDoc caveat 보강)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`endMultiTurnConversation` / `buildMultiTurnFinalOutput` / `buildRetryState` 의 `as Record`/`as number`/`as unknown[]` 단언을 `ResumeState`/`RetryState` (from `resume-state.schema.ts`, #783) 명명 타입으로 치환)

commit: `d089c211b` (`refactor(engine): M-7 ai-turn-executor 클러스터 — retry/resume-state 경로 ResumeState/RetryState 타입화`)

## 검증 수행

- `npx tsc --noEmit` — 전체 리포지토리 기준 에러 다수 존재하나 전부 본 diff 와 무관한 pre-existing 파일(예: `execution-engine.service.spec.ts`, `integration-oauth.service.cafe24.spec.ts` 등). `ai-turn-executor.ts`/`to-record.ts` 자체는 0 에러. `ai-turn-executor.spec.ts` 의 `NodeHandlerOutput → Record<string, unknown>` TS2352 6건은 `git diff d089c211b~1 d089c211b -- .../ai-turn-executor.spec.ts` 가 빈 diff 임을 확인해 본 커밋 이전부터 존재하던 것으로 확인.
- `npx jest to-record.spec.ts` — 9/9 PASS.
- `npx jest ai-turn-executor.spec.ts` — 22/22 PASS.
- `npx jest resume-state.schema.spec.ts` — 11/11 PASS.
- `npx eslint ai-turn-executor.ts to-record.ts to-record.spec.ts` — warning 6건, 전부 `git blame` 로 본 커밋 이전 라인(2026-06-22/06-27) 임을 확인. 본 diff 가 신규로 유발한 warning 없음.

## 발견사항

- **[INFO]** `endMultiTurnConversation` 의 `state as ResumeState` 는 unchecked 단언
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2927`
  - 상세: `resume-state.schema.ts` 자체가 명시하듯(스키마 주석) 이 zod 스키마는 런타임 `parse`/`safeParse` 용이 아니라 "allow-list 문서화 + 타입 파생" 목적이다. 즉 `const s = state as ResumeState` 는 컴파일타임 타입만 부여할 뿐 런타임 검증은 없다 — 이는 리팩터 전 `state.turnCount as number` 등 개별 단언과 정확히 동일한 안전성 수준이며 **behavior-preserving** 의도와 일치한다(회귀 아님). 다만 `endMultiTurnConversation` 이 두 핸들러(`ai_agent`/`information_extractor`)가 공유하는 공개 인터페이스라는 점을 감안하면, 호출측이 실제로 `ai_agent` 소유의 `_resumeState` 만 넘긴다는 불변식이 코드상 타입으로 강제되지 않고 여전히 관례(convention)에 의존한다. `ai-turn-orchestrator.service.ts:890` 호출부에서 `resumeState: Record<string, unknown>` 로 받아 그대로 전달하므로, 이 지점만 놓고 보면 spec 위반은 아니고 회색지대(INFO) — 실제로 M-7 커밋 메시지도 "domain-type 캐스트(스키마 enrich 필요)" 를 후속 과제로 명시하고 있어 의도된 단계적 축소임이 확인된다.
  - 제안: 변경 불필요. 후속 M-7 클러스터에서 스키마 enrich (예: `model: z.string().optional()`) 시 `as string` 캐스트도 함께 제거될 예정 — 커밋 메시지에 이미 명시돼 있어 계획대로 진행.

- **[INFO]** `pendingFormToolCall` 타입이 `Record<string, unknown> | undefined` 로 축소 검증되나 실제 형태는 `{ toolCallId, formConfig }` 같은 특정 shape
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:60`, `ai-turn-executor.ts:3142`
  - 상세: 스키마가 `z.record(z.string(), z.unknown()).optional()` 로 넓게 선언돼 있어 `buildRetryState` 에서 `source.pendingFormToolCall` 을 그대로 `RetryState.pendingFormToolCall` 에 대입하는 것은 타입상 안전하지만, 실질적으로 이 필드는 특정 구조(`blockingFormRender` 의 `formConfig` 캐리어)를 가진다. 기존 코드(`as Record<string, unknown> | undefined`)와 동일한 안전성 수준이라 회귀는 아니며, "허용된 축소"(§M-7 계획상 명시된 "domain-type 캐스트는 스키마 enrich 가 필요한 후속 과제") 범위 밖의 필드다.
  - 제안: 변경 불필요 — 현행 커밋 스코프 밖.

## Spec Fidelity 점검

- 관련 spec: `spec/5-system/4-execution-engine.md` §1.3 (`_resumeState`/`_resumeCheckpoint`/`_retryState` 3종 SoT), `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 (retryable error 종결 시 `_retryState` 운반).
- `resume-state.schema.ts` 의 `credentialStripSubsetShape` 필드 목록(`messages`/`turnCount`/`totalInputTokens`/`totalOutputTokens`/`totalThinkingTokens`/`toolCalls`/`model`/`temperature`/`maxTokens`/`knowledgeBases`/`ragTopK`/`ragThreshold`/`ragSources`/`mcpServers`/`pendingFormToolCall`)는 spec §1.3 "shape: `_retryState` 와 동일 부분집합(messages / turnCount / model / temperature / maxTokens / knowledgeBases / RAG / MCP / pendingFormToolCall? 등)" 서술과 line-level 로 일치.
- `buildRetryState` 가 `llmConfigId`/`workspaceId`/`executionId`/`presentationTools`/`conditions`/`maxTurns`/`rawConfig`/`conversationThreadRef` 를 의도적으로 미동봉하는 것은 spec §1.3 "credential / context-binding 필드는 미동봉... 재개 시 `node.config` 재평가로 재유도" 및 Rationale "credential-strip 부분집합" 서술과 일치. `CREDENTIAL_CONTEXT_FIELDS` 상수 목록과도 정합.
- `_retryState.expiresAt` TTL 60분 기본값 + `AI_RETRY_STATE_TTL_MINUTES` override 는 spec §1.3 "TTL(`expiresAt`, 기본 60분)" 및 Rationale 서술과 일치 (`DEFAULT_RETRY_STATE_TTL_MINUTES = 60`, 본 diff 범위 밖이지만 주변 코드 검증).
- 이번 diff 자체는 **타입 표현만 변경**(`Record<string, unknown>` → 명명된 `ResumeState`/`RetryState`)하고 런타임 값·필드 선택·기본값(`?? 0`, `?? []`)·에러 코드·상태 전이를 전혀 바꾸지 않았다 — 커밋 메시지의 "behavior-preserving" 주장이 코드 diff 와 일치함을 라인 단위로 확인했다 (`?? {}` / `?? []` / `?? 0` 폴백 표현이 caret 이동만 있을 뿐 값 동일).
- `to-record.ts`/`to-record.spec.ts` 변경은 기존 유틸의 caveat 문서화 + 회귀 방지 테스트 추가로, 별도 spec 문서에 정의된 대상이 아니며(내부 유틸리티, `spec/conventions/` 에 SoT 없음) 회색지대 INFO 조차 발생시키지 않는 순수 방어적 추가.

## 요약

세 파일 모두 순수 리팩터 성격의 변경으로, 기존 `as Record<string, unknown>`/`as number`/`as unknown[]` 단언을 `resume-state.schema.ts`(#783)에서 정의한 명명 타입(`ResumeState`/`RetryState`)으로 대체해 가독성·타입 안전성을 높였을 뿐 런타임 값·기본값·필드 선택·에러 코드·spec 이 규정한 `_retryState`/`_resumeState` allow-list 는 전혀 바뀌지 않았다. `to-record.ts` 변경은 기존 유틸의 알려진 caveat(class 인스턴스도 `true` 반환)을 JSDoc + 테스트로 명문화하는 순수 추가다. tsc/lint/jest 로 직접 검증한 결과 이 diff 가 새로 유발한 타입 에러·lint 경고·테스트 실패는 없으며, 기존에 존재하던 무관한 에러/경고는 git blame 으로 pre-existing 임을 확인했다. TODO/FIXME 류 미완성 마커 없음, 관련 spec(§1.3, §7.9) 본문과 필드명·기본값·credential 제외 정책이 line-level 로 일치한다. 위험도가 낮은 clean 변경으로 판단된다.

## 위험도

LOW
