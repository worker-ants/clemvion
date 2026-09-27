# 유지보수성(Maintainability) 리뷰 — patch-null-validation (2R, fresh review after W1·W2 조치)

## 발견사항

- **[INFO]** 신규 happy-path e2e 테스트에서 "보낸 값"과 "기대값"이 같은 리터럴로 두 번 따로 적혀 있다
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:270-282` (`.send({...})` 블록과 바로 아래 `const expected = {...}` 블록)
  - 상세: W1 조치로 추가된 "모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다" 테스트는 `provider`·`name`·`defaultModel`·`defaultParams` 네 값을 `send()` 호출에 한 번, 곧바로 `const expected`에 동일한 값으로 한 번 — 총 두 곳에 리터럴로 나열한다. 지금은 두 블록이 인접해 있어 바로 대조되지만, 페이로드를 나중에 하나만 고치면(예: `defaultModel` 값 변경) 다른 한쪽은 그대로 남아 "보낸 것"과 "기대한 것"이 조용히 어긋나는 테스트가 될 수 있다. 파일의 자매 검증 로직(`repo-guards/__tests__/patch-null-rejection.spec.ts`의 `constraintsFor`)이나 e2e 상단 `cases` 배열은 단일 정의를 재사용하는 패턴을 쓰는 것과 대비된다.
  - 제안: `const payload = { provider: 'openai', name, defaultModel: 'stub-model-2', defaultParams: { temperature: 0.2 } };` 로 한 번만 선언해 `.send(payload)`와 `toMatchObject(payload)` 양쪽에 재사용하면 두 블록이 구조적으로 어긋날 수 없다.

- **[INFO]** e2e `cases` 테이블에서 같은 라우트의 `url` 람다가 필드 수만큼 반복된다 (이전 라운드 INFO, 이번 라운드에도 유효 — W1 로 추가된 모델 설정 4건에서도 동일 패턴 반복)
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:110-244` (예: 워크플로 3건 118-131, 알림 규칙 4건 161-180, 모델 설정 4건 219-238)
  - 상세: `cases` 배열은 `{ label, url: () => string, field }` 객체 33개로, 동일 라우트에 대해 `url` 람다 리터럴이 필드 개수만큼(최대 4회) 그대로 반복된다. 자매 단위 테스트(`codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:35-66`)는 `[DtoClass, fields[]]` 테이블 + `flatMap` 으로 라우트당 한 줄만 쓰는 반면, e2e 파일은 같은 구조를 손으로 펼쳐 썼다. 기능 결함은 아니다.
  - 제안: `[{ label, url, fields: [...] }].flatMap(r => r.fields.map(field => ({ label: r.label, url: r.url, field })))` 형태로 축약하면 라우트당 1줄로 줄고, 필드 추가 시 `url` 을 잘못 타이핑할 여지도 줄어든다.

- **[INFO]** `IsDefined` 에 전달하는 옵션 스프레드 순서가 고정 메시지를 조용히 덮어쓸 수 있다 (이전 라운드 INFO, 변경 없음)
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:23-27`
  - 상세: `IsDefined({ message: '...', ...validationOptions })` 는 `message` 를 먼저 지정한 뒤 `validationOptions` 를 스프레드한다. 호출자가 `IsOptionalNonNull({ message: '...' })` 처럼 자체 `message` 를 넘기면 이 데코레이터의 존재 의미("생략하면 값이 유지된다")를 담은 안내 메시지가 조용히 사라진다. 현재 14개 DTO 전 호출부가 인자 없이 쓰여 지금 당장 현실화되지는 않지만, 우선순위가 문서화돼 있지 않다.
  - 제안: 의도적으로 덮어쓰기를 허용할 것이면 JSDoc에 한 줄 명시하고, 항상 고정 메시지를 유지하고 싶다면 `message` 를 스프레드 뒤에 두거나 `validationOptions.message` 를 명시적으로 제거한다.

- **[INFO]** `propertyKey` 를 런타임 검증 없이 `string` 으로 캐스트 (이전 라운드 INFO, 변경 없음)
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:17-18`
  - 상세: 반환 함수 시그니처는 TS 내장 `PropertyDecorator` 타입(`propertyKey: string | symbol`)을 그대로 쓰고 내부에서 `propertyKey as string` 으로 무조건 캐스트한다. 같은 저장소의 기존 커스텀 validator(`codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`)는 반환 함수 시그니처 자체를 `string` 으로 좁혀 캐스트가 필요 없다. class-validator 데코레이터가 symbol 키를 지원하지 않아 실질 위험은 낮지만, 이 파일만 다른 캐스트 스타일을 쓰는 사소한 outlier다.
  - 제안: 반환 함수 시그니처를 `(target: object, propertyKey: string) => void` 로 좁혀 캐스트를 없애면 기존 관례와 일관된다.

- **[INFO]** "43필드" 불변식이 단일 소스 오브 트루스 없이 여러 곳(단위 테스트 assert · JSDoc · plan 문서)에 나뉘어 있다 (이전 라운드 INFO, 변경 없음 — developer 자신이 한계로 명시)
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:82-84` (`expect(CASES).toHaveLength(43)`), 동일 파일 JSDoc 28행, `plan/in-progress/patch-null-validation.md` §범위
  - 상세: `TABLE` 에 새 필드를 추가하면서 하드코딩된 `43` 을 갱신하지 않으면 테스트가 즉시 실패해 회귀 방지는 되지만, `TABLE` 자체에 새 항목을 **빠뜨리는** 실수는 이 assert 로 잡히지 않는다. 파일 자체 JSDoc이 이미 이 한계를 명시하고 있어 은폐된 문제는 아니다.
  - 제안: 조치 불요(문서화된 기지의 한계). 후속으로 `@IsOptionalNonNull()` 사용처를 AST/리플렉션으로 전수 스캔해 `TABLE` 과 대조하는 정적 가드를 고려할 수 있다.

## 요약

이번 라운드(2R)는 1R 의 WARNING 2건(모델 설정 happy-path e2e 부재, `endpointPath` 문서 갱신 누락)이 `e5de5226c` 로 조치된 뒤의 재검토다. 두 조치 모두 유지보수성 문제를 새로 만들지 않았다 — `endpointPath` JSDoc/Swagger 추가는 기존 문서화 스타일을 그대로 따랐고, 신규 happy-path e2e 테스트도 파일의 기존 구조(픽스처 재사용, `authed` 헬퍼)를 그대로 따른다. 다만 그 신규 테스트 안에서 "보낸 값"과 "기대값" 리터럴이 한 번 더 중복 선언돼(INFO 신규) 향후 페이로드 수정 시 한쪽만 갱신되는 사소한 drift 여지를 남긴다. 그 외 INFO 4건은 1R 에서 이미 발견돼 트래커/문서로 처리된 것과 동일하며(옵션 스프레드 순서, `propertyKey` 캐스트 스타일, e2e `url` 람다 반복, "43" 불변식의 손으로 유지되는 SoT), 코드 자체(`IsOptionalNonNull` 데코레이터, 14개 DTO 치환)의 가독성·네이밍·함수 길이·중첩 깊이·복잡도·일관성에는 문제가 없다.

## 위험도

LOW
