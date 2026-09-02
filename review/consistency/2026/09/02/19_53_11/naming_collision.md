# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-done)

## 검토 범위 정정 (사전 확인)

`spec/5-system/` 자체의 diff 는 0개 파일이다 (이 스코프는 이번 브랜치에서 spec 텍스트를
바꾸지 않았다 — 정상). 실제 구현 diff(8~9개 파일, 코드/문서/plan 합산 약 700줄)를
`git diff origin/main...HEAD` 로 워킹트리에서 직접 재구성해 검토했다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (+33, 신규 enum/interface)
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (+5)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (+93/-6, 신규 private 멤버)
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (+111)
- `codebase/frontend/src/lib/websocket/ws-client.ts` (+92/-14, 신규 local 헬퍼)
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` (+206)
- `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.{mdx,en.mdx}` (+8/+8, 사용자 문서, 식별자 없음)
- `CHANGELOG.md` (+19, 식별자 없음)
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (+152, 신규 plan)
- `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` (+9/-3, 체크박스만)

이 구현은 `spec/5-system/6-websocket-protocol.md` §1.2·§4.6 이 이미 확정해 둔
`auth.token_expired` WS 이벤트(그 spec 절 자체는 `origin/main` 에 이미 병합돼 있어 이번
diff 대상 아님)를 **처음으로 코드화**하는 PR이다. 동일 세션의 선행 `--impl-prep`
검토(`review/consistency/2026/09/02/17_13_02/naming_collision.md`)가 이미 이 이벤트명의
근접 충돌 후보(`Integration.status_reason` 슬러그 `token_expired`, REST 에러 코드
`TOKEN_EXPIRED`)를 INFO 로 지목하고 "이미 both-side 로 disambiguation 문서화됨 · 조치
불요, 구현 시 혼용만 주의" 로 판정한 바 있다 — 본 검토는 그 구현이 실제로 그 권고를
지켰는지 재확인하는 것이 핵심이다.

## 발견사항

### [INFO] `auth.token_expired`(WS) / `token_expired`(Integration status_reason) / `TOKEN_EXPIRED`(REST 에러 코드) — 선행 INFO 그대로 유지, 구현이 권고를 충실히 반영
- target 신규 식별자: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'`
  (`websocket-events.types.ts:284`), 소켓 payload 필드 `expiresAt`
- 기존 사용처(표기 유사, 의미 다름):
  - `spec/1-data-model.md:300` — `Integration.status_reason` 컬럼 슬러그 값 `token_expired`
  - `spec/5-system/3-error-handling.md:43,181,184` · `14-external-interaction-api.md:355,368,1356,1904` — REST/JWT 에러 코드 `TOKEN_EXPIRED`(두 개의 별개 토큰 계층 — 워크스페이스 JWT · interaction 토큰)
  - `codebase/backend/src/modules/integrations/integration-status-reason.ts:19` — 코드 주석에 별개 네임스페이스 명시
- 상세: 구현 코드(`websocket-events.types.ts:274-306`)의 JSDoc 이 정확히 이 세 표기를
  나란히 언급하며 "표기만 가깝고 네임스페이스가 다르므로 로그·에러 메시지에서 혼용하지
  않는다" 를 **`(--impl-prep naming_collision INFO#7)` 를 직접 인용**해 명시한다. 또한
  `AuthTokenExpiredPayload.expiresAt` 의 JSDoc 은 같은 필드명을 쓰는 다른 두 값
  (`_retryState.expiresAt` AI retry TTL §4.2, `auth.refreshed.expiresAt` §1.3 비채택)과도
  의미가 다름을 별도로 disambiguate 한다. 프런트 `ws-client.ts` 는 이 이벤트명을 문자열
  리터럴(`"auth.token_expired"`)로 구독하는데, 백엔드 enum 값과 문자열이 정확히 일치한다
  (`git grep` 대조 완료).
- 제안: 조치 불요. 선행 INFO 가 요청한 "구현 시 세 식별자를 혼용하지 않도록 확인" 을 코드
  자체의 JSDoc 교차참조로 충족했다 — 이 INFO 는 재발이 아니라 **해소 확인**으로 종결.

### [INFO] `AuthEventType` enum — 선행 INFO#의 명명 패턴 권고를 그대로 이행
- target 신규 식별자: `export enum AuthEventType { AUTH_TOKEN_EXPIRED = 'auth.token_expired' }`
  · `export interface AuthTokenExpiredPayload { message: string; expiresAt: string }`
- 기존 사용처: 같은 파일의 `ExecutionEventType`(`execution.*`)·`NodeEventType`
  (`execution.node.*`)·`BackgroundRunEventType`·`InAppNotificationEventType`
  (`notification.new`) 4개 기존 이벤트 enum
- 상세: 선행 `--impl-prep` 검토가 "문자열 리터럴 하드코딩 대신 기존 enum 패턴을 따라
  신규 enum 을 추가하라" 고 권고했고, 이번 구현이 정확히 그 패턴(`XxxEventType` +
  `NAMESPACE_MEMBER = 'namespace.event'`)으로 `AuthEventType` 을 추가했다. `git grep` 로
  전체 `codebase/`·`spec/` 를 확인한 결과 `AuthEventType`·`AUTH_TOKEN_EXPIRED`·
  `AuthTokenExpiredPayload` 이름 자체의 사전 사용은 없다(신규 도입 지점 외 출현 없음) —
  기존 enum 명과도 겹치지 않는다.
- 제안: 조치 불요.

### [INFO] `refreshAndReconnect` (frontend local helper) — 전역 범위 충돌 없음
- target 신규 식별자: `ws-client.ts` 내부 `const refreshAndReconnect = async (why: string) => {...}`
- 기존 사용처: 없음 — `git grep -n "refreshAndReconnect"` 결과 정의·호출 3곳(같은 파일의
  `connect_error`/`auth.token_expired`/`disconnect` 핸들러) 뿐이며 모듈 로컬 스코프
  (export 되지 않음)이라 다른 모듈과 충돌할 표면 자체가 없다.
- 제안: 조치 불요(정보성 기록).

### 교차 확인 — 충돌 없음으로 확인된 항목
- **신규 API endpoint 없음**: 이 PR 은 REST endpoint 를 추가하지 않는다. WS 이벤트
  1개(`auth.token_expired`)만 신규 emit 이며, 이는 spec 이 이미 확정한 이벤트명이다.
- **신규 ENV var·config key 없음**: `armExpiryTimers` 의 lead time(`60_000`ms)은 코드
  상수(`WebsocketGateway.TOKEN_EXPIRY_LEAD_MS`, private static)로 하드코딩되며 신규 env
  var 를 도입하지 않는다. 기존 `WEBAUTHN_*`·`COOKIE_SAMESITE`·`TRUST_CF_CONNECTING_IP`
  등과 이름 겹침 없음.
- **신규 spec 파일 경로 없음**: `spec/5-system/` 델타 0 (이번 세션 자체 확인).
- **신규 요구사항 ID / Rationale ID 충돌 없음**: `R-ws-socket-lifetime-binds-token` 은
  기존(이미 `origin/main` 병합된) Rationale ID 를 그대로 참조할 뿐 이번 diff 가 새로
  만들지 않는다.
- **신규 엔티티/DTO 명 없음**: `AuthTokenExpiredPayload` 는 WS wire payload 전용이며
  기존 DB 엔티티·REST DTO 이름 공간과 분리(파일이 다르고 이름 자체도 겹치지 않음).
- **plan 파일 경로**: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 는
  기존 `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` 명명 컨벤션
  (`<주제>-*.md`, kebab-case)을 따르고, 다른 in-progress 파일과 이름이 겹치지 않는다.
- **이월 항목(참고, 이번 검토의 charter 밖)**: plan 체크리스트 자체가 `MSG_AUTH_TOKEN_EXPIRING`
  상수 승격을 "다음에 만질 때 정리" 로 명시 유예했고, `PASSWORD_INVALID`/`INVALID_PASSWORD`
  네이밍 이슈도 planner 트랙 갭으로 별도 등재돼 있다 — 둘 다 **이번 PR 이 새로 만드는
  식별자가 아니라 기존 식별자에 대한 후속 논의**이므로 신규 식별자 충돌 판정 대상이
  아니다(참고용으로만 기록).

## 요약

이번 diff 가 도입하는 신규 식별자는 WS 이벤트 `AuthEventType.AUTH_TOKEN_EXPIRED`
(`'auth.token_expired'`) · payload 타입 `AuthTokenExpiredPayload` · frontend 로컬 헬퍼
`refreshAndReconnect` 셋뿐이며, 셋 다 기존 코드베이스·spec 어디와도 이름이 겹치지 않는다.
이 중 유일하게 근접 충돌 후보였던 `auth.token_expired` / `token_expired`(Integration
status_reason 슬러그) / `TOKEN_EXPIRED`(REST 에러 코드) 3종 표기는 같은 세션의 선행
`--impl-prep` 검토가 INFO 로 미리 지목했었고, 이번 구현은 그 INFO 를 코드 JSDoc 에서
직접 인용하며 세 식별자의 네임스페이스 경계를 명시적으로 재확인했다 — 새로운 충돌이
아니라 기왕의 disambiguation 이 구현 단계까지 그대로 유지된 사례다. 신규 API endpoint·
ENV var·엔티티·spec 파일 경로 도입도 없다.

## 위험도

NONE
