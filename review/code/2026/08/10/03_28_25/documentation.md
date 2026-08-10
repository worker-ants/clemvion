# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `WORKTREE_PLACEHOLDER` 의 rationale 이 이미 제거된 메커니즘("plan-coherence 충돌 검출")을 근거로 든다 — 오래된 주석
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:140-143` (`WORKTREE_PLACEHOLDER` 의 JSDoc), `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:33-35` (동일 rationale 을 반복)
  - 상세: 두 곳 모두 legacy placeholder(`TBD`, `assigned at impl-start`, `미정` 등)를 거부하는 이유로 "살아있지만 죽은 worktree 처럼 보여 **plan-coherence 충돌 검출**을 오염시킨다"를 든다. 그러나 이 표현이 가리키는 "다른 worktree 와의 동시 작업 충돌 검출" 기능은 commit `3da85dc3b`(`refactor(consistency): plan-coherence checker 에서 cross-worktree 충돌 검토 제거`, #576)로 **의도적으로 제거**됐다 — "병렬 작업이 다른 머신/세션에 있으면 로컬 미반영이라 신뢰할 수 없고 토큰만 소모"가 그 이유였다(`.claude/docs/plan-lifecycle.md:96` 참조). 현재 `.claude/agents/plan-coherence-checker.md:18` 도 "다른 worktree·branch 와의 동시 작업 충돌... 은 검토 대상이 아니다"라고 명시적으로 그 범위를 부정한다. 즉 이 주석은 2026-08-09/10 라운드에서 `plan-scan.ts` 로 신규 추출되면서도(파일 헤더가 "네 벌을 하나로 합쳤다로 읽히지 않도록" 등 최신 상태를 세심히 반영하는 파일인데도) 훨씬 이전(commit `2d4775e28`, #457)부터 남아있던 이 부정확한 근거를 그대로 복제해 옮겼다. placeholder 거부 자체는 여전히 유효한 동작이지만(`plan_guard.py` 의 worktree↔plan 매칭, data hygiene 등 다른 근거로 정당화 가능), 적힌 "이유"는 이제 존재하지 않는 기능을 가리킨다.
  - 제안: 두 JSDoc 모두에서 "plan-coherence 충돌 검출을 오염시킨다"를 실제로 남아있는 근거로 교체한다. 예: "`plan_guard.py`(push gate)가 `worktree:` 로 plan↔현재 worktree 를 매칭하는데, placeholder 값은 어떤 실제 worktree 와도 매칭되지 않아 그 gate 를 무력화한다" 또는 단순히 "값이 없음을 나타내려면 명시 sentinel 을 쓰라"는 data-hygiene 근거로 축약. cross-worktree 충돌 검출은 `#576` 로 폐기됐다는 사실도 함께 남겨 재발을 막을 것.

- **[INFO]** `findBrokenPlanLinks` JSDoc 의 "135" 수치에 측정 시점 주석이 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:296` (`findBrokenPlanLinks` JSDoc — "`plan/complete/**` carries 135 broken links and that is correct")
  - 상세: 같은 JSDoc 블록 앞부분(279-294행)의 "8"/"9번째" 수치는 "Measured 2026-08-09/10"라는 시점 라벨을 명시해 향후 드리프트 가능성을 스스로 인정한다. 반면 "135"는 시점 라벨 없이 현재형("carries... and that is correct")으로 단언돼 있다. 이 수치는 어떤 테스트/캐너리로도 고정돼 있지 않으므로(grep 결과 이 파일에만 등장), plan 이 `complete/` 로 계속 이동함에 따라 조용히 벌어질 수 있다.
  - 제안: 필수는 아니나, 같은 블록의 "Measured 2026-08-09/10" 라벨을 "135"에도 붙이거나 "대략(approximately)" 같은 완충 표현을 추가하면 향후 리뷰가 stale 수치로 오인하지 않는다.

- **[INFO]** 일부 export 된 interface/type 에 최소 설명이 없음 (스타일 nit, 차단 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `PlanMdFile`(31-34행)·`NonTerminalPlan`(107-110행)·`FrontmatterViolationKind`(184-190행)·`FrontmatterViolation`(192-196행), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `MdLink`(72-76행)·`SpecMdFile`(119-122행)·`LinkViolationKind`(154행)·`LinkViolation`(156-161행)
  - 상세: 필드명이 자기설명적이라 실질적 혼동은 없다. 나머지 exported 함수(`checkPlanFrontmatter`, `findNonTerminalCompletedPlans`, `findBrokenPlanLinks` 등)는 이례적으로 상세한 JSDoc(근거·실측·edge case)을 갖추고 있어 대비된다.
  - 제안: 선택 사항. 굳이 고칠 필요는 없음 — 다른 정보가 이미 이 파일들의 문서화 수준을 크게 상회한다.

## 요약

리뷰 대상 4개 파일(`plan-scan.ts`/`plan-scan.test.ts`/`plan-frontmatter.test.ts`/`spec-links.ts`)은 이 저장소의 다른 코드 대비 문서화 수준이 매우 높다 — 모든 공개 함수에 "왜"를 설명하는 JSDoc, 각 라운드의 ai-review 지적을 인용해 회귀를 막는 인라인 주석, 실측된 파서 동작(js-yaml 라운드트립·gray-matter 캐시 버그 등)을 근거로 한 정교한 설명이 갖춰져 있다. 유일한 실질적 문제는 `WORKTREE_PLACEHOLDER` 의 rationale 이 `#576`으로 이미 폐기된 "plan-coherence 충돌 검출" 메커니즘을 근거로 들고 있는 오래된 주석(2곳, 신규 추출된 `plan-scan.ts` 에도 그대로 복제됨)이다. README/API 문서/CHANGELOG/환경변수 문서 갱신은 해당 사항 없음(내부 테스트 tooling 리팩터이며 SoT 인 `.claude/docs/plan-lifecycle.md` §4 는 이미 `TERMINAL_PLAN_STATUSES`·sentinel·status 스키마를 코드와 일치시켜 두고 있음, 실측 확인).

## 위험도

LOW
