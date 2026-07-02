# 보안(Security) 리뷰

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (신규)
- `review/code/2026/07/02/11_59_12/*` (직전 리뷰 세션의 RESOLUTION/SUMMARY/에이전트별 리포트 — 신규 커밋된 산출물, 코드 아님)

이번 변경은 refactor-03 M-7 클러스터(RESUME-STATE)로, multi-turn AI 노드(`ai_agent` /
`information_extractor`)의 resume/checkpoint/retry 상태를 다루던 `Record<string, unknown>`
/ `Record & { expiresAt?: unknown }` 류의 느슨한 구조 단언을 `resume-state.schema.ts` 의
zod-derived 타입(`ResumeState` / `ResumeCheckpoint` / `RetryState`)으로 치환하는 **순수 타입
리팩토링**이다. 파일 주석에 "behavior-preserving — 런타임 경계에서 parse/safeParse 하지
않는다"고 명시되어 있고, 실제 diff 도 타입 단언 교체 + import 추가 수준으로 런타임 분기/직렬화
로직은 변경되지 않았다. 아울러 직전 리뷰(`review/code/2026/07/02/11_59_12`)에서 testing
reviewer 가 지적한 W-1(builder↔schema drift 가드가 non-strict `safeParse` 를 써서 credential
유입을 실제로 검출하지 못하던 문제)이 `.strict()` 로 수정되어 이번 커밋에 포함되었다 —
credential-strip 회귀 방지 측면에서 개선.

## 발견사항

- **[INFO]** zod 스키마가 런타임 검증(parse/safeParse)에 쓰이지 않고 타입/테스트 오라클
  용도로만 존재
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 상단 주석, `resumeCheckpointSchema` / `retryStateSchema` / `resumeStateSchema`
  - 상세: 세 스키마 모두 프로덕션 코드 경로(`ai-turn-orchestrator.service.ts`, `retry-turn.service.ts`, `execution-engine.service.ts`)에서는 `as ResumeState` / `as ResumeCheckpoint` / `as RetryState` 형태의 컴파일타임 타입 단언으로만 쓰이고, `.parse()` / `.safeParse()` 는 `execution-engine.service.spec.ts` 및 `resume-state.schema.spec.ts` 단위 테스트에서만 호출된다. 즉 DB(`NodeExecution.outputData._resumeCheckpoint` / `_retryState`)에서 읽어들인 값이 실제로 스키마를 만족하는지는 런타임에 전혀 검증되지 않는다. 이는 설계 의도(§7.5 rehydration 의 graceful-reset semantics 보존 — 부재/부분/미래-버전 checkpoint 를 거부/coerce 하지 않고 기본값으로 보강하는 기존 동작 유지)로 명시적으로 채택된 트레이드오프이므로 취약점이라기보다는 알려진 한계다.
  - 제안: 현재 방침(behavior-preserving) 유지가 합리적이나, 향후 DB에 저장된 `_retryState` / `_resumeCheckpoint` 가 외부 변조 가능 경로(관리자 콘솔의 raw JSONB 편집, 마이그레이션 스크립트 버그 등)에 노출될 가능성이 생기면 `retryLastTurn` 진입점에서 `expiresAt`(TTL) 외에 스키마 형태 자체도 `safeParse` 로 방어하는 것을 고려. 현재는 개별 필드 단위 방어(`typeof retryAfterSec === 'number'`, `Date.parse` 등)로 충분히 커버되어 CRITICAL/WARNING 등급은 아니다.

- **[INFO]** credential-strip allow-list 가 이번 커밋에서 실제로 강화됨 (긍정적, W-1 fix 반영)
  - 위치: `resume-state.schema.ts` `CREDENTIAL_CONTEXT_FIELDS`; `execution-engine.service.spec.ts` 두 M-7 drift 가드 사이트(`resumeCheckpointSchema.strict().safeParse(checkpoint).success` + `for (const cred of CREDENTIAL_CONTEXT_FIELDS) expect(checkpoint).not.toHaveProperty(cred)`); `resume-state.schema.spec.ts` 전용 스키마 shape 테스트
  - 상세: `_resumeCheckpoint` / `_retryState` 에 `llmConfigId`, `workspaceId`, `rawConfig`(잠재적으로 credential 을 포함할 수 있는 raw node config snapshot), `conversationThreadRef` 등이 유입되지 않도록 하는 정책이 `.strict()` zod 스키마 + 단위 테스트 drift 가드로 executable 문서화되었다. 직전 리뷰 세션(`11_59_12`)에서 testing reviewer 가 지적한 대로, 원래 `execution-engine.service.spec.ts` 의 두 어서션 사이트는 non-strict `resumeCheckpointSchema.safeParse(checkpoint)` 를 사용했는데, zod 기본 object 스키마는 알 수 없는 키를 조용히 strip 한 뒤 `success:true` 를 반환하므로 credential 유입을 전혀 검출하지 못하는 **"항상-참" 어서션**이었다(실질 방어는 별도의 `not.toHaveProperty` 뿐). 이번 커밋에서 두 사이트 모두 `.strict()` 로 수정되어, 실 `buildResumeCheckpoint` 산출물에 credential/알 수 없는 키가 섞이면 strict 파싱이 실제로 실패해 drift 를 검출한다. `resumeCheckpointSchema` 자체도 closed object(`z.object` without `.passthrough()`)라 스키마 shape 차원에서도 이중 방어가 걸려 있다.
  - 제안: 없음 (개선 사항으로 기록). RESOLUTION.md 에 검증(335 tests PASS) 근거도 남아 있어 fix 신뢰도 확인됨.

- **[INFO]** `isRecord` 로 통합된 `_resumeState` 타입 가드는 기존 로직과 동등
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` `wrapBareAsNodeHandlerOutput`
  - 상세: `obj._resumeState !== null && typeof obj._resumeState === 'object' && !Array.isArray(obj._resumeState)` 3중 조건이 `to-record.ts` 의 `isRecord()` 호출로 치환됐다. 두 구현은 동치(behavior-preserving)이며 새 취약점을 도입하지 않는다. `adaptHandlerReturn`(strict 경로)의 `maskSensitiveFields`/credential 마스킹 로직은 이번 diff 로 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** 에러 처리·민감정보 노출 경로는 이번 변경으로 영향받지 않음
  - 위치: `ai-turn-orchestrator.service.ts` 내 에러 페이로드 추출/`sanitizeLastErrorMessage` 호출부(리뷰 대상 파일에 포함되나 diff 범위 밖)
  - 상세: LLM 에러의 `message`/`details` 는 기존과 동일하게 sanitize 이후에만 클라이언트/로그에 노출되는 경로를 유지한다. `_resumeState`/`_retryState`/`_resumeCheckpoint` 타입 단언 교체가 이 경로의 조건 분기에 영향을 주지 않음을 확인했다.
  - 제안: 없음 (현행 유지 확인).

- **[INFO]** 리뷰 산출물(`review/code/2026/07/02/11_59_12/**`)의 커밋 포함
  - 위치: `RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, 각 에이전트별 `*.md`
  - 상세: 문서/JSON 상태 파일로, 시크릿·자격증명·민감 인프라 정보 없음. 경로/파일명에도 하드코딩된 credential 없음. 보안 관점에서 검토 대상 아님.
  - 제안: 없음.

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩된 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지
않은 암호화 알고리즘 사용은 이번 diff 범위에서 발견되지 않았다. `retry-turn.service.ts` 의
JSONB 갱신(`output_data - '_retryState'` 형태의 컬럼 연산)은 이번 diff 로 변경되지 않은 기존
코드이며 파라미터 바인딩된 리터럴 컬럼명이라 SQL 인젝션 우려 없음.

## 요약
이번 변경은 multi-turn AI resume/checkpoint/retry 상태를 다루던 느슨한 `Record<string, unknown>` 구조 단언을 zod-derived 타입으로 대체하는 behavior-preserving 리팩토링이며, 새로운 인젝션·인증/인가·암호화·시크릿 하드코딩 관련 취약점은 발견되지 않았다. 오히려 이번 커밋에는 직전 리뷰에서 지적된 `.strict()` 미적용 문제(W-1, credential-strip drift 가드가 사실상 항상-참이던 결함)에 대한 fix 가 포함되어 있어, `CREDENTIAL_CONTEXT_FIELDS` allow-list 를 실제로 강제하는 회귀 테스트로 승격시킨 점이 보안 관점에서 뚜렷한 개선이다. zod 스키마가 런타임 파싱에는 쓰이지 않아 DB 저장값에 대한 실행-시점 검증 강화 효과는 없다는 점은 설계상 의도된(§7.5 graceful-reset 보존) 한계로 남아 있으나 CRITICAL/WARNING 등급의 문제는 아니다.

## 위험도
NONE
