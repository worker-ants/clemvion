# Plan 정합성 검토 — spec/4-nodes/6-presentation (--impl-done)

## 사전 확인 (실측)

`git diff origin/main HEAD --stat` 결과 `spec/`·`codebase/` 변경은 **0건**이다 — 이번 HEAD 는
`origin/main` 대비 `review/**` 산출물만 추가된 상태(이전 세션의 `/consistency-check` 아티팩트 커밋).
즉 target 문서 전문은 **이미 origin/main 에 병합된 상태 그대로**이며, 이번 라운드에서 새로 결정된
사항은 없다. 아래 발견사항은 target 이 반영하는 두 건의 "영역 선재 drift" 수정 작업이 실제로
완료·병합됐는지, 그리고 그 수정이 다른 plan 과 여전히 정합한지를 검증한 결과다.

## 발견사항

- **[INFO]** 완료된 두 개 선재-drift plan 이 `plan/in-progress/` 에 잔존 (이관 누락)
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §4(`previousOutput` 각주, :180-191) · §4.6(:195-216)
  - 관련 plan: `plan/in-progress/presentation-previousoutput-spec-drift.md`, `plan/in-progress/presentation-thread-optout-drift.md`
  - 상세: 두 plan 모두 체크리스트 전항목 `[x]` 완료 상태이고, 각 plan 이 명시한 개정 문구가 target
    본문에 **정확히 반영**되어 있다(`previousOutput` "위 목록과 성격이 다르다" 각주 + "적용 범위 —
    Form 은 해당 없음" 배제 문구, §4.6 "동작/표면 2층위" 표 + `Advanced > Conversation` 라벨 삭제
    모두 확인). 대응 커밋도 이미 `origin/main`/HEAD 에 존재한다 — `3d0bcd69b`(PR #997,
    `previousOutput` 정정) · `c3998e6cd`(PR #1004, §4.6 opt-out 정정). 즉 **작업은 완결**됐으나
    두 plan 파일이 `plan/complete/` 로 옮겨지지 않고 `plan/in-progress/` 에 남아 있다
    (`.claude/docs/plan-lifecycle.md` 상 완료 plan 은 이관 대상). 두 plan 은 서로 "선행: PR #997"으로
    체인돼 있어(`presentation-thread-optout-drift.md:14`) 순서상 문제는 없지만, in-progress 에
    남아 있으면 다음 checker 가 "아직 미해소 결정"으로 재오판할 여지가 있다(실제로 이번 라운드가
    그 재확인에 소모됨).
  - 제안: `presentation-previousoutput-spec-drift.md` · `presentation-thread-optout-drift.md` 를
    `plan/complete/`(archive 규칙 — `plan-lifecycle.md`)로 이관. spec 쪽 재수정은 불필요(이미 정합).

- **[INFO]** `processAiResumeTurn` dispatch 의 `resumed` 상태 emission 미결정이 target §10.9 와 같은 코드 경로를 공유
  - target 위치: `0-common.md` §10.9 "processAiResumeTurn dispatch 4 케이스 명시 매칭" 표(:461-477),
    특히 `'form_submitted'` 행 — `handleAiMessageTurn(...)` 호출로 기술
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md:217` — "`status: 'resumed'`
    transient snapshot … 잔여 선택지: AI 메시지 경로에도 form/buttons 처럼 structured
    `setStructuredOutput(resumed)` 1회 emit 을 추가할지 … **미결정**"
  - 상세: target §10.9 는 `'ai_message'`/`'form_submitted'` 두 dispatch 케이스가 모두
    `handleAiMessageTurn` 으로 forward 된다고 명시한다. 이 함수는 (`node-output-redesign/ai-agent.md`
    :176 실측) 현재 AI 메시지 경로에서 structured `resumed` 스냅샷을 emit 하지 않는다 — target 은
    이 사실과 **충돌하지 않고 정확히 반영**하고 있다(dispatch 라우팅만 서술, emission 여부는 주장하지
    않음). 다만 ai-agent.md 의 미결정 항목이 향후 "통일 적용"으로 해소되면, 그 구현 지점이 정확히
    target §10.9 가 지금 문서화한 `'form_submitted'`/`'ai_message'` dispatch 두 케이스 내부다 — 즉
    이 plan 항목이 해소될 때 target §10.9 dispatch 표에도 emission 여부 갱신이 필요할 수 있다.
    지금 당장의 모순은 아니며 target 이 일방적 결정을 내린 것도 아니다.
  - 제안: 차단 아님. `ai-agent.md:217` 미결정 항목이 해소되는 시점에 `0-common.md §10.9` dispatch
    표에 emission 여부 cross-ref 를 추가하도록 두 plan 어느 한쪽(권장: `ai-agent.md`)에 후속 메모만
    남겨두면 충분.

## 요약

이번 라운드는 실질적으로 신규 diff 가 없는(HEAD == origin/main for `spec/`·`codebase/`) 재확인
성격의 검토였다. Target 이 반영하는 두 건의 영역 선재 drift(`previousOutput` 폐기 오기재,
`excludeFromConversationThread` §4.6 과대 서술)는 각각 독립 plan(`presentation-previousoutput-spec-drift.md`,
`presentation-thread-optout-drift.md`)으로 이미 완결되어 PR #997·#1004 로 origin/main 에 병합돼
있고, target 본문도 그 개정 문구를 정확히 담고 있어 **미해결 결정과의 충돌·선행 plan 미해소는
없다**. 유일한 잔여는 두 plan 파일이 완료 상태인데도 `plan/complete/` 로 이관되지 않은 lifecycle
housekeeping 갭(INFO)과, `node-output-redesign/ai-agent.md` 의 별도 미결정 항목("AI 메시지 경로
resumed 통일 여부")이 target §10.9 가 새로 문서화한 dispatch 경로와 향후 접점을 가질 수 있다는
forward-dependency 메모(INFO) 뿐이다. 둘 다 차단 사유가 아니다.

## 위험도
LOW
