# 변경 범위(Scope) Review

## 점검 대상 및 의도된 범위

**계획 파일**: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/plan/in-progress/refactor/07-dependency-residual.md`

의도된 범위:
- **M-2**: channel-web-chat `@vitejs/plugin-react ^4→^6.0.1`, `jsdom ^25→^29.0.1`
- **M-4**: expression-engine `dayjs ^1.11.13→^1.11.20`
- **m-1/m-8**: Node floor 이원화 (`@types/node ^24`, `engines.node >=24` 내부, `>=20` 외부 SDK)
- **m-2**: PROJECT.md 테스트 프레임워크 이원화 정책 문서화
- **m-6**: PROJECT.md 버전 핀 정책 문서화
- **m-4(spec)**: spec/7-channel-web-chat/4-security.md §1.1 sanitize 매트릭스
- **m-9**: otplib `^12→^13` 마이그레이션 + totp 단위 테스트 신설

---

## 발견사항

### [INFO] 파일 3 — backend/jest.config.ts: 주석 수정 및 transformIgnorePatterns 확장

- **위치**: `codebase/backend/jest.config.ts` 변경
- **상세**: 기존 `// ESM-only packages (uuid >=12, p-limit >=4, yocto-queue) must be transformed.` 주석을 수정하고 `otplib|@otplib|@scure|@noble` 를 transformIgnorePatterns 에 추가. 이는 m-9(otplib v13 마이그레이션)의 직접적인 필요 사항이다 — v13 은 ESM-only 의존(otplib, @otplib/*, @scure/base, @noble/hashes)을 끌어들이므로 범위 내.
- **제안**: 이상 없음. 의도된 변경.

### [INFO] 파일 4 — backend/package-lock.json: `uglify-js` 의 `"dev": true` 제거

- **위치**: `codebase/backend/package-lock.json` 중 `node_modules/uglify-js` 엔트리
- **상세**: 기존 `"dev": true` 플래그가 제거되었다(`optional: true` 는 유지). 이는 `npm install` 재실행 시 lockfile regeneration 의 부수적 결과로 보인다 — dep 트리 변경(`otplib v13`, `@types/node ^24`)이 npm 의 dependency resolution 을 전면 재실행시켜 부수적으로 일부 항목의 `dev` 플래그 표시가 변경된 것. `uglify-js` 자체는 optional 이므로 런타임 동작 영향 없음.
- **제안**: npm lockfile 자동 생성 결과로 허용 가능. 실제 설치 동작(optional + dev)이 크게 다르지 않으므로 LOW 위험.

### [INFO] 파일 4 — backend/package-lock.json: `@nestjs-modules/mailer` 하위 chokidar 관련 잔류 패키지 제거

- **위치**: `node_modules/@nestjs-modules/mailer/node_modules/{chokidar, glob-parent, readdirp}` 제거
- **상세**: `npm install` 재실행 중 npm 이 중복 내장 패키지를 상위로 호이스팅(dedup)하거나 버전 해소 결과가 달라져 lockfile 에서 사라진 것. chokidar 는 `@nestjs-modules/mailer` 의 optional+peer 의존으로 실제 설치 여부에 영향 없음.
- **제안**: lockfile 자동 정리. 범위 내.

### [INFO] 파일 8 — auth.service.spec.ts: eslint 자동 정리 (stale disable directive + cast 제거)

- **위치**: `codebase/backend/src/modules/auth/auth.service.spec.ts`, 두 곳
- **상세**: (1) `// eslint-disable-next-line @typescript-eslint/no-unused-vars` 제거 — commit `82159a38`("style: eslint --fix 선반영") 메시지에 "stale disable directive 제거(reportUnusedDisableDirectives)" 로 명시. (2) `(sessionsService.revokeAllFamilies as jest.Mock).mock` → `sessionsService.revokeAllFamilies.mock` 단순화 — `revokeAllFamilies` 가 이미 `jest.Mocked<>` 타입이므로 cast 가 불필요해진 것. 두 변경 모두 m-9 dep 작업이 유발한 eslint 게이트 통과를 위한 incidental 정리이며, commit 메시지에 명시.
- **제안**: eslint 강제 게이트를 통과하기 위한 부수 정리로 허용 가능. 단, dep 작업 commit 과 분리된 별도 commit(`82159a38`)으로 이미 분리된 상태 — 범위 추적성 양호.

### [INFO] 파일 6, 7 — production-guards.spec.ts / production-guards.ts: Prettier 줄바꿈 포맷팅

- **위치**: `codebase/backend/src/common/config/production-guards.spec.ts` L522-526, `production-guards.ts` L549-552
- **상세**: 함수 인수가 80자 한도를 초과해 Prettier 가 멀티라인으로 내렸다. 의미적 변경 없음. commit `82159a38` 에 "prettier 줄바꿈"으로 명시.
- **제안**: eslint/prettier 게이트 강제 결과로 허용 가능. 실질 변경 없음.

### [WARNING] channel-web-chat/package-lock.json: lightningcss 신규 의존 패키지군 추가

- **위치**: `codebase/channel-web-chat/package-lock.json` 내 `lightningcss` 및 `lightningcss-{platform}-*` 패키지 전체 신규 추가
- **상세**: `@vitejs/plugin-react ^4→^6.0.1` 업그레이드가 vite ^8 을 peerDep 으로 요구하고, vite ^8 이 esbuild 대신 lightningcss 를 번들러로 전환한 것이 원인이다. `lightningcss` 및 플랫폼별 native binaries (~12 패키지)가 lockfile 에 추가됨. 이는 M-2 의 직접적 연쇄 효과이며 M-2 범위 내로 볼 수 있으나, **vite 메이저 업그레이드(v7→v8)의 묵시적 포함** 여부가 plan 에 명시되어 있지 않다는 점이 주목점이다.
  - `@vitejs/plugin-react ^6.0.1` 의 peerDeps 에 `vite: "^8.0.0"` 만 허용됨 — 이전 vite v4-v7 지원 제거됨.
  - channel-web-chat `package.json` 의 vite 직접 선언 버전 확인 필요(diff 에 미포함).
  - lightningcss native binary 는 `optional` 이므로 빌드 실패 위험은 낮으나, esbuild 에서 lightningcss 로의 번들러 전환은 CSS 처리 동작 차이를 낳을 수 있음.
- **제안**: M-2 의 downstream 결과로 기술적으로는 범위 내이나, vite 메이저 버전 업그레이드(`^7→^8`)가 묵시적으로 포함된 것이라면 plan 에 명시되어야 한다. TEST WORKFLOW(build PASS, cwc 188 pass)가 이미 통과했으므로 실제 동작 위험은 낮음.

### [INFO] channel-web-chat/package-lock.json: esbuild 전체 제거, rollup → rolldown/binding-* 전환

- **위치**: `codebase/channel-web-chat/package-lock.json`
- **상세**: `esbuild 0.27.7` 및 `@esbuild/*` 플랫폼 패키지 전체가 제거되고, `@rollup/rollup-*` 패키지가 `@rolldown/binding-*` (rolldown v1.0.3)으로 교체됨. 이는 vite ^8 이 rolldown(Rust 기반 번들러)을 기본 번들러로 채택한 결과다. M-2(vitejs/plugin-react ^6) 업그레이드의 연쇄 효과.
- **제안**: M-2 범위 내. build/test PASS 확인됨.

### [INFO] channel-web-chat/package-lock.json: @types/babel__* 타입 패키지 제거

- **위치**: `node_modules/@types/babel__{core,generator,template,traverse}` 제거
- **상세**: `@vitejs/plugin-react v6` 이 babel transform 경로를 제거하고 rolldown native JSX transform 을 채택해 babel 관련 타입 패키지가 불필요해진 결과. M-2 범위 내.
- **제안**: 허용 가능.

### [INFO] channel-web-chat/package-lock.json: jsdom v25→v29 의존 트리 변경

- **위치**: `codebase/channel-web-chat/package-lock.json`
- **상세**: `jsdom ^29.0.1` 업그레이드가 대규모 의존 트리 변경을 수반함 — `@asamuzakjp/*` 신규 패키지 추가, `cssstyle` 제거 후 `css-tree` 신규 추가, `data-urls`, `html-encoding-sniffer`, `whatwg-url`, `entities` 메이저 버전 업그레이드. 이는 M-2 범위 내의 예상된 변경.
- **제안**: 허용 가능.

---

## 요약

전체 변경은 plan `07-dependency-residual.md` 에 명시된 7가지 작업 항목(M-2, M-4, m-1/m-8, m-2, m-6, m-4(spec), m-9)을 충실히 이행하고 있다. 소스 코드 변경(totp.service.ts, totp.service.spec.ts, jest.config.ts, package.json, PROJECT.md, README.md)은 모두 의도된 범위 내에 있으며, auth.service.spec.ts와 production-guards.{ts,spec.ts}의 eslint/prettier 정리는 eslint 게이트 강제의 incidental 결과로 별도 commit 에 분리돼 추적성이 양호하다. 한 가지 주목할 점은 `@vitejs/plugin-react ^6.0.1` 업그레이드가 vite ^8 요구를 수반하며 esbuild→rolldown 번들러 전환 및 lightningcss 신규 도입을 묵시적으로 동반했다는 것인데, TEST WORKFLOW(build+e2e PASS)가 이를 검증했으므로 실제 위험은 낮다. lockfile 의 대규모 변경(backend `uglify-js` dev 플래그, chokidar 호이스팅 해소, channel-web-chat 번들러 교체)은 모두 `npm install` 재실행의 자동 결과이며 범위를 벗어난 의도적 수정이 아니다.

## 위험도

LOW
