# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 핵심 수정과 무관한 트래커 항목 1건이 동봉됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5133` (게이트 숫자 기준, `- [ ] **spec/4-nodes/*/0-common.md 6개가 전부 id: common …**` 항목)
  - 상세: 이번 PR 의 목적은 `isPendingPlanPath` 신설로 `pending_plans:` 가드를 「plan 인가」까지 검사하게 하는 것인데, 이 커밋에는 `--impl-prep` 실행 중 발견된 별개 결함(`0-common.md` 6개의 `id: common` 중복)을 이 무관한 planner 트래커에 신규 항목으로 등재하는 변경이 섞여 있다. 코드 수정은 아니며 "(planner, 낮음, 2026-09-24 등재 …)" 로 표시되어 이번 PR 이 그 문제를 직접 처리하지 않는다는 점은 명확하다.
  - 제안: 이 저장소의 기존 관행상 `--impl-prep`/`--impl-done`에서 발견된 부수 Warning 을 등재하는 것은 표준 절차이고(동일 파일에 유사한 다른 세션 등재 항목들이 이미 다수 존재), `plan/**` 는 developer 쓰기 권한 범위에 포함되므로 규약 위반은 아니다. 다만 스코프 관점에서는 "핵심 diff(functional fix) + 등재성 diff(administrative)" 가 한 커밋에 섞여 있다는 점만 기록해 둔다 — 별도 조치 불요.

- **[INFO]** `review/consistency/2026/09/24/19_35_41/*` 8개 파일은 순수 자동 생성 산출물
  - 위치: `review/consistency/2026/09/24/19_35_41/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: 신규(new file) 추가만 있고 내용은 `/consistency-check --impl-prep` 실행의 기계적 출력이다(수기 편집 흔적 없음). `CLAUDE.md`상 `review/**`는 developer 쓰기 권한이며, 구현 착수 전 `--impl-prep` 실행과 그 증적 보존은 의무 절차이므로 이 파일들의 포함은 의도된 범위 내다.
  - 제안: 조치 불필요. 기록 목적으로만 명시.

## 핵심 변경 3파일 평가

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`: `isPendingPlanPath` 함수 신설(라인 85~101)만 추가. 기존 코드·포맷·주석은 손대지 않음. 순수 가산적 diff.
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts`: import 한 줄 확장 + 새 `describe("isPendingPlanPath", …)` 블록 추가. 기존 `isApplicable` 테스트는 무변경.
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts`: 가드 동작이 바뀌었으므로 그에 맞춰 헤더 주석을 갱신하고, 신설 술어를 호출하는 `it` 블록 1개를 추가. 문서-코드 동기화 목적의 주석 변경으로, 임의의 주석 손질이 아니라 실제 동작 변경을 반영한 것.

세 파일 모두 커밋 목적("pending_plans 가드가 「그게 plan 인가」를 묻게 한다")에 정확히 대응하며, 관련 없는 리팩토링·포맷팅·불필요한 임포트·설정 변경은 발견되지 않았다. `git diff --stat`(13개 파일, +671/-5)과 프롬프트에 제시된 파일 목록이 정확히 일치함을 확인했다 — 프롬프트 밖의 숨은 변경은 없다.

`plan/in-progress/pending-plan-is-plan.md` 신설은 이 워크트리의 작업 계획 문서로, 프로젝트 컨벤션(`plan/in-progress/<name>.md`)이 요구하는 표준 산출물이다.

## 요약

핵심 기능 변경(가드 술어 신설 3파일)은 매우 좁고 목적에 정확히 부합하며 무관한 리팩토링·포맷팅·주석·임포트·설정 변경이 없다. 동봉된 나머지 10개 파일은 전부 이 저장소의 워크플로가 요구하는 절차적 산출물(작업 plan 문서, impl-prep 소비 트래커 등재 1건, consistency-check 자동 생성 리포트)이며, 임의의 기능 확장이나 의도 밖 코드 수정은 아니다. 트래커에 별개 결함(`id: common` 중복)을 등재한 것은 코드가 아닌 문서 항목이고 "(planner, 낮음)"으로 위임돼 있어 실질적 스코프 이탈로 보기 어렵다.

## 위험도

NONE
