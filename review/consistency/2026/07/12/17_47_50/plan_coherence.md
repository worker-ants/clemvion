# Plan 정합성 검토 — spec/7-channel-web-chat/ (impl-done)

## 검토 방법
- diff-base `origin/main`(19fca6715, PR #929 머지 시점) 대비 HEAD 워킹트리
  (`llm-usage-doc-alignment-01d7a4`, 커밋 `8ded3d5d4`·`dd68b624d`)의 실제 diff 확인:
  `spec/7-channel-web-chat/2-sdk.md`·`spec/7-channel-web-chat/_product-overview.md`·
  `spec/conventions/i18n-userguide.md` 3개 spec 파일 + `codebase/channel-web-chat/**` 8개 코드 파일.
- `plan/in-progress/**` 전체(42개 항목) 목록 확인 후, target 변경과 교집합 가능성이 있는 항목을
  `i18n`/`locale`/`7-channel-web-chat`/`_product-overview`/`2-sdk` 키워드로 전수 grep.
- 이 diff 를 직접 견인하는 plan(`plan/in-progress/webchat-i18n-followups-cleanup.md`)의 8개 처리 항목과
  실제 diff 를 1:1 대조.

## 발견사항
없음.

target 의 spec 변경 3건은 모두 `plan/in-progress/webchat-i18n-followups-cleanup.md`(PR #929 이후
accept-with-rationale defer 8건 처리 plan, `spec_impact` frontmatter 에 동일 3파일 명시)가 선언한 항목과
정확히 1:1 대응한다.

- `spec/7-channel-web-chat/2-sdk.md` §1 스니펫 `locale: 'ko'` 주석 추가 → plan **#3** ("`'ko'|'en'` 주석").
- `spec/7-channel-web-chat/_product-overview.md` §2 "위젯 chrome EN 다국어화"를 비목표 블록의 예외 문구에서
  목표(v1) 리스트로 이동 → plan **#4** ("목표 (v1) 목록으로 이동"). 이동 전후 내용은 동일하고 위치만 재배치되어
  §목표/§비목표 양쪽에서 서로 self-reference("위 §목표 (v1)")로 정합하게 연결된다.
- `spec/conventions/i18n-userguide.md` P6 문체 절에 dev-only 데모 host(`codebase/channel-web-chat/src/app/demo/**`)
  스코프 제외 문구 추가 → plan **#2**.
- 코드 diff(`WidgetLocale`/`WidgetTranslationKey` 개명, `deepFreeze`, panel/widget-app 테스트)는 plan **#1**·**#5**·
  **#6**~**#8**에 대응하며 전부 채널 내부 전용 리네임·방어 강화·테스트 보강으로 spec 변경을 요구하지 않는다
  (외부 공개 계약·SSE wire·EIA 표면 불변, `review/code/2026/07/12/17_29_04/SUMMARY.md` scope checker 도 "13파일
  전부 plan 8항목 1:1" 로 확인).

**미해결 결정과의 충돌 없음**: 이번 활성화("`BootConfig.locale` 목표 승격")는 신규 결정이 아니라
`plan/complete/webchat-i18n-scope.md` 가 defer 한 옵션(c)의 실행이며 그 defer 자체가 이미 `complete/`로 해소된
plan 이다. 다른 `plan/in-progress/**` 항목 중 이 활성화와 상충하는 "결정 필요"로 남은 web-chat locale/i18n 관련
항목은 없다(전체 in-progress i18n/locale grep 결과 web-chat 관련은 `webchat-i18n-followups-cleanup.md`·
`webchat-widget-presentation-followups.md` 둘뿐이며 후자는 오히려 2026-07-12 항목으로 이번 i18n 활성화를
전제로 한 후속 안내(카루셀 배너 신설 시 위젯 로컬 catalog 경유)를 이미 반영해 두었다 — 충돌 아닌 선제 정합).

**선행 plan 미해소 없음**: target 이 가정하는 사전 조건(PR #929 `locale` 활성 자체, `webchat-i18n-scope.md` defer
결정)은 모두 `origin/main`에 이미 머지·완결된 상태다.

**후속 항목 누락 없음**: `plan/in-progress/**` 42개 중 이 diff 가 무효화하거나 새 후속 항목을 만들어야 하는
다른 plan은 없다 — `_product-overview.md`/`2-sdk.md` 경로를 참조하는 in-progress plan 은
`webchat-i18n-followups-cleanup.md` 자신뿐이다. payload 에 포함된 5개 무관 plan
(`ai-agent-tool-connection-rewrite`·`cafe24-backlog-residual`·`chat-channel-discord-gateway`·
`chat-channel-slack-socket-mode`·`chat-channel-visual-ssr-png`)도 web-chat locale/chrome i18n 과 교차 항목이 없다.

동 plan 자체는 아직 `in-progress`(TEST WORKFLOW 재수행 중·`/consistency-check --impl-done` 항목 미체크) 상태이나
이는 이번 세션이 그 마지막 단계를 수행 중인 정상 진행이며, target-plan 간 불일치가 아니다.

## 요약
현재 diff(spec 3파일 + 코드 8파일)는 `plan/in-progress/webchat-i18n-followups-cleanup.md`의 8개 defer 처리
항목을 그대로 구현한 것으로, target spec 변경은 그 plan 이 선언한 `spec_impact` 3파일과 정확히 일치하고 내용도
1:1 대응한다. 이 활성화가 우회하는 미해결 "결정 필요" 항목이나, 해소되지 않은 선행 plan 전제, 무효화·누락된
후속 plan 항목은 발견되지 않았다.

## 위험도
NONE
