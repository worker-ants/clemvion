# RESOLUTION — webchat eager-start §R6 (review/code/2026/06/06/12_58_00)

본 리뷰는 직전 라운드(12_47_01)의 I1(newChat pendingSendRef 누수) 수정 commit 을 포함한 **최종 코드**를 검토했다. Critical 0, Warning 7 — 전부 **비차단 backlog/품질 개선**이며, 기능 결함(I1)은 이미 해소됐다. 코드 변경 없이 RESOLUTION 으로 종결한다(리뷰가 HEAD 를 커버 + Warning 보류 근거 명시).

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 근거 |
|---|---|---|---|
| W1 | 보안 | 보류(backlog) | `start()` catch 의 `errMessage(e)` UI 노출은 **본 PR 이전부터 존재**(eager 전환과 무관, 기존 start/sendCommand catch 패턴). per_execution·iframe 격리 환경에서 위험 제한적. 위젯 전역 에러 메시지 일반화는 별도 보안-하드닝 follow-up. |
| W2 | 보안 | 보류(backlog) | `pendingSendRef` 는 **단일 항목**(덮어쓰기)이라 현재 DoS 경로 없음. 배열 확장 시 상한 강제는 그때 검토. 코드 주석으로 "최신 1건" 제약 이미 명시. |
| W3 | 아키텍처 | 보류(backlog) | `useWidget` God hook 분리(`usePendingMessageQueue`/`useTokenRefresh` 추출)는 구조 리팩터 — 리뷰어도 "즉각 불필요". `channel-web-chat-followups.md` 백로그. |
| W4 | 부작용 | 해소(주석) | `open()` 에 webhook POST 네트워크 부작용 JSDoc 추가 완료(commit, 본 리뷰 대상에 포함). |
| W5 | 유지보수 | 보류(backlog) | `pending.type` 텍스트표면 판정 3중 중복 → `isTextInputSurface()` 헬퍼 추출. 동작 동일, 리팩터 후속(타입 3값 고정이라 즉시 회귀 위험 낮음). |
| W6 | 테스트 | 보류(backlog) | `panel.test.tsx` `ended` Composer 미렌더 케이스 — 커버리지 보강 후속(현재 `!isEnded` 게이트는 구현·수동확인됨). |
| W7 | 테스트 | 보류(backlog) | `setTimeout(20ms)` negative-assertion → fake timer 전환. 테스트 견고성 개선 후속(현재 통과·flaky 미관측). |

INFO(16건): SPEC-DRIFT(awaiting_user_input→awaiting_user_message·시퀀스)는 이미 spec 반영 완료(commit 5cecc91b). 나머지(localStorage 토큰, index signature, actions.start @deprecated, teardownSession 추출, flush effect deps 등)는 비차단 backlog.

## TEST 결과

- lint  : 통과 (channel-web-chat)
- unit  : 통과 (181 — eager-start hook·C1 queue-flush·reducer·panel composer 게이팅 포함)
- build : 통과 (next build, TS clean)
- e2e   : 통과 (174/174, dockerized backend `make e2e-test` — `_test_logs/e2e-20260606-125744.log`)

## 보류·후속 항목

`channel-web-chat-followups.md` 이관 대상 (모두 비차단):
- 보안 하드닝: `start()` 에러 메시지 일반화(W1), `pendingSendRef` 배열화 시 상한(W2), localStorage→sessionStorage 토큰(INFO).
- 아키텍처: `useWidget` God hook 분리(W3), `isTextInputSurface()` 헬퍼(W5), `teardownSession()` 헬퍼.
- 테스트: `ended` Composer 미렌더(W6), fake timer 전환(W7), C1 buttons/form 폐기·ended 재open 케이스.
- API: `eia-client` payload index signature 제거 검토.
