# User Guide Sync Review

## 발견사항

### [INFO] Cafe24 install endpoint 신규 429 에러코드가 docs에 미반영

- 변경 파일: `codebase/backend/src/modules/integrations/third-party-oauth.controller.ts`
- 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 누락된 동반 갱신: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` 및 `cafe24.en.mdx`
- 상세: `third-party-oauth.controller.ts` 에 `CAFE24_INSTALL_RATE_LIMITED` (HTTP 429) 응답 경로가 신규 추가됐다. `cafe24.mdx` 는 App URL 설치 endpoint (`/api/3rd-party/cafe24/install/<install_token>`) 를 통합 설정 안내 맥락에서 이미 언급하고 있으므로(line 38), 해당 endpoint 에서 발생 가능한 새 에러코드를 전혀 설명하지 않으면 통합을 설정하는 관리자가 429 lockout 상황을 이해하지 못할 수 있다.
  - Swagger 애노테이션(`@ApiTooManyRequestsResponse`)은 추가됐으므로 API 명세 수준의 문서는 갱신됨. 유저 가이드 MDX 수준 언급만 누락.
  - `ERROR_KO` 매핑 테이블이 `backend-labels.ts` 에 없는 것은 기존 설계(backend HTTP 에러코드는 ERROR_KO 매핑 대상이 아님, WARNING_KO/LABEL_KO 와 다름)이므로 별도 CRITICAL 이 아님.
- 제안: `cafe24.mdx` + `cafe24.en.mdx` 의 App URL / install flow 절에 1-2 문장 추가 — "설치 시도 실패(잘못된 토큰·HMAC)가 반복되면 IP 별 임계치 초과로 `429 CAFE24_INSTALL_RATE_LIMITED` 가 반환됩니다. 잠시 후 다시 시도하거나 올바른 App URL/토큰을 확인하세요." 수준. 매트릭스 `integration-provider-change` 행의 `guard_tests` 인 `integrations-coverage.test.ts` 가 통과 여부를 검증.

---

**매트릭스 전체 trigger 매칭 요약:**

| 매트릭스 row | trigger | 매칭 여부 | 결과 |
|---|---|---|---|
| `new-node` | `codebase/backend/src/nodes/**` | 미매칭 (integrations/ 경로) | 해당 없음 |
| `node-schema-change` | `codebase/backend/src/nodes/**` | 미매칭 | 해당 없음 |
| `new-ui-string` | TSX 신규 한국어 리터럴 | 미매칭 (TSX 변경 없음) | 해당 없음 |
| `integration-provider-change` | semantic — 통합 신규/변경 | 부분 매칭 (install endpoint 보안 변경) | INFO (위) |
| `new-userguide-section-dir` | `docs/*/` 신규 디렉토리 | 미매칭 | 해당 없음 |
| `backend-api-change` | `*.controller.ts` | 매칭 — Swagger 갱신됨, user-guide 미반영 | INFO (위) |
| `new-warning-code` | semantic — warningRules 변경 | 미매칭 | 해당 없음 |
| `new-error-code` | `error-codes.ts` glob | 미매칭 (error-codes.ts 미변경) | 해당 없음 |
| `auth-session-flow-change` | `src/modules/auth/**` | 미매칭 (integrations/ 경로) | 해당 없음 |
| `expression-language-change` | `packages/expression-engine/**` | 미매칭 | 해당 없음 |
| `run-debug-flow-change` | semantic | 미매칭 | 해당 없음 |
| `new-backend-ui-zod-value` | semantic — zod ui label | 미매칭 | 해당 없음 |

## 요약

매트릭스 19개 trigger 중 변경 파일(`codebase/backend/src/modules/integrations/{cafe24-install-rate-limit.service.ts, third-party-oauth.controller.ts, integrations.module.ts}` 등)에 직접 매칭되는 trigger 는 `backend-api-change` (controller.ts glob) 1개이며, `integration-provider-change` (semantic) 가 부분 매칭된다. 양쪽 모두 Swagger 애노테이션은 갱신됐으나 유저 가이드 MDX(`cafe24.mdx` + `cafe24.en.mdx`) 에 신규 429 에러코드 설명이 없다 — 누락 1건 (INFO 등급). i18n parity 위반, ERROR_KO/WARNING_KO 누락, 신규 섹션 디렉토리 locale 미등록 등의 CRITICAL/WARNING 은 없음.

## 위험도

LOW
