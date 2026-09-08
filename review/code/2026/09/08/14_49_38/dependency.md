# 의존성(Dependency) 코드 리뷰

## 사전 확인

`git diff origin/main...HEAD --stat -- '**/package.json' '**/pnpm-lock.yaml' 'pnpm-workspace.yaml'` →
**0건**. 이번 배치(6커밋: `03f665c63`·`9ab43690a`·`05b899d1f`·`d80583700`·`ead63d797`·`76bd51aab`,
138파일)는 어떤 매니페스트·lockfile 도 건드리지 않는다. 새 외부 패키지 추가는 없다.

## 발견사항

- **[INFO]** `typescript`(기존 devDependency, `^5.7.3`)의 소비처가 한 곳 더 늘었다 — 신규 패키지
  아님, 격리 경계 재확인만
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`import * as ts from
    'typescript';`), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:10`
  - 상세: `source-scan.ts` 가 `enclosingScopeName` AST 워커를 갖게 되면서 `typescript` 를
    처음으로 import 한다. `typescript` 는 `codebase/backend/package.json:129` 의
    `devDependencies` 에 있다 — 프로덕션 dist 에 devDependency 가 실리면 런타임 지뢰가 된다.
    이 저장소는 정확히 그 축을 `production-build-devdep-guard.ts`(디렉터리 단위, tsconfig 해석
    기반)로 막고 있고, `source-scan.ts` 가 속한 `__test-utils__/` 글로브는 같은 배치의
    `codebase/backend/tsconfig.build.json` 커밋에서 **이 import 보다 먼저** `exclude` 에
    들어갔다 — 순서상 안전하다(`grep -n '"typescript"' codebase/backend/package.json` 로
    devDependency 위치 재확인 완료, `production-build-devdep.spec.ts` 의 신규
    `it.each(['repo-guards','shared/testing','__test-utils__'])` 캐너리가 이 디렉터리를
    빌드 대상 목록에서 실측으로 배제 확인).
  - 제안: 조치 불요. 다만 **이 배치 자신의 3라운드 리뷰(W3, `review/code/2026/09/08/14_29_12`)가
    이미 같은 지점을 잡았다** — `tsconfig.build.json` 세 번째 exclude 항목의 원래 주석이
    "devDependency 를 끌어오지 않는 형태"라고 사유를 적었는데, 같은 배치의 뒷 커밋이 바로 그
    devDependency import 를 추가해 그 문장을 반증했다. 저자가 주석을 취소선 + 정정으로 이미
    갈았다(`tsconfig.build.json` 세 번째 exclude 주석, `source-scan.ts` 헤더 주석) — 재수정
    불필요, 정정 내용이 실제 diff 와 일치함을 확인했다.

- **[INFO]** 내부 의존 방향 정리 — `pg-error.ts` 를 SoT 로 삼는 중복 제거 2건
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (로컬
    `isUniqueViolation` 삭제 → `isPostgresUniqueViolation` import), `codebase/backend/src/modules/integrations/integration-oauth.service.ts`
    (손-작성 constraint 추출 두 곳 → `pgErrorConstraint` import)
  - 상세: 두 소비처가 각자 손으로 구현하던 판정/추출 로직을 `../db/pg-error` 단일 모듈로
    수렴시킨다. 순수 리팩터(동작 등가, 두 표면 처리 로직 자체는 변경 없음)이고 모듈 결합
    방향도 올바르다(공용 모듈 → 소비 서비스, 역방향 없음). 신규 순환 의존 없음.
  - 제안: 조치 불요.

- **[INFO]** 내부 의존 방향 정리 — `enclosingScopeName` 을 `source-scan.ts` 로 승격해 두
  형제 가드가 공유
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (로컬
    `enclosingName` 삭제 → import), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
    (신규 가드, 처음부터 공유 함수 사용)
  - 상세: 같은 책임의 AST 워커가 두 가드에 각자 있던 것을 공용 test-utils 모듈로 합쳤다.
    `repo-guards/__tests__/*` → `common/__test-utils__/*` 방향으로, 기존 `toPosixRelative` 도
    같은 방향으로 이미 공유되고 있어 결합 방향이 일관적이다.
  - 제안: 조치 불요.

- **[INFO]** 빌드 파이프라인에 순차 스텝 2개 추가 — 외부 의존성은 아니지만 로컬 `build`
  단계 실행 시간에 영향
  - 위치: `.claude/test-stages.sh` (`_cmd_typecheck_ratchets()`, `cmd_build()` 안
    `_cmd_typecheck_ratchets &&` 호출)
  - 상세: 기존에 CI 전용이던 `check-backend-typecheck-ratchet.py` ·
    `check-frontend-typecheck-ratchet.py` 두 스크립트(둘 다 프로젝트 내부 스크립트, 외부
    패키지 아님)가 `&&` 로 순차 실행되며 로컬 `run-test.sh build` 안에 편입된다. 두 스크립트는
    서로 다른 패키지(backend/frontend)의 독립적인 `tsc` 전체 프로그램 typecheck 라 상호
    의존은 없다. 이 변경 자체가 CI 에서만 걸리던 타입 사각(`#1292`, TS2739)을 로컬로 당겨오기
    위한 의도된 트레이드오프임을 `.claude/test-stages.sh`·`PROJECT.md`·두 스크립트 docstring
    이 일관되게 설명한다.
  - 제안: 조치 불요(이미 performance 리뷰어가 병렬화 여지를 INFO 로 기록함 — 이 관점에서는
    "새 외부 의존성" 이 아니라는 것만 확인).

## 요약

이번 배치(138파일, 6커밋)는 `package.json`·`pnpm-lock.yaml`·`pnpm-workspace.yaml` 어디도 건드리지
않아 새 외부 의존성·버전 변경·라이선스·취약점 축에서 검토할 항목이 없다. 유일하게 의존성
관점에서 볼 만한 것은 기존 devDependency `typescript` 의 소비처가 테스트 전용 AST 유틸
(`source-scan.ts`)로 하나 늘어난 것인데, 그 파일이 속한 `__test-utils__/` 글로브가 같은 배치
안에서 먼저 `tsconfig.build.json` exclude 에 들어가 프로덕션 빌드 격리가 유지된다 — 그 사유
주석이 한때 자기모순(추가된 import 가 원래 주석의 전제를 반증)이었으나 저자가 같은 PR 의
후속 라운드(`review/code/2026/09/08/14_29_12` W3)에서 이미 정정했음을 diff 로 직접 대조해
확인했다. 나머지는 전부 내부 모듈 의존 정리(`pg-error.ts` SoT 통합, `enclosingScopeName` 승격)로
결합 방향이 올바르고 순환 의존이나 불필요한 의존성 증가는 없다. Critical/Warning 급 의존성
결함은 발견되지 않았다.

## 위험도

NONE
