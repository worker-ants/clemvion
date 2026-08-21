# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 신규 내부 workspace 패키지 `@workflow/masked-markers` 도입 — 외부 신규 의존성 0개, 선례와 완전히 동일한 템플릿
  - 위치: `codebase/packages/masked-markers/package.json` (신규 파일)
  - 상세: backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts` 에 손으로 복제돼 있던 마커 상수·판정 로직·깊이 상한을 신규 workspace 패키지로 추출했다. `codebase/packages/masked-markers/package.json` 을 형제 패키지 `codebase/packages/ai-end-reason/package.json`, `codebase/packages/node-summary/package.json` 과 직접 비교(diff)한 결과 `name`/`description` 을 제외한 `scripts`·`devDependencies`(`@eslint/js` `^9.18.0`, `@types/jest` `^30.0.0`, `eslint` `^9.18.0`, `globals` `^17.9.0`, `jest` `^30.0.0`, `ts-jest` `^29.2.5`, `typescript` `^5.7.3`, `typescript-eslint` `^8.65.0`)·`engines`·`jest` 설정 블록이 바이트 단위로 동일하다. `dependencies` 필드는 없음(런타임 의존 zero, 순수 값 상수 패키지). `pnpm-lock.yaml` 확인 결과 이 devDependencies 들은 모두 기존 lockfile 에 이미 존재하던 것과 동일한 resolved 버전(`eslint 9.39.4`, `jest 30.4.2`, `typescript 5.9.3`, `ts-jest 29.4.11(...)`, `typescript-eslint 8.67.0(...)`, `globals 17.9.0`)으로 dedup 돼 새 버전 계열이 추가되지 않았다. 새 외부 npm 패키지는 0개.
  - 제안: 없음(승인 가능).

- **[INFO]** 버전 배치 정합성 — `dependencies` vs `devDependencies` 올바름
  - 위치: `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`
  - 상세: 양쪽 모두 `"@workflow/masked-markers": "workspace:*"` 가 `dependencies` 섹션(28번째 줄 블록, backend / 17번째 줄 블록, frontend)에 위치한다 — 런타임 import(`sanitize-error-message.ts`, `lib/utils/masked-markers.ts`)와 실제로 일치한다. `devDependencies` 오배치가 아니다.
  - 제안: 없음.

- **[INFO]** 라이선스 — 신규 외부 의존성이 없어 확인 대상 자체가 없음
  - 위치: `codebase/packages/masked-markers/package.json` (license 필드 부재)
  - 상세: `license` 필드 부재도 형제 내부 패키지(`ai-end-reason`, `node-summary` 등) 전부와 동일한 기존 관례(모노레포 private workspace 패키지)이고, 이번 PR 이 새로 만든 편차가 아니다. 신규 devDependencies 는 이미 저장소 전역에서 쓰이던 MIT/Apache-2.0 계열 dev-tooling(eslint, jest, typescript 등)의 재사용뿐이다.
  - 제안: 없음.

- **[INFO]** 취약점 — 신규 다운로드/노출 표면 없음
  - 위치: `pnpm-lock.yaml` (`importers.codebase/packages/masked-markers` 블록)
  - 상세: lockfile 에 새로 생긴 것은 workspace link 노드 하나와 그 devDependencies 참조뿐이며, 전부 기존 다른 workspace 패키지가 이미 동일 버전으로 쓰는 것이라 신규 CVE 노출 표면이 생기지 않는다.
  - 제안: 없음.

- **[INFO]** 호환성 — `pnpm-lock.yaml` 에 이 PR 과 무관한 `eslint-config-next` peer 재해석(dedup) 잔존, 직전 두 라운드에서 이미 조치 불요 판정됨
  - 위치: `pnpm-lock.yaml` (`eslint-config-next@16.3.0(...)`, `eslint-import-resolver-typescript@...`, `eslint-module-utils@...`, `eslint-plugin-import@...` 항목들의 peer 키 문자열)
  - 상세: `@typescript-eslint/parser@8.67.0(...)` 를 포함하던 중복 peer-resolution variant 두 갈래가 하나로 합쳐진 형태이며 패키지 버전(`eslint-config-next@16.3.0`) 자체는 불변 — 신규 workspace 노드 추가로 pnpm 이 peer 그래프를 재계산한 부수효과다. `review/code/2026/08/21/11_27_29/RESOLUTION.md` "미조치 INFO" 목록과 `review/code/2026/08/21/11_53_49/dependency.md` INFO 2번에서 이미 동일하게 식별·불요 판정됐고, 이번 라운드에서도 같은 결론(기능 변경 없음, 라이선스·취약점·번들 영향 없음)을 재확인했다.
  - 제안: 없음(재확인만, 신규 조치 불요).

- **[INFO]** 내부 의존성 — 신규 가드가 `typescript` 를 컴파일러 API 용도로 import, 두 스택 모두 기존 devDependency 재사용(신규 도입 아님)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (`import * as ts from 'typescript';`), `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` (`import ts from "typescript";`)
  - 상세: backend `package.json` 은 이미 `typescript ^5.7.3` 을 devDependency 로 갖고, frontend 는 `typescript ^5` 를 갖는다 — 둘 다 재사용이며 신규 의존 추가가 아니다. 두 가드 파일 모두 `__tests__`/`repo-guards` 경로 아래에 있어 각각 `tsconfig.build.json`(backend, `src/repo-guards/**` exclude 확인) / production 빌드에서 제외된다. 직전 라운드 RESOLUTION 이 `production-build-devdep` 가드(36/36 GREEN)로 실측 검증해 뒀다.
  - 제안: 없음.

- **[INFO]** 내부 의존성 — 8개 등록 표면(workspace glob 포함 시 사실상 9곳) 전수 확인, 전부 정합
  - 위치: `pnpm-workspace.yaml`(glob `codebase/packages/*` — 신규 패키지 자동 포함, 수동 등록 불요), `.claude/test-stages.sh:33`(`INTERNAL_PACKAGES` 배열), `.github/workflows/packages-checks.yml:49,68,83`(pathspec + matrix + 손 주석 "6개"로 갱신), `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`, `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`, `pnpm-lock.yaml`
  - 상세: `.github/workflows/frontend-checks.yml` 에도 이번 라운드에 `codebase/channel-web-chat/**` pathspec 이 추가됐는데, 이는 이 패키지 자체의 등록이 아니라 마커 SoT 미러 가드가 저장소 전체(`codebase/*/src`)를 훑기 때문에 `frontend-checks` 잡의 트리거 범위를 넓힌 것 — dependency 관점의 새 표면이 아니라 CI 트리거 확장이다. 등록 표면은 직전 두 라운드가 이미 전수 대조했고 이번 라운드 diff 는 값 자체를 바꾸지 않았다.
  - 제안: 없음.

## 요약

이번 변경은 **신규 외부(비-workspace) npm 패키지를 전혀 추가하지 않는다.** 유일한 신규 의존성은 내부 workspace 패키지 `@workflow/masked-markers` 이며, `package.json`(devDependencies·scripts·engines·jest 설정)이 형제 패키지 `@workflow/ai-end-reason`/`@workflow/node-summary` 와 바이트 단위로 동일해 버전 고정·라이선스·취약점 관점에서 새로운 리스크가 없다. `pnpm-lock.yaml` 상의 resolved 버전도 기존 lockfile 재사용이라 다운로드 표면이 늘지 않으며, `dependencies`/`devDependencies` 배치도 런타임 import 실태와 정확히 일치한다. 두 신규 마커-미러 가드 파일이 `typescript` 컴파일러 API 를 쓰지만 이미 존재하던 devDependency 를 재사용하고 프로덕션 빌드에서 제외됨을 확인했다. `pnpm-lock.yaml` 에 동반된 `eslint-config-next` peer 재해석은 이 PR 과 무관한 lockfile 부수효과로, 직전 두 리뷰 라운드에서 이미 조치 불요로 판정된 항목을 이번 라운드에서 재확인한 것뿐이다. 등록 표면(9곳)도 전수 정합돼 있다. 의존성 관점에서 병합을 막을 사유는 없다.

## 위험도
NONE
