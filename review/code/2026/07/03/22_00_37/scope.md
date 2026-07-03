# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** ws-client.test.ts 의 `createMockSocket()` mock 객체에 `active: false` 필드 추가
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:6`
  - 상세: m-3 구현(`connect()` 의 `socket.active` 가드)이 요구하는 최소한의 mock 확장으로, 신규 테스트를 위한 필수 지원 변경이다. 범위 이탈 아님.
  - 제안: 조치 불요.

- **[INFO]** `use-execution-events.test.ts` 의 기존 단언 주석 사소 수정 (`// Verify cleanup removes connect handlers` → 마침표 추가 + 카운트 근거 설명 추가) 및 카운트 값 변경(2→4, 1→2)
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:265-281`
  - 상세: `bind()`(off-before-on) 도입에 따른 필연적 회귀 업데이트이며, 추가된 주석도 카운트가 왜 바뀌었는지 설명하는 근거로 범위 내. 임의 포맷팅이나 무관 정리 아님.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/07/03/21_48_56/*` (SUMMARY, RESOLUTION, 14개 reviewer 산출물, `_retry_state.json`) 및 `plan/in-progress/refactor/06-concurrency.md`·`README.md` 동시 커밋
  - 위치: `review/code/2026/07/03/21_48_56/**`, `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md`
  - 상세: 프로젝트 규약상 review 산출물은 gitignore 대상이 아니며 developer 워크플로가 구현 완료 후 `/ai-review` + resolution 을 상시 의무로 요구한다(CLAUDE.md 「구현 완료 후 자동 review/fix」). plan 체크박스도 실제 상태와 동기화해야 한다(프로젝트 규약). 실제로 갱신된 plan 항목은 이번 배치의 M-3/M-6/m-3/m-5 4건뿐이며 다른 plan 항목은 손대지 않았고, README 06 행의 숫자 갱신도 정확히 이번 배치분(완료 76→81, 미완 8→3, A-잔존 1→0)만 반영한다. `git show`로 대조 확인함 — 무관한 plan 항목이나 다른 refactor 파일 수정 없음.
  - 제안: 조치 불요 — 프로젝트 표준 워크플로 산출물이며 스코프 이탈이 아니다.

- **[INFO]** `handleUnsubscribe` sync → `async`/`Promise` 시그니처 변경
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-155`
  - 상세: plan M-3 항목이 명시적으로 "leave 도 await(best-effort)" 를 포함하므로, join 뿐 아니라 unsubscribe 의 leave 도 await 로 전환된 것은 plan 기술 범위 내(비대칭 해소를 위한 의도된 대칭 변경)다. 임의 확장 아님.
  - 제안: 조치 불요.

- **[INFO]** `handleDisconnect` 의 leave 는 여전히 `void` 유지 (M-3 항목이 join/leave 모두를 건드릴 것으로 예상했다면 비대칭으로 보일 수 있음)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:140-146`
  - 상세: 코드 주석과 plan 완료 근거 모두 "disconnect 시 socket.io 가 auto-leave 하므로 방어적·redundant, await 실익 없음"을 명시적으로 근거로 남겼다. 의도적으로 손대지 않은 것이며 누락이 아니다.
  - 제안: 조치 불요.

## 요약
이번 diff는 `plan/in-progress/refactor/06-concurrency.md` 에 명시된 잔여 4개 항목(M-3/M-6/m-3/m-5)만 정확히 구현한다. 각 코드 변경(backend gateway join/leave await+롤백, frontend ws-client active 가드, frontend hook bind 이중등록 방어·dismiss hysteresis)은 대응하는 plan 항목의 서술과 1:1 매칭되며, disconnect 경로의 leave 는 근거를 남기고 의도적으로 미변경 상태를 유지했다. 회귀 테스트 추가(join 실패 롤백, leave 실패 best-effort, active 가드, off-before-on dedup, hysteresis)는 모두 신규/변경 로직에 대한 필수 검증이며 무관한 테스트 정리나 리팩토링은 없다. plan/README 갱신은 정확히 이번 배치 4항목에 국한되고, review 산출물(SUMMARY/RESOLUTION/reviewer 14종) 커밋은 프로젝트가 상시 의무화한 `/ai-review` 워크플로 산출물로 스코프 이탈이 아니다. 포맷팅만의 변경, 불필요한 임포트 정리, 무관 파일 수정, 요청 외 기능 확장은 발견되지 않았다.

## 위험도
NONE
