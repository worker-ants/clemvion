# 신규 식별자 충돌 검토 — Unified Model Management Spec Draft

**대상**: `plan/in-progress/spec-draft-unified-model-management.md`
**검토 일시**: 2026-06-10

---

## 발견사항

### **[CRITICAL] 마이그레이션 버전 번호 V088 선점 충돌**
- target 신규 식별자: `V088` (`llm_config` → `model_config` rename + `kind`/`dimension` 추가)
- 기존 사용처: `plan/in-progress/exec-intake-queue-impl.md` line 51 — PR2b(`claude/impl-concurrency-cap-pr2b`)가 `execution.queued_at` 신설 마이그레이션을 `V088`로 확정("`queued_at` 신설 확정(V088)")
- 상세: 두 개의 독립적인 in-progress plan이 동일 마이그레이션 버전 번호 V088을 지정하고 있다. exec-intake-queue-impl의 V088은 `execution.queued_at` 컬럼 추가이고, 본 draft의 V088은 `llm_config`→`model_config` 테이블 rename이다. draft 자체가 "현시점 max V087 기준 예시"이므로 구현 착수 시 동적 재할당한다는 주석이 있으나, exec-intake-queue-impl도 같은 max V087 기준에서 V088을 이미 선점해 문서화했다. 두 plan이 동시에 착수하면 race 발생.
- 제안: draft 본문의 V088~V092 예시 번호 주석에 "exec-intake-queue-impl PR2b의 V088 선점 확인 필요"를 추가하거나, 예시 번호를 더 높게 조정(예: V090~V094)한다. 착수 직전 `check-migration-versions.py`로 실제 max를 확인해야 하며, 이 충돌 가능성을 plan 본문에 명시한다.

---

### **[WARNING] `ModelConfig` 엔티티명 — 코드베이스 `ModelInfo`와 근접 혼동**
- target 신규 식별자: `ModelConfig` (spec §2.16의 새 통합 엔티티명, DB 테이블 `model_config`)
- 기존 사용처: `spec/5-system/7-llm-client.md` line 171 (`ModelInfo` 인터페이스 정의), `codebase/frontend/src/lib/api/llm-configs.ts` line 24 (`ModelInfo` export), `codebase/frontend/src/components/llm-config/` 다수 파일 (`use-base-model-loader.ts`, `model-select-field.tsx`, `embedding-model-recommendation.ts` 등에서 `ModelInfo` 타입 임포트)
- 상세: `ModelConfig`(저장된 provider 설정 엔티티)와 `ModelInfo`(provider `listModels` 응답 항목 DTO)는 의미가 다르나 접두어 `Model`을 공유해 혼동 여지가 있다. 프론트엔드 컴포넌트가 `ModelInfo`를 광범위하게 사용하고 있으며, 이 파일들이 `ModelConfig` 기반 API로 전환될 때 두 타입을 혼동할 위험이 있다.
- 제안: draft 변경 4/6-F에서 이미 구분 주석 추가를 계획 중이다. 이를 spec에만 추가하는 데 그치지 않고, 구현 단계에서 프론트엔드 API 모듈 파일 JSDoc에도 같은 구분 주석을 명시하도록 구현 plan에 기재한다.

---

### **[WARNING] `model_config.*` 감사 액션명 — 기존 `llm_config.*`/`rerank_config.*` append-only 기록과 공존**
- target 신규 식별자: 감사 로그 액션명 `model_config.*` (`model_config.create` / `model_config.update` / `model_config.delete` / `model_config.set-default`)
- 기존 사용처: `spec/5-system/1-auth.md` line 348 — `llm_config.*`(`create/update/delete/set-default`) 및 `rerank_config.*`(`create/update/delete/set-default`)가 현재 정의된 감사 액션 집합
- 상세: 기존 `llm_config.*`/`rerank_config.*` 액션명과 신규 `model_config.*` 액션명이 동일 audit_log 테이블에 append-only로 공존한다. draft 변경 6-C에서 이 처리를 "과거 기록은 보존, 신규만 model_config.*"로 명시하고 있으나, 보고/검색 쿼리에서 두 세트를 모두 고려해야 한다는 점이 spec에 충분히 기술되지 않았다.
- 제안: `spec/5-system/1-auth.md §4.1`에 "전환 시점(예: 본 PR 적용) 이후 신규 감사 로그는 `model_config.*` 사용; 기존 `llm_config.*`/`rerank_config.*` 행은 append-only 보존. 감사 쿼리에서 두 세트를 OR로 결합해야 함"을 명시한다.

---

### **[WARNING] `/models` 네비게이션 URL — 기존 `/llm-configs` 대체**
- target 신규 식별자: 네비게이션 URL `/models` (변경 6-D: `spec/2-navigation/_layout.md` 항목 7 `/llm-configs` → `/models`)
- 기존 사용처: `spec/2-navigation/_layout.md` line 66 — 항목 7이 `/llm-configs`로 등록되어 있음
- 상세: `/models`는 짧고 일반적인 경로로, 향후 다른 모델 관련 기능(마켓플레이스 모델 등)과 혼동 가능하다. 기존 사용자의 `/llm-configs` 북마크 redirect 정책이 spec에 명시되지 않았다.
- 제안: spec에 `/llm-configs` → `/models` redirect 정책(영구 301 또는 임시)을 명시한다. 대안으로 `/model-configs`를 검토하거나, redirect 계획을 변경 6-D에 추가한다.

---

### **[WARNING] `GET /api/model-configs/:id/models` 엔드포인트 — deprecation alias 기간 중 spec 텍스트 중복**
- target 신규 식별자: `GET /api/model-configs/:id/models` (모델 목록 조회)
- 기존 사용처: `spec/2-navigation/6-config.md` line 253 (`GET /api/llm-configs/:id/models`), `spec/5-system/7-llm-client.md` line 311 (동일 경로 참조)
- 상세: `/api/llm-configs/:id/models`가 deprecation alias로 유지되면서 `/api/model-configs/:id/models`가 신규 SoT가 된다. `7-llm-client.md §5.5`의 경로 참조는 변경 3 테이블에 갱신 대상으로 포함되어 있으나, `§5.5` 이외 본문(line 311의 반환값 설명)도 명시적 갱신 대상이 되어야 한다.
- 제안: 변경 3 `7-llm-client.md` 갱신 범위에 line 311 (`GET /api/llm-configs/:id/models` → `/api/model-configs/:id/models`)을 명시 추가한다.

---

### **[INFO] `dimension` 필드명 — `knowledge_base.embedding_dimension`과 SoT/캐시 관계**
- target 신규 식별자: `model_config.dimension` (embedding 전용, pgvector 차원 SoT)
- 기존 사용처: `spec/1-data-model.md §2.11` KnowledgeBase — `embedding_dimension` 컬럼 (저장된 청크들의 벡터 차원, 파생 캐시)
- 상세: `model_config.dimension`(SoT)과 `knowledge_base.embedding_dimension`(파생 캐시)은 동일 물리적 값이나 소유/캐시 관계가 다르다. draft 변경 6-G에서 이미 `8-embedding-pipeline.md §5.2`에 1줄 명시를 계획 중이다.
- 제안: `spec/1-data-model.md §2.16 ModelConfig` 표의 `dimension` 필드 설명에도 "SoT. KB.embedding_dimension은 이 값의 파생 캐시"를 1줄 추가해 data-model 내에서 자기완결적으로 명시한다.

---

### **[INFO] `kind` 필드명 — 기존 다른 엔티티 JSONB의 `kind` discriminator와 네임스페이스 공유**
- target 신규 식별자: `model_config.kind` DB 컬럼 Enum (`chat` | `embedding` | `rerank`)
- 기존 사용처: `spec/1-data-model.md` line 716 (WebAuthn JWT payload `kind: 'webauthn_register'|'webauthn_auth'`), line 747 (AssistantMessage.tool_calls JSONB `kind: 'explore'|'plan'|'edit'`), line 766 (AgentMemory.metadata `kind ∈ fact/preference/entity`)
- 상세: `kind`가 여러 JSONB 필드의 discriminator로 이미 광범위하게 쓰인다. DB 컬럼이라 엔티티 네임스페이스가 분리되어 실질적 충돌은 없으나, 코드 레이어에서 `kind` 문자열 리터럴 타입이 혼용될 수 있다.
- 제안: 구현 단계에서 `ModelConfigKind = 'chat' | 'embedding' | 'rerank'` 타입을 명시적으로 정의·export해 암묵적 string과 혼용되지 않도록 한다.

---

## 요약

신규 식별자 충돌 관점에서 가장 중요한 발견은 마이그레이션 버전 번호 V088 선점 충돌(CRITICAL)이다. `plan/in-progress/exec-intake-queue-impl.md`의 PR2b가 이미 V088을 `execution.queued_at` 컬럼 추가에 사용하도록 명시했고, 본 draft도 같은 V087 max 기준에서 V088을 `llm_config`→`model_config` rename에 배정했다. draft에 동적 재할당 주의사항이 있으나, 경쟁하는 plan이 구체적으로 문서화되어 있어 착수 시 충돌 위험이 실재한다. 나머지 WARNING 항목들(`ModelConfig`/`ModelInfo` 혼동 방지 코드 레이어 확장, 감사 액션명 이중 세트 공존 정책 명시, `/models` URL redirect 처리, deprecation alias 기간 중 spec 텍스트 갱신 범위 보완)은 실질적 식별자 충돌보다 spec 명확화 사안으로, 모두 draft의 기존 흡수 계획 안에서 처리 가능하다.

## 위험도

MEDIUM
