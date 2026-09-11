---
title: 규약 세 건을 명문화한다 — details 항목의 code · Update 접두 범위 · setupChannel 멱등의 뜻
status: complete
owner: project-planner
worktree: .claude/worktrees/spec-chat-channel-conventions-7e21ac
started: 2026-09-11
spec_impact:
  - spec/5-system/2-api-convention.md
  - spec/5-system/15-chat-channel.md
  - spec/conventions/swagger.md
  - spec/conventions/chat-channel-adapter.md
---

## 왜 이 턴인가

`#1314`(구현)·`#1315`(SoT 반영) 이후 트래커에 남은 **planner 몫 세 건**을 닫는다. 셋 다
*"관례는 있는데 명문 규칙이 없어 드리프트가 났다"* 는 같은 형태다.

**이 PR 은 뒤따르는 developer PR 과 한 쌍이다** — (a) 는 계약을 세우고 그 배선은 다음 PR 이
한다. 순서가 뒤집히면 구현이 spec 없이 앞서므로 이 PR 이 먼저 머지돼야 한다.

> **결정 라벨은 `DEC-*` 네임스페이스를 쓰고, `spec/` 본문에는 넣지 않는다 — 이 plan 내부
> 추적 전용이다.** 두 번 갈았다. 초판의 `D-1`/`D-2` 는 대상 파일 `15-chat-channel.md` 안에서
> 이미 **R-CC-21 의 하위 결정**(필드 미수신 / 경로 비밀 미사용)이고 `codebase/**` 10여 곳이
> `[R-CC-21 / D-1]` 로 인용한다(`--spec` `09_03_56` CRITICAL 2). 2판의 `CV-*` 도 틀렸다 —
> 이 저장소는 `-CV-` 를 **`<PREFIX>-CV-<NN>` 컨벤션 요구사항 ID** 로 이미 쓰고 있고
> (`CCH-CV-01`~`05` · `ED-CV-01`~`06`), 그 중 `CCH-CV-04` 는 **내가 편집하는 바로 그 파일**에
> 있다(`--spec` `09_29_33` WARNING 3). `DEC-` 는 `spec/`·`plan/in-progress/`·`.claude/`
> 전역 **0건**임을 확인했다.
>
> **같은 실수를 두 번 한 이유는 같다** — 첫 라벨을 고를 때도, 두 번째를 고를 때도 **기존
> 라벨 계열을 전수 열거하지 않고** 이름만 바꿨다. 대안 토큰은 grep 으로 먼저 비어 있음을
> 확인해야 한다.

## (a) `details` 항목에 `code` 를 빠뜨릴 수 있게 돼 있다

### 층 판정을 먼저 한다 — `details:` 는 세 층에 걸쳐 있다

초판은 `grep "details: { field"` 한 번으로 후보를 모아 **감사 로그를 규약 위반으로 오분류**했다
(`--spec` `09_03_56` CRITICAL 1). `codebase/backend/src` 의 `details:` 출현 **60곳**을 앞 12줄의
호출 주어로 전수 분류했다(`*.spec.ts` 제외, 실측 기준 커밋 `f947b49f4`):

| 층 | 주어 | 자리 | §5.3 적용 |
|---|---|---|---|
| **HTTP 에러 봉투** | `new *Exception({ … })` | **22** | ✅ 대상 |
| 감사 로그 | `auditLogsService.record(…)` · `recordAudit(…)` | 22 | ❌ `audit-actions.md` 소관 — 자유형 `details`, 정상 완료 경로 |
| 노드 실행 error payload | `output.error.details` (return, throw 아님) | 16 | ❌ 봉투가 아니라 노드 출력. 사유는 형제 `error.code` 가 싣는다 |

`workspaces.service.ts` 의 `{ field: 'name' }` · `{ field: 'settings' }` 두 자리는 **감사 로그**다.
초판 표가 그 둘을 위반으로 적었는데, `workspaces.service.ts` 의 **에러 봉투 `details` 는 0곳**이다.

### 에러 봉투 22곳의 실제 형태

| 형태 | 자리 | `field` | `code` |
|---|---|---|---|
| 배열 `[{ field, message }]` | `password.util.ts` 2곳 | ✅ | **없음** |
| 객체 `{ field }` | `triggers.service.ts` **13곳** (`type` · `botTokenRef` · `inboundSigningRef` · `inboundSigning` · `botToken` · `inboundSigningPlaintext` ×5 · `chatChannel` · `provider` · `authConfigId`) | ✅ | **없음** |
| 객체 `{ field, code }` | `triggers.service.ts` `rethrowEndpointPathConflict` 1곳 | ✅ | ✅ `TRIGGER_ENDPOINT_PATH_CONFLICT` |
| 객체 (`field` 없음) | `triggers.service.ts` `{ reason }` 2곳 · `workflows.service.ts` `{ errors }` 3곳 · `{ offenders }` 1곳 | ❌ | 없음 |

**`field` 를 싣는 자리는 16곳이고 그중 `code` 가 있는 것은 1곳** — 갭은 **15곳**이다.
초판의 *"11자리 중 9자리"* 는 층을 섞은 grep 의 산물이었다.

### 규약은 형태를 이미 둘 다 허용한다 — 갭은 `code` 다

`2-api-convention.md §5.3` 이 명시한다: 배열 `[{ field, message, code }]` 는 다중 필드용,
객체 `{ field, code, … }` 는 *"단일 도메인 예외가 사유 하나를 붙일 때"*. 즉 **서비스 가드가
객체를 쓰는 것 자체는 규약대로다.** 직전 턴이 이 축을 *"파이프는 배열, 가드는 객체 — 갭"* 으로
적었는데 **그 절반은 틀렸다**: 형태는 갭이 아니다.

그리고 §5.3 은 이미 택일 기준을 갖고 있다 — 사유가 **어느 필드에 붙는지가 정보의 일부**면
`details[].code`, **엔드포인트의 결과 그 자체**면 top-level `code` 교체, 그리고
**둘을 겹쳐 쓰지 않는다.** 갭은 기준의 부재가 아니라 **객체 행의 shape 예시가 `code` 를
"필수" 라고 말하지 않는다**는 것이다.

### 15곳이 실제로 잃는 것

13곳 전부 top-level 은 400 기본값 `VALIDATION_ERROR` 이고 `details` 는 `{ field }` 뿐이다.
**사유가 기계가 읽을 수 있는 자리에 전혀 없다** — `message` 뿐인데 §5.3 자신이 `message` 를
*"사람이 읽을 짧은 설명"* 으로 규정한다. 그래서 소비자는 이 셋을 구분할 수 없다:

- `botTokenRef` 는 **외부 입력이 금지된 내부 필드**다
- `botToken` 은 **PATCH 로 바꿀 수 없다**(rotate API 사용)
- `chatChannel` 은 **최초 설정이 생성 POST 한정**이다

### 왜 드리프트했나

표의 `{ field, code, … }` 는 **shape 예시**로 읽히지 *"code 는 필수"* 라고 말하지 않는다.
그래서 새 가드를 쓸 때마다 `{ field }` 만 넣고 지나갔다.

## (b) `Update` 접두 — 규칙의 **범위**를 안 적어서 오독이 났다

### 실측

- `Update*Dto` **18개, 전부 접두**(예외 0). 그리고 **전부 컨트롤러 `@Body()` 로 쓰이는
  top-level 요청 DTO** 다 — `UpdateModelConfigDto`(`model-config.controller.ts`) ·
  `UpdateAuthConfigDto`(`auth-configs.controller.ts`) · `UpdateTriggerDto`
  (`triggers.controller.ts`) 로 확인했다. 이름에 `Config` 가 들어가도 **엔티티의 요청 바디**다.
- nested 필드 DTO 는 다른 축을 쓴다 — `ChatChannelUiMappingDto` · `ChatChannelBotIdentityDto`
  · `ChatChannelConfigDto` 처럼 **`<Domain><Role>Dto`** 다.
- `Patch` 접두 클래스는 **0건**.

### 판정

*"18/18 이 접두니 `ChatChannelUpdateConfigDto` 도 접두여야 한다"* 는 **범위를 넘은 일반화**다.
그 18개는 전부 **top-level 요청 바디**이고, `ChatChannelUpdateConfigDto` 는 **nested 필드의
갱신용 변형**이라 애초에 다른 집합이다. 규칙을 쓸 때 **어느 집합에 거는지**를 함께 적지 않으면
같은 오독이 반복된다.

## (c) `setupChannel` "멱등 = yes" 가 무엇의 멱등인지 안 적혀 있다

`chat-channel-adapter.md §1.1` 표가 `setupChannel | 멱등 = yes` 라고만 적는다. 그런데
telegram 은 **매 호출 새 `secret_token` 을 발급**한다(`telegram.adapter.ts`). 멱등한 것은
**레지스트리 등록 안전성**(같은 config 로 다시 불러도 깨지지 않는다)이지 **시크릿 값 불변**이
아니다. 이 체인에서 그 혼동이 실제로 CRITICAL 을 만들었다(`#1313`).

## 결정

- **DEC-1** — `2-api-convention.md §5.3` 에 **`details` 항목이 `field` 를 실으면 `code` 도
  싣는다** 를 명문화한다. **형태(배열/객체) 무관**이다 — 갭이 양쪽에 다 있다(배열 2곳, 객체 13곳).
  기본값은 `INVALID_FIELD` — **`3-error-handling.md §2.1` 의 generic 코드로 이미 카탈로그에
  등재돼 있어 신규 등재가 필요 없다.** 도메인 특화 사유가 있으면 그 코드(선례
  `TRIGGER_ENDPOINT_PATH_CONFLICT`).
  - **`field` 가 없는 진단 payload 6곳은 범위 밖이다.** `{ errors }` · `{ offenders }` ·
    `{ reason }` 의 사유는 이미 top-level 특화 코드(`GRAPH_VALIDATION_FAILED` 등)에 있고,
    §5.3 의 택일 기준표가 그것을 *"사유가 엔드포인트의 결과 그 자체"* 갈래로 **이미 처리한다.**
    여기에 `details.code` 를 강제하면 §5.3 자신의 ***"둘을 겹쳐 쓰지 않는다"*** 를 위반한다.
  - **감사 로그 `details`(22곳) 는 §5.3 적용 범위 밖이다** — 그 형식의 SoT 는
    `1-auth.md §4.1`(액션별 `details` 예시가 실제로 나열되는 곳) · `data-flow/1-audit.md §1.1`
    (적재 파이프라인)이고, 에러 봉투와 달리 자유형이다. 규칙 문면에 이 경계를 한 줄로 적는다.
    - **`conventions/audit-actions.md` 는 인용하지 않는다** — 그 문서가 `## Overview` 에서
      *"본 문서가 유일하게 소유하는 것: ① `<resource>.<verb>` 구조 규칙, ② verb 시제 3분류,
      ③ 도메인별 분류 레지스트리"* 로 **스스로 범위를 한정**하고 `details` 페이로드 형태에
      대한 절을 두지 않는다. 2판이 그것을 SoT 로 적었고 그 인용이 `§5.3` 본문에 박제될
      예정이었다(`--spec` `09_29_33` WARNING 1).
  - **형태(객체/배열)는 지금 그대로 둔다** — 규약이 이미 둘 다 허용하고, 배열로 바꾸는 것은
    14개 발행 지점의 **wire 계약 변경**이다. `code` 추가는 **키 추가라 비파괴적**이다.
  - **강제 메커니즘은 없다 — 그것을 규칙 옆에 적는다.** `GlobalExceptionFilter` 는 `details`
    를 그대로 통과시키고 OpenAPI 선언도 `additionalProperties: true` 라, 이 규칙을 무는 정적·
    런타임 가드가 **존재하지 않는다.** 이 저장소는 같은 형태의 실패를 이미 기록해 뒀다 —
    `swagger.md §3 Rationale` 의 *"37% 미준수는 규칙이 안 지켜진다가 아니라 그건 규칙이
    아니었다는 뜻"*. 따라서 `§5.3` 본문에 **신규 발행 지점부터 적용 · 기존 자리는 트래커
    항목으로 배선 예정**이라는 상태를 함께 적는다(`§5.4` 의 「검증 층」 소절 관례와 같은 축).
  - **이 결정이 사지 않는 것**: `INVALID_FIELD` 하나로는 위 세 사유(내부 필드 금지 / PATCH
    불변 / 최초 설정 한정)가 **여전히 구분되지 않는다.** 구분이 필요하면 도메인 특화 세부 코드를
    신설해야 하고 그것은 **카탈로그 등재를 요구**하므로 이 턴의 범위가 아니다 — 후속 항목으로
    등재한다. DEC-1 이 사는 것은 *"소비자가 `details.code` 를 항상 읽을 수 있다"* 와
    *"도메인 코드를 얹을 자리가 생긴다"* 까지다.
- **DEC-2** — `swagger.md` 에 명명 규칙을 **범위와 함께** 적는다: top-level 부분 갱신 요청
  DTO 는 `Update<Entity>Dto` **접두**, nested 필드의 갱신용 변형은 그 필드의 로컬 패턴
  (`<Domain><Role>Dto`)을 따른다, `Patch` 접두는 쓰지 않는다. 기존 `§1-1`~`§1-6` 관행에 맞춰
  **번호 소절 `§1-7`** 로 넣고 `## Rationale` 에 대응 절을 신설한다.
- **DEC-3** — `chat-channel-adapter.md §1.1` 의 멱등 셀에 *"등록 안전성이지 시크릿 값 불변이
  아니다"* 각주.
- **DEC-4** — `15-chat-channel.md` 의 `details[].code` 서술 **3곳 전부**를 **실측과 계약을
  병기**하는 형태로 고친다. 초판은 §5.4.1 표 한 칸만 겨눠, **어제(`f947b49f4`) 확정한**
  §5.4.1.2 의 *"`details[].code` 는 두 항목 모두 서비스 가드 갈래라 싣지 않는다"* 와 DEC-1 이
  정면 충돌하게 뒀다(`--spec` `09_03_56` CRITICAL 3).
  - **그 문장들은 틀리지 않았다** — 지금의 관측값이고 `#1314` 단위 테스트가 실측했다.
    그래서 **지우지 않는다.** 시점을 붙여 *"현재 관측값"* 으로 남기고 **계약값을 나란히**
    적는다. 실측 셀을 계약값으로 **교체**하면 이웃 셀과 인식론적 지위가 달라진다
    (`--spec` `09_03_56` INFO 3).

### 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| **`details` 를 전부 배열로 통일** | 규약이 객체를 *"단일 도메인 예외"* 용으로 **명시 허용**한다. 통일하면 14개 발행 지점의 wire 가 바뀌어 `details.field` 를 읽던 소비자가 깨진다 — 이득(형태 일관)보다 대가가 크다 |
| **`code` 를 `details` 객체 **전부**에 강제** | `field` 없는 6곳은 사유가 이미 top-level `code` 에 있다. 강제하면 §5.3 의 *"둘을 겹쳐 쓰지 않는다"* 를 규약 스스로 위반한다 |
| **`ChatChannelUpdateConfigDto` 를 `UpdateChatChannelConfigDto` 로 개명** | 18/18 접두가 **top-level 요청 바디 집합**의 성질이라는 것이 실측이다. nested 변형을 그 집합에 끼워 넣으면 형제(`ChatChannelUiMappingDto` 등)와 어긋난다 |
| **(a) 를 chat-channel 5자리만 고친다** | 같은 결함 클래스가 15자리에 있고 **키 추가라 비파괴적**이다. 한 자리만 고치면 다음 사람이 나머지를 다시 발견한다 |
| **§5.4.1.2 의 "싣지 않는다" 문장을 삭제·교체** | 그 문장은 **실측이고 참이다.** 지우면 `#1314` 가 측정한 두-갈래 사실이 SoT 에서 사라진다 — 병기가 맞다 |

## 변경안

| # | 결정 | 자리 | 조치 |
|---|---|---|---|
| **1** | DEC-1 | `2-api-convention.md §5.3` 객체/배열 형태 표 + 그 아래 문단 | `field` 를 실으면 `code` 도 싣는다 + 기본값 `INVALID_FIELD` + **감사 로그·노드 payload 는 범위 밖** 경계선 |
| **2** | DEC-2 | `conventions/swagger.md` **신규 `§1-7`** + `## Rationale` 대응 절 | 명명 규칙을 **범위와 함께** 신설 + **반례로 `ChatChannelUpdateConfigDto` 를 직접 인용**(nested 계열이라 접두 미적용 — 다음 편집자가 같은 조사를 반복하지 않게) |
| **3** | DEC-2 | `conventions/swagger.md §5-4` 체크리스트 | *"요청 DTO 명명 — `Update` 접두 범위 확인"* 한 줄 |
| **4** | DEC-3 | `conventions/chat-channel-adapter.md §1.1` | 멱등 셀 각주 + `15-chat-channel.md §5.4.1.1` telegram 행 **cross-link**(같은 사실을 두 문서가 독립 서술하면 한쪽만 갱신되는 drift 가 재발한다) |
| **5a** | DEC-4 | `15-chat-channel.md §5.4.1` — **「토큰 변경 (rotation)」 행**의 `details.field` 3축 셀 | 실측 문구 유지 + 계약값 병기 |
| **5b** | DEC-4 | `15-chat-channel.md §5.4.1.1` 회전 행 | 같음 (`code` **없음** → 실측/계약 병기) |
| **5c** | DEC-4 | `15-chat-channel.md §5.4.1.2` 닫는 문장 | *"현재는 싣지 않는다(실측)"* + 계약값 + 배선 PR 고지 |

### 미러 staleness 판정 — `2-trigger-list.md` 는 편집하지 않는다

`--spec` `09_03_56` WARNING 1 이 이 문서를 지목했다. **주어 단위로 전수 확인**했다
(`details[].code` · `INVALID_FIELD` · `details.code` 로 `spec/` 전역 grep 후 각 문장의 주어 확인):

| 자리 | 무엇을 서술하나 | DEC-1 이후 |
|---|---|---|
| §3 PATCH 註 (`chatChannel` 차단) | **`details.field` 형식**(중첩 vs flat) | 참 — 주어가 `field` 다 |
| §3 PATCH 註 (`inboundSigningPlaintext`) | **`details.field` 형식** | 참 — 같음 |
| `R-12` | `details.field='provider'` | 참 |
| frontmatter `code:` 주석 | `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT` | 참 — 이미 `code` 를 싣는 선례 자리 |

**네 자리 모두 `details.code` 축을 주어로 삼지 않으므로 DEC-1 이 거짓으로 만드는 문장이 없다.**
따라서 `spec_impact` 에 넣지 않는다 — 편집하지 않는 파일을 거기 적으면 그 목록이 거짓이 된다.
(`--spec` 이 제시한 두 선택지 중 *"staleness 점검 항목 명시"* 를 택했다.)

### 이 PR 이 깨뜨리는 줄-번호 인용 — 전수 실측

`--spec` `09_29_33` WARNING 2 가 `swagger.md:315` 한 곳을 지목했다. **클래스로 보고 전수
확인했다** — 내가 편집하는 4개 파일을 줄 번호로 인용하는 자리 **15곳**을, 각 삽입점
(`2-api-convention.md` 216 · `swagger.md` 199 · `chat-channel-adapter.md` 127 ·
`15-chat-channel.md` 375)과 대조하고 인용이 주장하는 키워드가 그 줄에 실제로 있는지까지 봤다:

| 판정 | 자리 | 처분 |
|---|---|---|
| **내 편집이 밀린다 (7)** | `chat-channel-adapter.md:145`·`:149`(2건)·`:354`·`:359` · `2-api-convention.md:272` · **`swagger.md:315`** | 아래 |
| **이미 깨져 있었다 (4)** | `15-chat-channel.md:377`·`:390`(둘 다 **빈 줄**) · `chat-channel-adapter.md:159`·`:367`(키워드 불일치) | 내 PR 과 무관 — 함께 등재 |
| 영향 없음 (4) | `2-api-convention.md:205` · `15-chat-channel.md:200`·`:201`·`:373` | 무조치 |

처분:

- **`swagger.md:315` → `chat-channel-config.dto.ts`** 는 `codebase/**` 라 planner 권한 밖이다.
  **뒤따르는 developer PR 의 필수 항목**으로 등재한다 — 그 PR 은 이 PR 직후에 오므로 창이 짧다.
  트래커의 기존 `Update` 접두 항목에 **"부수"로 딸려 있어** 그 항목을 종결하면 함께 사라진다
  (WARNING 2 의 핵심 지적) → **별 항목으로 갈라 등재**한다.
- **내가 편집 중인 트래커(`spec-draft-nullable-notation-followups.md`) 안의 3건**은 이 PR 에서
  **앵커 문구로 바꾼다**. 숫자를 다시 재면 폭탄을 재장전하는 것이라 규율(`내가 편집하는 파일을
  줄 번호로 인용하지 마라`)이 앵커를 지시한다.
- **다른 세션이 진행 중인 트래커 3개**(`eia-terminal-payload.md` ·
  `spec-sync-external-interaction-api-gaps.md` · `spec-draft-eia-notification-payload-contract.md`
  · `spec-sync-auth-gaps.md`)는 **건드리지 않는다** — 병행 작업과 충돌한다. 위 표를 트래커에
  등재해 각 소유자가 앵커로 바꾸게 한다.

> **이것은 내 규율의 거울상이다.** *"내가 편집하는 파일을 줄 번호로 인용하지 마라"* 는 이미
> 알고 있었는데, **내가 편집하는 파일을 남이 줄 번호로 인용하고 있으면 내 편집이 그것을
> 깨뜨린다**는 반대 방향은 이번에 처음 쟀다. 그리고 그 방향에서 **4건은 이미 깨져 있었다** —
> 즉 이 저장소에서 spec 을 향한 줄-번호 인용은 이미 신뢰할 수 없다.

## 이 턴에 하지 않는 것

- **동시 PATCH lost update** — 사용자에게 트레이드오프를 보고했고 권장안은 (1) 스냅샷 →
  `SecretResolver.exists()` (2) 일반 lost update 는 낙관적 버전. **코드 사안**이라 developer 몫.
- **`details` 형태 통일** — 위 기각.
- **도메인 특화 세부 코드 신설** — DEC-1 이 남기는 갭(`INVALID_FIELD` 로는 세 사유가 구분되지
  않는다). 카탈로그 등재를 요구하므로 별 결정. 트래커에 등재한다.

### 정지 규칙 (`09_29_33` 결과를 보기 **전**에 선언)

- `BLOCK: NO` → 변경안 7자리 적용 → 트래커 → `complete/` → PR. 추가 라운드 없음.
- `BLOCK: YES` → **(a) 내 실측의 사실 오류** 또는 **(b) 머지된 spec 과의 실제 모순**만 고쳐
  재실행한다. 문면·배치에 관한 WARNING/INFO 는 라운드를 늘리지 않고 `## Rationale` 노트로
  반영한다(planner 워크플로 3단계).
- **같은 축으로 세 번째 `BLOCK` 이 오면** 문면이 아니라 **내 전제가 틀린 것**이다 — 고치지
  말고 멈추고 사용자에게 보고한다.

## 체크리스트

- [x] `/consistency-check --spec` **BLOCK: NO** — `review/consistency/2026/09/11/09_29_33`
      (5 checker 전원 CRITICAL 0). 2판(`09_03_56`)의 CRITICAL 3건 해소를 checker 가 실측 재확인.
      WARNING 3 · INFO 4 는 **전부 반영**했다.
- [x] 변경안 1 · 2 · 3 · 4 · 5a · 5b · 5c 적용 (spec 4파일)
- [x] docs 가드 — `spec-link-integrity.test.ts` 19/19 · `plan-frontmatter.test.ts` 149/149.
      **GREEN 을 증거로 쓰지 않았다**: 신규 앵커 3개(`swagger.md §1-7` ·
      `chat-channel-adapter.md §1.1.1` · `15-chat-channel` → `2-api-convention §5.3`)를 각각
      가짜 슬러그로 바꿔 **3/3 RED** 를 확인하고 `cp` 로 원복했다.
- [x] 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`:
  - [x] `setupChannel` 멱등 각주 항목 **중복 등재 병합** — 두 줄로 존재했고, 앞 항목을 병합
        묘비로 바꿔 뒤 항목에서 종결했다
  - [x] 세 항목(`code` 규약 · `Update` 접두 · 멱등 각주) 종결 + 실측 정정(11 → **에러 봉투
        `field` 자리 16곳 중 갭 15곳**, 감사 로그 22곳·노드 payload 16곳은 범위 밖)
  - [x] 신규 등재 3건: 도메인 특화 세부 코드 신설(카탈로그 등재 필요) · **줄-번호 인용 15곳
        전수 표**(앵커로 전환) · `swagger.md:315` 인용 stale
  - [x] `Update` 접두 항목의 **"부수"를 별 항목으로 분리** — 항목 종결과 함께 사라지지 않게
  - [x] 이 트래커 자신의 인용 3건을 앵커 문구로 전환. **치환 문구가 참인지 확인**했다 —
        `git show HEAD:` 원본에서 원래 줄이 속한 절 경계를 재측정(`:149-151` → §1.2 `EiaEvent`
        종결 3종 · `:354,359` → §2.4 `SetupResult`)
  - [ ] `details[].code` **배선 15곳**(developer) — 규약만 확정, 배선은 후속 PR. 항목 존속
- [x] `plan/complete/` 이동
