# 의존성(Dependency) Review — masked-marker-contract-7d2e14 (14_39_29)

## 사전 확인

`git log 7cc64fa35..HEAD -- '.claude/test-stages.sh' '.github/workflows/*.yml' 'codebase/*/Dockerfile*' 'codebase/*/package.json' 'codebase/packages/masked-markers/**' 'pnpm-lock.yaml'` 로 실측한 결과, 의존성 표면(등록 8곳 + lockfile + 신규 패키지 manifest)은 라운드2 커밋(`1f63bbbef`) 이후 **한 번도 재변경되지 않았다**. 이번 라운드(3~8, `811a40f48`~`85197720e`)는 전부 가드 로직·문서·spec 텍스트만 건드렸다. 따라서 아래는 직전 두 라운드(`11_27_29`, `11_53_49`)의 dependency.md 판정을 이번 HEAD 기준으로 직접 재실측(`git diff origin/main...HEAD`, 파일 바이트 대조)해 재확인한 결과이며, 새로 발견된 것은 없다.

## 발견사항

- **[INFO]** 신규 내부 워크스페이스 패키지 `@workflow/masked-markers` — 외부 패키지 신규 도입 없음, 선례와 완전 동일
  - 위치: `codebase/packages/masked-markers/package.json` (신규) / 등록 표면: `.claude/test-stages.sh:33`, `.github/workflows/packages-checks.yml:49,68,83`, `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`, `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`
  - 상세: `diff codebase/packages/{ai-end-reason,masked-markers}/package.json` 를 직접 대조해 `name`/`description`/`version`(`0.1.0`, 신규라 정상) 세 필드만 다르고 나머지(`devDependencies` 버전 범위 8개, `scripts`, `engines`, `jest` 설정)는 바이트 단위로 동일함을 확인했다. `dependencies` 필드가 아예 없어 런타임 의존은 zero(순수 값 도메인 패키지) — 새 외부 라이브러리 버전이 하나도 유입되지 않는다. backend/frontend `package.json` 양쪽 모두 `"@workflow/masked-markers": "workspace:*"` 를 `dependencies`(devDependencies 아님) 섹션에 배치해 런타임 import 실태와 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 신규 미러 소멸 가드(`masked-marker-mirror-guard.ts`, backend/frontend 각 1개)가 `typescript` 컴파일러 API 를 import — 신규 프로덕션 의존 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:24` (`import * as ts from 'typescript'`), `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:14` (`import ts from "typescript"`)
  - 상세: `grep '"typescript"' codebase/{backend,frontend}/package.json` 로 확인한 결과 둘 다 기존 devDependency(`^5.7.3`/`^5`)를 재사용할 뿐 신규 도입이 아니다. 두 파일 모두 `__tests__`/`repo-guards` 경로라 프로덕션 빌드에서 제외되고(`RESOLUTION.md` `11_27_29` 가 `production-build-devdep` 가드 36/36 GREEN 으로 실측 확인), 정규식 대신 TS AST 파서를 쓰는 선택은 이 조직의 정적 가드 가이드라인(정본 파서가 있는 대상은 파서 우선)에 부합한다. 번들·런타임 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `pnpm-lock.yaml` 의 `eslint-config-next` peer-dependency variant 재해석은 이 PR 목표와 무관하지만 버전 변경 없음
  - 위치: `pnpm-lock.yaml` — importers 블록(frontend `eslint-config-next` 항목에서 `@typescript-eslint/parser@8.67.0(...)` peer 축 소멸) 및 `snapshots:` 섹션 4개 항목(`eslint-config-next@16.3.0`/`eslint-import-resolver-typescript`/`eslint-module-utils`/`eslint-plugin-import`)이 두 variant 에서 한 variant 로 dedup 됨
  - 상세: `git diff origin/main...HEAD -- pnpm-lock.yaml` 로 직접 재확인 — 패키지 버전(`16.3.0`, `3.10.1`, `2.14.0`, `2.32.0`)은 전부 불변이고 괄호 안 peer-resolution 서명만 재구성됐다. `codebase/packages/masked-markers` 워크스페이스가 추가되며 `pnpm install` 이 전역 peer 그래프를 재계산한 부수 효과다. 취약점·라이선스·기능적 버전 변경 없음.
  - 제안: 조치 불요(이미 라운드1·2에서 동일 판정, 재검토로도 동일 결론).

- **[INFO]** `.github/workflows/frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**` 추가 — 의존성이 아니라 CI 트리거 범위 확장이지만 부수 영향 없음 확인
  - 위치: `.github/workflows/frontend-checks.yml:48`
  - 상세: 이 job 이 설치하는 워크스페이스 범위(`pnpm install --filter`) 자체는 바뀌지 않고, 단지 이 job 을 **언제 실행할지**의 pathspec 트리거만 넓어졌다. 새 외부 의존성 설치나 빌드 시간 증가 요인이 아니며, 마커 미러 소멸 가드가 저장소 전체(`codebase/*/src`)를 스캔하는 job 이 web-chat 전용 PR 에서도 반드시 실행되게 하려는 의도(라운드2 WARNING 처분)로 dependency 표면과는 무관한 CI 스코프 조정이다.
  - 제안: 조치 불요.

## 요약

의존성 관점에서 실질 변경은 "손으로 복제된 마커 상수·판정 로직을 신규 내부 워크스페이스 패키지 `@workflow/masked-markers` 로 추출"한 것 하나다. 재실측 결과 (1) 새로 도입되는 **외부(비-workspace) npm 패키지는 0개**이며 신규 패키지의 `devDependencies` 8개는 선례 `@workflow/ai-end-reason` 과 버전까지 바이트 단위로 동일하다, (2) `workspace:*` 고정 + 등록 표면 8곳(test-stages.sh·CI matrix/pathspec·Dockerfile 3곳·package.json 2곳·lockfile)이 전부 정합되고 동적 스캔 가드(`check-e2e-playwright-config.py`)가 향후 드리프트를 자동 포착한다, (3) 패키지 자체가 런타임 의존 zero 인 순수 값 도메인이라 번들 크기·빌드 시간 영향은 무시할 수준이고 의존 방향은 단방향(backend/frontend → masked-markers, 순환 없음)이다, (4) `pnpm-lock.yaml` 의 `eslint-config-next` peer 재해석·`frontend-checks.yml` pathspec 확장은 둘 다 이 PR 목표와 직접 관련은 없지만 버전 불변·기능 영향 없음을 직접 diff 로 재확인했다. 라이선스 비호환·알려진 취약점·버전 미고정·불필요한 의존성 도입 중 어느 것도 발견되지 않았고, 8라운드에 걸친 반복 리뷰에서도 이 표면은 라운드2 이후 재변경되지 않아 안정적이다.

## 위험도
NONE
