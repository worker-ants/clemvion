# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 배포 시 기존 Gemini/e5 KB 벡터 공간 불일치로 인한 검색 품질 자동 저하 위험이 주요 요인. 코드 로직 자체는 건전하나 운영 배포 절차에 재임베딩 지침 포함이 필수이며, `AnthropicClient.embed` 시그니처 불일치·테스트 커버리지 공백 등 다수의 WARNING 이 존재.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 / 운영 | 배포 즉시 Gemini KB 기존 색인 벡터와 recall 쿼리 벡터 공간이 달라짐 — taskType 신규 적용으로 silent 검색 품질 저하 | `google.client.ts` — `resolveGeminiTaskType` 신규 적용 | Gemini 계열 모델 사용 KB 를 배포 직후 재임베딩하거나 배포 런북에 재임베딩 지침 기술 |
| 2 | 부작용 / 운영 | 배포 즉시 e5 계열 OpenAI-compat KB 기존 색인과 recall query prefix 불일치 — prefix 없이 색인된 document 벡터와 `query: ` prefix 붙은 검색 쿼리가 불일치 | `openai.client.ts` — `applyEmbeddingInputPrefix` 신규 적용 | e5 계열 모델 사용 KB 재임베딩 절차를 배포 절차에 포함 |
| 3 | 아키텍처 | `AnthropicClient.embed` 시그니처가 `LLMClient` 인터페이스와 불일치 — 다른 client 들은 `inputType` 파라미터를 맞췄으나 Anthropic 만 누락, LSP 경미 위반 | `anthropic.client.ts:148` | `embed(_texts?: string[], _model?: string, _inputType?: EmbedInputType)` 로 인터페이스 일치 시그니처 명시 |
| 4 | 유지보수성 | `LlmService.embed` 파라미터 순서가 `(config, texts, model?, opts?, inputType)` 로 `opts` 뒤에 `inputType` 이 위치해 5개 호출부 모두 `undefined` 를 4번째 인자로 명시 삽입해야 함 — 가독성·인체공학 저하 | `llm.service.ts:195` / `embedding.service.ts`, `agent-memory.service.ts`, `knowledge-base.service.ts`, `rag-search.service.ts` | `opts` 를 마지막으로 이동하거나 `{ inputType?, timeoutMs?, disableInnerRetry? }` 단일 options 객체로 병합 |
| 5 | 유지보수성 | 5개 호출부 전체에서 `undefined` 위치 인자가 반복 노출 — 독자가 시그니처까지 역추적해야 `undefined` 의 의미를 파악 가능 | `agent-memory.service.ts ~422, ~897` / `knowledge-base.service.ts ~151` / `rag-search.service.ts ~210, ~219` / `embedding.service.ts ~100` | 시그니처 개선 전까지 인라인 주석(`/* opts */`) 최소 완화책으로 추가 |
| 6 | 테스트 | `google.client.spec.ts` — `inputType` 생략 시 기본값 `'document'` → `RETRIEVAL_DOCUMENT` 동작을 독립 케이스로 검증하지 않아 기본값 로직 변경 시 회귀 미탐지 | `google.client.spec.ts` `describe('GoogleClient.embed')` | `it('inputType 생략 시 RETRIEVAL_DOCUMENT 가 config 에 포함된다')` 독립 케이스 추가 |
| 7 | 테스트 | `AnthropicClient.embed` throw 동작 테스트 전무 — 인터페이스 확장 후 throw 보증 불가 | `anthropic.client.spec.ts` | `it('embed 는 지원하지 않아 throw 한다')` 케이스 추가 |
| 8 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/7-llm-client.md §3.3` 의 `LlmService.embed` 시그니처 기술이 `opts` 파라미터를 누락 — 코드가 옳고 spec 기술이 낡음 | `spec/5-system/7-llm-client.md §3.3` | 코드 유지 + spec §3.3 에 `LlmService.embed(config, texts, model?, opts?, inputType)` 기술 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `E5_PREFIX_PATTERN` 등 정규식 패턴 ReDoS 잠재성 — 현재 패턴은 구조적으로 안전(O(n)), 교차 반복 패턴 없음 | `embedding-input-type.ts` | 향후 패턴 확장 시 `(?:a|ab)*` 형태 교차 대안 금지 |
| 2 | 보안 | `inputType` TypeScript 타입 안전성 — 런타임 외부 주입 시 `E5_PREFIX[inputType]` 가 `undefined` 반환 가능, HTTP DTO 계층 검증 구조에서 실질 위험 낮음 | `llm.service.ts` `embed()` 시그니처 | `applyEmbeddingInputPrefix` 내 `undefined` fallback(prefix 없이 원문 반환) 명시적 추가 권장 |
| 3 | 아키텍처 | `LLMClient.embed` 의 3번째 위치 인자 문제 — `model?` 생략 시 `inputType` 지정에 `undefined` 명시 필요, plan Rationale 에 의도적 결정으로 기록됨 | `interfaces/llm-client.interface.ts:136` | 향후 `EmbedOptions` 파라미터 객체 도입 시 일괄 리팩토링 |
| 4 | 아키텍처 | `agent-memory.service.ts` 가 `EmbeddingService` 대신 `LlmService.embed` 직접 호출 — consistency-check W-2 기지적 사항, 현재 변경의 `inputType` 배선은 올바름 | `agent-memory.service.ts:422, :896` | 이번 변경 범위 외. `spec §3` 표현을 "청킹/배치 파이프라인 중복 구현 금지" 로 구체화 권장 |
| 5 | 아키텍처 | 백엔드/프론트엔드 간 모델 패턴 정의 중복 — 목적이 달라(입력 전처리 vs UI 힌트) 의도적 분리이나 모델 카탈로그 확장 시 동기화 비용 발생 | `embedding-input-type.ts` / `embedding-model-recommendation.ts` | 파일 간 상호 참조 주석 추가; 카탈로그 확장 시 `packages/` 이동 검토 |
| 6 | 아키텍처 | `EmbeddingInputStrategy` 타입이 외부에 불필요하게 export — 테스트 목적 허용이나 외부 서비스 코드에서 직접 참조 금지 관행 유지 필요 | `embedding-input-type.ts:27` | 외부 서비스 코드에서 이 타입 직접 참조 금지 관행 유지 |
| 7 | 요구사항 | 재임베딩 없는 기존 e5/Gemini KB 의 비대칭 품질저하 런타임 경고 UI 미포함 — plan Phase C 로 의도적 미포함 | `embedding-input-type.ts` 주석, `spec §5.4` | Phase C 작업에서 재임베딩 권고 경고 UI 추가로 완결 |
| 8 | 요구사항 | `isKoreanRecommendedEmbeddingModel` 에 `text-embedding-3` 포함 — 리더보드 최하위지만 한국어 추천 배지 표시, 비강제 설계라 기능 버그 아님 | `embedding-model-recommendation.ts` | 배지 텍스트를 "한국어 지원"으로 조정하거나 순위 반영 여부는 product owner 결정 |
| 9 | 요구사항 | `E5_PREFIX_PATTERN` 의 `e5-base-v2` 포함 매칭이 주석에 미기술 | `embedding-input-type.ts` `E5_PREFIX_PATTERN` | 주석에 "e5-base-v2, e5-large-v2 등 버전 suffix 는 기본 패턴으로 포함 매칭" 한 줄 추가 |
| 10 | 범위 | `embedding-input-type.ts` 실제 배치가 plan 명시 경로(`knowledge-base/embedding/`)와 다름 — `llm` 모듈 배치가 의도적 결정이나 plan 문서 미갱신 | `plan/in-progress/embedding-model-ux.md` Phase A | plan 파일 경로 기술을 `llm/embedding-input-type.ts` 로 정정 |
| 11 | 범위 | `anthropic.client.ts` 가 diff 에 없음 — plan Phase A 에 명시된 항목, tsc 통과 근거로 호환 유지로 판단되나 확인 권장 | `anthropic.client.ts` | tsc 통과 기록 확인으로 충분; 불안하면 시그니처 명시 추가 |
| 12 | 성능 | `renderOption` 인라인 람다가 리렌더링마다 재생성 — `ModelSelectField` 가 `React.memo` 로 최적화된 경우 불필요한 자식 리렌더링 가능 | `embedding-model-combobox.tsx` `renderOption` prop | `ModelSelectField` 가 memo 컴포넌트라면 `useCallback([t])` 적용 권장, 현재 필수 아님 |
| 13 | 테스트 | `LlmService.embed` `query` inputType 경로 단위 테스트 부재 | `llm.service.spec.ts` | `it('inputType query 가 각 배치에 전달된다')` 케이스 추가 |
| 14 | 테스트 | `LlmService.embed` timeout + inputType 조합 테스트 없음 | `llm.service.spec.ts` | timeout 있는 embed 케이스 추가, `client.embed` 가 `inputType` 수신 검증 |
| 15 | 테스트 | `LocalClient` e5 prefix 실사용 케이스 전용 테스트 없음 | `local.client.ts` (OpenAIClient 상속) | `openai.client.spec.ts` 에 `LocalClient` e5 prefix 케이스 추가 또는 `local.client.spec.ts` 신규 생성 |
| 16 | 테스트 | `applyEmbeddingInputPrefix` 이중 prefix 동작 미문서화 — 멱등성 없음, 호출자 방지 책임 여부 불명확 | `embedding-input-type.spec.ts` | 이중 prefix 동작 명시 테스트(정책 문서화 목적) 추가 또는 중복 방지 로직 구현 |
| 17 | 테스트 | `rag-search.service.ts` 두 번째 query embed 경로(line ~443) 테스트 누락 | `rag-search.service.spec.ts` | 두 번째 query embed 호출 경로 커버 테스트 추가 |
| 18 | 테스트 | `EmbeddingModelCombobox.renderOption` 분기 로직 테스트 없음 — `m.name && m.name !== m.id` 조건 + 추천 배지 결합 로직 미검증 | `embedding-model-combobox.tsx` | `renderOption` 순수함수 추출 후 단위 테스트 또는 컴포넌트 렌더링 테스트에 추천/비추천 케이스 추가 |
| 19 | 문서화 | `spec/5-system/8-embedding-pipeline.md §5.4` 의 `LlmService.embed` 인자 순서 기술이 실제 시그니처(`config` 첫 번째 인자 등)와 미미하게 어긋남 | `spec/5-system/8-embedding-pipeline.md §5.4` | spec §5.4 시그니처 기술을 실제 `embed(config, texts, model?, opts?, inputType)` 로 정정 |
| 20 | 문서화 | `LlmService.embed` 서비스 계층 메서드에 JSDoc 독스트링 없음 — `inputType` 기본값·`opts` 파라미터 전달 규약 파악에 구현 코드 직접 읽기 필요 | `llm.service.ts embed()` | JSDoc 추가: `@param inputType` 기본값 `'document'`, 검색 query 경로에서만 `'query'` 명시 |
| 21 | 문서화 | `embedding-input-type.ts` 세 순수함수(`applyEmbeddingInputPrefix`, `resolveEmbeddingInputStrategy`, `resolveGeminiTaskType`)에 JSDoc 파라미터 설명 없음 | `embedding-input-type.ts` | 최소 `@param` / `@returns` JSDoc 추가; `model?: undefined` 허용 이유·no-op 보장 명시 |
| 22 | 문서화 | `embedding-model-recommendation.ts` 패턴 배열 참조처가 소멸 예정인 `plan/in-progress/` 경로 | `embedding-model-recommendation.ts` 파일 상단 주석 | 참조처를 `spec/2-navigation/5-knowledge-base.md §2.2` 로 교체; 패턴 추가 방법 한 줄 언급 |
| 23 | 유지보수성 | `resolveGeminiTaskType` 가 `'document'` 이외 값을 묵시적 else 로 처리 — `EmbedInputType` 에 값 추가 시 묵시적 기본값으로 런타임 버그 가능 | `embedding-input-type.ts` `resolveGeminiTaskType` | `switch` 구문 또는 `Record<EmbedInputType, ...>` 매핑 테이블로 exhaustive-check 강제 |
| 24 | 유지보수성 | `embedding-input-type.ts` 파일 헤더 주석에 이모지(`⚠️`) 포함 — 터미널·로그 도구 렌더링 문제 및 검색 노이즈 | `embedding-input-type.ts:26` | 이모지 제거, `NOTE:` 또는 `IMPORTANT:` 텍스트 마커로 대체 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정규식 ReDoS 없음, XSS 벡터 없음, 인젝션 위험 없음 |
| performance | NONE | 배치당 정규식 1회 실행, API RTT 대비 신규 연산 비용 무시 가능 |
| architecture | LOW | `AnthropicClient.embed` 시그니처 LSP 경미 위반(WARNING) |
| requirement | LOW | `LlmService.embed` opts 파라미터 spec §3.3 미기술(SPEC-DRIFT WARNING) |
| scope | NONE | 26개 파일 전체가 plan 정의 Phase A/B/C 범위 내, 불필요한 변경 없음 |
| side_effect | MEDIUM | 기존 Gemini/e5 KB 배포 즉시 벡터 공간 불일치(데이터 마이그레이션 갭) |
| maintainability | LOW | `LlmService.embed` 파라미터 순서로 인한 `undefined` 삽입 패턴 5곳 반복 |
| testing | LOW | `AnthropicClient` throw 동작 검증 누락, Google 기본값 독립 케이스 부재 |
| documentation | LOW | `LlmService.embed` JSDoc 누락, spec §5.4 시그니처 기술 미미한 불일치 |

---

## 발견 없는 에이전트

해당 없음 — 모든 에이전트가 1건 이상 발견사항을 보고함. security·performance·scope 에이전트는 NONE 위험도 판정으로 즉각적 조치 불필요 발견만 보고.

---

## 권장 조치사항

1. **[필수 — 배포 전] 배포 런북에 재임베딩 지침 기술**: Gemini 계열 및 e5 계열 모델 사용 KB/AgentMemory 를 배포 직후 재임베딩하지 않으면 검색 품질이 자동 저하됨. 배포 절차에 반드시 포함 (WARNING #1, #2).

2. **[권장] `AnthropicClient.embed` 시그니처를 인터페이스와 일치시키기**: `embed(_texts?: string[], _model?: string, _inputType?: EmbedInputType): Promise<number[][]>` 로 명시 (WARNING #3).

3. **[권장] `LlmService.embed` 파라미터 순서 개선**: `opts` 를 마지막으로 이동하거나 options 객체로 병합해 5개 호출부의 `undefined` 삽입 패턴 해소 (WARNING #4, #5). 단기 완화책으로 인라인 주석(`/* opts */`) 추가.

4. **[권장] 테스트 커버리지 보강 — WARNING 수준**: `AnthropicClient.embed` throw 테스트 추가, `google.client.spec.ts` 기본값 독립 케이스 추가 (WARNING #6, #7).

5. **[권장] spec SPEC-DRIFT 갱신**: `spec/5-system/7-llm-client.md §3.3` 에 `LlmService.embed` 의 `opts` 파라미터 기술 추가 (WARNING #8).

6. **[선택] `spec/5-system/8-embedding-pipeline.md §5.4` 시그니처 기술 정정**: `LlmService.embed(config, texts, model?, opts?, inputType)` 실제 순서로 수정 (INFO #19).

7. **[선택] `LlmService.embed` 및 순수함수 3종에 JSDoc 추가**: `inputType` 기본값·`opts` 파라미터 전달 규약·`model?: undefined` 허용 이유 명시 (INFO #20, #21).

8. **[선택] `embedding-model-recommendation.ts` 참조처 교체**: `plan/in-progress/` 대신 `spec/2-navigation/5-knowledge-base.md §2.2` 로 변경 (INFO #22).

9. **[선택] `resolveGeminiTaskType` exhaustive-check 강화**: `switch` 또는 `Record<EmbedInputType, ...>` 매핑으로 타입 확장 시 누락 방지 (INFO #23).

10. **[선택] 코드 주석 이모지(`⚠️`) 텍스트 마커로 대체**: `IMPORTANT:` 또는 `NOTE:` 로 교체 (INFO #24).

---

## 라우터 결정

라우터 작동 — 선별 실행:

**실행** (9명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`

**강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

**제외** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 외부 의존성 추가 없음 — 기존 llm 모듈 내 순수함수 확장 |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 동시성 제어 변경 없음 — 기존 배치 처리 구조 유지 |
| api_contract | 외부 공개 API 계약 변경 없음 — 내부 서비스 시그니처 확장 |
| user_guide_sync | 사용자 가이드 동기화 대상 변경 없음 |