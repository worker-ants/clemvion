# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `eslint-plugin-unicorn` 다운그레이드로 인해 lockfile 에 구식 transitive dev 패키지 재유입
  - 위치: `pnpm-lock.yaml` — snapshots 섹션의 `eslint-plugin-unicorn@56.0.1(eslint@9.39.4(jiti@2.7.0))` 블록(전체 파일 컨텍스트 게이트 없음, unified diff 섹션의 `@@ -16176,29 +16157,25 @@ snapshots:` 근방)
  - 상세: `^72.0.0` → `^56.0.1` 복원으로 `read-pkg-up@7.0.1`/`read-pkg@5.2.0`/`normalize-package-data@2.5.0`/`hosted-git-info@2.8.9`/`spdx-*`/`semver@5.7.2`/`validate-npm-package-license@3.0.4`/`type-fest@0.6.0`·`0.8.1`/`globals@15.15.0`/`jsesc@0.5.0`/`clean-regexp@1.0.0`/`escape-string-regexp@1.0.5` 등 약 15개 구식(일부는 수년간 미갱신) 패키지가 devDependency 트리에 새로 유입됩니다. 직접 실제 `pnpm-lock.yaml`(worktree 내)을 grep 해 확인한 결과 이 패키지들은 전부 `eslint-plugin-unicorn@56.0.1` 서브트리에만 존재하고(`builtin-modules`/`regjsparser`/`is-builtin-module` 등도 동일하게 이 패키지 전용으로 단일 인스턴스) 다른 워크스페이스(frontend/channel-web-chat/packages/*)나 production 의존성과는 공유되지 않습니다. `hosted-git-info@2.8.9` 는 과거 ReDoS(CVE-2021-23362)의 패치 버전이라 알려진 취약점은 없습니다. 기능적 부작용은 없으나, devDependency 공급망 표면이 넓어진 점은 plan 문서(`plan/in-progress/eslint-unicorn-peer-restore.md`)에 명시적으로 다뤄지지 않은 부수 효과라 기록해 둡니다.
  - 제안: 별도 조치 불요. 향후 `pnpm audit`/SCA 스캔에서 새로 나타나는 패키지들은 이 PR 기인임을 인지하면 됨.

- **[INFO]** `pnpm-lock.yaml` 스냅샷에서 `entities@4.5.0`/`resolve@1.22.12` 의 `optional` 플래그가 뒤바뀜(부작용 없음, 검증 완료)
  - 위치: `pnpm-lock.yaml` — unified diff `@@ -15819,7 +15797,8 @@ snapshots:` (entities), `@@ -20395,7 +20363,6 @@ snapshots:` (resolve)
  - 상세: `entities@4.5.0` 은 `eslint-plugin-unicorn@72.0.0` 이 비-optional 로 의존하던 게 사라지며 `optional: true` 로 전환됐고(남은 소비자는 `dom-serializer@2.0.0`/`htmlparser2@9.1.0` 로 둘 다 기존부터 optional), `resolve@1.22.12` 은 신규 유입된 `normalize-package-data@2.5.0`(비-optional)이 소비하게 되며 반대로 `optional: true` 마커가 제거됐습니다. 실제 lockfile 을 열어 두 패키지의 전체 소비자 목록을 직접 대조해 이 변화가 unicorn 버전 교체의 순수한 기계적 결과임을 확인했고, 다른 워크스페이스나 production 경로에 영향이 없습니다. 정보 제공 목적으로만 기록.
  - 제안: 조치 불요.

- **[INFO]** dependabot 의 향후 자동 PR 생성 이벤트가 억제됨 (의도된 부작용)
  - 위치: `.github/dependabot.yml:90-91`(신규 게이트) — `dependency-name: "eslint-plugin-unicorn"` ignore 항목
  - 상세: 이 변경은 dependabot 이 향후 `eslint-plugin-unicorn` major 버전 bump PR 을 **자동 생성하지 않도록** 억제합니다(콜백/이벤트 발생 변경에 해당). 의도된 수정이며 YAML 스키마도 `python3 -c "yaml.safe_load(...)"` 로 직접 파싱해 유효함을 확인했습니다(ignore 배열에 `typescript`, `eslint-plugin-unicorn` 두 항목 정상 반영). minor/patch 및 별도 토글인 repo Settings 의 Dependabot security updates 는 영향받지 않는다고 plan 문서에 명시돼 있습니다.
  - 제안: 조치 불요. eslint 10 상향이 이뤄지기 전까지는 이 ignore 가 유지되어야 하므로, 향후 `eslint.config.mjs` 의 pin 을 푸는 PR 에서 이 항목도 함께 제거해야 함(plan 문서에 이미 명시됨 — 결속 확인).

- 시그니처/공개 API/전역 상태/파일시스템/환경변수/네트워크 호출 관점에서는 실질 변경 없음.
  - `codebase/backend/eslint.config.mjs` 의 diff 는 **주석만** 확장됐고 `plugins: { unicorn: eslintPluginUnicorn }` 및 룰 등록부(`'unicorn/catch-error-name': [...]`, `codebase/backend/eslint.config.mjs`)는 무변경 — lint 동작에 실질 영향 없음.
  - `codebase/backend/package.json:119` 의 devDependency 버전 다운그레이드는 로컬 lint 툴체인에만 영향, production 런타임 코드·API 표면과 무관.
  - `plan/in-progress/eslint-unicorn-peer-restore.md` 는 프로젝트 규약대로 `plan/in-progress/` 에 신규 생성된 정상적인 계획 문서(frontmatter `worktree: eslint-peer-fix-f41984` 가 실제 worktree 와 일치) — 의도치 않은 파일시스템 부작용 아님.

## 요약

이번 변경은 dependabot 이 실수로 올린 `eslint-plugin-unicorn` major 버전(72→56 복원)을 되돌리고, 재발 방지용 dependabot ignore 규칙을 추가하며, 근거를 plan 문서와 config 주석에 남기는 되돌리기(revert) 성격의 PR이다. 함수 시그니처·공개 API·전역 상태·환경 변수·네트워크 호출 등 런타임 부작용은 전혀 발생하지 않으며, `eslint.config.mjs` 는 주석만 바뀌어 lint 동작이 완전히 동일하다. 가장 부피가 큰 `pnpm-lock.yaml` 변경도 실측(grep)으로 대조한 결과 `eslint-plugin-unicorn` 서브트리에만 격리된 기계적 재계산이며, 다른 워크스페이스·production 의존성에 영향을 주는 버전 충돌이나 의도치 않은 패키지 다운그레이드는 발견되지 않았다. 유일하게 기록할 만한 부수 효과는 (1) devDependency 트리에 구식 transitive 패키지 ~15개가 재유입된다는 점(취약점은 없음, 정보성)과 (2) dependabot 의 향후 자동 PR 생성이 이 패키지에 한해 억제된다는 점(의도된 이벤트 억제)이며, 둘 다 차단 사유가 아니다.

## 위험도

NONE
