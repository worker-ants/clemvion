# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] 임베딩 차원 자동 감지 동작 변경이 유저 가이드에 미반영

- **변경 파일**:
  - `codebase/backend/src/modules/llm/llm.service.ts` (testConnection 반환 타입에 `dimension` 추가, embedding probe embed 경로 신설)
  - `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` (ModelTestConnectionResultDto 에 `dimension?: number` 추가)
  - `codebase/frontend/src/components/models/model-config-form-dialog.tsx` (차원 필드 read-only 자동 감지 완료 시 잠금)
  - `codebase/frontend/src/components/models/model-config-manager.tsx` (probe 결과로 dimension 자동 저장 + 토스트)

- **매트릭스 항목**: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"

- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/models.en.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/models.mdx`

- **상세**: 변경 전 유저 가이드(`models.en.mdx`, `models.mdx`)는 다음을 명시하고 있다.

  1. **Step 4** (EN line 103): "Enter the Dimension that matches the model (e.g. 1536 for OpenAI text-embedding-3-small)."
     — 변경 후에는 연결 테스트(probe embed) 로 자동 감지·저장되므로, 수동 입력 단계를 안내하는 것이 실제 UX 와 다르다.

  2. **Callout** (EN line 107): "The Dimension value cannot be changed after the Knowledge Base is created. Enter the correct dimension from the start."
     — 이제 연결 테스트를 누르면 자동 감지·저장되고, 저장 후에는 read-only 로 잠기는 동작이 추가됐다. "처음부터 올바른 값을 직접 입력" 안내는 더 이상 정확하지 않다.

  3. **FieldTable Dimension 행** (EN line 117): `required: "Required"`, description: "Varies by model; cannot be changed after the Knowledge Base is created."
     — 자동 감지 흐름이 있으므로 "Required"(수동 입력 필수) 표현과 설명을 "auto-detected via connection test; falls back to manual entry" 로 갱신해야 한다.

  4. **API 통합 레퍼런스** (EN line 200): `POST /api/model-configs/:id/test` 설명이 "Test the Chat or Embedding provider connection." 만 기재 — 변경 후 embedding 설정의 테스트 응답에는 `dimension` 필드가 포함되며, 테스트 시 자동 저장 동작이 있다는 안내가 누락돼 있다.

  KO 버전(`models.mdx`) 도 동일 구조로 동일 위치에 동일 내용이 있다(line 107, 120 등).

- **제안**:
  - `models.en.mdx` Step 4 를 "Run the connection test. The Dimension is auto-detected and saved. If auto-detection is unavailable, enter the value manually." 로 갱신.
  - Callout 를 "Dimension is auto-detected when you click Test. Once saved, the value is read-only." 로 교체.
  - FieldTable Dimension 행의 `required` 를 "Auto-detected / Optional" 로, description 을 자동 감지 동작 설명으로 갱신.
  - API 레퍼런스 테스트 endpoint 설명에 "For embedding configs, the response includes a `dimension` field with the auto-detected vector size." 추가.
  - `models.mdx` (KO) 에 동일한 갱신을 적용.

---

## 요약

매트릭스 총 18개 trigger 중 본 변경 set 에 매칭되는 trigger는 2개(`new-ui-string`, `backend-api-change`)다. `new-ui-string` — i18n dict ko/en 양쪽 (`models.dimensionAutoHint`, `models.dimensionManualHint`, `models.connectionSucceededDim`) 이 같은 변경 set 안에서 동시 등록돼 parity 충족. `backend-api-change` — `ModelTestConnectionResultDto.dimension` 신규 필드와 testConnection 의 embedding 분기 추가가 `06-integrations-and-config/models.{mdx,en.mdx}` 의 연결 테스트·차원 입력 안내 갱신 없이 머지됨. 누락 1건(WARNING).

## 위험도

WARNING
