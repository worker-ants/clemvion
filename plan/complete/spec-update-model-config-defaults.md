---
name: spec-update-model-config-defaults
worktree: unified-model-mgmt-5af7ee
status: complete
started: 2026-06-11
completed: 2026-06-11
owner: developer
spec_impact:
  - spec/2-navigation/6-config.md
  - spec/4-nodes/3-ai/1-ai-agent.md
---
# Spec Update — model-config defaultParams defaults (반영 완료)

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — 구현이 spec 을 의도적으로 개선한 경우.

## 원본 발견사항
리뷰 `review/code/2026/06/11/00_30_05` SUMMARY#INFO10 (caller context WARNING#10):
`formMaxTokens` 기본값 `4096` — spec §B.4 기본값 `2048` 과 불일치 (구 코드 계승).

## 검증 결과
- `codebase/frontend/src/components/models/model-config-manager.tsx`: `DEFAULT_MAX_TOKENS = 4096`
- PR3 이전 구 `codebase/frontend/src/app/(main)/llm-configs/page.tsx`: 동일 `4096`
- spec `spec/2-navigation/6-config.md §B.4`: 종전 `2048` (구현에 한 번도 적용된 적 없음)

→ 코드가 먼저 4096 으로 정착하고 spec 표기만 낡은 SPEC-DRIFT.

## 반영 결과 (commit 085a7d08)
- `spec/2-navigation/6-config.md §B.4`: `max_tokens` 기본값 `2048` → `4096`
- `spec/2-navigation/6-config.md ## Rationale`: `### R-5. max_tokens 기본값 4096` 신설 (근거 이관)
- `spec/4-nodes/3-ai/1-ai-agent.md` line 124 (`[4096__]`), line 665 (`"maxTokens": 4096`) 동반 갱신 — consistency-check `--spec` W-1 해소 (노드 `maxTokens` 기본값 = "ModelConfig 기본값")

## consistency-check
`review/consistency/2026/06/11/00_56_14` — **BLOCK: NO**. W-1(ai-agent 예시 동반 갱신)·I-3(Rationale 이관) 반영 완료.
