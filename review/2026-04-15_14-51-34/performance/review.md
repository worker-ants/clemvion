## 성능 코드 리뷰

### 발견사항

---

**[INFO]** `toKeyValueRecord` → `toKeyValueEntries` 이중 순회
- 위치: `http-request.handler.ts` — `toKeyValueRecord` 함수
- 상세: `toKeyValueRecord`는 내부적으로 `toKeyValueEntries`를 호출해 배열을 만든 뒤 다시 순회하여 객체를 구성합니다. 두 번의 루프가 발생하나, 실제 헤더/쿼리파라미터는 수십 개 수준이므로 실질적 부담은 없습니다.
- 제안: 성능보다 가독성이 더 중요한 규모이므로 현행 유지 가능. 단, 매우 큰 배열이 예상된다면 단일 `reduce`로 통합할 수 있습니다.

---

**[INFO]** `URLSearchParams` 두 번 생성 (쿼리파라미터 처리)
- 위치: `http-request.handler.ts` — `execute` 메서드 내 queryParams 처리 + credentials.queryParams 처리
- 상세: 사용자 쿼리파라미터와 인증 쿼리파라미터를 별도 `URLSearchParams` 인스턴스로 각각 문자열화하여 URL에 이어 붙입니다. 두 세트를 단일 `URLSearchParams`로 합쳐 한 번에 직렬화하면 객체 생성 1회 절감 및 URL 문자열 연결 1회 절감이 가능합니다.
- 제안:
  ```ts
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams)) params.append(k, v);
  if (credentials.queryParams) {
    for (const [k, v] of Object.entries(credentials.queryParams)) params.append(k, v);
  }
  if (params.size > 0) {
    url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
  }
  ```

---

**[INFO]** `stringifyScalar`의 `JSON.stringify` try-catch 오버헤드
- 위치: `http-request.handler.ts` — `stringifyScalar`
- 상세: 순환 참조 등 직렬화 불가 객체에 대해 예외 경로를 밟습니다. 헤더·파라미터 값으로 복잡한 객체가 넘어오는 것은 설계 오류이므로 이 경로는 사실상 방어 코드입니다. 일반 요청 경로에서는 비용이 발생하지 않으므로 현행 유지 적절합니다.

---

**[INFO]** 리다이렉트 재요청 시 `fetchOptions` 재사용 (불변성 관점)
- 위치: `http-request.handler.ts` — redirect while-loop
- 상세: 리다이렉트 루프에서 동일한 `fetchOptions` 객체(및 `AbortController.signal`)를 재사용합니다. `fetch` 스펙상 이미 소비된 `body` 스트림이 있으면 재전송 불가 문제가 발생할 수 있습니다. 현재 GET 요청에서 주로 발생하는 리다이렉트에는 body가 없어 문제없지만, POST + 리다이렉트 조합 시 잠재적 버그가 될 수 있습니다.
- 제안: 리다이렉트 시 method를 `GET`으로 전환하거나, `fetchOptions`에서 `body`를 제거한 새 옵션 객체를 생성하는 방어 로직 추가를 권장합니다.

---

**[INFO]** 프론트엔드 `authentication` 변수 추출 — 렌더링 성능
- 위치: `integration-configs.tsx` — `HttpRequestConfig`
- 상세: `(config.authentication as string) ?? "none"` 표현식을 변수로 추출한 것은 JSX 내 반복 평가를 줄이는 올바른 패턴입니다. 변경 자체는 성능 측면에서 긍정적입니다.

---

### 요약

이번 변경은 헤더·쿼리파라미터 처리를 객체 리터럴에서 `Array<{key, value}>` 형식으로 정규화하는 것이 핵심입니다. 추가된 유틸 함수(`toKeyValueRecord`, `toKeyValueEntries`, `stringifyScalar`)는 O(n) 선형 복잡도이고 처리 대상이 소규모(헤더/파라미터 수십 개)이므로 실제 성능 영향은 무시할 수준입니다. 가장 주목할 점은 쿼리파라미터 처리 시 `URLSearchParams`를 두 번 생성하는 경미한 중복과, 리다이렉트 루프에서 `body`가 있는 요청을 재전송할 경우 발생할 수 있는 잠재적 버그입니다. 전체적으로 성능상 심각한 문제는 없으며 코드 품질은 양호합니다.

### 위험도

**LOW**