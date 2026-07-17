# Consistency Check 통합 보고서

- **모드**: `--spec plan/in-progress/spec-draft-frontend-layering.md`
- **대상**: 신설 예정 `spec/conventions/frontend-layering.md` (레이어 경계 규약)

## BLOCK: YES

**Critical 1건 — 중복 작업 충돌 (naming_collision).** 동일 파일 경로·동일 frontmatter id 의
문서를 **다른 브랜치가 이미 작성 완료**했다. target draft 를 그대로 진행하면 add/add 충돌이
확정된다. spec 쓰기를 중단하고 사용자 결정을 받아야 한다.

## Critical 발견사항

| # | 체커 | 발견사항 | 근거 (main 실측 재확인) |
|---|------|----------|------|
| 1 | naming_collision | 로컬 브랜치 `claude/zen-kapitsa-c5e1de` (워크트리 `.claude/worktrees/nifty-greider-35167d`, 생존 중) 가 `spec/conventions/frontend-layering.md`(108줄, id `frontend-layering`) 를 **이미 커밋**(`b74eb4e1a`, 18:30) 했고, 본 draft 가 "developer 후속 PR" 로 미룬 D2(가드 `src/types/**` 확장)까지 **이미 구현 완료**(`caeeacadb`, 19:01 — `LOWER_LAYERS = ["src/lib/**", "src/types/**"]`). `plan/in-progress/spec-draft-frontend-layering.md` 경로도 동일(229줄). | `git show claude/zen-kapitsa-c5e1de:spec/conventions/frontend-layering.md` 로 직접 확인 |

### 파생 리스크 (Critical 1 에 수반 — main 이 추가 실측)

- **stale base**: 해당 브랜치 base 는 `e370d1d02`(PR #967) 로 **PR #969 머지 이전**이다.
  `git show claude/zen-kapitsa-c5e1de:codebase/frontend/eslint.config.mjs | grep -c backtickSpecifier`
  → **0** — #969 의 백틱 우회 차단·severity 검증·병합 의미론 검증이 **없다**.
- **충돌 확정**: `git merge-tree` 기준 `origin/main` 대비 **충돌 7건**. 그 브랜치가
  `eslint.config.mjs` 를 `LOWER_LAYERS` 구조로 재작성했는데, #969 가 같은 파일을
  `literalSpecifier`/`backtickSpecifier` 구조로 이미 재작성했다 — 동일 영역 재작성끼리 충돌.
- **silent revert 위험**: stale base 인 채 PR·머지되면 #969 를 되돌릴 수 있다
  (알려진 실패 모드 — `ensure-worktree` stale base).
- 단, `rag-types.ts` / `conversation-utils.ts` 변경은 **주석에 spec 링크를 추가하는 것뿐**으로
  기능 변경이 아니다 (main 이 diff 로 확인) — 기능 충돌은 `eslint.config.mjs` / 가드 테스트에 국한.

## 경고 (WARNING)

| # | 체커 | 발견사항 | 제안 |
|---|------|----------|------|
| 1 | convention_compliance | draft 가 신설 문서의 frontmatter(`status`/`pending_plans`) 설계를 담지 않음. D2 가 미구현 상태로 spec 에 전사되면 `spec-impl-evidence.md` §3 의 "일부 구현 → `status: partial` + 실재하는 `pending_plans:`" 의무 위반, `spec-pending-plan-existence.test.ts` 가드에 걸릴 수 있음 | sibling 브랜치는 이미 `status: partial` + `pending_plans:` 로 이 문제를 해결해 뒀다 — 그 문서를 채택하면 자연 해소 |
| 2 | rationale_continuity | D2 의 "순환 방지" 근거와 `## 구현 위임` 의 실제 지시 범위 불일치 — `files` 배열만 확장하면 `types → components` 만 막히고 `types → lib` 는 무가드로 남는다. 규약이 선언한 레이어 순서(`types < lib`)를 가드가 완전히 강제하지 못함 | 규약 본문에서 "가드가 강제하는 범위"와 "규약이 선언하는 범위"를 구분해 명시할 것 |

## 참고 (INFO)

| # | 체커 | 발견사항 |
|---|------|----------|
| 1 | rationale_continuity | D3(`src/app` 배제) 논거의 비대칭성 + top-level 미분류 파일(`mdx-components.tsx`, `proxy.ts`, `__tests__/`) 의 레이어 귀속 미정의 |
| 2 | convention_compliance | D1~D3 에 규칙과 근거(Why/Why not)가 혼재 — 전사 시 본문 규칙 절과 `## Rationale` 로 분리해야 기존 관행과 일치 |
| 3 | convention_compliance | 관련 문서 cross-link 헤더(`> 관련 문서: ...`) 계획 부재 |
| 4 | plan_coherence | 동일 파일(`eslint-layering-guard.test.ts`)을 다루는 후속 작업들을 한 PR 로 묶으면 추적성이 좋아짐 |
| 5 | cross_spec | 충돌 없음 — 순수 코드 컨벤션이라 데이터 모델·API·요구사항 ID·상태 전이·RBAC 어디와도 정의를 공유하지 않음. `spec/conventions/` 21개 전수 대조 이름 충돌 없음 |

## 체커별 요약

| 체커 | 위험도 | 결과 |
|------|--------|------|
| cross_spec | NONE | 충돌 없음 |
| rationale_continuity | LOW | WARNING 1 · INFO 1 — 기존 Rationale 과의 CRITICAL 충돌 없음, 최초 문서화 |
| convention_compliance | MEDIUM | WARNING 1 · INFO 2 — 명명·id 는 규약 일치, frontmatter 설계 누락 |
| plan_coherence | LOW | INFO 1 — in-progress 24개 문서와 결정 충돌 없음 |
| naming_collision | **CRITICAL** | 동일 경로·id 를 sibling 브랜치가 선점 |

## 결론 — 다음 행동

spec 쓰기 **차단**. 중복 작업이므로 draft 를 밀어붙이지 말고, 이미 완료된 sibling 브랜치를
어떻게 살릴지 사용자 결정 필요:

1. sibling 브랜치를 `origin/main`(099f63cc) 으로 rebase → 충돌 7건 해소 → `/ai-review` → PR
2. sibling 의 spec 문서만 채택하고 가드 확장은 현재 main 위에서 재적용
3. sibling 폐기 후 본 draft 진행 (그쪽 작업 유실 — 비권장)
