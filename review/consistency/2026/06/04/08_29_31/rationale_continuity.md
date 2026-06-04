# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/3-ai/, diff-base=origin/main)

---

## 발견사항

### 발견사항 없음 — Rationale 연속성 이상 없음

검토 대상 `spec/4-nodes/3-ai/` 의 4개 파일 (`0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`) 전반에 걸쳐 과거 Rationale 에서 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 invariant 우회가 발견되지 않았다. 주요 검토 항목별 확인 결과:

**[NONE] `conversationHistory` 재도입 여부 (§12.2 기각 결정)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1 설정 config`
- 과거 결정 출처: `1-ai-agent.md §12.2`
- 확인: `conversationHistory: 'none' | 'last_n' | 'full'` + `historyCount` 필드는 재도입 없음. `contextScope`/`contextScopeN` 으로 대체된 상태 유지.

**[NONE] `contextScope` enum 에 `auto` 확장 기각 결정 준수 (§12.9)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/4-nodes/3-ai/0-common.md §10`
- 과거 결정 출처: `1-ai-agent.md §12.9`
- 확인: `memoryStrategy` 가 별도 1급 필드로 분리되어 있으며, `contextScope` enum 에 `auto` / `summary_buffer` / `persistent` 값이 추가되지 않음. 두 축 분리 원칙 준수.

**[NONE] v1/v2 경계 번복의 근거 문서화 (§12.10)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1`, `spec/conventions/conversation-thread.md §7`
- 과거 결정 출처: `1-ai-agent.md §12.1` v1/v2 경계표, `conversation-thread.md §7 v2 로드맵`
- 확인: `token-aware cap` 과 `DB 컬럼 신설` 의 v2 유보 사항을 번복하는 `memoryTokenBudget` (token-budget 근사) 및 `agent_memory` 별도 테이블 도입에 대해 `§12.10` 에서 명시적 근거와 함께 번복을 정식 선언. Rationale 없는 무근거 번복 아님. `conversation-thread.md §7` v2 로드맵도 "부분 실현" 으로 갱신됨.

**[NONE] 요약/추출 전용 저비용 모델 필드 기각 결정 준수 (§12.12)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1 설정 config`
- 과거 결정 출처: `1-ai-agent.md §12.12`
- 확인: `summaryModel` / `extractionModel` 등 별도 전용 모델 필드가 존재하지 않음. 노드 `model`/`llmConfigId` 재사용 원칙 준수. v2 로드맵으로 명시 유보.

**[NONE] 별도 벡터DB 기각 결정 준수 (`agent-memory` Rationale)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1 memoryTopK`, `spec/5-system/17-agent-memory.md`
- 과거 결정 출처: `17-agent-memory.md ## Rationale "pgvector 재사용 vs 별도 벡터DB 기각"`
- 확인: target spec 이 `agent_memory` 테이블을 pgvector 기반으로 정의하며, Pinecone/Weaviate/Qdrant 등 별도 벡터DB 도입 흔적 없음. KB 와 동일 인프라 재사용 원칙 준수.

**[NONE] `render_*` 도구의 워크플로 분기 흉내 금지 원칙 준수 (§12.4)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §4.1`, `§6.1.d.i`
- 과거 결정 출처: `1-ai-agent.md §12.4` "역할 분리 — 표현 전담 / 그래프 분기는 `cond_*`"
- 확인: `render_*` 가 출력 포트 라우팅에 영향을 주지 않으며, 버튼 클릭은 다음 LLM turn 의 user 메시지로 흡수. 역할 분리 invariant 준수.

**[NONE] Schema 위반 silent fallback 원칙 준수 (§12.4)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §4.1`, `§6.1.e`
- 과거 결정 출처: `1-ai-agent.md §12.4` "Schema 위반의 silent fallback 결정"
- 확인: `render_*` schema 위반 시 1회 재시도 후 silent drop + `meta.presentationSchemaViolations[]` 누적 정책이 유지됨. `error` 포트로 발화하는 대안은 채택 안 됨.

**[NONE] `render_form` 의 form bypass `cancelled` tool_result 원칙 준수 (§12.5)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass`
- 과거 결정 출처: `1-ai-agent.md §12.5` "Form bypass 의 cancelled tool_result 선택"
- 확인: bypass 시 `{type:'cancelled', reason:'user_sent_message_instead'}` tool_result 회신 + LLM reasoning autonomy 보존 정책 일관 적용.

**[NONE] `memoryStrategy: 'manual'` 하위호환 invariant (`physical compaction` 제외) 준수 (§12.14)**
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 d.6`
- 과거 결정 출처: `1-ai-agent.md §12.14`
- 확인: "`manual` 은 압축 대상이 아니다 (회귀 0)" 명시. `summary_buffer`/`persistent` 에만 물리 압축 적용.

**[NONE] `text_classifier` / `information_extractor` contextScope inject v2 유보 준수**
- target 위치: `spec/4-nodes/3-ai/0-common.md §10`, `spec/conventions/conversation-thread.md §7`
- 과거 결정 출처: `conversation-thread.md §7` v2 로드맵 "text_classifier / information_extractor 자동 주입 확장"
- 확인: 두 노드의 **push** 는 v1 완료 (`pushClassifierTurn`/`pushExtractorTurn`), **inject** (contextScope 자동 주입) 는 v2 예정으로 명확히 구분. `0-common.md §10` 의 비고에 "push 완료 vs inject 미완" 을 명시하여 경계 혼동 없음.

**[INFO] `information_extractor` config echo 의 알려진 결함 (`config.schema` vs `outputSchema`)**
- target 위치: `spec/4-nodes/3-ai/3-information-extractor.md §8 Rationale`
- 상세: `config.schema` 로 echo 되는 필드명이 원본 config 필드명 `outputSchema` 와 다른 known defect (W-1). 본 파일 자체에 "알려진 결함 — 이연" 으로 명시됨.
- 제안: 이연 결정 자체는 적절히 문서화됨. 후속 plan 생성 시 CONVENTIONS Principle 7 (config echo 원본 필드명 그대로) 위반 수정을 포함할 것.

---

## 요약

`spec/4-nodes/3-ai/` 대상 파일들은 과거 Rationale 에서 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 항목이 없다. v1/v2 경계 변경(`token-aware cap`, `DB 영속`, `별도 저비용 summary model`)처럼 이전 결정을 번복할 여지가 있는 사항들은 모두 `§12.9 ~ §12.14` 의 전용 Rationale 항목으로 근거를 명시하고 정식 번복을 선언하였다. `memoryStrategy` 별도 필드화, `render_*` 역할 분리, manual 하위호환 물리 압축 제외 등 핵심 invariant 도 일관되게 유지된다. INFO 등급의 `information_extractor` config echo 필드명 mismatch 만 이연 결함으로 기록되어 있으며, 이는 Rationale 불일치가 아니라 구현 부채다.

---

## 위험도

NONE
