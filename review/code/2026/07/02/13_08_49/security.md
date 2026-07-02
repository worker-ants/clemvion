# 보안(Security) Review

## 발견사항

- **[INFO]** `isRecord`/`toRecord` 가 plain-object 가 아닌 임의 객체(class 인스턴스, `Object.create(null)`)도 허용
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts:186-192`, `to-record.spec.ts`
  - 상세: `typeof value === 'object' && value !== null && !Array.isArray(value)` 기반 가드라 prototype pollution 성격의 `Object.create(null)` 객체나 임의 class 인스턴스도 `Record`로 좁혀진다. 다만 이 유틸은 기존 `(x as Record) ?? {}` 단언의 behavior-preserving 런타임 대체로 명시돼 있고, JSDoc 에 "plain-object 가드 아님" caveat 을 명확히 문서화했으며 신규 테스트도 이를 고정하는 문서화 테스트다. 실제 injection 벡터가 되려면 이 값이 이후 `Object.keys`/`JSON.stringify`/prototype 체인 조작에 사용돼야 하는데, 현재 호출부는 명시적 필드 접근(`s.model`, `s.turnCount` 등)만 수행하므로 prototype pollution 공격 표면은 확인되지 않는다.
  - 제안: 향후 `toRecord`/`isRecord` 결과를 `Object.assign`/spread 로 병합하거나 외부 신뢰되지 않은 JSON(예: webhook payload, LLM tool 응답)을 직접 통과시키는 신규 호출부가 생기면, `Object.getPrototypeOf(value) === Object.prototype` 검사를 추가한 별도 plain-object 가드를 사용하도록 코드 리뷰에서 재확인.

- **[INFO]** `ResumeState`/`RetryState` 스키마가 `.partial().catchall(z.unknown())` 로 열려 있어 런타임 검증(parse/safeParse) 없이 타입 캐스팅만 수행
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:81-130`
  - 상세: 주석에 명시된 대로 의도적 설계(behavior-preserving, 부분 checkpoint graceful-reset semantics 유지)다. `_resumeState`/`_retryState`는 DB에 영속되는 신뢰 경계 데이터이지만, 스키마가 실제 zod `parse` 를 하지 않으므로 malformed/조작된 DB row 가 들어와도 타입 시스템만 통과할 뿐 런타임 검증은 없다. 이는 이번 diff 가 새로 도입한 리스크가 아니라 기존 `as Record<string, unknown>` 단언과 동일한 신뢰 수준을 유지하는 것(현상 유지)이며, `buildResumeCheckpoint`/`buildRetryState` 쪽에서 credential 필드를 allow-list 기반으로 제외하는 별도 보안 통제가 존재한다.
  - 제안: 이번 PR 범위 밖. 다만 `_retryState`/`_resumeCheckpoint` DB row 를 공격자가 직접 쓸 수 있는 경로(예: 워크스페이스 간 접근 통제 우회)가 존재한다면 별도 검토가 필요 — 현재 diff 만으로는 해당 접근 경로 변경이 없음을 확인.

- **[INFO]** `buildRetryState` 의 credential-strip 로직이 이번 리팩터 후에도 allow-list 방식 그대로 보존됨 (긍정적 확인)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:285-329`
  - 상세: `source: Record<string, unknown>` → `source: ResumeState` 타입 변경과 개별 필드 단언 제거(`source.totalThinkingTokens as number | undefined` → `source.totalThinkingTokens`)는 순수 컴파일 타임 타입 내로잉이며, 반환 객체가 여전히 `llmConfigId`/`workspaceId`/`executionId`/`presentationTools`/`conditions`/`maxTokens`(문서 주석상 credential 미포함 필드) 등을 명시적으로 제외하는 필드별 whitelist 구성을 그대로 유지한다. `source` 전체를 spread 하는 패턴으로 바뀌지 않았으므로 credential/context-binding 필드가 `_retryState`(DB 영속, TTL)로 유출될 회귀는 발견되지 않았다.
  - 제안: 없음 — 의도된 안전한 리팩터로 판단.

- **[INFO]** 에러 메시지 새니타이징(`sanitizeToolError`) 및 tool 결과 preview cap(`TOOL_RESULT_PREVIEW_CHARS`) 은 이번 diff 대상 밖이며 변경 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:437-445`, `423-428`
  - 상세: 기존에 이미 구현된 방어 로직(전체 예외 메시지는 서버 로그에만, 클라이언트/LLM 에는 truncate·요약본만 노출)이 이번 diff 로 인해 영향받지 않았음을 확인했다.

## 요약

이번 변경은 refactor-03 M-7 클러스터의 순수 타입-내로잉 리팩터로, `state as Record<string, unknown>` 개별 필드 단언을 `ResumeState`/`RetryState` zod-derived 타입으로 교체하는 컴파일 타임 전용 작업이다. 런타임 로직(값 변환, 조건 분기, credential-strip allow-list, 에러 새니타이징, tool 결과 preview cap)은 diff 전후 동일하며 새로운 인젝션·인증/인가·시크릿 노출 벡터는 발견되지 않았다. `isRecord`가 plain-object 가 아닌 객체도 허용하는 점과 `ResumeState` 스키마가 런타임 미검증(permissive catchall)이라는 점은 기존부터 문서화된 의도적 trade-off이며, 이번 커밋이 그 경계를 넓히거나 credential 필드 유출 경로를 새로 만들지 않았음을 확인했다.

## 위험도
NONE
