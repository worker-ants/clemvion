# Plan 정합성 검토 — impl-done (scope=`spec/5-system/`, diff-base=`origin/main`)

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- spec/` 결과 0건 — 이번 diff 는 `spec/5-system/` 을
전혀 건드리지 않는다. 실제 변경은 TypeORM `UPDATE`/`DELETE … RETURNING` 이 `[rows, rowCount]`
튜플로 오는데 7~8곳이 행 배열로 오취급하던 결함을 고치는 순수 백엔드 버그픽스
(`common/utils/update-returning-rows.ts` 신설 + `auth-oauth`/`execution-engine`/
`knowledge-base` 소비부 교체)이며, plan 은 `plan/in-progress/update-returning-tuple-shape.md`
(신규, P1)이다. 이 세션은 오늘(2026-08-13) 같은 diff 를 대상으로 이미 두 차례
(`22_45_25`, `23_07_12`) plan_coherence/cross_spec 검토가 돌았고, 그 WARNING 들에 대한
후속 조치가 이번 라운드 사이(=지금 이 diff)에 일부 반영됐다. 따라서 이번 검토는
"이전 WARNING 이 실제로 다 닫혔는가" 를 우선 확인하는 형태로 진행했다.

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 신규 배너가 "각주 갱신은 planner 위임 항목에
  등재돼 있다" 고 주장하지만 실제로는 등재돼 있지 않다 — 직전 라운드(`23_07_12` cross_spec
  WARNING (c))가 요구한 조치가 부분적으로만 이행됐다
  - target 위치: (spec/5-system/ 자체 diff 없음 — 파생 확인) `spec/conventions/
    node-cancellation.md:198` §2.4 status 표 "retry 재진입 종결 경로 terminal 가드 | ✓ |
    … mutation 13/13 검증"
  - 관련 plan:
    - `plan/in-progress/retry-turn-terminal-guard.md:42-43` (신규 소급 정정 배너) —
      "`spec/conventions/node-cancellation.md:198` §2.4 의 '✓ mutation 13/13 검증' 서술도
      이 mock 경계 안쪽만 반영한다 — **각주 갱신은 planner 위임 항목에 등재돼 있다.**"
    - `plan/in-progress/update-returning-tuple-shape.md:193-208` ("[planner 위임] 소급
      각주" 항목, 대상 spec 4개 열거: `4-execution-engine.md` §1.1 · `8-embedding-pipeline.md`
      §7.3 · `10-graph-rag.md` 동시 호출 표 · `data-flow/2-auth.md`)
    - `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
      (node-cancellation.md 관련 spec 갱신의 지정 hub — owner: project-planner)
  - 상세: `retry-turn-terminal-guard.md` 의 배너는 `plan/in-progress/23_07_12` 세션의
    cross_spec 체커가 낸 WARNING 의 제안 (a)(banner 추가)만 이행하고, 제안 (c)("planner
    턴에서 `node-cancellation.md:198` 각주를 기존 '[planner 위임]' 4곳 목록에 **다섯 번째로
    추가**")는 이행하지 않은 채, 마치 이행된 것처럼 "등재돼 있다" 라고 서술한다. 직접
    확인 결과 `grep -n "node-cancellation" plan/in-progress/update-returning-tuple-shape.md`
    는 **0건**이고, `spec-update-node-cancellation-shutdown-classification.md`(node-
    cancellation 관련 spec 정정의 지정 SoT hub) 에도 `mutation 13/13`·`persisted`·
    `update-returning-tuple-shape`·`updateReturningRows` 어떤 키워드도 없다(전부 0건).
    즉 "mutation 13/13 검증" 이 mock 경계 안쪽만 반영한다는 정정 각주를 실제로 `spec/
    conventions/node-cancellation.md` 에 붙이는 작업은 **어느 plan 문서에도 등재돼 있지
    않다** — planner 가 update-returning-tuple-shape.md 의 "[planner 위임]" 4개 항목만
    처리하면 이 다섯 번째 항목은 영구히 누락된다. `update-returning-tuple-shape.md` 자신이
    "처음엔 '두 plan 모두' 라고 써 놓고 한 곳만 고쳤다 … 이 세션에서 같은 형태(완료 선언이
    사실보다 앞섬)를 네 번째 반복했다" 고 스스로 기록한 바로 그 패턴의 다섯 번째 반복이다.
  - 제안: `update-returning-tuple-shape.md:193-199` 의 "[planner 위임] 소급 각주" 목록에
    `spec/conventions/node-cancellation.md:198` §2.4 (mutation 13/13 검증이 driver 배선
    정상화 이전 mock 경계 안쪽 검증이었다는 각주)를 다섯 번째 항목으로 실제로 추가하거나,
    `spec-update-node-cancellation-shutdown-classification.md` 에 신규 번호 항목으로
    등재한다. 둘 중 하나가 될 때까지는 `retry-turn-terminal-guard.md:43` 의 "등재돼 있다"
    문구를 "등재 필요(미착수)" 로 정정할 것.

- **[WARNING]** `update-returning-tuple-shape.md` 의 `spec_impact: none` 이 자기 본문이
  명시한 "spec 정합 결정" 과 겹치는데, 같은 PR 계열 내 동일 상황에서 이미 확립된 반대
  선례와 충돌한다
  - target 위치: `plan/in-progress/update-returning-tuple-shape.md:8` (frontmatter)
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md:1-14`(frontmatter 상단
    "`spec_impact` 주의" 콜아웃) — "이 PR 자체는 spec/ 을 1줄도 바꾸지 않았다(코드 전용).
    그럼에도 `none` 이 아닌 이유: … 본문이 project-planner 위임으로 spec 정정 필요를
    스스로 명시하는데 frontmatter 가 `none` 이면, 이 plan 이 `complete/` 로 이동할 때
    Gate C(`spec-plan-completion.test.ts`)가 그 값을 그대로 신뢰해 '영향 없음' 이 잘못
    확정된다."
  - 상세: `spec/conventions/spec-impl-evidence.md` R-8 은 `spec_impact` 를 "완료 시
    작성자가 [내리는] **정합 결정**(spec 경로 목록 또는 `none`)" 이라 정의한다 — `none` 의
    의미도 "spec 변경 **불요**(의식적 no-op)" 로, "이 PR 이 spec 파일을 물리적으로
    건드렸는가" 가 아니라 "spec 이 지금 상태로 정확한가" 를 묻는 필드다. 그런데
    `update-returning-tuple-shape.md` 는 본문 "후속" 절에서 이 PR 이 고친 버그가 실제로
    깨뜨렸던 spec 서술 4곳(`4-execution-engine.md` §1.1·`8-embedding-pipeline.md` §7.3·
    `10-graph-rag.md`·`data-flow/2-auth.md`, 위 첫 번째 발견까지 포함하면 5곳)을 스스로
    나열하며 "planner 위임" 이 필요하다고 명시한다 — 이는 "spec 변경 불요" 와 정반대의
    정합 결정이다. `retry-turn-terminal-guard.md` 는 **정확히 같은 상황**(코드 전용 PR +
    본문이 planner 위임 spec 정정을 스스로 명시)에서 이미 반대로 결정했고, 그 결정 자체가
    2026-07-28 consistency-check WARNING #4 에서 유래한 프로젝트 선례다. 두 plan 이 같은
    패밀리(오늘 같은 diff 가 둘을 동시에 소급 정정)이면서 frontmatter 관례가 갈리면, 이
    plan 이 이후 `plan/complete/` 로 이동할 때 Gate C 가 "spec 영향 없음" 을 그대로
    신뢰해 위 planner 위임 5개 항목이 반영되지 않은 채로 완료 처리될 위험이 실질적이다.
    (현재 `plan/in-progress/22_45_25`·`23_07_12` convention_compliance/cross_spec 라운드는
    `spec_impact: none` 을 "이 PR 이 실제로 바꾼 spec 파일 0건" 기준으로 판정해 통과시켰다
    — 그 판정은 R-8 의 "정합 결정" 문언보다 좁은 해석이다.)
  - 제안: (a) `update-returning-tuple-shape.md` frontmatter 를 `retry-turn-terminal-guard.md`
    선례와 동일하게 `spec_impact:` 리스트(4~5개 대상 spec 경로)로 바꾸고 완료 금지 주의
    문구를 추가하거나, (b) 두 plan 이 `none` 을 유지하는 근거를 R-8 문언에 맞춰 재정합하는
    project-planner 결정을 한 번에 등재한다. 현재 상태로는 두 자매 plan 이 같은 사실관계
    에서 다른 규칙을 적용하고 있다.

## 요약

이번 diff 는 `spec/5-system/` 을 직접 바꾸지 않으므로 target 이 plan 의 "결정 필요" 항목을
일방적으로 우회하는 CRITICAL 급 충돌은 없다. 다만 이 세션 안에서 이미 두 차례 발견된
소급 정정 누락 패턴("완료 선언이 실제보다 앞섬")이 이번에도 형태를 바꿔 재발했다 —
직전 라운드(`23_07_12`)의 cross_spec WARNING 제안 3가지 중 2가지(배너 추가·체크리스트
정정)는 반영됐지만 나머지 하나("`node-cancellation.md` §2.4 각주를 planner 위임 목록에
등재")는 빠진 채, 새로 추가된 배너가 그것이 "등재돼 있다" 고 잘못 주장한다. 아울러
`spec_impact: none` 결정이 자매 plan(`retry-turn-terminal-guard.md`)이 동일 상황에서
이미 확립한 반대 선례와 충돌해, 이후 `plan/complete/` 이동 시 Gate C 가 우회될 위험을
남긴다. 둘 다 WARNING — CRITICAL 로 올릴 근거(활성 데이터 무결성 위험이나 결정 필요 항목의
일방적 override)는 없으나, plan 갱신 없이는 5개(잠재 6개)의 planner 위임 spec 정정 항목
중 최소 1개가 영구 누락될 실질 위험이 있다.

## 위험도

MEDIUM
