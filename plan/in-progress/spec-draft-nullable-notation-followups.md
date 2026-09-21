---
title: nullable 표기 후속 3건 — 데이터 모델 오기·auth 명명 예외·§5.4 자기모순
worktree: plan-in-progress-items-b0c80b
started: 2026-09-04
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/1-data-model.md
  - spec/data-flow/10-triggers.md
  - spec/5-system/2-api-convention.md
  - spec/conventions/swagger.md
  # 아래 셋은 본문 항목이 정정을 요구하는 파일 — 빠지면 `--spec`/`--impl-done` 번들
  # 스코프에서 누락된다 (`review/consistency/2026/09/06/16_29_00` INFO#2).
  - spec/2-navigation/2-trigger-list.md
  - spec/2-navigation/3-schedule.md
  - spec/5-system/15-chat-channel.md
  - spec/conventions/review-citations.md
  - spec/conventions/spec-impl-evidence.md
  - spec/conventions/secret-store.md
  # 신규 항목 「중앙 카탈로그에 chat-channel rotate 코드군이 없다」의 편집 대상.
  # **내 검증 스크립트가 이걸 놓쳤다** — 본문에 `spec/` 접두 없이 `3-error-handling.md` 라
  # 적었고 스캐너가 `spec/…` 만 찾았다. 검증 명령이 주장보다 좁았던 사례.
  - spec/5-system/3-error-handling.md
  # 아래 넷은 **내 턴이 만든 게 아니라 사전 존재 갭**이다 — 검증기를 bare 파일명까지 보게
  # 넓히자 드러났다(종전 스캐너는 `spec/…` 전체 경로만 봤다). 각각 소속 항목의 **처방이
  # 그 파일을 고치라고 말한다**:
  #   1-auth.md          ← 「telegram inbound-signing 재발급이 §4.1 카탈로그 밖이다」
  #   error-codes.md · 4-execution-engine.md · 6-websocket-protocol.md
  #                      ← 「"에러 코드 어휘 규약" vs "명명 규율" — 세 문서 표현 통일」
  - spec/5-system/1-auth.md
  - spec/conventions/error-codes.md
  - spec/5-system/4-execution-engine.md
  - spec/5-system/6-websocket-protocol.md
  # **세 번째 재발이다** (2026-09-13 · `--impl-done`
  # `review/consistency/2026/09/13/21_19_52` plan_coherence WARNING#3). 신규 항목
  # 「spec 6파일이 CONTAINER_* 를 «코드» 로 적는다」가 겨냥하는 6개 중 **5개가 빠져 있었다**
  # — `4-execution-engine.md` 만 위에 이미 있어서 «있다» 로 읽었다. 위 두 주석이 같은 실패를
  # 이미 두 번 자백하는데도 같은 자리를 또 밟았다. 항목을 등재할 때 **그 항목의 «대상 파일
  # 전수» 를 이 목록과 대조하는 것**이 절차여야 한다.
  - spec/3-workflow-editor/2-edge.md
  - spec/3-workflow-editor/0-canvas.md
  - spec/4-nodes/1-logic/0-common.md
  - spec/4-nodes/1-logic/7-map.md
  - spec/4-nodes/1-logic/9-foreach.md
  # **`4-integration.md` 는 의도적으로 넣지 않았다** — 그 항목(`consecutiveNetworkFailures`
  # 노출 중단 **검토**)의 결정 대상은 DTO 필드이고, §9.1 캐비엇 수정은 결정이 "중단" 으로
  # 기울 때만 따라오는 **하류**다. 조건부 대상을 넣으면 이 목록이 "이 plan 이 건드리는 파일" 이
  # 아니게 된다. 판단을 적어 침묵과 구분한다.
  # 본문 「… 귀속 표기가 부정확해졌다」 항목이 정정을 요구하는 두 파일(그 항목이 **2곳 한정**이라고
  # 범위까지 적고 있다). 같은 실패 모드를 이 파일이 이미 한 번
  # 겪었다 (`review/consistency/2026/09/06/16_29_00` INFO#2 — 소급 등재로 고쳤다) —
  # 재발 원인은 **항목을 추가할 때 frontmatter 를 함께 보지 않는 것**이다.
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/4-nodes/7-trigger/providers/discord.md
  # 「… 귀속 표기 3곳이 T2 이동으로 낡는다」 항목의 나머지 두 파일.
  # **같은 세션에서 같은 실패를 두 번 했다** — 위 두 줄을 넣을 때 frontmatter 를 열었는데,
  # 그 뒤에 3파일을 지목하는 **새 항목**을 추가하면서 그중 하나(`secret-store.md`)만 이미
  # 있다는 걸 확인하고 넘어갔다. "항목을 넣을 때 frontmatter 를 본다" 는 산문 규율이
  # **항목 단위로는 지켜지고 파일 단위로는 안 지켜진다.**
  # (`--impl-done` `review/consistency/2026/09/11/19_41_52` W1.)
  - spec/conventions/chat-channel-adapter.md
  - spec/data-flow/14-chat-channel.md
---

# nullable 표기 후속 3건 (planner 턴)

> 출처: `entity-nullable-column-type-mismatch.md` 가 developer 권한 밖으로 남긴 3건.
> 세 건 모두 **developer 가 실측으로 발견했으나 `spec/` 쓰기 권한이 없어** 이월된 것이다.
>
> **`--spec` 검토(`09_34_59`) 반영 완료** — BLOCK: NO · WARNING 7건을 전부 처리했다. 그중
> **W5 는 내 실측을 반박했고 맞았다**(아래 ③). `spec_impact` 에 `swagger.md` 를 추가한 것도
> 그 검토(W1, 3개 checker 중복 지적)의 결과다.

---

## ① `spec/1-data-model.md` §2.9 — `next_run_at` 이 non-null 로 표기돼 있다

### 실측

| | 값 |
|---|---|
| 마이그레이션 (`V001:168`) | `next_run_at TIMESTAMPTZ` — **NOT NULL 없음** |
| 엔티티 (`schedule.entity.ts:42`) | `nextRunAt: Date \| null` |
| spec §2.9 (`:260`) | `next_run_at \| Timestamp` — **`?` 없음** |
| 바로 아래 `last_run_at` (`:261`) | `Timestamp?` — 같은 표에서 표기가 갈린다 |

**NULL 이 실제로 쓰이는 경로 2곳** (코드 실측):

- `schedule-runner.service.ts:189-190` — 실행 직후 다음 tick 재계산에서
  `CronExpressionParser.parse` 가 던지면 `catch { schedule.nextRunAt = null; }`
- `schedules.service.ts:241` — cron/timezone 수정 시 `computeNextRuns` 가 빈 배열이면 `null`

### 변경안 (A) — §2.9 표기 정정

```
| next_run_at | Timestamp? | 다음 실행 예정 시각. cron 파싱 실패 시 NULL — 발사는 BullMQ job scheduler 가 하므로 NULL 이어도 실행에는 영향이 없다 ([data-flow §3.2](./data-flow/10-triggers.md)) |
```

### 변경안 (B) — §3 인덱스 전략의 stale 서술 정정 (`--spec` W4)

`:913` 이 `(next_run_at, is_active)` 인덱스의 용도를 **"스케줄러 다음 실행 대상 조회"** 로
적는다. 그 서술은 **폴링 아키텍처를 전제**하는데 지금은 BullMQ job scheduler 가 발사한다.

**실측**: 인덱스는 DB 에 실재한다(`V002__indexes.sql:30` `idx_schedule_next_run`).

> ⚠️ **이 자리에 처음 적은 "`nextRunAt` 으로 조회하는 코드가 0건" 은 틀렸다** (2026-09-04
> 재실측). `schedules.service.ts:119` 가 `next_run_at` 을 **정렬 화이트리스트**에 올려 두고
> `qb.orderBy(this.resolveOrderBy(sort), …)`(`:96`)가 `ORDER BY s.next_run_at` 을 실제로
> 낸다. 처음 grep 이 `where|order` 를 `next_run_at` 과 **같은 줄**에서 찾았는데, 매핑
> 테이블과 `orderBy` 호출이 떨어져 있어 못 봤다.
>
> **위 spec 서술("스케줄 목록의 정렬·필터 (UI 조회용)")은 맞다** — 틀린 것은 그 아래 실측
> 문장이고, 그것이 아래 후속 항목의 전제를 오염시켰다.

용도 서술을 실제에 맞춘다:

```
| Schedule | (next_run_at, is_active) | 스케줄 목록의 "다음 실행" 정렬·필터 (UI 조회용). **발사 경로가 아니다** — 발사는 BullMQ job scheduler 가 한다 ([data-flow §3.2](./data-flow/10-triggers.md)) |
```

> **인덱스 자체를 없애자는 제안이 아니다.** 조회처가 0건이라 후보이긴 하나 DROP 은
> 마이그레이션이라 developer 결정이다. 여기서는 **문서가 거짓 용도를 적지 않게** 하는 데서
> 멈추고, 아래 §후속에 등재한다.

### 변경안 (C) — `data-flow/10-triggers.md` §3.2 보강

그 절은 이미 *"`next_run_at` 은 발사 트리거가 아니라 **UI 표시용 정보성 컬럼**"* 이라고
적으므로, NULL 이 되는 조건 한 줄만 이으면 된다.

---

## ② `spec/5-system/2-api-convention.md` §2.2 — `/api/auth/*` 액션 네임스페이스 예외 부재

### 실측 — 규칙에 포섭되지 않는 경로 **22개** (`--spec` W3 반영)

§2.2 는 "리소스는 복수형 명사" 를 규칙으로 두고 **두 예외**만 명시한다
(RPC-style sub-channel action · `/api/external/*` 인증 family).

**상태 전이 액션 20개**

```
register · verify-email · resend-verification · login · login/totp
2fa/setup · 2fa/verify · 2fa/disable · logout · refresh
forgot-password · reset-password · check-email · oauth/:provider/callback
2fa/webauthn/{register,authenticate}/{options,verify} · 2fa/webauthn/recovery
2fa/webauthn/recovery-codes/regenerate
```

**read-only capability 조회 2개** — `--spec` W3 이 내 초판 실측에서 누락을 지적했다:

```
GET /api/auth/oauth/:provider              (OAuth 시작 — 리다이렉트 URL 발급)
GET /api/auth/2fa/webauthn/availability    (WebAuthn 사용 가능 여부)
```

> 초판은 "상태 전이" 만으로 예외를 썼는데 **이 둘은 상태를 바꾸지 않아 포섭되지 않았다.**
> 문구를 넓힌다.

> `/api/auth/workspaces/:id/switch` 는 **이미 RPC-style 예외에 명시**돼 있다 — 대상 아님.
> `oauth/providers` · `2fa/webauthn/credentials{,/:id}` 는 복수형 리소스라 규칙 준수다.

### 변경안 — 세 번째 예외 조항

```
| **예외 — 인증 상태 전이·capability 액션**: `/api/auth/{action}` 은 자원 CRUD 가 아니라 **인증 상태 전이**(자격 검증·세션 발급/파기·비밀번호 재설정·2FA 등록/해제)이거나 그 전이에 필요한 **read-only capability 조회**(OAuth 시작, WebAuthn 가용성)다. 전이는 조작할 "자원" 이 없거나(로그인) 자원을 노출하면 안 되므로(비밀번호 재설정 토큰) 복수형 명사로 표현할 수 없다 — 규칙 위반이 아니라 명시된 예외다. SoT: [§1 인증/인가](./1-auth.md) | `/api/auth/login`, `/api/auth/refresh`, `/api/auth/2fa/verify`, `/api/auth/oauth/:provider` |
```

> **예외명에서 "인증 family" 와 겹치는 접두를 뺐다** (`--spec` W7). 기존 예외는
> `/api/external/*` 를 가리키는 **"인증 family 전용 네임스페이스"** 이고 이번 것은
> `/api/auth/*` 다 — 표에서 나란히 읽히므로 이름이 비슷하면 오독한다.

**왜 예외로 성문화하는가** — 이 22개는 되돌릴 수 없다(공개 wire 계약이고 FE·SDK 가
의존한다). 규칙이 현실을 설명하지 못하면 다음 사람은 둘 중 하나를 한다: 규칙을 무시하거나,
지키려고 멀쩡한 경로를 바꾸거나. 예외를 적는 편이 둘 다 막는다.

---

## ③ `spec/5-system/2-api-convention.md` §5.4 — 자기 정의와 어긋나는 DTO 표기

### 지적의 요점

§5.4 는 부재 표현을 이렇게 정의한다 — `null`(키 present) = *"이 필드는 응답 계약에 **상시
존재**하며, 지금은 값이 없다"*. 그런데 DTO 선언 규칙은:

> `null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`

**`field?:` 와 `@ApiPropertyOptional` 은 "키가 없을 수 있다" 는 선언**이다. "상시 존재" 로
정의한 필드에 그것을 쓰라니 같은 절 안에서 앞뒤가 맞지 않는다.

### 취향이 아닌 근거 — 구현 실측

```
node_modules/@nestjs/swagger/.../api-property.decorator.js:52
  return ApiProperty({ ...options, required: false });
```

`@ApiPropertyOptional` 은 **`required: false` 를 내보낸다.** 현행 문면을 따르면 "상시 존재"
필드가 OpenAPI 에서 **`required: false`** 로 문서화되고, 생성기가 그 필드를 optional 로 만들어
소비자가 **키 부재 분기를 쓰게 된다.** wire 사실과 다르다.

의미상 옳은 형태는 `required: true` + `nullable: true`:

```ts
@ApiProperty({ nullable: true })
field: T | null;
```

### 저장소 실측 — **집계 기준 명시** (`--spec` W5)

> **이 표를 두 번 틀렸다.** 초판은 "70 vs 16" — 정규식이 `\(([^)]*)\)` 라 **한 줄짜리
> 데코레이터만** 잡았다. checker(W5)가 재현해 102 vs 17 을 냈고, 나는 정규식을 넓혀
> "101 vs 18" 로 고쳤다 — **그것도 틀렸다.** 2026-09-04 에 `typescript` 정본 파서로 다시 세니
> **103 vs 17** 이다. checker 쪽이 두 번째 수를 정확히 맞혔고 내가 그것을 덮어썼다.
>
> 정규식이 진 이유는 세 가지이고 전부 **중첩**이다 — ① 객체 리터럴 타입 안의 `;`
> (`{ code?: string; … } | null` 이 잘려 `| null` 이 사라짐) ② 인자 안의 `() =>` 가 만드는 `)`
> ③ `required` 를 인자가 아니라 **데코레이터 이름으로 추론**(저장소에 `@ApiProperty({required:
> false})` 가 9곳 있고 출력이 `@ApiPropertyOptional()` 과 같다). 넓히는 것으로는 안 되고
> 도구를 바꿔야 했다. 판정은 이제 `src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 가
> AST 로 한다.

**기준** (2026-09-04, AST 재측정): `codebase/backend/src/**/*.ts` 중 비-spec 전체 ·
`@ApiProperty`/`@ApiPropertyOptional` 가 붙은 **필드 선언 1,096개** 모집단 · `null` 은
**최상위 유니온 항**만 (중첩 `{ appType: 'x' | null }` 은 제외) · `required` 는 **인자가 이기고
없을 때만 데코레이터 이름**.

| 형태 | 건수 | OpenAPI 결과 |
|---|---|---|
| `@ApiPropertyOptional({nullable:true})` + `field?` | **103** | `required:false` + `nullable` — **현행 문면** |
| `@ApiProperty({nullable:true})` + `field` | **17** | `required:true` + `nullable` — **의미상 옳음** |
| `@ApiPropertyOptional()` + `field` | **8** | `required:false`, **nullable 미선언** |
| `@ApiPropertyOptional()` + `field?` | **1** | `required:false`, nullable 미선언 |
| **합계** | **129** | |

> **이 표는 계약 거짓 9곳 수정(`fix(dto)` 커밋) 적용 *전* 스냅샷이다.** 같은 세션이 곧바로 계약 거짓 9곳을 고쳐
> 분포를 바꿨다 — 적용 후는 **104 / 25 / 0 / 1**(세 번째 줄이 0 이 된 것이 이 PR 의 성과다).
>
> 날짜를 박아 둔 실측이 **같은 PR 안에서** 낡았다. 정량 기록은 "잰 시점" 의 값이지
> "PR 이 닫히는 시점" 의 값이 아니라는 것을 여기서 또 밟았다. 아래 drift 배치를 착수할
> 때는 이 수를 그대로 쓰지 말고 **AST 가드로 재측정**하라 —
> `findSwaggerContractMismatches` 가 이미 그 판정을 한다.

> **세 번째 형태(8건)는 초판이 아예 못 봤다.** `nullable: true` 가 없어 **OpenAPI 가 nullable
> 을 말하지 않는데 TS 타입은 `| null`** 이다 — 소비자는 null 이 올 수 없다고 믿는다. 표기
> 불일치가 아니라 **계약 거짓**이다.

### 변경안 — §5.4 DTO 선언 규칙을 세 갈래로

```
- DTO 선언이 wire 를 반영해야 한다:
  - **키를 생략**하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` 금지)
  - **`null` 을 쓰는(상시 존재)** 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`
  - TS 타입이 `| null` 인데 `nullable: true` 를 **선언하지 않는 것은 어느 경우에도 틀렸다** —
    OpenAPI 가 null 가능성을 감춘다.

  > `@ApiPropertyOptional` 은 `ApiProperty({ required: false })` 의 별칭이라
  > (`@nestjs/swagger` 구현) 상시 존재 필드에 쓰면 OpenAPI 가 `required: false` 로 나가
  > 위 "상시 존재" 정의와 모순된다.
```

### 변경안 (B) — `spec/conventions/swagger.md` §1-4 정본 예제 (`--spec` W1)

§1-4 의 "닫힌 union" 예제가 `@ApiPropertyOptional({ oneOf, nullable: true })` + `context?:`
로 **정정이 폐기하는 형태를 시연**한다. 3개 checker 가 독립 지목했다.

**그 필드가 상시 존재임을 확인했다** — EIA §5.3 응답 wire 형태가 `"context": { ... } | null`
이고, 같은 블록의 `durationMs` 는 아예 *"종결 전에는 null (**키는 present** — API 규약 §5.4
부재 표현)"* 이라고 적는다. 즉 `context` 는 null-present 이고 예제가 틀린 형태다.

예제를 `@ApiProperty({ oneOf, nullable: true })` + `context: … | null` 로 바꾼다.

### 마이그레이션은 **이 문서가 강제하지 않는다**

정정하면 기존 **103 + 8 = 111곳**이 새 문면과 어긋났다. **그중 8곳(계약 거짓)은 이 세션이
이미 고쳤고 잔여는 103곳이다** — 아래 후속 항목의 "104곳" 은 여기에 `llmConfigId` 정정으로
형태가 바뀐 1곳이 더해진 수다. 103곳은 *당시 규약을 정확히
지킨 것*이라 "위반" 이 아니라 **규약 변경에 따른 drift** 다. 일괄 변경은 OpenAPI `required`
를 103곳에서 동시에 바꾸는 일이라 별도 developer plan 으로 분리한다.

> **형제 plan 이 이 세션에 만든 2건** (`--spec` W6): `AuthConfigDto.ipWhitelist`(#1273) ·
> `WorkspaceInvitationDto.invitedBy`(#1274) 는 `entity-nullable-column-type-mismatch.md` 가
> **바로 이 세션에서 옛 문면대로** 만든 것이다. 둘 다 상시 존재 필드라 새 문면에서는
> `@ApiProperty({nullable:true})` + non-optional 이 맞다.
>
> **그럼에도 이 PR 에 포함하지 않는다** — 이 draft 는 `spec/` 전용(planner 턴)이고
> `codebase/` 를 건드리면 역할 경계를 넘는다. drift 배치의 **첫 두 건으로 명시 등재**해
> 그 배치가 시작될 때 가장 먼저 잡히게 한다.

> **§5.4 의 소급 면제 조항** — *"본 규칙은 앞으로 도입·변경되는 필드에 적용한다"* 은 원문
> 맥락이 *키 생략 필드의 사유 문구* 면제라 이번 건에는 **유추 적용**이다(`--spec` INFO#1).
> 정정 시 그 조항의 적용 범위를 "DTO 선언 형태" 까지 명시해 유추를 없앤다.

---

## 후속 (이 draft 범위 밖 — 등재만)

- [x] **계약 거짓 9곳** (developer, 2026-09-04). `@ApiPropertyOptional()` + `| null` 8곳
      (`background-run-response.dto.ts`) + `create-assistant-session.dto.ts` `llmConfigId`
      (반대 방향 — `nullable:true` 인데 TS 가 `string`). 재발 방지 가드
      `swagger-dto-contract.spec.ts` 를 함께 세웠다.
- [x] **§5.4 drift 배치 — 1단계: 노출 경로가 전부 검증되는 5곳 (2026-09-04).**
      `ExecutionStatusDto` 의 `result`·`error`·`durationMs`·`currentNode`·`context`.
      노출 경로가 `getStatus()` **하나뿐**이라 tsc 검증이 실제로 성립하는 유일한 묶음이다.

      **"기계화되지 않는다" 를 뒤집었다가 두 번 좁혔다.**
      1. "tsc 가 판정한다" 로 83곳을 전부 바꿨다. 도달성을 재니 **tsc 가 검사한 것은 15**뿐
         — 나머지 68은 컨트롤러가 엔티티를 그대로 반환해 DTO-typed 대입 지점이 없다.
         비-spec 오류 0건은 "전부 옳다" 가 아니라 **"대부분 검사되지 않았다"** 였다.
      2. 그 15 중 `ExecutionDto` 10곳도 되돌렸다 — 노출 경로 4개 중 1개에서만 성립한다
         (아래 2단계에 등재).

      **분류도 한 번 틀렸다**: `@Body()`/`@Query()` + 상속만 닫으면 `ImportNodeDto`·
      `SaveCanvasNodeDto`(요청 DTO 안에 **중첩된** 타입)를 놓쳐 tsc 가 54건을 냈다. 필드
      타입 참조까지 전이 폐포로 닫아 요청 21곳으로 정정했다.

- [ ] **스윕 착수 시 `find → toBeDefined → assert` 3문장을 헬퍼로 접기** (developer,
      2026-09-05 등재, `review/code/2026/09/05/13_49_54` W6). 목록 응답에서 내 것 한 건을
      집어 대조하는 패턴이 지금 **2곳**에서 반복된다. 스윕이 56개로 늘리면 그만큼 는다.

      **이번 PR 에서 만들지 않은 이유**: 지금 2곳이고, 어떤 시그니처가 맞는지는 스윕이
      실제로 어떤 형태들을 만나는지 봐야 정해진다(목록/단건/중첩 배열이 섞인다). 시작도
      안 한 스윕을 위해 API 를 먼저 굳히면 그 API 가 스윕을 규정한다. 대신 이번에
      중복의 **절반**은 이미 걷어냈다 — DTO 이름을 `DtoContract` 가 파생하므로 호출부가
      문자열을 다시 치지 않는다.

      > **메모이제이션은 스윕 1차에서 끝났다** (2026-09-05 정정). 종전 이 자리는
      > *"헬퍼를 만들 때 … 같이 검토한다"* 로 미착수처럼 적혀 있었는데, `contractForDto`
      > 는 이미 진행 중 promise 를 DTO 클래스별로 캐시한다(실패는 캐시에서 제거). 그래서
      > 호출부는 `beforeAll` 변수 없이 **한 줄**이고, 남은 것은 **헬퍼 추출뿐**이다.
      > (`20_45_39` INFO#5 — 같은 문서 안에서 "미착수" 와 "완료" 로 갈려 읽혔다.)

      **여전히 2곳이 아니다** — 스윕 1차가 배선을 18개로 늘리며 이 패턴도 함께 늘었다.
      다음에 이 항목을 열 때 **그 시점 실측치**로 다시 센다 (숫자를 지금 갱신하면 또 낡는다).

- [x] **`User` 엔티티에 컬럼 수준 방어를 둘지 결정** (developer + 보안 판단, 2026-09-05
      등재, `review/code/2026/09/05/14_39_31` W2). 감사 로그 유출은 **그 쿼리 하나**를 좁혀
      고쳤다. `User` 자체에는 여전히 마지막 방어선이 없다 — `select: false` 0건,
      `@Exclude()` 0건, 전역 `ClassSerializerInterceptor` 없음. 다음에 `User` 를 조인하는
      새 쿼리가 `leftJoinAndSelect` 를 무심코 쓰면 같은 클래스가 재발한다.

      **이번 PR 에서 하지 않은 이유 — 되돌리기 어려운 방향이고 전수 확인이 선행돼야 한다.**
      민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
      `webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`)에
      `select: false` 를 걸면 **로그인·2FA·비밀번호 재설정 경로가 전부 그 컬럼을 읽는다** —
      각 쿼리에 `addSelect` 를 빠짐없이 넣어야 하고, 하나라도 놓치면 인증이 조용히
      실패한다(값이 `undefined` 가 되지 예외가 나지 않는다). 즉 **fail-safe 가 아니라
      fail-silent 방향**이라 착수 전에 읽는 자리를 전수 열거해야 한다.

      착수 시 먼저 잴 것: 위 7컬럼을 읽는 모든 쿼리/서비스 전수 목록. 그 목록이 나온 뒤에
      `select:false` vs 전역 `ClassSerializerInterceptor`+`@Exclude()` 를 고른다.

      > **완료 (2026-09-06) — 전수 열거 후 셋째 길을 택했다.**
      >
      > 등재문이 요구한 목록을 먼저 냈다:
      >
      > | 잰 것 | 값 |
      > |---|---|
      > | 민감 7컬럼을 **읽는** 자리 | 6개 서비스 파일 **19곳** |
      > | 그 자리들이 지나는 로더 | `UsersService.findById`/`findByEmail` **공유 깔때기** |
      > | 그 깔때기의 호출 지점 | 저장소 전체 **46곳** |
      > | ~~`User` 를 통째로 싣는 자리~~ | ~~`relations:['user']` 3곳 · `leftJoinAndSelect` 0곳~~ |
      > | ~~그 3곳이 응답에 엔티티를 싣는가~~ | ~~**아니오** — 셋 다 반환 전 명시 투영~~ |
      >
      > **위 두 줄은 틀렸다** (`review/code/2026/09/06/10_13_22` Critical 1). 그 열거는
      > 관계 **이름**이 `user` 인 것만 셌다 — `User` **타입**인 관계는 `creator`·`owner`·
      > `executor` 도 있다. 타입으로 다시 세니 `WorkflowVersionsService.findOne` 이
      > `relations: ['creator']` 를 **투영 없이** 로드해 컨트롤러가 그대로 반환하고 있었다:
      > `GET /api/workflows/:wfId/versions/:versionId` 가 버전 작성자의 `User` 전 컬럼을
      > 내보내는 **살아있는 유출**이었다. 자매 메서드 `findByWorkflow` 는 처음부터 투영이
      > 있었다 — 한쪽만 옳았다.
      >
      > | 다시 잰 것 | 값 |
      > |---|---|
      > | `User` **타입** 관계 이름 (엔티티에서 파생) | `creator` · `executor` · `owner` · `user` |
      > | 투영 없이 통째로 싣는 자리 | **4곳** — 그중 **1곳이 실제 유출** |
      > | 유출 자리 | `workflow-versions.service.ts#findOne` (이 PR 이 투영 추가로 닫았다) |
      > | 나머지 3곳 | 반환 전 명시 투영 (코드 확인) — 래칫에 동결 |
      > | `@Exclude()` · `@Expose()` · `ClassSerializerInterceptor` | **각 0건** |
      >
      > **두 선택지가 실측 후 성격이 바뀌었다.**
      >
      > `select:false` — 19곳이 전부 **공유 깔때기**를 지난다. 깔때기에 `addSelect` 를 넣으면
      > 46곳이 다시 컬럼을 받아 방어가 무의미하고, 안 넣으면 로더를 "비밀 포함/미포함" 으로
      > 쪼개 19곳을 재배선해야 한다. 등재문이 예상한 대로 **fail-silent** 이고, 비용은
      > 예상보다 크다(깔때기가 하나라 국소 수정이 불가능하다).
      >
      > 전역 `ClassSerializerInterceptor` — 이 저장소는 응답 직렬화를 **한 번도 켠 적이
      > 없다**(위 0건). 도입이 곧 API 전체 wire 의 동작 변경이라, 유출 0인 현 상태를 고치려고
      > 298개 e2e 가 보는 표면 전부를 흔든다.
      >
      > **택한 것 — 원인 형태를 구조로 잡고, 결과를 이름으로 잡는다** (사용자 결정 2026-09-06):
      >
      > 1. `user-entity-exposure-guard.ts` — 두 축이다.
      >    - **호출부 축**: `User` 관계를 **투영 없이 통째로** 싣는 세 형태(`relations`
      >      배열 · `relations` 객체(0.3, 중첩·캐스트 포함) · `leftJoinAndSelect`/`inner`)를
      >      AST 로 세고, 투영해 쓰는 3곳을 양방향 래칫으로 동결. `leftJoinAndSelect` 축은
      >      **0을 유지**한다.
      >    - **엔티티 축**: `@ManyToOne(() => User, { eager: true })`. 호출부에 아무 텍스트도
      >      안 남겨 위 스캔이 **원리적으로** 못 본다. 프로덕션 0건을 계약으로 고정.
      >
      >    관계 이름 집합은 **손으로 적지 않고 `*.entity.ts` 의 타입 주석에서 파생**한다 —
      >    첫 판이 이름으로 매칭해 Critical 을 놓쳤고, 파생은 내 grep 이 놓친 `executor`
      >    까지 찾아냈다.
      > 2. `dto-jsdoc-citation-guard.ts` — 응답 DTO 의 **JSDoc 안 리뷰 인용**을 센다.
      >    그 JSDoc 은 공개 OpenAPI `description` 이 된다. 같은 위반이 세 번 났고 매번
      >    사람이 잡았다. 이미 있던 2건(아래 별 항목)은 동결.
      > 3. `user-secret-absence.ts` — 응답 본문을 깊이 훑어 7컬럼 이름의 부재를 단언.
      >    **선언과 무관**하므로 누가 비밀 필드를 DTO 에 *선언까지* 해도 잡는다 — 감사 로그
      >    유출을 놓친 것이 바로 선언 기반 검증자였다.
      >
      > 런타임 위험 0, 인증 경로 무손상, 위 두 선택지를 나중에 배제하지 않는다. **다만
      > 이것은 "방어" 가 아니라 "검출" 이다** — 실행 시점에 막지는 않는다.
      >
      > 곁가지 성과: 새 e2e 가 `GET /api/workspaces/:id/members` 의 미선언 필드
      > (`joinedAt`)를 즉시 찾아냈다. 그 엔드포인트는 응답 형태를 무는 테스트가 아예 없었다.
      > 이 배선으로 §5.4 계약 대조를 받는 DTO 가 **둘** 늘었다 (`WorkspaceMemberDto` ·
      > `WorkflowVersionDto`) — 종전 이 자리는 "하나" 라고 적었는데, 같은 브랜치가 Critical 을
      > 닫으며 버전 단건 조회 e2e 를 더하면서 둘이 됐다 (`review/code/2026/09/06/10_53_48`
      > W4). 아래 「§5.4 drift 배치 —
      > 2단계」의 수치는 다음에 그 항목을 열 때 **그 시점 실측치**로 다시 센다.
      >
      > **이 항목은 닫히지만 후속 두 건이 따라온다** — 아래 별 항목으로 등재했다. 여기에
      > 적어 두지 않으면 draft 종결 조건(`## 후속` 체크박스 전부 닫힘)이 조용히 거짓이 된다.

- [x] **신규 검출 3축을 §5.4 「검증 층」과 `code:` 에 등재** (planner, 2026-09-06 등재,
      `review/consistency/2026/09/06/10_13_23` W1 — **5개 checker 중 4개가 독립 보고**).

      `user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`(이름 축)·
      `dto-jsdoc-citation-guard.ts`(JSDoc 인용 축)가 어떤 spec 의 `code:` glob 에도 안
      걸린다. **정본 게이트에 직접 물어 확인했다** —
      `review_guard._spec_linked_changes()` 가 신규 4파일 중 **0건**을 spec-linked 로
      판정한다(재구현한 `fnmatch` 가 아니라 게이트 자신에게 물었다).

      즉 **이 가드들을 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 안 문다.**
      래칫 fixture 가 없어 술어가 죽어도 그린이었던 것과 같은 등급의 사각지대다.

      **하루 전 자매 항목이 이미 겪은 패턴의 재발**이다 — `response-contract.ts` 를
      `2-api-convention.md`·`swagger.md` **양쪽**에 등재한 그 건. 한쪽만 하면 사각지대가
      남는다는 것도 그때 실측으로 확인됐다.

      → §5.4 「검증 층」 소절에 **세 행**을 더하고, 각 문서 frontmatter `code:` 에 신규
      파일 패턴을 넣는다:

      | 축 | 파일 | 등재할 문서 |
      |---|---|---|
      | 구조 (관계 로드 형태) | `user-entity-exposure*.ts` | `2-api-convention.md` §5.4 · `swagger.md` §5-1 |
      | 이름 (응답 값 부재) | `user-secret-absence*.ts` | 〃 |
      | JSDoc 인용 | `dto-jsdoc-citation*.ts` | ~~**`review-citations.md`**~~ — **2026-09-06 집행 완료** (아래 참조) |

      **glob 은 `-guard` 를 붙이지 않는다** — 붙이면 `.spec.ts` 가 빠지는데, 베이스라인과
      fixture 대조군이 사는 곳이 그 파일이다 (`review/consistency/2026/09/06/13_06_22` W2).

      > **표 1행이 그 경고를 스스로 어기고 있었다** — 세 줄 위에서 `-guard*` 를 지시해 놓고
      > 세 줄 아래에서 그것을 금지하고 있었다 (`review/code/2026/09/06/13_39_20` W4).
      > 이 표는 다음 planner 턴이 **문자 그대로 집행할 지시문**이라, 캐비아트가 아래 있어도
      > 표를 먼저 읽으면 틀린 glob 이 그대로 들어간다. 실측 — `user-entity-exposure*.ts` 는
      > `user-entity-exposure-guard.ts` + `user-entity-exposure.spec.ts` **2/2**,
      > `-guard*` 는 1/2. `user-secret-absence*.ts` 도 `.ts` + `.spec.ts` **2/2**.
      >
      > ~~**`code:` 에 YAML 주석을 넣지 마라** — 게이트 파서가 그 줄에서 끊는다.~~
      >
      > **해소됨 (2026-09-06, `8b67300b5`)** — 파서가 빈 줄·`#` 주석·트레일링 주석·인용
      > 스칼라를 모두 처리한다. 이 문서 아래쪽 harness 항목에 실측(690→731, 갈리는 파일
      > 7→0)과 회귀 테스트가 있다. `review-citations.md` 는 실제로 인라인 주석을 쓴다.
      >
      > **캐비아트를 지우지 않고 남긴다** — 이것이 왜 한때 금지였는지가 다음 사람에게
      > 필요하다. 다만 **지금은 유효하지 않다** (`review/code/2026/09/06/16_28_58` W5 —
      > 시점이 다른 두 서술이 공존해 오도할 수 있다는 지적).

      > **JSDoc 축은 `spec-draft-review-citations-enforcement.md` 가 선행 집행했다**
      > (2026-09-06, `--spec` 게이트 `review/consistency/2026/09/06/13_18_59` BLOCK:NO).
      > `review-citations.md` 의 frontmatter `code:` 에 `dto-jsdoc-citation*.ts` 가
      > **범주 주석과 함께** 들어갔고 Rationale 도 축 단위로 정정됐다.
      >
      > **이 항목에 남은 것은 §5.4 쪽 두 축**(구조·이름)이다.

      **셋째 축은 등재할 문서가 다르다.** §5.4 가 아니라 `review-citations.md` 다 — 그 가드가
      강제하는 것은 응답 계약이 아니라 **주석 형태 규약**이기 때문이다. 그리고 그 문서의
      `## Rationale` 이 *"이 규약에는 시행하는 코드가 없다"* 고 적는데 **이제 있다**
      (`review/consistency/2026/09/06/12_53_29` Critical 1). 그 문장은 developer 가 쓴
      예고가 아니므로 자기-반증형 소정정 대상이 아니다.

      **"두 검증자" 라고 못 박은 문장이 둘 있다** — 그 표현이 이제 거짓이다:

      | 파일 | 문장 |
      |---|---|
      | `spec/5-system/2-api-convention.md` §5.4 검증 층 | *"그 자리를 **두 검증자**가 나눠 맡는다"* |
      | `spec/conventions/swagger.md` §5-1 | *"**두 검증자**의 경계는 … 이 소유한다"* |

      **새 개수를 적어 넣지 말 것.** 이 문서가 이미 두 번 겪은 실패다 — 축이 늘 때마다
      숫자가 낡는다. 표로 **나열**하고 문장은 개수를 말하지 않게 고친다.

      > **완료 (2026-09-08, 배치 A-4)**. §5.4 검증 층 표를 4행으로 넓히고 "두 검증자" 문구를
      > 개수 없는 나열형으로 바꿨다(`swagger.md §5-1` 동반). `code:` 는 **양쪽 문서에**
      > `user-entity-exposure*.ts`·`user-secret-absence*.ts` 두 줄씩 등재.
      > **기계적 증거 — 정본 게이트에 직접 물었다**: `review_guard._spec_linked_changes()` 가
      > 네 파일을 **0/4 → 4/4** spec-linked 로 판정한다.

- [x] **`CLAUDE.md` 에 harness(`.claude/**`) 수정 권한 조항이 없다** (planner, 2026-09-06
      등재, `review/code/2026/09/06/15_52_58` W1).

      Skill 표는 세 역할의 쓰기 범위를 `spec/**`·`plan/**`·`codebase/**`·`review/**` 로
      적는다. **`.claude/**` 는 어느 역할에도 배정돼 있지 않다.** 그런데 이 브랜치가
      `review_guard.py` 와 그 테스트를 고쳤다.

      **왜 고쳤는가**: `--impl-done` 게이트가 spec 387개 중 7개 파일의 41개 entry 를 조용히
      떨구고 있었고, **그중 하나가 이 PR 자신이 고치던 파일을 덮고 있었다**
      (`review/consistency/2026/09/06/13_52_23` Critical 1). 그 checker 는 처분으로
      *"파서가 `#` 주석·빈 줄을 스킵하도록 고친다(developer 권한 내, harness 코드)"* 를
      제시했다. 대안(7개 spec 파일 주석 제거)은 인스턴스를 고치고 **클래스를 남긴다.**

      **그러나 checker 는 `CLAUDE.md` 의 해석 권한이 아니다.** 나는 스스로에게 권한을
      부여할 수 없으므로 판단 근거를 남긴다:

      - 이 저장소는 harness 가드 작업 이력이 있다(`.claude/docs/` 백로그·`test_*.py` 스위트).
      - Skill 표는 **spec/plan/codebase 세 축의 역할 분담**을 정하는 표이고, harness 는
        그 축 밖이라 "금지" 가 아니라 **미기술**로 보인다.
      - 그래도 미기술을 근거로 넓히는 것은 이 브랜치가 계속 지적받은 *"문서한 보장이
        구현보다 넓다"* 의 거울상이다 — **적혀 있지 않은 권한을 행사한 것**이다.

      → planner 가 Skill 표에 harness 항목을 **명시**한다(허용이든 금지든). 금지로 정하면
      이 브랜치의 파서 수정을 되돌리고 **다른 처분**(7개 파일 스윕 + 재발 방지)을 planner
      턴으로 집행해야 하며, 그 비용 차이가 결정의 실질이다.

      > **사용자 결정 (2026-09-06)**: **파서 수정을 남긴다.** 세 선택지(남긴다+명시 /
      > 별도 PR 로 분리 / 되돌리고 spec 7파일 스윕) 중 첫째를 택했다
      > (`review/code/2026/09/06/16_28_58` Critical 1 이 결정을 요구했다).
      >
      > **따라서 이 항목에 남은 것은 코드가 아니라 `CLAUDE.md` 다.** Skill 표에 harness
      > (`.claude/**`) 행을 넣어, 다음 사람이 같은 판단을 처음부터 다시 하지 않게 한다.
      > 지금 상태는 *"관행으로는 허용, 문서로는 미기술"* 이고 — 그것이 이 브랜치가 계속
      > 지적받은 결함의 형태다.
      >
      > 분리안을 택하지 않은 이유도 남긴다: **이 PR 의 `--impl-done` 게이트가 그 파서
      > 수정에 의존한다**(수정 전에는 `workspace-response.dto.ts` 가 spec-linked 로 안
      > 잡혔다). 두 PR 로 가르면 서로를 기다리는 순환이 된다.

      > **완료 (2026-09-08, 배치 A-1)**. 사용자 결정대로 파서 수정을 남기고 문서로 명시했다.
      > harness 를 **두 축**으로 갈랐다 — 실행물(`hooks/`·`tools/`·`tests/`)은 developer,
      > 거버넌스 문서(`CLAUDE.md`·`SKILL.md`·`.claude/docs/**`)는 planner. **세 문서 동시 갱신**
      > (`CLAUDE.md` 표 2행 + 규칙 2줄, `developer/SKILL.md` 2행, `project-planner/SKILL.md` 1행) —
      > 권한을 갖는 쪽 문서에 그 권한이 없으면 이 항목이 고치려는 결함을 재생산한다.
      > 리뷰 게이트 스코프(`codebase/**`)가 harness 를 안 문다는 **비대칭도 함께 적었다.**
      >
      > **재확인 조건**: 거버넌스 축(planner 소유)은 **관례가 아니라 신설 규칙**이고 강제하는
      > 게이트가 없다. 앞으로 `fix(harness)` 커밋이 다시 `.claude/docs/**`·`SKILL.md` 를 함께
      > 고치는 것이 관측되면, 규칙을 유지할지 관례에 맞춰 되돌릴지 그 시점에 재판정한다
      > (`review/consistency/2026/09/08/11_28_04` rationale_continuity INFO#1).

- [x] **`endpointPath` 를 쓰는 다음 `save()` 가 충돌 래핑을 빠뜨릴 수 있다** (developer,
      2026-09-06 등재, `review/code/2026/09/06/19_31_04` INFO#2).

      `TriggersService` 의 `save()` 호출은 8곳인데 `rethrowEndpointPathConflict` 로 감싼
      것은 `create`/`update` **둘뿐**이다. 나머지 여섯(schedule 동기화·secret 승격·
      chatChannel 설정 등)은 `endpointPath` 를 건드리지 않으므로 지금은 옳다.

      **비대칭이 남는다** — 앞으로 `endpointPath` 를 쓰는 `save()` 가 새로 생기면 그 경로만
      미가공 500 이 된다. 지금 상태로는 **아무도 알려 주지 않는다.**

      → 두 방향 중 하나: (a) 저장 직전 `endpointPath` 변경 여부를 보는 한 자리로 모으거나,
      (b) `user-entity-exposure-guard` 처럼 *"`endpointPath` 를 쓰는 `save()` 는 래핑돼야
      한다"* 를 AST 로 세는 래칫. **(b) 가 이 저장소의 관행에 가깝다** — 화이트리스트가
      비대칭을 문서가 아니라 테스트로 들고 있게 된다.

      > **완료 (2026-09-08, 배치 B-6)** — **다만 등재된 처방의 술어는 폐기했다.**
      > 처방은 *"`endpointPath` 를 대입·갱신하는 메서드의 `save()`"* 였는데 실측하니 **두 정답
      > 사이트를 하나도 못 잡는다**: `create` 는 `create({ ...rest })`, `update` 는
      > `Object.assign(trigger, defined)` 로 **스프레드**라 두 메서드 본문에 `endpointPath` 토큰이
      > 없다. 단일 파일 AST 로는 스프레드를 못 따라가므로 그 가드는 **양성 0건 vacuous** 가 된다.
      > → 술어를 뒤집어 **모든** `triggerRepository.save()` 를 세고 *래핑됐거나 사유와 함께
      > 목록에 있거나* 를 요구한다. 미래핑 6곳은 각각 열어 무엇을 쓰는지 확인 후 등재.
      > **두 번 자기 결함을 냈다**: (1) `enclosingMethodName` 이 `const saved = …` 를 이름으로
      > 삼아 정답 두 자리가 `saved` 로 잡혔다. (2) 래핑 판정이 `.catch` **텍스트에 이름 등장**만
      > 봐서 fail-**open** 이었다(내 JSDoc 은 그것을 fail-safe 라 불렀다) — 리뷰가 잡았고
      > (`12_53_08` INFO#6) **호출식**을 요구하도록 좁혔다.

- [x] **전역 예외 필터가 `pg-error.ts` SoT 를 안 쓴다 — 가장 넓은 fallback 이 좁다**
      (developer, 2026-09-06 등재, `review/code/2026/09/06/16_58_14` W6).

      `http-exception.filter.ts` 의 로컬 `isUniqueViolation` 은 **`err instanceof
      QueryFailedError` 를 먼저 요구**한다. 그래서 raw(`err.code`) 표면으로 올라온
      23505 는 걸러져 409 가 아니라 **500** 이 된다. 이 PR 이 `pg-error.ts` 를 SoT 로
      세운 이유가 정확히 그 표면 분기인데, **국소 처리가 없는 대다수 서비스가 지나는
      fallback 에는 좁은 판이 그대로 남았다.**

      **실측한 blast radius 는 지금 ~0 이다** — 우리 스키마를 치는 raw query 가 요청
      경로에 없다(grep: `database-query.handler.ts` 는 사용자 외부 DB, `scripts/**` 는
      요청 경로 아님). 즉 **구조적 불일치이지 현재 버그는 아니다.**

      → `isPostgresUniqueViolation(err)` 호출로 교체(2줄). `http-exception.filter.spec.ts`
      에 23505 케이스가 이미 있으므로 **최상위 표면 케이스만 더하면** 회귀가 고정된다.

      **이 PR 에서 하지 않은 이유는 범위다** — `integration-oauth` 건과 같은 규율이다.
      다만 그쪽은 동작이 옳고(두 표면을 본다) 이쪽은 **좁다**는 점이 다르므로, 둘 중
      먼저 처리할 것은 이쪽이다.

      > **완료 (2026-09-08, 배치 B-3)**. `isPostgresUniqueViolation` 으로 교체(`QueryFailedError`
      > import 도 함께 사라졌다). **RED→GREEN 확인** — 새 테스트가 수정 전 500 을 받았다.
      > 짝 단언(raw 표면 23502 는 409 로 새지 않는다)도 함께 넣어 넓힌 판이 아무 에러나 409 로
      > 만들지 않는 것을 고정했다. `CHANGELOG.md` 에 동작 변경으로 등재.

- [x] **`run-test.sh` 4단계가 타입체크 ratchet 을 안 돈다** (harness, 2026-09-06 등재,
      `#1292` CI 실패로 발각).

      등재 시점의 `PROJECT.md` 4단계 표는 두 ratchet 을 *"backend/frontend `*.ts(x)`
      변경 시"* 별도 필수로 적었다. 그런데 `run-test.sh` 의 4단계(lint/unit/build/e2e)에는 **없다.** developer
      SKILL 의 TEST WORKFLOW 는 그 4단계를 강제하므로, **문서가 요구하는 검사를 워크플로가
      빠뜨린다.**

      **실제로 샜다** — `#1292` 가 14라운드 로컬 검증을 전부 통과하고 CI 에서 처음 걸렸다
      (`src/shared/testing/pg-error-fixtures.ts: 0 → 1`, TS2739).

      **원리적으로 못 보는 자리다**: `run-test.sh build` 는 `tsconfig.build.json` 을 쓰는데
      그 파일이 `src/shared/testing/**` 를 exclude 하고, jest 는 타입을 strip 한다. 즉
      *"빌드에서 제외된 자리는 아무도 안 본다"* — 이 브랜치가 내내 쫓던 클래스이고,
      `__test-utils__` dist 누출도 **같은 exclude 목록**에서 나왔다.

      → `.claude/test-stages.sh` 의 `cmd_build()`(또는 별도 5번째 단계)에 두 ratchet 을
      넣는다. **`.claude/**` 쓰기라 위 harness 권한 항목의 결정을 따른다.**

      > **완료 (2026-09-08, 배치 B-1)**. `.claude/test-stages.sh` 의 `cmd_build()` 에
      > `_cmd_typecheck_ratchets()` 를 넣었다. **`PROJECT.md` 도 함께 고쳤다** — 그 문서는 이 갭을
      > *미문서화 결함이 아니라* **문서화된 결함**으로 적고 있었으므로("wrapper 4단계 밖의 CI
      > 게이트"), 안 고치면 그 문장이 거짓이 된다. 표에서 두 행을 내리고 왜 옮겼는지를 남겼다.
      > **실측**: `run-test.sh build` 로그에 `OK: backend 타입 진단 197건 / 36파일` ·
      > `OK: frontend 타입 진단 52건 / 15파일` 두 줄이 남았다 — 배선을 추론이 아니라 실행으로 확인.

- [x] **`src/common/__test-utils__/` 5파일이 dist 로 나간다** (developer, 2026-09-06 등재,
      이번 PR 의 W3 을 고치다 발견).

      `tsconfig.build.json` 의 exclude 는 `*spec.ts` · `src/repo-guards/**` ·
      `src/shared/testing/**` 셋이다. `__test-utils__` 는 어디에도 안 걸린다 — **실측**:
      `tsc --listFiles -p tsconfig.build.json | grep __test-utils__` → **5건**
      (`source-scan.ts` · `temp-fixture.ts` · `workspace-id-fixtures.ts` 외).

      ~~**지금은 지뢰가 아니다** — 전 파일의 import 가 node 내장 + 로컬뿐이라, exclude 목록
      주석이 경고하는 형태(`require("typescript")` 같은 devDependency 지뢰)는 없다.
      **죽은 코드가 dist 에 실릴 뿐**이다.~~

      > **정정 (2026-09-08)**: 등재 시점에는 참이었으나 **같은 배치가 뒤집었다** — B-6 의 AST
      > 워커를 공용화하면서 `source-scan.ts` 가 `import * as ts from 'typescript'`
      > (devDependency)를 갖게 됐다. 이 축은 이제 첫 번째 자리(`repo-guards/**`)와 같은 등급의
      > 격리를 겸한다 (`review/consistency/2026/09/08/14_49_40` WARNING#1).

      → exclude 에 `**/__test-utils__/**` 를 더한다. 경로가 아니라 **디렉터리 이름 규약**
      으로 막으면 다음에 어디에 만들어도 걸린다 — 이번에 내가 `common/db/__test-utils__/`
      에 파일을 만들었다가 같은 함정에 빠졌고, 그때는 자리를 옮겨 회피했다.

      > **완료 (2026-09-08, 배치 B-2)**. `tsconfig.build.json` 에 `**/__test-utils__/**` 추가 +
      > `production-build-devdep.spec.ts` 에 대응 단언. **제목이 한 칸 좁았다** — 실측 5파일은
      > `common/` 3 + `modules/integrations/` 2 로 **두 디렉터리**에 흩어져 있었다. 그래서 경로가
      > 아니라 **디렉터리 이름**으로 막았다.
      > **부수 소득**: 단언을 `it.each` 로 접다가 `shared/testing` 축이 2026-08-27 에 **exclude 만
      > 추가되고 대응 단언이 없었다**는 것을 발견했다 — 그 축이 이번에 처음 생겼다.
      > **처방 사유가 배치 도중 한 등급 올라갔다** — 위 취소선 참조. exclude 가 import 보다
      > **먼저** 들어가 노출 구간은 없었고, `production-build-devdep-guard` 가 디렉터리 단위로
      > 막으므로 빌드 안전성도 그대로다. 자매 plan
      > (`auth-guard-reflection-hardening.md`)의 같은 전제도 함께 정정했다.

- [x] **`integration-oauth.service.ts` 의 손-작성 constraint 추출 2곳** (developer,
      2026-09-06 등재, `review/code/2026/09/06/16_28_58` INFO#9 — **의도적 보류**).

      신설한 `pgErrorConstraint()` 가 정확히 대체할 수 있는 패턴이 남아 있다. **실측**:
      2곳(cafe24·makeshop 설치 경로), 각각 `(err as {...})?.constraint ?? (err as
      {...})?.driverError?.constraint` 4줄, 둘 다 이미 `isPostgresUniqueViolation` 을
      import 해 쓰고 있으므로 치환은 **import 한 줄 + 표현 2개**다.

      **이 PR 에서 하지 않은 이유는 비용이 아니라 범위다.** scope reviewer 가 이 브랜치의
      관심사 확산을 반복 지적했고(4단 연쇄), 여기서 다섯 번째 모듈을 여는 것은 그 지적을
      정면으로 무시하는 것이다. 두 자리는 **동작이 옳고**(같은 두 표면을 본다) 위험이
      없다 — 남은 것은 중복뿐이다.

      → 그 파일을 다음에 건드릴 때 치환한다.

      > **완료 (2026-09-08, 배치 B-5)**. `pgErrorConstraint()` 로 치환. 리뷰가 **callsite 테스트가
      > flat 표면만 태우고 있었다**는 것을 잡아(`12_53_08` INFO#7) 두 spec 을 `it.each` 로 두 표면
      > 파라미터화했다 — 실전에서 TypeORM 이 주는 것은 wrap 된 쪽이다.
      > **뮤테이션**: `pgErrorConstraint` 를 flat-only 로 바꾸면 **정확히 새 2건만** RED.

- [x] **트리거 `endpoint_path` 409 충돌에 e2e 가 없다** (developer, 2026-09-06 등재,
      `review/code/2026/09/06/15_52_58` INFO#11).

      단위 mock 검증은 촘촘한데 **실 DB 유니크 제약을 타는 경로**가 없다. 같은 PR 의 다른
      두 갈래(`WorkflowVersions`·`WorkspaceMember`)는 e2e 를 보강했으므로 형평이 어긋난다.

      → `webhook-trigger.e2e-spec.ts` 에 중복 `endpointPath` 생성 시도 1건 —
      409 + `code` + `details` 두 키 단언. 단위 테스트가 mock 하는 드라이버 형태가
      **실제와 같은지**를 이 케이스만 확인할 수 있다(그것이 mock 의 사각지대다).

      > **완료 (2026-09-08, 배치 B-7)**. `webhook-trigger.e2e-spec.ts` 에 `B4.` 1건 — 409 + 봉투
      > `code` + `details` **두 키를 함께** 단언(하나만 보면 `details` 를 통째로 잃어도 초록이다).
      > 계약 SoT 는 `#1299` 가 세운 `3-error-handling.md §1.10`.
      > **실행 확인**: 스위트 PASS + `300 passed, 300 total`(skipped 0) + 파일에 `.skip`/`.only`
      > 없음 — 요약 숫자만 보지 않고 실제 실행을 확인했다.

- [x] **`listMembers` 를 DB 레벨 투영으로 옮겨 구조 가드 보호 범위에 넣는다**
      (developer, 2026-09-06 등재, `review/code/2026/09/06/15_30_59` W1 —
      여러 라운드가 반복 지적).

      지금은 `relations: ['user']` 로 `User` 전 컬럼을 싣고 **JS 단 수동 매핑**으로
      좁힌다. `user-entity-exposure-guard` 는 **로드 형태**만 보므로 이 자리는 보호
      범위 밖이고, 방어가 **검출**(단위 테스트 2건 + e2e `workspace-rbac` J.)이지
      **강제**가 아니다.

      → `select: { user: { id: true, email: true, name: true } }` 로 전환하면
      `WorkflowVersionsService.findOne` 과 같은 등급이 되고, 화이트리스트
      `EXPECTED_USER_RELATION_LOADS` 에서 이 항목이 **빠진다**(래칫이 양방향이므로
      목록에서 지워야 통과한다 — 그것이 전환 완료의 기계적 증거다).

      **이 PR 에서 하지 않은 이유**: `listMembers` 는 원래 목표(유출 차단) 밖이고
      응답은 이미 안전하다. DB→앱 전송 낭비와 *"가드가 못 지킨다"* 는 구조적 사실만
      남는데, 그것을 이번 라운드에 단위 테스트로 고정했다.

      > **완료 (2026-09-08, 배치 B-4)**. **예고된 기계적 증거가 그대로 나왔다** — 전환하자
      > `user-entity-exposure-guard` 가 이 자리를 더는 찾지 못해 화이트리스트 단언이 깨졌고,
      > 항목을 지워야 통과했다. 가드 헤더의 *"`listMembers` 는 JS 단 매핑이라 이 가드는 초록"*
      > 표 행도 이제 거짓이라 함께 정정했다.
      > **단위 단언을 하나 더 세웠다** — 반환 키만 보면 **투영을 되돌려도 초록**이다. 뮤테이션으로
      > 확인: `select` 를 지우면 새 단언 **1건만** RED, 반환 키 단언은 초록으로 남는다.
      > **쿼리 범위 투영 ≠ 엔티티 전역 `select: false`** — 후자는 `1-data-model.md ## Rationale`
      > 이 기각했다. 그 구분을 Rationale 표에 정식 등재하는 것은 위 planner 항목으로 신설했다.

- [x] **`2-trigger-list.md` R-2 가 폐기된 설계를 유효한 것처럼 남기고 있다** (planner,
      2026-09-06 등재, `review/consistency/2026/09/06/15_31_00` W1).

      R-2 는 `hmacSecret` 의 "입력 변경(v1) vs rotate 액션(v1.1)" 분리를 근거로 적고
      `POST /api/triggers/:id/auth/rotate-secret` 를 v1.1 API 로 예고한다. 그런데 **같은
      문서 §3 각주가** *"과거 v1.1 예약 행 `POST /api/triggers/:id/auth/rotate-secret` 은
      신설되지 않은 채 본 PR 에서 폐기됐다 (Rationale R-14)"* 라고 적는다 — 한 문서 안에서
      자기모순이다. (실측: R-2 는 226행, 폐기 각주는 §3 블록쿼트.)

      **파급이 문서 밖으로 나간다** — `spec/5-system/15-chat-channel.md` R-CC-10(610행)이
      R-2 를 **현재 유효한 설계**로 인용하며 botToken single-path 결정의 대조군으로 쓴다.
      R-2 를 고치면 그 인용도 "과거(폐기된) 설계" 로 함께 갱신해야 한다.

      → R-2 본문에 취소선 + `> **정정 (날짜)**: authConfigId 단일 경로로 대체됨 — R-14 참조`
      콜아웃. `15-chat-channel.md` R-CC-10 의 인용 문구 동시 갱신. **두 파일 같은 턴에.**

      > **완료 (2026-09-08, 배치 A-2-1)**. R-2 제목에 `(폐기 — R-14 로 대체)` + 정정 콜아웃,
      > 본문 전체 취소선 보존. `15-chat-channel.md` R-CC-10 인용을 같은 커밋에서 갱신했다 —
      > 앵커가 바뀌므로. **인입 실측**: `grep -rn "r-2-webhook-hmac-secret" spec` → R-CC-10 **1건뿐**.
      > 앵커 해소는 `spec-link-integrity` 가드가 확인(3,195 tests GREEN).

- [x] **`2-trigger-list.md` frontmatter `status` 가 본문의 자백과 모순** (planner,
      2026-09-06 등재, `review/consistency/2026/09/06/15_31_00` W3).

      frontmatter 는 `status: implemented` 인데 본문 §3(151행)이 *"`PaginationQueryDto` 가
      `sort`/`order` 를 받긴 하나 `findAll` 은 이를 무시하고 `created_at DESC` 로 고정
      정렬한다. sort/order 반영은 **미구현/Planned**"* 라고 적는다.
      `spec-impl-evidence.md §3` 라이프사이클 위반이다.

      → `status: partial` + `pending_plans:` 등재, **또는** sort/order whitelist 정렬을
      구현하고 현행 유지. 자매 문서 `3-schedule.md` 가 전자의 선례다.

      > **부분 완료 (2026-09-08, 배치 A-2-2)** — `status: partial` + `pending_plans` 로 현 상태를
      > 정직하게 적었다. **등재된 선례 주장은 틀렸다**: `3-schedule.md` 는 `status: implemented`
      > 이고 `pending_plans` 가 없다 — 그쪽은 **구현으로** 표기를 뗐다(Rationale 2026-06-10,
      > `schedules.service.ts` `resolveOrderBy` whitelist). 즉 종착지는 `partial` 유지가 아니라
      > 구현이며, 그 항목을 아래에 developer 로 신설했다.


- [ ] **`GET /api/triggers` 의 `sort`/`order` 를 whitelist `orderBy` 로 구현한다** (developer,
      2026-09-08 등재, 위 A-2-2 항목이 낳은 후속).

      `spec/2-navigation/2-trigger-list.md` 는 2026-09-08 부터 `status: partial` +
      `pending_plans: [이 파일]` 이다. **이 항목이 그 포인터의 실체다** — 닫히면 그 문서를
      `status: implemented` 로 되돌리고 §3 의 *"sort/order 반영은 미구현/Planned"* 문구를
      제거한다.

      **선례를 그대로 따른다**: `schedules.service.ts` 의 `resolveOrderBy` 가 허용 값 맵
      (`allowed: Record<string, string>`)으로 `sort` 를 컬럼에 매핑하고 미허용 값은
      `s.created_at` 로 폴백한다. `3-schedule.md` Rationale(2026-06-10)이 *"Planned 해제는
      기능 약속의 번복이 아니라 구현 완료에 따른 문서 동기화"* 라고 그 처분을 이미 적었다.

      > **게이트가 이 연결을 보증하지 않는다.** `spec-pending-plan-existence.test.ts` 는
      > `fs.existsSync(in-progress) || fs.existsSync(complete)` 만 본다(2026-09-08 소스 확인) —
      > **파일 존재만** 확인하고 "그 plan 이 이 항목을 책임지는가" 는 안 본다. 이 항목을
      > 지우면 `pending_plans` 가 아무것도 가리키지 않은 채 초록이 된다.

- [ ] **Gate C 의 `spec_impact` 에 거버넌스 문서를 적을 어휘가 없다** (harness, 2026-09-08 등재,
      배치 A 적용 중 발각).

      `plan-scan.ts` 의 `makeSpecExists` 는 `spec_impact` 원소가 **`spec/` 하위 파일**일 것을
      요구하고 `CLAUDE.md` 를 **의도적으로** 거부한다(그 함수 주석이 그 예를 든다). 그 거부는
      옳다 — 게이트의 존재 이유가 *"어느 spec 을 건드렸는지 기록하게 한다"* 이기 때문이다.

      **그런데 2026-09-08 부터 거버넌스 문서(`CLAUDE.md`·`.claude/skills/**/SKILL.md`·
      `.claude/docs/**`)가 planner 의 명시적 쓰기 축이 됐다**(위 A-1). 즉 planner 가 완료한
      작업의 일부를 `spec_impact` 가 **표현할 수 없다** — 배치 A 자신이 그 자리를 밟았고,
      본문 산문으로 기록해 우회했다.

      **지금 실질 피해는 없다** — Gate C 는 `spec/` 영향의 기록을 강제하는 게이트이지 변경
      전수 목록이 아니다. 다만 다음 planner 가 같은 자리에서 같은 판단을 반복한다.

      → 세 갈래 중 택일: (a) 현행 유지 + `spec-impl-evidence.md` 에 *"거버넌스 문서는
      `spec_impact` 대상이 아니다"* 를 한 줄로 성문화 · (b) `governance_impact` 별 키 신설 ·
      (c) `makeSpecExists` 를 거버넌스 경로까지 넓힌다(게이트가 무는 방향이 흐려지므로 비추천).
      **(a) 가 가장 싸고, 지금 상태를 그대로 문장으로 만든다.**

- [x] **"쿼리 범위 `select` 투영" 을 `1-data-model.md ## Rationale` 에 정식 등재** (planner,
      2026-09-08 등재, `review/consistency/2026/09/08/13_22_38` rationale_continuity INFO#1).

      `#1299` 가 `1-data-model.md ## Rationale` 에 세 선택지 표(컬럼 `select: false` 기각 /
      응답 DTO 손질 단독 기각 / 응답 경계 투영 + 검출 2축 채택)를 넣었다. 그런데 실제로 두 번
      쓰인 패턴은 그 셋 중 어느 것도 아닌 **네 번째** — `WorkflowVersionsService.findOne`(#1292)
      과 `WorkspacesService.listMembers`(배치 B)의 **쿼리 범위 `select` 투영**이다.

      **왜 등재해야 하나**: 표의 1행이 *"컬럼 `select: false` — 기각"* 이라 적는데, 코드 주석
      이력을 못 본 다음 검토자는 `select: { user: {...} }` 를 보고 **기각된 대안의 재도입**으로
      오판할 수 있다. 둘은 이름만 비슷하고 성질이 반대다 — 전자는 **엔티티 전역**이라 값을 읽는
      내부 경로를 fail-silent 로 만들고, 후자는 **이 쿼리 하나**라 다른 경로를 건드리지 않는다.

      → 그 표에 네 번째 행(또는 채택 행의 하위 각주)으로 *"쿼리 범위 `select` 투영 — 엔티티
      전역과 구분"* 을 넣고 두 사례를 인용한다. developer 권한 밖(`spec/` 쓰기)이라 planner 턴.

      > **완료 (2026-09-10, 배치 C-1)**. 채택 행 아래 블록쿼트로 넣었다 — **별 행으로 넣지
      > 않았다.** 그 표는 *"세 안을 놓고 골랐다"* 는 당시의 선택지 집합이라, 네 번째 행을 더하면
      > *"넷을 놓고 골랐다"* 가 되어 이력이 사후 편집된다. 각주는 *"채택안이 코드에서 어떤
      > 형태인가"* 를 적는 자리다.
      > 적용 범위(모든 쿼리 vs 그 쿼리 하나) · 다른 내부 경로 영향(fail-silent vs 무영향)을
      > 2행 표로 대비시키고, `listMembers` 가 전환되며 래칫 화이트리스트에서 **빠진 것**이
      > 기계적 증거임을 함께 적었다. 3라운드 연속 지적(`13_22_38`·`14_01_57`·`14_29_13`) 종결.


- [ ] **`production-build-devdep*` 가드는 소유할 spec 이 없다** (planner + 결정, 2026-09-10 등재,
      배치 C-4 실측 중 발각).

      배치 C-4 가 미등재 가드 4개 중 2개(`endpoint-path-conflict-wrap*`)를 등재하고 나머지 둘을
      **일부러 남겼다.** 실측: `tsconfig.build.json`·`dist`·`devDependency` 를 언급하는 spec 파일
      **0건**(`grep -rln` 전수). 그 가드가 강제하는 것은 제품 계약이 아니라 **빌드 위생**이다
      (프로덕션 번들에 테스트 전용 코드·devDependency 가 실리지 않는다).

      `spec-impl-evidence.md §2.1` 은 *"시행 코드가 없는 순수 문서형 convention"* 의 예외를
      다루는데, 이건 **그 반대** — 시행 코드는 있고 규약 문서가 없다. 그 축이 성문화돼 있지 않다.

      **지금 실질 피해는 없다** — 그 가드는 harness CI(`harness-checks.yml` 아님,
      backend unit)에서 돌고 `--impl-done` 게이트는 spec 연결 코드만 본다. 다만 **약화·삭제해도
      SPEC-CONSISTENCY 게이트가 안 문다**는 점에서 A-4 가 고친 것과 같은 등급의 사각이다.

      → 택일: (a) `spec/conventions/` 에 빌드 산출물 위생 규약 신설 후 등재 ·
      (b) 그 축을 `spec_impact` 밖(harness 축)으로 성문화하고 게이트 대상이 아님을 명문화 ·
      (c) 현행 유지 + 사유를 그 가드 헤더에 적기. **(b) 가 가장 정직해 보인다** — 그 불변식의
      소비자는 배포이지 제품 spec 이 아니다.
- [x] **`2-api-convention.md §5.4` 의 `swagger.md` 인용이 한 절 앞을 가리킨다** (planner,
      2026-09-08 등재, `review/consistency/2026/09/08/12_21_11` convention_compliance INFO#4).

      §5.4 는 *"DTO 선언이 wire 를 반영해야 한다"* 의 근거로 [`swagger.md §1-3`](
      ../../spec/conventions/swagger.md) 을 인용하는데, §1-3 은 **일반 optional 필드 예시**만
      보여 준다. `null` vs 키-생략에 따른 `@ApiPropertyOptional()` / `@ApiProperty({nullable})`
      선택 근거와 예시는 **§1-4**(닫힌 union)에 있다.

      **깨진 링크는 아니다** — 앵커는 실재하는 heading 에 착지한다. 다만 `swagger.md §1-4` 자신은
      *"부재 표현 판정과 선언 형태의 SoT: API 규약 §5.4"* 로 **역방향 링크**를 걸어 두어 서로를
      가리키는데, 정방향만 한 절 어긋나 있다.

      → 인용을 `swagger.md#1-4-nested--enum--union` 로 바꾸거나 §1-3·§1-4 병기.

      > **완료 (2026-09-10, 배치 C-3)**. §1-3·§1-4 **병기**로 고쳤다 — §1-4 로 갈아치우지 않았다.
      > 그 불릿 아래 두 항목이 `@ApiPropertyOptional()` 형태와 `@ApiProperty({ nullable: true })`
      > 형태를 **둘 다** 규정하므로, 한쪽만 가리키면 반대쪽이 근거를 잃는다. §1-4 가 이 절을 SoT 로
      > 역참조한다는 사실도 인용 안에 적어 두 방향이 서로를 가리키게 했다.

- [x] **`3-error-handling.md §2.1` 예시의 `requestId` 가 UUID 형식이 아니다** (planner,
      2026-09-08 등재, `review/consistency/2026/09/08/13_34_30` convention_compliance INFO#2).

      §2.1 JSON 예시가 `"requestId": "req_abc123"` 로 적는데, 같은 필드를
      `2-api-convention.md §5.3` 은 *"추적용 **UUID**"* 로 정의하고 구현도 `uuidv4()` 다
      (`GlobalExceptionFilter`). 예시만 다른 형식이라 소비자가 prefix 형태를 기대할 수 있다.

      → 예시 값을 UUID placeholder 로 교체. **이 배치가 쓴 문장이 아니므로** 자기-반증형
      소정정 대상이 아니다(조건 1 불충족) — planner 턴.

      > **완료 (2026-09-10, 배치 C-5) — 항목은 §2.1 을 지목했는데 실측은 3곳이었다.**
      > `req_abc123` 는 §2.1(기본 형식) · §2.2(실행 에러 형식) · §6.2(로그 형식) 세 자리에 있었고,
      > 셋 다 정본(`2-api-convention.md` = `12-webhook.md` 와 같은 UUID)으로 바꿨다.
      > §6.2 를 포함한 이유: 그 필드는 API 응답의 `requestId` 와 **같은 상관관계 id** 라
      > (`GlobalExceptionFilter` 발급값이 로그로 흐른다) 형식이 갈리면 로그↔응답 대조가
      > *"같은 필드인가"* 부터 의심된다.
      > **`14-external-interaction-api.md:340` 의 `"3f2a…"` 는 측정하고 제외했다** — 다른 형식이
      > 아니라 UUID 접두의 생략 표기이고, 이 항목이 막으려는 *"`req_` 접두 스키마 오해"* 를
      > 만들지 않는다.

- [ ] **"안전한 `User` 투영" 을 공용 상수로 승격할지 결정** (developer, 2026-09-08 등재,
      `review/code/2026/09/08/14_01_56` architecture WARNING#2 — **이번 배치는 defer 했다**).

      리뷰: *"`{id, email, name}` 이 `CREATOR_PROJECTION`(이름 있는 SoT)이 있는데도
      `listMembers` 에 인라인으로 또 적혔다 — 이 PR 이 `pg-error.ts` 에서 실천한 원칙과 반대"*.

      **defer 한 이유 — 같아 보이는 넷이 서로 다른 계약에 묶여 있다.** 실측
      (2026-09-08, `grep` 전수):

      | 자리 | 모양 | 무엇에 묶여 있나 |
      |---|---|---|
      | `CREATOR_PROJECTION` | `{id, name, email}` | **`WorkflowVersionCreatorDto` 와 대조 테스트로 고정** |
      | `listMembers` | `{id, email, name}` | 그 메서드의 6키 반환 형태 |
      | `notifications.service.ts:449` | `{id, email}` | 알림 발송 대상 |
      | `notifications.service.ts:353·367·417` | `{id, notificationPreferences}` | 용도 자체가 다름 |

      **넷 중 값이 겹치는 것은 둘뿐이고, 그 둘은 서로 다른 계약에 고정돼 있다.** 하나로
      묶으면 `WorkflowVersionCreatorDto` 에 필드가 늘 때 `listMembers` 가 **조용히** 그
      컬럼을 함께 싣는다 — 리뷰가 말한 "서로 다른 바운디드 컨텍스트" 가 오히려 그 결합의
      이유다. 우연한 동일성이지 공유할 개념이 아니다.

      **대신 다른 축으로 닫혔다**: B-4 가 `listMembers` 를 `user-entity-exposure-guard` 의
      보호 범위에 넣었으므로, 이 자리가 **넓어지면** 이제 래칫이 문다. 리뷰가 걱정한
      *"다음 사람이 더 넓은 투영을 손으로 적는다"* 는 값의 공유가 아니라 그 가드가 막는다.

      → **재개 신호**: 같은 값에 묶인 자리가 **셋째**로 생기거나, 두 계약이 실제로 한
      개념으로 수렴하면 그때 승격한다. 지금 묶으면 되돌릴 때 두 계약을 다시 갈라야 한다.
- [x] **트리거 drawer 의 "새 인증 설정 만들기" 링크가 editor 에게 dead-end** (planner,
      2026-09-06 등재, `review/consistency/2026/09/06/15_31_00` W2).

      `2-trigger-list.md §2.3.1` Auth Config 행이 그 링크를 `editor+` 노출로 적는데,
      목적지 `/authentication` 의 "Add Config" 생성 액션은 `6-config.md §A.4` 에서
      **Admin+ 전용**이다(근거 `5-system/1-auth.md §3.2`). editor 는 눌러서 도달해도
      만들 수 없다.

      ~~어느 쪽이 제품 의도인지 확인이 먼저다 — 이 항목은 문구 정정이 아니라 결정이다.~~

      > **정정 (2026-09-06)**: 실측하니 **결정할 것이 없다.**
      > `6-config.md:125` 가 *"Add Config(헤더) … 는 Admin+ 에만 UI 노출"* 을
      > **`1-auth.md §3.2` 권한 매트릭스를 근거로 인용**해 적는다 — 그쪽이 SoT 이고
      > 제품 의도는 이미 확정돼 있다 (`review/consistency/2026/09/06/16_29_00` W4 가
      > 두 문서를 대조해 확인, 나도 양쪽을 직접 열어 재확인했다). 남은 것은
      > `2-trigger-list.md:103` 셀렉터 서술을 그 경계에 맞추는 **문구 정정**이다.
      >
      > 유예 근거를 "확인이 먼저" 로 적어 둔 것이 틀렸다 — 그 확인은 문서 두 개를 여는
      > 일이었고, 미룰수록 다음 사람이 같은 판단을 반복한다.

      > **완료 (2026-09-08, 배치 A-2-3)**. `2-trigger-list.md §2.3.1` Auth Config 셀에 "이 항목은
      > Admin+ 에만 노출" 을 SoT 링크(`6-config.md#권한` → `1-auth.md §3.2`)와 함께 적었다.
      > binding 편집 자체는 editor+ 그대로다.

- [x] **`WorkflowVersionDetail` 동명 미러를 코드 주석에서 트래커로 격상** (developer,
      2026-09-06 등재, `review/consistency/2026/09/06/15_31_00` W4).

      백엔드 `workflow-versions.service.ts` 와 프런트엔드 `lib/api/workflows.ts:109` 가
      같은 이름의 **손-미러** 타입을 각자 선언하고, 이 PR 이 백엔드 쪽을 3필드 고정으로
      좁히면서 형태가 더 갈렸다(프런트는 전부 옵셔널).

      **이름이 같아서 이 세션에서만 3라운드 연속 "유일 정의" 오판이 났다** — grep 이 두
      자리를 같은 것으로 보여 준다. 지금 방어는 백엔드 타입 JSDoc 의 *"다음에 만지면
      저쪽도 열어라"* 한 줄뿐이고, 그것은 **그 파일을 여는 사람에게만** 닿는다.

      → 개명(`WorkflowVersionDetailProjection` 등) 또는 `codebase/packages/` 공유 타입
      승격. 개명은 프런트 소비처 2곳(`version-detail-dialog.tsx`·`version-diff-dialog.tsx`)
      과 무관하므로 백엔드 단독으로 가능하다.

      > **완료 (2026-09-08, 배치 B-8)** — 격상이 아니라 **해소**했다. 백엔드를
      > `WorkflowVersionDetailProjection` 으로 개명(소비처 0건, wire 계약 무변).
      > **공유 패키지로 합치지 않았다** — 두 타입은 실제로 형태가 다르다(`createdAt` Date vs
      > string, `creator` 3필드 고정 vs 옵셔널·nullable). 합치려면 wire 계약을 한쪽으로 맞춰야
      > 하는데, 이 결함이 요구한 것은 **형태 통일이 아니라 이름 충돌 해소**다. 양쪽 JSDoc 갱신.

- [x] **도메인 세부 에러 코드의 표현 방식을 정식화한다** (planner, 2026-09-06 등재,
      `review/consistency/2026/09/06/14_59_49` W1).

      저장소에 **두 관례**가 있다 — (1) top-level `code` 자체를 특화 코드로 **교체**
      (`DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT`·`ALREADY_A_MEMBER` 등 7건),
      (2) 세부 사유는 **`details[].code`** (`error-codes.md §4.2`,
      `trigger-parameter.types.ts`). `2-api-convention.md §5.3` 은 어느 쪽도 명문화하지
      않는다.

      `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 spec 이 *"409 `RESOURCE_CONFLICT` (세부 코드 …)"*
      로 **두 층을 나눠** 적었으므로 (2)로 구현했다(`details.code`). 그러나 (1)이 다수
      선례라, *"어느 쪽이 기본인가"* 를 문서가 답하지 않으면 다음 구현자가 또 고른다.

      → `2-api-convention.md §5.3` 에 택일 기준을 적고, `3-error-handling.md §1` 카탈로그에
      이 코드를 등재한다. **개수를 쓰지 말고 나열형으로.**

      > `details` 가 object(단일 도메인 예외) / array(ValidationPipe 다중 필드) 두 형태인
      > 것도 §5.3 에 미명문화다 (`review/consistency/2026/09/06/14_59_49` INFO#4).
      > 같은 턴에 함께 적는다.

      > **완료 (2026-09-08, 배치 A-3)**. `2-api-convention.md §5.3` 에 택일 기준 소절을 신설했다 —
      > 판정 기준은 "소비자가 그 값으로 무엇을 하는가"(결과 그 자체 → top-level 교체 / 어느
      > 필드에 붙는지가 정보 → `details[].code`). `details` 의 **객체 vs 배열** 두 형태도 같은
      > 절에 적었다. `3-error-handling.md §1.10` 에 `TRIGGER_ENDPOINT_PATH_CONFLICT` 등재
      > (§1.8·§1.9 와 동형). **개수는 쓰지 않았다.**

- [x] **`2-trigger-list.md:106` botToken 행의 자기모순** (planner, 2026-09-06 등재,
      `review/consistency/2026/09/06/14_59_49` W2).

      한 문장이 *"응답에는 `hasBotToken: boolean` 만 노출"* 과 *"마스킹 placeholder
      (`•••• <last4>`)"* 를 **동시에** 말한다. boolean 만 나가면 서버가 last4 를 보낼
      방법이 없다. `15-chat-channel.md §5.4.2`(ref·plaintext 모두 응답 미포함)와도,
      실제 구현(rotate 입력창 placeholder 는 형식 예시 `"123456789:ABCdef..."`)과도
      어긋난다.

      AuthConfig 의 `***<last4>` 마스킹 규약을 성격이 다른 **write-only** 필드에 잘못
      차용한 것으로 보인다. **방치하면 다음 구현자가 실제 last4 노출 필드를 신설해
      `secret-store.md §1.1` 을 위반할 소지**가 있다 — 그것이 이 항목의 실질이다.

      (이 PR 이 만든 결함이 아니다. 게이트가 넓어지며 드러났다.)

      > **완료 (2026-09-08, 배치 A-2-4)**. 마스킹 placeholder 구를 제거하고 "마스킹 값도 last4 도
      > 응답에 싣지 않는다" 로 못 박았다. AuthConfig 의 `***<last4>` 규약은 **Reveal 로 읽을 수
      > 있는** 자격증명용이라 write-only 필드에 차용하지 않는다는 경계를 함께 적어, 다음
      > 구현자가 last4 노출 필드를 신설할 여지를 닫았다.

- [ ] **`code:` 파서 두 벌을 golden fixture 코퍼스로 묶는다** (harness, 2026-09-06 등재,
      `review/code/2026/09/06/14_25_40` W2).

      같은 YAML 을 Python(`review_guard._parse_frontmatter_code`)과
      TypeScript(`spec-frontmatter-parse.ts`, gray-matter)가 **각자 재구현**한다. 이
      발산이 41개 entry 유실을 냈고, 이번에 닫은 것은 그중 **두 형태**(줄 전체 주석·빈
      줄, 트레일링 주석)뿐이다. 다음 형태(앵커 `&a`/`*a` · 여러 줄 문자열 `>`/`|` ·
      따옴표 안의 `#`)는 여전히 갈릴 수 있다.

      **한 형태씩 쫓는 것이 이 항목의 문제다** — 트레일링 주석은 직전 수정이 **한 칸
      좁아서** 남은 것이고, 두 reviewer 가 정규식을 직접 돌려 찾았다.

      → 두 언어 테스트가 **같은 fixture 코퍼스**를 읽고 *"같은 입력 → 같은 출력"* 을
      계약으로 단언한다. 형태를 추가하면 양쪽이 동시에 물린다.

      > **당장의 안전망은 있다**: 저장소 전수 대조(387개 파일, 731 대 731, 갈리는 파일
      > 0)를 실측으로 확인했다. 이 항목은 그 대조를 **테스트로 상시화**하는 것이다.

- [ ] **`workflow-versions.service.ts` 의 공유 `select` 6키를 상수로**
      (developer, 2026-09-06 등재, `review/code/2026/09/06/14_25_40` INFO#3).

      `findByWorkflow`/`findOne` 이 `id`·`workflowId`·`version`·`changeSummary`·
      `createdBy`·`createdAt` 를 손으로 두 번 나열한다. **이 PR 이 고친 결함 클래스가
      축소된 범위로 남은 것**이다 — 자매 메서드 중 하나만 바뀌면 응답이 갈린다.

      `creator` 는 이미 `CREATOR_PROJECTION` 으로 공유한다(그쪽이 보안 경계였다).
      남은 6키는 갈려도 **표시 버그**지 유출이 아니라, 이번 PR 범위 밖으로 미룬다.

- [ ] **`WorkflowVersion*Dto.creator` 의 §5.4 금지 조합을 갚는다** (developer, 2026-09-06
      등재, `review/code/2026/09/06/13_39_20` INFO#16 + `review/consistency/2026/09/06/13_39_25`
      INFO#2 — 두 게이트가 독립 지적).

      두 DTO 가 `@ApiPropertyOptional({ nullable: true })` + `creator?: T | null` 로
      **§5.4 가 금지한 조합**을 쓴다. 이미 동결돼 있다 —
      `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 4행 중 2행
      (`WorkflowVersionDto.creator` · `WorkflowVersionListItemDto.creator`). 즉 **추적
      안 되는 갭이 아니라 등재된 부채**다.

      **새로워진 것은 방향이다.** #1292 가 `findOne`/`findByWorkflow` 의 런타임을
      `creator: ProjectedCreator`(항상 존재 · 3필드 전부 필수)로 좁혔다. 이제 선언이
      런타임보다 **넓다** — 소비자는 없을 수도 있다고 읽는데 실제로는 늘 온다. 갚는 방향은
      `@ApiProperty()` + `creator: WorkflowVersionCreatorDto` 이고, 갚으면 래칫 2행이
      함께 빠진다.

      **wire 를 바꾸지 않는다** — 선언만 좁힌다. 다만 프런트엔드
      `lib/api/workflows.ts` 의 손수 맞춘 미러(`creator?: {…} | null`)도 같은 턴에 봐야
      한다(같은 이름의 별도 선언 — `workflow-versions.service.ts` 의 JSDoc 참조).

- [x] **`User` 민감 7컬럼의 응답 노출 금지를 규약 문장으로** (planner, 2026-09-06 등재,
      `review/consistency/2026/09/06/10_13_23` W2).

      지금 그 불변식의 SoT 는 **코드뿐**이다 — `USER_SECRET_KEYS` 배열. Trigger·AuthConfig
      계열은 `secret-store.md §1.1` 이 *"비대상 필드도 응답 바디에는 나가지 않는다"* 로
      규범을 세워 뒀는데 `User` 에는 대응 절이 없다.

      → `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 7컬럼 노출 금지를 적고, 위
      두 가드를 그 절의 `code:`/본문 링크로 잇는다. 결정 근거(전수 열거 수치 · 기각한 두
      대안 · 채택 이유)는 지금 `plan`·`CHANGELOG` 에만 있으므로 해당 문서의 `## Rationale`
      로 옮긴다 (`10_13_23` INFO#1).

      > **완료 (2026-09-08, 배치 A-5)**. `1-data-model.md` 에 **`#### 2.1.1 응답 노출 금지 (민감 7컬럼)`**
      > 신설 + `## Rationale` 에 결정 근거(기각한 두 대안 포함) 승격. `secret-store.md §1.1` 에는
      > 상호 참조 한 줄만 — 그 문서는 스스로를 "외부 provider 자격증명 보관 추상화" 로 한정하는데
      > `User` 컬럼은 provider 자격증명이 아니라 관할을 넓히게 된다.
      > **`--spec` 1차가 Critical 을 냈다**: 초안이 "이 저장소는 `select: false` 를 쓰지 않는다"
      > 로 범위를 넓혀 적었는데 같은 문서 §2.19(`Notification.background_run_id`, V107)가 즉시
      > 반례였다. 실제 원리는 **컬럼별 소비 패턴**(값을 읽는다 vs WHERE 절에만 쓴다)이고, 그
      > 표와 인용 조건을 Rationale 에 넣었다.

- [ ] **트리거 비밀 스트립을 deny-list 4벌에서 선언적 SoT 로** (developer + 보안 판단,
      2026-09-05 등재, `review/code/2026/09/05/23_30_00` security W1). 지금
      `TriggersService.sanitizeForResponse` 는 **수기 `Set<string>` 네 벌**로 막는다 —
      `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(JSONB) · `NOTIFICATION_SIGNING_STRIP_KEYS`(JSONB) ·
      `INTERACTION_RESPONSE_STRIP_KEYS`(JSONB) · `TRIGGER_RESPONSE_STRIP_COLUMNS`(엔티티 컬럼).

      **같은 병이 세 라운드 연속 났다** — 스윕 1차가 엔티티 컬럼 축을 열었고, `20_45_37` 이
      `notification.signing` 누락을, `22_48_39` 가 `interaction.triggerToken` 누락을 잡았다.
      매번 "이번엔 전수 열거했다" 고 적었는데 매번 한 축이 남아 있었다. 목록을 늘리는 방식은
      **다음 축의 이름을 미리 알아야** 하므로 원리적으로 닫히지 않는다.

      제안 방향: `Trigger` 엔티티 필드에 `@Sensitive()` 를 붙이고 `sanitizeForResponse` 가
      리플렉션으로 걷어낸다. 그러면 "새 비밀 컬럼을 추가했는데 스트립 목록에 안 넣었다" 가
      **선언 자리에서** 닫힌다.

      **착수 전에 잴 것 — 데코레이터는 엔티티 컬럼만 덮는다.** 네 축 중 셋은 JSONB **안의
      키**라 필드 데코레이터가 걸릴 자리가 없다. 그러니 이 항목은 네 축 중 **한 축만**
      선언적으로 만든다 — 나머지 세 축을 어떻게 닫을지는 아래 열린-맵 항목과 함께 결정한다.
      "데코레이터로 옮기면 다 해결된다" 는 서술을 그대로 믿지 말 것 (이 문단이 그 반증이다).

- [ ] **열린 `config` 맵 안의 신규 비밀은 e2e `not.toHaveProperty` 를 동반해야 한다 — 규약에
      명시** (planner, 2026-09-05 등재, `review/code/2026/09/05/23_30_00` security W2).
      `TriggerDto.config` 는 `additionalProperties: true` 라 **런타임 계약 검증자와 정적
      가드 양쪽 모두**가 그 안으로 내려가지 않는다. 즉 `config.interaction.triggerToken`,
      `config.notification.signing.secret` 같은 필드의 스트립 여부는 **오직 손으로 짠 e2e
      단언에만** 달려 있다 — 다른 필드들이 받는 자동 이중 안전망이 이 표면에는 없다.

      이번 브랜치가 그 사각지대를 처음 문서화하고 수기 테스트로 메웠지만, **다음 사람이
      같은 자리에 새 비밀을 넣을 때 그 사실을 기억해야만** 보호가 이어진다. `secret-store.md`
      (§1.1 인접) 또는 `2-api-convention.md §5.4` "검증 층" 소절에 **한 문장**으로 못 박는다:
      *열린 맵 안에 비밀을 두면 계약 검증자가 못 보므로, 그 필드는 부재를 단언하는 e2e 를
      반드시 동반한다.*

      > 위 `@Sensitive()` 항목과 **같은 병의 다른 얼굴**이다 — 그쪽은 엔티티 컬럼 축을,
      > 이쪽은 JSONB 세 축을 겨눈다. 두 항목을 한 턴에 같이 여는 것이 낫다.

- [x] **§5.4 검증자 2종의 역할 경계를 spec 본문에 한 문장으로** (planner, 2026-09-05 등재,
      `review/consistency/2026/09/05/15_53_59` W1). 이름이 인접한 검증자가 둘이 됐다:

      | 파일 | 무엇을 대조하나 | 타입 |
      |---|---|---|
      | `repo-guards/__tests__/swagger-dto-contract-guard.ts` | **선언 vs 선언** — `@ApiProperty` 데코레이터와 TS 타입 (정적 AST) | `ContractMismatch` |
      | `shared/testing/response-contract.ts` | **값 vs 선언** — 실 HTTP 응답과 생성된 OpenAPI 스키마 (런타임) | `ContractViolation` |

      `"Contract"` 로 검색하면 어느 쪽인지 즉시 안 갈린다. **리네임은 하지 않는다** —
      checker 도 강제하지 않았고, 4개 e2e 배선과 37개 스펙을 건드려 얻는 것보다 잃는 것이
      크다. 대신 아래 `code:` 등재를 집행할 때 **같은 문장으로** 경계를 적는다.

      > **완료 (2026-09-05, `spec-draft-api-convention-verifier-registration`)** —
      > `2-api-convention.md` §5.4 에 **"검증 층"** 소절을 신설했다(정적/런타임 · 각자
      > 못 보는 것). `swagger.md §5-1` 에는 런타임 짝을 가리키는 blockquote 를 넣었다.

- [x] **`2-api-convention.md` frontmatter `code:` 에 §5.4 검증자 등재** (planner,
      2026-09-05 등재). `response-contract.ts` 는 §5.4 를 **런타임으로 시행하는** 유일한 코드인데
      지금 어떤 spec 의 `code:` glob 에도 안 걸린다 — 즉 그 파일을 고쳐도
      `--impl-done` SPEC-CONSISTENCY 게이트가 안 문다.

      > **완료 (2026-09-05)** — `2-api-convention.md`(§5.4 축)와 `swagger.md`(§5-1
      > undeclared 축) **양쪽**에 등재했다. 한쪽만 하면 사각지대가 남는다는 것을
      > `--spec` W1 이 잡았다 — 감사 로그 26키 유출을 실제로 잡은 축이 §5-1 쪽이다.
      >
      > **`review-citations.md` 선례("준수 예시")는 근거로 쓰지 않았다** — 그것은 시행
      > 코드가 *없는* 경우의 예외고, 이 건은 시행 코드가 *있는* 경우다. 실제 근거는
      > 가드·테스트 등재 선례 **40건**이고 그중 자매 검증자가 이미
      > `swagger.md` 에 있다.
      >
      > **게이트에 직접 물어 확인했다**: `_spec_linked_changes()` 가
      > `shared/testing/` 4파일을 **4/4** spec-linked 로 판정한다. 문서에 "등재 완료" 라고
      > 적는 것만으로는 등재가 아니다 — 아래 harness 항목 참조.

- [ ] **§5.4 drift 배치 — 2단계: 검증자가 없는 응답 DTO 78곳** (developer). 패스스루 68곳
      **+ `ExecutionDto` 10곳**. 컨트롤러가 엔티티를
      그대로 반환하는 경로라 **DTO 가 강제되지 않는 순수 문서**다. `required: true` 를
      주장하려면 검증자가 필요하다:

      > **`TriggerDto`/`ScheduleDto` 에 도달하면 주의** — 계약 대조가 RED 를 내더라도
      > `notificationSecretV2`·`chatChannelTokenV2` 를 **DTO 에 선언해 해소하지 말 것.**
      > [`secret-store.md §1.1`](../../spec/conventions/secret-store.md) 이 그 필드들의
      > **응답 노출을 금지**한다(저장 형태 예외는 노출 예외가 아니다). RED 는 **응답
      > 스트립**으로만 해소한다. 다른 미선언 필드를 선언으로 해소하는 것과 갈린다.

      > **진행 상태 (2026-09-05)**: 검증자 자체는 섰고 4개 DTO 가 배선됐다 — 아래 (b) 참조.
      > 남은 것은 **선행 조건이 아니라 스윕**이라 이 항목은 열어 둔다.
      >
      > **모집단 — 세 숫자가 다 다르고, 각각 다른 것을 센다** (2026-09-05 실측):
      >
      > | 값 | 세는 대상 |
      > |---|---|
      > | **134** | `src/**/dto/responses/**` 의 `export class` 전체 (36개 파일) |
      > | **60** | 그중 §5.4 관련 필드(`?` · `\| null` · `nullable:true`)를 **1개 이상** 가진 클래스 |
      > | 78 | 종전 라운드가 요청/응답을 전이 폐포로 가른 뒤 센 **필드** 수 |
      >
      > **더하지 말 것.** 종전 이 자리에 *"DTO 60개 = `dto/responses/` 아래 클래스 수"* 라고
      > 적었는데 **정의와 숫자가 어긋났다** — 그 정의대로 세면 134다
      > (`review/code/2026/09/05/14_39_31` W4). 배선 대상으로 의미 있는 것은 **60** 이고,
      > 그중 4개가 끝났다.
      >
      > 배선은 한 줄이지만 **기존 e2e 가 그 리소스를 이미 가져오는 자리**가 있어야 하고,
      > RED 가 나면 그건 진짜 §5.4 위반이라 DTO 를 고칠지 코드를 고칠지 건별 판단이
      > 붙는다. 모듈 단위로 끊어 진행한다.
      - ~~(a) 그 컨트롤러들의 반환 타입을 `Promise<XxxDto[]>` 로 명시 annotate~~ →
        **반증됐다 (2026-09-04 실측).** 아래 참조.
      - **(b) 실제 응답 대조 테스트 — 일반 헬퍼까지 완료 (2026-09-05).**
        `src/shared/testing/response-contract.ts` 가 **응답 1건 vs DTO 선언**을 일반적으로
        대조한다. §5.4 의 네 축(required+non-nullable · required+nullable · 키 생략형 ·
        스키마에 없는 키)을 그대로 옮겼고, 호출부는 엔드포인트당 **한 줄**이다.

        배선된 4개 DTO — required **37 필드**가 실 응답 대조 하에 들어왔다:

        | DTO | 엔드포인트 | e2e | required |
        |---|---|---|---|
        | `ExecutionDto` | `GET /api/executions/workflow/:id` | `workflow-execution` | 12 |
        | `WorkflowDto` | `GET /api/workflows` | `workflow-crud` | 10 |
        | `AuditLogDto` | `GET /api/audit-logs` | `audit-logs` | 8 |
        | `SessionDto` | `GET /api/users/me/sessions` | `session-revocation` | 7 |

        네 자리 모두 payload 를 `{}` 로 바꾼 뮤턴트가 **그 자리만** RED 를 냈다(51개 중
        1개 → 3개). 빌드 캐시를 prune 한 뒤 돌려 stale 이미지 가설도 배제했다.

        > **선행 조건이 스윕으로 바뀌었다.** 종전 이 자리의 서술은 *"남은 것은 일반
        > 헬퍼"* 였고 그것이 해소됐다. 남은 일은 같은 한 줄을 나머지 응답 DTO 로 넓히는
        > 기계적 작업이다 — 아래 별 항목으로 등재한다.

        > #### 스윕 1차 (2026-09-05) — 4 → **18개 DTO**
        >
        > 기존 e2e 가 이미 그 리소스를 가져오는 자리 **14곳**을 배선했다. 배선은
        > `contractForDto` 에 메모이제이션을 넣어 **한 줄**이 됐다 (종전에는 파일마다
        > `beforeAll` 변수를 만들어야 했다).
        >
        > **스윕이 26건의 실제 drift 를 찾았다** — 그중 2건은 보안 결함이다:
        >
        > | 발견 | 성격 | 처분 |
        > |---|---|---|
        > | `TriggerDto` 가 `notificationSecretV2`(평문 서명 secret)·`chatChannelTokenV2` 노출 | **보안** | 응답 경계에서 스트립. 기존 sanitizer 가 `config` JSONB 만 덮고 **엔티티 컬럼은 안 덮었다** |
        > | `ScheduleDto` 가 조인으로 Trigger 엔티티 **전체** 노출 (같은 secret 들) | **보안** | 컨트롤러에서 참조 4필드로 좁힘 |
        > | 24필드가 "응답에 있는데 DTO 미선언" | 선언 지연 | FE 가 소비하므로 **선언을 실제에 맞춤** (wire 무변) |
        > | `ExportWorkflowDto.formatVersion` 이 required 인데 부재 | 문서화된 Planned 갭 | `allowMissing` 옵션 신설 + spec 인용 주석 |
        >
        > 두 보안 수정 모두 뮤턴트로 확인했다 — 스트립을 되돌리면 `TriggerDto` 2건,
        > `ScheduleDto` 18건(중첩 경로 `trigger.notificationSecretV2` 포함)이 RED.
        >
        > **잔여는 "41개" 가 아니다 — 그 수치는 상한이다.** 배선 대상을 고르려고 짠 정적
        > 라우트 매퍼가 **라우트를 놓친다**(예: `GET /integrations/cafe24/precheck` 를
        > 통째로 못 봤고, 그건 손으로 확인해 배선했다). 잔여 목록은 **census 가 아니라
        > 출발점**으로 쓸 것. 잔여의 성격은 세 갈래다:
        >
        > - **중첩 전용 DTO** — 부모를 배선하면 검증자가 `$ref`/`allOf` 를 따라 내려가므로
        >   별도 배선이 불필요하다. 다만 **`items: { type: 'object' }` 로 선언된 자리는
        >   내려가지 않는다** (`CanvasSaveResultDto.nodes`/`.edges` 가 그렇다 — 아래 항목).
        > - **엔드포인트인데 기존 e2e 가 안 때리는 것** — 새 e2e 시나리오가 선행이다.
        > - **매퍼가 놓친 것** — 손으로 찾아야 한다.

        > #### 스윕 1차의 자기 반박 (2026-09-05, `cb17f0870`)
        >
        > 위 배선과 함께 넣은 23필드 선언 중 **17개가 §5.4 금지 조합**
        > (`@ApiPropertyOptional` + `nullable: true`)이었고, 나머지 **6개는 별개 축의
        > 과소 선언**(상시 존재 + non-null 인데 `Optional`)이었다. 같은 세션의 두 리뷰가
        > 그 둘을 이미 갈라 놓았는데 이 자리에서 합산해 적었다
        > (`review/code/2026/09/05/22_48_39` W5). 같은 PR 이 다른 파일에서 "동결, 확대 금지" 라고 적어 둔
        > 형태를 **내가 넓혔다** (`--impl-done 18_23_03` Critical 1, checker 2명이 독립 검출).
        > 전부 §5.4 기본형으로 정정했다.
        >
        > **왜 아무도 못 잡았나**: 런타임 검증자는 **값**을 보는데 이 조합은 키가 없어도
        > `null` 이어도 맞고, 정적 가드의 presence/null 축은 **선언과 TS 타입이 서로 맞는지**
        > 만 보는데 이 조합은 일관되게 틀려 있다. **두 검증자 사이의 사각지대**였다.
        >
        > → `swagger-dto-contract-guard.ts` 에 세 번째 축을 더해 응답 DTO 전수를 훑고
        > **78건**을 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 로 고정했다(양방향 래칫).
        >
        > **이 78 은 위 「스윕 1차」의 모집단과 다른 것을 센다** — 그쪽은 *배선 대상 DTO*
        > 수이고, 이쪽은 *금지 조합을 쓰는 필드* 수다. 더하거나 비교하지 말 것.
        >
        > 부수: ~~`ScheduleDto.trigger` 의 wire 형태를 **키 생략**으로 확정했다~~ —
        > **틀렸다. 확정된 것은 §5.4 기본형(`@ApiProperty`, 상시 존재)이다.**
        > `Schedule.trigger_id` 가 NOT NULL 1:1 이고 응답을 내는 네 경로가 전부 채우므로
        > 부재 경로가 없다 (`schedules.controller.ts` 의 `toResponse` 는 아예 던진다).
        > 같은 문서 아래쪽 「`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화」
        > bullet 이 *"`trigger` 는 상시 존재라 기본형으로 바꿨고"* 라고 옳게 적고 있으니
        > **그쪽이 정본**이다 — 후속 planner 턴이 이 줄을 옮기지 않도록 여기서 정정한다
        > (`review/consistency/2026/09/06/01_13_51` W1).
        >
        > 키 생략형인 것은 `trigger.workflow` **한 겹 아래**다 — 생성 응답에만 없다.
        >
        > 함께 확정한 것: `POST /api/schedules` 는 `isActive` 값과 무관하게 `trigger` 를
        > 실어 보낸다 — 종전에는 `isActive: false` 면 트리거를 만들어 놓고 응답에서만
        > 빠졌다.

- [ ] **`Ref` DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다** (developer, 2026-09-06
      등재, `review/consistency/2026/09/06/11_55_37` W3 을 고치다 전수 grep 으로 발견).

      `review-citations.md §3` 은 *"DTO·컨트롤러의 `/** */` JSDoc 은 대상 아님 — 그 JSDoc 은
      **공개 OpenAPI description** 으로 나가므로 리뷰 인용을 애초에 거기 쓰지 않는다"* 고
      적는다. 그런데 두 자리가 클래스 JSDoc 안에 인용을 담고 있다:

      | 파일 | 클래스 |
      |---|---|
      | `schedules/dto/responses/schedule-response.dto.ts` | `ScheduleTriggerWorkflowRefDto` |
      | `triggers/dto/responses/trigger-response.dto.ts` | `TriggerWorkflowRefDto` |

      둘 다 **#1291 이 넣었고 그 PR 의 게이트를 통과했다** — 그때 checker 가 "필드 JSDoc" 만
      보고 클래스 쪽은 안 봤다. 이번 라운드 checker 도 클래스 쪽은 지적하지 않았다.

      > **이제 가드가 이 둘을 동결한다** — `dto-jsdoc-citation.spec.ts` 의
      > `EXPECTED_DTO_JSDOC_CITATIONS`. 갚아서 없애면 그 목록에서도 빼야 통과한다.

      **이 브랜치에서 고치지 않는 이유**: 두 파일 모두 이 브랜치 diff 밖이다. 손대면 scope
      이탈이고, `review-citations.md §4`(기존 인용은 소급 정리 대상 아님)의 취지에도 맞지
      않는다 — *"그 자리를 다음에 건드릴 때 함께 맞춘다."*

      착수 시 함께 볼 것: **클래스 JSDoc 도 대상인가**를 `review-citations.md §3` 표가
      명시하지 않는다(그 행은 "DTO·컨트롤러의 JSDoc" 이라고만 적어 필드/클래스를 안 가른다).
      고치기 전에 그 문장부터 갈라야 같은 질문이 또 안 생긴다 — 그쪽은 planner 몫이다.

- [ ] **`INTERNAL_ERROR` 문구가 두 자리에서 언어가 갈린다** (developer, 2026-09-06 등재,
      `review/consistency/2026/09/06/01_13_51` INFO#3). `3-error-handling.md` 는 이 코드의
      문구를 **한국어**(*"서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."*)로 정하는데,
      `GlobalExceptionFilter` 는 영어다. **상수가 하나가 아니라 둘이다** — checker 는
      `UNHANDLED_ERROR_MESSAGE`(*"An unexpected error occurred. Please try again later."*)만
      짚었는데, 같은 클래스에 `UNKNOWN_ERROR_MESSAGE`(*"An unexpected error occurred"*)가
      따로 있고 이쪽이 기본값이다. 한쪽만 고치면 같은 `INTERNAL_ERROR` 안에서 언어가
      **세 갈래**가 된다.

      **이 브랜치가 만든 회귀가 아니다** — 기존 drift 이고, 스케줄 가드가 규약 문구를 그대로
      쓰면서 두 문구가 처음 나란히 드러났을 뿐이다. 그래서 여기서 고치지 않는다: 필터를
      건드리면 **매핑되지 않은 모든 5xx** 의 문구가 바뀌어 이 PR 의 범위를 넘는다.

      실측(2026-09-06): 두 문구를 문자열로 단언하는 자리는 `http-exception.filter.spec.ts`
      **2곳**뿐이다 (`grep -rn "unexpected error occurred" src test`). 즉 문구 교체 자체는
      작다 — 판단이 필요한 것은 **API 응답 문구의 언어 정책**이지 배선이 아니다.

- [ ] **`CanvasSaveResultDto.nodes`/`.edges` 가 타입 없는 객체 배열** (developer,
      2026-09-05 등재). `@ApiProperty({ type: 'array', items: { type: 'object' } })` 라
      **검증자가 그 아래로 내려가지 않는다** — 캔버스 저장 응답에 어떤 엔티티 필드가
      실려도 계약 검사를 통과한다. e2e 11개 스펙이 이 엔드포인트를 때리므로 배선 자체는
      쉬운데, `NodeDto`/`EdgeDto` 로 선언을 바꾸는 것이 선행이다.

- [ ] **`IntegrationDto.consecutiveNetworkFailures` 노출 중단 검토** (developer,
      2026-09-05 등재). 내부 health 카운터인데 응답에 실려 나간다. **프런트엔드 참조
      0곳**(실측)이라 빼도 소비자가 없지만 **wire 변경**이라 CHANGELOG 를 동반해야 한다.
      이번 PR 은 "선언을 실제에 맞춘다" 범위라 선언만 했다.

      > **제거 시 지울 자리가 셋이다** (2026-09-10 보강). FE 참조는 여전히 **0곳**(재측정)이라
      > 처분 자체는 그대로다. 다만 이 필드를 서술하는 자리가 늘었다:
      >
      > | 자리 | 무엇을 적나 |
      > |---|---|
      > | `integration-response.dto.ts` 그 필드 JSDoc | *"FE 참조 0곳 — 빼는 것은 wire 변경"* |
      > | `4-integration.md §9.1` `GET /:id` 행 | *"나머지 넷과 동급이 아니다 — 새 소비자를 만들지 말 것"* |
      > | `4-integration.md ## Rationale` §9.1 경계 항목 | 캐비엇 유지 비용 |
      >
      > 제거 PR 은 **셋을 함께** 지워야 한다. §9.1 에 캐비엇을 둔 것은 그 비용을 알고 한 선택이다 —
      > 없으면 다음 FE 작업자가 그 목록을 보고 소비하고, 그러면 제거가 파괴적 변경으로 승격되어
      > 이 항목이 영구히 닫히지 못한다.

- [ ] **§5.4 스윕 2차 — 엔드포인트인데 e2e 미도달인 DTO** (developer, 2026-09-05 등재).
      1차가 닿지 못한 자리다. 배선 한 줄이 아니라 **새 e2e 시나리오**가 선행이므로 모듈
      단위로 끊는다. 후보(매퍼 기준, census 아님): `DashboardSummaryDto` ·
      `StatisticsSummaryDto` · `LlmUsageSummaryDto` · `WorkflowVersionDto` ·
      `WorkflowVersionListItemDto` · `GraphEntityDto` · `FolderDto` · `DocumentDto` ·
      `NodeDto` · `EdgeDto` 등.

      > #### (a) 가 왜 안 되는가 — DTO 와 엔티티는 **다른 것**을 기술한다
      >
      > 엔티티와 짝지어지는 응답 DTO 23개의 필드 타입을 전수 대조했다 — **불일치 59건**.
      > 그런데 성격이 갈린다:
      >
      > | 성격 | 건수 | 판정 |
      > |---|---|---|
      > | `Date` → `string` | **46** | **정상** — JSON 직렬화가 `Date` 를 ISO 문자열로 바꾼다 |
      > | enum → `string` | 6 | 정상 (넓힘) |
      > | 관계 축소 (`User` → `XxxUserDto`) | 4 | 정상 (의도된 서브셋) |
      > | 그 밖 | **3** | 아래 참조 |
      >
      > **마지막 행을 처음엔 "실제 불일치 1" 로 적었다 — 표의 다른 행은 버킷 크기인데 그
      > 행만 판정 결과였다.** 합이 57 이 되어 본문의 59 와 어긋났고 리뷰가 잡았다
      > (`19_43_18` W4). 그 3건은 —
      >
      > | 필드 | 판정 |
      > |---|---|
      > | `AlertRuleDto.threshold` (`number` vs `string`) | **진짜 계약 거짓 — 이 PR 이 고쳤다** |
      > | `IntegrationDto.lastError` | 정상 — JSONB blob 의 구체 형태를 문서화한 축소 |
      > | `DocumentDto.graphExtractionStatus` | 정상 — 리터럴 유니온 vs enum, 값이 같다 |
      >
      > 반환 타입을 DTO 로 명시하면 **46건의 정상 케이스가 전부 타입 오류가 된다.** DTO 는
      > **직렬화된 wire** 를 기술하고 엔티티는 **메모리 안의 값**을 기술하므로, 타입 수준
      > 검증자는 그 간극을 **원리적으로** 못 넘는다. 검증자는 직렬화를 거친 **뒤**를 봐야
      > 한다 → (b) 만 성립한다.
      >
      > **리뷰가 (a) 의 근거로 든 `AlertRuleDto.threshold` 는 실재하는 결함이 맞았다** —
      > 다만 그 하나를 잡으려고 46건의 오탐을 감수하는 구조였다. 그 필드는 이 PR 이 직접
      > 고쳤으므로 (a) 를 시도할 유인도 사라졌다.

      **`ExecutionDto` 는 형태가 조금 다르다** (리뷰 2R W2). 노출 경로 4개 중 목록
      (`toExecutionDto`)만 `ExecutionDto` 로 조립되고, `stop`/`getChain`/`reRun` 은 엔티티
      파생 `Omit` 타입(`ResponseExecution`)을 반환해 DTO 선언과 **구조적으로 무관**하다.
      네 경로를 한 타입으로 모으는 것이 선행이다.

      ~~**`ExecutionDto` 에는 스키마-레벨 테스트가 아예 없다** (리뷰 2R W4)~~ →
      **신설 완료 (2026-09-05)**: `execution-response.dto.spec.ts` 가
      `execution-status-response.dto.spec.ts` 패턴으로 섰다. 광고된 22 프로퍼티를 세
      목록(required+non-nullable 11 · required+nullable 1 · **optional+nullable 10 =
      §5.4 drift 로 추적 중인 기존 상태**)으로 갈라 고정하고, 세 목록의 합이 프로퍼티
      전체를 덮는지 먼저 단언한다.

      가드가 실제로 그 회귀를 잡는지 확인했다 — `triggerLabel` 의 데코레이터와 TS 타입을
      **동시에** optional 로 되돌린 뮤턴트에 **RED 2건**. 이것이 종전 서술이 *"AST 가드도
      tsc 도 못 잡는다"* 고 지목한 바로 그 형태다.

      **"엔티티라 키가 항상 있다" 는 논거는 쓸 수 없다** — `notifications` 4곳 등이 부분
      `select:` 를 쓴다(2026-09-04 실측).

- [x] **`spec/conventions/swagger.md` 에 numeric 불변식 성문화** — 완료 (2026-09-05, §1-6).
      상세는 [`spec-draft-numeric-wire-convention.md`](../complete/spec-draft-numeric-wire-convention.md).
      종전 서술: (planner, `20_05_42` W2).
      `numeric`/`decimal` 컬럼을 엔티티 그대로 내보내는 응답은 **문자열**이라는 규칙이
      가드로는 전역 강제되는데 규약 문서에는 없다. 기존 DTO 불변식은 §1/§5 소절로
      규약화해 온 관행이 있다 — 최소한 가드로의 pointer 라도 넣는다.
- [x] **`spec/1-data-model.md` 의 `threshold` `Float` 라벨** — 완료 (2026-09-05).
      `Numeric(12,4)` + wire 타입 명시. 자매 행 `cost_usd` 도 wire 타입을 잇도록 함께 손봤다.
      종전 서술: (planner,
      `19_43_18` INFO#6). 실제는 `numeric(12,4)` 이고 엔티티·wire 모두 **문자열**이다
      (2026-09-04 정정으로 분명해졌다). 라벨을 DB 타입에 맞춘다.
- [x] **`swagger.md` 의 JSDoc/`//` 분리 가이드** — 완료 (2026-09-05, §3).
      종전 서술: (planner,
      `21_10_30` INFO#3). `nest-cli.json` 의 swagger 플러그인이 **JSDoc 을 공개 OpenAPI
      `description` 으로 내보내므로**, 정정 경위 같은 내부 서사를 JSDoc 에 적으면 API 문서에
      그대로 실린다. `alert-rule-response.dto.ts` 가 이번에 그 분리를 실제로 적용했지만
      (`20_05_42` W1) 규약에는 없다.

      > 위 두 planner 항목(`swagger.md` numeric 불변식 · `Float` 라벨)과 **같은 편집
      > 세션에 묶는다** — 셋 다 `swagger.md`/`1-data-model.md` 한 쌍을 건드린다.

- [x] **§5.4 가 WS wire 에도 적용되는가 — 답: producer 는 이미 지킨다 (2026-09-04 종결).**
      **추가 spec 변경 없음.**

      `chat-channel-adapter.md` §1.2 `EiaEvent` 종결 3종의 `durationMs?: number | null` 을 §5.4 위반으로 볼
      뻔했으나, **producer 와 consumer 의 계약이 다른 자리**였다:

      | 축 | 실측 |
      |---|---|
      | producer | **항상 키를 싣고 값을 모르면 `null`** — EIA §6 표(`14-external-interaction-api.md:594`)가 *"알 수 없으면 `null`"* 로 명시. **§5.4 의 null-present 그대로다** |
      | consumer 타입의 `?` | 배포 경계에서 **재생되는 레거시 이벤트에 키가 없어서**다. 필수로 만들면 타입이 현실보다 넓은 보장을 주장한다 — `chat-channel/types.ts:391-397` 이 근거를 적어 뒀고 **fixture 29개가 실제로 타입 오류를 냈다** |

      **같은 지적이 이미 한 번 미채택됐다** (`09_58_31` cross_spec W1 — `error.nodeId` 건과
      같은 판단). 이번 checker 도 INFO 로만 올리며 *"재-flag 하지 말 것"* 이라 적었다.

      → **§5.4 를 WS 로 넓히지 않는다.** 넓히면 consumer 타입에 producer 보장을 강요하게
      되고, 그건 이미 기각된 방향이다. 이 항목을 열 때 **기존 결정 기록을 먼저 읽지
      않았다** — 코드 주석과 EIA 표에 답이 이미 있었다.

- [x] **`QueryExecutionDto.workflowId` 죽은 필드 — 제거 완료 (2026-09-04).**
      사용자가 옵션 A(제거)를 선택했다.

      **결정을 가른 것은 "안 읽힌다" 가 아니라 "성립하지 않는다" 였다.** 엔드포인트 경로
      (`workflow/:workflowId`)가 이미 하나의 워크플로우로 한정하므로 쿼리 레벨 워크플로우
      필터는 개념적으로 존재할 수 없다 — 같으면 no-op, 다르면 항상 빈 결과. 그래서
      "고쳐서 살린다" 는 선택지가 애초에 배제됐고, 남은 것은 지우거나 두거나뿐이었다.

      **"무시되니 무해" 도 틀렸다** — `@IsUUID()` 때문에 읽지도 않는 값으로 400 을 냈다.

      영향: `forbidNonWhitelisted: true` 라 이 파라미터를 보내던 클라이언트는 200 → 400.
      다만 **결과는 전후가 같다**(필터가 한 번도 적용된 적 없음). 저장소에 코드젠 소비자
      없음·FE 미전송·spec 미약속을 실측 확인했다.

      부수: `swagger-dto-contract` 가드의 `@Transform` 예외가 **실사례 0건**이 됐다
      (1,095 필드 중 `@Transform` 17개, null 축 불일치 0). 예외는 남기고 픽스처가 분기를
      고정함을 뮤테이션으로 확인했다.

- [x] **`idx_schedule_next_run` → `(workspace_id, next_run_at)` 교체 완료 (2026-09-04, V110)**. 상세·수치·기각 근거는 **[`spec-draft-schedule-index.md`](../complete/spec-draft-schedule-index.md)**.

      | | 결과 |
      |---|---|
      | ~~(a) DROP~~ | 결론은 맞았으나 **근거가 틀렸다** — 부팅 쿼리(`WHERE is_active`)는 부분 인덱스 술어를 **함의한다**. 안 쓰이는 이유는 "못 써서" 가 아니라 활성 70%라 선택도가 낮아서다 |
      | ~~(b) 부분 조건만 제거~~ | **실측이 반증** — 플래너가 집어 들고 **2.2배 느려진다**(12.77 vs 5.92 ms). 정렬 컬럼을 선두에 둔 것이 원인 |
      | **(c) `(workspace_id, next_run_at)`** | **채택.** 5.99 → 0.30 ms (**20배**). 기본 정렬(`created_at`)도 6.89 → 1.08 ms |

      **등재된 두 선택지가 둘 다 답이 아니었다** — 진짜 갭은 이 인덱스가 아니라
      **`workspace_id` 인덱스의 부재**였고, 목록 조회가 매번 전 테이블을 훑고 있었다.

      spec 서술(`1-data-model.md` §3 + 미러 `data-flow/10-triggers.md` §2.1 + `## Rationale`)과
      마이그레이션 `V110__schedule_workspace_next_run_index.sql` **모두 이 PR 에서 완료**했다.
      e2e 가 인덱스 교체를 양방향으로 고정하고, 최적화 대상 쿼리(`GET /api/schedules`)의
      격리·정렬도 함께 검증한다. **잔여 없음.**

- [x] **`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험** — 규약화 완료 (2026-09-05).
      `migrations/README.md` §5 에 "인덱스 교체는 DROP-먼저" 패턴 + `migrations.md` §5 포인터.
      상세·실측은 [`spec-draft-migration-rerun-and-citations.md`](../complete/spec-draft-migration-rerun-and-citations.md) ①.
      종전 서술: (developer, `23_02_51` W1). `IF NOT EXISTS` 는 **이름만 보고 `indisvalid` 를 보지
      않는다.** 빌드가 실패해 남은 invalid 인덱스를 건너뛴 채 뒤이은 DROP 이 옛 인덱스를
      지우면 **쓸 수 있는 인덱스가 0개**가 된다 — Postgres 는 invalid 인덱스를 쿼리에 쓰지
      않으므로 seq scan 으로 조용히 회귀하면서 쓰기 비용만 낸다.

      **실증했다** (2026-09-04): UNIQUE + 중복 데이터로 `CREATE INDEX CONCURRENTLY` 를
      결정적으로 실패시켜 `indisvalid=false` 를 만든 뒤 종전 순서를 재현하니
      `NOTICE: ... already exists, skipping` 뒤 옛 인덱스가 삭제돼 최종 상태가 위와 같았다.
      CREATE 앞에 같은 이름의 DROP 을 두면 복구되는 것도 같은 프로브로 확인했다.

      V110 은 그 DROP 을 넣었다. **선례 `V056`·`V106` 에는 없다** — 이미 적용된
      마이그레이션은 append-only 라 수정 대상이 아니므로, 처리 위치는 다음 둘 중 하나다:
      - (a) `migrations/README.md` §5 + `spec/conventions/migrations.md` 에 **패턴으로 성문화**
        (앞으로 쓰는 CONCURRENTLY 교체는 DROP-먼저)
      - (b) 배포 런북에 `SELECT indisvalid FROM pg_index ...` 확인 절차 추가

      (a)(b) 는 배타적이지 않다. **`spec/conventions/` 쓰기는 planner 트랙**이라 이 항목은
      두 트랙에 걸친다.

      > **DROP-first 도 공짜가 아니다** (`23_26_09` W3). 그 DROP 은 대상이 invalid 잔재인지
      > **정상 인덱스인지 구분하지 않는다** — 구분하려면 `indisvalid` 를 읽고 분기해야 하는데
      > `DO` 블록은 트랜잭션이라 같은 파일에 `CONCURRENTLY` 와 둘 수 없다. 그래서 **이미 성공한**
      > 마이그레이션을 Flyway 흐름 밖에서 수동 재실행하면 살아 있는 인덱스를 재빌드한다.
      >
      > 즉 규약은 **두 위험 중 하나를 고르는 문제**다:
      >
      > | | 실패 후 재실행 | 성공 후 수동 재실행 |
      > |---|---|---|
      > | DROP-first 없음 (V056·V106) | **인덱스 0개** | no-op |
      > | DROP-first 있음 (V110) | 정상 복구 | 재빌드 구간 seq scan |
      >
      > V110 은 뒤쪽을 택했다(재빌드는 스스로 회복하지만 인덱스 0개는 안 낫는다). 규약은 이 선택을
      > 성문화하거나, `indisvalid` 확인을 런북 절차로 두어 **양쪽을 다 피하는** 길을 정해야 한다.
- [x] **코드 주석의 리뷰 세션 ID 인용** — 규약화 완료 (2026-09-05).
      `spec/conventions/review-citations.md` 신설 — 인용은 **유지**하되 **날짜를 요구**한다.
      상세는 [`spec-draft-migration-rerun-and-citations.md`](../complete/spec-draft-migration-rerun-and-citations.md) ②.
      종전 서술: (planner, `00_06_38` W2). 리뷰가 *"영구 코드 주석에 일시적 프로세스 식별자가
      새어 들어갔다"* 고 두 라운드 연속 지적했다. **실측하니 저장소의 오래된 관례였다**
      (2026-09-05): `origin/main` 의 `codebase/` 안에 `hh_mm_ss` 형태 인용이
      **104개 파일 · 508회** 있고, 가장 오래된 것은 `roles.guard.spec.ts` 의
      `review/code/2026/08/08/20_53_48` 이다.

      > **처음 이걸 세다가 "0건" 이라는 거짓 0 을 냈다** — `-E "\b[0-9]{2}_…"` 패턴이
      > 안 물었는데 그것을 "선례 없음" 으로 읽을 뻔했다. 존재가 확실한 문자열
      > (`20_16_17`)로 명령을 먼저 검증해서 잡았다.

      즉 이건 이 PR 이 만든 일탈이 아니라 **저장소가 이미 택한 방식**이다. 한 파일만
      다르게 쓰면 오히려 일관성이 깨진다. 결정이 필요한 것은 둘 중 하나다:
      - (a) 관례를 `spec/conventions/` 에 **성문화**한다 (세션 ID 는 `review/**` 산출물의
        영구 경로를 가리키므로 실제로는 해소 가능한 참조다)
      - (b) 앞으로는 PR 번호·커밋 SHA 로 바꾸기로 하고, 기존 508회는 그대로 둔다

      어느 쪽이든 **한 PR 이 단독으로 정할 일이 아니다** — 그래서 등재한다.

- [x] **`V110` 헤더의 "정상 흐름에서는 발생하지 않는다" 서술** — **(a) 로 종결 (2026-09-05).**
      `review/consistency/2026/09/05/10_57_56` W1 이 *"README §5 신설이 이 항목을 사실상
      답했는데 체크박스가 열려 있다"* 고 지적했고, 맞다.

      **무엇이 답이 됐나**: README §5 가 **두 경로 표**(수동 재실행 / `repair` + 재실행)로
      정정된 서술을 담고, 바로 아래에서 `V110` 을 그 패턴의 **선례**로 가리킨다. 즉 규약을
      찾아 읽는 경로에서는 정정된 문장을 먼저 만난다.

      **V110 파일 자신은 손대지 않는다** — append-only 이고, 그 SQL(3문장 순서)은 지금도
      옳다. 낡은 것은 헤더 **산문**뿐이다. 마이그레이션을 단독으로 열었을 때 그 시점의
      서술을 보게 되는 것은 이 파일만의 문제가 아니라 **append-only 기록의 일반 성질**이다.
      (b)(README 에 "V110 헤더는 이후 정정됐다" 한 줄 추가)는 그 일반 성질을 한 파일에만
      예외로 다루는 셈이라 택하지 않았다.

- [x] **Flyway `mixed=true` 도입 여부 — 결정: 도입하지 않는다 (A, 현행 유지).**
      2026-09-10 사용자 결정. `mixed=false` 를 유지하고 인덱스 교체는 계속 **(b) DROP-먼저**
      3문장 패턴을 쓴다. 실측·형태 비교의 원 출처는
      [`spec-draft-migration-rerun-and-citations.md`](../complete/spec-draft-migration-rerun-and-citations.md) §1.1~1.4.

      **결정 근거 — 2026-09-10 재실측이 비용/편익을 갈랐다**:

      | 잰 것 | 값 |
      |---|---|
      | 마이그레이션 총계 | 110 |
      | 실제 `CONCURRENTLY` 문 보유 | **31** (주석 포함 grep 은 43 — 12개가 주석-only) |
      | 현재 혼합(`DO $$` + `CONCURRENTLY`) 위반 | **0건** |
      | (c) 패턴의 즉시 수혜 파일 | **0개** — 앞으로의 교체 마이그레이션에만 쓸모 |

      즉 **이득은 미래형인데 대가는 즉시·전역**이다. 그리고 대가의 성격이 "가드가 없어진다" 보다
      나쁘다 — 저장소 실측 로그가 `-mixed=true` 통과 실행을 `[non-transactional]` 로 기록했다.
      즉 이 설정은 *"섞어도 된다"* 가 아니라 **"섞인 마이그레이션은 트랜잭션 없이 돌린다"** 다.
      가드의 값은 "섞는 것이 불가능하다" 가 아니라 **"섞이면 배포가 멈춘다 = 조용히 섞이지 않는다"**
      이므로, 전역 해제는 앞으로의 실수를 *거부* 에서 *조용한 원자성 상실* 로 바꾼다.

      (b) 가 남기는 비대칭(재실행 시 살아 있는 인덱스 재빌드)은 **끝나면 스스로 정상으로 돌아온다.**
      스스로 낫지 않는 쪽((a) 의 "쓸 수 있는 인덱스 0개")은 이미 (b) 규약으로 닫혀 있다.

      > **재고 신호는 빈도다.** 인덱스 교체 마이그레이션이 드문 동안은 (b) 의 수동 재빌드 비용이
      > 전역 가드보다 싸다. 교체가 잦아지거나 재빌드가 실제로 운영에 물린 사례가 나오면 다시 본다.
      >
      > **재고할 때 먼저 재야 할 것 (미검증으로 남긴다)**: `mixed=true` 가 **섞지 않은**
      > 마이그레이션의 트랜잭션도 건드리는가. Flyway 문서상으로는 실제로 섞인 것만 비-트랜잭션으로
      > 돌려야 하지만, 저장소 실측은 *섞인* 파일 하나가 `[non-transactional]` 로 돌았음만 보여준다 —
      > 나머지 109개 무영향은 **측정되지 않았다.** 답이 "전부" 라면 이 결정은 재고 대상조차 아니다.
      > 프로브: 저장소 이미지 태그로 `ALTER TABLE` 만 있는 파일을 `-mixed=true` 로 돌려 로그를 본다.
      > `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 는 유지할 것 — 빼면 hang 한다(지난 프로브가
      > 그걸 빠뜨려 잘못된 결론을 낼 뻔했다).
      >
      > **켠다면 어디를 고치나** (기록만): `docker-compose.yml`·`docker-compose.e2e.yml` 의
      > `migrate` 서비스 `command:` 배열, 그리고 `migrations/Dockerfile` 헤더의 `docker run` 예시
      > (K8s Job·CI 가 따르는 사용법). 세 곳에 흩뿌리는 대신 Dockerfile 에 `ENV FLYWAY_MIXED=true`
      > 한 줄을 두는 편이 일관되고, 같은 파일이 이미
      > `ENV FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 를 그렇게 박아 둔 선례가 있다 — 단 그
      > 방식은 되돌리려면 이미지 재빌드가 필요해 결정을 더 무겁게 만든다.
- [ ] **해소 불가 bare 인용 8건 채우기** (developer, 2026-09-05 등재).
      `review-citations.md` §2 가 금지한 형태 중 **실제로 여러 날짜에 걸려 해소가 안 되는**
      8개 시각. 날짜를 코드 컨텍스트로 하나씩 특정해야 해서 기계적 치환이 안 된다 —
      그래서 §4 의 "소급 정리 안 함" 과 별개로 이 8건만 따로 둔다.

- [x] **`spec/5-system/` 의 `## Overview` 유무 불일치** (planner, `--impl-prep 12_48_13` W1
      등재 2026-09-05). 12개 파일은 공유 `_product-overview.md` 와 **별개로** 로컬
      `## Overview` 를 두는데 6개(`2-api-convention` · `5-expression-language` ·
      `6-websocket-protocol` · `7-llm-client` · `11-mcp-client` · `16-system-status-api`)는 없다.
      CLAUDE.md 상 **"권장"** 이라 CRITICAL 은 아니지만 영역 안에서 갈린다. 둘 중 하나다 —
      - (a) 6개 파일에 로컬 Overview 를 추가해 맞춘다
      - (b) `project-planner/SKILL.md` 에 *"영역 공유 Overview 가 있으면 파일별 로컬 Overview
        는 생략 가능"* 을 명시해 **현 상태를 규약으로 인정**한다

      > **처분 (2026-09-05) — 원 전제가 반증됐고, (a)도 (b)도 아닌 제3의 처분을 냈다.**
      >
      > **"6개에 Overview 가 없다" 는 내용 결여가 아니라 제목 표기 분열이다** (실측):
      >
      > | 문서 | 개요 내용 | 형태 |
      > |---|---|---|
      > | `5-expression-language` · `7-llm-client` · `11-mcp-client` | **있음** | `## 1. 개요` |
      > | `16-system-status-api` | **있음** | 무제목 도입문 |
      > | `6-websocket-protocol` · `2-api-convention` | 없음 | — |
      >
      > 그리고 **저장소 전체로 보면 개별 파일의 `## Overview` 는 규범이 아니다** —
      > `_product-overview.md` 가 있는 영역은 안 두고(`2-navigation` 1/18 ·
      > `3-workflow-editor` 0/7 · `4-nodes` 0/2), 없는 영역만 전 파일에 둔다
      > (`data-flow` **16/16**). 지적의 전제는 **`5-system/` 한 영역만** 본 데서 나왔다.
      >
      > **(a) 기각**: 규칙 카탈로그형 문서에 제목만 얹고 아래 새 내용이 없으면 소음이다.
      > **(b) 기각**: SKILL.md 는 `.claude/` 아래라 planner 쓰기 권한 밖이고, 무엇보다
      > **그 문장이 이미 있다** — *"다중 spec 파일을 가진 영역은 `_product-overview.md`
      > 별도 파일"*. 새로 인정할 것이 없다.
      >
      > **실제 처분**: 이번 턴이 어차피 여는 `2-api-convention.md` 에만 추가.
      > `6-websocket-protocol.md` 는 아래 별도 항목으로 재등재.

- [x] ~~**`notification_secret_v2` 저장 형태 — spec 과 코드가 정면 모순**~~ (planner 인계,
      `19_08_19` Critical 1). **완료 — [#1290](https://github.com/worker-ants/clemvion/pull/1290)**
      (2026-09-05).

      > 인계 시 (a) 사실 정정+예외 등재 / (b) 코드측 ref 화 요구 를 planner 가 정하도록
      > 적었고, planner 턴이 **(a)** 를 택했다 — 다만 그 과정에서 인계문의 전제도 반증됐다.
      > 인계문은 *"§7.1 은 2026-05-22 에 확정된 보안 invariant"* 라 적었는데, 실제로는
      > 그 커밋이 넣은 **aspirational 서술**이었고 평문 rotation 코드가 그보다 앞섰다.
      > 두 컬럼의 비대칭도 `chat-channel.md` R-K 가 이미 결정해 둔 것이었다.
      >
      > 산출: §7.1 정정 · `secret-store.md §1` 세 번째 비대상 등재 · **§1.1 신설**
      > (저장 위치 예외 ≠ 노출 예외) · 정적 가드 `code:` 등재. 아래 세 항목이 그 턴이
      > 남긴 후속이다.

- [x] **트리거 회전 secret 이 응답에 나간다 — 유출 차단 코드** (developer, 2026-09-05 등재,
      `review/consistency/2026/09/05/19_59_16` **Critical 1**). **완료 — `sweep-response-contract`
      브랜치 전체가 그 수정이다.** (커밋 SHA 를 열거하지 않는다 — 리뷰 라운드마다 늘어서
      적는 순간 낡는다.)

      `Trigger.notification_secret_v2`(평문 서명 secret)와 `chat_channel_token_v2`(secret
      store ref)가 `GET/POST/PATCH /api/triggers` · `GET /api/schedules`(트리거 조인) 응답에
      **매 요청** 실린다. 엔티티를 그대로 반환하는데 컬럼 스트립이 없다(전역
      `ClassSerializerInterceptor`·`select:false`·`@Exclude()` 모두 0건).

      금지 규범은 이번 turn 이 `secret-store.md §1.1` 로 세웠다 — **저장 형태 예외(평문
      보관)와 노출은 다른 문제**이고, 예외 등재가 노출까지 승인하는 것으로 읽히면 안 된다.

      > **확인 후 닫는다** (등재문이 요구한 절차). 최종 상태는 **네 축**이다 — 등재 시점의
      > 이 문단은 둘만 적었는데, 같은 세션의 후속 리뷰가 나머지 둘을 찾았다:
      >
      > | 축 | 무엇 | 정화 함수 |
      > |---|---|---|
      > | 엔티티 컬럼 2개 | `notificationSecretV2`(평문) · `chatChannelTokenV2`(ref) | `deleteSecretColumns` |
      > | `config.chatChannel` | `botToken` 등 5키 (+`hasBotToken` 파생) | `stripChatChannelSecrets` |
      > | `config.notification.signing` | `secret` · `secretRef` | `stripNotificationSigningSecrets` |
      > | `config.interaction` | `triggerToken` (**영구 평문** `itk_*`) | `stripInteractionSecrets` |
      >
      > 넷 다 뮤턴트로 RED 를 실측했다(정화 함수를 항등으로 바꿔 5/5 kill — `narrowWorkflowRef`
      > 포함). 스케줄 컨트롤러는 조인된 트리거를 참조 4필드로 좁히고, 관계가 없으면 던진다.
      > unit 회귀도 있다 — 종전 fixture 에는 비밀 필드가 없어 스트립을 되돌려도 전부
      > 그린이었고, `chatChannel` 축은 리팩터 검증 중에야 같은 사각지대가 드러났다.
      >
      > **왜 넷이 한 번에 안 나왔나**: deny-list 를 목록으로 늘리는 방식은 **다음 축의
      > 이름을 미리 알아야** 하므로 원리적으로 닫히지 않는다. 그 구조적 결함은 위
      > 「트리거 비밀 스트립을 deny-list 4벌에서 선언적 SoT 로」 항목이 잇는다.
      >
      > `secret-store.md §1.1`(이번 planner 턴 신설)이 그 금지를 규범으로 세웠고, 이
      > 커밋들이 그것을 시행한다.

- [x] **`4-integration.md §9.1` — `IntegrationDto` 확장 필드 포인터** (planner,
      2026-09-05 등재, `19_08_19` W3 / `19_59_16` W3).
      대상 5필드 선언이 아직 `origin/main` 에 없다(`claude/sweep-response-contract-5ba0ad`).
      **그 브랜치 머지 후** §9.1 에 `1-data-model.md §2.10` 포인터 한 줄을 넣는다.
      `consecutiveNetworkFailures` 는 **FE 미소비 — 제거 후보로 별도 추적 중**이라는 캐비엇을
      함께 적어 나머지 4개와 동급으로 문서화하지 않는다.

      > **완료 (2026-09-10)**. 차단 전제가 풀린 것을 실측으로 확인하고(5필드가
      > `integration-response.dto.ts` 145~167행에 선언, `§2.10` 에 **5/5** 문서화, DTO 는 이미
      > spec-linked) §9.1 `GET /:id` 행에 경계 문장 + 포인터 + 캐비엇을 넣었다.
      >
      > **결함은 "5필드 미문서화" 가 아니었다** — 그 행이 *"`IntegrationDto` 는 다음 **두**
      > derived 필드를 포함한다"* 라고 적는데, 문자적으로는 참(나머지는 derived 가 아니라 컬럼
      > 투영)이라 **어떤 가드도 못 잡으면서** 소비자에게는 전수 목록으로 읽힌다. 그 경계를 명시했고
      > 원문은 지우지 않았다(왜 그 둘만 이 절이 소유하는지가 그 문장에 있다).
      >
      > **`--spec` 이 내 변경안을 네 군데 고쳤다** (`10_47_01`, BLOCK: NO · WARNING 3 + INFO 1):
      > 초안이 *"의미·**전이 규칙**·마이그레이션은 §2.10 이 SoT"* 라고 적었는데 §2.10 자신이
      > *"spec §6 전이의 구현 기반"* 이라며 §6 을 되짚는다 — **좁은 인벤토리 주장을 고치면서
      > 반대 방향의 넓은 SoT 주장을 만들 뻔했다.** 범위를 의미·마이그레이션으로 좁히고 전이 축은
      > §6·§11.1 로 명시했다. 나머지 셋: "왜" 를 `## Rationale` 로 이관(plan 이 봉인되면 근거가
      > 사라진다) · 삽입을 **개행 없이 한 줄로**(그 행은 단일 물리 라인이고 GFM 표는 리터럴 개행
      > 불허) · 캐비엇에 트래커 하이퍼링크(인접 서술 관례).
      >
      > **문서화 밀도가 고르지 않았다** — `tokenExpiresAt` 11회 · `lastRotatedAt` 5 · `mallId` 1 ·
      > `lastUsedAt` **0** · `consecutiveNetworkFailures` **0**. 그래도 필드별 산문을 늘어놓지
      > 않았다: §2.10 이 5/5 를 가지므로 중복 SoT 가 하나 늘 뿐이다.
- [x] **`1-data-model.md §2.8` — `notification_secret_v2` 저장 형태 명시** (planner,
      2026-09-05 등재, `19_59_16` INFO#2 / `20_17_57` W4). 그 행은 저장 형태를 안 적는데
      자매 행(`chat_channel_token_v2`)은 *"reference"* 라고 적어 **서술 밀도가 비대칭**이다.
      평문임을 한 줄로 명시하고 [`secret-store.md §1`](../../spec/conventions/secret-store.md)
      비대상 등재로 링크한다.

      > **완료 (2026-09-10, 배치 C-2)**. *"`secret://` ref 가 아니라 컬럼에 담긴 평문, 승격 시
      > `null` 로 비워진다"* + `secret-store.md §1` 비대상 등재 링크 + 자매 행
      > (`chat_channel_token_v2` = **reference**)과의 등급 차이(§R-K)를 적었다.
      > **노출 금지는 다시 적지 않았다** — `secret-store.md §1.1` 이 소유하고 `#1300` 이 그 창이
      > 닫혔음을 이미 정정했다. 저장 형태만 적는 것이 이 항목의 실질이다.
      > **같은 항목이 자매 plan 에 독자적으로 등재돼 있었다** —
      > `spec-draft-notification-secret-storage.md` 의 「후속 (이 PR 밖)」 마지막 bullet(같은 날,
      > 같은 INFO#2 근거). 배치 C 의 `--spec` 이 그 이중 등재를 잡아(`10_23_42` WARNING#1) 양쪽을
      > 함께 닫았고, 그 plan 은 잔여 0건이 되어 `plan/complete/` 로 이관했다.

- [x] **§5.4 래칫 canary fixture 를 `code:` 에 등재** (planner, 2026-09-05 등재,
      `review/consistency/2026/09/05/20_45_39` W1).

      `repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` 는 래칫의
      **양성 대조군**이다 — 그것이 없으면 술어가 죽어도 테스트가 통과한다(실제로 그 상태로
      한 라운드를 지났다). 그런데 어떤 spec 의 `code:` glob 에도 안 걸린다 (게이트에 직접
      물어 확인: 가드 본체는 ✓, fixture 는 ✗).

      `swagger-dto-contract*.ts` 가 못 덮는 이유는 둘이다 — glob 의 `*` 가 `/` 를 넘지
      않고, 파일명도 그 접두로 시작하지 않는다. **파일을 옮기거나 개명하는 것으로는
      해결되지 않는다**: 술어가 `/dto/responses/` 경로를 요구하므로 fixture 는 그 아래
      있어야 한다.

      → `2-api-convention.md` frontmatter `code:` 에
      `codebase/backend/src/repo-guards/__tests__/fixtures/**` 를 추가한다.

      > **완료 (2026-09-10, 배치 C-4) — 항목은 1개를 지목했는데 실측은 6개였다.**
      > 정본 게이트(`review_guard._spec_linked_changes()`)에 직접 물었다: fixture **0/5**,
      > 가드 본체 **9/13**. 미등재 가드에 `endpoint-path-conflict-wrap*.ts` 가 있었다 —
      > **`#1299` 의 A-4 가 고친 그 결함을, 이틀 뒤 `#1300` 에서 세 번째 가드를 만들며 다시
      > 비웠다.**
      >
      > **처방도 바꿨다.** 항목은 `fixtures/**` 한 줄을 지시했는데, `spec-impl-evidence.md` 자신이
      > *"넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지 않는 것과 같다"* 고 적고,
      > 실제로 `jsdoc-citation.fixture.ts` 의 소유자는 `review-citations.md` 라 다른 문서로 끌려간다.
      > → **소유 문서별 정밀 glob** 으로 4개 문서에 6항목 등재(`review-citations.md` 선례를 따라
      > `# 대조군(negative fixture) — …` 인라인 주석 부기).
      >
      > **결과 (게이트 재질의)**: fixture **0/5 → 5/5**, 가드 **9/13 → 11/13**.
      > 남은 2개는 아래 신규 항목이다.

- [x] **"노출 창이 아직 닫혀 있지 않다" 서술이 낡는다 — `secret-store.md §1` 과
      `14-external-interaction-api.md §7.1` 두 곳** (planner, 2026-09-05 등재,
      `review/consistency/2026/09/05/21_40_38` W2 · 대상 확장
      `review/consistency/2026/09/06/01_38_47` W1).

      그 문장은 **내가 직전 planner 턴에 쓴 것**이고, `sweep-response-contract` 브랜치가
      바로 그 창을 닫는다(`TRIGGER_RESPONSE_STRIP_COLUMNS` + `deleteSecretColumns` +
      스케줄 컨트롤러 좁히기). **그 브랜치가 머지되는 순간 현재형 서술이 거짓이 된다.**

      **대상이 하나가 아니다.** 종전 이 항목은 `secret-store.md §1` 만 지목하고 §7.1 은
      *"정정 이력 패턴의 출처"* 로만 언급했는데, **같은 현재형 서술이 §7.1 에도 복제돼
      있다** — *"현재 이 컬럼은 응답에도 나간다 … 이는 **미해결 결함**"*. 이 항목만 따라간
      planner 턴은 §7.1 을 거짓인 채로 남긴다.

      전수 확인 (2026-09-06):

      ```
      grep -rn "노출 창\|응답에도 나간다\|미해결 결함" spec/
      ```

      → 이 창을 서술하는 자리는 `secret-store.md §1`(2행)과
      `14-external-interaction-api.md §7.1`(2행) **둘뿐**이다. 나머지 매치는 다른 맥락
      (`2-navigation/6-config.md` 평문 hide 정책 · `5-system/1-auth.md` 초대 만료).

      → 두 곳 모두 §7.1 이 쓴 "정정 이력" 패턴을 준용해 *"이 창은 `#…` 로 닫혔다"* 와 커밋
      참조를 추가한다. 규범(§1.1)은 그대로 둔다 — 닫혔다고 규범이 사라지는 것이 아니다.

      > **완료 (2026-09-08, 배치 A-6)**. 두 자리 모두 원문 취소선 + "이 창은 `#1291` 로 닫혔다"
      > 정정. 근거 실측: `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` +
      > `shared/testing/schedule-trigger-ref.ts`(스케줄 조인 축). 규범(§1.1)은 건드리지 않았다.
      > **전수 재확인**: `grep -rn` 3패턴 → 취소선 밖 잔존 **0건**.

- [x] **`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화 — 완료 (2026-09-10, planner 턴).**
      반영: `3-schedule.md §4` 응답 형태 註(2행 표) + `2-trigger-list.md §3` 자매 註 +
      `§2.1` "연결된 워크플로우" 행에 데이터 출처. `--spec` `11_13_14` BLOCK:NO.
      `1-data-model.md §2.9.1` 은 택일에서 **탈락** — 키 생략은 wire 표현이고 §2.9.1 은 DB
      관계라, §4 에서 §2.9.1 을 NOT NULL 근거로 **인용**하는 쪽이 경계에 맞다.

      > **§5.4 (b) 의 위계를 한 번 뒤집어 적었다.** 초안은 *"생성 응답을 프런트엔드가 읽지
      > 않는다"* 를 **(b) 를 대체하는** 진짜 근거로 적었는데, `rationale_continuity` 와
      > `convention_compliance` 가 **독립적으로 같은 지점**을 짚었다: (b) 의 판정 기준은
      > "소비자가 부재를 정상 경로로 다룬다" 이고, "안 읽는다" 는 optimistic update 하나로
      > 무너지는 **우발적** 사실이다. 반영문은 (b) 의 기준(`?? ""` 폴백)을 먼저 세우고
      > "안 읽는다" 를 **극단적 인스턴스 + 재검토 신호**로 강등했다. 두 checker 가 같은 곳에
      > 수렴하면 등급(INFO)이 아니라 **수렴 자체**가 신호다.

      > **부수 등재 — 트리거 축에는 캐너리가 없다** (아래 신규 항목). 註를 쓰다가
      > 스케줄 축은 e2e 4건(양성 3 + 생성 음성 1)으로 고정되는데 **트리거 축은 0건**임을
      > 실측했다. 註는 그 비대칭을 숨기지 않고 적었고, 고정은 developer 항목으로 넘긴다.

      §5.4 는 **키 생략형에 사유 문서화**를 요구한다. 코드 쪽은 이번에
      정리했다 — `trigger` 는 상시 존재라 **기본형으로 바꿨고**, `workflow` 는 기준 (b)
      (선택적 부가 컨텍스트)에 해당해 사유를 필드 주석에 적었다. 남은 것은 그 사유를
      `spec/2-navigation/3-schedule.md §4`(또는 `1-data-model.md §2.9.1`)에 옮기는 것이다.
      `IntegrationDto` 포인터 항목과 대칭으로 처리한다.

      > **`TriggerDto.workflow` 도 같은 항목이다** (`22_25_00` W2). 같은 라운드에 신설된
      > 자매 키-생략 필드인데 이 bullet 이 스케줄 쪽만 적고 있었다 — 두 DTO 의
      > `trigger`/`workflow` 참조 필드를 한 묶음으로 다룬다. 반영 대상 spec 은
      > `2-navigation/2-trigger-list.md` 와 `3-schedule.md §4` 둘이다.

- [x] **`TriggerDto.workflow` 캐너리 — 완료 (2026-09-10, developer 턴).**
      계획서: [`../complete/trigger-workflow-ref-canary.md`](../complete/trigger-workflow-ref-canary.md).
      `shared/testing/trigger-workflow-ref.ts`(헬퍼) + `.spec.ts`(self-guard **12건**) +
      `test/trigger-workflow-ref.e2e-spec.ts`(**양성 4 + 생성 음성 1**, 라벨 `A.`~`E.`).

      **완료의 기계적 증거 — 예측대로 나왔다**: `chatChannel` 재조회에서 `relations: ['workflow']`
      를 지운 뮤턴트에서 **E 만 RED**(`Object.hasOwn(…,'workflow')` false), **A~D 는 GREEN**,
      원복 후 5/5 GREEN. 넷이 같이 RED 면 캐너리가 다른 것을 물고 있다는 뜻이라 **세 번째 줄이
      판별 증거**다. `backend-e2e` 가 baked 이미지라 뮤턴트마다 재빌드했고 원복은 `cp` 로 했다.
      4단계 전부 PASS(lint · build(ratchet 2개 baseline 일치) · unit 454스위트/**9,521** ·
      e2e 52스위트/305 + playwright 51).

      > **리뷰 반영으로 헬퍼를 바꾼 뒤 같은 실험을 다시 했다.** `expectedWorkflowId` 와 단언
      > 세 개를 더했으니 위 측정은 **옛 헬퍼에 대한 것**이 된다 — 그대로 두면 "판별한다" 가
      > 현재 코드에 대해 미검증이다. 뮤턴트 재주입 → `make e2e-up` → 재실행: **`Tests: 1 failed,
      > 4 passed`**(E 만 RED, 288ms) → 원복·재빌드 후 **5/5 GREEN**. 판별 속성 유지.
      > 늘어난 단언이 전부 `present: true` 분기 안쪽이라 부재 판정에 영향을 주지 않는다.

      > **`/ai-review`(`review/code/2026/09/10/14_34_18`) 가 내 근거 문장 셋을 반증했다.**
      > ① *"부재가 §5.4 키 생략형이라 `assertMatchesContract` 는 그 자리를 물지 못한다"* —
      > 그 검증자는 optional-non-nullable 필드의 `null` 을 **잡는다**. 참인 사실은 **"이 분기에
      > 그 검증자를 거는 기존 호출이 0건"**(무능이 아니라 미배선). ② *"`tsconfig.build.json`
      > exclude 라 dist 유출 없다"* — `exclude` 는 root 후보만 거르고, 프로덕션 파일이 `import`
      > 하면 **`dist/` 로 emit 된다**(reviewer 가 실제 `tsc` 로 재현). ③ *"`User` 투영 상수
      > 선례"* — 문면 일치 커밋 없음, 소급 부여였으므로 철회. **셋 다 "내가 쓴 근거" 였다.**
      >
      > **단언 하나는 vacuous 였다** (`testing` W3): `expect(typeof ref.name).toBe('string')` 을
      > 지워도 self-spec 8/8 GREEN — 뒤따르는 `String(ref.name).length` 가 `String(42)` 를
      > 통과시킨다. `id` 는 `isUuidShaped` 가 간접 방어하는데 `name` 엔 그것이 없다(**비대칭**).
      > 비-문자열 케이스 4건을 추가해 대조군을 만들고, 새 단언 셋을 각각 지우는 뮤턴트에서
      > **정확히 1건씩 RED** 임을 확인했다. self-spec 8 → 12.
      >
      > 그 밖에: 손으로 짠 UUID 정규식 → 정본 `isUuidShaped`(내 grep 이 `common/utils/` 를
      > 빠뜨렸다) · `it()` 라벨 숫자→문자(실측 — `origin/main` 의 e2e 순번 라벨은 20파일/132개가 전부 문자, 숫자는 내 파일 하나뿐) · identity 고정
      > (shape 만 보면 엉뚱한 relation 의 그럴듯한 UUID+이름이 통과) · 최상위 `null` 거부
      > (`toBeDefined()` 는 `null` 을 안 거른다) · 비밀 컬럼 목록을 self-spec 에 **일부러**
      > 다시 적는다는 명시(헬퍼 상수를 import 하면 목록이 줄어도 통과해 vacuous 가 된다).
      > `documentation` 은 이 세션의 **`--impl-prep` SUMMARY.md 누락**을 잡았다.

      > **등재 시 내가 쓴 처방 두 개가 틀렸다.** ① *"`webhook-trigger.e2e-spec.ts` 에 건다"* —
      > 그 파일은 수신 경로 전용이라 GET/PATCH 테스트가 없다(`it()` 18개 전수 확인). ② 네 자리에
      > 흩뿌리면 "이 축은 다섯 형태로 고정된다" 가 어느 파일에서도 안 읽힌다 → **전용 파일 신설**.
      > 그리고 `cross_spec` 이 **생성의 chatChannel 서브경로**(그쪽도 `relations` 없이 재조회)를
      > 짚어 음성 단언이 하나 늘었다.

      > **구현 중 사전 분석이 한 층 얕았다.** #5 PATCH 를 `{provider, uiMapping}` 으로 보냈다가
      > 400 이었다 — `ChatChannelConfigDto` 가 **`botToken` 을 필수**로 요구한다. 서비스 층
      > 검증 세 곳만 훑고 **DTO 층을 안 봤다.** 실측을 e2e 주석에 남겼다.

      > **비용 추정도 실측이 낮췄다.** telegram client 의 5초×3회 백오프를 근거로 #5 에 ~36초를
      > 예상했는데 **실측 271~302ms** 다 — e2e 망에서 DNS 가 즉시 실패해 timeout 까지 안 간다.
      > 넉넉한 타임아웃은 보험으로 유지했다(CI 망에서는 실제로 태울 수 있고, 그때 flaky 실패를
      > 재조회 분기 결함으로 오진하게 된다).

- [x] **planner: 캐너리 착지 후속 — 5건 중 4건 적용, 1건은 developer 로 재배정** (planner,
      2026-09-10 등재 → 같은 날 적용). **3번(`PROJECT.md`)만 이 표에서 빠져 아래 별 항목이 됐다** —
      역할 배정이 틀렸었다(그 문서는 developer 소유). 1·2·4·5 는 반영 완료.
      위 캐너리가 서면서 `spec/` 쪽에 남은 세 가지. **developer 가 직접 못 한다** —
      `--impl-prep` 의 세 checker 가 독립적으로 CRITICAL 을 올렸다: 자기-반증형 소정정 **조건 1
      불성립**(그 문장은 planner 가 썼다).

      | # | 대상 | 내용 |
      |---|---|---|
      | 1 | `2-trigger-list.md §3` | *"자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다 — … 이 비대칭을 함께 적는다"* 를 취소선 + 실측으로 정정. **비대칭 자체가 없어지므로 뒤 근거절까지 한 단위로** 낡는다 |
      | 2 | `2-trigger-list.md` frontmatter `code:` | `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` **+ `codebase/backend/src/shared/testing/trigger-workflow-ref*.ts`**(헬퍼·self-spec) 등재. `3-schedule.md` 선례 — *"註에 'e2e 가 고정한다' 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가다"*. **헬퍼까지 넣는 것은 `--impl-done` `15_23_41` convention_compliance W1 이 넓힌 범위다** — e2e 만 넣으면 단언의 정본(키셋·비밀 컬럼 목록)이 `code:` 밖에 남는다 |
      | ~~3~~ | ~~`PROJECT.md` §e2e 파일 위치~~ | **이 표에서 제외 — developer 소유 문서다.** 아래 별 항목으로 이관했다. 내용 자체는 그대로 유효하다 |
      | 4 | `2-trigger-list.md §3` 註 | **캐너리가 고정하는 것이 계약인지 구현인지** 한 줄. *"생성 응답에만 `workflow` 가 없다"* 는 §5.4 가 요구하는 계약이 아니라 **현재 구현의 반영**이고, 생성 응답도 싣도록 강화하는 것은 additive 개선이다 — 그런데 지금 캐너리는 그 강화를 RED 로 막는다. 프로세스 게이트로는 바람직하나 **spec 이 계약처럼 읽히게 두면 안 된다** (`api_contract` W2) |
      | 5 | `spec/5-system/14-external-interaction-api.md` §7.1 | **인벤토리가 낡았다.** 그 절의 2026-09-08 정정 문단은 *"`#1291` 이 응답 경계 스트립을 세웠고, 스케줄 조인 축은 `schedule-trigger-ref.ts` 가 같은 목록으로 단언한다"* 로 **단언 자리를 하나만 열거**한다 — 이제 트리거 직접 축에도 같은 두 컬럼의 부재를 무는 캐너리가 생겼다. 모순은 아니지만(그 문단이 "런타임 캐너리는 없다" 고 단언한 적은 없다) **열거가 불완전하면 다음 사람이 직접 축엔 정적 스트립만 있다고 읽는다** (`--impl-done` `15_23_41` cross_spec INFO) |

      > **왜 조건 1 이 깨졌나 — 판별 방법 자체가 틀렸다.** 초안은 *"`git blame` 으로 확인 가능"* 을
      > 근거로 들었는데, 이 저장소는 모든 역할의 커밋이 같은 author 라 **blame 은 역할을 구분하지
      > 못한다.** 실제 판별은 세 신호다 — diff 스코프(`codebase/` 0건) · 게이트 종류(`--spec`) ·
      > 소유 plan 의 `owner: planner`. 셋 다 planner 를 가리켰다.
      >
      > `#1292` 가 같은 패턴을 *"우회하지 않고 planner 턴을 열었다"* 로 올바르게 처리한 선례가
      > 있는데, 그 판단을 몇 시간 뒤 뒤집었다. **등재 문장 자체가 자기모순**이었던 것이 원인이다 —
      > *"조건 1~5 해당 — 그 문장은 planner 가 썼으므로…"*. **등재할 때 조항 해당 여부를 단정하지
      > 말 것.**
      >
      > 1번을 반영할 때 `rationale_continuity` 가 지적한 **조건 2 경계**(그 문장이 §5.4 판정 근거·
      > `id`/`name` 비대칭 계약과 한 문단에 섞여 있어 "예고 vs 계약" 이 애매하다)도 한 줄로 판정해
      > 기록할 것. 그리고 `3-schedule.md §4` 에 있는 **재검토 신호**(optimistic update 로 create
      > 응답을 소비하면 전제가 무너진다)가 트리거 축에는 없으니 그때 맞춘다.

      **적용 결과** (draft: `spec-draft-trigger-canary-nav.md`, `--spec` `19_35_47` BLOCK: NO):

      - **1·4** — §3 註의 *"캐너리가 아직 없다"* 와 뒤 근거절을 한 단위로 교체하고, **캐너리가
        고정하는 것이 계약이 아니라 현재 구현**임을 새 문단 + 신설 **`R-17`** 로 못박았다.
      - **2** — e2e + 헬퍼 glob 등재. **`3-schedule.md` 에도 헬퍼를 넣어 범위를 넓혔다**(아래).
      - **5** — EIA §7.1 인벤토리 보강. **`cross_spec` 이 같은 문장의 쌍둥이를
        `secret-store.md §1` 에서 찾아** 두 자리를 함께 고쳤다.
      - **조건 2 경계 판정**: *그 문장만 떼면 예고가 맞다 — 조건 2 는 충족했고 깨진 것은 조건 1
        뿐이다.* 문단 혼재는 조건 2 가 아니라 **조건 4**(정정 범위)가 다루는 문제다. 둘을 합쳐
        "애매하다" 로 두면 다음 사람이 조건 2 를 커버리지 진술에까지 넓게 해석한다.

      > **범위를 한 곳 넓혔다** — 헬퍼를 `code:` 에 넣는 근거("단언의 정본이 헬퍼에 있다")는
      > 축과 무관한 일반 규칙인데 트래커는 트리거 축만 적었다. 스케줄 축도 같은 gap 이 있어
      > (`schedule-trigger.e2e-spec.ts:12` 가 헬퍼를 import 하는데 `code:` 엔 e2e 만) 트리거
      > 축에만 넣으면 **두 문서 사이에 새 비대칭**이 생긴다 — 하필 §3 註가 원래 비대칭을 정직하게
      > 적으려던 자리다. `cross_spec` 이 이 확장을 관례 부합으로 확인했다.
      >
      > **`--spec` 게이트가 Warning 6건을 냈고 전부 내 근거 문장이었다**(편집 내용이 아니라).
      > 가장 아픈 것: *"취소선 보존은 자기-반증형 소정정 전용"* 이라는 내 일반화가 **같은 문서
      > R-2**(`#1299`, 순수 planner 턴)에 반증됐다 — 실제 판정축은 **교차문서 인용 의존**이다.
      > 그 축으로 실측하니 그 문장을 대조군으로 인용하는 문서가 0건이라 결론(교체)은 유지됐다.
      > 그리고 **W4 를 잘못 귀속**했다 — 음성 케이스를 지워도 W4 는 양성 case E 가 잡는다.
      > 개수도 틀렸다("양성 4건 … 셋 다" — 4+1=5). **spec 에 쓰기 전이라 수정 비용이 0 이었다.**

- [ ] **`PROJECT.md` §e2e 파일 위치 — self-spec 동반 헬퍼는 `src/shared/testing/`** (developer,
      2026-09-10 재배정. **원래 planner 후속 5건의 3번이었는데 역할 배정이 틀렸다**).

      현 문면(`PROJECT.md` §e2e 테스트 작성 가이드의 *"신규 헬퍼"* 줄)은
      `codebase/backend/test/helpers/<name>.ts` 뿐이다.
      **그 자리에 두면 self-spec 이 어느 러너에도 안 걸려 죽은 테스트가 된다** — unit jest 는
      `rootDir: 'src'` 라 `test/` 를 스캔하지 않고, `test/jest-e2e.json` 은 `testRegex:
      '.e2e-spec.ts$'` 라 평범한 `*.spec.ts` 를 안 잡는다. 즉 `test/helpers/*.spec.ts` 는
      **존재하지만 영구히 돌지 않는다.** `#1308` 이 그래서 `src/shared/testing/` 을 골랐고 근거를
      헬퍼 파일 스코프 註에 남겼다 — `PROJECT.md` 는 아직 그 예외를 모른다.

      처방: §파일 위치·명명 에 한 줄. *"self-spec(`*.spec.ts`)을 동반하는 assertion 헬퍼는
      `codebase/backend/src/shared/testing/<name>.ts` — `test/helpers/` 에 두면 그 self-spec 이
      어느 러너에도 안 걸린다"*.

      > **왜 developer 인가 — 실측이다.** `.claude/skills/developer/SKILL.md:33` 이
      > `| README.md, PROJECT.md | Read/Write |` 로 명시하고, `project-planner/SKILL.md` 경로 표에는
      > **항목 자체가 없다**(planner 거버넌스는 `.claude/docs/**`·`SKILL.md`·`CLAUDE.md` 뿐).
      > `--spec` `19_35_47` 의 세 checker 가 각각 독립으로 확인했다.
      >
      > **등재 근거였던 reviewer 문장이 틀렸다** — `--impl-done` `15_23_41` 의
      > `convention_compliance` 가 *"PROJECT.md 갱신은 planner 턴 권고"* 라 적었고 내가 그것을
      > **실측 없이 트래커로 옮겼다.** `#1308` 의 T-4 와 같은 클래스이고 방향만 반대다(그때는
      > planner 문장을 developer 턴에서 고치려 했다). 공통 원인은 **역할 배정을 실측 없이 단정한
      > 것**이고, 이 트래커에 이미 *"등재할 때 조항 해당 여부를 단정하지 말 것"* 이라 적혀 있었다.

- [ ] **질문: 비밀-부재 헬퍼를 `secret-store.md` 의 `code:` 에도 등재해야 하나** (planner 또는
      developer, 2026-09-10 등재, `--spec` `19_35_47` `cross_spec` INFO 에서 갈라 나옴).
      §5.4 의 원칙은 *"검증자가 **서로 다른 두 문서의 규칙**을 시행하면 그 두 문서 모두에 등재"* 이고
      사유는 *"한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다"* 다
      (`2-api-convention.md` 의 「엔티티를 그대로 노출하지 말 것」 시행 서술).

      두 헬퍼(`trigger-workflow-ref.ts` · `schedule-trigger-ref.ts`)가 시행하는 규칙은 (i) 각 nav
      문서의 참조 shape 와 (ii) **`secret-store.md §1.1`** 의 비밀 미노출인데, **(ii) 쪽 문서에는
      등재가 없다.** 판정에 필요한 것은 선례 실측이다 — `user-secret-absence.ts` 축이 규범 소유자로
      `1-data-model.md §2.1.1` 을 인용하는데 **그 문서 `code:` 에 등재돼 있는지** 확인하면 이
      원칙의 실제 적용 범위가 나온다.

      > **EIA `code:` 는 이 질문에 포함하지 않는다** — EIA §7.1 은 그 규칙의 **소유자가 아니라
      > 인용자**다(그 문단 자신이 *"금지 규범은 `secret-store.md §1.1` 이 그대로 소유한다"* 고 적는다).
      > `cross_spec` 은 EIA `code:` 등재도 INFO 로 제안했지만, 원칙 문면을 직접 읽으니 요구 범위가
      > 더 좁았다. **추측으로 넣지 않고 질문으로 등재한다.**

- [x] **CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다** — 질문으로 등재했고
      **같은 날 판정이 나왔다: 예, 실제 갭이다** (2026-09-10 등재 → `/ai-review`
      `14_34_18` `api_contract` ④ + `security` W2 가 독립 판정, developer 수정 대기).
      §5.4.1/R-CC-10 은 bot token 변경을 `POST /triggers/:id/chat-channel/rotate-bot-token`
      **단일 경로**로 규정하고 PATCH 의 `botTokenRef` 를 400 으로 막는다. 그런데 실측하니
      `ChatChannelConfigDto` 는 PATCH 에서 **plaintext `botToken` 을 필수로 받고**,
      `setupChatChannel` 이 그것을 `secrets.rotate(botTokenRef, …, chatChannel.botToken ?? '')`
      로 저장한다.

      **단정하지 않는다** — 두 갈래 다 가능하다: (a) 정책이 "ref 지정 금지" 만 뜻하고 값 교체는
      PATCH 로도 정상이다, (b) 24h grace 를 우회하는 실제 갭이다. **판정에 필요한 것**은
      `rotate-bot-token` 의 grace 처리와 이 경로의 `secrets.rotate` 가 같은 일을 하는지 대조하는
      것이다. 캐너리 스코프를 넓히지 않기 위해 질문으로만 등재한다. **전제는 이미 한 번 깨졌다**:
      `triggers.service.ts` 의 PATCH chatChannel 재조회 분기가 관계를 빼고 읽어
      **chatChannel 을 포함한 PATCH 응답에서만** `workflow` 가 사라졌다(리뷰
      `review/code/2026/09/06/01_13_50` W4). 구현은 그 재조회에 `relations: ['workflow']` 를
      실어 닫았지만 **회귀 테스트는 세우지 않았다** — 실측: `relations: ['workflow']` 를
      단언하는 테스트 0건(유일한 등장은 무관한 가드의 fixture
      `repo-guards/__tests__/fixtures/user-relation-load.fixture.ts`).

      부재가 §5.4 키 생략형이라 **응답-계약 검증자도 이 자리를 물지 못한다** — 값이 없어도
      계약 위반이 아니기 때문이다. 그래서 양성 대조가 유일한 방어다.

      처방: 자매 축의 정본을 그대로 답습한다 —
      `shared/testing/schedule-trigger-ref.ts` 의 `expectNarrowedScheduleTriggerRef(x, {withWorkflow})`
      패턴으로 트리거용 헬퍼를 만들고, `webhook-trigger.e2e-spec.ts` 에
      **목록·상세·PATCH(일반)·PATCH(chatChannel 포함) 양성 4 + 생성 음성 1** 을 건다.
      `chatChannel` 포함 PATCH 를 빼면 **정확히 그때 깨졌던 경로를 안 무는** 캐너리가 된다.

      **완료의 기계적 증거**: `relations` 를 지운 뮤턴트가 RED 여야 한다 — 오늘은 GREEN 이다.
      그리고 `spec/2-navigation/2-trigger-list.md §3` 註가 *"이 축에는 캐너리가 아직 없다"* 고
      적고 있으니, 캐너리를 세우면 **그 문장도 함께 정정**해야 한다(자기-반증형 소정정 조건 1~5
      해당 — 그 문장은 planner 가 썼으므로 planner 턴이거나 `--impl-done` 스코프로 훑는다).

      > **위 두 단락은 등재 시점 서술이고 지금은 낡았다.** 캐너리 처방은 별도 항목으로 완료됐고
      > (거기 적힌 `webhook-trigger.e2e-spec.ts` 배치는 실측으로 기각), 마지막 문장의
      > *"조건 1~5 해당"* 판정은 **틀렸다**(그 문장은 planner 가 썼다 → planner 후속으로 이관).
      > 남는 것은 **bot token 우회 판정**뿐이고, 그 판정이 아래에 있다.

      ### 판정: **예** — `botTokenRef` 만 막히고 값을 나르는 `botToken` 은 안 막힌다

      `assertChatChannelInputSafe` 는 `botTokenRef`·`inboundSigningRef`·`inboundSigning`
      **세 필드만** 400 으로 막는다. 그런데 실제 토큰 **값**을 나르는 `botToken` 은
      `ChatChannelConfigDto` 에서 **필수**(`@IsOptional()` 없음)이고 PATCH·POST 가 같은 DTO 를
      쓴다(`UpdateTriggerDto.chatChannel` 도 `PartialType` 이 아니다). `update()` 는 바디에
      `chatChannel` 이 있으면 무조건 `setupChatChannel` 을 부르고, 거기서 **기존 값과 비교 없이**
      `secrets.rotate(botTokenRef, ws, cfg.botToken ?? '')` 로 같은 ref 의 plaintext 를 덮는다.
      최종 효과가 `rotateBotToken` 과 **동일**한데 다음 셋을 건너뛴다:

      | 건너뛴 것 | 정식 경로 | PATCH 경로 |
      |---|---|---|
      | 24h grace 백업 | 교체 전 기존 토큰을 `v2Ref` 에 백업 | **백업 단계 자체가 없다** — 새 토큰이 401/403 이어도 되돌릴 수단이 없고 `chatChannelHealth=degraded` 로만 남는다 |
      | 전용 audit action | `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` | 일반 `TRIGGER_UPDATED` 만. **§5.4.1 이 PATCH 차단의 이유 (c) 로 든 "audit 이 mixed 된다" 가 지금도 재현된다** |
      | `chatChannelRotatedAt` | 갱신 | 미갱신 — 응답 DTO 의 "마지막 회전 시각" 이 거짓이 된다 |

      **처방은 `spec-draft-chat-channel-patch-token.md` 의 D-1·D-2·D-3 을 따른다** (planner 턴
      2026-09-10 확정, `--spec` `20_29_00`). **종전에 이 자리에 적혀 있던 처방("PATCH 전용
      `ChatChannelConfigDto` 변형(`botToken` 제외)")만 구현하면 저장된 봇 토큰이 파괴된다** —
      `update()` 가 `chatChannel` 있으면 무조건 `setupChatChannel` 을 부르고, 그 안에서 조건 없이
      `secrets.rotate(botTokenRef, ws, cfg.botToken ?? '')` 를 실행하며, `SecretResolver.rotate` 에
      **빈 값 가드가 없다**(`cross_spec` 이 세 고리를 독립 재현). 즉 **오늘 토큰을 지키고 있는 것이
      바로 이 400 버그**이고, 필드만 빼면 보이는 실패가 조용히 비밀을 지우는 실패로 바뀐다.

      요약: **D-1** PATCH 의 `chatChannel` 은 비밀 값(`botToken`·`inboundSigningPlaintext`)을 받지
      않는다(present → 400, **PATCH 한정**) · **D-2** PATCH 경로는 비밀을 쓰지 않는다(관측 계약:
      그 요청 전후로 두 비밀이 동일) · **D-3** ref 는 보존이 아니라 `buildSecretRef` 재유도로 살아남는다.
      **`inboundSigningPlaintext` 도 함께 막는 이유**는 slack/discord 가 그 값을 매 PATCH 마다
      필수로 요구하고 회전시켜 §5.4.1.1 의 "v1 차단" 을 어기고 있기 때문이다(구조 동일한 두 번째 우회).

      > **(2026-09-10 정정 — telegram 은 D-2 의 대상이 아니다.)** 위 D-2 를 문자 그대로
      > *"PATCH 경로는 비밀을 안 쓴다"* 로 읽어 `setupChatChannel` 의 **세 번째** 쓰기 지점
      > (`triggers.service.ts:987-993`, `result.issuedInboundSigning` 재저장)까지 게이팅하면
      > **그 트리거의 인입 웹훅이 전부 401 이 된다** — telegram adapter 가 `setupChannel` 마다
      > 새 `secret_token` 을 Telegram 에 등록하므로(`telegram.adapter.ts:73`) 저장을 건너뛰면
      > DB 는 옛 값, Telegram 은 새 값이 된다. **게이팅 대상은 `:948-952`(bot token rotate)와
      > `:957-969`(slack/discord provider-issued) 둘뿐이고 `:981-993` 은 무조건 유지한다.**
      > SoT: [Chat Channel §5.4.1.1](../../spec/5-system/15-chat-channel.md#5411-inboundsigning-patch-정책--회전-주체별-분기) ·
      > planner 턴 `plan/complete/spec-draft-telegram-signing-carveout.md`
      > (`--impl-prep` `review/consistency/2026/09/10/21_37_56` 가 이 결함을 CRITICAL 로 잡았다).

      > **✅ 2026-09-11 해소.** 구현 PR `impl-chat-channel-patch-token` — D-1(`ChatChannelUpdateConfigDto`)·
      > D-2(`storeUserSuppliedSecrets` 게이팅, 쓰기 ①② 만)·D-3(ref 재유도) 적용. 두 항목은 예고대로
      > **한 수정으로 함께 닫혔다.** 근거: `plan/{in-progress → complete}/impl-chat-channel-patch-token.md` (마무리 커밋에서 이동) ·
      > `review/code/2026/09/10/23_55_23` · `review/consistency/2026/09/10/23_54_09`(`--impl-done` BLOCK: NO).

      **착수 시 함께 정리할 것 세 가지.** ⓪ `2-trigger-list.md §3` 註의 "다섯 케이스" 서술을
      재확인한다 — 처방이 case E 의 요청 바디를 바꾸지만 그 구조 자체는 무효화되지 않는다는 것이
      `--spec` `19_35_47` `plan_coherence` 의 판정이고, 그래도 문구는 그 PR 에서 확인할 것.
      ① `test/trigger-workflow-ref.e2e-spec.ts` 의 case E
      요청 바디는 이 결함을 재현하는 형태라 처방이 들어오면 **400 이 된다** — 같은 PR 에서
      바디를 고쳐야 한다. ② 그 case E docstring 에 붙인 R-CC-10 우회 경고 블록도 그때
      **정리 대상**이다. 지금 그 블록은 *이 저장소에서 우회 메커니즘을 서술한 유일한 `codebase/`
      자리*이고(그 전엔 plan·review 문서에만 있었다), 결함이 닫히면 존재 이유가 사라진다
      (`review/code/2026/09/10/15_52_06` security INFO).

      > **판정 전 내 서술이 한 칸 좁았다.** 등재문은 *"24h grace 를 우회하는지 아니면 정책이
      > 'ref 지정 금지' 만 뜻하는지"* 로 두 갈래를 세웠는데, **실제 답은 둘 다**였다 — 정책이
      > 강제되는 층은 필드명 수준이고(ref 금지), 정책이 **보호하려는 대상**(값 교체 자체)은
      > 강제되지 않는다. "어느 쪽이냐" 가 아니라 **"강제되는 층과 보호 대상이 다른 층에 있다"**
      > 가 판정이다. 캐너리 스코프를 넓히지 않고 질문으로 등재한 판단 자체는 reviewer 도
      > *"적절하다"* 고 확인했다.

- [x] **버그: `ChatChannelCard` 편집-저장이 항상 400 이다** (developer, 2026-09-10 등재,
      `/ai-review` `14_34_18` `api_contract` ⑤ — 위 ④ 조사 중 부수 발견).
      `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 의 `saveMutation`
      은 uiMapping·rateLimitPerMinute·languageLocale·languageHints 만 편집하는 UI 인데, PATCH
      바디에서 `botToken` 을 **의도적으로 생략**한다. 코드 주석이 그 가정을 적고 있다 —
      *"botToken 없으면 botTokenRef 유지"* · *"single-path 정책상 PATCH 로 토큰 변경 불가"*.
      **그런데 서버 DTO 는 `botToken` 을 필수로 요구한다**(위 ④). 즉 사용자가 그 카드에서
      무엇이든 편집하고 저장하면 **항상 400** 이고 `onError` 의 "저장 실패" 토스트만 뜬다.

      **두 축이 서로 다른 방향에서 같은 결론을 가리킨다** — DTO 선언(정적) + 이 캐너리 e2e 를
      쓰며 내가 부딪힌 실측(런타임, 같은 필드: `{provider, uiMapping}` 으로 보냈다가 400
      `chatChannel.botToken must be a string`). 이 컴포넌트에는 단위 테스트가 없고 backend e2e·
      Playwright 어디에도 "uiMapping 만 PATCH" 경로가 없어 지금까지 감지되지 않았다.

      > **프런트를 고치는 방향은 막혀 있다.** 서버가 `botToken` 을 응답에서 strip 하므로
      > (`writeOnly: true`) 프런트는 재전송할 값을 **가질 수 없다**. 위 ④ 의 DTO 분리가
      > 프런트 코드를 그대로 두고 백엔드 검증을 프런트의 (원래 의도했던) 가정에 맞추는
      > 유일한 해법이다 — **두 항목은 한 수정으로 닫힌다.**
      >
      > **(2026-09-10 정정)** *"프런트 무수정 통과"* 는 **telegram 한정으로만 참이었다.**
      > slack/discord 는 `inboundSigningPlaintext` 필수-누락으로 **여전히 400** 이다 — 그 카드는
      > 그 필드도 안 싣는다. 세 provider 모두 통과하려면 위 처방의 **D-1 이 그 필드까지 포함**해야
      > 한다(`--spec` `20_13_39` `rationale_continuity` W2). 이 항목은 **구현 전까지 열려 있다** —
      > spec 변경만으로는 닫히지 않는다.
      >
      > reviewer 는 정적 대조로만 확인했다(뮤테이션 규약상 저장소를 건드리지 않음). 나도 그
      > 컴포넌트 코드를 직접 열어 `botToken` 생략과 두 주석을 확인했지만 **브라우저에서
      > 재현하지는 않았다.** 착수 시 먼저 재현할 것 — 재현 실패는 부재의 증거가 아니지만,
      > 반대로 재현 없이 "항상 400" 을 확정으로 적는 것도 한 칸 넓다.
      >
      > **(2026-09-11 재현 결과)** 브라우저 대신 **전역 파이프에 카드 바디를 그대로 통과시켜**
      > 실측했다(`trigger-dto-validation.spec.ts`) — 세 provider 전부 400 이었고, 구현 후에는
      > 세 provider 전부 통과한다. 그 대조가 `it.each(['telegram','slack','discord'])` 로 고정돼 있다.
      > **✅ 2026-09-11 해소.** 구현 PR `impl-chat-channel-patch-token` — D-1(`ChatChannelUpdateConfigDto`)·
      > D-2(`storeUserSuppliedSecrets` 게이팅, 쓰기 ①② 만)·D-3(ref 재유도) 적용. 두 항목은 예고대로
      > **한 수정으로 함께 닫혔다.** 근거: `plan/{in-progress → complete}/impl-chat-channel-patch-token.md` (마무리 커밋에서 이동) ·
      > `review/code/2026/09/10/23_55_23` · `review/consistency/2026/09/10/23_54_09`(`--impl-done` BLOCK: NO).

- [x] **§5.4.1 · §5.4.1.1 의 `details.field` 문면이 실제 페이로드와 다를 수 있다** (planner,
      2026-09-10 등재, `--spec` `20_13_39` `cross_spec` W1 + `20_29_00` `convention_compliance` INFO).
      두 절은 `details.field='botTokenRef'` 처럼 **접두어 없는 flat** 이름을 적는데, 그 세 내부 필드는
      DTO 에 `@IsEmpty()` 가 붙어 있고 `CustomValidationPipe` 가 **전역 `APP_PIPE`**(`app.module.ts:202`)라
      서비스 가드보다 먼저 거부한다. 파이프의 `flattenErrors` 는 중첩 경로(`parent.child`)를 만들므로
      **실제 emit 은 `chatChannel.botTokenRef` 형태일 가능성이 높다** — 즉 규약(`3-error-handling.md §2.1`
      *"중첩/배열 경로를 유지한다"*)을 벗어난 것은 **구현이 아니라 spec 문장**일 수 있다.

      **추측으로 고치지 않는다** — e2e 로 실제 400 페이로드를 캡처해 확정한 뒤 두 절을 정정한다.
      > **✅ 2026-09-11 실측 완료 — 단 답은 하나가 아니라 「값의 형태에 따라 둘」이다.**
      >
      > | 보낸 값 | 어디서 거부되나 | `details.field` |
      > |---|---|---|
      > | 비어있지 않은 문자열 | 전역 `CustomValidationPipe` | **중첩 경로** (`chatChannel.botToken`), `details` 는 **배열** |
      > | `null` · `''` | `@IsEmpty()` 를 **통과**해 서비스 가드 | **flat** (`botToken`), `details` 는 **단일 object** |
      >
      > **처음에 이 각주는 "다섯 필드 전부 중첩 경로" 라고만 적었다 — 비어있지 않은 값만
      > 재고 일반화한 것이라 과했다**(`/ai-review` `review/code/2026/09/10/23_55_23`
      > `requirement` W 가 잡았다). 정정한 값이 위 표다.
      >
      > 비어있지 않은 값 갈래의 다섯 필드: `chatChannel.botToken` ·
      > `chatChannel.inboundSigningPlaintext` · `chatChannel.botTokenRef` ·
      > `chatChannel.inboundSigningRef` · `chatChannel.inboundSigning`.
      > 정본은 `trigger-dto-validation.spec.ts` 의 **두 `[실측]` 케이스** — 전역
      > `CustomValidationPipe` 에 실제 바디를 통과시켜 잰 값이라 추측이 아니다.
      > **planner 는 두 갈래를 다 적어야 한다** — 한쪽만 적으면 이 각주가 처음에 그랬듯
      > 다음 사람이 반대 갈래에서 틀린 문서를 읽는다.
      >
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-chat-channel-drift-3.md` (`--spec` `review/consistency/2026/09/11/{07_11_12,07_22_40}`).
      > **축은 둘이 아니라 셋이었다** — 반영하며 `details[].code` 를 새로 쟀다: 파이프는
      > 원소마다 `INVALID_FIELD` 를 싣고 **서비스 가드는 `code` 를 아예 안 넣는다**
      > (`validation.pipe.ts:58` vs `triggers.service.ts:655,662,670,702,710`).
      > 반영 자리: `15-chat-channel.md` §5.4.1·§5.4.1.1 · `2-trigger-list.md` PATCH 註·§2.3.1.
      > **`providers/{slack,discord}.md` 의 flat 표기는 손대지 않았다** — 그 둘은 **생성 시점
      > 서비스 가드**(hex 정규식)를 서술하므로 flat 이 맞다. 형식만 보고 일괄 치환했으면
      > 맞는 문서를 틀리게 만들었다. 서비스 가드(`assertChatChannelInputSafe`)는 **flat** 이름을 쓰지만
      > 파이프가 먼저 거부하므로 **HTTP 응답에 나가는 것은 중첩 경로**다.
      > **남은 것은 planner 의 문면 정정뿐**: `15-chat-channel.md` §5.4.1·§5.4.1.1 의
      > placeholder 와 flat 표기, `2-trigger-list.md:119-120,176`.

      **(2026-09-10 범위 확대)** 캡처 대상은 신규 2필드(`botToken`·`inboundSigningPlaintext`)뿐
      아니라 **기존 3필드**(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)까지 **5필드 전체**다
      — 기존 3필드의 표기(`details.field='botTokenRef'` 등)는 캐비아트 없이 확정 서술이라 더 위험하다
      (`--spec` `review/consistency/2026/09/10/22_04_23` `convention_compliance`+`plan_coherence` INFO).
      `spec-draft-chat-channel-patch-token.md` 의 변경안 A·C 는 그래서 그 칸에 값을 쓰지 않고
      *"미확정 — 후속 e2e 확인 대기"* placeholder 를 남겼다(`3-error-handling.md §2.1` 의 "계획(Planned)"
      표기 선례).

- [ ] **`assertChatChannelInputSafe` 의 세 분기가 dead code 일 수 있다** (developer, 2026-09-10 등재,
      위 항목과 같은 실측에서 갈라졌다).
      `botTokenRef`·`inboundSigningRef`·`inboundSigning` 은 DTO `@IsEmpty()` + 전역 파이프가 먼저
      거부하므로 그 서비스 가드에 도달하지 못할 가능성이 높다. **살아 있다는 착시가 위험하다** —
      다음 사람이 그 자리를 방어선으로 오인하고 파이프 쪽 선언을 지우면 실제 구멍이 열린다.
      처방: 도달 가능성을 실측(뮤테이션 또는 e2e)하고, 도달 불가면 **가드를 지우고 그 사실을 주석으로
      남기거나** 파이프 선언과 가드 중 하나를 SoT 로 정한다.

      > **✅ 2026-09-11 실측 — 추측을 확정으로 바꾼다. 단 결론은 「도달 불가」가 아니다.**
      >
      > | 보낸 값 | 어디서 거부 | `details.field` |
      > |---|---|---|
      > | 비어있지 않은 문자열 | **전역 파이프가 먼저** | 중첩 `chatChannel.<field>` (배열) |
      > | `null` · `''` | `@IsEmpty()` **통과** → **서비스 가드** | flat `<field>` (단일 object) |
      >
      > 즉 **세 분기는 dead code 가 아니다** — `null`/`''` 갈래에서 실제로 도달한다.
      >
      > **(2026-09-11 재정정 — 위 문장의 첫 판본이 거짓이었다.)** 처음에 근거로 든
      > `triggers.service.spec.ts` 의 4조합은 **신규 2필드**(`botToken`·`inboundSigningPlaintext`)
      > 만 덮고 **이 항목의 대상인 내부 3필드는 하나도 걸지 않았다.** 세 가드를 전부 falsy
      > 체크로 완화한 뮤턴트에 **207개가 그대로 GREEN** 이었다(reviewer 가 먼저 실측했고 나도
      > 재현했다 — `/ai-review` `review/code/2026/09/11/01_27_26` testing W).
      > **그 뒤 3필드 × 2값 6조합을 추가했고, 같은 뮤턴트에 RED 6건**을 확인했다.
      > 신규 2필드만 채우고 자매 3필드를 안 본 것이라, 이 세션이 반복한
      > **"축은 대칭인데 한쪽만"** 의 또 한 번이다.
      > **그래서 가드를 지우지 않았다.** 이 항목이 세운 *"도달 가능성이 높다(=파이프가 먼저
      > 거부한다)"* 는 전제는 **비어있지 않은 값 갈래에만** 참이었다 — 한 갈래만 보고 전체를
      > 판정하려던 것이 이 항목 자체의 결함이다.
      >
      > **✅ 2026-09-11 그 결정을 했다 — 답은 「정하지 않는다」다.**
      > 두 층은 **서로 다른 입력**을 받는다(비어있지 않은 값 vs `null`/`''`). 하나를 SoT 로
      > 고르면 **다른 입력에서 문서가 거짓**이 되므로, *"갈린다"* 는 사실 자체가 확정 설계다.
      > 그 문장을 `15-chat-channel.md` §5.4.1 에 명시했다
      > (`plan/complete/spec-draft-chat-channel-drift-3.md`).
      >
      > **이 항목은 아직 열려 있다** — 남은 것은 **가드 자체의 처분**(도달하므로 지우지 않는다는
      > 것은 확정됐고, 서비스 가드가 `details[].code` 를 안 싣는 갭은 **코드 사안**이다).
      > 아래 신규 항목으로 갈라 두었다.

- [ ] **§5.4.1 표 2행(활성화 PATCH 가 `setupChannel` 재호출)이 구현과 어긋날 수 있다** (planner + 조사,
      2026-09-10 등재, `--spec` `20_13_39` `cross_spec` W2).
      그 행은 *"트리거 활성화(`PATCH {isActive:true}`) — `setupChannel()` 재호출, 기존 `botTokenRef`
      그대로 사용"* 이라 적는데, `update()` 는 `if (chatChannel)` 로 게이트돼 있고 isActive 토글의 실
      호출부는 `chatChannel` 을 싣지 않는다. **그러면 그 재호출이 일어나지 않는다.**
      판정에 필요한 것: 활성화 시 provider webhook 재등록이 필요한지(필요하면 구현 결함, 불필요하면
      spec 문장 결함). `spec-draft-chat-channel-patch-token.md` 는 이 불확실성 때문에 그 행을 **D-2 의
      선례로 인용하지 않았다.**

- [x] **`chat-channel-adapter.md §1.1` 의 `setupChannel` "멱등 = yes" 표기에 각주가 필요하다**
      (planner, 2026-09-10 등재).
      > **중복 등재였다 — 아래 같은 항목으로 병합해 거기서 종결했다.** 2026-09-11 에 같은 내용이
      > 한 번 더 등재돼 이 트래커 안에 두 줄로 존재했다(`--spec` `09_29_33` plan_coherence 확인).
      > 처분은 아래 「`setupChannel` "멱등 = yes" 에 각주가 필요하다」 항목을 볼 것.

- [x] **`swagger.md §1` 에 "부분 갱신 DTO 는 `Update` 접두 — `Patch` 금지" 를 규약으로 승격할지**
      (planner + 결정, 2026-09-10 등재, `--spec` `review/consistency/2026/09/10/22_04_23`
      `naming_collision` INFO). 현재 저장소에 `Patch` 접두 클래스는 **0건**이고 관례는 `Create`/`Update`
      축인데 **명문 규칙은 없다**(실측). 규약 신설은 별 결정 사안이라 이 자리에만 등재한다.
      **함께 결정할 것 (2026-09-11)**: `Update` 가 **접두어여야 하는가**도 같이 정한다 —
      저장소의 기존 Update DTO 18개는 전부 접두어인데 `ChatChannelUpdateConfigDto` 는 중간에
      둔다(형제 nested DTO 의 로컬 `ChatChannel<Role>Dto` 패턴을 따랐다). checker 도
      *"명문 규칙 부재라 위반은 아님"* 으로 판정했다.
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-chat-channel-conventions.md` (`--spec` `review/consistency/2026/09/11/09_29_33`, BLOCK: NO).
      > **결정: 접두는 「top-level 요청 바디」 집합에만 건다.** `swagger.md` 신규 `§1-7` +
      > `## Rationale` 대응 절. `Update*Dto` 18개가 전부 접두인데 **동시에 전부 컨트롤러
      > `@Body()` top-level 요청 바디**라는 것이 실측이고, 그것이 그 집합의 성질이다 —
      > `ChatChannelUpdateConfigDto` 는 `OmitType` nested 변형이라 다른 집합이다. 개명은 기각.
      > `§5-4` 새 엔드포인트 체크리스트에도 한 줄 넣었다. 반례로 `ChatChannelUpdateConfigDto`
      > 를 규약 본문에 직접 인용했다(`--spec` `09_29_33` INFO 2 — 다음 편집자가 같은 조사를
      > 반복하지 않게).
      >
      > **부수는 여기서 닫지 않는다 — 아래 별 항목으로 갈랐다.** 원래 이 항목에 "부수" 로
      > 딸려 있던 `chat-channel-config.dto.ts` 의 `swagger.md:315` 인용 정정은 `codebase/**`
      > 라 planner 권한 밖이고, **이 항목을 종결하면 함께 사라진다**(`--spec` `09_29_33`
      > plan_coherence WARNING 2 의 핵심 지적).

- [ ] **telegram inbound-signing 재발급이 `1-auth.md §4.1` 전용 audit action 카탈로그 밖이다**
      (planner, 2026-09-10 등재, `--spec` `review/consistency/2026/09/10/22_14_27` `cross_spec` INFO).
      **draft 이전부터 있던 갭**이고 telegram carve-out 이 새로 만든 것이 아니다 — §4.1 또는 CCH-SE-03
      근처에 *"server-issued 재발급은 전용 audit action 대상 제외"* caveat 한 줄이면 닫힌다.

- [x] **spec 10곳이 `SecretResolver.store()` 라 적는데 실제 호출은 전부 `rotate()` 다**
      (planner, 2026-09-11 등재, `--impl-prep` `review/consistency/2026/09/10/22_45_26` +
      `--impl-done` `review/consistency/2026/09/10/23_54_09` `cross_spec` W2).
      **실측**: chat-channel 비밀 저장 호출 6개 지점이 **전수 `rotate()`** 이고 `secrets.store(` 는
      **0건**이다(`store()` 자체는 `secret-resolver.service.ts:112` 에 존재하나 이 경로가 안 부른다).
      canonical 정의(`conventions/secret-store.md §2`)도 `rotate()` 를 권장한다 — `setupChannel()` 은
      생성·활성화·`chatChannel` PATCH 세 갈래에서 반복 호출되는 멱등 함수라, 문자 그대로 `store()`
      라면 두 번째 호출부터 깨져야 한다. 대상: `15-chat-channel.md:200,201,373,390` ·
      `chat-channel-adapter.md` §2.4 `SetupResult` 서술 · `providers/telegram.md:58,219` · `providers/slack.md:278`.
      정답 표기 선례는 `data-flow/14-chat-channel.md` 의 *"secret store UPSERT"*.

      > **(2026-09-11) `codebase/**` 3곳은 이 PR 에서 이미 고쳤다** — 원 열거가 `spec/` 만
      > grep 해서 놓쳤던 자리다(`/ai-review` `review/code/2026/09/11/01_27_26` documentation W):
      > `slack.adapter.ts:65` · `triggers.service.ts:755` · `chat-channel-config.dto.ts:252`.
      > **남은 것은 `spec/` 9곳뿐이고 그것이 planner 몫이다.**

      > **개수 확정 (2026-09-11 실측).** 이 항목이 한때 제목에 *"7곳"*, 본문 표에 *"9곳"* 을
      > 동시에 적어 어긋나 있었다(`--impl-done` `review/consistency/2026/09/11/01_10_44` INFO).
      > 줄이 아니라 **출현 횟수**로 전수 세면 `spec/` 전체에 `(SecretResolver|secrets|this.secrets).store`
      > 가 **10회 / 10줄**이고, 그중 **9곳이 chat-channel 경로**다:
      > `15-chat-channel.md:200,201,373,390` · `chat-channel-adapter.md:354,359` ·
      > `providers/telegram.md:58,219` · `providers/slack.md:278`.
      > 나머지 1곳 `conventions/secret-store.md:301` 은 **notification signing 예시**다 —
      > ~~그 경로가 `store()` 를 쓰는지는 **측정하지 않았다.** 정정 대상은 chat-channel 9곳뿐이다.~~
      >
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-chat-channel-drift-3.md` (`--spec` `review/consistency/2026/09/11/{07_11_12,07_22_40}`).
      > **2026-09-11 에 그 10번째를 측정했다 — 그것도 틀렸다.**
      > `normalizeNotificationSecretRef` 도 `secrets.rotate(...)` 를 쓴다
      > (`triggers.service.ts`). `secret-store.md §2.1` 자신이 *"`rotate()` 권장"* 이라 적으므로
      > 그 예시는 **자기 문서 안에서 모순**이었다. **정정 대상은 9곳이 아니라 10곳**이고
      > 전부 고쳤다(잔여 0 — 출현 횟수로 전수 재확인).
      **같은 턴에 병기할 것**: `15-chat-channel.md` frontmatter `code:` 가 이번 PR 의 배선 파일
      (`update-trigger.dto.ts` · `trigger-dto-validation.spec.ts` · `triggers.service.spec.ts` ·
      `trigger-workflow-ref.e2e-spec.ts`)을 아직 안 가리킨다 — 3라운드 연속 관측, 가드는 통과.
      > **2026-09-11 추가 — 대상은 4개가 아니라 6개다.** `impl-chat-channel-binder` 가
      > `modules/triggers/chat-channel-input-rules.ts` 와 `…-input-rules.spec.ts` 를 신설했는데
      > 이 `code:` 목록은 **glob 이 아니라 명시 경로**라(`modules/chat-channel/**` 만 glob)
      > 새 파일이 자동으로 들어오지 않는다. `--impl-done` `16_31_47` INFO#1 은 5개라 했으나
      > **실측은 6개** — `.spec.ts` 를 빠뜨린 수치다.
      >
      > **왜 중요한가**: `code:` 미등재는 그 파일을 **spec-linked 에서 제외**하므로
      > `--impl-done` 게이트가 그 파일만 바뀐 변경을 아예 요구하지 않는다. 지금 R-CC-21 의
      > **검증 규칙 정본**이 그 상태다.
      >
      > **2026-09-11 재갱신 — 대상은 6개가 아니라 8개다.** T2(`impl-chat-channel-binder-t2`)가
      > `chat-channel-binder.service.ts` 와 `trigger-callback-url.ts` 를 더 신설했다
      > (`--impl-prep` `review/consistency/2026/09/11/17_39_32` W1 — *"T1 이 만든 같은 결함
      > 클래스의 재발"*). **세 번째 관측이므로 산문 대신 구조를 바꾸는 쪽을 권한다**:
      > `code:` 에 `codebase/backend/src/modules/triggers/**` **glob** 을 넣으면 재발 자체가
      > 막힌다(`modules/chat-channel/**` 는 이미 glob 이다). 다만 그러면 스코프가 넓어져
      > `--impl-done` 번들이 커지므로 그 트레이드오프는 planner 판단.
      >
      > **같은 턴에 §7 도 본다** — `15-chat-channel.md §7 구현 파일 구조` 의 `triggers/` 블록에
      > 신규 3파일(T1 1 + T2 2)이 없다. **거짓은 아니다**(`triggers.service.ts` 행이
      > *"…호출 추가"* 라 이동 후에도 참) — **누락**이다
      > (`--impl-prep` `17_39_32` INFO#1).
      > **✅ 2026-09-11 `code:` 축 해소** — planner 턴
      > `plan/complete/spec-draft-chat-channel-binder-drift.md`. 개별 경로를 더하지 않고
      > **좁은 glob 3개**(`chat-channel-*.ts` · `dto/chat-channel-*.dto.ts` ·
      > `trigger-callback-url*.ts`)로 갈아 **재발 자체를 없앴다** — 정본 매처로 검증해
      > 의도한 10파일을 정확히 덮고(차집합 0) 무관 파일 유입 0. 근거는 신설 `R-CC-22`.
      > §7 구현 파일 구조도 같은 턴에 5파일 채웠다(**3개가 아니라 5개**였다 — `#1317` 의 상수
      > 파일과 `chat-channel-config.dto.ts` 가 처음부터 빠져 있었고, 후자는 `code:` 엔 있는데
      > §7 엔 없어 **두 목록이 서로 어긋나 있었다**).
      또한 **신규 검증 분기 2건**(`chatChannel` 최초 부착 차단 → `details.field='chatChannel'` ·
      provider 전환 차단 → `details.field='provider'`)이 §5.4.1 표와 `2-trigger-list.md` PATCH
      에러 표에 미등재다(`--impl-done` `review/consistency/2026/09/11/00_21_57` W3).
      > **✅ 이 축은 `f947b49f4` 에서 이미 해소됐다** — `15-chat-channel.md §5.4.1.2` 가 신설돼
      > 두 분기를 담고 있다. 완료 주석이 누락돼 있던 것을 2026-09-11 에 채웠다
      > (`--spec` `review/consistency/2026/09/11/20_47_56` INFO 4).

- [x] **동시 PATCH 가 `trigger.config` 를 잃을 수 있다 (lost update) — 방금 닫은 fail-open 이 이 경로로 재발 가능**
      (developer + 동시성, 2026-09-11 등재, `/ai-review` `review/code/2026/09/10/23_55_23` `concurrency` W1
      + `database` INFO 가 같은 지점을 TOCTOU 로 독립 확인).
      `update()` → `setupChatChannel()`(외부 adapter 호출 포함, `await` 여러 개) 전 구간이 트랜잭션·
      낙관적 잠금·행 잠금 **없이** 요청 시작 시점의 `trigger.config` 스냅샷을 신뢰한다. 같은 트리거에
      동시 PATCH 가 겹치면 나중에 커밋되는 쪽이 먼저 반영된 `inboundSigningRef` 를 **옛 스냅샷으로
      되돌려 쓴다** — 즉 이번 PR 이 막 닫은 인입 서명 fail-open 이 동시성 경로로 되살아난다.
      **사전 존재 설계다**(CCH-SE-01 의 best-effort 2단계 커밋) — 이 diff 가 만든 것이 아니라 그 위에
      새 상태(`previousInboundSigningRef` 캡처)를 얹은 것이라 등재한다. 처방 후보: 트리거 단위
      advisory lock · `SELECT … FOR UPDATE` · `config` 낙관적 버전 비교. 자매 패턴
      `rotateChatChannelBotToken()` 도 같은 구간을 가진다.
      > **2026-09-11 — 그 구간이 이제 서비스 경계를 건넌다.** T2 가 `setupChatChannel` 을
      > `ChatChannelBinderService` 로 옮겼으므로 `update()` → **다른 provider** → 외부 adapter
      > 호출이 된다. 락을 어느 층에 두는지가 설계 선택으로 추가된다 — 호출자(`TriggersService`)가
      > 트랜잭션/락을 열고 binder 를 그 안에서 부를지, binder 가 스스로 잠글지.
      > (`--impl-prep` `review/consistency/2026/09/11/17_39_32` INFO#3.)
      > **✅ 2026-09-15 해소** — `plan/complete/trigger-config-lost-update.md`
      > (브랜치 `claude/trigger-config-lost-update-9860c6`, `/ai-review` 14라운드 · 최종 Critical 0).
      > 처방은 후보 셋 중 **트리거 단위 advisory lock**(`pg_advisory_xact_lock(hashtext(...))`,
      > 키 `trigger-config:<id>`)이다. 외부 adapter 호출은 락 **밖**에 둔다 — cafe24 토큰 갱신이
      > 같은 이유로 이 락을 기각했던 선례를 따른다. 락 안에서 **다시 읽고** 병합한다.
      >
      > **이 항목이 지목한 범위가 실제보다 좁았다.** 본문은 `update()` 와 자매
      > `rotateChatChannelBotToken()` **두 자리**를 적었는데, 같은 클래스(스냅샷 기반 `config`
      > 통째 되쓰기)는 **네 창**이었다 — `update()` · `ChatChannelBinderService` 의 두 자리 ·
      > `rotateBotToken()`. 닫고 보니 형제 쓰기 자리까지 합쳐 락을 지나는 지점이 **9곳**이다
      > (직접 `acquireTriggerConfigLock` 3 — 창 1·트리거 삭제·스케줄 cascade 삭제 —
      > 및 `rewriteTriggerConfigLocked` 경유 6; 2026-09-15 종결 시점 실측).
      > e2e(`test/trigger-config-lost-update.e2e-spec.ts`)가 원 결함을 재현한다 —
      > `origin/main` 의 두 서비스 파일에 대고 돌리면 `Expected 42 / Received 7` 로 떨어진다.

- [ ] **`setupChatChannel` 이 6~8가지 관심사를 한 함수에 담고 있다** (developer, 2026-09-11 등재,
      `/ai-review` `review/code/2026/09/10/23_55_23` `maintainability` W6). 133 → 186줄(+40%).
      reviewer 자신이 *"JSDoc·근거 주석·대칭 테스트가 위험을 상쇄해 즉시 차단 사유는 아님 —
      다음에 손댈 때"* 로 분류했다. 처방: 앞쪽 절반(secret 쓰기 게이팅 + ref 생존 판정)을
      `resolveChatChannelSecretWrites(...)` 로 분리.
      > **2026-09-11 — 아래 「chat-channel 도메인 규칙이 … 계속 쌓인다」 항목의 T2 와 같은
      > 코드를 만진다.** 그쪽은 `setupChatChannel`·`teardownChatChannel` 을 **파일 밖 협력자로**
      > 빼고, 이 항목은 그 **함수 안**을 가른다. **T2 를 먼저 하고 이 분리를 그 안에서 하는 것**이
      > 맞다 — 순서를 뒤집으면 방금 만든 `resolveChatChannelSecretWrites` 를 곧바로 다른 파일로
      > 다시 옮기게 된다.

- [x] **`ChatChannelConfigDto.botToken` 이 swagger 로 `minLength:1` 을 약속하는데 validator 가 없다**
      (developer, 2026-09-11 등재, `/ai-review` `review/code/2026/09/10/23_55_23` `security` INFO1).
      **생성(POST) 경로**에서 빈 문자열 bot token 이 통과한다 — 이번 PR 은 PATCH 축만 게이팅해
      스코프 밖이었다. 처방: `@MinLength(1)` 또는 provider 별 정규식.
      > **✅ 2026-09-11 해소** — developer 턴 `plan/complete/impl-details-code-wiring.md` (`--impl-done` `review/consistency/2026/09/11/12_58_03` BLOCK: NO · `/ai-review` 4라운드 CRITICAL 0).
      > `@MinLength(1)` 로 닫았다. **피해 경로를 실측했다** — `''` 가 통과하면
      > `setupChatChannel` 의 `[쓰기 ①]` 이 `rotate(botTokenRef, ws, '')` 로 **빈 시크릿을 먼저
      > 저장**하고 provider 호출 실패(401 → `BOT_TOKEN_INVALID`)는 그 **뒤**다. 요청은 실패하는데
      > 시크릿 행은 남는다.
      >
      > **공백 전용 문자열(`'   '`)은 여전히 통과한다** — `@MinLength(1)` 은 길이만 본다. trim
      > 정책은 아래 「잔여 개선」 (a) 로 분리했다. **provider 별 정규식은 하지 않았다** —
      > 그 정규식이 docs·i18n 4곳에만 있고 코드에 없다는 것을 실측했다(아래 별 항목).

- [ ] **DTO `@IsEmpty()` 메시지와 서비스 가드 메시지가 5필드 모두 리터럴 복붙이다** (developer,
      2026-09-11 등재, `/ai-review` `review/code/2026/09/11/01_52_59` `architecture` W3).
      한쪽만 고치면 **값의 형태에 따라 다른 문구가 나간다** — `null`/`''` 는 서비스 가드가,
      비어있지 않은 값은 DTO 가 거부하기 때문이다(그 두 갈래는 이미 실측으로 확정돼 있다).
      처방: 5개 메시지를 `chat-channel-config.dto.ts` 의 `export const` 맵으로 빼고 두 층이
      import 한다.
      > **✅ 2026-09-11 해소** — developer 턴 `plan/complete/impl-details-code-wiring.md` (`--impl-done` `review/consistency/2026/09/11/12_58_03` BLOCK: NO · `/ai-review` 4라운드 CRITICAL 0).
      > **처방 위치를 바꿨다** — `chat-channel-config.dto.ts` 안이 아니라 신규
      > `modules/triggers/chat-channel-rejection-messages.const.ts` 로 뺐다(선례
      > `embedding-dimensions.const.ts`). DTO 안에 두면 서비스가 DTO 를 import 하게 되어 방향이
      > 어긋난다.
      >
      > **등가성을 테스트로 고정했다** — 두 층에 하나씩 `[등가성]` 단언을 두어 둘이 같은 상수를
      > 가리키게 했다(전이적 고정). 필드 배열을 1차 SoT 로 올리고 메시지를
      > `Record<ChatChannelBlockedField, string>` 으로 선언해 **양방향**을 컴파일러가 본다 —
      > 종전 `satisfies` 안은 편도였다(`tsc` 로 양방향 RED 확인).

- [ ] **`chat-channel-binder.service.ts` 구조 정리 4건** (developer, 2026-09-11 등재 ·
      `/ai-review` `review/code/2026/09/11/18_04_36` INFO 2·4·6·9). 전부 비차단이고 **이동이
      만든 것이 아니라 이관되거나 드러난 것**이다. 같은 파일이라 한 번에 처리한다:
      (a) **secret store 쓰기 2건이 순차 `await`** — botToken rotate 와 provider-issued
      inbound-signing rotate 는 서로 독립인데 왕복이 누적된다. `storeUserSuppliedSecrets`
      게이팅을 유지한 채 `Promise.all` 로 병렬화 검토.
      (b) **`preservedInboundSigningRef` 의 "병합 전 캡처" 불변식이 JSDoc 산문에만 있다** —
      이동으로 그것이 **두 서비스 사이의 암묵 계약**이 됐다. 지금은 테스트·캐너리가 막는다.
      **세 번째 호출 지점이 생길 조짐이 보이면** `PreMergeChatChannelSnapshot` 류 래핑 타입으로.
      (c) **secret ref 생성과 `trigger.config` 캐스팅이 이제 두 파일에 걸쳐 중복** — 같은 파일
      안 중복이었을 땐 눈에 띄었는데 이동으로 발견 가능성이 낮아졌다.
      `buildChatChannelSecretRefs(triggerId)` 공유 헬퍼 후보.
      (d) **테스트가 binder 를 mock 없이 실제 클래스로 주입한다**(14블록) — *"단언 diff 0줄"*
      증거 전략과 일치하는 **의도된** 선택이지만, 클래스 경계가 생겼는데 격리에는 아직 안 쓴다.
      chat-channel 무관 describe 는 stub 으로 바꿀 수 있다.
      (e) `teardownChatChannel` **성공 경로**가 `Logger.warn` **미호출**을 단언하지 않는다
      (`/ai-review` `19_30_49` INFO 8) — `expect(warn).not.toHaveBeenCalled()` 한 줄.
      실패 경로만 warn 을 보고 있어 *"성공인데 경고가 난다"* 는 회귀를 못 잡는다.
      (f) `trigger-callback-url.ts` docstring 안의 **내용 없는 빈 줄 1개** (`19_30_49` INFO 9).
      (g) `buildTriggerCallbackUrl` 순수 함수 테스트의 경계값 2종 — 연속 슬래시(`//hook-abc`) ·
      빈 baseUrl + 후행 슬래시 겹침 (`18_42_05` INFO 14). 실무 위험은 낮다.
      > **(e)~(g)는 T2 PR 의 4라운드에서 INFO 로 나왔지만 고치지 않았다** — 그 라운드가
      > **`codebase/**` 수정 0 으로 끝나는 종료 조건**을 막 충족한 시점이라, 한 줄이라도 건드리면
      > 리뷰가 stale 돼 라운드가 한 번 더 돈다. *"루프를 끊는 지렛대는 파일 위치"* 를 적용했다.

- [ ] **트래커 `spec_impact` 누락을 산문 대신 스크립트로 잡는다** (developer/harness,
      2026-09-11 등재). 같은 실패가 **세 번** 났다 — `2026/09/06/16_29_00` INFO#2 ·
      `2026/09/11/17_39_32` W2 · `2026/09/11/19_41_52` W1. 세 번째는 **두 번째를 고친 같은
      세션 안에서** 났다: 항목 하나를 넣을 때 frontmatter 를 열었지만, 그 뒤 **3파일을 지목하는
      새 항목**을 추가하면서 그중 1개만 이미 있다는 것을 확인하고 넘어갔다.
      → **술어가 검사 가능하다**: *"열린(`[ ]`) 항목 본문이 정정 대상으로 지목하는 실재 spec
      경로가 frontmatter `spec_impact` 에 다 있는가"*. 이번 턴에 그 판정을 실제로 돌려
      **미등재 4건 중 2건만 대상**임을 갈랐다(나머지 2건은 `[x]` 항목 소속이라 비대상) —
      즉 **주어 확인까지 기계화할 수 있다.**
      처방: `.claude/hooks/` 또는 `.claude/tools/` 에 plan frontmatter 검사 추가.
      **함정 — 전수 추가는 답이 아니다**: 닫힌 항목이나 단순 참조로 언급된 경로까지 넣으면
      그 목록 자체가 거짓이 된다(`spec_impact` 는 *"이 plan 이 건드리는 파일"* 이다).
      harness 축이라 리뷰 게이트가 안 무니 검증은 `python3 -m pytest .claude/tests -q`.
      > **2026-09-12 — 가치의 축을 정정한다. 이건 누출 방지가 아니라 왕복 절감이다.**
      > 세 번 다 **checker 가 잡았다**(`09/06 16_29_00` INFO#2 · `09/11 17_39_32` W2 ·
      > `09/11 19_41_52` W1) — 즉 **main 으로 샌 적은 없다.** 실제 비용은 매번 `--spec`/
      > `--impl-done` 한 라운드다.
      >
      > 그러면 **정보성 감사**(`plan-stale-audit.sh` 관례 — 절대 실패하지 않는다)로 충분하고,
      > 차단 가드로 만들 근거는 아직 없다. 우선순위를 그만큼 낮춘다.
      >
      > 판정 술어는 이미 검증됐다 — 2026-09-11 에 손으로 돌려 **후보 4건 중 열린 항목 소속
      > 2건만 대상**임을 갈랐다(나머지 2건은 `[x]` 항목이 참조로 언급). 즉 주어 확인까지
      > 기계화된다. 남은 일은 그 스크립트를 도구로 앉히는 것뿐이다.

- [x] **`setupChatChannel` 귀속 표기 3곳이 T2 이동으로 낡는다** (planner, 2026-09-11 등재 ·
      `--impl-prep` `review/consistency/2026/09/11/17_39_32` W2 — `rationale_continuity` 와
      `plan_coherence` 가 **독립으로 같은 지점**을 짚었다). T2 가 `setupChatChannel` 을
      `TriggersService` → `ChatChannelBinderService`(`modules/triggers/chat-channel-binder.service.ts`)
      로 옮기므로, **클래스·파일 접두를 붙여 현재형으로 서술하는** 아래 3곳이 없는 심볼을 가리킨다:

      | 파일 | 서술 |
      |---|---|
      | `spec/conventions/secret-store.md` | *"`triggers.service.ts.setupChatChannel` 구현체"* |
      | `spec/conventions/chat-channel-adapter.md` | *"(`TriggersService.setupChatChannel`)"* |
      | `spec/data-flow/14-chat-channel.md` | 구현 파일 목록에서 `triggers.service.ts` 에 귀속 |

      **실질은 여전히 참이다** — 그 규칙은 `TriggersService` 가 호출해 같은 시점에 돈다.
      부정확한 것은 **심볼 경로**뿐이다. 처방: *"`TriggersService` 가 `ChatChannelBinderService` 의
      … 를 호출해"* 형태로 호출자/정의처를 갈라 적는다.
      > **드리프트 범위는 이 3곳뿐이다.** `spec/` 전수 분류(9 출현) 결과 접두 없이
      > `setupChatChannel` 만 인용하는 **6곳**(`15-chat-channel.md` 2 · `secret-store.md` 2 —
      > 그중 하나는 코드 예시 · `data-flow/14-chat-channel.md` 2)은 이동 후에도 참이라 대상이 아니다 —
      > **주어를 확인해 가른 결과**이고, T1 이 `assertInboundSigningPlaintextByProvider` 에 쓴
      > 것과 같은 판별법이다.
      > **자기-반증형 소정정 조건 1 불성립**(그 문장들은 이전 planner 턴이 썼다) → planner 턴.
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-chat-channel-binder-drift.md` (`--spec` `review/consistency/2026/09/11/{20_33_26,20_47_56}` BLOCK: NO).
      > **제목의 "3곳" 이 틀렸다 — 실제는 7곳이었다.** 나는 `setupChatChannel` **문자열 하나**로
      > 전수 분류했는데, `--spec` `20_33_26` W1·W2 가 **재현 검증으로 반증**했다: T1 이 옮긴
      > **다른 함수**(`assertInboundSigningPlaintextByProvider`)의 같은 드리프트가 있었고,
      > 편집 대상 파일 **내부**(`data-flow/14-chat-channel.md` §1.3 표 헤더)에도 있었다.
      >
      > 술어를 바꿔 다시 쟀다 — 기준을 문자열이 아니라 **이동한 심볼 집합 전체**(T1 6 + T2 3 =
      > 9개, 두 머지 커밋에서 확정된 유한 집합)로, 축을 **3개**(심볼×접두 · 파일 지목×문맥 ·
      > 편집 대상 파일 내부)로 넓혔다. 결과 **7곳**이고 반영 후 재스캔해 **대상 0**을 확인했다.
      > 비대상도 주어로 갈랐다 — `TriggersService.update()`·`.remove`·`rotateBotToken` 귀속은
      > **그 메서드들이 그대로 있으니** 참이다.
      >
      > **교훈: 키워드를 하나 더 넣는 것은 처방이 아니다**(다음 키워드를 모른다). 이동 리팩터의
      > 귀속 드리프트는 **옮긴 심볼 집합**을 기준으로 열거해야 0이 된다.

- [ ] **`rotate-bot-token` 엔드포인트에 OpenAPI 데코레이터가 전무하다** (developer, 2026-09-11
      등재 · `--impl-prep` `review/consistency/2026/09/11/17_39_32` W3). spec `15-chat-channel.md`
      §5.4 가 성공 응답 DTO · 요청 DTO · **에러 코드 6종**을 문서화하는데
      `triggers.controller.ts` 의 `rotateBotToken` 에는 `@ApiOkResponse`/`@ApiBody`/
      `@ApiBadRequestResponse` 가 **하나도 없다**. **형제 엔드포인트 `revokePerTriggerToken` 은
      갖추고 있어** 같은 컨트롤러 안에서 비대칭이다.
      **사전 존재 갭이고 T2 diff 범위 밖**이라 그 PR 에서 닫지 않았다. 처방: 응답 DTO 신설 +
      `RotateBotTokenDto` 요청 DTO 승격 + 에러 데코레이터. `swagger.md §1/§2-4/§5` 가 SoT.

- [ ] **`buildTriggerCallbackUrl` 과 `getAppBaseUrl()` 이 같은 fallback 을 두 벌 갖는다**
      (developer, 2026-09-11 등재 · `--impl-prep` `review/consistency/2026/09/11/17_39_32` W4).
      `common/utils/app-base-url.ts` 는 스스로 *"APP_URL 의 **단일 표준** fallback"* 이라
      선언하고(옛 6곳 중복 제거의 산물, W-28) 기본값 리터럴·후행 슬래시 제거가 동일하다.
      **T2 가 합치지 않은 이유는 읽는 소스가 다르기 때문**이다 — `getAppBaseUrl()` 은
      `process.env.APP_URL` **직접**, 트리거 경로는 `ConfigService`. 갈아끼우면 트리거 단위
      테스트 **14블록**이 `ConfigService` mock 으로 쥔 통제권이 사라져 **순수 이동이 아니라
      DI 변경**이 된다.
      > **먼저 판정할 것**: `'http://localhost:3011'` 리터럴은 src 에 **4곳**
      > (`app.config.ts` · `app-base-url.ts` · `auth-oauth.service.ts` · `trigger-callback-url.ts`).
      > 그리고 `app.config.ts` 가 이미 기본값을 박으므로 `trigger-callback-url.ts` 의 `??` 는
      > **프로덕션에서 발화하지 않는다**(mock ConfigService 전용, 캐너리 있음). 통합의 진짜
      > 질문은 "중복 제거" 가 아니라 **"env 를 읽는 층을 ConfigService 로 통일할 것인가"** 다.

- [x] **옮긴 로그 메시지가 아직 `TriggersService:` 접두를 달고 있다** (developer, 2026-09-11 등재 · **2026-09-17 해소** — `plan/complete/trigger-deletion-release.md` 리뷰 1라운드 W11: 트리거 삭제 자원 정리가 보상 경로에서 이 로그를 새로 부르게 되면서 `ChatChannelBinderService:` 로 정정).
      `chat-channel-binder.service.ts` 의 경고 4개가 `` `TriggersService: …` `` 리터럴로 시작한다 —
      logger 컨텍스트는 `ChatChannelBinderService` 인데 메시지가 다른 클래스를 말한다.
      **T2 가 일부러 남겼다**: 바꾸면 관측 가능한 출력이 달라져 *"순수 이동"* 주장이 약해진다.
      이 리터럴을 단언하는 테스트는 **0건**이라(실측) 정정은 안전하다. 다음에 그 파일을 손댈 때.

- [x] ~~**`run-test.sh <미정의 단계>` 가 exit 0 을 낸다**~~ **← 철회. 내 오진이었다**
      (developer/harness, 2026-09-11 등재 · **2026-09-12 반증**).
      > **실측**: `run-test.sh all` 을 **파이프 없이** 돌리면 종료 코드는 **2**다. 소스도
      > `NOT_DEFINED` 와 `CONFIG_MISSING` 둘 다 `exit 2` 로 이미 정확하다. **harness 에 결함이
      > 없다.**
      >
      > 내가 본 exit 0 은 내가 붙인 **`| tail -40`** 때문이었다 — 파이프라인의 종료 코드는
      > `tail` 의 것이 된다. 같은 세션에서 **두 번** 같은 형태로 속았다(두 번째는 `| tail -2`
      > 가 lint 실패를 먹어 `&&` 체인이 계속 돌았다).
      >
      > **거짓 결함을 트래커에 남기면 다음 사람이 멀쩡한 코드를 고치러 간다** — 착수 직전에
      > 소스를 읽어 반증했다. 진짜 처방은 **호출 형태**였고, `.claude/tools/run-test-all.sh`
      > 로 그 실패 모드 자체를 없앴다(판정을 stdout 에도 적어 `| tail -1` 로 읽어도 참).
      > (2026-09-12 harness PR)

- [x] **chat-channel 도메인 규칙이 제네릭 `TriggersService`(1855줄)에 계속 쌓인다** (developer,
      2026-09-11 등재, `/ai-review` `01_52_59` `architecture` W2 — 기존 "함수 비대" 항목의
      **모듈 경계 관점**이다). `chat-channel/` 하위에 adapter 계층이 따로 있는데 검증·secret
      쓰기·ref 보존 규칙은 triggers 쪽에 남아 경계가 어긋난다. 처방 후보:
      `ChatChannelTriggerBinder` 협력자 추출.
      > **⚠️ 처방의 방향이 실측으로 뒤집혔다 (2026-09-11).** *"`chat-channel/` 로 옮긴다"* 는
      > 읽기는 **순환을 되살린다** — `#676`(`e827ed2a7`) 이 `chat-channel→triggers` 역방향 의존
      > 2곳을 **의도적으로 제거해 `forwardRef` 순환을 끊었고**(`triggers.module.ts` 주석 + 잔존
      > `forwardRef` **0건** 실측), 되돌리면 그 작업이 무효가 된다. 따라서 추출은
      > **`triggers/` 안의 협력자**여야 한다.
      >
      > **`details[].code` 배선 PR(A/B/C/D)에서 의도적으로 갈랐다** — 그 PR 이 13개 throw 자리를
      > **고치고** 이 항목은 같은 자리를 **옮기므로**, 한 diff 에 섞으면 리뷰가 동작 델타를
      > 분리할 수 없다. 이 표면은 `#1314` 에서 리뷰어 3명이 독립으로 CRITICAL 을 찾은 자리다.
      > **동작 보존이 유일한 주장이 되도록** 별 PR 로 낸다.
      >
      > **✅ 2026-09-11 T1 완료 / ⏸ T2 이월 — 항목은 열어 둔다.** developer 턴
      > `plan/complete/impl-chat-channel-binder.md` (`--impl-prep` `14_59_33` BLOCK: NO ·
      > `/ai-review` 3라운드 CRITICAL 0 · `--impl-done` `16_31_47` BLOCK: NO).
      >
      > **갈린 기준은 의존 방향이다** — 각 메서드가 쓰는 외부 `this.*` 를 전수로 셌다:
      >
      > | 계층 | 대상 | 외부 `this.*` | 상태 |
      > |---|---|---|---|
      > | **T1 — 검증·변환** | `assertChatChannelInputSafe`(+오버로드 2) · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` · `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError` | **0개** | **완료** — `modules/triggers/chat-channel-input-rules.ts` 순수 함수 모듈(DI 없음) |
      > | **T2 — secret 쓰기·ref 보존** | `setupChatChannel` · `teardownChatChannel` | **6개** | ✅ **완료** — `ChatChannelBinderService`(Nest provider, `triggers/` 안) |
      > | (범위 밖) | `rotateBotToken` · `cleanupRotatedChatChannelTokens` · `tryRevokeOldBotToken` | repo·audit·BullMQ | **영구 잔류** — 엔드포인트 오케스트레이션이라 옮기면 그 협력자까지 끌고 간다 |
      >
      > 따라서 이 PR 뒤 `TriggersService` 의 chat-channel 메서드는 **5개**(이월 2 + 잔류 3)이고
      > `TriggersService` 는 1,881 → **1,585줄**이다(이동 커밋 `2ae81077c` 시점에 측정 —
      > 이후 세 커밋은 이 파일을 건드리지 않았다).
      >
      > **✅ 2026-09-11 T2 완료 — 이 항목을 닫는다.** developer 턴
      > `plan/complete/impl-chat-channel-binder-t2.md` (`--impl-prep` `17_39_32` BLOCK: NO ·
      > `/ai-review` **4라운드** 끝에 CRITICAL 0 · WARNING 0 · `codebase/**` 수정 0 ·
      > `--impl-done` `19_41_52` BLOCK: NO).
      >
      > **최종 상태**: `triggers.service.ts` 1,881 → **1,351줄**. chat-channel 잔존은
      > **영구 잔류 3메서드**뿐이다 — `rotateBotToken`(`this.findById`·`this.recordAudit` 사용) ·
      > `cleanupRotatedChatChannelTokens`(BullMQ 워커 진입) · `tryRevokeOldBotToken`.
      > 셋 다 **엔드포인트 오케스트레이션**이라 옮기면 감사·큐 협력자까지 끌고 온다.
      > **이 셋은 이동 대상이 아니다** — 이 항목을 다시 열 사유가 아니다.
      >
      > 이동 중 갈라 나온 것: `trigger-callback-url.ts`(순수 함수 — 이동 대상과 잔류 대상이
      > `buildCallbackUrl` 을 공유해서 SoT 를 쪼개지 않으려고 뽑았다).
      >
      > **T2 의 증거 방식은 T1 과 다르다** — T1 은 의존이 0이라 *"테스트 파일 **무편집**"* 으로
      > 증명했다: **그 이동 커밋 하나의** `*.spec.ts` diff 가 0줄이다(base 를 `2ae81077c^` 로
      > 고정해 측정). 브랜치 전체로는 0이 아니다 — 뒤 커밋들이 신규 spec 파일과 보강을 더했다.
      > T2 는 협력자 주입이 생기므로 3개
      > `createTestingModule` 의 **provider 등록**이 바뀐다. 그때의 주장은 *"**단언** diff 0줄"*
      > 이다. **한 커밋에 섞으면 약한 쪽으로 뭉개지므로** 별 PR 로 낸 것이다.

- [x] **서비스 가드가 `details[].code` 를 안 싣는다 — 파이프는 싣는다** (developer,
      2026-09-11 등재, `--spec` `review/consistency/2026/09/11/07_11_12` `convention_compliance` INFO 2).
      `validation.pipe.ts:58` 은 원소마다 `code: 'INVALID_FIELD'` 를 넣는데
      `triggers.service.ts:655,662,670,702,710` 의 가드는 `details: { field: … }` 만 던진다.
      `2-api-convention.md` §5.3 의 「도메인 세부 사유를 어디에 싣는가」 표는 `details[].code` 를
      *"사유가 어느 필드에 붙는지가 정보의 일부일 때"* 쓰라고 한다 — 두 층이 같은 논리적 위반을
      다르게 표현하는 셈이다. **코드 사안**이라 planner 턴에서 못 닫는다. 기존 `botTokenRef` 등
      선례도 동일한 비대칭을 갖고 있어 **일괄 판단**이 맞다(`--spec` `07_22_40` `cross_spec` INFO 3).
      > **✅ 2026-09-11 규약은 확정됐다 — 배선은 이 항목에 남는다.**
      > planner 턴 `plan/complete/spec-draft-chat-channel-conventions.md` 가
      > `2-api-convention.md §5.3` 에 *「`field` 를 실으면 `code` 도 싣는다 — 형태와 무관」* 을
      > 명문화했다(기본값 `INVALID_FIELD`, 이미 카탈로그 등재).
      >
      > **그 턴의 실측이 내 "11곳" 을 반증했다.** `details:` 는 **세 층**에 걸쳐 있고
      > (에러 봉투 22 · 감사 로그 22 · 노드 출력 payload 16, 전수 60곳, 기준 `f947b49f4`),
      > 종전 수치는 앞의 두 층을 섞은 grep 이었다. `field` 를 싣는 에러 봉투 자리는 **16곳**,
      > 그중 `code` 가 있는 것은 1곳(`rethrowEndpointPathConflict`) → **갭은 15곳**이고
      > `triggers.service.ts` 객체 13곳 + **`password.util.ts` 배열 2곳**이다(배열 형태에도
      > 같은 갭이 있어 규칙이 형태 무관이 됐다).
      >
      > **범위 밖으로 확정된 것 둘**: (a) `field` 가 없는 진단 payload 6곳
      > (`{errors}`·`{offenders}`·`{reason}`) — 사유가 이미 top-level 특화 `code` 에 있어
      > `details.code` 를 얹으면 §5.3 자신의 *"둘을 겹쳐 쓰지 않는다"* 를 어긴다. (b) 감사 로그
      > `details` 22곳 — SoT 는 `1-auth.md §4.1` · `data-flow/1-audit.md §1.1` 다.
      > **`conventions/audit-actions.md` 가 아니다** — 그 문서는 `action` 문자열의 명명·시제만
      > 소유한다고 스스로 한정한다(`--spec` `09_29_33` WARNING 1 이 내 오인용을 잡았다).
      >
      > ~~**남은 것 = 15곳 배선** (developer).~~
      > **✅ 2026-09-11 해소** — developer 턴 `plan/complete/impl-details-code-wiring.md` (`--impl-done` `review/consistency/2026/09/11/12_58_03` BLOCK: NO · `/ai-review` 4라운드 CRITICAL 0).
      > **15자리 전부 배선했다** — `triggers.service.ts` 객체 13곳 +
      > `password.util.ts` **배열 2곳**. 뮤테이션으로 **15/15 개별 RED** 확인했고, **1차에
      > 4자리가 생존**했다(`toMatchObject` 재귀 부분일치 3곳 + `details` 미단언 1곳 +
      > `.toThrow()` 만 보는 2곳) — 단언을 보강해 닫았다.
      >
      > `modules/` 13곳은 canonical `ErrorCode.INVALID_FIELD`, `common/` 2곳은 **리터럴 유지**
      > (`common/`→`nodes/` 선례 0곳 + 같은 층 파이프도 리터럴 — 층을 갈라 적용했다).
      >
      > **강제 가드는 여전히 없다** — §5.3 에 그 상태를 적어 뒀고 신규 발행 지점부터 적용된다.
      > `authConfigId` 한 자리는 top-level 이 특화 코드라 §5.3 판정이 필요하다(별 항목).

- [x] **`chat-channel-adapter.md §1.1` 의 `setupChannel` "멱등 = yes" 에 각주가 필요하다**
      (planner, 2026-09-10 등재 · 2026-09-11 재확인). 멱등성은 **레지스트리 등록 안전성**이지
      **시크릿 값 불변**이 아니다 — telegram 은 매 호출 새 `secret_token` 을 발급한다.
      `15-chat-channel.md §5.4.1.2` 신설로 PATCH 축은 정리됐지만 이 각주는 남아 있다.
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-chat-channel-conventions.md` (`--spec` `review/consistency/2026/09/11/09_29_33`, BLOCK: NO).
      > 신규 소절 `§1.1.1` 로 붙였다(표 셀은 그 소절을 링크). 각주에 `#1313` 이력을 함께 실었다 —
      > *"이 혼동이 실제로 CRITICAL 을 만들었다"* 가 이 각주의 존재 이유이므로.
      > `providers/telegram.md §3.1` · `15-chat-channel.md §5.4.1.1` telegram 행 · `R-CC-21`
      > 세 곳으로 cross-link 했다(`--spec` `09_29_33` INFO 3 — 같은 사실을 두 문서가 독립
      > 서술하면 한쪽만 갱신되는 drift 가 재발한다).

- [x] **`chat-channel-config.dto.ts` 의 `swagger.md:315` 줄-번호 인용이 stale 해졌다**
      (developer, 2026-09-11 등재 · `--spec` `09_29_33` `plan_coherence` WARNING 2).
      같은 날 planner 턴이 `swagger.md` `§1` 안에 신규 `§1-7` 을 삽입했고 그 삽입점은 315줄보다
      **위**라 인용 대상이 밀렸다. 정정은 **줄 번호를 다시 재는 것이 아니라 절 참조**로
      (`swagger.md` 의 「JSDoc 은 공개 OpenAPI 로 나간다」 절) — 숫자를 갱신하면 다음 삽입에
      또 깨진다. **이 drift 를 잡는 CI 가드는 없다** (`spec-link-integrity` 는 `#anchor` 는 보지만
      `:NNN` 은 안 본다, `dto-jsdoc-citation-guard.ts` 는 날짜만 센다).
      > **원래 `Update` 접두 항목의 "부수" 로 딸려 있었다.** 그 항목을 종결하면 함께 사라지므로
      > 별 항목으로 갈랐다 — checker 가 정확히 그 유실을 경고했다.
      > **✅ 2026-09-11 해소** — developer 턴 `plan/complete/impl-details-code-wiring.md` (`--impl-done` `review/consistency/2026/09/11/12_58_03` BLOCK: NO · `/ai-review` 4라운드 CRITICAL 0).
      > 절 제목 앵커(「JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다」)로 바꿨다.
      > `codebase/` 에 남은 `swagger.md:NNN` 인용 **0건** 확인.

- [ ] **spec 을 향한 줄-번호 인용 15곳 — 앵커 문구로 전환** (planner + developer 분담,
      2026-09-11 등재). 위 항목의 **클래스**다. `2-api-convention.md`·`swagger.md`·
      `chat-channel-adapter.md`·`15-chat-channel.md` 를 `:NNN` 으로 인용하는 자리를 전수
      판정했다(각 파일의 2026-09-11 삽입점과 대조 + 인용이 주장하는 키워드가 그 줄에 실제로
      있는지 확인):

      | 판정 | 자리 | 소유 |
      |---|---|---|
      | **이미 깨져 있었다 (4)** | `15-chat-channel.md:377`·`:390` (둘 다 **빈 줄**) · `chat-channel-adapter.md:159`·`:367` (키워드 불일치) | `spec-sync-auth-gaps.md` · 본 트래커 · `eia-terminal-payload.md` |
      | **2026-09-11 planner 턴이 밀었다 (7)** | `chat-channel-adapter.md:145`·`:149`(2건)·`:354`·`:359` · `2-api-convention.md:272` · **`swagger.md:315`** | `spec-draft-eia-notification-payload-contract.md` · `spec-sync-external-interaction-api-gaps.md` · 본 트래커 · **`codebase/**`**(위 항목) |
      | 영향 없음 (4) | `2-api-convention.md:205` · `15-chat-channel.md:200`·`:201`·`:373` | — |

      **본 트래커 자신의 3건은 그 턴에서 앵커로 바꿨다.** 다른 세션이 진행 중인 트래커
      (`eia-terminal-payload.md` · `spec-sync-external-interaction-api-gaps.md` ·
      `spec-draft-eia-notification-payload-contract.md` · `spec-sync-auth-gaps.md`)는 병행 작업과
      충돌하므로 **건드리지 않았다** — 각 소유자가 위 표를 보고 앵커로 바꾼다.
      > **교훈은 규율의 거울상이다.** *"내가 편집하는 파일을 줄 번호로 인용하지 마라"* 는 이미
      > 알고 있었는데, **내가 편집하는 파일을 남이 줄 번호로 인용하고 있으면 내 편집이 그것을
      > 깨뜨린다**는 반대 방향은 이번에 처음 쟀다. 그리고 그 방향에서 4건은 **내가 손대기 전에
      > 이미 깨져 있었다** — 이 저장소에서 spec 을 향한 `:NNN` 인용은 이미 신뢰할 수 없다.

- [ ] **`details` 의 도메인 특화 세부 코드를 신설할지 — `INVALID_FIELD` 하나로는 사유가 안
      갈린다** (planner + 결정, 2026-09-11 등재). 위 `details[].code` 규약이 기본값을
      `INVALID_FIELD` 로 정했지만, 그것만으로는 `triggers.service.ts` 의 세 가지 거부 사유가
      **여전히 구분되지 않는다**: (a) 내부 필드라 외부 입력 금지(`botTokenRef` 등) ·
      (b) PATCH 로 변경 불가(`botToken`·`inboundSigningPlaintext`) · (c) 최초 설정이 생성 POST
      한정(`chatChannel`) · provider 불변(`provider`). 지금은 이 구분이 **한국어 `message` 에만**
      있고 `2-api-convention.md §5.3` 자신이 `message` 를 *"사람이 읽을 짧은 설명"* 으로
      규정한다 — 소비자가 분기에 쓸 수 없다.
      신설하면 `3-error-handling.md §1` **카탈로그 등재가 함께 필요**하므로(§5.3 의 등재 의무)
      규약 확정 턴의 범위를 넘겼다. 판정에 필요한 것: **소비자가 실제로 이 셋을 갈라 다르게
      행동하는가** — 갈라 쓰지 않으면 코드만 늘고 카탈로그가 커진다.

- [x] **`15-chat-channel.md` 의 「배선 전 관측값」 서술 3곳이 배선 완료로 stale 해졌다**
      (planner, 2026-09-11 등재 · `--impl-done` `review/consistency/2026/09/11/12_18_21` W1 ·
      `/ai-review` `review/code/2026/09/11/12_00_40` W2). `details[].code` 배선이 머지되면서
      그 문단들이 낡는다. **술어를 갈라 잔존 범위를 확정했다** — reviewer 둘이 서로 다르게
      보고한 것이 서로 다른 술어를 재고 있었기 때문이다:

      | 술어 | 자리 | 배선 후 |
      |---|---|---|
      | ① *"배선 전 관측값"* 라벨 | §5.4.1 「토큰 변경 (rotation)」 행 · §5.4.1.1 「회전 (rotation)」 행 | **거짓은 아니다**(그 측정은 실제로 배선 전이었다). 현재형으로 읽혀 낡아 보인다 |
      | ② 명시적 시한 절 — *"그 PR 이 머지되기 전까지 이 문단은 「아직 안 실린다」를 서술할 뿐"* | §5.4.1.2 닫는 문단 | **명백히 거짓**이 된다 |

      **②가 필수, ①은 일관성.** 자기-반증형 소정정은 못 쓴다 — 그 문장은 `#1316` **planner
      턴**이 썼고 역할은 blame 이 아니라 **diff 스코프·게이트 종류·plan owner** 로 갈린다
      (조건 1 불성립 → 규약대로 두 PR 로 분리).
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-details-code-landed.md` (`--spec` `review/consistency/2026/09/11/13_52_49` BLOCK: NO).
      > 세 자리를 **배선 완료** 상태로 고쳤다(배선 PR `#1317` 과 날짜를 함께 적었다).
      > **취소선으로 원문을 남기지 않았다** — 그 형식은 자기-반증형 소정정의 조건 4 요구이고
      > 이 턴은 정규 planner 턴이다.
      >
      > 편집 순서는 **문서의 물리적 순서**(§5.4.1 → §5.4.1.2 → §5.4.1.1)로 했다 — 절 번호가
      > 역순이라 번호대로 가면 문서를 두 번 오간다(`--spec` `13_52_49` INFO 4).

- [x] **`authConfigId` 자리가 top-level 특화 코드 + generic `details.code` 를 병기한다 — §5.3
      판정 필요** (planner + 결정, 2026-09-11 등재 · `--impl-done` `12_18_21` W2 ·
      `/ai-review` `12_00_40` W1). 실측: `details[].code` 를 실은 13자리 중 **12곳은 top-level 이
      400 상태 기본값 `VALIDATION_ERROR`** 이고 **`assertAuthConfigInWorkspace` 한 곳만
      `AUTH_CONFIG_NOT_FOUND`** 다.

      `2-api-convention.md §5.3` 은 *"둘을 겹쳐 쓰지 않는다"* 고 적지만 그 문면은 **「같은 사유」**
      를 양쪽에 넣는 것을 금지한다 — `INVALID_FIELD` 는 *"이 필드가 잘못됐다"* 는 generic
      표지라 도메인 사유와 같지 않다. **그래서 금지에 걸리는지 자체가 판정 사안**이다:

      - **제거 근거**: 같은 파일 선례 `rethrowEndpointPathConflict` 는 top-level 을 상태
        기본값으로 두고 특화 코드를 `details.code` 에 싣는다 — 이 자리는 **반대 모양**이다.
      - **유지 근거**: 벗기면 `authConfigId` 만 `details.field` 에 generic 표지가 없는 특례가
        되어 소비자가 이 필드를 따로 처리해야 한다.

      **같은 결정으로 §5.3 의 「`field` 를 실으면 `code` 도 싣는다 — 형태 무관」 문면도 정정해야
      한다** — 그 규칙에 *"top-level 이 이미 특화 코드인 경우"* carve-out 이 없어 지금 과도하게
      넓다(내가 `#1316` 에서 그렇게 썼다). 코드 사이트에는 앵커 주석을 남겨 뒀다.
      **부수**: `AUTH_CONFIG_NOT_FOUND` 자체가 `3-error-handling.md §1` 카탈로그 **미등재**다
      (pre-existing). §5.3 이 등재 의무를 걸므로 같은 턴 후보.
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-details-code-landed.md` (`--spec` `review/consistency/2026/09/11/13_52_49` BLOCK: NO).
      > **판정: 걸리지 않는다.** 금지가 막는 해악은 **사유의 중복**이고 그것이 낳는 것은
      > **분기 대상의 모호성**이다. `INVALID_FIELD` 는 *"이것은 필드 수준 문제다"* 라는 generic
      > 표지로 **경쟁하는 사유를 싣지 않으므로** 모호성이 없다. §5.3 에 **판별 기준 표**를 넣었다
      > (같은 사유 반복 = 금지 / generic 표지 = 허용) + `authConfigId` 를 실례로 인용.
      >
      > **「형태와 무관하다」는 좁히지 않았다** — 좁혀 이 자리를 예외로 빼면 `authConfigId` 만
      > generic 표지가 없는 특례가 되어 소비자가 필드 수준 문제를 균일하게 판정할 수 없다.
      > 코드는 그대로 두고 **spec 이 그 조합을 허용한다는 것**을 명시했다.
      >
      > 부수도 닫았다 — `3-error-handling.md` **신규 §1.11** 로 등재(§1.9 의 top-level 코드 표
      > 형태). **그리고 `--spec` 이 새 문제를 찾았다**: 이 코드는 **400** 인데 저장소의
      > `*_NOT_FOUND` 는 전부 404 이고(`RESOURCE_NOT_FOUND`·`MODEL_CONFIG_NOT_FOUND`·
      > `USER_NOT_FOUND`·`WORKSPACE_NOT_FOUND`), **바로 그 status 일관성을 위해 코드를 쪼갠
      > 선례**(`MODEL_CONFIG_NOT_FOUND`/`MODEL_CONFIG_DEFAULT_MISSING`)도 있다. 이탈을 캡션으로
      > 밝히고 *"이 표에서 `_NOT_FOUND`=404 를 일반화하지 말 것"* 을 적었다. 개명 판단은 아래
      > 신규 항목.

- [x] **`details.code` 배선을 다른 spec 문서 3곳이 예시에서 누락한다** (planner, 2026-09-11 등재 ·
      `--impl-done` `12_18_21` W3). `providers/slack.md`·`providers/discord.md` 의
      `inboundSigningPlaintext` 거부 예시와 `2-navigation/2-trigger-list.md` 의 PATCH 註·`R-12` ·
      §2.3.1 이 `details.field` 만 인용한다. **코드 변경 불요** — SoT(§5.3)와 문서 동기화다.
      (`2-trigger-list.md` 는 `#1316` 에서 *"주어가 `field` 라 CV-1 이 거짓으로 만들지 않는다"*
      로 무편집 판정했는데, **배선이 끝난 지금은 「불완전」 축이 생겼다** — 그 판정은 여전히
      참이지만 예시를 보강하는 것이 낫다.)
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-details-code-landed.md` (`--spec` `review/consistency/2026/09/11/13_52_49` BLOCK: NO).
      > `slack.md` 1 · `discord.md` 1 · `2-trigger-list.md` **7곳**(총 8 출현 중
      > `endpoint_path` 제외 — 그 자리는 자기 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 갖고
      > §1.10 이 SoT 다). **`#1315` 의 「flat 이 맞다」 판정을 뒤집은 것이 아니다** — 그것은
      > **경로 형태 축**이고 이번은 **`code` 축**이다.
      >
      > **developer 트래커의 user-guide MDX 6파일과는 별개 파일 집합이다** — `spec/**` 대
      > `codebase/frontend/**` (`--spec` `13_52_49` INFO 6 이 표현 유사성을 지적).

- [ ] **`triggers.service.spec.ts` 의 pre-existing bare 시각 인용 3건** (developer, 2026-09-11
      등재). `#1145`(`77e0347d2`) 이 넣은 `` `12_37_14` `` · `` `12_56_06` `` 등이
      `review-citations.md §2`(날짜 포함 의무)를 어긴다. 이번 PR 이 넣은 2건은 고쳤다.
      **`dto-jsdoc-citation-guard.ts` 는 이걸 못 잡는다** — 스코프가 `isResponseDtoFile` 한정
      이라 spec 파일은 대상 밖이다(실측). 가드 스코프 확대 여부도 함께 판단.

- [ ] **`details[].code` 배선의 잔여 개선 9건** (developer, 2026-09-11 등재 · `/ai-review`
      `review/code/2026/09/11/12_00_40` INFO). 전부 비차단:
      (a) `botToken` **공백 전용 문자열**(`'   '`) 미차단 — `@MinLength(1)` 은 길이만 본다.
      trim 정책 결정 필요.
      (b) `SecretResolver.rotate`/`store` 자체의 빈 값 가드 — 위 별 항목과 동일 뿌리.
      (c) `rejectBlocked(field)` 헬퍼로 `BadRequestException` 보일러플레이트 ~10곳 축소.
      (d) `[A]`/`[등가성]` 두 `it.each` 병합 — NestJS 테스트 모듈 컴파일 10→5회 (CI 시간만).
      (e) `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 를 `Readonly<…>`/`Object.freeze`.
      (f) `triggers.mdx` 인접 문장(`botToken`/`botTokenRef`) + `providers/{slack,discord,telegram}`
      6파일의 `details.code` 표기 — 같은 단락 안에서 표기가 불균일해졌다.
      (g) *"`field` 없는 진단 payload 는 `code` 를 안 싣는다"* 회귀 캐너리
      (`not.toHaveProperty('code')`) — 이 PR 이 세운 **스코프 경계가 주석으로만** 지켜진다.
      (h) PATCH 경로의 `details.code` **e2e wire 증거** — 현재 POST 생성 경로 전용이다.
      (i) `common/` 리터럴 vs `modules/` canonical 상수 비대칭의 **spec Rationale** 한 줄
      (`error-codes.md` 또는 `2-api-convention.md §5.3`).
      (h·확장) e2e wire 증거를 **두 갈래(배열/객체) × 두 경로(POST/PATCH)** 축으로 본다 — 지금
      덮인 것은 **객체×POST 하나**다. 배열 갈래(파이프 층)의 `code` 는 이 PR 이 배선한 것이
      아니지만(`validation.pipe.ts` 가 이전부터 싣는다) 한 줄이면 고정된다:
      `chat-channel-trigger-create.e2e-spec.ts` 의 *"너무 짧은 plaintext"* 케이스가
      `details[0].field` 만 `.toBe()` 로 본다 (`/ai-review` `review/code/2026/09/11/12_41_25` W1).
      (j) `triggers.service.spec.ts` 의 `authConfigId` 테스트 주석이 *"§5.3 의 「둘을 겹쳐 쓰지
      않는다」를 **어기지 않는다**"* 로 **결론을 단정**하는데, 같은 자리의 소스 주석은
      *"판정 미해결"* 이라 적는다 — 소스가 맞고 **2라운드에 쓴 테스트 주석이 과했다**. 위
      §5.3 판정 항목과 **함께** 처리해야 한다(판정이 나오면 어차피 다시 바뀐다).
      (`/ai-review` `review/code/2026/09/11/12_41_25` W2)
      (k) `password.util.spec.ts` 의 `it.each` JSDoc 이 `'P@ss1'` 을 *"3종"* 이라 적는데 실제로는
      **4종**이다(`P`·`@`·`ss`·`1`). 결론(길이 분기만 발동)은 맞고 개수만 틀렸다.

- [ ] **`botToken` provider 별 형식 검증이 문서에만 있고 코드에 없다** (planner + developer,
      <!-- 2026-09-12: 이 항목이 인용할 「정답 문장」이 바뀌었다 — `2-trigger-list.md` 의
           *"401/403 에서 드러난다"* 는 **삭제됐다**(복제 제거). 이제 인용할 것은
           `15-chat-channel.md §5.4` 의 **원인 기반** 서술이고 "401/403" 이 아니다. -->
      2026-09-11 등재 · `--impl-prep` `review/consistency/2026/09/11/10_28_52` WARNING 2 + INFO 2).
      **실측**: `^\d{6,}:[A-Za-z0-9_-]{30,}$` 는 **docs·i18n 4곳에만** 있고
      (`content/docs/06-integrations-and-config/telegram{,.en}.mdx` · `i18n/dict/{ko,en}/triggers.ts`)
      **코드에 구현이 없다**. 그리고 그 문서들이 약속하는 `BOT_TOKEN_INVALID` 는 **형식 검사에서
      나오지 않는다** — `triggers.service.ts` 가 `setupChannel` 의 **외부 API 401/403** 을 그
      코드로 번역한다. 즉 *"형식 위반 시 400 `BOT_TOKEN_INVALID`"* 는 **메커니즘이 틀린 서술**이다.

      두 갈래가 있다:
      - **planner**: `2-navigation/2-trigger-list.md` §3 `botToken` 행이 그 정규식을
        **provider 무자격**으로 인용하고(telegram 전용 형식인데 행의 주어는 3 provider),
        인용 target(`15-chat-channel.md §5.4`)에는 **그 정규식이 아예 없다**(실측 0건).
        스코프를 telegram 전용으로 좁히거나 인용을 `§4.1` 로 정정.
      - **developer**: provider 별 형식 검증을 실제로 구현할지 — 하면 docs 의 서술이 참이 되고,
        안 하면 docs 를 *"형식은 검증하지 않는다"* 로 고쳐야 한다. **지금은 문서가 구현보다 넓다.**
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-details-code-landed.md` (`--spec` `review/consistency/2026/09/11/13_52_49` BLOCK: NO).
      > **planner 갈래만 닫았다.** `2-trigger-list.md` §2.3.1 행을 *"서버는 형식을 검증하지
      > 않는다 — 잘못된 토큰은 `setupChannel` 의 외부 provider API 401/403 에서
      > `BOT_TOKEN_INVALID` 로 드러난다"* 로 고치고, telegram 형식은 **입력 안내 · telegram
      > 전용**임을 밝혔다. 죽은 인용(`§5.4` 에 그 정규식 0건)도 교체했다.
      > `15-chat-channel.md §4.1` JSON 주석의 느슨한 변형에도 같은 단서를 붙였다
      > (`--spec` `13_52_49` INFO 3).
      >
      > **developer 갈래는 존속한다** — user-guide MDX·i18n **4곳**이 아직
      > *"형식 위반 시 400 `BOT_TOKEN_INVALID`"* 라고 적는다(메커니즘이 틀린 서술). spec 과
      > **같은 사실**을 말하므로 반드시 짝으로 처리돼야 한다. 구현 여부 결정도 여기 남는다.

- [ ] **`AUTH_CONFIG_NOT_FOUND` 가 400 인데 이름이 `_NOT_FOUND` 다 — 개명 또는 404 전환**
      (planner + 결정, 2026-09-11 등재 · `--spec` `review/consistency/2026/09/11/13_52_49` WARNING 1).
      이 저장소의 `*_NOT_FOUND` 는 **전부 404** 이고, **그 status 일관성을 위해 코드를 쪼갠
      선례**가 있다 — `MODEL_CONFIG_NOT_FOUND`(404) / `MODEL_CONFIG_DEFAULT_MISSING`(400) 분리
      (2026-06-12 사용자 결정). `3-error-handling.md §1.11` 등재 시 **이탈을 캡션으로 밝혔지만**,
      이름 자체는 여전히 오독을 유발한다.
      판정에 필요한 것: **살아 있는 wire 코드의 소비자가 이미 분기하고 있는가.** 그렇다면
      개명은 파괴적 변경이고, 그 경우 선택지는 (a) 이름 유지 + 캡션으로 계속 가르기
      (b) 새 코드 신설 + deprecate 2단계. 선례의 처방은 (b) 쪽이었다.

- [ ] **결정 라벨 네임스페이스가 3회 충돌했다 — 구조적 처분 검토** (planner,
      2026-09-11 등재 · `--spec` `13_52_49` WARNING 2). `D-*`(`R-CC-21` 하위 결정과 충돌,
      `codebase/**` 10여 곳 인용) → `CV-*`(`CCH-CV-0N`·`ED-CV-0N` 요구사항 ID 계열과 토큰 공유)
      → (세 번째는 **라벨 자체를 안 쓰고** 변경안 번호로 통합). **매번 국소 회피였다** — checker 가
      *"세 번째 재발이면 구조로"* 를 지적했다.
      처분 후보: `spec/conventions/` 에 **예약 접두 레지스트리** 짧은 문서(어느 접두가 어느
      네임스페이스에 속하는지 + 신규 라벨 도입 시 판정 절차). 규약 문서 신설까지 갈지는 별 판단.
      > **함께 고정할 것 — 판정 패턴의 함정.** 3회째 조사에서 `\bD-[0-9A-Z]\b` 로 재고
      > *"`D-3`·`D-9` 도 살아 있다"* 고 적었는데 그 둘은 **`R-D-3`/`R-D-9` 의 부분 문자열**이었다.
      > **`-` 는 단어 경계라 `\b` 가 하이픈 접두를 막지 않는다**
      > (`printf 'R-D-3' | grep "\bD-3\b"` 가 매치한다). 레지스트리를 만들면 **판정 명령도
      > 같이 적어야** 한다 — 종전 같은 병은 패턴이 **좁아서** 났는데 이번엔 **넓어서** 났다.

- [x] **`slack.md`·`discord.md` 의 `TriggersService.assertInboundSigningPlaintextByProvider`
      귀속 표기가 부정확해졌다** (planner, 2026-09-11 등재 · `/ai-review`
      `review/code/2026/09/11/15_31_54` SPEC-DRIFT). 그 함수가 `TriggersService` private 메서드
      에서 **module-level 함수**(`modules/triggers/chat-channel-input-rules.ts`)로 이동했다.
      **실질은 여전히 참이다** — `TriggersService` 가 그 규칙을 호출하고 생성 시점에 검증하며
      위반 시 400 `VALIDATION_ERROR` 다. 부정확한 것은 **심볼 경로**뿐이다.
      처방: *"`TriggersService` 가 `chat-channel-input-rules` 의 … 를 호출해 검증"* 형태로
      호출자/정의처를 갈라 적는다. **자기-반증형 소정정 조건 1 불성립**(그 문장은 이전 planner
      턴이 썼다) → planner 턴.
      > **드리프트 범위는 2곳이다.** 같은 함수를 **클래스 접두 없이 함수명만** 인용하는 3곳
      > (`2-trigger-list.md:155` · `discord.md:76` · `15-chat-channel.md:432`)은 이동 후에도
      > 참이라 대상이 아니다 — 주어를 확인해 가른 결과다.
      > **✅ 2026-09-11 해소** — planner 턴 `plan/complete/spec-draft-chat-channel-binder-drift.md` (`--spec` `review/consistency/2026/09/11/{20_33_26,20_47_56}` BLOCK: NO).
      > 위 `setupChatChannel` 항목과 **같은 턴에 함께 닫았다** — `--spec` 이 *"둘은 같은 이동이
      > 만든 같은 드리프트 클래스"* 임을 짚어, 심볼 하나가 아니라 **옮긴 심볼 9개 전체**로
      > 다시 열거한 결과 이 두 곳이 그 스캔에 걸렸다. 처방대로 호출자/정의처를 갈라 적었다 —
      > `assertInboundSigningPlaintextByProvider` (`chat-channel-input-rules.ts` —
      > `TriggersService` 가 생성 경로에서 호출).

- [ ] **`chatChannelLastError` 에 외부 adapter 오류 **원문**이 저장·노출된다** (developer + 보안,
      2026-09-12 등재). `setupChatChannel` 의 실패 경로가 `message.slice(0, 1024)` 를 DB 컬럼에
      쓰고, 그 값은 트리거 상세 응답으로 **워크스페이스 멤버에게 노출**된다. 외부 오류 원문은
      URL·query·내부 식별자·API key 조각을 담을 수 있다.
      > ### 이 항목은 **22개 리뷰 세션에서 제기되고 3개월간 매번 유실됐다**
      >
      > 2026-09-12 실측: `review/**` 에서 `chatChannelLastError` 를 언급한 **코드 리뷰 세션이
      > 22개**(2026-06-12 ~ 2026-09-11)인데, `plan/` 전체에는 **한 번도 등재되지 않았다.**
      > RESOLUTION 마다 *"이미 트래커 등재"* 라고 적혀 있었고 **그게 매번 거짓이었다.**
      >
      > **원인은 알려진 것이다 — `review/**` 는 SoT 가 아니다.** 그 문장은 증거처럼 보이지만
      > 다음 세션은 `review/` 를 읽지 않는다. 그래서 규율을 좁힌다: ***"이미 등재됨" 을 쓰기 전에
      > grep 해서 그 항목 제목을 인용한다. 인용할 수 없으면 등재되지 않은 것이다.***
      >
      > 처방 판단에 필요한 것: 이 값은 **운영자용 진단**이라 단순 제거가 답이 아닐 수 있다.
      > 후보 — (a) 분류 코드만 저장(`R-CC-15` 의 화이트리스트 패턴) (b) 원문은 서버 로그,
      > 컬럼엔 코드 (c) 컬럼은 유지하고 **응답에서만** 제외. 응답 축의 형제 결정은
      > `15-chat-channel.md R-CC-23`(§5.4 응답 본문에서 원문 echo 중단)이다.

- [x] **`3-error-handling.md §1` 중앙 카탈로그에 chat-channel rotate 에러 코드군이 없다**
      (planner, 2026-09-12 등재 · `--spec` `review/consistency/2026/09/12/12_05_58` INFO 6).
      `BOT_TOKEN_INVALID` · `CHAT_CHANNEL_SETUP_FAILED` 등이 다른 도메인과 달리 중앙 카탈로그에
      등재 자리가 없다. 기존 갭이고 `R-CC-23` 턴의 동기가 아니라 스코프 밖으로 뒀다 —
      **그 유예 근거가 봉인되지 않도록** 여기 옮겨 적는다(`§1.12` 가칭).

      > **✅ 2026-09-12 해소** — `spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO). `§1.12` 신설(6종 + status + SoT). §1.11 의
      > 형식을 그대로 따랐고, `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID` 어순 혼동 경고를 달았다.
- [ ] **CCA §1.1.2 의 401/403 fallback 제거 판정** (developer, 2026-09-12 등재 ·
      `--spec` `12_22_24` INFO 3). `R-CCA-9` 가 그 fallback 을 *"message 원문으로 분기하지 않는다"*
      에 대한 **한시적 예외**로 두고 제거 조건을 적었다 — **v1 provider 3종(telegram·slack·discord)이
      모두 `code` 를 부착하면 삭제 후보**. 조건만 적고 추적하지 않으면 한시적 예외가 영구가 되므로
      여기서 추적한다. 착수 신호: 위 「setupChannel 실패 분류」 항목의 developer 후속 2~4 완료.

      > ### 🔔 **2026-09-12 — 착수 신호는 켜졌다. 실측 판정은 「아직 제거하지 말 것」**
      >
      > 3종 전부 `code` 를 부착했다(위 항목). 그런데 **부착은 provider 별 *주 경로*에 한정**되고,
      > fallback 이 아직 **유일한 방어**인 경로가 남아 있다 — 지금 지우면 이것들이 **조용히
      > 502 로** 바뀐다:
      >
      > | 경로 | 왜 `code` 가 없나 | 지금 fallback 이 하는 일 |
      > |---|---|---|
      > | Slack 4xx 가 **JSON 이 아닐 때** | client 가 `error: 'HTTP 401'` 을 **합성**한다 — 화이트리스트 5값에 없다 | message 의 `401` 을 보고 400 |
      > | Telegram body 파싱 실패 / 재시도 소진 | 합성 응답에 `error_code` 가 **없다** | description 에 숫자가 있으면 400 |
      > | 향후 신규 provider | 부착 전 기본 상태 | 400 (조용한 502 보다 낫다) |
      >
      > **제거의 선행 조건은 "3종 부착" 이 아니라 "위 세 경로가 닫힘" 이다.** 조건문을 이렇게
      > 좁혀 적어 두지 않으면 다음 사람이 신호만 보고 지운다 — 그 함정이 이 표의 존재 이유다.
      > (spec §1.1.2 의 조건문 자체는 planner 턴이 갱신한다.)

- [x] **`setupChannel` 실패 분류 — spec 은 planner 턴에서 고쳤고 **구현이 남았다**
      (원 제목: *"`translateSetupChannelError` 가 discord verify_key 불일치를 502 로 떨어뜨린다"*)**
      (developer, 2026-09-11 등재 · `/ai-review` `review/code/2026/09/11/15_31_54` W3).
      **재현했다**: `discord.adapter.ts` 는 `'BOT_TOKEN_INVALID: Discord verify_key 가 등록된
      public key 와 불일치'` 를 던지는데 **숫자가 없어서** 판별식 `/\b(401|403)\b/` 에 안 걸리고
      fallback `CHAT_CHANNEL_SETUP_FAILED`(502) 로 간다. 의도는 400 `BOT_TOKEN_INVALID` 다.
      **이동이 만든 회귀가 아니다**(이동 전부터 테스트 0건) — 캐너리로 현재 동작을 고정해
      뒀으므로 고치면 그 테스트가 RED 가 된다.
      ~~처방 후보: (a) 판별식을 `BOT_TOKEN_INVALID` 리터럴까지 보게 확장 (b) adapter 가 status 를
      메시지에 싣게 통일. **(b) 가 근본이다** — 판별식이 문자열을 추측하는 구조 자체가 이 결함의
      원인이고, (a) 는 다음 provider 에서 같은 일이 난다.~~

      > ### ⚠️ **2026-09-12 — 위 처방은 기각됐다. 되살리지 말 것**
      >
      > **(b) 는 이 케이스를 못 고친다** — discord 는 200 을 주고 `verify_key` 만 다른 것이라
      > **실을 status 자체가 없다**. 그리고 Slack 은 자격 증명 거부를 **HTTP 200 +
      > `{ok:false, error:'invalid_auth'}`** 로 주므로 status 를 싣는 방식이 원리적으로 안 된다.
      > 채택된 근본 처방은 **typed `code` 프로퍼티**다
      > ([CCA §1.1.2](../../spec/conventions/chat-channel-adapter.md) · `R-CCA-9`).
      > (b) 와 유사한 "message 에 싣는다" 계열은 **전부 기각**이다 — 문자열 파싱으로 제어흐름을
      > 가르는 형태이고 이 저장소는 같은 문제에 세 번 반대로 결정해 뒀다.
      >
      > **취소선으로 남기는 이유**: 이 문장을 지우면 다음 사람이 같은 결론에 다시 도달하느라
      > 같은 조사를 반복한다. 남기면 **기각 사실과 근거가 함께 보인다.**

      > ### ✅ **spec 은 닫혔다 — 남은 것은 구현이다** (planner 턴 `plan/complete/spec-draft-setup-error-classification.md` (`--spec` `review/consistency/2026/09/12/{11_50_28,12_05_58,12_22_24}` — 1회차 BLOCK: YES 후 2·3회차 BLOCK: NO))
      >
      > **결함은 셋이었다.** ① 분류 술어가 2/3 provider 에서 구현 불가능(Slack 의
      > `invalid_auth` 가 **실질 동기** — discord 한 건이 아니다) ② §5.4 가 `502` 라 적는데
      > **구현은 두 분기 모두 400**(런타임 실측 — `getStatus()` 를 단언한 테스트가 0건이라
      > 아무도 몰랐다) ③ 반증된 서술이 **3곳에 복제**.
      >
      > **developer 후속 (이 항목이 추적한다)**:
      > 1. `translateSetupChannelError` — `err.code` 우선 판별 · 401/403 fallback 유지 ·
      >    **`BadGatewayException`(502)** 로 정정 · `details.reason` 원문 제거 → `logger.warn`.
      >    컨트롤러에 `@ApiBadGatewayResponse` 부착(**저장소 최초 502**) ·
      >    `http-exception.filter` 가 502 를 표준 봉투로 싸는지 **실측 확인**(한 번도 지나간 적 없는 경로).
      > 2. `slack.adapter.ts` — `auth.test` 실패에 `code`. **`ratelimited` 류 제외**(자격 증명 문제가
      >    아니다). 어느 `result.error` 가 자격 증명 거부인지 **실측해 열거**할 것.
      > 3. `discord.adapter.ts` — verify_key 불일치의 **message 접두를 `code` 로 교체**.
      >    ⚠️ 그 파일엔 **Discord 원본 응답의 숫자형 `code`**(`app.code`/`res.code`)가 이미 있다 —
      >    두 개를 헷갈리면 조용히 잘못 분기한다.
      > 4. `telegram.adapter.ts` — 401/403 경로에 `code` 부착(fallback 의존 해소).
      > 5. 캐너리 뒤집기 — *"discord verify_key → 502"* 가 RED 가 되는 것이 **의도**다.
      >    그 자리에 verify_key → 400 · **Slack `invalid_auth` → 400** · **`getStatus()` 단언**.
      >    **아래 「`chat-channel-input-rules.spec.ts` 잔여 보강 5건」의 (d) 와 같은 블록이므로
      >    같은 커밋에서 처리**한다 — (d) 의 `details.reason` 단언은 이 결정으로 뜻이 바뀌어
      >    **부재**를 단언해야 한다.

      > ### ✅ **2026-09-12 구현 완료 — developer 후속 1~5 전부**
      >
      > `feat(chat-channel): setupChannel 실패를 code 로 선언하고 502 를 실현한다` +
      > 리뷰 후속 (`/ai-review` `review/code/2026/09/12/13_41_55` CRITICAL 0 · WARNING 7 → RESOLUTION).
      >
      > **실측 몇 가지가 착수 전 예상과 달랐다 — 그쪽이 이 항목의 잔여를 만든다:**
      >
      > 1. **필터는 안 고쳤다.** `http-exception.filter` 가 `exception.getStatus()` 를 쓰고
      >    `code` 를 던진 객체에서 집으므로 502 가 표준 봉투로 그대로 나간다. 다만
      >    `getCodeFromStatus` 에 502 행이 **없다** — 우리가 항상 `code` 를 실어 도달 불가라
      >    건드리지 않고 별 항목으로 등재했다(없는 코드 `BAD_GATEWAY` 를 발명하면 spec drift).
      > 2. **telegram 은 client 가 아니라 adapter 에 붙였다.** Bot API 가 status 를 **body 의
      >    `error_code`** 에 싣고 client 가 4xx body 를 그대로 반환하므로 adapter 에서 보인다.
      > 3. **`code` 는 네 뜻이다.** spec §1.1.2 표의 셋에 더해 **Node/undici 시스템 에러**
      >    (`ENOTFOUND`·`ECONNREFUSED`·`UND_ERR_*`)도 `.code` 를 갖는다 — `--impl-prep` INFO 4 가
      >    코드를 쓰기 **전에** 잡았다. 판별은 화이트리스트 **정확 일치**이고 `ENOTFOUND → 502`
      >    캐너리가 그것을 고정한다.
      > 4. **뮤테이션 1종이 생존했다** — `discord-client.ts` 의 `status` 배선을 지웠는데 434개가
      >    전부 GREEN(adapter 테스트가 `status` 를 **자기가 넣어** 준다). `discord-client.spec.ts`
      >    를 신설해 8/8 RED.

- [ ] **`teardownChannel`·`revokeBotToken` 은 아직 `code` 를 선언하지 않는다** (developer,
      2026-09-12 등재). [CCA §1.1.2](../../spec/conventions/chat-channel-adapter.md) 의 계약은
      *"`setupChannel`(및 `teardownChannel`·`revokeBotToken`)"* 세 함수를 지목하는데, 이번 PR 은
      **`setupChannel` 만** 부착했다. **의도적 스코프**다 — 나머지 둘은 best-effort 경로라
      현재 클라이언트로 오류를 올리지 않는다(`teardownChannel` 은 삼키고 warn). 즉 지금은
      **부착해도 소비자가 없다.** 착수 신호: 그 둘 중 하나가 응답 계약을 갖게 될 때.

- [ ] **`getCodeFromStatus` 에 502 케이스가 없다 — 지금은 도달 불가** (developer,
      2026-09-12 등재). `common/filters/http-exception.filter.ts` 의 status→code 기본 매핑에
      502 행이 없어 `default: 'INTERNAL_ERROR'` 로 떨어진다. **현재 도달 불가**다 —
      `translateSetupChannelError` 가 항상 `code` 를 실어 던지므로 필터가 `resp.code` 를 먼저
      집는다(실측: 502 응답의 code 는 `CHAT_CHANNEL_SETUP_FAILED`). 그래서 이번 PR 은 건드리지
      않았다. **`code` 없이 `BadGatewayException` 을 던지는 두 번째 호출자가 생기면** 그때
      502 가 `INTERNAL_ERROR` 로 표기되므로, 그 시점에 행을 추가한다. 지금 `BAD_GATEWAY` 를
      발명하면 `3-error-handling.md` 카탈로그에 없는 코드가 생겨 spec drift 다.

- [x] **`rotateBotToken` 의 swagger 응답 문서화 잔여 — 404 와 200 봉투** (developer,
      2026-09-12 등재). 이번 PR 이 `@ApiBadRequestResponse` + `@ApiBadGatewayResponse` 를
      달았지만(§5.4 가 **가르는** 두 축이라 함께 문서화), 같은 표의 `404 RESOURCE_NOT_FOUND`
      와 200 응답 봉투(`ApiOkWrappedResponse`)는 **이 PR 의 계약 축이 아니라** 손대지 않았다.
      `swagger.md §2-4` 기준으로는 둘 다 있어야 한다.
      > **✅ 2026-09-12 완료** (`chat-channel-rules-cleanup`). `@ApiNotFoundResponse` +
      > `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)`. 컨트롤러 반환 타입도
      > `Awaited<ReturnType<...>>` → **DTO** 로 바꿨다 — 종전 형태는 서비스가 무엇을 돌려주든
      > 따라가므로 선언과 실제가 갈려도 조용했다.
      >
      > **신규 DTO 를 `dto/responses/` 에 두지 않았다** — `15-chat-channel.md` 의 glob
      > `dto/chat-channel-*.dto.ts` 는 `*` 가 `/` 를 안 넘어 `responses/` 하위를 **못 잡는다**
      > (정본 매처로 실측). 소유 spec 이 자기 파일을 못 보는 그 형태가 `R-CC-22` 가 막으려던
      > 것이라 평평한 자리를 택했다. 관례 충돌은 아래 신규 항목으로 등재.

- [x] **CCA frontmatter 의 *"§1.1.2 계약은 미구현"* 주석이 stale 이다** (planner,
      2026-09-12 등재 · **같은 날 해소**). `spec/conventions/chat-channel-adapter.md` frontmatter
      `pending_plans` 위 주석이 *"§1.1.2 의 `code` 선언 계약은 **미구현**이다"* 라고 적었는데 이
      PR 이 3종 모두에 부착했다. **planner 가 쓴 문장**이라 자기-반증형 소정정 조건 1 불성립 →
      `ESCALATE=spec` 경로로 draft → `--spec` (`review/consistency/2026/09/12/14_11_58` BLOCK: NO)
      → 커밋 `3c47885a3` 에서 정정.
      > **이 항목은 등재되는 순간 이미 반증돼 있었다** (`/ai-review` `14_23_31` documentation
      > WARNING 2 가 잡았다). 내가 항목 문안을 spec 을 고치기 **전에** 써 두고 같은 커밋에 함께
      > 실은 탓이다 — 미체크로 남으면 다음 사람이 **끝난 일을 쫓는다**. 처분: 등재와 해소를
      > 같은 줄에 적는다. 남은 것은 `pending_plans` 나머지 3개(discord gateway·slack socket
      > mode·visual SSR)가 여전히 미구현이라 `status: partial` 이 유효하다는 사실뿐이고, 그건
      > 위 커밋의 주석이 이미 적고 있다.

- [x] **`slack.md §3.1` 의 개방형 열거를 확정 5값으로** (planner, 2026-09-12 등재 ·
      `--impl-prep` `review/consistency/2026/09/12/12_54_15` INFO 2). 코드가
      `invalid_auth`·`not_authed`·`account_inactive`·`token_revoked`·`token_expired` **5값**을
      자격 증명 거부로 확정했는데(`slack.adapter.ts` 의 `SLACK_CREDENTIAL_REJECTED_ERRORS`),
      spec 은 *"..."* 로 열어 두고 있다. **이 목록은 저장소 안에서 실측 불가**(외부 API 응답)라
      코드 주석에 출처를 적었고, spec 이 그것을 정본으로 받아야 다음 사람이 임의로 늘리지 않는다.

      > **✅ 2026-09-12 해소** — `spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO). `...` 를 `token_expired` 로 닫고, *"열거에
      > 없으면 502"* 와 *"코드 상수와 함께 늘린다"* 를 각주로. `Integration.status_reason`
      > 의 동명 값과 **별 네임스페이스**임도 함께 적었다(`--spec` naming_collision W3).
- [x] **CCA §1.1.2 다의성 표에 Node 시스템 `.code` 행을 추가한다** (planner, 2026-09-12 등재 ·
      `--impl-prep` `12_54_15` INFO 6). 표가 `code` 의 세 뜻을 적는데 **네 번째**가 있다 —
      Node/undici 시스템 에러(`ENOTFOUND`·`ECONNREFUSED`·`UND_ERR_*`)도 `.code` 를 갖는다.
      `telegram-client.ts` 주석이 그 경로의 실재를 이미 적고 있었다. 구현은 **화이트리스트 정확
      일치**로 막았고 `ENOTFOUND → 502` 캐너리로 고정했으나(`chat-channel-input-rules.spec.ts`),
      **원칙이 spec 에 없으면** 다음 사람이 `if (err.code)` 로 쓴다.

      > **✅ 2026-09-12 해소** — `spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO). 표가 **네 뜻**이 됐고, *"truthiness 판별은
      > 네트워크 단절을 토큰 문제로 보고한다"* 와 정확 일치 원칙을 함께 적었다.
- [x] **`2-api-convention.md §7` rate-limit 표에 chat-channel per-chat 행이 없다** (planner,
      2026-09-12 등재 · `--impl-prep` `12_54_15` WARNING 2). `CCH-NF-03`(기본 60 req/min,
      1–600 override, `ChatChannelRateLimiterService`)이 §7 *"throttle 수치의 단일 진실은 본 표"*
      에 미등재. 형제 사례(EIA inbound·SSE 동시연결)는 이미 행으로 있다. 이번 PR 의 계약 축이
      아니라 스코프 밖으로 뒀다.

      > **✅ 2026-09-12 해소** — `spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO). 행 신설 + **이 행만 429 가 아니라 202** 라는
      > 예외를 표 위 캐비엇으로 적었다(R-CC-19) — 안 적으면 *"429 로 통일"* 이 정합성
      > 개선으로 오인된다.
- [x] **`15-chat-channel.md` 가 "3.x" 절 번호를 두 계층에서 중복 사용한다** (planner,
      2026-09-12 등재 · `--impl-prep` `12_54_15` WARNING 3). Overview 안의 `### 3. 요구사항`
      (§3.1~§3.6)과 Overview 밖 `## 3. 처리 흐름`(자체 §3.1~§3.3)이 겹쳐 *"§3.3"* 이 문서 안에
      두 곳을 가리킨다. **링크·인용의 오배송 위험**이라 문서 구조 문제로 등재한다.

      > **✅ 2026-09-12 — 구조 변경을 *기각*으로 종결** (`spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO)).
      > 두 처방의 비용을 실측했다: (a) 최상위 승격+cascade **48+** 링크 · (b) Overview 재번호
      > **34** 링크. 표시 번호의 미관을 위해 그만큼을 건드리지 않는다(`#970` 선례).
      > 대신 **인용 규칙**(제목 병기)을 두 자리에 명문화하고 기각을 `R-CC-24` 로 정식화했다
      > — 그래야 다음 checker 가 같은 측정을 반복하지 않는다. 되살릴 조건도 함께 적었다.
- [x] **`15-chat-channel.md §7` 파일 트리가 `chat-channel-input-rules.ts` 를 "입력" 으로만
      적는다** (planner, 2026-09-12 등재 · `--impl-prep` `12_54_15` INFO 1). 그 파일은
      `translateSetupChannelError`(출력측 에러 변환)도 담는데 §7 서술은 *"입력 검증·변환 순수
      함수"* 다 — developer 가 서술만 보고 오배치할 여지. **코드 쪽 쌍둥이는 이미 등재돼 있다**:
      「`chat-channel-input-rules.ts` 의 구조 정리 6건」의 (b)(*"파일명·docstring 이 '입력 규칙'
      인데 출력측 변환이 섞여 있다 — 이름을 넓히거나 분리"*). 둘은 **같은 사실**이라 짝으로
      처리한다 — 분리를 택하면 §7 서술은 자동으로 참이 된다.

      > **✅ 2026-09-12 해소** — `spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO). 서술을 *"입·출력 도메인 규칙"* 으로 고치고
      > 신규 응답 DTO 도 트리에 넣었다. **파일 분리는 하지 않았다** — 코드 쪽 쌍둥이 항목이
      > 그 결정을 갖고, 그 파일을 다음에 만질 때 함께 한다.
- [x] **`chat-channel-input-rules.ts` 의 구조 정리 6건** (developer, 2026-09-11 등재 ·
      `/ai-review` `review/code/2026/09/11/15_31_54` W4 + INFO). 전부 비차단:
      (a) `BadRequestException({code, message, details:{field, code}})` 봉투 생성이 **7회 이상**
      거의 동일하게 반복 — 파일 docstring 이 그 봉투를 계약으로 선언하므로 신규 필드를 복붙하다
      `details.code` 를 빠뜨리면 **컴파일 타임에 안 잡히고** 계약이 조용히 깨진다.
      `throwValidationError(field, message, code?)` 헬퍼로 한 곳에 모은다.
      (b) 파일명·docstring 이 *"입력 규칙"* 인데 출력측 변환(`translateSetupChannelError`)이
      섞여 있다 — 이름을 넓히거나 분리.
      (c) 에러 절단 길이 `256` 이 매직 넘버로 2회 하드코딩.
      (d) `chatChannel as unknown as Record<string, unknown>` 이중 캐스팅 2곳 → `hasField` 헬퍼.
      (e)·(f) 인접 주석 2곳이 이동으로 부정확해졌다 —
      `chat-channel-rejection-messages.const.ts`(*"TriggersService 가드"*) ·
      `dto/chat-channel-config.dto.ts`(*"provider별 추가 검증은 TriggersService 가 수행"*).
      이제 규칙은 클래스 밖에 있고 `TriggersService` 는 **호출만** 한다.

      > ### ✅ **2026-09-12 종결** (`chat-channel-rules-cleanup`) — 단 두 항목의 판정이 다르다
      >
      > | 항목 | 처분 |
      > |---|---|
      > | (a) 봉투 반복 | `throwInvalidField` + `rejectBlockedField`. **기록은 "7회 이상", 실측은 11곳** |
      > | (b) 파일 성격 불일치 | **주석만 넓혔다 — 파일은 안 쪼갰다.** 분리는 `§7` 파일 트리(planner 축)와 **함께** 결정해야 해서, 아래 planner 항목이 그 쌍을 갖는다 |
      > | **(c) 매직 넘버 `256`** | **⛔ 소멸** — `#1324` 가 `details.reason` 을 없애며 같이 사라졌다(`grep` **0건**). 착수 전 재판정이 아니었으면 없는 것을 찾았다 |
      > | (d) 이중 캐스팅 | `hasField` 로 한 곳에 |
      > | (e)(f) stale 주석 | **기록은 2곳, 실측은 3곳** (`dto/chat-channel-config.dto.ts` 가 두 군데) |
      >
      > **오타가 조용히 통과하던 자리를 닫았다** — 종전에는 존재 검사(`blocked.botTokenRef`)와
      > 봉투(`field: 'botTokenRef'`)가 따로 적혀 있었고 `Record<string, unknown>` 위의 오타는
      > `undefined` 로 통과한다(가드가 사라져도 아무도 모른다). 인자를
      > `ChatChannelBlockedField` 로 받으니 이제 컴파일 에러다.

- [x] **`chat-channel-input-rules.spec.ts` 잔여 보강 5건** (developer, 2026-09-11 등재 ·
      `/ai-review` `review/code/2026/09/11/16_16_44` W2 + INFO 3~6). 전부 같은 파일·같은 성격이라
      한 번에 처리한다:
      (a) `as never` 캐스팅 제거 — `tsc --noEmit` 실측상 **불필요**하고(진단 197건 동일)
      *"오버로드는 캐스팅 없이 못 부른다"* 는 오해를 준다.
      (b) `mode:'update'` × 내부 필드 3종(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)
      조합 — 통합 스펙이 이미 잡지만 이 파일 단독으로는 R-CC-21 표면을 못 덮는다.
      (c) `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard — 뮤테이션 시
      142건 GREEN. 다만 DTO 검증이 선행 차단해 **도달 불가능한 방어 코드**로 보인다(그 판정도 함께).
      ~~(d) `translateSetupChannelError` 의 non-Error 입력 분기 + `details.reason` **값** 단언.~~
      **✅ 2026-09-12 완료 — 단 뜻이 바뀌었다.** `R-CC-23` 이 응답 본문의 원문 echo 를 중단시켜
      단언 대상이 **값이 아니라 부재**가 됐다(`details` 부재 + 본문에 provider 문자열 0건).
      non-Error 입력 분기도 같은 블록에서 덮었다. **남은 4건 (a)(b)(c)(e) 은 유효하다.**
      (e) provider별 **label 문구** 미단언 — label 스왑 뮤턴트가 아직 통과한다.

      > ### ✅ **2026-09-12 종결** — (d) 는 `#1324`, 나머지 넷은 `chat-channel-rules-cleanup`
      >
      > - **(e) 가 이 항목의 값어치였다.** 부재 분기는 두 provider 의 `details` 가 **동일**해서
      >   그 필드만으로는 **원리적으로** 못 가른다 — 판별자는 `message` 다. 단언을 넣으니 label
      >   스왑 뮤턴트가 **2건 RED**(종전 0건). Slack 사용자가 *"Discord application public key 가
      >   필요합니다"* 를 보는 회귀가 그 자리였다.
      > - (a) `as never` 제거 — 오버로드는 캐스팅 없이 불린다(제거 후 진단 **197건 불변**).
      > - (b) `update` × 내부 필드 3종 — 값 필드 하나만 태우던 자리.
      > - **(c) 는 "고치지 않는다" 가 결론이다.** `OmitType` 이 `provider` 의 `@IsIn` 을 상속해
      >   PATCH 에서도 필수라 **HTTP 경로에서 도달 불가**이고, 그래서 그 falsy 분기를 지우는
      >   뮤턴트는 **살아남는 것이 정상**이다(실측 확인). 그럼에도 남긴다 — 지우면 DTO 를 우회한
      >   호출자가 *"provider 는 PATCH 로 바꿀 수 없어요"* 라는 **틀린 메시지**를 받는다.
      >   DTO 층이 실제로 막는다는 사실은 `trigger-dto-validation.spec.ts` 의 신규 케이스가
      >   고정한다 — 그 근거가 없으면 주석의 *"도달 불가"* 가 다음 사람에게 **삭제 허가증**이 된다.

- [x] **사전 naming 게이트는 "예고한 이름" 만 본다 — 구현 중 태어난 식별자는 사각지대**
      (harness 또는 프로세스, 2026-09-12 등재 · `/ai-review` `16_17_57` CRITICAL 계기).
      `--impl-prep` 의 `naming_collision` 은 plan 이 예고한 헬퍼 2종만 grep 했고, 구현 중 태어난
      DTO 클래스명(`ChatChannelBotIdentityDto`)이 **기존 동명 클래스와 충돌**하는 것을 못 봤다.
      `@nestjs/swagger` 는 스키마를 클래스 `.name` 으로 등재하므로 동명 둘은 서로를 덮어쓴다.
      > **싼 처방이 있다**: `*.dto.ts` 의 `export class` 이름 중복을 세는 전수 스캔은 256개 대상에
      > 1초가 안 걸린다(이번 턴에 스크립트로 돌려 잔여 0 확인). 이 형태는 **정적으로 판정
      > 가능**하므로 harness 테스트나 lint 룰로 고정할 수 있다 — 산문 규율로 두면 다음에 또
      > 사후 리뷰가 잡는다.
      >
      > **✅ 2026-09-12 같은 PR 에서 처방까지 넣었다** (`/ai-review` `17_02_19` testing WARNING 이
      > *"1회성 grep 에만 의존한다"* 고 다시 지적). `repo-guards/__tests__/dto-class-name-collision`
      > — `modules/`·`common/` 의 `*.dto.ts` 114개를 **AST 로** 훑어 `export class` 중복을 센다.
      > 베이스라인 **0건**이라 동결 목록 없이 빈 배열과 대조한다. 라운드 1 의 CRITICAL 을 그대로
      > 되돌리는 뮤테이션으로 **RED** 확인.
      >
      > **가드 자신이 첫 판본에서 자기 fixture 를 잡고 죽었다** — `src` 전체를 훑은 탓이다.
      > 형제 가드가 *"fixture 는 스캔 범위 밖에 둔다"* 고 적어 둔 이유를 몸으로 확인했고,
      > 스캔 루트를 실측(`*.dto.ts` 는 `modules/` 111 · `common/` 3)으로 좁혔다.

- [x] **`swagger.md §5-1` 에 "DTO 클래스명은 저장소 전체에서 유일하다" 규칙이 없다 — 코드가
      먼저 강제하고 있다** (planner, 2026-09-12 등재 · `--impl-done`
      `review/consistency/2026/09/12/18_08_30` WARNING 2).
      `chat-channel-rules-cleanup` 이 그 불변식을 **build-blocking 가드**로 세웠는데
      (`repo-guards/__tests__/dto-class-name-collision{,-guard}.ts`), 규약 본문에는 프로즈가 없다.
      §5-1 의 기존 *"이름 충돌을 피합니다"* 문단은 **`*.literal.ts` 상수 한정**이라 이 규칙을
      덮지 않는다(checker 실측).
      처분: (a) §5-1 에 규칙 한 문단 + **왜**(`@nestjs/swagger` 가 스키마를 클래스 `.name` 으로
      등재해 동명 둘이 서로를 덮어쓴다) (b) frontmatter `code:` 에 신규 가드 2파일 등재 —
      지금은 **어느 spec 도 그 가드를 자기 것으로 보지 않는다**.
      > **가드가 규약보다 먼저 있는 상태는 위험하다** — 다음 사람이 가드를 "누가 왜 넣었는지
      > 모르는 검사" 로 보고 지울 수 있다. 이 저장소가 `#244` 에서 겪은 *"문서화됐는데 미구현"*
      > 의 거울상이다.

      > **✅ 2026-09-12 해소** — `spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO). §5-1 에 규칙 + **왜**(클래스 `.name` 등재)를
      > 적고, frontmatter `code:` 에 가드 2파일 + 대조군 fixture 를 등재했다.
- [x] **`R-CC-23` 이 *"구현 정정은 developer 후속이다"* 를 현재형으로 남기고 있었다** (planner,
      2026-09-12 등재 · **같은 턴 해소**). `e4e259530`(#1324)이 그 구현을 끝냈는데 Rationale 은
      미래형이라, 다음 사람이 **이미 끝난 작업을 쫓을** 자리였다.
      > 이 항목은 트래커에 없던 **draft 고유 발견**이다 — 등재와 해소를 같은 줄에 적는다(등재만
      > 하고 미체크로 남기면 `#1326` 에서 겪은 *"태어날 때 이미 반증된 항목"* 이 된다).
      > 취소선으로 원문을 남기고 완료 커밋을 병기했다(자기-반증형 소정정의 4번 조건과 같은 형식).

- [ ] **frontend 가 `botIdentity` 의 provider 부가 필드를 아직 안 읽는다** (developer,
      2026-09-12 등재 · `/ai-review` `review/code/2026/09/12/17_52_34` user_guide_sync INFO).
      backend 는 이 PR 로 Slack `teamId` · Discord `publicKey` 를 **응답 계약으로 명문화**했는데
      (`ChatChannelRotateBotIdentityDto`), 소비 계층(`lib/api/triggers.ts` ·
      `chat-channel-card.tsx` · `dict/{ko,en}/triggers.ts`)은 두 필드를 모른다.
      **wire 포맷 자체는 이전부터 실려 있었다**(스프레드 반환) — 즉 이 PR 이 만든 갭이 아니라
      **드러낸** 갭이다. 표시할지 말지는 UX 판단이므로 등재만 한다.

- [x] **유저 가이드 MDX 4곳이 rotate-bot-token 404 를 `TRIGGER_NOT_FOUND` 로 적는다 —
      실제 코드는 `RESOURCE_NOT_FOUND`** (developer, 2026-09-12 등재 · `/ai-review`
      `review/code/2026/09/12/17_39_51` user_guide_sync INFO). 2026-05-23 `#282` 에서 유입된
      **4개월 선재 결함**이라 이번 PR 과 무관하다(그 diff 는 해당 MDX 를 안 건드린다).
      대상: `content/docs/06-integrations-and-config/telegram{,.en}.mdx` ·
      `02-nodes/triggers{,.en}.mdx`. 고치기 전에 **다른 엔드포인트에도 같은 오기가 있는지**
      전수로 셀 것 — 네 곳만 고치면 같은 클래스가 남는다.
      > **해소** — `#1328`. 전수로 세니 **네 곳이 아니라
      > 여섯 곳**이었다: MDX 4곳 + `backend-labels.ts` 의 `ERROR_KO` 주석 블록 +
      > `backend-labels.test.ts` 의 `LOCALIZED_ERROR_CODES` 주석. 뒤 둘은 **코드**에 있는
      > 같은 오귀속이라 트래커가 몰랐다 — 그리고 같은 테스트 파일 아래쪽 주석은 처음부터
      > 맞게(*"hooks webhook inbound 경로"*) 적고 있어 한 파일이 자기를 반증하고 있었다.
      > 축 2(`NNN \`CODE\`` 29건 전수)에서 다른 오기는 나오지 않았다 —
      > `VALIDATION_ERROR` 16 · `BOT_TOKEN_INVALID` 6 · `CHAT_CHANNEL_SETUP_FAILED` 5 는
      > 전부 참. 축 1(UPPER_SNAKE 97토큰)이 **다른 클래스**를 드러내 위 두 항목으로 등재했다.

- [x] **`rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 가 없다** (developer, 2026-09-12 등재 ·
      `/ai-review` `16_17_57` api_contract INFO). 형제 rotate 계열(`rotateNotificationSecret` ·
      `revokePerTriggerToken`)은 `@Param('id', ParseUUIDPipe)` 인데 이 엔드포인트만 맨
      `@Param('id')` 다. 이 PR 이전부터 있던 상태라 스코프 밖으로 뒀다. 비-UUID 가 들어오면
      `findById` 가 DB 레벨에서 실패하는지 400 이 나가는지 **먼저 실측**할 것.
      > **해소** — `#1328`. 선실측 결과는 **500 마스킹**이다
      > (`uuid` 컬럼 → SQLSTATE 22P02 → `GlobalExceptionFilter` 의 세 분기 어디에도 안 걸림).
      > 즉 클라이언트 입력 오류가 서버 장애로 보이던 자리였고, 이제 400 `VALIDATION_ERROR` 다.
      > **한 자리를 고치는 대신 가드로 고정**했다(`param-uuid-pipe`) — AST 전수, 베이스라인 0,
      > 허용목록 없음. `--impl-prep` convention_compliance WARNING 이 *"같은 조항의 절반만
      > 겨냥한다"* 고 지적해 `@ApiParam({format:'uuid'})` 축을 함께 넣었고, 그 축 실측이 3건
      > (`rotateBotToken`·`switchWorkspace`·`simulateExecutionRunRedeliveryForTest`)이라
      > 파이프 축만 닫았으면 둘이 남았을 것이다. 셋째는 `@ApiExcludeEndpoint()` 라 목록이
      > 아니라 **구조로** 면제한다.

- [x] **유저 가이드가 존재하지 않는 에러 코드 5종을 이름으로 적는다** (developer, 2026-09-12
      등재 · 위 두 항목을 닫으며 돌린 **전수 스윕**이 발견). `content/docs/**` 의 UPPER_SNAKE
      토큰 97개 중 코드베이스 어디에도 없는 것이 17개인데, 그중 **에러 코드로 제시된** 것이
      다섯이다 — `LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND` (`06-integrations-and-config/
      models{,.en}.mdx` 의 `FieldTable`) · `INTEGRATION_ERROR`·`NODE_EXECUTION_FAILED`
      (`05-run-and-debug/run-results{,.en}.mdx` · `error-handling{,.en}.mdx` 의 예시 payload) ·
      `MAKESHOP_API_ERROR` (`02-nodes/integrations{,.en}.mdx` 의 error 포트 예시).
      나머지 12개는 대상이 아니다(프런트엔드 전용 3 · `_glossary.md` 플레이스홀더 6 ·
      Discord Gateway 어휘 `MESSAGE_CREATE` · 범주어 `SUB_WORKFLOW` · 환경변수 오기 1건은
      `#1328` 에서 해소).
      **둘은 없는 이름이 아니라 은퇴한 이름이다** — `spec/5-system/3-error-handling.md §1.4`
      가 *"구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드
      수준 envelope 에 더 이상 사용하지 않는다"* 고 이미 선언해 두었다(`--impl-prep`
      `19_34_19` rationale_continuity INFO#2 가 지목). 즉 가이드가 SoT 보다 낡았다.
      **LLM 쪽 둘은 오기가 아니라 *미구현*이다 — 내 첫 진단이 틀렸다.**
      `spec/5-system/7-llm-client.md:345` 가 *"미구현(Planned) — 세분화 에러 코드:
      `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404), `LLM_CONTEXT_EXCEEDED`(400) 는
      향후 클라이언트 계층에서 분기 예정이나 **현재는 `LLM_CONNECTION_ERROR` 로 수렴**한다"*
      라고 명시 등재하고 있다(`/ai-review` `20_26_58` requirement WARNING 이 지목).
      처음엔 `LLM_AUTH_ERROR` 를 `LLM_AUTH_FAILED` 의 근접 오기로 진단했는데, 그러면
      **고칠 방향이 정반대**가 된다 — 가이드의 잘못은 철자가 아니라 **미구현 기능을 이미
      나온 것처럼 서술한 것**이다. ~~처분은 "이름 치환" 이 아니라 *"수렴 코드
      (`LLM_CONNECTION_ERROR`)를 적고 세분화는 Planned 로 표시"* 다.~~
      나머지 셋(`INTEGRATION_ERROR`·`NODE_EXECUTION_FAILED`·`MAKESHOP_API_ERROR`)은
      *"노드 에러 포트가 일반 실패에 무엇을 싣는가"* 를 **실측해야** 대응 코드가 정해진다.
      추측으로 치환하면 오기를 다른 오기로 바꾸는 것이다.
      > **위 취소선: 그 처분이 내 실측에 반증됐다.** `LLM_CONNECTION_ERROR` 를 적는 것은
      > 오기를 **다른 오기로** 바꾸는 것이었다 — 이 표가 서술하는 `POST /api/model-configs/
      > :id/test` 는 **어떤 에러 코드도 내지 않는다**. `LlmService.testConnection` 은 HTTP 200
      > 에 `{ success:false, message }` 를 싣고, 그 `message` 는 `sanitize-error.util.ts` 가
      > 만든 **8갈래 고정 문장** 중 하나다. 표의 `type` 열(401/429/404)도 응답 상태가 아니라
      > **provider 원문을 패턴 매칭하는 입력**이었다. 즉 틀린 것은 코드 이름이 아니라 **주어**다.
      > `LLM_CONNECTION_ERROR` 는 실재하지만(실측 10건) 그것은 멀티턴 AI 실행 경로의 코드다.
      > 트래커가 이 처분을 쓸 때 근거로 삼은 `7-llm-client.md:345` 는 참이다 — 다만 그 문장이
      > 말하는 "클라이언트 계층" 이 이 엔드포인트가 아니었다. **등재 시점에 적어 둔
      > 선행조건("실측해야 대응 코드가 정해진다")이 자기 처분을 잡았다.**

      > **해소** — `#1330`. 다섯 중 **셋은 실재하는 코드였다**(실측: `LLM_RATE_LIMIT` 63건 ·
      > `LLM_CONNECTION_ERROR` 10 · `LLM_TIMEOUT` 9) — 결함은 "없는 이름" 이 아니라 **엉뚱한
      > 층에 붙인 귀속**이었다. 그래서 표를 고치는 게 아니라 **버렸다**: 사용자가 실제로 보는
      > 8갈래 문장으로 바꾸고, 코드가 사는 곳(워크플로우 실행)으로 링크를 걸었다.
      >
      > **등재 문구보다 범위가 넓었다.** 트래커는 6파일을 지목했는데 이 다섯 토큰이 실린
      > MDX 는 **9파일**이었다. 늘어난 셋(`discord`·`telegram`·`slack`)은 `LLM_TIMEOUT`·
      > `LLM_RATE_LIMIT` 를 **맞게** 적고 있어 비대상이다 — 넓다고 다 고치면 맞는 것을
      > 망가뜨린다. 후보마다 *"어느 층을 서술하나"* 를 물어 갈랐다.
      >
      > **§A 는 문서 결함이 아니라 런타임 결함이었다.** 서비스는 `error` 를, 선언 DTO 와
      > 프런트엔드는 `message` 를 써서 실패 사유가 **화면에 한 글자도 도달하지 않았다**
      > (토스트가 `"연결 실패: "` 로 비어 나갔다). 정본 검사기 `assertMatchesContract` 가
      > 이 클래스를 위해 존재하는데 **이 엔드포인트에 배선이 없어서** 안 잡혔다. 배선하니
      > 저장소의 검사기가 스스로 진단했다 — `error [undeclared]`.
      > 덤으로 두 자매 DTO 의 `latencyMs` 는 **생산자 0건**이라 OpenAPI 가 없는 필드를
      > 광고하고 있었고, 프런트엔드 테스트 하나는 그 **없는 필드를 픽스처로 지어내** 통과
      > 중이었다(가이드가 코드를 지어낸 것과 같은 병이다).
      >
      > **가드로 고정**(`guide-error-code-existence` — `#1331` 에서 `guide-identifier-*` 로
      > 리네임) — `user-guide-evidence.md` 의 가드
      > 가족에 합류, 3축(FieldTable `name` · `code:` 값 · 실패 문맥 산문), 베이스라인 0,
      > 허용목록 없음. **이 두 성질은 `#1331` 이 뒤집었다** — 문맥 게이팅이 이 가드를
      > 등재시킨 과거 결함(`MCP_INSECURE_URL_ALLOWED`)을 못 잡는다는 것이 실측됐고, 축은
      > 백틱 전수로, 허용목록은 4강제가 붙은 외부 어휘 목록으로 바뀌었다. 아래 서술은
      > `#1330` 시점의 기록이다. 문맥 신호를 좁게 잡은 첫 판은 chat-channel 의 `executionFailed*` 키
      > 표(6파일)를 통째로 놓쳤다(39종) — 실패 어휘를 넣어 66종, 부재는 그대로 0. 뮤테이션
      > 전 16건 중 RED 12 · GREEN 4 이고 생존 넷은 전부 사유가 기록돼 있다(선언-쪽 변경은
      > 런타임이 원리적으로 못 봄 · 의미 동등 no-op · 기준집합 축소/확대 2건은 기각 근거).

- [ ] **`3-error-handling.md §1` 카탈로그가 통합·LLM 코드 계열을 통째로 누락한다**
      (planner, 2026-09-13 등재 · `--impl-prep` `review/consistency/2026/09/13/01_15_40`
      cross_spec WARNING#1·#2). 카탈로그에 `CAFE24_*`·`MAKESHOP_*`·`OAUTH_*` 계열이 한 줄도
      없고, LLM 도메인 코드 둘(`LLM_CREDENTIALS_REQUIRED`·`LLM_MODEL_LIST_FAILED`)도 §1
      미등재다. **`#1330` 의 §C 결함이 정확히 이 사각지대에서 났다** — 가이드가
      `MAKESHOP_API_ERROR` 를 지어낼 때 대조할 카탈로그 행이 없었다.
      실재 목록은 `backend/src/nodes/integration/makeshop/` 전수로 11종
      (`MAKESHOP_404`·`422`·`4XX`·`5XX`·`AUTH_FAILED`·`RATE_LIMITED`·`TRANSPORT_FAILED`·
      `MISSING_FIELDS`·`UNKNOWN_OPERATION`·`INVALID_SHOP_UID`·`UNRESOLVED_PATH_PARAM`).
      > **같은 절을 겨냥하는 plan 이 셋이다 — 한 턴에 묶어라** (`--impl-done`
      > `review/consistency/2026/09/13/10_12_54` plan_coherence WARNING#3). 실측으로 확인한
      > 나머지 둘:
      > - `spec-update-node-cancellation-shutdown-classification.md:632` — `OAUTH_STATE_MISMATCH`
      >   (400) 를 **§1.2** 에 등재 + `data-flow/2-auth.md` 상호링크
      > - `keyset-cursor-uuid-validation.md:128` — Background Runs 4종
      >   (`INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND`)
      >   을 **§1** 에 등재. 같은 파일 `:130` 은 §1.6 각주와 §1.9 기준의 불일치도 지목한다
      >
      > 셋이 **서로를 모르고** 절 번호·서브섹션 위치를 제각각 제안하고 있다. 따로 처리하면
      > 카탈로그 구조가 세 번 갈린다 — planner 턴에서 §1 하위 구조를 한 번에 정해야 한다.

- [ ] **`testConnection` 실패 응답 shape 이 어느 spec 표에도 없다** (planner, 2026-09-13 등재 ·
      `--impl-prep` `01_15_40` — **5개 checker 전원이 짚었다**). 형제 `/api/integrations/:id/test`
      는 `2-navigation/4-integration.md §9.1` 에 `{success, code, message}` 로 실패 shape 이
      문서화돼 있는데 `7-llm-client.md` 는 성공 케이스만 적혀 있다.
      **앵커가 없으니 가이드가 지어냈다** — `#1330` 이 코드를 고쳤지만(HTTP 200
      `{ success:false, message }`, `message` 는 `sanitizeLlmErrorMessage` 의 8갈래 중 하나)
      spec 에 자리가 없으면 다음 사람이 같은 자리에서 또 지어낸다. 8갈래 문장 목록은
      `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` 가 SoT.
      > **함께 명문화할 것** (`--impl-done` `11_08_03` rationale_continuity INFO#2):
      > *"HTTP 200 결과 객체의 필드명은 에러 봉투(`{ error: { code, message } }`)와 겹치면
      > 안 된다"* 는 원칙이 지금 `llm.service.ts` 의 **JSDoc 한 곳에만** 산다. 이 PR 이
      > `error` → `message` 를 고른 근거가 그것인데, 규약으로 적혀 있지 않으면 다음 사람이
      > 같은 판단을 다시 해야 한다 — `7-llm-client.md` 또는 `2-api-convention.md` Rationale.
      >
      > 그리고 두 표에 실패 shape 을 적을 때 **형제와 다른 이유**를 병기할 것:
      > `/api/integrations/:id/test` 는 `code` 를 싣지만 이쪽은 **코드가 없다**(8갈래 문장뿐).
      > 같은 "테스트 엔드포인트" 인데 형태가 다른 것은 의도다.

- [ ] **`collectMatches(texts, rx, group)` 의 «정규식 ↔ 캡처그룹» 짝이 타입으로 강제되지
      않는다** (developer, 2026-09-13 등재 · `/ai-review`
      `review/code/2026/09/13/23_04_01` maintainability WARNING#1).
      `guide-identifier-scan.ts` 의 세 수집기가 그룹 번호를 **정수 리터럴**로 넘긴다
      (`QUOTED_LITERAL` 은 2, 나머지 둘은 1). 정규식의 그룹 순서가 바뀌면 컴파일 타임에 안
      잡히고 `undefined` 가 조용히 `Set` 에 섞인다.

      > **오늘 결함은 없다** — 세 짝 전부 실측 일치이고 한 자리는 주석으로 방어돼 있다.
      > 미래 축 추가 시의 위험이다.
      >
      > **두 라운드가 등급을 달리 매겼다**: 라운드 9 는 **INFO**(*"시급도 낮음"*), 라운드 10 은
      > **WARNING**. 같은 코드에 대한 판정이 갈리므로 한쪽 근거로 닫지 않고 등재한다 — 이
      > 저장소가 형제 항목(주석 비중)에서 이미 쓴 규칙이다.
      >
      > 처분안: (a) named capture group(`(?<token>…)`)으로 전환해 인덱스 결속 자체를 없앤다,
      > (b) 그룹 번호를 이름 있는 상수로 뽑아 grep 으로 짝을 확인 가능하게 한다.
      > **(a) 가 방법을 바꾸는 쪽**이고 이 저장소의 *"좁다고 지적받으면 넓히지 말고 방법을
      > 바꿔라"* 에 맞는다.

- [ ] **`user-guide-evidence.md §2.1` 관계표에 새 가드 **2건**이 빠져 있다** (planner,
      2026-09-13 등재 · `--impl-prep` `01_15_40` naming_collision WARNING#4·#5 ·
      **등재 범위 정정**: `/ai-review` `10_40_34` user_guide_sync WARNING#3 +
      `--impl-done` `10_41_13` convention_compliance WARNING#2). `#1330` 이 가드 **둘**을 그
      컨벤션의 가드 가족(`codebase/frontend/src/lib/docs/__tests__/`)에 넣었는데,
      **§2 는 "가드 3건" 이라고 세고 §2.1 관계표에도 행이 없다** → **3건 → 5건**.
      | 신규 가드 | 무엇을 보나 |
      |---|---|
      | `guide-identifier-existence.test.ts` | 가이드가 적은 **식별자**(에러 코드 + 환경변수)가 실재하는가 |
      | `guide-sanitized-message-parity.test.ts` | 가이드가 옮겨 적은 **실패 문장**이 `sanitize-error.util.ts` 와 글자까지 같은가 (양방향) |
      셋 다 방향은 같고(가이드 → 코드) 표면이 다르다 — 자매 `impl-anchor-existence` 는
      `<ImplAnchor>` 의 `symbol`, 위 둘은 각각 코드 토큰과 문장이다. 그 직교성이 관계표의 형식이다.
      **같은 파일의 frontmatter `code:` 목록도 갱신 대상이다** — 현재 7개 경로가 있고 신규
      3파일이 빠져 있다: `guide-identifier-scan.ts`(순수 스캐너) ·
      `guide-identifier-existence.test.ts` · `guide-sanitized-message-parity.test.ts`.
      > **파일명이 `#1331` 에서 바뀌었다** (`guide-error-code-*` → `guide-identifier-*`) —
      > 스코프가 에러 코드를 넘어 환경변수까지 넓어졌기 때문이다. 등재 시 새 이름을 쓸 것.
      > **함께 등재할 Rationale**: `#1330` 이 세운 *"허용목록 없음"* 원칙을 `#1331` 이
      > 실측으로 번복했다(문맥 게이팅은 이 가드를 만들게 한 과거 결함을 못 잡는다).
      > **번복은 두 번이다** (2026-09-13 보강 · `--impl-done`
      > `review/consistency/2026/09/13/20_34_48` rationale_continuity INFO#2 가 *"1번째만
      > 이름으로 지목됨"* 을 짚었다) — 1번째는 `GUIDE_EXTERNAL_VOCABULARY`(**존재** 축,
      > 제약 *"기준집합에 없을 것"*), 2번째는 `GUIDE_NON_EMITTED_VOCABULARY`(**발행** 축,
      > 제약 *"기준집합에 있을 것"*)다. **제약이 정반대라 합칠 수 없다** — Rationale 은 두
      > 목록을 한 항목으로 묶지 말고 *축이 둘이라서 예외 목록도 둘* 이라는 구조로 적어야
      > 한다. 그러지 않으면 다음 사람이 하나로 통합하려 들고, 그러면 예외 하나가 두 축의
      > 결함을 동시에 덮는다.
      > 그 근거가 지금 plan·코드 주석에만 있고 spec `## Rationale` 에는 없다 —
      > **표·frontmatter·Rationale 을 한 턴에** 처리해야 표가 두 번 미완결이 되지 않는다.
      > **등재를 두 번 좁게 썼다.** (1) 첫 판은 가드 하나만 적었는데 같은 PR 의 리뷰 라운드가
      > 둘째 가드를 낳았고 등재 문구는 스냅샷에 멈춰 있었다 — 양 게이트가 독립으로 짚었다.
      > (2) 고친 뒤에도 **산문 관계표(§2.1)만** 겨냥하고 같은 파일의 frontmatter 를 빠뜨렸다
      > (`--impl-done` `11_08_03` plan_coherence WARNING#3). 같은 문서 안에서도 "어디까지가
      > 이 등재의 대상인가" 를 두 번 좁게 잡은 것이다 — 이 저장소가 반복해 지적해 온 형태다.
      `spec/conventions/error-codes.md` 에는 **적지 않는다**: 그 문서가 소유 범위를
      *명명원칙/rename/historical-artifact* 로 스스로 못박았다(`--impl-prep` 판정).
      > **«어디에» 적을지가 아직 안 정해졌다 — 그것부터 결정해야 한다** (2026-09-13 추가 ·
      > `--impl-done` `review/consistency/2026/09/13/17_26_40` convention_compliance
      > WARNING#2). 이 문서는 스스로를 *"`<ImplAnchor>` 컴포넌트의 단일 진실"* 로 선언하는데
      > 신규 가드 둘은 **`<ImplAnchor>` 와 무관**하다(식별자 인용 · 실패 문장 대조). §2 표에
      > 행만 더하면 문서의 **자기 선언 스코프와 어긋난다** — 7라운드 동안 "미등재" 로만
      > 불렸지만 실제 막힌 지점은 *"등재할 자리가 없다"* 였다.
      >
      > planner 턴은 **둘 중 하나를 명시적으로 택해야 한다**:
      > (a) Overview 의 스코프 문구를 *"가이드 진실성 가드 가족"* 으로 넓힌다 — 표 하나에
      >     모이지만 `<ImplAnchor>` 전용이라는 문서의 정체성이 흐려진다.
      > (b) §2 와 구분된 새 절(예: §6)을 만든다 — 정체성은 지키지만 "가드 가족" 이 두 곳으로
      >     갈려 다음 가드가 어디로 갈지 다시 물어야 한다.
      >
      > **택일 자체를 Rationale 에 남길 것.** 고르지 않으면 다음 턴도 같은 자리에서 멈춘다.

- [ ] **소스 주석이 `review/**` 세션 경로를 저장소 전체 225회 인용하는데, 그 경로는 실제로
      삭제된 적이 있다** (planner — 규약 결정, 2026-09-13 등재 · `/ai-review`
      `review/code/2026/09/13/17_26_33` maintainability WARNING#3).
      리뷰어는 *"`review/**` 는 SoT 가 아니므로 정리·이관되면 죽은 링크가 된다"* 며 내 두
      파일의 15곳을 지적했다. **전제를 실측했더니 지적은 맞고 범위가 훨씬 넓었다:**

      | 실측 | 값 |
      |---|---|
      | 이력상 `review/**` 삭제·이동 | **3건** — 세션 디렉토리 통째 삭제(`f7c56bf0a`, 2026-05-30 `review/code/2026/03/30/16_42_13/`) · 세션 리네임(`4b1f899b7`) · `.gitignore` 삭제 |
      | `review/**` 를 인용하는 `codebase/` 소스 파일 | **75개** (내 두 파일 제외) |
      | 그 인용 총 건수 | **225회** |

      > **그래서 내 파일만 고치지 않았다.** `response-contract.ts`·`pg-error-fixtures.ts`
      > 같은 이 저장소의 모범 파일들이 전부 같은 관례를 쓴다. 15/240 만 다른 앵커로 바꾸면
      > **근거 없이 규약이 둘로 갈린다** — 이 저장소가 반복해 경계해 온 형태다. 규약 자체를
      > 정하는 일이므로 `project-planner` 몫이다.
      >
      > **대안도 각각 값을 치른다** — 커밋 SHA 는 새 staleness 축을 만들고(이 PR 이 라운드
      > 4 에서 같은 이유로 SHA 핀을 거절했다), PR 번호는 **push 전에 확정되지 않는다**
      > (라운드 6 에서 실제로 그 이유로 하나를 뺐다), `plan/` 경로는 완료 시
      > `in-progress/` → `complete/` 로 **이동해서 깨진다**. 즉 "더 안정적인 앵커"가
      > 자명하지 않다는 것이 이 항목의 핵심이고, 그래서 택일을 기록해야 한다.

- [ ] **`guide-identifier-scan.ts` 가 코드 84줄에 주석 260줄이다 (72%)** (developer,
      2026-09-13 등재 · `/ai-review` `review/code/2026/09/13/17_26_33` maintainability
      WARNING#2). 실측: **361줄 = 주석 260 · 코드 84 · 빈줄 17.** 리뷰어의 72% 와 일치한다.
      라운드 5~7 의 *"첫 판 → 지금"* 대조표가 라운드마다 쌓인 결과이고, 같은 내용이
      plan·RESOLUTION 에도 있어 **삼중화**다.

      > **지금 하지 않는 이유는 «의도된 트레이드오프» 가 아니다** — 그 판정은 라운드 7
      > 리뷰어의 INFO#9 이고 라운드 8 리뷰어는 반대로 봤다. 두 판정이 갈리는 항목을 한쪽
      > 근거로 닫지 않는다. 실제 이유는 둘이다:
      > (a) 이 파일을 **재작성하다 자기 주석을 지운 전력**이 있다(라운드 1
      >     documentation WARNING#3 — *"이 주석을 지우지 말 것"* 을 스스로 지웠다).
      >     260줄 재배치는 같은 사고의 표면이 가장 넓은 작업이다.
      > (b) 순수 산문 재배치인데 **리뷰 라운드를 하나 더 소비**한다.
      >
      > **착수 조건 — 지금은 참이 아닌 것을 명시한다.** 라운드 3~7 이 주석에 박은 결정들은
      > 이제 **대조군 테스트가 고정**하고 있다(`[설계] 하이픈 키…` · `[한계] compose 리스트…`
      > · `[경계] 스팬 안쪽…` 등). 즉 산문이 *유일한 운반체* 이던 시기는 끝났다. 다음에 이
      > 파일을 만질 때 **각 주석 문단마다 "이걸 고정하는 테스트가 있는가" 를 물어** 있으면
      > 한 줄 참조로 줄이고 없으면 남긴다. 그 전에 **옛 판본의 주석 절 목록을 뽑아 대조**할 것
      > (라운드 1 의 재발 방지 절차).
      >
      > **실측이 낡았다 — 그리고 낡힌 것은 이 항목을 등재한 배치 자신이다** (`--impl-done`
      > `review/consistency/2026/09/13/22_06_21` plan_coherence WARNING#3). 위 *361줄 =
      > 주석 260 · 코드 84 · 빈줄 17* 은 **라운드 3 시점**의 값이고, 같은 배치가 라운드
      > 4~9 로 그 파일을 계속 키웠는데 조건을 건 숫자는 한 번도 갱신하지 않았다.
      >
      > | 시점 | 총 | 주석 | 코드 | 빈줄 | 주석 비율 |
      > |---|---|---|---|---|---|
      > | 등재 시(라운드 3) | 361 | 260 | 84 | 17 | 72% |
      > | 라운드 8 checker 실측 | 601 | 418 | 156 | 27 | 70% |
      > | 라운드 8 커밋 시점 | **622** | **439** | **156** | **27** | **71%** |
      >
      > 코드는 84 → 156 (+72) 인데 주석이 260 → 439 (+179) 다. **비율은 거의 안 움직였고
      > 절대량이 1.7배**가 됐다 — 착수 조건을 «비율» 로 걸었으면 영영 발화하지 않았을
      > 것이다. 조건은 위 문단대로 «문단마다 고정 테스트가 있는가» 로 두고, 이 표는
      > 재개 시 대조용으로 남긴다.

- [ ] **`/api/integrations/:id/test` 의 MCP 전용 응답 필드 3종이 미선언 + 계약 검증자 미배선**
      (developer, 2026-09-13 등재 · `/ai-review` `review/code/2026/09/13/10_12_19`
      api_contract WARNING#3 의 잔여분). `#1330` 이 같은 DTO 에 `code?: string` 을 넣어 **가장
      넓은 미선언**(spec §9.1 이 이미 문서화하던 필드)을 닫았지만, `IntegrationTestResult` 의
      `capabilities`·`serverInfo`·`preview` 는 여전히 `TestConnectionResultDto` 선언 밖이다.
      셋은 `service_type='mcp'` 전용이고 타입이 무거워(`ServerCapabilities`·`ServerInfo`·
      `ConnectionPreview`) DTO 클래스를 새로 세워야 하므로 한 줄로 끝나지 않는다.
      > **한 번 틀린 숫자를 전재했다.** 리뷰 SUMMARY 의 *"26곳에서 반환"* 을 그대로 옮겨
      > 적었는데, 실측하니 그건 `integrations.service.ts` 안 `code:` **원시 grep 수**이고
      > **그중 22곳은 throw 되는 `HttpException` 의 code** — 이 DTO 와 다른 축이다.
      > 결과 객체(`success:false` 동반)에 싣는 자리는 그 파일에 **4곳**, 서비스가 1593행에서
      > 호출하는 MCP 테스터(`mcp-test-connection.service.ts`)에 **6곳**이다. 저장소 전체로 같은
      > 형태를 세면 27곳이지만 cafe24/makeshop 클라이언트 분이 이 엔드포인트까지 올라오는지는
      > 확인하지 않았다 — **그래서 숫자가 아니라 「무엇을 비교했는지」를 적는다.**
      **함께 할 일**: 이 엔드포인트에 `assertMatchesContract` 배선. `#1330` 이 자매
      `/api/model-configs/:id/test` 에서 겪은 대로 **배선이 없으면 이 불일치는 런타임으로도
      안 잡힌다** — 지금 남은 셋은 정적 grep 으로만 보인다.
      > **`meta?` 는 같은 라운드에 측정해 닫았다** — DTO 에만 있고 `IntegrationTestResult` 에는
      > 없다(이 DTO 의 소비 엔드포인트는 하나뿐이고 그 핸들러 반환 타입 전수 확인). 즉
      > `latencyMs` 와 같은 유령이라 **추가가 아니라 제거**가 답이었고 `#1330` 이 제거했다.
      > 남은 셋은 반대로 **생산자가 있는데 선언이 없는** 방향이다 — 두 방향이 한 DTO 에
      > 섞여 있었다.

- [ ] **가이드 에러 코드 가드가 한 방향만 본다 — "코드 → 가이드" 누락은 못 잡는다**
      (developer, 2026-09-13 등재 · `/ai-review` `review/code/2026/09/13/11_07_36`
      requirement WARNING#1). `guide-identifier-existence`(`#1330` 당시 `guide-error-code-*`) 는 *"가이드가 적은 코드가
      실재하는가"* 만 본다. 반대 방향(*"실재하는 코드가 가이드에 있는가"*)은 설계상 비대상이고,
      **그 사각지대가 같은 PR 안에서 즉시 발현했다** — 새로 만든 노드-종류별 표가 spec §1.4 대비
      5종을 빠뜨렸다(`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·`MAX_COLLECTION_RETRIES_EXCEEDED`·
      `SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE`). 앞의 둘은 SSRF 방어 코드다.
      누락 자체는 `#1330` 이 고쳤지만 **가드가 없으니 다음 편집에서 또 빠진다.**
      > 형태는 이미 있다 — 같은 PR 의 `guide-sanitized-message-parity.test.ts` 가 8갈래 문장을
      > **양방향**(표→SoT · SoT→표)으로 대조한다. 같은 패턴을 §1.4 카테고리 표에 적용하면 된다.
      > **선실측할 것**: SoT 가 소스가 아니라 **spec 마크다운 표**라 파싱 대상이 다르다. 그리고
      > 그 표는 코드 아닌 토큰(env 변수 2종 · `details.integrationCode` 하위값 3종 · 명시적
      > 미발행 `HTTP_TIMEOUT`)을 섞어 담고 있어 **그대로 미러링하면 오탐 6건**이다 — 실제로
      > 내 조잡한 정규식이 11종 차이를 냈고 리뷰어의 5종이 맞았다. 「어느 토큰이 대상인가」를
      > 먼저 정해야 한다.

- [ ] **선언은 있는데 결코 발행되지 않는 "유령 필드" 를 잡는 자동 가드가 없다**
      (developer, 2026-09-13 등재 · `/ai-review` `11_07_36` architecture WARNING#3).
      `assertMatchesContract` 는 *"선언에 없는 키가 나간다"* 방향만 본다. 거울상(선언은 있고
      생산자가 0건)은 **원리적으로** 못 보고 현재 방어는 수동 grep 뿐이다.
      **같은 PR 안에서 이 방향의 결함이 서로 다른 두 DTO 에 독립적으로 3건 났다** —
      `ModelTestConnectionResultDto.latencyMs` · `TestConnectionResultDto.latencyMs` ·
      `TestConnectionResultDto.meta`. 리뷰는 *"세 번째 재발 시 정적 스캐너 검토"* 라 했는데
      **이미 세 번째다**(한 PR 안에서).
      > 형태: DTO 선언 필드 vs 그 DTO 를 반환하는 서비스의 return 리터럴 키를 AST 로 대조.
      > `#1328` 의 `param-uuid-pipe` 가 같은 저장소에서 AST 가드의 선례다.
      > **선실측할 것**: "그 DTO 를 반환하는 서비스" 를 기계적으로 특정할 수 있는가.
      > `@ApiOkWrappedResponse(XxxDto)` ↔ 핸들러 반환 타입이 앵커가 될 수 있다 — 전수 확인 후 착수.

- [x] **가이드 에러 코드 가드가 "존재" 만 보고 "방출" 을 안 본다 — CRITICAL 을 통과시켰다**
      ✅ **2026-09-13 해소** — `error-code-emission-axis` 배치가 **발행 축**을 더했다.
      술어는 항목이 제안한 *"AST 로 방출 위치 특정"* 이 아니다 — **실측이 두 번 반증**해
      다른 곳에 착지했다:
      > (1) *"토큰만 담은 따옴표 리터럴 = 발행"* 은 `3-error-handling.md §1.4` 가 이미
      >     반증하고 있었다(*"소비자·분류기 쪽 어휘이지 발행 경로의 앵커가 아니다"*) —
      >     `MAX_ITERATIONS_EXCEEDED` 가 분류기 인용으로 통과한다. **AST 로도 못 푼다**:
      >     같은 §1.4 가 앵커 없는 7종을 정식 카탈로그 항목으로 인정한다.
      > (2) *"카탈로그 등재를 요구 조건으로"* 는 거짓 RED 25건을 낸다 — 인용된 에러 코드
      >     78종 중 28종 미등재이고 그중 25종이 **진짜 발행되는** 통합 코드다
      >     (항목 *"`3-error-handling.md §1` 카탈로그가 통합·LLM 코드 계열을 통째로
      >     누락한다"*).
      >
      > 착지한 술어는 **두 술어의 교집합**이다: *"소스에 **메시지 접두로만** 등장하고
      > 카탈로그에도 없으면 `GUIDE_NON_EMITTED_VOCABULARY` 에 사유와 함께 등록해야 한다."*
      > **카탈로그를 요구 조건이 아니라 «탈출구» 로 쓰는 것**이 핵심이고, 그래서 그 항목이
      > 미해소여도 거짓 RED 가 나지 않는다.
      >
      > 원 항목이 든 `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 **가이드 문장이 이미 정확**했다
      > (`#1330` 이 고쳤다) — 그래서 이 축의 대상은 *"방출 안 되는 토큰"* 이 아니라
      > **"방출 안 되는데 «등록 안 된» 토큰"** 이다. 그대로 술어를 삼았으면 정확한 문장에
      > 거짓 RED 가 났다.
      (developer, 2026-09-13 등재 · `--impl-done` `review/consistency/2026/09/13/11_33_51`
      naming_collision **CRITICAL**). `guide-identifier-existence`(리네임 전 `guide-error-code-*`) 의 술어는 *"backend 소스에
      UPPER_SNAKE 문자열로 존재하는가"* 다. `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 존재하지만
      **`throw new Error('MAKESHOP_UNRESOLVED_PATH_PARAM: …')` 의 메시지 접두**일 뿐이고, catch
      (`makeshop.handler.ts:359`)가 `err instanceof IntegrationError ? err.code :
      'INTEGRATION_CALL_FAILED'` 라 실제 `output.error.code` 는 공용 fallback 이다. 가드는
      통과시켰고 `#1330` 이 그 이름을 가이드에 적었다 — **가드가 막으라고 만든 바로 그 결함**.
      > **단순 좁히기는 답이 아니다 (실측함).** 술어를 *"통째로 따옴표에 싸인 리터럴 또는 enum
      > 키"* 로 좁히면 현재 인용 101종 중 **8종이 새로 RED** 인데 그중 6은 오탐이다 —
      > env 변수 4(`MCP_CALL_TIMEOUT_MS`·`MCP_MAX_RESPONSE_BYTES`·`SYSTEM_STATUS_*` 는
      > `process.env.X` 접근이라 리터럴이 아니다) · 외부 어휘 1(`ACTION_ROW`) · 그리고
      > **진짜 같은 클래스 2**(`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`).
      > 즉 좁히면 허용목록이 필요해지고, 그건 이 가드가 처음부터 피한 설계다.
      > **다른 축을 찾아야 한다** — 예: `IntegrationError(` 첫 인자 · `code:` 할당 · `ErrorCode`
      > enum 값처럼 **방출 위치**를 AST 로 특정하고, env 변수는 `process.env` 접근으로 배제.
      > `#1328` 의 `param-uuid-pipe` 가 같은 저장소의 AST 가드 선례다.

- [x] **`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 도 방출 코드가 아니다 (선재)**
      ✅ **2026-09-13 해소** — `(A) 문장 정정` 을 택했다(`logic{,.en}.mdx` KO/EN). 그리고
      같은 배치가 **가드로 고정**했다: `GUIDE_NON_EMITTED_VOCABULARY` 에 두 토큰을 등록해,
      누가 다시 *"이 코드로 실패해요"* 라고 쓰면 발행 축이 RED 를 낸다.
      **실측 근거**: `execution-engine.service.ts:8017` 이 `nodeExec.error = { message }` 로
      기록한다 — `code` 필드가 **아예 없다**. 가이드의 *"전용 에러 코드는 없어요"* 는 정확하다.
      (developer, 2026-09-13 등재 · 위 항목의 술어 프로브가 부수적으로 찾았다).
      `02-nodes/logic{,.mdx,.en.mdx}` 가 *"…로 실행 실패해요"* 라고 적는데, 실제로는
      `execution-engine.service.ts:7121·7125` 의 **메시지 접두**이고 `.code` 로 방출되지 않는다.
      `#908` 에서 들어온 **선재 문장**이라 `#1330` 스코프 밖이고, MakeShop 건과 달리 *"코드"* 라고
      명시하지 않아(*"…로 실패"*) 오독 여지가 더 좁다 — 그래서 등재만 한다.
      > 처분 시 선택지는 둘: (A) 문장을 *"메시지에 이 접두가 붙는다"* 로 정정, 또는
      > (B) 엔진이 전용 코드를 방출하도록(동작 변경 + spec). 같은 갈림이 MakeShop 건에도 있었고
      > `#1330` 은 (A)를 택했다 — 가이드는 *현재 동작*을 서술하는 문서이기 때문이다.

- [ ] **spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다 — 같은 저장소에 «맞게 적은» 선례가 있다**
      (planner, 2026-09-13 등재 · `--impl-done` `review/consistency/2026/09/13/19_23_31`
      cross_spec WARNING#1). 가이드(`logic{,.en}.mdx`)는 이 배치가 *"메시지 접두"* 로
      정정했는데, **spec 쪽 6파일이 여전히 코드처럼 서술**해 정면으로 어긋난다:

      | 파일 | 형태 |
      |---|---|
      | `spec/5-system/4-execution-engine.md:332-333` §3.0 | *"`CONTAINER_MISSING_EMIT` **에러로** 실행 실패"* — 가장 강함 |
      | `spec/3-workflow-editor/2-edge.md:202` §6.1 | 검증 결과를 코드로 |
      | `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 | 형제 `CONTAINER_INVALID_CHILD`·`CONTAINER_CYCLE` 도 동형 |
      | `spec/4-nodes/1-logic/0-common.md:83` | 괄호 안 코드 표기 |
      | `spec/4-nodes/1-logic/7-map.md:179-180` §6 | 표의 «코드» 열 |
      | `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 | 〃 |

      > **통일할 선례가 이미 있다** — `spec/4-nodes/1-logic/3-loop.md:189-191` 은 같은 표에서
      > **발행 문자열 전문**을 인용한다(`` `CONTAINER_MISSING_EMIT: Container "<label>" has no
      > body node wired to …` ``). 형태를 새로 발명할 필요가 없고 형제 문서에 맞추면 된다.
      >
      > **실측**: `execution-engine.service.ts:8017` 이 `nodeExec.error = { message }` —
      > `code` 필드가 없다. 즉 6파일의 서술이 틀렸고 `3-loop.md` 가 맞다.

- [ ] **`3-error-handling.md §1.4` 의 «앵커 없는 코드» 7종이 실제로는 메시지 접두다 — 카탈로그
      표기를 정할 것** (planner, 2026-09-13 등재 · `--impl-done`
      `review/consistency/2026/09/13/19_23_31` rationale_continuity WARNING#2).
      §1.4 는 `MAX_ITERATIONS_EXCEEDED`·`RECURSION_DEPTH_EXCEEDED`·`CYCLE_DETECTED` 등을
      *"앵커 없는 맨 문자열"* 이라 적으면서도 **정식 카탈로그 항목**으로 취급한다. 실측하면
      `CONTAINER_*` 와 **구조가 같다**:

      | 토큰 | 발행 형태 | 카탈로그 |
      |---|---|---|
      | `MAX_ITERATIONS_EXCEEDED` | `throw new Error('MAX_ITERATIONS_EXCEEDED: …')` (`loop-executor.ts:64·85`) | **등재** |
      | `CONTAINER_MISSING_EMIT` | `throw new Error(\`CONTAINER_MISSING_EMIT: …\`)` (`execution-engine.service.ts:7121·7125`) | 미등재 |

      > **차이는 코드가 아니라 카탈로그다.** 그래서 이 배치의 발행 축은 카탈로그를
      > **탈출구**로 쓴다 — 그래야 `MAX_ITERATIONS_EXCEEDED` 가 통과한다. 다만 *"왜 이 둘만
      > 밖인가"* 는 여전히 무기재다.
      >
      > **이 항목을 처분하면 `error-code-emission-axis` 의 가드 등록도 재검토 대상이다**
      > (역참조 · `--impl-done` `review/consistency/2026/09/13/21_41_25` plan_coherence
      > INFO#7). 그 배치의 forward-note 는 **그 plan 안에만** 있었는데 그 plan 은
      > `complete/` 로 봉인되므로, 결정이 내려질 이쪽에 역참조가 없으면 **유실된다**:
      > (a) 를 택해 `CONTAINER_*` 가 카탈로그에 들어오면 **카탈로그 탈출구가 그 둘을 구해**
      > `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건이 불필요해지고, 반대로 이 항목이 won't-do 로
      > 닫히면 **탈출구 분기 자체가 죽은 코드**가 되어 대응 테스트 3건과 함께 제거 대상이다.

      > **같은 절(`3-error-handling.md §1`)을 겨냥하는 plan 이 이미 셋 있고 «한 턴에 묶어라»
      > 합의가 이 문서 위쪽에 있다** — 이 항목이 **넷째**다 (2026-09-13 · `--impl-done`
      > `review/consistency/2026/09/13/21_19_52` plan_coherence WARNING#4).
      > 그 합의를 인용하지 않고 독립 택일로 등재하면 planner 가 §1 하위구조를 **네 번 따로**
      > 건드리게 된다. 집행 시 그 합의와 함께 볼 것.
      >
      > 택일: (a) `CONTAINER_*` 를 §1.4 에 backfill 해 형제와 나란히 둔다 —
      > 그러면 이 배치의 등록 항목 둘은 **불필요해지고 가드가 자동으로 통과시킨다**.
      > (b) §1.4 의 앵커-없는 행들에 *"메시지 접두"* 표기를 달아 «코드» 와 구분한다 —
      > 그러면 카탈로그가 정확해지는 대신 탈출구의 의미가 달라지므로 **가드도 함께 본다**.
      > **어느 쪽이든 이 배치의 가드를 건드리므로 처분 시 함께 판정할 것.**

- [ ] **`CAFE24_UNRESOLVED_PATH_PARAM` 도 같은 형태 — 다만 가이드가 아직 인용하지 않는다**
      (developer, 2026-09-13 등재 · `--impl-done` `11_33_51` 권고 #2).
      `cafe24.handler.ts:453` 이 makeshop 자매(`:435`)와 **동형**으로 일반 `Error` 에 접두만
      붙인다. `cafe24{,.en}.mdx` 는 이 이름을 인용하지 않아 오늘 가이드 결함은 **없다**(실측:
      `content/docs/` 전수 grep 0건). 두 handler 를 함께 고칠 때 같이 본다.

- [ ] **`/api/integrations/:id/test` 에 HTTP 와이어-레벨 계약 검증이 없다**
      (developer, 2026-09-13 등재 · `/ai-review` `review/code/2026/09/13/11_33_23`
      testing WARNING#2). `#1330` 이 자매 `/api/model-configs/:id/test` 에는 supertest 왕복
      (전역 `TransformInterceptor` 포함) 검증을 신설했지만 형제는 **서비스 레벨
      `assertMatchesContract` 뿐**이다 — 봉투를 만지는 인터셉터가 끼어도 못 본다.
      위 "MCP 전용 3종 미선언" 항목은 **서비스 레벨 축**이라 이 와이어 축을 덮지 않는다.

- [ ] **`4-cafe24.md §6`·`5-makeshop.md §6` 도메인 에러 코드 카탈로그가 `*_UNRESOLVED_PATH_PARAM`
      을 누락한다** (planner, 2026-09-13 등재 · `--impl-done`
      `review/consistency/2026/09/13/11_33_51` cross_spec WARNING#1, `12_01_01` 재확인).
      두 handler(`makeshop.handler.ts:435` · `cafe24.handler.ts:453`)가 이 이름을 쓰는데 각
      도메인 spec 의 §6 에러 코드 표에는 없다.
      > **다만 등재 전에 판정할 것이 있다** — `#1330` 이 실측했듯 이 이름은 **`.code` 로 방출되지
      > 않는다**(일반 `Error` 의 메시지 접두, catch 가 `INTEGRATION_CALL_FAILED` 로 수렴).
      > 그러니 §6 표에 **그냥 한 줄 더하면 거짓이 된다**. 선택지는 둘:
      > (A) *"메시지 접두이며 `code` 는 `INTEGRATION_CALL_FAILED`"* 를 명시해 등재, 또는
      > (B) handler 를 `IntegrationError` 로 바꿔 진짜 코드로 만든 뒤 등재(동작 변경).
      > 위 "CAFE24_UNRESOLVED_PATH_PARAM 도 같은 형태" 항목과 **한 턴에** 처리해야 한다 —
      > 따로 하면 spec 과 코드가 서로 다른 답을 갖는다.

- [x] **`PreviewTestResultDto` 도 `code` 를 미선언한다 — 같은 클래스의 세 번째 DTO**
      (developer, 2026-09-13 등재 · `/ai-review` `review/code/2026/09/13/12_00_32`
      api_contract WARNING#1 · **2026-09-19 해소** `plan/complete/integration-db-http-testers.md` — `code?: string` 선언 + preview
      실패 경로 두 곳(Database · HTTP)에 `assertMatchesContract(…, PreviewTestResultDto)`. 뮤턴트로 선언을 빼면 그 두 건이 RED.
      같은 PR 이 Database · HTTP 테스터를 붙여 `DB_*` · `HTTP_*` 코드가 preview 응답에 새로 실리게 됐으므로 이 자리가 처분 시점이었다). `#1330` 이 형제 `TestConnectionResultDto` 에 `code?: string` 을
      넣었는데, **같은 파일의 preview 쌍둥이**는 그대로다 — `dispatchTest`/`testEmailTransport`/
      `testMcpTransport` 가 `EMAIL_HOST_BLOCKED`·`EMAIL_CONNECT_FAILED`·`MCP_*` 를 싣고
      spec(`§9.1`·`§5.5`)도 그것을 전제한다.
      > **왜 이번 PR 에서 안 고쳤나**: `#1330` 은 `POST /api/integrations/:id/test`(저장된 통합)
      > 를 건드렸고 preview 는 **다른 엔드포인트**(`POST /api/integrations/preview-test`,
      > 미저장 자격증명)다. 같은 파일이지만 내 diff 가 닿은 자리가 아니라, 고치면 스코프가 또
      > 한 겹 넓어진다 — 라운드 5 를 **`codebase/**` 수정 0 으로 끝내는** 것이 정지 규칙이었다.
      > 처분은 한 줄(`code?: string` + JSDoc) + `previewTest()` 실패 케이스에
      > `assertMatchesContract` 배선으로, `#1330` 이 형제에 한 것과 동형이다.

- [ ] **MakeShop `<Callout>` 의 메시지 문구에 SoT 패리티 가드가 없다**
      (developer, 2026-09-13 등재 · `/ai-review` `12_00_32` testing WARNING#2).
      `#1330` 이 라운드 4 에 넣은 *"`MAKESHOP_UNRESOLVED_PATH_PARAM: operation '...' has
      unresolved path placeholder(s): ...`"* 는 `makeshop.handler.ts:436` 의 템플릿 리터럴을
      **손으로 옮긴 것**이고 대조 가드가 없다 — 같은 PR 이 LLM 8갈래 문장에는 정확히 이 위험을
      막는 `guide-sanitized-message-parity` 를 만들었으면서 MakeShop 쪽엔 적용하지 않았다.
      `guide-identifier-existence` 는 **토큰 존재**만 보므로 문구 drift 를 못 잡는다.
      > 형태는 이미 있다 — `guide-sanitized-message-parity` 의 "SoT 반환 리터럴 추출 후 양방향
      > 대조" 를 템플릿 접두로 일반화하면 된다. **선실측할 것**: 그 문구는 `${...}` 보간을
      > 포함하므로 8갈래 문장처럼 완전 일치로는 못 본다 — **접두까지만** 대조하는 축이 필요하다.

- [ ] **`cafe24-api-metadata.md §4` 가 노드 출력 envelope 정의처를 오인용한다**
      (**planner 항목** — developer 가 등재, 2026-09-13 · `--impl-prep`
      `review/consistency/2026/09/13/12_33_41` convention_compliance WARNING#4).
      §4 "용어 주의" 박스가 envelope 5필드 정의처를 **Principle 7** 로 적는데, 실제 정의는
      `node-output.md` 의 **Principle 0** 소유다(Principle 7 은 config echo 전용).
      인용한 필드 목록에 `status` 도 빠져 있다.
      > **재넘버링 탓이 아니다** — checker 가 `git log -S` 로 확인한 결과 2026-05-16 작성
      > 시점부터 오인용이다. 링크 무결성 가드는 평문 인용이라 못 잡는다.
      > `#1331` 과 **무관한 선재 결함**이고 `spec/**` 이라 developer 권한 밖이다.

- [ ] **`guide-identifier-scan.ts` 의 `lastIndex` 리셋 보일러플레이트가 4곳에 복제됐다**
      (developer, 2026-09-13 등재 · `/ai-review` `review/code/2026/09/13/16_04_15`
      maintainability WARNING#2). *"`rx.lastIndex = 0` → `while ((m = rx.exec(t)))` → 적재"*
      가 서로 다른 세 함수(`scanIdentifierCitations`·`collectSourceTokens`·
      `collectEnvDeclarations`)에 걸쳐 **4곳**에 있다.
      > **위험은 «리셋 누락» 이고 그것을 겨냥한 테스트가 없다** — `g` 플래그 정규식은
      > `lastIndex` 가 남아 있으면 **두 번째 호출부터 매치가 조용히 누락**된다. 한 파일 안에서
      > 네 번 손으로 반복하므로 새 축을 더할 때 다섯 번째를 빠뜨릴 표면이 계속 늘어난다.
      >
      > 처분안: `String.prototype.matchAll` 로 전환하거나 `collectMatches(texts, rx)` 공유
      > 헬퍼로 추출해 리셋을 **한 곳**으로 모은다. 이 폴더의 형제 가드들도 같은 패턴을 쓰므로
      > (`impl-anchor-parse.ts`·`spec-links.ts`) **폴더 공용 유틸**로 올리는 것이 자연스럽다 —
      > 다만 그건 이 가드 하나의 범위를 넘어 별 배치다.
      > **선실측할 것**: 공유 헬퍼로 옮긴 뒤 *"리셋을 지우면 RED"* 가 실제로 관측되는지.
      > 지금은 그 뮤턴트를 겨냥하는 테스트가 없어 리팩터의 성공 여부를 판정할 기준이 없다.

- [ ] **두 keyset 커서 디코더의 실패 계약이 다르다 — 무시 vs 400** (developer, 2026-09-12
      등재 · `keyset-cursor-uuid-validation.md §C`). `auth/login-history.service.ts` 는 잘못된
      커서를 **무시하고 1페이지**를 주고, `executions/background-runs/background-runs.service.ts`
      는 **400 `INVALID_CURSOR`** 를 던진다. 같은 개념에 두 계약이다.
      `keyset-cursor-uuid-validation` 은 각자의 계약을 **유지한 채** id 검증만 넣었다 —
      통일은 관측 가능한 동작 변경이라 제품 결정이 필요하기 때문이다. 어느 쪽으로 통일할지가
      이 항목이다. 두 코드 주석에 *"형제는 다르게 동작한다"* 를 남겨 두었다.

- [ ] **커서 인코딩 보일러플레이트가 테스트 5곳에 인라인 반복된다** (developer, 2026-09-13
      등재 · `/ai-review` `review/code/2026/09/13/00_36_16` maintainability WARNING#4).
      `background-runs.service.spec.ts` 3곳 · `background-monitoring.e2e-spec.ts` 2곳이
      `Buffer.from(JSON.stringify({s,i})).toString('base64')` 를 각자 적는다. 프로덕션에는
      `encodeCursor` 가 있지만 **private 클래스 메서드**라 테스트가 재사용할 수 없다.
      처분 제안: 테스트 헬퍼 `makeCursor(s, i)` 추출 — 순수 보일러플레이트라 위험 낮음.
      > 이번 배치에서 안 한 이유: 수렴 판정 기준(동작·커버리지·계약)에 안 걸리는 **보일러플레이트**
      > 이고, 고치면 `codebase/**` 가 낡아 14명을 다시 돌려야 한다.

- [ ] **`isUuidShaped` JSDoc 이 "기술 계약" 과 "감사 이력" 을 한 곳에 쌓는다** (developer,
      2026-09-13 등재 · 같은 세션 maintainability WARNING#5). 43줄인데 함수가 무엇을 보장하는지와
      날짜·리뷰 세션 폴더명·라운드 번호 인용이 섞여 있어, 계약만 알고 싶은 사람이 감사 기록을 먼저
      헤쳐야 한다. **라운드가 늘 때마다 이 문단이 계속 자라는 구조**다 —
      `#1328` 후속 배치만으로도 세 라운드 연속 문단이 붙었다.
      처분 제안: 계약만 JSDoc 에 남기고 정정·지적 이력은 plan 으로 옮겨 링크만.
      > **직전 라운드가 이 파일에 근거를 집약한 결과이기도 하다** — 주석 3중 복제를 닫으려고
      > 여기로 모았는데, 그 선택이 이 문제를 키웠다. 두 압력(복제 금지 ↔ JSDoc 비대)이 반대
      > 방향이라 어느 선에서 자를지는 한 번 정해서 적어 둘 가치가 있다.

- [ ] **두 커서 디코더에 같은 근거 주석이 복제됐다** (developer, 2026-09-12 등재 ·
      `/ai-review` `review/code/2026/09/12/23_19_03` maintainability INFO#1). `isUuidShaped` 를
      고른 이유 · 22P02→500 마스킹 메커니즘 · spec Rationale 인용 ~12줄이 양쪽에 거의 같이
      들어갔다. **검증 로직 자체는 공용 유틸 재사용이라 중복이 아니다** — 산문만 복제다.
      처분 제안: 상세 근거를 `common/utils/uuid.ts` 의 `isUuidShaped` JSDoc 한 곳으로 모으고
      호출부는 짧은 참조로 압축. 다만 그 함수는 **워크스페이스 헤더 축**으로 서술돼 있어
      커서 축을 함께 담을지가 판단 지점이다.
      > 이번 배치에서 안 한 이유: **주석-only** 라 수렴 판정 기준(동작·커버리지·계약)에 안
      > 걸리고, 고치면 `codebase/**` 가 낡아 리뷰를 한 바퀴 더 돌려야 한다.

- [ ] **두 keyset 커서 디코더가 손으로 각각 구현돼 있다** (developer, 2026-09-12 등재 ·
      같은 문서 §C). 인코딩이 달라(평문 `<iso>|<id>` vs base64 JSON) 단순 추출이 아니다.
      위 계약 통일 결정이 선행되면 함께 묶는 편이 싸다.

- [ ] **Background Runs REST 의 에러 코드 4종이 중앙 카탈로그에 없다** (**planner 항목** —
      developer 가 등재, 2026-09-12 · `/consistency-check --impl-prep`
      `review/consistency/2026/09/12/22_51_25` cross_spec·convention_compliance WARNING).
      `INVALID_CURSOR` · `INVALID_LIMIT` · `EXECUTION_NOT_FOUND` · `BACKGROUND_RUN_NOT_FOUND`
      가 `3-error-handling.md §1` 에 미등재다 — §1.5~§1.12 가 예외 없이 지켜 온 *"도메인 SoT +
      카탈로그 가시성 등재"* 관행에서 이 도메인만 빠졌다. 제안: §1.13 신설 +
      `4-nodes/1-logic/12-background.md §8.7` 을 SoT 로 역링크.

- [ ] **`2-api-convention.md §8.2` 가 cursor 페이지네이션을 단일 표준으로만 적는다**
      (**planner 항목** — developer 가 등재, 2026-09-12 · 같은 세션 cross_spec WARNING).
      §8.2 는 opaque base64 + 실패 시 400 `INVALID_CURSOR` 하나만 서술하는데 `login_history`
      는 평문 `<iso>|<id>` + 실패 시 무시다. **그 예외가 어디에도 없다.**
      > `keyset-cursor-uuid-validation` 이 두 계약을 통일 없이 각각 강화했으므로 이 비대칭은
      > 사실상 **고정**됐다(checker 의 표현). 위 "계약 통일" 항목과 **같이 결정**해야 한다 —
      > 통일하면 §8.2 가 그대로 맞고, 유지하면 §8.2 에 예외 각주가 필요하다.

- [ ] **`3-error-handling.md §1.6` 각주의 `EXECUTION_NOT_FOUND` 분류가 §1.9 기준과 어긋난다**
      (**planner 항목** — developer 가 등재, 2026-09-12 · 같은 세션 convention_compliance).
      각주는 *"§1.2~§1.3 표준 코드 재사용"* 이라 적는데, 같은 문서 §1.9 가 세운 기준
      (*제네릭 문자열 그대로 wire = 재사용 / 도메인 특화 wire 리터럴 = 직접 등재*)으로는
      **직접 등재** 쪽이다. 위 카탈로그 항목과 한 턴에 처리하면 비용이 낮다.

- [ ] **UUID 경로 파라미터의 두 축을 `@ApiUuidParam()` 합성 데코레이터로 묶는다** (developer,
      2026-09-12 등재 · `/ai-review` `review/code/2026/09/12/22_03_45` architecture WARNING,
      **non-blocking 제안**). 지금은 런타임 축(`ParseUUIDPipe`)과 문서 축
      (`@ApiParam({format:'uuid'})`)이 **독립 데코레이터 둘 + 사후 AST 가드**로만 짝지어진다 —
      *"빠뜨리면 테스트가 잡는다"* 구조이고, *"애초에 빠뜨릴 수 없다"* 보다 약하다.
      저장소에 `common/swagger` 합성 데코레이터 선례가 있다(`@ApiOkWrappedResponse` 등).
      > **가드를 대체하는 것이 아니라 줄이는 것이다.** 합성 데코레이터가 생겨도 `@Param` 을
      > 맨손으로 쓰는 길은 남으므로 `param-uuid-pipe` 가드는 유지해야 한다 — 다만 감시 표면이
      > "두 축을 각각" 에서 "합성을 썼는가" 로 좁아진다. 착수 시 기존 136곳의 이행 비용을
      > 먼저 재는 것이 선행이다.

- [ ] **`param-uuid-pipe` 잔여 산문 2건** (developer, 2026-09-12 등재 · 같은 세션 INFO
      #10·#12, **동작·커버리지·계약 무관**). (a) HTTP 왕복 describe 의 제목이 통합테스트처럼
      읽히는데 실제로는 인증·인가 체인을 태우지 않는다 — *"인증·인가는 이 스위트 범위 밖"*
      한 줄이 빠져 있다. (b) `param-uuid-pipe.spec.ts` 의 `--impl-prep` 인용이 게이트명만
      적고 세션 경로(`review/consistency/2026/09/12/19_34_19`)가 없어 같은 파일 다른 인용과
      형태가 다르다.
      > **이번 배치에서 안 고친 이유는 게이트다.** 리뷰가 수렴 선언된 뒤 `codebase/**` 를
      > 만지면 push 게이트의 freshness 가 뒤집혀 리뷰를 한 바퀴 더 돌려야 한다
      > (`newest_code` 는 `codebase/**` 만 센다). 산문 두 줄에 14명을 다시 돌리는 것이
      > 이 항목을 미루는 것보다 비싸다.

- [x] ~~**`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다 — 파이프 밖 유입 경로는
      여전히 500 마스킹** (developer, 2026-09-12 등재 · `/ai-review`
      `review/code/2026/09/12/21_20_01` architecture WARNING). `#1328`
      은 `@Param()` 축을 파이프 + 전수 가드로 닫았지만, **필터 자체는 그대로다** —
      `HttpException` · http-error-like · unique-violation(23505) 세 분기뿐이라
      `@Query()` · body 필드 조회 등 다른 경로로 비-UUID 가 들어가면 같은 500 마스킹이 난다.
      즉 지금 방어는 **호출부마다 반복 배치**된 형태이고 공유 seam 이 비어 있다.
      처분 제안: 필터에 `invalid_text_representation`(22P02) → `400 VALIDATION_ERROR` 분기.~~
      > **이 배치에서 안 한 이유**: 그 한 줄은 **저장소의 모든 엔드포인트**의 실패 분류를
      > 바꾼다 — 지금 22P02 로 500 을 받는 자리가 어디이고 그중 400 이 맞지 않은 곳이 있는지를
      > 먼저 세야 한다(예: 사용자 입력이 아닌 내부 조회 실패). 착수 전 그 전수가 선행 조건이다.
      > 파이프·가드는 이 필터가 생겨도 유지한다 — fail-fast 가 더 앞이다.
      >
      > **종결 — won't-do (2026-09-12, `keyset-cursor-uuid-validation.md §A`).** 선행 조건으로
      > 걸어 둔 그 전수를 실제로 세니 **처방이 틀렸다**:
      >
      > 1. `3-error-handling.md §1` 이 이미 반례를 적어 두었다 — *"**JWT 클레임은 검증하지
      >    않는다** — 서버가 서명한 값이라 거기서 400 을 내면 **서버 버그를 클라이언트 오류로
      >    보고**하게 된다."* 필터는 값의 **출처를 모르므로** 일괄 400 은 이 원칙을 어긴다.
      >    같은 축의 정식 Rationale: `spec/data-flow/12-workspace.md §"UUID 검증 강도 비대칭"`.
      > 2. 필터의 기존 분기가 이미 그 구분을 한다 — 23505(클라이언트 경합) → 409,
      >    **23502(앱이 만든 잘못된 row) → 500 유지**(캐너리 2개가 고정 중). 22P02 는 출처에
      >    따라 양쪽 다 될 수 있다.
      > 3. **신호가 사라진다.** 이 항목을 파고들어 진짜 결함 2건을 찾은 실마리가 정확히
      >    *"22P02 가 500 으로 뜬다"* 였다. 500 은 *"어느 입구가 검증을 빠뜨렸다"* 는 알람이고,
      >    조용한 400 으로 바꾸면 다음 입구 누락은 아무도 모른다.
      > 4. 유일한 반례 후보(사용자가 SQL 을 쓰는 **DB Query 노드**)는 `mapDbError` 로 자체
      >    catch 해 error 포트로 가므로 **필터에 도달하지 않는다** — 반례가 아니다.
      >
      > 저장소의 전략은 **입구마다 조기 거부**이고(`workspace-context.util.ts` 가 선례),
      > 필터의 500 은 그 전략의 **미이행 알람**이다. 그래서 필터 대신 **입구**를 고쳤다 —
      > 커서 2곳(`#-` keyset-cursor-uuid-validation). 다음 사람이 같은 제안을 다시 하지 않도록
      > 근거를 남긴다.

- [x] **가이드가 적는 식별자(에러 코드·환경변수)가 실재하는지 세는 가드가 없다** (developer,
      2026-09-12 등재 · `/ai-review` `review/code/2026/09/12/20_53_01` testing WARNING).
      `#1328` 은 **두 결함 클래스**를 같은 배치에서 고쳤는데 가드는
      한쪽만 얻었다 — `ParseUUIDPipe` 누락은 AST 전수 가드(`param-uuid-pipe`)로 고정됐지만,
      **가이드·`backend-labels.ts` 의 잘못된 식별자**(`TRIGGER_NOT_FOUND` 6곳 ·
      `MCP_INSECURE_URL_ALLOWED` 2곳)는 **1회성 정규식 스윕**으로 손으로 고쳤을 뿐이다.
      그 스윕 스크립트는 커밋되지 않으므로 다음 사람은 같은 발견을 같은 방식으로 다시 해야 한다.
      게다가 이 클래스는 **4개월간 아무도 몰랐다** — 재발 위험의 근거가 그것이다.
      처분 제안: `content/docs/**` 의 UPPER_SNAKE 토큰이 backend 소스에 실재하는지 세는 경량
      가드. **비대상이 많다는 것이 설계의 핵심**이다(실측 97토큰 중 부재 17, 그중 진짜 결함은
      2클래스뿐 — 나머지는 프런트 전용 3 · 문서 플레이스홀더 6 · 외부 어휘 1 · 범주어 1).
      ~~허용목록으로 덮으면 은폐가 되므로, **판정 축을 "에러 코드/환경변수 문맥에 놓인 토큰"**
      으로 좁히는 쪽이 맞다(백틱만 보면 안 된다 — 이번에 따옴표 형태를 놓쳤다).~~
      > **위 취소선: 이 처분 제안이 실측에 반증됐다.** `#1330` 이 정확히 그 제안대로
      > 문맥으로 좁혔고(허용목록 없이 오탐 0 달성), 그 결과 **이 항목을 등재시킨 바로 그
      > 과거 결함을 못 잡게 됐다** — `MCP_INSECURE_URL_ALLOWED` 는 `<FieldTable>` 의
      > `description` 안에 있고 그 줄에 실패 어휘가 없어 세 축 전부 미포착이다(실측).
      >
      > *"백틱만 보면 안 된다"* 도 절반만 맞았다 — 따옴표 형태(축 1·2)는 **함께** 봐야 하는
      > 것이지 백틱 대신 보는 것이 아니었다. `#1331` 은 셋을 모두 본다.
      >
      > 은폐 우려는 타당하지만, 대가가 **결함 클래스 전체**였다. 허용목록을 없애는 대신
      > **깨뜨리기 어렵게** 만들었다 — 외부 시스템 이름 의무 · 상한 · 여전히 인용될 것 ·
      > 기준집합에 없을 것. 넷 다 뮤턴트로 확인했고 은폐 시도 2종(실재 식별자 넣기 · 죽은
      > 항목 쌓기)이 각각 RED 다.

      > **해소** — `#1331`. `guide-identifier-existence`(리네임 전 `guide-error-code-*`)가
      > 에러 코드 + 환경변수 두 축을 모두 덮는다. 기준집합 = 소스 토큰 ∪ env 선언처.
      > 과거 결함 재현 테스트가 *"오기를 잡는다 / 정정된 이름은 통과한다 / `#1330` 술어였다면
      > 놓쳤다"* 세 갈래로 고정돼 있다.
      >
      > **env 선언처 병합은 오늘 판정을 지탱하지 않는다**(뮤턴트가 내 예측을 반증했다) —
      > 인용된 env 변수 8종이 전부 소스에도 있고, env-only 21종 중 인용은 0종이다. 내일의
      > 오탐을 막으려 남겼고 그 전환 시점을 단언으로 고정했다.

- [ ] **`15-chat-channel.md` §5.4 실패 응답 표에 `rotate-bot-token` 의 신규 400 행이 없다**
      (**planner 항목** — developer 가 등재, 2026-09-12 · `/ai-review` `20_26_58`
      requirement WARNING). 이 표는 CCH-SE-04 가 낼 수 있는 `error.code` 를 나열하는
      canonical 문서인데, `#1328` 이 `ParseUUIDPipe` 를 붙이면서
      **관측 가능한 새 분기**(`:id` 가 UUID 형식이 아님 → `400 VALIDATION_ERROR`)가 생겼다.
      컨트롤러의 `@ApiBadRequestResponse` 와 CHANGELOG 에는 반영했으나 spec 표는 못 건드린다
      (자기-반증형 소정정 **조건 1** 미충족 — 내가 쓴 문장이 아니다).
      처분 제안: 표에 `400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행 추가.
      > **같은 턴에 볼 것 (`--impl-done` `review/consistency/2026/09/12/22_14_31`
      > plan_coherence INFO)**: `15-chat-channel.md` frontmatter 의 `pending_plans:` 에 이
      > 트래커가 cross-reference 돼 있지 않다(지금은 chat-channel 전용 plan 3개뿐).
      > 다만 그 필드가 *"구현은 끝났고 문서만 지연"* 인 경우까지 대상으로 하는지는 문면이
      > 모호해 checker 도 **판단을 planner 에게 넘겼다** — 등재 여부를 함께 결정할 것.
      > 위 `swagger.md §5-4` 항목과 **같은 실측(`param-uuid-pipe` 가드)에서 나왔으므로
      > 한 턴에 닫는 편이 싸다**(리뷰 권고).

- [ ] **`swagger.md §5-4` 체크리스트가 UUID 경로 파라미터의 **런타임 축**을 안 적는다**
      (**planner 항목** — developer 가 등재, 2026-09-12 · `/ai-review`
      `review/code/2026/09/12/20_01_18` requirement·documentation 공통 SPEC-DRIFT WARNING).
      §5-4 는 `@ApiParam({ format: 'uuid' })` **문서 축 한 줄**만 요구하고
      `ParseUUIDPipe` 는 그 문서 전체에 **0건**이다(실측). §2-3 예시 코드도 파이프 없이
      쓰여 있다. 그런데 저장소 실측은 id-형 `@Param` **136/136** 이 파이프를 갖고 있고
      (`#1328` 이 마지막 1건을 채웠다), 그 관례를 가드
      (`repo-guards/__tests__/param-uuid-pipe`)가 베이스라인 0 으로 강제한다.
      즉 **가드가 규약보다 넓게 문다.**
      처분 제안: §5-4 체크리스트에 `@Param('<id>', ParseUUIDPipe)` 항목 추가 + §2-3 예시에
      반영. 근거는 위 실측과 22P02 마스킹 사슬(`common/utils/uuid.ts`).
      > **왜 developer 턴에서 안 고쳤나.** `ESCALATE=spec` 는 *"구현이 spec 을 의도적으로
      > 개선해 spec 이 낡은"* 경우의 역류 경로이고, 자기-반증형 소정정은 **조건 1**(그 문장을
      > developer 자신이 썼다)을 요구한다. 여기는 둘 다 아니다 — §5-4 는 내가 쓴 문장이
      > 아니고, 드리프트도 이 PR 이 만든 것이 아니라 **이전부터 있던 규약 공백**이다.
      > 조건이 깨지면 예외가 아니라 **분리**다. 대신 이 배치는 *내가 쓴 쪽*을 고쳤다 —
      > 가드·spec 주석 2곳이 *"§5-4 의 한 조항이 두 축을 요구한다"* 고 적고 있었는데,
      > *"런타임 축은 실측 관례를 가드로 승격한 것"* 으로 출처를 갈랐다.

- [ ] **`ERROR_KO` 의 API 에러 코드 매핑을 **아무도 읽지 않는다**** (developer, 2026-09-12
      등재 · 같은 스윕). 처음엔 *"일반 API 코드(`RESOURCE_NOT_FOUND` 등)가 맵에 없어 ko 화면에
      영문이 뜬다"* 로 등재하려 했는데, 그 전제가 **실측에 반증됐다** — 더 큰 결함이 그 아래
      있었다.
      | 축 | 실측 |
      |---|---|
      | `ERROR_KO` 의 chat-channel 코드 7종 | 존재 |
      | 일반 API 코드 5종(`RESOURCE_NOT_FOUND`·`AUTH_REQUIRED`·`FORBIDDEN`·`VALIDATION_ERROR`·`RESOURCE_CONFLICT`) | 전부 부재 |
      | `ERROR_KO` 를 읽는 유일한 함수 `translateBackendError` 의 **프로덕션 호출부** | **0건** (정의 + 자기 테스트뿐. 형제 `translateGraphWarning`·`translateBackendHint`·`translateBackendWarning` 은 배선돼 있다) |
      | 봇 토큰 회전 실패 시 화면에 뜨는 것 | `chat-channel-card.tsx` `onError` 가 에러를 **버리고** 고정 문자열 `rotateBotTokenFailed`("Bot Token 회전에 실패했어요") |
      즉 코드가 화면에 **아예 안 나온다** — 한국어도 영어도 아니다. 그래서 맵에 줄을 더하는
      것은 아무것도 바꾸지 않는다. 결정해야 할 것은 *"에러 코드를 UI 에 노출할 것인가,
      노출한다면 `translateBackendError` 를 어디에 배선할 것인가"* 다.
      > `#1328` 은 이 갭을 **고치지 않고 문면만 진실로 맞췄다** —
      > `02-nodes/triggers{,.en}.mdx` 의 *"한국어 화면에서는 모두 한국어 안내 메시지로
      > 표시돼요"* 는 8종 전부에 대해 거짓이었다. 지금은 *"API 를 직접 호출할 때 보이는 값"*
      > 이라고 적는다. 문서가 구현보다 넓게 말하는 것을 좁힌 것이지 기능을 넣은 것이 아니다.

- [x] **`15-chat-channel.md` 의 `code:` glob 이 `dto/responses/` 를 못 잡는다** (planner,
      2026-09-12 등재). glob `.../triggers/dto/chat-channel-*.dto.ts` 의 `*` 는 `/` 를 넘지 않아
      **`dto/responses/` 하위가 시야 밖**이다(정본 매처 실측). 그런데 `swagger.md §5-1` 은 응답
      DTO 의 자리를 `dto/responses/*-response.dto.ts` 로 **정식 규약**으로 못박는다.
      처분: glob 을 **`dto/**/chat-channel-*.dto.ts`** 로 넓힌다.
      > **내가 이 판단을 한 번 뒤집었다.** 처음엔 glob 에 맞추려고 응답 DTO 를 평평한 `dto/` 에
      > 두었는데(`chat-channel-rotate-bot-token.dto.ts`), `/ai-review` `16_39_18` requirement
      > WARNING 이 규약 위반을 지적했다. **규약이 자리를 정하고 glob 은 그 자리를 덮도록 고치는
      > 도구**다 — 반대로 하면 다음 응답 DTO 도 같은 선택을 한다. 파일은
      > `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 로 옮겼다.
      >
      > **지금 spec-link 판정이 깨진 상태는 아니다** — `2-trigger-list.md` 의 `dto/**` 가 그 자리를
      > 덮는다. 남은 것은 *"chat-channel spec 이 자기 파일을 보는가"* 한 축이다.

      > **✅ 2026-09-12 해소** — `spec-draft-chat-channel-doc-batch` (`--spec` `review/consistency/2026/09/12/18_55_57` BLOCK: NO). glob 을 `dto/**/chat-channel-*.dto.ts` 로
      > 넓혔고, `R-CC-22` 의 정량 진술을 **재측정해 캐비엇**으로 달았다(좁은 glob 10→11 ·
      > 통짜 27→28). 과잉 포획 0 확인(`dto/create-trigger.dto.ts` 미매칭).
- [ ] **리뷰 in-flight 중에 같은 워크트리에서 뮤테이션을 돌리지 않는다** (프로세스,
      2026-09-11 등재 · `/ai-review` `review/code/2026/09/11/16_16_44` 관측). 그 라운드에서
      reviewer **8명 이상**이 *"자신이 만들지 않은 일시적 뮤테이션"*(정규식 스왑 등)을 공유
      워킹트리에서 관측했다 — **내가 검증용 뮤테이션을 리뷰와 겹쳐 돌린 결과**다.
      이번엔 전원이 복원 명령 없이 관측만 했고 판정도 커밋 상태 기준이라 영향이 없었지만,
      **reviewer 가 유령을 쫓을 수 있다**(기존 교훈: 병렬 리뷰어가 서로를 오염시킨 사고).
      처방 후보: 뮤테이션을 별 워크트리에서 돌리거나, 리뷰 완료 후로 순서를 고정.

      > **2026-09-12 — 방향이 하나 더 있다. `reviewer` 도 같은 트리를 뮤테이션한다.**
      > `review/code/2026/09/12/16_39_18` 요약의 §관측된 이상 상태가 미커밋 뮤테이션을
      > 보고했는데, **내 뮤테이션은 그 라운드 준비(16:39:18)보다 앞선 16:26 에 끝나고 원복까지
      > assert 했다.** 같은 요약이 `testing` reviewer 가 **자기 검증으로 동일 뮤테이션을
      > 재현·원복**했다고 적는다 — 즉 이 항목의 처방은 *"내가 안 돌린다"* 로는 부족하고,
      > **reviewer 프롬프트가 scratch 사본을 쓰게** 하는 쪽이어야 한다.
      > (요약이 그 잔여물을 "실결함으로 오인하지 말 것" 으로 처리한 것은 올바른 대응이다.)
      > **2026-09-11 재발(2회).** `impl-chat-channel-binder-t2` 의 `/ai-review`
      > `review/code/2026/09/11/18_04_36` 에서 또 관측돼, 처방을 **"뮤테이션은 리뷰 완료
      > 후에만"** (= 내 규율)으로 적었다.
      >
      > **그 처방이 다음 라운드에 곧바로 반증됐다 (3회).** `18_42_05` 에서 나는 뮤테이션을
      > **한 번도 안 돌렸는데** reviewer 둘이 각각 관측했다 — 하나는 `triggers.service.ts` 에
      > **미커밋 +555/-38**(이 PR 의 리팩터를 부분적으로 되감는 형태), 다른 하나는 teardown
      > 테스트가 **일시적으로 실패**했다가 재실행 시 통과하는 것. 두 세션 모두 판정 후
      > `git status --short` 로 워킹트리가 깨끗함을 확인했고, 나도 직접 확인했다
      > (`triggers.service.ts` 가 HEAD 와 1,351줄 동일).
      >
      > → **원인은 내 규율이 아니라 reviewer sub-agent 들이 공유 워크트리를 직접 뮤테이션하는
      > 것**이다. 내 행동을 바꿔도 안 없어진다. 처방을 그 방향으로 옮긴다:
      > **reviewer 프롬프트에 「검증용 변경은 scratch 사본에서, 공유 체크아웃 write 금지」를
      > 명시**하고(기존 교훈 `feedback_reviewer_mutates_shared_worktree` 와 같은 처방),
      > 14명이 **동시 실행**된다는 사실도 함께 고지한다. 지금은 판정이 커밋 기준이라 결과가
      > 오염되지 않았지만, **한 명이라도 `git restore` 를 쓰면 남의 작업이 사라진다**(선례 있음).
      > 이건 `.claude/skills/code-review-agents/**` 수정이라 **harness 축**이고 리뷰 게이트가
      > 안 무니 검증은 `python3 -m pytest .claude/tests -q`.
      >
      > **4회째 (`review/code/2026/09/11/19_06_54`) — 이제 하네스가 잡는다.** reviewer 3명이
      > `remove()` 의 teardown 호출이 `// MUTATED-OUT: …` 로 치환된 것을 각각 관측했고,
      > **`testing` reviewer 는 보안 분류기에 차단**됐다(`Blocked by classifier`).
      > 즉 *"reviewer 가 유령을 본다"* 단계를 넘어 **정책 위반으로 걸리는** 단계다 —
      > 차단되면 그 reviewer 의 커버리지가 통째로 신뢰 불가가 되므로 **결과 품질 문제**이기도
      > 하다(이번엔 그 지적을 내가 직접 재현해 확인했다). 우선순위를 올린다.
      >
      > **5회째 (`review/code/2026/09/11/19_30_49`)** — 이번엔 `triggers.service.ts:855` 가
      > `MUTATION-TEST-REMOVED` 로 치환된 것이 관측됐다. **4개 라운드 전부에서 1회 이상 났다**
      > (`18_04_36` · `18_42_05` · `19_06_54` · `19_30_49`). 매번 자연 복구됐고 워킹트리도
      > 매번 실측으로 깨끗함을 확인했지만, **재발률 100%** 이므로 *"가끔 있는 일"* 이 아니라
      > **reviewer 의 기본 동작**이다. 치환 마커 문자열이 라운드마다 다른 것
      > (`// MUTATED-OUT:` / `MUTATION-TEST-REMOVED`)도 여러 reviewer 가 각자 하고 있다는 뜻이다.

- [ ] **`SecretResolver.rotate` 에 빈 값 가드가 없다** (developer + 보안 판단, 2026-09-10 등재).
      `rotate(ref, ws, '')` 가 빈 문자열을 그대로 암호화해 row 를 덮어쓴다(`:129-145`, 가드 0).
      chatChannel PATCH 경로는 위 CRITICAL 의 D-2 로 닫히지만 **`rotate` 자체는 다른 호출부에도 열린
      표면**이다. 처방 후보: (a) 빈 문자열을 거부(throw) — 호출부 전수 확인 선행 (b) 명시적
      `allowEmpty` 옵션 (c) 그대로 두고 호출부 책임으로 문서화. **(a) 가 fail-closed 지만 정당한 빈
      값 사용처가 있는지 먼저 세야 한다.**

- [x] **생성/수정 검증 함수를 분리해야 한다 — 안 하면 D-1 구현이 생성 경로를 깬다** (developer,
      2026-09-10 등재, `--spec` `20_29_00` `cross_spec` INFO).
      `assertInboundSigningPlaintextByProvider` 는 `create()`(`:401`)와 `update()`(`:482`)가 **같은
      코드를 공유**한다. D-1("present 면 400")을 그 함수에 문자 그대로 넣으면 **slack/discord 의 생성
      (POST)에서도 존재를 막아 트리거 생성 자체가 깨진다** — 생성에서는 그 값이 여전히 필수다.
      처방: PATCH 전용 검증 경로를 갈라 D-1 을 거기에만 적용한다. **원 처방이 위험했던 것과 같은
      종류의 함정**이라 구현 착수 전 이 항목을 먼저 읽을 것.

      > **✅ 2026-09-11 해소.** `assertChatChannelInputSafe` 를 `mode: 'create' | 'update'` 로
      > 갈랐고, **오버로드 두 개**로 `mode` 와 DTO 타입을 컴파일 타임에 묶었다(문자열 판별자만
      > 두면 짝이 깨져도 컴파일러가 못 잡는다 — `/ai-review`
      > `review/code/2026/09/10/23_55_23` W4). PATCH 축은 신설 `assertPatchCarriesNoSecrets` 가
      > 보고, **생성 전용 검증(`assertInboundSigningPlaintextByProvider`)은 좁은 타입을 그대로
      > 둬서 "PATCH 에서 부르면 안 된다" 를 타입이 말하게** 했다.
      > 회귀: *"slack/discord 의 plaintext 부재는 더 이상 400 이 아니다"* +
      > *"CreateTriggerDto 는 여전히 botToken 을 요구한다"* 두 케이스가 양쪽을 고정한다.
      > 구현 PR `plan/{in-progress → complete}/impl-chat-channel-patch-token.md`.

- [ ] **docs 가드가 spec frontmatter 의 dangling `pending_plans` 를 안 잡는다** (harness, 2026-09-10
      등재, `--spec` `20_29_00` `plan_coherence` INFO).
      `15-chat-channel.md` 의 `pending_plans:` 가 `plan/in-progress/spec-sync-chat-channel-gaps.md` 를
      가리키는데 그 파일은 **`plan/complete/` 로 이동했다**(실측). `plan-lifecycle.md §3` 의 "인입 참조
      갱신" 의무를 옮긴 쪽이 놓쳤고 **docs 가드 21파일이 main 에서 통과**했다 — 즉 그 축을 아무도 안 본다.
      dangling 항목 자체는 `spec-draft-chat-channel-patch-token.md` 가 함께 지웠다(`status: partial` 은
      나머지 셋이 살아 있어 유효). 처방: `spec/**` frontmatter 의 `pending_plans` 경로가 실재하는지
      검사하는 가드 한 줄. **`findBrokenPlanLinks` 는 마크다운 링크만 보고 frontmatter 는 안 본다.**

- [x] **없는 메서드 `TriggersService.delete()` 가 세 곳에 있다 (실제는 `remove()`)**
      (planner 2 + 무조치 1, 2026-09-14 등재 · 스코프 확장 2026-09-14 · `--impl-done`
      `review/consistency/2026/09/14/11_52_23` cross_spec INFO#1 + `/ai-review` `11_52_13`
      requirement INFO#3 + `--impl-done` `12_37_09` cross_spec WARNING#1).

      **전수 grep 으로 세 곳이다** — 첫 등재는 `secret-store.md` 하나만 적었고, checker 가
      둘째를 찾았고, **셋째는 둘 다 못 봤다**:

      | # | 자리 | 소유 | 처분 |
      |---|---|---|---|
      | ~~1~~ ✅ | `spec/conventions/secret-store.md` §R4 | planner | `remove()` 로 정정 — 2026-09-17 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` S9 가 그 문장을 «모든 경로» 규칙으로 다시 쓰며 닫았다 |
      | ~~2~~ ✅ | `spec/1-data-model.md` `secret_store.workspace_id` 행 | planner | 같음 — 같은 draft S8 이 행을 다시 쓰며 메서드명을 뺐다 |
      | 3 | `codebase/backend/migrations/V063__secret_store.sql:20` | developer | **고치지 않는다** ↓ |

      > **3번은 고치면 안 된다 — Flyway 체크섬.** `docker-compose.e2e.yml` 이 마이그레이션을
      > `/flyway/sql` 로 마운트하고 `flyway migrate` 를 돌린다(실측). `migrate` 는 **이미 적용된
      > 마이그레이션의 체크섬을 검증**하므로, 주석 한 글자만 바꿔도 V063 이 적용된 장수 DB 에서
      > `migrate` 가 실패한다. e2e 는 매번 `down -v` 라 무해하지만 그것이 판단 근거가 될 수 없다.
      > **이 판단을 여기 적는 이유는 다음 사람이 «친절하게» 고치는 것을 막기 위해서다.**
      > 굳이 고친다면 마이그레이션 파일이 아니라 `migrations/README.md` 쪽에 註를 다는 편이 맞다.

      같은 문서(`secret-store.md`) §2.1 근방은 `remove()` 로 옳게 쓴다 — **문서 안에서 갈린다.**
      기존 오기이지만 `trigger-canary-hardening` 의 e2e 주석이 §R4 를 **처음 명시 인용**해
      가시화됐다.

- [x] **`2-trigger-list.md` 의 `code:` 가 §3 계약의 시행 파일 하나를 놓친다** (**2026-09-18 해소** `plan/complete/spec-draft-deletion-release-current-tense.md` C3 — 같은 `code:` 목록을 여는 변경에 묶었다, `--spec` 1회차 plan_coherence WARNING 2)
      (planner, 2026-09-14 등재 · `/ai-review` `review/code/2026/09/14/11_27_40`
      requirement WARNING#1). §3(`TriggerDto.workflow` 계약)의 시행 파일로
      `trigger-workflow-ref.e2e-spec.ts` 만 등재돼 있는데, `trigger-canary-hardening` 배치가
      `schedule-trigger.e2e-spec.ts`(C-2·G·H)에 같은 계약을 **schedule 타입에 대해 처음**
      시행하는 단언 3건을 넣었다. doc-sync-matrix 가 그 파일을 못 본다.
      처분: frontmatter `code:` 에 `schedule-trigger.e2e-spec.ts` 추가.

- [ ] **신규 repo-guard 가 spec `code:` 에 미등재 — 다만 «관례» 라 부를 만큼 일관되지 않다**
      (planner, 2026-09-14 등재 · `--impl-done` `review/consistency/2026/09/14/11_27_47`
      rationale_continuity INFO#2). `trigger-secret-columns-{guard,spec}.ts` 가 어느 spec 의
      `code:` 에도 없다. checker 는 *"시행 코드 추적성 관례 미적용"* 이라 했는데 **실측하면
      관례가 없다**:

      > **첫 등재의 실측표가 틀렸다** (`--impl-done`
      > `review/consistency/2026/09/14/11_52_23` plan_coherence WARNING#1).
      > *"5 중 2"* 라 적었는데 **표본 5개만** 봤고, 게다가 «등재» 의 술어를 *"이름이 spec 어딘가에
      > 등장하는가"* 로 잡았다 — 실제 술어는 **«어떤 spec 의 frontmatter `code:` glob 이 그
      > 파일에 매칭하는가»** 다. `masked-reject-callers` 가 그 차이로 갈린다: 이름은 spec
      > **산문**에 있고 `code:` 에는 없다.

      **주어와 술어를 고정한 전수 실측** — 주어 `repo-guards/__tests__/*-guard.ts`,
      술어 «spec frontmatter `code:` glob 매칭»:

      | | 수 |
      |---|---|
      | 대상 가드 (이 배치의 신규 1개 포함) | **14** |
      | `code:` 에 등재 | **5** — `dto-class-name-collision`·`dto-jsdoc-citation`·`endpoint-path-conflict-wrap`·`swagger-dto-contract`·`user-entity-exposure` |
      | 미등재 | **9** (`trigger-secret-columns` 포함) |

      > checker 는 *"14 중 4"* 라 했는데 분모는 맞고 분자가 하나 적다. **세 숫자가 다 달랐고
      > 원인은 전부 «무엇을 세는가» 였다** — 표본 vs 전수, substring vs glob.

      그래서 이 항목은 **두 질문**이다 — (a) 이 가드를 `secret-store.md` 의 `code:` 에 넣을
      것인가, (b) repo-guard 등재를 규약으로 세울 것인가. (b) 를 정하지 않으면 (a) 만 고쳐도
      다음 가드에서 같은 지적이 반복된다(미등재가 9개다).

      > **인접 항목**: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의
      > *"repo-guard 3파일 패턴에 소유 규약 문서가 없다 — `spec/conventions/repo-guards.md`
      > 신설 검토"*. **같은 항목이 아니다** — 그쪽은 «소유 규약 문서 신설», 이쪽은 «`code:`
      > 등재». 다만 (b) 를 정하는 자리가 그 문서가 될 수 있으니 **한 턴에 함께 볼 것**.

- [ ] **`GET /api/triggers/:id`(단건)의 schedule `workflow` 양성 커버리지가 0건**
      (developer, 2026-09-14 등재 · `/ai-review` `11_27_40` requirement INFO#2).
      `trigger-canary-hardening` 이 목록(C-2)·PATCH(G·H) 세 자리를 덮었는데 **단건 조회는
      `schedule-trigger.e2e-spec.ts` 에 케이스 자체가 없어** 남겼다(그 배치가 명시 유예).
      헬퍼 계약상 단건도 `workflow` 를 채우므로 양성 1건이면 닫힌다 — 단, 케이스를 새로
      만들어야 해서 «한 줄» 이 아니다.

- [ ] **`--impl-prep`/`--spec` 번들이 `spec/` 코퍼스를 통째로 절단한다 — 기록된 범위보다 넓다**
      (harness, 2026-09-14 등재 · `--impl-prep`
      `review/consistency/2026/09/14/10_44_37` cross_spec·convention_compliance 공동 WARNING#1).
      실측: `_prompts/cross_spec.md` 의 **387개 `@bundle-file` 중 380개**가 *"본문 생략됨"*
      한 줄로 대체됐다(완전 렌더 7개). `convention_compliance` 는 관점 2/4 판정에 직접 필요한
      원본(`error-codes.md`·`swagger.md`·`node-output.md`·`secret-store.md`·
      `spec-impl-evidence.md`)이 전부 절단돼 **판정 자체가 불가능**했다.

      > **이미 기록된 것보다 범위가 넓다.** 종전 관측은 *"`--spec` 기본 예산이 conventions 를
      > 통째로 떨군다"* 였는데, 이번은 **`spec/` 트리 전체**이고 모드도 `--impl-prep` 이다.
      >
      > **위험은 «미검증» 이 «문제 없음» 으로 보고된다는 것**이다. checker 가 스스로
      > *"관점 2/4 는 미검증으로 기록"* 이라 적어 이번엔 드러났지만, 그 자백이 없으면 BLOCK:NO
      > 가 «관례 준수 확인» 으로 읽힌다. 처방 후보: (a) 절단 시 SUMMARY 에 «미검증 관점» 을
      > 기계적으로 싣게 한다 (b) `related_specs` 우선순위를 target 의 `spec_impact` 기준으로
      > 재정렬 (c) 관점별로 번들을 쪼갠다. **(a) 가 가장 싸고 거짓 음성을 직접 막는다.**

      > **선행 진단이 이미 있다** (`--impl-done` `11_52_23` plan_coherence WARNING#2).
      > `plan/in-progress/harness-review-gate-followups.md` 의
      > *"승격은 됐는데 굶는다 — tier 안의 거대 파일 하나가 corpus 몫을 다 먹는다"* 절이
      > 근본원인·처방 후보를 더 자세히 적고 있다. **owner 를 harness 로 통일해 한 세션에서
      > 볼 것.**
      >
      > **같은 근본원인인가 — 아마도, 다만 관측 모드가 다르다.** 그쪽 실측은 `--spec`
      > 이고 이쪽은 `--impl-prep` 이다. 굶주림의 «분자» 도 다르다(그쪽은 거대 파일 하나,
      > 이쪽은 387개 중 380개라 분포가 넓다). 합치기 전에 **두 모드가 같은
      > `prioritize_bundle_files` 경로를 타는지** 먼저 확인할 것 — 아니면 하나를 고치고
      > 다른 하나가 남는다.
      >
      > (checker 는 이 절을 «§M» 이라 불렀는데 §M 은 *"`--impl-done` 번들의 diff 는 커밋
      > 기준인데 preamble 은 워킹트리를 SoT 라 선언한다"* 로 **다른 절**이다. 라벨은 틀리고
      > 실질 지적은 맞다.)

- [ ] **`cafe24-api-catalog/_overview.md §7.1` 에 «자신은 §1 예외» 라는 상호참조 한 줄**
      (planner, 2026-09-14 등재 · 범위 축소 2026-09-14 · `--impl-done`
      `review/consistency/2026/09/14/11_52_23` plan_coherence WARNING#3).

      > **첫 등재는 false positive 였고, 내가 실측 없이 통과시켰다.** 처음엔
      > *"`_overview.md` 에 lifecycle frontmatter 가 없다 — (a) 추가 (b) 예외 glob 명시 택일"*
      > 로 적었는데, `spec/conventions/spec-impl-evidence.md` **§1 이 이미
      > `spec/<영역>/_*.md`(밑줄 prefix)를 제외로 명시하고 `_overview.md` 를 예시로 든다**
      > (실측: 55행). 즉 frontmatter 부재는 **규약대로**다.
      >
      > 더 나쁜 것은 경위다 — `--impl-prep` checker 가 이 지적을 내면서 *"`spec-impl-evidence.md`
      > 원문이 절단돼 정규식까지는 미대조"* 라고 **스스로 미검증임을 밝혔는데**, 나는 그
      > 문장을 등재 각주에 옮겨 적기까지 하고 **재실측은 하지 않았다.** 미검증 전제를
      > 트래커에 올리면 다음 사람이 없는 일을 쫓는다.

      남는 진짜 갭은 하나다: §7.1 이 *"카탈로그 최상위 `<resource>.md` 인덱스는 정식 spec 으로
      계속 검증된다"* 고만 적어, **`_overview.md` 자신이 §1 예외에 해당한다**는 사실이 그
      문서에서 읽히지 않는다. 그래서 읽는 사람마다 이 지적을 다시 낸다(실제로 냈다).
      처분: §7.1 에 상호참조 **한 줄**. 택일 결정이 아니다.

- [ ] **`<parent>__<child>` 더블언더스코어 표기가 규약에 정의돼 있지 않다**
      (planner, 2026-09-14 등재 · `--impl-prep` `10_44_37` convention_compliance WARNING#3).
      실제 파일명 50개 이상이 `categories__decorationimages`·`boards__articles__comments`(3단
      중첩) 형태를 쓰는데, `cafe24-api-catalog/_overview.md §7.1` 은 *"kebab-case, 예:
      `appstore-orders`"* 까지만 적어 `__` 의 의미(부모-자식 구분자)를 유도할 수 없다.
      처분: §7.1 에 *"중첩 sub-resource 는 `__` 로 부모-자식을 잇고 각 세그먼트는 kebab-case"*
      한 문장.

- [x] **하드닝: 트리거 비밀 컬럼 목록이 3중 독립 사본이다** (developer, 2026-09-10 등재,
      `maintainability` W1 + `security` W1 이 같은 자리를 독립 지적).
      정본은 `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS`(비-export), 사본은
      `shared/testing/schedule-trigger-ref.ts` 와 신규 `trigger-workflow-ref.ts`.
      **값·순서가 현재 완전히 일치함을 실측했지만 결속 장치가 없다** — 정본이 네 번째 비밀
      컬럼을 추가해도 두 헬퍼는 조용히 통과한다.

      처방: **repo-guard 로 세 목록 동일성을 강제한다.** 정본이 `export` 되지 않아 import 할
      수 없고, 서비스 모듈을 테스트 헬퍼로 끌어오는 것은 의존 그래프상 과하다 — 그래서
      런타임 공유가 아니라 정적 가드다. `CREATOR_PROJECTION` 선례(동일 리터럴 4중 복사가
      실제 Critical 로 터진 뒤 단일 상수로 통합)가 이 형태의 가까운 이력이다.

      > **self-spec 쪽 사본은 이 항목의 대상이 아니다.** `trigger-workflow-ref.spec.ts` 가
      > 같은 이름들을 또 적고 있는 것은 **일부러**다 — 헬퍼 상수를 import 해 순회하면 누가
      > 목록을 줄여도 스펙이 그대로 통과해 대조군이 사라진다. 헬퍼↔프로덕션 중복은 드리프트
      > 위험이지만 **스펙↔헬퍼 중복은 독립 대조군**이다. 그 구분을 스펙 헤더에 명시했다.

      ✅ **2026-09-14 해소** — `trigger-canary-hardening` 배치.
      `repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}` 신설.
      **AST 로 읽는다** — 세 파일 다 목록 위 JSDoc 에 컬럼 이름이 산문으로 있어 정규식이면
      주석이 값으로 잡힌다(형제 `redis-fail-open-catalog-guard.ts` 와 같은 근거).
      뮤턴트 5건 전부 예측대로 RED(정본 컬럼 추가 · 사본 순서 뒤집기 · 사본 컬럼 삭제 ·
      `satisfies` 분기 제거 · 비-문자열 원소 skip).

- [x] **회귀 방어: `type: 'schedule'` 트리거의 `workflow` 양성 커버리지가 저장소 전체에 0건**
      (developer, 2026-09-10 등재, `testing` INFO).
      캐너리 다섯 케이스는 전부 `type: 'webhook'` 이다. 소스를 추적하면 schedule enrichment
      (`Object.assign(t, {cronExpression, timezone, nextRunAt})`)는 **제자리 mutate** 라서 이미
      로드된 `workflow` own property 를 건드리지 않고 같은 `sanitizeForResponse` 를 타므로
      **지금 동작은 webhook 과 동일하다** — 현재 정확성은 코드로 확인됐다.

      문제는 **방어력**이다. `schedule-trigger.e2e-spec.ts` C-2 는 cron/timezone/nextRunAt 과
      `assertMatchesContract` 만 보는데, §5.4 키 생략형이라 그 검증자는 부재를 위반으로 보지
      않는다. 그래서 장래 enrichment 가 in-place mutate 대신 **새 plain object 를 spread** 로
      만드는(흔한 리팩터 패턴) 순간 **두 파일 다 못 잡는다.** 처방: `schedule-trigger.e2e-spec.ts`
      의 목록·단건 케이스에 `expectTriggerWorkflowRef(…, {present: true, expectedWorkflowId})`
      한 줄씩. 헬퍼가 이미 있으므로 비용은 두 줄이다.

      ✅ **2026-09-14 해소** — `trigger-canary-hardening` 배치. **세 줄이었다**(두 줄이 아니라):
      C-2 목록 · G·H PATCH. 단건 `GET /api/triggers/:id` 는 이 파일에 없다.

      > **항목 제목의 «저장소 전체에 0건» 은 표면을 하나 겹쳐 읽은 것이다.** 실측하면 표면이
      > 둘이고 하나는 이미 덮여 있었다 — `ScheduleDto.trigger.workflow` 는
      > `expectNarrowedScheduleTriggerRef` 로 **양성 3 + 음성 1**(=`3-schedule.md` §4 註가
      > 주장하는 그 수)이 이미 고정돼 있다. 0건이었던 것은 **`TriggerDto.workflow`
      > (`type:'schedule'`)** 쪽이다. `--impl-prep` checker 도 같은 자리에서 *"§4 주장이
      > 미이행"* 이라 했는데 그것은 **반증됐다**.

      > **음성 대조는 이 표면에 없다** — schedule 트리거는 `POST /api/triggers` 로 만들지
      > 않으므로 `TriggerDto` 생성 응답 자체가 존재하지 않는다. *"음성이 빠졌다"* 를 결함으로
      > 다시 등재하지 말 것.

      뮤턴트(세 자리 `present: true`→`false`) → **정확히 그 세 케이스만 RED**, 다른 케이스
      영향 0. 비-vacuity 와 «세 표면이 실제로 `workflow` 를 싣는다» 를 함께 고정했다.

- [ ] **하드닝: `production-build-devdep-guard` 가 "exclude 된 디렉터리를 import 로 도달"
      형태를 못 본다** (developer, 2026-09-10 등재, `side_effect` W1 — **reviewer 가 실제 `tsc`
      로 재현**).
      `ts.parseJsonConfigFileContent()`(가드의 `resolveBuildFileNames` 가 쓰는 그 API)는 glob
      include/exclude 만 평가하고 **어떤 파일이 다른 root 파일에서 `import` 되는지는 보지
      않는다.** 그래서 `src/shared/testing/**` 아래 파일은 그 함수 반환값에 **항상** 없고,
      가드는 `it.each(['shared/testing', …])` 로 그 부재만 확인한다. 그런데 exclude 되지 않은
      프로덕션 파일이 그 경로를 import 하면 tsc 는 프로그램에 편입시켜 **`dist/` 로 emit 한다.**
      게다가 `@types/jest` 가 ambient 라 **컴파일 에러도 나지 않고**, 그 함수가 실제로 호출될
      때 `ReferenceError` 로 죽는다.

      현재 `shared/testing/**` 를 import 하는 프로덕션 파일은 **0건**이라 이론 단계다. 처방:
      가드를 "exclude 목록에 없다" 에서 **"emit 된 `dist/` 에 그 경로가 없다"** 또는 "프로덕션
      파일의 import 그래프에 그 경로가 없다" 로 바꾼다 — **존재 검사가 아니라 도달 검사**여야
      한다. 내 헬퍼 docstring 은 이 실측으로 이미 좁혔다.

- [x] **정리: 캐너리 두 파일의 주석 표기·성격** (developer, 2026-09-10 등재, `/ai-review` 4라운드
      `16_55_52` 가 낸 주석-수준 발견 3건. **브랜치에서 고치지 않고 등재한 것은 미리 선언한 정지
      규칙 때문이다** — 게이트 산술상 코드를 고치면 라운드가 하나 더 필요하고, 4라운드를 마지막으로
      한다고 3라운드 SUMMARY 에 적었다. 세 건 다 캐너리를 틀리게 하거나 테스트를 약화시키지 않는다).

      | # | 지적 | 처방 |
      |---|---|---|
      | 1 | **표기가 갈렸다** (`maintainability` W1). 케이스 헤딩 8개는 아라비아 숫자인데 `## 가드 ③·⑤` 하나만 원문자다 — `grep '가드 [0-9]'` 로는 "5" 가 안 잡히고 `⑤` 로만 존재한다. 헤더가 *"위에서 아래로 읽으며 대응 테스트를 찾는다"* 를 목적으로 내세우는데 그 도구가 한 케이스에서만 바뀐다 | 한쪽으로 통일하고, **어느 표기가 어디 쓰이는지 한 문장**을 헤더에 명시(원문자=마스터 목록, 아라비아=케이스 라벨 — 또는 반대) |
      | 2 | **헤더에 리뷰 이력이 누적된다** (`maintainability` W2). 3라운드가 *"다음에 또 얹기 전 분량 재점검"* 을 남겼는데 재점검 없이 23→34줄(+48%)이 됐다. 핵심은 분량이 아니라 **성격**이다 — *"처음 10개로 적었다"* 류는 RESOLUTION·커밋·plan 에 durable 하게 남는데 소스에 또 박으면 매 라운드 자기수정 로그가 쌓인다. 같은 패턴이 헬퍼 `//` 註에도 있다 | 소스에는 **계약 정의만** 남긴다(가드 11단계 · ⑤ 를 왜 남기는가). *"몇 라운드 전엔 몇 개로 잘못 적었다"* 는 소스에서 빼고 커밋/RESOLUTION/트래커로 |
      | 3 | 인용 `"keys [] ≠ ['id','name']"` 은 Jest 실제 출력의 리터럴이 아니라 **의역**이다 (`requirement` INFO). 논지는 훼손 없음 | 의역임을 표시하거나 실제 출력 형태로 교체 |

      > **2번이 이 셋 중 유일하게 습관 차원이다.** 1·3 은 한 자리 고치면 끝나지만, 2 는 *"리뷰가
      > 지적하면 그 사실을 소스 주석에 적는다"* 는 내 기본 반응 자체를 지목한다. 그 반응이 이 브랜치
      > 네 라운드 동안 두 파일의 주석을 계속 키웠다. **판별 질문은 "이 문장이 없으면 다음 사람이
      > 코드를 잘못 쓰는가" 다** — 예면 소스, 아니면 트래커.

      ✅ **2026-09-14 해소** — `trigger-canary-hardening` 배치. 세 지적 전부:
      **①** 아라비아 숫자로 통일(원문자 잔여 0) + *"두 체계를 쓰지 않는 이유"* 한 문장.
      **원문자가 아니라 아라비아로 통일한 이유**는 헤더가 내세운 목적이 *"위에서 아래로 읽으며
      대응 테스트를 찾는다"* 이고 그 도구가 `grep '가드 [0-9]'` 이기 때문이다 — 원문자로
      통일하면 그 grep 이 전부 0건이 된다. **케이스 헤딩 3개가 전부 잡힌다**(종전 2개 —
      `3·5` 가 원문자라 빠졌다). `grep '가드 [0-9]'` 총 매치는 13줄이고 그 내역은
      케이스 헤딩 3 · 구획 주석 7 · 산문 3 이다.

      > **첫 판에 «9자리» 라 적었다가 정정했다.** 어느 기준으로도 9 가 나오지 않는다 —
      > 앞선 grep 출력을 눈으로 세다 틀렸다. 정정을 `trigger-canary-hardening.md` 쪽에만
      > 하고 **여기 둘째 사본을 놓쳐** 한 배치가 쓴 두 문서가 서로 다른 수를 «(실측)»
      > 표시와 함께 주장하고 있었다 (`/ai-review`
      > `review/code/2026/09/14/12_17_14` documentation WARNING#2).
      **②** 자기수정 로그 2문단(*"처음 10개로 적었다"* · *"내가 4건을 뭉텅이로 붙이며 깼다"*)을
      소스에서 제거 — 규칙("새 가드는 그 자리에 테스트도")과 가드 5 의 **진단 품질** 근거는
      남겼다(그 문장이 없으면 다음 사람이 5 를 dead code 로 지운다).
      **③** `"keys [] ≠ ['id','name']"` 이 **의역**임을 표기.

      > 항목이 *"케이스 헤딩 8개는 아라비아"* 라 적었는데 실측하면 `## 가드` 헤딩은 **3개**
      > (아라비아 2 · 원문자 1)다. 갈렸다는 사실은 맞고 개수만 틀렸다.

- [x] **관례 정비: e2e teardown 이 `secret_store` 고아 row 를 남긴다** (developer, 2026-09-10
      등재, `side_effect` W2 + `testing` INFO).
      `chatChannel` 이 붙은 트리거는 `setupChatChannel` 이 외부 호출 **이전에**
      `secrets.rotate()` 로 `secret_store` 에 row 를 쓴다 — provider 호출이 실패해도 남는다.
      그 정리는 `TriggersService.remove()` 의 `deleteByPrefix` 만 하고, `secret_store` 는 FK 가
      없어(application-level cascade) raw `DELETE FROM trigger` 로는 **지워지지 않는다.**
      해당 파일 둘(`chat-channel-trigger-create.e2e-spec.ts` · 신규 `trigger-workflow-ref.e2e-spec.ts`)
      이 같은 관례를 쓰므로 신규 회귀는 아니다.

      > **여기서 정정할 것은 관례보다 근거다.** `--impl-prep` 의 `convention_compliance` 는
      > *"ephemeral schema 가 자동 truncate 하므로 row 삭제가 불필요하다"* 고 봤는데, 그 추론은
      > **`trigger` 테이블만 보고 `secret_store` 를 안 덮는다.** 결론(불필요)은 세션 경계에서
      > 참일 수 있지만 **검증 범위가 결론보다 좁았다** — 그 경계를 두 e2e 파일의 `afterAll`
      > 주석과 이 항목에 적었다. 처방 후보: (a) raw DELETE 대신 `DELETE /api/triggers/:id` 를
      > 태워 서비스 경로가 정리하게 한다(관례 변경, 두 파일), (b) `PROJECT.md` §e2e 작성 패턴에
      > *"secret 을 만드는 e2e 는 raw DELETE 로 정리되지 않는다"* 한 줄. **(a) 가 근본이지만
      > 캐너리의 음성 케이스는 삭제 순서에 민감하니 착수 시 실측할 것.**

      ✅ **2026-09-14 해소 — 실측이 (a) 를 기각했다.** `trigger-canary-hardening` 배치.

      | 경계 | 측정 | 결과 |
      |---|---|---|
      | 세션 «간» | `make e2e-test` 는 끝에 항상 `e2e-down` = `docker compose down -v` | **볼륨째 삭제** → 누적 없음 |
      | 세션 «안» | `secret_store` 를 읽는 유일한 e2e(`secret-store-like-prefix`) | `ref LIKE <자기 접두>` 로 스코프 → 간섭 없음 |

      (a) 는 teardown 에 **외부 provider 호출**(`remove()` → `teardownChatChannel`)과 인증
      의존을 더한다 — 얻는 것 없이 취약해진다. **정정한 것은 관례가 아니라 근거**다:
      두 e2e 의 註가 *"`secret_store` 까지 검증한 것으로 오인하지 말 것"*(=미검증)이었는데
      이제 **검증됨 + 두 경계**로 올렸고, `secret-store.md §R4` 와 충돌하지 않음(R4 는
      **프로덕션 삭제 경로**의 규율이고 그 경로는 R4 대로 동작한다)을 함께 적었다.
      서술은 `trigger-workflow-ref.e2e-spec.ts` 한 곳을 **정본**으로 두고 자매 파일은
      그것을 가리킨다 — 두 벌 두면 한쪽만 낡는다.

- [x] **`6-websocket-protocol.md` 도입 산문 — 완료 (2026-09-10, planner 턴).**
      순수 `## Overview` 4단락(1,767자) + `## Rationale` 에 표기 선택 근거 1항목.
      `--spec` 2라운드(`12_11_41` → `12_28_11`) 후 BLOCK:NO.
      **2026-09-05 처분이 지목한 "개요 내용이 실제로 없는 두 문서" 가 이로써 둘 다 닫혔다**
      (`2-api-convention.md` = `983fd0ade`/#1289, 이 문서 = 이번 턴).

      > **표기는 `## 1. 개요` 가 아니라 번호 밖 `## Overview` 다.** 이 문서 §1 이 이미
      > `## 1. 연결` 이라 번호형 개요를 넣으면 §1~§9 가 밀리고, 저장소가 이 문서의 번호 앵커를
      > 인용하는 자리가 **96건**(`spec/` 89 · `plan/` 7 · `codebase/` 0, 13종)이라 전부 깨진다.
      > 삽입 전/후 heading 목록 대조로 **36개 전부 무변경**을 확인했다.
      >
      > 접미사 `(제품 정의)` 를 안 붙인 근거는 `project-planner/SKILL.md` 의 정의다 — 그 접미사는
      > "사용자 가치·요구사항·목표(옛 PRD 자리)" 를 표시하므로 **문서 주제가 아니라 그 절의
      > 내용**이 기준이고, 이 절은 범위·섹션 맵·SoT 경계만 담는다. **단 이 기준을 `5-system/` 의
      > 9/3 분열 전체를 설명하는 법칙으로 넓히지는 않았다** — `2-api-convention.md` 가 접미사를
      > 달고도 같은 문형이라 반대 방향으로 깨진다(`convention_compliance` R2).

      > **`--spec` 이 CRITICAL 을 하나 잡았고, 그게 이 턴에서 가장 중요한 일이었다.** 초안이
      > *"놓친 이벤트는 `seq` 기반으로 복구한다(§6.2)"* 라고 적었는데, 이 문서 `## Rationale` 의
      > 「재연결 복구 — native WS 는 snapshot, seq 버퍼-replay 는 SSE 전송」 항목이 바로 그 문장을
      > *"WS 가 버퍼를 갖는다는 **폐기된 전제**"* 로 **이미 철회**해 둔 상태였다. 즉 **문서가 쓰고
      > 철회한 주장을 입구에 되살릴 뻔했다.** `cross_spec`·`convention_compliance` 가 독립적으로
      > CRITICAL 로 올렸고, 정정 후 라운드 2 에서 해소를 확인했다.
      >
      > **오도의 출처가 spec 안에 있었다** — `2-api-convention.md §10.4` 가 아직 raw-WS 시절
      > "마지막 수신 이벤트 ID → 놓친 이벤트 재전송" 을 적고 있다. 위 신규 항목으로 등재했다.

- [x] **`2-api-convention.md §10.4` 정정 — 완료 (2026-09-10, planner 턴).**
      §10.4 본문 교체(E-1) + 같은 문서 `## Rationale` 2026-09-02 항목에 갱신 블록쿼트 append(E-2).
      `--spec` `12_51_46` — Critical 1(이력 서술) 해소, Warning 4 전부 반영.

      > **등재할 때 내가 쓴 근거 하나가 거짓이었다.** 처방 (b)("§10.4 를 위임만 남기고 삭제")의
      > 근거로 *"§10 의 나머지 소절이 이미 전면 위임 구조"* 라 적었는데, §10 을 열어 보니
      > §10.1(URL)·§10.2(JSON 프레임)·§10.3(용도 표)이 **전부 인라인**이고 위임은 말미 한 줄뿐이다.
      > 그래서 (a)(서술 유지 + 사실 정정)로 갔다.
      >
      > **반대로 내가 과대주장한 것도 있다.** *"등재 항목은 두 번째 불릿만 지적했다"* 고 적었는데
      > 틀렸다 — 이 항목은 이미 blockquote 의 구분 축까지 지적하고 처방까지 달았다.
      > 실측으로 새로 추가된 것은 **백오프 수치 한 곳**이다(`plan_coherence` WARNING).

      > **가장 중요한 발견은 세 결함의 출처가 다르다는 것이다** (`rationale_continuity` CRITICAL).
      > 불릿 2개는 `05089d5a6`(2026-03-26) 이후 미수정 — 순수 drift. 그런데 예외 blockquote 는
      > `7e6a4bc3e`(2026-09-02, #1267)로, `698bf30e2`(**2026-05-31**)가 *"폐기된 대안: native WS
      > lastSeq 버퍼-replay 전면 구현"* 을 명문 기각한 **3개월 뒤**에, 그 기각을 인용하지 않은 채
      > 들어왔다. 즉 **폐기된 설계의 조건부 재도입**이었다.
      >
      > 교훈이 갈린다 — drift 는 *"요약을 주기적으로 SoT 와 대조하라"* 이고, 이쪽은
      > **"예외를 만들기 전에 그 주제 Rationale 에 폐기 선언이 있는지 먼저 보라"** 다. E-2 가 두
      > 문서 Rationale 을 상호 인용하게 만든 것이 그 재발을 막는 최소 장치다.

      §10.4 「재연결」의 두 번째 불릿이 *"재연결 시 마지막 수신 이벤트 ID 전달 → 놓친 이벤트
      재전송"* 이라 적는다. 그런데 `6-websocket-protocol.md §6.2` 는 **native WS 에 replay 버퍼가
      없다**고 명시한다 — 재구독하면 1회성 `execution.snapshot` 을 받고, `seq` 기반 정밀 재전송은
      **EIA SSE 어댑터 소유**다(§4.7 「5분 버퍼는 SSE 어댑터 소유」 · `14-external-interaction-api.md`
      §R7 이 seq 공유를 **SSE 와 notification 사이로 한정**).

      **바로 아래 blockquote 가 문제를 고치는 대신 봉인한다.** 그 註는 *"위 두 줄은 **전송 계층이
      끊긴 경우**를 말한다"* 며 "서버가 스스로 `disconnect()` 한 경우" 만 예외로 빼낸다 — 즉
      **전송 계층 끊김에는 last-event-ID 재전송이 있다는 잘못된 주장을 그대로 유지**한다. 실제로는
      두 경우 모두 snapshot 이다.

      > **이게 왜 P2 인가**: 이 항목은 실제로 사람을 오도했다. 같은 세션에서 `6-websocket-protocol.md`
      > 도입문을 쓰며 *"놓친 이벤트는 `seq` 기반으로 복구한다"* 라고 적었고, `cross_spec` 이 그걸
      > CRITICAL 로 잡았다. **오도의 출처가 spec 안에 있으면 다음 사람도 같은 자리에서 틀린다.**
      > 그 도입문은 정정해 머지했지만(§6.2 를 정확히 인용), §10.4 는 그대로다.

      처방 후보: (a) 두 번째 불릿을 snapshot 모델로 정정하고 blockquote 의 "위 두 줄은 전송 계층이
      끊긴 경우" 프레이밍도 함께 고친다 — **불릿만 고치면 註가 다시 모순을 만든다.** (b) §10.4 를
      "상세는 WS §6 이 SoT" 위임만 남기고 메커니즘 서술을 삭제한다 — §10 의 나머지 소절이 이미
      전면 위임 구조라 이쪽이 관행에 더 맞을 수 있다. **어느 쪽이든 `6-websocket-protocol.md §6.2`
      를 인용해 단일 SoT 를 명시할 것.**

- [ ] **"에러 코드 어휘 규약" vs "명명 규율" — 세 문서 표현 통일** (planner, 2026-09-10 등재,
      `--spec` `12_11_41` `cross_spec` INFO). `conventions/error-codes.md` 는 스스로 *"명명·안정성
      규율만 정의한다. 카탈로그·분류·트리거는 `3-error-handling.md §1` (SoT)"* 라고 경계를 긋는데,
      `4-execution-engine.md` Overview(32행)는 그 위임을 *"에러 코드 **어휘** 규약은
      conventions/error-codes.md"* 라고 적는다 — "어휘" 는 통상 "무엇이 존재하고 무슨 뜻인가
      (=카탈로그)" 로 읽혀 `error-codes.md` 자신의 scope 선언과 결이 어긋난다.

      **이번에 `6-websocket-protocol.md` 도입문은 이 관행을 답습하지 않고** 세 갈래(명명 규율 /
      카탈로그·봉투·정책 / 본 문서 §7.1 의 `WsErrorCode`)로 갈라 적었다. 즉 지금 저장소에 **두
      표현이 공존**한다. 새 쪽이 정확하므로 `4-execution-engine.md` 를 그쪽으로 맞추는 방향이지만,
      그 문서를 여는 다른 작업에 얹는 것이 싸다 — **단독으로 열 항목은 아니다.**

- [ ] **harness: tier-1 신호가 planner 턴에서 구조적으로 무의미해진다** (harness, 2026-09-10 등재,
      한 세션에서 **4회** 관측). `harness-review-gate-followups.md` §"승격은 됐는데 굶는다" 의
      **자매 결함**이고, 그쪽은 "몫이 모자란다" 를 다루는데 이쪽은 **"승격 집합 자체가 오염된다"** 다.

      `prioritize_bundle_files` 의 tier 1 은 *"이 브랜치가 건드린 plan 이 이름을 언급함"* 이다.
      의도는 "이 작업의 대상" 을 집어내는 것이었는데(tier 2 "아무 in-progress plan 이 언급함" 이
      한 디렉터리의 77% 를 태깅해 도입된 좁힘이다), **planner 턴은 트래커를 편집하는 것이 정상
      워크플로**다 — 항목을 플립하고 후속을 등재하는 것이 매 턴의 마무리다. 그리고 트래커는
      정의상 수십 개 spec 을 거론한다.

      **한 세션 4회 관측:**

      | # | 브랜치가 건드린 plan | 오염 결과 |
      |---|---|---|
      | 1 | `spec-draft-schedule-trigger-ref-nav.md`(대상 4개 지목) | `cross_spec` 적재 1 / 생략 112 — 대상 3개 탈락 |
      | 2 | + `harness-review-gate-followups.md`(무관한 정정) | 적재 7 / 생략 106 — **대상 문서 탈락**. 정정을 [#1305] 로 분리해 해소 |
      | 3 | `spec-draft-ws-protocol-intro.md` 가 반례로 `1-auth.md` 인용 | 대상 탈락 (예산 1.5M 에서도) |
      | 4 | + 본 트래커 편집(항목 플립·후속 등재) | tier 1 이 `4-integration.md`(156,132자) 등으로 폭증, 대상까지 누적 911,639자 → **예산 ~2.3M 필요** |

      즉 **정상 워크플로를 밟을수록 게이트가 눈이 먼다.** 그리고 회피책(예산 상향)의 비용이
      선형이 아니다 — 4회차는 프롬프트 5개가 각 ~1.3MB 다.

      **처방 후보:**
      - (a) **`spec_impact:` frontmatter 만** tier 1 로 승격하고 **본문 언급은 tier 2** 로 내린다.
        `spec_impact` 는 "이 작업이 무엇을 고치는가" 의 명시 선언이고, 본문 언급은 배경·인용·
        반례까지 섞인다. 이번 4회 중 **1·3·4 는 전부 본문 언급이 원인**이었다(1 은 `spec_impact`
        4개 중 자연순 1번이 몫을 먹은 것이라 (a)로는 안 닫히고 예산·생존 축 처방이 필요).
      - (b) tier 1 을 **`--spec`/`--impl-prep` 의 target plan 하나로 한정**한다. 같은 브랜치의
        다른 plan(트래커 포함)은 tier 2. 가장 직접적이지만 "여러 plan 이 함께 진행되는" 케이스를
        놓칠 수 있다.
      - (c) tier 1 이 **N 개를 넘으면 신호로 취급하지 않는다**(tier 2 로 강등). tier 2 도입 근거가
        "77% 를 태깅하는 신호는 신호가 아니다" 였으니 같은 논리의 일반화다. 임계값을 정해야 한다.

      **완료의 기계적 증거**: 회귀 테스트에 *"본문에서 spec 을 20개 거론하는 트래커를 함께 편집한
      브랜치에서, target plan 의 `spec_impact` 가 지목한 문서가 번들에 살아 있는가"* 를 캐너리로
      넣는다 — 오늘은 RED 여야 한다.

      > **왜 예산 상향으로 끝내지 않나**: 이번 세션에 세 번 올렸다(262,144 → 800,000 → 1,200,000
      > → 1,500,000, 그래도 부족). 매번 "이번엔 얼마면 되나" 를 손으로 계산했고 **네 번 중 두 번
      > 틀렸다.** 회피책이 사람의 산수에 의존하면 그 산수가 틀리는 날 게이트가 조용히 통과한다.

- [ ] **harness: `--spec` 번들이 `spec_impact` 의 `spec/conventions/*` 를 떨군다**
      (harness, 2026-09-05 등재, `review/consistency/2026/09/05/16_21_52` INFO#2).
      `spec_impact` 에 `spec/conventions/swagger.md` 를 명시했는데 **5개 프롬프트 어디에도
      본문이 실리지 않았다** (그 문서에만 있는 헤딩 `### 5-1. 응답 DTO 위치` 로 판정:
      전부 0건. 대조군인 draft 헤딩은 1건이라 판정 명령은 정상). checker 들이 직접 조회로
      보완해 그 라운드는 유효했으나, **`spec_impact` 에 적힌 파일이 번들에서 빠지는 것은
      구조적 결함**이다.

      > 이것은 알려진 클래스의 재발이다 — *"consistency `--spec` 기본 예산이 conventions 를
      > 통째로 떨군다"*. 이번엔 `spec_impact` 명시에도 불구하고 떨궈졌다는 점이 새롭다.

      > **`--impl-prep` 에서도 재현됐다** (2026-09-13 추가 ·
      > `review/consistency/2026/09/13/18_40_54` cross_spec·convention_compliance WARNING#1).
      > 그동안 이 결함은 **`--spec` 한정**으로 기록돼 있었는데, `--impl-prep` 세션에서도
      > 같은 일이 났다 — 프롬프트 번들이 *"컨텍스트 예산 초과로 생략된 파일 268개"* 에
      > 그 작업의 SoT 두 건(`error-codes.md` 17,742자 · `user-guide-evidence.md`)을 넣었다.
      >
      > **두 checker 가 직접 `Read` 로 우회해서 그 라운드는 유효했다.** 그게 이 항목의
      > 위험을 보여준다 — **우회하지 않았다면 거짓 "충돌 없음" 판정이 나갔을 것이고,
      > 우회했는지 여부는 산출물에 드러나지 않는다.** 즉 이 결함은 *조용히* 통과시킨다.
      >
      > 처분안: 번들러가 plan 본문·헤더 주석의 `SoT: <경로>` 표기를 알파벳 순보다
      > **우선 적재**하도록 정렬 로직 변경. 모드 한정을 지우고 **`--spec`·`--impl-prep`
      > 공통**으로 적을 것 — 모드를 좁게 적은 것이 이 항목이 두 번 발견된 이유다.

- [x] **harness: `code:` 블록 리스트의 YAML 주석이 게이트 파서를 조용히 끊는다**
      ✅ **2026-09-06 해소** — 파서가 빈 줄·`#` 주석을 건너뛴다.
      (harness, 2026-09-05 등재). `review_guard._parse_frontmatter_code` 의 블록 리스트
      루프가 `^\s*-\s*` 에 안 맞는 첫 줄에서 `break` 하므로, **주석 뒤 항목이 전부
      사라진다**. 실측: 주석을 넣자 `2-api-convention.md` 가 9개(주석 앞까지)만 반환.

      **두 파서가 서로 다른 답을 낸다** — 프런트엔드 `spec-frontmatter-parse.ts` 는
      `matterNoCache`(gray-matter → 진짜 YAML)라 주석 뒤 항목을 **본다**. 즉 유효한 YAML 에
      대해 `spec-code-paths.test.ts` 는 통과시키고 `--impl-done` 게이트는 못 본다.

      **위험한 이유**: 이번에 그 주석을 남겼으면 *"등재 완료"* 라고 문서에 적어 놓고
      게이트는 여전히 못 보는 상태로 머지될 뻔했다 — 이 항목이 고치려던 결함 그 자체다.
      당장은 주석을 쓰지 않는 것으로 회피했다. 파서를 고치거나, 최소한 두 파서가 갈리는
      입력을 가드로 잡아야 한다.

      > **2026-09-06 — 하루 만에 재발했다. 우선순위를 올린다.**
      > `review-citations.md` 에 시행 코드를 등재하면서 같은 주석을 넣었고, 이번엔
      > 파싱 결과가 **2개 → 0개**로 떨어졌다. 등재하려던 파일이 안 걸린 것은 물론이고
      > **이미 걸려 있던 `sanitize-loader-error.ts` 까지 감사망에서 빠지는 회귀**였다
      > (`review/code/2026/09/06/13_39_20` Critical 1 — 리뷰어가 게이트를 직접 실행해 잡았다).
      >
      > **회피책이 작동하지 않는다는 증거다.** "주석을 쓰지 않는다" 는 이 문서에 적혀
      > 있었는데도, 다른 문서의 checker 가 *"인라인 YAML 주석으로 범주를 가르라"* 고
      > 제안하자(`review/consistency/2026/09/06/13_18_59` INFO#2) 그대로 채택했다 —
      > **checker 의 제안이 이미 등재된 harness 결함과 충돌할 수 있다.** 산문 규율로는
      > 다음 제안을 못 막는다. 파서를 고치거나(`#`·빈 줄 스킵), 두 파서가 갈리는 입력을
      > 가드로 잡아야 한다.
      >
      > 두 번 다 **게이트에 직접 물어서** 발견됐다(`_parse_frontmatter_code` 실행). 문서에
      > "등재 완료" 라고 쓰는 것은 등재의 증거가 아니다.

      > **해소 (2026-09-06, `user-entity-column-defense`)** — 회피가 아니라 파서를 고쳤다.
      >
      > 회피로 넘어가려다 저장소 전수를 재 봤다. **spec 387개 중 7개 파일에서 41개 entry
      > 가 이미 유실 중**이었고 — `2-navigation/{_layout,9-user-profile,10-auth-flow,
      > 11-error-empty-states}.md` · `7-channel-web-chat/{2-sdk,3-auth-session}.md` ·
      > `conventions/user-guide-evidence.md` — 그중 하나
      > (`9-user-profile.md` 의 `codebase/backend/src/modules/workspaces/**`)가 **그 PR
      > 자신이 고치던 `workspace-response.dto.ts` 를 덮고 있었다.** 즉 이 결함은
      > "언젠가 문제가 될 것" 이 아니라 **그 순간 게이트를 끄고 있었다**
      > (`review/consistency/2026/09/06/13_52_23` Critical 1).
      >
      > 세 번째 재발이 확정된 시점에서 **회피책이 작동하지 않는다는 것이 증명됐다** —
      > 산문 규율은 다음 checker 의 제안을 못 막는다. 그래서 `_parse_frontmatter_code`
      > 의 블록 리스트 루프가 **빈 줄·`#` 주석을 건너뛰도록** 고쳤다(`break` 는 다음 키에서만).
      >
      > | | 수정 전 | 수정 후 |
      > |---|---|---|
      > | 게이트 파서가 본 entry | 690 | **731** |
      > | 진짜 YAML(gray-matter) entry | 731 | 731 |
      > | 답이 갈리는 파일 | 7 | **0** |
      >
      > 회귀 테스트 3건 — 주석 · 빈 줄 · **다음 키에서는 여전히 멈춘다**(넓힌 술어의 반대
      > 방향 대조군). 앞 둘은 수정 전 RED, 셋째는 수정 전에도 GREEN 이라 과확장 방지용이다.
      > harness 스위트 1,124 pass + 1,254 subtest.
      >
      > **7개 파일은 손대지 않았다** — 고칠 것이 문서가 아니라 파서였기 때문이다. 파서가
      > 고쳐지자 41개 entry 가 그대로 살아났다.

      (b) 가 저렴하지만, 12 대 6 이면 다수가 로컬 Overview 를 두고 있어 (a) 가 관행에 가깝다.
      **한 PR 이 단독으로 정할 일이 아니라 등재한다.**

- [x] **§2.2 자원 액션 패턴** — 반영 완료 (`spec-draft-scope-and-anchor-drift.md` ③). 이름이 틀렸었다: 33개 액션 중 9개가
      하이픈 복합 동사구라 "단일 동사" 로 성문화하면 27%가 즉시 위반이 된다. 실제 규칙은
      **목적어의 위치**다. 종전 서술: (`--spec` W2). `3-workflow-editor/3-execution.md:757` 이
      이미 그 존재를 전제하는데 §2.2 에 문서화가 없다. **이번 범위는 `/api/auth/*` 뿐**이라
      분리한다 — 그쪽은 다른 영역의 경로 패턴이고 실측부터 다시 해야 한다.
- [x] **§5.4 "응답 바디 한정" 스코프 문구** — 반영 완료 (`spec-draft-scope-and-anchor-drift.md` ①). PATCH tri-state 를
      명시적으로 제외해 아래 drift 배치가 부분 업데이트 계약을 깨지 않게 했다. 종전 서술:
      (planner, `--impl-done` `11_33_21` cross_spec).
      현재는 섹션 nesting(`## 5. 응답 형식`)으로만 암시돼 있어, 요청 DTO 에 이 규칙을 적용하는
      오독이 실제로 일어났다 — 이 세션이 `llmConfigId`(요청 DTO) 정정을 CHANGELOG 에서
      *"형태는 §5.4 를 따랐다"* 라고 적었다가 되돌렸다. 요청 바디의 tri-state(키 생략=불변,
      `null`=초기화, 값=설정)는 이 절의 적용 대상이 아니며 optional+nullable 이 정당하다는
      것을 본문에 명시한다.
- [x] **`spec/2-navigation/3-schedule.md` §2.1** `next_run_at` NULL 표시 규칙 — 반영 완료
      (`spec-draft-scope-and-anchor-drift.md` ②). FE 는 이미 `-` 로 방어 중이었고 문서만 낡아 있었다. 종전 서술:
      (`--spec` INFO#2). FE 는 이미 `-` 로 방어 중이라 동작 위험은 없다.

- [x] **`trigger-config` advisory lock 이 남긴 planner 범위 5건** (planner, 2026-09-15 등재,
      `--impl-done` `review/consistency/2026/09/15/01_44_29` W1·W2·W3·W5 + INFO#1).
      근거 문서는 `plan/complete/trigger-config-lost-update.md` §D 표다 — **그 plan 이
      `complete/` 로 봉인되면서 유일한 근거가 봉인된 문서 안으로 들어갔기 때문에** 여기로
      옮겨 적는다. developer 가 고칠 수 없는 `spec/` 쓰기들이다.

      | # | 항목 | 왜 planner 인가 |
      |---|---|---|
      | ~~1~~ ✅ | `spec/5-system/15-chat-channel.md` frontmatter `code:` glob 이 신규 `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 를 안 문다 | 그 문서의 **R-CC-22** 가 *"명시 경로가 새 파일을 세 번 놓쳤다"* 며 glob 으로 바꾼 바로 그 결함의 **네 번째 재발**이다. 새 파일이 `chat-channel-*`·`trigger-callback-url*` 어느 glob 에도 안 걸린다 → glob 확장 또는 명시 경로 추가 + §7 tree 동반 갱신 |
      | ~~2~~ ✅ | `spec/conventions/redis-keys.md §4`(인접 네임스페이스)에 advisory lock 키 계열 미등재 | `trigger-config:<id>` 와 **자매 사례** `exec-cap:<workspaceId>`(`execution-engine.service.ts`)를 **함께** 올려야 한다. §4 는 정확히 이 혼동(«Redis 아닌데 Redis 키처럼 생겼다»)을 막으려는 절인데 정작 lock key 계열이 비어 있다 |
      | ~~3~~ ✅ | `spec/5-system/15-chat-channel.md §5.4.1.1` 표와 바로 아래 각주가 **서로 모순** | 표는 *"v1 미정의 · PATCH 는 signing 값을 바꾸지 않는다"*, 각주는 *"실제 구현은 매 PATCH 마다 회전 강제"*. spec 본문끼리의 충돌이라 구현으로 못 닫는다. 이번 PR 이 다룬 `inboundSigningRef` 와 같은 필드다 |
      | ~~4~~ ✅ | advisory lock 키 **인벤토리 문서 자체가 없다** | 2번의 상위 항목 — 계열이 늘어날 때 어디를 보고 충돌을 피하는지가 정해져 있지 않다 |
      | ~~5b~~ ✅ | **`spec/data-flow/11-workflow.md §3.1` 상태 다이어그램의 CASCADE 열거에 `trigger` 가 없다** | 2026-09-15 추가. `trigger.entity.ts:39,46` 이 `Workflow`·`Workspace` 에 `onDelete: 'CASCADE'` 를 걸고 있고 `V001__initial_schema.sql:146` 부터 그랬는데, 다이어그램은 그 상류 경로를 안 적는다(`2-trigger-list.md §4.3` 은 **반대 방향만** 서술). 이 사실이 위 developer 항목 5 의 결함 근거이기도 하다 — **문서에 없으니 아무도 그 경로를 세지 않았다.** `--impl-prep` `review/consistency/2026/09/15/08_58_18` cross_spec W1. 2차 파급(`schedule`)도 함께 |
      | ~~5~~ ✅ | 전역 **32비트** 키 공간 공유 메모 | `pg_advisory_xact_lock(hashtext(...))` 의 `hashtext` 는 int4 를 낸다 — 접두어가 달라도 전 도메인이 **한 공간**을 쓴다. 충돌해도 과직렬화뿐이라 무해하지만 **어디에도 적혀 있지 않다**. 계열 3개 이상이 되는 시점의 재검토 신호로 남긴다 |

      > **✅ 2026-09-17 해소** — planner 턴 `plan/complete/spec-draft-trigger-lock-gaps.md`
      > (`--spec` `review/consistency/2026/09/17/12_25_46` **BLOCK: NO**). **착수 전 실측에서 셋이
      > 이 표의 문면과 달랐다**:
      >
      > - **1** 은 `15-chat-channel.md` glob 확장이 아니라 **`2-trigger-list.md` 로 재배정**했다 —
      >   소비자가 chat-channel·notification·EIA·schedules 에 걸치고, **이 락을 서술하는 spec 이
      >   어디에도 없어** `code:` 에만 올리면 대조할 본문이 없었다. §3 에 동시성 계약을 서술하고
      >   그 문서의 `code:` 에 올렸다.
      > - **2** 의 키 모양이 좁았다 — `exec-cap` 은 `workspaceId ?? workflowId` 다.
      > - **3** 은 모순이 아니었다 — 각주가 R-CC-21 이 고친 결함을 **과거형**으로 적은 이력이고
      >   현재 코드는 표와 일치한다. 원문은 보존하고 시제만 명시했다.
      > - **5b** 는 `trigger` 하나가 아니라 **넷**(`trigger` · `integration_usage_log` ·
      >   `alert_rule` · `workflow_test_dataset`)이 빠져 있었다 — `REFERENCES workflow(id)` 전수로
      >   고쳤다.
      >
      > **이 항목이 여기 있는 이유 자체가 교훈이다.** 5건은 원래 plan §D 에만 있었고,
      > `--impl-done` 이 *"이 plan 이 봉인되면 유일한 근거 문서가 사라진다"* 로 잡았다
      > (전수 grep 결과 `pending_plans:`·다른 `plan/in-progress/**` 어디에도 0건).
      > **조건부·후속 처분은 봉인되는 `complete/` 말고 살아 있는 트래커에 적는다.**


- [ ] **`trigger-config` advisory lock 이 남긴 developer 범위 후속** (developer, 2026-09-15 등재,
      `/ai-review` `review/code/2026/09/15/01_42_04` W1 + INFO 다수 ·
      `--impl-done` `review/consistency/2026/09/15/01_44_29` W4).
      **전체 목록은 `plan/complete/trigger-config-lost-update.md` 의 `### 후속(developer 범위)`
      표**에 있다 — 봉인된 문서라 여기에 **진입점**을 둔다(바로 위 planner 항목과 같은 이유).
      그중 이번 종결 라운드에 새로 나왔거나 성격이 바뀐 것만 적는다:

      | # | 항목 | 성격 |
      |---|---|---|
      | 1 | `TriggersService.remove()` 와 `SchedulesService.remove()` 의 «락 → 삭제 → 실패 로깅 → 재던짐» 블록이 복제돼 있다 → `deleteTriggerRowLocked(manager, id, {...})` | 14라운드 **W1**(유일한 WARNING). 리뷰어가 «즉시 차단 사유 아님» 으로 분류했고 두 자리 모두 뮤턴트 고정 테스트가 있다. **세 번째 호출부가 생길 때** 뽑는다 — 지금 뽑으면 인자 셋짜리 헬퍼가 복제보다 읽기 어렵다. **→ 2026-09-17 조건 충족**: 워크플로·워크스페이스 삭제가 «트랜잭션 → 실패 로그(외부 해제는 이미 끝났다) → 재던짐» 을 더해 **네 자리**가 됐다(`plan/complete/trigger-deletion-release.md` 리뷰 2라운드 W5). 네 자리의 상태가 달라(트리거 5초 락 · 스케줄 BullMQ · 부모 트랜잭션) 공용 형태는 설계가 필요하다 — «트랜잭션 오프너가 콜백 전에 잠금 상한을 건다» 계약(리뷰 3라운드 INFO 1·3)도 함께 흡수. **2026-09-20**: 그 네 자리 중 둘(워크플로·워크스페이스)이 이제 «잠금 → `parentPresence` 검사 → 404 → catch 에서 `NotFoundException` 구분» 4단을 **글자 그대로 복제**한다(`plan/complete/dup-delete-audit.md`) — 이 PR 안에서 실제로 한 번 어긋났다가 리뷰가 잡았다. 공용 형태는 그 4단과 반환 계약 `{ parentPresence, triggerIds }` 를 전제로 설계한다 |
      | ~~2~~ ✅ | private `findByIdForUpdate` 개명(예: `findByIdForPatchValidation`) | 이 저장소에서 `*ForUpdate` 는 **진짜 행 잠금**(`SELECT … FOR UPDATE`) 관용구인데 이건 잠금 없는 경량 조회다. 바로 위 JSDoc 이 *"저장·응답 엔티티는 락 안에서 다시 읽는다"* 를 이미 적고 있어 오신뢰 여지는 좁고 private 라 파급도 이 파일 안이다 |
      | ~~3~~ ✅ | `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 의 «정리 3종» 나열을 경로 비특정으로 일반화 | 14라운드 INFO#17. **CHANGELOG 쪽 절반은 이미 고쳤다** — 같은 정정의 `codebase/**` 절반만 남았다 |
      | ~~4~~ ✅ | `acquireTriggerConfigLock` 의 `timeoutMs` 를 `Number.isFinite` + 상한 clamp 로 검증 | 14라운드 INFO#2. `SET LOCAL lock_timeout` 이 파라미터 바인딩 없는 보간이지만 호출부가 **모듈 상수만** 넘겨 현재 익스플로잇 불가 — 방어 심도 |
      | ~~5~~ ✅ | `rewriteTriggerConfigLocked` 가 `update()` 의 `affected` 를 확인하지 않는다 | 14라운드 INFO#19. ~~삭제 경로 둘이 **같은 락을 공유**해 실무적으로 닫혀 있고, 계약을 코드로 드러내는 일이 남았다~~ → **2026-09-15 실측으로 반증**: 삭제 경로는 **셋**이고 세 번째(`Workflow`·`Workspace` 삭제의 FK `onDelete: 'CASCADE'`)는 **DB 레벨이라 advisory lock 을 애초에 잡을 수 없다**. 0행 UPDATE 가 도달 가능하므로 «계약 노출» 이 아니라 **좁은 실결함**이다 (`--impl-prep` `review/consistency/2026/09/15/08_58_18` plan_coherence W3 가 이 줄을 지목했다) |
      | ~~6~~ ✅ | `SchedulesService.remove()` 의 `triggerId` falsy 분기 테스트 1건 | 14라운드 INFO#16. 선재 가드절이라 회귀는 아니다 |
      | ~~7~~ ✅ | **창 1(`TriggersService.update()` 의 인라인 `save()`)이 FK CASCADE 창에 대해 미검증** — **2026-09-17 해소** (`plan/complete/trigger-save-partial-patch.md`). 운영 훅 없이 TypeORM 을 실제 Postgres 에 붙여 재현: CASCADE 창은 **시끄러운 실패**(롤백·부활 없음)로 실측, 그리고 같은 측정에서 **락 밖 컬럼 쓰기를 되돌리는 실결함**이 드러나 부분 객체 `save` 로 고쳤다. 원문: | 2026-09-15 추가. 창 1 만 `rewriteTriggerConfigLocked` 를 안 거치므로 `affected` 판정의 보호를 못 받는다. **실패 방식이 추정이다** — `save` 가 사라진 행을 INSERT 로 되살릴 때 부모(`workflow`)도 없으니 FK 위반으로 시끄럽게 실패할 것으로 보이나 **재지 않았다.** 결판내려면 **재읽기와 저장 사이를 멈추는 프로세스 내부 훅**이 필요하다(락은 읽기 *전에* 잡혀서 바깥에서 그 창을 못 연다) — 이 저장소의 boot-only e2e 훅 관례(`NODE_ENV`+FLAG 이중 게이트)를 따르면 된다. `/ai-review` `review/code/2026/09/15/09_30_03` W2 |
      | ~~8~~ → | **2026-09-17 흡수** — `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D5(쓰기 경로 보상) 의 구현 자리가 됐다. 구현은 아래 «트리거 행을 없애는 모든 경로의 자원 정리» 항목. 원문: `rewriteTriggerConfigLocked` 반환값을 **여전히 무시하는 호출부 2곳** | `normalizeNotificationSecretRef`(create/update 경유) · `chat-channel-binder.service.ts` 의 degraded fallback. 새 `affected` 판정이 `false` 를 돌려줘도 아무도 안 본다 — 같은 클래스의 잔여 표면 (같은 세션 INFO#3) |
      | ~~9~~ → | **2026-09-17 흡수** — 8 과 같은 D5. 원문: `rotateBotToken` 의 secret store 쓰기가 `affected` 판정보다 **먼저, 트랜잭션 밖에서** 일어난다 | HTTP 응답 계약(404)은 닫혔지만 «secret store 에는 새 토큰, DB 에는 행 없음» 의 보상은 안 닫혔다. 5라운드 W1(secret store 원자성)과 같은 자리 (같은 세션 INFO#4) |
      | 10 | `rewriteTriggerConfigLocked` 의 `@returns` JSDoc + 전용 spec 의 suite JSDoc 이 신규 2분기를 반영 안 함 | 「쓰지 않을 거면 계산도 안 한다」는 `!fresh` 분기에만 해당한다는 것도 한 줄 (같은 세션 INFO#7·#12) |
      | 11 | 테스트 미세 보강 — `-Infinity` fixture · clamp 경계값(`1`/`60000`) 명시 · `it.each` 통일 | 낮은 우선순위 (같은 세션 INFO#10·#11) |

      > **✅ 2026-09-15 — 2~6 해소** (`plan/complete/trigger-lock-followups.md`,
      > 브랜치 `claude/trigger-lock-followups-0c79a0`). 그중 **5 는 착수 전 전제 실측에서
      > «정리» 가 아니라 좁은 실결함으로 성격이 바뀌었다** — 삭제 경로가 셋이고 세 번째(FK
      > CASCADE)는 advisory lock 을 애초에 못 잡는다. **1 은 조건부 유예 유지**(세 번째
      > 호출부), **7~11 은 그 라운드에서 새로 등재**.
      >
      > **이 항목과 바로 위 planner 항목이 같은 사고에서 나왔다.** `--impl-done` 이
      > *"이 plan 이 봉인되면 근거 문서가 사라진다"* 로 잡았고, 그 판단은 developer 범위
      > 표에도 그대로 적용된다 — 그쪽은 체커가 지목하지 않았지만 **같은 이유로 죽는다.**


- [x] **트리거 행을 없애는 모든 경로의 자원 정리를 구현한다** (developer, 2026-09-17 등재 · **2026-09-17 구현** `plan/complete/trigger-deletion-release.md` ·
      spec 결정 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D1·D3~D6 · `--spec` `review/consistency/2026/09/17/17_20_54`).
      **워크플로·워크스페이스 삭제는 트리거의 외부 자원을 하나도 해제하지 않고, 스케줄 삭제는 비밀을
      지우지 않는다** — 트리거 행을 지우는 경로 넷 중 `TriggersService.remove()` 만 정리한다. 위 항목
      8·9 를 흡수했다. 계약 SoT 는 `spec/2-navigation/2-trigger-list.md` §3(«쓰지 못했으면 되돌린다»)·
      §4.3(표 다음 문단)·§4.4.

      | # | 할 일 |
      |---|---|
      | 1 | `WorkflowsService.remove()` — 트랜잭션 **전** 외부 해제 · 트랜잭션 안에서 `workflow` 행 `pessimistic_write` → 트리거 id 열거 → 삭제 · 커밋 **뒤** 트리거마다 `deleteByPrefix` |
      | 2 | `WorkspacesService.deleteWorkspace()` — 같은 모양. 워크스페이스 행 잠금은 이미 있으니 그 뒤 열거만 더한다 |
      | 3 | `SchedulesService.remove()` — 행 삭제 커밋 뒤 `deleteByPrefix`(알림 서명 비밀. `notification` 은 DTO 에 타입 제한이 없다) |
      | 4 | `TriggersService.remove()` — `deleteByPrefix` 를 락·행 삭제 **뒤로** 옮기고, 실패 로그의 «secret 삭제는 이미 끝났다» 문구를 고친다 |
      | 5 | 쓰기 경로 보상 — 락 안 재기록이 `false` 면 provider teardown(best-effort) 뒤 `deleteByPrefix`. 호출부는 목록으로 받지 말고 `rewriteTriggerConfigLocked` 호출부 + 락 밖 `secrets.store`/`rotate` 호출부를 **전수 grep** 해 짝지어라 (위 8 의 2곳 · 9 의 `rotateBotToken` 은 출발점일 뿐) |
      | 6 | e2e — 워크플로·워크스페이스 삭제 뒤 `secret_store` 0행 · schedule job 해제. 동시 회전의 보상은 **재진입으로 인터리빙 지점을 고정**해 재현(편한 지점에서 끊으면 진짜 결함도 초록) |

      > **착수 첫 판단은 협력자의 모듈 위치다.** `WorkflowsModule → TriggersModule` 간선은
      > `TriggersModule → SchedulesModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule` 과
      > 순환을 만든다. `#676`(`e827ed2a7`)은 `chat-channel→triggers` 역방향 의존을 **일부러 끊어**
      > `forwardRef` 순환을 없앤 선례다 — 새 간선을 `forwardRef` 로 때우지 말고 위치부터 정한다.
      >
      > **구현 뒤 planner 후속**: `spec/5-system/15-chat-channel.md` R8 의 «(또는 `TriggersService.remove`)»
      > 괄호를 실제 listener registry 해제 호출부로 넓힌다 — 호출부가 늘어난 뒤의 실측과 함께.
      >
      > **부수 주의 둘**: 커밋 뒤 정리 단계는 이미 지워진 `workspace_id` 를 참조하는 감사 행을 남기지
      > 않는다(FK 위반) · 새 `deleteByPrefix` 호출부도 prefix 를 UUID 로 조립한다(LIKE 메타문자 거부
      > 불변식의 전제). **남는 창 셋**(외부 자원 쪽 둘 · 커밋과 정리 사이 프로세스 종료)은 draft D7 —
      > 이 항목이 닫지 않는다.


- [x] **트리거 삭제 자원 정리 구현이 머지된 뒤 spec 을 현재형으로** (planner, 2026-09-17 등재 · **2026-09-18 종결** `plan/complete/spec-draft-deletion-release-current-tense.md` · `--spec` `review/consistency/2026/09/18/09_58_25`·`review/consistency/2026/09/18/10_18_33`(BLOCK: YES) → `review/consistency/2026/09/18/10_32_27`(**BLOCK: NO**) ·
      `plan/complete/trigger-deletion-release.md` · `/ai-review` `review/code/2026/09/17/18_45_09`·`review/code/2026/09/17/19_14_29`·`review/code/2026/09/17/19_40_27` [SPEC-DRIFT] · `--impl-prep` `review/consistency/2026/09/17/18_00_19`).
      spec 은 구현 **전에** 계약을 세웠다(#1345). 구현이 머지되면 다음이 거짓이 된다:

      | # | 자리 | 할 일 |
      |---|---|---|
      | 1 | `spec/2-navigation/2-trigger-list.md` §4.3 표 다음 문단 | «그 전까지는 트리거 화면 삭제만 …» 과도기 괄호 삭제 · 잔여 목록에 **워크스페이스 선검사 뒤 역할 변경**(외부 해제 뒤 재검사 거부 — error 로그로 드러난다) 추가 |
      | 2 | 같은 문서 §4.4 «락 대기 상한 5초» | 워크플로·워크스페이스 삭제의 **부모 행 잠금**에도 같은 상한이 걸린다(구현: `lockParentAndListTriggerIds` 가 트랜잭션 첫 호출로 `SET LOCAL lock_timeout`) |
      | 3 | `spec/data-flow/10-triggers.md` §1.4 · `11-workflow.md` §2.1·§3.1 · `12-workspace.md` §1.10·§2.1 | «미구현 (Planned)» 태그 제거 |
      | 4 | `spec/conventions/secret-store.md` frontmatter | `status: partial` → `implemented`, `pending_plans` 정리 |
      | 5 | `spec/5-system/15-chat-channel.md` R8 | «(또는 `TriggersService.remove`)» 괄호를 실제 해제 호출부(`TriggerResourceReleaserService` — 트리거·워크플로·워크스페이스 삭제)로 |
      | 6 | `spec/5-system/4-execution-engine.md` §4.4 지연 해석 표 | `ModuleRef.get(…, { strict: false })` 의 **던지는** 사례(트리거 자원 정리 — 못 찾으면 no-op 이 아니라 던진다) 행 추가 |
      | 7 | `spec/2-navigation/2-trigger-list.md` frontmatter `code:` | 정리 계약을 시행하는 `trigger-resource-release.ts` · `trigger-resource-releaser.service.ts` 와 증거 e2e `test/trigger-deletion-releases-resources.e2e-spec.ts` 등재(`--impl-done` `review/consistency/2026/09/17/19_55_46` W1) |

      > **처분 (2026-09-18)** — 1·2·3·4·5·7 행은 draft C1~C9 로 반영. **6 행은 하지 않는다**: 엔진 표의 `ModuleRef` 행은
      > **DI 인스턴스화 순서 함정**이 기준인데 트리거 정리의 지연 해석은 **모듈 import 순환**을 새 `forwardRef` 없이 피하려고
      > 골랐다 — 넣으면 엔진 표가 저장소 전체 규약처럼 읽힌다. «못 찾으면 던진다» 는 `trigger-resource-release.ts` 의
      > `TRIGGER_RESOURCE_RELEASER` JSDoc 이 SoT 로 이미 말한다.
      > **4 행이 규칙을 하나 낳았다** — `secret-store.md` 승격은 이 트래커가 `in-progress/` 에 남은 채로 일어난다(1회차 CRITICAL).
      > 이 트래커를 가리키는 열린 항목 6개가 모두 «미구현 surface» 가 아님을 전수로 판정하고, 그 판정 절차를
      > `spec/conventions/spec-impl-evidence.md §3.1` 자식 불릿 + R-11 로 규약에 올렸다 — 이 트래커를 `pending_plans` 로 가리키는
      > 남은 문서(`2-trigger-list.md` · `chat-channel-adapter.md`)도 승격할 때 같은 절차를 따른다.

- [ ] **트리거 자원 정리의 사후 정리(sweeper) 필요 여부 재판단** (developer + 결정, 2026-09-17 등재 ·
      `plan/complete/trigger-deletion-release.md` · spec draft «안 하는 것» · `/ai-review` `review/code/2026/09/17/18_45_09` #3·#13 · `review/code/2026/09/17/19_40_27` W1).
      정리 계약이 **닫지 않는 창**에서 남는 것을 치울지 판단한다 — 발생 빈도를 재기 전에는 만들지 않는다:
      - 부모 삭제의 외부 해제 **스냅샷 뒤·부모 잠금 전**에 생긴 트리거의 schedule job · provider 등록 · listener
        (비밀은 잠금 뒤 열거가 덮는다. 닫으려면 외부 해제를 커밋 뒤로 옮겨야 하는데 schedule 행이 CASCADE 로 사라져 job id 를 못 찾는다)
      - 외부 해제 뒤·행 삭제 전에 동시 요청이 다시 만든 provider 등록 · schedule job (spec D7-2)
      - **동시 DELETE 두 건이 같은 트리거에 대해 `releaseExternal` 을 각각 부른다** — 락 밖·무락
        선조회 뒤라 둘 다 실행되고, provider teardown·BullMQ job 해제가 같은 대상에 두 번 호출된다.
        `/ai-review` `review/code/2026/09/20/22_07_23` side_effect·concurrency WARNING 1 이 소스를
        직접 확인 — best-effort·실패 삼킴이라 500 이나 처리 중단으로는 안 이어지지만(`trigger-dup-delete.md`
        가 감사 중복만 닫고 이 중복은 그대로 둔 것과 같은 멱등 전제), provider API 에 대한 **중복 호출 자체는
        남는다**. 신규 e2e(`trigger-delete-concurrency.e2e-spec.ts`)는 chatChannel 없는 webhook 트리거만
        써서 이 경로를 검증하지 않는다 — 재는 대상에 넣을 것
      - 행 삭제 커밋과 비밀 정리 사이의 프로세스 종료, 그리고 커밋 뒤 비밀 삭제 실패(error 로그만 남는다)
      - 워크스페이스 삭제의 **권한 선검사 → 외부 해제 → 잠금 재검사 거부**(그 사이 역할 변경) — 워크스페이스는 남는데 그
        트리거들의 외부 등록은 이미 해제돼 발화하지 않는다(error 로그로 드러난다). #1345 의 D7 목록 밖에서 구현이 권한 검사를
        앞으로 당기며 생긴 창이다 — spec 트리거 목록 §4.3 이 2026-09-18 부터 서술한다(`plan/complete/spec-draft-deletion-release-current-tense.md` C1, `--spec` 3회차 INFO 5)
      - 이미 남아 있는 고아 — 이 구현 **이전**의 워크플로·워크스페이스 삭제가 남긴 `secret_store` 행 · BullMQ job
      **재는 방법**: `secret_store` 에서 `ref` 의 트리거 id 가 `trigger` 에 없는 행 수, BullMQ `schedule-execution` 의
      job scheduler 중 `schedule` 행이 없는 수. **판별 주의**: job scheduler 존재는 `Queue.getJobScheduler(id)` 로 보지
      마라 — `:` 가 든 id 는 해제 뒤에도 껍데기를 돌려준다(`getJobSchedulers` 의 key 소속으로).

- [ ] **부모 삭제 경로의 성능 후속** (developer + planner, 2026-09-17 등재 · `plan/complete/trigger-deletion-release.md` · `/ai-review` `review/code/2026/09/17/19_14_29` W1·W3·W4·INFO7).
      - ✅ **2026-09-18 해소** (`plan/complete/spec-draft-trigger-workflow-index.md` · V111 `idx_trigger_workflow_id` · `spec/1-data-model.md` §3 행 + Rationale — 320k 트리거에서
        열거 7.52 → 0.04 ms · CASCADE 11.05 → 0.05 ms).
        `trigger.workflow_id` 에 인덱스가 없다(실측: `trigger` 인덱스는 `(workspace_id, type)` · `(workspace_id, endpoint_path)` ·
        `notification_health` 부분 셋). 워크플로 삭제의 FK CASCADE 가 이 PR 전부터 이 컬럼으로 스캔했고, 정리 구현이 같은 스캔을
        두 번 더 한다(하나는 부모 잠금 안). `V106` 과 같은 `CREATE INDEX CONCURRENTLY` 마이그레이션 + **`spec/1-data-model.md`
        인덱스 표 행**(planner) 을 한 PR 로.
      - 커밋 뒤 비밀 삭제가 트리거마다 순차(실패를 개별 로그하려고), provider teardown·job 해제도 순차(provider 에 요청이 몰리지
        않게) — 대량 삭제 지연이 트리거 수에 선형이다. «부모 하나의 트리거 수가 작다» 는 **실측되지 않은 가정**이다.
      - ✅ **2026-09-18 해소** (`plan/complete/spec-draft-trigger-workflow-index.md` — `select: { id, type, config }`, 단위 테스트가 선택 컬럼을 정확히 고정).
        `releaseExternalForParent` 가 트리거 전체 컬럼을 적재한다 — `select: { id, type, config }` 로 좁힐 수 있다.
      > **남은 것은 둘째 불릿(순차 처리 지연) 하나다** — V111 은 테이블 전체 크기에 따른 비용을 없앨 뿐, 부모 하나에 딸린
      > 트리거 수에 따른 비용은 그대로다. «부모 하나의 트리거 수가 작다» 는 여전히 미실측 가정이다.

- [ ] **`2-trigger-list.md` `code:` 에 `trigger-resource-releaser.service.spec.ts` 를 등재한다** (planner, 낮음, 2026-09-18 등재 ·
      `--impl-done` `review/consistency/2026/09/18/13_16_03` INFO 1). 트리거 목록 §4.3 의 정리 계약 중 «부모 삭제의 외부 해제가 읽는
      컬럼(`id`·`type`·`config`)» 을 실행 단언으로 고정하는 것이 그 spec 파일이다(`find` 인자 정확 대조 — `config` 가 빠지면 teardown 이
      조용히 no-op). 지금 `code:` 는 서비스와 e2e 만 등재한다. 글로브 `trigger-resource-release*.ts` 로 묶는 안도 있다.

- [ ] **캔버스 저장이 노드를 빼면 그 노드의 실행 이력이 사라진다 — 보존 정책 결정 필요** (planner + 결정, 낮음, 2026-09-18 등재 ·
      `--impl-done` `review/consistency/2026/09/18/14_23_35` INFO 2 · `plan/complete/spec-draft-deletion-cascade-indexes.md` «비대상»). `node_execution.node_id` 가 `ON DELETE CASCADE` 라
      캔버스에서 노드를 지우고 저장하면 그 노드의 과거 실행 이력(`node_execution`)과 거기 딸린 `integration_usage_log` 가 함께 지워지고,
      `llm_usage_log` 는 `node_execution_id` 만 NULL 이 된다. 트리거 삭제가 `execution.trigger_id` 를 SET NULL 로 두어 이력을 보존하는
      것(트리거 목록 §4.3)과 방향이 다르다. 새 결함이 아니라 기존 동작이다 — 인덱스 PR 이 비용을 재다 정량화했을 뿐이다. 결정할 것: 노드 삭제가
      실행 이력을 지우는 것이 의도인가(SET NULL 로 바꾸면 `node_id` NOT NULL 부터 바뀐다).

- [x] **선두 인덱스가 없는 FK — 부모를 한정하지 않은 전수 37개(셈법 보정 40개) 전부 처분** (developer + planner, 2026-09-18 등재 · **2026-09-18 해소** `plan/complete/spec-draft-fk-remaining-dispositions.md` ·
      **2026-09-18 전제 정정** `plan/complete/spec-draft-deletion-cascade-indexes.md`). 처음엔 부모를 `workflow`·`workspace` 둘로 한정해 «여섯» 이라 적고 «`integration_usage_log` 우선»
      이라 했는데, 재 보니 그 FK(`integration_usage_log.workflow_id`)는 워크플로 삭제 한 번에 0.55 ms 였다. 부모를 한정하지 않으면 단일 컬럼 FK
      87개 중 **37개**가 선두 인덱스 없이 CASCADE·SET NULL·NO ACTION 을 건다. FK 트리거는 지워지는 부모 행마다 자식을 찾으므로 비용은
      «자식 테이블 크기 × 연쇄로 지워지는 부모 행 수» 다. **전수 표는 `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록이 SoT** 다.
      - ✅ **2026-09-18 해소 다섯**(V112~V116) — 캔버스 노드 삭제(저장마다)·워크플로 삭제 연쇄: 800k 규모 워크플로 삭제 2,225 → 6.96 ms,
        노드 하나 삭제 206.6 → 0.79 ms.
      - ✅ **2026-09-18 해소 넷**(V117~V120, `plan/complete/spec-draft-graph-fk-indexes.md`) — 그래프 RAG 의 청크·엔티티 삭제 연쇄:
        800k 청크 규모 KB 하나 삭제 129,941 → 48.1 ms, 재임베딩(문서 하나, 청크 40) 1,795.7 → 2.37 ms, 엔티티 하나 삭제 4.25 → 0.38 ms.
        `head_entity_id` · `tail_entity_id` 는 기존 `(knowledge_base_id, …)` 복합 인덱스가 skip scan 으로 쓰였지만 비용이 KB 수에 비례했다.
      - ✅ **2026-09-18 나머지 전부 처분** — 28개 + **셈법이 놓친 셋**(`indkey[0]` 만 대조해 조건이 다른 부분 인덱스도 «있음» 으로 셌다:
        `model_config.workspace_id` · `workspace.owner_id` · `notification.user_id`) = 31개. **인덱스 열**(V121~V130) · **비대상 스물하나**
        (사용자 삭제 경로 없음 13 · 10분 만료 일시 행 3 · 설정 테이블 한 동작 1회 5). 워크스페이스 1만 규모: 캔버스 저장의 노드 하나 삭제
        29.1 → 0.15 ms · 워크플로 삭제 306.8 → 1.8 ms · 워크스페이스 삭제 3,161 → 49.6 ms. 열 중 다섯(V126~V130)은 FK 보다 **목록 조회**가
        이유다. 앞 줄의 «`edge.target_node_id` 200k 에서 0.1 ms 미만» 은 엣지 약 1만 행 측정이었다 — 엣지 90만이면 노드 하나에 28.8 ms.

- [x] **웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다** (developer + planner, 낮음, 2026-09-18 등재 · `plan/complete/spec-draft-fk-remaining-dispositions.md` «비대상» ·
      **2026-09-19 해소** `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` — **성능 항목이 아니라 보안 결함이었다**).
      웹훅 POST 마다(`hooks.service` · `public-webhook-throttle.guard`)와 웹챗 `embed-config` 부팅마다 `trigger` 를
      `WHERE endpoint_path = ? AND type = 'webhook'` 로 찾는데, 인덱스는 `(workspace_id, endpoint_path) WHERE endpoint_path IS NOT NULL`
      UNIQUE 뿐이라 `workspace_id` 를 모르는 조회가 인덱스 전체를 훑는다. 등재 때 적은 «0.9 ms» 는 5만 행 UPDATE 직후 VACUUM 없이 잰 값이었다 —
      다시 재니 웹훅 트리거 1.25만 0.049 ms → 5만 0.200 ms(선형). **결정(사용자): 전역 유일** — `endpoint_path` 는 클라이언트가 만들어 보내고 바꿀 수도
      있어, 경로를 **알고 있는** 다른 워크스페이스가 같은 경로를 등록하면 수신 조회가 둘 중 하나를 골랐다(옛 스키마에서 가로채기 재현). V131 이 기존
      중복을 정리(가장 먼저 만든 쪽 유지 · 나머지 새 UUID · 채팅 채널은 NOTICE + 운영 절차)하고 V132 가 `(endpoint_path)` 전역 UNIQUE 로 교체한다.
      SoT: `spec/1-data-model.md` Rationale «Webhook `endpoint_path` 전역 유일». (기각: 비유일 보조 인덱스 + 앱 레벨 검사 — 동시 경합을 DB 가 막지 못한다.)

- [x] **지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다 — 묘비(tombstone) 부재** (planner + developer, 낮음, 2026-09-19 등재 ·
      `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` «비대상» · **2026-09-19 해소** `plan/complete/spec-draft-webhook-endpoint-reservation.md`
      — **결정(사용자): 영구** · 같은 워크스페이스는 재사용. 삭제 시점 묘비 대신 **사용 시점 예약**(V133 `webhook_endpoint_reservation`, 지우지 않음)을
      DB 트리거가 강제하고, 다른 워크스페이스는 살아 있는 경로와 같은 409. 경로 변경의 옛 경로도 같은 규칙 · 워크스페이스 삭제 뒤엔 주인 없는 예약.
      «실측 필요(수신 404 트래픽)» 는 영구로 정해져 불필요해졌다. 이미 지워진 경로는 기록이 없어 보호 밖. SoT: `spec/1-data-model.md` §2.8.1). 전역 UNIQUE(V132)는 **동시에 존재하는** 중복만 막는다 — 주인이
      트리거를 지우면 그 경로는 비고, 경로를 아는 누구든 자기 워크스페이스에 다시 등록할 수 있다. 외부 서비스가 옛 URL 로 계속 보내면 새 주인이
      받는다. 결정할 것: 지운 경로를 얼마나 오래 묶어 둘지(영구 · 기간) · 어디에 둘지(`trigger` soft-delete 행 · 별도 묘비 테이블) · 트리거를 **수정**해
      경로를 바꿨을 때의 옛 경로도 같은 규칙인지(`endpointPath` 는 mutable — 12-webhook «endpointPath 가변성»). 실측 필요: 지운 트리거의 경로로
      실제 트래픽이 계속 오는지(수신 404 로그).

- [x] **엔티티 컬럼 선언이 실제 DB 와 다른 아홉 곳 — 인덱스·제약 층은 닫혔고 컬럼 층이 남았다** (developer, 낮음, 2026-09-19 등재 ·
      `plan/complete/entity-schema-declaration-drift.md`(인덱스 · 제약 층, #1354) «비대상» · **2026-09-19 해소** `plan/complete/entity-column-declaration-drift.md`
      (컬럼 층) — 아홉 곳을 고치고 `entity-schema-declarations.e2e-spec.ts` 에 컬럼 층 가드(비교기 `log()` 를 읽기 전용 세션으로 · 컬럼 정의 문 0 ·
      예외 `embedding` 둘 · 실제 문장 표본으로 패턴 판별력). «선언 생략 vs 거짓 선언» 기준 = 비교기가 내는 컬럼 층 문은 전부 결함, 예외는
      선언 자체를 두지 않은 컬럼만(이유와 함께 목록에)). TypeORM `createSchemaBuilder().log()`(V001~V132, 동작 불변 — `synchronize: false`)가
      낸 컬럼 차이. 대부분 선언이 **생략**해 TypeORM 이 기본값을 추론한 것이다.
      ① uuid 를 varchar 로 추론 5 — 관계 없이 `@Column({ name })` 만 둔 FK 컬럼: `alert_rule.workspace_id` · `workspace_invitation.workspace_id` ·
      `integration_usage_log.node_execution_id` · `integration_usage_log.workflow_id` · `llm_usage_log.workspace_id`(DB 는 모두 `uuid NOT NULL`).
      ② enum 타입 이름 2 — `node.category`(DB `node_category`) · `edge.type`(DB `edge_type`), 엔티티에 `enumName` 없음.
      ③ 기본값 생략 2 — `model_config.kind`(DB `'chat'`) · `workflow_assistant_session.last_interaction_at`(DB `now()`).
      (선언하지 않은 `document_chunk.embedding` · `agent_memory.embedding`(`vector`)은 원시 SQL 로만 다루는 의도된 생략으로 보여 셈에서 뺐다.)
      결정할 것: 고칠지(각 한 줄 — `type: 'uuid'` · `enumName` · `default`), 고친다면 `entity-schema-declarations.e2e-spec.ts` 가드를 컬럼
      층(타입 · enum 이름 · 기본값)으로 넓힐지. 넓히면 «선언 생략» 과 «거짓 선언» 을 가르는 기준부터 정해야 한다(타입은 생략해도 추론값이 선언이 된다).

- [x] **`WorkflowAssistantSession` 엔티티의 `@Index(['workflowId', 'status', 'lastInteractionAt'])` 에 `userId` 가 빠졌다** (developer, 낮음,
      2026-09-18 등재 · `plan/complete/spec-draft-fk-remaining-dispositions.md` «비대상» · **2026-09-19 해소**
      `plan/complete/entity-schema-declaration-drift.md` — 같은 클래스를 전수로 훑으니 여덟 곳(인덱스 4 · 유니크 이름 1 · 만들 수 없는
      CHECK 2 · FK `onDelete` 1). 선언↔DB 대조 e2e 가드 `entity-schema-declarations.e2e-spec.ts` 로 고정). 실제 인덱스(V019)는 `(workflow_id, user_id, status, last_interaction_at DESC)` 다 —
      `spec/1-data-model.md` §3 의 같은 누락은 그 PR 이 정정했다. `synchronize: false` 라 DB 에 영향은 없고, 고치면 그 파일이
      `spec/3-workflow-editor/4-ai-assistant.md` 의 `code:` 에 걸려 `--impl-done` 범위가 는다 — 그 영역을 건드리는 다음 PR 이 함께 고친다.

- [ ] **`spec/conventions/` 3섹션 구조 편차** (planner, 낮음, 2026-09-18 등재 · `--impl-prep` `review/consistency/2026/09/18/22_44_08`
      WARNING 1 · 2). ① `migrations.md` 는 Rationale 이 `## 7. 폐기 대안 (Rationale)` 이라는 번호 붙은 절이고 그 뒤에 `## 참고` 가 온다 —
      나머지 conventions 는 bare `## Rationale` 이 종결 섹션이다. ② 최상위 23개 중 13개가 `## Overview` 를 생략한다(`node-output.md` 는 Rationale
      도 없다). 이 작업과 무관한 기존 상태로, checker 가 `spec/conventions/` scope 를 훑다 드러냈다. 결정할 것: 관례로 맞출지, 레퍼런스형
      규약은 예외로 둘지(예외라면 planner SKILL 의 3섹션 표에 적는다).

- [x] **`0-canvas.md` §8.1 «버전에는 자동 생성된 `change_summary` 포함» — 자동 생성이 없다** (planner, 낮음, 2026-09-19 등재 ·
      `plan/complete/spec-draft-assistant-i18n-table-sync.md` «비대상» · `--impl-prep` `review/consistency/2026/09/19/08_07_50` WARNING 2 ·
      **2026-09-19 해소** `plan/complete/spec-draft-code-guards-and-change-summary.md` — 사용자 결정 «spec 을 실제에 맞춘다». §8.1 정정 +
      R-5, 같은 사실을 약속하던 사용자 가이드 `05-run-and-debug/version-history`(ko · en) 도 정정).
      서버가 스스로 채우는 `changeSummary` 는 버전 복원의 `Restored from v${version}`(`workflows.service.ts`) 하나다. 저장 API 는 요청의
      `changeSummary` 를 그대로 저장하지만 프론트는 그 필드를 보내지 않는다(`codebase/frontend/src` grep — 응답 타입 · 표시 컴포넌트뿐).
      체커는 예시 문자열의 금지어 «엣지» 만 짚었다 — 금지어만 고치면 틀린 문장을 다듬는 셈이라 두었다. 결정할 것: 서술을 실제(수동 저장은
      요약 없음 · 복원만 자동 문구)로 고칠지, 자동 요약을 기능으로 정의할지(그러면 developer 구현).

- [x] **`spec/1-data-model.md` §2 Workspace `owner_id` 행이 삭제 동작을 적지 않는다** (planner, 낮음, 2026-09-19 등재 ·
      `--impl-prep` `review/consistency/2026/09/19/08_33_13` WARNING 1 · `plan/complete/entity-schema-declaration-drift.md` ·
      **2026-09-19 해소** `plan/complete/spec-draft-data-model-fk-actions.md` — «다른 행은 적는 관례» 라는 전제가 실측으로 반증됐다: §2 FK
      75행 중 적은 곳 26 · 안 적은 곳 49 · 틀린 곳 0. 49행 모두에 적었고, 같은 대조로 §2 에 없던 컬럼 여섯 · `re_run_of` 테이블명 ·
      §3 의 «loop» 오기를 함께 고쳤다. §3 Workspace 행 추가. `code:` 등재는 아래 새 항목으로 넘겼다).
      실제 FK 는 `ON DELETE CASCADE`(V001)이고 엔티티도 그 PR 부터 `{ onDelete: 'CASCADE' }` 를 적는다. 같은 파일의 다른 User FK 행
      (WorkflowTestDataset `owner_id` 등)은 삭제 동작을 괄호로 적는 관례다. `FK → User (ON DELETE CASCADE)` 로 맞춘다.
      같은 파일에서 함께 할 것(`--impl-done` `review/consistency/2026/09/19/09_27_19` INFO 3 · 4, 선택): §3 «인덱스 전략» 표에 Workspace
      행이 없다 — `(owner_id) UNIQUE WHERE type = 'personal'`(V109)은 Rationale · `data-flow/12-workspace.md` 에만 있다. frontmatter
      `code:` 에 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`(엔티티 선언 ↔ DB 대조 가드)를 넣을지.

- [x] **`spec/2-navigation/4-integration.md` §11.2 «중복 방지» 가 없는 컬럼으로 유일 키를 적는다** (planner, 낮음, 2026-09-19 등재 ·
      `--impl-done` `review/consistency/2026/09/19/09_27_26` WARNING 1 · **2026-09-19 해소** `plan/complete/spec-draft-data-model-fk-actions.md`
      — 세 컬럼 키 · «같은 만료 시각에 대해» 1회 · 재인증 시 재발사 · claim 방식을 data-flow §1.4 와 맞췄다). 1006행 «`(integration_id, threshold_key)` 로 유니크 판정» —
      `threshold_key` 컬럼은 없다. 실제 유일 키는 V009 의 `UNIQUE (integration_id, threshold, token_expires_at)` 이고
      `spec/data-flow/5-integration.md` 341행 · `8-notifications.md` 90행도 세 컬럼으로 적는다. `token_expires_at` 이 키에 들어 있어
      **재인증으로 만료 시각이 바뀌면 같은 임계가 다시 발사된다** — 두 컬럼 서술로는 이 동작이 나오지 않는다. 세 컬럼으로 정정하고 그 동작을 한 줄 적는다.

- [x] **`spec/1-data-model.md` frontmatter `code:` 에 이 문서를 지키는 e2e 가드를 넣을지 — 게이트 범위 결정** (planner, 낮음, 2026-09-19 등재 ·
      `plan/complete/spec-draft-data-model-fk-actions.md` «비대상» · `--spec` `review/consistency/2026/09/19/09_59_18` INFO 10 ·
      **2026-09-19 해소** `plan/complete/spec-draft-code-guards-and-change-summary.md` — 사용자 결정 «셋 다 넣는다». 카탈로그를 단언하는
      e2e 8개 중 기능 e2e 넷은 넣지 않았다(backend e2e 58개 중 `code:` 에 걸린 것 7개 — 그쪽이 정상). 이 문서의
      `code:` 는 엔티티 · 마이그레이션 glob 둘뿐이다. 이 문서를 지키는 e2e 가 셋 있다 — `deletion-cascade-indexes` · `trigger-endpoint-path-dedupe` ·
      `entity-schema-declarations`. 하나만 넣으면 어긋나고, 셋을 넣으면 그 파일들의 변경이 `--impl-done` 을 부르게 된다(다른 spec 은
      e2e 경로를 `code:` 에 넣은 선례가 있다 — `2-trigger-list` · `3-schedule` · `15-chat-channel` 등). 결정할 것: 넣을지, 넣는다면 셋 다.

- [ ] **AI 어시스턴트 사전 키 셋이 spec 에 없다 — «이어서 진행» 버튼의 기능 서술부터 없다** (planner, 낮음, 2026-09-19 등재 ·
      `plan/complete/spec-draft-assistant-i18n-table-sync.md` «비대상»). `dict/{ko,en}/assistant.ts` 의 `continueAfterBudget` ·
      `continueAfterBudgetButton`(«이어서 진행» 버튼과 그 버튼이 보내는 문구) · `exampleArrange`(예시 프롬프트)가
      `spec/3-workflow-editor/4-ai-assistant.md` 어디에도 없다. 본문(151 · 627 · 682행)은 사용자가 «이어서 진행해줘» 를 **직접 입력**하는
      안내만 적는다. §13 표에 키만 넣으면 기능 정의 없이 문자열만 생기므로, 버튼이 언제 보이고 무엇을 보내는지부터 적는다.

- [x] **트리거 자원 정리 구현이 남긴 stale 주석·이름 네 곳** (developer, 2026-09-17 등재 · **2026-09-18 해소** `plan/complete/trigger-release-stale-comments.md` — 넷 + 같은 클래스 전수 grep 으로 넷 더(락 상한 JSDoc 은 낡은 게 아니라 **틀렸다** — 비밀이 커밋 뒤로 옮겨간 것을 반영 안 했다) · `plan/complete/trigger-deletion-release.md` · `/ai-review` `review/code/2026/09/17/19_40_27` W4·INFO2 · `--impl-done` `review/consistency/2026/09/17/19_55_46` W2·W3 —
      수렴 예외로 등재). 넷 다 `codebase/**` 라 그 PR 안에서 고치면 리뷰·`--impl-done` 라운드가 늘었다.
      - `SecretResolverService.deleteByPrefix` JSDoc 의 «현재 프로덕션 호출부는 `triggers.service.ts` 한 곳뿐» — 실제 유일한
        직접 호출부는 `trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit`(네 삭제 경로 + 쓰기 보상이 그 함수를 지난다).
      - `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 의 소비자 예시가 트리거·스케줄 둘뿐 — 워크플로·워크스페이스 부모 잠금이 더해졌다.
        스스로 경고한 «목록은 낡는다» 대로 낡았으니 규칙으로 바꿀 것.
      - 테스트 주석 **한 곳**이 `review-citations.md §2` 가 금지하는 bare `hh_mm_ss` 로 리뷰를 인용한다(전수 grep) —
        `workspaces.service.spec.ts` 의 «선검사 뒤 역할 변경» 테스트 주석이 1라운드 리뷰를 시각만으로 가리킨다 —
        `review/code/2026/09/17/18_45_09` 전체 경로로.
      - `ChatChannelBinderService` 의 `teardownChannelConfig`(보상 경로 — 이번 요청이 등록한 설정)와 `teardownChatChannel`(저장된 설정)
        이름이 어순만 달라 grep·로그에서 헷갈린다 — `teardownRegisteredChannel` 류로.

- [ ] **`deleteByPrefix` JSDoc 의 호출부 서술을 호출부 수와 무관한 문장으로** (developer, 낮음, 2026-09-18 등재 ·
      `plan/complete/trigger-release-stale-comments.md` · `/ai-review` `review/code/2026/09/18/11_42_35` INFO 2·8).
      `secret-resolver.service.ts` 의 «LIKE 메타문자를 거부하는 이유» 가 안전 근거로 «프로덕션 직접 호출부는 한 곳» 을 날짜와 함께
      적는다 — 2026-08-09 `triggers.service.ts` → 2026-09-18 `trigger-resource-release.ts` 로 **두 번째 갱신**이었고 호출부가 늘면
      세 번째가 온다. 입력 거부(`secret://` 접두 · `% _ \`)가 이미 SoT 라 «호출부가 무엇을 넘기든 거부가 막는다» 로 쓸 수 있다.
      그 PR 에서 하지 않은 이유: `codebase/**` 주석이라 리뷰·e2e 가 한 라운드 더 돌고, 지금 문장은 날짜 달린 실측이라 거짓이 아니다.

- [x] **동시 중복 DELETE 가 감사 행을 두 번 남길 수 있다** (developer, 낮음, 2026-09-17 등재 · `/ai-review` `review/code/2026/09/17/18_45_09` INFO 19·21).
      워크플로 삭제 두 요청이 겹치면 둘 다 잠금 없는 `findById` 를 통과하고, 뒤 요청은 부모 잠금 뒤 `findOne` 이 `null` 인데도
      진행해 `workflow.deleted` 를 한 번 더 남긴다. **이 PR 전에도 같은 중복이 났다**(`findById` → `repository.remove`) — 데이터 손상은
      없다. 고친다면 `lockParentAndListTriggerIds` 가 부모 부재를 돌려주고 호출자가 404 로.
      **2026-09-20 해소** `plan/complete/dup-delete-audit.md`. 처방은 적힌 그대로다 —
      `{ parentPresence: 'present'|'absent', triggerIds }` 를 돌려주고 워크플로는 404(`RESOURCE_NOT_FOUND`)로 끝낸다.
      **워크스페이스 경로도 함께 닫았다**: plan 은 «그쪽은 잠금 뒤 재검사가 이미 덮는다» 고 적었는데 리뷰가 반증했다 —
      `assertWorkspaceDeletable` 이 «멤버십 → 존재» 순이라 진 쪽은 404 가 아니라 403 `OWNER_REQUIRED` + 거짓 «수동 정리
      필요» 로그를 받았다. 두 경로 모두 실 DB e2e 로 고정했고(`workflow-/workspace-delete-concurrency.e2e-spec.ts`),
      판별력은 뮤턴트로 실측했다(워크플로: 둘 다 204 + 감사 2건 재현 / 워크스페이스: 기대 404 자리에 403).
      반환 계약이 `{ parentPresence, triggerIds }` 로 바뀐 것은 위 «네 자리 공용 형태» 설계의 전제다.

- [x] **`TriggersService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다** (developer, 낮음, 2026-09-20 등재 ·
      `/ai-review` `review/code/2026/09/20/21_07_19` requirement WARNING 1). 위 항목을 닫으며 인용한 «트리거는 이미
      §4.4 대로 404 다» 는 **spec 서술이지 코드 실측이 아니었다**. 읽어 보니 같은 형태다: 무락 `findById` →
      `acquireTriggerConfigLock`(advisory lock, **행 락이 아니다**) → `m.remove(trigger)` → `recordAudit(TRIGGER_DELETED)`.
      락이 직렬화는 하지만 락 안에서 **행이 아직 있는지 보지 않으므로** 진 쪽도 0행 삭제를 성공으로 끝낸다.
      재현은 `workflow-delete-concurrency.e2e-spec.ts` 기법(테스트가 락을 쥔다)이 그대로 쓰이되, 행 락이 아니라
      **같은 advisory lock key** 를 쥐어야 할 수 있다 — 거기부터 실측할 것.
      **2026-09-20 해소** `plan/complete/trigger-dup-delete.md`. 처방대로 락 안 재조회(`!fresh` → 404)를 넣었다 —
      `[204, 204]`(감사 2건) → `[204, 404]`(감사 1건)를 e2e 로 실측했고 단위 뮤턴트 둘이 각각 새 테스트만
      죽인다. **닫은 범위는 트리거 한 자리뿐이다** — 그 plan 제목이 «네 자리 완결» 이라 과장했던 것을
      `/ai-review` `review/code/2026/09/20/22_07_23` requirement WARNING 2 가 짚었다: `SchedulesService.remove()`
      자신의 스케줄 행 삭제는 아직 안 닫혔다. 바로 아래 새 항목으로 등재한다.

- [x] **`SchedulesService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다** (developer, 낮음, 2026-09-20 등재 ·
      `/ai-review` `review/code/2026/09/20/22_07_23` requirement WARNING 2). 위 트리거 항목을 닫으며 `SchedulesService.remove()`
      를 다시 읽어 확인했다: `findById`(무락) → (있으면) 트랜잭션 안에서 `acquireTriggerConfigLock` + `m.delete(Trigger, triggerId)`
      로 **연결된 트리거만** 잠그고 지운다 — 그 뒤 트랜잭션이 커밋되고 나서야 `this.scheduleRepository.remove(schedule)`
      (`schedules.service.ts:345`)가 **락 밖·재조회 없이** 스케줄 자신의 행을 지운다. `triggerId` 가 없는 스케줄(순수
      스케줄)은 애초에 어떤 락도 거치지 않는다. 두 경우 모두 동시 DELETE 두 건이 겹치면 진 쪽도 `remove()` 가
      조용히 통과해 `SCHEDULE_DELETED` 감사를 한 번 더 남길 수 있다 — 트리거에서 고친 것과 같은 형태다.
      재현 기법은 `trigger-delete-concurrency.e2e-spec.ts` 를 따르되, **먼저 실측할 것**은 스케줄 삭제 경로에
      트리거처럼 걸어 잠글 advisory lock 이 애초에 없다는 점이다(트리거용 `trigger-config:<id>` 락은 연결된
      트리거가 있을 때만, 그것도 스케줄 행이 아니라 트리거 행만 보호한다) — 스케줄 자신을 위한 새 lock key 가
      필요한지부터 확인 후 처방을 정할 것.
      **2026-09-21 해소** `plan/complete/schedule-dup-delete.md`. 재현을 먼저 했다 — 고치기 전 e2e 가
      `[204, 204]` 였고 DB 에 `schedule.deleted` 2건이었다(고친 뒤 `[204, 404]` · 1건).
      **판정 기준이 형제 셋과 다르다**: `schedule.trigger_id → trigger` 가 `onDelete: CASCADE` 라 스케줄
      행은 이긴 쪽에서도 CASCADE 로 사라진다 — 스케줄 행 수로 판정하면 둘 다 404 가 된다. 락이 보호하는
      트리거 삭제의 `affected` 만이 판별자다(`triggerId` 없는 방어 분기는 CASCADE 가 없어 스케줄 행 자체).
      판정은 `=== 0` 명시 비교다(자매 함수 `rewriteTriggerConfigLocked` 의 기존 결정 — «모른다»(null)를
      «없다»(0)로 읽지 않는다). 그 이유를 붙드는 대조군도 넣었다: 없을 때 `!affected` 로 되돌리는 뮤턴트가
      32건 전건 GREEN 으로 살아남았고, 대조군 추가 후 2건 RED 가 됐다.

- [x] **`IntegrationsService.remove()` 도 동시 삭제에서 감사 행을 두 번 남긴다** ~~— 이 계열의 다섯 번째이자 남은 자리~~
      **2026-09-21 해소** (`plan/complete/integration-dup-delete.md`). 처방은 예고대로 원자적
      `delete({ id, workspaceId })` 의 `affected === 0` → 404 였다. e2e 로 먼저 재현했다 —
      고치기 전 `[204, 204]` · `integration.deleted` 감사 **2건**, 고친 뒤 `[204, 404]` · **1건**.
      **«다섯 번째이자 남은 자리» 라는 취소선 부분은 틀렸다** — 아래 `removeMember()` 가 여섯 번째다.
      (developer, 낮음, 2026-09-20 등재 · `plan/in-progress/schedule-dup-delete.md` 착수 전 전수 조사).
      삭제 감사를 남기는 자리를 `AUDIT_ACTIONS.*_DELETED` 로 전수로 세어 확인했다: 워크플로(#1369) · 트리거(#1370) ·
      스케줄(진행 중) · **통합** 넷이고, 워크스페이스 삭제는 애초에 삭제 감사를 남기지 않는다.
      `integrations.service.ts` `remove()` 는 잠금 없는 `findOne` → 사용처 검사(`INTEGRATION_IN_USE`) →
      `repository.remove(entity)` → `recordAudit(INTEGRATION_DELETED)` 다. **락이 아예 없다** — 형제 셋과 달리
      advisory lock 도 행 락도 없으므로 처방이 다르다: 원자적 `delete({ id, workspaceId })` 의 `affected` 를
      판정자로 쓰면 락 없이 닫힌다(0이면 404, 감사 없음). 사용처 검사와 삭제 사이의 TOCTOU 는 **별개 사안**이라
      함께 닫으려 하지 말 것.

- [x] **`WorkspacesService.removeMember()` 도 동시 삭제에서 감사 행을 두 번 남긴다** ~~— 이 계열의 여섯 번째 자리~~
      **2026-09-21 해소** (`plan/complete/member-dup-remove.md`). 처방은 예고대로 원자적
      `delete({ id, workspaceId })` 의 `affected === 0` → 404. e2e 로 먼저 재현했다 —
      고치기 전 `[200, 200]` · `member.removed`(`mode='removed'`) 감사 **2건**, 고친 뒤 `[200, 404]` · **1건**.
      **「여섯 번째」는 맞지만 「마지막」이 아니다** — 착수 전 전수 조사에서 세 자리가 더 나왔다
      (아래 `AuthConfigsService` · `ModelConfigService` · WebAuthn 항목). 그 조사가 찾아낸 이유는
      열거 축을 감사 액션 접미사가 아니라 **«지우고 감사하는 요청»** 으로 잡았기 때문이다.
      부수 수확: 자가 탈퇴 갈래가 이미 닫혀 있음을 e2e 로 **실증**했고(`[200, 403]` · `NOT_A_MEMBER`),
      owner 승격 TOCTOU 와 권한 검사 순서 오라클을 실측 재현해 각각 별 항목으로 등재했다.
      (developer, 낮음, 2026-09-21 등재 · `plan/in-progress/integration-dup-delete.md` 착수 전 재열거).
      **직전 PR(#1371)이 «다섯 번째이자 마지막» 이라 적은 것이 틀렸다** — 그 열거가 `AUDIT_ACTIONS.*_DELETED`
      **접미사로만** 셌기 때문이다. 삭제성 액션에는 `MEMBER_REMOVED`(`member.removed`)도 있다.
      `removeMember()` 는 무락 `findOne` → 가드(owner 금지 · admin 확인) → `memberRepository.remove(member)`
      → 감사 순서라 형제들과 같은 형태다. **`leaveWorkspace()` 는 이미 닫혀 있다** — 트랜잭션 안에서
      `pessimistic_write` 로 멤버십을 읽으므로 진 쪽은 `NOT_A_MEMBER` 403 이고 감사를 남기지 않는다(실측).
      처방은 통합 경로(#이 PR)와 같다: 락을 새로 들이지 말고 원자적 `delete({ id, workspaceId })` 의
      `affected === 0` 으로 판정. 재현은 형제 e2e 의 행 락 기법 그대로.
      **2026-09-21 정정 — 「여섯 번째」는 맞지만 「마지막」이 또 틀렸다**: 착수 전 전수 조사
      (`plan/in-progress/member-dup-remove.md` §A)에서 **세 자리가 더** 나왔다. 아래 세 항목이다.

- [ ] **`workspaces.controller.ts` 만 삭제 성공에 204 대신 `200 {ok:true}` 를 쓴다**
      (planner, 낮음, 2026-09-21 등재 · `/ai-review` `review/code/2026/09/21/13_28_12` WARNING 4).
      `spec/5-system/2-api-convention.md` §6 은 «204 No Content = 삭제 성공» 으로 적는데,
      `DELETE /api/workspaces/:id` 와 `DELETE /api/workspaces/:id/members/:memberId` 는 200 을 준다.
      **실측**: `workflows`·`triggers`·`schedules`·`integrations` 컨트롤러는 각각
      `HttpCode(204)` 가 **1개**, `workspaces.controller.ts` 는 **0개**이고 `ok: true` 가 **5곳**이다.
      즉 라우트 하나의 일탈이 아니라 **컨트롤러 단위의 다른 관례**다.
      둘 중 하나여야 한다 — 컨트롤러를 204 로 맞추거나(클라이언트 계약 변경), §6 에 이 예외를
      각주로 적거나. **바로 위 §3 멱등성 각주 작업과 같은 문서라 함께 처리하는 편이 싸다.**

- [ ] **`removeMember()` 의 권한 검사가 대상 조회·owner 판정보다 뒤에 있어 존재 오라클이 된다**
      (developer, **중간**, 2026-09-21 등재 · `/ai-review` `review/code/2026/09/21/12_57_05` WARNING 1).
      순서가 `findOne`(`:783`) → 404 → self 위임 → owner 403 → `assertAdmin`(`:803`) 이라,
      요청자가 그 워크스페이스 멤버가 아니어도 `(workspaceId, memberId)` 쌍에 대해 **세 갈래로
      구분되는 응답**을 받는다: 없음 `404 MEMBER_NOT_FOUND` · 있고 owner `403 CANNOT_REMOVE_OWNER` ·
      있고 비-owner `403 ADMIN_REQUIRED`. 같은 파일의 형제 Admin+ 메서드
      (`addMemberByEmail:256` · `updateMemberRole:306`)는 `assertAdmin` 을 **가장 먼저** 부른다.

      ~~**직접 실측으로 리뷰어 지적을 한 칸 더 확인했다**: `workspaces.controller.ts` 는
      `@UseGuards(JwtAuthGuard)` 뿐이고 **`RolesGuard` 가 없다**(`@Roles` 는 `:246` 한 곳뿐).~~

      > **2026-09-21 정정 — 위 근거는 틀렸다.** `RolesGuard` 는 **전역 `APP_GUARD`** 로 등록돼
      > 있다(`app.module.ts:213`). 컨트롤러에 `@UseGuards(RolesGuard)` 가 없는 것을 보고
      > «가드가 없다» 고 결론지은 것이다 — 한 층을 grep 하고 다른 층을 단정했다.
      >
      > **결론(상류 차단 없음)은 유지되지만 이유가 다르고, 그 이유가 더 넓다.** 가드는 이
      > 라우트를 **통과시킨다**: `@Roles()` 가 없어 `needsRoleCheck=false` 이고,
      > `handlerConsumesWorkspaceId` 가 `ROUTE_ARGS_METADATA` 의 파라미터 팩토리를
      > `extractWorkspaceId` 와 **identity 비교**하는데 이 핸들러는 `@WorkspaceId()` 가 아니라
      > `@Param('id')` 로 워크스페이스를 받으므로 false 다 → `roles.guard.ts:114-119` 의
      > «워크스페이스 컨텍스트 없음 → 통과» 단축 경로가 발화한다.
      >
      > **그래서 이것은 한 메서드의 검사 순서 문제가 아니다.** 같은 컨트롤러에서 경로 `:id` 를
      > 워크스페이스로 쓰면서 `@WorkspaceId()` 도 `@Roles()` 도 없는 라우트가 **17개 중 13개**다
      > (실측: `update` · `updateSettings` · `getSettings` · `remove` · `leave` · `listMembers` ·
      > `addMember` · `updateMember` · `removeMember` · `listInvitations` · `createInvitation` ·
      > `resendInvitation` · `revokeInvitation`). 전부 서비스 계층의 `assertMembership`/
      > `assertAdmin` 에만 기대고 있다 — **가드 층은 아무것도 주지 않는다.**
      >
      > **완료된 `plan/complete/auth-workspace-membership-guard.md`(2026-08-08)가 이 13개를
      > 닫지 않았다**: 그 plan 의 모집단은 «`@WorkspaceId()` 를 소비하며 `@Roles()` 가 없는
      > 라우트 73건» 이었고, 경로 파라미터로 워크스페이스를 받는 라우트는 **구성상 그 모집단
      > 밖**이다. 즉 가드의 커버리지 모델에 구멍이 있는 것이지 개별 라우트의 실수가 아니다.
      >
      > 후속 PR 은 이 13개를 한 축으로 보고, 처방을 «검사 순서 재배치» 가 아니라 «가드가
      > 경로 파라미터 워크스페이스도 보게 할 것인가» 부터 결정해야 한다.

      **열거는 여전히 불가능하다** — 두 ID 가 모두 UUID(`ParseUUIDPipe`)라 다른 경로로 새어야
      쓸 수 있는 오라클이다. 삭제 자체는 `assertAdmin` 이 여전히 막는다(권한 상승 아님).

      **왜 그 PR 에서 함께 고치지 않았나**: 올바른 처방이 «`assertAdmin` 을 맨 앞으로» 가
      **아니기** 때문이다 — 자가 탈퇴는 비-admin 도 해야 하므로 self 위임 분기와 맞물려야 하고,
      비-admin 이 owner 를 지목했을 때의 코드가 `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로
      **바뀐다**. 에러 코드 계약 변경이라 `spec/5-system/3-error-handling.md` 기준의 자체
      consistency 라운드가 필요하다. 동시성 수정과 섞으면 정확히 리뷰어들이 지적해 온 스코프 혼입이다.

- [ ] **`removeMember()` 의 owner 보호 가드가 TOCTOU 로 뚫린다 — 실측 확인됨**
      (developer, **중간**, 2026-09-21 등재 · `member-dup-remove.md` §C-2 프로브).
      `workspaces.service.ts:797` 의 «owner 는 제거할 수 없다» 가드가 **무락 `findOne`** 위에 있다.
      읽기와 삭제 사이에 그 멤버가 owner 로 승격되면 가드를 통과한 채 owner 가 지워지고,
      `workspace.ownerId` 는 멤버십 없는 사용자를 가리키게 된다.

      **결정적 재현 레시피** (레이스로는 인터리빙을 못 고른다 — 둘 다 같은 행 락을 기다려
      큐 순서에 달린다. 그래서 재진입으로 만든다):
      1. locker 커넥션이 `SELECT id FROM workspace_member WHERE id=$1 FOR UPDATE`
      2. `DELETE /api/workspaces/:id/members/:memberId` 발사 → 무락 읽기(`role='editor'`)와
         가드를 지나 삭제에서 멈춘다 (1.5초 대기로 «아직 안 끝남» 관측)
      3. locker 가 `UPDATE workspace_member SET role='owner' WHERE id=$1` 후 COMMIT
         — `transferOwnership` 이 그 행에 가하는 **효과의 대역**이다
      4. **실측: `status=200`, `rows_remaining=0`** — owner 가 지워졌고 요청은 성공했다

      **후보 처방** (다음 PR 에서 검증할 것, 지금은 미적용):
      ```ts
      const { affected } = await this.memberRepository.delete({
        id: memberId, workspaceId, role: Not('owner'),
      });
      if (affected === 0) {
        // 0 의 이유가 둘이다 — 행이 사라졌나, owner 가 됐나. 0-행 경로에서만 한 번 더 읽어 가른다.
        const still = await this.memberRepository.findOne({ where: { id: memberId, workspaceId } });
        if (still?.role === 'owner') throw Forbidden('CANNOT_REMOVE_OWNER');
        throw NotFound('MEMBER_NOT_FOUND');
      }
      ```

      **왜 이번 PR 에서 함께 닫지 않았나**: 두 결함의 계약이 다르다 — 이번 PR 은 «감사를 두 번
      남기지 않는다», 이것은 «owner 를 지우지 않는다» 다. 위 후보 처방은 `affected === 0` 의
      의미를 **하나에서 둘로** 늘리는데, 그 판별자를 세우는 것이 바로 이번 PR 의 주제라
      같은 diff 에서 그 의미를 흐리고 싶지 않았다. 후보 처방의 새 분기는 자체 테스트와
      뮤턴트가 필요하다. (비용이 아니라 **판별자 오염**이 유예 사유다.)

- [x] **`AuthConfigsService.remove()` 도 동시 삭제에서 감사 행을 두 번 남긴다 — 일곱 번째**
      **2026-09-21 해소** (`plan/complete/authconfig-dup-delete.md`). 처방은 예고대로 원자적
      `delete({ id, workspaceId })` 의 `affected === 0` → 404 `RESOURCE_NOT_FOUND`.
      e2e 로 먼저 재현했다 — 고치기 전 `[204, 204]` · `auth_config.delete` 감사 **2건**,
      고친 뒤 `[204, 404]` · **1건**. 같은 턴에 `spec-sync-auth-gaps.md:215` 의 **이중 추적**
      항목도 함께 닫았다(`--impl-prep` plan_coherence W2 가 찾아냈다).
      남은 자리는 **여덟 번째 `ModelConfigService.remove()` · 아홉 번째 WebAuthn** 둘이다.
      (developer, 낮음, 2026-09-21 등재 · `member-dup-remove.md` §A 전수 조사).
      `auth-configs.service.ts:287` — 무락 `findById` → `remove(config)` → `AUTH_CONFIG_DELETE` 감사.
      형제 여섯과 같은 형태이고 락이 없으므로 처방도 같다(원자적 `delete` 의 `affected === 0`).

- [ ] **`ModelConfigService.remove()` 도 동시 삭제에서 감사 행을 두 번 남긴다 — 여덟 번째**
      (developer, 낮음, 2026-09-21 등재 · 같은 조사).
      `model-config.service.ts:404` — 무락 `findEntity` → `remove(config)` → `notifyInvalidated(id)`
      → `MODEL_CONFIG_DELETE` 감사. `notifyInvalidated` 도 두 번 발화한다.
      > **2026-09-21 정정 — 「감사 중복에 더해 캐시 무효화 통지 중복까지 있다」는 과장이었다.**
      > 리스너는 `llm.service.ts:81` 의 `clearClientCache(configId)` 하나뿐이고 캐시 축출은
      > **멱등**이라, 두 번 불려도 해로운 결과가 없다. 중복 통지는 **고쳐야 할 별개 결함이
      > 아니라** 이 수정이 진 쪽에서 함께 건너뛰게 되는 부수 효과다. 등재 시점에 리스너를
      > 따라가 보지 않고 «중복이면 나쁘다» 로 적었다.

- [ ] **WebAuthn credential 삭제도 동시 요청에서 `user.2fa_disabled` 감사를 두 번 남긴다 — 아홉 번째**
      (developer, 낮음, 2026-09-21 등재 · 같은 조사).
      `webauthn.service.ts:532` 는 이미 `credentialRepo.delete({ id })` 를 쓰지만 **`affected` 를 버린다** —
      «`remove(entity)` 를 찾자» 는 축으로는 안 걸리는 자리다. 게다가 감사는 서비스가 아니라
      **`webauthn.controller.ts:338`** 이 남긴다(`USER_2FA_DISABLED`). 즉 «서비스에서 감사를 찾자» 는
      축으로도 안 걸린다 — **이 항목이 열거 축을 «지우고 감사한다» 는 요청 단위로 잡아야 하는 이유다.**
      부수 효과가 하나 더 있다: 진 쪽도 `countCredentials` 가 0을 보면 `webauthnRecoveryCodes: null`
      쓰기를 한 번 더 한다. 판정을 서비스에 두면 `{ remaining }` 계약을 바꾸게 되므로, 반환 형태를
      건드리지 않는 방법(진 쪽에서 404)을 먼저 검토할 것.

- [ ] **`integrations.service.spec.ts:131` 의 `remove` mock 스텁이 죽었다**
      (developer, 매우 낮음, 2026-09-21 등재 · `review/code/2026/09/21/11_32_06` INFO 2).
      통합 삭제가 `remove(entity)` → `delete(criteria)` 로 바뀌면서 그 스텁을 부르는 테스트도
      단언하는 테스트도 0건이 됐다. **리뷰어는 «다음 근접 편집에서» 라고 적었지만 그 편집은
      오지 않는다** — 이 계열의 다음 PR(바로 위 `removeMember()`)은 workspaces 를 건드린다.
      그래서 산문이 아니라 항목으로 남긴다. 한 줄 삭제라 이번 PR 에서 고치면 리뷰 freshness 가
      재무장돼 라운드가 한 번 더 도는데, 라운드 2가 Critical·Warning 0 으로 수렴한 뒤라
      선언한 정지 규칙(`developer` SKILL §수렴 예외 (a)(b))에 따라 등재로 갈음했다.

- [ ] **삭제 엔드포인트를 적는 spec 들에 «동시 삭제 → 두 번째 404» 서술이 없다**
      > **2026-09-21 일반화**: 이 항목은 자리를 열거하는 방식으로 적혀 있었고 **다섯 번 확장됐다**
      > (`3-schedule.md` → `4-integration.md` → `2-api-convention.md §3` → `9-user-profile.md` ·
      > `data-flow/12-workspace.md §1.6` → 그리고 지금 `6-config.md`). 이 계열이 아홉 자리라
      > 열거를 유지하면 PR 마다 또 늘어난다. **집행 시 그 시점의 해소된 코드 경로를 기준으로
      > 재열거할 것** — 아래 목록은 2026-09-21 기준 스냅샷이지 고정 목록이 아니다.
      > 같은 이유로 `2-api-convention.md §3` 각주는 **경로 수를 세지 말고 계약 문장만** 적는다.
      >
      > 2026-09-21 기준 자리: `1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10 ·
      > `3-schedule.md` §4 · `4-integration.md` §9 · `9-user-profile.md` §6.1 ·
      > `data-flow/12-workspace.md` §1.6 · **`6-config.md` §A(`DELETE /api/auth-configs/:id`)** ·
      > **`6-config.md` §Model Config API(`DELETE /api/model-configs/:id`)**.
      > — `6-config.md` 한 파일 안에 **두 행**이라는 점에 주의: 파일 단위로 훑으면 한 행만 고치고
      > 끝낼 수 있다(`--impl-prep` `review/consistency/2026/09/21/16_16_35` W1).
      > `5-system/12-webhook.md`·`1-auth.md` 는 `auth-configs.service.ts` 를 `code:` 로 지목하지만
      > 삭제 계약을 서술하지 않으므로 대상 아님(2026-09-21 직접 확인).
      >
      > 아래는 원래의 열거 서술이다 — 이력으로 남긴다.

      ~~`1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10 · `3-schedule.md` §4 · `4-integration.md` §9 에 «동시 삭제 → 두 번째 404» 서술이 없다~~
      (planner, 낮음, 2026-09-20 등재 · 같은 세션 api_contract·requirement INFO 8). 트리거 목록 §4.4 만 그 계약을 적는다.
      이제 코드는 세 경로 중 둘이 그렇게 동작하므로(위 두 항목) 문서가 트리거에만 있는 비대칭이 남았다.
      `--impl-prep` 부터 세 라운드 연속 «비차단» 으로 처분됐으니 급하지 않다.
      **2026-09-20 스코프 확장**: `3-schedule.md` §4(`DELETE /api/schedules/:id`)도 같은 서술이 없다 —
      스케줄 축이 세 번째로 누락되지 않게 목록에 넣는다(`--impl-prep` `review/consistency/2026/09/20/23_37_12` W2).
      **2026-09-21 재확장**: `4-integration.md` §9(§9.1 DELETE 행 · §9.4 코드 목록)도 같은 침묵이다 —
      통합 축이 네 번째로 빠지지 않게 함께 넣는다(`--impl-prep` `review/consistency/2026/09/21/10_27_27` W3).
      **2026-09-21 재확장 (3)**: `9-user-profile.md` §6.1(`DELETE …/members/:memberId`, `:378`)과
      `data-flow/12-workspace.md` §1.6 도 같은 침묵이다 — 멤버 축이 다섯 번째로 빠지지 않게 넣는다
      (`--impl-prep` `review/consistency/2026/09/21/12_23_48` W2, checker 셋이 교차 확인).
      **2026-09-21 재확장 (2) — 침묵이 아니라 정면 충돌인 자리가 하나 있다**:
      `spec/5-system/2-api-convention.md` §3 의 HTTP 메서드 표가 `DELETE` 를 **멱등 `O`** 로 적는다.
      이제 다섯 경로 전부 동시 삭제의 진 쪽에 404 를 준다 — 위 네 항목은 «안 적혀 있다» 이지만
      이것은 **적힌 것과 다르게 동작한다**. 그래서 한 문장 추가가 아니라 규약 표의 각주가 필요하다:
      «멱등성은 최종 상태 기준이며, 동시 요청 중 진 쪽은 404 를 받을 수 있다».
      근거는 `--impl-done` `review/consistency/2026/09/21/11_42_00` WARNING 1(rationale_continuity).
      **집행 시 각주가 세야 할 수**: 이 각주를 쓸 때 «다섯 경로» 라고 적지 말 것 —
      2026-09-21 전수 조사에서 이 계열이 **아홉 자리**임이 확인됐다(여섯 완료 + 대기 3건:
      `auth-configs` · `model-config` · `webauthn`). 각주는 경로 수를 세지 말고
      **«동시 요청 중 진 쪽은 404 를 받을 수 있다»** 라는 계약만 적는 편이 낫다 — 그러면
      남은 세 자리가 닫힐 때마다 각주를 고치지 않아도 된다.

- [ ] **이 결함 클래스의 동시성 e2e 파일이 어느 spec 의 `code:` frontmatter 에도 없다**
      (planner, 낮음, 2026-09-21 등재 · `--impl-done` `review/consistency/2026/09/21/11_42_00` INFO 4).
      집행 시 `codebase/backend/test/` 에서 **그 시점에 실재하는 파일을 다시 열거할 것** — 개수도
      파일명 패턴도 고정하지 않는다. 2026-09-21 기준 여섯 개이고 이름이 한 패턴이 **아니다**:
      `workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-delete-concurrency.e2e-spec.ts`
      다섯 + `member-remove-concurrency.e2e-spec.ts`(`-delete-` 가 아니라 `-remove-`).
      각 축의 spec(`1-workflow-list.md`·`12-workspace.md`·`2-trigger-list.md`·`3-schedule.md`·
      `4-integration.md`·`9-user-profile.md`)에 정본 증거로 등재하면 `/spec-coverage` 가 이 계약을 본다.
      형제마다 같은 누락이 반복됐으므로 **개별 PR 의 실수가 아니라 관례의 구멍**이다.
      > **2026-09-21 정정**: 이 항목은 «다섯» 과 `*-delete-concurrency` 글롭으로 적혀 있었는데,
      > 등재한 바로 그 PR 이 여섯 번째 파일을 다른 이름으로 추가해 **착지 즉시 stale** 이 됐다
      > (`/ai-review` `review/code/2026/09/21/13_28_12` WARNING 3). 바로 위 항목에 «경로 수를
      > 세지 말라» 고 적어 놓고 이 항목엔 적용하지 않은 것이다.
      **같은 턴에 둘 더**(`--impl-done` `review/consistency/2026/09/20/21_21_21` WARNING 1·2):
      (a) `data-flow/12-workspace.md` §1.10 은 «재검사 거부를 **포함해** 모든 실패를 로그로 남긴다» 고 적는데,
      이제 동시 삭제의 404 만은 로그를 남기지 않는다(거짓 경보라서) — 그 예외를 한 구로 적는다.
      (b) ~~`2-trigger-list.md` §4.4 의 «두 번째는 404» 는 **구현 검증 대기** 라는 caveat 이 필요하다 — 바로 위
      developer 항목이 그 선례가 코드에서 성립하는지 실측할 때까지는 spec 이 단정하고 있다.~~
      **2026-09-20 처분: caveat 불요** — `plan/complete/trigger-dup-delete.md` 가 `TriggersService.remove()` 를
      고쳐 §4.4 가 **코드에서도 사실**이 됐다(e2e `trigger-delete-concurrency` 가 `[204, 404]` · 감사 1건으로 고정).
      고치기 전 상태도 값으로 남겼다: `[204, 204]` · 감사 2건. **(a) 는 그대로 열려 있다.**


- [x] **창 1 실측 결과를 spec 에 반영한다 — §3 ⚠️ 교체 · 증거 e2e `code:` 등재 · 404 사유** (planner,
      2026-09-17 등재, `plan/complete/trigger-save-partial-patch.md` «이 PR 이 안 하는 것»).
      developer 항목 7 을 닫으며 코드는 고쳤지만, 그 사실을 적을 문장들은 planner 턴이 쓴 것이라
      developer 가 고치지 않았다.

      | # | 할 일 | 근거 |
      |---|---|---|
      | ~~1~~ ✅ | `spec/2-navigation/2-trigger-list.md §3` 의 ⚠️ «실측되지 않은 잔여» 를 «① 재읽기 뒤 FK CASCADE 는 시끄러운 실패로 실측(롤백·부활 없음) · ② 락 밖 컬럼 경합은 실결함이었고 부분 객체 `save` 로 수정됨» 으로 교체 | `/ai-review` `review/code/2026/09/17/13_44_39` W1·`14_11_48` INFO#12·`14_34_56` INFO#1 [SPEC-DRIFT] — 세 라운드 연속 지적 |
      | ~~2~~ ✅ | 같은 문서 frontmatter `code:` 에 `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 등재 | 이 문서가 스스로 성문화한 관례(«e2e 가 보장을 고정하면 그 파일을 `code:` 에 올린다», 선례 `trigger-workflow-ref.e2e-spec.ts`) — `--impl-prep` `review/consistency/2026/09/17/13_04_39` W1 |
      | ~~3~~ ✅ | `spec/5-system/15-chat-channel.md §5.4` 404 행에 «CASCADE 창의 병합 쓰기 0행» 사유 한 줄 | 같은 `--impl-prep` INFO#1 |

      > **✅ 2026-09-17 해소** — planner 턴 `plan/complete/spec-draft-window1-measured.md`
      > (`--spec` `review/consistency/2026/09/17/16_06_23` **BLOCK: NO**). 재다가 **두 자리를 더**
      > 닫았다: (a) «0행이면 404» 는 `rotate-bot-token` 만이 아니라 `interaction/revoke-token` 도다 —
      > `#1342` 가 §3 괄호에 한 엔드포인트만 적었다. (b) chat-channel §5.4 404 행의
      > `triggers.service.ts:122` 는 이미 낡아 있었다(`findById` 는 408행) — 줄 번호를 빼고 심볼만 남겼다.
      > ⚠️ 는 지우지 않고 «PATCH 는 바꾸는 필드만 저장한다 · 부재는 두 하위 창(재읽기 빔 → 404 /
      > 저장 직전 CASCADE → 롤백·500)» 으로 바꿨다 — 500 은 계약이 아니라 현재 동작으로 적었다.

- [ ] **rotate 의 테스트 실패 응답이 400 인데 spec 은 422 — 두 spec 이 서로도 어긋난다** (planner 결정, 2026-09-19 등재 ·
      `plan/complete/spec-draft-integration-connection-tests.md` «비대상» · `--impl-prep` `review/consistency/2026/09/19/13_21_00` WARNING 1).
      `IntegrationsService.rotate()` 는 `INTEGRATION_TEST_FAILED` 를 `BadRequestException`(400)으로 던진다. `spec/2-navigation/4-integration.md §9.4`
      는 422, `spec/5-system/11-mcp-client.md` 는 400 이라 적는다. 연결 테스트가 Database · HTTP 에서 실제로 실패할 수 있게 된 지금 이 응답이
      처음으로 흔해진다 — `integration-connection-test.e2e-spec.ts` D 는 그래서 **상태 코드를 단언하지 않는다**(4xx 범위 + 코드만). 정할 것: 어느 쪽에 맞출지.
      **같은 결정에 묶을 것** (`/ai-review` `review/code/2026/09/19/14_29_33` api_contract INFO): rotate 는 연결 테스트의 세부 `code`
      (`DB_AUTH_FAILED` · `HTTP_AUTH_FAILED` …)를 버리고 늘 `INTEGRATION_TEST_FAILED` 만 준다 — preview-test · `:id/test` 와 세분성이
      다르다. 세부 코드를 `details` 로 실을지 함께 정한다.
      (`16_00_06` api_contract WARNING 8: 정할 때 `5-system/11-mcp-client.md` 의 400 근거와 `5-system/2-api-convention.md §6` 의 422
      원칙을 함께 남길 것.)

- [x] **SMTP SSRF 가드에 CGNAT 대역이 없는데 §5.5 는 막는다고 적는다** (developer→planner, 2026-09-19 등재 · 같은 draft «비대상» ·
      **2026-09-19 해소** `plan/complete/ssrf-guard-integration-unify.md`). `smtp-host-guard.ts` → `ssrf.util.ts` 는 HTTP 가드(`http-safety.ts`)와
      **다른 구현**이고 `100.64.0.0/10` 이 빠져 있다. `nodes/core/error-codes.ts` 주석은 HTTP 가드를 Email 가드의 SoT 라 적는다 — 실제로는 공유하지
      않는다. 가드를 맞출지(코드) · 문장을 맞출지(spec).
      **처분: 코드를 spec 에 맞췄다 — planner 턴 없음.** spec 문장(4-integration §5.5 · 3-send-email §4 7번 · 2-database-query §4 · 1-http-request
      §4 8번 «동일 메커니즘 · CGNAT 차단»)이 이미 정확하고 명확해 바꿀 문장이 없다 — 틀린 것은 코드였다(`--impl-prep` `21_02_09` plan_coherence
      WARNING 5 가 이 근거를 적으라고 했다). SMTP 가드를 `http-safety` 로 옮겼고, 조사 중 반대쪽 구멍 — `http-safety` 가 IPv4-mapped IPv6
      (`[::ffff:127.0.0.1]` · 메타데이터)를 통과시켜 HTTP · DB 노드에서 실제로 닿았다 — 도 같이 막았다. LLM · S3 의 `ssrf.util` 은 아래 새 항목.

- [ ] **§5.3 HTTP 필드 표의 `none` 인증 · `default_headers` 가 서비스 레지스트리 `http` 항목에 없다** (planner/developer, 2026-09-19 등재 ·
      같은 draft «비대상»). 노드(`resolveHttpCredentials`)와 연결 테스터는 `default_headers` 를 읽지만 등록 UI 는 입력할 칸을 만들지 못한다.
      `none` 은 레지스트리에 변형이 없어 `INTEGRATION_INVALID_SERVICE` 로 거부된다.

- [ ] **Google 통합이 «Auto-renews» 로 보이는데 갱신 구현이 없다** (developer 결정, 2026-09-19 등재 · 같은 draft «비대상»).
      레지스트리 `supportsTokenAutoRefresh: true` 가 `meta.autoRefresh` 로 나가 UI 가 자동 갱신 배지를 보인다. spec 은 `74087dff6` 이 §10.3 · §10.5
      주석으로 사실을 적었다. 코드 쪽 선택지: 갱신 구현 · 플래그 false. **사용자 가이드도 같은 주장을 한다** — `integration-management.mdx`(+en)
      의 «주의 대상» tip 이 Google 을 «refresh_token 자동 갱신을 지원하는 통합» 에 넣어 만료 임박이어도 배너에서 뺀다고 적는다. 코드를 정할 때 함께.

- [ ] **Google `account_email` · GitHub `login` 이 필수인데 토큰 응답에서만 뽑는다 — 없으면 저장이 막힐 수 있다(미확인)** (developer, 2026-09-19
      등재 · 같은 draft «비대상»). 착수 전 실측부터: 실제 토큰 교환 응답에 두 값이 있는지.

- [ ] **Google · GitHub · Webhook 연결 테스터** (developer, 조건부, 2026-09-19 등재 · 같은 draft «비대상»). 지금은 구조 검증만이다 —
      그 통합을 쓰는 노드가 없어 확인할 대상이 없다(spec §5.1 · §5.2 · §5.7 이 원래 약속한 프로브를 적어 둔다). **그 노드가 생길 때** 착수.

- [ ] **연결 테스트의 «확인 못 함» 안내가 화면에 닿지 않는다** (planner — UX 결정, 2026-09-19 등재 · `plan/complete/integration-db-http-testers.md`).
      HTTP 테스터는 401 · 403 외의 4xx 와 `base_url` 이 없는 경우에 `success: true` + 안내 메시지를 돌려준다(spec §5.3 «메시지로 알린다»). 그런데
      등록 Step 3(`test-step.tsx`)은 성공 시 메시지 대신 i18n `readyMessage` 를, 상세 `Test connection`(`integrations/[id]/page.tsx`)은
      `connectionPassed` 토스트를 보여 **성공 메시지를 버린다**. 지금까지는 성공 메시지가 `'Connection successful'` 또는 없음(Cafe24)뿐이라 문제가
      아니었다. 세 번째 상태(«닿았지만 확인 못 함» — 경고 표시)를 둘지, 둔다면 API 가 그것을 무엇으로 알릴지(메시지 문자열 비교는 층을 넘는 결합이다)가
      결정 대상이다. 사용자 가이드는 한계만 적었다(«401 · 403 일 때만 거부를 안다»).

- [ ] **`4-integration.md` §14.1 — 노드 런타임 HTTP 코드 표기가 `HTTP_{status}` 와 `HTTP_4XX` · `HTTP_5XX` 로 섞여 있다** (planner, 낮음,
      2026-09-19 등재 · `--impl-prep` `review/consistency/2026/09/19/13_21_00` INFO 6). 어느 쪽이 맞는지 노드 spec(`4-nodes/4-integration/1-http-request.md`)
      과 대조가 먼저다. (같이 등재했던 §6 의 `§9.3` 오기는 `plan/complete/spec-draft-integration-db-test-waits.md` 가 §9.1 로 고쳐 이
      항목에서 뺐다 — `--spec` `review/consistency/2026/09/19/15_30_56` WARNING 1.)

- [ ] **preview-test 가 인증된 사용자의 외부 연결 오라클이다 — 받아들일 위험인지 막을지 정한다** (planner 결정, 2026-09-19 등재 ·
      `/ai-review` `review/code/2026/09/19/13_58_22` security WARNING). `POST /api/integrations/preview-test` 는 워크스페이스 · 역할
      검사가 없고(분당 20회 throttle 만), Database · HTTP 테스트가 공개 host 에 실제로 접속하며 드라이버 원문 메시지(길이만 제한)를
      돌려준다 — 거부 · 타임아웃 · TLS 실패를 구분할 수 있어 플랫폼을 거친 제한적 포트 탐색에 쓸 수 있다. 내부 주소는 SSRF 가드가
      막는다. **이 PR 이 새로 연 성질은 아니다** — Email(SMTP `verify()` 원문 메시지) · MCP 가 같은 엔드포인트에서 이미 그렇다.
      선택지: spec Rationale 에 받아들인 위험으로 적기 · 워크스페이스 컨텍스트 요구 · 연결 실패 메시지 일반화(진단성과 맞바꿈).
      **같은 결정에 묶을 것** (`/ai-review` `review/code/2026/09/19/15_02_57` api_contract WARNING 9): `POST /api/integrations/:id/test`
      도 이제 Database · HTTP 에서 실제로 접속하는데 route throttle 이 없다(전역 기본만 — preview-test 는 분당 20). 저장된 통합이
      있어야 하므로 워크스페이스 멤버만 부를 수 있다는 점이 preview-test 와 다르다.

- [ ] **연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다 — 동시 상한 뒤에 남는 것** (developer, 낮음, 2026-09-19 등재 · `/ai-review`
      `review/code/2026/09/19/13_58_22` concurrency CRITICAL 의 잔여). 그 PR 은 `dispatchTest` 에 transport 테스트 동시 상한 2 를
      걸었다(`CONNECTION_TEST_MAX_CONCURRENCY`) — 풀 전체가 아니라 절반까지만 쥘 수 있게. 남는 것: (1) 상한 뒤 줄은 길이 제한이 없어
      한 사용자가 연결 테스트 기능 자체를 느리게 만들 수 있다(프로세스 전체는 아니다) (2) MCP 는 SDK 가 연결 중 요청을 겹치는지 재지
      않았다 — 테스트 하나가 스레드 둘을 쥘 수 있다 (3) 근본 해법은 c-ares(`dns.promises.Resolver` + timeout) 또는 해석한 IP 로 직접
      연결(DNS rebinding 도 닫는다)인데, 가드가 노드 실행과 공유라 `/etc/hosts` 의미 차이 · TLS SNI 를 함께 봐야 한다. 리뷰가
      제안한 `Promise.race` 타임아웃은 스레드를 풀지 못해 채택하지 않았다.
      **실측 · 남은 창 갱신** (`/ai-review` `review/code/2026/09/19/15_30_04` Critical · `16_00_06` WARNING 2): 배포 이미지
      `node:24-alpine`(musl)에서 응답 없는 네임서버로 `dns.lookup` 은 5.0초 뒤 `EAI_AGAIN` — 슬롯은 Database 약 26초 · HTTP 약 20초에
      풀린다(상한 JSDoc 에 계산). **glibc(다중 nameserver · attempts)는 재지 않았다** — 다른 베이스 이미지로 옮기면 다시 잴 것. HTTP 의
      리다이렉트 홉 가드 lookup 은 요청의 `AbortSignal` 밖이라, 신호가 끝난 뒤에도 lookup 하나만큼(5초) 더 걸릴 수 있다.

- [ ] **연결 테스트 결과 코드가 지역화 사전에 없다 — `EMAIL_*` 부터 이미** (developer, 낮음, 2026-09-19 등재 · `/ai-review`
      `review/code/2026/09/19/13_58_22` user_guide_sync INFO). `DB_*` · `HTTP_*` · `EMAIL_*` 가 `backend-labels.ts` `ERROR_KO` ·
      프런트 `INTEGRATION_ERROR_CODE_TO_I18N` 어디에도 없다 — 지금 화면은 `message`(영문)를 그대로 보인다. 위 «확인 못 함 안내가
      화면에 닿지 않는다» 와 같은 UI 턴에서 네 계열(mcp · email · database · http)을 한 번에.

- [x] **동시 rotate 두 건은 나중 저장이 먼저 통과한 교체를 조용히 덮는다** (developer, 낮음, 2026-09-19 등재 · `/ai-review`
      `review/code/2026/09/19/15_30_04` database WARNING 1 (a)). `rotate()` 는 읽기 → merge → 연결 테스트(이제 수 초) → 부분 `update`
      라, 같은 통합을 동시에 회전하면 둘 다 성공 응답을 받고 나중 것만 남는다. **이 PR 전에도 같은 창이 있었다**(구조 검증만이라 짧았을
      뿐). 막으려면 `updated_at` 조건부 update 나 `@VersionColumn` 과 409 — 버전 컬럼은 마이그레이션이라 따로. 같은 지적의 (b)(테스트
      동안 삭제되면 부분 `save` 가 INSERT 를 시도)는 그 PR 이 `update` + 0행 404 로 닫았다.
      (`16_00_06` concurrency WARNING 3 이 같은 지적을 다시 냈다 — 처분 변경 없음.)
      **2026-09-20 해소** `plan/complete/rotate-lost-update.md`. 위에 적힌 두 방향(**`updated_at` 조건부 update** ·
      **`@VersionColumn` + 409**) 은 **둘 다 쓰지 않았다** — `--spec` 이 세 가지를 반증했다(그 draft 는
      `plan/complete/spec-draft-rotate-conflict.md` 에 `superseded` 로 남겼다):
      (1) 409 는 **새 에러 코드 · spec 계약**을 요구하는데 대상 spec 이 `status: implemented` 라 `partial` 강등을 부른다,
      (2) 이 저장소는 **같은 형태를 이미 락으로 닫았다**(`trigger-config-lost-update.md` · 같은 모듈의 재인증 `CONC H-3`),
      (3) `updated_at` 조건은 `logUsage` 가 같은 컬럼을 올리면 **정상 사용만으로 거짓 409** 를 낼 수 있다(미검증 의심으로 남겼고,
      락 처방을 택해 확인이 불필요해졌다).
      채택한 것: **연결 테스트는 트랜잭션 밖, 그 뒤 `pessimistic_write` 로 행을 다시 읽어 그 위에 머지**(+ 락 안에서 권한도
      재확인 — 테스트 중 `scope_changed` 로 승격되면 비-admin 이 통과하던 TOCTOU 를 함께 닫았다). 판별력 실측: `origin/main`
      서비스로 되돌려 e2e 이미지를 재빌드하니 유실이 재현되며 RED.

- [ ] **`spec/data-flow/5-integration.md` 의 rotate 서술에 잠금 메커니즘이 없다** (planner, 낮음, 2026-09-20 등재 ·
      `/ai-review` `review/code/2026/09/20/18_09_24` SPEC-DRIFT 1 · `--impl-prep` `…/16_58_56` cross_spec INFO 1).
      같은 문서의 형제 흐름(reauthorize · request_scopes)은 `SELECT … FOR UPDATE` 를 명시하는데 rotate 만 빠져 있다 —
      이제 코드는 같은 메커니즘을 쓴다(`plan/complete/rotate-lost-update.md`). 한 줄이면 비대칭이 사라진다. 비차단으로
      두 번 처분됐으므로 급하지 않다.
      **같은 턴에**: `2-navigation/4-integration.md` frontmatter `code:` 에 신규 e2e 를 개별 등재한다 —
      `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts`. 형제 문서 `2-trigger-list.md` 가 e2e-spec 을
      개별 등재하는 선례를 갖는다(`--impl-done` `review/consistency/2026/09/20/18_24_04` convention INFO 3 —
      글로브로는 이미 매치돼 가드 위반은 아니다).

- [ ] **personal-scope 통합의 «본인 것만» 소유자 검증이 코드에 없다** (planner 결정 + developer, 2026-09-20 등재 ·
      `/ai-review` `review/code/2026/09/20/18_09_24` requirement INFO 6). `assertCanRotate` 는 organization-scope 만 본다 —
      spec §8 이 말하는 personal 소유자 제약은 강제되지 않는다. **회귀가 아니다**: `git show` 대조로 rotate 락 PR 이전부터
      같았음이 확인됐다. rotate 한 곳이 아니라 권한 모델 전반(조회·수정·삭제)의 문제라 범위를 먼저 정해야 한다.

- [ ] **entity tester 재진입 금지가 문서로만 있다** (developer, 낮음, 2026-09-19 등재 · `/ai-review` `review/code/2026/09/19/16_00_06`
      concurrency · side_effect WARNING 1). entity tester 는 연결 테스트 동시 상한(2) 안에서 도므로, 등록된 테스터가 `testConnection` ·
      `previewTest` · `rotate` 를 다시 부르면 슬롯끼리 서로를 기다려 교착한다. 지금 둘(Cafe24 · MakeShop)은 부르지 않고
      `registerEntityTester` 계약에 적었다. 런타임으로 막으려면 `AsyncLocalStorage` 로 «슬롯 안» 을 표시해 재호출을 즉시 실패시키는 가드와
      그 회귀 테스트. 새 entity tester 를 붙일 때 같이.

- [x] **연결 테스트 결과 코드가 원시 문자열로 흩어져 있다** (developer, 낮음, 2026-09-19 등재 · `16_00_06` maintainability WARNING 4 ·
      **2026-09-20 해소** `plan/complete/connection-test-codes-and-gaps.md` — `CONNECTION_TEST_CODES` + `IntegrationTestResult.code` 를
      `IntegrationTestResultCode` union 으로. 좁히자 컴파일러가 표에 없던 생산자(`testConnection` 게이트)를 찾았다. 테스트 기대값은 리터럴로 둔다).
      `DB_*` · `HTTP_*` 가 테스터 · spec · e2e 에 리터럴로 반복된다 — 같은 디렉터리의 `MCP_ERROR_CODES` 처럼 `as const` 객체로 모아 오타를
      컴파일 에러로. `EMAIL_*` 도 같은 형편이라 위 «결과 코드 지역화» 항목과 한 번에 하면 대조 표가 하나로 끝난다.
      함께: `IntegrationTestResult.code` 가 `string` 이라 노드 런타임 `ErrorCode`(`DB_CONNECTION_ERROR` · `HTTP_TRANSPORT_FAILED` — 이름이
      가깝다)와 섞어 비교해도 컴파일러가 못 잡는다 — 연결 테스트 코드의 literal union 으로 좁힌다(`--impl-done`
      `review/consistency/2026/09/19/16_19_04` naming_collision WARNING 3).

- [x] **연결 테스트 spec 의 빈칸 셋** (developer, 낮음, 2026-09-19 등재 · `16_00_06` testing WARNING 5 · 6 · INFO 5 · **2026-09-20 해소**
      `plan/complete/connection-test-codes-and-gaps.md` — 셋 다, 뮤턴트로 판별력 확인. 리뷰가 더 찾은 MakeShop `pingConnection` 테스트 0건도 채웠다).
      (1) `buildMysqlSsl` 의 `require` · `verify-full` → `rejectUnauthorized: true` 를 mysql 쪽에서 단언하지 않는다(postgres 만) — 노드와
      공유하는 보안 매핑이다. (2) `database-driver-sockets.spec.ts` 의 mysql2 케이스는 unit 계층에서 루프백 연결을 실제로 시도한다 —
      소켓 정리를 `try/finally` 로, 예외적으로 실제 소켓을 쓴다는 주석. (3) rotate 의 `update` 성공 뒤 재조회가 `null` 인 분기(그 사이
      삭제 → 404) 테스트.

- [x] **SMTP 가드 주석이 없는 환경변수를 가리킨다** (developer, 낮음, 2026-09-19 등재 · `16_00_06` documentation WARNING 7 · **2026-09-19 해소**
      `plan/complete/ssrf-guard-integration-unify.md` — 두 주석을 opt-out `ALLOW_PRIVATE_HOST_TARGETS` 로. `SMTP_BLOCK_PRIVATE_HOSTS` 는
      `spec/2-navigation/4-integration.md` Rationale 이 기각한 대안의 이름이었다).
      `integrations.service.ts`(`testEmailTransport`) · `send-email.handler.ts` 두 곳이 «`SMTP_BLOCK_PRIVATE_HOSTS` 정책이 켜진 경우(opt-in)»
      라 적는데 실제는 `ALLOW_PRIVATE_HOST_TARGETS=true` 가 아니면 막는 **opt-out** 이다(`smtp-host-guard.ts`). 위 «SMTP SSRF 가드에 CGNAT 이
      없다» 항목과 같은 턴에.

- [x] **`spec/0-overview.md` Rationale 이 백엔드 ORM 을 Prisma 로 적는다 — 실제는 TypeORM** (planner, 낮음, 2026-09-19 등재 ·
      `--impl-prep` `review/consistency/2026/09/19/16_54_09` rationale_continuity INFO 2 · **2026-09-19 해소**
      `plan/complete/spec-draft-spec-fact-orm-defaults.md` — Prisma 는 저장소 이력 전체에 0건, 첫 커밋부터 TypeORM. 배경 · 채택 · trade-off 를
      고쳐 쓰고 절 끝에 정정 블록(원문과 출처 #256), trade-off 에 drift 가드 한 줄). «DB 마이그레이션 도구로 Flyway 채택» 절의 배경 ·
      trade-off 가 «NestJS + Prisma» · «Prisma client 의 schema» 를 전제한다. 코드베이스에 `prisma` 의존성 · `schema.prisma` 가 없다 —
      이중 source 는 **TypeORM 엔티티 데코레이터**와 Flyway SQL 이고, 그 drift 는 `entity-schema-declarations.e2e-spec.ts`(인덱스 · 제약 층 #1354 ·
      컬럼 층)가 막는다. 사실 정정이다.

- [x] **`spec/1-data-model.md` 컬럼 표가 DB 기본값 둘을 적지 않는다** (planner, 낮음, 2026-09-19 등재 · `/ai-review`
      `review/code/2026/09/19/17_45_35` requirement INFO 1 · 2 · **2026-09-19 해소** `plan/complete/spec-draft-spec-fact-orm-defaults.md` —
      두 행에 `default=` · Rationale 가드 괄호에 «인덱스 · 제약은 한쪽, 컬럼 정의는 양방향»). §2.16 ModelConfig `kind` 의 `DEFAULT 'chat'`(V088) · §2.20 AssistantSession
      `last_interaction_at` 의 `DEFAULT now()` — 엔티티는 컬럼 층 정정(`plan/complete/entity-column-declaration-drift.md`)으로 이제 둘 다
      선언한다. 두 서비스가 값을 늘 명시해 실질 영향은 없다. 사실 정정이다.
      같은 턴에: 이 문서 `## Rationale` 의 선언↔DB 가드 절에 «컬럼 층도 본다 — 인덱스 · 제약은 선언 → DB 한쪽, 컬럼 정의는 양방향» 한 줄
      (`--impl-done` `review/consistency/2026/09/19/18_16_57` rationale_continuity INFO 2).

- [x] **컬럼 층 가드의 남은 빈칸 — 예방 계층 자체의 회귀 테스트 · `default` RETURNING** (developer, 낮음, 2026-09-19 등재 · `/ai-review`
      `review/code/2026/09/19/18_07_01` testing WARNING 2 · INFO 1 · 4 · 6, `plan/complete/entity-column-declaration-drift.md` 4라운드 «수렴 예외» ·
      **2026-09-20 해소** `plan/complete/column-guard-gaps.md` — 셋 다. 뮤턴트 셋 RED: 읽기 전용 옵션 제거 · `kind` 의 `default` 제거 ·
      `lastInteractionAt` 의 `default` 제거).
      (1) `entity-schema-declarations.e2e-spec.ts` 의 비교기 전용 `DataSource` 는 읽기 전용 세션(`default_transaction_read_only=on`)으로
      DDL 을 막는데, 그 옵션을 지워도 스위트는 GREEN 이다(카탈로그 비교는 탐지만). 같은 `DataSource` 로 `CREATE TEMP TABLE` 을 시도해
      read-only 거부를 단언하는 `it` 하나면 된다(Postgres 는 읽기 전용 트랜잭션에서 모든 `CREATE` 를 막는다 — 성공해도 임시 테이블이라 무해).
      (2) `default` 를 새로 선언한 두 컬럼(`model_config.kind` · `workflow_assistant_session.last_interaction_at`)의 insert RETURNING 은 전체
      e2e 통과로만 확인됐다 — 값을 생략한 insert 가 DB 기본값을 채워 돌려받는 좁은 테스트. (3) 가독성: 지역 변수 `log` → `sqlMemory`,
      `COLUMN_LEVEL_SAMPLES.caught` 옆에 어느 패턴의 표본인지 주석.

- [ ] **LLM 프로바이더 · S3 의 SSRF 가드(`ssrf.util.ts`)가 CGNAT · `::` 를 막지 않는다 — 막을지 정한다** (planner 결정 + developer, 낮음,
      2026-09-19 등재 · `plan/complete/ssrf-guard-integration-unify.md` «비대상»). 통합 노드(HTTP · DB · Email)는 이제 한 가드(`http-safety.ts`)를
      쓰지만, `model-config.service` · `llm-preview.service` · `s3.config` 는 따로 `ssrf.util` 을 쓴다 — CGNAT `100.64.0.0/10` 과 `[::]` 가 통과한다
      (같은 입력 실측, 위 plan). `spec/5-system/7-llm-client.md` «SSRF 가드» 줄은 그 목록을 그대로 적는다(IPv4-mapped 있음 · CGNAT 없음). 막으면
      Tailscale(100.64/10) 너머의 비-`local` 프로바이더가 막히는데 LLM 쪽엔 `ALLOW_PRIVATE_HOST_TARGETS` 같은 opt-out 이 없다. S3 는 따로 본다 —
      `s3.config` 가 `isPrivateHost` 로 무엇을 하는지(경고인지 차단인지)부터. 정하면 두 분류기를 하나로 합친다.

- [ ] **공용 SSRF 가드 `http-safety.ts` 를 `http-request/` 밖 중립 위치로** (planner + developer, 낮음, 2026-09-19 등재 · `/ai-review`
      `review/code/2026/09/19/21_38_32` architecture WARNING 2). HTTP Request · DB Query · Send Email 과 연결 테스트가 쓰는데 HTTP Request 폴더에
      있다 — DB 핸들러 · SMTP 가드 · `modules/integrations` 테스터가 형제 폴더의 구현 파일에 기댄다. 옮기면 `spec/4-nodes/4-integration/1-http-request.md`
      frontmatter `code:` 경로를 함께 바꿔야 한다(planner). 파일 헤더에 이 사정을 적어 두었다.
      같은 턴에 `code:` 목록 셋을 맞춘다(`--impl-done` `review/consistency/2026/09/19/22_37_02` convention WARNING 1 · INFO 5): `3-send-email.md` 에
      `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`(이번에 `common/utils/` 에서 옮겼다) · `2-database-query.md` 와
      `3-send-email.md` 에 공용 가드 경로. 그리고 IPv4-mapped IPv6 판정 근거와 NAT64 · SIIT · 6to4 를 막지 않는 경계(실측 — 닿지 않았다)를
      `1-http-request.md` §4 8번 또는 Rationale 에 한 줄(같은 검토 rationale INFO 3 — 지금은 코드 JSDoc · plan 에만 있다).

- [x] **SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로** (developer, 낮음, 2026-09-19 등재 · `/ai-review`
      `review/code/2026/09/19/22_00_32` architecture WARNING 2 — 수렴 예외). `http-request.handler.ts` · `http-redirect.ts` · `database-query.handler.ts` ·
      `database-connection-tester.ts` 는 가드가 던진 것을 **무엇이든** 차단으로 옮긴다. 지금은 가드가 `SsrfBlockedError` 만 던져 동작 차이가 없다 —
      SMTP 가드(`send-email/smtp-host-guard.ts`)만 판정이 아닌 오류를 다시 던진다. 넷을 맞추면 URL 파싱 등 다른 오류의 처분(차단 vs 실패)이 바뀌므로
      호출부마다 기대 동작을 정하고 테스트와 함께. **2026-09-20 해소** `plan/complete/ssrf-catch-instanceof.md` — 넷 + 동반 1건
      (HTTP 연결 테스트의 preflight 를 `try` 안으로). 판정 아닌 오류의 처분: HTTP 노드 · DB 노드 `INTEGRATION_CALL_FAILED` ·
      DB 연결 테스트 `DB_CONNECT_FAILED` · `outboundBlockReason` 은 그대로 던진다. 뮤턴트 다섯으로 판별력 확인(판정 분기 넷 + 타임아웃 신호 생성 순서 하나).

- [ ] **`_product-overview.md` §3.1 의 `NAV-WF-02` · `NAV-WF-06` 상태가 상세 spec 과 어긋난다** (planner, 낮음,
      2026-09-20 등재 · `--impl-prep` `review/consistency/2026/09/20/11_21_16` cross_spec WARNING 1). 카탈로그는
      `NAV-WF-02`(마지막 실행 시간 · 생성일 컬럼)를 `✅` 로 적는데 `1-workflow-list.md` §2.1 은 두 컬럼 모두 «미구현(Planned)»
      이라 하고, 실제 컬럼은 마지막 *실행* 이 아니라 마지막 *수정*(`updatedAt`)이다. `NAV-WF-06`(폴더 · 태그 정리)도 «폴더 관리
      UI 는 아직 없음(필터 조회 전용)» 과 어긋난다 — 다만 근거가 더 약하다. 어느 표가 stale 인지 정하고 한쪽을 고친다.

- [x] **cron 재계산 happy-path 의 결정적 단위 테스트가 없다** (developer, 낮음, 2026-09-20 등재 · `/ai-review`
      `review/code/2026/09/20/11_54_10` INFO 2 · `12_45_31` WARNING 1 — 후자가 이 항목이 닫는 잔여를 실측했다: 연말
      12/31 23:58:30 ~ 01/01 00:00:30 KST 근방 ~2분 동안은 생성 cron 의 값 자체가 e2e 의 «1분 안» 창에 들어와, 재계산이
      없어도 「D. PATCH cron」이 통과한다(거짓 통과). e2e 는 시각을 고정할 수 없어 닫지 못한다).
      **2026-09-20 해소** `plan/complete/sched-recalc-unit.md` — `computeNextRuns` 를 spy 로 두고 cron 변경 · timezone 만
      변경 · **둘 다 아님**(대조군) 세 분기를 고정했다. 세 번째는 1라운드 리뷰가 «항은 둘, 분기는 셋» 을 실측으로
      보여줘서 넣었다(게이트를 `if (true)` 로 무력화해도 아무도 안 죽었다). 뮤턴트 넷 전부 RED. `SchedulesService.update()` 가 cron·timezone 변경 시 `nextRunAt` 을 다시
      계산하는 경로는 e2e 한 케이스(「D. PATCH cron」)에만 걸려 있다 — 단위 테스트는 `computeNextRuns` 를 `[]` 로 mock 하는
      방어 분기만 고정한다(`schedules.service.spec.ts`). `computeNextRuns` 를 spy 로 두고 «새 cron 으로 호출됐는가 · 그 결과가
      `nextRunAt` 에 들어갔는가» 를 보는 단위 테스트 한 건이면 e2e 없이도 회귀가 잡힌다.

- [ ] **가드 고장이 preflight 냐 리다이렉트 홉이냐에 따라 다른 코드로 나간다 — 그 경로의 회귀 테스트도 없다** (developer,
      낮음, 2026-09-20 등재 · `/ai-review` `review/code/2026/09/20/10_38_57` WARNING 1 · 2 — 3라운드 «수렴 예외»).
      `plan/complete/ssrf-catch-instanceof.md` 가 판정/고장을 갈랐는데, HTTP Request 노드에서 **고장이 난 시점**에 따라
      결과가 갈린다: 첫 preflight 는 `INTEGRATION_CALL_FAILED`(마스킹된 message), 리다이렉트 홉은 `followRedirectsSafely` 를
      타고 전송 catch 로 떨어져 `HTTP_TRANSPORT_FAILED`(2라운드에 마스킹은 맞췄다). 연결 테스트는 두 시점이 이미
      `HTTP_CONNECT_FAILED` 로 같다. 고칠 방향 둘: (1) 홉의 비판정 오류도 `IntegrationError('INTEGRATION_CALL_FAILED', …)`
      로 승격해 두 시점을 통일하거나, (2) spec 표에 두 코드를 그대로 명시한다. **함께**: 리뷰어가 뮤테이션으로 실증한
      테스트 공백 — 전송 catch 의 마스킹(`toLogError`)을 되돌려도 스위트가 전부 GREEN 이다(`followRedirectsSafely` 를 거치는
      handler 통합 경로를 보는 spec 이 0건). 홉에서 비판정 오류를 주입해 최종 `error.code` 와 마스킹을 함께 단언하는
      테스트 1건이 둘 다 덮는다. **오늘 도달 불가**다 — 가드가 낼 수 있는 비판정 오류는 `TypeError` 하나뿐이고
      `validateCredentials` 가 그 입력을 API 에서 막는다(같은 plan 의 실측).
      **2026-09-20 보강** (`--spec` `review/consistency/2026/09/20/16_12_45` cross_spec WARNING 1). 방향 (2)를 먼저
      집행해 두 코드를 spec 에 **있는 그대로** 적었다(`plan/complete/spec-draft-integration-error-facts.md`) — 통일 여부는
      여전히 이 항목이 정한다. 그때 **챗 채널 파급을 함께 본다**: `HTTP_TRANSPORT_FAILED` 는
      `spec/conventions/chat-channel-adapter.md` §3.1 에서 `executionFailedThirdParty` 로 매핑되고, 그 문구는
      `spec/5-system/15-chat-channel.md` 의 «외부 서비스 응답을 받지 못했습니다» 다 — 즉 홉의 가드 고장이 그 코드로
      합류하는 동안 **내부 가드의 고장이 외부 서비스 탓으로 사용자에게 전달된다**. 통일(방향 1)은 이 오분류도 같이 닫는다.
      §6 카탈로그 두 행의 문구 보강은 위 spec PR 에서 이미 했다(그 PR 의 `--spec` 3차 INFO 6 지적을 그 자리에서 반영).

- [ ] **가드 «고장» 메시지에는 host/IP 마스킹이 없다 — 판정 분기와 비대칭** (developer, 낮음, 2026-09-20 등재 ·
      `/ai-review` `review/code/2026/09/20/10_09_56` WARNING 1 · INFO 11). 차단 **판정**은 host/IP 를 뺀 고정 문구로
      치환하는데(CWE-209), 판정 아닌 오류는 `sanitizeMessage`(자격증명 패턴만 가린다)를 거쳐 원문이 나간다 —
      `http-request.handler.ts` · `database-query.handler.ts` · `database-connection-tester.ts`. 오늘 가드가 낼 수 있는 유일한
      비판정 오류(`isBlockedHostname` 의 `TypeError`)에는 host/IP 가 없어 실제 유출은 없다(`plan/complete/ssrf-catch-instanceof.md`
      가 그 도달 가능성을 실측했다). 고칠 때 정할 것: 세 곳을 고정 문구로 바꿀지, `sanitizeMessage` 에 host/IP 패턴을
      더할지 — 후자는 전 노드의 오류 문구에 영향을 준다. 같은 결의 잔여: `http-connection-tester.ts` 의
      `describeFailure`→`clampMessage` 경로(이 PR 이 만든 자리가 아니라 그대로 뒀다).

- [x] **`schedule-trigger` e2e 「D. PATCH cron → nextRunAt 재계산」이 하루 1분 창에서 실패한다** (developer, 낮음,
      2026-09-20 등재 · `plan/complete/ssrf-catch-instanceof.md` 의 무관한 e2e 실패로 발견). 테스트는 `0 10 * * *`(Asia/Seoul)로
      만들고 `*/1 * * * *` 로 PATCH 한 뒤 `nextRunAt` 이 **달라졌는지** 본다. 그런데 09:59 KST(=00:59 UTC)에 돌리면 둘 다
      `01:00:00Z` 로 같아 «재계산 안 됨» 으로 읽힌다 — 실측(`_test_logs/e2e-20260920-095855.log`: 기대 ≠ `2026-09-20T01:00:00.000Z`,
      호스트 09:58 KST). 재실행(10:02 KST)은 366 통과. 고칠 방향: 비교를 «다르다» 가 아니라 «분 단위 cron 이 만드는 값인가»
      로 좁히거나(예: 1분 이내 미래), 생성 cron 을 현재 시각과 겹치지 않는 값으로 고른다. 지금 형태로는 매일 그 1분에 CI 가 붉어진다.
      **2026-09-20 해소** `plan/complete/schedule-cron-flake.md` — 생성 cron 을 연 1회로 바꾸고, 판정을 «새 cron 이 만드는
      값인가»(요청 시각부터 1분 안 · 분 경계)로 옮겼다. **옛 값과의 비교는 형태를 막론하고 뺐다** — 네 라운드가 같은 결함
      클래스를 세 번 좁혔고(하루 1분 → 연 1분 → 연 90초), 남은 것은 방향이 반대인 좁은 창뿐이라 위 단위 테스트 항목에 합쳤다.

- [x] **`1-http-request.md` frontmatter `code:` 에 `http-redirect.ts` · 세 에러 표에 «가드의 고장» 트리거** (planner, 낮음,
      2026-09-20 등재 · `--impl-prep` `review/consistency/2026/09/20/09_06_34` convention WARNING 2 · cross_spec INFO 1 ·
      `/ai-review` `review/code/2026/09/20/09_35_16` WARNING 5 · INFO 6). (1) §4 step 9(리다이렉트 5홉 + 홉마다 SSRF 재검증)를
      구현하는 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` 가 `code:` 넷에 없다 — 증거 목록 누락이라
      developer 의 자기-반증형 소정정에 해당하지 않는다. (2) `0-common.md` §4.2 · `1-http-request.md` §4.2 · `2-database-query.md` §6.2
      의 에러 코드 표에 «SSRF 가드가 판정 아닌 오류를 던진 경우 → `INTEGRATION_CALL_FAILED`» 를 한 줄씩 — 구현은
      `plan/complete/ssrf-catch-instanceof.md` 가 넣었고 표만 비어 있다.
      **2026-09-20 해소** `plan/complete/spec-draft-integration-error-facts.md`. (1) `code:` 에는 `http-redirect.ts` 와 함께
      **`http-credentials.ts`** 도 넣었다 — 고치려고 디렉터리를 실측하다 드러난 같은 형태의 누락이다(`--spec` 2차 W1).
      (2) 표는 **시점을 구분해서** 적었다: preflight 는 `INTEGRATION_CALL_FAILED`, 리다이렉트 홉은 `HTTP_TRANSPORT_FAILED`.
      한 코드로 뭉뚱그리려던 첫 안은 `--spec` 1차(`review/consistency/2026/09/20/15_43_51`)가 «열린 결정 선취» 로 CRITICAL
      판정했다. §6 카탈로그의 `HTTP_TRANSPORT_FAILED` · `INTEGRATION_*` 두 행에도 트리거를 함께 적었다.

- [ ] **`5-system/3-error-handling.md` §1.4 공용 카탈로그의 HTTP/DB 행에 `INTEGRATION_*` 계열이 없다** (planner, 낮음,
      2026-09-20 등재 · `--spec` `review/consistency/2026/09/20/16_12_45` cross_spec INFO 2). 방금 네 문서에 채운 «가드의
      고장 → `INTEGRATION_CALL_FAILED`» 상세가 이 다섯 번째 문서에는 없다. 망라 카탈로그가 아니라 직접 모순은 아니지만,
      다음 사람이 그 표만 보면 통합 노드의 `INTEGRATION_*` 를 못 본다.

- [ ] **MakeShop 은 연결 테스트와 노드 런타임이 같은 코드(`MAKESHOP_AUTH_FAILED`)를 쓴다 — «연결 테스트 코드는 별도
      namespace» 관례의 유일한 비-호스트차단 예외** (planner, 낮음, 2026-09-20 등재 · 같은 세션 cross_spec INFO 1).
      `2-navigation/4-integration.md` Rationale «코드 이름» 은 다섯을 «연결 테스트 전용» 으로 열거하는데, MakeShop 은
      인증 실패에서 그 분리를 하지 않는다. 관례의 예외로 적을지, MakeShop 쪽을 분리할지 정한다(후자는 코드 변경).

- [ ] **spec 네 곳의 기존 drift — `--impl-prep` `review/consistency/2026/09/19/21_02_09` WARNING 1~4** (planner, 낮음, 2026-09-19 등재).
      SSRF 가드 통합 착수 전 검토가 scope(`spec/4-nodes/4-integration/`) 주변에서 찾은, 그 변경과 무관한 기존 어긋남:
      (1) `spec/5-system/4-execution-engine.md` §10.1 `IntegrationsService.logUsage` TS 선언에 INT-US-05 `api?: { label?; method?; path? }` 가 없다
      (`0-common.md` §4.1 · `1-data-model.md` §2.10.1 · `11-mcp-client.md` 는 적는다). (2) `spec/conventions/chat-channel-adapter.md` §3.1 실행 실패
      분류표가 `INTEGRATION_*` · `CAFE24_*` · `MAKESHOP_*` · `EMAIL_HOST_BLOCKED` 를 덮지 않는다 — `*_RATE_LIMITED` 가 rate-limit 이 아니라 internal 로
      분류될 수 있다(제품 판단 병행). (3) `spec/conventions/node-output.md` Principle 2 표와 `0-common.md` §6 은 DB `meta.rowCount` 중복을 «허용» 이라
      적는데 `2-database-query.md` §5.1 은 «금지» 로 정했다. (4) 같은 문서 Principle 5 표는 `send_email` 을 «port: undefined(단일 출력)» 로 두는데
      Principle 3.3 · D4 는 `error` 포트를 의무화한다(+ 3.3 열거에 `makeshop` 누락 — INFO 6). 같은 검토의 INFO: DNS 해석 실패 fail-open 이
      어느 spec Rationale 에도 명문화돼 있지 않다 · LLM Client 가 세 번째 SSRF 메커니즘이라는 서술이 `1-http-request.md` §4 콜아웃에 없다.

- [x] **`4-integration.md` §5.3 · §14.1 이 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE` · `INTEGRATION_AUTH_UNSUPPORTED` 를 적지 않는다**
      (planner, 낮음, 2026-09-20 등재 · `--impl-prep` `review/consistency/2026/09/19/23_02_33` cross_spec WARNING 1). HTTP 테스터는 자격증명을
      붙이기 전 `resolveHttpCredentials`(노드와 공유)에서 이 둘로 실패할 수 있다 — 코드는 `IntegrationTestResultCode` 가 이미 담는다
      (`plan/complete/connection-test-codes-and-gaps.md`). §5.3 «결과:» 목록 끝과 §14.1 표에 한 줄씩.
      같은 턴에: §5.9 가 MakeShop 연결 테스트를 Cafe24 와 «정책 동일» 이라 적는데 MakeShop 은 403 을 `MAKESHOP_AUTH_FAILED` 로 묶는다(Cafe24 는
      `CAFE24_INSUFFICIENT_SCOPE` 로 가른다 — `5-makeshop.md` 가 의도로 적은 차이). «동일» 의 범위를 401 재시도 · 카운터 제외로 좁힌다
      (`--impl-done` `review/consistency/2026/09/20/00_07_48` cross_spec INFO 1).
      **2026-09-20 해소** `plan/complete/spec-draft-integration-error-facts.md`. §5.3 에 두 줄(요청 전 실패 두 코드 ·
      가드 고장 → `HTTP_CONNECT_FAILED`), §14.1 에 `INTEGRATION_AUTH_UNSUPPORTED` 행 신설 + `INTEGRATION_INCOMPLETE` 행 보강,
      Rationale «코드 이름» 문단의 «나머지 다섯» 이 이 둘을 배제한다는 것을 한 문장으로 적었다(`--spec` 2차 W1·W3).
      §5.9 는 **새 문장을 덧붙이지 않고 기존 «403 처리 … 동일» 문장 자체를 교체**했다 — 덧붙였으면 한 문단 안에 서로를
      부정하는 두 문장이 남는다. 연결 테스트 경로를 따로 실측해 «상태를 격하하지 않는 것은 같고 **결과 코드만 다르다**» 로
      범위를 좁혔다(`makeshop-api.client.ts` `pingConnection` 403 분기 vs `cafe24-api.client.ts`).

- [ ] **`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`** (planner, 낮음, 2026-09-20 등재 · `--impl-prep`
      `review/consistency/2026/09/20/00_34_58` convention WARNING 1 · 2 · plan_coherence INFO 5 — 컬럼 가드 작업과 무관한 scope 가 끌어온 기존 공백,
      그 경위는 `plan/in-progress/harness-review-gate-followups.md` §O). (1) `1-workflow-list.md` §3.1 `GET /api/folders` 행이 응답 형태를 적지 않는다 —
      구현은 `{ data: FolderDto[] }`, 페이지네이션 없음(`folders.controller.ts` `@ApiOkWrappedArrayResponse`). (2) `2-trigger-list.md` §3 API 표
      `GET /api/triggers/:id/history` 행이 형태 · 상한을 적지 않는다 — 구현은 배열 wrap, 최근 10건(`triggers.service.ts` `.limit(10)`).
      (3) `1-workflow-list.md` frontmatter `pending_plans` 가 완료된 `plan/complete/workflow-duplicate-nodes-edges.md` 를 가리킨다 — 빼면 된다
      (남은 미구현 surface 가 따로 있는지 먼저 확인). 셋 다 사실 정정.

## 종결 조건

**형제 plan 은 이미 종결됐다** (`cce8a188b`, 2026-09-04). `entity-nullable-column-type-mismatch.md`
의 planner 턴 3건(`next_run_at` · `/api/auth/*` · §5.4)을 반영하며 그 세 체크박스를 닫고,
상단 경고문(*"planner 턴 항목이 반영되기 전에는 완료 처리하지 말 것"*)을 해제한 뒤
`plan/complete/` 로 옮겼다 (`--spec` INFO#3 이 요구한 순서 그대로).

**이 draft 자신의 종결 조건**은 위 `## 후속` 체크박스가 전부 닫히는 것이다.

> **아래 표에 개수를 적지 않는다.** 이 자리에 "열려 있는 것은 N개" 라고 쓴 문장이 **두 번
> 연속 낡았다** — 항목을 닫을 때마다 숫자를 따로 갱신해야 하는데 그것을 두 번 다 잊었고,
> 두 번 다 리뷰가 잡았다(`--ai-review` 2R W1 · `18_34_04` W3). 개수는 **`## 후속` 의 미체크
> 체크박스가 단일 진실**이고, 이 표는 그중 열린 것의 성격만 적는다.

| 항목 | 트랙 | 선행 조건 |
|---|---|---|
| §5.4 drift 2단계 — 검증자 없는 응답 DTO | developer | ~~반환 타입 명시~~ 반증 · ~~일반 헬퍼~~ **완료** · 1차 스윕 **완료(2026-09-05)**. 남은 것은 선행 조건이 아니라 스윕이다 — **개수·잔여 목록은 본문 `§5.4 drift 배치 — 2단계` 의 「스윕 1차」 참조**(이 표에 숫자를 적지 않는 이유는 위 경고문) |
| ~~§5.4 가 WS wire 에도 적용되는가~~ | — | **종결(2026-09-04)** — producer 는 이미 §5.4 준수, consumer `?` 는 별개 축 |
| ~~`QueryExecutionDto.workflowId` 죽은 필드~~ | — | **종결(2026-09-04)** — 옵션 A(제거) 채택 |
| ~~`idx_schedule_next_run` → `(workspace_id, next_run_at)`~~ | — | **종결(2026-09-04)** — V110 적용 완료. (a)/(b) 는 둘 다 실측으로 기각됐고 답은 (c) 였다 |

---

## Rationale

### ① 을 planner 턴으로 돌린 이유

developer 가 `spec/` 을 고칠 수 있는 유일한 예외는 **자기가 쓴 예고 문장을 실측으로 반증**한
경우다(CLAUDE.md §자기-반증형 소정정). §2.9 의 `next_run_at` 표기는 developer 가 쓴 문장이
아니라 **선재 문서 오류**이므로 조건 1(내가 썼다)이 깨진다. 나머지 넷을 충족해도 통과시키지
않는다 — 그 조건이 예외를 "실측했으니 고쳤다" 만능 통행증으로 넓히는 것을 막는 장치다.

### ② 를 "규칙 완화" 가 아니라 "예외 성문화" 로 처리하는 이유

§2.2 의 복수형 명사 규칙 자체는 유효하다 — 자원 CRUD 에서 그 규칙이 주는 예측 가능성은 크다.
`/api/auth/*` 는 **자원이 없는 상태 전이**라 애초에 그 규칙의 적용 대상이 아니었다. 규칙을
느슨하게 고치면 자원 CRUD 에서도 verb 경로가 정당화된다 — 그래서 **경계를 좁게 그은 예외**로
적는다. 기존 두 예외가 같은 형태다.

### ③ 에서 "다수를 따르지 않는" 이유

103 vs 17 은 **관행의 증거이지 정합성의 증거가 아니다.** 103곳이 그 형태인 것은 규약이 그렇게
적혀 있었기 때문이고, 규약이 자기 정의와 모순된다는 것이 이번 지적이다. 판정 근거는 다수결이
아니라 **`@ApiPropertyOptional` = `ApiProperty({required:false})`** 라는 구현 사실이다.

> **기각한 대안 — "선례(`@ApiProperty` 17곳)를 문면에 맞춘다"**: 그러면 "상시 존재" 필드가
> OpenAPI 에서 optional 로 나가는 상태가 **규약의 승인 아래** 고착된다. 소비자가 키 부재
> 분기를 쓰게 되고, 그건 §5.4 를 만든 이유(부재 표현을 필드별로 명시적으로 정하기)와 정면으로
> 어긋난다.

### `--spec` 검토가 내 실측을 반박한 것을 기록해 둔다

W5 가 "70 vs 16" 의 집계 기준 부재를 지적하며 재현해 102 vs 17 을 냈다. 확인하니 **내
정규식이 한 줄 데코레이터만 잡고 있었다.** 기준을 적었으면 그 자리에서 드러났을 결함이고,
`swagger.md` §3 Rationale 이 이미 *"집계 기준을 적어 둔다"* 로 경고한 실수다.

수치를 고치는 데서 멈추지 않고 **기준을 본문에 명시**했다 — 다음 사람이 재현해 다른 수를
얻으면 그게 내 실수인지 저장소 변화인지 가릴 수 있어야 한다.

### 세 건을 한 draft 로 묶은 이유

셋 다 **같은 작업(entity nullable 정합화)이 발견한 표기 문제**이고, ①③ 은 "nullable 을 문서가
어떻게 표기하는가" 라는 한 축이다. ② 만 축이 다르지만 같은 파일(`2-api-convention.md`)을
건드리므로 분리하면 같은 파일에 두 PR 이 붙는다.
