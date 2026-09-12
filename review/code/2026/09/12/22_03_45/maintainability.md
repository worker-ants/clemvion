# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 매직 넘버 — vacuity floor 임계값이 리터럴로 박혀 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:60`, `:66`
  - 상세: `expect(controllers.length).toBeGreaterThan(30)` 과 `expect(scanUuidParams(...).scanned).toBeGreaterThan(100)` 이 인접 주석으로 의도(실측 35개 컨트롤러·136개 id-형 파라미터에 대한 vacuity floor)를 설명하고 있어 완전한 매직 넘버는 아니지만, 숫자 자체는 이름 없는 리터럴이다. 실측값(35, 136)과 임계값(30, 100)의 관계가 코드만 보고는 바로 드러나지 않는다.
  - 제안: `MIN_EXPECTED_CONTROLLERS` / `MIN_EXPECTED_ID_PARAMS` 같은 이름 상수로 추출하면 "왜 이 숫자인가"가 선언부에서 바로 보인다. 낮은 우선순위 — 현재도 주석이 근거를 밝히고 있어 실질적 위험은 작다.

- **[INFO]** 실측 수치가 다수 파일에 중복 기록되어 drift 위험이 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:70`(`apiParamUuidFlags` 문서, "144건 중 144건"), `:148`(`collectMethodViolations` 내부, "136건이 108 : 28"), `plan/in-progress/trigger-uuid-and-guide-error-codes.md`(같은 수치들의 표)
  - 상세: 같은 PR 안에서 이미 한 번(`135건 107:28` → `136건 108:28`) 이 수치를 정정한 이력이 코드 주석에 그대로 남아 있다(자기 발견·자기 시인). 실측값이 여러 파일에 산문으로 흩어져 있으면, 다음에 컨트롤러가 하나 늘거나 파이프가 하나 더 붙을 때 일부 자리만 갱신되고 나머지는 stale 로 남을 여지가 있다.
  - 제안: 이미 "시점을 문장에 박아 둔다"는 완화책을 적용했으므로 즉각 조치는 불필요하지만, 다음에 이 가드를 만지는 사람은 guard.ts/spec.ts/plan.md 세 자리를 함께 갱신해야 한다는 점을 유념할 필요가 있다(단일 소스가 아님).

- **[INFO]** 파라미터 데코레이터 앞에 5줄짜리 인라인 주석 — 함수 시그니처 가독성 저하
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:287-291` (`@Param('id', ParseUUIDPipe) triggerId: string,` 앞)
  - 상세: 메서드 시그니처의 파라미터 목록 한가운데에 4줄 분량의 배경 설명 주석이 끼어 있어, `rotateBotToken(...)` 전체 시그니처를 한눈에 훑기 어렵게 만든다. 정보 자체는 가치 있다(500 마스킹 배경).
  - 제안: 사소한 스타일 이슈. 메서드 위 JSDoc 이나 별도 설명 블록으로 옮기고 파라미터 목록은 짧게 유지하는 대안도 가능하나, 이 저장소는 "고친 이유"를 그 자리에 남기는 관례가 강해(다른 파일들도 동일 패턴) 현재 형태도 컨벤션에 부합한다.

- **[INFO]** 문자열 리터럴 유니온 타입이 따옴표 스타일을 혼용
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:15` (`export type UuidParamAxis = 'ParseUUIDPipe' | "@ApiParam format:'uuid'";`)
  - 상세: 두 번째 리터럴이 작은따옴표를 포함해 큰따옴표로 감싸야 해 타입 선언 안에서 따옴표 스타일이 섞인다. 불가피한 선택이고 `missing.push("@ApiParam format:'uuid'")` (`:157-158`) 와도 일관되게 사용되고 있어 버그는 아니다.
  - 제안: 조치 불필요 — 참고 사항으로만 기록.

## 요약

이번 diff 는 `rotateBotToken` 의 `ParseUUIDPipe` 누락을 고치는 본 수정, 이를 저장소 전수로 고정하는 AST 기반 가드(`param-uuid-pipe-guard.ts` + `.spec.ts` + fixture), HTTP 왕복 테스트, 그리고 문서/코드 전반의 잘못된 에러 코드 귀속을 바로잡는 수정으로 구성된다. 새로 추가된 가드 로직은 순회(`scanUuidParams`)와 판정(`collectMethodViolations`)을 분리해 단일 책임을 지키고 있고, 함수 길이·중첩 깊이 모두 양호하며, 네이밍(`UuidParamAxis`/`UuidParamViolation`/`isIdShaped` 등)도 목적을 명확히 드러낸다. 예외 처리도 허용목록 대신 구조(`@ApiExcludeEndpoint()`)로 판단해 이 저장소의 기존 관례(정적 가드는 blind pattern, 예외는 구조로)와 일관된다. plan 문서 기록을 보면 이미 5라운드의 `/ai-review` 를 거치며 유지보수성 관련 지적(인덱스드 액세스 타입 → named union, 5단 중첩 함수 분리 등)이 선제적으로 처리되어 있어, 남은 항목은 모두 경미한 스타일 수준(매직 넘버에 이름 부여, 실측 수치의 다중 소스 위험, 파라미터 인라인 주석 길이)이며 기능적·구조적 결함은 발견되지 않았다.

## 위험도

LOW
