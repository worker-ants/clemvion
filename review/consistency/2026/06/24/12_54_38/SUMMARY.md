# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

## 전체 위험도
**LOW** — 규약 준수 WARNING 1건(plan frontmatter 필수 필드 누락), Cross-Spec WARNING 2건(파일 내 상수명/리터럴 혼용, M-1 collaborator 인접 파일 미갱신). Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 제안 | 처리 |
|---|---------|------|-------------|------|------|
| 1 | convention_compliance | plan frontmatter 필수 필드 `started`·`owner` 누락 (`plan-frontmatter.test.ts` build 가드) | draft frontmatter | `started: 2026-06-24` + `owner` 추가 | **적용** |
| 2 | cross_spec | 1-D 가 `MAX_REVIEW_ROUNDS` 도입 시 L957·L1085·L679·L948 리터럴 `2`/`최대 2회` 와 혼용 | 4-ai-assistant.md | 통일 또는 변경 불요 명시 | **회피** — 1-D 단순화(MAX_REVIEW_ROUNDS 심볼 미도입, finishBlockCount bullet 만 삭제). 기존 `reviewRoundCount >= 2`/`최대 2회` 프로즈 표기 유지 |
| 3 | cross_spec | M-1 collaborator 등재를 `1-ai-agent.md` frontmatter 에만 수행 → `0-common.md` 등 인접 파일 drift | 인접 파일 | 후속 예약 | **부분 적용**(0-common.md frontmatter 동반 갱신) + 잔여(data-hydration-surfaces·13-agent-memory prose anchor — handler facade 잔존이라 유효) 후속 |

## 참고 (INFO) — 처리

- #3(system-prompt.ts Self-review): **별건 발견** — `prompts/system-prompt.ts:382` 가 "PLAN_NOT_COMPLETE 발동 시 review skip"(구 동작)을 LLM 에 안내. 코드(`shouldSkipReview`)는 제거했으나 프롬프트 문자열 stale. codebase/** 변경이라 **developer 별 PR** 로 플래그(본 planner PR 범위 밖). 1-D 는 spec body 를 코드-진실에 정합(pre-existing 내부 모순 해소)이며 prompt drift 를 새로 만들지 않음.
- #5(1-F §7 보완): §7 의사코드 뒤 `totalStallCount` vs `consecutiveStallRounds` 역할 분리 한 줄 추가 — **적용**.
- #6/2-C(ai-agent Rationale 신설): ai-agent.md 에 `## Rationale` 섹션 부재 → 단일 memo 위해 섹션 신설은 doc-sync 범위 초과 → **2-C 스킵**. 2-A(frontmatter)+2-B(classifyToolCalls 참조)로 M-1 충분 문서화.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 상수명/리터럴 혼용(W2, 1-D 단순화로 회피), M-1 인접 파일 미갱신(W3, 0-common 동반+잔여 후속) |
| Rationale Continuity | LOW | 모든 편집 기각 대안 재도입 없음. 1-D 는 Rationale §5 결정과 정합 |
| Convention Compliance | LOW | draft frontmatter `started`·`owner` 누락(W1, 적용) |
| Plan Coherence | NONE | 선행 plan 직접 모순 없음 |
| Naming Collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치사항 (처리 반영)

1. (적용) draft frontmatter `started: 2026-06-24`·`owner` 추가.
2. (회피) 1-D 단순화 — finishBlockCount bullet 삭제만, MAX_REVIEW_ROUNDS 심볼 미도입.
3. (부분적용) 0-common.md frontmatter 에 M-1 collaborator 3종 동반 등재. data-hydration-surfaces·13-agent-memory prose anchor 는 handler facade 유효라 후속.
4. (별건 플래그) system-prompt.ts:382 Self-review skip drift → developer PR.
5. (적용) §7 의사코드 카운터 역할 한 줄 보완.
6. (스킵) 2-C ai-agent Rationale 신설 — 섹션 부재, 범위 초과.
