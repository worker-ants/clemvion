# Code Review 통합 보고서 — rebase 후 재검토

**성격**: `origin/main` 이 `f8c334947`(#957 "plan grooming + spec drift 정정")로 전진해 rebase 한 뒤의
재검토. **코드 내용은 직전 리뷰(`../01_07_43/` LOW/Critical 0 + `../01_27_10/` fix 커버)에서 이미
전수 검토됐고 변경 없음** — 본 세션의 초점은 **main 의 새 내용과의 의미 충돌 여부**다.
(rebase 후 리뷰 생략은 본 프로젝트 방침이 아니다.)

리뷰 대상: `origin/main..HEAD` (커밋 8개 — rebase 시 중복 1건 drop).

## 전체 위험도
**LOW** — Critical 0건. rebase 는 깨끗하고 main 과의 의미 충돌 없음. Warning 2건은 모두 조치 완료.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 조치 |
|---|----------|----------|------|------|
| 1 | Documentation | **CI job 이름 오기** — 본 PR 이 `e2e-backend`·`e2e-frontend` 두 잡이라 서술했으나 실제 job 이름은 `e2e`·`e2e-frontend` (`.github/workflows/e2e.yml:45,84`). 문서가 실존하지 않는 잡을 가리켜, 근거를 확인하려는 독자가 헛수고하게 된다 | `PROJECT.md:36`, `.claude/test-stages.sh:122` | **fix** — 양쪽을 `e2e`(backend supertest)·`e2e-frontend`(playwright) 로 정정 |
| 2 | Side Effect | **`_retry_state.json` 이 실제 완료 상태와 모순되는 stale 스냅샷으로 커밋됨** — 같은 세션 `SUMMARY.md` 는 5/5(또는 8/14) 성공을 보고하는데 상태 파일은 `pending=전체, success=0`. `/loop` wake-up 의 `--resume` 검증·`--summary-state` 분기의 **SoT** 라 자동화가 "아무것도 안 돌았다" 로 오판할 수 있다. rebase 로 들어온 #957 의 W2 수정 대상과 **동형 재발** | 본 브랜치의 consistency 4 · code 3 세션 전부 | **fix** — 근인은 main 이 reviewer 를 `Agent` 로 직접 fan-out 하면서 orchestrator 의 `--update`/`--apply-routing` 을 호출하지 않은 것. 전 세션을 **실측(`ls` 로 확인한 실제 산출물) 기준**으로 동기화하고, router 미호출 세션엔 실제 선별 근거를 `_routing_decision.json` 으로 기록해 `--apply-routing` 반영 |

> **W#2 가 더 큰 결함을 드러냈다**: 상태 동기화 중 `../01_27_10/` 세션이 **`agents_forced` 강제
> 화이트리스트 7명 중 3명(`security`·`requirement`·`scope`)을 건너뛴 규약 위반**이 발견됐다.
> "fix diff 가 작다" 는 main 의 자가 판단이었는데, 화이트리스트는 정확히 그런 판단을 막으려고
> 존재한다. 특히 `security` 누락은 실질 위험이었다 — 그 diff 가 수정한 `buildWorkspaceHref` 는
> **open-redirect 방어 경계**다. 사후 실행 결과 **risk=NONE**(방어 경계 불변 확인).
> `requirement`·`scope` 는 본 세션이 `origin/main..HEAD` **전체 범위**(그 fix diff 포함)로 실행해
> 실질 커버됨. 경위·교훈은 [`../01_27_10/NOTE-forced-whitelist-violation.md`](../01_27_10/NOTE-forced-whitelist-violation.md).

## 참고 (INFO) — 발췌

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| 1 | Side Effect | `cmd_e2e` 전환으로 `run-test.sh e2e` 를 호출하는 **모든** 경로(개발자 TEST WORKFLOW·`resolution-applier`)의 벽시계 비용이 ~4-5배(실측 ~260s). `RUN_TEST_TIMEOUT` 기본 1800s 대비 여유가 커 **워치독 오탐 없음**, `on_timeout_e2e`(→`make e2e-down`) 정리 훅도 `e2e-test-full` 기준으로 유효함을 실측 확인. `cmd_e2e` 함수 계약(0-인자·exit code) 불변이라 호출측 파괴 없음 | 의도된 트레이드오프 — CI 와 동일 커버리지를 얻는 대가 |
| 2 | Side Effect | CI 는 `make e2e-test`/`e2e-test-full` 을 **wrapper 없이 직접** 호출하므로 본 변경과 독립 — 이중 실행·시간 증가 없음 | 확인 목적 기재 |
| 3 | Scope | 신규 커밋 `879393b27`(e2e wrapper 확장)은 라우팅 fix 도메인 밖이나 **인과관계가 명시**됨(본 회귀가 그 사각지대의 산물) | INFO |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 확인 |
|----------|--------|-----------|
| requirement | **NONE** (Critical 0 / Warning 0) | **직전 리뷰의 SPEC-DRIFT WARNING 이 spec 반영(`aa01cf4f0`)으로 해소됨.** 본 PR 의 spec 수정이 #957 이 갱신한 main 의 spec 내용과 모순 없음 |
| scope | LOW | 직전 WARNING(무관 plan 섞임)이 **rebase 로 자연 해소**됨을 git 실측 확인 — `89c4b1f6b` 는 `origin/main`·`HEAD` 어디서도 도달 불가하고 파일 내용은 양쪽 동일(#957 이 독립 수행). 히스토리 선형, 유실·잔재 없음 |
| side_effect | LOW | `_retry_state.json` stale(WARNING). `cmd_e2e` 전환의 파급 전수 확인 — 계약 불변·워치독 안전·CI 독립. #957 과 파일 겹침 없어 의미 충돌 없음 |
| documentation | LOW | CI job 이름 오기(WARNING). 본 PR 의 spec 이 `plan/**` 을 마크다운 링크로 걸지 않아 #957 의 **신규 link-integrity 규칙**(spec→plan 링크도 검사, plan 이동 시 build 파괴) 대상 아님을 확인 |
| security (`../01_27_10/`) | **NONE** | 사후 실행 — `WORKSPACE_ROUTE_SEGMENT` 치환이 open-redirect 방어를 약화시키지 않음 확인 |

## 라우터 결정

router 미호출(알려진 Workflow router 매핑 버그 회피). main 이 **rebase 재검토 성격에 맞춰 4명 선별**:

- **실행**: `requirement`(main 의 갱신된 spec 과의 정합) · `scope`(rebase 가 끌어들인/유실한 것) · `side_effect`(main 새 내용과의 의미 충돌 + `test-stages.sh` 파급) · `documentation`(#957 이 바꾼 문서 규약과의 정합)
- **`agents_forced` 준수**: 본 세션의 forced 는 `documentation`·`requirement` 2명 — **둘 다 실행**(위반 없음).
- **제외 근거**: 코드 내용이 직전 리뷰 이후 불변이라 `security`/`maintainability`/`testing` 의 재실행은 동일 결론을 반복한다. 나머지(`performance`·`architecture`·`dependency`·`database`·`concurrency`·`api_contract`)는 해당 없음. 선별 근거는 `_routing_decision.json` 에 기록해 `--apply-routing` 으로 상태에 반영했다.
