# 유지보수성(Maintainability) 리뷰

## 발견사항

### 1. 가독성 / 네이밍

- **[INFO]** `detailsObj` 변수명이 다소 모호하다
  - 위치: `integration-oauth.service.ts` +43~46 (diff 기준)
  - 상세: `detailsObj`는 `Record<string, unknown> | undefined` 로 선언되어 있는데, 실질적으로는 `requiresCafe24Approval` 하나만 담는 좁은 구조체다. `extra` 파라미터에서 바로 가져오면 되는 값을 중간 변수에 담는 과정이 약간 불필요하게 느껴진다.
  - 제안: 아래처럼 인라인으로 줄이거나, 이름을 `requiresApprovalDetails`처럼 의도를 드러내는 이름으로 바꾼다.
    ```ts
    const approvalScopes = extra?.requiresCafe24Approval?.length
      ? extra.requiresCafe24Approval
      : undefined;
    const lastError = {
      code: errorCode,
      message: sanitizeLastErrorMessage(errorMessage),
      at: new Date().toISOString(),
      ...(approvalScopes ? { details: { requiresCafe24Approval: approvalScopes } } : {}),
    };
    ```

- **[INFO]** `cafe24-api.client.ts`의 `lastErrorDetails` 변수와 `requiresApproval` 변수가 2단계로 분리되어 있어 독해 시 시선 이동이 생긴다
  - 위치: `cafe24-api.client.ts` +224~231
  - 상세: `requiresApproval` → `lastErrorDetails` 두 단계 모두 삼항 또는 ternary 로 처리되어 있고, `lastErrorDetails`를 만든 후 spread 할 때 다시 ternary를 사용한다(`...(lastErrorDetails ? { details: lastErrorDetails } : {})`). 3겹 ternary 중첩은 아니지만 맥락을 따라가려면 두 변수를 동시에 추적해야 한다.
  - 제안: 두 변수를 하나로 합쳐 `details` 직접 계산으로 단순화한다.
    ```ts
    const approvalDetails =
      reason === 'insufficient_scope'
        ? (() => {
            const scopes = pickRestrictedApprovalScopes(extractCafe24ScopeTokens(errBody));
            return scopes ? { requiresCafe24Approval: scopes } : undefined;
          })()
        : undefined;
    ```
    혹은 헬퍼 함수로 추출해 가독성을 확보한다.

- **[INFO]** `CANONICAL_HEADERS` 배열 내 `'라벨 (한)'`과 `'english title'` — 한국어 문자열이 상수 이름과 섞이는 것은 기존 패턴과 일관성이 있으나, 영어 소문자 표기 (`'english title'`)가 실제 파일 헤더 텍스트에 종속적이어서 헤더 변경 시 묵시적 파괴가 생긴다
  - 위치: `catalog-sync.spec.ts` +310~321
  - 상세: `buildColumnIndex`가 `headerCells.indexOf(name)`로 헤더 문자열을 직접 비교하는데, 대소문자 정규화(`toLowerCase()`)를 `parseHeaderCells`에서 처리하고 있어 괜찮다. 다만 `'라벨 (한)'`처럼 한국어 키는 오타를 탐지하기 어렵다.
  - 제안: 상수를 `as const` 객체로 정의하거나, 헤더 이름을 enum으로 관리하면 오타 방어가 된다. 현재 구조에서 최소 조치로는 주석으로 "실제 마크다운 헤더 문자열과 1:1 매핑" 임을 명시하는 것으로 충분하다.

---

### 2. 중복 코드

- **[WARNING]** `Cafe24ApprovalGroup` 타입이 backend와 frontend에 각각 독립적으로 정의되어 있어 동기 관리가 필요하다
  - 위치: `backend/src/nodes/integration/cafe24/metadata/types.ts` +99~108, `frontend/src/lib/node-definitions/types.ts` +1595~1604
  - 상세: 두 파일의 union 멤버 목록(`'mileage' | 'notification' | 'privacy' | 'activitylogs' | 'menus' | 'naverpay_setting' | 'kakaopay_setting' | 'pg_settings' | 'analytics'`)이 완전히 동일하다. 새 그룹이 추가될 때 두 곳을 동시에 수정해야 하며, 하나를 놓치면 타입 불일치가 런타임에서만 발견된다.
  - 제안: 단기적으로는 코드 주석에 "두 정의는 항상 동기되어야 한다. backend types.ts 수정 시 frontend types.ts 도 같이 갱신" 임을 명시한다. 중기적으로는 shared 패키지 또는 monorepo 공유 타입 파일로 추출하거나, backend API 스키마에서 자동 생성하는 방식을 검토한다.

- **[WARNING]** `Cafe24RestrictedApproval` 인터페이스/타입도 backend(`types.ts`)와 frontend(`types.ts`)에 독립 정의되어 있다
  - 위치: `backend/src/nodes/integration/cafe24/metadata/types.ts` +110~126, `frontend/src/lib/node-definitions/types.ts` +1606~1611
  - 상세: 위 `Cafe24ApprovalGroup` 과 동일한 중복 문제. `level`, `approvalGroup`, `docsUrl`, `inquiryUrl` 4개 필드가 동일 구조로 복제되어 있다. `inquiryUrl`이 한 쪽에서 `required`로, 다른 쪽에서 선택적으로 바뀌면 런타임 불일치가 발생할 수 있다.
  - 제안: `Cafe24ApprovalGroup`과 함께 처리 — shared 타입으로 추출 또는 API 계약 파일 기반 생성.

- **[INFO]** `RestrictedScopeNotice` 컴포넌트에서 `inquiryUrl` 기본값(`"https://developers.cafe24.com"`)이 `restricted-approval.ts`의 `INQUIRY_URL` 상수와 문자열이 같으나 서로 독립적으로 하드코딩되어 있다
  - 위치: `approval-required-badge.tsx` +1389, `restricted-approval.ts` +896
  - 상세: URL이 바뀔 때 두 곳을 모두 수정해야 한다. 현재는 frontend/backend 영역 분리로 인해 불가피한 면이 있으나, 같은 repo 안에서 동일 문자열이 중복된다.
  - 제안: `ScopeOption.requiresApproval` 과 같이 `inquiryUrl`도 백엔드 API 응답에 포함(`RestrictedScopeNotice`의 기본값을 단순 fallback 수준으로 유지)하거나, frontend 내부 상수 파일에 `CAFE24_DEVELOPER_CENTER_URL`을 한 곳에 정의하고 양쪽에서 import 한다.

---

### 3. 매직 넘버 / 매직 문자열

- **[WARNING]** `catalog-sync.spec.ts` 내 `if (cells.length < 9) continue;` 가 하드코딩 숫자로 남아있다
  - 위치: `catalog-sync.spec.ts` +380 (diff 기준, 변경 후 코드 `if (cells.length < 9) continue;`)
  - 상세: 이 숫자는 "선택적 `restricted` 컬럼 없는 구 형식에서의 최소 컬럼 수"인데, `restricted` 컬럼이 추가된 후에도 숫자가 갱신되지 않은 것으로 보인다. 신규 컬럼이 필수가 되면 10으로 높여야 하나 현재 주석이나 설명이 없다.
  - 제안: `const MIN_CATALOG_COLUMNS = 9; // id, label-ko, en-title, method, path, scope, paginated, status, docs (restricted optional)` 처럼 named constant로 추출하고 의미를 주석으로 명시한다.

- **[INFO]** `integration-configs.tsx`에서 승인 필요 operation 라벨에 ⚠ 유니코드 문자를 직접 삽입하고 있다
  - 위치: `integration-configs.tsx` +1321
  - 상세: `` `${op.label} ⚠ ${t(...)}` `` — 이 ⚠ 문자는 `ApprovalRequiredBadge` 컴포넌트의 `<AlertTriangle>` 아이콘과 다른 경로다. 두 개의 "경고 표시" 방법이 혼재한다. select option은 JSX를 쓸 수 없어 문자열 리터럴이 불가피하지만, 코드 내 유니코드 하드코딩은 스크린리더 처리 등에서 별도 고려가 필요하다.
  - 제안: 이 항목은 select option 특성상 불가피한 제약임을 주석으로 명시한다(`// select option은 JSX 불가 — ApprovalRequiredBadge 대신 문자열 삽입`). aria-label 처리는 별도 검토 필요.

---

### 4. 함수 길이 / 복잡도

- **[INFO]** `extractCafe24ScopeTokens` 함수는 2단계 object 순회 + regex 추출을 한 함수에서 처리하고 있다
  - 위치: `restricted-approval.ts` +943~971
  - 상세: 함수 자체는 약 28줄로 짧지 않지만 단일 책임에 가깝다. 다만 `sources` 배열 수집 → regex 추출 → 중복 제거의 세 단계가 명시적으로 구분되지 않아 첫 독해 시 목적 파악이 다소 느리다. 전반적으로 허용 범위이나 경미한 구조화 여지가 있다.
  - 제안: 각 단계를 한 줄 공백으로 분리하고 단계별 짧은 주석(`// 1. flatten all string values from body`  / `// 2. extract mall.* tokens, deduplicate`)을 추가하면 독해 속도가 향상된다.

- **[INFO]** `parseCatalogFile` 함수는 약 60줄로 길고 헤더 파싱 / row 파싱 / 타입 변환이 한 함수에 있다
  - 위치: `catalog-sync.spec.ts` +348~427
  - 상세: 이미 `parseHeaderCells`, `buildColumnIndex`, `cellOr` 를 분리한 것은 좋은 개선이다. row 변환 부분(`cells` → `CatalogRow`)도 별도 함수(`parseCatalogRow`)로 추출하면 `parseCatalogFile`이 루프 제어만 담당하게 되어 단일 책임이 강화된다.
  - 제안: `parseCatalogRow(cells: string[], columnIndex: Record<string, number>): CatalogRow | null` 형태로 추출. 현재도 기능적으로 문제없으며 테스트 파일 특성상 강제하지 않아도 되나, 카탈로그 컬럼이 계속 추가될 경우 함수가 더 길어질 수 있으므로 중기적 개선 대상이다.

---

### 5. 중첩 깊이

- **[INFO]** `extractCafe24ScopeTokens`의 object 순회 부분이 2단계 for-of 중첩을 포함한다
  - 위치: `restricted-approval.ts` +947~955
  - 상세:
    ```ts
    for (const v of Object.values(body as ...)) {
      if (typeof v === 'string') sources.push(v);
      else if (v && typeof v === 'object') {
        for (const inner of Object.values(v as ...)) {
          if (typeof inner === 'string') sources.push(inner);
        }
      }
    }
    ```
    2단계까지이며 함수 문서에 "shallow object"라고 명시되어 있어 의도적 제한이다. 현재 수준은 허용 범위 내다.
  - 제안: 주석에 "shallow: 최대 2단계만 순회" 가 있어 의도가 표현되어 있으나, 추후 depth가 늘어날 가능성에 대비해 재귀 헬퍼를 준비하는 것을 고려할 수 있다. 현재는 변경 불필요.

---

### 6. 일관성

- **[INFO]** 카탈로그 파일의 `restricted` 컬럼 값으로 spec plan 문서에는 `'op'`가 언급되어 있으나, 실제 구현에서는 `'operation'`으로 정의되어 있다
  - 위치: `plan/in-progress/cafe24-restricted-scopes.md` +1823 (`'op'`), `catalog-sync.spec.ts` +293 (`type CatalogRestricted = 'scope' | 'operation' | ''`)
  - 상세: plan 문서 §4의 "카탈로그 표 컬럼 값 enum" 설명에서 `op`라고 했으나, 코드와 타입은 `'operation'`을 사용한다. 이것이 plan 문서 작성 시점의 임시 약어인지 불일치인지 명확하지 않다.
  - 제안: plan 문서의 enum 값을 `'operation'`으로 정정한다 (또는 이미 plan이 outdated임을 표시).

- **[INFO]** `scope-tab.tsx`에서 `lastError.details`를 타입 단언(`as { requiresCafe24Approval?: string[] } | undefined`)으로 접근하고 있다
  - 위치: `scope-tab.tsx` +1181~1183
  - 상세: `IntegrationDto.lastError.details`는 `Record<string, unknown>`으로 정의되어 있어 구체 타입을 알 수 없는 것이 현재 타입 구조상 불가피하다. 그러나 타입 단언 코드가 UI 컴포넌트 내에 인라인으로 존재하면 동일 데이터를 다른 곳에서 접근할 때도 단언을 반복하게 된다.
  - 제안: `integrations.ts`의 `IntegrationDto.lastError.details` 타입을 더 구체적인 discriminated union이나 타입 가드 함수로 감싸거나, `extractRequiresCafe24Approval(lastError: IntegrationDto['lastError']): string[]` 같은 유틸 함수를 `integrations.ts`에 추가해 타입 단언을 한 곳으로 모은다.

---

## 요약

전반적으로 이번 PR은 유지보수성 관점에서 양호한 수준이다. `restricted-approval.ts`를 신규 단일 진실 파일로 분리한 설계, `RESTRICTED_APPROVAL` 상수 객체를 통한 메타데이터 중앙화, `parseHeaderCells`·`buildColumnIndex`·`cellOr` 헬퍼 분리 등은 긍정적인 패턴이다. 다만 `Cafe24ApprovalGroup`과 `Cafe24RestrictedApproval` 타입이 backend와 frontend에 각각 독립 정의되어 있어 향후 동기 부담이 생기는 점이 가장 큰 유지보수 위험이다. 이외에는 변수명 명료화, 하드코딩 숫자 상수화, 타입 단언 중앙화 등 경미한 개선 여지가 있으나 현재 코드도 충분히 읽힌다.

## 위험도

LOW
