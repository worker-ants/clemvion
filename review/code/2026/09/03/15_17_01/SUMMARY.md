# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/실질 결함 없음. `null as unknown as X` 캐스트 제거 + 엔티티 필드 `T | null` 확장(순수 타입 정합화) diff 이며, 직전 라운드(14_44_15)의 CRITICAL(엔티티 `type:` 누락 → 부팅 실패)과 WARNING 4건은 이 diff 시점에 이미 해소됨을 8개 reviewer 모두 소스 직접 확인·테스트 실행·뮤테이션 재현으로 검증했다. 다만 documentation reviewer 가 지적한 WARNING 1건(직전 라운드 RESOLUTION.md 가 "배치 2 로 넘긴다"고 단언한 후속 항목 2건이 실제 plan 트래커에는 이름으로 등재돼 있지 않음)은 이 저장소가 반복적으로 겪은 "미룬 항목 유실" 결함 클래스와 동일해 상단에 명시한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 직전 라운드 `RESOLUTION.md` 가 "plan 이 추적한다"/"배치 2 로 넘긴다"고 단언한 후속 항목 2건 — (a) `Schedule.lastRunAt` 이 `nullable: true` 인데 TS 타입은 여전히 non-null(`Date`)로 남은 비대칭, (b) `auth.service.spec.ts:58` 의 `lockedUntil: null as unknown as Date` 잔존 캐스트(이제 `User.lockedUntil` 이 `Date \| null` 로 넓혀져 캐스트 없이도 타입체크 통과, `nullable-type-lie-cast-guard.ts` 의 `collectScanTargets` docstring "테스트 fixture 캐스트 12건 전부 정당" 서술도 부정확해짐) — 이 두 항목이 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "배치 2 후보" 목록(엔티티 단위/relation/null-검사-실재 3갈래)에 이름으로 등재돼 있지 않다. requirement reviewer 도 두 항목을 각각 INFO 로 재확인했다(다만 "plan 이 이미 추적 중"이라 서술해 documentation 의 실측과 결이 다르다 — documentation 이 실제 plan 본문을 인용해 더 구체적으로 검증함). | `review/code/2026/09/03/14_44_15/RESOLUTION.md`(INFO#8·INFO#11) vs `plan/in-progress/entity-nullable-column-type-mismatch.md`(gate 146행 이하 "## 할 일") | `plan/in-progress/entity-nullable-column-type-mismatch.md` "배치 2 후보" 아래에 두 항목을 이름으로 추가: `(d) schedule.lastRunAt`(nullable 이지만 미확장), `(e) auth.service.spec.ts:58 의 lockedUntil 캐스트 정리(collectScanTargets docstring "12건" 갱신 동반)`. 최소한 `nullable-type-lie-cast-guard.ts` docstring 에 "1건은 `lockedUntil` 확장으로 이미 불필요" 각주 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 신규 회귀 가드 2파일(`nullable-type-lie-cast-guard.ts`/`.spec.ts`)이 "타입 확장+캐스트 제거"라는 좁은 요청 범위를 넘는 부가 인프라이나, plan 문서 "## 회귀 가드" 절에 근거가 명시돼 있고 저장소 기존 guard+spec 관례를 그대로 따름 — over-engineering 으로 보기 어려움 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`, `nullable-type-lie-cast.spec.ts` (신규 파일 전체) | 조치 불요 |
| 2 | maintainability | `collectScanTargets`(재귀 디렉터리 walk) 가 저장소 내 5번째 사본 — `masked-reject-callers-guard.ts`/`engine-error-code-anchor-guard.ts`/`audit-action-binding-guard.ts` 와 사실상 동일 로직 중복. 이미 plan 에 "형제 가드 4개 동반 필요"로 후속 등재된 의도된 이연(W5) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:29` | 다음에 이 디렉터리 가드를 만질 때 공용 walker 로 통합 |
| 3 | maintainability, documentation | `source-scan.ts` 신규 함수쌍(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`)이 기존 `countRawUpdateReturning`/`hasRawUpdateReturning` counter-wrapper 인접 관례 사이에 끼어들어 인접성이 깨짐(직전 라운드에서도 지적, 판단 유지) | `codebase/backend/src/common/__test-utils__/source-scan.ts:112-172` | 조치 불요(기존 결정 유지) — 다음 편집 시 파일 끝으로 이동 |
| 4 | maintainability | 신규 테스트 fixture 시간 상수(`3_600_000` vs `86400000`)가 매직넘버이며 숫자 구분자 표기가 파일 내에서 불일치 | `codebase/backend/src/modules/auth/auth.service.spec.ts:936, :1094` | 우선순위 낮음 — `ONE_HOUR_MS`/`ONE_DAY_MS` 명명 상수 또는 구분자 표기 통일 |
| 5 | testing | `findCastOffenders` 가 다중 offender 파일(2개 이상) aggregation 을 검증하지 않음(직전 라운드에서도 지적) | `nullable-type-lie-cast.spec.ts` | 우선순위 낮음 — offender 2개 이상 fixture 로 `toHaveLength(2)` 케이스 추가 |
| 6 | testing | `auth.service.spec.ts` 의 verifyEmail 신규 테스트가 `usersService.findByEmail` mock 을 설정하지만 실제 `verifyEmail` 경로는 이를 호출하지 않음(죽은 mock, 복붙 흔적으로 추정) | `codebase/backend/src/modules/auth/auth.service.spec.ts:1089` 부근 | 해당 mock 설정 줄 제거(동작 영향 없음) |
| 7 | testing | `countNullAsUnknownAsCasts` 정규식(`/\bnull as unknown as\b/g`)이 단일 공백만 가정 — prettier 정규화로 현재는 안전하나 사각지대가 docstring 에 명시되지 않음 | `codebase/backend/src/common/__test-utils__/source-scan.ts` (`countNullAsUnknownAsCasts`) | 우선순위 낮음 — 한 줄 명시 |
| 8 | testing, security | `findUntypedNullableColumns`/`COLUMN_DECL` 정규식이 2단계 이상 중첩 괄호(예: `transformer: { to: (v) => v }`)를 가진 `@Column({...})` 을 놓칠 수 있음(테스트 미커버). security reviewer 는 별도로 이 정규식이 ReDoS(catastrophic backtracking) 형태는 아님을 확인(대안 소비 문자가 배타적) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`COLUMN_DECL` 상수) | 우선순위 낮음 — 실사용 엔티티에 2단 중첩이 생기면 대응 |
| 9 | scope | `schedules.service.ts` 대입문이 캐스트 제거 결과 3줄→1줄로 축약(포맷팅과 실질 변경이 한 hunk 에 섞임, 지적 실익 낮음) | `codebase/backend/src/modules/schedules/schedules.service.ts:241` | 조치 불요 |
| 10 | scope | 직전 리뷰 라운드 산출물 11개 파일(`review/code/2026/09/03/14_44_15/*`)이 코드 fix 와 같은 diff 에 포함됨 — 저장소 "마무리 커밋에 review 산출물 포함" 관례에 부합, 스코프 위반 아님 | `review/code/2026/09/03/14_44_15/*` | 조치 불요 |
| 11 | documentation | 이번 배치(타입 확장 8건 + `type:` 누락 fix 4건 + 회귀 가드 신설)가 `CHANGELOG.md` 에 반영되지 않음 — 저장소 관례상 wire-facing 변화 위주라 필수는 아님(선례: `CHANGELOG.md:63` `Execution.error` 케이스) | `plan/in-progress/entity-nullable-column-type-mismatch.md` (배치 1 완료 절) | 필수 아님 — 여유 있으면 한두 줄 부기 |
| 12 | requirement | `source-scan.ts` 의 캐스트 탐지 정규식이 자기 자신(가드/술어 파일)을 스캔해도 오탐 없음 — 정규식 `\b` 경계 형태에 의존하는 우연이며 직전 라운드에서 이미 "판단 유지"로 처리된 항목의 재확인 | `codebase/backend/src/common/__test-utils__/source-scan.ts:161` | 조치 불요(기존 결정 유지) |

## 확인된 항목 (신규 결함 없음, 참고용)

- side_effect·database reviewer 는 직전 라운드 CRITICAL(4개 컬럼 `type:` 누락)과 WARNING(가드 spec 이 프로덕션 파일 `writeFileSync` 변형)이 이 diff 시점 코드에서 이미 해소됐음을 각각 독립적으로 소스 직접 확인 — 4개 컬럼 모두 `type: 'varchar'` 명시, 가드 spec 은 `os.tmpdir()` 합성 fixture 로 완전 전환.
- side_effect reviewer 는 넓혀진 nullable 필드(`passwordHash` 등)를 소비하는 저장소 전역 지점을 `grep` 전수 확인 — 모두 기존에 이미 null 체크를 선행하고 있어 새로 무방비해진 역참조 지점 없음. `UsersController.toProfileData()` 화이트리스트 매핑으로 공개 API 노출 경로도 없음.
- database reviewer는 실제 DDL 변경(마이그레이션 파일) 없음, `synchronize: false` 로 자동 스키마 변경 없음을 확인 — 무중단 배포 위험 없음.
- testing reviewer는 133/133 테스트 PASS 확인 + `lockedUntil: null → undefined` 뮤테이션을 직접 재현해 신규 테스트가 정확히 RED 를 냄을 검증(격리: cp 백업/원복, `git status --short` clean 확인).
- requirement reviewer도 동일 뮤테이션을 독립적으로 재현해 RED 확인, `resetPassword`/`verifyEmail` 신규 테스트의 mock 구조가 실제 구현과 정합함을 소스 대조로 확인.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 관련 로직 변경 없음(순수 타입 정합화). 신규 가드 정규식은 ReDoS 아님, 공격 표면 아님 |
| requirement | NONE | 직전 CRITICAL 해소 확인, W1~W4 조치 확인(테스트 실행+뮤테이션 재현), 잔여는 전부 이미 알려진 INFO 재확인 |
| scope | LOW | plan 선언 범위(8필드+캐스트8건)와 diff 정확히 일치, 부가 가드 2파일은 근거 있음, review 산출물 포함은 관례 부합 |
| side_effect | NONE | 직전 CRITICAL·WARNING 모두 이 diff 에서 해소 확인, 신규 export 함수는 순수 읽기전용, 전역 소비처 무방비 지점 없음 |
| maintainability | LOW | 핵심 변경은 관례 준수 양호. walker 중복(5번째 사본)은 plan 에 이미 이연된 결정, 함수쌍 인접성 경미 |
| testing | LOW | W1~W4 조치 확인(133/133 PASS + 뮤테이션 재현). 잔여 INFO 는 정밀도 갭·죽은 mock 1줄 등 우선순위 낮음 |
| documentation | LOW | 코드 자체 문서화는 양호하나, RESOLUTION.md 가 "추적됨"이라 단언한 후속 항목 2건이 plan 트래커에 실제로는 미등재(WARNING) |
| database | LOW | DDL 변경 없음, `synchronize: false`, 직전 CRITICAL 해소 확인, 신규 테스트가 데이터 정합성(undefined 회귀) 방어 |

## 발견 없는 에이전트

없음 — 8개 reviewer 모두 최소 1건 이상의 INFO 이상 발견사항 또는 확인 사항을 보고했다(단, CRITICAL 은 전원 0건).

## 권장 조치사항

1. `plan/in-progress/entity-nullable-column-type-mismatch.md` "배치 2 후보" 목록에 직전 라운드 `RESOLUTION.md` 가 "추적됨"이라 단언한 두 항목을 이름으로 추가한다 — `(d) schedule.lastRunAt` 비대칭, `(e) auth.service.spec.ts:58` 낡은 `lockedUntil` 캐스트 정리(+`collectScanTargets` docstring "12건" 갱신). 최소한 가드 docstring 에 각주만이라도 남긴다. (WARNING #1)
2. 여유가 있으면 INFO 항목 중 우선순위 낮은 것들(죽은 mock 제거, 매직넘버 명명 상수화, `findCastOffenders` 다중 offender 케이스 추가)을 다음 배치 작업 시 함께 정리한다 — 필수 아님.
3. 그 외 CRITICAL/실질 결함이 없으므로 이 배치를 완료로 처리하는 데 추가 차단 사유 없음.

## 라우터 결정

- `routing=all` (router 미선별 — 전체 reviewer 실행 모드로 8명 전원 수행):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database` (8명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **forced 전원 결과 확보됨** (강제 화이트리스트 미이행 없음, 위 위험도 판정은 forced reviewer 결과 누락에 의한 거짓 음성이 아님). `database` 는 forced 목록엔 없으나 이번 라운드에서 함께 실행되어 결과가 포함됨.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |
