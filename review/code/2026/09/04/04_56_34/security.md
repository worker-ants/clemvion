# 보안(Security) 리뷰

## 리뷰 범위 및 맥락

이번 diff 는 `codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}` 와
`codebase/backend/src/repo-guards/__tests__/**` (5개 walker 소비 가드 + 신규
`nullable-type-lie-cast-guard.ts`/`.spec.ts`), 그리고 관련 `plan/in-progress/
entity-nullable-column-type-mismatch.md` 문서 갱신이다. 실질 코드 변경은 9개 파일이고
나머지는 이 changeset 자신의 이전 리뷰 라운드(01_48_39 ~ 04_37_28, 총 8라운드) 산출물이
저장소 관례(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/**`")대로 커밋된 것이다.

`git log`(`4d7888625` 최신 fix 커밋 포함)와 실제 소스(`source-scan.ts`,
`nullable-type-lie-cast-guard.ts`)를 직접 열어 현재 상태를 확인했다. 이전 8라운드에서
security reviewer 가 매 라운드 NONE 판정을 냈고, 이번 라운드까지 그 판정을 뒤집을 신규
보안 표면은 발견하지 못했다.

## 발견사항

없음.

핵심 근거:

- **인젝션(SQL/커맨드/경로탐색)**: 모든 파일 접근은 `fs.readdirSync`/`fs.readFileSync` 로,
  스캔 루트는 코드에 하드코딩된 상수(`SRC_ROOT = path.resolve(__dirname, '..', '..')`,
  `MODULES_DIR`, `ENGINE_DIR`, `UNION_SOURCE` 등)이거나 테스트가 `os.tmpdir()` 에 스스로
  만든 픽스처뿐이다. 사용자·네트워크 입력이 개입할 지점이 없다. `collectTsFiles` 의
  `path.join(dir, entry.name)` 은 `readdirSync` 로 얻은 실제 디렉터리 엔트리만 이어붙이므로
  `..` 주입 등 경로 탈출 표면이 없다.
- **하드코딩된 시크릿**: 없음. `nullable-type-lie-cast-guard.ts`/`.spec.ts` 의
  `passwordHash` 류 문자열은 `@Column` 판정 정규식 테스트용 필드명 fixture이지 실제
  자격증명이 아니다.
- **인증/인가**: 해당 코드는 CI/로컬 jest 실행 시점에만 도는 정적 분석 스크립트로, 런타임
  요청 경로·API·세션 관리를 전혀 다루지 않는다. 인증/인가 표면 자체가 없다.
- **입력 검증 / ReDoS**: `WIDENED_DECL`·`COLUMN_DECL` 의 `(?:[^()]|\([^()]*\))*` 형태는
  문자 클래스가 `(`/`)` 를 배제해 대안이 상호 배타적이므로 catastrophic backtracking 조건이
  성립하지 않고, 입력도 전부 저장소 자신의 신뢰된 `.ts` 소스(공격자가 통제 불가능)이므로
  DoS 벡터로 성립하지 않는다. `stripLiterals`/`stripComments` 도 동일하게 문자 클래스 부정
  기반 교대라 중첩 정량자가 없다.
- **OWASP Top 10 / 암호화 / 평문 전송 / 의존성**: 네트워크 호출, 암호화 연산, HTTP 응답,
  신규 외부 의존성이 diff 에 없다. 순수 `node:fs`/`node:path`/`typescript` 만 사용.
- **에러 처리**: 이 도구가 던지는 예외(`readCatalogComponents` 등)는 CI/로컬 개발자를
  대상으로 한 진단 메시지이며, 최종 사용자에게 노출되는 경로가 아니다.

## 요약

이번 diff 는 전부 빌드/테스트 시점에만 실행되는 내부 정적 분석 가드(repo-guards)의
리팩터링(중복 walker 5개를 `collectTsFiles` 로 통합)과 신규 가드(`widenedEntityFields`/
`findStaleSpecCasts`/`isNullableType`) 추가로, 런타임 애플리케이션 코드·API·DB 접근·
인증/인가 로직을 전혀 건드리지 않는다. 스캔 대상이 항상 저장소 자신의 하드코딩된 신뢰
경로이거나 테스트가 만든 임시 픽스처뿐이라 인젝션·경로탈출·시크릿 노출·안전하지 않은
암호화 같은 전통적 보안 결함이 성립할 표면이 원천적으로 없다. 정규식의 이론적
backtracking 구조와 `.d.ts` 스캔 범위 같은 세부는 이전 라운드에서 이미 검토돼 무해로
확인됐고, 이번 라운드에서 직접 소스를 재확인한 결과도 동일하다. 저장소 파일은 수정하지
않았다(`git status --short` 상 이 리뷰 세션 자신의 `review/code/2026/09/04/04_56_34/`
디렉터리만 untracked 로 남아 있으며 원복이 필요한 잔여물은 없다).

## 위험도

NONE
