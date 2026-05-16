# 부작용(Side Effect) 리뷰

## 발견사항

### 인터페이스 변경 / 시그니처 변경

- **[WARNING]** `Cafe24ExtraFields` 컴포넌트 props 시그니처 확장
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `Cafe24ExtraFields` 함수 파라미터 (`conflict`, `precheckLoading`, `t` 3개 추가)
  - 상세: `Cafe24ExtraFields` 는 파일 내부 private 함수이므로 외부 호출자에 대한 영향은 없다. 그러나 `AuthStep` 인터페이스(`AuthStepProps`)에도 `cafe24Conflict: Cafe24PrecheckResult | null` 과 `cafe24PrecheckLoading: boolean` 두 필드가 추가됐다. 이 인터페이스가 파일 외부로 export되지 않아 직접 영향은 제한적이지만, 동일 컴포넌트를 다른 위치에서 JSX로 사용하는 곳이 있다면 TS 컴파일 오류가 발생한다.
  - 제안: `AuthStepProps` 가 실제로 파일 스코프에 한정되는지 확인. 추후 분리 시 props 선택적(`cafe24Conflict?: ...`) 처리 또는 기본값 부여를 고려.

- **[WARNING]** `@ApiConflictResponse` 설명 문구 변경 — 공개 API 문서 영향
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` Line 581-582
  - 상세: `oauthBegin` 엔드포인트의 `@ApiConflictResponse` description이 "private 한정" 표현에서 "app_type 무관" 표현으로 변경됐다. Swagger 문서를 기반으로 클라이언트 SDK 코드를 생성하거나 문서를 캐싱한 외부 소비자는 스키마 변경으로 인식할 수 있다. 에러 코드 자체(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`)는 그대로이므로 런타임 영향은 없지만, API 계약 문서 상의 의미론 변경이다.
  - 제안: 에러 코드 rename(`CAFE24_MALL_ALREADY_CONNECTED` 등)을 기각한 결정을 changelog 또는 spec Rationale 에 명시해 향후 혼동 방지.

### 공개 API 변경

- **[INFO]** 신규 엔드포인트 `GET /api/integrations/cafe24/precheck` 추가
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` Line 596-617
  - 상세: 새 라우트 추가는 기존 라우트에 영향을 주지 않는다. 컨트롤러 내 주석이 명시하듯 `@Get('cafe24/precheck')` 를 `@Get(':id')` 보다 앞에 선언해 NestJS 라우터 순서 충돌을 회피했다. 이 배치가 현재 코드 파일에 올바르게 반영됐는지 diff 상으로는 의도가 맞다.
  - 제안: 라우트 순서는 e2e 테스트(`integration-cafe24-precheck.e2e-spec.ts` "route order" 케이스)로 회귀 방어가 갖춰져 있어 양호. 추가 조치 불필요.

- **[INFO]** `integrationsApi` 객체에 `cafe24Precheck` 메서드 추가
  - 위치: `frontend/src/lib/api/integrations.ts` Line 1544-1549
  - 상세: 기존 `integrationsApi` 객체에 새 메서드가 추가(append)됐다. 기존 메서드 시그니처는 변경되지 않았으며 `Cafe24PrecheckResult` 인터페이스도 동일 파일에 export로 추가됐다. 기존 import 구조에 영향 없음.
  - 제안: 이상 없음.

### 의도치 않은 상태 변경

- **[WARNING]** `useEffect` 내 `setCafe24Conflict(null)` 의 부작용 범위
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `useEffect([isCafe24OAuth, cafe24MallIdInput])` 블록
  - 상세: `isCafe24OAuth`가 false로 전환될 때(사용자가 인증 variant를 변경하는 경우) `setCafe24Conflict(null)` 이 호출되어 이전 precheck 상태를 초기화한다. 이는 의도된 동작이지만, 사용자가 oauth2 variant → 다른 variant → 다시 oauth2로 전환하면 mall_id 값이 유지된 채로 `cafe24Conflict`가 null이 되어 재입력 없이 conflict 상태가 사라진다. 이 경우 사용자가 유효한 mall_id를 입력한 직후로 인식되어 debounce 타이머가 재실행되므로, 결과적으로 올바른 precheck가 다시 발생한다(의존 배열 `cafe24MallIdInput` 이 변경되지 않아도 `isCafe24OAuth`가 변하므로 effect 재실행). 실질적 버그는 없지만, `isCafe24OAuth` 전환 직후 ~ debounce 완료까지 약 350ms 동안 `cafe24Conflict`가 null인 짧은 gap이 생긴다.
  - 제안: UX 허용 범위 내이나, 이 gap 동안 Connect 버튼이 일시적으로 활성화되는 점을 인지할 것. `cafe24PrecheckLoading` 상태가 이 gap에서 true가 되므로 버튼 disable 조건에 `cafe24PrecheckLoading` 도 추가하면 완전히 방어된다.

- **[INFO]** `formatErrorToast` 함수 — 상태 변경 없는 순수 함수
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` Line 1305-1320
  - 상세: 컴포넌트 렌더 함수 내부에 정의된 헬퍼 함수이며, 외부 상태를 변경하지 않는다. 다만 컴포넌트 재렌더 시마다 새 함수 인스턴스가 생성된다. `useMutation`의 `onError` 콜백에 직접 포함되므로 실질적 성능 영향은 없으나, `useCallback`으로 메모화하거나 컴포넌트 외부로 추출하면 더 명확해진다.
  - 제안: 현재 구조상 문제 없음. 향후 컴포넌트 분리 시 외부 유틸로 추출 권장.

### 전역 변수

- **[INFO]** 테스트 파일의 모듈 스코프 변수 — `let currentSearchParams`
  - 위치: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx` Line 982
  - 상세: `let currentSearchParams = new URLSearchParams()` 가 모듈 스코프에 선언되어 있고 `beforeEach`에서 재할당된다. `vi.mock` 내부의 클로저가 이 변수를 참조한다. jest/vitest의 테스트 격리 모델에서 테스트 파일 단위로 모듈이 격리되므로 다른 테스트 파일에는 영향을 주지 않는다. 파일 내 병렬 실행 시에는 경합 가능성이 있으나, vitest 기본 설정에서 동일 파일 내 테스트는 순차 실행되므로 실질적 문제 없음.
  - 제안: 이상 없음.

### 파일시스템 부작용

- **[INFO]** e2e 테스트의 DB 직접 INSERT
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts` — `insertCafe24Row` 함수 (Line 818-840)
  - 상세: `pg.Client`를 통해 `integration` 테이블에 직접 INSERT한다. `afterAll`에서 `db.end()`를 호출하지만 삽입된 row를 DELETE하지 않는다. `docker-compose.e2e.yml` 기반 격리 인프라를 사용하므로 e2e 실행 후 컨테이너 파기로 DB가 정리된다고 가정한 설계다. 테스트 간 격리를 위해 `mallId`에 랜덤 suffix를 붙이는 방식(`Date.now().toString(36)`, `Math.random().toString(36)`)을 사용하고 있어 동일 실행 내 테스트 간 충돌은 없다.
  - 제안: 격리 인프라 의존이 명시적이지 않아 로컬 DB 환경에서 실수로 실행될 경우 data 오염 가능성이 있다. `E2E_BASE_URL` 환경변수 미설정 시 `localhost:3011`을 fallback으로 사용하는데, 개발자의 로컬 DB와 충돌할 수 있다. 테스트 setUp/tearDown에 롤백 트랜잭션 또는 명시적 DELETE를 추가하는 것을 검토할 것.

### 환경 변수

- **[INFO]** `process.env.APP_URL` 참조 — 기존 코드 경로 유지
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` Line 1389
  - 상세: diff 의 `handleInstall` 메서드 내 `process.env.APP_URL || 'http://localhost:3011'` 은 신규 추가가 아닌 기존 코드다. 변경 내용은 이 코드 블록 이후 삽입된 `findAllCafe24RowsForMall` 헬퍼 추출로, 환경 변수 접근 방식 자체에 변화가 없다.
  - 제안: 이상 없음.

### 네트워크 호출

- **[INFO]** 프론트엔드의 신규 외부 네트워크 호출 — precheck debounce
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `useEffect` 내 `integrationsApi.cafe24Precheck()`
  - 상세: mall_id 입력마다 350ms debounce 후 백엔드 API를 호출한다. 취소 로직(`cancelled` flag + `clearTimeout`)이 올바르게 구현되어 있어 컴포넌트 언마운트 또는 값 변경 시 이전 요청 결과가 상태를 오염시키지 않는다. 다만 `clearTimeout`은 타이머 발사 전에만 유효하고, 이미 발사되어 실행 중인 `async` 콜백의 네트워크 요청은 취소되지 않는다(cancelled flag로 결과 무시만 가능). 이 경우 불필요한 백엔드 요청이 완료까지 실행되어 백엔드 throttle 카운터를 소비할 수 있다.
  - 제안: 현재 구현은 업계 표준 패턴 범위 내이며 throttle 60회/분 여유가 충분하다. 더 엄격한 취소가 필요하면 `AbortController`를 `apiClient.get`에 전달하는 방식을 고려할 수 있다.

### 이벤트/콜백 변경

- **[WARNING]** `createMutation.onError` 와 `oauthBeginMutation.onError` 콜백 동작 변경
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` Line 1328-1339, 1346-1348
  - 상세: 두 mutation의 `onError` 콜백이 기존 `e.response?.data?.message ?? e.message` 단순 추출에서 `formatErrorToast` 를 경유하도록 변경됐다. `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드가 감지되면 한글 i18n primary 메시지 + 영문 backend 메시지를 괄호로 합친 포맷을 반환하고, 그 외의 에러는 기존과 동일하게 처리한다. 콜백의 외부 side effect(toast 표시)는 동일하지만 메시지 포맷이 변경됐다. `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러는 `oauthBeginMutation` 경로에서만 실제로 발생하므로 `createMutation.onError`에서 이 분기가 실행될 가능성은 현재 낮다 — 그러나 `throwIfUniqueViolation` 확장(`integrations.service.ts`)으로 인해 `create` API도 동일 에러 코드를 반환할 수 있어 `createMutation`에서도 한글 메시지가 표시된다. 이는 의도된 동작으로 보인다.
  - 제안: `formatErrorToast`가 두 mutation 모두에 적용되는 것이 명시적 의도인지 주석으로 확인. 현재 동작은 스펙과 일치하는 것으로 판단.

### `throwIfUniqueViolation` 로직 변경 — 기존 동작 보존 확인

- **[INFO]** `integrations.service.ts` `throwIfUniqueViolation` 리팩토링
  - 위치: `backend/src/modules/integrations/integrations.service.ts` Line 1719-1745
  - 상세: 옛 코드는 `code === '23505' && constraint === 'integration_workspace_name_unique'` 의 AND 조건 하나였다. 새 코드는 `code !== '23505'` 조건으로 early return 후 각 constraint를 별도 if로 처리한다. 로직상 동치이며 `integration_workspace_name_unique` 처리 결과는 변경 없다. `idx_integration_cafe24_workspace_mall` 신규 분기 추가로 미처리 constraint 의 경우 함수가 void로 반환되는 기존 동작도 그대로 유지된다 — 즉 `23505` 이지만 알려지지 않은 constraint의 경우 함수가 throw 없이 반환, 호출자가 원래 error를 그대로 올린다. 이는 기존과 동일한 동작이다.
  - 제안: 이상 없음. 향후 새 UNIQUE constraint 추가 시 이 함수에 분기를 추가해야 한다는 점을 주석으로 명시하면 유지보수성이 향상된다.

---

## 요약

이번 변경은 Cafe24 mall_id 중복 감지 UX 보강을 위한 새 엔드포인트 추가, 서비스 헬퍼 추출, 프론트엔드 debounce 상태 추가로 이루어져 있다. 기존 public API 시그니처를 파괴하는 변경은 없으며, 새로 추가된 인터페이스(`AuthStepProps`의 두 필드, `Cafe24ExtraFields`의 세 파라미터)는 파일 스코프 internal 컴포넌트에 한정된다. `throwIfUniqueViolation`의 리팩토링은 기존 동작을 보존한다. 주요 잠재적 부작용은 (1) Connect 버튼의 350ms gap 활성화 — `cafe24PrecheckLoading` 을 disable 조건에 포함하면 해소, (2) e2e 테스트의 DB row 정리 미구현 — 격리 컨테이너 의존으로 운영 환경에는 영향 없으나 로컬 실행 시 주의 필요, (3) `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`라는 에러 코드명이 public 흐름을 포함하게 됐지만 코드를 rename하지 않아 API 문서의 의미론과 코드 이름 간 불일치가 지속된다 — 이는 사용자의 명시적 결정이므로 추가 조치는 불필요하다.

## 위험도

LOW
