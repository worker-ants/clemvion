---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-03
owner: developer
status: in-progress
priority: P3
spec_impact: none
---

# `nullable: true` 컬럼인데 TS 타입은 non-null — 엔티티 전반

> 출처: `#1269`(`change-password` 코드 정렬) 작업 중 발견. `User.passwordHash` 하나를 고치려다
> **같은 형태가 46건**임을 실측했다. 그 PR 은 캐스트를 fixture 팩토리 한 곳으로 모으는 선에서
> 멈췄고(backend ratchet **199/38 → 198/37**), 타입 자체는 여기로 이월한다.

## 무엇이 문제인가

DB 컬럼은 `nullable: true` 인데 TS 필드는 `string`·`Date` 같은 **non-null** 로 선언돼 있다.
런타임에는 `null` 이 실제로 들어오므로 **타입이 실제보다 좁다** — 컴파일러가 막아 줄 것 같은
자리에서 막아 주지 않고, `null` 을 다루는 테스트 fixture 는 캐스트 없이는 타입체크를 통과하지
못한다.

`User.passwordHash` 가 전형적이다 — 엔티티 **자신의** `validatePasswordHashFormat` 이
`this.passwordHash === null` 을 검사한다. 즉 코드가 null 을 전제하는데 타입만 아니라고 한다.

## 실측 (2026-09-03)

| 항목 | 값 |
|---|---|
| `nullable: true` 직후 필드가 non-null 로 선언된 자리 | **46건** |
| `User.passwordHash` 사용처(비테스트) | **33곳** |

> **휴리스틱 계수다.** `*.entity.ts` 에서 `nullable: true` 다음 3줄 안의 필드 선언을 정규식으로
> 봤다. 데코레이터가 여러 줄이거나 타입이 별칭이면 놓칠 수 있으니 **하한**으로 읽어라.

## 선례 — 이 저장소는 같은 클래스를 이미 두 번 고쳤다

- `Execution.error` → `Record<string, unknown> | null` (CHANGELOG: *"DB 는 처음부터
  `nullable: true` 였는데 타입만 그것을 안 적고 있었다"*)
- `llm-usage-log.workflowId` · `executionId` → `string | null`

즉 **처방은 확립돼 있고**, 남은 것은 범위 판단이다.

## 왜 `#1269` 에서 안 했나

`passwordHash` 하나만 넓혀도 **33 사용처**에 파급되고, 그 PR 의 승인 범위는
"`change-password` 실패 코드 정렬" 이었다. 타입 확장은 그 범위 밖이고, 섞으면 리뷰가
둘 다 흐려진다.

## 결정 (2026-09-03) — **점진**, 기준은 "타입이 이미 강제하고 있는 캐스트"

사용자 결정: **점진**. 우선순위 기준은 착수하며 **더 나은 것으로 바뀌었다.**

초안은 *"`null` 분기를 실제로 쓰는 필드 우선"* 이었는데, 그 기준은 순위가 흐릿하다 —
null 검사 수를 세 보니 이름이 여러 엔티티에 겹쳐(`description`·`finishedAt`·`durationMs`·
`outputData`) **사용처 수치가 합산돼 신뢰할 수 없었다**(내 정규식이 `.<이름>` 만 봤다).

대신 **`null as unknown as X` 이중 캐스트를 강제하는 필드**를 기준으로 삼았다. 그 캐스트는
타입이 거짓말한다는 **기계적으로 검출 가능한 증거**이고, 배치가 그 술어로 **닫힌다**.

### 재측정 (AST, 2026-09-03)

| 측정 | 값 |
|---|---|
| `nullable: true` + non-null 타입 (TS AST) | **46** (column 39 · relation 7) — 초판 정규식 46 과 일치 |
| `null as unknown as X` 캐스트 | **8** |
| `strictNullChecks` | **true** — 넓힘이 타입상 유의미하다 |

> **`strictNullChecks` 를 먼저 확인했다.** 꺼져 있었다면 이 작업 전체가 문서 효과뿐이었다.

## 배치 1 — 캐스트를 강제하던 8필드 (완료)

`User` 7 + `Schedule` 1. 타입을 넓히고 캐스트 8건을 전부 제거했다.

**타입 오류가 0건 늘었다** — `strictNullChecks` 가 켜져 있는데도. 즉 **런타임 코드는 이미
null 을 올바로 다루고 있었고 타입만 거짓말하고 있었다.** (ratchet 이 아니라 `tsc` 로 직접
확인했다 — ratchet baseline 37파일에 **비-spec 소스가 0개**라 그것만으로는 프로덕션 타입
오류를 못 본다.)

## ⚠️ 타입만 넓히면 **런타임이 깨진다** — e2e 만 잡았다

배치 1 을 커밋한 뒤 e2e 가 부팅 실패를 냈다:

```
DataTypeNotSupportedError: Data type "Object" in "User.passwordHash"
is not supported by "postgres" database.
```

TypeORM 은 `design:type` 메타데이터로 컬럼 타입을 추론하는데 **`string | null` 은 `Object` 로
방출된다**(실측: `length` 유무 무관, `Date | null` 도 동일). `@Column` 에 `type:` 이 없으면 그
`Object` 가 그대로 쓰여 부팅이 죽는다.

**lint · unit · build · `tsc` 가 전부 통과했다.** 오직 e2e 만 잡았다 — 타입 검사로는 원리적으로
못 보는 **런타임 메타데이터** 문제다.

> 저장소가 이미 넓혀 둔 컬럼(`Execution.error` · `llm-usage-log.workflowId` ·
> `User.pendingEmail`)은 **전부 `type:` 을 명시**하고 있었다. **관례가 있었는데 안 따랐다.**

DB 를 실측해(`information_schema` → `character varying`) `type: 'varchar'` 를 4건에 붙였다.
나머지 4건은 이미 `timestamptz` 등을 명시하고 있었다.

### 배치 규칙 — 이제 두 단계다

1. 타입을 `| null` 로 넓힌다
2. **같은 `@Column` 에 `type:` 이 있는지 확인한다** — 없으면 DB 실제 타입을 조회해 명시한다

## 회귀 가드 — 이 클래스는 이제 스스로 닫힌다

캐스트 8건을 걷어내도 **조용히 돌아올 수 있다.** ratchet 이 그 자리를 안 보기 때문이다
(baseline 37파일 중 **비-spec 0개** — 설계상 맞다).

- 술어는 `common/__test-utils__/source-scan.ts` 가 소유한다 — 그 모듈이 *"세 번째 가드가
  생겨도 여기만 고치면 되도록"* 이라고 자기 docstring 에 적어 둔 자리다. 손수 정규식을 새로
  짜지 않고 형제 술어(`hasRawUpdateReturning`)와 **같은 모양**으로 넣었다.
- 가드는 `repo-guards/__tests__/` 의 **guard+spec 2종 관례**를 따른다.

### 가드를 `.claude/tests/` 에 두려다 옮겼다 — 거기선 발화하지 못한다

처음엔 harness 테스트로 썼다. 그런데 `harness-checks.yml` 의 `changes.pathspecs` 가
**`codebase/backend/**` 를 덮지 않는다** — backend 소스만 고친 PR 에서는 그 워크플로가 아예
안 돌아 **가드가 한 번도 실행되지 않는다.** `backend-checks.yml` 이 `codebase/backend/**` 를
덮으므로 그쪽으로 옮겼다.

> 이 저장소가 반복해 데인 *"게이트가 자기 자신을 트리거하지 못한다"* 의 변종이다 — 이번엔
> 트리거 대상이 게이트 파일이 아니라 **게이트가 읽는 파일**이었다.

가드는 **두 술어**를 갖는다:

| 술어 | 잡는 것 |
|---|---|
| `countNullAsUnknownAsCasts` | 이중 캐스트가 돌아오는 것 |
| `findUntypedNullableColumns` | `\| null` 인데 `type:` 이 없는 것 — **위 부팅 실패의 클래스** |

**뮤테이션**: 프로덕션 캐스트 되돌림 → **RED**. `type:` 제거 → **RED**. 주석 전용 줄은 통과,
**코드 뒤 인라인 주석은 잡는다**(양방향 대조군).

### 예외 하나 — 관계가 타입을 공급하는 컬럼

`NodeExecution.parentNodeExecutionId` 는 `\| null` 이고 `type:` 이 없는데도 **정상 부팅한다**
(오래 그 형태였고 e2e 가 계속 통과했다). 그 컬럼이 같은 엔티티의 `@ManyToOne` + `@JoinColumn`
이 쓰는 컬럼이라 TypeORM 이 관계에서 타입을 얻기 때문이다.

**허용목록이 아니라 기계적 예외**다 — `@JoinColumn({ name })` 과 컬럼명이 **정확히 일치**할
때만 면제한다. 그 경계도 대조군이 지킨다(다른 컬럼명이면 면제되지 않는다).

## 할 일

- [x] **일괄 vs 점진** — 점진 (사용자 결정 2026-09-03)
- [x] **우선순위 기준** — "이중 캐스트를 강제하는 필드" 로 확정 (초안 기준은 측정 불가로 폐기)
- [x] **배치 1** — 캐스트 강제 8필드 완료, 캐스트 8건 제거
- [ ] **후속(planner 턴) — `spec/1-data-model.md` §2.9 `next_run_at` 표기 정정**
      (`--impl-done` W1). `:260` 이 `Timestamp` 인데 바로 아래 `:261` `last_run_at` 은
      `Timestamp?` 다(이 문서의 nullable 관례는 `?`, 총 26곳). **DB 는 처음부터
      `nullable: true`** 였으므로 선재 문서 오류이고, 배치 1 이 그 nullable 을 코드·테스트로
      **고정**하면서 간극이 드러났다.
      **developer 권한 밖**이다 — 내가 쓴 문장이 아니라 자기-반증형 소정정 예외에 해당하지
      않는다. 곁들여: `spec/data-flow/10-triggers.md §3.2` 에 "cron 파싱 실패 시 `next_run_at`
      은 NULL(정보성 컬럼이라 발사 무관)" 한 줄 보강.
- [ ] **후속(planner 턴, 이 작업과 무관) — `2-api-convention.md §2.2` 에 `/api/auth/*`
      액션 네임스페이스 예외 조항** (`--impl-done` 최종 라운드 W2). `/api/auth/{verb}` 15개
      이상이 §2.2 명명 규칙의 명시된 두 예외(RPC-style `{id}` 필수 / `/api/external/*`)
      어디에도 포섭되지 않는다. **이 PR 과 무관한 선재 gap 이고 이번 검토가 최초 기록**이라
      여기 적어 둔다 — 다른 plan 에 등재된 곳이 없다.
- [ ] **후속 — `repo-guards/__tests__/` 의 공용 walker 추출** (리뷰 W5). 디렉터리를 재귀
      스캔해 `.ts` 를 모으는 로직이 `collectScanTargets` 로 **5번째 사본**이 됐다.
      `source-scan.ts` 는 "**세는**" 축을 한 곳에 모았지만 "**모으는**" 축에는 같은 원칙이
      적용돼 있지 않다. 형제 가드 4개를 함께 건드려야 해 이 배치에 넣지 않는다.
- [ ] **배치 2 기준을 정한다** — 캐스트 축이 소진됐으므로 다음 축이 필요하다. 후보:
      (a) 엔티티 단위(`execution.entity.ts` 10건 · `user.entity.ts` 잔여 3건),
      (b) relation 7건(`ManyToOne`/`OneToOne` — `null` 대신 `undefined` 관례일 수 있어 별도 조사),
      (c) null 검사가 실재하는 필드 — **단 이름 중복 문제를 먼저 해결해야 한다**(엔티티별로 세야 함),
      **(d) `Schedule.lastRunAt`** — `nullable: true` 인데 타입은 `Date` 다. 같은 엔티티의
      `nextRunAt` 만 배치 1 에서 넓혀 **한 파일 안에 비대칭**이 남았다,
      **(e) `auth.service.spec.ts:58` 의 `lockedUntil: null as unknown as Date`** — 배치 1 이
      `User.lockedUntil` 을 넓혔으므로 이 캐스트는 **이제 불필요**하다(그 fixture 는
      `Partial<User>` 라 캐스트 없이 통과한다)

      > **(d)·(e)는 리뷰가 내 거짓 주장을 잡아 추가됐다** (`15_17_01` W1). 배치 1 RESOLUTION 에서
      > 둘을 *"plan 이 배치 2 후보로 추적한다"* 고 썼는데 **plan 본문에 이름이 없었다**(`lastRunAt`
      > 실측 0건). 이번 세션에서 **두 번째**다 — WS PR 에서도 "배포 런북에서 추적 중" 이라 적고
      > 추적처를 안 만들었다. **"추적된다" 는 쓰기 전에 grep 으로 확인한다.**
- [ ] 각 배치마다 `tsc` **비-spec 소스 오류 0** 을 직접 확인 (ratchet 만으로는 부족)
