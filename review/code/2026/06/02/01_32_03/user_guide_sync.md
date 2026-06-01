# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [INFO] 공개 webhook 속도 제한 동작이 user-guide 에 미반영
- 변경 파일: `codebase/backend/src/modules/hooks/hooks.controller.ts`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts`
- 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 누락된 동반 갱신: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` + `triggers.en.mdx` 의 webhook 트리거 섹션
- 상세: `hooks.controller.ts` 는 `codebase/backend/src/**/*.controller.ts` glob 에 매칭되어 `backend-api-change` trigger 에 해당한다. 이번 변경으로 공개(인증 없음) webhook 엔드포인트에 IP 단위 분당 10회 시작 rate-limit(HTTP 429), 시간당 20회 누적 상한(HTTP 429), body 32KB 제한(HTTP 413)이 추가됐다. swagger jsdoc(`@ApiTooManyRequestsResponse`, `@ApiPayloadTooLargeResponse`)는 동일 PR 에 추가되어 swagger 부분은 충족됐다. 그러나 webhook 트리거를 설정하는 사용자가 "공개 webhook 엔드포인트는 IP당 분당 10회 시작 한도가 적용된다"는 사실을 알지 못하면 429 응답을 받았을 때 원인 파악이 어렵다. 단, 본 동작은 인프라 레벨 남용 방어로 일반 정상 사용자에게는 노출될 일이 드물어 INFO 수준으로 분류한다.
- 제안: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` + `.en.mdx` 의 webhook 트리거 섹션에 "공개 webhook 제한" 노트(공개 트리거는 IP 단위 분당 10회 시작 한도, 시간당 20회 누적 상한, body 32KB 적용; 429/413 응답 시 해당 한도 초과)를 짧은 callout 으로 추가한다.

---

## 적용되지 않은 trigger (명시적 제외)

| trigger id | 판정 | 근거 |
|---|---|---|
| `new-node` / `node-schema-change` | 미매칭 | `codebase/backend/src/nodes/**` 변경 없음 |
| `new-ui-string` | 미매칭 | `.tsx` 파일 변경 없음 |
| `new-userguide-section-dir` | 미매칭 | `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음 |
| `auth-session-flow-change` | 미매칭 | 변경 경로가 `hooks/**` — `auth/**` 아님. webhook throttle 은 인증·권한·세션 흐름 변경 아님 |
| `new-error-code` | 미매칭 | `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음. 신규 에러 코드(`PUBLIC_WEBHOOK_*`)는 ErrorCode enum 이 아닌 HTTP guard 인라인 문자열 |
| `new-warning-code` | 미매칭 | `warningRules` 변경 없음 |
| `expression-language-change` | 미매칭 | `codebase/packages/expression-engine/**` 변경 없음 |
| `run-debug-flow-change` | 미매칭 | 실행 엔진·디버그 로깅 변경 없음 |
| `integration-provider-change` | 미매칭 | 신규 provider 또는 provider 변경 없음 |
| `backend-api-change` swagger 부분 | 충족 | `@ApiTooManyRequestsResponse`, `@ApiPayloadTooLargeResponse` 동일 PR 에 추가됨 |

---

## 요약

매트릭스 총 19개 trigger 중 1개(`backend-api-change`) 가 변경 파일과 매칭됐다. swagger jsdoc 갱신은 동일 PR 에 포함되어 충족됐으나, "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" 부분에서 공개 webhook rate-limit 동작이 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 및 `.en.mdx` 에 기재되지 않은 점이 INFO 1건으로 식별됐다. 나머지 18개 trigger 는 미매칭이다. i18n parity 위반·backend-labels 매핑 누락·신규 섹션 locale 등록 누락 등 CRITICAL/WARNING 항목은 없다.

## 위험도

LOW
