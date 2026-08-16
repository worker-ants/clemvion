# 부작용(Side Effect) 리뷰

## 리뷰 범위 및 방법

이 changeset(`origin/main...HEAD`, 67 파일)에서 런타임 코드는 여전히 3개 파일뿐이다 —
`codebase/backend/src/shared/utils/terminal-error-payload.ts`(로직),
`codebase/backend/src/shared/utils/terminal-error-payload.spec.ts`(테스트),
`codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`(docstring 전용).
나머지 64개는 `CHANGELOG.md`·`plan/**`·`review/code/2026/08/16/{09_51_00,10_19_30,10_41_55,11_04_07}/**`·
`review/consistency/2026/08/16/{09_25_29,10_19_31}/**` 문서/워크플로 산출물이다.

이 관점(side_effect)은 이미 같은 브랜치에서 4라운드(`09_51_00`→`10_19_30`→`10_41_55`→`11_04_07`)
검토됐고 전 라운드 모두 Critical 0·Warning 0(INFO만)·위험도 LOW 로 수렴했다. `git diff
7badf0318..HEAD --stat`(직전 코드 라운드 `11_04_07` 이후 마지막 커밋 2개, `fb4a70b72`·
`5d4d8dab7`)로 대조하면 **`codebase/**` 변경은 0줄**이다 — 바뀐 것은
`sanitize-error-message.ts` docstring 23줄, `terminal-error-payload.spec.ts` 주석 3줄, plan
문서 체크박스/문장 정리, 그리고 이전 리뷰·consistency 라운드 산출물 커밋뿐이다. 아래는 그
주장을 그대로 받지 않고 핵심 파일(`terminal-error-payload.ts` 전문 162줄, 호출부)을 직접 열어
`11_04_07` 리뷰 이후 실제로 무엇이 달라졌는지 독립 재검증한 결과다.

## 발견사항

- **[INFO]** `sanitize-error-message.ts` 의 docstring 정정(`background-execution.processor` 가
  결과를 알림뿐 아니라 내부 WS 채널에도 싣는다는 서술 추가)이 실제 코드와 일치함을 직접 확인
  — 새 부작용은 아니고 기존 부작용의 뒤늦은 정확한 문서화
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:1-24`(docstring, 이번 diff), 실제 코드는 `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:70,76`(`const message = sanitizeErrorMessage(err); … this.safeEmitRunCompleted(data, 'failed', runStartedAt, message);`)
  - 상세: `11_04_07` 라운드가 지적한 "docstring 이 '3곳 전부 알림 조립' 이라 썼는데 `background-execution.processor` 는 결과를 `background:run:<id>` WS 채널의 `errorMessage` 에도 싣는다"는 사실을 실제 소스(`background-execution.processor.ts:15,26,70,76,109-127`)로 재확인했다 — `safeEmitRunCompleted` 가 `errorMessage` 를 이벤트 payload 에 포함시킨다. 이번 diff 는 이 동작을 새로 만든 것이 아니라(선존 코드, `git diff` 로 로직 변경 0줄 확인) 문서만 실제 상태에 맞춰 정정한 것이다. 다만 이 WS 채널이 `background:run:<id>` 로 격리돼 SSE/webhook 으로 나가지 않는다는 docstring 의 캐비엇도 코드상 확인된다(별도 `sse-adapter.service.ts`/`notification-fanout.service.ts` 경유 없이 자체 gateway 로만 emit).
  - 제안: 조치 불요 — 문서가 이제 코드와 일치한다.

- **[INFO]** 이번 라운드에서 `terminal-error-payload.ts`/`.spec.ts` 의 런타임 동작은 `11_04_07` 이후 완전히 무변경 — 그 라운드가 확인한 안전 속성(시그니처 불변·mutation 없음·DB write 없음·환경변수/네트워크 호출 없음)이 그대로 유효하다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 전문(162줄) — `redactTerminalError`(107-115행), `toTerminalErrorPayload`(122-161행, 4개 반환 지점 130·139·148·160행 전부 `redactTerminalError` 통과)
  - 상세: 파일을 처음부터 끝까지 다시 읽어 `export function toTerminalErrorPayload(err: unknown): TerminalErrorPayload | null` 시그니처, `TerminalErrorPayload` 인터페이스(40-45행), `redactTerminalError` 의 spread-only 반환(mutation 없음)을 직접 재확인했다 — 전부 이전 라운드 기록과 바이트 단위로 동일하다. 새로 도입된 전역 변수·환경변수 read/write·네트워크 호출·이벤트 발행 로직 변경은 없다.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드에 신규로 diff 에 포함된 64개 파일(plan 체크박스/문장 갱신 2건 + 리뷰·consistency 산출물 62건)은 모두 developer/consistency-checker 의 명시된 쓰기 권한 범위(`plan/**`, `review/**`) 안이고, 실행 경로에 영향을 주는 파일이 아니다 — 의도치 않은 파일시스템 부작용이 아님
  - 위치: `plan/in-progress/eia-terminal-error-sanitize.md`(체크박스 3건 갱신), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(문장 완결), `review/code/2026/08/16/{10_41_55,11_04_07}/**`, `review/consistency/2026/08/16/{09_25_29,10_19_31}/**`(전부 신규 커밋되는 기존 워크플로 산출물)
  - 상세: 모두 정적 마크다운/JSON 이며 코드 실행 경로·CI·런타임 설정을 변경하지 않는다.
  - 제안: 조치 불요.

## 확인한 안전한 설계 (재검증)

- **시그니처/인터페이스 불변**: `toTerminalErrorPayload(err: unknown): TerminalErrorPayload | null`, `TerminalErrorPayload` 인터페이스 모두 `11_04_07` 이후 무변경.
- **mutation 없음**: `redactTerminalError`(107-115행)는 `{ ...p, ... }` spread 로 항상 새 객체를 반환. `deepRedactSecrets`(diff 밖)는 copy-on-change.
- **DB write 없음**: 호출부(`execution-engine.service.ts` x3·`retry-turn.service.ts` x1·`chat-channel.dispatcher.ts` x1) 전부 emit 인자로만 쓰이고 이번 라운드에 새로 추가된 호출부도 없다.
- **환경 변수·네트워크 호출 없음**: 세 핵심 파일 어디에도 `process.env`·`fetch`/`http` 없음(재확인).
- **이벤트/콜백 로직 무변경**: `emitTerminalExecution` 라우팅·타이밍·채널 결정 로직은 이번 diff 대상이 아니며, 이번 2개 커밋(`fb4a70b72`·`5d4d8dab7`)은 codebase 를 전혀 건드리지 않았다.

## 요약

`11_04_07` 라운드 이후 이번 라운드까지 `codebase/**` 는 한 줄도 바뀌지 않았다(직접 `git diff --stat` 대조로 확인) — 바뀐 것은 `sanitize-error-message.ts` 의 docstring(23줄, `background-execution.processor` 의 내부 WS 채널 노출을 정확히 반영하도록 재정정)과 plan 체크박스·문장 정리, 그리고 이전 리뷰/consistency 라운드 산출물의 커밋뿐이다. 핵심 로직(`redactTerminalError`, `toTerminalErrorPayload`)은 시그니처 불변·mutation 없음·DB write/환경변수/네트워크 호출 없음이 이전 4라운드와 동일하게 재확인됐고, 이번 diff 가 새로 만든 부작용은 없다. 유일한 관찰(docstring 정정이 실제 코드와 일치하는지)도 실측으로 긍정 확인됐다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
