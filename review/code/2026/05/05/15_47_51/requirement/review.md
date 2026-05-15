### 발견사항

---

- **[WARNING]** `keyValueSchema` 주석과 실제 config schema 불일치
  - 위치: `http-request.schema.ts` — `keyValueSchema` JSDoc 및 `httpRequestNodeConfigSchema`
  - 상세: 주석이 `headers / queryParams / cookies` 세 필드 모두에 사용된다고 명시하지만, `httpRequestNodeConfigSchema`에는 `headers`, `queryParams` 배열만 존재하고 `cookies` 필드가 없음. 주석이 미래 계획을 선행 기술하는 건지, 누락인지 불명확.
  - 제안: `cookies` 필드를 실제로 추가하거나, 주석을 현재 적용 범위(`headers / queryParams`)로 좁혀 수정.

---

- **[WARNING]** `optionSchema.value` 의 `optional()` → `default('')` 전환으로 인한 하위 호환 영향
  - 위치: `form.schema.ts` — `optionSchema`
  - 상세: 변경 전 `parse({ label: 'Yes' })` 결과는 `{ label: 'Yes' }` (value 키 없음)였으나, 변경 후 `{ label: 'Yes', value: '' }`가 됨. 기존에 `option.value === undefined` 또는 `option.value` 존재 여부로 "값 미설정" 판별을 하던 핸들러나 프론트 로직이 있다면 오동작 가능.
  - 제안: `formNodeOutputSchema` / form 핸들러의 `interaction.data` 병합 로직에서 `value` 존재 여부 판별 패턴이 있는지 확인. 없다면 INFO 수준으로 내릴 수 있음.

---

- **[INFO]** `keyValueSchema.key` 에 비어있는 문자열(`''`) 허용
  - 위치: `http-request.schema.ts` — `keyValueSchema.key` / `http-request.schema.spec.ts`
  - 상세: `z.string()` 만 사용하므로 빈 문자열 `key`가 파싱을 통과함. 빈 키를 가진 entry가 `headers` 또는 `queryParams` 배열에 들어가면 HTTP 요청 시 빈 헤더명·쿼리 파라미터명이 전송될 수 있음. `warningRules`에도 헤더/쿼리 항목의 키 비어있음을 검출하는 규칙 없음.
  - 제안: `z.string().min(1)` 적용 또는 핸들러 실행 시 빈 `key` entry를 무시(skip)하는 로직 추가. 단, UI에서 임시 빈 행 추가 패턴이 있다면 스키마 레벨보다 핸들러 레벨 처리가 적합.

---

- **[INFO]** `keyValueSchema.value` 가 `z.string()` 으로 강제 — non-string 메타값 전달 불가
  - 위치: `http-request.schema.ts` — `keyValueSchema.value`
  - 상세: `passthrough()`로 추가 메타 필드(e.g. `enabled: true`, `description: '...'`)를 보존하지만, 코어 필드인 `value` 자체는 `z.string()` 으로 제한됨. 향후 UI에서 `value: boolean` 형태의 토글 항목을 지원할 경우 스키마가 걸림돌이 될 수 있음. `optionSchema.value` 가 `z.unknown()`인 것과 대비됨.
  - 제안: 현재 HTTP 헤더·쿼리 값은 문자열이 맞으므로 즉각 변경 불필요. 단, 표현식(expression) 위젯을 통해 런타임 치환 값이 문자열 외 타입이 될 가능성이 있다면 `z.unknown()` 로 완화 검토.

---

- **[INFO]** `passthrough` 테스트의 `as Record<string, unknown>` 이중 캐스트
  - 위치: `http-request.schema.spec.ts` L22, `form.schema.spec.ts` L56
  - 상세: `keyValueSchema.parse(...)` 반환 타입이 TypeScript 상 구체적이지 않아 입력 side 캐스트(`as Record<string, unknown>`)와 출력 side 캐스트(`const extra = parsed as Record<string, unknown>`)를 모두 사용. 기능 문제는 없으나 `.passthrough()` 적용 시 반환 타입이 `z.infer<...> & Record<string, unknown>` 로 확장되지 않는 zod 의 타입 시스템 한계임.
  - 제안: 현행 유지. 단, 장기적으로 [zod v4 의 `z.looseObject()`](https://zod.dev) 등 대안 API로 전환 시 개선 가능.

---

### 요약

네 파일의 변경은 `keyValueSchema` passthrough 노출과 `optionSchema.value` 기본값 보정이라는 두 가지 명확한 요구사항을 충족하며, 핵심 기능 구현과 테스트 커버리지(정상·경계·passthrough)가 정합함. 다만 `keyValueSchema` JSDoc에 명시된 `cookies` 필드가 실제 config schema에 존재하지 않아 구현 누락 가능성이 있고, `optionSchema.value` 의 `optional()` → `default('')` 전환이 기존 핸들러·프론트 코드에서 "값 미설정" 판별을 `undefined` 비교로 구현했다면 조용히 깨질 수 있으므로 하위 소비 코드 확인이 필요하다.

### 위험도

**LOW**