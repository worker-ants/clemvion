# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Blocking 결함 없음. 실질 코드 변경(테스트 fixture 보강 + 주석 용어 정정)은 7개 reviewer 전원이 검증·재현했고 안전하다고 판정. WARNING 1건은 plan 문서의 서술 정확성(추적 링크 부재)에 국한되며 코드 자체에는 영향 없음. forced(router_safety) 화이트리스트 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | plan 문서가 "별도 harness task 로 분기해 종결 조건을 충족한다"고 현재형으로 단언하나, 그 harness task 를 가리키는 구체적 파일 경로/ID 가 diff·`plan/` 트리 어디에도 없음(체크박스 자체는 `[ ]` 로 정직하게 미체크 상태 유지) | `plan/in-progress/interaction-type-guard-comment-false-negative.md` "후속" 섹션 `[harness, 비차단]`, `[심각도 격상 2026-07-18]` 문단 | 분기를 실제 수행하면 결과물 경로를 문단에 링크하거나, 아직 미수행이면 "충족한다"(완료 서술)를 "충족시킬 예정/분기 필요"로 낮춰 상태 정확히 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `.tsx`/`ScriptKind` 동일 수집 결론이 커밋된 회귀 테스트가 아니라 plan 문서의 1회성 수동 프로브에만 근거 — TS 버전 업그레이드나 향후 `.tsx` 사이트 등록 시 가정이 깨져도 감지 불가(현재 전 사이트 `.ts` 라 즉각 리스크 없음) | `interaction-type-exhaustiveness.test.ts` `ts.ScriptKind.TS` 하드코딩 | 하드코딩 옆에 결정 근거와 plan 링크를 남기거나, `.tsx` 사이트 추가 시점에 프로브를 정식 회귀 테스트로 승격 |
| 2 | 테스트 | 보간 템플릿 리터럴(`TemplateHead`/`Middle`/`Tail`)은 `collectCodeStringLiterals` 의 두 타입가드 어디에도 걸리지 않아 미탐지 — 현재 등록 사이트 어디도 이 패턴 미사용이라 즉각 리스크 낮음 | `interaction-type-exhaustiveness.test.ts` `collectCodeStringLiterals` | 선택: self-test 에 보간 템플릿 부정 케이스 추가, 또는 함수 docstring 에 한계 한 줄 명시 |
| 3 | 테스트 | `readRepoFile` 의 `__dirname` 기준 `"../../../../../"` 5단계 상대경로 하드코딩(본 diff 범위 밖, 기존 코드) — 디렉터리 구조 변경 시 조용히 실패 가능 | 동일 파일 `readRepoFile` | 조치 불요(정보 제공). 필요 시 리포 루트 마커 탐색 유틸로 대체 가능 |
| 4 | 유지보수성 | (사전 존재, 이번 diff 범위 밖) 두 exhaustiveness `describe` 블록의 "missing" 배열 구축 + 에러 메시지 생성 로직이 거의 동일한 구조로 반복 | `interaction-type-exhaustiveness.test.ts` 두 exhaustiveness describe | 조치 불요. 세 번째 exhaustiveness 가드 추가 시점에 공용 헬퍼 추출 고려 |
| 5 | 요구사항/문서화 | (스코프 밖, pre-existing) `spec/conventions/interaction-type-registry.md` frontmatter `code:` 글로브에 SoT 모듈 `interaction-type-registry.ts` 자체가 미등재(§5 본문은 이 파일을 인용함에도) — 이번 diff 가 유발한 drift 아님 | `spec/conventions/interaction-type-registry.md` frontmatter | 조치 불요 — `spec-coverage` 축 게이트에 이미 위임됨 |
| 6 | 요구사항 | consistency-check 번들러가 alphabetic 정렬로 대용량 `cafe24-api-catalog/**` 덤프에 밀려 실제 target(`interaction-type-registry.md`) 을 100% 치환한 harness 인프라 결함 — 각 checker 가 우회 재검증으로 BLOCK:NO 판정 자체는 유효함을 자체 확인, plan 에도 이미 기록됨 | `review/consistency/2026/07/18/12_04_53/*` 세션 전체 | 신규 조치 불요 — 기존 추적 항목(WARNING #1 의 harness task 분기)으로 다룰 사안 |
| 7 | 보안/부작용 | `review/consistency/2026/07/18/12_04_53/**` 8개 신규 파일 생성은 `/consistency-check --impl-prep` 정상 산출물(프로젝트 규약상 커밋 대상) — 의도치 않은 부작용 아님 | `review/consistency/2026/07/18/12_04_53/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임/프로덕션 코드 변경 없음(테스트·주석·문서뿐). 경로 조합·파서 입력 모두 하드코딩 상수 기반이라 공격 표면 없음 |
| requirement | NONE | plan 의 두 선택적 후속 항목(JSDoc 용어 정정, self-test fixture 보강)을 정확히 구현. TS 컴파일러 API로 직접 재현해 모든 fixture 주장·`.tsx` vacuous 판단 검증 완료. spec 과 line-level 일치 |
| scope | NONE | fork-point(`22cc48ef3`) 기준 diff 11개 파일이 plan 두 후속 항목에 정확히 대응. 불필요한 리팩토링/기능확장/무관 수정 없음 |
| side_effect | NONE | 함수 시그니처·공개 인터페이스·전역 상태·네트워크 변경 없음. 유일한 FS 부작용은 프로젝트 규약에 부합하는 리뷰 산출물 생성 |
| maintainability | NONE | 주석 정정과 fixture 루프화가 오히려 중복을 줄임. 가독성·일관성 양호 |
| testing | LOW | vitest 3 tests PASS 직접 확인, 양방향 mutation 프로브로 fixture 실효성 검증됨. `.tsx` 미커밋 프로브 의존·템플릿 리터럴 미탐지 2건 INFO |
| documentation | LOW | 주석 정정 전수 확인(잔여 "grep" 0건), spec-코드-주석 3자 일치. plan 의 harness 분기 추적 링크 부재 1건 WARNING |

## 발견 없는 에이전트

security, requirement, scope, side_effect, maintainability — 각 NONE 위험도, blocking 발견 없음(INFO 참고 기록만 존재).

## 권장 조치사항

1. (경미, 비차단) `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 harness 분기 서술을 실제 분기 파일 경로로 보강하거나, 미수행 상태라면 "충족한다"를 "충족 예정"으로 낮춰 표현 정확도를 맞춘다.
2. (선택) `.tsx`/`ScriptKind` 동일 수집 결론과 보간 템플릿 리터럴 미탐지 한계를 코드 주석 또는 self-test 에 명시해 향후 유지보수자가 plan 아카이브를 뒤지지 않아도 근거를 파악할 수 있게 한다.
3. 위 항목들은 모두 비차단(non-blocking) 이며 즉각 조치 불요 — 필요 시 후속 커밋에서 가볍게 정리 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원 forced) — **전원 결과 확보됨, 누락 없음**
  - **제외**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명) — 각각 성능/아키텍처/의존성/DB/동시성/API계약/유저가이드 변경 없음
