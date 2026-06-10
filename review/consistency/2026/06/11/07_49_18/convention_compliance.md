# 정식 규약 준수 검토 결과

검토 모드: `--impl-done` · diff-base: `origin/main`  
범위: V-06/V-08 makeshop catalog 구현 완료 (backend `buildOperationCatalog` + controller Swagger, frontend `tryTranslateLabel` flat-dict lookup)

---

## 발견사항

### **[WARNING]** `spec/2-navigation/4-integration.md` Rationale L1147 — 구현 완료 후 stale
- **target 위치**: `spec/2-navigation/4-integration.md` L1147 ("**왜 초기엔 cafe24 만 응답하나**" 단락)
- **위반 규약**: CLAUDE.md 정보 저장 위치 원칙 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 에 있으며 구현과 동기 유지 의무
- **상세**: 해당 단락은 "초기엔 cafe24 만 응답한다"는 구 결정의 근거를 서술한다. V-06/V-08 구현으로 `makeshop` 도 `operations[]` 를 채워 반환하게 됐으나, L1147 본문이 갱신되지 않아 "cafe24 만 응답하나"라고 남아 있다. 이와 동일 단락의 인접 표 (L1132–L1139 `api_label` 채우기 표)도 `cafe24 만 catalog 라벨을 갖고 나머지 3종은 endpoint-only` 라고 기술되며, L830 ActivityItem 설명의 요약 문자열 `"cafe24 는 …, 나머지 3종은 NULL"` 도 makeshop 이 이제 `api_label` 을 채운다는 사실을 반영하지 못한다.
  - §9.3 본문 (L816) 은 이미 갱신됐다("`:type='cafe24'` 및 `:type='makeshop'` 만 … 반환"). §4.6 인라인 설명 (L378) 도 `makeshop 도 동일`로 갱신됐다. 따라서 남은 stale 지점은 Rationale 절의 서술(L1147)과 L1132–1139 표·L830 요약 두 곳이다.
- **제안**:
  1. L1147 "왜 초기엔 cafe24 만 응답하나" → "왜 cafe24·makeshop 만 응답하나" 로 제목 수정, 본문을 현재 구현 상태로 갱신 (makeshop 포함 설명 추가, "초기엔" 시제 제거).
  2. L1132–1139 표 항목의 `api_label` 컬럼: `cafe24` 행 아래에 `makeshop` 행(`makeshop.<resource>.<operation>`) 추가.
  3. L830 ActivityItem `apiLabel` 요약 문자열 `"cafe24 는 …, 나머지 3종은 NULL"` → `"cafe24·makeshop 은 …, 그 외 통합은 NULL"` 로 수정.
  - 단, §9.3 본문과 §4.6 설명은 이미 갱신됐으므로 위 세 지점만 수정하면 된다. 규약 파일(`makeshop-api-metadata.md`) 의 `§2` catalog key 형식은 이미 `makeshop.<resource>.<operation>` 으로 올바르게 정의되어 있다.

---

### **[INFO]** controller Swagger `@ApiParam` example 값이 `cafe24` 단일로 유지됨
- **target 위치**: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `@ApiParam({ name: 'type', ..., example: 'cafe24' })` (diff `-44/+45`)
- **위반 규약**: `spec/conventions/swagger.md §2-3` — Path 파라미터 `@ApiParam.example` 은 실제 지원되는 대표값을 노출해야 한다. 동일 데코레이터의 `description` 필드에서는 이미 `cafe24 · makeshop` 두 값을 지원한다고 명시했으나, `example` 은 `cafe24` 단일로 남아 있다.
- **상세**: API 문서 가독성 문제로, 두 값이 지원되는데 하나만 example 로 노출되면 makeshop 카탈로그를 시도하는 개발자가 example 을 그대로 복사해 실행한다. 규약 위반 수준은 낮다 — description 에 이미 두 값이 명시되어 있으므로 혼란 유발 가능성은 제한적이다.
- **제안**: `example: 'cafe24'` → `example: 'makeshop'` 또는 `examples: { cafe24: {...}, makeshop: {...} }` 중 하나로 보완. 혹은 `description` 에 기술된 두 값 중 makeshop 을 예시로 올려 새 기능이 Swagger UI 에서 바로 테스트되도록 할 것.

---

## 요약

구현 변경 자체는 정식 규약(`makeshop-api-metadata.md §2` 의 catalog key 형식 `makeshop.<resource>.<operation>`, `swagger.md` 의 `ApiOkWrappedResponse` + `@ApiOperation`·`@ApiParam` 패턴, `makeshop-api-catalog/_overview.md §3` 의 표 컬럼 정책)을 올바르게 따르고 있다. `buildOperationCatalog` 헬퍼의 `key`/`labelKey` 동일성과 `descriptionKey` suffix 규칙도 `cafe24-api-metadata.md §7.5` 의 `descriptionKey` 파생 규칙에 부합한다. 단, 구현 완료로 무효화된 Rationale 단락(L1147 "왜 초기엔 cafe24 만 응답하나")과 그 인접 표·ActivityItem 요약 문자열이 갱신되지 않아 spec 내부의 서술 일관성이 깨졌다(WARNING). 이는 다른 시스템의 invariant 를 직접 파괴하지는 않으나 spec 을 참조하는 개발자에게 혼란을 줄 수 있다. Swagger example 값 단일화는 규약 위반 수준이 낮은 형식 일관성 이슈(INFO)다.

## 위험도

LOW
