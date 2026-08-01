### 발견사항

- **[INFO]** `eslint-plugin-unicorn` 은 exact pin 이 아니라 caret range(`^56.0.1`)로 복원됐다 — 56.x 대역 내 minor/patch 자동 갱신은 여전히 열려 있다.
  - 위치: `codebase/backend/package.json:119` (`"eslint-plugin-unicorn": "^56.0.1"`), `.github/dependabot.yml`(`- dependency-name: "eslint-plugin-unicorn"` ignore 블록)
  - 상세: `eslint.config.mjs`·`dependabot.yml`·plan 문서 모두 이번 라운드에서 "^56 은 caret range — exact pin 아님, minor/patch 는 자동 허용"이라고 명시적으로 정정해 뒀다(직전 라운드 INFO#12 반영 완료, `codebase/backend/eslint.config.mjs` 주석·`.github/dependabot.yml` 주석 확인). 어휘 오해 소지는 이미 해소된 상태.
  - 제안: 조치 불요.

- **[INFO]** registry 실측 floor 표가 정확함을 npm registry 재조회로 독립 검증했다.
  - 위치: `codebase/backend/eslint.config.mjs`(unicorn 등록 블록 주석 — SoT), `.github/dependabot.yml`(참조 요약)
  - 상세: `npm view eslint-plugin-unicorn@{56.0.1,57.0.0,65.0.1,66.0.0,72.0.0} peerDependencies` 로 직접 조회한 결과 56.x=`>=8.56.0`, 57=`>=9.20.0`, 65.0.1=`>=9.38.0`, 66+/72=`>=10.4` — 문서에 적힌 표와 전부 일치한다. `npm view eslint dist-tags`도 `maintenance: 9.39.5`, `latest: 10.8.0`로 "eslint 9 는 maintenance, latest 는 10.x" 서술과 일치. `npm view eslint-plugin-unicorn license` = MIT로 프로젝트와 라이선스 호환.
  - 제안: 조치 불요. (검증 완료 — false claim 없음)

- **[INFO]** 새 회귀 가드(`eslint-unicorn-peer.spec.ts`/`-guard.ts`/`-fixture.ts`)는 신규 외부 의존성을 추가하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`, `eslint-unicorn-peer-guard.ts`
  - 상세: import 는 `node:child_process`/`node:path`/`node:module` 표준 라이브러리와 기존 devDependency(jest, `node_modules/.bin/eslint` 서브프로세스)만 사용한다. `createRequire` 로 `eslint-plugin-unicorn/package.json`·backend `package.json`·`eslint/package.json` 을 런타임 실측하는 방식이라 값 하드코딩에 따른 drift 위험이 없다(형제 가드 `typescript-toolchain-guard.ts` 와 동일 패턴).
  - 제안: 조치 불요.

- **[INFO]** 다운그레이드로 재유입되는 ~15개 transitive devDependency(`hosted-git-info@2.8.9`, `semver@5.7.2`, `regjsparser@0.10.0`, `is-builtin-module@3.2.1`, `builtin-modules@3.3.0`, `globals@15.15.0`, `read-pkg{,-up}`, `normalize-package-data@2.5.0`, `spdx-*`, `type-fest@0.6.0/0.8.1`, `jsesc@0.5.0`, `clean-regexp@1.0.0`, `escape-string-regexp@1.0.5` 등)은 `#1049` 이전에 이미 lockfile 에 있던 조합으로 정확히 복귀하는 것이며, `eslint-plugin-unicorn@56.0.1` 서브트리에만 격리되어 있다(`pnpm-lock.yaml` importers/snapshots 대조).
  - 위치: `pnpm-lock.yaml` (`eslint-plugin-unicorn@56.0.1(eslint@9.39.4(jiti@2.7.0))` snapshot 블록 및 그 하위 transitive 목록)
  - 상세: devDependency(빌드/린트 전용, 런타임 비노출)이며 다른 워크스페이스(frontend/channel-web-chat/packages/*)나 production 의존성과 공유되지 않는다. `hosted-git-info@2.8.9` 는 과거 ReDoS(CVE-2021-23362)의 패치 버전이라 알려진 취약점 없음.
  - 제안: 조치 불요. 원하면 `pnpm audit` 1줄을 TEST WORKFLOW 체크리스트에 추가.

- **[INFO]** 영향 범위는 `codebase/backend` 워크스페이스 단일로 정확히 국한된다.
  - 위치: `pnpm-lock.yaml` importers 섹션 — `eslint-plugin-unicorn` 은 backend 에만 존재, 다른 9개 워크스페이스 devDependency 목록에 없음
  - 상세: 워크스페이스 간 eslint 선언 floor 가 이미 갈려 있다는 사실(`^9.18` vs `^9`)은 plan 문서가 스스로 인지하고 65.0.1 대신 56.0.1 을 고른 근거로 명시했다. 교차 워크스페이스 버전 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** `PROJECT.md`·`.github/dependabot.yml` 카운트 결속을 직접 대조해 일치함을 확인했다.
  - 위치: `PROJECT.md:49`(`typescript`·`eslint-plugin-unicorn` 2건), `.github/dependabot.yml`(`dependency-name` ignore 항목 2개)
  - 상세: `grep -c "^      - dependency-name:" .github/dependabot.yml` = 2, `PROJECT.md` 서술도 "2건"으로 일치. 직전 라운드 Warning #1 이 정확히 조치됐다.
  - 제안: 조치 불요.

- **[INFO]** `eslint-plugin-unicorn` 자체는 알려진 CVE 이력이 없는 순수 lint-rule 패키지이며, 이번 다운그레이드는 새 취약점 유입이 아니라 이전에 운영 검증된 상태로의 복귀다. `pnpm audit --prod` 로 production dependency 만 별도 점검하면 충분(devDependency 는 `deps-security-checks.yml` 의 `pnpm audit --audit-level=moderate` 대상).
  - 위치: `codebase/backend/package.json:119`
  - 제안: 조치 불요.

- **[INFO]** dependabot major-bump ignore 는 GitHub 의 별도 "Dependabot security updates" 토글에 영향을 주지 않는 것이 통상 동작이나, 해당 취약점 수정이 major 버전에서만 제공되는 경우 자동 PR 이 억제될 수 있는 트레이드오프는 `dependabot.yml` 주석과 plan 문서에 이미 명시적으로 인지·기록되어 있다.
  - 위치: `.github/dependabot.yml`(`eslint-plugin-unicorn` ignore 항목), `plan/in-progress/eslint-unicorn-peer-restore.md` 후속 검토 절
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/01/12_27_15/*` (전 라운드 리뷰 산출물)가 이번 changeset 에 함께 커밋되어 있으나, 이는 리뷰 하네스 산출물이지 의존성 변경이 아니다. 해당 라운드의 dependency 발견사항(전부 INFO, 위험도 LOW)은 이번 파일들에서 재확인한 내용과 일치하며 새로 발견된 모순은 없다.
  - 위치: `review/code/2026/08/01/12_27_15/dependency.md` 등
  - 제안: 조치 불요.

### 요약

새 외부 의존성 추가 없음. `eslint-plugin-unicorn` 을 dependabot 이 의도치 않게 올린 `^72.0.0`(eslint peer `>=10.4`, 설치본 9.39.4 와 unmet)에서 원래 pin `^56.0.1`(peer `>=8.56.0`, backend 선언 floor `^9.18.0` 충족)로 되돌리는 순수 revert이며, `package.json`·`eslint.config.mjs` 주석·`.github/dependabot.yml` ignore·`pnpm-lock.yaml`·`PROJECT.md` 카운트가 서로 일관되게 갱신됐다("pin 을 풀려면 dependabot ignore 도 함께 지워야 한다"는 2-place 결속까지 명시). registry 실측 floor 표(56.x=`>=8.56.0` / 57=`>=9.20.0` / 65.0.1=`>=9.38.0` / 66+=`>=10.4`)를 `npm view`로 독립 재검증한 결과 문서 서술과 전부 일치했고, 재유입되는 ~15개 transitive devDependency 는 backend 서브트리에만 격리되며 알려진 취약점이 없다. 새로 추가된 회귀 가드(`eslint-unicorn-peer.spec.ts` 등)도 표준 라이브러리와 기존 devDependency만 사용해 신규 의존성 표면이 없다. 라이선스(MIT)·번들 크기(devDependency-only)·워크스페이스 간 호환성 모두 문제없음. Critical/Warning 급 의존성 결함 없음.

### 위험도
NONE
