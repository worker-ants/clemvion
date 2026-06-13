---
worktree: (unstarted)
started: 2026-06-13
owner: developer
status: in-progress
---

# execution-engine client-safe typed error 체계 (refactor 04 후속 A-2)

출처: PR #575 `/ai-review` deferred 항목 + refactor 04 1c. 사용자 결정(2026-06-13): **별도 작업으로 분리** — 본 항목은 등록만, 구현은 본 plan 으로 독립 진행.

## 문제

`websocket.gateway.ts` 의 `buildContinuationErrorAck` (L877) 가 내부 `error.message` 를 클라이언트 ack 에 그대로 전달한다:

```ts
const message = error instanceof Error ? error.message : fallbackMessage;
// → { event, data: { success: false, error: message, errorCode } }
```

`InvalidExecutionStateError` 만 `errorCode` 로 typed 하게 surface 되고(spec §7.5.1), 그 외 execution-engine 의 **plain `Error` throw** 들은 내부 메시지(스택 힌트·내부 식별자·DB/3rd-party 오류 원문 등)가 클라이언트로 누출될 수 있다. continuation 핸들러 4종(L492·566·639·709)이 모두 이 경로를 공유한다.

## 결정 필요 (설계)

execution-engine error 표면 **전반**에 영향을 주는 대형 설계라 별도 작업으로 분리됐다. 착수 시 다음을 확정한다:

1. **error code enum 체계** — `InvalidExecutionStateError.code`(`INVALID_EXECUTION_STATE`)·worker `RESUME_*` 와 직교/통합 관계. 신규 client-safe code 네임스페이스(`EXEC_*`?) 정의.
2. **client-safe 메시지 매핑** — code → 사용자 노출 메시지(i18n? 고정 영문?). 내부 message 는 서버 로그에만 남기고 클라이언트엔 code+안전 메시지만.
3. **typed error 기반 클래스** — execution-engine 의 plain `Error` throw 들을 `ExecutionError`(code 보유) 계열로 전환하는 범위. 어디까지 전환할지(전수 vs 경계만).
4. **ack 변환 지점** — `buildContinuationErrorAck` 가 typed error 면 code+safe message, plain Error 면 generic fallback(내부 message 미전달)로 처리하도록 변경.

## 구현 지점 (예상)

- `codebase/backend/src/modules/execution-engine/**` — error throw 표면, typed error 클래스.
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` `buildContinuationErrorAck` (L877).
- spec: `spec/3-execution/**` (execution-engine error 계약) + websocket protocol spec §7.5.1.

## 선행 의존

- spec 결정(위 1~4)을 project-planner 가 먼저 확정해야 구현 착수 가능 — `consistency-check --spec` 동반.
