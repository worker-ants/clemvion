# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/6-config.md` (변경분: `spec/1-data-model.md` 포함)

---

## 발견사항

### 1. INFO — R-4 Rationale 갱신: `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 오류 코드 교정
- **target 위치**: `spec/2-navigation/6-config.md` §B.6.2 Base URL 행, §Rationale R-4
- **과거 결정 출처**: `spec/5-system/9-rag-search.md §6 에러 처리` + 동일 파일의 "에러 레이어 구분" 주석
- **상세**: 변경 전 spec 은 SSRF 가드 차단 응답 코드로 `RERANK_CONFIG_INVALID` 를 사용했다. 변경 후에는 `MODEL_CONFIG_INVALID` 로 교정됐다. `spec/5-system/9-rag-search.md §6` 에는 "에러 레이어 구분: `RERANK_CONFIG_INVALID` 은 검색 실행(rerank 호출) 레이어 전용 에러이고, `MODEL_CONFIG_INVALID` / `MODEL_CONFIG_NOT_FOUND` 은 설정 CRUD(`/api/model-configs`) 레이어 전용이다"라는 명시적 레이어 구분이 이미 존재한다. `spec/5-system/7-llm-client.md §6` 에러 처리 표도 SSRF 차단 코드를 `MODEL_CONFIG_INVALID` 로 정의한다(`§5.5 SSRF 가드: MODEL_CONFIG_INVALID 로 차단`). 따라서 이번 변경은 기각된 대안을 재도입하는 것이 아니라, 기존 레이어 구분 원칙에 맞게 오기를 교정하는 Rationale-정합 수정이다. 번복이나 기각 대안 재도입이 아니므로 등급은 INFO 에 그친다.
- **제안**: 변경 자체는 올바르다. 추가로 `spec/5-system/9-rag-search.md §6` 의 "에러 레이어 구분" 주석을 이번 교정의 근거 단편으로 cross-ref 링크로 연결하면 향후 오기 재발을 방지할 수 있다.

### 2. INFO — `spec/1-data-model.md §2.16 provider` 필드: `rerank Planned` → `rerank Dropped` 현행화
- **target 위치**: `spec/1-data-model.md §2.16 ModelConfig` provider 컬럼 설명
- **과거 결정 출처**: `spec/5-system/7-llm-client.md §2.1 리랭크 프로바이더` + 동일 파일 `## Rationale "왜 리랭크 provider 확장을 drop 했나"`
- **상세**: 변경 전 표기(`rerank Planned(후속): jina / voyage / local / builtin`)는 2026-06-05 사용자 결정으로 Dropped 된 provider 를 여전히 "Planned" 로 표시하는 SPEC-DRIFT 였다. LLM 클라이언트 spec 의 `§2.1`, `## Rationale`, `RerankClientFactory §4.1` 는 모두 2026-06-05 결정 이후 Dropped 로 현행화돼 있었으나 데이터 모델 spec 만 구 표기를 유지하고 있었다. 이번 변경은 그 누락을 동기화하는 것으로, 기각된 대안의 재도입이나 합의 원칙 위반이 아니다.
- **제안**: 변경 내용과 동기화 근거가 Rationale 에 이미 존재하므로 현행 수정으로 충분하다. 데이터 모델 spec 에 `§2.16 Rationale (ModelConfig 통합)` 항이 이미 있으나 provider drop 결정에 대한 교차 참조(`[LLM Client §Rationale](./5-system/7-llm-client.md#rationale)`)를 명시적으로 추가하면 정합성이 더 명확해진다.

---

## 요약

이번 변경(`spec/2-navigation/6-config.md`, `spec/1-data-model.md`)은 두 가지 Rationale-정합 교정이다. 첫째, SSRF 가드 오류 코드를 `RERANK_CONFIG_INVALID`(검색 실행 레이어 전용) 에서 `MODEL_CONFIG_INVALID`(설정 CRUD 레이어 전용)로 교정해 `spec/5-system/9-rag-search.md §6` 의 명시적 레이어 구분 원칙과 `spec/5-system/7-llm-client.md §5.5·§6` 의 에러 코드 정의에 부합하게 됐다. 둘째, 데이터 모델의 rerank provider 표기를 이미 합의된 2026-06-05 Dropped 결정에 맞게 현행화했다. 어느 쪽도 기각된 대안을 재도입하거나 합의 원칙을 위반하지 않으며, 기존 Rationale 연속성을 강화하는 방향의 수정이다.

---

## 위험도

NONE
