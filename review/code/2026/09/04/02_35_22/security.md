# 보안(Security) 리뷰

## 리뷰 범위

실제 코드 변경은 파일 1~9 (`source-scan.ts`/`.spec.ts`, `repo-guards/__tests__/` 5개 가드, `plan/in-progress/entity-nullable-column-type-mismatch.md`)이다. 파일 10 이후는 이전 리뷰 라운드(`01_48_39`, `01_49_18`, `02_12_38`)가 산출한 `review/code/**` 리포트·메타 파일을 저장소에 그대로 커밋한 것으로, 신규 로직이 아니라 리뷰 이력 기록물이다. 시크릿·자격증명 패턴(password/secret/api key/token/private key 등)을 전체 프롬프트 대상으로 검색했으나 일치 없음.

핵심 변경 내용: `repo-guards/__tests__/` 5개 가드에 중복돼 있던 디렉터리 재귀 walker(`readdirSync` 기반) 를 `common/__test-utils__/source-scan.ts` 의 `collectTsFiles()` 하나로 통합하고, 엔티티의 `| null` 로 넓혀진 필드를 겨눈 `.spec.ts` 낡은 캐스트를 찾는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`, 정규식 `WIDENED_DECL`/`SPEC_CAST`, 리터럴 제거용 `stripLiterals`)를 추가했다. 이 코드는 전부 `jest` 테스트/빌드타임 정적 분석 도구이며, 스캔 대상은 저장소 자신의 소스 트리(`SRC_ROOT`, `codebase/backend/src` 하위 고정 경로 또는 테스트가 만든 `os.tmpdir()` 픽스처)뿐이다. 사용자 입력·네트워크 입력·외부 요청을 받지 않고, 프로덕션 런타임에 배포되지도 않는다(파일 상단 docstring: "jest 타입 비의존… 테스트 전용"). 따라서 OWASP Top10/인젝션/인증/암호화/평문전송 관점의 공격 표면이 원천적으로 없다.

## 발견사항

- **[INFO]** `collectTsFiles` 통합으로 `.d.ts` 필터가 항상 켜지면서 스캔 범위가 조용히 좁아진 소비처가 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` `listSourceFiles` (구현은 `collectTsFiles` 위임 지점) / `codebase/backend/src/common/__test-utils__/source-scan.ts` `collectTsFiles` 함수 본문의 `!entry.name.endsWith('.d.ts')` 조건
  - 상세: 통합 전 `masked-reject-callers-guard.ts` 의 구 `listSourceFiles` 는 `.d.ts` 를 걸러내지 않았고, `engine-error-code-anchor-guard.ts` 의 구 `walkTsFiles` 도 `.d.ts` 필터가 없었다. 통합된 `collectTsFiles` 는 `.d.ts` 를 항상 제외한다. 보안 관점에서 이 축은 "탐지 대상이 줄어드는" 방향(구조적 가드의 위음성 가능성)이지 인젝션·정보노출·권한 문제는 아니다. `plan/in-progress/entity-nullable-column-type-mismatch.md` 실측(`src` 하위 `.d.ts` 0개) 및 리뷰 이력(`review/code/2026/09/04/01_49_18/security.md` INFO#2, `02_12_38/security.md`)에서 이미 다뤄졌고 무해로 판정됨 — 재확인만 하고 신규 지적으로 올리지 않는다.
  - 제안: 조치 불필요. `src/` 하위에 `.d.ts` 가 생기는 시나리오가 실재하면 그때 재검토.

- **[INFO]** `stripLiterals`/`WIDENED_DECL` 정규식은 저장소 자신의 신뢰된 소스만을 입력으로 받으므로 ReDoS 실질 위험 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` `stripLiterals` 함수, `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` `WIDENED_DECL` 상수
  - 상세: `stripLiterals` 의 세 `replace` 는 문자 클래스 부정(`[^'\\\n]`, `[^"\\\n]`, `[^`\\]`) 기반 교대라 prefix-disjoint 구조이고 중첩 정량자가 없어 catastrophic backtracking 조건이 성립하지 않는다. `WIDENED_DECL` 도 `(?:[^()]|\([^()]*\))*` 형태로 얕은 1단 중첩만 허용한다(문서화된 한계: 추가 데코레이터 1개까지, INFO#1 로 이미 3개 리뷰어가 공통 지적·docstring 반영됨). 입력은 CI/로컬 빌드 시점에 저장소 자신의 `.ts`/`.spec.ts` 파일 내용이며 외부 신뢰 경계를 넘지 않는다 — 공격자가 통제 가능한 입력이 아니므로 DoS 벡터로 성립하지 않는다.
  - 제안: 조치 불필요. 스캔 대상 파일 수·크기가 크게 늘어나면(예: 수만 파일) 성능 관점에서만 재확인 권장(성능 축).

- **[INFO]** `collectTsFiles` 는 경로 결합에 `path.join` 을 쓰고 스캔 루트가 호출부 상수(`SRC_ROOT`, `MODULES_DIR`, `ENGINE_DIR` 등 리터럴)로 고정돼 있어 경로 탐색(path traversal) 표면 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` `collectTsFiles` 함수
  - 상세: 재귀 walker 는 `fs.readdirSync` 로 얻은 디렉터리 엔트리만 `path.join` 하여 내려가며, 사용자 입력이나 심볼릭 링크 처리 관련 위험 요소(`..` 삽입 등)를 받는 지점이 없다. 신규 spec 픽스처(`source-scan.spec.ts`)도 `os.tmpdir()` 에만 쓴다.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 테스트/빌드타임 정적 분석 도구(repo-guards)의 내부 리팩터링과 신규 가드 추가로, 런타임 애플리케이션 코드·API·DB 접근·인증/인가 로직을 전혀 건드리지 않는다. 스캔 대상은 항상 저장소 자신의 신뢰된 소스 트리 또는 테스트가 `os.tmpdir()` 에 만든 임시 픽스처뿐이라 인젝션·인증우회·시크릿 노출·안전하지 않은 암호화 같은 전통적 보안 결함이 성립할 표면이 없다. 하드코딩된 시크릿·자격증명은 diff 전체(리뷰 이력 파일 포함)에서 발견되지 않았다. `.d.ts` 스캔 범위 축소와 정규식의 이론적 backtracking 특성은 이미 이전 리뷰 라운드에서 다뤄졌고 실질 위험이 없음을 재확인했다(신뢰 입력·완화된 정규식 구조).

## 위험도

NONE
