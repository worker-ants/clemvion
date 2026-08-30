---
id: egress-masking
status: implemented
code:
  - codebase/packages/masked-markers/src/index.ts
  - codebase/backend/src/shared/utils/sanitize-error-message.ts
  - codebase/backend/src/shared/utils/strip-external-only-fields.ts
  - codebase/backend/src/shared/utils/redact-stored-error.ts
  - codebase/backend/src/shared/utils/terminal-error-payload.ts
  - codebase/backend/src/modules/websocket/websocket.service.ts
  - codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts
  - codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts
  - codebase/backend/src/common/utils/mask-sensitive-fields.util.ts
  - codebase/frontend/src/lib/utils/masked-markers.ts
---

# CONVENTION: Egress 마스킹 좌표계 (깊이 상한 · 경계 연산자 · 마커)

> 관련 문서: [EIA §R17](../5-system/14-external-interaction-api.md) · [WS Protocol §4.1](../5-system/6-websocket-protocol.md) · [노드 Output 규약](./node-output.md) · [에러 코드 규약 §4.2](./error-codes.md) · [`@workflow/masked-markers`](../../codebase/packages/masked-markers/src/index.ts) JSDoc

## Overview

나가는 페이로드에서 자격증명을 가리는 **egress 마스킹**은 한 함수가 아니라 **여러 마스커·스캐너의 협업**이다. 각자 자기 깊이 상한과 비교 연산자를 갖고, 상한을 넘으면 서로 다른 마커를 남긴다. 본 컨벤션은 그 **좌표계**를 소유한다 — 어느 상한이 어느 연산자로 어느 마커를 어느 소비처에 남기는가, 그리고 왜 그것들을 하나로 합치지 않는가.

**SoT 분리** — 본 문서가 소유하지 않는 것은 아래가 소유한다:

| 대상 | SoT | 기계 강제 |
|---|---|---|
| 마커 **값**·집합·`isMaskedMarker` 판정 | [`@workflow/masked-markers`](../../codebase/packages/masked-markers/src/index.ts) | 패키지 계약 테스트 + 미러 재선언 가드 |
| 마스킹 **정책·적용 범위·잔여 갭** | [EIA §R17](../5-system/14-external-interaction-api.md) | — |
| 재제출 거부의 `details[].code` 정규화 | [error-codes §4.2](./error-codes.md#4-내부-전용-분류-코드-정규화-후-발행) | — |
| `outputData` echo 금지와 마스킹의 관계 | [node-output.md](./node-output.md) | — |

> **비대상 — `AuthConfig.config` 필드 마스킹**([`secret-store.md`](./secret-store.md) 의 동형 콜아웃 선례를 따른다): 그쪽은 응답 DTO 가 저장된 자격증명을 가리는 **필드 단위 정책**이고 SoT 는 [데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책) 다. 본 문서는 **나가는 페이로드를 훑어 값-패턴·키-이름으로 치환하는** 메커니즘만 다룬다. 이름이 둘 다 "마스킹" 이라 혼동하기 쉬워 명시해 둔다.

> **네트워크 egress 방화벽(SSRF 가드)과 무관하다.** [HTTP Request §SSRF](../4-nodes/4-integration/1-http-request.md) 의 "egress" 는 **아웃바운드 네트워크 목적지 제한**이고, 본 문서의 "egress" 는 **응답·이벤트 페이로드가 나가는 시점**을 뜻한다. 같은 단어가 두 도메인에 산다.

> **본 문서는 마커 리터럴을 적지 않는다.** 아래 표에서도 `VALUE_MASK_MARKER` / `DEPTH_MASK_MARKER` 라는 **이름**으로만 부른다 — 값을 적으면 그 순간 패키지의 미러가 되고, 이 저장소가 PR #1190·#1191 에서 지운 문제가 문서 레이어에서 되살아난다. *"리터럴을 박지 말고 상수를 import"* 라는 코드 규율을 산문에 적용한 것이다. (EIA §R17 이 마커 리터럴을 인용하는 것은 그쪽이 **wire 계약 서술**이라 정상이다 — 레이어가 다르다.)

---

## 1. 좌표계

세 계열이 있다: ① 공유 `MAX_MASK_DEPTH`(표 1~3행, backend·frontend 가 같은 수를 본다) ② WS 전용 `MAX_SANITIZE_DEPTH`(표 4행, **독립 선언**) ③ 호출부가 값을 정하는 `stripExternalOnlyFields`(표 5행).

| # | 상한 | 값 | 비교 | 초과 시 | 소비처 (심볼) |
|---|---|---|---|---|---|
| 1 | `MAX_MASK_DEPTH` (`@workflow/masked-markers`) | **10** | — | — | **SoT 상수**. 표 2·3행이 이 값을 참조 |
| 2 | `MAX_REDACT_DEPTH` (backend 지역 별칭) | **10** (표 1행 재export) | `depth >= N` | `VALUE_MASK_MARKER` | `deepRedactSecrets`(REST 응답·저장 에러·conversation thread · **workflow-assistant explore 응답** · **`TerminalErrorPayload` emit** — `redactTerminalError` 경유, 2026-08-29 등재) · `hasMaskedLeaf`(Manual 실행 재제출 거부 판정) |
| 3 | 프런트는 별칭 없이 `MAX_MASK_DEPTH` 를 직접 import | **10** (표 1행 그대로) | 값 검사 **먼저**, `depth >= N` 에서 하강 중단 | 스캔 범위 `0..N` | `hasMaskedMarkerLeaf`(폼 프리필 스킵·재제출 차단) |
| 4 | `MAX_SANITIZE_DEPTH` (`websocket.service.ts`, **별개 불변식**) | **10** (독립 선언) | `depth > N` | `DEPTH_MASK_MARKER` | `sanitizePayloadForWs`(WS emit) |
| 5 | `stripExternalOnlyFields(_, maxDepth)` | **호출부 지정** | `depth > maxDepth` | 서브트리 **보존**(손대지 않음) | 두 표면이 각자 **자매 sanitizer 의 상한**을 넘긴다 |

> **"값" 열은 깊이 값이지 행 번호가 아니다.** 지금 네 상한이 전부 `10` 이지만, 표 2·3행은 표 1행을 참조하고 표 4행은 **독립 선언**이라 우연히 같을 뿐이다. 본 문서의 산문은 행을 지칭할 때 항상 **"표 N행"** 으로 적는다.

> **`maskSensitiveFields` 는 이 좌표계 표에 행이 없다** (2026-08-24 명시). 종전 소비처는 `handler-output.adapter.ts`(노드 `config` echo)와 `explore-tools.service.ts`(workflow-assistant) 둘이었는데, **전자가 제거됐다** — config echo 를 표현식이 읽는데 마스킹돼 있어 기능 오염을 냈기 때문이다([실행 내역 R-5 정정](../2-navigation/14-execution-history.md)). 남은 소비처는 **깊이 상한을 갖지 않아** 이 표의 축(깊이)에 해당하지 않는다.
>
> **대신 지켜야 할 축이 하나 생겼다** — config echo 는 이제 egress 의 `deepRedactSecrets*` **하나에만** 의존하므로, 그 키 축이 `DEFAULT_SENSITIVE_KEYS` 를 **포함**해야 한다. `mask-sensitive-fields.util.spec.ts` 의 포함관계 캐너리가 정본 구현으로 그것을 단언한다 (목록에서 파생하므로 목록이 넓어져도 자동 검사).

**표 5행**의 호출부 2곳: `InteractionService` 의 공개 표면 조립부가 `MAX_REDACT_DEPTH` 를, `WebsocketService.toFanoutEnvelope` 이 `MAX_SANITIZE_DEPTH` 를 넘긴다. **`stripExternalOnlyFields` 는 자기 상한을 갖지 않는다** — 표면마다 자매 sanitizer 와 어긋나면 strip 이 닿지 않는 층에 마스킹만 걸리거나 그 반대가 된다.

> **⚠️ 이름이 한 단어 차이인 스캐너가 둘 있다**: backend `hasMaskedLeaf`(`reject-masked-resubmission.ts`, 표 2행) 와 frontend `hasMaskedMarkerLeaf`(`lib/utils/masked-markers.ts`, 표 3행). **같은 상한을 공유하지만 파일도 스택도 다르다** — 한쪽만 고치고 *"양쪽 고쳤다"* 고 적는 사고가 PR #1190 에서 두 번 났다.

> **인용은 심볼 기준이다.** 절대 라인 번호를 쓰지 않는다 — 리팩터마다 stale 화되기 때문이다.

### 1.1 값이 같다고 같은 상한이 아니다

**표 2행과 표 4행**은 둘 다 `10` 이지만 비교가 `>=` vs `>` 라 **마커가 놓이는 최대 깊이가 한 칸 다르다**(각각 10, 11). 표 4행을 표 1행에 맞춰 재export 하지 **않은 것도 의도다** — 값을 공유하면 다음 사람이 비교 연산자까지 같다고 읽는다.

두 스캐너(**표 2행** `hasMaskedLeaf` · **표 3행** `hasMaskedMarkerLeaf`)가 `>=` 이면서 **값 검사를 깊이 검사보다 먼저** 하는 것도 이 한 칸 때문이다. 표 2행의 마스커가 정확히 depth `N` 에 마커를 치환하므로, 스캐너가 깊이 검사를 먼저 하면 **그 자리의 마커를 검사도 없이 지나친다**(off-by-one = fail-open).

---

## 2. 마스킹은 한 번 — 그 뒤 단계는 마커를 덮지 않는다

두 층위로 지켜진다:

1. **함수 안**: `deepRedactObject` 는 자격증명 키의 값이 **이미 마커면 덮지 않는다**(`isMaskedMarker(v) ? v : VALUE_MASK_MARKER`). 앞선 층이 남긴 키-마커가 값-마커로 바뀌면 두 마커의 의미 구분이 사라진다.
2. **호출 순서**: `WebsocketService.toFanoutEnvelope` 은 `maskWireEnvelope`(wire 단계) → `stripExternalOnlyFields` → **`allowlistFanoutNodeOutput`**(2026-08-24 신설) → `attachRoutingContext` **4단계**이고 **뒤에서 다시 마스킹하지 않는다**. 다시 걸면 `attachRoutingContext` 가 붙인 `chatChannel` 의 키-마커를 값-마커로 덮는다(그 마커는 기존 테스트가 고정하는 계약이다).

> **3번째 단계 `allowlistFanoutNodeOutput` 는 fail-closed allowlist 다** (2026-08-24, `#1209`).
> 앞선 `stripExternalOnlyFields` 가 **이름을 아는 것을 빼는**(fail-open) deny-list 인 반면,
> 이쪽은 `nodeOutput`/`buttonConfig.nodeOutput`/`output` **세 자리**에서 **아는 것만
> 남긴다**. 순서가 중요하다 — allowlist 를 `attachRoutingContext` **뒤에** 걸면 그 함수가
> 얹은 `triggerId`/`chatChannel` 이 목록 밖이라 떨어진다. 정본 범위 표는
> [EIA §R17](../5-system/14-external-interaction-api.md).

**2 는 구조가 아니라 규율이다** — 세 번째 emit 경로가 순서를 다르게 조립해도 컴파일러도 가드도 막지 않는다. 그래서 여기 적는다.

> **이 순서 계약이 확인된 범위는 `toFanoutEnvelope` 경로다** — 그리고 `TerminalErrorPayload` 는 **그 대상이 아니다**(2026-08-29 전수 확인). 그 페이로드를 채우는 `toTerminalErrorPayload` 호출부는 **5곳이고 전부 emit 쪽**(`chat-channel.dispatcher` 1 · `execution-engine.service` 3 · `retry-turn.service` 1, DB write 0)이며, 마스킹은 `sanitizeErrorMessage` 가 아니라 **`redactTerminalError` → `deepRedactSecrets`**(표 2행)라는 **별도 egress 초크포인트**로 걸린다. `sanitizeErrorMessage` 의 실제 범위는 알림 경로다. 두 경로는 방어 강도가 다르므로 하나의 "전 경로 불변식" 으로 묶지 않는다.

---

## 3. 이 문서는 기계가 지키지 않는다

좌표계 표는 **사람이 갱신해야 한다**. `code:` frontmatter 의 파일 목록만 `spec-code-paths.test.ts` 가 존재를 확인할 뿐, 표의 값·연산자·심볼이 소스와 일치하는지는 검사하지 않는다.

~~**알려진 stale 트리거**: 정본 트래커의 미체크 항목 *"`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합"* 이 집행되면 **표 2행·표 5행의 소비처 열이 흡수돼 낡는다.** 그 항목 착수 시 이 표를 동반 갱신한다.~~

**표를 갱신한 실례 (2026-08-23, `assistant-mask-leak`)**: workflow-assistant LLM 도구가
`deepRedactSecrets` 를 **새로 겹치면서** 표 2행 소비처가 실제로 늘었다 — 그래서 그 열에
"workflow-assistant explore 응답" 을 더하고 `code:` 에 두 파일을 등재했다. 바로 아래 취소선
사례와 대비된다: 그쪽은 **호출부를 묶기만** 해서 마스커 목록이 안 바뀌었고, 이쪽은 **마스커가
새 표면에 도달**해서 바뀌었다. 그 차이가 이 표가 낡는 조건이다.

> **그 예고는 틀렸다 — 집행하고 실측하니 표는 무변경이다** (2026-08-23, `masking-gate-consolidation`).
>
> - **표 2행** 소비처는 `deepRedactSecrets` 다. 신규 래퍼(`redactStoredFieldsForResponse`)는 그걸 흡수하지 않고 `redactStoredDataForResponse` **위**에 서며, 그 함수가 여전히 `deepRedactSecrets` 를 부른다 — 호출 사슬이 한 겹 길어질 뿐 표가 지목하는 심볼은 그대로다.
> - **표 5행** 소비처는 `stripExternalOnlyFields` 이고, 호출부는 `websocket.service.ts` · `interaction.service.ts` 뿐이다(실측). 통합 대상 4개 게이트와 **접점이 없다.**
>
> 원인: 이 표는 **마스커(함수) 좌표계**인데 예고를 쓸 때 **호출부(응답 조립부) 좌표계**로 착각했다. 두 좌표계는 층이 다르므로, 호출부를 아무리 묶어도 마스커 목록은 안 바뀐다.
>
> **교훈은 남긴다**: 이 표가 낡는 진짜 조건은 *"호출부가 줄어드는 것"* 이 아니라 **"마스커가 늘거나·합쳐지거나·상한/연산자가 바뀌는 것"** 이다.

---

## Rationale

### 왜 이 문서를 신설했나 (2026-08-22)

**신설이 자동으로 옳지 않았다.** 이 저장소는 PR #1190·#1191 에서 4개 PR 을 들여 마스킹 관련 **미러를 제거**했고, JSDoc 을 되풀이하는 문서는 그 미러를 문서 레이어에서 되살린다. 그래서 먼저 **무엇이 정말 spec 에 없는지** 전수로 셌다(`f65ca193c` 기준):

| 불변식 | spec | 코드 |
|---|---|---|
| `MAX_MASK_DEPTH`(SoT 상수명) · `MAX_SANITIZE_DEPTH` · `isMaskedMarker` · **경계 연산자** | **각 0** | 22 · 29 · 46 · 8 |
| 마커 리터럴 · "깊이 상한" 산문 · 재마스킹 · `MAX_REDACT_DEPTH` | 1~20 | 다수 |

마커 *값*과 마스킹 *정책*은 이미 주인이 있었다. 없는 것은 정확히 **좌표계** — 그리고 그것은 **파일을 가로지르므로 어느 한 파일도 주인이 될 수 없다.**

**갭이 실제로 물었다**: PR #1192 착수 직전 `consistency --impl-prep` 의 `naming_collision` 이 이 좌표계 혼동을 **CRITICAL 로 판정해 착수를 차단**했다 — *"신규 테스트가 좌표계를 혼동하면 잘못된 상수·연산자·마커를 겨냥한 '정밀 고정' 테스트가 만들어진다"*. 그때 올바른 상한을 겨냥할 수 있었던 것은 checker 가 4개 파일의 JSDoc 을 대신 읽었기 때문이다. 같은 혼동의 흔적이 코드에도 있다 — `masked-markers/src/index.ts` 와 `sanitize-error-message.ts` 가 **각각** *"WS 의 `MAX_SANITIZE_DEPTH` 는 이것이 아니다"* 를 따로 적고 있다. **같은 방어 문장을 두 곳이 반복하는 것은 주인 없는 사실의 징후다.**

### 기각한 대안

- **won't-do(현상 유지)** — JSDoc 4곳이 이미 정확하고 계약 테스트도 있다. 그러나 좌표계 자체는 어느 파일에도 없었고, 위 CRITICAL 이 실제로 발생했다.
- **세 상한을 하나로 합쳐 좌표계를 없앤다** — 가장 근본적이지만 **이미 기각된 결정**이다(`masked-markers/src/index.ts`: *"별개 불변식이므로 합치지 않는다 — 공유 프리미티브를 넓히면 무관한 경로가 오염된다"*). 그 결정이 유지되는 한 좌표계는 영구적이고, 영구적인 cross-file 사실은 문서를 가질 자격이 있다.
- **EIA §R17 을 확장한다** — §R17 은 **EIA 표면의 정책**이 주제다. WS·노드 출력까지 걸치는 좌표계를 거기 넣으면 EIA 가 자기 표면 밖을 소유한다. [`node-cancellation.md`](./node-cancellation.md) 가 `execution-context.md` 와 SoT 를 나눈 선례를 따랐다.
- **좌표계를 기계가 검사하게 한다(신규 repo-guard)** — 표를 파싱해 소스와 대조하려면 TS AST 파서가 필요하다. 이 저장소는 harness 가드 설계에서 *"유한한 문제를 무한한 문제와 바꾸지 말 것"* 을 이미 결론으로 얻었다(그 유비를 여기 원용한다). 대신 §3 에 **문서가 stale 해질 수 있다는 사실과 알려진 트리거**를 적어 두는 쪽을 골랐다.
