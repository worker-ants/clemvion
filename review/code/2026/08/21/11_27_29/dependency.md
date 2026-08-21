# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 workspace 내부 패키지 `@workflow/masked-markers` 도입 — 필요성은 타당, 템플릿 완전 일치
  - 위치: `codebase/packages/masked-markers/package.json` (신규 파일 전체)
  - 상세: backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts` 에 손으로 복제돼 있던 마커 상수/깊이 상한을 단일 SoT 로 추출한 것. `package.json`/`eslint.config.mjs`/`tsconfig.json` 을 형제 패키지 `@workflow/ai-end-reason`, `@workflow/graph-warning-rules` 와 `diff` 로 직접 대조했고, 헤더 주석 한 줄을 빼면 **완전히 동일**하다(devDependencies 버전까지 일치: `eslint ^9.18.0` / `jest ^30.0.0` / `typescript ^5.7.3` / `typescript-eslint ^8.65.0` / `globals ^17.9.0` / `ts-jest ^29.2.5` / `@types/jest ^30.0.0`). 새 외부 패키지가 아니라 기존에 이미 각 패키지가 devDependency 로 쓰던 라이브러리들의 재사용이므로 라이선스·취약점·중복 설치 표면이 새로 생기지 않는다.
  - 제안: 없음 (승인 가능한 형태).

- **[INFO]** 버전 고정(pinning) — `workspace:*` + caret(`^`) 관례를 그대로 따름
  - 위치: `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`, `codebase/packages/masked-markers/package.json` (devDependencies 블록)
  - 상세: 내부 워크스페이스 참조는 `workspace:*` (다른 7개 내부 패키지와 동일 관례), devDependency 는 caret range. `pnpm-lock.yaml` 이 실제 해석 버전을 고정하므로(`eslint 9.39.4`, `jest 30.4.2`, `typescript 5.9.3`, `typescript-eslint 8.67.0(...)`, `ts-jest 29.4.11(...)`) 재현성 문제는 없다. 이 버전들은 기존 lockfile에 **이미 존재하던 resolved 버전**과 동일해 새로운 버전 계열이 추가되지 않았다(`globals@17.9.0` 도 기존에 이미 lockfile에 있던 버전 — 신규 추가가 아니라 기존 fragmentation 재사용).
  - 제안: 없음.

- **[INFO]** 라이선스 — 신규 외부 의존성 없음, 확인 불요
  - 위치: `codebase/packages/masked-markers/package.json` (license 필드 부재)
  - 상세: 이 PR 이 추가하는 것은 내부 workspace 패키지 하나(`@workflow/masked-markers`, 코드만 이동)뿐이며 신규 외부 npm 패키지는 0개다. `license` 필드가 없는 것도 형제 패키지(`ai-end-reason`, `graph-warning-rules` 등) 전부와 동일한 기존 관례(모노레포 private 패키지, `codebase/packages/sdk` 만 예외적으로 `Apache-2.0` 명시)라 이번 PR 이 만든 편차가 아니다.
  - 제안: 없음. (참고: 저장소 전체 private-package license 정책 통일은 이번 PR 범위 밖.)

- **[INFO]** 알려진 취약점 — 신규 취약 표면 없음
  - 위치: `pnpm-lock.yaml` (importers 블록 `codebase/packages/masked-markers`)
  - 상세: 신규로 lockfile 에 추가된 것은 workspace link 하나(`link:../packages/masked-markers`)와 그 devDependencies 뿐이고, 전부 이미 다른 워크스페이스 패키지가 동일 버전으로 사용 중인 패키지다. 새 다운로드 대상(신규 CVE 노출 표면)이 늘지 않는다.
  - 제안: 없음.

- **[INFO]** 불필요한 의존성 여부 — 추출이 정당화됨(CI 경로 게이팅 실측 근거)
  - 위치: `plan/in-progress/masked-marker-shared-package.md` "왜 계약 테스트가 아닌가 — CI 경로 게이팅" 절
  - 상세: 대안(양쪽에 계약 테스트 중복 배치)이 명시적으로 검토·기각됐고 근거(`frontend-checks`/`backend-checks` 워크플로가 상대 스택 변경 시 서로 skip)가 plan 문서에 실측으로 남아 있다. 표준 라이브러리로 대체 가능한 로직이 아니라 backend↔frontend 크로스런타임(Jest/Vitest, Node CJS build) 값 공유이므로 workspace 패키지 추출이 합리적 선택이다.
  - 제안: 없음.

- **[INFO]** 의존성 크기 — 무시할 수준
  - 위치: `codebase/packages/masked-markers/src/index.ts` (81줄, export 6개: 상수 3 + 배열 1 + 함수 1 + 상수 1)
  - 상세: 런타임 코드는 문자열 상수 3개·`Object.freeze` 된 배열 1개·단순 판정 함수 1개·숫자 상수 1개뿐이다. `main`/`types` 가 `dist/index.js`/`dist/index.d.ts` 를 가리키고 `tsc` 로 빌드되므로 번들 크기 영향은 사실상 0에 가깝다. devDependencies(빌드/테스트 도구)는 install 시간에 기존 패키지들과 이미 캐시 공유되는 버전이라 추가 빌드 시간도 미미하다.
  - 제안: 없음.

- **[INFO]** 호환성 — 기존 의존성과 충돌 없음, 단 `pnpm-lock.yaml` 에 무관해 보이는 재해석 diff 동반
  - 위치: `pnpm-lock.yaml` (`eslint-config-next@16.3.0(...)`, `eslint-import-resolver-typescript@...`, `eslint-module-utils@...`, `eslint-plugin-import@...` 항목들의 peer 키 문자열 변경)
  - 상세: 새 workspace 패키지 추가 후 `pnpm install --frozen-lockfile` 이 아니라 실제 재계산이 수행되면서, frontend 의 `eslint-config-next` 관련 peer-dependency 해석 키에서 `@typescript-eslint/parser@8.67.0(...)` 조합이 제거되고 더 짧은 키로 단순화됐다(예: `eslint-config-next@16.3.0(@typescript-eslint/parser@...)(eslint@...)(typescript@...)` → `eslint-config-next@16.3.0(eslint@...)(typescript@...)`). 이는 마커 패키지 추가 자체와 직접 관련은 없어 보이지만, workspace 그래프에 새 노드가 생기면서 pnpm 의 peer dedup 알고리즘이 기존 eslint 플러그인 체인의 최적 해를 다시 계산한 부수 효과로 보인다. `lockfileVersion: '9.0'` 은 변화가 없고 `packageManager: pnpm@10.23.0` 과 로컬 `pnpm --version`(10.23.0) 이 일치해 lockfile 생성 도구 버전 drift 는 아니다. 기능적으로는 동일 패키지(`eslint-plugin-import@2.32.0`, `eslint-import-resolver-typescript@3.10.1`)의 재귀적 peer 표기만 바뀐 것으로 실제 설치 버전 변경은 없어 보인다.
  - 제안: 리뷰어가 "왜 마커 패키지 PR 에 무관한 eslint 리졸버 diff 가 섞였는가" 를 의아해할 수 있으므로, PR 설명이나 plan 문서에 "`pnpm install` 재실행에 따른 부수적 peer-dep 재해석(기능 변경 없음)" 한 줄을 남겨두면 향후 리뷰어의 혼란을 줄일 수 있다. 병합 전 `pnpm install --frozen-lockfile` 한 번 더 돌려 이 상태가 안정적으로 재현되는지(다음 `pnpm install` 에서 다시 흔들리지 않는지) 확인 권장 — 다만 이는 이번 PR 을 막을 사유는 아니다.

- **[INFO]** 내부 의존성(등록 표면) — 8곳 중 6곳 확인, 자동 가드는 2곳뿐(plan 문서가 이미 정확히 지적)
  - 위치: `.claude/test-stages.sh:33`, `.github/workflows/packages-checks.yml:49,68,83`, `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`, `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`(+ 벌크 `COPY codebase/packages` 로 소스 포함), `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `pnpm-lock.yaml`
  - 상세: 직접 저장소를 열어 8개 표면을 전수 확인했다. `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 배열, `packages-checks.yml` 의 pathspec·matrix 두 곳(자동 가드 대상), backend/frontend `package.json` 의 `workspace:*` 의존, backend/frontend/playwright-e2e 세 Dockerfile 의 COPY(§backend·playwright-e2e 는 명시적 소스 COPY, frontend 는 `COPY codebase/packages/masked-markers/package.json` + 이어지는 벌크 `COPY codebase/packages ./codebase/packages` 로 소스가 실질 포함되어 결함 아님), `pnpm-lock.yaml` importers 항목까지 전부 등록돼 있고 `channel-web-chat` 은 이 패키지를 소비하지 않으므로 등록 대상이 아니다(grep 결과 0건, 정상). plan 문서(`masked-marker-shared-package.md`)가 자체적으로 "가드는 `.claude/test-stages.sh`·`packages-checks.yml` 둘뿐이고 나머지 6곳은 수동 대조"라고 명시해 뒀고 이는 실측과 일치한다 — 새로운 의존성 리스크가 아니라 기존에도 있던(다른 6개 내부 패키지에도 동일하게 적용되는) 구조적 갭이므로 이번 PR 이 새로 만든 결함은 아니다.
  - 제안: 없음(구조적 갭은 이번 PR 범위 밖 — plan 문서에 이미 후속 항목으로 인지돼 있음). consistency 리뷰 SUMMARY(`review/consistency/2026/08/21/10_45_52/SUMMARY.md`)가 지적한 frontmatter 필수 필드 누락(BLOCK) 은 의존성 관점이 아닌 별개 checker 소관이라 본 리뷰에서는 중복 지적하지 않는다.

## 요약

이번 변경은 **신규 외부 npm 패키지를 전혀 추가하지 않는다.** 유일한 신규 의존성은 내부 workspace 패키지 `@workflow/masked-markers` 이며, 그 `package.json`/`eslint.config.mjs`/`tsconfig.json` 을 형제 패키지(`@workflow/ai-end-reason`)와 직접 `diff` 대조한 결과 헤더 주석 한 줄을 제외하고 완전히 동일해 버전 고정·devDependency 선택·빌드 스크립트 전부 기존 검증된 템플릿을 그대로 재사용한다. `pnpm-lock.yaml` 에 새로 추가된 리졸브 버전들도 기존 lockfile 에 이미 존재하던 버전과 일치해 취약점·라이선스·번들 크기 관점의 신규 리스크가 없다. 8개 등록 표면(test-stages.sh, packages-checks.yml, package.json ×2, Dockerfile ×3, lockfile)을 직접 열어 전수 확인했고 전부 정상 등록돼 있다. 유일하게 눈에 띄는 항목은 `pnpm-lock.yaml` 에 딸려온 `eslint-config-next` 관련 peer-dependency 재해석 diff(기능 변경 없어 보이는 부수 효과)로, 병합을 막을 사유는 아니나 PR 설명에 한 줄 남겨두면 향후 리뷰 혼란을 줄일 수 있다. 등록 표면 자동 가드가 8곳 중 2곳뿐이라는 구조적 갭은 plan 문서가 이미 정확히 인지·기록한 기존 패턴(다른 7개 내부 패키지에도 동일 적용)이라 이번 PR 이 신규로 만든 결함이 아니다.

## 위험도
NONE
