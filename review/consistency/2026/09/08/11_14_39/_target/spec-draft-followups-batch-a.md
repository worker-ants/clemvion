---
title: 배치 A — harness 권한 명시 · 트리거 목록 자기모순 4건 · 도메인 에러 코드 표현 · §5.4 2축 등재 · User 7컬럼 규범
worktree: spec-followups-batch-a-ea9961
started: 2026-09-08
owner: planner
status: in-progress
priority: P1
spec_impact:
  - CLAUDE.md
  - .claude/skills/developer/SKILL.md
  - spec/2-navigation/2-trigger-list.md
  - spec/5-system/15-chat-channel.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/3-error-handling.md
  - spec/conventions/swagger.md
  - spec/conventions/secret-store.md
  - spec/1-data-model.md
---

# 배치 A — planner 턴 draft

`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 **planner 항목 5건**을 한 턴에
묶는다. 전부 `spec/`(+ 거버넌스 문서) 쓰기라 `--spec` 게이트를 한 번만 태우면 된다.

**착수 전 재판정 (2026-09-08)**: `git fetch origin` 후 `origin/main` 은 여전히 `08fbf133d`
(#1292) — 이 5건을 등재한 그 커밋이다. 다른 세션이 먼저 처리한 항목 **0건**, 델타 0으로
폐기할 항목 **0건**.

---

## A-1. `CLAUDE.md` Skill 표에 harness(`.claude/**`) 행을 명시한다

### 무엇이 문제인가

Skill 표(`CLAUDE.md:61-67`)는 쓰기 권한을 `spec/**`·`plan/**`·`codebase/**`·`review/**`
네 축으로 적고, `.claude/**` 는 **어느 역할에도 배정돼 있지 않다.** 그런데 `#1292` 가
`.claude/hooks/_lib/review_guard.py` 와 그 테스트를 고쳤다.

`developer/SKILL.md` 의 「경로별 권한」 표(24~33행)도 같다 — `.claude/**` 행이 없다.
**두 문서가 나란히 비어 있다.**

### 사용자 결정 (2026-09-06)

**파서 수정을 남기고 문서로 명시한다.** 세 선택지(남긴다+명시 / 별도 PR 분리 / 되돌리고
spec 7파일 스윕) 중 첫째.

### 선례가 있다 — 같은 형태를 한 번 처리했다

`051c7e7c1` (#1232, 2026-08-29) *"`developer` 의 `review/` 권한을 관례로 넓히고, 그 규칙의
거짓 근거를 고쳤다"*. 그 PR 의 구조가 이 항목과 동형이다:

| | #1232 | 본 항목 |
|---|---|---|
| 증상 | 권한표는 `review/**/RESOLUTION.md` 만, 관례는 라운드 산출물 전체 | 권한표에 `.claude/**` 없음, 관례는 harness 수정 다수 |
| 처분 | 관례에 맞춰 표를 넓힘 | 관례에 맞춰 표에 행을 신설 |
| 동반 갱신 | `CLAUDE.md` + `developer/SKILL.md` **동시** | 동일 — 두 문서가 SoT 를 나눠 갖는다 |
| 검증 | `python3 -m pytest .claude/tests -q` | 동일 |

**실측 — 관례가 실재한다**: `.claude/hooks`·`.claude/tools`·`.claude/tests` 를 건드린 커밋은
2026-06-01 이후 **81건**이다(`git log --oneline --since=2026-06-01 -- .claude/hooks
.claude/tools .claude/tests | wc -l`).

### 변경안 — 한 행이 아니라 **두 행**이다

`.claude/**` 를 한 덩어리로 배정하면 **역할이 자기 정의를 고치는 자리**까지 함께 넘어간다.
축을 갈라 적는다.

```markdown
| 개발자 | [`developer`](.claude/skills/developer/SKILL.md) | `codebase/**`, `plan/**`, `review/**`, **harness 실행물** (`.claude/hooks/**`·`.claude/tools/**`·`.claude/tests/**`). `spec/` read-only ([좁은 예외](#자기-반증형-소정정--developer-가-spec-을-고칠-수-있는-유일한-경우)) |
```

그리고 표 아래 규칙 목록에 두 줄을 더한다:

```markdown
- **harness(`.claude/**`) 는 두 축으로 갈린다** — 코드·테스트·도구(`hooks/`·`tools/`·`tests/`)는 `developer`,
  **거버넌스 문서**(`CLAUDE.md`·`.claude/skills/**/SKILL.md`·`.claude/docs/**`)는 `project-planner` 다.
  역할 정의를 그 역할 자신이 고치는 것을 막는 경계다. `.claude/worktrees/**` 는 각 세션의 작업 트리이며
  `integrate-*` 만 `merge-coordinator` 소유(위 표).
- **harness 변경은 리뷰 게이트가 물지 않는다** — `/ai-review`·`--impl-done` push 게이트의 스코프는
  `codebase/**` 이다. harness-only 변경은 차단되지 않으므로 **검증은 `python3 -m pytest .claude/tests -q`
  가 대신한다**(선례 `051c7e7c1` 이 그 명령으로 검증했다). 이 비대칭을 적지 않으면 "harness 도 게이트가
  본다" 는 보장을 문서가 구현보다 넓게 말하게 된다.
```

`developer/SKILL.md` 「경로별 권한」 표에도 대응 행:

```markdown
| `.claude/hooks/**`, `.claude/tools/**`, `.claude/tests/**` | Read/Write — harness 실행물. 검증은 `python3 -m pytest .claude/tests -q` (리뷰 게이트 스코프 `codebase/**` 밖이라 push 가 차단되지 않는다) |
| `.claude/docs/**`, `.claude/skills/**/SKILL.md`, `CLAUDE.md` | Read only — 거버넌스 문서. 수정은 `project-planner` 위임 |
```

### 왜 "거버넌스 문서는 planner" 로 가르나

이력이 그 경계를 지지하지 **않는다** — `a36395f5c`·`fed994b6b` 등 `fix(harness)` 커밋이
`.claude/docs/` 를 함께 고쳤다. 그러니 이것은 관례의 기술이 아니라 **신설 규칙**이고, 그
사실을 숨기지 않는다.

근거는 하나다: `#1292` 가 밟은 자리가 정확히 *"규칙을 고칠 권한이 없는 역할이 그 규칙의
빈칸을 스스로 해석했다"* 였다. 코드는 게이트·테스트가 되돌릴 수 있지만 **역할 정의는
자기 자신을 검증하는 자리라 되돌릴 축이 없다.** 그래서 그 자리만 planner 로 남긴다.

**대안 — `.claude/**` 전부를 developer 에게**: 관례에는 더 맞지만 `#1292` 의 결함 자체를
"권한 있었음" 으로 사후 정당화한다. 기각.

---

## A-2. `2-trigger-list.md` 자기모순 4건 (+ `15-chat-channel.md` 동반)

### A-2-1. R-2 가 폐기된 설계를 유효한 것처럼 남긴다

`2-trigger-list.md:226-234` 의 `### R-2. Webhook HMAC secret 입력 vs. rotate 분리` 가
`POST /api/triggers/:id/auth/rotate-secret` 를 v1.1 API 로 예고한다. 같은 문서 §3 하단
블록쿼트(160행)는 *"과거 v1.1 예약 행 … 은 신설되지 않은 채 본 PR 에서 폐기됐다
(Rationale R-14)"* 라고 적는다. 게다가 R-2 가 전제하는 `config.hmacSecret` PATCH 입력 자체가
**R-14 로 제거됐다**(`2-trigger-list.md:162` — *"인증 관련 inline 키 … 는 제거됨"*).

→ R-2 본문을 취소선으로 남기고 정정 콜아웃을 붙인다. **삭제하지 않는다** — `15-chat-channel.md`
R-CC-10 이 이 절을 앵커로 링크하므로 지우면 링크가 깨지고, 폐기 이력 자체가 R-CC-10 의
근거다.

```markdown
### R-2. Webhook HMAC secret 입력 vs. rotate 분리 ~~(v1 / v1.1)~~ — 폐기

> **정정 (2026-09-08)**: **본 절의 설계는 R-14 로 대체됐다.** 아래 원문은 이력으로만 남긴다.
> - 전제였던 `config.hmacSecret` inline 입력이 R-14 로 제거됐다 ([§3 PATCH body](#3-api)).
> - 예고했던 `POST /api/triggers/:id/auth/rotate-secret` 은 **신설되지 않은 채 폐기**됐다
>   ([§3 하단](#3-api)). 웹훅 자격증명 회전은 `POST /api/auth-configs/:id/regenerate` 로 일원화됐다.
> - 따라서 아래 **TBD 세 항목(응답 shape · grace 기간 · 경로 세그먼트)도 함께 소멸**했다 — 결정되지
>   않은 것이 아니라 결정할 대상이 없어졌다.
>
> 본 절을 지우지 않는 이유: [Chat Channel R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only)
> 이 *"우리가 보유한 secret ↔ 외부 provider 등록 token"* 대조군으로 이 절을 인용한다. 그 대조는
> **자원 성격의 대조**라 설계가 폐기돼도 유효하다.

~~§2.3.1 의 `hmacSecret` 행은 …~~   (이하 원문 취소선)
```

**`15-chat-channel.md` R-CC-10 동시 갱신** (610행) — 인용 문구를 "현재 유효한 설계" 에서
"폐기된 설계" 로 바꾼다. 대조 자체는 유지한다:

```markdown
… PATCH + rotate 양쪽 허용은 [`spec/2-navigation/2-trigger-list.md` Rationale R-2](../2-navigation/2-trigger-list.md#r-2-webhook-hmac-secret-입력-vs-rotate-분리-v1--v11--폐기)
의 hmacSecret 패턴과 정렬되나 자원 성격이 다르다 — (**R-2 의 설계 자체는 이후 R-14 로 폐기됐다.
여기서 인용하는 것은 그 API 형태가 아니라 "우리가 보유한 secret" 이라는 자원 성격이며, 그 대조는
폐기와 무관하게 성립한다.**) hmacSecret 는 …
```

> 앵커가 바뀐다 — 제목에 `— 폐기` 를 붙이면 slug 도 바뀐다. **인입 링크를 전수 갱신**한다
> (실측: `grep -rn "r-2-webhook-hmac-secret" spec` 로 확인 후 적용).

### A-2-2. frontmatter `status: implemented` 가 본문의 자백과 모순

`2-trigger-list.md:151` 이 *"`PaginationQueryDto` 가 `sort`/`order` 를 받긴 하나 `findAll` 은
이를 무시하고 `created_at DESC` 로 고정 정렬한다. sort/order 반영은 미구현/Planned"* 라고
적는데 frontmatter 는 `status: implemented` 다. `spec-impl-evidence.md §3` 라이프사이클 위반.

> **등재된 처방의 선례 주장이 틀렸다 — 실측으로 정정한다.**
> 자매 항목은 *"자매 문서 `3-schedule.md` 가 전자(=`status: partial`)의 선례다"* 라고 적었다.
> **아니다.** `3-schedule.md` 는 지금 `status: implemented` 이고 `pending_plans` 가 **없다**.
> 그 문서의 Rationale `sort/order 쿼리 반영 — "미구현/Planned" 표기 해제 (2026-06-10)` 가
> 적는 바로는, 그쪽은 **`findAll` 에 whitelist `orderBy` 를 구현해서** 표기를 뗐다
> (`schedules.service.ts:116-123` 의 `allowed` 맵). 즉 `3-schedule.md` 는 **후자(구현)의
> 선례**다.
>
> 이 정정이 처분을 바꾸지는 않는다 — 구현은 planner 권한 밖이므로 이 턴에서 할 수 없다.
> 바꾸는 것은 **다음 사람이 무엇을 목표로 삼는가**다: 종착지는 `partial` 로 남기는 것이
> 아니라 `3-schedule.md` 와 같은 자리(구현 + `implemented`)다.

→ 이 턴: `status: partial` + `pending_plans` 등재 (현 상태의 정직한 기술).
→ 종착지: 별 developer 턴이 `triggers.service.findAll` 에 whitelist `orderBy` 를 구현하고
   `implemented` 로 되돌린다. 그 항목을 자매 트래커에 developer 항목으로 신설한다
   (`pending_plans` 가 가리킬 실재 대상이 있어야 `spec-pending-plan-existence.test.ts` 를 통과한다).

```yaml
status: partial
pending_plans:
  - plan/in-progress/spec-draft-nullable-notation-followups.md
```

### A-2-3. Auth Config 행의 "새 인증 설정 만들기" 링크가 editor 에게 dead-end

`2-trigger-list.md:103` 이 셀렉터 구성에 `"+ 새 인증 설정 만들기" (→ /authentication)` 를 적고
행 권한은 `edit`(=editor+)이다. 목적지의 생성 액션은 **Admin+ 전용**이다 —
`6-config.md:125` 가 *"Add Config(헤더) … 는 Admin+ 에만 UI 노출"* 을
[`1-auth.md §3.2`](../5-system/1-auth.md#32-리소스별-권한-매트릭스) 권한 매트릭스를 근거로 인용한다.

**결정할 것은 없다** — SoT 가 이미 확정돼 있고, 남은 것은 문구 정정이다.

→ 해당 셀에 한 문장 추가:

```markdown
… + "+ 새 인증 설정 만들기" (→ `/authentication`) 로 구성 (Rationale R-14). **단 이 항목은 Admin+ 에만
노출한다** — 목적지의 Add Config 액션 자체가 Admin+ 전용이므로([설정 §A 권한](./6-config.md#권한),
SoT [인증 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스)) editor/viewer 에게는 눌러도 만들 수
없는 dead-end 가 된다. editor 는 기존 AuthConfig 목록 + "인증 없음" 만 본다.
```

### A-2-4. `2-trigger-list.md:106` botToken 행의 자기모순

한 셀이 *"응답에는 `hasBotToken: boolean` 만 노출"* 과 *"마스킹 placeholder (`•••• <last4>`)"*
를 **동시에** 말한다. boolean 만 나가면 서버가 last4 를 보낼 방법이 없다.
[`15-chat-channel.md §5.4.2`](../5-system/15-chat-channel.md#542-응답-dto-derived-필드--hasbottoken)
(*"`botTokenRef` 자체와 `botToken` plaintext 는 응답에 절대 미포함"*)과도, 구현(회전 입력창
placeholder 는 형식 예시 `"123456789:ABCdef..."`)과도 어긋난다.

AuthConfig 의 `***<last4>` 마스킹 규약을 성격이 다른 **write-only** 필드에 잘못 차용한 것으로
보인다. **방치하면 다음 구현자가 실제 last4 노출 필드를 신설해 `secret-store.md §1.1` 을
위반할 소지**가 있다 — 그것이 이 항목의 실질이다.

→ 마스킹 placeholder 구를 제거하고 write-only 임을 명시:

```markdown
| Chat Channel | `botToken` | edit (입력) + rotate 액션 (single-path) | **write-only** — 응답에는
`hasBotToken: boolean` 만 노출([§5.4.2](…#542-응답-dto-derived-필드--hasbottoken)). **마스킹 값도
last4 도 응답에 싣지 않는다** — AuthConfig 의 `***<last4>` 규약은 *읽을 수 있는* 자격증명용이라
write-only 필드에 차용하지 않는다([secret-store §1.1](../conventions/secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다)).
입력창 placeholder 는 형식 예시(`123456789:ABCdef...`)이지 서버가 보낸 값이 아니다. 형식 검증
`^\d{6,}:[A-Za-z0-9_-]{30,}$` … |
```

---

## A-3. 도메인 세부 에러 코드의 표현 방식을 정식화

### 무엇이 문제인가

저장소에 **두 관례**가 공존하는데 `2-api-convention.md §5.3` 이 어느 쪽도 명문화하지 않는다:

1. top-level `code` 자체를 특화 코드로 **교체** — `DUPLICATE_NODE_LABEL`,
   `WORKFLOW_VERSION_CONFLICT`, `ALREADY_A_MEMBER`, `KB_REEXTRACT_IN_PROGRESS` 등.
2. 세부 사유는 **`details[].code`** — `error-codes.md §4.2`(트리거 파라미터 검증),
   `trigger-parameter.types.ts`.

`TRIGGER_ENDPOINT_PATH_CONFLICT` 는 spec 이 *"409 `RESOURCE_CONFLICT` (세부 코드 …)"* 로 **두 층을
나눠** 적었으므로 (2)로 구현됐다. 그러나 (1)이 다수 선례라, 기준이 없으면 다음 구현자가 또 고른다.

### 변경안 (a) — `§5.3` 에 택일 기준

`details` 불릿 뒤에 소절을 하나 만든다. **개수를 쓰지 않고 기준으로 적는다.**

```markdown
#### 도메인 세부 사유를 어디에 싣는가 — top-level `code` 교체 vs `details[].code`

두 관례가 모두 실재한다. 판정 기준은 **소비자가 그 값으로 무엇을 하는가**다.

| 싣는 자리 | 쓸 때 | 선례 |
|---|---|---|
| **top-level `code` 교체** | 그 사유가 **엔드포인트의 결과 그 자체**라, 소비자가 `code` 하나로 분기하면 되는 경우. 한 요청에 사유가 **하나뿐**이다 | `DUPLICATE_NODE_LABEL` · `WORKFLOW_VERSION_CONFLICT` · `ALREADY_A_MEMBER` ([§1.9](./3-error-handling.md#19-워크스페이스-멤버-직접-추가-에러-코드-도메인-spec-참조)) · `KB_REEXTRACT_IN_PROGRESS` ([§1.8](./3-error-handling.md#18-kb--graph-rag-도메인-에러-코드-도메인-spec-참조)) |
| **`details[].code`** (top-level 은 상태 기본값 유지) | 사유가 **어느 필드/항목에 붙는지**가 정보의 일부이거나, 한 응답에 **여러 사유**가 함께 실릴 수 있는 경우 | 검증 오류 `INVALID_FIELD` · [error-codes §4.2](../conventions/error-codes.md#42-trigger-파라미터-검증-사유--봉투-errordetailscode) · `TRIGGER_ENDPOINT_PATH_CONFLICT`(`details.field='endpoint_path'`) |

- **둘을 겹쳐 쓰지 않는다** — top-level 을 특화 코드로 바꾸면서 같은 사유를 `details[].code` 에 또
  넣으면 소비자가 어느 쪽으로 분기할지 갈린다.
- 어느 쪽을 택하든 **[에러 처리 §1](./3-error-handling.md#1-에러-분류) 카탈로그에 등재**한다. 등재되지
  않은 코드는 소비자가 존재를 알 방법이 없다.
- 명명은 [error-codes 규약](../conventions/error-codes.md) 의 `UPPER_SNAKE_CASE` 를 따른다.

**`details` 의 형태는 두 가지다** — 객체와 배열 모두 유효하다.

| 형태 | 쓰임 | 예 |
|---|---|---|
| **배열** `details: [{ field, message, code }]` | 여러 항목이 각각 실패할 수 있을 때 (ValidationPipe 다중 필드) | 위 §5.3 예시 본문 |
| **객체** `details: { field, code, … }` | 단일 도메인 예외가 사유 하나를 붙일 때 | `TRIGGER_ENDPOINT_PATH_CONFLICT` (`{ field: 'endpoint_path', code: '…' }`) |

`GlobalExceptionFilter` 는 `details` 를 **그대로 통과**시키며(`http-exception.filter.ts` — 값이
있을 때만 동봉) 형태를 강제하지 않는다. OpenAPI 선언도 `type: 'object', additionalProperties: true`
로 열려 있다(`common/swagger/error-response.dto.ts`). 따라서 **형태 선택은 발행 지점의 책임**이며,
그 엔드포인트를 문서화하는 절에 어느 형태인지 적는다.
```

### 변경안 (b) — `3-error-handling.md §1` 에 카탈로그 등재

§1.9 다음에 §1.10 을 신설한다(§1.8·§1.9 와 동형 — "도메인 spec 참조" 패턴):

```markdown
### 1.10 트리거 endpointPath 충돌 세부 코드 (도메인 spec 참조)

`POST /api/triggers` · `PATCH /api/triggers/:id` 가 `(workspace_id, endpoint_path)` UNIQUE 를
위반할 때 발행한다. **top-level `code` 는 상태 기본값 `RESOURCE_CONFLICT` 를 유지**하고 세부
사유는 `details` 에 싣는다 — 어느 필드가 충돌했는지가 정보의 일부이기 때문
([API 규약 §5.3 택일 기준](./2-api-convention.md#53-에러-응답)). 정의·트리거 SoT 는
[2-trigger-list.md §3](../2-navigation/2-trigger-list.md#3-api) 이고 본 절은 공용 카탈로그 가시성 등재다.

| 세부 코드 (`details.code`) | 봉투 `code` / status | 설명 | 도메인 SoT |
|---|---|---|---|
| `TRIGGER_ENDPOINT_PATH_CONFLICT` | `RESOURCE_CONFLICT` / 409 | 동일 워크스페이스에 같은 `endpointPath` 를 쓰는 트리거가 이미 존재. `details.field='endpoint_path'` | [2-trigger-list §3](../2-navigation/2-trigger-list.md#3-api) |

> `details` 가 **객체 형태**인 사례다(배열이 아니다) — §5.3 의 형태 표 참조.
```

---

## A-4. §5.4 「검증 층」에 신규 2축 등재 + `code:` glob

`user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`(이름 축)가 **어떤 spec 의
`code:` glob 에도 안 걸린다**. 정본 게이트 `review_guard._spec_linked_changes()` 에 직접 물어
신규 4파일 중 **0건**이 spec-linked 로 판정됨을 확인했다(`10_13_23` W1, 5개 checker 중 4개가
독립 보고). 즉 **이 가드들을 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 안 문다.**

### 변경안 (a) — 검증 층 표를 4행으로, "두 검증자" 문구 제거

`2-api-convention.md §5.4 검증 층` 의 도입 문장 *"그 자리를 **두 검증자**가 나눠 맡는다"* 를
개수를 말하지 않는 문장으로 바꾸고, 표에 두 행을 더한다.

```markdown
그 자리를 **아래 검증자들이** 나눠 맡는다 — 이름이 인접하니 어느 쪽인지 먼저 가려야 한다.

| 검증자 | 무엇과 무엇을 대조하나 | 언제 | 못 보는 것 |
|---|---|---|---|
| `repo-guards/__tests__/swagger-dto-contract-guard.ts` | **선언 ↔ 선언** — `@ApiProperty` 데코레이터와 TS 타입 | 정적 (AST) | 선언이 **양쪽 다** 틀린 경우. 실제 응답 값 |
| `shared/testing/response-contract.ts` | **값 ↔ 선언** — 실 HTTP 응답과 생성된 OpenAPI 스키마 | 런타임 (e2e) | 배선되지 않은 엔드포인트 |
| `repo-guards/__tests__/user-entity-exposure-guard.ts` | **구조** — `User` 엔티티 전체를 관계로 싣는 자리를 센다 | 정적 (AST) | 엔티티를 거치지 않고 손으로 조립한 유출 |
| `shared/testing/user-secret-absence.ts` | **이름** — 응답 바디 어디에도 `User` 민감 컬럼 이름이 없다 | 런타임 (e2e) | 이름이 다른 신규 비밀 컬럼(목록에 넣어야 걸린다) |

**개수를 세지 않는다** — 축이 늘 때마다 숫자가 낡는다(이 문서가 두 번 겪었다).
```

`swagger.md §5-1` 의 *"두 검증자의 경계는 … 이 소유한다"* 도 같은 이유로
*"이 검증자들의 경계는 … 이 소유한다"* 로 바꾼다.

### 변경안 (b) — 양쪽 `code:` 에 등재

`response-contract*.ts` 가 **양쪽 문서에** 등재된 것과 같은 이유다(한쪽만 하면 다른 축의
변경이 재검토 트리거를 못 건드린다). `2-api-convention.md`·`swagger.md` **둘 다**:

```yaml
  - codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts
  - codebase/backend/src/shared/testing/user-secret-absence*.ts
```

> **glob 에 `-guard` 를 붙이지 않는다** — 붙이면 `.spec.ts` 가 빠지는데 베이스라인과 fixture
> 대조군이 사는 곳이 그 파일이다(`13_06_22` W2). 실측:
> `user-entity-exposure*.ts` → `user-entity-exposure-guard.ts` + `user-entity-exposure.spec.ts` **2/2**,
> `user-entity-exposure-guard*.ts` 는 **1/2**.
> `user-secret-absence*.ts` → `user-secret-absence.ts` + `user-secret-absence.spec.ts` **2/2**.
>
> **JSDoc 축(`dto-jsdoc-citation*.ts`)은 여기 넣지 않는다** — 이미 `review-citations.md` 에
> 등재됐고(2026-09-06), 그 가드가 강제하는 것은 응답 계약이 아니라 **주석 형태 규약**이라
> 소유자가 다르다.

---

## A-5. `User` 민감 7컬럼의 응답 노출 금지를 규약 문장으로

지금 그 불변식의 SoT 는 **코드뿐**이다 — `shared/testing/user-secret-absence.ts` 의
`USER_SECRET_KEYS` 배열. Trigger·AuthConfig 계열은 `secret-store.md §1.1` 이 규범을 세워 뒀는데
`User` 에는 대응 절이 없다.

### 어디에 적는가 — `1-data-model.md §2.1` 이다

`secret-store.md §1.1` 에 넣는 안을 **기각**한다. 그 문서의 Overview 는 스스로를 *"외부 provider
자격증명(텔레그램 bot token, webhook secret_token, notification HMAC signing secret 등)의 보관
추상화"* 로 한정한다. `User.password_hash`·2FA secret·복구 코드는 **provider 자격증명이 아니고
`secret://` 스킴에 살지도 않는다** — 그 절에 넣으면 문서의 관할을 카테고리째 넓힌다.

→ **`1-data-model.md §2.1 User`** 표 아래에 규범 블록을 두고(그 컬럼들을 열거하는 자리다),
`secret-store.md §1.1` 에는 **한 줄 상호 참조**만 남긴다.

### 변경안 (a) — `1-data-model.md §2.1` 규범 블록

```markdown
> **다음 7컬럼은 어떤 API 응답에도 실리지 않는다** (`passwordHash` · `twoFactorSecret` ·
> `totpRecoveryCodes` · `webauthnRecoveryCodes` · `emailVerifyToken` · `passwordResetToken` ·
> `emailChangeToken`). 해시·토큰이라 평문이 아니지만, 오프라인 크래킹·재설정 토큰 탈취·2FA 우회의
> 입력이 된다. 응답 DTO 에 **선언되어서도** 안 되고 바디에 실려서도 안 된다.
>
> - **컬럼 수준 `select: false` 를 쓰지 않는다** — 그 컬럼을 읽어야 하는 내부 경로(로그인 검증,
>   토큰 소비, 복구 코드 대조)가 예외 없이 `undefined` 를 받아 **조용히 오작동**한다. 같은 근거를
>   [secret-store §1.1](./conventions/secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다)
>   이 Trigger 계열에 대해 이미 적고 있다. **응답 경계에서 지운다.**
> - 시행 축은 [API 규약 §5.4 검증 층](./5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가)
>   표의 **구조 축**(`User` 전체를 관계로 싣는 자리)과 **이름 축**(응답 바디에 그 이름이 있는가)이다.
>   두 축의 목록은 코드가 SoT 이며(`shared/testing/user-secret-absence.ts`), 엔티티에 민감 컬럼을
>   추가하면 **그 배열에도 넣는다** — 이름 축은 이름으로만 걸리므로 새 이름을 저절로 알지 못한다.
> - `WebAuthnCredential`([§2.21](#221-webauthncredential))의 `public_key`·`counter` 는 이 목록에
>   **없다** — 공개키는 설계상 노출 가능하다. 목록을 "인증 관련 전부" 로 넓히지 않는 경계다.
```

### 변경안 (b) — `1-data-model.md ## Rationale` 에 결정 근거 승격

지금 `plan`·`CHANGELOG` 에만 있는 근거를 문서로 옮긴다(`10_13_23` INFO#1).

```markdown
### `User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계로 둔 이유 (2026-09-06)

`GET /api/audit-logs` 가 3필드를 광고하면서 `User` 엔티티를 통째로 내보내고 있었고
(`CHANGELOG.md`), 같은 형태가 워크플로우 버전 상세에서도 났다. 처분으로 세 안을 놓고 골랐다.

| 안 | 기각/채택 사유 |
|---|---|
| 컬럼 `select: false` | **기각 — fail-silent.** 그 컬럼을 읽는 내부 경로가 조용히 `undefined` 를 받는다. 실제로 이 저장소는 `select: false` 도 `@Exclude()` 도 쓰지 않는다(2026-09-06 전수 확인) |
| 응답 DTO 를 손으로 좁힌다 (단독) | **기각 — 다음 자리가 열린다.** 유출은 최상위가 아니라 중첩(`data.items[].user.…`)에서 났고, 새 엔드포인트마다 같은 판단을 반복해야 한다 |
| **응답 경계 투영 + 검출 2축** | **채택.** 구조 축이 "엔티티 전체를 실었다" 를, 이름 축이 "그 이름이 응답에 있다" 를 각각 본다. 전자는 선언 여부와 무관하고, 후자는 배선 여부와 무관하다 |

**두 축을 다 세운 이유**: 계약 검증자(`assertMatchesContract`)는 **배선된 엔드포인트에서만**
동작하고, 배선은 아직 전 엔드포인트에 닿지 않았다. 이름 축은 선언·배선과 독립이라 *"실수로
`passwordHash` 를 DTO 에 선언까지 해 버린"* 경우도 잡는다.
```

### 변경안 (c) — `secret-store.md §1.1` 상호 참조 한 줄

```markdown
> **`User` 민감 컬럼은 본 절이 아니라 [데이터 모델 §2.1](../1-data-model.md#21-user) 이 소유한다** —
> 같은 금지(응답 DTO 선언·바디 노출 불가)가 걸리지만 그 컬럼들은 provider 자격증명이 아니고
> `secret://` 스킴에 살지 않는다. 본 컨벤션의 관할을 그쪽으로 넓히지 않는다.
```

---

## 체크리스트

- [ ] `--spec` 게이트 BLOCK:NO 확인
- [ ] A-1 `CLAUDE.md` + `developer/SKILL.md` 동시 갱신
- [ ] A-2 `2-trigger-list.md` 4건 + `15-chat-channel.md` R-CC-10 동반 (앵커 인입 링크 전수 갱신)
- [ ] A-2-2 자매 트래커에 sort/order 구현 developer 항목 신설 (`pending_plans` 대상 실재화)
- [ ] A-3 `2-api-convention.md §5.3` + `3-error-handling.md §1.10`
- [ ] A-4 §5.4 검증 층 4행 + `swagger.md §5-1` 문구 + 양쪽 `code:` 2줄
- [ ] A-5 `1-data-model.md §2.1` 규범 + `## Rationale` + `secret-store.md §1.1` 상호 참조
- [ ] 자매 트래커(`spec-draft-nullable-notation-followups.md`) 체크박스 5건 플립
- [ ] `--impl-done` 재실행 (scope 에 편집한 spec 이 실제로 들어가는지 확인)
