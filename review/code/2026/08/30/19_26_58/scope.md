# 변경 범위(Scope) 리뷰

## 검증 방법

`git log --oneline origin/main..HEAD` 로 이 브랜치의 커밋 3개(`1a12088f2` 원 fix →
`519671792` 1라운드 리뷰 WARNING/SPEC-DRIFT 반영 → `9d5e001bf` 2라운드 리뷰 WARNING 반영)를
확인하고, `git show --stat`/`git show -- <path>` 로 각 커밋의 실제 diff 를 프롬프트의 unified
diff 와 대조했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 상 이번 라운드
산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 원 fix 커밋에 목적과 무관한 stale 체크박스 정정이 동반됨(반복 관측 — 이미
  자체 인지·수용됨)
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:1314` (`- [x] **backend
    전역 raw-query 소비 지점 감사**` — `1a12088f2` 에서 `[ ]`→`[x]`)
  - 상세: 이 커밋의 목적은 `updateExecutionStatus` else 분기 UPDATE 의 트랜잭션화(같은
    파일 `1327`행 근처 항목) 하나다. 그런데 완전히 다른 백로그 항목("전역 raw-query 감사")도
    같은 diff 에서 완료로 체크됐다. 커밋 메시지가 그 사유(`update-returning-tuple-shape.md`
    에서 이미 41곳 감사가 수행됐음을 확인)를 투명하게 설명하고, 이 사안은 `17_36_15` 라운드의
    scope 리뷰(같은 diff 에 이미 커밋된 `review/code/2026/08/30/17_36_15/scope.md`)가 INFO 로
    지적하고 수용까지 마친 항목이다. 그 이후 두 후속 라운드에서 재발하지 않았다(각 라운드는
    자기 라운드가 지적받은 항목에만 정확히 반응했다). 새로운 위반이 아니라 이미 문서화된
    트레이드오프의 잔존이므로 등급을 올리지 않는다.
  - 제안: 조치 불요(기존 처분 유지). 향후 유사 상황에서는 무관한 plan 그루밍을 별도 커밋으로
    가르는 편이 여전히 낫다는 점만 재확인.

- **[INFO]** 2라운드 리뷰 WARNING 수정 커밋(`9d5e001bf`)이 이 execution-engine 작업과 무관해
  보이는 파일(과거 라운드가 만든 consistency 리뷰 산출물)을 건드리지만, 범위는 정확히
  좁혀져 있다 — 문제 아님, 검증 결과 기록
  - 위치: `review/consistency/2026/08/30/17_49_59/plan_coherence.md` (파일 선두 `STATUS=...`
    + `===REPORT_MARKDOWN_BELOW===` 2줄 삭제)
  - 상세: 겉보기엔 이 execution-engine 트랜잭션화 작업과 전혀 다른 관심사(harness sub-agent
    프로토콜 헤더 누출 버그)로 보인다. 그러나 대상 파일은 **이 PR 자신의 1라운드 커밋
    (`519671792`)이 새로 만든 파일**이라 자기 결과물의 사후 정정이며, 커밋 메시지·plan 백로그
    항목(`backend-lint-gate-broken-on-main.md` "harness: sub-agent 프로토콜 헤더가..." 항목)
    모두 "이 PR 이 새로 커밋한 1건만 고치고, 저장소 전체 824건은 손대지 않는다" 는 범위를
    명시적으로 선언하고 실제로 그렇게 실행됐다(`git show 9d5e001bf --stat` 로 확인 — 코드
    변경 없이 이 파일 1개 + JSDoc + 자기 라운드 산출물 커밋뿐). 대량 무관 정리로 번지지 않도록
    스스로 억제한 사례다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `finishStatusTransition` 헬퍼 추출은 요청 범위 밖 리팩터링처럼 보이지만, 이번
  변경 자체가 만든 신규 위험(WARNING)에 대한 직접 대응이다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `updateExecutionStatus` 의 `linkedNodeExec` 분기와 else 분기가 공유하는 `private async
    finishStatusTransition(...)` 신설 (커밋 `519671792`)
  - 상세: else 분기가 이번 PR 로 트랜잭션을 갖게 되면서 두 분기의 종결부(4줄, 세그먼트 기록 +
    메트릭 발행 + return)가 완전 대칭이 됐고, 그 대칭이 "형제 분기 한쪽만 고치는 drift" 위험을
    새로 만들었다는 점을 `17_36_15` 라운드 리뷰가 WARNING 으로 지적했다. CLAUDE.md 의 구현
    완료 후 review/fix 는 상시 승인된 강제 의무이므로, 이 추출은 임의의 사전 미승인
    리팩토링이 아니라 그 WARNING 에 대한 필수 대응이다. diff 범위도 정확히 그 중복 4줄을
    헬퍼로 옮기는 데 국한됐다.
  - 제안: 없음 — 범위 내 정당한 변경.

- **[INFO]** CHANGELOG·spec(`4-execution-engine.md`, `3-execution.md`)·plan 트래커 2건의
  변경 전부가 원 fix 또는 그 fix 에 대한 리뷰 WARNING/SPEC-DRIFT 대응으로 1:1 추적됨
  - 위치: `CHANGELOG.md`(소급 정정 블록), `spec/5-system/4-execution-engine.md`(후속
    각주 + 「원자성 보장」 else 분기 문장), `spec/data-flow/3-execution.md`(§2.1 표 행),
    `plan/in-progress/backend-lint-gate-broken-on-main.md`, `update-returning-tuple-shape.md`,
    `spec-update-node-cancellation-shutdown-classification.md`
  - 상세: 각 파일의 diff 를 `git show 519671792 -- <path>` 로 개별 확인한 결과, 전부 커밋
    메시지가 명시한 WARNING/SPEC-DRIFT 항목("CHANGELOG 미갱신", "spec_impact: none 오류",
    "`#1242` 각주 불완전", "`data-flow` §2.1 비대칭")과 정확히 대응한다. 목적 없는 확장이나
    무관 서술 추가는 발견되지 않았다.
  - 제안: 없음.

## 요약

이 diff 는 세 커밋(원 fix → 1라운드 리뷰 반영 → 2라운드 리뷰 반영)의 누적이며, 전부가
"`updateExecutionStatus` else 분기의 guarded UPDATE 를 트랜잭션으로 감싸 롤백을 보장한다"는
단일 결함 수정과, 그 수정에 대해 CLAUDE.md 가 강제하는 review→fix 루프의 직접 산출물(WARNING
헬퍼 추출·CHANGELOG/spec 정정·JSDoc 재실측·리뷰 산출물 커밋)로 수렴한다. 유일한 반복 관측은
원 fix 커밋에 동반된 무관 stale 체크박스 1건인데, 이미 이전 라운드에서 지적·수용·설명이
완료된 항목이라 새로운 위반으로 볼 수 없다. 겉보기에 범위 밖으로 보일 수 있는 항목(2라운드의
consistency 산출물 파일 수정)도 실제로는 이 PR 자신이 만든 파일 1개로 정확히 국한되어 있고,
저장소 전역의 동일 결함 824건에는 손대지 않음을 커밋 메시지·plan 백로그가 명시적으로 밝혀
확인했다. 새 import·설정 변경·요청 없는 기능 확장·무의미한 포맷팅은 발견되지 않았다.

## 위험도

NONE
