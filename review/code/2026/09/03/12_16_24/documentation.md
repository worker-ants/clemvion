# 문서화(Documentation) 코드 리뷰

## 리뷰 대상 요약

이번 diff(커밋 `b75e6a76b` — `fix(ws): 리뷰 1R — 새 심볼을 JSDoc 과 그 대상 사이에 끼워 넣었다`)는
직전 review round(`review/code/2026/09/03/11_57_58/`)가 지적한 **JSDoc 오귀속(orphaned JSDoc)**
2건 + W3(조기 `return` 이 선제 해제보다 먼저 도는 회귀) + INFO 3건을 닫는 후속 수정이다.
실제 커밋 상태(`git show HEAD:<path>`)를 직접 열어 확인한 결과, 지적됐던 오귀속 2건은
**정확히 고쳐졌다**:

- `websocket.gateway.ts` — `armExpiryTimers` 의 §1.2 JSDoc(약 15줄)이 이제 다시
  `armExpiryTimers` 선언 바로 위에 있고, `clearExpiryTimers`(+ 그 자신의 새 JSDoc)는
  `armExpiryTimers` **뒤**로 옮겨져 각 심볼이 자신의 JSDoc 을 갖는다.
- `websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING`(+ 그 JSDoc)이
  `AuthTokenExpiredPayload` 인터페이스 **뒤**로 옮겨져, 기존 payload JSDoc 이 다시 인터페이스에
  인접한다.
- `expiryTimers` 필드의 중복 JSDoc 두 블록도 하나로 병합됐다.

이 부분은 **긍정적 확인**이며 새로운 WARNING/CRITICAL 대상이 아니다.

## 발견사항

- **[INFO]** JSDoc 오귀속을 고치는 과정에서, 정확히 그 두 자리에만 **JSDoc-선언 사이에 빈 줄**이
  새로 생겨 파일 자체의 기존 관례(빈 줄 없음)와 어긋난다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:176`(신규 빈 줄, `armExpiryTimers` JSDoc 과 선언 사이) · `codebase/backend/src/modules/websocket/websocket-events.types.ts:302`(신규 빈 줄, `AuthTokenExpiredPayload` JSDoc 과 인터페이스 사이)
  - 상세: 두 게이트 라인 모두 diff 상 `+`(신규 추가)로, 이전에는 JSDoc `*/` 바로 다음 줄이
    선언이었다. `gateway.ts` 는 이번 diff 이전부터 있던 다른 JSDoc-선언 쌍(예: 41→42,
    76→77, 144→145, 155→156, 584→585, 606→607, 904→905, 1064→1065, 이상 10곳, 커밋된 파일
    기준 실측)이 전부 빈 줄 없이 붙어 있고, `websocket-events.types.ts` 도 선언을 직접
    설명하는 JSDoc 17곳(`ExecutionChannelEvent`·`ChatChannelRoutingInfo`·
    `ExecutionRoutingContext`·`USER_MESSAGE`·`EXECUTION_MESSAGE`·`ToolCallStartedPayload`·
    `UserMessagePayload`·`ToolCallCompletedPayload`·`BackgroundRunEventType`·
    `InAppNotificationEventType`·`NotificationNewPayload`·`KbEventType`·`AuthEventType` 등)가
    모두 빈 줄 없이 붙는다. 같은 diff 로 새로 삽입된 `clearExpiryTimers` JSDoc(`gateway.ts`,
    선언 바로 위 빈 줄 없음)·`MSG_AUTH_TOKEN_EXPIRING` JSDoc(`websocket-events.types.ts:314-315`,
    빈 줄 없음)도 빈 줄 없는 관례를 따른다 — 오직 이번에 "복원"된 두 자리만 빈 줄이 생겼다.
    기능적으로는 대부분의 IDE hover·TSDoc 파서가 JSDoc 과 선언 사이 빈 줄 한 줄까지는
    여전히 그 선언의 문서로 인식하므로 재-오귀속은 아니지만, 이 diff 의 주제가 정확히
    "JSDoc-선언 인접성"이라는 점에서 이 정도 사소한 흠도 남기지 않는 편이 이후 재지적을
    막는다.
  - 제안: 두 자리의 빈 줄을 제거해 파일 전역 관례(빈 줄 없음)와 통일한다.

- **[INFO]** `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의 "이월 INFO 5건 —
  한 번에 닫았다" 체크리스트 항목이, 그 닫는 커밋(`69aad5d5d`) 자체에서 재발한 W3 회귀와
  JSDoc 오귀속 2건(그리고 그것을 고친 후속 커밋 `b75e6a76b`)을 별도로 교차 참조하지 않는다
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (게이트 93-106, "이월 INFO
    5건 — 한 번에 닫았다 (2026-09-03)" 항목)
  - 상세: 이 항목은 `69aad5d5d` 커밋이 닫은 5건만 서술하고, 그 커밋 자체가 새 리뷰 라운드
    (`review/code/2026/09/03/11_57_58/`)에서 3건(JSDoc 오귀속 2 + W3 회귀 1)을 다시 만들었다가
    `b75e6a76b` 로 고친 사실은 plan 본문에 없다(`review/code/2026/09/03/11_57_58/RESOLUTION.md`
    에는 있음). plan 파일만 읽는 이후 독자는 이 하위 사이클(고치다 재발 → 재고침)을 놓친다.
    커밋 메시지의 "리뷰 1R" 라벨도 원 PR(`#1266`) 리뷰 라운드(plan 게이트 89·162 의 "리뷰 1R")와
    같은 이름을 재사용해, `git log -S "리뷰 1R"` 로 이력을 추적하면 서로 다른 두 리뷰 사이클이
    같은 이름으로 섞인다.
  - 제안: 필수는 아니나, plan 체크리스트 항목에 "닫는 과정에서 새 리뷰 라운드가 재발 3건을
    잡아 `b75e6a76b` 로 추가 정정" 한 줄과 `review/code/2026/09/03/11_57_58/` 링크를 덧붙이면
    plan 단독으로도 전체 이력이 재구성된다.

## 관측한 이상 상태 (저장소 상태, 이 diff 의 일부 아님 — 뮤테이션 오염 경고)

리뷰 도중(약 12:2x KST) `git status --short` 로 저장소를 확인하던 중, **이 diff 범위 밖에서**
아래 두 파일이 **커밋되지 않은 상태로 일시적으로 뮤테이션**돼 있는 것을 관측했다:

1. `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers` 안의
   `this.clearExpiryTimers(client.id);` 호출이 조기 `return` **뒤**로 되돌아가 있었고, 그
   위치를 정당화하던 인라인 주석("조기 return 보다 먼저 해제한다…")이 삭제돼 있었다. 이는
   정확히 이번 커밋(`b75e6a76b`)이 고친 **W3 회귀를 재현하는 뮤턴트**였다.
2. `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING`
   리터럴이 `'Access token expires soon — refresh and reconnect.'` 에서
   `'Access token will expire soon — refresh and reconnect.'` 로 바뀌어 있었다. 이는 정확히
   신규 테스트("메시지 상수도 리터럴로 못박는다")가 RED 로 잡아야 하는 **문구 변경 뮤턴트**였다.

두 변경 모두 `plan`/`RESOLUTION.md` 가 서술하는 "뮤테이션 RED 확인" 절차와 정확히 일치하는
형태라, 동시에 워킹트리를 읽고 있는 다른 reviewer(들)의 검증용 뮤턴트로 판단된다. **직접
만들지 않았으므로 `git checkout`/`restore` 로 되돌리지 않았고**, 재확인 시점(위 관측 이후)에는
`git status --short` 가 이미 깨끗해져 있어(`?? review/code/2026/09/03/12_16_24/` 만 남음) 자체
정리된 것으로 보인다. 원복 여부를 이 리포트가 보증하지는 않으므로, 최종 push 전
`git status --short` 재확인을 권장한다.

## 확인했으나 문제 없는 항목

- README/CHANGELOG: 이번 diff 는 wire 계약·API·설정을 바꾸지 않는 내부 하드닝이라 갱신 불요.
  `CHANGELOG.md:29` 의 기존 "Unreleased — 소켓이 만료된 토큰으로 무기한 인가돼 있었다" 항목은
  `{ message, expiresAt }` shape 만 서술하고 리터럴 문구를 인용하지 않아, 이번 diff 와 계속
  정합하다.
- 신규 테스트 3종(`websocket.gateway.spec.ts`)의 인라인 주석은 각 단언의 존재 이유를 정확히
  설명한다 — 예: `toHaveLength(2)` 옆의 "정확히 **쌍**이다 — `>= 2` 로 두면…" 주석은 실제로
  느슨한 대안과 그 대안이 놓치는 회귀를 명시해 향후 다시 느슨해지는 것을 막는다.
- `armExpiryTimers` 본문에 새로 추가된 인라인 주석(`Math.max(0, …)` 중복 방어 근거를
  `untilNotice`·`cutoff` 양쪽에 각각 명시)은 직전 라운드에서 "근거 주석이 한쪽에만 있다"고
  지적된 갭을 정확히 메웠다.
- `websocket.gateway.spec.ts` 의 신규 import(`MSG_AUTH_TOKEN_EXPIRING`)·테스트 코드는 실제
  구현과 1:1 대응한다.

## 요약

핵심 발견(직전 라운드의 JSDoc 오귀속 2건 + W3 회귀)은 이번 diff 에서 실제로 올바르게
고쳐졌음을 `git show HEAD:<path>` 로 직접 확인했다 — 새로운 CRITICAL/WARNING 은 없다. 다만
그 고치는 과정에서 두 자리(`armExpiryTimers`, `AuthTokenExpiredPayload`)에 파일 관례와 어긋나는
빈 줄이 하나씩 새로 생겼고, plan 체크리스트가 이 재발-재수정 하위 사이클을 명시적으로
교차참조하지 않는 점을 INFO 로 남긴다. 별도로, 리뷰 도중 이 diff 범위 밖에서 두 파일이
일시적으로 뮤테이션돼 있는 것을 관측했다(다른 reviewer 의 RED 검증으로 추정, 재확인 시점엔
정리됨) — 이 diff 자체에 대한 결함은 아니지만 병합 전 `git status --short` 재확인을 권한다.

## 위험도

LOW
