# Security Review

## 범위

이번 changeset 은 `codebase/backend/src/repo-guards/__tests__/` 및
`codebase/backend/src/common/__test-utils__/` 하위의 **저장소 구조적 회귀 가드(repo-guard) 및
테스트 유틸리티**를 리팩터링한 것과, 그 작업을 기록한 `plan/in-progress/` 문서 갱신,
그리고 이전 리뷰 세션의 `review/code/**` 산출물(`meta.json`, `_retry_state.json`)이다.

- `source-scan.ts` 에 `collectTsFiles(root, { includeSpec })` 를 신설해 5개 가드
  파일(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
  `masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`·
  `nullable-type-lie-cast-guard.ts`)에 흩어져 있던 동일한 디렉터리 재귀 워커 로직을
  통합했다.
- `stripLiterals` 를 신설해 `.spec.ts` 픽스처의 문자열/템플릿 리터럴 내용을 지우고 낡은
  캐스트 탐지 오탐을 없앴다.
- 모든 스캔 루트(`SRC_ROOT`, `MODULES_DIR`, `ENGINE_DIR`, `UNION_SOURCE` 등)는 코드에
  **하드코딩된 상수 경로**이며 외부 입력(HTTP 요청, CLI 인자, 환경변수)에서 오지 않는다.
  네트워크로 노출되는 프로덕션 런타임 코드가 아니라, `jest`/CI 가 로컬 저장소 소스 트리를
  스캔하는 **빌드타임 전용 가드**다.

## 발견사항

- **[INFO]** 정규식 기반 파서에 이론적 ReDoS 표면이 있으나 공격자 입력 경로가 없다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53`(`stripComments`),
    `codebase/backend/src/common/__test-utils__/source-scan.ts:77`(`stripLiterals`),
    `codebase/backend/src/common/__test-utils__/source-scan.ts:157`(`countRawUpdateReturning`
    의 `CALL` 정규식), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:169`
    (`WIDENED_DECL`)
  - 상세: 이 정규식들은 백트래킹 가능한 패턴(`[\s\S]*?`, 중첩 그룹 등)을 포함하지만,
    입력은 항상 **이 저장소 자신의 TypeScript 소스 파일**이며 신뢰되지 않는 사용자 입력이나
    네트워크 페이로드가 아니다. 실행 주체도 CI/로컬 테스트 러너뿐이라 공격자가 이 경로에
    입력을 주입할 방법이 없다. `WIDENED_DECL` 은 `(?:[^()]|\([^()]*\))*` 형태로 중첩
    정량자를 갖지만 대상이 고정 소스 트리이므로 실질 위험은 없다.
  - 제안: 조치 불필요. 향후 이 유틸을 사용자 제공 소스(예: 플러그인 업로드)에 재사용할
    계획이 생기면 그때 벤치마크로 재평가할 것.

- **[INFO]** `masked-reject-callers-guard.ts` 의 AST 전환은 보안 하드닝의 긍정적 개선
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` —
    `importsBaseFn` 함수
  - 상세: 이 changeset 자체가 도입한 코드는 아니지만(선행 커밋에서 이미 AST 전환됨),
    `collectTsFiles(rootDir, { includeSpec: true })` 로의 전환이 이 가드가 스캔하는 파일
    집합의 정합성(=주석에 적힌 "다섯 사본 중 `.spec.ts` 포함 여부만 실제로 결과를 바꾼다"는
    실측 근거)에 의존한다. `collectTsFiles` 의 단위테스트(`source-scan.spec.ts`)가
    `includeSpec`·`.d.ts` 제외·`node_modules`/`dist` skip·정렬을 각각 직접 단언하고 있어
    이 가드의 탐지 범위가 리팩터로 축소되지 않았음을 확인했다(회귀 없음).

- **[INFO]** `review/code/2026/09/04/01_48_39/_retry_state.json`·`meta.json` 에 시크릿 없음
  - 위치: `review/code/2026/09/04/01_48_39/_retry_state.json`,
    `review/code/2026/09/04/01_48_39/meta.json`
  - 상세: 이전 리뷰 세션의 orchestrator 상태 파일이다. 내용은 절대 경로·에이전트 이름·
    라우팅 사유 문자열뿐이며 API 키/토큰/자격증명 등 하드코딩된 시크릿은 없다.

## 점검 관점별 결론

1. **인젝션**: 대상 없음. 파일시스템 경로는 전부 상수 조합(`path.join(repoRoot, MODULES_DIR)`
   등)이고 사용자 입력이 개입하지 않는다. SQL 문자열은 오히려 **탐지 대상**(라이브 코드의
   raw `UPDATE...RETURNING` 오용을 잡는 가드)이지 이 diff 가 실행하는 쿼리가 아니다.
2. **하드코딩된 시크릿**: 없음.
3. **인증/인가**: 대상 없음 — 런타임 API 표면을 건드리지 않는 테스트 전용 코드.
4. **입력 검증**: `collectTsFiles`/`stripLiterals`/`countRawUpdateReturning` 등은 신뢰된
   로컬 소스 트리만 읽는다. 외부 신뢰 경계를 넘는 입력이 없어 별도 검증 불요.
5. **OWASP Top 10**: 해당 표면 없음(비-웹, 비-API 코드).
6. **암호화**: 대상 없음.
7. **에러 처리**: 신설/변경된 함수들은 예외를 던지지 않고 배열/불리언을 반환한다.
   테스트 실패 시 노출되는 정보는 CI 로그의 파일 경로·필드명뿐으로 민감정보 노출 없음.
8. **의존성 보안**: 신규 의존성 추가 없음(`node:fs`, `node:path` 는 Node 내장 모듈,
   `typescript` 는 기존 backend 직접 의존성 재사용).

## 요약

이번 changeset 은 프로덕션 런타임 코드가 아니라 저장소 구조적 회귀 가드(repo-guard)와
테스트 유틸리티의 리팩터링(중복 디렉터리 워커 5개 → `collectTsFiles` 단일화, 문자열
리터럴 스트리핑 신설)이며, 스캔 대상은 모두 저장소 자체의 신뢰된 소스 트리이고 입력 경로에
공격자가 개입할 지점이 없다. 하드코딩된 시크릿, 인젝션 가능 지점, 인증/인가 우회,
안전하지 않은 암호화, 민감정보 노출 에러 처리, 신규 취약 의존성 중 어느 것도 발견되지
않았다. 정규식 기반 파싱에 이론적 ReDoS 표면이 있으나 입력이 신뢰된 로컬 소스로 고정돼
있어 실질 위험은 없다(INFO 로만 기록).

## 위험도

NONE
