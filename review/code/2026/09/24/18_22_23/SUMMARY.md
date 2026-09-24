# Code Review 통합 보고서

## 전체 위험도
**LOW** — `@nestjs/typeorm` `^11.0.3` → `^12.0.1` 단일 의존성 범프(애플리케이션 코드 변경 0줄). 14개 reviewer 전원(강제 포함 8명 포함) 결과 확보, CRITICAL 없음. 실질 결함은 없으나 plan 문서 서술과 실제 diff 범위/frontmatter 상태가 어긋나는 문서 정확도 WARNING 3건이 있다.

> 참고: `forced` (router_safety 강제 8명: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.
> 별도 관측: scope/user_guide_sync 리뷰 시점에 공유 워크트리에서 이 PR 범위 밖 파일(`workspace.decorator.ts`)의 검증용 뮤턴트가 미원복 상태로 관측됐으나, 본 SUMMARY 작성 시점 `git status --short` 재확인 결과 현재는 clean — 이 PR 의 코드 위험으로 반영하지 않음(하단 INFO #10 참고).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency / Requirement | `pnpm-lock.yaml` diff 가 plan 의 "한 줄" 서술보다 훨씬 넓다 — `@nestjs/typeorm` 변경분(약 10줄) 외에 무관한 optional 네이티브 패키지(`@css-inline/*`·`@img/sharp-*`·`@napi-rs/canvas-*`·`@next/swc-*`·`@parcel/watcher-*`·`@rolldown/binding-*`·`@tailwindcss/oxide-*`·`lightningcss-*` 등)의 `libc: [glibc\|musl]` 필드 63줄 삭제(추가 0줄) + `eslint-plugin-import` peer 해석 문자열 변경 2곳이 섞여 있다. 직전 5개 단일-의존성 범프 커밋에는 이 패턴이 0건이었다. | `pnpm-lock.yaml` (다수 hunk, 예: `@@ -1241,28 +1241,24 @@` 등) | `deps-typeorm12.md` §B 에 "lockfile 재해석으로 무관 optional 패키지 메타데이터도 함께 정리됨(`--frozen-lockfile` 검증 무해)" 한 줄 추가, 또는 `pnpm install --frozen-lockfile` 재실행으로 idempotent 확인 |
| 2 | Documentation | `nestjs-v12-coordinated-upgrade.md` frontmatter `worktree: (unstarted)` 가 본문(§0)의 "전면 12 업그레이드를 실제로 착수했다가 세 벽에 막혀 롤백했다"는 서술과 모순된다. `plan-lifecycle.md` §4 는 `(unstarted)` 를 "미착수" 전용 sentinel 로 규정하며, 이 값은 push-gate 연결 판정에도 쓰인다(현재는 형제 문서 `deps-typeorm12.md` 의 올바른 worktree 값 덕에 게이트 자체는 통과함 — 차단 위험 없음, 문서 정확성 문제). | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` frontmatter | 실제 착수·롤백이 일어난 worktree 이름으로 갱신하거나, "착수 후 전량 롤백해 커밋된 코드가 없어 의도적으로 unstarted 유지" 취지를 본문에 한 줄 명시 |
| 3 | Dependency | `@nestjs/typeorm@12.0.1` 은 순수 ESM(`type: module`)이며, 이 저장소의 CJS 런타임이 이를 로드하려면 Node 의 native `require(esm)` 지원(`engines: node >=20.19.0`)에 의존한다. 현재 `package.json` `engines.node: >=24` 로 충분히 커버되고 빌드/e2e 로 검증됐으나, 향후 `engines.node` 를 낮추는 변경이 있으면 조용히 재파손될 수 있는 암묵적 결합이다. | `pnpm-lock.yaml` (`@nestjs/typeorm@12.0.1` engines 블록), `codebase/backend/package.json:132-134` | `engines.node` 를 낮추는 별도 PR 의 검증 체크리스트에 "`@nestjs/typeorm` require(esm) 로드 확인" 항목을 명시적으로 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 순수 의존성 버전 범프 — `@nestjs/typeorm` 은 DI 배선만 담당하는 얇은 래퍼이고, 실제 쿼리 실행을 하는 `typeorm` 코어(`^0.3.31`)와 DB 드라이버는 불변. 신규 인젝션/인증 표면 없음 | `codebase/backend/package.json:44` | 없음 |
| 2 | Security / Architecture | fail-open 위험이 있는 reflection 기반 인가 가드(`RolesGuard`/`@WorkspaceId()`)의 회귀 여부를 업그레이드 전/후로 부트 캐너리(142건) + reflection 3스위트(48/48) + 판별자 뮤턴트(`handlerConsumesWorkspaceId`→항상 false, 9건 RED) 3중으로 실측 비교한 절차가 모범적 — "테스트 통과=안전" 함정을 스스로 회피 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C, `deps-typeorm12.md` §C | 없음(모범 사례로 확인) |
| 3 | Testing / Requirement | 본 리뷰에서 독립 재현: unit 스위트 수(473), reflection 3스위트(48/48 통과), 판별자 뮤턴트 재현(3 suites / 9 tests RED) 모두 plan 문서 주장과 정확히 일치 확인. 저장소 무변경(뮤테이션 후 `cp` 원복) | 재현 로그 (requirement.md, testing.md) | 없음 |
| 4 | Testing | 판별자(MB) 뮤테이션 검증이 코드화된 회귀 자산이 아니라 매 `@nestjs/*` 업그레이드 PR 마다 사람이 수작업(`cp`)으로 반복하는 절차로만 문서에 남아 있어, 다음 담당자가 절차 자체를 잊으면 fail-open 회귀를 놓칠 수 있음 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C | `.claude/tests/` 또는 backend 자체 mutation-canary 스크립트로 코드화해 사람 의존성 제거 (선택) |
| 5 | Performance / Architecture | 실행 코드(`src/**`) 변경 없음, `typeorm` 코어·DB 드라이버 불변으로 성능·구조 영향 표면 제한적. `@nestjs/typeorm@12` 가 나머지 `@nestjs/*`(11.x) 위에서 도는 "부분 메이저 범프"는 peer range 실측(`^10\|\|^11\|\|^12`)과 `platform-express@12` 런타임 실패 실측을 근거로 한 의도된 예외 | `pnpm-lock.yaml`, `plan/in-progress/deps-typeorm12.md` §A | 없음 |
| 6 | Maintainability | plan 문서 섹션 번호 체계가 `0 → 3 → A~E` 로 비일관적이고, 검증 기준값(142/48/9)이 두 문서 세 곳에 리터럴로 중복 기재되어 향후 한쪽만 갱신되는 drift 위험 존재 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md`, `plan/in-progress/deps-typeorm12.md` §C | 번호 체계 통일, 기준값은 한 문서를 정본으로 두고 나머지는 참조만 |
| 7 | Documentation / Requirement | `spec/5-system/1-auth.md` 의 `^11.0.1` 캐럿 인용 stale 화는 이번 PR 이 `@nestjs/common` 을 건드리지 않아 여전히 참 — 이미 이전 consistency-check 가 선행 발견해 후속 항목으로 추적 중, planner 턴으로 명시 이관됨. 재지적 불필요 | `spec/5-system/1-auth.md:807` | 없음(이미 추적 중) |
| 8 | Dependency | `@nestjs/typeorm@12.0.1` 라이선스 MIT(불변), 조사 범위 내 알려진 CVE 없음, peer 호환성(`^10\|\|^11\|\|^12`) 이 lockfile 실측과 정확히 일치 | `pnpm-lock.yaml` | 없음 |
| 9 | Harness 아티팩트 | `review/consistency/2026/09/24/17_31_27/_retry_state.json` 의 `agents_pending` 이 실제로는 5개 checker 모두 완료됐음에도 초기 스냅샷 그대로 남아 있음(평문 Agent fan-out 경로의 알려진 동작, `meta.json` 은 정상) | `review/consistency/2026/09/24/17_31_27/_retry_state.json` | 조치 불요 — "체크가 안 돌았다"는 오판 방지용 참고 |
| 10 | 프로세스 관측 (이 PR 범위 밖) | scope.md/user_guide_sync.md 리뷰 시점에 공유 워크트리에서 `codebase/backend/src/common/decorators/workspace.decorator.ts` 의 `handlerConsumesWorkspaceId` 가 검증용 뮤턴트(`return false; // MUTATION`)로 미원복 상태로 관측됨(requirement.md 는 자신의 검증에서 `cp` 로 원복 완료했다고 주장). 본 SUMMARY 작성 시점 `git status --short` 재확인 결과 현재 워크트리는 clean(이 리뷰 세션 자신의 산출물 외 변경 없음) — 잔존 위험 없음 | `codebase/backend/src/common/decorators/workspace.decorator.ts` (현재는 원복됨) | 조치 불요(현재 clean). 향후 판별자 뮤테이션 검증은 scratch 디렉토리에서 수행해 병렬 리뷰어 오염을 방지할 것 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 버전 범프, 인증/인가 fail-open 회귀 실측 검증 모범 사례 |
| performance | NONE | 실행 코드 변경 없음, typeorm 코어 불변 |
| architecture | NONE | 판단 대상 코드 없음, 부분 메이저 범프는 실측 기반 의도된 예외 |
| requirement | LOW | lockfile 부수 변경 63줄(WARNING #1), 나머지는 독립 재현으로 plan 주장 일치 확인 |
| scope | LOW | lockfile 부수 변경(WARNING #1 근거), 범위 밖 미원복 뮤테이션 관측(INFO #10) |
| side_effect | LOW | lockfile 부수 변경, 소비 표면(13+ 모듈) 넓음이나 검증됨 |
| maintainability | LOW | plan 문서 섹션 번호 비일관 + 수치 중복(INFO #6) |
| testing | LOW | 독립 재현 일치, 판별자 뮤테이션이 수작업 절차로만 존재(INFO #4) |
| documentation | LOW | frontmatter `worktree` 모순(WARNING #2), lockfile 규모 서술 불일치 |
| dependency | LOW | lockfile 부수 변경(WARNING #1), ESM/CJS 결합 취약점(WARNING #3) |
| database | NONE | 판단 대상 코드 없음(해당없음) |
| concurrency | NONE | 판단 대상 코드 없음(해당없음) |
| api_contract | NONE | 판단 대상 코드 없음(해당없음) |
| user_guide_sync | NONE | doc-sync 매트릭스 20행 전수 대조 결과 매칭 trigger 없음, 범위 밖 뮤테이션 관측만 참고 기록 |

## 발견 없는 에이전트

- database — 검토 대상 DB 코드(스키마/쿼리/마이그레이션/커넥션) 없음
- concurrency — 검토 대상 동시성 코드(락/async/공유 상태) 없음
- api_contract — 검토 대상 API 계약 코드(라우트/DTO/에러 포맷) 없음
- user_guide_sync — doc-sync 매트릭스 20개 trigger 전수 대조, 매칭 없음

## 권장 조치사항

1. `plan/in-progress/deps-typeorm12.md` §B 에 `pnpm-lock.yaml` 부수 변경(무관 optional 패키지 `libc:` 필드 63줄 삭제 등) 사유를 한 줄 기록하거나, `pnpm install --frozen-lockfile` 재실행으로 idempotent 함을 확인한다. (WARNING #1)
2. `plan/in-progress/nestjs-v12-coordinated-upgrade.md` frontmatter `worktree:` 값을 본문의 실제 착수·롤백 서술과 일치하도록 갱신하거나, `(unstarted)` 유지 사유를 본문에 명시한다. (WARNING #2)
3. (선택) 향후 `engines.node` 를 낮추는 PR 의 검증 체크리스트에 `@nestjs/typeorm` 의 `require(esm)` 로드 확인 항목을 추가한다. (WARNING #3)
4. (선택) 판별자(MB) 뮤테이션 검증을 수작업 절차 대신 코드화된 mutation-canary 스크립트로 전환해 사람 의존성을 낮춘다. (INFO #4)
5. (선택) plan 문서 섹션 번호 체계를 통일하고, 검증 기준값 중복을 단일 정본 참조로 정리한다. (INFO #6)

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행됨(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — 전원 결과 확보됨(누락 없음).
- 제외된 reviewer 없음.
