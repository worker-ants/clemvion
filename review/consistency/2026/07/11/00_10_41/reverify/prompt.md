# consistency-check --spec 재검증 — A3 CRITICAL 해소 확인 (적용 후)

모드: `--spec` 재검증. 워크트리(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-adjacent-docs`.
변경이 **spec 에 적용됨**(working tree). `git diff` 로 실제 변경 확인 가능.

## 직전 회차 CRITICAL (rationale_continuity)

A3 를 "lean 포인터(필드 표 없음)" 로 신설하려던 것이 `spec/data-flow/0-overview.md ## Rationale`
("1-data-model.md = 엔티티 정의 단일 진실") + 실측(§2.1~§2.23 모든 엔티티, §2.23 AgentMemory 포함
9필드 full 표 보유)과 상충 → CRITICAL(BLOCK).

## 이번 정정 (적용됨)

- `spec/1-data-model.md` `### 2.16.1 LlmUsageLog` 를 **full 필드 표**(14컬럼, V014+V018 DDL 기준)로 신설 —
  §2.10.1 IntegrationUsageLog·§2.23 AgentMemory 와 동형(`> 관련 문서:` 오프너 + 도입 산문 + 필드 표 +
  인덱스). 도입부에 "CASCADE 부모=Workspace, 나머지 FK=SET NULL" 명시. attribution *정책* 권위만
  §1.3 각주로 위임(컬럼은 DDL SoT).
- 7-llm-usage 링크 경로를 `./data-flow/7-llm-usage.md`(디렉터리 prefix)로 작성 —
  `spec-link-integrity.test.ts` 11 tests PASS 확인.
- ERD 트리 Workspace 서브트리에 `LlmUsageLog (1:N)` 추가.
- (역링크) `7-llm-usage.md §2.1` 표에 `[엔티티 §2.16.1](../1-data-model.md#2161-llmusagelog)` 추가.
- A1 두 cross-ref 행은 그대로 적용.

## 임무

1. `git -C "<worktree>" diff spec/1-data-model.md` 의 §2.16.1 이 이제 **모든 엔티티와 동형의 full 표**
   관행에 부합하는지 — 직전 CRITICAL(관행 위반)이 해소됐는지.
2. full 표 컬럼(nullable/FK/cascade)이 실제 DDL(`codebase/backend/migrations/V014__llm_usage_logs.sql`
   + `V018`)과 정확히 일치하는지, `7-llm-usage.md §2.1/§1.3` 과 모순 없는지.
3. 신규 서브섹션이 `0-overview.md ## Rationale`(1-data-model = 엔티티 SoT) 및 기존 결정과 연속적인지.
   새 CRITICAL/WARNING 유무 판정.

## 출력
`output_file` 에 `## 발견사항`/`## 요약`/`## 위험도`. 반환: `STATUS=success ISSUES=<n> PATH=<output_file> RESET_HINT=`.
