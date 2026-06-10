# 신규 식별자 충돌 검토 결과

## 발견사항

충돌로 분류할 항목이 없습니다. 아래에 각 신규 식별자를 검토한 결과를 나열합니다.

### [INFO] `buildOperationCatalog` — module-private 헬퍼, 충돌 없음
- target 신규 식별자: `buildOperationCatalog` (backend `integrations.service.ts` module-private 함수)
- 기존 사용처: 동일 파일 외 다른 파일에서 참조 없음 (`grep` 결과 동일 파일 내부 3줄만)
- 상세: `export` 가 없는 모듈 스코프 함수라 외부로 노출되지 않는다. `cafe24` 분기와 `makeshop` 분기를 단일 헬퍼로 통합하는 리팩터링으로, 기능적으로는 인라인 코드를 추출한 것과 동일하다. 다른 파일에 같은 이름의 심볼이 없음을 확인했다.
- 제안: 없음. 명명 충돌 없음.

### [INFO] `listAllMakeshopOperations` — 기존 패턴과 완전 대칭, 충돌 없음
- target 신규 식별자: `import { listAllMakeshopOperations }` in `integrations.service.ts`
- 기존 사용처: `/codebase/backend/src/nodes/integration/makeshop/metadata/index.ts:87` 및 `makeshop-mcp-tool-provider.ts:26` 에서 이미 export·사용 중이며, 이번 변경은 새 소비처 추가
- 상세: 함수는 branch HEAD 에서 이미 존재한다. `integrations.service.ts` 가 새로 import 하는 것이며, 이름·시그니처 모두 기존 `listAllCafe24Operations` 패턴과 대칭이다. 충돌 없음.
- 제안: 없음.

### [INFO] `resolveMakeshopOperationLabel` — 기존 패턴과 대칭, 충돌 없음
- target 신규 식별자: `import { resolveMakeshopOperationLabel }` in `page.tsx`
- 기존 사용처: `/codebase/frontend/src/lib/node-definitions/makeshop-extras.ts:47` (함수 정의), `makeshop-allowlist-editor.tsx:6`, `integration-configs.tsx:14` 에서 이미 사용 중
- 상세: 이번 diff 에서 새로 정의된 것이 아니라 기존 함수를 `page.tsx` 가 추가로 import 한 것. `resolveCafe24OperationLabel` 과 완전 대칭 네이밍. 충돌 없음.
- 제안: 없음.

### [INFO] `tryTranslateLabel` 시그니처 변경 — `TFunction → Locale`, 충돌 없음
- target 신규 식별자: `tryTranslateLabel(catalogKey: string, locale: Locale)` (파라미터 타입 변경)
- 기존 사용처: `/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx:845` — 동일 파일 module-private 함수. 외부 노출 없음.
- 상세: 함수가 `export` 없이 동일 파일에만 존재하며, 두 번째 인자 타입이 `TFunction` → `Locale` 로 변경됐다. 외부 소비처가 없으므로 API 계약 충돌이 발생하지 않는다. `cafe24Catalog.${catalogKey}` 네임스페이스 주입이 제거되고 provider-prefix 기반 flat-dict lookup 으로 교체됐다. 이로써 `makeshop.*` 키가 `cafe24Catalog` 네임스페이스에 잘못 접두되던 버그(V-08)가 해소된다.
- 제안: 없음.

### [INFO] `descriptionKey` — 기존 DTO 필드 재사용, 충돌 없음
- target 신규 식별자: `descriptionKey: \`${key}.description\`` (새로 채워지는 `OperationCatalogDto` 필드)
- 기존 사용처:
  - `OperationCatalogDto`(`integration-response.dto.ts:168`) — `descriptionKey?: string` 으로 이미 선언됨
  - `canvas-empty-state.tsx:12` — 완전히 별개 컴포넌트 내부 인터페이스의 동명 필드
  - `spec/2-navigation/4-integration.md:816` — `{ key, method, path, labelKey, descriptionKey }` 응답 형식을 명시
- 상세: DTO 필드는 이미 존재하며, 이번 변경은 `buildOperationCatalog` 가 `cafe24`·`makeshop` 양쪽 모두에서 `descriptionKey` 를 일관되게 채우도록 보장하는 것이다. `cafe24` 분기의 인라인 코드에서는 `descriptionKey` 가 이미 설정됐으므로 동작 변화는 없고, `makeshop` 분기에서 처음으로 채워진다. `canvas-empty-state.tsx` 의 동명 필드는 완전히 별개 인터페이스(`Step` 내부)라 충돌 없음.
- 제안: 없음.

### [INFO] `useLocale` 훅 import 추가 — 기존 훅, 충돌 없음
- target 신규 식별자: `import { useLocale, type Locale }` in `page.tsx`
- 기존 사용처: `/codebase/frontend/src/lib/i18n/index.ts` 에서 export 되는 훅. 다수 파일에서 이미 사용 중.
- 상세: 기존 훅의 새 소비처 추가. 명명 충돌 없음.
- 제안: 없음.

### [INFO] API endpoint `GET /api/integrations/services/:type/catalog` — 기존 endpoint, 충돌 없음
- target 신규 식별자: Swagger `@ApiParam` description 에 `makeshop` 추가 (endpoint 경로 변경 없음)
- 기존 사용처: `spec/2-navigation/4-integration.md §9.3` 및 `integrations.controller.ts:146` — endpoint 는 이미 존재
- 상세: endpoint method+path 는 변경되지 않고, description 문자열만 `cafe24` 단독에서 `cafe24·makeshop` 으로 갱신됐다. API 충돌 없음.
- 제안: 없음.

---

## 요약

이번 변경(V-06/V-08 makeshop catalog 구현)이 도입하는 신규 식별자는 총 6종으로, 모두 기존 사용처와 충돌하지 않는다. `buildOperationCatalog` 는 module-private 함수로 외부 노출이 없으며, `listAllMakeshopOperations`·`resolveMakeshopOperationLabel`·`useLocale`/`Locale` 은 기존에 이미 정의된 심볼을 새 소비처에서 import 하는 것이다. `tryTranslateLabel` 은 동일 파일 내부 함수의 파라미터 타입 변경으로 외부 계약에 영향이 없다. `descriptionKey` 는 DTO 에 이미 선언된 필드가 `makeshop` 분기에서도 채워지게 된 것이다. API endpoint 경로는 변경되지 않았다. 요구사항 ID·엔티티 타입명·이벤트명·환경변수·설정키·파일 경로 관점에서 새로 도입되는 식별자가 없으므로 충돌 위험이 없다.

## 위험도

NONE

STATUS: OK
