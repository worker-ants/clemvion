# 아키텍처(Architecture) 리뷰 — request-body-guard

## 개요

이번 변경의 아키텍처적 실질은 세 가지다.

1. `codebase/backend/src/common/pipes/validation.pipe.ts` — `toValidate()` 내부 지역 배열을 모듈 top-level `export const UNVALIDATED_METATYPES`(freeze)로 승격해, 파이프의 "검증 스킵 축"과 신설 가드의 "위반 판정 축"을 하나의 상수로 공유시켰다.
2. `codebase/backend/src/repo-guards/__tests__/request-body-advertised{-guard,}.ts` — 형제 가드 `forbidden-response-codes-guard.ts` 와 동일한 구조(순수 reflection 함수 + `checked`/`unschematized` 플로어 + `scan*` 오케스트레이터)를 따르는 신규 저장소 가드.
3. `codebase/backend/src/shared/testing/swagger-probe.ts` — `bodyParamDesignType` 내부 로직에서 `bodyArgIndexes` 를 추출·export 해 가드와 캐너리 헬퍼가 "본문 자리를 찾는" 로직을 공유하게 했다.

이전 라운드(`review/code/2026/09/26/19_32_47`)가 이미 CRITICAL 0 · WARNING 2건을 내고 `8bc7e8f19` 로 조치(freeze 적용, `Number`/`Boolean`/`Array` 대조군 추가, 정렬 1차 키 대조군, `bodyArgIndexes` 오름차순)했음을 소스로 직접 대조해 확인했다 — `validation.pipe.ts:18`(`Object.freeze`), `request-body-advertised.spec.ts` 의 `numberBody`/`booleanBody`/`arrayBody`(124~134행), `AlphaBodyFixtureController`(150~154행). 아래는 그 위에서 아키텍처 관점으로만 본 추가 관찰이다.

## 발견사항

- **[INFO]** Swagger 내부 메타데이터 키 상수(`SWAGGER_EXCLUDE_ENDPOINT`/`SWAGGER_EXCLUDE_CONTROLLER`)가 형제 가드와 문자 그대로 중복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:17-18` vs `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:27-28`
  - 상세: `isExcluded()` 함수 본체(값 읽기 + `!== undefined` 두 줄)까지 두 파일에서 동일하다. 헤더 주석이 "형제 가드와 같은 사정"이라고 명시해 의도적 중복(가드별 독립 안전망 — 프로젝트가 이미 채택한 패턴)임을 밝히고 있고, 저장소에는 이 정확한 상수 쌍을 쓰는 파일이 이 둘뿐(`grep` 로 확인, `http-status-advertised-guard.ts` 는 이 키를 쓰지 않음)이라 아직 2번째 발생이다. 다른 리뷰어(maintainability)가 이미 "3번째 소비처가 생기면 추출"로 처분했고 아키텍처 관점에서도 그 문턱 판단에 동의한다 — 지금 추상화 모듈을 뽑으면 두 인스턴스만으로 인터페이스를 확정해야 해 오히려 과도한 추상화가 될 위험이 있다.
  - 제안: 조치 불요. 3번째 가드가 같은 키 쌍을 요구하면 공유 상수 모듈로 추출.

- **[INFO]** 프로덕션 파이프 모듈이 테스트 전용 가드의 소비를 전제로 상수를 export 한다 — 방향은 단일하고 순환은 없음
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:10-24`(선언), 소비: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:38-47`(`isUnschematized`)
  - 상세: `common/pipes` → `repo-guards/__tests__` 방향의 의존은 없다(파이프 쪽 import 목록에 `repo-guards`/`shared/testing` 참조가 전혀 없음을 직접 확인). 가드 → 파이프 방향의 단방향 의존만 있어 순환 의존은 발생하지 않는다. "파이프가 건너뛰는 타입 집합 = 가드가 요구하는 타입 집합"이라는 불변식을 물리적으로 하나의 배열로 강제하는 것은 두 목록이 갈리는 오류 클래스를 원천 차단하는 합리적인 단일 진실 설계이며, JSDoc(`validation.pipe.ts:11-15`)이 그 계약("이 상수를 그대로 쓴다")을 명시해 다음 사람이 실수로 값을 복제하는 것을 막는다. 다만 이 설계는 프로덕션 모듈의 공개 표면(export 목록)이 테스트/가드 소비자의 필요에 의해 결정된다는 점에서, 향후 이 상수의 타입(예: `Function[]` → `Set<Function>`)을 바꾸면 가드 쪽 캐스팅(`as readonly unknown[]`)도 동반 수정해야 하는 결합이 생긴다는 점은 인지하고 있어야 한다.
  - 제안: 조치 불요 — 트레이드오프가 문서화돼 있고 뮤턴트 G7 로 결합이 실제로 지켜지는지 검증됨(plan 표 참조).

- **[INFO]** `shared/testing/swagger-probe.ts` 가 "OpenAPI 문서 스키마 조회"(`buildSwaggerDocument`/`schemaOf`/`propertyOf`)와 "라우트 인자 메타데이터 reflection"(`bodyParamDesignType`/`bodyArgIndexes`)이라는 두 개의 인접하지만 구분되는 관심사를 한 파일에 계속 누적하고 있다
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` 전체(48~132행 vs 145~181행)
  - 상세: 둘 다 "swagger 캐너리 프로브"라는 상위 응집 아래 있어 지금 시점에 분리를 요구할 정도는 아니다 — 다만 `bodyArgIndexes` 는 OpenAPI 문서(`OpenAPIObject`)가 아니라 Nest 라우트 인자 메타데이터(`ROUTE_ARGS_METADATA`)만 다뤄, 파일 상단 두 함수군과는 입력 자료구조가 다르다. 이번 PR 이 추가한 것은 기존에 이미 섞여 있던 `bodyParamDesignType` 계열에 형제 함수 하나를 더한 것뿐이라 새로 만든 문제는 아니다.
  - 제안: 조치 불요. 이 파일이 더 커지면(예: 3번째 관심사 축 추가) `swagger-probe/document.ts` + `swagger-probe/route-args.ts` 분리를 고려할 만하다.

- **[INFO]** 판정 축으로 AST 대신 reflection(`design:paramtypes`)을 택한 것은 적절한 추상화 레벨 선택이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:38-47`, Rationale `plan/in-progress/spec-draft-swagger-request-body.md`(§3, 게이트 57-60행)
  - 상세: `interface`/타입 별칭 참조가 런타임에 `Object` 로 붕괴한다는 TypeScript 컴파일 산출물의 실제 동작을 판정 축으로 삼아, 소스 문법(AST)만 봐서는 구별 불가능한 클래스-vs-비클래스 구분을 정확히 잡아낸다. 파이프가 실제로 소비하는 값과 가드가 검사하는 값이 같은 표현이라, "문서가 실제와 맞는가"를 검사하는 가드의 목적에 정확히 부합하는 추상화 레벨이다.
  - 제안: 없음(모범 사례로 기록).

## 순환 의존성 · 모듈 경계

`request-body-advertised-guard.ts` → `validation.pipe.ts`(값), `swagger-probe.ts`(함수), `forbidden-response-codes-guard.ts`(타입 `RouteHandler`)로만 뻗어 나가고, 역방향 참조는 어디에도 없다(`common/pipes`, `shared/testing` 양쪽 다 `repo-guards` 를 모른다). `repo-guards/__tests__` 는 "저장소 전체에 대한 정적 적합성 검사(fitness function)"라는 하나의 레이어로 일관되게 위치하며, 이번 신규 파일은 그 경계 안에서 형제 가드와 동일한 형태(구조·명명·오류 전략)를 따른다 — 모듈 경계 위반이나 레이어 책임 혼선은 발견하지 못했다.

## 요약

이번 diff 는 런타임 요청 처리 로직을 바꾸지 않는 순수 리팩터(상수 추출)와, 저장소 전체에 대한 정적 적합성 검사를 추가하는 신규 가드로 구성된다. 새 가드는 기존 형제 가드(`forbidden-response-codes-guard.ts`)와 동일한 구조·명명·오류 전략을 재사용해 아키텍처 일관성이 높고, 판정 축을 AST 가 아닌 reflection 으로 잡은 것은 이 문제 도메인에 정확히 맞는 추상화 레벨이다. `common/pipes` → `repo-guards`/`shared/testing` 방향의 순환 의존은 없으며, 레이어(프로덕션 검증 로직 vs 저장소 정적 가드 vs 테스트 인프라) 책임도 명확히 분리돼 있다. 이전 라운드에서 지적된 WARNING(전역 상수 불변성·뮤테이션 커버리지 갭)은 `Object.freeze` 적용과 `Number`/`Boolean`/`Array` 대조군 추가로 소스 대조 결과 실제로 해소돼 있음을 확인했다. 남은 것은 형제 가드와의 상수/함수 중복(2번째 발생, 프로젝트가 이미 채택한 "3번째부터 추출" 문턱 미달)과 `swagger-probe.ts` 의 두 관심사 공존 정도이며, 둘 다 새로운 구조적 결함이 아니라 향후 확장 시 재검토할 만한 INFO 급 관찰이다.

## 위험도

NONE
