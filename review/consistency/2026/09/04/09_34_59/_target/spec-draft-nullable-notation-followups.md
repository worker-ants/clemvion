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
---

# nullable 표기 후속 3건 (planner 턴)

> 출처: `entity-nullable-column-type-mismatch.md` 가 developer 권한 밖으로 남긴 3건.
> 세 건 모두 **developer 가 실측으로 발견했으나 `spec/` 쓰기 권한이 없어** 이월된 것이다.

---

## ① `spec/1-data-model.md` §2.9 — `next_run_at` 이 non-null 로 표기돼 있다

### 실측

| | 값 |
|---|---|
| 마이그레이션 (`V001:168`) | `next_run_at TIMESTAMPTZ` — **NOT NULL 없음** |
| 엔티티 (`schedule.entity.ts:42`) | `nextRunAt: Date \| null` |
| spec §2.9 | `next_run_at \| Timestamp` — **`?` 없음** |
| 바로 아래 줄 `last_run_at` | `Timestamp?` — 같은 표를 쓰면서 표기가 갈린다 |
| 이 문서의 `?` 표기 | **128곳** (관례 확립돼 있음) |

**NULL 이 실제로 쓰이는 경로 2곳** (코드 실측):

- `schedule-runner.service.ts:189-190` — 실행 직후 다음 tick 재계산에서 `CronExpressionParser.parse`
  가 던지면 `catch { schedule.nextRunAt = null; }`
- `schedules.service.ts:241` — cron/timezone 수정 시 `computeNextRuns` 가 빈 배열이면 `null`

### 변경안

`spec/1-data-model.md` §2.9 표의 `next_run_at` 타입을 `Timestamp` → **`Timestamp?`** 로.
설명 열에 NULL 의미를 덧붙인다:

```
| next_run_at | Timestamp? | 다음 실행 예정 시각. cron 파싱이 실패하면 NULL — 발사는 BullMQ job scheduler 가 하므로 이 컬럼이 NULL 이어도 실행에는 영향이 없다 (§data-flow 10-triggers §3.2) |
```

곁들여 `spec/data-flow/10-triggers.md` §3.2 에 한 줄 보강 — 그 절은 이미
*"`next_run_at` 은 발사 트리거가 아니라 **UI 표시용 정보성 컬럼**"* 이라고 적고 있으므로,
NULL 이 되는 조건만 명시하면 자연히 이어진다.

---

## ② `spec/5-system/2-api-convention.md` §2.2 — `/api/auth/*` 액션 네임스페이스 예외 부재

### 실측 — verb-style 경로 20개

§2.2 는 "리소스는 복수형 명사" 를 규칙으로 두고 **두 예외**만 명시한다
(RPC-style sub-channel action · `/api/external/*` 인증 family). `/api/auth/*` 의 다음 20개는
어느 쪽에도 포섭되지 않는다:

```
register · verify-email · resend-verification · login · login/totp
2fa/setup · 2fa/verify · 2fa/disable · logout · refresh
forgot-password · reset-password · check-email · oauth/:provider/callback
2fa/webauthn/{register,authenticate}/{options,verify} · 2fa/webauthn/recovery
2fa/webauthn/recovery-codes/regenerate
```

> `/api/auth/workspaces/:id/switch` 는 **이미 RPC-style 예외에 명시**돼 있다 — 이번 대상 아님.
> `oauth/providers` · `2fa/webauthn/credentials{,/:id}` 는 복수형 리소스라 규칙 준수다.

### 변경안 — 세 번째 예외 조항

§2.2 표에 행을 하나 더한다:

```
| **예외 — 인증 액션 네임스페이스**: `/api/auth/{action}` 은 자원 CRUD 가 아니라 **인증 상태 전이**(자격 검증·세션 발급/파기·비밀번호 재설정·2FA 등록/해제)를 호출하는 액션 네임스페이스다. 상태 전이는 조작할 "자원" 이 없거나(로그인) 자원을 노출하면 안 되므로(비밀번호 재설정 토큰) 복수형 명사로 표현할 수 없다 — 규칙 위반이 아니라 명시된 예외다. SoT: [§1 인증/인가](./1-auth.md) | `/api/auth/login`, `/api/auth/refresh`, `/api/auth/2fa/verify` |
```

**왜 예외로 성문화하는가** — 이 20개는 되돌릴 수 없다(공개 wire 계약이고 FE·SDK 가 의존한다).
규칙이 현실을 설명하지 못하면 다음 사람은 둘 중 하나를 한다: 규칙을 무시하거나, 지키려고
멀쩡한 경로를 바꾸거나. 예외를 적는 편이 둘 다 막는다.

---

## ③ `spec/5-system/2-api-convention.md` §5.4 — 자기 정의와 어긋나는 DTO 표기

### 지적의 요점

§5.4 는 부재 표현 두 가지를 정의한다:

| 표현 | 정의 (현행 문면) |
|---|---|
| `null` (키 present) | 이 필드는 응답 계약에 **상시 존재**하며, 지금은 값이 없다 |
| 키 생략 | present-when-available — 값이 있을 때만 동봉 |

그런데 DTO 선언 규칙은 이렇게 적혀 있다:

> `null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`

**`field?:` 와 `@ApiPropertyOptional` 은 "키가 없을 수 있다" 는 선언이다.** "상시 존재" 로
정의한 필드에 그것을 쓰라고 하니 같은 절 안에서 앞뒤가 맞지 않는다.

### 이것이 취향 문제가 아닌 근거 — 구현 실측

```
node_modules/@nestjs/swagger/.../api-property.decorator.js:52
  return ApiProperty({ ...options, required: false });
```

`@ApiPropertyOptional` 은 **`required: false` 를 내보낸다.** 따라서 현행 문면을 따르면
"상시 존재" 필드가 OpenAPI 에서 **`required: false`** 로 문서화된다 — 생성기가 그 필드를
optional 로 만들고, 소비자는 키 부재를 처리하는 코드를 쓴다. **wire 사실과 다르다.**

의미상 옳은 형태는 `required: true` + `nullable: true`, 즉:

```ts
@ApiProperty({ nullable: true })
field: T | null;
```

### 저장소 실측 — 다수가 문면을 따르고, 소수가 옳다

| 형태 | 건수 |
|---|---|
| `@ApiPropertyOptional({nullable:true})` + `field?: T \| null` (**현행 문면**) | **70** |
| `@ApiProperty({nullable:true})` + `field: T \| null` (**의미상 옳음**) | **16** |

`AuthConfigUsageCallDto.sourceIp` 등 16곳이 소수지만 맞다.

### 변경안

§5.4 의 DTO 선언 규칙 줄을 **두 케이스로 갈라** 정정한다:

```
- DTO 선언이 wire 를 반영해야 한다:
  - **키를 생략**하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` 금지)
  - **`null` 을 쓰는(상시 존재)** 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`
    — `@ApiPropertyOptional` 은 `ApiProperty({ required: false })` 의 별칭이라
    (`@nestjs/swagger` 구현) 상시 존재 필드에 쓰면 OpenAPI 가 `required: false` 로 나가
    이 절의 "상시 존재" 정의와 모순된다.
```

### 마이그레이션은 **이 문서가 강제하지 않는다**

정정하면 기존 **70곳**이 새 문면과 어긋난다. 그 70곳은 *당시 규약을 정확히 지킨 것*이므로
"위반" 이 아니라 **규약 변경에 따른 drift** 다. 일괄 변경은 응답 계약(OpenAPI `required`)을
70곳에서 동시에 바꾸는 일이라 별도 developer plan 으로 분리한다 — 본 draft 는 SoT 를 고치고
drift 규모를 기록하는 데서 멈춘다.

> **§5.4 의 소급 면제 조항이 이 결정을 뒷받침한다** — *"본 규칙은 앞으로 도입·변경되는
> 필드에 적용한다"*. 정정된 문면도 같은 조항 아래 놓이므로, 기존 70곳은 그 필드를 손댈 때
> 자연히 정리된다.

---

## Rationale

### ① 을 planner 턴으로 돌린 이유

developer 가 `spec/` 을 고칠 수 있는 유일한 예외는 **자기가 쓴 예고 문장을 실측으로 반증**한
경우다(CLAUDE.md §자기-반증형 소정정). §2.9 의 `next_run_at` 표기는 developer 가 쓴 문장이
아니라 **선재 문서 오류**이므로 그 예외에 해당하지 않는다. 조건 1(내가 썼다)이 깨지면 나머지
넷을 충족해도 통과시키지 않는다 — 그 조건이 예외를 "실측했으니 고쳤다" 만능 통행증으로
넓히는 것을 막는 장치이기 때문이다.

### ② 를 "규칙 완화" 가 아니라 "예외 성문화" 로 처리하는 이유

§2.2 의 복수형 명사 규칙 자체는 유효하다 — 자원 CRUD 에서 그 규칙이 주는 예측 가능성은
크다. `/api/auth/*` 는 **자원이 없는 상태 전이**라 그 규칙의 적용 대상이 아니었을 뿐이다.
규칙을 느슨하게 고치면 자원 CRUD 에서도 verb 경로가 정당화된다 — 그래서 **경계를 좁게 그은
예외**로 적는다. 기존 두 예외(RPC-style sub-channel · 인증 family)가 같은 형태다.

### ③ 에서 "다수를 따르지 않는" 이유

70 vs 16 은 **관행의 증거이지 정합성의 증거가 아니다.** 70곳이 그 형태인 것은 규약이 그렇게
적혀 있었기 때문이고, 규약이 자기 정의와 모순된다는 것이 이번 지적이다. 판정 근거는 다수결이
아니라 **`@ApiPropertyOptional` = `ApiProperty({required:false})`** 라는 구현 사실이다.

> **기각한 대안 — "선례(`sourceIp` 16곳)를 문면에 맞춘다"**: 그러면 "상시 존재" 필드가
> OpenAPI 에서 optional 로 나가는 상태가 **규약의 승인 아래** 고착된다. 소비자가 키 부재
> 분기를 쓰게 되고, 그건 이 절이 §5.4 를 만든 이유(부재 표현을 필드별로 명시적으로 정하기)와
> 정면으로 어긋난다.

### 세 건을 한 draft 로 묶은 이유

셋 다 **같은 작업(entity nullable 정합화)이 발견한 표기 문제**이고, ①③ 은 둘 다 "nullable 을
문서가 어떻게 표기하는가" 라는 한 축이다. ② 만 축이 다르지만 같은 파일(`2-api-convention.md`)
을 건드리므로 분리하면 같은 파일에 두 PR 이 붙는다.
