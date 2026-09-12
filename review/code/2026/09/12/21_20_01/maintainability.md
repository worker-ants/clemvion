# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 세션 타임스탬프(`20_26_58`·`20_53_01`·`20_01_18`)가 프로덕션/테스트 소스 주석의 근거로 직접 박혀 있다
  - 위치:
    - `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:13, 73, 201, 202`
    - `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:34, 47`
    - `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts:8, 78`
    - `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:212`
  - 상세: 예) `param-uuid-pipe-guard.ts:73` — `` * > **이 수치를 한 번 틀렸다** (`20_26_58` documentation WARNING). 처음 적은 127 은 ... ``. `review/code/**` 는 프로젝트 저장 규약상 "코드 리뷰 산출물"이지 `plan/complete/`처럼 영구 보존이 명시된 SoT가 아니다. 세션 폴더가 나중에 정리·이관되면, 이 주석들이 인용하는 "왜 이 값/이 형태를 골랐는가"의 **검증 가능한 근거 링크가 끊긴다** — 텍스트 설명 자체는 남지만 "그 라운드에서 무엇을 지적받았는지" 재현할 길이 없어진다. 같은 패턴이 한 PR 안에서 7곳 이상 반복돼, 근거 추적 방식이 파일마다 분산되어 있다.
  - 제안: 세션 ID 인용은 `plan/in-progress/trigger-uuid-and-guide-error-codes.md`(영구 추적 대상) 한 곳에 모으고, 소스 주석에서는 "무엇이 왜 이런 형태인가"라는 결론만 완결된 문장으로 남기거나 그 plan 문서를 가리키는 편이 더 durable하다.

- **[INFO]** `UuidParamAxis` 타입 리터럴이 식별자이자 사람이 읽는 라벨을 겸한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:15` (`export type UuidParamAxis = 'ParseUUIDPipe' | "@ApiParam format:'uuid'";`)
  - 상세: 두 번째 리터럴 `"@ApiParam format:'uuid'"`는 공백·콜론·작은따옴표를 포함한 "표시용 문장"이면서 동시에 타입 판별자로 쓰인다. `param-uuid-pipe.spec.ts`의 단언(예: `"bare:ParseUUIDPipe+@ApiParam format:'uuid'"`)도 이 문자열을 그대로 재입력해야 해서, 라벨 문구를 다듬고 싶을 때 타입 선언과 여러 테스트 문자열을 동시에 손대야 한다.
  - 제안: 내부 판별자(예: `'api-param-uuid-format'`)와 사람이 읽을 출력 문구를 분리하고, `violations.map(...)`에서 출력 시점에 라벨을 붙이는 편이 표시 문구 변경과 판정 로직을 분리한다.

- **[INFO]** 동일한 회전 결과 mock 리터럴이 파일 내에서 두 번 반복된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:30-35` (`ROTATE_RESULT`) 와 `:246-251` (`rotateBotToken = jest.fn().mockResolvedValue({...})`)
  - 상세: `rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity` 네 필드 구성이 같은 파일의 두 describe 블록에서 각각 하드코딩된다. 응답 스키마(`ChatChannelRotateBotTokenDto`)가 필드를 추가/변경하면 두 자리를 따로 갱신해야 한다.
  - 제안: 공용 팩토리 함수(예: `makeRotateResult(overrides)`)로 추출해 파일 상단에서 한 번만 정의.

- **[INFO]** vacuity floor 임계값이 매직 넘버다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:60` (`toBeGreaterThan(30)`), `:66` (`toBeGreaterThan(100)`)
  - 상세: 두 숫자 모두 주석으로 의도는 설명되어 있으나(현재 실측 35개 컨트롤러·136개 id-형 파라미터에 대한 여유 하한), 이름 없는 리터럴이라 다음 사람이 "왜 30/100인가"를 다시 주석까지 읽어야 안다.
  - 제안: `MIN_CONTROLLER_COUNT` / `MIN_ID_PARAM_COUNT` 같은 명명 상수로 뽑으면 임계값 자체가 자기설명적이 된다. (심각도는 낮음 — 이미 주석이 근거를 적어 두었다.)

- **[INFO]** `rotateBotToken` 파라미터 목록 안에 긴 설명 주석이 두 군데(신규 1곳 포함) 끼어 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:287-290` (신규) 와 기존 `:295-297`
  - 상세: 메서드에는 이미 8줄짜리 JSDoc(파일 251~256행 부근)이 있는데, 파라미터 리스트 중간에 4줄짜리 주석이 또 추가되어 메서드 시그니처를 한눈에 훑기 어렵게 만든다. 기존 코드에도 같은 패턴(`:295-297`)이 있어 이 PR이 새로 만든 비일관성은 아니지만, 이번 추가로 같은 파라미터 목록 안의 설명 주석이 두 곳으로 늘었다.
  - 제안: 두 설명을 메서드 JSDoc 한 곳으로 합치고, 파라미터 옆에는 "왜 여기 있는지"를 가리키는 짧은 참조만 남기는 방안을 고려할 수 있다(강제 아님 — 기존 관례를 따른 것이므로 낮은 우선순위).

## 요약

이번 변경은 이전 리뷰 라운드(20_01_18 / 20_26_58 / 20_53_01)에서 지적된 중첩 깊이·vacuity floor 재구현·인덱스드 액세스 타입 문제를 실제로 해소한 흔적이 뚜렷하다 — `collectMethodViolations` 로 순회/판정을 분리했고, `scanned`/`violations`를 같은 루프에서 반환하도록 통합했으며, 이름 있는 `UuidParamAxis`/`UuidParamViolation` 타입을 도입했다. 네이밍은 코드베이스 컨벤션(camelCase, `*.controller.ts`/`*-guard.ts`/`*.spec.ts` 분리)과 일관되고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮은 편이다. 다만 프로덕션·테스트 소스 곳곳에 리뷰 세션 폴더 타임스탬프를 근거로 인용하는 주석이 반복적으로 박혀 있어(7곳 이상) 그 근거의 수명이 `review/code/**`의 보존 여부에 종속되는 점, 그리고 소수의 사소한 중복·매직 넘버가 남아 있다. Critical 급 결함은 없다.

## 위험도
LOW
