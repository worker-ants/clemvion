# 유지보수성(Maintainability) 코드 리뷰 결과

리뷰 대상: `integration-activity-api-label` PR (파일 1~31)
리뷰 일시: 2026-05-28

---

## 발견사항

### [INFO] `clampApiField` 의 `max <= 1` 엣지 케이스 처리는 과방어적
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `clampApiField` 함수 내 `if (max <= 1) return raw.slice(0, max);`
- 상세: 실제 상수 `API_LABEL_MAX=128`, `API_METHOD_MAX=8`, `API_PATH_MAX=256` 은 어느 것도 1 이하가 될 수 없다. 이 분기는 도달 불가 코드로, 미래 유지보수자가 "이 조건이 왜 있는가" 를 분석해야 하는 인지 부담을 준다. 상수값이 리팩터링으로 바뀌는 경우에 대한 방어라면 `assert` 또는 주석으로 의도를 명확히 하는 편이 낫다.
- 제안: 분기를 제거하고 `if (max < 1) throw new Error(...)` 같은 명시적 불변 검사로 교체하거나, 짧은 주석으로 "방어적 보호 — 상수가 1 이하로 변경되는 경우 엘립시스 삽입 불가" 를 표기.

---

### [INFO] `getServiceCatalog` 반환 타입이 인라인 객체 리터럴로 정의돼 DTO 와 분리됨
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:447` — `getServiceCatalog(serviceType: string): { operations: Array<{ key: string; method: string; path: string; labelKey: string; descriptionKey?: string; }> }`
- 상세: 컨트롤러 반환 DTO 는 `OperationCatalogDto` / `OperationCatalogEntryDto` 로 잘 정의돼 있는데, 서비스 레이어의 반환 타입은 익명 인라인 객체 타입이다. 양쪽이 같은 shape 를 독립적으로 정의해 future drift 위험이 있다. `OperationCatalogDto` 의 타입을 바꿀 때 서비스 반환 타입도 수동으로 맞춰야 한다.
- 제안: 서비스 반환 타입을 `OperationCatalogDto` 로 선언하거나, 인터페이스를 별도 파일에 공용 export 해 DTO 와 service 레이어가 동일 타입을 참조하도록 변경.

---

### [INFO] `renderApiCell` 내 `endpoint` 구성 로직이 삼항 중첩으로 읽기 어려움
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `renderApiCell` 함수 내 `endpoint` 변수 계산
- 상세:
  ```
  const endpoint =
    apiMethod && apiPath ? `${apiMethod} ${apiPath}`
    : apiMethod ? apiMethod
    : apiPath ?? "";
  ```
  삼항 연산자 두 겹 중첩은 논리가 단순하더라도 시각적으로 즉각 파악하기 어렵다. 특히 `apiPath ?? ""` 의 fallback 이 빈 문자열인 이유(나중에 falsy 체크로 재사용)가 명시적이지 않다.
- 제안: 조건문을 `if/else if/else` 블록으로 풀거나, `[apiMethod, apiPath].filter(Boolean).join(' ')` 처럼 의도를 드러내는 패턴으로 리팩터.

---

### [INFO] `tryTranslateLabel` 의 key 누락 판별 로직이 i18n 라이브러리 구현에 의존
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `tryTranslateLabel` 함수
- 상세: `translated === fullKey` 조건으로 key 미존재 여부를 판별한다. 이는 "i18n 프레임워크가 key 미존재 시 key 문자열을 그대로 반환한다"는 암묵적 계약에 의존한다. 라이브러리가 다른 fallback 전략(예: 빈 문자열, `undefined`)을 취할 경우 조용히 잘못 동작한다. 주석이 이 의도를 설명하고 있어 나쁘지 않지만, 라이브러리 버전이 바뀌면 찾아내기 어려운 회귀가 될 수 있다.
- 제안: `t` 함수에 `returnNull: true` 옵션을 지원하는 라이브러리 API 가 있다면 활용하거나, 현재 동작을 명시하는 단위 테스트를 추가해 라이브러리 동작 변경 시 조기 탐지.

---

### [INFO] `cafe24.handler.ts` 의 `apiInfo` 객체가 `let` 대신 `const` + 부분 초기화 패턴으로 선언됨
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:591-597`
- 상세: `apiInfo` 는 `const` 로 선언되나 `.method` / `.path` 프로퍼티가 이후에 뮤테이션된다. 이 패턴은 유효하지만, 나중에 추가 프로퍼티를 붙이거나 타입을 변경할 때 초기 선언 지점과 수정 지점이 떨어져 있어 흐름을 추적하기 어렵다. `send-email.handler.ts` 에서도 동일 패턴을 사용해 일관성은 있으나 두 핸들러 모두 같은 구조적 취약성을 공유한다.
- 제안: operation 확정 후 전체 객체를 한 번에 구성하거나 (`const apiInfo = { label, method: op.method, path: op.path }`), 뮤테이션 지점에 짧은 주석으로 "operation 확정 후 채움" 의도를 보강 (현재 주석 있음 — 수준 적절).

---

### [INFO] 테스트에서 매직 리터럴로 DB 컬럼 길이 상수를 반복
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:306-311`
- 상세:
  ```ts
  expect(created.apiLabel.length).toBe(128);
  expect(created.apiMethod.length).toBe(8);
  expect(created.apiPath.length).toBe(256);
  ```
  `API_LABEL_MAX = 128` 등 상수가 서비스 파일에 이미 정의돼 있는데, 테스트는 하드코딩된 숫자를 직접 사용한다. 상수값이 변경될 때 테스트가 실패하지 않고 조용히 통과할 위험이 있다.
- 제안: `API_LABEL_MAX`, `API_METHOD_MAX`, `API_PATH_MAX` 를 `integrations.service.ts` 에서 export 해 테스트에서 import 하거나, 별도 `constants.ts` 로 분리해 양쪽에서 참조.

---

### [INFO] `staleTime: 60 * 60 * 1000` 이 매직 넘버
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx:882`
- 상세: TanStack Query 의 staleTime 을 `60 * 60 * 1000` ms (1시간) 로 직접 계산해 넣었다. 주석이 "1h" 임을 설명하고 있지만 상수 이름이 없어 다른 쿼리에서 동일 시간을 쓰려면 값을 재계산해야 한다.
- 제안: `const ONE_HOUR_MS = 60 * 60 * 1000` 또는 공용 `queryConstants.ts` 로 추출.

---

### [INFO] `database-query.handler.ts` 의 `extractSqlVerb` 는 export 됐지만 테스트가 service spec 에 집중됨
- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:695-700`
- 상세: `extractSqlVerb` 는 `export function` 으로 공개 export 돼 있어 단위 테스트하기 좋은 구조다. 그러나 리뷰 대상 파일 중 이 함수 자체의 단위 테스트는 포함되지 않았다. `extractApiPath` (`http-request.handler.ts`) 도 동일한 상황이다. 두 함수 모두 경계값(빈 문자열, 상대 URL, 쿼리 스트링 포함 URL 등)에서 다양한 분기를 갖는다.
- 제안: `database-query.handler.spec.ts` / `http-request.handler.spec.ts` 에 각 유틸 함수 단위 테스트 추가. 특히 `extractApiPath` 의 try/catch 분기(malformed URL fallback)와 `extractSqlVerb` 의 비영문 첫 토큰 케이스.

---

### [INFO] `ActivityTab` 내 `catalogByKey` Map 이 렌더마다 재생성될 수 있음
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx:891-893`
- 상세:
  ```ts
  const catalogByKey = new Map(
    (catalog?.operations ?? []).map((op) => [op.key, op]),
  );
  ```
  `catalog` 데이터가 TanStack Query 로 캐시되므로 실제 재계산 빈도는 낮지만, `ActivityTab` 이 리렌더될 때마다 Map 을 새로 생성한다. `useMemo` 를 사용하면 `catalog` 참조가 바뀔 때만 재계산된다는 의도가 코드에서 명시적으로 드러난다.
- 제안: `const catalogByKey = useMemo(() => new Map(...), [catalog]);` 로 감싸 최적화 의도 명시.

---

## 요약

이번 변경은 `IntegrationUsageLog` 에 API 식별 3컬럼을 추가하고 관련 백엔드/프론트엔드 파이프라인을 전반적으로 구현한 PR 로, 전체 설계가 명확하고 각 파일에 맥락 주석이 충실히 작성돼 있다. `clampApiField`, `extractSqlVerb`, `extractApiPath`, `renderApiCell`, `tryTranslateLabel` 같은 신규 유틸 함수가 각자 단일 책임을 갖고 적절히 분리돼 있어 가독성과 구조가 양호하다. 다만 몇 가지 유지보수성 우려가 있다. 서비스 레이어의 인라인 반환 타입이 DTO 와 독립적으로 정의돼 있어 미래 drift 위험이 있고, 테스트에 DB 컬럼 길이 상수가 하드코딩돼 상수 변경 시 테스트가 보호 역할을 하지 못할 수 있다. `extractSqlVerb` / `extractApiPath` 에 대한 직접 단위 테스트가 없어 경계값 회귀가 조용히 유입될 수 있다. 프론트엔드에서는 1시간 staleTime 의 매직 넘버와 `catalogByKey` Map 의 `useMemo` 누락이 소규모 유지보수 마찰을 유발한다. 발견된 사항은 모두 INFO 등급으로, 기능 정확성이나 즉각적인 회귀 위험보다는 코드의 명확성과 장기 유지보수성에 관한 것이다.

---

## 위험도

LOW
