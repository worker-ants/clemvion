# Plan 정합성 검토 — `update-returning-tuple-shape.md` (2026-08-13, impl-done, scope `spec/5-system/`)

## 발견사항

- **[WARNING]** `update-returning-tuple-shape.md` 본문이 자신의 frontmatter 를 반박한다
  (`spec_impact: none` stale 서술)
  - target 위치: `spec/5-system/` (이 plan 의 `spec_impact` 델타 대상 문서 전체) — 정확히는
    plan 자체의 frontmatter vs 본문 불일치
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` frontmatter(8~13행,
    `spec_impact:` 5개 파일 리스트) vs 본문 228~230행("developer 는 `spec/` 쓰기 권한이
    없어... 그래서 frontmatter 는 `spec_impact: none` 을 유지한다")
  - 상세: 이 plan 의 최상단 배너(16~19행)는 "`23_27_49` WARNING 3" 지적을 받아 frontmatter 를
    `none` → 5개 파일 리스트로 **이미 정정**했다고 명시하고(자매 plan
    `retry-turn-terminal-guard.md` 가 세운 선례와 동일 논리 — Gate C 가 `none` 을 그대로
    신뢰해 "spec 영향 없음" 이 잘못 확정되는 것을 막기 위함), 실제 frontmatter 도 그렇게 돼
    있다. 그런데 "## 후속" 절의 "[planner 위임] 소급 각주" 항목(214~230행)은 여전히 정정 이전
    논리("이 PR 이 실제로 바꾸는 spec 은 0건이라 `none` 을 유지한다")를 그대로 담고 있다 —
    같은 문서 안에서 두 서술이 정면으로 모순된다. 최신 커밋(`d8ac4cb07 chore(plan):
    spec_impact 를 리스트로 — 이 필드는 PR 이 아니라 plan 을 가리킨다`)이 상단 배너·frontmatter
    만 고치고 본문 이 문단은 놓친 것으로 보인다. Gate C 는 frontmatter 값만 읽으므로 기계적
    차단은 발생하지 않지만, 이 문서를 읽는 사람(project-planner 포함)이 228~230행을 먼저
    만나면 "spec 위임이 없다" 고 오독해 pending delegation(5개 파일 각주 추가)을 건너뛸 위험이
    있다.
  - 제안: plan 228~230행을 상단 배너·frontmatter 와 같은 결론으로 정정
    ("frontmatter 는 5개 파일 리스트를 유지한다 — 이 필드는 PR 이 아니라 plan 라이프사이클을
    가리킨다") 하거나, 문단 자체를 삭제하고 상단 배너를 단일 진실로 남길 것.

- **[WARNING]** spec 위임 각주 초안이 결함의 blast radius 를 행(row) 단위로 뭉뚱그려, 실제로는
  영향받지 않는 메커니즘까지 "mock 경계 안쪽만 검증됨" 으로 캐버릿 처리할 위험
  - target 위치: `spec/conventions/node-cancellation.md` §2.4 구현 현황 표 195~198행(§2.4
    노드 경계 가드 / AI turn 경계 가드 / park↔resume 짝 전이 / retry 재진입 — 4행)
  - 관련 plan: `update-returning-tuple-shape.md` "## 후속" [planner 위임] 소급 각주 5번째
    항목(221~225행) 및 이를 그대로 인용한 `retry-turn-terminal-guard.md` 소급 정정 배너(동일
    plan 최상단, "196·197행도 같은 반환값에 의존한다") — 둘 다 project-planner 가 아직
    집행하지 않은 **미해소 delegation**이다.
  - 상세: 두 plan 모두 "196·197행(AI turn 경계 가드·park↔resume 짝 전이)도 같은 반환값에
    의존한다"고 위임했지만, 코드를 직접 추적하면 두 행은 서로 다른 정도로만 관련된다.
    - **196행(AI turn 경계 가드)**: 관측은 `assertExecutionNotCancelled`
      (`execution-engine.service.ts:8166`, `this.executionRepository.findOne(...)` — 일반
      TypeORM ORM 조회, raw `UPDATE...RETURNING` 과 무관)이고, 취소 확정도
      `assertLinkedTransitionApplied` → `updateExecutionStatus` 의 **`linkedNodeExec` 분기**
      (`:8433-8485`)를 타는데, 이 분기의 `persisted` 는 `lockNonTerminalExecutionRow`
      (`:8204`, `SELECT id FROM execution ... FOR UPDATE`)의 결과로 결정된다. 이 plan 자신이
      실측한 표(`update-returning-tuple-shape.md` "실측 — TypeORM 은 UPDATE/DELETE 에만
      튜플을 돌려준다")에 따르면 **SELECT 는 애초에 튜플로 감싸이지 않는다** — 즉 이 경로는
      버그의 영향권 밖으로 보인다.
    - **197행(park↔resume 짝 전이)**: node-cancellation.md 자신의 197행 "구현" 열이 짝
      전이·`finalizeFailedExecution`·`failFirstSegmentSetup`·`executeSync` timeout 을 **한
      행에 묶어** "SELECT … FOR UPDATE 로 비-terminal 확인 후에만 쓰기"라고 서술하는데, 실제로는
      `finalizeFailedExecution`/`failFirstSegmentSetup`/`executeSync` timeout catch 는
      (`ie-resume-turn-boundary-cancel.md` 7차 라운드 기록대로) `updateExecutionStatus` 의
      **else 분기**(이번 PR 이 고친 `updated.length > 0` 버그 분기)를 경유하도록 리팩터됐다 —
      이 셋은 실제로 영향권 **안**이지만, 행 라벨이 가리키는 "짝 전이"(`linkedNodeExec`) 자체는
      위 196행과 같은 이유로 영향권 **밖**이다.
    - 이 PR 이 새로 추가한 회귀 테스트(`execution-engine.service.spec.ts` diff, "실측 shape:
      1행 튜플…"/"0행 튜플…" 케이스)도 전부 `updateExecutionStatus(execution, newStatus)`
      **2-인자 호출**(linkedNodeExec 미전달, else 분기)만 겨냥하고 있어, 이 PR 자신의 증거도
      "else 분기가 문제였다"는 진단과 일치하고 "짝 전이 분기 자체가 문제였다"는 진단과는
      일치하지 않는다.
  - 제안: project-planner 가 이 delegation 을 집행하기 **전에**, 캐비앗을 행 라벨
    ("196·197행")이 아니라 실제 소비 경로(`updateExecutionStatus` else 분기를 경유하는
    소비처 — `finalizeFailedExecution`/`failFirstSegmentSetup`/`executeSync` timeout/retry
    재진입) 단위로 다시 서술할 것. 그러지 않으면 애초에 건전했던 `assertExecutionNotCancelled`
    관측과 `linkedNodeExec` FOR UPDATE 잠금 메커니즘의 신뢰도를 근거 없이 낮추는 **새
    SPEC-DRIFT**를 도입하게 된다(이 PR 이 고치려는 "그 자리만 고친다" 패턴의 반대 방향
    재발 — 이번엔 실제보다 넓게 캐버릿 처리).

## 요약

이번 diff(`update-returning-tuple-shape.md`, `retry-turn-terminal-guard.md` 갱신 포함)는
UPDATE/DELETE RETURNING 튜플 셰이프 결함을 코드·plan 양쪽에서 매우 꼼꼼히 추적하고 있고,
project-planner 위임이 필요한 5개 spec 파일도 두 plan 모두에서 명시적으로 "완료 이동 금지"
게이트로 걸어 뒀다 — 구조 자체는 건전하다. 다만 (1) `update-returning-tuple-shape.md` 본문에
정정 이전 논리("frontmatter 는 `none` 유지")가 배너·frontmatter 정정 이후에도 그대로 남아
플랜 내부 자기모순이 있고, (2) 아직 집행되지 않은 spec 위임 각주가 결함의 실제 소비 경로가
아니라 spec 표의 행 라벨 단위로 뭉뚱그려져 있어, project-planner 가 그대로 반영하면 건전한
가드(AI turn 경계 관측·park↔resume 짝 전이 FOR UPDATE 잠금)의 신뢰도를 근거 없이 낮추는 역방향
SPEC-DRIFT 를 만들 위험이 있다. 둘 다 이 PR 을 막을 사유는 아니며(코드 자체는 정확하고
테스트도 실제 shape 을 반영한다), project-planner 턴에서 위임 반영 전 정정이 필요하다.

## 위험도

LOW
