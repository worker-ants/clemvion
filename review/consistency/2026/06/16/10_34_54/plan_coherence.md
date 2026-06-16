# Plan 정합성 검토 결과

## 검토 대상

- **Target**: `spec/2-navigation/6-config.md` (working tree 수정본)
- **검토 모드**: spec draft (--spec)
- **주요 변경 내용**:
  1. §B.6.2 Base URL 열: `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`
  2. R-1 Rationale: `LLM_MODEL_NOT_FOUND` 단정 서술 → "현재 `LLM_CONNECTION_ERROR` 수렴, `LLM_MODEL_NOT_FOUND`(404)는 Planned" 한정 서술로 완화
  3. R-4 Rationale: `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `local` 리랭커 provider Dropped 주석 추가

---

## 발견사항

### [INFO] spec-draft-unified-model-management.md 의 동일 파일 편집 scope 중복

- **target 위치**: `spec/2-navigation/6-config.md` §B.6.2, R-1, R-4
- **관련 plan**: `plan/in-progress/spec-draft-unified-model-management.md` — "대상 spec (전수)" 목록에 `spec/2-navigation/6-config.md` 포함
- **상세**: `spec-draft-unified-model-management.md` 는 `spec/2-navigation/6-config.md` 전반(Part B Models 화면, §3 API 표, R-3 번복 등)을 개정 대상으로 선언하고 있다. 본 target 수정은 오류 코드 정정(§B.6.2, R-1, R-4) 한정이라 unified-model-management plan 이 결정한 사항(llm_config→model_config rename, kind 필드, 임베딩 1급화, API 경로 통합)과 의미 충돌이 없다. 오히려 `MODEL_CONFIG_INVALID` 사용이 해당 plan 의 방향과 일치한다.
- **제안**: 충돌 없음 — 추적 메모 수준. unified-model-management plan 이 `spec/2-navigation/6-config.md` 를 다음 편집할 때 본 수정(오류 코드 정정)이 이미 반영된 상태임을 인지하면 된다.

---

## 점검 결과

### 1. 미해결 결정과의 충돌

`spec-draft-unified-model-management.md` 에 남아 있는 미결 결정(V088~V092 마이그레이션 번호 동적 할당, `set-default` kind 범위 명시 등)은 모두 데이터 모델·API 경로 관련이며, target 의 오류 코드 정정과 교차하지 않는다. **충돌 없음.**

`auth-config-webhook-followups.md` (in-progress) §3 spec 보완 잔여 항목(reveal 엔드포인트 `§5 API 표` 추가 등)도 target 편집 범위 밖이다. **충돌 없음.**

### 2. 선행 plan 미해소

Target 이 가정하는 사전 조건:
- `MODEL_CONFIG_INVALID` 에러 코드: `spec/5-system/3-error-handling.md` (line 48)에 이미 정의됨 — **해소된 선행 조건**.
- `LLM_MODEL_NOT_FOUND` Planned 상태: `spec/5-system/7-llm-client.md` §6 (line 345)에 "미구현(Planned)" 으로 명시됨 — **해소된 선행 조건**.
- `local` 리랭커 provider Dropped: `spec/5-system/7-llm-client.md §2.1` 에 반영됨 — **해소된 선행 조건**.

**선행 plan 미해소 없음.**

### 3. 후속 항목 누락

- 오류 코드 `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 로 정정하는 경우, `spec/5-system/9-rag-search.md` (line 339, 368, 374)는 `RERANK_CONFIG_INVALID` 를 rerank **실행 레이어** 전용으로 구분해 계속 사용한다. 동 파일 line 374 는 "에러 레이어 구분: `RERANK_CONFIG_INVALID` = 검색 실행 레이어 전용, `MODEL_CONFIG_INVALID` = 설정 CRUD 레이어 전용"으로 명시한다. 따라서 target 의 §B.6.2(설정 CRUD 레이어) 에 `MODEL_CONFIG_INVALID` 를 쓰는 것은 이 구분 규칙과 정합하며, `9-rag-search.md` 를 추가로 수정할 필요가 없다. **후속 누락 없음.**

---

## 요약

Target(`spec/2-navigation/6-config.md`) 의 세 가지 수정(§B.6.2 `MODEL_CONFIG_INVALID`, R-1 `LLM_MODEL_NOT_FOUND` Planned 한정, R-4 `MODEL_CONFIG_INVALID` + `local` Dropped 주석)은 모두 기존 spec(`3-error-handling.md §`, `7-llm-client.md §6`)의 확정 결정을 6-config.md 에 반영하는 정합 정정이다. 현재 진행 중인 plan(`spec-draft-unified-model-management.md`, `auth-config-webhook-followups.md`) 의 미결 항목과 의미 충돌이 없으며, 선행 조건도 이미 해소되어 있다. 후속 갱신이 필요한 spec 파일도 없다. Plan 정합성 관점에서 차단 사유 없음.

## 위험도

NONE
