---
title: 규약 세 건을 명문화한다 — details 객체의 code · Update 접두 범위 · setupChannel 멱등의 뜻
status: in-progress
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

## (a) `details` 객체 형태에 `code` 를 빠뜨릴 수 있게 돼 있다

### 실측 — 규약은 이미 두 형태를 다 허용한다

`2-api-convention.md §5.3` 이 명시한다:

| 형태 | 쓰임 |
|---|---|
| 배열 `details: [{ field, message, code }]` | 여러 항목이 각각 실패 (ValidationPipe 다중 필드) |
| **객체** `details: { field, code, … }` | **단일 도메인 예외가 사유 하나를 붙일 때** |

즉 **서비스 가드가 객체를 쓰는 것 자체는 규약대로다.** 직전 턴이 이 축을 *"파이프는 배열,
가드는 객체 — 갭"* 으로 적었는데 **그 절반은 틀렸다**: 형태는 갭이 아니다.

**진짜 갭은 `code` 다.** 객체 행의 shape 이 `{ field, code, … }` 인데, 서비스 층에서
`details: { field … }` 를 던지는 **11자리 중 9자리가 `code` 를 안 싣는다**(실측):

| 파일 | 자리 | `code` |
|---|---|---|
| `triggers.service.ts` | `type`(schedule 거부) · `botTokenRef` · `inboundSigningRef` · `inboundSigning` · `inboundSigningPlaintext` ×4 · `authConfigId` | **없음** (9곳) |
| `workspaces.service.ts` | `name` · `settings` | **없음** (2곳) |
| `triggers.service.ts:1627` | `endpoint_path` | **`TRIGGER_ENDPOINT_PATH_CONFLICT`** ✅ |

마지막 하나가 **규약이 그 표에서 직접 인용하는 선례**이고, 컨트롤러 문서도
*`details.code="TRIGGER_ENDPOINT_PATH_CONFLICT"`* 로 적는다. 즉 **객체에 `code` 를 싣는 것은
이 저장소의 확립된 관례**이고 나머지 11곳이 거기서 벗어난 것이다.

### 왜 드리프트했나

표의 `{ field, code, … }` 는 **shape 예시**로 읽히지 *"code 는 필수"* 라고 말하지 않는다.
그래서 새 가드를 쓸 때마다 `{ field }` 만 넣고 지나갔다.

## (b) `Update` 접두 — 규칙의 **범위**를 안 적어서 오독이 났다

### 실측

- `Update*Dto` **18개, 전부 접두**(예외 0). 그리고 **전부 컨트롤러 `@Body()` 로 쓰이는
  top-level 요청 DTO** 다 — `UpdateModelConfigDto`(`model-config.controller.ts:136`) ·
  `UpdateAuthConfigDto`(`auth-configs.controller.ts:126`) · `UpdateTriggerDto`
  (`triggers.controller.ts:134`) 로 확인했다. 이름에 `Config` 가 들어가도 **엔티티의 요청
  바디**다.
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
telegram 은 **매 호출 새 `secret_token` 을 발급**한다(`telegram.adapter.ts:73`). 멱등한 것은
**레지스트리 등록 안전성**(같은 config 로 다시 불러도 깨지지 않는다)이지 **시크릿 값 불변**이
아니다. 이 체인에서 그 혼동이 실제로 CRITICAL 을 만들었다(#1313).

## 결정

- **D-1** — `2-api-convention.md §5.3` 객체 행에 **`code` 는 생략하지 않는다**를 명문화한다.
  필드 검증 사유의 기본값은 파이프와 같은 **`INVALID_FIELD`**, 도메인 특화 사유가 있으면 그
  코드(선례 `TRIGGER_ENDPOINT_PATH_CONFLICT`). **형태(객체/배열)는 지금 그대로 둔다** — 규약이
  이미 둘 다 허용하고, 배열로 바꾸는 것은 11개 엔드포인트의 **wire 계약 변경**이라 이 턴의
  범위를 넘는다. `code` 추가는 **키 추가라 비파괴적**이다.
- **D-2** — `swagger.md §1` 에 명명 규칙을 **범위와 함께** 적는다: top-level 부분 갱신 요청
  DTO 는 `Update<Entity>Dto` **접두**, nested 필드의 갱신용 변형은 그 필드의 로컬 패턴
  (`<Domain><Role>Dto`)을 따른다, `Patch` 접두는 쓰지 않는다.
- **D-3** — `chat-channel-adapter.md §1.1` 의 멱등 셀에 *"등록 안전성이지 시크릿 값 불변이
  아니다"* 각주.
- **D-4** — `15-chat-channel.md §5.4.1` 의 3축 표에서 `details[].code` 칸을 **계약값**
  (양쪽 `INVALID_FIELD`)으로 적고, **배선은 뒤따르는 developer PR 이 한다**는 것을 한 줄로
  밝힌다. 그 PR 이 머지되기 전까지 이 칸은 *"계약이지 현재 관측값이 아니다"* 라는 뜻이다.

### 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| **`details` 를 전부 배열로 통일** | 규약이 객체를 *"단일 도메인 예외"* 용으로 **명시 허용**한다. 통일하면 11개 엔드포인트의 wire 가 바뀌어 `details.field` 를 읽던 소비자가 깨진다 — 이득(형태 일관)보다 대가가 크다 |
| **`ChatChannelUpdateConfigDto` 를 `UpdateChatChannelConfigDto` 로 개명** | 18/18 접두가 **top-level 요청 바디 집합**의 성질이라는 것이 실측이다. nested 변형을 그 집합에 끼워 넣으면 형제(`ChatChannelUiMappingDto` 등)와 어긋난다 |
| **(a) 를 chat-channel 5자리만 고친다** | 같은 결함 클래스가 11자리에 있고 **키 추가라 비파괴적**이다. 한 자리만 고치면 다음 사람이 나머지를 다시 발견한다 |

## 변경안

| # | 자리 | 조치 |
|---|---|---|
| **A1** | `2-api-convention.md §5.3` 객체 행 + 그 아래 문단 | `code` 생략 금지 + 기본값 `INVALID_FIELD` 명문화 |
| **B1** | `conventions/swagger.md §1` | 명명 규칙을 **범위와 함께** 신설 |
| **C1** | `conventions/chat-channel-adapter.md §1.1` | 멱등 셀 각주 |
| **D1** | `15-chat-channel.md §5.4.1` 3축 표 | `details[].code` 를 계약값으로 + 배선 PR 링크 |

## 이 턴에 하지 않는 것

- **동시 PATCH lost update** — 사용자에게 트레이드오프를 보고했고 권장안은 (1) 스냅샷 →
  `secrets.exists()` (2) 일반 lost update 는 낙관적 버전. **코드 사안**이라 developer 몫.
- **`details` 형태 통일** — 위 기각.

## 체크리스트

- [ ] `/consistency-check --spec` BLOCK: NO
- [ ] 변경안 A1 · B1 · C1 · D1 적용
- [ ] docs 가드
- [ ] 트래커: `:2130`·`:2235` **중복 등재 병합** + 세 항목 종결 + `details[].code` 항목을
      "규약 확정 · 배선 대기" 로 갱신
- [ ] `plan/complete/` 이동
