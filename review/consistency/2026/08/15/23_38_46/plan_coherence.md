# Plan 정합성 검토 — spec-draft-ws-types-canonical-location.md

## 검토 방법

- target 전문 + frontmatter 정독
- 유일한 `pending_plans:` 대상인 `plan/in-progress/ws-event-types-extract.md` 전문 대조 (7곳 변경안 ①~⑦ ↔ 그 문서 "후속" 섹션 1:1 매핑 확인)
- 전제 사실 검증: `#1175`(`websocket-events.types.ts` 신설) 이 실제로 `origin/main` 에 머지됐는지 `git merge-base --is-ancestor` 로 실측
- target 이 인용하는 7+1개 spec 위치의 현재 본문을 직접 열어 diff 전제("현재:")가 여전히 유효한지 대조
- 직전 세션(`23_28_47`)의 plan_coherence 지적(W2: `pending_plans:` 부재 + 체크리스트 역참조 부재)이 현재 draft 에서 실제로 반영됐는지 확인
- 다른 in-progress plan(특히 `spec-sync-external-interaction-api-gaps.md`, `spec-sync-websocket-protocol-gaps.md`, `spec-draft-eia-r8-alignment.md`)에 target 의 결정과 충돌하는 미해결 항목이 있는지 스캔

## 발견사항

- **[INFO]** "선행 plan 닫기" 체크리스트 항목이 대응 체크박스를 열거하지 않음
  - target 위치: `plan/in-progress/spec-draft-ws-types-canonical-location.md` §체크리스트 — "**선행 plan 닫기** — `ws-event-types-extract.md` §"후속" 의 대응 항목 체크"
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` §"후속 (이 PR 범위 밖)" — 하위 두 섹션 "### planner 턴"(7개 체크박스, target ①~⑦ 과 1:1 대응 확인됨) 과 "### 그 밖"(6개 체크박스 중 2개가 target 범위: `3-execution.md` frontmatter `code:` 등재 — target ①의 "동반" 문구로 커버, `4-execution-engine.md` §4.4 Rationale 후속 한 줄 — target ⑧으로 커버)
  - 상세: target 의 ①~⑧ 변경이 실제로는 **두 하위 섹션에 흩어진 9개 체크박스**에 대응하는데(①~⑦=`planner 턴` 7개, ①의 frontmatter 동반+⑧=`그 밖`의 2개), target 체크리스트는 "대응 항목 체크" 라고만 적어 정확히 어느 체크박스들인지 명시하지 않는다. 실행자가 "정본 위치" 스캔(7개)만 보고 `그 밖` 섹션의 2건(특히 §4.4 Rationale 항목, `20_05_19` rationale INFO4 인용)을 놓칠 위험이 있다 — 두 섹션의 존재 자체가 직관적으로 드러나지 않는다.
  - 제안: target 체크리스트 항목을 "『후속』의 `planner 턴` 7건 + `그 밖`의 frontmatter `code:`/§4.4 Rationale 2건 = 총 9개 체크박스" 처럼 두 서브섹션을 명시적으로 나열. (target 본문 자체는 이미 두 항목을 정확히 다루고 있어 실질 누락은 아니고, 체크리스트 표현의 정밀도 문제)

- **[INFO]** 선행 plan `ws-event-types-extract.md` 자신의 최상위 체크리스트가 실제 상태보다 stale
  - target 위치: (target 자체 결함 아님 — 선행 조건 검증 과정에서 발견)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` 체크리스트 "push 게이트 통과 → PR" (미체크)
  - 상세: target 의 Overview 전제("#1175 가 이미 옮겼다")는 사실이며 실측으로 확인됨 — `#1175`(commit `c6dd5cb89`)는 이미 `origin/main` 의 ancestor 이고, `websocket-events.types.ts` 가 워크트리에 실재한다. 즉 target 이 가정하는 선행 조건은 **이미 해소돼 있다.** 다만 `ws-event-types-extract.md` 문서 자신의 체크리스트는 "push 게이트 통과 → PR" 을 여전히 미체크로 두고 있어, 문서만 보면 아직 머지 전인 것처럼 읽힌다. target 의 작업(spec 문구 정정)에는 영향이 없다 — 코드는 이미 존재하므로 target 이 참조하는 새 파일명은 유효하다.
  - 제안: target 범위는 아님(그 plan 은 `owner: developer` 소유). `ws-event-types-extract.md` 를 다음에 여는 세션이 체크리스트를 실제 상태(머지 완료)로 갱신하고 `plan/complete/` 이동을 검토하면 됨 — 이는 그 plan 자신의 체크리스트에 이미 "`plan/complete/` 이동 시 `spec_impact` 갱신" 항목으로 추적 중이라 새로 만들 필요는 없음.

## 정합성 확인 (문제 없음, 참고용)

- 직전 세션(`23_28_47`)이 지적한 Critical(frontmatter `started`/`owner` 누락)·Warning급(`worktree:` 전체경로, plan_coherence W2: `pending_plans:` 부재)이 현재 draft 에 **모두 반영**돼 있음을 확인 — `started: 2026-08-15`, `owner: project-planner`, `worktree: eia-r8-cache-scope-4ae434`(bare name), `pending_plans: [plan/in-progress/ws-event-types-extract.md]` 전부 존재.
- target 의 ①~⑦ 변경 대상 7개 spec 위치(`3-execution.md:657`, `10-graph-rag.md:552`, `6-websocket-protocol.md:740`, `6-websocket-protocol.md:1034`, `8-embedding-pipeline.md:276`, `data-flow/6-knowledge-base.md:288`, `data-flow/0-overview.md:110`)의 현재 본문을 직접 열어 대조한 결과, target 의 "현재:" 인용문과 **1글자도 다르지 않게 일치** — diff 전제가 stale 하지 않음.
- ⑧ 의 삽입 지점(`4-execution-engine.md` §4.4 "순환 의존 처리" 항목 마지막 문단, "…현재는 두 기법으로 봉인한 상태를 유지한다." 직후) 도 실제 라인(478)과 일치.
- `6-websocket-protocol.md` frontmatter `code:` 에는 이미 `websocket-events.types.ts` 가 등재돼 있고(`ws-event-types-extract.md` 가 먼저 처리), `3-execution.md` frontmatter `code:` 에는 **아직 없음** — target ①이 주장하는 "자매 spec 비대칭" 이 실측으로도 확인됨. 즉 target 의 근거가 정확.
- 다른 in-progress plan(`spec-sync-websocket-protocol-gaps.md`, `spec-draft-eia-r8-alignment.md`, `spec-sync-external-interaction-api-gaps.md`) 을 스캔했으나 target 의 7+1개 변경과 충돌하는 "결정 필요" 항목이나 겹치는 spec 라인 소유권 주장은 없음. `spec-sync-external-interaction-api-gaps.md` 의 `websocket.service` 순환 항목은 이미 `[x]` 로 닫혀 있고 `ws-event-types-extract.md` 를 정확히 참조 — target 과 모순 없음.
- target 의 "범위 밖" 선언(`NotificationEventType` 개명, `6-websocket-protocol.md` 의 `### 4.3`/`4.4` 절 번호 중복, `codebase/**`) 은 각각 `ws-event-types-extract.md` 의 "그 밖" 섹션에 이미 별도 체크박스로 등재돼 있거나(NotificationEventType) 기존 상태로 명시적으로 인지돼 있어(절 번호 중복) 새로운 누락이 아님.

## 요약

target(`spec-draft-ws-types-canonical-location.md`)은 유일한 선행 plan(`ws-event-types-extract.md`)과의 관계를 frontmatter `pending_plans:` 로 명시하고, 그 plan 의 "후속" 섹션이 남긴 항목들(①~⑦ 스캔 7건 + `그 밖`의 §4.4 Rationale·frontmatter `code:` 2건)을 정확히 1:1 로 커버한다. 전제 사실(#1175 머지 완료)과 인용 위치(7+1곳) 모두 실측으로 확인했으며 stale 하지 않다. 다른 in-progress plan 과의 결정 충돌이나 미해소 선행조건은 발견되지 않았다. 유일한 흠은 체크리스트 표현의 정밀도(대응 체크박스 미열거)와, target 과 무관한 선행 plan 자체의 체크리스트 staleness 로 둘 다 INFO 수준이다.

## 위험도

LOW
