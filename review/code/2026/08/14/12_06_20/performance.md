# 성능(Performance) 코드 리뷰

대상: `codebase/backend/src/modules/websocket/websocket.service.ts`(핵심 변경),
`codebase/backend/src/modules/websocket/websocket.service.spec.ts`(테스트 추가).
그 외 `CHANGELOG.md`·`plan/**`·`review/**`는 문서/검토 산출물이라 성능 관점 적용 대상이
아니며(코드 없음), 이번 라운드(`12_06_20`)에 포함된 `review/code/2026/08/14/{10_32_27,11_02_16}/**`는
**직전 두 라운드의 코드 리뷰 산출물**이다. 그중 `performance.md`가 이미 이번 diff 의 핵심
알고리즘 변경(`stripExternalOnlyFields`: depth-1 shallow delete → 재귀 `stripDeep`)을 두 라운드에
걸쳐 상세히 분석했고, 지적된 항목은 `RESOLUTION.md`(`10_32_27`, `11_02_16`) + JSDoc(`stripDeep`
`## 비용 (실측)` 절, `websocket.service.ts:371-385`) + `plan/in-progress/spec-draft-eia-62-waiting-payload.md:169-183`
로 실측·문서화·후속 추적이 이미 이뤄진 상태다. 본 라운드는 그 최종 상태를 코드로 직접
재확인하고, 이전 두 라운드가 다루지 않은 지점만 추가로 짚는다.

## 확인했으나 문제 없음 (이전 라운드 WARNING 반영 확인)

- **지연 할당(lazy clone-on-write) 적용 확인** — `stripDeep`(`websocket.service.ts:387-427`)은
  배열 분기(`:396`, `let out: unknown[] | null = null`)·객체 분기(`:407`, `let out: Record<string, unknown> | null = null`)
  모두 실제 변경이 발생할 때만 `value.slice()`/`{ ...obj }`를 할당한다. `10_32_27` maintainability WARNING("no
  allocation on the common path"가 구현보다 넓은 주장이었음)이 실제로 해소됐다.
- **깊이 상한 적용 및 형제와 경계 연산자 통일 확인** — `:393` `if (depth > MAX_SANITIZE_DEPTH) return value;`가
  `sanitizePayloadForWs`(`:251` `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`)와 **같은
  연산자(`>`)**를 쓴다. `11_02_16` CRITICAL 1(경계 연산자 어긋남으로 리뷰어 4명이 갈렸던 지점)이
  실제 파이프라인 depth sweep(`websocket.service.spec.ts:819` `it.each([0,5,8,9,10,11,12])`)으로
  검증됐고, 코드도 일치시켰다.
- **hot path 2중 순회 트레이드오프가 실측·문서화됨** — `sanitizePayloadForWs`가 이미 완전 순회한
  결과를 `stripDeep`이 다시 완전 순회하는 구조(`emitExecutionEvent` `:557`→`:577`, `emitNodeEvent`
  `:634`→`:648`)는 여전히 남아 있으나, A/B 실측치(옛 depth-1 0.0112ms → 현행 재귀 0.0314ms, N=3000,
  8턴 `turnDebugHistory`, +20.2 µs/emit)가 JSDoc(`:374-380`)에 남아 있고, 두 pass를 합치지 않는 이유
  (마스킹 로직·`SANITIZE_CACHE`·depth 캡을 흔들 위험 대비 20 µs 절감의 가치가 낮음)도 명시돼 있다.
- **identity 캐시 부재가 근거와 함께 추적됨** — `stripDeep`은 형제 `sanitizePayloadForWs`의
  `SANITIZE_CACHE`(WeakMap, `:236`, ForEach 5,000회 emit → O(1))에 대응하는 캐시가 없다(`11_02_16`
  performance WARNING). 지금 안 붙이는 이유(두 캐시의 무효화 시점이 갈려 "sanitize는 적중, strip은
  미적중"인 조합을 덮는 테스트가 없음)와 재관측 조건이 `plan/in-progress/spec-draft-eia-62-waiting-payload.md:176-179`에
  등재돼 있다. 코드 변경 없이 유예된 상태이며 이번 라운드 diff 에서 악화되지 않았다.
- **벤치마크 범위 한계가 명시됨** — A/B 측정은 AI 대화 payload(`turnDebugHistory`)로만 이뤄졌는데,
  `stripDeep`은 `llmCalls`를 가질 수 없는 **모든** node 이벤트(`emitNodeEvent`, `:648`)에도 방어심층화
  목적으로 걸린다. 대용량 non-AI `nodeOutput`(예: HTTP 응답 JSON을 그대로 담는 API-call 노드)이
  worst case인데 아직 측정되지 않았다는 점(`11_02_16` performance WARNING 3)이 JSDoc과
  `plan/in-progress/spec-draft-eia-62-waiting-payload.md:180-183`에 "실측했다는 측정한 범위 안에서만
  참이다"로 명시돼 있다. 실측이 완료되기 전까지는 이 항목을 열린 채로 두는 것이 맞다.

이상 네 항목은 이번 diff 에서 코드가 바뀐 것이 아니라(캐시 미도입·벤치마크 범위 한정은 `11_02_16`
시점 그대로), 근거·수치·후속 추적이 이미 충분히 갖춰져 있어 이번 라운드에서 다시 WARNING 으로
올릴 근거가 없다고 판단해 INFO 로 하향해 기록만 남긴다.

## 발견사항 (신규)

- **[INFO]** `stripDeep` 객체 분기가 매 노드마다 `Object.entries(obj)`로 `[key, value]` 쌍 배열을
  무조건 할당한다 — "아무것도 할당하지 않는다"는 JSDoc 주장은 반환 객체(`out`)에 대해서만 정확하다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:408`(`for (const [k, v] of Object.entries(obj))`), JSDoc 주장 위치 `:343`(`제거가 실제로 일어나기 전에는 **아무것도 할당하지 않고**`)
  - 상세: `Object.entries()`는 호출마다 새 배열(및 각 원소의 `[k, v]` 2-tuple)을 생성한다. 트리의
    strip 대상 유무와 무관하게 **모든 object 노드**에서 이 호출이 일어나므로, "common path 는 할당이
    없다"는 문구는 정확히는 "반환값(clone) 은 할당이 없다"이지 "순회 과정 전체가 할당 없음"은
    아니다. 다만 이 관용구는 같은 파일의 `sanitizeInner`(`:278`, 이번 diff 범위 밖)도 그대로 쓰고
    있어 이 diff 가 새로 도입한 패턴이 아니라 기존 코드베이스 관례를 그대로 따른 것이다.
  - 제안: 실제 영향은 미미하다(`for...in` + bracket 접근으로 바꾸면 이 할당은 피할 수 있으나 가독성이
    떨어지고 상속 프로퍼티까지 순회하지 않도록 `hasOwnProperty` 체크가 추가로 필요해져 배보다 배꼽이
    커진다). 조치 불필요, JSDoc 문구를 "반환 identity 는 할당 없이 보존된다" 정도로 한 단어만
    좁히면 다음 유지보수자가 오독할 여지가 줄어든다.

- **[INFO]** `EXTERNAL_STRIPPED_FIELDS.includes(k)`가 트리의 **모든 key**에 대해 매번 호출된다 (기존
  라운드 반복 지적, 재확인)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:409`
  - 상세: 원소가 `'llmCalls'` 하나뿐이라 `.includes()` 비용은 사실상 상수다. 필드가 여러 개로 늘면
    O(필드 수)로 늘어나지만 지금은 우선순위 낮음(`10_32_27` maintainability INFO 4 와 동일 판단,
    변경 없음).

## 확인했으나 문제 없음

- 신규 테스트 `it.each([0, 5, 8, 9, 10, 11, 12])`(`websocket.service.spec.ts:819`)는 emit 당
  최대 depth 12 수준의 소규모 nested object 7건을 순회하는 테스트 전용 코드로, 프로덕션 hot path와
  무관하고 실행 비용도 무시할 수준이다.
- `attachRoutingContext`(routing context shallow-merge, `emitExecutionEvent`/`emitNodeEvent` 호출부
  이후)는 이번 diff 범위 밖이며 미등록 시 원본 참조를 그대로 반환해 추가 할당이 없다 — 기존 동작
  그대로 유지됨을 확인.

## 요약

이번 diff의 핵심 알고리즘 변경(`stripExternalOnlyFields`를 O(top-level) shallow delete에서
O(payload 전체 크기) 재귀 clone-on-write로 교체)은 이미 직전 두 리뷰 라운드(`10_32_27`, `11_02_16`)에서
철저히 다뤄졌고, 지적된 항목(할당 없음 주장 과장, 깊이 캡 부재, 형제와 경계 연산자 불일치)은 실제
코드에 반영돼 이번 라운드에서 코드로 재확인됐다. 남아 있는 구조적 트레이드오프(hot path 2중 완전
순회, `stripDeep` 전용 identity 캐시 부재, 벤치마크가 AI 대화 payload로만 한정됨)는 회피된 것이
아니라 수치와 근거를 갖춰 명시적으로 유예됐고 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`에
후속 조건과 함께 추적되고 있어, 이번 라운드에서 다시 차단 사유로 올릴 근거가 없다. 신규로 발견한
것은 `Object.entries()` 호출 자체가 매 노드마다 일어난다는 사소한 문서 정밀도 지적 하나(INFO)뿐이며,
기존 코드베이스 관용구를 그대로 따른 것이라 이번 diff 의 결함이 아니다. 정보 유출을 막는 보안
수정으로서 정확성이 성능보다 우선한다는 판단은 타당하고, 그 대가를 숨기지 않고 측정·문서화·추적한
점은 이 프로젝트가 반복적으로 요구해 온 "유예 근거는 실측해야 한다" 기준을 충족한다.

## 위험도

LOW
