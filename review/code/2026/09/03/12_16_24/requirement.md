# Requirement Review — WS 소켓 수명 종속(`auth.token_expired`) 이월 INFO 정리

## 리뷰 범위

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` 상수 승격
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `expiryTimers` non-optional 화, `clearExpiryTimers` 추출, `armExpiryTimers` 진입부 선제 해제, `.unref()` 추가
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 신규 테스트 4종(메시지 상수 일치·rearm 해제·exp-less rearm 해제·unref)
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 이월 INFO 5건 종결 기록
- `review/code/2026/09/03/11_57_58/*` — 직전 라운드 리뷰 산출물(신규 커밋 대상, 기능 코드 아님)

이전 라운드(11_57_58) SUMMARY 가 지적한 WARNING 3건(JSDoc 오귀속 2건, rearm exp-less 조기 return 누수 1건)이 이번 diff 에서 실제로 해소됐는지가 이번 리뷰의 핵심 검증 대상이다.

## 검증 방법

- `websocket-events.types.ts`, `websocket.gateway.ts` 전체를 `Read` 로 직접 열어 JSDoc 인접성·필드 타입·상수 정의를 육안 대조.
- `spec/5-system/6-websocket-protocol.md` §1.2·§4.6·§9.2·Rationale `R-ws-socket-lifetime-binds-token` 을 grep 으로 열어 lead time(60초)·payload shape(`{message, expiresAt}`)·revoke 카브아웃 서술과 코드 대조.
- `npx jest src/modules/websocket/websocket.gateway.spec.ts` 실행 — 71/71 PASS.
- W3(조기 return 이 선제 해제보다 먼저 실행되는 결함) 재발 여부를 뮤테이션으로 직접 검증: scratch 디렉터리(`/private/tmp/...../scratchpad`)에 원본을 `cp` 로 백업 후, `armExpiryTimers` 의 `this.clearExpiryTimers(client.id)` 호출을 조기 `return` **뒤**로 되돌리는 뮤턴트를 저장소 파일에 직접 적용 → 신규 rearm(exp-less) 테스트가 **RED**로 정확히 반응함을 확인(`first.emit` 이 `auth.token_expired` 로 호출됨을 관측) → `cp` 로 원복 → `git status --short`/`git diff` 로 저장소가 뮤테이션 이전 상태(clean)임을 재확인, `jest` 재실행으로 71/71 GREEN 재확인.
- `grep -rl expiryTimers src/` 로 `{notice, cutoff}` non-optional 화가 다른 소비처에 영향 없음(private field, 유일 참조자)을 확인.

## 발견사항

- **[INFO]** 리뷰 도중 일시적 불일치 관측 — 첫 `Read` 시점에 `websocket-events.types.ts:316` 의 `MSG_AUTH_TOKEN_EXPIRING` 리터럴이 `'Access token will expire soon — refresh and reconnect.'`(단어 `will` 포함)로 보였다. 이는 diff 원문·테스트 리터럴(`websocket.gateway.spec.ts:805`, `'Access token expires soon — refresh and reconnect.'`, `will` 없음)과 불일치하는 상태였다. 그러나 곧이은 재확인(`grep`, `git diff`/`git status --short`)에서는 두 파일 모두 `will` 없는 값으로 **일치**했고, working tree 는 clean(review 세션 디렉터리 제외)했으며 `jest` 도 71/71 GREEN 이었다. 프롬프트가 사전 경고한 대로 **같은 워크트리를 동시에 읽는 다른 reviewer 의 일시적 뮤테이션**을 그 순간에 관측했을 가능성이 높다(자기 자신은 이 파일을 건드리지 않았음 — 뮤테이션 대상은 `websocket.gateway.ts` 뿐이었고 그마저도 `cp` 로 즉시 원복·재확인함). 현재 커밋/워킹트리 상태는 일관되므로 코드 결함으로 분류하지 않으나, 관측한 이상 상태이므로 규약에 따라 기록한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:315-316` (최종 확인값: `will` 없는 버전, 테스트와 일치)
  - 제안: 조치 불요(재확인 결과 정상). 후속 라운드에서 같은 값이 다시 흔들리면 그때는 실제 레이스로 승격해 조사할 것.

- **[INFO]** 이전 라운드 WARNING 3건(JSDoc 오귀속 2건 — `armExpiryTimers`/`AuthTokenExpiredPayload`, rearm exp-less 조기 return 누수 1건) 모두 **현재 코드에서 해소 확인**. `armExpiryTimers` JSDoc(§1.2 설계 근거, `websocket.gateway.ts:161-175`)이 함수 선언(`:177`) 바로 위로 복원됐고, `AuthTokenExpiredPayload` wire 계약 JSDoc(`websocket-events.types.ts:287-301`)도 인터페이스 선언(`:303`) 바로 위로 복원됐다. `armExpiryTimers` 는 `this.clearExpiryTimers(client.id)`(`:184`)를 조기 `return`(`:186`) **이전**에 호출하도록 재배치했고, 신규 테스트(`exp 없는 토큰으로 재무장해도 옛 타이머는 해제된다`, `websocket.gateway.spec.ts:832-856`)가 이를 검증한다 — 뮤테이션으로 RED 재현 완료(위 검증 방법 참조).
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:177-186`
  - 제안: 조치 불요.

## 요구사항 충족 관점 평가

기능 완전성 — spec `R-ws-socket-lifetime-binds-token`·§1.2·§4.6·§9.2 가 정의한 계약(핸드셰이크 `exp` 기반 소켓별 타이머 쌍, 만료 60초 전 1회 `auth.token_expired` emit, `exp` 도달 시 `disconnect()`, `handleDisconnect` 에서 타이머 쌍 해제)이 코드와 line-level 로 일치한다. `TOKEN_EXPIRY_LEAD_MS = 60_000`(spec 고정 60초), payload shape `{message, expiresAt}`(spec §4.6 표), revoke 카브아웃 비확장 서술이 모두 대응한다.

엣지 케이스 — `exp` 부재(`typeof !== 'number' || !isFinite`)·`exp=0`·이미 지난 `exp`(음수 창)·같은 `client.id` 재무장(exp 있음/없음 양쪽)이 모두 테스트로 커버되고, `Math.max(0, …)` 클램프의 "중복 방어" 근거도 JSDoc 에 남아 있다. `exp` 를 falsy 가 아니라 `typeof`+`isFinite` 로 명시 판별해 `exp=0`(falsy 이지만 유효한 시각)을 오분류하지 않는다.

TODO/FIXME — 변경 파일 3종에 TODO/FIXME/HACK/XXX 없음(grep 확인).

의도-구현 일치 — `clearExpiryTimers`(해제 전용) JSDoc 이 "무장·해제 두 자리가 같은 절차를 공유"한다고 설명하는데, 실제로는 `armExpiryTimers` 자신(재무장 시 선제 해제)과 `handleDisconnect` 양쪽에서 호출돼 문구와 정확히 부합한다.

에러 시나리오/반환값 — `armExpiryTimers`/`clearExpiryTimers` 모두 `void` 이고 모든 분기(정상/조기 return)에서 부작용만 남기며 예외를 던지지 않는다. `handleConnection`/`handleDisconnect` 의 기존 에러 경로는 이번 diff 로 변경되지 않았다.

데이터 유효성/비즈니스 로직 — `exp` claim 검증 방식(핸드셰이크에서 이미 JWT 검증을 통과한 값만 타이머 대상)과 revoke 비확장 카브아웃이 spec Rationale 문구와 일치한다.

Spec fidelity — `spec/5-system/6-websocket-protocol.md` §1.2/§4.6/§9.2 및 Rationale `R-ws-socket-lifetime-binds-token` 이 이 기능의 권위 문서이며, 구현·플랜 기록과 field-level 로 어긋나는 지점을 찾지 못했다(코드가 spec 을 벗어나거나 spec 이 낡은 SPEC-DRIFT 정황 없음).

테스트 — `71/71` 로컬 재실행 확인. W3(조기 return 순서) 재발 여부는 직접 뮤테이션으로 RED 확인(vacuous 아님).

## 위험도

NONE
