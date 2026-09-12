# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** vacuity floor 임계값(30, 100)이 이름 없는 리터럴로 박혀 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:60`, `:66`
  - 상세: `expect(controllers.length).toBeGreaterThan(30)` 과 `expect(scanUuidParams(files, SRC_ROOT).scanned).toBeGreaterThan(100)` 의 30·100 은 실측(컨트롤러 35개·id-형 파라미터 136건)에서 여유를 둔 하한이다. 바로 위 주석이 의도를 설명해 두어 당장 오독 위험은 낮지만, 숫자 자체는 왜 그 값인지 옆에서 보이지 않는다.
  - 제안: `const MIN_CONTROLLERS = 30; const MIN_ID_PARAMS = 100;` 처럼 이름을 붙이면 실측치가 흔들렸을 때(신규 컨트롤러 추가 등) 무엇을 갱신해야 하는지 더 명확해진다. 우선순위 낮음(현재도 인접 주석이 근거를 제공).

- **[INFO]** `UuidParamViolation.missing` 의 "정렬" 표현이 실제 구현과 정확히 대응하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:26` (필드 주석 "빠진 축 (정렬)") 및 `collectMethodViolations` 본문의 push 순서(파일 내 `missing.push('ParseUUIDPipe')` → `missing.push("@ApiParam format:'uuid'")` 구간)
  - 상세: 실제로는 정렬 함수를 호출하는 게 아니라 항상 `ParseUUIDPipe` 를 먼저, `@ApiParam format:'uuid'` 를 나중에 push 하는 고정 순서다. 축이 2개뿐이라 현재는 결정적이지만 "정렬"이라는 단어는 일반적인 `sort()` 호출을 연상시켜, 축이 하나 더 늘어날 때 실제로는 정렬 로직이 없다는 사실을 놓치기 쉽다.
  - 제안: 주석을 "고정 순서(선언 순)"처럼 실제 동작을 그대로 서술하거나, 정말 정렬을 보장하려면 `missing.sort()` 를 명시적으로 추가.

- **[INFO]** `apiParamUuidFlags` 함수명이 반환값의 의미를 완전히 담지 못한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:79` (`function apiParamUuidFlags(...)`)
  - 상세: 반환 타입은 `Map<string, boolean>` 이며 "파라미터 이름 → format:'uuid' 선언 여부"를 담는다. "Flags" 라는 이름만으로는 키가 파라미터 이름이라는 점, 값이 uuid-format 여부라는 점이 바로 드러나지 않는다. JSDoc 이 이를 보완하고 있어 실사용에는 문제 없다.
  - 제안: `apiParamUuidFormatByName` 등으로 좀 더 구체화하면 호출부(`collectMethodViolations`)의 `declared.get(param) !== true` 를 읽을 때 추가 설명 없이도 의도가 드러난다.

- **[INFO]** 신규 HTTP 왕복 테스트 블록의 JSDoc 이 매우 길다(약 26줄, 실제 테스트 로직은 약 30줄)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:202`~`228` (describe 블록 앞 JSDoc)
  - 상세: "왜 위 describe 로는 안 되나"·"대조군이 왜 세 개인가" 두 절로 과거 리뷰 판단 오류까지 서술하며 문서/코드 비율이 높다. 이 저장소 전반(가드 파일들도 동일 스타일)이 리뷰 세션 근거를 인라인 주석으로 남기는 관례를 이미 확립하고 있어 **일관성 관점에서는 문제 없음** — 다만 다음에 이 파일을 여는 사람이 테스트 3건의 실제 동작을 파악하기까지 긴 서사를 먼저 읽어야 한다는 점은 그대로 남는다.
  - 제안: 조치 불필요(관례 일치). 다만 앞으로 같은 파일에 유사한 장문 JSDoc 이 계속 쌓이면 별도 설계 노트(`plan/` 또는 spec Rationale)로 옮기는 것을 고려할 시점을 가늠해 둘 것.

## 요약

`triggers.controller.ts` 의 `rotateBotToken` 에 형제 6개 엔드포인트와 동일한 `@Param('id', ParseUUIDPipe)` + `@ApiParam({format:'uuid'})` 패턴을 맞추고, 이를 되풀이하지 않도록 순수 AST 기반 가드(`param-uuid-pipe-guard.ts`)와 그 스펙·fixture 를 새로 추가한 변경이다. 가드 코드는 순회(`scanUuidParams`)와 판정(`collectMethodViolations`)을 분리하고 카운팅(`scanned`)을 같은 루프에서 산출하도록 설계해 이전 리뷰 라운드에서 지적된 중첩·카운터 드리프트 문제를 이미 해소한 상태이며, 네이밍·타입 정의(`UuidParamAxis`/`UuidParamViolation`/`UuidParamScan`)도 이 저장소의 다른 가드와 일관된 형태를 취한다. 함수 길이·중첩 깊이·순환 복잡도 모두 통제된 범위이고, 매직 넘버는 테스트의 vacuity-floor 임계값 두 곳 정도이며 인접 주석이 근거를 제공한다. `auth.controller.ts`·`backend-labels.ts` 등 나머지 변경은 기존 패턴을 그대로 따르는 소규모 보강/정정이라 별도 우려가 없다. 전반적으로 유지보수성 측면에서 우려할 결함은 없고, 위에 적은 항목들은 모두 개선하면 좋을 수준의 INFO 다.

## 위험도
NONE
