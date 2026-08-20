# Cross-Spec 일관성 검토 — `token` 계열 secret masking 확장 (impl-done, scope=spec/5-system/)

## 검토 대상 요약

diff(`origin/main...HEAD -- code_areas`)는 세 파일을 변경한다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 공용 SoT. 값 패턴(`SECRET_LEAK_PATTERNS`)과 키 패턴(`CREDENTIAL_KEY_PATTERN`)을 각각 `[A-Za-z0-9_-]*token`/`[a-z0-9_-]*token` 으로 넓혀 `token` **계열 전체**(bare `token`·`access_token`·`csrf_token`·`csrfToken`·`x-auth-token`·`session_token`·`id_token` 등)를 한 대안으로 흡수.
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 동명 `CREDENTIAL_KEY_PATTERN` 미러를 동일하게 확장(의도된 미러, `x[_-]api[_-]?key` 만 공용 전용 비대칭으로 유지).
- `codebase/backend/src/modules/mcp/mcp-error-codes.ts` — 종전 MCP 전용 bare `token=` 패턴이 공용에 흡수돼 `MCP_EXTRA_SECRET_PATTERNS` 를 빈 배열로.

target 문서(`spec/5-system/`) 자체의 diff는 없었음 — `spec/5-system/14-external-interaction-api.md` §R17 은 이미 "`token` 계열 확장 (2026-08-17)" 불릿(코드 diff와 1:1 대응, "잔여 ③" 비대상 캐비엇 포함)으로 이 변경을 정확히 반영한 상태로 번들에 존재한다. 즉 이번 검토는 **이미 spec-synced 코드 diff**가 다른 spec 영역과 충돌하는지를 본다.

## 발견사항

교차 확인한 후보 충돌 지점과 결과 — 전부 실제 충돌 없음으로 판정:

1. **트리거 시크릿/토큰 1회 평문 반환 엔드포인트** (`POST /api/triggers/:id/notification/rotate-secret` → `{ secret, rotatedAt }`, `POST /api/triggers/:id/interaction/revoke-token` → `{ token }` — [`2-navigation/2-trigger-list.md`](../../../../../../spec/2-navigation/2-trigger-list.md), [`5-system/14-external-interaction-api.md §3.1/§3.3`](../../../../../../spec/5-system/14-external-interaction-api.md)). 응답 필드가 문자열 그대로 `token`/`secret` 이라 새 `[A-Za-z0-9_-]*token` 패턴의 정확한 표적처럼 보이지만, `triggers.controller.ts`/`triggers.service.ts` 는 `sanitize-error-message`/`CREDENTIAL_KEY_PATTERN`/`deepRedactSecrets` 를 **import 하지 않는다** (import 소비처는 execution-engine·websocket·external-interaction·mcp·schedules·integrations 6모듈 한정, grep 로 확인). 전역 `TransformInterceptor` 도 `{ data }` 래핑만 하고 값 변형이 없다. → 1회 평문 반환 계약은 이번 diff로 깨지지 않는다.
2. **Webhook 트리거 응답의 `interaction.token`**(`iext_*` 최초 발급, [`14-external-interaction-api.md §4.1`](../../../../../../spec/5-system/14-external-interaction-api.md)) — `hooks.service.ts` 가 직접 조립하며 동일하게 마스킹 유틸을 import 하지 않는다. → 외부 호출자에게 전달돼야 하는 초기 interaction token 이 마스킹으로 손상되는 회귀 없음.
3. **workflow-assistant `maskSensitiveFields`**([`3-workflow-editor/4-ai-assistant.md`](../../../../../../spec/3-workflow-editor/4-ai-assistant.md) — 매칭 키가 `apiKey/api_key/password/token/accessToken/refreshToken/secret/clientSecret/authorization` 리터럴 나열이라 `csrf_token`/`x-auth-token` 등 접두형은 여전히 통과) — target 문서 §R17 이 이 비대상을 "잔여 ③" 으로 이미 명시하고, 두 유틸의 시맨틱 차이(최근 4자리 힌트 보존 vs 완전 마스킹)까지 근거로 든다. 코드 diff·spec 서술·ai-assistant.md 구현이 삼자 일치 — 실제 카탈로그 분기이지만 **이미 문서화되고 정당화된 의도적 분리**이며 이번 diff가 새로 만든 비일관이 아니다.
4. **자체 API 의 페이지네이션 커서**(`2-api-convention.md §8` — `nextCursor`/`cursor`) — 자체 API 는 `token` 접미 필드명을 쓰지 않아(`cursor` 계열만 사용) 새 패턴과 자기충돌 없음. MCP 3rd-party `nextPageToken` 오탐만 캐너리로 수용(§R17 명시).
5. **`spec/conventions/secret-store.md`** — `SecretResolver`/`secret://` scheme 은 저장 계층 암호화 추상화로 이번 display-masking 정규식 카탈로그와 관심사가 겹치지 않는다. 충돌 없음.

## 요약

이번 변경은 backend 공용 secret-masking 유틸(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`) 두 축(값·키)에서 `token` 계열 커버리지를 리터럴 나열에서 접두형 포함 패밀리 매칭으로 넓히는 순수 방어적(superset) 확장이며, MCP 전용 중복 패턴을 공용으로 흡수·제거한다. target spec(`spec/5-system/14-external-interaction-api.md §R17`)은 이 변경을 코드 diff 와 정확히 대응하는 서술(범위·캐비엇·잔여 항목 포함)로 이미 갖추고 있다. 이번 검토에서 실제 위험 후보로 조사한 다섯 지점 — 트리거 시크릿/토큰 1회 평문 반환 API, webhook 최초 interaction token 발급, workflow-assistant 의 별도 마스킹 카탈로그, 자체 페이지네이션 커서 명명, secret-store 저장 추상화 — 모두 이 마스킹 유틸의 소비처 밖에 있거나 이미 문서화된 의도적 예외였다. Cross-Spec 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 모순을 발견하지 못했다.

## 위험도

NONE
