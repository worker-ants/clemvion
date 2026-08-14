# 요구사항(Requirement) 충족 리뷰 — `llmCalls` 깊이-무관 strip 하드닝 (RESOLUTION 반영본 재검증)

이 changeset 은 이전 라운드(`10_32_27` ai-review + `10_32_29` consistency)의 CRITICAL 0 / WARNING 9
에 대한 `RESOLUTION.md` 조치 결과물이다. 본 리뷰는 그 조치가 실제로 요구사항을 충족했는지
소스를 직접 열어 라인 단위로 재검증했다 (diff 인용이 아니라 `Read`/`Bash grep` 으로 현재 파일
상태를 확인).

## 발견사항

- **[INFO]** `stripDeep` 의 깊이 상한 비교연산자(`depth >= MAX_SANITIZE_DEPTH`)가 형제 함수
  `sanitizePayloadForWs`(`depth > MAX_SANITIZE_DEPTH`)와 다른데, 직접 추적한 결과 **버그가
  아니라 올바르게 보정된 설계**임을 확인했다 — 향후 리뷰어가 다시 "비대칭 결함"으로 오인하지
  않도록 근거를 기록해 둔다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387`(`stripDeep` 의
    `if (depth >= MAX_SANITIZE_DEPTH) return value;`) vs `:251`(`sanitizePayloadForWs` 의
    `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`)
  - 상세: `stripDeep(V, d)` 는 **자기 자신의 깊이 `d`** 에서 own-key 검사 여부를 결정하고,
    `sanitizePayloadForWs` 는 **자식의 깊이 `d+1`** 에서 redact 여부를 결정한다 — 검사 시점이
    한 단계 어긋나 있다. 수치로 대입해 확인: `V` 가 `depth=10`(=`MAX_SANITIZE_DEPTH`)일 때
    `stripDeep(V, 10)` 은 `10 >= 10` 이 참이라 `V` 의 own key(`llmCalls` 포함)를 전혀 보지
    않고 그대로 반환한다. 그런데 같은 `V` 를 만든 `sanitizePayloadForWs(V, 10)` 은
    `10 > 10` 이 거짓이라 `V` 의 own key 는 정상 처리하지만, 그 값(`V.llmCalls`)을
    `sanitizePayloadForWs(V.llmCalls, 11)` 로 재귀할 때는 `11 > 10` 이 참이 되어 **그 값
    전체를 `'[REDACTED_DEPTH]'` 문자열로 이미 대체**해 둔 상태다. 즉 `stripDeep` 이 own-key
    검사를 건너뛰는 정확히 그 깊이(`d >= 10`)에서는, `sanitizePayloadForWs` 가 **이미 그
    자식 값을 안전한 문자열로 치환**해 놓은 뒤라 실제 raw `requestPayload`/`responsePayload`
    가 남아있을 수 없다 — `d < 10` 구간에서는 반대로 `stripDeep` 이 own-key 를 정상 검사해
    `llmCalls` 키 자체를 삭제한다. 두 경계가 정확히 맞물려 "깊이 무관 strip" 이 실제로
    성립한다. JSDoc(`:362-364`, "상한 초과 서브트리는 이미 `sanitizePayloadForWs` 가
    `[REDACTED_DEPTH]` 로 마스킹한 뒤다")의 주장은 **정확하다** — 이전 라운드(`10_32_27`)
    performance/side_effect/security 리뷰가 지적한 "형제 함수와 깊이 가드 방식이 다르다"는
    관찰은 사실이지만 그 자체는 결함이 아니다.
  - 제안: 조치 불요. JSDoc 이 이미 근거를 적어두고 있어 유지보수성 관점에서도 충분하다.

## Spec 정합성 재검증

`spec/5-system/6-websocket-protocol.md:519`, `spec/5-system/14-external-interaction-api.md:754`(§6.5),
`spec/5-system/15-chat-channel.md:76`(CCH-MP-01) 세 곳 모두 "`llmCalls` 는 **예외 없이** 모든
외부 fanout 수신자에서 strip 된다"를 선언하며 깊이/조건에 대한 예외를 전혀 언급하지 않는다.
위 depth-boundary 분석에서 확인했듯 현재 구현은 이 무조건 strip 요구를 실제로 만족한다 —
이전 상태(top-level 전용 depth-1 삭제)는 spec 위반이었고(코드가 틀림, spec 이 권위), 이번
`stripDeep` 도입으로 위반이 해소됐다. SPEC-DRIFT 아님.

## RESOLUTION.md 이행 검증 (소스 직접 대조)

`review/code/2026/08/14/10_32_27/RESOLUTION.md` 가 "조치 완료"라고 주장한 항목을 커밋된
소스에서 직접 재확인했다 — 전부 실제로 반영돼 있고, 테스트도 vacuous 하지 않다.

- **W1 (`__proto__` 오염)**: `stripDeep`(`websocket.service.ts:386-420`)이 `out ??= { ...obj }`
  로 스프레드 우선 초기화 후 `Object.defineProperty` 로 대입 — bracket 대입 경로 없음.
  `websocket.service.spec.ts:762-793` 테스트가 `JSON.parse` 로 만든 own `__proto__` 키의
  값 안에 `llmCalls` 를 넣어(위험 분기를 실제로 타도록) `hasOwnProperty`/`Object.getPrototypeOf`
  까지 단언 — 판별력 있는 테스트로 확인.
- **W3 (지연 할당)**: `stripDeep` 이 `out: T | null = null` 로 시작해 변경 시에만 할당 —
  JSDoc 의 "nothing is allocated until a strip actually happens" 주장과 구현 일치
  (`:349-374` object/array 분기 둘 다 확인).
- **W4 (깊이 상한)**: 위 depth-boundary 분석대로 형제 상수 `MAX_SANITIZE_DEPTH` 를 실제로
  적용하고, 경계 정합성도 확인됨.
- **W5 (identity 테스트 강화)**: `websocket.service.spec.ts:744`
  `expect(fanout.payload).toBe(wire)` — 최상위 envelope identity 를 직접 단언.
- **W6 (대조군 누락)**: `websocket.service.spec.ts:712-713`
  `expect(wireJson).toContain('SECRET PROMPT A'/'B')` — 내부 WS 채널이 원본을 보존함을
  같은 테스트 안에서 대조 검증.
- **W7 (테스트 JSDoc 시제)**: `websocket.service.spec.ts:636-654` JSDoc 이 "~했었다"/
  "~였다" 과거형으로 정정됨 — production JSDoc(`:303-317`)의 "종전엔 top-level 전용
  (depth-1)이었고" 서술과 시제 일치.
- **자매 chokepoint 재확인**: `executionEventSubject.next(...)` 호출은
  `emitExecutionEvent`(`:576`)/`emitNodeEvent`(`:647`) 둘뿐 — `grep` 으로 재확인. `emitKbEvent`
  는 이 Subject 를 전혀 타지 않아(WS 전용, 외부 fanout 없음) strip 대상이 아니다. 새는
  자매 경로 없음.
- **plan 문서 동기화**: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의
  "🔴 조사 중 발견 → 처분" 절이 이미 `[x]` 로 갱신돼 있고 "착수 전엔 (b) 가 유력이라
  적었는데 선택이 뒤집혔다"를 명시적으로 기록 — 이전 라운드(scope.md/documentation.md/
  requirement.md)가 지적한 "구현은 (a), 문서는 (b) 선호"라는 불일치가 이번 diff 에서
  실제로 해소됐음을 확인.

## 기능/엣지 케이스/반환값 (재확인)

- 배열·null·비-object·순환(직후 `JSON.stringify` 로 위임) 분기 전부 값을 반환 — 반환 누락 경로 없음.
  배열 clone-on-write 로직(`:389-397`)도 "첫 변경 시점에만 slice, 이후 인덱스는 갱신"이 정확함을
  직접 트레이스로 확인.
- TODO/FIXME/HACK/XXX: `websocket.service.ts`/`websocket.service.spec.ts` diff 범위 내 없음(grep 확인).
- `attachRoutingContext`(`:661-674`)는 strip **이후**에 실행되고 추가 필드(`triggerId`/
  `workflowId`/`chatChannel`)만 shallow merge 하므로 strip 된 `llmCalls` 를 되살릴 경로 없음.

## 요약

핵심 요구사항(WS §4.4/EIA §6.5/CCH-MP-01 이 선언하는 "`llmCalls` 는 예외 없이 모든 외부
fanout 수신자에서 strip 된다")은 이번 `stripDeep` 구현으로 실제 충족되며, 직접 depth-boundary
수치 대입으로 재귀 경계가 서로 정확히 맞물려 있음을 확인했다(형제 함수와의 `>=`/`>` 차이는
결함이 아니라 검사 시점 차이를 보정하는 의도된 설계). 이전 라운드가 지적한 9개 WARNING
(CWE-1321 `__proto__` 오염, 지연 할당 미준수, 깊이 상한 부재, identity 테스트 약함, 대조군
누락, 테스트 시제 오류, plan 문서 stale, CHANGELOG 누락) 은 소스 대조 결과 전부 실제로
반영돼 있고, 새 테스트들은 판별력 있는(뮤테이션에 반응하는) 형태로 확인됐다. 신규 CRITICAL/
WARNING 없음.

## 위험도

NONE
