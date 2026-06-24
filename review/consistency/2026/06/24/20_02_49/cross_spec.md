# Cross-Spec 일관성 검토 — M-2: frontend API_BASE_URL 단일화 + 포트 fallback 정정

검토 모드: `--impl-prep`
Target: `03-maintainability M-2` — `lib/api/constants.ts` 신규 + `client.ts` / `assistant.ts` / `auth-providers.ts` / `login-form.tsx` / `register-form.tsx` / `ws-client.ts` 6파일 교체

---

## 발견사항

### [INFO] 신규 `lib/api/constants.ts` 가 spec frontmatter `code:` 글로브에 미등재
- target 위치: 신규 파일 `codebase/frontend/src/lib/api/constants.ts` (계획)
- 충돌 대상: 해당 없음 (spec 은 포트·fallback 값을 미규정 — plan M-2 "spec 변경 불요" 판정과 일치)
- 상세: 관련 spec 파일들(`spec/5-system/6-websocket-protocol.md`, `spec/5-system/4-execution-engine.md`) 의 frontmatter `code:` 에 `codebase/frontend/src/lib/websocket/ws-client.ts` 가 명시되어 있다. `lib/api/constants.ts` 를 신규 생성하면 해당 파일은 현재 어떤 spec frontmatter `code:` 글로브에도 속하지 않는다. 동작 상 문제가 아니며 spec 명세 범위 외 구현 세부사항에 해당하지만, spec-impl-evidence 추적 관점에서 공백이 생긴다.
- 제안: 구현 후 관련 spec(`spec/5-system/6-websocket-protocol.md` 또는 `spec/5-system/1-auth.md`) frontmatter `code:` 에 `codebase/frontend/src/lib/api/constants.ts` 를 추가하는 것을 검토(planner 위임 사항 — developer 는 spec 쓰기 권한 없음). 단 M-2 plan 이 "spec 변경 불요"로 판정한 만큼 즉시 필수 사항은 아니다.

### [INFO] `ws-client.ts` 의 `NEXT_PUBLIC_WS_URL` fallback 포트도 동일 범주의 drift
- target 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:4` — `"http://localhost:3001"` (포트 3001, `/api` 미포함)
- 충돌 대상: `codebase/frontend/.env.example:28` — `NEXT_PUBLIC_WS_URL="http://localhost:3011"` 과 불일치
- 상세: M-2 plan 의 타겟 파일 목록에 `ws-client.ts` 가 포함되어 있으나, WS fallback 은 `/api` suffix 없이 호스트:포트만 사용하는 점에서 API URL fallback 과 형식이 다르다. `constants.ts` 에 `WS_BASE_URL` 상수도 함께 중앙화하면 일관성이 높아진다. 단 이미 scope 에 포함되어 있으므로 누락 위험은 없다.
- 제안: `constants.ts` 에 `export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3011"` 도 함께 정의해 단일 모듈로 통합. `getServerApiBaseUrl()` 와의 병치로 서버·클라이언트 양측 URL SoT 가 한 파일에 집약된다.

### [INFO] `NEXT_PUBLIC_API_URL` 의 `/api` suffix 와 webhook URL 도출 로직 간 명시적 연결
- target 위치: 신규 `constants.ts` 의 `API_BASE_URL` 정의 (`...|| "http://localhost:3011/api"`)
- 충돌 대상: `spec/5-system/12-webhook.md` WH-EP-02 · `spec/2-navigation/2-trigger-list.md:125` · `spec/7-channel-web-chat/5-admin-console.md:124` — 이 세 spec 이 모두 `NEXT_PUBLIC_API_URL` 에서 후행 `/api` 를 제거한 뒤 webhook/widget base URL 을 파생하는 로직을 명문화하고 있다 (`codebase/frontend/src/lib/utils/webhook-url.ts` `getWebhookBaseUrl()`)
- 상세: `API_BASE_URL` fallback 이 `/api` suffix 를 포함하는 형태로 정의되는 것은 현재 코드와 동일하다. 이 fallback 값이 webhook URL 도출 로직에도 간접적으로 영향을 미치나, spec 이 명시한 `NEXT_PUBLIC_API_URL` → `/api` 제거 → origin 파생 규칙이 상수 중앙화 이후에도 `webhook-url.ts` 에서 동일하게 적용되므로 모순이 없다. `constants.ts` 의 `API_BASE_URL` 을 `webhook-url.ts` 가 직접 import 하지 않는 한 교란 없음.
- 제안: 구현 시 `webhook-url.ts` 가 `constants.ts` 의 `API_BASE_URL` 을 re-import 해 `/api` 제거하는 방식으로 바꾸는 것은 scope 외 변경이므로 이번 M-2 에서는 현행 유지 권장.

---

## 요약

M-2 는 `lib/api/constants.ts` 신규 생성으로 `API_BASE_URL` / `getServerApiBaseUrl()` 정의를 단일 모듈로 통합하고, 잘못된 3001 fallback(실정답 3011)을 정정하는 behavior-preserving 리팩터다. Cross-Spec 관점에서 `spec/` 어느 영역도 포트 fallback 값을 직접 규정하지 않으므로 spec 본문과의 직접 모순은 없다. `NEXT_PUBLIC_API_URL` 환경 변수는 webhook·web-chat 세 spec 에서 URL 도출 입력으로 참조되나, 이 로직들은 `webhook-url.ts` 가 독립 소유하므로 `constants.ts` 신설에 의한 계약 충돌이 발생하지 않는다. 신규 파일이 spec frontmatter `code:` 글로브에 미등재되는 점과 `ws-client.ts` WS fallback 의 3001→3011 정정이 M-2 scope 에 이미 포함되어 있음을 확인했다.

---

## 위험도

NONE
