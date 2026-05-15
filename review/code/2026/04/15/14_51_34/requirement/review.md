### 발견사항

- **[INFO]** `toKeyValueEntries`의 Record 경로에서 빈 key 필터링 누락
  - 위치: `http-request.handler.ts` — `toKeyValueEntries` 함수, `typeof value === 'object'` 분기
  - 상세: 배열 경로에서는 `key.trim()` 후 빈 문자열을 `continue`로 걸러내지만, `Record<string, unknown>` 경로(`Object.entries`)에서는 동일한 필터가 없음. 레거시 호환 경로이므로 실제 영향은 낮으나 일관성 문제가 있음
  - 제안: `Object.entries(...).filter(([k]) => k.trim()).map(...)` 처리 추가

- **[INFO]** `x-www-form-urlencoded` bodyType에서 배열/중첩 객체 처리 미정의
  - 위치: `http-request.handler.ts` L147–L157
  - 상세: `toKeyValueEntries(body)`는 `body`가 `Record<string, unknown>` 형태일 경우 `stringifyScalar`를 통해 값을 직렬화하나, `body`가 `Array<{ key, value }>` 형태로 전달될 수 있음. 이 경우도 정상 동작하나, 두 입력 형태에 대한 명시적 계약이 없어 이후 유지보수 시 혼란 가능성 존재
  - 제안: 함수 JSDoc 또는 타입 시그니처에 허용 입력 형태 명시

- **[INFO]** `integrationId` 필드가 authentication 변경 시 잔존
  - 위치: `integration-configs.tsx` — `SelectField onChange` 핸들러
  - 상세: `authentication`을 `"integration"`에서 `"none"` 또는 `"custom"`으로 변경하더라도 `config.integrationId` 값이 config 객체에 그대로 남음. UI에서는 `IntegrationSelector`가 숨겨지지만 config 데이터에는 stale한 `integrationId`가 잔존하여 백엔드로 전달될 수 있음
  - 제안: authentication 변경 핸들러에서 `integrationId`를 초기화 (`onChange({ ...config, authentication: v, integrationId: undefined })`)

- **[INFO]** `form-data` bodyType 테스트에서 FormData 항목 값 검증 없음
  - 위치: `http-request.handler.spec.ts` — `should send form-data body and omit explicit Content-Type` 테스트
  - 상세: `args.body`가 `FormData` 인스턴스임을 확인하지만 실제로 올바른 key/value가 append 되었는지 검증하지 않음. Node.js 환경에서 `FormData.get()`을 사용하여 값 검증이 가능
  - 제안: `expect((args.body as FormData).get('field')).toBe('value')` 검증 추가

- **[INFO]** `should drop header rows with empty keys` 테스트에서 Content-Type 헤더 계산 포함 여부 미확인
  - 위치: `http-request.handler.spec.ts` L230 — `expect(Object.keys(headers)).toHaveLength(1)`
  - 상세: GET 요청이므로 body 처리가 없어 `Content-Type`은 추가되지 않음. 하지만 `toHaveLength(1)` 단언이 이 전제에 의존하고 있어, body가 있는 POST 요청으로 변경 시 테스트 의도가 불명확해짐
  - 제안: `expect(Object.keys(headers)).toEqual(['X-Keep'])` 형태로 정확한 목록 검증

---

### 요약

이번 변경은 `queryParams`·`headers`·`body`의 데이터 형태를 `Record<string, string>`에서 `Array<{ key, value }>`로 통일하는 핵심 스키마 마이그레이션을 잘 반영하고 있으며, 레거시 형태와의 하위 호환성도 `toKeyValueEntries`의 분기 처리를 통해 유지하고 있습니다. `form-data`/`x-www-form-urlencoded` bodyType 추가와 인증 헤더 병합 동작도 요구사항에 부합하게 구현되었습니다. 다만 UI에서 authentication 전환 시 `integrationId` 잔존 문제는 백엔드에 불필요한 값이 전달될 수 있어 주의가 필요하고, 일부 테스트에서 세부 값 검증이 누락된 점과 `toKeyValueEntries`의 Record 경로에서 빈 키 처리가 배열 경로와 일관되지 않는 점은 보완이 권장됩니다.

### 위험도
**LOW**