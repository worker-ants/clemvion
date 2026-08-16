---
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-16
owner: developer
branch: claude/eia-terminal-error-sanitize-audit
spec_impact: none
---

# 종결 `error.message` 가 새니타이즈 없이 외부로 나간다

## 왜 — 리뷰가 **5라운드** 연속 INFO 로 밀어낸 항목이다

`19_27_37` INFO2 · `20_05_17` INFO1 · `20_50_49` INFO3 · `21_14_51` INFO11 · `21_49_51` INFO3 이
전부 *"`emitTerminalExecution` 이 `payload.error` 를 가공 없이 싣는다 — 기존 설계, 별도 턴"* 으로
넘겼다. **미룬 근거가 맞는지 실측했더니 갭이 실재했다.**

이 저장소의 기록된 교훈이다 — 유예 근거는 실측해야 하고, 반복 재지적이면 항목이 아니라
**내 근거**를 의심해야 한다.

## 실측 — 네 고리를 다 확인했다

| 고리 | 상태 |
|---|---|
| `Execution.error.message` 에 실리는 값 | **raw 예외 메시지** (`err.message`) — 아래 3곳 |
| WS `sanitizePayloadForWs` | **키 이름** 패턴 매칭 → 자유 텍스트 *내부* 값은 못 본다 |
| `stripExternalOnlyFields` | `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']` → `error` 통과 |
| 도달 범위 | WS + SSE(§5.2) + **EIA outbound webhook(§3.1) = 외부 제3자** |

**결정적 근거는 저장소 자신이 적어 뒀다.** `sanitize-error-message.ts` 가 이렇게 말한다:

> *"WS 경로의 key-name 기반 `sanitizePayloadForWs` 는 자유 텍스트 message 내부의 값-embedded
> 토큰을 못 잡으므로, 알림/이메일 경로는 본 값-패턴 마스킹이 **유일한 방어**다"*

즉 WS 경로엔 그 방어가 **없다**는 것을 이미 알고 있었다. 그런데 같은 파일 **첫 줄**은:

> *"실행 실패 에러 메시지를 사용자向 표면(**WS 이벤트** / 알림 / 이메일)에 노출하기 전 정리한다"*

`sanitizeErrorMessage` 호출부는 **3곳뿐이고 전부 알림 경로**다(`execution-engine.service:5090`
`background-execution.processor:70` `schedule-runner.service:243`). **문서한 보장이 구현보다
넓다** — 이 저장소에 반복 기록된 형태다.

## raw 를 쓰는 곳 — 3곳 (전수)

종결 emit 이 읽는 것은 `Execution.error` 하나뿐(`toTerminalErrorPayload`)이므로 그 필드에 쓰는
곳만 센다. 나머지 write 는 **고정 문자열**(취소 코드 파생·shutdown·stalled)이라 유출 위험이 없다.

| # | 위치 | 함수 |
|---|---|---|
| ① | `execution-engine.service.ts:636` | `failFirstSegmentSetup` — `row.error = { message: errMessage }` |
| ② | `execution-engine.service.ts:4991` | `finalizeFailedExecution` — `savedExecution.error = { message: errMessage, … }` |
| ③ | `retry-turn.service.ts:958` | `failRetryExecution` — `execution.error = { message: errMessage }` |

> **이 세 곳은 고치지 않는다.** 갭이 실재한다는 *증거*일 뿐이고, 조치는 아래대로 egress 에서
> 한다. DB 는 원문을 그대로 보존한다 — 서버 로그·사후 디버깅의 진실이다.

## 이건 계약 위반이 아니라 하드닝이다

spec `14-external-interaction-api.md` §6.4 는 `error` 를 `{code, message, nodeId, details?}` 로만
규정하고 **새니타이즈를 요구하지 않는다**. `git log -S "sanitizeErrorMessage"` 로 의도적 기각
이력도 없음을 확인했다(#841 이 알림 경로용으로 도입한 것이 전부).

→ `spec_impact: none`. spec 변경 없이 구현만 좁힌다.

## 어디서 새니타이즈할 것인가 — **처음 답이 틀렸고 게이트가 잡았다**

처음엔 **DB write** 를 골랐다. 근거는 *"emit 에서만 걸면 #1172 의 'DB = wire' 불변식을 깬다"*
였다. `09_25_29` 가 두 가지를 지적했고 **둘 다 맞았다**:

**(a) rationale W1 — 과거 결정을 근거 없이 뒤집고 있었다.** EIA §R17 의 원칙은 **egress-only
masking** 이고, 자매 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 등재 항목(2026-08-14, `22_55_51` security W2)도 이미 처방을 적어 뒀다:

> *"`toTerminalErrorPayload` 내부 또는 fanout 경계에서 `message`/`details` 에
> `deepRedactSecrets` 적용"*

살아 있는 결정이다(`git log -S` 로 폐기 이력 없음 확인). 내 write-time 안은 그걸 뒤집는다.

**(b) 내 "DB = wire" 근거 자체가 이 필드엔 성립하지 않았다.** 실측하면 REST `getStatus` 의
`error` 는 **`Execution.error` 가 아니라 `stripAndRedact(execution.outputData)`** 다
(`interaction.service.ts:454`). 즉 두 표면은 마스킹 유무 이전에 **다른 컬럼**을 싣는다.
"DB 하나가 모든 표면의 진실" 이라는 내 전제가 이 필드에선 틀렸다.

→ **egress 초크포인트로 전환한다.** `toTerminalErrorPayload` 안에서 마스킹한다.

| | |
|---|---|
| 호출부 | **5곳 전부 emit 쪽** (종결 4 + `chat-channel.dispatcher`). DB write 는 **0** — 실측 |
| 커버리지 | 새 emit 경로가 생겨도 이 함수를 거치므로 **구조적으로** 빠질 수 없다 |
| DB | **무변경** — 원본 보존, 서버 로그·디버깅 영향 없음 |
| R17 | 뒤집지 않음 |

이건 #1174 가 만든 초크포인트를 그대로 쓰는 것이다 — 이 저장소의 반복 실패("한 곳만 빠뜨린다")를
막는 자리가 이미 거기 있다.

## 조치

- [x] `toTerminalErrorPayload` 안에서 `message`·`details` 에 `deepRedactSecrets` 적용
      (`code`·`nodeId` 는 각각 enum·uuid 라 대상 아님)
- [x] `sanitize-error-message.ts` 의 **과장된 첫 줄 정정** — `sanitizeErrorMessage` 는 알림
      경로 3곳에만 걸려 있는데 docstring 은 "WS 이벤트" 까지 보호한다고 쓴다. 실제 표면으로
      좁히고, WS/SSE 종결 경로는 **`deepRedactSecrets`(이 PR)** 가 맡는다고 명시
- [x] **자매 트래커 동시 갱신** — `spec-sync-external-interaction-api-gaps.md` 의 해당 항목을
      같은 턴에 닫는다 (`09_25_29` plan_coherence W2). 두 plan 상호 참조
- [x] 테스트 — secret/연결문자열이 wire 에서 지워지는지 + `details` 중첩까지.
      뮤테이션으로 마스킹을 빼서 RED 확인 (**GREEN 은 증거가 아니다**)
- [x] 음성 대조 — 평범한 메시지·`code`·`nodeId` 가 훼손되지 않는지(오탐 방지)
- [x] `null` 반환 경로가 유지되는지 (입력 부재 시 빈 객체 금지)

## 리뷰(`09_51_00`)가 잡은 것 — 내 주장이 또 구현보다 넓었다

**W1 — "연결 문자열이 마스킹된다" 는 거짓이었다.** 커밋 메시지·plan 에 그렇게 썼는데 무수정
프로브로 재니 아니다:

| 입력 | 결과 |
|---|---|
| `postgres://user:pw@db.internal/prod` | `postgres://***@db.internal/prod` ✅ |
| `Bearer sk-live-…` | `***` ✅ |
| `postgres://db.internal:5432/prod` (자격증명 없음) | **무변화** |
| 내부 호스트명·사설 IP·스택 프래그먼트 | **무변화** |

`SECRET_LEAK_PATTERNS` 는 **자격증명**을 겨냥한다. 자매 유틸이 갖는
`CONNECTION_STRING_PATTERN`·`STACK_TRACE_PATTERN`·500자 절단은 알림 경로 전용이다.
**주장을 구현에 맞춰 좁혔다** — 넓히는 쪽은 `deepRedactSecrets` 의 다른 소비자
(conversation-thread·`ai_message`·EIA `nodeOutput`)까지 전부 바꾸는 별건이라 후속으로 뗀다.

**W3 — 내부 신뢰 채널 영향을 실측했다.** `09_25_29` 가 "워크플로우 에디터가 마스킹값을 받아도
되나" 를 물었고 내가 답을 안 남겼다. 재니: 프런트는 `execution.failed` 를 **webhook 구독
화이트리스트 라벨로만** 쓰고(`external-interaction-card.tsx`), 실행 실패 표시는 REST
`NodeExecution`/`Execution` 에서 온다. 즉 **에디터는 이 payload 의 `error.message` 를 렌더링하지
않아** 내부 표면 회귀가 없다.

**W7 — 내 테스트가 공허했다.** `code: 'EXECUTION_TIME_LIMIT_EXCEEDED'` · `nodeId: <uuid>` 는
애초에 어떤 패턴에도 안 걸려서 **마스킹이 실수로 걸려도 통과**했다. 마스킹이 걸리면 반드시
값이 바뀌는 입력(`Bearer sk-…` / `api-key=…`)으로 교체했고, 실제로 `code`/`nodeId` 에 마스킹을
거는 뮤턴트 2개가 **RED** 로 판별된다.

> **뮤테이션 자체도 한 번 틀렸다.** 셸에서 `\n` 이 문자 그대로 전달돼 구문이 깨진 뮤턴트가
> `Tests: 0 total` 을 냈는데, 그건 RED 가 아니라 **무효 뮤턴트**다. python 으로 다시 만들었다.
> 덧붙여 내 tsc 유효성 게이트도 오탐이었다 — 이 저장소는 베이스라인에 이미 tsc 오류를 갖고
> 있어(래칫) 절대 판정으로 쓸 수 없다. 유효성 근거는 "jest 가 24개를 정상 로드했다" 쪽이다.

## 범위 밖

- 노드 핸들러가 `NodeExecution.error` 에 쓰는 raw 메시지 — 별개 표면이고 `execution.node.*`
  이벤트의 계약이 다르다. 이 PR 은 **종결 3종**만 본다
- `error-policy.handler.ts` 의 `route_to_error_port` output — 워크플로우 **데이터 흐름**이지
  wire 이벤트가 아니다(사용자가 의도적으로 에러를 분기 처리하는 값)
- 500자 절단 정책 변경 — 기존 util 의 값을 그대로 쓴다

## 후속 (이 PR 범위 밖)

- [ ] **planner 턴 — EIA §R17 "표면 제약(보안)" 마스킹 카탈로그에 5번째 항목 등재**
      (`10_19_31` plan_coherence W1). 현재 4개 불릿(`conversationThread` · `ai_message` ·
      `nodeOutput.conversationConfig` · terminal `result`/`error`)에 이번 egress 마스킹
      지점이 빠져 있다. `spec_impact: none` 의 근거는 *"계약 위반이 아니다"* 이지
      *"카탈로그 완전성이 유지된다"* 가 아니었다 — 지적이 맞다. spec 본문은 developer 권한 밖.
      > ⚠️ **R17 3번째 불릿에 속지 말 것** (`11_26_51` W1). 거기 적힌 *"terminal
      > `result`/`error`"* 의 `error` 는 `getStatus` 의 **`outputData` 기반**이라
      > 이번에 마스킹한 `Execution.error` 와 **다른 컬럼**이다. 이름이 같아서 "이미
      > 포괄됨" 으로 넘기기 쉽다 — 이 브랜치가 트래커의 "REST 와 대칭" 서술에서
      > 이미 한 번 밟은 함정이다.

      **§6.4 필드 표에도 캐비엇이 필요하다** (`10_19_30` W1/W2): 외부 통합사가 보는 정본은
      CHANGELOG 가 아니라 §6.4 인데, 값 마스킹 사실이 거기 없다
- [ ] `plan/in-progress/eia-terminal-emit-facade.md` 체크리스트가 미완료로 stale
      (#1174 `8e0728a90` 로 이미 머지됨) → `[x]` 갱신 + `plan/complete/` 이동
      (`10_19_31` plan_coherence INFO2). 무관한 plan 이라 별도 턴

## 체크리스트

- [x] `--impl-prep` (`09_25_29`) **BLOCK: NO** — WARNING 2건이 접근을 바꿨다(위 참조)
- [x] TEST WORKFLOW 4스테이지 — lint / unit(backend 426·8752) / build / **e2e 276**
- [x] `/ai-review` (`09_51_00`) **Critical 0** · Warning 10 처리 → `RESOLUTION.md`
- [x] `/ai-review` (`10_19_30`) **Critical 0** · Warning 6 처리 → 같은 세션 `RESOLUTION.md`
- [x] fresh `/ai-review` (`10_41_55`) **Critical 0 · Warning 2 — 수렴** → `RESOLUTION.md`
- [x] 주석-only 편집 후 재리뷰 (`11_04_07`) — 게이트가 정확히 재트리거했다.
      **W1 이 또 같은 뿌리였다**: 내가 좁힌 docstring 이 아직도 넓었다
      (`background-execution.processor` 는 결과를 WS 에도 싣는다)
- [x] `--impl-done` (`10_19_31`) **BLOCK: NO** — §3.3→§3.1 인용 오류 정정, 나머지는 후속 등재
- [ ] push 게이트 통과 → PR
