# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 새로 추출한 두 캡처 헬퍼의 "vacuity 방지" 설명이 두 파일에 거의 동일한 문장으로 중복된다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:20-24` (`captureThrown` JSDoc) vs `codebase/backend/src/nodes/data/code/code.handler.spec.ts:9-14` (`captureRejected` JSDoc)
  - 상세: 이번 diff 는 직전 라운드(`review/code/2026/08/29/11_58_35`)의 WARNING #3(캡처 try/catch 보일러플레이트가 spec 파일 안에서 반복된다)을 정확히 해결한다 — `captureThrown`/`captureRejected` 로 try/catch + vacuity 단언을 각 파일에서 한 곳으로 모았다. 다만 그 두 헬퍼의 JSDoc 자체는 "던져진 예외를 잡아 돌려준다. vacuity 방지 단언을 품고 있다 — 아무것도 던지지 않으면 `.cause` 가 `undefined` 라 뒤따르는 단언이 전부 조용히 통과해 버린다. 그 함정이 `cause` 관련 케이스마다 반복되므로 여기 한 곳에만 둔다."(동기) / "reject 된 예외를 잡아 돌려준다. vacuity 방지 단언을 품고 있다 — reject 하지 않으면 `.cause` 가 `undefined` 라 뒤따르는 단언이 전부 조용히 통과해 버린다. 그 함정이 `cause` 관련 케이스마다 반복되므로 여기 한 곳에만 둔다(형제 `expression-resolver.service.spec.ts` 에 동기 버전이 있다)."(비동기) 로, 동사(던지다/reject)와 마지막 괄호 한정만 다르고 나머지는 문자 그대로 같다. `code.handler.spec.ts` 쪽이 자신을 "형제" 라고 명시적으로 인용해 두 헬퍼가 같은 개념의 sync/async 쌍임을 스스로 밝히고 있는데, 그렇다면 설명 자체는 한쪽에만 정본으로 두고 다른 쪽은 참조만 하는 편이 이 PR 이 직전 라운드에서 다른 자리(§INFO #4, "enumerable" 축 설명 중복)에 대해 이미 인지하고 plan 에 후속 등재한 것과 같은 형태의 drift 다 — "파일 안 중복"은 이번에 없앴지만 "파일 간 중복"은 같은 모양으로 새로 생겼다.
  - 제안: 급하지 않음(동작 결함 아님, spec-linked 코드 파일 재편집은 freshness 재무장 비용을 동반하므로 developer SKILL §수렴 예외 대상). 두 스펙이 공유하는 위치(예: 공용 test-utils 모듈 또는 한쪽 JSDoc 에 "설명은 `captureThrown` 참조" 식 전방 참조)로 정리하면 향후 세 번째 캡처 헬퍼가 추가될 때 같은 문장이 세 번째로 복제되는 것을 막을 수 있다. plan 문서가 이미 추적 중인 "enumerable 근거 서술 중복"(리뷰 INFO #4) 항목과 묶어서 처리하는 것이 자연스럽다.

- **[INFO]** `it.each` 의 fixture 가 타입이 모두 `string` 인 위치 인자 튜플이라 항목 순서 실수를 컴파일 타임에 못 잡는다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:191-198` (`it.each([['ExpressionSyntaxError', '{{ $input. }}', 'EXPR_SYNTAX_ERROR'], ...])`)
  - 상세: `className`/`expression`/`expectedCode` 세 필드가 전부 `string` 이라, 예를 들어 두 번째·세 번째 칼럼이 실수로 뒤바뀌어도 TypeScript 가 잡지 못하고 테스트가 실행돼야만(그리고 fixture 판별력 단언이 있어야만) 드러난다. 다행히 같은 케이스에 `cause.name`·`shape.code` 두 단언이 모두 걸려 있어(리뷰 이력상 뮤테이션 M7/M8 이 이미 이 판별력을 실측 확인했다) 런타임에서는 안전하지만, 정적으로는 열려 있는 표면이다.
  - 제안: 우선순위 낮음. Jest 의 `%s` 대신 `$className` 형태의 named 치환 + 객체 리터럴 배열(`{ className, expression, expectedCode }`)로 바꾸면 필드 순서 실수 자체가 발생할 여지가 줄어든다. 지금 방식도 이미 뮤테이션으로 판별력이 검증돼 있어 시급하지 않다.

## 확인한 것 (직전 라운드 WARNING 대비 개선)

- 직전 라운드(`11_58_35`) WARNING #3 "캡처 보일러플레이트 반복" — `captureThrown`(동기)/`captureRejected`(비동기) 로컬 헬퍼 추출로 해결됨을 확인했다. 각 spec 파일에서 기존 테스트와 신규 C2 캐너리가 동일한 헬퍼를 공유해 try/catch 패턴이 파일당 1곳으로 줄었다.
- 직전 라운드 WARNING #1 "C2 캐너리가 syntax 1종만 실행 경로로 지나간다" — `it.each` 로 `ExpressionSyntaxError`/`ExpressionReferenceError`/`ExpressionTypeError` 세 클래스를 각각 지나가게 확장됐고, `cause.name` 판별 단언까지 갖춰 세 번 도는 것이 착시가 아님을 코드 구조로 확인했다.
- `secret-resolver.service.ts` 에 추가된 문단(95-99행)은 순수 주석이며 함수 길이·중첩·분기 구조에 영향을 주지 않는다. 기존 함수(`resolve`)의 catch 블록 길이는 이미 길지만 이번 diff 가 그 길이를 늘린 폭은 4줄뿐이고, 그 문단 자체는 "C1 판정의 보조 근거일 뿐 판정축이 아니다" 라는 단일 요지를 명확히 전달한다 — 가독성 저하 없음.
- `review/code/2026/08/29/11_58_35/*` (RESOLUTION.md·SUMMARY.md·meta.json·_retry_state.json·각 reviewer `.md`)는 이전 리뷰 라운드의 산출물을 그대로 커밋한 감사 기록이라 코드 유지보수성 관점의 리뷰 대상이 아니라고 판단했다(코드가 아니라 리뷰 이력 문서).
- 신규 코드에 매직 넘버·과도한 중첩·긴 함수는 관찰되지 않았다. 네이밍(`captureThrown`/`captureRejected`, `className`/`expression`/`expectedCode`)은 목적을 명확히 드러내고 기존 파일 컨벤션(`makeNode` 같은 로컬 팩토리 함수를 describe 밖에 두는 방식)과 일관된다.

## 요약

이번 diff 는 직전 리뷰 라운드가 지적한 캡처 보일러플레이트 중복(WARNING)을 정확히 겨냥해 `captureThrown`/`captureRejected` 헬퍼로 해소했고, C2 캐너리 커버리지도 3개 클래스로 확장해 이전 결함(syntax 1종만 실행)을 구조적으로 고쳤다. 다만 그 리팩터링이 "파일 안 중복"을 없애는 대신 "파일 간 중복"(두 헬퍼의 vacuity 설명 JSDoc 이 거의 동일 문장으로 복제됨)을 새로 만들었는데, 이는 이 PR 이 이미 다른 자리(enumerable 축 설명 중복)에서 자인하고 plan 에 후속 등재해 둔 것과 같은 성격의 사소한 drift 다. 프로덕션 코드 변경은 0건(테스트 2개 파일 + 주석 1문단 + plan 문서)이라 구조적 위험은 낮고, 남은 두 발견사항은 모두 INFO 급으로 즉시 조치가 필요하지 않다.

## 위험도

LOW
