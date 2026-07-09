# Plan 정합성 검토 — spec/data-flow/7-llm-usage.md (--impl-done)

## 발견사항

- **[WARNING]** 후속 spec 정정 4건의 유일한 상세 근거가 로컬 전용(unpushed) backup 브랜치에만 존재 — 소실 위험
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 Caller 카탈로그 + Rationale "`llm_usage_log` 의 nullable context 컬럼들"(189~205행) — 이번 PR 이 여기서 attribution 완결(코드 수정 채택)을 확정 기록했다.
  - 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md` §"잔여 follow-up (별도 project-planner 트랙, 본 PR 범위 밖)" — `"7-llm-usage 인접 문서 정정 4건 (6-knowledge-base/13-agent-memory "모든 LLM 호출 적재", 7-statistics/9-user-profile workflowId 캐비어트, 1-data-model LlmUsageLog 서브섹션, 4-execution-engine/1-ai-agent 재구성 3분류 문구). backup 브랜치 `spec-update-7-llm-usage.md` 참조."`
  - 상세: 이 pointer 가 가리키는 `spec-update-7-llm-usage.md` 는 현재 브랜치(`claude/ie-resume-llm-attribution-c82918`)의 `plan/in-progress/` 에 **존재하지 않는다** (`find plan -iname "*7-llm-usage*"` → `resume-llm-usage-attribution.md` 한 개뿐). 실제 위치는 로컬 브랜치 `backup-pre-rebase-elastic-shannon` (커밋 `7a270a923`, 2026-07-10 01:39) 뿐이며, 이 브랜치는 **origin 에 push 되지 않은 로컬 전용 브랜치**다(`git branch -r` 에 없음). 그 브랜치의 `spec-update-7-llm-usage.md` 에는 4건 follow-up 이 대상 파일·구간·구체적 정정 문구까지 상세 기록돼 있었으나(예: `6-knowledge-base.md`/`13-agent-memory.md` §4 "모든 LLM 호출은 llm_usage_log 적재" → "chat 적재 / embed 미적재(§1.3)" 정정안, `1-data-model.md` 에 `LlmUsageLog` 전용 서브섹션 신설안 등), 2026-07-10 stale-base rebase 로 현재 PR 브랜치에서 통째로 제거되고 `resume-llm-usage-attribution.md` 의 한 줄 bullet 만 남았다. worktree/로컬 브랜치가 정리되면 이 backup 브랜치와 상세 내용은 **영구 소실**되고, 남은 pointer 는 존재하지 않는 대상을 가리키게 된다. 실측 확인: `spec/data-flow/6-knowledge-base.md:348`, `spec/data-flow/13-agent-memory.md:231` 이 여전히 "모든 LLM 호출은 `llm_usage_log` 적재" 로 stale — 이번 PR 이 §1.3 에서 확정한 "chat 계열만 적재 / embed 계열 미적재" 구분과 어긋난 서술이 그대로 남아있음을 확인.
  - 제안: PR 반영 전 (a) `resume-llm-usage-attribution.md` 의 follow-up bullet 을 backup 브랜치에 있던 4건의 파일·구간·정정 문구 수준으로 직접 인라인하거나, (b) `plan/in-progress/spec-update-7-llm-usage.md` 를 backup 브랜치에서 cherry-pick/복원해 현재 브랜치에 커밋 — 어느 쪽이든 로컬 전용·미푸시 브랜치 참조에 후속 추적을 의존하지 않도록 정리 권장. (CRITICAL 아님 — 이번 PR 자체의 §1.3/Rationale 변경은 코드와 정합하고 완결돼 있으며, 미해결 "결정" 과 충돌하지 않음. 소실 위험이 있는 건 별도 project-planner 트랙으로 미룬 인접 문서 정정 4건의 추적 매체일 뿐.)

## 요약

이번 PR(`resume-llm-usage-attribution.md`)의 target 변경 자체 — `spec/data-flow/7-llm-usage.md` §1.3/Rationale 의 resume 턴 attribution 정정 — 은 diff(ai-turn-executor.ts, information-extractor.handler.ts, execution-engine.service.ts 주석)와 완전히 정합하고, `4-execution-engine.md` §6.1 소비처 표에도 이미 반영돼 있으며, 이전에 "결정 대상"이던 항목("코드 수정 vs spec 차원 집계 재정의")도 "코드 수정 채택"으로 확정 기록돼 미해결 결정과 충돌하지 않는다. 다만 plan 이 "본 PR 범위 밖"으로 명시 이관한 인접 문서 정정 4건(6-knowledge-base/13-agent-memory 의 stale "모든 LLM 호출 적재" 문구 등)의 유일한 상세 추적 문서가 origin 에 push 되지 않은 로컬 backup 브랜치에만 남아있어, worktree 정리 시 그 follow-up 상세가 소실되고 현재 plan 의 pointer 만 허공을 가리키게 될 위험이 있다.

## 위험도
MEDIUM
