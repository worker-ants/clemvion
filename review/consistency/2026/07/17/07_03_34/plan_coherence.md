# Plan 정합성 검토 — spec-update-catch-all-terminal-contract.md

## 발견사항

- **[INFO]** "선행 PR" 참조 경로가 stale (이미 `plan/complete/` 로 이동됨)
  - target 위치: `plan/in-progress/spec-update-catch-all-terminal-contract.md` 상단 인용구
    ("> 선행 PR: `plan/in-progress/user-guide-routing-loop-fix.md` (구현 완료·머지 대기).")
  - 관련 plan: 실제 파일은 `plan/complete/user-guide-routing-loop-fix.md` (커밋 `6da2c8b36 chore(plan): mark
    user-guide-routing-loop-fix complete`, 동일 브랜치 히스토리에 이미 존재)
  - 상세: target 이 "구현 완료·머지 대기" 라고 서술한 선행 작업은 실제로는 이미 `plan/complete/` 로 승격되어
    있다 (같은 브랜치의 더 이른 커밋에서 완료 처리됨). "머지 대기" 자체는 브랜치가 아직 main 에 안 올라갔다는
    의미로는 틀리지 않지만, 인용 경로(`plan/in-progress/...`)는 더 이상 실존 위치가 아니다. 이는 선행 조건이
    "덜 해소"된 것이 아니라 오히려 "더 앞서 해소"된 상태를 구 경로로 표기한 것이라 실질적 충돌·차단 사유는
    아니다.
  - 제안: target 인용 경로를 `plan/complete/user-guide-routing-loop-fix.md` 로 정정 (project-planner 가 본
    plan 반영 시 함께 정정 가능, 사소한 수정이라 별도 phase 불요).

## 교차 검토 상세 (참고)

- `plan/in-progress/` 전체 30개 문서(디렉터리 포함) 를 grep 스캔한 결과, `_layout.md` / `9-user-profile.md` /
  `10-auth-flow.md` / `11-error-empty-states.md` / `[...rest]` / catch-all(라우팅 의미) / `href.ts` /
  `WORKSPACE_ROUTE_SEGMENT` / `/w/<slug>` 를 언급하는 다른 진행 중 plan 은 `spec-sync-user-profile-gaps.md`
  하나뿐이며, 그 항목(§3 슬러그 라우팅 행)은 이미 `[x]` 완료 처리 + `plan/complete/workspace-slug-routing.md`
  로 귀속되어 있어 target 의 서술(§3 catch-all 흡수)과 **정합**한다 — 충돌 없음.
  (node-output-redesign 하위 문서들의 "catch-all" 언급은 노드 핸들러 에러 처리 패턴을 가리키는 동음이의어로,
  라우팅과 무관함을 본문 확인.)
- `spec/2-navigation/9-user-profile.md` frontmatter `pending_plans:` 는 `spec-sync-user-profile-gaps.md` 만
  등재하고 있고, target 은 `status: partial` 추적 대상인 "미구현 surface" 가 아니라 순수 문서 보강(§3 한 문장
  추가)이므로 `pending_plans` 등재 의무 대상이 아님 (spec-impl-evidence.md §2.1 정의상 partial 의 pending_plans
  는 "미구현 surface 를 책임지는 plan" 한정). `_layout.md`/`10-auth-flow.md` 는 `status: implemented` 라
  `pending_plans` 자체가 불필요 — 정합.
- target 이 인용하는 세 출처 문서를 모두 실측 대조함: `review/consistency/2026/07/17/00_32_57/SUMMARY.md`
  INFO#4(60행, plan draft 위임 명시), `review/code/2026/07/17/01_07_43/SUMMARY.md` 경고#1(16행, SPEC-DRIFT —
  코드가 옳고 spec 미반영), `review/consistency/2026/07/17/01_25_26/convention_compliance.md` WARNING(20-35행,
  `code:` 글로브 갭). 세 인용 모두 실제 내용과 정확히 일치 — 근거 날조·왜곡 없음.
- 다른 진행 중 plan 중 `spec/2-navigation/_layout.md` frontmatter `code:` 글로브나
  `codebase/frontend/src/lib/workspace/href.ts` / `(main)/[...rest]/page.tsx` 를 동시에 편집 대상으로 삼는
  plan 은 없음 — Proposal 4 의 `code:` 보강이 다른 plan 과 경합하지 않음.
- target 이 가정하는 사전 조건("구현은 선행 PR 에서 완료됐고 본 제안은 전부 문서 정합화") 은 이미 동일
  브랜치 히스토리(`34008deb5 fix(navigation): ... 무한 중첩 라우팅 fix`, `fdd206ee8 refactor(navigation): ...`)
  로 실측 충족됨.

## 요약

target(`spec-update-catch-all-terminal-contract.md`) 은 `plan/in-progress/` 의 다른 진행 중 작업·미해결
결정과 충돌하지 않는다. 라우팅/네비게이션 영역을 다루는 유일한 인접 plan(`spec-sync-user-profile-gaps.md`)
은 이미 완료 처리된 항목으로 target 의 서술과 정합하며, 다른 plan 이 동일 spec 절이나 동일 코드 경로
(`href.ts`, `(main)/[...rest]/page.tsx`)를 편집 대상으로 겹치지도 않는다. target 이 인용한 세 출처 리뷰
문서도 실측 대조 결과 정확하다. 유일한 흠은 "선행 PR" 인용 경로가 동일 브랜치 내에서 이미
`plan/complete/` 로 이동된 뒤의 구 경로를 그대로 쓰고 있다는 점(INFO, 정보 갱신 권장 — 차단 사유 아님).

## 위험도

NONE
