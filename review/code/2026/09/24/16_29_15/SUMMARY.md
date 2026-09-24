# Code Review 통합 보고서

## 전체 위험도

**LOW** — 4라운드(deps-nestjs12-ci-4a7b2e) 최종 확인. Critical 0건, Warning 2건(둘 다 blocking 아님). 14개 reviewer 전원(라우팅 미사용으로 전체 실행, forced 8명 포함) 결과가 인라인 전문으로 모두 확보되었고 누락 없음 — forced 화이트리스트(dependency·documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨.

실질 코드/설정 변경은 `codebase/backend/jest.config.ts`·`codebase/backend/package.json`(scripts)·`codebase/backend/test/jest-e2e.json`·`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 4개 파일뿐이며, 나머지는 `PROJECT.md` 정책 문단, plan 문서 3건, 그리고 1~3라운드 리뷰/consistency 산출물이다. 14개 reviewer 중 10개(security·performance·architecture·requirement·scope·database·concurrency·api_contract·user_guide_sync·maintainability)는 NONE, 2개(side_effect·dependency)는 LOW(INFO만), 2개(testing·documentation)는 LOW 이면서 각각 WARNING 1건을 냈다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | census 가드(`esm-native-load.spec.ts`)가 `--experimental-vm-modules`↔진입점 순서만 검사하고, `test:debug` 스크립트의 동종 위치-의존 옵션(`-r tsconfig-paths/register`, `-r ts-node/register`)의 위치는 검사하지 않는다. 이 두 옵션을 진입점 뒤로 옮기면 node 대신 jest 가 인자로 받아 `Unrecognized option "r"` 로 즉시 실패함을 독립 재현으로 확인(`--experimental-vm-modules` 위치 오류와 바이트 단위로 동일한 실패 모양). `test:debug` 는 CI·Makefile·`.claude/test-stages.sh`·docker-compose 어디에서도 실행되지 않아, 향후 이 옵션들이 실수로 밀려도 가드도 CI 도 침묵할 조건을 갖춘다(1라운드가 발견한 "아무도 모르게 깨진 test:debug" 패턴 재현 가능성) | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (61~106행대, `FLAG`/`ENTRY` 비교 블록); 대조 대상 `codebase/backend/package.json` `scripts.test:debug` | census 루프를 스크립트별 옵션 목록(`NODE_ARGS_BY_SCRIPT`)으로 일반화하거나, 최소한 `test:debug` 전용으로 `-r` 두 옵션의 순서 단언을 추가. "`-r ts-node/register` 를 진입점 뒤로 이동" 뮤턴트로 먼저 RED 확인 |
| 2 | documentation | plan 문서(`jest-esm-native-load.md`)의 「뮤테이션 — 넷 다 예측=실측」 표가 3라운드 커밋(`a49b62108`)에서 추가된 뮤턴트 2건(M8 순서 위반, M9 존재 위반)을 반영하지 않음. 3라운드 수정은 `esm-native-load.spec.ts` 한 파일만 바꿨고 plan 문서는 그 이후 갱신되지 않아, plan만 보면 가드가 실제로 지키는 불변식 수를 과소평가하게 됨 | `plan/in-progress/jest-esm-native-load.md:113-122` (뮤테이션 표); 대조 커밋 `a49b62108` | 표에 M8·M9 행을 추가하고 "넷 다"를 "여섯 다"로 정정, 3라운드 자체 리뷰의 후속 조치임을 한 줄 명시. `plan/complete/` 이동 전에 처리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / architecture / api_contract | 후속 `@nestjs/typeorm@12` 등 NestJS 12 동반 업그레이드가 `RolesGuard`/`@WorkspaceId()` reflection 기반 인가 가드의 fail-open 회귀 위험을 안고 있음을 별도 plan(§C)이 이미 선결 조건으로 명문화. 이번 diff 범위에서는 위험이 실현되지 않음 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B·§C | 후속 PR 착수 시 §C 체크리스트(부트 캐너리 회귀 비교, guard spec 경로 확인) 수행 여부 재확인 |
| 2 | side_effect / testing | 가드가 덮지 못하는 우회 경로: 플래그가 5개 npm script 문자열에만 존재해 IDE 테스트 러너·`npx jest` 직접 호출은 불변식 밖. 개발자가 스펙 헤더에 이미 명시, CI·Makefile·docker-compose·test-stages.sh 전부 npm script 경유함을 실측 재확인 | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 헤더 주석 | 없음 — 이미 문서화된 수용 리스크 |
| 3 | performance / side_effect | `--experimental-vm-modules` 상시 활성화로 jest 워커마다 `ExperimentalWarning` stderr 1줄 증가(11코어 실측 9줄). plan 문서가 신호 가시성 위해 의도적으로 유지 | `codebase/backend/package.json` scripts 5곳 | 없음 — CI 로그 자동 소비 스크립트가 생기면 필터링 대상 고려 |
| 4 | architecture | 신규 repo-guard(`esm-native-load.spec.ts`)가 `src/` 트리에서 루트 `package.json`/`test/jest-e2e.json` 경로를 하드코딩해 읽는 역방향 결합. 기존 `production-build-devdep-guard.ts` 등과 동일 관례, 신규 리스크 아님 | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:61-67, 108-112` | 없음 |
| 5 | performance / architecture / documentation | `spec-draft-nullable-notation-followups.md` 에 신규 백로그 2건 추가(docs 가드 트리거 pathspec 갭, CHANGELOG "해당 없음" 판정 기준 부재) — 이번 PR 결함이 아니라 별도 트래킹으로 이미 적절히 격리 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 없음 — 이미 등재됨 |
| 6 | dependency | 손 유지 ESM allowlist(unit/e2e 간 이미 발산돼 있던)를 제거하고 기본값+네이티브 로드로 전환해 drift 원천 해소. `import.meta.url` 계열(downlevel 불가) 의존성도 수용 가능해짐 | `codebase/backend/jest.config.ts`, `codebase/backend/test/jest-e2e.json` | 없음 — 개선 |
| 7 | dependency | 테스트 실행이 SemVer 로 보증되지 않는 Node 실험 플래그 + jest 내부 probe 에 결합. CI Node 버전 핀 정합·뮤테이션 4종 가드로 완화됨(회귀 시 조용한 손상이 아니라 즉시 전체 실패) | `codebase/backend/package.json`, `jest.config.ts` | 없음 — blocking 아님 |
| 8 | requirement / architecture | `test:debug` 는 순서 텍스트만 정적 검증되고 실제 실행(디버거 attach) 경로는 어떤 자동화도 밟지 않음을 스펙 헤더가 스스로 명시. 보증 경계를 정직하게 좁혀 문서화 | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (57~60행) | 없음 |
| 9 | maintainability | 3라운드(`eeffa4963`) 이후 실질 코드/plan 8개 파일에 한 글자도 변경 없음(`git diff eeffa4963..HEAD` 로 직접 재확인). 새 등장 67개 파일은 전부 1~3라운드 자신의 review 산출물 | `review/code/2026/09/24/{14_24_10,15_26_17,16_02_28}/**` 등 | 없음 |

## 실질 발견 없음으로 분류된 확인 항목

- database, concurrency, api_contract, user_guide_sync 4개 reviewer는 "검토 대상 코드 없음/매칭 없음"으로 명시적 결론(위험도 NONE), 별도 INFO 항목화 불요.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인가 위험 없음. 후속 NestJS12 업그레이드 fail-open 위험은 plan §C로 선결 격리(INFO) |
| performance | NONE | 프로덕션 런타임 영향 없음, jest 실행시간 20~28% 개선(단독 기준) |
| architecture | NONE | 순환 의존·레이어 위반 없음, OCP 관점 개선(allowlist 폐지) |
| requirement | NONE | 3파일 정합·CI 진입점 우회 없음, TODO/FIXME 0건 |
| scope | NONE | 4라운드 누적 delta 모두 PR 목적/강제 리뷰 절차에 수렴, 범위 이탈 없음 |
| side_effect | LOW | 실험 플래그 전역 적용·transformIgnorePatterns 폐지 등 INFO 다수, blocking 없음 |
| maintainability | NONE | 3라운드 이후 실질 코드 변경 0, 기존 조치 전부 유지 확인 |
| testing | LOW | **WARNING**: census 가드가 `test:debug` 의 `-r` 옵션 위치는 검사 안 함(실측 재현) |
| documentation | LOW | **WARNING**: plan 뮤테이션 표가 M8·M9 반영 안 함 |
| dependency | LOW | 신규 의존성/버전 변경 없음, SemVer 미보증 플래그 결합은 가드로 완화 |
| database | NONE | 검토 대상 DB 코드 없음 |
| concurrency | NONE | 검토 대상 동시성 코드 없음 |
| api_contract | NONE | 검토 대상 API 계약 코드 없음 |
| user_guide_sync | NONE | doc-sync-matrix 24개 trigger 전수 대조, 매칭 없음 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync (검토 대상 코드/문서 자체가 없어 "해당 없음"으로 명시적 결론)

## 권장 조치사항

1. **(WARNING #1)** `esm-native-load.spec.ts` 의 census 가드를 스크립트별 위치-의존 옵션 전체(`test:debug` 의 `-r tsconfig-paths/register`, `-r ts-node/register` 포함)로 일반화해, 이 PR 이 세 라운드에 걸쳐 반복 발견한 "존재 검사 ≠ 정합 검사" 결함 클래스가 가드 자신의 스코프 경계에서 다시 열리는 것을 막을 것.
2. **(WARNING #2)** `plan/in-progress/jest-esm-native-load.md` 의 뮤테이션 표에 3라운드에서 추가된 M8·M9(순서/존재 검증)를 반영해 "넷 다"→"여섯 다"로 정정. `plan/complete/` 이동 전 처리 권장.
3. (INFO, 후속 트래킹) `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C 의 reflection 기반 인가 가드 fail-open 회귀 체크리스트는 후속 PR 착수 시 반드시 수행할 것 — 이번 PR 스코프는 아님.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용(사유 미제공, prompt 상 `routing: skipped`) — **전체 14개 reviewer 실행**.
- **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — forced 전원 결과 확보됨(누락 없음).
- **제외**: 없음(routing 미사용이므로 router 에 의한 제외 자체가 없음).
