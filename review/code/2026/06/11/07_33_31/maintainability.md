# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 3: integrations.service.ts — getServiceCatalog

- **[WARNING]** `getServiceCatalog` 내 cafe24/makeshop 두 분기가 구조적으로 동일한 코드를 복붙한 형태
  - 위치: lines 1167-1191 (`getServiceCatalog`)
  - 상세: 두 분기는 `listAll<X>Operations()` 호출과 `provider.${resource}.${operation.id}` 키 조립 외에는 동일 로직이다. provider 가 세 번째로 추가될 때 동일 블록이 또 생긴다(shotgun surgery).
  - 제안: 공통 헬퍼 함수 `mapOperationsToCatalog(provider: string, ops: ReturnType<typeof listAllCafe24Operations>): OperationCatalogItem[]`로 추출하고, `getServiceCatalog` 는 `provider → listFn` 맵으로 디스패치. 기존 `INTEGRATION_DERIVED_REGISTRY` 패턴(Map 디스패치)이 이미 동일 프로젝트에 존재하므로 일관성 측면에서도 맞다.

- **[INFO]** `getServiceCatalog` 의 `serviceType` 파라미터 타입이 `string`으로 느슨하다
  - 위치: line 1166
  - 상세: 지원 serviceType 이 service-registry 에 이미 열거형으로 관리되고 있다. `string` 로 받으면 오타 방어가 런타임에만 일어난다.
  - 제안: 가능하면 `ServiceType` union 타입(또는 registry 에서 derive)으로 좁히거나, 최소한 JSDoc 으로 유효값 열거 보충.

---

### 파일 1: integrations.controller.ts — getServiceCatalog Swagger 메타

- **[INFO]** `@ApiParam` 의 `example` 값이 `'cafe24'` 로 고정되어 신규 지원 서비스(`makeshop`)를 예시하지 않는다
  - 위치: line 43 (`example: 'cafe24'`)
  - 상세: description 은 `cafe24 · makeshop` 둘 다 언급하도록 갱신됐지만, `example` 필드는 `'cafe24'` 그대로다. Swagger UI 에서 `makeshop` 은 숨겨진 케이스가 된다.
  - 제안: `example: 'cafe24'` → `example: 'makeshop'` 또는 `examples` 객체로 두 값 모두 노출.

---

### 파일 4: page.tsx — tryTranslateLabel

- **[INFO]** `tryTranslateLabel` 의 namespace 선택 로직이 provider 추가마다 else-if 체인으로 늘어난다
  - 위치: lines 3539-3543 (`tryTranslateLabel`)
  - 상세: 현재 `cafe24 → makeshop → null` 2단 체인. provider 가 늘면 수동으로 조건을 추가해야 한다. 백엔드의 `INTEGRATION_DERIVED_REGISTRY` Map 패턴처럼 프론트엔드도 `CATALOG_NAMESPACE_MAP: Record<string, string>` 상수를 두면 변경 없이 확장 가능하다.
  - 제안:
    ```ts
    const CATALOG_NAMESPACE: Record<string, string> = {
      cafe24: 'cafe24Catalog',
      makeshop: 'makeshopCatalog',
    };
    // 첫 segment 로 provider 추출 후 map lookup
    const provider = catalogKey.split('.')[0];
    const namespace = CATALOG_NAMESPACE[provider] ?? null;
    ```
    이 패턴은 현재 코드 대비 동작 동일, 확장 시 한 곳만 수정.

- **[INFO]** `fullKey = \`${namespace}.${catalogKey}\`` 에서 `catalogKey` 자체에 provider prefix(`makeshop.`)가 이미 포함되어 있어 `makeshopCatalog.makeshop.<resource>.<op>` 형태가 된다
  - 위치: line 3545
  - 상세: 언뜻 이중 prefix 처럼 보이지만, 실제로 i18n dict 의 구조가 `makeshopCatalog["makeshop.orders.list"]` 형태로 정의되어 있을 것이다. 이 구조가 의도적임을 코드 주석에서 명확히 해야 한다. 현재 주석은 i18n miss 처리 로직만 설명하고, 키 조립 형식에 대한 설명이 없다.
  - 제안: 함수 JSDoc 또는 인라인 주석에 `fullKey` 형식 예시 추가: `// e.g. "makeshopCatalog.makeshop.orders.list"`.

---

### 파일 2: integrations.service.spec.ts

- **[INFO]** 신규 테스트 `'returns makeshop operations...'`에서 `result.operations[0]` 접근 전 배열 길이 확인이 누락됨
  - 위치: lines 648-650
  - 상세: `expect(result.operations.length).toBeGreaterThan(0)` 후 `result.operations[0]` 를 직접 인덱스 접근하는데, 단언 실패 시 Jest 는 다음 줄로 넘어가지 않지만, strict-null 환경에서 TypeScript 컴파일러는 `[0]`이 `undefined` 일 수 있다고 경고할 수 있다.
  - 제안: `const sample = result.operations.at(0)!;` 또는 위 패턴이 이미 cafe24 테스트에서도 동일하게 쓰이고 있으므로 팀 관습이라면 INFO 수준 문제로만 남긴다.

---

### 전반

- **[INFO]** `getServiceCatalog` 의 cafe24 분기는 기존 코드이고 이번 PR 에서 makeshop 분기만 추가됐다. 기존 코드 리팩토링 없이 분기를 덧붙이는 패턴 자체는 단기 유지보수에 문제없지만, provider 가 3개 이상 될 경우 리팩토링 부채로 전환된다. 현재는 수용 가능한 범위.

---

## 요약

이번 변경은 makeshop catalog 지원 추가라는 단일 목적에 충실하며, 대부분의 코드가 기존 cafe24 패턴을 그대로 따른다. 주요 유지보수성 우려는 `getServiceCatalog` 의 cafe24/makeshop 이중 분기로, 동일한 key-조립 로직이 복제되어 있어 세 번째 provider 추가 시 중복이 심화된다. 이를 공통 헬퍼 함수 또는 Map 디스패치로 추출하는 것이 권장된다. 프론트엔드 `tryTranslateLabel` 의 namespace 매핑도 Map 상수로 교체하면 확장성이 높아진다. Swagger `example` 미갱신은 문서 불일치의 작은 원인이다. 이상의 사항들은 기능 정확성에 영향을 주지 않으며 지금 당장 릴리즈를 막을 수준은 아니다.

## 위험도

LOW
