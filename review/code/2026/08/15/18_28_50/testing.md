# 테스트(Testing) 리뷰 — 종결 emit 타입 파사드 (`eia-terminal-emit-facade`)

## 검증 방법

- 프롬프트 diff 게이트 + `Read`/`Grep`으로 원본 소스(`execution-event-emitter.service.ts`,
  `execution-event-emitter.service.spec.ts`, `retry-turn.service.ts`,
  `retry-turn.service.spec.ts`, `execution-engine.service.spec.ts`)를 직접 열어 대조.
- `execution-event-emitter.service.spec.ts` + `retry-turn.service.spec.ts` 를 직접 실행:
  **2 suites / 54 tests pass** (직전 라운드 `17_54_32/testing.md` 가 기록한 52 test 대비
  +2 — 이번 diff 가 새로 추가한 "판별력(런타임 no-op)" 테스트 1건 + "failed error:null 키
  유지" 테스트 1건과 정확히 일치).
- `execution-engine.service.spec.ts` 를 직접 실행(파일 4의 8개 호출부 변경에 대응하는
  spec 수정이 diff 에 없어 별도 확인 필요): **1 suite / 454 tests pass**, 무변경.
- `scripts/check-backend-typecheck-ratchet.py` 와 `scripts/backend-typecheck-baseline.json`
  을 직접 읽어, 신규 `@ts-expect-error` 판별력 테스트가 의존한다고 주석에 적은 "199" 라는
  수치가 실제 baseline(`total: 199`)과 일치함을 확인. 이 ratchet 은 `tsc --noEmit -p
  tsconfig.json`(`*.spec.ts` 포함, `nest build` 의 `tsconfig.build.json` 과 달리 exclude
  하지 않음)을 돌리고 `.github/workflows/backend-checks.yml` 의 `typecheck` 스텝으로
  CI 에 결선돼 있다 — "jest 는 no-op 이고 실제 가드는 tsc 래칫" 이라는 테스트 파일의 주석
  주장이 사실임을 코드로 재확인.

## 발견사항

- **[INFO]** `retry-turn.service.spec.ts` 의 `mockEventEmitter.emitExecution` 이 이번 diff
  이후로는 어떤 테스트에서도 호출·단언되지 않는 죽은 mock 이다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:105`
    (`emitExecution: jest.fn().mockResolvedValue(undefined),`)
  - 상세: 이번 diff 로 `retry-turn.service.ts` 는 `eventEmitter.emitExecution` 을 직접
    호출하는 자리가 전부 사라졌다(`emitTerminalExecution` 4곳 + `emitNode` 1곳만 남음,
    실측: `grep -n "eventEmitter\.\(emitExecution\|emitTerminalExecution\|emitNode\)"` 결과
    `emitExecution` 직접 호출 0건). 그런데 `beforeEach` 의 `mockEventEmitter` 객체는 여전히
    `emitExecution` 필드를 만들고, 파일 전체에서 `mockEventEmitter.emitExecution` 을
    참조하는 단언은 0건이다(재확인: grep 결과 없음). 테스트 실패나 오탐을 유발하진
    않지만(정의만 되고 안 쓰이는 필드), 향후 이 파일을 유지보수하는 사람이 "이 mock 이
    아직 쓰이나?" 를 판단하기 어렵게 만드는 잔재다.
  - 제안: `emitExecution` mock 필드를 제거하거나(가장 깔끔), 남긴다면 그 이유(예: 다른
    미변경 테스트가 암묵적으로 `ExecutionEventEmitter` 의 전체 인터페이스를 흉내내야 해서)
    를 주석으로 남긴다.

- **[INFO]** `TerminalEventPayload` 의 `cancelled` variant 조합 중 일부(예:
  `durationMs: null` + `cancelledBy`, 또는 `cancelledBy: 'system'`)가 emitter spec 의
  wire-형태 테스트에서 검증되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts`
    (`describe('emitTerminalExecution — 종결 payload wire 형태'` 블록 — `cancelled` 은
    `'timeout'`/`durationMs: 7200000`, `'user'`/`durationMs: 100` 두 조합만 커버)
  - 상세: `emitTerminalExecution` 의 wire 조립 로직(`wire.result = { cancelledBy:
    payload.cancelledBy }`, `if (payload.error) wire.error = payload.error`)이 `cancelledBy`
    값이나 `durationMs` 의 null 여부에 따라 분기하지 않으므로 실질적 위험은 낮다 — 이미
    커버된 두 케이스가 "error 동행"·"error 부재" 두 축을 모두 짚고 있다. 그래도 `'system'`
    값 자체(닫힌 3값 union 의 세 번째 리터럴)와 `cancelled`+`durationMs: null` 조합은
    문자 그대로는 아직 아무 테스트에도 등장하지 않는다.
  - 제안: 급하지 않음(로직이 값에 분기하지 않아 실질 회귀 위험 낮음) — 여유가 있으면
    `cancelledBy: 'system'` 케이스 하나를 추가해 3값 union 전체를 wire 레벨에서 최소 1회씩
    실측하면 향후 이 union 이 넓어질 때(예: 새 취소 사유 추가) 회귀 신호가 더 촘촘해진다.

## 강점 (이전 라운드 지적의 해소 확인)

- 직전 라운드(`review/code/2026/08/15/17_54_32/testing.md`)의 **WARNING**(판별 union 의
  "컴파일 타임에 필수 필드를 강제한다"는 핵심 가치를 지키는 영구 회귀 테스트 부재)이
  이번 diff 의 `describe('TerminalEventPayload — 필수 필드가 컴파일을 막는다', ...)` 로
  해소됐다. 특히 테스트 자신의 주석이 "ts-jest 가 타입체크한다" 는 최초 가정이 뮤테이션으로
  반증됐음을 정직하게 기록하고("`cancelledBy` 를 optional 로 완화해도 jest 는 9/9
  GREEN"), 실제 강제 주체가 `tsc` 래칫임을 명시한 점이 이 저장소가 과거 반복적으로 겪은
  "타입 가드·새 테스트가 실제로 실행·타입체크되는지 확인 안 함" 결함 클래스를 정확히
  피해간다. 위 검증 방법에서 이 주장을 baseline JSON·CI 워크플로 대조로 독립 재확인했다.
- 직전 라운드의 **INFO**(`failed` variant 의 `error: null` 경로 미검증)도 신규
  `it('failed — error 가 null 이어도 **키는 유지**한다 …')` 테스트로 해소됐다 — `'error' in
  wire'` 로 조건부 대입 리팩터 회귀까지 대비한다.
- 직전 라운드의 **WARNING**(`TYPE_TO_EVENT` 매핑이 `retry-turn.service.spec.ts` 두
  `describe` 에 중복)도 파일 상단 모듈 스코프 단일 선언으로 해소됐다(실측:
  `grep -n "TYPE_TO_EVENT"` 결과 정의 1곳, 사용 2곳).
- `execution-engine.service.ts` 의 8개 호출부 변경에 대응하는 `.spec.ts` 수정이 diff 에
  없는 것은 갭이 아니라 의도된 설계다 — 기존 테스트들이 `emitTerminalExecution` 의
  내부 위임 지점(`eventEmitter.emitExecution`)이나 그보다 더 바깥 경계
  (`mockWebsocketService.emitExecutionEvent`)를 스파이하고 있어, 이번 리팩터가 그 경계
  안쪽 구현만 바꿨다면 테스트 수정 없이도 실제로 파손을 잡는다 — 직접 실행으로 454/454
  GREEN 확인. `applyCancellation` 케이스(`execution-engine.service.spec.ts:3296`)는
  `cancelledBy:'user'` 리터럴 + `error` 키 부재까지 정확 매칭(`toHaveBeenCalledWith`)으로
  잠그고 있어 안정적인 경계 테스트의 좋은 예다.
- `execution-event-emitter.service.spec.ts` 신규 4개 wire-형태 테스트는
  `toHaveBeenCalledWith` 가 `{error: undefined}` 도 통과시키는 함정을 `Object.keys(wire)`/
  `'error' in wire` 직접 단언으로 피해, 이 저장소가 과거 반복적으로 겪은 "제3상태에서
  참이 되는 vacuous assertion" 패턴을 정확히 회피한다.
- `retry-turn.service.spec.ts` 는 `failRetryExecution` 의 `isCancelled`/`!isCancelled`
  두 갈래(이번 diff 가 삼항에서 if/else 로 편 지점)를 각각 독립 테스트로 커버한다
  (`cancelledBy:'user'` 갈래 — 게이트 705-717, `error: toTerminalErrorPayload(...)` 갈래 —
  게이트 739-751 부근). 두 분기 모두 실행 검증됨.

## 요약

이번 diff 는 직전 ai-review 라운드(`17_54_32`)의 testing WARNING 1건·INFO 2건을 전부
코드로 해소했고, 그 해소를 실제 테스트 실행(54/54, 454/454)과 타입 래칫 baseline 대조로
독립 재확인해도 주장과 실측이 일치한다. `execution-engine.service.ts` 의 8개 호출부 변경에
전용 spec 수정이 없는 것은 갭이 아니라 "안정적 내부 경계를 스파이"하는 기존 테스트 설계
덕분이며, 실행으로 그 안전성을 확인했다. 남은 갭은 전부 INFO 수준이다 — (1)
`retry-turn.service.spec.ts` 의 `emitExecution` mock 필드가 이번 마이그레이션으로 완전히
죽은 코드가 됐고(호출·단언 0건), (2) `cancelled` variant 의 `'system'`/`durationMs: null`
조합이 wire-형태 테스트에 문자 그대로는 등장하지 않는다(로직이 값에 분기하지 않아 실질
위험은 낮음). Critical/Warning 급 결함은 없다.

## 위험도

LOW
