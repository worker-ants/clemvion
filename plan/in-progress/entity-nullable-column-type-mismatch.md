---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-03
owner: developer
status: in-progress
priority: P3
spec_impact:
  - spec/1-data-model.md
  - spec/data-flow/10-triggers.md
  - spec/5-system/2-api-convention.md
---

# `nullable: true` 컬럼인데 TS 타입은 non-null — 엔티티 전반

> **`spec_impact` 주의** — 이 작업 자체는 `spec/` 을 1줄도 바꾸지 않는다(코드 전용).
> 그럼에도 `none` 이 아닌 이유는 자매 plan `update-returning-tuple-shape.md`·
> `backend-lint-gate-broken-on-main.md` 가 확립한 것과 같다: 본문이 **planner 위임으로 spec
> 후속 2건을 스스로 명시**하는데 frontmatter 가 `none` 이면, `complete/` 이동 시
> Gate C(`spec-plan-completion.test.ts`)가 그 값을 그대로 신뢰해 **"spec 영향 없음" 이 잘못
> 확정된다**. **아래 §후속의 [planner 턴] 항목이 반영되기 전에는 완료 처리하지 말 것.**
>
> (처음엔 `none` 으로 두고 "이 배치가 바꾸는 spec 은 0건이라 리스트는 거짓" 이라 판단했는데,
>  그 논거는 자매 plan 에서 이미 제기됐다 기각된 것이다 — 이 필드는 **PR 이 아니라 plan 의
>  라이프사이클**을 가리킨다. `17_45_56` plan_coherence W1, 같은 세트에서 **3번째 재발**.)

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

## 이 작업에서 세 번 반복된 실패 — "확인 없이 완료라고 썼다"

| 라운드 | 내가 쓴 것 | 실제 |
|---|---|---|
| WS PR `12_16_24` | *"배포 런북에서 별도 추적 중"* | 그 자리 항목 2건은 **다른 주제** |
| 배치 1 `15_17_01` | *"plan 이 배치 2 후보로 추적한다"* | plan 에 **이름이 없었다**(실측 0건) |
| 배치 2 `17_09_06` | *"INFO#8 은 W2 정정에 포함됐다"* | 그 줄을 **건드린 적이 없다**(`git show`) |

셋 다 **한 번의 `grep`/`git show` 로 반증되는 주장**이었고, 셋 다 리뷰어가 잡았다(마지막은
3명 중복). 공통점은 "고쳤다/추적된다" 를 **편집 직후 확인 없이** 쓴 것이다.

**규칙**: 완료·추적 주장은 그 문장을 쓰기 **전에** 검증 명령을 돌린다. 결과가 없으면 문장을
바꾸는 게 아니라 **먼저 그 자리를 만든다.**

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

> 배치별 완료 체크박스는 각 배치 절(§배치 2 등)에 있다. 이 목록은 **배치를 가로지르는**
> 항목(기준 결정·후속 위임·리팩터 이연)만 담는다.

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
- [x] **후속 축 — 응답 DTO 가 엔티티 nullable 필드를 non-null 로 문서화한다** — **종결.**
      **"48건" 은 계측 도구의 산물이었다. 실제 결함은 1건이다.**

      > **왜 48 이 나왔나**: 판정을 *필드 이름* 매칭으로 했다. `workflowId` 는 `llm_usage_log`
      > 에서 nullable 이지만 `edge`/`trigger`/`statistics` DTO 의 `workflowId` 는 자기 것이라
      > non-null 이 옳다. 44건이 이런 **모듈 간 동명 충돌**이었다.

      **더 중요한 것 — 전제 자체가 틀렸다.** "엔티티가 nullable 인데 DTO 가 non-null" 은
      그 자체로 결함이 아니다. **쿼리·매퍼가 non-null 을 보장하면 DTO 가 좁은 것이 옳다.**
      실제로 확인한 정당한 사례 셋:

      | 사례 | 왜 정당한가 |
      |---|---|
      | `BackgroundRunNodeExecutionDto.parentNodeExecutionId` | 쿼리가 `WHERE ne.parentNodeExecutionId = ?` 로 **필터**한다 (+ 매퍼에 `?? ''`) |
      | `DismissNotificationResponseDto.dismissedAt` | **dismiss 액션의 응답**이라 방금 `NOW()` 로 세팅한 값이다 (일반 조회용 형제 DTO 는 제대로 `?: string \| null`) |
      | `SessionDto.familyId` | `toDto(row: RefreshToken)` 인데 `RefreshToken.familyId` 는 **non-null**. nullable 인 건 `login_history` 쪽 — **다른 엔티티**다 |

      **판별 질문은 "엔티티가 nullable 인가" 가 아니라 "이 응답 경로가 non-null 을
      보장하는가" 다.** 이건 데이터 흐름을 따라가야 답이 나오므로 정적 가드로 자동화할 수
      없다 — 위 세 사례가 전부 오탐이 된다. **가드를 만들지 않는 이유를 여기 적어 둔다**
      (`--impl-done` `19_02_06` INFO#5 가 제안했던 것).

      **실제 결함 1건 — 조치함**: `WorkspaceInvitationDto.invitedBy`.
      `invited_by` 는 `ON DELETE SET NULL`(V017:15) 이라 **초대자 계정이 삭제되면 NULL** 이
      되는데, 대기 중 초대는 그대로 남고 `workspaces.controller.ts:402` 가 `i.invitedBy` 를
      **그대로 통과**시킨다. Swagger 는 필수 uuid 라고 했다. `ipWhitelist` 와 같은 형태다.
      → §5.4 형태(`@ApiPropertyOptional({ nullable: true })` + `field?: T | null`)로 정정.

      > **FE 가 이미 옳았다** — `frontend/src/lib/api/workspaces.ts:154` 는 처음부터
      > `invitedBy: string | null` 이다. 거짓말한 것은 백엔드 계약뿐이었다.

      > 형제 `acceptedBy` 도 nullable 이지만 **응답 DTO 에 노출되지 않는다**(전수 확인).

      > **캐너리로 고정했다** (`workspaces.controller.spec.ts`). DTO 선언이 옳은 *근거*는
      > "핸들러가 `null` 을 코어션 없이 통과시킨다" 는 **동작**이므로, 그 동작을 테스트가
      > 잡는다. 뮤테이션으로 유효성 확인 — 핸들러에 `?? ''` 를 넣으면 **예측대로 null
      > 테스트만 RED**(실측 1 failed / 13 passed), 대조군은 GREEN 이다.

- [ ] **후속(planner 턴) — §5.4 의 `field?:` 표기와 기존 선례가 어긋난다**
      (`--impl-done` `19_02_06` INFO#1). 규약 §5.4 는 `null`(상시 존재) 필드를
      `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 로 쓰라고 하는데,
      **`field?:` 는 "키가 없을 수 있다" 는 뜻이라 같은 절의 "상시 존재" 정의와 어긋난다.**
      실제로 같은 파일의 선재 `AuthConfigUsageCallDto.sourceIp` 는 `@ApiProperty({ nullable:
      true })` + `sourceIp: T | null`(non-optional) 로 반대 형태다.

      > 배치 3 은 **규약 문면을 그대로 따랐다**(체커가 "되돌릴 필요 없음" 으로 확인).
      > 선례가 아니라 규약을 따른 것이라 developer 판단으로 뒤집지 않는다. 규약 문장을 고칠지
      > `sourceIp` 를 맞출지는 **planner 턴 결정**이다 — `spec_impact` 에 이미 포함돼 있다.

- [x] **후속 — `repo-guards/__tests__/` 의 공용 walker 추출** (리뷰 W5) — **완료.**
      `source-scan.ts` 에 `collectTsFiles(root, { includeSpec })` 를 두고 사본 5개를 없앴다
      (`readdirSync` 잔존 **0**).

      > **다섯 사본은 동일하지 않았다. 네 축에서 갈렸는데 살아있는 것은 하나뿐이었다.**
      >
      > | 축 | 살아있나 | 근거(실측) |
      > |---|---|---|
      > | `.spec.ts` 제외 | **예** | 포함 **1261** vs 제외 **818**, 차이 **443** = `.spec.ts` 수 |
      > | `.d.ts` 제외 | 아니오 | `src` 하위 `.d.ts` **0개** — engine 818 == redis 818 이 이를 증명 |
      > | `node_modules`·`dist` skip | 아니오 | 스캔 루트가 `src` 하위라 애초에 없다 |
      > | `sort()` | 순서만 | 5중 2개만 정렬했다 |
      >
      > 그래서 옵션은 **하나만** 노출하고, 사문이던 두 필터와 정렬은 **항상 켠다** — 어느
      > 사본도 그것들을 *원한* 적이 없고(둘 다 "안 보고 싶다" 필터다), 끄고 있으면 나중에
      > `.d.ts` 가 생겼을 때 조용히 틀린다.
      >
      > **동작 불변을 실측으로 고정했다** — 리팩터 전 5개 walker 의 파일 목록을 캡처해 두고
      > 사후 대조: 507 / 818 / 1261 / 818 / 818 **전부 집합 동일**.

- [x] **후속 — 넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트 가드** — **완료.**
      `widenedEntityFields` + `findStaleSpecCasts` (`nullable-type-lie-cast-guard.ts`).
      엔티티에서 `| null` 필드명을 전수(**135**, 관계 포함)로 뽑아 `.spec.ts` 의
      `<필드>: null as unknown as` 를 대조한다. 저장소 잔존 **0**.

      > **가드가 자기 spec 을 잡았다.** 픽스처의 템플릿 리터럴 안에 있는
      > `parent: null as unknown as Probe` 를 코드로 봤다. 허용목록으로 덮으면 **오판을
      > 목록으로 은폐**하는 것이라(형제 가드 `masked-reject-callers` 가 정확히 그 실수를
      > 했다가 되돌렸다), `stripLiterals` 를 `source-scan.ts` 에 두고 술어에 넣었다 —
      > **리터럴 안의 코드 모양은 코드가 아니다** 는 참인 성질이다.

      > **탐지 능력을 뮤테이션으로 실증했다** (잔존 0 이라 GREEN 은 증거가 아니다):
      > ① `auth.service.spec.ts` 의 `lockedUntil` 캐스트를 되살리니 **파일·필드를 지목하며
      > RED**, ② `stripLiterals` 를 항등으로 바꾸니 자기 spec 을 다시 잡아 **RED**.

## 정본(라이브 스키마) 대조 — 축이 실제로 닫혔음을 확인

배치 1~3 은 전부 **`@Column` 데코레이터가 `nullable: true` 라고 말한 것**을 대상으로 삼았다.
그런데 **진실의 출처는 DB 스키마**이고, 데코레이터는 그것을 미러링한 코드일 뿐이다. 데코레이터가
DB 를 잘못 미러링하고 있으면 세 배치 전부가 그 컬럼을 못 본다.

그래서 e2e 스택을 띄워 `information_schema` 와 전수 대조했다 (**엔티티 컬럼 424개 / DB 확인
424개 = 100%**, 미확인 0).

| 축 | 결과 |
|---|---|
| [A] DB 는 nullable 인데 `@Column` 에 `nullable: true` 가 없다 | **0건** |
| [B] DB 는 nullable 인데 TS 타입이 non-null | **0건** |
| [C] `@Column` 은 `nullable: true` 인데 DB 는 NOT NULL | **0건** |

**[A] 가 0 이므로 "데코레이터만 봐서 좁았다" 는 내 의심은 반증됐다** — 세 배치의 대상 집합은
정본과 일치했다. [B] 가 0 이므로 이 plan 의 축은 **정본 기준으로 닫혔다**(종전 주장은 AST
스캔 기준이었다).

> **여기서도 내 손 관측이 한 번 틀렸다.** `ON DELETE SET NULL` 을 grep 해 나온 줄들을 보고
> `schedule.trigger_id` 가 nullable 이라고 판단했는데, 실제로는 `NOT NULL ... ON DELETE
> CASCADE` 였다 — **테이블 없이 줄만 보고** 같은 이름의 컬럼에 갖다 붙인 것이다. 파서가
> 나를 반증했고, 다시 라이브 스키마가 파서를 확정했다.
>
> 중간에 쓴 마이그레이션 SQL 파서는 **커버리지가 88%(424 중 374)** 에 그쳤다. 그 상태로
> "1건" 이라 결론지었으면 나머지 12% 를 안 본 채 단정한 것이 된다. **정본이 접근 가능하면
> 파서를 고치지 말고 정본을 써라.**

**재현**: `make e2e-up` 후 `information_schema.columns` 를 덤프해 엔티티 AST 와 대조.
가드로 만들지 않은 이유는 이 검사가 **라이브 DB 를 요구**하기 때문이다(단위 테스트 불가).
현행 `nullable-type-lie-cast` 가드가 데코레이터↔TS 축을 상시로 막고 있고, [A] 가 0 이라
데코레이터는 지금 DB 를 정확히 미러링한다.

## 배치 3 — 잔여 전량 (완료 · 축 종결)

**기준: "잔여 전량".** 배치 2 가 끝난 시점의 남은 축은 *"전부 안 넓혀진 6파일"* 이었는데,
그 6파일의 nullable 필드가 **합해서 8개**뿐이라 따로 술어를 세울 대상이 아니었다.

### 그 6파일이 왜 하나도 안 넓혀졌나 — 의미적 이유는 없다

착수 전 이 질문을 먼저 봐야 한다고 plan 에 적어 뒀다. 답은 **"앞선 두 술어가 닿지 않았을
뿐"** 이다. 배치 1 은 *캐스트를 강제하는 필드*, 배치 2 는 *파일 내 비대칭*을 골랐는데, 이
6파일은 nullable 필드가 **전부** 안 넓혀져 있어 파일 안에 대비가 없었다. 넓히면 안 되는
필드는 하나도 없었다.

| 측정 (AST, 배치 3 전 → 후) | 값 |
|---|---|
| `nullable:` 필드를 가진 엔티티 파일 | **33 → 33** |
| 전부 넓혀짐 | 27 → **33** |
| 혼재 | 0 → 0 |
| 전부 안 넓혀짐 | 6 → **0** |
| 넓힌 필드 | **8** (column 7 · relation 1) |

`tsc` 비-spec 오류 **0** · 가드 **12/12** · ratchet **198/37 → 197/36**.

### `type:` 은 1건만 필요했다 — 나머지는 실증된 예외

`audit_log.ip_address` 만 `type: 'varchar'` 를 붙였다. 마이그레이션(`V001:326` `VARCHAR(45)`)과
형제 선례(`login-history`·`refresh-token` 가 같은 컬럼을 `type: 'varchar', length: 45` 로 선언)가
일치한다.

`folder.parentId` 는 `type:` 없이 넓혔다 — 같은 파일에 `@JoinColumn({ name: 'parent_id' })` 가
있어 배치 1 의 **JoinColumn 예외**에 해당한다. 그 예외를 신뢰하기 전에 **실측했다**: 지금
이 예외에 기대고 있는 컬럼이 **4개**(`execution.triggerId`·`executedBy`·`parentExecutionId`,
`node-execution.parentNodeExecutionId`)이고 전부 배치 2 에서 넓혀져 **e2e 부팅(292 PASS)을
통과한 채 프로덕션에 있다**. 예외는 문서상 주장이 아니라 4건으로 검증된 것이다.

### 파급이 없던 것이 아니라, 소비처가 이미 방어하고 있었다

배치 2 는 `redact-stored-error.ts` 가 `tsc` 로 터졌는데 이번엔 비-spec 오류가 **0** 이었다.
"안 쓰는 필드였나" 를 갈라야 해서 소비처를 직접 봤다 — 아니었다:
`auth-configs.service.ts:356` 은 `ac.ipWhitelist?.length` 로, `workflows.service.ts:733` 은
`e.condition ?? null` 로 **이미 null 을 다루고 있었다**. 타입만 거짓말하고 있었던 것이다.

**제거한 캐스트는 두 곳이다** (리뷰 INFO#4 — 초판은 spec 것만 적었다):

| 위치 | 무엇 | 어떻게 드러났나 |
|---|---|---|
| `folders.controller.ts:114` | `dto as Partial<Folder>` (+ 유휴 `Folder` import) | **lint** `no-unnecessary-type-assertion` |
| `folders.service.spec.ts:14` | `parentId: null as unknown as string` | 배치 말 캐스트 훑기 |

`UpdateFolderDto.parentId` 는 **이미 `string | null`** 이었다 — 컨트롤러 캐스트는 순전히
엔티티의 거짓말을 메우려던 것이었다. `tsc` 는 둘 다 못 잡았고 lint 와 손 훑기가 잡았다.

### 새로 드러난 축 — 응답 DTO 가 nullable 필드를 non-null 로 문서화한다

`AuthConfigDto.ipWhitelist: string[]` 인데 엔티티·spec(`1-data-model.md:621` `String[]?`) 은
둘 다 nullable 이고, 서비스는 실제로 `null` 을 내보낸다. **같은 DTO 안의 `lastUsedAt?: string
| null` 과도 비대칭**이다. Swagger 계약이 거짓인 셈이다.

- ~~**이 PR 에서 고치지 않았다.**~~ **`ipWhitelist` 한 건은 리뷰 1R W1 로 조치했다**
  (`af1651264`). 스코프 아웃했던 판단을 뒤집은 이유는 두 가지다 — (1) `AuthConfigsController`
  가 엔티티를 **DTO 매핑 없이 그대로 반환**해 `null` 이 실제로 wire 에 나간다(리뷰어가 댄
  사실, 내가 안 봤다), (2) [API 규약 §5.4](../../spec/5-system/2-api-convention.md) 가
  *"앞으로 도입·**변경되는** 필드에 적용"* 이라 **이 diff 가 nullability 를 바꾼 필드는 규약
  적용 대상**이다. 나머지는 이 diff 가 안 건드리므로 그 조건에 해당하지 않는다 — 자의적인
  "한 자리만 고치기" 가 아니라 규약이 그은 선이다.
- 잔여 실측(조치 후 **재측정**, 뺄셈 아님): 엔티티 nullable 필드명에 대해 응답 DTO 가
  non-null 로 선언한 자리가 **48건 / 26파일**.

  > **초판은 "49건(12파일)" 이라 적었다. 건수는 조치로 하나 줄어 맞지만 파일 수는 처음부터
  > 틀렸다** — 그때 스크립트가 `most_common(12)` 로 **상위 12개만 출력**했는데 그 출력 길이를
  > 파일 수로 읽었다. 내가 세지 않은 것을 세었다고 쓴 것이다. 실제 파일 수는 **26** 이다.

> ## ⚠️ 이 절의 결론은 **폐기됐다** — §할 일 체크리스트의 「후속 축」 항목을 보라
>
> 아래 두 문단은 이 축을 **미해결 48건 + 가드 신설 필요**로 판정했다. **둘 다 반증됐다**:
> 48 은 이름 매칭이 만든 수이고 실제 결함은 **1건**(`WorkspaceInvitationDto.invitedBy`,
> 조치 완료), 가드는 **원리적으로 만들 수 없다**(쿼리 필터·액션 응답·다른 엔티티 세 형태가
> 전부 오탐이 된다). 근거·측정은 §할 일 쪽에 있다. 아래는 **당시 판단의 이력**으로만 남긴다.

- ~~⚠️ **이 48 은 아직 작업 항목이 아니다** — 필드 *이름* 매칭이라 서로 다른 엔티티의 동명
  필드가 섞여 있다. 엔티티별 귀속을 먼저 해야 수가 확정된다.~~ → **귀속했더니 1건이었다.**
- ~~**이 축에는 가드가 없다** (리뷰 2R INFO#5). 축을 열 때 엔티티 nullable ↔ 응답 DTO 선언을
  대조하는 가드를 함께 만든다.~~ → **만들지 않는다.** 판별 질문이 "엔티티가 nullable 인가"
  가 아니라 "이 응답 경로가 non-null 을 보장하는가" 라서 정적으로 답이 안 나온다.

## 배치 2 — 비대칭 해소 (완료)

**기준: 한 엔티티 파일 안에 `nullable: true` 인데 일부는 넓혀지고 일부는 안 넓혀진 것.**
기계적으로 검출되고 그 술어로 **닫힌다**. 후속 (d) `Schedule.lastRunAt` 이 자연히 포함된다.

| 측정 (AST) | 값 |
|---|---|
| `nullable:` 컬럼을 가진 엔티티 파일 | **33** |
| 혼재(일부만 넓혀짐) | **9** ← 배치 2 대상 |
| 전부 넓혀짐 | 18 |
| 전부 안 넓혀짐 | **6** ← 배치 3 후보 |
| 배치 2 가 넓힌 필드 | **30** (column 24 · relation 6) |

### plan 의 우려 하나가 반증됐다

*"relation 은 `null` 대신 `undefined` 관례일 수 있다"* 고 (b) 에 적어 뒀는데, 이미 넓혀진
relation **6건 전부 `| null`** 이고 **전부 `type:` 없이** 프로덕션에서 돈다. 관례가 이미
`| null` 로 확립돼 있어 따로 뺄 이유가 없었다 — relation 은 `design:type` 이 아니라 대상
엔티티에서 타입을 얻으므로 `type:` 도 불요하다.

### 배치 1 의 가드가 곧바로 값을 했다

`findUntypedNullableColumns` 가 **`type:` 누락 7건**을 즉시 잡았다 — 배치 1 에서는 같은 클래스를
**e2e 부팅 실패로만** 알았다. DB 를 실측해(`duration_ms`=integer, 나머지 varchar) 명시했다.

### 타입 확장이 남의 전제를 무너뜨렸다

`shared/utils/redact-stored-error.ts` 의 docstring 이 *"시그니처가 `| null` 을 안 적는 것은
**의도**다 — 엔티티가 두 컬럼을 non-null 로 선언하므로 **정적으로는** null 이 올 수 없고"* 라며
**전제를 명시**하고 있었다. `NodeExecution.outputData`/`error` **두 컬럼**을 넓히자 그 전제가 거짓이 됐고 `tsc` 가
2건으로 잡았다.

> **초판은 여기에 `inputData` 도 적었다** — 틀렸다(리뷰 W1). 그 컬럼은 `default: {}` 이고
> `nullable: true` 가 **아예 없어** 애초에 대상이 아니었다. AST 스캔은 `nullable: true` 만
> 고르므로 옳았고 **내 서술만** 틀렸다. 공교롭게도 원래 docstring 이 "**두** 컬럼" 이라
> 적고 있어 대조하면 바로 드러나는 자리였다.

시그니처(`maskIfPresent` · 제네릭 제약)를 넓히고 **원문을 취소선으로 보존한 채** 정정했다.
그 파일의 `== null` 가드는 이제 *"런타임 방어"* 가 아니라 **정적으로 도달하는 실경로**다.

- [x] **배치 2 기준** — "파일 내 비대칭" 으로 확정, 9파일 30필드 완료
- [x] **(d) `Schedule.lastRunAt`** — 배치 2 에 포함돼 해소
- [ ] **가드 사각지대 — `.spec.ts` 의 낡은 캐스트** (배치 2 리뷰 W2·W3). 가드는 spec 을
      **의도적으로 제외**한다(fixture 가 부분 객체를 캐스트하는 것은 정당하다). 그런데 필드가
      `| null` 로 넓혀지면 그 fixture 의 캐스트는 **불필요해지는데** 가드가 구조적으로 못 본다 —
      이번에 3건(`lastRunAt` ×2 · `lastTriggeredAt`)을 손으로 찾았다.
      잡으려면 캐스트가 겨누는 **엔티티·필드를 역추적**해야 해서 텍스트 스캔으로는 부족하다.
      배치가 끝날 때마다 `grep 'as unknown as' --include='*.spec.ts'` 로 훑는 것이 현실적이다.

      > **배치 3 에서 수행 — 다만 첫 시도의 대상 집합이 좁았다.**
      > 처음엔 *그 배치가 넓힌 8필드*만 훑어 `folders.service.spec.ts:14` 1건을 찾았다.
      > 그런데 **낡은 캐스트는 어느 배치가 넓혔든 남는다** — 배치 1 이 넓힌
      > `User.lockedUntil` 을 겨눈 `auth.service.spec.ts:58` 이 그대로 살아 있었다.
      >
      > **훑기의 대상은 "이 배치가 넓힌 것" 이 아니라 "지금 넓혀져 있는 것 전체"** 다.
      > 엔티티에서 `| null` 필드명을 전수(**122종**) 뽑아 `.spec.ts` 의
      > `<필드>: null as unknown as` 를 대조하면 기계적으로 닫힌다. 그렇게 돌리니 저장소
      > 전체 잔존이 위 2건뿐이었고 둘 다 제거했다.
      > 각각 대조군으로 유효성 확인 — 엔티티를 되돌리면 오류 **2건 · 7건**이 난다.

- [x] ~~**`notification.entity.ts` 의 `resourceType` `@Column` 키 순서**~~ (배치 2 리뷰 3R
      INFO#1) — **won't-do. 배치 3 에서 실측하니 지적이 거꾸로였다.**

      > **전제 두 겹이 틀렸다.**
      > (1) *"이번 배치가 재포맷했다"* — 배치 2 는 재정렬한 적이 없다. `git show 713b69483`
      >     으로 보면 원래 `{name, nullable, length}` 였던 것에 **`type:` 한 키를 삽입**했을
      >     뿐이고 `nullable`·`length` 의 상대 순서는 보존했다. `resource_type` 은 **원래부터**
      >     `{name, length, nullable}` 이었다. 불일치는 배치 2 **이전부터** 있었다.
      > (2) *"형제 3곳에 맞춰라"* — 전수로 세니 저장소 다수는 반대다:
      >     `name→type→length→nullable` **17** vs `name→type→nullable→length` **10**
      >     (그 밖에 `name→length→nullable→type` 3 등). 즉 `resourceType` 이 **다수 형태**이고,
      >     맞추라고 지목된 쪽이 소수다.
      >
      > 무관한 키를 재정렬하는 편집은 scope 확대이기도 하다. **고치지 않는다.**

- [x] **배치 3 기준** — **"잔여 전량"으로 확정.** 남은 것이 8필드뿐이라 축이 종결됐다.
      상세는 §배치 3 참조.

      > 아래는 **착수 전 적어 둔 원문 후보 검토**다. 실제 기준은 위 한 줄이고, 이 후보들은
      > 이력으로 남긴다 — 다만 **(e) 는 살아 있는 항목이었다**(바로 아래 참조).
      >
      > 남은 축은 **"전부 안 넓혀진 6파일"**. 배치 2 와 달리 파일 안에 비교 기준이 없어
      > **다른 술어가 필요하다**(그 6파일이 왜 하나도 안 넓혀졌는지 먼저 봐야 한다).
      > 후보: (a) 엔티티 단위 · (b) relation 7건 · (c) null 검사가 실재하는 필드
      > (**이름 중복 문제 선결 필요**) · ~~(d) `Schedule.lastRunAt`~~(배치 2 해소) ·
      > **(e) `auth.service.spec.ts:58` 의 `lockedUntil: null as unknown as Date`**.

- [x] **(e) `auth.service.spec.ts:58` 캐스트 제거** — 배치 3 에서 해소.

      > **하마터면 묻을 뻔했다.** 위 후보 목록을 "폐기·흡수됨" 으로 접으려다 실측하니 (e) 는
      > **아직 살아 있었다**. 원인은 내 훑기 방법이 좁았던 것 — 배치 말 캐스트 훑기를 *그
      > 배치가 넓힌 필드*로만 돌려서, 배치 1 이 넓힌 `User.lockedUntil` 을 겨눈 캐스트를
      > 못 봤다. **훑기는 넓혀진 필드 전체(122종)를 대상으로 해야 한다** — 그렇게 다시 돌리니
      > 저장소 전체에서 이 1건이 유일한 잔존이었다.
      > 대조군: `User.lockedUntil` 을 `Date` 로 되돌리면 그 spec 에 오류 **7건**.

      > **(d)·(e)는 리뷰가 내 거짓 주장을 잡아 추가됐다** (`15_17_01` W1). 배치 1 RESOLUTION 에서
      > 둘을 *"plan 이 배치 2 후보로 추적한다"* 고 썼는데 **plan 본문에 이름이 없었다**(`lastRunAt`
      > 실측 0건). 이번 세션에서 **두 번째**다 — WS PR 에서도 "배포 런북에서 추적 중" 이라 적고
      > 추적처를 안 만들었다. **"추적된다" 는 쓰기 전에 grep 으로 확인한다.**
- [x] 각 배치마다 `tsc` **비-spec 소스 오류 0** 을 직접 확인 (ratchet 만으로는 부족)
      — **매 배치 반복 규칙이라 체크박스는 "세 배치 모두 지켰다" 는 뜻**이다(배치 1·2·3 각
      절과 커밋 로그에 실측 기재). 새 배치가 생기면 그 배치에서 다시 확인한다.
