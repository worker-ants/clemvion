# 재검증 (cross_spec) — §1.3 spec 정정의 cross-spec 정합성

검토 모드: `--impl-done` 재검증. scope=`spec/data-flow/7-llm-usage.md`, diff-base=`origin/main`.
워크트리(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929`.

## 배경

직전 회차(`review/consistency/2026/07/10/22_22_19/cross_spec.md`)에서 당신은 target §1.3/§4/Rationale
4곳이 이번 배선으로 self-drift(WARNING) 상태이나 타 spec 영역과 정면 모순은 없다고 보고했다.
이번 변경으로 구현자가 그 4개 위치를 정정하는 spec diff 를 동일 PR 에 포함했다.

## 임무

1. `git -C "<worktree>" show HEAD:spec/data-flow/7-llm-usage.md` 로 정정된 §1.3(표 L107·콜아웃 L113)·
   §4 Agent Memory 행·Rationale (b) 를 읽는다.
2. 이 정정이 인접 spec 문서와 **새로운** 모순을 만들지 않는지 확인:
   - `spec/data-flow/13-agent-memory.md`, `spec/data-flow/6-knowledge-base.md` ("모든 LLM 호출 적재"
     류 문구), `spec/data-flow/7-statistics.md` §3, `spec/2-navigation/9-user-profile.md` §6.3,
     `spec/5-system/4-execution-engine.md` §7.4 등이 이번 §1.3 정정("AI Agent 메모리 롤링 요약 압축 =
     context 채움, 잔여 NULL = RerankService listwise + 워크플로 밖 processor 만")과 상충하는지.
   - 특히 "잔여 NULL" 목록이 이제 §1.3 내부(콜아웃 vs Rationale (b))에서 일관된지.
3. 직전 self-drift WARNING 이 해소됐는지, 새 cross-spec CRITICAL/WARNING 이 없는지 판정.
   (인접 문서의 기존 stale 문구가 있으면 이번 PR 범위 밖 후속(PR-2)으로 분류하되 사실만 기록.)

## 출력
`output_file` 에 `## 발견사항` / `## 요약` / `## 위험도`. 반환 라인:
`STATUS=success ISSUES=<n> PATH=<output_file> RESET_HINT=`.
