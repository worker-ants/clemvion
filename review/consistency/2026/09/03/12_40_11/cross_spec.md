# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 재확인

- `spec/5-system/` 자체의 diff 는 **0개 파일** (이 브랜치는 spec 을 바꾸지 않음, 정상).
- 실제 구현 diff(`origin/main...HEAD`)는 3개 파일 — 전부 `codebase/backend/src/modules/websocket/`:
  - `websocket-events.types.ts` (+10) — 기존에 `armExpiryTimers` 내부에 리터럴로 있던
    통지 문구를 `export const MSG_AUTH_TOKEN_EXPIRING = 'Access token expires soon —
    refresh and reconnect.'` 로 추출 (동일 문자열, 값 변경 없음).
  - `websocket.gateway.ts` (+/-) — ① 재무장(rearm) 시 옛 타이머 쌍을 조기 return 이전에
    해제, ② `notice`/`cutoff` 를 optional 아닌 필수 필드로 좁힘 + 해제 로직을
    `clearExpiryTimers` 로 단일화, ③ 두 타이머에 `unref()` 추가.
  - `websocket.gateway.spec.ts` (+101) — 위 3가지 동작에 대한 신규 단위테스트.
- 이 코드가 구현하는 기능(`auth.token_expired` WS 사전통지)은 `spec/5-system/6-websocket-protocol.md`
  §1.2 · §4.6 · §9.2 · Rationale `R-ws-socket-lifetime-binds-token` 에 **이미 "구현 완료"로
  기술되어 있다** (2026-09-02). 본 diff 는 그 기능의 신규 계약이 아니라 리뷰 후속(rearm 누수
  방지·shutdown 비차단·상수 추출) 내부 리팩터다.

## 확인한 불변식 (충돌 없음의 근거)

- **wire 계약 불변**: 이벤트명 `auth.token_expired`(`AuthEventType.AUTH_TOKEN_EXPIRED`), payload
  shape `{ message, expiresAt }`, 사전통지 리드타임 `TOKEN_EXPIRY_LEAD_MS = 60_000`(60초) —
  모두 diff 전후 동일. 메시지 문자열도 상수 추출 전후 바이트 단위로 동일
  (`git diff` 상 `-`/`+` 양쪽 리터럴 대조 확인).
- **프런트엔드 소비 방식**: `codebase/frontend/src/lib/websocket/ws-client.ts` 는
  `socket.on("auth.token_expired", …)` 로 **이벤트명만** 구독하고 `message` 필드 값은
  파싱하지 않는다(재연결 트리거로만 사용) — 상수 추출이 클라이언트 파서에 영향 없음.
- **네임스페이스 충돌 없음**: `Integration.status_reason = 'token_expired'`
  (`spec/1-data-model.md` §2.10, `spec/2-navigation/4-integration.md`,
  `spec/data-flow/5-integration.md`)는 표기가 유사하지만 완전히 다른 도메인(OAuth 통합
  자격증명 만료)이며, `spec/1-data-model.md:300` 이 이미 "JWT 만료 REST 에러
  `TOKEN_EXPIRED`·WebSocket 이벤트 `auth.token_expired` 와 표기가 유사하나 별개
  네임스페이스" 라고 명시적으로 분리해 두었다. 본 diff 는 이 경계를 건드리지 않는다.
- **코드 소유 경계 일치**: 변경된 3개 파일은 모두
  `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 등재된 SoT 파일이다
  (`websocket.gateway.ts`·`websocket-events.types.ts`) — 계층 책임 분할과 충돌 없음.
- **데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC**: 이번 diff 는 소켓 프로세스 내부
  타이머 Map(`Map<string, { notice, cutoff }>`)의 타입을 optional → required 로 좁히고
  해제 순서를 정리한 것으로, DB 엔티티·REST 엔드포인트·요구사항 ID·RBAC 규칙 어느 것도
  선언·수정하지 않는다. 해당하는 spec 영역(1-data-model, 2-navigation/*, RBAC 매트릭스)에
  이 diff 와 상충할 만한 서술이 없다(grep 결과 별개 네임스페이스 1건 외 교차 언급 없음).

## 발견사항

없음 — CRITICAL/WARNING 대상 충돌을 찾지 못했다.

- **[INFO]** 상수명과 이벤트명의 시제 불일치 (참고용, 저위험)
  - target 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:314`
    (`export const MSG_AUTH_TOKEN_EXPIRING`)
  - 충돌 대상: 같은 파일의 `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'`,
    그리고 `spec/5-system/6-websocket-protocol.md` 전체가 이 통지를 일관되게 "만료"(EXPIRED,
    과거/완료 시제)로 서술
  - 상세: 신규 상수명이 `MSG_AUTH_TOKEN_EXPIRING`(진행형 "만료되는 중")인 반면, 이벤트
    타입·spec 문서 전체는 `AUTH_TOKEN_EXPIRED`/"만료"(완료형)로 통일되어 있다. 실질적으로는
    "만료 임박 사전통지" 라는 의미상 진행형이 더 정확하긴 하나(§1.2: "만료 60초 전 1회
    emit"), 같은 파일 안에서 이벤트 타입과 헬퍼 상수의 시제가 갈리는 점은 다음 사람이 두
    식별자를 다른 개념으로 오인할 여지가 있다. spec 문서 자체는 이 상수명을 인용하지 않으므로
    spec 과의 직접 모순은 아니다.
  - 제안: 필수 조치 아님. 후속 정리 시 `MSG_AUTH_TOKEN_EXPIRED` 또는
    `MSG_AUTH_TOKEN_EXPIRY_NOTICE` 같은 이벤트명과 시제가 맞는 이름을 고려할 수 있다.

## 요약

이번 diff(`websocket-events.types.ts`·`websocket.gateway.ts`·`websocket.gateway.spec.ts`,
3파일/약 165줄 순증)는 `spec/5-system/6-websocket-protocol.md` 가 이미 "구현 완료"로
확정한 `auth.token_expired` 소켓 수명 기능의 내부 리팩터(재무장 시 타이머 누수 방지,
`unref()` 로 셧다운 비차단, 통지 문구 상수화)이며, 이벤트명·payload shape·리드타임(60초)
등 wire 계약을 전혀 바꾸지 않는다. `spec/5-system/` 의 다른 절(§1 인증·§2 세션·§3 인가·
§4 감사 로그·§5 API 엔드포인트) 및 `spec/1-data-model.md`·`spec/2-navigation/4-integration.md`·
`spec/data-flow/*` 등 인접 영역과 대조했을 때 데이터 모델·API 계약·요구사항 ID·상태 전이·
RBAC·계층 책임 어느 관점에서도 직접적 모순을 발견하지 못했다. 표기가 비슷한
`Integration.status_reason='token_expired'` 는 spec 이 이미 별개 네임스페이스로 명시
분리해 두었고 이번 diff 와 무관하다. 유일한 관찰은 신규 상수 `MSG_AUTH_TOKEN_EXPIRING`
과 기존 이벤트 타입 `AUTH_TOKEN_EXPIRED` 사이의 시제 불일치이며, spec 문서 자체가 이
상수명을 참조하지 않으므로 INFO 등급의 저위험 관찰에 그친다.

## 위험도

NONE
