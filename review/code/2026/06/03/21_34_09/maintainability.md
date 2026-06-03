# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 데이터 파일 (benefit.ts, board.ts, cpik.ts, member.ts, order.ts, product.ts, shop.ts)

- **[INFO]** 섹션 파일 7개가 동일한 `MakeshopOperationMetadata[]` 패턴으로 구성된 순수 데이터 선언이다. 로직 없이 정적 배열만 포함하므로 함수 길이·중첩·복잡도 관점에서 문제 없다.

- **[INFO]** `board.ts` 의 `score_1` ~ `score_5` 필드 (post-board-store) 는 구조적으로 유사한 5개 항목이 반복된다.
  - 위치: `board.ts` post-board-store fields
  - 상세: `score_1` / `score_2` / `score_3` / `score_4` / `score_5` 는 description 만 번호가 다른 동일 형태다. 현재 수준에서 flat 선언이 데이터 파일의 관례(cafe24 패턴 미러링)와 일치하므로 강제 리팩터링 필요는 없다. 다만 향후 score 수가 늘거나 설명이 달라질 때 유지보수 비용이 높아진다.
  - 제안: INFO 수준 관찰. 만약 score 계열 필드가 추가될 가능성이 있다면 `score_N` 키를 동적으로 생성하는 헬퍼 함수를 고려할 수 있다.

- **[INFO]** `cpik.ts` 에서 `post-cpik_member-check`, `post-cpik_member-delete`, `post-cpik_member-login` 의 `timestamp` 필드 description 이 미묘하게 다르다.
  - check: `'요청 시각 (Unix timestamp, 5분 유효)'`
  - delete: `'요청 시각 (Unix timestamp (5분 유효))'`
  - login: `'요청 시각 (Unix timestamp (5분 유효))'`
  - join: `'요청 시각. Unix timestamp (5분 유효)'`
  - 상세: 구두점·괄호 스타일이 4가지로 혼용된다. API 문서에서 그대로 복사된 것으로 보이지만, 코드베이스 내 일관성을 위해 통일이 권장된다.
  - 제안: 동일 의미의 description 을 `'요청 시각 (Unix timestamp, 5분 유효)'` 로 통일.

---

### types.ts

- **[INFO]** `MakeshopFieldConstraint` 타입 주석에 "Three kinds:" 라고 쓰고 실제로는 4가지 kind 를 열거한다.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/makeshop/metadata/types.ts` 라인 ~1800
  - 상세: 주석 `Three kinds:` 는 오기이며 `impliesValue` 가 추가되어 총 4가지다. Cafe24 원본을 그대로 복사하면서 발생한 것으로 보인다.
  - 제안: `Three kinds:` → `Four kinds:` 로 수정.

---

### constraint-validator.ts

- **[INFO]** 가독성·복잡도 양호. `checkOne` 함수는 4개 kind 를 if-chain 으로 처리하며 각 분기가 짧고 명확하다. exhaustive check 패턴(`const _exhaustive: never = c`) 은 TypeScript 관용 패턴으로 적절하다.

- **[INFO]** 파일 상단 모듈 주석에 "Form copied verbatim from the Cafe24 validator" 라는 표현이 있다. 실제로 두 파일이 완전 동일 구현이라면, 향후 버그 수정·기능 확장 시 양쪽을 동시에 수정해야 하는 유지보수 부담이 발생한다.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/makeshop/metadata/constraint-validator.ts` 라인 ~773
  - 상세: 현재 Phase 0 에서는 중복이 허용 가능하지만, 두 validator 가 계속 동일하게 유지될 경우 공통 패키지(`packages/`) 로 추출하는 것이 장기 유지보수에 유리하다.
  - 제안: Phase 2/3 구현 시 `packages/` 레벨 공통 constraint-validator 추출을 고려. 현재는 INFO 수준.

---

### index.ts

- **[INFO]** `listAllMakeshopOperations` 함수의 반환 타입 인라인 선언이 두 번 반복된다.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` 라인 ~1222-1228
  - 상세: `Array<{ resource: MakeshopResource; operation: MakeshopOperationMetadata; }>` 가 함수 시그니처와 변수 `out` 선언에 중복 등장한다. TypeScript 추론이 가능한 상황이므로 `out` 의 타입 어노테이션을 제거하거나 타입 별칭으로 추출하면 가독성이 향상된다.
  - 제안: `type ResourceOperation = { resource: MakeshopResource; operation: MakeshopOperationMetadata }` 별칭 추출.

- **[INFO]** `findMakeshopOperation` 의 파라미터 타입이 `resource: string` 이다 (MakeshopResource 가 아님).
  - 위치: index.ts `findMakeshopOperation` 시그니처
  - 상세: 런타임에서 unknown resource 를 처리하기 위한 의도적 선택으로, 함수 내 `as Record<string, ...>` 캐스팅과 함께 undefined 반환으로 처리한다. 이는 핸들러에서 외부 입력을 그대로 전달할 때 유용하나, 타입 narrowing 없이 내부 캐스팅으로 처리되어 직관성이 낮다. 함수 주석이 동작을 설명하고 있어 수용 가능한 수준이다.

---

### public-meta.ts

- **[INFO]** `buildMakeshopExtras` 와 `toPublicMakeshopOperation` 의 책임 분리가 명확하다. 단일 책임 원칙 준수.

- **[INFO]** `buildMakeshopExtras` 내부의 `Object.entries(MAKESHOP_OPERATIONS_BY_RESOURCE) as Array<[MakeshopResource, ...]>` 캐스팅 패턴이 `index.ts` `listAllMakeshopOperations` 와 동일하게 반복된다.
  - 상세: 두 곳에서 동일한 타입 캐스팅이 사용된다. 헬퍼 함수 `entriesOfOperationsByResource()` 로 추출하면 캐스팅 중복을 제거할 수 있다.
  - 제안: INFO 수준. Phase 2 이전에 리팩터링하면 향후 resource 추가 시 한 곳만 수정하면 된다.

---

### catalog-sync.spec.ts

- **[INFO]** `parseCatalogFile` 함수는 약 60라인으로 마크다운 파싱 로직 전체를 담당한다. 상태 변수(`inTable`, `headerSeen`, `isRest`, `columnIndex`)가 다수이나 각 상태의 전환이 명확히 주석·코드로 표현되어 있어 가독성이 양호하다. 분리 필요성은 낮다.

- **[INFO]** `resolveRepoRoot` 함수의 fallback 경로 `join(__dirname, '..', '..', '..', '..', '..', '..', '..')` 는 7단계 상위 경로로 하드코딩되어 있다.
  - 위치: catalog-sync.spec.ts 라인 ~435
  - 상세: 디렉터리 구조가 변경되면 fallback 경로가 조용히 깨진다. 실제로는 `git rev-parse` 가 성공하는 환경에서만 테스트가 실행되므로 실용적 위험은 낮지만, 해당 경로의 의미를 주석으로 명시하면 좋다.
  - 제안: `// 7 levels up: metadata → makeshop → integration → nodes → src → backend → codebase → repo root` 주석 추가.

- **[INFO]** `REST_HEADERS` 상수가 파일 수준 상수로 선언되어 있으나 `buildColumnIndex` / `isRestHeader` 두 함수에서만 사용된다. 현재 위치는 적절하다.

- **[INFO]** 테스트에서 `throw new Error(...)` 와 `expect(...).toBe(false)` 가 혼용된다 (예: `id unique` 테스트는 throw, sanitized id unique 는 throw, method/scopeType 은 throw, 반면 `operation ids are unique` 테스트는 `expect(seen.has(id)).toBe(false)`).
  - 위치: metadata.spec.ts 여러 테스트
  - 상세: 일관성 없는 단언 패턴. `throw new Error` 는 첫 번째 위반에서 멈추고, `expect().toBe` 는 Jest 에러 메시지가 다소 불명확할 수 있다. 동일 목적의 검증 패턴을 통일하는 것이 가독성에 유리하다.
  - 제안: 전체를 throw-early 패턴 또는 violations 배열 수집 후 일괄 throw 패턴으로 통일.

---

### catalog .md 파일 (benefit.md, board.md, cpik.md, member.md, order.md, product.md, shop.md)

- **[INFO]** 7개 섹션 파일의 서두 단락이 동일한 문장 템플릿으로 변경되었다. 내용 일관성은 우수하나 순수 문서 레이어이므로 코드 유지보수 관점의 영향은 없다.

- **[INFO]** `_overview.md` 에서 `scope` 컬럼 설명 `read\|write` 의 백슬래시 이스케이프가 마크다운 렌더링 환경에 따라 `read|write` 또는 `read\|write` 로 보일 수 있다. 파이프 문자를 인라인 코드로 감싸는 방식 `` `read`/`write` `` 가 더 명확하다.

---

## 요약

이번 변경은 161개 REST 오퍼레이션을 7개 섹션 파일로 분산한 정적 데이터 레이어와, 해당 데이터를 검증하는 테스트, 그리고 카탈로그 마크다운 갱신으로 구성된다. 전체적으로 cafe24 패턴을 명확하게 미러링하여 구조적 일관성이 높으며, 각 파일의 책임이 단일하게 유지된다. 주요 유지보수성 우려는 (1) `types.ts` 주석의 "Three kinds" 오기, (2) `constraint-validator.ts` 및 `Object.entries` 캐스팅 패턴이 cafe24 코드와 verbatim 중복되어 있어 장기적으로 공통 추출이 필요한 점, (3) `cpik.ts` 내 `timestamp` description 의 미묘한 표현 불일치로 요약된다. 이 세 항목 모두 INFO 수준이며, 기능 동작이나 즉각적 유지보수 위험은 없다. 테스트의 단언 패턴 혼용(throw vs expect) 은 향후 테스트 신규 추가 시 일관성을 위해 통일을 권고한다.

## 위험도

LOW
