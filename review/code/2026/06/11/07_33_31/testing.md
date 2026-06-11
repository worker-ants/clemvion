# Testing Review

## 발견사항

### [INFO] `tryTranslateLabel` / `renderApiCell` — 순수 함수 단위 테스트 부재
- **위치**: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `tryTranslateLabel` (L3537–3549), `renderApiCell` (L3479–3525)
- **상세**: `tryTranslateLabel` 은 provider prefix(`makeshop.` / `cafe24.` / 기타)에 따라 namespace 를 분기하고 i18n miss 시 `null` 을 반환하는 순수 함수다. 이번 변경으로 로직이 단순 문자열 concat 에서 조건 분기 3단계(makeshop / cafe24 / unknown)로 확장됐다. `renderApiCell` 은 catalog lookup → label/endpoint 렌더링 분기를 수행한다. 두 함수 모두 파일 외부로 export 되지 않아 `[id]/__tests__/` 폴더 내 파일이 하나도 커버하지 않는다. `cafe24-app-url-card.test.tsx`, `scope-tab.test.tsx` 는 Activity 탭을 전혀 다루지 않는다.
- **제안**: `tryTranslateLabel` 과 `renderApiCell` 을 내부 export(`export function` — Next.js `"use client"` boundary 에서는 허용)로 노출하거나, 별도 헬퍼 모듈로 추출해 `[id]/__tests__/activity-helpers.test.ts` 를 신설한다. 최소 커버 케이스: (1) `makeshop.*` 키 → `makeshopCatalog.*` namespace 분기 성공, (2) `cafe24.*` 키 → `cafe24Catalog.*` namespace 분기, (3) 알 수 없는 prefix → `null` 반환, (4) i18n key 미존재(translated === fullKey) → `null` 반환, (5) `renderApiCell` humanLabel 있음/없음/둘 다 null 분기.

### [INFO] `getServiceCatalog` makeshop 분기 — `descriptionKey` 포맷 검증 미포함
- **위치**: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` L1883–1893, `integrations.service.ts` L1155–1166
- **상세**: 신규 makeshop 분기에서 `descriptionKey` 는 `makeshop.${resource}.${operation.id}.description` 형태로 생성된다. 기존 테스트(`'returns makeshop operations as ...'`)는 `key` / `labelKey` / `method` / `path` 만 검증하고 `descriptionKey` 포맷을 확인하지 않는다. cafe24 카운터파트 테스트도 `descriptionKey` 를 검증하지 않아 동일 갭이 공유된다.
- **제안**: 기존 테스트에 `expect(sample.descriptionKey).toBe(\`\${sample.key}.description\`)` 단언을 추가한다. cafe24 대응 테스트에도 동일 단언을 추가하면 포맷 일관성 회귀를 양쪽에서 잡을 수 있다.

### [INFO] `getServiceCatalog` — 총 카운트(161개) 전체 매핑 검증 없음
- **위치**: `integrations.service.spec.ts` L1883–1893
- **상세**: 메타데이터 레이어(`metadata.spec.ts`)는 `listAllMakeshopOperations().length === 161` 을 검증한다. 그러나 `getServiceCatalog('makeshop')` 반환값의 `operations.length` 도 161 이어야 한다는 것은 서비스 계층 테스트에서 명시적으로 확인되지 않는다. 중간에 `.map()` 실수나 `.filter()` 삽입 시 탐지되지 않는다.
- **제안**: `expect(result.operations.length).toBe(161)` 단언을 추가한다(또는 `listAllMakeshopOperations().length` 와 같음을 비교). cafe24 쪽도 동일 패턴으로 보완 가능하다.

### [INFO] 컨트롤러 레이어(`integrations.controller.ts`) — Swagger 메타 변경에 대한 컨트롤러 단위 테스트 없음
- **위치**: `codebase/backend/src/modules/integrations/integrations.controller.ts` (파일 전체)
- **상세**: 이번 변경은 Swagger `description`/`ApiParam` 문자열 수정만이라 런타임 동작을 바꾸지 않는다. 그러나 `integrations.controller.spec.ts` 가 존재하지 않아, `getServiceCatalog(type)` 위임 경로, `@Param('type')` 추출, 라우트 선언 순서(`:id` 충돌 방지 로직)가 컨트롤러 레이어에서 전혀 테스트되지 않는다. 미래 컨트롤러 변경 시 회귀 안전망이 없다.
- **제안**: 본 PR 범위에서 당장 컨트롤러 spec 을 신설할 의무는 없으나, `GET /services/:type/catalog` 에 대한 NestJS 컨트롤러 단위 테스트(`@nestjs/testing` + `createTestingModule`) 를 백로그에 등록하도록 권고한다. 최소: `type='cafe24'`·`type='makeshop'`·`type='unknown'` 세 케이스.

### [INFO] `tryTranslateLabel` — unknown prefix fallback 분기가 기존 `cafe24Catalog.*` 키에 이중 namespace 접두사를 붙이는 경우 테스트 없음
- **위치**: `page.tsx` L3538–3548
- **상세**: 변경 전 코드는 `cafe24Catalog.${catalogKey}` 로 단순 prefix 를 붙였다. 변경 후 `catalogKey` 자체가 이미 `cafe24.` 로 시작하면 `cafe24Catalog.cafe24.<resource>.<op>` 가 조합되는데, `catalogKey.startsWith("cafe24.")` 분기가 잡아 `cafe24Catalog.cafe24.<resource>.<op>` 형태가 된다. 이는 실제 i18n dict 키 구조와 일치하므로 동작은 올바르다(`t(fullKey)` 가 miss 시 `null` 반환). 하지만 이 케이스를 검증하는 명시적 테스트가 없어 의도가 드러나지 않는다. 특히 `cafe24` prefix 없이 내려오는 legacy `apiLabel`(`"shop.get_products"` 같은 형태)에 대한 동작이 문서화되지 않는다.
- **제안**: unknown prefix 케이스(`"http.something"`, `"bare_key"`)를 `tryTranslateLabel` 테스트에 명시적으로 추가한다.

---

## 요약

이번 변경은 MakeShop 카탈로그 지원을 백엔드 서비스(`getServiceCatalog` makeshop 분기), 프론트엔드 i18n 헬퍼(`tryTranslateLabel` provider-prefix 일반화) 두 계층에 추가한 것이다. 백엔드 서비스 레이어는 `integrations.service.spec.ts` 에 신규 `'returns makeshop operations as...'` 테스트가 추가되어 핵심 동작(키 패턴, method, path)을 커버하며, 메타데이터 레이어도 `metadata.spec.ts` 에서 161개 연산, 고유성, 제약 등을 충분히 검증한다. 그러나 `tryTranslateLabel` / `renderApiCell` 과 같이 분기 로직이 실질적으로 확장된 순수 함수에 대한 프론트엔드 단위 테스트가 전무하며, `descriptionKey` 포맷 및 전체 operations 카운트 검증이 빠져 있다. 컨트롤러 레이어 테스트 부재는 이번 PR 에만 국한된 문제가 아니지만 이번 기회에 백로그로 등록할 필요가 있다. 발견된 갭 모두 기능 결함을 유발하는 수준이 아니고 테스트 커버리지 보완 성격이므로 전체적인 위험도는 낮다.

## 위험도

LOW
