# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 실질 코드(`isPendingPlanPath` 순수 함수 + 테스트 3파일)는 14개 reviewer 전원이 NONE 판정. 남은 WARNING 3건은 전부 이번 PR의 **문서 산출물(CHANGELOG.md, plan 문서)의 수치 정확성** 문제이며 코드 결함이 아니다. forced(router_safety) 화이트리스트 8개(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 정상 확보되어 있어 강제 목록 미이행은 없다.

> **투명성 참고(조치 불요)**: security·documentation 두 reviewer 가 리뷰 도중 `isPendingPlanPath` 본문이 일시적으로 `return true;`(plan §D M5 뮤턴트와 동일 형태)로 바뀐 워킹트리 상태를 독립적으로 관측했다. 둘 다 자신이 만든 변경이 아니며, 재확인 시 원복되어 있었다고 명시했다 — 병렬 fan-out 중 다른 reviewer(testing)가 수행한 판별 뮤테이션 검증의 잔여물로 추정된다. 두 reviewer 모두 이 상태를 근거로 판단을 내리지 않았음을 밝혔다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | `CHANGELOG.md`에 이번 PR과 무관한, 이미 머지된 `#1387`(jest ESM 네이티브 로드)의 CHANGELOG 누락 백필이 같은 커밋(`d644263cd`)에 동봉됨 | `CHANGELOG.md:28-47` | 저장소 관행("누락 발견 시 그 턴에 백필")과 `RESOLUTION.md` 투명 기록으로 정당화되나, 별도 `docs(changelog): #1387 backfill` 커밋으로 분리했다면 더 명확했을 것 — 머지를 막을 사안 아님 |
| 2 | Maintainability / Documentation / Testing (공통) | `CHANGELOG.md`가 판별 부담을 "단위 테스트 15개"로 서술하나, `spec-frontmatter-parse.test.ts`의 실제 `isPendingPlanPath` 전담 테스트는 8개뿐(15개 중 7개는 무관한 기존 `isApplicable` 테스트). 회귀 안전망 두께를 과신하게 만드는 수치 | `CHANGELOG.md:25-26` | "15"를 실측(전담 8개, 또는 assertion 기준 16 — 기준 명시)으로 정정. 향후 수치 재기재 전 `grep -c "  it("`로 재확인 |
| 3 | Documentation | `plan/in-progress/pending-plan-is-plan.md`의 테스트 개수 claim("단위 13 · 가드 55")이 stale — 최초 구현 커밋(`c288c7aaf`) 시점 스냅샷이며, 같은 커밋(`d644263cd`)이 이 문서의 §2.1 인용은 고쳤으면서 이 숫자는 갱신 안 함. 실측 `npx vitest run` 결과 15+55=70 | `plan/in-progress/pending-plan-is-plan.md:76`, `:107` | "단위 15 · 가드 55"(합 70)로 갱신하거나 각주로 정정. 문서는 곧 `plan/complete/`로 이동할 종결 기록이므로 갱신 가치 있음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `path.posix.normalize`는 POSIX 구분자(`/`) 기준이라 백슬래시 세그먼트는 `..`로 인식 안 됨(이론적 트래버설 틈). 다만 신뢰 경계(PR 리뷰 병합 spec)와 후속 `fs.existsSync`의 플랫폼 특성상 실제 악용 가능성 사실상 없음 | `spec-frontmatter-parse.ts:102` | 필수 아님. 다음 수정 기회에 `relPath.includes("\\")` 거부 등으로 이론적 틈까지 폐쇄 가능 |
| 2 | Architecture / Maintainability (중복, 선재·유예됨) | "plan 위치 디렉터리" 지식이 `PENDING_PLAN_DIRS`(배열)와 `spec-pending-plan-existence.test.ts`의 문자열 치환(`"/in-progress/"→"/complete/"`)에 독립 중복. 직전 라운드에서 이미 지적·유예(세 번째 소비처 등장 시 통합) | `spec-frontmatter-parse.ts:95` / `spec-pending-plan-existence.test.ts:64` | 조치 불요 — 기존 유예 결정 승계. 세 번째 plan 위치 등장 시 통합 재고 |
| 3 | Architecture | `isApplicable(relPath: string)`와 `isPendingPlanPath(relPath: unknown)`의 시그니처 비대칭 — 의도(신뢰 경계 차이)는 합리적이나 주석에 암묵적으로만 드러남 | `spec-frontmatter-parse.ts:75`, `:97` | 다음 수정 기회에 "왜 `unknown`을 받는가(신뢰 경계)"를 한 줄로 명시 |
| 4 | Maintainability (선재·유예됨) | `isApplicable`과 `isPendingPlanPath`가 "배열 접두사 중 하나로 시작하는가"를 각자 인라인 `.some(startsWith)`로 중복 구현 | `spec-frontmatter-parse.ts:77`, `:104` | 조치 불요 — 세 번째 유사 술어 추가 시 공용 헬퍼(`hasAnyPrefix`)로 통합 재고 |
| 5 | Requirement | 검증 중 단 1회, `spec-frontmatter-parse.test.ts` 단독 실행 시 `isPendingPlanPath` 단언 전체가 FAIL 관측됨. 캐시 삭제 후 8회 이상 재현 시도했으나 이후 전부 GREEN — 병렬 fan-out 세션 간 vite 캐시 경합으로 추정, 소스 결함 아님 | 관측 명령: `npx vitest run spec-frontmatter-parse.test.ts --reporter=verbose` | 조치 불요(재현 불가). 반복 관측 시 `--pool=forks --poolOptions.forks.singleFork` 등 캐시 격리 검토(harness 개선, developer 소관) |
| 6 | Testing | plan 문서 §D M5 뮤테이션 실측치 "단위 5 RED"가 실제 재현 결과(7 RED)와 다름. 정성적 결론("가드는 못 잡고 단위가 잡는다")은 일치하나 정량 수치가 부정확 | `plan/in-progress/pending-plan-is-plan.md:64` | 다음 plan 파일 편집 기회에 "7 RED"로 정정. 머지를 막을 사안 아님 |
| 7 | Testing (재확인, 이미 완화됨) | 코퍼스 기반 가드(`spec-pending-plan-existence.test.ts`)는 현재 위반 0건이라 그 자체로는 predicate 파손을 못 잡음 — 1라운드에서 이미 지적, 판별 책임을 단위 테스트로 명시적 이전 완료 | `spec-pending-plan-existence.test.ts:51-58` | 조치 불요 — 기존 완화 유효함을 재확인 |
| 8 | Scope (재확인, 이미 수렴됨) | `plan/in-progress/spec-draft-nullable-notation-followups.md`에 핵심 수정과 무관한 트래커 항목(`0-common.md` 6개 `id: common` 중복) 잔존 — round 1에서 이미 검토·수렴(`--impl-prep` Warning 등재 의무 이행) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 |
| 9 | Security / Documentation (중복) | 리뷰 도중 관측된 일시적 워킹트리 이상 상태(`isPendingPlanPath`가 `return true;`로 바뀐 상태) — 재확인 시 원복 확인, 본 세션이 만든 변경 아님, 병렬 리뷰어의 판별 뮤테이션 잔여물로 추정 | `spec-frontmatter-parse.ts:97-105` (관측 당시) | 조치 불요 — 투명성 기록 목적 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이론적 백슬래시 트래버설 틈(실질 무해), 워킹트리 일시 이상 관측 |
| performance | NONE | 발견 없음 — 순수 상수시간 함수 |
| architecture | NONE | plan 디렉터리 지식 중복(선재·유예), 시그니처 비대칭(INFO) |
| requirement | NONE | 핵심 로직 전 검증 통과, 1회 비재현 flake 관측 |
| scope | LOW | 무관한 PR #1387 CHANGELOG 백필 동봉(WARNING) |
| side_effect | NONE | 발견 없음 — 순수 함수, 전역상태/부작용 없음 |
| maintainability | LOW | CHANGELOG "15개" 수치 부정확(WARNING), 중복 구현 2건(선재 INFO) |
| testing | NONE | 70/70 PASS 재확인, M5 수치 오류·CHANGELOG 수치 과장(INFO) |
| documentation | LOW | plan 문서 테스트 개수 stale(WARNING), CHANGELOG 수치 과장(INFO) |
| dependency | NONE | 신규 의존성/버전 변경 없음 |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 — 순수 동기 로직 |
| api_contract | NONE | 해당 없음 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 매칭 0건 |

## 발견 없는 에이전트

performance, side_effect, dependency, database, concurrency, api_contract, user_guide_sync

## 권장 조치사항

1. `plan/in-progress/pending-plan-is-plan.md:76,107`의 테스트 개수 claim을 "단위 15 · 가드 55"(합 70)로 정정 — 종결 기록이 곧 `plan/complete/`로 이동하므로 우선순위 있음.
2. `CHANGELOG.md:25-26`의 "단위 테스트 15개" 판별력 서술을 실측(전담 8개)에 맞게 정정 또는 분모를 명확히("파일 전체 15개 중 `isPendingPlanPath` 전담 8개").
3. `plan/in-progress/pending-plan-is-plan.md:64`의 M5 뮤테이션 표를 "단위 5 RED"→"단위 7 RED"로 정정.
4. (선택) `CHANGELOG.md`의 `#1387` 백필을 향후 유사 사례에서는 별도 커밋으로 분리하는 관행 고려.
5. 위 1~3은 전부 문서/plan 파일 수치 정정으로, 코드(`isPendingPlanPath` 및 테스트) 자체의 재작업은 불필요.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재, prompt 상 `routing: skipped`). 전체 14개 reviewer 강제 실행됨.
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — 전원 결과 확보됨.
  - **제외**: 없음(0명).
