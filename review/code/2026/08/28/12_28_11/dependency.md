# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 모노레포 내 eslint 메이저 버전 분열(10 vs 9)이 지속 — 상류 차단에 근거한 의도적 결정, 실측으로 검증됨
  - 위치: `.github/dependabot.yml:83-88`(⚠️ eslint 자체 major 미차단 각주), `codebase/backend/eslint.config.mjs:19-38`, `codebase/frontend/eslint.config.mjs:1-21`, `codebase/channel-web-chat/eslint.config.mjs:1-4`, `plan/in-progress/deps-peer-gating-and-eslint10.md` §2
  - 상세: `backend` + `packages/*` 8개(총 9 워크스페이스)는 `eslint ^10.9.1`/`@eslint/js ^10.0.1`로 올라갔지만 `frontend`·`channel-web-chat`은 `eslint ^9`에 남았다(실제 `package.json` 확인: 두 파일 모두 `"eslint": "^9"`). 사유는 `eslint-config-next`가 끌어오는 `eslint-plugin-react`(peer `^…||^9.7`)·`eslint-plugin-jsx-a11y`(`^…||^9`)·`eslint-plugin-import`(`^…||^9`)가 아직 eslint 10을 지원하는 latest를 내지 않았기 때문이며, plan 문서에 "11개 전부 올려 `--strict-peer-dependencies` 실패를 실제로 관측 후 되돌림"이라는 실측 근거가 남아 있다. `pnpm-lock.yaml`도 frontend/channel-web-chat만 `eslint@9.39.5`로 잠겨 있어 서술과 lockfile이 일치한다(직접 확인).
  - 제안: 조치 불요. 다만 위 세 플러그인의 latest가 eslint 10 peer를 지원하는 시점을 재확인하는 트리거가 아직 사람 판단에 의존한다는 점은 이미 이전 라운드에서도 지적된 잔여 사항이므로 이번 라운드에서 추가로 처리할 필요는 없다.

- **[INFO]** `eslint-plugin-unicorn` 56→73(17 메이저) 상향에 따른 대량의 신규 transitive devDependency 유입 — devDependency 한정, 라이선스·번들 영향 없음(이전 라운드 확인 유지)
  - 위치: `pnpm-lock.yaml`(`codebase/backend` importer 블록 + `packages:`/`snapshots:` 섹션), `codebase/backend/package.json`(`"eslint-plugin-unicorn": "^73.0.0"`)
  - 상세: `builtin-modules`, `change-case`, `espree@11`, `is-builtin-module`, `regjsparser`, `super-regex`, `web-worker` 등 다수 신규 transitive 패키지가 추가되고 구버전 `semver@5.7.2`·`clean-regexp`·`type-fest@0.6/0.8` 등이 제거됐다. 전부 `devDependencies`에만 존재해 프로덕션 번들·런타임에 영향 없다. `pnpm-workspace.yaml`의 `overrides`/`onlyBuiltDependencies`에는 이번 변경으로 인한 추가가 없음을 확인했다(네이티브 빌드 스크립트를 요구하는 신규 패키지 없음).
  - 제안: 조치 불요.

- **[INFO]** 이전 라운드(11_45_02) Critical/Warning 지적사항이 이번 diff에 실제로 반영·검증됨 — 의존성 문서 정합성 회복
  - 위치: `PROJECT.md`(빌드 툴체인 major 차단 서술), `.github/dependabot.yml:72-88`
  - 상세: 직전 라운드가 지적한 "`PROJECT.md`가 자신이 명문화한 2-place 편집 계약을 어겼다"(dependabot ignore 항목이 1건으로 줄었는데 서술은 "2건"으로 남음) 이슈가 이번 diff에서 "현재 `typescript` 1건"으로 정정돼 있고, 실측(`grep -n "dependency-name:" .github/dependabot.yml`)으로 실제 ignore 블록에 `typescript` 단 1건만 있음을 확인해 서술과 설정이 일치함을 검증했다. `eslint-plugin-unicorn`의 dependabot ignore 항목 자체도 실제로 제거돼 있고, 자리에 남긴 묘비 주석은 이전 라운드가 지적한 "22줄 고아 주석"에서 7줄로 축약된 상태다.
  - 제안: 조치 불요 — 재발 방지용 2-place 결속(`PROJECT.md` 카운트 ↔ `dependabot.yml` ignore 항목 수)이 이번 라운드에서 실측으로 재검증됐다.

- **[INFO]** `parseGteFloor` 2-component semver 표기 대응 확장은 타당 — fail-closed 설계 유지, 실측 정합 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts`(`parseGteFloor`), `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`(`readInstalledPackageJson`)
  - 상세: `eslint-plugin-unicorn@73`의 실제 설치본 `peerDependencies.eslint`가 `>=10.4`(2-component)임을 직접 확인했다(`node -e "require('./codebase/backend/node_modules/eslint-plugin-unicorn/package.json').peerDependencies"` → `{ eslint: '>=10.4' }`). 파서 확장(`>=X`/`>=X.Y`/`>=X.Y.Z`)과 `req(...)` → `node_modules` 경로 직접 읽기 전환(`exports` 맵 제약 우회) 모두 가드의 계약(설치본 실측, 하드코딩 금지)을 훼손하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `typescript-eslint` 8.65.0/8.67.0 버전 분열은 이번 PR이 만든 것이 아님 — pre-existing lockfile 상태
  - 위치: `pnpm-lock.yaml`(각 워크스페이스 `typescript-eslint:` 블록)
  - 상세: 워크스페이스별로 `typescript-eslint@8.65.0`과 `8.67.0`이 혼재하는데, `git show origin/main:pnpm-lock.yaml`로 대조한 결과 이 분열은 origin/main에도 이미 존재했다(신규 회귀 아님). 이번 PR의 eslint 9→10 상향 diff와 무관하다.
  - 제안: 조치 불요(이 PR 스코프 밖). 후속으로 다룰 경우 caret range 통일 여부만 판단하면 된다.

- **[INFO]** `typeorm → ioredis` 선재 peer 미충족은 이 PR의 회귀가 아님 — plan에 별도 후속(§3, P3)으로 정확히 분리됨
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` §3(신설)
  - 상세: `pnpm install --strict-peer-dependencies`(non-frozen)로 실측 시 `typeorm@0.3.31`이 `ioredis@^5.0.4`를 요구하는데 설치본은 `6.0.0`이라는 unmet peer가 나오지만, 문서가 `origin/main`의 lockfile과 바이트 동일 해소임을 근거로 "이 브랜치가 만든 회귀가 아니다"라고 명시했다. CI의 `--frozen-lockfile` 게이트가 이미 lockfile에 박힌 미충족 peer는 못 잡는다는 사각지대(§1 보장 범위 정정)도 문서가 스스로 짚고, 착수 전 "typeorm→ioredis가 실제 런타임 경로인지 먼저 실측" 하라는 순서를 명시해 뒀다.
  - 제안: 이 PR 스코프 아님. 후속 착수 시 이미 문서화된 순서(런타임 경로 실측 → 처분안 (a)/(b)/(c) 선택)를 따르면 된다.

## 요약

이번 diff는 순수 devDependency(lint 툴체인) 범위의 eslint 9→10 및 eslint-plugin-unicorn 56→73 메이저 상향과, 직전 리뷰 라운드(11_45_02)에서 지적된 Critical(문서-설정 카운트 drift) 1건·Warning 2건에 대한 실제 fix 커밋이 결합된 형태다. 신규 프로덕션 의존성은 없고, 새로 유입된 transitive 패키지는 전부 MIT/BSD 계열 devDependency 유틸리티라 라이선스·번들 크기·런타임에 영향이 없다. 가장 중요한 확인은 직전 라운드가 잡은 "PROJECT.md 카운트가 실제 dependabot.yml 항목 수와 어긋난" 문제가 이번 diff에서 실제로 정정됐고, 그 정정이 재실측(dependency-name grep)으로 참임이 검증됐다는 점 — 이 PR이 스스로 경계하는 "#1049류 값-주석 drift"를 재발시키지 않았다. `frontend`·`channel-web-chat` 2개 워크스페이스만 eslint 9에 남기는 결정은 실측된 상류 차단 근거(registry 조회 + 실제 `--strict-peer-dependencies` 실패 관측)를 갖추고 있고, `eslint-plugin-unicorn@73`의 `exports` 제약 우회·`parseGteFloor` 2-component 대응 확장도 설치본 실측(`>=10.4` 확인)과 정확히 일치한다. `typescript-eslint` 버전 분열과 `typeorm→ioredis` peer 미충족은 모두 이 PR 이전부터 존재했거나 이 PR의 스코프 밖으로 명시적으로 분리된 사안이라 이번 diff에 대한 새로운 위험으로 간주하지 않는다. 전반적으로 의존성 관점에서 새로운 위험을 추가하지 않는, 잘 검증된 유지보수성 상향 + 셀프코렉션 작업이다.

## 위험도
NONE
