# 유지보수성(Maintainability) 리뷰 — patch-null-validation

## 발견사항

- **[INFO]** `IsDefined` 에 전달하는 옵션 스프레드 순서가 고정 메시지를 조용히 덮어쓸 수 있다
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:23-27`
  - 상세: `IsDefined({ message: '$property must not be null — omit the field to keep the current value', ...validationOptions })` 는 `message` 를 먼저 지정한 뒤 `validationOptions` 를 스프레드한다. 호출자가 `IsOptionalNonNull({ message: '...' })` 처럼 자체 `message` 를 넘기면 이 데코레이터의 존재 의미(누락하면 값이 유지된다는 안내 메시지)가 조용히 사라진다. 현재 모든 호출부(`@IsOptionalNonNull()`, 14개 DTO)는 인자 없이 쓰이므로 지금 당장 문제는 없지만, 우선순위가 문서화돼 있지 않고 테스트도 이 경로를 커버하지 않는다.
  - 제안: 의도적으로 덮어쓰기를 허용할 것이면 JSDoc에 그 사실을 한 줄 추가하고, 항상 고정 메시지를 유지하고 싶다면 `message` 를 스프레드 뒤에 두거나 `validationOptions.message` 를 명시적으로 제거한다.

- **[INFO]** `propertyKey` 를 런타임 검증 없이 `string` 으로 캐스트
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:17-18`
  - 상세: 함수 시그니처는 TS 내장 `PropertyDecorator` 타입(`propertyKey: string | symbol`)을 그대로 쓰고, 내부에서 `propertyKey as string` 으로 무조건 캐스트한다. 같은 디렉터리의 기존 커스텀 validator(`codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts:47-48`)는 `function (object: object, propertyName: string)` 로 시그니처 자체를 `string` 으로 좁혀 캐스트가 필요 없다. class-validator 데코레이터가 symbol 키를 지원하지 않으므로 실질적 위험은 낮지만, 이 파일만 다른 캐스트 스타일을 쓰는 점이 일관성 면에서 사소한 outlier다.
  - 제안: 기존 관례처럼 반환 함수 시그니처를 `(target: object, propertyKey: string) => void` 로 좁혀 캐스트를 없애는 편이 더 일관적이다.

- **[INFO]** e2e `cases` 테이블에서 같은 라우트의 `url` 람다가 필드 수만큼 반복된다
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:110-244` (예: 워크플로 3건 `118-131`, 노드 4건 `132-135`, 알림 규칙 4건 `162-180`, 모델 설정 4건 `216-238`)
  - 상세: `cases` 배열은 `{ label, url: () => string, field }` 객체 33개로, 동일한 라우트에 대해 `url` 람다 리터럴이 필드 개수만큼(최대 4회) 그대로 반복된다. 같은 파일의 자매 격인 단위 테스트(`codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:35-66`)는 `[DtoClass, fields[]]` 테이블 + `flatMap` 으로 라우트당 한 줄만 쓰는 반면, e2e 파일은 같은 구조를 손으로 펼쳐 썼다.
  - 제안: `[{ label, url, fields: [...] }].flatMap(r => r.fields.map(field => ({ ...r, field })))` 형태로 바꾸면 라우트당 1줄로 줄고, 새 필드 추가 시 실수로 `url` 을 다르게 타이핑할 여지도 줄어든다. (기능적으로는 현재 코드도 정확하며 버그는 아니다.)

- **[INFO]** "43필드" 라는 불변식이 소스 오브 트루스 없이 3곳(단위 테스트 assert · 데코레이터/테스트 JSDoc · plan 문서)에 나뉘어 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:82-84` (`expect(CASES).toHaveLength(43)`), 동일 파일 JSDoc `28`행, `plan/in-progress/patch-null-validation.md:80`
  - 상세: `TABLE` 에 새 필드를 추가하면서 이 하드코딩된 `43` 을 갱신하지 않아도 테스트가 즉시 실패하므로 회귀 방지는 되지만, 반대로 `TABLE` 자체에 새 항목을 **빠뜨리는** 실수는 이 assert 로 잡히지 않는다 — 파일 자체 JSDoc(`27-29`행)이 이 한계를 이미 명시하고 있어 새로운 발견은 아니고, 다음 유지보수자를 위해 재확인 차원에서 남긴다.
  - 제안: 조치 불요(이미 문서화된 기지의 한계). 후속으로 NOT NULL 컬럼을 코드에서 열거해 `TABLE` 과 자동 대조하는 정적 가드(같은 `repo-guards/__tests__` 컨벤션)를 고려할 수 있다.

## 요약

이번 변경은 새 데코레이터(`IsOptionalNonNull`) 하나를 만들고 14개 DTO 파일에서 `@IsOptional()` → `@IsOptionalNonNull()` 로 기계적으로 스왑한 뒤, 단위·e2e 테스트로 43필드 전수를 고정한 구성이다. 데코레이터 구현은 20줄 남짓으로 짧고 JSDoc이 의도·대안·회피 사례까지 상세히 설명해 가독성이 좋으며, 기존 `omit-undefined.ts` 의 서술 스타일과 일치한다. DTO 편집은 모든 파일에서 import 위치·데코레이터 순서가 동일하게 유지되어 코드베이스 컨벤션을 그대로 따른다. 단위 테스트는 `[DtoClass, fields[]]` 테이블 + `flatMap` 으로 43케이스를 간결하게 생성하는 반면, e2e 테스트는 같은 구조를 손으로 펼쳐 써 반복이 남아 있고(INFO), 신설 헬퍼의 옵션 스프레드 순서·타입 캐스트 스타일에 사소한 불일치가 있다(모두 INFO, 기능 결함 아님). 함수 길이·중첩·순환 복잡도 측면에서 우려되는 지점은 없다.

## 위험도
LOW
