# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — active worktree `impl-exec-concurrency-cap` 이 동일 spec 파일 3건을 병렬 수정 중이며, 머지 시 충돌 및 이미 완료된 구현 상태의 역행(regression) 위험

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | active worktree `impl-exec-concurrency-cap` 이 `spec/5-system/17-agent-memory.md` 를 39줄 병렬 수정 중 — 머지 시 충돌 및 상호 누락 위험 | `spec/5-system/17-agent-memory.md` §4 비대칭 inputType 블록 | `plan/in-progress/exec-intake-queue-impl.md` + `plan/in-progress/spec-update-pr2a-active-running-invariants.md` (worktree `impl-exec-concurrency-cap`) | target 을 먼저 머지 후 `impl-exec-concurrency-cap` 가 rebase 해 충돌 해소. 직렬화 필수 |
| 2 | Plan Coherence | active worktree `impl-exec-concurrency-cap` 이 `spec/5-system/9-rag-search.md` 를 25줄 병렬 수정 중 — `cross_encoder_llm` 구현 상태를 "구현됨"→"후속"으로 역행시키는 콘텐츠 regression 포함 | `spec/5-system/9-rag-search.md` §2.2 inputType:'query' 추가 | `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`) — PR #466/#478 에서 완료 처리된 상태를 stale 스냅샷이 "Planned"/"후속"으로 되돌림 | target 먼저 머지 후 `impl-exec-concurrency-cap` 브랜치의 `9-rag-search.md` 변경을 현재 main 기준으로 재정합화 |
| 3 | Plan Coherence | active worktree `impl-exec-concurrency-cap` 이 `spec/2-navigation/5-knowledge-base.md` 를 병렬 수정 중 — 리랭킹 행을 "구현됨"→"(Planned)" 으로 역행 | `spec/2-navigation/5-knowledge-base.md` §2.2 임베딩 모델 행 + 재임베딩 경고 문단 추가 | `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`) — `rag-rerank-followup.md` 완료(#478) 대비 stale 기준 역행 | `impl-exec-concurrency-cap` 브랜치의 `5-knowledge-base.md` 변경이 stale 기준(PR2b 착수 전 스냅샷)에서 온 것인지 확인 후 rebase 시 정합화 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `LLMClient.embed` 의 "평탄한 시그니처" 원칙 적용 — `LlmService.embed` 5-인자 시그니처에서 `opts=undefined` skip DX 비용이 Rationale 에 미문서화 | `spec/5-system/7-llm-client.md` §3.3, §8.3 Rationale | `spec/5-system/7-llm-client.md` §3.3 본문 "평탄한 시그니처" invariant | `7-llm-client.md §8.3` Rationale 에 `embed(config, texts, model, undefined, 'query')` 형태의 `opts` skip 필요성을 명시적 trade-off 로 추가 |
| 2 | Convention Compliance | `8-embedding-pipeline.md` 섹션 헤딩에 `input_type` (snake_case) 사용 — 본문·코드(`inputType` camelCase) 와 혼재 | `spec/5-system/8-embedding-pipeline.md` L131 (`### 5.4 비대칭 입력 (input_type / prefix)`), L365 (`### 결정: 비대칭 입력(input_type / prefix) 배선`) | `spec/5-system/7-llm-client.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/17-agent-memory.md`, `embedding-input-type.ts` (모두 camelCase `inputType`) | 두 헤딩을 `(inputType / prefix)` 로 수정 |
| 3 | Plan Coherence | `plan/in-progress/rag-quality-improvement.md §P6` 의 완료 항목 3건이 체크박스 `[ ]` 미갱신 | `spec/5-system/8-embedding-pipeline.md §5.4`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/9-rag-search.md` | `plan/in-progress/rag-quality-improvement.md §P6` — "모델 선택 UI 추천", "input_type 자동 배선", "spec 갱신" 3항목 | target 머지 후 해당 3항목을 `[x]` 로 갱신 |
| 4 | Plan Coherence | `plan/complete/rag-eval-harness.md` 가 이미 complete 임에도 stale worktree `rag-eval-harness-b8cc46` 가 `9-rag-search.md` frontmatter 에 `plan/in-progress/rag-eval-harness.md` 를 추가하는 변경 잔류 | `spec/5-system/9-rag-search.md` frontmatter | `rag-eval-harness-b8cc46` (PR #488 MERGED, stale) | cleanup-worktree-all.sh 로 stale worktree 정리, target 머지 시 해당 변경 미적용 확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `data-flow/6-knowledge-base.md` 시퀀스 다이어그램의 `embed()` 호출 표기에 `inputType` 미반영 | `spec/data-flow/6-knowledge-base.md` L73, L117 | `(inputType:'document')` / `(inputType:'query')` 주석 추가 권장 (필수 아님) |
| 2 | Cross-Spec | `information-extractor.md §7.1` recall 경로에 `inputType:'query'` 가시성 부재 | `spec/4-nodes/3-ai/3-information-extractor.md §7.1` | "회수 시 `inputType:'query'` — [Spec Agent Memory §4 참조]" 한 줄 추가 권장 |
| 3 | Cross-Spec | `17-agent-memory.md §4` 의 `embed()` 표현이 시그니처 형식으로, `undefined` 명시 필요성 미노출 | `spec/5-system/17-agent-memory.md §4` | `embed(config, texts, model, undefined, 'query')` 호출 예시로 보완 또는 `7-llm-client.md §8.3` 크로스링크 |
| 4 | Cross-Spec | `5-knowledge-base.md §2.2` 변경 경고 블록 → `6-config.md §R-1` 역참조 단방향 | `spec/2-navigation/5-knowledge-base.md §2.2` | `6-config.md §R-1` 링크 추가 권장 (선택) |
| 5 | Rationale Continuity | `8-embedding-pipeline.md §5.4` 신규 결정 — 과거 기각 대안 없음, Rationale 정상 | `spec/5-system/8-embedding-pipeline.md §5.4` | 조치 불필요 |
| 6 | Rationale Continuity | `17-agent-memory.md` 비대칭 배선 추가 — agent memory 재임베딩 부재 trade-off 미문서화 | `spec/5-system/17-agent-memory.md` Rationale | Rationale 에 "일괄 재임베딩 경로 없음" 한 줄 추가 권장 |
| 7 | Convention Compliance | `7-llm-client.md §3.3` 의 `8-embedding-pipeline.md §5` 참조가 서브섹션 번호 누락 (`§5.4` 가 실제 SoT) | `spec/5-system/7-llm-client.md` L147 | `§5` → `§5.4` 로 수정 권장 |
| 8 | Convention Compliance | `8-embedding-pipeline.md` 의 `## Overview` 섹션 부재 (기존 상태, 이번 변경이 추가한 위반 아님) | `spec/5-system/8-embedding-pipeline.md` | 별도 spec 정비 turn 에서 `## Overview` 추가 검토 |
| 9 | Naming Collision | `input_type` 텍스트가 Cafe24 API 카탈로그 동명 필드와 텍스트 중복 — 도메인 완전 격리로 실제 충돌 없음 | `spec/5-system/8-embedding-pipeline.md §5.4` 섹션 제목 | 충돌 없음, 변경 불필요 |
| 10 | Naming Collision | `§5.4` 섹션 번호가 plan 파일의 타 spec `§5.4` 레퍼런스와 텍스트 중복 — 대상 파일이 달라 실제 오염 없음 | `spec/5-system/8-embedding-pipeline.md §5.4` | 이슈 없음 |
| 11 | Plan Coherence | `rag-quality-proposal-0c618c` 브랜치가 0 unique commits 상태 (main HEAD 동일) — stale 또는 미착수 | `plan/in-progress/rag-quality-improvement.md` | `(unstarted)` sentinel 로 정규화 또는 worktree 정리 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 4건 모두 INFO — `data-flow` 다이어그램·IE spec inputType 미반영 동기화 권장 |
| Rationale Continuity | LOW | WARNING 1건 — `LlmService.embed` 5-인자 opts skip DX 비용 미문서화 |
| Convention Compliance | LOW | WARNING 1건 — `8-embedding-pipeline.md` 헤딩 `input_type` vs `inputType` 혼재 |
| Plan Coherence | CRITICAL | CRITICAL 3건 — `impl-exec-concurrency-cap` 동일 파일 3건 병렬 수정, 리랭킹 상태 역행 regression |
| Naming Collision | NONE | 2건 모두 INFO — Cafe24 `input_type` 및 `§5.4` 번호 중복 없음 |

## 권장 조치사항

1. **(BLOCK 해소 최우선)** target worktree(`embedding-model-ux-c40698`)를 먼저 main 에 머지하고, `impl-exec-concurrency-cap` 브랜치(`claude/impl-concurrency-cap-pr2b`)가 그 위에서 rebase 해 `17-agent-memory.md` / `9-rag-search.md` / `5-knowledge-base.md` 충돌을 해소.
2. **(BLOCK 해소)** `impl-exec-concurrency-cap` 의 `9-rag-search.md` 변경이 PR #466/#478 완료 상태를 "후속"/"Planned"로 역행시키는지 확인 후 stale 내용 제거 또는 재정합화.
3. **(WARNING 해소)** `spec/5-system/8-embedding-pipeline.md` L131, L365 헤딩의 `input_type` → `inputType` 수정.
4. **(WARNING 해소)** `spec/5-system/7-llm-client.md §8.3` Rationale 에 `embed(config, texts, model, undefined, 'query')` `opts` skip DX 비용을 명시적 trade-off 로 추가.
5. **(WARNING 해소)** target 머지 후 `plan/in-progress/rag-quality-improvement.md §P6` 의 3개 항목 `[x]` 완료 처리.
6. **(후처리)** stale worktree `rag-eval-harness-b8cc46` cleanup (`cleanup-worktree-all.sh --yes --force`).
7. **(선택)** `rag-quality-proposal-0c618c` worktree 를 `(unstarted)` sentinel 로 정규화.