# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `toValidate()` 지역 배열이 모듈 최상위 `export const` 로 승격되어, 검증 스킵 판정에 쓰이는 배열이 함수 호출마다
  재생성되던 임시 값에서 **프로세스 생애 주기 동안 공유되는 단일 배열 참조**로 바뀌었다. 타입은 `readonly Function[]` 이지만
  이는 컴파일타임 제약일 뿐 런타임 불변성을 강제하지 않는다 — 이 배열을 import 하는 어떤 코드가 타입 단언(`as Function[]`)으로
  `.push()`/`.splice()` 하면 `CustomValidationPipe.toValidate()` 의 전역 검증-스킵 목록이 **영구적으로** 오염되어 이후 모든 요청의
  검증 동작에 영향을 준다(개선 전에는 호출마다 새 배열이 만들어져 이런 변형이 다음 호출에 흘러가지 않았다). 이번 diff 안에서는
  가드(`request-body-advertised-guard.ts`)가 `.includes()` 로만 읽으므로 즉시 발현하는 결함은 아니지만, "새 전역 변수 도입" 이
  보안/검증 경계를 지배하는 자리에 생겼다는 점에서 부작용 관점의 리스크로 본다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:15` (`export const UNVALIDATED_METATYPES`), 소비: `codebase/backend/src/common/pipes/validation.pipe.ts:90` (`toValidate`)
  - 제안: `export const UNVALIDATED_METATYPES = Object.freeze([...])` 로 런타임에서도 변경을 막아, "가드가 파이프와 같은 축을 공유한다" 는 설계 의도(JSDoc)가 실수/의도적 변형으로 깨지지 않게 한다.

- **[INFO]** 인터페이스 확장 — `validation.pipe.ts` 에 `UNVALIDATED_METATYPES`, `swagger-probe.ts` 에 `bodyArgIndexes` 가 새 공개
  export 로 추가됐다. 둘 다 순수 추가(additive)라 기존 호출자를 깨지 않으며, 실제 참조처를 확인한 결과 `UNVALIDATED_METATYPES` 는
  파이프 자신과 신규 가드에서만, `bodyArgIndexes`/변경된 `bodyParamDesignType` 은 기존 3개 캐너리(`triggers-rotate-bot-token-body.spec.ts`
  · `hooks-webhook-body.spec.ts` · `executions-continue-body.spec.ts`)에서 소비되는데, `bodyParamDesignType` 은 여전히
  `bodyArgs.length > 1` 이면 던지므로(변경 없음) 새로 추가된 정렬(`.sort((a, b) => a - b)`)은 그 경로에 영향을 주지 않는다 — 동작
  변경은 실질적으로 없다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:145`(`bodyParamDesignType`), `:174`(`bodyArgIndexes` 신설)
  - 제안: 조치 불요, 정보 공유 목적.

- **[INFO]** 신규 테스트(`request-body-advertised.spec.ts`)는 `beforeAll` 에서 `loadControllers(collectTsFiles(SCAN_ROOT))` 로
  `src/modules` 하위 컨트롤러 파일 전체를 동적 로드한다. 이 자체는 형제 가드 `forbidden-response-codes-guard.ts` 가 이미 쓰던
  헬퍼를 재사용한 것이라 이번 diff 가 새로 도입한 부작용은 아니지만, 컨트롤러 모듈에 top-level side effect(예: 환경변수 읽기 ·
  싱글턴 초기화)가 있다면 이 테스트 실행 시점에 그것이 함께 트리거된다는 점은 계속 유효한 전제다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts` `beforeAll` 블록
  - 제안: 조치 불요(기존 패턴 재사용), 참고용.

- **[INFO]** 나머지 변경(`CHANGELOG.md`, `plan/in-progress/request-body-guard.md`, `plan/in-progress/spec-draft-swagger-request-body.md`,
  `spec/conventions/swagger.md`)은 문서·계획 산출물로 런타임 부작용이 없다. `request-body-advertised-guard.ts` 가 swagger 패키지의
  비공개 메타데이터 키 문자열(`swagger/apiParameters` 등)을 하드코딩한 것은 외부 패키지 업그레이드에 취약할 수 있으나, JSDoc 에
  이미 "키가 바뀌면 조용히 통과하지 않는다" 는 설계 의도가 명시돼 있고 형제 가드와 동일한 기존 패턴이라 신규 리스크가 아니다.

## 요약

이번 변경은 대부분 순수 추가(신규 가드·테스트·문서)이며, 기존 함수 시그니처는 보존되고 동작도 검증 결과 동일하다(정렬 추가는 관측
가능한 차이를 만들지 않음). 유일하게 부작용 관점에서 주목할 점은 `toValidate()` 안에서 매 호출 재생성되던 지역 배열이 모듈 전역
`export const` 로 승격된 것 — 타입 수준 `readonly` 만으로는 런타임 변형을 막지 못하므로, 이 배열이 곧 "검증을 건너뛰는 타입 목록"
이라는 보안/계약 경계를 지배한다는 점에서 `Object.freeze` 부재를 WARNING 으로 남긴다. 그 외 파일시스템·환경변수·네트워크·이벤트
콜백 관련 부작용은 발견되지 않았고, 저장소 트리에 대한 뮤테이션 없이(Read/Bash grep 만 사용) 리뷰를 완료했다(`git status --short`
확인 불요 — 쓰기 작업 없음).

## 위험도

LOW
