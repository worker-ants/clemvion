# Security Review — node-linker=hoisted → isolated 전환 (plan §3)

- 대상 diff: `origin/main..HEAD` (commit `19252b21e`)
- 범위: `.npmrc`, `codebase/backend/package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`(주석만), `codebase/backend/Dockerfile`(주석만),
  `codebase/frontend/{Dockerfile,next.config.ts}`(주석만), `docker-compose.e2e.yml`(주석만),
  `plan/in-progress/pnpm-migration-followups.md`

## 검증 방법

- `git diff origin/main..HEAD` 전 파일 라인 단위 검토.
- `python3 scripts/check-pnpm-security-config.py` 로컬 실행 — baseline(overrides/onlyBuiltDependencies/
  ignoreCves) 대조.
- `pnpm-lock.yaml` 에서 `express`/`ip-address`/`dotenv`/`@jest/globals` 의 해소 버전과, 이들이
  이 diff 이전(`origin/main`)에도 이미 전이 의존으로 존재했는지 대조.
- 4개 신규 direct dep 의 `package.json` scripts(`preinstall`/`install`/`postinstall`) 존재 여부 확인
  (lifecycle build script 신규 실행 가능성).
- `pnpm-workspace.yaml` 의 `overrides` 19건을 origin/main과 라인 단위 diff (byte-identical 확인).
- backend 소스에서 `express`/`ip-address`/`dotenv` 실제 import 지점 확인 (auth-config IP/CIDR
  validator, auth 컨트롤러, ops 스크립트).

## 발견사항

이 diff 로 인한 신규 보안 리스크는 발견되지 않았다. 아래는 검증 근거를 기록한 INFO 항목이다.

- **[INFO]** phantom dependency → direct dependency 승격은 버전 변경 없이 선언만 명시화됨
  - 위치: `codebase/backend/package.json:66-93`, `pnpm-lock.yaml:143-233`
  - 상세: `express@5.2.1`, `ip-address@10.2.0`, `dotenv@17.4.1`(devDeps 경로는 `dotenv-expand`/`typeorm`
    이 별도로 `16.6.1` 도 사용, 기존과 동일), `@jest/globals@30.4.1` 모두 `origin/main` lockfile 에도
    **동일 버전**으로 이미 존재했다(`git show origin/main:pnpm-lock.yaml`로 대조). 즉 이번 변경은 해소
    그래프에 새 패키지·새 버전을 추가하지 않고, hoisting 우연에 의존하던 기존 전이 해소를
    manifest 상에서 명시적 direct edge 로 승격한 것뿐이다. 공급망 표면(패키지 집합·버전) 변화 없음.
  - `ip-address`(auth-config IP/CIDR whitelist 검증, `codebase/backend/src/modules/auth-configs/`)와
    `express`(auth 컨트롤러·body-parser 등 다수 지점)는 이미 런타임에서 실사용 중이던 phantom
    dependency였고, plan 문서(`plan/in-progress/pnpm-migration-followups.md:104`)에 기록된 대로 격리
    linker 전환 중 `MODULE_NOT_FOUND`(auth.controller 부팅 실패)로 실제 드러나 이번에 고쳐졌다 — 즉
    이전 hoisted 배치에서는 "우연히 동작"했던 미선언 런타임 의존이 isolated 로 fail-fast 드러났고,
    이 diff가 그 잠재적 가용성/공급망 위생 리스크(hoist 순서가 바뀌면 조용히 깨지거나 의도치 않은
    버전이 해소될 수 있는 리스크)를 제거하는 방향. 보안 관점에서 순수 개선.

- **[INFO]** 신규 direct dep 4개 모두 lifecycle build script 없음 — `onlyBuiltDependencies` allow-list 무영향
  - 위치: `codebase/backend/package.json:66,67,71,95`
  - 상세: `express`/`dotenv`/`ip-address` 의 `package.json.scripts` 를 실행 시점에 직접 조회한 결과
    `preinstall`/`install`/`postinstall` 이 전혀 없다(lint/test/build(devtime) 스크립트만 존재하며 이는
    pnpm이 설치 시 실행하는 lifecycle 훅이 아니다). `@jest/globals` 도 동일. 즉 이번 전환으로
    "Ignored build scripts" 대상 집합이 늘지 않고, `pnpm-workspace.yaml` 의
    `onlyBuiltDependencies`(`isolated-vm`/`bcrypt`/`esbuild`/`@swc/core`/`@tailwindcss/oxide`)도
    diff 로 미변경 — allow-list 우회로 임의 install script 가 새로 실행되는 경로 없음.

- **[INFO]** 보안 설정 CI 가드(overrides/onlyBuiltDependencies/ignoreCves) baseline 무결
  - 위치: `pnpm-workspace.yaml`(diff는 주석만, 값 라인 미변경), `scripts/check-pnpm-security-config.py`
  - 상세: `python3 scripts/check-pnpm-security-config.py` 로컬 실행 결과
    `OK: overrides 19건(값 포함) · onlyBuiltDependencies 5건 · ignoreCves 1건 baseline 일치`.
    `overrides` 19개 키의 lockfile 해소 라인(`^  <pkg>@...:`)을 `origin/main` 대비 diff한 결과도
    byte-identical — CVE 상향 핀이 이번 lockfile 재생성으로 조용히 삭제·약화되지 않았음을 직접 확인.
    `ip-address` override(`^10.2.0`)는 `express-rate-limit@8.5.2(express@5.2.1)` 의존 그래프에서도
    동일하게 `10.2.0` 으로 해소되어(핀 적용 유지) backend의 신규 direct `ip-address` 선언과도 일치.
  - lockfile diff 중 유일한 override 관련 미세 변동은 `picomatch@4.0.4 → 4.0.5`(jest-util 의존
    edge, `@jest/globals` 신규 추가에 따른 재해소 부산물) — override 범위 `^4.0.4` 내의 patch
    상향이라 핀 약화 아님(오히려 최신). `eslint-plugin-import` peer 문자열 표기 변경도 동일 버전의
    resolution key 재작성일 뿐 실제 패키지 버전 변화 없음.

- **[INFO]** 프로덕션 이미지 attack surface — isolated 전환이 강화 방향
  - 위치: `codebase/backend/Dockerfile`(주석만 변경, RUN/COPY 명령 불변), `.npmrc:10`
  - 상세: backend runner 는 이미 injected `pnpm deploy --prod`(기존 PR에서 도입)로 self-contained
    번들만 COPY한다. `git diff` 로 Dockerfile의 실제 명령 라인(주석 제외)을 대조한 결과 변경 0 —
    이번 diff는 그 위에서 동작하는 링커 레이아웃만 hoisted(flat)→isolated(symlink farm)로 바꿨다.
    `@jest/globals` 는 devDependencies 에 정확히 위치해(`codebase/backend/package.json:95`)
    `pnpm deploy --prod` 산출물에서 배제되며, 이는 확인된 e2e/그린 결과(254 passed, backend
    이미지 hygiene smoke 포함)로 이미 검증됨 — 재플래그하지 않음. isolated 자체는 각 패키지가
    자신이 선언한 의존만 resolve 가능해, 향후 미선언 의존 유입(예: 취약 패키지를 몰래 import 해도
    선언 안 하면 빌드/런타임에서 즉시 fail)을 구조적으로 차단하는 방향이라 공급망 위생 관점에서
    hoisted 대비 약화가 아닌 강화.

- **[INFO]** `.npmrc` 외 설정 변경 없음 — `ignore-scripts`/`store-dir`/registry 등 민감 설정 손대지 않음
  - 위치: `.npmrc:1-12`
  - 상세: 변경은 `node-linker=hoisted` → `node-linker=isolated` 한 줄 + 주석. `engine-strict=false`
    등 나머지 설정 불변. 시크릿·자격증명·레지스트리 URL 관련 라인 없음.

## 요약

이 diff는 pnpm `node-linker` 를 hoisted(flat)에서 isolated(pnpm 기본 symlink virtual store)로 전환하고,
그 과정에서 드러난 backend의 4개 미선언 phantom dependency(express/ip-address/dotenv/@jest/globals)를
직접 의존으로 명시화한 순수 빌드-레이어 변경이다. 4개 패키지 모두 이 diff 이전 lockfile에도 동일 버전으로
이미 해소되어 있었음을 직접 대조로 확인했고(신규 패키지·신규 버전 0), 넷 다 npm lifecycle install script를
갖지 않아 `onlyBuiltDependencies` allow-list 우회 경로도 없다. `pnpm-workspace.yaml`의 보안 핀(overrides
19건·onlyBuiltDependencies 5건·ignoreCves 1건)은 로컬 가드 스크립트(`check-pnpm-security-config.py`)와
lockfile 라인 대조 양쪽으로 무결함을 확인했으며, `ip-address` override(`^10.2.0`, auth-config IP/CIDR
검증 경로에서도 사용)도 그대로 유지·적용되고 있다. Dockerfile/compose/next.config 변경은 전부 주석
갱신(hoisted→isolated 서술 정합화)이고 실제 빌드 명령·COPY 대상은 diff 상 불변이다. 오히려 isolated
linker는 phantom dependency를 구조적으로 fail-fast 시켜 향후 미선언 의존(잠재적으로 취약하거나 의도치
않은 버전)의 은닉 유입을 막는 방향이라, 이번 전환은 공급망 위생 관점에서 순보안 이득으로 평가한다.
Critical/Warning 급 발견사항 없음.

## 위험도

NONE
