---
id: "CLE-EXEC-CANCEL-NODES"
title: "노드 취소 — 노드별 적용과 구현 현황"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-CANCEL"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-CANCEL"]
area: "CLE-EXEC"
content_hash: "13e3b1bbd4de260a8c577824aa703db851a30411cfd6f2c6aa59044d4d1db438"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e17ffbd85a3f6235f42c9dd3175645a5e538ee6bd5c08920ec7e19ea92872655"
etag: "sha256-ab67b21280c436c9f2c02feb35693dc7af280f32f6f0666c522782d1927c9335"
---
## 개요

이 문서는 [노드 취소](CLE-EXEC-CANCEL.md) 의 하위 문서로 fetch 노드의 연쇄 패턴, 노드별 신호 전파 · 취소 에러 분류의 구현 현황, HTTP Request · AI 노드의 취소 판정 결정을 정한다. 본문의 규칙 번호는 부모 문서의 번호다.

## fetch 자체 타임아웃과의 연쇄

HTTP Request·Cafe24·MakeShop 노드는 요청마다 자체 타임아웃용 `AbortController` 를 쓴다. `context.abortSignal` 과는 공용 헬퍼(`_base/abort-cascade.util.ts` 의 `linkUpstreamAbort`·`isUpstreamAbort`)로 다음처럼 잇는다.

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);
fetchOptions.signal = controller.signal;

const upstream = context.abortSignal;
const unlinkUpstream = linkUpstreamAbort(controller, upstream);

try {
  const res = await fetch(url, fetchOptions);
  clearTimeout(timeoutId);
  // 본문 읽기도 같은 신호로 끊긴다
  const body = await res.text();
  return toSuccessOutput(res, body);
} catch (err) {
  clearTimeout(timeoutId);
  // 노드 취소: 다시 던져 엔진이 노드 실행을 cancelled 로 기록하게 한다
  if (isUpstreamAbort(err, upstream)) throw err;
  // 요청 자신의 타임아웃이나 네트워크 에러: 노드의 전송 실패로 돌려준다
  return toTransportFailure(err);
} finally {
  // 응답 본문까지 읽은 뒤에 뗀다
  unlinkUpstream();
}
```

`linkUpstreamAbort(controller, upstream)` 는 `upstream` 이 이미 취소됐으면 `controller.abort()` 를 바로 부르고 리스너를 달지 않는다. 그렇지 않으면 `upstream` 에 `abort` 리스너를 달고 그 리스너를 떼는 함수를 돌려준다. 위쪽이나 자체 타임아웃 어느 쪽이 취소해도 fetch 는 바로 예외를 던진다.

리스너는 `finally` 에서 뗀다. 성공한 요청은 자기 controller 의 `abort()` 를 부르지 않는다. 그래서 정리를 controller 의 `abort` 이벤트에 걸면 요청이 성공할 때마다 노드 취소 신호에 리스너가 하나씩 남는다. 리스너는 응답 본문까지 읽은 뒤에 뗀다. 본문 읽기도 취소 대상이기 때문이다. 헤더를 받은 직후에 떼면 본문을 읽는 동안 노드 취소 신호가 취소돼도 요청이 끊기지 않는다.

catch 는 `isUpstreamAbort(err, upstream)` 로 두 `AbortError` 를 가른다. 에러의 `name` 이 `AbortError` 이고 `upstream.aborted` 가 참이면 노드 취소다. 노드는 이 에러를 다시 던지고 엔진이 노드 실행을 `cancelled` 로 기록한다(규칙 19). `upstream` 이 열려 있는데 `AbortError` 가 났으면 요청 자신의 타임아웃이다. 노드는 이 에러를 자기 전송 실패로 돌려준다. HTTP Request 노드는 `HTTP_TRANSPORT_FAILED` 로 에러 포트에 보낸다. 에러 판정은 `instanceof Error` 대신 `name` 으로 한다. realm 이 다른 에러도 같은 이름으로 잡기 위해서다. 자체 타임아웃을 별도 에러 코드로 매핑하는 노드는 노드 취소 신호가 취소된 경우에만 `AbortError` 를 다시 던진다(`isUpstreamAbort`). 엔진의 `isAbortError` 는 에러 이름만 보므로 노드가 두 `AbortError` 를 가를 때 쓰지 않는다.

## 구현 현황

2026-07-28 코드 대조 기준이다. 노드별 취소 에러 분류와 공용 연쇄 헬퍼에 관한 행은 2026-10-10, AI 노드 신호 전파와 AI 노드 취소 에러 분류 행은 2026-10-31 코드 대조 기준이다.

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| `ExecutionContext.abortSignal?: AbortSignal` 필드 | ✅ | `node-handler.interface.ts`. 분류는 [실행 컨텍스트](CLE-EXEC-CONTEXT.md), 동작 계약은 [노드 취소](CLE-EXEC-CANCEL.md) |
| 규약 신설 | ✅ | [노드 취소](CLE-EXEC-CANCEL.md) |
| HTTP 노드 신호 전파(fetch 연쇄) | ✅ | `http-request.handler.ts` 가 공용 헬퍼 `linkUpstreamAbort` 로 잇는다. 리다이렉트 홉(`followRedirectsSafely`)과 응답 본문 읽기도 같은 controller 신호를 쓴다. 리스너는 응답 본문까지 읽은 뒤 `finally` 에서 뗀다. 단위 테스트 `http-request.handler.spec.ts` |
| HTTP 노드 취소 에러 분류(handler 가 `AbortError` 를 엔진까지 전달) | ✅ | catch 가 `isUpstreamAbort` 이면 `AbortError` 를 다시 던진다. 활동 로그는 남기지 않는다(규칙 3). JSON 본문을 읽는 중에 노드 취소 신호로 끊긴 것도 `null` 로 삼키지 않고 다시 던진다. 노드 자체 타임아웃은 `HTTP_TRANSPORT_FAILED` 로 에러 포트에 간다. 2026-10-10 결정(아래 Rationale) |
| AI 노드 신호 전파 | 🚧 | AI 에이전트(`ai-turn-executor.ts`)·텍스트 분류기(`text-classifier.handler.ts`)·정보 추출기(`information-extractor.handler.ts`)가 `llmService.chat` 에 `context.abortSignal` 을 넘긴다. AI 에이전트의 롤링 요약 호출은 아직 넘기지 않는다(규칙 2). 단위 테스트가 세 노드에서 `context.abortSignal` 이 `llmService.chat` 으로 가는지 확인한다. 정보 추출기는 단일 턴과 멀티턴 첫 경로를 모두 확인한다 |
| AI 노드 취소 에러 분류(handler 가 `AbortError` 를 엔진까지 전달) | ✅ | 세 노드가 LLM 호출의 catch 첫 줄에서 공용 헬퍼 `rethrowIfNodeCancelled`(`shared/llm-cancellation.ts`)를 부른다. 헬퍼는 노드 취소 신호가 켜져 있으면 규칙 3 대로 `AbortError` 를 던지고 신호가 열려 있으면 아무것도 하지 않는다. 부르는 곳은 텍스트 분류기의 chat 호출, 정보 추출기의 단일 턴 호출과 멀티턴 첫 경로(`runTurnWithCollectionRetries`), AI 에이전트 `executeSingleTurn` 의 첫 chat 과 도구 루프 chat 이다. 정보 추출기는 부분 결과를 돌려주기 전에 던지므로 취소된 멀티턴은 스레드 누적과 메모리 추출을 만들지 않는다. 멀티턴 재개 경로에는 신호가 없어 헬퍼가 아무것도 하지 않는다. 앱 수준 타임아웃은 노드 취소 신호를 켜지 않으므로 노드 자신의 실패로 남는다. 대응 요구사항은 [텍스트 분류기 노드](../CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) 와 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 에 있다. 단위 테스트 `llm-cancellation.spec.ts`·`text-classifier.handler.spec.ts`·`information-extractor.handler.spec.ts`·`ai-turn-executor.spec.ts` |
| Parallel `cancel-others-on-fail` 통합 | ✅ | `parallel-executor.ts` |
| DB 노드 신호 전파 | ✅ | 사전 확인과 진행 중 쿼리 취소(`database-query.handler.ts`). 단위 테스트 `database-query.handler.spec.ts`. 다만 취소 때도 `failed` 활동 로그를 남긴 뒤 `AbortError` 를 다시 던진다. 규칙 3 의 활동 로그 규칙과 다르고 NERV Task `CLE-T-GZRYQ3` 가 맡는다 |
| Email 노드 신호 전파 | 🚧 | 사전 확인만(`send-email.handler.ts`). 진행 중 SMTP 중단은 일부러 택하지 않았다 |
| MakeShop 노드 신호 전파·취소 에러 분류 | ✅ | `makeshop-api.client.ts` 가 공용 헬퍼로 연쇄하고(이미 취소된 경우 포함) 노드 취소 신호로 생긴 `AbortError` 를 다시 던진다. `makeshop.handler.ts` 도 그 `AbortError` 를 활동 로그 없이 다시 던진다. 둘 다 있어야 엔진이 `cancelled` 로 분류한다 |
| Cafe24 노드 신호 전파·취소 에러 분류 | ✅ | MakeShop 과 같은 구조(`cafe24-api.client.ts`·`cafe24.handler.ts`) |
| 노드 실행 `cancelled` 상태, `AbortError` 분류, dispatch 사전 확인, `execution.node.cancelled` 이벤트 | ✅ | `NodeExecutionStatus.CANCELLED` enum 과 V069 마이그레이션. `markNodeCancelled` 가 `NodeExecution.error` 에 `{ code: 'AbortError', message }` 를 남기고 같은 값을 이벤트 `error` 로 보낸다. 신호 경로 한정이고 실행 중지는 [DB 관측 취소 가드 구현 현황](CLE-EXEC-CANCEL-DBGUARD.md#구현-현황) 이 맡는다 |

chat-channel 은 노드가 아니다. `webhook` 트리거의 `config.chatChannel` 변형이고 구현체는 실행 이벤트를 구독하는 나가는 어댑터다. 그래서 신호 연쇄 대상이 아니다. 취소 때 이 어댑터가 할 일은 `execution.cancelled` 를 채널로 보내는 것이다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)).

남은 과제는 NERV Task 가 추적한다. 시간 한도·안전 종료의 신호 연동(`CLE-T-6WSCPE`)은 [노드 취소 §미결 사항](CLE-EXEC-CANCEL.md#미결-사항), 가드 쪽 과제는 [DB 관측 취소 가드 구현 현황](CLE-EXEC-CANCEL-DBGUARD.md#구현-현황) 에 있다.

- `CLE-T-GZRYQ3`: 이웃 문서를 이 규약의 2026-10-10 개정과 2026-10-31 AI 노드 취소 판정에 맞추고 Database Query 노드의 취소 때 활동 로그 차이를 다룬다.

## 구현 위치

- `codebase/backend/src/nodes/integration/_base/abort-cascade.util.ts` (`linkUpstreamAbort`·`isUpstreamAbort`·`isAbortErrorLike`, HTTP Request·Cafe24·MakeShop 공용. AI 노드 헬퍼도 이름 판정에 `isAbortErrorLike` 를 쓴다)
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`, `cafe24.handler.ts`
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts`, `makeshop.handler.ts`
- `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`
- `codebase/backend/src/nodes/ai/shared/llm-cancellation.ts` (`rethrowIfNodeCancelled`, 세 AI 노드 공용)
- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts`
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
- `codebase/backend/src/modules/llm/llm.service.ts` (`chat` 이 타임아웃 신호와 호출자 신호를 `AbortSignal.any` 로 합친다)

## Rationale

### HTTP Request 노드도 노드 취소를 `cancelled` 로 끝낸다 (2026-10-10)

이 규약은 외부 I/O 노드가 취소 때 `AbortError` 를 그대로 던진다고 정했다. 그런데 HTTP Request 노드는 노드 취소 신호로 생긴 `AbortError` 를 전송 실패와 묶어 `HTTP_TRANSPORT_FAILED` 와 에러 포트로 돌려줬다. 그래서 cancel-others-on-fail 로 멈춘 HTTP 분기가 `cancelled` 대신 에러 포트 라우팅(정상 종료)으로 기록됐다. 사용자가 2026-10-10 에 선택지 1 을 승인했다.

- 선택지 1(채택): HTTP Request 노드도 Cafe24·MakeShop 핸들러처럼 노드 취소 신호로 생긴 `AbortError` 를 다시 던진다. 엔진이 노드 실행을 `cancelled` 로 기록한다.
- 선택지 2(기각): 지금 동작을 이 규약의 예외로 적는다. 이렇게 하면 취소된 분기가 에러 포트를 따라 다음 노드를 실행한다. 취소된 분기의 일이 계속되므로 기각했다.

[HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) 에는 실행 안의 실패를 모두 에러 포트로 보낸다는 원칙이 있다. 이 원칙은 실패 경로를 하나로 모으는 규칙이다. 노드 취소는 규칙 19 의 중단이라 이 원칙의 범위 밖이다. Cafe24·MakeShop 핸들러도 이미 같은 방식으로 취소를 다시 던진다.

노드 자체 타임아웃은 이 결정의 범위 밖이다. 요청 자신의 타임아웃은 노드 취소가 아니므로 그대로 `HTTP_TRANSPORT_FAILED` 로 에러 포트에 보낸다. 두 `AbortError` 는 `upstream.aborted` 로 가른다.

같은 작업에서 세 노드에 따로 있던 연쇄 코드를 공용 헬퍼(`_base/abort-cascade.util.ts`)로 합쳤다. 정리를 controller 의 `abort` 이벤트에 거는 방식은 성공한 요청이 `controller.abort()` 를 부르지 않아 요청마다 노드 취소 신호에 리스너를 남긴다. 그래서 `finally` 에서 리스너를 떼는 형태로 정했다.

### AI 노드는 노드 신호로 취소를 판정한다 (2026-10-31)

규칙 3 은 노드 취소를 `AbortError` 로 엔진에 넘기라고 정한다. 엔진의 `isAbortError` 와 규칙 18 은 `error.name === 'AbortError'` 로 취소를 분류한다. 그런데 설치된 Anthropic SDK 와 OpenAI SDK 는 `signal` 이 취소되면 `APIUserAbortError`(메시지 `Request was aborted.`)를 던지고 이 에러의 `name` 은 `'Error'` 다. 런타임에서 확인한 값이다. fetch 기반 클라이언트는 이름이 `AbortError` 인 DOMException 을 던진다. 그래서 2026-10-31 이전에는 AI 에이전트도 Anthropic·OpenAI 호출이 취소되면 노드 실행이 `failed` 로 기록되고 노드의 에러 처리 정책이 적용됐다. 텍스트 분류기와 정보 추출기는 취소를 `LLM_CALL_FAILED` 실패 출력으로 바꿨다.

- 채택: AI 핸들러가 LLM 호출의 catch 첫 줄에서 `context.abortSignal.aborted` 로 판정하고 규칙 3 대로 감싸 던진다(원래 에러는 `cause`, 메시지는 고정 문구 `LLM call was aborted`). 메시지를 고정하는 것은 취소와 경합한 401·5xx 같은 실패의 프로바이더 문구가 노드 실행의 `error` 와 `execution.node.cancelled` 이벤트로 나가지 않게 하려는 것이다. 세 노드가 공용 헬퍼 `rethrowIfNodeCancelled` 를 쓰고 헬퍼는 이름 판정에 `isAbortErrorLike` 를 쓴다. 엔진의 분류 규칙(규칙 18)은 바꾸지 않는다.
- 기각 A: `LlmService.chat` 이 `opts.signal?.aborted` 일 때 에러를 바꿔 던진다. 이렇게 하면 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 의 공용 계약이 바뀌어 노드가 아닌 호출자도 영향을 받는다. 또 핸들러는 어차피 에러를 실패 출력으로 바꾸기 전에 취소를 걸러야 하므로 판정이 두 곳으로 나뉜다.
- 기각 B: 에러 이름을 조건으로 거는 판정을 그대로 쓴다(엔진 `isAbortError`, fetch 노드의 `isUpstreamAbort`). 두 판정 모두 이름이 `AbortError` 여야 참이라 Anthropic·OpenAI 의 `APIUserAbortError` 를 놓친다. 이전에 AI 에이전트가 실제로 `failed` 로 기록된 것도 이 때문이다.

판정의 경계는 이렇다. 앱 수준 LLM 타임아웃(`withTimeout`)은 자기 `AbortController` 를 쓰고 노드 취소 신호를 켜지 않는다. 그래서 타임아웃은 계속 노드 자신의 실패다. 사용자 실행 중지는 신호를 만들지 않으므로(규칙 9) 이 판정에 닿지 않고 노드 경계와 턴 경계 확인이 맡는다. 노드 취소 신호가 켜진 뒤 catch 에 닿은 실패는 다른 원인으로 났어도 취소로 기록된다. 그 실패를 에러 포트로 보내면 취소된 분기의 일이 이어진다. 2026-10-10 HTTP Request 결정에서 선택지 2 를 기각한 것과 같은 이유다.

[텍스트 분류기 노드](../CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) 와 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 는 같은 작업에서 기존 실패 요구사항의 범위를 좁히고 노드 취소 요구사항을 더했다.

### 이웃 문서의 정합은 따로 맡긴다 (2026-10-10)

> 주의: 2026-10-10 개정과 2026-10-31 AI 노드 취소 판정에 맞춰 이웃 문서를 고치는 일이 남아 있다. NERV Task `CLE-T-GZRYQ3` 가 맡는다.

- [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md)·[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)·[에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)·[통합 관리](../CLE-INT/CLE-INT-MANAGE.md)·[Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md)·[MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md)·[Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md)·[장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 의 2026-10-10 개정 정합
- [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 의 에러 계약과 NF-AI-01 표(취소 제외), 멀티턴 규칙 8(에러로 끝나도 부분 결과를 `output.error` 와 함께 남긴다)과 출력 구조 색인 표의 노드 취소 예외, 미결 사항의 `text-classifier.handler.ts` 줄 번호 인용(식별자로 바꾼다)
- [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 재시도 분류의 "사용자 취소", 「LLM 호출 타임아웃」 의 "배선" 과 "`AbortController` 를 만드는 곳" 과 "try/catch 가 없어" 문구. 이제 `executeSingleTurn` 의 두 chat 호출에 취소 판정용 try/catch 가 있다
- [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) 와 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 3.2.1 `retryable` 의 "사용자 취소"
- [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.1 표에 없는 노드 취소 행(`cancelled` 로 끝나는 경우)
- [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) §3 `AbortError` 행의 근거 "fetch·SDK·DB 드라이버가 모두 이 이름으로 던진다". Anthropic·OpenAI SDK 의 `APIUserAbortError` 는 `name` 이 `'Error'` 라 이 근거와 맞지 않는다. 이름이 다른 SDK 에러는 AI 노드가 이 이름으로 감싸 던진다고 고친다
