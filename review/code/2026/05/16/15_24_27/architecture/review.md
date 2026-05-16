# 아키텍처(Architecture) 리뷰

## 발견사항

### SOLID 원칙

- **[WARNING]** `IntegrationOAuthService`에 precheck 책임이 추가되어 단일 책임 원칙(SRP) 경계 확장
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` +456~+541
  - 상세: `precheckCafe24Mall`은 OAuth 흐름과 무관한 read-only 조회 기능이다. `IntegrationOAuthService`는 본래 OAuth 인증 상태 전이(`begin → callback → finalize`)를 담당하는 서비스인데, "사용자 입력 단계의 UX 보조 사전 감지"라는 별개 책임이 같은 클래스에 합류했다. 분리된 `Cafe24DuplicateCheckService`나 `IntegrationQueryService` 같은 읽기 전용 서비스에 두었다면 향후 read-replica 라우팅, 캐싱 적용, 테스트 격리가 더 수월했을 것이다.
  - 제안: 즉시 분리 리팩토링을 요구할 수준은 아니지만, 향후 precheck 로직이 확장(여러 서비스 provider 지원, 캐싱 레이어 등)될 경우 별도 서비스로 추출할 것을 권장한다. 현재 범위에서는 `private` 메서드로 캡슐화한 헬퍼(`findAllCafe24RowsForMall`, `findConnectedCafe24MallIntegration`)가 서비스 내부 응집도를 유지해 주어 수용 가능하다.

- **[INFO]** `throwIfUniqueViolation` 확장이 개방-폐쇄 원칙(OCP)의 단순 위반 vs. 실용적 선택
  - 위치: `backend/src/modules/integrations/integrations.service.ts` +726~+745
  - 상세: 기존 메서드에 새로운 constraint 분기를 직접 추가했다. OCP 관점에서는 constraint → 예외 변환 매핑 테이블(Map/Registry 패턴)로 확장 가능하게 만드는 방법도 있다. 그러나 현재 두 가지 constraint만 처리하므로 과도한 추상화 비용이 크다.
  - 제안: constraint 종류가 3개 이상으로 늘어나거나 동적 등록이 필요해지면 Map 기반 매핑 레지스트리로 전환을 검토한다.

### 결합도/응집도

- **[WARNING]** frontend `page.tsx`가 precheck 로직, 에러 포맷팅, 디바운스 타이머를 모두 직접 보유하여 뷰 컴포넌트의 비즈니스 로직 비대화
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` +92~+320 (`useEffect` debounce, `formatErrorToast`, `cafe24Conflict` 상태 관리 포함)
  - 상세: 350ms debounce + cancellation 패턴, 패턴 검증 분기(`/^[a-z0-9-]{3,50}$/`), API 호출, 에러 silent 처리까지 단일 컴포넌트의 `useEffect` 안에 모두 구현되어 있다. React 아키텍처 관점에서 커스텀 훅(`useCafe24MallIdPrecheck`)으로 분리하면 테스트 독립성, 재사용성, page 컴포넌트의 뷰 응집도가 개선된다. 현재 테스트(`cafe24-precheck.test.tsx`)가 페이지 전체를 렌더링해야만 debounce 동작을 검증할 수 있는 것도 이 결합의 부산물이다.
  - 제안: `useCafe24MallIdPrecheck(mallId: string, enabled: boolean)` 커스텀 훅 추출. `cafe24Conflict`, `cafe24PrecheckLoading`, cancellation cleanup을 훅이 책임지고 `page.tsx`는 상태 수신만 담당하게 한다.

- **[INFO]** `Cafe24PrecheckResult` 타입이 frontend `integrations.ts`의 가장 하단에 추가되어 API 클라이언트 파일에서 도메인 타입 정의가 혼재
  - 위치: `frontend/src/lib/api/integrations.ts` +1552~+1557
  - 상세: API 응답 타입이 API 클라이언트 파일 말미에 `export interface`로 선언된 패턴은 일관성이 있으나, 이 타입이 `page.tsx`뿐 아니라 `Cafe24ExtraFields` props까지 전파되어 이미 두 레이어에 걸쳐 사용된다. 타입 전용 파일(`types/integration.ts`)이 별도로 있다면 그쪽으로 이동하는 것이 바람직하다.
  - 제안: 프로젝트의 기존 타입 관리 컨벤션을 따라 위치를 결정한다. 현재 규모에서는 허용 범위.

### 레이어 책임

- **[WARNING]** `Cafe24ExtraFields` 컴포넌트가 `t: TFunction`을 prop으로 직접 수취하여 i18n 의존성이 부모에서 주입
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` +1401 (`Cafe24ExtraFields`에 `t={t}` 전달)
  - 상세: `Cafe24ExtraFields`는 자체적으로 `useT()` 훅을 호출해 번역 함수를 얻을 수 있음에도 부모가 `t`를 내려보내고 있다. 이는 컴포넌트 자율성을 낮추고 부모와 자식 간 불필요한 인터페이스 결합을 만든다. 부모가 자식의 i18n 의존성을 대신 주입할 이유가 없다.
  - 제안: `Cafe24ExtraFields` 내부에서 `useT()`를 직접 호출하도록 변경하고 `t` prop을 제거한다. 이 변경은 컴포넌트 인터페이스를 단순화하고 불필요한 리렌더링 전파도 줄인다.

- **[INFO]** Controller가 `oauthService.precheckCafe24Mall`을 직접 위임하여 레이어 책임이 명확
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` +612~+617
  - 상세: 컨트롤러가 직접 처리하지 않고 서비스에 위임하는 구조는 올바르다. 다만 precheck가 순수 읽기 조회임에도 `IntegrationOAuthService`를 통해 접근한다는 점은 앞서 언급한 SRP 문제와 연결된다.
  - 제안: 향후 서비스 분리 시 컨트롤러 주입 대상만 교체하면 되므로 현재 구조에서 큰 문제는 없다.

### 디자인 패턴

- **[WARNING]** Legacy fallback 패턴(V045 이전 rows 보정 쿼리)이 두 단계 DB 쿼리를 발생시키는 구조적 부채
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` +456~+468 (`findAllCafe24RowsForMall`)
  - 상세: `findAllCafe24RowsForMall`은 항상 두 번의 `integrationRepository.find()` 호출을 실행한다. `mallId IS NULL` 보정 쿼리는 V045 이전 legacy row 처리를 위한 임시 패턴인데, 현재 코드에서 이 레거시 경로가 영구화될 위험이 있다. 주석에 "backfill 완료 후 제거 예정"이라고 명시되어 있으나 제거 시점 기준(마이그레이션 버전 번호, 날짜, 플래그 등)이 없어 실제 제거가 지연될 가능성이 높다.
  - 제안: (1) 제거 기준을 코드 주석에 명확히 기재한다(예: "V046 backfill migration 완료 확인 후 제거 — ticket #XXX"). (2) 단기적으로는 두 쿼리를 OR 조건 하나로 합쳐 DB 왕복을 줄이는 것을 검토한다(`WHERE (mallId = $1) OR (mallId IS NULL AND credentials->>'mall_id' = $1)`). 단, 이는 TypeORM의 `find()` API 제약으로 native query가 필요할 수 있다.

- **[INFO]** 상태 우선순위 정렬에 `PRIORITY` 배열 순회 패턴 사용 — 명확하고 확장 가능
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` +511~+527
  - 상세: `['connected', 'pending_install', 'error', 'expired']` 배열을 선언적으로 순회해 우선순위를 결정하는 패턴은 가독성이 좋고 새로운 status 추가 시 배열만 수정하면 된다. 올바른 선택이다.

### 순환 의존성

- **[INFO]** 변경된 범위 내에서 순환 의존성 없음
  - 상세: `integrations.controller.ts` → `IntegrationOAuthService` → `integrationRepository`. `frontend/lib/api/integrations.ts` → `apiClient`. 단방향 의존 흐름이 유지된다.

### 추상화 수준

- **[WARNING]** `formatErrorToast`가 특정 에러 코드(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`)를 컴포넌트 레벨에서 직접 분기하여 프레젠테이션 레이어에 도메인 에러 코드 지식이 침투
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` +1305~+1320
  - 상세: 프레젠테이션 레이어인 `page.tsx`가 특정 백엔드 에러 코드 문자열을 알고 있어야 하는 구조다. 에러 코드 상수가 공유 타입 레이어에 없고 인라인 문자열 리터럴로 비교한다. 에러 코드 추가/변경 시 컴포넌트를 직접 수정해야 한다.
  - 제안: `@/lib/api/errors.ts` 같은 공유 모듈에 에러 코드 상수를 정의하거나, API 클라이언트 레이어에서 에러를 의미 있는 도메인 에러 객체로 변환해 컴포넌트가 코드 문자열을 직접 비교하지 않아도 되게 한다.

- **[INFO]** `Cafe24ExtraFields`에서 `conflictDescKey` 결정 로직이 인라인 삼항 연산자 체인으로 구현
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` +1449~+1457
  - 상세: 4단계 삼항 연산자 체인은 가독성을 낮춘다. `const STATUS_DESC_MAP: Record<string, TranslationKey>` 형태의 객체 매핑으로 대체하면 더 명확하고 타입 안전하다.
  - 제안:
    ```ts
    const STATUS_DESC_MAP: Partial<Record<string, TranslationKey>> = {
      pending_install: "integrations.cafe24DuplicateMallPendingDesc",
      expired: "integrations.cafe24DuplicateMallExpiredDesc",
      error: "integrations.cafe24DuplicateMallErrorDesc",
    };
    const conflictDescKey: TranslationKey =
      (conflict?.status && STATUS_DESC_MAP[conflict.status]) ??
      "integrations.cafe24DuplicateMallConnectedDesc";
    ```

### 모듈 경계

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드가 public 흐름에도 재사용되어 모듈 계약의 의미 경계 훼손
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` +379, `integrations.service.ts` +739
  - 상세: 에러 코드의 이름이 `PRIVATE`를 포함하지만 public 앱 흐름의 begin 가드와 finalize 단계 race backstop 모두에서 동일 코드를 사용한다. 이는 API 계약상 소비자(프론트엔드, 외부 연동)가 에러 코드의 의미를 오해할 수 있는 표면을 만든다. Consistency Check Warning #8이 이미 `CAFE24_MALL_ALREADY_CONNECTED` 로의 rename을 제안했으나 기각되었다. 기각 이유(하위 호환성)는 타당하지만, 적어도 이 결정을 Swagger 문서 및 spec에 명시적으로 기재해야 의도치 않은 향후 변경을 막을 수 있다.
  - 제안: `integrations.controller.ts`의 `@ApiConflictResponse` 설명에 "이 코드는 app_type 무관(public/private 모두)으로 발생한다"는 문구가 이미 추가되어 있어 문서화는 된 상태다. Swagger 문서 외에 `integration-oauth.service.ts` 해당 throw 지점 주석에도 동일 내용을 명시하는 것을 권장한다.

- **[INFO]** NestJS 라우트 선언 순서 문제가 코드 주석과 e2e 테스트로 이중 방어됨
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` +590~+595 (주석), `backend/test/integration-cafe24-precheck.e2e-spec.ts` +907~+919 (회귀 테스트)
  - 상세: 정적 경로(`cafe24/precheck`)가 동적 경로(`:id`)보다 앞에 선언되어야 한다는 NestJS 제약을 주석과 e2e 테스트 양쪽으로 방어한 것은 좋은 관행이다.

### 확장성

- **[WARNING]** precheck 로직이 Cafe24 전용으로 하드코딩되어 다른 provider의 mall_id 유사 개념에 재사용 불가
  - 위치: 메서드명 `precheckCafe24Mall`, `findAllCafe24RowsForMall`, `findConnectedCafe24MallIntegration` — 모두 Cafe24 특화 명칭
  - 상세: 현재 요구사항이 Cafe24 한정이므로 과도한 일반화는 YAGNI 위반이 될 수 있다. 그러나 향후 다른 OAuth 서비스에도 "연결 전 중복 감지" 패턴이 필요해질 경우 현재 구조는 Cafe24 특화 코드의 복사-붙여넣기를 유도한다.
  - 제안: 현재 시점에서 무리하게 일반화할 필요는 없으나, 두 번째 provider가 등장하는 시점에 `findExistingIntegrationForExternalId(workspaceId, serviceType, externalId)` 형태의 범용 헬퍼로 리팩토링할 것을 계획에 포함한다.

- **[INFO]** Throttle 설정이 Controller 데코레이터에 인라인 하드코딩
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` +596 (`@Throttle({ default: { limit: 60, ttl: 60_000 } })`)
  - 상세: 분당 60회 제한이 스펙 문서와 일치하며 현재는 문제없다. 향후 환경별(prod/dev) 상이한 throttle 정책이 필요해지면 구성 파일에서 주입받는 구조가 필요하다.

---

## 요약

이번 변경은 Cafe24 mall_id 중복 감지 UX를 세 계층(DTO 추가, 서비스 로직 공통화, 컨트롤러 엔드포인트, 프론트엔드 debounce + 배너)에 걸쳐 일관성 있게 구현했다. `findAllCafe24RowsForMall`으로 쿼리 로직을 공유 헬퍼로 추출하고 private/public 흐름 모두에 동일 사전 가드를 적용한 결정, 그리고 V045 race backstop을 `throwIfUniqueViolation` 확장으로 처리한 방식은 아키텍처적으로 합리적이다. 다만 `precheckCafe24Mall`이 `IntegrationOAuthService`에 위치함으로써 SRP가 약간 확장되었고, 프론트엔드 page.tsx가 debounce 로직, 에러 코드 분기, i18n 주입이라는 세 가지 부가 책임을 직접 보유하게 되어 뷰 레이어의 응집도가 낮아졌다. 레거시 fallback 쿼리의 제거 기준 부재는 기술 부채 누적의 리스크다. 전반적으로 기능 요구사항을 안전하게 충족하는 구현이나, 커스텀 훅 추출과 `t` prop 제거는 단기 내 정리를 권장한다.

---

## 위험도

MEDIUM
