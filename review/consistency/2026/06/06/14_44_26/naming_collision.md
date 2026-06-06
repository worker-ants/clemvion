# 신규 식별자 충돌 Check 결과

검토 대상: `plan/in-progress/spec-draft-rag-dynamic-cut.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 1. 환경변수·설정키 충돌

- **[INFO]** `RAG_INJECT_TOKEN_BUDGET`(8000) vs `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) — 값 동일, 명명 분리됨
  - target 신규 식별자: `RAG_INJECT_TOKEN_BUDGET`(내부 상수, 8000)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts:29` — `DEFAULT_MEMORY_TOKEN_BUDGET = 8000`; `spec/4-nodes/3-ai/1-ai-agent.md:52` — `memoryTokenBudget` 기본값 `8000`
  - 상세: 값이 동일(8000)하나 쓰임새가 다르다. `DEFAULT_MEMORY_TOKEN_BUDGET`은 working-memory(conversation summary) 토큰 예산, `RAG_INJECT_TOKEN_BUDGET`은 RAG 주입 청크의 토큰 상한. target 문서 A8 Rationale 에 "RAG prefix 로 분리(혼선 차단)" 이 이미 명시돼 있어 충돌 의식을 갖고 분리한 것이 확인된다.
  - 제안: 현재 명명 방향 유지. spec Rationale 에 두 상수의 차이(working-memory 압축 예산 vs KB 주입 상한)를 1줄 명시하면 추후 코드 리뷰어 혼선 방지에 유리함.

- **[INFO]** `RAG_RECALL_K`, `RAG_MAX_INJECT_COUNT` — 코드베이스에 미존재, spec 내 언급 없음
  - target 신규 식별자: `RAG_RECALL_K`(50), `RAG_MAX_INJECT_COUNT`(12)
  - 기존 사용처: 검색 결과 없음. 기존 spec 과 코드베이스 전체에 동일 이름 없음.
  - 상세: 신규 내부 상수로 충돌 없음. `rerank_candidate_k`(기본 50, `spec/1-data-model.md §2.11`) 와 `RAG_RECALL_K`(50)가 같은 값이지만, `rerank_candidate_k`는 KB-level DB 컬럼(rerank 모드 전용), `RAG_RECALL_K`는 off 경로를 포함한 SQL wide-recall용 내부 상수로 레이어가 다르다. 혼동 가능성이 있는 이름이나 도메인이 분리되어 있어 동의어 오해 수준은 낮음.
  - 제안: spec A5 §3.4 에 `RAG_RECALL_K`와 `rerank_candidate_k`(DB 컬럼)의 관계("≠off 경로에서 `LIMIT` 은 `rerank_candidate_k` 값을 따름, off 경로는 `RAG_RECALL_K` 상수")를 명시하면 구현자 혼선 차단에 도움.

---

### 2. 엔티티/타입명 충돌

- **[INFO]** `estimateTokens` — 이름 동일, 두 함수가 별개 도메인에 공존
  - target 신규 식별자: `chunking/text-chunker.estimateTokens`(char/3 균일 추정) — RAG 토큰 예산 계산에 재사용 명시
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts:24` — `export function estimateTokens`; `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:75` — `estimateTokensLanguageAware`
  - 상세: target 이 재사용하려는 함수는 기존 `text-chunker.estimateTokens`(char/3)이며 이미 구현돼 있음. 별도 동명 함수 신설이 아닌 재사용이므로 충돌 없음. `agent-memory-injection.ts` 의 `estimateTokensLanguageAware`(language-aware 휴리스틱)와는 이름이 달라 혼동 없음. 기존 테스트(`agent-memory-injection.spec.ts:959`)도 두 함수가 별개임을 명시적으로 검증하고 있음.
  - 제안: 이슈 없음.

---

### 3. 섹션 참조 ID 충돌

- **[WARNING]** spec `9-rag-search.md §3.4` — target 이 신설 예정이나 기존 spec 에 §3.4 부재
  - target 신규 식별자: `§3.4` (신규 섹션 "동적 점수 컷") — target 내 여러 곳에서 `RAG 검색 §3.4`, `(RAG 검색 §3.4)` 형태로 교차 참조됨
  - 기존 사용처: `spec/5-system/9-rag-search.md` 의 현행 섹션 구조는 `§3.3` 다음 `§4`로 바로 이어짐 — `§3.4` 는 현재 정의되지 않은 미래 섹션
  - 상세: target 이 spec 에 §3.4 를 신설하는 것이므로 충돌 자체는 아니다. 그러나 target 문서 내 교차 참조(`RAG 검색 §3.4`)와 graph-rag, ai-agent, 0-common, agent-memory 변경 제안이 모두 이 미존재 앵커에 의존한다. spec 반영 시 해당 섹션을 올바른 위치에 삽입하지 않으면 dead-link 가 된다.
  - 제안: spec 편집 시 `§3.4` 삽입 위치(기존 §3.3 바로 아래)와 앵커(`#34-동적-점수-컷-생성-주입-모든-모드-공통` 형태)를 명시적으로 확인하고, 이미 pending_plans 에 본 plan 을 추가하는 A1 변경과 함께 실제 spec 파일에 위치를 굳혀야 dead-link 상태가 발생하지 않는다.

---

### 4. 필드 기본값 의미 충돌

- **[WARNING]** `ragTopK` 기본값 제거(optional화) vs 기존 명시 기본값 `5`
  - target 신규 식별자: `ragTopK`의 기본값 `5` 제거(optional 상한 override로 의미 변경)
  - 기존 사용처:
    - `spec/4-nodes/3-ai/1-ai-agent.md:40` — `ragTopK | Integer | | \`5\` | KB tool 호출 시 반환할 청크 수의 기본값`
    - `spec/4-nodes/3-ai/0-common.md:45` — `ragTopK | Integer | RAG 검색 결과 수 (기본: 5)`
    - `spec/5-system/9-rag-search.md:153` — `| \`$4\` | 최대 결과 수 (topK) | LLM 호출 인자 또는 5`
    - `spec/5-system/9-rag-search.md:80` — `"top_k": { "type": "integer", "description": "Default: <ragTopK>" }`
    - `spec/5-system/17-agent-memory.md:83` — `기본값은 RAG 정합을 위해 동일(\`5\` / \`0.7\`)하나 별도 필드다`
  - 상세: 충돌이 아닌 의도된 의미 변경이나, 위 5곳의 기존 명시(`기본: 5`, `LLM 호출 인자 또는 5`)와 모순이 생긴다. target 은 B1/C/D 섹션에서 갱신을 제안하지만 `spec/5-system/9-rag-search.md:153`(`$4` 행 설명), `spec/5-system/9-rag-search.md:80`(`top_k` tool 정의의 `"Default: <ragTopK>"`) 두 곳에 대한 명시적 변경 지시가 없다.
  - 제안: target A2 에 `$4` 행 설명 갱신이 포함되어 있으나, §2.1 KB tool 정의(`top_k` `"Default: <ragTopK>"`)에 대한 갱신(`"Default: none (dynamic cut)"` 또는 유사 설명)도 명시적으로 추가해야 일관성이 보장된다. `spec/5-system/17-agent-memory.md:83` 갱신은 target D에서 명시적으로 다루고 있어 충족됨.

---

### 5. 기존 `cutoffApplied` 필드 vs target 변경 제안

- **[INFO]** `cutoffApplied` — 이미 존재하는 진단 필드에 의미 확장 예고
  - target 신규 식별자: `cutoffApplied` 에 token-budget/inject-cap 동적 컷 적용 여부 포함됨을 명시 (A6)
  - 기존 사용처: `spec/5-system/9-rag-search.md:260` — `"cutoffApplied": true`(rerank 진단 서브객체); 구현: `rerank.service.spec.ts:84`, `rag-search.service.spec.ts:512`
  - 상세: `cutoffApplied` 는 기존 spec 과 코드베이스에 `rerank` 서브객체 내부 필드로 이미 존재하며 `rerank_score_threshold` 컷 여부를 뜻한다. target A6 은 이 기존 필드에 동적 컷(token-budget/inject-cap) 적용 여부도 포함됨을 추가 명시하는 것이다. 기존 의미(`rerank_score_threshold` 컷)와 신규 의미(token-budget+inject-cap 동적 컷)가 혼용될 수 있어 진단 해석이 모호해진다.
  - 제안: spec §4.2 갱신 시 `cutoffApplied`가 "rerank_score_threshold 컷 OR token-budget 컷 OR inject-cap 컷 중 하나라도 적용된 경우 true" 임을 명시하거나, token-budget/inject-cap 컷 전용 필드(`dynamicCutApplied` 등)를 별도 신설해 기존 `cutoffApplied`(rerank 점수 컷)와 의미를 분리하는 것을 검토할 것.

---

## 요약

target 이 도입하는 신규 식별자(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`, `§3.4` 섹션)는 기존 코드베이스 및 spec 에 동일 이름·동일 의미의 선행 정의가 없어 원칙적 충돌은 없다. 다만 세 가지 주의사항이 있다: (1) `ragTopK` 기본값 제거에 따른 미갱신 참조 지점 2곳(`spec/5-system/9-rag-search.md §2.1 top_k 설명`, `§3.1 $4 행`)이 target 변경 목록에서 누락되어 있고, (2) 기존 `cutoffApplied` 진단 필드가 rerank 점수 컷 전용으로 정의돼 있으나 target 이 token-budget 컷 포함 의미로 확장하면 진단 해석이 모호해지며, (3) `§3.4` 앵커는 spec 반영 전까지 dead-link 상태이므로 교차 참조 전에 섹션 삽입을 완료해야 한다. 환경변수 충돌은 없고 내부 상수 명명은 적절히 prefix 로 분리돼 있다.

## 위험도

LOW
