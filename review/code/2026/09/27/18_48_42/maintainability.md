# 유지보수성(Maintainability) 리뷰 — patch-null-validation (fresh review, `--impl-done` 이후)

## 사전 확인

`git diff origin/main...HEAD --stat -- codebase/` 로 코드 변경 파일을 전수 대조한 결과, 이전 두 라운드(`review/code/2026/09/27/17_47_49`, `18_13_53`)가 검토한 것과 **동일한 19개 코드 파일**이다. 그 사이 커밋(`634297632`, `27191021c`)은 `optional-non-null.ts` JSDoc 3줄 추가(응답 계약 `response-contract.ts`·병합 짝 `omit-undefined.ts` 상호 참조)와 plan/consistency 문서뿐이며, 동작·구조 변경은 없다(`git show 634297632 -- codebase/` 로 확인). 뮤테이션 없이 `Read`/`git show`/`git diff --stat` 만 사용했으므로 저장소 상태 변경 없음 — `git status --short` 는 이 세션 산출물(`review/code/2026/09/27/18_48_42/`)만 표시.

## 발견사항

- **[INFO]** `IsDefined` 에 전달하는 옵션 스프레드 순서가 고정 메시지를 조용히 덮어쓸 수 있다 (이전 라운드에서도 지적, 변경 없음)
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:26-30`
  - 상세: `IsDefined({ message: '$property must not be null — omit the field to keep the current value', ...validationOptions })` 는 고정 `message` 를 먼저 두고 `validationOptions` 를 뒤에 스프레드한다. 호출자가 `IsOptionalNonNull({ message: '...' })` 처럼 자체 메시지를 넘기면 "생략하면 값이 유지된다"는 안내가 조용히 사라진다. 현재 14개 DTO 전 호출부가 인자 없이 쓰여 실현되지 않지만 우선순위가 문서화돼 있지 않다.
  - 제안: 항상 고정 메시지를 유지하려면 `message` 를 스프레드 뒤에 두거나 `validationOptions.message` 를 명시적으로 제거. 덮어쓰기를 허용할 의도라면 JSDoc에 한 줄 명시.

- **[INFO]** `propertyKey` 를 런타임 검증 없이 `string` 으로 캐스트 — 같은 디렉터리 기존 관례와 스타일 불일치 (이전 라운드에서도 지적, 변경 없음)
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:20-21`
  - 상세: 반환 함수는 TS 내장 `PropertyDecorator` 타입(`propertyKey: string | symbol`)을 그대로 받고 내부에서 `propertyKey as string` 으로 무조건 캐스트한다. 같은 저장소의 커스텀 validator(`codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`)는 반환 함수 시그니처 자체를 `string` 으로 좁혀 캐스트가 불필요하다. class-validator 가 symbol 키를 지원하지 않아 실질 위험은 낮은 스타일 outlier.
  - 제안: 반환 함수 시그니처를 `(target: object, propertyKey: string) => void` 로 좁혀 캐스트 제거.

- **[INFO]** e2e `cases` 테이블에서 같은 라우트의 `url` 람다가 필드 수만큼(최대 4회) 손으로 반복된다 (이전 라운드에서도 지적, 변경 없음)
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:110-244` (예: 워크플로 3건 `118-131`, 알림 규칙 4건 `161-180`, 모델 설정 4건 `219-238`)
  - 상세: 자매 단위 테스트(`codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:35-66`)는 `[DtoClass, fields[]]` 테이블 + `flatMap` 으로 라우트당 한 줄만 쓰는 반면, e2e 파일은 같은 구조를 33개 객체로 펼쳐 썼다. 기능 결함은 아니나 새 필드 추가 시 `url` 오타 여지가 있다.
  - 제안: `[{ label, url, fields: [...] }].flatMap(r => r.fields.map(field => ({ label: r.label, url: r.url, field })))` 형태로 축약.

- **[INFO]** "43필드" 불변식이 단일 소스 오브 트루스 없이 여러 곳(단위 테스트 assert · JSDoc · plan 문서)에 손으로 동기화된다 (이전 라운드에서도 지적, 변경 없음 — developer 자신이 파일 JSDoc 에 한계로 명시)
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:82-84`(`expect(CASES).toHaveLength(43)`), 동일 파일 JSDoc `27-30`행
  - 상세: `TABLE` 에 새 필드를 빠뜨려도 이 assert 로는 잡히지 않는다(개수가 우연히 43 그대로면 통과). 소스(각 DTO 의 데코레이터 사용처)와 테스트(`TABLE`)가 서로 다른 곳에서 같은 사실을 두 번 선언하는 구조.
  - 제안: 조치 불요(문서화된 기지의 한계, PR 스코프 밖). 후속으로 `@IsOptionalNonNull()` 사용처를 AST/리플렉션으로 전수 스캔해 `TABLE` 과 대조하는 정적 가드를 고려할 수 있다.

- **[INFO]** happy-path e2e 테스트에서 "보낸 값"과 "기대값"이 같은 리터럴로 두 번 나열된다 (이전 라운드에서도 지적, 변경 없음)
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:270-282` (`.send({...})` 블록과 바로 아래 `const expected = {...}` 블록)
  - 상세: `provider`·`name`·`defaultModel`·`defaultParams` 네 값이 `send()` 와 `expected` 양쪽에 따로 적혀 있다. 지금은 인접해 바로 대조되지만, 나중에 페이로드 한쪽만 고치면 다른 쪽이 그대로 남아 조용히 어긋날 수 있다.
  - 제안: `const payload = {...}` 로 한 번만 선언해 `.send(payload)`·`toMatchObject(payload)` 양쪽에 재사용.

이 다섯 항목은 모두 이전 두 라운드(1R `review/code/2026/09/27/17_47_49`, 2R `18_13_53`)에서 이미 INFO 로 식별되어 developer 가 "조치 불요"로 기록한 항목과 동일하며, 이번 라운드까지 해당 코드는 전혀 수정되지 않았다(위 사전 확인 참고). 새로 발견된 Critical/Warning 급 유지보수성 결함은 없다.

## 요약

핵심 변경(`IsOptionalNonNull` 데코레이터 신설 + 14개 DTO 파일 `@IsOptional()` → `@IsOptionalNonNull()` 기계적 치환)은 짧고(9줄), 단일 책임(생략 허용·null 거부)을 캡슐화하며, `ValidateIf`+`IsDefined` 합성이라는 class-validator 관용구를 그대로 따라 가독성이 높다. JSDoc은 문제·해법·안 쓸 자리·응답 계약과의 경계까지 설명해 모범적이다. 14개 DTO 편집은 모두 import 1줄 + 데코레이터 1:1 치환뿐으로 무관한 포맷팅·순서 변경이 없어 diff 잡음이 없고, 함수 길이·중첩 깊이·순환 복잡도 우려 지점도 없다. 남는 것은 전부 INFO 등급이며 기능 결함이 아니다 — 옵션 스프레드 순서·타입 캐스트 스타일의 사소한 outlier, e2e 의 손으로 펼친 반복 구조, "43필드" 불변식의 손으로 유지되는 이중 SoT, happy-path e2e 의 페이로드/기대값 리터럴 중복. 이 항목들은 두 라운드 전부터 동일하게 관측돼 왔고 코드가 그 사이 바뀌지 않았으므로 새로운 리스크가 아니다.

## 위험도

LOW
