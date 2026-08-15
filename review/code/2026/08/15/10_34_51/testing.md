STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (3차 라운드, `09_58_24`/`10_18_38` 이후)

## 방법론 노트

프롬프트 번들에서 파일 4(`execution-engine.service.spec.ts`)·파일 5(`execution-engine.service.ts`)는 diff 가 생략돼 있어 `git diff origin/main -- <path>` 로 전문을 직접 열어 대조했다. 이 PR 은 이미 두 차례 ai-review 를 거쳤고(`review/code/2026/08/15/09_58_24`, `10_18_38`) 각 라운드의 `testing.md`가 raw-UPDATE 5경로의 실값 threading 미검증·`TERMINAL_DURATION_MS_SQL` e2e 값 미검증·`resolveTerminalDurationMs` 의 "이미 계산된 값" 분기 음수 우회를 이미 지적했고, `RESOLUTION.md` 가 근거와 함께 명시적으로 이월했다. 이번 라운드에서는 (a) 그 이월 항목들이 현재 diff 에도 여전히 유효한지 재검증하고 (b) 앞선 두 라운드가 다루지 않은 지점을 찾는 데 집중했다.

## 발견사항

- **[WARNING]** `chat-channel.dispatcher.ts` 의 `durationMs` nullable 캐스트 확장에 대응하는 테스트가 이 PR 에 전혀 추가되지 않았다 — 자매 스펙 파일이 diff 에 아예 등장하지 않는다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534`(`execution.completed`), `:571`(`execution.failed`), `:587`(`execution.cancelled`) — 프롬프트 게이트 숫자 기준으로도 동일(534/572/589 부근). 대응 스펙: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` (실측: `git diff origin/main --stat -- codebase/backend/src/modules/chat-channel/` 결과 이 파일은 **이번 diff 에 전혀 등장하지 않는다**)
  - 상세: 이 PR 은 `types.ts` 세 인터페이스(`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`)의 `durationMs` 를 `number | null` 로 넓혔고, `chat-channel.dispatcher.ts` 도 캐스팅 타입을 `{ durationMs?: number }` → `{ durationMs?: number | null }` 로 맞춰 3곳 수정했다(`10_18_38` W8 로 이미 지적·조치됨). 그런데 이 변환 지점(`toChatChannelEvent`)을 직접 테스트하는 `chat-channel.dispatcher.spec.ts` 를 열어 보면(`grep -n "execution.completed\|execution.failed\|execution.cancelled"`), `execution.completed` 케이스는 **테스트가 아예 존재하지 않고**(`describe` 블록 자체가 없음), `execution.failed`(279-370행)·`execution.cancelled`(375-436행) 두 describe 는 `error` 필드 변환만 촘촘히 검증할 뿐 어느 `it` 도 `eia.durationMs` 를 단언하지 않는다(319행대 매칭 `durationMs` 는 무관한 `llmCalls[].durationMs` 필드 1건뿐). 이 필드는 이 PR 이 CHANGELOG 에서 "외부 수신자 breaking change" 로 명시한 바로 그 계약(§6.4 "값을 모르면 null, 키는 항상 존재")의 실제 wire 변환 경계인데, 그 경계를 직접 통과하는 회귀 테스트가 하나도 없다. 논리 자체는 단순 pass-through 라 즉시 깨질 위험은 낮지만, 향후 누군가 이 캐스트 자리에 `?? 0` 기본값이나 `typeof` 분기를 추가해도 이 테스트 스위트로는 잡히지 않는다.
  - 제안: `chat-channel.dispatcher.spec.ts` 의 기존 `execution.failed`/`execution.cancelled` describe 에 `durationMs: 4242`(정상)·`durationMs: null`(값 모름)·`durationMs` 키 없음(레거시 재생, `undefined`) 세 케이스를 최소 1세트 추가하고, `execution.completed` 자체 describe 도 신설할 것(현재 이 이벤트 타입은 dispatcher 레벨 테스트가 전무).

- **[INFO]** (이월, 재확인 완료) raw UPDATE 5경로 중 `markWebChatIdleTimeout`·`markExecutionCancelled`·`markQueueWaitTimeout` 3곳은 여전히 emit 단언이 `objectContaining` 이라 `durationMs` 실값 threading 이 미검증 — 이미 `09_58_24`/`10_18_38` 두 라운드가 지적했고 `RESOLUTION.md`(양쪽)가 "자매 2곳(`cancelParkedExecution`/`finalizeStalledExhausted`)이 null-분기·숫자-분기 각각을 정확 매칭으로 고정해 추출 패턴 자체는 검증됨, 나머지는 동형 반복이라 위험 낮음" 이라는 근거로 명시적으로 이월한 항목이다. 현재 diff 에서도 동일하게 유효함을 재확인했다(`makeIdleQb`:2978, emit 단언:3054-3057 `objectContaining`으로 `durationMs` 부재; `markExecutionCancelled` 의 `buildUpdateChain`:14776-14790 이 `raw: [{ duration_ms: 1234 }]` 를 이미 주는데도 그 값을 쓰는 emit 단언은 여전히 `durationMs` 를 검사하지 않음; `markQueueWaitTimeout` 은 여전히 `jest.spyOn(...).mockResolvedValue(...)` 로만 호출돼 본문이 직접 실행되지 않음, 1750-1758행)
  - 상세: 근거 자체(추출 로직이 5곳 모두 동일한 `toFiniteNumber(result.raw?.[0]?.duration_ms) ?? null` 패턴이고 두 대표 사례가 정확 매칭으로 고정돼 있음)는 타당하다고 판단해 이번 라운드에서 재차단하지 않는다. 다만 `spec-sync-external-interaction-api-gaps.md` W10(`duration_ms >= 0` e2e sanity)이 아직 미체크(`- [ ]`) 상태이므로, 이 갭이 "리뷰로만 잡혔다"는 이 PR 스스로의 교훈(CRITICAL 클램프 사고)이 재발하지 않으려면 후속 착수 시 우선순위를 낮추지 말 것을 재권고한다.
  - 제안: 조치 불필요(이번 라운드). 후속 트래커 항목 실행 시 위 3경로도 함께 정확 매칭으로 보강 권장.

- **[INFO]** `resolveTerminalDurationMs` 의 "이미 계산된 값 신뢰" 분기가 음수 가드를 우회하는 비대칭이 여전히 테스트되지 않는다 (이월, 재확인 완료)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:33-35`(이미 유한수인 `row.durationMs` 는 부호 검사 없이 그대로 반환) vs `:41`(재계산 분기만 `span >= 0` 가드). 테스트: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:12-21`(프롬프트 게이트 기준) — "이미 계산된 durationMs 를 그대로 쓴다" 케이스가 `999` 양수만 사용
  - 상세: `resolveTerminalDurationMs({ durationMs: -5, startedAt, finishedAt })` 를 호출하면 `-5` 가 그대로 반환된다 — 파일 자신의 불변식("시계 역행(음수)은 null")이 이 분기에는 적용되지 않는 의도된 설계로 보이나, 그 의도를 고정하는 테스트가 없다. 실무 도달 가능성은 낮다(호출부는 대부분 `durationMs` 가 아직 비어있는 시점에 호출).
  - 제안: `it('이미 세팅된 durationMs 가 음수여도 재계산하지 않고 그대로 반환한다(가드 미적용은 설계 의도)')` 류 캐너리 1건 추가 권장. 강제 사항 아님.

## 잘 된 점 (재확인)

- `terminal-duration.spec.ts`(신규, 8개 `describe`/25개 케이스)는 순수 함수 단위 테스트의 모범 사례를 유지한다 — 이미 계산된 값 보존, `startedAt`/`finishedAt` 각각·둘 다 부재·`null`(4-fixture `it.each`), non-`Date` 값, `Invalid Date`, 시계 역행(음수)→`null`, `NaN`/`Infinity`→계산 폴백, `0`(falsy 아님, `??` vs `||` 회귀 명시), pg 드라이버 문자열 bigint/numeric(`toFiniteNumber`)까지 촘촘하다. 특히 12-21행 `it.each` 는 "이 PR 이 실제로 겪은 회귀"(조건 밖 계산이 throw 해 종결 emit 자체가 사라짐)를 재현하는 정확한 회귀 테스트다.
- `cancelParkedExecution`(execution-engine.service.spec.ts:3207-3213)·`finalizeStalledExhausted`(:4822-4828)는 `objectContaining` 대신 정확 매칭으로 `durationMs: null`/`durationMs: 4242` 를 각각 고정해, 두 분기(추출 실패/성공)의 올바른 선례를 보여준다.
- `retry-turn.service.spec.ts` 의 4곳 `durationMs: expect.any(Number)`(691/727/858/894행)는 헬퍼 레벨에서 이미 촘촘히 검증된 null-분기와 결합해 적절한 수준의 wiring 검증이다 — 헬퍼가 이미 커버한 edge case 를 호출부에서 중복 테스트하지 않은 설계 판단으로 읽힌다.
- 앞선 두 라운드가 지적한 `driveCallStackResume` 의 계산부 미전환(음수 가드 우회 가능)은 이번 diff 에서 실제로 `resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs` 로 전환됐음을 `execution-engine.service.ts:2574` 에서 직접 확인했다 — 회귀 없이 반영됨.

## 요약

핵심 신규 로직(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)의 단위 테스트는 두 라운드를 거치며 이미 매우 탄탄하고, CRITICAL 급 결함은 이번 라운드에서 발견되지 않았다. 앞선 두 라운드가 지적한 raw-UPDATE 3경로 실값 미검증·SQL e2e 값 미검증·음수-보존 비대칭은 현재 diff에도 재확인상 여전히 유효하지만, 근거 있는 이월(대표 2경로가 양쪽 분기를 이미 정확 매칭으로 고정, 후속 트래커에 등재)이라 이번 라운드에서 재차단하지 않는다. 이번 라운드에서 새로 확인한 것은, `chat-channel.dispatcher.ts` 가 세 이벤트 타입 모두에서 `durationMs` nullable 캐스트를 이 PR 로 직접 수정했음에도 그 변환을 검증하는 `chat-channel.dispatcher.spec.ts` 는 diff 에 전혀 등장하지 않고 기존 테스트도 `durationMs` 를 단언하지 않는다는 점이다 — 이 파일은 EIA 이벤트가 실제로 외부 wire 형태로 굳어지는 경계라 CHANGELOG 가 명시한 "외부 수신자 breaking change" 계약의 최종 검증 지점인데, 회귀 안전망이 없다.

## 위험도

MEDIUM
