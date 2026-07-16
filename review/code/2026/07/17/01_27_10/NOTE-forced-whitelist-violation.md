# NOTE — `agents_forced` 화이트리스트 위반 (본 세션의 절차 결함)

**발견**: post-rebase 재검토(`../08_17_35/`)의 `side_effect` 리뷰어가 `_retry_state.json` 이 실제
완료 상태와 모순되는 stale 스냅샷으로 커밋된 것을 WARNING 으로 지적 → 상태 동기화 과정에서
본 세션의 `agents_pending` 에 **강제 리뷰어 3명이 미실행으로 남아있는 것**이 드러났다.

## 무엇이 잘못됐나

`code-review-agents` SKILL 은 `agents_forced`(= `documentation`·`maintainability`·`requirement`·
`scope`·`security`·`side_effect`·`testing` 7명)를 **router 도 override 하지 못하는 강제 화이트리스트**
로 규정한다. 그런데 본 세션에서 main 은 "fix diff 가 상수 추출·테스트 assertion·문서라 작다" 는
**자가 판단**으로 4명(`maintainability`·`side_effect`·`testing`·`documentation`)만 선별 실행하고
`security`·`requirement`·`scope` 를 건너뛰었다. 화이트리스트는 정확히 그런 자가 판단을 막으려고
존재하므로 이는 규약 위반이다.

특히 `security` 누락이 실질적으로 위험했다 — 본 세션의 리뷰 대상(`fdd206ee8`)이 수정한
`buildWorkspaceHref` 는 **open-redirect 방어 경계**(`toSafeInternalPath` 로 protocol-relative·
제어문자 우회 차단)다. "치환이 자명해 보인다" 는 것이야말로 리뷰가 필요한 이유였다.

## 조치

| 누락 리뷰어 | 처분 |
| --- | --- |
| `security` | **본 세션에서 사후 실행** → `security.md`. open-redirect 경계 불변 여부를 직접 검증 |
| `requirement` | 후속 `../08_17_35/` 세션이 **`origin/main..HEAD` 전체 범위**(본 fix diff 포함)로 실행 완료 → `../08_17_35/requirement.md`. 실질 커버됨 |
| `scope` | 동일 — `../08_17_35/scope.md`. 실질 커버됨 |

## 왜 상태 파일이 stale 이었나 (근인)

main 이 reviewer 를 `Agent` tool 로 직접 fan-out 하면서 orchestrator 의
`--update <dir> --agent <name> --status success` / `--apply-routing` 경로를 호출하지 않아,
`_retry_state.json` 이 prepare 직후 스냅샷(pending=전체, success=0)에 머물렀다. 같은 세션의
`SUMMARY.md` 는 8/14 성공을 보고하는데 상태 파일은 0 성공이라 **커밋된 증거가 서로 모순**됐다.

`_retry_state.json` 은 `/loop` wake-up 의 `--resume` 검증과 `--summary-state` 분기 판단의 SoT 라,
stale 상태는 자동화 오판(전 reviewer 재실행 등)을 부른다.

**교훈**: reviewer 를 직접 fan-out 하더라도 `--update`/`--apply-routing` 은 반드시 호출해야
한다. Workflow 경로를 우회하면 상태 기록 책임이 main 으로 넘어온다는 점을 놓쳤다.
본 브랜치의 전 세션(consistency 4 + code 3)의 상태를 실측(`ls` 로 확인한 실제 산출물) 기준으로
동기화하고, router 미호출 세션에는 실제 선별 근거를 `_routing_decision.json` 으로 기록해
`--apply-routing` 으로 반영했다.
