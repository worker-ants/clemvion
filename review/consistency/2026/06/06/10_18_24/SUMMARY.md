# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 진행 가능 (WARNING 항목 plan 반영 권장).

## 전체 위험도
**LOW** — 모든 checker 에서 Critical 0건. WARNING 5건(중복 통합 후), INFO 5건. 핵심 이슈는 spec 갱신 목록에서 `spec/5-system/7-llm-client.md §3.3` 누락과 `impl-exec-concurrency-cap` 브랜치와의 파일 경합 위험.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale-Continuity / Plan-Coherence (통합) | `spec/5-system/7-llm-client.md §3.3` embed 시그니처 갱신이 plan 의 spec 갱신 목록에서 누락. 구현 완료 후 코드와 spec 드리프트 확정 | `embedding-model-ux.md §2 Phase A` spec 갱신 항목 | `spec/5-system/7-llm-client.md §3.3` — 현행 `embed(texts: string[], model?: string)` 에 `inputType?` 없음 | Phase A "spec 갱신" 항목에 `spec/5-system/7-llm-client.md §3.3` 추가. 시그니처를 `embed(texts: string[], model?: string, inputType?: 'query' \| 'document'): Promise<number[][]>` 로 갱신하고 "위치 인자 확장 채택, 파라미터 객체화는 EmbedResponse 도입 시까지 보류" 를 해당 `## Rationale` 에 명시 |
| W-2 | Cross-Spec | AgentMemory 임베딩 경로가 `EmbeddingService` 를 우회해 중복 구현 발생 가능 | `agent-memory.service.ts:421/:896` (Phase A 호출부) | `spec/5-system/17-agent-memory.md §3` — "임베딩 생성·차원 관리 로직을 중복 구현하지 않는다" | Phase A 작업 시 AgentMemory 경로가 `EmbeddingService → LlmService.embed(texts, model, inputType)` 단일 계층을 유지하는지 확인. plan Phase A 의 spec 갱신 목록에 `spec/5-system/17-agent-memory.md §3` 추가 |
| W-3 | Cross-Spec | 기존 색인된 row 에 query/document `inputType` 비대칭 발생 케이스가 spec §4 미기술 — "같은 모델 출처" 요건의 암묵적 위반 | `agent-memory.service.ts:896` (recall, `inputType: 'query'`) / D-P6-4 재임베딩 권고 | `spec/5-system/17-agent-memory.md §4 회수` — 회수와 저장 시 같은 임베딩 모델 출처 사용 명시 | `17-agent-memory.md §3·§4` 를 spec 갱신 대상에 포함. §4 에 "inputType 변경 전 색인 메모리는 재임베딩 전까지 비대칭 가능" 주석 추가 |
| W-4 | Rationale-Continuity | Phase B 한국어 추천 배지가 "비강제" 로 기술되나 select-only 원칙(R-1)과의 관계 미명시 — 구현자가 자유 입력 허용으로 오독 가능 | `embedding-model-ux.md §2 Phase B` (D-P6-5) | `spec/2-navigation/5-knowledge-base.md §Rationale R-1` + `spec/2-navigation/6-config.md §Rationale R-1` — "자유 텍스트 입력 불허, select-only 강제" | plan Phase B 에 "select-only 원칙(R-1) 유지 — 배지는 기존 select 옵션 위 표시 메타데이터만 추가, 자유 입력 경로 불가" 한 줄 추가 |
| W-5 | Plan-Coherence | `impl-exec-concurrency-cap` 브랜치(active, PR 미생성)가 `agent-memory.service.ts` / `spec/2-navigation/5-knowledge-base.md` / `ko+en/knowledgeBases.ts` 를 동시 편집 중 — 두 브랜치 머지 순서에 따라 line-shift 및 merge conflict 위험 | `embedding-model-ux.md §2 Phase A`(:421/:896), `Phase B`(knowledgeBases.ts), `Phase C`(5-knowledge-base.md) | 브랜치 `claude/impl-concurrency-cap-pr2b` (물리 워크트리 `impl-exec-concurrency-cap` 확인됨) | `impl-exec-concurrency-cap` 브랜치 머지 순서 조율. 먼저 머지 후 embedding-model-ux 가 rebase 해 `agent-memory.service.ts` line ref 재확인 및 `knowledgeBases.ts` 베이스 상태 확인 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `8-embedding-pipeline.md §5.1` 에 provider 별 inputType 매핑 테이블 미기술 | `spec/5-system/8-embedding-pipeline.md §5.1` | §5 갱신 시 "provider 별 inputType 적용 매핑" 요약 테이블 추가. `embedding-input-type.ts` 를 frontmatter `code:` 에 포함 |
| I-2 | Cross-Spec | `spec/2-navigation/5-knowledge-base.md §2.2` 에 한국어 추천 배지 동작 미기술 | `spec/2-navigation/5-knowledge-base.md §2.2` | Phase B·C spec 갱신 시 §2.2 임베딩 모델 행에 "패턴 매칭 시 한국어 추천 배지 표시(비강제)" 한 줄 추가 |
| I-3 | Cross-Spec / Rationale-Continuity | `8-embedding-pipeline.md Rationale` 에 inputType 비대칭 재임베딩 케이스 미기술 | `spec/5-system/8-embedding-pipeline.md §Rationale` | "재임베딩 필요" 항에 "prefix/taskType 도입 후 기존 색인의 비대칭 발생" 케이스 보완 기술 추가 |
| I-4 | Plan-Coherence | `rag-quality-improvement.md §P6` 체크박스 갱신 단계 누락 | `embedding-model-ux.md §3 게이트 순서` | PR 머지 후 `rag-quality-improvement.md §P6` 의 3개 체크박스 `[x]` 갱신 단계 §3 게이트 순서에 추가 |
| I-5 | Naming-Collision | `inputType` 파라미터명이 프론트엔드 지역 변수와 동일 (런타임 충돌 없음, 전역 검색 노이즈) | `embed(texts, model?, inputType?)` 백엔드 시그니처 | 필수 아님. `embeddingInputType` 또는 `embedInputType` 으로 명명하면 구분 명확. `recommendedBadge` i18n 키도 `integrations` 사전과 동일 — 의미가 다르면 `koreanRecommendedBadge` 로 구체화 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 3건: `7-llm-client.md §3.3` spec 갱신 누락, AgentMemory 중복 구현 경로 가능성, inputType 비대칭 미명시 |
| Rationale-Continuity | LOW | WARNING 2건: embed 시그니처 변경 Rationale 부재(7-llm-client.md 누락과 통합), Phase B select-only R-1 관계 미명시 |
| Convention-Compliance | N/A (파일 없음 — 재시도 필요) | output_file 부재. 결과 미수신 |
| Plan-Coherence | LOW | WARNING 2건: `7-llm-client.md §3.3` 누락(W-1 통합), `impl-exec-concurrency-cap` 브랜치 파일 경합 |
| Naming-Collision | LOW | WARNING 2건: `inputType` / `recommendedBadge` 검색 노이즈 수준 (런타임 충돌 없음) |

## 권장 조치사항

1. **(W-1 우선)** `plan/in-progress/embedding-model-ux.md` Phase A "spec 갱신" 항목에 `spec/5-system/7-llm-client.md §3.3` 추가. 구현 전 plan 문서 수정으로 해소 가능.
2. **(W-2)** Phase A 작업 착수 시 AgentMemory 호출부가 `EmbeddingService → LlmService.embed()` 계층을 통해 `inputType` 을 투명하게 전달하는지 확인. `embedding-input-type.ts` 순수함수를 AgentMemory 서비스가 직접 호출하는 구조 금지.
3. **(W-3)** plan Phase A spec 갱신 목록에 `spec/5-system/17-agent-memory.md §3·§4` 추가. `inputType` 비대칭 케이스 주석 기술.
4. **(W-4)** plan Phase B 항목에 select-only R-1 원칙 유지 명시 한 줄 추가.
5. **(W-5)** `impl-exec-concurrency-cap` 브랜치와 머지 순서 조율 후 착수. 먼저 `impl-concurrency-cap-pr2b` PR 생성·머지 → embedding-model-ux rebase 순서 권장.
6. **(INFO)** Convention-Compliance checker 결과 파일이 없음 (output_file 부재). 필요 시 해당 checker 단독 재실행.
7. **(INFO)** `rag-eval-harness-b8cc46` / `rag-eval-plan-hygiene-279c3e` 물리 워크트리 잔존 — `cleanup-worktree-all.sh --yes --force` 로 정리 권장.
