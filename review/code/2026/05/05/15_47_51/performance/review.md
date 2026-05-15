### 발견사항

- **[INFO]** `.passthrough()` 적용 시 미知 키 복사 비용
  - 위치: `http-request.schema.ts` — `keyValueSchema`, `form.schema.ts` — `optionSchema`
  - 상세: `.passthrough()`는 파싱 시 알 수 없는 키를 모두 결과 객체에 복사한다. 요청마다 `headers` / `queryParams` 배열을 파싱하는 경로에서 헤더가 수십 개이고, 각 엔트리에 UI용 메타 필드(`description`, `enabled` 등)가 붙어 있으면 불필요한 키들이 핸들러 내부로 전파된다. 단일 요청 기준으로는 무시할 수준이지만, 고빈도 워크플로에서 파싱이 누적되면 GC 부담이 소폭 증가한다.
  - 제안: 핸들러 진입 직전에 `keyValueSchema` 배열을 `{ key, value }`만 남기는 가벼운 `map`으로 정규화하거나, 내부 처리용 스키마와 저장용 스키마를 분리해 passthrough 범위를 외곽 영역으로 한정하는 방안을 검토.

- **[INFO]** `z.unknown().default('')` — parse 호출 횟수 변화 없음, 이전과 동등
  - 위치: `form.schema.ts` L14 `value: z.unknown().default('')`
  - 상세: `.optional()` → `.default('')` 전환은 `undefined` 입력에 대해 기본값 객체를 한 번 더 참조하는 수준이다. Zod 내부적으로 기본값은 상수 참조이므로 추가 할당 없음.
  - 제안: 현재 구현 유지.

- **[INFO]** 스키마가 모듈 수준 상수로 선언되어 싱글턴 재사용 — 올바른 패턴
  - 위치: `keyValueSchema`, `optionSchema` 모두 모듈 최상단 `export const`
  - 상세: Zod 스키마는 생성 비용이 있으나 한 번만 생성되고 파싱마다 재사용된다. 함수 내부에서 매번 `z.object(...)` 를 호출하는 안티패턴 없음.
  - 제안: 현재 구조 유지.

### 요약

이번 변경은 스키마 정의와 단위 테스트에 국한된다. N+1 쿼리, 블로킹 I/O, 메모리 누수, 비효율 알고리즘과 같은 실질적인 성능 문제는 없다. `.passthrough()`가 미知 키를 결과 객체에 유지하는 특성이 고빈도 파싱 경로에서 미세한 GC 부담을 줄 수 있으나, 현재 사용 규모에서는 무시할 수준이다. 스키마는 모두 모듈 싱글턴으로 올바르게 선언되어 있다.

### 위험도

**NONE**