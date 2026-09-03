# Code Review 통합 보고서

## 전체 위험도
**LOW** — `entity-nullable-column-type-mismatch` 배치 1 (4라운드 누적 diff). 7개 reviewer 전원(강제 포함 화이트리스트 전원) 결과 확보됨, 누락 없음. CRITICAL/WARNING 0건, 실질 발견은 SPEC-DRIFT 1건(이미 planner 턴으로 위임됨) + INFO 다수(대부분 이전 라운드에서 이미 판단·조치 완료).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `Schedule.nextRunAt` 을 `Date \| null` 로 넓힌 코드가 `spec/1-data-model.md §2.9` 필드 타입 표기(non-null `Timestamp`)와 어긋난다 — DB 컬럼(`next_run_at TIMESTAMPTZ`, 제약 없음)과 런타임 대입 분기(cron 파싱 실패·재계산 결과 없음) 양쪽 다 이전부터 `null` 을 대입해 왔으므로 **코드가 맞고 spec 표가 낡았다**. developer 가 그 문장을 쓴 당사자가 아니라 자기-반증형 소정정 예외(CLAUDE.md) 조건 1 미충족 — 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158` 에 명시적으로 **planner 턴으로 위임**돼 있음 | `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:41-42` vs `spec/1-data-model.md:260` | 코드는 유지. `spec/1-data-model.md:260` 을 `next_run_at \| Timestamp?` 로 정정하는 것은 project-planner 의 다음 spec 턴에서 처리(devloper 권한 밖, 이미 plan 에 위임 기록됨) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 가드 spec(`nullable-type-lie-cast.spec.ts`)이 프로덕션 소스 파일(`users.service.ts`)을 `writeFileSync` 로 변형하던 이전 라운드(1R) WARNING이 `os.tmpdir()` 기반 합성 fixture(`withFixture`)로 완전히 전환되어 해소됨을 소스 직접 열람으로 재확인 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` | 조치 불요 — 확인 목적 기재 |
| 2 | 보안 | 신규 정적 가드 정규식(`COLUMN_DECL`)이 중첩 대안을 쓰지만 서로 배타적 매칭 경로라 ReDoS 형태 아님. 입력도 신뢰 경계 밖 데이터가 아니라 저장소 자신의 소스 텍스트뿐이라 실질 공격 표면 없음(1R·2R 이미 검증, 재확인) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`COLUMN_DECL`) | 조치 불요. 2단 이상 중첩 괄호 등장 시 탐지력(false negative) 이슈 가능 — 이미 plan 후속 항목으로 인지됨 |
| 3 | 요구사항 | `SchedulesService.create()`(INSERT 경로, `undefined` 사용)와 `update()`(이번 diff 가 `null` 로 정리)가 "다음 실행 계산이 비면" 상황을 다른 리터럴로 표현 — 현재는 INSERT 경로라 결과 동일해 무해하지만 표기가 갈림. 이번 diff 범위 밖의 pre-existing 코드 | `codebase/backend/src/modules/schedules/schedules.service.ts:179-187` (create) vs `:241` (update) | 조치 불요(현재 무해). 다음에 `create()` 를 만질 때 `null` 로 통일 고려 |
| 4 | 요구사항 | `Schedule.lastRunAt` 은 `nullable: true` DB 컬럼인데 여전히 `Date`(non-null) 타입 — `nextRunAt` 만 이번 배치에서 넓혀져 비대칭 남음. spec(`§2.9`, `:261`)은 이미 `Timestamp?` 로 정확 — 이번엔 코드가 spec 을 아직 못 따라간 반대 방향 | `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:44-45` | 조치 불요 — `plan/in-progress/entity-nullable-column-type-mismatch.md:167-168` 이 "배치 2 후보 (d)" 로 이미 이름 등재. 배치 2 착수 시 처리 |
| 5 | 요구사항 | TODO/FIXME/HACK/XXX 계열 미완성 마커 diff 전체에서 0건 | 전체 diff | 해당 없음 — 확인용 기재 |
| 6 | 범위(Scope) | 코드 대 리뷰/consistency 산출물 비율이 라운드를 거듭할수록 커짐(1R 11 → 4R 57개 파일) — 실질 코드/plan 변경은 여전히 15개로 고정. `review/**` 는 CLAUDE.md 저장 위치표에 명시된 SoT 관례이며 스코프 위반 아님(1R·2R·3R 이미 동일 판단) | 파일 목록 전체(실질 변경 15 / 리뷰 산출물 42) | 조치 불요. 기존 판단 유지 |
| 7 | 범위(Scope) | 신규 가드 2파일(`nullable-type-lie-cast-guard.ts`/`.spec.ts`)이 "캐스트 제거+타입 확장"이라는 배치 1 본질을 넘어서는 부가 산출물이지만 plan 문서에 근거 기록 + 저장소 기존 guard+spec 관례 준수(1R 이미 판단) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`, `nullable-type-lie-cast.spec.ts` | 조치 불요 |
| 8 | 부작용 | `User`/`Schedule` 엔티티 필드 타입이 `T` → `T \| null` 로 넓어짐(narrow→wide 인터페이스 변경). 부팅 실패를 일으켰던 `@Column({ type: ... })` 누락 4건은 이 diff 안에 이미 수정됨을 직접 확인(`tsc` 신규 오류 0건 실측) | `codebase/backend/src/modules/users/entities/user.entity.ts`, `.../schedules/entities/schedule.entity.ts:42` | 없음 — 이미 검증됨 |
| 9 | 부작용 | `null as unknown as X` → `null` 리터럴 치환은 컴파일 타임 전용 변경, 런타임 대입 값·DB 페이로드·트랜잭션 경계·호출 순서 모두 동일 | `auth.service.ts:233-234,752-753`, `totp.service.ts:124`, `schedule-runner.service.ts:190`, `schedules.service.ts:241`, `users.service.ts:387` | 없음 |
| 10 | 부작용 | 신규 export 함수 5개(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`/`collectScanTargets`/`findCastOffenders`/`findUntypedNullableColumns`)는 순수 읽기 전용, 전역 상태·환경 변수·네트워크 호출 없음. 기존 함수 시그니처 변경 없음(전부 신규 추가) | `codebase/backend/src/common/__test-utils__/source-scan.ts:158-168`, `.../repo-guards/__tests__/nullable-type-lie-cast-guard.ts:16-126` | 없음 |
| 11 | 부작용 | 리뷰 세션(읽기 전용 수행) 중 저장소 부수 오염 없음. 1R 이 관측했던 미커밋 `user.entity.ts` 잔여물은 이후 `40fa58b8f` 커밋으로 흡수돼 현재는 없음 | `git status --short` | 없음 |
| 12 | 유지보수성 | 디렉터리 재귀 스캔(`walk`) 로직이 같은 디렉터리에서 5번째로 복붙됨(`collectScanTargets`). `source-scan.ts` 는 "세는(count)" 축은 한 곳에 모으지만 "모으는(walk)" 축엔 같은 원칙 미적용 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:33-45` | 조치 불요(plan 문서에 형제 가드 4개 동반 리팩터 후속 항목으로 이름 등재됨). 다음에 이 디렉터리 가드를 만질 때 공용 walker 로 통합 |
| 13 | 유지보수성 · 문서화 | `source-scan.ts` 의 "countXxx 정의 바로 아래 hasXxx 래퍼" 인접 관례를 신규 함수쌍이 깨뜨림(`countRawUpdateReturning`↔`hasRawUpdateReturning` 사이 33줄 벌어짐). 동작 영향 없음, 3라운드 연속 동일 판단 유지 | `codebase/backend/src/common/__test-utils__/source-scan.ts:112~158-168~171` | 조치 불요(기존 판단 유지). 새 함수쌍은 파일 끝에 추가하는 편이 나음 |
| 14 | 유지보수성 | 같은 디렉터리 내 "스캔 루트 계산" 관례가 파일마다 다름(`SRC_ROOT` 모듈 로드 시점 상수 vs `MODULES_DIR`+호출자 `repoRoot` 파라미터 조합) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:16` | 우선순위 낮음. walker 통합 시 함께 정리 |
| 15 | 유지보수성 | 신규 테스트의 시간(duration) 리터럴이 매직 넘버이고 표기법 불일치(`3_600_000` vs `86400000`), 단위를 드러내는 이름/주석 없음 | `codebase/backend/src/modules/auth/auth.service.spec.ts:936, :1094` | 우선순위 낮음. `ONE_HOUR_MS`/`ONE_DAY_MS` 명명 상수 또는 표기 통일 고려 |
| 16 | 유지보수성 | `findUntypedNullableColumns` 가 파싱→판정 4단계 조건(정규식 매치·nullable 여부·type 존재·JoinColumn 예외)을 한 루프 안에서 순차 처리 — 순환 복잡도 경계선, 현재는 docstring 이 충실해 가독성 문제 없음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:109-126` | 지금 조치 불요. 조건이 하나 더 늘면 `isExempt(...)` 같은 이름 있는 술어로 분리 고려 |
| 17 | 테스트 | `findCastOffenders` 의 다중 offender 파일(2개 이상) 누적 경로가 여전히 직접 단언되지 않음(매 테스트가 배열 원소 1개만 넘김) — 3라운드 연속 동일 항목, 실사용(153개 이상 전체 스캔) 위험은 낮음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (116행 부근) | 우선순위 낮음. 2개 이상 offender fixture 로 `toHaveLength(2)` 케이스 1건 추가하면 사각지대 닫힘. 급하지 않음 |
| 18 | 테스트 | 이전 3라운드 지적 항목(W1~W5, 3R INFO#1·#5)이 실제 소스에 반영돼 있음을 직접 `Read`+`grep`+테스트 실행(120/120 PASS)으로 재확인 — 새 결함 없음 | 다수(5개 spec 파일) | 없음 — 확인용 기재 |
| 19 | 문서화 | 배치 전체(타입 확장 8건+`type:'varchar'` 보강 4건+회귀 가드 신설)가 `CHANGELOG.md` 에 반영되지 않은 상태가 3라운드 유지 — 순수 내부 타입 정합화라 "wire-facing 동작 변화 아님"이 근거로 문서화돼 있어 판단 유지에 동의 | `CHANGELOG.md:63`(선례 `Execution.error`) | 조치 불요. 배치 전체가 끝나는 시점에 한 줄 요약 고려 가능 |
| 20 | 문서화 | `plan/in-progress/entity-nullable-column-type-mismatch.md` §2.9 정정 위임이 "developer 권한 밖"이라고 명시하며 planner 턴으로 정확히 이관됨 — 결함 아님, 문서화 우수 사례로 기록(SPEC-DRIFT #1 과 동일 사안) | `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158` | 없음 — 정보 제공 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 캐스트 제거는 런타임 무영향. ReDoS 형태 아님(신뢰 경계 밖 입력 없음). 가드 spec 프로덕션 파일 변형 문제 완전 해소. 회귀 테스트가 토큰 재사용 방지 속성을 강화 |
| requirement | LOW | 기능 완전성·엣지케이스 결함 없음(5 spec/120 test PASS, `tsc` 신규 에러 0). [SPEC-DRIFT] `Schedule.nextRunAt` spec §2.9 표기 낡음(이미 planner 턴 위임됨) |
| scope | LOW | 실질 변경 15개 파일로 4라운드 내내 고정, plan 선언 범위와 정확히 일치. 배치 2 이연 항목 실제로 미접촉 확인. 스코프 크립 없음 |
| side_effect | NONE | 프로덕션 파일 변형 WARNING 완전 해소. 엔티티 타입 확장은 narrow→wide 안전. 신규 함수 전부 순수 읽기 전용. 저장소 오염 없음 |
| maintainability | LOW | 저장소 기존 관례 잘 준수. walker 5번째 복사·count/has 인접성 파손·SRC_ROOT 관례 불일치·시간 매직넘버 — 전부 기존 판단 유지된 경미한 사안 |
| testing | LOW | 5 spec/120 test 직접 실행 PASS. 이전 3라운드 지적 항목 소스 반영 재확인. `findCastOffenders` 다중 offender 누적 경로 미검증(경미, 3라운드 동일) |
| documentation | NONE | 이전 라운드 WARNING(plan 등재 누락) 실제 조치 확인. count/has 인접성 파손·CHANGELOG 미기재는 근거 문서화된 판단 유지. §2.9 위임 서술 우수 |

## 발견 없는 에이전트

없음(전 에이전트가 최소 INFO 이상 기록, CRITICAL/WARNING 급 발견은 전 에이전트 공통 0건).

## 권장 조치사항

1. **(project-planner 턴 필요)** `spec/1-data-model.md:260` 의 `next_run_at` 표기를 `Timestamp?` 로 정정 — [SPEC-DRIFT] #1, developer 권한 밖으로 이미 위임되어 있음. 코드는 그대로 유지.
2. (배치 2 착수 시) `Schedule.lastRunAt` non-null 타입을 `Date | null` 로 넓혀 spec §2.9(`:261`)와 정합화 — plan 에 후보 (d) 로 이미 등재됨.
3. (다음에 해당 디렉터리를 만질 때, 급하지 않음) `repo-guards/__tests__/` 의 5개 walk 로직을 공용 walker 로 통합, `source-scan.ts` 신규 함수쌍을 파일 끝으로 이동해 count/has 인접 관례 복원.
4. (선택, 급하지 않음) `findCastOffenders` 다중 offender 누적 경로에 `toHaveLength(2)` 테스트 1건 추가.
5. (선택) 시간 매직 넘버(`3_600_000` vs `86400000`) 표기 통일 또는 명명 상수화.

## 라우터 결정

- routing=`all` (전 reviewer 실행 결정, router 제외 없음):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, 전원 success)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보 확인됨** (강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |