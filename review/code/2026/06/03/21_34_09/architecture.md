# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] Data-Only 모듈의 명확한 단일 책임 분리
- 위치: `metadata/benefit.ts`, `board.ts`, `cpik.ts`, `member.ts`, `order.ts`, `product.ts`, `shop.ts`
- 상세: 각 섹션 파일은 순수 데이터 배열(`MakeshopOperationMetadata[]`) 만 export 하며 로직이 전혀 없다. 로직은 `index.ts`(조회), `constraint-validator.ts`(검증), `public-meta.ts`(프로젝션)으로 분리되어 단일 책임이 명확하다.
- 제안: 현행 유지.

### [INFO] Cafe24 metadata 레이어를 충실히 미러링한 개방-폐쇄 구조
- 위치: `metadata/index.ts`, `types.ts`
- 상세: 새 endpoint 추가 시 해당 섹션 배열에 row 1개 추가만으로 핸들러·MCP Bridge·프론트엔드 extras 모두 자동 반영된다. `findMakeshopOperation`, `listAllMakeshopOperations`, `scopeForOperation`이 외부 소비자의 진입점을 고정하여 섹션 파일 변경이 상위 레이어를 수정하지 않는 OCP 구조다.
- 제안: 현행 유지.

### [WARNING] `SECTION_SCOPE` 매핑이 `index.ts` 내부에 숨겨진 암묵적 로직
- 위치: `metadata/index.ts` L1189–L1197 (`SECTION_SCOPE` 상수)
- 상세: `cpik` 리소스가 실제로는 두 scope 그룹(주문·회원)에 걸쳐 있음에도 `order` 하나로 고정되어 있고, 이 매핑은 파일 내 `private` 상수로만 존재한다. Phase 0 한시 결정임이 주석으로 명시되어 있으나, 향후 per-operation scope 관리(Phase 3) 시 이 상수 변경이 `scopeForOperation`의 반환값을 일괄 바꿔 테스트 외 사이드 이펙트가 발생할 수 있다. 또한 scope 그룹 매핑 정보가 `types.ts`·`spec`이 아닌 코드 내에만 존재해 spec-impl 정합성 검증 대상에서 벗어난다.
- 제안: Phase 3 전환 시 per-operation `scopeGroup?: string` 필드를 `MakeshopOperationMetadata`에 추가하거나, `SECTION_SCOPE`를 `spec/conventions/makeshop-api-metadata.md §4`와 기계적으로 동기화하는 단위 테스트를 추가한다.

### [WARNING] `constraint-validator.ts`가 Cafe24 버전의 "verbatim copy"로 선언됨
- 위치: `metadata/constraint-validator.ts` L8 주석 — "Form copied verbatim from the Cafe24 validator"
- 상세: 두 통합이 동일한 constraint 검증 로직을 각자 소유함으로써 로직 수정 시 양쪽을 동시에 갱신해야 하는 DRY 위반이다. 현재 Phase 0에서는 변경 가능성이 낮아 실질 위험은 제한적이나, constraint 종류(`kind`)가 확장될 경우 한쪽만 반영될 위험이 있다.
- 제안: `packages/` 또는 `_base/` 공통 레이어에 `validateFieldConstraints<T>(operation, fields)` 제네릭 함수를 추출하고, Cafe24·MakeShop validator 모두 이를 래핑하도록 리팩터링을 Phase 2 이전에 고려한다. 단, 현 Phase 0 범위에서는 즉각 강제 사항은 아님.

### [INFO] `public-meta.ts`가 내부 URL 구조를 프론트엔드로부터 적절히 은닉
- 위치: `metadata/public-meta.ts`
- 상세: `method`·`path`를 `PublicMakeshopOperation`에서 의도적으로 제외하여 레이어 책임을 명확히 분리했다. Cafe24 패턴을 따르면서 MakeShop-특화 차이(`restrictedApproval` 제거)를 올바르게 반영했다.
- 제안: 현행 유지.

### [INFO] `catalog-sync.spec.ts`가 spec-impl 경계를 테스트로 보호
- 위치: `metadata/catalog-sync.spec.ts`
- 상세: `spec/conventions/makeshop-api-catalog/<resource>.md` Markdown 표를 직접 파싱하여 metadata 코드와 양방향 동기를 CI에서 강제한다. 아키텍처 관점에서 spec-impl 경계에 "비침투적 가드"를 두는 좋은 패턴이다. `resolveRepoRoot()`의 `git rev-parse` 폴백은 모노레포 구조상 적절하다.
- 제안: 현행 유지.

### [INFO] `cpik_member-check`/`cpik_member-login`의 `scopeType: 'write'` 일관성 문제
- 위치: `metadata/cpik.ts` L961–L984, L1051–L1085 / `spec/conventions/makeshop-api-catalog/cpik.md`
- 상세: `index.ts` 주석(L1164)은 "CPIK member check/login POSTs are read-style"이라고 언급하지만, `cpik.ts`에서 두 operation 모두 `scopeType: 'write'`로 등록되어 있고 catalog에도 `write`로 반영되어 있다. 코드와 주석이 불일치한다. types.ts의 상위 설명("check/login POSTs are read-style")은 `types.ts`가 아니라 `index.ts`에 있어 위치도 부적합하다.
- 제안: (a) `scopeType`을 `'read'`로 수정하는 것이 의미상 더 정확하다면 catalog·metadata·테스트를 일괄 수정하고, (b) 현행 `'write'` 유지가 맞다면 `index.ts` 주석을 삭제 또는 수정한다. 주석-코드 불일치는 후속 개발자에게 혼란을 유발한다.

### [INFO] `listAllMakeshopOperations()` 반환 타입 인라인 중복
- 위치: `metadata/index.ts` L1221–L1237
- 상세: `Array<{ resource: MakeshopResource; operation: MakeshopOperationMetadata }>` 타입이 함수 시그니처와 내부 변수 초기화에서 두 번 반복된다. 가독성 저하 수준이나 타입 확장 시 두 곳을 동시 수정해야 한다.
- 제안: `type MakeshopResourceOperation = { resource: MakeshopResource; operation: MakeshopOperationMetadata }`를 로컬 또는 `types.ts` export로 추출한다.

### [INFO] `findMakeshopOperation`의 `resource: string` 파라미터 타입 이완
- 위치: `metadata/index.ts` L1203–L1215
- 상세: `resource` 파라미터가 `string`으로 선언되어 있어 TypeScript의 유니온 타입 보호(`MakeshopResource`)를 우회한다. 내부에서 `as Record<string, ...>` 캐스트로 처리하는 것이 필요한 이유가 "알 수 없는 resource에 대해 undefined 반환"이라는 정책 때문임이 주석으로 설명되어 있어 의도는 명확하다. 그러나 오버로드(overload) 방식으로 `MakeshopResource` → `MakeshopOperationMetadata | undefined` + `string` → `MakeshopOperationMetadata | undefined`를 분리하면 타입 안전성이 개선된다.
- 제안: Phase 0 허용 수준. 다만 호출 사이트에서 `MakeshopResource` 타입 인수를 전달할 때 TypeScript 가 타입 오류를 잡아내지 못하는 함정이 있으므로 Phase 2 착수 전 overload 정리를 권장한다.

## 요약

Phase 0 MakeShop metadata 레이어는 기존 Cafe24 패턴을 충실히 미러링하여 섹션 분리·단일 진실(SoT)·spec-impl 양방향 sync guard 등 핵심 아키텍처 결정이 잘 이행되었다. 레이어 책임(data/logic/public projection) 분리가 명확하고 순환 의존성도 없으며, 161개 operation이 추가될 때 핸들러·MCP·프론트엔드를 수정 없이 자동 반영하는 OCP 구조가 확립되어 있다. 주의해야 할 지점은 두 가지다: (1) `SECTION_SCOPE`의 Phase 0 한시 매핑이 문서화는 됐지만 테스트로 보호되지 않아 Phase 3 전환 시 drift 가능성이 있고, (2) `constraint-validator.ts`가 Cafe24 코드의 verbatim copy로 유지되어 DRY 위반이 잠재한다. 두 항목 모두 현 Phase 0 범위에서는 즉각 차단 수준은 아니나, Phase 2 착수 전 해소를 권장한다.

## 위험도

LOW
