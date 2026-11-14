---
id: "CLE-API-EGRESS-PIPELINE"
title: "응답 자격 증명 마스킹 — 재제출 거부와 마스커 좌표계"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-EGRESS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-EGRESS"]
area: "CLE-API"
content_hash: "40196b52587699653d5aa359d89721a52f9eda70f0f4b03c2542bd98122a3f77"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "bf40795c9dd91e7af47f37a7259630d33cd688eb0a402eef4a74b5c1442d57eb"
etag: "sha256-e340750a85ef1d2c0c221f3b0b0b262a969ddaa3ccac493e652f6d6872899320"
---
## 개요

이 문서는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 의 하위 문서로 재제출 거부, `llmCalls` strip-only, 마스킹 호출 순서, 마스커 좌표계를 정한다. §N 은 원문 절 번호이고 「규칙 N」 · §1 · §2 는 부모에, 나머지 절은 부모의 [하위 문서](CLE-API-EGRESS.md#하위-문서) 가 가리키는 문서에 있다.

## 4. 다시 쓰이는 값과 재제출 거부

마스킹은 "읽혀서 다시 쓰이는 값" 과 만나면 가시성이 아니라 **데이터 무결성** 문제가 된다. 원문 문서는 이 형태를 두 번 겪었다. `Execution.inputData`(재실행 재제출)와 폼 `defaultValue` 다.

### 4.1 `inputData` 는 두 수준 모두 가린다 (2026-08-20)

| 값 | 마스킹 | 이유 |
|---|---|---|
| `Execution.inputData` (REST) | **함** (2026-08-20 부터) | 재제출 경로였으나 마커 가드가 프리필과 제출을 막는다 |
| `NodeExecution.inputData` (REST) | **함** | 재제출 소비처가 없다(표시 전용) |
| WebSocket 노드 이벤트 `input` (발행) | **함** | 위와 같은 값이 같은 프론트엔드 store 슬롯(`nodeResults[].inputData`)에 들어간다 |

세 줄이 같은 규칙을 따른다. 한 수준만 REST 에서 가리지 않으면 WebSocket 마스킹이 2초 폴링에 덮여 화면이 깜빡이고(flip-flop) wire 마스킹의 보안 이득도 사라진다. 실행 수준을 가려도 재실행이 오염되지 않는 것은 마커 가드가 프리필과 제출을 막기 때문이다. 가드가 없으면 그 오염이 되살아난다. 기본 재실행은 서버가 `original.inputData` 를 엔티티에서 직접 읽으므로 영향이 없다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)).

`inputData` 의 주요 자격 증명 벡터인 웹훅 민감 헤더는 받는 시점에 이미 `[REDACTED]` 다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)). 남는 노출은 트리거 파라미터 자유 텍스트 안의 자격 증명이다.

### 4.2 소비 쪽 마커 가드

마커를 감지해 해당 필드를 다시 입력하게 **강제**하는 가드를 소비처마다 둔다.

| 소비처 | 가드 | 시점 |
|---|---|---|
| 폼 프리필 (`DynamicFormUI`) | 마커면 프리필을 건너뛰고 다시 입력하라고 안내한다 | 2026-08-17 |
| 재실행 모달 | 마커면 프리필을 건너뛰고 **세 조건이 모두 참이 될 때까지 제출을 막는다.** 사용자가 그 키를 건드렸고 현재 값에 마커가 없고 구조 필드라면 JSON 파싱에 성공했다(값만 보면 타입 변환에, 건드림만 보면 되돌린 마커에, 앞의 둘만 보면 무효 JSON 에 뚫린다). `useOriginalInput` 을 켜면 서버가 원문을 직접 읽으므로 차단도 풀린다 | 2026-08-20 |
| 에디터 히스토리 불러오기 | JSON leaf 에 마커가 **남아 있는 동안 실행을 막는다**(필드 단위로 비울 수 없는 표면이라 값을 지우지 않고 막는다) | 2026-08-20 |
| 서버 (수동 실행 경로) | 두 경로(`POST /executions/:id/re-run` 의 `inputOverride`, `POST /workflows/:id/execute` 의 파라미터)에서 값 leaf 가 마커와 **정확히 같으면 거부**한다. `400` 과 `details[].code = MASKED_VALUE_RESUBMITTED` 다. 재제출뿐 아니라 새 입력도 대상이다 | 2026-08-20 |

- **"강제" 를 안내로 낮추지 않았다.** 비우고 안내만 하면 빈 문자열이 실제 입력이 되어 오염 값만 `'***'` 에서 `''` 로 바뀐다. 그래서 두 소비처는 제출 자체를 막는다. 폼 경로가 안내로 충분한 것은 네이티브 `required` 검증에 기댈 수 있어서다.
- 마커 집합과 깊이 상한의 기준은 공유 패키지 `@workflow/masked-markers` 다(2026-08-21 이관). 백엔드 `sanitize-error-message.ts` 와 프론트엔드 `lib/utils/masked-markers.ts` 는 재export shim 이라 맞출 미러가 없다.

### 4.3 서버 재제출 거부의 범위

- **구현 위치**: 두 호출부는 기본 `resolveTriggerParameters` 가 아니라 래퍼 `resolveTriggerParametersRejectingMasked`(`reject-masked-resubmission.ts`)를 부른다. 판정기는 같은 파일의 `hasMaskedLeaf` 이고 깊이 상한 `MAX_REDACT_DEPTH` 를 함께 쓴다(§7 표 2행). **기본 함수에 넣지 않은 것은 의도다.** 기본 함수는 웹훅·스케줄도 함께 쓰므로 거기 넣으면 무관한 경로가 같은 거부 규칙을 진다. 수동 경로가 기본 함수를 직접 부르면 CI 가드(`masked-reject-callers-guard.ts`)가 RED 를 낸다.
- **범위는 수동 실행 경로 전체다.** `POST /workflows/:id/execute` 는 재제출 전용이 아니다. 같은 엔드포인트가 에디터 JSON 에디터의 자유 편집도 받고 값이 히스토리에서 왔는지 방금 친 것인지 구분할 플래그가 없다. 그래서 사용자가 수동 파라미터 값으로 리터럴 `***` 를 일부러 넣어도 거부된다.
- **판정 기준은 값의 출처가 아니라 페이로드를 쓰는 주체다.** 수동 트리거 파라미터는 워크플로우 작성자가 정의한 값 슬롯이고 이 제품은 이미 그 표면에서 마커 리터럴을 값으로 취급하지 않는다(프론트엔드 가드 `editor-toolbar.tsx` 가 출처와 무관하게 마커 leaf 를 막는다). 서버는 그 규칙을 API 수준으로 옮길 뿐이다. 두 층이 다른 규칙을 쓰면 한쪽만 통과하는 값이 생긴다.
- **웹훅 수신과 스케줄은 대상이 아니다.** 그쪽 본문은 외부 시스템이 쓰는 임의 페이로드라 리터럴 `***` 가 정상 값일 수 있다(사용자가 폼에 별표를 입력했을 수 있다).
- **알려진 제약**: 마스킹 마커 세 문자열은 수동 파라미터에서 **예약어**가 된다. 그 값을 정말 보내야 하면 앞뒤에 문자를 붙인다(정확 일치만 보므로 `a***b` 는 통과한다). 프론트엔드가 이미 같은 비용을 치르고 있고 두 층의 규칙을 갈라 두는 비용이 더 크다.
- **보장의 경계는 정확 일치다.** 값 마스킹의 **부분 치환**(`scheme://user:pass@host` → `scheme://***@host`)은 문자열 전체가 마커가 아니라 감지되지 않는다. 자격 증명은 이미 빠진 뒤라 노출 위험은 없지만 다시 쓰이는 성질은 남는다. 포함 매치로 넓히지 않는 이유는 `a***b` 같은 정상 값까지 막아 정상 워크플로우를 망가뜨리기 때문이다(프론트엔드 캐너리가 양방향으로 고정).
- 요청 DTO 설명에 이 거부 규칙을 적는 의무는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 보안·정책 캐비엇에 있다.

## 5. `llmCalls` 는 외부 수신자에게서 뺀다 (strip-only)

`execution.ai_message` 와 입력 대기 `nodeOutput.meta.turnDebug` 의 `llmCalls[].requestPayload`·`responsePayload` 는 LLM 프로바이더와 주고받은 원본 요청·응답이다. 시스템 프롬프트, 대화 이력, 도구 정의, 사용자 입력 같은 민감 데이터를 담을 수 있다.

- `llmCalls` 는 워크스페이스 인증과 소유권으로 게이트된 **내부 WebSocket 채널(`execution:{executionId}`)에만** 싣는다.
- **모든 외부 fanout 수신자**(인터랙션 토큰 `iext_*`·`itk_*` 로 인증하는 EIA SSE, EIA 알림 웹훅, 채팅 채널 아웃바운드)와 **EIA 단발 상태 조회** 응답에서는 필드 이름 기준으로 **어느 중첩 깊이에서든** 뺀다. `ai_message` 에 한정되지 않는다.
- 채널 최종 사용자는 최종 assistant 텍스트와 `presentations` 만 받는다.
- DB 영속 경로(`NodeExecution.output_data.meta.turnDebug[i].llmCalls`)와 그것을 출처로 하는 실행 내역 디버그 패널은 영향이 없다.
- 내부 wire 에서 `llmCalls` 는 값 패턴 마스킹의 대상도 아니다(`WIRE_PRESERVED_FIELDS`). 값 마스킹은 자유 텍스트 필드(`error`, `message`, `output` 등)에 **추가**된 것이지 strip 을 대체하지 않는다. strip 은 디버그 전용 필드를 빼고 값 마스킹은 어느 필드에든 박힐 수 있는 자격 증명 패턴을 가린다.

## 6. 호출 순서: 마스킹은 한 번이다

두 층에서 지킨다.

1. **함수 안**: `deepRedactObject` 는 자격 증명 키의 값이 **이미 마커면 덮지 않는다**(`isMaskedMarker(v) ? v : VALUE_MASK_MARKER`). 앞 층이 남긴 키 마커가 값 마커로 바뀌면 두 마커의 뜻 구분이 사라진다. 키 이름 판정의 이야기이고 헤더 값 검증 오류 패턴은 예외다(규칙 5, §3.10).
2. **호출 순서**: `WebsocketService.toFanoutEnvelope` 은 아래 네 단계이고 **뒤에서 다시 마스킹하지 않는다.** 다시 걸면 `attachRoutingContext` 가 붙인 `chatChannel` 의 키 마커를 값 마커로 덮는다(그 마커는 기존 테스트가 고정하는 계약이다).

```mermaid
flowchart LR
  A[maskWireEnvelope<br/>wire 단계 마스킹] --> B[stripExternalOnlyFields<br/>디버그 필드 제거]
  B --> C[allowlistFanoutNodeOutput<br/>fail-closed 허용 목록]
  C --> D[attachRoutingContext<br/>triggerId·chatChannel 부착]
```

- 3단계 `allowlistFanoutNodeOutput`(2026-08-24)은 fail-closed 허용 목록이다. 앞의 `stripExternalOnlyFields` 가 이름을 아는 것을 빼는 deny-list(fail-open)인 반면, 이쪽은 `nodeOutput`·`buttonConfig.nodeOutput`·`output` **세 자리**에서 아는 것만 남긴다.
- 순서가 중요하다. 허용 목록을 `attachRoutingContext` **뒤에** 걸면 그 함수가 얹은 `triggerId`·`chatChannel` 이 목록 밖이라 떨어진다.
- **1단계 → fanout 진입과 subject 입력은 타입으로 묶었다(2026-11-06).** `maskWireEnvelope` 는 파일 안 brand 를 붙인 봉투(`MaskedWireEnvelope`)를 돌려주고 `toFanoutEnvelope` 는 그 타입만 받는다. `FanoutEnvelope` 를 만드는 곳은 `toFanoutEnvelope` 하나다. `executionEventSubject` 는 payload 가 `FanoutEnvelope` 인 `FanoutExecutionChannelEvent` 만 받는다. 그래서 값 마스킹을 건너뛴 봉투나 `toFanoutEnvelope` 를 지나지 않은 봉투를 subject 에 넣으면 빌드가 깨진다. 소비처가 보는 `executionEvents$` 의 `ExecutionChannelEvent` 는 그대로다(Rationale 「fanout 봉투를 타입으로 묶은 이유」).
- **타입이 막지 못하는 것이 남는다.**
  - 타입 단언(`as`)은 막지 못한다. brand 가 붙은 봉투를 spread 해 필드를 더하는 것도 막지 못한다.
  - 표지 타입(`FanoutEnvelope`·`MaskedWireEnvelope`·`FanoutExecutionChannelEvent`)으로의 단언이 정한 자리(`toFanoutEnvelope`·`maskWireEnvelope`) 밖에 없는지, subject 에 넣는 payload 가 `toFanoutEnvelope` 의 결과인지는 소스 스캔 테스트(`websocket-fanout-envelope.spec.ts`)가 본다. 타입 이름으로 찾으므로 별칭을 거친 단언은 잡지 못한다.
  - `toFanoutEnvelope` 안 2~4단계(strip → allowlist → attach)의 순서는 여전히 한 함수 안의 규율이다. 컴파일러도 가드도 그 순서를 보지 않는다. 그래서 여기 적는다.
- **순서 계약의 확인 범위는 `toFanoutEnvelope` 경로다.** 종결 에러 payload(`TerminalErrorPayload`)는 그 대상이 아니다(2026-08-29 전수 확인). 그 payload 를 채우는 `toTerminalErrorPayload` 호출부는 **5곳이고 모두 발행 쪽**(`chat-channel.dispatcher` 1, `execution-engine.service` 3, `retry-turn.service` 1, DB 쓰기 0)이다. 마스킹은 `sanitizeErrorMessage` 가 아니라 `redactTerminalError` → `deepRedactSecrets`(§7 표 2행)라는 **별도 관문**으로 걸린다. `sanitizeErrorMessage` 의 실제 범위는 알림 경로다. 두 경로는 방어 강도가 달라 하나의 "전 경로 불변식" 으로 묶지 않는다.

## 7. 마스커 좌표계

세 계열이 있다. ① 공유 `MAX_MASK_DEPTH`(표 1~3행, 백엔드와 프론트엔드가 같은 수를 본다) ② WebSocket 전용 `MAX_SANITIZE_DEPTH`(표 4행, 따로 선언) ③ 호출부가 값을 정하는 `stripExternalOnlyFields`(표 5행).

| # | 상한 | 값 | 비교 | 넘으면 | 소비처 (심볼) |
|---|---|---|---|---|---|
| 1 | `MAX_MASK_DEPTH` (`@workflow/masked-markers`) | **10** | 없음 | 없음 | **기준 상수.** 표 2·3행이 이 값을 참조한다 |
| 2 | `MAX_REDACT_DEPTH` (백엔드 지역 별칭) | **10** (표 1행 재export) | `depth >= N` | `VALUE_MASK_MARKER` | `deepRedactSecrets`(REST 응답, 저장 에러, 대화 스레드, **워크플로우 AI 어시스턴트 탐색 응답**, **종결 에러 payload 발행**(`redactTerminalError` 경유, 2026-08-29 등재)) · `deepRedactSecretsPreserving`(**WebSocket 발행 wire 값 마스킹**: `execution:`·`kb:`·`background:run:`, `maskWireEnvelope` 경유, 2026-11-06 등재) · `hasMaskedLeaf`(수동 실행 재제출 거부 판정) |
| 3 | 프론트엔드는 별칭 없이 `MAX_MASK_DEPTH` 를 직접 import | **10** (표 1행 그대로) | 값 검사를 **먼저** 하고 `depth >= N` 에서 내려가기를 멈춤 | 스캔 범위 `0..N` | `hasMaskedMarkerLeaf`(폼 프리필 건너뛰기, 재제출 차단) |
| 4 | `MAX_SANITIZE_DEPTH` (`websocket.service.ts`, **별개 불변식**) | **10** (따로 선언) | `depth > N` | `DEPTH_MASK_MARKER` | `sanitizePayloadForWs`(WebSocket 발행) |
| 5 | `stripExternalOnlyFields(_, maxDepth)` | **호출부 지정** | `depth > maxDepth` | 하위 트리를 **보존**(손대지 않음) | 두 표면이 각자 **자매 sanitizer 의 상한**을 넘긴다 |

- **"값" 열은 깊이 값이지 행 번호가 아니다.** 지금 네 상한이 모두 `10` 이지만 표 2·3행은 표 1행을 참조하고 표 4행은 따로 선언해 우연히 같을 뿐이다. 문장에서 행을 가리킬 때는 늘 "표 N행" 으로 적는다.
- **표 5행의 호출부는 둘이다.** `InteractionService` 의 공개 표면 조립부가 `MAX_REDACT_DEPTH` 를, `WebsocketService.toFanoutEnvelope` 이 `MAX_SANITIZE_DEPTH` 를 넘긴다. `stripExternalOnlyFields` 에는 자기 상한이 없다. 표면마다 자매 sanitizer 와 어긋나면 strip 이 닿지 않는 층에 마스킹만 걸리거나 그 반대가 된다.
- **이름이 한 단어 다른 스캐너가 둘 있다.** 백엔드 `hasMaskedLeaf`(`reject-masked-resubmission.ts`, 표 2행)와 프론트엔드 `hasMaskedMarkerLeaf`(`lib/utils/masked-markers.ts`, 표 3행)다. 같은 상한을 쓰지만 파일도 스택도 다르다. 한쪽만 고치고 "양쪽 고쳤다" 고 적는 사고가 실제로 두 번 났다.
- **인용은 심볼 기준이다.** 줄 번호는 리팩터링마다 낡아 쓰지 않는다.
- **`maskSensitiveFields` 는 이 표에 행이 없다**(2026-08-24). 옛 소비처는 노드 설정 에코(`handler-output.adapter.ts`)와 워크플로우 AI 어시스턴트(`explore-tools.service.ts`) 둘이었는데 앞의 것이 없어졌다. 설정 에코를 표현식이 읽는데 가려져 있어 기능이 오염됐기 때문이다(§3.9). 남은 소비처는 깊이 상한이 없어 이 표의 축(깊이)에 해당하지 않는다.
- **대신 지켜야 할 축이 하나 생겼다.** 설정 에코는 이제 나가는 시점의 `deepRedactSecrets*` **하나에만** 기대므로 그 키 축이 `DEFAULT_SENSITIVE_KEYS` 를 **포함**해야 한다. `mask-sensitive-fields.util.spec.ts` 의 포함 관계 캐너리가 정본 구현으로 그것을 단언한다(목록에서 파생하므로 목록이 넓어져도 자동으로 검사한다).

값 패턴의 길이 상한(헤더 값 검증 오류 2048자)은 이 표에 없다. 넘으면 마커 없이 통과한다(§3.10). [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 가 진단 메시지를 자르는 길이와는 무관하다.

### 7.1 값이 같다고 같은 상한이 아니다

표 2행과 표 4행은 둘 다 `10` 이지만 비교가 `>=` 와 `>` 라 **마커가 놓이는 최대 깊이가 한 칸 다르다**(각각 10, 11). 표 4행을 표 1행에서 재export 하지 **않은 것도 의도다.** 값을 공유하면 다음 사람이 비교 연산자까지 같다고 읽는다.

두 스캐너(표 2행 `hasMaskedLeaf`, 표 3행 `hasMaskedMarkerLeaf`)가 `>=` 이면서 **값 검사를 깊이 검사보다 먼저** 하는 것도 이 한 칸 때문이다. 표 2행의 마스커가 정확히 depth `N` 에 마커를 넣으므로 스캐너가 깊이 검사를 먼저 하면 그 자리의 마커를 검사하지 않고 지나친다(off-by-one = fail-open).

## 8. 이 문서는 기계가 지키지 않는다

좌표계 표는 사람이 고쳐야 한다. 구현 위치 파일 목록의 존재만 테스트가 확인하고 표의 값·연산자·심볼이 소스와 맞는지는 검사하지 않는다.

예외는 §6 에서 타입으로 묶은 부분이다(2026-11-06). 1단계 → fanout 진입과 subject 입력을 어기면 빌드가 깨진다.

- **표가 낡는 조건**: 호출부가 줄어드는 것이 아니라 **마스커가 늘거나 합쳐지거나 상한·연산자가 바뀌는 것**이다. 이 표는 마스커(함수) 좌표계이고 호출부(응답 조립부) 좌표계가 아니다. 두 좌표계는 층이 달라 호출부를 아무리 묶어도 마스커 목록은 바뀌지 않는다.
- **표를 고친 실례**: 2026-08-23 워크플로우 AI 어시스턴트 LLM 도구가 `deepRedactSecrets` 를 겹쳐 표 2행 소비처가 늘어 그 열과 구현 위치에 등재했다. 2026-11-06 `kb:`·`background:run:` 발행이 WebSocket wire 값 마스킹(`deepRedactSecretsPreserving`, 2026-08-16 부터 표 2행 상한을 썼으나 소비처 열에 빠져 있었다)을 지나게 되어 함께 등재했다.
- **틀린 예고의 실례 (2026-08-23)**: "`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 합치면 표 2행·5행 소비처가 낡는다" 는 예고는 틀렸다. 새 래퍼(`redactStoredFieldsForResponse`)는 `redactStoredDataForResponse` 위에 서서 여전히 `deepRedactSecrets` 를 부르고 표 5행 호출부(`websocket.service.ts`·`interaction.service.ts`)는 합친 게이트와 접점이 없다. 마스커 좌표계를 호출부 좌표계로 착각했다.

## Rationale

### 좌표계를 문서로 둔 이유 (2026-08-22)

문서를 새로 두는 것이 자동으로 옳지는 않았다. 이 저장소는 마스킹 관련 **미러를 없앴고**, JSDoc 을 되풀이하는 문서는 그 미러를 문서 층에서 되살린다. 그래서 먼저 무엇이 정말 문서에 없는지 전수로 셌다.

| 불변식 | 문서 | 코드 |
|---|---|---|
| `MAX_MASK_DEPTH`(기준 상수 이름), `MAX_SANITIZE_DEPTH`, `isMaskedMarker`, **경계 연산자** | **각 0** | 22 · 29 · 46 · 8 |
| 마커 리터럴, "깊이 상한" 서술, 재마스킹, `MAX_REDACT_DEPTH` | 1~20 | 다수 |

마커 값과 마스킹 정책은 이미 주인이 있었다. 없는 것은 정확히 좌표계였고 그것은 파일을 가로지르므로 어느 한 파일도 주인이 될 수 없다.

**틈이 실제로 문제를 냈다.** 일관성 사전 검토가 이 좌표계 혼동을 CRITICAL 로 판정해 한 구현의 착수를 막았다. 좌표계를 혼동한 테스트는 잘못된 상수·연산자·마커를 고정한다. 그때 올바른 상한을 겨냥한 것은 검토 에이전트가 파일 네 개의 JSDoc 을 대신 읽었기 때문이다. 같은 혼동의 흔적이 코드에도 있다. `masked-markers/src/index.ts` 와 `sanitize-error-message.ts` 가 **각각** "WebSocket 의 `MAX_SANITIZE_DEPTH` 는 이것이 아니다" 를 따로 적고 있다. 같은 방어 문장을 두 곳이 반복하는 것은 주인 없는 사실의 징후다.

**기각한 대안**

- **현상 유지(won't-do)**: JSDoc 네 곳이 이미 정확하고 계약 테스트도 있다. 그러나 좌표계 자체는 어느 파일에도 없었고 위 CRITICAL 이 실제로 났다.
- **세 상한을 하나로 합쳐 좌표계를 없앤다**: 가장 근본적이지만 이미 기각된 결정이다(`masked-markers/src/index.ts`: "별개 불변식이므로 합치지 않는다. 공유 프리미티브를 넓히면 무관한 경로가 오염된다"). 그 결정이 유지되는 한 좌표계는 영구적이고 영구적인 파일 간 사실은 문서를 가질 자격이 있다.
- **EIA R17 을 넓힌다**: 원문에서 R17 은 EIA 표면의 정책이 주제였다. WebSocket·노드 출력까지 걸치는 좌표계를 거기 넣으면 EIA 가 자기 표면 밖을 갖게 된다. 그래서 좌표계는 별도 규약으로 두었다. R17 의 마스킹 정책 부분은 이 규약으로 모았고 단발 상태 조회의 노출 결정은 [External Interaction API](../CLE-IX/CLE-EIA.md) 에 남겼다.
- **좌표계를 기계가 검사하게 한다(새 repo-guard)**: 표를 파싱해 소스와 대조하려면 TS AST 파서가 필요하다. 이 저장소는 가드 설계에서 "유한한 문제를 무한한 문제와 바꾸지 말 것" 을 결론으로 얻었다. 대신 §8 에 문서가 낡을 수 있다는 사실과 낡는 조건을 적는 쪽을 골랐다.

### `inputData` 카브아웃을 닫은 이유 (2026-08-20)

`Execution.inputData` 를 한동안 가리지 않은 것은 그것이 **다시 제출되는 값**이기 때문이었다. 재실행 모달이 `inputData` 로 프리필해 `inputOverride` 로 되보내고(`useOriginalInput` 기본값이 `false` 라 사용자가 손대지 않아도 제출된다), 에디터 "히스토리에서 불러오기" 도 같은 값을 textarea 에 넣어 다시 실행한다. 가리면 리터럴 `'***'` 가 새 실행의 실제 입력값이 된다. 가시성 저하가 아니라 조용한 기능 오염이다. 두 검토가 독립적으로 CRITICAL 을 냈고 소스 추적으로 확증했다.

- **카브아웃은 `Execution.inputData` 한 컬럼이었다.** `NodeExecution.inputData` 는 처음부터 가렸다. 노드 수준에는 재제출 소비처가 없기 때문이다(재실행은 `Execution.inputData` 만 읽는다, 실측). 초판은 카브아웃을 노드 수준까지 넓혔는데 그러면 WebSocket 발행은 가리고 REST 는 원문을 주어 같은 store 슬롯에서 2초 폴링이 마스킹 값을 원문으로 덮는 flip-flop 이 났다. 축을 정확히 하면 다시 쓰이는 것만 카브아웃한다는 것이었다.
- **닫는 조건은 "프론트엔드가 마커를 감지해 해당 필드를 다시 입력하게 강제하는 가드" 였고 2026-08-20 에 세 소비처가 모두 갖췄다(§4.2).** 그래서 카브아웃이 닫혔다.
- **판단 기준을 두 축으로 다시 정했다.** 옛 기준은 "외부로도 나가는가" 하나였고 안 나가면 카브아웃이 싸다는 전제가 무너졌다. 외부 노출이 없는 `Execution.inputData` 의 예외 하나를 문서 여섯 개가 기준으로 인용하면서 유지비가 가드 비용(폼 가드가 선 뒤 거의 0)을 넘었다. 그래서 축은 둘이다.
  1. **외부로도 나가는가.** 나가면 카브아웃이 불가능하다(폼 `formConfig` 는 입력 대기 이벤트를 타고 SSE·EIA 알림 웹훅으로도 나가므로 마스킹을 끄면 바로 유출이다).
  2. **예외의 미러 유지비가 가드 비용보다 작은가.** 아니면 나가지 않아도 가드로 닫는다(`Execution.inputData`).
  두 사례는 이제 같은 갈래(마커 가드)이고 도달한 경로만 다르다.
- 이 전환으로 "가르는 축은 필드 이름이 아니라 수준" 이라는 옛 서술은 폐기됐다(규칙 2 · 9).

### `llmCalls` 를 strip-only 로 정한 이유

디버깅 타임라인이 어시스턴트 메시지 단위로 요청·응답·사용량을 보이려면 LLM 프로바이더와 주고받은 원본 payload 가 필요하다. 그러나 이 원본은 시스템 프롬프트, 대화 이력, 도구 정의 같은 민감 정보를 담는다. `execution.ai_message` 는 워크스페이스 소유권으로 게이트된 내부 WebSocket 채널과, EIA SSE·EIA 알림 웹훅·채팅 채널 아웃바운드로 갈리는 fanout 양쪽으로 간다. SSE 는 인터랙션 토큰만으로 접근하고(워크스페이스 확인 없음) 채널 최종 사용자에게 가므로 원본 payload 를 그대로 흘리면 채널 사용자에게 노출된다.

- **결정**: `llmCalls`(와 그 안의 `requestPayload`·`responsePayload`)는 인증된 내부 WebSocket 채널에만 싣고 fanout(외부) 경로에서는 뺀다. 대상은 WebSocket fanout 과 EIA 단발 상태 조회 양쪽이고 필드 이름 기준 깊이 무관이다. 이 결정은 직전의 "원본 payload 운반(v1, 마스킹 없음)" 미결 항목을 사용자 결정(채널 실사용과 strip-only)으로 확정한 것이다.
- **근거**: 원본 디버그 payload 는 본질적으로 에디터 전용 관심사다. 외부·채널 수신자는 필요하지 않으므로 단일 fanout 이음매에서 빼면 최소 변경으로 노출을 닫으면서 에디터 디버그 패널은 그대로 유지된다.
- **기각한 대안**: 값 수준 마스킹은 에디터 디버깅 가치를 해치고 부분적이다. 워크스페이스 안 뷰어·편집자 역할 게이트는 별도 RBAC 확장이 필요해 이 결정 범위를 넘는다. 여러 테넌트의 뷰어 요구가 분명해지면 다시 검토한다.
- **2026-08-14 갱신**: 이 결정은 문서상 "모든 외부 수신자" 였으나 구현이 더 좁았다. fanout 은 최상위 필드만 지웠고(depth 1) REST 단발 상태 조회는 값 마스킹만 걸려 있어, 입력 대기의 중첩 경로 두 곳(`turnDebug.llmCalls`, `nodeOutput.meta.turnDebug[].llmCalls`)이 실제로 새고 있었다. 필드 이름 기준 깊이 무관 strip 으로 바꾸고 WebSocket fanout 과 EIA REST 가 같은 공용 유틸을 부르게 맞췄다. 같은 데이터에 출구가 셋(fanout, REST 입력 대기, REST 종결)이었고 출구를 따로 조립하면 한 번에 하나씩만 고쳐진다. 실제로 세 라운드에 걸쳐 하나씩 발견됐다. 그래서 처방을 한 곳에 두었다.
- **2026-08-16 보강**: 위 "기각한 대안" 은 `llmCalls` 를 값 수준 마스킹으로 **대체**하는 안이고 그 근거는 지금도 유효하다. `llmCalls` 가 아닌 자유 텍스트 필드에 값 패턴 마스킹이 **추가**된 것(§3.6, §5)은 이 결정을 번복하지 않는다.

### fanout 봉투를 타입으로 묶은 이유 (2026-11-06)

이전에는 §6 에 «이 순서는 구조가 아니라 규율이다» 라고 적고 JSDoc 으로 알렸다. subject 의 payload 타입이 `Record<string, unknown>` 이라 서비스 안의 새 발행 경로가 `toFanoutEnvelope` 를 건너뛰어도 컴파일됐다. 그래서 1단계 → fanout 진입과 subject 입력을 타입으로 묶었다(§6).

기각한 대안은 소비처가 보는 `ExecutionChannelEvent` 자체에 brand 를 거는 안이다. SSE 어댑터의 replay 제어 프레임(`buildReplayUnavailableEvent`)과 Redis 버퍼 재구성이 그 타입을 직접 만든다. 그 타입에 brand 를 걸면 그쪽까지 단언이 퍼진다. 그래서 subject 입력 전용 타입 `FanoutExecutionChannelEvent` 를 따로 뒀다.
