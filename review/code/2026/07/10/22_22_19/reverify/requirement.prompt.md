# 재검증 (requirement) — WARNING(resume 조립 테스트) + SPEC-DRIFT 해소 확인

코드 리뷰 재검증. diff-base=`origin/main`.
워크트리(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929`.

## 배경 — 직전 발견

직전 회차(`review/code/2026/07/10/22_22_19/requirement.md`, 위험도 LOW)에서 당신은:
- **WARNING**: multi-turn resume 경로(`ai-turn-executor.ts:2296-2302`) `state.*` → `llmContext` 조립을
  exercise 하는 end-to-end 단언 부재.
- **SPEC-DRIFT**: `spec/data-flow/7-llm-usage.md` §1.3(L107,113,162,206) 이 이번 배선을 아직 "미배선/
  NULL" 로 서술(코드가 옳고 spec 갱신 누락).

## 이번 변경

동일 PR 에 (a) resume-path 실값 회귀 테스트 추가(`ai-agent.memory.spec.ts`), (b) `spec/data-flow/
7-llm-usage.md` §1.3 4개 위치 정정 포함. `git diff origin/main...HEAD` 로 확인 가능.

## 임무

1. `git show HEAD:spec/data-flow/7-llm-usage.md` 로 §1.3 표/콜아웃/§4/Rationale 이 실제 구현
   (`git show HEAD:codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` +
   `ai-turn-executor.ts` resume 조립)과 **정합**한지 — SPEC-DRIFT 해소 확인.
2. 신규 resume-path 테스트가 WARNING 을 해소하는지 확인.
3. 요구사항 충족(기능 완전성·spec 본문 일치) 관점에서 잔여 CRITICAL/WARNING 유무 판정.

## 출력
`output_file` 에 `## 발견사항` / `## 요약` / `## 위험도`. 반환 라인:
`STATUS=success ISSUES=<n> PATH=<output_file> RESET_HINT=`.
