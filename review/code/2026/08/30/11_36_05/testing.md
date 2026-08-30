# 테스트(Testing) 리뷰

## 검증 방법

`websocket.service.spec.ts` 에 추가된 `re-export facade` 테스트를 실제로 실행하고,
`websocket.service.ts` 의 `InAppNotificationEventType` re-export 줄을 제거하는 뮤테이션을
적용해 RED 를 재확인했다 (원본은 scratch 로 `cp` 백업 후 뮤테이션 → 확인 → `cp` 로 원복,
`git status --short` 로 잔여 diff 없음 확인 완료).

- GREEN (원본): `npx jest websocket.service.spec.ts -t "re-export facade"` → 1 passed
- RED (뮤테이션: `export { … InAppNotificationEventType }` 에서 해당 식별자 제거):
  `TypeError: Cannot read properties of undefined (reading 'NOTIFICATION_NEW')` — plan 문서가
  기록한 예측(`RED 1`)과 실측이 일치한다.
- 되돌린 뒤 파일 전체 재실행: `websocket.service.spec.ts` 64 passed / 64 total.

## 발견사항

- **[INFO]** `InAppNotificationEventType` 은 현재 멤버가 `NOTIFICATION_NEW` 하나뿐이라 이번
  단언으로 완전히 덮이지만, 이 값 자체가 하드코딩된 단일 리터럴 비교라서 향후 이 enum 에
  멤버가 추가되면(예: `NOTIFICATION_DISMISSED`) 그 새 멤버는 이 테스트가 자동으로 덮지
  못한다 — 사람이 기억해서 새 `expect` 를 추가해야 한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — `describe('re-export facade', ...)` 블록 (게이트 `1462`~`1470`)
  - 상세: 같은 PR 계열의 자매 가드 `websocket-events.types.spec.ts` 는 "값/타입 명단을
    하드코딩하지 않고 타입 모듈을 파싱해서 얻는다" 는 원칙을 명시적으로 채택했는데
    (해당 파일의 "무엇이 값이고 무엇이 타입인지는 하드코딩하지 않는다" 주석), 이번 facade
    테스트는 그 원칙과 달리 리터럴 값을 직접 비교한다. 다만 이는 의도된 설계로 보인다 —
    이 테스트의 목적이 "재수출 여부"만이 아니라 "개명 후에도 wire 문자열 값이 불변인가"
    라는 별도 계약(코드 주석: "개명(`NotificationEventType` → 현재 이름, `#1238`)에도 wire
    값은 불변이어야 한다")까지 검증하는 것이므로, 단순 객체 참조 동일성(`toBe`) 비교로
    바꾸면 그 계약을 못 잡는다.
  - 제안: 블로킹 사유는 아니다. 다만 이 enum 에 두 번째 멤버가 생기는 시점에는 (a) 그
    멤버도 명시 단언을 추가하거나 (b) `Object.values(InAppNotificationEventType)` 전수
    순회로 확장하는 편이 이 저장소가 반복 기록한 "부류가 아니라 인스턴스만 고정" 실패
    패턴("`20_05_17`/`20_27_08`" 라운드에서 같은 클래스의 리뷰 지적이 반복된 사례, 자매
    plan 문서에 기록됨)을 예방한다.

## 부가 확인 (교차검증, 결함 아님)

- 재수출되는 값 4개(`ExecutionEventType`·`NodeEventType`·`BackgroundRunEventType`·
  `InAppNotificationEventType`) 중 나머지 셋은 이 spec 파일 본문 전역에서 실제로
  값으로 소비되고 있음을 grep 으로 재확인했다(수십 회 사용) — "나머지 셋은 파일이
  실제로 써서 덮인다" 는 주석의 근거가 맞다.
- `InAppNotificationEventType` 은 실제로 멤버가 `NOTIFICATION_NEW` 하나뿐임을
  `websocket-events.types.ts:226-228` 에서 확인 — 이번 단언이 그 시점 기준 전체
  enum 을 완전히 덮는다.
- `websocket-events.types.spec.ts` 의 `REEXPORT_FACADE_TEST` 상수가 정확히
  `websocket.service.spec.ts` 를 가리키고, 그 파일이 존재하는지만 검사(`facade 테스트가
  실제로 존재한다`)한다는 것도 확인 — 이 파일이 "값이 실제로 검증되는지"까지는 보지
  않으므로, 이번에 추가된 명시 단언이 그 공백을 메우는 유일한 방어선이라는 plan 문서의
  주장과 일치한다.
- 새 테스트는 mock/stub 없이 순수 값 비교이며, 다른 테스트의 상태(`service`/`gateway`
  fixture 등)에 의존하지 않아 격리 위반이 없다. 테스트 이름·JSDoc 모두 의도를 명확히
  드러낸다.
- `git status --short` 재확인 결과 저장소에 남은 변경/백업 파일 없음 (mutation 원복 완료).

## 요약

`websocket.service.spec.ts` 에 추가된 `re-export facade` 테스트 1건은 실제로 존재하던
갭(재수출 값 중 소비처가 없어 오탈자로 끊겨도 RED 가 나지 않던 `InAppNotificationEventType`)을
정확히 닫는다. 직접 뮤테이션·복구로 RED/GREEN 을 재확인했고 plan 문서의 실측 주장과
일치했다. 나머지 diff(plan 문서 5건)는 대부분 `plan/in-progress/` → `plan/complete/` 이동
(git mv 성격의 추가/삭제 쌍)이거나 트래커의 링크 한 줄 갱신이라 테스트 관점에서 review할
실질 코드가 없다. 유일한 실질 코드 변경은 잘 설계된 소규모 회귀 테스트이며, 발견한 것은
"미래에 enum 멤버가 늘면 수동으로 따라가야 한다"는 INFO 수준의 유지보수성 관찰 하나뿐이다.

## 위험도

NONE
