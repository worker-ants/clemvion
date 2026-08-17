# Changelog

## Unreleased — 자유 텍스트 안의 자격증명이 WS emit 과 내부 REST 두 컬럼으로 나가고 있었다

아래 두 항목(#1177 종결 emit · #1179 읽기 경로)이 `Execution.error` 를 닫았지만 **그 옆이
비어 있었다.** 무수정 프로브로 실증한 누출 — `execution.node.failed` 의
`error: 'Authorization: Bearer eyJ…'` 가 외부 fanout envelope 까지 원문으로 도달했고,
`inputData`/`outputData` 는 내부 REST 여섯 표면에서 원문이었다.

**왜 샜나** (총칭이 아니라 열거): `sanitizePayloadForWs` 는 **키 이름** 기반이라 문자열 값을
그대로 통과시키고, `stripExternalOnlyFields` 는 `llmCalls` **필드 제거** 전용이며,
`SseAdapter` 는 이벤트 타입 필터가 없어 `node.*` 를 전부 외부로 push 한다. 종결 이벤트만
`toTerminalErrorPayload` 가 막고 있었다.

**WS emit** — 두 emit(`emitExecutionEvent`·`emitNodeEvent`)이 공유하는 초크포인트에서 값-패턴
마스킹. `executionEventSubject.next` 호출부가 정확히 둘이라 한 곳만 고치면 자매가 갈린다.
**내부 wire 에도 적용**한다 — `execution:<id>` 구독 인가가 workspace 소유만 보고 role 을 안
받아 수신 인구가 `GET /api/executions/:id` 와 동일하기 때문이다(EIA §R17 boundary parity).
**예외는 `llmCalls` 하나** — 에디터 전용 raw 디버그라 wire 에서 원문 유지(fanout 은 필드째
strip 하므로 외부 노출 불변). WS §Rationale 의 strip-only 결정은 **번복되지 않았다**.

**내부 REST** — `redactStoredDataForResponse` 를 **`outputData`** 에 적용. 표면은 **여섯**이다:
`findById` · `getChain` · `stop` · `toExecutionDto`(목록) · `findById` 의 `nodeExecutions[]` ·
`BackgroundRunsService.toNodeExecutionDto`.

**⚠️ `Execution.inputData` 만 마스킹하지 않는다 (의도)** — 초안은 두 컬럼을 함께 닫았다가 **되돌렸다.**

> **카브아웃은 `Execution` 레벨 한정이다** — `NodeExecution.inputData`(실행 상세의
> `nodeExecutions[]`·background-run 본문 노드)는 재제출 소비처가 없어 **마스킹된다**.
> 노드 레벨을 비워 두면 WS emit(마스킹)과 REST(원문)가 같은 프런트 store 슬롯에서
> 2초 폴링에 덮여 화면이 깜빡이고, wire 마스킹의 보안 이득도 사라진다.
> **가르는 축은 필드 이름이 아니라 "그 값이 되쓰이는가"** 다.
`inputData` 는 표시 전용이 아니라 **재제출되는 값**이다: Re-run 모달이 프리필해
`inputOverride` 로 되보내고(`useOriginalInput` **기본 `false`** 라 손대지 않아도 제출된다),
에디터 "히스토리에서 불러오기" 도 같은 값을 재실행한다. 마스킹하면 리터럴 `'***'` 가
**새 실행의 실제 입력값**이 된다 — 가시성 저하가 아니라 조용한 기능 오염이다. 두 게이트가
독립으로 CRITICAL 을 냈고 소스 추적으로 확증했다. 기본 Re-run(`useOriginalInput=true`)은
서버가 엔티티를 직접 읽어 영향 없다. 회귀 캐너리로 비대상임을 고정했고, 프런트 마커 가드는
트래커에 등재했다.

**마커를 덮지 않는다** — `deepRedactSecrets` 가 이미 마스킹된 값(`[REDACTED]` · `***` ·
`[REDACTED_DEPTH]`)을 재마스킹하지 않게 했다. webhook ingestion 이 남긴 `[REDACTED]` 는
[12-webhook §5.3](./spec/5-system/12-webhook.md) 이 규정한 계약이라, 덮으면 같은 헤더가
`$trigger.headers` 에서는 `[REDACTED]`, 실행 상세 API 에서는 `***` 로 보인다.

**⚠️ wire 변화**: WS/SSE 이벤트 payload 와 실행 상세 API 의 `outputData` 바이트가 바뀔 수
있다. 워크플로가 **정당하게** 자격증명을 다루면 그 값도 `***` 로 보인다 — 외부 `getStatus` 는
이미 같은 마스킹을 걸고 있었고 내부만 없던 비대칭을 없앤 것이다. DB 는 원문을 보존한다
(egress-only). 평범한 값은 무변화(캐너리로 고정). 유저 가이드의 Output 탭 설명에 이 캐비엇을
추가했다.

**성능**: emit 당 순회가 2회 → 3회. 8턴 waiting payload N=3000 실측 **0.0181 → 0.0323 ms**
(+0.0142, 1.78배).

## Unreleased — 같은 `Execution.error` 를 표면마다 다른 값으로 말하고 있었다 (읽기 경로)

**#1177**(아래 항목 — CHANGELOG 는 최신이 위로 쌓인다)이 **종결 emit 경로**에 값-마스킹을
넣었는데 **읽기 경로는 그대로 원문**이었다. 같은
소켓에서 `execution.failed` 는 마스킹된 값을, `execution.snapshot` 은 원문을 보내고 있었다.
`GET /api/executions/:id` 에는 `@Roles` 게이트가 없어 **viewer 포함 워크스페이스 멤버 전원**이
조회하고, 프런트는 실패 배너에 `error.message` 를 그대로 렌더한다.

`redactStoredErrorForResponse`(신규 `shared/utils/redact-stored-error.ts`, `deepRedactSecrets`
위임·**형태 보존**)를 `ExecutionsService` 의 독립 반환 경로 **4곳**(`findById` ·
`toExecutionDto` · `getChain` · `stop`)에 적용한다. `POST /executions/:id/re-run` 과 WS
`execution.snapshot` 은 `findById` 를 재사용하므로 함께 덮인다.

**`nodeExecutions[].error` 도 함께 마스킹한다** — [데이터 모델 §2.14](./spec/1-data-model.md) 가 `Execution.error` 를
*"최초 failed NodeExecution 의 에러 정보를 **복사**"* 로 정의하므로, 최상위만 가리면 **같은
문자열이 같은 응답 안에 원문으로 병존**해 방어가 통째로 우회된다. 자매 표면인
`GET /executions/:id/background-runs/:id` 의 body 노드도 같이 건다.

**⚠️ wire 변화**: 위 표면들의 `error.message`/`error.details` 바이트가 바뀔 수 있다.
`Bearer sk-…` → `***`, `postgres://user:pw@host/db` → `postgres://***@host/db`.
`code`·`nodeId` 는 값 공간이 닫혀 있어 **건드리지 않는다**. 평범한 에러 메시지
(`Node "Send Email" failed`)는 **무변화**다 — 진단 정밀도 손실은 자격증명 형태 부분문자열에
한정된다(무수정 프로브로 실측, 캐너리 테스트로 고정).

`ExecutionsService.stop()` 의 반환 타입이 `Execution` → `ResponseExecution` 로 좁아진다
(`error: … | null` 을 인정하고 `trigger`/`executor` 를 타입에서 제외). **응답에서 사라지는
필드는 없다** — 그 경로의 `findOne` 은 두 관계를 애초에 로드하지 않는다(실측).

**DB 는 원문을 보존한다** (EIA §R17 egress-only 원칙). 서버 로그·사후 디버깅의 진실은 그대로다.

**잔여 갭(의도, 트래커 등재)**: WS `execution.node.*` **emit** · `inputData`/`outputData` ·
workflow-assistant LLM 도구(`maskSensitiveFields` 키-기반만 적용 — 값-패턴을 단순 합성하면
그쪽의 `****9876` 접미 힌트가 사라져 별도 결정이 필요하다).

## Unreleased — 종결 이벤트 `error` 가 자격증명 마스킹 없이 외부로 나가고 있었다

`execution.failed` 의 `error.message` 는 임의 내부 예외 원문(`err.message`)이고, 이 payload 는
WS 뿐 아니라 SSE 스트림(§5.2)과 **EIA outbound webhook(§3.1)** 으로 **외부 제3자 통합사**에게
그대로 전달된다. WS 경로의 `sanitizePayloadForWs` 는 **키 이름** 기반이라 자유 텍스트 *안*에
박힌 토큰(`Bearer …`, 자격증명 포함 URI)을 못 잡고, `stripExternalOnlyFields` 는 `llmCalls`
하나만 지운다 — 즉 이 필드엔 값-패턴 방어가 **없었다**.

`toTerminalErrorPayload`(종결 emit 4곳 + chat-channel fanout 이 모두 거치는 egress 초크포인트)
에서 `message`·`details` 에 `deepRedactSecrets` 를 적용한다. **DB 는 원문을 그대로 보존**한다
(EIA §R17 egress-only masking 원칙, 서버 로그·사후 디버깅의 진실).

**⚠️ wire 변화**: 종결 `error.message` / `error.details` 의 바이트가 바뀔 수 있다.
`Bearer sk-…` → `***`, `postgres://user:pw@host/db` → `postgres://***@host/db`.
JSON 형태 message 는 마스킹 후 **재직렬화**되므로 공백 등 포맷이 정규화된다(파싱 가능성은 유지).
`code`·`nodeId` 는 값 공간이 닫혀 있어 **건드리지 않는다**.

**잔여 갭(의도)**: `SECRET_LEAK_PATTERNS` 는 자격증명을 겨냥하므로 **자격증명 없는 연결
문자열·내부 호스트명·스택 프래그먼트는 여전히 통과**한다. 자매 유틸(알림 경로)의
`CONNECTION_STRING_PATTERN` 을 shared SoT 로 올리는 것은 `deepRedactSecrets` 의 다른 소비자
전부에 영향을 주므로 별도 PR 로 분리했다.

**수신자 영향**: `error.message` 를 **문자열 동등 비교**로 분기하던 외부 통합사가 있다면 영향을
받는다. 값이 좁아지는 방향이고 필드 형태(§6.4)는 불변이다.

## Unreleased — 종결 emit 타입 초크포인트 + retry-turn `cancelledBy` 누락

`emitExecution(payload: unknown)` 이 종결 이벤트 형태를 강제하지 않아 필드 하나를 호출부마다
손으로 스레딩해야 했다. 최근 연속 수정(`error` 문자열 · `durationMs` 전면 누락)이 전부 그
형태다. **판별 union 파사드**(`emitTerminalExecution`)를 도입해 직접 호출 11곳을 이관했다 —
`status`·이벤트명은 `type` 에서 파생하고, `durationMs`(3종)·`error`(failed)·
`cancelledBy`(cancelled)는 **필수 필드**다.

**⚠️ wire 변화 1건**: `retry-turn` 의 재진입 취소 경로(`failRetryExecution`)가 종전엔
`result` 키 자체를 싣지 않았다. 이제 **`result.cancelledBy: "user"` 가 실린다.** 파사드의
필수 필드가 이 누락을 컴파일 타임에 드러냈고(그 결함은 별도 plan 이 P2 로 추적 중이었다),
EIA §6 이 요구하던 계약이 이제 이 경로에서도 충족된다.

**수신자 영향**: `execution.cancelled` 구독자 중 **`result` 부재를 신호로 쓰던 코드**가
있다면 영향을 받는다. 값이 유실되던 쪽이 정상화되는 방향이고, 필드 **추가**이므로 breaking
이 아니다.

⚠️ **저장소 밖에도 도달한다.** 이 이벤트는 EIA outbound webhook(§3.1 EIA-NX-02 화이트리스트)과
SSE 스트림(§5.2 `GET /api/external/executions/:id/stream`)으로 **외부 제3자 통합사**에게 같은
payload 로 전달된다. 저장소 내 소비자(`chat-channel.dispatcher.ts`)는 `result` 부재를 `{}` 로
방어해 무해하지만, **외부 통합사는 grep 할 수 없다** — 처음엔 저장소 안만 보고 "무해" 로 적었다.

## Unreleased — stalled 마감의 부분 커밋 (자식 NodeExecution 영구 RUNNING 잔류)

`finalizeStalledExhausted`(BullMQ stalled 재배달 소진 → `WORKER_HEARTBEAT_TIMEOUT` 마감)가
Execution UPDATE 와 자식 `NodeExecution` cascade UPDATE 를 **각각 autocommit** 으로 실행했다.
첫 문장이 커밋된 뒤 둘째가 실패(DB 오류·크래시)하면 자식이 **영구 `RUNNING`** 으로 잔류한다 —
유령 running 이다.

같은 2-테이블 쓰기를 하는 자매 `cancelParkedExecution` · `markWebChatIdleTimeout` 은 이미
`dataSource.transaction` 으로 원자화돼 있었고 **이 경로만 열려 있었다.** 자매의 패턴을 그대로
따라 단일 트랜잭션으로 묶었다(트랜잭션 안에서 두 UPDATE, 커밋 이후 emit).

**수신자 영향 없음** — 이벤트 payload·상태 전이·no-op 조건 모두 그대로다. 부분 커밋으로
잔류하던 유령 `RUNNING` 노드가 더 이상 생기지 않는다.

## Unreleased — 종결 이벤트가 DB 와 다른 값을 말하던 곳들

직전 항목이 세운 **"DB = wire"** 불변식에는 구멍이 셋 있었다. 하나는 값 불일치가 아니라
**DB 에 쓰이지도 않은 이벤트를 발행**하는 것이었다.

- **`finalizeCancelledExecution` 이 guarded UPDATE 의 결과를 읽지 않았다.** 이 함수는
  `status IN (non-terminal)` 조건부 UPDATE 를 쓰는데, 동시 writer 가 이미 terminal 로
  선점해 **0행 매칭이어도 `EXECUTION_CANCELLED` 를 그대로 발행**했다 — DB 는 FAILED 인데
  수신자는 cancelled 를 받는다. 바로 옆 자매 `finalizeFailedExecution` 은 같은 반환을 읽어
  emit 을 skip 하며, **그 자매의 주석이 "형제와 동일한 guarded 경로" 라고 대칭을 주장**하고
  있었다. 절반만 참이었다
- **retry-turn 재진입 중 Stop 시 DB 와 emit 의 `durationMs` 가 갈렸다.** CANCELLED 분기는
  `COALESCE(duration_ms, :new)` 로 먼저 커밋된 값을 의도적으로 보존하는데, **`COALESCE` 가
  어느 쪽을 골랐는지는 DB 만 안다.** `RETURNING` 으로 되받아 실제 영속값을 싣는다
- **REST 재조회에 `durationMs` 추가** — push 계열만 싣고 `GET /api/external/executions/:id` 에는 필드가
  없어, **이벤트 유실 후 재조회로 복구하는** 클라이언트 패턴에서 값이 사라졌다. additive 이며
  breaking 아니다. 계산하지 않고 영속 컬럼을 그대로 싣는다

**수신자 영향**: `execution.cancelled` 가 **덜** 발행될 수 있다 — 종전에 나가던 것 중
"DB 에 반영되지 않은" 발행이 사라진다. 정상화이지 기능 축소가 아니다.

## Unreleased — 종결 이벤트에 `durationMs` (3종 전부)

직전 항목이 *"`durationMs` 는 후속으로 분리했다"* 고 예고한 작업이다. `execution.completed`
· `failed` · `cancelled` 가 이제 **밀리초 소요 시간**을 싣는다.

- **알 수 없으면 `null`** (형제 `error.code` 와 같은 부재 표현). 키는 항상 존재한다
- 엔티티를 로드하지 않는 5경로(park 취소 · 위젯 idle 취소 · 재개 실패 취소 · 큐 대기
  타임아웃 · stalled 소진)는 **UPDATE 문 안에서 SQL 로 계산**하고 `RETURNING` 으로 되받아
  싣는다 — DB 와 wire 가 같은 값을 쓴다
- `EXECUTION_QUEUE_WAIT_TIMEOUT` 경로의 값은 **큐 대기 시간**이다(실행 시간이 아니다).
  `started_at` 이 admission 이전 시각이기 때문이며 §6.5 에 명시했다
- `duration_ms` 컬럼이 `INTEGER`(≈24.8일)라 **JS·SQL 두 경로 모두**에 int4 상한 클램프를
  넣었다(상수 `PG_INT4_MAX` 를 공유한다). 없으면 24.8일 넘게 대기한 실행의 종결 UPDATE 가
  통째로 실패해 그 실행이 **영구 고착**된다 — 취소뿐 아니라 **정상 완료도** 대상이다
  (폼·버튼·AI 대기에는 시간 기반 강제취소가 없다)

**수신자 영향**: 종결 3종 payload 에 필드가 하나 늘었다(제거·변경 아님). 기존 파서는
무시하면 되고, 값을 읽을 때 `null` 을 방어해야 한다.

~~**REST `GET /api/external/executions/:id` 에는 아직 없다** — push 계열(webhook/SSE/WS)만
채워졌다. 재조회 시 사라지는 비대칭이라 후속으로 추적 중이다.~~ **(다음 항목에서 해소)**

**⚠️ 대시보드·통계의 "평균 실행 시간" 숫자가 이동한다.** 세 집계가 종전에는
`duration_ms IS NOT NULL` 로만 걸렀는데, 그건 방어가 아니라 **취소·타임아웃 경로가 이 컬럼을
비워 뒀기 때문에 우연히 안전했던 것**이다. 이번 변경이 그 자리를 채우므로 세 곳에
`status = 'completed'` 필터를 넣었다. 부수 효과로 **종전에 집계되던 정상 실패와 stop 취소의
실제 소요 시간이 평균에서 빠진다** — 지표 정의가 "완료된 실행의 평균" 으로 좁아졌다.

`completed` 만 남긴 이유는 `finalizeStalledExhausted` 가 `FAILED` 라서 FAILED 도 이번
변경으로 오염되기 때문이다. 오염되지 않은 상태는 `completed` 하나뿐이다.

**내부 UI 의 "소요 시간" 컬럼은 아직 대기 시간을 그대로 보여준다.** `stop()` 취소도
`CANCELLED` 인데 그쪽 값은 진짜 실행 시간이라, 프런트엔드에서 status 로 거르면 정상 동작이
깨진다 — 근본 해결은 필드 분리이고 후속으로 추적 중이다. 그 전까지 유저 가이드에
캐비엇을 넣었다.

## Unreleased — 종결 `error` 를 문자열로 보내던 4곳 (EIA §6.4 object 로 일원화)

`execution.failed` 의 `error` 가 spec §6.4 는 `{code, message, nodeId, details?}` 객체인데
emit 4곳이 **문자열**을 실었다. 네 곳 전부 같은 경로에서 그 객체를 만들어 DB 에 저장하고
있었고 emit 만 그걸 버리고 message 를 다시 뽑아 썼다.

**수신자 영향 (breaking)**: `execution.failed` webhook·SSE·chat-channel 구독자는 이제
`error` 를 **항상 객체**로 받는다. 이 저장소는 URL 버전 세그먼트를 쓰지 않으므로 버전
신호가 없다 — 문자열을 전제한 파서는 갱신이 필요하다.

- 부재 표현은 **명시적 `null`**(`code`·`nodeId`). DB 는 키를 생략하지만 wire 는 채운다
- `finalizeStalledExhausted` 는 emit 문구를 손으로 다시 적으면서 `attempts` 를 빠뜨려
  **DB 와 wire 가 이미 달랐다** — 같은 객체를 싣게 해 해소
- chat-channel dispatcher 가 문자열을 감쌀 때 지어내던 `'INTERNAL_ERROR'` → `null`.
  그 코드는 분류기에 존재하지 않아 분류 결과는 같고, unknown warn 로그가 유령 코드를
  보고하지 않게 된다
- 에디터 프런트엔드(`use-execution-events`)가 같은 wire 를 소비하므로 함께 갱신 —
  객체를 그대로 렌더하면 React 가 던진다

`durationMs`·`result.outputs` 는 취소 경로 배관 비용이 달라 후속으로 분리했다.

## Unreleased — (보안) `llmCalls` raw 프롬프트가 외부로 새고 있었다 — fanout(depth-1) + REST 스냅샷

`execution.waiting_for_input` 이 raw LLM 요청/응답을 **두 경로로 중첩**해 실었는데, strip 은
최상위 필드만 지웠다:

1. `payload.turnDebug.llmCalls.llmCalls[]` — AI turn1 스냅샷
2. `payload.nodeOutput.meta.turnDebug[].llmCalls[]` — 턴 **누적 전체**

둘 다 depth-1 삭제를 통과해 **external-interaction SSE · notification webhook ·
chat-channel 아웃바운드** 수신자에게 도달했다. `LlmCallRecord` 의 `requestPayload`/
`responsePayload` 에는 시스템 프롬프트·대화 이력·사용자 입력이 담긴다.

WS §4.4 는 이 필드가 "모든 외부 수신자에서 strip 된다" 고 선언하고 있었다 — **선언이 참이
아니었다.** 기존 회귀 테스트가 최상위 `llmCalls` 만, 그것도 `AI_MESSAGE` 에서만 확인해
이 표면이 열린 채로 남아 있었다.

strip 을 **깊이 무관**으로 바꿨다. 필드명 자체가 문서화된 비밀 마커이므로 중첩 위치를
열거하는 대신 이름으로 막는다 — 새 위치가 생겨도 자동 보호된다. 내부 WS(에디터) 채널은
종전대로 full payload 를 받는다(대조군 테스트로 고정).

### 그리고 fanout 만이 아니었다 — REST 스냅샷도 같은 것을 돌려줬다

`GET /api/external/executions/:id`(`InteractionService.getStatus`)가 **같은 토큰으로
접근하는 같은 데이터**를 `deepRedactSecrets` 만 거쳐 반환했다. 그건 secret-shape **값**
마스킹이라 `llmCalls` **필드 자체**는 남는다. 세 출구가 모두 열려 있었다 —
waiting `nodeOutput` · terminal `result` · terminal `error`.

처방을 `shared/utils/strip-external-only-fields.ts` 로 올려 fanout·REST 가 같은 것을 부르게
했고, REST 쪽 세 출구는 다시 한 헬퍼(`stripAndRedact`)로 묶었다 — **출구를 각자 조립하면
한 번에 하나씩만 고쳐진다**는 것이 이 결함이 세 라운드에 걸쳐 반복된 이유다.

> 영향 범위: 두 경로로 나간 데이터는 **이미 전송된 것**이다. 외부 통합자가 저장했을 수
> 있으므로, 해당 워크스페이스의 프롬프트/대화 이력 민감도에 따라 운영 판단이 필요하다.

## Unreleased — `UPDATE … RETURNING` 의 결과를 8곳이 행 배열로 오인했다 (소셜 로그인 상시 실패 포함)

TypeORM 0.3.31 + pg 는 `UPDATE`/`DELETE` 의 결과를 **`[rows, rowCount]` 튜플**로 돌려준다
(`RETURNING` 유무·파라미터·트랜잭션과 무관, 실측). `SELECT`/`INSERT` 는 행 배열이다. 이 비대칭을
모르고 8곳이 결과를 행 배열로 다뤘다. 튜플은 **길이가 항상 2** 라 다음이 조용히 참이 된다:

- `rows.length === 0` → 영원히 거짓 → **"0행이면 거절" 가드가 전부 무력**
- `rows.length === 1` → 영원히 거짓 → **동시성 cap admission 이 늘 defer**
- `rows[0]` → 행이 아니라 **행 배열** → 필드 접근이 전부 `undefined`

관측된 결과:

1. **소셜 로그인이 상시 실패했다.** `handleCallback` 이 state row 대신 배열을 읽어
   `record.provider` 가 `undefined` → 정상 콜백까지 `OAUTH_STATE_MISMATCH` 로 떨어졌다.
2. **KB 재추출/재임베딩 CAS 락이 한 번도 거절하지 않았다** (409 가 발동 불가).
3. **admission cap 이 항상 defer** — 커밋된 UPDATE 덕에 재큐된 job 이 크래시 복구 갈래로
   들어가 겉으로는 동작했다. e2e 레이턴시로 확인(4191ms → 2242ms).
4. **재큐가 `[undefined, undefined]` 를 enqueue** 했다.
5. `updateExecutionStatus` 의 `persisted` 가 항상 `true` → 선점당한 경우에도 종결 이벤트를
   발행했다(DB 쓰기 가드 자체는 SQL 조건으로 정상 동작 — 아래 소급 정정 참조).

수정: 공용 헬퍼 `updateReturningRows(result, detail)` 로 튜플/배열을 흡수하고, 8곳을 태웠다.
배열이 아니면 `detail` 과 함께 throw 한다 — 드라이버가 또 바뀌면 조용히 통과하는 대신 죽는다.

**왜 4개월간 아무도 못 봤나 — 초록이 두 겹이었다.** 단위 테스트 mock 이 `[{...}]`(INSERT 형태)라
코드와 **같은 오해를 공유**했고, OAuth 콜백에는 e2e 가 없었다. 그래서 `auth-oauth-callback.e2e-spec.ts`
를 신설해 실 드라이버 위에서 성공/거절 **양방향**을 고정했다(한쪽만 보면 "전부 실패" 도 절반은 초록이다).

곁들여 드러난 같은 클래스 결함 하나를 더 닫았다 — raw `.query()` 는 ORM 매핑을 타지 않아 컬럼명이
snake_case 인데 콜백이 `record.rememberMe` 를 읽었다. 그 결과 소셜 로그인의 **"로그인 유지" 가 침묵으로
무시**돼 refresh 토큰·쿠키가 늘 7일이었다(30일이어야 함). 이 결함은 위 튜플 버그가 콜백을 통째로
죽여 놓은 동안 **도달 불가능한 dead code** 였다가, 그 수정으로 처음 실행 가능해진 것이다.

## Unreleased — 멱등 캐시 fail-open 을 **알람 걸 수 있게** 만든다 (`clemvion.redis.fail_open`)

`IdempotencyInterceptor` 의 fail-open 다섯 경로는 warn 로그만 남겼다. 로그는 사후 조회는 되지만
**비율·추세로 알람을 걸 수 없다** — 운영이 "지금 멱등성이 꺼져 있다" 를 알아채려면 사람이 로그를
들여다봐야 했다.

OTel 카운터 `clemvion.redis.fail_open{component,reason}` 을 추가하고 다섯 경로에 배선했다:
`get_failed` · `set_failed` · `serialize_failed` · `entry_corrupt` · `payload_corrupt`.

**경로별로 `reason` 이 갈리는 것이 요점**이다. 다섯을 한 라벨로 뭉치면 카운터는 올라가도 "무엇이
고장났는지" 를 알람이 구분하지 못한다 — Redis 가 죽은 것과 캐시가 오염된 것은 대응이 다르다.
라벨 값은 코드가 정하는 **닫힌 집합**이라 Prometheus label cardinality 가 늘지 않는다.

예: `rate(clemvion_redis_fail_open{component="idempotency"}[5m]) > 0` 으로 저하 구간을 잡고,
`reason` 으로 원인을 가른다.

`OTEL_ENABLED` 미설정 시 `getMeter` 가 no-op meter 를 주므로 비활성 환경에서도 무동작이다.

## Unreleased — chat-channel 이 `필수` 로 약속한 update dedup 이 통째로 미구현이었다 (CCH-SE-02)

`ChannelUpdate.idempotencyKey` 는 provider 파서 3종(telegram·slack·discord)이 채우기만 하고 **읽는 곳이 0곳인 dead
field** 였다. 즉 "동일 `update_id` 30초 안 재도착은 무시" 라는 `필수` 요구사항에 구현이 없었다.

**사용자 영향**: provider 는 webhook 이 2xx 를 못 받으면 같은 update 를 재전송한다. 종전에는
그 재전송이 그대로 처리돼 **같은 입력이 두 번 dispatch** 됐고 workflow 가 중복 재개됐다.
이제 30초 안 재도착은 무시된다(`202 ignored`).

`ChatChannelDedupService` — Redis `SET NX EX 30`(원자적), 키
`cc:dedup:<triggerId>:<updateId>`. 배선은 `parseUpdate` 직후이자 **rate-limit 앞**이다 —
재도착은 새 트래픽이 아니라 같은 트래픽이라 쿼터를 소비하면 안 된다.

**HTTP `IdempotencyInterceptor` 로는 막을 수 없다** — chat-channel inbound 는
`scope: 'in_process_trusted'` 로 서비스를 직접 호출해 그 인터셉터를 통과하지 않는다.
spec 문면도 그렇게 읽히던 것을 실제 메커니즘으로 정정했다.

Redis 미가용/에러 시 fail-open(+warn) — 그 구간엔 중복 처리가 가능하다는 뜻이라 조용히 넘어가지
않는다.

## Unreleased — 캐시 엔트리의 `statusCode` 가 HTTP 코드가 아니면 요청이 500 이 됐다

앞 항목이 엔트리의 **형태**를 검사하게 했지만 `statusCode` 는 `typeof === 'number'` 까지만
봤다. `-1`·`0`·`600`·`200.5` 같은 값이 통과해 `res.status(-1)` 이나
`new HttpException(payload, -1)` 로 흘러가고, express 가 전송 시점에 `RangeError` 를 내
**500** 이 된다 — 손상 엔트리 하나가 요청을 죽이는, 앞 항목이 없애려던 형태 그대로다.

**클라이언트 영향**: 그런 엔트리를 만난 요청이 이제 손상으로 판정돼 **정상 처리**된다.
이 API 자체는 100~599 밖 코드를 만들지 않으므로 정상 운영에서는 관측되지 않는다.

함께 `readKey`/`hashBody` 의 경계 동작을 테스트로 고정했다 — 키 길이 상한(200) 경계 양쪽 ·
공백뿐인 키 · trim 동등성 · body `undefined`/`null` 동등성 · 키 순서 의존(문서화된 계약).

> 부수 확인: **중복 `Idempotency-Key` 헤더는 배열이 아니라 `"a, b"` 조인 문자열로 들어온다**
> (Node `http` 는 `set-cookie` 만 배열로 둔다 — raw socket 프로브로 실측). 조인 문자열은
> 그대로 유효한 키가 되며 결정적이라 멱등성은 성립한다.

## Unreleased — 캐시 엔트리 안쪽이 깨지면 요청이 500 이 됐다 (멱등 캐시 fail-open 완성)

`IdempotencyInterceptor` 가 캐시 엔트리 **바깥** JSON 은 `try/catch` 로 막으면서 **안쪽**
`responseJson` 은 재현 분기 두 자리에서 맨몸으로 파싱했다. 엔트리가 깨져 있으면 그
`SyntaxError` 가 그대로 올라가 `GlobalExceptionFilter` 가 **500** 으로 마스킹한다.

**클라이언트 영향**: 손상된 캐시 엔트리를 만난 요청이 종전에는 `500` 으로 실패했고, 이제는
그 엔트리를 버리고 **정상 처리**된다(응답은 캐시가 없었을 때와 같다). 캐시가 손상됐다고 요청이
죽는 것은 이 인터셉터의 fail-open 원칙과 반대였다.

**파싱 순서가 계약이 됐다** — payload 파싱은 `bodyHash` 판정 **뒤**다. 앞에 두면 손상된
엔트리에서 `409 IDEMPOTENCY_KEY_CONFLICT` 가 조용히 사라지고 두 번째 body 가 새 응답을 받는다.
payload 가 깨졌든 아니든 "이 키가 이미 다른 body 로 쓰였다" 는 사실은 그대로이기 때문이다.

**문법이 유효한 비-객체 엔트리도 함께 막았다** — `JSON.parse` 는 문법 오류에만 던지므로
`"null"`·`"42"`·`"[]"` 같은 값은 통과한 뒤 필드 접근에서 깨진다. 특히 `"null"` 은 `TypeError`
로 **500** 이 됐다(이 항목이 없애려던 바로 그 형태). 이제 엔트리의 형태를 명시로 검사한다.

함께 **바깥 엔트리 손상도 이제 warn 을 남긴다** — 종전에는 조용히 강등돼, 캐시가 계속 깨지는
상황이 멱등성이 꺼진 상태와 구분되지 않았다. 이로써 이 클래스의 fail-open **다섯 경로 중
넷**(GET 실패 · SET 실패 · 직렬화 실패 · 엔트리/payload 손상)이 warn 을 남긴다. 나머지 하나인
기동 시 미주입(생성자 `null`)은 **장애가 아니라 설정 상태**라 warn 대상이 아니다.

## Unreleased — (보안) 멱등 캐시 키를 execution + route 로 스코프 — cross-execution 응답 재생 차단 (Spec EIA §R8 "캐시 키 스코프")

멱등 캐시 키가 `Idempotency-Key` **헤더 값 하나에만** 바인딩돼 있어, 캐시 네임스페이스를
**모든 execution 이 공유**했다. 서로 다른 두 요청자가 같은 키 + 같은 body 를 쓰면 한쪽의
캐시된 응답이 다른 쪽에게 재생된다.

`interaction:idempotency:<key>` → `interaction:idempotency:<executionId>:<route>:<key>`

**클라이언트 영향은 없다** — 같은 키로 같은 execution 에 재요청하는 정상 사용은 그대로
재현된다. 달라지는 것은 *다른* execution 이 같은 키를 썼을 때뿐이다.

**두 축이 닫힌다.**

- **execution 축**: 요청자 B 가 자기 execution 에 정당한 토큰으로 A 와 같은 키·같은 body 를
  쓰면 캐시 hit 이 되어 **B 의 명령이 서비스에 닿지도 않은 채** A 의 응답이 반환된다. B 는
  `202 accepted` 를 받으므로 유실을 인지하지 못하고, A 의 응답 body 가 B 에게 노출된다.
  `InteractionGuard` 가 인터셉터보다 먼저 도니 인증 우회는 없다 — 깨지는 건 그 다음이다.
- **route 축**: 같은 인터셉터가 `interact`·`cancel` 두 자리에 붙는데 `CancelDto` 는 전 필드
  optional 이라 body `{}` 가 가능하고, 그때 `bodyHash` 가 `{}` 인 interact 요청과 일치한다.

**스코프 단위는 토큰이 아니라 execution 이다.** jti 로 스코프하면 `/refresh-token` 으로 토큰이
회전한 뒤의 재시도가 다른 키로 떨어져 `EIA-RL-02` 가 보장하려는 바로 그 시나리오를 깬다.

`req.interaction` 이 없으면(Guard 미적용 등) **전역 키로 fallback 하지 않고 캐시 자체를
건너뛴다** — 조용한 fallback 은 위 표면을 그대로 되살린다. 이 인터셉터의 다른 실패
경로(Redis 미주입·GET/SET 실패·직렬화 실패)와 같은 fail-open 이다.

**배포 전환기**: 키 포맷이 바뀌므로 배포 시점에 남아 있던 구-포맷 엔트리는 조회되지 않고
고아로 남아 TTL(24h)로 자연 소멸한다. 그 창 동안 같은 키의 재요청이 **한 번** 캐시 미스로
재처리될 수 있다. 데이터 오염은 없다.

## Unreleased — `Idempotency-Key` 로 `409`·`410` 을 재조회해도 같은 응답이 나온다 (Spec EIA §R8 정합)

`Idempotency-Key` 캐시 적재 조건이 `statusCode >= 400` 이라 **`409 Conflict` 와 `410 Gone` 이
캐시에서 함께 빠지고 있었다.** 그래서 같은 키로 재요청하면 캐시 재현 대신 다운스트림이 매번
다시 돌았고, 그만큼 `EIA-RL-02`("동일 키 24h 동일 응답 재현")가 그 범위에서 지켜지지 않았다.
2026-05-21 최초 구현부터 있던 결함이다.

Spec EIA §R8 이 정한 캐시 대상은 **닫힌 목록** — `2xx` · `409 Conflict` · `410 Gone` — 이고,
그 열거를 그대로 조건으로 옮겼다.

**조건식만 바꿔서는 고쳐지지 않았다.** `409`·`410` 은 서비스가 `ConflictException`/
`GoneException` 으로 **throw** 하므로 RxJS **error 채널**로 흐르는데, 인터셉터의 캐시 적재는
`tap({ next })` 하나뿐이라 그 채널을 아예 보지 못했다. 게다가 컨트롤러가 `@HttpCode(202)` 라
성공 경로의 `res.statusCode` 는 202 로 선고정돼 있어 `statusCode === 409` 는 성립할 수
없었다. 그래서 적재 경로를 `catchError` 로 확장하고, 캐시 히트 시에도 `409`/`410` 은
**예외로 재현**하도록 고쳤다 — 성공 채널로 돌려주면 원래 409 였던 응답이 202 로 바뀐다.

`409`·`410` 을 캐시하는 것이 옳은 이유는 그것이 **확정된 결과**이기 때문이다. "이미 다른
명령이 상태를 바꿨다"(`STATE_MISMATCH`)나 "execution 이 종결됐다"(`EXECUTION_TERMINATED`)는
사실은 번복되지 않으므로 재조회하면 같은 답이 나와야 한다. 반대로 `400 VALIDATION_ERROR` 는
form 수정 후 재제출이 정상 흐름이라 캐시하면 stale 에러를 돌려주고, `5xx`·그 밖의 `4xx` 는
재시도가 의미 있는 실패라 캐시하면 재시도 자체가 막힌다 — 셋 다 제외 대상이다.

**클라이언트 영향**: 같은 `Idempotency-Key` 로 `409`/`410` 을 받은 뒤 재요청하면 이제 24h
동안 동일 응답이 재현된다. 종전에는 매번 새로 처리돼 응답이 달라질 수 있었다.
단, `requestId` 는 예외 필터가 매 응답마다 새로 발급하므로 재현 대상이 아니다 —
`statusCode`·`code`·`message` 가 동일하게 재현된다.

## Unreleased — Redis 런타임 장애가 External Interaction API 를 500 으로 무너뜨리던 결함 수정

`Idempotency-Key` 캐시 조회(`GET`)가 런타임에 실패하면 그 예외가 그대로 응답 스트림으로
흘러 요청이 **500** 이 됐다. 멱등성은 부가 기능인데 Redis 연결이 끊기는 순간 External
Interaction API 전체가 함께 죽는 구조였다.

`spec/data-flow/15-external-interaction.md` 는 "Redis … blacklist · idempotency · seq ·
BullMQ. 전 경로 fail-open (warn) — 가용성 우선" 을 요구한다. 그런데 그 보장이 실제로 걸려
있던 곳은 **기동 시 미주입**(클라이언트가 아예 없을 때) 하나뿐이었고, 연결이 살아 있다가
끊기는 경로는 열려 있었다. 조회 실패를 **캐시 미스로 강등**해 세 경로(미주입 · 조회 실패 ·
적재 실패) 모두 규약대로 열리게 했다.

**운영상 유의점**: fail-open 이 도는 동안에는 같은 `Idempotency-Key` 의 재요청이 전부 캐시
미스로 판정되므로 **중복 억제가 무력화**되고 다운스트림이 중복 실행될 수 있다. Redis 장애
구간에서 멱등성은 보장이 아니라 best-effort 다 — `EIA-RL-02`(동일 키 24h 동일 응답 재현)는
정상 경로의 계약이다.

## Unreleased — 워크스페이스 멤버십 검증 누락(cross-tenant) 보안 수정 + intra-tenant 권한 정합

`@Roles()` 가 없는 라우트(HTTP 222건 중 73건)는 워크스페이스 멤버십을 전혀 검증하지 않고 있었다
— 인증된 아무 사용자나 `X-Workspace-Id` 헤더를 위조해 타 워크스페이스 리소스를 열람·조작할 수
있었다(cross-tenant, P0). `RolesGuard` 를 "역할 계층 검사만 `@Roles()` 에 의존, 멤버십 검사는
항상 수행"으로 재구성해 opt-in 데코레이터 모델을 구조적으로 opt-out 불가능하게 닫았다 — 새
라우트가 추가돼도 코드 변경 없이 자동으로 멤버십 검사를 받는다.

같은 취약점의 두 번째 조각(intra-tenant — 멤버이지만 viewer 가 mutation)을 §3.2 권한 매트릭스와
대조해 8개 핸들러에 개별 `@Roles('editor'|'viewer')` 를 부착했다:

- `edges` `create`/`remove`, `nodes` `create`/`update`/`remove`, `executions` `stop`,
  `triggers` `rotateBotToken` → `editor` 이상
- `knowledge-base` `search` (POST 이지만 의미상 조회) → `viewer` 이상

**하위 호환성 파괴 (의도됨)**: 위 6개 mutation 엔드포인트(`editor` 요구)에서 종전에 200 을 받던
viewer 역할 사용자의 직접 API 호출은 이제 403 을 받는다. spec §3.2 가 애초에 Viewer 를 `R`
(read-only)로 규정하므로 이는 스펙 정합화이지 회귀가 아니다 — viewer 가 mutation 을 할 수
있었던 것 자체가 결함이었다. FE 는 canvas 노드/엣지 편집이 이미 `POST /workflows/:id/save`
(기존부터 `@Roles('editor')`) 하나로 저장되므로 개별 `edges`/`nodes` CRUD 엔드포인트에 대한
직접 호출부가 없어 영향이 없다. 단 실행 중단(Stop) 버튼은 `canEdit` 가드가 없어 viewer 에게
노출된 채 항상 403 으로 실패하고 있어 이번에 함께 가드했다
(`codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`).

부수로 두 가지를 함께 정리했다. (1) 전역 가드가 워크스페이스와 무관한 API(`system-status`
등)에까지 헤더를 읽어 403 을 내던 회귀 — FE `apiClient` 가 `X-Workspace-Id` 를 **모든** 요청에
붙이기 때문에 드러났다. 라우트가 `@WorkspaceId()` 를 실제로 소비하는지 reflection 으로 확인해
검증 대상을 좁혔다. (2) 가드와 데코레이터가 각자 계산하던 워크스페이스 컨텍스트 해석을 공용
헬퍼(`common/utils/workspace-context.util.ts`)로 추출 — "가드가 검증한 값" 과 "핸들러가
소비하는 값" 이 갈라질 수 없게 했다.

그 reflection 이 깨지면 멤버십 검증이 **조용히** 건너뛰어지므로(fail-open), 부팅 시 소비
라우트를 하나도 인식하지 못하면 기동을 멈추는 캐너리를 넣었다. `@nestjs/*` 는 caret 범위라
minor/patch 업그레이드가 이 가정을 깰 수 있다 — **업그레이드 PR 에서 이 경로 테스트가 깨지면
flaky 로 취급하지 말고 보안 회귀로 먼저 조사할 것.**

형식이 깨진 `X-Workspace-Id`(비-UUID)는 이제 **400 `VALIDATION_ERROR`** 다. 종전에는 그 값이
그대로 DB 로 흘러가 `invalid input syntax for type uuid`(SQLSTATE 22P02)가 났고, 예외 필터가
23505 만 매핑하므로 **500 INTERNAL_ERROR 로 마스킹**됐다 — 클라이언트 입력 오류가 서버 오류로
보였다. 이 결함은 개정 전 가드에도 있었고(`@Roles()` 라우트에서 동일), 이번 PR 은 표면이 아니라
응답을 정정한 것이다. nil UUID 처럼 **Postgres 가 파싱할 수 있는** 값은 그대로 통과시켜 403
(비멤버)이 400 으로 뒤바뀌지 않게 했다.

SoT: `spec/5-system/1-auth.md` §3.2·§3.3, `spec/data-flow/12-workspace.md` §Rationale. 추적:
`plan/complete/auth-workspace-membership-guard.md`,
`plan/in-progress/auth-guard-reflection-hardening.md`.

## Unreleased — 감사 로깅: 트리거 시크릿/토큰 회전·폐기 3종

CRUD 13개를 채운 뒤에도 남아 있던 감사 공백이다. `TriggersService` 의 회전/폐기 세 엔드포인트는
Editor+ 가 부를 수 있는 **특권 작업**인데 `recordAudit` 호출이 **0건**이었다(착수 전 실측) —
계정 탈취 후의 조용한 시크릿 교체를 `audit_log` 만으로 재구성할 수 없었다.

| 엔드포인트 | 액션 | 무효화되는 것 |
|---|---|---|
| `POST /:id/notification/rotate-secret` | `trigger.notification_secret_rotated` | 아웃바운드 HMAC 수신자 (24h grace) |
| `POST /:id/chat-channel/rotate-bot-token` | `trigger.chat_channel_bot_token_rotated` | 그 채널의 봇 세션 (24h grace) |
| `POST /:id/interaction/revoke-token` | `trigger.interaction_token_revoked` | 그 트리거로 열린 외부 대화 **전부** (grace 없음 — 즉시) |

1. **셋으로 갈랐다.** `integration.rotated` 처럼 한 액션 + `details.kind` 로 묶는 선례도 있지만,
   세 자격증명은 **폭발 반경이 서로 다르다** — 무엇이 회전됐는지를 `details` 를 열어야 알 수 있으면
   그 질문이 조회 필터·알림 규칙에서 사라진다. 근거는 `conventions/audit-actions.md §3` Rationale.
2. **액션명이 sub-channel 을 담는다.** HTTP 경로·엔티티 컬럼·스케줄러가 모두 그 접두를 쓰므로
   감사만 빼면 같은 사실이 표기 두 벌로 갈린다.
3. **`revoked` 는 `rotated` 와 다른 동사다.** 앞의 둘은 24h grace 로 구·신이 공존하지만 per_trigger
   토큰 재발급은 이전 토큰을 즉시 무효화한다.
4. **액터 배선이 없었다.** 세 컨트롤러 핸들러가 `userId` 를 받지 않고 있었다 — 그 변경이 기존
   테스트 17건을 깼고, 그 자체가 배선이 실제로 없었다는 증거다.

곁들여 `15-chat-channel.md` 에 박혀 있던 규약 위반 액션명(`chat-channel.rotate-bot-token` —
resource dot-prefix·언더스코어·과거분사를 동시 위반)을 정정했다.

## Unreleased — 감사 로깅 커버리지 확장: workflow / trigger / schedule / model_config

인증 spec §4.1 이 기록 대상으로 약속했지만 미구현이던 CRUD 감사 액션 13개를 구현했다. 착수 전
실측으로 `workflows`·`triggers`·`schedules`·`model-config` 네 모듈에 `AuditLogsService` import 가
**0건**임을 확인했다 — 설정·자동화의 변경 이력이 통째로 남지 않고 있었다.

신규 액션:

- `workflow.created`(생성 · 복제 `details.duplicatedFrom` · 가져오기 `details.imported`) · `workflow.updated` · `workflow.deleted`
- `trigger.created` · `trigger.updated` · `trigger.deleted`
- `schedule.created` · `schedule.updated` · `schedule.deleted`
- `model_config.create` · `update` · `delete` · `set_default`

시제는 도메인 관례를 따른다 — workflow/trigger/schedule 은 발생 사건이라 과거분사, model_config
은 `auth_config` 과 같은 설정 CRUD 라 현재형이다(`set_default` 가 과거분사로 부자연스러워
resource 단위 현재형으로 통일).

기록 시점은 **DB 커밋 직후**로 통일했다. 트랜잭션 안이나 외부 호출(secret store, BullMQ 등록)
뒤에 두면, 롤백·외부 호출 실패 시 "일어나지 않은 일이 감사에 남거나" "일어난 일이 안 남는다".

**`workflow.executed` 는 이번 범위에서 제외한다.** spec 의 Planned 표에 있으나 나머지와
카디널리티 차원이 다르다 — CRUD 는 저빈도지만 실행 기록은 트리거·webhook 발동마다 쌓인다.
`audit_log` 은 현재 보존 정책이 미정이고 정리 배치가 없어(`login_history` 와 대비), 보존 정책
결정과 묶어 별도로 다룬다.

SoT: `spec/5-system/1-auth.md` §4.1, `spec/data-flow/1-audit.md` §1.1. 추적:
`plan/in-progress/spec-sync-auth-gaps.md` §4.1.

## Unreleased — 워크플로우 복제가 nodes/edges 를 복사하지 않던 결함 수정

워크플로우 목록의 더보기 메뉴 → **복제**가 workflow 메타 row 만 INSERT 하고 `node`/`edge` 테이블은
전혀 건드리지 않아 **완전히 빈 워크플로우**가 생성됐다(신규 생성보다도 빈 상태 — Manual Trigger 자동
생성 경로조차 타지 않는다). 초기 스캐폴딩 이래 손대지 않은 미완성 구현이었다.

1. **캔버스 전체 복제로 재구현**: `duplicate()` 를 트랜잭션으로 감싸 원본 nodes/edges 를 새 UUID로
   재발급·재매핑해 사본으로 옮긴다(`importWorkflow()` 와 같은 재매핑 형태, import 전용 게이트는
   공유하지 않음 — 원본은 이미 신뢰된 데이터). 버전 이력·트리거(webhook/schedule)·테스트
   데이터셋은 승계하지 않는다.
2. **동시 편집 read skew 차단**: 원본 node/edge 조회 트랜잭션에 `REPEATABLE READ` isolation 을
   명시해, 복제 도중 동시 캔버스 저장이 끼어들어도 일관된 스냅샷을 읽는다
   (`executions.service.ts` 의 기존 선례 재사용).

SoT: `spec/data-flow/11-workflow.md` §1.5, `spec/2-navigation/1-workflow-list.md` §2.6. 추적:
`plan/in-progress/workflow-duplicate-nodes-edges.md`.

## Unreleased — retry_last_turn 재진입: 종결 경로 terminal 가드 + 원자 claim + 짝 전이 persist 수정

`#1022` 가 엔진에서 닫은 무가드 terminal 쓰기 결함 클래스를 `retry-turn.service.ts` 에서 닫는
작업으로 시작해, ai-review 10라운드에 걸쳐 인접 결함 3개 축을 함께 정리했다.

1. **종결 2경로의 guarded 전환**: `failRetryExecution` + `completeRetryExecution`(티켓은 1곳만
   지목했으나 전수 감사로 2곳 확인 — 후자가 더 나쁘다: 취소된 실행을 COMPLETED 로 덮고 완료
   이벤트까지 발행)을 공용 `finalizeGuarded` 로 통일. 행을 재조회해 정본 상태를 확인하고,
   전이 불가 또는 조건부 UPDATE 0행이면 저장·이벤트 발행을 모두 skip 한다. 취소 시각
   (`finishedAt`/`durationMs`)은 `stop()` 이 쓴 값이 정본으로 보존된다(SQL `COALESCE`).

2. **재진입 원자 claim**: `applyRetryLastTurn` 의 재진입 가드가 `findOneBy` → `if status`
   read-then-act 라 중복 배달(BullMQ stalled 재배달, worker concurrency 상향, multi-instance)
   에서 두 delivery 가 모두 통과했다. spawn row 의 `inputData._retryState` 를 조건부 UPDATE
   (`status='running' AND jsonb_exists`)로 원자 소비해 affected=1 인 delivery 만 진행한다.
   `continuation-execution.processor.ts` 가 `retry_last_turn` 을 공용 claim 에서 제외하며
   근거로 인용했던 "자체 멱등 가드" 주석의 자기모순도 함께 정정.

3. **짝 전이가 절대 persist 되지 않던 결함(가장 심각)**: `allowRetryReentry` opt-in 이
   in-memory `assertTransition` 만 통과시키고 **DB 가드에는 도달하지 않아**, 재진입의
   `FAILED → RUNNING` / `FAILED → WAITING_FOR_INPUT` 짝 전이가 **동시성 없이 매 호출 실패**
   했다. `NON_TERMINAL_STATUSES_SQL` 이 FAILED 를 배제하고 잠금 헬퍼는 `opts` 파라미터가
   아예 없었다. 세 잠금 소비처(`lockNonTerminalExecutionRow` · else 분기 guarded UPDATE ·
   `tryLockActiveExecutionAndSaveNodeExec`)에 opt-in 을 전파하고 상태머신 opt-in 을
   `FAILED → WAITING_FOR_INPUT`(turn 계속 → re-park, multi-turn 최빈 경로)까지 확장했다.
   `ALLOWED_TRANSITIONS[FAILED]` 는 `[]` 로 유지 — "실패 종결 실행의 우발적 부활 차단" 이
   설계 요지이므로 opt-in 만 넓힌다.

   이 결함이 8라운드 동안 발견되지 않은 이유는 **테스트 mock 이 행 잠금을 SQL·status 와
   무관하게 항상 성공으로 하드코딩**했기 때문이다("행 잠금 성공" 고정 주석까지 있었다).
   실제 조건을 평가하도록 고치자 즉시 재현됐다.

검증: 라운드별 mutation(누적 20종 이상) — 1차 실행에서 미검출이 나온 가드는 테스트를 추가해
잠갔다. 특히 "인자 shape 만 바뀌는 뮤턴트" 와 "표현식만 치환하는 뮤턴트" 의 차이 때문에 한 번
잠긴 줄 알았던 seam 이 실제로는 무검증이던 사례가 있었다(10R CRITICAL).

> **소급 정정 (2026-08-14)** — 위 **1번**의 `finalizeGuarded` 가 "전이 불가 또는 조건부 UPDATE
> 0행이면 저장·이벤트 발행을 모두 skip 한다" 고 서술한 방어 중 **0행 갈래는 `8332d9a20` 이전엔
> 발동한 적이 없다.** 그 판정이 `updateExecutionStatus` 의 반환값에 걸려 있는데, 그 함수가 raw
> `UPDATE … RETURNING` 결과를 행 배열로 오인해 항상 `true` 를 돌려줬다. "전이 불가" 갈래
> (`canTransition` 재조회 판정)는 정상 동작했다.
>
> 아래 "AI multi-turn resume turn 경계" 섹션 7번이 **같은 코드**를 다시 서술하며 동일한 정정을
> 달고 있다. 한쪽만 읽는 독자가 "검증된 동작" 으로 오인하지 않도록 양쪽에 적는다
> (`00_54_01` documentation WARNING 2). 근거·전수 목록:
> `plan/in-progress/update-returning-tuple-shape.md`.

## Unreleased — AI multi-turn resume turn 경계 cancel 가드 + park 짝 전이 lost-update 차단

#1021 의 노드 경계 cancel 가드(§2.3)는 **AI multi-turn 이 turn 마다 park 로 세그먼트를 끝내** 그 경계에 닿지 않는 갭을 남겼다 — turn 진행 중(LLM 호출 수 초~분) 사용자 Stop 이 조용히 무효화됐다.

1. **turn 경계 cancel 가드 도입(§2.3)**: `AiTurnOrchestrator.handleAiMessageTurn` 이 handler 호출 **이전**(§7.9 try/catch 밖)에 `assertExecutionNotCancelled` 를 직접 호출해 turn 경계에서 취소를 관측한다. try 안에 두면 `handleAiTurnError` 가 취소를 FAILED 로 오분류하는 함정(#1021 과 동형)을 피한다.
2. **park 짝 전이(`linkedNodeExec`) lost-update 차단**: `updateExecutionStatus` 의 짝 전이 분기는 M-3(else 분기 guarded UPDATE)에서 명시적으로 "범위 밖" 으로 남겨졌던 자리였다 — 살아있는 결함이었다. 턴 진행 중 Stop 이 DB 를 CANCELLED 로 마감해도, orchestrator 의 stale in-memory `execution.status`(RUNNING) 는 `assertTransition` 을 통과시켜 re-park 의 full-entity save 가 CANCELLED/finishedAt 을 덮어썼다. 같은 트랜잭션 안에서 행을 잠그고(`FOR UPDATE`) 비-terminal 을 재확인한 뒤에만 기존 save 를 수행하도록 고쳤다 — 잠금이 커밋까지 유지되어 검사-후-사용 race 도 닫힌다.
3. **짝 전이 `false` 반환 계약을 AI 경로의 모든 짝 전이 관측 경로가 소비**: 동시 Stop 이 위 가드를 선점하면 `updateExecutionStatus` 가 `false` 를 반환한다 — 이를 무시하면 취소된 실행이 정상 park/완료로 보인다. 각 소비처를 `assertLinkedTransitionApplied` 헬퍼로 통일해 (a) 짝이었던 `NodeExecution` 을 `markNodeCancelled` 로 terminal 마킹(영구 RUNNING 잔류 방지)하고 (b) `ExecutionCancelledError` 로 기존 취소 종결 경로에 전파한다. 최초 소비처(re-park·첫 turn park·retry-last-turn RUNNING 재claim)에 더해, `finalizeAiNode` RUNNING 유지 분기(코드 주석상 "정상 multi-turn 대화 종료의 주 경로")는 `updateExecutionStatus` 자체를 거치지 않는 **다른 메커니즘**이다 — Execution.status 가 RUNNING→RUNNING 이라 그 choke point 를 타지 않으므로, `tryLockActiveExecutionAndSaveNodeExec`(4차 라운드에 `assertActiveExecutionAndSaveNodeExec` 에서 개명 — non-throwing/bool 반환임을 이름에 명시)로 별도 원자화(같은 트랜잭션의 행 잠금 안에서 관측+`nodeExec` save)해 동일한 `false` 계약을 만든다(ai-review WARNING #1/#3, 2026-07-26 3차 라운드 — 최초엔 `assertExecutionNotCancelled` 단순 SELECT 로만 재관측해 검사-후-사용 창이 남았던 것을 이번에 완전히 닫았다). 잠금 조회(FOR UPDATE + 비-terminal 조건) 자체는 4차 라운드에 `lockNonTerminalExecutionRow` private 헬퍼로 `updateExecutionStatus` 의 `linkedNodeExec` 분기와 공유하도록 추출됐다(ai-review WARNING #1, 2026-07-26 4차 라운드). 정확한 소비처 목록·개수는 하드코딩된 값이 라운드마다 stale 해진 이력이 있어 `assertLinkedTransitionApplied` JSDoc(각 호출부 인라인 주석 참조)을 단일 진실로 삼는다 — 이 문서에는 고정 개수를 적지 않는다.
4. **`handleAiMessageTurn` turn 경계 cancel 가드 + `finalizeAiNode` `isFailed` 분기도 동일 계약으로 통일(5·6차 라운드)**: 위 3번 계약이 놓쳤던 두 지점 — turn 경계 가드(handler 호출 **이전** 관측)와 `finalizeAiNode` 의 `isFailed` 분기(자연 실패 종결, `tryLockActiveExecutionAndSaveNodeExec` 두 번째 호출부로 재사용) — 에도 "짝 NodeExecution 을 먼저 terminal 마킹한 뒤 throw" 를 확장해, 두 지점 모두 관측 없이 짝 `NodeExecution` 이 영구 RUNNING 고아로 남던 결함을 닫았다. `cancelParkedExecution`(WAITING 상태 취소) 자체의 Execution+NodeExecution 이중 UPDATE 도 개별 커밋 2단계에서 `markWebChatIdleTimeout` 과 동형의 단일 트랜잭션으로 원자화했다.
5. **`finalizeFailedExecution` 의 Execution 레벨 lost-update 차단(6차 라운드)**: 위 항목들이 `NodeExecution` 레벨 고아를 닫은 뒤에도, 최종적으로 top-level `Execution` 을 FAILED 로 마감하는 `finalizeFailedExecution` 은 여전히 상태-머신 가드 없이 무조건 full-entity `save()` 를 수행해, `finalizeAiNode` 의 `isFailed` 가드가 통과한 뒤~이 함수 도달 사이의 짧은 창에서 동시 Stop 이 이미 CANCELLED 로 커밋한 실행을 FAILED 로 덮어쓸 수 있었다(AI 턴 경로 전용이 아니라 `ExecutionCancelledError` 가 아닌 모든 에러가 지나가는 범용 종결 경로). 형제 `finalizeCancelledExecution` 과 동일하게 `updateExecutionStatus`(guarded UPDATE, `status IN (non-terminal)`) 경유로 바꾸고, 선점 시 `EXECUTION_FAILED` emit·`execution_failed` 알림 dispatch 를 함께 skip 하도록 했다.
6. **terminal 집합 인라인 열거 통합(`82b0d1561`) + 잔여 두 지점의 guarded UPDATE 전환(7차 라운드)**: `failFirstSegmentSetup`/`executeSync` timeout catch 가 각각 "terminal 이미 여부" 를 `COMPLETED`/`FAILED` 만 인라인 열거해 판정해, **CANCELLED 를 누락**했다 — 동시 Stop 으로 이미 취소된 실행/sub-execution 을 timeout·setup-throw 경로가 FAILED 로 덮어썼다(위 5번 항목과 같은 클래스). 이름 있는 단일 출처 `TERMINAL_STATUSES` 비교로 교체해 원소 추가/변경 시 자동으로 반영되게 했다. 이어서(7차 라운드, ai-review WARNING #1) 두 지점의 **쓰기 자체**도 형제 종결 헬퍼와 동일하게 무가드 full-entity `save()` 에서 guarded `updateExecutionStatus`(`status IN (non-terminal)`) 경유로 전환해, reload 이후의 좁은 SELECT~UPDATE TOCTOU 창을 마저 닫았다. reload 가 (극히 좁은 이중 DB 장애/소-timeoutMs 레이스로) 아직 RUNNING 진입 전인 PENDING 을 관측하는 경우는 상태머신이 PENDING→FAILED 를 의도적으로 금지하므로(`state-machine.spec.ts` "disallow pending -> failed") 강제로 우회하지 않고 best-effort 로 skip 한다 — `CoreEngineDriver` JSDoc 에 choke point 예외로 명시.

7. **`retry-turn` 종결 2경로의 무가드 terminal 쓰기 차단**: 위 항목들이 `execution-engine.service.ts` 에서 닫은 결함 클래스가 `retry-turn.service.ts` 에 남아 있었다. `failRetryExecution` 은 동시 Stop 이 이미 CANCELLED 로 마감한 실행을 **FAILED 로 덮어썼고**, 티켓에 없던 `completeRetryExecution` 은 더 나쁘게 **COMPLETED 로 덮고 완료 이벤트까지 발행**했다(전수 감사로 발견 — 티켓은 1곳만 지목했다). 두 곳을 공용 `finalizeGuarded` 로 통일했다. 이 서비스는 재진입 시작 시 로드한 `execution` 을 갱신하지 않고 `failed → running` 전이는 orchestrator 가 **다른 엔티티 인스턴스**에 적용하므로, stale 을 그대로 넘기면 상태머신이 자기 전이(`failed → failed`)를 보고 throw 한다 — 그래서 **행을 다시 읽어 정본으로 맞춘 뒤** `canTransition` 으로 판정한다(terminal 집합 인라인 열거 금지, 6번 항목과 같은 이유). 이미 목표 상태면 **상태 전이는 skip** 하되, 쓸 것이 없다고 보고 무가드로 통과시키면 이번 시도의 `error`/`finishedAt`/`durationMs` 가 조용히 버려지므로(재진입이 턴 시작 전에 즉시 재실패하면 Execution 이 `failed` 인 채로 도달한다) 그 값들은 **관측한 상태를 조건으로 건 guarded UPDATE** 로 다시 쓴다(그 사이 동시 cancel 이 상태를 바꿨으면 0행 매칭으로 무효화된다 — 2차 라운드 CRITICAL). 이 guarded UPDATE 자체도 `affected` 가 0이면(예: FAILED→RUNNING 재진입이 `allowRetryReentry` opt-in 으로 그 사이 row 를 옮긴 경우) 종결 이벤트 emit 을 skip 한다 — 그렇지 않으면 DB 는 RUNNING(새 턴 진행 중)인데 caller 가 종결 이벤트를 발행하는 사후 오시그널이 된다(3차 라운드 CRITICAL).

> **소급 정정 (2026-08-14)** — 위 **5·6·7번**이 "조건부 UPDATE 0행이면 저장·이벤트 발행을
> skip 한다" 고 서술한 방어는 **`8332d9a20` 이전엔 한 번도 발동하지 않았다.** 세 항목 모두
> terminal 전이를 `updateExecutionStatus` 로 태우는데, 그 함수가 raw `UPDATE … RETURNING` 의
> 결과를 행 배열로 오인해(`[rows, rowCount]` 튜플이 실제 shape) 반환값이 **항상 `true`** 였다.
>
> **1~4번은 해당하지 않는다.** 그쪽은 `linkedNodeExec` 짝 전이 계약(`FOR UPDATE` 로 행을
> 잠그고 재확인하는 SELECT 경로)이라 이 튜플과 무관하다. 6번도 절반만 해당한다 —
> `failFirstSegmentSetup` 은 반환값으로 분기하지만 `executeSync` timeout 은 반환값을 버린다.
>
> 무효화된 범위를 정확히 적는다 — **DB 쓰기 가드 자체는 정상이었다.** SQL 의
> `status IN (non-terminal)` 조건은 늘 붙어 있었으므로 terminal 행을 덮어쓰는 lost update 는
> 실제로 막혔다. 죽어 있던 것은 **호출부의 `persisted === false` 분기**(종결 이벤트 emit skip,
> `recordRunningSegmentStart` 보류)뿐이다. 즉 "데이터는 안 깨졌지만 선점당한 경우에도
> 이벤트를 발행했다".
>
> 근거·전수 목록(반환값을 소비하는 11곳 / 3파일):
> `plan/in-progress/update-returning-tuple-shape.md`.

SoT: `spec/conventions/node-cancellation.md` §2.3, `spec/5-system/4-execution-engine.md` §1.1/§1.2 (spec 갱신은 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #7 로 위임). 추적: `plan/in-progress/ie-resume-turn-boundary-cancel.md` · `plan/in-progress/retry-turn-terminal-guard.md`.

## Unreleased — 외부 cancel(Stop) 후에도 하류 노드 dispatch·부수효과가 계속되던 결함 수정

Stop 버튼(`POST /executions/:id/stop`)이 Execution 행을 `cancelled` 로 UPDATE 할 뿐 돌고 있는 노드 순회 루프엔 아무 신호도 보내지 않았다(AbortController·job cancel 없음) — 그 결과 취소 후에도 하류 노드가 계속 dispatch 되어 이메일 발송·HTTP POST·DB 쓰기 등 부수효과가 이어졌다.

1. **노드 경계 cancel 가드 도입(§2.3)**: `assertExecutionNotCancelled()` 가 노드 사이마다 Execution 행을 다시 읽어 외부 cancel 을 관측하고 `ExecutionCancelledError` 로 dispatch 를 중단한다. 최초엔 `runExecution`/`runNodeDispatchLoop`/`executeInline` 세 순회 루프에만 배치됐으나, 이어진 리뷰에서 드러난 갭 세 가지를 함께 닫았다:
   - **`executeInline` 가드가 무력화되던 결함**: 유일한 호출자 `WorkflowHandler` 의 catch 가 `ExecutionCancelledError` 를 삼켜 error 포트 출력으로 변환해(취소가 `SUB_WORKFLOW_FAILED` 로 오분류 + 하류 1홉 재개), `ParkReleaseSignal` 과 대칭으로 재throw 하도록 수정.
   - **컨테이너/Parallel 본문은 가드 범위 밖**이라 ForEach/Loop/Map·Parallel 브랜치 안에서는 Stop 이후에도 부수효과가 계속됐다 — `executeContainerBody`(아이템 경계마다)·`executeParallelBranchBody`(노드 경계마다)에 가드를 확장하고, `ForEachExecutor` 의 `errorPolicy:'skip'|'continue'` 가 취소를 "아이템 실패" 로 삼키지 않도록 재throw 가드를 추가했다.
   - **회귀 테스트 커버리지 0(mutation 실측)**: 가드 3곳 중 `runNodeDispatchLoop`/`executeInline` 은 가드를 제거해도 GREEN 이었다 — 두 경로 각각에 "하류 노드 미도달" 단위 테스트를 추가했다.
2. **취소 종결 시 `finishedAt`/`durationMs` 재마킹 방지**: `stop()` 이 이미 정확한 취소 시각을 커밋했는데, 엔진의 두 catch(`runExecution`·`finalizeResumedExecutionOutcome`)가 무조건 `finishedAt` 을 재계산해 늦은 시각으로 덮어쓰고 있었다. guarded UPDATE(이미 terminal 이면 no-op, M-3 규약)로 전환해 stop 이 쓴 값을 보존한다.
3. **Background 노드 본문의 부모 취소 오분류 수정**: 본문은 부모와 같은 executionId 를 공유해 §2.3 가드가 그대로 적용되는데, `executeBackgroundSubgraph` 의 catch 가 `ExecutionCancelledError` 를 일반 실패로 재throw 해 허위 `background_failed` 알림 + BullMQ 재시도를 유발했다. `ParkReleaseSignal` 과 동일하게 graceful 종료(swallow)하도록 수정.
4. **`EXECUTION_CANCELLED` emit 계약 통일**: 두 catch 가 공용 헬퍼 `emitCancellationEvent` 를 우회해 `cancelledBy` 필드 없이 emit 하던 것을 통일(`cancelledBy: 'user'`).
5. **성능**: `assertExecutionNotCancelled` 의 조회가 `findOneBy`(6개 JSONB 컬럼 포함 전체 row) 대신 `id`/`status` 2개 컬럼만 투영하도록 변경. 컨테이너 아이템 경계 호출부는 이어서 시간 기반 스로틀(200~300ms 권장 범위, 실채택 250ms)까지 추가해 대량 아이템 반복에서의 순차 DB 라운드트립 비용을 낮췄다(ai-review W10).

6. **스로틀 상태 Map 누수 수정(ai-review W14)**: 5번의 컨테이너 스로틀이 쓰는 `containerCancelCheckedAtMs` 는 execution 종료 시 정리되는데, Background 본문은 부모와 executionId 를 공유하면서 fire-and-forget 이라 **부모가 먼저 지운 뒤 다시 등록**돼 영구 잔류했다(싱글턴 서비스 필드 = 무한 성장). `executeBackgroundSubgraph` finally 에 정리를 추가해 정리 지점을 3곳으로 맞췄다.
7. **Sub-Workflow 노드의 취소 오분류·내부 메시지 노출 수정(ai-review W15)**: `executeNode` 의 범용 catch 가 `ExecutionCancelledError` 를 분류하지 않아, 취소된 Sub-Workflow 노드가 `failed` 로 저장되고 executionId 를 담은 내부 메시지가 `NODE_FAILED` 로 방출됐다. 취소를 별도 분기로 처리해 `cancelled` 로 마감하고 `NODE_CANCELLED` 를 발행한다(내부 메시지는 payload 에 싣지 않는다). 아무것도 하지 않고 재throw 하면 노드가 **영구 `running`** 으로 남아 타임라인이 계속 spinner 로 표시되므로, terminal 이벤트 발행을 함께 보장한다.
8. **재시도 정책 노드에서 취소가 재시도되던 결함 수정(ai-review 4R)**: `executeWithRetry` 의 재시도 제외 판정이 `isAbortError` 뿐이었는데 `ExecutionCancelledError` 는 `name` 이 `AbortError` 가 아니라 걸리지 않았다 — `errorHandling.policy: 'retry'` 가 붙은 노드에서 Stop 이 최대 3회 재호출 + 백오프(최대 7초) 뒤에야 수렴했다. 취소를 재시도 제외 대상에 추가했다.
9. **취소 시 `execution.error` 저장 금지(ai-review W16)**: `RetryTurnService.failRetryExecution` 이 WS emit 에서는 취소 시 `error` 를 제외하면서 DB 저장은 무조건 수행해, 내부 메시지가 REST `GET /executions/:id` 로 노출됐다. 두 경로의 정책을 일치시켰다.

SoT: `spec/conventions/node-cancellation.md` §2.3/§5.1. 추적: `plan/in-progress/node-cancellation-residual-signal-propagation.md`.

## Unreleased — 웹채팅 위젯: 재로드 복원의 `404`·복구불가 `401`/`410` REST 분기 ([3-auth-session §3.1-2·§R4](spec/7-channel-web-chat/3-auth-session.md))

spec 이 **동작을 확정 서술**해 두고도 비어 있던 자리다. `getStatus` 실패는 상태코드 구분 없이 전부 soft-fail 로 뭉개져 SSE 로 진행했다 — `404`(execution 소멸)에도 스트림을 열었고, 그 스트림은 아무것도 주지 않아 위젯이 `streaming` 에 무기한 고착됐다.

1. **`404` → 종료 확정**: storage 정리 후 `[ended]`. 없는 execution 에 SSE 를 여는 것이 고착의 직접 원인이었다.
2. **`401` → 낙관적 refresh 1회**: per_execution 토큰은 execution 종료 시 즉시 jti blacklist 되므로(EIA §8.3, EIA-AU-04) 재로드 `401` 은 단순 만료와 blacklist 를 **사전 판별할 수 없다**. §R4 의 결정대로 한 번 시도해 만료면 복구하고, 재차 `401`·`410` 이면 종료로 확정한다 — 항상 종료로 보면 정당한 만료 세션을 잃고, 항상 refresh 만 믿으면 blacklist 세션을 못 끊는다.
3. **refresh 가 `401`/`410` 이 아닌 이유로 실패하면 종료가 아니다 — 스트림만 미룬다**: 네트워크 오류·5xx 는 일시적이라 종료로 확정하면 살아있는 대화를 잃는다. 그렇다고 진행하면 서버가 방금 거부한 토큰으로 SSE 를 열어 원래 고치려던 고착을 재현한다. 그래서 **세션은 유지하고 스트림만 미뤄 둔 뒤, 주기 토큰 갱신이 성공하면 그때 연다**. 이 복구 경로는 두 군데가 비어 있어 실제로는 작동하지 않았고(갱신 성공 시 `openStream` 을 부르는 자리가 없었고, 갱신이 한 번 더 실패하면 재예약이 없어 사이클이 죽었다) 둘 다 닫았다 — 일시적 실패는 **지수 백오프로 무기한 재시도**(상한 5분)하고, `401`/`410` 은 재시도해도 못 사니 멈춘다.
4. **그 외 status·오류는 여전히 soft-fail**: 일시적 장애가 대화를 끝내지 않게 하는 경계다. `webchat-boot-single-flight` 이 "에러도 종료다" 로 해석했다가 **살아있는 대화를 영구 유실**시킨 사고가 있었고, 그 경계를 회귀 테스트로 고정했다.
5. **호출부는 refresh 후 `sessionRef.current` 를 읽는다**: `SeedOutcome` 은 "무엇이 바뀌었나" 를 실어 나르지 않아, 캡처해 둔 지역 변수를 쓰면 **서버가 이미 거부한 토큰으로 SSE 를 연다**(이 변경이 고치려던 증상을 성공 경로에서 재현). 리뷰 security·side_effect·requirement·testing **4명** 이 독립 수렴해 잡았고, 테스트 헬퍼가 EventSource URL 을 버리고 있어 통과시키던 것도 함께 고쳤다.

## Unreleased — 웹채팅 위젯: 단명 토큰이 콘솔로 새던 자리 + 부팅 실패가 조용히 삼켜지던 자리

SSE 는 `EventSource` 가 헤더를 못 실어 **토큰을 쿼리로** 보낸다(EIA §8.3). 그래서 스트림 오픈이
던질 때의 예외 메시지·이벤트 객체에 그 토큰이 실려 있고, 그걸 그대로 로깅하던 자리가 넷이었다.
`openStream` 진입점은 셋인데 방어는 한 곳에만 걸려 있었다 — 리뷰 두 라운드에 걸쳐 전수로 세었다.

1. **로그 redaction**: `redactToken`(`token=` 쿼리 값만 치환, 인접 파라미터 보존)을 재로드 복구·
   `start()`(`errMessage`)·복원(`applyConfig`) 세 경로에 모두 적용.
2. **SSE `onError` 는 원본 이벤트를 안 찍는다**: `e.target.url` 에 토큰이 있어 문자열 redaction 이
   닿지 않는다. 대신 `readyState` 만 남긴다 — 첫 판은 `e.type` 이었는데 그건 스펙상 항상
   `"error"` 라 **진단 정보가 0** 이었다(로그가 존재하던 이유를 없앴다).
3. **부팅 실패가 조용히 삼켜지지 않는다**: `applyConfig` 는 `void` 로 띄워져 throw 가 unhandled
   rejection 이었다(브라우저 기본 로거가 토큰을 찍는, 애플리케이션 방어가 닿지 않는 자리).
   catch 를 붙이면서 **`errMessage()` 를 통과시키고 `ERROR` 로 전이**한다 — 복원 분기는
   `RESTORED`(phase→`streaming`)를 먼저 dispatch 하므로, 삼키기만 하면 스피너 영구 고착이 된다.

위협 모델은 좁다 — 위젯은 cross-origin iframe 이라 **호스트 페이지 스크립트는 이 콘솔을 못 읽는다**
(초기 서술이 그렇게 적혀 있었고 틀렸다). 실제 노출면은 devtools·콘솔 수집 확장·버그리포트 덤프,
그리고 same-origin 임베드다. 좁아졌다고 단명 자격증명을 로그에 남길 이유는 없다.

## Unreleased — 웹채팅 위젯: 세션 ↔ 발급 `apiBase` 바인딩 (재전송 시 토큰 오전송 방지)

**선행 결함**(이번 변경이 만든 것이 아니다). `applyConfig` 재전송은 `clientRef` 를 새 `apiBase` 로 무조건 교체하는데, iframe-origin sessionStorage 의 저장 세션은 **옛 origin 에서 발급된** 단명 토큰을 들고 있었다. 세션과 엔드포인트의 축이 분리돼 있어, 재전송이 `apiBase` 를 바꾸면 옛 토큰이 새 origin 으로 전송될 수 있었다. 오늘 무해했던 이유는 유일한 재전송 경로(관리자 라이브 미리보기)가 `apiBase` 를 바꾸지 않기 때문일 뿐이다.

1. **세션을 발급 origin 에 묶는다**: `PersistedSession` 에 `apiBase` 를 저장하고, 복원 시 현재 `apiBase` 와 대조해 **불일치하거나 기록이 없으면 폐기**하고 새 세션으로 시작한다. 기록이 없는(구버전) 세션도 폐기하는 것은 fail-safe 다 — 발급 origin 을 증명할 수 없는 세션을 통과시키면 이 결함이 그대로 남는다. 비용은 배포 직후 새로고침 시 대화 1회 초기화이고, 반대편 비용은 토큰 유출이다.
2. **비교 규칙**: 후행 슬래시만 정규화하고 **경로는 보존**한다(`apiBase` 는 `/api` 등 경로 포함이 정상이라 origin 만 비교하면 `…/api` 와 `…/api-v2` 를 같다고 보게 된다). 이 정규화는 `lib/api-base.ts` 로 단일화해 `joinUrl`·`fetchEmbedConfig` 와 규칙을 공유한다.

## Unreleased — 웹채팅 위젯: 마지막 `wc:boot` 적용(§3(재전송))

host 는 iframe 재생성 없이 `wc:boot` 을 재전송해 boot config 를 갱신할 수 있고, spec 은 **"위젯은 마지막 `wc:boot` 의 config 를 적용"** 한다고 정한다(`2-sdk §3(재전송)`). 그 계약이 구현돼 있지 않았다 — 겹친 부팅에서 **`embed-config` 왕복의 resolve 순서가 승자를 정했다**(먼저 보낸 config 가 나중에 응답하면 그게 이겼다). 부팅 시도 세대를 도입해 나중 `wc:boot` 이 앞선 시도를 대체하게 했다.

1. **마지막 config 적용(§3(재전송))**: 겹친 부팅에서 나중 `wc:boot` 이 앞선 시도를 대체한다. 대체된 시도는 config 를 적용하지도, 차단 화면을 띄우지도, 접수된 "새 대화" 를 이행하지도 않고 물러난다 — 그 리셋 요청은 소실이 아니라 **다음 성공하는 부팅으로 이월**된다.
2. **재전송이 활성 대화를 방해하지 않는다**: 종전엔 재전송마다 저장 세션을 다시 복원해 `getStatus` 재조회·SSE 재오픈·입력 표면 재시드가 일어났다 — 사용자가 답을 입력하던 중 화면이 되감겼다. 이제 스트림이 이미 확립돼 있으면 복원 분기를 통째로 건너뛴다(재전송은 config 만 갱신한다).
3. **지연 도착한 `getStatus` seed 가 화면을 되감지 않는다**: 겹친 부팅(또는 eager `start()` 와 재전송)이 각자 `getStatus` 를 낸 뒤 뒤늦게 도착한 응답이, 다른 시도가 SSE 로 이미 전진시킨 대화 표면을 **옛 노드로 되돌렸다**(사용자가 그 표면에 답하면 지나간 노드로 명령이 나가 고착). 이제 **스트림이 이미 열렸으면 SSE 가 표면의 단일 진실**이라, 지연 seed 는 표면을 그리지 않는다(`sessionEstablished()` 가드). 반대로 **아무도 스트림을 안 열었으면**(예: 아무것도 복원 못 하는 no-op 재전송이 `start()` 의 webhook 중 끼어든 경우) `start()` 자신의 seed 가 정상적으로 그린다 — 이 경계를 boot 세대 비교로 잡으려던 초기 시도는 그 no-op 재전송을 "내가 대체됐다" 로 오판해 **스피너에 영구 고착**시켰고(3인 재현), 스트림 열림 여부라는 직접 신호로 교체해 해소했다. **종료 확정은 이 가드를 타지 않는다** — 종료는 세계의 사실이라 대체된 시도가 발견해도 그대로 확정한다(버퍼 만료 구간에선 terminal SSE 도 다시 오지 않으므로).

SoT: `spec/7-channel-web-chat/2-sdk.md §3(재전송)`. 관리자 라이브 미리보기가 외형 폼 변경 시 이 재전송 경로를 쓴다.

## Unreleased — 웹채팅 위젯: 버퍼 만료 재동기화 + 종료 처리 일원화 (7-channel-web-chat §3.1)

EIA 5분 이벤트 버퍼 만료 신호(`execution.replay_unavailable`)는 서버 emit·위젯 리스너까지 있었으나 **소비 분기가 없어 no-op** 이었다. 배선하면서 드러난 세션 라이프사이클 결함들을 함께 정리한다.

1. **버퍼 만료 재동기화**: 위젯이 `execution.replay_unavailable` 수신 시 `getStatus` snapshot(EIA §5.3)으로 폴백해 현재 표면을 재동기화한다. 신호 자체는 종료가 아니므로 스트림·세션은 유지.
2. **gap 중 종료 감지 (사용자 가시 버그 수정)**: 버퍼 gap(≥5분) 안에 execution 이 종료되면 그 terminal 이벤트도 버퍼와 함께 유실돼 다시 오지 않는다(EIA `R-replay-unavailable`). 종전에는 위젯이 `streaming`("AI 응답 중" 스피너)에 **무기한 멈췄다** — 사용자 액션이 없는 구간이라 명령 410 을 통한 사후 복구도 닿지 않았다. 이제 스냅샷이 terminal 이면 세션 정리 + `[ended]` 전이 + host `conversationEnded` 통지를 수행한다. 같은 판정이 **세션 복원 시점**에도 적용되며, 종료 확정 시 SSE 재오픈·토큰 갱신 예약을 건너뛴다(무효 토큰 스트림·종료 세션 storage 부활 방지).
3. **종료 통지 중복 방지**: 종료 시퀀스를 `finalizeEnded(reason)` 로 일원화하고 `endedRef` 1회 가드를 도입했다. SSE terminal / REST 폴백 terminal / 명령 `410 Gone` / 사용자 종료 **네 진입점**이 이 가드를 공유해, 같은 종료에 대해 host 가 `conversationEnded` 를 2회 통지받지 않는다.
4. **cross-session staleness 가드**: 비동기 응답(`getStatus`·명령)이 도착하기 전 "새 대화"/"대화 종료" 로 세션이 **교체**되면 그 응답을 폐기한다 — 옛 세션의 지연 응답이 살아있는 새 대화를 오종료시키지(410) 않는다. `seedWaitingFromStatus` 는 3-state(`"ended"`/`"stale"`/`"continue"`) 반환으로 호출부가 후속 `openStream`/`scheduleRefresh` 진행 여부를 판정하도록 계약을 명시화했다(이후 재로드 REST 분기 작업에서 `"refresh_deferred"` 가 더해져 **4-state** 가 됐다 — 위 §재로드 복원의 `404`·`401`/`410` 항목).
5. **종료된 위젯 부활 버그 수정 (사용자 가시 버그 수정)**: 위 4번의 세션 **동일성** 검사는 교체는 잡았지만 **종료는 놓쳤다** — 세션 정리가 세션 참조를 null 하지 않기 때문에, 표면 시드 요청이 떠 있는 동안 SSE 종료 이벤트가 도착하면 뒤늦은 응답이 검사를 통과해 **이미 종료된 위젯을 입력 대기 표면으로 되살렸다**(재현 확인). 흩어져 있던 staleness 가드 4종(세션 동일성·start 전용 세대 카운터·부팅 지역 플래그·토큰 갱신 취소 플래그)을 **world 세대 토큰 하나로 통합**해, 종료·교체·언마운트를 구분 없이 전부 잡는다. 곁들여 드러난 동형 결함 둘도 함께 닫았다 — 시드가 네트워크 오류로 실패하는 경로가 세대 검사를 우회해 옛 세션이 스트림을 탈취하던 문제, 토큰 갱신 요청이 떠 있는 동안 새 대화가 시작되면 지연 응답이 방금 지운 세션 저장소를 되살리던 문제. 상태 리듀서에도 "종료된 대화는 입력 표면을 다시 열지 않는다" 최후 방어선을 추가했다.

SoT: `spec/7-channel-web-chat/1-widget-app.md §3.1`. 서버측 emit 은 기존(PR #: `sse-adapter.service.ts` `replayOrSignalUnavailable`) — 본 변경은 **클라이언트 소비 배선**이다.

## Unreleased — 사용자 가이드(/docs) 진입 시 워크스페이스 slug 무한 중첩 fix

사이드바 "사용자 가이드" 클릭 시 URL 이 `/w/<slug>/w/<slug>/…/docs` 로 매 리다이렉트마다 한 세그먼트씩 길어지며 가이드 페이지에 영영 도달하지 못하던 사용자 보고 회귀를 고친다.

1. **사이드바 nav 항목에 `workspaceScoped` 플래그 도입.** `navItems.map` 이 예외 없이 `buildWorkspaceHref(slug, href)` 를 적용해, 워크스페이스 **밖** 라우트인 `/docs` 까지 존재하지 않는 `/w/<slug>/docs` 로 만들었다. `spec/2-navigation/_layout.md §2.2` 각주("User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지")가 정의한 예외를 데이터에 고정해 선언 시점에 스코프가 드러나게 했다 — `/docs` 만 `false`.
2. **`(main)/[...rest]` catch-all 을 `/w/` 접두 경로에 대해 terminal 로.** 위 경로는 `w/[slug]` 하위에 `docs` 세그먼트가 없어 specific route 매칭에 실패해 catch-all 로 떨어지는데, 재부착 가드가 없어 slug 를 또 붙이며 무한 중첩을 **증폭**했다. 이제 `/w/<slug>` 단독은 그 워크스페이스 dashboard 로 forward(query/hash 보존), 그 외 `/w/…` 는 `notFound()` 로 종결한다(`spec/2-navigation/11-error-empty-states.md §1.3` "존재하지 않는 라우트 접근 → 404", 사이드바 유지). 접두를 떼고 재-forward 하는 대안은 `/w/<slug>/<미지>` → `/<미지>` → 다시 prefix → … ping-pong 무한루프라 미채택. 사이드바만 고치면 다른 소비처가 같은 실수를 할 때 루프가 재발하므로 두 겹을 함께 막는다.
3. **부수 fix**: `(main)/w/[slug]/page.tsx` 부재로 `/w/<slug>` 단독 경로도 같은 루프(`/w/a` → `/w/a/w/a` → …)에 빠지던 것을 함께 해소.
4. `buildWorkspaceHref` 는 **의도적으로 비-idempotent** 로 유지한다(근거를 `href.ts` docstring 에 기록) — 이미 `/w/…` 인 path 를 조용히 삼키면 호출자 버그를 은폐하고 `("team-a", "/w/team-b/x")` 의 정답이 정의되지 않는다. 대신 catch-all 의 terminal 가드가 이 클래스의 실패를 무한 리다이렉트가 아닌 **가시적 404** 로 떨어뜨린다.

> 검증: playwright e2e 신규 5건(사용자 보고 흐름 · stale `/w/<slug>/docs` 의 404 종결 · 워크스페이스 루트 forward). 유닛은 `useParams` 를 mock 하므로 실제 Next 라우트 매칭과 클라이언트 `notFound()` 실동작을 증명할 수 없어 브라우저 레벨 검증이 본질이다.

SoT: `spec/2-navigation/_layout.md §2.2`(User Guide 의 slug 밖 예외), `spec/2-navigation/9-user-profile.md §3`(URL slug = FE 라우팅 SoT), `spec/2-navigation/11-error-empty-states.md §1.3`(존재하지 않는 라우트 접근 → 404).

## Unreleased — AI Agent LLM chat 호출 app-level 타임아웃 (defense-in-depth, §12.16)

도구 payload 예산 가드레일의 후속(항목 B). payload 가드가 팽창發 hang 의 근본 원인을 막지만, 그 외(네트워크 지연·모델 stall)의 무기한 hang 백스톱이 없었다.

1. **AI Agent 의 모든 LLM `chat` 호출**(single-turn `executeSingleTurn` · multi-turn `processMultiTurnMessage` resume 포함)에 **호출당 app-level 타임아웃**을 적용한다. `LlmService.chat` 의 `opts.timeoutMs>0` 이면 `withTimeout`(자체 `AbortController`)이 race 로 throw(신규 에러 코드 없음). throw 의 error 포트 귀결은 turn 종류에 따라 비대칭 — multi-turn resume 은 orchestrator 가 §10 `LLM_CALL_FAILED`(retryable)로 분류, single-turn 은 일반 chat try/catch 부재로 현재 엔진 레벨 `FAILED`(single-turn LLM 에러 라우팅 기존 gap, 본 배선 스코프 밖). `LLM_TIMEOUT`(core error-codes) 은 Workflow AI Assistant 전용 taxonomy 로 ai_agent 미사용.
2. **신규 env `AI_AGENT_LLM_CALL_TIMEOUT_MS`**(기본 600000ms=10분, `0` 비활성). 단일 turn 이 정상적으로 10분을 넘기 어려워 정상 장기 생성 regression 없이 hang 만 상한하며 주요 provider SDK 기본 request timeout(~10분)과 정합. `.env.example` 등재.
3. **`ResumableMessageOptions.signal` 배선**: resume 턴 chat 에 abort signal 을 전파할 executor-side plumbing 을 열었다. **단 resume 경로에는 아직 abort 소스가 없어**(초기 실행만 `ExecutionContext.abortSignal` 보유) 대개 undefined 이며, 실제 취소 signal 전파는 `node-cancellation-infrastructure` 후속이다. timeout 백스톱은 signal 과 독립 동작. SoT: `spec/4-nodes/3-ai/1-ai-agent.md §12.16`, `spec/conventions/node-cancellation.md`.

## Unreleased — AI Agent 도구 정의 payload 예산 저장 시점 경고 (config-time graph warning)

선행 런타임 fail-fast 가드레일의 후속(항목 A). 런타임 fail-fast 는 노드 실행 시점에야 발동하므로, 워크플로 **저장·조회** 시점에 도구 정의 payload 팽창을 미리 경고한다.

1. **신규 backend-only graph warning `ai_agent:tool-payload-budget`.** 각 AI Agent 노드의 `presentationTools`·`mcpServers`(connected cafe24/makeshop 정적 카탈로그)로부터 config-time 도구 정의 payload 를 재현(런타임 `buildTools` 와 동일 매핑을 pure 함수로 추출·공유, drift 0)해 예산(`AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`_COUNT_MAX`) 초과를 `GraphWarningRuleResult` 로 표면화한다. generic MCP(`service_type='mcp'`)·비-connected 통합은 live connect 필요라 best-effort skip → 기본 severity `warning`(근사 오차단 회피).
2. **표면화는 조회 endpoint 전담**: `GET /workflows/:id/graph-warnings`(`getGraphWarnings`)가 결과 배열에 append(별도 응답 필드 신설 없음). frontend canvas 가드 ②(로컬 pre-evaluate)는 async 통합 조회 불가라 이 rule 을 계산하지 않는다(cross-node-warning-rules §5 backend-only 예외).
3. **신규 env `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`**(기본 false): true 면 저장 시 hard(또는 개수) 초과를 severity `warning`→`error` 로 승격해 `saveCanvas` 가 기존 `GRAPH_VALIDATION_FAILED`(400)로 저장을 차단한다(3중 가드 ①). 기본 off 시 `saveCanvas` 는 통합 조회 자체를 skip(도달 불가 차단 분기 비용 회피). saveCanvas 응답 계약은 불변(graph warning 미탑재).
4. i18n: `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` 한국어 템플릿 추가(backend-only rule 이라 P3-C-1 자동 스캔 사각지대 → 명시 등록). SoT: `spec/4-nodes/3-ai/1-ai-agent.md §4.2·§10`, `spec/conventions/cross-node-warning-rules.md §5·§8`.

## Unreleased — 채팅 채널 control-plane 안내 발송 per-provider escape (F-5 근본 fix, 5-system/15-chat-channel §4.1.1)

### 변경 사항

1. **채팅 채널 control-plane 안내를 발송 시 provider 별로 escape 한다** — `HooksService` 가 렌더러(`renderNode`)를 우회해 `adapter.sendMessage` 로 직접 발송하는 안내(`surfaceMismatch`/`executionStillRunning`/`groupChatRefusal`/`unsupportedMessageKind`/`help`/`formValidationFailed`/`formNextField`)는 종전에 provider별 escape 를 안 거쳐, telegram default 에 `\.` 를 baked-in 했고(→ slack/discord 에서 literal 로 노출되는 cross-provider 버그) operator override 는 [#950 F-5] 등록 시점 MarkdownV2 검증(`UNSAFE_TELEGRAM_MARKDOWN`)으로 막았다. 근본 해결로 `ChatChannelAdapter.escapeControlText(text)` 를 신설해 발송 직전 provider 표면에 맞게 escape 한다(telegram=`escapeMarkdownV2` / slack=`escapeSlackMrkdwn` `<>&` / discord=평문 identity). 이로써 default·operator override 모두 **평문**으로 작성하면 세 provider 에서 올바르게 렌더되고, slack/discord literal 노출 갭이 해소된다. **F-5(등록 시점 검증)는 제거**한다 — 발송 시 자동 escape 되므로 operator override 를 거부하는 검증이 오히려 불필요·역효과(평문 마침표 override 도 이제 통과). `LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`chat-channel/shared/markdown-v2.ts` 제거, telegram-baked default 를 평문으로 정리. F-5 는 이 근본 fix 를 예고한 interim 이었다(plan/complete/eia-command-waiting-surface-guard 백로그). **배포 마이그레이션 주의**: F-5(#950) 체제에서 telegram operator 가 escape 된 override(`\.`)를 저장했다면 배포 후 `escapeControlText` 가 재-escape 해 send 400(안내 유실) 가능 — #950 직후라 창이 매우 좁지만, 배포 전 `trigger.config.chatChannel.languageHints` 스캔(telegram + control-plane 7키에 `\` 포함 값 평문화)을 권장(1회성 ops). SoT: `spec/conventions/chat-channel-adapter.md` `escapeControlText` · `spec/5-system/15-chat-channel.md §4.1.1`.

## Unreleased — AI Agent 도구 정의 payload 예산 가드레일 (4-nodes/3-ai/1-ai-agent §4.2·§10·§12.15)

1. **AI Agent 노드가 LLM 에 노출하는 도구 정의(스키마) 전체의 직렬화 크기에 런타임 예산을 강제한다.** 배경: Cafe24 MCP 383도구 전량이 매 요청에 실려 ~118k토큰 프롬프트가 되고, 이게 provider 무관 LLM 타임아웃으로 번져 "응답 없음 / 무한 SDK 재시도"(6분 hang)로 나타난 회귀(#828 field-set 스키마 팽창 — 도구 **개수**는 불변이었고 **스키마**만 팽창해 개수 cap 만으론 못 잡음). 신규 `tool-payload-budget.ts` 의 `estimateAgentToolPayload`(직렬화 bytes 1차 지표 + approxTokens + provider 그룹별 "범인 지목")를 `buildTools` 직후 single-turn·multi-turn 공통 choke point 에서 강제한다.
2. **Behavior change (breaking): 예산 초과 시 LLM 호출 전 error 포트로 fast-fail 한다** — 신규 에러코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(`output.error.details.retryable: false`, `totalBytes`/`budgetBytes`/`toolCount`/`culpritProvider` 포함). 이 변경은 **이미 예산을 초과하는 대형 도구셋을 구성한 워크스페이스에만** 영향 — 그런 설정은 이전엔 (제거된) provider timeout 까지 조용히 hang 하다 실패했고, 이제는 즉시 명확한 에러로 종결된다. 정상 규모 도구셋은 영향 없음.
3. **신규 env 3종** (기본값은 위 회귀 재현 임계 대비 여유 있게 설정): `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`(기본 98304 — 초과 시 warn 로깅만), `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`(기본 262144 — 초과 시 fail-fast), `AI_AGENT_TOOL_COUNT_MAX`(기본 128 — 2차 sanity, byte 예산 이내라도 초과 시 hard 와 동일 취급). `.env.example` 에 `MCP_MAX_RESPONSE_BYTES` 선례 형식으로 등재.
4. **후속(본 PR 범위 밖)**: config-time 저장 경고(backend-only graph warning, `getGraphWarnings`/`saveCanvas` strict surface)와 resume 턴의 timeout/signal 배선은 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 로 분리했다 — 본 PR 은 런타임 fail-fast 가드레일에 스코프를 한정한다. SoT: `spec/4-nodes/3-ai/1-ai-agent.md §4.2·§10·§12.15`.
## Unreleased — EIA/WS 대기 표면 가드 후속 정리 (F-4/F-5/F-6)

### 변경 사항

1. **control-plane 안내 발송 구조 정리 (F-4)** — languageHints 3-level lookup resolver 3중 복제
   (`resolveFormOpenLabel`/`resolveSessionExpiredMessage`/`resolveSurfaceMismatchMessage`)를
   `makeLocaleResolver` factory 로 통합하고, `HooksService` 의 안내 발송 3종
   (`sendExecutionStillRunningNotice`/`sendSurfaceMismatchNotice`/`maybeNotifyIgnored`)의
   try/catch/warn 골격을 `sendBestEffortNotice` 로 추출했다. 순수 리팩터(동작 보존).
   `ChatChannelInboundService` 분리는 중장기 백로그로 유지.
2. **telegram control-plane raw-send 키 MarkdownV2 등록 검증 (F-5)** — `HooksService` 가 렌더러
   escape 없이 직접 발송하는 키(`help`/`groupChatRefusal`/`unsupportedMessageKind`/
   `executionStillRunning`/`surfaceMismatch`/`formValidationFailed`/`formNextField`)는 telegram 이
   `parse_mode: MarkdownV2` 로 보내므로, operator override 에 unescaped 특수문자가 들어가면 send
   400 → 안내 유실됐다. `provider === 'telegram'` 한정으로 등록 시점에 검증(`LanguageHintsRawSend
   Validator`)해 unescaped 특수문자 발견 시 `400 VALIDATION_ERROR`(`UNSAFE_TELEGRAM_MARKDOWN`)로
   거부한다. escaped(`\.`)·slack/discord·비-raw-send 키는 제외. defaults 의 telegram escape
   baked-in(`\\.`)이 slack/discord 에서 literal 로 노출되는 잔여 갭(발송 경로 per-provider escape 이관)은
   별도 백로그.
3. **WS continuation nodeId 검증 확장 (F-6)** — `execution.submit_message`/`end_conversation` 은
   frontend 가 대기 노드 `nodeId` 를 이미 싣는데 서버가 무시했다. F-1 과 대칭으로, WS gateway 가
   `data.nodeId` 를 publisher 로 forward 해 제공 시 대기 노드와 대조한다(불일치 → `INVALID_EXECUTION_STATE`
   ack). `click_button` 은 nodeId optional 을 받도록 확장했으나 frontend 미전송이라 실질 no-op,
   `execution.submit_form`·REST `/continue` 는 nodeId 파라미터 부재로 미적용. frontend 는 대기 노드의
   정확한 nodeId 를 싣으므로 정상 흐름은 무변경(stale/오지정 제출만 거부). §6-websocket-protocol §4.2 +
   실행 엔진 §7.5.1 커버리지 표 갱신. `expectedNodeId` 는 positional 유지(모든 실 caller 가 명시 전달 —
   options 객체화는 비차단 백로그). `plan/in-progress/eia-command-waiting-surface-guard.md` F-4/F-5/F-6.

## Unreleased — EIA `/interact` 명령의 nodeId 를 실제 대기 노드와 대조 (5-system/4-execution-engine §7.5.1)

### 변경 사항

1. **외부 EIA `/interact` 명령의 `nodeId` 가 실제 대기 노드와 다르면 409 `STATE_MISMATCH` 로 거부한다** (종전 202 → 409, behavior 변경) — spec §7.5.1 은 publisher lookup 키를 `execution_id + node_id + status='waiting_for_input'` 로 규정하고 "nodeId 미일치 → INVALID" 를 약속하지만, `assertNodeId` 는 `dto.nodeId` 의 **존재만** 검사하고 `resolveWaitingNodeExecutionId` 는 `exec+status` 로만 조회해 nodeId 를 무시했다. 그 결과 stale/오지정 nodeId 제출(예: UI 가 다음 노드로 넘어갔는데 이전 노드 대상 제출)이 **현재 대기 노드로 조용히 오적용**됐다(표면만 맞으면 통과). 이제 `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)` 가 caller 지정 nodeId 를 대기 `row.nodeId` 와 대조해 불일치 시 `InvalidExecutionStateError`(→ EIA 409 `STATE_MISMATCH`)로 거부한다. 이는 이미 EIA §5.1(`STATE_MISMATCH` "다른 nodeId")·`InteractDto.nodeId` JSDoc("대기 NodeExecution 의 graph node id 와 일치해야 한다")이 약속하던 계약의 구현이다. **커버리지**: 외부 EIA `/interact` 만 nodeId 를 지정해 검사받는다. chat-channel(`scope: 'in_process_trusted'`)은 **scope 단위**로 면제한다(고정 매핑 forwarding 은 nodeId 미상, form 제출은 nodeId 를 알더라도 동일 policy). 종전에 존재 검사만 만족시키던 `nodeId: 'chat-channel'` placeholder 는 제거했다. WS continuation·REST `/continue` 는 프로토콜/요청 설계상 nodeId 를 서버에 전달하지 않아 미적용(§7.5.1 커버리지 표, plan F-6 후속). 표면(interactionType) 매트릭스 검증은 모든 진입점에 그대로 적용된다. `plan/in-progress/eia-command-waiting-surface-guard.md` 후속 항목 F-1. SoT: `spec/5-system/4-execution-engine.md §7.5.1`.

## Unreleased — 채팅 채널 표면 불일치 명령에 graceful 안내 (5-system/15-chat-channel §4.1.1 surfaceMismatch)

### 변경 사항

1. **채팅 채널에서 대기 노드 표면과 맞지 않는 입력이 도착하면 사용자에게 안내를 발송한다** — 직전 표면-가드 작업(continuation 명령 ↔ 대기 노드 표면 검증)으로, Form/버튼 대기 중 자유 텍스트 등 표면 불일치 명령은 publisher 가 `STATE_MISMATCH` 로 거부하고 `HooksService.forwardToInteractionService` 가 warn 로그와 함께 삼킨다(그대로 throw 하면 webhook 5xx → provider 무한 재시도). 그러나 종전엔 사용자에게 **아무 피드백이 없었다** — 봇이 조용히 무응답. 이제 `languageHints.surfaceMismatch` best-effort 안내를 발송한다(chat-channel CCH-ERR-04 "silently swallow 금지" 관례 대칭). 신규 키 `surfaceMismatch`(KO/EN)를 `language-hint-defaults.ts` `SURFACE_MISMATCH_DEFAULTS` + `resolveSurfaceMismatchMessage`(`sessionExpired` resolver 패턴)로 추가하고, spec §4.1 예제·§4.1.1 표 + telegram 유저 가이드(KO/EN §7.4)에 등재했다. 이 안내는 EIA event 렌더러(provider 별 escape)를 거치지 않고 `adapter.sendMessage` 로 직접 발송되는 control-plane 메시지라(R4 의 "어댑터가 escape" 는 `renderNode` 경로 한정), telegram MarkdownV2 특수문자를 포함하면 raw 전송이 거부된다 — 따라서 default 는 세 provider(telegram/slack/discord) 모두에서 안전하도록 특수문자를 배제했고(단위 테스트가 canonical `escapeMarkdownV2` 로 불변식 강제), providers/telegram.md §5.8 에 이 non-escape 특성을 명시했다. 발송 실패는 swallow(warn) — 안내가 재시도 루프를 유발하지 않도록. `plan/in-progress/eia-command-waiting-surface-guard.md` 후속 항목 F-2. SoT: `spec/5-system/15-chat-channel.md §4.1.1`.

## Unreleased — 워크플로 편집기 엣지 분할(중간 노드 삽입) (3-workflow-editor/2-edge §4.1)

1. **팔레트에서 노드를 기존 엣지 위에 드롭하면 그 엣지를 분할(split)하고 중간에 노드를 삽입한다** (spec §4 "미구현 · Planned" → §4.1 구현). 원본 엣지(source→target)를 제거하고 `source→새 노드`·`새 노드→target` 두 엣지를 만든다. `workflow-canvas.tsx` `onDrop` 이 드롭 지점의 엣지를 순수 헬퍼 `findEdgeIdAtPoint`(DOM `.react-flow__edge[data-id]` hit-test, 뷰포트/RF 의존이라 store 밖 canvas seam, 주입 가능 doc 로 단위 테스트)로 찾고, 순수 헬퍼 `edge-utils.ts` `buildEdgeSplitPlan(edge, newId, def)` 이 두 신규 Connection 을 조립한다 — 새 노드의 첫 입력(`firstInputHandleId`, 예약 `emit` 제외)·첫 출력(`firstOutputHandleId`)을 쓰고 원본 `sourceHandle`/`targetHandle` 은 보존(다중 출력 If/Else·Switch, 다중 입력 노드여도 위상 불변). 두 엣지는 표준 `onConnect`(→`evaluateConnection`)를 재사용해 포트색·유효성이 그대로 적용된다. store `removeEdge` 에 `{skipUndo}` 옵션 추가(`onConnect` 대칭) → 노드 추가 `pushUndo` 1회 + 엣지 수술 skipUndo 로 **Ctrl+Z 1회에 삽입 전체(노드+엣지 2개 제거, 원본 엣지 복원)가 취소**된다(§1.2/§1.3 관행). **스코프(R-3)**: 입력·출력 포트를 모두 가진 **비-컨테이너** 노드 + plain 엣지만 분할한다 — (1) 무입출력 노드(트리거·순수 sink), (2) **새 노드 자체가 컨테이너**(Loop/ForEach/Map — 첫 출력이 `body` 라 target 을 새 컨테이너 본문 자식으로 재편입시킴), (3) 컨테이너 경계 엣지(`sourceHandle` `body` / `targetHandle` `emit`)는 `buildEdgeSplitPlan`→null 로 분할 없이 노드만 추가(§6·containerId 불변식 회피). `done` 은 Parallel Branch 도 일반 데이터 출력으로 써 경계에서 제외(핸들명 오배제 방지). 이 제외들 덕에 두 신규 Connection 이 `detectContainerConflict` 거부 분기(body/emit)에 절대 안 걸려 **onConnect 2회가 항상 성공**(removeEdge 후 반쪽 갱신 원자성 문제 구성적 해소). 착수 전 `consistency-check --impl-prep`(BLOCK:NO) WARNING 5건 + ai-review 1회차 CRITICAL(컨테이너 새 노드 body 재편입, side_effect·testing 발견)을 반영해 spec §4.1 신설 + `## Rationale` R-3 기록, 유저 가이드(connecting-nodes·canvas-basics ko/en) 동반 갱신. 테스트: `firstOutputHandleId`(2)·`isContainerBoundaryEdge`(body/emit/done-data/generic 4)·`buildEdgeSplitPlan`(핸들 보존·emit 제외·트리거·sink·컨테이너 경계·**컨테이너 새 노드**·**다중 출력** 8)·`findEdgeIdAtPoint`(주입 doc 4) + `removeEdge` skipUndo 1 + **store 분할 시퀀스 통합 3**(plain 분할 원자성=최종 엣지 2개·Loop body 내부 분할 시 새 노드 containerId 상속·undo 1회 완전 취소+undoStack=0). **부수 수정(ai-review 3회차)**: `buildAndAddNode` 가 자체 `pushUndo` + 내부 `addNode` 의 `pushUndo` 로 삽입 1회에 phantom 스냅샷 2개를 쌓던 잠재 결함(§1.2 도 공유)을 발견해 중복 `pushUndo` 제거(단일 체크포인트 정정). 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). 이로써 `spec-sync-edge-gaps` 5개 surface 전부 완료. SoT: `spec/3-workflow-editor/2-edge.md §4.1`.

## Unreleased — 워크플로 편집기 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (3-workflow-editor/2-edge §4/§5)

1. **실행 후 엣지에 마우스를 올리면 그 엣지로 흐른 데이터(연결원 노드의 출력)를 축약해 보여주는 Data Flow Preview 툴팁이 뜨고, "전체 데이터 보기" 클릭 시 전체 JSON 모달이 열린다** (spec §4 hover·§5 "미구현 · Planned" → 구현). 신규 `edge-data-preview.tsx`(`EdgeDataPreviewTooltip`/`EdgeDataModal`) + `use-edge-hover-preview.ts` 훅. `workflow-canvas.tsx` `onEdgeMouseEnter` 가 커서 위치에 툴팁을 예약하고, 툴팁은 엣지 source 노드의 최근 실행 출력(`findLatestResultByNodeId` → `unwrapNodeOutput().output`)을 축약해 보여준다(실행 데이터 없으면 렌더 안 함). 축약·바이트 계산은 순수 함수 `lib/utils/edge-data-preview.ts` `summarizeDataForPreview`(중첩 배열 `[N items]`·중첩 객체 `{N fields}`·긴 문자열·최상위 배열 앞 5개로 축약 + 원본 JSON 바이트) / `formatBytes`. 엣지 진입 시 짧게 지연(`SHOW_DELAY_MS=90`) 후 표시해 촘촘한 캔버스에서 커서가 여러 엣지를 스쳐 지날 때 정착하지 못한 엣지의 툴팁/직렬화를 건너뛰고(sweep 방어), 벗어나도 200ms 지연 후 숨겨 커서를 툴팁으로 옮겨 클릭할 수 있다. 모달은 hover 생명주기와 독립적으로(`dataModalEdgeId`) 열려 툴팁이 사라져도 유지되며, 전체 JSON 은 run-results 공용 `JsonContent` 를 재사용한다. UI 문자열은 `dict/{ko,en}/editor.ts` + `useT()` 로 localize(i18n ratchet 준수). 데이터 조회는 store 공유 selector `findLatestResultByNodeId`(O(1) `lastIndexByNodeId`). 바이트 크기는 직렬화 문자열이 100KB 이하면 정확 인코딩, 초과 시 `TextEncoder` 할당을 생략하고 char 수 하한 근사(`bytesApprox` → 툴팁에 `~` 표기)로 대용량 출력 hover 비용에 상한. 테스트: 순수 util 16(경계값·근사·빈 컬렉션) + `useEdgeHoverPreview` renderHook 6(sweep 취소) + `EdgeDataPreviewTooltip`/`EdgeDataModal` RTL 10(running/failed status 포함) + `findLatestResultByNodeId` store 4. 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §4·§5`.

## Unreleased — 워크플로 편집기 엣지 실행 상태 스타일 (3-workflow-editor/2-edge §3.2)

1. **실행 중·완료·비활성 상태를 엣지에 시각적으로 반영한다** (spec §3.2 "미구현 · Planned" → 구현). 신규 `use-edge-execution-state.ts` `useEdgeExecutionState` 훅이 실행 스토어(`status`/`nodeStatuses`)와 노드 `isDisabled` 를 읽어 각 엣지에 상태 스타일을 입힌다(판정 순수 함수 `edge-utils.ts` `resolveEdgeExecutionState`, 상호배타 우선순위 inactive > flowing/completed). **데이터 흐름**(실행 중 source `completed`+target `running`) → `className='edge-flowing'` → globals.css 가 데이터 방향 마칭 점선(`edge-flow` keyframe 재사용) 렌더. **실행 완료**(source·target 둘 다 `completed`) → `className='edge-completed'` → `edge-complete-flash` 1회성 keyframe 이 초록(#22c55e)으로 잠시 표시 후 원래 포트색으로 복귀. **비활성 노드 연결**(source/target `isDisabled`) → `edge.data.edgeInactive` → `custom-edge.tsx` 가 반투명(opacity 0.4) 점선 렌더(정적, 실행 무관). 실행 상태는 `useEdgeHighlighting`(§3.3 hover/선택) **앞단**에서 합성돼 className Set 병합으로 하이라이트와 공존한다. 성능을 위해 sibling 훅과 동일한 per-edge bail-out(상태 불변 엣지는 원본 참조 유지)+안정 disabled 키로 실행 tick·노드 드래그 시 전체 엣지 재생성을 피한다. 엣지 style 조립은 순수 함수 `buildEdgeStyle` 로 분리. 테스트: `resolveEdgeExecutionState` 9 + `buildEdgeStyle` 5 + `useEdgeExecutionState` renderHook 9. 실행 시각화는 `05-run-and-debug/running-a-workflow`(ko/en) "실행 상태 확인" 절에도 반영. 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §3.2`.

## Unreleased — 워크플로 편집기 엣지 역방향 연결 · 기존 엣지 재연결/분리 (3-workflow-editor/2-edge §1.3)

1. **기존 엣지의 끝점을 잡아 다른 포트로 끌면 재연결되고, 빈 영역에 놓으면 그 엣지가 삭제(분리)된다** (spec §1.3 "미구현 · Planned" → 구현). `workflow-canvas.tsx` 가 `onReconnect`/`onReconnectEnd` 두 콜백을 배선하고(로직은 신규 `use-edge-reconnect.ts` `useEdgeReconnect` 훅 — detach 결정을 renderHook 단위 테스트), React Flow 가 reconnectable 엣지의 앵커를 자동 렌더한다. store `onReconnect`(`editor-store.ts`)은 `reconnectEdge`(`shouldReplaceId:false` — 엣지 id 보존)로 갱신하고 `onConnect` 과 동일한 유효성(자기연결/중복/컨테이너 충돌 — 중복 검사는 재연결 중인 엣지 자신 제외; 공용 `evaluateConnection` 헬퍼로 두 경로 단일화)을 적용한 뒤 포트색 data·컨테이너 소속을 재도출한다. detach(빈 캔버스 드롭)는 store `removeEdge`(undo 가능) — `onReconnectEnd` 의 `connectionState.toNode` 가 null(=pane)일 때만 삭제하므로 무효 핸들 위 드롭(예: 자기연결)은 원상 유지된다. 재연결·삭제 각각 단일 undo 체크포인트.
2. **역방향 연결(입력 포트에서 드래그 시작 → 출력 포트에 드롭)은 React Flow strict `connectionMode` 기본 동작으로 이미 지원됨을 확인**했다 — 핸들에 `isConnectableStart`/`isConnectableEnd` 제약이 없고 React Flow 가 Connection 을 핸들 타입 기준으로 정규화(source=출력, target=입력)하며 `onConnect`/`isValidConnection` 이 direction-agnostic 이라, 드래그 방향과 무관하게 올바른 엣지가 생성된다. 커스텀 코드 불요(spec "미구현" 오기재 정정).
3. **부수 강화**: `edge-utils.ts` `firstInputHandleId`(§1.2 자동 연결 target)가 예약 입력 포트(컨테이너 `emit`, `RESERVED_INPUT_HANDLE_IDS`)를 건너뛰도록 했다 — 컨테이너 노드의 첫 입력이 `emit` 인 경우 자동 연결이 `detectContainerConflict` 에 거부돼 orphan 노드가 남던 latent 위험 해소(현행 노드 정의상 미발생이나 신규 컨테이너 대비). 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §1.3`.

## Unreleased — 워크플로 편집기 출력 포트 드래그→빈 영역 드롭 노드 추가 팝업 + 자동 엣지 연결 (3-workflow-editor/2-edge §1.2)

1. **출력 포트에서 드래그를 시작해 유효 target 없이 빈 캔버스 영역에 드롭하면, 드롭 위치에 노드 추가 검색 팝업을 열고 선택한 노드를 연결원의 출력 포트 → 새 노드의 첫 입력 포트로 자동 연결한다** (spec §1.2 "미구현 · Planned" → 구현). 종전엔 노드 추가 검색 팝업이 빈 캔버스 더블클릭·우클릭 메뉴(`add-node`)로만 열렸다. `workflow-canvas.tsx` `onConnectEnd`(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle` 기반) 배선 + `NodeSearchPopupState.dragSource` 로 연결원 기록 → `handleAddNodeFromSearch` 가 노드 생성(`buildAndAddNode` 신규 id 반환) 후 `onConnect` 자동 연결. **"노드 생성+연결"을 Ctrl+Z 1회로 함께 취소** — `onConnect` 에 `skipUndo` 옵션을 추가해 엣지 추가가 "노드-only" 중간 상태를 별도 undo 스냅샷으로 남기지 않게 했다(skipUndo 없이는 Ctrl+Z 가 엣지만 되돌려 고아 노드가 남음). 대상 노드에 입력 포트가 없으면(예: 트리거) 노드만 생성하고 연결은 생략. 판정·조립 로직은 순수 헬퍼(`edge-utils.ts` `connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId` + `isConnectionDroppedOnPane`)로 분리해 단위 테스트했다. 입력 포트 시작 역방향 드래그(§1.3)는 `fromHandle.type !== 'source'` 로 배제. 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §1.2`.

## Unreleased — 웹채팅 위젯 carousel 잘림 배너 + 총 개수 노출 (7-channel-web-chat/1-widget-app §2/R8)

1. **위젯 carousel 잘림 배너를 신설하고 잘리기 전 총 아이템 개수를 함께 노출한다** — table 잘림 배너(#921)와 대칭. 종전 `CarouselData` 에는 `truncated`/`totalCount` 필드가 없어 `asEnvelope` 가 흡수하던 `itemsTruncated`/`itemsTotalCount` 가 **소비처 없는 dead field** 였다(#901 이 4개 cap 키를 흡수하나 carousel 은 미소비). 이를 소비만 확장 — 백엔드·SSE wire·Presentation 공통 §10.4 무변경. `CarouselData.truncated`/`totalCount?`(유한 비음수 정수만 채택, table 과 공유하는 `asTotalCount` 헬퍼) 추가 + `toCarousel` 이 `output.itemsTruncated`/`itemsTotalCount` 투영 + `CarouselView` 배너(`wc-carousel-truncated`, `.wc-table-truncated` 와 CSS 공유). 배너 문구(위젯 로컬 i18n catalog ko/en): `총 N개 중 일부만 표시돼요.`(총 개수 있음) / `일부 항목만 표시돼요.`(폴백). 동일 정합으로 `asTotalCount` 는 `Number.isInteger` 를 포함해 `toTable` 의 총 개수 판정도 spec §R8("비음수 정수")에 맞춰 tighten 했다. **배포-시점 영향(코드 변경만, 서버 데이터 무변경)**: 배포 시점에 이미 잘린 기존 AI carousel 응답이 있으면 코드 배포 즉시 배너가 소급 노출된다. SoT: `spec/7-channel-web-chat/1-widget-app.md §2·R8·§4`.

## Unreleased — 웹채팅 위젯 chrome 문자열 EN 다국어화 (`locale` 활성, 7-channel-web-chat/1-widget-app §4)

### 변경 사항

1. **위젯 chrome 문자열(위젯 소유 UI 프레임 문자열)을 ko/en 다국어화하고 `BootConfig.locale` 을 활성화했다** — v1 비목표(Korean-only, `locale` reserved/inert)에서 목표로 승격(#922 가 "코드 변경 없음" 스코프상 defer 하고 `2-sdk §R6` 이 예약한 활성화 경로 실행). 위젯은 별도 정적 export 번들이라 메인 앱 `frontend/src/lib/i18n/dict` 를 import 할 수 없어 **위젯 로컬 경량 catalog**(`src/lib/i18n/` — `catalog.ts` ko/en 32키·`resolveLocale`·`I18nProvider`/`useTranslation`, `{{}}` 보간, ko/en parity hard-fail 테스트)를 신설했다. 언어 해석: **명시 `locale` → 브라우저 `navigator.language`(auto-detect) → `ko` fallback**, boot 시 1회 해석해 고정(변경은 iframe 재마운트로만). 번역 범위 = 위젯 소유 chrome 한정(세션 컨트롤·확인·입력창·상태/에러·잘림 배너·차트 aria-label·헤더 기본값) — 운영자 제공 콘텐츠(`headerTitle`·`welcome`·`disclaimer`)·backend payload·AI 본문은 비대상. **배포-시점 영향(코드 변경만, 서버 데이터 무변경)**: 운영 콘솔에서 이미 `locale='en'` 으로 저장된 위젯 인스턴스는 이번 배포부터 실제 EN chrome 을 렌더한다(종전엔 저장돼도 한국어 렌더). SoT: `spec/7-channel-web-chat/1-widget-app.md §4`.

## Unreleased — 웹채팅 위젯 table 잘림 배너 총 개수 노출 (7-channel-web-chat/1-widget-app §2/R8)

### 변경 사항

1. **위젯 table 잘림 배너가 잘리기 전 총 행 개수를 함께 노출한다** — 메인 편집기 run-results(`assistant-presentations-block`, `truncated · total N`)와 parity. 종전엔 `truncated: boolean` 만 소비해 `일부 행만 표시됩니다.` 고정 문구뿐이었다. 총 개수(`rowsTotalCount`)는 이미 `truncationMeta` 가 `output` 으로 흡수하던 **dead field** 였고(직전 truncation 수정 PR #901 이 4개 cap 키를 흡수하나 `rowsTruncated` 만 소비), 이를 소비만 확장한다 — 백엔드·SSE wire·Presentation 공통 §10.4 무변경. `TableData.totalCount?`(유한 비음수만 채택 — NaN/Infinity/음수/이형은 `undefined`→폴백) 추가 + `toTable` 이 `output.rowsTotalCount` 투영. **배너 문구가 바뀐다(고객사 임베드 영향 가능)**: `총 N개 중 일부만 표시돼요.`(총 개수 있음) / `일부 행만 표시돼요.`(폴백) — 같은 배너 라인의 기존 합쇼체 `…표시됩니다.` 를 위젯 관례(해요체)로 함께 교정. **범위**: table 배너 한정 — carousel 은 잘림 배너 자체가 미구현이라 별도 후속. SoT: `spec/7-channel-web-chat/1-widget-app.md §2·R8`.

## Unreleased — 공개 웹채팅 위젯 idle-wait execution 회수 reaper (EIA-RL-07, 5-system/14 §3.4·§R19)

### 변경 사항

1. **eager-start 후 이탈로 서버에 무기한 잔존하던 공개 위젯 `waiting_for_input` execution 을 회수하는 백엔드 backstop 을 추가했다** (§R9 결정의 PR-2, PR-1 위젯 coalesce/cancel 의 서버측 짝). 신규 `WebchatIdleReaperService`(BullMQ repeatable 분 단위, EIA-RL-06 `terminal-revoke-reconciler` 형제 패턴 — 전역 1회)가 `auth_config_id IS NULL`(익명 공개 위젯) + `per_execution` 토큰으로만 접근되는 `waiting_for_input` execution 중 **발급된 모든 토큰이 영구 만료**(`execution_token.exp_at` 전부 `< now − grace`)된 것을 회수한다. 판정 = provably un-continuable(익명 위젯은 만료 후 refresh 불가라 입력 도착 경로 소멸, §R19). 회수는 engine 신규 `markWebchatIdleTimeout`(멱등 조건부 UPDATE `WHERE status='waiting_for_input'` → `cancelled` + `cancelledBy='timeout'` + `error.code='WEBCHAT_IDLE_TIMEOUT'`, 동반 WAITING NodeExecution cancel, 후행 `execution.cancelled` emit) + `revokeAllForExecution`(EIA-RL-06 재사용). grace 는 `WEBCHAT_IDLE_REAP_GRACE_MS`(기본 1h) env. **soft-terminal** — hard-delete 아님, 이력·`GET /:id` 보존. §1.1 이 예약한 `waiting_for_input → cancelled` "타임아웃" 사유의 구현이라 §7.4 무기한 보존 불변식과 정합(엔진 recovery scanner 아닌 EIA token-lifecycle sweep). 범위=공개 위젯 한정 — 인증 트리거·per_trigger·`formConfig.timeout` 은 대상 아님. SoT: `spec/5-system/14-external-interaction-api.md §3.4 EIA-RL-07 / §R19`.

## Unreleased — 웹채팅 위젯 "새 대화" single-flight coalesce + 확립세션 best-effort cancel (7-channel-web-chat/1-widget-app §R9)

### 변경 사항

1. **위젯 "새 대화"/host `resetSession` 의 서버측 execution 잔존 2건을 클라이언트 측에서 해소했다** (결정 PR #916 §R9 구현, PR-1). **(A) single-flight coalesce** — `newChat()` 이 `booting`(webhook POST in-flight·세션 미확립) 중 호출되면(주로 UI 게이트 밖의 host `resetSession`) in-flight `start()` 에 **흡수**한다: 조기 return 이 `resetSessionRefs()`(=start 가드 재개방)를 건너뛰어 **2번째 `POST /api/hooks/:path` 를 발사하지 않는다** — 종전엔 booting 중 reset 이 중복 webhook·첫 노드 부작용 2회를 유발할 수 있었다(§3.1 "Planned" 제약 해소). 단 "새 대화" 의도상 이전 대기 큐만은 비워(흡수 세션으로의 텍스트 누수 차단). **(B-1) 확립세션 cancel** — 확립된(`streaming`/`awaiting_user_message`) 세션발 "새 대화"는 새 start 전에 이전 execution 을 **best-effort 범용 `cancel`**(폐기이므로 graceful `end_conversation` 아님, optimistic — 실패해도 로컬 재시작 유지)로 종료해 서버 orphan 을 근원 제거한다. 서버측 idle-wait backstop(EIA-RL-07, cancel 유실 경로 회수)은 후속 PR. 순수 CSR 위젯 변경(백엔드 무변경). SoT: `spec/7-channel-web-chat/1-widget-app.md §R9·§3.1`.

## Unreleased — `variables.__*` 예약 네임스페이스 3계층 강제 (conventions/execution-context 원칙 5)

### Breaking changes

1. **Variable Declaration / Variable Modification 노드의 변수 이름에 `__`(double-underscore) prefix 를 금지한다.** `variables.__*` 는 엔진이 실행 시작 시 `__workspaceId`·`__dryRun` 등 시스템 값을 주입하는 예약 네임스페이스인데(execution-context 원칙 5), 지금까지 규약일 뿐 강제가 없어 사용자가 시스템 키를 덮어쓰거나, `__` 사용자 변수가 park/resume 시 `filterUserVariables` 에 **관찰 불가능하게 drop** 되어 조용히 소실됐다. 이제 신규 코드 `RESERVED_VARIABLE_NAME` 으로 3계층 강제한다 — **L0** 저장 시점(`WorkflowsService.saveCanvas`/`importWorkflow` → 400, `details.offenders[]`; `restoreVersion` 은 legacy-data escape 로 면제), **L1** pre-flight `validateConfig`(→ `INVALID_NODE_CONFIG`), **L2** `handler.execute` 런타임 throw. **어느 계층도 단독으로 충분하지 않다**: 변수 이름 필드는 `{{ }}` 표현식 대상이라(두 노드는 `EXPRESSION_EXCLUSIONS` 에 없다) L0/L1 은 해석 전 리터럴만 보고, `name: "{{ $input.x }}"` 가 런타임에 `__workspaceId` 로 평가되는 경우는 오직 L2(해석 후)만 잡는다 — L2 가 예약의 실질 강제 지점이다.
2. **영향받는 워크플로**: 기존에 `__foo` 변수를 선언·수정하던 워크플로는 재저장 시 400, 또는 다음 실행 시 노드 throw 로 실패한다. 그러나 그런 변수는 이미 재개 시 조용히 소실되던 반쯤 깨진 상태였다 — 조용한 데이터 손실을 명시적 실패로 바꾼다. Variable Declaration §6 이 의도적으로 채택한 "관찰 가능한" silent skip/fallback(`meta.skipped`/`meta.coercionWarnings` 로 가시화)과는 다른 종류의 침묵(park drop)만 대상이다.

### 범위 밖 (잔여 리스크)

3. **Code 노드**(`$vars` 전체 atomic replace, `nodes/data/code/code.handler.ts`)는 사용자 코드가 `$vars.__workspaceId` 를 쓰면 필터 없이 덮어쓴다. 임의 코드 실행 노드에 변수-이름 화이트리스트를 강제하는 것은 별개 결정이라 본 강제 범위 밖으로 두고, 원칙 5 "강제 범위 밖" 절에 정직하게 등재했다.

SoT: `spec/conventions/execution-context.md` 원칙 5 · `spec/5-system/3-error-handling.md` §1.3 · `spec/4-nodes/1-logic/{4,5}-*.md` §6.

## Unreleased — 웹채팅 위젯 presentation `truncation` 유실 수정 + 복원 렌더 회귀 가드 (7-channel-web-chat/1-widget-app §2)

### 변경 사항

1. **AI `render_table` 이 1MB cap 으로 행을 잘라도 위젯에 "일부 행만 표시됩니다" 배너가 뜨지 않던 버그를 고쳤다** — `PresentationPayload.truncation` 은 `payload` **바깥** top-level 필드인데(AI Agent §7.10), 위젯 `asEnvelope` 가 `payload` 만 펼쳐 구조적으로 이 필드를 볼 수 없었다. 그 결과 `toTable` 의 `output.rowsTruncated` 판정이 항상 `false` 였다. 복원 경로만이 아니라 라이브 `ai_message` 경로에도 있던 기존 버그다. standalone table 노드는 `output.rowsTruncated` 를 output 안에 직접 실어 정상 동작했고 메인 프런트엔드(`assistant-presentations-block`)는 `truncation` 을 이미 소비하고 있어, 위젯만 outlier 였다. Presentation 공통 §10.4 가 두 위치를 "동등한 메타" 로 규정하므로 코드를 spec 에 맞춘다(spec 변경 없음). 병합은 알려진 4개 cap 키(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`) 화이트리스트로 한정해, 장래 shape 확장이 payload 의 동명 렌더 필드를 조용히 덮지 않게 봉인했다.
2. **`1-widget-app.md` §2 의 "알려진 제약(Planned)" 서술을 정정했다(문서)** — "새로고침 복원 thread 의 presentation 은 위젯 렌더러가 graceful 하게 무시(빈 렌더)한다" 는 서술은 실측과 달랐다. 렌더러는 `asEnvelope`/`classifyPresentation` 으로 `{config,output}` 과 `PresentationPayload` 두 shape 을 이미 모두 수용하고 있었고, 복원 thread 의 carousel/table/chart/template 4종이 무수정 상태에서 정상 렌더됨을 실증했다. **진짜 남은 제약은 원인이 다르다** — durable thread 의 `turn.presentations[]` 는 `source: 'ai_assistant'` 한정이라 AI `render_*` 표시물만 영속되고, 표시-전용 presentation *노드*의 표시물은 SSE `execution.message` 로만 오므로 새로고침 복원 대상이 아니다. 이 경계를 SoT(`conversation-thread.md` §2.1)·소비 문서(`1-widget-app.md` §2·§3.1·R8)·영역 백로그(`_product-overview.md` §2 비목표) 3곳에 등재했다. `0-architecture.md` §3 EIA 매핑 표에 누락돼 있던 `execution.message` 행도 함께 보강. 런타임 동작 무변경(문서). SoT: `spec/7-channel-web-chat/1-widget-app.md` §2·R8.
3. **회귀 가드 3계층 추가** — 복원 thread turn 의 `PresentationPayload` 4종 passthrough·분류·정규화(`conversation.test.ts`), DOM 렌더·port 버튼·truncation 배너(`presentations.test.tsx`), truncation 흡수·병합 우선순위·malformed 입력 no-op·미등록 키 미흡수(`presentation.test.ts`).

## Unreleased — continuation 명령 ↔ 대기 노드 표면 검증 (5-system/4-execution-engine §7.5.1)

### 변경 사항

1. **인터랙션 명령이 현재 대기 노드의 표면과 맞지 않으면 publish 전에 거부된다** — 종전엔 `execution.status === 'waiting_for_input'` 만 검사해, 이종 명령이 continuation bus 로 흘러갔다. resume 처리기는 도착 payload 의 `type` 이 아니라 **대기 노드의 표면**으로 선택되므로(`dispatchResumeTurn`), 이 조합은 에러 없이 **조용히 오처리**됐다: Form 대기 중 `end_conversation`/`submit_message`/`click_button` 은 sentinel 불일치 폴백을 타 **빈 폼이 제출된 것처럼** 노드를 완료시켰고(ConversationThread 에 가짜 `form_submitted` 까지 append), Buttons 대기 중 비-`click_button` 은 `resolveButtonInteraction` 의 fallback 을 타 **엉뚱한 `continue` 포트로 그래프를 분기**시켰다. 이제 4종 명령이 공유하는 publisher chokepoint(`resolveWaitingNodeExecutionId`)가 표면 매트릭스를 강제한다 — `form` 대기는 `submit_form` 만, `buttons` 대기는 `click_button` 만 받고, `ai_conversation`/`ai_form_render` 는 4종을 모두 받는다(AI 핸들러의 기존 관용 보존: Presentation §10.9 의 stale `button_click` graceful re-park, AI Agent §6.2 step 2.c 의 `render_form` 응답). 표면 판정은 `dispatchResumeTurn`/`dispatchParkEntry` 의 selects 술어를 미러링하며, 판정 불가 행은 fail-closed 거부한다(그 행은 worker 에서 `RESUME_CHECKPOINT_MISSING` 로 실행이 죽으므로 동기 거부가 `waiting_for_input` 을 보존해 낫다). 신규 에러 코드는 없다 — 기존 `InvalidExecutionStateError` 를 재사용해 진입점별 매핑이 자동 파생된다(EIA REST `409 STATE_MISMATCH` / WS ack `INVALID_EXECUTION_STATE` / REST `/continue` `422 INVALID_STATE`). 이미 `EIA-IN-13`(필수)과 EIA §5.1 에러 표가 약속하던 동작의 구현이다. chat-channel in-process forwarding 은 대기 표면을 모른 채 명령을 고정 매핑하므로 `STATE_MISMATCH` 를 warn 로그와 함께 삼킨다(그대로 throw 하면 webhook 5xx → provider 무한 재시도). 표면 판정에 필요한 `interactionType` 문자열만 JSONB path 로 투영해 hot path 가 `output_data` 전체(AI 멀티턴의 누적 `_resumeCheckpoint.messages`)를 읽지 않는다. SoT: `spec/5-system/4-execution-engine.md §7.5.1` · `spec/5-system/14-external-interaction-api.md §5.1`.

## Unreleased — KB WebSocket 이벤트 count drift 정정 (5-system/6-websocket-protocol §4.3)

### 변경 사항

1. **frontend `useKbEvents` 가 backend `KbEventType` union 권위(11종)에 정렬된다** — frontend `KB_EVENT_NAMES` 가 union 에 없는 `document:graph_error` 를 구독해 count drift(frontend 12 vs union 11)가 있었다. graph `_error` 는 emit 경로가 없어 #443 에서 union 에서 제거됐고(`data-flow/6-knowledge-base.md §2.5` 권위 기록), graph 오류는 `_retry`/`_failed` 로만 신호한다. 죽은 `graph_error` 구독을 제거하고(→11종, backend emit 무변경이라 no-op), closure-local `KB_EVENT_NAMES` 를 module-scope `export` 로 승격해 union↔구독 parity 회귀 테스트(`use-kb-events.test.ts`)를 추가했다. 백엔드 union 자체는 이미 11종이라 무변경(JSDoc 만 "12개"→"11종" 정정). spec 정합: `6-websocket-protocol §4.3`, `8-embedding-pipeline §8.1/§8.2`, `10-graph-rag §6/KB-GR-OB-02`, `2-navigation/5-knowledge-base`. `document:embedding_error` 는 union 선언분(미emit·forward-compat)이라 유지. 런타임 동작 무변경. SoT: `spec/5-system/6-websocket-protocol.md §4.3`.

## Unreleased — 통합 상세 활동 탭 "연결 안 됨" 안내 배너 (2-navigation/4-integration §4.6)

### 변경 사항

1. **통합이 연결되어 있지 않으면(`error`/`expired`/`pending_install`) 활동 탭에 "연결 안 됨" 경고 배너를 노출한다** — 이 상태에서는 AI Agent 가 MCP bridge 로 미연결 통합의 tool 을 노출하지 않아 호출 자체가 없고(직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패), 새 활동이 기록되지 않는다. 종전엔 활동 탭이 단순 "활동 없음" 빈 상태만 보여줘 사용자가 "기록이 없는 것" 과 "통합이 끊겨 기록이 안 되는 것" 을 구분하지 못했다. 이제 활동 목록·빈 상태 위에 [Inline Alert](spec/0-overview.md §3.4)를 얹어 원인을 알리고, "상태 확인" 버튼으로 개요 탭(상태·재연결)으로 유도한다. 톤은 §3.4 status→tone escalation 에 맞춰 `error`=red, `expired`/`pending_install`=warning(amber) 으로 헤더 `StatusBadge` 신호와 일치시킨다. `connected`(곧 만료 expires-soon 포함)는 여전히 기록되므로 미노출. 프론트 전용(백엔드·API 무변경). SoT: `spec/2-navigation/4-integration.md §4.6` · `spec/0-overview.md §3.4`.

## Unreleased — AI Agent 자동 메모리 롤링 요약 압축 chat 의 llm_usage_log attribution 배선 (data-flow/7-llm-usage §1.3)

### 변경 사항

1. **AI Agent 자동 메모리(`summary_buffer`/`persistent`) 롤링 요약 압축 LLM 호출이 `llm_usage_log` 의 `workflow_id`/`execution_id`/`node_execution_id` 를 채우도록 배선했다** — 노드 내부에서 실행되는데도 이 요약 압축 chat 만 attribution 이 전부 NULL 로 남던 잔여 갭(#879 후속)을 해소한다. `AiMemoryManager.injectMemoryContext` 가 요약 압축(`buildSummaryBufferUpdate`) chat 에 `LlmCallContext` 를 전달하도록 하고, 세 필드를 caller 가 명시 전달한다 — **single-turn** 경로는 `context.workflowId`/`context.nodeExecutionId`(엔진이 노드 실행 직전 주입), **multi-turn resume** 경로는 재구성 `state.*`(엔진 `buildRetryReentryState` 주입분). 과거 `config` 파생 방식은 single-turn 의 `config` 가 사용자 노드 config 라 해당 키가 없어 항상 NULL 이 되던 문제가 있었다. 이로써 워크플로우별 LLM 비용 집계(Statistics `workflowId` 필터·Alerts)에 메모리 압축 사용량도 반영된다. SoT: `spec/data-flow/7-llm-usage.md §1.3`.

## Unreleased — `$params.<name>` 표현식 자동완성 (5-system/5-expression §7.1)

### 변경 사항

1. **에디터 표현식 자동완성이 `$params` 를 최상위 변수로 노출하고 `$params.<name>` 하위키를 힌트한다** — `trigger-param-output-enricher`(§7.2 enricher) 후속. spec 은 이미 `$params`(= `$input.parameters` 단축, §5:171·manual-trigger §5:150)를 규정했으나 프론트 자동완성엔 미등록이라 `$params` 가 후보로도 안 떴다. `ROOT_VARIABLES` 에 `$params`(expandable) 를 추가하고 `$params.` drill 핸들러를 추가해, `$params ≡ $input.parameters` 소스(트리거 직속 successor 는 enricher 로 enrich 된 `inputSchema.parameters`)에서 파라미터 이름을 자동완성한다. 값 없는 노드에선 하위키가 비어(오도 없음) `$input` 과 동일 정책. 프론트 전용 UX 힌트로 런타임·엔진·백엔드 무변경, spec 변경 없음(구현 catch-up). §7.1 트리거 조건 표에 `$params.` 행 동기화. SoT: `spec/5-system/5-expression-language.md §7.1`.

## Unreleased — 멀티턴 resume 턴 llm_usage_log attribution (IE node_execution_id 오적재 + ai_agent 메인 chat) (data-flow/7-llm-usage §1.3)

### 변경 사항

1. **멀티턴 AI 노드(Information Extractor·AI Agent)의 resume 턴 LLM 호출이 `llm_usage_log` 의 workflow/execution/node_execution attribution 을 올바르게 채우도록 고쳤다** — #877 이 공유 재구성기 `buildRetryReentryState` 에 `workflowId`·`nodeExecutionId`(현재 turn 의 NodeExecution row PK)를 재주입하도록 고쳐 통합 usage-log(§4.6) 갭을 해소했는데, **LLM usage-log(`llm_usage_log`) 쪽 소비 사이트 2곳이 아직 미교정**이었다. (a) **Information Extractor resume 턴**은 `node_execution_id` 자리에 `state.nodeId`(Node **정의** id — NodeExecution row PK 아님)를 넣어 attribution FK 에 잘못된 참조를 적재하고 `workflow_id` 를 누락했다(첫 턴은 `context.*` 로 정상). 이제 재구성 `state.nodeExecutionId`/`state.workflowId` 를 소비한다(첫 턴 사이트와 대칭). (b) **AI Agent resume 턴 메인 chat 호출 2곳**(`ai-turn-executor.ts` `processMultiTurnMessage`)은 `LlmCallContext` 를 전혀 전달하지 않아 세 컬럼이 NULL 이었다 — 이제 `state.workflowId`/`executionId`/`nodeExecutionId` 를 전달한다(tool-batch 는 이미 소비 중). 이로써 노드 핸들러 3종(AI Agent·Text Classifier·Information Extractor)의 attribution 이 모두 채워진다 — 멀티턴(AI Agent·Information Extractor)은 첫 턴·resume 턴 모두, Text Classifier 는 단발 호출(resume 없음). `spec/data-flow/7-llm-usage.md` §1.3 표·Rationale·§4 표와 `spec/5-system/4-execution-engine.md` §6.1 소비처 표를 실제 채움 현황으로 정정. SoT: `spec/data-flow/7-llm-usage.md §1.3`.

## Unreleased — Manual Trigger 파라미터 표현식 자동완성 힌트 (5-system/5-expression §7.2)

### 변경 사항

1. **에디터 표현식 자동완성이 Manual Trigger 의 `output.parameters.<name>` 를 실행 전에도 힌트한다** — 한 사용자 워크플로에서 AI Agent userPrompt 가 `{{$node["Manual Trigger"].config.parameters.region}}` 로 작성돼 값이 빈값으로 전달됐다. `config.parameters` 는 정의 **배열**(이름 접근 불가)이고 해석된 값은 name-keyed `output.parameters` 에 있는데, 에디터가 그 경로를 힌트하지 못해 혼동을 유발했다. 기존 Form/Table/Transform/InfoExtractor 4개 enricher 와 동일 패턴으로 `enrichManualTriggerOutputSchema` 를 추가해, 노드 `config.parameters[].name` 을 정적 outputSchema 의 `output.parameters.<name>`(param `type` 매핑)로 투영한다 — `$node["Manual Trigger"].output.parameters.<name>`(및 직속 successor 의 `$input.parameters.<name>`)이 실행 전에도 자동완성된다. 프론트 전용 UX 힌트로 런타임 검증·엔진·백엔드 output shape 은 무변경. `spec/5-system/5-expression-language.md §7.2` enricher 표에 `manual_trigger` 행 동기화(4→5개 노드 타입). SoT: `spec/5-system/5-expression-language.md §7.2`.

## Unreleased — 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원 (7-channel-web-chat §1·§3)

### 변경 사항

1. **임베드 웹채팅 위젯에 "새 대화"·"대화 종료" 헤더 컨트롤이 추가되고, 새로고침 후 대화 히스토리가 복원된다** — 두 사용자 리포트("세션 종료/신규 세션 수단 없음", "새로고침하면 히스토리가 사라짐")를 해소했다. **① 세션 컨트롤**: 대화가 확립된(`streaming`/`awaiting_user_message`) 뒤에만 패널 헤더에 두 컨트롤을 노출하고(대화 없음·`booting`(webhook in-flight, 세션 미확립)·`[ended]` 는 미노출 — booting 노출 시 종료가 서버 취소를 못 보내거나 중복 webhook 을 발사할 수 있어 세션 확립 후로 게이트), 둘 다 인라인 2단계 **가벼운 확인** 후 실행한다(`spec/7-channel-web-chat/1-widget-app.md §2·§3.1`). "대화 종료"는 대기 중 AI 대화(`awaiting_user_message`+`ai_conversation`, waiting nodeId 확정 시)면 graceful `end_conversation`, 그 외 phase 면 범용 `cancel` 을 발사하고 위젯은 SSE 를 먼저 닫은 뒤 optimistic 하게 `[ended]` 로 전이한다(종료 명령이 유발하는 terminal SSE 이벤트와 경합해 `conversationEnded` 콜백이 2회 발사되지 않도록 스트림 선차단 + 이미-종료 가드). "새 대화"는 저장 세션/스트림을 정리하고 새 execution 을 시작한다(이전 execution 은 명시 종료 없이 서버에서 `waiting_for_input` 잔존, 토큰만 TTL/idle 만료 — **이후 §R9 에서 확립세션 best-effort `cancel` + booting coalesce 로 정정됨**). booting/초기 streaming 중 종료·새 대화가 in-flight `start()` 를 무효화하도록 세대 토큰(gen guard)을 도입해 옛 execution 이 되살아나는 race 를 차단했다. **② 히스토리 복원(2겹 수정)**: (a) **백엔드** — `InteractionService.getStatus()` 가 `waiting_for_input` 시 durable `Execution.conversation_thread`(V084)를 `context.conversationThread` 로 SSE 와 동일 wire shape 으로 동봉한다 → 5분 SSE buffer·서버 재시작·인스턴스 스위치와 무관하게 전체 히스토리를 복원한다(`spec/5-system/14-external-interaction-api.md §5.3·§R17` 재조정 — 종전엔 conversationThread 를 SSE 전용 권위로 두어 getStatus 에서 생략했으나, 웹채팅 §3.1 의 "buffer 만료 시 getStatus snapshot 폴백" 계약과 모순이라 durable 컬럼 read-only 노출로 정합화). (b) **프런트** — 위젯 `conversation.roleOf` 가 wire 의 백엔드 5-source(`presentation_user`·`ai_user`→user, `ai_assistant`·`ai_tool`·`system`→assistant)를 말풍선 role 로 축약한다 — 종전엔 `turn.role` 만 봐서 복원 thread 가 전부 assistant 로 뒤집혔다(위젯 테스트가 실제 wire 가 보내지 않는 `role` 형태를 먹여 통과 중이던 잘못된 계약도 정정). backend 는 additive read-only 확장(신규 저장·계산·마이그레이션 없음), FE 는 CSR 위젯 전용. SoT: `spec/7-channel-web-chat/1-widget-app.md`·`3-auth-session.md`·`spec/5-system/14-external-interaction-api.md`.

## Unreleased — 멀티턴 AI 에이전트 resume 턴에서 통합 사용 로그가 누락되던 버그 수정 (2-navigation/4-integration §4.6)

### 변경 사항

1. **멀티턴(대화형) AI 에이전트의 2번째 이후(resume) 턴에서 cafe24·makeshop·MCP 툴 호출이 성공·응답해도 통합 상세 §4.6 "활동" 탭에 기록되지 않던 버그를 고쳤다** — 원인은 AI resume ↔ retry-last-turn 이 공유하는 resume-state 재구성기 `buildRetryReentryState` 가 `executionId`/`nodeId`/`workspaceId` 는 재주입하면서 `workflowId`·`nodeExecutionId` 는 빠뜨린 것. 두 필드는 `_resumeCheckpoint`/`_retryState`(DB 영속)의 allow-list 로 persist 에서 제거되고 재개 시 재유도 대상인데, 재유도가 누락돼 resume 턴 provider-tool 의 `IntegrationsService.logUsage` 게이트 `if (ctx.nodeExecutionId && ctx.workflowId)` 가 false 로 평가돼 기록이 조용히 skip 됐다(외부 호출은 정상이라 응답은 옴). 첫 턴은 full `ExecutionContext` 로 정상 기록되므로 대화형 사용(2턴+)만 누락됐고, 과거 기록이 `getActivity` 의 7일 롤링 창 밖으로 밀리며 탭이 완전히 비어 보였다. `buildRetryReentryState` 가 `workflowId`(`execution.workflowId`)·`nodeExecutionId`(호출측 대기/재시도 NodeExecution row PK)를 재주입하도록 수정(AI resume + retry-last-turn 양 경로 공유). 회귀 도입: #501(in-memory 대화 루프 제거로 checkpoint 재구성이 유일 resume 경로가 되면서 노출). SoT: `spec/2-navigation/4-integration.md §4.6` · `spec/5-system/4-execution-engine.md §1.3`.

## Unreleased — 워크스페이스 슬러그 URL 라우팅 phase 2 — 에디터 slug화 (2-navigation/9-user-profile §3)

### 변경 사항

1. **워크플로 에디터 캔버스가 활성 워크스페이스 slug URL(`/w/<slug>/workflows/<id>`)로 렌더된다** — phase 1(#865)에서 slug 밖으로 남긴 에디터를 `/w/<slug>/workflows/<id>` 로 편입했다(FE-only, backend 무변경). `(editor)/workflows/[id]` 라우트를 `(editor)/w/[slug]/workflows/[id]` 로 옮기고, phase 1 의 slug 해소·**reconcile(URL 우선)**·무효-slug redirect·정합 전 gate 로직을 공용 `<WorkspaceSlugGate>`(`lib/workspace/workspace-slug-gate.tsx`)로 추출해 `(main)/w/[slug]` 와 에디터 layout 이 공유한다(에디터는 `EditorContent` 풀스크린 chrome 유지). 두 route group 이 `/w/[slug]` prefix 를 공유하되 leaf page 가 달라 충돌하지 않는다. 에디터 딥링크(목록/대시보드 create-then-push·행 클릭·트리거/스케줄/통합 카드·실행 목록 "Open in Editor")는 신규 `buildEditorHref(slug, workflowId)` 헬퍼로 slug 화하고, raw `/workflows/<id>` 리터럴은 `no-raw-editor-href` guard 로 CI 차단한다(알림 딥링크·REST API 경로는 예외). 구 bare `/workflows/<id>`(북마크·실패류 알림)는 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수한다. **URL slug = FE 라우팅 SoT ≠ backend 인가 SoT** 불변(header-first→토큰 클레임·`X-Workspace-Id` 헤더 유지). spec 동기화: `9-user-profile §3`·`_layout §2.2/§3.1`·`0-dashboard`·`1-workflow-list`·`14-execution-history`·`3-workflow-editor/2-edge` frontmatter·`data-flow/12-workspace` Rationale(reconcile 방향). SoT: `spec/2-navigation/9-user-profile.md §3`.

## Unreleased — 워크스페이스 슬러그 URL 라우팅 phase 1 (`/w/[slug]/...`) (2-navigation/9-user-profile §3)

### 변경 사항

1. **활성 워크스페이스가 URL 경로(`/w/<slug>/...`)로 반영된다** — `spec/2-navigation/9-user-profile.md §3` 이 "미구현(Planned)" 으로 두었던 슬러그 라우팅을 구현했다(FE-only, backend 무변경). `(main)/*` 26 페이지를 `(main)/w/[slug]/*` 로 이동하고, 신규 `(main)/w/[slug]/layout.tsx` 가 slug→워크스페이스를 해소해 **reconcile(URL 우선)** 한다 — resolved-id ≠ 활성 id 면 기존 `switchWorkspace`(→ `X-Workspace-Id` 헤더 + `/switch` 토큰 재발급) 로 재조정하고, 정합될 때까지 페이지 렌더를 gate 한다. **URL slug = FE 라우팅 SoT 이며 backend 인가 SoT 가 아니다** — header-first→토큰 클레임 인가 모델(#859)·`X-Workspace-Id` 헤더 첨부는 불변. 무효/비멤버 slug 는 default 워크스페이스로 조용히 redirect(UX 편의, 인가 경계는 `RolesGuard` 403). `(main)/[...rest]` catch-all 이 구 무-slug 경로·알림 딥링크·`/`·로그인후 `/dashboard` 를 활성 slug 로 흡수한다(query/hash 보존). 내부 링크는 `buildWorkspaceHref(slug, path)`(open-redirect 방어 포함) 헬퍼로 slug 화하고, 활성/폴백 워크스페이스 해소는 `resolveFallbackWorkspace` 단일 규칙을 공유한다. **에디터(`/workflows/[id]`)·유저 가이드(`/docs`)·인증(`(auth)`)은 phase 1 에서 slug 밖**(에디터 slug화는 phase 2). spec 동기화: `9-user-profile §3` flip·`data-flow/12-workspace` Rationale(슬러그 라우팅 불변식)·`10-auth-flow §7.2`·`_layout §2.2/§3.1`. SoT: `spec/2-navigation/9-user-profile.md §3`.

## Unreleased — Manual Trigger `defaultValue` 파라미터가 실행에서 무시되던 버그 수정 (4-nodes/7-trigger §4/§5.1/§6)

### 변경 사항

1. **Manual Trigger 에 `defaultValue` 를 지정해도 `output.parameters` 가 비고 다운스트림 `$node["…"].output.parameters.*`/`$params.*` 표현식이 전부 빈값이던 버그를 고쳤다** — 실측(save→execute→engine e2e) 결과 세 결함이 겹쳐 있었다. (a) **엔진 재진입 input 소실**: `runNodeDispatchLoop` 의 3개 재진입/redrive 호출부(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`)가 `input: {}` 를 전달 — "재기동 후 input 소멸" 이라는 주석과 달리 `Execution.inputData` 는 durable 컬럼이라, 아직 미완료인 진입 노드(Manual Trigger)가 빈 입력을 받아 `output.parameters:{}` 를 산출했다. 이제 `savedExecution.inputData ?? {}` 를 넘긴다(완료 노드는 skip 되므로 미완료 진입 노드에만 영향; AI multi-turn retry 경로는 spec 문서화된 `$input` 미해소 동작이라 의도적으로 제외). (b) **트리거 조회**: `loadTriggerParameterSchema` 가 `category=TRIGGER` 로 조회해 category 누락/불일치 manual_trigger 노드(프론트 `is-trigger.ts` 가 방어하는 실존 케이스)를 놓쳤다 — `type='manual_trigger'` 조회로 교체. (c) **저장 검증**: `saveCanvas` 가 파라미터 스키마를 검증하지 않아 빈 이름 슬롯 등 malformed 정의가 조용히 영속됐다 — `validateManualTrigger` 가 저장 시점에 `400 INVALID_TRIGGER_PARAMETERS` 로 차단(spec §6, 버전 복원은 예외). 프론트 `ManualTriggerConfig` 는 빈/식별자위반/중복 이름을 inline 표시. SoT: `spec/4-nodes/7-trigger/1-manual-trigger.md §4/§5.1/§6`.

## Unreleased — 삭제된 Integration 참조 캔버스 경고 배지 `⚠ Missing integration` (4-integration §5)

### 변경 사항

1. **Integration 노드가 참조하던 통합이 삭제되면 캔버스 노드 헤더에 `⚠ Missing integration`(앰버) 배지가 표시된다** — `spec/4-nodes/4-integration/0-common.md §5` 가 "계획(미구현)" 으로 두었던 배지를 구현하고 5개 통합 노드 spec(§7 캔버스 요약)·`spec/3-workflow-editor/0-canvas.md §5.3.5` 를 동기화했다. 이 판정은 schema `warningRules` 로 표현할 수 없다 — `when` DSL 평가기(`evaluateWhen(expr, config)`)가 노드 자신의 config 만 봐서 "그 `integrationId` 가 실재하는가" 라는 cross-entity 검증에 닿지 못하기 때문이다(plan `spec-sync-integration-common-gaps` 옵션 A 채택). 따라서 **렌더러 전용 cross-entity 판정**으로 구현했다: 캔버스(`workflow-canvas.tsx`)가 워크스페이스 integration 목록을 무필터 키 `["integrations","list"]` 로 **한 번** 조회해 실재 id 집합을 Context(`integration-list-context.ts`)로 내려주고, 각 노드 렌더러(`custom-node.tsx` `MissingIntegrationBadge`)가 자기 `config.integrationId` 를 그 집합과 대조한다(per-node `useQuery` 구독을 피하는 `hasDefaultLlmConfig` 패턴과 동일). 정상 삭제 경로는 사용 중 통합 삭제를 백엔드가 차단(`INTEGRATION_IN_USE`)하므로 본 배지는 버전 복원·레거시 등 **잔존 참조 방어 표식**이다. 위양성 방지 가드: 목록 로딩 중·페이지네이션 미완전(전체 미확보) 시 억제, `http_request` 는 `authentication==='integration'` 조건부 필드라 그 외 인증 모드의 잔존값 제외. graph-warning 배지(`AlertTriangle`)와 구분되는 `Unplug`(연결 끊김) 아이콘. i18n `integrations.missingIntegration` KO/EN 동시 추가. 신규 서버 API 없음(기존 `GET /integrations` 재사용). SoT: `spec/4-nodes/4-integration/0-common.md §5`.

## Unreleased — 캔버스 키보드 단축키 · 클립보드 복붙 · 컨테이너 삭제 확인 다이얼로그 (canvas UX spec-sync §10·§3.3·§11.3)

### 변경 사항

1. **워크플로 에디터에 키보드 단축키·클립보드 복붙·컨테이너 삭제 확인 다이얼로그가 추가된다** — `spec/3-workflow-editor/0-canvas.md §10/§3.3/§11.3` 이 "미구현 (Planned)" 로 두었던 세 묶음을 구현하고 spec 본문을 동기화했다. (a) **§10 단축키** — Ctrl+C/V/D/A(복사·붙여넣기·복제·전체선택)·Escape(선택 해제, 단 Run Results 드로어 포커스 시 §10.12 캔버스 복귀가 우선)·Space 패닝(`panActivationKeyCode`)·Ctrl++/-/0/1(줌). 입력 필드 포커스 중에는 가로채지 않는다(`isEditableTarget` 가드). 키→액션 매핑은 순수 함수(`resolveEditorShortcut`/`resolveZoomShortcut`)로 분리해 단위 테스트한다. 줌은 ReactFlow 인스턴스가 필요해 캔버스 컴포넌트에서 처리한다. (b) **§3.3 클립보드** — 앱 내부 상태 `editorClipboard`(OS 텍스트 클립보드와 별개)로 `copySelection`/`pasteClipboard`/`duplicateSelection`. 붙여넣기는 신규 id·오프셋(+40)·유니크 라벨·엣지 신규 id 재연결·`containerId` 엣지 기반 재도출. 캔버스 우클릭 메뉴에 "붙여넣기"(클릭 위치 기준) 추가. (c) **§11.3 컨테이너 삭제** — 자식이 있는 컨테이너 삭제 시 "컨테이너+자식 전체 삭제" vs "그룹 해제(자식 유지)" 확인 다이얼로그(`container-delete-dialog.tsx`, Ungroup 기본). ✕ 버튼·우클릭 메뉴(`requestNodeDelete`)·Delete 키(ReactFlow `onBeforeDelete`) 세 경로 모두 경유하며, 다중 선택 시 확인 대상 컨테이너만 부분 취소하고 나머지는 정상 삭제한다. 빈 컨테이너·일반 노드는 즉시 삭제. 신규 서버 API 없음(클라이언트 사이드 전용). i18n `editor.pasteMenu`·`editor.containerDelete.*` KO/EN 동시 추가. SoT: `spec/3-workflow-editor/0-canvas.md §10/§3.2/§3.3/§3.5/§11.3`.

## Unreleased — edge 자기연결/중복 하드차단 + 탈출불가 순환 warn-not-block · outbound 알림 폭주 degraded (spec-sync edge §2.2/§2.3 · EIA §8.4)

### 변경 사항

1. **워크플로 에디터가 자기연결·중복 연결은 막고, 사이클은 막지 않되 위험한 순환만 경고한다** — `spec/3-workflow-editor/2-edge.md §2.2/§2.3` 이 "대부분 미구현 (Planned)" 로 두었던 연결 유효성 규칙을 구현·동기화했다. (a) **§2.2 하드 차단** — 자기연결(`source===target`)은 `isValidConnection`(React Flow prop) 이 드래그 중 커서 🚫 로, 동일 연결 중복(같은 source·sourceHandle·target·targetHandle)은 `onConnect` 이 토스트로 차단(순수 헬퍼 `edge-utils.ts` `isSelfConnection`/`isDuplicateConnection`). (b) **§2.3 warn-not-block** — 실행 엔진이 분기 노드(Switch/If-Else) back-edge 순환을 정식 지원하므로 캔버스는 사이클을 막지 않고, 분기 노드 없이 탈출 불가한 순환만 `graph:unescapable-cycle`(severity `warning`) 배지로 경고한다. 그래프 전역 DFS back-edge 탐지를 `@workflow/graph-warning-rules` 신규 graph-level 규칙 `evaluateGraphCycleWarnings`(`rules/cycle.ts`) 로 구현하고, 컨테이너 loopback(`targetHandle==='emit'`)·진입(`sourceHandle==='body'`) 엣지는 예외 처리(SoT `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS={'emit'}`). frontend `editor-store.ts` `evaluateGraphWarningsLocal` 과 backend `getGraphWarnings` 가 per-type 결과에 cycle 결과를 병합해 두 surface 가 일치한다. 편집기는 warn, workflow-assistant 도구(`shadow-workflow.ts`)는 여전히 hard-block — surface 별 요구 차이(`2-edge.md §Rationale R-2`). i18n `GRAPH_WARNING_KO['graph:unescapable-cycle']` KO 템플릿 + P3-C-1 가드 확장. 신규 서버 API 없음(기존 `GET /workflows/:id/graph-warnings` 재사용). SoT: `spec/3-workflow-editor/2-edge.md §2.2/§2.3`, `spec/conventions/cross-node-warning-rules.md §3/§8/§9`.

2. **outbound 알림이 trigger 당 분당 60건을 넘으면 폐기 없이 계속 발송하되 `notificationHealth=degraded` 로 표시한다** — `spec/5-system/14-external-interaction-api.md §8.4 row4 / §3.1 EIA-NX-11` 이 권장한 outbound 폭주 감지를 구현했다. `OutboundNotificationRateLimiterService`(Redis fixed-window `INCR`+`EXPIRE NX` 단일 pipeline, fail-open) 가 발송 성공마다 카운트하고, `NotificationWebhookProcessor` 성공 분기가 한도 초과 시 `markHealthy` 대신 `markDegraded` + 폭주 전용 `notification_last_error`(발송 실패 degraded 와 원인 구분) 로 표시한다. **throttle(폐기) 아님** — 초과분도 발송하며 수신 endpoint 부하만 알린다. SoT: `spec/5-system/14-external-interaction-api.md §8.4/§3.1`, `§Rationale R-outbound-flood`.

## Unreleased — 캔버스 미니맵·줌 슬라이더/퍼센트·노드 삭제 버튼 (canvas UX spec-sync §5.4·§6·§7)

### 변경 사항

1. **워크플로우 에디터 캔버스에 미니맵·줌 슬라이더·노드 ✕ 삭제 버튼이 추가된다** — `spec/3-workflow-editor/0-canvas.md §3.1/§5.4/§6/§7` 이 "미구현 (Planned)" 로 두었던 세 어포던스를 구현하고 spec 본문을 구현 상태로 동기화했다. (a) **§7 미니맵** — @xyflow `MiniMap` 을 우하단에 렌더(`pannable`/`zoomable` 로 미니맵 내 드래그·스크롤 뷰포트 이동/줌) + 토글 버튼으로 표시/숨김(`canvas-minimap.tsx`). (b) **§6/§3.1 줌** — 좌하단 오버레이에 줌 레벨 슬라이더(25%~200%) + 실시간 퍼센트 표시를 추가(기존 inline `ZoomControls` 를 `zoom-controls.tsx` 로 분리), ReactFlow `minZoom`/`maxZoom` 을 슬라이더 범위와 동일하게 정합(`MIN_ZOOM`/`MAX_ZOOM` 단일 출처). (c) **§5.4 노드 삭제 버튼** — 노드 우상단 ✕ 원형 버튼(hover fade-in·선택 시 상시 표시), 클릭 시 연결 엣지까지 함께 삭제. Manual Trigger(진입점, 삭제 불가) 와 워크플로우 실행 중에는 숨김. 삭제 가능 판정은 `isNodeDeletable()` 단일 헬퍼로 통합해 ✕ 버튼·Delete 키·우클릭 메뉴가 같은 규칙을 참조한다. 신규 서버 API 없음(클라이언트 사이드 전용). i18n `common.aria` 키(zoomLevel·minimap·toggleMinimap) KO/EN 동시 추가, UI 투어 문서 동반 갱신. SoT: `spec/3-workflow-editor/0-canvas.md §3.1/§5.4/§6/§7`.

## Unreleased — 알림 신규 발사 소스 execution_failed·schedule_failed·team_invite (알림 파이프라인 PR3)

### 변경 사항

1. **워크플로우 실행 실패·스케줄 시작 실패·팀 초대 시 알림이 발사된다** — 종전 `notification.type` 의 `execution_failed`/`schedule_failed`/`team_invite` 는 DB CHECK 에 허용값으로만 존재하고 이를 발사하는 코드가 없었다(`spec/data-flow/8-notifications.md §1.1` 이 to-be 로 명시). 이제 세 소스가 발사한다. 모두 **best-effort**(발사 실패가 원 흐름을 되돌리지 않음): (a) `execution_failed` — 실행이 FAILED 로 종료될 때 워크플로우 owner + 실행자에게. **top-level 실행에만** 발사(`!parentExecutionId`)해 background 본문/sub-workflow 하위 실행은 제외 — background 본문 실패는 기존 `background_failed` 가 담당하므로 중복을 피한다. (b) `schedule_failed` — 스케줄이 execution 을 **시작하지 못했을 때**(파라미터 해석·enqueue 실패) 워크플로우 owner 에게. 시작된 execution 의 이후 실패는 `execution_failed` 가 커버한다. (c) `team_invite` — 초대 대상 이메일이 **이미 가입자(비멤버)** 일 때 그 사용자에게. `execution_failed`/`schedule_failed` 는 **인앱 + 이메일**(`channel: 'both'`); `team_invite` 는 **인앱**(`channel: 'in_app'`) — 이메일은 이미 발송되는 초대 링크 이메일(수락 토큰 포함)이 담당하고 알림 record 의 이메일 발송을 켜면 토큰 없는 범용 알림 이메일이 중복되기 때문이다(planner 결정 (c), `spec/data-flow/8-notifications.md §Rationale "team_invite 채널 — 이메일 중복 회피"`). `spec/2-navigation/9-user-profile.md §5.1` 은 세 유형의 기본 채널을 인앱+이메일로 규정하며(채널 토글 미구현이라 기본값 고정 발송), 팀 초대의 "이메일"은 초대 링크 이메일로 충족된다(§5.1 각주). 신규 마이그레이션 없음(V070 CHECK 에 세 타입 선재). SoT: `spec/data-flow/8-notifications.md §1.1`.

## Unreleased — 알림 이메일 발송 경로 + email_sent_at 라이프사이클 (알림 파이프라인 PR2)

### 변경 사항

1. **`channel ∈ {email, both}` 알림이 실제 이메일로 발송되고 발송 시각(`email_sent_at`)이 기록된다** — 종전 `MailService` 는 verification/invitation/password-reset 3종만 발송하고 알림 이메일 경로·`email_sent_at` setter 가 없어, `notification.channel` 이 email/both 여도 in-app 적재만 되고 메일은 나가지 않았다(`spec/data-flow/8-notifications.md` §1·§2.2·§3 이 to-be 로 명시). 이제 `MailService.sendNotificationEmail(email, {title,message,type})` 이 **단일 범용 템플릿**(subject=알림 title, 본문=message + `/dashboard` CTA — 전용 알림 페이지가 없어 인증 랜딩의 벨 팝오버로 안내)으로 발송하고, `NotificationsService` 가 `notify()`/`createMany()` 적재 후 `channel∈{email,both}` row 에 대해 User email 을 `In(userIds)` 배치로 조회해 발송한 뒤 성공 시 `email_sent_at` 을 채운다. 전 과정 **완전 best-effort** — SMTP·해석·UPDATE 실패는 warn 로그만 남기고 재시도하지 않으며 적재(source of truth)를 되돌리지 않고, 실패한 row 의 `email_sent_at` 은 NULL 로 남는다(`spec/data-flow/8-notifications.md §3` Rationale). `type` 별 시각 템플릿은 단일 범용 템플릿으로 downscope(type별 내용은 호출자가 설정한 title/message 에 이미 인코딩) — spec 배지 flip·Rationale 정정은 별도 planner 트랙. SoT: `spec/data-flow/8-notifications.md §1/§2.2/§3`.

## Unreleased — Switch switchValue 필수 표시(asterisk) (V-12)

### 변경 사항

1. **Switch 노드 설정의 `switchValue` 가 mode=value 일 때 required asterisk 를 노출** — `spec/4-nodes/1-logic/2-switch.md §8.1` 은 `switchValue` 가 mode=value 시 필수이며 UI 가 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트로 asterisk 를 표시한다고 명시하나, bespoke `SwitchConfig`(override-track)의 `switchValue` `ExpressionInput` 이 asterisk 를 렌더하지 않아 필수 표시가 누락됐다(requiredWhen 은 auto-form 만 소비). `ExpressionInput` 의 기존 `required` prop 에 `mode === "value"` 를 전달해 backend `switch.schema.ts` 의 `requiredWhen: {equals:['value']}` whitelist 를 override-track 에서 재현한다. 순수 시각 표시이며 런타임 검증은 `NodeHandler.validate()` 가 그대로 담당. spec 변경 불요(§8.1 이미 명시). SoT: `spec/4-nodes/1-logic/2-switch.md §8.1`.

## Unreleased — Re-run 모달 원본 ID 링크 + typed 입력 폼 (V-14)

### 변경 사항

1. **Re-run 모달의 입력 폼이 Manual Trigger 스키마 기반 typed 동적 폼으로 전환 + 원본 ID 링크** — 종전 `rerun-modal.tsx` 는 원본 실행 ID 를 plain text 로, 입력 폼을 원본 `inputData.parameters` 키 전부를 텍스트 Input 으로만 렌더해 boolean 을 텍스트로 입력하는 등 타입 부정합 여지가 있었다(`spec/5-system/13-replay-rerun.md §10.2` 은 (a) 원본 ID 클릭 시 새 탭 상세 (b) manual_trigger 노드 config 스키마 기반 typed 폼을 명시). 이제 워크플로 manual_trigger 노드 `config.parameters` 스키마(`{name,type}`)에서 필드를 도출해 **string→text·number→number·boolean→checkbox·object/array→JSON** 위젯으로 렌더하고, 편집값을 타입에 맞게 coerce 해 전송한다(backend `resolveTriggerParameters` 가 native-typed 값 수용). 원본 ID 는 `/workflows/:wid/executions/:id` 새 탭 링크. 스키마 부재(노드 삭제 등) 시 원본 키 text fallback 으로 데이터 은닉을 피한다. spec 변경 불요(§10.2 이미 명시). SoT: `spec/5-system/13-replay-rerun.md §10.2`.

## Unreleased — 트리거 목록에 Schedule cron·다음 실행 시각 표시 (V-10)

### 변경 사항

1. **`GET /api/triggers` 목록이 Schedule 트리거의 cron 식·다음 실행 시각을 포함** — 종전 `TriggersService.findAll()` 은 schedule join 없이 반환해 목록 행에 `[Schedule]` 태그의 Cron·다음 실행 시각이 비어 있었다(enrichment 는 단건 `findOneDetail` 에만 존재). `spec/2-navigation/2-trigger-list.md §2.1` 은 목록 행에 이를 명시(목업 `0 9 * * * Next: 09:00`)하고 프런트(`triggers/page.tsx`)도 이미 렌더를 기대하고 있어, 본문·응답 DTO 주석·FE 3자가 어긋난 상태였다. `findAll` 이 이 페이지의 schedule 트리거 id 를 모아 `scheduleRepository.find({ triggerId In(...) })` **배치 1회**로 `cronExpression`/`timezone`/`nextRunAt` 를 붙인다(행마다 조회하는 N+1 회피, `workflow-list §2.4`·`schedules.findAll` 의 list-level enrichment 선례와 동일). 이 조회가 목록 로드마다 실행되는 hot-path 가 되므로 `schedule (trigger_id)` 인덱스(V106, FK 자동 인덱스 없던 선존 갭)를 함께 추가한다. `TriggerDto` 응답 필드 3개는 이미 존재했고 JSDoc "단건 조회 시에만" → "목록·단건 모두" 로 정정. spec 변경 불요. SoT: `spec/2-navigation/2-trigger-list.md §2.1`.

## Unreleased — 실행 내역 상세 노드 서브탭 통일 (V-05)

### 변경 사항

1. **전용 실행 내역 상세 페이지의 노드 상세가 에디터와 동일한 서브탭 UI 제공** — 종전 실행 내역 상세(`/workflows/:id/executions/:executionId`)의 노드 상세는 Preview/Input/Output/Error 4탭뿐이었고, `spec/2-navigation/14-execution-history.md` EH-DETAIL-03·§3.3/§3.4 가 ✅구현으로 명시한 Config·LLM Usage·메시지 레벨(Response/Request/LLM Usage)·References 탭은 에디터 Run Results 드로어에만 있었다(ConversationInspector 안내문이 없는 탭을 가리키는 dangling 상태). 실행 상세 페이지가 에디터 `ResultDetail` 컴포넌트를 그대로 재사용하도록 통일해 두 surface 가 완전히 동일한 서브탭·완결 대화 인스펙터·live waiting 상호작용을 제공한다. `nodeExecution.outputData`·`inputData`·`startedAt` 가 에디터 run 결과와 동일 shape 라 데이터가 그대로 흐른다. dry-run 배지는 execution-level 플래그를 함께 반영해 비-effect 노드에서도 유지. spec 변경 불요. SoT: `spec/2-navigation/14-execution-history.md §3.3/§3.4`.

## Unreleased — 초대 수락 확인 UI + 기가입자 진입 경로 (§1.5.3, V-09)

### 변경 사항

1. **이미 가입한 사용자의 다른-워크스페이스 초대 흐름이 자동수락 → 수락 확인 UI 로 전환** — `/invitations/accept` 페이지가 마운트 즉시 무조건 `acceptInvitation` 을 호출하던 것을, 토큰 메타(`GET /api/invitations/:token`)를 먼저 조회해 (a) 로그인 이메일 == 토큰 이메일이면 **[수락] 버튼**을, (b) 불일치(또는 미로그인)면 "해당 계정으로 로그인" 안내 + **로그아웃 후 전환** 버튼을 노출하도록 `§1.5.3` 대로 재작성. 사용자의 명시적 클릭 없이는 워크스페이스에 합류하지 않는다. 클라이언트 이메일 일치 검사는 UX 게이팅일 뿐이며 실제 인가는 서버(`POST /api/workspaces/invitations/accept`)가 재검증한다.
2. **초대 메일 링크의 기가입자 진입 경로 보강** — 초대 메일은 `/auth/register?invitationToken=` 로 링크하는데, 이미 로그인한 사용자가 새 탭에서 클릭하면 미가입자용 가입 폼이 떠 혼란스러웠다. register 폼이 `has_session` 힌트 쿠키(`proxy.ts` 와 동일 신호)로 기존 세션을 감지해 `/invitations/accept?token=` 로 즉시 리다이렉트한다. `(auth)` 라우트 그룹엔 세션 하이드레이션(AuthProvider)이 없어 클라이언트 store 대신 쿠키로 판정한다. SoT: `spec/5-system/1-auth.md §1.5.3` + `spec/2-navigation/10-auth-flow.md §2.6`.

## Unreleased — workflow import settings validated DTO (patch 대칭)

### 변경 사항

1. **`POST /api/workflows/import` 의 `settings` 가 검증되는 nested DTO 로 강화** — `ImportWorkflowDto.settings` 를 opaque `@IsObject() Record<string, unknown>` 에서 strict `WorkflowSettingsDto`(`@ValidateNested @Type`)로 전환했다. `UpdateWorkflowDto.settings`(PATCH, PR #805)와 동일 strict 정책으로 같은 `Workflow.settings` jsonb 의 import·patch 검증 강도 비대칭을 해소한다. 전역 `whitelist+forbidNonWhitelisted` pipe 로 **미지 `settings` 키·비양수·비정수 `maxConcurrentExecutions` 는 이제 `400 VALIDATION_ERROR`**. export→import round-trip 은 안전(export 는 post-#805 settings 를 as-is emit, 소비 키는 `maxConcurrentExecutions` 뿐). 노드 `config` permissive 정책(soft, 사용자 hand-edit 복구)과 달리 workflow-level 실행 파라미터는 admission-gate 정합을 위해 hard-fail. SoT: `spec/2-navigation/1-workflow-list.md §3.2` + `spec/1-data-model.md §2.4`.

## Unreleased — orphan pending backstop (§8 recoverStuckExecutions)

### 변경 사항

1. **부팅 backstop 이 orphan `pending` 을 회수** — admission 재큐 job 이 소실(Redis 비영속·eviction)된 `pending` Execution 은 다시 pick up 될 job 이 없어, 큐 대기 5분 timeout(consumer pick-up 시점에만 검사)을 못 받고 영구 잔류하던 갭을 닫는다. `recoverStuckExecutions`(부팅 `onApplicationBootstrap` + test-hook) 이 stale RUNNING 재구동에 더해, `status='pending' AND queued_at < now − EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 인 orphan 을 기존 `markQueueWaitTimeout`(멱등 조건부 UPDATE)으로 §8 wait-timeout `cancelled`(`EXECUTION_QUEUE_WAIT_TIMEOUT`·`cancelledBy='timeout'`)로 마감한다. RUNNING 은 진행 흔적이 있어 re-drive, PENDING 은 없어 cancel. 신규 migration·env·에러코드 없음(기존 `queued_at` V104 컬럼·`markQueueWaitTimeout` 재사용). boot-only best-effort(낮은 확률 엣지). SoT: `spec/5-system/4-execution-engine.md §8/§7.4`.

## Unreleased — workflow 동시 실행 cap validated write DTO (§8, workspace 대칭)

### 변경 사항

1. **`PATCH /api/workflows/:id` 의 `settings` 가 검증되는 nested DTO 로 강화** — 종전 opaque `Record<string, unknown>`(`@IsObject()`) 이던 `settings` 를 `WorkflowSettingsDto`(`maxConcurrentExecutions`: `@IsInt @Min(1)`)로 전환했다. workspace 의 `UpdateWorkspaceSettingsDto`(§8 admission gate) 와 대칭이며, `spec/1-data-model.md §2.4`·`spec/5-system/4-execution-engine.md §8` 이 이미 `Workflow.settings` 를 `maxConcurrentExecutions` 로 스코프한다. 전역 `whitelist+forbidNonWhitelisted` pipe 로 **미지 `settings` 키·비양수·비정수 cap 은 이제 `400`** 을 받는다(종전 무검증 통과 후 런타임 `resolveConcurrencyCap` backstop 이 defaultCap 으로 무시). **스펙 준수 클라이언트에는 영향이 없다** — backend 는 `maxConcurrentExecutions` 외 workflow settings 키를 소비하지 않으며, 프런트 `workflowsApi.update` 유일 호출부는 `{ isActive }` 만 전송한다. 서비스 `update` 는 `settings` 를 전체 교체 대신 spread-merge 해 DB 잔여 키를 보존한다(workspace 대칭). `ImportWorkflowDto.settings` 는 opaque 유지(별도 후속). SoT: `spec/5-system/4-execution-engine.md §8`.

## Unreleased — 인증 webhook 1MB body 게이트 (옵션 C) + 공개 webhook 보호 우회 fix

### 보안 수정 (Security)

1. **공개 webhook 남용 보호가 전량 우회되던 버그 수정** — `PublicWebhookThrottleGuard` 가 트리거를 `findOne({ select: { authConfigId: true } })` 로 조회했는데, 이 partial projection 이 `authConfigId` 를 (`null` 대신) 비-`null` 값으로 잘못 반환해, **모든 공개(`auth_config_id IS NULL`) webhook 이 인증 webhook 으로 오판**되었다. 결과적으로 공개 webhook 의 **32KB body 크기 제한·IP 단위 분당/시간당 rate-limit 이 전혀 적용되지 않았다**(Guard 가 본문 검사 전 early-return). full entity 로드로 교정. 회귀 가드 e2e 추가(`webhook-trigger` L: 공개 64KB → `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`).

### 변경 사항

1. **인증 webhook 본문 1MB 수용 (WH-NF-02 옵션 C)** — `/api/hooks/*` 라우트 스코프 body-parser(`createHooksBodyParsers`, 기본 1MB·`HOOKS_MAX_BODY_BYTES` env)가 인증 webhook 본문을 1MB 까지 수용하고, 초과 시 표준 봉투 `413 PAYLOAD_TOO_LARGE`. 종전 인증 webhook 은 express 기본 100KB 에서 비표준 에러로 끊겼다. 공개 webhook 의 32KB(`PublicWebhookThrottleGuard`)는 그 위에서 유지. 전역 100KB 기본은 non-webhook 라우트에 보존(라우트 스코프 분리). `main.ts` 는 `bodyParser: false` 로 Nest 기본 파서를 끄고 hooks·전역 파서를 직접 등록(Nest 가 수동 파서 감지 시 자기 전역 파서를 skip 해 본문 미파싱되는 함정 회피), rawBody 보존(HMAC 호환). SoT: `spec/5-system/12-webhook.md WH-NF-02`.
2. **`413 → PAYLOAD_TOO_LARGE` 표준 매핑** — `GlobalExceptionFilter` 가 body-parser 등 http-errors 의 413(및 4xx) 을 표준 에러 봉투로 매핑(종전 413 → `INTERNAL_ERROR`/500 오매핑 교정). `api-convention §5.3·§6`·`error-handling §1.3` 에 `PAYLOAD_TOO_LARGE` 등재.

## Unreleased — webhook/manual 400 검증 실패 필드별 사유 `error.details[]` surface

### 변경 사항

1. **webhook/manual-trigger 400 검증 실패 응답이 필드별 사유를 `error.details[]` 로 노출** — required 파라미터 누락·타입 강제 변환 실패 시(`POST /api/hooks/:endpointPath` 의 `INVALID_WEBHOOK_PAYLOAD`, 수동 실행 `POST /api/workflows/:id/execute` 의 `INVALID_TRIGGER_PARAMETERS`), 응답이 공식 에러 봉투의 `error.details[]` 에 `{ field, code, message }` 를 담는다. `code` 는 `UPPER_SNAKE_CASE` field code(`MISSING_REQUIRED_FIELD`·`TYPE_COERCION_FAILED`). 종전에는 필드별 사유가 내부적으로 산출되나 `GlobalExceptionFilter` 가 `errors` 키를 버려(클라이언트는 `{ error: { code, message, requestId } }` 만 수신) **노출되지 않았다** — 본 변경은 누락된 필드 목록을 surface 하는 **additive** 변경이며, 종전 미노출 `errors[]` 를 소비하던 클라이언트는 없다. SoT: `spec/5-system/12-webhook.md §5.2`. 코드 변경은 `hooks.service`·`workflows.controller` 의 throw payload(`errors`→`details`)와 공용 헬퍼 `toTriggerParameterErrorDetails` 한정.

## Unreleased — model-config 부속 엔드포인트 hardening (listModels type 검증)

### 변경 사항

1. **`GET /api/model-configs/:id/models` — `type` 쿼리 런타임 검증** — `type` 파라미터에 `ParseEnumPipe` 를 적용해 허용값(`chat`·`embedding`) 외 값은 이제 `400 Bad Request` 로 거부한다. 종전에는 런타임 검증 없이 서비스 레이어로 전달됐다. Swagger `@ApiQuery` 가 이미 `enum: [chat, embedding]` 을 선언하고 있어 **스펙 준수 클라이언트에는 영향이 없으며**(`@ApiBadRequestResponse` 동반 문서화), 문서 외 값을 보내던 직접 호출 클라이언트만 400 을 받는다. 코드 변경은 컨트롤러 한정(`@Throttle` 상수화·`type` enum 단일 소스 파생 동반).

## Unreleased — 웹채팅 로더 arguments-replay 버그 수정

### 변경 사항

1. **웹채팅 로더 `arguments`-replay 버그 수정** — 스니펫 스텁의 `push(arguments)` 산출물(array-like 객체)이 `Array.isArray` 가드에 걸려 통째로 버려지면서 `boot` 를 포함한 모든 사전 큐 호출이 무증상 누락되던 문제를 해소했다(#709 원인). `Array.isArray` 가드를 `length` 기반 array-like 수용 + `Array.from` 정규화로 교체. 회귀 테스트 추가.

## Unreleased — model-config `:id/test` 인가 강화 (Viewer 차단, Editor+ 강제)

### Breaking changes

1. **`POST /api/model-configs/:id/test` — Viewer 호출 차단(Editor+ 강제)** — 종전 `@Roles` 부재로 워크스페이스 멤버 전원(Viewer 포함)이 호출 가능했으나, 이 엔드포인트는 과금 provider 호출(+embedding 차원 자동저장 PATCH 부수효과)을 일으키는 action-POST 이므로 이제 `@Roles('editor')` 로 게이트한다. Viewer 자격증명의 직접 API 호출은 이제 `403 FORBIDDEN` 을 받는다. UI 상 연결 테스트 버튼은 Editor+ 전용 모델 추가/수정 폼 안에 있어 도달 경로가 없고, 실질은 직접 API 인가 갭 차단이다. `GET /api/model-configs/:id/models`(조회)는 Viewer+ 를 유지한다. 권한 계약 SoT: `spec/2-navigation/6-config.md §3` + Rationale R-7, `spec/5-system/7-llm-client.md §8.3`.

### 변경 사항

소스 변경은 `LlmModelConfigController.testConnection` 에 `@Roles('editor')` + `@ApiForbiddenResponse` 추가뿐이다(behavior change = Viewer 직접 호출 403화). lint·unit·build·e2e 전부 통과.

## Unreleased — npm audit 취약점 해소 의존성 상향

### 변경 사항

1. **보안 취약점 의존성 업그레이드** — `npm audit` 의 모든 high/critical 제거 (backend 63→0 high·crit / frontend 9→0 / channel-web-chat 2→0). 직접 의존성은 상위 패키지를 올리고, 전이 의존성은 부모가 좁게 핀해 forward 가 불가능한 경우 `overrides` 로 안전 버전을 강제했다.

   - **backend**: `nodemailer` ^8.0.4 → ^9.0.1(메이저, raw 옵션 파일읽기/SSRF `<=9.0.0` 해소) · `@nestjs-modules/mailer` ^2.3.4 → ^2.3.7(부모 상향 — 취약 `preview-email`/`mailparser` 를 optional 로 분리) · `@opentelemetry/*` 0.218→0.219·core 2.7→2.8(`@opentelemetry/core` 메모리 누수 해소) · overrides 추가/상향: `ws` ^8.21.0(DoS) · `@grpc/grpc-js` ^1.14.4 · `multer` ^2.2.0(DoS) · `form-data` ^4.0.6(CRLF) · `protobufjs` ^7.5.6→^7.6.3 · `nodemailer` ^9.0.1(중첩 사본 강제).
   - **frontend**: `dompurify` ^3.4.2 → ^3.4.11(XSS) · overrides 추가: `ws` ^8.21.0 · `form-data` ^4.0.6 · `undici` ^7.28.0(TLS 검증 우회) · `vite` ^8.0.16 · `@babel/core` ^7.29.7.
   - **channel-web-chat**: `dompurify` 3.4.7 → 3.4.11(exact pin 유지).

   **잔여(accept)**: `js-yaml`(moderate, merge-key DoS) — gray-matter@4 가 3.x `safeLoad` API 에 묶여 forward 불가하며 빌드타임 신뢰 입력(자체 docs frontmatter)만 파싱하므로 실위험 없음. backend `@babel/core`(low) — 동일하게 빌드타임 신뢰 입력.

   소스 코드 변경 없음. build·unit·e2e 전부 통과.

## Unreleased — EIA submit_form 서버 측 field 검증

### 변경 사항

1. **`submit_form` 서버 측 field 검증 추가** — EIA `POST /external/executions/:id/interact` 의
   `submit_form` 커맨드가 이제 서버 측에서 form node field 정의(필수 여부 / 이메일·숫자 형식 /
   minLength·maxLength / 선택지)를 검증한다 (spec form §4·§6.2 / EIA §5.1).

   **검증 실패 시 응답 shape** (400 Bad Request):
   ```json
   { "error": { "code": "VALIDATION_ERROR", "message": "<검증 메시지>",
                "details": [{ "field": "<필드명>", "message": "<검증 메시지>", "code": "INVALID_FIELD" }] } }
   ```

   - 현재 단계 FIRST 오류만 surface (`details` 배열 길이 항상 1).
   - 검증 실패해도 `execution.status` 는 `waiting_for_input` 유지(재제출 가능).
   - WS ack 경로는 `errorCode='VALIDATION_ERROR'` 로 매핑됨 (`ExecutionError` 계층 자동 처리).

2. **`VALIDATION_ERROR` 에러코드 — `ErrorCode` enum 에 추가** (`codebase/backend/src/nodes/core/error-codes.ts`).
   기존 `MessageTooLongError` 등과 동일한 패턴으로 단일 SoT 로 관리.

## Unreleased — Code 노드 isolated-vm 전환 후속 (base64 TypeError + 메모리 한도 env)

### Breaking changes

1. **`$helpers.base64.encode/decode` — 비문자열 입력이 이제 `error` 포트로 분기**

   이전 동작: 비문자열(예: 숫자, 객체)을 전달하면 `String(data)` 로 암묵적 변환 후 정상 처리.
   신규 동작: 비문자열 입력 시 `TypeError`(`$helpers.base64.encode: data must be a string, got <type>`)
   를 throw → 코드 노드 `error` 포트로 분기.

   **영향받는 워크플로우**: `$helpers.base64.encode(42)` 처럼 비문자열을 명시 전달하던 코드.
   **조치**: 입력값을 `String(...)` 으로 명시 변환 후 전달하거나 `error` 포트 처리 추가.

   배경: `$helpers.crypto.hash` 와의 타입 계약 일관화. 자세한 Rationale 은
   `spec/4-nodes/5-data/2-code.md §Rationale "$helpers 입력 타입 계약"` 참조.

## Unreleased — KB 임베딩 legacy 컬럼 은퇴 + ModelConfig 에러코드 통일 (PR4b)

> **자사 클라이언트 무영향**: 아래 변경의 소비자는 자사 프론트엔드뿐이며, 프론트가 이미 신 에러코드를 처리하고 KB 요청에 `embeddingModelConfigId` 를 전송하도록 대응 완료된 상태에서 적용됐다. 외부 API 소비자가 없으므로 deprecation 윈도우·구코드 이중발행 없이 교체했다.

### Breaking changes

1. **에러코드 rename (ModelConfig 경로)** — 응답 `error.code` 슬롯:
   - `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` (400). 접두어를 `MODEL_CONFIG_*` 로 통일. 의미·status 변경 없음.
   - `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` (400). id 미지정 시 워크스페이스 default config 부재 경로. id 부재(404)는 `MODEL_CONFIG_NOT_FOUND` 로 별도 분리(동일 코드의 404/400 이중 status 모호성 제거). rename 이력은 `spec/conventions/error-codes.md §4`.

2. **KB create/update DTO 에서 `embeddingModel`·`embeddingLlmConfigId` 필드 제거** — `POST`/`PATCH /api/knowledge-bases` 요청 body 에 이 두 필드를 보내도 **무시된다**(silent breaking). 임베딩 모델 선택은 `embeddingModelConfigId`(1급 `kind=embedding` ModelConfig 참조)로만 수행한다.

3. **KB 응답에서 `embeddingLlmConfigId` 제거, `embeddingModel` 은 read-only(derived) 로 변경** — `GET /api/knowledge-bases`, `GET /api/knowledge-bases/:id` 응답 shape 에서 `embeddingLlmConfigId` 필드가 제거됐다. `embeddingModel` 은 더 이상 저장 컬럼이 아니라 참조 ModelConfig 의 `defaultModel` 에서 파생되는 읽기 전용 값이다(워크스페이스에 embedding ModelConfig 가 없으면 빈 문자열). 변경은 `embeddingModelConfigId` 로만 가능하다.

### Migrations

- **V093** (`knowledge_base` 임베딩 repoint): `embedding_model_config_id IS NULL` 인 모든 KB 를 1급 `kind=embedding` ModelConfig 로 repoint(원래 provider·model·dimension 보존). repoint 불가 KB 가 1건이라도 있으면 fail-loud RAISE 로 전체 롤백(V094 미실행).
- **V094** (legacy 컬럼 DROP, **비가역**): `knowledge_base.embedding_llm_config_id`·`embedding_model` 컬럼과 FK 제약 DROP. `AccessExclusiveLock` 획득하므로 low-traffic 윈도우 배포 권장(`lock_timeout=3s`).

## Unreleased — AI 노드 설정 폼 auto-form 전환 (text_classifier · information_extractor)

- **`text_classifier` · `information_extractor` 설정 폼을 schema-driven auto-form 으로 전환** (cross-audit V-02). 기존 bespoke override 폼이 누락하던 필드 — Conversation Context 5필드, System Context 2필드, few-shot `examples`, `outputSchema[].enumValues`, `maxCollectionRetries`, (information_extractor) memory 전략 7필드 — 가 설정 패널에 정상 노출된다. 이전에는 Code 탭 JSON 으로만 설정 가능했다.

  **참고**: `text_classifier` 의 `includeConfidence` 신규 노드 기본값은 zod 스키마 정의(`false`, spec §1)를 따른다 — 구 bespoke 폼이 `true` 로 표시하던 것은 spec 과 어긋난 동작이었고 본 전환으로 교정됐다. 기존 저장된 설정값에는 영향이 없다.

## Unreleased — Health Probe Liveness/Readiness 분리

### Breaking changes

1. **`GET /api/health` — unhealthy 시 HTTP 200 → 503 반환** (이전: 항상 200)

   k8s readinessProbe 가 이 경로를 사용하며, 의존성(DB/Redis) 중 하나 이상이 비정상일 때 503 을 반환한다. 응답 body(`{ status, version, uptime, checks }`)는 200 과 동일하게 유지된다.

   **영향받는 소비자**: 외부 모니터링·알람 시스템이 `/api/health` 응답 코드 200 을 "정상" 기준으로 사용 중이라면 503 도 수용하도록 규칙을 갱신해야 한다.

2. **신규 `GET /api/health/live` 엔드포인트 추가** (liveness probe 전용)

   DB/Redis 를 점검하지 않고 프로세스 생존만 확인해 항상 200 을 반환한다 — `{ status: "ok" }`. k8s livenessProbe 를 이 경로로 변경해 DB 장애 시 Pod 크래시루프를 방지한다.

3. **`HEALTH_CHECK_LOG` 환경변수 추가** (기본 `false`)

   `false`(기본값)이면 `/api/health`, `/api/health/live` 프로브 성공 요청의 로그를 억제한다. 기존 배포에서 이 변수가 미설정인 경우 성공 로그가 묵시적으로 억제된다 — 운영 모니터링 로그 기반 알림 규칙을 확인하라. k8s `ConfigMap/backend-config` 에 `HEALTH_CHECK_LOG: "false"` 가 명시 반영되었다.

## Unreleased — execution-engine: _resumeCheckpoint schemaVersion 견고화 (PR-A2a)

- **execution-engine**: `_resumeCheckpoint` 에 `schemaVersion`(=1) 추가 — 롤링 배포 중 구 인스턴스가 신 포맷 checkpoint 를 pickup 할 경우 graceful `RESUME_INCOMPATIBLE_STATE` 로 종결. 버전 부재(기존 row) = legacy 허용(backward-compatible), 미래 버전(코드 미지원) = 재구성 포기 + 안전 재시작 유도.

## Unreleased — Node Output Contract Unification

Implements the CONVENTIONS rulebook in `spec/conventions/node-output.md` across all 26+ node handlers. Split over staged refactors (Stage 1–7 + follow-ups) all landing in this release.

### Breaking changes

Workflow authors referencing node output in `{{ … }}` expressions need to migrate or run the provided script. A dry-run is non-destructive:

```
npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
  --workspace-id <uuid> --user-id <uuid>
```

1. **`NodeHandlerOutput` contract** — every handler now returns `{ config, output, meta?, port?, status?, _resumeState? }`. Legacy `{ port, data }` and bare-object shapes are no longer produced by core handlers (the engine adapter still accepts bare returns for test doubles).
2. **Information Extractor** — `output.output.extracted.*` double-nesting removed. New path: `output.result.extracted.*`. `output.output.{messages, endReason, turnCount}` → `output.result.{messages, endReason, turnCount}`. `output.output.collectionRetryCount` → `meta.collectionRetryCount`. `output.output._turnDebugHistory` → `meta.turnDebug`.
3. **AI Agent** — single-turn, multi-turn terminal, and condition-triggered outputs unified under `output.result.{response, messages, turnCount, endReason, condition?}`. Tokens and tool-call counts migrated from `output.metadata.*` to top-level `meta.*`. Condition trigger no longer uses the legacy `{ port, data }` envelope.
4. **Text Classifier** — single-label: `output.category` → `output.result.category` (+ `output.result.confidence`). Multi-label: `output.categories` → `output.result.categories`. Tokens stay on `meta.*`.
5. **Presentation nodes (form / carousel / chart / table / template)** — removed the `output.type` discriminator and the literal-config echo fields (`layout`, `chartType`, `columns`, `items` (static), `format`, `title`, `fields`, `submitLabel`). Those literal values are now read via `$node["X"].config.*` (CONVENTIONS §1.1). Template renames `output.content` → `output.rendered`.
6. **Form resume** — `status: 'submitted'` removed; the engine now emits `status: 'resumed'` + `output.interaction.{type:'form_submitted', data, receivedAt}`. Legacy `output.submittedData` is migrated to `output.interaction.data`.
7. **Button-based presentation resume** — `status: 'button_click' | 'button_continue'` collapsed into `status: 'resumed'` with the original value preserved in `output.interaction.type`. Migration script auto-substitutes `status === '<old>'` comparisons but operators should verify the matching `output.interaction.type` branch exists.
8. **Container nodes (loop / foreach / map / parallel)** — the engine no longer overwrites container output with a flat array. It now emits `{ iterations | items | mapped | branches, count }` on the `done` port (CONVENTIONS §9.2). `$node["Loop"].output[0]` style access is no longer valid — use `$node["Loop"].output.iterations[0]`.
9. **Runtime error envelope** — all nodes that can fail at runtime (http_request, database_query, send_email, code, ai_agent, text_classifier, information_extractor, workflow) now route to `port: 'error'` with `output.error: { code, message, details? }`. Pre-flight errors continue to throw as before.
10. **Error code rename** — in the `output.error.code` slot:
    - `QUERY_FAILED` → `DB_QUERY_FAILED`
    - `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` (with the original `IntegrationError` code preserved in `details.integrationCode`)
    - `CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` → `CODE_EXECUTION_FAILED`
    - `EXECUTION_TIMEOUT` (code node only) → `CODE_TIMEOUT`
    - `HTTP_5XX` / `HTTP_4XX` added (non-2xx responses now carry both `output.response` and `output.error`)
    - `SUB_WORKFLOW_FAILED` added
    - New interaction-level codes reserved: `USER_CANCELLED`, `INTERACTION_TIMEOUT`
11. **`workflow` and `send_email` schemas** — added `error` port. Sub-workflow runtime failures are now routed rather than thrown; un-connected `error` ports fall back to the Stop Workflow policy documented in `spec/5-system/3-error-handling.md §3.2`.
12. **`send_email.subject`, `send_email.to`, `send_email.cc`, `send_email.bodyType`** — moved from top-level handler output to `config`.
13. **HTTP request** — `output.statusCode` / `output.duration` / `output.headers` moved from `output` to `meta`. URL-level credentials (`https://user:pass@…`) are stripped in `config.url` AND `output.error.details.url`.
14. **`NodeHandlerOutput.config` echoes raw template** (PRD `ENG-RC-*`, CONVENTIONS Principle 7). Handlers now receive both `context.rawConfig` (pre-evaluation, frozen snapshot of `node.config`) and the evaluated `config` argument. The echoed `config.*` is the **raw** value the workflow author entered (`{{ ... }}` preserved); the evaluation result lives on `output.*`. Workflows that referenced `$node["X"].config.<expression-field>` for the evaluated value must switch to `$node["X"].output.<field>`. The migration script handles common field renames (Send Email subject/body/bodyType, HTTP Request url and similar). Expression-free fields (`mode`, `chartType`, etc.) are unaffected — raw and evaluated coincide.
15. **Send Email — new `output` fields** (additive): `output.subject`, `output.body`, `output.bodyType` (evaluated values that actually went on the wire); `output.bodyTruncated: true` when `output.body` exceeded the 256KB cap (`Buffer.byteLength` UTF-8). The standardized `output.error` envelope still carries the failed body for debugging.
16. **HTTP Request — new `output` fields** (additive): `output.requestBody`, `output.requestBodyType` (evaluated request body that hit the wire, capped at 256KB with `bodyTruncated`); `output.responseHeaders` (sanitized response headers — credential-shaped values redacted with hybrid blacklist + pattern match). Transport errors omit `responseHeaders` (no `Response` available).

### Replay / View Policy (new)

The execution-history UI displays `NodeExecution.outputData` as-is — the engine does **not** re-evaluate stored config or re-trigger external side effects when you open an execution row. This is **View** mode: zero side effects, zero expression evaluation.

**Re-run** (new Execution that re-evaluates the current workflow definition's raw config — re-triggers emails, HTTP calls, DB writes) is **not implemented** in this release. When introduced (future PRD), it will be a distinct user action with explicit safeguards (confirmation, dry-run option, idempotency keys).

**Multi-turn resume** (`POST /executions/:id/continue`) is not replay — it is the same Execution proceeding to its next turn, using the `state.rawConfig` frozen snapshot so workflow edits made during the wait do not affect the in-flight session.

Pre-release `NodeExecution` rows have `outputData.config` in evaluated form (no rawConfig exposure yet) and lack the new `output.{subject, body, requestBody, responseHeaders, bodyTruncated}` fields on Send Email / HTTP Request. These rows are **not backfilled** — they remain as historical records. Live execution behaviour is unaffected (each Execution uses its own `nodeOutputCache`; there is no cross-execution expression reference).

See [Spec 실행 엔진 §6.3](spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy) for the canonical policy.

### Internal / Infrastructure

- Handler-output adapter (`backend/src/modules/execution-engine/handler-output.adapter.ts`) simplified to a strict new-shape pass-through plus a narrow legacy-bare wrapper for tests. The legacy `{ port, data }` branch is removed. In `NODE_ENV==='production'` the adapter throws on any non-canonical return (production handlers are type-checked, so this catches bugs early); test/dev keeps lenient coercion via the exported `wrapBareAsNodeHandlerOutput()` helper.
- Expression resolver always reads from the structured cache; the `{ output: flat }` shim branch is retained only for pre-seeded test fixtures that skip the structured cache.
- `_multiTurnState` → `_resumeState` rename. Engine reads `_resumeState ?? _multiTurnState` to protect in-flight multi-turn sessions across deploys. The dual-read will be retired one release after all handlers emit `_resumeState` (currently: ai_agent, information_extractor).
- Migration script `backend/scripts/migrate-node-output-refs.ts` now runs the entire `--apply` phase inside a single DB transaction, requires `--workspace-id <uuid> --user-id <uuid>` for the audit row, and emits audit-only hits for legacy fields that cannot be safely rewritten (`output.error.nodeId` / `nodeType` / `timestamp` / `originalInput`, `output.type` discriminator).

### Migration steps for workflow authors

1. **Dry-run the migration** to see every change that will be applied to stored workflow expressions:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
   ```
2. **Review audit-only hits** in the dry-run output (marked "manual review needed"). These cannot be auto-rewritten — edit affected nodes in the editor.
3. **Confirm no live multi-turn AI sessions are in flight** (pending `waiting_for_input`). The `_multiTurnState`→`_resumeState` dual-read protects most sessions, but a belt-and-suspenders check before deploy is recommended.
4. **Apply** with the new CLI flags:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
     --workspace-id <uuid> --user-id <uuid>
   ```
5. **Verify** by running representative workflows. The migration is idempotent — re-running is safe.

### Test infrastructure

- **`make e2e-*` 가 매 실행마다 backend 이미지를 자동 rebuild** — `Makefile` 의 `e2e-up` / `e2e-test` / `e2e-test-full` 가 `docker compose ... --build` 를 명시. 누락 시 Docker layer cache 에 박힌 stale 이미지가 재사용되어 새로 추가한 컨트롤러 (예: `BackgroundRunsController`, `ThirdPartyOAuthController`) 가 컨테이너에 반영되지 않고 e2e 가 사일런트 404 로 실패하는 회귀가 발생함 (2026-05-15 background-monitoring 사례). BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 부담은 작음.
