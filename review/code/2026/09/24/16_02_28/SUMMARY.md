# Code Review 통합 보고서

## 전체 위험도

**LOW** — 실질 코드 변경은 backend Jest 테스트 러너를 손유지 ESM allowlist에서 `node --experimental-vm-modules` 네이티브 로드로 전환하는 4개 파일뿐이며, 프로덕션 런타임·인증/인가·API 계약·DB·의존성 버전에는 영향이 없다. Critical 0건, Warning 1건(신규 가드 테스트 자체의 검증 갭)만 발견됐다. 참고: `routing=skipped`(라우터 미사용, 전체 14명 실행)이며 router_safety 강제 포함 대상 8명(`dependency, documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원의 결과가 확보되어 있어 강제 화이트리스트 미이행 사례는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 census 가드(`esm-native-load.spec.ts`)가 `--experimental-vm-modules` 플래그와 진입점 경로가 스크립트 문자열에 **둘 다 포함**되는지만(`toContain`) 검사하고 **순서**는 검사하지 않는다. 플래그를 진입점 뒤로 옮기면 Node 가 아니라 jest 의 CLI 인자로 전달되어 무력화되는데(실측: `Unrecognized CLI Parameter: Unrecognized option "experimental-vm-modules"`), 이 회귀는 CI·Makefile·`.claude/test-stages.sh`·docker-compose 어디서도 실행되지 않는 `test:cov`/`test:watch`/`test:debug` 세 스크립트에서는 가드도 CI도 조용히 통과시킨다. `test`/`test:e2e` 는 CI가 실제 실행하므로 즉시 노출되어 blocking 은 아니다. | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:83-85` | `toContain` 대신 토큰 분리 후 `indexOf` 로 플래그가 진입점보다 앞에 오는지(`flagIdx < entryIdx`)를 단언하도록 교체. 뮤턴트로 "플래그를 진입점 뒤로 이동"(M8)을 추가해 RED 확인 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope/documentation | `PROJECT.md` 정책 문단의 자기-반증형 소정정: 원문 문장을 삭제 없이 유지하고 실측 각주를 이어붙인 방식이 조건 4(국소화)는 지켰으나, CLAUDE.md 가 요구하는 "원문 취소선" 형식은 문자 그대로 따르지 않았다(scope 관점 지적). documentation 은 이를 "반증이 아니라 사실 보강"으로 보아 취소선 요구 대상이 아니라고 판단 — 두 관점이 갈리므로 참고용으로 병기 | `PROJECT.md`(버전·도구 정책, "테스트 프레임워크 이원화" 항목) | 필수는 아니나, 원문에 `~~...~~` 를 씌워 "이미 발화·처리된 조건"임을 시각적으로 표시하면 오독 여지가 줄어듦 |
| 2 | requirement | `package.json` 의 `uuid: ^14.0.1` 선언과 실제 설치본(13.0.2, 워크스페이스 `overrides` 강제)이 불일치. 이 PR 과 무관한 pre-existing override이며 plan/가드 스펙의 실측치("uuid@13.0.2")와는 정합하지만, 표시 범위만 보면 오독 여지가 있음 | `codebase/backend/package.json:91` vs `pnpm-workspace.yaml:49` | 조치 불요(스코프 밖). override 해제 시 canary 가정 재확인 필요성만 기록 |
| 3 | side_effect/dependency/performance | `--experimental-vm-modules` 게이트가 SemVer 로 보증되지 않는 Node 내부 probe(`vm.SourceTextModule.prototype.hasAsyncGraph`)에 결합되어 있어, 향후 Node 버전에서 해당 내부 API 가 바뀌면 5개 npm script 가 동시에 깨질 수 있음. 이미 plan 문서가 실측·트레이드오프로 기록했고, 회귀 시 로드 단계 전체 실패라 은닉 가능성은 낮음 | `codebase/backend/jest.config.ts`(주석), `codebase/backend/package.json:22-26` | 조치 불요(이미 문서화됨). 재발 시 진단을 위해 `globalSetup` 에 게이트 존재 확인 1줄 가드 고려 가능(낮은 우선순위) |
| 4 | side_effect/testing/documentation | 신규 가드는 `package.json` script 를 우회하는 IDE 러너·`npx jest` 직접 실행까지는 보증하지 않음 — 가드 스펙 자신이 이 경계를 명시적으로 인정 | `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 헤더 주석 | 조치 불요 — 참고용 |
| 5 | maintainability | ESM 네이티브 로드 메커니즘(허용목록 제거+플래그, 게이트 정체, "두 변경은 한 쌍") 설명이 `PROJECT.md`·`jest.config.ts`·`esm-native-load.spec.ts`·plan 문서 4곳에 중복 서술되어 있어 향후 메커니즘 변경 시 다중 갱신 부담 존재 | `PROJECT.md`, `codebase/backend/jest.config.ts:19-40`, `esm-native-load.spec.ts:6-23`, `plan/in-progress/jest-esm-native-load.md` | 조치 불요. 차기 변경 시 `jest.config.ts` 를 SoT 로 두고 나머지는 참조로 축약 고려 |
| 6 | maintainability | `PROJECT.md` 정책 항목이 정책 문장과 개별 발동 사건 서술을 한 불릿에 계속 이어붙이는 구조라 changelog 처럼 자랄 위험 | `PROJECT.md`("테스트 프레임워크 이원화 (정책)" 항목) | 조치 불요. 유사 사례 반복 시 발동 이력을 별도 섹션/각주로 분리 고려 |
| 7 | maintainability/scope | `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이번 PR로 +53줄 추가되며 5,100줄을 넘는 단일 누적 백로그 파일로 계속 확장. 파일명("nullable 표기 후속 3건")이 실제 내용(무관한 다주제 백로그)을 더는 반영 못함 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요(기존 관행). 규모 문제가 되면 완료 항목 아카이브 분리 또는 파일 분할/개명 고려 |
| 8 | testing | `import.meta.url` 케이스(예: 향후 `@nestjs/typeorm@12`)는 이 가드의 canary(`uuid`, CJS downlevel 가능)로 커버되지 않음 — 1·2라운드에서 이미 추적·합의된 사항, 신규 갭 아님 | `esm-native-load.spec.ts:4`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B | 조치 불요 — 확인만 |
| 9 | requirement | 이 변경 영역(jest 모듈 로딩 설정)은 `spec/` grep 0건 — spec 누락이 아니라 설계상 `PROJECT.md`/plan 문서가 정본인 영역이며 코드와 line-level 로 정합함을 확인 | 해당 없음 | 조치 불요 |
| 10 | architecture | 신규 repo-guard(`esm-native-load.spec.ts`)가 `src/repo-guards` 트리에서 `test/jest-e2e.json`·`package.json` 경로에 의존하는 것은 통상 레이어 분리 기준으로는 역방향이나, 이 저장소의 기존 확립된 관례(`production-build-devdep-guard.ts` 등 30여 개 선례)와 일치해 신규 리스크 아님 | `esm-native-load.spec.ts` | 조치 불요 |
| 11 | architecture | 5개 npm 스크립트의 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 접두어 중복은 1·2라운드에서 이미 검토·보류(defer)된 트레이드오프이며, 신규 가드가 드리프트만은 정적으로 잡아 완화됨 | `codebase/backend/package.json:22-26` | 조치 불요 — 기존 판단 유지 |
| 12 | 전 라운드 재확인 (architecture/dependency/maintainability) | 1라운드 Critical(plan `worktree` placeholder), 1·2라운드 Warning(`test:debug` 진입점 드리프트, `jest.config.ts` stale docstring)이 현재 워킹트리에서 실제로 조치된 채 유지됨을 직접 파일 대조로 재확인 — 재발 없음 | `codebase/backend/package.json:22-26`, `codebase/backend/jest.config.ts:1-11`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` | 조치 불요 — 확인용 |
| 13 | performance | 테스트 실행 시간 변화(backend 단독 20~28% 개선, wrapper 기준 무의미)를 plan 문서가 정직하게 실측·자기정정한 이력 확인 | `plan/in-progress/jest-esm-native-load.md` §C | 조치 불요 |
| 14 | security | `nestjs-v12-coordinated-upgrade.md` 가 향후 NestJS v12 동반 업그레이드 시 `RolesGuard`/`@WorkspaceId()` 가 의존하는 Nest 비공개 API 파손으로 인한 fail-open(인가 누락) 가능성을 선제적으로 문서화 — 이번 PR 코드의 결함은 아니고 후속 작업을 위한 예방 문서 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` | 조치 불요(이번 스코프 밖). 후속 PR 착수 시 §B~D 체크리스트 이행 여부가 그 PR 의 리뷰 포인트 |
| 15 | documentation | README/CHANGELOG 갱신 불요 판정에 근거 있음(스크립트 이름 불변, `PROJECT.md` 매핑 표에 해당 행 없음). 그 판정 기준 자체의 문서화 부재는 이미 `spec-draft-nullable-notation-followups.md` 에 별도 등재되어 있어 중복 지적 아님 | `codebase/backend/README.md:21-23`, `PROJECT.md`(변경 유형→갱신 위치 매핑) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 코드 변경 4건 모두 보안 이슈 없음; v12 업그레이드 fail-open 위험은 사전 문서화(현재 결함 아님) |
| performance | NONE | 순수 테스트 러너 설정 변경, 런타임 영향 없음; 테스트 시간 개선 실측·자기정정 확인 |
| architecture | NONE | 1·2라운드 Critical/Warning 조치 유지 재확인, 신규 결함 없음 |
| requirement | NONE | 요구사항-구현-plan 정합, 가드 4/4 PASS 독립 재현. uuid 버전 표시 불일치는 PR 무관 |
| scope | NONE | 단일 목적(dependabot 차단 해소)에 정확히 수렴, 스코프 이탈 없음 |
| side_effect | LOW | 부작용 없음 확인(mock/spy 충돌 0건, CI 경로 전수 확인); Node 실험 플래그 결합은 기존 인지 트레이드오프 |
| maintainability | LOW | 신규 결함 없음; 문서 중복 서술·정책 문단 비대화·백로그 파일 확장은 관찰용 |
| testing | LOW | **WARNING 1건** — census 가드가 플래그 순서(위치) 미검증, 미실행 스크립트 3개에서 조용히 통과 가능 |
| documentation | NONE | 문서-코드 정합 우수, 자체 보증 경계 명시, 신규 결함 없음 |
| dependency | LOW | 신규 의존성/버전/lockfile 변경 0건; Node 실험 플래그 결합은 실측·가드로 완화됨 |
| database | NONE | 해당 DB 코드 없음 |
| concurrency | NONE | 해당 동시성 코드 없음 |
| api_contract | NONE | 해당 API 계약 코드 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21행 중 매칭 trigger 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync — 모두 "해당 없음"/매칭 0건으로 검토 대상 코드 자체가 없었음.

## 권장 조치사항

1. (WARNING, 선택) `esm-native-load.spec.ts:83-85` 의 `toContain` 단언을 플래그-진입점 순서를 강제하는 단언으로 교체하고, "플래그를 진입점 뒤로 이동"하는 뮤턴트(M8)로 RED 를 확인한다. CI가 실행하지 않는 `test:cov`/`test:watch`/`test:debug` 세 스크립트에서만 발생 가능한 조용한 회귀이므로 blocking 은 아니나, 이 가드 자체가 막으려던 결함 클래스("존재 검사 ≠ 정합 검사")의 재현이라 우선순위 있게 권장.
2. (INFO, 선택) `PROJECT.md` 자기-반증형 소정정 문장에 취소선(`~~...~~`)을 추가해 형식 요건을 문자 그대로 맞추는 것을 고려한다(scope 지적, blocking 아님).
3. 그 외 INFO 항목(문서 중복 서술, 백로그 파일 비대화, uuid 버전 표시 등)은 즉각 조치 불필요 — 향후 규모가 커지거나 관련 작업(NestJS v12 범프) 착수 시 재검토 대상으로 각 plan 문서가 이미 추적 중이다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14명 reviewer 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — 전원 결과 확보됨(누락 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |
