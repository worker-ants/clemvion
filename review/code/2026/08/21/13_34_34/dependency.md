# 의존성(Dependency) Review — masked-marker-contract-7d2e14

## 검토 방법

신규 워크스페이스 패키지 `@workflow/masked-markers` 도입 관련 8개 배선 파일(등록 표면) +
패키지 본체(`package.json`/`tsconfig.json`/`eslint.config.mjs`/`src/index.ts`) + 소비처 재export
2곳 + 신규 repo-guard 4개 + `pnpm-lock.yaml` 을 대상으로, 실제 저장소를 열어 형제 패키지
(`@workflow/ai-end-reason`, `@workflow/node-summary`)와 devDependency 버전·스크립트를 diff 대조했다.

## 발견사항

- **[INFO]** 신규 devDependency 셋은 문자 그대로 형제 패키지와 동일 — 실질적으로 "새 의존성"이 없다
  - 위치: `codebase/packages/masked-markers/package.json:13-22` (`devDependencies`)
  - 상세: `@eslint/js@^9.18.0` · `@types/jest@^30.0.0` · `eslint@^9.18.0` · `globals@^17.9.0` ·
    `jest@^30.0.0` · `ts-jest@^29.2.5` · `typescript@^5.7.3` · `typescript-eslint@^8.65.0` 8개
    모두 `codebase/packages/ai-end-reason/package.json`, `codebase/packages/node-summary/package.json`
    과 **바이트 단위로 동일한 specifier**다. `pnpm-lock.yaml` 에서도 세 패키지가 정확히 같은
    해석 버전(`eslint@9.39.4`, `jest@30.4.2`, `typescript@5.9.3`, `typescript-eslint@8.67.0` 등)으로
    묶여 있음을 확인했다 — pnpm 이 새 버전을 추가로 끌어오지 않았다. `main`/`devDependencies`
    스크립트(`build`/`prepare`/`test`/`lint`) 셋도 형제 패키지와 동일 패턴(`prepare` 인라인 JS 포함)이라
    기존 관행을 그대로 답습했다. 라이선스(전부 기존에 이미 승인된 OSS: MIT/Apache-2.0 계열)·취약점
    표면도 기존 대비 증가분이 없다.
  - 제안: 조치 불필요. 다만 "새 패키지 추가 = 새 의존성 그래프 확장" 이 아니라는 점을 리뷰 시
    참고할 것 — 이번 PR 은 순수 내부 재조직(추출)이다.

- **[INFO]** 신규 backend/frontend repo-guard 가 `typescript` 컴파일러 API 를 import 하지만 신규 의존성 아님 + 프로덕션 번들 격리 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (`import * as ts from 'typescript';`), `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` (`import ts from "typescript";`)
  - 상세: 두 파일 모두 이미 각 스택의 기존 devDependency(backend `package.json:130` `"typescript": "^5.7.3"`, frontend `package.json:94` `"typescript": "^5"`)를 재사용할 뿐 새 패키지를 추가하지 않는다. 프로덕션 번들 유입 우려에 대해서는 `codebase/backend/tsconfig.build.json:16` 이 `"src/repo-guards/**"` 를 명시적으로 제외하고 있음을 직접 확인했다 — RESOLUTION.md(11_27_29)가 주장한 "빌드 스테이지에서 제외" 가 실제 tsconfig 로 뒷받침된다.
  - 제안: 조치 불필요. 확인 기록 목적.

- **[INFO]** `pnpm-lock.yaml` 에 이 PR 목표(마커 SoT 추출)와 무관한 `eslint-config-next` peer-dependency 스냅샷 키 재구성이 섞여 있음 — 실제 버전 변경 없음, 다른 리뷰어(scope/side_effect)도 독립적으로 포착
  - 위치: `pnpm-lock.yaml` — `eslint-config-next@16.3.0(...)`, `eslint-import-resolver-typescript@3.10.1(...)`, `eslint-module-utils@2.14.0(...)`, `eslint-plugin-import@2.32.0(...)` 각 항목의 peer 조합 키(게이트 없는 순수 재구성 hunk — 정확한 파일 줄 번호 대신 패키지명으로 기재)
  - 상세: `git diff origin/main -- pnpm-lock.yaml` 로 직접 대조한 결과 위 4개 패키지의 **버전 번호 자체는 전부 불변**(`2.32.0`/`3.10.1`/`2.14.0`/`16.3.0`)이고, `@typescript-eslint/parser` 를 포함하던 한 peer 조합 변형이 통째로 사라지면서 남은 조합의 괄호 체인만 재구성됐다(순삭제 42줄). `@workflow/masked-markers` 를 새 workspace 패키지로 등록하며 `pnpm install --frozen-lockfile` 이 아닌 재계산이 일어난 부수 효과로 보이며, 기능적 위험(버전 상향/하향, 신규 CVE 표면)은 없다. `deps-security-checks.yml` 은 `paths:` 필터가 없어 이 PR 에서도 `pnpm audit`/override-floor 가드가 정상 실행되므로 이 재구성이 감시망을 벗어나지도 않는다.
  - 제안: 조치 불필요 — pnpm 재해석의 정상 노이즈. 리뷰 시 "masked-markers 관련분"과 "무관한 재정렬분"을 구분해 확인.

- **[INFO]** 내부 의존성 등록 8곳(CI 배선) 전부 상호 정합 — 개별 파일 대조 확인
  - 위치: `.claude/test-stages.sh:33`(`INTERNAL_PACKAGES`), `.github/workflows/packages-checks.yml:49,68,83`(pathspec·주석 카운트 5→6·matrix), `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`, `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `codebase/backend/package.json:58`(`dependencies`), `codebase/frontend/package.json:40`(`dependencies`)
  - 상세: `@workflow/masked-markers` 는 두 소비 스택(backend `sanitize-error-message.ts`, frontend `masked-markers.ts`) 모두 프로덕션 코드에서 import 하므로 `devDependencies` 가 아니라 `dependencies` 섹션에 정확히 위치했다(둘 다 확인). `workspace:*` 로 고정돼 있어 버전 부동(floating) 문제가 없다 — 모노레포 워크스페이스 표준 관례. Docker COPY·`test-stages.sh`·CI matrix 모두 형제 패키지(`ai-end-reason`)와 동일한 8곳 패턴을 정확히 재현했고 누락이 없다.
  - 제안: 조치 불필요.

## 요약

이 PR 은 의존성 관점에서 매우 깨끗하다. 신규 워크스페이스 패키지 `@workflow/masked-markers` 는
등록 표면 8곳(CI/Docker/package.json) 전부가 형제 패키지(`ai-end-reason`, `node-summary`)와
1:1 대응하는 기계적 배선이며, 유일한 신규 "의존성"은 내부 워크스페이스 패키지 자체로 `workspace:*`
고정을 쓴다. 패키지의 devDependency 8종은 형제 패키지와 버전 specifier·해석 버전이 완전히
동일해 그래프에 실질적으로 새로 추가되는 외부 패키지가 없고, 라이선스·취약점 노출 증가분도 없다.
신규 repo-guard 2벌이 쓰는 `typescript` 컴파일러 API 는 각 스택의 기존 devDependency 를 재사용하며
프로덕션 빌드에서 명시적으로 제외돼 번들 크기에 영향이 없음을 tsconfig 로 직접 확인했다. 유일하게
눈에 띈 것은 `pnpm-lock.yaml` 안의 `eslint-config-next` peer-dependency 스냅샷 키 재구성인데,
실측 결과 버전 변경은 전혀 없는 pnpm 재해석 노이즈이고 저장소의 무조건 실행 audit 워크플로
(`deps-security-checks.yml`)가 이를 그대로 감시한다. 차단 사유는 없다.

## 위험도
NONE
