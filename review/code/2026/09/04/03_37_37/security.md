# 보안(Security) 리뷰

## 검증 방법

diff 대상 8개 코드 파일(`source-scan.ts`/`.spec.ts`, `repo-guards/__tests__/*.ts` 5개, `nullable-type-lie-cast-guard.ts`/`.spec.ts`)과 `plan/` 문서 1개, 이전 리뷰 라운드 산출물(`review/code/2026/09/04/01_48_39/`, `01_49_18/`)을 읽었다. 실제 소스 파일(`source-scan.ts`, `nullable-type-lie-cast-guard.ts`)은 저장소에서 직접 `Read` 로 열어 게이트 줄 번호와 대조했다. 하드코딩 시크릿 여부는 diff 전체에 `password|secret|token|api[_-]?key|credential|private[_-]?key|BEGIN (RSA|PRIVATE)` 패턴으로 grep 했다 — 매치 0건. 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 로 확인, 리뷰용 산출 디렉터리 외 변경 없음).

## 범위 판단

이번 변경은 전부 **테스트/빌드 타임 전용 내부 도구**다:

- `codebase/backend/src/common/__test-utils__/source-scan.ts` — jest/tsc 가 컴파일하는 순수 문자열 유틸(주석·리터럴 스트리핑, 파일 카운팅, 디렉터리 재귀 수집). production 런타임 경로에 포함되지 않는다(`__test-utils__` 디렉터리 자체가 그 계약).
- `codebase/backend/src/repo-guards/__tests__/*.ts` — CI/로컬 `jest` 실행 시에만 도는 구조적 회귀 가드. 저장소 자신의 소스 트리(`codebase/backend/src` 하위, 고정 상수 `MODULES_DIR`/`ENGINE_DIR`/`SRC_ROOT` 등)만 스캔한다.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` — 산문 문서.

`collectTsFiles(root, opts)` 의 `root` 인자는 모든 호출부에서 리터럴 상수(`path.join(repoRoot, MODULES_DIR)`, `SRC_ROOT = path.resolve(__dirname, '..', '..')` 등)이며 외부 입력·네트워크 요청·사용자 입력에서 유래하지 않는다. 따라서 경로 탐색(path traversal)이 성립하는 신뢰 경계가 없다 — `entry.name` 은 `fs.readdirSync` 가 로컬 파일시스템에서 직접 반환하는 값이라 조작 여지가 없다.

## 발견사항

- **[INFO]** 신규 정규식(`WIDENED_DECL`, `COLUMN_DECL`, `CALL` 등)에 중첩 정량자 형태의 "균형 괄호 근사" 패턴(`(?:[^()]|\([^()]*\))*`)이 쓰였다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`WIDENED_DECL`, `COLUMN_DECL` 선언부) · `codebase/backend/src/common/__test-utils__/source-scan.ts` (`countRawUpdateReturning` 의 `CALL`)
  - 상세: 이런 형태는 병리적 입력에서 catastrophic backtracking(ReDoS)을 유발할 수 있는 알려진 패턴군이다. 다만 이 리뷰 대상에서는 입력이 **공격자가 아니라 저장소 자신의 `.ts` 소스**이고, 실행 주체도 로컬/CI 의 `jest` 프로세스이지 네트워크로 노출된 서비스가 아니다. 즉 신뢰 경계 바깥에서 임의 문자열을 이 정규식에 흘려보낼 경로가 없어 실질적 ReDoS 익스플로잇 표면은 없다.
  - 제안: 조치 불필요. 다만 향후 이 `source-scan.ts` 계열 유틸이 사용자 업로드 코드나 외부 저장소를 스캔하는 방향(예: 사용자가 붙여넣은 코드 검사 기능)으로 재사용될 경우에는 이 판단이 무효화되므로, 그 시점에 다시 검토해야 한다.

- **[INFO]** `fs.readFileSync`/`fs.readdirSync` 예외 시 파일 절대경로가 그대로 에러 메시지·스택에 포함될 수 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:46`(`findCastOffenders`), `:109`(`findUntypedNullableColumns`), `:191`(`widenedEntityFields`)
  - 상세: 이 경로는 로컬 파일시스템의 저장소 내부 경로이며 jest 테스트 실행 실패 시 콘솔/CI 로그에만 노출된다. 사용자 대면 응답이나 프로덕션 API 에러 경로가 아니므로 민감 정보 노출로 보지 않는다.
  - 제안: 조치 불필요.

인젝션(SQL/XSS/커맨드/LDAP/경로 탐색), 하드코딩 시크릿, 인증/인가, 입력 검증 누락, 안전하지 않은 암호화/평문 전송, 에러 처리상 민감정보 노출, 취약 의존성 도입 — 이번 diff 범위에서 해당 사항 없음. `plan/in-progress/entity-nullable-column-type-mismatch.md` 는 산문 변경으로 실행 코드가 아니며 시크릿·자격증명 언급도 없다. `review/code/2026/09/04/01_48_39/`, `01_49_18/` 산출물(meta.json, RESOLUTION.md 등)도 이전 리뷰 라운드의 정상 기록물로, 시크릿이나 민감정보 노출 없음.

## 요약

이번 변경 세트는 저장소 내부 구조적 회귀 가드(`repo-guards/__tests__/`)와 그 공용 유틸(`source-scan.ts`)의 리팩터링 + 신규 nullable 캐스트 가드 추가로, 전부 테스트/빌드 시점에만 실행되고 저장소 자신의 소스 트리만 대상으로 하는 코드다. 사용자 입력, 네트워크 요청, 인증/세션, 암호화, DB 쿼리를 다루지 않으며 하드코딩 시크릿도 없다. 신규 정규식에 이론적 ReDoS 형태가 존재하지만 신뢰 경계 바깥에서 도달 가능한 입력이 없어 실질 위험은 없다. 저장소 트리는 리뷰 과정에서 변경하지 않았다(`git status --short` 확인).

## 위험도

NONE
