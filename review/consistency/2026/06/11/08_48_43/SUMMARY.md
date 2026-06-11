# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 모든 변경이 spec 정합 복원 방향. 유일 주의 사항은 병렬 worktree 간 동일 파일 수정(훈크 비겹침, 자동 merge 가능)과 Swagger description 길이 soft limit 초과(2건, 비차단 INFO).

## Critical 위배 (BLOCK 사유)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `unified-model-mgmt-5af7ee` 활성 worktree와 동일 DTO 파일 병렬 수정 | `create-knowledge-base.dto.ts` (L151, L193), `update-knowledge-base.dto.ts` (L136–175) — 리랭킹 섹션 | `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`, 임베딩 섹션 수정 중) | 훈크 비겹침(임베딩 vs 리랭킹)으로 git merge 자동 해결 가능. 어느 쪽이 먼저 main 합류하든 나머지 브랜치는 rebase 후 머지. 특별 조정 불필요하나 PR 순서 인지 권장. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `rerankMode` description 201자 — Swagger §3 권장 10~40자 soft limit 초과 | `create-knowledge-base.dto.ts` L154 `@ApiPropertyOptional description` | description 을 역할 요약 1~2문장으로 단축, 세부 동작 설명은 JSDoc 주석으로 이전. hard limit 아님, 비차단. |
| 2 | convention_compliance | `topK` description 104자 — Swagger §3 권장 10~40자 soft limit 초과 | `rag-search.dto.ts` L38 `@ApiPropertyOptional description` | "반환할 최대 유사 청크 개수(inject-cap 상한). 미지정 시 token-budget 동적 컷이 최종 주입 수를 결정." 수준으로 단축 가능. 비차단. |
| 3 | cross_spec | `topK @IsInt` 변경 — spec `top_k` "type: integer" 정의와 정합 확인 | `rag-search.dto.ts` | `spec/5-system/9-rag-search.md` §2.1 | 정합 완료. 추가 조치 불필요. |
| 4 | cross_spec | `default: 5` 제거 — spec §3.4 D1 동적 컷 도입에 따른 고정 default 폐기와 정합 | `rag-search.dto.ts` `@ApiPropertyOptional` | `spec/5-system/9-rag-search.md` §3.4 Rationale | 정합 완료. 추가 조치 불필요. |
| 5 | cross_spec | `firstMessage` → `profile` 전환 — spec §R6 폐기 결정과 정합 | `web-chat-sdk/README.md`, `byo-ui-headless.ts` | `spec/7-channel-web-chat/1-widget-app.md §R6` | 정합 완료. |
| 6 | naming_collision | `topK` 다중 레이어 사용 — 의미 일관 확인 | `rag-search.dto.ts` | `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/data-flow/6-knowledge-base.md` | 충돌 없음. 동일 "주입 청크 상한" 의미로 일관 사용. |
| 7 | plan_coherence | `rag-rerank-followup.md` `cross_encoder_llm` 완료 항목과 target 변경 정합 확인 | `create-knowledge-base.dto.ts` L39, L52 | `plan/in-progress/rag-rerank-followup.md` `[x]` 완료 체크 | 충돌 없음. |
| 8 | plan_coherence | `webchat-eager-start.md` backlog "SDK firstMessage 잔재" 해소 표시 정합 | `plan/in-progress/webchat-eager-start.md` strikethrough 처리 | `packages/web-chat-sdk/README.md`, `byo-ui-headless.ts` 실제 제거 | plan lifecycle 정합. |
| 9 | plan_coherence | `spec-code-cross-audit-2026-06-10.md` V-16/V-17 해소 기록 정합 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | V-16(KB DTO Swagger stale 문자열), V-17(web-chat-sdk firstMessage 폐기 패턴) | 잔여 항목 `[ ]` 유지 확인. 후속 항목 누락 없음. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 전 항목 spec 정합 복원. 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 관점 모두 충돌 없음. |
| rationale_continuity | NONE | 모든 변경이 기존 합의 Rationale(D1 동적 컷, conditional escalate, §R6 firstMessage 폐기)의 지연 반영. 기각된 대안 재도입·합의 원칙 위반 없음. |
| convention_compliance | LOW | JSDoc 필수·한국어 설명·`@ApiPropertyOptional` 패턴 준수. `rerankMode`(201자)·`topK`(104자) description이 §3 soft limit(10~40자) 초과. 비차단 INFO. |
| plan_coherence | LOW | `unified-model-mgmt-5af7ee` 활성 worktree와 동일 파일 병렬 수정(훈크 비겹침, 자동 merge 가능). 나머지 plan 항목 모두 정합. |
| naming_collision | NONE | 신규 식별자 도입 없음. 기존 식별자(topK, profile, rerankMode 등) 문서·검증 정정만. 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 충돌 없음. |

## 권장 조치사항

1. **(INFO, 비필수)** `create-knowledge-base.dto.ts` L154 `rerankMode` description(201자)을 역할 요약 1~2문장으로 단축. 상세 설명은 JSDoc `/** ... */`에 이전.
2. **(INFO, 비필수)** `rag-search.dto.ts` L38 `topK` description(104자)을 "반환할 최대 유사 청크 개수(inject-cap 상한). 미지정 시 token-budget 동적 컷이 최종 주입 수를 결정." 수준으로 간결화.
3. **(WARNING, 인지 권장)** `rag-webchat-doc-strings`와 `unified-model-mgmt-5af7ee` 중 먼저 main에 합류하는 쪽이 정해지면, 나머지 브랜치에서 `origin/main` 최신화 후 rebase 수행. 훈크 비겹침이므로 merge conflict 없이 자동 해결 가능.