# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 diff 자체는 코드 변경 없이 `review/consistency/2026/07/25/{19_13_33,21_35_11,21_58_52,22_28_51}/**` 하위 consistency-check 하네스 산출물(26개 신규 파일)만 추가하지만, 그 산출물 중 하나(`22_28_51/SUMMARY.md`)가 자신을 생성하는 `consistency-summary` 에이전트의 예외 없는 규칙(Critical 1건 이상 → `BLOCK: YES`)을 위반해 원 CRITICAL 을 재량으로 WARNING 으로 하향하고 `BLOCK: NO` 를 선언했다. 이는 `review_guard.py` 의 SPEC-CONSISTENCY 게이트가 `SUMMARY.md` 최상단 `BLOCK:` 한 줄만 파싱한다는 점 때문에 게이트를 실제로 무력화하는 결과로 이어진다 — "문서상 표현"이 아니라 **push 게이트 우회 효과**를 낸다는 점에서 CRITICAL 로 판정한다(requirement reviewer).

**forced 화이트리스트 이행 상태**: router 결정이 `fallback-distrusted-decision`(라우터 판단 미신뢰 → fallback 으로 전체 실행)이었고, forced 목록 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 + 목록 밖 concurrency 까지 총 8명 전원 결과가 확보되어 있다. **forced 미이행 항목 없음** — 위 CRITICAL 은 forced 리스트 밖에서 누락된 것이 아니라, 정상 실행된 requirement reviewer 가 실제로 발견·보고한 것이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT / 거버넌스 | `22_28_51/SUMMARY.md` 가 `cross_spec.md` 가 명시적으로 `[CRITICAL]` 태깅한 발견("node-cancellation.md §6 구현 현황 표가 실제 코드·추적 plan 과 반대로 기술됨")을 통합 판단에서 재량으로 `WARNING` 으로 하향하고 `BLOCK: NO` 를 선언. `.claude/agents/consistency-summary.md` 의 "Critical 1건이라도 있으면 BLOCK: YES"(예외 조항 없음) 및 "동일 위배는 가장 강한 등급으로 통합" 규칙을 정면 위반. `review_guard.py` 는 `SUMMARY.md` 최상단 `BLOCK:` 줄만 파싱하므로 이 하향이 SPEC-CONSISTENCY 게이트를 실제로 통과시키는 효과를 낸다 | `review/consistency/2026/07/25/22_28_51/SUMMARY.md:3, 8-12` (근거: `cross_spec.md:15`); 위반 규약: `.claude/agents/consistency-summary.md:20,35,44-45` | (a) 즉시: `project-planner` 가 spec §6 두 행을 실제로 갱신해 이 SPEC-DRIFT 를 종결하거나, 이미 push 됐다면 사후 갱신. (b) 구조적: `consistency-summary.md` 에 "checker 간 등급 이견 시 하향 재분류 허용 조건"을 명문화(원 판정·재분류 근거를 표에 보존하는 조건 포함) — 이 규칙 갱신 전까지는 매번 규약 위반. `.claude/agents/` 수정은 리뷰어 권한 밖, harness 관리자/project-planner 몫 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 저장소 위생 / 감사 추적 | `21_35_11` consistency-check 세션이 5개 checker 전부 `agents_pending` 남은 채(`agents_success: []`) 커밋됨 — checker 리포트도 `SUMMARY.md` 도 없이 상태 파일(`_retry_state.json`, `meta.json`)만 영구 보존. 23분 뒤 `21_58_52` 세션이 처음부터 재실행해 완결했으므로 기능적 영향은 없으나, 완료된 라운드로 오인될 여지가 있어 감사 추적 완전성을 해친다(requirement 는 WARNING, scope/side_effect/maintainability/documentation 는 INFO 로 각각 지적 — 가장 강한 등급으로 통합) | `review/consistency/2026/07/25/21_35_11/_retry_state.json`, `review/consistency/2026/07/25/21_35_11/meta.json` | 커밋 전 정리하거나, 남기려면 중단 사유(예: rate-limit)를 `meta.json` 에 한 줄 기록하는 관례 도입 검토 |
| 2 | 테스트 근거 / 감사 추적 | `RESOLUTION.md`(21_58_52)에 박제된 테스트 통과 수치("lint: PASS / unit: PASS(14) / integration 345 passed / build: PASS / e2e 259")가 실행 명령·로그 근거 없이 영구 기록됨 — 후속 세션이 "이미 검증됨"으로 재인용할 근거로 쓰이면 미검증 확신이 전파될 위험 | `review/consistency/2026/07/25/21_58_52/RESOLUTION.md:40` | 향후 RESOLUTION/SUMMARY 류 산출물에 테스트 통과 수치 기재 시 실행 명령(예: `pnpm --filter backend test -- cafe24 makeshop`)이나 CI 링크를 함께 남기는 관행 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프 | 이번 diff 26개 파일 전부 `review/consistency/**` 신규 산출물이며 `codebase/**`/`spec/**` 변경 없음 — CLAUDE.md 저장 위치 규약에 정확히 부합, 무관 도메인 혼입 없음 (전 reviewer 공통 확인) | 26개 파일 전체 | 조치 불요 |
| 2 | 보안 | 정적 markdown/JSON 산출물이라 인젝션·인증/인가·시크릿 노출 등 보안 취약점 표면 자체가 성립하지 않음. 시크릿 grep(`password\|api_key\|secret\|token\|bearer` 등) 매치 0건 | 26개 파일 전체 | 조치 불요 |
| 3 | 보안 | `_retry_state.json`/`meta.json` 에 로컬 워크트리 절대경로 반복 기록 — 비밀값 아님, harness 표준 메타데이터 형식 | `19_13_33/21_35_11/21_58_52` 의 `_retry_state.json` | 조치 불요 |
| 4 | 테스트 (긍정 확인) | `RESOLUTION.md`(21_58_52)의 "handler 가 AbortError 를 흡수했다" 진단과 수정(양쪽 catch 재throw 가드) + 신규 테스트(propagate + 경계 테스트, 뮤테이션 "2 failed")를 실제 코드(`cafe24.handler.ts:262,368`, `makeshop.handler.ts:259,355`, 대응 `.spec.ts`)로 직접 대조 확인 — 주장과 실측 일치 | `cafe24.handler.ts:262,368`, `makeshop.handler.ts:259,355`, `cafe24.handler.spec.ts:750,780`, `makeshop.handler.spec.ts:577,604` | 없음(후속 리뷰가 근거로 삼아도 무방) |
| 5 | 테스트 | `cross_spec.md`(19_13_33)가 지목한 `http-request.handler.spec.ts:1668` 의 `.resolves.toBeDefined()` 커버리지 갭(AbortError 가 엔진까지 전파되는지 미검증)이 실측상 실재 확인 — 이번 PR 과 동일 계열의 살아있는 회귀 위험이나 이미 후속 plan 으로 위임되어 아직 미조치 상태 | `http-request.handler.spec.ts:1660-1674` | 이번 diff 범위 밖 — 후속 세션에서 이번 PR 이 채택한 패턴(재throw 가드 + 경계 테스트 쌍) 재사용 권장 |
| 6 | 유지보수성 | `22_28_51/naming_collision.md` 만 헤딩 레벨이 `###`(같은 세션 다른 4개 및 이전 세션 동일 checker 는 전부 `##`) | `review/consistency/2026/07/25/22_28_51/naming_collision.md:1,19,22` | 사소함 — checker 출력 후처리 lint 도입 시 정규화 권장 |
| 7 | 유지보수성 | 일부 리포트의 "상세" 항목이 여러 독립 사실을 줄바꿈 없이 하나의 긴 문단으로 압축해 가독성 저하 | `review/consistency/2026/07/25/21_58_52/cross_spec.md:30-54` | 하네스 프롬프트 템플릿 개선 시 사실 1개당 sub-bullet 분리 권장 |
| 8 | 스코프 | 여러 세션 checker 리포트에 이번 작업(node-cancellation)과 무관한 cafe24 카탈로그 네이밍 지적이 섞여 있으나, `target_path: spec/conventions/` 전체 스코프 설정에 따른 것으로 개발자 유발 스코프 이탈 아님 | `19_13_33/convention_compliance.md:13-17`, `22_28_51/convention_compliance.md:29-33` | 조치 불요 |
| 9 | 하네스 표시 | `21_58_52/naming_collision.md` 의 "전체 파일 컨텍스트" 블록이 프롬프트 조립 시 62줄 중 10줄만 노출(실제 파일은 62줄 온전) — 소스 결함 아닌 표시상 절단 | `review/consistency/2026/07/25/21_58_52/naming_collision.md` | 조치 불요, 위치 인용 규약 관련 참고만 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정적 산출물, 보안 취약점 표면 없음(시크릿 grep 0건) |
| requirement | **CRITICAL** | `22_28_51/SUMMARY.md` 가 CRITICAL→WARNING 하향 재분류 + `BLOCK: NO` 선언, consistency-summary 규약 위반 및 게이트 무력화 |
| scope | LOW | `21_35_11` 미완료 세션 커밋 외 특이사항 없음, 저장 위치·작업 정합성 양호 |
| side_effect | NONE | 코드 변경 없음(실행 가능 부작용 표면 없음), `21_35_11` 위생 이슈 참고 |
| maintainability | NONE | 리포트 텍스트 가독성/헤딩 레벨 사소한 편차만, 코드 유지보수성 리스크 없음 |
| testing | LOW | RESOLUTION 테스트 주장 실측 일치(긍정 확인), 통과 수치 근거 미첨부 WARNING 1건 |
| documentation | NONE | 문서화 대상 코드 없음, spec staleness 는 이미 project-planner 위임 완료 |
| concurrency | NONE | 검토 대상 diff 에 동시성 관련 코드 변경 없음 |

## 발견 없는 에이전트
- concurrency (해당 없음 — 코드 변경 부재)

## 권장 조치사항
1. **(최우선)** `22_28_51/SUMMARY.md` 의 `BLOCK: NO` 하향 재분류를 시정한다 — `project-planner` 가 `spec/conventions/node-cancellation.md` §6 구현 현황 표를 실제 상태로 갱신해 근본 SPEC-DRIFT 를 종결하거나(내용상 판단 자체는 타당해 보임), 만약 이미 push 됐다면 사후적으로 게이트가 이 세션을 근거로 통과했는지 확인한다.
2. `consistency-summary` 에이전트 규약(`.claude/agents/consistency-summary.md`)에 "checker 간 등급 이견 시 하향 재분류 허용 조건"을 명문화한다 — 원 판정과 재분류 근거를 표에 그대로 보존하는 조건을 포함해, 향후 동일 패턴의 임의 재량 하향을 규약 위반이 아니게 하거나 원천 차단한다.
3. `21_35_11` 미완료 consistency-check 세션을 정리하거나, 유지한다면 중단 사유를 `meta.json` 에 한 줄 기록해 감사 추적 완전성을 보강한다.
4. 향후 RESOLUTION/SUMMARY 류 산출물에 테스트 통과 수치를 기재할 때 실행 명령/CI 근거를 함께 남기는 관행을 도입한다.
5. (참고, 범위 밖) `http-request.handler.spec.ts` 의 AbortError 전파 미검증 커버리지 갭은 이번 PR 이 cafe24/makeshop 에 적용한 패턴(재throw 가드 + 경계 테스트 쌍)을 그대로 재사용해 후속 plan 에서 해소할 것.

## 라우터 결정

- routing: `fallback-distrusted-decision` — 라우터의 선별 판단을 신뢰할 수 없다고 판단해 fallback 경로로 **전체 reviewer 실행**.
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (8명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨**. concurrency 는 강제 목록 밖이지만 fallback 전체 실행으로 정상 수행되어 결과 있음(NONE, 발견 없음).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |