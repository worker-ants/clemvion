# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(둘 다 blocking 아님: npm 스크립트 텍스트 자체를 지키는 자동 가드 부재, plan 백로그 항목의 "뿐이다" 열거 불완전). 14명 reviewer 전원 실행·전문 확보(누락 없음, forced 8명 전원 결과 확보됨) — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | npm 스크립트 텍스트(jest 호출 프리픽스) 자체를 검증하는 자동 회귀 가드가 없다 — 신규 `esm-native-load.spec.ts`는 `jest.config.ts`/`test/jest-e2e.json`의 **config 값** 정합만 지키고, 이번 PR이 실제로 고친 결함(`test:debug`가 `test`/`test:watch`/`test:cov`/`test:e2e`와 다른 jest 진입점 경로를 쓰던 **scripts 텍스트** 드리프트)과 같은 클래스가 재발해도 잡지 못한다. `test:cov`·`test:watch`·`test:debug`는 CI(`test-stages.sh`/workflows/Makefile) 어디서도 실행되지 않아(grep 매치 0) 재발해도 사람이 로컬에서 우연히 발견할 때까지 방치된다(실제로 2026-03-30 scaffold 이후 오래 방치됐던 이력 있음) | `codebase/backend/package.json` (`scripts.test:debug`/`test:watch`/`test:cov`), `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` | `esm-native-load.spec.ts` 옆(또는 별도 repo-guard)에 `package.json`의 jest 관련 5개 스크립트가 동일한 `--experimental-vm-modules` 프리픽스·`./node_modules/jest/bin/jest.js` 진입점을 공유하는지 정적으로 assert하는 테스트를 추가 |
| 2 | Documentation | 신규 plan 백로그 항목의 "실측 목록은 …뿐이다"라는 완전성 주장이 거짓 — 실제 `frontend-checks.yml` pathspec에는 서술된 8개 외에 `frontend-checks.yml`(자기 자신)·`scripts/_typecheck_ratchet.py`·`scripts/check-frontend-typecheck-ratchet.py`·`scripts/frontend-typecheck-baseline.json` 4개가 더 있다. 이번 결론(plan/spec-only PR이 이 잡을 트리거 못함) 자체는 안 바뀌지만, 목록을 다른 목적(이 잡이 무엇에 반응하는지)으로 재사용할 다음 사람에게는 거짓 정보가 된다 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5085` | "뿐이다"를 실제 8+4=12개 전체로 갱신하거나, 완전성을 주장하지 않는 표현("다음을 포함해 …이 있으나 `plan/**`·`spec/**`는 없다")으로 낮출 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope/Architecture/Performance 등 다수 | 39개 변경 파일 중 실질 코드/설정 변경은 4~5개뿐(`jest.config.ts`·`package.json`(scripts)·`test/jest-e2e.json`·신규 `esm-native-load.spec.ts`·`PROJECT.md`)이고, 나머지는 plan 문서(신규 2건+백로그 1건 등재)와 1라운드 리뷰/consistency 산출물(`review/code/2026/09/24/14_24_10/**`, `review/consistency/2026/09/24/{12_57_36,13_55_20}/**`) 커밋이다 — 저장소 절차(impl-prep/impl-done, 리뷰 산출물 커밋 규약)의 정규 부산물이며 스코프 이탈 아님 | 전체 diff | 없음 |
| 2 | Requirement/Documentation/Testing/Dependency/Architecture/Maintainability/Side_effect | 1라운드(`14_24_10`) Critical 1건(plan `worktree:` legacy placeholder)과 Warning 3건(`test:debug` SyntaxError, `jest.config.ts` stale docstring, 미커밋 consistency 산출물 참조)이 이번 diff에서 실제로 조치됐음을 각 reviewer가 파일을 직접 열어 재확인(재발 없음). `test:debug`가 pnpm bin shim을 `node`로 직접 실행해 죽던 문제가 5개 스크립트 전부 `./node_modules/jest/bin/jest.js` 통일로 해소됨을 독립 재현(testing.md)까지 완료 | `codebase/backend/package.json:22-26`, `codebase/backend/jest.config.ts:3-11`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` | 없음 |
| 3 | Testing | 신규 가드의 canary가 `uuid`(downlevel 가능한 ESM)라, 이 마이그레이션의 진짜 목적인 `@nestjs/typeorm@12`류 `import.meta.url`(CJS downlevel 원리적 불가능) 케이스는 가드가 그린이어도 실제로는 미검증 — plan 문서는 이 한계를 인지하고 있으나 스펙 자체만 봐서는 드러나지 않음 | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:4,30-33`, `plan/in-progress/jest-esm-native-load.md` | Blocking 아님. `nestjs-v12-coordinated-upgrade.md` §B에 "이 가드가 초록이어도 import.meta.url 케이스는 별도 재현 확인할 것" 한 줄 추가 권장 |
| 4 | Side_effect | `--experimental-vm-modules` 플래그는 CLI 인자라 `jest.config.ts`(항상 적용)와 달리 5개 npm script 문자열에만 존재 — 이 스크립트들을 우회하는 호출(IDE 러너의 자체 jest 커맨드라인, `npx jest` 직접 실행 등)은 이 PR의 핵심 불변식 밖에 남는다. CI/e2e는 전부 스크립트를 경유해 실측 확인상 안전 | `codebase/backend/package.json:22-26` vs `codebase/backend/jest.config.ts:41` | Blocking 아님. README/CONTRIBUTING에 "개별 스펙은 `pnpm test -- -t <pattern>`으로, jest 바이너리 직접 호출 금지" 한 줄 권장 |
| 5 | Maintainability/Architecture | 5개 npm test 스크립트가 15단어 접두어(`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`)를 그대로 복제 — 이 PR이 걷어낸 "손으로 병렬 유지되는 목록은 갈라진다" 패턴이 스크립트 레이어에서 재현된 형태이나, 이미 1라운드에서 지적되고 RESOLUTION에서 "5곳 규모에서는 단일화가 오히려 간접층" 근거로 명시적으로 defer됨(신규 지적 아님) | `codebase/backend/package.json:22-26` | 현 규모에서 조치 불필요. 접두어가 늘거나 플래그가 바뀌면 재검토 |
| 6 | Security/Dependency/API_contract/User_guide_sync | 향후 NestJS 12 동반 업그레이드가 안고 있는 reflection 기반 인가 fail-open 위험(`RolesGuard`/`@WorkspaceId()`이 Nest 비공개 API에 의존)은 별도 plan(`nestjs-v12-coordinated-upgrade.md` §C)으로 명시적으로 격리·추적 중이며, 이번 diff는 `@nestjs/*` 버전을 전혀 바꾸지 않아(dependencies/devDependencies 무변경) 실현되지 않음 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C | 후속 업그레이드 PR 착수 시 §C 체크리스트 실행 확인 |
| 7 | Dependency | jest 테스트 인프라가 SemVer로 보증되지 않는 jest-runtime 내부 probe(`hasAsyncGraph`)와 Node 실험적 플래그(`--experimental-vm-modules`)에 결합됨 — 저자가 판별 실험(플래그 제거→RED)과 뮤테이션 4종(M1~M4)으로 이미 실측·가드했고, 회귀 시 조용한 손상이 아니라 전체 로드 실패로 즉시 드러나는 성질이라 실질 위험 낮음 | `codebase/backend/package.json:22-26`, `codebase/backend/jest.config.ts:26-32` | 없음(향후 jest minor 업그레이드 시 가드 재확인 정도) |
| 8 | Architecture/Dependency | 손-유지 `transformIgnorePatterns` 허용목록(unit 6개 vs e2e 3개, 이미 상호 발산) 제거 → jest 기본값 + 네이티브 ESM 로드 전환은 OCP 관점 실질 개선이며, 신규 repo-guard가 두 설정 파일 간 재발산을 정적으로 봉인 | `codebase/backend/jest.config.ts:41`, `codebase/backend/test/jest-e2e.json:9` | 없음(긍정적 관찰) |
| 9 | Architecture/Requirement/Maintainability | 신규 가드가 `repo-guards/__tests__/` 지배적 관례(`<name>-guard.ts`+`<name>.spec.ts` 분리)를 따르지 않고 spec에 로직 인라인 — 다만 검증 내용이 단순해 분리 불필요하고, 기존 선례(`workspace-roles-attachment.spec.ts`)와 일치해 컨벤션 위반 아님 | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` | 없음 |
| 10 | Documentation | CHANGELOG 미갱신 판정(빌드/테스트 tooling 변경, 제품 동작/배포 의존성 불변) 근거를 직접 대조해 타당함 확인. 다만 이 판정 기준 자체가 `PROJECT.md` 매핑 표에는 반영되지 않아 유사 사례 재발 시 판단을 처음부터 반복해야 함 | `review/code/2026/09/24/14_24_10/RESOLUTION.md`, `PROJECT.md` | Blocking 아님. 매핑 표에 "빌드/테스트 tooling 변경(제품 동작·배포 의존성 불변)은 CHANGELOG 대상 아님" 한 줄 추가 권장 |
| 11 | User_guide_sync | doc-sync-matrix 20개 change_type 전수 대조 결과 매칭 0건 — frontend/channel-web-chat/packages/expression-engine/spec 어느 영역도 건드리지 않는 순수 backend jest tooling 변경 | doc-sync-matrix 전체 | 없음 |
| 12 | Database/Concurrency/API_contract | 스키마·쿼리·트랜잭션·공유자원·락·API 계약(컨트롤러/DTO/라우트) 관련 코드 변경 0건 — 검토 대상 없음 | 해당 없음 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경은 테스트 러너 설정뿐, 시크릿/인증/인젝션 해당 없음 |
| performance | NONE | 프로덕션 런타임 무영향, 테스트 실행시간 20~28% 개선(plan 실측) |
| architecture | NONE | OCP 개선, 1라운드 WARNING 재발 없음 확인 |
| requirement | LOW | 1라운드 조치 전부 실제 반영 확인(직접 실행 검증 포함), spec 대상 없음 |
| scope | NONE | 39개 중 실질 변경 4개로 목적에 정확히 수렴, 동반 수정 근거 투명 |
| side_effect | LOW | `--experimental-vm-modules`가 script에만 존재해 우회 호출 시 불변식 밖(INFO) |
| maintainability | LOW | 1라운드 WARNING 2건 재발 없음, 스크립트 접두어 중복은 기 defer |
| testing | LOW | **WARNING 1건**: scripts 텍스트 자체를 지키는 자동 가드 부재 |
| documentation | LOW | **WARNING 1건**: 백로그 항목 "뿐이다" 열거 불완전(4개 누락) |
| dependency | LOW | 신규 의존성/버전 변경 없음, jest 내부 probe 결합은 이미 가드됨 |
| database | NONE | 해당 코드 없음 |
| concurrency | NONE | 해당 코드 없음 |
| api_contract | NONE | 해당 코드 없음 |
| user_guide_sync | NONE | doc-sync-matrix 매칭 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync — 검토 대상 코드/트리거 없음.

## 권장 조치사항

1. (선택) `esm-native-load.spec.ts` 옆에 `package.json`의 jest 관련 5개 스크립트가 동일 프리픽스·진입점을 공유하는지 정적으로 assert하는 테스트를 추가해, 이번 PR이 고친 `test:debug` 드리프트와 같은 클래스의 재발을 자동으로 잡는다(WARNING 1).
2. (선택) `plan/in-progress/spec-draft-nullable-notation-followups.md:5085`의 "실측 목록은 …뿐이다" 문장을 실제 12개 전체로 갱신하거나 완전성 주장을 낮춘다(WARNING 2).
3. Blocking 사유 없음 — 두 WARNING 모두 이번 diff의 핵심 변경(jest ESM 네이티브 로드 전환)을 되돌릴 근거가 아니며, 후속 개선 항목으로 충분.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미제공, prompt에 `routing: skipped`만 명시). 전체 14명 reviewer 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success·전문 확보)
- **제외**: 없음
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — prompt에 "forced 전원 결과 확보됨" 명시, 실제로 8명 전원의 전문이 인라인으로 확보되어 화이트리스트 미이행 없음.
