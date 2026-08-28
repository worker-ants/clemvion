# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 모노레포 내 eslint 메이저 버전 분열(10 vs 9)이 발생 — 상류 차단으로 인한 의도적 결정
  - 위치: `.github/dependabot.yml:77-96`, `codebase/backend/eslint.config.mjs:19-38`, `codebase/frontend/eslint.config.mjs:1-21`, `codebase/channel-web-chat/eslint.config.mjs:1-4`
  - 상세: `backend` + `packages/*` 9개 워크스페이스는 `eslint ^10.9.1`/`@eslint/js ^10.0.1`로 올라갔지만, `frontend`·`channel-web-chat` 2개는 `eslint ^9`에 남는다. 사유는 `eslint-config-next`가 끌어오는 `eslint-plugin-react`(peer `^…||^9.7`)·`eslint-plugin-jsx-a11y`(`^…||^9`)·`eslint-plugin-import`(`^…||^9`)가 아직 eslint 10을 지원하는 latest 버전을 내지 않았기 때문. `plan/in-progress/deps-peer-gating-and-eslint10.md`에 "11개 전부 올려 `--strict-peer-dependencies` 실패를 실제로 관측 후 되돌림"이라는 근거가 남아 있고, `peerDependencyRules` 억제 대신 상태를 명시적으로 유지했다. pnpm-lock.yaml 상 실제로 frontend/channel-web-chat 두 워크스페이스만 `eslint@9.39.5`로 잠겨 있어(다른 워크스페이스는 `10.9.1`) 서술과 lockfile이 일치함을 확인했다.
  - 제안: 이 상태 자체는 정당하고 문서화·가드(회귀 테스트 `eslint-unicorn-peer.spec.ts`, CI `--strict-peer-dependencies`)도 갖췄으므로 지금 당장 조치는 불필요하다. 다만 "언제 eslint 9/10 두 계열을 계속 유지해야 하는가"에 대한 만료 조건(위 세 플러그인의 latest가 `^10`을 지원하는 시점)을 재확인하는 주기적 트리거가 있으면 좋다 — 현재는 사람이 다시 시도해봐야 아는 구조.

- **[INFO]** `eslint-plugin-unicorn` 56→73(17 메이저) 상향에 따른 대량의 신규 transitive devDependency 유입
  - 위치: `pnpm-lock.yaml` (`codebase/backend` importer 블록, `eslint-plugin-unicorn` 항목 및 하단 `packages:`/`snapshots:` 섹션)
  - 상세: `builtin-modules@5.3.0`, `change-case@5.4.4`, `espree@11.2.0`, `is-builtin-module@5.0.0`, `regjsparser@0.13.2`, `super-regex@1.1.0`, `web-worker@1.5.0` 등 다수의 신규 transitive 패키지가 추가됐다(구버전의 `semver@5.7.2`·`clean-regexp`·`type-fest@0.6/0.8` 등은 제거됨). 전수 확인 결과 전부 sindresorhus 계열/ESLint 생태계의 소형 유틸리티로, `devDependencies`에만 존재해 **프로덕션 번들에는 영향 없음**. 라이선스도 MIT/BSD-2-Clause/CC0(mdn-data) 계열로 백엔드(`UNLICENSED`류 비공개) 및 sdk 패키지(`Apache-2.0`)와 호환에 문제 없다.
  - 제안: 조치 불요. build/install 시간에 소폭 영향은 있으나(신규 패키지 수십 개) devDependency이므로 런타임/배포 크기와는 무관.

- **[INFO]** `peerDependencies` 표기 다양성에 대응한 파서 방어 확장은 타당하나, 버전 특정형 회귀 케이스가 fixture에 박제됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts` (`parseGteFloor`), `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`
  - 상세: `parseGteFloor`가 `>=X`/`>=X.Y`/`>=X.Y.Z` 3가지 표기를 모두 받도록 확장됐고, 회귀 테스트(`>=10.4` → `[10,4,0]` 등)가 추가됐다. 설계상 fail-closed(파싱 실패 시 null → 호출부 단언 실패)를 유지하고 있어 향후 `eslint-plugin-unicorn`이 다시 다른 표기(예: 4-component, pre-release 포함 `>=10.4.0-rc.1`)를 쓰면 또 한 번 이 가드가 멈출 수 있다. 이는 설계 의도(모르면 멈춘다)이므로 결함은 아니다.
  - 제안: 조치 불요. 이미 헤더 주석에 "재발 시 이 위치를 갱신"이라는 규약이 명시돼 있다.

- **[INFO]** `req('eslint-plugin-unicorn/package.json')` → `node_modules` 경로 직접 읽기로 전환
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:57-82` (`readInstalledPackageJson`)
  - 상세: `eslint-plugin-unicorn@73`의 `exports` 맵이 `"."`만 노출해 서브패스 `require`가 막힌 데 대한 우회로, pnpm의 `node_modules/<pkg>` symlink 특성에 의존한다. 관측 대상(설치본의 실제 peerDependencies)은 동일하게 유지되므로 가드의 계약(설치본 실측, 하드코딩 금지)은 보존된다. pnpm 외 패키지 매니저(예: 순수 npm hoisting이 다른 구조일 때)로 전환 시엔 재검증이 필요할 수 있으나, 이 저장소는 이미 pnpm 전용이므로 현재로선 문제 없음.
  - 제안: 조치 불요.

- **[INFO]** 무관한 선재 peer 미충족(`typeorm→ioredis`)이 이번 상향 작업 중 발견·기록됨(이 PR이 만든 문제 아님)
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:78-121` (§3 신설)
  - 상세: `pnpm install --strict-peer-dependencies`(non-frozen)로 실측 시 `typeorm@0.3.31`이 `ioredis@^5.0.4`를 요구하는데 설치본은 `6.0.0`이라는 unmet peer가 나온다. 문서 자체가 `origin/main`의 lockfile과 바이트 동일 해소임을 확인해 "이 브랜치가 만든 회귀가 아니다"라고 명시했고, `typeorm→ioredis`가 실제 런타임 경로(캐시 vs BullMQ)인지 확인이 선행돼야 한다는 후속 항목(P3)으로 분리해 뒀다.
  - 제안: 이 PR의 스코프는 아니다. 다만 향후 developer가 §3 항목에 착수할 때 "CI가 frozen-lockfile이라 새 unmet peer만 잡고 기존에 박힌 것은 못 잡는다"는 사각지대를 이미 문서가 짚고 있으므로 그대로 진행하면 된다.

## 요약
이번 변경은 순수하게 lint 툴체인(devDependency)의 eslint 9→10 및 eslint-plugin-unicorn 56→73 메이저 상향이며, 신규 프로덕션 의존성은 없다. 새로 유입된 transitive 패키지는 전부 devDependency 범위의 소형 MIT/BSD 계열 유틸리티라 라이선스·번들 크기·런타임 영향이 없다. peer 호환성은 `typescript-eslint@8.65.0`(peer `eslint ^8||^9||^10`), `eslint-config-prettier`/`eslint-plugin-prettier`(peer `>=` 개방형)로 실측 확인했고 충돌이 없다. `frontend`·`channel-web-chat` 2개 워크스페이스만 상류(`eslint-config-next`의 react/jsx-a11y/import 플러그인)가 아직 eslint 10을 지원하지 않아 eslint 9에 남기는 의도적 분리 상태이며, 이는 `--strict-peer-dependencies` 실측을 근거로 한 결정이고 회귀 가드(`eslint-unicorn-peer.spec.ts`)와 문서(SoT 헤더 주석)로 잘 방어돼 있다. `parseGteFloor`의 2-component semver 표기 대응 확장과 `eslint-plugin-unicorn@73`의 `exports` 제약 우회(`node_modules` 경로 직접 읽기)도 가드의 계약을 훼손하지 않는 방어적 수정이다. 문서에서 스스로 드러낸 `typeorm→ioredis` 선재 peer 미충족은 이 PR의 회귀가 아님을 실측(lockfile 바이트 비교)으로 확인했고 별도 백로그로 분리돼 있다. 전반적으로 의존성 관점에서 새로운 위험을 추가하지 않는, 잘 문서화된 유지보수성 상향 작업이다.

## 위험도
NONE
