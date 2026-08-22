---
title: egress 마스킹 좌표계를 정식 conventions 문서로 승격한다
status: in-progress
worktree: egress-masking-convention-531f5b
started: 2026-08-22
owner: planner
spec_impact:
  - spec/conventions/egress-masking.md
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
  - spec/conventions/node-output.md
---

# egress 마스킹 좌표계를 정식 conventions 문서로 승격한다

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 *"egress 마스킹 규약이 정식 `spec/conventions/**` 문서 없이 코드 JSDoc 산문에만 있다"*
항목(consistency `15_35_56` convention_compliance W1) 처분.

## 판정: **신설한다 — 단, 좁게**

이 항목은 *"신설 여부는 planner 판단"* 으로 열려 있었다. **신설이 자동으로 옳지 않다** —
이 시리즈(PR #1188~#1193)가 방금 4개 PR 을 들여 한 일이 **미러 제거**였고, JSDoc 을 되풀이하는
문서는 다섯 번째 미러가 된다.

그래서 먼저 **무엇이 정말 spec 에 없는지** 전수로 셌다 (2026-08-22, `f65ca193c`):

| 불변식 | spec | 코드 | 판정 |
| --- | --- | --- | --- |
| `MAX_MASK_DEPTH` (SoT 상수명) | **0** | 22 | 코드에만 |
| `MAX_SANITIZE_DEPTH` (WS 별개 상한) | **0** | 29 | 코드에만 |
| `isMaskedMarker` (판정 함수) | **0** | 46 | 코드에만 |
| **경계 연산자** (`>` vs `>=`) | **0** | 8 | 코드에만 |
| `MAX_REDACT_DEPTH` (backend 별칭) | 1 | 51 | spec 에도 |
| 마커 리터럴 · "깊이 상한" 산문 · 재마스킹 | 3~20 | 다수 | spec 에도 |

**갭은 실재하되 좁다.** 마커 *값*과 마스킹 *정책*은 이미 주인이 있다. 없는 것은 정확히
**세 상한이 이루는 좌표계** — 여기서 "셋" 은 ① 공유 `MAX_MASK_DEPTH` 계열(아래 표 1~3행,
backend·frontend 가 같은 수를 공유) ② WS 전용 `MAX_SANITIZE_DEPTH`(4행, 독립 선언)
③ 호출부가 값을 정하는 `stripExternalOnlyFields(_, maxDepth)`(5행)다 — — 어느 상한이 어느 비교 연산자로 어느 마커를 어느 소비처에
남기는가 — 이고, 이것은 **파일을 가로지르므로 어느 한 파일도 주인이 될 수 없다.**

### 이 갭이 실제로 물었다 (근거)

추정이 아니다. PR #1192 착수 직전 `consistency --impl-prep`(`15_35_56`)의
`naming_collision` 이 이 좌표계 혼동을 **CRITICAL 로 판정해 착수를 차단**했다 — *"신규 테스트가
좌표계를 혼동하면 잘못된 상수·연산자·마커를 겨냥한 '정밀 고정' 테스트가 만들어진다"*. 그때
내가 올바른 상한을 겨냥한 것은 **checker 가 4개 파일의 JSDoc 을 대신 읽어 줬기 때문**이다.
사람이 그 4개를 다 열지 않으면 같은 실수를 한다.

같은 혼동이 코드 주석에도 흔적을 남겼다 — `masked-markers/src/index.ts` 와
`sanitize-error-message.ts` 가 **각각** *"WS 의 `MAX_SANITIZE_DEPTH` 는 이것이 아니다"* 를
따로 적고 있다. 같은 문장을 두 곳이 방어적으로 반복하는 것은 **주인 없는 사실**의 징후다.

### 그래서 무엇을 소유하고 무엇을 소유하지 않는가

**소유한다** (다른 주인이 없다):

1. 세 상한의 좌표계 표 — 상한 · 비교 연산자 · 초과 시 결과 · 소비처
2. `stripExternalOnlyFields` 가 **자기 상한을 갖지 않는다**는 계약 — 호출부가 자매 sanitizer 의
   상한을 넘긴다
3. **마스킹은 한 번** — 그 뒤 단계가 마커를 덮지 않는다는 순서 계약
4. 왜 세 상한을 **합치지 않는가** (Rationale)

**소유하지 않는다** (주인을 가리키기만 한다):

| 대상 | 주인 | 강제 |
| --- | --- | --- |
| 마커 **값**·집합·`isMaskedMarker` 판정 | `@workflow/masked-markers` | 패키지 계약 테스트 + 미러 재선언 가드 |
| 마스킹 **정책·범위·잔여 갭** | EIA §R17 | — |
| `details[].code` 정규화 | `error-codes.md §4.2` | — |
| `outputData` echo 금지와의 관계 | `node-output.md` | — |

> **비대상 — `AuthConfig.config` 필드 마스킹** (`secret-store.md` 의 동형 콜아웃 선례를
> 따른다): 그쪽은 응답 DTO 가 저장된 자격증명을 가리는 **필드 단위 정책**이고 SoT 는
> [`1-data-model.md §2.17.2`](../../spec/1-data-model.md) 다. 본 문서가 다루는 것은
> **나가는 페이로드를 훑어 값-패턴·키-이름으로 치환하는 egress 마스킹**이며 두 메커니즘은
> 겹치지 않는다. 이름이 둘 다 "마스킹" 이라 혼동하기 쉬워 명시해 둔다.

> **본 문서는 마커 리터럴을 적지 않는다.** 좌표계 표에서도 `VALUE_MASK_MARKER` /
> `DEPTH_MASK_MARKER` 라는 **이름**으로만 부른다 — 값을 적으면 그 순간 패키지의 미러가 되고,
> 이 시리즈가 지운 그 문제가 문서 레이어에서 되살아난다. *"리터럴을 박지 말고 상수를
> import"* 라는 코드 규율을 산문에 적용한 것이다.

## 실측한 좌표계 (2026-08-22, `f65ca193c`)

| # | 상한 | 값 | 비교 | 초과 시 | 소비처 (심볼) |
| --- | --- | --- | --- | --- | --- |
| 1 | `MAX_MASK_DEPTH` (`@workflow/masked-markers`) | **10** | — | — | **SoT 상수**. 2·3 이 이 값을 참조 |
| 2 | `MAX_REDACT_DEPTH` (backend 지역 별칭) | **10** (1행 재export) | `depth >= N` | `VALUE_MASK_MARKER` | `deepRedactSecrets` (REST 응답·저장 에러·conversation thread) · `hasMaskedLeaf` (Manual 실행 재제출 거부 판정) |
| 3 | 프런트는 별칭 없이 `MAX_MASK_DEPTH` 를 직접 import | **10** (1행 그대로) | 값 검사 **먼저**, `depth >= N` 에서 하강 중단 | 스캔 범위 `0..N` | `hasMaskedMarkerLeaf` (폼 프리필·재제출 차단) |
| 4 | `MAX_SANITIZE_DEPTH` (`websocket.service.ts`, **별개 불변식**) | **10** (독립 선언) | `depth > N` | `DEPTH_MASK_MARKER` | `sanitizePayloadForWs` (WS emit) |
| 5 | `stripExternalOnlyFields(_, maxDepth)` | **호출부 지정** | `depth > maxDepth` | 서브트리 **보존**(손대지 않음) | 두 표면이 각자 자매 상한을 넘긴다 |

> **표기 주의**: "값" 열은 **깊이 값**이지 행 번호가 아니다. 네 상한이 지금 전부 `10` 이며,
> 2·3 은 1행을 참조하고 4는 **독립 선언**이라 우연히 같은 값일 뿐이다.

`5` 의 호출부 2곳(실측, 심볼 기준): `InteractionService` 의 공개 표면 조립부가
`MAX_REDACT_DEPTH` 를, `WebsocketService.toFanoutEnvelope` 가 `MAX_SANITIZE_DEPTH` 를 넘긴다.

> **2·4 는 값이 같고 의미가 다르다.** 둘 다 10 이지만 비교가 `>=` vs `>` 라 **마커가 놓이는
> 최대 깊이가 한 칸 다르다**(각각 10, 11). 값이 같다는 이유로 합치면 그 한 칸이 조용히
> 어긋난다. **4를 1행에 맞춰 재export 하지 않은 것도 의도다** — 값을 공유하면 다음 사람이
> 비교 연산자까지 같다고 읽는다.

> **⚠️ 이름이 한 글자 차이인 스캐너가 둘 있다**: backend `hasMaskedLeaf`
> (`reject-masked-resubmission.ts`, 2행) 와 frontend `hasMaskedMarkerLeaf`
> (`lib/utils/masked-markers.ts`, 3행). **같은 상한을 공유하지만 파일도 스택도 다르다** —
> 한쪽을 고치고 "양쪽 고쳤다" 고 적는 사고가 이 시리즈에서 이미 두 번 났다.

> **⚠️ 표 2·5행은 트래커 W4 가 착수되면 바뀐다** (`18_27_11` plan_coherence W3): 정본
> 트래커의 미체크 항목 *"`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합"* 이 집행되면
> 개별 호출부 심볼이 헬퍼 하나로 흡수돼 **소비처 열이 stale 해진다.** 그 항목 착수 시
> 이 표를 동반 갱신한다 — 트래커 쪽에도 같은 상호 참조를 남긴다.

> **인용은 심볼 기준이다.** 절대 라인 번호를 쓰지 않는다 — 형제 plan
> [`ws-event-types-extract.md`](./ws-event-types-extract.md) 가 *"라인 인용은 리팩터마다
> stale 화된다"* 를 실측으로 얻고 3개 문서를 심볼 기준으로 전환한 선례를 따른다.

## 마스킹은 한 번 — 그 뒤 단계는 마커를 덮지 않는다

두 층위로 지켜진다:

1. **함수 안**: `deepRedactObject` 가 자격증명 키의 값이 이미 마커면 덮지 않는다
   (`isMaskedMarker(v) ? v : VALUE_MASK_MARKER`, `sanitize-error-message.ts`).
2. **호출 순서**: `WebsocketService.toFanoutEnvelope` 은 `maskWireEnvelope`(wire 단계) →
   `stripExternalOnlyFields` → `attachRoutingContext` 순이고 **뒤에서 다시 마스킹하지
   않는다**. 다시 걸면 `attachRoutingContext` 가 붙인 `chatChannel` 의 키-마커를 값-마커로
   덮는다(그 마커는 기존 테스트가 고정하는 계약이다).

**2 는 구조가 아니라 규율이다** — 세 번째 emit 경로가 순서를 다르게 조립해도 컴파일러도
가드도 막지 않는다. 그래서 문서로 고정한다.

> **⚠️ 이 순서 계약이 확인된 범위는 `toFanoutEnvelope` 경로다** (`18_27_11` plan_coherence W2).
> *"마스킹은 한 번"* 을 전 경로의 확정 불변식으로 쓰면 **문서한 보장이 실제보다 넓어진다** —
> `TerminalErrorPayload` 를 채우는 호출부들이 전부 `sanitizeErrorMessage` 를 경유하는지는
> 형제 plan [`ws-event-types-extract.md`](./ws-event-types-extract.md) 에 **아직 미확인
> 항목(`[ ]`)** 으로 열려 있다. 신설 문서는 이 범위 한정을 그대로 적고, 그 전수 확인이
> 끝나면 caveat 를 걷는다.

## 작업

- [x] `/consistency-check --spec` — 2라운드. `18_14_45` **BLOCK: YES**(좌표계 표 "값" 열의
      `= 1` 이 **리터럴 1 로 오독**되는 CRITICAL — 좌표계 혼동을 막으려는 문서가 자기 표에서
      같은 혼동을 만들었다) → 정정 → `18_27_11` **BLOCK: NO**(WARNING 3 전부 반영)
- [x] `spec/conventions/egress-masking.md` 신설 (§Overview / 본문 / §Rationale 3섹션).
      frontmatter: `id: egress-masking` · `status: implemented` · `code:` **4파일** —
      `codebase/packages/masked-markers/src/index.ts` ·
      `codebase/backend/src/shared/utils/sanitize-error-message.ts` ·
      `codebase/backend/src/shared/utils/strip-external-only-fields.ts` ·
      `codebase/backend/src/modules/websocket/websocket.service.ts` ·
      `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` ·
      `codebase/frontend/src/lib/utils/masked-markers.ts`
      > 정의처만이 아니라 **좌표계 표가 인용하는 파일 전부**를 넣는다 — `node-cancellation.md`
      > 의 exhaustive-consumer 스타일(`18_27_11` convention_compliance W1). 표가 경고하는 두
      > 스캐너가 증거 목록 밖에 있으면 `spec-code-paths` 가 그 파일의 삭제·이동을 못 본다.
- [x] 인입 포인터 **3곳** — EIA §R17 · `node-output.md` egress 마스킹 콜아웃 ·
      **`6-websocket-protocol.md §4.1`**(`MAX_SANITIZE_DEPTH` 소비처. Rationale 이 세 표면을
      들면서 체크리스트엔 둘만 적었던 누락 — `18_14_45` convention_compliance W1)
- [x] 정본 트래커 항목 `[x]` + W4 상호 참조(착수 시 좌표계 표 동반 갱신)
- [x] 문서 가드 통과 — `spec-links` 12 · `spec-code-paths` 262(+2) · `plan-frontmatter`
      (전량은 TEST WORKFLOW unit 에서 재확인)
- [x] **자체 검증 기준 실측**: 신설 문서의 마커 리터럴 **0건**(이름으로만 5회 인용) ·
      절대 라인 인용 **0건**
- [ ] `/ai-review`

## 검증 기준

- 신설 문서가 **마커 리터럴을 0회** 포함한다(이름으로만 부른다). 포함하면 미러다.
- `code:` frontmatter 의 파일이 전부 실재하고 `spec-code-paths.test.ts` 를 통과한다.
- 좌표계 표의 모든 셀이 **실측 출처**를 가지되 **심볼 기준**이다 — 절대 라인 번호 0회.
- "값" 열에 **행 번호로 오독될 표기**(`= 1` 등)를 쓰지 않는다. `18_14_45` 가 이 draft 에서
  그 오독을 CRITICAL 로 잡았다 — 좌표계 혼동을 막으려는 문서가 자기 표에서 같은 혼동을
  만들었다.

## Rationale

**기각한 대안**:

- *won't-do — 지금 상태 유지* — JSDoc 4곳이 이미 정확하고 계약 테스트도 있다. 그러나
  **좌표계 자체는 어느 파일에도 없다**. checker 가 CRITICAL 을 낸 실제 사건이 있었고, 두
  파일이 같은 방어 문장을 각각 적고 있는 것이 주인 부재의 징후다.
- *세 상한을 하나로 합치고 문서를 불필요하게 만든다* — 가장 근본적이지만 **이미 기각된
  결정**이다(`masked-markers/src/index.ts` JSDoc: *"별개 불변식이므로 합치지 않는다 — 공유
  프리미티브를 넓히면 무관한 경로가 오염된다"*). 그 결정이 유지되는 한 좌표계는 영구적이고,
  영구적인 cross-file 사실은 문서를 가질 자격이 있다.
- *EIA §R17 을 확장해 거기에 적는다* — §R17 은 **EIA 표면의 정책**이 주제다. WS
  (`6-websocket-protocol.md`)와 노드 출력(`node-output.md`)까지 걸치는 좌표계를 거기 넣으면
  EIA 가 자기 표면 밖을 소유하게 된다. `node-cancellation.md` 가 `execution-context.md` 와
  SoT 를 나눈 선례를 따른다.
- *좌표계를 기계가 검사하게 한다(신규 repo-guard)* — 매력적이지만 **이 PR 의 범위 밖**이다.
  표를 파싱해 소스와 대조하려면 TS AST 파서가 필요하고, 이 저장소는 *"유한한 문제를 무한한
  문제와 바꾸지 말 것"* 을 이미 등재했다. 문서가 stale 해지는 실패 모드는 남으며, 그 사실을
  문서에 적는다.
