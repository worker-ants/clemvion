# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `RESOLUTION.md` 가 "배치 2 로 넘긴다"고 적은 후속 항목 2건이 실제 plan 트래커에는 **이름으로 등재돼 있지 않다** — 다음 배치 작업자가 찾을 수 없다
  - 위치: `review/code/2026/09/03/14_44_15/RESOLUTION.md` (INFO#8 · INFO#11, gate 65행 이하 "## 미조치 (판단 유지)" 블록) vs `plan/in-progress/entity-nullable-column-type-mismatch.md` (gate 146행 이하 "## 할 일")
  - 상세: `RESOLUTION.md` 는 두 항목을 "plan 이 추적한다"·"배치 2 로 넘긴다"고 명시적으로 단언한다.
    1. INFO#8: `schedule.lastRunAt` 비대칭 — "**plan 이 배치 2 후보로 추적한다**"
    2. INFO#11: `nullable-type-lie-cast-guard.ts` 의 `collectScanTargets` docstring 이 "테스트 fixture 캐스트 12건 전부 정당"이라 적는데, 이번 diff 로 `User.lockedUntil` 이 `Date | null` 로 넓혀지면서 `auth.service.spec.ts:58` 의 `lockedUntil: null as unknown as Date` 캐스트가 이미 불필요해졌다(`mockUser: Partial<User>` 이므로 캐스트 없이도 타입체크 통과) — "**spec 캐스트 정리는… 배치 2 로 넘긴다**"

    그런데 실제 plan 문서의 "배치 2 후보" 목록(gate 155~158행)은
    ```
    (a) 엔티티 단위(execution.entity.ts 10건 · user.entity.ts 잔여 3건),
    (b) relation 7건,
    (c) null 검사가 실재하는 필드
    ```
    세 갈래뿐이고, `schedule.lastRunAt` 도 `auth.service.spec.ts:58` 의 낡은 캐스트도 **문자열로 언급되지 않는다.** `collectScanTargets` docstring 자체도 이번 diff 에서 그대로("2026-09-03 실측 12건") 남아 있어, 코드 쪽에도 "1건은 이제 불필요" 라는 각주가 없다.

    이 저장소가 이미 겪은 결함 클래스와 동일하다 — "미룬 항목을 그 턴에 `plan/` 에 적지 않으면 사라진다"(5건 유실 전례). 여기서는 정확히 그 형태로, RESOLUTION 이 "tracked" 라고 서술한 두 항목이 실제로는 어디에도 이름으로 남아 있지 않다.
  - 제안: `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "배치 2 후보" 아래에 두 항목을 이름으로 추가한다 — 예: `(d) schedule.lastRunAt`(nullable 이지만 미확장), `(e) auth.service.spec.ts:58 의 lockedUntil 캐스트 정리(collectScanTargets docstring "12건" 갱신 동반)`. 또는 최소한 `nullable-type-lie-cast-guard.ts` 의 docstring 에 "1건은 `lockedUntil` 확장으로 이미 불필요 — 개별 정리는 안 함" 각주를 남긴다.

- **[INFO]** 이번 배치(타입 확장 8건 + `type: 'varchar'` 4건 추가 + 회귀 가드 신설)가 `CHANGELOG.md` 에 반영되지 않았다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` (gate 71행 "## 배치 1 — 캐스트를 강제하던 8필드 (완료)")
  - 상세: `CHANGELOG.md:63` 에 정확히 같은 클래스의 선례가 있다 — *"부수로 `Execution.error` 의 타입을 `\| null` 로 정정했다. DB 는 처음부터 `nullable: true` 였는데…"*. 이번 배치도 같은 결함 클래스(엔티티 `nullable: true` 컬럼 vs TS non-null 타입)를 8건 정정하고, 부팅을 깨뜨렸던 `type:` 누락 4건까지 함께 고쳤다. 다만 wire 응답 스키마·API 동작에는 영향이 없는 순수 내부 타입 정합화이고(`schedule-response.dto.ts` 의 `nextRunAt?: string \| null` 은 이미 nullable), 저장소 관례상 CHANGELOG 는 주로 wire-facing/동작 변화를 기록하므로 필수는 아니다.
  - 제안: 필수 아님. 남기려면 "부수로" 한두 줄(예: "User/Schedule 의 nullable 컬럼 타입 8건을 정정하고 부팅을 깨뜨렸던 `type:` 누락 4건을 함께 고쳤다. `null as unknown as X` 캐스트 재발 방지 가드를 추가했다")을 고려.

- **[INFO]** `source-scan.ts` 에서 새 함수 쌍(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`)이 기존 `countRawUpdateReturning`/`hasRawUpdateReturning` 페어링 사이에 끼어 문서 탐색 인접성이 깨졌다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:135-172`
  - 상세: 이 파일은 "count 함수 정의 바로 아래 has 래퍼" 관례를 지켜 왔는데(파일 헤더의 `{@link}` 주석도 이 인접성을 전제), 이번 diff 는 `countRawUpdateReturning`(112~133)과 그 짝 `hasRawUpdateReturning`(170~172) 사이에 새 쌍(135~168)을 끼워 넣었다. 코드 정확성 문제는 아니고 유지보수성 리뷰 관점(형제 리뷰어)과 겹치는 지적이지만, 문서 탐색성(다음 사람이 `{@link}` 를 따라갈 때의 인접 가정) 측면에서도 경미하게 유효하다.
  - 제안: 조치 불요(RESOLUTION.md 가 이미 "다음에 이 파일을 만질 때" 로 판단 유지). 새 함수 쌍은 파일 끝에 추가하는 편이 인접성을 지킨다.

## 검증 메모 (읽기 전용, 저장소 변경 없음)

이번 리뷰는 `grep`/`Read` 읽기 전용 검증만 수행했다(저장소에 아무것도 쓰지 않았고, `git status --short` 로 변경 없음 확인).

- `null as unknown as X` 캐스트가 비-spec 소스에 **0건** — `source-scan.ts`/`nullable-type-lie-cast-guard.ts` 내 주석·정규식 리터럴만 매치, 실제 캐스트는 없음(claim 일치).
- `User` 엔티티의 4개 컬럼(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)에 `type: 'varchar'` 가 실제로 명시돼 있음 — plan/RESOLUTION 의 "Critical fix 적용" 서술과 현재 코드 상태 일치.
- `Execution.error`(`execution.entity.ts:80-81`)가 `@Column({ type: 'jsonb', nullable: true })` 로 `type:` 을 명시하는 선례 확인 — 가드 docstring 의 인용 정확.
- `NodeExecution.parentNodeExecutionId`(`node-execution.entity.ts:92-96`)가 `type:` 없이도 `@JoinColumn({ name: 'parent_node_execution_id' })` 와 같은 컬럼명을 공유해 예외로 면제된다는 서술 확인 — 가드/plan 문서의 근거와 실제 코드 일치.
- `totp.service.ts::disable()`, `schedules.service.ts` 의 재계산 분기 등 캐스트 제거 지점 주변 기존 주석은 코드와 계속 일치(오래된 주석 없음).
- 신규 함수(`countNullAsUnknownAsCasts`/`collectScanTargets`/`findUntypedNullableColumns` 등)의 JSDoc 은 "왜·왜 이 위치·무엇을 못 보는가"를 촘촘히 남긴 고품질 문서화 — 이 저장소 관례에 부합.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 자체는 배치 1 완료 서술, e2e 부팅 실패 사고, 재발 가드 근거를 정확하고 상세하게 기록했다(수치 재현 다수 일치) — 위 WARNING 은 "배치 2 후보" 목록의 **누락 항목 2건**에 국한된다.

## 요약

캐스트 제거(8건)와 `type:` 누락 Critical fix(4건)를 포함한 이번 배치는 코드 자체의 문서화(신규 함수 JSDoc, plan 문서의 실측·근거 기록)는 이 저장소 평균 이상으로 촘촘하고 인용된 수치도 코드와 대부분 일치한다. 다만 직전 리뷰 라운드(`14_44_15`)의 `RESOLUTION.md` 가 "plan 이 추적한다"·"배치 2 로 넘긴다"고 단언한 후속 항목 2건(`schedule.lastRunAt` 비대칭, `auth.service.spec.ts:58` 의 낡은 캐스트 및 그 결과로 부정확해진 `collectScanTargets` docstring 의 "12건 모두 정당" 주장)이 실제 plan 트래커 어디에도 이름으로 남아 있지 않다 — 이 저장소가 반복해 겪은 "미룬 항목이 적히지 않아 유실되는" 결함 클래스와 정확히 같은 형태다. CHANGELOG 미기재는 저장소 관례상 필수가 아니라 INFO 수준이고, 나머지는 경미한 문서 인접성 문제뿐이다.

## 위험도

LOW
