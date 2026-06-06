# 정식 규약 준수 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

**검토 대상 변경 파일** (origin/main 대비):
- `spec/5-system/7-llm-client.md`
- `spec/5-system/8-embedding-pipeline.md`
- `spec/5-system/9-rag-search.md`
- `spec/5-system/17-agent-memory.md`

---

## 발견사항

### [INFO] `embedding-pipeline.md` frontmatter code: 경로에 `embedding-input-type.ts` 누락
- **target 위치**: `spec/5-system/8-embedding-pipeline.md` frontmatter `code:` 섹션
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `code:` 필드는 본 spec 이 약속한 surface 의 구현 경로를 명시
- **상세**: §5.4 "비대칭 입력(input_type / prefix)" 이 새로 추가됐고, 해당 섹션에서 "매핑 SoT 는 `codebase/backend/src/modules/llm/embedding-input-type.ts`(순수함수)" 라고 직접 지칭한다. 그러나 이 파일은 `7-llm-client.md` 의 `code:` 목록에만 추가됐고 `8-embedding-pipeline.md` 에는 등재되지 않았다. §5.4 가 해당 파일을 SoT 로 지칭하므로 embedding-pipeline spec 의 구현 증거 경로에도 포함시켜야 정합하다.
- **제안**: `spec/5-system/8-embedding-pipeline.md` 의 frontmatter `code:` 에 `codebase/backend/src/modules/llm/embedding-input-type.ts` 를 추가하거나, §5.4 의 SoT 문구를 `7-llm-client.md` 단독으로 단일화해 embedding-pipeline 의 구현 경로 책임을 명확히 분리한다. 현재도 `spec-frontmatter-parse.spec.ts` 가드 통과에는 영향 없으나, 사람이 spec ↔ code 추적 시 §5.4 진술과 frontmatter 사이에 불일치가 발생한다.

---

### [INFO] `LlmService.embed` 서비스 시그니처와 `LLMClient.embed` 의 매개변수 순서 불일치 — 명시 경고 부재
- **target 위치**: `spec/5-system/7-llm-client.md §8.3` 서비스-레이어 시그니처 블록
- **위반 규약**: 직접 규약 위반 없음 — 설계 의도가 Rationale 에 명시돼 있으나 §8.3 시그니처 JSDoc 에 경고가 없어 호출부 혼동 가능
- **상세**: `LLMClient.embed(texts, model?, inputType?)` 는 3인자 순서이고, `LlmService.embed(config, texts, model?, opts?, inputType?)` 는 `config`/`opts` 삽입으로 `inputType` 이 5번째 위치 인자다. 이 설계는 Rationale 에 명시됐으나 §8.3 주석에 경고가 없어 서비스 계층 호출부를 작성할 때 `LLMClient.embed` 시그니처를 참조한 뒤 인자 순서를 잘못 맞출 위험이 있다.
- **제안**: §8.3 의 `embed` 시그니처 블록 주석에 "LLMClient 인터페이스(§3.3)와 인자 순서가 다름: config/opts 삽입으로 inputType 이 5번째 위치" 한 줄 추가. 규약 자체 변경 불필요.

---

### [INFO] `spec/5-system/8-embedding-pipeline.md §5.4` — 본문과 Rationale 간 내용 중복
- **target 위치**: `spec/5-system/8-embedding-pipeline.md §5.4 비대칭 입력` 본문 내 "**정합성**" 불릿 및 Rationale `### 결정: 비대칭 입력(input_type / prefix) 배선`
- **위반 규약**: CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 권장 구조
- **상세**: §5.4 본문 불릿 "**정합성**: prefix/taskType 도입 이전에 색인된 기존 KB 는 document 가 무접두사로 임베딩돼 있다 — 재임베딩이 필요하다" 와 `## Rationale` 의 "결정: 비대칭 입력" 항목 "**재임베딩 정합성**" 이 동일 내용을 이중으로 기재하고 있다. Rationale 섹션 자체는 규약에 맞게 존재하고 있으므로 위반보다는 중복 문제다.
- **제안**: §5.4 본문의 "**정합성**" 인라인 불릿은 제거하거나 "→ 상세: §Rationale 결정 참조" 한 줄로 대체하고, 상세 근거는 `## Rationale` 항목에 위임. 현 상태 유지도 허용 수준(INFO).

---

## 요약

이번 PR 에서 변경된 4개 spec 파일(`7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `17-agent-memory.md`)은 정식 규약을 전반적으로 잘 준수하고 있다. 모든 파일의 frontmatter `id`/`status`/`code`/`pending_plans` 필드가 올바르게 채워져 있고, `pending_plans` 가 참조하는 plan 파일(`rag-rerank-followup.md`, `ai-context-memory-followup-v2.md`)도 실존한다. 신규 에러 코드는 없어 `UPPER_SNAKE_CASE` 위반 없음. Rationale 섹션에 결정 근거를 추가한 방식도 규약에 부합한다. API 응답 봉투(`{ data: ... }`) 관련 신규 패턴이 없어 `node-output.md`/`swagger.md` 위반 없음. 발견된 3건은 모두 INFO 수준의 일관성 제안이며, 채택을 강제하지 않는다.

## 위험도

NONE
