# Plan 정합성 검토 — target: `spec/5-system/` (--impl-done)

## 검토 범위 요약

- diff-base `origin/main` 대비 실제 구현 diff: 13개 파일 / 396줄 — 전부 `entity-nullable-column-type-mismatch.md`(배치 2) 소관 엔티티 nullable 타입 정합화(`| null` 폭 넓히기 + `type:` 명시 + 캐스트 제거)다. `spec/5-system/` 자체는 이번 diff 로 변경되지 않았다(0 file delta) — 이는 정상이다.
- 이 검토는 (a) target `spec/5-system/*` 현재 내용, (b) 위 diff, (c) `plan/in-progress/**` 전체(주로 `entity-nullable-column-type-mismatch.md`)를 대조했다.
- `plan/in-progress/auth-change-password-oauth-only-code-split.md` 는 이미 `plan/complete/`로 이동됐고(`af41a3c6e`), target(`1-auth.md:1454`)의 역참조 링크도 `../../plan/complete/...`를 정확히 가리킨다 — 이 축은 정합.

## 발견사항

- **[WARNING]** `entity-nullable-column-type-mismatch.md` 의 `spec_impact: none` 이 본문의 미해결 planner-턴 후속 두 건과 불일치 — 이 저장소가 이미 두 번 겪은 Gate C 오탐 패턴의 재발
  - target 위치: `spec/5-system/2-api-convention.md §2.2` (명명 규칙 표 — RPC-style sub-channel·`/api/external/*` 두 예외만 등재. 재확인: `grep "api/auth" spec/5-system/2-api-convention.md` → `/api/auth/*` 관련 예외 조항 없음)
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` frontmatter(`spec_impact: none`) vs 본문 "## 할 일" 의 미체크 항목 두 건 —
    1. *"후속(planner 턴) — `spec/1-data-model.md §2.9 next_run_at` 표기 정정"* (`next_run_at`이 `Timestamp`인데 바로 아래 `last_run_at`은 `Timestamp?` — 재확인: `spec/1-data-model.md:260-261` 실측 그대로 잔존)
    2. *"후속(planner 턴, 이 작업과 무관) — `2-api-convention.md §2.2`에 `/api/auth/*` 액션 네임스페이스 예외 조항"* — target 범위 안.
    둘 다 본문에 "**developer 권한 밖**" · "자기-반증형 소정정 예외에 해당하지 않는다" 라고 명시하며 planner 턴으로 위임했다고 적으면서도, frontmatter `spec_impact`는 `none`이다.
  - 상세: 같은 plan 세트 안에 이미 이 정확한 실수가 두 번 지적되고 스스로 교정된 전례가 있다.
    - `plan/in-progress/update-returning-tuple-shape.md` 상단: *"`spec_impact` 주의 — 이 PR 자체는 spec/ 을 1줄도 바꾸지 않는다(코드 전용). 그럼에도 none 이 아닌 이유는 … 본문이 project-planner 위임으로 spec 각주 5건을 스스로 명시하는데 frontmatter 가 none 이면, complete/ 이동 시 Gate C(`spec-plan-completion.test.ts`)가 그 값을 그대로 신뢰해 'spec 영향 없음' 이 잘못 확정된다."* — 근거로 과거 `plan_coherence` 리뷰(`17_49_59` WARNING 1)를 인용.
    - `plan/in-progress/backend-lint-gate-broken-on-main.md` 상단: 동일 사유로 `spec_impact`를 `none` → 실제 영향 spec 2개 경로로 정정(같은 `17_49_59 W1` 인용).
    이번 `entity-nullable-column-type-mismatch.md`는 그 교훈을 반영하지 않았다. `spec-plan-completion.test.ts`(Gate C)는 in-progress 단계에선 강제되지 않지만(`.claude/docs/plan-lifecycle.md:81`), 이 plan이 나중에 `complete/`로 이동하는 시점에 현재 frontmatter 그대로면 "spec 영향 없음"이 잘못 확정되고, 미해결 두 항목이 그 순간 유실된다.
  - 제안: frontmatter를 `spec_impact: [spec/1-data-model.md, spec/5-system/2-api-convention.md]` 형태로 정정하고 sibling plan과 같은 경고 각주를 추가하거나, 두 항목을 공식 spec-sync 트래커(`spec-sync-common-gaps.md` 등)로 이관해 이 plan은 `none`을 유지할 것. 어느 쪽이든 지금(코드 diff가 신선할 때) 처리하는 편이 이월 비용이 적다.

- **[INFO]** `2-api-convention.md §2.2` `/api/auth/*` 액션 네임스페이스 예외 — target 자체에 여전히 미반영, 추적 위치가 부적절
  - target 위치: `spec/5-system/2-api-convention.md §2.2` 명명 규칙 표
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` "## 할 일" (`--impl-done` 최종 라운드 W2 유래, "이 PR 과 무관한 선재 gap 이고 이번 검토가 최초 기록" 이라 스스로 서술)
  - 상세: `/api/auth/{verb}` 15개 이상이 §2.2 명시 두 예외(RPC-style `{id}` 필수 / `/api/external/*`) 어디에도 포섭되지 않는다. developer가 자기 권한 밖으로 정확히 판단해 planner 턴에 위임했으나, 이 발견을 담은 자리가 우선순위 P3의 무관한 엔티티-타입 plan 내부라 향후 이 plan이 완료·아카이브되면 항목 자체가 눈에 안 띄게 묻힐 위험이 있다(위 WARNING과 동일 뿌리).
  - 제안: 항목을 `spec-sync-common-gaps.md`(API 공통 규약 전담 트래커) 또는 신규 `spec-draft-*` 문서로 이관해 이 plan의 완료 여부와 독립적으로 추적되게 할 것.

## 요약

이번 diff(엔티티 nullable 타입 정합화 배치 2, 13파일/396줄)는 target `spec/5-system/*` 문서가 아직 "결정 필요"로 남겨 둔 항목을 일방적으로 우회하거나, 다른 plan의 선행 조건을 침해하지 않는다 — API 계약·인증 흐름에 영향 없는 순수 backend 데이터 계층 타입 정합화이고, 관련 plan(`entity-nullable-column-type-mismatch.md`)도 배치 기준·회귀 가드·기존 실수(추적처 미생성 2회) 재발 방지책을 성실히 기록하고 있다. 다만 그 plan의 frontmatter `spec_impact: none`이 본문이 스스로 명시한 두 건의 미해결 planner-턴 spec 후속(그중 하나가 정확히 이번 target 범위인 `2-api-convention.md §2.2`)과 어긋나며, 이는 같은 plan 세트 안에서 이미 두 차례 지적·자가교정된 패턴(`update-returning-tuple-shape.md`, `backend-lint-gate-broken-on-main.md`)의 재발이다. 완료 이동 시 Gate C 오탐을 막기 위해 frontmatter 정정 또는 항목 이관이 필요하다.

## 위험도

LOW
