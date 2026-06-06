# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/embedding-model-ux.md` (worktree: embedding-model-ux-c40698)
검토 범위: P6 임베딩 모델 UX 보강 — Phase A(inputType 시그니처 확장), Phase B(한국어 추천 배지), Phase C(모델 변경 경고 spec 갱신)

---

## 발견사항

### [WARNING] LLMClient.embed 시그니처 확장이 spec/5-system/7-llm-client.md §3.3 과 동기화되지 않을 위험

- **target 위치**: plan §2 Phase A — `interfaces/llm-client.interface.ts` 에 `embed(texts, model?, inputType?: 'query'|'document')` 시그니처 확장 예정
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md §3.3` — `embed(texts: string[], model?: string): Promise<number[][]>` 를 현행 권위 시그니처로 기술. 내부 참고문에 "EmbedResponse 형태는 현재 미구현(Planned)" 만 언급하며 `inputType` 파라미터는 기술 없음
- **상세**: plan은 spec 갱신 대상으로 `8-embedding-pipeline.md §5` 만 명시(Phase A 마지막 항목). 그러나 `7-llm-client.md §3.3` 은 `embed` 인터페이스의 공식 계약 문서로, 시그니처가 변경되면 반드시 함께 갱신해야 한다. 현재 plan 의 spec 갱신 목록에 `7-llm-client.md` 가 누락되어 있다.
- **제안**: plan Phase A 의 "spec 갱신" 항목에 `spec/5-system/7-llm-client.md §3.3` 을 추가. `embed` 시그니처 블록과 §3.3 설명 문단을 `inputType?: 'query' | 'document'` 를 포함하도록 갱신.

---

### [WARNING] AgentMemory 임베딩 경로가 inputType 을 중복 구현하거나 EmbeddingService 를 우회할 위험

- **target 위치**: plan §2 Phase A 호출부 — `agent-memory/agent-memory.service.ts:421` (document), `:896` (query)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/17-agent-memory.md §3 임베딩 출처` — "임베딩 차원·모델은 KB 인프라(`EmbeddingService`)를 재사용한다 — embedding 생성·차원 관리 로직을 중복 구현하지 않는다"
- **상세**: `17-agent-memory.md §3` 는 AgentMemory 가 `EmbeddingService` 재사용을 의무화한다. plan 이 `embedding-input-type.ts` 에 순수함수 전략 로직을 두고 각 호출부가 직접 `resolveEmbeddingInputStrategy + applyInputType` 을 호출하는 경우, `EmbeddingService` 를 우회해 중복 구현이 발생한다. plan 의 "llm.service.ts:194 — inputType 전달 패스스루" 가 올바른 단일 경로이나, AgentMemory 경로가 `EmbeddingService` → `LlmService.embed()` 계층을 일관되게 타는지 spec 갱신 시 명시 필요.
- **제안**: Phase A 작업 시 AgentMemory 경로가 `EmbeddingService → LlmService.embed(texts, model, inputType)` 를 통해 단일 계층을 유지하는지 확인. spec 갱신 목록에 `spec/5-system/17-agent-memory.md §3 임베딩 출처` 를 추가하고 inputType 전달 경로를 한 줄로 명시.

---

### [WARNING] 기존 AgentMemory row 의 query-document 비대칭 문제가 spec/5-system/17-agent-memory.md §4 의 "같은 모델 출처" 요건과 충돌

- **target 위치**: plan §1 D-P6-3·D-P6-4 — `agent-memory.service.ts:896` (recall) 에 `inputType: 'query'` 명시, "e5/gemini 계열 사용 KB/메모리는 재임베딩 권고"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/17-agent-memory.md §4 회수` — "회수 쿼리 임베딩은 추출(저장)과 **같은 임베딩 모델 출처** 를 써 차원이 일치해야 한다"
- **상세**: spec §4 는 recall 과 store 의 모델 일치만 요구한다. plan 변경 후 같은 모델이더라도 `inputType` 이 달라지면(store 는 `'document'` no-prefix, recall 은 `'query'` prefix) 기존 색인된 메모리와 비대칭이 발생한다. 이는 "같은 모델 출처" 요건을 암묵적으로 위반한다. plan D-P6-4 가 재임베딩 권고로 대처하나 spec §4 에는 이 케이스가 기술되지 않아 spec↔구현 드리프트가 된다.
- **제안**: `spec/5-system/17-agent-memory.md §3 임베딩 출처` 및 §4 회수 절에 "회수 시 `inputType: 'query'`, 저장 시 `inputType: 'document'` 를 사용하며, inputType 배선 변경 전에 색인된 메모리는 재임베딩 전까지 비대칭 가능" 주석 추가. plan Phase A 의 spec 갱신 목록에 `17-agent-memory.md` 를 포함.

---

### [INFO] spec/5-system/8-embedding-pipeline.md §5.1 배치 처리 설명에 inputType 전달 경로 미기술

- **target 위치**: plan Phase A — `EmbeddingService` 배치 처리 경로에서 `inputType: 'document'` 로 호출
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/8-embedding-pipeline.md §5.1` — `LLMClient.embed()` 의 `input` 에 문자열 배열을 전달한다는 기술. `inputType` 개념 미기술
- **상세**: plan 이 이 spec 갱신을 예정하므로 충돌은 아니나, §5.1 배치 처리 설명에서 provider 별 inputType 매핑(e5-prefix: local, gemini-taskType: google)을 요약 테이블로 기술하지 않으면 신규 호출부 추가 시 누락 위험이 있다.
- **제안**: `8-embedding-pipeline.md §5` 갱신 시 "provider 별 inputType 적용 매핑" 요약 테이블 추가. `embedding-input-type.ts` 파일 경로를 frontmatter `code:` 에 포함.

---

### [INFO] spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델 선택 설명에 한국어 추천 배지 미기술

- **target 위치**: plan Phase B — `embedding-model-combobox.tsx` 에 한국어 추천 배지 추가
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델 항목` — 모델 목록을 select-only 로 선택한다고 기술. 추천 배지/힌트 UI 미기술
- **상세**: 충돌은 아니나 Phase C spec 갱신 시 §2.2 임베딩 모델 항목에 "패턴 매칭 시 한국어 추천 배지 표시(비강제)" 를 추가하지 않으면 향후 spec-coverage audit 에서 드리프트로 등록될 가능성이 있다.
- **제안**: Phase B·C spec 갱신 시 `5-knowledge-base.md §2.2` 임베딩 모델 행에 배지 동작 한 줄 추가.

---

### [INFO] spec/5-system/8-embedding-pipeline.md Rationale 에 inputType 비대칭 재임베딩 케이스 미기술

- **target 위치**: plan §1 D-P6-4 — "prefix/taskType 적용 모델 사용 KB 는 재임베딩 권고"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/8-embedding-pipeline.md Rationale §결정: 다중 차원 임베딩` — 재임베딩 필요 케이스로 "embeddingModel 변경" 만 명시. `inputType` 전략 변경에 따른 기존 색인 비대칭 케이스 미기술
- **상세**: D-P6-4 는 e5/gemini 계열 모델 사용 KB 의 경우 inputType 배선 변경 후 재임베딩이 필요하다는 새로운 트리거를 도입한다. 이 결정이 Rationale 에 기술되지 않으면 나중에 같은 논리를 재발견해야 한다.
- **제안**: `8-embedding-pipeline.md Rationale` 에 "inputType/prefix 비대칭 재임베딩 필요 케이스" 항목 추가. `5-knowledge-base.md §2.3~2.4` 갱신 시 경고 문구에 이 Rationale 링크 포함.

---

## 요약

P6 임베딩 모델 UX 보강 plan 의 핵심 변경(LLMClient.embed inputType 파라미터 추가, 한국어 추천 배지, 재임베딩 경고 명문화)은 기존 spec 과 직접 모순되지 않는다. 다만 spec 갱신 목록에서 `spec/5-system/7-llm-client.md §3.3`(embed 시그니처 공식 계약) 과 `spec/5-system/17-agent-memory.md §3·§4`(임베딩 출처 및 회수 inputType) 가 누락되어 있어, 구현 완료 후 이 두 spec 이 코드와 드리프트 상태로 남게 된다. 또한 AgentMemory 경로가 `EmbeddingService → LlmService` 계층을 통해 inputType 을 투명하게 전달하는지 확인이 필요하며, `embedding-input-type.ts` 순수함수를 직접 호출해 중복 구현 경로가 생기지 않도록 주의해야 한다. Critical 차단 요인은 없으나 세 개의 WARNING 항목을 Phase A 착수 전 plan 에 반영하고 spec 갱신 목록을 보완하는 것이 권장된다.

---

## 위험도

LOW
