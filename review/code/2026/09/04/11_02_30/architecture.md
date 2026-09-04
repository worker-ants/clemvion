# 아키텍처 리뷰 — Swagger DTO nullable 계약 정합화 배치

## 발견사항

- **[WARNING]** `swagger-dto-contract-guard.ts` 의 `effectiveRequired` 판정이 `@nestjs/swagger` 의
  **비공개 내부 구현**(`ApiPropertyOptional` = `ApiProperty({required:false})` 별칭)에 하드 커플링되어
  있는데, 그 사실을 지키는 canary/버전 고정이 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:135-136`
    (`const effectiveRequired = declaredRequired ?? api.name === 'ApiProperty';`)
  - 상세: 이 판정의 근거는 파일 헤더 docstring 이 인용하는
    `node_modules/@nestjs/swagger/.../api-property.decorator.js:52` — 즉 **타입 선언이 아니라
    실제 빌드 산출물을 열어 확인한 내부 구현**이다. `codebase/backend/package.json` 의
    `"@nestjs/swagger": "^11.4.5"` 는 caret 범위라 minor/patch 업그레이드마다 이 별칭 구현이
    바뀔 수 있다. 만약 라이브러리가 그 별칭 방식을 바꾸면(예: `required` 를 다른 메타데이터 키로
    옮기거나 조건부로만 세팅) 이 가드의 `effectiveRequired` 계산이 조용히 틀린 값을 내고,
    presence 축 오탐/누락이 CI 에서 원인 불명으로 나타난다 — 정작 그 라이브러리 버전이 바뀌었다는
    신호는 어디에도 없다. 리뷰 대상 spec(`swagger-dto-contract.spec.ts`)에는 이 별칭 자체를
    검증하는 테스트(`@nestjs/swagger` 데코레이터를 실제로 호출해 Reflect 메타데이터를 읽는
    canary)가 없다 — 있는 것은 가드가 "그렇다고 가정한 값" 을 다시 확인하는 테스트뿐이다.
  - 제안: `@nestjs/swagger` 버전을 캐럿에서 고정(pin)하거나, `ApiPropertyOptional()` 을 실제로
    호출해 `required: false` 메타데이터가 나오는지 확인하는 최소 canary 테스트를 추가해
    라이브러리 업그레이드가 이 가정을 조용히 깨는 것을 CI 에서 잡히게 한다.

- **[INFO]** `SRC_ROOT` 상수 정의가 형제 가드 사이에서 다시 중복됐다 — 바로 이 PR 이 다른 자리
  (`temp-fixture.ts`)에서 같은 종류의 중복을 없앤 직후다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:40`
    (`const SRC_ROOT = path.resolve(__dirname, '..', '..');`) — 기존
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:21` 과 동일한 식.
  - 상세: `temp-fixture.ts` 자신의 docstring 이 "사본 5개를 없앤 직후에 새 사본을 만들지 않기
    위해서" 로 추출 이유를 설명하는데, 같은 PR 에서 `SRC_ROOT` 계산식은 그대로 두 번째 사본이
    생겼다. 지금은 한 줄짜리 상수라 실질 위험은 낮지만(두 값이 `repo-guards/__tests__/*` 에서
    같은 상대 깊이라 항상 같은 결과), 세 번째 가드가 이 계산을 또 필요로 하면 앞서 채택한
    "두 번째가 생기면 참는다·세 번째가 생기면 추출한다" 원칙이 이번엔 적용 안 된 채 지나간다.
  - 제안: 지금 당장 리팩터링을 요구할 정도는 아니나, 다음에 `SRC_ROOT` 를 쓰는 세 번째 가드가
    생기면 `common/__test-utils__/source-scan.ts` (또는 신설 모듈)로 옮겨 단일 출처화한다.

- **[INFO]** `@Transform` 예외가 순수 판정 함수 안에 문자열 리터럴 비교로 하드코딩돼 있어,
  향후 다른 "wire 값과 인스턴스 값이 다른" 데코레이터(예: 커스텀 `@Coerce` 류)가 추가되면
  같은 자리에 `||` 를 계속 덧붙이는 형태로 커질 소지가 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:152-155`
    (`!decorators.some((d) => d.name === 'Transform')`)
  - 상세: 지금은 예외가 정확히 하나(`Transform`)이고 docstring 이 "허용목록이 아니라 원리" 로
    근거를 명시해 두어 즉각적인 문제는 아니다. 다만 `API_DECORATORS` 는 `Set` 으로 명명돼 확장
    포인트가 드러나 있는 반면, 이 예외 목록은 이름 없는 단일 조건식이라 같은 확장성 수준을
    갖추지 못했다.
  - 제안: 예외 사유가 둘 이상으로 늘어나는 시점에 `TYPE_TRANSFORMING_DECORATORS` 같은 이름 있는
    집합으로 승격한다. 현재 상태에서 즉시 바꿀 필요는 없다(YAGNI).

## 요약

이번 배치는 두 축을 함께 다룬다 — (1) 저장소 가드들이 공유하는 tmpdir 픽스처 헬퍼를
`common/__test-utils__/temp-fixture.ts` 로 추출해 중복을 제거했고, (2) Swagger `@ApiProperty`/
`@ApiPropertyOptional` 선언과 TS 타입의 nullable/presence 불일치를 잡는 신규 AST 기반 가드
(`swagger-dto-contract-guard.ts` + `swagger-dto-contract.spec.ts`)를 추가하며 실제 계약 위반
9곳(`background-run-response.dto.ts` 8곳, `create-assistant-session.dto.ts` `llmConfigId` 1곳)을
같은 PR 에서 고쳤다. 순수 판정 로직과 소비 spec 을 분리하는 규약(`*-guard.ts` + `*.spec.ts`)을
저장소의 기존 형제 가드(`production-build-devdep-guard.ts`, `masked-reject-callers-guard.ts`,
`nullable-type-lie-cast-guard.ts`)와 일관되게 따르고 있고, 정규식 대신 `typescript` 정본 파서를
쓰기로 한 결정도 문서화된 세 가지 정규식 실패 사례로 뒷받침돼 근거가 충실하다. DTO 변경은
데코레이터/타입 선언에만 국한돼 있고, `create-assistant-session.dto.ts` 의 타입 확장은 서비스
레이어(`workflow-assistant-session.service.ts:91` `dto.llmConfigId ?? null`)가 이미 그 넓은 타입을
전제로 짜여 있었으므로 레이어 간 계약이 깨지지 않는다. 순환 의존성이나 레이어 책임 위반은
발견되지 않았고, 모듈 경계(`repo-guards/__tests__/*-guard.ts` ↔ `*.spec.ts` ↔
`common/__test-utils__/*`)도 명확하다. 발견된 이슈는 전부 부차적이다 — 가장 무거운 것은 신규
가드의 핵심 판정이 서드파티 라이브러리의 비공개 구현 세부에 canary 없이 결합돼 있다는 점(WARNING)
이고, 나머지는 사소한 상수 중복과 확장성 여지에 대한 INFO 수준 관찰이다.

## 위험도

LOW
