# RESOLUTION — entity nullable 배치 1 리뷰

대상 SUMMARY: 위험도 **CRITICAL** · Critical **1** · Warning **5** · INFO 11

**Critical 1건 + WARNING 4건 조치, 1건 후속 등재.**

## Critical — 앱이 부팅을 못 했다. **e2e 만 잡았다**

`| null` 로 넓힌 4개 컬럼이 `@Column` 에 `type:` 을 명시하지 않아 TypeORM 이
`design:type` 리플렉션의 `Object` 를 그대로 컬럼 타입에 대입 →
`DataSource.initialize()` 가 `DataTypeNotSupportedError` 로 즉사한다.

**lint · unit · build · `tsc` 가 전부 통과했다.** 타입 검사로는 원리적으로 못 보는 **런타임
메타데이터** 문제다. requirement·testing 두 reviewer 가 각각 독립 재현했다.

> **관례가 이미 있었는데 안 따랐다.** 저장소가 이미 넓혀 둔 컬럼(`Execution.error` ·
> `llm-usage-log.workflowId` · `User.pendingEmail`)은 **전부 `type:` 을 명시**한다. plan 에
> "선례가 확립돼 있다" 고 적어 놓고 그 선례의 절반만 봤다.

DB 를 실측해(`information_schema` → `character varying`) `type: 'varchar'` 를 4건에 붙이고
e2e 로 부팅을 확인했다(**292 passed**).

가드도 그 클래스까지 덮도록 확장했다 — `findUntypedNullableColumns`.
**예외 하나**(`NodeExecution.parentNodeExecutionId`)는 추측 대신 원인을 찾아
(`@JoinColumn` 이 같은 컬럼을 써 TypeORM 이 관계에서 타입을 얻는다) **허용목록이 아니라
컬럼명 일치 기반 기계적 예외**로 넣었고, 그 경계도 대조군이 지킨다.

## W1 — 대조군이 실제 프로덕션 파일을 변형하고 있었다

형제 가드 3개는 전부 `os.tmpdir()` 합성 fixture 를 쓰는데 내 것만 `users.service.ts` ·
`user.entity.ts` 를 `writeFileSync` 로 고쳤다가 복원했다.

**지적이 맞다는 것이 곧바로 증명됐다** — `eslint --fix` 가 데코레이터를 여러 줄로 바꾸자
테스트의 `.replace()` 가 **조용히 no-op** 이 돼 **전체 스위트에서만** 2건이 실패했다.
개별 실행에선 안 보였다. **무효 뮤턴트**다.

합성 fixture(`withFixture`)로 바꾸면서 **여러 줄 데코레이터 케이스**도 함께 고정했다 —
그게 바로 나를 문 형태다.

## W2·W3·W4 — 내가 바꾼 줄들의 커버리지가 비어 있었다

TypeORM `update()` 는 `undefined` 필드를 SET 절에서 **통째로 생략**한다 — `null` 과 의미가
다르다. 그래서 `null` → `undefined` 회귀는 **조용히 통과**하고, 결과는 *"소비된 토큰이 DB 에
남는다"* · *"잠금이 안 풀린다"* · *"옛 실행 시각이 남는다"* 다.

| # | 자리 | 추가 | 뮤턴트 |
|---|---|---|---|
| W2 | `verifyEmail` — 인증 토큰 소거 | `update` 인자 단언 | **RED** |
| W2 | `resetPassword` — **성공 경로 테스트 자체가 없었다** | 성공 경로 신설 | **RED** |
| W3 | `resetLoginAttempts` — 잠금 해제 | 인자 단언 | **RED** |
| W4 | `schedule-runner` — 무효 cron catch 분기 | 분기 도달 테스트 | **RED** |
| W4 | `schedules.service` — cron 변경 재계산 | 분기 도달 테스트 | **RED** |

전부 `toBeNull()` 로 단언한다 — `toBeFalsy()` 면 `undefined` 회귀를 통과시킨다.

> 이 뮤테이션도 **처음엔 무효였다.** 셸 `${m%%:*}` 가 값 안의 `:` 에서 잘라 치환이 안 됐고
> GREEN 이 나왔다. 그 GREEN 을 증거로 쓰지 않고 치환을 검증하는 방식으로 다시 걸었다.

## 후속 등재 (W5)

`repo-guards/__tests__/` 의 디렉터리 walk 로직이 `collectScanTargets` 로 **5번째 사본**이 됐다.
`source-scan.ts` 는 "**세는**" 축을 한 곳에 모았지만 "**모으는**" 축에는 같은 원칙이 없다.
형제 가드 4개를 함께 건드려야 해 이 배치에 넣지 않고 plan 에 등재했다.

## 미조치 (판단 유지)

- **INFO#1** 리뷰 중 관측된 미커밋 변경 — 정확히 이 Critical 의 fix 다. 이 커밋에 흡수됐다.
- **INFO#3** 가드가 자기 정의 파일을 스캔하는데 정규식 리터럴의 `\b` 덕에 우연히 오탐이 없다 —
  맞는 지적이다. 다만 지금은 spec 제외로 가드 spec 자신은 대상 밖이고, 술어 파일은 실측 0건이다.
- **INFO#6** 신규 함수 쌍이 기존 페어링 사이에 끼어 인접성이 깨졌다 — 형제 술어와 **같은 모양**
  으로 붙이려다 그렇게 됐다. 파일 끝 이동은 다음에 이 파일을 만질 때.
- **INFO#8** `schedule.lastRunAt` 비대칭 — plan 이 배치 2 후보로 추적한다.
- **INFO#11** 가드 docstring 의 "spec 캐스트 12건 전부 정당" 이 1건 낡았다 — `lockedUntil` 확장으로
  `auth.service.spec.ts` 의 1건이 이제 불필요하다. 정확한 지적이나 spec 캐스트 정리는 이 배치
  범위 밖이라 배치 2 로 넘긴다.

## 검증

lint · unit(backend **9,250**) **PASS** · backend ratchet **198/37** ·
`tsc` 비-spec 소스 오류 **0** · e2e **292** (부팅 복구 확인) ·
뮤테이션 **7축 RED**(캐스트 · type 누락 · null→undefined 5곳).
