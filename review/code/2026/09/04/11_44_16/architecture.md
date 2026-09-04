# 아키텍처 리뷰 — Swagger DTO nullable 계약 정합화 + 재발방지 가드

## 발견사항

- **[INFO]** `swagger-dto-contract-guard.ts` 가 `srcRoot` 를 함수 인자로 받는 설계는 형제
  가드(`nullable-type-lie-cast-guard.ts`)의 "모듈 상수 `export const SRC_ROOT`" 패턴보다
  결합도가 낮다 — 다만 소비 spec 쪽에서 `SRC_ROOT` 재계산이 다시 생겨 일관성이 흔들린다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:113-116`
    (`findSwaggerContractMismatches(files: string[], srcRoot: string)`) vs
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:21`
    (`export const SRC_ROOT = path.resolve(...)`)
  - 상세: 이전 라운드 리뷰(`review/code/2026/09/04/11_02_30/architecture.md`)는 이 자리를
    "`SRC_ROOT` 상수 중복" INFO 로 기록했는데, 실제로는 단순 중복이 아니라 **두 가드의 API
    설계가 다르다.** `nullable-type-lie-cast-guard.ts` 는 `SRC_ROOT` 를 모듈 스코프 상수로
    굳혀 export 하고 소비처(`nullable-type-lie-cast.spec.ts:39`)가 그것을 그대로 import 한다
    — 실제 소스 트리에 고정 결합된다. 반면 `swagger-dto-contract-guard.ts` 는 `srcRoot` 를
    **인자로 주입받는다** — 그 덕분에 `swagger-dto-contract.spec.ts:47-51` 의 `judge()` 헬퍼가
    `path.dirname(file)`(임시 픽스처 디렉터리)를 `srcRoot` 로 넘겨 실제 `src` 트리 밖에서도
    가드를 단위 테스트할 수 있다 — DIP(호출자가 컨텍스트를 주입) 를 따른 설계가 오히려 더
    나은 테스트 격리를 가능케 한 사례다. 다만 `swagger-dto-contract.spec.ts:43`
    (`const SRC_ROOT = path.resolve(__dirname, '..', '..')`) 은 이 유연성을 쓰지 않고 별도로
    같은 값을 다시 계산해, 두 가드 사이에 "상수 export + import" 와 "매번 재계산" 두 관례가
    공존하게 됐다.
  - 제안: 코드 변경은 불요(둘 다 정상 동작). 다음에 세 번째 가드를 추가할 때 어느 패턴을
    표준으로 삼을지 — "가드가 소스 트리 경로를 몰라야 한다"(인자 주입, 테스트 친화적)와
    "고정 상수 export"(호출부 단순) 중 하나로 — 저장소 관례를 명시하면 이런 흔들림이
    줄어든다.

- **[INFO]** `findSwaggerContractMismatches` 안에서 두 축(presence/null)의 판정 로직이
  파일 순회 + AST 방문 클로저 내부에 인라인돼 있어, 축이 하나 늘면(예: `type` 불일치) 이
  함수 자체를 다시 열어야 한다 — 개방-폐쇄 원칙 관점의 확장 지점이 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:144-168`
    (`if (effectiveRequired === tsOptional) { … }` / `if (nullable !== tsNull && …) { … }`)
  - 상세: `callDecorators`/`readBooleanOption`/`hasTopLevelNull` 은 이미 잘 분리된 순수
    파싱 헬퍼인 반면, "추출된 속성들을 보고 mismatch 를 만드는" 마지막 단계는 두 개의
    `if` 블록으로 `visit` 클로저 안에 직접 남아 있다. `ContractMismatch.axis` 도
    `'presence' | 'null'` 로 닫힌 유니온이라, 세 번째 축이 생기면 이 함수·타입·`axes()` 테스트
    헬퍼(`swagger-dto-contract.spec.ts:54-57`)를 전부 손대야 한다. 지금은 축이 2개뿐이고
    저장소에 3번째 축 요구가 없어 즉시 문제는 아니다(YAGNI).
  - 제안: 급하지 않음. 세 번째 축이 실제로 필요해지는 시점에
    `judgePresence(effectiveRequired, tsOptional, field): ContractMismatch | undefined` /
    `judgeNull(nullable, tsNull, field, hasTransform): ContractMismatch | undefined` 형태의
    순수 함수로 분리하면 `visit` 클로저는 "추출 후 위임"만 담당하게 되어 SRP 가 명확해진다.

- **[INFO]** 신규 캐너리가 저장소에 이미 있는 "생성된 Swagger 문서를 직접 조회" 인프라
  (`shared/testing/swagger-probe.ts`)를 재사용하지 않고, `@nestjs/swagger` 의 더 안쪽
  Reflect 메타데이터 키를 직접 읽는 별도 경로를 새로 만들었다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:256-276`
    (`Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, Probe.prototype, key)`) vs
    `codebase/backend/src/shared/testing/swagger-probe.ts:46-57`
    (`buildSwaggerDocument` → `SwaggerModule.createDocument`)
  - 상세: `swagger-probe.ts` 자신의 docstring 이 "네 스펙이 같은 보일러플레이트(Swagger 문서
    생성 후 스키마 조회)를 반복하고 있었다" 는 이유로 4번째 반복 시점에 추출된 공유
    헬퍼라고 밝히고 있다. 이번 캐너리(W1 조치, `swagger-dto-contract.spec.ts:241-276`)는
    "생성된 Swagger 산출물이 가정과 같은지" 를 확인한다는 점에서 목적이 같은 5번째
    사례이지만, `buildSwaggerDocument`+`schemaOf`/`propertyOf` 를 쓰지 않고 `DECORATORS`
    export 를 통해 `Reflect.getMetadata` 를 직접 호출하는 별도 방식을 택했다. 이것 자체가
    틀린 선택은 아니다 — `DECORATORS.API_MODEL_PROPERTIES` 는 NestJS 자신의
    `PartialType`/`IntersectionType`/`DeepPartialType` 헬퍼도 의존하는, `@nestjs/swagger`
    가 공개 export 하는 상대적으로 안정적인 앵커이고(`node_modules/@nestjs/swagger/dist/
    type-helpers/*.js` 확인), Nest 애플리케이션 부트스트랩 없이 가벼워 캐너리 용도로는
    합리적이다. 다만 "Swagger 산출물을 검증하는 테스트 보일러플레이트" 라는 같은 문제를
    이 저장소가 이제 두 갈래(`swagger-probe.ts` 계열 vs 이번 `Reflect.getMetadata` 직접
    호출)로 풀고 있다는 점은 다음에 유사한 캐너리가 또 필요해질 때 어느 쪽을 따라야 할지
    불분명하게 만든다.
  - 제안: 코드 변경은 불요 — 현재 선택은 근거가 있다. 다음에 "Swagger 산출물 확인" 류
    테스트가 또 필요해지면, `swagger-probe.ts` 의 docstring 이 세운 "4번째 반복이면 추출"
    선례를 참고해 두 경로 중 하나로 통일할지 판단할 것.

## 확인된 항목 (문제 없음)

- **레이어 책임**: `background-run-response.dto.ts`/`create-assistant-session.dto.ts` 변경은
  데코레이터·타입 선언에 국한되고 런타임 검증(`class-validator`)·서비스 로직은 그대로다.
  `create-assistant-session.dto.ts:19` 의 타입 확장(`string?` → `string | null`)은 이미 그
  넓은 타입을 전제하던 서비스 레이어(`workflow-assistant-session.service.ts:91`
  `dto.llmConfigId ?? null`)와 일치해 레이어 간 계약이 깨지지 않는다.
- **모듈 경계**: `common/__test-utils__/temp-fixture.ts` 신설은 같은 디렉터리에 이미 있던
  `source-scan.ts`/`workspace-id-fixtures.ts` 선례(repo-guard 전용이 아니라 여러 모듈 spec
  이 공유하는 위치)를 그대로 따른다 — 새 경계 위반이 아니다. `repo-guards/**`
  ↔ `common/__test-utils__/**` 방향으로만 의존하고 역방향 참조는 없다(순환 없음).
- **빌드 경계**: 신규 `swagger-dto-contract-guard.ts` 는 `src/repo-guards/**` 아래 있어
  `tsconfig.build.json` 의 기존 exclude 패턴에 이미 포함된다 — devDependency(`typescript`)
  가 dist 로 새어나가는 문제(이 exclude 규칙이 막으려던 문제)가 재발하지 않는다.
- **디자인 패턴**: `<name>-guard.ts`(순수 판정) + `<name>.spec.ts`(소비) 분리는
  `production-build-devdep-guard.ts`/`masked-reject-callers-guard.ts`/
  `nullable-type-lie-cast-guard.ts` 에 이미 확립된 저장소 관례이고, 이번이 그 패턴의 네 번째
  일관된 적용이다 — 새 가드가 늘어날 때마다 구조가 흔들리지 않는다는 점에서 확장성이 좋다.

## 요약

이번 배치의 아키텍처 표면은 좁고 명확하다 — Swagger 계약 거짓 9곳 수정은 프레젠테이션
레이어(DTO 데코레이터/타입)에만 국한되고 서비스 레이어는 이미 그 계약을 전제로 짜여 있어
레이어 경계가 깨지지 않는다. 신규 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`)는 저장소가
이미 세 차례 반복해 온 "순수 판정 로직 + 소비 spec" 패턴을 그대로 따르고, `srcRoot` 를
인자로 주입받는 설계는 형제 가드보다 오히려 테스트 격리에 유리하다(픽스처 tmpdir 을
그대로 `srcRoot` 로 넘길 수 있음). 직전 라운드가 지적한 유일한 WARNING(`@nestjs/swagger`
비공개 별칭 구현에 canary 없이 결합)은 이번 상태에서 `swagger-dto-contract.spec.ts:256-276`
의 Reflect 메타데이터 캐너리로 해소되어 있음을 직접 파일을 열어 확인했다. 남은 관찰은 전부
INFO 수준이다 — 두 형제 가드 사이의 `SRC_ROOT` 관례 불일치(상수 export vs 인자 주입),
판정 로직이 순회 클로저 안에 남아 있어 축 확장 시 재작업이 필요한 점, 그리고 이번 캐너리가
저장소에 이미 있는 `swagger-probe.ts` 인프라를 재사용하지 않고 별도 경로를 새로 연 점이다.
순환 의존성, SOLID 위반, 레이어 침범, 모듈 경계 훼손은 발견되지 않았다.

## 위험도

LOW
