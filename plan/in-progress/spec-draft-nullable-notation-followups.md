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
  # 본문 「… 귀속 표기가 부정확해졌다」 항목이 정정을 요구하는 두 파일(그 항목이 **2곳 한정**이라고
  # 범위까지 적고 있다). 같은 실패 모드를 이 파일이 이미 한 번
  # 겪었다 (`review/consistency/2026/09/06/16_29_00` INFO#2 — 소급 등재로 고쳤다) —
  # 재발 원인은 **항목을 추가할 때 frontmatter 를 함께 보지 않는 것**이다.
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/4-nodes/7-trigger/providers/discord.md
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

      `PROJECT.md:40-41` 은 두 ratchet 을 *"backend/frontend `*.ts(x)` 변경 시"* 필수로
      적는다. 그런데 `run-test.sh` 의 4단계(lint/unit/build/e2e)에는 **없다.** developer
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

      현 문면(`PROJECT.md:315`)은 `신규 헬퍼: codebase/backend/test/helpers/<name>.ts` 뿐이다.
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
      또한 **신규 검증 분기 2건**(`chatChannel` 최초 부착 차단 → `details.field='chatChannel'` ·
      provider 전환 차단 → `details.field='provider'`)이 §5.4.1 표와 `2-trigger-list.md` PATCH
      에러 표에 미등재다(`--impl-done` `review/consistency/2026/09/11/00_21_57` W3).

- [ ] **동시 PATCH 가 `trigger.config` 를 잃을 수 있다 (lost update) — 방금 닫은 fail-open 이 이 경로로 재발 가능**
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

- [ ] **`setupChatChannel` 귀속 표기 3곳이 T2 이동으로 낡는다** (planner, 2026-09-11 등재 ·
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

- [ ] **옮긴 로그 메시지가 아직 `TriggersService:` 접두를 달고 있다** (developer, 2026-09-11 등재).
      `chat-channel-binder.service.ts` 의 경고 4개가 `` `TriggersService: …` `` 리터럴로 시작한다 —
      logger 컨텍스트는 `ChatChannelBinderService` 인데 메시지가 다른 클래스를 말한다.
      **T2 가 일부러 남겼다**: 바꾸면 관측 가능한 출력이 달라져 *"순수 이동"* 주장이 약해진다.
      이 리터럴을 단언하는 테스트는 **0건**이라(실측) 정정은 안전하다. 다음에 그 파일을 손댈 때.

- [ ] **`run-test.sh <미정의 단계>` 가 exit 0 을 낸다** (developer/harness, 2026-09-11 등재).
      `.claude/tools/run-test.sh all` 을 돌리니 `status=NOT_DEFINED` 를 **stderr 로만** 찍고
      **종료 코드 0** 으로 끝났다 — usage 는 `<lint|unit|build|e2e>` 다. 오타 한 번이
      *"4단계 통과"* 로 보이는 **거짓 GREEN** 이고, 실제로 이 턴에서 한 번 속을 뻔했다.
      처방: `NOT_DEFINED`(및 `CONFIG_MISSING`)는 비-0 종료. harness 라 리뷰 게이트가 안 무니
      검증은 `python3 -m pytest .claude/tests -q`.

- [ ] **chat-channel 도메인 규칙이 제네릭 `TriggersService`(1855줄)에 계속 쌓인다** (developer,
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
      > | **T2 — secret 쓰기·ref 보존** | `setupChatChannel` · `teardownChatChannel` | **6개** | **이월** — `ChatChannelBinderService`(Nest provider, `triggers/` 안) |
      > | (범위 밖) | `rotateBotToken` · `cleanupRotatedChatChannelTokens` · `tryRevokeOldBotToken` | repo·audit·BullMQ | **영구 잔류** — 엔드포인트 오케스트레이션이라 옮기면 그 협력자까지 끌고 간다 |
      >
      > 따라서 이 PR 뒤 `TriggersService` 의 chat-channel 메서드는 **5개**(이월 2 + 잔류 3)이고
      > `TriggersService` 는 1,881 → **1,585줄**이다(이동 커밋 `2ae81077c` 시점에 측정 —
      > 이후 세 커밋은 이 파일을 건드리지 않았다).
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

- [ ] **`slack.md`·`discord.md` 의 `TriggersService.assertInboundSigningPlaintextByProvider`
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

- [ ] **`translateSetupChannelError` 가 discord verify_key 불일치를 502 로 떨어뜨린다**
      (developer, 2026-09-11 등재 · `/ai-review` `review/code/2026/09/11/15_31_54` W3).
      **재현했다**: `discord.adapter.ts` 는 `'BOT_TOKEN_INVALID: Discord verify_key 가 등록된
      public key 와 불일치'` 를 던지는데 **숫자가 없어서** 판별식 `/\b(401|403)\b/` 에 안 걸리고
      fallback `CHAT_CHANNEL_SETUP_FAILED`(502) 로 간다. 의도는 400 `BOT_TOKEN_INVALID` 다.
      **이동이 만든 회귀가 아니다**(이동 전부터 테스트 0건) — 캐너리로 현재 동작을 고정해
      뒀으므로 고치면 그 테스트가 RED 가 된다.
      처방 후보: (a) 판별식을 `BOT_TOKEN_INVALID` 리터럴까지 보게 확장 (b) adapter 가 status 를
      메시지에 싣게 통일. **(b) 가 근본이다** — 판별식이 문자열을 추측하는 구조 자체가 이 결함의
      원인이고, (a) 는 다음 provider 에서 같은 일이 난다.

- [ ] **`chat-channel-input-rules.ts` 의 구조 정리 6건** (developer, 2026-09-11 등재 ·
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

- [ ] **`chat-channel-input-rules.spec.ts` 잔여 보강 5건** (developer, 2026-09-11 등재 ·
      `/ai-review` `review/code/2026/09/11/16_16_44` W2 + INFO 3~6). 전부 같은 파일·같은 성격이라
      한 번에 처리한다:
      (a) `as never` 캐스팅 제거 — `tsc --noEmit` 실측상 **불필요**하고(진단 197건 동일)
      *"오버로드는 캐스팅 없이 못 부른다"* 는 오해를 준다.
      (b) `mode:'update'` × 내부 필드 3종(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)
      조합 — 통합 스펙이 이미 잡지만 이 파일 단독으로는 R-CC-21 표면을 못 덮는다.
      (c) `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard — 뮤테이션 시
      142건 GREEN. 다만 DTO 검증이 선행 차단해 **도달 불가능한 방어 코드**로 보인다(그 판정도 함께).
      (d) `translateSetupChannelError` 의 non-Error 입력 분기 + `details.reason` **값** 단언.
      (e) provider별 **label 문구** 미단언 — label 스왑 뮤턴트가 아직 통과한다.

- [ ] **리뷰 in-flight 중에 같은 워크트리에서 뮤테이션을 돌리지 않는다** (프로세스,
      2026-09-11 등재 · `/ai-review` `review/code/2026/09/11/16_16_44` 관측). 그 라운드에서
      reviewer **8명 이상**이 *"자신이 만들지 않은 일시적 뮤테이션"*(정규식 스왑 등)을 공유
      워킹트리에서 관측했다 — **내가 검증용 뮤테이션을 리뷰와 겹쳐 돌린 결과**다.
      이번엔 전원이 복원 명령 없이 관측만 했고 판정도 커밋 상태 기준이라 영향이 없었지만,
      **reviewer 가 유령을 쫓을 수 있다**(기존 교훈: 병렬 리뷰어가 서로를 오염시킨 사고).
      처방 후보: 뮤테이션을 별 워크트리에서 돌리거나, 리뷰 완료 후로 순서를 고정.

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

- [ ] **하드닝: 트리거 비밀 컬럼 목록이 3중 독립 사본이다** (developer, 2026-09-10 등재,
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

- [ ] **회귀 방어: `type: 'schedule'` 트리거의 `workflow` 양성 커버리지가 저장소 전체에 0건**
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

- [ ] **정리: 캐너리 두 파일의 주석 표기·성격** (developer, 2026-09-10 등재, `/ai-review` 4라운드
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

- [ ] **관례 정비: e2e teardown 이 `secret_store` 고아 row 를 남긴다** (developer, 2026-09-10
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
