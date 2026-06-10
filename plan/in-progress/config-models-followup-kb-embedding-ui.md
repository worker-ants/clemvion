---
worktree: (unstarted)
started: 2026-06-11
owner: developer
related_spec:
  - spec/2-navigation/6-config.md
  - spec/2-navigation/5-knowledge-base.md
  - spec/5-system/8-embedding-pipeline.md
related_plan:
  - plan/in-progress/unified-model-management.md
---

# Followup — KB 임베딩 select 의 kind=embedding 1급 config 선택 UX

> 분리 사유: Unified Model Management PR3 는 통합 `/models` 페이지(Chat/Embedding/Rerank 탭)를
> 완료했으나, **KB 임베딩 모델 선택 UI 의 1급 전환**은 별도 UX 변경 범위라 분리한다.
> 백엔드 PR2(`resolveEmbedding` 폴백 체인)가 backward-compat 으로 기존 KB 를 무중단 동작시키므로
> 본 followup 미완료 상태에서도 제품은 정상 동작한다 (legacy 폴백 경로).

## 배경 (현재 상태)

- 백엔드 PR2: `knowledge_base.embedding_model_config_id`(FK → ModelConfig kind=embedding) 신설.
  `resolveEmbedding` 폴백 체인: (1) embedding_model_config_id → (2) ws default kind=embedding →
  (3) legacy(embedding_llm_config_id + embedding_model 문자열).
- 프론트 PR3: `/models` 페이지에 Embedding 탭 생김 (kind=embedding config CRUD 가능).
- **미전환**: KB 생성/상세 폼(`kb-form-body.tsx`)의 임베딩 select 는 여전히
  `formEmbeddingModel`(문자열) + `EmbeddingModelCombobox`(useDefaultLlmConfigId = chat default
  폴백)를 쓴다 → KB 는 항상 legacy 경로(③)로 임베딩한다.

## 작업 (이 followup)

1. **`use-default-llm-config-id.ts` embedding 변형** — 워크스페이스 default `kind=embedding`
   ModelConfig id 를 조회하는 `useDefaultEmbeddingModelConfigId()` 추가(modelConfigsApi.list('embedding')).
2. **KB 폼에 `embeddingModelConfigId` 필드** — 임베딩 탭에 kind=embedding config select 추가
   (modelConfigsApi.list('embedding')). 선택 시 `EmbeddingModelCombobox` 의 config 소스를 그 id 로,
   `api={modelConfigsApi}` 주입. 상태: `formEmbeddingModelConfigId` (create-kb-form-dialog + [id]/page).
3. **create/update payload** — `embeddingModelConfigId` 포함 (knowledge-bases.ts api 타입 + 호출부).
4. **차원 교체 가드 UX** — embedding config 변경 시 "재임베딩 필요" 인라인 경고
   (기존 `kb-model-change-reembed-followup` 규칙 준수, EmbeddingTestButton 연계).
5. **i18n** — 임베딩 config select 라벨 (knowledgeBases.* 또는 models.* 재사용). KO/EN parity.
6. **테스트** — embeddingModelConfigId 선택·payload 전파·차원 리셋 경고.

## 주의

- legacy 필드(`embeddingLlmConfigId`·`embeddingModel`)는 PR4(V092)까지 폴백 유지 — 본 followup 은
  1급 경로를 **추가**하되 legacy 를 제거하지 않는다(제거는 PR4).
- 차원 교체 가드는 `kb-model-change-reembed-followup.md` 와 중복 정의 금지 — 그 규칙을 따른다.
