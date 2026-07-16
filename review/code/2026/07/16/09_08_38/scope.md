# 변경 범위(Scope) Review

## 대상

`HEAD~1..HEAD` (커밋 `0080c917d docs(chat-channel): 최종 consistency 반영 — "6함수" 카운트 정리 + 마이그레이션 note`), 6개 파일:

- `CHANGELOG.md`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.spec.ts`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`
- `spec/5-system/15-chat-channel.md`
- `spec/conventions/chat-channel-adapter.md`

## 발견사항

전 파일 diff 를 라인 단위로 검토한 결과 실질 로직 변경은 없다.

- **[INFO]** 모든 변경이 문자열/주석/문서 wording 정정으로 한정됨
  - 위치: 6개 파일 전체
  - 상세: `discord.adapter.spec.ts`/`slack.adapter.spec.ts` 는 `it(...)` 테스트 설명 문자열만 `"6함수 모두 노출"` → `"핵심 함수 노출"` 로 바뀌었고 assertion 로직(`expect(...)`)은 한 글자도 안 바뀜. `slack.adapter.ts` 는 클래스 JSDoc 의 `"Phase 1: 6함수 stub"` → `"Phase 1: 핵심 함수 stub"` 주석 1줄만 변경, 실행 코드(런타임 동작)는 무변경. `spec/5-system/15-chat-channel.md`/`spec/conventions/chat-channel-adapter.md` 도 `"6함수 인터페이스"` 류 표현을 `"인터페이스(필수 함수 + 옵션 함수)"`/`"어댑터 인터페이스"`/`"어댑터 함수(필수 코어 + ack + escapeControlText)"` 로 정정하는 prose-only 변경이다.
  - 근거: 이 커밋 이전 두 커밋(`41818b9af`/`2a2e3a8c7`)에서 `ChatChannelAdapter` 에 `escapeControlText` 함수가 신설돼 어댑터 인터페이스가 "6함수" 를 초과했다. 이 커밋은 그 사실 변경을 뒤늦게 stale 남아있던 "6함수" 문구들에 반영하는 순수 consistency-fix 커밋이며, 커밋 메시지("6함수 카운트 정리")와 정확히 일치한다.
  - 제안: 없음 — 의도 그대로 comment/문서 정정에 국한됨.

- **[INFO]** `CHANGELOG.md` 변경은 기존 항목에 배포 마이그레이션 안내 단락을 추가하는 것으로, 이 역시 동일 escapeControlText 피처(직전 커밋들)의 후속 ops 안내이지 무관한 신규 서술이 아님
  - 위치: `CHANGELOG.md` line 35-36 (동일 "Unreleased" 항목 내 단락 append)
  - 상세: 추가된 문장은 "**배포 마이그레이션 주의**: F-5(#950) 체제에서 telegram operator 가 escape 된 override(`\.`)를 저장했다면 배포 후 `escapeControlText` 가 재-escape 해 send 400 가능..." — 새 기능/새 스코프가 아니라 같은 커밋 세트가 만든 breaking 시나리오에 대한 운영 안내이므로 범위 내.
  - 제안: 없음.

- 위 6개 파일 외 무관한 파일 수정, 리팩토링, import 정리, 포맷팅 잡음, 기능 확장은 발견되지 않았다. 테스트 assertion 자체나 실행 로직을 건드린 곳도 없다.

## 요약

이번 diff(`HEAD~1..HEAD`)는 직전 커밋들에서 `escapeControlText` 어댑터 함수가 추가되면서 stale 해진 "6함수" 표현을 테스트 설명·JSDoc·spec 문서 4곳에서 정정하고, CHANGELOG 에 관련 배포 마이그레이션 주의 단락을 덧붙이는 순수 문서/주석 정합화 커밋이다. 실행 코드(assertion, 로직, import, 설정)는 전혀 변경되지 않았으며 모든 변경이 커밋 메시지가 명시한 목적("6함수 카운트 정리 + 마이그레이션 note")에 정확히 부합한다. 의도 이상의 변경, 무관한 리팩토링, 기능 확장, 포맷팅 잡음은 없다.

## 위험도

NONE
