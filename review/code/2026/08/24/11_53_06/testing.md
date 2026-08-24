STATUS=success testing review complete (target: node-output-envelope-458f05)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — `node-output-envelope-458f05`

## 범위 확인

실질 코드/테스트 변경은 2개 파일뿐이다: `codebase/backend/src/modules/websocket/websocket.service.ts`
(`narrowTopLevelNodeOutput` 신설 + `allowlistFanoutNodeOutput` 배선)과
`codebase/backend/src/modules/websocket/websocket.service.spec.ts`(신규/뒤집힌 캐너리).
나머지 17개는 spec/plan/CHANGELOG/review 문서다. 프롬프트에 spec.ts 의 diff 가 크기 제한으로
생략돼 있어, `git diff origin/main..HEAD -- codebase/backend/src/modules/websocket/websocket.service.spec.ts`
로 직접 diff 를 열람하고 파일 원본을 `Read` 로 대조했다. 실행 검증도 했다: 현재 상태에서
`npx jest src/modules/websocket/websocket.service.spec.ts` → **63 passed**, 회귀 없음을 직접 확인.

## 발견사항

- **[INFO]** 뮤테이션 검증표(M1)의 기록된 pass/fail 카운트가 이후 커밋이 추가한 테스트로 stale 하다 — 결론(캐치됨)은 여전히 유효하지만 숫자가 다르다
  - 위치: `plan/in-progress/node-output-envelope.md:127` (M1 행, "✅ 2 failed / 56 passed")
  - 상세: M1(`narrowTopLevelNodeOutput(next, 'output')` 제거) 뮤테이션은 `e6a017a18` 시점(58개
    테스트 기준)에 측정돼 "2 failed / 56 passed"로 기록됐다. 그런데 그 이후 커밋
    `225936105`(`.failed` 방향 직접 단언 캐너리 추가)가 같은 `envelope.output` 경로를 도는
    테스트를 1건 더 늘렸다. 같은 뮤턴트를 현재 코드(`websocket.service.ts` 커밋 후 상태)에
    직접 재현해(`narrowTopLevelNodeOutput(next, 'output');` 한 줄 제거, `cp` 백업 후 원복)
    실행한 결과 **3 failed / 60 passed**(총 63)로, 표에 적힌 "2 failed"가 아니라 3건이 RED
    가 된다 — 새로 추가된 `.failed` 캐너리도 같은 뮤턴트를 잡는다는 뜻이라 **결론 자체는
    더 강화**됐지만, 문서에 박제된 숫자는 더 이상 실제와 일치하지 않는다. 이 저장소가 반복
    지적해 온 "실측 숫자가 이후 편집으로 무효화된다"(`feedback_measured_claim_proxy_and_timing.md`)
    형태의 재발이다. 다시 원복해 `git status`/테스트 63 passed 로 클린 상태를 확인했다.
  - 제안: 급하지 않음(mutation 이 여전히 캐치되므로 회귀 위험은 없다) — 다음에 이 표를 만지는
    김에 "58 baseline, 이후 `225936105` 로 +1" 같은 각주를 달거나, 최종 카운트로 재측정해
    갱신할 것.

- **[INFO]** `narrowTopLevelNodeOutput` 의 `output`/`nodeOutput` 값이 `null`·스칼라(비객체)인 경우를 직접 pin 하는 테스트가 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `narrowTopLevelNodeOutput` 함수(JSDoc: "값이 객체가 아니면(없거나 `null` 포함) 입력을 그대로 돌려준다") — 대응 테스트 부재는 `codebase/backend/src/modules/websocket/websocket.service.spec.ts:956`(`output` 경로 캐너리 시작) 부근
  - 상세: JSDoc 이 명시적으로 문서화한 분기(`value === null || typeof value !== 'object'`)를
    새 `output` 키 경로에 대해 직접 단언하는 테스트가 없다. 다만 실질 위험은 낮다 — (1)
    파일 안의 수십 개 무관 테스트가 `output`/`nodeOutput` 필드를 아예 안 실어 그 조기 반환
    분기를 매 호출 암묵적으로 태우고 있고(테스트 전부가 지금 GREEN 이라는 사실 자체가
    간접 증거), (2) 이 첫 번째 널 체크를 `||`→`&&` 로 뮤테이션해도 sister 함수
    `allowlistNodeOutputKeys`(`shared/utils/node-output-allowlist.ts:126`)가 **동일한
    가드를 자체적으로 한 번 더** 갖고 있어(`value === null || typeof value !== 'object' ||
    Array.isArray(value)`) 최종 관측 가능한 동작이 바뀌지 않는 **동치 뮤턴트**로 확인된다
    (수동 추적: `undefined`/`null`/문자열 세 값 모두 최종적으로 `narrowed === value` 라
    `envelope` 원본을 그대로 반환). 그래서 뮤테이션 커버리지 관점에서는 급한 갭이 아니고,
    문서화-대-pin 관점의 사소한 갭이다.
  - 제안: 조치 불요 — 다음에 이 헬퍼를 만질 때 `it.each([null, 'a string', 42])` 형태로 한
    번 명시적으로 pin 해 두면 향후 sister 가드가 없어져도(리팩터로 중복 제거될 수 있음)
    조용히 무너지지 않는다는 정도로만 참고.

- **[INFO]** 신규 캐너리 2건(`output` 경로)이 주제와 무관한 `describe('llmCalls strip — 외부 fanout 수신자 보호', ...)` 블록에 위치 — 기존에 이미 트래커에 등재된 배치 이슈의 연장
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:956`(`[캐너리] execution.node.* 의 envelope.output 도 allowlist 를 지난다`), `:1006`(`[캐너리] execution.node.failed 의 envelope.output 도 allowlist 를 지난다`), `:1049`(`[잔여 고정] flat 폴백 …`) — 모두 604행에서 시작하는 `llmCalls strip` describe 안
  - 상세: 이 표면을 다루는 전용 `describe`(*"fanout `nodeOutput` 은 fail-closed allowlist 다"*)가
    별도로 751행에 이미 있는데, 이번 diff 가 추가한 `output` 경로 캐너리 3건은 여전히
    `llmCalls strip` 블록 안에 있다. `plan/complete/sse-nodeoutput-allowlist.md` 가 이전
    라운드에 이미 이 배치 문제를 트래커에 등재해 뒀고(testing 14 + 12), 이번 PR 이 그 잘못된
    위치에 신규 테스트를 3건 더 추가해 이동 대상을 늘렸다. `maintainability.md`(같은 세션)가
    이미 이 항목을 지적했으므로 중복 조치는 불요 — 테스트 가독성 관점에서 동일 관찰만 기록.
  - 제안: 트래커의 기존 describe 재배치 항목 처리 시 이번에 늘어난 3건도 함께 옮길 것.

## 양호한 점 (근거로 기록)

- **테스트 존재·커버리지**: `envelope.output` allowlist 배선(신규 chokepoint 경로)에 대해
  (a) `NODE_COMPLETED` 직접 캐너리(`_retryState`/미지 필드 제거 + 렌더 필드 보존 대조군 +
  내부 WS 불변 대조군), (b) `NODE_FAILED` 방향 직접 캐너리(형제 필드 `error` 보존 확인
  포함), (c) chat-channel 4키(`rendered`/`payload`/`title`/`nodeType`) 보존 `it.each`,
  (d) flat 폴백 shape 잔여 위험 고정 캐너리까지 — 새 코드 경로의 정상/보존/보안(fail-closed)
  세 축을 전부 커버한다.
- **뮤테이션 검증이 실제로 수행·기록됨**: `plan/in-progress/node-output-envelope.md` 의 M1~M3
  표가 예측을 실행 전에 적고 실측과 대조하는 이 저장소의 관례를 따랐고, M2 예측 실패
  사례(*"보존 단언은 배선 제거를 못 잡는 단방향 가드"*)를 은폐하지 않고 원인까지 분석해
  적어 뒀다 — 직접 재현(M1)으로 이 표의 핵심 결론(뮤턴트가 잡힌다)이 여전히 유효함을 확인.
- **회귀 계약 이행**: 이전 라운드가 `[잔여] execution.node.* 의 envelope.output 은 아직
  allowlist 를 지나지 않는다` 테스트에 "닫히면 이 단언을 뒤집는 것이 그 작업의 일부"라고
  JSDoc 계약을 남겨 뒀고, 이번 diff 가 그 단언(`_retryState` 존재 → 부재)을 정확히 뒤집어
  `[캐너리] … 도 allowlist 를 지난다` 로 교체했다 — 계약 이행이 정확하다.
- **Mock 적절성**: `gateway`(`{ broadcastToChannel: jest.fn() }`)는 실제로 소비되는 메서드
  하나만 스텁한 최소 mock 이고, `makeFakeAllocator()`는 실 Redis `INCR`/release 의미를
  in-memory `Map` 으로 결정적으로 재현하며 "실 분산 발급·degraded fallback 은 별도 스펙
  파일이 커버"라고 경계를 문서화해 뒀다 — 과도한 mock 이나 실제 동작과의 괴리 없음.
- **테스트 격리**: `beforeEach` 가 매 테스트마다 `gateway`/`service`(신규 인스턴스,
  독립 `Subject`)를 새로 만들고, 신규 테스트들도 각각 고유한 `executionId`
  (`exec-node-failed-allowlist`, `exec-node-output-flat` 등)를 써서 seq 카운터·라우팅
  컨텍스트가 테스트 간에 섞일 수 없다.
- **가독성**: 각 신규 테스트의 JSDoc 이 "왜 이 테스트가 필요한가"(예: *"논리적으로는
  보장되지만 직접 증거는 아니다"*, *"문서한 보장이 구현보다 넓지 않게"*)를 서술해 의도가
  명확하다 — 단순 스냅샷이 아니라 무엇을 왜 고정하는지 근거가 있는 캐너리다.
- **실행 검증**: 현재 diff 상태에서 전체 스펙 파일을 직접 실행 — `Test Suites: 1 passed`,
  `Tests: 63 passed, 63 total`. 프롬프트/plan 문서가 주장하는 "GREEN" 상태가 실측과 일치한다.

## 요약

이 PR 의 테스트 변경은 신규 보안 경계(`envelope.output` fail-closed allowlist)를 정상 경로·
보존 대조군·`NODE_FAILED` 방향·잔여 폴백 위험까지 다각도로 커버하고, 뮤테이션 검증을 실제
실행해 예측 실패 사례까지 투명하게 기록했으며, 이전 라운드가 남긴 "닫히면 뒤집어라" 캐너리
계약도 정확히 이행했다 — 이 저장소의 테스트 위생 기준에서 상위권이다. 직접 실행으로 63개
전체 GREEN 을 재확인했고, M1 뮤턴트도 재현해 여전히 캐치됨을 확인했다. 남은 갭은 전부
INFO 수준이다: 뮤테이션 검증표의 기록된 카운트가 이후 커밋의 테스트 증가로 stale 해졌다는
점(결론은 유효, 숫자만 낡음), `output`/`nodeOutput` null·비객체 분기를 새 경로에 대해 직접
pin 하는 테스트가 없다는 점(sister 가드로 사실상 동치 뮤턴트라 위험 낮음), 신규 캐너리 3건이
기존에 이미 트래커에 등재된 describe 배치 문제를 답습했다는 점(조치는 그 트래커 항목 처리
시 일괄). 블로킹할 결함은 없다.

## 위험도

LOW
