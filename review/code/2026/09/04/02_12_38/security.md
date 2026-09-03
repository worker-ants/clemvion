# Security Review

## 발견사항

- **[INFO]** `WIDENED_DECL` 정규식에 중첩 정량자 형태(`(?:[^()]|\([^()]*\))*`)가 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`WIDENED_DECL` 상수 선언부, diff 게이트 142 부근)
  - 상세: 괄호 균형을 잡는 `(?:[^()]|\([^()]*\))*` 패턴은 각 위치에서 대안이 서로 배타적(문자 클래스가 `(`/`)` 를 제외)이라 catastrophic backtracking(지수적)은 아니지만, 불균형 괄호가 이어지는 입력에서는 위치별 재시도로 최악의 경우 준선형~이차에 가까운 비용이 날 수 있다. 다만 이 정규식은 저장소 자신의 `.entity.ts` 파일(신뢰된, 크기가 작고 고정된 소스)에만 적용되는 **테스트/빌드 타임 전용 가드**이고, 외부 입력이나 네트워크 경로로는 전혀 도달하지 않는다.
  - 제안: 실질 위험은 낮음. 별도 조치 불필요 — 다만 향후 이 정규식이 사용자 입력이나 대용량/비신뢰 텍스트에 재사용되는 일이 생기면 그 시점에 재평가할 것.

## 요약

이번 변경분은 전부 `codebase/backend/src/repo-guards/__tests__/`·`common/__test-utils__/` 하위의 **빌드/테스트 전용 정적 분석 가드**(구조적 회귀 가드)와 그 테스트, 그리고 관련 plan 문서 갱신이다. 다섯 개의 중복 디렉터리 워커(`walkTsFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`/`collectSourceFiles`)를 `source-scan.ts` 의 `collectTsFiles()` 로 통합하고, 엔티티의 `| null` 로 넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트를 찾는 `widenedEntityFields`/`findStaleSpecCasts` 를 추가했다. 모든 파일 접근은 하드코딩된 상수 경로(`MODULES_DIR`, `ENGINE_DIR`, `SRC_ROOT`, `UNION_SOURCE`, `CATALOG_SPEC`)나 재귀 디렉터리 워크로만 이뤄지며, 외부/사용자 입력이 이 경로에 전혀 개입하지 않는다 — 즉 경로 탐색·인젝션·인증/인가·평문 전송·암호화 관련 공격 표면이 존재하지 않는다. 하드코딩된 시크릿·자격증명도 발견되지 않았고, 에러 메시지(`readCatalogComponents` 의 throw)도 CI 개발자를 대상으로 한 진단 정보일 뿐 민감정보 노출이 아니다. 신규 외부 의존성도 없다(순수 `node:fs`/`node:path`/`typescript` 사용, 기존 의존성 그대로). 유일한 관찰 사항은 정규식 구조에 대한 정보성 노트(INFO)이며 실질 위험은 없다.

## 위험도

NONE
