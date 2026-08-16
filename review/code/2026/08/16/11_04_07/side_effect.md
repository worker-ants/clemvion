# 부작용(Side Effect) 리뷰

## 리뷰 범위 및 방법

이 changeset(`origin/main...HEAD`, 56 파일)의 실질 런타임 코드는 3개 파일뿐이다 —
`codebase/backend/src/shared/utils/terminal-error-payload.ts`(로직 변경),
`codebase/backend/src/shared/utils/terminal-error-payload.spec.ts`(테스트),
`codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`(docstring 전용,
`git diff origin/main...HEAD -- <path>` 로 로직 diff 0줄 직접 확인). 나머지는
`CHANGELOG.md`·`plan/**`·`review/**` 문서 산출물이다.

이 관점은 같은 브랜치에서 이미 3라운드(`09_51_00`→`10_19_30`→`10_41_55`) 검토돼 Critical 0,
Warning 은 전부 반영·수렴했다고 기록돼 있다(`review/code/2026/08/16/10_41_55/RESOLUTION.md`:
"3라운드 만에 발견의 성격이 실제 결함 → 주석/문서 미세 비대칭 + spec 미러로 내려왔다. 여기서
`codebase/**` 편집을 멈춘다"). `git diff 7badf0318..HEAD --stat` 로 마지막 코드 라운드
이후 델타를 대조하면 `terminal-error-payload.spec.ts` 에 주석 3줄 추가와 plan 문서 문장
완결뿐이고 런타임 로직은 무변경이다. 아래는 그 주장을 그대로 받지 않고 핵심 파일
(`terminal-error-payload.ts` 전문, 5개 호출부)을 직접 열어 독립적으로 재검증한 결과다.

## 발견사항

- **[INFO]** 종결 이벤트 `error.message`/`error.details` 의 **wire 바이트가 바뀐다** — 의도된
  변경이지만 side-effect 관점에서 "출력 변경"이라는 점 자체는 기록해 둔다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `redactTerminalError`(107행 정의) 및 이를 호출하는 `toTerminalErrorPayload` 의 4개 반환 지점(130행, 139행, 148행, 160행)
  - 상세: `toTerminalErrorPayload` 는 `TerminalErrorPayload | null` 시그니처와 `TerminalErrorPayload` 인터페이스(40-45행)를 그대로 유지하지만, 반환되는 **값**은 이제 `message`/`details` 에 `deepRedactSecrets` 를 거친다. 이 값은 5개 호출부(`execution-engine.service.ts:668,3400,5030` · `retry-turn.service.ts:1001` · `chat-channel.dispatcher.ts:551`, grep 으로 직접 재확인)를 거쳐 WS/SSE/outbound webhook 으로 외부 제3자에게 나가므로, 문자열 동등 비교에 의존하던 수신자가 있다면 관측 가능한 동작 변화다. CHANGELOG.md 신규 항목(`## Unreleased — 종결 이벤트 error 가...`)이 이 영향을 "수신자 영향" 절로 명시적으로 문서화했고, `code`/`nodeId` 는 값 공간이 닫혀 있어 건드리지 않는다는 것도 코드로 확인된다(`redactTerminalError` 는 `...p` spread 후 `message`/`details` 두 키만 재할당). 결함이 아니라 이 PR 의 목적 그 자체(보안 하드닝)이므로 INFO 로만 기록.
  - 제안: 조치 불요 — 이미 CHANGELOG·plan 에 캐비엇 포함 문서화됨.

- **[INFO]** `deepRedactSecrets` 의 module-level `WeakMap` 캐시(`DEEP_REDACT_CACHE`)에 새 소비자(`details`)가 추가되지만, 새 전역 상태 도입은 아니고 기존 안전 설계(WeakMap identity 캐시)를 재사용할 뿐이다
  - 위치: 캐시 정의는 `codebase/backend/src/shared/utils/sanitize-error-message.ts:107`(이번 diff 밖, 기존 코드) — 신규 호출은 `codebase/backend/src/shared/utils/terminal-error-payload.ts:107-115`(`redactTerminalError` → `deepRedactSecrets(p.details)`)
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/shared/utils/sanitize-error-message.ts` 자체는 존재하지 않음(이 파일은 이번 diff 의 리뷰 대상이 아님) — `DEEP_REDACT_CACHE` 는 이미 conversation-thread 등 다른 소비자가 쓰던 기존 전역이다. 각 emit 지점이 매번 새 `details` 객체 리터럴을 만들어 넘기므로(예: `finalizeFailedExecution` 의 `{ message, ... }`), 캐시가 stale 값을 재사용할 실질 위험은 낮다. `WeakMap` 이라 GC 도 안전.
  - 제안: 조치 불요. 향후 `Execution.error` 객체가 in-place mutation 후 재전달되는 경로가 생기면 이 캐시의 identity 기반 재사용이 stale 마스킹 결과를 낼 수 있다는 점만 유의(이미 이전 라운드 기록과 동일).

## 확인한 안전한 설계 (직접 재검증)

- **시그니처/인터페이스 불변**: `export function toTerminalErrorPayload(err: unknown): TerminalErrorPayload | null` 파라미터·반환 타입, `TerminalErrorPayload` 인터페이스(`code`/`message`/`nodeId`/`details?`) 모두 diff 전후 동일. 호출부 재컴파일 불필요.
- **mutation 없음**: `redactTerminalError`(107-115행)는 `{ ...p, message: ..., ...(...) }` 로 항상 새 객체를 반환하고 입력 `p` 를 in-place 수정하지 않는다. `deepRedactSecrets`/`deepRedactObject`(diff 밖, `sanitize-error-message.ts`)는 copy-on-change 라 변경 없는 서브트리는 원본 참조를 그대로 반환 — `terminal-error-payload.spec.ts` 의 "마스킹할 게 없으면 details 참조를 보존한다" 테스트가 회귀를 고정한다.
- **DB write 없음**: 5개 호출부 모두 `emitTerminalExecution(...)`/이벤트 payload 조립 인자로만 쓰이고 직전 문맥에 `UPDATE`/`save`/`repo.update` 가 없다. `Execution.error` DB 원본은 마스킹 이전 값 그대로 남는다(EIA §R17 egress-only 원칙과 일치).
- **환경 변수·네트워크 호출 없음**: `terminal-error-payload.ts`·`sanitize-error-message.ts`(execution-engine) 어디에도 `process.env` 읽기/쓰기, `fetch`/`http` 호출 없음.
- **이벤트/콜백 로직 자체는 무변경**: `emitTerminalExecution` 의 라우팅·타이밍·채널 결정 로직은 이번 diff 대상이 아니다 — 바뀌는 것은 emit 되는 `payload.error` 의 **값**뿐이다.
- **순환 참조 없음**: `sanitize-error-message.ts`(shared/utils) 를 직접 열어 import 문이 0개임을 재확인 — `terminal-error-payload.ts:1-2` 의 신규 import 주석 주장과 일치.
- **`sanitize-error-message.ts`(execution-engine) 는 docstring 전용**: `git diff` 로 로직 라인 변경 0줄 확인 — 함수 시그니처·정규식·호출부 전부 무변경.
- **파일시스템 부작용**: `plan/`·`review/**` 신규 파일은 developer/consistency-checker 의 명시된 쓰기 권한 범위(`plan/**`, `review/**/RESOLUTION.md`, consistency-checker 의 `review/consistency/**`) 안이고, 다수는 이전 라운드가 이미 산출한 리뷰 아티팩트를 이번 커밋에 포함시킨 것 — 의도치 않은 파일 생성이 아니다.

## 요약

핵심 런타임 변경은 `toTerminalErrorPayload` 의 4개 반환 지점 전부에 `redactTerminalError` 헬퍼(신규, 순수 함수, mutation 없음)를 통과시켜 `message`/`details` 의 secret 패턴을 마스킹하는 것이다. 시그니처·인터페이스는 불변이고, 마스킹은 항상 새 객체를 반환하며(입력 mutate 없음), DB write·환경변수·네트워크 호출·이벤트 발행 타이밍 변경이 전혀 없다. 유일하게 실질적인 "부작용"은 이 PR 이 의도한 것 그 자체 — 종결 이벤트 `error.message`/`error.details` 의 wire 바이트가 5개 호출부(WS/SSE/webhook + chat-channel 재정규화 1곳)를 거쳐 외부 제3자에게 나가는 값이 바뀐다는 점이며, 이는 CHANGELOG·plan 에 이미 "수신자 영향" 캐비엇과 함께 명시적으로 문서화돼 있다. 이 관점은 이미 3라운드에 걸쳐 독립적으로 검토돼 Critical 0으로 수렴했고, 이번 라운드에서 핵심 파일을 직접 재검토해도 새로운 Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
