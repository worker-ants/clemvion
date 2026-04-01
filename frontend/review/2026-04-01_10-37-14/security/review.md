## 보안 코드 리뷰 결과

---

### 발견사항

#### 파일 1: `executions.ts`

- **[WARNING]** `ExecutionData.error`에 `stack` 필드 노출
  - 위치: `error: { message?: string; stack?: string } | null`
  - 상세: 스택 트레이스가 API 응답을 통해 클라이언트로 전달되는 경우, 서버 내부 경로·프레임워크·모듈 정보가 노출될 수 있음
  - 제안: 클라이언트 타입에서 `stack` 제거 또는, 실제로 렌더링하지 않도록 UI 레이어에서 사용 금지 처리

- **[INFO]** URL 경로에 `id`를 직접 interpolation
  - 위치: `` `/executions/${id}` ``
  - 상세: `id`가 외부 입력으로부터 오는 경우, URL 인코딩 없이 그대로 삽입됨. 현재 구조상 UUID 포맷이 예상되지만, 검증 로직이 없음
  - 제안: `encodeURIComponent(id)` 적용 또는 호출 전 UUID 형식 검증

- **[INFO]** `inputData`, `outputData`가 `Record<string, unknown>` — 런타임 타입 검증 없음
  - 위치: 인터페이스 전반
  - 상세: 타입 수준에서만 정의되어 있고, 실제 API 응답 파싱 시 스키마 검증(zod 등)이 없으면 예상치 못한 데이터 구조가 상태로 흘러 들어갈 수 있음
  - 제안: zod 또는 유사 라이브러리로 응답 파싱 시 런타임 검증 추가 권장

---

#### 파일 2: `use-execution-events.test.ts`

- **[INFO]** 테스트 토큰이 하드코딩 (`"test-token"`)
  - 위치: `getAccessToken: () => "test-token"`
  - 상세: 테스트용이므로 실제 시크릿 노출은 아님. 그러나 이 패턴이 실제 코드로 복사될 경우 위험. 현재는 허용 범위
  - 제안: 현 상태 유지 가능, 단 실제 구현 코드에서는 반드시 환경 변수 사용 확인

- **[INFO]** 에러 메시지가 직접 state에 저장됨
  - 위치: `expect(state.nodeStatuses.get("node-2")?.error).toBe("Connection timeout")`
  - 상세: 백엔드 내부 오류 메시지가 그대로 프론트엔드 상태에 저장/표시되는 흐름이 테스트로 검증됨. 민감한 시스템 정보가 담긴 에러 메시지가 UI에 노출될 수 있음
  - 제안: 에러 메시지를 사용자에게 노출하기 전 sanitize하거나, 사전 정의된 메시지로 매핑하는 레이어 추가 검토

---

#### 파일 3: `ws-client.test.ts`

- **[INFO]** WebSocket 연결 시 토큰이 `auth`와 `query` 양쪽에 전달
  - 위치: `auth: { token: "test-token" }, query: { token: "test-token" }`
  - 상세: `query` 파라미터로 토큰을 전달하면 서버 액세스 로그, 브라우저 히스토리, 프록시 로그에 토큰이 기록될 수 있음. `auth`만 사용하는 것이 더 안전
  - 제안: 실제 `ws-client.ts` 구현에서 `query`로 토큰을 전달하는 부분 제거하고 `auth`만 사용 (테스트는 구현을 반영하므로, 구현 수정 후 테스트도 업데이트)

- **[INFO]** `resetWsClient`가 테스트에서만 사용
  - 위치: `getWsClient (singleton)` describe 블록
  - 상세: 싱글톤 리셋 함수가 테스트 외 용도로 노출되어 있다면 런타임에서 의도치 않게 연결이 끊길 수 있음
  - 제안: `resetWsClient`를 `process.env.NODE_ENV === 'test'` 조건부 export 또는 별도 테스트 유틸로 분리 검토

---

### 요약

전체적으로 심각한 보안 취약점은 없으며, 코드 구조는 적절하게 설계되어 있습니다. 주요 우려 사항은 두 가지입니다: (1) `ExecutionData`의 `stack` 필드를 통한 서버 내부 정보 노출 가능성, (2) WebSocket 연결 시 인증 토큰이 URL 쿼리 파라미터로도 전달되어 로그에 기록될 수 있는 문제. 나머지는 방어적 코딩 차원의 개선 사항(런타임 스키마 검증, URL 인코딩, 에러 메시지 sanitization)으로 현 시점에서 즉각적인 위협보다는 향후 확장 시 리스크가 될 수 있습니다.

### 위험도

**LOW**