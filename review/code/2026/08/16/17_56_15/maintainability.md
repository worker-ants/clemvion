# 유지보수성(Maintainability) Review

## 대상 요약

이번 changeset 의 실질 코드 표면은 6개 TS 파일이다: `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규)
+ `.spec.ts`(신규), `codebase/backend/src/modules/executions/executions.service.ts` + `.spec.ts`,
`codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` + `.spec.ts`,
그리고 2개 DTO 파일(주석/설명 문자열만 변경). 나머지(`plan/**`, `spec/**`, `review/**`,
`.claude/docs/plan-lifecycle.md`, `CHANGELOG.md`)는 문서이며 가독성·네이밍·복잡도 관점에서
지적할 코드가 없다.

## 발견사항

- **[WARNING]** 리팩터 과정에서 JSDoc 블록이 원래 대상과 분리돼 **고아(orphan) 주석**이 됐다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:68-77` (직접 `Read` 로 확인한 실제 소스 줄 번호)
  - 상세: 종전에는 68~77번 줄의 JSDoc(`findById` 응답 shape·`executionPathTruncated` 설명)이 바로 다음에 오는
    `ExecutionDetailWithTrigger` 타입 선언에 붙어 있었다. 이번 PR 이 그 사이에 `ResponseExecution`(87번 줄, 자체 JSDoc 78-86)과
    `ResponseNodeExecution`(101번 줄, 자체 JSDoc 94-99) 두 타입을 새로 끼워 넣으면서, 68-77번 블록은 이제 **다음 줄이 코드가 아니라
    또 다른 JSDoc 블록(78번 줄)** 이 됐다. JSDoc/TSDoc 은 "바로 다음 선언" 에 붙는 관례이므로, 68-77번 블록은 더 이상 어떤 심볼도
    문서화하지 않는 채로 떠 있고, 정작 그 내용이 설명하던 `ExecutionDetailWithTrigger`(105번 줄)는 육안상 바로 위 `ResponseNodeExecution`
    JSDoc 만 붙은 것처럼 보인다. IDE hover·TypeDoc 등 도구가 이 블록을 그대로 무시하거나 엉뚱한 자리로 해석할 수 있어,
    다음에 이 근처를 손대는 사람이 "이 설명이 무엇을 가리키는지" 헷갈릴 실질적 위험이 있다.
  - 제안: 68-77번 블록을 `ExecutionDetailWithTrigger` 선언(현재 105번 줄) 바로 위로 옮기거나, 내용이 겹치지 않는다면
    `ResponseExecution`/`ResponseNodeExecution` JSDoc 과 통합해 하나의 연속된 주석으로 재배치한다.

- **[INFO]** 신규 테스트 블록이 기존에도 있던 QueryBuilder mock 중복 패턴을 한 번 더 늘렸다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:950-956` (④), `:977-984` (④-b) —
    5줄짜리 `update`/`set`/`where`/`andWhere`/`execute` mock 조립이 두 테스트에 그대로 복제돼 있다. 동일 모양의
    블록이 이 파일에 이미 `:798-804` 에 pre-existing 으로 존재해(이번 diff 대상 아님), 이번 PR 은 그 패턴을
    확장한 것뿐이다.
  - 상세: `buildSingleQB`/`buildListQB` 처럼 `update` 계열 전용 헬퍼(`buildStopUpdateQB(affected: number)` 등)를
    하나 뽑으면 8줄이 2줄로 줄고, 이후 유사 테스트를 추가할 때도 같은 복제가 반복되지 않는다. 다만 같은 파일에서
    `buildSingleQB` 중복(:397, :862)이 직전 라운드(`17_12_34`)에 "선존 패턴을 따른 것이라 이번 diff 가 만든 중복이
    아니다" 로 이미 INFO 처리된 선례가 있어, 이 항목도 같은 성격 — 이번 diff 가 새로 만든 결함이라기보다 기존 관용을
    반복 확장한 것이다.
  - 제안: 즉시 조치는 불필요하나, 다음에 `stop()` 관련 테스트를 추가할 계획이 있다면 그 시점에 공유 헬퍼로 통합할
    가치가 있다.

- **[INFO]** 동일 로직 안에서 null 판별 스타일이 섞여 있음 (`==` vs `===`)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:641` (`ne.error == null ? ne : …`)
  - 상세: 같은 PR 이 도입한 `redactStoredErrorForResponse`(`codebase/backend/src/shared/utils/redact-stored-error.ts:60`)는
    `err === null || err === undefined` 로 엄격 비교를 쓰는데, 호출부의 `.map()` 안에서는 `ne.error == null` 로 느슨한
    동치 비교를 쓴다. 기능적으로는 동일하고(둘 다 null/undefined 를 함께 잡음) 저장소에 `eqeqeq` lint 규칙도 없어 오류는
    아니지만, 바로 옆의 관문 함수와 다른 스타일을 같은 변경 안에서 섞은 점은 사소한 일관성 흠이다.
  - 제안: 선택 사항. 통일하려면 `=== null || ne.error === undefined` 로 맞추거나, 반대로 `redactStoredErrorForResponse`
    쪽을 `== null` 로 통일할 수 있다.

## 긍정적으로 관찰된 점 (조치 불요, 참고)

- `ResponseExecution`/`ResponseNodeExecution` 타입 신설은 직전 라운드(`17_12_34`)가 지적한 `as Execution` 무단 단언을
  걷어내고, `error: Record<string, unknown> | null` 을 정직하게 타입에 반영해 이후 소비자의 null-check 누락을 컴파일러가
  잡을 수 있게 한다 — 좋은 방향의 타입 설계다.
- `toResponseExecution` 을 `findById`/`getChain`/`stop` 세 반환 지점의 공통 관문으로 묶고 `toExecutionDto` 는 별도로
  명시 호출하게 한 구조는, "자매 표면 중 하나만 마스킹" 형태의 재발을 구조적으로 줄인다 — 관문 하나로 수렴시키는
  설계가 유지보수성에 도움이 된다.
- `stop()` / `stopInternal()` 분리와 JSDoc 재배치("동시성 계약은 본체에, 마스킹 관문 설명은 wrapper 에")는 책임을
  명확히 나눠 각 함수가 한 가지만 설명하도록 한 점이 좋다.
- `redact-stored-error.ts` 자체는 8줄짜리 단일 책임 순수 함수로, 복잡도·네이밍·중첩 어느 관점에서도 문제가 없다.

## 요약

이번 changeset 의 실질 코드 변경은 6개 TS 파일에 한정되고, 대부분 이미 조회된 데이터에 값 마스킹을 적용하는 얕은
변환 로직이다. 함수 길이·중첩 깊이·순환 복잡도 모두 이 저장소의 기존 규모 대비 무리가 없고, 새로 도입된
`ResponseExecution`/`ResponseNodeExecution` 타입은 오히려 이전 라운드가 지적한 무단 타입 단언 문제를 해소하는
방향으로 개선됐다. 유일하게 실질적인 지적은 리팩터 중 JSDoc 블록 하나가 원래 대상에서 떨어져 나가 고아가 된
것(WARNING)이고, 나머지는 테스트 파일의 기존 중복 관용을 답습한 정도의 경미한 INFO 다.

## 위험도

LOW — CRITICAL 0 · WARNING 1(문서 위치 정합성) · INFO 2(경미한 중복·스타일 일관성).
