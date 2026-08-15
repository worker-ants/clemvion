# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 변경(종결 emit 타입 파사드 + `cancelledBy` 결함 흡수)이 반영되지 않았다
  - 위치: `CHANGELOG.md` (신규 섹션 부재) — 근거 변경은 `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 의 `failRetryExecution`(diff 상 `if (isCancelled) { ... cancelledBy: 'user' ... }` 분기, 게이트 981~995)
  - 상세: 같은 커밋 계열(`#1169`~`#1173`, `git log --oneline -5 -- CHANGELOG.md` 로 확인)은 종결 이벤트 wire payload 에 영향을 주는 수정마다 **예외 없이** `## Unreleased — ...` 섹션을 추가해왔다(`llmCalls` strip, `error` object 통일, `durationMs` 추가, DB 와 다른 값 발행 정정, stalled 부분 커밋 트랜잭션화). 이번 PR 은 `failRetryExecution` 의 CANCELLED 분기가 **종전엔 `result` 키 자체를 emit 하지 않던 것**(구 코드: `{status, durationMs, error?}` — `result` 없음)을, 신규 파사드로 `result.cancelledBy: 'user'` 를 추가해 emit 하도록 바꾼다 — 이는 순수 리팩터가 아니라 **수신자가 보는 wire payload 가 바뀌는 실제 동작 변경**(`plan/in-progress/retry-turn-terminal-guard.md` W1 이 "결함" 으로 등재했던 그 항목의 흡수)이다. 동일 세션의 다른 4개 PR 이 전부 CHANGELOG 로 이 종류의 변경을 기록해온 것과 대비된다.
  - 제안: 기존 "Unreleased — 종결 이벤트가 DB 와 다른 값을 말하던 곳들" 섹션과 같은 스타일로 `## Unreleased — retry-turn cancelled 경로에 cancelledBy 누락` 항목을 추가하고, 수신자 영향("`chat-channel.dispatcher.ts` 는 `result` 부재를 `{}` 로 방어해 크래시는 없었으나 `cancelledBy` 값이 유실되고 있었다")을 명시한다.

- **[WARNING]** `retry-turn-terminal-guard.md` W1 항목의 취소선이 라벨만 걸리고 본문은 그대로 남아 "이미 해소된 옛 문제 서술"처럼 안 보인다 (동일 저장소가 이미 한 번 지적·수정했던 패턴의 재발)
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:311`(`~~원문:~~` 라벨)부터 `:317`(본문 마지막 줄)까지
  - 상세: 이 diff 는 체크박스를 `[x]` **완료**로 바꾸고 새 설명을 추가한 뒤, `~~원문:~~` 이라는 **라벨 단어만** 취소선 처리하고 그 아래 실제 옛 문단(`spec §4.1 이 ... 필수로 요구하는데 ... {status} 뿐이다.` 부터 `수정 시 retry-turn.service.spec.ts 의 deep-equality 단언도 함께 갱신 필요` 까지)은 diff 상 컨텍스트 줄(변경 없음)로 그대로 남아 있다 — 즉 **문단 자체는 취소선이 없다**. 특히 마지막 문장 "수정 시 `retry-turn.service.spec.ts` 의 deep-equality 단언도 함께 갱신 필요" 는 **이미 이 PR 이 그 갱신을 완료**했음에도(파일 4 diff 참조) 여전히 미래형 지시문처럼 남아 stale 하다. 이는 같은 PR 계열의 `spec-sync-external-interaction-api-gaps.md` 의 `durationMs` 항목이 이미 겪고 고친(`11_44_10` documentation W4: "취소선을 절반만 쳐 둬서 '아직 payload 에 안 실린다' 로 오독될 수 있었다") 정확히 같은 클래스의 결함이 인접 plan 파일에서 재발한 것이다.
  - 제안: `durationMs` 항목이 쓴 패턴(`> **아래는 등재 시점 원문이다 — 전부 해소됐다.**` 안내 문장 + 옛 문단 전체를 `~~...~~` 로 완전히 취소선 처리)을 그대로 적용해 문단 전체를 취소선 처리하거나, 옛 문단을 삭제하고 "완료" 설명만 남긴다.

- **[INFO]** `eia-terminal-emit-facade.md` 설계 절의 예시 코드가 실제 구현 타입과 다르다 (`error` nullable 여부)
  - 위치: `plan/in-progress/eia-terminal-emit-facade.md:78`
  - 상세: plan 문서의 `## 설계` 절 TS 스니펫은 `{ type: 'failed'; durationMs: number | null; error: TerminalErrorPayload }` (non-nullable) 로 적혀 있으나, 실제 구현(`codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` `TerminalEventPayload`)은 `error: TerminalErrorPayload | null` 이다. `toTerminalErrorPayload()` 가 `null` 을 반환할 수 있으므로 실제 타입이 맞고, 예시가 뒤처졌다.
  - 제안: 설계 스니펫에 `| null` 추가해 실제 타입과 일치시킨다.

- **[INFO]** `retry-turn.service.spec.ts` 에 동일한 `TYPE_TO_EVENT` 상수와 그 설명 주석이 두 곳에 그대로 중복된다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:785`~`792` 와 `:960`~`967` (두 `describe` 블록 각각에 동일한 3줄 주석 + `TYPE_TO_EVENT` 객체 리터럴이 반복)
  - 상세: 향후 `ExecutionEventType` 에 새 종결 타입이 추가되거나 매핑이 바뀌면 두 사본을 모두 동기화해야 하는데, 문서화(주석) 관점에서 "이 매핑은 wire 형태를 재구성하는 헬퍼" 라는 취지가 두 곳에 흩어져 있어 한쪽만 갱신될 위험이 있다.
  - 제안: 파일 상단 module-scope 상수로 추출해 주석·상수를 1곳으로 합친다(테스트 로직 자체는 diff 범위 밖이라 강제하지 않음, 참고용).

## 요약
코드 레벨 문서화는 이번 PR 의 강점이다 — `TerminalEventPayload` union 과 `emitTerminalExecution` 의 JSDoc 이 SoT(spec §6/§6.5) 를 명시하고, 과거 결함(#1170/#1171) 을 근거로 "왜 union 인가" 를 설명하며, 순환 import 회피를 위해 파생을 호출 시점으로 옮긴 비직관적 결정도 정확히 주석화돼 있다. 테스트 파일의 신규 `describe` 블록 주석도 wire 형태 계약을 정확히 서술한다. spec 문서(`14-external-interaction-api.md`) 의 `result.cancelledBy` 행도 해소 근거와 함께 갱신됐다. 다만 plan 레벨에서 두 가지 실질적 갭이 있다 — (1) 동일 커밋 계열이 예외 없이 지켜온 CHANGELOG 기록 관행을 이번 PR 만 건너뛰었고, 이 PR 자체가 진짜 wire payload 변경(`cancelledBy` 신규 emit)을 포함한다는 점에서 근거가 약하지 않다. (2) `retry-turn-terminal-guard.md` 의 취소선 처리가 라벨만 걸리고 본문은 그대로 남아, 바로 이 저장소가 이미 겪고 고쳤던 "절반만 취소선" 오독 패턴을 다른 파일에서 재발시켰다. README/API 문서/환경변수 문서는 이번 변경 범위 밖(순수 내부 리팩터 + 결함 흡수)이라 갱신 불필요로 판단했다.

## 위험도
MEDIUM
