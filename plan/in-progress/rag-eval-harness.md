---
worktree: rag-eval-harness-b8cc46
started: 2026-06-06
owner: 사용자 본인 / developer
---
# RAG 평가 하베스 — P0 Phase 0+1 first cut (자동 합성 위주)

> 상위 로드맵: [`rag-quality-improvement.md §P0`](./rag-quality-improvement.md). 본 plan 은 그 P0 의 **부분집합** — "**자동 합성 골든셋 + 순수-TS 검색지표**" 두 항목만 "①자동 합성 + ③SME 최소" 방향으로 좁혀 1차 구현한다. P0 의 나머지(LLM-judge·autoevals·phoenix·agentic·온라인루프)는 본 범위 OUT, 상위 P0 체크리스트에서 별도 미착수로 유지. 완료 시 상위 P0 체크박스는 해당 2항목만 분리 갱신.
> 결정 근거(D1~D7, 한국어 judge κ≈0.3): 상위 plan §2·§5.

## 참조 spec
- [`spec/5-system/9-rag-search.md`](../../spec/5-system/9-rag-search.md) — 검색 흐름. Phase B 에서 `rag-evaluation.md` 링크 1줄 + `pending_plans:` 등재 검토.
- `spec/conventions/rag-evaluation.md` — **신규(Phase B 에서 생성)**. 예상 frontmatter: `id: rag-evaluation`, `status: implemented`, `code: codebase/backend/src/modules/knowledge-base/eval/**` (SoT: `spec/conventions/spec-impl-evidence.md §1~§3`).

> **진행 (2026-06-06)**: Phase A(코드)·B(spec) 구현 완료 — eval 모듈/스크립트/지표·단위테스트 20/20, EvalCliModule 부팅 스모크 통과, app.module `ROOT_ENTITIES` 전용 파일 분리(app.module.spec 회귀 없음), 신규 `spec/conventions/rag-evaluation.md`. consistency-check `--impl-prep` BLOCK:NO. 다음: `/ai-review` → fix.

## 0. 범위 확정 (이번 PR)

**IN**
- ① **자동 합성 골든셋 generator** — KB 의 `document_chunk` 에서 LLM 으로 (query·reference answer) 생성, **source chunk = gold label**(역방향 생성). `source:'synthetic'`, `reviewed:false` 태그.
- **순수-TS 검색지표** Recall@k / Precision@k / MRR / nDCG@k / hit-rate@k — LLM 비용 0, 결정적 tie-break. **단위테스트로 게이트화 가능**한 핵심.
- **eval 러너** — golden.json 을 `RagSearchService.searchWithMeta()` 로 돌려 지표 산출·리포트.
- **신규 컨벤션 spec** `spec/conventions/rag-evaluation.md` — 골든셋 스키마·지표 정의·silver→gold 승격 프로세스 SoT.

**OUT (후속)**
- ③ SME 검수 UI/툴 — 이번엔 `reviewed:false` 플래그 + README 워크플로 안내만(수동 스팟검수).
- 생성 지표(LLM-judge, autoevals/phoenix) — Phase 2.
- agentic 지표 / 온라인 루프 / 실 CS 로그 마이닝 — Phase 3~4.
- conditional escalate 임계 튜닝(D2) — 본 하베스가 선행조건, 별도 작업.

## 1. 결정 (이번 범위)

- **D-E1. 역방향 생성 → gold label 공짜**: 청크 c 에서 질문 q 를 생성하면 c 가 q 의 gold 관련 chunk_id. 단일 청크 답변 가정 → `difficulty:'single'` 만 1차 지원. multi-hop 은 OUT.
- **D-E2. 언어**: 청크 내용 언어 감지(휴리스틱: 한글 문자 비율) → KO 청크엔 KO 질문, EN 청크엔 EN 질문. `--lang` 으로 강제 가능.
- **D-E3. LLM 경로**: 제품 자체 `LlmService.chat()` (graph-extraction 과 동일 패턴, plan-metered 아님 = 제품 런타임 LLM). 외부 harness LLM 정책과 무관(제품 코드).
- **D-E4. 결정성**: 지표 함수는 순수·결정적. 동점 score → `chunkId` 사전순 2차 정렬. 생성기는 비결정적(LLM)이라 산출물(golden.json)을 git 커밋해 고정.
- **D-E5. 산출물 위치**: 데이터 `codebase/backend/eval/golden.json`(git), 예시 `golden.example.json`(스키마 픽스처, 손작성). 코드 `src/modules/knowledge-base/eval/**`, 스크립트 `src/scripts/{generate-golden-set,eval-retrieval}.ts`.
- **D-E6. silver/gold**: 합성 entry = silver(`reviewed:false`). 게이트는 silver 로도 동작(상대 회귀 비교 목적). 절대 점수 해석 금지 — README 명시.

## 2. 작업 항목

### Phase A — 코드 (developer)
- [ ] `eval/golden-set.types.ts` — `GoldenEntry`, `GoldenSet`(meta+entries) 타입.
- [ ] `eval/retrieval-metrics.ts` — `recallAtK/precisionAtK/mrrAtK/ndcgAtK/hitRateAtK` + `evaluateRetrieval(goldenSet, retrievedByEntryId, ks)` → per-entry + macro 평균 리포트. 결정적 tie-break.
- [ ] `eval/retrieval-metrics.spec.ts` — 결정적 픽스처 단위테스트(경계: 동점, gold 0개, k>결과수, should-retrieve=false).
- [ ] `eval/lang-detect.ts`(또는 util 재사용) — 한글 비율 휴리스틱.
- [ ] `src/scripts/generate-golden-set.ts` — `NestFactory.createApplicationContext(AppModule)` 부트스트랩 → `LlmService`+DataSource. args: `--workspace-id --kb-id --sample N --lang --questions-per-chunk --out --dry-run`. 청크 샘플→LLM JSON({questions:[{question,answer}]})→golden.json 머지(entry id 안정 해시, dedup).
- [ ] `src/scripts/eval-retrieval.ts` — golden.json 로드→entry 별 `searchWithMeta`→지표 산출→리포트(stdout + `--out` json). `--fail-under` 로 CI 게이트.
- [ ] `eval/golden.example.json` — 손작성 3 entry(KO×2,EN×1) 스키마 픽스처.
- [ ] `eval/README.md` — 생성·검수·실행·해석(상대비교) 워크플로.
- [ ] `package.json` npm scripts: `eval:golden:generate`, `eval:retrieval`.

### Phase B — spec (project-planner, consistency-check --spec)
- [ ] `spec/conventions/rag-evaluation.md` 신규 — frontmatter(`id: rag-evaluation`, `status: implemented`, `code: codebase/backend/src/modules/knowledge-base/eval/**`) + `## Overview` + 본문(골든셋 스키마·지표 정의·결정성 규칙·silver→gold·해석 가이드) + `## Rationale`(D-E1~D-E6 근거).
- [ ] `spec/5-system/9-rag-search.md` 에서 1줄 링크 + `pending_plans:` 에 본 plan 등재 검토.

## 3. 게이트 순서
1. `/consistency-check --impl-prep` (BLOCK:NO 확인) — 본 plan 기준.
2. Phase A 구현 + 단위테스트 green.
3. Phase B spec 작성 (consistency-check --spec).
4. `/ai-review` → Critical/Warning fix.
5. (선택) 실 KB 로 generator 스모크: 산출 golden.json 일부 커밋 여부는 사용자 확인 후.

## 4. 미해결 / 사용자 확인 포인트
- 실제 골든셋 생성에 쓸 **workspace/KB 지정** 은 실데이터·LLM config 필요 → generator 는 빌드·테스트하되 실 산출은 사용자가 대상 KB 지정 시. 본 PR 은 코드+example 픽스처까지.
- `eval/golden.json` 실데이터를 repo 에 커밋할지(민감정보 가능성) — 기본은 example 만 커밋, 실 golden 은 사용자 결정.
