# 변경 범위(Scope) 리뷰 결과

## 작업 배경

PR #492 (embedding-model-ux) 의 ai-review 후속 fix 커밋(`17ef3879`) 이후 추가로 반영된 변경 세트. 작업 의도:
1. graph KB 검색 경로(`searchGraphKb`)의 `inputType='query'` 배선 테스트 추가 — 비대칭 모델 query/passage 공간 계약 고정
2. `LocalClient.embed` 상속 경로 회귀 가드 테스트 추가
3. `LlmService.embed` 의 inputType 패스스루(배치·timeout 경유) 테스트 추가
4. `embedding-input-type.spec.ts` 멱등성 부재 계약 문서화 테스트 추가
5. `embedding-model-combobox.tsx` 의 `renderOption` 인라인 람다를 `formatEmbeddingOptionLabel` 순수함수로 추출 + useCallback 래핑
6. `embedding-model-recommendation.ts` 에 `formatEmbeddingOptionLabel` 순수함수 추가 + `text-embedding-3` 배지 제외 결정 반영
7. 위 결정을 `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/5-system/17-agent-memory.md` 에 갱신

---

## 발견사항

### 파일 1: `rag-search.service.spec.ts`

- **[INFO]** graph 모드 query embed 계약 assertion 추가
  - 위치: `describe('search (graph mode)')` 첫 번째 it 블록 끝 (라인 +36~+46)
  - 상세: `searchGraphKb` 경로가 `inputType='query'` 로 `llmService.embed` 를 호출하는지 검증하는 expect 추가. 기존 vector 모드 테스트(`"should pass each KB's embeddingModel"`)의 동일 패턴 준용. 그래프 모드 전용 테스트 블록 내에 위치해 범위 이탈 없음.
  - 제안: 없음 (정상 범위)

### 파일 2: `local.client.spec.ts` (신규)

- **[INFO]** `LocalClient` 상속 경로 회귀 가드 테스트 신규 추가
  - 위치: 신규 파일 전체
  - 상세: `LocalClient` 는 `OpenAIClient` 를 상속하므로, 상위 클래스에서 구현한 e5-prefix 로직이 `LocalClient` 인스턴스를 통해서도 동일하게 동작하는지 별도 고정. plan §Phase A의 `local(openai 상속)` 대상 명시 항목의 회귀 테스트. 신규 파일이지만 구현 파일(`local.client.ts`) 에 실질 변경 없이 테스트만 추가 — 작업 범위 내.
  - 제안: 없음

### 파일 3: `embedding-input-type.spec.ts`

- **[INFO]** 멱등성 부재 계약 문서화 테스트 추가
  - 위치: `describe('applyEmbeddingInputPrefix')` 마지막
  - 상세: "이 함수는 멱등이 아님" 을 계약으로 명시하는 테스트 추가. 기존 임베딩 파이프라인에서 prefix 이중 적용을 방지하기 위한 설계 의도를 고정. 함수 동작 자체의 변경 없이 기존 동작을 문서화하는 테스트이므로 scope 이탈 없음.
  - 제안: 없음

### 파일 4: `llm.service.spec.ts`

- **[INFO]** `LlmService.embed` inputType 패스스루 테스트 2건 추가
  - 위치: `describe('embed')` 블록 끝
  - 상세: (1) 배치 분할 경로에서 inputType 이 각 배치에 전달되는지, (2) timeout 래퍼(`withTimeout`) 경유 시에도 전달되는지 검증. plan §Phase A `llm.service.ts` 패스스루 구현의 계약 고정. 기존 테스트 구조와 일관된 스타일.
  - 제안: 없음

### 파일 5: `embedding-model-combobox.test.tsx`

- **[INFO]** 한국어 추천 배지 렌더링 통합 테스트 추가
  - 위치: `describe("EmbeddingModelCombobox")` 마지막
  - 상세: `formatEmbeddingOptionLabel` 의 순수 분기 로직은 별도 단위 테스트에서 검증하고, combobox 가 실제 option 텍스트로 배지를 렌더하는지 통합 수준에서 확인하는 테스트 추가. 계층 분리 설명 주석이 명확하며 역할 중복 없음.
  - 제안: 없음

### 파일 6: `embedding-model-combobox.tsx`

- **[WARNING]** 인라인 람다 → 순수함수 추출 + useCallback 래핑 — 작은 리팩토링 포함
  - 위치: import 교체(`isKoreanRecommendedEmbeddingModel` → `formatEmbeddingOptionLabel`) + `renderOption` 구현 변경
  - 상세: 기존 인라인 `renderOption` 람다 내에 있던 "base 계산 + 배지 조건부 suffix" 로직이 `formatEmbeddingOptionLabel` 로 추출됨. 기능적으로 동일한 결과를 생성하나, 코드 구조가 변경됨. `useCallback` 추가는 plan/commit 의 ai-review fix 사항으로, 현재 ModelSelectField 가 memo 되지 않아 리렌더 절감 효과가 없다는 점을 주석에서도 인정. 이 리팩토링은 테스트 대상의 "단위 테스트 용이성(i18n 의존 제거)"을 위해 필요한 최소 변경으로 plan §Phase B 와 직접 연계된 작업 범위 내 변경으로 볼 수 있다.
  - 단, `useCallback` 과 주석 "향후 memo화 대비 + 매 렌더 람다 재생성 노이즈 제거 목적의 방어적 안정화" 는 현재 작업 요구사항을 넘는 **선제적 최적화** 성격이다. 기능 변경 없이 코드 구조를 바꾸는 것은 이번 작업의 핵심 목적(배지 배선 검증 가능화) 을 위해 필요하고 범위 내 리팩토링에 해당하므로 경계 사례(borderline) 이나 차단 사안은 아님.
  - 제안: 수용 가능. 다만 useCallback 주석의 "향후 대비" 설명이 지금 당장의 변경 근거로 약하므로, 향후 동일 패턴 적용 시 명확한 근거 없는 방어적 useCallback 남발 주의.

### 파일 7: `embedding-model-recommendation.test.ts`

- **[INFO]** `text-embedding-3` 배지 제외 결정 반영 + `formatEmbeddingOptionLabel` 단위 테스트 추가
  - 위치: `describe("isKoreanRecommendedEmbeddingModel")` 수정 + 신규 `describe("formatEmbeddingOptionLabel")` 추가
  - 상세: `text-embedding-3-small/large` 를 "추천 아님" 케이스로 이동(product 결정 반영). `formatEmbeddingOptionLabel` 의 6가지 경계 케이스(추천/비추천/name≠id/name=id/name빈값/배지i18n비의존) 단위 테스트 추가. 범위 내.
  - 제안: 없음

### 파일 8: `embedding-model-recommendation.ts`

- **[INFO]** `text-embedding-3` 패턴 제거 + `formatEmbeddingOptionLabel` 순수함수 신규 export
  - 위치: `KOREAN_RECOMMENDED_PATTERNS` 배열 수정 + 함수 추가
  - 상세: plan §D-P6-5 에서 "text-embedding-3" 을 추천 목록에 포함했으나, ai-review 후 "한국어 검색 벤치마크 하위" product 결정으로 제외. spec §2.2 와 일치. `formatEmbeddingOptionLabel` 추가는 combobox 리팩토링의 전제 조건. 범위 내.
  - 제안: 없음

### 파일 9: `spec/2-navigation/5-knowledge-base.md`

- **[INFO]** §2.2 임베딩 모델 설명 갱신
  - 위치: 임베딩 모델 테이블 셀
  - 상세: 추천 모델 목록에서 `text-embedding-3` 제거 및 명시적 제외 이유("한국어 검색 벤치마크 하위라 배지 대상 제외") 추가. 구현과 spec 의 단일 진실 원칙 준수. developer 역할이 spec 을 직접 수정하는 것은 CLAUDE.md 규약상 `project-planner` 전담이나, plan 로그에 "spec 갱신: project-planner+consistency-check --spec" 로 명시돼 있어 위임 처리된 것으로 보임.
  - 제안: 없음 (plan 에 명시된 범위)

### 파일 10: `spec/4-nodes/3-ai/3-information-extractor.md`

- **[INFO]** §7.1 recall 절에 `inputType='query'` 계약 1줄 추가
  - 위치: "추출 LLM 콜 직전 1회: `AgentMemoryService.recall(...)` " 항목 바로 뒤
  - 상세: recall 시 `inputType:'query'` 로 임베딩해야 함을 명시 — 비대칭 모델(e5·Gemini)에서 저장(`'document'`)과 검색(`'query'`) 분리 계약. `17-agent-memory.md §4` 링크 포함. 최소 변경, 범위 내.
  - 제안: 없음

### 파일 11: `spec/5-system/17-agent-memory.md`

- **[INFO]** §Rationale에 "일괄 재임베딩 경로 부재" 결정 추가
  - 위치: 파일 끝 신규 절
  - 상세: `agent_memory` 에 KB 식 일괄 재임베딩 경로를 추가하지 않는 이유(휘발성/dedup UPDATE 자연 수렴)를 Rationale 로 문서화. 코드 변경 없이 spec 결정 근거만 추가. 범위 내.
  - 제안: 없음

---

## 요약

11개 변경 파일 전체가 P6 임베딩 UX 보강 및 ai-review fix 이후 후속 작업(`embedding-followup`) 의 의도된 범위 내에 있다. 신규 테스트 파일(local.client.spec.ts)과 기존 테스트 확장은 모두 Phase A/B 구현 계약을 고정하는 목적이며, 구현 파일 변경(`embedding-model-combobox.tsx`, `embedding-model-recommendation.ts`)은 배지 로직을 단위 테스트 가능한 순수함수로 분리하는 최소 리팩토링으로 작업 목적과 직결된다. `useCallback` 추가의 "방어적 안정화" 설명이 현재 시점의 필요성 대비 다소 과도하나, 기능 등가이고 해악이 없어 차단 대상이 아니다. spec 3개 파일 갱신은 plan 에 명시된 spec impact 목록과 일치한다. 범위 일탈 징후(무관한 파일 수정·불필요한 리팩토링·기능 확장·포맷팅 오염) 없음.

## 위험도

NONE

STATUS: SUCCESS
