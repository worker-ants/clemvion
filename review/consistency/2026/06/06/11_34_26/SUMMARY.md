# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 2건(서로 다른 checker에서 동일 시그니처 이슈를 다른 각도로 지적), INFO 8건. 기능적 충돌·계약 파기 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `LLMClient.embed` 인터페이스 수준 시그니처 확장에 대한 Rationale 범위 불충분 — "서비스 계층" 한정 기술로, 인터페이스 level "평탄한 시그니처" 원칙과의 관계 불명 | `spec/5-system/7-llm-client.md §3.3`, `§8.3 Rationale` | `7-llm-client.md` 기존 Rationale "평탄한 시그니처" 원칙 | `Rationale` 에 "LLMClient 인터페이스에 `inputType` 추가가 왜 평탄한 시그니처 원칙 위반이 아닌가" 항목 분리 신설 또는 기존 항목이 LLMClient 인터페이스까지 포괄하도록 명시 확장. §3.3 본문에 "plain scalar 위치 인자 추가는 객체화가 아니므로 원칙 범위 내" 한 문장 보완. |
| 2 | Naming Collision | `LlmService.embed` 위치 인자 `opts?` 삽입으로 `inputType` 단독 전달 시 인자 오해석 위험 — `embed(config, texts, model, 'query')` 형태로 호출 시 4번째 인자가 `opts` 로 해석됨 | `spec/5-system/7-llm-client.md §8.3` | origin/main `LlmService.embed(config, texts, model?)` 3인자 시그니처 | `§8.3` 시그니처 설명에 "`opts` 불필요 시 `embed(config, texts, model, undefined, 'query')` 로 `undefined` 명시" 예시 한 줄 추가. |

> **중복 제거**: Convention Compliance checker 도 `§8.3` 주석의 인자 순서 경고를 INFO로 지적했으나, Naming Collision WARNING 과 동일 이슈이므로 후자의 WARNING으로 통합.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `data-flow/6-knowledge-base.md` mermaid 다이어그램이 구 버전 `embed(texts[])` / `embed(query)` 표기 유지 — `inputType` 구분 미반영 | `spec/data-flow/6-knowledge-base.md §1.2·§1.3·§1.4` | `embed(texts[], inputType:'document')`, `embed(query, inputType:'query')` 로 갱신 또는 mermaid Note 부기 |
| 2 | Cross-Spec | `8-embedding-pipeline.md §5.4` 의 `inputType` 에 `?` optional 마커 누락 (`7-llm-client.md §8.3` 는 `inputType?` 로 선택) | `spec/5-system/8-embedding-pipeline.md §5.4` 시그니처 표기 | `LlmService.embed(config, texts, model?, opts?, inputType?)` 로 `?` 추가 |
| 3 | Cross-Spec | 모델 변경 후 재임베딩 없이 검색 시 구 차원 벡터와 신 query 벡터 불일치 시나리오가 경고 문안에 미기술 | `spec/2-navigation/5-knowledge-base.md §2.2` 경고 블록 | "재임베딩 전 검색 시 구 모델 차원 기준으로 검색이 동작해 정확도 저하 가능" 한 줄 또는 §7.3 링크 추가 (선택) |
| 4 | Rationale Continuity | `spec/2-navigation/5-knowledge-base.md Rationale R-1` 에 배지 패턴이 선택 집합을 확장하지 않음을 교차 참조 미기재 | `spec/2-navigation/5-knowledge-base.md Rationale R-1` | R-1 말미에 "한국어 추천 배지는 option 라벨 메타데이터, 선택 집합 불변·자유 입력 경로 미추가" 1문장 추가 |
| 5 | Rationale Continuity | `17-agent-memory.md` — 비대칭 inputType 도입 후 기존 메모리 재임베딩 경로 미제공 이유 Rationale 미기재 | `spec/5-system/17-agent-memory.md ## Rationale` | Rationale 섹션에 "KB 와 달리 단일 tenant scope_key·TTL·dedup UPDATE 로 자연 대체되므로 수동 재임베딩 경로 불필요" 항목 신설 |
| 6 | Convention Compliance | `8-embedding-pipeline.md` frontmatter `code:` 에 `embedding-input-type.ts` 미등재 (§5.4 가 해당 파일을 SoT 로 지칭) | `spec/5-system/8-embedding-pipeline.md` frontmatter | `codebase/backend/src/modules/llm/embedding-input-type.ts` 추가 또는 §5.4 SoT 문구를 `7-llm-client.md` 단독으로 단일화 |
| 7 | Convention Compliance | `8-embedding-pipeline.md §5.4` 본문 "정합성" 불릿과 `## Rationale "결정: 비대칭 입력"` 항목 내용 중복 | `spec/5-system/8-embedding-pipeline.md §5.4` 본문 | §5.4 인라인 불릿을 제거하거나 "→ §Rationale 결정 참조" 로 대체 (현 상태 유지도 허용) |
| 8 | Plan Coherence | `rag-rerank-followup.md` 가 stale(PR MERGED)이나 `7-llm-client.md` `pending_plans` 에 잔존 — embedding-model-ux 편집과 완료 조건 추적 복잡 | `spec/5-system/7-llm-client.md` frontmatter `pending_plans` | embedding-model-ux 완료 후 `rag-rerank-followup.md` 를 `complete/` 이동 또는 conditional escalate 항목 분리 plan 추출 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `data-flow/6-knowledge-base.md` mermaid 구버전 표기, `§5.4` `inputType?` 마커 누락, 차원 불일치 UX 안내 공백 — 모두 INFO |
| Rationale Continuity | LOW | LLMClient 인터페이스 수준 Rationale 범위 불충분 (WARNING 1건), 배지·agent-memory Rationale 보완 권장 INFO 2건 |
| Convention Compliance | NONE | frontmatter `code:` 미등재, 본문-Rationale 중복 — INFO 2건, 규약 직접 위반 없음 |
| Plan Coherence | NONE | 활성 worktree 충돌 없음, stale pending_plan 잔존 INFO 1건 |
| Naming Collision | LOW | `LlmService.embed` `opts?` 삽입으로 `inputType` 단독 전달 오해석 위험 (WARNING 1건), 신규 식별자 실질 충돌 없음 |

## 권장 조치사항

1. **[WARNING 해소 — 권장]** `spec/5-system/7-llm-client.md §3.3` 본문에 "plain scalar 위치 인자 추가는 객체화가 아니므로 평탄한 시그니처 원칙 범위 내" 한 문장 추가, Rationale 에 LLMClient 인터페이스 수준 확장 근거 항목 명시.
2. **[WARNING 해소 — 권장]** `spec/5-system/7-llm-client.md §8.3` 시그니처 설명에 "`opts` 불필요 시 `embed(config, texts, model, undefined, 'query')` 형태" 예시 한 줄 추가.
3. **[INFO — 선택]** `spec/5-system/8-embedding-pipeline.md §5.4` 시그니처 표기에 `inputType?` `?` 추가 및 frontmatter `code:` 에 `embedding-input-type.ts` 등재.
4. **[INFO — 선택]** `spec/data-flow/6-knowledge-base.md §1.2·§1.3·§1.4` mermaid 를 `inputType` 파라미터 포함 표기로 동기화.
5. **[INFO — 선택]** `spec/5-system/17-agent-memory.md` Rationale 에 "agent memory 재임베딩 경로 미제공 이유" 항목 신설.
6. **[INFO — 후속]** embedding-model-ux 완료 후 stale plan `plan/in-progress/rag-rerank-followup.md` 를 `complete/` 로 이동하고 `7-llm-client.md` `pending_plans` 갱신.