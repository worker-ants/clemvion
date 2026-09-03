# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 새 JSDoc 블록을 기존 JSDoc 블록 앞에 끼워 넣어, 기존 JSDoc 이 원래 대상 선언에서 분리됨(orphaned)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-315`
  - 상세: `AuthTokenExpiredPayload` 를 설명하던 기존 JSDoc(287~301행, `Wire payload for {@link AuthEventType.AUTH_TOKEN_EXPIRED}...`)이 있었는데, 이번 diff 가 그 JSDoc 과 대상 선언(`export interface AuthTokenExpiredPayload`, 312행) 사이에 `MSG_AUTH_TOKEN_EXPIRING` 상수와 그 상수의 새 JSDoc(302~308행)을 끼워 넣었다. 그 결과 소스 순서가 `JSDoc(A, interface 용) → JSDoc(B, const 용) → const 선언 → interface 선언`이 되어, `AuthTokenExpiredPayload` 바로 위에는 더 이상 어떤 JSDoc 도 붙어 있지 않다. IDE hover·TypeDoc 등 "선언 바로 위 주석만 doc-comment 로 인식" 하는 도구에서는 A 블록이 어디에도 귀속되지 않는 죽은 텍스트가 되고, `AuthTokenExpiredPayload` 는 `expiresAt` 의 의미(§4.6, "이 소켓이 강제 종료되는 시각")·클라이언트가 이 값을 소비하지 않는다는 계약 등 중요한 설명을 잃는다. 실제 저장소 파일(`Read` 로 확인)에서도 동일하게 재현됨.
  - 제안: `MSG_AUTH_TOKEN_EXPIRING` 상수(+그 JSDoc)를 `AuthTokenExpiredPayload` 인터페이스 선언 **뒤**로 옮기거나, 기존 JSDoc(287~301) 을 `AuthTokenExpiredPayload` 바로 위로 재배치해 각 JSDoc 이 자신이 설명하는 선언에 인접하도록 정리한다.

- **[WARNING]** `websocket.gateway.ts` 에서 동일한 "JSDoc 끼워넣기로 인한 orphan" 패턴이 두 번 더 발생 — 필드 하나, 메서드 하나
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:147-190`
  - 상세:
    1. `expiryTimers` 필드(157~160행) 위에 JSDoc 이 **두 개 연속**으로 쌓여 있다(147~150행의 기존 JSDoc, 151~156행의 새 JSDoc). 내용도 상당 부분 겹친다 — 둘 다 "handleDisconnect 에서 둘 다/항상 해제해야 한다"는 취지를 반복 서술한다. 앞쪽 블록(147~150)은 사실상 죽은 문서가 된다.
    2. 더 심각한 사례: 162~176행의 기존 JSDoc(`"소켓 수명을 토큰 수명에 종속시킨다..."`, §1.2 의 revoke 카브아웃·`exp` 부재 처리 등 핵심 설계 설명 15행)은 diff 이전에는 `armExpiryTimers`(현재 190행) 바로 위에 붙어 있었다. 이번 diff 가 그 사이에 신규 `clearExpiryTimers` 메서드(182~188행)와 그 JSDoc(177~181행)을 끼워 넣으면서, 162~176행의 JSDoc 은 이제 `armExpiryTimers` 가 아니라 자신과 무관한 `clearExpiryTimers` 바로 위에 놓이게 됐다. 실제로는 두 JSDoc(162~176, 177~181)이 연속으로 쌓여 있어 앞쪽(162~176, 더 크고 중요한 설계 근거)이 orphan 되고, 정작 이 PR 의 핵심 변경 대상인 `armExpiryTimers` 는 바로 위에 아무 JSDoc 도 없는 상태가 됐다. 같은 diff 안에서 다른 설명들(예: 212~215행의 "같은 client.id 로 다시 무장하면..." 인라인 주석, 236~237행의 unref 설명)은 정확히 관련 코드 바로 위에 붙여 넣어 올바르게 처리했다는 점에서, 이 두 군데만 배치가 어긋난 것은 리뷰 누락에 가깝다.
  - 제안: (1) `expiryTimers` 의 두 JSDoc 을 하나로 병합(중복 문장 제거, non-optional 근거만 남기고 기존 설명은 통합). (2) `clearExpiryTimers` 의 JSDoc+본문을 `armExpiryTimers` **뒤**(또는 파일의 다른 자리)로 옮겨서 162~176행의 기존 JSDoc 이 다시 `armExpiryTimers` 바로 위에 붙도록 복원한다.

- **[INFO]** 상수명 시제와 연결된 이벤트/enum 명 시제가 어긋남
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:309`(`MSG_AUTH_TOKEN_EXPIRING`) vs `:283-285`(`AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'`)
  - 상세: 이 상수는 만료 60초 **전** 사전 통지(`armExpiryTimers` 의 `notice` 타이머)에서만 쓰이므로 "EXPIRING"(진행/예정) 이 내용상 더 정확하다. 반면 그 통지가 실려 나가는 이벤트 이름과 페이로드 타입은 `AUTH_TOKEN_EXPIRED`/`AuthTokenExpiredPayload`(완료형)다. 파일 자체가 이미 `token_expired`(DB 슬러그)·`TOKEN_EXPIRED`(REST 에러 코드)·`AUTH_TOKEN_EXPIRED`(WS 이벤트) 세 개의 유사 명칭을 신중히 구분해 온 만큼, 같은 payload 를 가리키는 상수 하나만 시제가 다른 것도 향후 "왜 EXPIRING 인데 이벤트는 EXPIRED 냐"는 재질문을 부를 수 있다.
  - 제안: 반드시 리네임할 필요는 없으나, 상수 JSDoc 에 "이 값은 `AUTH_TOKEN_EXPIRED` 이벤트로 나가지만 내용은 사전 통지(EXPIRING)"라는 한 줄을 덧붙이면 향후 재질문을 선제 차단할 수 있다.

## 긍정적으로 확인된 부분 (참고)

- `handleDisconnect` 안에 인라인으로 있던 타이머 쌍 해제 로직(옛 `if (timers) { if (timers.notice) ... if (timers.cutoff) ... }`)을 `clearExpiryTimers` 로 추출해 `armExpiryTimers` 의 재무장 경로와 공유한 것은 중복 제거·단일 책임 분리 측면에서 명확한 개선이다.
- `expiryTimers` 맵 값 타입을 `{ notice?: ...; cutoff?: ... }` 에서 `{ notice: ...; cutoff: ... }` 로 non-optional 화한 것은 "있을 수 없는 상태"를 타입으로 배제해 소비 측의 방어적 분기(죽은 코드)를 없앤 정상적인 타입 강화다.
- `MSG_NOT_AUTHENTICATED`/`MSG_NOT_AUTHORIZED_EXECUTION` 등 기존 `MSG_` 접두 상수 네이밍 컨벤션을 `MSG_AUTH_TOKEN_EXPIRING` 이 그대로 따르고 있어 일관성이 유지된다.
- 신규 테스트 3종(문구 상수 일치, 재무장 시 타이머 해제, unref)은 각각 뮤테이션으로 실제로 무는 것을 확인했다는 근거(plan 파일)가 있고, 테스트명·구조가 기존 describe 블록의 스타일(한국어 설명 + 근거 절 번호)과 일관된다.

## 요약

이번 변경은 기능적으로는 견고하다 — 타이머 쌍 해제 로직을 헬퍼로 추출해 중복을 없앴고, 옵셔널 타입을 non-optional 로 좁혀 불가능한 상태를 컴파일 타임에 배제했으며, 신규 테스트도 뮤테이션 검증을 거쳤다. 다만 문서(JSDoc) 삽입 위치에서 반복적인 실수가 있다 — 새 선언(상수·메서드)을 기존 JSDoc 과 그 대상 선언 사이에 끼워 넣어, 정작 중요한 설계 근거 문서(특히 `armExpiryTimers` 의 15행짜리 §1.2 설명)가 엉뚱한 선언 위에 놓이거나 아무 데도 귀속되지 못하는 상태가 됐다. 같은 diff 안에서 인라인 주석은 정확한 위치에 잘 붙였다는 점을 감안하면 이는 체계적 설계 결함이라기보다 반복된 편집 실수에 가까우며, 병합 전에 한 번의 정리 커밋으로 바로잡을 수 있는 수준이다.

## 위험도

LOW
