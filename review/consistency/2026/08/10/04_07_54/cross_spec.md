# Cross-Spec 일관성 검토 — spec/conventions/ (impl-done, diff-base=origin/main, 7차/최종 라운드)

## 검토 방법

프롬프트 번들에 `## 구현 변경 사항` diff 섹션이 없어(알려진 결함, 재현됨) 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서
`git diff origin/main...HEAD` 를 직접 실행해 실제 변경분을 확인했다. 직전 라운드(`02_47_31`)
이후 델타로 지정된 3개 커밋을 개별 `git show` 로 대조했다:

- `5311d6b01` — 미러 정정(PROJECT.md:277 / spec-impl-evidence.md:132 의 "plan-scan.ts(수집·status)"
  → "plan-scan.ts(수집·**frontmatter**·status)") + JSDoc 재배치 + 죽은 링크 정정
- `be9a8fdb2` — 캐시 우회 3곳 확대(`{}` 옵션), `.trim()` 공백 우회 차단, 디렉터리 pin,
  `plan-lifecycle.md` §4 의 `worktree` sentinel 근거를 폐기된 `plan_coherence` 충돌 검출에서
  `plan-stale-audit.sh` + §3 연결 판정으로 교체
- `748f6646e` — `spec-plan-completion.test.ts`/`plan-scan.ts` 주석의 캐시 오염 범위 서술을
  "가드 간 공유" → "같은 테스트 파일 내부 한정" 으로 정정(vitest `isolate:true` 실측)

지시받은 두 항목을 코드/문서 직접 대조로 검증했다:

1. `spec-impl-evidence.md` 의 "판정 로직은 `plan-scan.ts`(수집·frontmatter·status)와
   `spec-links.ts`(링크)" 서술이 실제 코드와 일치하는가
2. `plan-lifecycle.md` 의 `worktree` sentinel 근거 교체가 다른 spec/문서와 충돌하지 않는가

## 발견사항

### 검증 1 — `plan-scan.ts`/`spec-links.ts` 판정 로직 서술 정확성 (문제 없음)

`plan-scan.ts` 를 직접 읽어 확인:

- `checkPlanFrontmatter()` (L228-284) — `worktree`/`started`/`owner` 3필드 판정 (frontmatter)
- `findNonTerminalCompletedPlans()` (L125-150) + `TERMINAL_PLAN_STATUSES` (L106-111) — status 판정
- `collectLivePlanMarkdown`/`collectCompletePlanMarkdown` (L89-96) — 수집

`spec-links.ts` 에서 `findBrokenPlanLinks()` (L286-291, `collectLivePlanMarkdown` 을
`plan-scan.ts` 로부터 import)가 링크 판정을 전담. `plan-frontmatter.test.ts` 를 읽으면
헤더 주석이 정확히 이 구조를 서술한다 — "판정 로직은 전부 밖에 있다 —
`plan-scan.ts`(수집·frontmatter·status), `spec-links.ts`(링크)... 이 파일은 호출부일 뿐" —
그리고 실제로 각 `it()` 는 `checkPlanFrontmatter`/`findNonTerminalCompletedPlans`/
`findBrokenPlanLinks` 의 반환값을 필드별로 assert 할 뿐 판정 로직을 인라인으로 갖지 않는다.

`spec-impl-evidence.md:132`(§4.2 표) · `PROJECT.md:277` · `plan-frontmatter.test.ts` 헤더
셋 다 "수집·**frontmatter**·status" 로 정확히 동형 서술한다 (`5311d6b01` 이전 라운드가
"수집·status" 로 frontmatter 판정 이관 사실을 놓쳤던 미러 결손을 이번 델타가 고쳤고, 그
결과가 코드와 일치함을 확인했다). `plan-scan.test.ts`(L73-166) 와 `spec-links.test.ts`
(L127-215, `findBrokenPlanLinks`)가 각각 negative-path 합성 fixture 로 위반 탐지를
실제로 증명하는 것도 확인했다 — "셋 다 합성 fixture 가 negative-path 를 증명한다" 는
문서 주장이 사실이다.

**결론: 서술과 코드가 일치. 새 불일치 없음.**

### 검증 2 — `[WARNING]` `worktree` sentinel 근거 교체가 `.claude/docs/worktree-policy.md §3` 과 모순

- **target 위치**: `.claude/docs/plan-lifecycle.md §4` (L75-76, `be9a8fdb2` 델타) — "placeholder
  는 `plan-stale-audit.sh` 에는 죽은 worktree 로 보이고 §3 연결 판정에서는 **어떤 worktree 와도
  매칭되지 않아** plan 이 게이트에서 사라지므로 guard 가 거부한다... > 종전 이 자리는
  `plan_coherence` 충돌 검출 오염을 근거로 들었는데, 그 기능은 아래 §소비처 각주대로
  제거됐다."
- **충돌 대상**: `.claude/docs/worktree-policy.md §3 "운영 규칙"` L24 — "**공유 자원 직렬화**:
  동일 `spec/` 파일·코드 영역을 두 worktree 가 동시 수정 중이면 plan 에 명시하고 직렬화
  (`consistency-checker plan_coherence` **가 사전 검출**)."
- **상세**: `plan-lifecycle.md` 는 이번 델타에서 "`plan_coherence` 가 cross-worktree 충돌을
  검출한다" 는 낡은 전제를 스스로 폐기하고 근거를 현재 소비처(`plan-stale-audit.sh`·§3 연결
  판정)로 교체했다 — 실제로 그 기능은 `3da85dc3b`(#576, 2026-06-13)에서 제거됐음을
  `git show`/`git log` 로 확인했고, 현재 `plan_coherence` checker 의 checklist
  (`.claude/skills/code-review-agents/lib/role_instructions.py` L249-256)에는 "미해결
  결정과의 충돌 / 선행 plan 미해소 / 후속 항목 누락" 3항목만 있고 cross-worktree 충돌 검출은
  없다(merge-coordinator 의 `cross_branch_spec_analyzer` 쪽 checklist 항목 7이 "`plan_coherence`
  의 multi-draft 버전" 이라 명시해, 그 capability 가 다른 analyzer 로 이관됐음을 재확인시켜
  준다). 그런데 `worktree-policy.md §3` 은 **여전히** "동일 `spec/`/코드 영역의 동시 수정을
  `plan_coherence` 가 사전 검출한다" 고 단정적으로 서술한다 — `plan-lifecycle.md` 가 방금
  폐기 처리한 바로 그 전제를, `plan-lifecycle.md` 와 자매 관계인 다른 `.claude/docs/*.md`
  가 여전히 정본처럼 쓰고 있다. 두 문서를 나란히 읽는 사람은 "worktree 공유 자원 충돌은
  `plan_coherence` 가 잡아준다" 를 믿고 별도 직렬화 없이 병렬 작업을 진행할 수 있다.
- **범위 참고**: 이 문구는 이번 PR 델타가 만든 것이 **아니다** — `origin/main` 에도 동일하게
  존재해 이번 PR 이전부터 stale 했다(`git show origin/main:.claude/docs/plan-lifecycle.md`
  로 대조 시 `plan-lifecycle.md` 쪽도 원래 같은 낡은 근거를 갖고 있었음을 확인). 따라서 이번
  PR 이 **새로 만든** 모순은 아니고, 이번 PR 이 자기 문서(`plan-lifecycle.md`) 쪽만 고치면서
  형제 문서(`worktree-policy.md`)의 동일 stale 서술을 놓친 것이다 — `be9a8fdb2` 커밋 메시지가
  "SoT 가 자기모순이었다... SoT 도 정정" 이라고 적었는데, 그 SoT 정정 범위가
  `plan-lifecycle.md` 내부(각주 vs sentinel 절)로 한정됐고 `worktree-policy.md` 까지는
  미치지 못했다.
- **제안**: `worktree-policy.md §3` 의 "공유 자원 직렬화" 항목에서 `plan_coherence` 사전
  검출 근거를 제거하거나, "동시 작업 직렬화는 사용자/`/merge-coordinate`(`cross_branch_spec_analyzer`)
  책임" (plan-lifecycle.md L97 각주와 동형 표현)으로 갱신한다. 이번 PR 델타 범위 밖(diff 무변경
  파일)이라 이 PR 을 차단할 사유는 아니지만, 같은 세션에서 함께 고치는 편이 다음 사람이 같은
  혼동에 빠지는 것을 막는다.

### 검증 3 — 나머지 델타 항목 (문제 없음)

- `748f6646e` 의 캐시 오염 범위 정정(`spec-plan-completion.test.ts`/`plan-scan.ts` 주석)은
  코드 주석 전용 변경이며 spec 문서 서술과 무관 — 대조할 spec 주장이 없다.
- `5311d6b01` 의 JSDoc 재배치(`export { collectLivePlanMarkdown }` 위 블록 →
  `findBrokenPlanLinks` 위로 이동)는 현재 파일에서 올바른 위치에 있음을 직접 확인
  (`spec-links.ts` L267-291).
- Gate C grandfather cutoff(`2026-06-04`)는 `spec-impl-evidence.md`·`plan-lifecycle.md`·
  `spec-plan-completion.test.ts`(`GATE_C_CUTOFF`) 3곳 모두 동일 — 델타로 건드리지 않았고
  드리프트도 없다.
- `TERMINAL_PLAN_STATUSES`(`complete`/`implemented`/`applied`/`superseded`) 값은
  `plan-scan.ts` 실코드·`plan-lifecycle.md §4`·`spec-impl-evidence.md §2.2·§4.2`·`PROJECT.md:277`
  4곳 모두 동일 어휘로 일치.
- `#1108`·`#1117` 인용은 `git log --oneline --all --grep` 으로 실존 확인
  (`e97d0d3a6`, `69f4307dd`) — 날조 근거 아님.

## 요약

지시받은 두 핵심 검증(§4.2 표의 `plan-scan.ts`/`spec-links.ts` 판정 로직 서술, `plan-lifecycle.md`
의 `worktree` sentinel 근거 교체) 모두 실제 코드·git 히스토리와 대조했다. 첫 번째는 정확히
일치했고(이전 라운드의 미러 결손이 이번 델타로 해소됨), 두 번째는 `plan-lifecycle.md` 자체
내에서는 자기모순 없이 정정됐으나, 같은 `.claude/docs/` 계열의 형제 문서
`worktree-policy.md §3` 이 여전히 `plan_coherence` 의 폐기된 cross-worktree 충돌 검출
capability 를 근거로 든 서술을 갖고 있어 새로운(직전까지 6개 라운드가 아무도 짚지 않은)
WARNING 을 하나 발견했다. 이 불일치는 이번 PR 델타가 만든 것이 아니라 `origin/main` 부터
있던 pre-existing staleness 이고, 이번 PR 이 `plan-lifecycle.md` 쪽만 고치면서 노출도가
높아졌을 뿐이다 — PR 자체를 막을 사유는 아니지만 함께 정정하길 권한다. 그 외 spec/conventions/
영역의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 새 충돌은
없었다.

## 위험도

LOW

STATUS=success
