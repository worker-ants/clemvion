# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위 정정 (사전 확인)

`git diff origin/main --stat` 결과가 비어 있고, 유일한 미추적 신규 파일은
`plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 하나였다. `spec/5-system/1-auth.md`·
`spec/5-system/6-websocket-protocol.md` 등은 이미 `origin/main`(커밋 `6ffadb1f4`·`36f2791a9`)에
병합된 기존 문서이며 이번 세션에서 "새로 도입"되는 내용이 아니다. 따라서 본 검토는 실질적으로
**신규 산출물인 위 plan 파일이 도입하려는 식별자**가 기존 spec/코드 사용처와 충돌하는지에
초점을 맞췄다 (나머지 `spec/5-system/*` 는 컨텍스트 예산 초과로 프롬프트에도 대부분 절단되어
있었고, 실제로도 diff 가 없어 "신규 식별자" 후보가 아니다).

## 발견사항

### [INFO] `auth.token_expired` — 이미 사전에 해소된 근접 충돌, 재확인만
- target 신규 식별자: WebSocket 이벤트명 `auth.token_expired` (backend emit, 구현 대기 상태를
  `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 착수하려는 대상)
- 기존 사용처(표기 유사, 의미 다름):
  - `spec/1-data-model.md:300` — `Integration.status_reason` 컬럼의 슬러그 값 `token_expired`
    (OAuth 토큰 만료로 인한 연동 상태 사유, `snake_case`, DB 저장값)
  - REST 에러 코드 `TOKEN_EXPIRED` (JWT 검증 실패, `UPPER_SNAKE_CASE`)
  - `codebase/backend/src/modules/integrations/integration-status-reason.ts:19` — 코드 주석에서
    `auth.token_expired` 와 별개 네임스페이스임을 명시
- 상세: 세 표기(`auth.token_expired` WS 이벤트 / `token_expired` DB 슬러그 / `TOKEN_EXPIRED` REST
  코드)가 문자열로는 근접해 혼동 여지가 있으나, **spec 저자가 이미 두 곳(`spec/1-data-model.md:300`
  주석, `integration-status-reason.ts:19` 코드 주석)에 "표기가 유사하나 별개 네임스페이스" 라고
  명시적으로 교차 참조를 남겨두었다.** 즉 이번 target 이 새로 만드는 충돌이 아니라, 충돌 가능성을
  인지하고 사전에 both-side 로 문서화해 둔 상태다.
- 제안: 조치 불요. `websocket.gateway.ts` 구현 시 이 세 식별자를 뒤섞어 로그/에러 메시지에 쓰지
  않도록 PR 리뷰에서 한 번 더 확인 권장 (문서화된 계약을 코드가 계속 지키는지 확인하는 수준).

### [INFO] `auth.token_expired` 는 `websocket-events.types.ts` 의 기존 이벤트 enum 어디에도 아직 없음 — 구현 시 명명 패턴 준수 필요
- target 신규 식별자: 없음 (target plan 자체는 상수/enum 이름을 지정하지 않음) — 발견은 구현 착수
  전 안내 목적
- 기존 사용처: `codebase/backend/src/modules/websocket/websocket-events.types.ts` 에
  `ExecutionEventType`(`execution.*`)·`NodeEventType`(`execution.node.*`)·
  `BackgroundRunEventType`·`InAppNotificationEventType`(`notification.new`) 4개 enum 이 이미
  dot-표기 이벤트명을 상수로 관리하고 있음
- 상세: `auth.token_expired` 를 담을 enum(`AuthEventType` 등)이 아직 없다. 문자열 리터럴을 그대로
  하드코딩하면 향후 오탈자·중복 정의 위험이 생긴다.
- 제안: 구현 시 기존 enum 패턴(`export enum XxxEventType { … = 'namespace.event' }`)을 따라
  신규 enum 을 추가하고 그 안에 `AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 로 정의할 것을 권장
  (naming collision 은 아니고 일관성 권고).

### 교차 확인 — 충돌 없음으로 확인된 항목
- `R-ws-socket-lifetime-binds-token` (Rationale ID): `spec/5-system/6-websocket-protocol.md`,
  `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md`,
  `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`,
  `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 4곳에서 동일 의미로만 사용됨. 다른
  의미의 재사용 없음.
- target plan 이 인용하는 spec 절 번호(§1.2·§1.3·§4.6·§6.1·§9.2, `6-websocket-protocol.md`)는
  실제로 해당 제목 그대로 존재함 (`grep` 로 확인) — 절번호 drift 없음.
- target plan 은 새 API endpoint·엔티티·DTO·ENV var·spec 파일 경로를 도입하지 않는다 — 기존
  모듈(`websocket.gateway.ts`, `ws-client.ts`)의 동작 확장이며 새 표면 신설이 없다.

## 요약

이번 세션에서 실질적으로 신규 도입된 산출물은 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
하나뿐이며(`spec/5-system/1-auth.md` 등은 이미 `origin/main` 에 병합된 기존 문서), 그 plan 이
전제하는 WebSocket 이벤트명 `auth.token_expired` 는 표기가 근접한 기존 식별자(`Integration.status_reason`
의 `token_expired` 슬러그, REST 에러 코드 `TOKEN_EXPIRED`)와 혼동 가능성이 있으나 **이미 spec·코드
양쪽에 "별개 네임스페이스" 로 명시적 disambiguation 이 되어 있어 새로운 충돌이 아니다.** 그 외 신규
API endpoint·엔티티·ENV var·파일 경로·이벤트명 도입은 없으며, plan 이 인용하는 spec 절 번호·Rationale
ID 도 모두 실체와 일치한다. 유일한 보완 포인트는 구현 시 `auth.token_expired` 를 기존 이벤트 enum
명명 패턴(`websocket-events.types.ts`)에 맞춰 등록하라는 INFO 수준 권고다.

## 위험도

NONE
