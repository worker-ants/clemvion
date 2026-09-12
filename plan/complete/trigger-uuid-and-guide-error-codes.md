---
worktree: trigger-uuid-and-guide-codes
started: 2026-09-12
owner: developer
# 실측: 그 PR 이 건드린 `spec/**` 파일 0건. spec 갭 3건은 planner 소관이라
# `spec-draft-nullable-notation-followups.md` 로 등재만 했다.
spec_impact: none
---

# `rotateBotToken` 의 비-UUID 마스킹 + 가이드가 적은 없는 이름 두 종

> **스코프 고지** — 이 문서는 **컨트롤러 경로 파라미터 검증**(`@Param(':id', ParseUUIDPipe)`)
> 이야기다. 이름이 가까운 `plan/complete/trigger-endpoint-path-uuid-validate.md` 는 **DB 컬럼
> CHECK 제약** 건으로 무관하다 — `--impl-done` `review/consistency/2026/09/12/22_14_31`
> naming_collision INFO 가 "trigger"+"uuid" 토큰이 겹쳐 grep 혼동 여지가 있다고 지적했다.

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
- ~~행위 테스트는 **쓰지 않는다.**~~ **2라운드에 반증됐다** (`20_26_58` testing WARNING).
  전제("`new TriggersController(...)` 라 파이프가 안 돈다 → HTTP 왕복은 e2e 가 필요하다")의
  앞 절은 참이지만 뒤 절이 틀렸다 — `Test.createTestingModule` + `supertest` 면 **DB·Redis
  없이** 진짜 Nest 파이프라인을 태울 수 있고, 형제 `health.controller.spec.ts` 가 이미 그
  형태다. 내가 *"e2e 가 없으니 못 한다"* 로 결론을 건너뛴 것이다.
  지금은 `triggers.controller.spec.ts` 에 HTTP 왕복 3케이스가 있다 —
  `GlobalExceptionFilter` 를 붙여 **봉투의 `code` 까지** 단언하므로 가드가 못 보는 층을 덮는다.

  | 입력 | 기대 | 무엇을 가르나 |
  |---|---|---|
  | 비-UUID id | 400 `VALIDATION_ERROR`, 서비스 미호출 | 파이프가 거부했다 |
  | 정상 UUID + 본문 누락 | 400 `INVALID_BOT_TOKEN`, 서비스 미호출 | 핸들러가 거부했다 |
  | 정상 UUID + 정상 본문 | 200, 서비스에 그 id 전달 | 정상 입력을 막지 않는다 |

  첫 판본은 `@WorkspaceId()` 가 헤더 부재로 먼저 400 을 던져 **세 케이스가 같은 코드로
  수렴**했다 — 대조군이 무의미해지는 형태라 `X-Workspace-Id` 를 실어 그 축을 고정했다.

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
  `INTEGRATION_ERROR`·`NODE_EXECUTION_FAILED`·`MAKESHOP_API_ERROR`).
  **LLM 쪽 둘은 오기가 아니었다** — `7-llm-client.md:345` 가 `LLM_AUTH_ERROR`(401)·
  `LLM_MODEL_NOT_FOUND`(404) 를 **Planned(미구현)** 로 등재하고 *"현재는
  `LLM_CONNECTION_ERROR` 로 수렴"* 한다고 적는다. 근접 오기로 진단했던 첫 판단은 틀렸고,
  고칠 방향이 정반대다(철자가 아니라 **미구현을 기구현처럼 서술**한 것). 나머지 셋은 여전히
  **대응하는 실재 코드를 먼저 실측해야** 한다. 이름만 바꾸면 또 하나의 추측이 된다.
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
- [x] `.claude/tools/run-test-all.sh` lint·unit·build·e2e — 라운드마다 ALL PASS
      (backend 460 suites · e2e 305 tests)
- [x] `/ai-review` `review/code/2026/09/12/20_01_18` — **Critical 0 · WARNING 4** (forced 7 전원
      산출물 확보, 미이행 0). 넷 다 실측으로 확인하고 처분했다:
      | # | 지적 | 처분 |
      |---|---|---|
      | 1 | SPEC-DRIFT — *"`swagger.md §5-4` 가 두 축을 요구한다"* 는 서술이 과장 | **참이었다**: `ParseUUIDPipe` 가 그 문서에 0건. 가드·spec 주석 2곳의 **출처를 갈랐고**, §5-4 확장은 planner 항목으로 등재(조건 1 미충족이라 분리) |
      | 2 | vacuity 카운터가 판정 순회를 재구현 | `scanUuidParams` 가 `{violations, scanned}` 를 **같은 루프에서** 반환하도록 통합, `countIdShapedParams` 제거 |
      | 3 | 면제가 런타임 축까지 끄는 방향의 캐너리 없음 | `excludedPipeless` fixture + 단언 추가 — **M7 뮤턴트가 RED** 로 그 방향을 고정 |
      | 4 | 500→400 은 관측 가능한 변경인데 CHANGELOG 누락 | 선례(`raw 23505 가 500 이었다` 항목) 형식으로 항목 추가 |
      INFO 중 둘(텍스트 부분일치 한계 · fixture 의 스캔 루트 서술 부정확)도 같은 라운드에 반영.
- [x] 2라운드 `/ai-review` `review/code/2026/09/12/20_26_58` (`--route=all`, 14명) —
      **Critical 0 · WARNING 4**. 넷 다 실측 확인:
      | # | 지적 | 실측 | 처분 |
      |---|---|---|---|
      | 1 | `15-chat-channel.md §5.4` 표에 신규 400 행 없음 | 참 | **planner 항목 등재** (조건 1 미충족) |
      | 2 | `LLM_AUTH_ERROR` 를 "근접 오기" 로 오진단 | **참 — `7-llm-client.md:345` 가 Planned 로 등재** | plan·트래커 두 곳 진단 정정 |
      | 3 | docstring 수치 127 이 틀림 | 참 — AST 재측정 **144** (내 정규식이 첫 `}` 에서 끊겼다) | 시점·범위 병기해 정정 |
      | 4 | 500→400 행위 변경의 실행 테스트 부재 | 참 — 내 "e2e 가 필요하다" 가 틀렸다 | HTTP 왕복 3케이스 추가, M9·M10 으로 고정 |
- [x] 3라운드 `/ai-review` `review/code/2026/09/12/20_53_01` — **Critical 0 · WARNING 3**.
      선언해 둔 정지 규칙("`codebase/**` 수정이 필요한 WARNING 이 하나라도 있으면 한 라운드
      더")에 따라 **종료하지 않고** 셋 다 처리했다:
      | # | 지적 | 위치 | 처분 |
      |---|---|---|---|
      | 1 | 신규 `400 VALIDATION_ERROR` 가 가이드 4곳에 미반영 — **바로 그 줄을 다른 이유로 편집했으면서** 놓쳤다 | `codebase/**` | 네 곳에 추가 |
      | 2 | 두 결함 클래스 중 가이드 식별자 쪽만 가드를 못 얻었다 (1회성 정규식 스윕) | `plan/**` | 후속 가드 항목 등재 (비대상 설계까지 적어서) |
      | 3 | 판정 함수 AST 중첩 5단 | `codebase/**` | `collectMethodViolations` 추출 — 순회와 판정 분리 |
      INFO 둘도 같은 라운드에 반영: 인덱스드 액세스 타입 → `UuidParamAxis` 별칭,
      *"위반 3건을 전부 고쳤다"* → *"둘은 고치고 하나는 구조로 면제"* 로 표현 정밀화
      (셋째는 코드를 안 고쳤는데 "고쳤다" 가 그 사실을 가리고 있었다).
- [x] 4라운드 `/ai-review` `review/code/2026/09/12/21_20_01` — **Critical 0 · WARNING 5**.
      정지 조건("남은 WARNING 이 전부 spec·`plan/**`")은 **미충족** — 둘이 `codebase/**` 다.
      | # | 지적 | 위치 | 처분 |
      |---|---|---|---|
      | 1 | SPEC-DRIFT `15-chat-channel.md §5.4` 표 | spec | 이미 planner 등재 (재확인) |
      | 2 | SPEC-DRIFT `swagger.md §5-4` 체크리스트 | spec | 이미 planner 등재 (재확인) |
      | 3 | `GlobalExceptionFilter` 가 22P02 를 분류 안 함 — 파이프 밖 경로는 여전히 500 | `codebase/**` | **등재** (전 엔드포인트 실패 분류를 바꾸는 변경이라 전수 선행) |
      | 4 | 500→400 breaking — 외부 소비자 확인 | — | 리뷰 자신이 *"코드 자체는 추가 조치 불필요"* |
      | 5 | 리뷰 세션 시각을 소스 주석이 직접 인용 | `codebase/**` | **고쳤다 — 실은 규약 위반이었다** |
      > **5번은 "영구성" 문제가 아니라 `review-citations.md §2` 위반이다.** 그 규약은 bare
      > `hh_mm_ss` 를 **금지**한다(날짜를 넘어 충돌하는 시각이 실측 46개, 해소 불가 8개).
      > 내가 새로 넣은 bare 인용 **8건**을 전체 경로로 확장했다(잔여 0 확인). §4 에 따라 기존
      > 인용은 건드리지 않는다. **이 저장소에서 같은 위반을 반복한 것**이라 기록해 둔다.
- [x] 5라운드 `/ai-review` `review/code/2026/09/12/21_41_49` — **Critical 0 · WARNING 4 +
      SPEC-DRIFT 2**. 정지 조건은 **또 미충족** — 하나가 `codebase/**` 다.
      | # | 지적 | 위치 | 처분 |
      |---|---|---|---|
      | SD1·SD2 | `15-chat-channel.md §5.4` · `swagger.md §5-4` | spec | 이미 planner 등재 (리뷰도 *"중복 등재 불요"*) |
      | 1 | 500→400 breaking | — | 리뷰 자신이 *"CHANGELOG 에 disclose 됐으니 추가 조치 불요"* |
      | 2 | 가드 주석 실측 수치 오프바이원 (`135건 107:28`) | `codebase/**` | **고쳤다 — 내 수정이 내 숫자를 무효화했다** |
      | 3 | MCP 오타 수정이 배치 범위 밖 | — | 리뷰 자신이 *"되돌릴 필요 없음"* (커밋 메시지 명시 권고) |
      | 4 | `GlobalExceptionFilter` 22P02 | `codebase/**` | 이미 등재 — 리뷰도 *"신규 조치 불요"* |
      > **2번은 내가 기록해 둔 실패 모드를 같은 PR 안에서 반복한 것이다.** `135건 107 : 28` 은
      > 파이프를 **붙이기 전** 값인데, 이 PR 이 마지막 1건을 채우면서 **136 / 108 : 28** 이
      > 됐다 — 저장소가 이미 적어 둔 *"PR 안의 정량 기록은 PR 이 닫히는 시점의 값"* 그대로다.
      > 더 나쁜 건 그 두 줄 위에 *"측정 시점과 범위를 함께 적으라"* 는 내 자신의 정정 노트가
      > 있었다는 것이다. 이제 문장에 **"이 PR 이 마지막 1건을 채운 뒤"** 를 박아 뒀다.
- [x] 6라운드 `/ai-review` — **정지 규칙을 여기서 한 번 좁힌다(결과 보기 전 선언)**.
      지금까지의 규칙("`codebase/**` WARNING 이 하나라도 있으면 한 라운드 더")은 **원리적으로
      종료하지 않는다** — 라운드마다 주석 한 줄짜리 지적이 하나씩 나오면 영원히 돈다.
      실제로 5라운드의 유일한 코드 항목은 **주석 속 숫자 두 자리**였고, 그걸 보려고 14명을
      한 바퀴 더 돌렸다.
      **6라운드부터**: Critical 0 이고 남은 발견이 **동작·테스트 커버리지·공개 계약** 중
      어느 것도 바꾸지 않으면 종료한다. 주석·산문만 고치는 지적은 **등재**한다.
      (이 좁힘을 결과를 보기 **전에** 적는 이유는, 마지막 라운드 결과를 보고 기준을 옮기는 것이
      이 저장소가 이미 금지한 형태이기 때문이다.)
- [x] 6라운드 `/ai-review` `review/code/2026/09/12/22_03_45` — **Critical 0 · WARNING 3**.
      **좁힌 정지 규칙의 조건을 충족해 여기서 수렴을 선언한다**:
      | # | 지적 | 동작/커버리지/계약을 바꾸나 | 처분 |
      |---|---|---|---|
      | 1·2 | SPEC-DRIFT (`§5.4` 표 · `swagger.md §5-4`) | 아니오 — spec 문서 | 이미 planner 등재 (리뷰도 *"새 작업 아님"*) |
      | 3 | `@ApiUuidParam()` 합성 데코레이터 제안 | 아니오 — 리뷰가 **non-blocking** 명시 | 등재 |
      리뷰 자신의 결론도 같다: *"`codebase/**` 를 다시 고쳐야 하는 새 발견은 없음 — 이번
      라운드로 리뷰 수렴 가능"*. INFO 중 산문 2건(테스트 describe 범위 문구 · 인용 형식)도
      **등재만 한다** — 수렴 뒤 `codebase/**` 를 만지면 push 게이트 freshness 가 뒤집혀
      14명을 다시 돌려야 하고, 산문 두 줄에 그 값을 치를 이유가 없다.

      **6라운드 요약 — 발견의 성격이 어떻게 옮겨갔나**
      | 라운드 | Critical | WARNING | 성격 |
      |---|---|---|---|
      | 1 | 0 | 4 | 규약 인용 과장 · 구조(중복 순회) · 캐너리 부재 · CHANGELOG |
      | 2 | 0 | 4 | **내 판단 2건이 틀렸다** (e2e 필요설 · 근접 오기설) · 수치 · spec 표 |
      | 3 | 0 | 3 | 가이드 400 누락 · 가드 비대칭 · 중첩 |
      | 4 | 0 | 5 | 규약 위반(bare 인용) · 22P02 seam · spec 2 |
      | 5 | 0 | 4+2 | **주석 숫자 두 자리** · 나머지는 전부 기등재/조치불요 |
      | 6 | 0 | 3 | **전부 spec·non-blocking** → 수렴 |
      동작 결함 → 구조 → 내 주장의 오류 → 규약 → 산문 순으로 내려왔다.
- [x] `/consistency-check --impl-done spec/5-system/` `review/consistency/2026/09/12/22_14_31`
      — **BLOCK: NO** (5 checker 전원 CRITICAL 0 · 위험도 LOW). 잔여 WARNING 은 같은 사안,
      즉 §5.4 표에 신규 400 분기가 없다는 것이고 **이미 planner 항목으로 등재 완료**임을
      checker 가 직접 확인했다. 요약의 판정: *"기존 invariant(UUID 검증 강도 비대칭)를
      위반하지 않고 오히려 **마지막 예외를 닫는 방향**"*.

## 리뷰어가 워킹트리를 뮤테이션했다 (기록)

4라운드 `documentation` reviewer 가 *"`triggers.controller.ts` 에서 `ParseUUIDPipe` 가
미커밋 상태로 제거돼 있다"* 고 관측했다. 같은 라운드 `testing` reviewer 가 내 뮤테이션 주장
(M9)을 **직접 재현**하며 그 파일을 고쳤다가 원복한 것이다 — 저장소가 이미 기록한
"병렬 리뷰어가 공유 워크트리를 뮤테이션해 서로를 오염시킨다" 의 실례다.
확인: 워킹트리 `codebase` 변경 0줄, HEAD 의 컨트롤러에 `@Param('id', ParseUUIDPipe) triggerId`
1건 존재. **코드 결함 아님.**

## 뮤테이션 3차 — HTTP 왕복 (행위 층)

가드(정적)와 달리 이쪽은 실제 요청을 태운다.

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M9 `rotateBotToken` 의 `ParseUUIDPipe` 제거 | RED | RED |
| M10 핸들러의 `newBotToken` 가드 제거 (두 400 을 가르는 대조군) | RED | RED |

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
