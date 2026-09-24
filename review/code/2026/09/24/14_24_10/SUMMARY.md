# Code Review 통합 보고서

## 전체 위험도

**HIGH** — Critical 1건이 실제 build guard(vitest `plan-frontmatter.test.ts`)를 깨는 것을 requirement-reviewer 가 로컬 재현으로 확인했다. 다만 이 Critical 은 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 의 frontmatter 한 줄에 국한되며 프로덕션 런타임·보안·동시성에는 영향이 없다(테스트 하니스 설정 변경 PR). Warning 3건은 모두 병합을 막을 수준은 아니나 방치 시 다음 세션에 혼선을 준다.

**커버리지 경고**: 이 세션에서 실행 시도된 reviewer 는 14개(`_retry_state.json` `subagent_invocations`)이나, 실제 output 파일이 존재하는 것은 11개(`architecture`·`concurrency`·`dependency`·`documentation`·`maintainability`·`performance`·`requirement`·`scope`·`security`·`side_effect`·`testing`)뿐이다. **`database`·`api_contract`·`user_guide_sync` 3개는 output 파일이 디스크에 없어 전문을 확보하지 못했다** — 이번 PR 이 스키마/DB 마이그레이션이나 공개 API 계약을 건드리지 않는 tooling-only 변경으로 보이긴 하나, 이 세 관점의 Critical 유무는 이 요약에 반영되지 않았을 수 있음을 명시한다(재시도 필요).

- Critical: 1건
- Warning: 3건
- Info: 17건

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation | `worktree:` frontmatter 값이 저장소가 금지하는 legacy placeholder 패턴(`미정`·`착수 시`)이라 plan-lifecycle 의 `WORKTREE_PLACEHOLDER` 정규식에 매치되고, 실제 vitest guard(`plan-frontmatter.test.ts`)가 실패한다. **requirement-reviewer 가 로컬에서 해당 테스트를 직접 실행해 재현**(`FAIL ... worktree "(미정 — 착수 시 생성)" 는 placeholder`, 157건 중 1건만 실패). **documentation-reviewer 도 독립적으로 정규식 매치를 직접 대입해 `true` 확인**하며 같은 결론에 도달. 다른 미착수 stub 14개는 전부 정확한 관용구 `(unstarted)` 사용 중 — 이 파일만의 단순 실수. 부가 관찰(위험도 하향 근거 아님, requirement-reviewer): `.github/workflows/frontend-checks.yml` 의 `changes` 잡 pathspec 에 `plan/**` 가 없어 이 PR 의 CI 에서는 guard 스위트 자체가 no-op skip 되어 **이 Critical 이 자동으로 드러나지 않는다** — 별도 구조적 갭이나 이번 리뷰 스코프는 아님. | `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` | `worktree: (미정 — 착수 시 생성)` → `worktree: (unstarted)` 로 정정(다른 14개 stub 과 동일 관용구). |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / side_effect / testing (실제 실행 재현) vs maintainability (일관성 관점) — **dependency 는 반대 결론(INFO)** | `test:debug` 스크립트만 다른 4개(`test`/`test:watch`/`test:cov`/`test:e2e`)와 달리 pnpm 이 생성한 셸 스크립트(`node_modules/.bin/jest`, `#!/bin/sh`)를 `node` 에 직접 넘겨 즉시 `SyntaxError: missing ) after argument list` 로 죽는다. **architecture·side_effect·testing 세 reviewer 가 각각 독립적으로 `node node_modules/.bin/jest --version`(및 testing 은 test:debug 전체 커맨드 조합)을 직접 실행해 재현**했고, diff 이전 형태로도 동일 재현되어 **이 PR 이 만든 결함은 아니나 이 PR 이 정확히 이 줄을 손대고도 고치지 않았음**을 확인. plan 의 검증 체크리스트(lint/unit/build/e2e)는 `test:debug` 를 커버하지 않아 "구현 완료"로 체크됐지만 실제로는 미검증 상태. maintainability 는 같은 지점을 "5개 중 1곳만 다른 표기" 일관성 결여로 WARNING 처리. **반대 결론**: dependency-reviewer 는 "`.bin/jest` 심볼릭 링크가 동일 파일을 가리켜 기능적으로 동등, 실동작 리스크 없음"이라며 INFO 로 분류했으나, 이는 실행 검증 없이 내린 판단으로 보이며 3개 reviewer 의 실제 실행 재현(SyntaxError)과 정면으로 모순된다 — **실측 근거가 있는 쪽(재현된 실패)을 채택**한다. | `codebase/backend/package.json:25` | 다른 4개와 동일하게 `./node_modules/jest/bin/jest.js` 를 직접 가리키도록 통일(shim 파싱 버그 자체가 사라짐). 이 PR 스코프 밖으로 남긴다면 plan 에 "test:debug 는 사전 결함, 이번 검증 대상 아님"을 명시해 다음 사람이 "5곳 모두 검증됨"으로 오독하지 않게 할 것. |
| 2 | documentation | `jest.config.ts` 최상단 docstring 이 stale 해졌다. "JSON 은 주석을 못 달아서 이 파일에 non-obvious regex 에 대한 주석을 옮겨 적는다"고 서술하는데, 이번 diff 가 바로 그 non-obvious regex(`transformIgnorePatterns` allowlist)를 제거하고 기본값으로 되돌렸다 — 더 이상 존재하지 않는 이유만 남아 다음 독자가 "정규식이 단순해졌으니 package.json 으로 되돌려도 되나?"라고 오판할 소지. | `codebase/backend/jest.config.ts:3-9` | docstring 을 현재 목적(ESM 네이티브 로딩·forceExit·moduleNameMapper 등 근거 기록)에 맞게 갱신. |
| 3 | requirement (WARNING) vs scope (같은 사실을 INFO/관찰로만 기록) | 커밋되는 `nestjs-v12-coordinated-upgrade.md` §C 가 커밋되지 않은 `review/consistency/2026/09/24/12_57_36` 디렉터리(consistency-check W3)를 근거로 인용한다. requirement-reviewer 가 `git log --oneline -- review/consistency/2026/09/24/12_57_36` 로 빈 결과를 확인 — 이 워크트리에만 남은 untracked 잔여물이며 커밋되면 저장소에서 영구히 사라진다. 같은 plan 이 참조하는 다른 세션(`13_55_20`)은 실제로 같은 커밋에 포함되어 대조된다. scope-reviewer 도 동일 사실을 관측했으나 "Scope 결함이 아니고 완전성 관점의 관찰"이라며 INFO 로만 남김 — 추적성 단절이라는 실질적 리스크(향후 세션이 clone 된 저장소에서 W3 원문을 찾지 못함)를 반영해 여기서는 WARNING 을 유지한다. | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C | `12_57_36` 산출물을 커밋에 포함하거나, §C 본문에 W3 의 핵심 요지(reflection 캐너리가 부분 파손을 못 잡는다)를 인라인해 참조가 끊겨도 내용이 보존되게 할 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / dependency / maintainability | 손으로 유지하던 ESM `transformIgnorePatterns` allowlist 제거는 OCP 개선이며, 기존 unit(6개 패키지)/e2e(3개 패키지) 간 이미 존재하던 drift 도 함께 해소함 | `jest.config.ts:17-39`, `test/jest-e2e.json:9` | 없음(개선으로 판단) |
| 2 | architecture / dependency | 테스트 인프라 전체가 Node 실험 플래그(`--experimental-vm-modules`) 및 jest-runtime 내부 probe(`hasAsyncGraph`, SemVer 미보증)에 결합됨 — plan 에 이미 인지·문서화된 트레이드오프 | `package.json:22-26` | dependency 제안: `jest.config.ts` `globalSetup` 등에 probe 존재 여부 가드 1줄 추가해 "Node 버전 문제"로 오도되지 않게 fail-fast (blocking 아님) |
| 3 | architecture / scope | 작업 스코프 경계가 명확 — NestJS 12 동반 업그레이드는 별도 plan 으로 선행조건만 분리, 실제 코드 변경은 3개 파일에 정확히 수렴 | `plan/in-progress/*.md`, `jest.config.ts` 등 | 없음 |
| 4 | dependency | 새 외부 의존성/버전 범프/lockfile 변경 없음 — 순수 tooling 변경 | `package.json` (dependencies 불변) | 없음 |
| 5 | documentation | `PROJECT.md` 의 "packages/* vitest 이행은 별도 트리거 전까지 보류" 전제가 이번 PR 의 해법(vm-modules 네이티브 로드)으로 실질적으로 무력화됐을 가능성 — 상호 참조 없음 | `PROJECT.md` §버전·도구 정책 | 필수는 아니나 한 줄 교차 참조 권장 |
| 6 | requirement | `ExperimentalWarning` 실측 줄 수(로그 실카운트 9)가 plan 서술(10)과 불일치 — 사소한 문서 정확도 문제 | `plan/in-progress/jest-esm-native-load.md` §C, §D | "9~10줄(워커 수 의존)"으로 정정 |
| 7 | maintainability / testing | `package.json` 5개 스크립트에 동일 15단어 접두어가 하드코딩 반복 — 향후 변경 시 5곳 동시 수정 필요 | `package.json:22-26` | 공용 셸 스크립트/npm 합성으로 단일 진실 지점화 고려(우선순위 낮음) |
| 8 | maintainability / scope | `jest.config.ts` 신규 주석(~22~23줄)이 plan 문서 서사와 상당 부분 중복 — 코드 주석 vs plan 문서 간 향후 drift 가능성 | `jest.config.ts:17-38` vs `plan/in-progress/jest-esm-native-load.md` §A~C | 코드 주석은 핵심 결론만 유지, 상세 서사는 plan 을 단일 진실로 참조하는 것도 고려(낮은 우선순위) |
| 9 | performance | 프로덕션 런타임 영향 없음 — 테스트 실행시간만 실측 20~28% 개선, 초판의 "3배 빠름" 과장 주장은 스스로 반증·정정, `ExperimentalWarning` 로그 노이즈 미미, pnpm 중첩 경로에서도 기본 `transformIgnorePatterns` 정상 매치 확인 | `jest.config.ts:39`, plan §C | 없음 |
| 10 | security | 보안 영향 없음 — `start`/`start:prod` 등 production 실행 경로에는 실험 플래그 미적용, 인증/인가/시크릿/인젝션 해당 없음, 후속 NestJS 12 업그레이드의 reflection 인가 회귀 위험은 plan §C 에 이미 선제 문서화(체크리스트 포함) | `package.json`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C | 후속 PR 리뷰 시 §C 체크리스트 실제 수행 여부 재확인 |
| 11 | concurrency | 동시성 영향 없음 — 공유자원·락·이벤트루프·워커 동시성 설정(`maxWorkers` 등) 변경 없음 | `test/jest-e2e.json`, `jest.config.ts` | 없음 |
| 12 | testing | "플래그+기본 allowlist 는 반드시 쌍" 불변식을 전용으로 지키는 회귀 테스트는 없고, `uuid`/`otplib`/`p-limit` 를 쓰는 기존 비즈니스 스펙들의 우연한 커버리지에 의존 — 현재는 안전하나 리팩터로 해당 패키지 사용이 동시에 사라지면 무보호 상태 가능 | `jest.config.ts:17-39`, `test/jest-e2e.json:9` | 알려진 ESM-only 패키지 하나를 명시 import 하는 최소 smoke 테스트 추가 권장 |
| 13 | testing | plan 이 기록한 판별 실험(플래그 제거 시 RED)을 testing-reviewer 가 독립 재현해 정확히 일치 확인 — 긍정적 검증 | `plan/in-progress/jest-esm-native-load.md:92-101` | 없음 |
| 14 | side_effect | `transformIgnorePatterns` 원복 스코프가 `codebase/backend` 로 한정됨을 `grep -rl` 로 검증 — 다른 워크스페이스(packages/*, frontend, channel-web-chat) 영향 없음 | 저장소 전역 grep 결과 | 없음 |
| 15 | requirement / side_effect | CI 진입점(`backend-checks.yml`→`pnpm --filter backend test`, `docker-compose.e2e.yml`→`pnpm run test:e2e`)이 전부 `package.json` script 를 경유해 새 플래그가 자동 전파됨 — 우회 진입점 없음 확인 | CI workflow 파일들 | 없음 |
| 16 | scope | `nestjs-v12-coordinated-upgrade.md` 스텁은 이번 PR 이 하지 않는 후속 작업 기록일 뿐이며, 직전 consistency-check WARNING(W3, `@nestjs/common` 동반 업그레이드 후속 plan 미등재)에 대한 직접 대응으로 생성됨 — 범위 이탈 아님 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (신규 파일) | 없음 |
| 17 | (커버리지 갭, 종합) | `database`·`api_contract`·`user_guide_sync` 3개 reviewer 는 output 파일이 없어 전문 미확보 — `_retry_state.json` 상으로도 `agents_success`/`agents_fatal` 이 모두 비어 있고 14개 전체가 `agents_pending` 으로 남아 있어(디스크에는 11개가 완성된 리포트로 존재하는데도) 상태 파일이 실제 완료를 반영하지 못하는 것으로 보임(알려진 disk-write/상태 동기화 갭) | `_retry_state.json` | 3개 reviewer 재실행 또는 최소 수동 확인으로 DB/API 계약/사용자 가이드 관점 커버리지 확보 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | HIGH | Critical 1건(plan worktree placeholder, build guard 붕괴) + docstring stale WARNING |
| requirement | HIGH | Critical 1건 로컬 재현(vitest FAIL) + 미커밋 근거 인용 WARNING |
| architecture | LOW | test:debug 깨짐 재현(WARNING), ESM allowlist 제거는 OCP 개선(INFO) |
| maintainability | LOW | test:debug 표기 불일치(WARNING, 일관성 관점), 접두어 반복/주석 중복(INFO) |
| side_effect | LOW | test:debug 깨짐 재현(WARNING), 스코프 격리 검증(INFO) |
| testing | LOW | test:debug 미검증 상태 지적(WARNING), 판별 실험 독립 재현 성공, 전용 불변식 테스트 부재(INFO) |
| dependency | LOW | 순수 tooling 변경, 신규 의존성 없음(INFO). **단 test:debug 관련 "리스크 없음" 판단은 3개 reviewer 의 실제 재현과 모순** |
| performance | NONE | 프로덕션 영향 없음, 테스트 시간 20~28% 개선 실측 |
| security | NONE | 인증/인가/시크릿/인젝션 해당 없음, 실험 플래그가 production 경로에 미적용 |
| concurrency | NONE | 동시성 관련 코드 변경 없음 |
| scope | NONE | 범위 이탈·과잉 엔지니어링 없음, 매우 좁고 일관된 변경 |

## 발견 없는 에이전트

- **concurrency** — 동시성에 영향을 주는 런타임 코드 변경 없음 (위험도 NONE)
- **performance** — 프로덕션 성능 영향 없음, 테스트 실행시간 개선만 확인 (위험도 NONE)
- **security** — 인증/인가/인젝션/시크릿 관련 결함 없음 (위험도 NONE)
- **scope** — 범위 이탈 신호 없음 (위험도 NONE)

## 권장 조치사항

1. **(Critical, 병합 전 필수)** `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` 의 `worktree: (미정 — 착수 시 생성)` 을 `worktree: (unstarted)` 로 정정 — 로컬 재현된 vitest 실패의 직접 원인.
2. **(Warning)** `codebase/backend/package.json:25` 의 `test:debug` 스크립트를 나머지 4개와 동일하게 `./node_modules/jest/bin/jest.js` 형태로 통일하거나, 최소한 plan 에 "사전 결함, 이번 PR 검증 대상 아님"을 명시.
3. **(Warning)** `codebase/backend/jest.config.ts:3-9` 의 모듈 docstring 을 현재 파일의 실제 존재 이유(ESM 네이티브 로딩 근거 등)에 맞게 갱신.
4. **(Warning)** `review/consistency/2026/09/24/12_57_36` 산출물을 커밋에 포함하거나, `nestjs-v12-coordinated-upgrade.md` §C 에 W3 요지를 인라인해 추적성 확보.
5. **(커버리지 갭)** `database`·`api_contract`·`user_guide_sync` reviewer 를 재실행하거나 수동 확인해 이번 요약이 놓쳤을 수 있는 관점을 보강.
6. **(낮은 우선순위, INFO 묶음)** 5개 npm 스크립트의 반복 접두어 단일 진실 지점화, "플래그+allowlist 쌍" 불변식을 지키는 최소 smoke 테스트 추가 검토.

## 라우터 결정

`routing_status=pending`: 라우터 호출이 완료되지 않아(`_routing_decision.json` 산출 없음) fallback 으로 전체 reviewer(14개)가 실행 시도됐다.

- **실행 시도**: `security`·`performance`·`architecture`·`requirement`·`scope`·`side_effect`·`maintainability`·`testing`·`documentation`·`dependency`·`database`·`concurrency`·`api_contract`·`user_guide_sync` (14명, `subagent_invocations` 기준)
- **실제 output 확보**: 11명(위 표 참조)
- **output 파일 없음 — 재시도 필요**: `database`·`api_contract`·`user_guide_sync` (3명)
- **강제 포함(router_safety, 라우터 완료 시 적용됐을 목록)**: `dependency`·`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing` (8명) — 라우터가 완료되지 않아 실제로는 fallback 으로 전원 실행됐으므로 이 목록은 참고용.
- `_retry_state.json` 의 `agents_success`/`agents_fatal` 이 둘 다 비어 있고 `agents_pending` 에 14개 전부가 남아 있는 것은 디스크에 11개의 완성된 리포트가 존재하는 사실과 불일치한다 — 상태 파일이 실제 완료를 반영하지 못하는 알려진 disk-write 동기화 갭으로 판단, 디스크상의 완성된 내용을 authoritative 로 채택했다.
