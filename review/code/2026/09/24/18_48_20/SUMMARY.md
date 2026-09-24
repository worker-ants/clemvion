# Code Review 통합 보고서

## 전체 위험도
**LOW** — `@nestjs/typeorm` `^11.0.3`→`^12.0.1` 단일 의존성 메이저 범프(2라운드, 애플리케이션 코드 변경 0줄)이며, 1라운드 Warning 3건(lockfile 범위 초과·plan frontmatter 모순·ESM/CJS 암묵 결속 미문서화)은 전 reviewer 가 독립 재현으로 해소를 확인했다. 이번 라운드 신규 발견은 plan 문서 간 추적 링크 누락 1건(WARNING)뿐이며, forced(router_safety) 8개 reviewer 를 포함한 14개 reviewer 전원의 결과가 확보되어 있어 화이트리스트 미이행에 의한 사각지대는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서(plan 간 추적) | `deps-typeorm12.md` 의 "후속" 절이 `spec/5-system/1-auth.md:806-807` 의 stale `^11.0.1` 캐럿 인용 정정을 "`nestjs-v12-coordinated-upgrade.md` §3 재개 조건과 함께 처리한다"고 명시했으나, 실제로 대상 문서(§3/§E, 전체 156줄)에는 그 항목이 존재하지 않는다(문자열 0회 등장). `deps-typeorm12.md` 는 머지 후 `plan/complete/` 로 이동해 재개 시점 담당자가 다시 열어볼 개연성이 낮으므로, 상류(mailer/throttler/TS6) 재개 조건이 전부 풀려 `nestjs-v12-coordinated-upgrade.md` 가 종결돼도 이 캐럿 정정이 누락될 수 있다 | `plan/in-progress/deps-typeorm12.md:122`, 대상: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §3/§E | `nestjs-v12-coordinated-upgrade.md` 의 `§3. 재개 조건` 또는 `§E. 종결 조건`에 "`spec/5-system/1-auth.md` 806~807행 `^11.0.1` 캐럿 정정 — planner 턴" 체크박스를 실제로 추가(원래 consistency-check 가 요구한 자리) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성 | `@nestjs/typeorm` 단일 devDependency 메이저 범프. 신규 외부 패키지·라이선스 충돌·알려진 CVE 없음(OSV 조회 `{}`). lockfile integrity 해시가 npm 레지스트리 실측과 바이트 단위 일치, `nestjscore` 계정 서명. `typeorm` 코어(`^0.3.31`)·DB 드라이버·나머지 `@nestjs/*`(11.1.27) 는 전부 불변 | `codebase/backend/package.json:44`, `pnpm-lock.yaml` | 없음 |
| 2 | 의존성(1라운드 WARNING 1 해소) | lockfile diff 가 3-hunk·15줄로 좁혀져 typeorm 관련 필드(specifier/version/resolution/engines/peerDependencies)만 남음 — 1라운드가 지적한 무관 optional 패키지 `libc:` 필드 63줄·`eslint-plugin-import` peer 변경이 `git diff origin/main` 재현 결과 0건임을 다수 reviewer 가 독립 확인 | `pnpm-lock.yaml` | 없음(해소 확인) |
| 3 | 가용성(1라운드 WARNING 3 해소) | `@nestjs/typeorm@12` 가 ESM-only(`type: module`, `engines: node>=20.19.0`)라 CJS 런타임이 Node 의 `require(esm)` 에 암묵 의존하게 된 결속을 `PROJECT.md` Node 지원 floor 절에 실측치(현재 floor `>=24`, e2e 380 PASS 로 부팅 검증)와 함께 정확한 위치에 문서화 | `PROJECT.md:88` | 없음(해소 확인) |
| 4 | 테스트(회귀 가드 갭) | 위 ESM/`require(esm)` 결속을 지키는 자동화된 회귀 가드가 없음 — 저장소가 유사 사례(툴체인 major 결속)에 이미 코드화된 가드(`typescript-toolchain.test.ts`)를 두고 있는 것과 달리, 이번 결속은 산문 경고가 유일한 방어선. `engines.node` 는 advisory 라 하향 PR 이 e2e 를 생략/축소하면 회귀가 CI 를 통과할 수 있음 | `PROJECT.md`, `codebase/backend/src/repo-guards/`(해당 검사 0건) | `engines.node` 하향 시 `@nestjs/typeorm` 최소 요구 Node 버전을 대조하는 경량 assertion(repo-guard) 추가 검토(비차단, 다음 floor 변경 PR 스코프) |
| 5 | 아키텍처 | `@nestjs/typeorm@12` 가 나머지 `@nestjs/*`(11.x) 와 다른 major 로 고정되는 "부분 메이저 범프" 상태 — peer range(`^10\|\|^11\|\|^12`) 실측과, 전면 범프 시 런타임 실패로 이어지는 반대 사례(`@nestjs/platform-express@12` 가 `@nestjs/common@12` 강제) 실측을 근거로 의도적으로 분리·보류됨 | `codebase/backend/package.json:44`, `pnpm-lock.yaml`(peerDependencies) | 없음. `nestjs-v12-coordinated-upgrade.md` §3 재개 조건이 SoT 로 유지되는 한 조치 불요 |
| 6 | 보안(인가 회귀 검증) | reflection 기반 `RolesGuard`/`@WorkspaceId()` 의 fail-open 회귀 여부를 업그레이드 전/후로 부트 캐너리(142건)·테스트(48/48)·판별자 뮤테이션(9건 RED, `handlerConsumesWorkspaceId` 강제 false)로 3중 실측 비교 — "테스트 통과=안전" 함정을 피한 모범 사례, 회귀 없음 확인(`#1103` 결함 클래스 재발 없음) | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C, `deps-typeorm12.md` §C | 없음(모범 사례) |
| 7 | 테스트(회귀 자산 갭) | 위 판별자(MB) mutation 검증이 코드화된 자동 회귀 자산이 아니라 `cp` 복사/원복 수작업 절차로만 plan 문서에 존재 — 1라운드에서 이미 지적·"다음 `@nestjs/*` 업그레이드 PR 스코프"로 유예 처리된 사안이며, 이번 라운드에도 잔존함(재지적 아닌 잔존 확인). 절차 생략 시 다음 담당자가 fail-open 회귀를 오판할 위험 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C/§E, `deps-typeorm12.md` §C | 없음(이미 처리 방침 결정). 다음 `@nestjs/*` 업그레이드 PR 스코프에서 코드화 여부 판단 |
| 8 | 요구사항 | `spec/5-system/1-auth.md:807` 의 `^11.0.1` 인용은 `@nestjs/common` 캐럿을 가리키며, 이번 PR 및 1라운드 모두 `@nestjs/common` 을 건드리지 않아 "여전히 참" — 정정 필요 시점(동반 업그레이드)과 담당(planner, spec 쓰기)이 plan 에 올바르게 지정됨 | `spec/5-system/1-auth.md:807`, `plan/in-progress/deps-typeorm12.md` | 없음 |
| 9 | 스코프 | diff 1635줄 중 약 1130줄이 애플리케이션 코드가 아니라 1라운드 code-review(`review/code/.../18_22_23/**`)·impl-prep consistency-check(`review/consistency/.../17_31_27/**`) 산출물을 저장소 관례에 따라 커밋한 것 — 스코프 이탈 아니라 절차상 요구되는 문서화. `nestjs-v12-coordinated-upgrade.md` 대폭 갱신(+108/-22) 역시 코드 변경 없이 "왜 전면 업그레이드 대신 typeorm 만 분리했는가"를 뒷받침하는 의도된 자료 | `review/code/2026/09/24/18_22_23/**`, `review/consistency/2026/09/24/17_31_27/**`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md` | 없음(참고용 기록) — 실질 코드 변경(4파일, 순 17줄)을 놓치기 쉬우므로 기록 |
| 10 | 유지보수성(문서 위생, 기존 이슈 잔존) | plan 문서 섹션 번호 체계가 `0→3→A~E` 로 숫자/알파벳이 섞이고 비연속이며, 업그레이드 전 기준값(부트 캐너리 142건·테스트 48/48·뮤턴트 9건 RED)이 두 plan 문서에 리터럴로 중복 기재됨 — 둘 다 1라운드에서 이미 검토되어 "조치 불요"로 수용된 트레이드오프이며 이번 diff 가 상태를 악화시키지 않음 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` | 없음(이미 검토·수용). 실제 재개 시 헤더 체계 일괄 정리 권장 |
| 11 | 문서(리뷰 산출물 위생) | 리뷰 산출물(`_retry_state.json`)에 로컬 절대경로(`/Volumes/project/private/clemvion/...`)가 커밋됨 — 자격증명·내부 IP 등 민감정보는 아니며 저장소 `review/**` 보존 관례에 따른 것, 1라운드에서도 동일 관측 후 조치 불요 처분됨 | `review/code/2026/09/24/18_22_23/_retry_state.json`, `review/consistency/2026/09/24/17_31_27/_retry_state.json` | 없음(재발 아님) |
| 12 | 테스트(독립 검증) | `_test_logs/` 아티팩트 직접 열람으로 unit 473스위트/9950(1 skip, 기존 상태), e2e 70스위트/380 PASS, build(백엔드 194건/35파일·프런트엔드 52건/15파일 diagnostics baseline 일치, Docker 2스테이지 성공) 를 재대조 — RESOLUTION.md 의 "최소 lockfile 로 재수행" 주장과 정확히 일치 | `_test_logs/unit-20260924-184626.log` 등 | 없음 |
| 13 | 유저가이드 동반 갱신 | `doc-sync-matrix.json` 21개 trigger 행 전체와 대조한 결과 매칭 0건(`codebase/backend/src/nodes/**`·frontend·auth·expression-engine·spec/** 등 모두 미변경) — docs MDX·i18n·backend-labels 동반 갱신 의무 없음 | 전체 diff 32파일 | 없음(해당 없음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 공격 표면 없음, 공급망 무결성 실측 확인, 인가 회귀 검증 모범 사례 |
| performance | NONE | 실행 코드 변경 없음, lockfile 노이즈 해소 확인 |
| architecture | NONE | 부분 메이저 범프 상태는 peer range·반대사례 실측 근거로 의도된 예외 |
| requirement | NONE | 1라운드 Warning 3건 조치 독립 재검증, spec 인용 여전히 참 |
| scope | NONE | 실질 코드 변경 4파일/순 17줄, 나머지는 리뷰 산출물 커밋(절차상 요구) |
| side_effect | NONE | 애플리케이션 코드 변경 없어 새 부작용 표면 없음, ESM 결속 문서화 확인 |
| maintainability | NONE | 코드 단위 지표 대상 없음, 문서 이슈는 기존에 이미 수용된 트레이드오프 |
| testing | LOW | 판별자 mutation 검증 미코드화(잔존), ESM/require(esm) 결속에 자동 가드 없음(신규 관측) |
| documentation | LOW | plan 간 추적 링크 누락(WARNING) 1건, 나머지 조치 사항은 실측으로 해소 확인 |
| dependency | LOW | 1라운드 Warning 2건(lockfile 범위·ESM 결속) 해소를 독립 재현으로 확인 |
| database | NONE | 해당 없음 — DB 코드 변경 없음 |
| concurrency | NONE | 해당 없음 — 동시성 판단 대상 코드 없음 |
| api_contract | NONE | 해당 없음 — HTTP API 표면 코드 변경 없음 |
| user_guide_sync | NONE | 해당 없음 — doc-sync-matrix 매칭 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync — 모두 "해당 없음"(판단 대상 코드/트리거 자체가 diff 에 존재하지 않음)으로 명시적으로 결론.

## 권장 조치사항

1. `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 의 `§3. 재개 조건` 또는 `§E. 종결 조건`에 "`spec/5-system/1-auth.md` 806~807행 `^11.0.1` 캐럿 정정 — planner 턴" 체크박스를 실제로 추가한다(WARNING 1 해소).
2. (비차단, 후속 검토) `engines.node` 하향 PR 대비, `@nestjs/typeorm` 의 `require(esm)` ESM 결속을 지키는 경량 repo-guard assertion 추가를 다음 PR 스코프에서 검토한다.
3. (비차단, 이미 유예 결정됨) 판별자(MB) mutation 회귀 검증을 다음 `@nestjs/*` 업그레이드 PR 에서 코드화할지 판단한다.

## 라우터 결정

라우터 미사용(`routing_status=skipped`) — 전체 14개 reviewer(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync) 가 실행됐다. 이 중 forced(router_safety) 화이트리스트 8개(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 는 전원 결과가 확보되어 화이트리스트 미이행에 의한 사각지대는 없다. 제외된 reviewer 없음(N/A).
