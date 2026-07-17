# Documentation Review

## 발견사항

- **[WARNING]** `finalizeEnded` JSDoc 이 이번 diff 로 stale 해짐 — "두 진입점" 서술이 실제로는 4곳
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:166-179`(`finalizeEnded` JSDoc, 미변경) vs 이번 diff 로 신설된 호출부 `:423-425`(`sendCommand` 410 catch), `:576-577`(`endConversation`)
  - 상세: `finalizeEnded` 의 JSDoc 은 "**두 진입점이 공유한다**: (1) SSE terminal 이벤트(`handleEiaEvent`) (2) `getStatus` 스냅샷이 이미 terminal 인 경우(`seedWaitingFromStatus`)"라고 명시한다. 그런데 이번 diff 가 W1(410 dedup)·W4(`endConversation` 통합) 처분으로 `sendCommand` 의 410 catch 와 `endConversation` 도 `finalizeEnded` 를 호출하도록 바꿔, 실제 공유 호출부는 4곳(`handleEiaEvent`, `seedWaitingFromStatus`, `sendCommand` 410 catch, `endConversation`)이 됐다. 이 diff 는 `finalizeEnded` 자체의 JSDoc 블록(166-179행)은 건드리지 않아 "두 진입점" 서술이 그대로 남았다. 같은 diff 의 `RESOLUTION.md`(W3 행)가 정확히 이 패턴("인라인 주석이 여전히 예전 서술" → 오해 유발)을 지적·수정했는데, 동일 diff 가 같은 함수의 다른 docstring 에 같은 종류의 staleness 를 새로 만든 셈이다. `endedRef` 1회 가드의 "블라스트 반경"(몇 개 호출부가 이 가드에 의존하는지)을 과소 서술하면, 다음 사람이 `finalizeEnded` 를 수정할 때 실제 영향 범위를 축소 인식할 위험이 있다.
  - 제안: JSDoc 을 "**네 진입점이 공유한다**: SSE terminal(`handleEiaEvent`) · REST 폴백 terminal(`seedWaitingFromStatus`) · 410 Gone(`sendCommand`) · 사용자 종료(`endConversation`)" 형태로 갱신.

- **[WARNING]** 위젯 세션-라이프사이클 버그 수정 체인 전체에 CHANGELOG.md 항목 없음
  - 위치: `CHANGELOG.md` (Unreleased 섹션), 관련 커밋 `436ee334e`(replay_unavailable 소비 배선) → `e99f46145` → `9dd47e6c9`(CRITICAL fix) → `4dad5993c`(본 diff, W1~W7)
  - 상세: 이 커밋 체인은 실사용자 관측 가능한 동작을 바꾼다 — (a) 5분 버퍼 만료 gap 안에 execution 이 종료됐는데 terminal SSE 가 유실되면 종전엔 위젯이 "AI 응답 중" 상태로 무기한 멈췄으나 이제 `getStatus` 폴백이 종료를 확정한다, (b) SSE terminal 로 이미 종료된 뒤 in-flight 명령이 410 을 받으면 종전엔 host 가 `conversationEnded` 를 중복 통지받을 수 있었으나 이제 1회로 보장된다. `CHANGELOG.md` 는 이 프로젝트에서 이 정도(혹은 더 작은) 스코프의 버그 수정도 꾸준히 기록해 왔다(예: "Manual Trigger `defaultValue` 파라미터가 실행에서 무시되던 버그 수정", "KB WebSocket 이벤트 count drift 정정"). 그런데 이 4개 커밋 중 어느 것도 `CHANGELOG.md` 를 건드리지 않았다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 ⑨-4 항목이 완료 표시는 됐지만 CHANGELOG 반영 여부는 추적하지 않는다.
  - 제안: PR 최종 정리 시(또는 이번 라운드에서) `CHANGELOG.md` 에 "웹채팅 위젯 버퍼 만료(`replay_unavailable`) 종료 감지 + 종료 통지 중복 방지" 항목을 Unreleased 섹션에 추가. SoT 로 `spec/7-channel-web-chat/1-widget-app.md §3.1` 인용.

- **[INFO]** `seedWaitingFromStatus` JSDoc 내부 호출부 개수 서술 불일치 — "두 경로" vs "세 호출부"
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:268`("**호출 시점**: `start()` 직후... 및 `applyConfig()` 세션 복원 직후 — 두 경로 모두...") vs `:286`("세 호출부 모두 이 값으로 게이팅한다") — 이번 diff 가 바로 위(261-263)와 바로 아래(281-286) 블록을 편집하면서 그 사이 268행은 손대지 않음
  - 상세: 같은 JSDoc 블록 안에서 "호출 시점"은 `start()`/`applyConfig()` 두 곳만 나열하지만, 몇 줄 아래 "@returns" 는 "세 호출부"라고 말한다. 실제로는 `handleEiaEvent` 의 `execution.replay_unavailable` 분기(ref 경유 fire-and-forget 호출)까지 포함해 세 곳이 맞다 — "호출 시점" 서술이 그 세 번째 경로를 누락한 것. 이번 diff 가 인접 두 블록을 편집한 김에 이 불일치를 정리할 기회였다.
  - 제안: "호출 시점" 문장에 `handleEiaEvent`(`execution.replay_unavailable` 폴백, fire-and-forget) 를 세 번째 경로로 추가.

- **[INFO]** 신규/기존 `ai-review` 인용 주석 포맷 혼재는 이미 인지·이월됨 — 재확인만
  - 위치: `use-widget.ts`·`use-widget-eager-start.test.ts` 전반의 `(ai-review 02_04_13 ...)`(날짜 없음, 기존) vs `(ai-review 2026-07-17 02_31_18 ...)`(날짜 포함, 이번 diff 신규)
  - 상세: `review/code/2026/07/17/02_31_18/RESOLUTION.md` I2 가 이미 이 혼재를 인지하고 "본 PR 범위 밖(별건 정리)"로 명시 이월했다. 새로 추가된 인용은 일관되게 날짜 포맷을 지켰다 — 확산은 막았지만 기존 무-날짜 인용 정리는 여전히 미해결.
  - 제안: 조치 불요(이미 추적됨). 향후 일괄 정리 라운드에서만 처리.

## 좋은 점 (참고)

- 신규 `SeedOutcome` 3-state 타입의 JSDoc 이 "왜 `boolean` 이 아닌가"(정상 시드/`stale` 폐기가 `false` 로 뭉개지던 문제)를 명시해, 타입 설계 의도를 코드만으로 재구성할 필요가 없게 했다.
- `execution.replay_unavailable` 인라인 주석을 spec §3.1 과 동형으로 정정한 것(W3)이 diff·spec 대조로 검증됨 — 실제로 spec 문구와 일치한다.
- `start()` 내부에 "이 게이팅은 엄밀히 중복이지만 의도적으로 남겼다"는 주석은 오탐 방지용 가짜 테스트 대신 정직하게 설계 트레이드오프를 기록한 모범 사례.
- `RESOLUTION.md` 가 직전 라운드 자기 기록의 부정확성(2건)을 diff 대조로 스스로 적발·정정한 것은 문서 신뢰성 관행으로서 바람직하다.

## 요약

이번 diff 는 직전 라운드(02_31_18)가 지적한 문서화 관련 WARNING(W3 stale 인라인 주석, I1 JSDoc 요약 누락)을 정확히 반영했고, 신규 `SeedOutcome` 타입·신규 테스트에 대한 문서화 수준도 높다. 다만 같은 diff 가 `finalizeEnded` 의 공유 호출부를 2곳→4곳으로 늘리면서 그 함수 자신의 JSDoc("두 진입점이 공유한다")은 갱신하지 않아 새로운 stale 주석을 만들었고 — 이는 이 diff/RESOLUTION 이 스스로 경계했던 바로 그 패턴이다 — `seedWaitingFromStatus` JSDoc 내부에도 호출부 개수 서술 불일치(두 경로 vs 세 호출부)가 남아 있다. 더 넓게는 이 버그 수정 체인(4커밋)이 실사용자 동작을 바꾸는데도 `CHANGELOG.md` 에 전혀 반영되지 않아 프로젝트 관행과 어긋난다.

## 위험도
MEDIUM
