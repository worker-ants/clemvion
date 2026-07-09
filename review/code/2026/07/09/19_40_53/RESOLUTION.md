# RESOLUTION — 2026/07/09 19_40_53 code review (round 4, fresh)

Critical 0, WARNING 2 — 둘 다 본 PR 유발 실질 이슈. concurrency 가 feature 전체 코드를 git diff 로 깊게
재검토해 발견(이전 라운드는 다회-리뷰 changeset 제외로 일부 코드 diff 를 놓침). 전량 반영.

## WARNING — 반영
- #1 concurrency (`start()` catch gen 검사 누락): `catch` 최상단에 `if (startGenRef.current !== gen) return;`
  추가(try 의 두 검사와 대칭). 회귀 테스트: booting 종료 후 옛 webhook reject 지연 → phase/error 무변.
- #2 documentation (`"gone"` reason spec-code 불일치): sendCommand 410 catch 에
  `sendEvent("conversationEnded", {reason:"gone"})` 추가 → 모든 종료 경로(SSE terminal·user_ended·gone)가
  host 통지 일관. 2-sdk.md 의 "gone" 서술이 실제와 일치하게 됨. 회귀 테스트: submit_message 410 → phase ended.

## INFO — 반영
- #3 documentation(§3 다이어그램 대화종료 edge 비대칭): bullet 에 대칭 edge(streaming/awaiting→ended) 명시.
- #4 requirement(entity 주석 긴장): round3 에서 교차참조 추가로 이미 해소.

## INFO — defer (backlog/저위험)
- #1·#2 api_contract(키 생략·node-null fail-safe): spec 명문화됨, 저우선.
- #5 concurrency(sendCommand stale 실패 executionId 가드): backlog(이번 PR 은 start() catch 만 대칭화, 명령
  경로는 endConversation 선차단으로 주 시나리오 완화). #6(confirm 더블클릭): endConversation 동기 ENDED 로 저위험.
- #7 maintainability(§3.1 셀 밀도): 저우선. #8 user_guide_sync(위젯 i18n): pre-existing, 범위 밖.
- #9 requirement(payload changeset 프로세스): 코드 결함 아님. #10 orphan GC·#11 payload 크기: spec 명문/backlog.

## 검증
- web-chat 279 passed(신규: catch-gen reject, 410→ended). build/lint clean.
- 반영분 커버 위해 최종 수렴 fresh review(round 5).
