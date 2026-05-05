## 발견사항

### `form.schema.ts`

- **[WARNING]** `optionSchema.value`: `optional()` → `default('')` 의미론적 변경
  - 위치: `form.schema.ts` — `value: z.unknown().optional()` → `value: z.unknown().default('')`
  - 상세: parse 결과가 달라진다. `value` 필드가 없는 기존 데이터를 재파싱하면 `undefined` 대신 `''`이 반환된다. 핸들러나 직렬화 코드가 `option.value === undefined` 또는 `option.value != null`로 "값 미설정" 여부를 판단하고 있다면 분기가 바뀐다.
  - 제안: `form.handler.ts`(또는 옵션 값을 처리하는 실제 핸들러)에서 `option.value`를 체크하는 코드를 확인하고, `=== undefined` / `!= null` 조건이 없는지 grep 검증 필요.

- **[INFO]** `optionSchema` `export` 추가 — 새 공개 API 표면
  - 위치: `export const optionSchema`
  - 상세: 이전까지 모듈 내부에 한정된 타입이었으나 이제 외부 import가 가능해진다. 향후 스키마를 변경하면 더 넓은 호출 범위에 영향이 간다.
  - 제안: `optionSchema`를 직접 import해 사용하는 코드가 늘어나면 변경 비용이 커지므로, 공개 API 의도가 맞는지 확인.

---

### `http-request.schema.ts`

- **[INFO]** `keyValueSchema` `.passthrough()` 추가
  - 위치: `keyValueSchema` 정의부
  - 상세: 기존에는 `headers`/`queryParams`/`cookies` 배열의 각 항목에서 `key`, `value` 외 필드는 파싱 시 strip됐다. 이제는 보존된다. 부모 `httpRequestNodeConfigSchema`도 이미 `.passthrough()`이므로 실질적 동작 차이는 미미하지만, `keyValueSchema`를 직접 parse하거나 `.strip()` 동작에 의존하는 코드가 있다면 영향을 받는다.
  - 제안: 현재 코드베이스에서 `keyValueSchema.parse(...)` 를 직접 호출하는 곳이 없다면 안전. 직접 사용처 grep 확인으로 충분.

- **[INFO]** `keyValueSchema` `export` 추가 — 새 공개 API 표면
  - 위치: `export const keyValueSchema`
  - 상세: 테스트 파일의 직접 import를 위해 노출됨. `optionSchema`와 동일한 맥락.

---

### 테스트 파일 (`*.spec.ts`)

- **[INFO]** 순수 추가. 기존 테스트 케이스를 변경하거나 기존 동작을 override하지 않는다. 부작용 없음.

---

## 요약

변경의 핵심 위험은 `optionSchema.value`의 기본값이 `undefined`에서 `''`으로 바뀐 것이다. `keyValueSchema`의 `.passthrough()` 추가나 두 심볼의 `export` 노출은 부작용이 거의 없지만, `value` 기본값 변경은 "값이 설정되지 않은 옵션"을 `undefined` 여부로 판별하는 핸들러 코드가 있을 경우 분기가 달라진다. 테스트가 `null`/`boolean`/`number` 명시값 보존은 검증하지만, 런타임 핸들러에서의 `=== undefined` 체크 시나리오는 커버하지 않는다. 나머지 변경은 모두 가산적이다.

## 위험도

**LOW**