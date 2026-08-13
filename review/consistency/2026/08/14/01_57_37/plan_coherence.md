# Plan 정합성 검토 — spec/5-system/ (--impl-done)

## 검토 방법 메모

- `git diff origin/main...HEAD --stat -- spec/` 결과 **0건** — 이번 PR 은 `spec/` 을 전혀 건드리지
  않는다(코드 전용, `plan/in-progress/update-returning-tuple-shape.md` 가 스스로 명시). 따라서
  target(spec/5-system/) 자체의 "변경"은 없고, 본 검토는 **target 의 현재 상태**가 이번 PR 이
  드러낸 사실(및 관련 plan 들의 소급 정정) 과 정합한지를 본다.
- 워크트리 경로 `eia-r8-cache-scope-4ae434` 는 실제 브랜치(`claude/backend-eslint-warnings-cleanup-*`
  계열 스택, 최상단 커밋 `8332d9a20` "UPDATE 는 [rows,count] 튜플을 돌려준다")와 무관한 재사용
  worktree 이름이다 — `plan/in-progress/update-returning-tuple-shape.md` §후속에 이미 이 harness
  결함이 기록돼 있다. 이름에서 "EIA r8 캐시 스코프" 를 추론하지 않았다.

## 발견사항

- **[WARNING]** admission gate·CAS 락·종결 이벤트 가드의 소급 caveat 이 target 에 아직 반영되지 않음
  - target 위치:
    - `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장" 콜아웃(`...조건부 UPDATE affected=0
      으로 무효화되고 종결 이벤트 발행도 함께 skip된다...`, node-cancellation §2.4 링크 문단)
      및 §8 "동시성 cap admission gate"(`구현 상태` 배너 + TOCTOU 원자성 문단)
    - `spec/5-system/8-embedding-pipeline.md` §7.3.2 KB 전체 재임베딩 (`결과가 0행이면 409
      KB_REEMBED_IN_PROGRESS`)
    - `spec/5-system/10-graph-rag.md` §7 에러 처리 표 (`re-extract 동시 호출 | ... atomic
      compare-and-swap 으로 차단, 409 KB_REEXTRACT_IN_PROGRESS`)
  - 관련 plan:
    - `plan/in-progress/update-returning-tuple-shape.md` (완료된 코드 수정) — 이 PR 이 고친
      결함(TypeORM `UPDATE`/`DELETE … RETURNING` 이 `[rows, rowCount]` 튜플인데 8곳이 행 배열로
      다룸)의 실측 결과, 위 세 target 섹션이 서술하는 보장은 도입 시점(`1657c0435`,
      2026-06-14)부터 수정 시점(`8332d9a20`, 2026-08-13)까지 **실제로 한 번도 발동하지
      않았다** — admission cap 초과는 항상 defer 취급을 피해 갔고(우연히 stalled-job rehydration
      경로로 결과만 맞았음), KB 재임베딩/재추출 CAS 락은 동시 요청을 한 번도 409 로 거절하지
      못했으며, terminal 전이의 "affected=0 이면 종결 이벤트 skip" 분기도 한 번도 타지 않았다.
    - `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임
      (2026-08-14 #12)" — 위 소급 caveat 5건(위 3곳 + `spec/data-flow/2-auth.md` OAuth state
      소비 + `spec/conventions/node-cancellation.md` §2.4)을 **이미 집결 등재**했고
      (`owner: project-planner`), "부수: frontmatter `pending_plans:` 에
      `update-returning-tuple-shape.md` 등재. 대상은 위 표의 5개 문서 전부" 라고 명시한다.
  - 상세: target 세 섹션은 여전히 "동시 호출은 항상 거절/스킵된다" 는 무조건적 보장으로만
    읽힌다 — 실측 이력(2개월간 비발동)에 대한 어떤 각주도 없다. 이 caveat 작업은 이미 별도
    plan(`spec-update-node-cancellation-shutdown-classification.md` #12)에 정확히
    위임·등재돼 있어 "누락된 추적"은 아니지만, **target 문서 자체에서는 이 pending 작업이
    보이지 않는다** — 세 파일 모두 frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md`
    도 `spec-update-node-cancellation-shutdown-classification.md` 도 등재돼 있지 않다
    (`spec/5-system/4-execution-engine.md` 의 현재 `pending_plans:` 는
    `execution-engine-residual-gaps.md`/`retry-turn-terminal-guard.md`/`exec-intake-followups.md`
    3건뿐이고, `spec/5-system/8-embedding-pipeline.md`·`spec/5-system/10-graph-rag.md` 는
    `pending_plans:` 필드 자체가 없다). `spec-pending-plan-existence.test.ts` 는 편도 가드(등재된
    경로의 존재만 검증)라 이 누락을 잡아내지 못한다는 점도 `#12` 항목이 스스로 지적한 그대로다.
  - 제안: 이 PR(코드 전용) 을 막을 사유는 아니다 — 코드 수정은 정확하고 회귀 가드도 갖췄다.
    다만 project-planner 가 `#12` 를 이행할 때 위 세 target 파일의 frontmatter
    `pending_plans:` 에 `update-returning-tuple-shape.md` 를 등재하고, §1.1/§8/§7.3.2/§7 표에
    "`8332d9a20`(2026-08-13) 이전엔 이 가드가 실효되지 않았다" caveat 을 넣을 것을 재확인.
    이미 계획돼 있으므로 **새 항목 신설은 불필요** — 본 발견은 `#12` 가 실제로 집행될 때까지
    target 이 계속 이 상태(무조건적 보장 서술)로 남는다는 사실을 이번 라운드에도 다시 확인한
    것이다.

- **[INFO]** `spec/5-system/4-execution-engine.md` 의 `pending_plans:` 비대칭
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:`
  - 관련 plan: `plan/in-progress/ie-resume-turn-boundary-cancel.md`(frontmatter
    `spec_impact: [spec/5-system/4-execution-engine.md]`) ·
    `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    (`spec_impact` 동일 포함, 아직 미해소 "결정이 필요하다 (택일)" 항목 보유)
  - 상세: 두 plan 모두 `spec_impact` 로 이 target 을 명시하지만 target 의
    `pending_plans:` 에는 없다(현재 3건만 등재). `spec-pending-plan-existence.test.ts` 가
    편도 가드라 구조적으로 강제되지 않는, 이 저장소 전반의 기존 패턴(이번 PR 이 새로
    만든 drift 아님)이다. `spec-update-node-cancellation-shutdown-classification.md` 최상단의
    "SIGTERM/timeout 발 abort 를 cancelled 로 재정의할지" 결정은 **여전히 미해결**이지만,
    현재 target 은 그 결정 어느 쪽과도 충돌하는 서술을 하고 있지 않다(§Overview 가 명시하듯
    지금은 두 경로가 만나지 않아 실제 충돌 없음) — 그래서 CRITICAL 이 아니라 INFO.
  - 제안: project-planner 스윕 시 참고 — 급하지 않음.

## 요약

이번 PR 은 `spec/5-system/` 을 전혀 변경하지 않는 코드 전용 버그 수정(TypeORM `UPDATE`/`DELETE
… RETURNING` 튜플 shape 오인 8곳 교정 + OAuth `remember_me` 컬럼명 결함)이라, target 문서가
plan 의 미해결 결정을 새로 우회하는 사례는 없다. 다만 이 PR 이 실측으로 드러낸 사실 — 세
target 섹션(admission gate·§8, 종결 이벤트 skip·§1.1, KB CAS 락 409·8-embedding-pipeline §7.3.2
및 10-graph-rag §7)이 서술하는 보장이 2026-06-14~2026-08-13 사이 실제로는 한 번도 발동하지
않았다는 것 — 는 아직 target 에 반영되지 않았다. 이 후속 반영은 이미
`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #12 로 정확히
위임·집결돼 있어 "추적 누락"은 아니지만, project-planner 가 실제로 이행하기 전까지는 target
의 해당 절이 역사적으로 부정확한 무조건적 보장을 계속 서술한다. 이 PR 자체를 막을 사유는
아니며, 다음 project-planner 스윕에서 #12 를 실행하면 해소된다.

## 위험도

LOW
