# 의존성(Dependency) Review — masked-marker-contract-7d2e14 (라운드 8, 14_19_12)

## 검토 방법

이 PR 은 이번이 8라운드째 코드 리뷰다. 의존성 관점 리뷰는 이미 4개 선행 라운드
(`11_27_29`/`11_53_49`/`12_25_15`/`13_14_29`)에서 독립적으로 수행됐고 전부 **위험도 NONE**
으로 수렴했다. 이번 라운드는 프롬프트(137개 파일, 대부분 이전 7라운드의 review/consistency
산출물 자체)를 전수 확인하고, 실제 의존성 표면(신규 패키지 `codebase/packages/masked-markers/**`,
CI/Docker 등록 8곳, `pnpm-lock.yaml`)을 `git diff origin/main...HEAD`·`Read` 로 직접 재실측했다.

## 발견사항

- **[INFO]** 새 내부 워크스페이스 패키지 `@workflow/masked-markers` 추가 — 런타임 외부 의존
  zero, devDependencies 는 형제 패키지와 버전까지 완전히 동일
  - 위치: `codebase/packages/masked-markers/package.json`(신규) / 등록 표면:
    `.claude/test-stages.sh:33`, `.github/workflows/packages-checks.yml:49,68,83`,
    `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`,
    `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `codebase/backend/package.json:58`,
    `codebase/frontend/package.json:40`
  - 상세: `dependencies` 필드가 없고 `devDependencies`만 있다(`@eslint/js`/`eslint`
    `^9.18.0`, `typescript` `^5.7.3`, `typescript-eslint` `^8.65.0`, `jest`/`@types/jest`
    `^30.0.0`, `ts-jest` `^29.2.5`, `globals` `^17.9.0`). `codebase/packages/ai-end-reason/package.json`
    과 직접 `Read` 대조한 결과 devDependencies 블록이 문자 그대로 동일하다 — 새로 도입되는
    외부 패키지·버전이 없다. backend/frontend `package.json` 양쪽 모두
    `"@workflow/masked-markers": "workspace:*"` 가 `dependencies`(런타임 import 실태와 일치)에
    정확히 배치돼 있고, `pnpm-lock.yaml`(`codebase/packages/masked-markers:` 신규 섹션 +
    workspace link 2곳, `git diff origin/main...HEAD -- pnpm-lock.yaml` 로 재확인)도 8곳
    등록과 정합한다.
  - 제안: 조치 불요.

- **[INFO]** 신규 backend repo-guard(`masked-marker-mirror-guard.ts`)가 `typescript` 컴파일러
  API 를 import 하지만, 이미 backend devDependencies 에 존재하는 패키지이고 프로덕션 번들에는
  새지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (`import * as ts from 'typescript';`), `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` (`import ts from "typescript";`)
  - 상세: 두 패키지 `package.json` 을 직접 `Read` 로 확인 — backend `:130`, frontend `:94`
    양쪽 다 `typescript` 가 이미 devDependency 로 존재해 신규 의존성이 아니다. `src/repo-guards/**`
    는 빌드 산출물에서 제외되는 test-only 경로이므로(직전 라운드 RESOLUTION `11_27_29` WARNING1
    에서 `production-build-devdep` 가드로 확인됨) 런타임/프로덕션 번들 크기에 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** `pnpm-lock.yaml`에 이 PR과 무관한 `eslint-config-next` peer-dependency variant
  재해석이 섞여 있음 (5라운드 연속 동일 결론, 이번 라운드도 실측 재확인)
  - 위치: `pnpm-lock.yaml` — `eslint-config-next@16.3.0(...)`/`eslint-import-resolver-typescript@3.10.1(...)`/`eslint-plugin-import@2.32.0(...)`/`eslint-module-utils@2.14.0(...)` snapshot 키의 괄호 체인(variant 서명) 재구성
  - 상세: `git diff origin/main...HEAD -- pnpm-lock.yaml`로 버전 문자열 자체를 대조 —
    `eslint-import-resolver-typescript@3.10.1`, `eslint-plugin-import@2.32.0`,
    `eslint-module-utils@2.14.0` 모두 **버전 불변**이고 peer-dep variant 서명(괄호 안 해시성
    체인)만 재구성됐다. 신규 workspace 패키지 추가로 pnpm 이 peer 해석 트리를 재계산한 부수
    효과이며, 라이선스·취약점·번들 크기에 영향 없다. 4개 선행 라운드가 모두 동일하게
    식별·불요 판정했다.
  - 제안: 조치 불요.

- **[INFO]** `license` 필드가 신규 package.json에 없음 — 저장소 전역 관행과 일치(신규 결함
  아님, 선행 라운드와 동일 판정)
  - 위치: `codebase/packages/masked-markers/package.json`
  - 상세: 형제 패키지(`ai-end-reason` 등) 모두 `license` 필드가 없다(private monorepo, OSS
    배포 대상 아님).
  - 제안: 조치 불요.

## 이번 라운드에서 새로 발생한 diff(라운드7 → 라운드8) 검토

라운드7(`13_55_59`) 이후 RESOLUTION 이력(`13_55_59/RESOLUTION.md`)을 보면 남은 수정은 전부
JSDoc 줄바꿈/blockquote 정리 등 `masked-marker-mirror.spec.ts`/`.test.ts` 파일 내 **주석 텍스트**
교정이며, `package.json`/`pnpm-lock.yaml`/Dockerfile/CI workflow 등 의존성 표면을 건드리는
편집은 없었다. 즉 이번 8라운드 프롬프트에 새로 등장한 대부분의 파일(96건 이상)은 라운드
1~7의 review/consistency 산출물 자체(`review/code/2026/08/21/{11_27_29,11_53_49,12_25_15,
13_14_29,13_34_34,13_55_59}/**`, `review/consistency/2026/08/21/{10_45_52,10_58_25}/**`)이며
의존성 관점에서 전부 중립(코드가 아니라 markdown/json 리뷰 기록)이다.

## 요약

이번 diff가 도입하는 유일한 새 의존성은 순수 내부 워크스페이스 패키지
`@workflow/masked-markers`이며, 런타임 외부(비-workspace) npm 패키지는 하나도 추가되지
않았다. devDependencies는 선례 `@workflow/ai-end-reason`과 버전까지 완전히 동일해 버전 고정
정책·라이선스·취약점 관점에서 새로 검토할 표면이 없다. 신규 backend/frontend repo-guard가
import 하는 `typescript` 도 이미 두 스택 모두의 기존 devDependency이며 test-only 경로라
번들에 영향이 없다. `pnpm-lock.yaml`의 `eslint-config-next` 계열 peer-dep 재해석은 버전
불변의 부수 효과로 5개 선행 라운드와 동일하게 무해함을 재확인했다. 순환 의존 없음(단방향:
backend/frontend → masked-markers), 번들/빌드 시간 영향은 무시 가능한 수준. 8라운드에 걸친
전체 리뷰 이력에서 **추출된 값 자체와 그 등록 표면**에 대한 의존성 지적은 단 한 번도 없었다
— 모든 발견은 재발 방지 가드(코드 로직)의 대칭성·문서 정확성이었지 의존성 표면이 아니었다.
의존성 관점에서 차단 사유는 없다.

## 위험도
NONE
