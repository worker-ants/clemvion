# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 조사 방법 메모

`target 문서` 절에 안내된 diff(`## 구현 변경 사항`)가 프롬프트 조립 과정에서 실제로는
누락되어 있었다(예산 초과로 생략된 파일 19개 목록에 `<git diff origin/main...HEAD --
code_areas>` 자체가 포함됨). 이 diff 없이는 "target 이 미해결 결정을 우회하는가" 를
판단할 수 없으므로, 위 워킹트리(`eia-r8-cache-scope-4ae434`, 절대경로)에서
`git diff origin/main...HEAD -- codebase/ spec/ plan/` 을 직접 실행해 실제 변경분을
확인했다.

**실측 결과**: 이번 diff 는 `spec/` 을 **0줄**도 건드리지 않는다(`git diff --stat
origin/main...HEAD -- spec/` 빈 출력). 코드 변경은 `assertRowArray` 가드 유틸 신설 +
`execution-engine.service.ts`(admission UPDATE·`lockNonTerminalExecutionRow`·
`updateExecutionStatus` 3곳) · `executions.service.ts`(`computeChainDepth` 1곳)의
raw-query 결과 shape 하드닝뿐이다. 즉 "target 문서: spec/5-system/" 는 이번 diff 로
바뀐 것이 아니라 **현재 상태**(직전 PR #1166 이 이미 `origin/main` 에 병합해 둔 EIA §6
종결 이벤트 계약 재작성 포함)를 가리킨다 — `origin/main` 이 곧 `9a4d3e32b`(#1166 머지
커밋)를 merge-base 로 갖는다.

## 발견사항

이번 diff·plan 갱신을 3관점으로 대조한 결과 **target(spec/5-system/) 과 충돌하는 신규
결정, 미해소 선행 plan, 누락된 후속 항목은 발견되지 않았다.**

- 코드 diff 는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 ".query() 반환
  shape 하드닝" 절에 그대로 반영돼 있다 — admission 가드(`[x]`), `updateExecutionStatus`
  가드(diff 로 확인), `computeChainDepth` 가드(diff 로 확인) 전부 plan 본문의 서술과
  코드가 1:1 대응한다. 이 diff 가 일부러 남긴 잔여(전역 raw-query 감사 · `updateExecutionStatus`
  else 분기 트랜잭션화 · `CONSUMING_QUERY` 정규식 사각지대)도 같은 절에 `- [ ]` 로 정확히
  등재돼 있어 "고쳤다고 썼지만 실은 부분적" 류의 괴리가 없다.
- `updateExecutionStatus` 가드의 코드 주석은 "가드가 없으면 EIA §6 종결 이벤트가 조용히
  유실된다" 고 EIA §6 계약을 인용하는데, 그 §6 계약은 바로 이 branch 의 merge-base(#1166)
  가 이미 확정한 최신 SoT(§6 도입부)와 일치한다 — 구버전 §6.3~§6.5 개별 열거를 인용하지
  않는다. 인용 대상이 stale 하지 않다.
- `plan/in-progress/spec-draft-eia-notification-payload-contract.md`(worktree 필드가
  이 브랜치 디렉터리명 `eia-r8-cache-scope-4ae434` 와 일치, #1166 의 원 draft)는 여전히
  `in-progress` 상태이지만 이는 정당하다 — `## 후속 (developer)` 의 미해결 항목
  (`durationMs`/`result.outputs` emit · `error` 객체 통일 등)이 `spec-sync-external-interaction-api-gaps.md`
  에 정확히 포인터로 등재돼 있고, `failRetryExecution` 의 `cancelledBy` 누락 항목은
  `retry-turn-terminal-guard.md` #2 로 교차 참조돼 있으며 그 파일의 #2 항목도 역으로
  "계약 SoT 는 EIA §6 도입부 — 2026-08-13 에 이관" 이라고 정확히 되짚는다. WS 트래커
  (`spec-sync-websocket-protocol-gaps.md`) 쪽도 "본 문서는 더 이상 SoT 가 아니다" 로
  올바르게 포인터화돼 있다. 양방향 참조가 모두 최신 상태와 일치한다.
- **[CRITICAL 결정 우회] 없음**: 이번 diff 가 새로 내린 판단(가드 실패 시 `throw`,
  `return false` 아님)은 이미 plan 에 "왜 defer 가 아니라 throw 인가" 로 근거가 남아 있고,
  plan 이 아직 열어 둔 어떤 "결정 필요" 항목과도 충돌하지 않는다(§0에서 검색한 "결정 필요"·
  "택일이 필요" 류 마커는 전부 이미 종결된 이력 서술이었다).

## 인접 관찰 (본 3관점 밖, 참고용)

- **[INFO] `backend-lint-gate-broken-on-main.md` 의 `worktree:` frontmatter 가 stale** —
  `worktree: lint-warning-triage`(2026-08-08, 최초 lint 게이트 복구 시점 값)로 고정돼 있는데,
  이후 이 파일이 흡수한 후속 작업들은 전부 다른 worktree(`backend-hygiene-followups` ·
  `eia-idempotency-fixes` · `eia-r8-cache-scope` · `eia-redis-failure-metric` ·
  `backlog-final-three` 등, 본문 서술로 확인)에서 이뤄졌다. `.claude/hooks/_lib/plan_guard.py`
  는 `worktree:` 값을 정규화해 **현재 worktree 디렉터리명 또는 브랜치명(`claude/` 접두
  제거)** 과 매칭하므로, 이 파일은 지금 어느 것과도 매칭되지 않아 "이 worktree 에 연결된
  plan" 집합에서 빠진다. 같은 저장소의 `retry-turn-terminal-guard.md` 가 정확히 이 실패
  클래스를 이미 겪고 명시적으로 필드를 갱신해 둔 선례가 있다("머지된 값을 두면 P1 코드
  push 시 가드가 '연결된 plan 없음(ad-hoc)'으로 오판해 무장 해제된다").
  이번 push는 `spec-draft-eia-notification-payload-contract.md`(worktree 필드가 정확히
  현재 디렉터리명과 일치)가 독립적으로 "연결된 plan" 조건을 만족시켜 가드가 정상 작동하므로
  **이번 push 는 막히지 않는다** — 다만 향후 누군가 이 plan 의 잔여 항목(전역 raw-query
  감사 등)만 별도 worktree에서 단독으로 처리하면 가드가 조용히 무장 해제될 수 있다.
  조치 시 `retry-turn-terminal-guard.md` 와 동형으로 `worktree:` 를 현재 값으로 갱신하고
  주석으로 이력을 남기는 편이 안전하다.

## 요약

이번 검토 대상 diff 는 spec 을 전혀 건드리지 않는 순수 코드 하드닝(raw-query 결과 shape
가드 3+1곳)이며, 같은 diff 안에서 `plan/in-progress/backend-lint-gate-broken-on-main.md`
가 완료·잔여 항목을 정확히 동기화했다. target(spec/5-system/, 특히 EIA §6 종결 이벤트
계약과 idempotency 캐시 스코프)은 merge-base 에 이미 반영된 #1166/#1156/#1163 등 여러
선행 PR 의 최종 상태를 반영하고 있고, 이를 추적하는 `spec-draft-eia-notification-payload-contract.md`
· `spec-sync-external-interaction-api-gaps.md` · `spec-sync-websocket-protocol-gaps.md`
· `retry-turn-terminal-guard.md` 4개 plan 사이의 상호 포인터도 전부 최신 상태로 정합했다.
미해결 결정을 우회하거나, target 이 가정한 선행 plan 이 미해소이거나, target 변경이
다른 plan 의 후속 항목을 무효화하는 사례는 찾지 못했다. 유일한 인접 관찰은 plan 가드
메커니즘의 stale frontmatter(정보성)이며 이번 push 를 막지 않는다.

## 위험도

NONE
