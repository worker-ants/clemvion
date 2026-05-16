# 유지보수성(Maintainability) 리뷰

## 발견사항

### 백엔드 서비스 계층

- **[INFO]** `precheckCafe24Mall` 메서드의 반환 타입이 인라인 익명 객체 타입으로 선언됨
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts`, `precheckCafe24Mall` 시그니처 (line ~496–504)
  - 상세: 반환 타입이 `Promise<{ conflict: boolean; existingIntegrationId?: string; existingName?: string; status?: 'connected' | 'pending_install' | 'expired' | 'error'; }>` 형태의 구조체로 인라인 선언되어 있다. 동일한 shape 이 `Cafe24PrecheckResultDto`(response DTO)와 `Cafe24PrecheckResult`(frontend 타입)로 이미 3곳에 분산 선언된 셈이다. 서비스 레이어에도 공유 인터페이스 또는 DTO 를 반환 타입으로 참조하면 변경 파급이 한 곳으로 집중된다.
  - 제안: 서비스 반환 타입을 `Cafe24PrecheckResultDto` 또는 별도 공유 인터페이스(`Cafe24PrecheckResult`)로 명시해 타입 중복을 제거한다.

- **[INFO]** `findAllCafe24RowsForMall` 내 legacy fallback 쿼리 책임이 동일 메서드 안에 혼재
  - 위치: `integration-oauth.service.ts`, `findAllCafe24RowsForMall` 메서드 (~line 456–469)
  - 상세: primary 쿼리(V045 `mallId` 컬럼)와 legacy fallback 쿼리(`mallId IS NULL` + JSONB 필터)가 한 메서드 안에 순차 실행된다. 현재는 backfill 완료 후 legacy 분기를 제거할 것으로 주석에 명시되어 있는데, 두 경로가 한 메서드에 얽혀 있어 제거 시점에 오염 범위를 추적하기 어렵다.
  - 제안: legacy fallback 로직을 `findLegacyCafe24RowsForMall` 같은 private 헬퍼로 분리하고, `findAllCafe24RowsForMall` 은 두 결과를 합산하는 조합자 역할만 하도록 분리한다. backfill 완료 후 헬퍼만 삭제하면 된다는 점을 `TODO(backfill):` 주석으로 명시하면 추적이 용이하다.

- **[WARNING]** `PRIORITY` 배열이 `precheckCafe24Mall` 메서드 본문에 매직 상수로 인라인 선언됨
  - 위치: `integration-oauth.service.ts`, `precheckCafe24Mall` 내부 (~line 511–516)
  - 상세: `const PRIORITY = ['connected', 'pending_install', 'error', 'expired'] as const` 가 메서드 본문 안에 있다. 이 순서는 비즈니스 규칙("가장 제한적인 상태 우선")이므로 메서드를 읽어야만 알 수 있다. 동일한 우선순위 정의가 spec 문서·JSDoc·응답 DTO 주석 등 여러 곳에 자연어로 설명되어 있어 코드 변경 시 문서-코드 불일치 위험이 있다.
  - 제안: 메서드 외부(클래스 상단 또는 파일 상단)에 `private static readonly CAFE24_STATUS_PRIORITY`로 이름을 부여해 추출한다. 순서 변경 시 한 곳만 수정하면 되고, 코드 리뷰에서도 의도가 명확하게 드러난다.

- **[INFO]** `findConnectedCafe24MallIntegration`은 `findAllCafe24RowsForMall`을 내부 호출해 DB 쿼리를 2회 발행
  - 위치: `integration-oauth.service.ts`, `findConnectedCafe24MallIntegration` 메서드 (~line 476–482)
  - 상세: `findConnectedCafe24MallIntegration` → `findAllCafe24RowsForMall` 호출 시 primary + legacy 두 쿼리를 항상 발행한다. `connected` 상태 체크 목적으로는 `WHERE status='connected'` 조건을 포함한 단일 쿼리로 충분할 수 있다. 현재는 legacy fallback 이 필요하므로 불가피하지만, backfill 완료 후 최적화 지점임을 주석으로 명시해두면 좋다.
  - 제안: backfill 완료 예정 날짜 또는 조건을 `TODO(backfill):` 주석에 구체적으로 명시해 추후 최적화 시기를 코드 자체로 추적한다.

### 백엔드 컨트롤러

- **[WARNING]** 라우트 선언 순서 위험에 대한 주석이 필수 안전 정보를 내포하지만 코드 검증 수단이 없음
  - 위치: `integrations.controller.ts`, `cafe24Precheck` 핸들러 직전 주석 (~line 590–595)
  - 상세: `@Get('cafe24/precheck')` 가 `@Get(':id')` 보다 앞에 있어야 한다는 설명이 장문 주석으로만 존재한다. 빌드 타임에 감지되지 않으므로 리팩토링 중 실수 가능성이 있다. 이 위험은 e2e 테스트(`integration-cafe24-precheck.e2e-spec.ts` 의 "route order" 케이스)로 부분 보호되고 있으나, 테스트를 실행하지 않으면 런타임에서야 발견된다.
  - 제안: 현재 주석과 e2e 테스트 조합으로 충분히 보호되고 있다. 추가로 주석 내에 e2e 테스트 파일 경로를 명시(`@see backend/test/integration-cafe24-precheck.e2e-spec.ts "route order" test`)해 개발자가 보호 장치를 바로 찾을 수 있도록 한다.

### 백엔드 DTO

- **[INFO]** `Cafe24PrecheckQueryDto`의 `@Matches` 정규식 주석과 실제 패턴이 두 곳에 중복 표기됨
  - 위치: `integration.dto.ts`, `Cafe24PrecheckQueryDto.mallId` 필드 (~line 54–58)
  - 상세: `// CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/` 주석과 `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터에 동일 패턴이 중복 기재되어 있다. 패턴 변경 시 두 곳 모두 수정해야 하는 부담이 생긴다.
  - 제안: 주석은 패턴의 '의미'와 'begin DTO와 동일'이라는 의도를 서술하는 방식으로 간소화하고, 패턴 자체는 `@Matches` 데코레이터 한 곳에만 두는 것을 권장한다. 혹은 별도 상수(`CAFE24_MALL_ID_PATTERN`)를 파일 최상단에 정의해 두 DTO에서 공유한다.

- **[WARNING]** `Cafe24PrecheckResultDto`의 `status` 필드에 상태 값이 문자열 리터럴 유니온으로 중복 선언됨
  - 위치: `integration-response.dto.ts`, `Cafe24PrecheckResultDto.status` (~line 110–114)
  - 상세: `'connected' | 'pending_install' | 'expired' | 'error'` 유니온이 이 DTO, 서비스 메서드 반환 타입, `frontend/src/lib/api/integrations.ts`의 `Cafe24PrecheckResult` 인터페이스 등 최소 세 곳에 개별 선언되어 있다. 상태가 추가/변경되면 세 곳을 동시에 수정해야 한다.
  - 제안: 공유 상수 또는 열거형(`IntegrationStatus` 등)을 shared 패키지 또는 백엔드 도메인 타입 파일에 정의하고 참조하도록 중앙화한다. 프로젝트 구조상 프론트/백엔드가 분리되어 있으므로 단기적으로는 각 계층이 독립 선언하되, 서비스 레이어와 DTO 내에서는 타입을 공유하는 것이 최소 개선이다.

### 프론트엔드 컴포넌트

- **[WARNING]** `Cafe24ExtraFields` 컴포넌트가 `t: TFunction` 을 prop으로 수신하는 패턴이 기존 코드베이스와 불일치
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx`, `Cafe24ExtraFields` 함수 시그니처 (~line 1429–1438)
  - 상세: 이 파일의 다른 컴포넌트들(`AuthStep` 등)은 `useT()` 훅을 직접 호출해 번역 함수를 획득한다. `Cafe24ExtraFields`만 부모에서 `t`를 prop으로 내려받는 패턴을 취하고 있어 코드베이스 내 일관성이 깨진다.
  - 제안: `Cafe24ExtraFields` 내부에서 `useT()` 훅을 직접 호출하도록 변경하고 `t` prop을 제거한다. 훅 호출이 불가능한 상황(예: class 컴포넌트)이 아닌 한 훅을 직접 사용하는 편이 더 관용적이다.

- **[INFO]** `useEffect` 내 debounce 로직이 컴포넌트 본문에 직접 구현되어 재사용성이 낮음
  - 위치: `page.tsx`, Cafe24 precheck useEffect (~line 1268–1297)
  - 상세: `setTimeout` + cleanup 패턴으로 debounce를 구현하고 있다. 현재는 단일 사용처이므로 문제가 없으나, 다른 컴포넌트에서 비슷한 debounce+API 호출 패턴이 필요해질 경우 동일 로직이 복제될 위험이 있다.
  - 제안: `useCafe24MallIdPrecheck(mallId: string, enabled: boolean)` 와 같은 커스텀 훅으로 추출해 관심사를 분리한다. 이렇게 하면 컴포넌트 본문이 단순해지고 훅을 단독으로 테스트할 수 있다.

- **[INFO]** `formatErrorToast` 가 컴포넌트 함수 본문에 일반 함수로 선언되어 있음
  - 위치: `page.tsx`, `formatErrorToast` 함수 (~line 1305–1320)
  - 상세: 렌더마다 새로 생성되지만 `useCallback` 없이 선언되어 있다. 현재는 성능 문제가 발생할 수준은 아니지만, 함수가 mutation의 `onError`에 전달되는 구조라 미세한 불일치가 생길 수 있다. 더 큰 문제는 이 함수가 error code 분기 로직을 담고 있어 추후 코드 종류가 늘어날수록 복잡도가 증가할 수 있다는 점이다.
  - 제안: `useCallback`으로 감싸거나, 컴포넌트 외부의 순수 함수로 추출해 단독 테스트가 가능하도록 한다.

- **[INFO]** `conflictDescKey` 삼항 연산 중첩 깊이가 4단계
  - 위치: `page.tsx`, `Cafe24ExtraFields` 내 `conflictDescKey` 계산부 (~line 1449–1457)
  - 상세: `status` 별 번역 키 선택을 위해 중첩 삼항 연산자가 4단계까지 사용되고 있다. 타입스크립트에서 허용되지만 가독성이 낮고, 새 status 가 추가될 때 안쪽에 삼항을 계속 추가해야 하는 구조이다.
  - 제안: 객체 맵 방식(`STATUS_DESC_KEY_MAP`)으로 전환한다. 예시:
    ```ts
    const STATUS_DESC_KEY_MAP: Record<string, TranslationKey> = {
      pending_install: 'integrations.cafe24DuplicateMallPendingDesc',
      expired: 'integrations.cafe24DuplicateMallExpiredDesc',
      error: 'integrations.cafe24DuplicateMallErrorDesc',
    };
    const conflictDescKey = !conflict?.conflict
      ? null
      : STATUS_DESC_KEY_MAP[conflict.status ?? ''] ?? 'integrations.cafe24DuplicateMallConnectedDesc';
    ```

### 테스트 코드

- **[WARNING]** `integration-oauth.service.cafe24.spec.ts`의 "begin — public app duplicate prevention" describe 블록에서 목 데이터 객체가 각 테스트마다 인라인으로 중복 선언됨
  - 위치: `integration-oauth.service.cafe24.spec.ts`, ~line 159–255 (각 `it` 블록 내 `integrationRepo.find` 목 반환값)
  - 상세: 테스트마다 `id`, `workspaceId`, `status`, `serviceType`, `mallId`, `credentials` 를 가진 통합 객체를 개별 인라인으로 작성하고 있다. 필드 구조가 동일하고 일부 값만 다르기 때문에, 공통 팩토리 함수로 추출하면 향후 Integration 엔티티 형태가 바뀔 때 한 곳만 수정하면 된다.
  - 제안: `buildFakeIntegration(overrides?)` 팩토리 헬퍼를 테스트 파일 상단에 정의해 중복을 줄인다.

- **[INFO]** `integrations.service.spec.ts`의 두 유니크 위반 테스트가 동일한 `create` 호출 페이로드를 반복함
  - 위치: `integrations.service.spec.ts`, 두 번째 추가 `it` 블록 (~line 675–699)
  - 상세: `translates cafe24 mall_id unique violation`과 `translates integration name unique violation` 두 케이스가 `service.create` 호출부에서 동일한 `dto` 객체를 반복 선언한다. 이 공통 DTO 를 `const baseCreateDto` 로 추출하면 두 테스트 모두 간결해진다.
  - 제안: 공통 DTO 를 `describe` 블록 상단 변수로 추출한다.

- **[INFO]** `cafe24-precheck.test.tsx`의 `mallIdInput` 조회가 각 테스트마다 `screen.getByLabelText` 2회씩 호출됨
  - 위치: `cafe24-precheck.test.tsx`, 대부분의 `it` 블록 (~line 1059–1062, 1079–1081 등)
  - 상세: `await screen.findByLabelText(/Mall ID/i)` (존재 확인용)와 `screen.getByLabelText(/Mall ID/i)` (조작용)를 연달아 호출한다. `findByLabelText` 가 이미 요소를 반환하므로 결과를 바로 변수에 저장해 재사용하면 된다.
  - 제안:
    ```ts
    const mallIdInput = await screen.findByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    ```

### i18n 사전

- **[INFO]** `en/integrations.ts`의 신규 키에만 날짜 주석이 있고 `ko/integrations.ts`에는 더 긴 설명 주석이 있음
  - 위치: `en/integrations.ts` (~line 1577), `ko/integrations.ts` (~line 1610–1612)
  - 상세: 한국어 사전에는 3줄 설명 주석이 있고 영어 사전에는 1줄 날짜 주석만 있다. 일관성을 위해 동일한 수준의 주석을 유지하는 것이 좋다. 또한 영어 사전에서 키 `cafe24DuplicateMallToast` 에 붙은 주석이 없는 반면 한국어에는 "사후 toast 의 한글 primary 메시지" 설명이 있어 불균형하다.
  - 제안: 두 사전에서 주석 수준을 동일하게 맞추거나, 주석 자체를 각 키 위에 인라인으로 통일한다.

---

## 요약

전반적으로 이번 변경은 잘 구조화되어 있다. `findAllCafe24RowsForMall` / `findConnectedCafe24MallIntegration` 두 헬퍼를 추출해 중복 쿼리 로직을 공유한 점, 라우트 선언 순서를 e2e 테스트로 보호한 점, i18n 키 쌍을 한/영 동시에 추가한 점은 긍정적이다. 주요 개선 여지는 세 가지이다. 첫째, `PRIORITY` 배열과 상태 유니온 타입이 서비스·DTO·프론트엔드에 중복 선언되어 있어 단일 출처(Single Source of Truth) 원칙이 약화된다. 둘째, `Cafe24ExtraFields`가 `t: TFunction`을 prop으로 받는 패턴이 다른 컴포넌트의 `useT()` 직접 호출 패턴과 불일치한다. 셋째, 테스트 코드에서 인라인 목 데이터가 반복 선언되어 엔티티 구조 변경 시 수정 파급이 넓다. 이러한 항목들은 기능 정확성에는 영향이 없지만 장기 유지보수 시 마찰을 높일 수 있다.

---

## 위험도

LOW
