# 요구사항(Requirement) 코드 리뷰

## 리뷰 범위

이 diff(누적, `origin/main` 대비)의 실질 코드 변경은 4개 파일이다 — `terminal-error-payload.ts`
(egress 마스킹 헬퍼 `redactTerminalError` 신설 + 4개 반환 경로 배선), `terminal-error-payload.spec.ts`
(회귀/음성 테스트), `sanitize-error-message.ts`(execution-engine, docstring 정정만), `CHANGELOG.md`.
나머지는 `plan/**`(추적 문서)와 `review/**`(이전 4개 리뷰 라운드 `09_51_00`/`10_19_30`/`10_41_55`/
`11_04_07` + 2개 consistency-check 라운드의 산출물)로, 이 세션 자체가 이미 4라운드의 `/ai-review`
(Critical 0 고정)를 거친 상태다. 본 라운드는 그 누적 결론을 독립적으로 재검증하는 데 집중했다 —
소스를 직접 `Read`하고, JSDoc/plan/CHANGELOG 의 정량 주장(호출부 수·spec 절 번호·마스킹 대상)을
`grep`/spec 원문 대조로 재확인했다.

## 실측 검증 (직접 확인)

- `toTerminalErrorPayload` 4개 반환 분기(string/scalar/non-object/object) **전부**가
  `redactTerminalError(...)` 를 거친다 — `terminal-error-payload.ts:130,139-143,148,160` 직접 대조.
- `redactTerminalError` 는 `message`(항상 마스킹)·`details`(optional-key 관용구 보존, `undefined`
  일 때만 키 생략)만 건드리고 `code`/`nodeId` 는 spread 로 그대로 통과 — 소스 확인.
  `deepRedactSecrets(null)` 은 `null` 을 그대로 반환하므로(`sanitize-error-message.ts:133`)
  `details: null` 명시 케이스(spec.ts:200-204)도 키 보존 + 값 불변으로 정확히 맞는다.
- `toTerminalErrorPayload(...)` 호출부 **5곳** 주장 — `grep` 으로 정확히 5곳 확인
  (`chat-channel.dispatcher.ts:551`, `retry-turn.service.ts:1001`,
  `execution-engine.service.ts:668/3400/5030`). DB write 는 0 — emit 전용이라는 JSDoc 의
  구조적 안전성 논거가 맞다.
- `sanitizeErrorMessage(...)` 호출부 **3곳** 주장(execution-engine.service/schedule-runner.service/
  background-execution.processor, 전부 `channel: in_app/email`) — `grep` 으로 확인. WS 도 싣는다는
  캐비엇(`background-execution.processor`)도 `emitBackgroundRunEvent` → `background:run:<id>`
  채널(`websocket.service.ts:383`, SSE/webhook 미도달)로 실측 확인 — 종결 3종의 외부 노출과
  다른 표면이라는 주장이 정확하다.
- CHANGELOG/plan 의 "EIA outbound webhook §3.1(EIA-NX-02)" 인용 — `spec/5-system/
  14-external-interaction-api.md:54-59` 대조, 정확하다(§3.3 은 인증 절이라 무관 — 이전 라운드가
  잡은 오표기가 실제로 정정돼 있음을 재확인).
- 취소 이벤트(`emitCancellationEvent` 5곳)가 여전히 raw 예외 메시지를 안 쓴다는 JSDoc 의 안전
  경계 주장 — `markExecutionCancelled`/`markQueueWaitTimeout`/`resumeErrorMessage` 등 실제 호출부를
  직접 열어 확인: 전부 고정 문자열 또는 닫힌 code enum 에서 파생된 문자열이다. raw
  `err.message` 를 쓰는 유일한 인접 코드(`execution-engine.service.ts:7995`)는 컨테이너 노드
  레벨(`NodeExecution.error`, `execution.node.*` 이벤트)이라 plan 의 "범위 밖" 절이 이미 명시적으로
  제외한 별개 표면이다 — 스코프 경계가 실제 코드와 일치한다.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` 신설된 `Execution.error.message`/`details` 값-패턴 마스킹이
  `spec/5-system/14-external-interaction-api.md` 의 §6.4 필드 표와 R17 "표면 제약(보안)" 마스킹
  카탈로그에 아직 반영되지 않았다
  - 위치(spec, 갱신 필요): `spec/5-system/14-external-interaction-api.md:770-789`(§6.4
    `execution.failed` 페이로드, `error.message`/`error.details` 필드 정의에 마스킹 캐비엇 없음),
    `:1414-1457`(R17 "표면 제약(보안)" — 현재 4개 불릿: `conversationThread`·`ai_message`·
    `nodeOutput.conversationConfig`+terminal `result`/`error`·`nodeOutput` 일반 키. 이번에 새로
    강제된 `Execution.error`→wire `error.message`/`details` 마스킹이 5번째 항목으로 없음)
  - 위치(코드, 이번 diff): `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수
    `redactTerminalError`(전체) — spec 이 아직 모르는 새 보안 불변식을 코드가 구현하고 있다
  - 상세: R17 카탈로그 3번째 불릿("`nodeOutput.conversationConfig` + terminal `result`/`error`")은
    이름이 비슷해 이번 변경을 이미 포괄하는 것처럼 보이지만, 직접 대조하면 **다른 컬럼**이다 —
    그 불릿이 가리키는 `getStatus` 의 `error` 필드는 `stripAndRedact(execution.outputData)`
    (`codebase/backend/src/modules/external-interaction/interaction.service.ts:454`, 직접 확인)이지
    이번 PR 이 마스킹하는 `Execution.error`(WS/SSE/webhook `execution.failed` 의 `error`)가 아니다.
    즉 코드가 새로 강제하는 보안 불변식이 spec 카탈로그에 **완전히 빠져 있다** — spec 이 이 마스킹의
    존재를 몰라, 외부 통합사가 §6.4 만 읽으면 "값이 마스킹될 수 있다"는 사실(⚠️ wire 바이트 변화)을
    알 수 없다. 이는 코드가 틀린 것이 아니라(마스킹 도입은 명백히 합리적인 보안 하드닝) spec 갱신이
    아직 못 따라온 경우다.
  - 판정 근거: 이 PR 은 `developer` 권한(spec/ read-only)이라 spec 을 직접 고칠 수 없고, 실제로
    `spec/**` 은 이번 diff 에서 0줄 변경됐다(`git diff origin/main --stat -- spec/` 로 확인). 대신
    `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 절에 "planner 턴 — R17 5번째 항목 등재
    + §6.4 필드 표 캐비엇"으로 명시적으로 등재돼 있고 미체크(`[ ]`) 상태로 정직하게 남아 있다 —
    이 PR 을 막을 사유가 아니라 project-planner 로 넘겨야 할 다음 조치다.
  - 제안: 코드 변경 불요. `project-planner` 세션에서 §6.4 필드 표에 "`message`/`details` 는
    egress 시점 `deepRedactSecrets` 마스킹을 거친다(자격증명 패턴만, §R17)" 캐비엇을 추가하고,
    R17 카탈로그에 5번째 불릿("`Execution.error` → 종결 emit(WS/SSE/webhook) `error.message`/
    `details`: `toTerminalErrorPayload`(`redactTerminalError`)가 값-패턴 마스킹")을 등재.

- **[INFO]** 잔여 갭(자격증명 없는 연결 문자열·내부 호스트명은 마스킹 통과)이 의도적으로 문서화·
  테스트로 캐너리 고정돼 있다
  - 위치: `terminal-error-payload.ts:82-89`(실측표) / `terminal-error-payload.spec.ts:211-217`
    (캐너리 테스트) / `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(잔여 항목 등재)
  - 상세: 무수정 프로브(`postgres://db.internal:5432/prod` → 무변화)로 실제 갭을 확인했고, 넓히지
    않은 근거(shared SoT 승격 시 다른 소비자 blast radius)도 타당하며 후속 티켓으로 분리돼 있다.
    범위를 스스로 좁혀 적은 것은 이 저장소가 반복 겪은 "주장이 구현보다 넓다" 실패 형태를 피한
    모범 사례다.
  - 제안: 조치 불요 — 확인 기록.

## 확인한 항목 (문제 없음, 요구사항 관점)

- **기능 완전성**: `Execution.error` 를 소비하는 emit 경로 5곳 전부가 단일 초크포인트를 거치도록
  구조적으로 강제됐다 — 새 종결 emit 경로가 추가돼도 이 함수를 거치지 않으면 §6.4 형태 자체를
  못 얻으므로 마스킹이 빠질 수 없다.
- **엣지 케이스**: `null`/`undefined`(빈 객체 아님, `null` 반환), 빈 문자열 message, `details`
  명시적 `null` vs `undefined`(키 생략) 구분, JSON 형태 message 의 재직렬화-후-파싱 가능성,
  레거시 string/스칼라(number/boolean/bigint) 입력 — 전부 테스트로 고정돼 있고 소스 대조로 정확함을
  확인했다.
- **TODO/FIXME/HACK/XXX**: 변경된 6개 소스/문서 파일 전수 grep 결과 0건.
- **의도와 구현 간 괴리**: 함수명(`redactTerminalError`)·JSDoc 의 정량 주장(호출부 수·채널 이름·
  spec 절 번호)을 모두 실제 코드/spec 원문과 대조해 정확함을 확인했다 — 이 세션이 4라운드에 걸쳐
  반복 지적됐던 "주장이 구현보다 넓다" 패턴이 이번 라운드에서는 재발하지 않았다.
- **에러 시나리오**: 정상 흐름 외에 별도 예외 경로 없음(순수 함수, throw 없음) — 함수 자체가
  실패할 수 없는 형태로 설계돼 있어 에러 처리 누락 우려가 없다.
- **데이터 유효성**: `Execution.error` 가 `Record<string, unknown>`(타입 미보장)이라는 전제 하에
  `code`/`message`/`nodeId` 각 필드의 `typeof` 가드가 전부 테스트로 고정돼 있다.
- **비즈니스 로직**: EIA §R17 egress-only masking 원칙(DB 는 원문 보존, egress 시점만 마스킹)이
  코드에 정확히 반영됐다 — DB write 경로는 diff 에 없고 emit 경로에만 마스킹이 걸린다.
- **반환값**: `toTerminalErrorPayload` 의 모든 코드 경로가 `TerminalErrorPayload | null` 을
  반환한다 — 누락 경로 없음(소스 전체 대조).

## 요약

핵심 변경(`toTerminalErrorPayload` 의 4개 반환 경로 전부에 `redactTerminalError` egress 마스킹
적용)은 의도한 보안 하드닝을 완전하게 구현하고 있고, 이미 4라운드의 `/ai-review`(Critical 0
고정)를 거치며 실제 결함(마스킹 범위 과장, 공허한 테스트)은 1라운드에서 해소됐다. 본 라운드가
소스·spec 원문·grep 실측으로 독립 재검증한 결과 JSDoc/CHANGELOG/plan 의 모든 정량 주장(호출부
수·채널 격리·spec 절 번호)이 정확했고, 새로운 요구사항 결함은 발견되지 않았다. 유일하게 남은
항목은 이 마스킹이 spec `§6.4`/`R17` 카탈로그에 아직 반영되지 않은 **SPEC-DRIFT**로, R17 3번째
불릿이 다른 컬럼(`getStatus` 의 `outputData` 기반 `error`)을 가리킨다는 것까지 소스 대조로
확인해 진짜 공백임을 확인했다. 다만 이는 developer 권한 밖(`spec/` read-only)이라 이번 PR 을
막을 사유가 아니고, `plan/in-progress/eia-terminal-error-sanitize.md` 에 project-planner 후속
항목으로 이미 정확히 등재돼 있다.

## 위험도

LOW
