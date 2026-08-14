# 유지보수성(Maintainability) 리뷰

리뷰 대상 중 코드(가독성/네이밍/함수 길이/중첩/매직 넘버/중복/복잡도) 관점이 실질적으로
적용되는 파일은 `codebase/backend/src/modules/websocket/websocket.service.ts` 와
`codebase/backend/src/modules/websocket/websocket.service.spec.ts` 뿐이다. 나머지
(`CHANGELOG.md`, `plan/in-progress/*.md`, `review/**/*.md|json`)는 계획·리뷰 산출물
문서라 이 관점의 적용 대상이 아니다(선행 라운드 `10_32_27/maintainability.md` 와 동일 판단).

이번 diff 는 직전 라운드(`10_32_27`)에서 이 파일에 대해 나온 유지보수성 WARNING("no
allocation on the common path" 주장이 구현보다 넓었음)과 관련 INFO(깊이 캡 부재)가
`RESOLUTION.md` W3·W4 로 이미 반영된 **이후** 상태다. 실제로 `stripDeep` 은 배열/객체
분기 모두 `out: T | null = null` 로 시작해 변경이 실제 발생할 때만 할당하는 진짜
lazy clone-on-write 이고(`websocket.service.ts:390`, `:401`), `MAX_SANITIZE_DEPTH`
깊이 캡도 형제 함수와 동일하게 적용됐다(`:387`). 두 항목 모두 재확인했고 해소됨.

## 발견사항

- **[INFO]** `stripDeep` JSDoc 이 "형제 `sanitizeInner` 와 같은 패턴" 이라고 주장하지만, 배열 분기는 실제로 다른 전략이다(레벨 낮은 정밀도 문제)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:344` (JSDoc), 비교 대상 `:389-396`(`stripDeep` 배열 분기) vs `:265-274`(`sanitizeInner` 배열 분기)
  - 상세: `stripDeep` 의 JSDoc 은 "제거가 실제로 일어나기 전에는 아무것도 할당하지 않고 ... 형제 `sanitizeInner` 와 같은 패턴이다" 라고 서술한다(`:343-344`). 객체 분기끼리는 이 서술이 정확하다 — 둘 다 `null` sentinel 로 시작해 첫 변경 시에만 `{ ...obj }` 를 만든다. 그런데 배열 분기는 서로 다르다: `stripDeep` 의 배열 분기(`:390-396`)는 `let out: unknown[] | null = null` 로 시작해 첫 변경이 감지될 때만 `value.slice()` 로 복제하는 진짜 lazy 전략인 반면, `sanitizeInner` 의 배열 분기(`:267-274`)는 `const out: unknown[] = new Array(value.length)` 로 **매 호출마다 무조건** 새 배열을 먼저 만들고, 반환 시점에만 `mutated ? out : value` 로 버릴지 결정한다 — 즉 `sanitizeInner` 는 배열에 대해서는 이 diff 이전부터 "매 서브트리 레벨에서 할당 후 버림" 패턴이었다(직전 라운드 W3 가 `stripDeep` 에서 지적했던 것과 같은 종류의 낭비이나, `sanitizeInner` 는 이번 diff 범위 밖이라 손대지 않았다). `stripDeep` 자신의 "아무것도 할당하지 않는다" 주장은 이제 정확하지만, "형제와 같은 패턴" 이라는 비교는 배열 케이스에서 부정확해 향후 유지보수자가 `sanitizeInner` 도 배열에 대해 동일하게 최적화돼 있다고 오인할 수 있다.
  - 제안: JSDoc 문구를 "객체 분기는 형제 `sanitizeInner` 와 같은 패턴, 배열 분기는 (그보다 더 lazy 한) slice-on-first-change" 정도로 한정하거나, 반대로 `sanitizeInner` 의 배열 분기도 동일한 lazy 패턴으로 맞춰 실제로 "같은 패턴"이 되게 한다(후자는 이번 PR 범위 밖 후속 작업으로 남겨도 무방).

- **[INFO]** `stripDeep` 내부에서 "변경 시에만 지연 할당" 로직을 배열 분기와 객체 분기가 서로 다른 관용구로 구현해 함수 내부 일관성이 낮다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:393-394`(배열 분기) vs `:404`·`:410`(객체 분기)
  - 상세: 객체 분기는 `out ??= { ...obj };` 라는 nullish-coalescing-assignment 관용구로 "아직 없으면 만든다"를 한 줄로 표현한다(두 번 반복돼 이미 이 함수 내 관례로 자리잡음). 반면 배열 분기는 같은 의도를 `if (s !== value[i] && out === null) out = value.slice(); if (out !== null) out[i] = s;` 라는 두 개의 별도 `if` 문으로 풀어 쓴다. 동등한 로직(`out ??= value.slice(); out[i] = s;` 로 단순화 가능해 보임 — `s !== value[i]` 조건은 `out` 이 이미 할당된 이후엔 값이 같아도 대입이 안전하므로 스킵 가능)을 같은 함수 안에서 두 가지 다른 스타일로 표현하고 있어, 읽는 사람이 두 분기가 정말 같은 lazy-clone 계약을 지키는지 매번 다시 검증해야 한다.
  - 제안: 배열 분기를 `if (s !== value[i]) out ??= value.slice(); if (out) out[i] = s;` 형태로 단순화해 객체 분기와 동일한 `??=` 관용구를 쓰면 두 분기의 대칭성이 코드 레벨에서도 드러난다. 동작 변경 없는 순수 스타일 정리라 우선순위는 낮음.

## 확인했으나 문제 없음 (positive findings)

- `stripDeep`(`websocket.service.ts:386-421`)은 함수 길이·중첩 깊이·순환 복잡도 모두 양호하다 — 재귀 1단, 분기 3개(depth cap / array / null-or-non-object / object), 매직 넘버 없음(`MAX_SANITIZE_DEPTH` 상수 재사용).
- 직전 라운드 `10_32_27/maintainability.md` WARNING("no allocation" 주장이 구현보다 넓었음)과 INFO(깊이 캡 부재)는 `RESOLUTION.md` W3·W4 로 실제 코드에 반영돼 해소됨을 직접 코드로 재확인했다 — 배열/객체 양쪽 다 진짜 lazy(`out: T | null = null` 시작), `MAX_SANITIZE_DEPTH` 캡 적용.
- 테스트 파일(`websocket.service.spec.ts`)도 직전 라운드 testing W5(top-level identity 단언 추가, `:744`)·W6(내부 wire 채널 대조군 `SECRET PROMPT` 보존 단언, `:709-713`)·W7(JSDoc 과거형 정정, `:636-639`)이 모두 반영됐음을 확인 — describe 블록 배치·`wire`/`wireJson` 변수 네이밍이 기존 관례와 일관됨.
- `EXTERNAL_STRIPPED_FIELDS`/`stripDeep`/`sanitizeInner` 두 벌의 유사 트리 순회 스켈레톤 중복(직전 라운드 INFO)은 여전히 남아 있으나, 이번 diff 에서 새로 악화되지 않았고 이미 "즉시 통합 불필요, 짝점검 관례로 충분"이라는 근거가 `RESOLUTION.md` INFO 3 에 기록돼 있어 재지적하지 않는다.

## 요약

핵심 변경(`stripExternalOnlyFields` 를 depth-1 shallow strip 에서 재귀 `stripDeep` 으로 교체)은 직전 리뷰 라운드에서 나온 유지보수성 WARNING(문서한 "무할당" 보장이 구현보다 넓었던 문제)과 관련 INFO(깊이 캡 부재)가 모두 실제 코드에 반영돼 해소된 상태로 이번 라운드에 들어왔다. 재확인 결과 두 항목 모두 코드와 일치한다. 이번 라운드에서 새로 발견한 것은 경미한 문서 정밀도 문제 하나(`stripDeep` JSDoc 의 "형제 sanitizeInner 와 같은 패턴" 이라는 주장이 배열 분기에서는 정확하지 않음)와 같은 함수 내부의 사소한 관용구 불일치(배열 분기와 객체 분기가 서로 다른 스타일로 "지연 할당"을 표현) 정도로, 둘 다 INFO 수준이며 정확성이나 회귀 위험에 영향을 주지 않는다. 함수 길이·중첩 깊이·매직 넘버·네이밍·테스트 명명 컨벤션 등 나머지 항목은 모두 양호하고 기존 코드베이스의 무거운 주석 관례와도 일관된다. `plan/`·`review/` 하위 마크다운 파일은 코드가 아니므로 본 관점의 적용 대상이 아니다.

## 위험도

LOW
