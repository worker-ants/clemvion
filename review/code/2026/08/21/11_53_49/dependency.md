# 의존성(Dependency) 리뷰 — masked-marker-shared-package

## 발견사항

- **[INFO]** 새 내부 워크스페이스 패키지 `@workflow/masked-markers` 추가 — 정당하고 선례를 정확히 따름
  - 위치: `codebase/packages/masked-markers/package.json` 전체(신규 파일) / 등록 표면: `.claude/test-stages.sh:33`, `.github/workflows/packages-checks.yml:49,68,83`, `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`, `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`
  - 상세: `sanitize-error-message.ts`(backend)와 `lib/utils/masked-markers.ts`(frontend)에 손으로 복제돼 있던 마커 상수·판정 로직·깊이 상한을 신규 패키지로 추출했다. `codebase/packages/masked-markers/package.json` 을 기존 `codebase/packages/ai-end-reason/package.json` 과 바이트 단위로 대조한 결과 `devDependencies` 버전 범위(`eslint`/`@eslint/js` `^9.18.0`, `typescript` `^5.7.3`, `typescript-eslint` `^8.65.0`, `jest`/`@types/jest` `^30.0.0`, `ts-jest` `^29.2.5`, `globals` `^17.9.0`)·`scripts`·`jest` 설정이 완전히 동일하다 — **새로 도입되는 외부 패키지·버전은 없다**(전부 monorepo 전역에서 이미 쓰이는 버전). `dependencies` 필드는 비어 있고(devDependencies 만) 런타임 의존은 zero — 순수 값 도메인 패키지다. backend/frontend `package.json` 양쪽 모두 `dependencies`(devDependencies 아님) 섹션에 `"@workflow/masked-markers": "workspace:*"` 로 정확히 배치돼 있음을 직접 확인했다(런타임 import 이므로 올바른 섹션).
  - 등록 표면 완결성: `test-stages.sh` `INTERNAL_PACKAGES`, `packages-checks.yml` matrix(`pkg:` 목록 + "6개를 전부 등록" 주석 갱신 + pathspec), backend/frontend 양쪽 `Dockerfile`(manifest COPY + source COPY), `Dockerfile.playwright-e2e`, 두 `package.json`, `pnpm-lock.yaml` — 8곳 전부 정합되게 갱신됐다. `scripts/check-e2e-playwright-config.py` 가 `codebase/packages/*/package.json` 을 파일시스템에서 동적으로 스캔해 Dockerfile COPY 목록과 대조하므로(하드코딩 목록 아님), 이 신규 패키지도 자동으로 그 가드 대상에 편입된다 — 직접 확인.
  - 제안: 조치 불요. 등록이 완전하고 선례(`@workflow/ai-end-reason`)와 구조적으로 동일하다.

- **[INFO]** `pnpm-lock.yaml` 에 이 PR 과 무관한 `eslint-config-next` peer 의존성 재해석(dedup)이 섞여 들어감
  - 위치: `pnpm-lock.yaml` — importers 블록의 frontend `eslint-config-next` 항목(버전 문자열에서 `@typescript-eslint/parser@8.67.0(...)` peer 축이 사라짐) 및 `snapshots:` 섹션의 `eslint-config-next@16.3.0(...)` / `eslint-import-resolver-typescript@...` / `eslint-module-utils@...` / `eslint-plugin-import@...` 네 항목이 두 개의 중복 peer-resolution variant 에서 하나로 합쳐짐(신규 패키지 추가로 lockfile 이 재계산되며 생긴 부수 효과, `git diff 4287cdd5b..HEAD -- pnpm-lock.yaml` 로 직접 실측)
  - 상세: 패키지 버전 자체(`eslint-config-next@16.3.0`)는 변경되지 않았고, pnpm 이 워크스페이스에 새 패키지가 추가되면서 peer-dependency variant 트리를 다시 계산해 이전엔 두 갈래로 나뉘어 있던 동일 결과 resolution 을 하나로 dedup 한 것 — 기능적 변경이 아니라 lockfile 표현의 정리다. 이미 직전 리뷰 라운드(`review/code/2026/08/21/11_27_29/RESOLUTION.md` "미조치 INFO" 목록)에서 "pnpm-lock 의 무관한 eslint-config-next peer 재해석"으로 동일하게 식별·불요 판정된 항목이며, 이번 재검토에서도 동일 결론에 도달했다(라이선스·취약점·번들 크기 영향 없음, MIT 계열 dev-tooling).
  - 제안: 조치 불요.

- **[INFO]** 신규 미러 소멸 가드가 `typescript` 패키지를 컴파일러 API 용도로 import — 신규 프로덕션 의존 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:16`, `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:9`
  - 상세: 둘 다 이미 backend/frontend `package.json` 의 `devDependencies` 에 존재하는 `typescript` 를 그대로 재사용한다(신규 도입 아님). 두 파일 모두 `__tests__`/`repo-guards` 경로 아래에 있어 프로덕션 빌드에서 제외되며, 직전 라운드 RESOLUTION 이 `production-build-devdep` 가드(36/36 GREEN)로 이를 실측 검증해 뒀다. 번들 크기·런타임 영향 없음.
  - 제안: 조치 불요.

## 요약

이번 변경의 핵심은 backend/frontend 양쪽에 손으로 복제돼 있던 마스킹 마커 상수·판정 로직을 신규 내부 워크스페이스 패키지 `@workflow/masked-markers` 로 추출한 것이다. 의존성 관점에서 리스크가 될 만한 지점은 모두 확인했다 — (1) 이 PR 이 도입하는 **외부(비-workspace) npm 패키지는 하나도 없다**, 신규 패키지의 `devDependencies` 는 선례 `@workflow/ai-end-reason` 과 버전까지 완전히 동일하다(사본 확인). (2) `workspace:*` + 8개 등록 표면(test-stages.sh·CI matrix·Dockerfile ×3·package.json ×2·lockfile) 이 전부 정합되고, 동적 스캔 기반 config-guard(`check-e2e-playwright-config.py`) 가 이를 자동으로 강제한다. (3) backend/frontend 양쪽 `package.json` 배치(`dependencies`, devDependencies 아님)가 런타임 import 실태와 일치한다. (4) 패키지 자체는 런타임 의존이 zero 인 순수 값 도메인이라 번들/빌드 시간 영향이 무시할 수준이고 순환 의존도 없다(단방향: backend/frontend → masked-markers). (5) `pnpm-lock.yaml` 안의 `eslint-config-next` peer 재해석은 이 PR 과 무관한 lockfile 재계산 부수효과이며 이미 직전 리뷰 라운드에서 조치 불요로 판정된 항목과 동일하다. 라이선스·알려진 취약점·버전 고정 정책 위반 등 차단 사유는 발견되지 않았다.

## 위험도
NONE
