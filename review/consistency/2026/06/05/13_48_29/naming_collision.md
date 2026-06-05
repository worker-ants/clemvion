# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done (scope=spec/5-system/, diff-base=origin/main)

## 발견사항

### 발견사항 없음 — 충돌 식별자 없음

검토 대상 파일에서 새로 도입된 주요 식별자 목록과 기존 사용처를 전수 대조한 결과, 의미 충돌에 해당하는 항목을 발견하지 못했다.

---

#### 검토한 신규 식별자 일람

**엔티티/타입명**

| 신규 식별자 | 도입 위치 | 기존 충돌 여부 |
|---|---|---|
| `RerankConfig` | `spec/1-data-model.md §2.16.1`, `spec/5-system/7-llm-client.md §3.6`, `spec/2-navigation/6-config.md Part C` | 없음. `LLMConfig` 와 동일 패턴 sibling — 이름이 충분히 분리됨 |
| `RerankClient` | `spec/5-system/7-llm-client.md §3.6` | 없음. `LLMClient` 와 명시적으로 다른 인터페이스로 선언됨 |
| `RerankClientFactory` | `spec/5-system/7-llm-client.md §4.1` | 없음. `LLMClientFactory` 와 별개 팩토리로 분리됨 |

**DB 컬럼 (KnowledgeBase 추가 컬럼)**

| 신규 컬럼 | 도입 마이그레이션 | 기존 충돌 여부 |
|---|---|---|
| `rerank_mode` | V082 | 없음. `rag_mode` 와 의미·네이밍 축이 다름 (`rag_mode`=적재 흐름, `rerank_mode`=검색 후처리) |
| `rerank_config_id` | V082 | 없음. `extraction_llm_config_id` / `embedding_llm_config_id` 와 충돌 없음 |
| `rerank_candidate_k` | V082 | 없음. KB 내 다른 정수 컬럼(`vector_seed_top_k`, `max_hops`, `expanded_chunk_limit`)과 이름 겹침 없음 |
| `rerank_score_threshold` | V082 | 없음. `ragThreshold`(노드 config 필드)와 의미는 연결되나 표현 레이어(DB 컬럼 vs JSON config 키)가 다름. spec `9-rag-search.md §3.1`에 의도적 재해석 근거 명시됨 |
| `rerank_llm_config_id` | V082 | 없음. `extraction_llm_config_id`와 접두어·역할 모두 구별됨 |

**`rerank_mode` Enum 값**

| 값 | 기존 충돌 여부 |
|---|---|
| `off` | 없음. `rag_mode`에 `off` 값이 없고, 다른 Enum에 `off`를 쓰는 컬럼이 DB 스키마 내 없음 |
| `cross_encoder` | 없음. 이 문자열은 spec/5-system/9-rag-search.md 외에서 사용되지 않음 |
| `cross_encoder_llm` | 없음. 동일 |

**API 엔드포인트**

| 메서드 + 경로 | 도입 문서 | 기존 충돌 여부 |
|---|---|---|
| `GET /api/rerank-configs` | `spec/2-navigation/6-config.md §Part C` | 없음. `/api/llm-configs` 와 prefix가 다름 |
| `POST /api/rerank-configs` | 동 | 없음 |
| `GET /api/rerank-configs/:id` | 동 | 없음 |
| `PATCH /api/rerank-configs/:id` | 동 | 없음 |
| `PATCH /api/rerank-configs/:id/set-default` | 동 | 없음. `/api/llm-configs/:id/set-default` 와 동일 패턴이나 resource prefix가 달라 충돌 없음 |
| `DELETE /api/rerank-configs/:id` | 동 | 없음 |

**에러 코드**

| 에러 코드 | 도입 위치 | 기존 충돌 여부 |
|---|---|---|
| `RERANK_ENDPOINT_FAILED` | `spec/5-system/9-rag-search.md §4.2, §6` | 없음. `spec/conventions/error-codes.md` 에 등재된 기존 코드와 prefix 다름 |
| `RERANK_NO_VALID_RESULTS` | 동 | 없음 |
| `RERANK_LLM_GRADING_FAILED` | 동 | 없음 |
| `RERANK_CONFIG_INVALID` | 동 | 없음 |

**감사 로그 액션 이름**

| 신규 액션 | 도입 위치 | 기존 충돌 여부 |
|---|---|---|
| `rerank_config.create` | `spec/5-system/1-auth.md §4.1` | 없음. 기존 `llm_config.*` · `auth_config.*` 패턴과 일관. `rerank_config.*`는 중복 없음 |
| `rerank_config.update` | 동 | 없음 |
| `rerank_config.delete` | 동 | 없음 |

**RBAC 권한 매트릭스 리소스 이름**

| 신규 리소스 이름 | 도입 위치 | 기존 충돌 여부 |
|---|---|---|
| `Rerank Config` | `spec/5-system/1-auth.md §3.2` | 없음. `LLM Config`, `Auth Config` 와 명명 패턴 일관. 다른 행과 이름 겹침 없음 |

**파일 경로**

| 신규 또는 갱신 파일 경로 | 기존 충돌 여부 |
|---|---|
| `spec/5-system/9-rag-search.md` (기존 파일에 §3.3 추가) | 없음 |
| `spec/5-system/7-llm-client.md` (§3.6, §4.1 추가) | 없음 |
| `spec/1-data-model.md §2.16.1` RerankConfig, §2.11 rerank_* 컬럼 추가 | 없음 |
| `spec/2-navigation/6-config.md` Part C 추가 | 없음 |
| `spec/5-system/1-auth.md §3.2, §4.1` 갱신 | 없음 |
| `codebase/backend/migrations/V081__rerank_config.sql` | V081 마이그레이션 파일 실제 존재 확인됨 |
| `codebase/backend/migrations/V082__knowledge_base_rerank.sql` | V082 마이그레이션 파일 실제 존재 확인됨 |

---

**검토에서 확인한 세부 사항**

1. `rerank_mode` 와 `rag_mode`: 두 컬럼이 모두 KnowledgeBase 에 존재하며 이름이 비슷하나, spec `10-graph-rag.md §1` 과 `9-rag-search.md §3.3` 에 "직교 단계"임이 명시되어 있고 사용 문맥이 분리되어 있다. `1` disambiguation 주석(`용어 disambiguation`)이 두 파일에 기재되어 있으므로 명명 혼동 위험이 문서 수준에서 사전 차단되어 있다.

2. `ragThreshold` vs `rerank_score_threshold`: AI Agent 노드 config 필드(`ragThreshold`)가 `rerank_mode ≠ off` 시 "리랭크 점수 임계"로 재해석된다는 점이 `9-rag-search.md §3.1` 에 명시되어 있으나, 이는 동일 식별자가 다른 의미로 충돌하는 것이 아니라 하나의 사용자 설정 값이 두 경로에서 다른 대상에 매핑되는 설계 결정이다. spec 의 Rationale 절에 근거가 명시되어 있으므로 충돌로 분류하지 않는다.

3. `RR-PL-*` 요구사항 ID prefix: 기존 spec에 `RR-PL-01`~`RR-PL-07`이 Re-run 요구사항으로 사용 중이다. target 은 `RR-` prefix를 신규 도입하지 않으므로 충돌 없다.

4. `is_default` 컬럼: `LLMConfig.is_default` 와 `RerankConfig.is_default` 가 각각 별개 테이블에 존재하지만, 이는 별개 테이블의 컬럼이므로 DB 스키마 충돌이 아니다.

---

## 요약

`spec/5-system/` 영역이 이번 rerank 구현을 통해 도입한 신규 식별자(`RerankConfig` 엔티티, `rerank_mode` 컬럼과 열거값, `rerank_*` 컬럼군, `/api/rerank-configs` 엔드포인트 가족, `RERANK_*` 에러 코드, `rerank_config.*` 감사 이벤트)는 기존 `spec/` 영역 어디에서도 다른 의미로 사용 중인 동일 식별자와 겹치지 않는다. `rerank_mode` 와 `rag_mode` 의 유사성은 양쪽 문서에 명시적 disambiguation 주석이 삽입되어 있어 혼동 위험이 사전 차단된 상태다. 파일 경로 충돌, API 엔드포인트 중복, 요구사항 ID 재사용, 환경변수 충돌은 모두 발견되지 않았다.

## 위험도

NONE
