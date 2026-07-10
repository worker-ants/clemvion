# 재검증 (plan_coherence) — plan 갱신 정합성

검토 모드: `--impl-done` 재검증. diff-base=`origin/main`.
워크트리(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929`.

## 배경

직전 회차(`review/consistency/2026/07/10/22_22_19/plan_coherence.md`)에서 당신은 INFO 로
`plan/in-progress/ai-usage-attribution-hardening.md` §SPEC-DRIFT 의 "A1~A4" 라벨이 목적지 plan
(`resume-llm-usage-attribution.md`)에 새로 추가된 5번째 항목(§1.3 row 정정)을 미반영한다고 지적했다.
이번 변경으로 두 plan 이 갱신됐다.

## 임무

`git diff origin/main...HEAD -- plan/in-progress/` 및 HEAD 본문을 읽고 확인:

1. `ai-usage-attribution-hardening.md`: §SPEC-DRIFT 가 "PR-2 로 이관" → "본 PR 에서 해소" 로 갱신되고,
   §1.3 정정 4개 위치가 `[x]` 체크로 기록됐는가. §변경 세트·§테스트·§워크플로 갱신이 실제 이번
   커밋 내용(resume-path 테스트 추가, spec 정정, 최종 리뷰 라운드)과 일치하는가.
2. `resume-llm-usage-attribution.md`: 구 A5(§1.3 memory-row 정정) 항목이 "PR-1 에서 완료(`[x]`)" 로
   이동 기록됐는가 — 두 plan 간 **이관 서술이 상호 일관**한가(한 쪽은 "본 PR 해소", 다른 쪽은 여전히
   "PR-2 필수"로 남아 모순되지 않는가).
3. 진행 중 다른 plan(`plan/in-progress/**`)과의 미해결 결정 충돌·후속 항목 누락 유무.
4. 직전 INFO(A1~A4 라벨) 해소 여부.

## 출력
`output_file` 에 `## 발견사항` / `## 요약` / `## 위험도`. 반환 라인:
`STATUS=success ISSUES=<n> PATH=<output_file> RESET_HINT=`.
