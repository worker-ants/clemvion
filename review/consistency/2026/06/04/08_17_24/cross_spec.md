# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-done`
**Target 문서**: `spec/conventions/spec-impl-evidence.md`
**검토 일시**: 2026-06-04

---

## 발견사항

### 발견사항 1
- **[WARNING]** `.claude/docs/plan-lifecycle.md` (main) 에 `(unstarted)` sentinel · Gate C(`spec_impact`) 정의 미반영
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.0` — `plan-frontmatter.test.ts` 설명 행에서 `worktree`(sentinel `(unstarted)` 허용)라고 기술; `spec-plan-completion.test.ts`(Gate C) 가드가 `started ≥ 2026-06-04` plan 의 `spec_impact` 필드를 강제한다고 기술. `§6 Rollout §3` 에 §4.0 가드 3건이 "kb-quality 에서 확장"이라고 명시.
  - 충돌 대상: `.claude/docs/plan-lifecycle.md §4` (main 브랜치 기준) — frontmatter 스키마 예시에 `worktree`/`started`/`owner` 3개 필드만 있음. `(unstarted)` sentinel 언급 없음. §5 이동 commit 자가 점검에 `spec_impact` 체크박스 없음. Gate C 절 (`###Gate C — 완료 plan 의 spec 정합 결정`) 이 없음.
  - 상세: 워크트리의 `.claude/docs/plan-lifecycle.md` 는 이미 sentinel·Gate C·`spec_impact` 를 포함하도록 갱신됐다. 그러나 spec `spec-impl-evidence.md §4.0` 은 `plan-lifecycle §4` 를 SoT 로 크로스 참조한다 — 머지 후 main 의 `plan-lifecycle.md` 가 갱신되지 않은 채 남으면 참조가 끊긴다. 이 PR 의 diff 에 `.claude/docs/plan-lifecycle.md` 변경이 포함돼 있으므로 동기화는 됐으나, 두 문서 모두 같은 PR 에 포함됐는지 확인 필요.
  - 제안: 이 PR 의 git diff 에 `.claude/docs/plan-lifecycle.md` 의 변경이 포함되어 있지 않다면 별도 갱신 PR 필요. 포함됐다면 이슈 없음 — 현재 diff scope (코드 파일만) 에는 포함되지 않으므로 함께 갱신 확인 권장.

### 발견사항 2
- **[INFO]** `spec-area-index.test.ts` 의 `spec/conventions/` 면제 — spec 본문과 코드가 일치하나 중복 설명
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.0` 표 — `spec-area-index.test.ts` 예외 란에 `spec/conventions/`(flat reference, 무-index) 라고 기술.
  - 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` (신규 추가 파일 diff) — `collectAreas()` 내 `if (rel === "spec/conventions") continue;` 라인으로 동일하게 면제.
  - 상세: 코드와 spec 설명이 정확히 일치. 충돌 아님. 단, spec 설명과 코드 주석(`// flat reference, no index`)이 동일한 문구라서 향후 `spec/conventions` 이 인덱스를 갖게 될 때 양쪽을 동시에 갱신해야 한다는 점은 유의.
  - 제안: 현재 이슈 없음.

### 발견사항 3
- **[INFO]** `plan-frontmatter.test.ts` 의 `(unstarted)` sentinel — main `plan-lifecycle.md §4` 와 현재 불일치하나 PR 동반 갱신 전제
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.0` 표 주석: "worktree`(sentinel `(unstarted)` 허용)"
  - 충돌 대상: `.claude/docs/plan-lifecycle.md §4` (main) — sentinel 에 대한 언급 자체가 없음. 단순히 `worktree: <task_name>-<slug>` 예시만 존재.
  - 상세: `plan-frontmatter.test.ts` 구현에서 `WORKTREE_SENTINEL = "(unstarted)"` 를 정의하고 placeholder 패턴(`TBD`, `미정`, 등)과 구별한다. 이 규칙은 spec-impl-evidence 가 새로 정의하는 규약이므로 main plan-lifecycle.md 에 역방향 동기화가 필요하다. 워크트리의 plan-lifecycle.md 는 이미 반영됐으므로, 이 PR 이 머지되면 main 으로 전파된다 — 단, `.claude/docs/plan-lifecycle.md` 가 이 PR 의 머지 대상에 포함되어야 한다.
  - 제안: PR 머지 전에 diff 에 `.claude/docs/plan-lifecycle.md` 변경이 포함됐는지 재확인.

### 발견사항 4
- **[INFO]** `GATE_C_CUTOFF = 2026-06-04` 하드코딩 — spec 본문과 구현이 일치하나 날짜는 코드에만 선언됨
  - target 위치: `spec/conventions/spec-impl-evidence.md §4 Gate C` 행 — `started ≥ 2026-06-04` 이라고 인라인 기재. `.claude/docs/plan-lifecycle.md §5 Gate C` 도 동일 날짜 기재.
  - 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` — `const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z")`.
  - 상세: 세 곳(spec-impl-evidence.md, plan-lifecycle.md, 테스트 코드)이 동일 날짜를 각자 하드코딩. 충돌은 없으나 날짜가 변경될 경우 세 곳을 함께 갱신해야 하는 triple-write 구조. 현 시점 값은 일치.
  - 제안: 현재 이슈 없음. 날짜 변경 시 세 파일 동시 갱신 필요함을 주석 또는 Rationale 에 명기하면 향후 drift 예방에 도움.

---

## 요약

target 문서(`spec/conventions/spec-impl-evidence.md`)는 새로운 지식저장소 무결성 가드 3건(`spec-link-integrity`, `spec-area-index`, `plan-frontmatter`)과 Gate C(`spec-plan-completion`) 규약을 정의한다. 다른 spec 영역의 데이터 모델·API 계약·상태 머신·RBAC 정의와는 직접 충돌이 없으며, 요구사항 ID 영역도 해당 없다. 유일한 주의 지점은 spec-impl-evidence 가 SoT 로 참조하는 `.claude/docs/plan-lifecycle.md` 의 main 브랜치 버전이 아직 `(unstarted)` sentinel·Gate C·`spec_impact` 필드를 포함하지 않는다는 점이다 — 워크트리 내 plan-lifecycle.md 는 이미 갱신됐으므로 이 PR 이 해당 파일을 포함해 머지되면 해소된다. PR diff 에 `.claude/docs/plan-lifecycle.md` 가 포함됐는지 확인을 권장한다.

---

## 위험도

LOW
