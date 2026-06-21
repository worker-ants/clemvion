# 보안(Security) 리뷰

대상 커밋: `c82b4a03` — test(ai-agent): M-1 3단계 ai-review 보강 — capFormDataBytes·form_submitted resume 직접 테스트

---

## 발견사항

### [INFO] `sanitizeToolError` — URL/credential 패턴 마스킹 없음 (pre-existing)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L99–107
- 상세: `sanitizeToolError` 는 에러 메시지에서 첫 줄만 취하고 200자로 자른다. base64 / 토큰 모양 문자열 제거 의도가 주석에 명시되어 있으나 실제 구현에는 정규식 마스킹이 없다. 따라서 첫 줄에 `Bearer eyJ...` 형태의 토큰, `Authorization: ...`, URL 경로에 포함된 시크릿 등이 그대로 LLM 컨텍스트·클라이언트·telemetry에 노출될 수 있다. 이번 PR 변경이 아닌 pre-existing 코드이며 RESOLUTION.md I#3 에서 "별건 보안 개선"으로 인지·defer 처리됨.
- 제안: 200자 절단 전에 `Bearer\s+[A-Za-z0-9\-._~+/]+=*`, `Authorization:\s+\S+`, URL 내 쿼리스트링 등 민감 패턴을 `[REDACTED]`로 치환하는 정규식 레이어를 추가한다. 별건 보안 개선 이슈로 추적 권장.

### [INFO] `resolveRetryStateTtlMinutes` — `process.env` 직접 읽기, 상한 clamp 없음 (pre-existing)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L179–187
- 상세: `AI_RETRY_STATE_TTL_MINUTES` 환경변수를 비즈니스 로직 내에서 직접 읽는다. 상한 clamp 가 없어 `AI_RETRY_STATE_TTL_MINUTES=525600`(1년) 같이 과도한 값이 설정되면 `_retryState`가 무제한에 가깝게 DB에 영속된다. 만료 전 retryState 에는 messages 배열(대화 히스토리)과 일부 운영 메타가 포함되므로, 비정상적으로 긴 TTL 은 민감 대화 내용의 장기 노출 위험을 높인다. pre-existing + RESOLUTION.md W#2 에서 DI defer 처리됨.
- 제안: 합리적 상한(예: 7일 = 10080분)으로 clamp 적용. `ConfigService` 주입 시 validation pipe 에서 강제 가능.

### [INFO] `_retryState` — credential 미동봉 정책은 올바르나 messages 배열 포함
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L2661–2730 (`buildRetryState`)
- 상세: `llmConfigId`, `workspaceId`, `executionId` 등 credential·컨텍스트 결합 필드는 의도적으로 제외(allow-list 방식)하여 DB 영속 시 secret 누출 위험을 차단한 설계는 올바르다. 다만 `messages` 배열에는 사용자 입력·LLM 응답·tool 결과가 전부 포함되어 있고, 이 내용이 TTL 만료 전까지 DB에 보관된다. 별도 보안 위협은 아니지만 개인정보 처리방침/데이터 보존 정책과 일치하는지 확인이 필요하다.
- 제안: 데이터 보존 정책 문서에 _retryState 만료 주기 명시 권장. (보안 코드 관점에서 현행 설계는 적절함.)

### [INFO] `capFormDataBytes` 테스트 — 이메일 주소 노출
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` L220
- 상세: 테스트 픽스처에 `{ email: 'a@b.com' }` 형태의 이메일 주소가 포함되어 있다. 명백한 더미 데이터이며 실제 개인정보가 아니므로 보안 위협은 없다. 테스트 데이터로 적절함.
- 제안: 해당 없음.

### [INFO] 입력 검증 — `processMultiTurnMessage` form_submitted JSON.parse 에러 처리
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `processMultiTurnMessage` form_submitted 분기
- 상세: 테스트(`ai-turn-executor.spec.ts` L219)에서 `JSON.stringify({ email: 'a@b.com' })` 를 올바른 JSON으로 넘기므로 happy path 만 커버된다. 실제 코드에서 `JSON.parse` 실패 시 catch 분기가 어떻게 처리되는지는 이번 diff 에서 확인 불가(production 코드 무변경이므로 기존 처리 유지). pre-existing.
- 제안: 이번 PR 범위 밖. 기존 에러 처리가 adequate 한지 별도 검토 권장.

---

## 요약

이번 커밋은 production 코드를 변경하지 않고 테스트 파일(`ai-turn-executor.spec.ts`)에 additive 단위 테스트만 추가하고, 이전 ai-review 세션의 RESOLUTION·SUMMARY·각 reviewer 산출물을 커밋에 동봉한 것이다. 새로 추가된 코드(테스트 픽스처, `capFormDataBytes`/`FORM_SUBMITTED_MAX_BYTES` import)에는 하드코딩된 시크릿, 인젝션 취약점, 인증 우회, 안전하지 않은 암호화 등 신규 보안 문제가 발견되지 않는다. 기존에 알려진 보안 관련 사항(`sanitizeToolError` 패턴 마스킹 미구현, `AI_RETRY_STATE_TTL_MINUTES` 상한 미설정)은 모두 pre-existing 동작으로 RESOLUTION.md 에 deliberate-defer 근거가 명시되어 있으며, 이번 변경이 해당 위험을 악화시키지 않는다. `_retryState` 의 credential 미동봉(allow-list) 설계는 올바르게 구현되어 있다. 전체적으로 신규 보안 위험 없음.

---

## 위험도

NONE

STATUS=success ISSUES=0
