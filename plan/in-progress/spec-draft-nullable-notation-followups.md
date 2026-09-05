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
      중복의 **절반**은 이미 걷어냈다 — 계약 캐싱을 `beforeAll` 로 통일했고 DTO 이름을
      `DtoContract` 가 파생하므로 호출부가 문자열을 다시 치지 않는다.

      **함께 볼 것** (`14_39_31` INFO#2): `contractForDto` 는 DTO 하나마다 in-process Nest
      앱을 부트스트랩한다. 지금은 4곳이 전부 `beforeAll` 캐싱이라 무해하지만, 56개로 늘면
      CI 시간에 누적된다 — 헬퍼를 만들 때 DTO 이름 키 메모이제이션을 같이 검토한다.

- [ ] **`User` 엔티티에 컬럼 수준 방어를 둘지 결정** (developer + 보안 판단, 2026-09-05
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
        > 위 배선과 함께 넣은 **23필드 선언이 §5.4 금지 조합**(`@ApiPropertyOptional` +
        > `nullable: true`)이었다. 같은 PR 이 다른 파일에서 "동결, 확대 금지" 라고 적어 둔
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
        > 부수: `ScheduleDto.trigger` 의 wire 형태를 **키 생략**으로 확정했다(종전 `null`
        > 을 내보내 §5.4 를 반대 방향으로 어겼다). `POST /api/schedules` 는 `isActive`
        > 값과 무관하게 `trigger` 를 실어 보낸다 — 종전에는 `isActive: false` 면 트리거를
        > 만들어 놓고 응답에서만 빠졌다.

- [ ] **`CanvasSaveResultDto.nodes`/`.edges` 가 타입 없는 객체 배열** (developer,
      2026-09-05 등재). `@ApiProperty({ type: 'array', items: { type: 'object' } })` 라
      **검증자가 그 아래로 내려가지 않는다** — 캔버스 저장 응답에 어떤 엔티티 필드가
      실려도 계약 검사를 통과한다. e2e 11개 스펙이 이 엔드포인트를 때리므로 배선 자체는
      쉬운데, `NodeDto`/`EdgeDto` 로 선언을 바꾸는 것이 선행이다.

- [ ] **`IntegrationDto.consecutiveNetworkFailures` 노출 중단 검토** (developer,
      2026-09-05 등재). 내부 health 카운터인데 응답에 실려 나간다. **프런트엔드 참조
      0곳**(실측)이라 빼도 소비자가 없지만 **wire 변경**이라 CHANGELOG 를 동반해야 한다.
      이번 PR 은 "선언을 실제에 맞춘다" 범위라 선언만 했다.

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

      `chat-channel-adapter.md:149-151` 의 `durationMs?: number | null` 을 §5.4 위반으로 볼
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

- [ ] **Flyway `mixed=true` 도입 여부** (planner + 인프라, 2026-09-05 등재).
      `CREATE INDEX CONCURRENTLY` 교체에서 **양쪽 위험을 다 피하는** 형태
      (`indisvalid` 로 분기하는 `DO` 블록)는 이 설정 없이는 Flyway 가 거부한다 — 실측 확인.
      대가는 *"한 파일에 transactional/non-transactional 을 섞지 마라"* 가드의 **전역 해제**다.
      110개 마이그레이션을 가진 저장소에서 그 가드를 없애는 판단이라 단독 결정하지 않았다.
      실측·형태 비교는 [`spec-draft-migration-rerun-and-citations.md`](../complete/spec-draft-migration-rerun-and-citations.md) §1.2 에 다 있고 **남은 것은 결정 하나**다.
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
      `review/consistency/2026/09/05/19_59_16` **Critical 1**). **완료 — 이 브랜치가 그
      수정이다** (`dfb2664af` · `cb17f0870` · `a6f582680`).

      `Trigger.notification_secret_v2`(평문 서명 secret)와 `chat_channel_token_v2`(secret
      store ref)가 `GET/POST/PATCH /api/triggers` · `GET /api/schedules`(트리거 조인) 응답에
      **매 요청** 실린다. 엔티티를 그대로 반환하는데 컬럼 스트립이 없다(전역
      `ClassSerializerInterceptor`·`select:false`·`@Exclude()` 모두 0건).

      금지 규범은 이번 turn 이 `secret-store.md §1.1` 로 세웠다 — **저장 형태 예외(평문
      보관)와 노출은 다른 문제**이고, 예외 등재가 노출까지 승인하는 것으로 읽히면 안 된다.

      > **확인 후 닫는다** (등재문이 요구한 절차). `sanitizeForResponse` 가 엔티티 비밀
      > 컬럼 2개 + `config.notification.signing` 키 2개를 지우고, 스케줄 컨트롤러가 조인된
      > 트리거를 참조 4필드로 좁힌다. 두 자리 모두 뮤턴트로 RED 를 실측했고, unit 회귀도
      > 있다(종전 fixture 에는 비밀 필드가 없어 스트립을 되돌려도 전부 그린이었다).
      >
      > `secret-store.md §1.1`(이번 planner 턴 신설)이 그 금지를 규범으로 세웠고, 이
      > 커밋들이 그것을 시행한다.

- [ ] **`4-integration.md §9.1` — `IntegrationDto` 확장 필드 포인터** (planner,
      2026-09-05 등재, `19_08_19` W3 / `19_59_16` W3).
      대상 5필드 선언이 아직 `origin/main` 에 없다(`claude/sweep-response-contract-5ba0ad`).
      **그 브랜치 머지 후** §9.1 에 `1-data-model.md §2.10` 포인터 한 줄을 넣는다.
      `consecutiveNetworkFailures` 는 **FE 미소비 — 제거 후보로 별도 추적 중**이라는 캐비엇을
      함께 적어 나머지 4개와 동급으로 문서화하지 않는다.

- [ ] **`1-data-model.md §2.8` — `notification_secret_v2` 저장 형태 명시** (planner,
      2026-09-05 등재, `19_59_16` INFO#2 / `20_17_57` W4). 그 행은 저장 형태를 안 적는데
      자매 행(`chat_channel_token_v2`)은 *"reference"* 라고 적어 **서술 밀도가 비대칭**이다.
      평문임을 한 줄로 명시하고 [`secret-store.md §1`](../../spec/conventions/secret-store.md)
      비대상 등재로 링크한다.

- [ ] **`6-websocket-protocol.md` 도입 산문** (planner, 2026-09-05 등재). 위 실측에서
      개요 내용이 **실제로 없는** 두 문서 중 남은 하나. `## 1. 연결` 로 바로 시작한다.
      그 문서를 다음에 열 때 두세 줄 도입문을 넣는다 — 형태는 그 문서 관행을 따르면 되고,
      `## Overview` 헤딩이어야 할 이유는 없다(위 실측 참조).

- [ ] **harness: `--spec` 번들이 `spec_impact` 의 `spec/conventions/*` 를 떨군다**
      (harness, 2026-09-05 등재, `review/consistency/2026/09/05/16_21_52` INFO#2).
      `spec_impact` 에 `spec/conventions/swagger.md` 를 명시했는데 **5개 프롬프트 어디에도
      본문이 실리지 않았다** (그 문서에만 있는 헤딩 `### 5-1. 응답 DTO 위치` 로 판정:
      전부 0건. 대조군인 draft 헤딩은 1건이라 판정 명령은 정상). checker 들이 직접 조회로
      보완해 그 라운드는 유효했으나, **`spec_impact` 에 적힌 파일이 번들에서 빠지는 것은
      구조적 결함**이다.

      > 이것은 알려진 클래스의 재발이다 — *"consistency `--spec` 기본 예산이 conventions 를
      > 통째로 떨군다"*. 이번엔 `spec_impact` 명시에도 불구하고 떨궈졌다는 점이 새롭다.

- [ ] **harness: `code:` 블록 리스트의 YAML 주석이 게이트 파서를 조용히 끊는다**
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
