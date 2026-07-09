# Code Review 통합 보고서 (round 4, fresh)

## 전체 위험도
**MEDIUM** — Critical 0. WARNING 2건(둘 다 본 PR 유발): start() catch 의 gen 검사 누락 race, `"gone"` reason spec-code
불일치. round-4 에서 concurrency 가 `git diff origin/main...HEAD -- codebase/` 로 feature 전체 코드를 처음
깊게 재검토해 발견(다회 리뷰의 changeset-제외 패턴으로 이전 라운드가 코드 diff 를 일부 놓쳤음).

## Critical
없음.

## 경고 (WARNING) 및 처리
| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| 1 | concurrency | `start()` 의 `catch`(:303-306)가 `startGenRef` 검사 누락 — try 의 두 gen 검사와 비대칭. 대체된 옛 in-flight start 의 지연 실패가 (a) startedRef 재개방(중복 execution), (b) 새 대화 phase 를 옛 에러로 ERROR 덮어쓰기 | **수정** — catch 최상단 `if (startGenRef.current !== gen) return;` + 회귀 테스트(booting→새대화→옛 webhook reject 지연→startedRef/phase 무변) |
| 2 | documentation | 2-sdk.md `conversationEnded.reason` 예시 `"gone"` 이 실제 host 로 전달 안 됨(sendCommand 410 catch 는 dispatch ENDED 만, sendEvent 미호출) | **수정** — sendCommand 410 catch 에 `sendEvent("conversationEnded", {reason:"gone"})` 추가(모든 종료 경로 host 통지 일관) + 테스트 |

## 참고 (INFO) — 처리
- #3 documentation(§3 다이어그램 대화종료 edge 비대칭): **수정**(bullet 에 종료 edge 문장 추가).
- #5 concurrency(sendCommand stale 실패 패턴): 후속 backlog(executionId 가드) — defer.
- #6 concurrency(confirm 더블클릭 async): 저위험, defer(참고).
- #1·#2 api_contract(키 생략·node-null fail-safe): spec 명문화됨, 저우선 defer.
- #4 requirement(entity 주석 긴장): round3 에서 이미 교차참조 추가 — 해소됨.
- #7 maintainability(§3.1 셀 밀도): 저우선 defer. #8 user_guide_sync(위젯 i18n): pre-existing, 범위 밖 backlog.
- #9 requirement(payload changeset 제외 프로세스 관찰): 코드 결함 아님. #10·#11(orphan GC·payload 크기): spec 명문/backlog.

## 결론
WARNING 2건(catch gen 검사·gone reason) 반영 — 둘 다 본 PR 유발 실질 이슈. 다이어그램 INFO 도 반영.
반영분 커버 위해 최종 수렴 리뷰 1회.
