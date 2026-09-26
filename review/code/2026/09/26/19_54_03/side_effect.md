# 부작용(Side Effect) 리뷰 — request-body-guard

## 조사 방법

저장소 파일은 `Read`/`Bash grep` 으로만 조사했다(뮤테이션 없음). 리뷰 종료 시점 `git status --short` 결과는
`?? review/code/2026/09/26/19_54_03/`(이 리뷰 세션의 출력 디렉터리) 뿐이며, 본 세션이 저장소 트리에 쓴 파일은 없다.

이 diff 는 (1) 신규 가드 `request-body-advertised` 코드/테스트, (2) `CustomValidationPipe` 의 비검증 목록을 지역 배열 →
export 상수로 승격한 리팩터, (3) `swagger-probe.ts` 헬퍼 분리, (4) spec/plan/CHANGELOG 문서, (5) **직전 라운드
(`19_32_47`)의 리뷰 산출물 자체(SUMMARY/RESOLUTION/각 reviewer .md/meta.json 등)를 커밋에 포함**하는 구성이다.
아래는 (1)~(3) 실제 코드에 집중했고, (5)는 문서 성격이라 side-effect 관점에서 실질 위험이 없음을 확인만 했다.

## 발견사항

- **[INFO]** 프로덕션 파이프 모듈에 새 전역(module-level) export `UNVALIDATED_METATYPES` 도입 — 이미 `Object.freeze` 로 방어됨
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:18` (선언), `:93` (`toValidate` 소비)
  - 상세: `toValidate()` 내부 지역 배열이었던 `[String, Boolean, Number, Array, Object]` 가 모듈 top-level `export const`
    로 승격됐다(관점 2 "전역 변수 도입"에 해당). 직전 리뷰 라운드(`review/code/2026/09/26/19_32_47/SUMMARY.md` WARNING #1)가
    "`readonly` 는 타입일 뿐 런타임 가변성을 막지 못한다"는 같은 우려를 제기했고, 후속 커밋 `8bc7e8f19` 에서 `Object.freeze([...])`
    로 감쌌다. 직접 소스를 열어 확인한 결과 freeze 가 실제로 적용돼 있고(`validation.pipe.ts:18`), 소비처는
    `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:7,45` 와 `toValidate` 단 둘뿐이며 둘 다
    read-only(`.includes()`)다. `grep -rn "UNVALIDATED_METATYPES"` 전수 확인 결과 `.push`/`.splice` 등 변형 호출은 없다.
    `validation.pipe.spec.ts:118-131` 이 `Object.isFrozen(...)` 을 직접 단언하고 뮤턴트(R4, freeze 제거)로 KILLED 확인까지
    됐다(`plan/in-progress/request-body-guard.md` 뮤턴트 표에는 R1~R6 는 없지만 `RESOLUTION.md` 에 기록). 새 전역이지만
    read-only 계약이 코드·테스트 양쪽에서 고정돼 있어 실질 위험은 낮다.
  - 제안: 조치 불요(이미 해결됨). 향후 이 상수를 재-export 하거나 별도 모듈로 옮길 때도 `Object.freeze` 를 유지해야 한다는 점만
    참고.

- **[INFO]** 신규 가드가 라우트 스캔을 위해 `src/modules` 하위 컨트롤러 전체를 `beforeAll` 에서 동적 import — 새 부작용 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts` `beforeAll`(51-62행 부근),
    `loadControllers`/`collectRouteHandlers` (import from `./forbidden-response-codes-guard`)
  - 상세: 이 패턴은 형제 가드 `forbidden-response-codes-guard.ts` 가 이미 쓰던 것을 그대로 재사용한다(신규 도입 아님). 다만
    "모든 컨트롤러 모듈을 로드한다"는 것은 그 모듈들의 최상위(top-level) 코드가 테스트 시점에 실행됨을 의미하므로, 향후 어떤
    컨트롤러 파일이 모듈 로드 시점에 부작용(예: DB 커넥션 생성, 프로세스 레벨 registry 등록)을 갖게 되면 이 가드의 테스트
    실행이 그것을 트리거하는 경로가 된다. 이번 diff 자체가 그런 부작용을 추가하지는 않았다.
  - 제안: 조치 불요 — 기존 패턴 재사용. 참고용 기록.

- **[INFO]** `swagger-probe.ts` 에 새 export 함수 `bodyArgIndexes` 추가 — 순수 함수, 기존 시그니처 보존
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:174-181`(신설), `:145-168`(`bodyParamDesignType` 리팩터)
  - 상세: `bodyParamDesignType(controller, method)` 의 공개 시그니처·던지는 조건(본문 없음/2개 이상/`design:paramtypes`
    없음)·반환값은 리팩터 전후 동일함을 직접 대조로 확인했다(`bodyArgs.length` 기반 분기 로직 불변, 단일 자리일 때
    `types[bodyArgs[0]]` 로 값이 같음 — 2개 이상이면 항상 throw 하므로 정렬 순서 변경은 그 경로에 영향 없음). 신규 함수는
    순수하게 `Reflect.getMetadata` 를 읽기만 하고 어떤 상태도 변경하지 않는다. 기존 호출자(`bodyParamDesignType` 자체,
    `*-body.spec.ts` 캐너리들)는 이 함수를 거치지 않고 기존 공개 API 를 그대로 쓰므로 호출자 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `Reflect.defineMetadata` 를 테스트 안에서 로컬 클래스 프로토타입에 직접 호출 — 격리됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts:210-239`
    (`'설계 타입이 emit 되지 않은 자리도...'` 케이스, `BareRouteController`)
  - 상세: `reflect-metadata` 의 메타데이터 저장소는 대상 객체(`BareRouteController.prototype`/`BareRouteController`)에
    스코프되므로, 이 테스트 안에서만 선언된 로컬 클래스에 메타데이터를 심는 것은 다른 테스트·다른 모듈의 전역 상태를 오염시키지
    않는다. `afterEach`/`afterAll` 로 지우지 않아도 그 클래스 참조가 테스트 밖에서 재사용되지 않는 한 누수가 없다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 산출물(`review/code/2026/09/26/19_32_47/**`, `review/consistency/2026/09/26/{18_59_58,19_09_17}/**`)이
  이번 diff 에 커밋으로 포함됨 — 파일시스템 부작용 아님(정상적인 저장소 규약)
  - 위치: 파일 10~38 (모두 `review/**` 하위)
  - 상세: `CLAUDE.md` 정보 저장 위치 규약상 코드 리뷰·일관성 검토 산출물은 `review/code/**`, `review/consistency/**` 에
    보존한다. 이번 diff 는 그 산출물들을 워크트리에 새로 "생성"한 것이 아니라 이미 세션 중 생성된 것을 커밋에 포함시킨
    것으로, `_prompts/` 를 제외한 리포트 md·`meta.json`·`_retry_state.json` 모두 정적 텍스트/데이터이며 실행 시 부작용을
    일으키는 코드가 아니다.
  - 제안: 조치 불요.

## 요약

프로덕션 런타임 동작을 바꾸는 유일한 diff(`validation.pipe.ts`)는 지역 배열을 동결된(export) 전역 상수로 승격한 순수
리팩터이며, 직전 리뷰 라운드가 지적한 "얼리지 않은 전역 가변 목록" 우려는 이미 `Object.freeze` + 전용 단위테스트 +
뮤턴트(KILLED)로 해소된 상태를 소스에서 직접 확인했다. 신규 가드(`request-body-advertised{-guard,}.ts`)와
`swagger-probe.ts` 의 `bodyArgIndexes` 는 모두 `Reflect.getMetadata` 만 읽는 순수 함수이며 파일시스템·네트워크·환경변수·
이벤트/콜백에 관여하지 않는다. `beforeAll` 의 컨트롤러 전체 동적 로드는 형제 가드에서 이미 쓰던 패턴의 재사용이라 이번
diff 가 새로 도입한 부작용이 아니다. 시그니처 변경(`bodyParamDesignType` 내부 구현 교체)도 외부 계약이 동일함을 직접
대조 확인했다. 전반적으로 side-effect 관점의 신규 위험은 발견되지 않았다.

## 위험도

NONE
