# 보안(Security) Review

## 대상

이번 세션(13_21_27)의 실제 코드 diff 는 파일 1~4 뿐이다:
- `codebase/backend/src/modules/execution-engine/utils/to-record.spec.ts` — 문서화 테스트 2건 추가(class 인스턴스 / `Object.create(null)` caveat 고정)
- `codebase/backend/src/modules/execution-engine/utils/to-record.ts` — `isRecord` JSDoc 확장(동작 변경 없음)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `endMultiTurnConversation`/`buildMultiTurnFinalOutput`/`buildRetryState` 체인의 `Record<string, unknown>` 개별 필드 단언(`as`)을 `ResumeState`/`RetryState` 도메인 타입으로 교체하는 순수 컴파일타임 타입-내로잉
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` — `_retryState` allow-list 필드 passthrough 회귀 테스트 추가

파일 5~24(`review/code/2026/07/02/13_08_49/**`, `review/consistency/2026/07/02/13_09_40/**`)는 직전 리뷰 세션의 SUMMARY/RESOLUTION/reviewer 산출물·JSON 상태 파일이 저장소에 커밋되는 것으로, 실행되는 애플리케이션 코드가 아니라 추적용 문서다. 보안 관점의 별도 위험 표면이 아니다(경로 하드코딩된 절대경로 문자열이 포함되어 있으나 이는 로컬 워크트리 경로 기록이며 시크릿/자격증명이 아니다).

## 발견사항

- **[INFO]** `isRecord`/`toRecord` 는 plain-object 전용 가드가 아님 — class 인스턴스·`Object.create(null)` 도 `true`
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts:153-155` (`typeof value === 'object' && value !== null && !Array.isArray(value)`)
  - 상세: prototype pollution 계열 공격에 흔히 쓰이는 `Object.create(null)` 객체나 임의 class 인스턴스(`Date`/`Map`/`RegExp` 등)도 `Record`로 좁혀진다. 다만 이번 diff 는 기존 `(x as Record) ?? {}` 단언을 behavior-preserving 하게 대체하는 것이며, JSDoc·신규 유닛 테스트로 이 caveat 을 명시적으로 고정했다(문서화 테스트, 동작 자체는 리팩터 전후 동일). 현재 호출부(`ai-turn-executor.ts`)는 명시적 필드 읽기(`s.model`, `s.turnCount` 등)만 수행하고 `Object.keys`/spread/`JSON.stringify`/prototype 체인 조작에 이 값을 사용하지 않으므로, 실제 injection 이나 prototype pollution 공격 표면은 확인되지 않는다.
  - 제안: 향후 `toRecord`/`isRecord` 결과를 `Object.assign`/spread 로 병합하거나, 웹훅 payload·LLM tool 응답 등 미신뢰 외부 JSON 을 직접 통과시키는 신규 호출부가 생기면 `Object.getPrototypeOf(value) === Object.prototype` 검사를 추가한 별도 plain-object 가드 사용을 코드 리뷰에서 재확인할 것. 현재 diff 범위에서는 조치 불필요.

- **[INFO]** `ResumeState`/`RetryState` 스키마는 `.partial().catchall(z.unknown())` 오픈 — 런타임 `parse`/`safeParse` 미수행
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (credentialStripSubsetShape 및 파생 스키마), `ai-turn-executor.ts:279` (`const s = state as ResumeState`)
  - 상세: `_resumeState`/`_retryState`는 DB 에 영속되는 신뢰 경계 데이터지만, 이번 diff 는 zod 스키마를 실행 시점 검증이 아니라 "allow-list 문서화 + 타입 파생 + 테스트 oracle" 용도로만 쓴다는 기존 설계를 그대로 따른다(모듈 헤더 JSDoc 에 의도 명시, §7.5 graceful-reset semantics 보존 목적). 즉 malformed/조작된 DB row 가 들어와도 타입 시스템만 통과할 뿐 실행 시점 검증은 없으나, 이는 이번 커밋이 새로 도입한 리스크가 아니라 기존 `as Record<string, unknown>` 단언과 동일한 신뢰 수준의 현상 유지다.
  - 제안: 이번 diff 범위 밖. `_retryState`/`_resumeCheckpoint` row 를 다른 워크스페이스/사용자가 직접 쓰거나 읽을 수 있는 접근 통제 우회 경로가 별도로 존재하는지는 이번 변경과 무관하게 주기적으로 재확인 권장(이번 diff 는 해당 접근 경로를 변경하지 않음).

- **[INFO]** `buildRetryState` 의 credential-strip allow-list 로직이 타입 전환 후에도 그대로 보존됨 (긍정적 확인)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:334-379` (`buildRetryState`), 반환 필드 목록
  - 상세: `source: Record<string, unknown>` → `source: ResumeState` 타입 변경, 그리고 `source.totalThinkingTokens as number | undefined` 류 개별 단언 제거는 순수 컴파일타임 타입-내로잉이다. 반환 객체는 여전히 명시적 필드별 whitelist(`messages`/`turnCount`/`totalInputTokens`/`totalOutputTokens`/`totalThinkingTokens`/`toolCalls`/`model`/`temperature`/`maxTokens`/`knowledgeBases`/`ragTopK`/`ragThreshold`/`ragSources`/`mcpServers`/`pendingFormToolCall` 등)를 구성하고, 소스 코드 주석(`ai-turn-executor.ts:375-377`)에 `llmConfigId`/`workspaceId`/`executionId`/`presentationTools`/`conditions`/`maxTurns` 등 credential/context-binding 필드를 **의도적으로 미동봉**한다고 명시되어 있다. `source` 전체를 spread 하는 패턴으로 바뀌지 않았으므로, 타입 좁힘 리팩터가 credential 필드를 `_retryState`(DB 영속, TTL)로 유출시키는 회귀를 만들지 않았음을 확인했다.
  - 제안: 없음 — 안전하게 수행된 리팩터.

- **[INFO]** 신규 회귀 테스트(`ai-turn-executor.spec.ts`)가 실제로 non-default 값 검증
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts:213-238`
  - 상세: `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens` 를 기본값이 아닌 값으로 세팅해 `_retryState` 로 그대로 운반되는지 검증한다. 이는 이전 세션(13_08_49) WARNING(W-1/W-2)에 대한 fix 로, cast 제거가 credential-strip allow-list 의 필드 passthrough 를 깨지 않는지 확인하는 보안 관련 회귀 가드 역할도 겸한다. credential 필드(`llmConfigId` 등)가 새어나가지 않는지는 이 테스트가 직접 assert 하지 않지만(negative-space 테스트 부재), 소스 코드 자체가 whitelist 구조라 별도 위험 증가는 아니다.
  - 제안: (선택, 비차단) 후속으로 `_retryState` 가 `llmConfigId`/`workspaceId` 등 credential/context-binding 필드를 **포함하지 않음**을 직접 assert 하는 negative 테스트를 추가하면 향후 회귀(예: 실수로 `...source` spread 도입) 조기 발견에 도움이 된다.

- **[INFO]** 에러 메시지 새니타이징·tool 결과 preview cap 은 이번 diff 대상 밖이며 변경 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 내 `sanitizeToolError`, `TOOL_RESULT_PREVIEW_CHARS` 관련 로직 (diff 미포함 구간)
  - 상세: 기존 방어 로직(전체 예외 메시지는 서버 로그로만, 클라이언트/LLM 노출분은 truncate)이 이번 변경으로 영향받지 않았다.
  - 제안: 없음.

- **하드코딩된 시크릿 / SQL·커맨드 인젝션 / 인증·인가**: 이번 diff 범위(타입 가드 유틸 + 타입-내로잉 리팩터 + 테스트)에는 해당 패턴이 존재하지 않는다. 신규 API 엔드포인트, DB 쿼리, 외부 프로세스 호출, 인증/세션 로직 변경이 없다.

## 요약

이번 변경은 refactor-03 M-7 클러스터의 순수 타입-내로잉 리팩터로, `ai-turn-executor.ts`의 `state as Record<string, unknown>` 개별 필드 단언을 zod-derived `ResumeState`/`RetryState` 도메인 타입으로 교체하는 컴파일타임 전용 작업이며, `to-record.ts`/`to-record.spec.ts`는 기존 유틸의 caveat(plain-object 가드가 아님)을 JSDoc·테스트로 문서 고정한 것이다. 런타임 로직(값 변환, credential-strip allow-list, 에러 새니타이징, tool 결과 preview cap)은 diff 전후 동일하며 새로운 인젝션·인증/인가 우회·시크릿 노출 벡터는 발견되지 않았다. `isRecord`의 permissive 함(class 인스턴스·null-prototype 객체 통과)과 `ResumeState` 스키마의 런타임 미검증(catchall open)은 모두 기존부터 존재하고 문서화된 의도적 trade-off이며, 이번 diff 가 그 경계를 넓히거나 credential 필드 유출 경로를 새로 만들지 않았음을 소스 검증으로 확인했다. 리뷰/추적용 markdown·JSON 산출물(파일 5~24)의 신규 커밋도 보안 관점 위험 표면을 추가하지 않는다.

## 위험도
NONE
