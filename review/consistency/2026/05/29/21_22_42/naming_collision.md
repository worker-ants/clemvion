# Naming Collision Review

target: worktree `spec-frontmatter-status-migration-027c17`

변경 범위:
- `spec/5-system/4-execution-engine.md` — frontmatter 수정 (status/code/pending_plans)
- `plan/in-progress/execution-engine-residual-gaps.md` — 신규 plan 파일
- `plan/in-progress/spec-frontmatter-status-migration.md` — 신규 plan 파일

---

## 발견사항

### INFO — G1/G2/G3 레이블은 로컬 컨벤션, 전역 ID 아님

- target 신규 식별자: `execution-engine-residual-gaps.md` 내부 `G1`, `G2`, `G3` 섹션 레이블
- 기존 사용처: `plan/in-progress/chat-channel-outbound-still-broken.md` 33-35행, `plan/in-progress/replay-rerun.md` 22행에서 각 plan 내부 태스크 레이블로 동일한 G1/G2/G3 기호를 사용 중
- 상세: G1/G2/G3 는 각 plan 파일 내부의 로컬 섹션 레이블이며, 전역 고유 식별자로 선언된 것이 아니다. 파일명이 달라 참조 경로 충돌은 없고, 다른 plan 이 이 레이블을 cross-reference 하지 않는다. 혼동 가능성은 낮다.
- 제안: 현 상태 유지 가능. 향후 cross-plan 참조가 필요해지면 `EE-G1` 같은 prefix 를 붙여 스코프를 명시하는 것이 좋다.

---

## 충돌 없음 확인 항목

1. **파일명 충돌** — `plan/in-progress/execution-engine-residual-gaps.md` 및 `plan/in-progress/spec-frontmatter-status-migration.md` 는 `plan/in-progress/`, `plan/complete/`, `plan/complete/archive/` 전체에서 동명 파일이 존재하지 않는다. 충돌 없음.

2. **spec frontmatter `id` 충돌** — `spec/5-system/4-execution-engine.md` 의 `id: execution-engine` 은 origin/main 에서 이미 동일 값으로 존재하던 것이며, 이번 diff 가 새로 도입한 ID 가 아니다. 전체 spec 에서 해당 ID 는 이 파일 한 곳에서만 선언된다. 충돌 없음.

3. **`pending_plans:` 참조 대상 실존 여부** — `spec/5-system/4-execution-engine.md` 의 `pending_plans: [plan/in-progress/execution-engine-residual-gaps.md]` 가 가리키는 파일이 이번 worktree 에서 신규 생성된다. 참조와 실체가 일치한다. 충돌 없음.

4. **`spec-frontmatter-rollout.md` (complete) 와의 의미 중복** — `plan/complete/spec-frontmatter-rollout.md` 는 "frontmatter 일괄 롤아웃 + 가드 구축" plan (완료, 2026-05-23). 신규 `spec-frontmatter-status-migration.md` 는 "rollout 이후 status 실상태 전이 작업"으로 동일 주제 후속이지만 명칭이 다르고 단계도 구분된다. 의미 중복 우려 없음.

5. **환경변수·API endpoint·이벤트명** — 이번 변경은 spec/plan 문서 편집만 포함하며, 코드 변경이 없다. 환경변수·endpoint·이벤트명 신규 도입 없음.

---

## 요약

신규 도입된 두 plan 파일명(`execution-engine-residual-gaps.md`, `spec-frontmatter-status-migration.md`)은 기존 `plan/in-progress/` 및 `plan/complete/` 전체에서 동명 파일과 충돌하지 않는다. `spec/5-system/4-execution-engine.md` 의 frontmatter `id: execution-engine` 은 이번 변경이 새로 부여한 ID 가 아니며 기존에 단독으로 사용 중이었다. `pending_plans:` 참조 대상도 동일 worktree 내에서 실체가 생성되어 일관성을 갖춘다. G1/G2/G3 레이블이 다른 plan 파일에서도 로컬 용도로 쓰이지만 전역 고유 식별자가 아니므로 실질적 충돌은 없다. 식별자 관점에서 차단이 필요한 문제는 발견되지 않았다.

## 위험도

NONE

STATUS: OK
