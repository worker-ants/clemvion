# 요구사항(Requirement) 리뷰 — keyset 커서 id/i 성분 UUID-shape 검증

## 발견사항

- **[INFO]** 두 keyset 커서 디코더의 실패 계약 비대칭(무시→200 vs 400 `INVALID_CURSOR`)이 이 diff로 사실상 굳는다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:61`(`if (!isUuidShaped(id)) return null;`) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178`(`if (!isUuidShaped(parsed.i)) { throw new Error(...) }`)
  - 상세: `spec/5-system/2-api-convention.md §8.2`는 cursor 페이지네이션을 "opaque base64 + 실패 시 400" 단일 표준으로 서술하는데(`grep` 확인: `spec/5-system/2-api-convention.md:399-419`), `login-history`는 평문 `<iso>|<id>` 인코딩·실패 시 무시라는 다른 패턴을 예외 각주 없이 쓰고 있다. 이 diff는 신규 결함이 아니라 **각 디코더의 기존 계약을 그대로 유지**한 선택이며, `plan/in-progress/keyset-cursor-uuid-validation.md §C`·`spec-draft-nullable-notation-followups.md`(2026-09-12 등재, planner 항목 3건)에 이미 등재돼 있고 CHANGELOG·코드 주석에도 명시돼 있다. 회색지대가 아니라 "코드가 spec 본문과 다르지만 그 사실이 알려져 있고 처분이 planner 대기 중"인 상태라 CRITICAL로 올리지 않는다.
  - 제안: 조치 불요(이미 추적됨). planner가 §8.2 예외 각주 또는 계약 통일 여부를 결정하면 종결.

- **[INFO]** Background Runs REST 에러 코드 4종(`INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND`)이 `spec/5-system/3-error-handling.md §1` 중앙 카탈로그에 미등재.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` catch 블록(`resolveLimit`/`decodeCursor`/`verifyExecutionAccess`/`findBackgroundNodeExecution`)
  - 상세: `§1.5~§1.9`가 예외 없이 지켜온 "도메인 SoT + 카탈로그 가시성 등재" 관행에서 이 도메인만 빠져 있음을 실측으로 확인(§1.9 서술과 대조 완료). 이 diff가 새로 만든 코드가 아니라 기존 갭이며 `--impl-prep` consistency-check(`review/consistency/2026/09/12/22_51_25`)로 이미 포착돼 planner 항목으로 등재됨.
  - 제안: 조치 불요(이미 추적됨).

## 검증 상세 (양성 확인)

- `decodeCursor` 두 곳 모두 `isUuidShaped`(canonical 8-4-4-4-12 hex, 버전/variant 무관)로 id 성분을 검증하도록 정확히 구현됨. `isValidUuid`(RFC v1–v5 한정) 대신 이 술어를 쓴 근거는 `spec/data-flow/12-workspace.md §"UUID 검증 강도 비대칭"`과 정합하며, 코드 주석·plan·CHANGELOG가 모두 같은 근거를 일관되게 인용한다.
- 회귀 대상 컬럼 실측: `LoginHistory.id`, `NodeExecution.id` 모두 `@PrimaryGeneratedColumn('uuid')` — 22P02 마스킹 메커니즘 서술과 일치.
- `isUuidShaped` 소비처 전수를 독립적으로 재실측: `grep -rn 'isUuidShaped(' --include='*.ts' codebase/backend/src | grep -v '\.spec\.ts' | grep -v 'shared/testing/' | grep -v 'utils/uuid.ts:'` → 정확히 3곳(`workspace-context.util.ts:74`, `login-history.service.ts:61`, `background-runs.service.ts:178`). `uuid.spec.ts`/`uuid.ts` JSDoc이 주장하는 "2026-09-13 실측 3곳"과 정확히 일치 — 3라운드 전 리뷰가 지적했던 grep 필터 누락(정의부까지 잡혀 4줄) 결함은 이번 필터로 해소됨.
- 사용자 입력을 uuid 컬럼에 바인딩하는 keyset 커서 전수를 독립적으로 재조사(`decodeCursor`/`encodeCursor`/`.id > :`/`.id < :`/`cursorId`/`lastId` grep): `login-history.service.ts`·`background-runs.service.ts` 두 곳뿐이며, 세 번째 후보(`integration-expiry-scanner.service.ts`)는 자기가 생성한 `lastId`를 재사용하는 내부 배치라 사용자 입력 경로가 아님을 확인 — plan의 "정확히 2곳" 모집단 주장이 정확하다.
- `background-runs.service.ts`의 `getBackgroundRun`은 실제로 `decodeCursor`(신규 검증 포함)가 `verifyExecutionAccess`(워크스페이스 소유권)보다 먼저 실행됨을 소스에서 직접 확인(`resolveLimit` → `decodeCursor` → `verifyExecutionAccess` 순, 기존 `resolveLimit`과 동일 관행). 이 순서 때문에 "타 워크스페이스 + 잘못된 커서"가 404 대신 400이 되는 동작 변화를, 신규 테스트 2건(`background-runs.service.spec.ts` — 소유권 mock을 의도적으로 세우지 않아 순서 자체를 증거로 삼음)이 정확히 고정하고 있다. 형태 검증만으로 거부되므로 리소스 존재 여부를 워크스페이스 간에 구별해 주지 않아 IDOR 관점 정보 누설도 아니다.
- `GlobalExceptionFilter`의 기존 SQLSTATE 분기(`23505`→409만, `23502`는 500 유지)를 직접 확인(`http-exception.filter.spec.ts`) — plan §A가 "필터에 22P02→400 일괄 분기를 넣지 않는" 근거로 든 실측과 일치. `spec/5-system/3-error-handling.md §1`의 "JWT 클레임은 검증하지 않는다(서버가 서명한 값에 400을 내면 서버 버그를 클라이언트 오류로 보고)" 원칙 인용도 해당 spec 문장과 실제로 일치함을 확인.
- CHANGELOG의 라우트 파라미터(`:executionId`/`:backgroundRunId`)가 실제 컨트롤러 라우트(`@Controller('executions/:executionId/background-runs')`)와 일치.
- 대상 unit 테스트 3개 스위트(`uuid.spec.ts`, `login-history.service.spec.ts`, `background-runs.service.spec.ts`)를 직접 실행 — 3 suites / 44 tests 전부 PASS.
- 3라운드 전 리뷰(`review/code/2026/09/13/00_13_51`)가 지적한 WARNING 4건(순서 회귀 테스트 부재·근거 주석 3중 복제·`uuid.ts` 닫힌 캐너리 목록·grep 명령 오류)을 현재 코드와 대조 — 4건 모두 이번 diff에서 해소됨을 개별 확인(순서 테스트 2건 추가, 주석은 `uuid.ts` JSDoc 한 곳으로 집약되고 호출부는 짧은 참조로 압축, JSDoc이 닫힌 목록에서 grep 기반 서술로 전환, grep 필터 수정).
- 저장소 트리에 뮤테이션 없음 — `git status --short`는 이 세션 시작 전부터 존재하던 이전 라운드 리뷰 산출물(untracked)만 보여준다.

## 요약

두 keyset 커서 디코더(`login-history.service.ts`, `background-runs.service.ts`)에 `isUuidShaped` 검증을 추가해 인증된 사용자가 커서의 id 성분으로 SQLSTATE 22P02(→500 마스킹)를 유발할 수 있던 결함을 각 엔드포인트의 기존 실패 계약(무시 vs 400)을 유지한 채 정확히 닫았다. 소비처·모집단·필터 재현 명령을 모두 독립적으로 재실측한 결과 문서(plan/CHANGELOG/JSDoc)의 수치·주장이 실제 코드와 정확히 일치했고, 3라운드 전 리뷰가 지적한 4건의 WARNING(우선순위 미고정 테스트·주석 3중 복제·닫힌 캐너리 목록·잘못된 grep 필터)도 전부 해소를 확인했다. 두 디코더 간 계약 비대칭과 에러 코드 카탈로그 미등재는 spec 본문과 다르지만 developer 권한 밖(planner 소관)으로 정확히 분류돼 이미 트래커에 등재돼 있어 새로운 CRITICAL/WARNING으로 올리지 않았다. Critical·Warning 없음.

## 위험도

NONE
