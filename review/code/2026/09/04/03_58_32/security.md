# 보안(Security) 리뷰

## 검증 방법

`origin/main...HEAD` 전체 diff 중 실행 코드 8개 파일(`source-scan.ts`/`.spec.ts`, `repo-guards/__tests__/*.ts` 5개, `nullable-type-lie-cast-guard.ts`/`.spec.ts`)과 `plan/in-progress/entity-nullable-column-type-mismatch.md`, 그리고 누적된 이전 리뷰 라운드 산출물(`review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_57_22,03_17_44,03_37_37}/**`)을 대상으로 했다. 핵심 신규 유틸(`source-scan.ts`, `nullable-type-lie-cast-guard.ts`)은 저장소에서 직접 `Read` 로 열어 게이트 줄 번호와 대조했다. 하드코딩 시크릿 여부는 `git diff origin/main...HEAD -- codebase/ plan/`에 `password|secret|api[_-]?key|token=|BEGIN (RSA|PRIVATE)|credential` 패턴으로 grep — 매치 0건. 직전 라운드(`03_37_37`)의 W1 fix(`d44a8b637`, `includeSpec: true` 배선 하드닝)가 이번 라운드에도 그대로 살아있는지 재확인(`masked-reject-callers-guard.ts:51`) — 유지됨. 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 확인, 이 리뷰 세션 산출 디렉터리 외 변경 없음).

## 범위 판단

이번 변경은 전부 **테스트/빌드 타임 전용 내부 도구**다:

- `codebase/backend/src/common/__test-utils__/source-scan.ts` — jest/tsc 가 컴파일하는 순수 문자열 유틸(주석·리터럴 스트리핑, 파일 카운팅, 디렉터리 재귀 수집). production 런타임 경로에 포함되지 않는다.
- `codebase/backend/src/repo-guards/__tests__/*.ts` — CI/로컬 `jest` 실행 시에만 도는 구조적 회귀 가드. 저장소 자신의 소스 트리(`SRC_ROOT`/`MODULES_DIR`/`ENGINE_DIR` 등 고정 상수)만 스캔한다.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` — 산문 문서.

`collectTsFiles(root, opts)` 의 `root` 인자는 모든 호출부에서 리터럴 상수 기반 경로(`path.join(repoRoot, MODULES_DIR)`, `SRC_ROOT = path.resolve(__dirname, '..', '..')`)이며 외부 입력·네트워크 요청·사용자 입력에서 유래하지 않는다. `fs.readdirSync`가 반환하는 `entry.name`도 로컬 파일시스템에서 직접 오는 값이라 조작 여지가 없다. 따라서 경로 탐색(path traversal)이 성립하는 신뢰 경계가 없다.

## 발견사항

- **[INFO]** 신규 정규식(`WIDENED_DECL`, `COLUMN_DECL`, `CALL`)이 "균형 괄호 근사" 패턴(`(?:[^()]|\([^()]*\))*`)을 쓴다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`WIDENED_DECL:169`, `COLUMN_DECL:78`), `codebase/backend/src/common/__test-utils__/source-scan.ts` (`countRawUpdateReturning`의 `CALL:158`)
  - 상세: 이 형태는 병리적 입력에서 catastrophic backtracking(ReDoS)을 유발할 수 있는 알려진 패턴군이다. 다만 입력은 공격자가 아니라 **저장소 자신의 `.ts` 소스**이고, 실행 주체도 로컬/CI `jest` 프로세스이지 네트워크로 노출된 서비스가 아니다. 신뢰 경계 바깥에서 임의 문자열을 이 정규식에 흘려보낼 경로가 없어 실질적 익스플로잇 표면은 없다.
  - 제안: 조치 불필요. 이 `source-scan.ts` 계열 유틸이 향후 사용자 업로드 코드나 외부 저장소를 스캔하는 방향으로 재사용되면 그 시점에 재검토.

- **[INFO]** `fs.readFileSync`/`fs.readdirSync` 예외 시 파일 절대경로가 에러 메시지·스택에 그대로 노출될 수 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`(`findCastOffenders:46`, `findUntypedNullableColumns:109`, `widenedEntityFields:191`)
  - 상세: 로컬 파일시스템의 저장소 내부 경로이며, jest 테스트 실행 실패 시 콘솔/CI 로그에만 노출된다. 사용자 대면 응답이나 프로덕션 API 에러 경로가 아니므로 민감 정보 노출로 보지 않는다.
  - 제안: 조치 불필요.

인젝션(SQL/XSS/커맨드/LDAP/경로 탐색), 하드코딩 시크릿, 인증/인가, 입력 검증 누락, 안전하지 않은 암호화/평문 전송, 에러 처리상 민감정보 노출, 취약 의존성 도입 — 이번 diff 범위에서 해당 사항 없음. `plan/in-progress/entity-nullable-column-type-mismatch.md`는 산문 변경으로 실행 코드가 아니며 시크릿·자격증명 언급도 없다. 누적된 이전 리뷰 라운드 산출물(`review/code/2026/09/04/*/**`)도 정상 기록물로, 시크릿이나 민감정보 노출이 없다.

직전 라운드(`03_37_37`)에서 지적된 testing WARNING(`includeSpec: true` 옵션 배선이 뮤테이션으로 무력화될 수 있던 사각지대)은 보안 카테고리 소관이 아니었으나, 그 fix(`d44a8b637`)가 `.spec.ts`를 안정적으로 스캔 대상에 포함시키는 배선이라는 점에서 보안적으로도 퇴행이 없음을 재확인했다.

## 요약

이번 변경 세트는 저장소 내부 구조적 회귀 가드(`repo-guards/__tests__/`)와 그 공용 유틸(`source-scan.ts`)의 리팩터링 + 신규 nullable 캐스트 가드 추가로, 전부 테스트/빌드 시점에만 실행되고 저장소 자신의 소스 트리만 대상으로 하는 코드다. 사용자 입력, 네트워크 요청, 인증/세션, 암호화, DB 쿼리를 다루지 않으며 하드코딩 시크릿도 없다. 신규 정규식에 이론적 ReDoS 형태가 존재하지만 신뢰 경계 바깥에서 도달 가능한 입력이 없어 실질 위험은 없다. 6라운드에 걸친 이전 보안 리뷰의 판정(NONE)과 이번 독립 재검증 결과가 일치한다. 저장소 트리는 리뷰 과정에서 변경하지 않았다(`git status --short` 확인).

## 위험도

NONE
