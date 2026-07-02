# 보안(Security) 리뷰

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.spec.ts`
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (신규)

이번 변경은 refactor-03 M-7 클러스터로, multi-turn AI resume/checkpoint/retry 상태에
흩어져 있던 `Record<string, unknown>` 구조 단언을 `resume-state.schema.ts` 의 zod-derived
타입(`ResumeState` / `ResumeCheckpoint` / `RetryState`)으로 치환하는 순수 타입 리팩토링이다.
파일 자체 주석에 "behavior-preserving — 런타임 경계에서 parse/safeParse 하지 않는다"고
명시되어 있고, 실제 diff 도 타입 단언 교체 + import 추가 수준으로 런타임 분기/직렬화 로직은
그대로다.

## 발견사항

- **[INFO]** zod 스키마가 런타임 검증(parse/safeParse)에 쓰이지 않고 타입/테스트 오라클
  용도로만 존재
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 상단 주석, `resumeCheckpointSchema` / `retryStateSchema` / `resumeStateSchema`
  - 상세: 세 스키마 모두 프로덕션 코드 경로(`ai-turn-orchestrator.service.ts`, `retry-turn.service.ts`, `execution-engine.service.ts`)에서는 `as ResumeState`/`as ResumeCheckpoint`/`as RetryState` 형태의 컴파일타임 타입 단언으로만 쓰이고, `.parse()`/`.safeParse()` 는 오직 `execution-engine.service.spec.ts` 단위 테스트에서만 호출된다. 즉 DB(`NodeExecution.outputData._resumeCheckpoint`/`_retryState`)에서 읽어들인 값이 실제로 스키마를 만족하는지는 런타임에 전혀 검증되지 않는다. 이는 설계 의도(§7.5 rehydration 의 graceful-reset semantics 보존)로 명시적으로 채택된 트레이드오프이므로 취약점이라기보다는 알려진 한계다.
  - 제안: 현재 방침(behavior-preserving) 유지가 합리적이나, 만약 향후 DB에 저장된 `_retryState`/`_resumeCheckpoint` 가 외부 변조 가능 경로(예: 관리자 콘솔의 raw JSONB 편집, 마이그레이션 스크립트 버그 등)에 노출될 가능성이 생기면 최소한 `retryLastTurn` 진입점에서 `expiresAt`(TTL) 외에 스키마 형태 자체도 `safeParse` 로 방어하는 것을 고려할 수 있다. 현재는 개별 필드 단위 방어(`typeof retryAfterSec === 'number'`, `Date.parse` 등)로 충분히 커버되고 있어 CRITICAL/WARNING 등급은 아니다.

- **[INFO]** credential-strip allow-list 는 이번 커밋에서 실제로 강화됨(긍정적)
  - 위치: `resume-state.schema.ts` `CREDENTIAL_CONTEXT_FIELDS`, `execution-engine.service.spec.ts` M-7 drift 가드 (`resumeCheckpointSchema.safeParse(checkpoint).success` + `not.toHaveProperty(cred)`)
  - 상세: `_resumeCheckpoint`/`_retryState` 에 `llmConfigId`, `workspaceId`, `rawConfig`(잠재 credential 포함 가능한 raw node config snapshot) 등이 유입되지 않도록 하는 기존 정책(WARN #6, 관련 커밋 이력)이 이번 변경으로 `.strict()` 스키마 + 단위 테스트 오라클로 executable 문서화되었다. `resumeCheckpointSchema` 가 closed object(`z.object` without `.passthrough()`)이므로 `buildResumeCheckpoint` 산출물에 새 필드가 실수로 추가되면 스키마 검증(safeParse)이 실패해 테스트에서 즉시 드러난다 — 이는 credential 누출 회귀를 조기에 잡는 안전장치로 보안 관점에서 긍정적인 변화다.
  - 제안: 없음 (개선 사항으로 기록).

- **[INFO]** `isRecord` 로 통합된 `_resumeState` 타입 가드는 기존 로직과 동등
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` `wrapBareAsNodeHandlerOutput`
  - 상세: `obj._resumeState !== null && typeof === 'object' && !Array.isArray(...)` 조건이 `to-record.ts` 의 `isRecord()` 호출로 치환됐다. 두 구현은 동치(behavior-preserving)이고 별도 새 취약점을 도입하지 않는다.
  - 제안: 없음.

- **[INFO]** 에러 메시지 sanitize 경로는 이번 변경으로 영향받지 않음
  - 위치: `ai-turn-orchestrator.service.ts` `extractAiTurnErrorPayload` (`sanitizeLastErrorMessage` 호출부, JSON.stringify→sanitize→JSON.parse 체인)
  - 상세: 이번 diff 범위 밖이지만 리뷰 대상 파일에 포함되어 있어 확인함 — LLM 에러의 `message`/`details` 는 `sanitizeLastErrorMessage` 로 토큰/시크릿 echo 를 차단한 뒤에만 클라이언트/로그에 노출되고, 비직렬화 가능한 예외 객체에 대한 try/catch fallback 도 갖춰져 있어 에러 처리 경로에서 민감정보 노출 위험은 낮다. 이번 변경으로 이 로직이 수정되지는 않았다.
  - 제안: 없음 (현행 유지 확인).

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지
않은 암호화 알고리즘 사용 등은 이번 diff 범위에서 발견되지 않았다. `retry-turn.service.ts` 의
JSONB `-` 연산자 사용(`output_data - '_retryState'`)은 파라미터 바인딩된 컬럼명 리터럴이며
사용자 입력이 SQL 문자열에 직접 삽입되지 않아 SQL 인젝션 우려 없음(이 부분도 이번 diff 로
변경되지 않은 기존 코드).

## 요약
이번 변경은 multi-turn AI resume/checkpoint/retry 상태를 다루던 느슨한 `Record<string, unknown>` 구조 단언을 zod-derived 타입으로 대체하는 behavior-preserving 리팩토링으로, 새로운 인젝션·인증/인가·암호화·시크릿 하드코딩 관련 취약점은 발견되지 않았다. 오히려 `CREDENTIAL_CONTEXT_FIELDS` allow-list 를 executable 스키마 + 단위 테스트 drift 가드로 승격시켜 기존에 코드 리뷰 코멘트(WARN #6 등)로만 관리되던 credential-strip 정책을 회귀 테스트로 고정한 점은 보안 관점에서 긍정적이다. 다만 zod 스키마가 런타임 파싱에는 쓰이지 않아 DB 저장값에 대한 실질적 실행-시점 검증 강화 효과는 없다는 점은 설계상 의도된 한계로 기록해둔다.

## 위험도
NONE
