---
worktree: embedding-model-ux-c40698
started: 2026-06-06
owner: 사용자 본인 / developer
spec_impact: [spec/5-system/8-embedding-pipeline.md, spec/2-navigation/5-knowledge-base.md]
---
# P6 — 임베딩 모델 UX 보강 (RAG 개선 로드맵 독립 백로그)

> 상위 로드맵: [`rag-quality-improvement.md §P6`](./rag-quality-improvement.md). P6 은 의존 그래프상 유일 독립(평가셋·재임베딩 사이클·배포환경 결정과 무관).
> 본 plan 은 3개 항목 전부 진행. 단 사전 코드 검토(2026-06-06)로 **②는 이미 구현됨** → 검증+spec 갭 메움으로 축소, 실작업은 ①·③.

## 참조 spec
- [`spec/5-system/8-embedding-pipeline.md`](../../spec/5-system/8-embedding-pipeline.md) — status: implemented. §5 임베딩 생성에 input_type/prefix **미기술**. §7.3 재임베딩 기술됨.
- [`spec/2-navigation/5-knowledge-base.md`](../../spec/2-navigation/5-knowledge-base.md) — status: implemented. §2.2 모델 선택 UI 기술. §2.3~2.4 재임베딩 상태 표시 부분 기술이나 "모델 변경 경고" 미기술.

> **진행 (2026-06-06)**: consistency-check `--impl-prep` BLOCK:NO (WARNING 5건 plan 반영). Phase A(③ inputType 배선)·B(① 한국어 추천 배지)·C(spec 갱신 + ② 검증) 구현 완료. 핵심 모듈 `embedding-input-type.ts` 를 **llm 모듈로 배치**(결합 방향: knowledge-base→llm 유지). 단위테스트: backend 영향 모듈 567/567, frontend recommendation 14/14. tsc backend(수정 소스 클린)·frontend(0 에러). spec 4종 갱신(7-llm-client §3.3, 8-embedding-pipeline §5.4+Rationale, 17-agent-memory §4, 5-knowledge-base §2.2). 다음: `/ai-review` → fix.

## 사전 검토 결과 (2026-06-06)

**provider**: openai / azure-openai(openai 상속) / google / anthropic(embed throw) / local(openai 상속). **voyage·cohere client 없음** → ③ 대상 제외(provider 신규 추가는 별도 작업).

**embed 체인**: `LLMClient.embed(texts, model?)` (`interfaces/llm-client.interface.ts:125`) → `LlmService.embed(config, texts, model?, opts?)` (`llm.service.ts:194`). client: openai(`openai.client.ts:197`), google(`google.client.ts:542`).

**호출부 7곳** (query/document 구분 없이 동일 함수 공유):
| 파일:줄 | 경로 | inputType |
| --- | --- | --- |
| `embedding/embedding.service.ts:231` | 문서 청크 적재 | document |
| `agent-memory/agent-memory.service.ts:421` | 메모리 저장 | document |
| `knowledge-base.service.ts:204` | probe(차원 감지) | document(중립) |
| `search/rag-search.service.ts:373` | 검색 query | query |
| `search/rag-search.service.ts:443` | 검색 query(보조) | query |
| `agent-memory/agent-memory.service.ts:896` | 메모리 recall query | query |

## 1. 결정

- **D-P6-1. ③ 대상 provider = 현존 client 한정**: openai(native text-embedding-3 = 대칭, no-op) / google(Gemini `taskType` RETRIEVAL_QUERY·RETRIEVAL_DOCUMENT — **현재 미사용 = 숨은 손실**) / local·openai-compat(self-host e5·bge·gte 등 → text prefix). voyage/cohere 는 provider 부재로 OUT.
- **D-P6-2. 모델→입력처리 매핑은 패턴 기반 순수함수**: `embedding-input-type.ts` 에 모델 ID 패턴 → 처리 전략(`none` | `e5-prefix` | `gemini-tasktype`) 테이블. 결정적·단위테스트 게이트화. 미매칭 모델 = `none`(안전 기본값, 기존 동작 보존).
- **D-P6-3. inputType 시그니처 확장**: `embed(texts, model?, inputType?: 'query'|'document')`. 기본값 `'document'`(기존 적재 동작 = passage, 하위호환). query 경로만 명시적으로 `'query'` 전달.
- **D-P6-4. 정합성 = prefix 도입은 재임베딩 전제**: prefix/taskType 적용 모델로 색인된 기존 KB 는 passage 가 prefix 없이 임베딩됨 → query 에만 prefix 붙이면 비대칭 발생. 따라서 e5/gemini 계열 사용 KB 는 본 변경 후 재임베딩 권고. ②의 기존 재임베딩 플로우 재사용(신규 트리거 불필요), 경고 문구에 "비대칭 입력 모델 배선 변경" 케이스 추가 검토. **신규 임베딩부터는 양쪽 일관 적용되므로 silent bug 차단.**
- **D-P6-5. ① 추천 프리셋 = 동적 목록 위 메타 오버레이**: 카탈로그가 listModels 동적이라 고정 enum 프리셋 불가. 한국어 추천 모델 패턴(예: multilingual-e5, bge-m3, text-embedding-3) 매칭 시 combobox 에 "한국어 추천" 배지/힌트. 비강제(선택 자유).

## 2. 작업 항목

### Phase A — ③ input_type/prefix 배선 (백엔드, developer) ⭐ 핵심
- [ ] `embedding/embedding-input-type.ts` — 모델 패턴 → 전략 순수함수 `resolveEmbeddingInputStrategy(model)` + `applyInputType(texts, strategy, inputType)`(e5 prefix 적용) / gemini taskType 매핑 헬퍼.
- [ ] `embedding-input-type.spec.ts` — 패턴 매칭·prefix 적용·미매칭 기본값(none)·대소문자·경계 단위테스트.
- [ ] `interfaces/llm-client.interface.ts` — `embed(texts, model?, inputType?)` 시그니처 확장.
- [ ] `clients/openai.client.ts` — local/openai-compat 모델이면 e5-prefix 적용(OpenAI native 는 no-op). azure/local 상속 자동 반영.
- [ ] `clients/google.client.ts` — Gemini `taskType` 배선(query→RETRIEVAL_QUERY, document→RETRIEVAL_DOCUMENT).
- [ ] `clients/anthropic.client.ts` — 시그니처만 맞춤(throw 유지).
- [ ] `llm.service.ts:194` — `embed` 에 inputType 전달 패스스루.
- [ ] 호출부 inputType 명시: rag-search 373/443 + agent-memory 896 = `'query'`. embedding.service 231 + agent-memory 421 = `'document'`. probe 204 = `'document'`.
- [ ] **W-2: AgentMemory 계층 준수** — agent-memory 호출부는 `LlmService.embed(texts, model, inputType)` 단일 계층으로 inputType 투명 전달. `embedding-input-type.ts` 순수함수를 agent-memory 서비스가 **직접 호출 금지**(중복 구현 방지, `17-agent-memory.md §3`).
- [ ] **spec 갱신**(project-planner+consistency-check --spec):
  - `8-embedding-pipeline.md §5` — input_type/prefix 비대칭 입력 처리·provider별 매핑 테이블(I-1)·재임베딩 정합성. frontmatter `code:` 에 `embedding-input-type.ts` 추가. Rationale 에 비대칭 재임베딩 케이스(I-3).
  - **W-1: `spec/5-system/7-llm-client.md §3.3`** — embed 시그니처 SoT(line 72 interface + 245/255/266 provider 표). `embed(texts, model?, inputType?: 'query'|'document')` 로 갱신. Rationale 에 "위치 인자 확장 채택, 파라미터 객체화는 EmbedResponse 도입 시까지 보류".
  - **W-2/W-3: `spec/5-system/17-agent-memory.md §3·§4`** — §3 임베딩 중복 구현 금지 계층 명시, §4 회수에 "inputType 변경 전 색인 메모리는 재임베딩 전까지 비대칭 가능" 주석.

### Phase B — ① 한국어 추천 프리셋/힌트 (프론트, developer)
- [ ] **W-4: select-only(R-1) 원칙 유지** — 배지는 기존 select 옵션 위 표시 메타데이터만 추가, **자유 입력 경로 불가**(`5-knowledge-base.md §Rationale R-1`).
- [ ] `components/knowledge-base/embedding-model-combobox.tsx` — 한국어 추천 모델 패턴 매칭 시 배지/힌트.
- [ ] i18n KO/EN (`dict/{ko,en}/knowledgeBases.ts`) — 추천 배지·힌트 문구. (I-5: 키명 `koreanRecommendedBadge` 등 구체화로 `integrations` 사전과 구분).
- [ ] (선택) 추천 패턴 상수 공유 위치 정리.
- [ ] **spec 갱신(I-2)**: `2-navigation/5-knowledge-base.md §2.2` 임베딩 모델 행에 "패턴 매칭 시 한국어 추천 배지 표시(비강제)" 한 줄.

### Phase C — ② 재임베딩 경고+진행률 (검증 + spec 갭)
- [ ] 기존 구현 동작 검증(모달·진행률·경고). 코드 변경 최소.
- [ ] D-P6-4 비대칭 모델 배선 변경 시 재임베딩 권고 문구 추가 검토(i18n).
- [ ] **spec 갱신**: `2-navigation/5-knowledge-base.md §2.3~2.4` 에 "모델 변경 경고" 명문화.

## 3. 게이트 순서
1. [ ] `/consistency-check --impl-prep` (BLOCK:NO 확인).
2. [ ] Phase A 구현 + 단위테스트 green.
3. [ ] Phase B·C 구현.
4. [ ] spec 갱신 (consistency-check --spec).
5. [ ] `/ai-review` → Critical/Warning fix.
6. [ ] e2e/unit 회귀 확인.
7. [ ] **W-5: 머지 순서** — `impl-concurrency-cap-pr2b` 브랜치와 `agent-memory.service.ts`/`knowledgeBases.ts`/`5-knowledge-base.md` 가법적 경합. 어느 쪽이 먼저 머지되든 rebase 로 흡수(충돌 사소). concurrency-cap 머지 임박 시 순서 양보.
8. [ ] **I-4: PR 머지 후** `rag-quality-improvement.md §P6` 3개 체크박스 `[x]` 갱신.

## 4. 미해결 / 사용자 확인 포인트
- D-P6-4 기존 KB 재임베딩 권고를 자동 트리거할지(현 ② 수동 버튼 재사용) vs 안내만 — 기본은 안내(자동 재임베딩 비용 우려). 사용자 확인 가능.
- ① 한국어 추천 모델 패턴 화이트리스트 구체 목록(multilingual-e5/bge-m3/text-embedding-3 외 추가?) — 보수적 시작.
