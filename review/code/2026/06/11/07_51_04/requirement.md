# 요구사항(Requirement) Review

## 발견사항

### 1. **[WARNING]** `getServiceCatalog`: 미지원(truly unknown) `:type` 에 대해 404 미반환 — spec §9.3 일탈

- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `getServiceCatalog()` (변경 후 1199행)
- 상세: `spec/2-navigation/4-integration.md §9.3` (line 816) 은 "**미지원 `:type` 은 일반 404**" 로 명시한다. `{http, database, email, webhook, mcp, google, github}` 은 `{ operations: [] }` 를 반환하고, 그 외 등록되지 않은(completely unknown) 서비스 타입은 404 를 반환해야 한다. 현재 구현은 `cafe24` / `makeshop` 이 아닌 모든 입력(완전 미등록 타입 포함)에 `{ operations: [] }` 를 반환해 spec 과 다르다.
  - 이 동작은 이번 PR 이 도입한 것이 아닌 **기존 코드**에서 이월된 것이지만, 이번 PR 이 해당 함수를 수정하는 동시에 테스트 설명을 `'non-cafe24 service types'` → `'unsupported service types'` 로 바꾸고 `'unknown'` 을 명시 포함해 잘못된 동작을 **정식화**했다.
- 제안: `getServiceCatalog` 의 fall-through 분기를 다음처럼 변경한다:
  ```ts
  const KNOWN_EMPTY = new Set(['http', 'database', 'email', 'webhook', 'mcp', 'google', 'github']);
  if (KNOWN_EMPTY.has(serviceType)) return { operations: [] };
  throw new NotFoundException({ code: 'OPERATION_CATALOG_NOT_FOUND', message: `No catalog for service type: ${serviceType}` });
  ```
  테스트도 `unknown` 을 별도 블록에서 `NotFoundException` 으로 기대하도록 분리한다.

---

### 2. **[INFO]** [SPEC-DRIFT] spec §9.3 Rationale 가 "초기엔 cafe24 만" 이라고 기술 — makeshop 추가 반영 필요

- 위치: `spec/2-navigation/4-integration.md §9.3 Rationale` line 1147 ("왜 초기엔 cafe24 만 응답하나")
- 상세: 구현이 `cafe24·makeshop` 양쪽 모두 채워 반환하도록 확장됐고, 본문(line 816)의 **초기 응답 정책** 행은 이미 `makeshop` 을 포함하도록 갱신되어 있다. 그러나 Rationale 하단의 "왜 초기엔 cafe24 만 응답하나" 단락은 `cafe24 만` 이라는 옛 표현을 유지한다. 이는 코드 버그가 아니라 spec 본문의 Rationale 텍스트가 구현 확장을 반영하지 않은 것이다.
- 제안: 코드 유지 + spec 반영 — `spec/2-navigation/4-integration.md` §9.3 Rationale "왜 초기엔 cafe24 만 응답하나" 단락에서 `cafe24 만` → `cafe24 · makeshop` 으로 갱신 (`project-planner` spec 갱신 대상).

---

### 3. **[INFO]** `tryTranslateLabel`: `apiLabel` 이 알 수 없는 provider prefix 로 시작할 경우 자동으로 `null` 반환

- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` `tryTranslateLabel()` (변경 후 3545~3554행)
- 상세: `makeshop.*` / `cafe24.*` 이외의 prefix 는 `null` 을 반환해 endpoint-only fallback 으로 흐른다. 이는 §4.6 spec 의 "둘 다 NULL 이면 `—`" 정책과 일치하고, 향후 provider 추가 시 자연스러운 graceful degradation 이다. 에러 경계 없음, 반환값 완전.

---

### 4. **[INFO]** `buildOperationCatalog` 헬퍼: `ops` 가 빈 배열인 경우 빈 `operations: []` 반환 — 정상 경로

- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `buildOperationCatalog()` 함수
- 상세: `listAllMakeshopOperations()` 또는 `listAllCafe24Operations()` 가 빈 배열을 반환하면 `{ operations: [] }` 가 반환된다. 이는 정의상 유효한 응답이며, catalog-sync 테스트(`catalog-sync.spec.ts`)가 비어있음을 빌드 시 감지하므로 추가 런타임 가드는 불필요하다.

---

### 5. **[INFO]** `descriptionKey` 규칙이 테스트에서 명시 검증됨 — 규약 일치 확인

- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (변경 라인: `expect(sample.descriptionKey).toBe(...)`)
- 상세: 새로 추가된 테스트가 `descriptionKey = ${key}.description` 규칙을 makeshop 와 cafe24 모두에 대해 단언한다. `spec/conventions/cafe24-api-metadata.md §7.5` "descriptionKey 파생 규칙" 및 `spec/conventions/makeshop-api-metadata.md §2` 의 동형 패턴과 일치한다.

---

## 요약

이번 변경은 V-06(makeshop catalog 미충전)·V-08(Activity 탭 label namespace cafe24 고정) 위반을 해소하기 위한 것이다. 핵심 기능(backend `getServiceCatalog` makeshop 분기 + `buildOperationCatalog` 공통 헬퍼 추출 + frontend `tryTranslateLabel` provider-prefix 일반화 + 카탈로그 staleTime 1h fetch)은 `spec/2-navigation/4-integration.md §9.3` 와 `spec/conventions/makeshop-api-metadata.md §2` 의 요구사항을 충족한다. 주요 경계·에러·반환값 처리도 완전하다. 단, 미지원(completely unknown) `:type` 에 대해 spec §9.3 이 명시하는 404 를 반환하지 않고 빈 배열을 반환하는 점은 기존 코드에서 이월된 동작이지만, 이번 PR 이 해당 테스트를 개정하면서 잘못된 동작을 정식화했으므로 수정이 필요하다. spec Rationale 한 단락("초기엔 cafe24 만")도 갱신이 필요하다(SPEC-DRIFT).

## 위험도

LOW

STATUS: SUCCESS
