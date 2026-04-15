## 발견사항

### 테스트 코드 (`http-request.handler.spec.ts`)

- **[INFO]** `queryParams` 형식 변경에 대한 테스트 명칭 개선
  - 위치: line 161 (`should append array-shaped query params to URL`)
  - 상세: 기존 `Record<string, string>` → `Array<{ key, value }>` 형식 변경을 명확히 표현하도록 테스트 이름 수정됨. 적절한 개선.

- **[WARNING]** 빈 키 queryParams 필터링 테스트 누락
  - 위치: execute describe 블록
  - 상세: `headers`에 대한 빈 키 드롭 테스트는 존재하지만 `queryParams`에 대한 동일 케이스 테스트가 없음. `toKeyValueRecord`는 동일 로직을 양쪽에 적용하므로 대칭성이 필요함.
  - 제안:
    ```ts
    it('should drop query param rows with empty keys', async () => {
      await handler.execute(null, {
        method: 'GET',
        url: 'https://api.example.com/data',
        queryParams: [
          { key: '', value: 'ignored' },
          { key: 'page', value: '1' },
        ],
      }, context);
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('page=1');
      expect(url).not.toContain('ignored');
    });
    ```

- **[WARNING]** credential headers가 user headers를 덮어쓰는 우선순위 검증 누락
  - 위치: `merges user-provided headers with integration credential headers` 테스트
  - 상세: `mergedHeaders` 병합 순서는 `defaultHeaders → credentials.headers → userHeaders` 순서임. 동일 키 충돌 시 userHeaders가 credential headers를 덮어쓰는지, 또는 credential이 userHeaders를 덮어쓰는지 명시적 검증 없음. 보안상 중요한 동작 (예: 사용자가 `Authorization`을 직접 입력해서 credential을 오버라이드할 수 있는지).
  - 제안:
    ```ts
    it('user Authorization header should be overridden by credential Authorization', async () => {
      // or vice versa — whichever is the intended policy
      const { service } = makeService('bearer_token', { token: 'abc' });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(null, {
        method: 'GET',
        url: 'https://api.example.com/me',
        authentication: 'integration',
        integrationId: 'int-1',
        headers: [{ key: 'Authorization', value: 'Bearer override' }],
      }, contextWithWorkspace);
      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      // Document intentional policy: user overrides credential or vice versa
      expect(headers.Authorization).toBe('Bearer abc'); // or 'Bearer override'
    });
    ```

- **[WARNING]** `toKeyValueRecord`의 legacy Record 형식 호환성 테스트 누락
  - 위치: execute describe 블록
  - 상세: `toKeyValueRecord`는 `Array<{key,value}>` 외에 `Record<string, string>` 레거시 형식도 지원하지만, 이 경로에 대한 테스트가 없음. 특히 `queryParams`/`headers`를 객체 형식으로 전달할 때 정상 동작하는지 검증 필요.
  - 제안:
    ```ts
    it('should handle legacy object-shaped queryParams', async () => {
      await handler.execute(null, {
        method: 'GET',
        url: 'https://api.example.com/data',
        queryParams: { page: '1', limit: '10' }, // legacy Record format
      }, context);
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
    });
    ```

- **[INFO]** `x-www-form-urlencoded` body가 배열 형식인 경우 테스트 부재
  - 위치: `should send x-www-form-urlencoded body with correct content-type` 테스트
  - 상세: 현재 테스트는 `body`를 `Record<string, unknown>` 객체로만 전달. `toKeyValueEntries`가 배열 형식도 처리할 수 있으므로 body가 `Array<{key,value}>` 형태일 때도 커버해야 함.

- **[INFO]** `form-data` body에서 배열 형식 미테스트
  - 위치: `should send form-data body and omit explicit Content-Type` 테스트
  - 상세: `x-www-form-urlencoded`와 동일 이슈. form-data body가 배열 형식일 때의 동작이 검증되지 않음.

- **[INFO]** `stringifyScalar` 다양한 타입 커버리지 부재
  - 위치: handler.ts의 `stringifyScalar` 함수
  - 상세: `number`, `boolean` 타입이 헤더/파라미터 값으로 들어올 때 문자열 변환이 올바른지 테스트 없음. 예: `{ key: 'page', value: 1 }` (숫자).

- **[INFO]** `form-data` 테스트에서 FormData 내용 검증 미흡
  - 위치: `should send form-data body and omit explicit Content-Type`
  - 상세: `args.body`가 `FormData` 인스턴스인지만 확인하고, 실제 필드값 포함 여부를 검증하지 않음. Node.js 환경에서 `FormData.get()` API로 검증 가능.
  - 제안:
    ```ts
    const formData = args.body as FormData;
    expect(formData.get('field')).toBe('value');
    ```

---

### 구현 코드 (`http-request.handler.ts`)

- **[WARNING]** `toKeyValueEntries`에서 배열 아이템에 `value` 프로퍼티 없을 때 처리 미검증
  - 위치: `toKeyValueEntries` 함수, `'key' in item` 체크
  - 상세: `{ key: 'X-Foo' }` (value 없는 객체)는 통과되어 `stringifyScalar(undefined)` → `''`로 처리됨. 이 동작이 의도적인지 테스트로 명시 필요.

---

### 프론트엔드 (`integration-configs.tsx`)

- **[INFO]** 프론트엔드 컴포넌트 변경에 대한 단위/통합 테스트 부재
  - 위치: `HttpRequestConfig` 컴포넌트 전체
  - 상세: `authentication === "integration"` 조건부 렌더링에 대한 테스트가 없음. `IntegrationSelector`가 올바르게 마운트/언마운트되는지 검증 필요.
  - 제안: RTL(React Testing Library)로 `authentication` 값 변경 시 `IntegrationSelector` 렌더링 여부 테스트 추가.

---

## 요약

이번 변경은 `queryParams`/`headers`를 `Array<{key, value}>` 형식으로 통일하고 `form-data`, `x-www-form-urlencoded` body 타입을 추가하는 의미 있는 기능 확장이며, 핵심 동작에 대한 테스트는 잘 추가되었다. 다만 `queryParams` 빈 키 필터링 테스트, legacy `Record` 형식 호환성 테스트, 인증 헤더 충돌 우선순위 정책 검증이 빠져 있어 엣지 케이스 커버리지에 공백이 존재한다. 프론트엔드 컴포넌트의 조건부 렌더링은 테스트가 전혀 없으며, `form-data` body 내용 검증도 보강이 필요하다.

## 위험도

**MEDIUM** — 핵심 흐름은 커버되나, 헤더 우선순위 정책과 legacy 형식 호환성 누락이 회귀 위험을 내포함.