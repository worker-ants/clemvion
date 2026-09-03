# 보안(Security) 리뷰

## 범위 확인

`git diff origin/main...HEAD --stat -- codebase/ plan/` 기준 실제 코드 변경은 다음 10개
파일(786 insertions / 91 deletions)이며, 나머지는 `review/**` 산출물(리뷰 아티팩트, 리뷰
대상 아님)이다.

- `codebase/backend/src/common/__test-utils__/source-scan.ts` / `.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` / `masked-reject-callers.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` / `.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts`
- `plan/in-progress/entity-nullable-column-type-mismatch.md`

전부 **`__tests__`/`__test-utils__` 아래의 build-time/test-time 정적 분석("repo-guard")
인프라**다. 스캔 대상은 저장소 자신의 `src/` 트리(고정 경로, `SRC_ROOT = path.resolve(__dirname, '..', '..')`)이고, 사용자 입력·네트워크 요청·DB 접근·인증/세션·런타임 API 경로가 전혀 관여하지
않는다. 즉 프로덕션 attack surface 가 아니라 CI/로컬 테스트 실행 시에만 동작하는 코드다.

## 발견사항

- **[INFO]** 정적 분석 유틸리티에 shell/`eval` 미사용, 하드코딩 시크릿 없음 확인
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`collectTsFiles`, `countRawUpdateReturning`, `countNullAsUnknownAsCasts`), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`findUntypedNullableColumns`, `widenedEntityFields`, `findStaleSpecCasts`)
  - 상세: `child_process`/`exec`/`spawn`/`eval`/`new Function` 사용처가 diff 전 범위에 0건(`grep` 확인). 파일 시스템 접근은 `fs.readdirSync`/`fs.readFileSync` 로 고정된 저장소 내부 경로(`SRC_ROOT`, `MODULES_DIR`, `ENGINE_DIR` 등 리터럴 상수)만 순회하며, 외부 입력으로 경로가 구성되지 않아 경로 탐색(path traversal) 벡터가 없다. `plan/in-progress/entity-nullable-column-type-mismatch.md`, 그리고 diff 전체를 `password|secret|api[_-]?key|token|credential|private[_-]?key|BEGIN (RSA|PRIVATE)` 로 grep 한 결과 하드코딩된 시크릿·자격증명 없음.
  - 제안: 해당 없음 (문제 없음의 기록).

- **[INFO]** 정규식 기반 스캔의 ReDoS 가능성은 이론상 존재하나 실질 위험 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:79-81` (`stripLiterals` 의 `` `(?:[^`\\]|\\[\s\S])*` `` 류 패턴), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:168-169` (`WIDENED_DECL`)
  - 상세: 위 패턴들은 중첩 정량자 형태가 아니라 선형(교대 문자 클래스) 구조라 catastrophic backtracking 유발 형태는 아니며, 입력도 공격자가 통제할 수 없는 저장소 자신의 소스 파일(수백 KB 이하, CI/로컬 테스트 실행 컨텍스트)로 한정된다. 프로덕션 요청 경로에 노출되지 않으므로 DoS 벡터로 보지 않는다.
  - 제안: 조치 불필요. 향후 이 유틸을 프로덕션/사용자 입력 처리 경로로 재사용할 계획이 생기면 그때 재평가할 것.

- **[INFO]** `findStaleSpecCasts`/`findUntypedNullableColumns` 는 오탐(false negative) 방향의 한계를 스스로 문서화
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`WIDENED_DECL` 주변 주석, "추가 데코레이터는 1개까지만 본다")
  - 상세: 이 가드들은 프로덕션 보안 통제가 아니라 "타입 표기가 런타임 nullable 을 정확히 반영하는지"를 잡는 코드 품질 가드다. 문서화된 blind spot(데코레이터 2개 이상 스택, CTE 접두 UPDATE/DELETE 미탐지 등)은 SQL 인젝션이나 인증 우회와는 무관하며, 저장소 전수 조사로 현재 미발현임을 실측했다고 기재되어 있다(리뷰 대상 diff 자체에 근거 기록).
  - 제안: 해당 없음. 참고로만 기록.

## 요약

이번 diff 는 전부 테스트/빌드 시점에만 동작하는 repo-guard 정적 분석 인프라(파일 워커
중복 5곳을 `collectTsFiles` 로 통합, `null as unknown as` 캐스트·미타입 nullable 컬럼을
찾는 가드 신설, 관련 plan 문서 갱신)로, 사용자 입력·네트워크·인증/인가·암호화·에러 응답
등 OWASP Top 10 이 통상 겨냥하는 런타임 attack surface 와 접점이 없다. 인젝션·하드코딩
시크릿·인증 우회·안전하지 않은 암호화 알고리즘 등 어떤 카테고리에서도 실질 결함을
발견하지 못했다. 스캔에 쓰인 정규식은 이론적 ReDoS 형태가 아니고 입력도 공격자 통제
밖(저장소 자체 소스)이라 위험도를 낮춘다.

## 위험도

NONE
