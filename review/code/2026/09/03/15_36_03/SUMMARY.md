# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 발견 없음. 이전 두 리뷰 라운드(`14_44_15`, `15_17_01`)의 CRITICAL(부팅 실패)·WARNING(테스트 커버리지 공백·프로덕션 파일 변형) 이슈는 모두 이번 diff 시점 코드에서 실제 해소됨을 7개 reviewer 전원이 각자 소스를 직접 열어 재확인했다. 남은 것은 전부 INFO 수준(가독성·중복·미해결 미기재 등)이며, forced whitelist 7명 전원 결과가 확보되어 있어 화이트리스트 미이행에 따른 은닉된 위험은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| (없음) | — | — | — | — |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/1-data-model.md` §2.9 `next_run_at`이 물음표 없이(non-nullable 표기) 기술돼 있으나, DB·backend 런타임(cron 파싱 실패 시 `null` 대입)·frontend(`nextRunAt?: string`, optional) 전 스택이 이미 nullable 로 취급 중이었고 이번 diff 가 `Schedule.nextRunAt: Date \| null` 로 그 실제 동작을 타입에 정직하게 반영했을 뿐이다. 코드가 옳고 spec 표기가 낡은 경우. | `spec/1-data-model.md:260` (`next_run_at \| Timestamp`) | 조치 불요(이미 등재됨) — `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158`에 developer 권한 밖(자기-반증형 소정정 예외 미해당)임을 정확히 판단해 planner 턴 후속 항목(§2.9 `Timestamp?` 정정 + `spec/data-flow/10-triggers.md §3.2` 보강)으로 이름과 대상 위치까지 명시해 이미 위임되어 있음. consistency-check(`15_17_03`)도 동일 항목을 WARNING 으로 지적했고 plan 이 정확히 반영함. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `schedules.service.spec.ts` 신규 회귀 테스트가 `computeNextRuns`의 private 메서드를 spy 로 강제해, 실제 구현상(`Math.max(count,1)` 하한 고정 + 파싱 실패 시 throw) 도달 불가능한 "다음 실행 없음" 전제를 인위 재현한다. 회귀 탐지력 자체는 유효하나 테스트 이름/docstring 이 실사용 시나리오처럼 서술돼 오독 여지 있음(cron-parser 직접 프로브로 "파싱성공+next() 없음" 경로 부재 확인) | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:326-347`, 대상 `schedules.service.ts:236-241,340` | 필수 아님. docstring 에 "현재 구현상 도달 불가능한 방어 분기 — private mock 으로 강제 실행" 한 줄 추가 고려 |
| 2 | maintainability/documentation | 가드 파일마다 디렉터리 재귀 walk 로직이 반복 구현되어 이번 PR 로 5번째 사본이 생김(`collectScanTargets`) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (형제: `masked-reject-callers-guard.ts` 등) | 조치 불요 — plan 에 "형제 가드 4개 동반 필요"로 이미 후속 등재됨. 다음에 이 디렉터리 가드를 만질 때 공용 walker로 통합 |
| 3 | maintainability/documentation | `source-scan.ts`의 `countX`/`hasX` 인접 페어링 관례가 신규 함수 쌍(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`) 삽입으로 깨짐 — 기존 쌍(`countRawUpdateReturning`/`hasRawUpdateReturning`) 사이에 끼어듦 | `codebase/backend/src/common/__test-utils__/source-scan.ts:112-173` | 조치 불요(기존 판단 유지, 이전 두 라운드에서 이미 지적·유예). 다음 편집 시 파일 끝으로 이동 |
| 4 | documentation | `CHANGELOG.md`에 이번 배치(캐스트 8건 제거 + 회귀 가드 신설) 미기재 — 3라운드 연속 지적 | 저장소 루트 `CHANGELOG.md` (선례: `Execution.error` 문단) | 조치 불요(내부 타입 정합화, wire 계약 무영향이라는 기존 판단 유지). 남기고 싶으면 한 줄 추가 |
| 5 | testing | `resetPassword` 성공 경로 신규 테스트가 `usersService.update`의 대상 id 인자는 단언하지 않음 | `codebase/backend/src/modules/auth/auth.service.spec.ts:940-950` | 우선순위 낮음. `expect(...mock.calls[0][0]).toBe('user-uuid')` 추가 고려 |
| 6 | testing | `resetLoginAttempts` 테스트의 `expect('lockedUntil' in patch).toBe(true)`가 바로 위 `toBeNull()` 단언과 실질적으로 겹쳐 추가 정보를 주지 않음 | `codebase/backend/src/modules/users/users-login-attempts.service.spec.ts:139-142` | 조치 불요(부작용 없음). 남기려면 인라인 주석으로 목적 명시 |
| 7 | maintainability | 신규 테스트 fixture 의 duration 매직 넘버 표기법 불일치(`3_600_000` vs `86400000`, 구분자 유무) | `codebase/backend/src/modules/auth/auth.service.spec.ts:936,1094` | 우선순위 낮음. 명명 상수화 또는 구분자 표기 통일 |
| 8 | maintainability | `COLUMN_DECL` 정규식의 "왜 한 단계 중첩까지만인지/실패 모드"에 대한 설명이 소비 spec·plan 문서에 흩어져 있음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` | 필수 아님. 정규식 위 주석에 실패 모드 한 줄 추가 |
| 9 | scope | 46개 파일 중 실질 코드/plan 변경은 15개, 나머지 31개는 이전 두 리뷰 라운드 + consistency-check 산출물 — 저장소 관례상 정상이나 라운드가 늘수록 탐색 비용 증가 추세 | 파일 목록 전체 | 조치 불요. 관례에 부합 |
| 10 | security/side_effect | W1(가드 spec 이 프로덕션 소스 파일을 `writeFileSync`로 변형)이 `os.tmpdir()` 기반 `withFixture`로 전환되어 완전 해소됨을 소스 직접 확인으로 재검증 | `nullable-type-lie-cast.spec.ts:105-114` | 조치 불요(이미 해소) |
| 11 | side_effect | 1R CRITICAL(`@Column` `type:` 누락 4건 → 부팅 실패)이 `type: 'varchar'`/`'timestamptz'` 명시로 해소됨을 재확인 | `user.entity.ts` 각 `@Column` 블록 | 조치 불요(이미 해소) |
| 12 | documentation | plan 문서에 `(d) Schedule.lastRunAt`·`(e) auth.service.spec.ts:58 lockedUntil 캐스트`가 이름으로 등재됨 — "추적된다고 썼는데 이름이 없다"던 이전 WARNING 해소 확인 | `plan/in-progress/entity-nullable-column-type-mismatch.md:167-176` | 조치 불요(이미 해소) |
| 13 | documentation | 가드 docstring의 낡은 "캐스트 12건" 하드코딩 숫자가 제거되고 grep 안내로 대체됨 | `nullable-type-lie-cast-guard.ts:29-31` | 조치 불요(이미 해소) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. W1(가드 spec 프로덕션 파일 변형) 해소 재확인, `COLUMN_DECL` regex ReDoS 아님(입력도 저장소 자체 소스뿐) |
| requirement | NONE | 배치1(캐스트 8건 제거+타입 확장) + fix 2건(CRITICAL·WARNING) 전부 워킹트리에 정확히 반영됨을 grep/Read 로 재확인. spec §2.9 갭은 SPEC-DRIFT 로 이미 planner 턴 위임 |
| scope | LOW | 46개 파일 중 실질 변경 15개, 나머지는 review 산출물(관례 부합). 마지막 커밋(`52ca3128a`)이 RESOLUTION 예고 3자리에 정확히 국한 |
| side_effect | NONE | 이전 라운드 지적 W1·CRITICAL 실제 해소를 소스 직접 확인. null 캐스트 제거는 런타임 무영향, `passwordHash` 등 민감 필드 소비처 전수 확인 결과 무방비 non-null 가정 없음 |
| maintainability | LOW | walk 로직 5중복(plan 추적 중), count/has 페어링 인접성 붕괴(기존 판단 유지), duration 매직넘버 표기 불일치, `COLUMN_DECL` regex 실패모드 설명 분산 — 전부 치명적이지 않음 |
| testing | LOW | 5개 spec 파일 120/120 PASS 직접 실행 확인. 신규 회귀 테스트 1건이 구현상 도달불가 전제를 private mock 으로 강제(탐지력은 유효, 서술만 개선 여지) |
| documentation | LOW | 이전 라운드 지적 문서화 항목(RESOLUTION 허위 추적 주장·낡은 "12건" 숫자·spec §2.9 갭) 전부 실제 해소 재확인. `CHANGELOG.md` 미기재는 3라운드 연속 지적되나 기존 "불필요" 판단 유지 |

## 발견 없는 에이전트

없음 — 7개 에이전트 전원 최소 1건 이상의 INFO(또는 이미 해소된 항목 재확인)를 보고했으나, CRITICAL/WARNING 을 보고한 에이전트는 없음.

## 권장 조치사항

1. (선택) `schedules.service.spec.ts:326`의 신규 회귀 테스트 docstring에 "현재 구현상 도달 불가능한 방어 분기 — private mock 으로 강제 실행"이라는 취지를 한 줄 추가해 오독 방지.
2. (선택) `auth.service.spec.ts:940-950`의 `resetPassword` 성공 경로 테스트에 `usersService.update` 호출의 대상 id 인자 단언 추가.
3. (플랜 추적 중, 이번 배치 조치 불요) `repo-guards/__tests__/` 하위 재귀 walk 로직 5중복은 다음에 그 디렉터리 가드를 만질 때 공용 walker로 통합.
4. (플랜에 이미 등재, 신규 조치 불요) `spec/1-data-model.md §2.9` `next_run_at` nullable 표기 정정은 planner 턴에서 `Timestamp?`로 반영하고 `spec/data-flow/10-triggers.md §3.2` cron 파싱 실패 NULL 대입 서술 보강.
5. (선택, 낮은 우선순위) `source-scan.ts` count/has 페어링 인접성 복원 및 duration 매직넘버 표기 통일은 해당 파일을 다음에 만질 때 함께 처리.

## 라우터 결정

- `routing=all` (라우터가 전체 실행을 선택 — 별도 skip 없음):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원, 결과 확보 확인됨 — "forced 전원 결과 확보됨")

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |
