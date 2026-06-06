# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/embedding-model-ux.md` (P6 임베딩 모델 UX 보강)
검토 일시: 2026-06-06
검토 모드: --impl-prep

---

## 발견사항

### 1. WARNING — `inputType` 파라미터명이 프론트엔드 로컬 변수와 동일
- **target 신규 식별자**: `embed(texts, model?, inputType?: 'query' | 'document')` — 백엔드 `LLMClient.embed()` 시그니처에 추가되는 `inputType` 파라미터명
- **기존 사용처**: `codebase/frontend/src/app/(main)/integrations/_shared/credentials-form.tsx` line 102 — `const inputType = field.type === "number" ? "number" : field.secret ? "password" : "text";` (HTML `<input type=...>` attribute 를 담는 지역 변수)
- **상세**: 두 `inputType` 는 완전히 다른 도메인이다. 백엔드 쪽은 임베딩 API 의 query/document 구분자이고, 프론트엔드 쪽은 HTML input 태그의 type attribute 를 나타내는 지역 변수다. 서로 다른 파일·레이어이므로 런타임 충돌은 없다. 단, 코드베이스 전역 검색(grep / IDE 심볼 탐색) 시 두 개가 함께 잡혀 독해 노이즈를 유발할 수 있다.
- **제안**: 백엔드 파라미터를 `embeddingInputType` 또는 `embedInputType` 으로 명명하면 구분이 명확해진다. 단 변경은 필수가 아니며, 도메인 레이어가 분리되어 있어 혼동이 발생할 위험은 낮다.

### 2. WARNING — `recommendedBadge` i18n 키가 `integrations` 사전에 선행 정의되어 있음
- **target 신규 식별자**: `knowledgeBases.recommendedBadge` (또는 유사한 키) — Phase B 에서 `dict/{ko,en}/knowledgeBases.ts` 에 추가 예정인 "한국어 추천" 배지 i18n 키
- **기존 사용처**:
  - `codebase/frontend/src/lib/i18n/dict/en/integrations.ts` line 157: `recommendedBadge: "Recommended"`
  - `codebase/frontend/src/lib/i18n/dict/ko/integrations.ts` line 155: `recommendedBadge: "권장"`
- **상세**: `integrations` 사전에 이미 `recommendedBadge` 가 존재한다. `knowledgeBases` 사전에 같은 이름의 키를 추가해도 네임스페이스가 달라 런타임 충돌은 없다. 그러나 텍스트 의미가 상이할 경우(예: integrations 는 "권장" / knowledge-bases 는 "한국어 추천") 같은 키 이름이 다른 값을 담게 되어 혼동이 생긴다.
- **제안**: 의미가 다르다면 `knowledgeBases` 쪽 키를 `koreanRecommendedBadge` 또는 `embeddingKoreanBadge` 처럼 더 구체적인 이름으로 정의한다. 같은 "Recommended" 의미라면 공용 키로 통합하거나 별도 키를 두되 동일 값으로 맞춘다.

### 3. INFO — `input_type` 가 Cafe24 API 카탈로그에 기존 필드로 존재
- **target 신규 식별자**: spec 갱신 시 `8-embedding-pipeline.md §5` 에 기술할 `input_type` / `input_type/prefix` 용어
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/order/orderform-properties.md` — Cafe24 `orderform` API 의 필드명 `input_type` ("주문서 추가항목 입력 형식 T/M/R/C/S/D/I")
- **상세**: Cafe24 API 카탈로그는 외부 API 의 필드명을 그대로 표기한 문서이므로, 임베딩 파이프라인 spec 에서 새로 사용하는 `input_type` 개념과 의미가 전혀 다르다. 두 용어는 서로 다른 영역 spec 에 위치하고 교차 참조도 없으므로 실질 충돌은 없다. 단, 동일 레포 내 `input_type` 전역 검색 시 둘이 함께 노출된다.
- **제안**: 임베딩 파이프라인 spec 에 새로 추가하는 개념은 `embedding_input_type` 또는 코드 식별자(`EmbeddingInputType`, `resolveEmbeddingInputStrategy`) 수준의 명확한 명칭을 spec 본문에도 동일하게 사용하는 것이 혼동을 줄인다.

### 4. INFO — 신규 파일 경로 `embedding/embedding-input-type.ts` 는 기존 컨벤션과 정합
- **target 신규 식별자**: `codebase/backend/src/modules/knowledge-base/embedding/embedding-input-type.ts`
- **기존 사용처**: 같은 경로에 `embedding-dimensions.const.ts`, `embedding.service.ts`, `embedding.service.spec.ts` 가 존재. `embedding-input-type.ts` 는 아직 없음.
- **상세**: 기존 파일명 패턴(`embedding-*.ts`)과 일치하고, 충돌하는 파일 없음. 컨벤션 위반 없음.
- **제안**: 없음. 현재 명명대로 진행 가능.

### 5. INFO — `D-P6-*` 결정 ID 는 plan 내부 식별자이며 spec 요구사항 ID 와 분리
- **target 신규 식별자**: `D-P6-1`, `D-P6-2`, `D-P6-3`, `D-P6-4`, `D-P6-5` — plan 문서 내 결정 기록 ID
- **기존 사용처**: `rag-quality-improvement.md` 에 `§P6` 항목으로 P6 자체가 참조되나, `D-P6-*` 형식 결정 ID 는 해당 plan 이외 어느 파일에도 존재하지 않음.
- **상세**: `D-P6-*` 는 plan-level 내부 결정 ID 로 spec 요구사항 ID(NAV-KB-*, ND-AI-* 등) 체계와 별개다. 기존 spec 어디에도 `D-P6` 로 시작하는 식별자는 없으므로 충돌 없음.
- **제안**: 없음. 현행 표기 유지.

---

## 요약

P6 임베딩 모델 UX 보강이 도입하는 주요 신규 식별자(`inputType` 파라미터, `embedding-input-type.ts` 파일, `resolveEmbeddingInputStrategy`/`applyInputType` 함수, i18n 한국어 추천 배지 키, D-P6-* 결정 ID)는 기존 사용처와 직접 충돌하지 않는다. 다만 `inputType` 이 프론트엔드 지역 변수와 동일한 이름을 공유해 전역 검색 노이즈가 생기고, `recommendedBadge` i18n 키가 `integrations` 사전에 선행 정의되어 있어 동일 네임스페이스 충돌은 없지만 의미 차이가 명확하지 않으면 혼동이 생길 수 있다. `input_type` 용어는 Cafe24 API 카탈로그 외부 필드와 같은 문자열이지만 완전히 다른 영역에 위치하며 교차 참조도 없어 실질 충돌이 아니다. 전체적으로 심각도가 낮은 명명 명확화 수준의 개선 기회만 존재한다.

---

## 위험도

LOW
