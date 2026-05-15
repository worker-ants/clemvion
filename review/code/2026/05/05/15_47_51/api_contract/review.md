### 발견사항

- **[WARNING]** `keyValueSchema`에 `.passthrough()` 추가 — HTTP 헤더/쿼리파라미터 구성 필드에 임의 필드 통과 허용
  - 위치: `http-request.schema.ts` — `keyValueSchema` 정의
  - 상세: 변경 전에는 `{ key, value }` 외의 필드가 Zod parse 시 strip되었으나, 이제 `description`, `enabled` 등 추가 필드가 그대로 통과됩니다. 이 schema는 `headers`, `queryParams` 배열의 엔트리 타입으로 사용되므로, HTTP 핸들러가 이 배열을 순회하며 실제 HTTP 요청을 조립할 때 `key`/`value` 외의 필드가 함께 전달될 수 있습니다. 핸들러가 entry 객체를 그대로 외부 라이브러리(e.g. axios)에 전달한다면 예상치 못한 동작이 발생할 수 있습니다.
  - 제안: HTTP 핸들러 내부에서 헤더/쿼리파라미터를 조립할 때 `entry.key`/`entry.value`만 명시적으로 추출하는지 확인이 필요합니다. `passthrough()`는 UI 메타 보존 목적이므로, 핸들러 레이어에서 `pick(['key', 'value'])`를 통해 전송 전 정제하는 방어 코드가 있는지 검토하세요.

- **[INFO]** `optionSchema.value`: `optional()` → `default('')` — 기본값 의미론 변경
  - 위치: `form.schema.ts` — `optionSchema`
  - 상세: 이전에는 `value`가 누락되면 `undefined`였고, 이 값이 저장된 기존 폼 응답이 있을 수 있습니다. 변경 후 새로 parse된 값은 `''`을 반환합니다. 저장된 config를 API를 통해 재로드할 때 `value: undefined` 항목이 `''`로 정규화되어 클라이언트 측 "변경 감지(dirty check)" 로직에서 false positive를 유발할 수 있습니다.
  - 제안: 기존 저장 데이터 마이그레이션 여부와, 프론트엔드의 폼 config 비교 로직이 `undefined`와 `''`를 동일하게 취급하는지 확인하세요.

- **[INFO]** `keyValueSchema`, `optionSchema` 내부 export 변경 — public API 노출
  - 위치: 두 schema 파일 모두
  - 상세: 테스트 접근을 위해 `export` 추가 자체는 문제 없으나, 이 schema들이 다른 패키지나 모듈에서 직접 import되기 시작하면 향후 구조 변경 시 광범위한 영향이 생깁니다.
  - 제안: 테스트 전용이면 `@internal` 주석을 달거나, 패키지 레벨에서 re-export 제어를 검토하세요.

---

### 요약

이 변경사항은 HTTP API 엔드포인트가 아닌 내부 노드 설정 스키마(config schema)에 관한 것으로, 직접적인 외부 API 계약 파괴(breaking change)는 없습니다. 다만 `keyValueSchema`에 추가된 `.passthrough()`는 HTTP 요청 핸들러가 헤더/쿼리파라미터 배열을 조립할 때 예상치 못한 추가 필드를 외부로 전송하지 않도록 핸들러 레이어에서의 방어적 추출 여부를 확인해야 합니다. `optionSchema.value`의 기본값 변경(`undefined` → `''`)은 기존 저장 데이터와의 의미론적 불일치 가능성이 있으나 실용적 개선입니다.

### 위험도

**LOW**