# Plan 정합성 검토 — `spec-draft-ws-wontdo-maintenance-appping.md`

## 발견사항

- **[WARNING]** `system.maintenance`·app ping 을 won't-do 로 닫으면서 정작 그 상태를 들고 있는 tracker plan(`spec-sync-websocket-protocol-gaps.md`)의 체크리스트를 갱신 목록에서 빠뜨림
  - target 위치: `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` §변경안 "9개 자리 전수" 표 — 9곳 전부 `spec/5-system/6-websocket-protocol.md` 안의 자리이고, `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 는 목록에 없음 (frontmatter `spec_impact` 도 spec 파일 하나뿐)
  - 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md`
    - `:54` `- [ ] system.maintenance 시스템 이벤트 emit (§4.6)` — 여전히 열린 체크박스, 인라인 경고문이 "착수 전 결정: 유지보수 선언 주체(관리자 API? 환경변수? 배포 파이프라인?)를 정할 것" 이라고 서술
    - `:68` `- [ ] 서버발신 application-level ping (§5)` — 여전히 열린 체크박스, "착수 전 판정: won't-do 로 종결하는 것이 맞는지 먼저 물을 것" 서술
    - `:95` 비고 — *"잔여 3종(auth.token_expired·system.maintenance·server ping)만 실 backlog"* — target 반영 후엔 **1종**만 남는데도 3종으로 서술
  - 상세: target 이 spec 본문(`:872`, `:945`, `:1086`, `:1089`, `:1104`)을 `_(비채택 won't-do)_` 로 바꾸면, 같은 항목의 SoT 로 지목된 이 tracker plan 은 그대로 "결정 필요/실 backlog" 상태를 유지해 **spec 과 plan 이 서로 다른 말을 하게 된다.** 2026-07-08 앞선 4종 won't-do 종결 때는 정확히 이 tracker 안에 `## 비채택 (won't-do)` 섹션을 신설해 `[x]` 로 이관했다(`:85-91` 참조) — 지금 target 은 spec 쪽 9곳은 "전수 열거" 했다고 명시하면서 같은 패턴의 plan 쪽 반영은 목록에 없다. 이 tracker 는 spec frontmatter `pending_plans` 와 spec 본문 3곳(`:28`,`:1089`,`:1104`)이 가리키는 정본 포인터라 drift 가 그대로 다음 세션의 "같은 조사를 반복" 문제로 이어진다 — 이 문서 자신이 비고에 "이 줄이 셋을 '남은 구현 3건' 으로 읽히게 해 두어, 착수하려던 세션이 매번 같은 조사를 반복하게 된다" 고 이미 한 번 경고한 실패 패턴과 동형이다.
  - 제안: target 의 "9개 자리" 표에 10번째 항목으로 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 갱신을 추가한다 — (a) `:54`·`:68` 두 항목을 `## 미구현 항목 (잔여)` 에서 제거(또는 취소선)하고 `## 비채택 (won't-do)` 섹션에 `[x] [won't-do]` 로 이관 + 2026-09-02 날짜·근거 한 줄, (b) `:95` 비고의 "잔여 3종…만 실 backlog" 을 "잔여 1종(auth.token_expired)만 실 backlog" 로 정정. 두 파일이 같은 커밋(또는 같은 spec_impact 처리)에서 함께 바뀌어야 spec↔plan 정합이 유지된다.

## 요약

target 의 결정 내용(§4.6 `system.maintenance`·§5 서버발신 app ping 을 won't-do 로 종결, `auth.token_expired` 는 별도 planner 턴으로 범위 밖 유지)은 tracker plan(`spec-sync-websocket-protocol-gaps.md`)이 2026-08-31 자로 등재해 둔 "착수 전 결정 필요" 상태와 충돌하지 않는다 — 오히려 그 실측을 근거로 삼은 상위 결정이며, `auth.token_expired` 하나만 남기고 나머지 두 항목의 미해결 질문("누가 유지보수를 선언하는가" 등)을 답하는 대신 기능 자체를 접어 질문을 소거하는 방식이라 앞선 2026-07-08 4종 won't-do 종결과 같은 결의 처분이다. spec 쪽 9개 편집 자리 목록은 grep 전수(`:28,872,945,1086×2,1089,1104` + Rationale + frontmatter)와 정확히 일치해 누락이 없다. 다만 그 결정을 들고 있던 tracker plan 자체의 체크리스트·비고 문구를 갱신 대상에서 빠뜨려, 반영 후 spec 은 "비채택" 인데 plan 은 "결정 필요/실 backlog 3종" 이라고 계속 말하는 상태가 될 위험이 있다 — 2026-07-08 선례가 정확히 이 tracker 안에서 항목을 이관하는 방식으로 처리했던 것과 대비된다.

## 위험도

MEDIUM
