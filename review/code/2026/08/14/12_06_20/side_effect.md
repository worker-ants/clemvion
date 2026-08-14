# 부작용(Side Effect) Review — `12_06_20`

## 리뷰 범위

`meta.json` 기준 실제 런타임 코드 변경 파일은 `codebase/backend/src/modules/websocket/websocket.service.ts`와
`codebase/backend/src/modules/websocket/websocket.service.spec.ts` 두 개뿐이다(`origin/main...HEAD` diff stat: 각각
+122/-12, +206). 나머지 `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/08/14/{10_32_27,11_02_16}/**`,
`review/consistency/2026/08/14/**`는 전부 문서/이전 리뷰-consistency 산출물(markdown·json)이며, 이번 diff 안에서
새로 생성된 것 자체가 강제 리뷰/consistency 워크플로의 "의도된" 산출물이라 "예상치 못한 파일시스템 부작용"에 해당하지
않는다. 실행 코드 경로에 영향을 주지 않으므로 이하 분석은 위 두 소스 파일에 집중한다.

이 diff 는 이미 두 차례(`10_32_27`, `11_02_16`) side_effect 관점으로 검토됐고, 각 라운드가 지적한 항목(depth cap
경계 연산자 `>=` vs `>` 불일치 — `11_02_16` WARNING)이 이후 커밋(`b49ee4310`)으로 실제 반영됐는지 소스를 직접 열어
재확인했다.

## 발견사항

- **[INFO]** `stripDeep` 도입으로 외부 fanout strip 기준이 "위치(top-level)"에서 "이름(어느 깊이든 `llmCalls`)"으로
  바뀌면서, 이번에 목표한 `execution.waiting_for_input` 하나가 아니라 `emitExecutionEvent`/`emitNodeEvent`를 타는
  **모든** 이벤트 타입의 외부 fanout 계약이 함께 넓어졌다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:303-317`(JSDoc 설계 의도), `:387-427`(`stripDeep`)
  - 상세: 의도적이고 JSDoc(`:313-314` "필드명 자체가 문서화된 비밀 마커이므로 이름으로 막는다")에 명시된 트레이드오프이며,
    `stripExternalOnlyFields`의 시그니처(`:336-339`, `(envelope: Record<string, unknown>) => Record<string, unknown>`)
    자체는 변경되지 않아 호출자(`emitExecutionEvent:577`, `emitNodeEvent:648` — 2곳뿐, grep 확인) 영향은 없다. 다만
    "인터페이스 변경" 관점에서는 향후 어떤 노드 타입이 디버그 목적이 아닌 필드에 우연히 `llmCalls`라는 이름을
    재사용하면 자동으로 외부 수신자에게서 조용히 사라진다. 이 항목은 `10_32_27`/`11_02_16` 두 라운드에서 이미 INFO로
    기록됐고 collateral 없음(grep 기준)도 확인된 상태라 재조치 대상은 아니다 — 참고 기록으로 재확인만 한다.
  - 제안: 없음(이미 추적됨, `review/code/2026/08/14/10_32_27/RESOLUTION.md` "넘김" 표 INFO 2).

## 확인했으나 문제 없음 (positive findings)

- **`11_02_16` WARNING(깊이 상한 경계 연산자 `>=` vs `>` 불일치) 실제로 해소됨** — 직접 소스 대조: `stripDeep:393`은
  `if (depth > MAX_SANITIZE_DEPTH) return value;`로, 형제 `sanitizePayloadForWs:251`의
  `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`와 경계 연산자가 이제 동일하다. depth 정확히 10인
  노드에서 strip 이 스킵되던 좁은 구멍이 닫혔다.
- **입력 mutate 없음** — 배열 분기(`:395-403`)는 변경이 있을 때만 `value.slice()`로 새 배열을 만들고, 객체 분기
  (`:406-426`)는 `out ??= { ...obj }`로 지연 스프레드한 뒤 `Object.defineProperty(out, k, …)`로 **새로 만든 `out`**에만
  값을 쓴다 — 원본 `obj`/`value`는 어떤 경로로도 변경되지 않는다. `__proto__` own property 가 있어도 스프레드가 먼저
  own data property 로 옮겨두므로 프로토타입 오염이 없다(`websocket.service.spec.ts:762`의 신규 회귀 테스트로 검증).
- **전역 상태 신설 없음** — `EXTERNAL_STRIPPED_FIELDS`(`:322`, 기존 상수, 값 불변)와 `MAX_SANITIZE_DEPTH`(기존 export
  상수)만 참조한다. `SANITIZE_CACHE`(WeakMap, `sanitizePayloadForWs` 전용) 는 이 diff 밖의 기존 코드이고 `stripDeep`
  은 이를 사용하지 않는다 — 새 module-level mutable state 없음.
- **시그니처/공개 인터페이스 영향 없음** — `stripExternalOnlyFields`/`stripDeep` 모두 module-private(비-export)이고,
  `stripExternalOnlyFields`의 파라미터/반환 타입은 변경 전과 동일하다. 호출부(`emitExecutionEvent`/`emitNodeEvent`)의
  이벤트 발행 횟수·`executionEventSubject.next(...)` 콜백 배선·채널 라우팅 순서는 이 diff 로 손대지 않았다(diff hunk
  가 `stripDeep`/JSDoc 블록 하나로 국한됨 — `git diff --stat` 상 훅 헤더 2개 모두 300~427행 구간).
- **환경 변수·파일시스템·네트워크 호출 없음** — diff 전체에서 `process.env`/`fs.*`/`fetch`/`axios`/`http.request`
  패턴 매칭 0건(직접 grep 확인). 순수 인메모리 payload 변환.
- **테스트 격리 유지** — 신규 테스트 4건(`websocket.service.spec.ts:656`, `:724`, `:762`, `:820` `it.each`)은 매
  테스트마다 `beforeEach`(`:51-52`)가 `gateway = { broadcastToChannel: jest.fn() }`로 새 mock 을 만들어 `mock.calls[0]`
  인덱싱이 이전 테스트와 간섭하지 않는다. 각 테스트가 로컬 fixture 객체(`hostile`, `node` 등)만 사용해 모듈 스코프
  상태나 다른 테스트로 새는 공유 mutable 상태를 만들지 않는다.

## 요약

이번 라운드(`12_06_20`)의 실질 코드 diff는 `stripExternalOnlyFields`를 depth-1 shallow delete에서 이름 기반
깊이-무관 재귀 strip(`stripDeep`)으로 교체한 보안 수정이며, 부작용 관점의 8개 점검 축(상태 변경·전역 변수·파일시스템·
시그니처·인터페이스·환경 변수·네트워크·이벤트/콜백) 중 실제 위험이 있는 항목은 없다. 입력 mutate-free·모듈-private
함수·기존 호출자 시그니처 불변이 소스 직접 대조로 확인됐고, 직전 라운드(`11_02_16`)가 WARNING으로 지적한 깊이 상한
경계 연산자 불일치(`>=` vs `>`)도 최종 커밋(`b49ee4310`)에서 형제 함수와 동일하게 통일돼 실제로 해소됐다. 유일하게
남는 관찰은 strip 판정이 "위치"에서 "이름"으로 넓어지면서 목표 이벤트 외 모든 이벤트의 외부 fanout 계약이 함께
넓어졌다는 점인데, 이는 JSDoc 에 명시된 의도적 트레이드오프이고 이전 두 라운드에서 이미 INFO로 기록·수용된 사항이라
재조치가 필요하지 않다. `plan/**`·`review/**` 신규 문서는 코드 실행 경로와 무관해 부작용 검토 대상이 아니다.

## 위험도

LOW
