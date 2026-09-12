---
worktree: trigger-uuid-and-guide-codes
started: 2026-09-12
owner: developer
---

# `rotateBotToken` 의 비-UUID 마스킹 + 가이드가 적은 없는 이름 두 종

`spec-draft-nullable-notation-followups.md` 트래커의 연속 두 항목을 한 배치로 닫는다. 둘은 다른
축처럼 보이지만 같은 성질이다 — **선언과 실제가 어긋난 자리가 조용하다.** 한쪽은 파이프가 없어
클라이언트 입력 오류가 서버 오류로 보이고, 한쪽은 문서가 코드베이스에 없는 식별자를 적는다.

## A. `rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 가 없다

### 실측 — 이 저장소에서 유일한 자리다

`*.controller.ts` 전수 스캔 (`@Param('<name>'…)` AST 아닌 정규식, 145건):

| 축 | 수 |
|---|---|
| `@Param` 선언 전체 | 145 |
| 그중 **id-형** (`id` 또는 `…Id`) | 136 |
| id-형 중 `ParseUUIDPipe` **없음** | **1** — `triggers.controller.ts` `rotateBotToken` |
| id-형이 아닌 이름 | `provider`×3 · `installToken`×2 · `endpointPath`×2 · `token` · `type` (전부 정당한 비-UUID) |

즉 관례는 **135/136** 로 이미 보편이고 예외 집합이 비어 있다. 같은 컨트롤러의 나머지 6개
엔드포인트는 전부 `@Param('id', ParseUUIDPipe)` 다.

### 트래커가 요구한 선실측 — "비-UUID 가 들어오면 400 인가 DB 실패인가"

**500 INTERNAL_ERROR 로 마스킹된다.** 근거 사슬:

1. `Trigger.id` 는 `@PrimaryGeneratedColumn('uuid')` → Postgres `uuid` 컬럼.
2. `rotateBotToken` → `TriggersService.findById` → `findOne({ where: { id, workspaceId } })`.
   파싱 불가 값이면 드라이버가 `QueryFailedError`(SQLSTATE **22P02**)를 던진다.
3. `GlobalExceptionFilter` 는 `HttpException` · http-error-like · `isPostgresUniqueViolation`(23505)
   세 갈래만 분기한다. `QueryFailedError`(22P02)는 **어디에도 안 걸려** 기본값
   `500 / INTERNAL_ERROR` 로 떨어진다.
4. 저장소가 이미 그렇게 적어 두었다 — `common/utils/uuid.ts` 와
   `common/utils/workspace-context.util.ts` 의 docstring 이 같은 문장을 갖고 있고,
   후자는 그래서 `X-Workspace-Id` 를 **조기 거부**한다고 명시한다.

> **이 항목의 원래 리뷰 메모는 "404 로 수렴한다" 를 암묵 전제했다.** 그 전제가 틀렸다는 것이
> 위 사슬이다 — 404 면 고칠 이유가 약하지만 500 이면 **클라이언트 입력 오류가 서버 장애로
> 보인다**. 고치는 근거가 바뀌었으므로 적어 둔다.

### `--impl-prep` 이 반쪽을 지적했다 — 축이 하나가 아니라 둘이다

`19_34_19` convention_compliance WARNING: `swagger.md §5-4` 의 **한 조항**이 두 가지를
요구하는데 내 plan 은 파이프만 겨냥하고 있었다.

| 축 | 무엇을 지키나 | 빠지면 |
|---|---|---|
| `@Param('id', ParseUUIDPipe)` | 런타임 400 차단 | 500 마스킹 |
| `@ApiParam({ format: 'uuid' })` | 생성된 OpenAPI 의 형식 광고 | 문서가 계약보다 느슨 |

AST 로 다시 재니 **문서 축 미충족이 3건**이었다 — 파이프 축(1건)만 닫았으면 둘이 남는다.

| 자리 | 파이프 | `@ApiParam format` | 처분 |
|---|---|---|---|
| `triggers.controller.ts rotateBotToken` | 없음 | 없음 | 둘 다 추가 |
| `auth.controller.ts switchWorkspace` | 있음 | **`format` 키만 없음** (설명엔 "(UUID)") | `format: 'uuid'` 추가 |
| `executions.controller.ts simulateExecutionRunRedeliveryForTest` | 있음 | 없음 | **면제** — `@ApiExcludeEndpoint()` 라 OpenAPI 에 안 실린다 |

> 처음 정규식 스캔은 이 축을 **1건**으로 잘못 셌다(핸들러 경계를 못 갈라 `rotateBotToken` 을
> 이웃과 묶었다). 정본 파서로 다시 세니 3건 — 같은 실수를 두 번 하지 않으려고 가드 자체도
> AST 다.

### 처분

- `@Param('id', ParseUUIDPipe) triggerId: string` + `@ApiParam({name:'id', …, format:'uuid'})`
  — 형제 6곳과 같은 형태. `@ApiBadRequestResponse` 문면에도 `VALIDATION_ERROR` 를 추가한다
  (이제 이 엔드포인트가 실제로 내는 400 이다).
- `auth.controller.ts switchWorkspace` 에 `format: 'uuid'` 한 줄. **한 건짜리 허용목록을
  만드는 대신 자리를 고친다** — 목록은 오판을 은폐하고, 이 저장소가 이미 그 실수를 기록했다.
- **가드로 고정한다.** 1회성 수정이면 다음 엔드포인트가 같은 자리에 다시 생긴다. 두 축을
  전부 고친 뒤 베이스라인이 **0** 이라 허용목록 없이 단언할 수 있고, 면제는 이름이 아니라
  **구조**(`@ApiExcludeEndpoint()`)로 둔다.
  - `repo-guards/__tests__/param-uuid-pipe-guard.ts` (순수 AST 판정)
  - `repo-guards/__tests__/param-uuid-pipe.spec.ts` (전수 단언 + vacuity floor + 대조군 4종)
  - `repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (스캔 루트 밖)
- 행위 테스트는 **쓰지 않는다.** `triggers.controller.spec.ts` 는 `new TriggersController(...)`
  직접 생성이라 **파이프가 아예 실행되지 않는다** — 거기에 400 단언을 넣으면 vacuous 하다.
  HTTP 왕복을 보려면 e2e 가 필요한데 `rotate-bot-token` 를 타는 e2e 가 현재 0개다(실측).
  `ParseUUIDPipe` 자체의 동작은 Nest 의 계약이므로, 이 저장소가 질 책임은 **선언의 존재**이고
  그것을 가드가 전수로 센다.

## B. 유저 가이드가 없는 이름을 적는다 — 두 종

트래커 지시: *"고치기 전에 다른 엔드포인트에도 같은 오기가 있는지 **전수로** 셀 것 — 네 곳만
고치면 같은 클래스가 남는다."* 두 축으로 셌다.

### 축 1 — 가이드의 UPPER_SNAKE 토큰이 코드베이스에 존재하는가

`content/docs/**` 의 `[A-Z][A-Z0-9]*(_[A-Z0-9]+)+` 토큰 **97개** 중 backend 부재 **17개**.

> **1차 판본은 백틱 안(`` `CODE` ``)만 셌고 그래서 69개만 봤다.** `models.mdx` 의
> `{ name: "LLM_MODEL_NOT_FOUND", … }` 처럼 **따옴표 형태**를 통째로 놓쳤다 — "전수로 셌다" 가
> 거짓이 되는 자리라 토큰 규칙을 넓혀 다시 셌다. 넓히니 부재가 10 → 17 로 늘었다.

17개를 주어로 갈랐다:

| 갈래 | 토큰 | 처분 |
|---|---|---|
| 프런트엔드에만 있음 (backend 부재가 정상) | `API_BASE_URL` · `LOCALE_SUFFIX` · `SECTION_LABELS_BY_LOCALE` | 대상 아님 |
| 문서 규약 문서의 플레이스홀더 | `_glossary.md` 의 `LABEL_KO`·`ERROR_KO`·`GROUP_KO`·`HINT_KO`·`ITEM_LABEL_KO`·`OPTION_LABEL_KO` | 대상 아님 |
| 외부 어휘 | `MESSAGE_CREATE` (Discord Gateway 이벤트명) | 대상 아님 |
| 산문의 범주어 | `SUB_WORKFLOW` (`SUB_WORKFLOW_FAILED` 계열의 축약, "DB / CODE / SUB_WORKFLOW failure") | 대상 아님 |
| **환경변수 오기** | **`MCP_INSECURE_URL_ALLOWED`** — 실재는 **`MCP_ALLOW_INSECURE_URL`** (`.env.example:331` · `mcp.config.spec.ts` · `mcp-tool-provider.ts`) | **본 PR 에서 고친다** (2곳) |
| **없는 에러 코드** | `LLM_AUTH_ERROR` · `LLM_MODEL_NOT_FOUND` · `INTEGRATION_ERROR` · `NODE_EXECUTION_FAILED` · `MAKESHOP_API_ERROR` | **별 건으로 등재** (아래 §C) |

### 축 2 — 존재하는 코드인데 **그 엔드포인트가 안 내는** 경우

`content/docs/**` 의 `NNN \`CODE\`` 형태 **29건**을 전부 뽑아 주어를 맞췄다:

| 주장 | 실측 | 판정 |
|---|---|---|
| `400 VALIDATION_ERROR` (16건) | `http-exception.filter.ts` 가 400 의 기본 코드로 낸다 | 참 |
| `400 BOT_TOKEN_INVALID` (6건) | `credentialRejectedError` → `chat-channel-input-rules.ts` 400 | 참 |
| `502 CHAT_CHANNEL_SETUP_FAILED` (5건) | 같은 파일 502 분기 | 참 |
| **`404 TRIGGER_NOT_FOUND` (2건)** | `TRIGGER_NOT_FOUND` 의 유일한 발신처는 **`hooks.service.ts:120`** — 인입 webhook 경로다. 트리거 REST API 의 404 는 `RESOURCE_NOT_FOUND` 이고 `triggers.controller.ts` 의 `@ApiNotFoundResponse` 가 그렇게 선언한다 | **거짓** |

### 그래서 이 클래스는 네 곳이 아니라 **여섯 곳**이다

`TRIGGER_NOT_FOUND` 를 "chat-channel API 의 코드" 로 적은 자리 전수:

| # | 자리 | 형태 |
|---|---|---|
| 1 | `content/docs/06-integrations-and-config/telegram.mdx` §6 | `404 TRIGGER_NOT_FOUND` (rotate 엔드포인트 에러 목록) |
| 2 | `…/telegram.en.mdx` §6 | 같음 |
| 3 | `content/docs/02-nodes/triggers.mdx` Callout | *"Chat Channel API가 반환할 수 있는 error code"* 8종 목록에 포함 |
| 4 | `…/triggers.en.mdx` Callout | 같음 |
| 5 | **`lib/i18n/backend-labels.ts`** | `ERROR_KO` 에서 *"chat-channel API 에러 코드 (spec §5.4)"* 주석 블록 **안에** 놓여 있다 |
| 6 | **`lib/i18n/__tests__/backend-labels.test.ts`** `LOCALIZED_ERROR_CODES` | 같은 주석 블록 안 |

5·6 은 트래커가 몰랐던 자리다 — **문서가 아니라 코드에도 같은 오귀속이 있다.** 그리고 같은
테스트 파일 아래쪽(`CHAT_CHANNEL_CODES` 위 주석)은 *"TRIGGER_NOT_FOUND 은 hooks webhook inbound
경로"* 라고 **이미 맞게** 적고 있다 — 한 파일 안에서 두 주석이 서로를 반증한다.

### 처분

- 1·2: `404 TRIGGER_NOT_FOUND` → `404 RESOURCE_NOT_FOUND` (컨트롤러의 `@ApiNotFoundResponse`
  문면과 일치시킨다).
- 3·4: Callout 목록에서 `TRIGGER_NOT_FOUND` 를 **뺀다**(7종). 이 API 가 내지 않는 코드다.

  > **그 옆 문장이 더 크게 틀려 있었다 — 고치던 손으로 확인했다.** 원래 계획은 *"모두 한국어
  > 안내 메시지로 표시돼요" 는 남는 7종에 대해 참이니 그대로 둔다* 였다. 근거는 7종이 전부
  > `ERROR_KO` 에 있다는 실측이었는데, **맵에 있는 것과 화면에 뜨는 것은 다른 주장**이다.
  >
  > | 축 | 실측 |
  > |---|---|
  > | `ERROR_KO` 에 7종 존재 | 참 |
  > | `ERROR_KO` 를 읽는 유일한 함수 `translateBackendError` 의 프로덕션 호출부 | **0건** |
  > | 회전 실패 시 화면 | `chat-channel-card.tsx` `onError` 가 에러를 **버리고** 고정 문자열 |
  >
  > 즉 그 문장은 7종에 대해서도, 8종 전부에 대해서도 거짓이었다. 코드가 화면에 **아예 안
  > 나온다**. 배선은 이 배치의 일이 아니므로(§C 등재), **문면을 진실로 좁힌다** —
  > *"API 를 직접 호출할 때 보이는 값"* + GUI 는 일반 실패 문구. 404 는 별 문장으로 적되
  > 표시 언어를 주장하지 않는다.
- 5·6: 항목을 **지우지 않고** 주석 귀속만 고친다. 지우려면 "프런트엔드가 이 코드를 렌더할 일이
  없다" 는 도달성 증명이 필요한데 이번 배치에서 하지 않았다. 주석은 3줄이고 거짓을 제거한다.
- `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` (`mcp-servers{,.en}.mdx` 2곳).

## C. 이번 배치에서 **하지 않는 것** — 등재만 한다

- **가이드가 적은 없는 에러 코드 5종** (`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`·
  `INTEGRATION_ERROR`·`NODE_EXECUTION_FAILED`·`MAKESHOP_API_ERROR`). `LLM_AUTH_ERROR` 는
  실재 `LLM_AUTH_FAILED` 의 근접 오기로 보이지만 나머지는 **대응하는 실재 코드를 먼저
  정해야 한다** — `Test Connection` 이 모델 부재에 실제로 무엇을 내는지, 노드 에러 포트가
  일반 실패에 무엇을 싣는지를 실측해야 고칠 수 있다. 이름만 바꾸면 또 하나의 추측이 된다.
- **`ERROR_KO` 매핑을 아무도 읽지 않는다.** 등재하려던 문장은 *"일반 API 코드가 맵에 없어
  ko 화면에 영문이 뜬다"* 였는데 **그 전제가 반증됐다** — `translateBackendError` 의 프로덕션
  호출부가 0건이라 영문조차 안 뜬다(고정 실패 문구가 뜬다). 맵에 줄을 더하는 것은 아무것도
  바꾸지 않으므로, 결정해야 할 것은 *"에러 코드를 UI 에 노출할 것인가, 노출한다면 어디에
  배선할 것인가"* 다. 별 건이다.

두 항목 모두 `spec-draft-nullable-notation-followups.md` 에 등재한다.

## 체크리스트

- [x] A: `ParseUUIDPipe` + `@ApiParam({format:'uuid'})` 부착 (`rotateBotToken`) ·
      `switchWorkspace` 의 `format` 보강
- [x] A: `param-uuid-pipe` 가드 + spec + fixture (전수 단언 · vacuity floor 2종 · 대조군 4종)
- [x] A: 뮤테이션 6/6 — 예측 전부 일치, 원복 후 baseline GREEN (§뮤테이션 표)
- [x] B: MDX 4곳 (`telegram{,.en}` · `02-nodes/triggers{,.en}`)
- [x] B: `backend-labels.ts` · `backend-labels.test.ts` 주석 귀속
- [x] B: `mcp-servers{,.en}.mdx` 환경변수명
- [x] C: 트래커 2건 등재 + 원 항목 2건 종결 표기
- [x] `/consistency-check --impl-prep spec/5-system/` — **BLOCK: NO** (`19_34_19`),
      WARNING 1건은 §A 의 `@ApiParam` 축으로 반영
- [ ] `.claude/tools/run-test-all.sh`
- [x] `/ai-review` `review/code/2026/09/12/20_01_18` — **Critical 0 · WARNING 4** (forced 7 전원
      산출물 확보, 미이행 0). 넷 다 실측으로 확인하고 처분했다:
      | # | 지적 | 처분 |
      |---|---|---|
      | 1 | SPEC-DRIFT — *"`swagger.md §5-4` 가 두 축을 요구한다"* 는 서술이 과장 | **참이었다**: `ParseUUIDPipe` 가 그 문서에 0건. 가드·spec 주석 2곳의 **출처를 갈랐고**, §5-4 확장은 planner 항목으로 등재(조건 1 미충족이라 분리) |
      | 2 | vacuity 카운터가 판정 순회를 재구현 | `scanUuidParams` 가 `{violations, scanned}` 를 **같은 루프에서** 반환하도록 통합, `countIdShapedParams` 제거 |
      | 3 | 면제가 런타임 축까지 끄는 방향의 캐너리 없음 | `excludedPipeless` fixture + 단언 추가 — **M7 뮤턴트가 RED** 로 그 방향을 고정 |
      | 4 | 500→400 은 관측 가능한 변경인데 CHANGELOG 누락 | 선례(`raw 23505 가 500 이었다` 항목) 형식으로 항목 추가 |
      INFO 중 둘(텍스트 부분일치 한계 · fixture 의 스캔 루트 서술 부정확)도 같은 라운드에 반영.
- [ ] 2라운드 `/ai-review` (fix 반영분)
- [ ] `--impl-done`

## 뮤테이션 2차 (fix 반영 후)

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M1~M6 (1차와 동일) | RED | RED |
| M7 면제를 넓혀 런타임 축까지 스킵 | RED | RED |
| M8 `scanned` 를 판정과 분리(상수 고정) | **GREEN** | GREEN |

M8 은 구멍이 아니라 **floor 의 범위를 적은 것**이다 — floor 가 잡는 것은 *"아무것도 안 셌다"*
이지 *"거짓말하는 카운터"* 가 아니고, 후자를 막는 것은 두 값이 같은 루프에서 나온다는 **구조**다.
예측 GREEN 을 먼저 적어 두었으므로 이 GREEN 도 증거다.

## 뮤테이션 — 가드가 그 자리를 실제로 보는가

GREEN 은 증거가 아니다. 예측을 먼저 적고 실측을 옆 칸에 채웠다.

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M1 `rotateBotToken` 의 `ParseUUIDPipe` 제거 | RED | RED |
| M2 `rotateBotToken` 의 `@ApiParam` 제거 | RED | RED |
| M3 `switchWorkspace` 의 `format:'uuid'` 제거 | RED | RED |
| M4 `@ApiExcludeEndpoint` 면제를 항상 `false` 로 무력화 | RED | RED |
| M5 id-형 술어에서 `…Id` 접미 제거 | RED | RED |
| M6 `new ParseUUIDPipe(...)` 형태를 못 받게 축소 | RED | RED |

M4·M5·M6 은 **판정 함수의 각 갈래가 죽은 코드가 아님**을 고정한다 — 면제·접미·인스턴스화
형태는 각각 fixture 한 자리씩이 유일한 관측 지점이다. 원복 후 baseline GREEN 재확인.
