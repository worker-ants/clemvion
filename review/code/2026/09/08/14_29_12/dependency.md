# 의존성(Dependency) 코드 리뷰

## 발견사항

- **[WARNING]** `tsconfig.build.json` 세 번째 exclude 자리의 "devDependency 를 끌어오지 않는다" 근거가 같은 배치 안에서 이미 반증됐다
  - 위치: `codebase/backend/tsconfig.build.json:21-24` (`"**/__test-utils__/**"` 바로 위 주석) vs `codebase/backend/src/common/__test-utils__/source-scan.ts:42` (`import * as ts from 'typescript';`, `enclosingScopeName` 정의는 같은 파일 `:110`)
  - 상세: `tsconfig.build.json` 은 같은 exclude 배열 안에서 첫 번째 자리(`src/repo-guards/**`, `:12-15`)의 트리거를 **명시적으로** "`masked-reject-callers-guard` 가 devDependency 인 `typescript` 를 import 하면서 그 오염이 실제 위험이 됐다"고 적어 두고 있다. 그런데 세 번째 자리(`**/__test-utils__/**`, `:21-24`)의 주석은 "그 5파일은 … devDependency 를 끌어오지 않아 … 즉 죽은 코드가 번들에 실릴 뿐인 형태다"라고 적는다 — 이 axis 를 "1·2번째와 다른, 더 약한 위험"으로 규정한 것이다. 그러나 그 exclude 로 보호받는 파일 중 하나인 `source-scan.ts` 는 (같은 리뷰 배치 안의 후속 커밋 `d80583700` 에서) `enclosingScopeName` 을 승격시키며 정확히 `import * as ts from 'typescript'` 를 새로 추가했다 — 1번째 자리가 경고하던 바로 그 패키지다. `typescript` 는 `codebase/backend/package.json` 의 `devDependencies` 에만 있고 `dependencies` 에는 없다(확인 완료). 즉 세 번째 자리의 "devDependency 프리" 전제가 현재 HEAD 기준으로는 더 이상 사실이 아니다.
    실제 빌드 안전성 자체는 깨지지 않았다 — `production-build-devdep-guard.ts` 의 `findDevDepLeaks()` 는 `resolveBuildFileNames()`(= `tsconfig.build.json` 을 `ts.parseJsonConfigFileContent` 로 실제 해석한 파일 목록)를 순회하므로, 디렉터리 자체가 exclude 되면 그 안의 import 내용과 무관하게 스캔 대상에서 빠진다(구조적 방어, self-healing). git 이력도 순서가 안전한 쪽이다 — exclude 추가(`03f665c63`)가 `typescript` import 추가(`d80583700`)보다 **먼저** 커밋됐으므로, 어떤 시점에도 `typescript` 가 dist 로 나간 적은 없다.
    다만 주석의 **근거 서술**이 틀렸다는 점은 남는다. 다음 사람이 이 주석만 읽고 "`__test-utils__` 는 devDependency 위험이 없는 축"이라고 판단해, 예컨대 경로 매칭을 디렉터리명 대신 다시 파일 목록으로 좁히는 리팩터를 시도하면 — 1번째 자리가 겪은 것과 같은 종류의 devDependency 누출 재발 창이 열린다.
  - 제안: `tsconfig.build.json:21-24` 주석에서 "devDependency 를 끌어오지 않아" 문장을 취소선 + 정정하거나, 최소한 "현재는 `source-scan.ts` 가 `typescript` 를 import 하므로 이 axis 도 devDependency 격리 목적을 겸한다"로 갱신할 것. 근거 서술이 실측과 어긋난 상태로 남으면 다음 편집자의 판단 축을 왜곡한다(이 저장소가 반복 지적해 온 "미측정/반증된 전제" 클래스).

- **[INFO]** 이번 배치(110개 변경 파일) 전체에서 새 외부 의존성 추가 없음
  - 위치: 해당 없음(부재의 확인) — `git diff origin/main --stat -- '**/package.json' '**/pnpm-lock.yaml' '**/pnpm-workspace.yaml'` 결과 0건
  - 상세: 매니페스트·lockfile·workspace 설정 변경이 전혀 없다. `codebase/backend/tsconfig.build.json` 의 `exclude` 배열 수정(내부 컴파일 범위 조정)만 있고, `PROJECT.md`·`CHANGELOG.md`·`.claude/test-stages.sh` 는 기존 스크립트(`scripts/check-{backend,frontend}-typecheck-ratchet.py`)를 새 위치(`run-test.sh build` 단계)에서 부르도록 배선만 바꿨을 뿐 새 툴체인을 들이지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `http-exception.filter.ts` — 직접 `typeorm` import 제거, 내부 SoT 로 대체 (의존 표면 축소 + 중복 제거)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` — `import { QueryFailedError } from 'typeorm';` 삭제, `import { isPostgresUniqueViolation } from '../db/pg-error';` 신설, 로컬 `isUniqueViolation()` 함수 삭제, 소비 지점은 `isPostgresUniqueViolation(exception)` 호출부(원 파일 기준 71번째 줄 부근, `} else if (...)`).
  - 상세: 종전에는 이 필터가 `typeorm` 의 `QueryFailedError` 클래스에 `instanceof` 로 직접 의존했다. 그 의존이 `err.driverError.code` 표면만 보고 raw `err.code` 표면을 놓치는 결함의 원인이었다(`isPostgresUniqueViolation` 은 두 표면을 구조적으로 흡수). 이 교체로 (a) 이 파일의 외부 라이브러리 직접 의존이 하나 줄고, (b) 저장소 안에 흩어져 있던 "postgres unique-violation 판정" 로직이 `common/db/pg-error.ts` 한 곳으로 더 좁게 수렴한다. `integration-oauth.service.ts` 의 두 호출부도 같은 배치에서 손-작성 constraint 추출을 `pgErrorConstraint()` 호출로 교체해(`import` 목록에 `pgErrorConstraint` 추가) 같은 방향의 내부 의존 정리를 이어간다.
  - 제안: 조치 불요 — 긍정적 방향.

- **[INFO]** `enclosingScopeName` AST 헬퍼를 형제 가드 간 중복에서 공용 모듈로 승격 — 내부 의존 그래프 정리, 외부 패키지 변경 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:110`(신설 함수) — 소비처는 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(`import { enclosingScopeName, toPosixRelative } from '../../common/__test-utils__/source-scan';`, 로컬 `enclosingName()` 삭제) 및 `endpoint-path-conflict-wrap-guard.ts`.
  - 상세: 같은 책임의 AST 워커(감싸는 메서드/변수 이름 추출)가 두 repo-guard 파일에 각자 손으로 존재하던 것을 공용 `source-scan.ts` 로 합쳤다. `typescript` 자체는 이미 저장소 전역에서 9개 이상의 `repo-guards/__tests__/*-guard.ts` 파일이 동일하게 import 하는 기존 devDependency(`^5.7.3`, `dependencies` 에는 없음)라 새 외부 의존은 아니다. 내부 의존 그래프 관점에서는 "동일 로직의 독립 사본 2개 → 공용 함수 1개 + 참조 2곳"으로 개선된 형태.
  - 제안: 조치 불요.

- **[INFO]** `tsconfig.build.json` exclude 확장의 순 효과는 프로덕션 번들 축소(음의 방향 없음)
  - 위치: `codebase/backend/tsconfig.build.json:28` (`"**/__test-utils__/**"`)
  - 상세: 이 exclude 로 `common/__test-utils__/`·`modules/integrations/__test-utils__/` 의 테스트 전용 헬퍼(실측 5개 이상 파일, `typescript` AST 파서 코드 포함)가 `dist` 산출물에서 빠진다. 타입 커버리지 손실은 없다 — 같은 배치가 `run-test.sh build` 안에 편입한 타입체크 ratchet(`scripts/check-backend-typecheck-ratchet.py`)이 `tsconfig.json`(테스트 경로 포함)을 써서 이 디렉터리를 계속 타입체크한다. 순수하게 빌드 산출물 크기·잠재적 devDependency 노출면을 줄이는 변경.
  - 제안: 조치 불요.

## 요약

이번 배치(B-1~B-8, 110개 변경 파일)에서 `package.json`/lockfile/workspace 설정 변경은 전혀 없어 새 외부 의존성·라이선스·알려진 취약점 이슈는 발생하지 않는다. 실질적인 의존성 관점 변화는 모두 **내부** 축이다 — `http-exception.filter.ts` 가 직접 `typeorm` import 대신 기존 SoT(`pg-error.ts`)에 의존하도록 좁혀졌고, `integration-oauth.service.ts` 두 호출부와 두 repo-guard 의 AST 헬퍼가 각각 공용 함수(`pgErrorConstraint`/`enclosingScopeName`)로 수렴해 중복 구현이 줄었다. `tsconfig.build.json` 의 새 exclude(`**/__test-utils__/**`)는 프로덕션 번들에서 죽은 테스트 헬퍼 코드를 제거하는 순기능이며, devDependency 누출 방지 메커니즘(`production-build-devdep-guard.ts`)이 tsconfig 해석 기반이라 구조적으로 안전하다 — 다만 그 exclude 를 정당화하는 주석("devDependency 를 끌어오지 않는다")이 같은 배치의 후속 커밋에서 `source-scan.ts` 에 추가된 `typescript` import 로 인해 사실과 어긋나게 됐다. 기능적 위험은 없지만(exclude 가 디렉터리 단위로 이미 막고 있고 git 이력상 위험 노출 구간도 없었다), 근거 문구가 현재 코드와 모순되므로 정정을 권한다.

## 위험도

LOW
