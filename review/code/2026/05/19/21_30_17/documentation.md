# 문서화(Documentation) 리뷰

## 발견사항

### [WARNING] resolveTokenExpiry JSDoc 주석이 실제 구현과 불일치
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/resolve-token-expiry-jwt-exp-284f57/codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — 함수 `resolveTokenExpiry` 직전 JSDoc (라인 1442~1454)
- **상세**: JSDoc 의 Precedence 설명이 "Integration.tokenExpiresAt → credentials.expires_at" 순서로만 기술되어 있지만, 이번 변경으로 실제 구현은 **JWT exp → tokenExpiresAt → credentials.expires_at** 3단계 우선순위로 변경되었다. 함수 본문(라인 1460~1468)에 인라인 주석으로 JWT exp 우선의 이유가 상세히 기술되어 있으나, 외부에서 이 함수를 참조하는 개발자가 제일 먼저 보는 JSDoc 첫줄("Precedence: `Integration.tokenExpiresAt`…")이 현재 동작을 오해시킬 수 있다.
- **제안**: JSDoc Precedence 줄을 다음과 같이 업데이트한다.
  ```
  * Precedence: JWT `exp` claim (access_token 내 — TZ-bugged stored value 를
  * 무력화하는 ground truth) → `Integration.tokenExpiresAt` (spec §10.5
  * canonical column) → `credentials.expires_at` (JSONB mirror).
  ```
  "The entity column wins when both are present because…" 단락도 JWT exp 최우선 채택 이후의 fallback 이라는 사실이 명확히 드러나도록 수정 필요.

---

### [INFO] spec Rationale 에 resolveTokenExpiry 변경 기술 누락
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/resolve-token-expiry-jwt-exp-284f57/spec/2-navigation/4-integration.md` — 기존 Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" 항목(라인 1460)
- **상세**: 2026-05-18 Rationale 에는 `parseTokenExpiresAt` 와 `refreshAccessToken` 두 위치에 JWT exp 우선 정책이 기술되어 있다(라인 1471~1472). 이번 fix 가 추가한 `resolveTokenExpiry` 의 JWT exp 최우선 적용은 별도 worktree(`resolve-token-expiry-jwt-exp-284f57`) 변경임에도 spec Rationale 에 이 세 번째 위치가 언급되지 않았다. spec "테스트" 목록(라인 1498)에도 `cafe24-token-refresh.processor.spec.ts` 관련 테스트가 기존 항의 내용과 이번 변경 후 추가된 TZ-bug 시나리오 테스트(processor spec)가 혼재되어 있어 이번 변경과 2026-05-18 변경의 경계가 불분명하다.
- **제안**: plan/in-progress 파일(`fix-resolve-token-expiry-jwt-exp.md`)이 spec 갱신 체크리스트 항목을 포함하지 않으므로, merge 전에 spec Rationale 을 다음 중 하나로 처리한다.
  1. 기존 "JWT exp 격상 (2026-05-18)" 항목에 "(2026-05-19 보강) `resolveTokenExpiry` 에도 JWT exp 최우선 소스 추가 — TZ-bugged `tokenExpiresAt` 가 proactive refresh 경로에서도 무력화됨" 문장 추가.
  2. 또는 별도 Rationale 소항목 "resolveTokenExpiry JWT exp 격상 (2026-05-19)" 신설.

---

### [INFO] jwt-exp.ts 모듈 수준 JSDoc 에 resolveTokenExpiry 와의 연동 미기술
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/resolve-token-expiry-jwt-exp-284f57/codebase/backend/src/modules/integrations/jwt-exp.ts` — 파일 상단 JSDoc (라인 1~26)
- **상세**: JSDoc 에 "caller 는 null 을 받으면 fallback chain… 으로 강하해야 한다" 고 기술하고, caller 로 `integration-oauth.service.ts` 의 `parseTokenExpiresAt` 와 `cafe24-api.client.ts` 의 `refreshAccessToken` 를 암시한다. 이번 변경으로 `resolveTokenExpiry` 도 세 번째 caller 가 되었으나 JSDoc 에 반영되지 않았다.
- **제안**: "caller 는" 문단에 `resolveTokenExpiry` (proactive/worker 경로) 를 예시로 추가하거나, "본 helper 를 호출하는 세 위치" 를 명시한다. 필수는 아니나 미래 개발자의 검색 비용을 줄인다.

---

### [INFO] CHANGELOG / plan 파일에 spec 갱신 항목 없음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/resolve-token-expiry-jwt-exp-284f57/plan/in-progress/fix-resolve-token-expiry-jwt-exp.md`
- **상세**: 체크리스트에 lint/unit/build/e2e 항목은 있으나 "spec 갱신" 이 별도 체크 항목으로 포함되어 있지 않다. CLAUDE.md `[Plan must include spec updates]` 메모리 규칙에 따르면 구현 plan 은 spec 갱신까지 정식 phase 로 포함해야 한다. 이번 변경이 2026-05-18 Rationale 의 보완 사항임을 감안하면 spec 미갱신도 기술 부채다.
- **제안**: 체크리스트에 `- [ ] spec/2-navigation/4-integration.md Rationale 갱신 (resolveTokenExpiry JWT exp 격상)` 항목 추가.

---

## 요약

이번 변경의 핵심 로직(`resolveTokenExpiry` 에 JWT exp 최우선 소스 추가)은 `jwt-exp.ts`의 JSDoc, `cafe24-token-utils.ts`의 JSDoc, 그리고 인라인 주석(라인 1460~1463)에서 의도와 근거가 충분히 설명되어 있다. 테스트 파일(`jwt-exp.spec.ts`, `cafe24-api.client.spec.ts`)의 주석도 회귀 시나리오를 잘 설명한다. 주요 문서화 결함은 `resolveTokenExpiry` 함수 자체의 JSDoc Precedence 설명이 실제 구현과 일치하지 않는다는 점으로, 이 부분이 외부 독자에게 혼란을 줄 수 있어 WARNING 수준으로 분류했다. spec Rationale 미갱신과 jwt-exp.ts caller 목록 누락은 INFO 수준으로, 필수는 아니나 장기적 유지보수 비용을 높인다.

## 위험도

LOW
