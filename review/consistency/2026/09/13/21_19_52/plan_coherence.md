# Plan 정합성 검토 — plan_coherence

## 전제 확인

- target scope(`spec/conventions/**`) 델타: **0개 파일**. 이 브랜치(`error-code-emission-axis`)는
  spec/conventions 를 직접 편집하지 않는다 — `plan/in-progress/error-code-emission-axis.md`
  frontmatter 도 `spec_impact: none` 으로 정확히 선언돼 있다. 실제 diff 는 harness 가드
  (`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`), 유저가이드 문서
  (`codebase/frontend/src/content/docs/02-nodes/logic{,.en}.mdx`), plan/review 파일이다.
- 이 배치가 spec 레벨 택일(카탈로그 backfill vs 메시지-접두 표기 vs CONTAINER_* 스펙 서술
  정정)을 **직접 결정하지 않고 planner 트랙 항목으로만 등재**한 것은 확인했다 — CRITICAL
  없음(§체크리스트 "그 택일은 spec/ 이라 planner 몫이고 트래커에 등재했다").
- 따라서 검토는 이 배치가 **같은 커밋에서 함께 등재한 두 신규 planner 항목**
  (`plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 2건, 3446·3467행)이
  그 문서 자신의 frontmatter·다른 in-progress plan 과 정합한지에 집중했다.

## 발견사항

- **[WARNING]** 신규 planner 항목이 겨냥한 spec 파일 5개가 같은 문서의 `spec_impact`
  frontmatter 에서 빠졌다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3446-3458`
    (신규 항목 "spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다")
  - 관련 plan: 같은 파일 frontmatter `spec_impact:` 목록(8~52행)
  - 상세: 신규 항목이 지목하는 6파일 중 `spec/5-system/4-execution-engine.md`(24행 인접)만
    frontmatter 에 있고, 나머지 5개 — `spec/3-workflow-editor/2-edge.md`·
    `spec/3-workflow-editor/0-canvas.md`·`spec/4-nodes/1-logic/0-common.md`·
    `spec/4-nodes/1-logic/7-map.md`·`spec/4-nodes/1-logic/9-foreach.md` — 는
    `spec_impact` 어디에도 없다(전수 grep 확인, 파일 내 다른 언급도 0건). 인용 라인 실측도
    맞다(예: `2-edge.md:202` "검증 | emit 없음 → `CONTAINER_MISSING_EMIT`…", `0-canvas.md:636`
    "`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`", `7-map.md:179-180`·
    `9-foreach.md:209-210` 의 «코드» 열, `0-common.md:83`). 이 파일의 frontmatter 주석은
    **같은 실패를 이미 두 번 자백**하고 있다(13-14행 "빠지면 `--spec`/`--impl-done` 번들
    스코프에서 누락된다", 25-27·45-49행 "항목을 추가할 때 frontmatter 를 함께 보지 않는 것" —
    재발 원인으로 스스로 지목). 이번이 세 번째 재발이다.
  - 제안: `spec_impact` 목록에 위 5개 경로를 추가할 것. 방치하면 다음 `--spec`/`--impl-done`
    라운드가 이 5파일을 번들 스코프에서 조용히 떨어뜨려, 정정 작업이 진행돼도 검토가 못 본다
    (이 저장소가 이미 겪은 "consistency 기본 예산이 conventions 를 통째로 떨군다" 클래스의
    plan 판본).

- **[WARNING]** 신규 항목이 §1 카탈로그 구조를 겨냥하는 **네 번째** plan 인데 기존 "묶어서
  처리" 합의를 인용하지 않는다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3467-3487`
    (신규 항목 "`3-error-handling.md §1.4` 의 «앵커 없는 코드» 7종… 카탈로그 표기를 정할 것")
  - 관련 plan: 같은 파일 `:3217-3227` — "같은 절을 겨냥하는 plan 이 셋이다 — 한 턴에 묶어라"
    (`spec-update-node-cancellation-shutdown-classification.md:632` 의 `OAUTH_STATE_MISMATCH`
    §1.2 등재, `keyset-cursor-uuid-validation.md:128` 의 Background Runs 4종 §1 등재, 그리고
    같은 파일 3208행의 통합/LLM 코드 §1 등재)
  - 상세: 세 plan 모두 `3-error-handling.md §1` 하위구조(서브섹션 배치·행 추가)를 각자
    제안 중이고, 이미 "따로 처리하면 카탈로그 구조가 세 번 갈린다 — planner 턴에서 §1 하위
    구조를 한 번에 정해야 한다"고 명시돼 있다. 이번 배치가 §1.4(앵커-없는 코드 7종의 표기)에
    대해 또 다른 독립 택일(backfill vs 표기 구분)을 등재하면서 이 합의를 인용하지 않았다 —
    두 plan(`spec-update-node-cancellation…`, `keyset-cursor-uuid-validation.md`)은 여전히
    미해소(status 갱신 없음, 항목 미체크) 상태라 이 넷은 실제로 동시에 살아 있다. 같은 문서
    안에 있어 발견 가능성은 있지만, 이미 확립된 "묶어라" 관례를 어긴 채 별도로 등재됐다.
  - 제안: 신규 §1.4 항목에 3217행 합의를 상호 링크하거나, 3217행의 "셋" 목록을 "넷"으로
    갱신해 두 항목이 같은 planner 턴에서 처리되도록 명시할 것.

## 요약

이 배치(`error-code-emission-axis`)는 spec/conventions 를 직접 건드리지 않고, spec 레벨
택일이 필요한 항목은 모두 developer 권한 밖으로 올바르게 등재해 CRITICAL 성격의 결정 우회는
없다. 다만 그 등재 과정에서 대상 문서(`spec-draft-nullable-notation-followups.md`) 자신의
frontmatter `spec_impact` 동기화를 누락했고(같은 파일이 두 차례 자백한 재발 클래스),
`3-error-handling.md §1` 구조를 겨냥하는 신규 항목이 이미 확립된 "같은 절 plan 셋 — 한 턴에
묶어라" 합의를 갱신하지 않아 후속 조율 누락 위험이 있다. 둘 다 기계적으로 고치기 쉬운
WARNING 이며 target(spec/conventions) 자체의 정합성을 해치지는 않는다.

## 위험도

LOW
