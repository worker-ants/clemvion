# 테스트(Testing) 리뷰 — WS `auth.token_expired` 이월 INFO 5건 정리

## 범위

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` 상수 신설
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 신규 테스트 3건
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `clearExpiryTimers` 추출, `expiryTimers` non-optional 화, `.unref()` 추가, 상수 사용
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 체크리스트 갱신 (문서만)

## 검증 방법

repo 파일을 `mktemp` 스크래치가 아닌 원본 파일 자체에 대해 `cp` 백업 후 뮤테이션 → 테스트 실행 → `cp` 원복 방식으로 3개 항목을 직접 재현했다(진행 순서: 백업 → mutate → red 확인 → restore → `diff`/`git status --short` 로 원복 확인, 매 항목 종료 시). 세 항목 모두 원복 확인 완료, 잔여물 없음.

| 항목 | 뮤테이션 | 결과 |
|---|---|---|
| `MSG_AUTH_TOKEN_EXPIRING` 상수화 | `armExpiryTimers` 내부 `message: MSG_AUTH_TOKEN_EXPIRING` → 리터럴 `'MUTATED wire message'` | RED (`통지 payload 의 message 는 공용 상수와 일치한다` 테스트 실패, 기대값과 수신값 정확히 diff) |
| `armExpiryTimers` 선제 `clearExpiryTimers` | 해당 호출 라인 주석 처리 | RED (`같은 client.id 로 재무장하면...` 테스트 — `oldEmits+newEmits` 기대 1, 실측 2) |
| `.unref()` 추가 | `notice.unref(); cutoff.unref();` 두 줄 주석 처리 | RED (`만료 타이머는 unref 된다` 테스트 — `hasRef()` 기대 false, 실측 true) |

세 건 모두 plan 문서(`ws-token-expired-socket-lifetime-impl.md:93~106`)가 주장한 "뮤테이션 3축 RED"와 일치한다 — vacuous 테스트가 아님을 직접 확인했다. 전체 스위트(`websocket.gateway.spec.ts`, 70개)도 뮤테이션 전/후 모두 통과 상태로 회귀 없음을 확인했다.

## 발견사항

- **[INFO]** `재무장(rearm)` 테스트는 현재 프로덕션에서 도달 불가능한 경로를 검증한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:809` (`같은 client.id 로 재무장하면 옛 타이머를 먼저 해제한다` 테스트)
  - 상세: 테스트 자체 주석이 명시하듯 Socket.IO 는 연결마다 새 `id` 를 발급하므로, 동일 `client.id` 로 두 번 `handleConnection` 이 호출되는 상황은 `connectionStateRecovery` 를 켜지 않는 한 현재 코드베이스에서 발생하지 않는다. 테스트는 "도달 불가"와 "검증 불가"를 구분한다는 plan 의 명시적 결정(`ws-token-expired-socket-lifetime-impl.md:102-104`)에 따라 의도적으로 작성된 선제 방어 테스트이며, 뮤테이션으로 실제 결함을 잡는 것도 확인했다(위 표). 결함은 아니고, 향후 `connectionStateRecovery` 도입 시 이 테스트가 이미 회귀를 커버한다는 점에서 오히려 좋은 선제 조치다. 다만 "왜 이 경로가 지금은 죽은 코드가 아닌가"를 리뷰어가 다시 묻지 않도록 테스트 자체에 이미 근거가 있다는 점만 기록해 둔다.
  - 제안: 조치 불필요. 참고 기록.

- **[INFO]** unref 테스트의 타이머 선별이 `>=2` + `slice(-2)` 로 다소 느슨하다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:832-843` (`만료 타이머는 unref 된다` 테스트)
  - 상세: `spy.mock.results` 에서 object 타입 반환값만 걸러 `created.length >= 2` 로 확인한 뒤 `slice(-2)` 로 마지막 두 개(=이 테스트가 만든 notice/cutoff)만 `hasRef()` 를 단언한다. 현재 `armExpiryTimers` 가 `setTimeout` 을 정확히 2회(notice, cutoff 순) 호출하고 이 테스트가 그 호출 직전에 spy 를 설치하므로 실측상 문제는 없다(직접 실행 확인). 다만 향후 `armExpiryTimers` 앞단에 다른 `setTimeout` 호출이 끼어드는 리팩터가 있어도 이 테스트는 `slice(-2)` 덕에 계속 통과하므로, "정확히 2개"라는 불변식이 약화될 여지가 있다. `toBe(2)` 로 좁히면 의도가 더 명확해진다.
  - 제안: 필수 아님. 여유가 있다면 `toBe(2)` + `created` 전체(슬라이스 없이)로 좁혀 정밀도를 높이는 것을 고려.

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 문구 리터럴이 소스와 테스트 두 곳에 존재 — 의도된 중복
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:309-310` vs `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:804-806`
  - 상세: 테스트가 상수 참조(`expect.objectContaining({ message: MSG_AUTH_TOKEN_EXPIRING })`)와 리터럴 값 단언(`expect(MSG_AUTH_TOKEN_EXPIRING).toBe('Access token expires soon...')`)을 함께 쓴다. 소스의 JSDoc 이 "상수만 참조하면 문구가 통째로 바뀌어도 안 걸린다"고 스스로 근거를 남겼고, 위 뮤테이션 검증으로 실제로 걸림을 확인했다. 이중 관리 비용(문구 변경 시 두 곳 수정)이 있지만, 이는 "관측 가능한 wire 계약을 의도적으로 못박는다"는 목적에 부합하는 트레이드오프이며 오히려 바람직한 설계로 판단한다.
  - 제안: 조치 불필요.

## 커버리지 갭 (경미)

- `armExpiryTimers` 의 `exp` 값이 `NaN`/`Infinity` 인 경우는 `undefined` 케이스(`exp 가 없는 토큰이면...` 테스트)와 동일한 `!Number.isFinite` 분기를 타지만 별도로 테스트되지 않는다. 분기가 공유되어 리스크는 낮으나, 방어 대상으로 명시된 값들이라 원하면 추가할 수 있다 (필수는 아님, 회귀 위험 낮음).
- `handleDisconnect` 를 만료 타이머가 없는 클라이언트(`connectWithExp` 를 거치지 않은 소켓)에 대해 호출하는 경로(`clearExpiryTimers` 의 `if (!timers) return` 분기)는 새 테스트로 명시적으로 커버되지 않지만, 기존 `handleDisconnect` describe 블록의 테스트가 암묵적으로 이 분기를 통과시킨다(크래시 없이 통과 = 방어 성립). 명시적 단언은 없으나 우선순위 낮음.

## 요약

세 가지 이월 INFO(상수화+리터럴 단언, `armExpiryTimers` 선제 `clearExpiryTimers`, `.unref()`) 각각에 대해 plan 문서가 주장한 "뮤테이션 RED"를 리뷰어가 독립적으로 재현했고 모두 실제로 해당 회귀를 잡는 것을 확인했다 — vacuous 테스트가 아니다. `재무장` 테스트는 현재 프로덕션 경로상 도달 불가능하지만 그 사실이 테스트 자체에 명시되어 있고 뮤테이션으로 실효성이 입증됐으므로 결함이 아니라 선제 방어로 판단한다. 신규 테스트 3건은 격리(고유 `client.id` 사용), 가독성(한국어 의도 설명), 기존 스위트와의 비간섭(전체 70개 테스트 통과, 회귀 없음) 측면에서 양호하다. 발견된 사항은 모두 INFO 등급으로, 차단 사유는 없다.

## 위험도

NONE
