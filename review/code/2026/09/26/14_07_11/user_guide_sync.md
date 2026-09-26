# User Guide Sync 리뷰 — success-advert

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 change_type) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재해 대조했다.

## 변경 파일 식별

`review/code/2026/09/26/14_07_11/_prompts/user_guide_sync.md` 에 포함된 50개 변경 파일 전체(`### 파일 1`~`### 파일 50`)를 열거했다. 요약하면:

- `CHANGELOG.md`
- 백엔드 swagger 공용 라이브러리: `codebase/backend/src/common/swagger/api-wrapped.ts` (+`.spec.ts`) — `wrapNullableDataSchema` / `ApiOkWrappedNullableResponse` 신설
- WebAuthn: `webauthn-response.dto.ts`(`WebAuthnAvailabilityDto` 신설) + `webauthn.controller.ts`
- External Interaction: `interaction-stream.controller.ts`
- Triggers: `trigger-secret-issue-response.dto.ts`(신규 파일) + `triggers.controller.ts`
- Workflow Assistant: `assistant-session-response.dto.ts` + `workflow-assistant.controller.ts`
- `http-status-advertised` 가드 · fixture · spec 테스트, `advertised-response-contract.e2e-spec.ts` 등 e2e/가드 테스트
- `spec/conventions/swagger.md` (convention 본문 갱신)
- `plan/in-progress/{spec-draft-nullable-notation-followups,spec-draft-swagger-success-advert,success-advert}.md`
- `review/code/.../13_39_09/**`, `review/consistency/.../13_07_11/**`, `review/consistency/.../13_17_19/**` (이전 라운드 산출물)

`codebase/frontend/**` 를 건드리는 파일은 **50개 중 0개**다 (`grep`/파일 목록 전수 확인).

## trigger 매칭 및 판단

### 1) `backend-api-change` (semantic) — controller/dto 변경
- glob: `codebase/backend/src/**/*.controller.ts`, `codebase/backend/src/**/dto/**` → `webauthn.controller.ts`, `webauthn-response.dto.ts`, `interaction-stream.controller.ts`, `trigger-secret-issue-response.dto.ts`, `triggers.controller.ts`, `assistant-session-response.dto.ts`, `workflow-assistant.controller.ts` 매칭.
- targets: (a) "controller·DTO 의 swagger jsdoc" — **이 변경 자체가 그 target** 이므로 충족됨. (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — CHANGELOG 본문이 명시: "응답 자체(상태 · 본문)는 그대로다 — 문서가 실제 응답을 적게 됐다." 즉 엔드포인트는 이미 존재했고(`webauthnAvailability`, `rotateNotificationSecret`, `revokePerTriggerToken`, workflow-assistant 세션 CRUD 전부 기존 기능), 이번 변경은 OpenAPI 스키마만 채운 것 — 실제 동작·응답 바디·API 노출 범위 변화가 없다. 따라서 user-guide 페이지 갱신 target 은 발동하지 않는다고 판단.
- 판정: **해당 없음 (누락 아님)** — 이 changeset 은 순수 OpenAPI 문서화이고 target (b)의 전제조건("API 노출 변경")이 성립하지 않는다.

### 2) `auth-session-flow-change` (glob `codebase/backend/src/modules/auth/**`, match semantic)
- `webauthn-response.dto.ts`, `webauthn.controller.ts` 는 경로상 glob 에 매칭된다.
- 그러나 diff 내용은 `@ApiOkWrappedResponse`/`@ApiNoContentResponse` 데코레이터 추가와 `WebAuthnAvailabilityDto` 타입 신설뿐이다. `webauthnAvailability()`/`webauthnDelete()` 핸들러 본문·인가 로직·세션 흐름은 변경되지 않았다(`return { data: { enabled: this.webauthnService.isEnabled() } };` 그대로).
- 판정: **INFO — 회색지대, 실질 트리거 아님.** 경로 glob 은 맞지만 "흐름 변경"(semantic 조건)이 성립하지 않아 `07-workspace-and-team/` 페이지·e2e 보강 의무는 발생하지 않는다고 판단. (참고차 기재 — 실제 인증 로직 diff 가 있었다면 CRITICAL/WARNING 후보였을 자리.)

### 3) `spec-major-change` (glob `spec/conventions/**`)
- `spec/conventions/swagger.md` 매칭. frontmatter 확인: `status: implemented`, `code:` 글로브 목록에 `codebase/backend/src/common/swagger/**` 이미 포함 — 신설된 `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 는 기존 글로브로 커버되어 `code:` 갱신 불필요, `pending_plans` 도 `status: implemented` 라 불필요.
- 판정: **정합 — 누락 없음.**

### 4) 나머지 trigger (새 노드 추가·노드 schema 변경·신규 UI 문자열·통합/제공자 변경·신규 섹션 디렉토리·표현식 언어 변경·실행/디버깅 흐름 변경·신규 warningCode/errorCode 발행 등)
- 이 changeset 은 `codebase/backend/src/nodes/**`, `codebase/frontend/**`, `codebase/packages/expression-engine/**`, warningRules/`error-codes.ts` 어느 것도 건드리지 않는다.
- 판정: **매칭 없음.**

## 종합 판단

전체 변경은 "성공 응답을 광고하지 않던 라우트 11곳에 OpenAPI 스키마를 붙인다"는 순수 문서화(Swagger/OpenAPI) + 저장소 가드 강화 작업이며, 실제 API 동작·응답 바디·사용자 노출 범위는 변경되지 않았다고 CHANGELOG/plan 양쪽이 명시한다. `codebase/frontend/**`(content/docs MDX, i18n dict, backend-labels.ts, locale.ts) 는 changeset 에 전혀 등장하지 않으며, 매칭되는 trigger 들도 검토 결과 실질적 "동반 갱신 누락"으로 이어지지 않는다(모두 doc-only 변경이거나 이미 정합됨).

## 발견사항

없음 — 매트릭스 21개 change_type 중 glob/semantic 매칭 후보 2개(`backend-api-change`, `auth-session-flow-change`)를 상세 대조했으나 둘 다 실질적 트리거 조건(behavior/exposure 변경)이 성립하지 않아 CRITICAL/WARNING 발견사항 없음. 참고용 INFO 관찰 2건은 위 §1, §2에 기재(둘 다 "동반 갱신 누락"이 아니라 "trigger 가 발동하지 않는 이유"에 대한 회색지대 기록).

## 요약

매트릭스 trigger 21개 중 glob 매칭 후보는 `backend-api-change`(controller/dto 다수)와 `auth-session-flow-change`(webauthn 경로) 2개였으나, 실측 결과 이번 changeset 은 기존 엔드포인트의 OpenAPI 성공 응답 스키마만 채우는 순수 문서화 작업(CHANGELOG·plan 이 "응답 자체는 그대로" 라고 명시)이라 두 trigger 모두 실질적인 유저 가이드/i18n/backend-labels 동반 갱신 의무를 발생시키지 않는다. `codebase/frontend/**` 는 50개 변경 파일 중 0개이며 `spec/conventions/swagger.md` 갱신은 frontmatter 정합까지 확인해 누락 없음. 동반 갱신 누락 0건.

## 위험도

NONE
