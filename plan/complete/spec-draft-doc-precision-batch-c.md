---
title: 배치 C — 문서 정밀도 5건. 그중 둘은 항목이 지목한 것보다 대상이 넓었다
worktree: spec-doc-precision-batch-c-d9b990
started: 2026-09-10
owner: planner
status: complete
priority: P2
spec_impact:
  - spec/1-data-model.md
  - spec/2-navigation/2-trigger-list.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/3-error-handling.md
  - spec/conventions/review-citations.md
  - spec/conventions/swagger.md
---

# 배치 C — planner 턴 draft

`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 planner 항목 **5건**. 세 개는
배치 A·B(`#1299`·`#1300`)가 등재한 것이고 둘은 2026-09-05 등재분인데 **같은 파일을 겨눈다** —
한 턴에 묶어 `--spec` 을 한 번만 태운다.

**착수 전 재판정 (2026-09-10)**: `origin/main` = `aa15503c7`(#1300). 다섯 항목 전부 유효.
개별 재판정은 각 항목에 적었다.

> **두 항목은 지목된 것보다 대상이 넓었다.** C-4 는 1 → **6**, C-5 는 1 → **3**. 둘 다 이
> 저장소가 *"정의를 한 칸 좁게 잡는다"* 로 기록해 둔 형태이고, C-4 의 넓어진 부분에는
> **내가 이틀 전에 만든 가드**가 들어 있다.

---

## C-1. "쿼리 범위 `select` 투영" 을 `1-data-model.md ## Rationale` 에 등재

**재판정 (2026-09-10)**: `1-data-model.md:962-966` 의 세 선택지 표가 그대로 있고 네 번째 행은
없다. 항목 유효.

`#1299` 가 넣은 표는 세 안(컬럼 `select: false` 기각 / 응답 DTO 손질 단독 기각 / 응답 경계 투영
+ 검출 2축 채택)을 적는다. 그런데 실제로 두 번 쓰인 패턴은 그 셋 중 어느 것도 아니다 —
`WorkflowVersionsService.findOne`(#1292)과 `WorkspacesService.listMembers`(#1300)의
**쿼리 범위 `select` 투영**이다.

**왜 등재해야 하나**: 표 1행이 *"컬럼 `select: false` — 기각"* 이라 적으므로, 코드 주석 이력을
못 본 다음 검토자는 `select: { user: {…} }` 를 보고 **기각된 대안의 재도입**으로 오판할 수 있다.
`--impl-done` 이 이 지적을 **3라운드 연속** 냈다(`13_22_38`·`14_01_57`·`14_29_13`).

### 변경안 — 채택 행의 하위 각주로, 별 행이 아니라

```markdown
| **응답 경계 투영 + 검출 2축** | **채택.** 구조 축이 *"엔티티를 통째로 실었다"* 를, 이름 축이 *"그 이름이 응답에 있다"* 를 각각 본다 |

> **채택안의 구현 형태는 "쿼리 범위 `select` 투영" 이다 — 1행의 기각된 안과 이름이 비슷하니
> 갈라 둔다.** 실제 코드는 `select: { creator: { id, name, email } }` 처럼 **그 쿼리 하나**의
> 컬럼을 좁힌다. 1행이 기각한 것은 **엔티티 전역** `@Column({ select: false })` 이고, 둘은
> 이름만 닮고 성질이 반대다:
>
> | | 기각된 것 | 채택된 것 |
> |---|---|---|
> | 적용 범위 | 엔티티 컬럼 선언 — **모든 쿼리** | `find`/`findOne` 옵션 — **그 쿼리 하나** |
> | 다른 내부 경로 | 값을 읽는 경로가 `undefined` 를 받는다(fail-silent) | 건드리지 않는다 |
>
> 사례 둘: `WorkflowVersionsService.findOne`(`CREATOR_PROJECTION`) ·
> `WorkspacesService.listMembers`. **후자는 전환하자 `user-entity-exposure-guard` 의
> 화이트리스트에서 빠졌다** — 그 래칫이 양방향이라, 목록에서 사라지는 것이 전환의 기계적
> 증거다.
```

**별 행으로 넣지 않는 이유**: 표는 *"세 안을 놓고 골랐다"* 는 **당시의 선택지 집합**이다.
네 번째 행을 더하면 *"넷을 놓고 골랐다"* 가 되어 이력이 사후 편집된다. 채택 행의 하위 각주가
"채택안이 코드에서 어떤 형태인가" 를 적는 자리다.

## C-2. `§2.8` `notification_secret_v2` 행이 저장 형태를 안 적는다

**재판정 (2026-09-10)**: `1-data-model.md:250` 이 여전히 *"rotation 기간 동안 사용되는 신규
secret"* 만 적는다. 자매 행(`chat_channel_token_v2`, 255행)은 *"신규 bot token **reference**"*
라고 저장 형태를 명시한다 — **서술 밀도가 비대칭**이고, 그 비대칭 자체가 §R-K 가 경고하는
semantic 혼동의 입구다. 항목 유효.

`secret-store.md:52` 의 비대상 등재가 이미 답을 갖고 있다 — *"grace 동안의 신규 secret 은
`Trigger.notification_secret_v2` 컬럼에 **평문으로** 두고, 승격 시 canonical ref 를 회전한다"*.

### 변경안

```markdown
| notification_secret_v2 | Text? | Secret rotation 기간 (24h grace) 동안 사용되는 신규 secret — **`secret://` 가 아니라 컬럼에 평문**으로 둔다 (NOT NULL 이면 `config.notification.signing.secret` 와 둘 다 검증). 저장 형태의 근거·조건은 [secret-store §1 비대상 등재](./conventions/secret-store.md#1-uri-scheme) (승격 시 컬럼은 `null` 로 비워진다). 자매 행 `chat_channel_token_v2` 는 **reference** 라 등급이 다르다 — [§R-K](./5-system/15-chat-channel.md#r-k-chat_channel_token_v2-컬럼-명명의-semantic-비대칭) |
```

**노출 금지는 여기 다시 적지 않는다** — [§1.1](../../spec/conventions/secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다)
이 소유하고 `#1300` 이 그 창이 닫혔음을 이미 정정했다. 저장 형태만 적는다.

## C-3. `§5.4` 의 `swagger.md` 인용이 한 절 앞을 가리킨다

**재판정 (2026-09-10)**: `2-api-convention.md:228` 이 `swagger.md#1-3-optional-필드` 를 인용한다.
`swagger.md:81-88` 의 §1-3 은 **`@ApiPropertyOptional({ enum, default })` 예시 하나**뿐이고
`nullable` 도 키-생략도 나오지 않는다. 항목 유효.

정작 §5.4 가 인용으로 뒷받침하려는 판단 — *"`null` 필드에 `@ApiPropertyOptional` 을 쓰지
않는다"* — 의 근거와 예시는 **§1-4**(`swagger.md:110-116` 블록쿼트)에 있고, 그 블록쿼트는
*"부재 표현 판정과 선언 형태의 SoT: API 규약 §5.4"* 로 **역방향 링크**를 건다. 즉 역방향은
정확한데 정방향만 어긋나 있다.

**깨진 링크는 아니다** — 앵커는 실재 heading 에 착지한다. `spec-links` 가드가 초록인 이유다.

### 변경안 — 둘을 병기한다

```markdown
- DTO 선언이 wire 를 반영해야 한다 ([Swagger 규약 §1-3](../conventions/swagger.md#1-3-optional-필드) 선언 형태 · [§1-4](../conventions/swagger.md#1-4-nested--enum--union) `nullable` 판단 근거):
```

**§1-4 로 갈아치우지 않는 이유**: 아래 두 불릿이 `@ApiPropertyOptional()` 형태와
`@ApiProperty({ nullable: true })` 형태를 **둘 다** 규정한다. 전자의 표준 예시는 §1-3 에,
후자의 근거는 §1-4 에 있으므로 한쪽만 가리키면 반대쪽 불릿이 근거를 잃는다.

## C-4. 래칫 대조군 `code:` 등재 — **항목은 1개, 실측은 6개**

**재판정 (2026-09-10)**: 항목은 `optional-nullable.fixture.ts` 하나를 지목하고 처방을
*"`fixtures/**` 를 추가한다"* 로 적었다. 정본 게이트
(`review_guard._spec_linked_changes()`)에 직접 물었다:

```
fixture 5개 → 0/5 spec-linked
가드 본체 13개 → 9/13 (미등재: endpoint-path-conflict-wrap-guard.ts · .spec.ts ·
                        production-build-devdep-guard.ts · .spec.ts)
```

**셋은 내가 만든 것이다** — `endpoint-path-save.fixture.ts` 와
`endpoint-path-conflict-wrap*.ts` 는 `#1300`(이틀 전), `user-*.fixture.ts` 는 `#1292`.
`#1299` 의 A-4 가 *"가드가 미등재라 약화·삭제해도 게이트가 안 문다"* 를 고쳤는데, 그 직후
**세 번째 가드를 만들며 같은 자리를 다시 비웠다.**

### 변경안 — `fixtures/**` 한 줄이 아니라 소유 문서별 정밀 glob

`spec-impl-evidence.md` 가 *"넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지
않는 것과 같다"* 고 적는다. `fixtures/**` 는 소유자가 다른 대조군까지 한 문서에 끌어온다 —
`jsdoc-citation.fixture.ts` 의 소유자는 `review-citations.md` 다.

| 등재할 문서 | 추가할 `code:` 항목 | 무엇의 대조군인가 |
|---|---|---|
| `2-api-convention.md` + `swagger.md` (둘 다) | `…/fixtures/dto/responses/optional-nullable*.ts` | `swagger-dto-contract*.ts` (그 가드가 양쪽 등재) |
| 〃 | `…/fixtures/user-eager-relation*.ts`<br>`…/fixtures/user-relation-load*.ts` | `user-entity-exposure*.ts` (〃) |
| `review-citations.md` | `…/fixtures/dto/responses/jsdoc-citation*.ts` | `dto-jsdoc-citation*.ts` |
| `2-navigation/2-trigger-list.md` | `…/repo-guards/__tests__/endpoint-path-conflict-wrap*.ts`<br>`…/fixtures/endpoint-path-save*.ts` | 그 가드 + 대조군 |

**`2-trigger-list.md` 가 소유자인 근거**: 그 가드가 강제하는 계약(*"409 `RESOURCE_CONFLICT`
+ `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`"*)의 SoT 가 `2-trigger-list.md:96·166` 이고,
`3-error-handling.md §1.10` 은 스스로를 *"공용 카탈로그 가시성 등재"* 라 적으며 그쪽을 SoT 로
가리킨다. 양쪽 등재는 하지 않는다 — `response-catalog` 축과 달리 이 가드는 **한 규칙**만
강제한다.

> **glob 폭**: `-guard` 를 붙이지 않는다. `endpoint-path-conflict-wrap*.ts` 는 가드 본체 +
> `.spec.ts` **2/2** 를 덮고, `-guard*` 는 1/2 다 (`#1299` 가 같은 함정을 기록해 뒀다).

### `production-build-devdep*` 는 등재하지 않는다 — 소유할 spec 이 없다

실측: `tsconfig.build.json`·`dist`·`devDependency` 를 언급하는 spec 파일 **0건**
(`grep -rln` 전수). 그 가드가 강제하는 것은 제품 계약이 아니라 **빌드 위생**이다.

`spec-impl-evidence.md §2.1` 은 *"시행 코드가 없는 순수 문서형 convention"* 의 반대 경우 —
**시행 코드는 있는데 규약 문서가 없는 축** — 을 다루지 않는다. 억지로 주인을 만들면 그 문서의
관할을 카테고리째 넓히게 되므로, 별 항목으로 트래커에 등재한다(택일: 규약 문서 신설 /
`spec_impact` 밖 축으로 성문화 / 현행 유지).

## C-5. `requestId` 예시가 UUID 가 아니다 — **항목은 §2.1, 실측은 3곳**

**재판정 (2026-09-10)**: `3-error-handling.md` 의 `req_abc123` 는 **세 곳**이다 —
`265`(§2.1 기본 형식) · `284`(§2.2 실행 에러 형식) · `475`(§6.2 로그 형식). 항목은 §2.1 만
지목했다.

정본은 `2-api-convention.md:175` 의 `f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b` 이고
`12-webhook.md:302` 도 같은 값을 쓴다. 구현은 `uuidv4()` (`GlobalExceptionFilter`).

### 변경안 — 세 곳 모두 정본 값으로

세 자리의 `"req_abc123"` → `"f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b"`.
**같은 값을 쓴다** — 예시마다 다른 UUID 를 쓰면 "이 값에 의미가 있나" 라는 질문을 만든다.
`12-webhook.md` 가 이미 정본 값을 재사용하는 선례다.

> **`14-external-interaction-api.md:340` 의 `"3f2a…"` 는 건드리지 않는다 — 측정하고 제외했다.**
> 그것은 다른 **형식**이 아니라 UUID 접두의 **생략 표기**다(줄임표). 이 항목이 막으려는 것은
> *"소비자가 `req_` 접두 스키마를 기대한다"* 이고 `3f2a…` 는 그 오해를 만들지 않는다.
> EIA 문서의 예시 밀도 관례(좁은 표 안의 축약)를 여기서 바꾸지 않는다.

§6.2(로그 형식)도 포함하는 이유: 그 필드는 API 응답의 `requestId` 와 **같은 상관관계 id** 다
(`GlobalExceptionFilter` 가 발급한 값이 로그로 흐른다). 형식이 갈리면 로그↔응답 대조가
"같은 필드인가" 부터 의심된다.

---

## 체크리스트

- [x] `--spec` 게이트 BLOCK:NO 확인 (`review/consistency/2026/09/10/10_23_42` — Critical 0,
      WARNING 1). 그 WARNING 은 **자매 plan 이 같은 항목을 독자적으로 들고 있다**는 것이었고,
      C-2 실행에서 함께 닫아 그 plan 을 `plan/complete/` 로 이관했다.
- [x] C-1 `1-data-model.md ## Rationale` 채택 행 하위 각주 (별 행 아님 — 사유는 위 §C-1)
- [x] C-2 `1-data-model.md §2.8` 저장 형태 명시 + 링크 + 자매 plan 동기화·이관
- [x] C-3 `2-api-convention.md §5.4` §1-3·§1-4 병기 (갈아치우지 않은 사유는 위 §C-3)
- [x] C-4 `code:` 등재 — 4개 문서, 6개 항목. **게이트 재질의 결과 예측과 일치**:
      fixture **0/5 → 5/5**, 가드 **9/13 → 11/13**. `review-citations.md` 선례를 따라
      `# 대조군(negative fixture) — …` 인라인 주석 부기 (`10_23_42` INFO#3).
      draft 표의 `…/` 축약은 전체 경로로 펼쳤다 (`10_23_42` INFO#2).
- [x] C-4 `production-build-devdep*` 소유자 부재를 트래커에 별 항목으로 등재 (택일 3안, (b) 권고)
- [x] C-5 `3-error-handling.md` **3곳** `requestId` 정본 값으로 (EIA `"3f2a…"` 는 측정·제외)
- [x] 문서 가드 `npx vitest run src/lib/docs/__tests__` → **21 files / 3,201 tests GREEN**
      (앵커 무결성 · `code:` 경로 실재 · frontmatter 스키마 · Gate C · `pending_plans`).
      한 번 RED 였다 — 이 draft 의 산문 링크가 `./conventions/…` 라 `plan/in-progress/`
      기준으로 깨졌다. spec 편집 쪽은 처음부터 전부 초록이었다.
- [x] 자매 트래커 체크박스 **5건** 플립 + 신규 1건 등재 → **26 → 22 open** (실측)
- [x] `--impl-done` — **대상 아님.** 추정하지 않고 정본 게이트에 물었다:

      ```
      review_guard.evaluate_review(<worktree>)
        → blocked = False
        → reason  = "no codebase/ changes on this branch — allowed"
      ```

      이 브랜치의 `codebase/**` diff 는 **0줄**이다(spec·plan 만). SPEC-CONSISTENCY 게이트는
      `codebase/**` 변경이 있을 때만 발화하므로 발화 조건 자체가 성립하지 않는다 — `#1299`
      (배치 A)와 같은 상황이다. 체크리스트에 *"spec 편집이 있으므로"* 라고 적어 둔 것은 **게이트
      발화 조건을 spec 쪽으로 오해한 것**이고, 실제 조건은 코드 변경이다.
