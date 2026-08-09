# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건, 코드 결함성 CRITICAL/WARNING 없음. 유일한 WARNING 은 `testing` reviewer 가 관찰한 **재현 미확정 flaky 테스트**(2회 연속 FAIL 후 8회 이상 PASS) — 원인 미확정이므로 게이트 신뢰도 관점에서 낮게 보지 않고 MEDIUM 으로 유지. 그 외 전 reviewer 는 NONE/LOW.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `plan-scan.test.ts` 독립 실행 시 최초 2회 연속 4개 테스트가 재현성 있게 FAIL(`no-status.md`/`broken.md`/`status-empty.md`/`status-num.md`/`status-list.md` 가 위반으로 잘못 잡힘 — `typeof status !== "string"` 분기와 `catch{continue}` 분기가 전혀 동작 안 한 것처럼 보임), 이후 캐시 삭제·격리 재현·8회 이상 재실행에서는 계속 PASS. 원인 미확정 | `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` (실행 시점 관찰); 관련 로직 `plan-scan.ts:112-127` | CI 에서 `--repeat`/반복 실행으로 flakiness 유무 확인. `gray-matter`/YAML 파싱 워밍업, Vite 의존성 사전번들링 타이밍, 병렬 `it()` 간 `matter()` 캐시 여부를 별도 조사. 최소한 관찰 기록 후 CI 로그에서 동일 패턴 재발 모니터링 필요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 빈 문자열 `status: ""` 케이스가 fixture 로 커버되지 않음(로직은 정확 — 위반으로 잡힘) | `plan-scan.ts:122`; 대응 테스트 부재는 `plan-scan.test.ts` | 여유 있으면 `plan/complete/status-blank.md`(`status: ""`) fixture 추가해 `found` 포함을 단언 |
| 2 | requirement | `collectCompletePlanMarkdown` 은 "빈 트리 → `[]`" 계약을 직접 단언하지 않음(다른 두 진입점만 단언) | `plan-scan.test.ts:173-181` | `expect(collectCompletePlanMarkdown(empty)).toEqual([])` 한 줄 추가 |
| 3 | testing | `walkPlanMarkdown` 의 `out.sort(...)` 정렬 보장이 어떤 테스트로도 관측되지 않음 — 지우거나 비교자를 뒤집어도 RED 안 남 | `plan-scan.ts:71`; 비교 지점 `plan-scan.test.ts:142` | 역순 이름의 fixture 2개 이상으로 정렬되지 않은 raw 배열과 `toEqual` 직접 비교하는 테스트 추가 |
| 4 | testing | `spec-plan-completion.test.ts`(Gate C) 는 이번 PR 이 도입한 공유 `walkPlanMarkdown`/`collectCompletePlanMarkdown` 을 쓰지 않고 독립된 `collectCompletePlans` 구현을 유지 — 향후 한쪽만 바뀌면 조용히 어긋날 위험 | `spec-plan-completion.test.ts` (diff 밖) vs `plan-scan.ts:46-73` | 이번 PR 범위 밖. 후속 작업으로 Gate C 도 `collectCompletePlanMarkdown` 으로 교체하거나 두 구현의 결과셋을 비교하는 회귀 테스트 추가 검토 |
| 5 | testing | `status: true`/`status: false` boolean 리터럴 케이스가 명시적 fixture 로 없음(로직상 커버되긴 함) | `plan-scan.test.ts:49-55` | 우선순위 낮음. `status-bool.md`(`status: false`) fixture 고려 |
| 6 | side_effect | `TERMINAL_STATUSES` 가 `ReadonlySet<string>` 으로 타입만 선언되고 런타임엔 일반 `Set` — 타입 단언/`as any` 로 우회 시 변형 가능(현재 그런 우회 없음) | `plan-scan.ts:93` | 필요시 `Object.freeze(new Set([...]))`, 현재 상태 유지도 무방 |
| 7 | side_effect | (확인 완료·조치 불필요) `spec-links.ts` re-export 로의 `collectLivePlanMarkdown` 재배선 — 반환 타입 구조적으로 동일해 호출부 영향 없음 | `spec-links.ts:17,289` | 없음 |
| 8 | side_effect | `plan-scan.test.ts` fixture 가 `os.tmpdir()` 에 실제 쓰기를 하지만 `beforeAll`/`afterAll`·`try/finally` 로 격리·정리 적절 | `plan-scan.test.ts:32-35, 64-66, 174-180` | 없음 (기존 저장소 공통 패턴) |
| 9 | maintainability | 8개 `it` 블록에서 `findNonTerminalCompletedPlans(root)` 동일 호출 반복 — 비용 낮고 명시성 측면에서 현재도 무방 | `plan-scan.test.ts:70` 이하 다수 | fixture 커지면 `beforeEach` 1회 계산 공유 고려 |
| 10 | maintainability | `walkPlanMarkdown` 최대 중첩 깊이 4단계 — 트리 워커 전형 패턴, 과도하지 않음 | `plan-scan.ts:55` | 변경 불필요 |
| 11 | security | frontmatter 파싱 실패를 조용히 스킵(silent catch) — 의도된 설계, 테스트로 잠김. 현재 스코프에서 위험 없음 | `plan-scan.ts:116-120` | 재사용 시(보안-critical 검사로 전용 시) 파싱 실패 카운트/로그 권장. 현재는 조치 불필요 |
| 12 | security | `gray-matter`(js-yaml safe schema) 의존, 입력이 저장소 내부·CI 전용이라 실질 공격 표면 없음 | `plan-scan.ts:22, 117` | 통상적인 의존성 점검 외 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | spec(`.claude/docs/plan-lifecycle.md §4`) 과 line-level 일치 확인, 13/13+149/149 테스트 재실행 및 독립 뮤테이션으로 이전 라운드 WARNING 해소 재검증. 테스트 커버리지 갭 2건(INFO)만 잔존 |
| scope | NONE | 변경이 "무관측 분기 fixture 화 + JSDoc 정정" 으로 정확히 한정, 더 넓은 리팩터링 제안은 별도 plan 문서로 명시적 이관 |
| side_effect | NONE | 프로덕션 스캔 코드는 순수 읽기 전용, 테스트 파일 쓰기는 격리된 임시 디렉터리 한정, 호출부 재배선 전수 대조 완료 |
| maintainability | NONE | 함수 분리·네이밍·docstring 우수, 실제 통합(중복 제거) 실증 확인, 명백한 결함 없음 |
| testing | MEDIUM | 테스트 설계는 모범적(mock 없음, negative-path, 과잉탐지 방지)이나 **독립 실행 시 재현 미확정 flaky 4테스트** 관찰(WARNING), sort 미관측·Gate C 이원화는 INFO |
| security | NONE | CI/dev-tooling 전용, 신뢰 경계를 넘는 입력 없음. silent catch·YAML 파서 의존은 INFO 수준 |

## 발견 없는 에이전트

없음 — 전 6개 reviewer 가 최소 INFO 이상 1건씩 보고함 (scope/side_effect/maintainability/security 는 위험도 NONE 이지만 관찰/확인 사항 INFO 를 기록).

## 권장 조치사항
1. **(WARNING, 우선)** `plan-scan.test.ts` 독립 실행 시의 재현 미확정 flaky 실패를 CI 에서 반복 실행(`--repeat` 등)으로 재현 시도하고, `gray-matter` 워밍업/Vite 사전번들링/병렬 `it()` 캐시 가능성을 조사해 원인을 확정하거나 최소한 관찰을 기록해 모니터링한다.
2. (INFO, 여유 시) `walkPlanMarkdown` 의 `sort()` 순서 보장을 직접 단언하는 테스트 추가.
3. (INFO, 후속 PR) Gate C(`spec-plan-completion.test.ts`)의 독립 `collectCompletePlans` 를 공유 `plan-scan.ts` 로 교체하거나 두 구현의 결과 동등성 회귀 테스트 추가.
4. (INFO, 여유 시) `status: ""` / `collectCompletePlanMarkdown` 빈 트리 직접 단언 / `status: false` boolean fixture — 테스트 커버리지 완결성 보완.

## 라우터 결정

- `routing_status=all` (사실상 라우터 스킵/전원 강제와 동일 — prompt 상 `routing: all`):
  - **실행**: `requirement, scope, side_effect, maintainability, testing, security` (6명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨 (누락 없음, 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |