# Rationale 연속성 검토 결과

## 검토 범위 확인

`prompt_file` 의 diff 섹션(`<git diff origin/main...HEAD -- code_areas>`)이 예산 초과로 절단되어
있었기 때문에, 실제 diff 는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff origin/main...HEAD` 로 직접 재확인했다. 실 diff 범위는 폴더명이 암시하는 "R8 캐시
스코프"(Idempotency-Key 관련)가 **아니라** 종결 이벤트(`completed`/`failed`/`cancelled`) emit 을
타입 파사드(`ExecutionEventEmitter.emitTerminalExecution`)로 통합하는 리팩터다
(`codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`,
`execution-engine.service.ts`, `retry-turn.service.ts` + `spec/5-system/14-external-interaction-api.md`
§6 필드 표 1행 + `plan/in-progress/eia-terminal-emit-facade.md`(신규) + `retry-turn-terminal-guard.md`
갱신). R8("Idempotency-Key 와 `submit_form` 검증 실패의 관계" · "캐시 키 스코프")은 이 diff 에
없다 — 관련 파일(`IdempotencyInterceptor`, `interaction.service.ts` 등) 미변경 확인.

## 발견사항

- **[WARNING]** `cancelledBy` 정확도 한계에 대한 후속 등재 미실측 — §6.5 causal 계약과의 정합 갭
  - target 위치: `plan/in-progress/eia-terminal-emit-facade.md:27-38` (특히 L36-38 "정확도의
    한계를 적어 둔다 ... DB 의 `error.code` 로 원인을 파생하는 개선은 별도 항목으로 등재한다")
    와 그 구현 `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:981-995`
    (`failRetryExecution` 의 `cancelledBy: 'user'` 하드코딩)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §6 "`execution.cancelled` 의
    행동 계약 (normative)" (L655-669) — `result.cancelledBy` 는 **닫힌 3값
    union**(`user`|`system`|`timeout`)이고, 각 값은 §6.5 표가 정의하는 **구체적 원인**
    (system→rehydration 실패 `RESUME_*`, timeout→admission 큐 대기초과/공개위젯 idle reap)에
    묶인다. 이 causal 매핑 자체가 R19(EIA-RL-07)·EIA-RL-06 이 도입한 시스템발 취소 경로들의
    존재를 전제로 한다.
  - 상세: `failRetryExecution` 이 처리하는 `ExecutionCancelledError` 는 `assertExecutionNotCancelled()`
    (실행-엔진 L8319-8347)가 **DB `status===CANCELLED` 관측만으로** 던지는 범용 신호라 실제
    취소 주체(사용자 Stop vs 관리자/타임아웃/idle-reap 시스템 취소)를 구분하지 못한다. 이 PR 은
    그 경로에 `cancelledBy: 'user'` 를 하드코딩했고, plan 문서(L27-38)에 그 한계("실제 원인이
    timeout/system 이었다면 `cancelledBy` 와 `error` 부재가 함께 틀린다")를 **정직하게 기록**했다는
    점은 긍정적이다. 그러나 그 문단이 위임한 "DB 의 `error.code` 로 원인을 파생하는 개선은
    별도 항목으로 등재한다"는 **실제로 등재되지 않았다** — `spec-sync-external-interaction-api-gaps.md`·
    `retry-turn-terminal-guard.md` 전수 grep 결과 해당 후속 항목이 없다. 이 프로젝트가 이미
    반복 지적당한 "유예의 근거로 '등재했다'를 인용할 때 그 등재를 실측하지 않는다" 패턴과
    동일한 모양이다. 더구나 같은 diff 안에서 정확히 이 문제(취소선을 일부에만 걸어 나머지가
    stale 로 남는 것)를 `retry-turn-terminal-guard.md` W1 항목에서 스스로 지적·수정했음에도
    (`plan/in-progress/retry-turn-terminal-guard.md` 해당 diff hunk 참조), 이번엔 "한계 인정"이
    `eia-terminal-emit-facade.md` 한 곳에만 남고 CHANGELOG·spec §6 표·
    `retry-turn-terminal-guard.md` 우선순위표(#2 "P2 완료")에는 그 캐비엇 없이 "완료/해소"로만
    표기됐다.
  - 제안: (a) 위임한 후속 항목("system/timeout 원인 시 `error.code` 로 `cancelledBy` 파생")을
    `spec-sync-external-interaction-api-gaps.md` 또는 별도 plan 에 실제로 체크박스로 등재하거나,
    (b) 그럴 계획이 없다면 이 한계를 **spec 의 `## Rationale`**(durable SoT — plan 은 완료 후
    archive/삭제되는 transient 문서)에 짧은 각주로 옮겨, `retry-turn.service.ts`·
    `finalizeCancelledExecution`(execution-engine.service.ts L4944-4945, 이 PR 이전부터
    동일 패턴) 양쪽이 공유하는 "동시-시스템-취소 레이스에서 `cancelledBy` 오분류 가능" 을
    §6.5 근처에 명시적으로 기록한다.

- **[INFO]** 동일 한계의 부분 전파 — spec 표·CHANGELOG 는 "완전 해소"로만 읽힌다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 필드 표 `result.cancelledBy`
    행(diff: `**(2026-08-15 해소)**`), `CHANGELOG.md` 신규 절("Unreleased — 종결 emit 타입
    초크포인트 + retry-turn `cancelledBy` 누락")
  - 과거 결정 출처: 위와 동일(§6.5 normative 계약)
  - 상세: 두 문서 모두 "필드가 이제 채워진다"(구조적 완결성)만 서술하고 "채워지는 값이 항상
    causal 하게 정확하지는 않다"는 캐비엇을 담지 않는다. 표 문구 자체는 "필수 필드는 타입이
    강제한다"로 좁게 한정돼 있어 기술적으로 거짓은 아니지만, §6.5 의 행동 계약을 읽는 독자
    입장에서는 `cancelledBy` 가 이제 완전히 신뢰 가능한 causal 신호라고 오해하기 쉽다.
  - 제안: 위 WARNING 항목의 (b) 를 적용하면 이 항목도 함께 해소된다. 최소한으로는 §6 표의
    `result.cancelledBy` 행 비고에 "동시 시스템 취소 레이스에서 `'user'` 로 근사될 수 있음
    (알려진 선존 한계, 자매 `finalizeCancelledExecution` 과 공유)" 한 줄을 추가.

## 검토한 항목 중 이상 없음 확인 (근거 기록)

- **R10 (WebsocketService 단일 sink 정책)**: 신규 `emitTerminalExecution` 은 여전히
  `emitExecution` → `WebsocketService.emitExecutionEvent` 한 경로로만 나간다
  (`execution-event-emitter.service.ts:138`). facade 계층 확장이지 sink 다중화가 아니다 — R10
  의 "엔진 외부의 facade 레이어" 설계와 정합.
- **§6.5 닫힌 3값 union 자체**: `TerminalEventPayload` 의 `cancelledBy` 타입은
  `'user' | 'system' | 'timeout'` 로 코드 레벨에서도 닫혀 있다 — 새 값 추가 없음, R 위반 아님.
- **§6.5 "user cancel 에는 `error` 키가 없다"**: `emitTerminalExecution` 구현이 `payload.error`
  가 있을 때만 `wire.error` 를 세팅한다(L136) — `null` 로 채우지 않고 키 자체를 생략, 계약대로.
- **R8 (Idempotency-Key/캐시 스코프)**: 이 diff 의 변경 범위 밖 — 워크트리 폴더명이 암시하는
  것과 달리 관련 코드(`IdempotencyInterceptor` 등) 미변경. 재도입·번복 여부를 판단할 대상
  자체가 없음.
- **plan 문서의 자기 정정**("16 호출부"→"직접 호출 11곳 + 나머지는 `emitCancellationEvent`
  경유" 정정, `spec-sync-external-interaction-api-gaps.md` diff)은 과거 부정확한 서술을 실측
  근거로 고친 것으로, 무근거 번복이 아니라 오히려 이 checker 가 권장하는 패턴이다.

## 요약

이번 diff 의 핵심 변경(종결 이벤트 타입 파사드)은 R10 단일 sink 정책·§6.5 닫힌 union·부재
표현 규약을 모두 그대로 준수하며, R8 캐시 스코프 관련 결정은 애초에 이 diff 의 범위 밖이다.
다만 `retry-turn.service.ts` 의 신규 `cancelledBy: 'user'` 하드코딩은 §6.5 의 causal 계약을
완전히 충족하지 못하는 알려진 한계이고, 그 한계는 `plan/in-progress/eia-terminal-emit-facade.md`
한 곳에는 정직하게 기록됐으나 (a) 위임한 후속 등재가 실제로는 이뤄지지 않았고 (b) 동일
"완료/해소" 표기가 CHANGELOG·spec §6 표·plan 우선순위표에는 캐비엇 없이 퍼져 있다. 이는
차단급 위반은 아니지만, spec 의 durable Rationale 로 한계를 승격하거나 위임한 후속 항목을
실제로 등재해야 향후 "다시 발견됐다가 또 잊히는" 반복을 막을 수 있다.

## 위험도

LOW
